// Face + body tracking with MediaPipe, run entirely in the browser.
// Input frames are already mirrored (selfie view), so every coordinate this
// module produces is in display space: x grows to the right of the screen.

import { FilesetResolver, FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { FilterBank } from './filters.js';
import { NEUTRAL_BS } from './characters.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Face mesh landmark indices.
const FL = {
  forehead: 10, chin: 152, nose: 1,
  cheekA: 234, cheekB: 454,
  // eye A / eye B: outer corner, inner corner, upper lid, lower lid, iris centre
  eyeA: [33, 133, 159, 145, 468],
  eyeB: [263, 362, 386, 374, 473],
};

// Pose landmark indices.
export const PL = {
  nose: 0, earL: 7, earR: 8,
  shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16,
  indexL: 19, indexR: 20, hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28,
};

const POSE_KEYS = Object.keys(PL);
const BASELINE_KEYS = new Set(['browDownL', 'browDownR', 'browInnerUp', 'browOuterUpL', 'browOuterUpR', 'frown', 'smile', 'wideL', 'wideR', 'pucker']);

async function createTask(TaskClass, fileset, modelPath, extra) {
  for (const delegate of ['GPU', 'CPU']) {
    try {
      return await TaskClass.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate },
        runningMode: 'VIDEO',
        ...extra,
      });
    } catch (err) {
      if (delegate === 'CPU') throw err;
      console.warn(`${TaskClass.name}: GPU delegate failed, falling back to CPU`, err);
    }
  }
  return null;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Position of p along the segment a→b (0 at a, 1 at b), ignoring sideways offset.
function along(p, a, b) {
  const ab = sub(b, a);
  return dot(sub(p, a), ab) / Math.max(1e-6, dot(ab, ab));
}

export class Tracker {
  constructor() {
    this.face = null;
    this.pose = null;
    this.lastT = 0;
    this.posFilters = new FilterBank(1.2, 0.008);
    this.angFilters = new FilterBank(1.5, 0.4);
    this.bsFilters = new FilterBank(4.0, 1.5);
    this.poseFilters = new FilterBank(1.0, 0.006);
    this.calib = { yaw: 0.5, pitch: 0.5, samples: 0, base: {} };
    this.sideVote = 0; // >0: MediaPipe "Left" = screen left, <0: swapped
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    this.state = {
      face: null, faceSeenAt: -Infinity,
      pose: null, poseSeenAt: -Infinity,
      mask: null, maskAt: -Infinity,
    };
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    [this.face, this.pose] = await Promise.all([
      createTask(FaceLandmarker, fileset, FACE_MODEL, {
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      }),
      createTask(PoseLandmarker, fileset, POSE_MODEL, {
        numPoses: 1,
        outputSegmentationMasks: true,
      }),
    ]);
  }

  recalibrate() {
    this.calib = { yaw: 0.5, pitch: 0.5, samples: 0, base: {} };
  }

  // frame: full-res mirrored canvas; small: downscaled copy for pose/segmentation.
  process(frame, small, needPose, now) {
    const t = Math.max(this.lastT + 1, now);
    this.lastT = t;
    const W = frame.width;
    const H = frame.height;

    const faceRes = this.face.detectForVideo(frame, t);
    const lm = faceRes.faceLandmarks?.[0];
    if (lm) {
      this.state.face = this.readFace(lm, faceRes.faceBlendshapes?.[0]?.categories ?? [], W, H, t);
      this.state.faceSeenAt = now;
    }

    if (needPose && this.pose) {
      const poseRes = this.pose.detectForVideo(small, t);
      const pl = poseRes.landmarks?.[0];
      if (pl) {
        this.state.pose = this.readPose(pl, W, H, t);
        this.state.poseSeenAt = now;
      }
      const mask = poseRes.segmentationMasks?.[0];
      if (mask) {
        this.readMask(mask);
        this.state.mask = this.maskCanvas;
        this.state.maskAt = now;
      }
      poseRes.segmentationMasks?.forEach((m) => m.close());
    }
  }

  readFace(lm, cats, W, H, t) {
    const P = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
    const forehead = P(FL.forehead);
    const chin = P(FL.chin);
    const nose = P(FL.nose);
    let cheekL = P(FL.cheekA);
    let cheekR = P(FL.cheekB);
    if (cheekL.x > cheekR.x) [cheekL, cheekR] = [cheekR, cheekL];

    // Eyes sorted by which side of the screen they are on.
    const eye = (ids) => ({
      outer: P(ids[0]), inner: P(ids[1]), up: P(ids[2]), down: P(ids[3]), iris: P(ids[4]),
    });
    let eyeL = eye(FL.eyeA);
    let eyeR = eye(FL.eyeB);
    if (eyeL.outer.x > eyeR.outer.x) [eyeL, eyeR] = [eyeR, eyeL];
    const eyeLeftCorner = (e) => (e.outer.x < e.inner.x ? e.outer : e.inner);
    const eyeRightCorner = (e) => (e.outer.x < e.inner.x ? e.inner : e.outer);
    const ear = (e) => dist(e.up, e.down) / Math.max(1, dist(e.outer, e.inner));

    const rollRaw = Math.atan2(eyeR.outer.y - eyeL.outer.y, eyeR.outer.x - eyeL.outer.x);
    const yawRatio = along(nose, cheekL, cheekR);
    const pitchRatio = along(nose, forehead, chin);

    // Learn the neutral head position from the first second of tracking.
    if (this.calib.samples < 30) {
      const n = ++this.calib.samples;
      this.calib.yaw += (yawRatio - this.calib.yaw) / n;
      this.calib.pitch += (pitchRatio - this.calib.pitch) / n;
    }
    const yawRaw = Math.asin(clamp((yawRatio - this.calib.yaw) * 2.2, -1, 1));
    const pitchRaw = clamp((pitchRatio - this.calib.pitch) * 3.2, -0.8, 0.8);

    const faceW = dist(cheekL, cheekR);
    const faceH = dist(forehead, chin);
    const cx = (forehead.x + chin.x) / 2;
    const cy = (forehead.y + chin.y) / 2;

    // Gaze from the iris position between the eye corners (-1 = screen left, 1 = right).
    const gazeX = (e) => (along(e.iris, eyeLeftCorner(e), eyeRightCorner(e)) - 0.5) * 2;

    // Blendshapes.
    const raw = {};
    for (const c of cats) raw[c.categoryName] = c.score;
    const g = (k) => raw[k] ?? 0;

    // MediaPipe's Left/Right naming is relative to the subject; check against the
    // eye openness we can see, so a wink closes the eye on the correct screen side.
    const earL = ear(eyeL);
    const earR = ear(eyeR);
    const blinkDiff = g('eyeBlinkLeft') - g('eyeBlinkRight');
    if (Math.abs(blinkDiff) > 0.25) {
      this.sideVote = clamp(this.sideVote + Math.sign(blinkDiff) * Math.sign(earR - earL), -20, 20);
    }
    const swap = this.sideVote < -3;
    const side = (base) => {
      const l = g(base + 'Left');
      const r = g(base + 'Right');
      return swap ? [r, l] : [l, r];
    };
    const [blinkL, blinkR] = side('eyeBlink');
    const [wideL, wideR] = side('eyeWide');
    const [browDownL, browDownR] = side('browDown');
    const [browOuterUpL, browOuterUpR] = side('browOuterUp');
    const [smileL, smileR] = side('mouthSmile');
    const [frownL, frownR] = side('mouthFrown');

    // Expressions are measured against your own resting face (learned in the first
    // second), so naturally low eyebrows or a resting frown don't read as emotions.
    const base = this.calib.base;
    const learning = this.calib.samples < 30;
    const B = (name, v) => {
      if (BASELINE_KEYS.has(name)) {
        if (learning) base[name] = (base[name] ?? v) + (v - (base[name] ?? v)) / this.calib.samples;
        const b0 = Math.min(0.6, base[name] ?? 0);
        v = (v - b0) / (1 - b0);
      }
      return clamp(this.bsFilters.f(name, v, t), 0, 1);
    };
    const bs = cats.length ? {
      blinkL: B('blinkL', blinkL), blinkR: B('blinkR', blinkR),
      wideL: B('wideL', wideL), wideR: B('wideR', wideR),
      browDownL: B('browDownL', browDownL), browDownR: B('browDownR', browDownR),
      browOuterUpL: B('browOuterUpL', browOuterUpL), browOuterUpR: B('browOuterUpR', browOuterUpR),
      browInnerUp: B('browInnerUp', g('browInnerUp')),
      smile: B('smile', (smileL + smileR) / 2),
      frown: B('frown', (frownL + frownR) / 2),
      jaw: B('jaw', g('jawOpen')),
      pucker: B('pucker', g('mouthPucker')),
      funnel: B('funnel', g('mouthFunnel')),
      cheekPuff: B('cheekPuff', g('cheekPuff')),
      lookX: clamp(this.bsFilters.f('lookX', (gazeX(eyeL) + gazeX(eyeR)) / 2 * 1.6, t), -1, 1),
      lookY: clamp(this.bsFilters.f('lookY',
        (g('eyeLookDownLeft') + g('eyeLookDownRight') - g('eyeLookUpLeft') - g('eyeLookUpRight')) / 2, t), -1, 1),
    } : { ...NEUTRAL_BS };

    return {
      x: this.posFilters.f('x', cx, t),
      y: this.posFilters.f('y', cy, t),
      width: this.posFilters.f('w', faceW, t),
      height: this.posFilters.f('h', faceH, t),
      roll: this.angFilters.f('roll', rollRaw, t),
      yaw: this.angFilters.f('yaw', yawRaw, t),
      pitch: this.angFilters.f('pitch', pitchRaw, t),
      bs,
    };
  }

  readPose(pl, W, H, t) {
    const joints = {};
    for (const key of POSE_KEYS) {
      const p = pl[PL[key]];
      joints[key] = {
        x: this.poseFilters.f(key + 'x', p.x * W, t),
        y: this.poseFilters.f(key + 'y', p.y * H, t),
        v: p.visibility ?? 1,
      };
    }
    return joints;
  }

  readMask(mask) {
    const w = mask.width;
    const h = mask.height;
    if (this.maskCanvas.width !== w || this.maskCanvas.height !== h) {
      this.maskCanvas.width = w;
      this.maskCanvas.height = h;
      this.maskImage = this.maskCtx.createImageData(w, h);
    }
    const src = mask.getAsFloat32Array();
    const dst = this.maskImage.data;
    for (let i = 0, j = 0; i < src.length; i++, j += 4) {
      // Push confidence up so the mask runs slightly past the body edge (safer for privacy).
      const a = src[i] > 0.12 ? 255 : (src[i] / 0.12) * 255;
      dst[j] = 255; dst[j + 1] = 255; dst[j + 2] = 255; dst[j + 3] = a;
    }
    this.maskCtx.putImageData(this.maskImage, 0, 0);
  }
}

// Demo mode (open the app with ?demo): no camera or models needed.
// Paints a fake room with a fake person and produces scripted tracking data,
// so the characters, backgrounds and recording can be tried anywhere.

import { NEUTRAL_BS } from './characters.js';

function script(t, W, H) {
  const s = t / 1000;
  const u = Math.min(W, H);
  const headX = W / 2 + Math.sin(s * 0.7) * u * 0.08;
  const headY = H * 0.36 + Math.sin(s * 1.3) * u * 0.02;
  const faceW = u * 0.22;
  const phase = Math.floor(s / 2.5) % 5;
  const talk = Math.max(0, Math.sin(s * 9)) * 0.5;
  const bs = { ...NEUTRAL_BS };
  bs.jaw = talk * 0.6;
  if (phase === 1) { bs.smile = 0.85; bs.jaw = 0.15; }
  if (phase === 2) { bs.jaw = 0.75; bs.browInnerUp = 0.8; bs.wideL = bs.wideR = 0.6; }
  if (phase === 3) { bs.browDownL = bs.browDownR = 0.75; bs.jaw = 0.05; bs.frown = 0.2; }
  if (phase === 4) { bs.frown = 0.6; bs.browInnerUp = 0.6; bs.jaw = 0.0; }
  const blink = (s % 3.2) < 0.15 ? 1 : 0;
  bs.blinkL = blink;
  bs.blinkR = phase === 1 && (s % 2.5) > 1.6 ? 1 : blink; // wink while happy
  bs.lookX = Math.sin(s * 0.9) * 0.6;
  bs.lookY = Math.sin(s * 0.6) * 0.3;

  const face = {
    x: headX, y: headY, width: faceW, height: faceW * 1.25,
    roll: Math.sin(s * 0.8) * 0.18, yaw: Math.sin(s * 0.5) * 0.45, pitch: Math.sin(s * 0.9) * 0.25, bs,
  };

  const sw = faceW * 1.9;
  const sy = headY + faceW * 1.15;
  const J = (x, y, v = 0.99) => ({ x, y, v });
  const wave = Math.sin(s * 4) * 0.6;
  const pose = {
    nose: J(headX, headY), earL: J(headX - faceW / 2, headY), earR: J(headX + faceW / 2, headY),
    shoulderL: J(headX - sw / 2, sy), shoulderR: J(headX + sw / 2, sy),
    elbowL: J(headX - sw * 0.85, sy + sw * 0.55), wristL: J(headX - sw * 0.7, sy + sw * 1.05),
    indexL: J(headX - sw * 0.68, sy + sw * 1.15),
    elbowR: J(headX + sw * 0.95, sy + sw * 0.1),
    wristR: J(headX + sw * 0.95 + Math.sin(wave) * sw * 0.45, sy - Math.cos(wave) * sw * 0.45),
    indexR: J(headX + sw * 0.95 + Math.sin(wave) * sw * 0.55, sy - Math.cos(wave) * sw * 0.55),
    hipL: J(headX - sw * 0.35, sy + sw * 1.35, 0.9), hipR: J(headX + sw * 0.35, sy + sw * 1.35, 0.9),
    kneeL: J(0, 0, 0.1), kneeR: J(0, 0, 0.1), ankleL: J(0, 0, 0.1), ankleR: J(0, 0, 0.1),
  };
  return { face, pose, sw, sy };
}

export function drawDemoFrame(ctx, W, H, t) {
  // Room
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c9b79c');
  g.addColorStop(1, '#8a7a63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6b8fb5';
  ctx.fillRect(W * 0.06, H * 0.1, W * 0.22, H * 0.3); // window
  ctx.fillStyle = '#5a4634';
  ctx.fillRect(W * 0.72, H * 0.45, W * 0.22, H * 0.55); // shelf
  // Fake person – this is what must never show in the output
  const { face, sw, sy } = script(t, W, H);
  ctx.fillStyle = '#d33';
  ctx.fillRect(face.x - sw * 0.6, sy, sw * 1.2, H - sy);
  ctx.fillStyle = '#e8b48f';
  ctx.beginPath();
  ctx.ellipse(face.x, face.y, face.width / 2, face.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = `${Math.round(face.width * 0.22)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('REAL', face.x, face.y);
}

export class DemoTracker {
  constructor() {
    this.maskCanvas = document.createElement('canvas');
    this.state = {
      face: null, faceSeenAt: -Infinity, pose: null, poseSeenAt: -Infinity, mask: null, maskAt: -Infinity,
    };
  }

  async init() {}

  recalibrate() {}

  process(frame, small, needPose, now) {
    const W = frame.width;
    const H = frame.height;
    const { face, pose, sw, sy } = script(now, W, H);
    // Drop the face for a moment every 15 s to show the privacy cover.
    if ((now / 1000) % 15 < 13) {
      this.state.face = face;
      this.state.faceSeenAt = now;
    }
    if (needPose) {
      this.state.pose = pose;
      this.state.poseSeenAt = now;
      const m = this.maskCanvas;
      m.width = small.width;
      m.height = small.height;
      const c = m.getContext('2d');
      const k = small.width / W;
      c.fillStyle = '#fff';
      c.fillRect((face.x - sw * 0.6) * k, sy * k, sw * 1.2 * k, (H - sy) * k);
      c.beginPath();
      c.ellipse(face.x * k, face.y * k, face.width / 2 * k * 1.1, face.height / 2 * k * 1.1, 0, 0, Math.PI * 2);
      c.fill();
      this.state.mask = m;
      this.state.maskAt = now;
    }
  }
}

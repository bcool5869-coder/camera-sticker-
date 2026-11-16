// VRM avatar renderer (VTuber-style 3D characters) using @pixiv/three-vrm.
// Drives the avatar's head, eyes, facial expressions, spine and arms from tracking.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// Free avatars. Vita ships with the app; the 100Avatars models (CC0) download on demand.
export const VRM_MODELS = [
  { id: 'vita', name: 'Vita', url: 'models/vita.vrm', emoji: '👧' },
  { id: 'rabbit', name: 'Rabbit', url: 'https://arweave.net/RymRtrmhHx_f9ZDvtvIQb1noTHvILdjoTg5G7L2DR-8', emoji: '🐰' },
  { id: 'teddy', name: 'Teddy', url: 'https://arweave.net/KbaYR3YmtjweLgEcJAWekeh3MNAlF9ZWOYJkbNfi8MM', emoji: '🧸' },
  { id: 'froggy', name: 'Froggy', url: 'https://arweave.net/0iS8IZahQQDqY27djsEsshpDmWJHEoOSfxwYVJ1Opys', emoji: '🐸' },
  { id: 'dinokid', name: 'Dino Kid', url: 'https://arweave.net/T1gkB95XKXAZl_VmU1ozg5Txm--o9nY0Nge3s8zNoBs', emoji: '🦖' },
  { id: 'astronaut', name: 'Astronaut', url: 'https://arweave.net/T0c0z_XEPQHy3vyXz31XB22s_6JTqHdnau8exq_I8tI', emoji: '👩‍🚀' },
  { id: 'coolalien', name: 'Alien', url: 'https://arweave.net/FB3g343NrNmQrr4V0191V93pbzOVwTiQWF3PEcL4MNg', emoji: '👽' },
  { id: 'polybot', name: 'Polybot', url: 'https://arweave.net/DUR8v-IugXppdMBxPdE1rDO2dZCJJ7ZgBTXSRgPJFNo', emoji: '🤖' },
  { id: 'ghost', name: 'Ghost', url: 'https://arweave.net/fSy4hx9L9SqiQIKzjhRLhXzDZpQEJA5izCcDej_WJi8', emoji: '👻' },
  { id: 'snowy', name: 'Snowy', url: 'https://arweave.net/Mqs8hdg-1hpeGq8Jl_LCmhTGdydglPm2V2OGc8jJ5DY', emoji: '⛄' },
  { id: 'witch', name: 'Witch', url: 'https://arweave.net/0YLwWzDkvVWn9ttv2RAdc8bvWcCBjvYPpu7fpjpHYU0', emoji: '🧙' },
  { id: 'pumpkin', name: 'Pumpkin', url: 'https://arweave.net/f9dR81jI8dmPEm2jFcKEL3y5dtdq7fUwUmPUNrEFLu4', emoji: '🎃' },
];

const HEAD_SIZE = 0.3; // metres covered by the tracked head circle diameter

export class AvatarVRM {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10000, 10000);
    this.camera.position.z = 5000;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.3, 0.6, 1);
    this.scene.add(sun);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
    this.vrm = null;
    this.loadingId = null;
    this.clock = new THREE.Clock();
    this.W = 0;
    this.H = 0;
  }

  resize(W, H) {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.renderer.setSize(W, H, false);
    Object.assign(this.camera, { left: 0, right: W, top: 0, bottom: -H });
    this.camera.updateProjectionMatrix();
  }

  // Loads a model by id (or a File the user picked). Resolves when ready.
  async load(idOrFile, onProgress) {
    const key = typeof idOrFile === 'string' ? idOrFile : `file:${idOrFile.name}:${idOrFile.size}`;
    if (key === this.currentId || key === this.loadingId) return;
    this.loadingId = key;
    let url;
    let revoke = null;
    if (typeof idOrFile === 'string') {
      url = (VRM_MODELS.find((m) => m.id === idOrFile) || VRM_MODELS[0]).url;
    } else {
      url = URL.createObjectURL(idOrFile);
      revoke = url;
    }
    try {
      const gltf = await this.loader.loadAsync(url, (e) => {
        if (onProgress && e.total) onProgress(e.loaded / e.total);
      });
      if (this.loadingId !== key) return; // a newer request won
      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error('This file is not a VRM avatar.');
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons?.(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((o) => { o.frustumCulled = false; });
      if (this.vrm) {
        this.holder.remove(this.vrm.scene);
        VRMUtils.deepDispose(this.vrm.scene);
      }
      this.vrm = vrm;
      this.holder.add(vrm.scene);
      if (vrm.lookAt) vrm.lookAt.autoUpdate = false;
      this.measure();
      this.currentId = key;
    } finally {
      if (this.loadingId === key) this.loadingId = null;
      if (revoke) URL.revokeObjectURL(revoke);
    }
  }

  measure() {
    const h = this.vrm.humanoid;
    this.vrm.scene.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    const head = h.getNormalizedBoneNode('head');
    head.getWorldPosition(p);
    this.headPos = p.clone();
    // Visual head centre sits a little above the head joint.
    this.headCentreY = p.y + 0.1;
    // Arms hang down naturally when not tracked.
    this.restArms();
  }

  bone(name) {
    return this.vrm?.humanoid.getNormalizedBoneNode(name) || null;
  }

  restArms() {
    const lu = this.bone('leftUpperArm');
    const ru = this.bone('rightUpperArm');
    if (lu) lu.rotation.set(0, 0, -1.2);
    if (ru) ru.rotation.set(0, 0, 1.2);
    const ll = this.bone('leftLowerArm');
    const rl = this.bone('rightLowerArm');
    if (ll) ll.rotation.set(0, 0, -0.15);
    if (rl) rl.rotation.set(0, 0, 0.15);
  }

  setExpr(name, v) {
    const em = this.vrm.expressionManager;
    if (em && em.getExpression(name)) em.setValue(name, Math.min(1, Math.max(0, v)));
  }

  // head: tracked head (screen px), layout: body layout or null.
  render(head, layout, showBody) {
    const dt = Math.min(0.1, this.clock.getDelta());
    if (!this.vrm || !head) {
      this.holder.visible = false;
      this.renderer.render(this.scene, this.camera);
      return this.canvas;
    }
    this.holder.visible = true;
    const s = (head.r * 2) / HEAD_SIZE;
    this.holder.scale.setScalar(s);
    this.holder.position.set(head.x - this.headPos.x * s, -head.y - this.headCentreY * s, 0);

    // Head, neck and upper spine share the rotation for a natural look.
    const neck = this.bone('neck');
    const headB = this.bone('head');
    const spine = this.bone('upperChest') || this.bone('chest') || this.bone('spine');
    const yaw = head.yaw * 1.1;
    const pitch = head.pitch * 0.9;
    const roll = -head.roll;
    if (headB) headB.rotation.set(pitch * 0.6, yaw * 0.6, roll * 0.6, 'YXZ');
    if (neck) neck.rotation.set(pitch * 0.4, yaw * 0.4, roll * 0.4, 'YXZ');

    // Body: lean with the shoulders, and pose the arms in the screen plane.
    if (showBody && layout) {
      const shoulderAngle = Math.atan2(layout.sR.y - layout.sL.y, layout.sR.x - layout.sL.x);
      const lean = shoulderAngle > Math.PI / 2 ? shoulderAngle - Math.PI : shoulderAngle < -Math.PI / 2 ? shoulderAngle + Math.PI : shoulderAngle;
      if (spine) spine.rotation.set(0, 0, -lean * 0.8);
      this.poseArms(layout);
    } else {
      if (spine) spine.rotation.set(0, 0, 0);
      this.restArms();
    }

    // Expressions. The avatar faces the viewer, so its left eye is on screen-right.
    const bs = head.bs;
    this.setExpr('blinkLeft', bs.blinkR);
    this.setExpr('blinkRight', bs.blinkL);
    this.setExpr('aa', bs.jaw * 1.2);
    this.setExpr('oh', bs.funnel + bs.pucker * 0.6);
    this.setExpr('ih', bs.smile * 0.3);
    this.setExpr('happy', bs.smile > 0.25 ? (bs.smile - 0.25) * 1.4 : 0);
    const browDown = (bs.browDownL + bs.browDownR) / 2;
    this.setExpr('angry', browDown > 0.3 ? (browDown - 0.3) * 1.6 : 0);
    this.setExpr('sad', bs.frown > 0.2 ? (bs.frown - 0.2) * 1.6 : 0);
    const surprised = bs.jaw > 0.3 && bs.browInnerUp > 0.3 ? Math.min(bs.jaw, bs.browInnerUp) : 0;
    this.setExpr('surprised', surprised);
    this.setExpr('Surprised', surprised);
    if (this.vrm.lookAt) {
      this.vrm.lookAt.yaw = bs.lookX * 18;
      this.vrm.lookAt.pitch = -bs.lookY * 12;
    }

    this.vrm.update(dt);
    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }

  // Turn 2D tracked arm directions into upper/lower arm rotations (in the screen plane).
  poseArms(layout) {
    const sMidX = (layout.sL.x + layout.sR.x) / 2;
    const done = { left: false, right: false };
    for (const arm of layout.arms) {
      // An arm on the screen's left is the avatar's right arm (it faces the viewer).
      const side = arm.shoulder.x < sMidX ? 'right' : 'left';
      if (done[side]) continue;
      done[side] = true;
      const rest = side === 'left' ? 0 : Math.PI; // T-pose direction of this arm
      const ang = (a, b) => Math.atan2(-(b.y - a.y), b.x - a.x);
      const upper = ang(arm.shoulder, arm.elbow);
      const ub = this.bone(side + 'UpperArm');
      if (ub) ub.rotation.set(0, 0, wrap(upper - rest));
      const lb = this.bone(side + 'LowerArm');
      if (lb) lb.rotation.set(0, 0, arm.wrist ? wrap(ang(arm.elbow, arm.wrist) - upper) : 0);
    }
    if (!done.left) { const b = this.bone('leftUpperArm'); if (b) b.rotation.set(0, 0, -1.2); }
    if (!done.right) { const b = this.bone('rightUpperArm'); if (b) b.rotation.set(0, 0, 1.2); }
  }
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Toon-shaded 3D renderer (three.js). Uses an orthographic camera in pixel units
// so tracked screen coordinates can be used directly: world (x, -y).

import * as THREE from 'three';
import { CHARACTERS, mouthParams, mouthPolygon } from './characters.js';

const HEAD_Z = 600;
const ARM_Z = 250;

function toonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Avatar3D {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    // iPhones can drop the 3D context under memory pressure; the app then falls back to 2D.
    this.lost = false;
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
    this.camera.position.z = 2000;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.4, 0.8, 1);
    this.scene.add(sun);

    this.gradient = toonGradient();
    this.unitSphere = new THREE.SphereGeometry(1, 32, 20);
    this.unitCyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

    this.charId = null;
    this.W = 0;
    this.H = 0;
  }

  mat(color, extra = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, ...extra });
  }

  resize(W, H) {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.renderer.setSize(W, H, false);
    Object.assign(this.camera, { left: 0, right: W, top: 0, bottom: -H });
    this.camera.updateProjectionMatrix();
  }

  setCharacter(id) {
    if (id === this.charId) return;
    this.charId = id;
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o.geometry && o.geometry !== this.unitSphere && o.geometry !== this.unitCyl) o.geometry.dispose();
        if (o.material && o.material !== this.outlineMat) o.material.dispose();
      });
    }
    const ch = CHARACTERS[id];
    this.ch = ch;
    this.outlineMat.color.set(ch.outline);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.buildHead(ch);
    this.buildBody(ch);
  }

  // Adds a mesh plus an inverted-hull outline copy.
  withOutline(parent, geo, material, thickness = 0.05) {
    const mesh = new THREE.Mesh(geo, material);
    const hull = new THREE.Mesh(geo, this.outlineMat);
    hull.scale.setScalar(1 + thickness);
    mesh.add(hull);
    parent.add(mesh);
    return mesh;
  }

  sphere(parent, color, pos, scale, outline = 0) {
    const m = outline
      ? this.withOutline(parent, this.unitSphere, this.mat(color), outline)
      : new THREE.Mesh(this.unitSphere, this.mat(color));
    if (!outline) parent.add(m);
    m.position.set(...pos);
    m.scale.set(...scale);
    return m;
  }

  // ------------------------------------------------------------ head

  buildHead(ch) {
    const headRoot = new THREE.Group();
    const pivot = new THREE.Group();
    headRoot.add(pivot);
    this.root.add(headRoot);
    this.headRoot = headRoot;
    this.pivot = pivot;

    const square = ch.head === 'square';
    const faceZ = square ? 0.82 : 0.9;
    this.faceZ = faceZ;

    // Skull
    const skullGeo = square ? new THREE.BoxGeometry(1.9, 1.76, 1.6, 4, 4, 4) : this.unitSphere;
    const skullScale = ch.head === 'wide' ? [1.1, 0.92, 1] : ch.head === 'alien' ? [1, 1.05, 0.95] : [1, 1, 1];
    this.skull = this.withOutline(pivot, skullGeo, this.mat(ch.skin), square ? 0.03 : 0.04);
    this.skullScale = skullScale;
    this.skull.scale.set(...skullScale);

    // Ears
    const earMat = this.mat(ch.earColor || ch.skin);
    const innerMat = this.mat(ch.earInner || ch.skin2);
    for (const s of [-1, 1]) {
      if (ch.ear === 'cat') {
        const ear = this.withOutline(pivot, new THREE.ConeGeometry(0.34, 0.62, 24), earMat, 0.06);
        ear.position.set(s * 0.6, 0.82, -0.05);
        ear.rotation.z = -s * 0.45;
        ear.scale.z = 0.55;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 24), innerMat);
        inner.position.set(0, -0.06, 0.2);
        inner.scale.z = 0.4;
        ear.add(inner);
      } else if (ch.ear === 'round') {
        const ear = this.sphere(pivot, ch.earColor || ch.skin, [s * 0.7, 0.72, -0.15], [0.32, 0.32, 0.18], 0.08);
        ear.material = earMat;
        this.sphere(ear, ch.earInner, [0, 0, 0.6], [0.55, 0.55, 0.5]);
      } else if (ch.ear === 'bunny') {
        const ear = this.withOutline(pivot, new THREE.CapsuleGeometry(0.17, 0.85, 8, 16), earMat, 0.06);
        ear.position.set(s * 0.34, 1.35, -0.15);
        ear.rotation.z = -s * 0.14;
        ear.scale.z = 0.45;
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 8, 16), innerMat);
        inner.position.set(0, 0.03, 0.12);
        ear.add(inner);
      } else if (ch.ear === 'floppy') {
        const ear = this.sphere(pivot, ch.earColor || ch.skin, [s * 0.9, -0.05, -0.1], [0.26, 0.55, 0.18], 0.08);
        ear.rotation.z = s * 0.25;
      } else if (ch.ear === 'frog') {
        this.sphere(pivot, ch.skin, [s * 0.47, 0.62, 0.35], [0.34, 0.31, 0.31], 0.06);
      } else if (ch.ear === 'antenna') {
        const a = new THREE.Vector3(s * 0.3, 0.85, 0);
        const b = new THREE.Vector3(s * 0.62, 1.38, 0);
        const stick = new THREE.Mesh(this.unitCyl, this.mat(ch.skin));
        stick.position.copy(a.clone().add(b).multiplyScalar(0.5));
        stick.scale.set(0.04, a.distanceTo(b), 0.04);
        stick.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
        pivot.add(stick);
        this.sphere(pivot, ch.accent || ch.skin, [b.x, b.y, 0], [0.12, 0.12, 0.12], 0.08);
      } else if (ch.ear === 'bolt') {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 20), this.mat(ch.skin2));
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(s * 1.02, 0, 0);
        pivot.add(bolt);
      }
    }
    if (ch.ear === 'bolt') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12), this.mat(ch.outline));
      stick.position.set(0, 1.05, 0);
      pivot.add(stick);
      this.sphere(pivot, ch.glow, [0, 1.28, 0], [0.11, 0.11, 0.11]).material =
        new THREE.MeshBasicMaterial({ color: ch.glow });
    }

    // Muzzle
    if (ch.muzzle) {
      this.muzzle = this.sphere(pivot, ch.muzzle, [0, -0.28, 0.72], [0.48, 0.34, 0.36]);
    }

    // Eyes
    this.eyes = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const frog = ch.eyes === 'frog';
      g.position.set(s * (frog ? 0.47 : 0.36), frog ? 0.64 : -0.02, frog ? 0.62 : faceZ);
      pivot.add(g);
      if (ch.patches) {
        const p = this.sphere(g, ch.patches, [0, -0.02, -0.05], [0.22, 0.28, 0.1]);
        p.rotation.z = s * 0.5;
      }
      const open = new THREE.Group();
      g.add(open);
      let white;
      let pupil;
      if (ch.glow) {
        white = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), new THREE.MeshBasicMaterial({ color: ch.glow }));
        pupil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        pupil.position.z = 0.04;
      } else {
        white = this.sphere(open, '#ffffff', [0, 0, 0], [0.15, 0.18, 0.07]);
        pupil = this.sphere(open, '#2b2118', [0, 0, 0.05], [0.09, 0.11, 0.04]);
        const shine = new THREE.Mesh(this.unitSphere, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shine.scale.set(0.3, 0.26, 0.3);
        shine.position.set(-0.35, 0.35, 0.8);
        pupil.add(shine);
      }
      open.add(white);
      open.add(pupil);
      const closed = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.025, 8, 20, Math.PI),
        ch.glow ? new THREE.MeshBasicMaterial({ color: ch.glow }) : this.mat(ch.patches ? '#ffffff' : ch.outline),
      );
      closed.position.z = 0.06;
      g.add(closed);

      const brow = new THREE.Group();
      const browY = frog ? 0.98 : 0.3;
      brow.position.set(s * (frog ? 0.47 : 0.36), browY, frog ? 0.5 : faceZ + 0.04);
      pivot.add(brow);
      const browMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.035, 0.22, 4, 10),
        ch.glow ? new THREE.MeshBasicMaterial({ color: ch.glow }) : this.mat(ch.outline),
      );
      browMesh.rotation.z = Math.PI / 2;
      brow.add(browMesh);

      this.eyes.push({ s, group: g, open, pupil, closed, brow, browY });
    }

    // Blush
    this.blush = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 24),
        new THREE.MeshBasicMaterial({ color: 0xff7a9c, transparent: true, opacity: 0, depthWrite: false }),
      );
      b.position.set(s * 0.58, -0.2, faceZ - 0.08);
      b.rotation.y = s * 0.55;
      b.scale.y = 0.6;
      pivot.add(b);
      this.blush.push(b);
    }

    // Nose
    if (ch.nose) this.sphere(pivot, ch.nose, [0, -0.16, ch.muzzle ? 1.06 : 0.98], [0.08, 0.06, 0.05]);

    // Whiskers
    if (ch.whiskers) {
      const wm = this.mat(ch.outline);
      for (const s of [-1, 1]) {
        for (const k of [-1, 0, 1]) {
          const w = new THREE.Mesh(this.unitCyl, wm);
          w.scale.set(0.012, 0.42, 0.012);
          w.rotation.z = Math.PI / 2 + s * k * 0.18;
          w.position.set(s * 0.62, -0.25 - k * 0.07, 0.86);
          pivot.add(w);
        }
      }
    }

    // Mouth (rebuilt per frame from the expression)
    this.mouthZ = ch.muzzle ? 1.06 : square ? 0.82 : 0.93;
    this.mouthMat = ch.glow
      ? new THREE.MeshBasicMaterial({ color: '#0d2a33', side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: '#5a1f2b', side: THREE.DoubleSide });
    this.mouth = new THREE.Mesh(new THREE.BufferGeometry(), this.mouthMat);
    this.mouth.position.set(0, -0.42, this.mouthZ);
    pivot.add(this.mouth);
    this.mouthLine = new THREE.LineLoop(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: ch.glow || ch.outline }));
    this.mouth.add(this.mouthLine);
    this.mouthLine.position.z = 0.002;
  }

  updateHead(head) {
    const R = head.r;
    this.headRoot.position.set(head.x, -head.y, HEAD_Z);
    this.headRoot.scale.setScalar(R * 0.98);
    this.pivot.rotation.set(head.pitch * 0.9, head.yaw * 1.1, -head.roll, 'ZYX');
    const bs = head.bs;
    this.skull.scale.x = this.skullScale[0] * (1 + bs.cheekPuff * 0.1);

    for (const e of this.eyes) {
      const blink = e.s < 0 ? bs.blinkL : bs.blinkR;
      const wide = e.s < 0 ? bs.wideL : bs.wideR;
      const open = Math.max(0, 1 - blink);
      const closed = open < 0.28;
      e.open.visible = !closed;
      e.closed.visible = closed;
      e.open.scale.y = Math.min(1, open * 1.15) * (1 + wide * 0.35);
      e.pupil.position.x = bs.lookX * 0.06;
      e.pupil.position.y = -bs.lookY * 0.05;
      // Torus arc opens upward by default (a "u"); flip for happy "^".
      e.closed.rotation.z = bs.smile > 0.35 ? 0 : Math.PI;

      const down = e.s < 0 ? bs.browDownL : bs.browDownR;
      const outerUp = e.s < 0 ? bs.browOuterUpL : bs.browOuterUpR;
      e.brow.position.y = e.browY + (bs.browInnerUp * 0.6 + outerUp * 0.4) * 0.13 - down * 0.07;
      e.brow.rotation.z = e.s * (down * 0.45 - bs.browInnerUp * 0.3 - outerUp * 0.1);
    }

    const blush = bs.smile > 0.2 ? Math.min(0.55, (bs.smile - 0.2) * 1.2) : 0;
    this.blush.forEach((b) => { b.material.opacity = blush; });

    // Mouth: same outline as the 2D version, flipped to y-up.
    const pts = mouthPolygon(mouthParams(bs)).map(([x, y]) => new THREE.Vector2(x, -y));
    const shape = new THREE.Shape(pts);
    this.mouth.geometry.dispose();
    this.mouth.geometry = new THREE.ShapeGeometry(shape);
    this.mouthLine.geometry.dispose();
    this.mouthLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  // ------------------------------------------------------------ body

  buildBody(ch) {
    const body = new THREE.Group();
    this.root.add(body);
    this.body = body;
    const shirt = this.mat(ch.shirt);
    const arm = this.mat(ch.arm || ch.skin);
    const pants = this.mat(ch.pants);
    const hand = this.mat(ch.hand);
    const skin = this.mat(ch.skin);

    this.torso = this.withOutline(body, this.unitSphere, shirt, 0.04);
    this.neck = this.makeLimb(body, skin);
    this.limbs = {
      upperArm: [this.makeLimb(body, shirt), this.makeLimb(body, shirt)],
      foreArm: [this.makeLimb(body, arm), this.makeLimb(body, arm)],
      thigh: [this.makeLimb(body, pants), this.makeLimb(body, pants)],
      shin: [this.makeLimb(body, pants), this.makeLimb(body, pants)],
    };
    this.hands = [0, 1].map(() => this.withOutline(body, this.unitSphere, hand, 0.08));
    this.feet = [0, 1].map(() => this.withOutline(body, this.unitSphere, hand, 0.08));
  }

  makeLimb(parent, material) {
    const g = new THREE.Group();
    const tube = this.withOutline(g, this.unitCyl, material, 0);
    tube.children[0].scale.set(1.12, 1, 1.12);
    const capA = this.withOutline(g, this.unitSphere, material, 0.12);
    const capB = this.withOutline(g, this.unitSphere, material, 0.12);
    parent.add(g);
    return { g, tube, capA, capB };
  }

  placeLimb(l, a, b, r, z) {
    if (!a || !b) { l.g.visible = false; return; }
    l.g.visible = true;
    const ax = a.x; const ay = -a.y;
    const bx = b.x; const by = -b.y;
    const len = Math.hypot(bx - ax, by - ay);
    l.tube.position.set((ax + bx) / 2, (ay + by) / 2, z);
    l.tube.scale.set(r, Math.max(1, len), r);
    l.tube.rotation.set(0, 0, Math.atan2(by - ay, bx - ax) - Math.PI / 2);
    l.capA.position.set(ax, ay, z);
    l.capB.position.set(bx, by, z);
    l.capA.scale.setScalar(r);
    l.capB.scale.setScalar(r);
  }

  updateBody(layout, head) {
    if (!layout) { this.body.visible = false; return; }
    this.body.visible = true;
    const { sL, sR, sw, sMid, hMid, arms, legs } = layout;

    const tx = (sMid.x + hMid.x) / 2;
    const ty = (sMid.y + hMid.y) / 2;
    const len = Math.hypot(hMid.x - sMid.x, hMid.y - sMid.y);
    this.torso.position.set(tx, -ty, 0);
    this.torso.scale.set(sw * 0.66, len * 0.62 + sw * 0.12, sw * 0.38);
    this.torso.rotation.set(0, 0, Math.atan2(sR.y - sL.y, sR.x - sL.x) * -1);

    this.placeLimb(this.neck, sMid, head ? { x: head.x, y: head.y } : null, sw * 0.15, 150);

    for (let i = 0; i < 2; i++) {
      const a = arms[i];
      this.placeLimb(this.limbs.upperArm[i], a?.shoulder, a?.elbow, sw * 0.13, ARM_Z);
      this.placeLimb(this.limbs.foreArm[i], a?.wrist ? a.elbow : null, a?.wrist, sw * 0.105, ARM_Z + 10);
      const h = this.hands[i];
      h.visible = !!a?.hand;
      if (a?.hand) {
        h.position.set(a.hand.x, -a.hand.y, ARM_Z + 20);
        h.scale.setScalar(sw * 0.15);
      }
      const leg = legs[i];
      this.placeLimb(this.limbs.thigh[i], leg?.hip, leg?.knee, sw * 0.15, -60);
      this.placeLimb(this.limbs.shin[i], leg?.ankle ? leg.knee : null, leg?.ankle, sw * 0.13, -60);
      const f = this.feet[i];
      f.visible = !!leg?.ankle;
      if (leg?.ankle) {
        f.position.set(leg.ankle.x, -leg.ankle.y - sw * 0.04, -40);
        f.scale.set(sw * 0.17, sw * 0.1, sw * 0.14);
      }
    }
  }

  // ------------------------------------------------------------ frame

  render(head, layout, showBody) {
    this.headRoot.visible = !!head;
    if (head) this.updateHead(head);
    if (showBody) this.updateBody(layout, head);
    else this.body.visible = false;
    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }
}

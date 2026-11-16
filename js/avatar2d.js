// Flat cartoon renderer on a 2D canvas.

import { mouthParams, mouthPolygon } from './characters.js';

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

function fillStroke(ctx, fill, stroke, lw) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- head

// head: { x, y, r, roll, yaw, pitch, bs }
export function drawHead(ctx, ch, head, customImage) {
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(head.roll);
  if (customImage) {
    drawCustom(ctx, customImage, head);
  } else {
    drawCharacterHead(ctx, ch, head);
  }
  ctx.restore();
}

function drawCustom(ctx, img, head) {
  const size = head.r * 2.5;
  const aspect = img.width / img.height;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  ctx.scale(0.8 + 0.2 * Math.cos(head.yaw), 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}

function drawCharacterHead(ctx, ch, head) {
  const R = head.r;
  const bs = head.bs;
  const lw = R * 0.05;
  const sy = Math.sin(head.yaw);
  const cy = Math.cos(head.yaw);
  const fx = sy * R * 0.42; // facial features slide with head turn
  const fy = Math.sin(head.pitch) * R * 0.38;
  const puff = 1 + bs.cheekPuff * 0.12;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawEars(ctx, ch, R, -fx * 0.25, lw);

  // Skull
  if (ch.head === 'square') {
    ctx.beginPath();
    ctx.roundRect(-R * 0.95 * puff, -R * 0.88, R * 1.9 * puff, R * 1.76, R * 0.32);
  } else {
    ellipse(ctx, 0, 0, R * puff, R);
  }
  fillStroke(ctx, ch.skin, ch.outline, lw);

  // Shade on the side turning away, gives a hint of depth
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.12 * Math.abs(sy);
  ctx.fillStyle = '#000';
  ellipse(ctx, sy > 0 ? -R * 1.25 : R * 1.25, 0, R * 0.9, R * 1.2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(fx, fy);

  // Panda eye patches
  if (ch.patches) {
    for (const s of [-1, 1]) {
      ellipse(ctx, s * 0.36 * R * cy, 0.0, R * 0.22 * (1 + s * sy * 0.15), R * 0.27, s * -0.5);
      fillStroke(ctx, ch.patches);
    }
  }

  // Muzzle
  if (ch.muzzle) {
    ellipse(ctx, 0, R * 0.3, R * 0.44 * (0.85 + 0.15 * cy) * puff, R * 0.3);
    fillStroke(ctx, ch.skin2);
  }

  // Blush when smiling
  if (bs.smile > 0.2) {
    ctx.globalAlpha = Math.min(0.55, (bs.smile - 0.2) * 1.2);
    for (const s of [-1, 1]) {
      ellipse(ctx, s * R * 0.6 * cy, R * 0.18, R * 0.14, R * 0.08);
      fillStroke(ctx, '#ff7a9c');
    }
    ctx.globalAlpha = 1;
  }

  drawEyes(ctx, ch, R, bs, cy, sy);
  drawBrows(ctx, ch, R, bs, cy);

  // Nose
  if (ch.nose) {
    ctx.beginPath();
    ctx.moveTo(-R * 0.08, R * 0.12);
    ctx.quadraticCurveTo(0, R * 0.08, R * 0.08, R * 0.12);
    ctx.quadraticCurveTo(R * 0.04, R * 0.22, 0, R * 0.22);
    ctx.quadraticCurveTo(-R * 0.04, R * 0.22, -R * 0.08, R * 0.12);
    fillStroke(ctx, ch.nose);
  }

  drawMouth(ctx, ch, R, bs, cy);

  if (ch.whiskers) {
    ctx.strokeStyle = ch.outline;
    ctx.lineWidth = R * 0.022;
    for (const s of [-1, 1]) {
      for (const k of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * R * 0.32 * cy, R * (0.27 + k * 0.06));
        ctx.lineTo(s * R * 0.78 * cy, R * (0.22 + k * 0.12));
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawEars(ctx, ch, R, ox, lw) {
  const earFill = ch.earColor || ch.skin;
  ctx.save();
  ctx.translate(ox, 0);
  for (const s of [-1, 1]) {
    switch (ch.ear) {
      case 'cat': {
        ctx.beginPath();
        ctx.moveTo(s * R * 0.25, -R * 0.9);
        ctx.lineTo(s * R * 0.78, -R * 1.25);
        ctx.lineTo(s * R * 0.92, -R * 0.4);
        ctx.closePath();
        fillStroke(ctx, earFill, ch.outline, lw);
        ctx.beginPath();
        ctx.moveTo(s * R * 0.4, -R * 0.82);
        ctx.lineTo(s * R * 0.74, -R * 1.07);
        ctx.lineTo(s * R * 0.8, -R * 0.55);
        ctx.closePath();
        fillStroke(ctx, ch.earInner);
        break;
      }
      case 'round': {
        ellipse(ctx, s * R * 0.7, -R * 0.7, R * 0.32, R * 0.32);
        fillStroke(ctx, earFill, ch.outline, lw);
        ellipse(ctx, s * R * 0.7, -R * 0.7, R * 0.17, R * 0.17);
        fillStroke(ctx, ch.earInner);
        break;
      }
      case 'bunny': {
        ellipse(ctx, s * R * 0.36, -R * 1.3, R * 0.22, R * 0.7, s * 0.14);
        fillStroke(ctx, earFill, ch.outline, lw);
        ellipse(ctx, s * R * 0.36, -R * 1.25, R * 0.1, R * 0.5, s * 0.14);
        fillStroke(ctx, ch.earInner);
        break;
      }
      case 'bolt': {
        ctx.beginPath();
        ctx.roundRect(s > 0 ? R * 0.9 : -R * 1.12, -R * 0.25, R * 0.22, R * 0.5, R * 0.06);
        fillStroke(ctx, ch.skin2, ch.outline, lw);
        break;
      }
    }
  }
  if (ch.ear === 'bolt') {
    ctx.strokeStyle = ch.outline;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.88);
    ctx.lineTo(0, -R * 1.22);
    ctx.stroke();
    ellipse(ctx, 0, -R * 1.28, R * 0.1, R * 0.1);
    fillStroke(ctx, ch.glow, ch.outline, lw);
  }
  ctx.restore();
}

function drawEyes(ctx, ch, R, bs, cy, sy) {
  for (const s of [-1, 1]) {
    const blink = s < 0 ? bs.blinkL : bs.blinkR;
    const wide = s < 0 ? bs.wideL : bs.wideR;
    const open = Math.max(0, 1 - blink);
    const ex = s * R * 0.36 * cy;
    const ey = -R * 0.04;
    const persp = 1 + s * sy * 0.15; // near eye a bit larger
    const rx = R * 0.14 * persp * (ch.glow ? 1.1 : 1);
    const ry = R * 0.17 * (1 + wide * 0.35) * persp;

    if (open < 0.28) {
      // Closed eye: arc. Happy closed eyes curve up (^ ^).
      ctx.beginPath();
      const bend = bs.smile > 0.35 ? -1 : 1;
      ctx.moveTo(ex - rx, ey);
      ctx.quadraticCurveTo(ex, ey + bend * ry * 0.7, ex + rx, ey);
      ctx.strokeStyle = ch.glow || (ch.patches ? '#fff' : ch.outline);
      ctx.lineWidth = R * 0.05;
      ctx.stroke();
      continue;
    }

    const h = ry * Math.min(1, open * 1.15);
    if (ch.glow) {
      ctx.save();
      ctx.shadowColor = ch.glow;
      ctx.shadowBlur = R * 0.15;
      ctx.beginPath();
      ctx.roundRect(ex - rx, ey - h, rx * 2, h * 2, Math.min(rx, h) * 0.5);
      fillStroke(ctx, ch.glow);
      ctx.restore();
      ellipse(ctx, ex + bs.lookX * rx * 0.45, ey + bs.lookY * h * 0.35, rx * 0.35, Math.min(h, rx) * 0.35);
      fillStroke(ctx, '#ffffff');
      continue;
    }

    ellipse(ctx, ex, ey, rx, h);
    fillStroke(ctx, '#ffffff', ch.outline, R * 0.03);
    ctx.save();
    ellipse(ctx, ex, ey, rx, h);
    ctx.clip();
    const px = ex + bs.lookX * rx * 0.5;
    const py = ey + bs.lookY * ry * 0.35;
    ellipse(ctx, px, py, rx * 0.62, ry * 0.68);
    fillStroke(ctx, '#2b2118');
    ellipse(ctx, px - rx * 0.22, py - ry * 0.28, rx * 0.2, rx * 0.2);
    fillStroke(ctx, '#ffffff');
    ctx.restore();
  }
}

function drawBrows(ctx, ch, R, bs, cy) {
  ctx.strokeStyle = ch.glow || ch.outline;
  ctx.lineWidth = R * 0.065;
  for (const s of [-1, 1]) {
    const down = s < 0 ? bs.browDownL : bs.browDownR;
    const outerUp = s < 0 ? bs.browOuterUpL : bs.browOuterUpR;
    const x = s * R * 0.36 * cy;
    const y = -R * 0.3 - (bs.browInnerUp * 0.6 + outerUp * 0.4) * R * 0.13 + down * R * 0.07;
    // Angry: inner end drops. Sad/worried: inner end rises.
    const angle = -s * (down * 0.45 - bs.browInnerUp * 0.3 - outerUp * 0.1);
    const half = R * 0.13 * cy + R * 0.02;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.quadraticCurveTo(0, -R * 0.04, half, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMouth(ctx, ch, R, bs, cy) {
  const m = mouthParams(bs);
  const pts = mouthPolygon(m);
  ctx.save();
  ctx.translate(0, R * 0.38);
  ctx.scale(R * (0.7 + 0.3 * cy), R);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = ch.glow ? '#0d2a33' : '#5a1f2b';
  ctx.fill();

  if (m.open > 0.05) {
    ctx.save();
    ctx.clip();
    if (ch.glow) {
      ctx.fillStyle = ch.glow;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-m.w, -1, m.w * 2, 2);
    } else {
      ellipse(ctx, 0, (m.corner + m.upper) * 0.5 + m.open * 0.9, m.w * 0.6, m.open * 0.45);
      ctx.fillStyle = '#ef6f86';
      ctx.fill();
      if (ch.teeth) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-0.05, m.upper * 0.5 + m.corner * 0.5 - 0.02, 0.1, 0.07);
      }
    }
    ctx.restore();
  }
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = ch.glow || ch.outline;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- body

const vis = (p, th = 0.45) => p && p.v > th;

function limb(ctx, a, b, w, color, outline, ow) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + ow * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

// Derive the body layout once, shared by 2D and 3D renderers.
export function bodyLayout(j, H) {
  if (!j || !vis(j.shoulderL) || !vis(j.shoulderR)) return null;
  const sL = j.shoulderL;
  const sR = j.shoulderR;
  const sw = Math.max(20, Math.hypot(sR.x - sL.x, sR.y - sL.y));
  const sMid = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };
  const hipsOk = vis(j.hipL, 0.35) && vis(j.hipR, 0.35);
  let hMid;
  if (hipsOk) {
    hMid = { x: (j.hipL.x + j.hipR.x) / 2, y: (j.hipL.y + j.hipR.y) / 2 };
  } else {
    // Hips out of frame: extend the torso down perpendicular to the shoulders.
    const ang = Math.atan2(sR.y - sL.y, sR.x - sL.x);
    const len = Math.max(sw * 1.5, H - sMid.y + sw * 0.4);
    hMid = { x: sMid.x - Math.sin(ang) * len, y: sMid.y + Math.cos(ang) * len };
  }
  const arms = [];
  for (const side of ['L', 'R']) {
    const s = j['shoulder' + side];
    const e = j['elbow' + side];
    const w = j['wrist' + side];
    const idx = j['index' + side];
    if (!vis(e, 0.35)) continue;
    const arm = { shoulder: s, elbow: e, wrist: vis(w, 0.35) ? w : null };
    if (arm.wrist) {
      const dx = (vis(idx, 0.3) ? idx.x : w.x + (w.x - e.x) * 0.2) - w.x;
      const dy = (vis(idx, 0.3) ? idx.y : w.y + (w.y - e.y) * 0.2) - w.y;
      arm.hand = { x: w.x + dx * 0.5, y: w.y + dy * 0.5 };
    }
    arms.push(arm);
  }
  const legs = [];
  if (hipsOk) {
    for (const side of ['L', 'R']) {
      const hip = j['hip' + side];
      const knee = j['knee' + side];
      const ankle = j['ankle' + side];
      if (!vis(knee, 0.5)) continue;
      legs.push({ hip, knee, ankle: vis(ankle, 0.5) ? ankle : null });
    }
  }
  return { sL, sR, sw, sMid, hMid, hipsOk, arms, legs };
}

export function drawBody(ctx, ch, layout, head) {
  const { sL, sR, sw, sMid, hMid, arms, legs } = layout;
  const ow = Math.max(2, sw * 0.025);
  const arm = ch.arm || ch.skin;

  for (const leg of legs) {
    limb(ctx, leg.hip, leg.knee, sw * 0.3, ch.pants, ch.outline, ow);
    if (leg.ankle) {
      limb(ctx, leg.knee, leg.ankle, sw * 0.26, ch.pants, ch.outline, ow);
      ellipse(ctx, leg.ankle.x, leg.ankle.y + sw * 0.04, sw * 0.17, sw * 0.1);
      fillStroke(ctx, ch.hand, ch.outline, ow);
    }
  }

  // Neck
  if (head) limb(ctx, sMid, { x: head.x, y: head.y }, sw * 0.3, ch.skin, ch.outline, ow);

  // Torso: rounded trapezoid from shoulders to hips
  const ang = Math.atan2(sR.y - sL.y, sR.x - sL.x);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const hw = sw * 0.42;
  const sx = sw * 0.58;
  ctx.beginPath();
  ctx.moveTo(sMid.x - ux * sx, sMid.y - uy * sx);
  ctx.lineTo(sMid.x + ux * sx, sMid.y + uy * sx);
  ctx.lineTo(hMid.x + ux * hw, hMid.y + uy * hw);
  ctx.lineTo(hMid.x - ux * hw, hMid.y - uy * hw);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ch.outline;
  ctx.lineWidth = sw * 0.22 + ow * 2;
  ctx.stroke();
  ctx.strokeStyle = ch.shirt;
  ctx.lineWidth = sw * 0.22;
  ctx.stroke();
  ctx.fillStyle = ch.shirt;
  ctx.fill();

  for (const a of arms) {
    limb(ctx, a.shoulder, a.elbow, sw * 0.27, ch.shirt, ch.outline, ow);
    if (a.wrist) {
      limb(ctx, a.elbow, a.wrist, sw * 0.21, arm, ch.outline, ow);
      ellipse(ctx, a.hand.x, a.hand.y, sw * 0.15, sw * 0.15);
      fillStroke(ctx, ch.hand, ch.outline, ow);
    }
  }
}

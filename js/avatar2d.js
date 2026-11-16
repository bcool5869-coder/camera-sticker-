// Flat cartoon renderer on a 2D canvas.

import { drawCharacterHead } from './head2d.js';

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

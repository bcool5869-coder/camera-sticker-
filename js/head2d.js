// Sticker-style 2D character heads: white die-cut border, soft shading,
// glossy eyes, and every feature driven by the tracked expression.

import { mouthParams, mouthPolygon } from './characters.js';

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

function paint(ctx, fill, stroke, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  const r = f(n >> 16); const g = f((n >> 8) & 255); const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------- shapes

function skullPath(ctx, ch, R, puff) {
  if (ch.head === 'square') {
    ctx.beginPath();
    ctx.roundRect(-R * 0.95 * puff, -R * 0.9, R * 1.9 * puff, R * 1.8, R * 0.38);
  } else if (ch.head === 'wide') {
    ellipse(ctx, 0, R * 0.05, R * 1.08 * puff, R * 0.92);
  } else if (ch.head === 'alien') {
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.02);
    ctx.bezierCurveTo(R * 1.15 * puff, -R * 1.0, R * 1.05 * puff, R * 0.35, 0, R * 0.98);
    ctx.bezierCurveTo(-R * 1.05 * puff, R * 0.35, -R * 1.15 * puff, -R * 1.0, 0, -R * 1.02);
  } else {
    ellipse(ctx, 0, 0, R * puff, R);
  }
}

// Ears and other parts that stick out of the head. `layer` is 'outer' or 'inner'.
function earShapes(ctx, ch, R, s, layer) {
  switch (ch.ear) {
    case 'cat':
      ctx.beginPath();
      if (layer === 'outer') {
        ctx.moveTo(s * R * 0.2, -R * 0.88);
        ctx.quadraticCurveTo(s * R * 0.62, -R * 1.42, s * R * 0.86, -R * 1.18);
        ctx.quadraticCurveTo(s * R * 1.0, -R * 0.75, s * R * 0.92, -R * 0.38);
      } else {
        ctx.moveTo(s * R * 0.36, -R * 0.84);
        ctx.quadraticCurveTo(s * R * 0.64, -R * 1.22, s * R * 0.79, -R * 1.05);
        ctx.quadraticCurveTo(s * R * 0.86, -R * 0.78, s * R * 0.82, -R * 0.52);
      }
      ctx.closePath();
      return true;
    case 'round':
      ellipse(ctx, s * R * 0.72, -R * 0.72, R * (layer === 'outer' ? 0.34 : 0.19), R * (layer === 'outer' ? 0.34 : 0.19));
      return true;
    case 'bunny':
      if (layer === 'outer') ellipse(ctx, s * R * 0.38, -R * 1.32, R * 0.24, R * 0.72, s * 0.16);
      else ellipse(ctx, s * R * 0.39, -R * 1.27, R * 0.11, R * 0.52, s * 0.16);
      return true;
    case 'floppy':
      if (layer !== 'outer') return false;
      ctx.beginPath();
      ctx.moveTo(s * R * 0.45, -R * 0.85);
      ctx.bezierCurveTo(s * R * 1.25, -R * 0.95, s * R * 1.35, R * 0.1, s * R * 1.05, R * 0.45);
      ctx.bezierCurveTo(s * R * 0.85, R * 0.65, s * R * 0.7, R * 0.2, s * R * 0.78, -R * 0.35);
      ctx.closePath();
      return true;
    case 'bolt':
      if (layer !== 'outer') return false;
      ctx.beginPath();
      ctx.roundRect(s > 0 ? R * 0.9 : -R * 1.14, -R * 0.3, R * 0.24, R * 0.6, R * 0.08);
      return true;
    case 'frog':
      ellipse(ctx, s * R * 0.47, -R * 0.68, R * (layer === 'outer' ? 0.34 : 0), R * (layer === 'outer' ? 0.32 : 0));
      return layer === 'outer';
    default:
      return false;
  }
}

// Antenna-like parts on top (robot, alien).
function topShapes(ctx, ch, R, paintFn) {
  if (ch.ear === 'bolt') {
    ctx.beginPath();
    ctx.roundRect(-R * 0.05, -R * 1.25, R * 0.1, R * 0.4, R * 0.04);
    paintFn('stick');
    ellipse(ctx, 0, -R * 1.3, R * 0.13, R * 0.13);
    paintFn('tip');
  } else if (ch.ear === 'antenna') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.3, -R * 0.85);
      ctx.quadraticCurveTo(s * R * 0.45, -R * 1.25, s * R * 0.62, -R * 1.38);
      ctx.lineWidth = R * 0.07;
      paintFn('line');
      ellipse(ctx, s * R * 0.64, -R * 1.42, R * 0.12, R * 0.12);
      paintFn('tip');
    }
  }
}

// Fluffy cheek tufts that poke out past the head outline.
function tuftShape(ctx, R, s) {
  ctx.beginPath();
  ctx.moveTo(s * R * 0.86, -R * 0.05);
  ctx.lineTo(s * R * 1.16, R * 0.16);
  ctx.lineTo(s * R * 0.98, R * 0.24);
  ctx.lineTo(s * R * 1.12, R * 0.42);
  ctx.lineTo(s * R * 0.9, R * 0.46);
  ctx.lineTo(s * R * 0.94, R * 0.62);
  ctx.lineTo(s * R * 0.6, R * 0.62);
  ctx.closePath();
}

// Small decorations; `border` draws the white sticker edge behind them.
function drawAccessory(ctx, ch, R, border) {
  const lw = R * 0.04;
  const pf = (fill) => (border ? paint(ctx, '#ffffff', '#ffffff', R * 0.14) : paint(ctx, fill, ch.outline, lw));
  ctx.save();
  if (ch.accessory === 'bow') {
    ctx.translate(R * 0.5, -R * 0.84);
    ctx.rotate(0.35);
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(k * R * 0.32, -R * 0.3, k * R * 0.34, 0);
      ctx.quadraticCurveTo(k * R * 0.32, R * 0.3, 0, 0);
      pf('#ff5d8f');
    }
    ellipse(ctx, 0, 0, R * 0.09, R * 0.09);
    pf('#ff86ab');
  } else if (ch.accessory === 'flower') {
    ctx.translate(-R * 0.55, -R * 0.78);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipse(ctx, Math.cos(a) * R * 0.13, Math.sin(a) * R * 0.13, R * 0.11, R * 0.11);
      pf('#ffb3cf');
    }
    ellipse(ctx, 0, 0, R * 0.09, R * 0.09);
    pf('#ffd23f');
  } else if (ch.accessory === 'crown') {
    ctx.translate(0, -R * 0.86);
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, R * 0.06);
    ctx.lineTo(-R * 0.32, -R * 0.22);
    ctx.lineTo(-R * 0.16, -R * 0.08);
    ctx.lineTo(0, -R * 0.3);
    ctx.lineTo(R * 0.16, -R * 0.08);
    ctx.lineTo(R * 0.32, -R * 0.22);
    ctx.lineTo(R * 0.3, R * 0.06);
    ctx.closePath();
    pf('#ffc93c');
    if (!border) {
      for (const [x, c] of [[-R * 0.15, '#ff5d73'], [0, '#3fb8ff'], [R * 0.15, '#ff5d73']]) {
        ellipse(ctx, x, -R * 0.02, R * 0.04, R * 0.04);
        paint(ctx, c);
      }
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- head

export function drawCharacterHead(ctx, ch, head) {
  const R = head.r;
  const bs = head.bs;
  const lw = R * 0.045;
  const sy = Math.sin(head.yaw);
  const cy = Math.cos(head.yaw);
  const fx = sy * R * 0.4;
  const fy = Math.sin(head.pitch) * R * 0.36;
  const puff = 1 + bs.cheekPuff * 0.12;
  const earOx = -fx * 0.25;
  const outline = ch.outline;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. White die-cut sticker border with a soft drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = R * 0.12;
  ctx.shadowOffsetY = R * 0.05;
  const white = () => paint(ctx, '#ffffff', '#ffffff', R * 0.2);
  ctx.save(); ctx.translate(earOx, 0);
  for (const s of [-1, 1]) if (earShapes(ctx, ch, R, s, 'outer')) white();
  if (ch.fluff) for (const s of [-1, 1]) { tuftShape(ctx, R, s); white(); }
  topShapes(ctx, ch, R, (k) => (k === 'line' ? paint(ctx, null, '#ffffff', R * 0.25) : white()));
  ctx.restore();
  skullPath(ctx, ch, R, puff);
  white();
  ctx.restore();

  // 2. Ears and antennas.
  ctx.save(); ctx.translate(earOx, 0);
  const earFill = ch.earColor || ch.skin;
  for (const s of [-1, 1]) {
    if (earShapes(ctx, ch, R, s, 'outer')) paint(ctx, earFill, outline, lw);
    if (ch.ear !== 'frog' && earShapes(ctx, ch, R, s, 'inner')) paint(ctx, ch.earInner);
  }
  topShapes(ctx, ch, R, (k) => {
    if (k === 'line') paint(ctx, null, outline, R * 0.07);
    else if (k === 'stick') paint(ctx, outline);
    else paint(ctx, ch.glow || ch.accent || ch.skin, outline, lw);
  });
  ctx.restore();

  if (ch.fluff) for (const s of [-1, 1]) { tuftShape(ctx, R, s); paint(ctx, shade(ch.skin, -0.05), outline, lw); }

  // 3. Skull with soft light from the top-left.
  skullPath(ctx, ch, R, puff);
  const grad = ctx.createRadialGradient(-R * 0.35, -R * 0.5, R * 0.05, 0, 0, R * 1.2);
  grad.addColorStop(0, shade(ch.skin, 0.35));
  grad.addColorStop(0.55, ch.skin);
  grad.addColorStop(1, shade(ch.skin, -0.18));
  paint(ctx, grad, outline, lw);

  // Markings clipped to the skull.
  ctx.save();
  skullPath(ctx, ch, R, puff);
  ctx.clip();
  if (ch.stripes) {
    ctx.fillStyle = ch.stripes;
    for (const s of [-1, 1]) {
      for (const k of [0, 1, 2]) {
        ctx.beginPath();
        const y = -R * 0.35 + k * R * 0.22;
        ctx.moveTo(s * R * 1.05, y - R * 0.06);
        ctx.quadraticCurveTo(s * R * 0.8, y + R * 0.02, s * R * (0.62 + k * 0.04), y + R * 0.05);
        ctx.quadraticCurveTo(s * R * 0.8, y + R * 0.1, s * R * 1.05, y + R * 0.08);
        ctx.fill();
      }
    }
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * R * 0.14 - R * 0.05, -R * 1.0);
      ctx.lineTo(k * R * 0.1, -R * (0.62 - Math.abs(k) * 0.1));
      ctx.lineTo(k * R * 0.14 + R * 0.05, -R * 1.0);
      ctx.fill();
    }
  }
  if (ch.spot) {
    ellipse(ctx, fx + R * 0.38 * cy, -R * 0.12 + fy, R * 0.3, R * 0.28, 0.4);
    paint(ctx, ch.spot);
  }
  if (ch.spots) {
    for (const [x, y, r] of [[-0.55, -0.55, 0.1], [-0.72, -0.25, 0.06], [0.6, -0.6, 0.08], [0.4, -0.8, 0.05]]) {
      ellipse(ctx, x * R, y * R, r * R, r * R);
      paint(ctx, ch.spots);
    }
  }
  if (ch.rivets) {
    for (const [x, y] of [[-0.78, -0.72], [0.78, -0.72], [-0.78, 0.72], [0.78, 0.72]]) {
      ellipse(ctx, x * R, y * R, R * 0.05, R * 0.05);
      paint(ctx, shade(ch.skin, -0.25), ch.outline, R * 0.02);
    }
  }
  // Glossy vinyl shine.
  ctx.globalAlpha = 0.4;
  ellipse(ctx, -R * 0.45, -R * 0.58, R * 0.26, R * 0.11, -0.6);
  paint(ctx, '#ffffff');
  ctx.globalAlpha = 1;
  // Rim shade on the side turning away.
  ctx.globalAlpha = 0.14 * Math.abs(sy);
  ellipse(ctx, sy > 0 ? -R * 1.3 : R * 1.3, 0, R * 0.95, R * 1.3);
  paint(ctx, '#000');
  ctx.globalAlpha = 1;
  ctx.restore();

  // 4. Face (slides with head turn and nod).
  ctx.save();
  ctx.translate(fx, fy);
  const eyes = eyeLayout(ch, R, cy, sy);

  if (ch.patches) {
    for (const e of eyes) {
      ellipse(ctx, e.x, e.y + R * 0.03, e.rx * 1.6, e.ry * 1.45, e.s * -0.5);
      paint(ctx, ch.patches);
    }
  }
  if (ch.cheeks) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, R * 0.2);
      ctx.quadraticCurveTo(s * R * 0.55, -R * 0.05, s * R * 1.0 * cy, R * 0.12);
      ctx.quadraticCurveTo(s * R * 0.75, R * 0.75, 0, R * 0.72);
      ctx.closePath();
      paint(ctx, ch.cheeks);
    }
  }
  if (ch.muzzle && ch.lobes) {
    for (const s of [-1, 1]) {
      ellipse(ctx, s * R * 0.15 * cy, R * 0.33, R * 0.21 * puff, R * 0.16);
      paint(ctx, ch.muzzle);
    }
    ellipse(ctx, 0, R * 0.44, R * 0.12, R * 0.09);
    paint(ctx, ch.muzzle);
  } else if (ch.muzzle) {
    ellipse(ctx, 0, R * 0.32, R * 0.46 * (0.85 + 0.15 * cy) * puff, R * 0.3);
    paint(ctx, ch.muzzle);
  }

  // Blush: a little always, more when smiling.
  const blush = Math.min(0.75, 0.28 + bs.smile * 0.6);
  ctx.globalAlpha = blush;
  for (const s of [-1, 1]) {
    ellipse(ctx, s * R * 0.62 * cy, R * 0.2, R * 0.15, R * 0.09);
    paint(ctx, ch.blush || '#ff7a9c');
  }
  ctx.globalAlpha = 1;

  for (const e of eyes) drawEye(ctx, ch, R, bs, e);
  drawBrows(ctx, ch, R, bs, eyes);
  drawNose(ctx, ch, R);
  drawMouth(ctx, ch, R, bs, cy);

  if (ch.whiskers) {
    ctx.strokeStyle = shade(outline, 0.2);
    ctx.lineWidth = R * 0.02;
    for (const s of [-1, 1]) {
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * R * 0.4 * cy, R * (0.3 + k * 0.04));
        ctx.quadraticCurveTo(s * R * 0.65 * cy, R * (0.26 + k * 0.08), s * R * 0.9 * cy, R * (0.24 + k * 0.13));
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  if (ch.accessory) {
    ctx.save();
    ctx.translate(earOx, 0);
    drawAccessory(ctx, ch, R, true);
    drawAccessory(ctx, ch, R, false);
    ctx.restore();
  }
}

function eyeLayout(ch, R, cy, sy) {
  return [-1, 1].map((s) => {
    const persp = 1 + s * sy * 0.15;
    if (ch.eyes === 'frog') return { s, x: s * R * 0.47 * cy, y: -R * 0.66, rx: R * 0.19 * persp, ry: R * 0.2 * persp };
    if (ch.eyes === 'alien') return { s, x: s * R * 0.4 * cy, y: -R * 0.08, rx: R * 0.22 * persp, ry: R * 0.3 * persp, rot: s * -0.45 };
    return { s, x: s * R * 0.37 * cy, y: -R * 0.02, rx: R * 0.19 * persp, ry: R * 0.22 * persp };
  });
}

function drawEye(ctx, ch, R, bs, e) {
  const blink = e.s < 0 ? bs.blinkL : bs.blinkR;
  const wide = e.s < 0 ? bs.wideL : bs.wideR;
  const open = Math.max(0, 1 - blink);
  const rx = e.rx;
  const ry = e.ry * (1 + wide * 0.3);
  const h = ry * Math.min(1, open * 1.15);
  const lineCol = ch.glow || (ch.patches ? '#ffffff' : ch.outline);

  if (open < 0.28) {
    // Closed: ^ when happy, otherwise a relaxed curve with lashes.
    const happy = bs.smile > 0.35;
    ctx.beginPath();
    ctx.moveTo(e.x - rx, e.y);
    ctx.quadraticCurveTo(e.x, e.y + (happy ? -1 : 1) * ry * 0.75, e.x + rx, e.y);
    paint(ctx, null, lineCol, R * 0.055);
    if (!happy && !ch.glow) {
      for (const k of [-0.6, 0, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(e.x + k * rx, e.y + ry * 0.3);
        ctx.lineTo(e.x + k * rx * 1.2, e.y + ry * 0.55);
        paint(ctx, null, lineCol, R * 0.03);
      }
    }
    return;
  }

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot || 0);
  const lx = bs.lookX * rx * 0.42;
  const ly = bs.lookY * h * 0.3;

  if (ch.glow) {
    ctx.shadowColor = ch.glow;
    ctx.shadowBlur = R * 0.2;
    ctx.beginPath();
    ctx.roundRect(-rx, -h, rx * 2, h * 2, Math.min(rx, h) * 0.6);
    paint(ctx, ch.glow);
    ctx.shadowBlur = 0;
    ellipse(ctx, lx, ly, rx * 0.4, Math.min(h, rx) * 0.4);
    paint(ctx, '#ffffff');
    ctx.restore();
    return;
  }

  if (ch.eyes === 'alien') {
    ellipse(ctx, 0, 0, rx, h);
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, '#2a2240'); g.addColorStop(1, '#07060c');
    paint(ctx, g, ch.outline, R * 0.03);
    ctx.save(); ellipse(ctx, 0, 0, rx, h); ctx.clip();
    ellipse(ctx, lx - rx * 0.3, ly - h * 0.35, rx * 0.32, h * 0.22, -0.4);
    paint(ctx, 'rgba(255,255,255,0.9)');
    ellipse(ctx, lx + rx * 0.35, ly + h * 0.35, rx * 0.12, rx * 0.12);
    paint(ctx, 'rgba(255,255,255,0.7)');
    ctx.restore();
    ctx.restore();
    return;
  }

  // Glossy cartoon eye: white, coloured iris, pupil, two highlights.
  ellipse(ctx, 0, 0, rx, h);
  paint(ctx, '#ffffff', ch.outline, R * 0.032);
  ctx.save();
  ellipse(ctx, 0, 0, rx, h);
  ctx.clip();
  const ir = rx * 0.78;
  const irH = ry * 0.82;
  const ig = ctx.createRadialGradient(lx, ly + irH * 0.3, ir * 0.1, lx, ly, irH);
  ig.addColorStop(0, shade(ch.iris || '#5b3a1e', 0.35));
  ig.addColorStop(1, ch.iris || '#5b3a1e');
  ellipse(ctx, lx, ly, ir, irH);
  paint(ctx, ig);
  ellipse(ctx, lx, ly, ir * 0.55, irH * 0.58);
  paint(ctx, '#120b08');
  ellipse(ctx, lx - ir * 0.35, ly - irH * 0.4, ir * 0.3, ir * 0.3);
  paint(ctx, '#ffffff');
  ellipse(ctx, lx + ir * 0.35, ly + irH * 0.35, ir * 0.13, ir * 0.13);
  paint(ctx, 'rgba(255,255,255,0.85)');
  // Upper lid shadow
  ellipse(ctx, 0, -h * 1.05, rx * 1.2, h * 0.45);
  paint(ctx, 'rgba(0,0,0,0.12)');
  ctx.restore();
  // Bold upper lid line, plus lashes for some characters.
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, h, 0, Math.PI * 1.05, Math.PI * 1.95);
  paint(ctx, null, ch.outline, R * 0.055);
  if (ch.lashes) {
    for (const k of [0, 1]) {
      const a = Math.PI * (e.s > 0 ? 1.9 - k * 0.12 : 1.1 + k * 0.12);
      const px = Math.cos(a) * rx; const py = Math.sin(a) * h;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + e.s * R * 0.08, py - R * 0.05 - k * R * 0.02);
      paint(ctx, null, ch.outline, R * 0.035);
    }
  }
  ctx.restore();
}

function drawBrows(ctx, ch, R, bs, eyes) {
  ctx.strokeStyle = ch.glow || ch.brow || shade(ch.outline, 0.1);
  ctx.lineWidth = R * 0.06;
  for (const e of eyes) {
    const down = e.s < 0 ? bs.browDownL : bs.browDownR;
    const outerUp = e.s < 0 ? bs.browOuterUpL : bs.browOuterUpR;
    const y = e.y - e.ry - R * 0.12 - (bs.browInnerUp * 0.6 + outerUp * 0.4) * R * 0.13 + down * R * 0.08;
    const angle = -e.s * (down * 0.5 - bs.browInnerUp * 0.32 - outerUp * 0.1);
    const half = e.rx * 0.85;
    ctx.save();
    ctx.translate(e.x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-half, R * 0.01);
    ctx.quadraticCurveTo(0, -R * 0.045, half, R * 0.01);
    ctx.stroke();
    ctx.restore();
  }
}

function drawNose(ctx, ch, R) {
  if (ch.nostrils) {
    for (const s of [-1, 1]) { ellipse(ctx, s * R * 0.07, R * 0.12, R * 0.025, R * 0.018); paint(ctx, ch.outline); }
    return;
  }
  if (!ch.nose) return;
  const k = ch.bigNose ? 1.6 : 1;
  ctx.beginPath();
  ctx.moveTo(-R * 0.09 * k, R * 0.12);
  ctx.quadraticCurveTo(0, R * (0.12 - 0.06 * k), R * 0.09 * k, R * 0.12);
  ctx.quadraticCurveTo(R * 0.05 * k, R * (0.12 + 0.1 * k), 0, R * (0.12 + 0.1 * k));
  ctx.quadraticCurveTo(-R * 0.05 * k, R * (0.12 + 0.1 * k), -R * 0.09 * k, R * 0.12);
  paint(ctx, ch.nose, shade(ch.nose, -0.3), R * 0.015);
  ellipse(ctx, -R * 0.025 * k, R * (0.12 - 0.005 * k), R * 0.03 * k, R * 0.015 * k);
  paint(ctx, 'rgba(255,255,255,0.7)');
}

function drawMouth(ctx, ch, R, bs, cy) {
  const m = mouthParams(bs);
  const wide = ch.wideMouth ? 1.5 : 1;
  const pts = mouthPolygon(m);
  const my = R * (ch.mouthY ?? 0.4);
  if (ch.catMouth && m.open < 0.05 && bs.smile < 0.5) {
    // Cute ":3" mouth when closed.
    ctx.save();
    ctx.translate(0, my);
    ctx.scale(R * (0.7 + 0.3 * cy), R);
    const c = m.corner - bs.smile * 0.03;
    ctx.beginPath();
    ctx.moveTo(0, -0.16);
    ctx.lineTo(0, -0.02);
    ctx.moveTo(-0.17, c);
    ctx.quadraticCurveTo(-0.085, 0.1, 0, -0.02);
    ctx.quadraticCurveTo(0.085, 0.1, 0.17, c);
    ctx.lineWidth = 0.035;
    ctx.strokeStyle = ch.outline;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(0, my);
  ctx.scale(R * (0.7 + 0.3 * cy) * wide, R);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  paint(ctx, ch.glow ? '#0d2a33' : '#6e1d2c');

  if (m.open > 0.04) {
    ctx.save();
    ctx.clip();
    if (ch.glow) {
      ctx.fillStyle = ch.glow;
      ctx.globalAlpha = 0.7;
      for (let i = -3; i <= 3; i++) ctx.fillRect(i * m.w * 0.25 - 0.012, -1, 0.024, 2);
    } else {
      ellipse(ctx, 0, (m.corner + m.upper) * 0.5 + m.open * 0.95, m.w * 0.62, m.open * 0.5);
      paint(ctx, '#ff7f96');
      if (ch.teeth) {
        ctx.fillStyle = '#ffffff';
        const ty = (m.upper + m.corner) * 0.5 - 0.02;
        ctx.fillRect(-0.06, ty, 0.055, 0.08);
        ctx.fillRect(0.005, ty, 0.055, 0.08);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(-m.w * 0.55, (m.upper + m.corner) * 0.5 - 0.03, m.w * 1.1, 0.045);
      }
    }
    ctx.restore();
  }
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = ch.glow || ch.outline;
  ctx.stroke();
  if (ch.tongue && bs.smile > 0.3) {
    // Happy puppy tongue hanging out.
    const ty = (m.corner + m.lower) * 0.5;
    ctx.beginPath();
    ctx.moveTo(-0.07, ty - 0.02);
    ctx.lineTo(-0.07, ty + 0.06);
    ctx.quadraticCurveTo(-0.07, ty + 0.15, 0, ty + 0.15);
    ctx.quadraticCurveTo(0.07, ty + 0.15, 0.07, ty + 0.06);
    ctx.lineTo(0.07, ty - 0.02);
    paint(ctx, '#ff7f96', ch.outline, 0.03);
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(0, ty + 0.08);
    paint(ctx, null, '#d9506b', 0.02);
  }
  ctx.restore();
}

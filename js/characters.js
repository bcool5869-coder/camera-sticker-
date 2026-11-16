// Character definitions shared by the 2D and 3D renderers, plus the
// expression helpers (mouth shape, emotion) both of them use.

export const CHARACTERS = {
  cat: {
    name: 'Cat', emoji: '🐱',
    skin: '#f4a640', skin2: '#fde6c2', outline: '#4a2c12',
    ear: 'cat', earInner: '#f7b5c4', nose: '#e76f8a',
    muzzle: true, whiskers: true,
    shirt: '#4f7cff', pants: '#2c3e66', hand: '#fde6c2',
  },
  bear: {
    name: 'Bear', emoji: '🐻',
    skin: '#9b6a43', skin2: '#e0bf9a', outline: '#3b2412',
    ear: 'round', earInner: '#e0bf9a', nose: '#3b2412',
    muzzle: true,
    shirt: '#e85d75', pants: '#5b3a8c', hand: '#e0bf9a',
  },
  panda: {
    name: 'Panda', emoji: '🐼',
    skin: '#ffffff', skin2: '#ffffff', outline: '#1d1d1f',
    ear: 'round', earColor: '#1d1d1f', earInner: '#3a3a3c', nose: '#1d1d1f',
    patches: '#1d1d1f', muzzle: true,
    shirt: '#43b97f', pants: '#1d1d1f', hand: '#1d1d1f', arm: '#1d1d1f',
  },
  bunny: {
    name: 'Bunny', emoji: '🐰',
    skin: '#f3f1f8', skin2: '#ffffff', outline: '#5a4f6b',
    ear: 'bunny', earInner: '#f7b5c4', nose: '#f07c9a',
    muzzle: true, teeth: true,
    shirt: '#a66cff', pants: '#3f3a73', hand: '#ffffff',
  },
  robot: {
    name: 'Robot', emoji: '🤖',
    skin: '#b8c4d6', skin2: '#d9e1ec', outline: '#2b3442',
    ear: 'bolt', head: 'square', glow: '#38f2ff', nose: null,
    shirt: '#5d6b80', pants: '#3a4352', hand: '#8d9ab0', arm: '#8d9ab0',
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);

export const NEUTRAL_BS = Object.freeze({
  blinkL: 0, blinkR: 0, wideL: 0, wideR: 0,
  browDownL: 0, browDownR: 0, browOuterUpL: 0, browOuterUpR: 0, browInnerUp: 0,
  smile: 0, frown: 0, jaw: 0, pucker: 0, funnel: 0, cheekPuff: 0,
  lookX: 0, lookY: 0,
});

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Exaggerate (or calm down) expressions. Blinks are left alone so eyes still close fully.
export function boostExpressions(bs, gain) {
  if (gain === 1) return bs;
  const out = { ...bs };
  for (const k of Object.keys(out)) {
    if (k.startsWith('blink') || k === 'lookX' || k === 'lookY') continue;
    out[k] = clamp01(out[k] * gain);
  }
  return out;
}

// Mouth outline in head units (head radius = 1), y pointing down, centred on the mouth.
// Upper and lower lip are quadratic curves between the two mouth corners.
export function mouthParams(bs) {
  const w = 0.2 * (1 + bs.smile * 0.45 - bs.pucker * 0.5 + bs.jaw * 0.1);
  const corner = -bs.smile * 0.1 + bs.frown * 0.09;
  const upper = -0.01 + bs.smile * 0.01;
  const open = bs.jaw * 0.34 + bs.funnel * 0.08;
  const lower = upper + 0.035 + open * 2 + bs.smile * 0.09 - bs.frown * 0.02;
  return { w, corner, upper, lower, open };
}

export function mouthPolygon(m, n = 12) {
  const pts = [];
  const quad = (p0, c, p1, t) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([quad(-m.w, 0, m.w, t), quad(m.corner, m.upper, m.corner, t)]);
  }
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push([quad(m.w, 0, -m.w, t), quad(m.corner, m.lower, m.corner, t)]);
  }
  return pts;
}

// Rough emotion read from the blendshapes, used for the HUD badge and effects.
export function detectEmotion(bs) {
  const browDown = (bs.browDownL + bs.browDownR) / 2;
  const wide = (bs.wideL + bs.wideR) / 2;
  if (bs.jaw > 0.35 && (bs.browInnerUp > 0.35 || wide > 0.25)) return 'surprised';
  if (bs.smile > 0.45) return 'happy';
  if (browDown > 0.4 && bs.smile < 0.2) return 'angry';
  if (bs.frown > 0.3 || (bs.browInnerUp > 0.5 && bs.smile < 0.1)) return 'sad';
  return 'neutral';
}

export const EMOTION_EMOJI = {
  neutral: '😐', happy: '😄', surprised: '😮', angry: '😠', sad: '😢',
};

// Character definitions shared by the 2D and 3D renderers, plus the
// expression helpers (mouth shape, emotion) both of them use.

export const CHARACTERS = {
  cat: {
    name: 'Cat', emoji: '🐱',
    skin: '#f6a54a', skin2: '#fff1dc', muzzle: '#fff1dc', outline: '#6b3a12',
    ear: 'cat', earInner: '#ffbfcd', nose: '#f27a93', iris: '#4f9a2c', whiskers: true,
    shirt: '#4f7cff', pants: '#2c3e66', hand: '#fff1dc',
  },
  dog: {
    name: 'Puppy', emoji: '🐶',
    skin: '#e3b47c', skin2: '#fff3e2', muzzle: '#fff3e2', outline: '#5c3a1c',
    ear: 'floppy', earColor: '#8a5a33', spot: '#c08a55', nose: '#2d1e16', bigNose: true, iris: '#6b3f1d',
    shirt: '#ff8a3d', pants: '#36507a', hand: '#fff3e2',
  },
  fox: {
    name: 'Fox', emoji: '🦊',
    skin: '#f5803a', skin2: '#fff6ec', cheeks: '#fff6ec', outline: '#6e2f0b',
    ear: 'cat', earInner: '#3b2216', nose: '#2d1e16', iris: '#c98a1c',
    shirt: '#2fa59a', pants: '#27415e', hand: '#3b2216', arm: '#f5803a',
  },
  bear: {
    name: 'Bear', emoji: '🐻',
    skin: '#a8744a', skin2: '#f0d4b0', muzzle: '#f0d4b0', outline: '#4a2a12',
    ear: 'round', earInner: '#f0d4b0', nose: '#3b2412', iris: '#3b2412',
    shirt: '#e85d75', pants: '#5b3a8c', hand: '#f0d4b0',
  },
  panda: {
    name: 'Panda', emoji: '🐼',
    skin: '#ffffff', skin2: '#ffffff', muzzle: '#ffffff', outline: '#1d1d1f', brow: '#1d1d1f',
    ear: 'round', earColor: '#232326', earInner: '#3a3a3e', nose: '#1d1d1f', patches: '#232326', iris: '#3b2a1e',
    shirt: '#43b97f', pants: '#232326', hand: '#232326', arm: '#232326',
  },
  bunny: {
    name: 'Bunny', emoji: '🐰',
    skin: '#f7f3fb', skin2: '#ffffff', muzzle: '#ffffff', outline: '#5a4f6b',
    ear: 'bunny', earInner: '#ffbfd0', nose: '#f07c9a', teeth: true, iris: '#7a4fb0',
    shirt: '#a66cff', pants: '#3f3a73', hand: '#ffffff',
  },
  tiger: {
    name: 'Tiger', emoji: '🐯',
    skin: '#f9a03c', skin2: '#fff6e8', muzzle: '#fff6e8', outline: '#4a2510', stripes: '#3a1f10',
    ear: 'cat', earInner: '#fff6e8', nose: '#e8657e', iris: '#6aa82a', whiskers: true,
    shirt: '#2f6fd6', pants: '#1f2f4f', hand: '#fff6e8',
  },
  frog: {
    name: 'Frog', emoji: '🐸',
    skin: '#7ccd5a', skin2: '#c9f0a8', outline: '#2c5a1c', head: 'wide',
    ear: 'frog', eyes: 'frog', nostrils: true, wideMouth: true, mouthY: 0.35, iris: '#3a2a12', blush: '#ff8fa3',
    shirt: '#ffcf3a', pants: '#2c5a1c', hand: '#7ccd5a', arm: '#7ccd5a',
  },
  robot: {
    name: 'Robot', emoji: '🤖',
    skin: '#c3cee0', skin2: '#e3e9f2', outline: '#2b3442',
    ear: 'bolt', head: 'square', glow: '#38f2ff', nose: null, blush: '#ff9fb8',
    shirt: '#5d6b80', pants: '#3a4352', hand: '#8d9ab0', arm: '#8d9ab0',
  },
  alien: {
    name: 'Alien', emoji: '👽',
    skin: '#9fe07a', skin2: '#c9f5ad', outline: '#2f5a1e', head: 'alien',
    ear: 'antenna', accent: '#ff7ad1', eyes: 'alien', nose: null, nostrils: true, blush: '#7cc95a',
    shirt: '#6a4cff', pants: '#2b2466', hand: '#9fe07a', arm: '#9fe07a',
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
  const w = 0.2 * (1 + bs.smile * 0.45 - bs.pucker * 0.5 + bs.jaw * 0.4);
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

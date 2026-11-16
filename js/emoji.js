// Emoji stickers. Expressive sets swap to the emoji that matches your current face.

// Sharp vector emoji from Google's Noto Emoji (Apache-2.0), stored in assets/emoji/.
// `icon` is only used for the small picker chips.
export const EMOJI_SETS = {
  smiley: { name: 'Smiley', icon: '😄', img: 'slightly-smiling-face', faces: {
    neutral: 'slightly-smiling-face', talk: 'grinning-face-with-big-eyes', happy: 'grinning-face-with-smiling-eyes',
    laugh: 'grinning-squinting-face', surprised: 'face-with-open-mouth', angry: 'angry-face', sad: 'crying-face',
    wink: 'winking-face', blink: 'relieved-face', kiss: 'kissing-face', puff: 'face-with-steam-from-nose' } },
  cat: { name: 'Cat', icon: '😺', img: 'grinning-cat', faces: {
    neutral: 'grinning-cat', talk: 'grinning-cat', happy: 'grinning-cat-with-smiling-eyes', laugh: 'cat-with-tears-of-joy',
    surprised: 'weary-cat', angry: 'pouting-cat', sad: 'crying-cat', wink: 'cat-with-wry-smile', blink: 'kissing-cat',
    kiss: 'kissing-cat', puff: 'pouting-cat' } },
  monkey: { name: 'Monkey', icon: '🐵', img: 'monkey-face', faces: {
    neutral: 'monkey-face', blink: 'see-no-evil-monkey', surprised: 'speak-no-evil-monkey' } },
  dog: { name: 'Dog', icon: '🐶', img: 'dog-face' },
  fox: { name: 'Fox', icon: '🦊', img: 'fox' },
  panda: { name: 'Panda', icon: '🐼', img: 'panda' },
  koala: { name: 'Koala', icon: '🐨', img: 'koala' },
  tiger: { name: 'Tiger', icon: '🐯', img: 'tiger-face' },
  lion: { name: 'Lion', icon: '🦁', img: 'lion' },
  frog: { name: 'Frog', icon: '🐸', img: 'frog' },
  pig: { name: 'Pig', icon: '🐷', img: 'pig-face' },
  unicorn: { name: 'Unicorn', icon: '🦄', img: 'unicorn' },
  alien: { name: 'Alien', icon: '👽', img: 'alien' },
  robot: { name: 'Robot', icon: '🤖', img: 'robot' },
  ghost: { name: 'Ghost', icon: '👻', img: 'ghost' },
  pumpkin: { name: 'Pumpkin', icon: '🎃', img: 'jack-o-lantern' },
};

export const EMOJI_IDS = Object.keys(EMOJI_SETS);

// Which face to show right now.
export function pickFace(bs) {
  const blinkBoth = bs.blinkL > 0.6 && bs.blinkR > 0.6;
  const wink = Math.abs(bs.blinkL - bs.blinkR) > 0.5;
  const browDown = (bs.browDownL + bs.browDownR) / 2;
  if (bs.jaw > 0.4 && (bs.browInnerUp > 0.35 || (bs.wideL + bs.wideR) / 2 > 0.25) && bs.smile < 0.4) return 'surprised';
  if (wink) return 'wink';
  if (bs.smile > 0.55 && bs.jaw > 0.3) return 'laugh';
  if (bs.smile > 0.45) return 'happy';
  if (blinkBoth) return 'blink';
  if (browDown > 0.45) return 'angry';
  if (bs.frown > 0.35 || (bs.browInnerUp > 0.55 && bs.smile < 0.1)) return 'sad';
  if (bs.cheekPuff > 0.4) return 'puff';
  if (bs.pucker > 0.5) return 'kiss';
  if (bs.jaw > 0.2) return 'talk';
  return 'neutral';
}

const images = new Map();
function image(name) {
  let img = images.get(name);
  if (!img) {
    img = new Image();
    img.src = `assets/emoji/${name}.svg`;
    images.set(name, img);
  }
  return img;
}

// Start downloading every face of a set so expression changes never flicker.
export function preloadEmoji(setId) {
  const set = EMOJI_SETS[setId];
  if (!set) return;
  image(set.img);
  Object.values(set.faces || {}).forEach(image);
}

export function drawEmojiHead(ctx, setId, head) {
  const set = EMOJI_SETS[setId] || EMOJI_SETS.smiley;
  const name = set.faces ? set.faces[pickFace(head.bs)] || set.faces.neutral : set.img;
  let img = image(name);
  if (!img.complete || !img.naturalWidth) img = image(set.img);
  const size = head.r * 2.4 * (1 + head.bs.jaw * 0.06);
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(head.roll);
  ctx.scale(0.82 + 0.18 * Math.cos(head.yaw), 1);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = head.r * 0.12;
  ctx.shadowOffsetY = head.r * 0.05;
  if (img.complete && img.naturalWidth) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    // Still downloading: never leave the real face uncovered.
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc4d';
    ctx.fill();
  }
  ctx.restore();
}

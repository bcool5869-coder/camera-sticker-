import { CHARACTERS, CHARACTER_IDS, NEUTRAL_BS, boostExpressions, detectEmotion, EMOTION_EMOJI } from './characters.js';
import { drawHead, drawBody, bodyLayout } from './avatar2d.js';
import { Recorder, extensionFor, pickMimeType } from './recorder.js';
import { EMOJI_SETS, EMOJI_IDS, drawEmojiHead, preloadEmoji } from './emoji.js';

const $ = (sel) => document.querySelector(sel);
const DEMO = new URLSearchParams(location.search).has('demo');
const GRACE_MS = 500;          // keep using the last tracking result this long
const MAX_WIDTH = 1280;

// ------------------------------------------------------------ settings

const DEFAULTS = {
  style: '2d', character: 'cat', avatar: 'vita', emoji: 'smiley', mode: 'face', background: 'camera',
  bgColor: '#3fb8af', boost: 1.2, fx: true, mic: true, debug: false,
};
const settings = { ...DEFAULTS };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('camera-sticker-settings') || '{}'));
} catch { /* storage unavailable */ }
if (settings.character === 'custom' || !CHARACTERS[settings.character]) settings.character = 'cat';
if (settings.background === 'image') settings.background = 'camera';
if (!EMOJI_SETS[settings.emoji]) settings.emoji = 'smiley';
if (String(settings.avatar).startsWith('file:')) settings.avatar = 'vita';

function saveSettings() {
  try { localStorage.setItem('camera-sticker-settings', JSON.stringify(settings)); } catch { /* ignore */ }
}

// ------------------------------------------------------------ canvases

const out = $('#out');
const ctx = out.getContext('2d');
const video = document.createElement('video');
video.playsInline = true;
video.muted = true;

const mk = () => document.createElement('canvas');
const frame = mk(); const fctx = frame.getContext('2d');
const small = mk(); const sctx = small.getContext('2d');
const blurred = mk(); const bctx = blurred.getContext('2d');
const tinyA = mk(); const tinyB = mk();
const person = mk(); const pctx = person.getContext('2d');
let plate = null;            // photo of the empty room (body mode, camera background)
let bgImage = null;          // uploaded background image
let customSticker = null;    // uploaded sticker image
let W = 0; let H = 0;
let srcW = 0; let srcH = 0;

function sizeCanvases(w, h) {
  const scale = Math.min(1, MAX_WIDTH / w);
  W = Math.round(w * scale);
  H = Math.round(h * scale);
  for (const c of [out, frame, blurred, person]) { c.width = W; c.height = H; }
  small.width = 320;
  small.height = Math.round(320 * H / W);
  plate = null;
  updatePlateUi();
}

// Strong blur that works everywhere (no ctx.filter): shrink a lot, then scale back up.
function makeBlurred() {
  tinyA.width = Math.max(4, Math.round(W / 10)); tinyA.height = Math.max(3, Math.round(H / 10));
  tinyB.width = Math.max(2, Math.round(W / 40)); tinyB.height = Math.max(2, Math.round(H / 40));
  const a = tinyA.getContext('2d'); const b = tinyB.getContext('2d');
  a.imageSmoothingQuality = 'high'; b.imageSmoothingQuality = 'high';
  a.drawImage(frame, 0, 0, tinyA.width, tinyA.height);
  b.drawImage(tinyA, 0, 0, tinyB.width, tinyB.height);
  a.drawImage(tinyB, 0, 0, tinyA.width, tinyA.height);
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(tinyA, 0, 0, W, H);
  return blurred;
}

// `source` cut to the person-shaped mask.
function cutout(source, mask) {
  pctx.globalCompositeOperation = 'source-over';
  pctx.clearRect(0, 0, W, H);
  pctx.drawImage(source, 0, 0, W, H);
  pctx.globalCompositeOperation = 'destination-in';
  pctx.drawImage(mask, 0, 0, W, H);
  pctx.globalCompositeOperation = 'source-over';
  return person;
}

function drawCover(img) {
  const s = Math.max(W / img.width, H / img.height);
  const w = img.width * s; const h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// ------------------------------------------------------------ tracking + avatar

let tracker = null;
let avatar3d = null;
let loading3d = null;
let lastVideoTime = -1;
let drawDemoFrame = null;

async function ensure3d() {
  if (avatar3d || loading3d) return loading3d;
  loading3d = import('./avatar3d.js').then(({ Avatar3D }) => {
    avatar3d = new Avatar3D();
  }).catch((err) => {
    console.error(err);
    toast('3D could not start on this device, using 2D.');
    settings.style = '2d';
    syncUi();
  }).finally(() => { loading3d = null; });
  return loading3d;
}

// ---- VRM avatars (loaded on first use)
let avatarVrm = null;
let vrmModels = [];
let loadingVrm = null;
let vrmProgress = null;
let vrmFile = null;

async function ensureVrm() {
  if (!avatarVrm && !loadingVrm) {
    loadingVrm = import('./avatarvrm.js').then((mod) => {
      avatarVrm = new mod.AvatarVRM();
      vrmModels = mod.VRM_MODELS;
      buildCharacterChips();
    }).catch((err) => {
      console.error(err);
      toast('3D avatars could not start on this device.');
      settings.style = '2d';
      syncUi();
    }).finally(() => { loadingVrm = null; });
  }
  await loadingVrm;
  if (!avatarVrm) return;
  const want = vrmFile || settings.avatar;
  vrmProgress = 0;
  try {
    await avatarVrm.load(want, (f) => { vrmProgress = f; });
  } catch (err) {
    console.error(err);
    toast('That avatar could not be loaded. Switching to Vita.');
    vrmFile = null;
    settings.avatar = 'vita';
    saveSettings();
    syncUi();
  } finally {
    vrmProgress = null;
  }
}

function needPose() {
  return settings.mode === 'body' || settings.background !== 'camera';
}

function headFromTracking(st, now) {
  const f = st.face;
  if (f && now - st.faceSeenAt < GRACE_MS) {
    return {
      // Big enough to hide the whole head: hair/scalp above, chin and beard below.
      x: f.x, y: f.y - f.height * 0.15, r: Math.max(f.width * 0.9, f.height * 0.78),
      roll: f.roll, yaw: f.yaw, pitch: f.pitch,
      bs: boostExpressions(f.bs, settings.boost),
    };
  }
  // No face (turned away, too far): in body mode place a neutral head from the pose.
  const p = st.pose;
  if (settings.mode === 'body' && p && now - st.poseSeenAt < GRACE_MS && p.nose.v > 0.5) {
    const ew = Math.hypot(p.earR.x - p.earL.x, p.earR.y - p.earL.y);
    const sw = Math.hypot(p.shoulderR.x - p.shoulderL.x, p.shoulderR.y - p.shoulderL.y);
    // Measure the ear line left-to-right on screen so the head never ends up upside down.
    const [a, b] = p.earL.x < p.earR.x ? [p.earL, p.earR] : [p.earR, p.earL];
    return {
      x: p.nose.x, y: p.nose.y - ew * 0.1, r: Math.max(ew * 0.75, sw * 0.32),
      roll: Math.atan2(b.y - a.y, b.x - a.x), yaw: 0, pitch: 0, bs: NEUTRAL_BS,
    };
  }
  return null;
}

// ------------------------------------------------------------ effects

const particles = [];
let lastEmit = 0;
const FX = { happy: ['💖', '✨'], surprised: ['❗'], angry: ['💢'], sad: ['💧'] };

function updateFx(head, emotion, now, dt) {
  if (settings.fx && head && FX[emotion] && now - lastEmit > 280) {
    lastEmit = now;
    const set = FX[emotion];
    const side = Math.random() < 0.5 ? -1 : 1;
    particles.push({
      ch: set[Math.floor(Math.random() * set.length)],
      x: head.x + side * head.r * (0.9 + Math.random() * 0.4),
      y: head.y - head.r * (0.4 + Math.random() * 0.6),
      vx: side * head.r * 0.2, vy: -head.r * (emotion === 'sad' ? -0.6 : 0.8),
      size: head.r * (0.28 + Math.random() * 0.15), life: 1,
    });
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt / 1200;
    p.x += p.vx * dt / 1000;
    p.y += p.vy * dt / 1000;
    if (p.life <= 0) particles.splice(i, 1);
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.font = `${Math.round(p.size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(p.ch, p.x, p.y);
  }
  ctx.restore();
}

function drawDebug(st, head) {
  ctx.save();
  ctx.fillStyle = '#0f0';
  if (st.pose) for (const j of Object.values(st.pose)) if (j.v > 0.5) ctx.fillRect(j.x - 3, j.y - 3, 6, 6);
  if (head) {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(head.x, head.y, head.r, 0, Math.PI * 2);
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(head.x + Math.sin(head.yaw) * head.r, head.y + Math.sin(head.pitch) * head.r);
    ctx.stroke();
  }
  ctx.restore();
}

function hiddenNotice() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(H * 0.04)}px system-ui, sans-serif`;
  ctx.fillText('Looking for you… camera hidden', W / 2, H / 2);
  ctx.restore();
}

// ------------------------------------------------------------ main loop

let lastFrameAt = performance.now();
let fps = 0;
let currentEmotion = 'neutral';

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(100, now - lastFrameAt);
  lastFrameAt = now;

  if (DEMO) {
    if (W === 0) sizeCanvases(1280, 720);
    drawDemoFrame(fctx, W, H, now);
    sctx.drawImage(frame, 0, 0, small.width, small.height);
    tracker.process(frame, small, needPose(), now);
  } else {
    if (video.readyState < 2 || !video.videoWidth) return;
    if (video.videoWidth !== srcW || video.videoHeight !== srcH) {
      srcW = video.videoWidth;
      srcH = video.videoHeight;
      sizeCanvases(srcW, srcH);
    }
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      fctx.save();
      fctx.translate(W, 0);
      fctx.scale(-1, 1);
      fctx.drawImage(video, 0, 0, W, H);
      fctx.restore();
      sctx.drawImage(frame, 0, 0, small.width, small.height);
      try {
        tracker.process(frame, small, needPose(), now);
      } catch (err) {
        console.error(err);
      }
    }
  }
  fps = fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05;

  const st = tracker.state;
  const faceOk = st.face && now - st.faceSeenAt < GRACE_MS;
  const mask = st.mask && now - st.maskAt < GRACE_MS ? st.mask : null;
  const head = headFromTracking(st, now);
  const body = settings.mode === 'body';
  const layout = body && st.pose && now - st.poseSeenAt < GRACE_MS ? bodyLayout(st.pose, H) : null;
  let hidden = false;

  // 1. Background (and the real person, only where it is safe to show)
  switch (settings.background) {
    case 'camera':
      if (!body) {
        if (faceOk) ctx.drawImage(frame, 0, 0);
        else { ctx.drawImage(makeBlurred(), 0, 0); hidden = true; }
      } else if (mask) {
        ctx.drawImage(frame, 0, 0);
        ctx.drawImage(cutout(plate || makeBlurred(), mask), 0, 0);
      } else {
        ctx.drawImage(plate || makeBlurred(), 0, 0);
      }
      break;
    case 'blur':
      ctx.drawImage(makeBlurred(), 0, 0);
      if (!body && faceOk && mask) ctx.drawImage(cutout(frame, mask), 0, 0);
      break;
    case 'image':
      if (bgImage) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); drawCover(bgImage); break; }
      // falls through when no image chosen yet
    default:
      ctx.fillStyle = settings.bgColor;
      ctx.fillRect(0, 0, W, H);
  }
  if (!body && !faceOk && settings.background !== 'camera') hidden = true;
  if (settings.background !== 'camera' && settings.background !== 'blur' && !body && faceOk && mask) {
    ctx.drawImage(cutout(frame, mask), 0, 0);
  }

  // 2. Privacy cover: blur the real face underneath the character, so the face
  //    stays hidden even if a character fails to draw on this device.
  if (head && (settings.background === 'camera' || faceOk)) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, head.r * 1.05, head.r * 1.15, head.roll, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(makeBlurred(), 0, 0);
    ctx.restore();
  }

  // 3. Character
  const ch = CHARACTERS[settings.character] || CHARACTERS.cat;
  try {
    drawCharacter(ch, head, layout, body);
  } catch (err) {
    console.error(err);
    fallbackTo2d('The character crashed on this device, so it switched to 2D.');
    if (layout) drawBody(ctx, ch, layout, head);
    if (head) drawHead(ctx, ch, head, null);
  }

  // 4. Extras
  currentEmotion = faceOk ? detectEmotion(head.bs) : 'neutral';
  updateFx(faceOk ? head : null, currentEmotion, now, dt);
  if (settings.debug) drawDebug(st, head);
  if (hidden) hiddenNotice();

  updateHud(faceOk, layout, now);
}

function drawCharacter(ch, head, layout, body) {
  if (avatarVrm?.lost || avatar3d?.lost) {
    fallbackTo2d('3D graphics stopped on this device, so it switched to 2D.');
  }
  const use3d = settings.style === '3d' && avatar3d && !customSticker;
  if (settings.style === 'avatar' && avatarVrm && avatarVrm.vrm) {
    avatarVrm.resize(W, H);
    ctx.drawImage(avatarVrm.render(head, layout, body), 0, 0);
  } else if (settings.style === 'avatar') {
    // Avatar still downloading: keep the person hidden behind a 2D sticker meanwhile.
    if (layout) drawBody(ctx, ch, layout, head);
    if (head) drawHead(ctx, ch, head, null);
  } else if (settings.style === 'emoji' && !customSticker) {
    if (layout) drawBody(ctx, CHARACTERS.bear, layout, head);
    if (head) drawEmojiHead(ctx, settings.emoji, head);
  } else if (use3d) {
    avatar3d.setCharacter(settings.character);
    avatar3d.resize(W, H);
    ctx.drawImage(avatar3d.render(head, layout, body), 0, 0);
  } else {
    if (layout) drawBody(ctx, ch, layout, head);
    if (head) drawHead(ctx, ch, head, customSticker);
  }
}

let fellBack = false;
function fallbackTo2d(msg) {
  if (settings.style === '2d' || settings.style === 'emoji') return;
  settings.style = '2d';
  saveSettings();
  syncUi();
  if (!fellBack) { fellBack = true; toast(msg); }
}

// ------------------------------------------------------------ HUD + UI

let hudAt = 0;
function updateHud(faceOk, layout, now) {
  if (now - hudAt < 250) return;
  hudAt = now;
  const parts = [faceOk ? 'Face ✓' : 'Face –'];
  if (settings.mode === 'body') parts.push(layout ? 'Body ✓' : 'Body –');
  parts.push(`${EMOTION_EMOJI[currentEmotion]} ${currentEmotion}`);
  if (settings.debug) parts.push(`${Math.round(fps)} fps`);
  if (vrmProgress !== null && settings.style === 'avatar') parts.push(`Loading avatar ${Math.round(vrmProgress * 100)}%`);
  $('#status').textContent = parts.join(' · ');
  if (recorder?.recording) {
    const s = Math.floor((Date.now() - recStartedAt) / 1000);
    $('#recTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

function chip(label, icon, attrs, onclick) {
  const b = document.createElement('button');
  b.className = 'chip';
  Object.assign(b.dataset, attrs);
  b.innerHTML = `<span class="chip-emoji">${icon}</span>`;
  b.append(label);
  b.onclick = onclick;
  return b;
}

let chipsStyle = null;
function buildCharacterChips() {
  const wrap = $('#characters');
  wrap.textContent = '';
  chipsStyle = settings.style;
  const pick = (key, id) => () => {
    customSticker = null;
    if (key === 'avatar') vrmFile = null;
    settings[key] = id;
    saveSettings();
    syncUi();
  };
  if (settings.style === 'emoji') {
    for (const id of EMOJI_IDS) wrap.appendChild(chip(EMOJI_SETS[id].name, EMOJI_SETS[id].icon, { emoji: id }, pick('emoji', id)));
  } else if (settings.style === 'avatar') {
    if (!vrmModels.length) { wrap.textContent = 'Loading avatars…'; return; }
    for (const m of vrmModels) wrap.appendChild(chip(m.name, m.emoji, { avatar: m.id }, pick('avatar', m.id)));
  } else {
    for (const id of CHARACTER_IDS) wrap.appendChild(chip(CHARACTERS[id].name, CHARACTERS[id].emoji, { character: id }, pick('character', id)));
  }
}

function syncUi() {
  document.querySelectorAll('[data-setting]').forEach((group) => {
    const key = group.dataset.setting;
    group.querySelectorAll('button[data-value]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.value === String(settings[key])));
    });
  });
  if (chipsStyle !== settings.style) buildCharacterChips();
  document.querySelectorAll('#characters .chip').forEach((b) => {
    const on = b.dataset.character ? b.dataset.character === settings.character
      : b.dataset.emoji ? b.dataset.emoji === settings.emoji
        : !vrmFile && b.dataset.avatar === settings.avatar;
    b.setAttribute('aria-pressed', String(!customSticker && on));
  });
  const isAvatar = settings.style === 'avatar';
  $('#stickerChip').hidden = isAvatar;
  $('#vrmChip').hidden = !isAvatar;
  $('#vrmChip').setAttribute('aria-pressed', String(!!vrmFile));
  $('#stickerChip').setAttribute('aria-pressed', String(!!customSticker));
  $('#charHint').textContent = isAvatar
    ? 'Full 3D avatars that copy your face, head and arms. Vita has the most expressions; the others download when picked (free CC0 models).'
    : settings.style === 'emoji'
      ? 'Smiley, Cat and Monkey change face with your expression. Others follow your head.'
      : 'Use a PNG with a transparent background. It follows your head, but has no expressions.';
  $('#bgColor').value = settings.bgColor;
  $('#colorRow').hidden = settings.background !== 'color';
  $('#imageRow').hidden = settings.background !== 'image';
  $('#plateRow').hidden = !(settings.background === 'camera' && settings.mode === 'body');
  $('#boost').value = settings.boost;
  $('#boostVal').textContent = `${Math.round(settings.boost * 100)}%`;
  $('#fx').checked = settings.fx;
  $('#mic').checked = settings.mic;
  $('#debug').checked = settings.debug;
  if (settings.style === '3d') ensure3d();
  if (settings.style === 'avatar') ensureVrm();
  if (settings.style === 'emoji') preloadEmoji(settings.emoji);
}

function updatePlateUi() {
  const el = $('#plateState');
  if (el) el.textContent = plate ? 'Empty room saved ✓' : 'Not captured – your body area is blurred';
  const clear = $('#clearPlate');
  if (clear) clear.hidden = !plate;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

function wireUi() {
  document.querySelectorAll('[data-setting]').forEach((group) => {
    const key = group.dataset.setting;
    group.querySelectorAll('button[data-value]').forEach((b) => {
      b.onclick = () => {
        settings[key] = b.dataset.value;
        if (key === 'background' && b.dataset.value === 'image' && !bgImage) $('#bgFile').click();
        saveSettings();
        syncUi();
      };
    });
  });

  $('#bgColor').oninput = (e) => { settings.bgColor = e.target.value; saveSettings(); };
  $('#bgFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) bgImage = await loadImage(f);
    e.target.value = '';
  };
  $('#vrmFile').onchange = (e) => {
    const f = e.target.files[0];
    if (f) { vrmFile = f; customSticker = null; syncUi(); }
    e.target.value = '';
  };
  $('#stickerFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) { customSticker = await loadImage(f); syncUi(); }
    e.target.value = '';
  };
  $('#boost').oninput = (e) => {
    settings.boost = Number(e.target.value);
    $('#boostVal').textContent = `${Math.round(settings.boost * 100)}%`;
    saveSettings();
  };
  for (const key of ['fx', 'mic', 'debug']) {
    $('#' + key).onchange = (e) => { settings[key] = e.target.checked; saveSettings(); };
  }
  $('#recalibrate').onclick = () => { tracker.recalibrate(); toast('Hold still and look at the camera…'); };
  $('#capturePlate').onclick = () => {
    let n = 5;
    const btn = $('#capturePlate');
    btn.disabled = true;
    const tick = () => {
      if (n === 0) {
        plate = mk();
        plate.width = W; plate.height = H;
        plate.getContext('2d').drawImage(frame, 0, 0);
        btn.disabled = false;
        btn.textContent = 'Capture empty room';
        updatePlateUi();
        toast('Empty room saved. Come back into view!');
        return;
      }
      btn.textContent = `Step out of view… ${n}`;
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  };
  $('#clearPlate').onclick = () => { plate = null; updatePlateUi(); };

  $('#settingsBtn').onclick = () => {
    const p = $('#panel');
    p.classList.toggle('open');
    $('#settingsBtn').setAttribute('aria-expanded', String(p.classList.contains('open')));
  };
  $('#closePanel').onclick = () => $('#panel').classList.remove('open');

  $('#photoBtn').onclick = () => {
    out.toBlob((b) => b && download(b, `sticker-cam-${stamp()}.png`), 'image/png');
  };
  $('#recBtn').onclick = toggleRecording;
  $('#closeResult').onclick = () => $('#result').close();
}

// ------------------------------------------------------------ recording

let recorder = null;
let recStartedAt = 0;

async function toggleRecording() {
  const btn = $('#recBtn');
  if (recorder?.recording) {
    btn.disabled = true;
    const blob = await recorder.stop();
    btn.disabled = false;
    btn.classList.remove('recording');
    btn.setAttribute('aria-label', 'Start recording');
    $('#recPill').hidden = true;
    if (blob) showResult(blob);
    return;
  }
  recorder = recorder || new Recorder(out);
  try {
    const { hasAudio } = await recorder.start({ withAudio: settings.mic });
    recStartedAt = Date.now();
    btn.classList.add('recording');
    btn.setAttribute('aria-label', 'Stop recording');
    $('#recPill').hidden = false;
    $('#recTime').textContent = '00:00';
    if (settings.mic && !hasAudio) toast('Microphone blocked – recording without sound.');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Could not start recording.');
  }
}

function showResult(blob) {
  const url = URL.createObjectURL(blob);
  const v = $('#resultVideo');
  if (v.dataset.url) URL.revokeObjectURL(v.dataset.url);
  v.dataset.url = url;
  v.src = url;
  const a = $('#downloadLink');
  a.href = url;
  a.download = `sticker-cam-${stamp()}.${extensionFor(blob.type)}`;
  $('#resultInfo').textContent = `${(blob.size / 1e6).toFixed(1)} MB · ${extensionFor(blob.type).toUpperCase()}`;
  $('#result').showModal();
}

// ------------------------------------------------------------ start

async function start() {
  const btn = $('#startBtn');
  const err = $('#startError');
  err.textContent = '';
  btn.disabled = true;
  $('#demoBtn').disabled = true;
  try {
    if (DEMO) {
      const demo = await import('./demo.js');
      drawDemoFrame = demo.drawDemoFrame;
      tracker = new demo.DemoTracker();
    } else {
      btn.textContent = 'Starting camera…';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      btn.textContent = 'Loading face & body tracking…';
      const { Tracker } = await import('./tracker.js');
      tracker = new Tracker();
      await tracker.init();
    }
    $('#start').hidden = true;
    $('#stage').hidden = false;
    if (window.matchMedia('(min-width: 900px)').matches) $('#panel').classList.add('open');
    if (pickMimeType() === null) toast('This browser cannot record video. Photos still work.');
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    const name = e?.name;
    err.textContent = name === 'NotAllowedError'
      ? 'Camera permission was blocked. Allow camera access in your browser settings and try again.'
      : name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Could not start: ${e?.message || e}`;
    btn.disabled = false;
    $('#demoBtn').disabled = false;
    btn.textContent = 'Start camera';
  }
}

buildCharacterChips();
wireUi();
syncUi();
$('#startBtn').onclick = start;
$('#demoBtn').onclick = () => { location.search = '?demo'; };
if (DEMO) start();

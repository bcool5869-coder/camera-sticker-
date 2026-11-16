# Sticker Cam

Record videos as a cartoon character instead of your real face. The character follows
your **head** (turn, tilt, nod), your **body** (shoulders, arms, hands, legs) and your
**facial expressions** (blinks, winks, eyebrows, smiling, mouth open, puffed cheeks, eye direction).

Everything runs in the browser on your device. No video is uploaded anywhere.

## Features

| | |
|---|---|
| **Style** | 2D flat cartoon or 3D toon-shaded |
| **Characters** | Cat, Bear, Panda, Bunny, Robot, or upload your own sticker image |
| **Tracking** | *Face only*: a character head over your face, the rest of the camera stays. *Full body*: the whole character copies your pose |
| **Background** | Camera, Blur, Colour, Image. In full-body + camera mode you can save a photo of the empty room so your real body is fully replaced |
| **Emotions** | Detects happy / surprised / angry / sad, with optional effects (💖 ❗ 💢 💧) and a strength slider to exaggerate expressions |
| **Output** | Record video with microphone audio (MP4 where supported, otherwise WebM), or take a photo |

**Privacy:** only the finished picture is recorded, never the raw camera. If your face is
lost in face-only mode, the frame is blurred until you're found again. In full-body mode
your real body is always blurred or replaced.

## Run it

It's a static site with no build step. The camera only works over `https://` or on `localhost`.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To publish it, push this folder to any static host (GitHub Pages, Netlify, Vercel…).

Add `?demo` to the URL (e.g. `http://localhost:8000/?demo`) to try it without a camera:
a fake person and scripted movements show every feature.

## How it works

- `js/tracker.js`: [MediaPipe](https://ai.google.dev/edge/mediapipe) Face Landmarker
  (478 points + 52 expression blendshapes) and Pose Landmarker (33 body points + person
  segmentation mask), with One Euro smoothing (`js/filters.js`).
- `js/avatar2d.js`: canvas 2D drawing of the head, expressions and body.
- `js/avatar3d.js`: three.js toon character in an orthographic camera matched to the video pixels.
- `js/characters.js`: character colours and shared expression maths (mouth shape, emotion).
- `js/main.js`: camera, compositing (background → person cut-out → character → effects), UI.
- `js/recorder.js`: `MediaRecorder` on the output canvas plus the microphone.

Libraries and models load from jsDelivr and Google's MediaPipe model storage (about 10 MB on first start).

## Tips

- Use good, even lighting on your face.
- Use **Re-centre head** while looking straight at the camera if the character seems to look up or down at rest.
- For full body, step back so your shoulders (and ideally hips) are in view.

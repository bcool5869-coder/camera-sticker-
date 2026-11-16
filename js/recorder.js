// Records the composited canvas (never the raw camera) plus optional microphone audio.

const MIME_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export class Recorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.recorder = null;
    this.audioStream = null;
    this.chunks = [];
  }

  get recording() {
    return this.recorder?.state === 'recording';
  }

  async start({ withAudio }) {
    const mimeType = pickMimeType();
    if (mimeType === null) throw new Error('Recording is not supported in this browser.');
    const stream = this.canvas.captureStream(30);
    if (withAudio) {
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        this.audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (err) {
        console.warn('Microphone unavailable, recording without sound', err);
        this.audioStream = null;
      }
    }
    this.chunks = [];
    this.mimeType = mimeType;
    this.recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 6_000_000,
    });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.done = new Promise((resolve) => {
      this.recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this.audioStream = null;
        const type = this.recorder.mimeType || mimeType || 'video/webm';
        resolve(new Blob(this.chunks, { type }));
      };
    });
    this.recorder.start(1000);
    return { hasAudio: !!this.audioStream };
  }

  async stop() {
    if (!this.recorder || this.recorder.state === 'inactive') return null;
    this.recorder.stop();
    return this.done;
  }
}

export function extensionFor(type) {
  return type.includes('mp4') ? 'mp4' : 'webm';
}

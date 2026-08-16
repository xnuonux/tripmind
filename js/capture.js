function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((res) => canvas.toBlob(res, type, quality));
}

function stamp(state) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `tripmind-${state.preset}-${state.seed}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export const ASPECTS = {
  '16:9': [16, 9],
  '1:1': [1, 1],
  '9:16': [9, 16],
  '4:5': [4, 5],
  '21:9': [21, 9],
};

export function sizeFor(aspect, longEdge) {
  const [a, b] = ASPECTS[aspect] || ASPECTS['16:9'];
  if (a >= b) return [longEdge, Math.round(longEdge * b / a) & ~1];
  return [Math.round(longEdge * a / b) & ~1, longEdge];
}

export async function captureStill(renderer, state, opts = {}) {
  const {
    aspect = '16:9',
    longEdge = 1920,
    format = 'image/png',
    download = true,
    as = 'blob',
  } = opts;
  const [w, h] = sizeFor(aspect, longEdge);
  const prevW = renderer.canvas.clientWidth || renderer.w;
  const prevH = renderer.canvas.clientHeight || renderer.h;
  const prevD = renderer.dpr;
  renderer.resize(w, h, 1);
  renderer.frame(1 / 60, state, { bass: 0, mid: 0, treble: 0 });
  const blob = await canvasToBlob(renderer.canvas, format, 0.95);
  const name = `${stamp(state)}.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
  if (download) downloadBlob(blob, name);
  renderer.resize(prevW, prevH, prevD);
  if (as === 'dataurl') {
    const data = await blobToDataURL(blob);
    return { name, mime: blob.type, width: w, height: h, data };
  }
  return blob;
}

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function pickMime() {
  const types = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of types) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return 'video/webm';
}

export async function captureVideo(renderer, state, opts = {}, hooks = {}) {
  const {
    aspect = '16:9',
    longEdge = 1920,
    fps = 60,
    duration = 8,
    bits = 14_000_000,
  } = opts;

  const [w, h] = sizeFor(aspect, longEdge);
  const prevW = renderer.canvas.clientWidth || renderer.w;
  const prevH = renderer.canvas.clientHeight || renderer.h;
  const prevD = renderer.dpr;
  const prevPaused = renderer.paused;

  renderer.resize(w, h, 1);
  renderer.paused = false;

  const mime = pickMime();
  const stream = renderer.canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bits });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    rec.onerror = (e) => reject(e.error || e);
  });

  rec.start(250);
  const t0 = performance.now();
  const total = duration * 1000;
  hooks.onStart?.({ w, h, fps, duration, mime });

  await new Promise((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - t0;
      hooks.onProgress?.({
        t: elapsed / 1000,
        duration,
        pct: Math.min(1, elapsed / total),
      });
      if (elapsed >= total || hooks.cancelled?.()) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  rec.stop();
  const blob = await done;
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const name = `${stamp(state)}-${duration}s-${longEdge}p.${ext}`;
  const download = opts.download !== false;
  if (!hooks.cancelled?.() && download) {
    downloadBlob(blob, name);
  }
  renderer.resize(prevW, prevH, prevD);
  renderer.paused = prevPaused;
  hooks.onDone?.({ blob, cancelled: !!hooks.cancelled?.(), name });
  return blob;
}

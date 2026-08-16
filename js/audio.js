export const audio = {
  enabled: false,
  ctx: null,
  analyser: null,
  data: null,
  srcNode: null,
  mediaEl: null,
  stream: null,
  bass: 0,
  mid: 0,
  treble: 0,
  amount: 1,
};

export async function startAudio(source, file) {
  await stopAudio();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.78;
  const data = new Uint8Array(analyser.frequencyBinCount);

  if (source === 'mic') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const src = ctx.createMediaStreamSource(stream);
    src.connect(analyser);
    audio.stream = stream;
    audio.srcNode = src;
  } else if (file) {
    const url = URL.createObjectURL(file);
    const el = new Audio(url);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    const src = ctx.createMediaElementSource(el);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    await el.play();
    audio.mediaEl = el;
    audio.srcNode = src;
  } else {
    await ctx.close();
    return;
  }

  audio.ctx = ctx;
  audio.analyser = analyser;
  audio.data = data;
  audio.enabled = true;
}

export async function stopAudio() {
  try { audio.mediaEl?.pause(); } catch {}
  try { audio.stream?.getTracks().forEach((t) => t.stop()); } catch {}
  try { await audio.ctx?.close(); } catch {}
  audio.ctx = null;
  audio.analyser = null;
  audio.data = null;
  audio.srcNode = null;
  audio.mediaEl = null;
  audio.stream = null;
  audio.enabled = false;
  audio.bass = audio.mid = audio.treble = 0;
}

export function sampleAudio() {
  if (!audio.enabled || !audio.analyser) {
    audio.bass *= 0.9;
    audio.mid *= 0.9;
    audio.treble *= 0.9;
    return audio;
  }
  audio.analyser.getByteFrequencyData(audio.data);
  const n = audio.data.length;
  let b = 0, m = 0, t = 0;
  const nB = Math.max(1, (n * 0.08) | 0);
  const nM = Math.max(1, (n * 0.35) | 0);
  for (let i = 0; i < nB; i++) b += audio.data[i];
  for (let i = nB; i < nM; i++) m += audio.data[i];
  for (let i = nM; i < n; i++) t += audio.data[i];
  b = (b / nB) / 255;
  m = (m / (nM - nB)) / 255;
  t = (t / (n - nM)) / 255;
  const amt = audio.amount;
  audio.bass = audio.bass * 0.55 + b * 0.45 * amt;
  audio.mid = audio.mid * 0.6 + m * 0.4 * amt;
  audio.treble = audio.treble * 0.6 + t * 0.4 * amt;
  return audio;
}

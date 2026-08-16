import { Renderer } from './renderer.js';
import { makeState, persist } from './state.js';
import { sampleAudio } from './audio.js';
import { bindUI } from './ui.js';

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);

let state = makeState();
const get = () => state;
const set = (next) => { state = next; persist(state); };

const ui = bindUI({ get, set, renderer });

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
}
fit();
window.addEventListener('resize', fit);

// orbit
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, t: renderer.cam.theta, p: renderer.cam.phi };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = (e.clientX - drag.x) / window.innerWidth;
  const dy = (e.clientY - drag.y) / window.innerHeight;
  renderer.cam.theta = drag.t + dx * 3.4;
  renderer.cam.phi = Math.max(-1.15, Math.min(1.15, drag.p + dy * 2.2));
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  renderer.cam.dist = Math.max(2.6, Math.min(14, renderer.cam.dist * (1 + e.deltaY * 0.0012)));
}, { passive: false });

// two-finger / pinch zoom is handled by wheel on trackpads

renderer.setSeed(state.seed);
renderer.rebuildParticles(state);

const hudFps = document.getElementById('hud-fps');
let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const audio = sampleAudio();
  try {
    renderer.frame(dt, state, audio);
  } catch (err) {
    console.error(err);
    document.getElementById('fatal').textContent = err.message || String(err);
    document.getElementById('fatal').hidden = false;
    return;
  }
  if (hudFps) hudFps.textContent = renderer.fps ? renderer.fps.toFixed(0) : '–';
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// fade the title splash
requestAnimationFrame(() => document.body.classList.add('awake'));

window.TRIPMIND = { get, set, renderer, ui };

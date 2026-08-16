import { Renderer } from './renderer.js';
import { makeState, persist } from './state.js';
import { sampleAudio } from './audio.js';
import { bindUI } from './ui.js';
import { attachAPI } from './api.js';
import { startBridgeClient } from './bridge-client.js';
import { guessPower, dprFor, savePower } from './power.js';

const canvas = document.getElementById('c');
const fatalEl = document.getElementById('fatal');
function showFatal(err) {
  if (!fatalEl) return;
  if (!err) { fatalEl.hidden = true; fatalEl.textContent = ''; return; }
  fatalEl.hidden = false;
  fatalEl.textContent = String(err.message || err);
}

const power0 = guessPower();
let renderer;
try {
  renderer = new Renderer(canvas, { power: power0 });
} catch (err) {
  console.error(err);
  try {
    renderer = new Renderer(canvas, { power: 'low' });
    savePower('low');
  } catch (err2) {
    showFatal(err2);
    throw err2;
  }
}

let state = makeState();
const get = () => state;
const set = (next) => { state = next; persist(state); };

const ui = bindUI({ get, set, renderer });
const api = attachAPI({ get, set, renderer, ui });
startBridgeClient(api);

function fit() {
  renderer.resize(window.innerWidth, window.innerHeight, dprFor(renderer.power));
}
fit();
window.addEventListener('resize', fit);

export function applyPower(mode) {
  const next = renderer.setPower(mode);
  savePower(next);
  fit();
  ui.paint();
  return next;
}
if (typeof window !== 'undefined') window.__tripmindApplyPower = applyPower;

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

const hudFps = document.getElementById('hud-fps');
let last = performance.now();
let booted = false;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const audio = sampleAudio();
  try {
    renderer.frame(dt, state, audio);
    if (!booted) {
      booted = true;
      document.body.classList.add('awake');
      const hint = document.getElementById('boot-hint');
      if (hint) hint.hidden = true;
    }
  } catch (err) {
    console.error(err);
    showFatal(err);
    if (renderer.power !== 'low') {
      try {
        applyPower('low');
        showFatal(null);
      } catch (e2) {
        showFatal(e2);
        return;
      }
    } else {
      return;
    }
  }
  if (hudFps) {
    const tag = renderer.power === 'low' ? ' · low' : '';
    hudFps.textContent = (renderer.fps ? renderer.fps.toFixed(0) : '–') + tag;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// window.TRIPMIND is owned by attachAPI

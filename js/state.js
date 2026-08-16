import { PALETTES } from './palettes.js';
import { PRESETS, presetById } from './presets.js';

export const ENGINES = [
  'field', 'kaleid', 'warp', 'abyss', 'phosphor',
  'lattice', 'soliton', 'iris', 'prism', 'filament',
  'orbital', 'hopf', 'klein', 'hybrid',
];

export const SHAPES = [
  'superformula', 'torusknot', 'lissajous', 'attractor', 'sphericalharmonic',
  'torus', 'sphere', 'rings', 'knot', 'disc', 'helix', 'cube', 'cloud',
];

export const DEFAULTS = {
  engine: 'warp',
  engineB: 'kaleid',
  seed: '820bd92d',
  preset: 'pale-ember',
  intensity: 0.55,
  tempo: 0.48,
  heat: 0.58,
  bloom: 0.52,
  kaleid: 0.0,
  segments: 6,
  warpAmt: 0.42,
  noise: 0.38,
  trail: 0.84,
  grain: 0.10,
  ca: 0.32,
  crt: 0.0,
  palette: 4,
  paletteShift: 0.0,
  contrast: 1.06,
  exposure: 1.05,
  fov: 1.12,
  shape: 'superformula',
  particles: 2,
  spring: 1.25,
  damping: 0.945,
  orbit: 0.16,
  morph: 0.0,
  mix: 0.5,
  audioOn: false,
  audioAmt: 1.0,
  autoRotate: true,
};

export function cloneState(s) {
  return { ...s };
}

export function makeState() {
  const fromUrl = parseHash();
  if (fromUrl?.preset) {
    const p = presetById(fromUrl.preset);
    if (p) return applyPreset(cloneState(DEFAULTS), p, fromUrl);
  }
  const first = PRESETS[0];
  const s = applyPreset(cloneState(DEFAULTS), first, fromUrl || {});
  try {
    const saved = JSON.parse(localStorage.getItem('tripmind:last') || 'null');
    if (saved && saved.seed) return { ...s, ...saved, ...fromUrl };
  } catch {}
  return s;
}

export function applyPreset(state, preset, overrides = {}) {
  const next = {
    ...state,
    ...preset.params,
    preset: preset.id,
    seed: overrides.seed || preset.seed || state.seed,
  };
  if (typeof overrides.intensity === 'number') next.intensity = overrides.intensity;
  if (typeof overrides.tempo === 'number') next.tempo = overrides.tempo;
  if (typeof overrides.heat === 'number') next.heat = overrides.heat;
  if (typeof overrides.bloom === 'number') next.bloom = overrides.bloom;
  return next;
}

export function persist(state) {
  const slim = {
    preset: state.preset,
    seed: state.seed,
    engine: state.engine,
    intensity: state.intensity,
    tempo: state.tempo,
    heat: state.heat,
    bloom: state.bloom,
    palette: state.palette,
  };
  try { localStorage.setItem('tripmind:last', JSON.stringify(slim)); } catch {}
  writeHash(state);
}

export function writeHash(state) {
  const q = new URLSearchParams();
  q.set('p', state.preset);
  q.set('s', state.seed);
  q.set('e', state.engine);
  const hash = q.toString();
  if (location.hash.slice(1) !== hash) {
    history.replaceState(null, '', '#' + hash);
  }
}

export function parseHash() {
  const raw = location.hash.replace(/^#/, '').trim();
  if (!raw) return null;
  const q = new URLSearchParams(raw);
  const out = {};
  if (q.get('p')) out.preset = q.get('p');
  if (q.get('s')) out.seed = q.get('s');
  if (q.get('e')) out.engine = q.get('e');
  return out;
}

export function randomSeed(rng = Math.random) {
  let s = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < 8; i++) s += hex[(rng() * 16) | 0];
  return s;
}

export function paletteName(i) {
  return PALETTES[((i % PALETTES.length) + PALETTES.length) % PALETTES.length].name;
}

export function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

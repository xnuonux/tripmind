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
  let s;
  if (fromUrl?.preset) {
    const p = presetById(fromUrl.preset);
    if (p) s = applyPreset(cloneState(DEFAULTS), p, fromUrl);
  }
  if (!s) {
    s = applyPreset(cloneState(DEFAULTS), PRESETS[0], fromUrl || {});
  }
  if (!fromUrl?.preset && !fromUrl?.seed) {
    try {
      const saved = JSON.parse(localStorage.getItem('tripmind:last') || 'null');
      if (saved && saved.seed) s = { ...s, ...saved };
    } catch {}
  }
  if (fromUrl) s = { ...s, ...fromUrl };
  return s;
}

export function applyPreset(state, preset, overrides = {}) {
  const next = {
    ...state,
    ...preset.params,
    preset: preset.id,
    seed: overrides.seed || preset.seed || state.seed,
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'preset' || v === undefined) continue;
    next[k] = v;
  }
  return next;
}

export const STATE_FIELDS = {
  engine:        { type: 'enum',   values: ENGINES, meaning: 'primary renderer / theorem' },
  engineB:       { type: 'enum',   values: ENGINES, meaning: 'secondary engine for hybrid / mix' },
  seed:          { type: 'hex',    length: 8, meaning: 'deterministic world seed' },
  preset:        { type: 'string', meaning: 'composition id' },
  intensity:     { type: 'number', min: 0, max: 1, meaning: 'how hard the field insists' },
  tempo:         { type: 'number', min: 0, max: 1, meaning: 'time constant' },
  heat:          { type: 'number', min: 0, max: 1, meaning: 'saturation / fever' },
  bloom:         { type: 'number', min: 0, max: 1, meaning: 'HDR halo on hot parts' },
  kaleid:        { type: 'number', min: 0, max: 1, meaning: 'dihedral fold mix' },
  segments:      { type: 'int',    min: 2, max: 32, meaning: 'kaleidoscope fold count D_n' },
  warpAmt:       { type: 'number', min: 0, max: 1, meaning: 'domain-warp amplitude' },
  noise:         { type: 'number', min: 0, max: 1, meaning: 'noise / curl amount' },
  trail:         { type: 'number', min: 0, max: 0.97, meaning: 'video-feedback persistence' },
  grain:         { type: 'number', min: 0, max: 0.4, meaning: 'IGN film grain' },
  ca:            { type: 'number', min: 0, max: 1, meaning: 'radial chromatic aberration' },
  crt:           { type: 'number', min: 0, max: 1, meaning: 'CRT curvature + aperture grille' },
  palette:       { type: 'int',    min: 0, max: 29, meaning: 'IQ cosine palette index' },
  paletteShift:  { type: 'number', min: 0, max: 1, meaning: 'phase along the palette' },
  contrast:      { type: 'number', min: 0.5, max: 2, meaning: 'grade contrast' },
  exposure:      { type: 'number', min: 0.4, max: 2, meaning: 'grade exposure' },
  fov:           { type: 'number', min: 0.6, max: 2, meaning: 'field of view / zoom feel' },
  shape:         { type: 'enum',   values: SHAPES, meaning: 'particle manifold (field engine)' },
  particles:     { type: 'int',    min: 0, max: 3, meaning: 'particle count level 16k–102k' },
  spring:        { type: 'number', min: 0, max: 3, meaning: 'spring-to-home stiffness' },
  damping:       { type: 'number', min: 0.5, max: 0.995, meaning: 'velocity keep' },
  orbit:         { type: 'number', min: 0, max: 1, meaning: 'shared angular momentum' },
  morph:         { type: 'number', min: 0, max: 1, meaning: 'shape-morph amount (field)' },
  mix:           { type: 'number', min: 0, max: 1, meaning: 'hybrid mix toward engineB' },
  audioOn:       { type: 'bool',   meaning: 'audio reactivity armed' },
  audioAmt:      { type: 'number', min: 0, max: 2, meaning: 'audio modulation depth' },
  autoRotate:    { type: 'bool',   meaning: 'camera / field auto-rotate' },
};

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
  q.set('i', num(state.intensity));
  q.set('t', num(state.tempo));
  q.set('h', num(state.heat));
  q.set('b', num(state.bloom));
  const hash = q.toString();
  if (location.hash.slice(1) !== hash) {
    history.replaceState(null, '', location.pathname + location.search + '#' + hash);
  }
}

function num(v) {
  return String(Math.round((+v || 0) * 1000) / 1000);
}

export function parseHash() {
  const fromSearch = location.search ? new URLSearchParams(location.search) : null;
  const raw = location.hash.replace(/^#/, '').trim();
  const q = raw ? new URLSearchParams(raw) : (fromSearch || new URLSearchParams());
  if (fromSearch) {
    for (const [k, v] of fromSearch) if (!q.has(k)) q.set(k, v);
  }
  if (![...q.keys()].length) return null;

  if (q.get('state')) {
    try { return decodeStatePayload(q.get('state')); } catch { /* fall through */ }
  }

  const out = {};
  if (q.get('p')) out.preset = q.get('p');
  if (q.get('s')) out.seed = q.get('s');
  if (q.get('e')) out.engine = q.get('e');
  if (q.get('eb')) out.engineB = q.get('eb');
  const floats = { i: 'intensity', t: 'tempo', h: 'heat', b: 'bloom', k: 'kaleid', w: 'warpAmt' };
  for (const [k, name] of Object.entries(floats)) {
    if (q.has(k)) out[name] = clamp(+q.get(k), 0, 1);
  }
  return out;
}

export function encodeStatePayload(state) {
  const json = JSON.stringify(state);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeStatePayload(payload) {
  let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export function shareURL(state, { full = false } = {}) {
  const u = new URL(location.href);
  if (full) {
    u.hash = 'state=' + encodeStatePayload(state);
  } else {
    u.hash = `p=${state.preset}&s=${state.seed}&e=${state.engine}&i=${num(state.intensity)}&t=${num(state.tempo)}&h=${num(state.heat)}&b=${num(state.bloom)}`;
  }
  return u.toString();
}

function clamp(v, a, b) {
  if (!Number.isFinite(v)) return a;
  return Math.max(a, Math.min(b, v));
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

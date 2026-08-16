// TRIPMIND public control plane.
// Humans use the dock. Agents use this.
// Same verbs, same state, no secret surface.

import { PRESETS, FAMILIES, presetById, nextPreset, presetIndex } from './presets.js';
import { PALETTES } from './palettes.js';
import {
  ENGINES, SHAPES, DEFAULTS, STATE_FIELDS, applyPreset, randomSeed,
  shareURL, cloneState,
} from './state.js';
import { captureStill, captureVideo, ASPECTS } from './capture.js';

export const VERSION = '1.1.0';
export const PROTOCOL = 'tripmind/v1';

const REBUILD = new Set(['seed', 'shape', 'particles']);

export const COMMANDS = [
  { cmd: 'help',      args: {},                         returns: 'this catalog',
    about: 'discover every verb. start here.' },
  { cmd: 'schema',    args: {},                         returns: 'state field schema',
    about: 'types, ranges, meaning of every knob.' },
  { cmd: 'catalog',   args: { family: 'optional' },     returns: 'presets + engines + palettes',
    about: 'what can be asked for by name.' },
  { cmd: 'describe',  args: {},                         returns: 'current look as prose + json',
    about: 'read the chamber. use this before you touch it.' },
  { cmd: 'get',       args: {},                         returns: 'full state object',
    about: 'raw state snapshot.' },
  { cmd: 'set',       args: { '...fields': 'partial' }, returns: 'describe()',
    about: 'patch any state fields. unknown keys ignored.' },
  { cmd: 'preset',    args: { id: 'godhead' },          returns: 'describe()',
    about: 'load a named composition. id from catalog.' },
  { cmd: 'next',      args: {},                         returns: 'describe()',
    about: 'next composition in the 61.' },
  { cmd: 'prev',      args: {},                         returns: 'describe()',
    about: 'previous composition.' },
  { cmd: 'engine',    args: { name: 'hopf', b: 'optional engineB' }, returns: 'describe()',
    about: 'switch primary (and optional secondary) engine.' },
  { cmd: 'seed',      args: { hex: '60dhead1' },        returns: 'describe()',
    about: 'set 8-char hex seed. omit hex to randomize.' },
  { cmd: 'randomize', args: {},                         returns: 'describe()',
    about: 'new seed, same composition.' },
  { cmd: 'play',      args: {},                         returns: '{paused:false}' },
  { cmd: 'pause',     args: {},                         returns: '{paused:true}' },
  { cmd: 'toggle',    args: {},                         returns: '{paused}' },
  { cmd: 'camera',    args: { theta: 0, phi: 0, dist: 6.4 }, returns: 'camera',
    about: 'orbit camera. any subset of theta/phi/dist.' },
  { cmd: 'still',     args: { aspect: '1:1', longEdge: 1920, download: true, as: 'blob|dataurl' },
    returns: 'blob or {name,mime,width,height,data}',
    about: 'render a still. as=dataurl for agents that cannot take a blob.' },
  { cmd: 'video',     args: { aspect: '1:1', longEdge: 1080, duration: 8, fps: 60, download: true },
    returns: 'blob',
    about: 'realtime clip. the tab must stay visible.' },
  { cmd: 'hide',      args: {},                         returns: '{ui:false}', about: 'hide chrome for a clean capture.' },
  { cmd: 'show',      args: {},                         returns: '{ui:true}' },
  { cmd: 'deep',      args: { on: true },               returns: '{deep}', about: 'open/close the observatory.' },
  { cmd: 'gallery',   args: { on: true },               returns: '{gallery}' },
  { cmd: 'power',     args: { mode: 'low|full' },       returns: '{power}',
    about: 'low = iGPU / laptop. full = every theorem. persists.' },
  { cmd: 'url',       args: { full: false },            returns: '{url}', about: 'shareable URL of the current look.' },
  { cmd: 'save',      args: { name: 'optional' },       returns: 'look', about: 'bookmark current look to localStorage.' },
  { cmd: 'looks',     args: {},                         returns: 'saved looks' },
  { cmd: 'load',      args: { id: 'look-id' },          returns: 'describe()' },
  { cmd: 'deleteLook',args: { id: 'look-id' },          returns: '{ok}' },
];

export function buildCatalog() {
  return {
    protocol: PROTOCOL,
    version: VERSION,
    engines: ENGINES.map((id) => ({ id })),
    shapes: SHAPES.map((id) => ({ id })),
    palettes: PALETTES.map((p, i) => ({ index: i, id: p.id, name: p.name })),
    families: FAMILIES,
    aspects: Object.keys(ASPECTS),
    presets: PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      family: p.family,
      line: p.line,
      seed: p.seed,
      engine: p.params.engine,
    })),
    commands: COMMANDS,
    fields: STATE_FIELDS,
  };
}

export function attachAPI({ get, set, renderer, ui }) {
  const listeners = new Map();

  function on(ev, fn) {
    if (!listeners.has(ev)) listeners.set(ev, new Set());
    listeners.get(ev).add(fn);
    return () => listeners.get(ev)?.delete(fn);
  }
  function emit(ev, data) {
    listeners.get(ev)?.forEach((fn) => { try { fn(data); } catch (e) { console.warn(e); } });
    try {
      window.dispatchEvent(new CustomEvent('tripmind:' + ev, { detail: data }));
    } catch {}
  }

  function current() { return get(); }

  function describe(s = current()) {
    const p = presetById(s.preset);
    const pal = PALETTES[((s.palette % PALETTES.length) + PALETTES.length) % PALETTES.length];
    const prose = [
      `${p.name}. ${p.line}`,
      `engine ${s.engine}` + (s.engine === 'hybrid' || s.mix > 0.05 ? ` / ${s.engineB}` : ''),
      `seed ${s.seed}`,
      `intensity ${fmt(s.intensity)} · tempo ${fmt(s.tempo)} · heat ${fmt(s.heat)} · bloom ${fmt(s.bloom)}`,
      `palette ${pal.name}`,
    ].join(' ');
    return {
      protocol: PROTOCOL,
      version: VERSION,
      preset: { id: p.id, name: p.name, family: p.family, line: p.line },
      engine: s.engine,
      engineB: s.engineB,
      seed: s.seed,
      palette: { index: s.palette, id: pal.id, name: pal.name },
      sliders: {
        intensity: s.intensity, tempo: s.tempo, heat: s.heat, bloom: s.bloom,
      },
      camera: { ...renderer.cam },
      paused: !!renderer.paused,
      fps: renderer.fps,
      url: shareURL(s),
      prose,
      state: cloneState(s),
    };
  }

  function commit(next, reason = 'set') {
    const prev = current();
    const rebuild = [...REBUILD].some((k) => next[k] !== prev[k]);
    set(next);
    if (rebuild) {
      renderer.setSeed(next.seed);
      renderer.rebuildParticles(next);
    } else if (next.engine === 'field' && prev.engine !== 'field') {
      renderer.rebuildParticles(next);
    }
    ui.paint();
    const snap = describe(next);
    emit('state', snap);
    emit('change', { reason, ...snap });
    return snap;
  }

  function patch(partial = {}) {
    const next = { ...current() };
    for (const [k, v] of Object.entries(partial)) {
      if (v === undefined) continue;
      if (!(k in DEFAULTS) && k !== 'preset') continue;
      next[k] = coerce(k, v);
    }
    return commit(next, 'patch');
  }

  function coerce(k, v) {
    const spec = STATE_FIELDS[k];
    if (!spec) return v;
    if (spec.type === 'number' || spec.type === 'int') {
      let n = +v;
      if (!Number.isFinite(n)) n = DEFAULTS[k];
      if (spec.min != null) n = Math.max(spec.min, n);
      if (spec.max != null) n = Math.min(spec.max, n);
      return spec.type === 'int' ? n | 0 : n;
    }
    if (spec.type === 'bool') return !!v && v !== 'false' && v !== '0';
    if (spec.type === 'hex') return String(v).replace(/[^0-9a-f]/gi, '').slice(0, 8).toLowerCase();
    if (spec.type === 'enum') {
      const s = String(v);
      return spec.values.includes(s) ? s : DEFAULTS[k];
    }
    return v;
  }

  async function exec(cmd, args = {}) {
    const c = String(cmd || '').trim().toLowerCase();
    try {
      const data = await run(c, args || {});
      emit('command', { cmd: c, args, ok: true });
      return { ok: true, cmd: c, data };
    } catch (err) {
      const error = String(err.message || err);
      emit('command', { cmd: c, args, ok: false, error });
      return { ok: false, cmd: c, error };
    }
  }

  async function run(cmd, a) {
    switch (cmd) {
      case 'help':
        return { protocol: PROTOCOL, version: VERSION, commands: COMMANDS, hint: 'call describe, then preset or set.' };
      case 'schema':
        return { fields: STATE_FIELDS, defaults: DEFAULTS };
      case 'catalog': {
        const cat = buildCatalog();
        if (a.family) cat.presets = cat.presets.filter((p) => p.family === a.family);
        return cat;
      }
      case 'describe':
      case 'status':
        return describe();
      case 'get':
      case 'state':
        return cloneState(current());
      case 'set':
      case 'patch':
        return patch(a.state || a);
      case 'reset':
        return commit(applyPreset(cloneState(DEFAULTS), presetById(current().preset)), 'reset');
      case 'preset':
      case 'applypreset': {
        const id = a.id || a.preset || a.name;
        const p = findPreset(id);
        if (!p) throw new Error(`unknown preset: ${id}`);
        return commit(applyPreset(current(), p, a.seed ? { seed: a.seed } : {}), 'preset');
      }
      case 'next':
        return commit(applyPreset(current(), nextPreset(current().preset, 1)), 'next');
      case 'prev':
      case 'previous':
        return commit(applyPreset(current(), nextPreset(current().preset, -1)), 'prev');
      case 'engine':
      case 'setengine':
        return patch({ engine: a.name || a.engine || a.id, engineB: a.b || a.engineB });
      case 'seed':
      case 'setseed':
        return patch({ seed: a.hex || a.seed || randomSeed() });
      case 'randomize':
      case 'random':
      case 'newseed':
        return patch({ seed: randomSeed() });
      case 'play':
        renderer.paused = false;
        return { paused: false };
      case 'pause':
        renderer.paused = true;
        return { paused: true };
      case 'toggle':
        renderer.paused = !renderer.paused;
        return { paused: renderer.paused };
      case 'camera': {
        if (a.theta != null) renderer.cam.theta = +a.theta;
        if (a.phi != null) renderer.cam.phi = +a.phi;
        if (a.dist != null) renderer.cam.dist = Math.max(2.6, Math.min(14, +a.dist));
        if (a.recenter) { renderer.cam.theta = 0.35; renderer.cam.phi = 0.18; renderer.cam.dist = 6.4; }
        return { ...renderer.cam };
      }
      case 'still':
      case 'capture':
      case 'screenshot': {
        pulse();
        const res = await captureStill(renderer, current(), {
          aspect: a.aspect || '1:1',
          longEdge: +(a.longEdge || a.size || 1920),
          format: a.format || 'image/png',
          download: a.download !== false && a.as !== 'dataurl',
          as: a.as || (a.download === false ? 'dataurl' : 'blob'),
        });
        if (res && res.data) return res;
        return { ok: true, downloaded: true };
      }
      case 'video':
      case 'record':
      case 'clip': {
        pulse();
        await captureVideo(renderer, current(), {
          aspect: a.aspect || '1:1',
          longEdge: +(a.longEdge || a.size || 1080),
          duration: +(a.duration || a.seconds || 8),
          fps: +(a.fps || 60),
          download: a.download !== false,
        });
        return { ok: true, downloaded: true };
      }
      case 'hide':
        document.body.classList.add('ui-hidden');
        return { ui: false };
      case 'show':
        document.body.classList.remove('ui-hidden');
        return { ui: true };
      case 'deep':
        ui.setDeep?.(a.on !== false && a.on !== 'false');
        return { deep: true };
      case 'easy':
        ui.setDeep?.(false);
        return { deep: false };
      case 'power':
      case 'lite': {
        const mode = String(a.mode || a.power || (a.low === false ? 'full' : 'low'));
        const next = window.__tripmindApplyPower
          ? window.__tripmindApplyPower(mode === 'full' || mode === 'high' ? 'full' : 'low')
          : renderer.setPower(mode);
        return { power: next };
      }
      case 'gallery': {
        const el = document.getElementById('gallery');
        const on = a.on == null ? !el.classList.contains('open') : !!a.on;
        el.classList.toggle('open', on);
        return { gallery: on };
      }
      case 'url':
      case 'share':
        return { url: shareURL(current(), { full: !!a.full }) };
      case 'save':
      case 'savelook':
        return saveLook(a.name, current());
      case 'looks':
      case 'listlooks':
        return listLooks();
      case 'load':
      case 'loadlook': {
        const look = listLooks().find((l) => l.id === a.id || l.name === a.name);
        if (!look) throw new Error('look not found');
        return commit({ ...current(), ...look.state }, 'load');
      }
      case 'deletelook': {
        const looks = listLooks().filter((l) => l.id !== a.id);
        localStorage.setItem('tripmind:looks', JSON.stringify(looks));
        return { ok: true, looks };
      }
      default:
        throw new Error(`unknown command: ${cmd}. call help.`);
    }
  }

  function findPreset(id) {
    if (!id) return null;
    const s = String(id).toLowerCase();
    return PRESETS.find((p) => p.id === s)
      || PRESETS.find((p) => p.name.toLowerCase() === s)
      || PRESETS.find((p) => p.id.includes(s) || p.name.toLowerCase().includes(s));
  }

  function pulse() {
    document.body.classList.add('agent-live');
    setTimeout(() => document.body.classList.remove('agent-live'), 900);
  }

  const api = {
    version: VERSION,
    protocol: PROTOCOL,
    ready: true,
    help: () => exec('help'),
    schema: () => exec('schema'),
    catalog: (family) => exec('catalog', { family }),
    describe: () => describe(),
    getState: () => cloneState(current()),
    setState: (partial) => patch(partial),
    patch,
    applyPreset: (id, extra) => exec('preset', { id, ...extra }),
    listPresets: (family) => buildCatalog().presets.filter((p) => !family || p.family === family),
    listEngines: () => [...ENGINES],
    setEngine: (name, b) => exec('engine', { name, b }),
    setSeed: (hex) => exec('seed', { hex }),
    randomSeed: () => exec('randomize'),
    next: () => exec('next'),
    prev: () => exec('prev'),
    play: () => exec('play'),
    pause: () => exec('pause'),
    togglePause: () => exec('toggle'),
    camera: (o) => exec('camera', o),
    still: (o) => exec('still', o),
    video: (o) => exec('video', o),
    shareURL: (o) => shareURL(current(), o),
    exec,
    on,
    off: (ev, fn) => listeners.get(ev)?.delete(fn),
    renderer,
    ui,
    get,
    set,
    _index: () => presetIndex(current().preset),
  };

  window.TRIPMIND = api;

  window.addEventListener('message', async (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== 'tripmind') return;
    pulse();
    const result = await exec(msg.cmd || msg.command, msg.args || msg.params || {});
    const reply = { type: 'tripmind:result', id: msg.id, ...result };
    try { ev.source?.postMessage(reply, ev.origin === 'null' ? '*' : ev.origin); } catch {
      ev.source?.postMessage(reply, '*');
    }
  });

  emit('ready', describe());
  return api;
}

function fmt(v) { return (+v).toFixed(2); }

function listLooks() {
  try { return JSON.parse(localStorage.getItem('tripmind:looks') || '[]'); } catch { return []; }
}
function saveLook(name, state) {
  const looks = listLooks();
  const look = {
    id: 'look-' + Date.now().toString(36),
    name: name || presetById(state.preset).name + ' ' + state.seed,
    t: Date.now(),
    state: cloneState(state),
  };
  looks.unshift(look);
  localStorage.setItem('tripmind:looks', JSON.stringify(looks.slice(0, 64)));
  return look;
}

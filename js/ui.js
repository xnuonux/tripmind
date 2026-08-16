import { PRESETS, FAMILIES, presetById, nextPreset } from './presets.js';
import { ENGINES, SHAPES, applyPreset, persist, randomSeed } from './state.js';
import { PALETTES } from './palettes.js';
import { startAudio, stopAudio, audio } from './audio.js';
import { captureStill, captureVideo, ASPECTS } from './capture.js';

const $ = (id) => document.getElementById(id);

export function bindUI(ctx) {
  const { get, set, renderer } = ctx;
  let deep = false;
  let recCancel = false;

  function state() { return get(); }

  function paint() {
    const s = state();
    const p = presetById(s.preset);
    $('preset-name').textContent = p.name;
    $('preset-family').textContent = p.family;
    $('preset-line').textContent = p.line;
    $('hud-seed').textContent = s.seed;
    $('hud-engine').textContent = s.engine;
    $('seed').value = s.seed;
    setSlider('intensity', s.intensity);
    setSlider('tempo', s.tempo);
    setSlider('heat', s.heat);
    setSlider('bloom', s.bloom);
    $('mode-easy').classList.toggle('on', !deep);
    $('mode-deep').classList.toggle('on', deep);
    $('deep').classList.toggle('open', deep);
    $('dock').classList.toggle('hidden', deep);
    document.body.classList.toggle('deep-open', deep);

    // deep fields
    $('d-engine').value = s.engine;
    $('d-engineB').value = s.engineB;
    $('d-shape').value = s.shape;
    $('d-palette').value = String(s.palette);
    setSlider('d-kaleid', s.kaleid);
    setSlider('d-segments', s.segments);
    setSlider('d-warp', s.warpAmt);
    setSlider('d-noise', s.noise);
    setSlider('d-trail', s.trail);
    setSlider('d-grain', s.grain);
    setSlider('d-ca', s.ca);
    setSlider('d-crt', s.crt);
    setSlider('d-mix', s.mix);
    setSlider('d-spring', s.spring);
    setSlider('d-orbit', s.orbit);
    setSlider('d-particles', s.particles);
    setSlider('d-morph', s.morph);
    $('d-rotate').checked = !!s.autoRotate;
    const dur = $('r-dur');
    if (dur && $('r-dur-v')) $('r-dur-v').textContent = dur.value + 's';
    const pwr = $('power-btn');
    if (pwr) {
      pwr.classList.toggle('on', renderer.power === 'low');
      pwr.textContent = renderer.power === 'low' ? 'low power' : 'full gpu';
    }
    persist(s);
    paintGallery(s);
  }

  function setSlider(id, v) {
    const el = $(id);
    if (!el) return;
    if (String(el.value) !== String(v)) el.value = v;
    const lab = $(id + '-v');
    if (lab) lab.textContent = formatVal(id, v);
  }

  function formatVal(id, v) {
    v = +v;
    if (id.includes('segments') || id.includes('particles') || id === 'd-palette') return String(v | 0);
    if (id.includes('spring') || id.includes('orbit')) return v.toFixed(2);
    return v.toFixed(2);
  }

  function paintGallery(s) {
    const root = $('gallery-list');
    if (!root.dataset.built) {
      root.innerHTML = '';
      for (const fam of FAMILIES) {
        const h = document.createElement('div');
        h.className = 'gal-fam';
        h.innerHTML = `<span>${fam.label}</span><i>${fam.hint}</i>`;
        root.appendChild(h);
        const grid = document.createElement('div');
        grid.className = 'gal-grid';
        for (const pr of PRESETS.filter((x) => x.family === fam.id)) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'gal-item';
          b.dataset.id = pr.id;
          b.innerHTML = `<b>${pr.name}</b><span>${pr.params.engine}</span>`;
          b.addEventListener('click', () => {
            set(applyPreset(state(), pr));
            renderer.setSeed(get().seed);
            renderer.rebuildParticles(get());
            closeGallery();
            paint();
          });
          grid.appendChild(b);
        }
        root.appendChild(grid);
      }
      root.dataset.built = '1';
    }
    root.querySelectorAll('.gal-item').forEach((el) => {
      el.classList.toggle('on', el.dataset.id === s.preset);
    });
  }

  function goPreset(dir) {
    const p = nextPreset(state().preset, dir);
    set(applyPreset(state(), p));
    renderer.setSeed(get().seed);
    renderer.rebuildParticles(get());
    paint();
  }

  function openGallery() { $('gallery').classList.add('open'); }
  function closeGallery() { $('gallery').classList.remove('open'); }

  $('prev').onclick = () => goPreset(-1);
  $('next').onclick = () => goPreset(1);
  $('gallery-btn').onclick = openGallery;
  $('gallery-close').onclick = closeGallery;
  $('gallery').addEventListener('click', (e) => {
    if (e.target.id === 'gallery') closeGallery();
  });

  $('mode-easy').onclick = () => { deep = false; paint(); };
  $('mode-deep').onclick = () => { deep = true; paint(); };

  for (const id of ['intensity', 'tempo', 'heat', 'bloom']) {
    $(id).addEventListener('input', (e) => {
      set({ ...state(), [id]: +e.target.value });
      paint();
    });
  }

  $('seed').addEventListener('change', (e) => {
    const seed = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 8).toLowerCase() || randomSeed();
    set({ ...state(), seed });
    renderer.setSeed(seed);
    renderer.rebuildParticles(get());
    paint();
  });
  $('rand').onclick = () => {
    const seed = randomSeed();
    set({ ...state(), seed });
    renderer.setSeed(seed);
    renderer.rebuildParticles(get());
    paint();
  };

  const deepMap = {
    'd-engine': (v) => ({ engine: v }),
    'd-engineB': (v) => ({ engineB: v }),
    'd-shape': (v) => ({ shape: v }),
    'd-palette': (v) => ({ palette: +v }),
    'd-kaleid': (v) => ({ kaleid: +v }),
    'd-segments': (v) => ({ segments: +v }),
    'd-warp': (v) => ({ warpAmt: +v }),
    'd-noise': (v) => ({ noise: +v }),
    'd-trail': (v) => ({ trail: +v }),
    'd-grain': (v) => ({ grain: +v }),
    'd-ca': (v) => ({ ca: +v }),
    'd-crt': (v) => ({ crt: +v }),
    'd-mix': (v) => ({ mix: +v }),
    'd-spring': (v) => ({ spring: +v }),
    'd-orbit': (v) => ({ orbit: +v }),
    'd-particles': (v) => ({ particles: +v }),
    'd-morph': (v) => ({ morph: +v }),
  };
  for (const [id, fn] of Object.entries(deepMap)) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener('input', (e) => {
      const next = { ...state(), ...fn(e.target.value) };
      set(next);
      if (id === 'd-shape' || id === 'd-particles') renderer.rebuildParticles(next);
      paint();
    });
  }
  $('d-rotate').onchange = (e) => { set({ ...state(), autoRotate: e.target.checked }); paint(); };
  $('r-dur').addEventListener('input', () => {
    $('r-dur-v').textContent = $('r-dur').value + 's';
  });

  $('power-btn')?.addEventListener('click', () => {
    const next = renderer.power === 'low' ? 'full' : 'low';
    window.__tripmindApplyPower?.(next);
  });

  $('fs-btn').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  $('hide-btn').onclick = () => document.body.classList.toggle('ui-hidden');

  $('still-btn').onclick = () => easyStill(+$('r-size')?.value || 1920);
  $('still4k-btn').onclick = () => easyStill(3840);
  async function easyStill(edge) {
    const s = state();
    const aspect = $('r-aspect')?.value || '1:1';
    await captureStill(renderer, s, { aspect, longEdge: edge });
  }

  let recording = false;
  async function runRecord(duration, longEdge) {
    if (recording) return;
    recording = true;
    recCancel = false;
    $('rec-overlay').classList.add('show');
    const s = state();
    const aspect = $('r-aspect')?.value || '16:9';
    const fps = +($('r-fps')?.value || 60);
    try {
      await captureVideo(renderer, s, {
        aspect,
        longEdge: longEdge || +($('r-size')?.value || 1920),
        fps,
        duration,
      }, {
        cancelled: () => recCancel,
        onProgress: ({ pct, t, duration: d }) => {
          $('rec-bar').style.width = (pct * 100).toFixed(1) + '%';
          $('rec-pct').textContent = Math.round(pct * 100) + '%';
          $('rec-time').textContent = `${t.toFixed(1)}s / ${d.toFixed(0)}s`;
        },
      });
    } catch (err) {
      console.error(err);
      $('rec-phase').textContent = String(err.message || err);
    }
    $('rec-overlay').classList.remove('show');
    recording = false;
  }
  $('clip8').onclick = () => runRecord(8);
  $('clip15').onclick = () => runRecord(15);
  $('record-btn').onclick = () => runRecord(+$('r-dur').value || 12);
  $('rec-cancel').onclick = () => { recCancel = true; };

  $('mic-btn').onclick = async () => {
    if (audio.enabled) {
      await stopAudio();
      $('mic-btn').classList.remove('on');
      set({ ...state(), audioOn: false });
    } else {
      try {
        await startAudio('mic');
        audio.amount = state().audioAmt;
        $('mic-btn').classList.add('on');
        set({ ...state(), audioOn: true });
      } catch (e) {
        console.warn(e);
      }
    }
  };
  $('a-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await startAudio('file', f);
    audio.amount = state().audioAmt;
    $('mic-btn').classList.add('on');
    set({ ...state(), audioOn: true });
  };

  // populate selects
  const fill = (id, items, labelFn) => {
    const el = $(id);
    el.innerHTML = items.map((it, i) => {
      const v = typeof it === 'string' ? it : it.id;
      const lab = labelFn ? labelFn(it, i) : v;
      return `<option value="${v}">${lab}</option>`;
    }).join('');
  };
  fill('d-engine', ENGINES);
  fill('d-engineB', ENGINES);
  fill('d-shape', SHAPES);
  fill('d-palette', PALETTES, (p, i) => `${i} · ${p.name}`);

  // keys
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === '[') goPreset(-1);
    if (k === 'arrowright' || k === ']') goPreset(1);
    if (k === ' ') { e.preventDefault(); renderer.paused = !renderer.paused; }
    if (k === 'e') { deep = !deep; paint(); }
    if (k === 'g') { $('gallery').classList.toggle('open'); }
    if (k === 'f') $('fs-btn').click();
    if (k === 'h') $('hide-btn').click();
    if (k === 's' && !e.metaKey && !e.ctrlKey) $('still-btn').click();
    if (k === 'r' && !e.metaKey && !e.ctrlKey) $('clip8').click();
    if (k === 'n') $('rand').click();
    if (k === 'l') $('power-btn')?.click();
    if (k === 'escape') {
      closeGallery();
      if (deep) { deep = false; paint(); }
    }
  });

  paint();
  return {
    paint,
    goPreset,
    setDeep(v) { deep = !!v; paint(); },
    getDeep: () => deep,
    hideUI() { document.body.classList.add('ui-hidden'); },
    showUI() { document.body.classList.remove('ui-hidden'); },
  };
}

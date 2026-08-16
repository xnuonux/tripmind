// Hardware-aware power profiles.
// low  — first paint on an iGPU. cheap shader, no GPGPU, dpr ≤ 1, no bloom.
// full — every theorem, particles, reaction-diffusion, HDR bloom.

export function readQueryPower() {
  try {
    const q = new URLSearchParams(location.search);
    const p = (q.get('power') || q.get('lite') || '').toLowerCase();
    if (p === 'low' || p === 'lite' || p === '1') return 'low';
    if (p === 'full' || p === 'high' || p === '0') return 'full';
  } catch {}
  return null;
}

export function readSavedPower() {
  try {
    const s = localStorage.getItem('tripmind:power');
    if (s === 'low' || s === 'full') return s;
  } catch {}
  return null;
}

export function savePower(mode) {
  try { localStorage.setItem('tripmind:power', mode); } catch {}
}

export function sniffGPU() {
  const info = { renderer: '', vendor: '', cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0 };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { powerPreference: 'low-power' });
    if (!gl) return info;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      info.renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      info.vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '');
    } else {
      info.renderer = String(gl.getParameter(gl.RENDERER) || '');
    }
  } catch {}
  return info;
}

export function guessPower() {
  const q = readQueryPower();
  if (q) return q;
  const saved = readSavedPower();
  if (saved) return saved;

  const { renderer, cores, mem } = sniffGPU();
  const g = renderer.toLowerCase();
  const weakGPU = /intel|iris|uhd|hd graphics|mali|adreno [1-6]|apple gpu|swiftshader|llvmpipe|microsoft basic|vega 3|radeon graphics(?!.*xt)/.test(g);
  const weakBox = (cores && cores <= 4) || (mem && mem <= 4);
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  return (weakGPU || weakBox || mobile) ? 'low' : 'full';
}

export function dprFor(power) {
  const dpr = window.devicePixelRatio || 1;
  if (power === 'low') return Math.min(dpr, 1);
  return Math.min(dpr, 1.75);
}

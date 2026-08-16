// Home positions on real manifolds.
// Superformula (Gielis), torus knots, Lissajous, Thomas attractor,
// spherical-harmonic shells, and the classic surfaces.

function lerp(a, b, t) { return a + (b - a) * t; }

function superR(theta, m, n1, n2, n3) {
  const t = (m * theta) / 4;
  const a = Math.pow(Math.abs(Math.cos(t)), n2) + Math.pow(Math.abs(Math.sin(t)), n3);
  return Math.pow(Math.max(a, 1e-4), -1 / Math.max(n1, 0.05));
}

function plm(l, m, cp, sp) {
  if (l === 1 && m === 0) return cp;
  if (l === 1 && m === 1) return sp;
  if (l === 2 && m === 0) return 0.5 * (3 * cp * cp - 1);
  if (l === 2 && m === 1) return 3 * cp * sp;
  if (l === 2 && m === 2) return 3 * sp * sp;
  if (l === 3 && m === 0) return 0.5 * cp * (5 * cp * cp - 3);
  if (l === 3 && m === 1) return 1.5 * (5 * cp * cp - 1) * sp;
  if (l === 3 && m === 2) return 15 * cp * sp * sp;
  if (l === 3 && m === 3) return 15 * sp * sp * sp;
  if (l === 4 && m === 0) return (35 * cp ** 4 - 30 * cp * cp + 3) * 0.125;
  if (l === 4 && m === 2) return 7.5 * (7 * cp * cp - 1) * sp * sp;
  if (l === 5 && m === 3) return 52.5 * (9 * cp * cp - 1) * sp ** 3;
  return cp;
}

export function rollShape(shape, rand) {
  switch (shape) {
    case 'superformula':
      return {
        kind: 'superformula',
        mA: [3, 4, 5, 6, 7, 8, 10, 12][(rand() * 8) | 0],
        mB: [3, 4, 5, 6, 7, 8][(rand() * 6) | 0],
        n1A: lerp(0.25, 1.8, rand()),
        n2A: lerp(0.4, 5.0, rand()),
        n3A: lerp(0.4, 5.0, rand()),
        n1B: lerp(0.25, 1.8, rand()),
        n2B: lerp(0.4, 5.0, rand()),
        n3B: lerp(0.4, 5.0, rand()),
      };
    case 'torusknot':
      return {
        kind: 'torusknot',
        p: [2, 3, 4, 5][(rand() * 4) | 0],
        q: [2, 3, 5, 7][(rand() * 4) | 0],
        R: 0.85,
        r: 0.32,
      };
    case 'lissajous':
      return {
        kind: 'lissajous',
        a: 1 + ((rand() * 4) | 0),
        b: 2 + ((rand() * 4) | 0),
        c: 1 + ((rand() * 3) | 0),
        dx: rand() * Math.PI,
        dy: rand() * Math.PI,
      };
    case 'attractor':
      return { kind: 'attractor', b: 0.15 + rand() * 0.08 };
    case 'sphericalharmonic':
    case 'orbital':
      return {
        kind: 'sphericalharmonic',
        l: 2 + ((rand() * 4) | 0),
        m: 0,
      };
    default:
      return { kind: shape };
  }
}

function nearby(params, rand) {
  const p = { ...params };
  if (p.kind === 'superformula') {
    p.n1A = Math.max(0.2, p.n1A + (rand() - 0.5) * 0.1);
    p.n2A = Math.max(0.3, p.n2A + (rand() - 0.5) * 0.3);
    p.n3A = Math.max(0.3, p.n3A + (rand() - 0.5) * 0.3);
  } else if (p.kind === 'torusknot') {
    p.r = Math.max(0.2, p.r + (rand() - 0.5) * 0.04);
  } else if (p.kind === 'lissajous') {
    p.dx += (rand() - 0.5) * 0.2;
  }
  return p;
}

export function sampleShape(params, u, v, r1, r2) {
  const k = params.kind || params;
  switch (k) {
    case 'superformula': {
      const theta = u * Math.PI * 2 - Math.PI;
      const phi = v * Math.PI;
      const rt = superR(theta, params.mA, params.n1A, params.n2A, params.n3A);
      const rp = superR(phi, params.mB, params.n1B, params.n2B, params.n3B);
      const rad = Math.min(rt * rp, 2.4) * 0.85;
      const sp = Math.sin(phi);
      return [rad * sp * Math.cos(theta), rad * Math.cos(phi), rad * sp * Math.sin(theta)];
    }
    case 'torusknot': {
      const t = u * Math.PI * 2;
      const { p, q, R, r } = params;
      const ct = Math.cos(q * t), st = Math.sin(q * t);
      return [
        (R + r * ct) * Math.cos(p * t),
        r * st,
        (R + r * ct) * Math.sin(p * t),
      ];
    }
    case 'lissajous': {
      const t = u * Math.PI * 2;
      return [
        Math.sin(params.a * t + params.dx) * 1.05,
        Math.sin(params.b * t + params.dy) * 1.05,
        Math.sin(params.c * t) * 1.05,
      ];
    }
    case 'attractor': {
      // Thomas' cyclically symmetric attractor, iterated from a seed
      let x = (u - 0.5) * 0.4, y = (v - 0.5) * 0.4, z = (r1 - 0.5) * 0.4;
      const b = params.b || 0.19;
      for (let i = 0; i < 40; i++) {
        const nx = Math.sin(y) - b * x;
        const ny = Math.sin(z) - b * y;
        const nz = Math.sin(x) - b * z;
        x += nx * 0.12; y += ny * 0.12; z += nz * 0.12;
      }
      return [x * 0.55, y * 0.55, z * 0.55];
    }
    case 'sphericalharmonic': {
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const l = params.l || 3;
      const m = Math.min(params.m || 1, l);
      let Y = plm(l, m, cp, sp);
      if (m > 0) Y *= Math.cos(m * theta);
      const mag = Math.min(Math.abs(Y), 3);
      const rad = 0.45 + 0.85 * mag / 3;
      return [rad * sp * Math.cos(theta), rad * cp, rad * sp * Math.sin(theta)];
    }
    case 'torus': {
      const a = u * Math.PI * 2, b = v * Math.PI * 2;
      const R = 0.85, r = 0.32;
      return [(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)];
    }
    case 'sphere': {
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const rad = 1.05;
      return [rad * Math.sin(phi) * Math.cos(theta), rad * Math.cos(phi), rad * Math.sin(phi) * Math.sin(theta)];
    }
    case 'rings': {
      const ring = Math.min(3, (u * 4) | 0);
      const a = v * Math.PI * 2;
      const rad = 0.35 + ring * 0.32;
      const y = (ring - 1.5) * 0.12;
      return [rad * Math.cos(a), y, rad * Math.sin(a)];
    }
    case 'knot': {
      const t = u * Math.PI * 2;
      return [
        Math.sin(t) + 2 * Math.sin(2 * t),
        Math.cos(t) - 2 * Math.cos(2 * t),
        -Math.sin(3 * t),
      ].map((x) => x * 0.38);
    }
    case 'disc': {
      const a = u * Math.PI * 2;
      const rad = Math.sqrt(v) * 1.2;
      return [rad * Math.cos(a), (r1 - 0.5) * 0.04, rad * Math.sin(a)];
    }
    case 'helix': {
      const t = u * Math.PI * 6;
      const arm = v > 0.5 ? 1 : -1;
      return [0.55 * Math.cos(t), (u - 0.5) * 2.1, 0.55 * Math.sin(t + arm * Math.PI)];
    }
    case 'cube': {
      const face = (u * 6) | 0;
      const x = v * 2 - 1, y = r1 * 2 - 1;
      const s = 0.85;
      if (face === 0) return [s, x * s, y * s];
      if (face === 1) return [-s, x * s, y * s];
      if (face === 2) return [x * s, s, y * s];
      if (face === 3) return [x * s, -s, y * s];
      if (face === 4) return [x * s, y * s, s];
      return [x * s, y * s, -s];
    }
    case 'cloud':
    default: {
      // Gaussian-ish ball via Box-Muller
      const a = u * Math.PI * 2;
      const z = v * 2 - 1;
      const r = Math.sqrt(Math.max(0, 1 - z * z)) * (0.4 + r2 * 0.9);
      return [r * Math.cos(a), z * (0.5 + r1 * 0.6), r * Math.sin(a)];
    }
  }
}

export function buildHomes(count, shape, rand) {
  const params = typeof shape === 'string' ? rollShape(shape, rand) : shape;
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const u = rand(), v = rand(), r1 = rand(), r2 = rand();
    const p = sampleShape(params, u, v, r1, r2);
    data[i * 4] = p[0];
    data[i * 4 + 1] = p[1];
    data[i * 4 + 2] = p[2];
    data[i * 4 + 3] = rand();
  }
  return { data, params };
}

export function buildHomesNearby(count, params, rand) {
  return buildHomes(count, nearby(params, rand), rand);
}

export const COUNT_LEVELS = [128, 192, 256, 320]; // squared → 16k / 37k / 65k / 102k
export function texSizeForLevel(level) {
  return COUNT_LEVELS[Math.max(0, Math.min(COUNT_LEVELS.length - 1, level | 0))];
}

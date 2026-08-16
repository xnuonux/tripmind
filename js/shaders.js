// TRIPMIND GLSL — WebGL2 / ES 300
// Real mathematics, not wallpaper: Gielis, Hopf, Gray-Scott, gyroids,
// spherical harmonics, thin-film interference, Kleinian inversions,
// Chladni, phyllotaxis, Mandelbox, curl noise.

export const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;

const float PI  = 3.141592653589793;
const float TAU = 6.283185307179586;
const float PHI = 1.618033988749895;
const float GA  = 2.399963229728653; // golden angle 2π/φ²
const float HBAR = 1.054571817e-1;   // scaled, for phase aesthetics

uniform vec2  uRes;
uniform float uTime;
uniform float uAspect;
uniform int   uEngine;
uniform int   uEngineB;
uniform float uIntensity;
uniform float uTempo;
uniform float uHeat;
uniform float uKaleid;
uniform float uSegments;
uniform float uWarp;
uniform float uNoise;
uniform float uMix;
uniform vec3  uPA, uPB, uPC, uPD;
uniform float uShift;
uniform float uBass, uMid, uTreble;
uniform float uSeed;
uniform float uFov;
uniform float uContrast;
uniform float uExposure;
uniform vec2  uCam;
uniform float uZoom;
uniform sampler2D uRD;

float hash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p){
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Value-noise + derivatives-free fBm (Quílez-adjacent)
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1,0,0));
  float n010 = hash31(i + vec3(0,1,0));
  float n110 = hash31(i + vec3(1,1,0));
  float n001 = hash31(i + vec3(0,0,1));
  float n101 = hash31(i + vec3(1,0,1));
  float n011 = hash31(i + vec3(0,1,1));
  float n111 = hash31(i + vec3(1,1,1));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}
float fbm(vec3 p){
  float a = 0.5, s = 0.0;
  for(int i=0;i<5;i++){
    s += a * vnoise(p);
    p = p * 2.02 + vec3(1.7, 3.1, 2.3);
    a *= 0.5;
  }
  return s;
}
float ridge(vec3 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){
    s += a * (1.0 - abs(vnoise(p)*2.0-1.0));
    p *= 2.07;
    a *= 0.5;
  }
  return s;
}
vec3 curlN(vec3 p){
  float e = 0.12;
  float n1 = vnoise(p + vec3(0,e,0));
  float n2 = vnoise(p - vec3(0,e,0));
  float n3 = vnoise(p + vec3(0,0,e));
  float n4 = vnoise(p - vec3(0,0,e));
  float n5 = vnoise(p + vec3(e,0,0));
  float n6 = vnoise(p - vec3(e,0,0));
  return normalize(vec3(n1-n2-n3+n4, n3-n4-n5+n6, n5-n6-n1+n2));
}

// IQ cosine palette
vec3 pal(float t){
  t = t + uShift + uHeat * 0.15 * sin(uTime * 0.07);
  return uPA + uPB * cos(TAU * (uPC * t + uPD));
}

vec2 rot2(vec2 p, float a){
  float c = cos(a), s = sin(a);
  return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
}
mat2 rm(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// Polar kaleidoscope — dihedral group D_n acting on the plane
vec2 kaleido(vec2 p, float n){
  n = max(n, 2.0);
  float a = atan(p.y, p.x);
  float r = length(p);
  float seg = TAU / n;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

vec2 applyKaleid(vec2 p){
  if(uKaleid < 0.001) return p;
  return mix(p, kaleido(p, uSegments), clamp(uKaleid, 0.0, 1.0));
}

// Gielis superformula radius
float superR(float theta, float m, float n1, float n2, float n3){
  float t = m * theta * 0.25;
  float a = pow(abs(cos(t)), n2) + pow(abs(sin(t)), n3);
  return pow(max(a, 1e-4), -1.0 / max(n1, 0.05));
}

// Associated-ish Legendre slices for hydrogenic |Y_lm|
float plm(int l, int m, float cp, float sp){
  if(l==1 && m==0) return cp;
  if(l==1 && m==1) return sp;
  if(l==2 && m==0) return 0.5*(3.0*cp*cp - 1.0);
  if(l==2 && m==1) return 3.0*cp*sp;
  if(l==2 && m==2) return 3.0*sp*sp;
  if(l==3 && m==0) return 0.5*cp*(5.0*cp*cp - 3.0);
  if(l==3 && m==1) return 1.5*(5.0*cp*cp - 1.0)*sp;
  if(l==3 && m==2) return 15.0*cp*sp*sp;
  if(l==3 && m==3) return 15.0*sp*sp*sp;
  if(l==4 && m==0) return (35.0*cp*cp*cp*cp - 30.0*cp*cp + 3.0)*0.125;
  if(l==4 && m==2) return 7.5*(7.0*cp*cp-1.0)*sp*sp;
  if(l==5 && m==3) return 52.5*(9.0*cp*cp-1.0)*sp*sp*sp;
  return cp;
}

// J0 Bessel via Taylor+asymptotic blend (good enough for rings)
float besselJ0(float x){
  x = abs(x);
  if(x < 4.0){
    float z = x * 0.5;
    float z2 = z*z;
    return 1.0 + z2*(-1.0 + z2*(0.25 + z2*(-0.027777 + z2*0.001736)));
  }
  return sqrt(2.0/(PI*max(x,0.001))) * cos(x - 0.785398);
}

// Thin-film interference. Optical path δ = 2 n d cosθ
// I(λ) ∝ sin²(2π δ / λ) — soap-bubble physics
vec3 thinFilm(float d, float ndotv){
  float delta = 2.0 * 1.33 * d * max(ndotv, 0.05);
  vec3 lam = vec3(0.65, 0.51, 0.44); // R,G,B μm-ish
  vec3 phase = TAU * delta / lam;
  vec3 I = sin(phase);
  I *= I;
  return I;
}

// Gyroid implicit (Schoen G) — triply periodic minimal surface
float gyroid(vec3 p){
  return sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
}

// Mandelbox DE (Hart, White, Chen)
float mandelbox(vec3 z, float scale){
  vec3 offset = z;
  float dr = 1.0;
  for(int i=0;i<8;i++){
    z = clamp(z, -1.0, 1.0) * 2.0 - z;          // box fold
    float r2 = dot(z,z);
    if(r2 < 0.5){ z *= 2.0; dr *= 2.0; }        // sphere fold
    else if(r2 < 1.0){ float k = 1.0/r2; z *= k; dr *= k; }
    z = z * scale + offset;
    dr = dr * abs(scale) + 1.0;
  }
  return length(z) / abs(dr);
}

// Chladni standing-wave residual
float chladni(vec2 p, float n, float m){
  return cos(n*PI*p.x)*cos(m*PI*p.y) - cos(m*PI*p.x)*cos(n*PI*p.y);
}

vec2 sceneUV(vec2 uv){
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  p -= uCam * 0.35;
  p /= max(uZoom, 0.15);
  p = applyKaleid(p);
  // domain warp — iterated, Quílez style
  float w = uWarp * (0.65 + uIntensity * 0.55);
  if(w > 0.001){
    vec3 q = vec3(p * (2.2 + uNoise * 2.0), uTime * uTempo * 0.11 + uSeed);
    vec2 w1 = vec2(fbm(q), fbm(q + vec3(5.2, 1.3, 2.8))) - 0.5;
    p += w1 * w * 1.35;
    vec2 w2 = vec2(fbm(q * 1.7 + vec3(w1, 0.0)), fbm(q * 1.7 + vec3(3.1, w1.yx))) - 0.5;
    p += w2 * w * 0.7;
  }
  return p;
}

// ── engines ─────────────────────────────────────────────

vec3 engWarp(vec2 p){
  float t = uTime * uTempo;
  float n = fbm(vec3(p * 2.4, t * 0.18 + uSeed));
  float n2 = fbm(vec3(p * 5.0 + n * 2.0, t * 0.09));
  float v = mix(n, n2, 0.45 + uNoise * 0.3);
  v += uBass * 0.18;
  vec3 col = pal(v * (0.85 + uHeat * 0.5) + t * 0.02);
  col *= 0.35 + v * (0.9 + uIntensity);
  // faint caustic ridges
  float r = ridge(vec3(p * 3.0, t * 0.12));
  col += pal(r + 0.3) * pow(r, 4.0) * 0.35 * uIntensity;
  return col;
}

vec3 engKaleid(vec2 p){
  float t = uTime * uTempo;
  // hyperbolic-ish tunnel: invert radius
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  vec2 tuv = vec2(a / PI, 0.35 / r + t * 0.22);
  // fold already applied; add a second polar fold for "nave"
  float cells = fbm(vec3(tuv * vec2(uSegments * 0.35, 3.0), t * 0.08));
  float ribs = pow(abs(sin(a * uSegments + t * 0.4)), 6.0);
  float glow = exp(-r * (1.4 - uIntensity * 0.6)) * (0.55 + uBass * 0.7);
  vec3 col = pal(cells + tuv.y * 0.15 + uShift);
  col *= 0.25 + cells * 1.1;
  col += pal(0.7 + ribs) * ribs * 0.45;
  col += pal(0.15) * glow;
  // event-horizon ring
  col += pal(0.9) * smoothstep(0.12, 0.0, abs(r - 0.22 - uMid * 0.05)) * 0.6;
  return col * (0.7 + uIntensity * 0.8);
}

vec3 engAbyss(vec2 p){
  float t = uTime * uTempo * 0.35;
  vec3 ro = vec3(0.0, 0.0, -2.6 + uCam.y);
  vec3 rd = normalize(vec3(p * (0.85 + uFov * 0.25), 1.35));
  rd.xz = rot2(rd.xz, t * 0.15 + uCam.x);
  rd.yz = rot2(rd.yz, 0.18);
  float travel = 0.0;
  vec3 acc = vec3(0.0);
  float glow = 0.0;
  for(int i=0;i<48;i++){
    vec3 q = ro + rd * travel;
    q.xy = rot2(q.xy, t * 0.2);
    q.z += t * 0.35;
    float g = gyroid(q * (1.35 + uNoise * 0.8));
    float mb = mandelbox(q * 0.55, -1.7 - uIntensity * 0.4);
    float d = mix(abs(g) * 0.35 - 0.02, mb, 0.55);
    float dens = smoothstep(0.18, 0.0, abs(d));
    float stepT = float(i) / 48.0;
    vec3 emit = pal(dens * 0.7 + stepT * 0.45 + q.z * 0.04);
    acc += emit * dens * 0.085 * (0.6 + uIntensity);
    glow += dens * 0.04;
    travel += mix(0.045, 0.12, clamp(d * 2.0, 0.0, 1.0));
    if(travel > 8.0) break;
  }
  acc += pal(0.2) * glow * 1.4;
  acc += pal(0.85) * exp(-length(p) * 2.2) * 0.25 * uIntensity;
  return acc;
}

vec3 engPhosphor(vec2 p){
  float t = uTime * uTempo;
  vec3 q = vec3(p * 2.2, t * 0.15 + uSeed);
  vec3 flow = curlN(q);
  float dye = fbm(q + flow * 1.8);
  dye = pow(dye, 1.2 - uIntensity * 0.4);
  vec3 col = pal(dye);
  col *= 0.2 + dye * 1.4;
  // scanline / aperture suggestion (full CRT is in composite)
  float scan = 0.92 + 0.08 * sin(p.y * uRes.y * 0.7);
  col *= scan;
  col += pal(dye + 0.4) * pow(dye, 3.0) * 0.5;
  return col;
}

vec3 engLattice(vec2 p){
  float t = uTime * uTempo;
  vec2 q = p * (1.6 + uNoise);
  float n = 3.0 + floor(mod(uSeed * 7.3, 5.0));
  float m = 4.0 + floor(mod(uSeed * 5.1, 6.0));
  n += uBass * 2.0;
  float ch = chladni(q + 0.5, n, m);
  float lines = smoothstep(0.08, 0.0, abs(ch));
  // Bessel radial rings — circular drum
  float bj = besselJ0(length(q) * (14.0 + uMid * 8.0) - t * 2.0);
  float rings = smoothstep(0.12, 0.0, abs(bj));
  // Lissajous overlay
  float lx = sin((n)*q.x + t * 0.7);
  float ly = sin((m)*q.y + t * 0.51);
  float lis = smoothstep(0.08, 0.0, abs(lx * 0.15 + ly * 0.15 + q.y*0.0));
  float field = max(lines, max(rings * 0.85, lis * 0.5));
  vec3 col = pal(0.35 + field * 0.5 + ch * 0.08);
  col *= 0.12 + field * (1.3 + uIntensity);
  col += pal(0.8) * lines * 0.55;
  return col;
}

vec3 engSoliton(vec2 uv){
  vec4 rd = texture(uRD, uv);
  float u = rd.r;
  float v = rd.g;
  float t = v * 1.4 + u * 0.2;
  vec3 col = pal(t * (0.8 + uHeat * 0.4));
  // organ edges — Turing fronts
  float edge = smoothstep(0.08, 0.0, abs(v - 0.28));
  col *= 0.15 + v * 1.6 * (0.5 + uIntensity);
  col += pal(0.9) * edge * 0.7;
  col += pal(0.1) * u * 0.15;
  return col;
}

vec3 engIris(vec2 p){
  float t = uTime * uTempo * 0.35;
  float r = length(p);
  float a = atan(p.y, p.x);
  // rose curve r = cos(kθ)
  float k = 2.0 + floor(mod(uSeed * 9.0, 7.0));
  float rose = abs(cos(k * a + t * 0.4));
  float petal = smoothstep(0.07, 0.0, abs(r - rose * (0.55 + uIntensity * 0.15)));
  // phyllotaxis dots
  float phy = 0.0;
  for(int i=0;i<24;i++){
    float fi = float(i);
    float ang = fi * GA + t * 0.15;
    float rad = 0.045 * sqrt(fi + 1.0) * (1.6 + uNoise);
    vec2 c = vec2(cos(ang), sin(ang)) * rad;
    phy += exp(-dot(p-c, p-c) * 420.0);
  }
  // pupil / vesica
  float pupil = smoothstep(0.16 + uBass*0.04, 0.10, r);
  float ring = smoothstep(0.03, 0.0, abs(r - 0.22 - 0.04*sin(a*6.0 + t)));
  // iris stroma
  float stroma = fbm(vec3(a * 1.2, r * 6.0, t * 0.2));
  vec3 col = pal(stroma * 0.5 + a / TAU + uShift);
  col *= 0.18 + stroma * 0.7;
  col *= smoothstep(1.1, 0.15, r);
  col += pal(0.85) * petal * 0.85;
  col += pal(0.2) * phy * 0.9;
  col += pal(0.95) * ring * 0.7;
  col = mix(col, vec3(0.0), pupil * 0.92);
  col += pal(0.7) * exp(-r * r * 8.0) * 0.15 * uIntensity;
  return col;
}

vec3 engPrism(vec2 p){
  float t = uTime * uTempo;
  float n = fbm(vec3(p * 3.2, t * 0.12));
  float n2 = fbm(vec3(p * 7.0 + n, t * 0.07));
  // thickness field — oil on water
  float d = 0.15 + n * 0.55 + n2 * 0.25;
  d += uBass * 0.08;
  float ndv = 0.35 + 0.65 * (1.0 - smoothstep(0.0, 1.2, length(p)));
  vec3 film = thinFilm(d * (0.4 + uHeat * 0.5), ndv);
  vec3 col = film * pal(n + uShift);
  col += pal(n2 + 0.5) * pow(n2, 2.0) * 0.4;
  // spectral edges
  float rim = pow(1.0 - abs(ndv * 2.0 - 1.0), 3.0);
  col += film * rim * 0.6 * uIntensity;
  col *= 0.45 + uIntensity * 0.85;
  return col;
}

vec3 engFilament(vec2 p){
  float t = uTime * uTempo;
  vec3 q = vec3(p * 2.6, t * 0.1 + uSeed);
  float rid = ridge(q);
  float rid2 = ridge(q * 1.8 + 4.0);
  float bolt = pow(rid, 7.0 - uIntensity * 2.5);
  float tendril = pow(rid2, 5.0);
  // Hopf-ish circling filaments
  float a = atan(p.y, p.x);
  float hop = pow(abs(sin(a * 3.0 + t + rid * 4.0)), 10.0) * exp(-length(p)*1.4);
  vec3 col = pal(rid * 0.6 + 0.1);
  col *= 0.08;
  col += pal(0.15) * bolt * 2.2;
  col += pal(0.7) * tendril * 0.8;
  col += pal(0.9) * hop * 1.1;
  // dielectric glow
  col += pal(0.4) * pow(rid, 2.0) * 0.18 * uIntensity;
  return col;
}

vec3 engOrbital(vec2 p){
  float t = uTime * uTempo * 0.25;
  // treat p as a slice through R³ — rotate the cut
  vec3 q = vec3(p * 1.7, 0.15 * sin(t));
  q.xy = rot2(q.xy, t * 0.3);
  q.xz = rot2(q.xz, t * 0.17);
  float r = length(q) + 1e-4;
  float theta = atan(q.y, q.x);
  float phi = acos(clamp(q.z / r, -1.0, 1.0));
  int l = 2 + int(mod(uSeed * 11.0, 4.0));
  int m = int(mod(uSeed * 7.0, float(l)+0.1));
  float Y = plm(l, m, cos(phi), sin(phi));
  if(m > 0) Y *= cos(float(m) * theta + t);
  // hydrogenic radial envelope R_nl ~ r^l e^{-r/n}
  float nq = float(l + 1);
  float R = pow(r, float(l)) * exp(-r * (2.2 / nq) * (1.4 - uIntensity * 0.4));
  float psi2 = Y * Y * R * R;           // |ψ|²
  float lobe = pow(clamp(psi2 * 8.0, 0.0, 4.0), 0.7);
  vec3 col = pal(0.2 + lobe * 0.55 + float(m) * 0.07);
  col *= 0.08 + lobe * (1.1 + uIntensity);
  // nodal planes
  col += pal(0.85) * smoothstep(0.04, 0.0, abs(Y)) * exp(-r) * 0.35;
  col += pal(0.95) * exp(-r * r * 6.0) * 0.2;
  return col;
}

vec3 engHopf(vec2 p){
  float t = uTime * uTempo * 0.3;
  // Stereographic S³ → R³, then Hopf map S³ → S²
  // Fiber through a point is a circle. We draw many fibers.
  vec3 acc = vec3(0.0);
  for(int i=0;i<18;i++){
    float fi = (float(i) + 0.5) / 18.0;
    float alp = fi * PI;
    float bet = fract(fi * PHI + uSeed) * TAU + t * 0.4;
    // point on S² (base)
    vec3 b = vec3(sin(alp)*cos(bet), sin(alp)*sin(bet), cos(alp));
    // a fiber: circles in R³ via stereographic of e^{iφ}(z1,z2)
    // simplified: torus-lying circle whose color is the base point
    float rad = 0.35 + 0.35 * b.z;
    vec2 c = b.xy * 0.7;
    // closest distance from p to that circle (in plane, then fake z)
    float d = abs(length(p - c) - rad);
    // rotate the circle a bit in time (fiber phase)
    float ph = t * (0.6 + fi) + fi * TAU;
    d = abs(length(rot2(p, ph * 0.15) - c) - rad);
    float line = exp(-d * (70.0 - uIntensity * 22.0));
    vec3 col = pal(fi + uShift + b.z * 0.2);
    acc += col * line;
  }
  acc += pal(0.5) * exp(-dot(p,p) * 2.5) * 0.12;
  return acc * (0.85 + uIntensity * 0.6);
}

vec3 engKlein(vec2 p){
  // Iterated circle inversion — Kleinian / Apollonian dust
  vec2 z = p * (1.15 + uZoom * 0.1);
  float t = uTime * uTempo * 0.15;
  z = rot2(z, t * 0.2);
  // three mutually tangent circles (Apollonian seed)
  vec2 c0 = vec2(0.0,  0.58);
  vec2 c1 = vec2(-0.50, -0.29);
  vec2 c2 = vec2( 0.50, -0.29);
  float r0 = 0.50, r1 = 0.50, r2 = 0.50;
  float trap = 1e5;
  float iter = 0.0;
  for(int i=0;i<18;i++){
    // invert in nearest circle
    float d0 = length(z - c0);
    float d1 = length(z - c1);
    float d2 = length(z - c2);
    float k0 = abs(d0 - r0);
    float k1 = abs(d1 - r1);
    float k2 = abs(d2 - r2);
    trap = min(trap, min(k0, min(k1, k2)));
    if(k0 <= k1 && k0 <= k2){
      z = c0 + (z - c0) * (r0 * r0) / max(d0 * d0, 1e-6);
    } else if(k1 <= k2){
      z = c1 + (z - c1) * (r1 * r1) / max(d1 * d1, 1e-6);
    } else {
      z = c2 + (z - c2) * (r2 * r2) / max(d2 * d2, 1e-6);
    }
    iter += 1.0;
  }
  float edge = exp(-trap * (40.0 + uIntensity * 30.0));
  vec3 col = pal(iter * 0.06 + trap * 2.0 + uShift);
  col *= 0.12 + edge * 1.6;
  col += pal(0.8) * edge * 0.7;
  // residual inversion dust
  col += pal(length(z)*0.15) * exp(-length(z)*0.8) * 0.15;
  return col;
}

vec3 engFieldBG(vec2 p){
  // quiet nebula under the particle layer
  float n = fbm(vec3(p * 1.4, uTime * uTempo * 0.05 + uSeed));
  vec3 col = pal(n * 0.4 + 0.05) * n * 0.22 * uIntensity;
  col += pal(0.7) * exp(-dot(p,p) * 1.8) * 0.08;
  return col;
}

vec3 renderEngineOnce(int id, vec2 p, vec2 uv){
  if(id==1) return engKaleid(p);
  if(id==2) return engWarp(p);
  if(id==3) return engAbyss(p);
  if(id==4) return engPhosphor(p);
  if(id==5) return engLattice(p);
  if(id==6) return engSoliton(uv);
  if(id==7) return engIris(p);
  if(id==8) return engPrism(p);
  if(id==9) return engFilament(p);
  if(id==10) return engOrbital(p);
  if(id==11) return engHopf(p);
  if(id==12) return engKlein(p);
  return engFieldBG(p);
}
vec3 renderEngine(int id, vec2 p, vec2 uv){
  if(id==13){
    int other = uEngineB == 13 ? 1 : uEngineB;
    vec3 a = engWarp(p);
    vec3 b = renderEngineOnce(other, p, uv);
    float m = 0.5 + 0.5 * sin(uTime * uTempo * 0.15 + uMix * PI);
    return mix(a, b, mix(uMix, m, 0.45));
  }
  return renderEngineOnce(id, p, uv);
}
`;

export const SCENE_FS = COMMON + `
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec2 p = sceneUV(vUv);
  vec3 col = renderEngine(uEngine, p, vUv);
  // heat = saturation toward palette peak
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 0.55 + uHeat * 0.7);
  col *= uExposure;
  col = (col - 0.5) * uContrast + 0.5;
  col = max(col, vec3(0.0));
  fragColor = vec4(col, 1.0);
}`;

export const FEEDBACK_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uPrev;
uniform float uTrail;
out vec4 fragColor;
void main(){
  vec3 a = texture(uScene, vUv).rgb;
  vec3 b = texture(uPrev, vUv).rgb;
  // slight zoom feedback — classic video-feedback cathedral
  vec2 c = (vUv - 0.5) * 0.996 + 0.5;
  b = texture(uPrev, c).rgb;
  fragColor = vec4(mix(a, max(a, b * uTrail), uTrail * 0.92), 1.0);
}`;

export const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uDir;
uniform vec2 uRes;
out vec4 fragColor;
void main(){
  vec2 px = uDir / uRes;
  vec3 s = texture(uScene, vUv).rgb * 0.227;
  s += texture(uScene, vUv + px*1.0).rgb * 0.194;
  s += texture(uScene, vUv - px*1.0).rgb * 0.194;
  s += texture(uScene, vUv + px*2.4).rgb * 0.121;
  s += texture(uScene, vUv - px*2.4).rgb * 0.121;
  s += texture(uScene, vUv + px*4.0).rgb * 0.066;
  s += texture(uScene, vUv - px*4.0).rgb * 0.066;
  fragColor = vec4(s, 1.0);
}`;

export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uTime;
uniform float uBloomAmt;
uniform float uGrain;
uniform float uCA;
uniform float uCRT;
uniform float uExposure;
out vec4 fragColor;

float ign(vec2 p){
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}
vec2 curveUV(vec2 uv, float k){
  uv = uv * 2.0 - 1.0;
  uv *= 1.0 + k * dot(uv, uv);
  return uv * 0.5 + 0.5;
}
void main(){
  vec2 uv = vUv;
  if(uCRT > 0.01){
    uv = curveUV(uv, uCRT * 0.18);
    if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){
      fragColor = vec4(0,0,0,1); return;
    }
  }
  vec2 c = uv - 0.5;
  float d = dot(c,c);
  vec2 ofs = c * d * uCA * 0.085;
  float r = texture(uScene, uv + ofs).r;
  float g = texture(uScene, uv + ofs * 0.35).g;
  float b = texture(uScene, uv - ofs * 0.25).b;
  vec3 col = vec3(r,g,b);
  vec3 bl = texture(uBloom, uv).rgb;
  // bloom only the hot parts
  float hot = max(bl.r, max(bl.g, bl.b));
  col += bl * uBloomAmt * smoothstep(0.18, 0.7, hot);

  if(uCRT > 0.01){
    float pitch = 3.0;
    float t = fract(gl_FragCoord.x / pitch);
    vec3 mask = vec3(
      exp(-pow((t-0.17)/0.18, 2.0)),
      exp(-pow((t-0.50)/0.18, 2.0)),
      exp(-pow((t-0.83)/0.18, 2.0))
    );
    col *= mix(vec3(1.0), mask * 1.35, uCRT * 0.55);
    float sy = fract(gl_FragCoord.y / 2.0);
    col *= mix(1.0, 0.78 + 0.22 * exp(-pow((sy-0.5)/0.35, 2.0)), uCRT * 0.7);
  }

  // IGN grain
  float n = ign(gl_FragCoord.xy + uTime * 37.0) - 0.5;
  col += n * uGrain;

  // vignette
  col *= mix(0.42, 1.08, smoothstep(1.35, 0.12, d));

  // ACES-ish filmic toe
  col = col * uExposure;
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(max(col, 0.0), vec3(0.909)); // ~1/1.1, keep a little punch

  fragColor = vec4(col, 1.0);
}`;

export const RD_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform float uTime;
uniform float uTempo;
uniform float uSeed;
uniform float uBass;
out vec4 fragColor;

// Gray–Scott reaction–diffusion
// ∂u/∂t = Du ∇²u − uv² + f(1−u)
// ∂v/∂t = Dv ∇²v + uv² − (f+k)v
void main(){
  vec2 px = 1.0 / uRes;
  vec4 c = texture(uPrev, vUv);
  vec4 l = texture(uPrev, vUv + vec2(-px.x, 0.0));
  vec4 r = texture(uPrev, vUv + vec2( px.x, 0.0));
  vec4 t = texture(uPrev, vUv + vec2(0.0,  px.y));
  vec4 b = texture(uPrev, vUv + vec2(0.0, -px.y));
  vec4 lap = l + r + t + b - 4.0 * c;
  float u = c.r;
  float v = c.g;
  // feed/kill slowly wander — different "organs"
  float f = 0.037 + 0.018 * sin(uTime * 0.05 + uSeed * 3.0) + uBass * 0.01;
  float k = 0.060 + 0.012 * cos(uTime * 0.04 + uSeed * 2.0);
  float Du = 0.16, Dv = 0.08;
  float uvv = u * v * v;
  float dt = 1.0;
  u += (Du * lap.r - uvv + f * (1.0 - u)) * dt;
  v += (Dv * lap.g + uvv - (f + k) * v) * dt;
  fragColor = vec4(clamp(u,0.0,1.0), clamp(v,0.0,1.0), 0.0, 1.0);
}`;

export const RD_SEED_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uSeed;
out vec4 fragColor;
float h(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.3) * 43758.5453);
}
void main(){
  vec2 p = vUv - 0.5;
  float u = 1.0;
  float v = 0.0;
  // a few chemical seeds
  for(int i=0;i<7;i++){
    vec2 c = vec2(h(vec2(float(i), uSeed)), h(vec2(uSeed, float(i)+2.4))) - 0.5;
    c *= 0.7;
    if(length(p - c) < 0.035 + 0.02*h(c)) v = 1.0;
  }
  if(length(p) < 0.04) v = 1.0;
  fragColor = vec4(u, v, 0.0, 1.0);
}`;

export const POS_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform float uDelta;
uniform float uTime;
uniform float uBreathe;
out vec4 fragColor;
void main(){
  vec4 pos = texture(uPos, vUv);
  vec4 vel = texture(uVel, vUv);
  pos.xyz += vel.xyz * uDelta;
  float br = 1.0 + uBreathe * 0.018 * sin(uTime * 0.5 + pos.w * 6.28318);
  pos.xyz *= br;
  fragColor = pos;
}`;

export const VEL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uHome;
uniform sampler2D uHomeB;
uniform float uMorph;
uniform float uPhase;
uniform float uDelta;
uniform float uTime;
uniform float uNoise;
uniform float uSpeed;
uniform float uSpring;
uniform float uDamping;
uniform float uOrbit;
uniform float uContain;
uniform vec3  uAxis;
uniform float uCrisp;
uniform float uBass;

float hash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n = mix(mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x),
                    mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
                mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                    mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
  return n;
}
vec3 curlN(vec3 p){
  float e = 0.12;
  float a = vnoise(p+vec3(0,e,0)) - vnoise(p-vec3(0,e,0));
  float b = vnoise(p+vec3(0,0,e)) - vnoise(p-vec3(0,0,e));
  float c = vnoise(p+vec3(e,0,0)) - vnoise(p-vec3(e,0,0));
  return normalize(vec3(a-b, b-c, c-a));
}

void main(){
  vec4 pos = texture(uPos, vUv);
  vec4 vel = texture(uVel, vUv);
  vec3 hA = texture(uHome, vUv).xyz;
  vec3 hB = texture(uHomeB, vUv).xyz;
  float mt = uMorph * uMorph * (3.0 - 2.0 * uMorph);
  vec3 h = mix(hA, hB, mt);
  vec3 p = pos.xyz;
  vec3 v = vel.xyz;

  float holdSpring = mix(1.8, 4.6, uCrisp);
  float holdNoise  = mix(0.14, 0.01, uCrisp);
  float spring = uSpring * mix(holdSpring, 0.32, uPhase);
  float nAmp   = uNoise  * mix(holdNoise, 1.5, uPhase);

  vec3 springF = (h - p) * spring * (1.0 + uBass * 0.35);
  vec3 sampleP = mix(p, h, 0.78) * 1.35 + vec3(uTime*0.13, uTime*-0.09, uTime*0.07);
  vec3 flow = curlN(sampleP) * nAmp * uSpeed;
  vec3 r = h - dot(h, uAxis) * uAxis;
  vec3 orbital = cross(uAxis, r) * uOrbit * mix(1.25, 0.55, uPhase);

  v = v * mix(uDamping - 0.08 * uCrisp, min(uDamping + 0.03, 0.995), uPhase)
    + (springF + flow + orbital) * uDelta;

  if(uContain > 0.0){
    vec3 pN = p + v * uDelta;
    float L = length(pN);
    if(L > uContain){
      vec3 n = pN / max(L, 1e-4);
      float vn = dot(v, n);
      if(vn > 0.0) v -= n * vn * 1.65;
      v += -n * (L - uContain) * 9.0;
    }
  }
  fragColor = vec4(v, vel.w);
}`;

export const PARTICLE_VS = `#version 300 es
uniform sampler2D uPos;
uniform mat4 uViewProj;
uniform float uSize;
uniform vec2 uTexSize;
uniform float uBright;
out float vSeed;
out vec3 vP;
void main(){
  int id = gl_VertexID;
  int w = int(uTexSize.x);
  ivec2 tc = ivec2(id % w, id / w);
  vec4 p = texelFetch(uPos, tc, 0);
  vSeed = p.w;
  vP = p.xyz;
  gl_Position = uViewProj * vec4(p.xyz, 1.0);
  float dist = max(gl_Position.w, 0.15);
  gl_PointSize = clamp(uSize * (2.4 / dist) * uBright, 0.6, 2.6);
}`;

export const PARTICLE_FS = `#version 300 es
precision highp float;
in float vSeed;
in vec3 vP;
uniform vec3 uPA, uPB, uPC, uPD;
uniform float uShift;
uniform float uHeat;
uniform float uTime;
out vec4 fragColor;
const float TAU = 6.28318530718;
void main(){
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(pc, pc);
  if(r2 > 1.0) discard;
  float fall = exp(-r2 * 36.0);
  float t = fract(vSeed + uShift + 0.08 * sin(uTime * 0.2 + vSeed * TAU));
  vec3 col = uPA + uPB * cos(TAU * (uPC * t + uPD));
  col = mix(vec3(dot(col, vec3(0.33))), col, 0.55 + uHeat * 0.6);
  float core = exp(-r2 * 90.0);
  fragColor = vec4(col * (0.55 + core * 1.4) * fall, fall);
}`;

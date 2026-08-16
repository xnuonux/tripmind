// Cheap scene — compiles fast, runs on Intel iGPUs.
// Same engine ids as the full shader so presets still mean something.

export const SCENE_LITE_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265;
const float TAU = 6.2831853;

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

float hash21(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 13.1) * 43758.5453);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash21(i);
  float b = hash21(i+vec2(1,0));
  float c = hash21(i+vec2(0,1));
  float d = hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float s=0.0, a=0.5;
  for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,3.1); a*=0.5; }
  return s;
}
vec3 pal(float t){
  t += uShift + uHeat*0.12*sin(uTime*0.07);
  return uPA + uPB * cos(TAU * (uPC * t + uPD));
}
vec2 kaleido(vec2 p, float n){
  n = max(n, 2.0);
  float a = atan(p.y,p.x);
  float r = length(p);
  float seg = TAU/n;
  a = abs(mod(a,seg) - seg*0.5);
  return vec2(cos(a),sin(a))*r;
}
vec2 domain(vec2 uv){
  vec2 p = (uv-0.5)*vec2(uAspect,1.0);
  p -= uCam*0.35;
  p /= max(uZoom, 0.2);
  if(uKaleid > 0.01) p = mix(p, kaleido(p, uSegments), clamp(uKaleid,0.0,1.0));
  float w = uWarp * (0.5 + uIntensity*0.5);
  if(w > 0.01){
    vec2 q = p*(2.0+uNoise*1.5);
    vec2 n = vec2(fbm(q+uTime*uTempo*0.08), fbm(q+vec2(5.2,1.3))) - 0.5;
    p += n * w;
  }
  return p;
}

vec3 eWarp(vec2 p){
  float t = uTime*uTempo;
  float n = fbm(p*2.2 + t*0.12);
  vec3 col = pal(n*(0.8+uHeat*0.4) + t*0.02);
  return col * (0.28 + n*(0.9+uIntensity));
}
vec3 eKaleid(vec2 p){
  float t = uTime*uTempo;
  float r = length(p)+1e-4;
  float a = atan(p.y,p.x);
  float cells = fbm(vec2(a*uSegments*0.2, 0.4/r + t*0.2));
  vec3 col = pal(cells + 0.2/r);
  col *= 0.22 + cells*1.05;
  col += pal(0.15)*exp(-r*(1.3-uIntensity*0.5))*(0.5+uBass*0.5);
  return col;
}
vec3 eAbyss(vec2 p){
  float t = uTime*uTempo*0.25;
  float r = length(p);
  float g = sin(p.x*4.0+t)*cos(p.y*4.0) + sin(p.y*4.0+t)*0.6;
  float n = fbm(p*3.0 + t);
  vec3 col = pal(0.3 + n*0.4 + g*0.08);
  col *= 0.15 + abs(g)*0.35 + n*0.5;
  col += pal(0.85)*exp(-r*2.0)*0.35*uIntensity;
  return col;
}
vec3 ePhos(vec2 p){
  float t = uTime*uTempo;
  float n = fbm(p*2.4 + vec2(t*0.1, -t*0.07));
  vec3 col = pal(n);
  col *= 0.2 + n*1.3;
  col *= 0.92 + 0.08*sin(p.y*uRes.y*0.6);
  return col;
}
vec3 eLat(vec2 p){
  float t = uTime*uTempo;
  vec2 q = p*(1.5+uNoise);
  float n = 3.0 + floor(mod(uSeed*7.0,5.0));
  float m = 4.0 + floor(mod(uSeed*5.0,6.0));
  float ch = cos(n*PI*q.x)*cos(m*PI*q.y) - cos(m*PI*q.x)*cos(n*PI*q.y);
  float lines = smoothstep(0.1,0.0,abs(ch));
  vec3 col = pal(0.35+lines*0.4);
  return col*(0.12+lines*(1.2+uIntensity));
}
vec3 eSol(vec2 uv){
  float n = fbm(uv*6.0 + uTime*uTempo*0.05);
  float spots = smoothstep(0.55,0.72,n);
  vec3 col = pal(n*0.8);
  return col*(0.15+spots*(1.3+uIntensity));
}
vec3 eIris(vec2 p){
  float t = uTime*uTempo*0.3;
  float r = length(p);
  float a = atan(p.y,p.x);
  float k = 3.0 + floor(mod(uSeed*9.0,6.0));
  float rose = abs(cos(k*a + t*0.4));
  float petal = smoothstep(0.08,0.0,abs(r - rose*0.55));
  float stroma = fbm(vec2(a*1.1, r*5.0));
  vec3 col = pal(stroma*0.5 + a/TAU);
  col *= 0.16 + stroma*0.65;
  col *= smoothstep(1.05,0.18,r);
  col += pal(0.85)*petal*0.8;
  col = mix(col, vec3(0.0), smoothstep(0.16,0.10,r));
  return col;
}
vec3 ePrism(vec2 p){
  float n = fbm(p*3.0 + uTime*uTempo*0.08);
  float d = 0.2 + n*0.6;
  vec3 lam = vec3(0.65,0.51,0.44);
  vec3 I = sin(TAU * 1.6 * d / lam);
  I *= I;
  return I * pal(n) * (0.45 + uIntensity*0.8);
}
vec3 eFil(vec2 p){
  float n = fbm(p*2.8);
  float rid = 1.0 - abs(n*2.0-1.0);
  float bolt = pow(rid, 6.0 - uIntensity*2.0);
  vec3 col = pal(n*0.5)*0.1;
  col += pal(0.2)*bolt*2.0;
  return col;
}
vec3 eOrb(vec2 p){
  float r = length(p)*1.6;
  float a = atan(p.y,p.x);
  float lobes = abs(cos(a*3.0))*exp(-r*1.4);
  vec3 col = pal(0.25+lobes);
  return col*(0.1+lobes*(1.2+uIntensity));
}
vec3 eHopf(vec2 p){
  vec3 acc = vec3(0.0);
  float t = uTime*uTempo*0.3;
  for(int i=0;i<8;i++){
    float fi = float(i)/8.0;
    float rad = 0.28 + 0.32*sin(fi*TAU);
    vec2 c = vec2(cos(fi*TAU+t), sin(fi*TAU*1.3))*0.35;
    float d = abs(length(p-c)-rad);
    acc += pal(fi)*exp(-d*55.0);
  }
  return acc*(0.8+uIntensity*0.5);
}
vec3 eKlein(vec2 p){
  vec2 z = p*1.1;
  float trap = 10.0;
  for(int i=0;i<8;i++){
    float d = length(z);
    trap = min(trap, abs(d-0.55));
    z = z*0.55*0.55 / max(d*d, 1e-4) + 0.15*sin(vec2(uSeed, uTime*0.05));
  }
  float e = exp(-trap*36.0);
  return pal(trap*2.0)*(0.12+e*1.5);
}
vec3 eField(vec2 p){
  float n = fbm(p*1.6);
  float ring = exp(-abs(length(p)-0.7)*18.0);
  vec3 col = pal(n*0.4)*n*0.35*uIntensity;
  col += pal(0.7)*ring*0.55;
  return col;
}

vec3 once(int id, vec2 p, vec2 uv){
  if(id==1) return eKaleid(p);
  if(id==2) return eWarp(p);
  if(id==3) return eAbyss(p);
  if(id==4) return ePhos(p);
  if(id==5) return eLat(p);
  if(id==6) return eSol(uv);
  if(id==7) return eIris(p);
  if(id==8) return ePrism(p);
  if(id==9) return eFil(p);
  if(id==10) return eOrb(p);
  if(id==11) return eHopf(p);
  if(id==12) return eKlein(p);
  return eField(p);
}

void main(){
  vec2 p = domain(vUv);
  vec3 col;
  if(uEngine==13){
    col = mix(eWarp(p), once(uEngineB==13?1:uEngineB, p, vUv), uMix);
  } else {
    col = once(uEngine, p, vUv);
  }
  float lum = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(lum), col, 0.55+uHeat*0.7);
  col *= uExposure;
  col = (col-0.5)*uContrast + 0.5;
  fragColor = vec4(max(col,0.0), 1.0);
}
`;

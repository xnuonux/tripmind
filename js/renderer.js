import {
  createGL, program, createTex, createTarget, resizeTarget,
  createQuad, blit, bindTex, perspective, lookAt, multiply,
} from './gl.js';
import {
  QUAD_VS, SCENE_FS, FEEDBACK_FS, BLUR_FS, COMPOSITE_FS,
  RD_FS, RD_SEED_FS, POS_FS, VEL_FS, PARTICLE_VS, PARTICLE_FS,
} from './shaders.js';
import { PALETTES } from './palettes.js';
import { ENGINES } from './state.js';
import { buildHomes, buildHomesNearby, texSizeForLevel } from './shapes.js';
import { mulberry32, cyrb128 } from './state.js';

function tryTarget(gl, w, h, preferFloat) {
  if (preferFloat) {
    try {
      return createTarget(gl, w, h, { internal: gl.RGBA16F, type: gl.HALF_FLOAT });
    } catch {}
    try {
      return createTarget(gl, w, h, {
        internal: gl.RGBA32F, type: gl.FLOAT, filter: gl.NEAREST,
      });
    } catch {}
  }
  return createTarget(gl, w, h, {
    internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
  });
}

function floatTarget(gl, n) {
  return createTarget(gl, n, n, {
    internal: gl.RGBA32F, type: gl.FLOAT, filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE,
  });
}

function uploadRGBA32(gl, tex, n, data) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, n, n, 0, gl.RGBA, gl.FLOAT, data);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = createGL(canvas);
    const gl = this.gl;
    this.quad = createQuad(gl);

    this.prog = {
      scene: program(gl, QUAD_VS, SCENE_FS),
      feedback: program(gl, QUAD_VS, FEEDBACK_FS),
      blur: program(gl, QUAD_VS, BLUR_FS),
      composite: program(gl, QUAD_VS, COMPOSITE_FS),
      rd: program(gl, QUAD_VS, RD_FS),
      rdSeed: program(gl, QUAD_VS, RD_SEED_FS),
      pos: program(gl, QUAD_VS, POS_FS),
      vel: program(gl, QUAD_VS, VEL_FS),
      particle: program(gl, PARTICLE_VS, PARTICLE_FS),
    };

    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.time = 0;
    this.seed = '820bd92d';
    this.rand = mulberry32(cyrb128(this.seed)[0]);

    this.scene = null;
    this.feedbackA = null;
    this.feedbackB = null;
    this.bloomA = null;
    this.bloomB = null;
    this.fbFlip = false;

    this.rdN = 384;
    this.rdA = tryTarget(gl, this.rdN, this.rdN, true);
    this.rdB = tryTarget(gl, this.rdN, this.rdN, true);
    this.rdFlip = false;
    this.rdReady = false;

    this.particles = null;
    this.axis = [0, 1, 0];
    this.morph = 0;
    this.phase = 0;
    this.morphT = 0;
    this.homeParams = null;

    this.cam = { theta: 0.35, phi: 0.18, dist: 6.4 };
    this.autoRotate = true;
    this.paused = false;
    this.fps = 0;
    this._frames = 0;
    this._fpsT = 0;

    this.emptyTex = createTex(gl, 1, 1, {
      internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
      data: new Uint8Array([0, 0, 0, 255]),
    });

    this.particleVAO = gl.createVertexArray();
  }

  resize(cssW, cssH, dpr) {
    const gl = this.gl;
    this.dpr = dpr || 1;
    const w = Math.max(2, Math.floor(cssW * this.dpr));
    const h = Math.max(2, Math.floor(cssH * this.dpr));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const hdr = { prefer: true };
    this.scene = this.scene ? resizeTarget(gl, this.scene, w, h) : tryTarget(gl, w, h, true);
    this.feedbackA = this.feedbackA ? resizeTarget(gl, this.feedbackA, w, h) : tryTarget(gl, w, h, true);
    this.feedbackB = this.feedbackB ? resizeTarget(gl, this.feedbackB, w, h) : tryTarget(gl, w, h, true);
    const bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
    this.bloomA = this.bloomA ? resizeTarget(gl, this.bloomA, bw, bh) : tryTarget(gl, bw, bh, true);
    this.bloomB = this.bloomB ? resizeTarget(gl, this.bloomB, bw, bh) : tryTarget(gl, bw, bh, true);
    void hdr;
  }

  setSeed(seed) {
    if (seed === this.seed) return;
    this.seed = seed;
    this.rand = mulberry32(cyrb128(seed)[0]);
    this.axis = [
      this.rand() * 2 - 1,
      this.rand() * 2 - 1,
      this.rand() * 2 - 1,
    ];
    const L = Math.hypot(...this.axis) || 1;
    this.axis = this.axis.map((v) => v / L);
    this.rdReady = false;
  }

  rebuildParticles(state) {
    if (!state) return;
    const gl = this.gl;
    const n = texSizeForLevel(state.particles);
    const count = n * n;
    this.rand = mulberry32(cyrb128(this.seed + ':' + state.shape)[0]);
    const homes = buildHomes(count, state.shape, this.rand);
    const homesB = buildHomesNearby(count, homes.params, this.rand);
    if (!this.particles || this.particles.n !== n) {
      if (this.particles) {
        for (const k of ['posA', 'posB', 'velA', 'velB', 'homeA', 'homeB']) {
          const t = this.particles[k];
          if (t?.tex) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
        }
      }
      this.particles = {
        n,
        count,
        posA: floatTarget(gl, n),
        posB: floatTarget(gl, n),
        velA: floatTarget(gl, n),
        velB: floatTarget(gl, n),
        homeA: floatTarget(gl, n),
        homeB: floatTarget(gl, n),
        flip: false,
      };
    }
    uploadRGBA32(gl, this.particles.homeA.tex, n, homes.data);
    uploadRGBA32(gl, this.particles.homeB.tex, n, homesB.data);
    uploadRGBA32(gl, this.particles.posA.tex, n, homes.data);
    uploadRGBA32(gl, this.particles.posB.tex, n, homes.data);
    const vel = new Float32Array(count * 4);
    uploadRGBA32(gl, this.particles.velA.tex, n, vel);
    uploadRGBA32(gl, this.particles.velB.tex, n, vel);
    this.homeParams = homes.params;
    this.morph = 0;
    this.phase = 0;
    this.morphT = 0;
    this._shape = state.shape;
    this._plevel = state.particles;
  }

  seedRD() {
    const gl = this.gl;
    const seed = cyrb128(this.seed)[0] / 4294967296;
    blit(gl, this.quad, this.prog.rdSeed, this.rdA.fbo, this.rdN, this.rdN, (u) => {
      gl.uniform1f(u.uSeed, seed);
    });
    this.rdReady = true;
    this.rdFlip = false;
  }

  bindCommon(u, state, audio) {
    const gl = this.gl;
    const pal = PALETTES[((state.palette % PALETTES.length) + PALETTES.length) % PALETTES.length];
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uAspect, this.w / Math.max(this.h, 1));
    gl.uniform1i(u.uEngine, Math.max(0, ENGINES.indexOf(state.engine)));
    gl.uniform1i(u.uEngineB, Math.max(0, ENGINES.indexOf(state.engineB)));
    gl.uniform1f(u.uIntensity, state.intensity);
    gl.uniform1f(u.uTempo, state.tempo);
    gl.uniform1f(u.uHeat, state.heat);
    gl.uniform1f(u.uKaleid, state.kaleid);
    gl.uniform1f(u.uSegments, state.segments);
    gl.uniform1f(u.uWarp, state.warpAmt);
    gl.uniform1f(u.uNoise, state.noise);
    gl.uniform1f(u.uMix, state.mix);
    gl.uniform3fv(u.uPA, pal.a);
    gl.uniform3fv(u.uPB, pal.b);
    gl.uniform3fv(u.uPC, pal.c);
    gl.uniform3fv(u.uPD, pal.d);
    gl.uniform1f(u.uShift, state.paletteShift);
    gl.uniform1f(u.uBass, audio?.bass || 0);
    gl.uniform1f(u.uMid, audio?.mid || 0);
    gl.uniform1f(u.uTreble, audio?.treble || 0);
    gl.uniform1f(u.uSeed, cyrb128(state.seed)[0] / 4294967296);
    gl.uniform1f(u.uFov, state.fov);
    gl.uniform1f(u.uContrast, state.contrast);
    gl.uniform1f(u.uExposure, state.exposure);
    gl.uniform2f(u.uCam, this.cam.theta * 0.15, this.cam.phi * 0.2);
    gl.uniform1f(u.uZoom, Math.max(0.2, 3.8 / this.cam.dist));
  }

  stepParticles(state, dt, audio) {
    if (!this.particles) return;
    if (this._shape !== state.shape || this._plevel !== state.particles) {
      this.rebuildParticles(state);
    }
    const gl = this.gl;
    const P = this.particles;
    const n = P.n;
    const srcPos = P.flip ? P.posB : P.posA;
    const dstPos = P.flip ? P.posA : P.posB;
    const srcVel = P.flip ? P.velB : P.velA;
    const dstVel = P.flip ? P.velA : P.velB;

    if (state.morph > 0.01) {
      this.morphT += dt;
      const hold = 3.2, trans = 2.4;
      const cycle = hold + trans;
      const u = this.morphT % cycle;
      if (u < hold) {
        this.phase = 0;
        this.morph = 0;
      } else {
        const k = (u - hold) / trans;
        this.phase = Math.sin(k * Math.PI);
        this.morph = k;
        if (k > 0.99 && this._morphed !== (this.morphT / cycle) | 0) {
          this._morphed = (this.morphT / cycle) | 0;
          // swap homes next cycle — rebuild B from nearby
          const next = buildHomesNearby(n * n, this.homeParams, this.rand);
          uploadRGBA32(gl, P.homeA.tex, n, this._lastB || next.data);
          uploadRGBA32(gl, P.homeB.tex, n, next.data);
          this._lastB = next.data;
          this.homeParams = next.params;
        }
      }
    } else {
      this.phase = 0;
      this.morph = 0;
    }

    blit(gl, this.quad, this.prog.vel, dstVel.fbo, n, n, (u) => {
      bindTex(gl, 0, srcPos.tex); gl.uniform1i(u.uPos, 0);
      bindTex(gl, 1, srcVel.tex); gl.uniform1i(u.uVel, 1);
      bindTex(gl, 2, P.homeA.tex); gl.uniform1i(u.uHome, 2);
      bindTex(gl, 3, P.homeB.tex); gl.uniform1i(u.uHomeB, 3);
      gl.uniform1f(u.uMorph, this.morph);
      gl.uniform1f(u.uPhase, this.phase);
      gl.uniform1f(u.uDelta, dt);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uNoise, state.noise);
      gl.uniform1f(u.uSpeed, 0.35 + state.tempo * 1.1);
      gl.uniform1f(u.uSpring, state.spring);
      gl.uniform1f(u.uDamping, state.damping);
      gl.uniform1f(u.uOrbit, state.orbit);
      gl.uniform1f(u.uContain, 1.85);
      gl.uniform3fv(u.uAxis, this.axis);
      gl.uniform1f(u.uCrisp, 0.72);
      gl.uniform1f(u.uBass, audio?.bass || 0);
    });
    blit(gl, this.quad, this.prog.pos, dstPos.fbo, n, n, (u) => {
      bindTex(gl, 0, srcPos.tex); gl.uniform1i(u.uPos, 0);
      bindTex(gl, 1, dstVel.tex); gl.uniform1i(u.uVel, 1);
      gl.uniform1f(u.uDelta, dt);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uBreathe, (audio?.bass || 0) * 0.8 + state.intensity * 0.3);
    });
    P.flip = !P.flip;
  }

  drawParticles(state) {
    if (!this.particles || state.engine !== 'field') return;
    const gl = this.gl;
    const P = this.particles;
    const pos = P.flip ? P.posA : P.posB;
    const aspect = this.w / Math.max(this.h, 1);
    const proj = perspective(45 * Math.PI / 180, aspect, 0.05, 40);
    const ct = Math.cos(this.cam.theta), st = Math.sin(this.cam.theta);
    const cp = Math.cos(this.cam.phi), sp = Math.sin(this.cam.phi);
    const eye = [
      this.cam.dist * ct * cp,
      this.cam.dist * sp,
      this.cam.dist * st * cp,
    ];
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const vp = multiply(proj, view);
    const pal = PALETTES[((state.palette % PALETTES.length) + PALETTES.length) % PALETTES.length];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.prog.particle.p);
    const u = this.prog.particle.uniforms;
    bindTex(gl, 0, pos.tex);
    gl.uniform1i(u.uPos, 0);
    gl.uniformMatrix4fv(u.uViewProj, false, vp);
    gl.uniform1f(u.uSize, 1.6 * this.dpr * (0.8 + state.intensity * 0.6));
    gl.uniform2f(u.uTexSize, P.n, P.n);
    gl.uniform1f(u.uBright, 0.85 + state.intensity * 0.4);
    gl.uniform3fv(u.uPA, pal.a);
    gl.uniform3fv(u.uPB, pal.b);
    gl.uniform3fv(u.uPC, pal.c);
    gl.uniform3fv(u.uPD, pal.d);
    gl.uniform1f(u.uShift, state.paletteShift);
    gl.uniform1f(u.uHeat, state.heat);
    gl.uniform1f(u.uTime, this.time);
    gl.bindVertexArray(this.particleVAO);
    gl.drawArrays(gl.POINTS, 0, P.count);
    gl.disable(gl.BLEND);
  }

  frame(dt, state, audio) {
    const gl = this.gl;
    if (!this.w) return;
    if (!this.paused) this.time += dt * (0.35 + state.tempo * 1.4);
    if (this.autoRotate && state.autoRotate && !this.paused) {
      this.cam.theta += dt * 0.12 * (0.4 + state.tempo);
    }

    if (state.seed !== this.seed) {
      this.setSeed(state.seed);
      this.rebuildParticles(state);
    }
    if (!this.particles) this.rebuildParticles(state);

    if (state.engine === 'soliton' || state.engineB === 'soliton' || state.engine === 'hybrid') {
      if (!this.rdReady) this.seedRD();
      const src = this.rdFlip ? this.rdB : this.rdA;
      const dst = this.rdFlip ? this.rdA : this.rdB;
      const steps = this.paused ? 0 : 2;
      let curS = src, curD = dst;
      for (let i = 0; i < steps; i++) {
        blit(gl, this.quad, this.prog.rd, curD.fbo, this.rdN, this.rdN, (u) => {
          bindTex(gl, 0, curS.tex); gl.uniform1i(u.uPrev, 0);
          gl.uniform2f(u.uRes, this.rdN, this.rdN);
          gl.uniform1f(u.uTime, this.time);
          gl.uniform1f(u.uTempo, state.tempo);
          gl.uniform1f(u.uSeed, cyrb128(state.seed)[0] / 4294967296);
          gl.uniform1f(u.uBass, audio?.bass || 0);
        });
        const tmp = curS; curS = curD; curD = tmp;
        this.rdFlip = !this.rdFlip;
      }
    }

    if (state.engine === 'field') this.stepParticles(state, this.paused ? 0 : dt, audio);

    const rdTex = this.rdFlip ? this.rdA.tex : this.rdB.tex;

    blit(gl, this.quad, this.prog.scene, this.scene.fbo, this.w, this.h, (u) => {
      this.bindCommon(u, state, audio);
      bindTex(gl, 0, rdTex || this.emptyTex);
      gl.uniform1i(u.uRD, 0);
    });

    this.drawParticles(state);

    const prev = this.fbFlip ? this.feedbackB : this.feedbackA;
    const next = this.fbFlip ? this.feedbackA : this.feedbackB;
    blit(gl, this.quad, this.prog.feedback, next.fbo, this.w, this.h, (u) => {
      bindTex(gl, 0, this.scene.tex); gl.uniform1i(u.uScene, 0);
      bindTex(gl, 1, prev.tex); gl.uniform1i(u.uPrev, 1);
      gl.uniform1f(u.uTrail, state.trail);
    });
    this.fbFlip = !this.fbFlip;

    const fb = this.fbFlip ? this.feedbackA : this.feedbackB;
    const bw = this.bloomA.w, bh = this.bloomA.h;
    blit(gl, this.quad, this.prog.blur, this.bloomA.fbo, bw, bh, (u) => {
      bindTex(gl, 0, fb.tex); gl.uniform1i(u.uScene, 0);
      gl.uniform2f(u.uDir, 1.4, 0);
      gl.uniform2f(u.uRes, bw, bh);
    });
    blit(gl, this.quad, this.prog.blur, this.bloomB.fbo, bw, bh, (u) => {
      bindTex(gl, 0, this.bloomA.tex); gl.uniform1i(u.uScene, 0);
      gl.uniform2f(u.uDir, 0, 1.4);
      gl.uniform2f(u.uRes, bw, bh);
    });

    blit(gl, this.quad, this.prog.composite, null, this.w, this.h, (u) => {
      bindTex(gl, 0, fb.tex); gl.uniform1i(u.uScene, 0);
      bindTex(gl, 1, this.bloomB.tex); gl.uniform1i(u.uBloom, 1);
      gl.uniform2f(u.uRes, this.w, this.h);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uBloomAmt, state.bloom * 1.15);
      gl.uniform1f(u.uGrain, state.grain);
      gl.uniform1f(u.uCA, state.ca);
      gl.uniform1f(u.uCRT, state.crt);
      gl.uniform1f(u.uExposure, 1.0);
    });

    this._frames++;
    this._fpsT += dt;
    if (this._fpsT > 0.5) {
      this.fps = this._frames / this._fpsT;
      this._frames = 0;
      this._fpsT = 0;
    }
  }

  async renderAtSize(cssW, cssH, dpr = 1) {
    const prev = { w: this.canvas.clientWidth, h: this.canvas.clientHeight, dpr: this.dpr };
    this.resize(cssW, cssH, dpr);
    return prev;
  }
}

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is required for TRIPMIND.');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  gl.getExtension('OES_texture_half_float_linear');
  return gl;
}

export function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
    console.error(numbered);
    throw new Error(log);
  }
  return s;
}

export function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  const uniforms = Object.create(null);
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, uniforms };
}

export function createTex(gl, w, h, opts = {}) {
  const {
    internal = gl.RGBA16F,
    format = gl.RGBA,
    type = gl.HALF_FLOAT,
    filter = gl.LINEAR,
    wrap = gl.CLAMP_TO_EDGE,
    data = null,
  } = opts;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  return t;
}

export function createFBO(gl, tex) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('framebuffer incomplete: 0x' + st.toString(16));
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return f;
}

export function createTarget(gl, w, h, opts = {}) {
  const tex = createTex(gl, w, h, opts);
  const fbo = createFBO(gl, tex);
  return { tex, fbo, w, h };
}

export function resizeTarget(gl, target, w, h, opts = {}) {
  if (target.w === w && target.h === h) return target;
  gl.deleteTexture(target.tex);
  gl.deleteFramebuffer(target.fbo);
  return createTarget(gl, w, h, opts);
}

export function createQuad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

export function blit(gl, quad, prog, fbo, w, h, set) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, w, h);
  gl.useProgram(prog.p);
  if (set) set(prog.uniforms);
  gl.bindVertexArray(quad);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function bindTex(gl, unit, tex) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  const o = new Float32Array(16);
  o[0] = f / aspect;
  o[5] = f;
  o[10] = (far + near) * nf;
  o[11] = -1;
  o[14] = 2 * far * near * nf;
  return o;
}

export function lookAt(eye, target, up) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z0 = zx / zl, z1 = zy / zl, z2 = zz / zl;
  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  let xl = Math.hypot(x0, x1, x2) || 1;
  x0 /= xl; x1 /= xl; x2 /= xl;
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;
  const o = new Float32Array(16);
  o[0] = x0; o[1] = x1; o[2] = x2; o[3] = 0;
  o[4] = y0; o[5] = y1; o[6] = y2; o[7] = 0;
  o[8] = z0; o[9] = z1; o[10] = z2; o[11] = 0;
  o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  o[15] = 1;
  return o;
}

export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      o[i + j * 4] =
        a[i] * b[j * 4] +
        a[i + 4] * b[1 + j * 4] +
        a[i + 8] * b[2 + j * 4] +
        a[i + 12] * b[3 + j * 4];
    }
  }
  return o;
}

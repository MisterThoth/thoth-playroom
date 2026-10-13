// ============================================================================
// FX2 - the high-end effects layer every god builds abilities from.
//  - five particle systems with flipbook animation (frame-blended), a palette ramp per god
//    (dark edge -> mid -> hot core), soft fade where sprites meet the floor, swirl/turbulence,
//    orbiting, attraction and "follow" anchors:
//      glow  (additive sprites: glow, core, spark, ember, star, ring, wisp, swirl, bolt, flare...)
//      fire  (additive flame flipbook)     boom (additive explosion flipbook)
//      smoke (lit, self-shadowed volumetric smoke flipbook with inner magic glow)
//      solid (lit sprites: dust, leaves, drops, bubbles)
//  - a screen-space distortion buffer (shock rings and heat haze bend the image)
//  - 3D debris (instanced rocks, plain or glowing), energy rings, tornadoes, spheres, slashes, scorches
//  - recipes: charge, burst, impact, aura, trail, mist, vortex, spray, rain ...
// Textures come from tools/vfx/make_fx2.py (assets/fx/*.webp).
// ============================================================================
const FXA = { glow: 0, core: 1, spark: 2, ember: 3, star: 4, ring: 5, wisp: 6, swirl: 7, dust: 8, rock: 9, leaf: 10, drop: 11, bubble: 12, bolt: 13, flare: 14, shard: 15 };
const _fq = new THREE.Vector3(), _fq2 = new THREE.Vector3(), _fq3 = new THREE.Vector3(), _fm4 = new THREE.Matrix4(), _fqq = new THREE.Quaternion(), _fe = new THREE.Euler();
const C3 = (r, g, b) => new THREE.Color(r, g, b);

const FX2_VS = /* glsl */`
  attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iA; attribute vec4 iB;
  uniform mat4 uViewInv; uniform vec3 uPal[120]; uniform vec3 uSmk[40]; uniform vec2 uGrid; uniform float uFrames;
  varying vec2 vUv0; varying vec2 vUv1; varying float vBlend; varying vec4 vB;
  varying vec3 vE; varying vec3 vM; varying vec3 vC; varying vec3 vS; varying float vWorldY; varying float vSize; varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    float size = iA.x, rot = iA.y, frame = iA.z, stretch = iA.w;
    vec2 c = position.xy;
    if (stretch > 0.0) {
      vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
      vec2 d = vv.xy; float l = length(d); d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
      vec2 n = vec2(-d.y, d.x);
      mv.xy += d * c.x * size * (1.0 + stretch * min(1.0, l * 0.12)) + n * c.y * size * 0.32;
    } else {
      float cs = cos(rot), sn = sin(rot);
      mv.xy += vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) * size;
    }
    vDepth = -mv.z; vWorldY = (uViewInv * mv).y; vSize = size;
    gl_Position = projectionMatrix * mv;
    float f0 = floor(frame), f1 = min(f0 + 1.0, uFrames - 1.0);
    vBlend = frame - f0;
    vUv0 = (vec2(mod(f0, uGrid.x), uGrid.y - 1.0 - floor(f0 / uGrid.x)) + uv) / uGrid;
    vUv1 = (vec2(mod(f1, uGrid.x), uGrid.y - 1.0 - floor(f1 / uGrid.x)) + uv) / uGrid;
    int p = int(iB.w + 0.5);
    vE = uPal[p * 3]; vM = uPal[p * 3 + 1]; vC = uPal[p * 3 + 2]; vS = uSmk[p];
    vB = iB;
  }`;
const FX2_FS_ADD = /* glsl */`
  uniform sampler2D map; uniform float uSoft;
  varying vec2 vUv0; varying vec2 vUv1; varying float vBlend; varying vec4 vB;
  varying vec3 vE; varying vec3 vM; varying vec3 vC; varying vec3 vS; varying float vWorldY; varying float vSize; varying float vDepth;
  void main() {
    vec4 t = mix(texture2D(map, vUv0), texture2D(map, vUv1), vBlend);
    float soft = (uSoft > 0.0 ? smoothstep(0.0, uSoft * vSize + 0.02, vWorldY) : 1.0) * smoothstep(0.25, 1.1, vDepth);
    float a = t.a * vB.x * soft;
    float h = clamp(t.r * vB.z, 0.0, 1.0);
    vec3 col = h < 0.5 ? mix(vE, vM, h * 2.0) : mix(vM, vC, h * 2.0 - 1.0);
    gl_FragColor = vec4(col * vB.y * a, 0.0);
  }`;
const FX2_FS_LIT = /* glsl */`
  uniform sampler2D map; uniform float uSoft;
  varying vec2 vUv0; varying vec2 vUv1; varying float vBlend; varying vec4 vB;
  varying vec3 vE; varying vec3 vM; varying vec3 vC; varying vec3 vS; varying float vWorldY; varying float vSize; varying float vDepth;
  void main() {
    vec4 t = mix(texture2D(map, vUv0), texture2D(map, vUv1), vBlend);
    float soft = (uSoft > 0.0 ? smoothstep(0.0, uSoft * vSize + 0.02, vWorldY) : 1.0) * smoothstep(0.25, 1.1, vDepth);
    float a = t.a * vB.x * soft;
    vec3 base = vS * (0.25 + 0.95 * t.r);
    float h = clamp(vB.z * (1.1 - t.r * 0.75), 0.0, 1.0);          // magic glowing from inside the smoke (strongest in its shadowed core)
    vec3 glow = (h < 0.5 ? mix(vE, vM, h * 2.0) : mix(vM, vC, h * 2.0 - 1.0)) * h * vB.y * 0.75;
    gl_FragColor = vec4((base + glow) * a, a);
  }`;

class FX2System {
  // tex: 4x4 grid texture; mode 'add' (additive palette ramp) or 'lit' (premultiplied, lit smoke/sprites)
  constructor(max, tex, mode = 'add', opts = {}) {
    this.max = max; this.list = []; this.mode = mode;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    this.aPos = new Float32Array(max * 3); this.aVel = new Float32Array(max * 3); this.aA = new Float32Array(max * 4); this.aB = new Float32Array(max * 4);
    const mk = (arr, n) => { const a = new THREE.InstancedBufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('iPos', mk(this.aPos, 3)); g.setAttribute('iVel', mk(this.aVel, 3)); g.setAttribute('iA', mk(this.aA, 4)); g.setAttribute('iB', mk(this.aB, 4));
    g.instanceCount = 0; this.geo = g;
    this.frames = opts.frames ?? 16;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: mode === 'add' ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
      uniforms: { map: { value: tex }, uViewInv: { value: camera.matrixWorld }, uPal: { value: FX2.palArr }, uSmk: { value: FX2.smkArr },
        uGrid: { value: new THREE.Vector2(4, 4) }, uFrames: { value: this.frames }, uSoft: { value: opts.soft ?? 0.45 } },
      vertexShader: FX2_VS, fragmentShader: mode === 'add' ? FX2_FS_ADD : FX2_FS_LIT,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = opts.order ?? (mode === 'add' ? 11 : 10);
    scene.add(this.mesh);
  }
  // o: pos vel life size sizeEnd sizePow alpha fadeIn fadeOut temp tempEnd int pal cell|frame0 frames fps rot rotVel
  //    stretch drag gravity turb turbFreq orbit{c,r,w,vr,vy,a,y} attract{x,y,z,strength,kill} follow(Vector3) floor
  spawn(o) {
    const full = this.list.length >= this.max;   // (as ParticleSystem.spawn)
    const pal = FX2.palId(o.pal);
    const p = {
      x: o.pos.x, y: o.pos.y, z: o.pos.z, vx: o.vel ? o.vel.x : 0, vy: o.vel ? o.vel.y : 0, vz: o.vel ? o.vel.z : 0,
      life: 0, max: o.life ?? 1, s0: o.size ?? 0.4, s1: o.sizeEnd ?? (o.size ?? 0.4), sp: o.sizePow ?? 1,
      a0: o.alpha ?? 1, fi: o.fadeIn ?? 0.08, fo: o.fadeOut ?? 0.55, t0: o.temp ?? 1, t1: o.tempEnd ?? (o.temp ?? 1), int: o.int ?? 1, pal,
      cell: o.cell ?? 0, frames: o.frames ?? 0, fps: o.fps ?? 0, rot: o.rot ?? Math.random() * TAU, rv: o.rotVel ?? rand(-0.6, 0.6),
      stretch: o.stretch ?? 0, drag: o.drag ?? 0, grav: o.gravity ?? 0, turb: o.turb ?? 0, tf: o.turbFreq ?? 1.3, seed: Math.random() * 100,
      orbit: null, attract: o.attract || null, fol: o.follow || null, fx: 0, fy: 0, fz: 0, floor: o.floor ?? false,
    };
    if (p.fol) { p.fx = p.fol.x; p.fy = p.fol.y || 0; p.fz = p.fol.z; }
    if (o.orbit) {
      const ob = o.orbit, c = ob.c;
      p.orbit = { c, r: ob.r ?? 1, w: ob.w ?? 2, vr: ob.vr ?? 0, vy: ob.vy ?? 0, a: ob.a ?? Math.random() * TAU, y: ob.y ?? o.pos.y, wob: ob.wob ?? 0 };
    }
    if (full) { const i = (this.ev || 0) % this.list.length; this.ev = i + 1; this.list[i] = p; } else this.list.push(p);
    return p;
  }
  update(dt, time) {
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      let x, y, z;
      if (p.orbit) {
        const ob = p.orbit;
        ob.a += ob.w * dt; ob.r = Math.max(0.02, ob.r + ob.vr * dt); ob.y += ob.vy * dt;
        const wob = ob.wob ? Math.sin(p.life * 5 + p.seed) * ob.wob : 0;
        const nx = ob.c.x + Math.cos(ob.a) * (ob.r + wob), nz = ob.c.z + Math.sin(ob.a) * (ob.r + wob), ny = (ob.c.y || 0) + ob.y;
        p.vx = (nx - p.x) / Math.max(dt, 1e-4); p.vy = (ny - p.y) / Math.max(dt, 1e-4); p.vz = (nz - p.z) / Math.max(dt, 1e-4);
        p.x = nx; p.y = ny; p.z = nz;
      } else {
        if (p.attract) {
          const t = p.attract, dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz) || 1e-4, k = (t.strength || 30) * dt;
          p.vx += (dx / d) * k; p.vy += (dy / d) * k; p.vz += (dz / d) * k;
          if (d < (t.kill || 0.15)) { p.life = p.max; continue; }
        }
        if (p.turb) {
          const f = p.tf, s = p.seed, tt = time;
          p.vx += (Math.sin(p.y * f + tt * 1.3 + s) + Math.sin(p.z * f * 1.7 - tt * 0.9 + s * 1.3)) * p.turb * dt;
          p.vy += (Math.sin(p.z * f + tt * 1.1 + s * 2.1) + Math.sin(p.x * f * 1.5 + tt * 0.7)) * p.turb * 0.6 * dt;
          p.vz += (Math.sin(p.x * f + tt * 1.7 + s * 3.7) + Math.sin(p.y * f * 1.3 - tt * 1.2 + s)) * p.turb * dt;
        }
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr; p.vy = p.vy * dr + p.grav * dt; p.vz *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.floor && p.y < 0.03) { p.y = 0.03; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6; }
      }
      x = p.x; y = p.y; z = p.z;
      if (p.fol) { x += p.fol.x - p.fx; y += (p.fol.y || 0) - p.fy; z += p.fol.z - p.fz; }
      p.rot += p.rv * dt;
      const k = p.life / p.max;
      const fin = p.fi > 0 ? Math.min(1, p.life / p.fi) : 1, fout = k > p.fo ? 1 - (k - p.fo) / (1 - p.fo) : 1;
      const a = p.a0 * fin * fout * fout;
      const sz = p.s0 + (p.s1 - p.s0) * (p.sp === 1 ? k : Math.pow(k, p.sp));
      const fr = p.frames ? (p.fps ? (p.cell + p.life * p.fps) % p.frames : p.cell + k * (p.frames - 1)) : p.cell;
      this.aPos[w * 3] = x; this.aPos[w * 3 + 1] = y; this.aPos[w * 3 + 2] = z;
      this.aVel[w * 3] = p.vx; this.aVel[w * 3 + 1] = p.vy; this.aVel[w * 3 + 2] = p.vz;
      this.aA[w * 4] = sz; this.aA[w * 4 + 1] = p.rot; this.aA[w * 4 + 2] = fr; this.aA[w * 4 + 3] = p.stretch;
      this.aB[w * 4] = a; this.aB[w * 4 + 1] = p.int; this.aB[w * 4 + 2] = p.t0 + (p.t1 - p.t0) * k; this.aB[w * 4 + 3] = p.pal;
      L[w++] = p;
    }
    L.length = w;
    this.geo.instanceCount = w;
    for (const k of ['iPos', 'iVel', 'iA', 'iB']) this.geo.attributes[k].needsUpdate = true;
  }
  clear() { this.list.length = 0; this.geo.instanceCount = 0; }
}

// ---- screen distortion: shock rings and heat haze write UV offsets into a half-res float buffer ----
class FX2Distort {
  constructor(max) {
    this.max = max; this.list = [];
    this.scene = new THREE.Scene();
    const base = new THREE.PlaneGeometry(2, 2), g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    this.aPos = new Float32Array(max * 3); this.aA = new Float32Array(max * 4);
    const mk = (arr, n) => { const a = new THREE.InstancedBufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('iPos', mk(this.aPos, 3)); g.setAttribute('iA', mk(this.aA, 4)); g.instanceCount = 0; this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uNoise: { value: null }, uTime: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute vec4 iA; varying vec2 vQ; varying vec4 vA;
        void main() { vec4 mv = modelViewMatrix * vec4(iPos, 1.0); mv.xy += position.xy * iA.x * 0.5; vQ = position.xy; vA = iA; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uNoise; uniform float uTime; varying vec2 vQ; varying vec4 vA;
        void main() {
          float r = length(vQ); if (r > 1.0) discard;
          vec2 off;
          if (vA.z < 0.5) { float q = (r - vA.w) / 0.16; float pr = exp(-q * q); off = (r > 1e-4 ? vQ / r : vec2(0.0)) * pr * vA.y; }
          else { vec2 n = texture2D(uNoise, vQ * 0.4 + vec2(vA.w, -uTime * 0.5)).rg - 0.5; off = n * vA.y * (1.0 - r * r); }
          gl_FragColor = vec4(off, 0.0, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.scene.add(this.mesh);
    this.rt = null;
  }
  // a ring: expands from r0 to ~0.9 of the quad, strength in screen-UV units (0.02 = strong)
  ring(pos, size, strength = 0.02, life = 0.5) { this.add({ pos: pos.clone(), size, s: strength, mode: 0, life, ring: true }); }
  heat(pos, size, strength = 0.006, life = 1, follow = null) { return this.add({ pos: pos.clone(), size, s: strength, mode: 1, life, fol: follow, seed: Math.random() * 10 }); }
  add(o) { o.t = 0; if (this.list.length >= this.max) { const i = (this.ev || 0) % this.list.length; this.ev = i + 1; this.list[i] = o; } else this.list.push(o); return o; }
  update(dt, time) {
    let w = 0; const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const o = L[i]; o.t += dt; if (o.t >= o.life || o.dead) continue;
      const k = o.t / o.life, p = o.fol || o.pos;
      this.aPos[w * 3] = p.x; this.aPos[w * 3 + 1] = (o.fol ? (o.fol.y || 0) + (o.pos.y || 0) : p.y); this.aPos[w * 3 + 2] = p.z;
      if (o.ring) { this.aA[w * 4] = o.size; this.aA[w * 4 + 1] = o.s * (1 - k) * (1 - k); this.aA[w * 4 + 2] = 0; this.aA[w * 4 + 3] = 0.15 + 0.75 * easeOutCubic(k); }
      else { const f = Math.min(1, o.t / 0.15) * (1 - smoothstep(0.7, 1, k)); this.aA[w * 4] = o.size; this.aA[w * 4 + 1] = o.s * f; this.aA[w * 4 + 2] = 1; this.aA[w * 4 + 3] = o.seed; }
      L[w++] = o;
    }
    L.length = w; this.geo.instanceCount = w;
    this.geo.attributes.iPos.needsUpdate = true; this.geo.attributes.iA.needsUpdate = true;
    this.mat.uniforms.uTime.value = time;
  }
  render() {
    if (!composer) return;
    const w = Math.max(2, Math.floor(renderTarget.width / 2)), h = Math.max(2, Math.floor(renderTarget.height / 2));
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
      if (shockPass) shockPass.uniforms.tDistort.value = this.rt.texture;
    }
    if (shockPass && shockPass.uniforms.tDistort.value !== this.rt.texture) shockPass.uniforms.tDistort.value = this.rt.texture;
    const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(_fxCol), prevA = renderer.getClearAlpha();
    renderer.setRenderTarget(this.rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
    if (this.list.length) renderer.render(this.scene, camera);
    renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
    if (shockPass) shockPass.uniforms.uDistK.value = this.list.length ? 1 : 0;
  }
}
const _fxCol = new THREE.Color();

// ---- 3D debris: instanced rocks (stone / ice / gold), plain or glowing, with bounce and tumble ----
class FX2Debris {
  constructor(max, glowing) {
    this.max = max; this.list = [];
    const geo = new THREE.IcosahedronGeometry(0.5, 1), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { _fq.fromBufferAttribute(pos, i); const n = 0.75 + 0.45 * Math.abs(Math.sin(_fq.x * 7.1 + _fq.y * 3.3) * Math.cos(_fq.z * 5.7 - _fq.x * 2.1)); _fq.multiplyScalar(n); _fq.y *= 0.7; pos.setXYZ(i, _fq.x, _fq.y, _fq.z); }
    geo.computeVertexNormals();
    const mat = glowing
      ? new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0, flatShading: true, emissive: 0xffffff, emissiveIntensity: 2.2 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02, flatShading: true });
    if (glowing) mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance *= vColor;\n#endif'); };
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = !glowing;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _fxCol.set(1, 1, 1));
    scene.add(this.mesh);
  }
  spawn(o) {
    const L = this.list, full = L.length >= this.max, i = full ? (this.ev || 0) % L.length : L.length; if (full) this.ev = i + 1;
    L[i] = ({ p: o.pos.clone(), v: o.vel ? o.vel.clone() : new THREE.Vector3(), av: V3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), r: new THREE.Euler(rand(0, TAU), rand(0, TAU), rand(0, TAU)),
      s: o.size ?? 0.2, sx: rand(0.7, 1.3), t: 0, life: o.life ?? rand(1.4, 2.4), col: (o.color || _fxCol.set(0.6, 0.55, 0.48)).clone(), grav: o.gravity ?? -16, fade: o.fadeColor ? o.fadeColor.clone() : null });
  }
  update(dt) {
    let w = 0; const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const d = L[i]; d.t += dt; if (d.t >= d.life) continue;
      d.v.y += d.grav * dt; d.p.addScaledVector(d.v, dt);
      if (d.p.y < d.s * 0.35) { d.p.y = d.s * 0.35; if (d.v.y < -1) { d.v.y *= -0.32; d.v.x *= 0.6; d.v.z *= 0.6; d.av.multiplyScalar(0.55); } else { d.v.set(d.v.x * 0.9, 0, d.v.z * 0.9); d.av.multiplyScalar(0.9); } }
      d.r.x += d.av.x * dt; d.r.y += d.av.y * dt; d.r.z += d.av.z * dt;
      const k = d.t / d.life, sc = d.s * (1 - smoothstep(0.75, 1, k));
      _fm4.compose(d.p, _fqq.setFromEuler(d.r), _fq.set(sc * d.sx, sc, sc / d.sx));
      this.mesh.setMatrixAt(w, _fm4);
      if (d.fade) _fxCol.copy(d.col).lerp(d.fade, smoothstep(0, 0.8, k)); else _fxCol.copy(d.col);
      this.mesh.setColorAt(w, _fxCol);
      L[w++] = d;
    }
    L.length = w; this.mesh.count = w;
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---- shader helpers for the mesh effects ----
const FX2_RAMP = /* glsl */`vec3 ramp3(vec3 e, vec3 m, vec3 c, float h) { h = clamp(h, 0.0, 1.0); return h < 0.5 ? mix(e, m, h * 2.0) : mix(m, c, h * 2.0 - 1.0); }`;
function fx2PalUniforms(pal) { const P = FX2.pal(pal); return { uE: { value: P.edge.clone() }, uM: { value: P.mid.clone() }, uC: { value: P.core.clone() } }; }

const FX2 = {
  ready: false, items: [], palList: [], palMap: {},
  palArr: Array.from({ length: 120 }, () => new THREE.Vector3()), smkArr: Array.from({ length: 40 }, () => new THREE.Vector3()),   // up to 40 palettes (160 vec3 uniforms: well inside WebGL2's 256)
  // a god's palette: edge (dark), mid, core (hot) for the additive ramp, smoke tint, light and spark colours
  defPal(name, d) {
    let P = this.palMap[name];
    if (!P) { P = { name, id: this.palList.length }; this.palList.push(P); this.palMap[name] = P; }
    P.edge = C3(...d.edge); P.mid = C3(...d.mid); P.core = C3(...d.core); P.smoke = C3(...(d.smoke || [0.1, 0.1, 0.12]));
    P.light = C3(...(d.light || d.mid)); P.spark = C3(...(d.spark || d.core));
    this.palArr[P.id * 3].set(P.edge.r, P.edge.g, P.edge.b); this.palArr[P.id * 3 + 1].set(P.mid.r, P.mid.g, P.mid.b); this.palArr[P.id * 3 + 2].set(P.core.r, P.core.g, P.core.b);
    this.smkArr[P.id].set(P.smoke.r, P.smoke.g, P.smoke.b);
    return P;
  },
  pal(name) { return (typeof name === 'object' && name) ? name : (this.palMap[name] || this.palMap.thoth); },
  // the god palette closest to an old-style colour (by hue), preferring the active god's own family
  palFor(col) {
    if (!col || !col.isColor) return 'thoth';
    const hsl = col.getHSL({ h: 0, s: 0, l: 0 }), h = hsl.h, g = (typeof Kit !== 'undefined' && Kit) ? Kit.id : '';
    if (hsl.s < 0.12) return g === 'skadi' ? 'frost' : 'thoth';
    if (h < 0.035 || h >= 0.96) return g === 'bastet' ? 'blood' : 'molten';
    if (h < 0.11) return g === 'bastet' ? 'bastet' : g === 'bacchus' ? 'wine' : 'ra';
    if (h < 0.18) return g === 'ra' ? 'ra' : g === 'thoth' ? 'thothGold' : 'bastet';
    if (h < 0.42) return 'fart';
    if (h < 0.5) return g === 'thoth' ? 'thoth' : 'turq';
    if (h < 0.66) return g === 'skadi' ? 'skadi' : g === 'hecate' ? 'hpower' : 'thoth';
    if (h < 0.8) return 'hecate';
    return g === 'bacchus' ? 'bacchus' : 'hexpink';
  },
  palId(name) { return name == null ? 0 : (typeof name === 'number' ? name : this.pal(name).id); },
  async init() {
    const L = new THREE.TextureLoader();
    const load = (f) => new Promise((res) => L.load(`assets/fx/${f}.webp`, (t) => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; res(t); }, undefined, () => { console.warn('[fx2] missing', f); res(null); }));
    const [atlas, fire, burst, smoke, noise] = await Promise.all(['atlas', 'fire', 'burst', 'smoke', 'noise'].map(load));
    if (noise) { noise.wrapS = noise.wrapT = THREE.RepeatWrapping; }
    this.tex = { atlas, fire, burst, smoke, noise };
    this.glow = new FX2System(5000, atlas, 'add', { soft: 0.3 });
    this.fire = new FX2System(1600, fire, 'add', { soft: 0.25 });
    this.boom = new FX2System(500, burst, 'add', { soft: 0.2, order: 12 });
    this.smoke = new FX2System(1800, smoke, 'lit', { soft: 0.5, order: 9 });
    this.solid = new FX2System(1200, atlas, 'lit', { soft: 0.2, order: 9 });
    this.distort = new FX2Distort(200); this.distort.mat.uniforms.uNoise.value = noise;
    this.rocks = new FX2Debris(320, false); this.embers = new FX2Debris(200, true);
    this.ready = true;
  },
  update(dt, time) {
    if (!this.ready) return;
    this.glow.update(dt, time); this.fire.update(dt, time); this.boom.update(dt, time); this.smoke.update(dt, time); this.solid.update(dt, time);
    this.distort.update(dt, time); this.rocks.update(dt); this.embers.update(dt);
    this.items = this.items.filter((o) => { o.t = (o.t || 0) + dt; const keep = !o.dead && o.update(dt, time); if (!keep && o.dispose) o.dispose(); return keep; });
  },
  add(o) { if (Net.ctx) Net.adopt(o); this.items.push(o); return o; },
  clear() {
    if (!this.ready) return;
    for (const o of this.items) if (o.dispose) o.dispose();
    this.items = [];
    for (const s of [this.glow, this.fire, this.boom, this.smoke, this.solid]) s.clear();
    this.distort.list.length = 0; this.rocks.list.length = 0; this.embers.list.length = 0;
  },
  // ---- lights: borrow VFX's flash lights, optionally following a moving point ----
  light(pos, color, intensity = 20, dur = 0.5, follow = null) {
    if (Net.ctx && Net.ctx.fxK < 0.6) return null;   // (as VFX.flash)
    VFX.flash(follow || pos, color, intensity, dur);
    const L = VFX.lights.find((x) => x.t === 0 && x.l.color.equals(color));
    if (L && follow) L.fol = follow;
    return L;
  },

  // ====================================================================================== mesh effects
  // a flat energy ring that races out along the ground (with a distortion ring)
  ring(pos, pal, o = {}) {
    if (!this.ready) return null;
    const R = o.radius ?? 4, dur = o.dur ?? 0.6, P = this.pal(pal);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { ...fx2PalUniforms(P), uNoise: { value: this.tex.noise }, uK: { value: 0 }, uA: { value: 1 }, uW: { value: o.width ?? 0.08 }, uInt: { value: o.int ?? 1.4 }, uTime: { value: 0 }, uSeed: { value: Math.random() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FX2_RAMP + /* glsl */`
        uniform sampler2D uNoise; uniform vec3 uE, uM, uC; uniform float uK, uA, uW, uInt, uTime, uSeed; varying vec2 vUv;
        void main() {
          vec2 d = (vUv - 0.5) * 2.0; float r = length(d); if (r > 1.0) discard;
          float th = atan(d.y, d.x) / 6.2831853 + 0.5;
          float n = texture2D(uNoise, vec2(th * 4.0 + uSeed, r * 0.6 - uTime * 0.35)).r;
          float n2 = texture2D(uNoise, vec2(th * 9.0 - uSeed, r * 1.4 - uTime * 0.6)).g;
          float edge = 0.08 + 0.9 * (1.0 - pow(1.0 - uK, 2.4));
          float w = uW * (1.0 + uK * 1.6);
          float q = (r - edge) / w; float prof = exp(-q * q) * (0.55 + 0.9 * n);   // (pow() of a negative base is NaN on some GPUs)
          float fill = smoothstep(edge, 0.0, r) * 0.35 * n2 * (1.0 - uK);
          float h = clamp(prof * 1.3 + fill * 0.8, 0.0, 1.0) * (1.0 - uK * 0.55);
          float a = (prof + fill) * uA;
          gl_FragColor = vec4(ramp3(uE, uM, uC, h) * a * uInt, 0.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, (o.y ?? 0.04), pos.z); m.renderOrder = 8; scene.add(m);
    if (o.distort !== false) this.distort.ring(V3(pos.x, (o.y ?? 0.04) + 0.3, pos.z), R * 2.1, o.distortK ?? 0.018, dur * 0.9);
    return this.add({ update(dt, time) { const k = this.t / dur; mat.uniforms.uK.value = Math.min(1, k); mat.uniforms.uTime.value = time; mat.uniforms.uA.value = 1 - smoothstep(0.55, 1, k); if (o.follow) m.position.set(o.follow.x, m.position.y, o.follow.z); return k < 1; },
      dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } });
  },
  // a twisting energy funnel / column (tornado, portal vortex, aura cylinder); handle.dead fades it out
  tornado(pos, pal, o = {}) {
    if (!this.ready) return null;
    const P = this.pal(pal), r0 = o.r0 ?? 1, r1 = o.r1 ?? 1.6, H = o.height ?? 4, dur = o.dur ?? 2;
    const geo = new THREE.CylinderGeometry(r1, r0, H, 64, 24, true); geo.translate(0, H / 2, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { ...fx2PalUniforms(P), uNoise: { value: this.tex.noise }, uA: { value: 0 }, uTime: { value: 0 }, uTwist: { value: o.twist ?? 1.2 }, uSpin: { value: o.spin ?? 0.6 }, uRise: { value: o.rise ?? 0.8 }, uInt: { value: o.int ?? 1.2 }, uDens: { value: o.density ?? 0.5 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: FX2_RAMP + /* glsl */`
        uniform sampler2D uNoise; uniform vec3 uE, uM, uC; uniform float uA, uTime, uTwist, uSpin, uRise, uInt, uDens; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          float u = vUv.x + vUv.y * uTwist + uTime * uSpin;
          float n = texture2D(uNoise, vec2(u * 2.0, vUv.y * 1.2 - uTime * uRise)).r;
          float n2 = texture2D(uNoise, vec2(u * 5.0 + 0.3, vUv.y * 2.5 - uTime * uRise * 1.7)).g;
          float bands = smoothstep(1.0 - uDens, 1.0, n * 0.75 + n2 * 0.45);
          float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.6);
          float ends = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
          float a = (bands * 0.9 + fres * 0.25 * n) * ends * uA;
          gl_FragColor = vec4(ramp3(uE, uM, uC, (bands * 0.62 + n2 * 0.22)) * a * uInt, 0.0);   // stays in the saturated mid tones
        }`,
    });
    const m = new THREE.Mesh(geo, mat); m.position.set(pos.x, pos.y || 0, pos.z); m.renderOrder = 9; m.frustumCulled = false; scene.add(m);
    const h = { m, mat, dead: false, alpha: 0, target: o.alpha ?? 1 };
    this.add({ update(dt, time) {
      h.alpha = damp(h.alpha, h.dead ? 0 : h.target, h.dead ? 6 : (o.k ?? 5), dt); mat.uniforms.uA.value = h.alpha; mat.uniforms.uTime.value = time;
      if (o.follow) m.position.set(o.follow.x, (o.follow.y || 0) + (o.y ?? 0), o.follow.z);
      if (this.t > dur && dur > 0) h.dead = true;
      return !(h.dead && h.alpha < 0.01);
    }, dispose() { scene.remove(m); geo.dispose(); mat.dispose(); } });
    return h;
  },
  // an energy sphere / dome (fresnel + flowing noise)
  sphere(pos, pal, o = {}) {
    if (!this.ready) return null;
    const P = this.pal(pal), R = o.radius ?? 2, dur = o.dur ?? 0.6;
    const geo = new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, o.dome ? Math.PI / 2 : Math.PI);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { ...fx2PalUniforms(P), uNoise: { value: this.tex.noise }, uA: { value: 0 }, uTime: { value: 0 }, uInt: { value: o.int ?? 1.0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: FX2_RAMP + /* glsl */`
        uniform sampler2D uNoise; uniform vec3 uE, uM, uC; uniform float uA, uTime, uInt; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
          float n = texture2D(uNoise, vec2(atan(vP.z, vP.x) * 0.4775 + uTime * 0.1, vP.y * 0.8 - uTime * 0.35)).r;
          float h = fres * 1.1 + n * 0.35 * fres;
          gl_FragColor = vec4(ramp3(uE, uM, uC, h) * (fres * 0.9 + n * 0.15) * uA * uInt, 0.0);
        }`,
    });
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.renderOrder = 9; m.frustumCulled = false; scene.add(m);
    const h = { m, mat, dead: false };
    this.add({ update(dt, time) {
      const k = Math.min(1, this.t / dur);
      if (o.hold) { mat.uniforms.uA.value = damp(mat.uniforms.uA.value, h.dead ? 0 : 1, h.dead ? 6 : 8, dt); m.scale.setScalar(R); if (o.follow) m.position.set(o.follow.x, (o.follow.y || 0) + (o.y ?? 0), o.follow.z); }
      else { m.scale.setScalar(R * (0.2 + 0.8 * easeOutCubic(k))); mat.uniforms.uA.value = (1 - k) * (1 - k); }
      mat.uniforms.uTime.value = time;
      return o.hold ? !(h.dead && mat.uniforms.uA.value < 0.01) : k < 1;
    }, dispose() { scene.remove(m); geo.dispose(); mat.dispose(); } });
    return h;
  },
  // a sweeping crescent slash (melee swings): arc in the plane given by yaw/tilt, sweeping from a0 to a1
  slash(pos, yaw, pal, o = {}) {
    if (!this.ready) return null;
    const P = this.pal(pal), r0 = o.r0 ?? 0.6, r1 = o.r1 ?? 1.8, a0 = o.a0 ?? -1.4, a1 = o.a1 ?? 1.4, dur = o.dur ?? 0.28, segs = 40;
    const pos3 = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) { const u = i / segs, a = a0 + (a1 - a0) * u; for (let j = 0; j < 2; j++) { const r = j ? r1 : r0; pos3.push(Math.sin(a) * r, 0, Math.cos(a) * r); uv.push(u, j); } if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { ...fx2PalUniforms(P), uNoise: { value: this.tex.noise }, uK: { value: 0 }, uA: { value: 1 }, uInt: { value: o.int ?? 1.6 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FX2_RAMP + /* glsl */`
        uniform sampler2D uNoise; uniform vec3 uE, uM, uC; uniform float uK, uA, uInt; varying vec2 vUv;
        void main() {
          float head = uK * 1.25;
          float behind = head - vUv.x;
          if (behind < 0.0) discard;
          float tail = exp(-behind * 3.2);
          float n = texture2D(uNoise, vec2(vUv.x * 3.0 - uK * 2.0, vUv.y * 0.8)).r;
          float vy = clamp(vUv.y, 0.0, 1.0), across = pow(vy, 1.6) * smoothstep(1.0, 0.82, vy);   // (clamp: pow() of a tiny negative is NaN)
          float a = tail * across * (0.55 + 0.8 * n) * uA;
          gl_FragColor = vec4(ramp3(uE, uM, uC, tail * across * 1.25) * a * uInt, 0.0);
        }`,
    });
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.rotation.set(o.tilt ?? 0, yaw, o.roll ?? 0, 'YXZ'); m.renderOrder = 11; m.frustumCulled = false; scene.add(m);
    return this.add({ update(dt) { const k = this.t / dur; mat.uniforms.uK.value = k; mat.uniforms.uA.value = 1 - smoothstep(0.6, 1.0, k); if (o.follow) m.position.copy(o.follow); return k < 1; }, dispose() { scene.remove(m); geo.dispose(); mat.dispose(); } });
  },
  // a glowing burn on the floor that cools from hot core to a dark scorch
  scorch(pos, pal, o = {}) {
    if (!this.ready) return null;
    const P = this.pal(pal), R = o.radius ?? 2, dur = o.dur ?? 3;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { ...fx2PalUniforms(P), uNoise: { value: this.tex.noise }, uK: { value: 0 }, uDark: { value: (o.dark ?? P.smoke).clone() }, uDarkA: { value: o.darkAlpha ?? 0.55 }, uInt: { value: o.int ?? 1.4 }, uSeed: { value: Math.random() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FX2_RAMP + /* glsl */`
        uniform sampler2D uNoise; uniform vec3 uE, uM, uC, uDark; uniform float uK, uDarkA, uInt, uSeed; varying vec2 vUv;
        void main() {
          vec2 d = (vUv - 0.5) * 2.0; float r = length(d); if (r > 1.0) discard;
          float n = texture2D(uNoise, vUv * 1.3 + uSeed).r, c = texture2D(uNoise, vUv * 2.2 - uSeed).b;
          float shape = smoothstep(1.0, 0.35, r + (n - 0.5) * 0.55);
          float cracks = smoothstep(0.12, 0.0, c) * shape;
          float heat = (1.0 - uK) * (1.0 - uK);
          float glow = (shape * 0.35 + cracks * 1.2) * heat;
          float darkA = shape * uDarkA * (1.0 - smoothstep(0.75, 1.0, uK));
          vec3 col = uDark * darkA + ramp3(uE, uM, uC, glow) * glow * uInt * (1.0 - smoothstep(0.85, 1.0, uK));
          gl_FragColor = vec4(col, darkA);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, TAU); m.position.set(pos.x, 0.025 + Math.random() * 0.006, pos.z); m.renderOrder = 6; scene.add(m);
    return this.add({ update(dt) { const k = this.t / dur; mat.uniforms.uK.value = Math.min(1, k); return k < 1; }, dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } });
  },

  // ====================================================================================== recipes
  // magic gathering into a point (a hand, an orb, a staff tip): converging motes, an orbiting swirl,
  // a swelling core and light. Returns a handle (.dead stops it early).
  charge(follow, pal, o = {}) {
    if (!this.ready) return { dead: true };
    const P = this.pal(pal), dur = o.dur ?? 1, R = o.radius ?? 1.4, rate = o.rate ?? 70, size = o.size ?? 1;
    const h = { dead: false };
    let acc = 0, swirlAcc = 0;
    const core = this.glow.spawn({ pos: follow, follow, life: dur + 0.15, size: 0.2 * size, sizeEnd: 0.9 * size, sizePow: 2, cell: FXA.core, pal, temp: 0.9, tempEnd: 1.2, int: 1.6, fadeIn: 0.1, fadeOut: 0.92, rotVel: 2 });
    core.x = follow.x; core.y = follow.y; core.z = follow.z; core.fx = follow.x; core.fy = follow.y; core.fz = follow.z;
    this.add({ update(dt, time) {
      if (h.dead) return false;
      const k = Math.min(1, this.t / dur);
      acc += dt * rate * (0.4 + k);
      while (acc > 1) {
        acc--;
        _fq.set(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(R * rand(0.6, 1.1));
        FX2.glow.spawn({ pos: _fq2.copy(follow).add(_fq), vel: _fq.clone().multiplyScalar(-0.5), life: rand(0.35, 0.6), size: rand(0.05, 0.11) * size, sizeEnd: 0.02, cell: Math.random() < 0.7 ? FXA.ember : FXA.spark, stretch: 1.5, pal, temp: 1.1, tempEnd: 0.6, int: 1.8, attract: { x: follow.x, y: follow.y, z: follow.z, strength: 26 + 30 * k, kill: 0.12 } });
      }
      swirlAcc += dt * 26;
      while (swirlAcc > 1) { swirlAcc--; FX2.glow.spawn({ pos: follow, life: rand(0.4, 0.7), size: rand(0.12, 0.22) * size, sizeEnd: 0.03, cell: FXA.wisp, stretch: 1.2, pal, temp: 0.9, tempEnd: 0.4, int: 1.4, orbit: { c: follow, r: R * rand(0.35, 0.6) * (1 - k * 0.5), w: rand(5, 8) * (Math.random() < 0.5 ? -1 : 1), vr: -0.3, y: rand(-0.3, 0.3) } }); }
      if (Math.random() < dt * 6) FX2.light(follow, P.light, 6 + 10 * k, 0.25, follow);
      return this.t < dur;
    } });
    return h;
  },
  // a magic explosion in the air: core flash, flipbook burst, sparks, embers, glowing smoke, light, distortion
  burst(pos, pal, o = {}) {
    if (!this.ready) return;
    const P = this.pal(pal), s = o.size ?? 1, sp = o.sparks ?? 34;
    this.glow.spawn({ pos, life: 0.2, size: 1.1 * s, sizeEnd: 2.8 * s, cell: FXA.core, pal, temp: 0.95, tempEnd: 0.6, int: 1.5, fadeIn: 0, fadeOut: 0.2 });
    this.glow.spawn({ pos, life: 0.3, size: 2.0 * s, sizeEnd: 4.0 * s, cell: FXA.flare, pal, temp: 0.9, tempEnd: 0.5, int: 0.85, fadeIn: 0, fadeOut: 0.3, rot: rand(-0.2, 0.2), rotVel: 0 });
    for (let i = 0; i < (o.bursts ?? 2); i++) this.boom.spawn({ pos: _fq.copy(pos).add(_fq2.set(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2)).multiplyScalar(s)), life: rand(0.45, 0.65) * (o.life ?? 1), size: 2.2 * s * rand(0.85, 1.15), sizeEnd: 4.0 * s, frames: 16, pal, temp: 0.95, tempEnd: 0.55, int: o.int ?? 1.15, fadeIn: 0, fadeOut: 0.45 });
    for (let i = 0; i < sp; i++) {
      _fq.set(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 13) * s);
      this.glow.spawn({ pos, vel: _fq.clone(), life: rand(0.35, 0.8), size: rand(0.06, 0.13) * Math.sqrt(s), sizeEnd: 0.02, cell: FXA.spark, stretch: 3, pal, temp: 1.2, tempEnd: 0.5, int: 2.0, drag: 2.2, gravity: -7, fadeIn: 0 });
    }
    for (let i = 0; i < (o.embers ?? 18); i++) {
      _fq.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1, 4) * s);
      this.glow.spawn({ pos: _fq2.copy(pos).addScaledVector(_fq, 0.15), vel: _fq.clone(), life: rand(0.9, 1.8), size: rand(0.05, 0.1), sizeEnd: 0.015, cell: FXA.ember, pal, temp: 1.0, tempEnd: 0.4, int: 1.8, drag: 1.4, gravity: 0.8, turb: 3, fadeIn: 0.05 });
    }
    if (o.smoke !== false) for (let i = 0; i < (o.puffs ?? 6); i++) {
      _fq.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
      this.smoke.spawn({ pos: _fq2.copy(pos).addScaledVector(_fq, 0.5 * s), vel: _fq.clone().multiplyScalar(rand(1.2, 2.6) * s).add(_fq3.set(0, 0.6, 0)), life: rand(1.1, 1.9), size: rand(1.0, 1.6) * s, sizeEnd: rand(2.4, 3.4) * s, frames: 16, pal, temp: o.smokeGlow ?? 0.9, tempEnd: 0, int: 1.4, alpha: o.smokeAlpha ?? 0.85, drag: 2.2, turb: 0.8, fadeIn: 0.05, fadeOut: 0.5 });
    }
    if (o.light !== false) VFX.flash(pos, P.light, 18 * s, 0.4);
    if (o.distort !== false) { this.distort.ring(pos, 6 * s, 0.022 * Math.min(1.5, s), 0.45); this.distort.heat(pos, 3 * s, 0.006, 0.9); }
    if (o.debris) this.debris(pos, P, o.debris, s);
  },
  // something slams the ground: burst + racing ring + scorch + dust wall + debris + cracks
  impact(pos, pal, o = {}) {
    if (!this.ready) return;
    const P = this.pal(pal), s = o.size ?? 1, g = _fq3.set(pos.x, 0, pos.z).clone();
    this.burst(g.clone().setY(0.5 * s), P, { size: s * 0.9, sparks: o.sparks ?? 40, embers: 20, puffs: 0, light: true, distort: false, int: o.int });
    this.ring(g, P, { radius: (o.ring ?? 4) * s, dur: o.ringDur ?? 0.55, width: 0.07, int: 1.6, distortK: 0.024 });
    this.scorch(g, P, { radius: 1.6 * s, dur: o.scorchDur ?? 3.2 });
    // the dust wall: lit smoke rolling outward along the floor
    const n = Math.round(12 * Math.min(2, s));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      this.smoke.spawn({ pos: V3(g.x + Math.cos(a) * 0.5 * s, 0.35 * s, g.z + Math.sin(a) * 0.5 * s), vel: V3(Math.cos(a) * rand(4, 7) * s, rand(0.3, 1.0), Math.sin(a) * rand(4, 7) * s), life: rand(1.0, 1.7), size: 0.8 * s, sizeEnd: 2.4 * s, frames: 16, pal: o.dustPal || 'dust', temp: o.dustGlow ?? 0.2, tempEnd: 0, int: 1, alpha: 0.75, drag: 3.2, turb: 0.6, fadeIn: 0.03, fadeOut: 0.45 });
    }
    if (o.debris !== 0) this.debris(g.clone().setY(0.3), o.rockColor || null, o.debris ?? 14, s, o.glowRocks ? P : null);
    VFX.cracks(g, 1.6 * s, o.scorchDur ?? 2.6, { grow: 0.12, intensity: 1.0, color: P.mid });
    Cam.shake = Math.max(Cam.shake, 0.35 * Math.min(2, s));
  },
  // chunks flying out (stone by default; pass a palette to make glowing magic chunks too)
  debris(pos, color, n = 12, s = 1, glowPal = null) {
    if (!this.ready) return;
    const col = color && color.isColor ? color : (color && color.smoke ? null : null);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(3, 8) * s;
      this.rocks.spawn({ pos: _fq.copy(pos).add(_fq2.set(rand(-0.3, 0.3), rand(0, 0.3), rand(-0.3, 0.3))), vel: V3(Math.cos(a) * sp * 0.55, rand(4, 9) * Math.sqrt(s), Math.sin(a) * sp * 0.55), size: rand(0.08, 0.22) * Math.sqrt(s), color: col || _fxCol.setHSL(0.08, 0.15, rand(0.32, 0.5)) });
    }
    if (glowPal) for (let i = 0; i < Math.ceil(n / 3); i++) {
      const a = rand(0, TAU), sp = rand(3, 7) * s;
      this.embers.spawn({ pos: _fq.copy(pos), vel: V3(Math.cos(a) * sp * 0.5, rand(5, 9), Math.sin(a) * sp * 0.5), size: rand(0.06, 0.14), color: glowPal.mid, fadeColor: glowPal.edge, life: rand(1.0, 1.8) });
    }
  },
  // magic clinging to a body: orbiting wisps, rising embers, a ground glow ring. Returns a handle.
  aura(follow, pal, o = {}) {
    if (!this.ready) return { dead: true };
    const h = { dead: false, rate: o.rate ?? 22 }, R = o.radius ?? 0.9, H = o.height ?? 2.0, dur = o.dur ?? 0;
    let a1 = 0, a2 = 0;
    const AURA_K = 0.62;   // realism pass: every lingering aura (buffs, auras around the gods) spawns ~40 % fewer particles
    this.add({ update(dt) {
      if (h.dead || (dur && this.t > dur)) return false;
      a1 += dt * h.rate * 0.6 * AURA_K; a2 += dt * h.rate * 0.5 * AURA_K;
      while (a1 > 1) { a1--; FX2.glow.spawn({ pos: follow, life: rand(0.6, 1.1), size: rand(0.1, 0.2) * (o.size ?? 1), sizeEnd: 0.02, cell: Math.random() < 0.5 ? FXA.wisp : FXA.spark, stretch: 1.4, pal, temp: 1.0, tempEnd: 0.35, int: o.int ?? 1.4, orbit: { c: follow, r: R * rand(0.8, 1.15), w: rand(1.2, 2.2) * (o.dir ?? (Math.random() < 0.5 ? -1 : 1)), vy: rand(0.4, 1.4), y: rand(0.05, H * 0.6), wob: 0.08 } }); }
      while (a2 > 1) { a2--; const a = rand(0, TAU), r = R * Math.sqrt(Math.random()); FX2.glow.spawn({ pos: V3(follow.x + Math.cos(a) * r, (follow.y || 0) + rand(0, 0.4), follow.z + Math.sin(a) * r), vel: V3(rand(-0.3, 0.3), rand(0.8, 2.0), rand(-0.3, 0.3)), life: rand(0.8, 1.5), size: rand(0.04, 0.08), sizeEnd: 0.01, cell: FXA.ember, pal, temp: 1.1, tempEnd: 0.4, int: 1.6, turb: 2, drag: 0.5 }); }
      return true;
    } });
    return h;
  },
  // a projectile's wake: call every frame with the projectile position (+ velocity)
  trailTick(pos, vel, pal, dt, o = {}) {
    if (!this.ready) return;
    const k = o.k ?? 1;
    if (Math.random() < dt * 70 * k) this.glow.spawn({ pos: _fq.copy(pos).add(_fq2.set(rand(-0.08, 0.08), rand(-0.08, 0.08), rand(-0.08, 0.08))), vel: vel ? _fq2.copy(vel).multiplyScalar(-0.08).add(_fq3.set(rand(-0.6, 0.6), rand(-0.3, 0.9), rand(-0.6, 0.6))).clone() : null, life: rand(0.3, 0.6), size: rand(0.05, 0.1) * (o.size ?? 1), sizeEnd: 0.01, cell: FXA.ember, pal, temp: 1.1, tempEnd: 0.4, int: 1.8, turb: 2.5, drag: 1.2 });
    if (Math.random() < dt * 26 * k) this.glow.spawn({ pos, vel: vel ? vel.clone().multiplyScalar(0.25) : null, life: rand(0.2, 0.35), size: rand(0.25, 0.4) * (o.size ?? 1), sizeEnd: 0.06, cell: FXA.wisp, pal, temp: 0.9, tempEnd: 0.4, int: 1.2, rotVel: rand(-6, 6) });
    if (o.smoke !== false && Math.random() < dt * 14 * k) this.smoke.spawn({ pos, vel: V3(rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3)), life: rand(0.6, 1.0), size: 0.25 * (o.size ?? 1), sizeEnd: 0.8 * (o.size ?? 1), frames: 16, pal, temp: 0.7, tempEnd: 0, int: 1.4, alpha: 0.55, drag: 1.5, turb: 0.8 });
  },
  // a low, rolling cloud (frost fog, dark mist, wine vapour, toxic gas). Returns a handle.
  mist(center, pal, o = {}) {
    if (!this.ready) return { dead: true };
    const h = { dead: false, rate: o.rate ?? 18, radius: o.radius ?? 3 }, dur = o.dur ?? 0;
    let acc = 0;
    this.add({ update(dt) {
      if (h.dead || (dur && this.t > dur)) return false;
      acc += dt * h.rate;
      while (acc > 1) {
        acc--;
        const a = rand(0, TAU), r = h.radius * Math.sqrt(Math.random()) * 0.9;
        FX2.smoke.spawn({ pos: V3(center.x + Math.cos(a) * r, rand(0.2, 0.8) * (o.height ?? 1), center.z + Math.sin(a) * r), vel: V3(Math.cos(a) * rand(0.1, 0.6) + rand(-0.2, 0.2), rand(0.05, 0.35) * (o.rise ?? 1), Math.sin(a) * rand(0.1, 0.6)), life: rand(1.8, 3.0), size: rand(1.0, 1.8) * (o.size ?? 1), sizeEnd: rand(2.2, 3.4) * (o.size ?? 1), frames: 16, pal, temp: o.glow ?? 0.35, tempEnd: 0, int: o.int ?? 1.2, alpha: o.alpha ?? 0.6, drag: 0.6, turb: 0.4, fadeIn: 0.4, fadeOut: 0.5, rotVel: rand(-0.3, 0.3) });
      }
      return true;
    } });
    return h;
  },
  // a swirling column of particles + a twisting funnel mesh. Returns { tornado, dead }
  vortex(pos, pal, o = {}) {
    if (!this.ready) return { dead: true };
    const R = o.radius ?? 2, H = o.height ?? 5, dur = o.dur ?? 2;
    const tor = this.tornado(pos, pal, { r0: R * 0.35, r1: R, height: Math.min(H, 1.6), dur, twist: 1.2, spin: (o.spin ?? 0.9) * 0.6, rise: 0.5, int: (o.int ?? 1.0) * 0.6, density: 0.35, alpha: 0.28, follow: o.follow });
    const h = { dead: false, tornado: tor };
    let acc = 0;
    const c = o.follow || pos;
    this.add({ update(dt) {
      if (h.dead || this.t > dur) { if (tor) tor.dead = true; return false; }
      acc += dt * (o.rate ?? 60) * 0.4;
      while (acc > 1) { acc--; const y = o.down ? rand(H * 0.3, H) : rand(0, H * 0.9), r = lerp(R * 0.35, R, y / H) * rand(0.8, 1.1); FX2.glow.spawn({ pos: c, life: rand(0.5, 1.0), size: rand(0.08, 0.16) * (o.size ?? 1), sizeEnd: 0.02, cell: Math.random() < 0.6 ? FXA.spark : FXA.wisp, stretch: 2, pal, temp: 1.0, tempEnd: 0.4, int: 1.6, orbit: { c, r, w: (o.spin ?? 0.9) * 3.5 * (o.dir ?? 1), vy: o.down ? -rand(1.0, 3.0) : rand(0.5, 2.5), vr: o.vr ?? 0, y } }); }
      return true;
    } });
    return h;
  },
  // a cone of stuff blown out from a point (breath, belch, gas, frost). Returns a handle.
  spray(origin, dir, pal, o = {}) {
    if (!this.ready) return { dead: true };
    const h = { dead: false, dir: dir.clone() }, dur = o.dur ?? 1, cone = o.cone ?? 0.5, speed = o.speed ?? 10;
    let acc = 0, accS = 0;
    this.add({ update(dt) {
      if (h.dead || this.t > dur) return false;
      acc += dt * (o.rate ?? 120); accS += dt * (o.smokeRate ?? 26);
      const side = _fq3.set(h.dir.z, 0, -h.dir.x);
      while (acc > 1) { acc--; _fq.copy(h.dir).addScaledVector(side, rand(-cone, cone)).add(_fq2.set(0, rand(-cone, cone) * 0.5, 0)).normalize().multiplyScalar(speed * rand(0.7, 1.2)); FX2.glow.spawn({ pos: origin, vel: _fq.clone(), life: rand(0.3, 0.6), size: rand(0.08, 0.16), sizeEnd: 0.03, cell: o.cell ?? FXA.spark, stretch: 2.2, pal, temp: 1.1, tempEnd: 0.4, int: 1.6, drag: 1.5, turb: 1.5 }); }
      while (accS > 1) { accS--; _fq.copy(h.dir).addScaledVector(side, rand(-cone, cone) * 0.8).normalize().multiplyScalar(speed * rand(0.35, 0.6)); FX2.smoke.spawn({ pos: origin, vel: _fq.clone(), life: rand(0.8, 1.3), size: 0.4, sizeEnd: rand(2.0, 2.8) * (o.smokeSize ?? 1), frames: 16, pal, temp: o.glow ?? 0.6, tempEnd: 0, int: 1.4, alpha: 0.75, drag: 2.0, turb: 0.8, fadeIn: 0.05 }); }
      return true;
    } });
    return h;
  },
  // drifting motes falling from above an area (golden rain, snow, petals, glitter)
  rain(center, pal, o = {}) {
    if (!this.ready) return { dead: true };
    const h = { dead: false }, R = o.radius ?? 4, dur = o.dur ?? 2;
    let acc = 0;
    this.add({ update(dt) {
      if (h.dead || this.t > dur) return false;
      acc += dt * (o.rate ?? 80);
      while (acc > 1) { acc--; const a = rand(0, TAU), r = R * Math.sqrt(Math.random()); FX2.glow.spawn({ pos: V3(center.x + Math.cos(a) * r, rand(3, 7), center.z + Math.sin(a) * r), vel: V3(rand(-0.4, 0.4), -rand(2, 5) * (o.fall ?? 1), rand(-0.4, 0.4)), life: rand(1.0, 1.8), size: rand(0.05, 0.1), sizeEnd: 0.02, cell: o.cell ?? FXA.spark, stretch: 1.5, pal, temp: 1.0, tempEnd: 0.6, int: 1.6, turb: 1.5 }); }
      return true;
    } });
    return h;
  },
};

// the gods' palettes (deep and saturated - the hot core is the only near-white part)
FX2.defPal('thoth', { edge: [0.0, 0.05, 0.3], mid: [0.0, 0.45, 1.0], core: [0.3, 0.85, 1.0], smoke: [0.03, 0.06, 0.14], light: [0.1, 0.6, 1.0], spark: [0.4, 0.88, 1.0] });
FX2.defPal('thothGold', { edge: [0.35, 0.08, 0.0], mid: [1.0, 0.55, 0.05], core: [1.0, 0.8, 0.35], smoke: [0.12, 0.07, 0.03], light: [1.0, 0.6, 0.15] });
FX2.defPal('skadi', { edge: [0.0, 0.08, 0.35], mid: [0.15, 0.5, 1.0], core: [0.55, 0.86, 1.0], smoke: [0.36, 0.46, 0.66], light: [0.35, 0.65, 1.0], spark: [0.8, 0.95, 1.0] });
FX2.defPal('frost', { edge: [0.02, 0.1, 0.3], mid: [0.25, 0.6, 1.0], core: [0.68, 0.9, 1.0], smoke: [0.62, 0.72, 0.88], light: [0.5, 0.75, 1.0] });
FX2.defPal('bastet', { edge: [0.35, 0.05, 0.0], mid: [1.0, 0.55, 0.06], core: [1.0, 0.82, 0.35], smoke: [0.28, 0.2, 0.1], light: [1.0, 0.65, 0.2], spark: [1.0, 0.85, 0.4] });
FX2.defPal('turq', { edge: [0.0, 0.18, 0.2], mid: [0.0, 0.8, 0.75], core: [0.45, 1.0, 0.9], smoke: [0.05, 0.16, 0.16], light: [0.1, 0.9, 0.8] });
FX2.defPal('hecate', { edge: [0.12, 0.0, 0.25], mid: [0.62, 0.08, 1.0], core: [0.95, 0.45, 1.0], smoke: [0.035, 0.0, 0.06], light: [0.6, 0.15, 1.0], spark: [1.0, 0.45, 0.9] });
FX2.defPal('hpower', { edge: [0.0, 0.04, 0.35], mid: [0.12, 0.38, 1.0], core: [0.45, 0.68, 1.0], smoke: [0.02, 0.03, 0.12], light: [0.3, 0.5, 1.0] });
FX2.defPal('hexpink', { edge: [0.25, 0.0, 0.15], mid: [1.0, 0.12, 0.6], core: [1.0, 0.55, 0.9], smoke: [0.06, 0.0, 0.05], light: [1.0, 0.2, 0.7] });
FX2.defPal('ra', { edge: [0.45, 0.04, 0.0], mid: [1.0, 0.42, 0.04], core: [1.0, 0.74, 0.3], smoke: [0.12, 0.05, 0.025], light: [1.0, 0.5, 0.1], spark: [1.0, 0.75, 0.3] });
FX2.defPal('bacchus', { edge: [0.18, 0.0, 0.1], mid: [0.6, 0.03, 0.34], core: [1.0, 0.36, 0.6], smoke: [0.16, 0.02, 0.1], light: [0.8, 0.1, 0.4], spark: [1.0, 0.5, 0.72] });
FX2.defPal('fart', { edge: [0.04, 0.16, 0.0], mid: [0.3, 0.8, 0.03], core: [0.58, 1.0, 0.14], smoke: [0.2, 0.4, 0.05], light: [0.4, 1.0, 0.1], spark: [0.75, 1.0, 0.3] });
FX2.defPal('snow', { edge: [0.02, 0.12, 0.4], mid: [0.2, 0.55, 1.0], core: [0.6, 0.86, 1.0], smoke: [0.46, 0.58, 0.82], light: [0.4, 0.7, 1.0] });
FX2.defPal('chaos', { edge: [0.1, 0.0, 0.16], mid: [0.48, 0.04, 0.62], core: [1.0, 0.3, 0.2], smoke: [0.07, 0.02, 0.08], light: [0.6, 0.1, 0.8] });
FX2.defPal('molten', { edge: [0.35, 0.02, 0.0], mid: [1.0, 0.24, 0.02], core: [1.0, 0.62, 0.18], smoke: [0.1, 0.03, 0.04], light: [1.0, 0.3, 0.05] });
FX2.defPal('sand', { edge: [0.3, 0.12, 0.02], mid: [0.9, 0.55, 0.15], core: [1.0, 0.8, 0.4], smoke: [0.62, 0.46, 0.28], light: [1.0, 0.6, 0.2] });
FX2.defPal('blood', { edge: [0.2, 0.0, 0.0], mid: [0.7, 0.02, 0.04], core: [1.0, 0.25, 0.15], smoke: [0.45, 0.02, 0.03] });
FX2.defPal('dust', { edge: [0.2, 0.12, 0.05], mid: [0.6, 0.4, 0.15], core: [1.0, 0.8, 0.5], smoke: [0.5, 0.42, 0.32] });
FX2.defPal('leaf', { edge: [0.05, 0.2, 0.0], mid: [0.3, 0.6, 0.1], core: [0.7, 1.0, 0.4], smoke: [0.22, 0.45, 0.12] });
FX2.defPal('wine', { edge: [0.15, 0.0, 0.05], mid: [0.55, 0.02, 0.15], core: [1.0, 0.32, 0.45], smoke: [0.26, 0.01, 0.07], light: [0.75, 0.05, 0.2] });
// Bacchus: purple grapes, and the dark, thick body of a toxic gas cloud (the bright 'fart' rides on top)
FX2.defPal('grape', { edge: [0.1, 0.0, 0.2], mid: [0.45, 0.04, 0.8], core: [0.85, 0.45, 1.0], smoke: [0.12, 0.02, 0.2], light: [0.5, 0.1, 0.9], spark: [0.9, 0.55, 1.0] });
FX2.defPal('toxic', { edge: [0.02, 0.1, 0.0], mid: [0.22, 0.7, 0.0], core: [0.62, 1.0, 0.12], smoke: [0.09, 0.24, 0.02], light: [0.35, 0.95, 0.05], spark: [0.75, 1.0, 0.3] });


// ============================================================================
// VFX: GPU billboard particles, ribbon trails, ground decals, light flashes,
// glyph orbs, the Glyph of Pain wall and Final Judgement's formation.
// ============================================================================
const COL = {
  glyph: new THREE.Color(0.06, 0.6, 1.0),      // Thoth's magic: saturated azure / turquoise (never washed-out white)
  glyphHot: new THREE.Color(0.22, 0.84, 1.0),
  cyan: new THREE.Color(0.04, 0.76, 1.0),
  deep: new THREE.Color(0.02, 0.28, 1.0),
  gold: new THREE.Color(1.0, 0.68, 0.2),
  ember: new THREE.Color(1.0, 0.55, 0.16),
  white: new THREE.Color(1, 1, 1),
  teal: new THREE.Color(0.25, 0.95, 0.85),
  red: new THREE.Color(1.0, 0.3, 0.2),
};

class ParticleSystem {
  constructor(max, texture, cols, rows, additive = true) {
    this.max = max; this.list = [];
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.aPos = new Float32Array(max * 3); this.aCol = new Float32Array(max * 4); this.aData = new Float32Array(max * 4); this.aVel = new Float32Array(max * 3);
    const mk = (arr, n) => { const a = new THREE.InstancedBufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('iPos', mk(this.aPos, 3)); g.setAttribute('iCol', mk(this.aCol, 4));
    g.setAttribute('iData', mk(this.aData, 4)); g.setAttribute('iVel', mk(this.aVel, 3));
    g.instanceCount = 0;
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: texture }, grid: { value: new THREE.Vector2(cols, rows) } },
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute vec4 iCol; attribute vec4 iData; attribute vec3 iVel;
        uniform vec2 grid; varying vec2 vUv; varying vec4 vCol;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float size = iData.x, rot = iData.y, cell = iData.z, stretch = iData.w;
          vec2 c = position.xy;
          if (stretch > 0.0) {
            vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
            vec2 d = vv.xy; float l = length(d); d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
            vec2 n = vec2(-d.y, d.x);
            mv.xy += d * c.x * size * (1.0 + stretch) + n * c.y * size * 0.32;
          } else {
            float cs = cos(rot), sn = sin(rot);
            mv.xy += vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) * size;
          }
          gl_Position = projectionMatrix * mv;
          float cx = mod(cell, grid.x), cy = floor(cell / grid.x);
          vUv = (vec2(cx, grid.y - 1.0 - cy) + uv) / grid;
          vCol = iCol;
        }`,
      fragmentShader: additive ? /* glsl */`
        uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        void main() { vec4 t = texture2D(map, vUv); float a = t.a * vCol.a; gl_FragColor = vec4(t.rgb * vCol.rgb * a, a); }`
        : /* glsl */`
        uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb * vCol.rgb, t.a * vCol.a); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }
  spawn(o) {
    const full = this.list.length >= this.max;   // (full: the new one takes an old one's place, a cursor going round; no array shift)
    const c0 = o.color || COL.white, c1 = o.colorEnd || c0;
    const p = {
      x: o.pos.x, y: o.pos.y, z: o.pos.z,
      vx: o.vel ? o.vel.x : 0, vy: o.vel ? o.vel.y : 0, vz: o.vel ? o.vel.z : 0,
      life: 0, max: o.life ?? 1, s0: o.size ?? 0.3, s1: o.sizeEnd ?? (o.size ?? 0.3),
      r0: c0.r, g0: c0.g, b0: c0.b, r1: c1.r, g1: c1.g, b1: c1.b,
      a0: o.alpha ?? 1, a1: o.alphaEnd ?? 0, int: (o.intensity ?? 1) * 0.62,
      rot: o.rot ?? Math.random() * TAU, rv: o.rotVel ?? 0, drag: o.drag ?? 0, grav: o.gravity ?? 0,
      cell: o.cell ?? 0, stretch: o.stretch ?? 0, attract: o.attract || null, fadeIn: o.fadeIn ?? 0.06,
      wob: o.wobble ?? 0, seed: Math.random() * 100,
    };
    if (full) { const i = (this.ev || 0) % this.list.length; this.ev = i + 1; this.list[i] = p; } else this.list.push(p);
    return p;
  }
  update(dt) {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      if (p.attract) {
        const t = p.attract;
        const dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz) || 1e-4;
        const k = (t.strength || 30) * dt;
        p.vx += (dx / d) * k; p.vy += (dy / d) * k; p.vz += (dz / d) * k;
        if (d < (t.kill || 0.15)) { p.life = p.max; continue; }
      }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + p.grav * dt; p.vz *= dr;
      if (p.wob) { p.vx += Math.sin(p.life * 7 + p.seed) * p.wob * dt; p.vz += Math.cos(p.life * 6 + p.seed) * p.wob * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.rv * dt;
      const t = p.life / p.max;
      const fin = p.fadeIn > 0 ? Math.min(1, p.life / p.fadeIn) : 1;
      const a = lerp(p.a0, p.a1, t) * fin;
      const k = p.int;
      this.aPos[w * 3] = p.x; this.aPos[w * 3 + 1] = p.y; this.aPos[w * 3 + 2] = p.z;
      this.aCol[w * 4] = lerp(p.r0, p.r1, t) * k; this.aCol[w * 4 + 1] = lerp(p.g0, p.g1, t) * k; this.aCol[w * 4 + 2] = lerp(p.b0, p.b1, t) * k; this.aCol[w * 4 + 3] = a;
      this.aData[w * 4] = lerp(p.s0, p.s1, t); this.aData[w * 4 + 1] = p.rot; this.aData[w * 4 + 2] = p.cell; this.aData[w * 4 + 3] = p.stretch;
      this.aVel[w * 3] = p.vx; this.aVel[w * 3 + 1] = p.vy; this.aVel[w * 3 + 2] = p.vz;
      L[w] = p;
      w++;
    }
    L.length = w;
    this.geo.instanceCount = w;
    for (const k of ['iPos', 'iCol', 'iData', 'iVel']) this.geo.attributes[k].needsUpdate = true;
  }
}

class Trail {
  constructor(n = 22, width = 0.35, color = COL.glyph, intensity = 2.5, side = null) {
    this.n = n; this.width = width; this.pts = []; this.alive = true; this.fade = 1; this.intensity = intensity; this.side = side;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.alpha = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const edge = new Float32Array(n * 2); for (let i = 0; i < n; i++) { edge[i * 2] = 0; edge[i * 2 + 1] = 1; }
    g.setAttribute('side', new THREE.BufferAttribute(edge, 1));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: color.clone() }, uInt: { value: intensity * 0.6 } },
      vertexShader: `attribute float alpha; attribute float side; varying float vA; varying float vS; void main() { vA = alpha; vS = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // soft energy cross-section: bright core, feathered edges
      fragmentShader: `uniform vec3 uColor; uniform float uInt; varying float vA; varying float vS; void main() { float e = 1.0 - abs(vS * 2.0 - 1.0); float k = e * e * (3.0 - 2.0 * e); float a = vA * k; gl_FragColor = vec4(uColor * uInt * a * (0.6 + 0.8 * k * k), a); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
    scene.add(this.mesh);
  }
  setColor(c, intensity) { this.mat.uniforms.uColor.value.copy(c); if (intensity !== undefined) this.mat.uniforms.uInt.value = intensity * 0.6; }
  push(p) { this.pts.unshift(p.clone()); if (this.pts.length > this.n) this.pts.pop(); }
  update(dt) {
    if (!this.alive) { this.fade -= dt * 3; if (this.pts.length > 1) this.pts.pop(); }
    const n = this.pts.length;
    const camPos = camera.position;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      if (!p) { this.alpha[i * 2] = this.alpha[i * 2 + 1] = 0; continue; }
      const q = this.pts[Math.min(i + 1, n - 1)] || p, pr = this.pts[Math.min(Math.max(i - 1, 0), n - 1)] || p;
      _v1.copy(pr).sub(q); if (_v1.lengthSq() < 1e-8) _v1.set(0, 0, 1);
      if (this.side) _v3.copy(this.side);
      else {
        _v2.copy(p).sub(camPos);
        _v3.crossVectors(_v1, _v2);
        // moving along the view axis: fall back to a vertical ribbon instead of a flipping card
        if (_v3.lengthSq() < 1e-4 * _v1.lengthSq() * _v2.lengthSq()) _v3.set(0, 1, 0); else _v3.normalize();
      }
      const t = i / (this.n - 1);
      const w = this.width * (1 - t) * 0.5;
      this.pos[i * 6] = p.x + _v3.x * w; this.pos[i * 6 + 1] = p.y + _v3.y * w; this.pos[i * 6 + 2] = p.z + _v3.z * w;
      this.pos[i * 6 + 3] = p.x - _v3.x * w; this.pos[i * 6 + 4] = p.y - _v3.y * w; this.pos[i * 6 + 5] = p.z - _v3.z * w;
      const a = (i < n ? 1 : 0) * Math.pow(1 - t, 1.6) * Math.max(0, this.fade);
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
    return this.fade > 0;
  }
  dispose() { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// sprite textures cut from the atlases (for persistent glow objects)
const _spriteTexCache = {};
function atlasCellTexture(atlasTex, index) {
  const key = atlasTex.uuid + ':' + index;
  if (_spriteTexCache[key]) return _spriteTexCache[key];
  const img = atlasTex.image, cols = atlasTex.userData.cols, rows = atlasTex.userData.rows;
  const cw = img.width / cols, chh = img.height / rows;
  const c = cnv(cw, chh), ctx = c.getContext('2d');
  ctx.drawImage(img, (index % cols) * cw, Math.floor(index / cols) * chh, cw, chh, 0, 0, cw, chh);
  const t = toTex(c);
  _spriteTexCache[key] = t;
  return t;
}
function glowSprite(tex, color, size, intensity = 2) {
  const m = new THREE.SpriteMaterial({ map: tex, color: color.clone().multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = 8;
  return s;
}

// ---------------------------------------------------------------------------
// VFX manager
// ---------------------------------------------------------------------------
const VFX = {
  trails: [], flashes: [], timed: [], decals: [], bolts: [], waves: [], cracksList: [], pillars: [],
  init() {
    this.fxTex = makeFxAtlas();
    this.glyphTex = makeGlyphAtlas();
    this.wallGlyphTex = makeWallGlyphTexture();
    this.judgeTex = makeJudgementGlyph();
    this.runeTex = makeRuneCircle();
    this.add = new ParticleSystem(4000, this.fxTex, 4, 4, true);
    this.glyphs = new ParticleSystem(1200, this.glyphTex, 8, 4, true);
    this.smoke = new ParticleSystem(600, this.fxTex, 4, 4, false);
    this.dotTex = atlasCellTexture(this.fxTex, FX.core);
    this.ringTex = atlasCellTexture(this.fxTex, FX.ring);
    this.starTex = atlasCellTexture(this.fxTex, FX.flare);
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0x88ccff, 0, 12, 2); l.userData.fx = true; scene.add(l); this.lights.push({ l, t: 0, max: 1, i0: 0 }); }
    // shard pool for shattering ushabti
    this.shardGeo = new THREE.TetrahedronGeometry(0.09, 0);
    this.shards = [];
    this.crackSets = [makeCrackTextures(4242), makeCrackTextures(977), makeCrackTextures(31337)];
    this.crackTex = this.crackSets[0];
    this.rubbleMat = new THREE.MeshStandardMaterial({ color: 0xbfae94, roughness: 0.95 });
  },
  glyphCell() { return Math.floor(Math.random() * 28); },
  flash(pos, color, intensity = 20, dur = 0.35) {
    if (Net.ctx && Net.ctx.fxK < 0.6) return;   // (another player's cast far away or out of sight keeps the few lights for what is near)
    let best = this.lights[0];
    for (const L of this.lights) if (L.t >= L.max) { best = L; break; } else if (L.t / L.max > best.t / best.max) best = L;
    best.l.position.copy(pos); best.l.color.copy(color); best.i0 = intensity; best.t = 0; best.max = dur; best.fol = null;
  },
  trail(width, color, intensity, n, side = null) { const t = new Trail(n, width, color, intensity, side); if (Net.ctx) t.ctx = Net.ctx; this.trails.push(t); return t; },
  later(delay, fn) { const c = Net.ctx; this.timed.push(c ? { t: delay, fn: () => Net.run(c, fn), ctx: c } : { t: delay, fn }); },   // (a replayed cast's callback runs as that player, 14n_net.js)
  burst(pos, o = {}) {
    const col0 = o.color || COL.glyph;
    if (typeof FX2 !== 'undefined' && FX2.ready && !o.noFx2) {
      const fl = o.flash ?? 1.2, sz = clamp(0.25 + fl * 0.32, 0.3, 1.3);
      FX2.burst(pos, FX2.palFor(col0), { size: sz, sparks: Math.round((o.count ?? 18) * 1.1), embers: Math.round((o.count ?? 18) * 0.6), puffs: fl > 1.1 ? 3 : 1, bursts: 1, distort: fl > 1.4, light: fl > 1.0, int: 0.95 });
    }
    const n = Math.round((o.count ?? 18) * 0.5), col = col0, sp = o.speed ?? 5;
    for (let i = 0; i < n; i++) {
      const v = _v1.set(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(sp * rand(0.4, 1));
      this.add.spawn({ pos, vel: v.clone(), life: rand(0.25, 0.6) * (o.life ?? 1), size: rand(0.05, 0.12) * (o.scale ?? 1), sizeEnd: 0.01, color: col, intensity: o.intensity ?? 3, drag: 3, gravity: o.gravity ?? -3, cell: FX.spark, stretch: 2.5 });
    }
    this.add.spawn({ pos, life: 0.22, size: (o.flash ?? 1.2), sizeEnd: (o.flash ?? 1.2) * 1.6, color: col, intensity: (o.intensity ?? 3) * 0.9, cell: FX.flare, alpha: 1, alphaEnd: 0, fadeIn: 0 });
    this.add.spawn({ pos, life: 0.3, size: (o.flash ?? 1.2) * 0.4, sizeEnd: (o.flash ?? 1.2) * 1.4, color: col, intensity: 1.6, cell: FX.ring, alpha: 0.9, alphaEnd: 0, fadeIn: 0 });
    if (o.glyphs) for (let i = 0; i < o.glyphs; i++) {
      this.glyphs.spawn({ pos, vel: _v1.set(rand(-1, 1), rand(0.3, 1.5), rand(-1, 1)).multiplyScalar(rand(1, 2.5)).clone(), life: rand(0.5, 0.9), size: rand(0.18, 0.3), sizeEnd: 0.05, color: col, intensity: 2.2, drag: 2.5, cell: this.glyphCell(), rot: 0 });
    }
  },
  ring(pos, color, r0, r1, dur, intensity = 2, y = 0.05) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 64), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y, pos.z); m.renderOrder = 7;
    scene.add(m);
    this.decals.push({ m, t: 0, dur, r0, r1, kind: 'ring' });
  },
  decal(pos, tex, color, size, dur, opts = {}) {
    // (realism pass: ground decals glow at 80 % - readable, but the floor stays a floor)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: color.clone().multiplyScalar((opts.intensity ?? 1.6) * 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, opts.y ?? 0.04, pos.z); m.scale.setScalar(size); m.renderOrder = 7;
    scene.add(m);
    const d = { m, t: 0, dur, kind: 'decal', spin: opts.spin ?? 0, grow: opts.grow ?? 0, follow: opts.follow || null, size };
    if (Net.ctx) d.ctx = Net.ctx;   // (its hold() is that player's: 14n_net.js)
    this.decals.push(d);
    return d;
  },
  shatter(pos, mat, count = 22, scale = 1) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.shardGeo, mat);
      m.position.set(pos.x + rand(-0.25, 0.25), pos.y + rand(0.2, 1.6) * scale, pos.z + rand(-0.25, 0.25));
      m.scale.set(rand(0.6, 1.8), rand(0.6, 2.2), rand(0.6, 1.6)).multiplyScalar(scale);
      m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      m.castShadow = false;   // (dozens of tiny shards: not worth a shadow pass each)
      scene.add(m);
      this.shards.push({ m, v: new THREE.Vector3(rand(-3, 3), rand(1.5, 5.5), rand(-3, 3)), av: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), t: 0, life: rand(1.4, 2.2), s: m.scale.clone() });
    }
  },
  update(dt) {
    this.add.update(dt); this.glyphs.update(dt); this.smoke.update(dt);
    this.updateExtra(dt);
    this.trails = this.trails.filter((t) => { if (t.ctx && t.ctx.dead && performance.now() - t.ctx.deadAt > NET_CTX_GRACE) t.alive = false; const ok = t.update(dt); if (!ok) t.dispose(); return ok; });   // (a gone kit's trail nobody let go of fades)
    for (const L of this.lights) { L.t += dt; const k = clamp(1 - L.t / L.max, 0, 1); L.l.intensity = L.i0 * k * k; if (L.fol) { if (L.t < L.max) L.l.position.copy(L.fol); else L.fol = null; } }
    for (const e of this.timed) { e.t -= dt; if (e.t <= 0) { e.fn(); e.done = true; } }
    this.timed = this.timed.filter((e) => !e.done);
    this.decals = this.decals.filter((d) => {
      d.t += dt;
      const k = clamp(d.t / d.dur, 0, 1);
      if (d.kind === 'ring') { const r = lerp(d.r0, d.r1, easeOutCubic(k)); d.m.scale.setScalar(r); d.m.material.opacity = 1 - k; }
      else {
        d.m.rotation.z += d.spin * dt;
        if (d.follow) d.m.position.set(d.follow.x, d.m.position.y, d.follow.z);
        if (d.scaleXY) d.m.scale.set(d.scaleXY[0] * (1 + d.grow * k), d.scaleXY[1] * (1 + d.grow * k), 1); else d.m.scale.setScalar(d.size * (1 + d.grow * k));
        d.m.material.opacity = d.hold ? (d.ctx ? Net.hold(d) : d.hold()) : (k < 0.15 ? k / 0.15 : 1 - smoothstep(0.6, 1, k));
      }
      if (k >= 1 && !d.hold) { scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); return false; }
      if (d.dead) { scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); return false; }
      return true;
    });
    this.shards = this.shards.filter((s) => {
      s.t += dt;
      s.v.y -= 14 * dt;
      s.m.position.addScaledVector(s.v, dt);
      if (s.m.position.y < 0.05) { s.m.position.y = 0.05; s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; s.av.multiplyScalar(0.6); }
      s.m.rotation.x += s.av.x * dt; s.m.rotation.y += s.av.y * dt; s.m.rotation.z += s.av.z * dt;
      const k = 1 - smoothstep(s.life * 0.6, s.life, s.t);
      s.m.scale.copy(s.s).multiplyScalar(Math.max(0.001, k));
      if (s.t >= s.life) { scene.remove(s.m); return false; }
      return true;
    });
  },
};

// A glowing hieroglyph orb with golden gyroscope rings (Hieroglyphic Assault / Final Judgement corners)
function makeGlyphOrb(scale = 1, glyphCell = 3) {
  const g = new THREE.Group();
  const core = glowSprite(VFX.dotTex, new THREE.Color(0.08, 0.7, 1.0), 0.66 * scale, 1.15); g.add(core);
  const inner = glowSprite(VFX.dotTex, COL.glyphHot, 0.2 * scale, 1.1); g.add(inner);
  const glyph = glowSprite(atlasCellTexture(VFX.glyphTex, glyphCell), COL.glyphHot, 0.42 * scale, 1.5); g.add(glyph);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x6a4a10, emissive: 0x2fd6ff, emissiveIntensity: 1.1, metalness: 0.9, roughness: 0.25 });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.27 * scale, 0.016 * scale, 8, 48), ringMat);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.235 * scale, 0.013 * scale, 8, 48), ringMat);
  r2.rotation.x = Math.PI / 2;
  g.add(r1, r2);
  g.userData = { core, inner, glyph, r1, r2, ringMat, scale, spin: rand(0, TAU) };
  return g;
}
function animateGlyphOrb(o, dt, t) {
  const u = o.userData;
  u.spin += dt;
  u.r1.rotation.set(u.spin * 2.1, u.spin * 1.3, 0);
  u.r2.rotation.set(Math.PI / 2 + u.spin * 1.7, 0, u.spin * 2.4);
  const pulse = 1 + Math.sin(t * 9 + u.spin) * 0.08;
  u.core.scale.setScalar(0.62 * u.scale * pulse);
}
function disposeGroup(g) {
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && false) o.material.map.dispose(); o.material.dispose(); } });
  if (g.parent) g.parent.remove(g);
}

// ---------------------------------------------------------------------------
// Ground targeters (line / wall), drawn with a small shader
// ---------------------------------------------------------------------------
function makeLineTargeter() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color(0.05, 0.62, 1.0) }, uColor2: { value: new THREE.Color(1.0, 0.62, 0.2) }, uSplit: { value: 2 }, uTime: { value: 0 }, uLen: { value: 10 }, uW0: { value: 1 }, uW1: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform vec3 uColor, uColor2; uniform float uSplit, uTime, uLen, uW0, uW1, uAlpha;
      void main() {
        float w = mix(uW0, uW1, vUv.y) / max(uW0, uW1);
        float ax = abs(vUv.x - 0.5) * 2.0 / w;
        if (ax > 1.0) discard;
        float edge = smoothstep(0.82, 0.93, ax);
        float along = vUv.y * uLen;
        float chev = 1.0 - smoothstep(0.0, 0.12, abs(fract((along - ax * 0.6 - uTime * 3.0) / 1.4) - 0.5));
        float endCap = smoothstep(0.985, 0.995, vUv.y);
        vec3 c = vUv.y > uSplit ? uColor2 : uColor;
        float a = edge * 0.95 + 0.07 + chev * 0.16 * (1.0 - ax) + endCap;
        a *= smoothstep(0.0, 0.04, vUv.y) * (1.0 - smoothstep(0.995, 1.0, vUv.y));
        gl_FragColor = vec4(c * a * 1.15 * uAlpha, a * uAlpha);
      }`,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0.5);
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 6; m.visible = false; m.frustumCulled = false;
  scene.add(m);
  return {
    mesh: m, mat,
    show(origin, yaw, len, w0, w1, split = 2) {
      m.visible = true;
      m.position.set(origin.x, 0.06, origin.z);
      m.rotation.y = yaw;
      m.scale.set(Math.max(w0, w1), 1, len);
      mat.uniforms.uLen.value = len; mat.uniforms.uW0.value = w0; mat.uniforms.uW1.value = w1; mat.uniforms.uSplit.value = split;
    },
    hide() { m.visible = false; },
  };
}
function makeWallTargeter() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.85, 1.0).multiplyScalar(1.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const ghost = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.75, 1.0).multiplyScalar(0.6), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const W = 6, H = 3.2;
  const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, 0); g.add(m); return m; };
  bar(W, 0.06, 0, H); bar(0.06, H, -W / 2, H / 2); bar(0.06, H, W / 2, H / 2);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), ghost); pane.position.y = H / 2; g.add(pane);
  const foot = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.6), mat); foot.rotation.x = -Math.PI / 2; foot.position.y = 0.05; foot.material = mat.clone(); foot.material.opacity = 0.35; g.add(foot);
  return { group: g, show(pos, yaw) { g.visible = true; g.position.set(pos.x, 0, pos.z); g.rotation.y = yaw; }, hide() { g.visible = false; } };
}

// ---------------------------------------------------------------------------
// Glyph of Pain: a standing frame of hieroglyph pillars with a fiery border
// ---------------------------------------------------------------------------
function makeFireStripMaterial(color = new THREE.Color(0.1, 0.72, 1.0)) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uAlpha: { value: 1 }, uSeed: { value: Math.random() * 10 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime, uAlpha, uSeed; uniform vec3 uColor;
      float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float x = vUv.x * 30.0;
        float k = n(vec2(x - uTime * 6.0 + uSeed, vUv.y * 3.0 + uTime * 2.0)) * 0.6 + n(vec2(x * 2.3 + uTime * 4.0, vUv.y * 5.0)) * 0.4;
        float core = 1.0 - smoothstep(0.0, 0.45 + k * 0.35, abs(vUv.y - 0.5) * 2.0);
        float sparks = step(0.93, n(vec2(x * 3.0 - uTime * 12.0, vUv.y * 9.0 + uSeed)));
        float a = (core * (0.55 + k * 0.8) + sparks * 0.5) * uAlpha;
        vec3 c = mix(uColor, vec3(0.75, 1.0, 1.0), core * k * 0.7);
        gl_FragColor = vec4(c * a * 1.25, a);
      }`,
  });
}
function makeWallPaneMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uRip: { value: [new THREE.Vector4(0, 0, -10, 0), new THREE.Vector4(0, 0, -10, 0), new THREE.Vector4(0, 0, -10, 0), new THREE.Vector4(0, 0, -10, 0)] }, uRune: { value: VFX.runeTex } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime, uAlpha; uniform vec4 uRip[4]; uniform sampler2D uRune;
      void main() {
        vec2 p = vUv;
        float edgeX = smoothstep(0.0, 0.12, p.x) * smoothstep(0.0, 0.12, 1.0 - p.x);
        float scan = 0.5 + 0.5 * sin(p.y * 40.0 - uTime * 3.0);
        float base = 0.022 + 0.018 * scan;
        float rip = 0.0;
        for (int i = 0; i < 4; i++) {
          float age = uTime - uRip[i].z;
          if (age > 0.0 && age < 0.9) {
            vec2 d = (p - uRip[i].xy) * vec2(1.9, 1.0);
            float r = length(d);
            float wave = 1.0 - smoothstep(0.0, 0.06, abs(r - age * 0.9));
            rip += wave * (1.0 - age / 0.9) * 1.6 + (1.0 - smoothstep(0.0, 0.12, r)) * (1.0 - age / 0.9) * 2.0;
          }
        }
        float runes = texture2D(uRune, fract(p * vec2(1.6, 1.0) + vec2(uTime * 0.03, 0.0))).a * 0.10;
        float a = (base * (0.4 + edgeX) + rip * 0.7 + runes * 0.6) * uAlpha;
        vec3 c = mix(vec3(0.12, 0.8, 1.0), vec3(1.0, 0.85, 0.45), clamp(rip, 0.0, 1.0));
        gl_FragColor = vec4(c * a * 1.2, a);
      }`,
  });
}

class GlyphWall {
  constructor(center, yaw, rank, power) {
    this.center = center.clone(); this.yaw = yaw;
    this.normal = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.tangent = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.W = 30 * SU; this.H = 3.3;
    this.life = AB.gp.dur; this.t = 0; this.alive = true;
    this.rank = rank; this.power = power;
    this.owner = Net.ctx ? Net.ctx.uid : Net.myUid;   // (online: only its own Thoth's spells cross it empowered)
    const g = new THREE.Group(); g.position.copy(this.center); g.rotation.y = yaw; scene.add(g);
    this.group = g;
    this.fire = [];
    const mkFire = (w, h, x, y, rotZ) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), makeFireStripMaterial());
      m.position.set(x, y, 0); m.rotation.z = rotZ; g.add(m); this.fire.push(m.material); return m;
    };
    mkFire(this.W + 0.3, 0.42, 0, this.H, 0);
    mkFire(this.H + 0.2, 0.36, -this.W / 2, this.H / 2, Math.PI / 2);
    mkFire(this.H + 0.2, 0.36, this.W / 2, this.H / 2, Math.PI / 2);
    // glyph pillars (ibis, heart, viper)
    const colMat = new THREE.MeshBasicMaterial({ map: VFX.wallGlyphTex, color: new THREE.Color(0.7, 0.88, 1.0).multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.colMat = colMat;
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.55), colMat); c.position.set(sx * (this.W / 2 - 0.62), 1.55, 0); g.add(c);
    }
    this.pane = new THREE.Mesh(new THREE.PlaneGeometry(this.W, this.H), makeWallPaneMaterial()); this.pane.position.y = this.H / 2; g.add(this.pane);
    this.ripI = 0;
    const footMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.8, 1.0).multiplyScalar(1.4), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, map: atlasCellTexture(VFX.fxTex, FX.dot) });
    const foot = new THREE.Mesh(new THREE.PlaneGeometry(this.W + 1.2, 1.2), footMat); foot.rotation.x = -Math.PI / 2; foot.position.y = 0.05; g.add(foot);
    this.footMat = footMat;
    this.light = { pos: this.center.clone().add(V3(0, 1.6, 0)) };
    g.scale.set(1, 0.01, 1);
    // birth burst
    for (let i = 0; i < 40; i++) {
      const x = rand(-this.W / 2, this.W / 2);
      const p = this.center.clone().addScaledVector(this.tangent, x); p.y = 0.1;
      VFX.add.spawn({ pos: p, vel: V3(rand(-0.3, 0.3), rand(2, 5), rand(-0.3, 0.3)), life: rand(0.4, 0.8), size: rand(0.06, 0.12), sizeEnd: 0.01, color: COL.cyan, intensity: 3, drag: 2, cell: FX.spark, stretch: 2 });
    }
    VFX.flash(this.light.pos, COL.cyan, 30, 0.5);
  }
  // returns crossing point if segment p0->p1 crosses the pane
  cross(p0, p1, yLo = 0, yHi = 99) {
    if (!this.alive) return null;
    const d0 = _v1.copy(p0).sub(this.center).dot(this.normal), d1 = _v2.copy(p1).sub(this.center).dot(this.normal);
    if ((d0 > 0) === (d1 > 0) || d0 === d1) return null;
    const t = d0 / (d0 - d1);
    const ip = new THREE.Vector3().lerpVectors(p0, p1, t);
    const lat = _v3.copy(ip).sub(this.center).dot(this.tangent);
    if (Math.abs(lat) > this.W / 2) return null;
    if (ip.y < yLo || ip.y > yHi) return null;
    return ip;
  }
  ripple(ip) {
    const lat = _v3.copy(ip).sub(this.center).dot(this.tangent);
    const u = 0.5 + lat / this.W, v = clamp(ip.y / this.H, 0, 1);
    this.pane.material.uniforms.uRip.value[this.ripI++ % 4].set(u, v, this.pane.material.uniforms.uTime.value, 0);
    VFX.burst(ip, { color: COL.gold, count: 14, speed: 4, flash: 1.1, intensity: 3.2 });
    VFX.flash(ip, COL.gold, 18, 0.25);
  }
  update(dt, time) {
    this.t += dt;
    const born = easeOutBack(clamp(this.t / 0.35, 0, 1));
    const fade = 1 - smoothstep(this.life - 0.6, this.life, this.t);
    this.group.scale.y = Math.max(0.01, born);
    for (const f of this.fire) { f.uniforms.uTime.value = time; f.uniforms.uAlpha.value = fade; }
    this.pane.material.uniforms.uTime.value = time;
    const camD = Math.abs(_v1.copy(camera.position).sub(this.center).dot(this.normal));
    this.pane.material.uniforms.uAlpha.value = fade * smoothstep(0.8, 3.5, camD);
    this.colMat.opacity = fade * (0.85 + 0.15 * Math.sin(time * 6));
    this.footMat.opacity = 0.55 * fade;
    if (Math.random() < dt * 30 * fade) {
      const x = rand(-this.W / 2, this.W / 2);
      const p = this.center.clone().addScaledVector(this.tangent, x); p.y = this.H;
      VFX.add.spawn({ pos: p, vel: V3(rand(-0.2, 0.2), rand(-1.5, -0.3), rand(-0.2, 0.2)), life: rand(0.5, 1.0), size: rand(0.04, 0.08), sizeEnd: 0.01, color: COL.cyan, intensity: 3, gravity: -4, drag: 1, cell: FX.ember });
    }
    if (Math.random() < dt * 6 * fade) {
      const sx = Math.random() < 0.5 ? -1 : 1;
      const p = this.center.clone().addScaledVector(this.tangent, sx * (this.W / 2 - 0.62)); p.y = rand(0.3, 2.8);
      VFX.glyphs.spawn({ pos: p, vel: V3(0, rand(0.4, 0.9), 0), life: 1.2, size: 0.22, sizeEnd: 0.1, color: COL.glyph, intensity: 1.6, cell: VFX.glyphCell(), rot: 0 });
    }
    if (this.t >= this.life) { this.alive = false; disposeGroup(this.group); return false; }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Big magic: ground cracks, shockwaves, lightning bolts, light pillars
// ---------------------------------------------------------------------------
// Radial fracture pattern: one sharp texture (dark fissures) and one soft one (cyan glow inside them)
function makeCrackTextures(seed = 4242) {
  const S = 1024, sharp = cnv(S), soft = cnv(S);
  const a = sharp.getContext('2d'), b = soft.getContext('2d');
  const R = mulberry32(seed), rr = (lo, hi) => lo + (hi - lo) * R();
  const paths = [];
  const walk = (x, y, ang, len, w, depth) => {
    const pts = [[x, y, w]]; pts.depth = depth;
    let l = 0;
    while (l < len) {
      const step = rr(10, 22);
      ang += rr(-0.42, 0.42);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step; l += step;
      const ww = w * (1 - l / len * 0.85);
      pts.push([x, y, ww]);
      if (depth < 2 && R() < 0.07) walk(x, y, ang + (R() < 0.5 ? -1 : 1) * rr(0.4, 1.0), len * rr(0.18, 0.4), ww * 0.8, depth + 1);
      if (Math.hypot(x - S / 2, y - S / 2) > S * 0.49) break;
    }
    paths.push(pts);
  };
  const N = 17;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * TAU + rr(-0.15, 0.15);
    walk(S / 2 + Math.cos(ang) * 18, S / 2 + Math.sin(ang) * 18, ang, rr(S * 0.36, S * 0.5), rr(7, 11), 0);
  }
  // broken ring fractures
  for (const [rad, gaps] of [[S * 0.16, 5], [S * 0.3, 7], [S * 0.43, 9]]) {
    for (let k = 0; k < gaps; k++) {
      const a0 = (k / gaps) * TAU + rr(0, 0.4), a1 = a0 + rr(0.25, 0.6);
      const pts = []; pts.depth = 3; for (let t = a0; t < a1; t += 0.04) { const r2 = rad + rr(-5, 5); pts.push([S / 2 + Math.cos(t) * r2, S / 2 + Math.sin(t) * r2, 3.2]); }
      paths.push(pts);
    }
  }
  const stroke = (ctx, mul, blur) => {
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = '#fff'; ctx.shadowBlur = blur;
    for (const pts of paths) for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = Math.max(1, pts[i][2] * mul);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  };
  stroke(a, 1, 0);
  stroke(b, 2.6, 14); stroke(b, 1, 4);
  // scorched centre
  const g = a.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.09); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  a.fillStyle = g; a.fillRect(0, 0, S, S);
  // normalised copy of the fissures (x right, y down in texture space, -1..1) for effects along them
  const norm = paths.map((pts) => { const q = pts.map(([x, y, w]) => [(x - S / 2) / (S / 2), (y - S / 2) / (S / 2), w]); q.depth = pts.depth; return q; });
  return { sharp: toTex(sharp, { srgb: false }), soft: toTex(soft, { srgb: false }), paths: norm };
}
function makeCrackMaterial(tex, color, glow) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { map: { value: tex }, uColor: { value: color.clone() }, uReveal: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 uColor; uniform float uReveal, uAlpha, uTime; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float rev = 1.0 - smoothstep(uReveal - 0.07, uReveal, r);
        float a = texture2D(map, vUv).a * rev * uAlpha;
        ${glow ? 'float pulse = 0.75 + 0.25 * sin(uTime * 9.0 - r * 14.0); gl_FragColor = vec4(uColor * a * pulse, a);' : 'gl_FragColor = vec4(uColor, a * 0.88);'}
      }`,
  });
}
// camera-facing jagged lightning ribbon that re-forks every few frames
class Bolt {
  constructor(from, to, color, dur, width, jag) {
    this.a = from.clone(); this.b = to.clone(); this.dur = dur; this.t = 0; this.width = width; this.jag = jag; this.next = 0;
    this.n = 16; this.pts = Array.from({ length: this.n }, () => new THREE.Vector3());
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const side = new Float32Array(this.n * 2); for (let i = 0; i < this.n; i++) side[i * 2 + 1] = 1;
    g.setAttribute('side', new THREE.BufferAttribute(side, 1));
    const idx = []; for (let i = 0; i < this.n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: color.clone() }, uAlpha: { value: 1 } },
      vertexShader: 'attribute float side; varying float vS; void main() { vS = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vS; void main() { float e = clamp(1.0 - abs(vS * 2.0 - 1.0), 0.0, 1.0); float core = pow(e, 6.0); float a = (e * e * 0.6 + core) * uAlpha; gl_FragColor = vec4(mix(uColor * 2.2, vec3(2.4), core * 0.7) * a, a); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 11;
    scene.add(this.mesh);
    this.rejag();
  }
  rejag() {
    const d = _v1.copy(this.b).sub(this.a), len = d.length();
    const p1 = _v2.set(-d.z, 0, d.x).normalize(); if (p1.lengthSq() < 0.5) p1.set(1, 0, 0);
    const p2 = _v3.crossVectors(d, p1).normalize();
    for (let i = 0; i < this.n; i++) {
      const s = i / (this.n - 1), env = Math.sin(Math.PI * s) * this.jag * Math.min(1, len / 4);
      this.pts[i].copy(this.a).addScaledVector(d, s).addScaledVector(p1, rand(-1, 1) * env).addScaledVector(p2, rand(-1, 1) * env * 0.7);
    }
  }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next <= 0) { this.next = 0.045; this.rejag(); }
    const cam = camera.position;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i], q = this.pts[Math.min(i + 1, this.n - 1)], o = this.pts[Math.max(i - 1, 0)];
      _v1.copy(q).sub(o); _v2.copy(p).sub(cam); _v3.crossVectors(_v1, _v2).normalize();
      const w = this.width * (0.55 + 0.45 * Math.sin(Math.PI * i / (this.n - 1)));
      this.pos[i * 6] = p.x + _v3.x * w; this.pos[i * 6 + 1] = p.y + _v3.y * w; this.pos[i * 6 + 2] = p.z + _v3.z * w;
      this.pos[i * 6 + 3] = p.x - _v3.x * w; this.pos[i * 6 + 4] = p.y - _v3.y * w; this.pos[i * 6 + 5] = p.z - _v3.z * w;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    const k = this.t / this.dur;
    this.mat.uniforms.uAlpha.value = (1 - k * k) * (0.65 + 0.35 * Math.random());
    if (k >= 1) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); return false; }
    return true;
  }
}
const _pillarVS = 'varying vec2 vUv; varying float vDepth; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }';
Object.assign(VFX, {
  // glowing fissures that race outward from `pos` to `radius` metres
  cracks(pos, radius, dur, opts = {}) {
    const set = this.crackSets[opts.set ?? randInt(0, this.crackSets.length - 1)];
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const dark = new THREE.Mesh(geo, makeCrackMaterial(set.sharp, new THREE.Color(0.03, 0.025, 0.02), false));
    const glow = new THREE.Mesh(geo, makeCrackMaterial(set.soft, (opts.color || COL.cyan).clone().multiplyScalar(opts.intensity ?? 2.4), true));
    const rot = opts.rot ?? rand(0, TAU);
    const y0 = opts.y ?? 0.025;
    for (const [m, y] of [[dark, y0], [glow, y0 + 0.01]]) { m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(pos.x, y, pos.z); m.renderOrder = 6; scene.add(m); }
    const c = { dark, glow, t: 0, dur, grow: opts.grow ?? 0.9, glowHold: opts.glowHold ?? 0, set, rot, radius, pos: pos.clone() };
    this.cracksList.push(c);
    return c;
  },
  // expanding ring on the floor + a wall of light rushing outward
  shockwave(pos, r1, dur, color = COL.cyan, h = 1.8, intensity = 2.6) {
    if (typeof FX2 !== 'undefined' && FX2.ready) FX2.ring(pos, FX2.palFor(color), { radius: r1, dur: dur * 1.15, width: 0.07, int: 1.3 });
    this.ring(pos, color, 0.3, r1, dur, (intensity + 0.6) * 0.6);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: color.clone().multiplyScalar(intensity) }, uAlpha: { value: 1 } },
      vertexShader: _pillarVS,
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying float vDepth; void main() { float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.4) * uAlpha * smoothstep(1.5, 7.0, vDepth); gl_FragColor = vec4(uColor * a, a); }',
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h, 96, 1, true), mat);
    m.position.set(pos.x, h / 2, pos.z); m.renderOrder = 8; m.frustumCulled = false;
    scene.add(m);
    this.waves.push({ m, mat, t: 0, dur, r1, h });
  },
  bolt(from, to, color = COL.cyan, dur = 0.35, width = 0.09, jag = 0.6) { const b = new Bolt(from, to, color, dur, width, jag); this.bolts.push(b); return b; },
  // a column of rising light (Final Judgement channel); returns a handle: set .target, .dead
  pillar(follow, r, h, color = COL.cyan) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: color.clone().multiplyScalar(1.8) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      vertexShader: _pillarVS,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uAlpha, uTime; varying vec2 vUv; varying float vDepth;
        void main() {
          float y = clamp(vUv.y, 0.0, 1.0);
          float base = pow(1.0 - y, 1.7) * smoothstep(1.2, 5.0, vDepth);
          float s = sin(vUv.x * 6.2831 * 14.0 + sin(y * 7.0 + uTime * 1.5) * 1.2 + uTime * 0.8) * 0.5 + 0.5;
          float streak = smoothstep(0.7, 1.0, s) * (0.5 + 0.5 * sin(y * 16.0 - uTime * 7.0));
          float a = (base * 0.5 + streak * 0.55 * (1.0 - y)) * uAlpha;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, h, 48, 1, true), mat);
    m.renderOrder = 8; m.frustumCulled = false; scene.add(m);
    const p = { m, mat, follow, h, alpha: 0, target: 1, dead: false };
    this.pillars.push(p);
    return p;
  },
  updateExtra(dt) {
    this.bolts = this.bolts.filter((b) => b.update(dt));
    this.waves = this.waves.filter((w) => {
      w.t += dt;
      const k = clamp(w.t / w.dur, 0, 1), r = lerp(0.3, w.r1, easeOutCubic(k));
      w.m.scale.set(r, 1 - 0.55 * k, r); w.m.position.y = w.h * (1 - 0.55 * k) / 2;
      w.mat.uniforms.uAlpha.value = Math.pow(1 - k, 1.4);
      if (k >= 1) { scene.remove(w.m); w.m.geometry.dispose(); w.mat.dispose(); return false; }
      return true;
    });
    this.cracksList = this.cracksList.filter((c) => {
      c.t += dt;
      const k = clamp(c.t / c.dur, 0, 1), rev = easeOutCubic(clamp(c.t / c.grow, 0, 1)) * 1.08;
      const fade = 1 - smoothstep(0.72, 1, k);
      for (const m of [c.dark, c.glow]) { m.material.uniforms.uReveal.value = rev; m.material.uniforms.uTime.value = c.t; }
      c.dark.material.uniforms.uAlpha.value = fade;
      c.glow.material.uniforms.uAlpha.value = fade * (c.glowHold > 0 ? 1 : 1 - smoothstep(0.15, 0.7, k) * 0.6);
      if (k >= 1) { for (const m of [c.dark, c.glow]) { scene.remove(m); m.material.dispose(); } c.dark.geometry.dispose(); return false; }
      return true;
    });
    this.pillars = this.pillars.filter((p) => {
      p.alpha = damp(p.alpha, p.dead ? 0 : p.target, p.dead ? 8 : 4, dt);
      p.mat.uniforms.uAlpha.value = p.alpha; p.mat.uniforms.uTime.value += dt;
      if (p.follow) p.m.position.set(p.follow.x, p.h / 2, p.follow.z);
      if (p.dead && p.alpha < 0.01) { scene.remove(p.m); p.m.geometry.dispose(); p.mat.dispose(); return false; }
      return true;
    });
  },
});

function makeShadeTexture() {
  const S = 256, c = cnv(S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return toTex(c, { srgb: false });
}

// ---------------------------------------------------------------------------
// Along the fissures: light pouring out of the cracks, floor slabs tearing loose
// ---------------------------------------------------------------------------
// world points along a crack decal's fissures: [{p, dir, r (0 centre .. 1 rim), w}], one every `step` m
function crackPoints(c, step = 1.0, maxDepth = 1) {
  const out = [], cs = Math.cos(c.rot), sn = Math.sin(c.rot), R = c.radius;
  const toW = (nx, ny) => { const lx = nx * R, ly = -ny * R; return new THREE.Vector3(c.pos.x + lx * cs - ly * sn, 0, c.pos.z - (lx * sn + ly * cs)); };
  for (const path of c.set.paths) {
    if (path.depth > maxDepth) continue;
    let acc = step * 0.5;
    for (let i = 1; i < path.length; i++) {
      const a = toW(path[i - 1][0], path[i - 1][1]), b = toW(path[i][0], path[i][1]);
      acc += a.distanceTo(b);
      if (acc >= step) { acc = 0; out.push({ p: b, dir: b.clone().sub(a).normalize(), r: Math.hypot(path[i][0], path[i][1]), w: path[i][2], depth: path.depth }); }
    }
  }
  return out;
}

const _sheetGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; })();
// vertical curtains of cyan light rising from the fissures; they appear as the crack races outward
class CrackLights {
  constructor(c, opts = {}) {
    this.c = c; this.t = 0; this.dur = opts.dur ?? 4; this.reveal = opts.reveal ?? c.grow; this.flare = 0; this.alive = true;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: (opts.color || COL.cyan).clone().multiplyScalar(opts.intensity ?? 1.2) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying float vX; varying float vDepth; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vX = w.x * 1.7 + w.z * 2.3; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uAlpha, uTime; varying vec2 vUv; varying float vX; varying float vDepth;
        void main() {
          float y = clamp(vUv.y, 0.0, 1.0);
          float core = pow(1.0 - y, 2.6);
          float rays = 0.65 + 0.35 * sin(vX * 3.0 + uTime * 9.0 + y * 6.0);
          float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(0.0, 0.3, 1.0 - vUv.x);
          float a = core * edge * rays * uAlpha * smoothstep(1.0, 4.5, vDepth);
          gl_FragColor = vec4(uColor * a * (1.0 + 0.8 * pow(1.0 - y, 8.0)), a);
        }`,
    });
    this.meshes = [];
    const step = opts.step ?? 1.2;
    for (const q of crackPoints(c, step, opts.depth ?? 1)) {
      if (q.r < (opts.rMin ?? 0.06)) continue;
      const m = new THREE.Mesh(_sheetGeo, this.mat);
      m.position.copy(q.p).setY(0.03);
      m.rotation.y = Math.atan2(-q.dir.z, q.dir.x);
      m.userData = { r: q.r, h: rand(0.5, 1.3) * (1.15 - q.r * 0.6) * (opts.height ?? 1), ph: rand(0, TAU), w: step * 1.25 * (0.6 + q.w / 12) };
      m.scale.set(m.userData.w, 0.001, 1); m.visible = false; m.renderOrder = 8; m.frustumCulled = false;
      scene.add(m); this.meshes.push(m);
    }
  }
  update(dt) {
    this.t += dt;
    const reach = clamp(this.t / this.reveal, 0, 1) * 1.04;
    this.flare = Math.max(0, this.flare - dt * 0.7);
    const fade = 1 - smoothstep(this.dur - 1.2, this.dur, this.t);
    this.mat.uniforms.uAlpha.value = fade * (0.75 + this.flare * 1.6);
    this.mat.uniforms.uTime.value = this.t;
    for (const m of this.meshes) {
      const u = m.userData, on = u.r < reach;
      m.visible = on;
      if (!on) continue;
      const target = u.h * (1 + this.flare * 2.0) * (0.8 + 0.25 * Math.sin(this.t * 13 + u.ph));
      m.scale.y = damp(m.scale.y, target, 14, dt);
    }
    if (this.t >= this.dur) { for (const m of this.meshes) scene.remove(m); this.mat.dispose(); return false; }
    return true;
  }
}

const _rockGeos = [new THREE.DodecahedronGeometry(1, 0), new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0)];
// floor slabs that tear loose along the cracks, hover in the god's fury, then blast outward
class RockField {
  constructor(points, opts = {}) {
    this.t = 0; this.state = 'rise'; this.center = (opts.center || V3()).clone();
    this.mat = new THREE.MeshStandardMaterial({ color: 0x8c785c, roughness: 0.95, metalness: 0, flatShading: true, emissive: new THREE.Color(0.06, 0.6, 0.85), emissiveIntensity: 0 });
    this.rocks = points.map((q, i) => {
      const m = new THREE.Mesh(_rockGeos[i % 3], this.mat);
      const s = rand(0.16, 0.42) * (opts.scale ?? 1);
      m.scale.set(s * rand(0.8, 1.6), s * rand(0.5, 0.9), s * rand(0.8, 1.5));
      m.position.copy(q.p).setY(-0.5);
      m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      m.castShadow = true;
      scene.add(m);
      return { m, hover: rand(0.35, 1.5) * (opts.height ?? 1), delay: q.r * (opts.reveal ?? 1), v: V3(), av: V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.8), base: q.p.clone(), life: rand(1.8, 2.8), s0: m.scale.clone() };
    });
  }
  launch(force = 1) {
    this.state = 'fly'; this.flyT = 0;
    for (const r of this.rocks) {
      const d = r.m.position.clone().sub(this.center).setY(0); const dist = d.length() || 1; d.divideScalar(dist);
      r.v.copy(d).multiplyScalar(rand(6, 13) * force).setY(rand(3.5, 8) * force);
      r.av.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    }
  }
  update(dt) {
    this.t += dt;
    if (this.state === 'rise') {
      this.mat.emissiveIntensity = Math.min(0.35, this.t * 0.4);
      for (const r of this.rocks) {
        const k = clamp((this.t - r.delay) / 0.35, 0, 1);
        const y = lerp(-0.5, r.hover, easeOutBack(k)) + Math.sin(this.t * 7 + r.hover * 10) * 0.05 * k;
        r.m.position.y = y;
        r.m.position.x = r.base.x + Math.sin(this.t * 41 + r.hover * 9) * 0.03 * k; // trembling
        r.m.rotation.x += r.av.x * dt; r.m.rotation.y += r.av.y * dt;
      }
      return true;
    }
    this.flyT += dt;
    this.mat.emissiveIntensity = Math.max(0, 0.8 - this.flyT * 0.8);
    let alive = false;
    for (const r of this.rocks) {
      if (this.flyT > r.life) { r.m.visible = false; continue; }
      alive = true;
      r.v.y -= 15 * dt;
      r.m.position.addScaledVector(r.v, dt);
      if (r.m.position.y < r.m.scale.y * 0.6) { r.m.position.y = r.m.scale.y * 0.6; r.v.y *= -0.3; r.v.x *= 0.55; r.v.z *= 0.55; r.av.multiplyScalar(0.5); }
      r.m.rotation.x += r.av.x * dt; r.m.rotation.y += r.av.y * dt; r.m.rotation.z += r.av.z * dt;
      const k = 1 - smoothstep(r.life - 0.5, r.life, this.flyT);
      r.m.scale.copy(r.s0).multiplyScalar(Math.max(0.001, k));
    }
    if (!alive) { for (const r of this.rocks) scene.remove(r.m); this.mat.dispose(); return false; }
    return true;
  }
}

Object.assign(VFX, {
  crackLightsList: [], rockFields: [],
  crackLights(c, opts) { const l = new CrackLights(c, opts); this.crackLightsList.push(l); return l; },
  rockField(points, opts) { const f = new RockField(points, opts); this.rockFields.push(f); return f; },
  crackPoints,
});
{
  const base = VFX.updateExtra.bind(VFX);
  VFX.updateExtra = function (dt) {
    base(dt);
    this.crackLightsList = this.crackLightsList.filter((l) => l.update(dt));
    this.rockFields = this.rockFields.filter((f) => f.update(dt));
  };
}


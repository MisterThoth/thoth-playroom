// ============================================================================
// RA, god of the sun (SMITE 1 kit, final patch: Speed of Light, Celestial Beam, Divine Light, Solar
// Blessing, Searing Pain) + the playroom finale BARQUE OF MILLIONS OF YEARS: the sky turns to a
// blazing sunset, Ra's golden solar barque sails out over his head and down the hall pouring a
// pillar of sunfire from its disc, then dives below the horizon - and at sunset the scorched path
// erupts in a line of solar flares.
// ============================================================================
const RA_STATS = { hp: [375, 72], mp: [250, 46], speed: 365, range: 55, as: [0.95, 0.011], basic: [35, 1.5], basicScale: 0.2, hp5: [7, 0.5], mp5: [5, 0.42] };
const BQ_SET = 4.15;          // sunset: right after "Raise the oars... the barque of millions of years sets sail" (4.07 s)
// Barque damage, [base, x magical power]: the great burn (once per foe) and the sun-ray ticks (every 0.25 s under the
// light, which also blinds). Balance (ability 5 >= 2 x ability 4): the great burn alone is 2.16 x Searing Pain at rank 5
// (700 + 1.1 MP), the rays add more (enough to stay above 2 x even with the Pain's +5 % of a god's health) -
// was 360 + 0.6 MP (+ 22 + 0.06 MP ticks), weaker than the 4
const BQ_DMG = { burn: [1500, 2.4], ray: [30, 0.08] };
const BQ_SUN = 1.95;          // "KNEEL... beneath the SUN!" - the last word lands this long after the sunset: the great flare
const RA = { sol: [], atkI: 0, divine: null, bless: null, sear: null, bq: null };
const RCOL = { sun: new THREE.Color(1.0, 0.55, 0.08), gold: new THREE.Color(1.0, 0.7, 0.18), solar: new THREE.Color(1.0, 0.3, 0.03), crimson: new THREE.Color(0.85, 0.1, 0.04), dawn: new THREE.Color(1.0, 0.62, 0.24), core: new THREE.Color(1.0, 0.8, 0.42), lapis: new THREE.Color(0.1, 0.25, 0.9) };
const raAB = {
  cb: { id: 'cb', name: 'Celestial Beam', dmg: [95, 155, 215, 275, 335], scale: 1.0, cost: [60, 65, 70, 75, 80], cd: [10, 10, 10, 10, 10], range: 80, width: 9, sweep: 0.32 },
  dl: { id: 'dl', name: 'Divine Light', dmg: [70, 120, 170, 220, 270], scale: 0.7, cost: [60, 65, 70, 75, 80], cd: [12, 12, 12, 12, 12], radius: 30, charge: 2.0, blind: 1.5 },
  sb: { id: 'sb', name: 'Solar Blessing', dmg: [20, 32, 44, 56, 68], scale: 0.25, heal: [12, 24, 36, 48, 60], cost: [65, 75, 85, 95, 105], cd: [15, 15, 15, 15, 15], range: 55, radius: 20, dur: 6, targeted: true },
  sp: { id: 'sp', name: 'Searing Pain', dmg: [400, 475, 550, 625, 700], scale: 1.1, cost: [90, 90, 90, 90, 90], cd: [80, 75, 70, 65, 60], range: 120, width: 4, charge: 0.8, dur: 2.0, ticks: 6 },
  bq: { id: 'bq', name: 'Barque of Millions of Years', cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33], range: 110, half: 20, depth: 9, length: 15, back: 8, targeted: true },
};
const BARQUE_FLIP = Math.PI;   // the packed barque's prow points along its local -X (steering oars at +X)
const raSide = (yaw, out = new THREE.Vector3()) => out.set(-Math.cos(yaw), 0, Math.sin(yaw));
const _raq = { bp: new THREE.Vector3(), disc: new THREE.Vector3(), stern: new THREE.Vector3(), G: new THREE.Vector3(), f: new THREE.Vector3(), sd: new THREE.Vector3(), o: new THREE.Vector3() };   // Ra's own temporaries (the shared _v1.._v4 get clobbered by helpers)
// passive: Speed of Light - every ability cast gives a stack of movement speed (3 max, 15 s each)
function speedOfLight() {
  RA.sol.push(15); if (RA.sol.length > 3) RA.sol.shift();
  if (RA.sol.length === 3) VFX.later(0.5, () => Sound.voice('passive', { priority: 2, cooldown: 30, chance: 0.4 }));
  for (let i = 0; i < 10; i++) VFX.add.spawn({ pos: P.pos.clone().add(V3(rand(-0.4, 0.4), rand(0.1, 1.8), rand(-0.4, 0.4))), vel: V3(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)), life: 0.5, size: 0.08, sizeEnd: 0.01, color: RCOL.gold, intensity: 2, cell: FX.ember });
}
const sunPower = () => (RA.bless && RA.bless.inside ? 1.15 : 1);

// sunfire (FX2): licking flames, rising embers and a heat shimmer at a point on the ground
function sunfire(p, n = 4, s = 1, pal = 'ra') {
  for (let i = 0; i < n; i++) FX2.fire.spawn({ pos: p.clone().add(V3(rand(-0.5, 0.5) * s, 0.05, rand(-0.5, 0.5) * s)), vel: V3(rand(-0.4, 0.4), rand(1.5, 3.2) * s, rand(-0.4, 0.4)), life: rand(0.45, 0.75), size: rand(0.9, 1.4) * s, sizeEnd: rand(0.4, 0.7) * s, frames: 16, pal, temp: 1.05, tempEnd: 0.45, int: 1.4, rot: rand(-0.3, 0.3), rotVel: 0, turb: 1.2, fadeIn: 0.05 });
  for (let i = 0; i < n * 2; i++) FX2.glow.spawn({ pos: p.clone().add(V3(rand(-0.6, 0.6) * s, 0.2, rand(-0.6, 0.6) * s)), vel: V3(rand(-1.2, 1.2), rand(2, 5) * s, rand(-1.2, 1.2)), life: rand(0.6, 1.2), size: rand(0.04, 0.09), sizeEnd: 0.01, cell: FXA.ember, pal, temp: 1.1, tempEnd: 0.4, int: 2, turb: 2.5, drag: 0.6 });
}

// ---- basic attack: a small burning sun ------------------------------------------------------
function raBasic() {
  if (RA.bq || RA.sear) return;
  P.atkCd = 1 / attackSpeed();
  // a three-beat chain: the sun staff thrust along the aim (the orb leaves its disc), a sun flicked from his free left palm,
  // then the staff hurled down from high over his shoulder
  const A = Game.anim, step = autoStep(A), side = step === 1 ? 'L' : 'R';
  const rel = autoCast(A, ['thrust', 'flick', 'hurl'][step], side, P.atkCd);
  P.atkPenalty = Math.min(0.45, P.atkCd * 0.8);
  VFX.later(rel, () => {
    const origin = autoOrigin(A, side), dir = fwdOf(P.yaw);
    if (side === 'R' && Game.thoth.prop) { Game.thoth.prop.userData.disc.getWorldPosition(origin); origin.y = clamp(origin.y, P.y + 1.1, P.y + 2.0); }
    const g = new THREE.Group(); scene.add(g);
    g.add(glowSprite(VFX.dotTex, RCOL.sun, 0.7, 3)); const rays = glowSprite(GodFX.cellTex(GX.sunrays), RCOL.core, 0.55, 2.4); g.add(rays);
    const trail = VFX.trail(0.36, RCOL.sun, 2.6, 14), helix = makeHelix(2, 0.14, 0.07, RCOL.core, 2.4, 28);
    Combat.projectiles.push(new Projectile({
      kind: 'basic', pos: origin, dir, speed: 34, radius: 0.32, pierce: false, maxDist: RA_STATS.range * SU, glyphRange: 0,
      onMove(p, dt) { g.position.copy(p.pos); rays.material.rotation = p.t * 5; trail.push(p.pos); helix.push(p.pos, p.dir, p.t); FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(34), 'ra', dt, { k: 1.5, size: 0.9 }); if (Math.random() < dt * 18) FX2.fire.spawn({ pos: p.pos.clone(), vel: V3(0, 0.6, 0), life: 0.3, size: 0.45, sizeEnd: 0.2, frames: 16, pal: 'ra', temp: 1.0, tempEnd: 0.5, int: 1.3, rot: rand(-3, 3), rotVel: 0 }); },
      onHit(d, hp) { Combat.deal(d, basicDamage() * sunPower(), 'basic', 'Sun Orb'); FX2.burst(hp, 'ra', { size: 0.45, sparks: 16, embers: 8, puffs: 2, bursts: 1 }); Sound.god(`orb_hit${1 + (RA.atkI % 2)}`, { gain: 0.7, pos: hp }); },
      onDie(p, at) { trail.alive = false; helix.kill(); FX2.burst(at, 'ra', { size: 0.35, sparks: 10, embers: 6, puffs: 1, bursts: 1, distort: false }); disposeGroup(g); },
    }));
    Sound.god(`orb${1 + (RA.atkI++ % 3)}`, { gain: 0.85 });
    if (Math.random() < 0.06) Sound.voice('eff', { cooldown: 6 });
  });
}

// ---- 1 · Celestial Beam: a beam from the sky sweeps along the line from just behind Ra --------
function castCelestialBeam() {
  spend('cb'); startCd('cb'); speedOfLight();
  const rank = rankOf('cb'), dir = fwdOf(P.yaw), o = P.pos.clone().setY(0).addScaledVector(dir, -1.2);
  let L = AB.cb.range * SU + 1.2;
  const blk = segmentBlocked(o.x, o.z, o.x + dir.x * L, o.z + dir.z * L); if (blk < 1) L *= blk;
  const W = AB.cb.width * SU;
  Game.anim.play('beam');
  Sound.god('cb_cast', { gain: 1.0 });
  Sound.voice('a1', { chance: 0.55, cooldown: 7 });
  VFX.later(0.12, () => {
    Sound.god('cb_sweep', { gain: 1.0 });
    const hit = new Set(), ground = o.clone();
    const sky = () => _v1.copy(ground).setY(26).addScaledVector(dir, -4);
    const beam = GodFX.beam(sky(), ground, W * 0.45, RCOL.solar, { core: RCOL.sun, scroll: -9, k: 40, gain: 0.6 }); beam.target = 1.0;
    const halo = GodFX.beam(sky(), ground, W * 0.95, RCOL.crimson, { core: RCOL.solar, scroll: -5, k: 30, gain: 0.45 }); halo.target = 0.5;
    const strip = GodFX.decal(o.clone().addScaledVector(dir, L / 2), VFX.dotTex, RCOL.solar, 1, 1.6, { intensity: 1.1 }); strip.scaleXY = [W * 1.3, 0.01]; strip.m.rotation.z = P.yaw;
    GodFX.add({ update(dt) {
      const k = clamp(this.t / AB.cb.sweep, 0, 1);
      ground.copy(o).addScaledVector(dir, L * k);
      beam.from.copy(sky()); beam.to.copy(ground); halo.from.copy(beam.from); halo.to.copy(ground);
      strip.scaleXY = [W * 1.3, Math.max(0.01, L * k)]; strip.m.position.copy(o).addScaledVector(dir, L * k / 2).setY(0.04);
      sunfire(ground, 2, 1.0);
      if (Math.random() < dt * 20) VFX.cracks(ground.clone(), rand(0.6, 1.0), 1.8, { grow: 0.08, intensity: 1.4, color: RCOL.solar });
      this.sc = (this.sc || 0) + dt; if (this.sc > 0.05) { this.sc = 0; FX2.scorch(ground, 'ra', { radius: W * 0.75, dur: 2.2, int: 1.5 }); FX2.distort.heat(ground.clone().setY(1.5), 3, 0.006, 0.6); }
      for (const d of dummiesNear(ground, W / 2 + 0.2)) {
        if (hit.has(d)) continue; hit.add(d);
        Combat.deal(d, (AB.cb.dmg[rank - 1] + AB.cb.scale * settings.power) * sunPower(), 'ability', 'Celestial Beam');
        FX2.burst(d.pos.clone().setY(1.2), 'ra', { size: 0.75, sparks: 26, embers: 14, puffs: 3, bursts: 1 }); sunfire(d.pos, 4, 0.9);
        Sound.god('cb_strike', { gain: 0.8, pos: d.pos });
      }
      if (k >= 1) { beam.dead = true; halo.dead = true; VFX.flash(ground.clone().setY(1), RCOL.sun, 16, 0.3); return false; }
      return true;
    } });
    Cam.shake = Math.max(Cam.shake, 0.25);
  });
}

// ---- 2 · Divine Light --------------------------------------------------------------------
function castDivineLight() {
  spend('dl'); startCd('dl'); speedOfLight();
  Game.anim.play('radiance');
  Sound.god('dl_charge', { gain: 1.0 });
  Sound.voice('a2', { chance: 0.55, cooldown: 7 });
  const halo = GodFX.bubble(P.pos, 1.4, RCOL.sun, { hex: 0 }); halo.target = 0.6; halo.y = 1.2;
  const sig = GodFX.decal(P.pos, GodFX.sig.sun, RCOL.sun, 2, AB.dl.charge + 0.6, { spin: 1.2, follow: P.pos, intensity: 1.6, grow: 5.5 });
  RA.divine = { t: 0, halo, sig, tick: 0, aura: FX2.aura(P.pos, 'ra', { radius: 1.2, height: 2.4, rate: 40, dur: AB.dl.charge + 0.1 }), charge: FX2.charge(V3(P.pos.x, 1.3, P.pos.z), 'ra', { dur: AB.dl.charge, radius: 3, rate: 70, size: 1.4 }) };
}
function updateDivineLight(dt) {
  const D = RA.divine; if (!D) return;
  D.t += dt; D.tick += dt;
  const R = AB.dl.radius * SU, k = D.t / AB.dl.charge;
  D.halo.m.scale.setScalar(1 + k * 1.2);
  if (Math.random() < dt * 60) { const a = rand(0, TAU), r = rand(0.5, R * k); VFX.add.spawn({ pos: P.pos.clone().add(V3(Math.cos(a) * r, rand(0.1, 0.4), Math.sin(a) * r)), vel: V3(0, rand(1, 3), 0), life: 0.6, size: 0.08, sizeEnd: 0.01, color: RCOL.core, intensity: 2.0, cell: FX.ember }); }
  if (D.tick >= 0.5) { D.tick = 0; for (const d of dummiesNear(P.pos, R)) d.slowed(Math.min(0.5, (d.slowAmt || 0) + 0.1), 1); }
  if (D.t >= AB.dl.charge) {
    const rank = rankOf('dl');
    Sound.god('dl_burst', { gain: 1.0 });
    Cam.shake = Math.max(Cam.shake, 0.4); PostFX.shock(P.pos.clone().setY(1.2), 0.7, 0.5);
    VFX.flash(P.pos.clone().setY(1.5), RCOL.sun, 26, 0.5);
    FX2.ring(P.pos, 'ra', { radius: R + 1, dur: 0.5, width: 0.07 });
    FX2.burst(P.pos.clone().setY(1.4), 'ra', { size: 1.4, sparks: 60, embers: 30, puffs: 6, bursts: 1, int: 0.95 });
    FX2.distort.ring(P.pos.clone().setY(1.3), (R + 2) * 2, 0.024, 0.5);
    for (const d of dummiesNear(P.pos, R)) { Combat.deal(d, (AB.dl.dmg[rank - 1] + AB.dl.scale * settings.power) * sunPower(), 'ability', 'Divine Light'); d.blinded(AB.dl.blind); FX2.burst(d.pos.clone().setY(1.3), 'ra', { size: 0.5, sparks: 14, embers: 8, puffs: 2, bursts: 1, distort: false }); }
    D.halo.dead = true; RA.divine = null;
  }
}

// ---- 3 · Solar Blessing: a pillar of sunlight on the ground - it burns his foes and blesses him --
function castSolarBlessing() {
  spend('sb'); startCd('sb'); speedOfLight();
  const c = groundTarget(AB.sb.range * SU, 2), R = AB.sb.radius * SU;
  Game.anim.play('bless');
  Sound.god('sb_cast', { gain: 1.0 });
  Sound.voice('a3', { chance: 0.55, cooldown: 7 });
  const sig = GodFX.decal(c, GodFX.sig.sun, RCOL.dawn, R * 2, AB.sb.dur, { spin: 0.3, intensity: 1.0 });
  const col = GodFX.column(c, R * 0.95, 9, RCOL.dawn, { k: 3, scroll: 1.2, core: RCOL.gold, gain: 0.9 }); col.target = 0.3;
  const loop = Sound.god('sb_loop', { gain: 0.5, pos: c, loop: true });
  RA.bless = { t: 0, c, R, sig, col, tick: 0, loop, rank: rankOf('sb'), inside: false };
  RA.bless.tor = FX2.tornado(c, 'ra', { r0: R * 0.85, r1: R * 1.05, height: 3, dur: AB.sb.dur, alpha: 0.24, twist: 0.6, spin: 0.25, rise: 0.4, density: 0.32, int: 0.9 });
  FX2.ring(c, 'ra', { radius: R + 0.6, dur: 0.45 });
  FX2.burst(c.clone().setY(0.6), 'ra', { size: 0.9, sparks: 30, embers: 20, puffs: 2, bursts: 1 });
}
function updateSolarBlessing(dt) {
  const B = RA.bless; if (!B) return;
  B.t += dt; B.tick += dt;
  B.inside = Math.hypot(P.pos.x - B.c.x, P.pos.z - B.c.z) < B.R;
  if (Math.random() < dt * 40) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * B.R; VFX.add.spawn({ pos: V3(B.c.x + Math.cos(a) * r, 0.1, B.c.z + Math.sin(a) * r), vel: V3(0, rand(1, 2.5), 0), life: rand(0.8, 1.4), size: rand(0.05, 0.1), sizeEnd: 0.01, color: Math.random() < 0.6 ? RCOL.dawn : RCOL.gold, intensity: 1.8, cell: FX.ember, drag: 0.4 }); }
  if (Math.random() < dt * 3) GodFX.spawn({ pos: V3(B.c.x + rand(-B.R * 0.7, B.R * 0.7), 0.2, B.c.z + rand(-B.R * 0.7, B.R * 0.7)), vel: V3(0, 1.4, 0), life: 1.4, size: 0.5, sizeEnd: 0.3, color: RCOL.gold, intensity: 1.4, cell: GX.sunrays, rotVel: 1 });
  if (Math.random() < dt * 10) { const a = rand(0, TAU); sunfire(V3(B.c.x + Math.cos(a) * B.R * 0.95, 0, B.c.z + Math.sin(a) * B.R * 0.95), 1, 0.7); }
  if (Math.random() < dt * 24) FX2.glow.spawn({ pos: V3(B.c.x, 0.3, B.c.z), life: rand(1.2, 1.8), size: rand(0.06, 0.12), sizeEnd: 0.01, cell: Math.random() < 0.3 ? FXA.star : FXA.ember, pal: 'ra', temp: 1.1, tempEnd: 0.5, int: 1.8, orbit: { c: B.c, r: B.R * rand(0.4, 0.95), w: rand(0.8, 1.6), vy: rand(0.8, 2.2), y: 0.2 } });
  if (B.tick >= 1) {
    B.tick = 0;
    for (const d of dummiesNear(B.c, B.R)) { Combat.deal(d, (AB.sb.dmg[B.rank - 1] + AB.sb.scale * settings.power) * sunPower(), 'ability', 'Solar Blessing'); VFX.burst(d.pos.clone().setY(1.2), { color: RCOL.sun, count: 6, speed: 2, flash: 0.7, intensity: 1.6 }); }
    if (B.inside) { P.hp = Math.min(maxHp(), P.hp + AB.sb.heal[B.rank - 1]); VFX.add.spawn({ pos: P.pos.clone().setY(1.3), life: 0.5, size: 1.4, sizeEnd: 2.2, color: RCOL.dawn, intensity: 1.4, cell: FX.ring, alpha: 0.8, alphaEnd: 0, fadeIn: 0 }); }
  }
  if (B.t >= AB.sb.dur) { B.col.dead = true; if (B.tor) B.tor.dead = true; if (B.loop) B.loop.stop(0.6); RA.bless = null; }
}

// ---- 4 · Searing Pain ------------------------------------------------------------------------
// a flat ribbon of sunfire along a beam (reads from behind and above, where a cylinder goes thin)
function raRibbon(width, color, core, vertical = false) {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1); geo.rotateX(-Math.PI / 2); if (vertical) geo.rotateZ(Math.PI / 2); geo.translate(0, 0, 0.5);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: color.clone() }, uCore: { value: core.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uLen: { value: 10 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform vec3 uColor, uCore; uniform float uAlpha, uTime, uLen; varying vec2 vUv;
      void main() {
        float along = (1.0 - vUv.y) * uLen, across = clamp(1.0 - abs(vUv.x * 2.0 - 1.0), 0.0, 1.0);   // clamp: pow() of a tiny negative is NaN
        float n = gfbm(vec2(along * 0.35 - uTime * 7.0, vUv.x * 4.0));
        float core = pow(across, 4.0), body = pow(across, 1.6);
        float a = (body * 0.55 + core * 0.9) * (0.6 + 0.8 * n) * smoothstep(0.0, 0.6, along) * (1.0 - smoothstep(uLen - 1.2, uLen, along)) * uAlpha;
        gl_FragColor = vec4(mix(uColor, uCore, core) * a, a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 9; m.frustumCulled = false; scene.add(m);
  return {
    m, mat,
    set(o, dir, len, alpha, t) { m.position.copy(o); m.rotation.set(0, Math.atan2(dir.x, dir.z), 0); m.scale.set(width, vertical ? width : 1, len); mat.uniforms.uLen.value = len; mat.uniforms.uAlpha.value = alpha; mat.uniforms.uTime.value = t; },
    dispose() { scene.remove(m); geo.dispose(); mat.dispose(); },
  };
}
function castSearingPain() {
  spend('sp'); startCd('sp'); speedOfLight();
  Game.anim.play('sear');
  Sound.god('sp_charge', { gain: 1.0 });
  Sound.duckMusic(0.35, 4, 1.5);
  RA.sear = { t: 0, fired: false, tick: 0, ticks: 0, rank: rankOf('sp'), yaw: P.yaw };
  WORLD.dim = 0.7;
  RA.sear.charge = FX2.charge(searOrigin(new THREE.Vector3()), 'ra', { dur: AB.sp.charge, radius: 1.8, rate: 110, size: 1.3 });
}
function searOrigin(out) { const S = RA.sear; return out.copy(P.pos).addScaledVector(fwdOf(S.yaw, _v4), 0.9).setY(P.y + 1.45); }
function updateSearingPain(dt, t) {
  const S = RA.sear; if (!S) return;
  S.t += dt;
  S.yaw = dampAngle(S.yaw, P.yaw, S.fired ? 1.6 : 6, dt);   // the beam turns slowly with the camera
  const o = searOrigin(new THREE.Vector3()), dir = fwdOf(S.yaw, new THREE.Vector3()), L = AB.sp.range * SU;
  const blocked = segmentBlocked(o.x, o.z, o.x + dir.x * L, o.z + dir.z * L), len = L * Math.min(1, blocked);
  if (!S.fired) {
    if (Math.random() < dt * 80) { const a = rand(0, TAU), r = rand(0.6, 1.6); VFX.add.spawn({ pos: o.clone().add(V3(Math.cos(a) * r, Math.sin(a) * r, rand(-0.5, 0.5))), vel: V3(0, 0, 0), life: 0.4, size: 0.1, sizeEnd: 0.02, color: RCOL.core, intensity: 2.0, cell: FX.ember, attract: { x: o.x, y: o.y, z: o.z, strength: 40, kill: 0.15 } }); }
    if (S.t >= AB.sp.charge) {
      S.fired = true;
      Sound.god('sp_fire', { gain: 1.05 });
      Sound.voice('ult_scream', { priority: 5, gain: 1.15, delay: 0.05, cooldown: 0, hold: 2.3 });
      VFX.later(2.6, () => Sound.voice('ult', { priority: 3, gain: 1.05, cooldown: 0, chance: 0.5 }));
      S.loop = Sound.god('sp_loop', { gain: 0.6, loop: true });
      Game.hitStop(0.09, 0.15); Cam.shake = 0.7; Cam.fovKick = 10; Cam.frameTarget = 0.6;   // lift the camera so the beam reads from behind
      PostFX.shock(o.clone().addScaledVector(dir, 2), 0.95, 0.7); PostFX.aberr = 0.006;
      FX2.ring(P.pos, 'ra', { radius: 6, dur: 0.45 });
      FX2.burst(o.clone(), 'ra', { size: 0.9, sparks: 40, embers: 20, puffs: 4, bursts: 1, int: 0.9 });
      S.beam = GodFX.beam(o, o.clone().addScaledVector(dir, len), 0.95, RCOL.solar, { core: RCOL.sun, scroll: -10, k: 40, gain: 1.35 }); S.beam.target = 1.0;
      S.outer = GodFX.beam(o, o.clone().addScaledVector(dir, len), 1.6, RCOL.crimson, { core: RCOL.solar, scroll: -6, k: 30, gain: 0.85, taper: 1.6 }); S.outer.target = 0.7;
      S.ribH = raRibbon(3.0, RCOL.solar, RCOL.sun); S.ribV = raRibbon(2.4, RCOL.crimson, RCOL.solar, true);
    }
    return;
  }
  // the beam: follow the facing, scorch the floor, burn everything in it
  const end = o.clone().addScaledVector(dir, len);
  S.beam.from.copy(o); S.beam.to.copy(end); S.outer.from.copy(o); S.outer.to.copy(end);
  const ra = S.beam.alpha; S.ribH.set(o, dir, len, ra * 1.25, t); S.ribV.set(o, dir, len, ra * 0.8, t);
  S.scorch = (S.scorch || 0) + dt;
  if (S.scorch > 0.12) { S.scorch = 0; const p = o.clone().addScaledVector(dir, rand(2, len)).setY(0); VFX.cracks(p, rand(0.8, 1.4), 2, { grow: 0.1, intensity: 1.8, color: RCOL.solar }); }
  for (let i = 0; i < 6; i++) { const p = o.clone().addScaledVector(dir, rand(0, len)); FX2.glow.spawn({ pos: p, vel: dir.clone().multiplyScalar(rand(6, 16)).add(V3(rand(-1.2, 1.2), rand(-0.5, 2.2), rand(-1.2, 1.2))), life: rand(0.25, 0.5), size: rand(0.08, 0.16), sizeEnd: 0.01, cell: FXA.spark, stretch: 3, pal: 'ra', temp: 1.1, tempEnd: 0.5, int: 2, drag: 1.5 }); }
  // tongues of sunfire rolling along the beam, flames and heat shimmer where it strikes
  for (let i = 0; i < 3; i++) { const p = o.clone().addScaledVector(dir, rand(0.5, len)); FX2.fire.spawn({ pos: p.add(V3(rand(-0.4, 0.4), rand(-0.3, 0.3), rand(-0.4, 0.4))), vel: dir.clone().multiplyScalar(rand(3, 8)).add(V3(0, rand(0.5, 1.5), 0)), life: rand(0.3, 0.5), size: rand(1.0, 1.6), sizeEnd: 0.6, frames: 16, pal: 'ra', temp: 1.0, tempEnd: 0.5, int: 1.25, rot: rand(0, TAU), rotVel: rand(-2, 2), turb: 1 }); }
  if (Math.random() < dt * 30) sunfire(end.clone().setY(0), 2, 1.1);
  S.hz = (S.hz || 0) + dt; if (S.hz > 0.1) { S.hz = 0; FX2.distort.heat(o.clone().addScaledVector(dir, rand(1, len)).setY(1.4), 3.2, 0.007, 0.5); FX2.scorch(o.clone().addScaledVector(dir, rand(2, len)).setY(0), 'ra', { radius: rand(1.0, 1.6), dur: 2.5, int: 1.4 }); }
  VFX.flash(end.clone().setY(1), RCOL.sun, 18, 0.12);
  if (Math.random() < dt * 30) VFX.add.spawn({ pos: o.clone(), life: 0.12, size: rand(1.2, 1.8), sizeEnd: 2.2, color: RCOL.core, intensity: 1.8, cell: FX.flare, alpha: 1, alphaEnd: 0, fadeIn: 0, rot: rand(0, TAU) });
  S.decT = (S.decT || 0) - dt; if (S.decT <= 0) { S.decT = 0.25; const mid = o.clone().addScaledVector(dir, len / 2).setY(0); const dcl = GodFX.decal(mid, VFX.dotTex, RCOL.solar, 1, 0.8, { intensity: 2.2 }); dcl.scaleXY = [AB.sp.width * 1.6, len]; dcl.m.rotation.z = Math.atan2(dir.x, dir.z); }
  S.tick += dt;
  const span = AB.sp.dur / AB.sp.ticks;
  if (S.tick >= span) {
    S.tick -= span; S.ticks++;
    for (const d of Combat.dummies) {
      if (!d.alive) continue;
      const rx = d.pos.x - o.x, rz = d.pos.z - o.z, along = rx * dir.x + rz * dir.z, lat = Math.abs(rx * dir.z - rz * dir.x);
      if (along < 0 || along > len || lat > AB.sp.width / 2 + d.radius) continue;
      const extra = d.isGod ? 0.05 * d.maxHp : 0;   // +5 % of a god's max health, spread over the burn
      Combat.deal(d, ((AB.sp.dmg[S.rank - 1] + AB.sp.scale * settings.power) / AB.sp.ticks + extra / AB.sp.ticks) * sunPower(), 'ult', 'Searing Pain');
      FX2.burst(d.pos.clone().setY(1.2), 'ra', { size: 0.55, sparks: 16, embers: 10, puffs: 2, bursts: 1, distort: false }); sunfire(d.pos, 2, 0.8);
    }
  }
  if (S.t >= AB.sp.charge + AB.sp.dur) { S.beam.dead = true; S.outer.dead = true; searRibbonsFade(S); if (S.loop) S.loop.stop(0.3); WORLD.dim = 1; Cam.frameTarget = 0; RA.sear = null; }
}

// the ribbons fade out with the beam
function searRibbonsFade(S) {
  const H = S.ribH, V = S.ribV; if (!H) return;
  let a = 1;
  GodFX.add({ update(dt, time) { a -= dt * 5; H.mat.uniforms.uAlpha.value = Math.max(0, a) * 1.25; V.mat.uniforms.uAlpha.value = Math.max(0, a) * 0.8; H.mat.uniforms.uTime.value = V.mat.uniforms.uTime.value = time; return a > 0; }, dispose() { H.dispose(); V.dispose(); } });
}
// ---- 5 · BARQUE OF MILLIONS OF YEARS (playroom finale) -----------------------------------------
// The sun's whole day in a few heartbeats: the golden barque rises from the horizon on Ra's left,
// sails in an arc across the sky in front of him and sets on his right. Its sun disc pours rays of
// sunfire onto the field below; at sunset it plunges into the Duat and the scorched path erupts.
const BQ_DAWN = new THREE.Color(1.0, 0.45, 0.42), BQ_NOON = new THREE.Color(1.0, 0.68, 0.22), BQ_DUSK = new THREE.Color(0.95, 0.22, 0.06);
function barqueDepth() { return clamp(groundTargetDistance(AB.bq.range * SU, 9), 9, AB.bq.range * SU); }
function castBarque() {
  spend('bq'); startCd('bq'); speedOfLight();
  P.targeting = null;
  const yaw = P.yaw, f = fwdOf(yaw), side = raSide(yaw), D = barqueDepth();
  const C = P.pos.clone().setY(0).addScaledVector(f, D), HL = AB.bq.half;
  const Bq = { t: 0, yaw, f: f.clone(), side: side.clone(), C, D, HL, burned: new Map(), fired: false, scorch: 0, geysers: 0, kills: 0, slam: false, rays: [], tint: new THREE.Color(), s0: -HL - 4, s1: HL * 0.82 };
  RA.bq = Bq;
  Game.anim.channelTarget = 1;   // Ra rises on the sun's power while his barque crosses the sky
  Cam.frameTarget = 1; Cam.focus = P.pos.clone().setY(0).addScaledVector(f, D * 0.45);
  WORLD.dim = 0.5; GodFX.tint(BQ_DAWN, 0.75); PostFX.vigTarget = 0.55;
  Sound.god('bq_dawn', { gain: 1.0 });
  VFX.later(0.75, () => Sound.god('bq_sail', { gain: 1.05 }));
  VFX.later(0.7, () => { if (RA.bq === Bq) Bq.beamLoop = Sound.god('bq_beam', { gain: 0.75, loop: true }); });
  Sound.voice('fin_charge', { priority: 5, gain: 1.15, cooldown: 0, hold: 4.07 });
  VFX.later(BQ_SET - 0.065, () => Sound.voice('fin_roar', { priority: 6, gain: 1.2, cooldown: 0, hold: 2.6 }));   // "KNEEL" on the sunset boom
  Sound.duckMusic(0.25, 5.0, 2.4);
  Bq.sigil = GodFX.decal(P.pos, GodFX.sig.sun, RCOL.gold, 5, 9999, { spin: 0.5, intensity: 0.9, follow: P.pos }); Bq.sigil.hold = () => (Bq.fade ?? 1) * 0.85;
  // the burnt path: revealed behind the sunfire as the barque sails on
  Bq.path = GodFX.decal(C, VFX.dotTex, RCOL.solar, 1, 9999, { intensity: 0.75 }); Bq.path.scaleXY = [0.01, AB.bq.depth * 1.15]; Bq.path.m.rotation.z = yaw; Bq.path.hold = () => (Bq.fade ?? 1) * 0.85;
  // the barque, gilded, the sun disc burning in its shrine
  Bq.boat = summonModel('barque', { length: AB.bq.length, rim: RCOL.gold, rimK: 0.5, edge: RCOL.sun, dir: 0.0, noise: 3.5, glow: 0.05 });
  Bq.boat.group.rotation.order = 'YXZ';
  const bx = Bq.boat.box; Bq.anchor = new THREE.Object3D(); Bq.anchor.position.set((bx.min.x + bx.max.x) / 2, bx.min.y + Bq.boat.size.y * 0.5, (bx.min.z + bx.max.z) / 2); Bq.boat.inner.add(Bq.anchor);
  Bq.sternOff = Bq.boat.size.x * Bq.boat.k * 0.45;
  Bq.sun = glowSprite(VFX.dotTex, RCOL.solar, 3.4, 1.2); Bq.sun.renderOrder = 9; scene.add(Bq.sun);
  Bq.rays8 = glowSprite(GodFX.cellTex(GX.sunrays), RCOL.sun, 6.5, 0.9); Bq.rays8.renderOrder = 9; scene.add(Bq.rays8);
  Bq.halo = glowSprite(VFX.dotTex, RCOL.crimson, 26, 0.6); Bq.halo.renderOrder = 1; Bq.halo.material.depthWrite = false; scene.add(Bq.halo);
  Bq.falcon = new SpectralBeast('falcon', { style: 'ghost', size: 2.8, color: new THREE.Color(0.95, 0.38, 0.04), rim: RCOL.gold, tex: 0.6 }); Bq.falcon.alpha = 0;
  Bq.wake = [VFX.trail(0.9, RCOL.gold, 1.4, 22), VFX.trail(0.6, RCOL.solar, 1.4, 22)];
  VFX.burst(P.pos.clone().setY(1.6), { color: RCOL.gold, count: 26, speed: 4, flash: 1.2, intensity: 1.6 });
}
// where the barque is on its arc (s: along Ra's left→right, y: height), u = 0..1 through the day
function barqueArc(Bq, T) {
  const u = clamp((T - 0.3) / (BQ_SET - 0.3), 0, 1), s = lerp(Bq.s0, Bq.s1, u);
  let y = -1.2 + 8.0 * Math.pow(Math.sin(Math.PI * u), 0.55);
  if (T > BQ_SET) y -= (T - BQ_SET) * 14;
  return { u, s, y };
}
function updateBarque(dt, t) {
  const Bq = RA.bq; if (!Bq) return;
  Bq.t += dt;
  const T = Bq.t, f = Bq.f, side = Bq.side;
  if (!Bq.slam && T >= BQ_SET - 2.3) { Bq.slam = true; Game.anim.channelTarget = 0; Game.anim.play('sunslam', { speed: 1 }); }
  // dawn → noon → dusk
  const dayK = clamp(T / BQ_SET, 0, 1);
  if (!Bq.fired) { Bq.tint.copy(BQ_DAWN).lerp(BQ_NOON, smoothstep(0, 0.45, dayK)).lerp(BQ_DUSK, smoothstep(0.5, 1, dayK)); GodFX.tint(Bq.tint, 0.95); }
  const A = barqueArc(Bq, T), A2 = barqueArc(Bq, T + 0.05);
  const bp = _raq.bp.copy(Bq.C).addScaledVector(f, AB.bq.back).addScaledVector(side, A.s).setY(A.y + Math.sin(T * 2.4) * 0.15);
  const boat = Bq.boat;
  if (boat) {
    boat.group.position.copy(bp);
    const slope = Math.atan2(A2.y - A.y, Math.max(0.01, A2.s - A.s)), ps = BARQUE_FLIP ? -1 : 1;
    boat.group.rotation.set(Math.sin(T * 1.7) * 0.03, Bq.yaw + Math.PI + BARQUE_FLIP, ps * (slope * 0.75 + Math.sin(T * 1.3) * 0.03));
    boat.reveal(T < BQ_SET ? smoothstep(0.2, 0.8, T) * 1.12 : 1.12 * (1 - smoothstep(BQ_SET + 0.15, BQ_SET + 0.45, T)));
    boat.glow(0.05 + 0.04 * Math.sin(T * 5));
    boat.group.updateMatrixWorld(true);
    const disc = Bq.anchor.getWorldPosition(_raq.disc);
    const vis = smoothstep(0.35, 0.8, T) * (1 - smoothstep(BQ_SET - 0.05, BQ_SET + 0.2, T));
    Bq.sun.position.copy(disc); Bq.rays8.position.copy(disc);
    Bq.sun.material.opacity = vis; Bq.rays8.material.opacity = vis * 0.75; Bq.rays8.material.rotation += dt * 0.5;
    Bq.halo.position.copy(disc).addScaledVector(f, 6); Bq.halo.material.opacity = vis * 0.8; Bq.halo.material.color.copy(Bq.tint).multiplyScalar(0.6);
    // a wake of golden light streams from the stern
    const stern = _raq.stern.copy(bp).addScaledVector(side, -Bq.sternOff).setY(bp.y - 1.2);
    Bq.wake[0].push(stern); Bq.wake[1].push(stern.setY(stern.y - 0.6));
    if (Math.random() < dt * 50 * vis) VFX.add.spawn({ pos: bp.clone().add(V3(rand(-5, 5), rand(-2, 1.5), rand(-1.5, 1.5))), vel: V3(rand(-0.5, 0.5), rand(-2.2, -0.6), rand(-0.5, 0.5)), life: rand(0.9, 1.6), size: rand(0.08, 0.16), sizeEnd: 0.02, color: Math.random() < 0.5 ? RCOL.gold : RCOL.sun, intensity: 1.7, cell: FX.ember, drag: 0.3 });
    // the falcon of Horus flies ahead of the barque
    const F = Bq.falcon; if (F) { F.group.position.copy(bp).addScaledVector(side, 7 + Math.sin(T * 1.4)).addScaledVector(f, -3).setY(bp.y + 2.5 + Math.sin(T * 3) * 0.6); F.group.rotation.set(0, Bq.yaw - Math.PI / 2, -0.2, 'YXZ'); F.alpha = vis * 0.9; F.update(dt, 0, t); }
    // rays of sunfire pour from the disc onto the field
    const shine = T >= 0.6 && T < BQ_SET - 0.12 && A.y > 1.8;
    const G = _raq.G.copy(Bq.C).addScaledVector(side, A.s).setY(0);
    if (shine) {
      if (!Bq.rays.length) {
        Bq.rays.push(GodFX.beam(disc, G, 0.7, RCOL.solar, { core: RCOL.sun, scroll: -10, k: 16, gain: 0.45 }));
        Bq.rays.push(GodFX.beam(disc, G, 1.6, RCOL.crimson, { core: RCOL.solar, scroll: -5, k: 12, gain: 0.3 }));
        for (let i = 0; i < 6; i++) Bq.rays.push(GodFX.beam(disc, G, 0.14, RCOL.solar, { core: RCOL.sun, scroll: -8, k: 10, gain: 0.5, taper: 1.8 }));
        Bq.rays[0].target = 0.95; Bq.rays[1].target = 0.6; for (let i = 2; i < 8; i++) Bq.rays[i].target = 0.7;
      }
      const R = AB.bq.depth * 0.5;
      for (let i = 0; i < Bq.rays.length; i++) {
        const r = Bq.rays[i]; r.from.copy(disc);
        if (i < 2) r.to.copy(G);
        else { const a = T * 0.9 + (i - 2) * TAU / 6; r.to.copy(G).addScaledVector(f, Math.cos(a) * R).addScaledVector(side, Math.sin(a) * R * 0.75); if (Math.random() < dt * 14) VFX.add.spawn({ pos: r.to.clone().setY(0.15), life: 0.3, size: rand(0.5, 0.8), sizeEnd: 1.1, color: RCOL.sun, intensity: 1.4, cell: FX.flare, alpha: 1, alphaEnd: 0, fadeIn: 0, rot: rand(0, TAU) }); }
      }
      sunfire(G.clone().add(V3(rand(-R, R) * 0.6, 0, rand(-R, R) * 0.6)), 2, 1.1);
      if (Math.random() < dt * 16) FX2.smoke.spawn({ pos: G.clone().add(V3(rand(-R, R), 0.4, rand(-R, R))), vel: V3(rand(-0.5, 0.5), rand(1, 2.4), rand(-0.5, 0.5)), life: rand(1.4, 2.2), size: rand(1.0, 1.6), sizeEnd: 3.4, frames: 16, pal: 'ra', temp: 0.5, tempEnd: 0, int: 1.3, alpha: 0.7, drag: 1, turb: 0.6 });
      Bq.hz = (Bq.hz || 0) + dt; if (Bq.hz > 0.08) { Bq.hz = 0; FX2.scorch(G, 'ra', { radius: R * 0.8, dur: BQ_SET - T + 2, int: 1.4 }); FX2.distort.heat(G.clone().setY(1.5), 4, 0.007, 0.5); }
      Bq.scorch += dt; if (Bq.scorch > 0.07) { Bq.scorch = 0; VFX.cracks(G.clone().addScaledVector(f, rand(-R, R) * 0.7), rand(1.0, 1.7), BQ_SET - T + 1.8, { grow: 0.1, intensity: 1.2, color: RCOL.solar }); }
      // the burnt path grows behind the light
      const s0 = Math.max(Bq.s0, -Bq.HL - 2), len = Math.max(0.01, A.s - s0);
      Bq.path.scaleXY = [len, AB.bq.depth * 1.15]; Bq.path.m.position.copy(Bq.C).addScaledVector(side, s0 + len / 2).setY(0.035);
      // everything under the light burns, and the disc blinds it
      for (const d of Combat.dummies) {
        if (!d.alive) continue;
        const dx = d.pos.x - G.x, dz = d.pos.z - G.z;
        if (Math.abs(dx * f.x + dz * f.z) > R + d.radius || Math.abs(dx * side.x + dz * side.z) > R * 0.85 + d.radius) continue;
        const b = Bq.burned.get(d) || { acc: 0.2 }; Bq.burned.set(d, b);
        b.acc += dt; if (b.acc > 0.25) { b.acc = 0; Combat.deal(d, (BQ_DMG.ray[0] + BQ_DMG.ray[1] * settings.power) * sunPower(), 'dot', 'Barque of Millions of Years'); d.blinded(1.2); }
      }
    } else if (Bq.rays.length && T >= BQ_SET - 0.12) { for (const r of Bq.rays) r.dead = true; Bq.rays = []; if (Bq.beamLoop) Bq.beamLoop.stop(0.3); }
  }
  // sunset: the barque plunges into the Duat and the scorched path erupts, from the dive back to dawn
  if (!Bq.fired && T >= BQ_SET) barqueSunset(Bq);
  if (Bq.fired) {
    const k = T - BQ_SET, N = 7;
    while (Bq.geysers < N && k >= Bq.geysers * 0.1) {
      const i = Bq.geysers++, sAt = lerp(Bq.s1, Math.max(Bq.s0, -Bq.HL), i / (N - 1));
      const p = Bq.C.clone().addScaledVector(side, sAt);
      const col = GodFX.column(p, 1.5, 11, RCOL.crimson, { core: RCOL.solar, scroll: -9, k: 40, gain: 0.42, flare: 1.6 }); col.target = 0.95; VFX.later(0.45, () => { col.dead = true; });
      const hot = GodFX.column(p, 0.55, 12, RCOL.solar, { core: RCOL.sun, scroll: -14, k: 40, gain: 0.38 }); hot.target = 0.9; VFX.later(0.3, () => { hot.dead = true; });
      FX2.ring(p, 'ra', { radius: 5, dur: 0.45 });
      FX2.burst(p.clone().setY(1.0), 'ra', { size: 1.0, sparks: 30, embers: 16, puffs: 0, bursts: 1, light: false, distort: false, int: 0.9 });
      sunfire(p, 6, 1.4);
      FX2.debris(p.clone().setY(0.3), null, 8, 1.1, FX2.pal('molten'));
      VFX.flash(p.clone().setY(1.5), RCOL.solar, 6, 0.3);
      for (let n = 0; n < 26; n++) VFX.add.spawn({ pos: p.clone().add(V3(rand(-1.5, 1.5), rand(0.2, 1.5), rand(-1.5, 1.5))), vel: V3(rand(-4, 4), rand(5, 13), rand(-4, 4)), life: rand(0.5, 1.0), size: rand(0.1, 0.2), sizeEnd: 0.02, color: Math.random() < 0.5 ? RCOL.sun : RCOL.crimson, intensity: 2.0, cell: FX.ember, gravity: -8, drag: 0.6 });
      for (let n = 0; n < 10; n++) FX2.smoke.spawn({ pos: p.clone().add(V3(rand(-1.6, 1.6), rand(0.4, 2.5), rand(-1.6, 1.6))), vel: V3(rand(-1.5, 1.5), rand(2, 6), rand(-1.5, 1.5)), life: rand(1.4, 2.4), size: rand(1.2, 2.0), sizeEnd: 4.2, frames: 16, pal: 'ra', temp: 0.6, tempEnd: 0, int: 1.4, alpha: 0.8, drag: 1.2, turb: 0.6 });
      Cam.shake = Math.max(Cam.shake, 0.45);
      for (const d of dummiesNear(p, 4.8)) barqueBurn(Bq, d);
    }
    // "...beneath the SUN!": the great flare - the sun's last light bursts up from the middle of the burnt path,
    // and whatever the sunlight touched goes down into the Duat with it
    if (!Bq.great && k >= BQ_SUN) barqueGreatFlare(Bq);
    Bq.fade = 1 - smoothstep(BQ_SUN + 0.5, BQ_SUN + 1.6, k);
    if (k > BQ_SUN + 0.6) { Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(RCOL.sun, 0); PostFX.vigTarget = 0; WORLD.dim = 1; }
    if (k > BQ_SUN + 1.8) barqueCleanup(Bq);
  }
}
function barqueBurn(Bq, d) {
  // one great burn per foe (a geyser under them or the great flare, whichever comes first)
  const b = Bq.burned.get(d) || { acc: 0 }; Bq.burned.set(d, b);
  if (b.big) return; b.big = true;
  Combat.deal(d, (BQ_DMG.burn[0] + BQ_DMG.burn[1] * settings.power) * sunPower(), 'final', 'Barque of Millions of Years');
  FX2.burst(d.pos.clone().setY(1.2), 'ra', { size: 0.7, sparks: 22, embers: 14, puffs: 3, bursts: 1, distort: false }); sunfire(d.pos, 3, 1.0);
  if (!d.alive) Bq.kills++;
}
function barqueGreatFlare(Bq) {
  Bq.great = true;
  const sMid = (Math.max(Bq.s0, -Bq.HL) + Bq.s1) / 2, p = Bq.C.clone().addScaledVector(Bq.side, sMid);
  Sound.god('dl_burst', { gain: 1.0 }); Sound.god('cb_strike', { gain: 1.0 }); Sound.god('sonic_boom', { gain: 0.5, shared: true });
  Game.hitStop(0.1, 0.1); Cam.shake = Math.max(Cam.shake, 0.85); Cam.fovKick = 8;
  PostFX.shock(p.clone().setY(2), 1.0, 0.75); PostFX.aberr = 0.005;
  const col = GodFX.column(p, 3.2, 26, RCOL.crimson, { core: RCOL.solar, scroll: -12, k: 30, gain: 0.45, flare: 1.8 }); col.target = 1.0; VFX.later(0.7, () => { col.dead = true; });
  const hot = GodFX.column(p, 1.2, 28, RCOL.solar, { core: RCOL.sun, scroll: -16, k: 30, gain: 0.42 }); hot.target = 0.95; VFX.later(0.5, () => { hot.dead = true; });
  FX2.ring(p, 'ra', { radius: 16, dur: 0.7, width: 0.06 });
  FX2.ring(p, 'molten', { radius: 9, dur: 0.5 });
  FX2.burst(p.clone().setY(2.5), 'ra', { size: 2.2, sparks: 90, embers: 50, puffs: 10, bursts: 2, int: 0.9 });
  FX2.distort.ring(p.clone().setY(2), 34, 0.026, 0.7);
  FX2.debris(p.clone().setY(0.5), null, 26, 1.8, FX2.pal('molten'));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; sunfire(p.clone().add(V3(Math.cos(a) * 3, 0, Math.sin(a) * 3)), 3, 1.6); }
  VFX.flash(p.clone().setY(3), RCOL.solar, 18, 0.5);
  GodFX.decal(p, GodFX.sig.sun, RCOL.solar, 12, 1.6, { spin: 0.8, intensity: 1.0, grow: 0.3 });
  for (let n = 0; n < 70; n++) VFX.add.spawn({ pos: p.clone().add(V3(rand(-2.5, 2.5), rand(0.3, 4), rand(-2.5, 2.5))), vel: V3(rand(-7, 7), rand(6, 18), rand(-7, 7)), life: rand(0.7, 1.4), size: rand(0.12, 0.26), sizeEnd: 0.02, color: Math.random() < 0.5 ? RCOL.sun : RCOL.crimson, intensity: 2.0, cell: FX.ember, gravity: -9, drag: 0.5 });
  for (let n = 0; n < 18; n++) FX2.smoke.spawn({ pos: p.clone().add(V3(rand(-3, 3), rand(0.5, 4), rand(-3, 3))), vel: V3(rand(-2.5, 2.5), rand(2, 7), rand(-2.5, 2.5)), life: rand(1.6, 2.6), size: rand(1.6, 2.6), sizeEnd: 5.5, frames: 16, pal: 'ra', temp: 0.6, tempEnd: 0, int: 1.4, alpha: 0.8, drag: 1.2, turb: 0.6 });
  for (const [d] of Bq.burned) if (d.alive) { const q = d.pos.clone().setY(0); const c2 = GodFX.column(q, 1.0, 9, RCOL.crimson, { core: RCOL.solar, scroll: -9, k: 40, gain: 0.42 }); VFX.later(0.35, () => { c2.dead = true; }); barqueBurn(Bq, d); }
  if (Bq.kills >= 2) VFX.later(1.4, () => Sound.voice('fin_line', { priority: 3, cooldown: 20 }));
}
function barqueSunset(Bq) {
  Bq.fired = true;
  const end = Bq.C.clone().addScaledVector(Bq.side, Bq.s1).setY(1.5);
  Sound.god('bq_sunset', { gain: 1.1 });
  Game.hitStop(0.14, 0.08);
  Cam.shake = 1.0; Cam.fovKick = 9;
  PostFX.shock(end, 1.1, 0.85); PostFX.aberr = 0.006;
  VFX.flash(end, RCOL.solar, 14, 0.7);
  GodFX.tint(BQ_DUSK, 0.95);
}
function barqueCleanup(Bq) {
  if (RA.bq !== Bq) return;
  if (Bq.boat) Bq.boat.dispose();
  for (const r of Bq.rays) r.dead = true;
  if (Bq.beamLoop) Bq.beamLoop.stop(0.2);
  for (const w of Bq.wake) w.alive = false;
  scene.remove(Bq.sun); Bq.sun.material.dispose(); scene.remove(Bq.rays8); Bq.rays8.material.dispose(); scene.remove(Bq.halo); Bq.halo.material.dispose();
  if (Bq.falcon) Bq.falcon.dispose();
  Bq.sigil.dead = true; Bq.path.dead = true;
  Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(RCOL.sun, 0); PostFX.vigTarget = 0; WORLD.dim = 1; Game.anim.channelTarget = 0;
  RA.bq = null;
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const RA_INFO = {
  passive: { name: 'Speed of Light', kind: 'Passive · Speed',
    text: 'Each time Ra uses an ability he gains 5% movement speed for 15 seconds. Stacks up to 3 times, and each new stack refreshes the duration.',
    rows: () => [['Stacks', `${RA.sol.length} / 3`], ['Speed', `+${RA.sol.length * 5}%`]] },
  cb: { name: 'Celestial Beam', kind: 'Line · Magical',
    text: 'A beam of sunlight falls from the sky slightly behind Ra and sweeps forward along the line almost immediately, damaging all enemies it passes.',
    rows: () => { const r = rankOf('cb'); return [['Damage', `${AB.cb.dmg[r - 1]} (+100% of ${settings.power} MP) = ${Math.round(AB.cb.dmg[r - 1] + settings.power)}`], ['Range', '80 · width 9'], ['Cooldown', `${cdOf('cb').toFixed(1)} s`]]; } },
  dl: { name: 'Divine Light', kind: 'Area · Slow · Blind · Magical',
    text: 'Light streams out from Ra for 2 seconds, slowing enemies around him more and more. Then the light explodes, damaging and blinding them.',
    rows: () => { const r = rankOf('dl'); return [['Damage', `${AB.dl.dmg[r - 1]} (+70% MP)`], ['Blind', `${AB.dl.blind} s`], ['Radius', '30'], ['Cooldown', `${cdOf('dl').toFixed(1)} s`]]; } },
  sb: { name: 'Solar Blessing', kind: 'Area · Healing · Magical',
    text: 'Ra blesses the ground at the target location with a pillar of sunlight for 6 seconds. Enemies in the light take damage every second; if Ra himself stands in it, he is healed and deals 15% more damage.',
    rows: () => { const r = rankOf('sb'); return [['Damage', `${AB.sb.dmg[r - 1]}/s (+25% MP)`], ['Healing', `${AB.sb.heal[r - 1]}/s`], ['Range', '55 · radius 20'], ['Cooldown', `${cdOf('sb').toFixed(1)} s`]]; } },
  sp: { name: 'Searing Pain', kind: 'Ultimate · Beam · Magical',
    text: 'Ra stands still, gathers the sun for a moment and fires an enormous heat beam forward that burns everything in its path for two seconds, plus 5% of a god\'s max health as true damage. The beam can be swung slowly.',
    rows: () => { const r = rankOf('sp'); return [['Damage', `${AB.sp.dmg[r - 1]} (+110% MP) total`], ['Range', '120 · width 20'], ['Cooldown', `${cdOf('sp').toFixed(0)} s`]]; } },
  bq: { name: 'Barque of Millions of Years', kind: 'Final ability · Journey of the Sun · True damage',
    text: 'Not in SMITE – every day Ra sails the sun barque across the sky, and every night into the Duat. He aims out a strip in front of him: the sky turns from dawn to gold to blood-red dusk as the gilded barque rises from the horizon on the left, sails in an arc across the sky and pours solar fire down from the sun disc. Everything the light touches burns and is blinded. At sunset the barque plunges into the Duat on the right – and the scorched path erupts in solar flames that take with them everything the sun has touched.',
    rows: () => [['Strip', `${AB.bq.half * 2} m wide · ${AB.bq.depth} m deep`], ['Damage', `${Math.round(BQ_DMG.burn[0] + BQ_DMG.burn[1] * settings.power)} + sun rays ${Math.round(BQ_DMG.ray[0] + BQ_DMG.ray[1] * settings.power)} every 0.25 s`], ['Sunset', `${BQ_SET.toFixed(1)} s`], ['Cost', `${costOf('bq')} mana`], ['Cooldown', `${cdOf('bq').toFixed(0)} s`]] },
};
registerGod({
  id: 'ra', dbg: RA, name: 'Ra', title: 'God of the Sun', epithet: 'The Sun God', pantheon: 'Egyptian', role: 'Mage',
  color: '#ff9a3a', glyphs: '𓇳 𓁛 𓂀 𓋹 𓅃', asset: 'ra', stats: RA_STATS, order: ['cb', 'dl', 'sb', 'sp', 'bq'], ab: raAB,
  blurb: 'The king of the gods with falcon head and sun disc – rays from the sky, blinding light – and the finale <em>Barque of Millions of Years</em>.',
  info: RA_INFO, magical: true, textColor: '#ffb45a', finalColor: '#ff8a2a', fxColor: RCOL.sun, accent: RCOL.sun,
  init() { RA.sol = []; },
  dispose() {
    if (RA.divine) { RA.divine.halo.dead = true; RA.divine = null; }
    if (RA.bless) { RA.bless.col.dead = true; if (RA.bless.loop) RA.bless.loop.stop(0.1); RA.bless = null; }
    if (RA.sear) { const S = RA.sear; if (S.beam) { S.beam.dead = true; S.outer.dead = true; } if (S.ribH) { S.ribH.dispose(); S.ribV.dispose(); } if (S.loop) S.loop.stop(0.1); RA.sear = null; }
    if (RA.bq) barqueCleanup(RA.bq);
    Game.anim.channelTarget = 0;
    WORLD.dim = 1; GodFX.tint(RCOL.sun, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.focus = null; P.speedBuff = 1;
  },
  intercept() { return !!(RA.bq || RA.sear); },
  busy() { return !!(RA.bq || RA.sear); },
  cast(id) { ({ cb: castCelestialBeam, dl: castDivineLight, sb: castSolarBlessing, sp: castSearingPain, bq: castBarque })[id](); },
  basic: raBasic,
  speedMul() { return RA.bq || RA.sear ? 0 : (1 + RA.sol.length * 0.05) * (RA.divine ? 0.8 : 1); },
  noJump() { return !!(RA.bq || RA.sear); },
  eyeBoost() { return (RA.bq ? 1.6 : 0) + (RA.sear ? 1.2 : 0) + (RA.divine ? 0.6 : 0) + RA.sol.length * 0.1; },
  update(dt, t) {
    RA.sol = RA.sol.map((x) => x - dt).filter((x) => x > 0);
    updateDivineLight(dt); updateSolarBlessing(dt); updateSearingPain(dt, t); updateBarque(dt, t);
  },
  targeter() {
    if (P.targeting === 'sb') { const c = groundTarget(AB.sb.range * SU, 2); circleTarget.show(c, AB.sb.radius * SU, RCOL.gold); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.35, 0.35); }
    else if (P.targeting === 'bq') { const D = barqueDepth(), f = fwdOf(P.yaw, _raq.f), sd = raSide(P.yaw, _raq.sd); const o = _raq.o.copy(P.pos).setY(0).addScaledVector(f, D).addScaledVector(sd, -AB.bq.half); lineTarget.show(o, P.yaw - Math.PI / 2, AB.bq.half * 2, AB.bq.depth, AB.bq.depth, 0); }
    else if (RA.sear) lineTarget.show(P.pos, RA.sear.yaw, AB.sp.range * SU, AB.sp.width, AB.sp.width, 0);
  },
  armed(id) { return (id === 'dl' && !!RA.divine) || (id === 'sb' && !!RA.bless) || (id === 'sp' && !!RA.sear) || (id === 'bq' && !!RA.bq); },
  buffs() { return [{ icon: 'ra_sol', on: RA.sol.length > 0, n: RA.sol.length, t: RA.sol.length ? Math.ceil(Math.max(...RA.sol)) + 's' : '' }, { icon: 'ra_bless', on: !!(RA.bless && RA.bless.inside), n: '', t: '' }]; },
  onDummyDeath(d, p) { for (let i = 0; i < 12; i++) VFX.add.spawn({ pos: p.clone().add(V3(rand(-0.4, 0.4), rand(0.3, 1.6), rand(-0.4, 0.4))), vel: V3(rand(-0.6, 0.6), rand(1, 2.4), rand(-0.6, 0.6)), life: rand(0.8, 1.5), size: rand(0.05, 0.1), sizeEnd: 0.01, color: Math.random() < 0.5 ? RCOL.sun : RCOL.gold, intensity: 2, cell: FX.ember, drag: 0.6 }); },
  icon(ctx, S, id) {
    const sun = (fn, col = '#ffc06a', blur = 16) => glowText(ctx, fn, col, blur);
    if (id === 'passive' || id === 'ra_sol') { iconBase(ctx, S, '#c86a10', '#2a1002'); sun(() => { ctx.fillStyle = '#ffe4a8'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(S * (0.2 + i * 0.22), S * 0.25); ctx.lineTo(S * (0.38 + i * 0.22), S * 0.5); ctx.lineTo(S * (0.2 + i * 0.22), S * 0.75); ctx.lineTo(S * (0.28 + i * 0.22), S * 0.5); ctx.fill(); } }); }
    else if (id === 'cb') { iconBase(ctx, S, '#d07a18', '#2a1004'); sun(() => { const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, 'rgba(255,220,160,0.2)'); g.addColorStop(1, '#ffd890'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(S * 0.2, 0); ctx.lineTo(S * 0.42, 0); ctx.lineTo(S * 0.92, S * 0.86); ctx.lineTo(S * 0.62, S * 0.9); ctx.fill(); }); }
    else if (id === 'dl') { iconBase(ctx, S, '#e0a030', '#3a1a02'); sun(() => { ctx.drawImage(GodFX.cellTex(GX.sunrays).image, S * 0.06, S * 0.06, S * 0.88, S * 0.88); }, '#ffd27a', 20); }
    else if (id === 'sb' || id === 'ra_bless') { iconBase(ctx, S, '#c87a28', '#2a1404'); sun(() => { drawGlyph(ctx, 'ankh', S / 2, S / 2, S * 0.62, '#ffe8c0'); }); }
    else if (id === 'sp') { iconBase(ctx, S, '#b03010', '#200402'); sun(() => { const g = ctx.createLinearGradient(0, S / 2, S, S / 2); g.addColorStop(0, '#ffd890'); g.addColorStop(1, 'rgba(255,90,20,0.2)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(S * 0.12, S * 0.42); ctx.lineTo(S, S * 0.3); ctx.lineTo(S, S * 0.7); ctx.lineTo(S * 0.12, S * 0.58); ctx.fill(); ctx.beginPath(); ctx.arc(S * 0.16, S / 2, S * 0.12, 0, TAU); ctx.fill(); }, '#ff7a2a', 20); }
    else if (id === 'bq') { iconBase(ctx, S, '#a04008', '#120400'); sun(() => { ctx.fillStyle = '#ffc860'; ctx.beginPath(); ctx.arc(S / 2, S * 0.36, S * 0.16, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffd890'; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.moveTo(S * 0.1, S * 0.5); ctx.quadraticCurveTo(S * 0.5, S * 0.82, S * 0.9, S * 0.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(S * 0.1, S * 0.5); ctx.lineTo(S * 0.06, S * 0.36); ctx.moveTo(S * 0.9, S * 0.5); ctx.lineTo(S * 0.94, S * 0.36); ctx.stroke(); }, '#ff8a2a', 22); }
    else return false;
    return true;
  },
});


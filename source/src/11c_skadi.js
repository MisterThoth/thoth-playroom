// ============================================================================
// SKADI, goddess of winter and the hunt (SMITE 1 kit, final patch: Kaldr the Winter Wolf, Piercing
// Cold, Rune of the Hunt, Permafrost, Winter's Grasp - the 2019 version: one storm around Skadi at
// once, Kaldr leaps to the aimed circle and a second storm erupts around him; the first hit of each
// storm roots, then it ticks for 4 s) + the playroom finale HOWL OF THRYMHEIM: Skadi calls her
// mountain hall - glacier peaks rise on the horizon, the wolves of Thrymheim howl on the ridge, and
// an avalanche led by the pack thunders down the hall, sweeps every foe up and buries them at her
// spear; the wolves feed, and the snow tombs shatter.
// ============================================================================
const SKADI_STATS = { hp: [410, 78], mp: [210, 36], speed: 370, range: 55, as: [0.95, 0.017], basic: [38, 2.2], basicScale: 1.0, hp5: [8, 0.7], mp5: [4.7, 0.4] };
const TH_IMPACT = 2.6;          // the avalanche slams to a halt at her spear
const TH_SHATTER = 1.6;
// Howl of Thrymheim damage, [base, x physical power]: swept up, bitten, the tomb shatters. Balance (ability 5 >= 2 x
// ability 4): 920 + 2.6 PP in all = 2.27 x one Winter's Grasp storm at rank 5 (205 + 0.35 PP hit + 8 x (25 + 0.1 PP)),
// and still above both storms stacked on one target (was 520 + 1.8 PP in all, weaker than the 4)
const TH_DMG = { sweep: [120, 0.5], bite: [160, 0.7], shatter: [640, 1.4] };
const thDmg = (k) => TH_DMG[k][0] + TH_DMG[k][1] * ppow();         // ...and the snow tombs burst on "FALL!" (her roar starts as her summons ends, 3.15 s)
const SK = { kaldr: null, hunt: null, storms: [], th: null, atkHand: 0, onIce: false, iceT: 0 };
const ppow = () => Math.round(settings.power * 0.55);   // the power slider read as physical power
const SKC = { deep: new THREE.Color(0.04, 0.22, 0.75), glacier: new THREE.Color(0.1, 0.45, 1.0), ice: new THREE.Color(0.35, 0.78, 1.0), frost: new THREE.Color(0.6, 0.86, 1.0), aurora: new THREE.Color(0.15, 1.0, 0.6), snow: new THREE.Color(0.72, 0.84, 0.98) };
const skadiAB = {
  pc: { id: 'pc', name: 'Piercing Cold', dmg: [90, 145, 200, 255, 310], scale: 0.8, cost: [60, 65, 70, 75, 80], cd: [12, 12, 12, 12, 12], range: 55, slow: [0.2, 0.25, 0.3, 0.35, 0.4], slowDur: 3, kaldr: [1.0, 1.15, 1.3, 1.45, 1.6], targeted: true },
  rh: { id: 'rh', name: 'Rune of the Hunt', pct: [0.5, 0.575, 0.65, 0.725, 0.8], dashPct: [0.7, 0.8, 0.9, 1.0, 1.1], cost: [0, 0, 0, 0, 0], cd: [0.5, 0.5, 0.5, 0.5, 0.5], range: 70, reticle: 10, dash: 20, dashCd: 5 },
  pf: { id: 'pf', name: 'Permafrost', dmg: [70, 100, 130, 160, 190], scale: 0.5, tick: [10, 15, 20, 25, 30], tickScale: 0.05, cost: [60, 65, 70, 75, 80], cd: [16, 16, 16, 16, 16], range: 55, radius: [16, 16, 18, 18, 20], dur: 5, slow: 0.15, speed: [0.2, 0.25, 0.3, 0.35, 0.4], targeted: true },
  wg: { id: 'wg', name: "Winter's Grasp", dmg: [45, 85, 125, 165, 205], scale: 0.35, tick: [5, 10, 15, 20, 25], tickScale: 0.1, root: [1, 1.25, 1.5, 1.75, 2], cost: [80, 90, 100, 110, 120], cd: [100, 100, 100, 100, 100], range: 70, radius: 20, dur: 4, targeted: true },
  th: { id: 'th', name: 'Howl of Thrymheim', cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33], length: 34, width: 15 },
};

// frost magic (FX2): glittering ice motes, a burst of frost with shards of ice, freezing mist
function frostMotes(p, n = 8, spread = 0.6) {
  for (let i = 0; i < n; i++) { const r = Math.random(); FX2.glow.spawn({ pos: p.clone().add(V3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))), vel: V3(rand(-0.8, 0.8), rand(0.1, 1.2), rand(-0.8, 0.8)), life: rand(0.6, 1.3), size: r < 0.3 ? rand(0.14, 0.24) : rand(0.05, 0.1), sizeEnd: 0.01, cell: r < 0.3 ? FXA.star : r < 0.75 ? FXA.ember : FXA.shard, pal: 'skadi', temp: 1.0, tempEnd: 0.5, int: 1.7, drag: 0.8, turb: 2.2, rotVel: rand(-4, 4) }); }
}
function frostBurst(p, s = 1, o = {}) {
  FX2.burst(p, 'skadi', { size: s, sparks: Math.round(26 * s), embers: Math.round(14 * s), puffs: Math.round(4 * s), bursts: o.bursts ?? 1, int: o.int ?? 1.0, distort: o.distort });
  for (let i = 0; i < Math.round(8 * s); i++) FX2.embers.spawn({ pos: p.clone(), vel: V3(rand(-4, 4), rand(2, 7), rand(-4, 4)).multiplyScalar(Math.sqrt(s)), size: rand(0.05, 0.12) * Math.sqrt(s), color: SKC.ice, fadeColor: SKC.deep, life: rand(0.8, 1.4) });
  frostMotes(p, Math.round(8 * s), 0.4 * s);
}

// ---- Kaldr, the Winter Wolf --------------------------------------------------------------
function makeKaldr() {
  const ghost = new SpectralBeast('wolf', { style: 'ghost', size: 1.55, color: new THREE.Color(0.1, 0.42, 1.0), rim: new THREE.Color(0.45, 0.85, 1.0), eyes: new THREE.Color(0.5, 0.95, 1.0), tex: 0.55 });
  const beast = new SpectralBeast('wolf', { style: 'solid', size: 1.55, rim: GCOL.ice, glow: 0.18, eyes: new THREE.Color(0.6, 0.95, 1.0) });
  const k = { ghost, beast, pos: P.pos.clone().add(V3(-1.5, 0, -1.5)), yaw: P.yaw, form: 0, formT: 0, vel: V3(), biteT: 0, howlT: rand(6, 12), idleT: 0, air: 0, dashCd: 0, wg: null };
  beast.alpha = 0; beast.group.visible = false;
  return k;
}
function kaldrTransform(toBeast) {
  const K = SK.kaldr; if (!K) return;
  K.formT = toBeast ? 1 : 0;
  const p = K.pos.clone().setY(0.7);
  frostBurst(p, 0.9);
  FX2.ring(K.pos.clone().setY(0), 'skadi', { radius: 2.2, dur: 0.45, width: 0.06 });
  GodFX.shards(p, 8, 0.7);
  for (let i = 0; i < 14; i++) GodFX.spawn({ pos: p.clone().add(V3(rand(-0.6, 0.6), rand(0, 0.8), rand(-0.6, 0.6))), vel: V3(rand(-2, 2), rand(0.5, 2.5), rand(-2, 2)), life: rand(0.6, 1.1), size: rand(0.12, 0.22), sizeEnd: 0.03, color: GCOL.iceHot, intensity: 2, cell: GX.snow, rotVel: rand(-5, 5), drag: 1 });
}
function updateKaldr(dt, t) {
  const K = SK.kaldr; if (!K) return;
  // the marked prey; if it falls, he moves on to the nearest foe around it
  if (SK.hunt && (!SK.hunt.target || !SK.hunt.target.alive)) {
    const last = SK.hunt.target ? SK.hunt.target.pos : K.pos;
    const next = dummiesNear(last, 10)[0];
    if (next) retargetHunt(next); else SK.hunt.target = null;
  }
  const hunt = SK.hunt && SK.hunt.target && SK.hunt.target.alive ? SK.hunt.target : null;
  K.dashCd = Math.max(0, (K.dashCd || 0) - dt);
  // Winter's Grasp: he bounds to the aimed circle (a leap when it is far) and the second storm erupts on landing
  if (K.wg) {
    const L = K.wg; L.t += dt;
    const k = clamp(L.t / L.dur, 0, 1), e = easeInOut(k);
    K.pos.lerpVectors(L.from, L.to, e);
    K.air = L.leap ? Math.sin(k * Math.PI) * L.h : 0;
    K.yaw = dampAngle(K.yaw, Math.atan2(L.to.x - L.from.x, L.to.z - L.from.z), 14, dt);
    K.vel.copy(L.to).sub(L.from).multiplyScalar(1 / L.dur);
    if (Math.random() < dt * 50) GodFX.spawn({ pos: K.pos.clone().add(V3(rand(-0.5, 0.5), K.air + rand(0.3, 1.2), rand(-0.5, 0.5))), vel: V3(rand(-0.5, 0.5), rand(0, 0.8), rand(-0.5, 0.5)), life: 0.7, size: rand(0.1, 0.18), sizeEnd: 0.02, color: SKC.ice, intensity: 1.5, cell: GX.snow, rotVel: 4 });
    if (k >= 1) { K.wg = null; K.air = 0; K.vel.set(0, 0, 0); wgStorm(K, 'kaldr', L.rank); }
  } else {
    let goal, speedMax;
    if (SK.th && SK.th.t < TH_IMPACT + TH_SHATTER + 0.2) { goal = _v1.copy(P.pos).addScaledVector(fwdOf(P.yaw, _v2), 1.4).addScaledVector(rightOf(P.yaw, _v3), -1.7); speedMax = 8; }
    else if (hunt) { const d = _v2.copy(K.pos).sub(hunt.pos).setY(0); const L = d.length() || 1; goal = _v1.copy(hunt.pos).addScaledVector(d, (hunt.radius + 0.9) / L); speedMax = moveSpeed() * 1.1 * 1.25; }
    else { goal = _v1.copy(P.pos).addScaledVector(fwdOf(P.yaw, _v2), 0.5).addScaledVector(rightOf(P.yaw, _v3), -2.0); speedMax = Math.max(6.5, moveSpeed() * 1.1); }
    const to = _v2.copy(goal).sub(K.pos).setY(0), dist = to.length();
    // the dash attack: he closes the last few metres in one bound
    if (hunt && K.dashCd <= 0 && dist > 2.2 && dist < AB.rh.dash * SU) {
      K.dashCd = AB.rh.dashCd; K.lunge = 1;
      K.pos.addScaledVector(to, Math.max(0, (dist - 1.2) / dist));
      Combat.deal(hunt, basicDamage() * AB.rh.dashPct[rankOf('rh') - 1], 'ability', 'Kaldr', false, true);
      GodFX.shards(hunt.pos.clone().setY(0.9), 6, 0.6); frostBurst(hunt.pos.clone().setY(0.9), 0.55);
      Sound.god('kaldr_bite', { gain: 0.9, pos: hunt.pos });
      K.biteT = 0.5;
    }
    const want = dist > 0.25 ? to.multiplyScalar(Math.min(speedMax, dist * 3.2) / dist) : to.set(0, 0, 0);
    K.vel.lerp(want, 1 - Math.exp(-7 * dt));
    K.pos.addScaledVector(K.vel, dt); resolveCircle(K.pos, 0.5);
    const sp = K.vel.length();
    if (sp > 0.4) K.yaw = dampAngle(K.yaw, Math.atan2(K.vel.x, K.vel.z), 9, dt);
    else if (hunt) K.yaw = dampAngle(K.yaw, Math.atan2(hunt.pos.x - K.pos.x, hunt.pos.z - K.pos.z), 9, dt);
    else K.yaw = dampAngle(K.yaw, P.yaw, 2, dt);
    // bites: half his mistress's attack speed, a share of her basic attack; savage against Piercing Cold's slow
    K.biteT -= dt; K.lunge = Math.max(0, (K.lunge || 0) - dt * 4);
    if (hunt && dist < 1.7 && K.biteT <= 0) {
      K.biteT = 1 / (attackSpeed() * 0.5); K.lunge = 1;
      const pc = hunt.slow > 0 && hunt.pcSlow;
      const dmg = basicDamage() * (pc ? AB.pc.kaldr[rankOf('pc') - 1] : AB.rh.pct[rankOf('rh') - 1]);
      Combat.deal(hunt, dmg, 'ability', 'Kaldr', false, true);
      const hp = hunt.pos.clone().setY(1.0);
      frostBurst(hp, 0.45, { distort: false });
      FX2.slash(hp.clone().setY(1.0), K.yaw + rand(-0.4, 0.4), 'skadi', { r0: 0.2, r1: 0.9, a0: -1.2, a1: 1.2, dur: 0.22, tilt: rand(-0.5, 0.5), roll: Math.PI / 2 });
      GodFX.spawn({ pos: hp, life: 0.22, size: 0.9, sizeEnd: 1.4, color: SKC.frost, intensity: 1.6, cell: GX.claw, rot: rand(0, TAU), alpha: 1, alphaEnd: 0, fadeIn: 0 });
      Sound.god('kaldr_bite', { gain: 0.8, pos: hp });
      if (rankOf('rh') >= 5) { SK.wolfSpeed = 3; }
    }
  }
  const sp = K.vel.length();
  // form: elemental (a spirit of ice) or beast (flesh and fur) while hunting or storming
  K.formT = SK.hunt || K.wg ? 1 : 0;
  K.form = damp(K.form, K.formT, 6, dt);
  K.ghost.alpha = (1 - K.form) * (0.9 + 0.1 * Math.sin(t * 3)); K.beast.alpha = K.form;
  K.ghost.group.visible = K.form < 0.99; K.beast.group.visible = K.form > 0.01;
  K.howlT -= dt;
  if (K.howlT <= 0) { K.howlT = rand(14, 26); if (!hunt && sp < 0.5 && Game.mode === 'play') Sound.god('kaldr_howl', { gain: 0.35, pos: K.pos }); }
  for (const b of [K.ghost, K.beast]) {
    b.group.position.set(K.pos.x, K.air || 0, K.pos.z).addScaledVector(fwdOf(K.yaw, _v3), (K.lunge || 0) * 0.5);
    b.group.rotation.y = K.yaw;
    b.leap = K.wg ? 1 : (K.lunge || 0) * 0.6;
    b.update(dt, K.wg ? 9 : sp, t);
  }
  // frost breath and a cold mist around the elemental
  if (Math.random() < dt * 8 * (1 - K.form * 0.6)) GodFX.spawn({ pos: K.pos.clone().add(V3(rand(-0.6, 0.6), rand(0.2, 1.1), rand(-0.6, 0.6))), vel: V3(rand(-0.2, 0.2), rand(0.1, 0.5), rand(-0.2, 0.2)), life: rand(0.6, 1.1), size: rand(0.06, 0.14), sizeEnd: 0.02, color: SKC.ice, intensity: 1.5, cell: GX.snow, rotVel: rand(-3, 3), drag: 1 });
  // the elemental breathes a cold mist that pours along the ground
  if (Math.random() < dt * 3 * (1 - K.form * 0.5)) FX2.smoke.spawn({ pos: K.pos.clone().add(V3(rand(-0.4, 0.4), rand(0.3, 0.9), rand(-0.4, 0.4))), vel: V3(rand(-0.3, 0.3), rand(-0.1, 0.2), rand(-0.3, 0.3)), life: rand(1.2, 1.8), size: 0.4, sizeEnd: 1.4, frames: 16, pal: 'frost', temp: 0.4, tempEnd: 0, int: 1.2, alpha: 0.4, drag: 0.8, turb: 0.5 });
  if (Math.random() < dt * 10) frostMotes(K.pos.clone().setY(rand(0.4, 1.2)), 1, 0.5);
}

// ---- basic attack: a conjured ice javelin -------------------------------------------------
function makeJavelin(scale = 1) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), GodFX.iceMat); shaft.rotation.x = Math.PI / 2; g.add(shaft);
  const tip = new THREE.Mesh(GodFX.iceGeos[0], GodFX.iceMat); tip.scale.set(0.05, 0.05, 0.22); tip.position.z = 0.62; g.add(tip);
  const core = glowSprite(VFX.dotTex, GCOL.ice, 0.55, 2.4); core.position.z = 0.55; g.add(core);
  g.scale.setScalar(scale); scene.add(g);
  return g;
}
function skadiBasic() {
  if (SK.th) return;
  P.atkCd = 1 / attackSpeed();
  // a three-beat chain of javelin casts from her spear hand: an overhand hurl, a quick flick off the shoulder, then a heavy
  // hurl with the whole body behind it; the conjured javelin leaves her hand at the release
  const A = Game.anim, step = autoStep(A), rel = autoCast(A, step === 1 ? 'flick' : 'hurl', 'R', P.atkCd, { k: step === 2 ? 1.25 : 1 });
  P.atkPenalty = Math.min(0.45, P.atkCd * 0.8);
  VFX.later(rel, () => {
    const origin = autoOrigin(A, 'R'), dir = fwdOf(P.yaw);
    const g = makeJavelin(1);
    const trail = VFX.trail(0.22, GCOL.ice, 2.4, 14);
    Combat.projectiles.push(new Projectile({
      kind: 'basic', pos: origin, dir, speed: 38, radius: 0.32, pierce: false, maxDist: SKADI_STATS.range * SU, glyphRange: 0,
      onMove(p, dt) { g.position.copy(p.pos); g.lookAt(p.pos.clone().add(p.dir)); trail.push(p.pos); FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(38), 'skadi', dt, { k: 1.2, size: 0.8 }); if (Math.random() < dt * 40) GodFX.spawn({ pos: p.pos.clone(), vel: V3(rand(-0.3, 0.3), rand(-0.2, 0.4), rand(-0.3, 0.3)), life: 0.4, size: 0.08, sizeEnd: 0.02, color: GCOL.iceHot, intensity: 2, cell: GX.snow, rotVel: 4 }); },
      onHit(d, hp) {
        Combat.deal(d, basicDamage(), 'basic', 'Ice Javelin', false, true);
        GodFX.shards(hp, 6, 0.6);
        frostBurst(hp, 0.4, { distort: false, bursts: 1 });
      },
      onDie(p, at) { trail.alive = false; GodFX.shards(at, 4, 0.5); disposeGroup(g); },
    }));
    Sound.god(`basic${1 + (SK.atkHand++ % 3)}`, { gain: 0.85 });
    if (Math.random() < 0.08) Sound.voice('eff', { cooldown: 6 });
  });
}

// ---- 1 · Piercing Cold -------------------------------------------------------------------
function castPiercingCold() {
  spend('pc'); startCd('pc');
  Game.anim.play('spear');
  Sound.voice('a1', { chance: 0.55, cooldown: 7 });
  VFX.later(0.16, () => {
    const origin = aimOrigin(), dir = fwdOf(P.yaw), rank = rankOf('pc');
    const g = makeJavelin(2.1);
    const trail = VFX.trail(0.7, GCOL.ice, 3, 22), helix = makeHelix(2, 0.36, 0.12, GCOL.iceHot, 2.6, 18);
    Sound.god('pc_throw', { gain: 1.0 });
    VFX.flash(origin, GCOL.ice, 24, 0.3);
    PostFX.shock(origin.clone().addScaledVector(dir, 1.5), 0.35, 0.4);
    frostBurst(origin, 0.6);
    Combat.projectiles.push(new Projectile({
      kind: 'ability', pos: origin, dir, speed: 34, radius: 0.7, pierce: true, maxDist: AB.pc.range * SU, glyphRange: 0,
      onMove(p, dt) {
        g.position.copy(p.pos); g.lookAt(p.pos.clone().add(p.dir)); g.rotateZ(p.t * 12);
        trail.push(p.pos); helix.push(p.pos, p.dir, p.t);
        if (Math.random() < dt * 70) GodFX.spawn({ pos: p.pos.clone().add(V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), vel: p.dir.clone().multiplyScalar(-rand(1, 4)).add(V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1))), life: rand(0.4, 0.8), size: rand(0.08, 0.18), sizeEnd: 0.02, color: Math.random() < 0.5 ? GCOL.ice : GCOL.iceHot, intensity: 2.2, cell: GX.snow, rotVel: rand(-6, 6), drag: 1.5 });
        FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(34), 'skadi', dt, { k: 2.4, size: 1.5 });
        if (Math.random() < dt * 16) FX2.smoke.spawn({ pos: p.pos.clone(), vel: V3(rand(-0.4, 0.4), rand(-0.2, 0.3), rand(-0.4, 0.4)), life: rand(1.0, 1.5), size: 0.5, sizeEnd: 1.6, frames: 16, pal: 'frost', temp: 0.5, tempEnd: 0, int: 1.2, alpha: 0.5, drag: 1.4, turb: 0.6 });
        p.frostAcc = (p.frostAcc || 0) + p.speed * dt;
        if (p.frostAcc > 2.2) { p.frostAcc = 0; GodFX.decal(p.pos.clone().setY(0), GodFX.sig.frost, GCOL.ice, 2.2, 2.2, { intensity: 1.1, spin: 0 }); }
      },
      onHit(d, hp) {
        Combat.deal(d, AB.pc.dmg[rank - 1] + AB.pc.scale * ppow(), 'ability', 'Piercing Cold', false, true);
        d.slowed(AB.pc.slow[rank - 1], AB.pc.slowDur); d.pcSlow = true; VFX.later(AB.pc.slowDur, () => { d.pcSlow = false; });
        GodFX.shards(hp, 10, 0.9);
        frostBurst(hp, 0.85);
        VFX.flash(hp, GCOL.ice, 22, 0.3);
        Sound.god('pc_hit', { gain: 0.8, pos: hp });
        // frost creeps up the target
        for (let i = 0; i < 10; i++) GodFX.spawn({ pos: d.pos.clone().add(V3(rand(-0.4, 0.4), rand(0.1, d.height), rand(-0.4, 0.4))), vel: V3(0, rand(-0.3, 0.3), 0), life: rand(1, 2), size: rand(0.1, 0.2), sizeEnd: 0.05, color: GCOL.iceHot, intensity: 1.6, cell: GX.snow, rotVel: rand(-2, 2) });
      },
      onDie(p, at) { trail.alive = false; helix.kill(); GodFX.shards(at, 12, 1); frostBurst(at, 0.9); disposeGroup(g); },
    }));
  });
}

// ---- 2 · Rune of the Hunt (toggle) ----------------------------------------------------------
function pickHuntTarget() {
  // the foe under (or nearest to) the reticle, within 70 range
  const o = P.pos, f = fwdOf(P.yaw), R = AB.rh.range * SU;
  let best = null, bs = 1e9;
  for (const d of Combat.dummies) {
    if (!d.alive) continue;
    const rx = d.pos.x - o.x, rz = d.pos.z - o.z, along = rx * f.x + rz * f.z;
    if (along < 0 || along > R) continue;
    const lat = Math.abs(rx * f.z - rz * f.x), score = lat * 3 + along * 0.15 - (d.isGod ? 2 : 0);
    if (lat < AB.rh.reticle * SU + along * 0.06 && score < bs) { bs = score; best = d; }
  }
  return best;
}
function huntMark(target) {
  const rune = GodFX.decal(target.pos, GodFX.sig.norse, SKC.glacier, 2.4, 9999, { spin: 1.4, follow: target.pos, intensity: 1.5 });
  const mark = glowSprite(GodFX.cellTex(GX.rune), SKC.ice, 0.7, 1.9); mark.renderOrder = 12; scene.add(mark);
  return { rune, mark };
}
function startHunt() {
  const target = pickHuntTarget();
  if (!target) { HUD.warn('No prey in sight'); Sound.deny(); return; }
  const m = huntMark(target);
  SK.hunt = { target, ...m };
  kaldrTransform(true);
  Game.anim.play('mark');
  Sound.god('rh_mark', { gain: 0.9 });
  Sound.voice('a2', { chance: 0.7, cooldown: 6 });
  frostBurst(target.pos.clone().setY(target.height + 0.6), 0.6);
  FX2.ring(target.pos, 'skadi', { radius: 2.2, dur: 0.45 });
}
function retargetHunt(d) {
  const H = SK.hunt; if (!H) return;
  H.rune.dead = true; scene.remove(H.mark); H.mark.material.dispose();
  Object.assign(H, { target: d }, huntMark(d));
}
function endHunt(cd = true) {
  const H = SK.hunt; if (!H) return;
  H.rune.dead = true; scene.remove(H.mark); H.mark.material.dispose();
  SK.hunt = null;
  kaldrTransform(false);
  if (cd) startCd('rh');
}
function updateHunt(dt, t) {
  const H = SK.hunt; if (!H || !H.target) return;
  H.mark.position.set(H.target.pos.x, H.target.height + 0.9 + Math.sin(t * 4) * 0.08, H.target.pos.z);
  H.mark.material.rotation = Math.sin(t * 2) * 0.2;
}

// ---- 3 · Permafrost ---------------------------------------------------------------------
// a sheet of ice: the first touch hurts, then it bites every half second; enemies lose control
// and slide on with their momentum (bouncing off obstacles); Skadi skates faster and shrugs off slows
function castPermafrost() {
  spend('pf'); startCd('pf');
  const c = groundTarget(AB.pf.range * SU, 2.5), rank = rankOf('pf'), R = AB.pf.radius[rank - 1] * SU;
  Game.anim.play('frost');
  Sound.voice('a3', { chance: 0.55, cooldown: 7 });
  VFX.later(0.3, () => {
    Sound.god('pf_cast', { gain: 1.0, pos: c });
    const sheet = GodFX.decal(c, GodFX.sig.frost, SKC.ice, R * 2.1, AB.pf.dur, { intensity: 0.9, grow: 0.08 });
    const glaze = GodFX.decal(c, VFX.dotTex, SKC.deep, R * 2.3, AB.pf.dur, { intensity: 0.7 });
    const sigil = GodFX.decal(c, GodFX.sig.norse, SKC.glacier, R * 1.5, AB.pf.dur, { intensity: 0.6, spin: 0.25 });
    VFX.cracks(c, R * 0.9, AB.pf.dur, { grow: 0.25, intensity: 1.0, color: SKC.ice });
    FX2.ring(c, 'skadi', { radius: R + 1.5, dur: 0.5 });
    FX2.mist(c, 'frost', { radius: R * 0.95, rate: 16, dur: AB.pf.dur - 0.4, glow: 0.35, alpha: 0.5, size: 0.9, rise: 0.25, height: 0.5 });
    frostBurst(c.clone().setY(0.5), 0.9);
    GodFX.iceSpikes(c, R * 0.9, R * 1.08, 16, { height: 0.5, sweep: 0.2, life: AB.pf.dur - 0.3 });
    GodFX.shards(c.clone().setY(0.3), 14, 1);
    const loop = Sound.god('pf_loop', { gain: 0.45, pos: c, loop: true });
    const touched = new Set();
    GodFX.add({ update(dt) {
      this.tick = (this.tick || 0) + dt;
      const tickNow = this.tick >= 0.5; if (tickNow) this.tick -= 0.5;
      for (const d of dummiesNear(c, R)) {
        if (!touched.has(d)) { touched.add(d); Combat.deal(d, AB.pf.dmg[rank - 1] + AB.pf.scale * ppow(), 'ability', 'Permafrost', false, true); GodFX.shards(d.pos.clone().setY(0.4), 5, 0.5); }
        else if (tickNow) Combat.deal(d, AB.pf.tick[rank - 1] + AB.pf.tickScale * ppow(), 'dot', 'Permafrost', false, true);
        d.slowed(AB.pf.slow, 0.4);
        // they slide: keep going the way they were moving (or outward), and bounce off what they hit
        if (!d.cc && d.slideV.lengthSq() < 1) { const away = _v1.set(d.pos.x - c.x, 0, d.pos.z - c.z); const l = away.length() || 1; d.slideAlong(away.multiplyScalar(2.2 / l).add(_v2.copy(d.velocity).setY(0).multiplyScalar(0.9)), 2.6); }
        if (Math.random() < dt * 4) GodFX.spawn({ pos: d.pos.clone().add(V3(rand(-0.4, 0.4), 0.15, rand(-0.4, 0.4))), vel: V3(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)), life: 0.6, size: 0.14, sizeEnd: 0.02, color: SKC.frost, intensity: 1.5, cell: GX.snow, rotVel: 4 });
      }
      if (Math.random() < dt * 20) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R; GodFX.spawn({ pos: V3(c.x + Math.cos(a) * r, 0.08, c.z + Math.sin(a) * r), vel: V3(0, rand(0.2, 0.7), 0), life: rand(0.8, 1.4), size: rand(0.08, 0.15), sizeEnd: 0.02, color: SKC.ice, intensity: 1.3, cell: GX.snow, rotVel: rand(-2, 2) }); }
      if (Math.random() < dt * 14) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R; frostMotes(V3(c.x + Math.cos(a) * r, 0.15, c.z + Math.sin(a) * r), 1, 0.1); }
      // Skadi skates: faster on her own ice, and for 3 s after she leaves it
      if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < R) { SK.onIce = true; SK.iceT = 3; SK.iceRank = rank; }
      if (this.t >= AB.pf.dur) { if (loop) loop.stop(0.4); glaze.dead = true; return false; }
      return true;
    } });
  });
}

// ---- 4 · Winter's Grasp (SMITE 1, since 2019) ---------------------------------------------
// aim a circle: a blizzard erupts around Skadi at once; Kaldr - restored - bounds there (leaping if
// it is far) and a second blizzard erupts around him when he lands. The first hit of each storm
// roots everyone inside; then each storm follows its owner and ticks every 0.5 s for 4 s.
function wgStorm(owner, who, rank) {
  const R = AB.wg.radius * SU;
  const follow = who === 'skadi' ? P.pos : owner.pos;
  const S = { t: 0, follow, R, rank, who, ticks: 0 };
  // the storm lives on the ground - frost sigils, drifting snow and a calm snowfall - so the view stays clear
  S.ring = GodFX.decal(follow, GodFX.sig.frost, SKC.ice, R * 2.2, AB.wg.dur + 0.3, { intensity: 0.8, follow, spin: 0.4 });
  S.rune = GodFX.decal(follow, GodFX.sig.norse, SKC.glacier, R * 2, AB.wg.dur + 0.3, { intensity: 0.55, follow, spin: -0.6 });
  S.loop = Sound.god('wg_loop', { gain: who === 'skadi' ? 0.7 : 0.55, loop: true, pos: who === 'skadi' ? null : follow });
  // the first hit: damage and a root, ice clamping the feet
  const c = _v1.copy(follow).setY(0).clone();
  FX2.ring(c, 'skadi', { radius: R + 1, dur: 0.5, width: 0.07 });
  frostBurst(c.clone().setY(1.0), 1.1);
  // drifting snow hugging the ground and a calm, steady snowfall inside the storm - nothing between the camera and the fight
  S.mist = FX2.mist(follow, 'frost', { radius: R, rate: 12, dur: AB.wg.dur, glow: 0.3, alpha: 0.42, size: 0.9, rise: 0.15, height: 0.35 });
  S.snow = FX2.rain(follow, 'snow', { radius: R * 0.95, dur: AB.wg.dur, rate: 45, fall: 0.45 });
  GodFX.shards(c.clone().setY(0.5), 16, 1.1);
  for (const d of dummiesNear(c, R)) {
    Combat.deal(d, AB.wg.dmg[rank - 1] + AB.wg.scale * ppow(), 'ult', "Winter's Grasp", false, true);
    const root = AB.wg.root[rank - 1];
    d.rooted(root); GodFX.status(d, 'root'); frostBurst(d.pos.clone().setY(0.4), 0.45, { distort: false, bursts: 1 });
    GodFX.iceSpikes(d.pos, 0.35, 0.75, 7, { height: 0.32, sweep: 0.05, life: root });
    Sound.god('wg_root', { gain: 0.6, pos: d.pos });
  }
  SK.storms.push(S);
  return S;
}
function blizzardMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uSpeed: { value: 2.4 }, uC1: { value: SKC.snow.clone() }, uC2: { value: SKC.glacier.clone() } },
    vertexShader: 'varying vec2 vUv; varying float vDepth; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform float uTime, uAlpha, uSpeed; uniform vec3 uC1, uC2; varying vec2 vUv; varying float vDepth;
      void main() {
        vec2 q = vec2(vUv.x * 14.0 + uTime * uSpeed + vUv.y * 3.0, vUv.y * 3.0 - uTime * 0.6);
        float n = gfbm(q), m = gfbm(q * 2.7 + 3.1);
        float streak = smoothstep(0.45, 0.85, n) * 0.8 + smoothstep(0.55, 0.9, m) * 0.5;
        float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float a = streak * edge * uAlpha * smoothstep(0.5, 3.0, vDepth);
        vec3 c = mix(uC2, uC1, smoothstep(0.3, 1.0, streak));
        gl_FragColor = vec4(c, a * 0.62);
      }`,
  });
}
function castWintersGrasp() {
  spend('wg'); startCd('wg');
  const rank = rankOf('wg'), to = groundTarget(AB.wg.range * SU, 2);
  P.targeting = null;
  Game.anim.play('storm');
  Sound.god('wg_start', { gain: 1.0 });
  Sound.god('sonic_boom', { gain: 0.45, shared: true });
  VFX.later(0.35, () => Sound.voice('ult_scream', { priority: 4, gain: 1.1, cooldown: 0, hold: 1.95 }));
  VFX.later(2.45, () => Sound.voice('ult', { priority: 3, gain: 1.05, cooldown: 0, chance: 0.65 }));
  Sound.duckMusic(0.4, 3.5, 1.5);
  Game.hitStop(0.05, 0.25);
  Cam.shake = Math.max(Cam.shake, 0.45); Cam.fovKick = 5;
  PostFX.shock(P.pos.clone().setY(1.2), 0.7, 0.55);
  FX2.distort.ring(P.pos.clone().setY(1.2), 14, 0.02, 0.5);
  WORLD.dim = 0.62; GodFX.tint(new THREE.Color(0.2, 0.42, 1.0), 0.45); SK.wgOn = true;
  wgStorm(null, 'skadi', rank);
  // Kaldr, restored, bounds to the circle
  const K = SK.kaldr;
  if (K) {
    const from = K.pos.clone(), dist = from.distanceTo(_v1.copy(to).setY(0));
    const leap = dist > 6;
    K.wg = { from, to: to.clone().setY(0), t: 0, dur: leap ? clamp(dist / 16, 0.45, 0.85) : Math.max(0.2, dist / 10), leap, h: Math.min(4.5, dist * 0.28), rank };
    Sound.god('kaldr_leap', { gain: 0.9, pos: from });
    VFX.later(K.wg.dur, () => Sound.god('wg_land', { gain: 1.0, pos: to }));
  }
}
function updateWintersGrasp(dt, t) {
  for (const S of SK.storms) {
    S.t += dt;
    const k = S.t / AB.wg.dur, a = smoothstep(0, 0.12, k) * (1 - smoothstep(0.85, 1, k));
    const f = S.follow;
    // ticks every 0.5 s
    while (S.ticks < 8 && S.t >= (S.ticks + 1) * 0.5) {
      S.ticks++;
      for (const d of dummiesNear(f, S.R)) Combat.deal(d, AB.wg.tick[S.rank - 1] + AB.wg.tickScale * ppow(), 'dot', "Winter's Grasp", false, true);
    }
    // the blizzard: heavy flakes settling over the circle and a low drift of powder - calm, no whirlwind
    const n = Math.round(dt * 70 * a + Math.random() * 0.7);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), r = Math.sqrt(Math.random()) * S.R;
      GodFX.spawn({ pos: V3(f.x + Math.cos(ang) * r, rand(1.5, 4.5), f.z + Math.sin(ang) * r), vel: V3(rand(-0.5, 0.5) + 0.6, rand(-1.8, -0.9), rand(-0.5, 0.5)), life: rand(1.6, 2.4), size: rand(0.06, 0.15), sizeEnd: 0.03, color: Math.random() < 0.4 ? SKC.ice : SKC.snow, intensity: 1.3, cell: GX.snow, rotVel: rand(-4, 4), drag: 0.6 });
    }
    if (Math.random() < dt * 16 * a) { const ang = rand(0, TAU), r = rand(0.5, S.R); FX2.smoke.spawn({ pos: V3(f.x + Math.cos(ang) * r, 0.3, f.z + Math.sin(ang) * r), vel: V3(-Math.sin(ang) * 0.6, rand(0.05, 0.25), Math.cos(ang) * 0.6), life: rand(1.4, 2.0), size: rand(0.8, 1.3), sizeEnd: 2.6, frames: 16, pal: 'snow', temp: 0.25, tempEnd: 0, int: 1.1, alpha: 0.4, drag: 1, turb: 0.5 }); }
  }
  SK.storms = SK.storms.filter((S) => {
    if (S.t < AB.wg.dur) return true;

    if (S.vortex) S.vortex.dead = true; if (S.mist) S.mist.dead = true; if (S.snow) S.snow.dead = true;
    if (S.loop) S.loop.stop(0.8);
    return false;
  });
  if (SK.wgOn && !SK.storms.length && !(SK.kaldr && SK.kaldr.wg)) { SK.wgOn = false; if (!SK.th) { WORLD.dim = 1; GodFX.tint(SKC.ice, 0); } }
}

// ---- 5 · HOWL OF THRYMHEIM (playroom finale) ------------------------------------------------
// Thrymheim, Skadi's hall in the mountains where the wolves howl (the din Njord could not bear).
// She plants her spear: glacier peaks tear up out of the far end of the hall, the wolves of
// Thrymheim howl from the ridge, and an avalanche - the pack running at its front - thunders down
// the hall toward her. Every foe in its path is swept up and carried; at her spear it slams to a
// halt and buries them. The wolves feed on the buried, then the snow tombs shatter.
const TH_PEAK_MAT = () => GodFX.peakMat || (GodFX.peakMat = new THREE.MeshStandardMaterial({ color: 0x6e9ad6, roughness: 0.5, metalness: 0.0, flatShading: true, emissive: new THREE.Color(0.03, 0.13, 0.42), emissiveIntensity: 1 }));
function avalancheMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uC1: { value: new THREE.Color(0.56, 0.7, 0.96) }, uC2: { value: new THREE.Color(0.05, 0.14, 0.46) } },
    vertexShader: _noiseGLSL + /* glsl */`
      uniform float uTime; varying vec2 vUv; varying float vH;
      void main() { vUv = uv; vec3 p = position;
        float n = gfbm(vec2(uv.x * 6.0, uTime * 1.8)); p.z += (n - 0.5) * 2.6 * uv.y; p.y *= 0.8 + 0.45 * n;
        vH = p.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform float uTime, uAlpha; uniform vec3 uC1, uC2; varying vec2 vUv; varying float vH;
      void main() {
        vec2 q = vec2(vUv.x * 9.0, vUv.y * 4.0 - uTime * 3.2);
        float n = gfbm(q) * 0.7 + gfbm(q * 2.3 + 7.0) * 0.3;
        float body = smoothstep(1.0, 0.25, vUv.y + n * 0.35) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        vec3 c = mix(uC2, uC1, smoothstep(0.2, 0.9, n + (1.0 - vUv.y) * 0.3));
        gl_FragColor = vec4(c, body * uAlpha * (0.75 + 0.25 * n));
      }`,
  });
}
function castThrymheim() {
  spend('th'); startCd('th');
  P.targeting = null;
  const yaw = P.yaw, f = fwdOf(yaw), r = rightOf(yaw), o = P.pos.clone().setY(0);
  // the far end of the hall (stop short of walls)
  let L = AB.th.length;
  const blk = segmentBlocked(o.x, o.z, o.x + f.x * L, o.z + f.z * L); if (blk < 1) L = Math.max(14, L * blk - 2);
  const W = AB.th.width;
  const T = { t: 0, yaw, f: f.clone(), r: r.clone(), o, L, W, peaks: [], wolves: [], boulders: [], swept: new Map(), buried: [], fired: false, halted: false, front: L };
  SK.th = T;
  Game.anim.play('fimbul');
  Cam.frameTarget = 1;
  WORLD.dim = 0.4; GodFX.tint(new THREE.Color(0.1, 0.32, 0.9), 0.8); PostFX.vigTarget = 0.6;
  Sound.god('th_call', { gain: 1.0 });
  VFX.later(0.2, () => Sound.god('th_mountain', { gain: 1.0 }));
  VFX.later(1.0, () => Sound.god('th_howl', { gain: 0.95 }));
  VFX.later(1.4, () => Sound.god('th_avalanche', { gain: 1.1 }));
  Sound.voice('fin_charge', { priority: 5, gain: 1.15, cooldown: 0, hold: 3.1 });   // "Thrymheim. Wake. Your daughter calls."
  VFX.later(TH_IMPACT + TH_SHATTER - 1.86, () => Sound.voice('fin_roar', { priority: 6, gain: 1.2, cooldown: 0, hold: 2.7 }));   // "Let the mountain... FALL!" - on the shatter
  Sound.duckMusic(0.25, 4.6, 2.2);
  T.aurora = GodFX.aurora(o.clone().addScaledVector(f, L * 0.6), 6.4);
  T.spearRing = GodFX.decal(o.clone().addScaledVector(f, 1.2), GodFX.sig.norse, SKC.glacier, 3.2, 9999, { spin: 0.8, intensity: 1.0 }); T.spearRing.hold = () => (T.fade ?? 1);
  // the path of the avalanche, frosting over ahead of it
  T.path = GodFX.decal(o.clone().addScaledVector(f, L * 0.5), GodFX.sig.frost, SKC.glacier, 1, 9999, { intensity: 0.8 }); T.path.scaleXY = [W * 1.1, L]; T.path.m.rotation.z = yaw;
  T.path.hold = () => smoothstep(0.2, 1.4, T.t) * (T.fade ?? 1) * 0.8;
  frostBurst(o.clone().addScaledVector(f, 1.2).setY(0.6), 0.9);
  FX2.ring(o.clone().addScaledVector(f, 1.2), 'skadi', { radius: 4, dur: 0.5 });
  GodFX.shards(o.clone().addScaledVector(f, 1.2).setY(0.3), 10, 0.8);
  // Thrymheim rises: real mountains of dark rock, snow and blue glacier ice tear up across the far end
  const spire = Assets.glb.peak_spire, cluster = Assets.glb.peak_cluster;
  const layout = [[0, 5, 'cluster', 11], [-0.55, 2.5, 'spire', 16], [0.6, 3, 'spire', 14], [-1.05, 7, 'cluster', 10], [1.05, 7, 'cluster', 9.5], [-0.25, 11, 'spire', 21], [0.3, 12, 'spire', 19], [0, 16, 'cluster', 14]];
  for (const [lf, al, kind, h0] of layout) {
    const src = kind === 'spire' ? spire : cluster, h = h0 * rand(0.92, 1.08);
    const lat = lf * W * 0.9 + rand(-0.6, 0.6), along = L + al + rand(-0.5, 0.5);
    let m;
    if (src) {
      m = src.scene.clone(true); m.scale.setScalar(h / (kind === 'spire' ? 0.98 : 0.58)); m.rotation.y = rand(0, TAU);
      m.traverse((q) => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; q.frustumCulled = false; } });
    } else { m = new THREE.Mesh(GodFX.iceGeos[1], TH_PEAK_MAT()); m.scale.set(h * 0.4, h, h * 0.4); m.castShadow = true; }
    const pos = o.clone().addScaledVector(f, along).addScaledVector(r, lat); m.position.copy(pos).setY(-h); scene.add(m);
    T.peaks.push({ m, h, pos, wide: kind === 'cluster' ? h * 0.85 : h * 0.35, delay: 0.12 + Math.abs(lf) * 0.25 + al * 0.02 + rand(0, 0.1) });
  }
  // the wolves of Thrymheim gather on the ridge
  for (let i = 0; i < 7; i++) {
    const lat = lerp(-W * 0.42, W * 0.42, i / 6) + rand(-0.5, 0.5);
    const w = new SpectralBeast('wolf', { style: 'ghost', size: rand(2.1, 2.5), color: new THREE.Color(0.12, 0.48, 1.0), rim: new THREE.Color(0.5, 0.9, 1.0), eyes: new THREE.Color(0.35, 1.0, 0.9), tex: 0.55 });
    w.alpha = 0; w.lat = lat; w.lag = rand(0.2, 1.0); w.yawOff = rand(-0.1, 0.1);
    T.wolves.push(w);
  }
}
function updateThrymheim(dt, t) {
  const T = SK.th; if (!T) return;
  T.t += dt;
  const f = T.f, r = T.r, o = T.o, L = T.L, W = T.W;
  // peaks rise
  for (const pk of T.peaks) {
    const k = clamp((T.t - pk.delay) / 1.1, 0, 1);
    pk.m.position.y = lerp(-pk.h, -pk.h * 0.06, easeOutCubic(k)) - (T.t > TH_IMPACT + TH_SHATTER + 0.6 ? (T.t - TH_IMPACT - TH_SHATTER - 0.6) * pk.h * 0.9 : 0);
    pk.m.position.x = pk.pos.x + (k > 0 && k < 1 ? Math.sin(T.t * 60 + pk.delay * 9) * 0.06 : 0);   // the ground shudders as it tears up
    if (k > 0 && k < 1) {
      // powder snow and ice boil up around the base; chunks of ice and rock tumble off its flanks
      if (Math.random() < dt * 22) { const a = rand(0, TAU), rr = pk.wide * rand(0.5, 1.0); FX2.smoke.spawn({ pos: pk.pos.clone().add(V3(Math.cos(a) * rr, rand(0.2, 1.2), Math.sin(a) * rr)), vel: V3(Math.cos(a) * rand(1, 3), rand(1.5, 4), Math.sin(a) * rand(1, 3)), life: rand(1.4, 2.2), size: rand(2, 3.2), sizeEnd: rand(5, 7), frames: 16, pal: 'snow', temp: 0.12, tempEnd: 0, int: 1, alpha: 0.7, drag: 1.1, turb: 0.5, fadeIn: 0.1 }); }
      if (Math.random() < dt * 10) FX2.rocks.spawn({ pos: pk.pos.clone().add(V3(rand(-pk.wide, pk.wide) * 0.5, pk.m.position.y + pk.h * rand(0.5, 0.95), rand(-pk.wide, pk.wide) * 0.5)), vel: V3(rand(-3, 3), rand(0, 3), rand(-3, 3)), size: rand(0.3, 0.8), color: Math.random() < 0.5 ? SKC.frost : new THREE.Color(0.32, 0.34, 0.38), life: rand(1.6, 2.4) });
    }
  }
  if (T.t < 1.4) Cam.shake = Math.max(Cam.shake, 0.12 + 0.18 * smoothstep(0.2, 1.2, T.t));
  // the avalanche front: from the ridge (1.4 s) to her spear (2.6 s)
  const ak = clamp((T.t - 1.4) / (TH_IMPACT - 1.4), 0, 1);
  T.front = lerp(L - 1.5, 2.4, easeInCubic(ak) * 0.35 + ak * 0.65);
  if (T.t >= 1.4 && !T.wall) {
    const mat = avalancheMaterial();
    const geo = new THREE.PlaneGeometry(W * 1.3, 9.5, 64, 14); geo.translate(0, 4.75, 0);
    T.wall = new THREE.Mesh(geo, mat); T.wall.renderOrder = 7; T.wall.frustumCulled = false; scene.add(T.wall);
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(GodFX.iceGeos[i % 3], GodFX.iceMat); const sc = rand(0.5, 1.2); m.scale.setScalar(sc); m.castShadow = true; scene.add(m); T.boulders.push({ m, lat: rand(-W * 0.5, W * 0.5), ph: rand(0, TAU), sc, spin: V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)) }); }
  }
  if (T.wall) {
    const wp = _v1.copy(o).addScaledVector(f, T.front);
    T.wall.position.copy(wp); T.wall.rotation.y = T.yaw;
    const a = T.halted ? Math.max(0, 1 - (T.t - TH_IMPACT) / 0.5) : smoothstep(1.4, 1.7, T.t);
    T.wall.material.uniforms.uAlpha.value = a; T.wall.material.uniforms.uTime.value = t;
    // a churning cloud of powder at the front and a spray off the top
    if (!T.halted) {
      const n = Math.round(dt * 170 + Math.random());
      for (let i = 0; i < n; i++) {
        const lat = rand(-W * 0.62, W * 0.62), p = wp.clone().addScaledVector(r, lat).addScaledVector(f, rand(-0.5, 1.5)).setY(rand(0.2, 4.5));
        FX2.smoke.spawn({ pos: p, vel: f.clone().multiplyScalar(-rand(8, 16)).add(V3(rand(-1, 1), rand(0.5, 5), rand(-1, 1))), life: rand(0.7, 1.3), size: rand(2.0, 3.4), sizeEnd: rand(4.5, 6), frames: 16, pal: 'snow', temp: 0.2, tempEnd: 0, int: 1, alpha: 0.7, drag: 1.5, turb: 0.6, fadeIn: 0.04 });
      }
      if (Math.random() < dt * 30) FX2.rocks.spawn({ pos: wp.clone().addScaledVector(r, rand(-W * 0.55, W * 0.55)).setY(rand(0.5, 2.5)), vel: f.clone().multiplyScalar(-rand(9, 15)).add(V3(rand(-1, 1), rand(3, 7), rand(-1, 1))), size: rand(0.2, 0.55), color: Math.random() < 0.6 ? SKC.frost : new THREE.Color(0.3, 0.32, 0.36), life: rand(1.0, 1.6) });
      if (Math.random() < dt * 90) GodFX.spawn({ pos: wp.clone().addScaledVector(r, rand(-W * 0.6, W * 0.6)).setY(rand(1, 6)), vel: f.clone().multiplyScalar(-rand(10, 18)).add(V3(0, rand(1, 4), 0)), life: rand(0.5, 1.0), size: rand(0.1, 0.22), sizeEnd: 0.03, color: SKC.frost, intensity: 1.3, cell: GX.snow, rotVel: rand(-6, 6), drag: 1 });
      Cam.shake = Math.max(Cam.shake, 0.15 + 0.5 * ak);
    }
    for (const b of T.boulders) {
      const bp = _v2.copy(o).addScaledVector(f, T.front - 1.2 - Math.abs(Math.sin(T.t * 3 + b.ph)) * 1.5).addScaledVector(r, b.lat);
      bp.y = 0.4 + Math.abs(Math.sin(T.t * 6 + b.ph)) * 2.2 * b.sc;
      b.m.position.copy(bp); b.m.rotation.x += b.spin.x * dt; b.m.rotation.y += b.spin.y * dt; b.m.rotation.z += b.spin.z * dt;
      b.m.visible = !T.halted || T.t < TH_IMPACT + 0.1;
    }
    // everything in its path is swept up and carried along at the front
    if (!T.halted) {
      for (const d of Combat.dummies) {
        if (!d.alive || T.swept.has(d)) continue;
        const rx = d.pos.x - o.x, rz = d.pos.z - o.z, along = rx * f.x + rz * f.z, lat = rx * r.x + rz * r.z;
        if (Math.abs(lat) < W * 0.55 + d.radius && along > 1.5 && along >= T.front - 0.6 && along <= L + 2) {
          T.swept.set(d, { lat, off: rand(-0.4, 0.4) });
          d.carried = true; d.applyStun(TH_IMPACT - T.t + TH_SHATTER + 0.4);
          Combat.deal(d, thDmg('sweep'), 'final', 'Howl of Thrymheim', false, true);
        }
      }
      for (const [d, s] of T.swept) {
        if (!d.alive) continue;
        const p = _v3.copy(o).addScaledVector(f, Math.max(6.2, T.front - 0.8 + s.off)).addScaledVector(r, s.lat * 0.75);
        d.placeAt(p, 6); d.lift = 0.6 + Math.abs(Math.sin(T.t * 7 + s.off * 5)) * 0.7;
      }
    }
  }
  // the pack: on the ridge, then running at the front of the avalanche
  T.wolves.forEach((w, i) => {
    const run = T.t >= 1.4 + w.lag * 0.25;
    const along = run && !T.halted ? T.front + 1.2 + Math.sin(T.t * 5 + i) * 0.3 : T.halted ? Math.max(T.front + 1.2, 3) : L - 0.5;
    const pos = _v2.copy(o).addScaledVector(f, along).addScaledVector(r, w.lat);
    w.group.position.copy(pos); w.group.rotation.y = T.yaw + Math.PI + w.yawOff;
    w.alpha = smoothstep(0.8 + w.lag * 0.3, 1.3 + w.lag * 0.3, T.t) * (1 - smoothstep(TH_IMPACT + TH_SHATTER + 0.2, TH_IMPACT + TH_SHATTER + 0.8, T.t)) * 0.95;
    w.leap = T.halted ? 0 : run ? 0.25 : -0.2;
    if (!w.bite) w.update(dt, run && !T.halted ? 22 : 0.5, t);
  });
  // the halt
  if (!T.halted && T.t >= TH_IMPACT) thrymheimHalt(T);
  if (T.halted) {
    // the wolves fall on the buried
    T.buried.forEach((b, i) => {
      const w = T.wolves[i % T.wolves.length], tb = TH_IMPACT + 0.4 + i * 0.1;
      if (T.t >= tb && !b.bitten && w) {
        const k = clamp((T.t - tb) / 0.35, 0, 1);
        if (!w.bite) w.bite = { from: w.group.position.clone() };
        const p = _v1.lerpVectors(w.bite.from, b.d.pos, easeInOut(k)); p.y = Math.sin(k * Math.PI) * 1.6;
        w.group.position.copy(p); w.group.rotation.y = Math.atan2(b.d.pos.x - w.bite.from.x, b.d.pos.z - w.bite.from.z); w.leap = 1; w.update(dt, 8, t);
        if (k >= 1) { b.bitten = true; w.bite = null; if (b.d.alive) Combat.deal(b.d, thDmg('bite'), 'final', 'Úlfr', false, true); Sound.god('th_bite', { gain: 0.8, pos: b.d.pos }); GodFX.shards(b.d.pos.clone().setY(0.8), 8, 0.7); }
      }
    });
    // the snow tombs shatter
    if (!T.shattered && T.t >= TH_IMPACT + TH_SHATTER) {
      T.shattered = true;
      Sound.god('th_shatter', { gain: 1.05 });
      Game.hitStop(0.08, 0.12); Cam.shake = Math.max(Cam.shake, 0.8);
      let kills = 0;
      for (const b of T.buried) {
        scene.remove(b.mound); b.d.carried = false; b.d.lift = 0;
        const p = b.d.pos.clone().setY(0.9);
        GodFX.shards(p, 20, 1.3); VFX.flash(p, SKC.glacier, 20, 0.35);
        frostBurst(p, 1.0);
        FX2.debris(p, SKC.frost, 10, 1.0);
        for (let i = 0; i < 10; i++) FX2.smoke.spawn({ pos: p.clone().add(V3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5))), vel: V3(rand(-4, 4), rand(1, 5), rand(-4, 4)), life: rand(0.9, 1.5), size: rand(0.8, 1.4), sizeEnd: 2.8, frames: 16, pal: 'snow', temp: 0.3, tempEnd: 0, int: 1.1, alpha: 0.75, drag: 2, turb: 0.5 });
        if (b.d.alive) { Combat.deal(b.d, thDmg('shatter'), 'final', 'Howl of Thrymheim', false, true); if (!b.d.alive) kills++; }
      }
      if (kills >= 2) VFX.later(1.0, () => Sound.voice('fin_line', { priority: 3, cooldown: 20 }));
    }
    T.fade = 1 - smoothstep(TH_IMPACT + TH_SHATTER + 0.4, TH_IMPACT + TH_SHATTER + 1.8, T.t);
    if (T.t > TH_IMPACT + TH_SHATTER + 0.4) { Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(SKC.ice, 0); PostFX.vigTarget = 0; WORLD.dim = 1; }
    if (T.t > TH_IMPACT + TH_SHATTER + 2.0) thrymheimCleanup(T);
  }
  if (SK.th && T.t < TH_IMPACT + TH_SHATTER + 0.4) { Cam.focus = Cam.focus || new THREE.Vector3(); Cam.focus.copy(o).addScaledVector(f, 9); }
}
function thrymheimHalt(T) {
  T.halted = true;
  const f = T.f, o = T.o, at = o.clone().addScaledVector(f, 2.6);
  Game.hitStop(0.14, 0.08);
  Cam.shake = 1.25; Cam.fovKick = 10;
  PostFX.shock(at.clone().setY(1.5), 1.2, 0.9); PostFX.aberr = 0.007;
  VFX.flash(at.clone().setY(1.6), SKC.glacier, 26, 0.6);
  FX2.ring(at, 'skadi', { radius: 9, dur: 0.55, width: 0.07 });
  VFX.later(0.12, () => FX2.ring(at, 'snow', { radius: 15, dur: 0.8, width: 0.05 }));
  FX2.distort.ring(at.clone().setY(1.5), 26, 0.028, 0.6);
  frostBurst(at.clone().setY(1.4), 1.6, { bursts: 2 });
  FX2.debris(at.clone().setY(0.6), SKC.frost, 30, 1.6, FX2.pal('skadi'));
  // the snow explodes up and out off her spear
  for (let i = 0; i < 46; i++) { const lat = rand(-T.W * 0.7, T.W * 0.7), p = at.clone().addScaledVector(f, rand(3, 7)).addScaledVector(T.r, lat).setY(rand(0.3, 3)); FX2.smoke.spawn({ pos: p, vel: f.clone().multiplyScalar(rand(0, 3)).add(V3(rand(-4, 4), rand(5, 13), rand(-4, 4))).addScaledVector(T.r, Math.sign(lat) * rand(2, 9)), life: rand(1.1, 1.8), size: rand(1.4, 2.4), sizeEnd: rand(3.8, 5), frames: 16, pal: 'snow', temp: 0.3, tempEnd: 0, int: 1, alpha: 0.6, drag: 1.6, gravity: -2, turb: 0.5 }); }
  for (let i = 0; i < 60; i++) GodFX.spawn({ pos: at.clone().addScaledVector(T.r, rand(-T.W * 0.6, T.W * 0.6)).setY(rand(0.5, 3)), vel: V3(rand(-8, 8), rand(3, 12), rand(-8, 8)), life: rand(0.5, 1.1), size: rand(0.15, 0.32), sizeEnd: 0.04, color: SKC.ice, intensity: 1.6, cell: GX.shard, rotVel: rand(-8, 8), gravity: -12, drag: 0.4 });
  // the swept are buried in snow tombs before her
  const moundMat = TH_PEAK_MAT();
  let i = 0;
  for (const [d, s] of T.swept) {
    if (!d.alive) continue;
    const p = o.clone().addScaledVector(f, 6.5 + (i % 3) * 2.2 + Math.floor(i / 3) * 0.6).addScaledVector(T.r, clamp(s.lat * 0.55, -T.W * 0.36, T.W * 0.36));
    d.placeAt(p, 10); d.lift = 0; d.applyStun(1.6);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), moundMat);
    mound.scale.set(d.radius * 1.9, (d.height || 1.8) * 0.72, d.radius * 1.9); mound.position.copy(p).setY(0); mound.castShadow = true; scene.add(mound);
    T.buried.push({ d, mound }); i++;
  }
}
function thrymheimCleanup(T) {
  if (SK.th !== T) return;
  for (const pk of T.peaks) scene.remove(pk.m);
  for (const w of T.wolves) w.dispose();
  for (const b of T.boulders) scene.remove(b.m);
  for (const b of T.buried) { scene.remove(b.mound); b.mound.geometry.dispose(); if (b.d.alive) { b.d.carried = false; b.d.lift = 0; } }
  for (const [d] of T.swept) if (d.alive) { d.carried = false; d.lift = 0; }
  if (T.wall) { scene.remove(T.wall); T.wall.geometry.dispose(); T.wall.material.dispose(); }
  T.spearRing.dead = true; T.path.dead = true;
  Cam.frameTarget = 0; Cam.focus = null; WORLD.dim = 1; GodFX.tint(SKC.ice, 0); PostFX.vigTarget = 0;
  SK.th = null;
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const SKADI_INFO = {
  passive: { name: 'Kaldr, the Winter Wolf', kind: 'Passive · Companion',
    text: 'Skadi never hunts alone. The winter wolf Kaldr follows her in elemental form – an invulnerable spirit of ice. With Rune of the Hunt he takes Beast form and hunts: he attacks at half her attack speed, and against targets slowed by Piercing Cold his bites deal much more damage.',
    rows: () => [['Form', SK.hunt || (SK.kaldr && SK.kaldr.wg) ? 'Beast (hunting)' : 'Elemental'], ['Bite', `${Math.round(AB.rh.pct[rankOf('rh') - 1] * 100)}% of basic`], ['Vs. Piercing Cold', `${Math.round(AB.pc.kaldr[rankOf('pc') - 1] * 100)}% of basic`]] },
  pc: { name: 'Piercing Cold', kind: 'Line · Slow · Physical',
    text: 'Skadi hurls an ice spear that passes through all enemies in a straight line, damaging them and slowing them for 3 seconds. Kaldr\'s attacks against targets slowed by Piercing Cold deal 100–160% of Skadi\'s basic attack damage.',
    rows: () => { const r = rankOf('pc'); return [['Damage', `${AB.pc.dmg[r - 1]} (+80% of ${ppow()} PP) = ${Math.round(AB.pc.dmg[r - 1] + 0.8 * ppow())}`], ['Slow', `${Math.round(AB.pc.slow[r - 1] * 100)}% for 3 s`], ['Range', '55'], ['Cost', `${costOf('pc')} mana`], ['Cooldown', `${cdOf('pc').toFixed(1)} s`]]; } },
  rh: { name: 'Rune of the Hunt', kind: 'Toggle · Mark · Physical',
    text: 'Skadi marks the enemy under her crosshair with a rune. Kaldr takes Beast form and hunts the prey – he lunges in with a dash attack and bites again and again. If the prey falls, he moves on to the nearest enemy. Press again to call him home; he then returns to elemental form. Costs nothing.',
    rows: () => { const r = rankOf('rh'); return [['Kaldr bite', `${Math.round(AB.rh.pct[r - 1] * 100)}% of basic`], ['Dash attack', `${Math.round(AB.rh.dashPct[r - 1] * 100)}% of basic · ${AB.rh.dashCd} s`], ['Range', '70'], ['Cooldown', '0.5 s']]; } },
  pf: { name: 'Permafrost', kind: 'Area · Slippery ice · Physical',
    text: 'Skadi freezes the ground at the target location for 5 seconds. The first touch deals damage, then the cold bites every half second. Enemies on the ice lose control and slide on in the direction they were heading, and are slowed 15%. Skadi herself skates faster on the ice and for 3 seconds after leaving it.',
    rows: () => { const r = rankOf('pf'); return [['Damage', `${AB.pf.dmg[r - 1]} (+50% PP), then ${AB.pf.tick[r - 1]} (+5%) every 0.5 s`], ['Radius', `${AB.pf.radius[r - 1]} (${(AB.pf.radius[r - 1] * SU).toFixed(1)} m)`], ['Skadi\'s speed', `+${Math.round(AB.pf.speed[r - 1] * 100)}%`], ['Cooldown', `${cdOf('pf').toFixed(1)} s`]]; } },
  wg: { name: "Winter's Grasp", kind: 'Ultimate · Area · Root · Physical',
    text: 'Skadi aims a circle. A blizzard erupts around her at once, while Kaldr – fully restored – runs (or leaps, if it is far) to the circle, and a second storm erupts around him when he lands. The first hit from each storm roots everyone inside, then the storms follow their owner and deal damage every half second for 4 seconds.',
    rows: () => { const r = rankOf('wg'); return [['First hit', `${AB.wg.dmg[r - 1]} (+35% PP) + root ${AB.wg.root[r - 1]} s`], ['Storm', `${AB.wg.tick[r - 1]} (+10% PP) × 8`], ['Radius', `20 (${(AB.wg.radius * SU).toFixed(0)} m) · range 70`], ['Cooldown', `${cdOf('wg').toFixed(0)} s`]]; } },
  th: { name: 'Howl of Thrymheim', kind: 'Final ability · Avalanche · True damage',
    text: 'Not in SMITE – Skadi\'s finale. Thrymheim is her mountain hall, where the wolves howl (Njord could not bear the sound). She plants her spear: glaciers tear up at the far end of the hall, the wolves of Thrymheim howl from the ridge, and an avalanche with the pack at its front thunders down the hall. Everyone in its path is swept up and carried to her spear, where the avalanche comes to a crashing halt and buries them in snow. The wolves fall upon the buried – then the snow tombs shatter.',
    rows: () => [['Length', `up to ${AB.th.length} m · ${AB.th.width} m wide`], ['Damage', `${Math.round(thDmg('sweep') + thDmg('bite') + thDmg('shatter'))} to each buried foe (avalanche + wolf + shatter)`], ['Build-up', `${TH_IMPACT.toFixed(1)} s`], ['Cost', `${costOf('th')} mana`], ['Cooldown', `${cdOf('th').toFixed(0)} s`]] },
};
registerGod({
  id: 'skadi', dbg: SK, name: 'Skadi', title: 'Goddess of Winter and the Hunt', epithet: 'Goddess of Winter', pantheon: 'Norse', role: 'Hunter',
  color: '#9fe2ff', glyphs: 'ᛉ ᚹ ᛁ ᚾ ᛏ ᛖ ᚱ', asset: 'skadi', stats: SKADI_STATS, order: ['pc', 'rh', 'pf', 'wg', 'th'], ab: skadiAB,
  blurb: 'The Jotunn huntress of the mountains with an ice spear and the winter wolf Kaldr at her side – and the finale <em>Howl of Thrymheim</em>.',
  info: SKADI_INFO, physical: true, textColor: '#a8ecff', finalColor: '#c8f4ff', fxColor: SKC.ice, accent: SKC.ice,
  init() { SK.kaldr = makeKaldr(); SK.atkHand = 0; SK.onIce = false; SK.iceT = 0; SK.wolfSpeed = 0; SK.storms = []; },
  dispose() {
    endHunt(false);
    if (SK.kaldr) { SK.kaldr.ghost.dispose(); SK.kaldr.beast.dispose(); SK.kaldr = null; }
    for (const S of SK.storms) { if (S.mist) S.mist.dead = true; if (S.snow) S.snow.dead = true; if (S.loop) S.loop.stop(0.2); S.ring.dead = true; S.rune.dead = true; }
    SK.storms = []; SK.wgOn = false;
    if (SK.th) thrymheimCleanup(SK.th);
    WORLD.dim = 1; GodFX.tint(SKC.ice, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.focus = null; P.speedBuff = 1;
  },
  intercept(id) { if (SK.th) return true; if (id === 'rh' && SK.hunt) { endHunt(true); return true; } return false; },
  busy() { return !!SK.th; },
  cast(id) { ({ pc: castPiercingCold, rh: startHunt, pf: castPermafrost, wg: castWintersGrasp, th: castThrymheim })[id](); },
  basic: skadiBasic,
  speedMul() { if (SK.th) return 0; return (SK.iceT > 0 ? 1 + AB.pf.speed[(SK.iceRank || 1) - 1] : 1) * (SK.wolfSpeed > 0 ? 1.1 : 1); },
  eyeBoost() { return (SK.th ? 1.4 : 0) + (SK.storms.length ? 0.8 : 0) + (SK.hunt ? 0.3 : 0); },
  update(dt, t) {
    updateKaldr(dt, t); updateHunt(dt, t); updateWintersGrasp(dt, t); updateThrymheim(dt, t);
    SK.iceT = Math.max(0, SK.iceT - (SK.onIce ? 0 : dt)); SK.onIce = false; SK.wolfSpeed = Math.max(0, (SK.wolfSpeed || 0) - dt);
  },
  targeter() {
    if (P.targeting === 'pc') lineTarget.show(P.pos, P.yaw, AB.pc.range * SU, 1.3, 1.3);
    else if (P.targeting === 'pf') { const c = groundTarget(AB.pf.range * SU, 2.5); circleTarget.show(c, AB.pf.radius[rankOf('pf') - 1] * SU, SKC.ice); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.3, 0.3); }
    else if (P.targeting === 'wg') { const c = groundTarget(AB.wg.range * SU, 2); circleTarget.show(c, AB.wg.radius * SU, SKC.glacier); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.3, 0.3); }
  },
  armed(id) { return (id === 'rh' && !!SK.hunt) || (id === 'wg' && SK.storms.length > 0) || (id === 'th' && !!SK.th); },
  buffs() { return [{ icon: 'skadi_rh', on: !!SK.hunt, n: '', t: '' }, { icon: 'skadi_pf', on: SK.iceT > 0, n: '', t: SK.iceT > 0 ? Math.ceil(SK.iceT) + 's' : '' }]; },
  onDummyDeath(d, p) {
    // a frozen soul drifts up as snow
    for (let i = 0; i < 14; i++) GodFX.spawn({ pos: p.clone().add(V3(rand(-0.4, 0.4), rand(0.5, 1.8), rand(-0.4, 0.4))), vel: V3(rand(-0.8, 0.8), rand(1, 2.5), rand(-0.8, 0.8)), life: rand(1.2, 2), size: rand(0.12, 0.24), sizeEnd: 0.03, color: SKC.frost, intensity: 1.6, cell: GX.snow, rotVel: rand(-3, 3), drag: 0.8 });
  },
  passivePanel: null,
  icon(ctx, S, id) {
    const ice = (fn, col = '#bff2ff', blur = 16) => glowText(ctx, fn, col, blur);
    if (id === 'passive') { iconBase(ctx, S, '#2a6aa8', '#06162e'); ice(() => drawWolfHead(ctx, S / 2, S * 0.55, S * 0.4, '#e8f8ff')); }
    else if (id === 'pc') { iconBase(ctx, S, '#2e7cc4', '#04122a'); ice(() => { ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#e8fbff'; ctx.fillRect(-S * 0.36, -3, S * 0.5, 6); ctx.beginPath(); ctx.moveTo(S * 0.14, -S * 0.08); ctx.lineTo(S * 0.42, 0); ctx.lineTo(S * 0.14, S * 0.08); ctx.closePath(); ctx.fill(); ctx.restore(); drawFlake(ctx, S * 0.3, S * 0.7, S * 0.14, '#cdf6ff'); }); }
    else if (id === 'rh') { iconBase(ctx, S, '#3466a8', '#081530'); ice(() => { ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = S * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(S / 2, S * 0.85); ctx.lineTo(S / 2, S * 0.15); ctx.moveTo(S / 2, S * 0.48); ctx.lineTo(S * 0.24, S * 0.2); ctx.moveTo(S / 2, S * 0.48); ctx.lineTo(S * 0.76, S * 0.2); ctx.stroke(); }); }
    else if (id === 'pf') { iconBase(ctx, S, '#3b88b8', '#061a2c'); ice(() => { drawFlake(ctx, S / 2, S / 2, S * 0.36, '#e8fbff'); }); }
    else if (id === 'wg') { iconBase(ctx, S, '#1d4c9a', '#030b20'); ice(() => { ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = S * 0.05; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(S * 0.36, S / 2, S * (0.08 + i * 0.07), i * 1.4, i * 1.4 + Math.PI * 1.3); ctx.stroke(); ctx.beginPath(); ctx.arc(S * 0.7, S * 0.6, S * (0.06 + i * 0.05), i * 1.7, i * 1.7 + Math.PI * 1.3); ctx.stroke(); } drawWolfHead(ctx, S * 0.7, S * 0.6, S * 0.12, '#ffffff'); }); }
    else if (id === 'th') { iconBase(ctx, S, '#1a58a8', '#020a18'); const g = ctx.createLinearGradient(0, 0, S, 0); g.addColorStop(0, 'rgba(60,255,170,0.55)'); g.addColorStop(1, 'rgba(110,160,255,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, S * 0.06, S, S * 0.16);
      ice(() => { ctx.fillStyle = '#cfe4ff'; ctx.beginPath(); ctx.moveTo(0, S * 0.62); for (let i = 0; i <= 6; i++) ctx.lineTo(S * i / 6, S * (i % 2 ? 0.26 : 0.46)); ctx.lineTo(S, S * 0.62); ctx.closePath(); ctx.fill(); drawWolfHead(ctx, S / 2, S * 0.78, S * 0.2, '#ffffff'); }); }
    else if (id === 'skadi_rh') { iconBase(ctx, S, '#3466a8', '#081530'); ice(() => drawWolfHead(ctx, S / 2, S * 0.55, S * 0.38, '#e8f8ff')); }
    else if (id === 'skadi_pf') { iconBase(ctx, S, '#3b88b8', '#061a2c'); ice(() => drawFlake(ctx, S / 2, S / 2, S * 0.32, '#e8fbff')); }
    else return false;
    return true;
  },
});
// little vector glyphs for the icons
function drawFlake(ctx, x, y, r, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, r * 0.13); ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); for (const s of [-1, 1]) { const bx = x + Math.cos(a) * r * 0.55, by = y + Math.sin(a) * r * 0.55; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + s * 0.8) * r * 0.32, by + Math.sin(a + s * 0.8) * r * 0.32); ctx.stroke(); } }
  ctx.restore();
}
function drawWolfHead(ctx, x, y, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x, y + s * 0.7); ctx.lineTo(x - s * 0.32, y + s * 0.2); ctx.lineTo(x - s * 0.58, y - s * 0.1); ctx.lineTo(x - s * 0.5, y - s * 0.75); ctx.lineTo(x - s * 0.22, y - s * 0.35);
  ctx.lineTo(x, y - s * 0.42); ctx.lineTo(x + s * 0.22, y - s * 0.35); ctx.lineTo(x + s * 0.5, y - s * 0.75); ctx.lineTo(x + s * 0.58, y - s * 0.1); ctx.lineTo(x + s * 0.32, y + s * 0.2); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * s * 0.2, y - s * 0.06, s * 0.09, s * 0.05, sx * 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}


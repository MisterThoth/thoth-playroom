// ============================================================================
// COOKIE MONSTER (owner-only, see GodLock in 11z_gods.js) - an original horror brute: a hulking, armoured
// giant whose head is a cracked chocolate-chip cookie with molten eyes. Physical, melee basic attacks.
//  Passive  Cookie Lover    - every 10 s he eats a cookie (upper-body gesture, never stops him): +5 % HP and mana
//  Q        Cookie Cannon   - a huge spinning cookie hurled in a line: pierces, slows, chip shrapnel
//  E        Crumble Form    - toggle (free, no cooldown): he becomes a rolling cookie wheel (+70 % speed, momentum)
//  R        Dough Mine      - a cookie-dough bomb at the aimed point (max 5, arms in 0.6 s, lives 60 s): caramel blast + root
//  F        Cookie Rage     - 10 s as a 3.8 m living cookie with two burning cookie swords: fast dual-sword combos
//  G        Cookie Horror   - pick ONE enemy god anywhere: cookie snow and horror music around the victim (their POV),
//                             a glitch, a SCREAMER, total silence ... then he teleports in front of them and CLAPS (BOOM)
// ============================================================================
const COOKIE_STATS = { hp: [560, 95], mp: [210, 34], speed: 355, range: 14, as: [0.86, 0.012], basic: [46, 2.6], basicScale: 1.0, hp5: [11, 0.9], mp5: [4.5, 0.4] };
const CM_EAT = { every: 10, heal: 0.05, mana: 0.05, bite: 0.95 };
const CM_ROLL = { speed: 0.7, radius: 0.95, accel: 2.4 };
const CM_RAGE = { dur: 10, ms: 0.3, as: 0.6, slamR: 5.5, windup: 0.5, slow: [1.75, 0.3], roarEvery: 4.2, slamR3: 4.6 };   // (the windup runs in slow motion: 0.5 s of game time = ~1.7 s real)
const CM_MINE = { max: 5, arm: 0.6, life: 60, trigger: 1.6, radius: 4.4, root: 1.4, lift: 0.55, flight: 0.5, size: 1.6 };
// Cookie Horror timeline (s after the target is chosen): snow + horror music, glitch, SCREAMER, silence, teleport + CLAP
const CM_HORROR = { glitch: 2.5, scream: 3.1, silence: 5.1, tele: 5.7, boom: 6.05, end: 7.2, splashR: 6, splash: 0.15,
  slow: { lead: 0.16, in: 0.35, hold: 1.2, out: 0.45, scale: 0.17 } };   // the clap's slow motion (real seconds; the hands close in it)
const CM = { form: 'normal', eatT: 6, eat: null, combo: 0, comboT: 0, roll: null, rage: null, rageR: null, home: null, mines: [], horror: null, pick: null,
  cookieBack: 0, aura: null, auras: [], screamImg: null, kills: 0, lifts: [] };   // (one per player online: 14n_net.js swaps it per god, NET_KITSTATE)
const CMC = { caramel: new THREE.Color(1.0, 0.45, 0.06), choc: new THREE.Color(0.3, 0.1, 0.02), fire: new THREE.Color(1.0, 0.3, 0.04), blood: new THREE.Color(0.7, 0.04, 0.04), crumb: new THREE.Color(0.75, 0.45, 0.16) };
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _c3 = new THREE.Vector3(), _c4 = new THREE.Vector3(), _c5 = new THREE.Vector3(), _cUp = new THREE.Vector3(0, 1, 0);
const cookieAB = {
  cc: { id: 'cc', name: 'Cookie Cannon', dmg: [90, 140, 190, 240, 290], scale: 0.8, cost: [60, 65, 70, 75, 80], cd: [10, 10, 10, 10, 10], range: 70, width: 0.9, slow: 0.25, slowDur: 1.5, targeted: true },
  cf: { id: 'cf', name: 'Crumble Form', cost: [0, 0, 0, 0, 0], cd: [0, 0, 0, 0, 0] },
  dm: { id: 'dm', name: 'Dough Mine', dmg: [100, 150, 200, 250, 300], scale: 0.7, cost: [40, 40, 40, 40, 40], cd: [7, 6.5, 6, 5.5, 5], range: 55, targeted: true },
  cr: { id: 'cr', name: 'Cookie Rage', slam: [200, 280, 360, 440, 520], slamScale: 1.0, sword: [40, 52, 64, 76, 88], swordScale: 0.2, cost: [90, 90, 90, 90, 90], cd: [90, 85, 80, 75, 70] },
  ch: { id: 'ch', name: 'Cookie Horror', dmg: [5000, 5600, 6200, 6800, 7400], scale: 10.0, cost: [100, 100, 100, 100, 100], cd: [110, 105, 100, 95, 90] },
};
const cmDmg = (id, k = 'dmg', sk = 'scale') => AB[id][k][rankOf(id) - 1] + AB[id][sk] * ppow();

// ---- palettes: caramel (his magic), chocolate (smoke, shrapnel), cookie fire, and the horror red ----
FX2.defPal('cookie', { edge: [0.3, 0.08, 0.0], mid: [0.95, 0.42, 0.04], core: [1.0, 0.72, 0.3], smoke: [0.22, 0.11, 0.04], light: [1.0, 0.45, 0.1], spark: [1.0, 0.62, 0.2] });
FX2.defPal('choco', { edge: [0.08, 0.02, 0.0], mid: [0.35, 0.12, 0.02], core: [0.75, 0.38, 0.12], smoke: [0.13, 0.06, 0.02], light: [0.6, 0.2, 0.05] });
FX2.defPal('cfire', { edge: [0.35, 0.02, 0.0], mid: [1.0, 0.28, 0.02], core: [1.0, 0.6, 0.15], smoke: [0.12, 0.04, 0.02], light: [1.0, 0.35, 0.05] });
FX2.defPal('horror', { edge: [0.2, 0.0, 0.02], mid: [0.6, 0.03, 0.05], core: [1.0, 0.3, 0.12], smoke: [0.05, 0.01, 0.01], light: [0.7, 0.05, 0.05] });

// ---- crumbs, chips, caramel ----------------------------------------------------------------------
function cmCrumbs(p, n = 12, s = 1, up = 1) {
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(1, 4) * s; FX2.solid.spawn({ pos: _c1.copy(p).add(_c2.set(rand(-0.15, 0.15), rand(-0.1, 0.1), rand(-0.15, 0.15))), vel: V3(Math.cos(a) * sp, rand(1.5, 4.5) * up * s, Math.sin(a) * sp), life: rand(0.7, 1.3), size: rand(0.05, 0.12) * Math.sqrt(s), sizeEnd: 0.04, cell: FXA.rock, pal: Math.random() < 0.7 ? 'cookie' : 'choco', temp: 0, tempEnd: 0, alpha: 1, gravity: -12, drag: 0.4, floor: true, rotVel: rand(-8, 8) }); }
}
function cmChips(p, n = 8, s = 1) {   // chocolate-chip shrapnel (real little chunks)
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(3, 8) * s; FX2.rocks.spawn({ pos: _c1.copy(p).add(_c2.set(rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2))), vel: V3(Math.cos(a) * sp * 0.6, rand(3, 7) * Math.sqrt(s), Math.sin(a) * sp * 0.6), size: rand(0.05, 0.12) * Math.sqrt(s), color: Math.random() < 0.6 ? CMC.choc : CMC.crumb }); }
}
function cmBurst(p, s = 1, o = {}) {
  FX2.burst(p, o.pal || 'cookie', { size: s, sparks: Math.round(22 * s), embers: Math.round(12 * s), puffs: Math.round(3 * s), bursts: o.bursts ?? 1, int: o.int ?? 1.0, distort: o.distort, light: o.light, smokeGlow: 0.35 });
  cmCrumbs(p, Math.round(14 * s), s);
}
function cmDust(p, n = 6, s = 1) {
  for (let i = 0; i < n; i++) { const a = rand(0, TAU); FX2.smoke.spawn({ pos: V3(p.x + Math.cos(a) * 0.3 * s, 0.15, p.z + Math.sin(a) * 0.3 * s), vel: V3(Math.cos(a) * rand(1, 3) * s, rand(0.3, 1.0), Math.sin(a) * rand(1, 3) * s), life: rand(0.8, 1.3), size: 0.35 * s, sizeEnd: 1.4 * s, frames: 16, pal: 'choco', temp: 0.15, tempEnd: 0, int: 1, alpha: 0.6, drag: 2.4, turb: 0.5 }); }
}
function cmText(p, text, color = '#ffb35a', big = false) { Combat.texts.push({ x: p.x, y: p.y, z: p.z, text, color, t: 0, big }); }
function cmMouth(out = new THREE.Vector3()) { return out.setFromMatrixPosition(Game.thoth.bones.head.matrixWorld).addScaledVector(fwdOf(P.yaw, _c5), 0.32).add(_c5.set(0, 0.1, 0)); }
// meshes thrown into the world are fresh clones: dispose their geometry, never the shared (glTF) materials/textures
// his loops (the rolling wheel, the burning swords) on another player's screen: as loud as he is near (14n_net.js)
function cmNear() { if (!Net.ctx) return 1; const d = camera.position.distanceTo(P.pos); return d > 60 ? 0 : clamp(1.25 / (1 + d / 14), 0, 1); }
function cmDrop(g) { if (!g || g.userData.dropped) return; g.userData.dropped = true; if (g.parent) g.parent.remove(g); }

// ---- the passive: Cookie Lover -------------------------------------------------------------------------
function cmStartEat() {
  CM.eat = { t: 0, bitten: false };
  if (CM.form === 'normal') Game.anim.play('eat', { noFx: true });
  Sound.god('eat', { gain: 0.85, delay: 0.45 });
  Sound.voice('passive_eat', { chance: 0.5, cooldown: 12 });
}
function cmUpdateEat(dt) {
  CM.eatT -= dt;
  // (online the others' copies of him eat when he does: the K event 'eat', 14n_net.js; their own timer never starts one)
  if (CM.eatT <= 0 && !CM.eat && Game.mode === 'play' && !P.dead && !CM.horror && !Net.ctx) { CM.eatT = CM_EAT.every; cmStartEat(); Net.cast('K', 'eat'); }
  const E = CM.eat; if (!E) return;
  E.t += dt;
  const small = CM.home && CM.home.rig.propL;
  if (small) { small.visible = CM.form === 'normal' && E.t < 1.45; small.scale.setScalar(Math.max(0.01, 1 - smoothstep(0.7, 1.4, E.t) * 0.85)); }
  if (CM.form === 'normal' && E.t > 0.6 && E.t < 1.4 && Math.random() < dt * 30) cmCrumbs(cmMouth(_c3), 1, 0.4, 0.3);
  if (!E.bitten && E.t >= CM_EAT.bite) {
    E.bitten = true;
    const hp = maxHp() * CM_EAT.heal, mp = maxMp() * CM_EAT.mana;
    P.hp = Math.min(maxHp(), P.hp + hp); P.mp = Math.min(maxMp(), P.mp + mp);
    if (!Net.ctx) cmText(P.pos.clone().setY(P.y + 3.0), `+${Math.round(hp)}`, '#8dff9a');   // (his own heal number: on his own screen only)
    Sound.god('crunch', { gain: 0.9 });
    const m = cmMouth(_c3); cmCrumbs(m, 10, 0.7, 0.6);
    FX2.glow.spawn({ pos: P.pos.clone().setY(1.4), life: 0.5, size: 0.8, sizeEnd: 1.6, cell: FXA.glow, pal: 'cookie', temp: 0.8, tempEnd: 0.4, int: 0.7, fadeIn: 0.05 });
  }
  if (E.t > 1.7) { CM.eat = null; if (small) small.visible = false; }
}

// ---- basic attack: two heavy punches and a two-fisted smash -------------------------------------------
function cmBusy() { return !!((CM.horror && !CM.horror.done) || CM.pick || (CM.rage && CM.rage.phase === 'in')); }
function cookieBasic() {
  if (cmBusy() || CM.form === 'roll') return;
  if (CM.form === 'rage') { cmRageSwing(); return; }
  P.atkCd = 1 / attackSpeed();
  if (CM.comboT <= 0) CM.combo = 0;
  const step = CM.combo % 3; CM.combo++; CM.comboT = 1.8;
  const heavy = step === 2, sp = Math.max(1, (heavy ? 0.72 : 0.5) / (P.atkCd * 0.95));
  Game.anim.play(['punch1', 'punch2', 'smash'][step], { speed: sp });
  P.atkPenalty = Math.min(0.35, P.atkCd * 0.5);
  Sound.god(`punch_swing${1 + step}`, { gain: 0.85, rate: rand(0.95, 1.05) });
  VFX.later((heavy ? 0.72 : 0.28) / sp, () => {
    if (Kit !== GODS.cookie || CM.form !== 'normal') return;
    const c = P.pos.clone(), dir = fwdOf(P.yaw), R = COOKIE_STATS.range * SU * 1.1;
    const near = dummiesInCone(c, dir, R, heavy ? 1.0 : 0.75).sort((a, b) => a.pos.distanceToSquared(c) - b.pos.distanceToSquared(c));
    if (heavy) {
      const at = c.clone().addScaledVector(dir, 1.8).setY(0);
      FX2.impact(at, 'cookie', { size: 0.65, ring: 2.6, sparks: 18, debris: 8, dustPal: 'choco', dustGlow: 0.05, int: 0.8 });
      cmCrumbs(at.clone().setY(0.3), 14, 1); Cam.shake = Math.max(Cam.shake, 0.22);
    }
    for (const d of heavy ? near : near.slice(0, 1)) {
      Combat.deal(d, basicDamage() * (heavy ? 1.35 : 1), 'basic', 'Fist');
      const hp = d.pos.clone().setY(1.1);
      cmBurst(hp, heavy ? 0.5 : 0.35, { distort: heavy, light: heavy });
      Sound.god('cookie_hit', { gain: 0.8, pos: d.pos, rate: rand(0.95, 1.08) });
    }
  });
}

// ---- Q · Cookie Cannon: a huge spinning cookie hurled in a line; it pierces everything --------------------
function castCookieCannon() {
  spend('cc'); startCd('cc');
  Game.anim.play('hurl');
  Sound.voice('q', { chance: 0.6, cooldown: 6 });
  VFX.later(0.3, () => {
    if (Kit !== GODS.cookie) return;
    const dmg = cmDmg('cc'), dir = fwdOf(P.yaw), speed = 30, held = CM.home && CM.home.rig.prop;
    // it leaves from the cookie in his hand (no pop): the held one hides, the flying one grows out of it
    const origin = held && held.visible ? held.getWorldPosition(new THREE.Vector3()) : aimOrigin().add(_c1.set(0, 0.35, 0));
    origin.y = Math.max(origin.y, 1.2);
    CM.cookieBack = 1.0;
    const g = makeCookieDisc(1.3); scene.add(g); g.position.copy(origin); g.scale.setScalar(0.55);
    const side = rightOf(P.yaw, new THREE.Vector3()), spinQ = new THREE.Quaternion(), baseQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, _cUp, dir));
    const trail = VFX.trail(0.42, CMC.caramel, 2.0, 22), S = { ang: 0, w: 0, crumbAcc: 0 };
    Sound.god('cookie_throw', { gain: 1.0 });
    cmCrumbs(origin, 8, 0.7);
    Combat.projectiles.push(new Projectile({
      kind: 'ability', pos: origin, dir, speed, radius: AB.cc.width, pierce: true, maxDist: AB.cc.range * SU, glyphRange: 0,
      onMove(p, dt) {
        g.position.copy(p.pos);
        g.scale.setScalar(lerp(0.55, 1, easeOutCubic(Math.min(1, p.t / 0.14))));
        S.w = damp(S.w, 15, 9, dt); S.ang += S.w * dt;   // the spin winds up smoothly
        spinQ.setFromAxisAngle(_c1.set(1, 0, 0), -S.ang); g.quaternion.copy(baseQ).multiply(spinQ);
        trail.push(p.pos);
        // a clean, even crumb trail (spaced by distance, not by chance) and the odd chip
        S.crumbAcc += speed * dt;
        while (S.crumbAcc > 0.35) { S.crumbAcc -= 0.35; FX2.solid.spawn({ pos: _c2.copy(p.pos).add(_c3.set(rand(-0.2, 0.2), rand(-0.3, 0.2), rand(-0.2, 0.2))), vel: V3(rand(-0.6, 0.6), rand(-0.2, 1.0), rand(-0.6, 0.6)), life: rand(0.7, 1.1), size: rand(0.05, 0.09), sizeEnd: 0.04, cell: FXA.rock, pal: Math.random() < 0.6 ? 'cookie' : 'choco', temp: 0, tempEnd: 0, alpha: 1, gravity: -11, floor: true, rotVel: rand(-6, 6) }); }
        if (Math.random() < dt * 8) FX2.rocks.spawn({ pos: p.pos.clone(), vel: V3(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5)), size: rand(0.04, 0.07), color: CMC.choc });
        FX2.trailTick(p.pos, _c2.copy(p.dir).multiplyScalar(speed), 'cookie', dt, { k: 0.6, size: 0.8, smoke: false });
      },
      onHit(d, hp) {
        Combat.deal(d, dmg, 'ability', 'Cookie Cannon');
        d.slowed(AB.cc.slow, AB.cc.slowDur);
        // the cookie ploughs straight through: a crumb spray thrown along its path, a gentle push, no stop
        cmBurst(hp, 0.5, { distort: false, light: false });
        for (let i = 0; i < 10; i++) FX2.solid.spawn({ pos: hp, vel: _c2.copy(dir).multiplyScalar(rand(3, 7)).add(_c3.set(rand(-1.5, 1.5), rand(0.5, 3), rand(-1.5, 1.5))), life: rand(0.6, 1.0), size: rand(0.06, 0.11), sizeEnd: 0.04, cell: FXA.rock, pal: 'cookie', temp: 0, tempEnd: 0, alpha: 1, gravity: -11, floor: true, rotVel: rand(-8, 8) });
        cmChips(hp, 5, 0.6);
        d.shove(_c2.copy(dir).multiplyScalar(0.5), 1.2);
        Sound.god('cookie_hit', { gain: 0.95, pos: hp, rate: rand(0.95, 1.05) });
        Cam.shake = Math.max(Cam.shake, 0.1);
      },
      onDie(p, at) { trail.alive = false; cmBurst(at, 0.7, { distort: false }); cmChips(at, 10, 0.9); Sound.god('crunch', { gain: 0.8, pos: at }); cmDrop(g); },
    }));
  });
}

// ---- E · Crumble Form: he rolls up into a giant cookie wheel (a free toggle) -----------------------------
function castCrumble() {
  if (CM.form === 'roll') { cmRollOut(); return; }
  if (CM.form !== 'normal') return;
  const W = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(), disc = makeCookieDisc(CM_ROLL.radius * 2);
  W.add(tilt); tilt.add(spin); spin.add(disc); scene.add(W);
  W.position.set(P.pos.x, CM_ROLL.radius, P.pos.z); W.rotation.y = P.yaw;
  CM.roll = { W, tilt, spin, yaw: P.yaw, ang: 0, lean: 0, grow: 0, dustT: 0, loop: Sound.god('roll_loop', { gain: 0.0001, loop: true }) };
  CM.form = 'roll';
  if (CM.home) CM.home.rig.root.visible = false;
  cmPuff(P.pos, 0.9);
  Sound.god('crunch', { gain: 1.0 }); Sound.voice('e_in', { chance: 0.7, cooldown: 4 });
}
function cmRollOut() {
  const R = CM.roll; if (!R) return;
  cmPuff(P.pos, 0.9);
  if (R.loop) R.loop.stop(0.2);
  cmDrop(R.W);
  CM.roll = null; CM.form = 'normal';
  if (CM.home) CM.home.rig.root.visible = true;
  Game.anim.play('land');
  Sound.god('crunch', { gain: 1.0, rate: 0.9 }); Sound.voice('e_out', { chance: 0.6, cooldown: 4 });
}
function cmPuff(c, s = 1) {   // the crunchy transform puff
  const p = c.clone().setY(1.0);
  cmBurst(p, 0.8 * s, { distort: true });
  cmDust(c, 10, 1.2 * s);
  FX2.ring(c.clone().setY(0), 'cookie', { radius: 3 * s, dur: 0.45, width: 0.06 });
  Cam.shake = Math.max(Cam.shake, 0.2 * s);
}
function cmUpdateRoll(dt) {
  const R = CM.roll; if (!R) return;
  const sp = Math.hypot(P.vel.x, P.vel.z);
  R.grow = Math.min(1, R.grow + dt * 5);
  if (sp > 0.3) { const ty = Math.atan2(P.vel.x, P.vel.z), dy = wrapAngle(ty - R.yaw); const turn = dy * (1 - Math.exp(-8 * dt)); R.yaw = wrapAngle(R.yaw + turn); R.lean = damp(R.lean, clamp(-turn / Math.max(dt, 1e-3) * sp * 0.035, -0.45, 0.45), 6, dt); }
  else R.lean = damp(R.lean, 0, 6, dt);
  R.ang += (sp / CM_ROLL.radius) * dt;
  R.W.position.set(P.pos.x, CM_ROLL.radius * (0.4 + 0.6 * easeOutBack(R.grow)), P.pos.z);
  R.W.rotation.y = R.yaw; R.tilt.rotation.z = R.lean; R.spin.rotation.x = R.ang;
  R.W.scale.setScalar(Math.max(0.05, easeOutBack(R.grow)));
  if (R.loop) R.loop.g.gain.setTargetAtTime(Math.max(0.0001, Math.min(0.9, sp / 6) * cmNear()), Sound.ctx.currentTime, 0.1);
  // a crumb trail behind the wheel
  R.dustT -= dt * sp;
  if (R.dustT <= 0 && sp > 1) { R.dustT = 0.5; const back = fwdOf(R.yaw, _c1).multiplyScalar(-0.8); cmCrumbs(_c2.copy(P.pos).add(back).setY(0.1), 2, 0.5, 0.5); if (Math.random() < 0.4) cmDust(_c2, 1, 0.6); }
}

// ---- R · Dough Mine: a cookie-dough bomb lobbed onto the aimed point ------------------------------------
function cmMineMesh() {
  // a big chocolate-chip cookie bomb: a thick golden disc lying flat, chunky glossy chips on top, a glowing,
  // bubbling dough core in a crack, and a caramel candy-stick fuse with a sizzling spark
  const g = new THREE.Group(), K = CM_MINE.size;
  const disc = makeCookieDisc(0.62 * K); disc.rotation.z = Math.PI / 2; disc.position.y = 0.07 * K; g.add(disc);
  const choc = new THREE.MeshStandardMaterial({ color: 0x24100a, roughness: 0.22, metalness: 0.05 });
  for (let i = 0; i < 9; i++) { const a = rand(0, TAU), r = rand(0.06, 0.24) * K; const c = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.03, 0.05) * K, 0), choc); c.position.set(Math.cos(a) * r, 0.135 * K + rand(0, 0.01), Math.sin(a) * r); c.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); c.scale.y = 0.7; g.add(c); }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.075 * K, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffb04a, roughness: 0.4, emissive: new THREE.Color(1.0, 0.42, 0.05), emissiveIntensity: 1.2 }));
  core.position.set(0.04 * K, 0.12 * K, -0.03 * K); core.scale.y = 0.55; g.add(core);
  const caramel = new THREE.MeshStandardMaterial({ color: 0xc86a14, roughness: 0.25, metalness: 0.2, emissive: new THREE.Color(0.3, 0.1, 0.0), emissiveIntensity: 0.5 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * K, 0.018 * K, 0.22 * K, 8), caramel); stick.position.set(-0.05 * K, 0.24 * K, 0); stick.rotation.z = 0.35; g.add(stick);
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.022 * K, 10, 8), caramel); drip.scale.y = 1.6; drip.position.set(-0.02 * K, 0.17 * K, 0.012 * K); g.add(drip);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1.0, 0.45, 0.05), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.0 }));
  spark.scale.setScalar(0.42 * K); spark.position.set(-0.09 * K, 0.35 * K, 0); spark.renderOrder = 7; g.add(spark);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1.0, 0.38, 0.04), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.0 }));
  glow.scale.setScalar(0.5 * K); glow.position.copy(core.position); glow.renderOrder = 7; g.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { spark, glow, core, tip: new THREE.Vector3(-0.09 * K, 0.35 * K, 0) };
  return g;
}
function castDoughMine() {
  spend('dm'); startCd('dm');
  const to = groundTarget(AB.dm.range * SU, 2.5), from = handPos('L', new THREE.Vector3());
  Game.anim.play('plant');
  Sound.voice('r', { chance: 0.5, cooldown: 6 });
  Sound.god('mine_place', { gain: 0.9 });
  if (CM.mines.length >= CM_MINE.max) cmMineBoom(CM.mines[0]);   // the oldest pops
  const g = cmMineMesh(); g.position.copy(from); scene.add(g);
  CM.mines.push({ g, pos: to.clone(), from, t: 0, armed: false, landed: false, dmg: cmDmg('dm'), dead: false });
}
function cmUpdateMines(dt, t) {
  for (const M of CM.mines) {
    M.t += dt;
    if (!M.landed) {
      const k = Math.min(1, M.t / CM_MINE.flight);
      M.g.position.lerpVectors(M.from, M.pos, k); M.g.position.y = lerp(M.from.y, 0, k) + Math.sin(k * Math.PI) * 1.6;
      M.g.rotation.x = k * 6;
      if (k >= 1) { M.landed = true; M.g.rotation.set(0, rand(0, TAU), 0); M.g.position.copy(M.pos); cmCrumbs(M.pos.clone().setY(0.2), 6, 0.6, 0.6); cmDust(M.pos, 3, 0.5); }
      continue;
    }
    if (!M.armed && M.t >= CM_MINE.flight + CM_MINE.arm) { M.armed = true; Sound.god('mine_arm', { gain: 0.6, pos: M.pos }); FX2.ring(M.pos, 'cookie', { radius: 1.0, dur: 0.35, width: 0.05, int: 0.8 }); }
    // the bubbling dough and the fuse spark (only the owner sees the faint ring: it is subtle, sneaky for the foes)
    const U = M.g.userData, sp = U.spark; sp.material.opacity = M.armed ? 0.55 + 0.35 * Math.sin(t * 17 + M.t) * Math.sin(t * 7.3) : 0.15;
    U.glow.material.opacity = (M.armed ? 0.35 : 0.15) + 0.15 * Math.sin(t * 3.1 + M.t); U.core.scale.set(1 + 0.08 * Math.sin(t * 4 + M.t), 0.55 + 0.06 * Math.sin(t * 5.3), 1 + 0.08 * Math.cos(t * 4.4));
    if (M.armed && Math.random() < dt * 4) FX2.glow.spawn({ pos: _c1.copy(M.pos).add(_c2.set(rand(-0.1, 0.1), 0.42, rand(-0.1, 0.1))), vel: V3(rand(-0.2, 0.2), rand(0.4, 0.9), rand(-0.2, 0.2)), life: 0.4, size: 0.04, sizeEnd: 0.01, cell: FXA.spark, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.8 });
    if (Math.random() < dt * 2.5) FX2.glow.spawn({ pos: _c1.copy(M.pos).setY(0.22 * CM_MINE.size), vel: V3(0, rand(0.1, 0.3), 0), life: 0.7, size: 0.06, sizeEnd: 0.2, cell: FXA.bubble, pal: 'cookie', temp: 0.8, tempEnd: 0.5, int: 1.0 });   // the dough bubbles
    if (M.armed && dummiesNear(M.pos, CM_MINE.trigger).length) cmMineBoom(M);
    else if (M.t > CM_MINE.life) cmMineBoom(M, true);
  }
  CM.mines = CM.mines.filter((M) => !M.dead);
}
function cmMineBoom(M, fizzle = false) {
  if (M.dead) return;
  M.dead = true; cmDrop(M.g);
  const c = M.pos.clone().setY(0), R = CM_MINE.radius;
  if (fizzle) { cmDust(c, 4, 0.6); cmCrumbs(c.clone().setY(0.2), 8, 0.6); return; }
  Sound.god('mine_boom', { gain: 1.2, pos: c });
  Game.hitStop(0.05, 0.2);
  Cam.shake = Math.max(Cam.shake, 0.45);
  PostFX.shock(c.clone().setY(0.6), 0.6, 0.5);
  FX2.impact(c, 'cookie', { size: 1.35, ring: R / 1.35 + 0.4, sparks: 44, debris: 16, dustPal: 'choco', dustGlow: 0.12, int: 0.85, glowRocks: true });
  FX2.burst(c.clone().setY(0.9), 'choco', { size: 1.0, sparks: 14, embers: 10, puffs: 9, bursts: 1, int: 0.7, light: false, smokeGlow: 0.25 });
  // chocolate chunks, a caramel splash, a rolling crumb cloud
  cmChips(c.clone().setY(0.4), 30, 1.4); cmCrumbs(c.clone().setY(0.5), 36, 1.4, 1.2);
  for (let i = 0; i < 40; i++) { const a = rand(0, TAU), sp = rand(3, 8); FX2.solid.spawn({ pos: c.clone().setY(0.4), vel: V3(Math.cos(a) * sp, rand(3, 7), Math.sin(a) * sp), life: rand(0.7, 1.2), size: rand(0.07, 0.15), sizeEnd: 0.05, cell: FXA.drop, pal: 'cookie', temp: 0.3, tempEnd: 0, alpha: 0.95, gravity: -13, drag: 0.4, floor: true, stretch: 1.6 }); }
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, ox = Math.cos(a), oz = Math.sin(a); FX2.smoke.spawn({ pos: V3(c.x + ox * 0.6, rand(0.3, 1.0), c.z + oz * 0.6), vel: V3(ox * rand(4, 7), rand(0.4, 1.4), oz * rand(4, 7)), life: rand(1.2, 1.8), size: 0.8, sizeEnd: rand(2.6, 3.4), frames: 16, pal: 'choco', temp: 0.2, tempEnd: 0, int: 1, alpha: 0.7, drag: 2.6, turb: 0.6, fadeIn: 0.03 }); }
  for (let i = 0; i < 14; i++) FX2.glow.spawn({ pos: c.clone().setY(0.3), vel: V3(rand(-2.5, 2.5), rand(1, 3.5), rand(-2.5, 2.5)), life: rand(0.6, 1.0), size: rand(0.14, 0.26), sizeEnd: 0.05, cell: FXA.bubble, pal: 'cookie', temp: 0.9, tempEnd: 0.4, int: 1.3, gravity: -4, drag: 1 });
  FX2.scorch(c, 'cookie', { radius: 3.0, dur: 6, int: 0.65, dark: new THREE.Color(0.16, 0.07, 0.02), darkAlpha: 0.7 });
  VFX.cracks(c, R * 0.6, 3, { grow: 0.15, intensity: 1.1, color: CMC.caramel });
  for (const d of dummiesNear(c, R)) {
    Combat.deal(d, M.dmg, 'ability', 'Dough Mine');
    if (d.rooted) d.rooted(CM_MINE.root);
    cmKnockUp(d, CM_MINE.lift, 1.0);
    cmBurst(d.pos.clone().setY(1.0), 0.4, { distort: false, light: false });
  }
}
// thrown up into the air (stunned while airborne), then a thud back down
// (a replayed cast online lifts nothing: its caster's page throws the real one up and sends it, 14n_net.js)
function cmKnockUp(d, dur = 0.5, h = 1.0) { if (!d.alive || d.isGhost) return; if (d.applyStun) d.applyStun(dur + 0.05); const L0 = CM.lifts, i = L0.findIndex((L) => L.d === d); if (i >= 0) L0.splice(i, 1); L0.push({ d, t: 0, dur, h }); }
function cmUpdateLifts(dt) {
  const LS = CM.lifts;
  for (let i = LS.length - 1; i >= 0; i--) {
    const L = LS[i]; L.t += dt; const k = Math.min(1, L.t / L.dur);
    L.d.lift = Math.sin(k * Math.PI) * L.h;
    if (k >= 1 || !L.d.alive) { L.d.lift = 0; if (L.d.alive) cmDust(L.d.pos, 3, 0.6); LS.splice(i, 1); }
  }
}

// ---- F · Cookie Rage: a living cookie with two burning cookie greatswords -----------------------------
// The combo chain (clip times from the Meshy clips, measured blade-tip speeds; see GOD_RIG.cookie_rage): every swing names the
// clip-time of its strike(s), the clip-time after which the next swing may start (lock), its reach/arc and damage multiplier,
// which blade cuts, and its voice/camera weight. Swings overlap: the next one's anticipation fades in over the follow-through.
const CM_CHAIN = [
  { act: 'wC', hits: [{ at: 2.27, k: 1.25, side: 'R' }], lock: 2.42, reach: 5.4, arc: 1.15, shake: 0.42, kind: 'chop' },      // right sword: overhead diagonal chop
  { act: 'wCL', hits: [{ at: 2.27, k: 1.25, side: 'L' }], lock: 2.42, reach: 5.4, arc: 1.15, shake: 0.42, kind: 'chop' },     // left sword: the mirrored chop
  { act: 'wB', hits: [{ at: 1.42, k: 1.25, side: 'R' }], lock: 1.6, reach: 5.2, arc: 1.35, shake: 0.36, kind: 'sweep' },       // right sword: a wide sweep
  { act: 'ss', hits: [{ at: 1.07, k: 1.8, side: 'R' }], lock: 2.05, reach: 5.6, arc: 1.6, shake: 0.55, kind: 'spin' },        // the coiled, spinning rising slash
  { fin: true },                                                                                                              // finisher (alternates)
];
const CM_FIN = [
  // both blades: a low double sweep, a spinning leap, both swords crashing down on landing (an AoE where they land)
  { act: 'ds', hits: [{ at: 0.62, k: 0.8, side: 'B' }, { at: 1.66, k: 2.4, side: 'B', slam: true, fwd: 3.8 }], lock: 1.78, reach: 5.2, arc: 1.4, shake: 0.9, kind: 'fin' },
  // both swords overhead and DOWN: a fire shockwave racing out
  { act: 'rs3', hits: [{ at: 1.41, k: 2.8, side: 'B', slam: true, fwd: 2.8 }], lock: 1.62, reach: 5.2, arc: 1.2, shake: 0.85, kind: 'fin' },
];
function cmRageRig() {
  if (!CM.rageR && Assets.glb.cookie_rage) {
    // (another player's Cookie Monster online: his own copy, hung in his avatar's unit so the arena's sight and shadow
    // switches reach it; the kit swaps it in as it does for the player, 14n_net.js)
    const nc = Net.ctx, rig = nc ? cloneGodRig(Assets.glb.cookie_rage, 'cookie_rage', Assets.rest.cookie_rage) : new GodRig(Assets.glb.cookie_rage, 'cookie_rage');
    if (nc) rig.root.rotation.order = 'YXZ';
    rig.root.visible = false; (nc ? nc.actor.parent : scene).add(rig.root);
    if (nc && nc.actor.unit) nc.actor.unit.castsShadow = undefined;
    const anim = new RigAnimator(rig, null);
    if (nc) anim.fxK = nc.actor.fxK;
    anim.onStep = (p) => { if (Game.mode === 'play' && CM.form === 'rage' && Game.anim === anim) cmStomp(p); };   // (only as his own kit: never another player's rig)
    CM.rageR = { rig, anim, ribbons: [new CMRibbon(rig.props.swordR), new CMRibbon(rig.props.swordL)] };
  }
  return CM.rageR;
}
// (another player's copy of him online: his unit stands as tall as the form it shows - its bars, its culling sphere)
function cmUnitHeight(rage) { const u = Net.ctx && Net.ctx.actor.unit; if (u) u.height = rage ? 4.6 : 2.0; }
function cmSwapForm(toRage) {
  const R = toRage ? cmRageRig() : CM.home;
  if (!R || !Game.thoth || Game.thoth === R.rig) return false;
  const from = Game.thoth;
  R.rig.root.position.copy(from.root.position); R.rig.root.rotation.y = from.root.rotation.y; R.rig.root.visible = true;
  from.root.visible = false;
  Object.assign(R.anim, { actions: [], channelTarget: 0, channel: 0, liftTarget: 0, extraLift: 0, firstFrame: true });
  if (R.anim.rootMove) R.anim.rootMove.set(0, 0, 0);
  if (CM.rageR && CM.rageR.ribbons) for (const rb of CM.rageR.ribbons) rb.reset();
  Game.thoth = R.rig; Game.anim = R.anim;
  cmUnitHeight(toRage);
  return true;
}
function cmStomp(p) {   // every footfall of the 4.75 m rage form: a heavy thud, a burning-crumb shockwave, a camera thump
  Sound.god('stomp', { gain: 0.85, rate: rand(0.85, 1.0) });
  const at = (p && p.isVector3 ? p : P.pos).clone().setY(0);
  FX2.ring(at, 'cfire', { radius: 2.4, dur: 0.4, width: 0.06, int: 0.8, distort: false });
  cmCrumbs(at.clone().setY(0.1), 8, 0.8, 0.8); cmDust(at, 3, 1.0);
  for (let i = 0; i < 4; i++) FX2.glow.spawn({ pos: at.clone().setY(0.1), vel: V3(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5)), life: rand(0.4, 0.7), size: 0.05, sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.8, gravity: -5 });
  Cam.shake = Math.max(Cam.shake, 0.22);
  if (CM.rage) CM.rage.thud = 1;
}
function castCookieRage() {
  if (CM.form === 'roll') cmRollOut();
  spend('cr'); startCd('cr');
  CM.rage = { t: 0, phase: 'in', fire: 0, sfx: null, combo: 0, comboT: 0, roarT: CM_RAGE.roarEvery, thud: 0, ventT: 0, hazeT: 0, swingT: 0, fin: 0, heat: 0, flare: 0, cryT: 0 };
  // the windup in slow motion: he throws his head back and ROARS, the ground shakes and splits, fire and embers are drawn in
  Game.anim.play('roar');
  Game.hitStop(CM_RAGE.slow[0], CM_RAGE.slow[1]);
  Sound.voice('f_roar', { priority: 4, gain: 1.2, cooldown: 0 });
  Sound.god('rage_transform', { gain: 1.1, delay: 0.55, rate: 0.85, noDuck: true });
  Sound.duckMusic(0.35, 2.6, 1.6);
  WORLD.dim = 0.7; PostFX.vigTarget = 0.5;
  CM.rage.charge = FX2.charge(P.pos.clone().setY(2.0), 'cfire', { dur: CM_RAGE.windup, radius: 3.6, rate: 160, size: 1.9 });
  CM.rage.haze = FX2.distort.heat(V3(0, 2.2, 0), 6, 0.007, CM_RAGE.windup + 0.2, P.pos);
  VFX.cracks(P.pos.clone().setY(0), 3.8, 2.6, { grow: 0.6, intensity: 1.4, color: CMC.fire });
  FX2.scorch(P.pos, 'cfire', { radius: 2.6, dur: 4, int: 1.0, dark: new THREE.Color(0.14, 0.05, 0.02), darkAlpha: 0.6 });
}
function cmRageIn() {
  const RG = CM.rage;
  RG.phase = 'on'; RG.t = 0;
  const swapped = cmSwapForm(true);
  RG.swapped = swapped;
  CM.form = 'rage';
  // the explosion of fire and crumbs, the screen jolts, the floor splits (one warm flash: no strobing)
  const c = P.pos.clone();
  cmPuff(c, 2.0);
  Game.hitStop(0.14, 0.1); Cam.shake = Math.max(Cam.shake, 1.0); Cam.fovKick = 12;
  PostFX.shock(c.clone().setY(1.5), 1.1, 0.8); PostFX.aberr = 0.004;
  VFX.flash(c.clone().setY(2), CMC.fire, 30, 0.6);
  FX2.burst(c.clone().setY(2.0), 'cfire', { size: 2.0, sparks: 80, embers: 50, puffs: 10, bursts: 2, int: 0.7, smokeGlow: 0.35 });
  FX2.burst(c.clone().setY(1.2), 'choco', { size: 1.3, sparks: 20, embers: 10, puffs: 8, bursts: 0, int: 0.6, light: false, distort: false });
  for (let i = 0; i < 46; i++) { const a = rand(0, TAU), sp = rand(5, 11); FX2.fire.spawn({ pos: V3(c.x + Math.cos(a) * 0.8, rand(0.3, 1.5), c.z + Math.sin(a) * 0.8), vel: V3(Math.cos(a) * sp, rand(0.5, 3), Math.sin(a) * sp), life: rand(0.4, 0.8), size: rand(0.6, 1.1), sizeEnd: 0.2, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.3, int: 1.2, drag: 2.5 }); }
  cmCrumbs(c.clone().setY(1.5), 60, 1.8, 1.4); cmChips(c.clone().setY(1), 24, 1.6);
  FX2.ring(c, 'cfire', { radius: CM_RAGE.slamR + 1.5, dur: 0.6, width: 0.09, int: 1.1 });
  VFX.later(0.12, () => FX2.ring(c, 'cookie', { radius: CM_RAGE.slamR + 5, dur: 0.9, width: 0.05 }));
  FX2.distort.ring(c.clone().setY(1), 24, 0.04, 0.8);
  VFX.cracks(c.clone().setY(0), CM_RAGE.slamR, 4, { grow: 0.2, intensity: 1.5, color: CMC.fire });
  FX2.scorch(c, 'cfire', { radius: 3.6, dur: 6, int: 0.8, dark: new THREE.Color(0.14, 0.05, 0.02), darkAlpha: 0.7 });
  if (swapped) Game.anim.play('roar', { noFx: true });   // the war cry: a sword thrust to the sky
  WORLD.dim = 0.88; PostFX.vigTarget = 0.28;
  RG.heat = 3.2;   // the swords ignite white-hot and the lava in his cracks flares, then they settle to a steady burn
  const R = CM.rageR;
  if (R) for (const k of ['swordR', 'swordL']) { const sw = R.rig.props[k]; if (!sw) continue; sw.updateWorldMatrix(true, true);
    for (let i = 0; i < 18; i++) FX2.fire.spawn({ pos: sw.localToWorld(_c1.lerpVectors(sw.userData.base, sw.userData.tip, i / 17)), vel: V3(rand(-0.4, 0.4), rand(1.5, 3.5), rand(-0.4, 0.4)), life: rand(0.35, 0.6), size: rand(0.5, 0.8), sizeEnd: 0.1, frames: 16, pal: 'cfire', temp: 1.1, tempEnd: 0.4, int: 1.4 }); }
  // the transform slam hits everything around him and throws it back
  const dmg = cmDmg('cr', 'slam', 'slamScale');
  for (const d of dummiesNear(c, CM_RAGE.slamR)) { Combat.deal(d, dmg, 'ability', 'Cookie Rage'); const out = _c1.set(d.pos.x - c.x, 0, d.pos.z - c.z); const L = out.length() || 1; d.shove(out.multiplyScalar(2.0 / L), 1.6); cmKnockUp(d, 0.45, 0.8); }
  RG.sfx = Sound.god('fire_loop', { gain: 0.6, loop: true });
  RG.aura = FX2.aura(P.pos, 'cfire', { radius: 2.2, height: 4.6, rate: 14, size: 1.4 });
  RG.mist = FX2.mist(P.pos, 'cfire', { radius: 2.0, rate: 5, glow: 0.45, alpha: 0.3, size: 0.9, height: 0.5, rise: 0.4 });
}
function cmRageOut() {
  const RG = CM.rage; if (!RG) return;
  if (RG.sfx) RG.sfx.stop(0.3);
  if (RG.aura) RG.aura.dead = true;
  if (RG.mist) RG.mist.dead = true;
  if (RG.haze) RG.haze.dead = true;
  const R = CM.rageR;
  // the swords crumble into burning crumbs as he shrinks back
  if (R) for (const k of ['swordR', 'swordL']) { const sw = R.rig.props[k]; if (!sw) continue; for (let i = 0; i < 6; i++) cmCrumbs(sw.localToWorld(_c1.lerpVectors(sw.userData.base, sw.userData.tip, i / 5)), 2, 0.6, 0.5); }
  cmSwapForm(false);
  CM.form = 'normal'; CM.rage = null;
  cmPuff(P.pos, 1.4);
  FX2.burst(P.pos.clone().setY(1.6), 'cfire', { size: 0.9, sparks: 30, embers: 20, puffs: 4, bursts: 1, int: 0.6 });
  Game.anim.play('land');
  Sound.voice('f_end', { priority: 2, cooldown: 0 });
  WORLD.dim = 1; PostFX.vigTarget = 0;
}
const _swingActs = new Set(['wC', 'wCL', 'wB', 'wA', 'ss', 'ds', 'rs3']);
function cmUpdateRage(dt, t) {
  const RG = CM.rage; if (!RG) return;
  RG.t += dt; RG.comboT = Math.max(0, RG.comboT - dt); RG.thud = Math.max(0, RG.thud - dt * 5); RG.flare = Math.max(0, RG.flare - dt * 3);
  if (RG.phase === 'in') {
    const k = RG.t / CM_RAGE.windup;
    Cam.shake = Math.max(Cam.shake, 0.15 + 0.55 * k);
    if (Math.random() < dt * 40) cmCrumbs(_c2.copy(P.pos).add(_c3.set(rand(-3, 3), 0.1, rand(-3, 3))), 1, 0.5, 1.2);   // pebbles of crumb hop on the shaking floor
    if (Math.random() < dt * 30) { const a = rand(0, TAU), r = rand(1.2, 3.5); FX2.glow.spawn({ pos: V3(P.pos.x + Math.cos(a) * r, 0.1, P.pos.z + Math.sin(a) * r), vel: V3(0, rand(2, 5), 0), life: rand(0.5, 0.9), size: rand(0.05, 0.1), sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.8 }); }   // embers rise out of the cracks
    if (RG.t >= CM_RAGE.windup) cmRageIn();
    return;
  }
  if (RG.t >= CM_RAGE.dur) { cmRageOut(); return; }
  const R = CM.rageR;
  const swinging = !!(R && Game.anim.actions.some((a) => _swingActs.has(a.name)));
  // root motion: he steps into every swing (the clip's own stride), but stops short of the body he is hacking at
  const rm = Game.anim.rootMove;
  if (rm && rm.lengthSq() > 0) {
    const f = fwdOf(P.yaw, _c4); let k = 1;
    for (const d of Combat.dummies) { if (!d.alive) continue; const dx = d.pos.x - P.pos.x, dz = d.pos.z - P.pos.z, ahead = dx * f.x + dz * f.z; if (ahead > 0 && Math.abs(dx * f.z - dz * f.x) < d.radius + 1.2) k = Math.min(k, clamp((ahead - d.radius - 1.6) / 1.4, 0, 1)); }
    const fw = Math.max(0, rm.x * f.x + rm.z * f.z);   // (forward only: the clips' recovery steps back and sideways stay in place)
    P.pos.addScaledVector(f, fw * k); resolveCircle(P.pos, 0.45); rm.set(0, 0, 0);
  }
  // a roar every few seconds - only between swings (it never cuts into the sword work)
  RG.roarT -= dt;
  if (RG.roarT <= 0 && R && !swinging && RG.comboT <= 0) {
    RG.roarT = CM_RAGE.roarEvery + rand(-0.5, 0.5);
    Game.anim.play('roar2', { noFx: true });
    Sound.voice('f_roar', { priority: 2, gain: 1.0, cooldown: 3 });
    Sound.god('rage_transform', { gain: 0.5, rate: 1.2 });
    const m = cmMouth(_c3);
    FX2.burst(m, 'cfire', { size: 0.6, sparks: 16, embers: 12, puffs: 3, bursts: 1, int: 0.6, light: false, distort: true });
    Cam.shake = Math.max(Cam.shake, 0.3); RG.flare = 1;
  } else if (RG.roarT <= 0) RG.roarT = 0.6;
  if (!R) return;
  if (RG.sfx && Net.ctx) RG.sfx.g.gain.setTargetAtTime(Math.max(0.0001, 0.6 * cmNear()), Sound.ctx.currentTime, 0.2);
  // his heat: the lava in his cracks breathes (a slow swell), flares on every footfall, swing and roar; the transform's
  // white-hot surge settles over the first second
  RG.heat = damp(RG.heat, 1, 1.4, dt);
  const breath = 0.5 + 0.5 * Math.sin(RG.t * 2.6);
  const mg = R.rig.material.userData.magmaK;
  if (mg) mg.value = 0.7 * RG.heat + 0.55 * breath + 0.5 * RG.thud + 0.7 * RG.flare + (swinging ? 0.25 : 0);
  if (R.rig.material.userData.rimStrength) R.rig.material.userData.rimStrength.value = 0.3 + 0.12 * breath + 0.2 * RG.flare;
  // the heat haze rolling off his body (refreshed so it never pops)
  RG.hazeT -= dt;
  if (RG.hazeT <= 0) { RG.hazeT = 0.9; RG.haze = FX2.distort.heat(V3(0, 2.8, 0), 5.5, 0.0055, 1.25, P.pos); }
  // the swords burn: veins and runes pulse, flames lick up the blades, embers stream off the tips, a ribbon of fire follows each edge
  const now = Game.time;
  for (const [i, k] of [[0, 'swordR'], [1, 'swordL']]) {
    const sw = R.rig.props[k]; if (!sw) continue;
    const u = sw.userData;
    const pulse = 0.5 + 0.5 * Math.sin(RG.t * 7.3 + i * 1.9) * Math.sin(RG.t * 3.1 + i);
    if (u.bladeMat) u.bladeMat.emissiveIntensity = (1.3 + 0.9 * pulse) * Math.min(2.2, RG.heat) + RG.flare * 0.8;
    if (u.edgeMat) u.edgeMat.opacity = Math.min(1, 0.55 + 0.25 * pulse + 0.2 * RG.heat);
    if (u.glow) u.glow.material.opacity = 0.35 + 0.25 * pulse + 0.15 * RG.heat;
    const rb = R.ribbons && R.ribbons[i];
    const speed = rb ? rb.push(now, swinging ? 1 : 0) : 0;
    // flames lick UP the blade (rising, no swirl); more while the blade is still, they stream off it in a swing
    const rate = speed > 6 ? 14 : 34;
    if (Math.random() < dt * rate) { const p = sw.localToWorld(_c1.lerpVectors(u.base, u.tip, Math.random() ** 0.7)); FX2.fire.spawn({ pos: p, vel: V3(rand(-0.2, 0.2), rand(1.0, 2.2), rand(-0.2, 0.2)), life: rand(0.25, 0.45), size: rand(0.28, 0.5), sizeEnd: 0.06, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.4, int: 1.3 }); }
    if (Math.random() < dt * 22) FX2.glow.spawn({ pos: sw.localToWorld(_c1.lerpVectors(u.base, u.tip, rand(0.5, 1))), vel: V3(rand(-0.5, 0.5), rand(0.6, 1.8), rand(-0.5, 0.5)), life: rand(0.5, 0.9), size: rand(0.04, 0.08), sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.9, turb: 1.5 });
    if (Math.random() < dt * 4) FX2.smoke.spawn({ pos: sw.localToWorld(_c1.lerpVectors(u.base, u.tip, rand(0.3, 1))), vel: V3(rand(-0.2, 0.2), rand(0.6, 1.2), rand(-0.2, 0.2)), life: rand(0.8, 1.2), size: 0.25, sizeEnd: 0.9, frames: 16, pal: 'cfire', temp: 0.3, tempEnd: 0, int: 1, alpha: 0.4, drag: 1.2, turb: 0.4 });
  }
  // smoke and steam venting from the cracks in his body, embers spitting out (no swirl: it just rises)
  RG.ventT -= dt;
  if (RG.ventT <= 0) {
    RG.ventT = rand(0.06, 0.13);
    const b = R.rig.b(pick(['Spine02', 'Spine01', 'Spine', 'Head', 'LeftArm', 'RightArm']));
    const p = b.getWorldPosition(_c2).add(_c3.set(rand(-0.6, 0.6), rand(-0.3, 0.5), rand(-0.6, 0.6)));
    FX2.smoke.spawn({ pos: p, vel: V3(rand(-0.3, 0.3), rand(0.9, 1.8), rand(-0.3, 0.3)), life: rand(0.9, 1.4), size: 0.35, sizeEnd: rand(1.2, 1.8), frames: 16, pal: 'cfire', temp: 0.45, tempEnd: 0, int: 1.1, alpha: 0.5, drag: 1.4, turb: 0.6, fadeIn: 0.05 });
    if (Math.random() < 0.6) FX2.glow.spawn({ pos: p, vel: V3(rand(-0.4, 0.4), rand(0.6, 1.6), rand(-0.4, 0.4)), life: rand(0.5, 0.9), size: 0.05, sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.8 });
  }
  // his blazing eyes spit sparks
  if (Math.random() < dt * 6 && R.rig.eyes.length) { const e = pick(R.rig.eyes); FX2.glow.spawn({ pos: e.getWorldPosition(_c2), vel: V3(rand(-0.6, 0.6), rand(0.5, 1.5), rand(-0.6, 0.6)), life: rand(0.3, 0.6), size: 0.06, sizeEnd: 0.01, cell: FXA.spark, stretch: 1.5, pal: 'cfire', temp: 1.2, tempEnd: 0.5, int: 2 }); }
  if (Math.random() < dt * 5) cmCrumbs(_c2.copy(P.pos).setY(rand(2.5, 4.2)), 1, 0.5, 0.3);
}
// the swing: the next link of the chain, timed off the clip
function cmRageSwing() {
  const RG = CM.rage; if (!RG || RG.phase !== 'on') return;
  const R = CM.rageR, A = Game.anim;
  const cd = 1 / attackSpeed();
  if (RG.comboT <= 0) RG.combo = 0;
  const n = RG.combo++;
  let S = CM_CHAIN[n % CM_CHAIN.length];
  if (S.fin) S = CM_FIN[RG.fin++ % CM_FIN.length];
  const def = A.acts && A.acts[S.act];
  if (!def) return;
  // the clip's own anticipation and follow-through, a little faster with attack speed (never rushed)
  const sp = clamp(0.66 / cd, 1, 1.3);
  const real = (ct) => Math.max(0, (ct - def.from) / (def.rate * sp));
  P.atkCd = Math.max(cd, real(S.lock));
  RG.comboT = P.atkCd + 1.2;
  // the swing still playing holds its full weight until this one has faded in over it (its follow-through melts into this
  // swing's anticipation - never a dip back to the idle pose between hits), then fades out underneath
  const prev = A.actions.filter((a) => _swingActs.has(a.name) && a.name !== S.act).pop();   // (only the one on top: older ones end as they were)
  if (prev && A.holdUnder) A.holdUnder(prev, (def.fadeIn || 0.22) * 1.1);
  A.play(S.act, { speed: sp, noFx: true });
  P.atkPenalty = Math.min(0.35, P.atkCd * 0.5);
  const fin = S.kind === 'fin', spin = S.kind === 'spin';
  // whoosh(es) timed to the cut (kept out of the voice duck), a war cry now and then, a roar on the finisher
  for (const h of S.hits) Sound.god(`sword_swing${1 + ((n + (h.side === 'L' ? 1 : 0)) % 3)}`, { gain: fin ? 1.1 : 0.95, rate: fin ? 0.82 : spin ? 0.9 : rand(0.95, 1.08), delay: Math.max(0, real(h.at) - 0.16), noDuck: true });
  if (fin) Sound.voice('f_slam', { priority: 4, gain: 1.15, cooldown: 0, delay: Math.max(0, real(S.hits[S.hits.length - 1].at) - 0.45) });
  else Sound.voice('f_cry', { chance: 0.4, cooldown: 1.2, priority: 2, delay: Math.max(0, real(S.hits[0].at) - 0.3) });
  RG.flare = Math.max(RG.flare, fin ? 0.8 : 0.4);
  for (const h of S.hits) VFX.later(real(h.at), () => cmRageHit(S, h, n));
}
// one strike lands: damage in the cone (or the slam's circle), hit-stop, camera weight, sparks and fire where the blade meets
function cmRageHit(S, h, n) {
  if (Kit !== GODS.cookie || CM.form !== 'rage' || !CM.rage) return;
  const R = CM.rageR, c = P.pos.clone(), dir = fwdOf(P.yaw), dmg = cmDmg('cr', 'sword', 'swordScale') * h.k;
  const blades = h.side === 'B' ? ['swordR', 'swordL'] : [h.side === 'L' ? 'swordL' : 'swordR'];
  const tips = blades.map((k) => { const sw = R && R.rig.props[k]; return sw ? sw.localToWorld(sw.userData.tip.clone()) : c.clone().addScaledVector(dir, 3).setY(1); });
  if (h.slam) {   // both blades crash into the floor: a fire shockwave, a scorch, cracks, flying burning chips
    const at = c.clone().addScaledVector(dir, h.fwd || 2.8).setY(0);
    Sound.god('mine_boom', { gain: 0.95, pos: at, rate: 0.78, noDuck: true });
    Game.hitStop(0.11, 0.06); Cam.shake = Math.max(Cam.shake, S.shake); Cam.fovKick = 7;
    PostFX.shock(at.clone().setY(0.5), 0.9, 0.6);
    FX2.impact(at, 'cfire', { size: 1.5, ring: CM_RAGE.slamR3 / 1.5 + 0.6, sparks: 60, debris: 16, dustPal: 'choco', dustGlow: 0.18, int: 0.9, glowRocks: true, scorchDur: 4.5 });
    FX2.ring(at, 'cfire', { radius: CM_RAGE.slamR3 + 2.5, dur: 0.55, width: 0.08, int: 1.1 });
    FX2.scorch(at, 'cfire', { radius: 3.0, dur: 5.5, int: 1.3, dark: new THREE.Color(0.12, 0.04, 0.015), darkAlpha: 0.7 });
    for (const tp of tips) { const g = tp.clone().setY(0); FX2.scorch(g, 'cfire', { radius: 1.2, dur: 3.5, int: 1.5 }); FX2.burst(g.setY(0.4), 'cfire', { size: 0.7, sparks: 24, embers: 14, puffs: 1, bursts: 1, light: false, distort: false }); }
    for (let i = 0; i < 26; i++) { const a = rand(0, TAU), sp2 = rand(5, 9); FX2.fire.spawn({ pos: V3(at.x + Math.cos(a) * 0.5, 0.3, at.z + Math.sin(a) * 0.5), vel: V3(Math.cos(a) * sp2, rand(0.5, 2), Math.sin(a) * sp2), life: rand(0.35, 0.6), size: rand(0.5, 0.9), sizeEnd: 0.15, frames: 16, pal: 'cfire', temp: 1, tempEnd: 0.3, int: 1.2, drag: 2.8 }); }
    VFX.cracks(at, CM_RAGE.slamR3 * 0.85, 2.8, { grow: 0.12, intensity: 1.5, color: CMC.fire });
    cmCrumbs(at.clone().setY(0.3), 28, 1.3); cmChips(at.clone().setY(0.4), 14, 1.3);
    for (const d of dummiesNear(at, CM_RAGE.slamR3)) { Combat.deal(d, dmg, 'ability', 'Cookie Rage'); cmKnockUp(d, 0.4, 0.75); cmBurningHit(d, 0.85, tips[0]); }
    if (CM.rage) { CM.rage.flare = 1; CM.rage.thud = 1; }
    return;
  }
  const hits = dummiesInCone(c, dir, S.reach, S.arc);
  // a blade that reaches the floor leaves a burning gash
  for (const tp of tips) if (tp.y < 0.9) { const g = tp.clone().setY(0); FX2.scorch(g, 'cfire', { radius: 0.9, dur: 2.5, int: 1.4 }); for (let i = 0; i < 6; i++) FX2.glow.spawn({ pos: g.clone().setY(0.1), vel: V3(rand(-2, 2), rand(2, 4), rand(-2, 2)), life: rand(0.4, 0.7), size: 0.06, sizeEnd: 0.01, cell: FXA.spark, stretch: 2, pal: 'cfire', temp: 1.2, tempEnd: 0.5, int: 2, gravity: -8 }); }
  Cam.shake = Math.max(Cam.shake, (hits.length ? S.shake : S.shake * 0.5));
  if (hits.length) Game.hitStop(S.kind === 'spin' ? 0.085 : 0.065, 0.07);
  for (const d of hits) { Combat.deal(d, dmg, 'ability', 'Cookie Rage'); cmBurningHit(d, S.kind === 'spin' ? 0.75 : 0.55, tips[0]); }
  if (CM.rage) CM.rage.flare = Math.max(CM.rage.flare, hits.length ? 0.9 : 0.4);
}
// a brutal hit: a spray of sparks thrown along the cut, a burst of fire, embers, burning crumbs, a shove
function cmBurningHit(d, s = 0.5, from = null) {
  const hp = d.pos.clone().setY(1.2 + d.lift);
  FX2.burst(hp, 'cfire', { size: s * 0.8, sparks: 18, embers: 12, puffs: 1, bursts: 1, light: s > 0.8, distort: false });
  FX2.ring(d.pos.clone().setY(0), 'cfire', { radius: 1.4 + s, dur: 0.3, width: 0.05, int: 0.8, distort: false });
  const away = _c2.set(d.pos.x - P.pos.x, 0, d.pos.z - P.pos.z).normalize();
  for (let i = 0; i < 16; i++) FX2.glow.spawn({ pos: hp, vel: V3(away.x * rand(4, 10) + rand(-2.5, 2.5), rand(0.5, 4.5), away.z * rand(4, 10) + rand(-2.5, 2.5)), life: rand(0.25, 0.55), size: rand(0.05, 0.1), sizeEnd: 0.02, cell: FXA.spark, stretch: 3, pal: 'cfire', temp: 1.25, tempEnd: 0.5, int: 2.2, drag: 1.5, gravity: -9 });
  for (let i = 0; i < 8; i++) FX2.glow.spawn({ pos: hp, vel: V3(rand(-3, 3), rand(1, 4), rand(-3, 3)), life: rand(0.5, 0.9), size: rand(0.05, 0.09), sizeEnd: 0.02, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.8, gravity: -9, drag: 0.6, floor: true });
  cmCrumbs(hp, 8, 0.7);
  const out = _c1.set(d.pos.x - P.pos.x, 0, d.pos.z - P.pos.z), L = out.length() || 1; d.shove(out.multiplyScalar(0.5 / L), 1.2);
  Sound.god('sword_hit', { gain: 0.9, pos: d.pos, rate: rand(0.88, 1.02), noDuck: true });
}
// A ribbon of fire that follows a blade: every frame the blade (from part-way up to the tip) is sampled in world space; the
// strip between samples is a Catmull-Rom spline subdivided by how far the tip travelled, so a fast swing still draws a smooth
// arc (no facets). Additive, a fire ramp: white-hot at the fresh tip edge, orange, then deep red as it ages and fades. Samples
// carry a power (on while a swing plays and the blade moves fast), so the trail appears only for real cuts.
const CMR_VS = `attribute vec2 aUv; attribute float aP; varying vec2 vUv; varying float vP; void main() { vUv = aUv; vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CMR_FS = FX2_RAMP + `
  uniform sampler2D uNoise; uniform vec3 uE, uM, uC; uniform float uTime, uInt; varying vec2 vUv; varying float vP;
  void main() {
    float age = clamp(vUv.x, 0.0, 1.0), across = clamp(vUv.y, 0.0, 1.0);
    float n = texture2D(uNoise, vec2(vUv.x * 1.6 - uTime * 1.7, across * 0.9 + uTime * 0.25)).r;
    float n2 = texture2D(uNoise, vec2(vUv.x * 4.0 - uTime * 3.1, across * 2.3)).g;
    float fresh = 1.0 - age;
    float body = smoothstep(0.0, 0.3, across) * (1.0 - smoothstep(0.94, 1.0, across));
    float flame = smoothstep(0.2 + 0.65 * age, 1.0, across + (n - 0.5) * 0.55);   // ragged tongues of fire, burning off from the inner edge as it ages
    float a = vP * body * fresh * (0.07 + 0.93 * flame * pow(across, 1.4)) * (0.55 + 0.8 * n2);
    float heat = fresh * fresh * (0.15 + 0.62 * across) * (0.75 + 0.45 * n);
    vec3 col = ramp3(uE, uM, uC, heat);
    col += uC * smoothstep(0.86, 0.99, across) * pow(fresh, 4.0) * 0.9 * vP;   // the white-hot line the edge leaves
    gl_FragColor = vec4(col * a * uInt, 0.0);
  }`;
class CMRibbon {
  constructor(sword, o = {}) {
    this.sword = sword; this.life = o.life ?? 0.2; this.max = 128; this.s = []; this.pw = 0; this.lastTip = new THREE.Vector3(); this.has = false;
    const N = this.max, g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 2 * 3); this.uv = new Float32Array(N * 2 * 2); this.pa = new Float32Array(N * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aUv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aP', new THREE.BufferAttribute(this.pa, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); g.setDrawRange(0, 0);
    this.geo = g;
    const P2 = FX2.pal('cfire');
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uE: { value: P2.edge.clone() }, uM: { value: P2.mid.clone() }, uC: { value: new THREE.Color(1.0, 0.7, 0.34) }, uNoise: { value: FX2.tex && FX2.tex.noise }, uTime: { value: 0 }, uInt: { value: 1.25 } },
      vertexShader: CMR_VS, fragmentShader: CMR_FS });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 11; scene.add(this.mesh);
  }
  reset() { this.s.length = 0; this.has = false; this.geo.setDrawRange(0, 0); }
  dispose() { this.reset(); this.mesh.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }   // (another player's rage form gone: 14n_net.js)
  // sample the blade now; returns the tip speed (m/s)
  push(now, armed) {
    const sw = this.sword, u = sw.userData;
    if (!sw.parent || !sw.visible) { this.reset(); return 0; }
    sw.updateWorldMatrix(true, false);
    const tip = sw.localToWorld(new THREE.Vector3().copy(u.tip)), base = sw.localToWorld(new THREE.Vector3().lerpVectors(u.base, u.tip, 0.38));
    const last = this.s[0], dtS = last ? Math.max(1e-4, now - last.time) : 1;
    let speed = last ? tip.distanceTo(last.t) / dtS : 0;
    if (last && tip.distanceTo(last.t) > 8) { this.reset(); speed = 0; }   // (a form swap or a teleport: start over)
    this.pw = damp(this.pw, armed ? smoothstep(5, 15, speed) : 0, armed ? 25 : 10, Math.min(0.05, dtS));
    if (!last || now - last.time > 1e-4) this.s.unshift({ b: base, t: tip, time: now, p: this.pw });
    while (this.s.length > 2 && now - this.s[this.s.length - 1].time > this.life) this.s.pop();
    if (this.s.length > 40) this.s.length = 40;
    this.build(now);
    // embers and licks of flame shed from the fresh edge of a cut
    if (this.pw > 0.3 && last) {
      for (let i = 0; i < 2; i++) { const k = Math.random(); const p = _c5.lerpVectors(base, tip, 0.4 + 0.6 * k); FX2.glow.spawn({ pos: p, vel: V3(rand(-1, 1), rand(0.5, 2.5), rand(-1, 1)), life: rand(0.3, 0.6), size: rand(0.04, 0.08), sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.15, tempEnd: 0.5, int: 2, drag: 1.2, turb: 2 }); }
      if (Math.random() < 0.6) FX2.fire.spawn({ pos: tip, vel: V3(rand(-0.3, 0.3), rand(0.5, 1.2), rand(-0.3, 0.3)), life: rand(0.18, 0.32), size: rand(0.35, 0.6), sizeEnd: 0.08, frames: 16, pal: 'cfire', temp: 1, tempEnd: 0.4, int: 1.2 });
    }
    this.mat.uniforms.uTime.value = now;
    return speed;
  }
  build(now) {
    const S = this.s, N = this.max, cr = (p0, p1, p2, p3, u, out) => { const u2 = u * u, u3 = u2 * u;
      return out.set(0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3)); };
    let w = 0, any = false;
    const put = (b, t, time, p) => { if (w >= N) return; const age = (now - time) / this.life; this.pos.set([b.x, b.y, b.z, t.x, t.y, t.z], w * 6); this.uv.set([age, 0, age, 1], w * 4); this.pa[w * 2] = this.pa[w * 2 + 1] = p; if (p > 0.01) any = true; w++; };
    for (let i = 0; i < S.length - 1 && w < N; i++) {
      const a = S[i - 1] || S[i], b = S[i], c = S[i + 1], d = S[i + 2] || S[i + 1];
      const steps = clamp(Math.ceil(b.t.distanceTo(c.t) / 0.18), 1, 12);
      for (let j = 0; j < steps && w < N; j++) {
        const u = j / steps;
        put(cr(a.b, b.b, c.b, d.b, u, _cr1), cr(a.t, b.t, c.t, d.t, u, _cr2), lerp(b.time, c.time, u), lerp(b.p, c.p, u));
      }
    }
    if (S.length) { const L = S[S.length - 1]; put(L.b, L.t, L.time, 0); }
    this.has = any && w > 1;
    this.geo.setDrawRange(0, this.has ? (w - 1) * 6 : 0);
    if (this.has) { for (const k of ['position', 'aUv', 'aP']) this.geo.attributes[k].needsUpdate = true; }
  }
}
const _cr1 = new THREE.Vector3(), _cr2 = new THREE.Vector3();

// ---- G · Cookie Horror ------------------------------------------------------------------------------
// The target picker: in the Arena the enemy gods (anywhere on the map: bots, and online the other team's players), in the
// Practice Room the targets around.
function cmTargets() {
  if (typeof Arena !== 'undefined' && Arena.active) return Combat.dummies.filter((u) => (u.kind === 'god' || u.isGod) && u.alive && !u.gone).sort((a, b) => a.pos.distanceToSquared(P.pos) - b.pos.distanceToSquared(P.pos)).slice(0, 5);
  const D = Combat.dummies.filter((d) => d.alive);
  const gods = D.filter((d) => d.isGod), rest = D.filter((d) => !d.isGod).sort((a, b) => a.pos.distanceToSquared(P.pos) - b.pos.distanceToSquared(P.pos));
  return [...gods, ...rest].slice(0, 5);
}
function cmPickerOpen() {
  if (Net.ctx) return;   // (another player's replayed G: the victim comes as its own event, K)
  const list = cmTargets();
  if (!list.length) { HUD.warn('No targets'); Sound.deny(); return; }
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(ellipse at center, rgba(40,6,2,0.55), rgba(0,0,0,0.85));pointer-events:auto;font-family:Rajdhani,system-ui,sans-serif';
  el.innerHTML = `<div style="color:#ffb35a;font:800 30px Rajdhani,system-ui;letter-spacing:.2em;text-shadow:0 0 18px #ff4a10">COOKIE HORROR</div><div style="color:#e8c8a8;font-size:15px;letter-spacing:.08em">Choose the victim · press 1–${list.length} or click · left-click = selected · right-click / Esc = cancel</div><div class="cmrow" style="display:flex;gap:14px"></div>`;
  const row = el.querySelector('.cmrow');
  CM.pick = { el, list, sel: 0, cards: [] };
  list.forEach((d, i) => {
    const kit = d.god && GODS[d.god];
    const c = document.createElement('button'); c.type = 'button';
    c.style.cssText = `width:132px;padding:14px 8px 12px;border:2px solid rgba(255,140,60,.35);background:linear-gradient(180deg,rgba(60,18,6,.95),rgba(16,4,2,.95));color:#fff;cursor:pointer;display:grid;gap:6px;justify-items:center;font:700 16px Rajdhani,system-ui`;
    c.innerHTML = `<span style="font-size:40px;line-height:1;color:${kit ? kit.color : '#ffb35a'};text-shadow:0 0 14px ${kit ? kit.color : '#ff6a20'}">${kit ? kit.glyphs.split(' ')[0] : (d.isGod ? '𓃢' : d.isMummy ? '☥' : '𓀾')}</span><b>${kit ? kit.name : d.name}</b>${d.isRemotePlayer ? `<small style="color:#ffd9b0">${cmEsc(d.nick)}</small>` : ''}<small style="color:#d0a080">${i + 1} · ${Math.round(d.pos.distanceTo(P.pos))} m</small>`;
    c.addEventListener('click', (e) => { e.stopPropagation(); cmPickerChoose(i); });
    row.appendChild(c); CM.pick.cards.push(c);
  });
  document.body.appendChild(el);
  CM.pick.onKey = (e) => { if (e.code === 'Escape') { cmPickerClose(); Sound.cancel(); } };
  addEventListener('keydown', CM.pick.onKey, true);
  cmPickerMark();
  Sound.arm();
}
function cmPickerMark() { const K = CM.pick; if (!K) return; K.cards.forEach((c, i) => { c.style.borderColor = i === K.sel ? '#ff7a20' : 'rgba(255,140,60,.35)'; c.style.boxShadow = i === K.sel ? '0 0 22px rgba(255,90,20,.7)' : 'none'; c.style.transform = i === K.sel ? 'translateY(-4px)' : 'none'; }); }
function cmPickerClose() { if (CM.pick) { removeEventListener('keydown', CM.pick.onKey, true); CM.pick.el.remove(); CM.pick = null; } }
function cmPickerChoose(i) {
  const K = CM.pick; if (!K) return;
  const d = K.list[i]; cmPickerClose();
  if (!d || !d.alive) { HUD.warn('The target is gone'); return; }
  if (!canCast('ch')) return;
  spend('ch'); startCd('ch');
  cmHorrorStart(d);
  Net.cast('K', 'ch', Net.idOf(d));   // (online: every page plays it around the victim, and a human victim lives it on its own screen)
}
const cmEsc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function cmPickerInput() {
  const K = CM.pick; if (!K) return;
  for (let i = 0; i < K.list.length; i++) if (input.pressed.has('Digit' + (i + 1)) || input.pressed.has('Numpad' + (i + 1))) { cmPickerChoose(i); return; }
  if (input.mdx) { K.acc = (K.acc || 0) + input.mdx; if (Math.abs(K.acc) > 90) { K.sel = (K.sel + Math.sign(K.acc) + K.list.length) % K.list.length; K.acc = 0; cmPickerMark(); } }
  if (input.wheel) { K.sel = (K.sel + Math.sign(input.wheel) + K.list.length) % K.list.length; cmPickerMark(); }
  if (input.lmbPressed) { cmPickerChoose(K.sel); return; }
  if (input.rmbPressed || input.pressed.has('Escape')) { cmPickerClose(); Sound.cancel(); }
}
// The victim's screen: the overlay that plays the snow, the glitch, the screamer and the silence. Runs on the LOCAL
// screen; in single player / Arena the caster watches it as a cinematic (the camera also cuts to the victim's POV).
function cmScreamImg() {
  if (!CM.screamImg) { const im = new Image(); im.decoding = 'async'; im.src = 'assets/fx/cookie_screamer.webp'; CM.screamImg = im; }
  return CM.screamImg;
}
function cookieHorrorScreen(target, o = {}) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:55;pointer-events:none;overflow:hidden';
  const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  el.appendChild(cv); document.body.appendChild(el);
  const img = cmScreamImg();
  const flakes = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * -1, v: rand(0.06, 0.18), s: rand(2, 7), r: rand(0, TAU), w: rand(-1.5, 1.5), c: Math.random() < 0.7 ? [196, 128, 58] : [72, 34, 12] }));
  const S = { t: 0, el, cv, ctx: cv.getContext('2d'), flakes, done: false, glitchT: 0, slices: [] };
  S.update = (dt) => {
    S.t += dt;
    const W = cv.width = Math.round(innerWidth * 0.5), H = cv.height = Math.round(innerHeight * 0.5), g = S.ctx, t = S.t;
    g.clearRect(0, 0, W, H);
    // 1. cookie crumbs falling like snow down the screen (and a dark, creeping vignette)
    const vig = smoothstep(0, 1.2, t) * (t < CM_HORROR.scream ? 1 : 0);
    if (vig > 0) { const gr = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(20,2,0,${0.75 * vig})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (t < CM_HORROR.scream) for (const f of S.flakes) {
      f.y += f.v * dt; f.x += Math.sin(t * 1.3 + f.r) * 0.01 * dt; f.r += f.w * dt;
      if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); }
      if (f.y < 0) continue;
      g.save(); g.translate(f.x * W, f.y * H); g.rotate(f.r); g.fillStyle = `rgba(${f.c[0]},${f.c[1]},${f.c[2]},${0.85 * smoothstep(0, 0.6, t)})`;
      g.beginPath(); g.moveTo(-f.s, -f.s * 0.6); g.lineTo(f.s * 0.8, -f.s * 0.8); g.lineTo(f.s, f.s * 0.5); g.lineTo(-f.s * 0.5, f.s); g.closePath(); g.fill(); g.restore();
    }
    // 2. the glitch: the screamer bleeds through in torn, offset horizontal slices (RGB-split via the post pass);
    //    slices change ~10x a second but the overall brightness only rises - no full-screen flashes
    if (t >= CM_HORROR.glitch && t < CM_HORROR.scream && img.complete && img.naturalWidth) {
      const k = (t - CM_HORROR.glitch) / (CM_HORROR.scream - CM_HORROR.glitch);
      S.glitchT -= dt;
      if (S.glitchT <= 0) { S.glitchT = 0.1; S.slices = Array.from({ length: 6 + Math.round(10 * k) }, () => ({ y: Math.random(), h: rand(0.01, 0.07), dx: rand(-0.08, 0.08), a: rand(0.25, 0.6) * (0.3 + k) })); }
      const iw = img.naturalWidth, ih = img.naturalHeight, sz = Math.max(W, H);
      for (const s of S.slices) { g.globalAlpha = Math.min(0.9, s.a); g.drawImage(img, 0, s.y * ih, iw, s.h * ih, (W - sz) / 2 + s.dx * W, (H - sz) / 2 + s.y * sz, sz, s.h * sz); }
      g.globalAlpha = 1;
      cmMyView(() => { PostFX.aberr = Math.max(PostFX.aberr, 0.004 + 0.012 * k); });   // (the victim's own screen, online: Net.bare)
    }
    // 3. the SCREAMER: the cookie face fills the screen, lunging closer, shaking
    if (t >= CM_HORROR.scream && t < CM_HORROR.silence && img.complete && img.naturalWidth) {
      const k = (t - CM_HORROR.scream) / (CM_HORROR.silence - CM_HORROR.scream), sz = Math.max(W, H) * (1.05 + 0.25 * easeOutCubic(Math.min(1, k * 3))), sh = 6 * (1 - k * 0.5);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.drawImage(img, (W - sz) / 2 + rand(-sh, sh), (H - sz) / 2 + rand(-sh, sh), sz, sz);
      if (k < 0.4) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25; g.drawImage(img, (W - sz) / 2 + 8, (H - sz) / 2, sz, sz); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }   // a red/orange ghost offset
    }
    // 4. the silence: black
    if (t >= CM_HORROR.silence && t < CM_HORROR.tele + 0.1) { g.fillStyle = `rgba(0,0,0,${1 - smoothstep(CM_HORROR.tele - 0.05, CM_HORROR.tele + 0.1, t)})`; g.fillRect(0, 0, W, H); }
    if (t > CM_HORROR.tele + 0.15) { S.done = true; el.remove(); }
  };
  S.dispose = () => { S.done = true; el.remove(); };
  return S;
}
// total silence: the master bus fades out and comes back
function cmSilence(on) {
  const m = Sound.master, c = Sound.ctx; if (!m || !c) return;
  m.gain.cancelScheduledValues(c.currentTime);
  m.gain.setTargetAtTime(on ? 0 : (Sound.muted ? 0 : settings.volume), c.currentTime, on ? 0.03 : 0.01);
}
// ---- Cookie Horror online (14n_net.js). The caster's page plays it as in single player (his cinematic, the real blow,
// sent to the victim's owner). Every other page replays it in the caster's sandbox (Net.ctx): the world around the
// victim (the snow, the teleport, the clap). A human VICTIM's own page lives it on its own screen too (H.mine): the
// screen overlay (cookie snow, the glitch, the screamer, the black), the horror music and his whisper in its head, the
// total silence, then the clap's boom, shake and flash. The sandbox puts my camera, screen and music back on the way
// out, so what the victim's screen gets goes through cmMyView (Net.bare: outside the sandbox, for real). Observers never
// get any of it on their screens; near the victim they hear the music and stings where it stands.
function cmMyView(fn) { return Net.ctx ? Net.bare(fn) : fn(); }
function cmHSfx(H, name, o = {}) {
  if (!Net.ctx) return Sound.god(name, o);
  const buf = o.shared ? Sound.sfx[name] : Sound.gsfx[name] || Sound.sfx[name];   // (the caster's bank, swapped in)
  if (!buf) return null;
  const h = H.mine ? Sound.playBuf(buf, { gain: o.gain ?? 1, rate: o.rate, loop: o.loop, bus: o.noDuck ? Sound.boomBus : undefined })
    : Sound.playBuf(buf, { gain: (o.gain ?? 1) * 0.7, rate: o.rate, loop: o.loop, pos: H.d.pos, falloff: 10, maxDist: 40 });
  if (h && o.loop) (Net.ctx.sounds || (Net.ctx.sounds = [])).push(h);   // (stopped with his kit: Net.dropCtx)
  return h;
}
function cmHVoice(H, group, o = {}) {
  if (!Net.ctx || !H.mine) return Sound.voice(group, o);   // (an observer: his voice where he stands, Net.voice)
  const opts = (Sound.lines[group] || []).filter((n) => Sound.vox[voiceFile(n)]); if (!opts.length) return false;
  const n = pick(opts), sl = voiceSlice(n);
  return !!Sound.playBuf(Sound.vox[voiceFile(n)], { gain: o.gain ?? 1, bus: Sound.voiceBus, off: sl ? sl.off : 0, len: sl ? sl.dur : 0 });
}
// (a replay: the particles around the victim as dense as it is near me - all of them on the victim's own page - whatever
// the caster's own distance or cover)
function cmHorrorFx(H, fn) {
  const c = Net.ctx; if (!c) return fn();
  const k = c.fxK; c.fxK = H.mine || camera.position.distanceTo(H.d.pos) < 45 ? 1 : 0.3;
  try { return fn(); } finally { c.fxK = k; }
}
function cmHorrorStart(d) {
  if (CM.form === 'roll') cmRollOut();
  const mine = !Net.ctx || !!(d.real && d.real.isSelf);   // (my own cast, or me the victim of another player's)
  const H = CM.horror = { t: 0, d, mine, screen: mine ? cookieHorrorScreen(d) : null, snowAcc: 0, stage: 0, done: false, clap: 0, home: P.pos.clone() };
  H.music = cmHSfx(H, 'horror_music', { gain: 0.9, loop: true });
  VFX.later(0.4, () => cmHVoice(H, 'g_horror_whisper', { priority: 5, cooldown: 0 }));
  if (mine) cmMyView(() => { Sound.duckMusic(0.05, CM_HORROR.boom + 1, 1.5); WORLD.dim = 0.6; PostFX.vigTarget = 0.6; });
  cmScreamImg();
}
function cmUpdateHorror(dt, t) {
  const H = CM.horror; if (!H) return;
  cmHorrorFx(H, () => cmHorrorTick(H, dt, t));
}
function cmHorrorTick(H, dt, t) {
  H.t += dt;
  const d = H.d, T = H.t;
  if (H.screen && !H.screen.done) H.screen.update(dt);
  // cookie crumbs fall like snow around the victim
  if (T < CM_HORROR.silence) {
    H.snowAcc += dt * 70;
    while (H.snowAcc > 1) { H.snowAcc--; const a = rand(0, TAU), r = 5 * Math.sqrt(Math.random()); FX2.solid.spawn({ pos: V3(d.pos.x + Math.cos(a) * r, rand(3, 5), d.pos.z + Math.sin(a) * r), vel: V3(rand(-0.3, 0.3), -rand(0.6, 1.2), rand(-0.3, 0.3)), life: rand(3, 4.5), size: rand(0.04, 0.09), sizeEnd: 0.04, cell: FXA.rock, pal: Math.random() < 0.7 ? 'cookie' : 'choco', temp: 0, tempEnd: 0, alpha: 1, turb: 0.6, floor: true, rotVel: rand(-3, 3) }); }
  }
  if (H.stage === 0 && T >= CM_HORROR.glitch) { H.stage = 1; cmHSfx(H, 'glitch', { gain: 0.9 }); }
  if (H.stage === 1 && T >= CM_HORROR.scream) { H.stage = 2; cmHSfx(H, 'scream_sting', { gain: 1.2, noDuck: true }); cmHVoice(H, 'g_scream', { priority: 6, gain: 1.3, cooldown: 0, hold: 2.0 }); if (H.music) H.music.stop(0.1); }
  if (H.stage === 2 && T >= CM_HORROR.silence) { H.stage = 3; if (H.mine) { cmSilence(true); H.silent = true; } }   // (only the screens that live it go silent)
  if (H.stage === 3 && T >= CM_HORROR.tele) {
    H.stage = 4; if (H.silent) { cmSilence(false); H.silent = false; }
    // he is simply THERE: right in front of the victim, facing it
    const f = (d.facing !== undefined) ? fwdOf(d.facing, _c1) : _c1.set(P.pos.x - d.pos.x, 0, P.pos.z - d.pos.z).normalize();
    const dist = (d.radius || 0.5) + 1.5;
    P.pos.set(d.pos.x + f.x * dist, 0, d.pos.z + f.z * dist); P.vel.set(0, 0, 0);
    P.yaw = Math.atan2(d.pos.x - P.pos.x, d.pos.z - P.pos.z); Game.thoth.root.rotation.y = P.yaw;
    if (!Net.ctx) Cam.yaw = P.yaw;   // (my camera only behind my own god)
    cmHSfx(H, 'teleport', { gain: 1.0 });
    cmBurst(P.pos.clone().setY(1.4), 0.7, { pal: 'horror', distort: true });
    Game.anim.play('clapwind');
    if (H.mine) cmMyView(() => { WORLD.dim = 0.8; PostFX.vigTarget = 0.3; });
  }
  if (H.stage === 4) H.clap = clamp((T - CM_HORROR.tele) / (CM_HORROR.boom - CM_HORROR.tele), 0, 1);
  // the slow motion: it eases in as the hands come together, holds through the BOOM, eases back out (real seconds)
  // (a replay's hit-stop never reaches my world: Game.hitStop and the sandbox; the victim's own game never slows)
  if (H.stage >= 4 && !H.slowDone && T >= CM_HORROR.boom - CM_HORROR.slow.lead) cmHorrorSlow(H, dt);
  if (H.stage === 4 && T >= CM_HORROR.boom) { H.stage = 5; cmHorrorBoom(H); }
  if (H.stage === 5 && T >= CM_HORROR.end && H.slowDone) { H.done = true; CM.horror = null; if (H.mine) cmMyView(() => { WORLD.dim = 1; PostFX.vigTarget = 0; }); }
}
function cmHorrorSlow(H, dt) {
  const S = CM_HORROR.slow;
  H.slowR = (H.slowR ?? 0) + dt / (H.slowK || 1);   // (this frame ran at the scale set last frame: back to real seconds)
  const r = H.slowR, tot = S.in + S.hold + S.out;
  const k = r < S.in ? smoothstep(0, S.in, r) : r < S.in + S.hold ? 1 : 1 - smoothstep(S.in + S.hold, tot, r);
  H.slowK = Net.ctx ? 1 : lerp(1, S.scale, k);
  if (r >= tot) { H.slowDone = true; H.slowK = 1; if (!Net.ctx) { Game.stopT = 0; Game.stopScale = 1; } return; }
  if (!Net.ctx) { Game.stopT = 0.05; Game.stopScale = H.slowK; }
}
function cmHorrorBoom(H) {
  const d = H.d, c = P.pos.clone().lerp(d.pos, 0.5).setY(0), hands = P.pos.clone().addScaledVector(fwdOf(P.yaw, _c1), 0.8).setY(2.0);
  cmHSfx(H, 'clap_boom', { gain: 1.5, noDuck: true, rate: 0.78 });   // (pitched down for the slow motion; its own long echo)
  cmHSfx(H, 'sonic_boom', { gain: 0.6, shared: true, noDuck: true, rate: 0.7 });
  VFX.later(0.6, () => cmHVoice(H, 'g_clap_line', { priority: 5, cooldown: 0 }));
  // (one warm flash and a shake: on my screen if I cast it or am its victim)
  if (H.mine) cmMyView(() => { Cam.shake = 1.5; Cam.fovKick = 14; PostFX.shock(hands, 1.6, 1.0); PostFX.aberr = 0.006; });
  VFX.flash(hands, CMC.caramel, 34, 0.5);
  FX2.burst(hands, 'cookie', { size: 1.8, sparks: 70, embers: 40, puffs: 8, bursts: 2, int: 0.7, smokeGlow: 0.3 });
  FX2.burst(hands, 'horror', { size: 1.1, sparks: 30, embers: 20, puffs: 0, bursts: 1, int: 0.6, light: false, distort: false });
  FX2.ring(c, 'cookie', { radius: 9, dur: 0.6, width: 0.09, int: 1.2 });
  VFX.later(0.1, () => FX2.ring(c, 'choco', { radius: 16, dur: 0.9, width: 0.06 }));
  VFX.later(0.22, () => FX2.ring(c, 'horror', { radius: 26, dur: 1.2, width: 0.04, int: 1.0 }));   // the BOOM rolls across the whole hall
  FX2.distort.ring(hands, 40, 0.045, 0.9);
  FX2.debris(c.clone().setY(0.4), null, 24, 1.4, FX2.pal('cookie'));
  cmChips(hands, 30, 1.6); cmCrumbs(hands, 60, 1.8);
  for (let i = 0; i < 40; i++) { _c2.set(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize(); FX2.solid.spawn({ pos: hands, vel: _c2.clone().multiplyScalar(rand(4, 12)), life: rand(1.2, 2.0), size: rand(0.06, 0.13), sizeEnd: 0.05, cell: FXA.rock, pal: Math.random() < 0.6 ? 'cookie' : 'choco', temp: 0, tempEnd: 0, alpha: 1, gravity: -6, drag: 1.2, floor: true, rotVel: rand(-6, 6) }); }
  FX2.scorch(c, 'cookie', { radius: 4, dur: 5, int: 0.6, dark: new THREE.Color(0.15, 0.06, 0.02), darkAlpha: 0.65 });
  // the victim takes the highest single hit in the game; anyone close by is blown back
  // (online the caster's page deals it, Combat.deal -> its owner; a replay deals nothing)
  if (d.alive) {
    const dmg = cmDmg('ch');
    Combat.deal(d, dmg, 'final', 'Cookie Horror', true);
    cmBurst(d.pos.clone().setY(1.4), 1.0, { pal: 'horror', distort: false });
  }
  for (const u of dummiesNear(c, CM_HORROR.splashR)) {
    if (u === d) continue;
    Combat.deal(u, cmDmg('ch') * CM_HORROR.splash, 'final', 'Cookie Horror');
    const out = _c1.set(u.pos.x - c.x, 0, u.pos.z - c.z), L = out.length() || 1; u.shove(out.multiplyScalar(2.4 / L), 2);
  }
}
// the weight of him: each footfall drives a nod down the spine (decaying), the shoulders roll with the stride
function cmHeavyPost(rig, dt, anim) {
  if (CM.form !== 'normal') return;
  CM.thud = Math.max(0, (CM.thud || 0) - dt * 6);
  const mw = anim.moveW || 0; if (mw < 0.02 && CM.thud < 0.01) return;
  const yaw = rig.root.rotation.y, fwd = _c2.set(Math.sin(yaw), 0, Math.cos(yaw)), right = _c3.set(-Math.cos(yaw), 0, Math.sin(yaw));
  const th = CM.thud * CM.thud, ph = anim.loco ? anim.loco.ph : 0;
  const turn = (bn, axis, a) => { if (Math.abs(a) < 1e-4) return; const b = rig.b(bn); rotateBoneWorld(b, axis, a); b.updateMatrixWorld(true); };
  turn('Spine', right, -0.07 * th * mw);
  turn('Spine02', right, -0.04 * th * mw);
  turn('Head', right, 0.05 * th * mw);
  turn('Spine02', fwd, Math.sin(TAU * ph) * 0.07 * mw);   // the shoulders roll from side to side with the stride
}
function cmFootfall(p) {
  if (CM.form !== 'normal' || !CM.home) return;
  const sp = Math.hypot(P.vel.x, P.vel.z); if (sp < 0.8) return;
  CM.thud = 1;
  const k = smoothstep(1.5, 5.5, sp);
  Cam.shake = Math.max(Cam.shake, 0.05 + 0.1 * k);   // a camera thump that grows with his speed
  cmDust(p, 1 + Math.round(k), 0.5 + 0.3 * k);
  cmCrumbs(_c4.copy(p).setY(0.1), 2 + Math.round(3 * k), 0.4 + 0.3 * k, 0.6);
}
// the clap itself: both arms spread wide and slammed together in front of his chest (two-bone IK over the clip)
function cmClapPost(rig, dt, anim) {
  if (Game.anim !== anim) return;   // (another player's copy of him posed outside his kit's sandbox: his state is not in CM then, 14n_net.js)
  cmHeavyPost(rig, dt, anim);
  const H = CM.horror; if (!H || H.stage < 4) return;
  const k = H.clap, after = H.stage === 5 ? clamp((H.t - CM_HORROR.boom) / 0.6, 0, 1) : 0;
  const w = (H.stage === 5 ? 1 - smoothstep(0.3, 1, after) : 1) * smoothstep(0, 0.1, H.t - CM_HORROR.tele);
  if (w < 0.01) return;
  const yaw = rig.root.rotation.y, fwd = _c2.set(Math.sin(yaw), 0, Math.cos(yaw)), left = _c3.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const chest = _c4.setFromMatrixPosition(rig.b('Spine02').matrixWorld);
  const spread = lerp(1.15, 0.06, Math.pow(k, 2.2)), fwdD = lerp(0.35, 0.75, k), upD = lerp(0.35, 0.05, k);
  for (const [s, arm, fore, hand] of [[1, 'LeftArm', 'LeftForeArm', 'LeftHand'], [-1, 'RightArm', 'RightForeArm', 'RightHand']]) {
    const target = _c1.copy(chest).addScaledVector(left, s * spread).addScaledVector(fwd, fwdD).add(_c5.set(0, upD, 0));
    const pole = new THREE.Vector3().copy(left).multiplyScalar(s).add(_c5.set(0, -0.6, 0)).addScaledVector(fwd, -0.3);
    solveTwoBoneIK(rig.b(arm), rig.b(fore), rig.b(hand), target, pole, w);
  }
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const cmPw = () => ppow();
const COOKIE_INFO = {
  passive: { name: 'Cookie Lover', kind: 'Passive · Heal',
    text: `Every ${CM_EAT.every} seconds Cookie Monster eats a cookie (he keeps walking while he chews) and gets back ${Math.round(CM_EAT.heal * 100)}% of his max health and ${Math.round(CM_EAT.mana * 100)}% of his max mana.`,
    rows: () => [['Next cookie', `${Math.max(0, CM.eatT).toFixed(1)} s`], ['Health', `${Math.round(CM_EAT.heal * 100)}% = ${Math.round(maxHp() * CM_EAT.heal)}`], ['Mana', `${Math.round(CM_EAT.mana * 100)}% = ${Math.round(maxMp() * CM_EAT.mana)}`]] },
  cc: { name: 'Cookie Cannon', kind: 'Line · Piercing · Slow · Physical',
    text: 'He hurls a huge, spinning cookie straight ahead. It tears through EVERYTHING in its path, sprays chocolate chunks and crumbs, and slows everyone it hits.',
    rows: () => { const r = rankOf('cc'); return [['Damage', `${AB.cc.dmg[r - 1]} (+80% of ${cmPw()} power) = ${Math.round(cmDmg('cc'))}`], ['Slow', `${AB.cc.slow * 100}% for ${AB.cc.slowDur} s`], ['Range', `${AB.cc.range}`], ['Cooldown', `${cdOf('cc').toFixed(1)} s`]]; } },
  cf: { name: 'Crumble Form', kind: 'Toggle · Free · Speed',
    text: 'He curls up into a giant rolling cookie wheel: +70% speed, heavy momentum in the turns and a trail of crumbs. No abilities or attacks while he rolls. Free and without cooldown – toggle it on and off whenever you like.',
    rows: () => [['Speed', `+${CM_ROLL.speed * 100}%`], ['Cost', '0 · no cooldown'], ['Now', CM.form === 'roll' ? 'rolling' : 'on foot']] },
  dm: { name: 'Dough Mine', kind: 'Trap · Area · Root · Physical',
    text: `He lobs a cookie-dough bomb onto the ground. It arms after ${CM_MINE.arm} s and goes off in a bubbling caramel-and-chocolate explosion when an enemy steps on it – damage and root. Max ${CM_MINE.max} at a time (the oldest goes off when you place a 6th), lasts ${CM_MINE.life} s.`,
    rows: () => { const r = rankOf('dm'); return [['Damage', `${AB.dm.dmg[r - 1]} (+70%) = ${Math.round(cmDmg('dm'))}`], ['Root', `${CM_MINE.root} s + knock-up`], ['Radius', `${CM_MINE.radius} m`], ['Placed', `${CM.mines.length} / ${CM_MINE.max}`], ['Cooldown', `${cdOf('dm').toFixed(1)} s`]]; } },
  cr: { name: 'Cookie Rage', kind: 'Transformation · Melee · Physical',
    text: `He roars in slow motion – the ground shakes and splits – and explodes in fire and crumbs into a 4.75-metre living cookie with two glowing, molten COOKIE SWORDS for ${CM_RAGE.dur} s. He fights with both swords in one flowing combo (+${CM_RAGE.as * 100}% attack speed, +${CM_RAGE.ms * 100}% speed) and takes a heavy step into every swing: right chop, left chop, a wide sweep, a spinning rising slash – and then a finisher: a spinning leap where both swords crash into the ground, or a double SLAM with a fire shockwave. The lava in his cracks pulses, he roars between combos, and every step sends out a shockwave.`,
    rows: () => { const r = rankOf('cr'), sw = Math.round(cmDmg('cr', 'sword', 'swordScale')); return [['Transformation', `${AB.cr.slam[r - 1]} (+100%) = ${Math.round(cmDmg('cr', 'slam', 'slamScale'))}`], ['Per sword swing', `${AB.cr.sword[r - 1]} (+20%) = ${sw} · chop ×1.25 = ${Math.round(sw * 1.25)}`], ['Combo', `spin slash ×1.8 · leap ×0.8 + ×2.4 · slam ×2.8`], ['Duration', `${CM_RAGE.dur} s`], ['Cooldown', `${cdOf('cr').toFixed(0)} s`]]; } },
  ch: { name: 'Cookie Horror', kind: 'Final ability · Horror · True damage · Single target',
    text: 'Choose ONE enemy god, anywhere on the map. Cookie crumbs fall like snow around the victim, the horror music creeps in … the picture glitches … a screaming cookie face fills the screen … then everything goes DEAD silent. And then Cookie Monster is standing right in front of the victim and CLAPS: a boom heard across the whole hall. The highest single-target damage in the game.',
    rows: () => { const r = rankOf('ch'); return [['Damage', `${AB.ch.dmg[r - 1]} (+1000% of ${cmPw()} power) = ${Math.round(cmDmg('ch'))} true damage`], ['Around', `${CM_HORROR.splash * 100}% within ${CM_HORROR.splashR} m`], ['Cost', `${costOf('ch')} mana`], ['Cooldown', `${cdOf('ch').toFixed(0)} s`]]; } },
};
registerGod({
  id: 'cookie', dbg: CM, name: 'Cookie Monster', title: 'The Cookie Nightmare', epithet: 'The Cookie Horror', pantheon: 'Unknown', role: 'Warrior',
  color: '#e0782a', glyphs: '🍪 ✹ ☠ ✦ ◉', asset: 'cookie', stats: COOKIE_STATS, order: ['cc', 'cf', 'dm', 'cr', 'ch'], ab: cookieAB,
  blurb: 'A hulking brute with a cracked chocolate-chip cookie for a head – cookie cannon, rolling cookie wheel, dough mines, burning cookie swords and the finale <em>Cookie Horror</em>.',
  info: COOKIE_INFO, physical: true, ownerOnly: true, noBot: true, lockedTitle: 'steens secret, good luck',
  textColor: '#ffc27a', finalColor: '#ff3a20', fxColor: CMC.caramel, accent: CMC.caramel,
  get accel() { return CM.form === 'roll' ? CM_ROLL.accel : CM.form === 'rage' ? 3.6 : 3.2; },   // (a heavy body: slow to get going, slow to stop)
  init() {
    CM.home = { rig: Game.thoth, anim: Game.anim };
    CM.form = 'normal'; CM.eatT = 6; CM.eat = null; CM.combo = 0; CM.comboT = 0; CM.cookieBack = 0;
    if (CM.home.rig.propL) CM.home.rig.propL.visible = false;
    CM.home.anim.post = cmClapPost;
    if (!CM.home.anim._cmStep) { const a = CM.home.anim, s0 = a.onStep; a._cmStep = true; a.onStep = (p) => { if (s0) s0(p); if (Kit === GODS.cookie && Game.anim === a) cmFootfall(p); }; }
    CM.thud = 0;
    cmScreamImg();
  },
  dispose() {
    cmPickerClose();
    if (CM.horror) {
      const H = CM.horror; if (H.screen) H.screen.dispose(); if (H.music) H.music.stop(0.1); CM.horror = null;
      if (!Net.ctx) { cmSilence(false); Game.stopT = 0; Game.stopScale = 1; }
      else if (H.mine) { if (H.silent) cmSilence(false); cmMyView(() => { WORLD.dim = 1; PostFX.vigTarget = 0; }); }   // (its victim's screen comes back: the caster fell, left ...)
    }
    if (CM.rage) { if (CM.rage.charge) CM.rage.charge.dead = true; if (CM.rage.sfx) CM.rage.sfx.stop(0.1); if (CM.rage.aura) CM.rage.aura.dead = true; if (CM.rage.mist) CM.rage.mist.dead = true; if (CM.rage.haze) CM.rage.haze.dead = true; cmSwapForm(false); CM.rage = null; }
    if (CM.rageR && CM.rageR.ribbons) for (const rb of CM.rageR.ribbons) rb.reset();
    for (const L of CM.lifts) L.d.lift = 0; CM.lifts = [];
    if (CM.roll) { if (CM.roll.loop) CM.roll.loop.stop(0.1); cmDrop(CM.roll.W); CM.roll = null; }
    CM.form = 'normal';
    if (CM.home) { CM.home.rig.root.visible = true; CM.home.anim.post = null; if (CM.home.rig.propL) CM.home.rig.propL.visible = false; if (CM.home.rig.prop) CM.home.rig.prop.visible = true; }
    for (const M of CM.mines) cmDrop(M.g); CM.mines = [];
    for (const a of CM.auras) a.dead = true; CM.auras = [];
    WORLD.dim = 1; PostFX.vigTarget = 0; P.asBuff = 1;
  },
  intercept(id) {
    if (CM.pick || (CM.horror && !CM.horror.done)) return true;
    if (CM.form === 'roll' && id !== 'cf') { HUD.warn('Rolling – press E to stand up'); return true; }
    if (CM.form === 'rage') { HUD.warn('Cookie Rage: only the swords now'); return true; }
    if (id === 'cf') { if (CM.form === 'normal' || CM.form === 'roll') { castCrumble(); } return true; }   // the free toggle (no mana, no cooldown)
    if (id === 'ch' && !CM.pick) { if (!Net.ctx && canCast('ch')) cmPickerOpen(); return true; }   // (a replay: the victim comes as its own event, castOn)
    return false;
  },
  // online, another player's Cookie Monster (14n_net.js, the K event): he ate a cookie, or chose his Cookie Horror victim
  castOn(id, d) {
    if (id === 'eat') { if (!CM.eat) cmStartEat(); }
    else if (id === 'ch' && d && d.alive && !CM.horror) cmHorrorStart(d);
  },
  busy: cmBusy,
  cast(id) { ({ cc: castCookieCannon, cf: castCrumble, dm: castDoughMine, cr: castCookieRage, ch: () => cmPickerOpen() })[id](); },
  basic: cookieBasic,
  preUpdate() { if (CM.pick) cmPickerInput(); },
  rmb() { if (CM.pick) { cmPickerClose(); Sound.cancel(); } },
  moveOverride() {
    if ((CM.horror && !CM.horror.done) || CM.pick || (CM.rage && CM.rage.phase === 'in')) { P.vel.set(0, 0, 0); return true; }
    return false;
  },
  speedMul() { return CM.form === 'roll' ? 1 + CM_ROLL.speed : CM.form === 'rage' ? 1 + CM_RAGE.ms : 1; },
  noJump() { return cmBusy() || CM.form === 'roll'; },
  animVel() { return (CM.horror && !CM.horror.done) || CM.pick || CM.form === 'roll' ? _v1.set(0, 0, 0) : P.vel; },   // (rolling: the hidden body stands still - no steps, no footprints)
  lockYaw() { return !!(CM.horror && !CM.horror.done); },
  dashing() { return CM.form === 'roll'; },
  eyeBoost() { return (CM.horror ? 1.6 : 0) + (CM.form === 'rage' ? 2.2 + 0.4 * Math.sin(Game.time * 9) : 0) + (CM.eat ? 0.4 : 0); },   // (rage: blazing)
  // the cinematic cut to the victim's eyes during the snow / glitch / scream
  postCamera() {
    const H = CM.horror; if (!H || H.t >= CM_HORROR.silence + 0.05) return;
    const d = H.d, yaw = d.facing !== undefined ? d.facing : Math.atan2(P.pos.x - d.pos.x, P.pos.z - d.pos.z);
    const eye = _c1.set(d.pos.x, (d.height || 2) * 0.88 + (d.lift || 0), d.pos.z).addScaledVector(fwdOf(yaw, _c2), 0.35);
    camera.position.copy(eye).add(_c3.set(Math.sin(H.t * 0.9) * 0.02, Math.sin(H.t * 1.3) * 0.015, 0));
    camera.lookAt(_c4.copy(eye).addScaledVector(fwdOf(yaw + Math.sin(H.t * 0.4) * 0.12, _c2), 6).add(_c5.set(0, -0.35, 0)));
    camera.fov = 58; camera.updateProjectionMatrix();
  },
  update(dt, t) {
    CM.comboT = Math.max(0, CM.comboT - dt);
    P.asBuff = CM.form === 'rage' ? 1 + CM_RAGE.as : 1;
    // the cookie in his hand regrows after a Cookie Cannon
    const pr = CM.home && CM.home.rig.prop;
    if (pr) { if (CM.cookieBack > 0) { CM.cookieBack -= dt; pr.visible = false; if (CM.cookieBack <= 0) { pr.visible = true; pr.scale.setScalar(0.01); } } else if (pr.scale.x < 1) pr.scale.setScalar(Math.min(1, pr.scale.x + dt * 4)); }
    cmUpdateEat(dt); cmUpdateRoll(dt); cmUpdateMines(dt, t); cmUpdateRage(dt, t); cmUpdateHorror(dt, t); cmUpdateLifts(dt);
    if (CM.form === 'normal' && Math.random() < dt * 2.5) cmCrumbs(cmMouth(_c3).add(_c4.set(rand(-0.2, 0.2), 0.2, rand(-0.2, 0.2))), 1, 0.3, 0.2);   // his head sheds crumbs
  },
  onKill(d) { CM.kills++; },
  targeter() {
    if (P.targeting === 'cc') lineTarget.show(P.pos, P.yaw, AB.cc.range * SU, AB.cc.width * 1.6, AB.cc.width * 1.6);
    else if (P.targeting === 'dm') { const c = groundTarget(AB.dm.range * SU, 2.5); circleTarget.show(c, CM_MINE.radius, CMC.caramel); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.3, 0.3); }
  },
  armed(id) { return (id === 'cf' && CM.form === 'roll') || (id === 'cr' && CM.form === 'rage') || (id === 'ch' && !!(CM.pick || CM.horror)); },
  cdHidden(id) { return id === 'cf'; },
  stack(id) { return id === 'dm' && CM.mines.length ? String(CM.mines.length) : ''; },
  buffs() {
    return [
      { icon: 'cm_eat', on: true, n: '', t: `${Math.max(0, Math.ceil(CM.eatT))}s` },
      { icon: 'cm_rage', on: CM.form === 'rage' && CM.rage, n: '', t: CM.rage ? Math.ceil(CM_RAGE.dur - CM.rage.t) + 's' : '' },
      { icon: 'cm_roll', on: CM.form === 'roll', n: '', t: '' },
    ];
  },
  onDummyDeath(d, p) { cmBurst(p.clone().setY(1.2), 0.7, { distort: false }); cmChips(p.clone().setY(1), 10, 0.9); },
  icon(ctx, S, id) {
    const glow = (fn, col = '#ffb35a', blur = 16) => glowText(ctx, fn, col, blur);
    const cookie = (x, y, r, col = '#c98a3e') => { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, rr = r * (0.94 + 0.06 * Math.sin(i * 3.7)); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); ctx.fillStyle = '#3a1806'; for (const [cx, cy, cr] of [[-0.35, -0.3, 0.14], [0.3, -0.2, 0.12], [0.05, 0.25, 0.15], [-0.3, 0.3, 0.1], [0.38, 0.32, 0.1], [0.0, -0.05, 0.09]]) { ctx.beginPath(); ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU); ctx.fill(); } };
    const face = (x, y, r) => { cookie(x, y, r); ctx.fillStyle = '#ff6a10'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.15, y - r * 0.25); ctx.lineTo(x + s * r * 0.5, y - r * 0.38); ctx.lineTo(x + s * r * 0.42, y - r * 0.12); ctx.closePath(); ctx.fill(); } ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.15); for (let i = 0; i <= 8; i++) ctx.lineTo(x - r * 0.5 + i * r * 0.125, y + r * (i % 2 ? 0.42 : 0.2)); ctx.lineTo(x + r * 0.5, y + r * 0.15); ctx.quadraticCurveTo(x, y + r * 0.7, x - r * 0.5, y + r * 0.15); ctx.fill(); };
    if (id === 'passive' || id === 'cm_eat') { iconBase(ctx, S, '#8a4a14', '#200a02'); glow(() => { cookie(S * 0.5, S * 0.52, S * 0.3); ctx.fillStyle = '#200a02'; ctx.beginPath(); ctx.arc(S * 0.78, S * 0.3, S * 0.13, 0, TAU); ctx.fill(); }); }
    else if (id === 'cc') { iconBase(ctx, S, '#9a4a10', '#200802'); glow(() => { ctx.strokeStyle = 'rgba(255,170,80,0.8)'; ctx.lineWidth = S * 0.05; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(S * 0.08, S * (0.4 + i * 0.12)); ctx.lineTo(S * 0.35, S * (0.4 + i * 0.12)); ctx.stroke(); } cookie(S * 0.62, S * 0.52, S * 0.27); }); }
    else if (id === 'cf' || id === 'cm_roll') { iconBase(ctx, S, '#7a4a18', '#1a0a02'); glow(() => { cookie(S * 0.5, S * 0.48, S * 0.3); ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = S * 0.04; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.48, S * 0.4, -0.4, 1.6); ctx.stroke(); ctx.fillStyle = 'rgba(200,140,70,0.8)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(S * (0.12 + i * 0.05), S * (0.86 - (i % 2) * 0.04), S * 0.025, 0, TAU); ctx.fill(); } }); }
    else if (id === 'dm') { iconBase(ctx, S, '#8a3a10', '#1a0602'); glow(() => { ctx.fillStyle = '#e8b46a'; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.62, S * 0.3, S * 0.18, 0, 0, TAU); ctx.fill(); cookie(S * 0.5, S * 0.58, S * 0.2); ctx.strokeStyle = '#3a2412'; ctx.lineWidth = S * 0.035; ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.42); ctx.quadraticCurveTo(S * 0.55, S * 0.28, S * 0.66, S * 0.22); ctx.stroke(); ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(S * 0.68, S * 0.2, S * 0.05, 0, TAU); ctx.fill(); }, '#ff8a20'); }
    else if (id === 'cr' || id === 'cm_rage') { iconBase(ctx, S, '#a0300a', '#200402'); glow(() => { for (const s of [-1, 1]) { ctx.save(); ctx.translate(S * 0.5, S * 0.55); ctx.rotate(s * 0.65); ctx.fillStyle = '#2a1206'; ctx.fillRect(-S * 0.04, -S * 0.42, S * 0.08, S * 0.5); ctx.fillStyle = '#ff6a10'; ctx.fillRect(-S * 0.02, -S * 0.44, S * 0.04, S * 0.5); ctx.restore(); } face(S * 0.5, S * 0.5, S * 0.17); }, '#ff5a10', 18); }
    else if (id === 'ch') { iconBase(ctx, S, '#5a0a06', '#0a0000'); glow(() => face(S * 0.5, S * 0.5, S * 0.34), '#ff2a10', 20); }
    else return false;
    return true;
  },
});

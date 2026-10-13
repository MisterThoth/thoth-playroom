// ============================================================================
// BASTET, goddess of cats (SMITE 1 kit, final patch: Nightstalker, Pounce, Razor Whip, Ensnaring
// Claw, Huntress of Bast) + the playroom finale SLAYER OF APEP, straight from the Book of the Dead:
// "the Great Cat who cut off the head of the serpent beside the ished-tree in Heliopolis". The sky
// sinks to dusk, Apep - chaos itself - bursts out of the ground and coils around the foes, and the
// Great Cat of Ra leaps over Bastet with a blade of sunlight and takes its head.
// ============================================================================
const BASTET_STATS = { hp: [400, 80], mp: [205, 35], speed: 380, range: 12, as: [1.0, 0.02], basic: [40, 2.1], basicScale: 1.0, hp5: [9, 0.8], mp5: [4.6, 0.38] };
const AP_CUT = 2.6;
// Slayer of Apep's blade, [base, x physical power] + the stun after the cut. Balance (ability 5 >= 2 x ability 4):
// 2.2 x Huntress of Bast at rank 5 (400 + 0.9 PP hit + 6 quicksand ticks of 40 + 0.15 PP) - was 420 + 1.0 PP, weaker
const AP_DMG = [1420, 4.0], AP_STUN = 1.2;
const BA = { combo: 0, comboT: 0, back: null, leap: null, cats: [], apep: null, windup: null, revealed: new Map(), healAcc: 0 };
const BAC = {
  gold: new THREE.Color(1.0, 0.6, 0.1), amber: new THREE.Color(0.95, 0.38, 0.03), sun: new THREE.Color(1.0, 0.76, 0.28), turq: new THREE.Color(0.06, 0.85, 0.72),
  lapis: new THREE.Color(0.08, 0.24, 0.95), blood: new THREE.Color(0.75, 0.03, 0.05), sand: new THREE.Color(0.72, 0.52, 0.28), chaos: new THREE.Color(0.42, 0.06, 0.68), molten: new THREE.Color(1.0, 0.26, 0.04),
};
const bastetAB = {
  pk: { id: 'pk', name: 'Pounce', dmg: [95, 150, 205, 260, 315], scale: 0.9, cost: [60, 65, 70, 75, 80], cd: [14, 13.5, 13, 12.5, 12], range: 55, radius: 20, back: 4, targeted: true },
  rw: { id: 'rw', name: 'Razor Whip', tick: [30, 45, 60, 75, 90], scale: 0.25, cost: [50, 55, 60, 65, 70], cd: [10, 10, 10, 10, 10], range: 35, arc: 70 },
  ec: { id: 'ec', name: 'Ensnaring Claw', dmg: [55, 90, 125, 160, 195], scale: 0.6, catDmg: [20, 25, 30, 35, 40], catScale: 0.3, cost: [60, 65, 70, 75, 80], cd: [16, 15.5, 15, 14.5, 14], range: 70, rootR: 10, root: 0.5, dur: 4, slow: 0.2 },
  hb: { id: 'hb', name: 'Huntress of Bast', dmg: [160, 220, 280, 340, 400], scale: 0.9, sand: [20, 25, 30, 35, 40], sandScale: 0.15, cost: [100, 100, 100, 100, 100], cd: [110, 105, 100, 95, 90], range: 100, mark: 10, sandR: 20, sandDur: 3, stun: 1, windup: 0.45 },
  ap: { id: 'ap', name: 'Slayer of Apep', cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33], range: 75, radius: 6.5, targeted: true },
};
const nightstalker = (god) => (god ? 0.06 + 0.006 * lvl() : 0.06 + 0.0015 * lvl());

// golden claw arcs sweeping in front of her
function clawArc(center, yaw, radius, sweep, color = BAC.gold, dur = 0.16, y = 1.15, tilt = 0, width = 0.42) {
  const pal = color === BAC.turq ? 'turq' : color === BAC.blood ? 'blood' : 'bastet';
  FX2.slash(V3(center.x, y, center.z), yaw, pal, { r0: radius * 0.55, r1: radius * 1.05, a0: -sweep / 2, a1: sweep / 2, dur: dur * 1.8, tilt: tilt * 0.35, int: 1.5 });
  const tr = VFX.trail(width * (radius / 2.2), color, 2.4, 14);
  GodFX.add({ update() {
    const k = clamp(this.t / dur, 0, 1), a = yaw + lerp(-sweep / 2, sweep / 2, easeOutCubic(k));
    tr.push(_v1.set(center.x + Math.sin(a) * radius, y + Math.sin(a * 2 + tilt) * 0.25 * tilt, center.z + Math.cos(a) * radius));
    if (k >= 1) { tr.alive = false; return false; } return true;
  } });
}
function slashSpark(p, n = 10, col = BAC.gold) {
  const pal = col === BAC.turq ? 'turq' : 'bastet';
  FX2.burst(p, pal, { size: 0.35 + n * 0.02, sparks: n + 8, embers: Math.round(n * 0.6), puffs: 1, bursts: 1, distort: n > 10 });
  GodFX.spawn({ pos: p.clone(), life: 0.22, size: 1.1, sizeEnd: 1.6, color: col, intensity: 1.7, cell: GX.claw, rot: rand(0, TAU), alpha: 1, alphaEnd: 0, fadeIn: 0 });
  for (let i = 0; i < Math.round(n * 0.4); i++) FX2.solid.spawn({ pos: p.clone(), vel: V3(rand(-3, 3), rand(0, 3), rand(-3, 3)), life: rand(0.4, 0.8), size: rand(0.05, 0.1), sizeEnd: 0.03, cell: FXA.drop, pal: 'blood', alpha: 0.9, gravity: -12, drag: 0.5, floor: true });
}
// golden sand kicked up off the floor (lit volumetric dust)
function sandPuff(p, n = 8, speed = 4, size = 0.8) {
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), d = V3(Math.cos(a), 0, Math.sin(a)); FX2.smoke.spawn({ pos: p.clone().addScaledVector(d, rand(0.2, 0.8)).setY(0.3), vel: d.multiplyScalar(rand(0.6, 1) * speed).add(V3(0, rand(0.4, 1.4), 0)), life: rand(0.8, 1.4), size: size * rand(0.7, 1.1), sizeEnd: size * 2.6, frames: 16, pal: 'sand', temp: 0.15, tempEnd: 0, int: 1, alpha: 0.7, drag: 2.2, turb: 0.5 }); }
}
// Nightstalker: blood-gold motes drift from the prey back into her
function lifeMotes(from, n = 4) {
  for (let i = 0; i < n; i++) VFX.add.spawn({ pos: from.clone().add(V3(rand(-0.3, 0.3), rand(-0.2, 0.4), rand(-0.3, 0.3))), vel: V3(rand(-1, 1), rand(0.5, 2), rand(-1, 1)), life: 1.2, size: rand(0.06, 0.1), sizeEnd: 0.02, color: i % 2 ? BAC.blood : BAC.gold, intensity: 2, cell: FX.ember, attract: { x: P.pos.x, y: 1.2, z: P.pos.z, strength: 26, kill: 0.5 }, drag: 1 });
}

// ---- basic attack: a three-strike claw chain ----------------------------------------------
function bastetBasic() {
  if (BA.apep || BA.leap || BA.windup) return;
  P.atkCd = 1 / attackSpeed();
  if (BA.comboT <= 0) BA.combo = 0;
  const step = BA.combo % 3; BA.combo++; BA.comboT = 1.6;
  Game.anim.play(['claw1', 'claw2', 'claw3'][step], { dur: Math.min(0.5, P.atkCd * 0.95), side: step === 1 ? 'L' : 'R' });
  P.atkPenalty = Math.min(0.3, P.atkCd * 0.5);
  const dir = fwdOf(P.yaw);
  VFX.later(0.09, () => {
    const c = P.pos.clone(), heavy = step === 2;
    clawArc(c, P.yaw, 1.9, heavy ? 2.4 : 1.6, heavy ? BAC.amber : BAC.gold, 0.13, heavy ? 1.0 : 1.25, heavy ? 0 : step === 1 ? -1 : 1);
    Sound.god(`swipe${1 + step}`, { gain: 0.85 });
    // a melee strike lands on the first foe in reach
    const d = dummiesInCone(c, dir, BASTET_STATS.range * SU * 1.05, heavy ? 1.1 : 0.85).sort((a, b) => a.pos.distanceToSquared(c) - b.pos.distanceToSquared(c))[0];
    if (d) {
      Combat.deal(d, basicDamage() * (heavy ? 1.25 : 1), 'basic', 'Claws', false, true);
      slashSpark(d.pos.clone().setY(1.1), heavy ? 14 : 8, heavy ? BAC.amber : BAC.gold);
      Sound.god(`claw_hit${1 + (step % 2)}`, { gain: 0.8 });
    }
    if (Math.random() < 0.06) Sound.voice('eff', { cooldown: 6 });
  });
}

// ---- 1 · Pounce (+ the leap back) ---------------------------------------------------------
function leapTo(target, dur, height, opts = {}) {
  BA.leap = { from: P.pos.clone().setY(0), to: target.clone().setY(0), t: 0, dur, height, ghostT: 0, ...opts };
  P.flying = true; P.grounded = false; P.vel.set(0, 0, 0);
  BA.leap.trail = VFX.trail(0.6, opts.kind === 'back' ? BAC.turq : BAC.gold, 2.0, 22);
}
function castPounce() {
  spend('pk'); startCd('pk');
  const to = groundTarget(AB.pk.range * SU, 3), from = P.pos.clone().setY(0), dist = from.distanceTo(to);
  Game.anim.play('pounce');
  Sound.god('pounce', { gain: 1.0 });
  Sound.voice('a1', { chance: 0.6, cooldown: 6 });
  leapTo(to, clamp(dist / 21, 0.34, 0.56), 1.4 + dist * 0.13, { kind: 'pounce' });
  BA.back = { pos: from, t: AB.pk.back };
  BA.back.mark = GodFX.decal(from, GodFX.cellTex(GX.paw), BAC.turq, 1.3, 9999, { intensity: 1.3, spin: 0 }); BA.back.mark.hold = () => (BA.back ? 0.9 : 0);
  sandPuff(from, 10, 3, 0.7); FX2.burst(from.clone().setY(0.8), 'bastet', { size: 0.5, sparks: 16, embers: 10, puffs: 0, bursts: 1 });
}
function pounceBack() {
  const B = BA.back; if (!B || BA.leap) return;
  BA.back = null; if (B.mark) B.mark.dead = true;   // (the paw print goes with it: it used to stay, invisible, for good)
  Game.anim.play('flip');
  Sound.god('pounce_back', { gain: 0.95 });
  const dist = P.pos.distanceTo(B.pos);
  leapTo(B.pos, clamp(dist / 20, 0.32, 0.55), 1.2 + dist * 0.1, { kind: 'back' });
}
function updateLeap(dt) {
  const L = BA.leap; if (!L) return false;
  L.t += dt;
  const k = clamp(L.t / L.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
  P.pos.lerpVectors(L.from, L.to, e);
  P.y = Math.sin(k * Math.PI) * L.height;
  P.vel.set(0, 0, 0);
  if (L.kind === 'pounce') P.yaw = Math.atan2(L.to.x - L.from.x, L.to.z - L.from.z);
  L.trail.push(_v1.copy(P.pos).setY(P.y + 1.0));
  // golden afterimages of the cat in mid-air
  L.ghostT -= dt;
  if (L.ghostT <= 0 && k < 0.85) {
    L.ghostT = 0.07;
    const ghost = ghostClone(Game.thoth, L.kind === 'back' ? new THREE.Color(0.05, 0.6, 0.5) : new THREE.Color(0.9, 0.42, 0.05), L.kind === 'back' ? BAC.turq : BAC.gold);
    ghost.group.position.y += P.y;
    GodFX.add({ update(dt2, time) { ghost.mat.uniforms.uTime.value = time; ghost.mat.uniforms.uAlpha.value = Math.max(0, 0.55 - this.t * 2.2); if (this.t > 0.26) { ghost.dispose(); return false; } return true; } });
  }
  FX2.trailTick(_v4.copy(P.pos).setY(P.y + 1.0), null, L.kind === 'back' ? 'turq' : 'bastet', dt, { k: 2, size: 1.2, smoke: false });
  if (k >= 1) {
    P.y = 0; P.flying = false; P.grounded = true; P.vel.set(0, 0, 0);
    L.trail.alive = false; BA.leap = null;
    if (L.kind === 'pounce') pounceLand(L.to);
    else Game.anim.play('land');
  }
  return true;
}
function pounceLand(at) {
  Game.anim.play('land');
  const rank = rankOf('pk'), R = AB.pk.radius * SU;
  Sound.god('pounce_land', { gain: 1.0, pos: at });
  Game.hitStop(0.05, 0.2);
  Cam.shake = Math.max(Cam.shake, 0.35);
  PostFX.shock(at.clone().setY(0.8), 0.45, 0.4);
  FX2.impact(at, 'bastet', { size: 0.9, debris: 10, ring: (R + 0.8) / 0.9, sparks: 34, dustPal: 'sand', dustGlow: 0.1 });
  const cl = GodFX.decal(at, GodFX.sig.claws, BAC.amber, R * 1.7, 2.2, { intensity: 1.1, spin: 0 }); cl.m.rotation.z = -P.yaw;
  GodFX.decal(at, GodFX.sig.cat, BAC.gold, R * 2.1, 1.2, { intensity: 0.7, spin: 0.6, grow: 0.15 });
  for (const d of dummiesNear(at, R)) { Combat.deal(d, AB.pk.dmg[rank - 1] + AB.pk.scale * ppow(), 'ability', 'Pounce', false, true); slashSpark(d.pos.clone().setY(1.1), 12, BAC.amber); }
}

// ---- 2 · Razor Whip: the cat-o'-nine-tails, and a bleed that ticks four times --------------
function castRazorWhip() {
  spend('rw'); startCd('rw');
  const rank = rankOf('rw'), dir = fwdOf(P.yaw), c = P.pos.clone(), R = AB.rw.range * SU, half = AB.rw.arc * DEG / 2;
  Game.anim.play('whip');
  Sound.god('whip', { gain: 1.0 });
  Sound.voice('a2', { chance: 0.55, cooldown: 7 });
  VFX.later(0.12, () => {
    // nine thongs lashing across the cone
    for (let k = 0; k < 5; k++) VFX.later(k * 0.025, () => clawArc(c, P.yaw, R * (0.55 + k * 0.1), half * 2.2, k % 2 ? BAC.amber : BAC.gold, 0.14, 0.6 + k * 0.22, (k - 2) * 0.5, 0.22));
    VFX.later(0.15, () => { const tip = c.clone().addScaledVector(fwdOf(P.yaw + half * 1.05), R).setY(1.0); slashSpark(tip, 14, BAC.sun); VFX.flash(tip, BAC.amber, 10, 0.2); });
    const fan = GodFX.decal(c.clone().addScaledVector(dir, R * 0.5), GodFX.sig.claws, BAC.blood, R * 1.1, 1.4, { intensity: 0.9 }); fan.m.rotation.z = -P.yaw + Math.PI / 2;
    for (const d of dummiesInCone(c, dir, R, half)) {
      // four bleed ticks: now, 0.66, 1.33 and 2 s
      for (let i = 0; i < 4; i++) VFX.later(i * 0.66, () => {
        if (!d.alive) return;
        Combat.deal(d, AB.rw.tick[rank - 1] + AB.rw.scale * ppow(), i ? 'dot' : 'ability', 'Razor Whip', false, true);
        if (i) Sound.god('bleed', { gain: 0.35, pos: d.pos });
        for (let n = 0; n < 9; n++) FX2.solid.spawn({ pos: d.pos.clone().setY(rand(0.6, 1.6)), vel: V3(rand(-1.8, 1.8), rand(0.3, 2), rand(-1.8, 1.8)), life: rand(0.5, 0.9), size: rand(0.05, 0.11), sizeEnd: 0.03, cell: FXA.drop, pal: 'blood', alpha: 0.95, gravity: -12, drag: 0.4, floor: true });
        FX2.glow.spawn({ pos: d.pos.clone().setY(1.2), life: 0.3, size: 0.9, sizeEnd: 1.4, cell: FXA.core, pal: 'blood', temp: 0.8, tempEnd: 0.4, int: 1.3, fadeIn: 0 });
      });
      d.bleeds.push({ dps: 0, t: 2.05, src: 'Razor Whip' }); GodFX.status(d, 'bleed');   // the bleed marker; the ticks are dealt above
      slashSpark(d.pos.clone().setY(1.1), 12, BAC.amber);
    }
  });
}

// ---- 3 · Ensnaring Claw: a spirit cat runs out, roots what it catches, then stays to fight -----
function spawnSpiritCat(pos, yaw, opts = {}) {
  const cat = new SpectralBeast('cat', { style: 'ghost', size: opts.size ?? 1.15, color: opts.color || new THREE.Color(0.95, 0.5, 0.05), rim: opts.rim || BAC.turq, eyes: BAC.turq, tex: 0.65 });
  cat.pos = pos.clone().setY(0); cat.yaw = yaw; cat.vel = V3(); cat.state = 'run'; cat.t = 0; cat.biteT = 0; cat.hop = 0;
  cat.trail = VFX.trail(0.3, BAC.gold, 1.4, 16);
  return cat;
}
function castEnsnaringClaw() {
  spend('ec'); startCd('ec');
  const rank = rankOf('ec'), dir = fwdOf(P.yaw);
  Game.anim.play('toss');
  Sound.god('claw_cast', { gain: 1.0 });
  Sound.voice('a3', { chance: 0.55, cooldown: 7 });
  VFX.later(0.14, () => {
    const cat = spawnSpiritCat(P.pos.clone().addScaledVector(dir, 0.8), P.yaw);
    cat.dir = dir.clone(); cat.travel = 0; cat.rank = rank;
    Sound.god('cat_meow', { gain: 0.55 });
    BA.cats.push(cat);
  });
}
function updateCats(dt, t) {
  BA.cats = BA.cats.filter((cat) => {
    cat.t += dt;
    if (cat.state === 'run') {           // immune, sprinting along the line until it catches something
      const step = 24 * dt; cat.pos.addScaledVector(cat.dir, step); cat.travel += step;
      cat.yaw = Math.atan2(cat.dir.x, cat.dir.z);
      if (Math.random() < dt * 14) GodFX.decal(cat.pos, GodFX.cellTex(GX.paw), BAC.gold, 0.45, 1.0, { intensity: 1.0 }).m.rotation.z = -cat.yaw;
      FX2.trailTick(_v4.copy(cat.pos).setY(0.5), null, 'bastet', dt, { k: 1.4, size: 0.9, smoke: false });
      if (Math.random() < dt * 12) sandPuff(cat.pos, 1, 1.5, 0.5);
      const hitD = Combat.dummies.find((d) => d.alive && Math.hypot(d.pos.x - cat.pos.x, d.pos.z - cat.pos.z) < d.radius + 0.6);
      if (hitD) {
        cat.state = 'fight'; cat.target = hitD; cat.t = 0; cat.biteT = 1;
        const at = hitD.pos.clone().setY(0), rr = AB.ec.rootR * SU;
        Sound.god('claw_root', { gain: 0.9, pos: at });
        GodFX.decal(at, GodFX.sig.cat, BAC.gold, rr * 2.4, 1.0, { spin: -2.4, intensity: 1.2, grow: 0.25 });
        FX2.ring(at, 'turq', { radius: rr + 0.6, dur: 0.4 }); FX2.burst(at.clone().setY(0.8), 'turq', { size: 0.8, sparks: 26, embers: 14, puffs: 2 }); sandPuff(at, 8, 3.5, 0.7);
        for (const d of dummiesNear(at, rr)) {
          Combat.deal(d, AB.ec.dmg[cat.rank - 1] + AB.ec.scale * ppow(), 'ability', 'Ensnaring Claw', false, true);
          d.rooted(AB.ec.root); GodFX.status(d, 'root');
          for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU, off = V3(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75); const follow = { get x() { return d.pos.x + off.x; }, get z() { return d.pos.z + off.z; } }; const bar = VFX.pillar(follow, 0.04, 2.2, BAC.gold); bar.target = 0.9; VFX.later(AB.ec.root + 0.1, () => { bar.dead = true; }); }
          slashSpark(d.pos.clone().setY(1.1), 10, BAC.gold);
        }
      } else if (cat.travel > AB.ec.range * SU) { cat.state = 'fade'; cat.t = 0; }
    } else if (cat.state === 'fight') {   // stays for 4 s: one swipe a second, slowing whatever it hits
      if (!cat.target || !cat.target.alive) cat.target = dummiesNear(cat.pos, 4)[0] || null;
      const d = cat.target;
      if (cat.t > AB.ec.dur) { cat.state = 'fade'; cat.t = 0; }
      else if (d) {
        const goal = _v1.set(d.pos.x - Math.sin(cat.yaw) * (d.radius + 0.75), 0, d.pos.z - Math.cos(cat.yaw) * (d.radius + 0.75));
        cat.pos.lerp(goal, Math.min(1, dt * 8));
        cat.yaw = dampAngle(cat.yaw, Math.atan2(d.pos.x - cat.pos.x, d.pos.z - cat.pos.z), 10, dt);
        cat.biteT -= dt; cat.hop = Math.max(0, cat.hop - dt * 3);
        if (cat.biteT <= 0) {
          cat.biteT = 1; cat.hop = 1;
          Combat.deal(d, AB.ec.catDmg[cat.rank - 1] + AB.ec.catScale * basicDamage(), 'ability', 'Spirit Cat', false, true);
          d.slowed(AB.ec.slow, 2);
          slashSpark(d.pos.clone().setY(0.9), 6, BAC.turq);
          Sound.god('cat_attack', { gain: 0.6, pos: d.pos });
        }
      }
    } else if (cat.state === 'fade') { cat.alphaK = Math.max(0, 1 - cat.t / 0.4); }
    cat.group.position.set(cat.pos.x, Math.sin(cat.hop * Math.PI) * 0.5, cat.pos.z);
    cat.group.rotation.y = cat.yaw; cat.leap = cat.hop;
    cat.alpha = cat.alphaK ?? Math.min(1, cat.t * 6 + (cat.state !== 'run' ? 1 : 0));
    cat.update(dt, cat.state === 'run' ? 20 : 2, t);
    cat.trail.push(_v1.copy(cat.group.position).setY(0.45));
    if (cat.state === 'fade' && cat.t > 0.45) { cat.trail.alive = false; cat.dispose(); return false; }
    return true;
  });
}

// ---- 4 · Huntress of Bast: a wind-up, a radiant bolt, and the Huntress drags the prey to her pit
function castHuntress() {
  spend('hb'); startCd('hb');
  const rank = rankOf('hb');
  Game.anim.play('huntress');
  Sound.god('huntress_windup', { gain: 1.0 });
  Sound.duckMusic(0.4, 3.2, 1.5);
  BA.windup = { t: 0, rank };
  // the mark she will drag them to, 10 range in front of her
  BA.windup.markPos = P.pos.clone().addScaledVector(fwdOf(P.yaw), AB.hb.mark * SU).setY(0);
  BA.windup.mark = GodFX.decal(BA.windup.markPos, GodFX.sig.cat, BAC.gold, 2.4, 3.5, { spin: 1.2, intensity: 1.2 });
  FX2.burst(P.pos.clone().setY(1.4), 'bastet', { size: 0.7, sparks: 20, embers: 12, puffs: 0, bursts: 1 });
  BA.windup.charge = FX2.charge(handPos('R').clone(), 'bastet', { dur: AB.hb.windup, radius: 1.6, rate: 90, size: 1.2 });
  BA.windup.aura = FX2.aura(P.pos, 'bastet', { radius: 1.0, height: 2.2, rate: 40, dur: AB.hb.windup + 0.2 });
}
function updateWindup(dt) {
  const W = BA.windup; if (!W) return;
  W.t += dt;
  const hp = handPos('R');
  if (Math.random() < dt * 60) VFX.add.spawn({ pos: hp.clone().add(V3(rand(-0.6, 0.6), rand(-0.4, 0.8), rand(-0.6, 0.6))), vel: V3(0, 0, 0), life: 0.4, size: rand(0.05, 0.1), sizeEnd: 0.02, color: Math.random() < 0.5 ? BAC.gold : BAC.turq, intensity: 2, cell: FX.ember, attract: { x: hp.x, y: hp.y, z: hp.z, strength: 30, kill: 0.15 } });
  if (W.t < AB.hb.windup) return;
  BA.windup = null;
  const dir = fwdOf(P.yaw), origin = aimOrigin(), rank = W.rank;
  Sound.god('huntress_cast', { gain: 1.0 });
  Sound.god('sonic_boom', { gain: 0.42, shared: true });
  Sound.voice('ult_scream', { priority: 4, gain: 1.1, cooldown: 0, hold: 2.2 });
  VFX.later(2.45, () => Sound.voice('ult', { priority: 3, gain: 1.05, cooldown: 0, chance: 0.65 }));
  Cam.shake = Math.max(Cam.shake, 0.35); Cam.fovKick = 5;
  PostFX.shock(origin.clone().addScaledVector(dir, 1.5), 0.55, 0.5);
  const g = new THREE.Group(); scene.add(g);
  const core = glowSprite(VFX.dotTex, BAC.gold, 1.2, 1.8); g.add(core);
  const eye = glowSprite(GodFX.cellTex(GX.cateye), BAC.turq, 0.75, 2.0); g.add(eye);
  const trail = VFX.trail(0.9, BAC.gold, 2.2, 22), helix = makeHelix(3, 0.45, 0.12, BAC.turq, 2.0, 16);
  Combat.projectiles.push(new Projectile({
    kind: 'ult', pos: origin, dir, speed: 42, radius: 0.85, pierce: false, maxDist: AB.hb.range * SU, glyphRange: 0, throughWalls: true,
    onMove(p, dt) { g.position.copy(p.pos); eye.material.rotation = p.t * 4; trail.push(p.pos); helix.push(p.pos, p.dir, p.t); FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(42), 'bastet', dt, { k: 2.6, size: 1.6 }); if (Math.random() < dt * 30) FX2.glow.spawn({ pos: p.pos, life: rand(0.35, 0.55), size: rand(0.2, 0.32), sizeEnd: 0.03, cell: FXA.wisp, stretch: 1.2, pal: 'turq', temp: 1, tempEnd: 0.4, int: 1.6, orbit: { c: p.pos, r: rand(0.6, 0.9), w: rand(8, 12), y: rand(-0.3, 0.3) } }); },
    onHit(d, hp) {
      Combat.deal(d, AB.hb.dmg[rank - 1] + AB.hb.scale * ppow(), 'ult', 'Huntress of Bast', false, true);
      d.applyStun(AB.hb.stun + 0.9);
      Sound.god('huntress_hit', { gain: 1.0, pos: hp });
      FX2.burst(hp, 'bastet', { size: 1.2, sparks: 44, embers: 24, puffs: 4 });
      VFX.flash(hp, BAC.amber, 20, 0.35);
      Game.hitStop(0.06, 0.15);
      huntressCarry(d, W.markPos, rank);
    },
    onDie(p, at, hit) { trail.alive = false; helix.kill(); disposeGroup(g); if (!hit) FX2.burst(at, 'bastet', { size: 0.8, sparks: 24, embers: 12, puffs: 3 }); },
  }));
}
function huntressCarry(d, mark, rank) {
  // the Huntress: a great spirit cat bounds in, takes the prey by the scruff and carries it to the pit
  const start = d.pos.clone().setY(0), side = rightOf(P.yaw);
  const cat = new SpectralBeast('cat', { style: 'ghost', size: 2.6, color: new THREE.Color(0.95, 0.5, 0.06), rim: BAC.turq, eyes: BAC.turq, tex: 0.7 });
  cat.alpha = 0; d.carried = true;
  Sound.god('huntress_carry', { gain: 0.95, pos: start });
  const from = start.clone().addScaledVector(side, 2.2);
  GodFX.add({ dur: 0.62, update(dt, time) {
    const k0 = clamp(this.t / 0.18, 0, 1);                       // bound in beside the prey
    const k = clamp((this.t - 0.2) / this.dur, 0, 1), e = easeInOut(k);
    const at = this.t < 0.2 ? _v1.lerpVectors(from, start, easeOutCubic(k0)) : _v1.lerpVectors(start, mark, e);
    const hop = this.t < 0.2 ? Math.sin(k0 * Math.PI) * 0.8 : Math.sin(k * Math.PI) * 1.4;
    cat.group.position.copy(at).setY(hop);
    const to = this.t < 0.2 ? _v2.copy(start).sub(from) : _v2.copy(mark).sub(start);
    cat.group.rotation.y = Math.atan2(to.x, to.z); cat.leap = 0.6;
    cat.alpha = Math.min(1, this.t * 7) * (1 - smoothstep(this.dur + 0.25, this.dur + 0.55, this.t));
    cat.update(dt, 16, time);
    if (this.t >= 0.2 && d.alive && k < 1) { const mouth = _v3.copy(at).addScaledVector(fwdOf(cat.group.rotation.y, _v4), 1.2); d.placeAt(mouth, 3); d.lift = hop + 0.9; }
    if (Math.random() < dt * 30) sandPuff(at, 1, 2, 0.7);
    if (Math.random() < dt * 30) FX2.trailTick(_v4.copy(at).setY(hop + 1.2), null, 'bastet', dt, { k: 1, size: 1.3, smoke: false });
    if (k >= 1 && !this.landed) { this.landed = true; d.carried = false; d.lift = 0; if (d.alive) d.placeAt(mark, 4); quicksand(mark, rank); Cam.shake = Math.max(Cam.shake, 0.4); }
    if (this.t > this.dur + 0.6) { cat.dispose(); d.carried = false; d.lift = 0; return false; }
    return true;
  }, dispose() { cat.dispose(); } });
}
function quicksand(c, rank) {
  const R = AB.hb.sandR * SU, dur = AB.hb.sandDur;
  Sound.god('quicksand_loop', { gain: 0.6, pos: c, dur });
  FX2.ring(c, 'sand', { radius: R + 1, dur: 0.45 });
  FX2.vortex(c.clone(), 'sand', { radius: R * 0.9, height: 1.8, dur, rate: 70, spin: 0.7, down: true, vr: -0.6 });
  FX2.mist(c, 'sand', { radius: R, rate: 10, dur, glow: 0.1, alpha: 0.55, size: 0.8, rise: 0.2, height: 0.4 });
  GodFX.decal(c, GodFX.sig.quicksand, BAC.sand, R * 2.2, dur, { spin: -1.6, intensity: 1.0 });
  GodFX.decal(c, VFX.dotTex, new THREE.Color(0.2, 0.12, 0.04), R * 2.0, dur, { intensity: 0.9 });
  GodFX.decal(c, GodFX.sig.cat, BAC.gold, R * 1.4, dur, { spin: 0.5, intensity: 0.8 });
  GodFX.storm(c, R, dur, 'sand', 160);
  GodFX.add({ update(dt) {
    this.acc = (this.acc || 0) + dt;
    for (const d of dummiesNear(c, R + 0.5)) {
      const to = _v1.set(c.x - d.pos.x, 0, c.z - d.pos.z), L = to.length();
      if (L > 0.3) d.shove(to.multiplyScalar(Math.min(L, 2.6 * dt) / L), 1.5);
      if (this.acc >= 0.5) Combat.deal(d, AB.hb.sand[rank - 1] + AB.hb.sandScale * ppow(), 'dot', 'Quicksand', false, true);
    }
    if (this.acc >= 0.5) this.acc = 0;
    if (Math.random() < dt * 20) { const a = rand(0, TAU), r = rand(0.5, R); FX2.smoke.spawn({ pos: V3(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r), vel: V3(-Math.cos(a) * 1.5, -0.1, -Math.sin(a) * 1.5), life: 1.0, size: rand(0.6, 1.0), sizeEnd: 0.4, frames: 16, pal: 'sand', temp: 0.1, tempEnd: 0, int: 1, alpha: 0.6, drag: 0.5 }); }
    return this.t < dur;
  } });
}

// ---- 5 · SLAYER OF APEP (playroom finale) ----------------------------------------------------
// The serpent follows its own path like a real snake: up out of the earth, rearing, down and round
// the foes in a tightening coil, the head rising over the middle to face Bastet. Then the Great Cat
// of Ra bounds over her with a blade of sunlight and the head comes off.
const APEP_HEAD_YAW = 0;            // the packed head model's own heading offset (radians about its neck)
const _ap = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), m: new THREE.Matrix4() };
function apepPath(A, s, out) {
  const C = A.c, B = A.toB, S = A.side, up = 0;
  if (s <= 0) return out.copy(C).setY(s - 0.5);
  if (s < 9) { const a = s / 9; out.copy(C).addScaledVector(B, 1.6 * a).addScaledVector(S, 1.1 * Math.sin(a * Math.PI)); out.y = -0.5 + 7.8 * (1 - (1 - a) * (1 - a)); return out; }
  if (s < 17) {           // down and out to the far side of the ring
    const a = (s - 9) / 8, apex = _ap.a.copy(C).addScaledVector(B, 1.6).setY(7.3), q0 = A.ringPt(0, _ap.b);
    const ctrl = _ap.c.copy(apex).lerp(q0, 0.5).setY(7.6);
    out.copy(apex).multiplyScalar((1 - a) * (1 - a)).addScaledVector(ctrl, 2 * a * (1 - a)).addScaledVector(q0, a * a); return out;
  }
  if (s < 57) return A.ringPt((s - 17) / 40, out);
  const a = Math.min(1, (s - 57) / 7), q1 = A.ringPt(1, _ap.b), hp = _ap.c.copy(C).addScaledVector(B, 1.3).setY(5.9);
  const e = a * a * (3 - 2 * a);
  return out.lerpVectors(q1, hp, e).setY(lerp(q1.y, hp.y, Math.sin(a * Math.PI / 2)));
}
function apepHeadS(t) {
  if (t < 0.5) return -2;
  if (t < 0.9) return lerp(-2, 9, easeOutCubic((t - 0.5) / 0.4));
  if (t < 1.15) return 9 + Math.sin((t - 0.9) * 12) * 0.25;
  if (t < 2.25) return lerp(9, 64, easeInOut((t - 1.15) / 1.1));
  return 64;
}
function castApep() {
  spend('ap'); startCd('ap');
  P.targeting = null;
  const c = groundTarget(AB.ap.range * SU, 6), yaw = P.yaw;
  const toB = _v1.copy(P.pos).sub(c).setY(0).normalize().clone(), side = V3(toB.z, 0, -toB.x);
  const A = { t: 0, c, toB, side, yaw, R0: AB.ap.radius, R1: 3.3, coiled: new Set(), fired: false, n: 72, L: 44, pts: [], cut: false };
  // the coil: 1.4 turns, tightening and rising, starting on the far side from Bastet
  const th0 = Math.atan2(-toB.z, -toB.x);
  A.ringPt = (u, out) => { const th = th0 + u * 1.4 * TAU, r = lerp(A.R0, A.R1, u); return out.set(c.x + Math.cos(th) * r, 0.55 + 1.7 * u + Math.sin(u * 18) * 0.08, c.z + Math.sin(th) * r); };
  for (let i = 0; i < A.n; i++) A.pts.push(new THREE.Vector3());
  A.body = new Serpent(A.n, 1.05, { len: 22, glow: 1.2 });
  A.head = summonModel('apep_head', { height: 3.2, rim: BAC.molten, rimK: 0.7, edge: BAC.molten, dir: 0.3, noise: 4, darken: 0.9 });
  A.head.reveal(1.12);
  BA.apep = A;
  Game.anim.play('roar');
  Cam.frameTarget = 1;
  WORLD.dim = 0.42; GodFX.tint(new THREE.Color(0.34, 0.1, 0.6), 0.7); PostFX.vigTarget = 0.65;
  Sound.god('ap_dusk', { gain: 1.0 });
  VFX.later(0.5, () => Sound.god('ap_emerge', { gain: 1.05 }));
  VFX.later(1.15, () => { Sound.god('ap_coil', { gain: 0.95 }); Sound.god('ap_cat', { gain: 1.0 }); });
  // "For Ra's light, I cut you DOWN!" - the last word (2.72 s in) falls on the cut (her summons was spoken while she aimed)
  const apLead = AP_CUT - 2.72;   // v11: DOWN lands 2.72 s into the line - start it early (offset) if the cut comes sooner
  VFX.later(Math.max(0, apLead), () => Sound.voice('fin_roar', { priority: 6, gain: 1.2, cooldown: 0, offset: Math.max(0, -apLead), hold: 3.4 - Math.max(0, -apLead) }));
  Sound.duckMusic(0.25, 4.4, 2.2);
  // the ground of chaos tears open where it will rise
  A.cracks = VFX.cracks(c, A.R0 + 1, AP_CUT + 2.4, { grow: 0.6, intensity: 1.1, color: BAC.chaos });
  A.hole = GodFX.portal(c.clone(), 1.6, BAC.chaos, new THREE.Color(0.02, 0.0, 0.03), { flat: true, normal: true, dark: 0.95, y: 0.04 });
  A.sigil = GodFX.decal(P.pos.clone().setY(0), GodFX.sig.cat, BAC.gold, 4.2, 9999, { spin: 0.4, intensity: 0.9, follow: P.pos }); A.sigil.hold = () => (A.fade ?? 1) * 0.9;
  FX2.burst(P.pos.clone().setY(1.3), 'bastet', { size: 0.8, sparks: 26, embers: 16, puffs: 0, bursts: 1 });
  A.mist = FX2.mist(c, 'chaos', { radius: A.R0 + 2, rate: 22, dur: AP_CUT + 0.8, glow: 0.5, alpha: 0.7, size: 1.1, rise: 0.6 });
  A.aura = FX2.aura(P.pos, 'bastet', { radius: 1.0, height: 2.2, rate: 26, dur: AP_CUT + 0.5 });
}
function updateApep(dt, t) {
  const A = BA.apep; if (!A) return;
  A.t += dt;
  const c = A.c;
  Cam.focus = Cam.focus || new THREE.Vector3(); Cam.focus.copy(P.pos).lerp(c, 0.45);
  // ---- the serpent
  if (!A.cut) {
    const sh = apepHeadS(A.t);
    for (let i = 0; i < A.n; i++) apepPath(A, sh - (i / (A.n - 1)) * A.L, A.pts[i]);
    // a living sway: the coil breathes, the reared neck weaves
    for (let i = 0; i < A.n; i++) { const p = A.pts[i]; p.y += Math.sin(t * 3 + i * 0.4) * 0.06 * (p.y > 0.2 ? 1 : 0); }
    if (A.t > 2.25) { const k = A.t - 2.25; for (let i = 0; i < 10; i++) A.pts[i].addScaledVector(A.side, Math.sin(k * 7) * 0.25 * (1 - i / 10)); }
    A.body.setPoints(A.pts, smoothstep(0.45, 0.6, A.t));
  }
  // head on the front of the body: the neck along the body, the jaws toward Bastet
  if (A.head && !A.headFall) {
    const p0 = A.pts[0], p1 = A.pts[2];
    const up = _v1.copy(p0).sub(p1).normalize(), look = _v2.copy(A.toB);
    look.addScaledVector(up, -look.dot(up)).normalize();
    const x = _v3.crossVectors(up, look).normalize();
    A.head.group.quaternion.setFromRotationMatrix(_ap.m.makeBasis(x, up, _v4.crossVectors(x, up))).multiply(_q1.setFromAxisAngle(V3(0, 1, 0), APEP_HEAD_YAW));
    A.head.group.position.copy(p0).addScaledVector(up, -0.35);
    A.head.group.visible = A.t > 0.55;
  }
  // chaos boiling out of the ground, molten embers off the scales
  if (!A.cut) {
    if (A.t > 0.55 && Math.random() < dt * 70) { const p = A.pts[Math.floor(rand(0, A.n * 0.7))]; if (p.y > 0) FX2.glow.spawn({ pos: p.clone().add(V3(rand(-0.6, 0.6), rand(-0.3, 0.6), rand(-0.6, 0.6))), vel: V3(rand(-0.6, 0.6), rand(0.5, 1.8), rand(-0.6, 0.6)), life: rand(0.6, 1.1), size: rand(0.05, 0.11), sizeEnd: 0.01, cell: FXA.ember, pal: 'molten', temp: 1.1, tempEnd: 0.4, int: 2, turb: 2.2, drag: 0.6 }); }
    // where the serpent drags itself over the floor it throws up dust and chaos-smoke
    if (A.t > 0.5 && Math.random() < dt * 24) { const p = A.pts[Math.floor(rand(4, A.n - 1))]; if (p.y < 1.2 && p.y > -0.4) { sandPuff(p.clone().setY(0), 1, 2.5, 0.8); FX2.smoke.spawn({ pos: p.clone().setY(0.4), vel: V3(rand(-0.6, 0.6), rand(0.6, 1.6), rand(-0.6, 0.6)), life: rand(1.0, 1.6), size: 0.7, sizeEnd: 2.0, frames: 16, pal: 'chaos', temp: 0.6, tempEnd: 0, int: 1.4, alpha: 0.7, drag: 1, turb: 0.6 }); } }
    if (!A.burst && A.t > 0.5) { A.burst = true; FX2.impact(c, 'chaos', { size: 1.5, debris: 22, glowRocks: true, ring: (A.R0 + 2) / 1.5, sparks: 50, dustPal: 'chaos', dustGlow: 0.5 }); }
    if (A.t > 0.5 && A.t < 1.0) Cam.shake = Math.max(Cam.shake, 0.4);
  }
  // ---- the coil closes on the foes: bound, dragged together
  if (A.t > 1.2 && !A.cut) {
    for (const d of dummiesNear(c, A.R0 + 1.2)) {
      if (!A.coiled.has(d)) { A.coiled.add(d); d.applyStun(AP_CUT - A.t + 0.3); GodFX.status(d, 'stun'); }
    }
    const k = smoothstep(1.2, 2.3, A.t);
    for (const d of A.coiled) {
      if (!d.alive) continue;
      const to = _v1.set(d.pos.x - c.x, 0, d.pos.z - c.z), L = to.length();
      const want = Math.min(L, lerp(L, A.R1 * 0.7, k));
      if (L > 0.01) { const p = _v2.copy(c).addScaledVector(to.multiplyScalar(1 / L), want); d.placeAt(p, 2); }
      d.lift = 0.3 * k;
    }
  }
  // ---- the Great Cat of Ra: rises behind Bastet, bounds over her and takes the head
  if (A.t >= 1.45 && !A.cat) {
    A.cat = new SpectralBeast('cat', { style: 'ghost', size: 4.6, color: new THREE.Color(0.8, 0.36, 0.03), rim: new THREE.Color(1.0, 0.6, 0.14), eyes: BAC.turq, tex: 0.6 });
    A.cat.alpha = 0;
    A.catFrom = P.pos.clone().addScaledVector(fwdOf(A.yaw), -3.2).setY(0);
    A.catTo = c.clone().addScaledVector(A.toB, -2.5).setY(0);
    A.blade = new THREE.Sprite(new THREE.SpriteMaterial({ map: GodFX.crescentTex || (GodFX.crescentTex = makeCrescentTexture()), color: new THREE.Color(1.0, 0.5, 0.08), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    A.blade.renderOrder = 12; scene.add(A.blade);
  }
  if (A.cat) {
    const L = A.cat, neck = A.pts[3];
    let p, yawC, leap = 0;
    if (A.t < 2.05) { p = A.catFrom; yawC = A.yaw; L.alpha = smoothstep(1.45, 1.75, A.t); }
    else if (A.t < AP_CUT + 0.4) {
      const k = clamp((A.t - 2.05) / (AP_CUT + 0.4 - 2.05), 0, 1);
      const over = _v1.copy(A.catFrom).lerp(A.catTo, k);
      over.y = Math.sin(k * Math.PI) * (neck.y + 1.5) * 1.05;
      p = over; yawC = Math.atan2(A.catTo.x - A.catFrom.x, A.catTo.z - A.catFrom.z); leap = 1;
    } else { p = A.catTo; yawC = A.yaw; L.alpha = Math.max(0, 1 - (A.t - AP_CUT - 0.4) / 1.0); }
    L.group.position.copy(p); L.group.rotation.set(0, yawC, 0); L.leap = leap;
    L.update(dt, A.t < 2.05 ? 0.4 : 6, t);
    if (Math.random() < dt * 70 * L.alpha) FX2.glow.spawn({ pos: p.clone().add(V3(rand(-1.5, 1.5), rand(0.5, 3.5), rand(-2, 2))), vel: V3(rand(-0.8, 0.8), rand(0.5, 1.8), rand(-0.8, 0.8)), life: rand(0.6, 1.2), size: rand(0.06, 0.13), sizeEnd: 0.01, cell: Math.random() < 0.3 ? FXA.star : FXA.ember, pal: 'bastet', temp: 1.1, tempEnd: 0.5, int: 2, turb: 2, drag: 0.5 });
    if (leap && Math.random() < dt * 40) FX2.trailTick(_v4.copy(p).setY(p.y + 2), null, 'bastet', dt, { k: 2, size: 2.2, smoke: false });
    if (A.t > AP_CUT + 1.5) { L.dispose(); A.cat = null; }
  }
  if (!A.cut && A.t >= AP_CUT) apepCut(A);
  if (A.cut) {
    const k = A.t - AP_CUT;
    // the blade's arc
    if (A.blade) { A.blade.material.opacity = 0.9 * Math.max(0, 1 - k / 0.4); A.blade.scale.setScalar(3 + 8 * easeOutCubic(Math.min(1, k / 0.16))); if (k > 0.45) { scene.remove(A.blade); A.blade.material.dispose(); A.blade = null; } }
    // the head tumbles down; the body sinks back into the dark as black sand
    if (A.head) {
      A.headV.y -= 18 * dt; A.head.group.position.addScaledVector(A.headV, dt);
      A.head.group.rotateOnAxis(A.headSpin, dt * 4);
      if (A.head.group.position.y < 0.6) { A.head.group.position.y = 0.6; A.headV.multiplyScalar(0.3); A.headV.y = Math.abs(A.headV.y) * 0.3; }
      A.head.reveal(1.12 * (1 - smoothstep(0.6, 1.5, k)));
      if (k > 1.6) { A.head.dispose(); A.head = null; }
    }
    if (A.body) {
      const sink = smoothstep(0.1, 1.2, k);
      for (let i = 0; i < A.n; i++) A.pts[i].y -= dt * (2 + 6 * sink) * (A.pts[i].y > -3 ? 1 : 0);
      A.body.setPoints(A.pts, 1 - 0.5 * sink);
      A.body.mat.opacity = 1 - smoothstep(0.5, 1.3, k);
      if (Math.random() < dt * 60 * (1 - sink)) { const p = A.pts[Math.floor(rand(4, A.n * 0.75))]; if (p.y > -0.5) FX2.smoke.spawn({ pos: p.clone(), vel: V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)), life: rand(1.0, 1.6), size: rand(0.7, 1.2), sizeEnd: 2.4, frames: 16, pal: Math.random() < 0.5 ? 'chaos' : 'sand', temp: 0.4, tempEnd: 0, int: 1.2, alpha: 0.75, drag: 1.2, gravity: -1, turb: 0.5 }); }
      if (k > 1.4) { A.body.dispose(); A.body = null; }
    }
    // golden rain over the field
    if (k < 1.8 && Math.random() < dt * 40) GodFX.spawn({ pos: V3(c.x + rand(-7, 7), rand(6, 9), c.z + rand(-7, 7)), vel: V3(0, -rand(3, 6), 0), life: rand(1.0, 1.6), size: rand(0.05, 0.1), sizeEnd: 0.02, color: BAC.gold, intensity: 1.6, cell: GX.star, rotVel: 2 });
    A.fade = 1 - smoothstep(1.4, 2.6, k);
    if (k > 1.6) { Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(BAC.gold, 0); PostFX.vigTarget = 0; WORLD.dim = 1; }
    if (k > 2.8) apepCleanup(A);
  }
}
function apepCut(A) {
  A.cut = true;
  const c = A.c, neck = A.pts[3].clone();
  Sound.god('ap_slash', { gain: 1.1 });
  Game.anim.play('huntress');
  Game.hitStop(0.16, 0.06);
  Cam.shake = 1.2; Cam.fovKick = 11;
  PostFX.shock(neck, 1.2, 0.85); PostFX.aberr = 0.008;
  WORLD.dim = 0.85; GodFX.tint(new THREE.Color(1.0, 0.62, 0.2), 0.35);
  VFX.flash(neck, BAC.gold, 22, 0.5);
  if (A.blade) { A.blade.position.copy(neck); A.blade.material.rotation = Math.atan2(A.toB.z, A.toB.x) * 0.2 + 0.5; }
  const tr = VFX.trail(1.2, BAC.gold, 1.8, 10); for (let i = -1; i <= 1; i += 0.25) tr.push(neck.clone().addScaledVector(A.side, i * 7).add(V3(0, -i * 1.2, 0))); VFX.later(0.12, () => { tr.alive = false; });
  // the blade of sunlight: a vast golden crescent through the neck
  const cutYaw = Math.atan2(A.side.x, A.side.z);
  FX2.slash(neck.clone(), cutYaw, 'bastet', { r0: 3.5, r1: 9, a0: -1.6, a1: 1.6, dur: 0.32, tilt: -0.5, int: 2.0 });
  FX2.slash(neck.clone().add(V3(0, 0.3, 0)), cutYaw + 0.2, 'molten', { r0: 2.5, r1: 7, a0: -1.4, a1: 1.4, dur: 0.28, tilt: -0.45, int: 1.4 });
  FX2.burst(neck, 'bastet', { size: 1.5, sparks: 90, embers: 50, puffs: 6, bursts: 1, int: 0.9 });
  FX2.burst(neck, 'chaos', { size: 1.4, sparks: 40, embers: 30, puffs: 10, bursts: 1, light: false });
  FX2.ring(c, 'bastet', { radius: A.R0 + 3, dur: 0.55 });
  VFX.later(0.12, () => FX2.ring(c, 'sand', { radius: A.R0 + 8, dur: 0.8, width: 0.05 }));
  FX2.distort.ring(neck, 26, 0.026, 0.6);
  FX2.debris(c.clone().setY(0.5), null, 24, 1.4, FX2.pal('molten'));
  A.rain = FX2.rain(c, 'bastet', { radius: 8, dur: 1.8, rate: 110, fall: 1.2 });
  A.hole.dead = true;
  // the head is off
  A.headFall = true;
  A.headV = A.toB.clone().multiplyScalar(4).add(V3(0, 5, 0)).addScaledVector(A.side, 2);
  A.headSpin = V3(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)).normalize();
  // everything in the coil takes the blade of sunlight (heavy, not an execution)
  let kills = 0;
  for (const d of dummiesNear(c, A.R0 + 1.5)) {
    const hp = d.pos.clone().setY(1.1);
    VFX.later(rand(0, 0.12), () => { if (!d.alive) return; Combat.deal(d, AP_DMG[0] + AP_DMG[1] * ppow(), 'final', 'Slayer of Apep', false, true); d.applyStun(AP_STUN); slashSpark(hp, 16, BAC.gold); if (!d.alive) kills++; });
  }
  for (const d of A.coiled) if (d.alive) d.lift = 0;
  VFX.later(1.6, () => { if (kills >= 2) Sound.voice('fin_line', { priority: 3, cooldown: 20 }); });
  VFX.later(0.6, () => Sound.god('ap_end', { gain: 0.9 }));
}
function apepCleanup(A) {
  if (BA.apep !== A) return;
  if (A.body) A.body.dispose(); if (A.head) A.head.dispose(); if (A.cat) A.cat.dispose();
  if (A.blade) { scene.remove(A.blade); A.blade.material.dispose(); }
  A.hole.dead = true; A.sigil.dead = true; if (A.mist) A.mist.dead = true; if (A.aura) A.aura.dead = true;
  for (const d of A.coiled) if (d.alive) d.lift = 0;
  Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(BAC.gold, 0); PostFX.vigTarget = 0; WORLD.dim = 1;
  BA.apep = null;
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const BASTET_INFO = {
  passive: { name: 'Nightstalker', kind: 'Passive · Lifesteal',
    text: 'Bastet lives off the hunt. She gains lifesteal on everything she does (6% +0.6% per level against gods, 6% +0.15% per level against everything else), and gods she hits are revealed for 6 seconds.',
    rows: () => [['Vs. gods', `${(nightstalker(true) * 100).toFixed(1)}%`], ['Vs. others', `${(nightstalker(false) * 100).toFixed(1)}%`]] },
  pk: { name: 'Pounce', kind: 'Leap · Area · Physical',
    text: 'Bastet leaps to the target location and damages all enemies around the landing. For 4 seconds she can press again to leap back to where she started (without damage), and while the leap back is available she has 25% more speed.',
    rows: () => { const r = rankOf('pk'); return [['Damage', `${AB.pk.dmg[r - 1]} (+90% of ${ppow()} PP) = ${Math.round(AB.pk.dmg[r - 1] + 0.9 * ppow())}`], ['Range', '55 · radius 20'], ['Leap back', '4 s · +25% speed'], ['Cooldown', `${cdOf('pk').toFixed(1)} s`]]; } },
  rw: { name: 'Razor Whip', kind: 'Cone · Bleed · Physical',
    text: 'Bastet lashes her nine-tailed whip in a cone in front of her. Everything hit bleeds – four ticks: immediately, then after 0.66, 1.33 and 2 seconds.',
    rows: () => { const r = rankOf('rw'); return [['Per tick', `${AB.rw.tick[r - 1]} (+25% PP) × 4`], ['Cone', '70° · range 35'], ['Cooldown', `${cdOf('rw').toFixed(1)} s`]]; } },
  ec: { name: 'Ensnaring Claw', kind: 'Line · Root · Physical',
    text: 'A spirit cat runs forward, invulnerable, until it hits something. All enemies around are then damaged and rooted (0.5 s), and the cat stays for 4 seconds: it attacks once a second and slows whatever it hits by 20% for 2 seconds.',
    rows: () => { const r = rankOf('ec'); return [['Damage', `${AB.ec.dmg[r - 1]} (+60% PP)`], ['Root', '0.5 s · radius 10'], ['Cat', `${AB.ec.catDmg[r - 1]} (+30% basic) per second for 4 s`], ['Cooldown', `${cdOf('ec').toFixed(1)} s`]]; } },
  hb: { name: 'Huntress of Bast', kind: 'Ultimate · Stun · Physical',
    text: 'Bastet becomes immune to CC and charges up for a moment, then fires a radiant projectile that passes through walls and stuns the first enemy it hits. A great spirit cat – the Huntress – seizes the prey by the scruff and carries it to the mark in front of Bastet, where the ground turns to quicksand that pulls enemies in and deals damage every half second for 3 seconds.',
    rows: () => { const r = rankOf('hb'); return [['Damage', `${AB.hb.dmg[r - 1]} (+90% PP)`], ['Quicksand', `${AB.hb.sand[r - 1]} (+15%) every 0.5 s for 3 s`], ['Range', '100'], ['Cooldown', `${cdOf('hb').toFixed(0)} s`]]; } },
  ap: { name: 'Slayer of Apep', kind: 'Final ability · The Chaos Serpent · True damage',
    text: 'Not in SMITE – from the Book of the Dead: “the Great Cat who cut off the head of the serpent beside the ished-tree in Heliopolis”. The sky sinks into dusk, and Apep – chaos itself – bursts up out of the ground, rears up and coils around the enemies. Ra\'s Great Cat rises behind Bastet, leaps over her with a blade of sunlight and cuts off the serpent\'s head. The blade cuts through everything in the coil.',
    rows: () => [['Center', `up to ${(AB.ap.range * SU).toFixed(0)} m away`], ['Coil', `${AB.ap.radius} m`], ['Damage', `${Math.round(AP_DMG[0] + AP_DMG[1] * ppow())} (${AP_DMG[0]} +${Math.round(AP_DMG[1] * 100)}% PP) + ${String(AP_STUN)} s stun`], ['Cost', `${costOf('ap')} mana`], ['Cooldown', `${cdOf('ap').toFixed(0)} s`]] },
};
registerGod({
  id: 'bastet', dbg: BA, name: 'Bastet', title: 'The Cat Goddess', epithet: 'Goddess of Cats', pantheon: 'Egyptian', role: 'Assassin',
  color: '#ffb347', glyphs: '𓃠 𓋹 𓆣 𓂀 𓃭', asset: 'bastet', stats: BASTET_STATS, order: ['pk', 'rw', 'ec', 'hb', 'ap'], ab: bastetAB,
  blurb: 'The deadly cat huntress with golden claws, whip and spirit cats – and the finale <em>Slayer of Apep</em>.',
  info: BASTET_INFO, physical: true, textColor: '#ffc85a', finalColor: '#ffa83a', fxColor: BAC.gold, accent: BAC.gold, accel: 10,
  init() { BA.combo = 0; BA.back = null; BA.windup = null; BA.revealed = new Map(); BA.healAcc = 0; },
  dispose() {
    if (BA.leap) { BA.leap.trail.alive = false; BA.leap = null; P.flying = false; P.y = 0; P.grounded = true; }
    if (BA.back && BA.back.mark) BA.back.mark.dead = true; BA.back = null;
    for (const c of BA.cats) { c.trail.alive = false; c.dispose(); } BA.cats = [];
    if (BA.windup) { BA.windup.mark.dead = true; BA.windup = null; }
    if (BA.apep) apepCleanup(BA.apep);
    for (const [, r] of BA.revealed) { scene.remove(r.s); r.s.material.dispose(); } BA.revealed.clear();
    WORLD.dim = 1; GodFX.tint(BAC.gold, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.focus = null; P.speedBuff = 1;
  },
  intercept(id) { if (BA.apep || BA.windup) return true; if (id === 'pk' && BA.back && !BA.leap) { pounceBack(); return true; } return !!BA.leap; },
  busy() { return !!(BA.apep || BA.leap || BA.windup); },
  cast(id) { ({ pk: castPounce, rw: castRazorWhip, ec: castEnsnaringClaw, hb: castHuntress, ap: castApep })[id](); },
  // while she aims her final she speaks the myth: "Apep stirs in the dark... and the Great Cat wakes."
  onArm(id) { if (id === 'ap') Sound.voice('fin_charge', { priority: 5, gain: 1.15, cooldown: 6, hold: 3.82 }); },
  basic: bastetBasic,
  moveOverride(dt) { if (BA.apep || BA.windup) { P.vel.set(0, 0, 0); return true; } return updateLeap(dt); },
  speedMul() { return BA.back ? 1.25 : 1; },
  noJump() { return !!BA.leap; },
  ghost() { return !!BA.leap; },
  animVel() { return BA.leap || BA.apep || BA.windup ? _v1.set(0, 0, 0) : P.vel; },
  eyeBoost() { return (BA.apep ? 1.5 : 0) + (BA.windup ? 1 : 0) + (BA.back ? 0.3 : 0); },
  lockYaw() { return !!BA.apep; },
  update(dt, t) {
    BA.comboT = Math.max(0, BA.comboT - dt);
    if (BA.back) { BA.back.t -= dt; if (BA.back.t <= 0) { BA.back.mark.dead = true; BA.back = null; } }
    updateWindup(dt); updateCats(dt, t); updateApep(dt, t);
    // revealed gods: a cat's eye over their heads
    for (const [d, r] of BA.revealed) { r.t -= dt; r.s.position.set(d.pos.x, d.height + 1.25, d.pos.z); r.s.material.opacity = Math.min(1, r.t * 2) * 0.85; if (r.t <= 0 || !d.alive) { scene.remove(r.s); r.s.material.dispose(); BA.revealed.delete(d); } }
    // Nightstalker heals show up as one number every 0.4 s
    BA.healT = (BA.healT || 0) + dt;
    if (BA.healT > 0.4) { BA.healT = 0; if (BA.healAcc >= 1) { Combat.texts.push({ x: P.pos.x + rand(-0.2, 0.2), y: 2.5, z: P.pos.z, text: '+' + Math.round(BA.healAcc), color: '#8dff9a', t: 0, small: true }); BA.healAcc = 0; } }
  },
  onDamage(d, amt) {
    const heal = amt * nightstalker(!!d.isGod);
    if (P.hp < maxHp()) { P.hp = Math.min(maxHp(), P.hp + heal); BA.healAcc += heal; }
    if (Math.random() < 0.35) lifeMotes(d.pos.clone().setY(1.1), 2);
    if (d.isGod) { let r = BA.revealed.get(d); if (!r) { const s = glowSprite(GodFX.cellTex(GX.cateye), BAC.gold, 0.55, 1.4); s.renderOrder = 12; scene.add(s); r = { s, t: 6 }; BA.revealed.set(d, r); } r.t = 6; }
  },
  targeter() {
    if (P.targeting === 'pk') { const c = groundTarget(AB.pk.range * SU, 3); circleTarget.show(c, AB.pk.radius * SU, BAC.gold); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.5, 0.5); }
    else if (P.targeting === 'ap') { const c = groundTarget(AB.ap.range * SU, 6); circleTarget.show(c, AB.ap.radius, BAC.chaos); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.4, 0.4); }
  },
  armed(id) { return (id === 'pk' && !!BA.back) || (id === 'ap' && !!BA.apep) || (id === 'hb' && !!BA.windup); },
  stack(id) { return id === 'pk' && BA.back ? '↩' : ''; },
  buffs() { return [{ icon: 'bastet_back', on: !!BA.back, n: '', t: BA.back ? Math.ceil(BA.back.t) + 's' : '' }]; },
  onDummyDeath(d, p) { for (let i = 0; i < 10; i++) VFX.add.spawn({ pos: p.clone().add(V3(rand(-0.4, 0.4), rand(0.4, 1.6), rand(-0.4, 0.4))), vel: V3(rand(-1, 1), rand(1, 2.5), rand(-1, 1)), life: rand(0.8, 1.4), size: rand(0.06, 0.12), sizeEnd: 0.01, color: BAC.gold, intensity: 2, cell: FX.ember, drag: 0.6 }); },
  icon(ctx, S, id) {
    const gold = (fn, col = '#ffd27a', blur = 16) => glowText(ctx, fn, col, blur);
    if (id === 'passive') { iconBase(ctx, S, '#7a1a1a', '#1a0404'); gold(() => { drawCatHead(ctx, S / 2, S * 0.5, S * 0.3, '#ffe9a8'); ctx.fillStyle = '#ff5050'; ctx.beginPath(); ctx.arc(S * 0.7, S * 0.72, S * 0.09, 0, TAU); ctx.fill(); }, '#ff8a5a'); }
    else if (id === 'pk') { iconBase(ctx, S, '#c08a22', '#2a1604'); gold(() => { drawCatHead(ctx, S * 0.62, S * 0.4, S * 0.2, '#fff1c0'); ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = S * 0.04; ctx.beginPath(); ctx.moveTo(S * 0.12, S * 0.85); ctx.quadraticCurveTo(S * 0.3, S * 0.3, S * 0.5, S * 0.42); ctx.stroke(); }); }
    else if (id === 'rw') { iconBase(ctx, S, '#b0471a', '#2a0a04'); gold(() => { ctx.strokeStyle = '#fff1c0'; ctx.lineWidth = S * 0.03; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(S * 0.2, S * 0.8); ctx.quadraticCurveTo(S * (0.3 + k * 0.08), S * 0.2, S * (0.6 + k * 0.08), S * (0.25 + k * 0.1)); ctx.stroke(); } ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(S * 0.8, S * 0.7, S * 0.06, 0, TAU); ctx.fill(); }, '#ff9a5a'); }
    else if (id === 'ec') { iconBase(ctx, S, '#1a8a7a', '#04201c'); gold(() => { drawCatHead(ctx, S / 2, S * 0.48, S * 0.3, '#fff1c0'); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = S * 0.035; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.42, 0, TAU); ctx.stroke(); }, '#5affe0'); }
    else if (id === 'hb') { iconBase(ctx, S, '#d0a030', '#2a1804'); gold(() => { ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.ellipse(S / 2, S / 2, S * 0.36, S * 0.2, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.ellipse(S / 2, S / 2, S * 0.05, S * 0.17, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }); }
    else if (id === 'ap') { iconBase(ctx, S, '#5a1a8a', '#0c0418'); gold(() => { ctx.strokeStyle = '#c070ff'; ctx.lineWidth = S * 0.09; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40, th = a * TAU * 1.3; ctx.lineTo(S / 2 + Math.cos(th) * S * (0.36 - a * 0.18), S / 2 + Math.sin(th) * S * (0.36 - a * 0.18)); } ctx.stroke(); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.75, S * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); drawCatHead(ctx, S * 0.5, S * 0.5, S * 0.12, '#fff1c0'); }, '#ffb347', 18); }
    else if (id === 'bastet_back') { iconBase(ctx, S, '#1a8a7a', '#04201c'); gold(() => { ctx.strokeStyle = '#fff1c0'; ctx.lineWidth = S * 0.08; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.26, Math.PI * 0.2, Math.PI * 1.7); ctx.stroke(); }); }
    else return false;
    return true;
  },
});
function drawCatHead(ctx, x, y, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.05); ctx.lineTo(x - s * 0.85, y - s * 1.05); ctx.lineTo(x - s * 0.35, y - s * 0.55); ctx.quadraticCurveTo(x, y - s * 0.7, x + s * 0.35, y - s * 0.55); ctx.lineTo(x + s * 0.85, y - s * 1.05); ctx.lineTo(x + s, y - s * 0.05);
  ctx.quadraticCurveTo(x + s * 0.9, y + s * 0.85, x, y + s * 0.9); ctx.quadraticCurveTo(x - s * 0.9, y + s * 0.85, x - s, y - s * 0.05); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * s * 0.38, y, s * 0.17, s * 0.1, sx * 0.3, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawLionHead(ctx, x, y, s, col) {
  ctx.save(); ctx.fillStyle = col;
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6); ctx.lineTo(x + Math.cos(a + 0.17) * s * 1.05, y + Math.sin(a + 0.17) * s * 1.05); ctx.lineTo(x + Math.cos(a + 0.34) * s * 0.6, y + Math.sin(a + 0.34) * s * 0.6); ctx.fill(); }
  drawCatHead(ctx, x, y + s * 0.05, s * 0.62, col);
  ctx.restore();
}


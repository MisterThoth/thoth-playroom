// ============================================================================
// BACCHUS, god of wine and revelry (SMITE 2 kit: Drunk-O-Meter, Chug, Belly Flop, Belch of the Gods,
// Intoxicate) + the playroom finale DEADLY FART: he clutches his belly, braces against the ground and
// lets go - a green shockwave, a little mushroom cloud, and a toxic fog that hangs around him for six
// seconds and chokes everything in it.
// ============================================================================
const BACCHUS_STATS = { hp: [470, 88], mp: [230, 40], speed: 360, range: 12, as: [0.9, 0.012], basic: [38, 2.0], basicScale: 0.35, hp5: [10, 0.9], mp5: [4.8, 0.4] };
const BAC_TIPSY = 30, BAC_SMASHED = 60;
// the final's beats (s after the cast) and where the key words fall in the processed voice lines
const BAC_DF = { strain: 1.4, release: 3.6, cloud: 6.0, radius: 6.5, tick: 0.5 };
const BAC_IX = 1.5;   // Intoxicate: the wine wave bursts this long after the cast (on "ME!")
const BAC_VOX = { fart: 1.17, me: 1.415 };   // v13 (Callum)   // "Deadly... FART!" (vowel hit) and "Drink... with... ME!" (onset), measured on assets/voice/bacchus
const BC = { drunk: 0, hold: 0, combo: 0, comboT: 0, chug: null, chugBuff: 0, nextHit: 0, smashBuff: 0, flop: null, belch: null, intox: null, fart: null, cloud: null,
  drunks: new Set(), lifts: [], hicT: 9, swayT: 0, auras: [] };
const BCC = {
  wine: new THREE.Color(0.62, 0.03, 0.2), purple: new THREE.Color(0.5, 0.06, 0.75), green: new THREE.Color(0.35, 0.95, 0.08), toxic: new THREE.Color(0.2, 0.75, 0.0),
  gold: new THREE.Color(1.0, 0.72, 0.25), magenta: new THREE.Color(0.85, 0.12, 0.45), wineDark: new THREE.Color(0.16, 0.0, 0.05), gasDark: new THREE.Color(0.04, 0.09, 0.0),
};
const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3(), _bt1 = new THREE.Vector3(), _bt2 = new THREE.Vector3(), _bt3 = new THREE.Vector3();
const bacchusAB = {
  ch: { id: 'ch', name: 'Chug', heal: [30, 42, 55, 67, 80], healScale: 0.15, buff: [0.08, 0.1, 0.12, 0.14, 0.16], bonus: [30, 40, 50, 60, 70], bonusScale: 0.3, drunk: [40, 46, 52, 58, 64], cost: [20, 20, 20, 20, 20], cd: [10, 10, 10, 10, 10], dur: 6 },
  bf: { id: 'bf', name: 'Belly Flop', dmg: [80, 135, 190, 245, 300], scale: 0.6, cost: [60, 65, 70, 75, 80], cd: [15, 15, 15, 15, 15], range: 55, radius: 15, air: 0.75, slow: 0.2, targeted: true },
  bg: { id: 'bg', name: 'Belch of the Gods', tick: [30, 45, 60, 75, 90], scale: 0.2, cost: [60, 65, 70, 75, 80], cd: [12, 11.5, 11, 10.5, 10], range: 35, arc: 90, dur: 1.5, antiheal: 0.4, stun: [0.9, 0.95, 1.0, 1.05, 1.1] },
  ix: { id: 'ix', name: 'Intoxicate', dmg: [230, 300, 370, 440, 510], scale: 0.7, cost: [90, 90, 90, 90, 90], cd: [90, 90, 90, 90, 90], radius: 35, dur: 4, slow: 0.25, buff: 0.15 },
  // balance (ability 5 >= 2 x ability 4): the blast alone is ~1.95 x Intoxicate at rank 5 (510 + 0.7 MP), with the 12 cloud
  // ticks ~2.9 x; the knock-up and the cloud's slow are stronger CC than Intoxicate's 25 % slow
  // (was blast 140 + 0.4 MP, ticks 22 + 0.06 MP, knock-up 0.55 s, slow 15 % - weaker than the 4)
  df: { id: 'df', name: 'Deadly Fart', blast: 940, blastScale: 1.45, tick: 30, tickScale: 0.08, knock: 0.9, slow: 0.3, cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33] },
};

// ---- where things are on his body ---------------------------------------------------------
function bacMouth(out) { return out.setFromMatrixPosition(Game.thoth.bones.head.matrixWorld).addScaledVector(fwdOf(P.yaw, _bt3), 0.17).add(_bt3.set(0, 0.06, 0)); }
function bacHips(out) { return out.setFromMatrixPosition(Game.thoth.hips.matrixWorld); }
function bacJugTip(out) { const p = Game.thoth.prop; return p ? p.localToWorld(out.copy(p.userData.tip)) : handPos('R', out); }

// ---- the stuff of his magic: wine, grapes, vine leaves, fizz and (later) gas -----------------
// wine flung about: droplets that fall and bead on the floor, a fine red mist, a few sparkles
function bacWine(p, n = 16, s = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(1.5, 4.5) * s;
    FX2.solid.spawn({ pos: _bt1.copy(p).add(_bt2.set(rand(-0.1, 0.1), rand(-0.1, 0.1), rand(-0.1, 0.1))), vel: V3(Math.cos(a) * sp, rand(1.5, 4.5) * up * s, Math.sin(a) * sp), life: rand(0.6, 1.1), size: rand(0.05, 0.12) * Math.sqrt(s), sizeEnd: 0.03, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -13, drag: 0.4, floor: true, stretch: 1.4 });
  }
  for (let i = 0; i < Math.ceil(n / 5); i++) FX2.smoke.spawn({ pos: p, vel: V3(rand(-1.2, 1.2), rand(0.2, 1.2), rand(-1.2, 1.2)).multiplyScalar(s), life: rand(0.7, 1.2), size: 0.3 * s, sizeEnd: 1.2 * s, frames: 16, pal: 'wine', temp: 0.25, tempEnd: 0, int: 1, alpha: 0.5, drag: 2.2, turb: 0.6 });
  for (let i = 0; i < Math.ceil(n / 3); i++) FX2.glow.spawn({ pos: p, vel: V3(rand(-3, 3), rand(0.5, 3.5), rand(-3, 3)).multiplyScalar(s), life: rand(0.3, 0.6), size: rand(0.05, 0.09), sizeEnd: 0.01, cell: FXA.spark, stretch: 2, pal: 'bacchus', temp: 1.1, tempEnd: 0.5, int: 1.8, drag: 2, gravity: -6 });
}
// glowing grapes: purple bubbles drifting up and swirling
function bacGrapes(p, n = 8, r = 1.2) {
  for (let i = 0; i < n; i++) FX2.glow.spawn({ pos: _bt1.copy(p).add(_bt2.set(rand(-r, r), rand(-0.3, 0.9), rand(-r, r))), vel: V3(rand(-0.4, 0.4), rand(0.4, 1.4), rand(-0.4, 0.4)), life: rand(0.8, 1.5), size: rand(0.08, 0.16), sizeEnd: 0.03, cell: FXA.bubble, pal: 'grape', temp: 0.9, tempEnd: 0.4, int: 1.5, turb: 1.5, drag: 0.6 });
}
// vine leaves whirling around a point (lit, so they read as real leaves)
function bacLeaves(c, n = 10, r = 1.4, h = 2, dir = 1) {
  for (let i = 0; i < n; i++) FX2.solid.spawn({ pos: c, life: rand(0.9, 1.6), size: rand(0.2, 0.32), sizeEnd: 0.12, cell: FXA.leaf, pal: 'leaf', alpha: 1, rot: rand(0, TAU), rotVel: rand(-5, 5), orbit: { c, r: r * rand(0.7, 1.2), w: rand(2.6, 4.2) * dir, vy: rand(0.4, 1.4), y: rand(0.1, h * 0.6), wob: 0.12 } });
}
// sparkling wine: tiny bubbles fizzing upward
function bacFizz(p, n = 6, r = 0.15) {
  for (let i = 0; i < n; i++) FX2.glow.spawn({ pos: _bt1.copy(p).add(_bt2.set(rand(-r, r), rand(-0.05, 0.05), rand(-r, r))), vel: V3(rand(-0.2, 0.2), rand(0.6, 1.6), rand(-0.2, 0.2)), life: rand(0.5, 0.9), size: rand(0.04, 0.08), sizeEnd: 0.02, cell: FXA.bubble, pal: 'bacchus', temp: 1.0, tempEnd: 0.6, int: 1.6, turb: 2.5 });
}
// a puff of green gas (dark toxic body or the brighter fart green)
function bacGas(p, vel, size = 1, glow = 0.35, alpha = 0.7, life = 1.6, pal = null) {
  FX2.smoke.spawn({ pos: p, vel, life: rand(0.8, 1.2) * life, size: 0.5 * size, sizeEnd: 2.2 * size, frames: 16, pal: pal || (Math.random() < 0.6 ? 'toxic' : 'fart'), temp: glow, tempEnd: 0, int: 1.2, alpha, drag: 1.6, turb: 0.7, fadeIn: 0.08, fadeOut: 0.5, rotVel: rand(-0.6, 0.6) });
}
// one more fart, heard AND seen: a sound from the set, a jet of gas out behind him, bubbles, a jolt
const BAC_FARTS = { squeak: 4, toot: 8, sputter: 5 };
function bacToot(kind, power = 1) {
  const n = 1 + Math.floor(Math.random() * BAC_FARTS[kind]);
  Sound.god(`df_${kind}${n}`, { gain: (kind === 'squeak' ? 0.75 : 0.95) * rand(0.9, 1.05) * Math.min(1.2, 0.7 + 0.4 * power), rate: rand(0.94, 1.06) });
  const F = BC.fart; if (!F) return;
  const back = fwdOf(P.yaw, _b1).multiplyScalar(-1);
  const jets = kind === 'squeak' ? 2 : kind === 'toot' ? 4 : 6;
  for (let i = 0; i < jets * power; i++) bacGas(F.behind, back.clone().multiplyScalar(rand(1.2, 3.2) * (kind === 'squeak' ? 0.6 : 1)).add(_b2.set(rand(-0.6, 0.6), rand(-0.2, 0.7), rand(-0.6, 0.6))), (kind === 'squeak' ? 0.35 : 0.7) * power, kind === 'sputter' ? 0.25 : 0.45, 0.7, 1.1, kind === 'sputter' && Math.random() < 0.5 ? 'toxic' : 'fart');
  for (let i = 0; i < (kind === 'sputter' ? 10 : 4); i++) FX2.glow.spawn({ pos: F.behind, vel: back.clone().multiplyScalar(rand(1, 3)).add(_b2.set(rand(-1, 1), rand(-0.5, 1.2), rand(-1, 1))), life: rand(0.4, 0.8), size: rand(0.05, 0.11), sizeEnd: 0.02, cell: FXA.bubble, pal: 'fart', temp: 1, tempEnd: 0.5, int: 1.6, gravity: kind === 'sputter' ? -4 : 0, drag: 1.4, turb: 2 });
  if (kind !== 'squeak') { FX2.distort.heat(F.behind.clone(), 1.6 * power, 0.008, 0.4); Cam.shake = Math.max(Cam.shake, 0.06 * power); }
}
// a crown of wine thrown up all around a landing
function bacCrown(c, R, n = 60) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(-0.1, 0.1), r = R * rand(0.25, 0.6), ox = Math.cos(a), oz = Math.sin(a);
    FX2.solid.spawn({ pos: V3(c.x + ox * r, 0.2, c.z + oz * r), vel: V3(ox * rand(3, 7), rand(4, 8), oz * rand(3, 7)), life: rand(0.8, 1.3), size: rand(0.07, 0.15), sizeEnd: 0.04, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -14, drag: 0.3, floor: true, stretch: 1.6 });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, ox = Math.cos(a), oz = Math.sin(a);
    FX2.smoke.spawn({ pos: V3(c.x + ox * R * 0.4, 0.4, c.z + oz * R * 0.4), vel: V3(ox * rand(3, 5), rand(0.5, 1.6), oz * rand(3, 5)), life: rand(1.0, 1.5), size: 0.6, sizeEnd: 2.2, frames: 16, pal: 'wine', temp: 0.3, tempEnd: 0, int: 1, alpha: 0.6, drag: 2.5, turb: 0.5 });
  }
}
// a knock-up: the foe is thrown into the air and lands (stunned while it flies)
function bacKnockUp(d, dur = 0.6, h = 1.2) {
  if (!d.alive) return;
  d.applyStun(dur + 0.1);
  BC.lifts = BC.lifts.filter((L) => L.d !== d);
  BC.lifts.push({ d, t: 0, dur, h });
}
function updateLifts(dt) {
  BC.lifts = BC.lifts.filter((L) => {
    L.t += dt;
    const k = Math.min(1, L.t / L.dur);
    L.d.lift = Math.sin(k * Math.PI) * L.h * (1 - k * 0.15);
    if (k >= 1 || !L.d.alive) { L.d.lift = 0; if (L.d.alive) FX2.smoke.spawn({ pos: L.d.pos.clone().setY(0.2), vel: V3(0, 0.4, 0), life: 0.9, size: 0.5, sizeEnd: 1.6, frames: 16, pal: 'dust', temp: 0.1, tempEnd: 0, int: 1, alpha: 0.6, drag: 2 }); return false; }
    return true;
  });
}
// the wine flung off the jug while it swings: droplets thrown along the arc, a wine-dark ribbon
function bacJugTrail(dur, rate = 70, ribbon = 0.24) {
  const prop = Game.thoth.prop; if (!prop) return;
  const prev = new THREE.Vector3(), cur = new THREE.Vector3(), v = new THREE.Vector3();
  const tr = ribbon ? VFX.trail(ribbon, BCC.wine, 2.2, 14) : null;
  let first = true, acc = 0;
  GodFX.add({ update(dt) {
    prop.localToWorld(cur.copy(prop.userData.tip));
    if (!first && dt > 0) {
      v.copy(cur).sub(prev).divideScalar(dt);
      const sp = v.length();
      if (tr) tr.push(cur);
      acc += rate * dt * clamp(sp / 6, 0.15, 2);
      while (acc > 1) {
        acc--;
        FX2.solid.spawn({ pos: cur, vel: v.clone().multiplyScalar(rand(0.35, 0.7)).add(_b1.set(rand(-0.8, 0.8), rand(0, 1.2), rand(-0.8, 0.8))), life: rand(0.5, 0.9), size: rand(0.04, 0.09), sizeEnd: 0.03, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -12, drag: 0.5, floor: true, stretch: 1.6 });
        if (Math.random() < 0.35) FX2.glow.spawn({ pos: cur, vel: v.clone().multiplyScalar(0.2), life: rand(0.2, 0.35), size: rand(0.2, 0.32), sizeEnd: 0.05, cell: FXA.wisp, pal: 'bacchus', temp: 0.9, tempEnd: 0.4, int: 1.3, rotVel: rand(-6, 6) });
      }
    }
    first = false; prev.copy(cur);
    if (this.t > dur) { if (tr) tr.alive = false; return false; }
    return true;
  }, dispose() { if (tr) tr.alive = false; } });
}

// ---- the Drunk-O-Meter ----------------------------------------------------------------------
const bacLevel = (x = BC.drunk) => (x >= BAC_SMASHED ? 2 : x >= BAC_TIPSY ? 1 : 0);
const bacTipsy = () => BC.drunk >= BAC_TIPSY;
const bacSmashed = () => BC.drunk >= BAC_SMASHED;
function addDrunk(v) {
  const before = bacLevel();
  BC.drunk = clamp(BC.drunk + v, 0, 100); BC.hold = 2.5;
  if (bacLevel() > before) drunkLevelUp(bacLevel());
}
function drunkLevelUp(level) {
  Sound.god('drunk_up', { gain: 0.95 });
  const c = P.pos.clone().setY(1.2), pal = level > 1 ? 'bacchus' : 'grape';
  FX2.burst(c, pal, { size: 0.7, sparks: 30, embers: 20, puffs: 2, bursts: 1, int: 0.85 });
  FX2.ring(P.pos, pal, { radius: 3, dur: 0.5 });
  bacGrapes(P.pos.clone().setY(1.0), 18, 1.4);
  bacLeaves(P.pos, 10, 1.1, 2.2);
  HUD.toast(level > 1 ? 'Drunk-O-Meter · SMASHED!' : 'Drunk-O-Meter · Tipsy');
  VFX.later(0.55, () => Sound.voice(level > 1 ? 'passive' : 'hic', { priority: 2, cooldown: 4 }));
}
// a hiccup: a jolt, a burst of bubbles from his mouth
function bacHiccup() {
  Sound.voice('hic', { priority: 1, cooldown: 3 });
  const m = bacMouth(new THREE.Vector3());
  bacFizz(m, 10, 0.08); bacGrapes(m, 3, 0.2);
  Cam.shake = Math.max(Cam.shake, 0.06);
}

// ---- basic attack: the jug, swung like a club - backhand, forehand, and an overhead smash -----------
function busyNow() { return !!(BC.flop || BC.belch || (BC.intox && !BC.intox.burst) || (BC.fart && !BC.fart.released)); }
function bacchusBasic() {
  if (busyNow() || (BC.chug && BC.chug.t < 1.05)) return;
  P.atkCd = 1 / attackSpeed();
  if (BC.comboT <= 0) BC.combo = 0;
  const step = BC.combo % 3; BC.combo++; BC.comboT = 1.8;
  const heavy = step === 2;
  Game.anim.play(['swing1', 'swing2', 'smash'][step], { dur: Math.min(heavy ? 0.72 : 0.55, P.atkCd * 0.95) });
  P.atkPenalty = Math.min(0.35, P.atkCd * 0.5);
  Sound.god(`swing${1 + step}`, { gain: 0.9 });
  bacJugTrail(heavy ? 0.55 : 0.36, heavy ? 110 : 60, heavy ? 0.34 : 0.24);
  VFX.later(heavy ? 0.36 : step ? 0.12 : 0.17, () => {
    const c = P.pos.clone(), dir = fwdOf(P.yaw), yaw = P.yaw, charged = BC.nextHit > 0;
    // the arc: a wine-dark crescent through the swing (the smash leaves its trail of wine instead)
    if (!heavy) FX2.slash(V3(c.x, 1.15, c.z), yaw, step ? 'wine' : 'bacchus', { r0: 1.0, r1: 2.45, a0: step ? 1.35 : -1.35, a1: step ? -1.35 : 1.35, dur: 0.26, tilt: step ? 0.22 : -0.22, int: 1.5 });
    const R = BACCHUS_STATS.range * SU * 1.1;
    const near = dummiesInCone(c, dir, R, heavy ? 0.9 : 0.8).sort((a, b) => a.pos.distanceToSquared(c) - b.pos.distanceToSquared(c));
    const hits = heavy || charged ? near : near.slice(0, 1);
    if (heavy) {   // the smash meets the floor: a wine-dark crater and a splash
      const at = c.clone().addScaledVector(dir, 1.9).setY(0);
      FX2.impact(at, 'wine', { size: 0.7, ring: 3, sparks: 22, debris: 12, dustPal: 'dust', dustGlow: 0.05 });
      bacWine(at.clone().setY(0.3), 24, 1.0, 1.5);
      bacCrown(at, 1.6, 26);
      Cam.shake = Math.max(Cam.shake, 0.18);
    }
    if (charged) {   // the first swing after a Chug: the jug bursts with wine
      BC.nextHit = 0;
      const at = c.clone().addScaledVector(dir, 1.6).setY(1.1);
      FX2.burst(at, 'bacchus', { size: 0.9, sparks: 36, embers: 18, puffs: 3, bursts: 1, int: 0.9 });
      bacWine(at, 26, 1.2); bacGrapes(at, 10, 0.8);
      FX2.ring(at.clone().setY(0), 'wine', { radius: 2.8, dur: 0.4 });
    }
    for (const d of hits) {
      const rank = rankOf('ch');
      Combat.deal(d, basicDamage() * (heavy ? 1.3 : 1) + (charged ? AB.ch.bonus[rank - 1] + AB.ch.bonusScale * settings.power : 0), 'basic', charged ? 'Wine Jug (Chug)' : 'Wine Jug');
      const hp = d.pos.clone().setY(1.1);
      FX2.burst(hp, 'bacchus', { size: heavy ? 0.6 : 0.4, sparks: heavy ? 22 : 12, embers: 8, puffs: 1, bursts: 1, distort: heavy });
      bacWine(hp, heavy ? 20 : 12, heavy ? 1.1 : 0.8);
      Sound.god(`hit${1 + (step % 2)}`, { gain: 0.8, pos: d.pos });
      addDrunk(2);
    }
    if (Math.random() < 0.06) Sound.voice('eff', { cooldown: 6 });
  });
}

// ---- 1 · Chug: he drinks deep - a heal, a power buff, a bonus on the next swing, and drunk --------
function castChug() {
  spend('ch'); startCd('ch');
  const rank = rankOf('ch');
  Game.anim.play('chug');
  Sound.god('chug', { gain: 1.0, delay: 0.35 });
  BC.chug = { t: 0, rank, done: false, mouth: new THREE.Vector3(), tip: new THREE.Vector3() };
  bacLeaves(P.pos, 8, 1.0, 2.0);
}
function updateChug(dt) {
  const C = BC.chug; if (!C) return;
  C.t += dt;
  bacMouth(C.mouth); bacJugTip(C.tip);
  // the jug tipped to his lips: wine pours from the spout, some of it spills down his beard
  if (C.t > 0.48 && C.t < 0.98) {
    if (Math.random() < dt * 70) FX2.solid.spawn({ pos: C.tip, vel: _b1.copy(C.mouth).sub(C.tip).multiplyScalar(3).add(_v4.set(rand(-0.2, 0.2), rand(-0.1, 0.3), rand(-0.2, 0.2))), life: rand(0.25, 0.4), size: rand(0.05, 0.09), sizeEnd: 0.03, cell: FXA.drop, pal: 'wine', alpha: 0.95, stretch: 2, attract: { x: C.mouth.x, y: C.mouth.y, z: C.mouth.z, strength: 30, kill: 0.08 } });
    if (Math.random() < dt * 16) FX2.solid.spawn({ pos: C.mouth, vel: V3(rand(-0.3, 0.3), rand(-0.6, 0), rand(-0.3, 0.3)), life: rand(0.6, 1.0), size: rand(0.04, 0.07), sizeEnd: 0.03, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -11, floor: true, stretch: 1.4 });
    if (Math.random() < dt * 30) bacFizz(C.tip, 1, 0.05);
  }
  // the gulps land: healed, buffed, and a little drunker
  if (!C.done && C.t >= 0.95) {
    C.done = true;
    const r = C.rank, heal = AB.ch.heal[r - 1] + AB.ch.healScale * settings.power;
    P.hp = Math.min(maxHp(), P.hp + heal);
    Combat.texts.push({ x: P.pos.x, y: 2.6, z: P.pos.z, text: '+' + Math.round(heal), color: '#8dff9a', t: 0 });
    BC.chugBuff = AB.ch.dur; BC.nextHit = AB.ch.dur;
    addDrunk(AB.ch.drunk[r - 1]);
    Sound.voice('a1', { chance: 0.8, cooldown: 5 });
    const c = P.pos.clone().setY(1.2);
    FX2.burst(c, 'bacchus', { size: 0.65, sparks: 26, embers: 22, puffs: 2, bursts: 1, int: 0.8, distort: false });
    FX2.ring(P.pos, 'bacchus', { radius: 2.4, dur: 0.45, width: 0.06 });
    BC.auras.push(FX2.aura(P.pos, 'bacchus', { radius: 0.95, height: 2.2, rate: 18, dur: AB.ch.dur }));
    bacGrapes(c, 14, 1.0); bacFizz(C.mouth, 14, 0.12); bacWine(C.mouth, 16, 0.55, 0.4);
    FX2.light(P.pos.clone().setY(1.4), FX2.pal('bacchus').light, 14, 0.5);
  }
  if (C.t > 1.35) BC.chug = null;
}

// ---- 2 · Belly Flop: a mighty, comedic body slam ---------------------------------------------------
// crouch  - he sinks into his knees, leaning in, the belly wobbling (clip 'flop' 0-0.3 s: the wind-up)
// air     - a real ballistic arc (constant horizontal speed, a parabola whose height grows with the distance);
//           the arms fly up over his head (clip 'jump' 0.48-0.64) and the whole body rotates forward about the
//           hips until he is flat, belly down, at the apex; a little flutter-kick on the way down
// lie     - SPLAT: squash, ground shock, a crown of wine; the legs and arms bounce, the belly ripples
// up      - he pushes himself up (clip 'cast_push': arms under the shoulders) and rocks back onto his feet
// The kit drives the body pitch and a world-space post layer on the rig (RigAnimator.post): spine bulge for
// the belly, limb bounce, then it pins the rig - hips on the arc in the air, the feet on the floor while he
// stands up (no sliding) - and lifts it so no hand, knee, head or belly sinks into the floor.
const BAC_FLOP = { crouch: 0.24, lie: 0.34, getup: 0.66, maxPitch: 1.62, bellyR: 0.36, approachY: 0.48 };
const FLOP_CONTACTS = [['LeftFoot', 'foot'], ['RightFoot', 'foot'], ['LeftToeBase', 0.03], ['RightToeBase', 0.03], ['LeftHand', 0.05], ['RightHand', 0.05],
  ['LeftLeg', 0.09], ['RightLeg', 0.09], ['Head', 0.14], ['Spine01', 'belly'], ['Hips', 'hipsBelly']];
const _fl = { h: new THREE.Vector3(), p: new THREE.Vector3(), f: new THREE.Vector3(), r: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() };
function castBellyFlop() {
  spend('bf'); startCd('bf'); addDrunk(8);
  const to = resolveCircle(groundTarget(AB.bf.range * SU, 3), 0.6), from = P.pos.clone().setY(0), dist = from.distanceTo(to);
  Game.anim.play('flopCrouch', { noFx: true });
  Sound.voice('a2', { chance: 0.7, cooldown: 6 });
  BC.flop = { from, to, dist, t: 0, T: 0, phase: 'crouch', rank: rankOf('bf'), trail: null,
    air: clamp(0.42 + dist * 0.04, 0.5, 0.85), H: 0.7 + dist * 0.2,
    yaw: dist > 0.1 ? Math.atan2(to.x - from.x, to.z - from.z) : P.yaw, hips: new THREE.Vector3(), launch: new THREE.Vector3(),
    pitch: 0, wob: 0, legs: 0, arms: 0, kick: 0, squash: 0, feet: null, footR: 0.2 };
  P.flying = true; P.grounded = false; P.vel.set(0, 0, 0); P.yaw = BC.flop.yaw;
  Game.thoth.root.rotation.order = 'YXZ';
  Game.anim.post = flopPost;
}
// the moment his feet leave the ground
function flopLaunch(F) {
  F.phase = 'air'; F.t = 0;
  F.launch.copy(F.hips);
  F.trail = VFX.trail(0.8, BCC.wine, 2.0, 22);
  flopFade('flopCrouch', 0.1);
  Game.anim.play('flopAir');
  Sound.god('flop_jump', { gain: 1.0 });
  const from = F.from;
  FX2.ring(from, 'dust', { radius: 2.2, dur: 0.4, int: 0.8 });
  for (let i = 0; i < 10; i++) { const a = rand(0, TAU); FX2.smoke.spawn({ pos: V3(from.x + Math.cos(a) * 0.5, 0.3, from.z + Math.sin(a) * 0.5), vel: V3(Math.cos(a) * rand(2, 4), rand(0.3, 1), Math.sin(a) * rand(2, 4)), life: rand(0.8, 1.2), size: 0.6, sizeEnd: 1.8, frames: 16, pal: 'dust', temp: 0.1, tempEnd: 0, int: 1, alpha: 0.65, drag: 2.5 }); }
  bacWine(from.clone().setY(1.2), 14, 0.8);
}
// fade a playing action out from now (its pose holds while it fades)
function flopFade(name, out) {
  const a = Game.anim.actions.find((x) => x.name === name); if (!a || a.len - Math.max(a.t, 0) <= out) return;   // (already fading out sooner)
  a.def = { ...a.def, fadeOut: out }; a.len = Math.max(a.t, 0) + out;
}
function flopEnd() {
  const F = BC.flop; if (!F) return;
  if (F.trail) F.trail.alive = false;
  BC.flop = null;
  const rig = Game.thoth;
  rig.root.rotation.x = 0; rig.root.scale.set(1, 1, 1);
  for (const n of ['Spine', 'Spine01']) { const b = rig.b(n); if (b) b.scale.set(1, 1, 1); }
  if (Game.anim.post === flopPost) Game.anim.post = null;
  for (const n of ['flopCrouch', 'flopAir', 'flopPush']) flopFade(n, 0.2);   // (an interrupted flop does not leave a held pose behind)
  P.y = 0; P.vy = 0; P.flying = false; P.grounded = true;
  resolveCircle(P.pos, 0.45);
}
// kit update (moveOverride): timeline, body pitch, squash; the exact placement happens in flopPost
function updateFlop(dt) {
  const F = BC.flop; if (!F) return false;
  F.t += dt; F.T += dt; P.vel.set(0, 0, 0); P.yaw = F.yaw;
  const B = BAC_FLOP, root = Game.thoth.root;
  let sq = 0;   // squash (+) / stretch (-) along the body
  if (F.phase === 'crouch') {
    const k = clamp(F.t / B.crouch, 0, 1);
    F.pitch = 0;
    F.wob = Math.sin(F.T * 31) * 0.05 * (0.4 + k);
    sq = 0.07 * smoothstep(0, 1, k);
    if (k >= 1) flopLaunch(F);
  } else if (F.phase === 'air') {
    const k = clamp(F.t / F.air, 0, 1);
    // flat (90 degrees) at the apex, a touch nose-down as the belly comes in to land
    F.pitch = (Math.PI / 2) * smoothstep(0.06, 0.5, k) + (B.maxPitch - Math.PI / 2) * smoothstep(0.55, 1, k);
    F.wob = Math.sin(F.T * 19) * 0.025;
    F.kick = smoothstep(0.4, 0.6, k) * Math.sin(F.T * 15) * 0.22;
    // from the crouch's squash into a stretch off the ground, then back to normal (no one-frame pop)
    sq = k < 0.12 ? lerp(0.07, -0.06, smoothstep(0, 0.12, k)) : -0.06 * (1 - smoothstep(0.12, 0.35, k));
    F.trail.push(F.hips);
    FX2.trailTick(F.hips, null, 'bacchus', dt, { k: 1.4, size: 1.4 });
    if (Math.random() < dt * 34) FX2.solid.spawn({ pos: bacJugTip(_b2), vel: V3(rand(-1, 1), rand(-1, 0.5), rand(-1, 1)), life: rand(0.5, 0.8), size: rand(0.05, 0.09), sizeEnd: 0.03, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -12, floor: true, stretch: 1.5 });
    if (Math.random() < dt * 10) bacGrapes(F.hips, 1, 0.5);
    if (k >= 1) { F.trail.alive = false; F.phase = 'lie'; F.t = 0; F.kick = 0; flopLand(F); }
  } else if (F.phase === 'lie') {
    const t = F.t;
    // the body rocks on the belly and settles flat; limbs bounce off the floor
    F.pitch = Math.PI / 2 + (B.maxPitch - Math.PI / 2) * Math.cos(t * 16) * Math.exp(-t * 7);
    F.wob = Math.sin(t * 24) * Math.exp(-t * 5) * 0.13;
    F.legs = Math.sin(Math.min(t * 9, Math.PI)) * Math.exp(-t * 2.5) * 0.75;   // legs flip up behind him, then flop down
    F.arms = Math.sin(t * 13) * Math.exp(-t * 6) * 0.45;
    sq = 0.16 * Math.cos(t * 26) * Math.exp(-t * 9);
    if (t >= B.lie) { F.phase = 'up'; F.t = 0; F.legs = 0; F.arms = 0; flopFade('flopAir', 0.22); Game.anim.play('flopPush', { noFx: true }); Sound.god('flop_jump', { gain: 0.35, rate: 0.7 }); }
  } else {
    const e = clamp(F.t / B.getup, 0, 1);
    F.pitch = (Math.PI / 2) * (1 - easeInOut(e));
    F.wob = Math.sin(F.T * 20) * 0.04 * (1 - e);
    if (e > 0.62 && !F.pushOut) { F.pushOut = true; flopFade('flopPush', 0.3); }
    if (e >= 1) { flopEnd(); return true; }
  }
  F.squash = sq;
  root.rotation.x = F.pitch;
  // squash and stretch, volume kept: along the body while upright, through the belly (local z = down) while he lies flat
  const w = Math.sin(clamp(F.pitch, 0, Math.PI / 2));
  root.scale.set(1 + sq * (0.5 * (1 - w) + 0.6 * w), 1 - sq * (1 - w) + sq * 0.3 * w, 1 + sq * 0.5 * (1 - w) - sq * w);
  return true;
}
// RigAnimator.post: runs after the clips are posed, in world space
function flopPost(rig, dt) {
  const F = BC.flop; if (!F) return;
  const root = rig.root, cs = Math.cos(F.yaw), sn = Math.sin(F.yaw);
  const right = _fl.r.set(-cs, 0, sn);
  // ---- the belly: bulge the lower spine (x/z) and cancel it for everything above
  const s = 1 + F.wob, sp = rig.b('Spine'), sp1 = rig.b('Spine01');
  if (sp && sp1) { sp.scale.set(s, 1 / Math.sqrt(s), s); sp1.scale.set(1 / s, Math.sqrt(s), 1 / s); }
  // ---- limbs: a flutter-kick in the air, the bounce off the floor (negative angle about `right` lifts the legs behind him)
  const LU = rig.b('LeftUpLeg'), RU = rig.b('RightUpLeg'), LA = rig.b('LeftArm'), RA = rig.b('RightArm');
  if (LU && RU) { rotateBoneWorld(LU, right, -F.legs + F.kick); rotateBoneWorld(RU, right, -F.legs * 0.85 - F.kick); }
  if (LA && RA && F.arms) { rotateBoneWorld(LA, right, F.arms); rotateBoneWorld(RA, right, F.arms * 0.9); }
  root.updateMatrixWorld(true);
  // ---- where the rig has to go
  const hips = rig.hips.getWorldPosition(_fl.h);
  const shift = _fl.s.set(0, 0, 0);
  if (F.phase === 'crouch') {
    shift.set(0, 0, 0);
    if (F.T < 0.05) { let lo = 9; for (const n of ['LeftFoot', 'RightFoot']) lo = Math.min(lo, rig.b(n).getWorldPosition(_fl.p).y); F.footR = clamp(lo - root.position.y, 0.08, 0.3); }
  } else if (F.phase === 'air') {
    const k = clamp(F.t / F.air, 0, 1);
    const tx = lerp(F.launch.x, F.to.x, k), tz = lerp(F.launch.z, F.to.z, k);
    const ty = lerp(F.launch.y, BAC_FLOP.approachY, k) + 4 * F.H * k * (1 - k);
    shift.set(tx - hips.x, ty - hips.y, tz - hips.z);
  } else if (F.phase === 'lie') {
    shift.set(F.to.x - hips.x, -hips.y, F.to.z - hips.z);   // down onto the floor (the contacts lift him back to the belly)
  } else {
    const e = clamp(F.t / BAC_FLOP.getup, 0, 1), wf = smoothstep(0.35, 0.6, e);
    const hx = F.to.x - hips.x, hz = F.to.z - hips.z;
    // the feet plant once he is getting up: from then on they stay where they are
    const fm = _fl.a.copy(rig.b('LeftFoot').getWorldPosition(_fl.p)).add(rig.b('RightFoot').getWorldPosition(_fl.b)).multiplyScalar(0.5);
    if (wf > 0 && !F.feet) F.feet = new THREE.Vector3(fm.x + hx, 0, fm.z + hz);
    const fx = F.feet ? F.feet.x - fm.x : hx, fz = F.feet ? F.feet.z - fm.z : hz;
    shift.set(lerp(hx, fx, wf), -hips.y - 2, lerp(hz, fz, wf));   // (y: pressed down; the floor lifts him onto hands, then feet)
  }
  // ---- the floor: nothing goes through it
  if (F.phase !== 'crouch') {
    const fwd = _fl.f.set(0, 0, 1).applyQuaternion(root.getWorldQuaternion(_fl.q));   // the way his belly faces
    let lift = -1e9;
    for (const [n, r] of FLOP_CONTACTS) {
      const b = rig.b(n); if (!b) continue;
      const p = b.getWorldPosition(_fl.p);
      let y;
      if (r === 'foot') y = p.y - F.footR;
      else if (r === 'belly') y = p.y + fwd.y * BAC_FLOP.bellyR;
      else if (r === 'hipsBelly') y = p.y + fwd.y * BAC_FLOP.bellyR * 0.8;
      else y = p.y - r;
      lift = Math.max(lift, -(y + shift.y));
    }
    if (lift > 0) shift.y += lift;
  }
  root.position.add(shift);
  root.updateMatrixWorld(true);
  F.hips.copy(hips).add(shift);
  // the camera follows his hips (not the rig origin, which swings out behind him while he is horizontal);
  // in the crouch he stands where he stood (P.pos stays the rig origin there, so nothing creeps)
  if (F.phase === 'crouch') return;
  P.pos.set(F.hips.x, 0, F.hips.z);
  P.y = F.phase === 'crouch' ? 0 : clamp(F.hips.y - 1.05, 0, 3);
  if (F.phase === 'up') { const e = clamp(F.t / BAC_FLOP.getup, 0, 1); P.pos.x = lerp(P.pos.x, root.position.x, e); P.pos.z = lerp(P.pos.z, root.position.z, e); P.y *= 1 - e; }
}
function flopLand(F) {
  const at = F.to, R = AB.bf.radius * SU, rank = F.rank;
  Sound.god('flop_land', { gain: 1.15, pos: at });
  Game.hitStop(0.07, 0.15);
  Cam.shake = Math.max(Cam.shake, 0.65); Cam.fovKick = 4;
  PostFX.shock(at.clone().setY(0.5), 0.6, 0.5);
  // the belly hits: a crater, a racing ring, a wall of dust and a crown of wine
  FX2.impact(at, 'wine', { size: 1.25, ring: (R + 1) / 1.25, sparks: 44, debris: 18, dustPal: 'dust', dustGlow: 0.05, int: 0.75 });
  FX2.ring(at, 'bacchus', { radius: R + 2.4, dur: 0.6, width: 0.05 });
  FX2.distort.ring(at.clone().setY(0.5), 16, 0.03, 0.55);
  bacCrown(at, R, 70);
  bacGrapes(at.clone().setY(0.6), 12, R * 0.6);
  // the spilled wine stays as a dark puddle
  FX2.scorch(at, 'wine', { radius: R * 0.95, dur: 5, int: 0.6, dark: BCC.wineDark, darkAlpha: 0.78 });
  for (const d of dummiesNear(at, R)) {
    Combat.deal(d, AB.bf.dmg[rank - 1] + AB.bf.scale * settings.power, 'ability', 'Belly Flop');
    bacKnockUp(d, 0.6, 1.3);
    if (bacTipsy()) d.slowed(AB.bf.slow, 2);
    FX2.burst(d.pos.clone().setY(1.0), 'bacchus', { size: 0.5, sparks: 14, embers: 8, puffs: 1, bursts: 1 });
  }
}

// ---- 3 · Belch of the Gods: a rolling, channelled burp that hits three times, then once more ---
function castBelch() {
  spend('bg'); startCd('bg'); addDrunk(8);
  const rank = rankOf('bg');
  Game.anim.play('belch');
  Sound.voice('belch', { priority: 3, gain: 1.2, cooldown: 0 });
  Sound.god('belch_wave', { gain: 1.0 });
  const mouth = bacMouth(new THREE.Vector3()), dir = fwdOf(P.yaw);
  BC.belch = { t: 0, rank, hits: 0, mouth,
    spray: FX2.spray(mouth, dir, 'bacchus', { dur: AB.bg.dur, cone: 0.85, speed: 12, rate: 150, smokeRate: 44, glow: 0.45, smokeSize: 1.35, cell: FXA.bubble }),
    spray2: FX2.spray(mouth, dir, 'grape', { dur: AB.bg.dur, cone: 0.7, speed: 9, rate: 40, smokeRate: 14, glow: 0.3, smokeSize: 1.1, cell: FXA.wisp }) };
}
function updateBelch(dt) {
  const B = BC.belch; if (!B) return;
  B.t += dt;
  const dir = fwdOf(P.yaw, _v3);
  bacMouth(B.mouth); B.spray.dir.copy(dir); B.spray2.dir.copy(dir);
  // the air shimmers all along the cone
  if (Math.random() < dt * 14) FX2.distort.heat(_v4.copy(B.mouth).addScaledVector(dir, rand(1, 5)).setY(rand(0.6, 1.6)), rand(1.5, 3), 0.008, 0.6);
  Cam.shake = Math.max(Cam.shake, 0.06);
  // pressure pulses on the belch_wave beats: 0, 0.5 and 1.0 s, and the final, heavier one at 1.5 s
  const beats = [0.02, 0.5, 1.0, 1.5];
  while (B.hits < 4 && B.t >= beats[B.hits]) { belchHit(B, B.hits === 3); B.hits++; }
  if (B.t >= AB.bg.dur + 0.1) BC.belch = null;
}
function belchHit(B, final) {
  const R = AB.bg.range * SU, half = AB.bg.arc * DEG / 2, dir = fwdOf(P.yaw), c = P.pos.clone(), r = B.rank;
  // a wavefront of wine mist and bubbles racing out through the cone
  for (let j = 0; j < (final ? 30 : 18); j++) {
    const a = P.yaw + lerp(-half, half, j / ((final ? 30 : 18) - 1)) + rand(-0.04, 0.04), d = fwdOf(a, _v4);
    FX2.smoke.spawn({ pos: _b1.copy(B.mouth).addScaledVector(d, 0.6), vel: d.clone().multiplyScalar(rand(8, 11)).setY(rand(-0.4, 0.4)), life: rand(0.6, 0.9), size: 0.4, sizeEnd: final ? 2.4 : 1.7, frames: 16, pal: j % 3 ? 'bacchus' : 'grape', temp: 0.5, tempEnd: 0, int: 1.3, alpha: final ? 0.75 : 0.55, drag: 1.8, turb: 0.6 });
    FX2.glow.spawn({ pos: B.mouth, vel: d.clone().multiplyScalar(rand(9, 13)), life: rand(0.4, 0.6), size: rand(0.1, 0.18), sizeEnd: 0.03, cell: FXA.bubble, pal: 'bacchus', temp: 1.0, tempEnd: 0.5, int: 1.6, drag: 1.2 });
  }
  FX2.distort.ring(_v4.copy(B.mouth).addScaledVector(dir, final ? 3 : 2), final ? 12 : 7, final ? 0.032 : 0.016, 0.5);
  if (final) { Cam.shake = Math.max(Cam.shake, 0.35); FX2.slash(V3(c.x, 1.2, c.z), P.yaw, 'bacchus', { r0: 2, r1: R, a0: -half, a1: half, dur: 0.3, int: 1.1 }); }
  for (const d of dummiesInCone(c, dir, R, half)) {
    Combat.deal(d, AB.bg.tick[r - 1] + AB.bg.scale * settings.power, 'ability', 'Belch of the Gods');
    d.antiheal = 5;
    const away = _v4.set(d.pos.x - c.x, 0, d.pos.z - c.z), L = away.length() || 1;
    d.shove(away.multiplyScalar((final ? 1.1 : 0.25) / L), 2);
    FX2.burst(d.pos.clone().setY(1.2), final ? 'bacchus' : 'grape', { size: final ? 0.6 : 0.35, sparks: final ? 18 : 8, embers: 6, puffs: final ? 2 : 1, bursts: 1, light: final, distort: false });
    if (final && bacTipsy()) d.applyStun(AB.bg.stun[r - 1]);
  }
}

// ---- 4 · Intoxicate: he spins with the jug held high; a wave of wine bursts out over everything ----
function castIntoxicate() {
  spend('ix'); startCd('ix'); addDrunk(10);
  const rank = rankOf('ix');
  Game.anim.play('ixraise');
  VFX.later(0.5, () => { if (BC.intox && !BC.intox.burst) Game.anim.play('intox'); });
  Sound.god('intox_cast', { gain: 1.05, delay: Math.max(0, BAC_IX - 0.5) });
  Sound.duckMusic(0.4, 2.8, 1.4);
  // "Drink... with... ME!" - the last word lands on the wave
  Sound.voice('ult_scream', { priority: 4, gain: 1.15, cooldown: 0, offset: Math.max(0, BAC_VOX.me - BAC_IX), delay: Math.max(0, BAC_IX - BAC_VOX.me), hold: BAC_IX + 0.9 });
  VFX.later(BAC_IX + 1.6, () => Sound.voice('ult', { priority: 3, gain: 1.05, cooldown: 0, chance: 0.6 }));
  const tip = bacJugTip(new THREE.Vector3());
  BC.intox = { t: 0, rank, burst: false, tip,
    charge: FX2.charge(tip, 'bacchus', { dur: BAC_IX, radius: 2.0, rate: 80, size: 1.3 }),
    aura: FX2.aura(P.pos, 'grape', { radius: 1.3, height: 2.4, rate: 46, dur: BAC_IX + 0.2 }),
    mist: FX2.mist(P.pos, 'wine', { radius: 2.4, rate: 14, dur: BAC_IX, glow: 0.12, alpha: 0.5, size: 0.9, height: 0.6, rise: 0.4 }) };
  bacLeaves(P.pos, 26, 1.6, 2.6, 1);
}
function updateIntox(dt, t) {
  const I = BC.intox; if (!I) return;
  I.t += dt;
  if (!I.burst) {
    bacJugTip(I.tip);
    // wine spirals off the spinning jug, grapes and leaves whirl in toward him
    if (Math.random() < dt * 60) FX2.solid.spawn({ pos: I.tip, vel: V3(rand(-2.5, 2.5), rand(0, 2), rand(-2.5, 2.5)), life: rand(0.5, 0.8), size: rand(0.05, 0.1), sizeEnd: 0.03, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -11, floor: true, stretch: 1.5 });
    const k = I.t / BAC_IX;
    for (let n = Math.floor(dt * (12 + 26 * k) + Math.random()); n > 0; n--) FX2.solid.spawn({ pos: P.pos, life: rand(0.5, 0.9), size: rand(0.05, 0.11), sizeEnd: 0.04, cell: FXA.drop, pal: 'wine', alpha: 0.95, stretch: 1.6, orbit: { c: P.pos, r: rand(0.9, 2.1), w: rand(5, 8), vy: rand(0.4, 1.4), y: rand(0.2, 1.6), wob: 0.1 } });
    if (Math.random() < dt * 10) bacLeaves(P.pos, 1, 1.6, 2.4);
    if (Math.random() < dt * 40) { const a = rand(0, TAU), r = rand(3, 6); FX2.glow.spawn({ pos: V3(P.pos.x + Math.cos(a) * r, rand(0.3, 2.2), P.pos.z + Math.sin(a) * r), life: rand(0.4, 0.7), size: rand(0.08, 0.14), sizeEnd: 0.03, cell: FXA.bubble, pal: 'grape', temp: 1, tempEnd: 0.5, int: 1.6, attract: { x: P.pos.x, y: 1.3, z: P.pos.z, strength: 40, kill: 0.5 } }); }
    if (I.t >= BAC_IX) intoxBurst(I);
  } else if (I.t > BAC_IX + 0.6) BC.intox = null;
}
function intoxBurst(I) {
  I.burst = true;
  const c = P.pos.clone().setY(0), R = AB.ix.radius * SU, rank = I.rank;
  Game.hitStop(0.08, 0.12);
  Cam.shake = Math.max(Cam.shake, 0.75); Cam.fovKick = 7;
  PostFX.shock(c.clone().setY(1), 0.9, 0.7);
  VFX.flash(c.clone().setY(1.6), BCC.wine, 16, 0.5);
  FX2.burst(c.clone().setY(1.4), 'wine', { size: 1.3, sparks: 60, embers: 36, puffs: 8, bursts: 1, int: 0.62, smokeGlow: 0.3 });
  FX2.burst(c.clone().setY(1.0), 'grape', { size: 0.9, sparks: 30, embers: 24, puffs: 0, bursts: 1, int: 0.55, light: false, distort: false });
  FX2.ring(c, 'wine', { radius: R + 1, dur: 0.7, width: 0.09, int: 1.0 });
  VFX.later(0.08, () => FX2.ring(c, 'grape', { radius: R + 2.6, dur: 0.85, width: 0.05 }));
  VFX.later(0.16, () => FX2.ring(c, 'bacchus', { radius: R + 4.5, dur: 1.0, width: 0.035, int: 1.0 }));
  FX2.distort.ring(c.clone().setY(0.8), R * 2.6, 0.032, 0.7);
  FX2.sphere(c.clone().setY(0.2), 'grape', { radius: R * 0.8, dur: 0.6, dome: true, int: 0.3 });
  // the wave: a wall of wine, wine mist rolling along the floor, grapes and leaves flung outward
  for (let i = 0; i < 150; i++) { const a = rand(0, TAU), ox = Math.cos(a), oz = Math.sin(a); FX2.solid.spawn({ pos: V3(c.x + ox * 0.8, rand(0.4, 1.6), c.z + oz * 0.8), vel: V3(ox * rand(7, 13), rand(1.5, 5), oz * rand(7, 13)), life: rand(0.7, 1.2), size: rand(0.06, 0.14), sizeEnd: 0.04, cell: FXA.drop, pal: 'wine', alpha: 0.95, gravity: -12, drag: 0.6, floor: true, stretch: 1.8 }); }
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU + rand(-0.06, 0.06), ox = Math.cos(a), oz = Math.sin(a); FX2.smoke.spawn({ pos: V3(c.x + ox * 0.8, rand(0.3, 0.9), c.z + oz * 0.8), vel: V3(ox * rand(8, 12), rand(0.2, 1.2), oz * rand(8, 12)), life: rand(1.1, 1.7), size: 0.9, sizeEnd: rand(2.6, 3.4), frames: 16, pal: i % 3 ? 'wine' : 'grape', temp: 0.14, tempEnd: 0, int: 1.1, alpha: 0.62, drag: 2.6, turb: 0.6, fadeIn: 0.03 }); }
  for (let i = 0; i < 40; i++) { const a = rand(0, TAU), ox = Math.cos(a), oz = Math.sin(a); FX2.glow.spawn({ pos: V3(c.x, rand(0.8, 2), c.z), vel: V3(ox * rand(4, 9), rand(1, 4), oz * rand(4, 9)), life: rand(0.8, 1.4), size: rand(0.1, 0.18), sizeEnd: 0.03, cell: FXA.bubble, pal: i % 2 ? 'grape' : 'bacchus', temp: 1, tempEnd: 0.4, int: 1.6, drag: 1.4, gravity: -2, turb: 1.5 }); }
  for (let i = 0; i < 30; i++) { const a = rand(0, TAU), ox = Math.cos(a), oz = Math.sin(a); FX2.solid.spawn({ pos: V3(c.x, rand(0.8, 2), c.z), vel: V3(ox * rand(4, 8), rand(2, 5), oz * rand(4, 8)), life: rand(1.2, 2.0), size: rand(0.14, 0.24), sizeEnd: 0.1, cell: FXA.leaf, pal: 'leaf', alpha: 1, rotVel: rand(-8, 8), drag: 1.6, gravity: -2.5, turb: 2, floor: true }); }
  FX2.rain(c, 'thothGold', { radius: R * 0.85, dur: 1.4, rate: 70, fall: 0.7, cell: FXA.star });
  FX2.scorch(c, 'wine', { radius: R * 0.8, dur: 5, int: 0.5, dark: BCC.wineDark, darkAlpha: 0.6 });
  for (const d of dummiesNear(c, R)) {
    Combat.deal(d, AB.ix.dmg[rank - 1] + AB.ix.scale * settings.power, 'ult', 'Intoxicate');
    d.drunk = AB.ix.dur; d.slowed(AB.ix.slow, AB.ix.dur);
    BC.drunks.add(d);
    FX2.burst(d.pos.clone().setY(1.2), 'bacchus', { size: 0.6, sparks: 18, embers: 10, puffs: 2, bursts: 1, distort: false });
    bacWine(d.pos.clone().setY(1.4), 14, 0.9);
  }
  if (BC.drunks.size) Sound.god('intox_dizzy', { gain: 0.45, delay: 0.3 });
  if (bacSmashed()) {   // Smashed: the drink goes to his arms
    BC.smashBuff = 8;
    BC.auras.push(FX2.aura(P.pos, 'wine', { radius: 1.1, height: 2.4, rate: 26, dur: 8 }));
    HUD.toast('Smashed · +15% damage for 8 s');
  }
}
// Intoxicated foes stagger about, swaying, with grapes and bubbles circling their heads
function updateDrunks(dt, t) {
  for (const d of BC.drunks) {
    if (!d.alive || d.drunk <= 0) { d.mesh.rotation.z = 0; d.mesh.rotation.x = 0; BC.drunks.delete(d); continue; }
    d.mesh.rotation.z = Math.sin(t * 2.6 + d.base.x) * 0.13 * Math.min(1, d.drunk);
    d.mesh.rotation.x = Math.sin(t * 1.9 + d.base.z) * 0.07 * Math.min(1, d.drunk);
    d.wobT = (d.wobT || 0) - dt;
    if (d.wobT <= 0 && !d.cc) { d.wobT = rand(0.35, 0.6); const a = rand(0, TAU); d.shove(_v4.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(rand(0.2, 0.45)), 1.2); }
    const head = _b1.set(d.pos.x, d.height + 0.45 + d.lift, d.pos.z);
    if (Math.random() < dt * 9) FX2.glow.spawn({ pos: head, life: rand(0.6, 1.0), size: rand(0.08, 0.13), sizeEnd: 0.04, cell: Math.random() < 0.7 ? FXA.bubble : FXA.star, pal: Math.random() < 0.6 ? 'grape' : 'bacchus', temp: 1, tempEnd: 0.5, int: 1.6, orbit: { c: d.pos, r: rand(0.35, 0.5), w: rand(3.5, 5), y: d.height + 0.45 + rand(-0.08, 0.08), wob: 0.05 } });
    if (Math.random() < dt * 3) bacFizz(head, 3, 0.25);
  }
}

// ---- 5 · DEADLY FART (playroom finale) ----------------------------------------------------------
// 0 s: he stops, clutches his belly - it rumbles. 1.4 s: he braces and squats, the ground shakes, gas
// leaks, everything is drawn in. 3.6 s: release - a green shockwave, a mushroom of gas, a blast that
// throws the foes back. 3.6-9.6 s: a toxic cloud follows him and ticks every half second.
function castDeadlyFart() {
  spend('df'); startCd('df');
  const F = BC.fart = { t: 0, released: false, kills: 0, hips: new THREE.Vector3(), behind: new THREE.Vector3(), heatT: 0, flyT: 0 };
  Game.anim.play('fart');
  Sound.god('df_rumble', { gain: 1.05 });
  Sound.voice('fin_charge', { priority: 5, gain: 1.15, cooldown: 0, hold: 2.1 });
  VFX.later(BAC_DF.strain, () => { if (BC.fart === F) Sound.god('df_strain', { gain: 1.0 }); });
  VFX.later(Math.max(0, BAC_DF.release - BAC_VOX.fart), () => { if (BC.fart === F) Sound.voice('fin_roar', { priority: 6, gain: 1.25, cooldown: 0, hold: BAC_VOX.fart + 1.0 }); });
  Sound.duckMusic(0.25, BAC_DF.release + 2, 2.2);
  Cam.frameTarget = 1;
  WORLD.dim = 0.72; GodFX.tint(new THREE.Color(0.3, 0.85, 0.1), 0.22); PostFX.vigTarget = 0.5;
  F.aura = FX2.aura(P.pos, 'fart', { radius: 1.05, height: 1.4, rate: 16, size: 0.9 });
  bacHips(F.hips);
  // his belly glows green from inside, swelling until it all comes out
  F.belly = FX2.glow.spawn({ pos: F.hips, follow: F.hips, life: BAC_DF.release + 0.05, size: 0.35, sizeEnd: 1.5, sizePow: 1.6, cell: FXA.glow, pal: 'fart', temp: 0.75, tempEnd: 0.95, int: 1.1, fadeIn: 0.4, fadeOut: 0.98 });
  F.pulseT = 0; F.lightT = 0;
}
function updateFart(dt, t) {
  const F = BC.fart; if (!F) return;
  F.t += dt;
  bacHips(F.hips);
  F.behind.copy(F.hips).addScaledVector(fwdOf(P.yaw, _v4), -0.42).add(_v4.set(0, -0.12, 0));
  if (!F.released) {
    const k = clamp(F.t / BAC_DF.release, 0, 1);
    // the belly churns: green bubbles and wisps swirl about his middle
    if (Math.random() < dt * (10 + 40 * k)) FX2.glow.spawn({ pos: F.hips, life: rand(0.5, 0.9), size: rand(0.08, 0.15), sizeEnd: 0.02, cell: Math.random() < 0.5 ? FXA.bubble : FXA.wisp, pal: 'fart', temp: 1.0, tempEnd: 0.4, int: 1.4, orbit: { c: P.pos, r: rand(0.55, 0.9), w: rand(3, 6) * (Math.random() < 0.5 ? -1 : 1), vy: rand(-0.2, 0.3), y: F.hips.y - P.pos.y + rand(-0.25, 0.25), wob: 0.05 } });
    // the rumbles: the glow throbs, bubbles burst out of the green
    F.pulseT -= dt;
    if (F.pulseT <= 0) {
      F.pulseT = rand(0.18, 0.34) * (1.2 - k * 0.6);
      FX2.glow.spawn({ pos: F.hips, follow: F.hips, life: 0.3, size: 0.5 + k * 0.6, sizeEnd: 1.0 + k * 1.2, cell: FXA.core, pal: 'fart', temp: 0.8, tempEnd: 0.5, int: 0.9, fadeIn: 0.05 });
      for (let i = 0; i < 3 + 6 * k; i++) FX2.glow.spawn({ pos: F.hips, vel: V3(rand(-1.2, 1.2), rand(-0.2, 1.4), rand(-1.2, 1.2)), life: rand(0.5, 0.9), size: rand(0.06, 0.13), sizeEnd: 0.03, cell: FXA.bubble, pal: 'fart', temp: 1, tempEnd: 0.5, int: 1.5, drag: 1.5, turb: 2 });
    }
    F.lightT -= dt;
    if (F.lightT <= 0) { F.lightT = 0.3; FX2.light(F.hips, FX2.pal('fart').light, 4 + 12 * k, 0.36, F.hips); }
    if (!F.pool && F.t > 0.8) F.pool = FX2.mist(P.pos, 'toxic', { radius: 2.4, rate: 12, dur: BAC_DF.release - 0.8, glow: 0.22, alpha: 0.5, size: 0.9, height: 0.5, rise: 0.25 });
    // gas leaks out behind him - wisps, then streams as he strains
    if (F.t > 0.4 && Math.random() < dt * (3 + 30 * k * k)) bacGas(F.behind, fwdOf(P.yaw, _b1).multiplyScalar(-rand(0.5, 1.6)).add(_v4.set(rand(-0.3, 0.3), rand(-0.2, 0.5), rand(-0.3, 0.3))), 0.3 + 0.5 * k, 0.45, 0.65, 1.2);
    if (F.t > BAC_DF.strain) {
      const s = (F.t - BAC_DF.strain) / (BAC_DF.release - BAC_DF.strain);
      Cam.shake = Math.max(Cam.shake, 0.08 + 0.3 * s);
      if (!F.cracks) {
        F.cracks = VFX.cracks(P.pos.clone().setY(0), 3.4, BAC_DF.release - BAC_DF.strain + 1.5, { grow: 1.4, intensity: 1.2, color: BCC.green });
        F.vortex = null;
      }
      // everything is drawn in toward the pressure: motes, dust, pebbles hopping on the shaking floor
      if (Math.random() < dt * 50 * s) { const a = rand(0, TAU), r = rand(3.5, 6.5); FX2.glow.spawn({ pos: V3(P.pos.x + Math.cos(a) * r, rand(0.2, 2.2), P.pos.z + Math.sin(a) * r), life: rand(0.6, 1.0), size: rand(0.06, 0.12), sizeEnd: 0.02, cell: Math.random() < 0.6 ? FXA.ember : FXA.spark, stretch: 1.5, pal: 'fart', temp: 1.1, tempEnd: 0.5, int: 1.8, attract: { x: F.hips.x, y: F.hips.y, z: F.hips.z, strength: 30 + 30 * s, kill: 0.3 } }); }
      if (Math.random() < dt * 8) { const a = rand(0, TAU), r = rand(1, 5); FX2.rocks.spawn({ pos: V3(P.pos.x + Math.cos(a) * r, 0.05, P.pos.z + Math.sin(a) * r), vel: V3(0, rand(1.2, 2.8), 0), size: rand(0.04, 0.09) }); }
      if (Math.random() < dt * 6) { const a = rand(0, TAU); FX2.smoke.spawn({ pos: V3(P.pos.x + Math.cos(a) * rand(1, 4), 0.15, P.pos.z + Math.sin(a) * rand(1, 4)), vel: V3(0, 0.4, 0), life: 1.0, size: 0.5, sizeEnd: 1.4, frames: 16, pal: 'dust', temp: 0.05, tempEnd: 0, int: 1, alpha: 0.5, drag: 2 }); }
      F.heatT -= dt;
      if (F.heatT <= 0) { F.heatT = 0.12; FX2.distort.heat(F.hips, 2.4, 0.006 + 0.012 * s, 0.4); }
      Game.thoth.eyes.forEach((e) => e.material.color.setRGB(0.4 + 0.2 * s, 1.0, 0.15));
    }
    // the leaks: squeaks at first, then wet sputters, closer and closer together as the pressure builds
    if (F.t > 0.7) {
      F.leakT = (F.leakT ?? 0.2) - dt;
      if (F.leakT <= 0) { F.leakT = rand(0.45, 0.85) * (1.15 - 0.7 * k); bacToot(k < 0.45 ? 'squeak' : Math.random() < 0.55 ? 'sputter' : 'squeak', 0.6 + 0.6 * k); }
    }
    if (F.t >= BAC_DF.release) fartRelease(F);
  } else if (F.t > BAC_DF.release + 1.2 && !BC.cloud) {
    BC.fart = null;
  }
}
function fartRelease(F) {
  F.released = true;
  const c = P.pos.clone().setY(0), R = BAC_DF.radius, hp = F.hips.clone(), back = fwdOf(P.yaw).negate();
  Sound.god('df_fart', { gain: 1.45, noDuck: true });
  Sound.god('sonic_boom', { gain: 0.5, shared: true, noDuck: true });
  Game.hitStop(0.14, 0.06);
  Cam.shake = 1.3; Cam.fovKick = 13;
  PostFX.shock(hp, 1.4, 0.95); PostFX.aberr = 0.003;
  GodFX.tint(new THREE.Color(0.25, 0.85, 0.05), 0.24);
  VFX.flash(hp, BCC.toxic, 12, 0.6);
  if (F.aura) F.aura.dead = true;
  if (F.vortex) F.vortex.dead = true;
  if (F.pool) F.pool.dead = true;
  // the blast out of his behind, a dome of gas, rings racing over the floor, the air itself bending
  FX2.burst(F.behind.clone(), 'toxic', { size: 1.8, sparks: 64, embers: 44, puffs: 16, bursts: 1, int: 0.55, smokeGlow: 0.22, smokeAlpha: 0.92 });
  FX2.sphere(c.clone().setY(0.3), 'toxic', { radius: R * 1.1, dur: 0.6, dome: true, int: 0.28 });
  FX2.ring(c, 'toxic', { radius: R + 1.5, dur: 0.6, width: 0.1, int: 1.0 });
  VFX.later(0.1, () => FX2.ring(c, 'toxic', { radius: R + 6, dur: 0.9, width: 0.06 }));
  VFX.later(0.22, () => FX2.ring(c, 'fart', { radius: R + 11, dur: 1.1, width: 0.04, int: 1.0 }));
  FX2.distort.ring(hp, 34, 0.04, 0.8);
  VFX.later(0.15, () => FX2.distort.ring(c.clone().setY(0.6), 22, 0.025, 0.7));
  FX2.debris(c.clone().setY(0.3), null, 26, 1.4, FX2.pal('fart'));
  VFX.cracks(c, R * 0.8, BAC_DF.cloud + 1, { grow: 0.3, intensity: 1.3, color: BCC.green });
  FX2.scorch(c, 'toxic', { radius: R * 0.75, dur: BAC_DF.cloud + 2, int: 0.45, dark: BCC.gasDark, darkAlpha: 0.65 });
  // the gas wall: thick green smoke rolling out along the floor in every direction
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU + rand(-0.05, 0.05), ox = Math.cos(a), oz = Math.sin(a);
    FX2.smoke.spawn({ pos: V3(c.x + ox * 0.6, rand(0.3, 1.4), c.z + oz * 0.6), vel: V3(ox * rand(9, 15), rand(0.3, 1.6), oz * rand(9, 15)), life: rand(1.6, 2.6), size: 1.1, sizeEnd: rand(4, 5.5), frames: 16, pal: i % 3 ? 'toxic' : 'fart', temp: 0.2, tempEnd: 0, int: 1.1, alpha: 0.85, drag: 2.4, turb: 0.8, fadeIn: 0.02, fadeOut: 0.55 });
  }
  // the jet straight out behind him (the source of the problem)
  for (let i = 0; i < 30; i++) FX2.smoke.spawn({ pos: F.behind, vel: back.clone().multiplyScalar(rand(10, 18)).add(_v4.set(rand(-2, 2), rand(-0.5, 1.5), rand(-2, 2))), life: rand(1.0, 1.6), size: 0.6, sizeEnd: rand(2.5, 3.5), frames: 16, pal: 'fart', temp: 0.35, tempEnd: 0, int: 1.2, alpha: 0.85, drag: 2.2, turb: 0.8 });
  // a little mushroom cloud of gas: a rising stem and a cap that spreads at the top
  FX2.tornado(c, 'toxic', { r0: 0.7, r1: 2.2, height: 6, dur: 1.2, alpha: 0.22, twist: 0.8, spin: 0.6, rise: 1.6, density: 0.4, int: 0.55 });
  for (let i = 0; i < 26; i++) FX2.smoke.spawn({ pos: V3(c.x + rand(-0.6, 0.6), rand(0.5, 1.5), c.z + rand(-0.6, 0.6)), vel: V3(rand(-0.6, 0.6), rand(6, 10), rand(-0.6, 0.6)), life: rand(1.6, 2.4), size: 0.9, sizeEnd: rand(2.6, 3.6), frames: 16, pal: i % 2 ? 'toxic' : 'fart', temp: 0.28, tempEnd: 0, int: 1.2, alpha: 0.8, drag: 1.3, turb: 0.5 });
  VFX.later(0.5, () => { for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, ox = Math.cos(a), oz = Math.sin(a); FX2.smoke.spawn({ pos: V3(c.x + ox * 0.8, rand(5.4, 6.4), c.z + oz * 0.8), vel: V3(ox * rand(2, 3.4), rand(-0.2, 0.5), oz * rand(2, 3.4)), life: rand(1.6, 2.4), size: 1.4, sizeEnd: rand(3.4, 4.4), frames: 16, pal: i % 2 ? 'toxic' : 'fart', temp: 0.25, tempEnd: 0, int: 1.2, alpha: 0.8, drag: 1.0, turb: 0.4 }); } });
  bacLeaves(c, 20, 3, 2.5, 1);
  // the blast throws the foes back and up
  for (const d of dummiesNear(c, R + 1)) {
    Combat.deal(d, AB.df.blast + AB.df.blastScale * settings.power, 'final', 'Deadly Fart');
    const out = _v4.set(d.pos.x - c.x, 0, d.pos.z - c.z), L = out.length() || 1;
    d.shove(out.multiplyScalar(2.2 / L), 3);
    bacKnockUp(d, AB.df.knock, 1.0);
    FX2.burst(d.pos.clone().setY(1.2), 'fart', { size: 0.6, sparks: 16, embers: 8, puffs: 3, bursts: 1, distort: false });
  }
  // the recoil lifts him off his feet for a moment
  Game.anim.liftTarget = 0.7; VFX.later(0.32, () => { Game.anim.liftTarget = 0; });
  WORLD.dim = 0.85; PostFX.vigTarget = 0.35;
  VFX.later(0.6, () => GodFX.tint(new THREE.Color(0.3, 0.9, 0.1), 0.08));
  startCloud();
}
// the cloud: a thick green fog that follows him, bubbling, buzzing with flies, ticking every 0.5 s
function startCloud() {
  const R = BAC_DF.radius, dur = BAC_DF.cloud;
  const C = BC.cloud = { t: 0, acc: 0, R, dur, ended: false };
  C.sfx = Sound.god('df_cloud', { gain: 0.85, loop: true });
  C.dark = FX2.mist(P.pos, 'toxic', { radius: R, rate: 42, glow: 0.16, alpha: 0.72, size: 1.9, rise: 0.45, height: 2.0, int: 1.1 });
  C.bright = FX2.mist(P.pos, 'fart', { radius: R * 0.85, rate: 14, glow: 0.42, alpha: 0.42, size: 1.3, rise: 0.8, height: 2.4 });
  C.edge = null;
}
function updateCloud(dt, t) {
  const C = BC.cloud; if (!C) return;
  C.t += dt;
  const R = C.R, cx = P.pos.x, cz = P.pos.z;
  if (!C.ended) {
    const rp = () => { const a = rand(0, TAU), r = R * Math.sqrt(Math.random()) * 0.9; return V3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r); };
    // bubbles that swell, rise and pop
    if (Math.random() < dt * 22) { const p = rp().setY(rand(0.1, 0.6)); FX2.glow.spawn({ pos: p, vel: V3(0, rand(0.3, 0.9), 0), life: rand(0.6, 1.1), size: rand(0.1, 0.22), sizeEnd: rand(0.25, 0.4), cell: FXA.bubble, pal: 'fart', temp: 0.9, tempEnd: 0.6, int: 1.4, turb: 1, fadeOut: 0.85 }); }
    if (Math.random() < dt * 8) { const p = rp().setY(rand(0.3, 1.4)); FX2.glow.spawn({ pos: p, life: 0.22, size: 0.1, sizeEnd: 0.6, cell: FXA.ring, pal: 'fart', temp: 1, tempEnd: 0.4, int: 1.6, fadeIn: 0 }); }
    // green motes and sparks churning inside the fog
    if (Math.random() < dt * 30) { const p = rp().setY(rand(0.2, 2)); FX2.glow.spawn({ pos: p, vel: V3(rand(-0.4, 0.4), rand(0.2, 0.9), rand(-0.4, 0.4)), life: rand(0.8, 1.4), size: rand(0.05, 0.1), sizeEnd: 0.02, cell: FXA.ember, pal: 'fart', temp: 1.1, tempEnd: 0.4, int: 1.7, turb: 2.2, drag: 0.6 }); }
    // stink flies buzzing round him
    if (Math.random() < dt * 7) FX2.solid.spawn({ pos: P.pos, life: rand(1.2, 2.0), size: rand(0.05, 0.08), sizeEnd: 0.05, cell: FXA.dust, pal: 'chaos', temp: 0, tempEnd: 0, alpha: 1, orbit: { c: P.pos, r: rand(0.8, R * 0.8), w: rand(4, 9) * (Math.random() < 0.5 ? -1 : 1), vy: rand(-0.3, 0.3), y: rand(0.6, 2.4), wob: 0.4 } });
    // the air shimmers with gas
    if (Math.random() < dt * 5) FX2.distort.heat(rp().setY(1), rand(2.5, 4), 0.007, 0.9);
    // and he keeps going: toots and wet, sharty sputters the whole time the cloud hangs about him
    C.tootT = (C.tootT ?? 0.7) - dt;
    if (C.tootT <= 0) { C.tootT = rand(0.45, 1.05); bacToot(Math.random() < 0.58 ? 'toot' : 'sputter', rand(0.8, 1.2)); if (Math.random() < 0.18) VFX.later(rand(0.12, 0.22), () => { if (BC.cloud === C && !C.ended) bacToot('toot', 0.7); }); }
    // the damage: every half second, everything inside chokes
    C.acc += dt;
    if (C.acc >= BAC_DF.tick) {
      C.acc -= BAC_DF.tick;
      for (const d of dummiesNear(P.pos, R)) {
        Combat.deal(d, AB.df.tick + AB.df.tickScale * settings.power, 'dot', 'Deadly Fart');
        d.gas = 0.7; d.slowed(AB.df.slow, 0.7);
        const hp = _v4.set(d.pos.x, d.height * 0.6 + d.lift, d.pos.z);
        bacGas(hp, V3(rand(-0.4, 0.4), rand(0.4, 1), rand(-0.4, 0.4)), 0.5, 0.55, 0.6, 1.0);
        for (let i = 0; i < 4; i++) FX2.glow.spawn({ pos: hp, vel: V3(rand(-0.6, 0.6), rand(0.8, 1.8), rand(-0.6, 0.6)), life: rand(0.5, 0.8), size: rand(0.06, 0.1), sizeEnd: 0.02, cell: FXA.bubble, pal: 'fart', temp: 1, tempEnd: 0.5, int: 1.6, turb: 2 });
      }
    }
    if (C.t >= C.dur) endCloud(C);
  } else if (C.t > C.dur + 2.0) { BC.cloud = null; BC.fart = null; }
}
function endCloud(C) {
  C.ended = true;
  if (C.sfx) C.sfx.stop(0.6);
  C.dark.dead = true; C.bright.dead = true; if (C.edge) C.edge.dead = true;
  Sound.god('df_end', { gain: 0.9 });
  FX2.ring(P.pos, 'fart', { radius: C.R + 2, dur: 0.9, width: 0.05, int: 0.7 });
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, ox = Math.cos(a), oz = Math.sin(a); FX2.smoke.spawn({ pos: V3(P.pos.x + ox * C.R * 0.6, rand(0.4, 1.6), P.pos.z + oz * C.R * 0.6), vel: V3(ox * rand(2, 4), rand(0.5, 1.5), oz * rand(2, 4)), life: rand(1.0, 1.6), size: 1.2, sizeEnd: 3, frames: 16, pal: 'toxic', temp: 0.3, tempEnd: 0, int: 1, alpha: 0.45, drag: 1.5, turb: 0.6, fadeIn: 0.05 }); }
  // ...and one last tiny toot
  VFX.later(0.9, () => { const F = BC.fart; const b = F ? F.behind : P.pos.clone().setY(1); bacGas(b, fwdOf(P.yaw, _b1).multiplyScalar(-1.2), 0.45, 0.6, 0.7, 0.9, 'fart'); FX2.glow.spawn({ pos: b, life: 0.25, size: 0.12, sizeEnd: 0.5, cell: FXA.ring, pal: 'fart', temp: 1, tempEnd: 0.4, int: 1.6, fadeIn: 0 }); });
  Cam.frameTarget = 0; WORLD.dim = 1; PostFX.vigTarget = 0; GodFX.tint(BCC.green, 0);
  Game.thoth.eyes.forEach((e) => e.material.color.setRGB(...GOD_RIG.bacchus.eyeColor));
  const F = BC.fart;
  if (F && F.kills >= 2) VFX.later(1.2, () => Sound.voice('fin_line', { priority: 3, cooldown: 20 }));
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const BACCHUS_INFO = {
  passive: { name: 'Drunk-O-Meter', kind: 'Passive · Intoxication',
    text: 'Bacchus gets drunker with every ability he uses (+8–10%), every hit that lands (+2%) and most of all with Chug. The meter drops 2% per second. From 30% he is Tipsy: Belly Flop slows and Belch of the Gods stuns. From 60% he is Smashed: Intoxicate gives him 15% more damage for 8 seconds.',
    rows: () => [['Now', `${Math.round(BC.drunk)}% · ${['sober', 'Tipsy', 'Smashed'][bacLevel()]}`], ['Tipsy', '30%'], ['Smashed', '60%'], ['Drops', '2% / s']] },
  ch: { name: 'Chug', kind: 'Self-buff · Heal · Magical',
    text: 'Bacchus drinks deeply from the jug. He heals, deals more damage for 6 seconds and gets much drunker. The next hit with the jug (within 6 s) deals bonus damage and sprays wine over everyone in front of him.',
    rows: () => { const r = rankOf('ch'); return [['Heal', `${AB.ch.heal[r - 1]} (+15%) = ${Math.round(AB.ch.heal[r - 1] + 0.15 * settings.power)}`], ['Damage buff', `+${Math.round(AB.ch.buff[r - 1] * 100)}% for 6 s`], ['Next hit', `+${AB.ch.bonus[r - 1]} (+30%)`], ['Drunk', `+${AB.ch.drunk[r - 1]}%`], ['Cooldown', `${cdOf('ch').toFixed(1)} s`]]; } },
  bf: { name: 'Belly Flop', kind: 'Leap · Area · Knock-up · Magical',
    text: 'Bacchus leaps through the air and lands on his belly. Everything around the landing takes damage and is knocked into the air, and the wine he spills stays behind as a puddle. If he is Tipsy, they are also slowed by 20% for 2 seconds.',
    rows: () => { const r = rankOf('bf'); return [['Damage', `${AB.bf.dmg[r - 1]} (+60% of ${settings.power} MP) = ${Math.round(AB.bf.dmg[r - 1] + 0.6 * settings.power)}`], ['Range', '55 · radius 15'], ['Tipsy', '20% slow for 2 s'], ['Cooldown', `${cdOf('bf').toFixed(1)} s`]]; } },
  bg: { name: 'Belch of the Gods', kind: 'Channeled cone · Antiheal · Magical',
    text: 'Bacchus belches for 1.5 seconds – a rolling cloud of wine vapor and bubbles in a 90° cone. It hits three times and then a final, heavier time. Everything hit gets 40% antiheal for 5 seconds. If he is Tipsy, the final hit stuns.',
    rows: () => { const r = rankOf('bg'); return [['Per hit', `${AB.bg.tick[r - 1]} (+20%) × 4`], ['Cone', '90° · range 35'], ['Tipsy', `stun ${AB.bg.stun[r - 1]} s`], ['Cooldown', `${cdOf('bg').toFixed(1)} s`]]; } },
  ix: { name: 'Intoxicate', kind: 'Ultimate · Area · Intoxicated · Magical',
    text: 'Bacchus spins with the jug held high, and a wave of wine erupts over everything around him. Enemies take damage and become Intoxicated for 4 seconds: they stagger, sway and are slowed by 25%. If he is Smashed, he deals 15% more damage for 8 seconds.',
    rows: () => { const r = rankOf('ix'); return [['Damage', `${AB.ix.dmg[r - 1]} (+70%) = ${Math.round(AB.ix.dmg[r - 1] + 0.7 * settings.power)}`], ['Radius', '35'], ['Intoxicated', '4 s · 25% slow'], ['Cooldown', `${cdOf('ix').toFixed(0)} s`]]; } },
  df: { name: 'Deadly Fart', kind: 'Final ability · Poison cloud · Tick damage',
    text: 'Not in SMITE. Bacchus clutches his belly – it rumbles. He squats, the ground shakes and the gas seeps out … then it blows: a green shockwave and a small mushroom cloud throw the enemies backward. For 6 seconds a thick green poison cloud hangs around him (radius 6.5 m) and follows him. It damages everything inside every half second and slows them.',
    rows: () => [['Blast', `${Math.round(AB.df.blast + AB.df.blastScale * settings.power)}`], ['Cloud', `${Math.round(AB.df.tick + AB.df.tickScale * settings.power)} every 0.5 s for 6 s`], ['Radius', `${BAC_DF.radius} m`], ['Cost', `${costOf('df')} mana`], ['Cooldown', `${cdOf('df').toFixed(0)} s`]] },
};
registerGod({
  id: 'bacchus', dbg: BC, name: 'Bacchus', title: 'God of Wine and Feasting', epithet: 'God of Wine', pantheon: 'Roman', role: 'Guardian',
  color: '#d0367e', glyphs: '⚱ ❦ ☙ ✾ ♨', asset: 'bacchus', stats: BACCHUS_STATS, order: ['ch', 'bf', 'bg', 'ix', 'df'], ab: bacchusAB,
  blurb: 'The jolly, big-bellied wine god with wine jug, belly flop and godly burps – and the finale <em>Deadly Fart</em>.',
  info: BACCHUS_INFO, magical: true, textColor: '#ff8ac2', finalColor: '#a6ff4a', fxColor: BCC.wine, accent: BCC.magenta, accel: 7,
  init() { BC.drunk = 0; BC.hold = 0; BC.combo = 0; BC.chugBuff = 0; BC.nextHit = 0; BC.smashBuff = 0; BC.hicT = 9; },
  dispose() {
    flopEnd();
    Game.thoth.root.rotation.x = 0; Game.thoth.root.scale.set(1, 1, 1);
    BC.chug = null;
    if (BC.belch) { BC.belch.spray.dead = true; BC.belch.spray2.dead = true; BC.belch = null; }
    if (BC.intox) { for (const k of ['charge', 'aura', 'vortex', 'mist']) if (BC.intox[k]) BC.intox[k].dead = true; BC.intox = null; }
    if (BC.cloud) { const C = BC.cloud; if (C.sfx) C.sfx.stop(0.2); C.dark.dead = true; C.bright.dead = true; if (C.edge) C.edge.dead = true; BC.cloud = null; }
    if (BC.fart) { if (BC.fart.aura) BC.fart.aura.dead = true; if (BC.fart.vortex) BC.fart.vortex.dead = true; BC.fart = null; }
    for (const a of BC.auras) a.dead = true; BC.auras = [];
    for (const d of BC.drunks) { d.mesh.rotation.z = 0; d.mesh.rotation.x = 0; } BC.drunks.clear();
    for (const L of BC.lifts) L.d.lift = 0; BC.lifts = [];
    Game.thoth.eyes.forEach((e) => e.material.color.setRGB(...GOD_RIG.bacchus.eyeColor));
    Game.anim.liftTarget = 0;
    WORLD.dim = 1; GodFX.tint(BCC.green, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.focus = null;
  },
  intercept() { return busyNow(); },
  busy: busyNow,
  cast(id) { ({ ch: castChug, bf: castBellyFlop, bg: castBelch, ix: castIntoxicate, df: castDeadlyFart })[id](); },
  basic: bacchusBasic,
  moveOverride(dt) {
    if (BC.belch || (BC.intox && !BC.intox.burst) || (BC.fart && !BC.fart.released)) { P.vel.set(0, 0, 0); return true; }
    return updateFlop(dt);
  },
  speedMul() { return (BC.cloud && !BC.cloud.ended ? 1.1 : 1) * (bacSmashed() ? 1.05 : 1); },
  damageMul() { return 1 + (BC.chugBuff > 0 ? AB.ch.buff[rankOf('ch') - 1] : 0) + (BC.smashBuff > 0 ? AB.ix.buff : 0); },
  noJump() { return busyNow(); },
  ghost() { return !!BC.flop; },
  dashing() { return !!(BC.flop && BC.flop.phase === 'air'); },   // (the camera's speed FOV only while he flies)
  animVel() { return BC.flop || BC.belch || (BC.fart && !BC.fart.released) || (BC.intox && !BC.intox.burst) ? _v1.set(0, 0, 0) : P.vel; },
  eyeBoost() { return (BC.fart ? (BC.fart.released ? 0.6 : 0.4 + 1.2 * clamp(BC.fart.t / BAC_DF.release, 0, 1)) : 0) + (BC.belch ? 0.6 : 0) + (BC.intox && !BC.intox.burst ? 0.8 : 0); },
  lockYaw() { return !!(BC.flop || (BC.fart && !BC.fart.released)); },
  update(dt, t) {
    BC.comboT = Math.max(0, BC.comboT - dt);
    BC.chugBuff = Math.max(0, BC.chugBuff - dt); BC.nextHit = Math.max(0, BC.nextHit - dt); BC.smashBuff = Math.max(0, BC.smashBuff - dt);
    BC.auras = BC.auras.filter((a) => !a.dead);
    // the meter drains slowly once he stops drinking
    BC.hold = Math.max(0, BC.hold - dt);
    if (BC.hold <= 0) BC.drunk = Math.max(0, BC.drunk - 2 * dt);
    // drunk: wine bubbles drift off him; smashed: he hiccups now and then and the world sways a little
    const lv = bacLevel();
    if (lv > 0 && Math.random() < dt * (lv > 1 ? 8 : 3)) bacFizz(_v3.copy(P.pos).setY(rand(1.0, 2.0)), 2, 0.4);
    if (lv > 0 && !busyNow()) { BC.hicT -= dt; if (BC.hicT <= 0) { BC.hicT = rand(10, 16) / (lv > 1 ? 1.5 : 1); bacHiccup(); } }
    if (lv > 1) PostFX.aberr = Math.max(PostFX.aberr || 0, 0.0008 + 0.0005 * Math.sin(t * 1.3));
    if (BC.chugBuff > 0 && Math.random() < dt * 6) bacFizz(bacJugTip(_v3), 1, 0.04);
    updateChug(dt); updateBelch(dt); updateIntox(dt, t); updateFart(dt, t); updateCloud(dt, t); updateDrunks(dt, t); updateLifts(dt);
  },
  onDamage(d, amt, kind) { if (kind === 'final' || kind === 'dot') return; if (Math.random() < 0.3) bacGrapes(d.pos.clone().setY(1.2), 2, 0.3); },
  onKill(d) { if (BC.fart) BC.fart.kills++; },
  targeter() {
    if (P.targeting === 'bf') { const c = groundTarget(AB.bf.range * SU, 3); circleTarget.show(c, AB.bf.radius * SU, BCC.magenta); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.5, 0.5); }
  },
  armed(id) { return (id === 'bf' && !!BC.flop) || (id === 'bg' && !!BC.belch) || (id === 'ix' && !!BC.intox && !BC.intox.burst) || (id === 'df' && !!(BC.fart || BC.cloud)); },
  stack(id) { return id === 'ch' && BC.nextHit > 0 ? '+' : ''; },
  buffs() {
    return [
      { icon: `bac_drunk${bacLevel()}`, on: BC.drunk >= 1, n: '', t: `${Math.round(BC.drunk)}%` },
      { icon: 'bac_chug', on: BC.chugBuff > 0, n: '', t: Math.ceil(BC.chugBuff) + 's' },
      { icon: 'bac_smash', on: BC.smashBuff > 0, n: '', t: Math.ceil(BC.smashBuff) + 's' },
    ];
  },
  onDummyDeath(d, p) { bacWine(p.clone().setY(1.2), 20, 1.0); bacGrapes(p.clone().setY(1.0), 8, 0.6); },
  icon(ctx, S, id) {
    const glow = (fn, col = '#ffb0d8', blur = 16) => glowText(ctx, fn, col, blur);
    const jug = (x, y, s, col = '#ffe2a0', tilt = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.5); ctx.lineTo(s * 0.18, -s * 0.5); ctx.quadraticCurveTo(s * 0.1, -s * 0.3, s * 0.42, -s * 0.05); ctx.quadraticCurveTo(s * 0.5, s * 0.4, s * 0.2, s * 0.48); ctx.lineTo(-s * 0.2, s * 0.48); ctx.quadraticCurveTo(-s * 0.5, s * 0.4, -s * 0.42, -s * 0.05); ctx.quadraticCurveTo(-s * 0.1, -s * 0.3, -s * 0.18, -s * 0.5); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.1, s * 0.2, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.restore(); };
    const grapes = (x, y, s, col = '#c070ff') => { ctx.fillStyle = col; for (const [gx, gy] of [[0, 0], [-1, -1], [1, -1], [-2, -2], [0, -2], [2, -2], [-1, -3], [1, -3]]) { ctx.beginPath(); ctx.arc(x + gx * s * 0.5, y - gy * s * 0.45 - s * 1.2, s * 0.32, 0, TAU); ctx.fill(); } };
    const puff = (x, y, r, col) => { ctx.fillStyle = col; for (const [px, py, pr] of [[0, 0, 1], [-0.8, 0.25, 0.75], [0.8, 0.25, 0.75], [-0.4, -0.55, 0.7], [0.45, -0.5, 0.65]]) { ctx.beginPath(); ctx.arc(x + px * r, y + py * r, pr * r, 0, TAU); ctx.fill(); } };
    if (id === 'passive') { iconBase(ctx, S, '#7a1a4a', '#1a0410'); glow(() => { jug(S * 0.42, S * 0.52, S * 0.62, '#ffe2a0'); ctx.fillStyle = '#ff4a9a'; ctx.fillRect(S * 0.76, S * 0.2, S * 0.1, S * 0.62); ctx.fillStyle = '#2a0614'; ctx.fillRect(S * 0.78, S * 0.22, S * 0.06, S * 0.3); }); }
    else if (id === 'ch') { iconBase(ctx, S, '#a0285a', '#24040f'); glow(() => { jug(S * 0.42, S * 0.42, S * 0.5, '#ffe2a0', -0.7); ctx.fillStyle = '#ff3a7a'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(S * (0.6 + i * 0.03), S * (0.45 + i * 0.07), S * 0.035, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffd0e8'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(S * (0.25 + i * 0.12), S * (0.82 - (i % 2) * 0.06), S * 0.03, 0, TAU); ctx.fill(); } }); }
    else if (id === 'bf') { iconBase(ctx, S, '#8a3a1a', '#200a04'); glow(() => { ctx.fillStyle = '#ffd8b0'; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.52, S * 0.3, S * 0.2, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff6aa8'; ctx.lineWidth = S * 0.04; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.82, S * 0.4, S * 0.08, 0, 0, TAU); ctx.stroke(); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(S * 0.5 + sx * S * 0.34, S * 0.72); ctx.lineTo(S * 0.5 + sx * S * 0.44, S * 0.6); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.12); ctx.lineTo(S * 0.5, S * 0.28); ctx.stroke(); }, '#ff8ac2'); }
    else if (id === 'bg') { iconBase(ctx, S, '#6a1a7a', '#14041a'); glow(() => { ctx.fillStyle = '#ffd8b0'; ctx.beginPath(); ctx.arc(S * 0.26, S * 0.5, S * 0.16, 0, TAU); ctx.fill(); ctx.fillStyle = '#e080ff'; for (let i = 0; i < 9; i++) { const a = -0.6 + (i % 3) * 0.6, r = S * (0.22 + Math.floor(i / 3) * 0.17); ctx.beginPath(); ctx.arc(S * 0.3 + Math.cos(a) * r, S * 0.5 + Math.sin(a) * r, S * (0.035 + Math.floor(i / 3) * 0.015), 0, TAU); ctx.fill(); } }, '#d080ff'); }
    else if (id === 'ix') { iconBase(ctx, S, '#9a1a5a', '#20040f'); glow(() => { ctx.strokeStyle = '#ff5aa0'; ctx.lineWidth = S * 0.05; for (const r of [0.2, 0.32, 0.43]) { ctx.beginPath(); ctx.arc(S / 2, S / 2, S * r, 0, TAU); ctx.stroke(); } grapes(S * 0.5, S * 0.5, S * 0.09); }, '#ff7ac0'); }
    else if (id === 'df') { iconBase(ctx, S, '#3a7a0a', '#0a1a02'); glow(() => { puff(S * 0.5, S * 0.55, S * 0.17, '#a6ff4a'); puff(S * 0.28, S * 0.36, S * 0.09, '#7ae02a'); puff(S * 0.74, S * 0.34, S * 0.08, '#7ae02a'); ctx.strokeStyle = '#e8ffb0'; ctx.lineWidth = S * 0.035; for (const x of [0.36, 0.5, 0.64]) { ctx.beginPath(); ctx.moveTo(S * x, S * 0.3); ctx.bezierCurveTo(S * (x - 0.06), S * 0.22, S * (x + 0.06), S * 0.16, S * x, S * 0.08); ctx.stroke(); } }, '#a6ff4a', 18); }
    else if (id.startsWith('bac_drunk')) { const lv = +id.slice(-1); iconBase(ctx, S, ['#5a2a4a', '#8a1a5a', '#c01040'][lv], '#14040a'); glow(() => { jug(S * 0.5, S * 0.55, S * 0.6, ['#e0c0d0', '#ffb0d8', '#ff6a9a'][lv]); }); }
    else if (id === 'bac_chug') { iconBase(ctx, S, '#a0285a', '#24040f'); glow(() => jug(S * 0.5, S * 0.55, S * 0.6, '#ffe2a0', -0.4)); }
    else if (id === 'bac_smash') { iconBase(ctx, S, '#c01040', '#24040a'); glow(() => grapes(S * 0.5, S * 0.6, S * 0.11, '#ff5a8a'), '#ff5a8a'); }
    else return false;
    return true;
  },
});


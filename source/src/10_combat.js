// ============================================================================
// Combat: Thoth's SMITE 1 numbers (final patch, Dec 2024), damage maths,
// practice dummies, projectiles and floating combat text.
// ============================================================================
const THOTH_STATS = {
  hp: [365, 75], mp: [245, 49], speed: 355, range: 55, as: [1.0, 0.012],
  basic: [32, 1.5], basicScale: 0.2, hp5: [6, 0.45], mp5: [4.6, 0.44],
};
const AB = {
  ha: { id: 'ha', key: 'Q', name: 'Hieroglyphic Assault', dmg: [50, 70, 90, 110, 130], scale: 0.25, cost: [50, 55, 60, 65, 70], cd: [10, 10, 10, 10, 10], shots: 3, range: 55, rangeGlyph: 30, jungle: 0.25, godStack: 0.1, cdPerGod: 0.5, life: 10 },
  ep: { id: 'ep', key: 'E', name: 'Evade and Punish', dmg: [70, 110, 150, 190, 230], scale: 0.6, cost: [70, 75, 80, 85, 90], cd: [14, 13.5, 13, 12.5, 12], dash: 45, range: 55, rangeGlyph: 30, root: 1.5, slow: 0.3, slowDur: 1.5, window: 5 },
  gp: { id: 'gp', key: 'R', name: 'Glyph of Pain', abil: [10, 20, 30, 40, 50], abilScale: 0.05, basicB: [30, 35, 40, 45, 50], basicScale: 0.05, cost: [25, 30, 35, 40, 45], cd: [5, 5, 5, 5, 5], dur: 8, range: 55, rangeBonus: 30 },
  fj: { id: 'fj', key: 'F', name: 'Final Judgement', dmg: [420, 480, 540, 600, 660], scale: 1.2, cost: [100, 100, 100, 100, 100], cd: [90, 90, 90, 90, 90], channel: 3, steps: [0.4, 0.6, 0.8, 1.0], range: 100, rangeGlyph: 30, cancelCost: 30 },
  // playroom original (not in SMITE): the last spell ever written - the book in the sky, the ground split open
  // balance (ability 5 >= 2 x ability 4): 2.24 x Final Judgement's base and 2.25 x its scaling, rank for rank, so even the
  // 90 % edge of the circle stays above twice a full Judgement (was 300-500 + 60 %, weaker than the 4)
  fs: { id: 'fs', key: 'G', name: 'The Final Spell', cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33], dmg: [940, 1080, 1210, 1350, 1480], scale: 2.7, stun: 1.2, edge: 0.9 },
  passive: { name: 'Dead Reckoning', kills: 20, flat: 3, pct: 0.01 },
};
let ABILITY_ORDER = ['ha', 'ep', 'gp', 'fj', 'fs'];   // the active god's slots 1-5 (set on god switch)
const rankOf = (id) => clamp(settings.ranks[ABILITY_ORDER.indexOf(id)] || 1, 1, 5);
const lvl = () => clamp(settings.level, 1, 20);
const statAt = (pair) => pair[0] + pair[1] * (lvl() - 1);
const reckonMaxStacks = () => Math.min(5, 1 + Math.floor((lvl() - 1) / 4));

const Combat = {
  time: 0,
  dummies: [],
  projectiles: [],
  walls: [],
  texts: [],
  log: [],          // {t, amount}
  total: 0,
  lastHit: null,
  reckon: { names: 0, stacks: 0 },
  onKill: null,
  pen() { const s = Kit && Kit.id === 'thoth' ? this.reckon.stacks : 0; return { flat: AB.passive.flat * s, pct: AB.passive.pct * s }; },
  mitigate(raw, target, physical = false) {
    const p = physical ? { flat: 0, pct: 0 } : this.pen();
    const prot = physical ? target.physProt : target.magProt;
    const eff = Math.max(0, prot * (1 - p.pct) - p.flat);
    return raw * 100 / (100 + eff);
  },
  deal(target, raw, kind, src, trueDamage = false, physical = null) {
    if (!target.alive || Net.ctx) return 0;   // (a replayed cast deals nothing: its caster's page sends the blows)
    if (physical === null) physical = !!(Kit && Kit.physical);
    // Triplicate Form's mark and the like amplify every hit
    if (target.markT > 0 && kind !== 'dot') raw *= 1 + target.markAmp;
    if (Kit && Kit.damageMul && !trueDamage) raw *= Kit.damageMul();
    const amt = Math.max(1, Math.round(trueDamage ? raw : this.mitigate(raw, target, physical)));
    const own = !Net.online || Net.ownsTarget(target);   // (online: another page's unit or player takes the blow there; 14n_net.js)
    if (own) target.hp -= amt; else Net.hit(target, amt, kind, this.critHit);
    target.lastHit = this.time;
    target.flash = 1;
    this.total += amt;
    this.log.push({ t: this.time, a: amt });
    this.lastHit = { amount: amt, name: src };
    const accent = (Kit && Kit.textColor) || '#9fe6ff';
    const color = kind === 'basic' ? '#ffffff' : kind === 'glyph' ? '#ffb347' : kind === 'ult' ? accent : kind === 'wrath' || kind === 'final' ? (Kit && Kit.finalColor) || '#5ff6ff' : kind === 'dot' ? '#ff8a7a' : '#ffd25e';
    this.floatNumber(target, target.pos.x, target.height + 0.4, target.pos.z, amt, color, kind === 'ult' || kind === 'wrath' || kind === 'final', kind === 'dot');
    if (kind !== 'dot') Sound.hit(kind === 'final' ? 'wrath' : kind, target.pos);
    if (target.onHit) target.onHit(kind);
    if (Kit && Kit.onDamage) Kit.onDamage(target, amt, kind);
    if (own && target.hp <= 0) this.kill(target);
    return amt;
  },
  // floating combat numbers, decluttered (realism pass): rapid hits of the same colour on the same target merge into
  // one rising number (ticks within 0.6 s, other hits within 0.25 s) instead of a fountain of digits; at most 28 on screen
  floatNumber(key, x, y, z, amt, color, big = false, small = false, prefix = '') {
    const prev = key && key._ftx, win = small ? 0.6 : 0.25;
    if (prev && !prev.done && prev.color === color && this.time - prev.born < win && prev.t < 0.7) {
      prev.amt += amt; prev.text = prefix + prev.amt; prev.big = prev.big || big || prev.amt > 300; prev.small = prev.small && small && prev.amt < 120;
      prev.t = Math.min(prev.t, 0.06); prev.born = this.time;   // (a little re-pop as it grows)
      return prev;
    }
    const tx = { x: x + rand(-0.3, 0.3), y: y + rand(0, 0.3), z: z + rand(-0.3, 0.3), text: prefix + amt, amt, color, t: 0, born: this.time, big: big || amt > 300, small };
    this.texts.push(tx);
    if (this.texts.length > 28) { const old = this.texts.shift(); old.done = true; }
    if (key) key._ftx = tx;
    return tx;
  },
  kill(target) {
    target.alive = false;
    target.hp = 0;
    target.respawn = target.isGod ? 5 : 3;
    target.onDeath();
    this.credit(target);
  },
  // the killer's side of a kill (online also for a kill decided on another page: Net.slain)
  credit(target) {
    // Dead Reckoning (Thoth): pen the name into the book
    const R = this.reckon, max = reckonMaxStacks();
    if (Kit && Kit.id === 'thoth' && R.stacks < max) {
      if (target.isGod) { R.stacks++; R.names = 0; HUD.toast(`Dead Reckoning · stack ${R.stacks}/${max} (god slain)`); VFX.later(1.2, () => Sound.voice('knowledge', { priority: 2, cooldown: 8 })); }
      else {
        R.names++;
        if (R.names >= AB.passive.kills) { R.stacks++; R.names = 0; HUD.toast(`Dead Reckoning · stack ${R.stacks}/${max}`); VFX.later(0.8, () => Sound.voice('knowledge', { priority: 2, cooldown: 8 })); }
      }
    }
    if (this.onKill) this.onKill(target);
  },
  dps() {
    const now = this.time;
    this.log = this.log.filter((e) => now - e.t < 5);
    return this.log.reduce((s, e) => s + e.a, 0) / 5;
  },
};

// ---------------------------------------------------------------------------
// Practice dummies: faience ushabti statues, shambling mummies and the Anubis sentinel (a god)
// ---------------------------------------------------------------------------
function buildUshabtiMesh() {
  const g = new THREE.Group();
  const loft = new Loft([
    { y: 0.0, rx: 0.2, rz: 0.17 },
    { y: 0.1, rx: 0.2, rz: 0.19, cz: 0.02 },
    { y: 0.35, rx: 0.185, rz: 0.15 },
    { y: 0.7, rx: 0.205, rz: 0.15 },
    { y: 0.95, rx: 0.232, rz: 0.16 },
    { y: 1.15, rx: 0.258, rz: 0.17 },
    { y: 1.28, rx: 0.27, rz: 0.17 },
    { y: 1.36, rx: 0.2, rz: 0.15 },
    { y: 1.46, rx: 0.185, rz: 0.165 },
    { y: 1.58, rx: 0.175, rz: 0.155 },
    { y: 1.66, rx: 0.125, rz: 0.115 },
    { y: 1.7, rx: 0.02, rz: 0.02 },
  ], { radial: 40, sub: 3, n: 2.2 });
  const tex = M.ushabti.map; tex.wrapS = THREE.RepeatWrapping; tex.offset.x = 0.5;
  const body = meshOf(loft.geometry({ capStart: true }), M.ushabti);
  body.position.y = 0.3; g.add(body);
  // crossed arms holding hoes
  for (const sx of [1, -1]) {
    const arm = meshOf(sweep([V3(0.2 * sx, 1.36, 0.06), V3(0.16 * sx, 1.24, 0.15), V3(-0.02 * sx, 1.14, 0.18), V3(-0.12 * sx, 1.18, 0.17)], { segs: 12, radial: 10, rx: () => 0.045 }), M.ushabtiDark);
    g.add(arm);
    const fist = meshOf(new THREE.SphereGeometry(0.05, 12, 8), M.ushabtiDark); fist.position.set(-0.11 * sx, 1.19, 0.18); g.add(fist);
    const hoe = meshOf(new THREE.BoxGeometry(0.03, 0.26, 0.03), M.claw); hoe.position.set(-0.11 * sx, 1.2, 0.2); hoe.rotation.z = 0.5 * sx; g.add(hoe);
  }
  // wig lappets in front of the shoulders
  for (const sx of [1, -1]) {
    const lp = meshOf(new THREE.BoxGeometry(0.09, 0.26, 0.05), M.ushabtiDark); lp.position.set(0.15 * sx, 1.55, 0.11); lp.rotation.x = -0.1; g.add(lp);
  }
  const nose = meshOf(new THREE.SphereGeometry(0.03, 10, 8), M.ushabti); nose.position.set(0, 1.78, 0.16); nose.scale.set(0.7, 1, 0.8); g.add(nose);
  const plinth = meshOf(new THREE.BoxGeometry(0.85, 0.3, 0.85), new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 0.85 }));
  plinth.position.y = 0.15; g.add(plinth);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// GLB ushabti statue (falls back to the procedural one)
function makeUshabtiProp() {
  const g = new THREE.Group();
  const m = Assets.glb.ushabti.scene.clone(true);
  m.scale.setScalar(2.05);
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.envMapIntensity = 1.2; } });
  g.add(m);
  return g;
}

class Dummy {
  constructor(kind, x, z, opts = {}) {
    if (kind === 'mummy' && !Assets.glb.mummy) kind = 'ushabti';
    this.kind = kind;
    this.isGod = kind === 'sentinel';
    this.isJungle = kind === 'ushabti';
    this.isMummy = kind === 'mummy';
    this.name = this.isGod ? 'Anubis Guardian' : this.isMummy ? 'Mummy' : 'Ushabti';
    this.maxHp = this.isGod ? 3400 : this.isMummy ? 720 : 950;
    this.hp = this.maxHp;
    this.magProt = this.isGod ? 62 : this.isMummy ? 12 : 18;
    this.physProt = this.isGod ? 70 : this.isMummy ? 15 : 22;
    this.radius = this.isGod ? 0.62 : this.isMummy ? 0.45 : 0.5;
    this.height = this.isGod ? 2.75 : this.isMummy ? 1.95 : 2.0;
    this.base = new THREE.Vector3(x, 0, z);
    this.pos = this.base.clone();
    this.patrol = this.base.clone();
    this.move = opts.move || null; // {axis: Vector3, amp, speed}
    this.phase = opts.phase || 0;
    this.alive = true; this.respawn = 0; this.lastHit = -99; this.flash = 0; this.dying = 0; this.hitCd = 0;
    this.clearStatus();
    this.haHits = 0; this.haCast = -1;
    this.facing = opts.yaw ?? Math.PI;
    this.rig = null;
    if (this.isGod && Assets.glb.sentinel) {
      this.rig = new MixerRig(Assets.glb.sentinel, { keepXZ: { death: 0.5 }, once: ['death', 'hit'], env: 1.25 });
      this.mesh = this.rig.root; this.rig.loop('idle');
      this.walkSpeed = 1.16;
    } else if (this.isGod) {
      this.ch = buildSentinel();
      this.mesh = this.ch.root;
      this.anim = new Animator(this.ch, null);
    } else if (this.isMummy) {
      this.rig = new MixerRig(Assets.glb.mummy, { keepXZ: { death: 0.18 }, keepUp: { death: 0.35 }, once: ['death', 'hit', 'scream'], env: 1.1 });
      this.mesh = this.rig.root; this.rig.loop('walk');
      this.rig.acts.walk.time = rand(0, 4);
      this.walkSpeed = 0.32;
    } else {
      this.mesh = Assets.glb.ushabti ? makeUshabtiProp() : buildUshabtiMesh();
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
    scene.add(this.mesh);
    this.statusDecal = null;
    this.velocity = new THREE.Vector3();
  }
  // ---- crowd control and other statuses (all in seconds)
  clearStatus() {
    this.root = 0; this.slow = 0; this.slowAmt = 0; this.stun = 0; this.frozen = 0; this.mez = 0; this.blind = 0;
    this.markT = 0; this.markAmp = 0; this.bleeds = []; this.dotAcc = 0;
    this.disp = this.disp || new THREE.Vector3(); this.disp.set(0, 0, 0); this.dispHold = 0;
    this.slideV = this.slideV || new THREE.Vector3(); this.slideV.set(0, 0, 0);
    this.carried = false; this.lift = 0; this.huntMark = 0; this.drunk = 0; this.gas = 0; this.antiheal = 0;
    if (this.ice) { GodFX.removeIce(this.ice); this.ice = null; }
    if (this.statusFx) { this.statusFx.dispose(); this.statusFx = null; }
  }
  get cc() { return this.root > 0 || this.stun > 0 || this.frozen > 0 || this.mez > 0 || this.carried; }
  applyStun(t) { if (!this.alive) return; this.stun = Math.max(this.stun, t); GodFX.status(this, 'stun'); }
  freeze(t) { if (!this.alive) return; this.frozen = Math.max(this.frozen, t); if (!this.ice) this.ice = GodFX.iceBlock(this); GodFX.status(this, 'frozen'); }
  mesmerize(t) { if (!this.alive) return; this.mez = Math.max(this.mez, t); GodFX.status(this, 'mez'); }
  blinded(t) { if (!this.alive) return; this.blind = Math.max(this.blind, t); GodFX.status(this, 'blind'); }
  rooted(t) { if (!this.alive) return; this.root = Math.max(this.root, t); }
  slowed(amt, t) { if (!this.alive) return; this.slow = Math.max(this.slow, t); this.slowAmt = Math.max(amt, this.slow > 0 ? this.slowAmt : 0); }
  marked(t, amp) { if (!this.alive) return; this.markT = Math.max(this.markT, t); this.markAmp = Math.max(this.markAmp, amp); GodFX.status(this, 'mark'); }
  bleed(dps, t, src = 'Bleed') { if (!this.alive) return; this.bleeds.push({ dps, t, src }); GodFX.status(this, 'bleed'); }
  // move the dummy to a world point (teleports, pulls, carries); it walks back after `hold` seconds
  placeAt(p, hold = 2.5) { this.disp.set(p.x - this.patrol.x, 0, p.z - this.patrol.z); this.dispHold = Math.max(this.dispHold, hold); }
  shove(v, hold = 2.0) { this.disp.add(_v1.set(v.x, 0, v.z)); this.dispHold = Math.max(this.dispHold, hold); }
  slideAlong(v, hold = 2.5) { this.slideV.set(v.x, 0, v.z); this.dispHold = Math.max(this.dispHold, hold); }
  onHit(kind) {
    if (!this.rig || this.hitCd > 0 || !this.alive || this.frozen > 0) return;
    this.hitCd = kind === 'ult' ? 0.2 : 0.7;
    const a = this.rig.oneShot('hit', 0.06, kind === 'ult' ? 0.95 : 0.6, 1.5);
    if (a) VFX.later(0.38, () => { if (this.alive) a.fadeOut(0.3); });
  }
  onDeath() {
    const p = this.pos.clone();
    const wasFrozen = this.frozen > 0;
    if (wasFrozen && this.ice) { GodFX.shatterIce(this); }
    this.clearStatus();
    if (this.rig && !wasFrozen) {
      // play the fall, then crumble (sentinel: obsidian shards, mummy: a burst of sand)
      this.dying = this.isGod ? 1.35 : 0.95;
      this.rig.mixer.stopAllAction();
      this.rig.mixer.timeScale = 1;
      this.rig.current = null;
      const a = this.rig.acts.death; a.reset(); a.timeScale = this.isGod ? 1.2 : 1.35; a.setEffectiveWeight(1); a.play();
      VFX.burst(p.clone().add(V3(0, 1.3, 0)), { color: this.isGod ? COL.gold : (Kit && Kit.fxColor) || COL.glyph, count: 26, speed: 5, flash: 2, glyphs: Kit && Kit.id === 'thoth' ? 6 : 0 });
    } else { if (this.rig) this.rig.mixer.timeScale = 1; this.crumble(); }
    Sound.shatter(this.isGod, p);
    if (Kit && Kit.onDummyDeath) Kit.onDummyDeath(this, p);
  }
  crumble() {
    const p = this.pos.clone();
    if (this.isGod) {
      VFX.shatter(p, M.obsidian, 34, 1.4);
      VFX.burst(p.clone().add(V3(0, 1.4, 0)), { color: COL.gold, count: 40, speed: 7, flash: 2.6, glyphs: 10, intensity: 3.5 });
    } else if (this.isMummy) {
      VFX.shatter(p, M.linen || M.ushabti, 18, 0.8);
      VFX.burst(p.clone().add(V3(0, 0.6, 0)), { color: new THREE.Color(0.9, 0.75, 0.5), count: 24, speed: 4, flash: 1.2, glyphs: 3 });
    } else {
      VFX.shatter(p, M.ushabti, 24, 1);
      VFX.burst(p.clone().add(V3(0, 1.2, 0)), { color: COL.teal, count: 26, speed: 5, flash: 1.8, glyphs: 6 });
    }
    const dust = this.isMummy ? new THREE.Color(0.72, 0.6, 0.42) : new THREE.Color(0.55, 0.48, 0.4);
    for (let i = 0; i < (this.isMummy ? 18 : 10); i++) VFX.smoke.spawn({ pos: p.clone().add(V3(rand(-0.5, 0.5), rand(0.1, 1.2), rand(-0.5, 0.5))), vel: V3(rand(-0.8, 0.8), rand(0.2, 1.2), rand(-0.8, 0.8)), life: rand(1.2, 2.2), size: rand(0.8, 1.5), sizeEnd: 2.6, color: dust, alpha: 0.4, alphaEnd: 0, cell: FX.smoke, drag: 1.2 });
    this.mesh.visible = false;
  }
  revive() {
    this.alive = true; this.hp = this.maxHp; this.mesh.visible = true; this.dying = 0;
    this.clearStatus();
    this.patrol.copy(this.base); this.pos.copy(this.base);
    this.mesh.position.y = 0;
    this.spawnT = 0;
    if (this.rig) { this.rig.mixer.stopAllAction(); this.rig.mixer.timeScale = 1; this.rig.current = null; this.rig.loop(this.isMummy ? 'walk' : 'idle', 0.01); this.rig.flash(0); }
    VFX.burst(this.pos.clone().add(V3(0, 1, 0)), { color: this.isGod ? COL.gold : COL.teal, count: 20, speed: 3, flash: 1.6, glyphs: 4 });
  }
  update(dt, t) {
    if (this.rig) this.rig.update(dt);
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.crumble();
      return;
    }
    if (!this.alive) {
      this.respawn -= dt;
      if (this.respawn <= 0) this.revive();
      return;
    }
    // regen to full a few seconds after the last hit (practice dummies)
    if (Combat.time - this.lastHit > 4.5 && this.hp < this.maxHp && !this.bleeds.length && !(this.antiheal > 0)) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.8);
    for (const k of ['root', 'slow', 'stun', 'mez', 'blind', 'markT', 'huntMark', 'drunk', 'gas', 'antiheal']) this[k] = Math.max(0, this[k] - dt);
    if (this.markT <= 0) this.markAmp = 0;
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) { this.frozen = 0; if (this.ice) { GodFX.thaw(this.ice); this.ice = null; } } }
    this.flash = Math.max(0, this.flash - dt * 5);
    this.hitCd = Math.max(0, this.hitCd - dt);
    // damage over time (bleeds): ticks twice a second
    if (this.bleeds.length) {
      let dps = 0; for (const b of this.bleeds) { dps += b.dps; b.t -= dt; }
      this.bleeds = this.bleeds.filter((b) => b.t > 0);
      this.dotAcc += dps * dt;
      if (this.dotAcc >= dps * 0.5 && this.dotAcc > 1) { const a = this.dotAcc; this.dotAcc = 0; Combat.deal(this, a, 'dot', 'Bleed', true); if (!this.alive) return; }
    }
    if (this.statusFx) this.statusFx.update(dt, t);
    const prev = this.pos.clone();
    if (this.move && settings.dummiesMove && !this.cc) {
      const sp = this.slow > 0 ? 1 - this.slowAmt : 1;
      this.phase += dt * this.move.speed * sp;
      const k = Math.sin(this.phase);
      this.patrol.copy(this.base).addScaledVector(this.move.axis, k * this.move.amp);
    }
    // displacement: slides, shoves and teleports; after a while they walk back onto their path
    if (this.slideV.lengthSq() > 1e-4) { this.disp.addScaledVector(this.slideV, dt); this.slideV.multiplyScalar(Math.exp(-1.1 * dt)); }
    if (!this.carried) {
      if (this.dispHold > 0) this.dispHold -= dt;
      else if (this.disp.lengthSq() > 1e-6 && !this.cc) { const l = this.disp.length(), step = Math.min(l, 1.6 * dt); this.disp.multiplyScalar((l - step) / l); }
    }
    this.pos.copy(this.patrol).add(this.disp);
    resolveCircle(this.pos, this.radius * 0.8);
    this.disp.set(this.pos.x - this.patrol.x, 0, this.pos.z - this.patrol.z);
    this.velocity.copy(this.pos).sub(prev).divideScalar(Math.max(dt, 1e-4));
    this.mesh.position.set(this.pos.x, this.lift, this.pos.z);
    if (this.spawnT !== undefined && this.spawnT < 1) { this.spawnT += dt * 2.2; this.mesh.scale.setScalar(easeOutBack(clamp(this.spawnT, 0, 1)) * (this.isGod && !this.rig ? 1.12 : 1)); }
    const v = this.velocity.length();
    if (this.rig) this.rig.mixer.timeScale = this.frozen > 0 ? 0 : this.stun > 0 || this.mez > 0 ? 0.25 : 1;
    if ((this.isGod || this.isMummy) && this.frozen <= 0) {
      // face travel direction while walking, otherwise eye the player
      if (v > 0.15 && !this.carried && this.slideV.lengthSq() < 0.5) this.facing = dampAngle(this.facing, Math.atan2(this.velocity.x, this.velocity.z), this.isMummy ? 3 : 6, dt);
      else if (!this.cc) this.facing = dampAngle(this.facing, Math.atan2(Game.player.pos.x - this.pos.x, Game.player.pos.z - this.pos.z), 3, dt);
      this.mesh.rotation.y = this.facing;
      if (this.rig) {
        if (this.isGod) {
          if (v > 0.35 && !this.cc) this.rig.loop('walk', 0.35, clamp(v / this.walkSpeed, 0.6, 1.8)); else this.rig.loop('idle', 0.4);
        } else {
          this.rig.acts.walk.timeScale = this.cc ? 0 : clamp(v / this.walkSpeed, 0.5, 2.4);
          if (!this.move || !settings.dummiesMove) this.rig.acts.walk.timeScale = 0.8;
        }
        this.rig.flash(this.flash * 0.55);
      } else this.anim.update(dt, { vel: this.velocity, runSpeed: 5.5 });
    } else if (!this.isGod && !this.isMummy) {
      this.mesh.rotation.y = this.facing + (this.frozen > 0 ? 0 : Math.sin(t * 1.3 + this.base.x) * 0.03);
    }
    if (this.isGod && !this.rig) M.enemyEye.emissiveIntensity = 4 + this.flash * 6;
  }
}

function spawnDummies() {
  const D = Combat.dummies;
  // a column straight ahead of the spawn for piercing shots, two flankers, two shambling mummies,
  // the jackal god walking the medallion, two far targets
  D.push(new Dummy('ushabti', 0, -11.0));
  D.push(new Dummy('ushabti', 0, -9.1));
  D.push(new Dummy('ushabti', 0, -7.2));
  D.push(new Dummy('ushabti', -5.2, -10.2));
  D.push(new Dummy('ushabti', 5.2, -10.2));
  D.push(new Dummy('mummy', 0, -2.6, { move: { axis: V3(1, 0, 0), amp: 6.2, speed: 0.22 }, phase: 0 }));
  D.push(new Dummy('mummy', 0, 0.6, { move: { axis: V3(1, 0, 0), amp: 6.2, speed: 0.18 }, phase: 2.2 }));
  D.push(new Dummy('sentinel', 0, 6.0, { move: { axis: V3(1, 0, 0), amp: 6.5, speed: 0.3 }, phase: 0.6, yaw: Math.PI }));
  D.push(new Dummy('ushabti', -8.5, 13.5));
  D.push(new Dummy('ushabti', 8.5, 13.5));
}
function resetDummies() {
  for (const d of Combat.dummies) { if (!d.alive) { d.dying = 0; d.respawn = 0; d.update(0.016, Combat.time); } d.hp = d.maxHp; d.clearStatus(); }
  Combat.total = 0; Combat.log = []; Combat.lastHit = null;
  Combat.reckon.names = 0; Combat.reckon.stacks = 0;
  HUD.toast('Targets reset');
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
// kind: 'basic' | 'ha' | 'ep'
class Projectile {
  constructor(o) {
    Object.assign(this, o);
    this.pos = o.pos.clone(); this.dir = o.dir.clone().normalize();
    this.traveled = 0; this.hit = new Set(); this.alive = true; this.empowered = false; this.wallsCrossed = new Set();
    this.t = 0;
    this.ctx = Net.ctx;   // (another player's replayed shot flies on as that player: 14n_net.js)
  }
  update(dt) {
    const step = this.speed * dt;
    const p0 = this.pos.clone();
    const p1 = p0.clone().addScaledVector(this.dir, step);
    // wall blocking (terrain)
    const tb = this.throughWalls ? 1 : segmentBlocked(p0.x, p0.z, p1.x, p1.z);
    if (tb < 1) p1.lerpVectors(p0, p0.clone().addScaledVector(this.dir, step), tb);
    // Glyph of Pain crossings
    for (const w of Combat.walls) {
      if (this.wallsCrossed.has(w) || this.empowered || !Net.mine(w)) continue;
      const ip = w.cross(p0, p1, 0, 4);
      if (ip) { this.wallsCrossed.add(w); this.empower(w, ip); }
    }
    // hits
    for (const d of Combat.dummies) {
      if (!d.alive || this.hit.has(d)) continue;
      const hitR = d.radius + this.radius;
      const ax = p1.x - p0.x, az = p1.z - p0.z;
      const len2 = ax * ax + az * az || 1e-6;
      const tt = clamp(((d.pos.x - p0.x) * ax + (d.pos.z - p0.z) * az) / len2, 0, 1);
      const cx = p0.x + ax * tt, cz = p0.z + az * tt;
      if ((cx - d.pos.x) ** 2 + (cz - d.pos.z) ** 2 <= hitR * hitR) {
        this.hit.add(d);
        const hp = new THREE.Vector3(cx, this.pos.y, cz);
        this.onHit(d, hp, this);
        if (!this.pierce) { this.die(hp, true); return false; }
      }
    }
    this.traveled += p0.distanceTo(p1);
    this.pos.copy(p1);
    this.t += dt;
    if (this.onMove) this.onMove(this, dt);
    if (!this.alive) return false;
    if (tb < 1) { this.die(this.pos, false); return false; }
    if (this.traveled >= this.maxDist) { this.die(this.pos, false); return false; }
    return true;
  }
  empower(w, ip) {
    this.empowered = true;
    if (this.glyphRange) this.maxDist += this.glyphRange;
    this.bonus = this.glyphBonus || 0;
    w.ripple(ip);
    if (this.onEmpower) this.onEmpower(this);
    Sound.empower();
  }
  die(at, hitSomething) {
    this.alive = false;
    if (this.onDie) { if (this.ctx && Net.ctx !== this.ctx) Net.run(this.ctx, () => this.onDie(this, at, hitSomething)); else this.onDie(this, at, hitSomething); }
  }
}


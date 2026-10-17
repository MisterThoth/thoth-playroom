// ============================================================================
// ARENA 5v5 (2/3) · units. Every unit (bot god, minion, Sebek siege colossus, jungle guardian) shares the
// playroom dummies' interface (pos, radius, height, hp, alive, statuses, placeAt/shove/slideAlong, mesh, lift),
// so the player's kits hit them through Combat.dummies exactly like dummies; Combat.dummies holds only
// the units the player may hit (enemy team + neutral camps), never allies. Bots fight each other through
// Arena.hurt() with their own simplified kits: projectiles (ArenaShot) and readable telegraphs.
// ============================================================================
const UNIT_TICK = ['root', 'slow', 'stun', 'mez', 'blind', 'markT', 'huntMark', 'drunk', 'gas', 'antiheal'];
let arenaUnitSeq = 0;
const _au1 = new THREE.Vector3(), _au2 = new THREE.Vector3(), _au3 = new THREE.Vector3();

class ArenaUnit {
  constructor(team, kind, o = {}) {
    this.id = ++arenaUnitSeq; this.arena = true; this.team = team; this.kind = kind;
    this.isGod = kind === 'god'; this.isMinion = kind === 'minion'; this.isJungle = kind === 'camp'; this.isMummy = false;
    this.name = o.name || kind; this.radius = o.radius ?? 0.5; this.height = o.height ?? 2; this.maxHp = o.hp ?? 500; this.hp = this.maxHp;
    this.magProt = o.prot ?? 20; this.physProt = o.prot ?? 20; this.speed = o.speed ?? 3.5;
    this.pos = new THREE.Vector3(); this.base = new THREE.Vector3(); this.velocity = new THREE.Vector3(); this.facing = 0;
    this.alive = true; this.lastHit = -99; this.flash = 0; this.lift = 0; this.hitCd = 0; this.respawn = 0; this.dying = 0; this.gone = false;
    this.mesh = new THREE.Group(); scene.add(this.mesh);
    this.dmgBy = new Map(); this.lastAttacker = null; this.lastAttackT = -99;
    this.inReeds = null; this.seen = [true, true, true]; this.shield = 0; this.shieldT = 0; this.heavy = false;
    this.onScreen = true; this.camDist = 0; this.animAcc = 0; this.frameSkip = 0;
    this.haHits = 0; this.haCast = -1;
    this.replica = !Arena.authority;   // (online, not the host: a picture of the host's unit, moved by its snapshots; 14n_net.js)
    this.clearStatus();
  }
  get canAct() { return this.alive && !(this.stun > 0 || this.frozen > 0 || this.mez > 0 || this.carried); }
  get canMove() { return this.canAct && !(this.root > 0) && !this.heavyLock; }
  // displacements from the player's kits (pulls, carries, knock-backs): an arena unit simply is where it is put
  placeAt(p) { if (this.heavy) return; this.pos.x = p.x; this.pos.z = p.z; }
  shove(v) { if (this.heavy) return; this.pos.x += v.x; this.pos.z += v.z; resolveCircle(this.pos, this.radius * 0.8); }
  slideAlong(v) { if (this.heavy) return; this.slideV.set(v.x, 0, v.z); }
  onHit(kind) { this.flash = 1; }
  speedNow() { return this.speed * (this.slow > 0 ? 1 - this.slowAmt : 1) * Arena.speedK * (this.speedBuff ? this.speedBuff() : 1); }
  tickStatus(dt, t) {
    for (const k of UNIT_TICK) this[k] = Math.max(0, this[k] - dt);
    if (this.markT <= 0) this.markAmp = 0;
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) { this.frozen = 0; if (this.ice) { GodFX.thaw(this.ice); this.ice = null; } } }
    this.flash = Math.max(0, this.flash - dt * 5); this.hitCd = Math.max(0, this.hitCd - dt);
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
    if (this.netHoldT > 0) this.netHoldT -= dt;   // (online: held where another player's kit put it)
    if (this.bleeds.length) {   // (bleeds come from the player's kits)
      let dps = 0; for (const b of this.bleeds) { dps += b.dps; b.t -= dt; }
      this.bleeds = this.bleeds.filter((b) => b.t > 0);
      this.dotAcc += dps * dt;
      if (this.dotAcc >= dps * 0.5 && this.dotAcc > 1) { const a = this.dotAcc; this.dotAcc = 0; Combat.deal(this, a, 'dot', 'Bleed', true); }
    }
    if (this.statusFx) this.statusFx.update(dt, t);
  }
  // walk toward a goal: steer around pillars and statues, keep a little room from team-mates, slide on knock-backs
  moveToward(gx, gz, dt, stopDist = 0.25, speedK = 1) {
    const px = this.pos.x, pz = this.pos.z;
    if (this.netHoldT > 0) { this.velocity.set(0, 0, 0); return Math.hypot(gx - px, gz - pz); }   // (online: another player's kit has it)
    let vx = 0, vz = 0;
    const dx = gx - px, dz = gz - pz, d = Math.hypot(dx, dz);
    if (d > stopDist && this.canMove) {
      let ux = dx / d, uz = dz / d;
      for (const c of WORLD.circles) {
        const ox = c.x - px, oz = c.z - pz, look = 3.2 + c.r, along = ox * ux + oz * uz;
        if (along < 0 || along > look) continue;
        const lat = -ox * uz + oz * ux, clear = c.r + this.radius + 0.4;
        if (Math.abs(lat) < clear) { const k = (1 - along / look) * 1.6 * (lat >= 0 ? 1 : -1), nx = ux + uz * k, nz = uz - ux * k; ux = nx; uz = nz; }   // step around it
      }
      const sep = this.separation(); ux += sep.x; uz += sep.z;
      const l = Math.hypot(ux, uz) || 1, sp = Math.min(this.speedNow() * speedK, (d - stopDist * 0.5) / Math.max(dt, 1e-3));
      vx = ux / l * sp; vz = uz / l * sp;
    }
    if (this.slideV.lengthSq() > 1e-4) { vx += this.slideV.x; vz += this.slideV.z; this.slideV.multiplyScalar(Math.exp(-2.4 * dt)); }
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    resolveCircle(this.pos, this.radius * 0.8);
    this.velocity.set((this.pos.x - px) / Math.max(dt, 1e-4), 0, (this.pos.z - pz) / Math.max(dt, 1e-4));
    const v = Math.hypot(this.velocity.x, this.velocity.z);
    if (v > 0.4 && !this.carried && !this.strafeAt) this.facing = dampAngle(this.facing, Math.atan2(this.velocity.x, this.velocity.z), 9, dt);   // (a bot god kiting keeps facing its target: strafes and backpedals)
    return d;
  }
  separation() {
    const s = _au3.set(0, 0, 0);
    for (const u of Arena.units) {
      if (u === this || !u.alive || u.team !== this.team || u.kind === 'siege') continue;
      const dx = this.pos.x - u.pos.x, dz = this.pos.z - u.pos.z, rr = this.radius + u.radius + 0.35, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / rr * 1.2; s.x += dx / d * k; s.z += dz / d * k; }
    }
    return s;
  }
  face(target, dt, k = 10) { this.facing = dampAngle(this.facing, Math.atan2(target.x - this.pos.x, target.z - this.pos.z), k, dt); }
  dist(u) { return Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); }
  dispose() {
    this.gone = true;
    if (this.rig && this.rig.mats) { this.rig.mixer.stopAllAction(); for (const m of this.rig.mats) m.dispose(); }
    if (this.statusFx) { this.statusFx.dispose(); this.statusFx = null; }
    if (this.ice) { GodFX.removeIce(this.ice); this.ice = null; }
    scene.remove(this.mesh);
  }
}
// the playroom dummies' crowd-control machinery: the kits call the same methods on dummies and arena units
for (const k of ['clearStatus', 'applyStun', 'freeze', 'mesmerize', 'blinded', 'rooted', 'slowed', 'marked', 'bleed']) {
  Object.defineProperty(ArenaUnit.prototype, k, Object.getOwnPropertyDescriptor(Dummy.prototype, k));
}
Object.defineProperty(ArenaUnit.prototype, 'cc', { get() { return this.root > 0 || this.stun > 0 || this.frozen > 0 || this.mez > 0 || this.carried; } });
// the heavy units shrug off the fiddly ones
for (const k of ['applyStun', 'freeze', 'mesmerize', 'rooted']) {
  const f = ArenaUnit.prototype[k];
  ArenaUnit.prototype[k] = function (...a) { if (this.heavy && k !== 'applyStun') return; if (this.heavy) a[0] *= 0.3; return f.apply(this, a); };
}

// ---------------------------------------------------------------------------
// The player's stand-in: what bots, minions and the fountain see and hit
// ---------------------------------------------------------------------------
class PlayerUnit {
  constructor() { this.arena = true; this.isPlayer = true; this.team = 0; this.kind = 'god'; this.isGod = true; this.radius = 0.45; this.height = 2.0; this.id = 0; this.dmgBy = new Map(); this.seen = [true, true, true]; this.inReeds = null; this.level = 3; }
  get pos() { return P.pos; }
  get velocity() { return P.vel; }
  get hp() { return P.hp; }
  get maxHp() { return maxHp(); }
  get alive() { return Arena.active && !P.dead; }
  get name() { return Kit ? Kit.name : 'You'; }
  get god() { return Kit ? Kit.id : 'thoth'; }
  get magProt() { return 18 + 1.6 * lvl(); }
  get physProt() { return 18 + 1.6 * lvl(); }
  dist(u) { return Math.hypot(u.pos.x - P.pos.x, u.pos.z - P.pos.z); }
  applyStun(t) { P.stunT = Math.max(P.stunT, t); Arena.ccNote('STUNNED', t); }
  rooted(t) { P.rootT = Math.max(P.rootT, t); Arena.ccNote('ROOTED', t); }
  slowed(amt, t) { P.slowT = Math.max(P.slowT, t); P.slowAmt = Math.max(amt, P.slowT > 0 ? P.slowAmt : 0); }
  blinded(t) { Arena.ccNote('BLINDED', t); }
  freeze(t) { this.applyStun(t); }
}

// ---------------------------------------------------------------------------
// Bot kits: three abilities and an ultimate per god, each a generic shape (shot, leap, dash, aoe, cone, buff,
// beam, storm, gate, cloud, honk) in the god's own palette and with the god's own sounds.
// Balance: the ultimate is the bot's "ability 5" tier - its total damage on one target is at least twice the
// strongest of the three abilities (all hits / ticks counted), and its CC at least matches theirs (Ullr stays 1).
// ---------------------------------------------------------------------------
// Bot basic-attack chains: the player's own (07b_rig.js RigAnimator.gesture / swing): casting gestures for the ranged gods (the
// bolt leaves the hand on the release frame), clip swings for the melee ones (the blow lands on the measured hit frame), the
// bow's draw-and-loose aim layer for Ullr. Damage and attack rate are the bot's own, as before.
const BOT_AUTO = {
  thoth: { gest: ['flick', 'sweep', 'hurl'] },
  skadi: { gest: ['hurl', 'flick', 'hurl'], k: [1, 1, 1.25] },
  hecate: { gest: ['flick', 'flick', 'hurl'], side: ['R', 'L', 'R'] },
  ra: { gest: ['thrust', 'flick', 'hurl'], side: ['R', 'L', 'R'], disc: true },
  bastet: { acts: ['claw1', 'claw2', 'claw3'] },
  bacchus: { acts: ['swing1', 'swing2', 'smash'] },
  ullr: { bow: true },
};
const BOT_KITS = {
  thoth: { pal: 'thoth', ranged: true, range: 11.5, basic: { dmg: 24, anim: 'throw', speed: 30, size: 0.5, glyphs: true, sfx: 'ha_shot1' },
    abil: [
      { name: 'Hieroglyphic Assault', shape: 'shot', cd: 8, range: 17, dmg: 50, count: 3, spread: 0.11, speed: 30, width: 0.55, size: 0.75, anim: 'empower', sfx: 'ha_shot2', glyphs: true },
      { name: 'Evade and Punish', shape: 'dash', cd: 13, range: 9, dist: 6.5, away: true, dur: 0.32, anim: 'dash', sfx: 'ep_dash',
        then: { dmg: 70, count: 1, speed: 36, width: 0.7, size: 1.0, slow: [0.3, 1.5], glyphs: true, sfx: 'ep_shot' } },
      { name: 'Glyph of Pain', shape: 'aoe', cd: 11, range: 15, radius: 3.6, delay: 0.75, dmg: 72, slow: [0.35, 2], anim: 'glyph', sfx: 'gp_cast', fx: 'glyph' },
      { name: 'Final Judgement', shape: 'beam', ult: true, cd: 55, range: 24, width: 2.4, delay: 1.0, dmg: 320, stun: 0.8, anim: 'judgement', sfx: 'fj_fire', fx: 'judgement' },   // (was 185: 2.1 x the 3 x 50 glyph bolts)
    ] },
  skadi: { pal: 'skadi', ranged: true, range: 11, physical: true, basic: { dmg: 26, anim: 'throw', speed: 34, size: 0.45, sfx: 'basic1', hitSfx: 'basic_hit1' },
    abil: [
      { name: 'Piercing Cold', shape: 'shot', cd: 9, range: 20, dmg: 78, count: 1, speed: 40, width: 0.7, size: 0.9, pierce: true, slow: [0.25, 2], anim: 'spear', sfx: 'pc_throw', hitSfx: 'pc_hit', ice: true },
      { name: 'Kaldr’s Leap', shape: 'leap', cd: 13, range: 12, radius: 2.6, dmg: 60, stun: 0.6, anim: 'mark', sfx: 'kaldr_leap' },
      { name: 'Permafrost', shape: 'aoe', cd: 12, range: 14, radius: 3.4, delay: 0.6, dmg: 55, root: 1.0, anim: 'frost', sfx: 'wg_start', hitSfx: 'wg_root', fx: 'frost' },
      { name: 'Frost Storm', shape: 'storm', ult: true, cd: 60, range: 16, radius: 6, delay: 1.0, ticks: 4, tickDt: 0.5, dmg: 52, slow: [0.4, 1.2], finalStun: 1.0, anim: 'storm', sfx: 'th_howl', hitSfx: 'th_avalanche', fx: 'snow' },
    ] },
  bastet: { pal: 'bastet', ranged: false, range: 2.4, physical: true, basic: { dmg: 30, anims: ['claw1', 'claw2'], sfx: 'swipe1', hitSfx: 'claw_hit1' },
    abil: [
      { name: 'Pounce', shape: 'leap', cd: 9, range: 11, radius: 2.4, dmg: 70, anim: 'pounce', sfx: 'pounce', hitSfx: 'pounce_land' },
      { name: 'Cat Claws', shape: 'cone', cd: 7, range: 4.2, angle: 0.9, dmg: 64, bleedK: 0.3, anim: 'claw3', sfx: 'claw_cast', fx: 'claws' },
      { name: 'Hunting Instinct', shape: 'buff', cd: 16, range: 12, dur: 5, speed: 1.3, dmgK: 1.15, anim: 'roar', sfx: 'cat_attack' },
      { name: 'Huntress of Bast', shape: 'storm', ult: true, cd: 55, range: 9, radius: 5, delay: 0.7, ticks: 5, tickDt: 0.25, dmg: 46, slow: [0.3, 1], anim: 'huntress', sfx: 'huntress_cast', hitSfx: 'huntress_hit', fx: 'cats' },
    ] },
  hecate: { pal: 'hecate', ranged: true, range: 11.5, basic: { dmg: 24, anim: 'throw', speed: 28, size: 0.55, sfx: 'bolt1', hitSfx: 'bolt_hit1' },
    abil: [
      { name: 'Dark Bolts', shape: 'shot', cd: 7, range: 16, dmg: 44, count: 3, burst: 0.18, speed: 30, width: 0.55, size: 0.8, anim: 'triple', sfx: 'bolt2' },
      { name: 'Spell Eater', shape: 'aoe', cd: 11, range: 15, radius: 3.4, delay: 0.9, dmg: 82, anim: 'sigil', sfx: 'se_drop', fx: 'hex' },
      { name: 'Shield of Night', shape: 'buff', cd: 15, range: 10, dur: 4, shield: 0.18, anim: 'shield', sfx: 'rm_shield' },
      { name: 'Open the Gates', shape: 'gate', ult: true, cd: 55, range: 16, radius: 5, delay: 1.2, dmg: 280, stun: 1.2, anim: 'gates', sfx: 'gate_open', hitSfx: 'gate_blast' },   // (was 170: 2.1 x the 3 x 44 bolts)
    ] },
  ra: { pal: 'ra', ranged: true, range: 11.5, basic: { dmg: 25, anim: 'throw', speed: 30, size: 0.55, sfx: 'orb1', hitSfx: 'orb_hit1' },
    abil: [
      { name: 'Celestial Beam', shape: 'aoe', cd: 8, range: 16, radius: 2.6, delay: 0.8, dmg: 78, anim: 'beam', sfx: 'cb_strike', fx: 'pillar' },
      { name: 'Divine Light', shape: 'cone', cd: 11, range: 7, angle: 0.75, dmg: 60, blind: 1.5, slow: [0.2, 1.5], anim: 'radiance', sfx: 'dl_burst', fx: 'radiance' },
      { name: 'Solar Blessing', shape: 'buff', cd: 16, range: 10, dur: 6, heal: 0.15, ally: true, dmgK: 1.1, anim: 'bless', sfx: 'sb_cast' },
      { name: 'Searing Pain', shape: 'beam', ult: true, cd: 55, range: 26, width: 2.2, delay: 1.1, dmg: 200, blind: 1.5, slow: [0.2, 1.5], anim: 'sear', sfx: 'sp_fire', fx: 'sunbeam' },   // (CC now matches Divine Light)
    ] },
  bacchus: { pal: 'bacchus', ranged: false, range: 2.6, basic: { dmg: 28, anims: ['swing1', 'swing2'], sfx: 'swing1', hitSfx: 'hit1' },
    abil: [
      { name: 'Chug', shape: 'buff', cd: 14, range: 12, dur: 5, heal: 0.14, dmgK: 1.12, anim: 'chug', sfx: 'chug' },
      { name: 'Belly Flop', shape: 'leap', cd: 11, range: 11, radius: 3.0, dmg: 66, stun: 0.9, anim: 'flop', sfx: 'flop_jump', hitSfx: 'flop_land', flop: true },
      { name: 'Belch of the Gods', shape: 'cone', cd: 9, range: 6.5, angle: 0.8, dmg: 58, slow: [0.3, 2], anim: 'belch', sfx: 'belch_wave', fx: 'belch' },
      { name: 'Deadly Fart', shape: 'cloud', ult: true, cd: 60, range: 5.5, radius: 5.8, delay: 1.2, ticks: 6, tickDt: 0.5, dmg: 34, slow: [0.35, 1], firstStun: 1.0, anim: 'ixraise', sfx: 'df_fart', fx: 'fart' },   // (the blast stuns 1 s: CC now matches the belly flop)
    ] },
  // Ullr «Bowelius»: arrows that mostly miss and do exactly 1 damage, of course (his CC is real)
  ullr: { pal: 'ullr', ranged: true, range: 12, physical: true, basic: { dmg: 1, fixed: 1, miss: 0.7, anim: 'throw', speed: 38, size: 0.45, sfx: 'arrow_release', hitSfx: 'arrow_hit', missSfx: 'arrow_plop' },
    abil: [
      { name: 'Bladed Arrow', shape: 'shot', cd: 7, range: 18, dmg: 1, fixed: 1, miss: 0.75, count: 3, spread: 0.2, speed: 40, width: 0.5, size: 0.6, anim: 'volley', sfx: 'arrow_release', missSfx: 'arrow_plop' },
      { name: 'Glory Bound', shape: 'leap', cd: 13, range: 12, radius: 2.6, dmg: 1, fixed: 1, stun: 0.8, anim: 'leap', sfx: 'leap', hitSfx: 'leap_land', slip: 0.3 },
      { name: 'Thrown Axe', shape: 'shot', cd: 11, range: 15, dmg: 1, fixed: 1, count: 1, speed: 26, width: 0.8, size: 0.9, stun: 1.0, anim: 'axethrow', sfx: 'axe_throw', hitSfx: 'axe_hit' },
      { name: 'Bowelius’ Honk', shape: 'honk', ult: true, cd: 55, range: 6, radius: 6, delay: 0.6, dmg: 1, fixed: 1, stun: 1.4, anim: 'swap', sfx: 'clown_honk', fx: 'clown' },
    ] },
};

// ---------------------------------------------------------------------------
// FX budget: bots and minions get a lighter share than the player (and less still far from the camera)
// ---------------------------------------------------------------------------
function arenaFxK(pos) {
  if (!FX2.ready) return 0;
  const d = camera.position.distanceTo(pos), load = FX2.glow.list.length / FX2.glow.max;
  return clamp(1.25 - d / 55, 0.15, 1) * (load > 0.6 ? 0.35 : load > 0.4 ? 0.65 : 1);
}
const _shotMats = {};
function shotSpriteMat(pal, core = false) {
  const key = pal + (core ? '+' : '');
  if (!_shotMats[key]) { const P2 = FX2.pal(pal); _shotMats[key] = new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: (core ? P2.core : P2.mid).clone().multiplyScalar(core ? 1.2 : 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }); }
  return _shotMats[key];
}

// a bot / minion projectile: a glowing core with a trail in the caster's palette
class ArenaShot {
  constructor(o) {
    Object.assign(this, o);
    this.pos = o.pos.clone(); this.dir = o.dir.clone().setY(0).normalize(); this.traveled = 0; this.hit = new Set(); this.alive = true;
    this.g = new THREE.Group(); this.g.position.copy(this.pos); scene.add(this.g);
    const s1 = new THREE.Sprite(shotSpriteMat(o.pal)); s1.scale.setScalar(o.size || 0.5); this.g.add(s1);
    const s2 = new THREE.Sprite(shotSpriteMat(o.pal, true)); s2.scale.setScalar((o.size || 0.5) * 0.45); this.g.add(s2);
    const P2 = FX2.pal(o.pal);
    this.fxK = arenaFxK(this.pos);
    this.trail = this.fxK > 0.3 ? VFX.trail((o.size || 0.5) * 0.4, P2.mid, 2.2, 10) : null;
  }
  update(dt) {
    const step = this.speed * dt, p0 = _au1.copy(this.pos), p1 = _au2.copy(p0).addScaledVector(this.dir, step);
    const tb = segmentBlocked(p0.x, p0.z, p1.x, p1.z);
    if (tb < 1) p1.lerpVectors(p0, p1, tb);
    for (const u of Arena.foesOf(this.team)) {
      if (!u.alive || this.hit.has(u)) continue;
      const r = u.radius + this.width * 0.5, ax = p1.x - p0.x, az = p1.z - p0.z, len2 = ax * ax + az * az || 1e-6;
      const tt = clamp(((u.pos.x - p0.x) * ax + (u.pos.z - p0.z) * az) / len2, 0, 1), cx = p0.x + ax * tt, cz = p0.z + az * tt;
      if ((cx - u.pos.x) ** 2 + (cz - u.pos.z) ** 2 <= r * r) {
        this.hit.add(u);
        this.onHit(u, _au3.set(cx, this.pos.y, cz).clone());
        if (!this.pierce) { this.die(true); return false; }
      }
    }
    this.traveled += p0.distanceTo(p1); this.pos.copy(p1); this.g.position.copy(p1);
    if (this.trail) this.trail.push(this.pos);
    if (this.fxK > 0.45 && Math.random() < 0.5) FX2.trailTick(this.pos, null, this.pal, dt, { k: 0.35 * this.fxK, size: this.size || 0.5, smoke: false });
    if (this.glyphs && Math.random() < dt * 10 * this.fxK) VFX.glyphs.spawn({ pos: this.pos.clone(), vel: V3(rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3)), life: 0.5, size: 0.16, sizeEnd: 0.04, color: COL.glyph, intensity: 2, cell: VFX.glyphCell(), rot: 0 });
    if (tb < 1 || this.traveled >= this.range) { this.die(false); return false; }
    return true;
  }
  die(hitSomething) {
    this.alive = false;
    if (this.trail) this.trail.alive = false;
    scene.remove(this.g);
    if (!hitSomething && this.onMiss) this.onMiss(this.pos.clone());
  }
}

// a telegraph on the floor: a ring in the caster's team colour (red = danger to you) that fills with the god's colour
const TELE_FS = /* glsl */`
  uniform vec3 uRim, uFill; uniform float uK, uA, uTime, uLine; varying vec2 vUv;
  void main() {
    float a;
    if (uLine > 0.5) {
      float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;
      float edge = smoothstep(0.86, 0.95, x) * (1.0 - smoothstep(0.97, 1.0, x)) + smoothstep(0.985, 1.0, y) + (1.0 - smoothstep(0.0, 0.015, y));
      float fill = y < uK ? 0.22 : 0.05;
      float front = smoothstep(0.03, 0.0, abs(y - uK)) * 0.8;
      vec3 c = uRim * edge * 1.3 + uFill * (fill + front);
      a = clamp(edge * 0.9 + fill + front, 0.0, 1.0) * uA;
      gl_FragColor = vec4(c * uA, a);
      return;
    }
    float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
    float edge = smoothstep(0.88, 0.95, r) * (1.0 - smoothstep(0.975, 1.0, r));
    float fill = r < uK ? 0.2 : 0.04;
    float front = smoothstep(0.035, 0.0, abs(r - uK)) * 0.9;
    vec3 c = uRim * edge * 1.4 + uFill * (fill + front);
    a = clamp(edge + fill + front, 0.0, 1.0) * uA;
    gl_FragColor = vec4(c * uA, a);
  }`;
function arenaTelegraph(at, o) {
  const line = !!o.length;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uRim: { value: (o.team === Arena.myTeam ? new THREE.Color(0.2, 0.55, 1.0) : new THREE.Color(1.0, 0.16, 0.08)).multiplyScalar(1.2) }, uFill: { value: FX2.pal(o.pal).mid.clone() },
      uK: { value: 0 }, uA: { value: 0 }, uTime: { value: 0 }, uLine: { value: line ? 1 : 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: TELE_FS });
  const geo = line ? new THREE.PlaneGeometry(o.width, o.length).translate(0, o.length / 2, 0) : new THREE.PlaneGeometry(o.radius * 2, o.radius * 2);
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(at.x, 0.06, at.z); m.renderOrder = 6;
  if (line) { m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(-o.dir.x, -o.dir.z); m.rotation.x = -Math.PI / 2; }   // (the plane's +y, its length, then runs along dir)
  scene.add(m);
  const h = { dead: false, m };
  FX2.add({ update(dt) { const k = Math.min(1, this.t / o.delay); mat.uniforms.uK.value = k; mat.uniforms.uA.value = h.dead ? Math.max(0, mat.uniforms.uA.value - dt * 6) : Math.min(1, this.t * 6); if (o.follow) m.position.set(o.follow.x, 0.06, o.follow.z); if (this.t > o.delay + 0.05) h.dead = true; return !(h.dead && mat.uniforms.uA.value <= 0); },
    dispose() { scene.remove(m); geo.dispose(); mat.dispose(); } });
  return h;
}

// a ring of the team's colour under every unit (one instanced draw for all of them)
const UnitRings = {
  im: null, max: 96, n: 0,
  init() {
    const tex = (() => { const c = cnv(128), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.82, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return toTex(c); })();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffffff });
    this.im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, this.max);
    this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.im.count = 0; this.im.frustumCulled = false; this.im.renderOrder = 4;
    for (let i = 0; i < this.max; i++) this.im.setColorAt(i, new THREE.Color(1, 1, 1));
    scene.add(this.im);
  },
  update(units) {
    if (!this.im) this.init();
    const m4 = _m1, c = new THREE.Color(); let n = 0;
    const q = _q1.identity();
    for (const u of units) {
      if (!u.alive || !u.mesh.visible || n >= this.max) continue;
      const s = u.radius * (u.isGod ? 3.2 : 2.6);
      m4.compose(_au1.set(u.pos.x, 0.05, u.pos.z), q, _au2.set(s, 1, s)); this.im.setMatrixAt(n, m4);
      this.im.setColorAt(n, c.copy(u.team === 2 ? BUFFS[u.camp?.buff || 'sekhmet'].col : TEAMS[u.team].col).multiplyScalar(u.isGod ? 1.2 : 0.5)); n++;   // (realism pass: minion rings dimmer)
    }
    this.im.count = n; this.im.instanceMatrix.needsUpdate = true; if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true;
  },
  dispose() { if (this.im) { scene.remove(this.im); this.im.geometry.dispose(); this.im.material.dispose(); this.im = null; } },
};

// ---------------------------------------------------------------------------
// Bot gods: the god's real rigged model (a clone with its own skeleton and animator), a simplified kit and a
// small state machine: push with the minions, fight the nearest enemy (gods first), kite, cast on cooldown,
// retreat to the fountain below 25 % health, group at their own siege beast, visit buff camps now and then
// ---------------------------------------------------------------------------
class BotGod extends ArenaUnit {
  constructor(godId, team, slot) {
    const kit = GODS[godId];
    super(team, 'god', { name: kit.name, radius: 0.5, height: 2.1, hp: 500, speed: kit.stats.speed * 0.0145 });
    this.god = godId; this.kitRef = kit; this.bk = BOT_KITS[godId] || BOT_KITS.thoth; this.slot = slot;
    this.level = 3; this.xp = 0; this.k = 0; this.d = 0; this.a = 0; this.dmgDone = 0; this.spree = 0; this.multi = 0; this.multiT = -99;
    this.rig = cloneGodRig(Assets.glb[godId], godId);
    this.rig.root.rotation.order = 'YXZ';
    this.anim = new RigAnimator(this.rig, null); this.anim.fxK = 0.3;
    this.mesh.add(this.rig.root);
    if (this.rig.props) for (const [key, p] of Object.entries(this.rig.props)) p.visible = key === 'bow';   // Ullr: bow out
    this.cd = [rand(0, 3), rand(1, 4), rand(1, 5), rand(8, 20)]; this.atkCd = 0; this.castLock = 0; this.atkI = 0;
    this.state = 'push'; this.target = null; this.thinkT = rand(0, 0.3); this.react = 0; this.seed = rand(0, 100);
    this.buffs = {}; this.motion = null; this.jungleCamp = null; this.respawnHalf = false;
    this.applyLevel(true);
  }
  applyLevel(full = false) {
    const st = this.kitRef.stats, L = this.level, old = this.maxHp;
    this.maxHp = Math.round(st.hp[0] + st.hp[1] * (L - 1));
    this.magProt = this.physProt = 18 + 1.6 * L;
    this.power = 1 + 0.09 * (L - 1);
    if (full) this.hp = this.maxHp; else this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - old));
  }
  dmgMul() { let m = 1; if (this.buffs.sekhmet > 0) m *= 1.2; if (this.buffs.scarabDmg > 0) m *= 1.25; if (this.buffs.ability > 0 && this.abBuff) m *= this.abBuff.dmgK || 1; return m; }
  speedBuff() { let m = 1; if (this.buffs.horus > 0) m *= 1.15; if (this.buffs.scarabSpeed > 0) m *= 1.3; if (this.buffs.ability > 0 && this.abBuff) m *= this.abBuff.speed || 1; return m; }
  onHit(kind) { this.flash = 1; }
  // ---- the brain (a few times a second)
  think() {
    const A = Arena, hpK = this.hp / this.maxHp;
    if (this.recall) return;   // channelling a recall (11y_recall.js): stand still until home or interrupted
    if (this.state === 'retreat') { if (hpK > 0.9) this.state = 'push'; else { this.target = null; Recall.botConsider(this); return; } }
    if (hpK < 0.25 && !A.inOwnBase(this.pos, this.team)) { this.state = 'retreat'; this.target = null; this.jungleCamp = null; Recall.botConsider(this); return; }
    const prev = this.target;
    this.target = this.pickTarget();
    if (this.target && this.target !== prev) this.react = rand(0.2, 0.5);
    if (this.target) { this.state = 'fight'; return; }
    // scarabs close by are worth a detour
    const sc = A.scarabs.find((s) => s.alive && s.pos.distanceTo(this.pos) < 14);
    if (sc) { this.state = 'scarab'; this.goalUnit = sc; return; }
    if (A.scales.active && this.slot % 5 !== 4 && hpK > 0.45) { this.state = 'scales'; return; }
    if (this.jungleCamp && !this.jungleCamp.alive) this.jungleCamp = null;
    if (!this.jungleCamp && hpK > 0.6 && Math.random() < 0.035) {
      const own = ArenaMap.camps.filter((c) => c.team === this.team && c.alive && !A.bots.some((b) => b !== this && b.jungleCamp === c));
      if (own.length) this.jungleCamp = pick(own);
    }
    if (this.jungleCamp) { this.state = 'jungle'; return; }
    const siege = A.siege[this.team];
    this.state = siege && siege.alive ? 'group' : 'push';
  }
  pickTarget() {
    const A = Arena; let best = null, bs = 1e9;
    const aggro = this.state === 'jungle' ? 18 : 15;
    for (const u of A.foesOf(this.team)) {
      if (!u.alive || !A.visibleTo(u, this.team)) continue;
      if (u.team === 2 && !(this.jungleCamp && u.camp === this.jungleCamp) && u.lastAttacker !== this) continue;
      if (A.inEnemyBase(u.pos, this.team) && !(u.isPlayer || u.isGod) ) continue;
      if (A.inFountainZone(u.pos, 1 - this.team)) continue;   // never dive the enemy fountain
      const d = this.dist(u); if (d > aggro) continue;
      let s = d + (u.isGod ? -7 + (u.hp / u.maxHp) * 4 : u.kind === 'siege' ? 3 : 0);
      if (u === this.lastAttacker && Combat.time - this.lastAttackT < 3) s -= 6;
      if (s < bs) { bs = s; best = u; }
    }
    return best;
  }
  // ---- every frame
  update(dt, t) {
    if (this.replica) return this.replicaUpdate(dt, t);
    this.tickStatus(dt, t);
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] -= dt;
    if (!this.alive) { this.updateDead(dt, t); return; }
    for (let i = 0; i < 4; i++) this.cd[i] = Math.max(0, this.cd[i] - dt * (this.buffs.isis > 0 ? 1.25 : 1));
    this.atkCd = Math.max(0, this.atkCd - dt); this.castLock = Math.max(0, this.castLock - dt); this.react = Math.max(0, this.react - dt);
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.3 + Math.random() * 0.1; this.think(); }
    if (this.recall) Recall.botTick(this, dt);   // (recall channel: stands still; 11y_recall.js)
    else if (this.motion) this.updateMotion(dt);
    else if (this.canAct) this.act(dt, t);
    else this.velocity.set(0, 0, 0);
    // fountain heal is the arena's; out-of-combat regen here
    if (Combat.time - this.lastHit > 6) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.012 * dt);
    this.pose(dt, t);
  }
  act(dt, t) {
    const A = Arena, tg = this.target, side = TEAMS[this.team].side, dir = -side;
    let gx = this.pos.x, gz = this.pos.z, stop = 0.4;
    this.strafeAt = null;
    if (this.state === 'fight' && tg && tg.alive) {
      const d = this.dist(tg), bk = this.bk, reach = bk.range + tg.radius;
      // in a fight a god keeps its eyes on the target, SMITE-style: kiting reads as a strafe or a backpedal
      // (RigAnimator takes the velocity relative to the facing), closing in from afar is a plain run
      if (d < reach * 1.4) this.strafeAt = tg;
      this.tryCast(tg, d);
      if (this.castLock > 0) { this.face(tg.pos, dt); this.velocity.set(0, 0, 0); return; }
      if (bk.ranged) {
        if (d > reach * 0.92) { gx = tg.pos.x; gz = tg.pos.z; stop = reach * 0.85; }
        else {
          // kite a little: back off from anything that closes in, strafe while attacking
          const awayK = d < reach * 0.5 ? 1 : 0, sx = Math.sin(t * 1.3 + this.seed);
          const ux = (this.pos.x - tg.pos.x) / Math.max(d, 0.01), uz = (this.pos.z - tg.pos.z) / Math.max(d, 0.01);
          gx = this.pos.x + ux * 3 * awayK - uz * sx * 2.2; gz = this.pos.z + uz * 3 * awayK + ux * sx * 2.2; stop = 0.3;
        }
      } else { gx = tg.pos.x; gz = tg.pos.z; stop = this.radius + tg.radius + 0.5; }
      if (this.atkCd <= 0 && d <= reach + 0.3 && this.react <= 0) this.basicAttack(tg);
    } else if (this.state === 'retreat') { const f = ArenaMap.fountains[this.team].pos; gx = f.x; gz = f.z + (this.slot - 2) * 1.2; stop = 1.5; }
    else if (this.state === 'jungle' && this.jungleCamp) { gx = this.jungleCamp.x; gz = this.jungleCamp.z; stop = 3; }
    else if (this.state === 'scarab' && this.goalUnit && this.goalUnit.alive) { gx = this.goalUnit.pos.x; gz = this.goalUnit.pos.z; stop = 0.2; }
    else if (this.state === 'scales') { const a = this.slot * 1.4 + this.team * 0.7; gx = Math.cos(a) * 4 - dir * 1.5; gz = Math.sin(a) * 4; stop = 1; }
    else if (this.state === 'group' && A.siege[this.team] && A.siege[this.team].alive) { const s = A.siege[this.team]; gx = s.pos.x - dir * 4.5; gz = s.pos.z + (this.slot - 2) * 2.2; stop = 1.2; }
    else { const f = A.frontline(this.team); gx = f.x - dir * 3.5; gz = clamp(f.z + (this.slot - 2) * 2.6, -AM.laneHalf + 1, AM.laneHalf - 1); stop = 1.2; }
    // stay out of the enemy base (and its fountain)
    if (dir * gx > AM.gateX - 2.5 && !(this.state === 'fight' && tg && (tg.isGod || tg.isPlayer))) gx = dir * (AM.gateX - 2.5);
    const r = A.route(this.pos, _au1.set(gx, 0, gz));
    this.moveToward(r.x, r.z, dt, r.via ? 0.6 : stop);
    if (this.strafeAt) this.face(tg.pos, dt, 8);
    else if (this.state === 'fight' && tg && this.velocity.lengthSq() < 0.5) this.face(tg.pos, dt);
  }
  basicAttack(tg) {
    const b = this.bk.basic, as = 1.0 * (1 + 0.012 * (this.level - 1)) * (this.buffs.horus > 0 ? 1.25 : 1);
    this.atkCd = 1 / as; this.castLock = Math.max(this.castLock, this.bk.ranged ? 0.3 : 0.25);
    // the chain step comes from atkI (online the host sends it with the attack, so a replica plays the same swing)
    const A = this.anim, ch = BOT_AUTO[this.god], step = this.atkI++ % 3;
    let hitT = 0.22, side = 'R';
    if (ch && ch.acts && A.swing) { const sw = A.swing(ch.acts[step], this.atkCd); if (sw) hitT = sw.hit; }
    else if (ch && ch.gest && A.gesture) { side = ch.side ? ch.side[step] : 'R'; hitT = A.gesture(ch.gest[step], side, this.atkCd, { k: ch.k ? ch.k[step] : 1, noFx: (this.anim.fxK ?? 1) < 0.6 }); }
    else if (ch && ch.bow) this.botDraw(hitT);
    else A.play(b.anims ? b.anims[step % b.anims.length] : b.anim, { noFx: true });
    Sound.bot(this.god, b.sfx, { pos: this.pos, gain: 0.4, delay: Math.max(0, hitT - (this.bk.ranged ? 0.05 : 0.15)) });
    const dmg = b.fixed ?? b.dmg * this.power;
    if (this.bk.ranged) {
      VFX.later(hitT, () => {
        if (!this.alive || !tg.alive) return;
        BotCast.shot(this, { ...b, count: 1, range: this.bk.range + 3, width: 0.5, dmg: b.dmg, fixed: b.fixed, basic: true, from: this.castFrom(ch, side) }, tg);
      });
    } else {
      VFX.later(hitT, () => {
        if (!this.alive || !tg.alive || this.dist(tg) > this.bk.range + tg.radius + 0.8) return;
        Arena.hurt(tg, dmg, this, { physical: this.bk.physical, basic: true });
        Sound.bot(this.god, b.hitSfx, { pos: tg.pos, gain: 0.35 });
        const k = arenaFxK(this.pos);
        if (k > 0.3) FX2.slash(this.pos.clone().setY(1.2), this.facing, this.bk.pal, { r0: 0.4, r1: 1.6, dur: 0.22, int: 1.2, tilt: rand(-0.4, 0.4) });
      });
    }
  }
  // where a basic attack's shot leaves the bot: the casting hand (Ra's staff disc, Ullr's bow) on the release frame
  castFrom(ch, side) {
    if (!ch) return null;
    const R = this.rig, o = new THREE.Vector3();
    if (ch.bow) { const bw = R.props && R.props.bow; if (!bw) return null; bw.localToWorld(o.set(0, 0, 0.05)); }
    else if (ch.disc && side === 'R' && R.prop && R.prop.userData.disc) R.prop.userData.disc.getWorldPosition(o);
    else if (this.anim.castPoint) this.anim.castPoint(side, o);
    else return null;
    o.y = clamp(o.y, this.lift + 1.0, this.lift + 2.0);
    return o;
  }
  // Ullr's bow: the player's draw-and-loose aim layer (11h_ullr.js UL_AIM), driven from pose()
  botDraw(rel) {
    const A = this.anim, AL = A.aim || (A.aim = { clip: UL_AIM.clip, time: UL_AIM.nock, on: false, w: 0, yaw: UL_AIM.yaw, yawK: 1, full: UL_AIM.full, kin: 12, kout: 5 });
    this.draw = { t: 0, rel, t0: AL.on && AL.w > 0.5 ? UL_AIM.drawn : UL_AIM.nock };
    AL.on = true; this.aimHold = rel + UL_AIM.hold;
  }
  tryCast(tg, d) {
    if (this.castLock > 0 || this.react > 0) return;
    const ab = this.bk.abil, A = Arena;
    const godTarget = tg.isGod || tg.isPlayer, hpK = this.hp / this.maxHp, tK = tg.hp / tg.maxHp;
    for (const i of [3, 0, 2, 1]) {
      if (this.cd[i] > 0) continue;
      const a = ab[i];
      if (a.ult) {
        if (!(godTarget || tg.kind === 'siege')) continue;
        const crowd = A.foesNear(tg.pos, a.radius || 4, this.team).length;
        if (!(tK < 0.7 || crowd >= 2 || tg.kind === 'siege')) continue;
      }
      if (a.shape === 'buff') { if (!(hpK < 0.75 || d < a.range)) continue; }
      else if (a.shape === 'dash') { if (!(d < 6 || hpK < 0.5)) continue; }
      else if (a.shape === 'cloud' || a.shape === 'honk') { if (d > a.range) continue; }
      else if (d > a.range + tg.radius) continue;
      if (!godTarget && !a.ult && Math.random() < 0.45) continue;   // (abilities are mostly saved for gods)
      this.cd[i] = a.cd * (1 - Math.min(0.2, (this.level - 3) * 0.012));
      BotCast.cast(this, a, tg);
      return;
    }
  }
  // leaps and dashes move the god themselves
  updateMotion(dt) {
    const M = this.motion; M.t += dt;
    const k = Math.min(1, M.t / M.dur);
    this.pos.lerpVectors(M.from, M.to, M.leap ? easeInOut(k) : easeOutCubic(k));
    resolveCircle(this.pos, this.radius * 0.8);
    this.lift = M.leap ? Math.sin(k * Math.PI) * M.h : 0;
    this.velocity.copy(M.to).sub(M.from).divideScalar(M.dur);
    if (M.flop) this.rig.root.rotation.x = Math.sin(k * Math.PI) * 1.1;
    if (k >= 1) { this.lift = 0; this.rig.root.rotation.x = 0; this.motion = null; if (M.done) M.done(); }
  }
  updateDead(dt, t) {
    if (this.dying > 0) {
      this.dying -= dt;
      const k = 1 - this.dying / 1.6;
      this.rig.root.rotation.x = -easeInCubic(Math.min(1, k * 1.6)) * 1.45;
      this.mesh.position.y = -smoothstep(0.6, 1, k) * 0.9;
      this.anim.update(dt * 0.5, { vel: _au1.set(0, 0, 0), runSpeed: 5, airborne: false, vy: 0 });
      if (this.dying <= 0) { this.mesh.visible = false; FX2.burst(this.pos.clone().setY(0.6), this.bk.pal, { size: 0.8, sparks: 10, embers: 6, puffs: 3, bursts: 1, light: false, distort: false }); }
      return;
    }
    this.respawn -= dt;
    if (this.respawn <= 0) Arena.respawnBot(this);
  }
  // pose the model: position, facing, animation (lighter far from the camera)
  pose(dt, t) {
    const AL = this.anim.aim;
    if (AL) {   // (Ullr's bow: draw, loose, a little follow-through, redraw; then the aim eases out)
      const D = this.draw;
      if (D) {
        D.t += dt; const r = D.t - D.rel;
        AL.time = r < 0 ? lerp(D.t0, UL_AIM.drawn, smoothstep(0, D.rel, D.t)) : r < 0.1 ? lerp(UL_AIM.drawn, UL_AIM.follow, r / 0.1) : lerp(UL_AIM.follow, UL_AIM.drawn, smoothstep(0.1, 0.42, r));
        if (r > 0.42) this.draw = null;
      }
      this.aimHold = (this.aimHold || 0) - dt;
      if (this.aimHold <= 0 || !this.alive) AL.on = false;
    }
    this.mesh.position.set(this.pos.x, this.lift, this.pos.z);
    this.rig.root.rotation.y = this.facing;
    this.animAcc += dt;
    const skip = !this.onScreen ? 4 : this.camDist > 60 ? 3 : this.camDist > 32 ? 2 : 1;
    if (++this.frameSkip >= skip) {
      this.frameSkip = 0;
      const sp = this.speedNow();
      this.anim.update(this.animAcc, { vel: this.velocity, runSpeed: sp, airborne: this.lift > 0.3, vy: this.motion ? (this.motion.t < this.motion.dur / 2 ? 4 : -4) : 0, aimPitch: 0, eyeBoost: this.buffs.ability > 0 ? 0.6 : 0 });
      this.animAcc = 0;
    }
    const m = this.rig.material; if (m && m.userData.flash) m.userData.flash.value.setRGB(this.flash * 0.5, this.flash * 0.25, this.flash * 0.15);
  }
  dispose() { super.dispose(); this.rig.root.traverse((o) => { if (o.isMesh && o.material && o.material !== this.rig.material && o.material.dispose) o.material.dispose(); }); if (this.rig.material) this.rig.material.dispose(); }
}

// ---------------------------------------------------------------------------
// the bots' simplified abilities (shapes)
// ---------------------------------------------------------------------------
const BotCast = {
  cast(b, a, tg) {
    if (b.anim.aim) { b.anim.aim.on = false; b.draw = null; }   // (an ability lowers Ullr's drawn bow)
    b.anim.play(a.anim === 'dash' ? 'dash' : a.anim, a.anim === 'dash' ? { dur: a.dur || 0.3, dx: 0, dz: -1 } : {});
    if (a.sfx) Sound.bot(b.god, a.sfx, { pos: b.pos, gain: a.ult ? 0.85 : 0.6, big: a.ult });
    const fn = this[a.shape]; if (fn) fn.call(this, b, a, tg);
  },
  dmg(b, a) { return a.fixed ?? a.dmg * b.power; },
  // statuses on hit
  afflict(b, a, u) {
    if (b.replica) return;   // (online: a replica's cast is only a picture; the host's bot does the work)
    if (a.slow) u.slowed(a.slow[0], a.slow[1]);
    if (a.stun) u.applyStun(a.stun);
    if (a.root) u.rooted(a.root);
    if (a.blind && u.blinded) u.blinded(a.blind);
  },
  hitAll(b, a, c, R, extra = {}) {
    const list = Arena.foesNear(c, R, b.team);
    for (const u of list) { Arena.hurt(u, extra.dmg ?? this.dmg(b, a), b, { physical: b.bk.physical, ult: a.ult }); this.afflict(b, a, u); }
    return list;
  },
  lead(b, tg, speed) {
    const d = b.dist(tg), tt = d / Math.max(speed, 1) * 0.6;
    return _au2.set(tg.pos.x + tg.velocity.x * tt, 0, tg.pos.z + tg.velocity.z * tt);
  },
  // ---- shapes
  shot(b, a, tg) {
    const n = a.count || 1, speed = a.speed || 30, aim = this.lead(b, tg, speed).clone(), rnd = b.castRng || Math.random;   // (online: the cast's seeded rolls)
    const fire = (i) => {
      if (!b.alive) return;
      const o = a.from ? a.from.clone() : b.pos.clone().setY(1.35 + b.lift), dir = aim.clone().sub(o).setY(0).normalize();   // (a.from: a basic attack leaves the hand)
      const off = n > 1 && a.spread ? (i - (n - 1) / 2) * a.spread : 0;
      let ang = Math.atan2(dir.x, dir.z) + off;
      const miss = a.miss && rnd() < a.miss;
      if (miss) ang += (rnd() < 0.5 ? -1 : 1) * (0.22 + rnd() * 0.28);
      dir.set(Math.sin(ang), 0, Math.cos(ang));
      if (!a.from) o.addScaledVector(dir, 0.6);
      const s = new ArenaShot({ pos: o, dir, speed, range: a.range || 16, width: a.width || 0.5, size: a.size || 0.5, pal: b.bk.pal, team: b.team, pierce: a.pierce, glyphs: a.glyphs,
        onHit: (u, at) => {
          Arena.hurt(u, this.dmg(b, a), b, { physical: b.bk.physical, basic: a.basic });
          this.afflict(b, a, u);
          if (a.hitSfx || b.bk.basic.hitSfx) Sound.bot(b.god, a.hitSfx || b.bk.basic.hitSfx, { pos: at, gain: 0.4 });
          const k = arenaFxK(at);
          if (k > 0.25) FX2.burst(at, b.bk.pal, { size: (a.basic ? 0.35 : 0.55) * (a.ult ? 1.5 : 1), sparks: Math.round(10 * k), embers: Math.round(4 * k), puffs: k > 0.6 ? 1 : 0, bursts: 1, light: false, distort: false });
          if (a.ice && k > 0.3) GodFX.shards(at, 4, 0.6);
        },
        onMiss: (at) => { if (a.missSfx || (a.miss && b.bk.basic.missSfx)) Sound.bot(b.god, a.missSfx || b.bk.basic.missSfx, { pos: at, gain: 0.3 }); } });
      Arena.shots.push(s);
      if (i > 0 && a.sfx) Sound.bot(b.god, a.sfx, { pos: b.pos, gain: 0.4 });
    };
    for (let i = 0; i < n; i++) { if (a.burst && i > 0) VFX.later(a.burst * i, () => fire(i)); else fire(i); }
    b.castLock = Math.max(b.castLock, a.basic ? 0.25 : 0.45 + (a.burst ? a.burst * n : 0));
    b.face(tg.pos, 1, 100);
  },
  dash(b, a, tg) {
    const away = _au1.set(b.pos.x - tg.pos.x, 0, b.pos.z - tg.pos.z).normalize();
    const side = _au2.set(-away.z, 0, away.x).multiplyScalar((b.castRng || Math.random)() < 0.5 ? 0.6 : -0.6);
    const to = b.pos.clone().addScaledVector(away.add(side).normalize(), a.dist || 6); resolveCircle(to, b.radius);
    b.motion = { t: 0, dur: a.dur || 0.3, from: b.pos.clone(), to, h: 0, done: () => { if (a.then && tg.alive) this.shot(b, { ...a.then, range: 16, shape: 'shot' }, tg); } };
    const k = arenaFxK(b.pos);
    if (k > 0.3) FX2.burst(b.pos.clone().setY(1), b.bk.pal, { size: 0.5, sparks: Math.round(12 * k), embers: 4, puffs: 1, bursts: 1, light: false, distort: false });
  },
  leap(b, a, tg) {
    const to = this.lead(b, tg, 14).clone(), d = Math.hypot(to.x - b.pos.x, to.z - b.pos.z);
    if (d > a.range) to.sub(b.pos).multiplyScalar(a.range / d).add(b.pos);
    to.setY(0); resolveCircle(to, b.radius);
    const tele = arenaTelegraph(to, { radius: a.radius, delay: 0.55, team: b.team, pal: b.bk.pal });
    void tele;
    b.facing = Math.atan2(to.x - b.pos.x, to.z - b.pos.z);
    b.motion = { t: 0, dur: 0.55, from: b.pos.clone(), to, h: a.flop ? 2.6 : 2.0, leap: true, flop: !!a.flop, done: () => {
      if (!b.alive) return;
      this.hitAll(b, a, b.pos, a.radius);
      if (a.hitSfx) Sound.bot(b.god, a.hitSfx, { pos: b.pos, gain: 0.6 });
      const k = arenaFxK(b.pos);
      FX2.impact(b.pos, b.bk.pal, { size: 0.55 + 0.4 * k, sparks: Math.round(18 * k), debris: Math.round(6 * k), scorchDur: 2 });
      Cam.shake = Math.max(Cam.shake, 0.15 * k);
      if (a.slip && !b.replica && Math.random() < a.slip) { b.applyStun(0.9); Sound.bot(b.god, 'bonk', { pos: b.pos, gain: 0.5 }); Arena.floatText(b, 'OUCH!', '#9fffc8'); }   // Bowelius lands on his face
    } };
    b.castLock = 0.6;
  },
  aoe(b, a, tg) {
    const at = this.lead(b, tg, 12).clone().setY(0);
    const d = Math.hypot(at.x - b.pos.x, at.z - b.pos.z); if (d > a.range) at.sub(b.pos).multiplyScalar(a.range / d).add(b.pos).setY(0);
    arenaTelegraph(at, { radius: a.radius, delay: a.delay, team: b.team, pal: b.bk.pal });
    b.castLock = Math.min(0.6, a.delay); b.face(at, 1, 100);
    VFX.later(a.delay, () => {
      if (!Arena.active) return;
      this.hitAll(b, a, at, a.radius);
      if (a.hitSfx) Sound.bot(b.god, a.hitSfx, { pos: at, gain: 0.55 });
      this.groundFx(b, a, at, a.radius);
    });
  },
  cone(b, a, tg) {
    b.castLock = 0.45; b.face(tg.pos, 1, 100);
    const f = fwdOf(Math.atan2(tg.pos.x - b.pos.x, tg.pos.z - b.pos.z));
    VFX.later(0.22, () => {
      if (!b.alive) return;
      for (const u of Arena.foesNear(b.pos, a.range, b.team)) {
        const dx = u.pos.x - b.pos.x, dz = u.pos.z - b.pos.z, dd = Math.hypot(dx, dz) || 1;
        if ((dx * f.x + dz * f.z) / dd < Math.cos(a.angle) && dd > u.radius + 0.8) continue;
        Arena.hurt(u, this.dmg(b, a), b, { physical: b.bk.physical }); this.afflict(b, a, u);
      }
      const k = arenaFxK(b.pos), o = b.pos.clone().setY(1.2), yaw = Math.atan2(f.x, f.z);
      if (a.fx === 'claws') for (let i = 0; i < 3; i++) FX2.slash(o.clone().addScaledVector(f, 0.6), yaw, 'bastet', { r0: 0.5, r1: a.range * 0.8, dur: 0.24 + i * 0.05, int: 1.5, tilt: (i - 1) * 0.5, a0: -a.angle, a1: a.angle });
      else if (a.fx === 'belch') { FX2.spray(o.clone().addScaledVector(f, 0.5), f, 'wine', { dur: 0.45, cone: a.angle * 0.6, speed: 12, rate: 120 * k, smokeRate: 24 * k }); }
      else if (a.fx === 'radiance') { FX2.burst(o, 'ra', { size: 1.0, sparks: Math.round(20 * k), embers: 8, puffs: 1, bursts: 1, light: true, distort: k > 0.5 }); FX2.ring(b.pos, 'ra', { radius: a.range, dur: 0.45 }); }
    });
  },
  buff(b, a) {
    b.castLock = 0.4;
    b.abBuff = a; b.buffs.ability = a.dur;
    if (a.heal) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * a.heal);
    if (a.shield) { b.shield = b.maxHp * a.shield; b.shieldT = a.dur; }
    if (a.ally && !b.replica) for (const u of Arena.alliesNear(b.pos, 8, b.team)) { if (u === b) continue; if (u.isPlayer) { P.hp = Math.min(maxHp(), P.hp + maxHp() * a.heal * 0.6); } else u.hp = Math.min(u.maxHp, u.hp + u.maxHp * a.heal * 0.6); }
    const k = arenaFxK(b.pos);
    if (k > 0.2) { const h = FX2.aura(b.pos, b.bk.pal, { radius: 0.8, height: 2, rate: 10 * k, dur: a.dur }); void h; FX2.ring(b.pos, b.bk.pal, { radius: 2.2, dur: 0.5 }); }
    if (a.shield && k > 0.2) { const bb = GodFX.bubble(b.pos, 1.3, FX2.pal(b.bk.pal).mid, {}); VFX.later(a.dur, () => { bb.dead = true; }); }
  },
  beam(b, a, tg) {
    const o = b.pos.clone(), dir = _au1.set(tg.pos.x - o.x, 0, tg.pos.z - o.z).normalize().clone();
    let L = a.range; const blk = segmentBlocked(o.x, o.z, o.x + dir.x * L, o.z + dir.z * L); if (blk < 1) L *= blk;
    arenaTelegraph(o, { length: L, width: a.width, dir, delay: a.delay, team: b.team, pal: b.bk.pal });
    b.castLock = a.delay + 0.35; b.facing = Math.atan2(dir.x, dir.z);
    b.anim.channelTarget = 0.6;
    VFX.later(a.delay, () => {
      b.anim.channelTarget = 0;
      if (!b.alive || !Arena.active) return;
      for (const u of Arena.foesOf(b.team)) {
        if (!u.alive) continue;
        const rx = u.pos.x - o.x, rz = u.pos.z - o.z, along = rx * dir.x + rz * dir.z;
        if (along < 0 || along > L) continue;
        if (Math.abs(rx * dir.z - rz * dir.x) > a.width / 2 + u.radius) continue;
        Arena.hurt(u, this.dmg(b, a), b, { physical: b.bk.physical, ult: true }); this.afflict(b, a, u);
      }
      const P2 = FX2.pal(b.bk.pal), from = o.clone().setY(1.3), to = o.clone().addScaledVector(dir, L).setY(1.3);
      const beam = GodFX.beam(from, to, a.width * 0.32, P2.mid, { core: P2.core, k: 30 });
      VFX.later(0.5, () => { beam.dead = true; });
      const k = arenaFxK(o);
      for (let i = 1; i <= 4; i++) FX2.burst(o.clone().addScaledVector(dir, L * i / 4).setY(1), b.bk.pal, { size: 0.6, sparks: Math.round(10 * k), embers: 4, puffs: k > 0.6 ? 1 : 0, bursts: 1, light: i === 2, distort: false });
      if (a.fx === 'judgement') for (let i = 0; i < 8; i++) VFX.glyphs.spawn({ pos: o.clone().addScaledVector(dir, rand(0, L)).setY(rand(0.5, 2.2)), vel: V3(rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.5, 0.5)), life: 0.9, size: 0.35, sizeEnd: 0.1, color: COL.glyph, intensity: 2.4, cell: VFX.glyphCell(), rot: 0 });
      Cam.shake = Math.max(Cam.shake, 0.25 * k);
    });
  },
  storm(b, a, tg) {
    const at = this.lead(b, tg, 10).clone().setY(0);
    const d = Math.hypot(at.x - b.pos.x, at.z - b.pos.z); if (d > a.range) at.sub(b.pos).multiplyScalar(a.range / d).add(b.pos).setY(0);
    arenaTelegraph(at, { radius: a.radius, delay: a.delay, team: b.team, pal: b.bk.pal });
    b.castLock = Math.min(0.8, a.delay); b.face(at, 1, 100);
    const k = arenaFxK(at), dur = a.ticks * a.tickDt + 0.4;
    VFX.later(a.delay, () => {
      if (!Arena.active) return;
      if (a.fx === 'snow') { GodFX.storm(at, a.radius, dur, 'snow', 90 * k); FX2.mist(at, 'frost', { radius: a.radius, rate: 6 * k, dur, alpha: 0.4 }); FX2.ring(at, 'skadi', { radius: a.radius, dur: 0.6 }); }
      if (a.hitSfx) Sound.bot(b.god, a.hitSfx, { pos: at, gain: 0.7, big: true });
      for (let i = 0; i < a.ticks; i++) VFX.later(i * a.tickDt, () => {
        if (!Arena.active) return;
        const last = i === a.ticks - 1;
        this.hitAll(b, { ...a, stun: last ? a.finalStun : 0 }, at, a.radius);
        if (a.fx === 'cats') for (let j = 0; j < 2; j++) { const p = at.clone().add(V3(rand(-1, 1) * a.radius * 0.7, 1, rand(-1, 1) * a.radius * 0.7)); FX2.slash(p, rand(0, TAU), 'bastet', { r0: 0.4, r1: 1.8, dur: 0.25, int: 1.6, tilt: rand(-0.6, 0.6) }); }
        if (a.fx === 'snow' && k > 0.4) GodFX.shards(at.clone().add(V3(rand(-2, 2), 1, rand(-2, 2))), 3, 0.6);
      });
    });
  },
  gate(b, a, tg) {
    const at = this.lead(b, tg, 10).clone().setY(0);
    const d = Math.hypot(at.x - b.pos.x, at.z - b.pos.z); if (d > a.range) at.sub(b.pos).multiplyScalar(a.range / d).add(b.pos).setY(0);
    arenaTelegraph(at, { radius: a.radius, delay: a.delay, team: b.team, pal: b.bk.pal });
    b.castLock = 0.9; b.face(at, 1, 100);
    const portal = GodFX.portal(at, a.radius * 0.9, new THREE.Color(0.62, 0.08, 1.0), new THREE.Color(0.1, 0.0, 0.25), { flat: true, y: 0.08 });
    VFX.later(a.delay, () => {
      portal.dead = true;
      if (!Arena.active) return;
      this.hitAll(b, a, at, a.radius);
      if (a.hitSfx) Sound.bot(b.god, a.hitSfx, { pos: at, gain: 0.8, big: true });
      const k = arenaFxK(at);
      FX2.impact(at, 'hecate', { size: 1.1, sparks: Math.round(30 * k), debris: Math.round(8 * k), dustPal: 'hecate' });
      FX2.burst(at.clone().setY(1.2), 'hexpink', { size: 0.9, sparks: Math.round(16 * k), embers: 8, puffs: 2, bursts: 1, light: true });
    });
  },
  cloud(b, a) {
    const at = b.pos.clone().setY(0);
    arenaTelegraph(at, { radius: a.radius, delay: a.delay, team: b.team, pal: 'fart', follow: b.pos });
    b.castLock = a.delay; b.anim.play('belch');
    VFX.later(a.delay, () => {
      if (!b.alive || !Arena.active) return;
      const c = b.pos.clone().setY(0), dur = a.ticks * a.tickDt + 0.5, k = arenaFxK(c);
      FX2.mist(c, 'toxic', { radius: a.radius, rate: 14 * k, dur, alpha: 0.7, glow: 0.5 });
      FX2.mist(c, 'fart', { radius: a.radius * 0.7, rate: 6 * k, dur, alpha: 0.5, glow: 0.9 });
      FX2.burst(c.clone().setY(0.8), 'fart', { size: 1.1, sparks: Math.round(16 * k), embers: 6, puffs: 3, bursts: 1, light: true });
      for (let i = 0; i < a.ticks; i++) VFX.later(i * a.tickDt, () => { if (Arena.active) this.hitAll(b, i === 0 && a.firstStun ? { ...a, stun: a.firstStun } : a, c, a.radius); if (i % 2) Sound.bot(b.god, pick(['df_toot2', 'df_toot5']), { pos: c, gain: 0.5 }); });
    });
  },
  honk(b, a) {
    const at = b.pos.clone().setY(0);
    arenaTelegraph(at, { radius: a.radius, delay: a.delay, team: b.team, pal: 'clownPink', follow: b.pos });
    b.castLock = a.delay + 0.3;
    VFX.later(a.delay, () => {
      if (!b.alive || !Arena.active) return;
      const c = b.pos.clone();
      this.hitAll(b, a, c, a.radius);
      const k = arenaFxK(c);
      for (const pal of ['clownPink', 'clownGold', 'clownLime', 'clownCyan']) FX2.burst(c.clone().add(V3(rand(-1, 1), 1.4, rand(-1, 1))), pal, { size: 0.6, sparks: Math.round(12 * k), embers: 6, puffs: 0, bursts: 1, light: pal === 'clownPink', distort: false });
      FX2.ring(c, 'clownPink', { radius: a.radius, dur: 0.6 });
      Arena.floatText(b, 'HOOONK!', '#ff7ad8');
    });
  },
  // ground effects of the plain AoEs, per god
  groundFx(b, a, at, R) {
    const k = arenaFxK(at), pal = b.bk.pal;
    FX2.ring(at, pal, { radius: R, dur: 0.5 });
    FX2.burst(at.clone().setY(0.6), pal, { size: 0.6 + R * 0.08, sparks: Math.round(18 * k), embers: Math.round(6 * k), puffs: k > 0.5 ? 2 : 0, bursts: 1, light: k > 0.5, distort: false });
    if (k < 0.3) return;
    if (a.fx === 'glyph') { VFX.decal(at, VFX.runeTex, COL.cyan, R * 2.2, 1.1, { spin: 1.2, intensity: 1.6 }); }
    else if (a.fx === 'frost') { GodFX.iceSpikes(at, 0.4, R * 0.9, Math.round(8 * k), { height: 0.8, life: 1.2 }); }
    else if (a.fx === 'hex') { VFX.decal(at, GodFX.sig.hex, new THREE.Color(0.6, 0.15, 1.0), R * 2.3, 1.0, { spin: -1.5, intensity: 1.8 }); }
    else if (a.fx === 'pillar') { const c = GodFX.column(at, R * 0.6, 14, new THREE.Color(1.0, 0.55, 0.12), { core: GCOL.sunHot, k: 30 }); VFX.later(0.45, () => { c.dead = true; }); }
  },
};

// ---------------------------------------------------------------------------
// Minions: shambling mummies (melee) and hovering faience ushabti (ranged) walking the lane
// ---------------------------------------------------------------------------
class Minion extends ArenaUnit {
  constructor(team, type, wave, laneZ) {
    const melee = type === 'melee', mins = Arena.time / 60;
    super(team, 'minion', { name: melee ? 'Mummy' : 'Ushabti', radius: melee ? 0.45 : 0.42, height: melee ? 1.95 : 1.6,
      hp: Math.round((melee ? 300 : 210) * (1 + mins * 0.08)), prot: 10 + mins, speed: 2.5 });
    this.type = type; this.melee = melee; this.isMummy = melee; this.laneZ = laneZ; this.wave = wave;
    this.dmg = (melee ? 13 : 17) * (1 + mins * 0.06); this.range = melee ? 1.3 : 8.5; this.atkCd = rand(0, 0.6); this.thinkT = rand(0, 0.25); this.target = null;
    if (melee && Assets.glb.mummy) {
      this.rig = new MixerRig(Assets.glb.mummy, { keepXZ: { death: 0.18 }, keepUp: { death: 0.35 }, once: ['death', 'hit', 'scream'], env: 1.1 });
      for (const m of this.rig.mats) m.emissive.copy(TEAMS[team].col);
      this.rig.loop('walk'); this.rig.acts.walk.time = rand(0, 4);
      this.mesh.add(this.rig.root);
    } else {
      this.model = Assets.glb.ushabti ? makeUshabtiProp() : buildUshabtiMesh();
      this.model.scale.setScalar(0.72); this.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.mesh.add(this.model);
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: TEAMS[team].hot, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      eye.position.set(0, 1.3, 0.2); eye.scale.setScalar(0.5); this.mesh.add(eye); this.eye = eye;
    }
  }
  think() {
    // minions fight minions first, then the siege beast, then gods
    let best = null, bs = 1e9;
    for (const u of Arena.foesOf(this.team)) {
      if (!u.alive || u.team === 2 || !Arena.visibleTo(u, this.team)) continue;
      const d = this.dist(u); if (d > 8.5) continue;
      const s = d + (u.isMinion ? 0 : u.kind === 'siege' ? 4 : 7);
      if (s < bs) { bs = s; best = u; }
    }
    this.target = best;
  }
  update(dt, t) {
    if (this.replica) return this.replicaUpdate(dt, t);
    this.tickStatus(dt, t);
    if (this.rig) this.rig.update(dt * (this.onScreen ? 1 : 0.5));
    if (!this.alive) { this.updateDead(dt); return; }
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = 0.3; this.think(); }
    this.atkCd = Math.max(0, this.atkCd - dt);
    const side = TEAMS[this.team].side, dir = -side, tg = this.target;
    if (tg && tg.alive && this.canAct) {
      const d = this.dist(tg), reach = this.range + tg.radius;
      if (d > reach) this.moveToward(tg.pos.x, tg.pos.z, dt, reach * 0.9);
      else { this.velocity.set(0, 0, 0); this.face(tg.pos, dt); if (this.atkCd <= 0) this.attack(tg); }
    } else if (this.canAct) {
      // the lane, then through the enemy's base entrance to their portal
      const gate = ArenaMap.gates[1 - this.team];
      let gx = gate.pos.x, gz = 0;
      if (dir * this.pos.x < AM.gateX - 6) { const near = smoothstep(AM.gateX - 24, AM.gateX - 8, dir * this.pos.x); gx = dir * (AM.gateX - 5); gz = lerp(this.laneZ, clamp(this.laneZ, -1.5, 1.5), near); }
      const r = Arena.route(this.pos, _au1.set(gx, 0, gz));
      this.moveToward(r.x, r.z, dt, 0.2);
      if (Math.hypot(this.pos.x - gate.pos.x, this.pos.z - gate.pos.z) < AM.portalR) Arena.minionThroughPortal(this);
    } else this.velocity.set(0, 0, 0);
    this.pose(dt, t);
  }
  attack(tg) {
    this.atkCd = this.melee ? 1.25 : 1.6;
    if (this.melee) {
      if (this.rig) { const a = this.rig.oneShot('scream', 0.08, 0.7, 2.2); if (a) VFX.later(0.4, () => { if (this.alive) a.fadeOut(0.25); }); }
      VFX.later(0.3, () => { if (!this.alive || !tg.alive || this.dist(tg) > this.range + tg.radius + 0.6) return; Arena.hurt(tg, this.dmg, this, { physical: true, minion: true }); if (this.onScreen && this.camDist < 25) Sound.arena('minion_melee', { pos: tg.pos, gain: 0.6 }); });
    } else {
      const o = this.pos.clone().setY(1.25), dir = _au1.set(tg.pos.x - o.x, 0, tg.pos.z - o.z).normalize().clone();
      Arena.shots.push(new ArenaShot({ pos: o, dir, speed: 22, range: this.range + 2, width: 0.4, size: 0.42, pal: this.team === 0 ? 'thoth' : 'molten', team: this.team,
        onHit: (u) => { Arena.hurt(u, this.dmg, this, { minion: true }); } }));
      if (this.onScreen && this.camDist < 25) Sound.arena('minion_ranged', { pos: this.pos, gain: 0.5 });
      this.kick = 1;
    }
  }
  pose(dt, t) {
    if (this.spawnT !== undefined && this.spawnT < 1) { this.spawnT = Math.min(1, this.spawnT + dt * 2.5); this.mesh.scale.setScalar(Math.max(0.01, easeOutBack(this.spawnT))); }
    if (this.rig) {
      const v = Math.hypot(this.velocity.x, this.velocity.z);
      if (this.rig.current === this.rig.acts.walk) this.rig.acts.walk.timeScale = this.cc ? 0 : clamp(v / 0.85, 0.35, 3.0);
      for (const m of this.rig.mats) m.emissiveIntensity = 0.06 + this.flash * 0.6;
      this.mesh.position.set(this.pos.x, this.lift, this.pos.z);
      this.rig.root.rotation.y = this.facing;
    } else {
      this.kick = Math.max(0, (this.kick || 0) - dt * 4);
      this.mesh.position.set(this.pos.x, this.lift + 0.35 + Math.sin(t * 2.3 + this.id) * 0.12, this.pos.z);
      this.model.rotation.set(-this.kick * 0.25, this.facing, Math.sin(t * 1.7 + this.id) * 0.05);
      this.eye.material.opacity = 0.6 + this.flash * 0.4 + this.kick * 0.4;
    }
  }
  die() {
    if (this.rig) {
      this.dying = 0.9; this.rig.mixer.stopAllAction(); this.rig.current = null;
      const a = this.rig.acts.death; a.reset(); a.timeScale = 1.5; a.setEffectiveWeight(1); a.play();
    } else this.dying = 0.01;
  }
  updateDead(dt) {
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) {
        const p = this.pos.clone(), k = arenaFxK(p);
        if (k > 0.2) {
          if (this.rig) for (let i = 0; i < Math.round(8 * k); i++) VFX.smoke.spawn({ pos: p.clone().add(V3(rand(-0.4, 0.4), rand(0.1, 1.0), rand(-0.4, 0.4))), vel: V3(rand(-0.6, 0.6), rand(0.2, 1), rand(-0.6, 0.6)), life: rand(1, 1.8), size: rand(0.6, 1.2), sizeEnd: 2.2, color: new THREE.Color(0.72, 0.6, 0.42), alpha: 0.4, alphaEnd: 0, cell: FX.smoke, drag: 1.2 });
          else { VFX.shatter(p, M.ushabti, Math.round(12 * k), 0.7); }
        }
        this.gone = true;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The siege beast: a colossus of Sebek pushing toward the enemy portal (assets/web/sebek.json; a scaled,
// tinted Anubis sentinel stands in if it is missing). Heavy: knock-backs and roots do not move it.
// ---------------------------------------------------------------------------
const SEBEK = { scale: 2.0, walk: 0.59, khopesh: { len: 0.95, off: [0, 8, 0], axis: [0, 0, 1], up: [0, 1, 0], grip: [0.095, 0.19, 0] } };
class Siege extends ArenaUnit {
  constructor(team, n) {
    super(team, 'siege', { name: 'Sebek Colossus', radius: 1.35, height: 5.0, hp: Math.round(2600 + 450 * n + Arena.time * 1.5), prot: 35, speed: 1.6 });
    this.heavy = true; this.atkCd = 1.5; this.target = null; this.thinkT = 0;
    const src = Assets.glb.sebek || Assets.glb.sentinel;
    this.real = !!Assets.glb.sebek;
    this.rig = new MixerRig(src, this.real ? { once: ['attack', 'slam', 'roar', 'death'], keepXZ: { death: 0.5 }, env: 1.2 } : { keepXZ: { death: 0.5 }, once: ['death', 'hit'], env: 1.25 });
    this.rig.root.scale.setScalar(this.real ? SEBEK.scale : 1.9);
    for (const m of this.rig.mats) { m.emissive.copy(TEAMS[team].col); if (!this.real) m.color.multiply(new THREE.Color(0.55, 0.75, 0.5)); }
    this.walkSpeed = this.real ? SEBEK.walk * SEBEK.scale : 1.16 * 1.9;
    this.mesh.add(this.rig.root);
    if (this.real && Assets.glb.sebek_khopesh) {
      const hand = this.rig.model.getObjectByName('RightHand');
      if (hand) {
        const K = SEBEK.khopesh, blade = Assets.glb.sebek_khopesh.scene.clone(true);
        blade.position.set(-K.grip[0], -K.grip[1], -K.grip[2]);
        const holder = new THREE.Group(); holder.position.fromArray(K.off); holder.scale.setScalar(100 * K.len);
        const ax = new THREE.Vector3().fromArray(K.axis).normalize(), up = new THREE.Vector3().fromArray(K.up); up.addScaledVector(ax, -up.dot(ax)).normalize();
        holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(ax, up), ax, up));
        holder.add(blade); hand.add(holder);
        blade.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.envMapIntensity = 1.3; } });
      }
    }
    this.rig.loop('idle');
    if (this.real) this.oneShot('roar', 2.83, 1);
    this.introT = this.real ? 2.4 : 0.5;
    this.aura = FX2.aura(this.pos, team === 0 ? 'thoth' : 'molten', { radius: 1.6, height: 4, rate: 6, int: 1.2 });
  }
  update(dt, t) {
    this.tickStatus(dt, t);
    this.rig.update(dt * (this.onScreen ? 1 : 0.5));
    if (!this.alive) {
      if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) { FX2.impact(this.pos, 'dust', { size: 1.6, sparks: 10, debris: 16 }); this.gone = true; } }
      return;
    }
    if (this.replica) return this.replicaUpdate(dt, t);
    this.introT -= dt; this.atkCd = Math.max(0, this.atkCd - dt);
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.4; this.target = null; let bd = 4.2;
      for (const u of Arena.foesOf(this.team)) { if (!u.alive || u.team === 2) continue; const d = this.dist(u) - u.radius; if (d < bd) { bd = d; this.target = u; } }
    }
    const dir = -TEAMS[this.team].side, gate = ArenaMap.gates[1 - this.team];
    if (this.introT > 0) { this.velocity.set(0, 0, 0); }
    else if (this.target && this.target.alive) {
      this.velocity.set(0, 0, 0); this.face(this.target.pos, dt, 3);
      if (this.atkCd <= 0) this.stomp();
    } else {
      const gx = dir * this.pos.x < AM.gateX - 6 ? dir * (AM.gateX - 5) : gate.pos.x;
      const r = Arena.route(this.pos, _au1.set(gx, 0, 0));
      this.moveToward(r.x, r.z, dt, 0.2);
      if (Math.hypot(this.pos.x - gate.pos.x, this.pos.z - gate.pos.z) < AM.portalR + 1) Arena.siegeThroughPortal(this);
    }
    const v = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.atkCd > 1.0 || this.introT > 0) { /* a swing or the roar is playing over the idle */ }
    else if (v > 0.2) this.rig.loop('walk', 0.35, clamp(v / this.walkSpeed, 0.5, 1.6)); else this.rig.loop('idle', 0.4);
    for (const m of this.rig.mats) m.emissiveIntensity = 0.1 + this.flash * 0.5;
    this.mesh.position.set(this.pos.x, 0, this.pos.z); this.rig.root.rotation.y = this.facing;
  }
  stomp() {
    this.atkCd = 2.8;
    const slam = !this.real || Math.random() < 0.65, impact = this.real ? (slam ? 0.7 : 1.5) : 0.4;
    if (this.real) { this.rig.loop('idle', 0.2); this.oneShot(slam ? 'slam' : 'attack', slam ? 1.83 : 1.87, 1); }
    else this.oneShot('hit', 0.8, 1.3);
    VFX.later(impact, () => {
      if (!this.alive) return;
      const f = fwdOf(this.facing), at = this.pos.clone().addScaledVector(f, slam ? 1.6 : 2.4).setY(0);
      for (const u of Arena.foesNear(at, 3.6, this.team)) Arena.hurt(u, 75 + Arena.time * 0.06, this, { physical: true, siege: true });
      const k = arenaFxK(at);
      FX2.impact(at, 'dust', { size: 1.0, sparks: Math.round(14 * k), debris: Math.round(10 * k), scorchDur: 2.2 });
      Sound.arena('siege_stomp', { pos: at, gain: 0.9 });
      if (this.camDist < 25) Cam.shake = Math.max(Cam.shake, 0.3 * (1 - this.camDist / 25));
    });
  }
  // a one-shot clip over the looping one, faded out before its clamped last frame
  oneShot(name, dur, rate = 1) {
    const a = this.rig.oneShot(name, 0.1, 1, rate);
    if (a) VFX.later(Math.max(0.1, dur / rate - 0.3), () => { if (this.alive) a.fadeOut(0.3); });
    return a;
  }
  die() {
    this.dying = this.real ? 2.2 : 1.4; this.rig.mixer.stopAllAction(); this.rig.current = null;
    const a = this.rig.acts.death; if (a) { a.reset(); a.timeScale = 1; a.setEffectiveWeight(1); a.play(); }
    if (this.aura) this.aura.dead = true;
    Sound.arena('siege_death', { pos: this.pos, gain: 1 });
  }
  dispose() { super.dispose(); if (this.aura) this.aura.dead = true; }
}

// ---------------------------------------------------------------------------
// Jungle guardians: an Anubis sentinel and a mummy in the buff's colour; they answer whoever strikes them
// and walk home if pulled too far
// ---------------------------------------------------------------------------
class CampMob extends ArenaUnit {
  constructor(camp, big) {
    const mins = Arena.time / 60, B = BUFFS[camp.buff];
    super(2, 'camp', { name: big ? `Guardian · ${B.name}` : 'Tomb Guardian', radius: big ? 0.62 : 0.45, height: big ? 2.75 : 1.95, hp: Math.round((big ? 1350 : 520) * (1 + mins * 0.07)), prot: 25, speed: big ? 2.2 : 2.4 });
    this.camp = camp; this.big = big; this.isMummy = !big; this.atkCd = 1; this.dmg = (big ? 34 : 18) * (1 + mins * 0.05); this.home = new THREE.Vector3();
    const src = big ? Assets.glb.sentinel : Assets.glb.mummy;
    this.rig = new MixerRig(src, { keepXZ: { death: big ? 0.5 : 0.18 }, keepUp: { death: 0.35 }, once: ['death', 'hit', 'scream'], env: 1.2 });
    for (const m of this.rig.mats) m.emissive.copy(B.col);
    this.walkSpeed = big ? 1.16 : 0.85;
    this.rig.loop(big ? 'idle' : 'walk'); if (!big) this.rig.acts.walk.timeScale = 0.4;
    this.mesh.add(this.rig.root);
  }
  update(dt, t) {
    this.tickStatus(dt, t);
    this.rig.update(dt * (this.onScreen ? 1 : 0.4));
    if (!this.alive) { if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) { this.mesh.visible = false; this.gone = true; } } return; }
    if (this.replica) return this.replicaUpdate(dt, t);
    this.atkCd = Math.max(0, this.atkCd - dt);
    let tg = this.lastAttacker && Combat.time - this.lastAttackT < 6 && this.lastAttacker.alive ? this.lastAttacker : null;
    if (tg && this.home.distanceTo(tg.pos) > 12) tg = null;
    if (tg && this.canAct) {
      const d = this.dist(tg), reach = 1.3 + tg.radius + this.radius;
      if (d > reach) this.moveToward(tg.pos.x, tg.pos.z, dt, reach * 0.9);
      else { this.velocity.set(0, 0, 0); this.face(tg.pos, dt); if (this.atkCd <= 0) this.attack(tg); }
    } else if (this.canAct) {
      const d = this.moveToward(this.home.x, this.home.z, dt, 0.3);
      if (d < 0.6) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt); this.face(_au1.set(0, 0, 0), dt, 2); }
    }
    const v = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.big) { if (this.atkCd < 1.1 && this.atkCd > 0.4) { /* swinging */ } else if (v > 0.3) this.rig.loop('walk', 0.3, clamp(v / this.walkSpeed, 0.6, 1.8)); else this.rig.loop('idle', 0.4); }
    else if (this.rig.current === this.rig.acts.walk) this.rig.acts.walk.timeScale = v > 0.2 ? clamp(v / this.walkSpeed, 0.4, 3) : 0.35;
    for (const m of this.rig.mats) m.emissiveIntensity = 0.18 + 0.08 * Math.sin(t * 2 + this.id) + this.flash * 0.5;
    this.mesh.position.set(this.pos.x, this.lift, this.pos.z); this.rig.root.rotation.y = this.facing;
  }
  attack(tg) {
    this.atkCd = this.big ? 1.6 : 1.3;
    const a = this.rig.oneShot(this.big ? 'hit' : 'scream', 0.08, 0.8, this.big ? 1.2 : 2.0); if (a) VFX.later(0.45, () => { if (this.alive) a.fadeOut(0.25); });
    VFX.later(0.32, () => { if (this.alive && tg.alive && this.dist(tg) < 2.6 + tg.radius) Arena.hurt(tg, this.dmg, this, { physical: true }); });
  }
  die() {
    this.dying = this.big ? 1.3 : 0.9; this.rig.mixer.stopAllAction(); this.rig.current = null;
    const a = this.rig.acts.death; a.reset(); a.timeScale = 1.3; a.setEffectiveWeight(1); a.play();
    FX2.burst(this.pos.clone().setY(1.2), BUFFS[this.camp.buff].pal, { size: 0.7, sparks: 14, embers: 8, puffs: 2, bursts: 1, light: true, distort: false });
  }
}


// ============================================================================
// ULLR, Norse god of the hunt, archery, winter and duels - «Bowelius». A meme god made to tease a
// friend: he looks and moves like the most epic hunter in the pantheon, his magic burns emerald and
// jade like SMITE's Ullr ... and he misses almost everything. Arrows wobble off, fall short or fly at
// the sky (about 70 % miss), axes go wild or boomerang into his own head (BONK, dizzy stars, 0 damage),
// Hail of Arrows scatters (one lands at his own feet and he jumps), Glory Bound ends in a stumble or a
// faceplant. Whatever DOES hit does exactly 1 damage (Combat.deal(d, 1, ..., true)).
// SMITE 2 kit in two stances: Bow (Bladed Arrow, Expose Weakness, Hail of Arrows) and Axes (Thrown
// Axe, Invigorate, Glory Bound), 4 = Wield Axes / Wield Bow, and the playroom finale BOWELIUS THE
// CLOWN: a poof of confetti and he is a clown (his own second rig, assets/ullr_clown) doing a smug
// L-on-the-forehead hop-and-kick dance for six seconds while every 0.5 s a honk of confetti does 1
// damage to everything within 6 m. Passive: every 10 s "I am the worst god in SMITE! Bowelius, HELP ME!".
// ============================================================================
// his luck (which arrow hits, where the axe flies, how he lands): online the rolls of a cast come from a seed the cast
// carries, so every page sees the same misses (another player's replayed cast rolls its own; 14n_net.js)
const LocalActor = { rng: Math.random };
const kroll = () => (Net.ctx ? Net.ctx.rng() : LocalActor.rng());
const ULLR_STATS = { hp: [440, 80], mp: [205, 36], speed: 370, range: 55, as: [1.0, 0.014], basic: [36, 2.0], basicScale: 1.0, hp5: [8, 0.7], mp5: [4.6, 0.4] };
const UL_AXE_RANGE = 12;                                   // melee reach in Axe stance (SMITE units)
const UL_ORDER = { bow: ['ba', 'ew', 'hl', 'ws', 'bw'], axe: ['ta', 'iv', 'gb', 'ws', 'bw'] };
const UL_FIN = { dur: 10.5, tick: 0.5, radius: 6 };   // the chant (5.5 s), then a clown taunt and a last cackle         // Bowelius the Clown
const UL_PASSIVE = { every: 15, line: 'I am the worst god in SMITE! Bowelius, HELP ME!' };   // v3: a ripping fart every 15 s instead of the shout
const UL_BA_RELEASE = 0.56;                                // Bladed Arrow leaves the bow (s after the cast)
const UL_HAIL = { delay: 0.55, waves: [0.55, 1.15, 1.75], fall: 0.32, selfWave: 1, victim: 0.35, inside: 0.22 };
// how bad he is: the chance that a shot actually flies true (it still has to be aimed at something)
const UL_LUCK = { arrow: 0.3, bladed: 0.4, bladedUturn: 0.35, axe: 0.35, axeBoomerang: 0.4, gbStun: 0.45, gbClean: 0.3, gbFaceplant: 0.43 };
// the bow is a held aim layer on the drawshot clip (RigAnimator.aim): clip times of the nock, the full
// draw and the follow-through; yaw turns the sideways archery pose to face forward (eased, see the animator)
const UL_AIM = { clip: 'drawshot', nock: 3.6, drawn: 6.45, follow: 6.8, yaw: -75, full: 0.6, hold: 1.1 };
const UL_BA_KEYS = [[0, 0.31], [0.2, 1.4], [0.36, 3.54], [0.56, 6.6], [0.66, 6.82], [0.9, 7.1]];   // Bladed Arrow: reach back, nock, draw, loose
const UL_LEAP = { crouch: 0.14, air: 0.72 };               // Glory Bound: the chop lands at crouch + air = 0.86 s (the 'leap' act's key)
const U = { stance: 'bow', combo: 0, comboT: 0, ew: 0, ewRank: 1, iv: 0, ivRank: 1, leap: null, hails: [], clown: null, home: null, clownR: null,
  passiveT: 6, bubble: null, swap: null, auras: [], axeBack: 0, drawing: null, kills: 0, aimL: null, aimHold: 0, relT: 9, headC: new THREE.Vector3(), dizzy: 0, handMemo: null, bowLinger: 0 };
// emerald and jade (deep and saturated; gold sparks; nothing washed out to white)
const UC = { jade: new THREE.Color(0.04, 0.78, 0.4), deep: new THREE.Color(0.0, 0.32, 0.14), hot: new THREE.Color(0.45, 1.0, 0.62), rune: new THREE.Color(0.02, 0.85, 0.45),
  gold: new THREE.Color(1.0, 0.72, 0.22), dark: new THREE.Color(0.01, 0.07, 0.03) };
const _u1 = new THREE.Vector3(), _u2 = new THREE.Vector3(), _u3 = new THREE.Vector3(), _u4 = new THREE.Vector3(), _u5 = new THREE.Vector3(), _u6 = new THREE.Vector3(),
  _u7 = new THREE.Vector3(), _u8 = new THREE.Vector3(), _uUp = new THREE.Vector3(0, 1, 0), _uM = new THREE.Matrix4();
const ullrAB = {
  ba: { id: 'ba', name: 'Bladed Arrow', cost: [60, 65, 70, 75, 80], cd: [13, 13, 13, 13, 13], range: 70, stun: [1.0, 1.15, 1.3, 1.45, 1.6], targeted: true },
  ew: { id: 'ew', name: 'Expose Weakness', cost: [50, 50, 50, 50, 50], cd: [15, 15, 15, 15, 15], as: [0.2, 0.25, 0.3, 0.35, 0.4], dur: 5 },
  hl: { id: 'hl', name: 'Hail of Arrows', cost: [70, 75, 80, 85, 90], cd: [16, 15.5, 15, 14.5, 14], range: 70, radius: 20, slow: 0.3, slowDur: 1.5, targeted: true },
  ta: { id: 'ta', name: 'Thrown Axe', cost: [60, 65, 70, 75, 80], cd: [13, 13, 13, 13, 13], range: 60, stun: [1.0, 1.15, 1.3, 1.45, 1.6], targeted: true },
  iv: { id: 'iv', name: 'Invigorate', cost: [30, 30, 30, 30, 30], cd: [15, 15, 15, 15, 15], speed: [0.2, 0.25, 0.3, 0.35, 0.4], mana: [4, 5, 6, 7, 8], dur: 5 },
  gb: { id: 'gb', name: 'Glory Bound', cost: [70, 75, 80, 85, 90], cd: [14, 14, 14, 14, 14], range: 55, radius: 15, stun: [1.0, 1.0, 1.0, 1.0, 1.0], air: UL_LEAP.air, targeted: true },
  ws: { id: 'ws', name: 'Wield Axes', cost: [0, 0, 0, 0, 0], cd: [1.5, 1.5, 1.5, 1.5, 1.5] },
  bw: { id: 'bw', name: 'Bowelius the Clown', cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33] },
};
// the 1-damage rule, in one place: every hit, tick and basic attack goes through here
function ulHit(d, kind, src) { return Combat.deal(d, 1, kind, src, true); }

// ---- palettes: emerald (his magic), jade (runes), gold (sparks), a dark green dust, and the clown's party colours
FX2.defPal('ullr', { edge: [0.0, 0.14, 0.05], mid: [0.02, 0.6, 0.26], core: [0.36, 0.95, 0.5], smoke: [0.04, 0.13, 0.07], light: [0.06, 0.8, 0.3], spark: [1.0, 0.78, 0.3] });
FX2.defPal('ullrRune', { edge: [0.0, 0.16, 0.1], mid: [0.0, 0.66, 0.42], core: [0.4, 1.0, 0.68], smoke: [0.03, 0.12, 0.08], light: [0.05, 0.75, 0.45] });
FX2.defPal('ullrGold', { edge: [0.32, 0.1, 0.0], mid: [1.0, 0.58, 0.06], core: [1.0, 0.84, 0.4], smoke: [0.16, 0.09, 0.03], light: [1.0, 0.62, 0.15] });
FX2.defPal('ullrDust', { edge: [0.02, 0.12, 0.04], mid: [0.1, 0.4, 0.18], core: [0.4, 0.8, 0.45], smoke: [0.34, 0.4, 0.35] });
FX2.defPal('clownPink', { edge: [0.3, 0.0, 0.14], mid: [1.0, 0.12, 0.5], core: [1.0, 0.55, 0.82], smoke: [0.9, 0.55, 0.75], light: [1.0, 0.2, 0.6] });
FX2.defPal('clownGold', { edge: [0.35, 0.12, 0.0], mid: [1.0, 0.6, 0.04], core: [1.0, 0.86, 0.38], smoke: [0.95, 0.8, 0.45], light: [1.0, 0.65, 0.15] });
FX2.defPal('clownLime', { edge: [0.04, 0.2, 0.0], mid: [0.3, 0.95, 0.08], core: [0.72, 1.0, 0.4], smoke: [0.55, 0.85, 0.4], light: [0.4, 1.0, 0.1] });
FX2.defPal('clownCyan', { edge: [0.0, 0.12, 0.3], mid: [0.0, 0.6, 1.0], core: [0.45, 0.92, 1.0], smoke: [0.5, 0.8, 0.95], light: [0.1, 0.6, 1.0] });
const UL_PARTY = ['clownPink', 'clownGold', 'clownLime', 'clownCyan'];

// piecewise-linear lookup in [[t, v], ...]
function ulKeys(K, t) { let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++; return lerp(K[i][1], K[i + 1][1], clamp((t - K[i][0]) / (K[i + 1][0] - K[i][0]), 0, 1)); }
// ---- emerald magic ----------------------------------------------------------------------------
function ulMotes(p, n = 8, spread = 0.5) {
  for (let i = 0; i < n; i++) { const r = Math.random(); FX2.glow.spawn({ pos: _u1.copy(p).add(_u2.set(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))), vel: V3(rand(-0.8, 0.8), rand(0.1, 1.2), rand(-0.8, 0.8)), life: rand(0.6, 1.2), size: r < 0.3 ? rand(0.1, 0.18) : rand(0.05, 0.09), sizeEnd: 0.01, cell: r < 0.3 ? FXA.star : r < 0.75 ? FXA.ember : FXA.shard, pal: r < 0.25 ? 'ullrGold' : 'ullr', temp: 1.0, tempEnd: 0.5, int: 1.7, drag: 0.8, turb: 2.2, rotVel: rand(-4, 4) }); }
}
// a gold spray of sparks (the accent on every emerald burst)
function ulGoldSparks(p, n = 10, s = 1) {
  for (let i = 0; i < n; i++) { _u1.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(3, 8) * s); FX2.glow.spawn({ pos: p, vel: _u1.clone(), life: rand(0.3, 0.6), size: rand(0.05, 0.09), sizeEnd: 0.015, cell: FXA.spark, stretch: 2.5, pal: 'ullrGold', temp: 1.1, tempEnd: 0.5, int: 1.9, drag: 2.2, gravity: -7, fadeIn: 0 }); }
}
function ulBurst(p, s = 1, o = {}) {
  FX2.burst(p, 'ullr', { size: s, sparks: Math.round(20 * s), embers: Math.round(12 * s), puffs: Math.round(3 * s), bursts: o.bursts ?? 1, int: o.int ?? 1.0, distort: o.distort, light: o.light, smokeGlow: 0.5 });
  ulGoldSparks(p, Math.round(12 * s), Math.sqrt(s));
  for (let i = 0; i < Math.round(5 * s); i++) FX2.embers.spawn({ pos: p.clone(), vel: V3(rand(-4, 4), rand(2, 7), rand(-4, 4)).multiplyScalar(Math.sqrt(s)), size: rand(0.05, 0.11) * Math.sqrt(s), color: UC.jade, fadeColor: UC.deep, life: rand(0.8, 1.3) });
  ulMotes(p, Math.round(5 * s), 0.35 * s);
}
// jade crystal shards flying off a hit
function ulShards(p, n = 6, s = 1) {
  for (let i = 0; i < n; i++) FX2.glow.spawn({ pos: _u1.copy(p).add(_u2.set(rand(-0.2, 0.2), rand(0, 0.5), rand(-0.2, 0.2))), vel: V3(rand(-4, 4), rand(2, 6), rand(-4, 4)).multiplyScalar(s), life: rand(0.45, 0.8), size: rand(0.1, 0.2) * s, sizeEnd: 0.03, cell: FXA.shard, pal: 'ullrRune', temp: 1.0, tempEnd: 0.5, int: 1.8, rotVel: rand(-10, 10), gravity: -14, drag: 0.4 });
}
// dust kicked up from the floor
function ulDust(p, n = 6, s = 1) {
  for (let i = 0; i < n; i++) { const a = rand(0, TAU); FX2.smoke.spawn({ pos: V3(p.x + Math.cos(a) * 0.3 * s, 0.15, p.z + Math.sin(a) * 0.3 * s), vel: V3(Math.cos(a) * rand(1, 3) * s, rand(0.3, 1.2), Math.sin(a) * rand(1, 3) * s), life: rand(0.8, 1.3), size: 0.35 * s, sizeEnd: 1.4 * s, frames: 16, pal: 'ullrDust', temp: 0.2, tempEnd: 0, int: 1.1, alpha: 0.55, drag: 2.4, turb: 0.5 }); }
}
// a rune circle flaring on the ground
function ulRuneCircle(c, size = 3, dur = 1.2, intensity = 1.4) { return GodFX.decal(c.clone().setY(0), GodFX.sig.norse, UC.rune, size, dur, { intensity, spin: 0.4 }); }
// a ribbon of emerald behind a moving point of a prop (axe blades, the bow)
function ulPropTrail(prop, dur, width = 0.18, local = null) {
  if (!prop) return;
  const tr = VFX.trail(width, UC.jade, 2.4, 14), p = new THREE.Vector3(), lp = local || prop.userData.tip;
  GodFX.add({ update(dt) { prop.localToWorld(p.copy(lp)); tr.push(p); if (Math.random() < dt * 30) FX2.glow.spawn({ pos: p, vel: V3(rand(-0.4, 0.4), rand(-0.1, 0.6), rand(-0.4, 0.4)), life: rand(0.25, 0.45), size: rand(0.04, 0.08), sizeEnd: 0.01, cell: FXA.ember, pal: Math.random() < 0.3 ? 'ullrGold' : 'ullr', temp: 1.1, tempEnd: 0.4, int: 1.8, drag: 1 }); if (this.t > dur) { tr.alive = false; return false; } return true; }, dispose() { tr.alive = false; } });
}
// floating combat text for the jokes
function ulText(p, text, color = '#8dffb8', big = false, dy = 0) { Combat.texts.push({ x: p.x + rand(-0.2, 0.2), y: (p.y || 0) + dy, z: p.z + rand(-0.2, 0.2), text, color, t: 0, big }); }
function ulMissText(p) { ulText(p.clone().setY(Math.max(1.6, p.y + 0.6)), pick(['MISS!', 'MISS!', 'MISS!', 'WHIFF!', 'NOPE!']), '#d6ff5a', false); if (Math.random() < 0.3) Sound.voice('miss', { cooldown: 5 }); }
function ulHead(out = new THREE.Vector3()) { return out.setFromMatrixPosition(Game.thoth.bones.head.matrixWorld).add(_u4.set(0, 0.2, 0)); }

// ---- the weapons in his hands: shown/hidden with a quick scale pop (never a hard pop) ---------------
const ulProps = () => (U.home ? U.home.rig.props : (Game.thoth && Game.thoth.props) || {});
function ulShowWeapons(stance = U.stance) {
  const pr = ulProps(), A = U.aimL;
  // the bow is baked onto his back: the one in his hand only appears while he aims and shoots (then lingers a moment)
  if (U.swap && !U.swap.done) { for (const p of Object.values(pr)) p.userData.want = false; return; }   // mid-spin: everything shrinks away
  const want = { bow: stance === 'bow' && (!!U.drawing || (!!A && A.on) || U.bowLinger > 0), axeR: stance === 'axe' && U.axeBack <= 0, axeL: stance === 'axe', arrow: stance === 'bow' && (!!U.drawing || (!!A && A.on && U.relT > 0.22)) };
  for (const [k, v] of Object.entries(want)) if (pr[k]) pr[k].userData.want = v;
}
function ulPropsUpdate(dt, instant = false) {
  const pr = ulProps();
  for (const k of ['bow', 'axeR', 'axeL', 'arrow']) {
    const p = pr[k]; if (!p) continue;
    const u = p.userData, want = !!u.want;
    if (u.k === undefined || instant) u.k = want ? 1 : 0;
    const was = u.k > 0.5;
    u.k = damp(u.k, want ? 1 : 0, want ? 14 : 20, dt);
    p.visible = u.k > 0.01;
    p.scale.setScalar(Math.max(1e-3, want ? easeOutBack(Math.min(1, u.k * 1.02)) : u.k));
    if (!was && u.k > 0.5 && k !== 'arrow' && !instant) ulMotes(p.getWorldPosition(_u5), 6, 0.15);   // a glint as it appears
  }
}
// pull the bow string back (0..1) while he draws
function ulPull(k) { const b = ulProps().bow; if (b && b.userData.pull) b.userData.pull(clamp(k, 0, 1) * 0.42); }
// meshes thrown into the world share their materials with his props: drop the geometry, never the shared materials
function ulDrop(g) {
  if (!g || g.userData.dropped) return;
  g.userData.dropped = true;
  const keep = new Set(Object.values(ullrMats()));
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !keep.has(o.material)) o.material.dispose(); });
  if (g.parent) g.parent.remove(g);
}

// ---- arrows and axes in flight ------------------------------------------------------------
function ulArrowMesh(scale) { const g = makeUllrArrow(scale); scene.add(g); return g; }
function ulAim(g, dir) { g.quaternion.setFromUnitVectors(_uUp, _u3.copy(dir).normalize()); }
function ulBowOrigin(out = new THREE.Vector3()) {
  const b = ulProps().bow;
  if (b && b.visible && U.aimL && U.aimL.w > 0.5) { b.localToWorld(out.set(0, 0, 0.05)); out.y = clamp(out.y, P.y + 1.0, P.y + 1.8); return out; }
  return aimOrigin(out);
}
// an arrow that flies true (it still has to be pointed at something): a straight, fast projectile
function ulFireArrow(origin, dir, o = {}) {
  const speed = o.speed ?? 62, g = ulArrowMesh(o.scale ?? 1.25), trail = VFX.trail(o.trail ?? 0.1, UC.jade, 2.4, 12);
  ulAim(g, dir); g.position.copy(origin);
  Combat.projectiles.push(new Projectile({
    kind: 'basic', pos: origin, dir, speed, radius: 0.3, pierce: false, maxDist: (o.range ?? ULLR_STATS.range) * SU, glyphRange: 0,
    onMove(p, dt) { g.position.copy(p.pos); trail.push(p.pos); FX2.trailTick(p.pos, _u1.copy(p.dir).multiplyScalar(speed), 'ullr', dt, { k: 0.9, size: 0.7, smoke: false }); },
    onHit(d, hp) {
      ulHit(d, 'basic', 'Arrow');
      ulBurst(hp, 0.35, { distort: false, light: false });
      ulShards(hp, 3, 0.5);
      Sound.god('arrow_hit', { gain: 0.8, pos: hp, rate: rand(0.94, 1.06) });
    },
    onDie(p, at, hit) { trail.alive = false; if (!hit) { ulMotes(at, 4, 0.2); ulMissText(at); } ulDrop(g); },
  }));
}
// a flight that never hits anything: free ballistics + a steering function; sticks into the floor where it lands
function ulFlight(o) {
  const g = o.mesh, tr = VFX.trail(o.trailW ?? 0.1, UC.jade, 2.2, 12), S = { t: 0, pos: o.pos.clone(), vel: o.vel.clone(), landed: false, stuck: 0, spin: 0 };
  g.position.copy(S.pos);
  GodFX.add({ update(dt) {
    if (g.userData.dropped) return false;
    S.t += dt;
    if (!S.landed) {
      if (o.steer && o.steer(S, dt) === false) { tr.alive = false; ulDrop(g); return false; }
      S.vel.y += (o.gravity ?? 0) * dt;
      S.pos.addScaledVector(S.vel, dt);
      g.position.copy(S.pos);
      if (o.orient) o.orient(g, S, dt); else ulAim(g, S.vel);
      tr.push(S.pos);
      if (Math.random() < dt * 30) FX2.glow.spawn({ pos: S.pos, vel: S.vel.clone().multiplyScalar(-0.06), life: 0.25, size: 0.07, sizeEnd: 0.01, cell: FXA.ember, pal: 'ullr', temp: 1.1, tempEnd: 0.4, int: 1.6 });
      if (S.pos.y <= 0.06 && S.vel.y < 0) { S.landed = true; S.pos.y = 0.06; g.position.copy(S.pos); tr.alive = false; if (o.onLand) o.onLand(S, g); }
      else if (S.t > (o.life ?? 3)) { tr.alive = false; if (o.onEnd) o.onEnd(S, g); ulDrop(g); return false; }
    } else {
      S.stuck += dt;
      if (S.stuck > 1.3) g.position.y = S.pos.y - smoothstep(1.3, 1.8, S.stuck) * 0.5;   // sinks away
      if (S.stuck > 1.8) { ulDrop(g); return false; }
    }
    return true;
  }, dispose() { tr.alive = false; ulDrop(g); } });
  return S;
}
// a comedic miss for an arrow: it curves off with a wobble, falls short and plops into the floor,
// flies off at the sky, or just flops off the string
function ulSillyArrow(origin, dir, scale = 1.25, kind = null) {
  kind = kind || (() => { const r = kroll(); return r < 0.35 ? 'curve' : r < 0.65 ? 'short' : r < 0.85 ? 'sky' : 'flop'; })();
  const g = ulArrowMesh(scale), side = kroll() < 0.5 ? -1 : 1, plop = (S) => { ulDust(S.pos, 4, 0.6); ulMissText(S.pos); Sound.god('arrow_plop', { gain: 0.8, pos: S.pos, rate: rand(0.9, 1.15) }); };
  const wob = (g2, S, amt) => { ulAim(g2, S.vel); g2.rotateZ(Math.sin(S.t * 30) * amt); g2.rotateX(Math.sin(S.t * 23 + 1) * amt * 0.6); };
  if (kind === 'curve') {
    const w0 = side * rand(1.2, 2.0);
    ulFlight({ mesh: g, pos: origin, vel: dir.clone().multiplyScalar(34), life: 1.0, gravity: -2,
      steer(S, dt) { S.vel.applyAxisAngle(_uUp, w0 * (0.4 + S.t * 1.6) * dt); }, orient: (g2, S) => wob(g2, S, 0.35), onLand: plop,
      onEnd(S) { ulMissText(S.pos); } });
  } else if (kind === 'short') {
    ulFlight({ mesh: g, pos: origin, vel: dir.clone().multiplyScalar(rand(10, 14)).add(_u1.set(0, rand(2.5, 4), 0)), gravity: -16, orient: (g2, S) => wob(g2, S, 0.18), onLand: plop });
  } else if (kind === 'sky') {
    const d = dir.clone().applyAxisAngle(_uUp, side * rand(0.25, 0.5)).multiplyScalar(26).add(_u1.set(0, 22, 0));
    ulFlight({ mesh: g, pos: origin, vel: d, gravity: -6, life: 1.4 });
    VFX.later(0.4, () => ulMissText(origin.clone().addScaledVector(dir, 3).setY(2.6)));
  } else {   // flop: it slides off the string and tumbles to his feet
    ulFlight({ mesh: g, pos: origin, vel: dir.clone().multiplyScalar(rand(2.5, 4)).add(_u1.set(0, 1.2, 0)), gravity: -11, orient(g2, S, dt) { S.spin += dt * 14; ulAim(g2, _u2.set(Math.sin(S.spin), Math.cos(S.spin), 0).applyAxisAngle(_uUp, P.yaw)); }, onLand: plop });
  }
  return kind;
}
// a boomerang path back into his own face: out, round, and home onto his head -> BONK
function ulBoomerang(g, origin, dir, o = {}) {
  const side = kroll() < 0.5 ? -1 : 1, head = new THREE.Vector3();
  ulFlight({ mesh: g, pos: origin, vel: dir.clone().multiplyScalar(o.speed ?? 24).add(_u1.set(0, 1.5, 0)), life: 4, trailW: o.trailW ?? 0.3,
    steer(S, dt) {
      ulHead(head);
      if (S.t < (o.out ?? 0.45)) S.vel.multiplyScalar(Math.exp(-1.2 * dt)).applyAxisAngle(_uUp, side * (o.turn ?? 2.6) * dt);
      else { const want = _u2.copy(head).sub(S.pos), L = want.length(); want.multiplyScalar((o.home ?? 20) / Math.max(L, 0.01)); S.vel.lerp(want, 1 - Math.exp(-(o.k ?? 5) * dt)); if (L < 0.55) { ulBonk(S.pos); return false; } }
      return true;
    },
    orient: o.orient || ((g2, S) => ulAim(g2, S.vel)) });
}
// BONK: 0 damage, a gold flash, stars circling his head for a bit, the knees buckle
function ulBonk(at) {
  const h = ulHead(new THREE.Vector3());
  ulText(h, 'BONK!', '#ffd84a', true, 0.35);
  Sound.god('bonk', { gain: 1.0 }); Sound.voice('bonk', { priority: 3, cooldown: 2, gain: 1.1 });
  FX2.burst(h, 'ullrGold', { size: 0.35, sparks: 14, embers: 6, puffs: 0, bursts: 1, int: 0.8, light: true, distort: false });
  Game.anim.play('flinch');
  Cam.shake = Math.max(Cam.shake, 0.3);
  P.atkPenalty = Math.max(P.atkPenalty, 0.7);
  U.dizzy = 1.9;
  for (let i = 0; i < 5; i++) FX2.glow.spawn({ pos: h, life: 1.9, size: 0.15, sizeEnd: 0.1, cell: FXA.star, pal: 'ullrGold', temp: 1.0, tempEnd: 0.7, int: 1.7, fadeIn: 0.05, fadeOut: 0.8, rotVel: 4, orbit: { c: U.headC, r: 0.3, w: 5.5, y: 0.08, a: (i / 5) * TAU, wob: 0.03 } });
  if (at) ulShards(at, 4, 0.5);
}

// ---- basic attack: arrows in Bow stance, a three-chop axe combo in Axe stance ----------------
function ulBusy() { return !!(U.leap || (U.clown && !U.clown.ended) || (U.swap && U.swap.t < 0.35) || (U.drawing && U.drawing.big)); }
function ullrBasic() {
  if (ulBusy()) return;
  P.atkCd = 1 / attackSpeed();
  if (U.stance === 'bow') ulBowBasic(); else ulAxeBasic();
}
// the bow: he settles into a held aim (the aim layer eases in), looses, follows through and redraws; the aim
// is held for ~1 s after each shot so steady fire stays smooth, then it eases back out
function ulBowBasic() {
  const A = U.aimL, fresh = !A.on || A.w < 0.5, sp = Math.max(1, 0.6 / (P.atkCd * 0.95));
  const rel = (fresh ? 0.22 : 0.1) / sp;
  A.on = true; U.aimHold = UL_AIM.hold + rel;
  U.drawing = { t: 0, rel, big: false, t0: fresh ? UL_AIM.nock : UL_AIM.drawn };
  ulShowWeapons();
  P.atkPenalty = Math.min(0.35, P.atkCd * 0.6);
  Sound.god('bow_draw', { gain: 0.6, rate: rand(0.96, 1.06) * Math.min(1.4, sp) });
  VFX.later(rel, () => {
    if (Kit !== GODS.ullr || !U.drawing || U.drawing.big) return;
    U.drawing = null; U.relT = 0; ulShowWeapons();
    if (U.stance !== 'bow') return;
    const origin = ulBowOrigin(), dir = fwdOf(P.yaw);
    if (kroll() < UL_LUCK.arrow) ulFireArrow(origin, dir); else ulSillyArrow(origin, dir);
    Sound.god('arrow_release', { gain: 0.85, rate: rand(0.95, 1.05) });
    FX2.glow.spawn({ pos: origin, life: 0.12, size: 0.3, sizeEnd: 0.7, cell: FXA.flare, pal: 'ullr', temp: 0.9, tempEnd: 0.5, int: 1.2, fadeIn: 0 });
    if (Math.random() < 0.06) Sound.voice('eff', { cooldown: 6 });
  });
}
function ulAxeBasic() {
  if (U.comboT <= 0) U.combo = 0;
  const step = U.combo % 3; U.combo++; U.comboT = 1.6;
  const heavy = step === 2, sp = Math.max(1, (heavy ? 0.6 : 0.46) / (P.atkCd * 0.95));
  Game.anim.play(['chop1', 'chop2', 'chop3'][step], { speed: sp });
  P.atkPenalty = Math.min(0.3, P.atkCd * 0.45);
  Sound.god(`axe_swing${1 + step}`, { gain: 0.85, rate: rand(0.95, 1.05) });
  const pr = ulProps();
  ulPropTrail(step === 1 ? pr.axeL : pr.axeR, 0.32 / sp, 0.16);
  if (heavy) ulPropTrail(pr.axeL, 0.32 / sp, 0.16);
  VFX.later((heavy ? 0.3 : 0.2) / sp, () => {
    if (Kit !== GODS.ullr) return;
    const c = P.pos.clone(), dir = fwdOf(P.yaw);
    FX2.slash(V3(c.x, 1.2, c.z), P.yaw, 'ullr', { r0: 0.9, r1: 2.5, a0: step === 1 ? -1.3 : 1.3, a1: step === 1 ? 1.3 : -1.3, dur: 0.24, tilt: step === 1 ? 0.25 : -0.25, int: 1.4 });
    if (heavy) FX2.slash(V3(c.x, 1.0, c.z), P.yaw, 'ullrGold', { r0: 0.8, r1: 2.6, a0: -1.4, a1: 1.4, dur: 0.3, tilt: 0.6, int: 1.0 });
    const near = dummiesInCone(c, dir, UL_AXE_RANGE * SU * 1.1, heavy ? 0.95 : 0.8).sort((a, b) => a.pos.distanceToSquared(c) - b.pos.distanceToSquared(c));
    for (const d of heavy ? near : near.slice(0, 1)) {
      ulHit(d, 'basic', 'Thrown Axe');
      const hp = d.pos.clone().setY(1.1);
      ulBurst(hp, heavy ? 0.5 : 0.35, { distort: heavy, light: heavy });
      ulShards(hp, heavy ? 6 : 3, 0.5);
      Sound.god('axe_hit', { gain: 0.8, pos: d.pos, rate: rand(0.95, 1.08) });
    }
    if (heavy) { Cam.shake = Math.max(Cam.shake, 0.12); ulDust(c.clone().addScaledVector(dir, 1.4), 5, 0.8); }
    if (Math.random() < 0.06) Sound.voice('eff', { cooldown: 6 });
  });
}

// ---- BOW 1 · Bladed Arrow: a long draw, a huge rune arrow ... which usually misses ------------------
function castBladedArrow() {
  spend('ba'); startCd('ba');
  const rank = rankOf('ba');
  Sound.god('bow_draw', { gain: 1.0, rate: 0.85 });
  Sound.voice('a1', { chance: 0.75, cooldown: 6 });
  U.aimL.on = true; U.aimHold = UL_BA_RELEASE + 0.5;
  U.drawing = { t: 0, rel: UL_BA_RELEASE, big: true };
  ulShowWeapons();
  P.atkPenalty = UL_BA_RELEASE + 0.1;
  const nockAt = new THREE.Vector3(), bw0 = ulProps().bow;
  if (bw0 && bw0.visible) bw0.localToWorld(nockAt.copy(bw0.userData.nock)); else handPos('R', nockAt);
  U.drawing.charge = FX2.charge(nockAt, 'ullr', { dur: UL_BA_RELEASE, radius: 1.0, rate: 50, size: 0.7 });
  U.drawing.nockAt = nockAt;
  VFX.later(UL_BA_RELEASE, () => {
    if (Kit !== GODS.ullr) return;
    U.drawing = null; U.relT = 0; ulShowWeapons();
    const origin = ulBowOrigin(), dir = fwdOf(P.yaw), speed = 46;
    Sound.god('ba_release', { gain: 1.0 });
    VFX.flash(origin, UC.jade, 20, 0.3);
    PostFX.shock(origin.clone().addScaledVector(dir, 1.2), 0.3, 0.35);
    ulBurst(origin, 0.5, { distort: false });
    FX2.ring(P.pos.clone().setY(0), 'ullrRune', { radius: 2.0, dur: 0.4, width: 0.05 });
    Cam.shake = Math.max(Cam.shake, 0.1);
    const g = ulArrowMesh(2.6);
    ulAim(g, dir); g.position.copy(origin);
    if (kroll() >= UL_LUCK.bladed) {   // the miss: a U-turn into his own head, or it wanders off / plops short
      if (kroll() < UL_LUCK.bladedUturn) ulBoomerang(g, origin, dir, { speed: 30, out: 0.5, turn: 3.4, home: 18, trailW: 0.35 });
      else { ulDrop(g); ulSillyArrow(origin, dir, 2.6, kroll() < 0.5 ? 'curve' : 'short'); }
      return;
    }
    const trail = VFX.trail(0.5, UC.jade, 2.8, 22), helix = makeHelix(2, 0.3, 0.09, UC.gold, 2.2, 20);
    Combat.projectiles.push(new Projectile({
      kind: 'ability', pos: origin, dir, speed, radius: 0.55, pierce: false, maxDist: AB.ba.range * SU, glyphRange: 0,
      onMove(p, dt) {
        g.position.copy(p.pos); g.rotateY(dt * 9);
        trail.push(p.pos); helix.push(p.pos, p.dir, p.t);
        FX2.trailTick(p.pos, _u1.copy(p.dir).multiplyScalar(speed), 'ullr', dt, { k: 2.0, size: 1.2 });
        if (Math.random() < dt * 25) ulGoldSparks(p.pos, 1, 0.5);
      },
      onHit(d, hp) {
        ulHit(d, 'ability', 'Bladed Arrow');
        d.applyStun(AB.ba.stun[rank - 1]);
        ulBurst(hp, 0.9);
        ulShards(hp, 10, 0.9);
        VFX.flash(hp, UC.jade, 22, 0.3);
        PostFX.shock(hp, 0.4, 0.4);
        ulRuneCircle(d.pos, 2.4, 1.0, 1.3);
        Sound.god('ba_hit', { gain: 0.95, pos: hp });
        Cam.shake = Math.max(Cam.shake, 0.18);
      },
      onDie(p, at, hit) { trail.alive = false; helix.kill(); if (!hit) { ulBurst(at, 0.45, { distort: false }); ulMissText(at); } ulDrop(g); },
    }));
  });
}

// ---- BOW 2 · Expose Weakness: runes blaze along the bow, attack speed up (and a confidence boost) ----------
const UL_SILLY_BUFF = { ew: ['+1 confidence', '+2% aim (still bad)', '+1 swagger', 'aim: 3/10', '+0 accuracy'], iv: ['+0.5 speed', '+1 cardio', '+3 hype', '+1 hope', 'zoom (slightly)'] };
function castExposeWeakness() {
  spend('ew'); startCd('ew');
  U.ewRank = rankOf('ew'); U.ew = AB.ew.dur;
  Game.anim.play('expose');
  Sound.god('ew_buff', { gain: 1.0 });
  Sound.voice('a2', { chance: 0.7, cooldown: 6 });
  const c = P.pos.clone().setY(1.2);
  ulBurst(c, 0.65, { distort: false });
  FX2.ring(P.pos, 'ullrRune', { radius: 2.6, dur: 0.5, width: 0.06 });
  ulRuneCircle(P.pos, 3.2, 1.4, 1.5);
  U.auras.push(FX2.aura(P.pos, 'ullr', { radius: 0.85, height: 2.3, rate: 16, dur: AB.ew.dur }));
  FX2.light(P.pos.clone().setY(1.4), FX2.pal('ullr').light, 14, 0.5);
  ulText(P.pos.clone().setY(2.7), pick(UL_SILLY_BUFF.ew), '#ffd84a', true);
  const b = ulProps().bow; if (b) ulPropTrail(b, 0.6, 0.12, new THREE.Vector3(0, ULLR_BOW.half * 0.9, -0.08));
}

// ---- BOW 3 · Hail of Arrows: a volley into the sky that comes down ... mostly beside the circle -----------
const ulRain = { shaft: null, head: null, list: [], max: 220, m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) };
function ulRainInit() {
  if (ulRain.shaft) return;
  const M = ullrMats();
  const sg = new THREE.CylinderGeometry(0.008, 0.008, 0.9, 5); sg.translate(0, -0.45, 0);   // tip at the origin, shaft trailing up
  const hg = new THREE.OctahedronGeometry(1, 0); hg.scale(0.024, 0.075, 0.008);
  ulRain.shaft = new THREE.InstancedMesh(sg, M.yew, ulRain.max); ulRain.head = new THREE.InstancedMesh(hg, M.ice, ulRain.max);
  for (const m of [ulRain.shaft, ulRain.head]) { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
}
// o.self: aimed at his own feet (it follows him until it starts to fall)
function ulRainSpawn(target, delay, o = {}) {
  ulRainInit();
  if (ulRain.list.length >= ulRain.max) ulRain.list.shift();
  const from = V3(target.x + rand(-1.5, 1.5), 13 + rand(0, 2), target.z + rand(-1.5, 1.5));
  ulRain.list.push({ from, to: target.clone().setY(0.05), t: -delay, fall: UL_HAIL.fall * rand(0.9, 1.15), stuck: 0, done: false, self: !!o.self, onImpact: o.onImpact || null, ctx: Net.ctx });
}
function ulRainUpdate(dt) {
  if (!ulRain.shaft) return;
  const L = ulRain.list, m = ulRain.m, q = ulRain.q, s = ulRain.s;
  let n = 0;
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    a.t += dt;
    if (a.t < 0) { if (a.self) { const Q = a.ctx ? a.ctx.P : P; a.to.set(Q.pos.x + 0.35 * Math.sin(Q.yaw), 0.05, Q.pos.z + 0.35 * Math.cos(Q.yaw)); a.from.set(a.to.x + 0.6, 13, a.to.z + 0.4); } continue; }
    let p, dir;
    if (a.t < a.fall) { const k = a.t / a.fall; p = _u1.lerpVectors(a.from, a.to, k * k * 0.3 + k * 0.7); dir = _u2.copy(a.to).sub(a.from).normalize(); if (Math.random() < dt * 40) FX2.glow.spawn({ pos: p, vel: dir.clone().multiplyScalar(-4), life: 0.18, size: 0.12, sizeEnd: 0.02, cell: FXA.spark, stretch: 3, pal: 'ullr', temp: 1, tempEnd: 0.5, int: 1.6 }); }
    else {
      if (!a.done) { a.done = true; if (a.ctx) Net.run(a.ctx, () => { ulRainImpact(a.to); if (a.onImpact) a.onImpact(a); }); else { ulRainImpact(a.to); if (a.onImpact) a.onImpact(a); } }
      a.stuck += dt; p = a.to; dir = _u2.copy(a.to).sub(a.from).normalize();
      if (a.stuck > 1.6) continue;
    }
    const sink = a.done ? Math.min(0.25, a.stuck * 0.5) + smoothstep(1.2, 1.6, a.stuck) * 0.6 : 0;
    q.setFromUnitVectors(_uUp, _u3.copy(dir));   // +Y (the tip) leads, the shaft trails
    m.compose(_u3.copy(p).setY(p.y - sink), q, s);
    ulRain.shaft.setMatrixAt(n, m); ulRain.head.setMatrixAt(n, m); n++;
  }
  ulRain.list = L.filter((a) => a.stuck <= 1.6);
  ulRain.shaft.count = ulRain.head.count = n;
  ulRain.shaft.instanceMatrix.needsUpdate = true; ulRain.head.instanceMatrix.needsUpdate = true;
}
function ulRainImpact(p) {
  FX2.glow.spawn({ pos: p.clone().setY(0.1), life: 0.16, size: 0.25, sizeEnd: 0.6, cell: FXA.core, pal: 'ullr', temp: 0.9, tempEnd: 0.5, int: 1.3, fadeIn: 0 });
  for (let i = 0; i < 3; i++) FX2.glow.spawn({ pos: p.clone().setY(0.1), vel: V3(rand(-2, 2), rand(1.5, 3.5), rand(-2, 2)), life: rand(0.3, 0.5), size: 0.06, sizeEnd: 0.01, cell: FXA.spark, stretch: 2, pal: Math.random() < 0.4 ? 'ullrGold' : 'ullr', temp: 1.1, tempEnd: 0.5, int: 1.8, gravity: -9 });
  if (Math.random() < 0.35) FX2.smoke.spawn({ pos: p.clone().setY(0.15), vel: V3(rand(-0.5, 0.5), rand(0.3, 0.8), rand(-0.5, 0.5)), life: rand(0.7, 1.1), size: 0.25, sizeEnd: 0.9, frames: 16, pal: 'ullrDust', temp: 0.2, tempEnd: 0, int: 1, alpha: 0.5, drag: 2 });
}
// one of his own arrows lands right by his feet: EEP! a startled hop
function ulYelp() {
  if (Kit !== GODS.ullr) return;
  if (P.grounded && !P.flying && !U.leap) { P.vy = 4.6; P.grounded = false; }
  Sound.jump(); Sound.voice('yelp', { priority: 2, cooldown: 3 });
  ulText(ulHead(new THREE.Vector3()), 'EEP!', '#ffd84a', true, 0.2);
}
function castHail() {
  spend('hl'); startCd('hl');
  const c = groundTarget(AB.hl.range * SU, 3), R = AB.hl.radius * SU;
  Game.anim.play('volley');
  Sound.god('hail_cast', { gain: 1.0 });
  Sound.voice('a3', { chance: 0.7, cooldown: 6 });
  VFX.later(0.18, () => {
    const o = ulBowOrigin();
    for (let i = 0; i < 9; i++) { const s = V3(rand(-0.3, 0.3), 1, rand(-0.3, 0.3)).normalize().multiplyScalar(rand(26, 34)); FX2.glow.spawn({ pos: o, vel: s, life: 0.45, size: 0.14, sizeEnd: 0.05, cell: FXA.spark, stretch: 4, pal: i % 3 ? 'ullr' : 'ullrGold', temp: 1.1, tempEnd: 0.6, int: 2 }); }
    ulBurst(o, 0.4, { distort: false, light: false });
  });
  const H = { c, R, t: 0, wave: 0, victims: [], missed: new Set(), decal: ulRuneCircle(c, R * 2.3, UL_HAIL.waves[2] + 0.8, 1.1), loop: Sound.god('hail_rain', { gain: 0.8, dur: UL_HAIL.waves[2] + 0.4, delay: UL_HAIL.delay - 0.1, pos: c }) };
  FX2.ring(c, 'ullrRune', { radius: R + 0.4, dur: 0.6, width: 0.05 });
  // every wave: 18 arrows, most of them scattered AROUND the circle; a few go in
  UL_HAIL.waves.forEach((w, wi) => {
    for (let i = 0; i < 18; i++) { const a = rand(0, TAU), r = Math.random() < UL_HAIL.inside ? R * Math.sqrt(Math.random()) * 0.9 : R * rand(1.1, 2.4); ulRainSpawn(V3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r), w - UL_HAIL.fall + rand(-0.08, 0.08)); }
    // the lucky ones: about a third of the foes in the circle actually get an arrow on them this wave
    VFX.later(Math.max(0, w - UL_HAIL.fall - 0.02), () => {
      if (Kit !== GODS.ullr) return;
      H.victims[wi] = dummiesNear(H.c, H.R).filter(() => kroll() < UL_HAIL.victim);
      for (const d of H.victims[wi]) ulRainSpawn(d.pos.clone(), 0);
    });
    if (wi === UL_HAIL.selfWave) ulRainSpawn(P.pos.clone(), w - UL_HAIL.fall + 0.05, { self: true, onImpact: (a) => { if (Math.hypot(P.pos.x - a.to.x, P.pos.z - a.to.z) < 1.8) ulYelp(); } });
  });
  U.hails.push(H);
}
function updateHails(dt) {
  U.hails = U.hails.filter((H) => {
    H.t += dt;
    while (H.wave < UL_HAIL.waves.length && H.t >= UL_HAIL.waves[H.wave] + 0.04) {
      const vic = H.victims[H.wave] || [];
      H.wave++;
      Sound.god('hail_impact', { gain: 0.9, pos: H.c, rate: rand(0.95, 1.05) });
      FX2.ring(H.c, 'ullr', { radius: H.R + 0.6, dur: 0.4, width: 0.05, int: 1.0 });
      ulDust(H.c, 6, 1.4);
      for (const d of dummiesNear(H.c, H.R + 1)) {
        if (vic.includes(d)) { ulHit(d, 'ability', 'Hail of Arrows'); d.slowed(AB.hl.slow, AB.hl.slowDur); ulShards(d.pos.clone().setY(1.0), 3, 0.5); }
        else if (!H.missed.has(d) && Math.hypot(d.pos.x - H.c.x, d.pos.z - H.c.z) <= H.R) { H.missed.add(d); ulMissText(d.pos.clone().setY(d.height)); }
      }
    }
    return H.t < UL_HAIL.waves[UL_HAIL.waves.length - 1] + 0.5;
  });
}

// ---- AXE 1 · Thrown Axe: wild throws, boomerangs into his own face, and now and then a stun ----------
function castThrownAxe() {
  spend('ta'); startCd('ta');
  const rank = rankOf('ta');
  Game.anim.play('axethrow');
  Sound.voice('axe_scream', { priority: 3, gain: 1.15, cooldown: 0, hold: 1.2 });
  ulPropTrail(ulProps().axeR, 0.2, 0.2);
  VFX.later(0.17, () => {
    if (Kit !== GODS.ullr) return;
    U.axeBack = 0.9; ulShowWeapons();
    const origin = aimOrigin().add(_u1.set(0, 0.2, 0)), dir = fwdOf(P.yaw), speed = 34;
    const g = makeUllrAxe(1.9); scene.add(g); g.position.copy(origin);
    Sound.god('axe_throw', { gain: 1.0 });
    ulBurst(origin, 0.35, { distort: false, light: false });
    const tumble = (g2, S) => { g2.lookAt(_u5.copy(S.pos).add(_u6.set(S.vel.x, 0, S.vel.z))); g2.rotateX(S.t * 24); };
    const roll = kroll();
    if (roll >= UL_LUCK.axe) {
      if (kroll() < UL_LUCK.axeBoomerang) { ulBoomerang(g, origin, dir, { speed: 22, out: 0.55, turn: 3.0, home: 19, trailW: 0.4, orient: tumble }); return; }
      // wild: way off to the side, up in an arc, and thunk into the floor somewhere silly
      const d = dir.clone().applyAxisAngle(_uUp, (kroll() < 0.5 ? -1 : 1) * rand(0.6, 1.05)).multiplyScalar(rand(16, 20)).add(_u1.set(0, rand(5, 7.5), 0));
      ulFlight({ mesh: g, pos: origin, vel: d, gravity: -14, trailW: 0.4, orient: tumble, onLand(S, g2) { Sound.god('axe_thunk', { gain: 0.9, pos: S.pos }); ulDust(S.pos, 6, 0.8); ulMissText(S.pos); g2.position.y = 0.32; } });
      return;
    }
    const target = new THREE.Vector3(), tipW = new THREE.Vector3();
    const trail = VFX.trail(0.42, UC.jade, 2.6, 18), spiral = VFX.trail(0.12, UC.gold, 2.2, 22);
    Combat.projectiles.push(new Projectile({
      kind: 'ability', pos: origin, dir, speed, radius: 0.6, pierce: false, maxDist: AB.ta.range * SU, glyphRange: 0,
      onMove(p, dt) {
        g.position.copy(p.pos); g.lookAt(target.copy(p.pos).add(p.dir)); g.rotateX(p.t * 24);
        g.localToWorld(tipW.copy(g.userData.tip));
        trail.push(p.pos); spiral.push(tipW);
        FX2.trailTick(p.pos, _u1.copy(p.dir).multiplyScalar(speed), 'ullr', dt, { k: 1.5, size: 1.0 });
      },
      onHit(d, hp) {
        ulHit(d, 'ability', 'Thrown Axe');
        d.applyStun(AB.ta.stun[rank - 1]);
        ulBurst(hp, 0.8);
        ulShards(hp, 8, 0.9);
        VFX.flash(hp, UC.jade, 20, 0.3);
        Sound.god('axe_hit', { gain: 1.0, pos: hp, rate: 0.9 });
        Cam.shake = Math.max(Cam.shake, 0.16);
      },
      onDie(p, at, hit) { trail.alive = false; spiral.alive = false; if (!hit) { ulBurst(at, 0.4, { distort: false }); ulMissText(at); } ulDrop(g); },
    }));
  });
}

// ---- AXE 2 · Invigorate: a war cry - movement speed and mana --------------------------------------
function castInvigorate() {
  spend('iv'); startCd('iv');
  U.ivRank = rankOf('iv'); U.iv = AB.iv.dur;
  Game.anim.play('invig');
  Sound.god('iv_buff', { gain: 1.0 });
  Sound.voice('a2', { chance: 0.7, cooldown: 6 });
  const c = P.pos.clone().setY(1.5);
  FX2.burst(c, 'ullrRune', { size: 0.65, sparks: 22, embers: 14, puffs: 2, bursts: 1, int: 0.8, distort: true, smokeGlow: 0.5 });
  ulGoldSparks(c, 14, 1);
  FX2.ring(P.pos, 'ullr', { radius: 3.2, dur: 0.55, width: 0.06 });
  FX2.distort.ring(c, 8, 0.02, 0.5);
  ulDust(P.pos, 8, 1.2);
  U.auras.push(FX2.aura(P.pos, 'ullrRune', { radius: 0.8, height: 2.0, rate: 14, dur: AB.iv.dur, dir: 1 }));
  ulText(P.pos.clone().setY(2.7), pick(UL_SILLY_BUFF.iv), '#ffd84a', true);
  Cam.shake = Math.max(Cam.shake, 0.15);
}

// ---- AXE 3 · Glory Bound: a crouch, a leap with the axes high ... and a landing that rarely sticks ---------
function castGloryBound() {
  spend('gb'); startCd('gb');
  const to = groundTarget(AB.gb.range * SU, 3), from = P.pos.clone().setY(0), dist = from.distanceTo(to);
  Game.anim.play('leap');
  Sound.voice('a3', { chance: 0.7, cooldown: 6 });
  const r = kroll(), land = r < UL_LUCK.gbClean ? 'clean' : r < UL_LUCK.gbClean + UL_LUCK.gbFaceplant ? 'faceplant' : 'stumble';
  U.leap = { from, to, t: 0, phase: 'crouch', height: 2.0 + dist * 0.08, rank: rankOf('gb'), trail: null, at: new THREE.Vector3(), land, yaw: P.yaw };
  P.vel.set(0, 0, 0);
  Game.thoth.root.rotation.order = 'YXZ';
}
function ulUpdateLeap(dt) {
  const L = U.leap; if (!L) return false;
  L.t += dt; P.vel.set(0, 0, 0);
  const root = Game.thoth.root;
  if (L.phase === 'crouch') {   // the anticipation: he sinks into the crouch, then springs
    if (L.t >= UL_LEAP.crouch) {
      L.phase = 'air'; L.t = 0; P.flying = true; P.grounded = false;
      L.trail = VFX.trail(0.6, UC.jade, 2.2, 20);
      Sound.god('leap', { gain: 1.0 });
      ulDust(L.from, 10, 1.2); FX2.ring(L.from, 'ullrDust', { radius: 2.2, dur: 0.4, int: 0.8 });
      const pr = ulProps(); ulPropTrail(pr.axeR, UL_LEAP.air, 0.2); ulPropTrail(pr.axeL, UL_LEAP.air, 0.2);
    }
    return true;
  }
  if (L.phase === 'air') {
    const k = clamp(L.t / UL_LEAP.air, 0, 1), e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    P.pos.set(lerp(L.from.x, L.to.x, e), 0, lerp(L.from.z, L.to.z, e));
    P.y = 4 * L.height * k * (1 - k);   // a true parabola: fast up, hang, fast down
    L.at.set(P.pos.x, P.y + 1.2, P.pos.z);
    L.trail.push(L.at);
    FX2.trailTick(L.at, null, 'ullr', dt, { k: 1.4, size: 1.2 });
    if (k >= 1) { L.trail.alive = false; P.y = 0; P.flying = false; P.grounded = true; ulLand(L); L.phase = L.land; L.t = 0; L.slideFrom = P.pos.clone(); if (L.land === 'clean') { U.leap = null; } }
    return true;
  }
  const f = fwdOf(L.yaw, _u7);
  if (L.phase === 'stumble') {   // he over-rotates: a lurch forward, a little skid, catches himself
    const D = 0.6, k = clamp(L.t / D, 0, 1);
    root.rotation.x = 0.42 * Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - k * 0.2);
    P.pos.copy(L.slideFrom).addScaledVector(f, 0.9 * easeOutCubic(k));
    if (Math.random() < dt * 20 && k < 0.7) ulDust(P.pos, 1, 0.6);
    if (k >= 1) { root.rotation.x = 0; U.leap = null; }
    return true;
  }
  // faceplant: he topples forward like a plank, lies there a moment, and pushes himself back up
  const fall = 0.3, lie = 0.45, up = 0.5;
  if (L.t < fall) { const k = L.t / fall; root.rotation.x = 1.42 * k * k; }
  else if (L.t < fall + lie) {
    if (!L.planted) { L.planted = true; ulFaceplantFx(f); }
    const k = (L.t - fall) / lie; root.rotation.x = 1.42 - 0.05 * Math.sin(k * Math.PI * 3) * (1 - k);
  } else { const k = clamp((L.t - fall - lie) / up, 0, 1); root.rotation.x = 1.42 * (1 - k * k * (3 - 2 * k)); if (k >= 1) { root.rotation.x = 0; U.leap = null; } }
  return true;
}
function ulFaceplantFx(f) {
  const face = P.pos.clone().addScaledVector(f, 1.9);
  Sound.god('faceplant', { gain: 1.0, pos: face });
  Sound.voice('oof', { priority: 3, cooldown: 1 });
  Cam.shake = Math.max(Cam.shake, 0.35);
  ulDust(face, 10, 1.1);
  ulText(face.clone().setY(1.2), 'FACEPLANT!', '#ffd84a', true);
  for (let i = 0; i < 4; i++) FX2.glow.spawn({ pos: face.clone().setY(0.5), life: 1.2, size: 0.13, sizeEnd: 0.08, cell: FXA.star, pal: 'ullrGold', temp: 1, tempEnd: 0.6, int: 1.6, orbit: { c: face, r: 0.3, w: 5, y: 0.5, a: (i / 4) * TAU } });
}
function ulLand(L) {
  const at = L.to, R = AB.gb.radius * SU;
  Sound.god('leap_land', { gain: 1.1, pos: at });
  Game.hitStop(0.05, 0.2);
  Cam.shake = Math.max(Cam.shake, 0.5); Cam.fovKick = 4;
  PostFX.shock(at.clone().setY(0.5), 0.5, 0.5);
  FX2.impact(at, 'ullr', { size: 1.1, ring: (R + 1) / 1.1, sparks: 36, debris: 12, dustPal: 'ullrDust', dustGlow: 0.15, int: 0.85, glowRocks: true });
  ulGoldSparks(at.clone().setY(0.5), 18, 1.2);
  FX2.ring(at, 'ullrRune', { radius: R + 2, dur: 0.6, width: 0.05 });
  VFX.cracks(at, R * 0.9, 2.6, { grow: 0.15, intensity: 1.2, color: UC.jade });
  FX2.scorch(at, 'ullr', { radius: R * 0.8, dur: 3, int: 0.7, dark: UC.dark, darkAlpha: 0.5 });
  ulRuneCircle(at, R * 2.2, 1.6, 1.3);
  if (L.land === 'stumble') { Sound.god('slip', { gain: 0.9, pos: at }); Sound.voice('oof', { chance: 0.6, priority: 2, cooldown: 2 }); ulText(ulHead(new THREE.Vector3()), 'OOPS!', '#ffd84a', true, 0.2); }
  for (const d of dummiesNear(at, R)) {
    ulHit(d, 'ability', 'Glory Bound');
    if (kroll() < UL_LUCK.gbStun) d.applyStun(AB.gb.stun[L.rank - 1]);
    else ulText(d.pos.clone().setY(d.height + 0.2), 'NO STUN', '#d6ff5a');
    ulBurst(d.pos.clone().setY(1.0), 0.45, { distort: false, light: false });
  }
}

// ---- 4 · Wield Axes / Wield Bow: a spin, the weapons trade places in a flash of emerald ------------
function ulSetStance(s) {
  U.stance = s;
  const K = GODS.ullr;
  K.order = UL_ORDER[s].slice();
  if (Kit === K) {
    ABILITY_ORDER = K.order.slice();
    if (P.targeting && !ABILITY_ORDER.includes(P.targeting)) P.targeting = null;
    if (HUD.els && HUD.els.abilities) HUD.rebuild();
    updateGodUI();
  }
  if (s !== 'bow' && U.aimL) U.aimL.on = false;
  ulShowWeapons();
}
function castWield() {
  startCd('ws');
  const to = U.stance === 'bow' ? 'axe' : 'bow';
  Game.anim.play('swap');
  Sound.god('stance_swap', { gain: 1.0 });
  Sound.voice('stance', { chance: 0.85, cooldown: 3 });
  U.swap = { t: 0, to, done: false };
  ulSetStance(to);   // the new kit is live at once; the old weapons shrink away now, the new ones grow in mid-spin
  FX2.ring(P.pos, 'ullrRune', { radius: 2.4, dur: 0.45, width: 0.06 });
  ulRuneCircle(P.pos, 2.8, 1.0, 1.3);
}
function updateSwap(dt) {
  const S = U.swap; if (!S) return;
  S.t += dt;
  if (!S.done && S.t >= 0.3) {
    S.done = true; ulShowWeapons();
    for (const side of ['R', 'L']) { const h = handPos(side, new THREE.Vector3()); ulBurst(h, 0.3, { distort: false, light: false }); }
    VFX.flash(P.pos.clone().setY(1.3), UC.jade, 12, 0.3);
    if (S.to === 'axe') { const pr = ulProps(); ulPropTrail(pr.axeR, 0.4, 0.18); ulPropTrail(pr.axeL, 0.4, 0.18); }
  }
  if (S.t > 0.9) U.swap = null;
}

// ---- 5 · BOWELIUS THE CLOWN ----------------------------------------------------------------
// Confetti: real little paper squares (instanced), tumbling and fluttering down
const UL_CONF_COLS = [0xff2a4a, 0xffc21a, 0x2a8aff, 0x2ad46a, 0xff5ad8, 0x9a5aff, 0xff8a1a, 0x2ae0e0].map((c) => new THREE.Color(c));
const ulConf = { mesh: null, list: [], max: 1400, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3() };
function ulConfInit() {
  if (ulConf.mesh) return;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.075, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), ulConf.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < ulConf.max; i++) mesh.setColorAt(i, UL_CONF_COLS[i % UL_CONF_COLS.length]);
  mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 9; scene.add(mesh);
  ulConf.mesh = mesh;
}
function ulConfetti(p, n, speed = 5, up = 4, spread = 0.2) {
  ulConfInit();
  for (let i = 0; i < n; i++) {
    if (ulConf.list.length >= ulConf.max) ulConf.list.shift();
    const a = rand(0, TAU), s = rand(0.3, 1) * speed;
    ulConf.list.push({ p: V3(p.x + rand(-spread, spread), p.y + rand(-spread, spread), p.z + rand(-spread, spread)), v: V3(Math.cos(a) * s, rand(0.4, 1) * up, Math.sin(a) * s), r: V3(rand(0, TAU), rand(0, TAU), rand(0, TAU)), w: V3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), life: 0, max: rand(2.2, 3.6), col: Math.floor(Math.random() * UL_CONF_COLS.length), ph: rand(0, TAU), size: rand(0.8, 1.3), ctx: Net.ctx });
  }
}
function ulConfUpdate(dt) {
  if (!ulConf.mesh) return;
  const L = ulConf.list, M = ulConf.mesh;
  let n = 0;
  for (const c of L) {
    c.life += dt;
    if (c.life >= c.max) continue;
    if (c.p.y > 0.03) {
      c.v.y -= 6.5 * dt; const drag = Math.exp(-2.4 * dt); c.v.x *= drag; c.v.z *= drag; c.v.y = Math.max(c.v.y * Math.exp(-1.2 * dt), -1.6);   // paper: falls slowly
      c.p.addScaledVector(c.v, dt);
      c.p.x += Math.sin(c.life * 6 + c.ph) * 0.5 * dt; c.p.z += Math.cos(c.life * 5 + c.ph) * 0.5 * dt;   // flutter
      c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
      if (c.p.y <= 0.03) { c.p.y = 0.03; c.r.x = -Math.PI / 2; c.r.z = 0; }   // settles flat on the floor
    }
    const k = 1 - smoothstep(c.max - 0.5, c.max, c.life);
    ulConf.e.set(c.r.x, c.r.y, c.r.z); ulConf.q.setFromEuler(ulConf.e); ulConf.s.setScalar(c.size * k);
    ulConf.m.compose(c.p, ulConf.q, ulConf.s);
    M.setMatrixAt(n, ulConf.m); M.setColorAt(n, UL_CONF_COLS[c.col]); n++;
  }
  ulConf.list = L.filter((c) => c.life < c.max);
  M.count = n; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
}
// party balloons on strings, drifting slowly round him high up (gentle, never a vortex)
function ulBalloon(col) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.18, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, emissive: col.clone().multiplyScalar(0.28), sheen: 0.3 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), mat); b.scale.set(1, 1.22, 1); g.add(b);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 8), mat); knot.position.y = -0.38; knot.rotation.x = Math.PI; g.add(knot);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.1, 4), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })); str.position.y = -0.95; g.add(str);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}
// his clown rig (assets/ullr_clown, its own Meshy rig + the two dance clips), built once and swapped in
function ulClownRig() {
  if (!U.clownR && Assets.glb.ullr_clown) {
    const rig = Net.ctx ? cloneGodRig(Assets.glb.ullr_clown, 'ullr_clown', Assets.rest.ullr_clown) : new GodRig(Assets.glb.ullr_clown, 'ullr_clown');   // (another player's Ullr: a copy; 14n_net.js)
    rig.root.visible = false; (Net.ctx ? Net.ctx.actor.parent : scene).add(rig.root);
    const anim = new RigAnimator(rig, null);
    anim.onStep = (p) => { if (Game.mode === 'play') Sound.step(p); };
    U.clownR = { rig, anim };
  }
  return U.clownR;
}
function ulSwapForm(toClown) {
  const R = toClown ? ulClownRig() : U.home;
  if (!R || !Game.thoth || Game.thoth === R.rig) return false;
  const from = Game.thoth;
  R.rig.root.position.copy(from.root.position); R.rig.root.rotation.y = from.root.rotation.y; R.rig.root.visible = true;
  from.root.visible = false;
  Object.assign(R.anim, { actions: [], channelTarget: 0, channel: 0, liftTarget: 0, extraLift: 0, firstFrame: true });
  R.anim.post = toClown ? ulLDance : null; R.anim.noGlance = !!toClown;
  Game.thoth = R.rig; Game.anim = R.anim;
  return true;
}
// ---- the "take the L" dance, authored procedurally on top of the clown's idle (RigAnimator.post):
// the left hand up on his forehead in an L (a big foam glove: index finger up, thumb out to his left, so it reads
// as an L from the front), hopping from foot to foot at 2 beats a second with the free leg kicking out to the
// side, leaning back, head cocked, the right arm pumping. World-space bone turns + two-bone IK, so it is
// independent of the Meshy rig's bone axes.
const UL_LDANCE = { hz: 1.0, kick: 0.62, hop: 0.075, shift: 0.05, lean: 0.14, fh: [21, 19], palmAxis: new THREE.Vector3(1, 0, 0) };
function ulLGlove() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.55, emissive: new THREE.Color(0.12, 0.12, 0.1), emissiveIntensity: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe0202a, roughness: 0.4, emissive: new THREE.Color(0.25, 0.0, 0.02) });
  // local: +X = his left, +Y = up, +Z = out of his face toward the viewer
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.055, 2, 2, 2), white); palm.position.set(0, 0.06, 0.02); g.add(palm);
  const index = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.13, 6, 10), white); index.position.set(-0.03, 0.2, 0.02); g.add(index);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.08, 6, 10), white); thumb.rotation.z = -Math.PI / 2; thumb.position.set(0.1, 0.07, 0.02); g.add(thumb);
  for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), white); k.position.set(0.0 + i * 0.03, 0.115, 0.045); g.add(k); }   // the curled fingers
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.018, 8, 18), red); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.005; g.add(cuff);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.visible = false; scene.add(g);
  return g;
}
function ulLDance(rig, dt, anim) {
  const C = U.clown; if (!C) { rig.body.position.x = 0; return; }
  const w = smoothstep(0, 0.35, C.t) * (C.ended ? 0 : 1 - smoothstep(UL_FIN.dur - 0.3, UL_FIN.dur, C.t));
  if (C.glove) C.glove.visible = w > 0.02;
  if (w < 0.001) { rig.body.position.x = 0; return; }
  const D = UL_LDANCE, yaw = rig.root.rotation.y;
  const fwd = _u1.set(Math.sin(yaw), 0, Math.cos(yaw)), left = _u2.set(Math.cos(yaw), 0, -Math.sin(yaw)), right = _u3.copy(left).negate(), up = _uUp;
  const ph = C.t * TAU * D.hz, s = Math.sin(ph), kL = Math.pow(Math.max(0, s), 0.7), kR = Math.pow(Math.max(0, -s), 0.7), hop = Math.abs(s);
  // 1. the hop, and the weight onto the standing foot (body local +x = his left)
  rig.body.position.y += w * D.hop * hop * hop;
  rig.body.position.x = w * D.shift * (kR - kL);   // (the animator never writes x: assign, don't accumulate)
  rig.root.updateMatrixWorld(true);
  const turn = (name, axis, a) => { if (Math.abs(a) < 1e-5) return; const b = rig.b(name); rotateBoneWorld(b, axis, a); b.updateMatrixWorld(true); };
  // 2. smug: lean back, sway with the hop, head cocked and nodding on the beat
  turn('Spine02', right, w * (D.lean + 0.04 * hop));
  turn('Spine01', fwd, w * 0.07 * (kR - kL));
  turn('Head', fwd, -w * 0.14);
  turn('Head', right, -w * 0.09 * Math.sin(ph * 2));
  // 3. the legs: the free leg swings out to the side (and a touch forward), the knee bends a little
  for (const [u, l, k, sd] of [['LeftUpLeg', 'LeftLeg', kL, 1], ['RightUpLeg', 'RightLeg', kR, -1]]) {
    if (k < 1e-3) continue;
    turn(u, fwd, sd * w * k * D.kick); turn(u, right, w * k * 0.22);
    turn(l, right, -w * k * 0.4);
  }
  // 4. the right arm pumps to the beat
  turn('RightArm', fwd, -w * (0.3 + 0.25 * hop));
  turn('RightForeArm', right, w * (0.5 + 0.3 * hop));
  // 5. the left hand up onto the forehead: two-bone IK, fingers up, palm toward his face
  const head = rig.b('Head');
  const fh = head.localToWorld(_u4.set(0, D.fh[0], D.fh[1]));
  const target = _u5.copy(fh).addScaledVector(left, 0.07).addScaledVector(up, -0.07).addScaledVector(fwd, 0.06);
  const pole = _u6.copy(left).addScaledVector(up, 0.35).addScaledVector(fwd, -0.3);
  const arm = rig.b('LeftArm'), fore = rig.b('LeftForeArm'), hand = rig.b('LeftHand');
  solveTwoBoneIK(arm, fore, hand, target, pole, w); solveTwoBoneIK(arm, fore, hand, target, pole, w);
  const fing = _u7.copy(up).addScaledVector(fwd, -0.12).normalize(), palm = _u8.copy(fwd).negate();
  palm.addScaledVector(fing, -palm.dot(fing)).normalize();
  orientBoneWorld(hand, fing, palm, D.palmAxis, w, U.handMemo || (U.handMemo = { q: new THREE.Quaternion(), f: -9 }), anim.frameNo);
  hand.updateMatrixWorld(true);
  // 6. the foam L glove over that hand
  const G = C.glove;
  if (G) {
    hand.getWorldPosition(G.position).addScaledVector(fwd, 0.03);
    G.quaternion.setFromRotationMatrix(_uM.makeBasis(left, up, fwd));
    G.scale.setScalar(Math.max(0.001, easeOutBack(w)));
  }
}
// the poof: smoke, a flash, confetti everywhere
function ulPoof(c, s = 1) {
  const p = c.clone().setY(1.2);
  VFX.flash(p, new THREE.Color(1.0, 0.6, 0.8), 26 * s, 0.4);
  PostFX.shock(p, 0.6 * s, 0.5);
  Cam.shake = Math.max(Cam.shake, 0.35 * s);
  UL_PARTY.forEach((pal, i) => FX2.burst(p.clone().add(V3(rand(-0.3, 0.3), rand(-0.2, 0.4), rand(-0.3, 0.3))), pal, { size: 0.65 * s, sparks: 16, embers: 10, puffs: 0, bursts: i < 2 ? 1 : 0, int: 0.75, light: i === 0, distort: i === 0 }));
  for (let i = 0; i < 26 * s; i++) { const a = rand(0, TAU); FX2.smoke.spawn({ pos: V3(c.x + Math.cos(a) * 0.4, rand(0.3, 2.0), c.z + Math.sin(a) * 0.4), vel: V3(Math.cos(a) * rand(1.5, 4), rand(0.2, 1.5), Math.sin(a) * rand(1.5, 4)), life: rand(1.0, 1.6), size: 0.6, sizeEnd: rand(2.0, 2.8), frames: 16, pal: pick(UL_PARTY), temp: 0.12, tempEnd: 0, int: 1, alpha: 0.7, drag: 2.6, turb: 0.6, fadeIn: 0.02 }); }
  for (let i = 0; i < 10; i++) FX2.glow.spawn({ pos: p, vel: V3(rand(-4, 4), rand(1, 5), rand(-4, 4)), life: rand(0.6, 1.0), size: rand(0.14, 0.24), sizeEnd: 0.04, cell: FXA.star, pal: pick(UL_PARTY), temp: 1, tempEnd: 0.5, int: 1.7, drag: 2, rotVel: rand(-6, 6) });
  ulConfetti(p, Math.round(240 * s), 6, 6, 0.3);
}
function castClown() {
  spend('bw'); startCd('bw');
  const C = U.clown = { t: 0, acc: 0, ticks: 0, honkT: 0.35, ended: false, endT: 0, danceI: 0, balloons: [], rainAcc: 0, swapped: false };
  P.targeting = null; U.drawing = null; ulShowWeapons();
  Sound.god('clown_poof', { gain: 1.15 });
  // "Bowelius, Bowelius, Bowelius... Ullr is the worst god in the game! Ha-ha-ha, HA-HA-HA!" (~5-6 s)
  Sound.voice('fin_roar', { priority: 6, gain: 1.2, cooldown: 0, hold: 5.6 });
  // after the chant: a clown taunt, then one more cackle before he turns back
  VFX.later(5.65, () => { if (U.clown === C && !C.ended) Sound.voice('clown_taunt', { priority: 6, gain: 1.15, cooldown: 0, hold: 4.5 }); });
  VFX.later(UL_FIN.dur - 0.2, () => { if (U.clown === C) Sound.voice('clown_laugh', { priority: 6, gain: 1.05, cooldown: 0, hold: 2.2 }); });
  Sound.duckMusic(0.2, UL_FIN.dur, 1.6);
  C.music = Sound.god('clown_music', { gain: 0.75, loop: true, delay: 0.3 });
  ulPoof(P.pos, 1.3);
  C.glove = ulLGlove();
  C.swapped = ulSwapForm(true);
  if (!C.swapped) Game.anim.play('roar');
  if (U.aimL) U.aimL.on = false;
  Cam.frameTarget = 0.8; PostFX.vigTarget = 0.25;
  // seven balloons float up out of the poof
  UL_CONF_COLS.slice(0, 7).forEach((col, i) => {
    const g = ulBalloon(col);
    const a = (i / 7) * TAU;
    g.position.set(P.pos.x, 1.2, P.pos.z);
    C.balloons.push({ g, a, r: rand(2.2, 2.9), y: rand(2.7, 3.6), w: 0.55, ph: rand(0, TAU), rise: 0 });
  });
}
function updateClown(dt, t) {
  const C = U.clown; if (!C) return;
  C.t += dt;
  const c = P.pos;
  // now and then a big "L" floats up off him
  if (!C.ended && C.swapped) { C.lT = (C.lT ?? 0.8) - dt; if (C.lT <= 0) { C.lT = rand(1.1, 1.6); ulText(c.clone().setY(3.0), 'L', pick(['#7dff5a', '#ffc21a', '#ff5ad8', '#2ae0e0']), true); } }
  // balloons drift round him, bobbing; they rise out of the poof first
  for (const B of C.balloons) {
    B.rise = Math.min(1, B.rise + dt * 1.6); B.a += B.w * dt * (C.ended ? 0 : 1);
    const e = easeOutCubic(B.rise), bob = Math.sin(t * 2.2 + B.ph) * 0.12;
    B.g.position.set(lerp(c.x, c.x + Math.cos(B.a) * B.r, e), lerp(1.2, B.y + bob, e), lerp(c.z, c.z + Math.sin(B.a) * B.r, e));
    B.g.rotation.set(Math.sin(t * 1.7 + B.ph) * 0.12, B.a, Math.cos(t * 1.3 + B.ph) * 0.12);
  }
  if (!C.ended) {
    // confetti keeps drifting down over the whole 6 m circle
    C.rainAcc += dt * 70;
    while (C.rainAcc > 1) { C.rainAcc--; const a = rand(0, TAU), r = UL_FIN.radius * Math.sqrt(Math.random()); ulConfetti(V3(c.x + Math.cos(a) * r, rand(3.5, 5), c.z + Math.sin(a) * r), 1, 0.4, 0.2, 0); }
    if (Math.random() < dt * 8) FX2.glow.spawn({ pos: V3(c.x + rand(-1, 1), rand(0.4, 2.4), c.z + rand(-1, 1)), vel: V3(rand(-0.5, 0.5), rand(0.4, 1.2), rand(-0.5, 0.5)), life: rand(0.6, 1.0), size: rand(0.1, 0.18), sizeEnd: 0.03, cell: FXA.star, pal: pick(UL_PARTY), temp: 1, tempEnd: 0.5, int: 1.6, rotVel: rand(-4, 4) });
    // the pulse: every 0.5 s a honk-wave of confetti does exactly 1 damage to everything within 6 m
    C.acc += dt;
    while (C.acc >= UL_FIN.tick) {
      C.acc -= UL_FIN.tick; C.ticks++;
      const pal = UL_PARTY[C.ticks % UL_PARTY.length];
      FX2.ring(c.clone().setY(0), pal, { radius: UL_FIN.radius + 0.4, dur: 0.45, width: 0.045, int: 1.2 });
      ulConfetti(c.clone().setY(1.4), 36, 5.5, 3.5, 0.3);
      for (const d of dummiesNear(c, UL_FIN.radius)) {
        ulHit(d, 'final', 'Bowelius the Clown');
        const hp = d.pos.clone().setY(d.height * 0.7 + d.lift);
        FX2.burst(hp, pal, { size: 0.35, sparks: 10, embers: 6, puffs: 0, bursts: 0, int: 0.8, light: false, distort: false });
        ulConfetti(hp, 14, 3, 3, 0.2);
      }
    }
    // the honks (and a floating HONK! now and then)
    C.honkT -= dt;
    if (C.honkT <= 0) {
      C.honkT = rand(0.55, 1.1);
      Sound.god('clown_honk', { gain: 0.9, rate: rand(0.88, 1.15) });
      if (Math.random() < 0.6) Combat.texts.push({ x: c.x + rand(-0.6, 0.6), y: 2.9, z: c.z + rand(-0.6, 0.6), text: 'HONK!', color: pick(['#ff5ad8', '#ffc21a', '#2ae0e0', '#7dff5a', '#ff8a1a']), t: 0, big: false });
    }
    Cam.shake = Math.max(Cam.shake, 0.03);
    if (C.t >= UL_FIN.dur) ulClownEnd(C);
  } else {
    C.endT += dt;
    if (C.endT > 0.6) U.clown = null;
  }
}
function ulClownEnd(C) {
  C.ended = true;
  Sound.god('clown_end', { gain: 1.05 });
  if (C.music) C.music.stop(0.4);
  ulPoof(P.pos, 1.0);
  ulSwapForm(false);
  if (C.glove) { ulDrop(C.glove); C.glove = null; }
  ulShowWeapons();
  Game.anim.play('roar');
  VFX.later(2.3, () => Sound.voice('loser', { priority: 3, cooldown: 0 }));   // after the last cackle
  // the balloons pop
  C.balloons.forEach((B, i) => VFX.later(0.05 + i * 0.07, () => {
    const p = B.g.position.clone();
    Sound.god('balloon_pop', { gain: 0.7, pos: p, rate: rand(0.9, 1.2) });
    ulConfetti(p, 40, 3, 2, 0.15);
    FX2.glow.spawn({ pos: p, life: 0.15, size: 0.3, sizeEnd: 1.0, cell: FXA.ring, pal: pick(UL_PARTY), temp: 1, tempEnd: 0.4, int: 1.6, fadeIn: 0 });
    disposeGroup(B.g);
  }));
  C.balloons = [];
  Cam.frameTarget = 0; PostFX.vigTarget = 0;
}
function ulClownCleanup() {
  const C = U.clown; if (!C) return;
  if (C.music) C.music.stop(0.15);
  if (C.glove) { ulDrop(C.glove); C.glove = null; }
  for (const B of C.balloons) disposeGroup(B.g);
  C.balloons = [];
  ulSwapForm(false);
  U.clown = null;
}

// ---- passive: "I am the worst god in SMITE! Bowelius, HELP ME!" every 10 s -------------------------
function ulBubbleTexture(text) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 230;
  const g = c.getContext('2d');
  g.font = '700 46px Rajdhani, system-ui, sans-serif';
  // wrap into two lines at the word nearest the middle
  const words = text.split(' '); let best = 1, bd = 1e9;
  for (let i = 1; i < words.length; i++) { const d = Math.abs(g.measureText(words.slice(0, i).join(' ')).width - g.measureText(words.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
  const lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  const w = Math.min(740, Math.max(...lines.map((l) => g.measureText(l).width)) + 70), h = 150, x = (768 - w) / 2, y = 8, r = 34;
  g.fillStyle = 'rgba(4,22,12,0.9)'; g.strokeStyle = '#5fe8a0'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.lineTo(404, y + h); g.lineTo(384, y + h + 52); g.lineTo(364, y + h); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#eafff2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(40,220,120,0.9)'; g.shadowBlur = 10;
  g.fillText(lines[0], 384, y + 48); g.fillText(lines[1], 384, y + 104);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// one bubble sprite for the whole session: drawn and uploaded once, then only shown and hidden
// (re-drawing the canvas texture every shout stalled the GPU for ~0.35 s every 10 s)
let UL_BUBBLE = null;
function ulBubbleSprite() {
  if (!UL_BUBBLE) {
    UL_BUBBLE = new THREE.Sprite(new THREE.SpriteMaterial({ map: ulBubbleTexture(UL_PASSIVE.line), transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    UL_BUBBLE.renderOrder = 30; UL_BUBBLE.frustumCulled = false; UL_BUBBLE.visible = false; scene.add(UL_BUBBLE);
  }
  return UL_BUBBLE;
}
function ulHideBubble() { if (UL_BUBBLE) UL_BUBBLE.visible = false; U.bubble = null; }
function ulShout() {
  // a proper ripper: one big blat, then a wet sputter chain, then a last squeaky toot - with green gas puffing out behind him
  const toots = ['fart_toot2', 'fart_toot5', 'fart_toot7', 'fart_toot8'], sputs = ['fart_sputter1', 'fart_sputter2', 'fart_sputter4', 'fart_sputter5'];
  const seq = [[0, pick(toots), 1.15], [0.32, pick(sputs), 1.05], [0.85, pick(sputs), 1.0], [1.45, pick(toots), 0.9]];
  if (Math.random() < 0.5) seq.push([1.9, pick(sputs), 0.95]);
  for (const [dl, name, g] of seq) VFX.later(dl, () => {
    if (Kit.id !== 'ullr') return;
    Sound.god(name, { gain: g, rate: rand(0.92, 1.08) });
    const back = fwdOf(P.yaw, new THREE.Vector3()).multiplyScalar(-1), at = P.pos.clone().setY(0.95).addScaledVector(back, 0.35);
    for (let i = 0; i < 7; i++) FX2.smoke.spawn({ pos: at.clone(), vel: back.clone().multiplyScalar(rand(1.2, 3.2)).add(V3(rand(-0.7, 0.7), rand(-0.1, 0.8), rand(-0.7, 0.7))), life: rand(1.0, 1.7), size: rand(0.35, 0.6), sizeEnd: rand(1.4, 2.2), frames: 16, pal: 'fart', temp: 0.25, tempEnd: 0, int: 1.1, alpha: 0.6, drag: 1.6, turb: 0.8, fadeIn: 0.05 });
    Cam.shake = Math.max(Cam.shake, 0.08);
  });
  ulText(P.pos.clone().setY(2.3), pick(['PRRRRRT!', 'BRAAAP!', 'PFFFRRT!', '*RIIIIP*']), '#a6ff4a', true);
  VFX.later(1.0, () => { if (Kit.id === 'ullr') ulText(P.pos.clone().setY(2.1), pick(['...sorry.', '...wasn\'t me.', '...Bowelius did it.']), '#d6ff9a', false); });
}
function updateBubble(dt) {
  const B = U.bubble; if (!B) return;
  B.t += dt;
  const head = _u1.setFromMatrixPosition(Game.thoth.bones.head.matrixWorld);
  const pop = easeOutBack(clamp(B.t / 0.25, 0, 1)), fade = 1 - smoothstep(B.dur - 0.4, B.dur, B.t);
  B.s.position.set(head.x, head.y + 0.85 + B.t * 0.04, head.z);
  B.s.scale.set(3.0 * pop, 0.9 * pop, 1);
  B.s.material.opacity = fade;
  if (B.t >= B.dur) ulHideBubble();
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const ullrStance = () => (U.stance === 'bow' ? 'Bow' : 'Axes');
const ULLR_INFO = {
  passive: { name: 'Bowelius', kind: 'Passive · Gas',
    text: `Every 15 seconds Ullr lets rip a proper whopper of a fart, with green gas out the back. It does nothing. It just stinks. (Note: Ullr is a meme god – EVERYTHING he hits does exactly 1 damage. Stun, slow and buffs work as normal.)`,
    rows: () => [['Stance', ullrStance()], ['Fart', `every ${UL_PASSIVE.every} s`], ['Damage', 'always 1']] },
  ba: { name: 'Bladed Arrow', kind: 'Bow · Skillshot · Stun · Physical',
    text: 'Ullr draws an enormous rune arrow from the quiver … and usually misses. The arrow wobbles off, drops to the ground in front of him, or turns in mid-air and BONKS him on the head (0 damage, dizzy stars). If it hits, the first enemy is stunned and takes 1 damage.',
    rows: () => { const r = rankOf('ba'); return [['Damage', '1'], ['Stun', `${AB.ba.stun[r - 1]} s`], ['Range', `${AB.ba.range}`], ['Cooldown', `${cdOf('ba').toFixed(1)} s`]]; } },
  ew: { name: 'Expose Weakness', kind: 'Bow · Self-buff · Attack speed',
    text: 'The runes along the bow flare up emerald green. For 5 seconds Ullr shoots much faster – and gains +1 confidence. The aim is just as bad.',
    rows: () => { const r = rankOf('ew'); return [['Attack speed', `+${Math.round(AB.ew.as[r - 1] * 100)}%`], ['Duration', `${AB.ew.dur} s`], ['Cooldown', `${cdOf('ew').toFixed(1)} s`]]; } },
  hl: { name: 'Hail of Arrows', kind: 'Bow · Ground-targeted · Area · Slow',
    text: 'Ullr fires a volley straight up into the air. The arrows rain down in three waves – mostly around the circle, not in it, and one lands right by his own feet. The few that hit deal 1 damage and slow by 30%.',
    rows: () => [['Damage', '1 × 3 waves'], ['Slow', `${Math.round(AB.hl.slow * 100)}% for ${AB.hl.slowDur} s`], ['Radius', `${AB.hl.radius}`], ['Cooldown', `${cdOf('hl').toFixed(1)} s`]] },
  ta: { name: 'Thrown Axe', kind: 'Axes · Skillshot · Stun · Physical',
    text: 'Ullr screams and hurls a spinning bearded axe. It often flies wildly off to the side, or comes back like a boomerang and hits him in the head. If it hits an enemy, that enemy is stunned and takes 1 damage.',
    rows: () => { const r = rankOf('ta'); return [['Damage', '1'], ['Stun', `${AB.ta.stun[r - 1]} s`], ['Range', `${AB.ta.range}`], ['Cooldown', `${cdOf('ta').toFixed(1)} s`]]; } },
  iv: { name: 'Invigorate', kind: 'Axes · Self-buff · Speed · Mana',
    text: 'A war cry that gets the blood pumping. For 5 seconds Ullr runs faster (+0.5 speed, it feels like) and regains mana every second.',
    rows: () => { const r = rankOf('iv'); return [['Speed', `+${Math.round(AB.iv.speed[r - 1] * 100)}%`], ['Mana', `+${AB.iv.mana[r - 1]} / s`], ['Duration', `${AB.iv.dur} s`], ['Cooldown', `${cdOf('iv').toFixed(1)} s`]]; } },
  gb: { name: 'Glory Bound', kind: 'Axes · Leap · Area · Stun',
    text: 'Ullr leaps through the air with his axes raised … and rarely lands with style: a stumble or straight onto his face. Everyone at the landing takes 1 damage; the stun only works occasionally.',
    rows: () => [['Damage', '1'], ['Stun', `${AB.gb.stun[0]} s`], ['Range', `${AB.gb.range} · radius ${AB.gb.radius}`], ['Cooldown', `${cdOf('gb').toFixed(1)} s`]] },
  ws: { get name() { return U.stance === 'bow' ? 'Wield Axes' : 'Wield Bow'; }, kind: 'Stance swap',
    text: 'Ullr spins around and swaps weapons: the bow (long range, arrows) or two throwing axes (melee, fast chops). Abilities Q, E and R change with the stance.',
    rows: () => [['Now', ullrStance()], ['Cooldown', `${cdOf('ws').toFixed(1)} s`]] },
  bw: { name: 'Bowelius the Clown', kind: 'Final ability · Transformation · Pulse',
    text: `Not in SMITE. A burst of confetti and smoke – and Ullr is a clown: rainbow wig, red nose, makeup and huge shoes. For ${UL_FIN.dur} seconds he dances the “take the L” dance: a big L glove on his forehead, hopping from foot to foot and kicking out to the sides, while balloons float around him. Every half second the clown horn honks and a wave of confetti deals exactly 1 damage to everyone within ${UL_FIN.radius} m.`,
    rows: () => [['Damage', `1 every ${UL_FIN.tick} s (${Math.round(UL_FIN.dur / UL_FIN.tick)} pulses)`], ['Radius', `${UL_FIN.radius} m`], ['Cost', `${costOf('bw')} mana`], ['Cooldown', `${cdOf('bw').toFixed(0)} s`]] },
};
registerGod({
  id: 'ullr', dbg: U, name: 'Ullr', title: '“Bowelius”', nick: '“Bowelius” · Hunter', epithet: 'God of the Hunt · “Bowelius”', pantheon: 'Norse', role: 'Hunter',
  color: '#3fd08a', glyphs: 'ᚢ ᛚ ᛚ ᚱ ᛒ', asset: 'ullr', stats: ULLR_STATS, order: UL_ORDER.bow.slice(), ab: ullrAB,
  blurb: 'The epic Norse hunter with rune bow and throwing axes – who does exactly 1 damage with everything. The finale: <em>Bowelius the Clown</em>.',
  info: ULLR_INFO, physical: true, textColor: '#9fffc8', finalColor: '#ff7ad8', fxColor: UC.jade, accent: UC.jade, accel: 8,
  init() {
    U.home = { rig: Game.thoth, anim: Game.anim };
    U.aimL = U.home.anim.aim = { clip: UL_AIM.clip, time: UL_AIM.nock, on: false, w: 0, yaw: UL_AIM.yaw, yawK: 1, full: UL_AIM.full, kin: 12, kout: 5 };
    U.relT = 9; U.aimHold = 0; U.dizzy = 0; U.bowLinger = 0;
    U.combo = 0; U.comboT = 0; U.ew = 0; U.iv = 0; U.axeBack = 0; U.drawing = null; U.swap = null; U.passiveT = 6;
    for (const k of [...UL_ORDER.bow, ...UL_ORDER.axe]) P.cd[k] = 0;
    ulSetStance('bow');
    ulPull(0); ulPropsUpdate(0, true);
    { const bs = ulBubbleSprite(); try { renderer.initTexture(bs.material.map); } catch (e) { /* uploaded on first show */ } }
  },
  dispose() {
    ulClownCleanup();
    if (U.leap) { if (U.leap.trail) U.leap.trail.alive = false; U.leap = null; P.flying = false; P.y = 0; P.grounded = true; }
    if (U.home) { U.home.rig.root.rotation.x = 0; U.home.anim.aim = null; }
    if (U.aimL) { U.aimL.on = false; U.aimL.w = 0; }
    if (U.drawing && U.drawing.charge) U.drawing.charge.dead = true;
    U.drawing = null; U.swap = null; U.hails = []; U.ew = 0; U.iv = 0; U.axeBack = 0;
    for (const a of U.auras) a.dead = true; U.auras = [];
    ulHideBubble();
    // (only this Ullr's own arrows and paper: online another player's Ullr may share the pools)
    ulConf.list = ulConf.list.filter((c) => (c.ctx || null) !== Net.ctx); if (ulConf.mesh && !ulConf.list.length) ulConf.mesh.count = 0;
    ulRain.list = ulRain.list.filter((a) => (a.ctx || null) !== Net.ctx); if (ulRain.shaft && !ulRain.list.length) { ulRain.shaft.count = 0; ulRain.head.count = 0; }
    P.asBuff = 1; ulPull(0);
    Cam.frameTarget = 0; PostFX.vigTarget = 0;
  },
  intercept() { return ulBusy(); },
  busy: ulBusy,
  cast(id) { ({ ba: castBladedArrow, ew: castExposeWeakness, hl: castHail, ta: castThrownAxe, iv: castInvigorate, gb: castGloryBound, ws: castWield, bw: castClown })[id](); },
  basic: ullrBasic,
  moveOverride(dt) {
    if (U.clown && !U.clown.ended) { P.vel.set(0, 0, 0); return true; }
    return ulUpdateLeap(dt);
  },
  speedMul() { return U.iv > 0 ? 1 + AB.iv.speed[U.ivRank - 1] : 1; },
  noJump() { return ulBusy(); },
  dashing() { return !!(U.leap && U.leap.phase === 'air'); },
  ghost() { return !!(U.leap && U.leap.phase === 'air'); },
  animVel() { return U.leap || (U.clown && !U.clown.ended) ? _v1.set(0, 0, 0) : P.vel; },
  eyeBoost() { return (U.ew > 0 ? 0.6 : 0) + (U.iv > 0 ? 0.4 : 0) + (U.drawing && U.drawing.big ? 0.9 : 0) + (U.leap && U.leap.phase === 'air' ? 0.7 : 0); },
  lockYaw() { return !!(U.leap || (U.clown && !U.clown.ended)); },
  update(dt, t) {
    U.comboT = Math.max(0, U.comboT - dt);
    U.ew = Math.max(0, U.ew - dt); U.iv = Math.max(0, U.iv - dt);
    P.asBuff = U.ew > 0 ? 1 + AB.ew.as[U.ewRank - 1] : 1;
    if (U.iv > 0 && !settings.infiniteMana) P.mp = Math.min(maxMp(), P.mp + AB.iv.mana[U.ivRank - 1] * dt);
    U.auras = U.auras.filter((a) => !a.dead);
    // the abilities of the other stance keep cooling down off-screen
    for (const k of UL_ORDER[U.stance === 'bow' ? 'axe' : 'bow']) if (!ABILITY_ORDER.includes(k)) P.cd[k] = settings.noCooldowns ? 0 : Math.max(0, (P.cd[k] || 0) - dt);
    // the thrown axe grows back into his hand in a glint of emerald
    if (U.axeBack > 0) { U.axeBack -= dt; if (U.axeBack <= 0) { ulShowWeapons(); if (U.stance === 'axe') { const h = handPos('R', new THREE.Vector3()); ulMotes(h, 8, 0.15); FX2.glow.spawn({ pos: h, life: 0.2, size: 0.2, sizeEnd: 0.5, cell: FXA.flare, pal: 'ullr', temp: 1, tempEnd: 0.5, int: 1.4, fadeIn: 0 }); } } }
    // the bow: drawing (the aim layer's clip time follows the draw, the string comes back, an arrow sits on it),
    // then the loose, the follow-through and the redraw while he keeps shooting; the aim eases out ~1 s after the last shot
    if (U.drawing) U.bowLinger = 0.45; else if (U.bowLinger > 0) U.bowLinger -= dt;
    const A = U.aimL;
    if (A) {
      if (U.drawing) {
        const D = U.drawing; D.t += dt;
        if (D.big) { A.time = ulKeys(UL_BA_KEYS, D.t); A.yawK = smoothstep(0.16, 0.42, D.t); ulPull(smoothstep(0.32, 0.54, D.t)); }
        else { A.time = lerp(D.t0, UL_AIM.drawn, smoothstep(0, D.rel, D.t)); A.yawK = 1; ulPull(smoothstep(0.02, D.rel, D.t)); }
        if (D.nockAt) { const b = ulProps().bow; if (b && b.visible) b.localToWorld(D.nockAt.copy(b.userData.nock)); else handPos('R', D.nockAt); }
      } else if (A.on) {
        U.relT += dt; const r = U.relT;
        A.time = r < 0.1 ? lerp(UL_AIM.drawn, UL_AIM.follow, r / 0.1) : lerp(UL_AIM.follow, UL_AIM.drawn, smoothstep(0.1, 0.42, r));
        ulPull(smoothstep(0.18, 0.42, r) * 0.85);
        U.aimHold -= dt;
        if (U.aimHold <= 0 || U.stance !== 'bow' || ulBusy()) A.on = false;
      } else { U.relT += dt; ulPull(0); }
    }
    ulShowWeapons(); ulPropsUpdate(dt);
    // dizzy after a self-bonk: the stars circle his head (U.headC is their orbit centre)
    if (Game.thoth) ulHead(U.headC).y -= 0.05;
    if (U.dizzy > 0) { U.dizzy -= dt; if (Math.random() < dt * 6) FX2.glow.spawn({ pos: U.headC, vel: V3(rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3)), life: 0.5, size: 0.06, sizeEnd: 0.01, cell: FXA.spark, pal: 'ullrGold', temp: 1, tempEnd: 0.5, int: 1.6 }); }
    // Expose Weakness: the bow's runes burn, emerald drips off the limbs
    const bow = ulProps().bow;
    if (bow && bow.userData.runes) bow.userData.runes.material.opacity = 0.75 + (U.ew > 0 ? 0.25 + 0.15 * Math.sin(t * 9) : 0.1 * Math.sin(t * 2));
    if (U.ew > 0 && bow && bow.visible && Math.random() < dt * 24) FX2.glow.spawn({ pos: bow.localToWorld(_u1.set(0, rand(-0.8, 0.8), 0.02)), vel: V3(rand(-0.2, 0.2), rand(-0.6, 0.1), rand(-0.2, 0.2)), life: rand(0.4, 0.7), size: rand(0.04, 0.08), sizeEnd: 0.01, cell: FXA.ember, pal: 'ullrRune', temp: 1.1, tempEnd: 0.4, int: 1.8 });
    // Invigorate: emerald dust at his heels while he runs
    if (U.iv > 0 && P.vel.lengthSq() > 4 && Math.random() < dt * 14) ulDust(P.pos, 1, 0.6);
    // the passive shout, every 10 s in play
    if (Game.mode === 'play') { U.passiveT -= dt; if (U.passiveT <= 0) { U.passiveT = UL_PASSIVE.every; ulShout(); } }
    updateSwap(dt); updateHails(dt); updateClown(dt, t); updateBubble(dt);
    if (!Net.online) { ulRainUpdate(dt); ulConfUpdate(dt); }   // (online the pools are ticked once a frame for every Ullr: simulate)
  },
  onKill(d) { U.kills++; },
  targeter() {
    if (P.targeting === 'ba') lineTarget.show(P.pos, P.yaw, AB.ba.range * SU, 0.9, 0.9);
    else if (P.targeting === 'ta') lineTarget.show(P.pos, P.yaw, AB.ta.range * SU, 1.0, 1.0);
    else if (P.targeting === 'hl') { const c = groundTarget(AB.hl.range * SU, 3); circleTarget.show(c, AB.hl.radius * SU, UC.jade); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.3, 0.3); }
    else if (P.targeting === 'gb') { const c = groundTarget(AB.gb.range * SU, 3); circleTarget.show(c, AB.gb.radius * SU, UC.jade); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.5, 0.5); }
  },
  armed(id) { return (id === 'ew' && U.ew > 0) || (id === 'iv' && U.iv > 0) || (id === 'gb' && !!U.leap) || (id === 'bw' && !!U.clown); },
  buffs() {
    return [
      { icon: U.stance === 'bow' ? 'ul_st_bow' : 'ul_st_axe', on: true, n: '', t: ullrStance() },
      { icon: 'ul_ew', on: U.ew > 0, n: '', t: Math.ceil(U.ew) + 's' },
      { icon: 'ul_iv', on: U.iv > 0, n: '', t: Math.ceil(U.iv) + 's' },
    ];
  },
  onDummyDeath(d, p) { ulBurst(p.clone().setY(1.2), 0.6, { distort: false }); ulShards(p.clone().setY(1), 8, 0.8); },
  icon(ctx, S, id) {
    const ice = (fn, col = '#b8ffd6', blur = 16) => glowText(ctx, fn, col, blur);
    const bow = (x, y, s, rot = 0, col = '#eafff2') => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = col; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.5); ctx.quadraticCurveTo(s * 0.42, 0, -s * 0.06, s * 0.5); ctx.stroke(); ctx.lineWidth = s * 0.018; ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.5); ctx.lineTo(-s * 0.06, s * 0.5); ctx.stroke(); ctx.restore(); };
    const arrow = (x0, y0, x1, y1, w, col = '#eafff2') => { const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); ctx.save(); ctx.translate(x0, y0); ctx.rotate(a); ctx.fillStyle = col; ctx.fillRect(0, -w / 2, L * 0.82, w); ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.78, -w * 2.6); ctx.lineTo(L * 0.78, w * 2.6); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.12, -w * 2.2); ctx.lineTo(L * 0.18, -w * 2.2); ctx.lineTo(L * 0.08, 0); ctx.lineTo(L * 0.18, w * 2.2); ctx.lineTo(L * 0.12, w * 2.2); ctx.closePath(); ctx.fill(); ctx.restore(); };
    const axe = (x, y, s, rot = 0, col = '#eafff2') => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#6a4a30'; ctx.fillRect(-s * 0.035, -s * 0.5, s * 0.07, s * 1.0); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s * 0.02, -s * 0.46); ctx.quadraticCurveTo(s * 0.2, -s * 0.48, s * 0.34, -s * 0.56); ctx.quadraticCurveTo(s * 0.42, -s * 0.3, s * 0.36, -s * 0.08); ctx.quadraticCurveTo(s * 0.24, -s * 0.12, s * 0.16, -s * 0.18); ctx.quadraticCurveTo(s * 0.1, -s * 0.26, s * 0.02, -s * 0.28); ctx.closePath(); ctx.fill(); ctx.restore(); };
    const runes = (txt, y, col = 'rgba(120,255,180,0.75)') => { ctx.save(); ctx.font = `${Math.round(S * 0.13)}px serif`; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(txt, S / 2, y); ctx.restore(); };
    if (id === 'passive') { iconBase(ctx, S, '#1a7a4a', '#03160c'); ice(() => { ctx.fillStyle = '#eafff2'; ctx.font = `800 ${Math.round(S * 0.46)}px Rajdhani, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('1', S * 0.5, S * 0.47); }); runes('ᛒᛟᚹᛖᛚᛁᚢᛋ', S * 0.88); }
    else if (id === 'ba') { iconBase(ctx, S, '#1e8a52', '#03140a'); ice(() => { arrow(S * 0.12, S * 0.82, S * 0.9, S * 0.12, S * 0.05); drawFlake(ctx, S * 0.72, S * 0.3, S * 0.12, '#b8ffd6'); }); }
    else if (id === 'ew') { iconBase(ctx, S, '#1a7a48', '#02120a'); ice(() => { bow(S * 0.46, S * 0.5, S * 0.8); }); runes('ᛏᚱᛁ', S * 0.6, 'rgba(255,215,110,0.95)'); }
    else if (id === 'hl') { iconBase(ctx, S, '#17703f', '#020e07'); ice(() => { for (let i = 0; i < 5; i++) arrow(S * (0.18 + i * 0.15), S * 0.1, S * (0.12 + i * 0.15), S * (0.62 + (i % 2) * 0.12), S * 0.025); ctx.strokeStyle = '#b8ffd6'; ctx.lineWidth = S * 0.03; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.82, S * 0.38, S * 0.08, 0, 0, TAU); ctx.stroke(); }); }
    else if (id === 'ta') { iconBase(ctx, S, '#2a7a50', '#04140b'); ice(() => { axe(S * 0.5, S * 0.55, S * 0.75, 0.6); ctx.strokeStyle = 'rgba(170,255,200,0.9)'; ctx.lineWidth = S * 0.03; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.5, S * 0.4, -2.6, -1.2); ctx.stroke(); ctx.beginPath(); ctx.arc(S * 0.5, S * 0.5, S * 0.4, 0.5, 1.9); ctx.stroke(); }); }
    else if (id === 'iv') { iconBase(ctx, S, '#1a8a5a', '#03160e'); ice(() => { ctx.strokeStyle = '#eafff2'; ctx.lineWidth = S * 0.06; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(S * (0.2 + i * 0.2), S * 0.78); ctx.lineTo(S * (0.4 + i * 0.2), S * 0.5); ctx.lineTo(S * (0.2 + i * 0.2), S * 0.22); ctx.stroke(); } }); }
    else if (id === 'gb') { iconBase(ctx, S, '#1a6e42', '#020e07'); ice(() => { ctx.strokeStyle = '#b8ffd6'; ctx.lineWidth = S * 0.04; ctx.setLineDash([S * 0.05, S * 0.04]); ctx.beginPath(); ctx.moveTo(S * 0.12, S * 0.8); ctx.quadraticCurveTo(S * 0.4, S * 0.02, S * 0.72, S * 0.62); ctx.stroke(); ctx.setLineDash([]); axe(S * 0.68, S * 0.5, S * 0.5, 0.3); ctx.beginPath(); ctx.ellipse(S * 0.72, S * 0.84, S * 0.2, S * 0.05, 0, 0, TAU); ctx.stroke(); }); }
    else if (id === 'ws') { iconBase(ctx, S, '#1e6a46', '#030f08'); ice(() => { if (U.stance === 'bow') { axe(S * 0.38, S * 0.52, S * 0.62, -0.4); axe(S * 0.64, S * 0.52, S * 0.62, 0.4); } else bow(S * 0.46, S * 0.5, S * 0.78); ctx.strokeStyle = 'rgba(170,255,200,0.85)'; ctx.lineWidth = S * 0.03; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.5, S * 0.44, 0.2, 2.6); ctx.stroke(); }); }
    else if (id === 'bw') { iconBase(ctx, S, '#b0306a', '#20061a'); glowText(ctx, () => { ctx.fillStyle = '#ffe8f0'; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.56, S * 0.24, 0, TAU); ctx.fill(); ['#ff2a4a', '#ffc21a', '#2ad46a', '#2a8aff', '#9a5aff'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(S * (0.26 + i * 0.12), S * (0.3 - Math.sin(i / 4 * Math.PI) * 0.08), S * 0.11, 0, TAU); ctx.fill(); }); ctx.fillStyle = '#ff1a2a'; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.58, S * 0.07, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d0103a'; ctx.lineWidth = S * 0.035; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.62, S * 0.13, 0.3, Math.PI - 0.3); ctx.stroke(); ctx.fillStyle = '#2a8aff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(S * (0.5 + sx * 0.1), S * 0.42); ctx.lineTo(S * (0.5 + sx * 0.13), S * 0.48); ctx.lineTo(S * (0.5 + sx * 0.1), S * 0.54); ctx.lineTo(S * (0.5 + sx * 0.07), S * 0.48); ctx.closePath(); ctx.fill(); } }, '#ff7ad8', 18); }
    else if (id === 'ul_st_bow') { iconBase(ctx, S, '#1a7a48', '#02120a'); ice(() => bow(S * 0.46, S * 0.5, S * 0.8)); }
    else if (id === 'ul_st_axe') { iconBase(ctx, S, '#2a7a50', '#04140b'); ice(() => { axe(S * 0.38, S * 0.52, S * 0.62, -0.4); axe(S * 0.64, S * 0.52, S * 0.62, 0.4); }); }
    else if (id === 'ul_ew') { iconBase(ctx, S, '#1a7a48', '#02120a'); ice(() => bow(S * 0.46, S * 0.5, S * 0.8, 0, '#7dffb0')); }
    else if (id === 'ul_iv') { iconBase(ctx, S, '#1a8a5a', '#03160e'); ice(() => drawFlake(ctx, S / 2, S / 2, S * 0.32, '#eafff2')); }
    else return false;
    return true;
  },
});


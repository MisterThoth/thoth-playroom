// ============================================================================
// COOKIE MONSTER (owner-only, see GodLock in 11z_gods.js) - an original horror brute: a hulking, armoured
// giant whose head is a cracked chocolate-chip cookie with molten eyes. Physical, melee basic attacks.
// v4 - ONE mechanic runs through the kit, CRUMBS: his hits cover enemies in cookie crumbs (up to 3; they cling to the
// body, three cookie pips float over the head). A crumbed enemy is FOOD: at 3 Crumbs his Chomp DEVOURS it.
//  Passive  Cookie Lover      - every 10 s he eats a cookie (+5 % HP and mana); a Devour is a meal too
//  Q        Chomp             - a lunge: giant cookie JAWS slam shut in front of him (+1 Crumb). On a 3-Crumb enemy:
//                               DEVOUR - a brutal triple bite that eats the Crumbs (big bonus damage, he heals)
//  E        Crumble Form      - toggle: a rolling cookie wheel (+70 % speed) that rams through enemies (crunch, shove,
//                               +1 Crumb). Rolled through his Molten Chocolate it comes out coated: burning, more damage,
//                               a burning chocolate trail
//  R        Molten Chocolate  - a huge cookie hurled onto the ground bursts into a pool of molten chocolate: enemies are
//                               stuck (slow), burn and gain a Crumb every 1.2 s
//  F        Cookie Rage       - 10 s as a 4.75 m living cookie with two burning swords. Q/E/R become the rage abilities:
//             Q Burning Cross - blades crossed and torn apart: two crossing crescents of fire fly forward
//             E Molten Charge - a charge dragging both swords through the floor (a burning trench), a rising slash knocks up
//             R Skyfall       - a leap into the sky, both swords crash down: a crater of molten cookie and a shockwave
//  G        Cookie Horror     - pick ONE enemy god anywhere: scary music, REAL cookies rain on it, a voice whispers its name,
//                               a glitch, a SCREAMER that screams its name, silence ... he is in front of it and CLAPS
// ============================================================================
const COOKIE_STATS = { hp: [560, 95], mp: [210, 34], speed: 355, range: 14, as: [0.86, 0.012], basic: [46, 2.6], basicScale: 1.0, hp5: [11, 0.9], mp5: [4.5, 0.4] };
const CM_EAT = { every: 10, heal: 0.05, mana: 0.05, bite: 0.95 };
const CM_ROLL = { speed: 0.7, radius: 0.95, accel: 2.4, icd: 1.1, minSpeed: 2.6, coat: 4.0, trailLife: 2.2, coatK: 1.5 };
const CM_RAGE = { dur: 10, ms: 0.3, as: 0.6, slamR: 5.5, windup: 0.5, slow: [1.75, 0.3], roarEvery: 4.2, slamR3: 4.6 };   // (the windup runs in slow motion: 0.5 s of game time = ~1.7 s real)
const CM_CRUMB = { max: 3, dur: 6 };
// Chomp: game seconds after the cast (the 'chomp' clip: the hands slam together forward = the jaws' bite)
const CM_CHOMP = { lunge: 3.0, lungeAt: 0.12, lungeEnd: 0.42, snap: 0.47, reach: 5.4, arc: 0.85, jaw: 3.0, bites: 3, biteGap: 0.2, maxDevour: 2, skew: 0.8 };   // (skew: the mouth turned 3/4 to the camera, so its fangs show in profile)
const CM_MOLTEN = { release: 0.32, flight: 0.55, radius: 4.6, dur: 4.5, slow: 0.35, tick: 0.5, crumbEvery: 1.2, impactR: 3.6 };
const CM_CROSS = { speed: 30, range: 26, half: 2.3, r0: 1.9, r1: 3.3, arc: 0.95, roll: 0.78, y: 2.0 };
const CM_CHARGE = { dist: 12, dur: 0.5, width: 2.0, upR: 4.6, trench: 2.6 };
const CM_SKY = { up: 0.42, land: 1.16, h: 7.0, radius: 6.0, lift: 0.6, crater: 3.2 };
// Cookie Horror timeline (s after the target is chosen): music, the cookie rain, the voice ("<name> ... Cookie Monster is
// coming for you"), a glitch, the SCREAMER (it screams the name), silence, he is THERE, the CLAP
const CM_HORROR = { rain: 0.45, coming: 1.4, glitch: 4.3, scream: 4.9, silence: 6.6, tele: 7.1, boom: 7.72, end: 8.95, splashR: 6, splash: 0.15,
  slow: { lead: 0.16, in: 0.35, hold: 1.2, out: 0.45, scale: 0.17 } };   // the clap's slow motion (real seconds; the hands close in it)
// the ability bar: on foot / rolling, and in Cookie Rage (the swords' own Q E R)
const CM_ORDER = { normal: ['cp', 'cf', 'mo', 'cr', 'hr'], rage: ['bx', 'mh', 'sk', 'cr', 'hr'] };
const CM_RAGE_IDS = ['bx', 'mh', 'sk'];
const CM = { form: 'normal', eatT: 6, eat: null, combo: 0, comboT: 0, roll: null, rage: null, rageR: null, home: null, horror: null, pick: null,
  cookieBack: 0, aura: null, auras: [], screamImg: null, kills: 0, lifts: [],
  crumbs: new Map(), chomp: null, throws: [], pools: [], trail: [], trailT: 0, waves: [], trench: [], trenchT: 0, act: null };   // (one per player online: 14n_net.js swaps it per god, NET_KITSTATE)
const CMC = { caramel: new THREE.Color(1.0, 0.45, 0.06), choc: new THREE.Color(0.3, 0.1, 0.02), fire: new THREE.Color(1.0, 0.3, 0.04), blood: new THREE.Color(0.7, 0.04, 0.04), crumb: new THREE.Color(0.75, 0.45, 0.16), coat: new THREE.Color(0.2, 0.08, 0.03) };
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _c3 = new THREE.Vector3(), _c4 = new THREE.Vector3(), _c5 = new THREE.Vector3(), _cUp = new THREE.Vector3(0, 1, 0);
const _cM = new THREE.Matrix4(), _cQ = new THREE.Quaternion(), _cQ2 = new THREE.Quaternion(), _cS = new THREE.Vector3(), _cE = new THREE.Euler();
const cookieAB = {
  cp: { id: 'cp', name: 'Chomp', dmg: [80, 125, 170, 215, 260], scale: 0.75, devour: [60, 90, 120, 150, 180], devourScale: 0.4, cost: [55, 60, 65, 70, 75], cd: [9, 8.5, 8, 7.5, 7], range: 27 },
  cf: { id: 'cf', name: 'Crumble Form', roll: [30, 45, 60, 75, 90], rollScale: 0.25, cost: [0, 0, 0, 0, 0], cd: [0, 0, 0, 0, 0] },
  mo: { id: 'mo', name: 'Molten Chocolate', dmg: [70, 110, 150, 190, 230], scale: 0.5, burn: [20, 28, 36, 44, 52], burnScale: 0.1, cost: [60, 65, 70, 75, 80], cd: [14, 13, 12, 11, 10], range: 55, targeted: true },
  cr: { id: 'cr', name: 'Cookie Rage', slam: [200, 280, 360, 440, 520], slamScale: 1.0, sword: [40, 52, 64, 76, 88], swordScale: 0.2, cost: [90, 90, 90, 90, 90], cd: [90, 85, 80, 75, 70] },
  // (balance, ability 5 >= 2 x ability 4: Cookie Rage's whole 10 s - transform, swords AND its three rage abilities - stays
  //  under half of this, see COOKIE_INFO.hr; was 5000-7400 + 1000 % before the rage abilities came)
  hr: { id: 'hr', name: 'Cookie Horror', dmg: [5800, 6500, 7200, 7900, 8600], scale: 10.0, cost: [100, 100, 100, 100, 100], cd: [110, 105, 100, 95, 90] },
  bx: { id: 'bx', name: 'Burning Cross', dmg: [70, 90, 110, 130, 150], scale: 0.3, cost: [0, 0, 0, 0, 0], cd: [3.5, 3.5, 3.5, 3.5, 3.5], range: 130 },
  mh: { id: 'mh', name: 'Molten Charge', dmg: [90, 110, 130, 150, 170], scale: 0.4, up: [60, 80, 100, 120, 140], upScale: 0.3, burn: [20, 25, 30, 35, 40], burnScale: 0.08, cost: [0, 0, 0, 0, 0], cd: [6, 6, 6, 6, 6], range: 60 },
  sk: { id: 'sk', name: 'Skyfall', dmg: [160, 200, 240, 280, 320], scale: 0.6, burn: [25, 30, 35, 40, 45], burnScale: 0.08, cost: [0, 0, 0, 0, 0], cd: [7, 7, 7, 7, 7], range: 75, targeted: true },
};
// (a rank by the slot the ability sits in - the rage's Q E R share Q E R's ranks, on the bar or not)
const cmRank = (id) => { let i = ABILITY_ORDER.indexOf(id); if (i < 0) i = CM_ORDER.rage.indexOf(id); if (i < 0) i = CM_ORDER.normal.indexOf(id); return clamp(settings.ranks[i] || 1, 1, 5); };
const cmDmg = (id, k = 'dmg', sk = 'scale') => AB[id][k][cmRank(id) - 1] + AB[id][sk] * ppow();

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
FX2.defPal('steam', { edge: [0.3, 0.27, 0.25], mid: [0.55, 0.5, 0.46], core: [0.8, 0.76, 0.72], smoke: [0.6, 0.56, 0.52], light: [0.5, 0.4, 0.3] });
// a thrown-away clone of the cookie model: off the scene, its own little glow sprites freed (the glTF's own geometry and
// materials are shared and stay)
function cmDropCookie(g) { if (!g) return; g.traverse((o) => { if (o.isSprite && o.material && o.material.map === glowSpriteTexture()) o.material.dispose(); }); cmDrop(g); }

// ---- the mechanic: CRUMBS ---------------------------------------------------------------------------------------
// CM.crumbs: target -> { n (0-3), t (s left), g (the crumbs stuck on its body + the cookie pips over its head) }. Every
// hit of his kit adds one; they fall off after CM_CRUMB.dur s without a new one. At 3 the enemy is food: Chomp devours it.
const _cmCrumbGeo = new THREE.DodecahedronGeometry(1, 0);
let _cmCrumbMat = null; const _cmPipTex = [];
function cmCrumbMat() { return _cmCrumbMat || (_cmCrumbMat = new THREE.MeshStandardMaterial({ map: cookieCrustTexture(), color: 0xe0aa66, roughness: 0.85, emissive: new THREE.Color(0.12, 0.05, 0.0), emissiveIntensity: 1 })); }
function cmPipTex(n) {
  if (_cmPipTex[n]) return _cmPipTex[n];
  const c = document.createElement('canvas'); c.width = 192; c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 3; i++) {
    const x = 32 + i * 64, y = 32, on = i < n;
    g.globalAlpha = on ? 1 : 0.3;
    if (on && n >= 3) { g.shadowColor = '#ff5a10'; g.shadowBlur = 12; }
    g.fillStyle = on ? (n >= 3 ? '#ffa04a' : '#d8964a') : '#4a2a14';
    g.beginPath(); for (let k = 0; k <= 22; k++) { const a = (k / 22) * TAU, r = 24 * (0.9 + 0.1 * Math.sin(k * 3.3 + i * 2)); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill();
    g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = '#1a0802'; g.stroke();
    g.fillStyle = '#2a1206'; for (const [cx, cy, cr] of [[-8, -7, 5], [7, -5, 4], [1, 8, 5], [-10, 7, 3], [11, 8, 3]]) { g.beginPath(); g.arc(x + cx, y + cy, cr, 0, TAU); g.fill(); }
    if (!on || i === 2) { g.globalAlpha = on ? 1 : 0.3; g.fillStyle = '#000'; g.beginPath(); g.arc(x + 22, y - 16, 10, 0, TAU); g.fill(); }   // (a bite out of it)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_cmPipTex[n] = t);
}
function cmCrumb(d, k = 1) {
  if (!d || !d.alive) return 0;
  let c = CM.crumbs.get(d);
  if (!c) {
    const g = new THREE.Group(), chunks = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(_cmCrumbGeo, cmCrumbMat());
      m.userData = { a: (i * 2.399) % TAU, h: 0.22 + ((i * 0.618) % 1) * 0.62, s: rand(0.045, 0.085), o: rand(0.9, 1.08) };
      m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); m.visible = false; g.add(m); chunks.push(m);
    }
    const pips = new THREE.Sprite(new THREE.SpriteMaterial({ map: cmPipTex(1), transparent: true, depthWrite: false, depthTest: false })); pips.renderOrder = 14; g.add(pips);
    scene.add(g);
    c = { n: 0, t: 0, g, chunks, pips, pop: 0 }; CM.crumbs.set(d, c);
  }
  const was = c.n; c.n = Math.min(CM_CRUMB.max, c.n + k); c.t = CM_CRUMB.dur;
  if (c.n !== was) { c.pips.material.map = cmPipTex(c.n); c.pips.material.needsUpdate = true; c.pop = 1; }
  // a puff of cookie bits sticks to it; the third one rings like a dinner bell (it is food now)
  const hp = _c5.set(d.pos.x, (d.height || 2) * 0.6 + (d.lift || 0), d.pos.z).clone();
  cmCrumbs(hp, 6 + 4 * c.n, 0.6, 0.6);
  if (c.n >= CM_CRUMB.max && was < CM_CRUMB.max) {
    Sound.god('crunch', { gain: 0.45, rate: 1.4, pos: d.pos });
    FX2.glow.spawn({ pos: hp.setY((d.height || 2) + 0.75), life: 0.45, size: 0.5, sizeEnd: 1.5, cell: FXA.flare, pal: 'cookie', temp: 0.9, tempEnd: 0.4, int: 1.0, fadeIn: 0 });
  }
  return c.n;
}
const cmCrumbsOf = (d) => { const c = CM.crumbs.get(d); return c ? c.n : 0; };
function cmCrumbDrop(d) { const c = CM.crumbs.get(d); if (!c) return; CM.crumbs.delete(d); cmDrop(c.g); c.pips.material.dispose(); }
function cmUpdateCrumbs(dt, t) {
  for (const [d, c] of CM.crumbs) {
    c.t -= dt; c.pop = Math.max(0, c.pop - dt * 4);
    if (c.t <= 0 || !d.alive || d.gone) { if (d.alive && c.n) cmCrumbs(_c2.set(d.pos.x, 1, d.pos.z), 6, 0.4, 0.3); cmCrumbDrop(d); continue; }
    const H = d.height || 2, R = (d.radius || 0.5) * 0.92, ly = d.lift || 0;
    c.g.position.set(d.pos.x, ly, d.pos.z); c.g.visible = !(d.mesh && d.mesh.visible === false);
    const show = c.n * 4;
    for (let i = 0; i < c.chunks.length; i++) {
      const m = c.chunks[i], u = m.userData; m.visible = i < show; if (!m.visible) continue;
      m.position.set(Math.cos(u.a) * R * u.o, u.h * H, Math.sin(u.a) * R * u.o); m.scale.setScalar(u.s * (1 + 0.6 * c.pop) * (H / 2));
    }
    const pul = (c.n >= 3 ? 1 + 0.08 * Math.sin(t * 9) : 1) * (1 + 0.35 * c.pop);
    c.pips.position.set(0, H + 0.8, 0); c.pips.scale.set(0.95 * pul, 0.32 * pul, 1);
    c.pips.material.opacity = Math.min(1, c.t / 0.6);
    if (Math.random() < dt * (0.8 + c.n)) cmCrumbs(_c2.set(d.pos.x + rand(-R, R), H * rand(0.3, 0.8) + ly, d.pos.z + rand(-R, R)), 1, 0.3, 0.2);   // crumbs trickle off it
    if (c.n >= 3 && Math.random() < dt * 5) FX2.glow.spawn({ pos: _c2.set(d.pos.x + rand(-0.3, 0.3), H + 0.8 + ly, d.pos.z + rand(-0.3, 0.3)), vel: V3(rand(-0.3, 0.3), rand(0.4, 1.0), rand(-0.3, 0.3)), life: rand(0.4, 0.7), size: 0.05, sizeEnd: 0.01, cell: FXA.ember, pal: 'cookie', temp: 1.1, tempEnd: 0.5, int: 1.6 });
  }
}
// a Devour is a meal: the passive's heal and mana, and the next cookie waits its full 10 s
function cmFeast(n = 1) {
  const hp = maxHp() * CM_EAT.heal * n, mp = maxMp() * CM_EAT.mana * n;
  P.hp = Math.min(maxHp(), P.hp + hp); P.mp = Math.min(maxMp(), P.mp + mp);
  if (!Net.ctx) cmText(P.pos.clone().setY(P.y + 3.3), `+${Math.round(hp)}`, '#8dff9a', true);
  CM.eatT = CM_EAT.every;
  Sound.god('eat', { gain: 0.9, delay: 0.12 });
  Sound.voice('passive_eat', { chance: 0.7, cooldown: 5, delay: 0.35, priority: 3 });
  FX2.glow.spawn({ pos: P.pos.clone().setY(1.6), life: 0.6, size: 1.0, sizeEnd: 2.2, cell: FXA.glow, pal: 'cookie', temp: 0.8, tempEnd: 0.4, int: 0.8, fadeIn: 0.05 });
}

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
function cmBusy() { return !!((CM.horror && !CM.horror.done) || CM.pick || (CM.rage && CM.rage.phase === 'in') || CM.act || CM.chomp); }
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
      if (heavy) cmCrumb(d);   // (the two-fisted smash covers it in crumbs)
      const hp = d.pos.clone().setY(1.1);
      cmBurst(hp, heavy ? 0.5 : 0.35, { distort: heavy, light: heavy });
      Sound.god('cookie_hit', { gain: 0.8, pos: d.pos, rate: rand(0.95, 1.08) });
    }
  });
}

// ---- Q · Chomp: he lunges and giant cookie JAWS slam shut in front of him -----------------------------------------
// The jaws: two big cookies hinged at the back like a mouth - the top one swings up and SLAMS down, the bottom one rises
// out of the floor - with ragged rows of glossy chocolate fangs around their front edges and two burning eyes on top.
let _cmToothGeo = null, _cmToothMat = null;
function cmJaws(D = CM_CHOMP.jaw) {
  if (!_cmToothGeo) {
    _cmToothGeo = new THREE.ConeGeometry(0.17, 0.95, 6, 1).rotateX(Math.PI).translate(0, -0.475, 0);   // (base at 0, the point hanging down)
    _cmToothMat = new THREE.MeshPhysicalMaterial({ color: 0x2c1006, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, emissive: new THREE.Color(0.38, 0.09, 0.0), emissiveIntensity: 0.8 });
  }
  const g = new THREE.Group(), R = D / 2;
  const jaw = (top) => {
    const piv = new THREE.Group(), disc = makeCookieDisc(D);
    disc.rotation.z = Math.PI / 2; disc.position.set(0, 0, R); piv.add(disc);
    for (let i = 0; i < 15; i++) {
      const a = lerp(-2.05, 2.05, i / 14) + rand(-0.05, 0.05), t = new THREE.Mesh(_cmToothGeo, _cmToothMat);
      t.position.set(Math.sin(a) * R * 0.84, top ? -D * 0.045 : D * 0.045, R + Math.cos(a) * R * 0.84);
      t.scale.set(rand(0.8, 1.25), (i % 2 ? 0.75 : 1.15) * rand(0.85, 1.2), rand(0.8, 1.2));
      t.rotation.set(top ? 0 : Math.PI, rand(0, TAU), rand(-0.18, 0.18), 'YXZ');
      piv.add(t);
    }
    return piv;
  };
  const top = jaw(true), bot = jaw(false); g.add(top); g.add(bot);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1.0, 0.3, 0.03), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    e.scale.setScalar(0.8); e.position.set(s * 0.5, D * 0.12, R * 0.5); e.renderOrder = 9; top.add(e); eyes.push(e);
  }
  // the maw: a hot orange glow between the jaws while they gape
  const maw = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.9, 0.22, 0.02), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  maw.scale.set(D * 0.9, D * 0.5, 1); maw.position.set(0, 0, R); maw.renderOrder = 8; g.add(maw);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { top, bot, eyes, maw };
  g.visible = false; scene.add(g);
  return g;
}
function cmJawsBreak(C) {
  const J = C.jaws; if (!J || J.userData.gone) return;
  J.userData.gone = true;
  const p = J.position.clone().addScaledVector(C.jd, CM_CHOMP.jaw * 0.5).setY(1.0);
  if (J.visible) { cmCrumbs(p, 26, 1.1, 0.8); cmChips(p, 10, 0.9); cmDust(p, 4, 0.8); }
  for (const e of [...J.userData.eyes, J.userData.maw]) e.material.dispose();
  cmDropCookie(J);
}
function castChomp() {
  spend('cp'); startCd('cp');
  const dir = fwdOf(P.yaw), from = P.pos.clone();
  // the lunge stops short of the first body in front of him (he bites it, he does not run through it)
  let L = CM_CHOMP.lunge;
  for (const d of Combat.dummies) {
    if (!d.alive) continue;
    const dx = d.pos.x - from.x, dz = d.pos.z - from.z, ahead = dx * dir.x + dz * dir.z;
    if (ahead > 0 && Math.abs(dx * dir.z - dz * dir.x) < d.radius + 1.0) L = Math.min(L, Math.max(0, ahead - d.radius - 1.5));
  }
  Game.anim.play('chomp');
  Sound.voice('q', { chance: 0.6, cooldown: 5 });
  Sound.god('punch_swing3', { gain: 0.8, rate: 0.75 });
  Sound.god('cookie_throw', { gain: 1.15, delay: Math.max(0, CM_CHOMP.snap - 0.24) });   // (its bite lands 0.24 s in)
  const jy = P.yaw + CM_CHOMP.skew * (Math.random() < 0.5 ? 1 : -1);
  CM.chomp = { t: 0, dir, jy, jd: fwdOf(jy, new THREE.Vector3()), from, to: from.clone().addScaledVector(dir, L), yaw: P.yaw, jaws: cmJaws(), bit: false, devour: [], biteN: 0, biteT: 0, end: CM_CHOMP.snap + 0.4 };
}
function cmUpdateChomp(dt) {
  const C = CM.chomp; if (!C) return;
  C.t += dt; const T = C.t, J = C.jaws, U = J.userData;
  // the lunge (the clip's own forward drive; he stops short of the body he bites)
  if (T >= CM_CHOMP.lungeAt && T <= CM_CHOMP.lungeEnd + dt) {
    const k = easeOutCubic(clamp((T - CM_CHOMP.lungeAt) / (CM_CHOMP.lungeEnd - CM_CHOMP.lungeAt), 0, 1));
    P.pos.lerpVectors(C.from, C.to, k); resolveCircle(P.pos, 0.45);
    if (Math.random() < dt * 25) cmDust(P.pos, 1, 0.6);
  }
  if (!C.bit) {
    // the jaws bloom out of a burst of crumbs in front of him, gape wide, then SLAM shut
    const R = CM_CHOMP.jaw * 0.5, at = _c1.copy(P.pos).addScaledVector(C.dir, 1.0 + R);   // (the mouth's centre: where it bites)
    J.position.set(at.x - C.jd.x * R, 1.05, at.z - C.jd.z * R); J.rotation.y = C.jy;
    if (T > 0.08 && !J.visible) { J.visible = true; cmCrumbs(at.clone().setY(1.3), 18, 0.9); FX2.glow.spawn({ pos: at.clone().setY(1.3), life: 0.3, size: 1.2, sizeEnd: 2.6, cell: FXA.flare, pal: 'cookie', temp: 0.8, tempEnd: 0.4, int: 0.7, fadeIn: 0 }); }
    J.scale.setScalar(Math.max(0.01, 0.3 + 0.7 * easeOutBack(clamp((T - 0.08) / 0.24, 0, 1))));
    const open = T < CM_CHOMP.snap - 0.08 ? smoothstep(0.08, 0.32, T) : 1 - smoothstep(CM_CHOMP.snap - 0.08, CM_CHOMP.snap, T);
    U.top.rotation.x = -1.1 * open; U.bot.rotation.x = 0.5 * open;
    U.top.position.y = 0.6; U.bot.position.y = -0.6;
    for (const e of U.eyes) e.material.opacity = 0.35 + 0.65 * smoothstep(0.1, 0.3, T);
    U.maw.material.opacity = 0.35 * open;
    if (Math.random() < dt * 30) FX2.glow.spawn({ pos: _c2.copy(J.position).addScaledVector(C.jd, rand(0.5, 2.5)).add(_c3.set(rand(-1.2, 1.2), rand(-0.5, 0.8), rand(-1.2, 1.2))), vel: V3(rand(-0.4, 0.4), rand(0.3, 1.2), rand(-0.4, 0.4)), life: rand(0.3, 0.6), size: rand(0.05, 0.09), sizeEnd: 0.01, cell: FXA.ember, pal: 'cookie', temp: 1.1, tempEnd: 0.5, int: 1.6 });
    if (T >= CM_CHOMP.snap) cmChompBite(C);
  } else cmUpdateDevour(C, dt);
  if (T > C.end) { cmJawsBreak(C); CM.chomp = null; }
}
function cmChompBite(C) {
  C.bit = true;
  const dir = C.dir, J = C.jaws, dmg = cmDmg('cp');
  const hits = dummiesInCone(P.pos, dir, CM_CHOMP.reach, CM_CHOMP.arc);
  const at = J.position.clone().addScaledVector(C.jd, CM_CHOMP.jaw * 0.5).setY(1.0);
  J.userData.top.rotation.x = 0; J.userData.bot.rotation.x = 0; J.userData.maw.material.opacity = 0;
  Game.hitStop(hits.length ? 0.09 : 0.04, 0.05); Cam.shake = Math.max(Cam.shake, hits.length ? 0.55 : 0.3); Cam.fovKick = hits.length ? 6 : 3;
  cmChips(at, 18, 1.0); cmCrumbs(at, 30, 1.2, 0.9);
  FX2.burst(at, 'cookie', { size: 0.8, sparks: 22, embers: 10, puffs: 3, bursts: 1, int: 0.7, light: true, distort: true, smokeGlow: 0.3 });
  FX2.ring(at.clone().setY(0), 'cookie', { radius: 3.4, dur: 0.4, width: 0.06 });
  for (const d of hits) {
    const full = cmCrumbsOf(d) >= CM_CRUMB.max;
    Combat.deal(d, dmg, 'ability', 'Chomp');
    if (full && C.devour.length < CM_CHOMP.maxDevour) C.devour.push(d);
    else cmCrumb(d);
    cmBurst(d.pos.clone().setY(1.2), 0.45, { distort: false, light: false });
    Sound.god('cookie_hit', { gain: 0.8, pos: d.pos, rate: rand(0.9, 1.05) });
  }
  if (C.devour.length) {   // DEVOUR: the jaws grab it and bite again, and again, and again
    C.biteT = CM_CHOMP.biteGap + 0.06; C.end = CM_CHOMP.snap + 0.1 + (CM_CHOMP.bites + 0.3) * CM_CHOMP.biteGap + 0.4;
    Sound.voice('q', { chance: 1, cooldown: 0, priority: 3, delay: 0.1 });
    cmText(C.devour[0].pos.clone().setY((C.devour[0].height || 2) + 1.0), 'DEVOUR!', '#ffb35a', true);
  }
}
function cmUpdateDevour(C, dt) {
  const J = C.jaws, U = J.userData;
  if (!C.devour.length) {   // nothing to eat: the jaws stay shut a moment, shuddering, then crumble
    J.scale.setScalar(1 + 0.05 * Math.sin(C.t * 70) * Math.max(0, 1 - (C.t - CM_CHOMP.snap) * 5));
    return;
  }
  // the mouth closes ON it: the hinge moves behind the first one it devours
  const v = C.devour[0], tx = v.pos.x - C.jd.x * CM_CHOMP.jaw * 0.5, tz = v.pos.z - C.jd.z * CM_CHOMP.jaw * 0.5;
  J.position.x = damp(J.position.x, tx, 14, dt); J.position.z = damp(J.position.z, tz, 14, dt);
  if (C.biteN >= CM_CHOMP.bites) { U.top.rotation.x = 0; U.bot.rotation.x = 0; J.scale.setScalar(1 + 0.04 * Math.sin(C.t * 60)); return; }
  C.biteT -= dt;
  const ph = clamp(1 - C.biteT / CM_CHOMP.biteGap, 0, 1), o = Math.sin(ph * Math.PI) * (ph < 0.5 ? 1 : 1);
  U.top.rotation.x = -0.8 * o; U.bot.rotation.x = 0.35 * o; U.maw.material.opacity = 0.3 * o;
  if (C.biteT <= 0) { C.biteN++; C.biteT = CM_CHOMP.biteGap; U.top.rotation.x = 0; U.bot.rotation.x = 0; cmDevourBite(C, C.biteN); }
}
function cmDevourBite(C, i) {
  const last = i >= CM_CHOMP.bites, per = cmDmg('cp', 'devour', 'devourScale');   // (one bite per Crumb eaten)
  Game.hitStop(last ? 0.14 : 0.07, last ? 0.04 : 0.08); Cam.shake = Math.max(Cam.shake, last ? 0.8 : 0.45); Cam.fovKick = last ? 10 : 5;
  Sound.god(last ? 'crunch' : 'cookie_hit', { gain: last ? 1.25 : 1.0, rate: last ? 0.78 : rand(0.92, 1.1) });
  if (last) Sound.god('cookie_throw', { gain: 0.8, rate: 0.82 });
  for (const d of C.devour) {
    const hp = d.pos.clone().setY((d.height || 2) * 0.55 + (d.lift || 0));
    if (d.alive) Combat.deal(d, per, 'ability', 'Devour');
    cmBurst(hp, last ? 0.95 : 0.55, { distort: last, light: false, int: 0.6 }); cmChips(hp, last ? 26 : 10, last ? 1.4 : 0.8);
    for (let k = 0; k < (last ? 30 : 12); k++) { const a = rand(0, TAU), sp = rand(2, last ? 7 : 4); FX2.solid.spawn({ pos: hp, vel: V3(Math.cos(a) * sp, rand(1.5, 5), Math.sin(a) * sp), life: rand(0.6, 1.0), size: rand(0.06, 0.14), sizeEnd: 0.05, cell: FXA.drop, pal: 'choco', temp: 0.1, tempEnd: 0, alpha: 1, gravity: -13, drag: 0.4, floor: true, stretch: 1.6 }); }
    cmKnockUp(d, last ? 0.4 : 0.2, last ? 0.8 : 0.3);
    if (last) cmCrumbDrop(d);   // (its Crumbs are eaten)
  }
  if (last) { cmFeast(1); FX2.ring(C.jaws.position.clone().setY(0).addScaledVector(C.jd, CM_CHOMP.jaw * 0.5), 'cookie', { radius: 5, dur: 0.5, width: 0.07, int: 1.2 }); }
}

// ---- E · Crumble Form: he rolls up into a giant cookie wheel (a free toggle) that rams through enemies -------------
function castCrumble() {
  if (CM.form === 'roll') { cmRollOut(); return; }
  if (CM.form !== 'normal') return;
  const W = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(), disc = makeCookieDisc(CM_ROLL.radius * 2);
  W.add(tilt); tilt.add(spin); spin.add(disc); scene.add(W);
  W.position.set(P.pos.x, CM_ROLL.radius, P.pos.z); W.rotation.y = P.yaw;
  // (its own materials: the molten-chocolate coat darkens, glosses and heats them)
  const mats = [];
  disc.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); mats.push({ m: o.material, c: o.material.color.clone(), r: o.material.roughness ?? 0.8 }); } });
  CM.roll = { W, tilt, spin, disc, mats, yaw: P.yaw, ang: 0, lean: 0, grow: 0, dustT: 0, coat: 0, ck: 0, hitT: new Map(), trailAcc: 0, loop: Sound.god('roll_loop', { gain: 0.0001, loop: true }) };
  CM.form = 'roll';
  if (CM.home) CM.home.rig.root.visible = false;
  cmPuff(P.pos, 0.9);
  Sound.god('crunch', { gain: 1.0 }); Sound.voice('e_in', { chance: 0.7, cooldown: 4 });
}
function cmRollOut() {
  const R = CM.roll; if (!R) return;
  cmPuff(P.pos, 0.9);
  if (R.loop) R.loop.stop(0.2);
  for (const M of R.mats) M.m.dispose();
  cmDropCookie(R.W);
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
function cmInPool(p, k = 0.9) { return CM.pools.some((Q) => !Q.cool && !Q.hot && Math.hypot(p.x - Q.c.x, p.z - Q.c.z) < Q.R * k); }
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
  // through his own molten chocolate: the wheel comes out COATED - dark, glossy, dripping and burning
  R.coat = Math.max(0, R.coat - dt);
  if (cmInPool(P.pos)) { if (R.coat < 0.2) { Sound.god('mine_place', { gain: 0.55, rate: 1.3 }); FX2.burst(P.pos.clone().setY(0.6), 'choco', { size: 0.6, sparks: 6, embers: 4, puffs: 3, bursts: 0, light: false, distort: false }); } R.coat = CM_ROLL.coat; }
  R.ck = damp(R.ck, R.coat > 0 ? 1 : 0, R.coat > 0 ? 8 : 2.5, dt);
  const fl = 0.75 + 0.25 * Math.sin(Game.time * 9) * Math.sin(Game.time * 3.7);
  for (const M of R.mats) { M.m.color.copy(M.c).lerp(CMC.coat, 0.82 * R.ck); M.m.roughness = lerp(M.r, 0.14, R.ck); if (M.m.emissive) { M.m.emissive.setRGB(0.26, 0.06, 0.0).multiplyScalar(R.ck * fl); M.m.emissiveIntensity = 1; } }
  const top = _c3.set(P.pos.x, R.W.position.y + CM_ROLL.radius * 0.9, P.pos.z);
  if (R.ck > 0.3) {
    if (Math.random() < dt * 26 * R.ck) FX2.fire.spawn({ pos: _c2.copy(top).add(_c4.set(rand(-0.4, 0.4), rand(-0.6, 0.1), rand(-0.4, 0.4))), vel: V3(rand(-0.3, 0.3), rand(1.2, 2.4), rand(-0.3, 0.3)), life: rand(0.25, 0.45), size: rand(0.35, 0.6), sizeEnd: 0.08, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.4, int: 1.2 });
    if (Math.random() < dt * 14 * R.ck) FX2.solid.spawn({ pos: _c2.set(P.pos.x + rand(-0.3, 0.3), R.W.position.y + rand(-0.3, 0.6), P.pos.z + rand(-0.3, 0.3)), vel: V3(rand(-0.8, 0.8), rand(0.5, 2), rand(-0.8, 0.8)), life: rand(0.6, 1.0), size: rand(0.06, 0.12), sizeEnd: 0.05, cell: FXA.drop, pal: 'choco', temp: 0.15, tempEnd: 0, alpha: 1, gravity: -12, floor: true, stretch: 1.6 });
  }
  // a crumb trail behind the wheel - and coated, a burning chocolate trail that sears whoever steps in it
  R.dustT -= dt * sp;
  if (R.dustT <= 0 && sp > 1) { R.dustT = 0.5; const back = fwdOf(R.yaw, _c1).multiplyScalar(-0.8); cmCrumbs(_c2.copy(P.pos).add(back).setY(0.1), 2, 0.5, 0.5); if (Math.random() < 0.4) cmDust(_c2, 1, 0.6); }
  if (R.coat > 0 && sp > 1) {
    R.trailAcc += sp * dt;
    while (R.trailAcc > 0.6) {
      R.trailAcc -= 0.6;
      const g = P.pos.clone().addScaledVector(fwdOf(R.yaw, _c1), -0.7).setY(0);
      CM.trail.push({ p: g, t: CM_ROLL.trailLife, burn: cmDmg('mo', 'burn', 'burnScale') * 0.6 });
      FX2.scorch(g, 'cfire', { radius: 0.7, dur: CM_ROLL.trailLife + 1, int: 1.3, dark: new THREE.Color(0.14, 0.05, 0.02), darkAlpha: 0.8 });
    }
  }
  // it RAMS whoever it rolls over: a crunchy hit, shoved aside, a Crumb (coated: half again as hard, and it burns)
  if (sp > CM_ROLL.minSpeed) {
    for (const d of dummiesNear(P.pos, CM_ROLL.radius + 0.35)) {
      if (Game.time - (R.hitT.get(d) ?? -9) < CM_ROLL.icd) continue;
      R.hitT.set(d, Game.time);
      const coated = R.coat > 0, dmg = cmDmg('cf', 'roll', 'rollScale') * (coated ? CM_ROLL.coatK : 1);
      Combat.deal(d, dmg, 'ability', coated ? 'Molten Crumble' : 'Crumble Form');
      cmCrumb(d);
      if (coated && d.bleed) d.bleed(cmDmg('mo', 'burn', 'burnScale') * 0.6, 2, 'Molten Chocolate');
      const f = fwdOf(R.yaw, _c3), sx = d.pos.x - P.pos.x, sz = d.pos.z - P.pos.z, lat = sx * f.z - sz * f.x;
      d.shove(_c4.set(f.z, 0, -f.x).multiplyScalar(lat >= 0 ? 1.5 : -1.5).addScaledVector(f, 0.9), 1.2);
      cmKnockUp(d, 0.32, 0.5);
      const hp = d.pos.clone().setY(1.0);
      cmBurst(hp, 0.55, { distort: false, light: coated, pal: coated ? 'cfire' : 'cookie' }); cmChips(hp, 10, 0.9);
      if (coated) FX2.burst(hp, 'choco', { size: 0.6, sparks: 8, embers: 6, puffs: 2, bursts: 0, light: false, distort: false });
      Sound.god('crunch', { gain: 1.0, pos: d.pos, rate: rand(0.9, 1.05) }); Sound.god('cookie_hit', { gain: 0.8, pos: d.pos });
      Game.hitStop(0.045, 0.2); Cam.shake = Math.max(Cam.shake, 0.32);
    }
  }
}
// the burning chocolate trail: it sears whatever stands in it (a tick every 0.5 s)
function cmUpdateTrail(dt) {
  if (!CM.trail.length) return;
  CM.trailT -= dt; const tick = CM.trailT <= 0; if (tick) CM.trailT = 0.5;
  for (const S of CM.trail) {
    S.t -= dt;
    if (Math.random() < dt * 5) FX2.fire.spawn({ pos: _c2.set(S.p.x + rand(-0.3, 0.3), 0.15, S.p.z + rand(-0.3, 0.3)), vel: V3(0, rand(0.8, 1.6), 0), life: rand(0.3, 0.5), size: rand(0.25, 0.45), sizeEnd: 0.06, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.4, int: 1.1 });
  }
  CM.trail = CM.trail.filter((S) => S.t > 0);
  if (!tick) return;
  for (const d of Combat.dummies) {
    if (!d.alive) continue;
    const S = CM.trail.find((s) => Math.hypot(d.pos.x - s.p.x, d.pos.z - s.p.z) < 0.9 + d.radius);
    if (S) Combat.deal(d, S.burn * 0.5, 'dot', 'Molten Crumble');
  }
}

// ---- R · Molten Chocolate: a huge cookie hurled onto the ground bursts into a pool of molten chocolate --------------
// The pool is a real surface: a glossy clear-coated physical material whose vertices swell into slow waves and fat
// bubbles (they grow, POP and ripple out), a thin lip at its splattered rim, molten-orange heat glowing up through
// cracks in its skin, steam and heat haze over it. (Skyfall's crater is the same pool, white-hot: hot = 1.)
const CMP_N = 8;   // bubbles per pool
function cmPoolMesh(R, hot = 0) {
  const geo = new THREE.PlaneGeometry(R * 2.3, R * 2.3, 110, 110); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: hot ? 0x4a1a08 : 0x3d1b0b, roughness: 0.14, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.06, sheen: 0.35, sheenColor: new THREE.Color(0.55, 0.28, 0.1), envMapIntensity: 1.5, emissive: new THREE.Color(0, 0, 0) });
  const U = { uTime: { value: 0 }, uR: { value: R }, uGrow: { value: 0 }, uCool: { value: 0 }, uHot: { value: hot }, uSeed: { value: Math.random() * 10 },
    uB: { value: Array.from({ length: CMP_N }, () => new THREE.Vector4(0, 0, 0, 0)) }, uNoise: { value: FX2.tex && FX2.tex.noise } };
  const HF = /* glsl */`
    uniform float uTime, uR, uGrow, uCool, uSeed, uHot; uniform vec4 uB[${CMP_N}];
    float cmEdge(vec2 p) { float a = atan(p.y, p.x); return uR * uGrow * (0.85 + 0.07 * sin(a * 5.0 + uSeed) + 0.05 * sin(a * 11.0 - uSeed * 2.0) + 0.03 * sin(a * 23.0 + uSeed * 3.0)); }
    float cmH(vec2 p) {
      float r = length(p), e = cmEdge(p);
      float body = smoothstep(e + 0.02, e - 0.6, r);
      float h = 0.075 * body + 0.03 * body * sin(p.x * 1.7 + uTime * 0.9 + uSeed) * sin(p.y * 1.3 - uTime * 0.7);
      for (int i = 0; i < ${CMP_N}; i++) {
        vec4 b = uB[i]; float d = length(p - b.xy);
        if (b.w < 0.92) h += body * sqrt(max(0.0, b.z * b.z - d * d)) * 0.8;
        else { float k = (b.w - 0.92) / 0.08; h += body * 0.035 * sin(d * 16.0 - k * 9.0) * exp(-d * 2.5) * (1.0 - k); }
      }
      return h * (1.0 - 0.6 * uCool);
    }`;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + HF + '\nvarying vec2 vCmP;')
      .replace('#include <beginnormal_vertex>', `vec2 cmP0 = position.xz; float cmE0 = 0.035, cmHC = cmH(cmP0);
        vec3 objectNormal = normalize(vec3(-(cmH(cmP0 + vec2(cmE0, 0.0)) - cmHC) / cmE0, 1.0, -(cmH(cmP0 + vec2(0.0, cmE0)) - cmHC) / cmE0));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, position.y + cmHC, position.z); vCmP = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HF + '\nvarying vec2 vCmP; uniform sampler2D uNoise;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float cmR = length(vCmP), cmE = cmEdge(vCmP); if (cmR > cmE) discard;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cmN = texture2D(uNoise, vCmP * 0.11 + uSeed).r, cmN2 = texture2D(uNoise, vCmP * 0.33 + vec2(uTime * 0.015, -uTime * 0.02)).g;
        diffuseColor.rgb *= 0.86 + 0.28 * cmN;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.055, 0.025), smoothstep(cmE - 0.3, cmE, cmR) * 0.65 + 0.35 * uCool);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cmCr = (1.0 - smoothstep(0.0, 0.035 + 0.05 * uHot, abs(cmN2 - 0.5))) * smoothstep(cmE, cmE * 0.45, cmR) * (0.35 + 0.65 * uHot);   // thin glowing veins in its skin
        float cmHeat = (1.0 - uCool) * (0.6 + 0.4 * sin(uTime * 2.6 + cmN * 12.0));
        totalEmissiveRadiance += vec3(1.0, 0.3, 0.04) * cmCr * cmHeat * (0.9 + 2.2 * uHot) + vec3(0.9, 0.22, 0.02) * uHot * (1.0 - uCool) * smoothstep(cmE, 0.0, cmR) * 0.35;`);
  };
  mat.customProgramCacheKey = () => 'cmPool' + CMP_N;
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.renderOrder = 2; m.frustumCulled = false;
  m.userData.U = U;
  return m;
}
function cmBubbleReset(Q, b) { const a = rand(0, TAU), r = Q.R * 0.72 * Math.sqrt(Math.random()); b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.rmax = rand(0.1, 0.28) * (Q.hot ? 0.8 : 1); b.ph = rand(-0.3, 0); b.sp = rand(0.45, 1.0); b.popped = false; }
function cmPool(c, R, dur, o = {}) {
  const m = cmPoolMesh(R, o.hot || 0); m.position.set(c.x, 0.035, c.z); m.rotation.y = rand(0, TAU); scene.add(m);
  const Q = { c: c.clone().setY(0), R, dur, t: 0, m, U: m.userData.U, tick: 0, crumbT: new Map(), steamT: 0, hot: o.hot || 0, burn: o.burn || 0,
    crumbs: o.crumbs !== false, slow: o.slow ?? CM_MOLTEN.slow, src: o.src || 'Molten Chocolate', cool: false, bub: [] };
  for (let i = 0; i < CMP_N; i++) { const b = {}; cmBubbleReset(Q, b); b.ph = rand(0, 0.9); Q.bub.push(b); }
  Q.haze = FX2.distort.heat(c.clone().setY(0.7), R * 1.7, Q.hot ? 0.007 : 0.0045, dur);
  CM.pools.push(Q);
  return Q;
}
function cmUpdatePools(dt, t) {
  for (const Q of CM.pools) {
    Q.t += dt; const U = Q.U;
    U.uTime.value = t;
    U.uGrow.value = easeOutCubic(Math.min(1, Q.t / 0.35)) * (1 - 0.3 * smoothstep(Q.dur - 0.7, Q.dur, Q.t));   // it spreads, then sinks in
    const cool = smoothstep(Q.dur - 0.9, Q.dur, Q.t); U.uCool.value = cool; Q.cool = cool > 0.5;
    // bubbles: they swell, POP with a splash of chocolate and a puff of steam, and ripple out
    for (let i = 0; i < CMP_N; i++) {
      const b = Q.bub[i]; b.ph += dt * b.sp;
      if (b.ph >= 1) cmBubbleReset(Q, b);
      else if (b.ph >= 0.92 && !b.popped) {
        b.popped = true;
        if (!Q.cool) {
          const p = Q.m.localToWorld(_c2.set(b.x, 0.12, b.z));
          for (let k = 0; k < 7; k++) FX2.solid.spawn({ pos: p, vel: V3(rand(-1.2, 1.2), rand(1.5, 3.2), rand(-1.2, 1.2)), life: rand(0.4, 0.7), size: rand(0.04, 0.08), sizeEnd: 0.03, cell: FXA.drop, pal: Q.hot ? 'cfire' : 'choco', temp: Q.hot ? 0.8 : 0.1, tempEnd: 0, alpha: 1, gravity: -12, floor: true, stretch: 1.4 });
          FX2.smoke.spawn({ pos: p, vel: V3(rand(-0.2, 0.2), rand(0.6, 1.1), rand(-0.2, 0.2)), life: rand(1.0, 1.6), size: 0.25, sizeEnd: 0.9, frames: 16, pal: Q.hot ? 'cfire' : 'steam', temp: Q.hot ? 0.4 : 0, tempEnd: 0, int: 1, alpha: 0.18, drag: 1.2, turb: 0.5, fadeIn: 0.1 });
        }
      }
      const grow = b.ph <= 0 ? 0 : Math.pow(Math.min(1, b.ph / 0.92), 0.7);
      U.uB.value[i].set(b.x, b.z, Q.cool ? 0 : b.rmax * grow, Math.max(0, b.ph));
    }
    // steam rising off it (and embers out of a white-hot crater)
    Q.steamT -= dt;
    if (Q.steamT <= 0 && !Q.cool) {
      Q.steamT = Q.hot ? 0.06 : 0.14;
      const a = rand(0, TAU), r = Q.R * 0.8 * Math.sqrt(Math.random()), p = _c2.set(Q.c.x + Math.cos(a) * r, 0.15, Q.c.z + Math.sin(a) * r);
      FX2.smoke.spawn({ pos: p, vel: V3(rand(-0.15, 0.15), rand(0.5, 1.0), rand(-0.15, 0.15)), life: rand(1.4, 2.2), size: 0.4, sizeEnd: rand(1.4, 2.0), frames: 16, pal: Q.hot ? 'cfire' : 'steam', temp: Q.hot ? 0.35 : 0, tempEnd: 0, int: 1, alpha: Q.hot ? 0.35 : 0.1, drag: 1.0, turb: 0.6, fadeIn: 0.2 });
      if (Q.hot && Math.random() < 0.7) FX2.glow.spawn({ pos: p, vel: V3(rand(-0.4, 0.4), rand(1.5, 3.5), rand(-0.4, 0.4)), life: rand(0.6, 1.1), size: rand(0.05, 0.09), sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.8, turb: 1.5 });
    }
    // whoever is in it is stuck (slowed), burns, and (his chocolate) gets crumbed every 1.2 s
    if (!Q.cool) {
      Q.tick -= dt; const tick = Q.tick <= 0; if (tick) Q.tick = CM_MOLTEN.tick;
      for (const d of dummiesNear(Q.c, Q.R * 0.85)) {
        d.slowed(Q.slow, 0.4);
        if (tick && Q.burn > 0) Combat.deal(d, Q.burn * CM_MOLTEN.tick, 'dot', Q.src);
        if (Q.crumbs) { const ct = (Q.crumbT.has(d) ? Q.crumbT.get(d) : CM_MOLTEN.crumbEvery * 0.5) - dt; if (ct <= 0) { cmCrumb(d); Q.crumbT.set(d, CM_MOLTEN.crumbEvery); } else Q.crumbT.set(d, ct); }
        if (Math.random() < dt * 8) FX2.solid.spawn({ pos: _c2.set(d.pos.x + rand(-0.3, 0.3), 0.12, d.pos.z + rand(-0.3, 0.3)), vel: V3(rand(-0.8, 0.8), rand(0.8, 2.0), rand(-0.8, 0.8)), life: rand(0.4, 0.7), size: rand(0.05, 0.09), sizeEnd: 0.03, cell: FXA.drop, pal: 'choco', temp: 0.1, tempEnd: 0, alpha: 1, gravity: -12, floor: true, stretch: 1.4 });   // it wades through it
      }
    }
    if (Q.t >= Q.dur) { Q.dead = true; if (Q.haze) Q.haze.dead = true; cmDrop(Q.m); Q.m.geometry.dispose(); Q.m.material.dispose(); }
  }
  CM.pools = CM.pools.filter((Q) => !Q.dead);
}
function castMolten() {
  spend('mo'); startCd('mo');
  const to = groundTarget(AB.mo.range * SU, 3);
  Game.anim.play('hurl');
  Sound.voice('r', { chance: 0.6, cooldown: 5 });
  VFX.later(CM_MOLTEN.release, () => {
    if (Kit !== GODS.cookie || CM.form !== 'normal') return;
    // the big cookie in his hand is the one he throws (it regrows in his hand)
    const held = CM.home && CM.home.rig.prop;
    const from = held && held.visible ? held.getWorldPosition(new THREE.Vector3()) : aimOrigin();
    from.y = Math.max(from.y, 1.4);
    CM.cookieBack = 1.3;
    const g = makeCookieDisc(1.5); scene.add(g); g.position.copy(from);
    Sound.god('punch_swing3', { gain: 0.95, rate: 0.78 });
    cmCrumbs(from, 8, 0.7);
    CM.throws.push({ g, from, to: to.clone(), t: 0, yaw: Math.atan2(to.x - from.x, to.z - from.z), dmg: cmDmg('mo'), burn: cmDmg('mo', 'burn', 'burnScale') });
  });
}
function cmUpdateThrows(dt) {
  for (const T of CM.throws) {
    T.t += dt; const k = Math.min(1, T.t / CM_MOLTEN.flight), g = T.g;
    g.position.lerpVectors(T.from, T.to, k); g.position.y = lerp(T.from.y, 0.5, k) + Math.sin(k * Math.PI) * 3.6;
    _cQ.setFromAxisAngle(_cUp, T.yaw); _cQ2.setFromAxisAngle(_c1.set(1, 0, 0), k * 14); g.quaternion.copy(_cQ).multiply(_cQ2);
    g.scale.setScalar(lerp(0.6, 1.0, Math.min(1, k * 3)));
    if (Math.random() < dt * 30) cmCrumbs(g.position, 1, 0.4, 0.3);
    if (k >= 1) { T.dead = true; cmMoltenSplash(T); }
  }
  CM.throws = CM.throws.filter((T) => !T.dead);
}
function cmMoltenSplash(T) {
  const c = T.to.clone().setY(0);
  cmDropCookie(T.g);
  Sound.god('mine_place', { gain: 1.25, pos: c });
  Game.hitStop(0.05, 0.15); Cam.shake = Math.max(Cam.shake, 0.42);
  PostFX.shock(c.clone().setY(0.5), 0.5, 0.45);
  // the cookie BURSTS: chunks and crumbs, and thick chocolate thrown up in heavy ropes that splat back down
  cmChips(c.clone().setY(0.5), 30, 1.4); cmCrumbs(c.clone().setY(0.6), 40, 1.4, 1.1);
  for (let i = 0; i < 70; i++) { const a = rand(0, TAU), sp = rand(2, 7.5); FX2.solid.spawn({ pos: c.clone().setY(0.3), vel: V3(Math.cos(a) * sp, rand(2.5, 7), Math.sin(a) * sp), life: rand(0.7, 1.2), size: rand(0.08, 0.2), sizeEnd: 0.06, cell: FXA.drop, pal: 'choco', temp: 0.12, tempEnd: 0, alpha: 1, gravity: -14, drag: 0.4, floor: true, stretch: 1.8 }); }
  FX2.burst(c.clone().setY(0.8), 'choco', { size: 1.1, sparks: 10, embers: 8, puffs: 6, bursts: 1, int: 0.6, light: false, smokeGlow: 0.15 });
  FX2.burst(c.clone().setY(0.5), 'cookie', { size: 0.6, sparks: 18, embers: 10, puffs: 0, bursts: 1, int: 0.6, distort: true });
  FX2.ring(c, 'cookie', { radius: CM_MOLTEN.radius + 1.2, dur: 0.5, width: 0.06 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; FX2.smoke.spawn({ pos: V3(c.x + Math.cos(a) * 1.2, 0.4, c.z + Math.sin(a) * 1.2), vel: V3(Math.cos(a) * rand(2, 4), rand(0.6, 1.4), Math.sin(a) * rand(2, 4)), life: rand(1.2, 1.8), size: 0.6, sizeEnd: 2.2, frames: 16, pal: 'steam', temp: 0, tempEnd: 0, int: 1, alpha: 0.16, drag: 2.4, turb: 0.6, fadeIn: 0.05 }); }
  for (const d of dummiesNear(c, CM_MOLTEN.impactR)) {
    Combat.deal(d, T.dmg, 'ability', 'Molten Chocolate');
    cmCrumb(d);
    cmBurst(d.pos.clone().setY(1.0), 0.4, { distort: false, light: false, pal: 'choco' });
  }
  cmPool(c, CM_MOLTEN.radius, CM_MOLTEN.dur, { burn: T.burn });
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
    anim.post = cmRagePost;   // (Molten Charge: the swords dragged through the floor)
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
  cmSetOrder(true);   // (Q E R: the rage's own abilities)
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
  cmEndAct();
  cmSwapForm(false);
  CM.form = 'normal'; CM.rage = null;
  cmSetOrder(false);
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
  cmUpdateAct(dt);
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
  if (RG.roarT <= 0 && R && !swinging && RG.comboT <= 0 && !CM.act) {
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
// ---- Cookie Rage's own abilities (Q/E/R while the swords burn) -------------------------------------------------
// The ability bar swaps with the form (as Ullr's stances do): on foot Chomp / Crumble Form / Molten Chocolate, in the rage
// Burning Cross / Molten Charge / Skyfall. The ones off the bar keep cooling down.
function cmSetOrder(rage) {
  const o = rage ? CM_ORDER.rage : CM_ORDER.normal;
  if (Kit !== GODS.cookie) return;
  if (rage) for (const k of CM_RAGE_IDS) P.cd[k] = 0;
  if (ABILITY_ORDER.join() === o.join()) return;
  ABILITY_ORDER = o.slice();
  if (P.targeting && !ABILITY_ORDER.includes(P.targeting)) P.targeting = null;
  if (HUD.els && HUD.els.abilities) HUD.rebuild();
}
function cmRageReal(act, ct) { const def = Game.anim.acts && Game.anim.acts[act]; return def ? Math.max(0, (ct - def.from) / def.rate) : 0; }
function cmEndAct() {
  const A = CM.act; if (!A) return;
  if (A.loop) A.loop.stop(0.25);
  if (A.id === 'sk') { if (!A.landed) P.pos.copy(A.to); P.y = 0; P.vy = 0; P.flying = false; P.grounded = true; }
  CM.act = null;
}
function cmUpdateAct(dt) {
  const A = CM.act; if (!A) return;
  A.t += dt;
  if (A.id === 'mh') cmUpdateCharge(A, dt);
  else if (A.id === 'sk') cmUpdateSky(A, dt);
  if (A.t >= A.end) cmEndAct();
}
// both arms dragged back and down while he charges, the swords trailing through the floor (IK over the run)
function cmRagePost(rig, dt, anim) {
  if (Game.anim !== anim) return;
  const A = CM.act;
  const w = A && A.id === 'mh' ? (A.phase === 'run' ? smoothstep(0, 0.08, A.t) : 1 - smoothstep(0, 0.14, A.t - A.upStart)) : 0;
  if (w < 0.01) return;
  const yaw = rig.root.rotation.y, fwd = _c2.set(Math.sin(yaw), 0, Math.cos(yaw)), left = _c3.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const hips = _c4.setFromMatrixPosition(rig.b('Hips').matrixWorld);
  for (const [s, arm, fore, hand] of [[1, 'LeftArm', 'LeftForeArm', 'LeftHand'], [-1, 'RightArm', 'RightForeArm', 'RightHand']]) {
    const target = _c1.copy(hips).addScaledVector(left, s * 1.1).addScaledVector(fwd, -0.6).add(_c5.set(0, -0.3, 0));
    const pole = new THREE.Vector3().copy(left).multiplyScalar(s).addScaledVector(fwd, -0.5).add(_c5.set(0, -0.4, 0));
    solveTwoBoneIK(rig.b(arm), rig.b(fore), rig.b(hand), target, pole, w);
    // and the blade turned to trail behind and down, its point in the floor
    const sw = rig.props && rig.props[s > 0 ? 'swordL' : 'swordR'], hb = rig.b(hand); if (!sw || !sw.userData.tip) continue;
    hb.updateMatrixWorld(true);
    const base = sw.localToWorld(_cS.copy(sw.userData.base || _c5.set(0, 0, 0))), cur = sw.localToWorld(new THREE.Vector3().copy(sw.userData.tip)).sub(base).normalize();
    const want = new THREE.Vector3().copy(fwd).multiplyScalar(-0.75).add(_c5.set(0, -0.6, 0)).addScaledVector(left, s * 0.25).normalize();
    const ax = new THREE.Vector3().crossVectors(cur, want), sn = ax.length(); if (sn < 1e-4) continue;
    rotateBoneWorld(hb, ax.divideScalar(sn), Math.atan2(sn, cur.dot(want)) * w); hb.updateMatrixWorld(true);
  }
}

// ---- rage Q · Burning Cross: the blades cross before his chest and are torn apart - two crescents of fire fly out, an X
const CMX_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const CMX_FS = FX2_RAMP + /* glsl */`
  uniform sampler2D uNoise; uniform vec3 uE, uM, uC; uniform float uA, uTime, uInt, uSeed; varying vec2 vUv;
  void main() {
    float along = vUv.x, across = clamp(vUv.y, 0.0, 1.0);   // across: 0 the trailing (inner) edge .. 1 the leading edge
    float tips = smoothstep(0.0, 0.2, along) * smoothstep(1.0, 0.8, along);
    float n = texture2D(uNoise, vec2(along * 2.4 + uSeed, across * 0.7 + uTime * 2.2)).r;
    float n2 = texture2D(uNoise, vec2(along * 6.0 - uSeed, across * 1.8 + uTime * 3.4)).g;
    float edge = smoothstep(0.62, 0.95, across) * smoothstep(1.0, 0.95, across);
    float flames = smoothstep(0.35 + 0.55 * (1.0 - across), 1.05, n * 0.85 + n2 * 0.4) * smoothstep(0.0, 0.45, across);
    float h = clamp(edge * 0.9 + flames * 0.5, 0.0, 1.0);
    float a = (edge * 1.15 + flames * 0.85) * tips * uA;
    gl_FragColor = vec4(ramp3(uE, uM, uC, h * 0.72) * a * uInt, 0.0);
  }`;
function cmCrescentGeo() {
  const segs = 36, pos = [], uv = [], idx = [], { r0, r1, arc } = CM_CROSS;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, a = -arc + 2 * arc * u;
    for (let j = 0; j < 2; j++) { const r = j ? r1 : r0; pos.push(Math.sin(a) * r, 0, Math.cos(a) * r - r1); uv.push(u, j); }
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
function castBurningCross() {
  if (CM.form !== 'rage' || !CM.rage) return;
  spend('bx'); startCd('bx');
  Game.anim.play('cross', { noFx: true });
  const real = (ct) => cmRageReal('cross', ct);
  CM.act = { id: 'bx', t: 0, end: real(1.7), yaw: P.yaw };
  Sound.god('sword_swing2', { gain: 1.0, rate: 0.85, delay: Math.max(0, real(0.85) - 0.16), noDuck: true });   // the blades cross
  Sound.god('mine_arm', { gain: 1.25, delay: Math.max(0, real(1.25) - 0.08), noDuck: true });               // and tear apart: the fire waves
  Sound.voice('f_cry', { chance: 0.75, cooldown: 1.0, priority: 3, delay: real(0.95) });
  VFX.later(real(1.02), () => {   // the crossed blades flare white-hot
    if (CM.form !== 'rage') return;
    const at = P.pos.clone().addScaledVector(fwdOf(P.yaw, _c1), 1.6).setY(2.6);
    FX2.burst(at, 'cfire', { size: 0.8, sparks: 30, embers: 14, puffs: 1, bursts: 1, int: 0.8, light: true, distort: true });
    if (CM.rage) CM.rage.flare = 1;
  });
  VFX.later(real(1.25), () => cmCrossLaunch());
}
function cmCrossLaunch() {
  if (CM.form !== 'rage') return;
  const dir = fwdOf(P.yaw, new THREE.Vector3()), yaw = P.yaw, origin = P.pos.clone().addScaledVector(dir, 1.2);
  Game.hitStop(0.06, 0.1); Cam.shake = Math.max(Cam.shake, 0.6); Cam.fovKick = 7;
  FX2.burst(origin.clone().setY(2.2), 'cfire', { size: 1.1, sparks: 40, embers: 20, puffs: 3, bursts: 1, int: 0.75, light: true, distort: true });
  FX2.distort.ring(origin.clone().setY(1.8), 10, 0.03, 0.5);
  const geo = cmCrescentGeo(), P2 = FX2.pal('cfire'), dmg = cmDmg('bx');
  for (const s of [-1, 1]) {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { ...fx2PalUniforms(P2), uNoise: { value: FX2.tex.noise }, uA: { value: 0 }, uTime: { value: 0 }, uInt: { value: 1.45 }, uSeed: { value: Math.random() } },
      vertexShader: CMX_VS, fragmentShader: CMX_FS });
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 11; m.frustumCulled = false;
    m.rotation.set(0, yaw, s * CM_CROSS.roll, 'YXZ'); scene.add(m);
    CM.waves.push({ m, mat, geo: s > 0 ? geo : null, s: 0, origin, dir, yaw, roll: s * CM_CROSS.roll, hit: new Set(), dmg, scorchAcc: 0, side: s });
  }
}
function cmUpdateWaves(dt, t) {
  for (const W of CM.waves) {
    const s0 = W.s; W.s += CM_CROSS.speed * dt;
    const range = AB.bx.range * SU, k = W.s / range;
    W.m.position.copy(W.origin).addScaledVector(W.dir, W.s + CM_CROSS.r1).setY(CM_CROSS.y);
    W.mat.uniforms.uTime.value = t; W.mat.uniforms.uA.value = Math.min(1, W.s / 1.2) * (1 - smoothstep(0.8, 1, k));
    // fire shed from the crescent as it flies, and a burning scar on the floor under its crossing
    for (let i = 0; i < 3; i++) {
      const a = rand(-CM_CROSS.arc, CM_CROSS.arc) * 0.9, r = rand(CM_CROSS.r0, CM_CROSS.r1);
      const p = W.m.localToWorld(_c2.set(Math.sin(a) * r, 0, Math.cos(a) * r - CM_CROSS.r1));
      if (Math.random() < 0.55) FX2.fire.spawn({ pos: p, vel: _c3.copy(W.dir).multiplyScalar(rand(2, 6)).add(_c4.set(rand(-0.4, 0.4), rand(0.4, 1.2), rand(-0.4, 0.4))).clone(), life: rand(0.2, 0.35), size: rand(0.4, 0.7), sizeEnd: 0.08, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.35, int: 1.2 });
      else FX2.glow.spawn({ pos: p, vel: V3(rand(-1, 1), rand(0.5, 2), rand(-1, 1)), life: rand(0.4, 0.8), size: rand(0.05, 0.1), sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.15, tempEnd: 0.5, int: 2, drag: 1, turb: 2 });
    }
    if (W.side > 0) {
      W.scorchAcc += W.s - s0;
      while (W.scorchAcc > 1.6) { W.scorchAcc -= 1.6; const g = W.origin.clone().addScaledVector(W.dir, W.s + CM_CROSS.r1 * 0.2).setY(0); FX2.scorch(g, 'cfire', { radius: 1.0, dur: 2.2, int: 1.4 }); }
    }
    // each crescent hits once (in the middle, where they cross, a target takes both)
    for (const d of Combat.dummies) {
      if (!d.alive || W.hit.has(d)) continue;
      const rx = d.pos.x - W.origin.x, rz = d.pos.z - W.origin.z, along = rx * W.dir.x + rz * W.dir.z, lat = Math.abs(rx * W.dir.z - rz * W.dir.x);
      if (along > s0 - 0.6 && along < W.s + CM_CROSS.r1 * 0.4 && lat < CM_CROSS.half + d.radius) {
        W.hit.add(d);
        Combat.deal(d, W.dmg, 'ability', 'Burning Cross');
        cmBurningHit(d, 0.75);
        if (d.bleed) d.bleed(W.dmg * 0.12, 2, 'Burning Cross');
      }
    }
    if (k >= 1) { W.dead = true; FX2.burst(W.m.position.clone(), 'cfire', { size: 0.6, sparks: 14, embers: 8, puffs: 1, bursts: 1, light: false, distort: false }); }
  }
  for (const W of CM.waves) if (W.dead) { cmDrop(W.m); W.mat.dispose(); if (W.geo) W.geo.dispose(); }
  CM.waves = CM.waves.filter((W) => !W.dead);
}

// ---- rage E · Molten Charge: he charges, dragging both burning swords through the floor, and ends in a rising slash
function castMoltenCharge() {
  if (CM.form !== 'rage' || !CM.rage) return;
  spend('mh'); startCd('mh');
  const dir = fwdOf(P.yaw, new THREE.Vector3());
  CM.act = { id: 'mh', t: 0, phase: 'run', dir, yaw: P.yaw, from: P.pos.clone(), hit: new Set(), trenchAcc: 0, end: 9, upStart: 0, upAt: 0, upDone: false };
  Sound.god('rage_transform', { gain: 0.55, rate: 1.35, noDuck: true });
  Sound.god('mine_arm', { gain: 1.0, rate: 0.72, noDuck: true });
  Sound.voice('f_cry', { chance: 0.85, priority: 3, cooldown: 0.5 });
  CM.act.loop = Sound.god('fire_loop', { gain: 0.8, loop: true, rate: 1.5 });
  FX2.burst(P.pos.clone().setY(1.2), 'cfire', { size: 0.9, sparks: 24, embers: 12, puffs: 3, bursts: 1, int: 0.6, light: true, distort: true });
  cmDust(P.pos, 6, 1.2);
  if (CM.rage) CM.rage.flare = 1;
}
function cmUpdateCharge(A, dt) {
  if (A.phase === 'run') {
    const sp = CM_CHARGE.dist / CM_CHARGE.dur, before = _c5.copy(P.pos);
    P.vel.set(A.dir.x * sp, 0, A.dir.z * sp);
    P.pos.addScaledVector(A.dir, sp * dt); resolveCircle(P.pos, 0.45);
    const moved = P.pos.distanceTo(before);
    Cam.shake = Math.max(Cam.shake, 0.28);
    // the burning trench: both blades carve the floor behind him
    A.trenchAcc += moved;
    const side = rightOf(A.yaw, _c3);
    while (A.trenchAcc > 0.6) {
      A.trenchAcc -= 0.6;
      for (const s of [-1, 1]) {
        const g = P.pos.clone().addScaledVector(A.dir, -1.3 - A.trenchAcc).addScaledVector(side, s * 1.15).setY(0);
        FX2.scorch(g, 'cfire', { radius: 0.62, dur: CM_CHARGE.trench + 1.6, int: 1.9, dark: new THREE.Color(0.12, 0.04, 0.015), darkAlpha: 0.85 });
        for (let i = 0; i < 3; i++) FX2.glow.spawn({ pos: g.clone().setY(0.1), vel: V3(rand(-1.5, 1.5) - A.dir.x * 3, rand(2, 5), rand(-1.5, 1.5) - A.dir.z * 3), life: rand(0.3, 0.6), size: rand(0.05, 0.09), sizeEnd: 0.01, cell: FXA.spark, stretch: 2.5, pal: 'cfire', temp: 1.2, tempEnd: 0.5, int: 2.2, gravity: -9 });
        FX2.fire.spawn({ pos: g.clone().setY(0.25), vel: V3(0, rand(1.2, 2.4), 0), life: rand(0.3, 0.5), size: rand(0.5, 0.8), sizeEnd: 0.1, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.4, int: 1.2 });
        CM.trench.push({ p: g, t: CM_CHARGE.trench, burn: cmDmg('mh', 'burn', 'burnScale') });
      }
      cmCrumbs(P.pos.clone().setY(0.2), 2, 0.6, 0.6);
    }
    // everything in his way: hit once, burned, thrown aside
    for (const d of Combat.dummies) {
      if (!d.alive || A.hit.has(d)) continue;
      const dx = d.pos.x - P.pos.x, dz = d.pos.z - P.pos.z;
      if (Math.hypot(dx, dz) < CM_CHARGE.width + d.radius) {
        A.hit.add(d);
        Combat.deal(d, cmDmg('mh'), 'ability', 'Molten Charge');
        cmBurningHit(d, 0.75);
        const lat = dx * A.dir.z - dz * A.dir.x;
        d.shove(_c4.set(A.dir.z, 0, -A.dir.x).multiplyScalar(lat >= 0 ? 2.3 : -2.3).addScaledVector(A.dir, 1.2), 1.4);
        Game.hitStop(0.04, 0.2);
      }
    }
    if (A.t >= CM_CHARGE.dur || (A.t > 0.08 && moved < sp * dt * 0.2)) cmChargeUp(A);
  } else if (!A.upDone && A.t >= A.upAt) cmChargeHit(A);
}
function cmChargeUp(A) {   // the end of the charge: the rising slash (the spinning upward slash clip)
  A.phase = 'up'; A.upStart = A.t; P.vel.set(0, 0, 0);
  Game.anim.play('ss', { noFx: true, speed: 1.25 });
  const real = (ct) => cmRageReal('ss', ct) / 1.25;
  A.upAt = A.t + real(1.07); A.end = A.t + real(1.95);
  if (A.loop) { A.loop.stop(0.4); A.loop = null; }
  Sound.god('sword_swing3', { gain: 1.15, rate: 0.82, delay: Math.max(0, real(1.07) - 0.18), noDuck: true });
  Sound.voice('f_slam', { priority: 4, gain: 1.1, cooldown: 0, delay: Math.max(0, real(1.07) - 0.4) });
}
function cmChargeHit(A) {
  A.upDone = true;
  const c = P.pos.clone(), dir = A.dir, at = c.clone().addScaledVector(dir, 2.2);
  Game.hitStop(0.12, 0.06); Cam.shake = Math.max(Cam.shake, 0.85); Cam.fovKick = 9;
  Sound.god('mine_boom', { gain: 0.9, rate: 0.95, pos: at, noDuck: true });
  FX2.slash(at.clone().setY(2.4), A.yaw, 'cfire', { r0: 1.6, r1: 3.8, a0: -1.7, a1: 1.7, roll: -Math.PI / 2, dur: 0.38, int: 2.0 });
  FX2.burst(at.clone().setY(1.2), 'cfire', { size: 1.3, sparks: 50, embers: 26, puffs: 4, bursts: 2, int: 0.8, light: true, distort: true });
  FX2.ring(at.clone().setY(0), 'cfire', { radius: CM_CHARGE.upR + 2, dur: 0.5, width: 0.08, int: 1.2 });
  for (let i = 0; i < 30; i++) FX2.glow.spawn({ pos: at.clone().setY(0.3).add(_c2.set(rand(-1.5, 1.5), 0, rand(-1.5, 1.5))), vel: V3(rand(-1, 1), rand(6, 12), rand(-1, 1)), life: rand(0.5, 0.9), size: rand(0.06, 0.12), sizeEnd: 0.01, cell: FXA.spark, stretch: 3, pal: 'cfire', temp: 1.2, tempEnd: 0.5, int: 2.2, gravity: -10, drag: 0.6 });
  VFX.cracks(at.clone().setY(0), 3, 2.4, { grow: 0.1, intensity: 1.4, color: CMC.fire });
  for (const d of dummiesInCone(c, dir, CM_CHARGE.upR, 1.25)) { Combat.deal(d, cmDmg('mh', 'up', 'upScale'), 'ability', 'Molten Charge'); cmKnockUp(d, 0.8, 1.7); cmBurningHit(d, 0.9); }
  if (CM.rage) { CM.rage.flare = 1; CM.rage.thud = 1; }
}
function cmUpdateTrench(dt) {
  if (!CM.trench.length) return;
  CM.trenchT -= dt; const tick = CM.trenchT <= 0; if (tick) CM.trenchT = 0.5;
  for (const S of CM.trench) { S.t -= dt; if (Math.random() < dt * 4) FX2.fire.spawn({ pos: _c2.set(S.p.x + rand(-0.2, 0.2), 0.15, S.p.z + rand(-0.2, 0.2)), vel: V3(0, rand(1, 2), 0), life: rand(0.25, 0.45), size: rand(0.3, 0.55), sizeEnd: 0.06, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.4, int: 1.2 }); }
  CM.trench = CM.trench.filter((S) => S.t > 0);
  if (!tick) return;
  for (const d of Combat.dummies) {
    if (!d.alive) continue;
    const S = CM.trench.find((s) => Math.hypot(d.pos.x - s.p.x, d.pos.z - s.p.z) < 0.85 + d.radius);
    if (S) Combat.deal(d, S.burn * 0.5, 'dot', 'Molten Charge');
  }
}

// ---- rage R · Skyfall: a leap into the sky, both swords crash down - a crater of molten cookie and a shockwave
function castSkyfall() {
  if (CM.form !== 'rage' || !CM.rage) return;
  spend('sk'); startCd('sk');
  const to = groundTarget(AB.sk.range * SU, 3);
  Game.anim.play('sky', { noFx: true });
  CM.act = { id: 'sk', t: 0, from: P.pos.clone(), to: to.clone(), yaw: P.yaw, landed: false, end: CM_SKY.land + 0.55 };
  Sound.god('stomp', { gain: 1.0, rate: 0.8, delay: Math.max(0, CM_SKY.up - 0.05) });
  Sound.god('mine_arm', { gain: 1.1, rate: 0.62, delay: Math.max(0, CM_SKY.land - 0.5), noDuck: true });
  Sound.voice('f_slam', { priority: 4, gain: 1.15, cooldown: 0, delay: Math.max(0, CM_SKY.land - 0.55) });
  // where he will land: a ring of embers closing in on the spot
  FX2.scorch(to, 'cfire', { radius: CM_SKY.radius * 0.5, dur: CM_SKY.land + 0.2, int: 0.6, darkAlpha: 0.2 });
  if (CM.rage) CM.rage.flare = 1;
}
function cmUpdateSky(A, dt) {
  const T = A.t;
  if (T >= CM_SKY.up && !A.landed) {
    const k = clamp((T - CM_SKY.up) / (CM_SKY.land - CM_SKY.up), 0, 1);
    if (!A.off) { A.off = true; cmDust(A.from, 10, 1.6); FX2.ring(A.from.clone().setY(0), 'cookie', { radius: 4, dur: 0.4, width: 0.06 }); Cam.shake = Math.max(Cam.shake, 0.5); }
    P.pos.lerpVectors(A.from, A.to, smoothstep(0, 1, k));
    P.y = CM_SKY.h * Math.sin(Math.PI * Math.pow(k, 0.72)); P.vy = 0; P.flying = true; P.grounded = false;
    // the blades leave ribbons of fire through the sky; embers rain off him on the way down
    if (Math.random() < dt * 40) FX2.glow.spawn({ pos: _c2.set(P.pos.x + rand(-1, 1), P.y + rand(1, 4), P.pos.z + rand(-1, 1)), vel: V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)), life: rand(0.4, 0.8), size: rand(0.05, 0.1), sizeEnd: 0.01, cell: FXA.ember, pal: 'cfire', temp: 1.1, tempEnd: 0.5, int: 1.9, gravity: -4 });
    if (k > 0.55 && Math.random() < dt * 30) FX2.fire.spawn({ pos: _c2.set(P.pos.x, P.y + 2.5, P.pos.z), vel: V3(0, 3, 0), life: 0.3, size: rand(0.8, 1.3), sizeEnd: 0.2, frames: 16, pal: 'cfire', temp: 1.0, tempEnd: 0.4, int: 1.2 });
  }
  if (!A.landed && T >= CM_SKY.land) { A.landed = true; P.pos.copy(A.to); P.y = 0; P.vy = 0; P.flying = false; P.grounded = true; cmSkyImpact(A); }
}
function cmSkyImpact(A) {
  const c = P.pos.clone().setY(0), R = CM_SKY.radius;
  Sound.god('mine_boom', { gain: 1.35, rate: 0.68, pos: c, noDuck: true }); Sound.god('stomp', { gain: 1.2, rate: 0.65 }); Sound.god('mine_place', { gain: 0.8, rate: 0.8, pos: c });
  Game.hitStop(0.16, 0.05); Cam.shake = Math.max(Cam.shake, 1.15); Cam.fovKick = 12;
  PostFX.shock(c.clone().setY(0.6), 1.3, 0.9); PostFX.aberr = Math.max(PostFX.aberr, 0.003);
  FX2.impact(c, 'cfire', { size: 2.2, ring: R / 2.2 + 1, sparks: 80, debris: 24, dustPal: 'choco', dustGlow: 0.2, int: 0.9, glowRocks: true, scorchDur: 5 });
  FX2.ring(c, 'cfire', { radius: R + 4, dur: 0.7, width: 0.09, int: 1.2 });
  VFX.later(0.1, () => FX2.ring(c, 'cookie', { radius: R + 9, dur: 1.0, width: 0.05 }));
  FX2.distort.ring(c.clone().setY(1), 30, 0.045, 0.8);
  VFX.cracks(c, R * 0.95, 4, { grow: 0.15, intensity: 1.6, color: CMC.fire });
  cmChips(c.clone().setY(0.5), 40, 1.8); cmCrumbs(c.clone().setY(0.6), 60, 1.8, 1.3);
  for (let i = 0; i < 44; i++) { const a = rand(0, TAU), sp = rand(6, 12); FX2.fire.spawn({ pos: V3(c.x + Math.cos(a) * 0.8, rand(0.2, 0.8), c.z + Math.sin(a) * 0.8), vel: V3(Math.cos(a) * sp, rand(0.3, 2), Math.sin(a) * sp), life: rand(0.35, 0.6), size: rand(0.6, 1.0), sizeEnd: 0.15, frames: 16, pal: 'cfire', temp: 1, tempEnd: 0.3, int: 1.2, drag: 2.6 }); }
  cmPool(c, CM_SKY.crater, 3.2, { hot: 1, burn: cmDmg('sk', 'burn', 'burnScale'), crumbs: false, slow: 0.25, src: 'Skyfall' });   // the crater of molten cookie
  for (const d of dummiesNear(c, R)) { Combat.deal(d, cmDmg('sk'), 'ability', 'Skyfall'); cmKnockUp(d, CM_SKY.lift, 1.4); cmBurningHit(d, 0.95); }
  if (CM.rage) { CM.rage.flare = 1; CM.rage.thud = 1; }
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
  if (!canCast('hr')) return;
  spend('hr'); startCd('hr');
  cmHorrorStart(d);
  Net.cast('K', 'hr', Net.idOf(d));   // (online: every page plays it around the victim, and a human victim lives it on its own screen)
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
// The victim: its god (the voice lines name it: g_coming_<god>, g_name_<god>) and the name its screen screams - a human
// victim's own nickname online, else its god's name
function cmVictimInfo(H) {
  const d = H.d;
  let god = null, name = '';
  if (H.self) {
    god = Net.bare(() => Kit && Kit.id);
    name = (Net.online && Net.st && typeof netName === 'function' && netName(Net.st.n)) || (GODS[god] ? GODS[god].name : 'YOU');
  } else {
    god = d.god || null;
    name = d.isRemotePlayer ? d.nick : GODS[d.god] ? GODS[d.god].name : d.name;
  }
  return { god: GODS[god] ? god : null, name: String(name || 'YOU').toUpperCase().slice(0, 18) };
}
// a voice line for this victim: its god's own take, else the generic one, else the older line
function cmHVoiceFor(H, base, fallback, o) {
  for (const k of [H.vg ? `${base}_${H.vg}` : null, `${base}_any`, fallback]) if (k && cmHVoice(H, k, o)) return true;
  return false;
}
// The victim's screen: the creeping dark, the glitch, the SCREAMER with its name, the black silence. Runs on the LOCAL
// screen; in single player / Arena the caster watches it as a cinematic (the camera cuts to the victim's POV).
function cmScreamImg() {
  if (!CM.screamImg) { const im = new Image(); im.decoding = 'async'; im.src = 'assets/fx/cookie_screamer.webp'; CM.screamImg = im; }
  return CM.screamImg;
}
function cookieHorrorScreen(H) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:55;pointer-events:none;overflow:hidden';
  const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const nm = document.createElement('div');
  nm.textContent = H.name;
  nm.style.cssText = "position:absolute;left:0;right:0;top:66%;text-align:center;font:900 clamp(44px,12.5vw,210px)/1 Impact,'Arial Black','Haettenschweiler',sans-serif;color:#ff1e06;letter-spacing:.05em;-webkit-text-stroke:3px #160000;text-shadow:0 0 22px #ff2400,0 0 70px #9a0000,0 8px 0 #1a0000;opacity:0;white-space:nowrap;will-change:transform";
  nm.style.fontSize = Math.round(Math.min(innerWidth * 0.125, 210, (innerWidth * 1.45) / Math.max(6, H.name.length))) + 'px';   // (a long name still fits the screen)
  el.appendChild(cv); el.appendChild(nm); document.body.appendChild(el);
  const img = cmScreamImg();
  const S = { t: 0, el, cv, nm, ctx: cv.getContext('2d'), done: false, glitchT: 0, slices: [] };
  S.update = (dt) => {
    S.t += dt;
    const W = cv.width = Math.round(innerWidth * 0.5), Hh = cv.height = Math.round(innerHeight * 0.5), g = S.ctx, t = S.t;
    g.clearRect(0, 0, W, Hh);
    // 1. the dark creeps in from the edges while the cookies rain and the music crawls
    const vig = smoothstep(0, 3.2, t) * (t < CM_HORROR.scream ? 1 : 0);
    if (vig > 0) { const gr = g.createRadialGradient(W / 2, Hh / 2, Hh * (0.42 - 0.18 * vig), W / 2, Hh / 2, Hh * 0.9); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(16,1,0,${0.85 * vig})`); g.fillStyle = gr; g.fillRect(0, 0, W, Hh); }
    // 2. the glitch: the face bleeds through in torn, offset slices (they change ~10x a second but only ever dimly:
    //    no full-screen flashes)
    if (t >= CM_HORROR.glitch && t < CM_HORROR.scream && img.complete && img.naturalWidth) {
      const k = (t - CM_HORROR.glitch) / (CM_HORROR.scream - CM_HORROR.glitch);
      S.glitchT -= dt;
      if (S.glitchT <= 0) { S.glitchT = 0.1; S.slices = Array.from({ length: 5 + Math.round(9 * k) }, () => ({ y: Math.random(), h: rand(0.01, 0.06), dx: rand(-0.08, 0.08), a: rand(0.2, 0.5) * (0.3 + k) })); }
      const iw = img.naturalWidth, ih = img.naturalHeight, sz = Math.max(W, Hh);
      for (const s of S.slices) { g.globalAlpha = Math.min(0.75, s.a); g.drawImage(img, 0, s.y * ih, iw, s.h * ih, (W - sz) / 2 + s.dx * W, (Hh - sz) / 2 + s.y * sz, sz, s.h * sz); }
      g.globalAlpha = 1;
      cmMyView(() => { PostFX.aberr = Math.max(PostFX.aberr, 0.004 + 0.012 * k); });   // (the victim's own screen, online: Net.bare)
    }
    // 3. the SCREAMER: the face LUNGES out of the dark into the screen (one sudden cut, then it holds, shaking) and
    //    screams the name; the name slams in under it in huge letters
    const live = t >= CM_HORROR.scream && t < CM_HORROR.silence;
    if (live && img.complete && img.naturalWidth) {
      const k = (t - CM_HORROR.scream) / (CM_HORROR.silence - CM_HORROR.scream), lunge = easeOutBack(Math.min(1, k * 7));
      // (the face fills the screen with its burning eyes high and the screaming mouth around the name)
      const sz = Math.max(W, Hh * 1.25) * (0.5 + 0.5 * lunge + 0.1 * k), sh = 7 * (1 - k * 0.6), x0 = (W - sz) / 2, y0 = Hh * 0.24 - sz * 0.25;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
      g.drawImage(img, x0 + rand(-sh, sh), y0 + rand(-sh, sh), sz, sz);
      if (k < 0.35) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.18 * (1 - k / 0.35); g.drawImage(img, x0 + 9, y0, sz, sz); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      const kn = clamp((k - 0.04) / 0.08, 0, 1);
      nm.style.opacity = String(kn);
      nm.style.transform = `translate(${rand(-7, 7) * (1 - k * 0.5)}px,${rand(-5, 5) * (1 - k * 0.5)}px) scale(${1.35 - 0.35 * easeOutCubic(kn) + 0.08 * k})`;
    } else nm.style.opacity = '0';
    // 4. the silence: black
    if (t >= CM_HORROR.silence && t < CM_HORROR.tele + 0.1) { g.fillStyle = `rgba(0,0,0,${1 - smoothstep(CM_HORROR.tele - 0.05, CM_HORROR.tele + 0.1, t)})`; g.fillRect(0, 0, W, Hh); }
    if (t > CM_HORROR.tele + 0.15) { S.done = true; el.remove(); }
  };
  S.dispose = () => { S.done = true; el.remove(); };
  return S;
}
// ---- the cookie rain: REAL cookies (the cookie model's low-poly LOD, one InstancedMesh), of all sizes, tumbling out of
// the dark sky, bouncing, cracking into crumbs, piling up around the victim; the clap's blast throws the pile away
let _cmLod = null;
function cmFloatGeo(src) {   // (the glTF's quantized attributes, as plain floats: the geometry is transformed below)
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const a = src.attributes[k]; if (!a) continue;
    const n = a.count, s = a.itemSize, arr = new Float32Array(n * s);
    for (let i = 0; i < n; i++) { arr[i * s] = a.getX(i); if (s > 1) arr[i * s + 1] = a.getY(i); if (s > 2) arr[i * s + 2] = a.getZ(i); }
    g.setAttribute(k, new THREE.BufferAttribute(arr, s));
  }
  if (src.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(src.index.array), 1));
  return g;
}
function cmCookieLod() {
  if (_cmLod) return _cmLod;
  const src = Assets.glb.cookie_prop, sc = src && src.scenes && (src.scenes[1] || src.scenes[0]);
  let geo = null, mat = null;
  if (sc) { sc.updateMatrixWorld(true); sc.traverse((o) => { if (o.isMesh && !geo) { geo = cmFloatGeo(o.geometry).applyMatrix4(o.matrixWorld); mat = o.material; } }); }
  if (!geo) {
    const pts = [[0, -0.08], [0.45, -0.08], [0.5, -0.03], [0.5, 0.03], [0.45, 0.08], [0, 0.09]].map(([x, y]) => new THREE.Vector2(x, y));
    geo = new THREE.LatheGeometry(pts, 24); mat = new THREE.MeshStandardMaterial({ map: cookieCrustTexture(), roughness: 0.85 });
  } else {
    geo.computeBoundingBox();
    const b = geo.boundingBox, sz = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
    geo.translate(-ctr.x, -ctr.y, -ctr.z);
    if (sz.x <= sz.y && sz.x <= sz.z) geo.rotateZ(Math.PI / 2); else if (sz.z <= sz.y && sz.z <= sz.x) geo.rotateX(Math.PI / 2);   // (its thin axis up: flat)
    geo.computeBoundingBox(); const s2 = geo.boundingBox.getSize(new THREE.Vector3());
    const k = 1 / Math.max(s2.x, s2.z); geo.scale(k, k, k);
    mat = mat.clone(); mat.envMapIntensity = 1.2;
  }
  geo.computeBoundingBox();
  _cmLod = { geo, mat, half: geo.boundingBox.max.y };
  return _cmLod;
}
function cmRainStart(H) {
  const L = cmCookieLod(), N = 150;
  const mesh = new THREE.InstancedMesh(L.geo, L.mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.count = 0;
  scene.add(mesh);
  H.rain = { mesh, items: [], acc: 0, N, thudT: 0 };
}
function cmRainSpawn(H, R, cx, cz) {
  let it = null;
  if (R.items.length >= R.N) { it = R.items.find((x) => x.rest) || R.items[0]; cmRainCrack(it); }
  else { it = {}; R.items.push(it); }
  const a = rand(0, TAU), r = 6 * Math.sqrt(Math.random()), big = Math.random() < 0.2;
  Object.assign(it, { p: new THREE.Vector3(cx + Math.cos(a) * r, rand(8, 14), cz + Math.sin(a) * r), v: new THREE.Vector3(rand(-0.6, 0.6), -rand(3, 6), rand(-0.6, 0.6)),
    q: new THREE.Quaternion().setFromEuler(_cE.set(rand(0, TAU), rand(0, TAU), rand(0, TAU))), w: new THREE.Vector3(rand(-7, 7), rand(-3, 3), rand(-7, 7)),
    s: big ? rand(0.85, 1.35) : rand(0.3, 0.65), bounce: 0, rest: false, dead: false, rq: new THREE.Quaternion().setFromEuler(_cE.set(rand(-0.12, 0.12), rand(0, TAU), rand(-0.12, 0.12))) });
}
function cmRainCrack(it) {   // a cookie breaks apart into crumbs and chunks
  if (!it || it.dead) return;
  it.dead = true;
  cmCrumbs(it.p, Math.round(6 + it.s * 14), 0.5 + it.s, 0.6); cmChips(it.p, Math.round(2 + it.s * 6), 0.4 + it.s * 0.6);
}
function cmRainTick(H, dt) {
  const R = H.rain; if (!R) return;
  const d = H.d, T = H.t, f = d.facing !== undefined ? fwdOf(d.facing, _c4) : _c4.set(0, 0, 0);
  const cx = d.pos.x + f.x * 4.5, cz = d.pos.z + f.z * 4.5;   // centred in front of its eyes
  const fk = Net.ctx ? Math.max(0.3, Net.ctx.fxK) : 1;
  // a few big cookies first ... then a downpour (it stops at the scream; what lies there stays until the clap)
  if (T >= CM_HORROR.rain && T < CM_HORROR.scream) R.acc += dt * lerp(9, 42, smoothstep(CM_HORROR.rain, CM_HORROR.glitch, T)) * fk;
  while (R.acc >= 1) { R.acc--; cmRainSpawn(H, R, cx, cz); }
  R.thudT -= dt;
  const L = _cmLod, m = R.mesh;
  let n = 0;
  for (const it of R.items) {
    if (it.dead) continue;
    const half = it.s * L.half;
    if (!it.rest) {
      it.v.y -= 15 * dt; it.p.addScaledVector(it.v, dt);
      _cQ.setFromEuler(_cE.set(it.w.x * dt, it.w.y * dt, it.w.z * dt)); it.q.multiply(_cQ);
      if (it.p.y <= half + (it.pile || 0)) {
        it.p.y = half + (it.pile || 0);
        if (it.bounce === 0 && -it.v.y > 2.5) {
          it.bounce = 1; it.v.y = -it.v.y * 0.3; it.v.x *= 0.5; it.v.z *= 0.5; it.w.multiplyScalar(0.4);
          cmCrumbs(it.p, 2 + Math.round(it.s * 6), 0.4 + it.s * 0.5, 0.5);
          if (R.thudT <= 0 && it.s > 0.3) { R.thudT = 0.12; cmHSfx(H, 'crunch', { gain: 0.22 + 0.3 * it.s, rate: rand(1.2, 1.6) }); }
          if (Math.random() < 0.28 || it.blast) { cmRainCrack(it); continue; }
        } else {
          it.rest = true; it.v.set(0, 0, 0);
          let k = 0; for (const o of R.items) if (o !== it && o.rest && !o.dead && Math.hypot(o.p.x - it.p.x, o.p.z - it.p.z) < (o.s + it.s) * 0.45) k++;
          it.pile = Math.min(0.5, k * 0.06); it.p.y = half + it.pile;
        }
      }
    } else it.q.slerp(it.rq, 1 - Math.exp(-12 * dt));
    m.setMatrixAt(n++, _cM.compose(it.p, it.q, _cS.setScalar(it.s)));
  }
  m.count = n; m.instanceMatrix.needsUpdate = true;
  if (R.items.length > 30 && R.items.some((x) => x.dead)) R.items = R.items.filter((x) => !x.dead);
}
// the clap's blast: the pile is thrown out in every direction; each cookie breaks where it comes down
function cmRainBlast(H, c) {
  const R = H.rain; if (!R) return;
  for (const it of R.items) {
    if (it.dead) continue;
    const dx = it.p.x - c.x, dz = it.p.z - c.z, L = Math.hypot(dx, dz) || 1, k = 1 / (1 + L * 0.25);
    it.rest = false; it.bounce = 0; it.blast = true; it.pile = 0;
    it.v.set((dx / L) * rand(6, 12) * k, rand(3, 7) * k + 1, (dz / L) * rand(6, 12) * k); it.w.set(rand(-12, 12), rand(-6, 6), rand(-12, 12));
  }
}
function cmRainEnd(H) {
  const R = H.rain; if (!R) return;
  H.rain = null;
  for (const it of R.items) if (!it.dead && it.rest) cmCrumbs(it.p, 3, 0.4, 0.3);
  cmDrop(R.mesh); R.mesh.dispose();
}
// the victim is CRUSHED between his hands: squeezed flat (sideways, along the clap), then it springs back
function cmSquashTarget(H) {
  if (H.self) return Net.bare(() => Game.thoth && Game.thoth.root);
  return H.d.mesh || null;
}
function cmUpdateSquash(H) {
  const S = H.squash; if (!S) return;
  const k = H.t - CM_HORROR.boom, env = k < 0 ? 0 : k < 0.06 ? k / 0.06 : 1 - smoothstep(0.55, 1.05, k);
  S.o.scale.set(S.s0.x * (1 - 0.58 * env), S.s0.y * (1 + 0.1 * env), S.s0.z * (1 + 0.22 * env));
  if (k > 1.1) { S.o.scale.copy(S.s0); H.squash = null; }
}
// ---- Cookie Horror online (14n_net.js). The caster's page plays it as in single player (his cinematic, the real blow,
// sent to the victim's owner). Every other page replays it in the caster's sandbox (Net.ctx): the world around the
// victim (the cookie rain, the teleport, the clap). A human VICTIM's own page lives it on its own screen too (H.mine):
// the dark, the music and his voice saying ITS god's name, the screamer screaming its nickname, the silence, then the
// clap's boom, shake and flash, its own body crushed. The sandbox puts my camera, screen and music back on the way out,
// so what the victim's screen gets goes through cmMyView (Net.bare: outside the sandbox, for real). Observers never get
// any of it on their screens; near the victim they hear the music and stings where it stands.
// total silence: the master bus fades out and comes back
function cmSilence(on) {
  const m = Sound.master, c = Sound.ctx; if (!m || !c) return;
  m.gain.cancelScheduledValues(c.currentTime);
  m.gain.setTargetAtTime(on ? 0 : (Sound.muted ? 0 : settings.volume), c.currentTime, on ? 0.03 : 0.01);
}
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
  const self = !!(Net.ctx && d.real && d.real.isSelf), mine = !Net.ctx || self;   // (my own cast, or me the victim of another player's)
  const H = CM.horror = { t: 0, d, mine, self, stage: 0, done: false, clap: 0, home: P.pos.clone() };
  const info = cmVictimInfo(H); H.vg = info.god; H.name = info.name;
  H.screen = mine ? cookieHorrorScreen(H) : null;
  // the music comes first (a slammed low hit, then a creeping music box and a heartbeat that speeds up)
  H.music = cmHSfx(H, 'horror_music', { gain: 1.0 });
  if (mine) cmMyView(() => { Sound.duckMusic(0.05, CM_HORROR.boom + 1, 1.5); WORLD.dim = 0.62; PostFX.vigTarget = 0.55; });
  cmScreamImg(); cmCookieLod();
}
function cmUpdateHorror(dt, t) {
  const H = CM.horror; if (!H) return;
  cmHorrorFx(H, () => cmHorrorTick(H, dt, t));
}
function cmHorrorTick(H, dt, t) {
  H.t += dt;
  const d = H.d, T = H.t;
  if (H.screen && !H.screen.done) H.screen.update(dt);
  // the sky goes dark as the cookies start to fall
  if (H.mine && T < CM_HORROR.scream) cmMyView(() => { WORLD.dim = lerp(0.66, 0.5, smoothstep(0.3, 3.5, T)); PostFX.vigTarget = lerp(0.55, 0.8, smoothstep(0.3, 4, T)); });
  if (!H.rain && T >= CM_HORROR.rain - 0.05 && T < CM_HORROR.scream) cmRainStart(H);
  cmRainTick(H, dt);
  if (H.stage === 0 && T >= CM_HORROR.coming) { H.stage = 1; cmHVoiceFor(H, 'g_coming', 'g_horror_whisper', { priority: 5, cooldown: 0, gain: 1.15, hold: 2.6 }); }
  if (H.stage === 1 && T >= CM_HORROR.glitch) { H.stage = 2; cmHSfx(H, 'glitch', { gain: 0.9 }); }
  if (H.stage === 2 && T >= CM_HORROR.scream) {
    H.stage = 3;
    cmHSfx(H, 'scream_sting', { gain: 1.25, noDuck: true });
    cmHVoiceFor(H, 'g_name', 'g_scream', { priority: 6, gain: 1.35, cooldown: 0, hold: 1.8 });
    if (H.music) { H.music.stop(0.08); H.music = null; }
    if (H.mine) cmMyView(() => { Cam.shake = Math.max(Cam.shake, 0.6); });
  }
  if (H.stage === 3 && T >= CM_HORROR.silence) { H.stage = 4; if (H.mine) { cmSilence(true); H.silent = true; } }   // (only the screens that live it go silent)
  if (H.stage === 4 && T >= CM_HORROR.tele) {
    H.stage = 5; if (H.silent) { cmSilence(false); H.silent = false; }
    // he is simply THERE: right in front of the victim, facing it, arms flung wide
    const f = (d.facing !== undefined) ? fwdOf(d.facing, _c1) : _c1.set(P.pos.x - d.pos.x, 0, P.pos.z - d.pos.z).normalize();
    const dist = (d.radius || 0.5) + 1.45;
    P.pos.set(d.pos.x + f.x * dist, 0, d.pos.z + f.z * dist); P.vel.set(0, 0, 0);
    P.yaw = Math.atan2(d.pos.x - P.pos.x, d.pos.z - P.pos.z); Game.thoth.root.rotation.y = P.yaw;
    if (!Net.ctx) Cam.yaw = P.yaw;   // (my camera only behind my own god)
    cmHSfx(H, 'teleport', { gain: 1.0 });
    cmBurst(P.pos.clone().setY(1.4), 0.7, { pal: 'horror', distort: true });
    Game.anim.play(Game.anim.acts && Game.anim.acts.clap ? 'clap' : 'clapwind');
    Sound.voice('laugh', { priority: 3, cooldown: 0, gain: 0.8 });
    if (H.mine) cmMyView(() => { WORLD.dim = 0.78; PostFX.vigTarget = 0.35; });
  }
  if (H.stage === 5) H.clap = clamp((T - CM_HORROR.tele) / (CM_HORROR.boom - CM_HORROR.tele), 0, 1);
  // the slow motion: it eases in as the hands come together, holds through the BOOM, eases back out (real seconds)
  // (a replay's hit-stop never reaches my world: Game.hitStop and the sandbox; the victim's own game never slows)
  if (H.stage >= 5 && !H.slowDone && T >= CM_HORROR.boom - CM_HORROR.slow.lead) cmHorrorSlow(H, dt);
  if (H.stage === 5 && T >= CM_HORROR.boom) { H.stage = 6; cmHorrorBoom(H); }
  cmUpdateSquash(H);
  if (H.stage === 6 && T >= CM_HORROR.end && H.slowDone) {
    H.done = true; CM.horror = null; cmRainEnd(H);
    if (H.squash) { H.squash.o.scale.copy(H.squash.s0); H.squash = null; }
    if (H.mine) cmMyView(() => { WORLD.dim = 1; PostFX.vigTarget = 0; });
  }
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
  const d = H.d, c = P.pos.clone().lerp(d.pos, 0.5).setY(0), hands = P.pos.clone().addScaledVector(fwdOf(P.yaw, _c1), 0.9).setY(1.9);
  cmHSfx(H, 'clap_boom', { gain: 1.5, noDuck: true, rate: 0.78 });   // (pitched down for the slow motion; its own long echo)
  cmHSfx(H, 'sonic_boom', { gain: 0.6, shared: true, noDuck: true, rate: 0.7 });
  cmHSfx(H, 'crunch', { gain: 1.2, rate: 0.6 });   // (the crunch of the body between his palms)
  VFX.later(0.6, () => cmHVoice(H, 'g_clap_line', { priority: 5, cooldown: 0 }));
  // (one warm flash and a shake: on my screen if I cast it or am its victim)
  if (H.mine) cmMyView(() => { Cam.shake = 1.6; Cam.fovKick = 15; PostFX.shock(hands, 1.7, 1.0); PostFX.aberr = 0.006; });
  VFX.flash(hands, CMC.caramel, 34, 0.5);
  FX2.burst(hands, 'cookie', { size: 1.6, sparks: 70, embers: 40, puffs: 8, bursts: 2, int: 0.55, smokeGlow: 0.25 });
  FX2.burst(hands, 'horror', { size: 1.1, sparks: 30, embers: 20, puffs: 0, bursts: 1, int: 0.6, light: false, distort: false });
  FX2.ring(c, 'cookie', { radius: 9, dur: 0.6, width: 0.09, int: 1.2 });
  VFX.later(0.1, () => FX2.ring(c, 'choco', { radius: 16, dur: 0.9, width: 0.06 }));
  VFX.later(0.22, () => FX2.ring(c, 'horror', { radius: 26, dur: 1.2, width: 0.04, int: 1.0 }));   // the BOOM rolls across the whole hall
  FX2.distort.ring(hands, 40, 0.045, 0.9);
  FX2.debris(c.clone().setY(0.4), null, 24, 1.4, FX2.pal('cookie'));
  cmChips(hands, 34, 1.7); cmCrumbs(hands, 70, 1.9);
  for (let i = 0; i < 46; i++) { _c2.set(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize(); FX2.solid.spawn({ pos: hands, vel: _c2.clone().multiplyScalar(rand(4, 12)), life: rand(1.2, 2.0), size: rand(0.06, 0.13), sizeEnd: 0.05, cell: FXA.rock, pal: Math.random() < 0.6 ? 'cookie' : 'choco', temp: 0, tempEnd: 0, alpha: 1, gravity: -6, drag: 1.2, floor: true, rotVel: rand(-6, 6) }); }
  // the body between his palms: a burst of it all sideways out of the clap, dust driven out flat along the floor
  const side = rightOf(P.yaw, _c3);
  for (let i = 0; i < 28; i++) { const s = Math.random() < 0.5 ? 1 : -1; FX2.solid.spawn({ pos: d.pos.clone().setY(1.2), vel: side.clone().multiplyScalar(s * rand(5, 11)).add(_c4.set(rand(-1.5, 1.5), rand(0.5, 4), rand(-1.5, 1.5))), life: rand(0.8, 1.3), size: rand(0.06, 0.14), sizeEnd: 0.05, cell: FXA.drop, pal: 'choco', temp: 0.1, tempEnd: 0, alpha: 1, gravity: -12, drag: 0.5, floor: true, stretch: 1.6 }); }
  cmDust(d.pos, 14, 1.8);
  FX2.scorch(c, 'cookie', { radius: 4, dur: 5, int: 0.6, dark: new THREE.Color(0.15, 0.06, 0.02), darkAlpha: 0.65 });
  VFX.cracks(c, 5, 4, { grow: 0.12, intensity: 1.3, color: CMC.caramel });
  cmRainBlast(H, c);
  const so = cmSquashTarget(H); if (so) H.squash = { o: so, s0: so.scale.clone() };
  // the victim takes the highest single hit in the game; anyone close by is blown back
  // (online the caster's page deals it, Combat.deal -> its owner; a replay deals nothing)
  if (d.alive) {
    Combat.deal(d, cmDmg('hr'), 'final', 'Cookie Horror', true);
    cmBurst(d.pos.clone().setY(1.4), 1.0, { pal: 'horror', distort: false });
  }
  cmText(d.pos.clone().setY((d.height || 2) + 1.4), 'CRUSHED', '#ff3a20', true);
  cmCrumbDrop(d);
  for (const u of dummiesNear(c, CM_HORROR.splashR)) {
    if (u === d) continue;
    Combat.deal(u, cmDmg('hr') * CM_HORROR.splash, 'final', 'Cookie Horror');
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
// the clap itself: the 'clap' clip flings both arms wide and brings them together; two-bone IK over it makes the palms
// meet exactly on the victim (in front of his chest) at the BOOM
function cmClapPost(rig, dt, anim) {
  if (Game.anim !== anim) return;   // (another player's copy of him posed outside his kit's sandbox: his state is not in CM then, 14n_net.js)
  cmHeavyPost(rig, dt, anim);
  const H = CM.horror; if (!H || H.stage < 5) return;
  const k = H.clap, after = H.stage === 6 ? clamp((H.t - CM_HORROR.boom) / 0.6, 0, 1) : 0;
  const w = 0.75 * (H.stage === 6 ? 1 - smoothstep(0.35, 1, after) : 1) * smoothstep(0, 0.1, H.t - CM_HORROR.tele);
  if (w < 0.01) return;
  const yaw = rig.root.rotation.y, fwd = _c2.set(Math.sin(yaw), 0, Math.cos(yaw)), left = _c3.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const chest = _c4.setFromMatrixPosition(rig.b('Spine02').matrixWorld);
  const spread = lerp(1.25, 0.05, Math.pow(k, 2.4)), fwdD = lerp(0.3, 0.8, k), upD = lerp(0.4, 0.05, k);
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
// Cookie Rage's whole 10 s at its best (one target, every hit landing): the transform slam, the casts of its three abilities
// their cooldowns allow, sword swings in the time left. Cookie Horror stays at least twice this (god-kit-design.md).
function cmRageBudget() {
  const sw = cmDmg('cr', 'sword', 'swordScale'), dur = CM_RAGE.dur;
  const n = (cd, cast) => Math.max(1, Math.floor((dur - cast) / cd) + 1);
  const nx = n(cdOf('bx'), 1.0), nm = n(cdOf('mh'), 1.3), ns = n(cdOf('sk'), 1.7);
  const used = nx * 1.0 + nm * 1.3 + ns * 1.7, swingT = Math.max(0, dur - used);   // (the sword combo at full rage attack speed: ~2.8 swings' worth a second, chops and finishers counted)
  const bx = 2 * cmDmg('bx') * 1.24, mh = cmDmg('mh') + cmDmg('mh', 'up', 'upScale') + cmDmg('mh', 'burn', 'burnScale') * 2.6, sk = cmDmg('sk') + cmDmg('sk', 'burn', 'burnScale') * 3.2;
  return Math.round(cmDmg('cr', 'slam', 'slamScale') + nx * bx + nm * mh + ns * sk + swingT * sw * 2.8);
}
const COOKIE_INFO = {
  passive: { name: 'Cookie Lover', kind: 'Passive · Heal',
    text: `Every ${CM_EAT.every} seconds Cookie Monster eats a cookie (he keeps walking while he chews) and gets back ${Math.round(CM_EAT.heal * 100)}% of his max health and ${Math.round(CM_EAT.mana * 100)}% of his max mana. <b>Crumbs:</b> his Chomp, his rolling wheel, his Molten Chocolate and every third punch cover enemies in cookie crumbs (up to 3). An enemy with 3 Crumbs is FOOD – Chomp devours it, and a Devour counts as a cookie.`,
    rows: () => [['Next cookie', `${Math.max(0, CM.eatT).toFixed(1)} s`], ['Health', `${Math.round(CM_EAT.heal * 100)}% = ${Math.round(maxHp() * CM_EAT.heal)}`], ['Mana', `${Math.round(CM_EAT.mana * 100)}% = ${Math.round(maxMp() * CM_EAT.mana)}`], ['Crumbs', `max ${CM_CRUMB.max} · last ${CM_CRUMB.dur} s`]] },
  cp: { name: 'Chomp', kind: 'Lunge · Cone · Crumbs · Physical',
    text: 'He lunges forward and giant cookie JAWS with chocolate fangs slam shut in front of him: damage and +1 Crumb to everything they catch. On an enemy with 3 Crumbs it becomes DEVOUR: the jaws grab it and bite three more times – one bite per Crumb, eating them – and he heals as if he had eaten a cookie.',
    rows: () => { const r = cmRank('cp'); return [['Damage', `${AB.cp.dmg[r - 1]} (+75% of ${cmPw()} power) = ${Math.round(cmDmg('cp'))}`], ['Devour', `3 × ${Math.round(cmDmg('cp', 'devour', 'devourScale'))} (${AB.cp.devour[r - 1]} +40% per Crumb) + ${Math.round(CM_EAT.heal * 100)}% health`], ['Lunge', `${CM_CHOMP.lunge} m`], ['Cooldown', `${cdOf('cp').toFixed(1)} s`]]; } },
  cf: { name: 'Crumble Form', kind: 'Toggle · Free · Speed · Crumbs',
    text: `He curls up into a giant rolling cookie wheel: +${CM_ROLL.speed * 100}% speed and heavy momentum. Whoever he rolls over is RAMMED – a crunchy hit, shoved aside and given a Crumb (once per second per enemy). Roll through your own Molten Chocolate and the wheel comes out coated: it burns, hits ${Math.round((CM_ROLL.coatK - 1) * 100)}% harder and leaves a burning chocolate trail for ${CM_ROLL.coat} s. No other abilities while rolling. Free, no cooldown.`,
    rows: () => { const r = cmRank('cf'); return [['Ram damage', `${AB.cf.roll[r - 1]} (+25%) = ${Math.round(cmDmg('cf', 'roll', 'rollScale'))} · coated ×${CM_ROLL.coatK}`], ['Speed', `+${CM_ROLL.speed * 100}%`], ['Cost', '0 · no cooldown'], ['Now', CM.form === 'roll' ? (CM.roll && CM.roll.coat > 0 ? 'rolling · COATED' : 'rolling') : 'on foot']]; } },
  mo: { name: 'Molten Chocolate', kind: 'Ground · Area · Slow · Burn · Crumbs',
    text: `He hurls a huge chocolate-chip cookie that bursts on impact into a bubbling, steaming pool of molten chocolate. Enemies inside are stuck in it (${CM_MOLTEN.slow * 100}% slow), burn, and get a Crumb every ${CM_MOLTEN.crumbEvery} s. Roll through it in Crumble Form to coat the wheel.`,
    rows: () => { const r = cmRank('mo'); return [['Impact', `${AB.mo.dmg[r - 1]} (+50%) = ${Math.round(cmDmg('mo'))}`], ['Burn', `${Math.round(cmDmg('mo', 'burn', 'burnScale'))} / s for ${CM_MOLTEN.dur} s`], ['Pool', `${CM_MOLTEN.radius} m`], ['Cooldown', `${cdOf('mo').toFixed(1)} s`]]; } },
  cr: { name: 'Cookie Rage', kind: 'Transformation · Melee · Physical',
    text: `He roars in slow motion – the ground shakes and splits – and explodes in fire and crumbs into a 4.75-metre living cookie with two molten COOKIE SWORDS for ${CM_RAGE.dur} s (+${CM_RAGE.as * 100}% attack speed, +${CM_RAGE.ms * 100}% speed). His attacks become a flowing two-sword combo with a finisher, and Q, E and R become the rage's own abilities: <b>Burning Cross</b>, <b>Molten Charge</b> and <b>Skyfall</b>.`,
    rows: () => { const r = cmRank('cr'), sw = Math.round(cmDmg('cr', 'sword', 'swordScale')); return [['Transformation', `${AB.cr.slam[r - 1]} (+100%) = ${Math.round(cmDmg('cr', 'slam', 'slamScale'))}`], ['Per sword swing', `${AB.cr.sword[r - 1]} (+20%) = ${sw} · chop ×1.25 = ${Math.round(sw * 1.25)}`], ['Combo', 'spin slash ×1.8 · leap ×0.8 + ×2.4 · slam ×2.8'], ['Whole rage (max)', `≈ ${cmRageBudget()}`], ['Duration', `${CM_RAGE.dur} s`], ['Cooldown', `${cdOf('cr').toFixed(0)} s`]]; } },
  bx: { name: 'Burning Cross', kind: 'Rage · Line · Piercing · Burn',
    text: 'Both burning swords cross before his chest and are torn apart: two crescents of fire fly out in an X, ripping through everything in a long line. Each crescent hits once and sets the target burning – right where they cross, it takes both.',
    rows: () => { const r = cmRank('bx'); return [['Per crescent', `${AB.bx.dmg[r - 1]} (+30%) = ${Math.round(cmDmg('bx'))}`], ['Range', `${Math.round(AB.bx.range * SU)} m`], ['Cooldown', `${cdOf('bx').toFixed(1)} s`]]; } },
  mh: { name: 'Molten Charge', kind: 'Rage · Dash · Knock-up · Burn',
    text: `He charges ${CM_CHARGE.dist} m, dragging both swords through the floor: a burning trench behind him, everything in his way burned and thrown aside. At the end a rising slash throws everyone in front of him into the air.`,
    rows: () => { const r = cmRank('mh'); return [['Charge', `${AB.mh.dmg[r - 1]} (+40%) = ${Math.round(cmDmg('mh'))}`], ['Rising slash', `${AB.mh.up[r - 1]} (+30%) = ${Math.round(cmDmg('mh', 'up', 'upScale'))} + knock-up`], ['Trench', `${Math.round(cmDmg('mh', 'burn', 'burnScale'))} / s for ${CM_CHARGE.trench} s`], ['Cooldown', `${cdOf('mh').toFixed(1)} s`]]; } },
  sk: { name: 'Skyfall', kind: 'Rage · Leap · Area · Knock-up',
    text: 'He leaps high into the sky and crashes down with both swords on the aimed spot: a shockwave, everything around thrown up, and a crater of molten cookie that keeps burning.',
    rows: () => { const r = cmRank('sk'); return [['Damage', `${AB.sk.dmg[r - 1]} (+60%) = ${Math.round(cmDmg('sk'))}`], ['Crater', `${Math.round(cmDmg('sk', 'burn', 'burnScale'))} / s for 3 s`], ['Radius', `${CM_SKY.radius} m`], ['Cooldown', `${cdOf('sk').toFixed(1)} s`]]; } },
  hr: { name: 'Cookie Horror', kind: 'Final ability · Horror · True damage · Single target',
    text: 'Choose ONE enemy god, anywhere on the map. Scary music creeps in, the sky goes dark and REAL cookies start raining down on the victim … a voice whispers its name: Cookie Monster is coming for you … the picture glitches … a screaming cookie face lunges into the screen and SCREAMS ITS NAME … then dead silence. And then he is standing right in front of it, flings his arms wide and CLAPS – crushing it between his hands with a boom heard across the whole hall. The highest single-target damage in the game.',
    rows: () => { const r = cmRank('hr'), dmg = Math.round(cmDmg('hr')); return [['Damage', `${AB.hr.dmg[r - 1]} (+1000% of ${cmPw()} power) = ${dmg} true damage`], ['vs. Cookie Rage', `${(dmg / Math.max(1, cmRageBudget())).toFixed(1)}× its whole 10 s`], ['Around', `${CM_HORROR.splash * 100}% within ${CM_HORROR.splashR} m`], ['Cost', `${costOf('hr')} mana`], ['Cooldown', `${cdOf('hr').toFixed(0)} s`]]; } },
};
function cmCleanup() {
  if (CM.chomp) { cmJawsBreak(CM.chomp); CM.chomp = null; }
  for (const T of CM.throws) cmDropCookie(T.g); CM.throws = [];
  for (const Q of CM.pools) { if (Q.haze) Q.haze.dead = true; cmDrop(Q.m); Q.m.geometry.dispose(); Q.m.material.dispose(); } CM.pools = [];
  for (const W of CM.waves) { cmDrop(W.m); W.mat.dispose(); if (W.geo) W.geo.dispose(); } CM.waves = [];
  CM.trail = []; CM.trench = [];
  for (const d of [...CM.crumbs.keys()]) cmCrumbDrop(d);
  if (CM.act) cmEndAct();
}
registerGod({
  id: 'cookie', dbg: CM, name: 'Cookie Monster', title: 'The Cookie Nightmare', epithet: 'The Cookie Horror', pantheon: 'Unknown', role: 'Warrior',
  color: '#e0782a', glyphs: '🍪 ✹ ☠ ✦ ◉', asset: 'cookie', stats: COOKIE_STATS, order: CM_ORDER.normal.slice(), allIds: [...CM_ORDER.normal, ...CM_RAGE_IDS], ab: cookieAB,
  blurb: 'A hulking brute with a cracked chocolate-chip cookie for a head – he covers enemies in crumbs and EATS them: giant cookie jaws, a rolling cookie wheel, molten chocolate, burning cookie swords and the finale <em>Cookie Horror</em>.',
  info: COOKIE_INFO, physical: true, ownerOnly: true, noBot: true, lockedTitle: 'steens secret, good luck',
  textColor: '#ffc27a', finalColor: '#ff3a20', fxColor: CMC.caramel, accent: CMC.caramel,
  get accel() { return CM.form === 'roll' ? CM_ROLL.accel : CM.form === 'rage' ? 3.6 : 3.2; },   // (a heavy body: slow to get going, slow to stop)
  init() {
    CM.home = { rig: Game.thoth, anim: Game.anim };
    CM.form = 'normal'; CM.eatT = 6; CM.eat = null; CM.combo = 0; CM.comboT = 0; CM.cookieBack = 0;
    CM.crumbs = new Map(); CM.chomp = null; CM.throws = []; CM.pools = []; CM.trail = []; CM.waves = []; CM.trench = []; CM.act = null;
    if (CM.home.rig.propL) CM.home.rig.propL.visible = false;
    CM.home.anim.post = cmClapPost;
    if (!CM.home.anim._cmStep) { const a = CM.home.anim, s0 = a.onStep; a._cmStep = true; a.onStep = (p) => { if (s0) s0(p); if (Kit === GODS.cookie && Game.anim === a) cmFootfall(p); }; }
    CM.thud = 0;
    cmScreamImg();
  },
  dispose() {
    cmPickerClose();
    if (CM.horror) {
      const H = CM.horror; if (H.screen) H.screen.dispose(); if (H.music) H.music.stop(0.1); CM.horror = null; cmRainEnd(H);
      if (H.squash) H.squash.o.scale.copy(H.squash.s0);
      if (!Net.ctx) { cmSilence(false); Game.stopT = 0; Game.stopScale = 1; }
      else if (H.mine) { if (H.silent) cmSilence(false); cmMyView(() => { WORLD.dim = 1; PostFX.vigTarget = 0; }); }   // (its victim's screen comes back: the caster fell, left ...)
    }
    cmCleanup();
    if (CM.rage) { if (CM.rage.charge) CM.rage.charge.dead = true; if (CM.rage.sfx) CM.rage.sfx.stop(0.1); if (CM.rage.aura) CM.rage.aura.dead = true; if (CM.rage.mist) CM.rage.mist.dead = true; if (CM.rage.haze) CM.rage.haze.dead = true; cmSwapForm(false); CM.rage = null; }
    if (CM.rageR && CM.rageR.ribbons) for (const rb of CM.rageR.ribbons) rb.reset();
    for (const L of CM.lifts) L.d.lift = 0; CM.lifts = [];
    if (CM.roll) { if (CM.roll.loop) CM.roll.loop.stop(0.1); for (const M of CM.roll.mats) M.m.dispose(); cmDropCookie(CM.roll.W); CM.roll = null; }
    CM.form = 'normal'; cmSetOrder(false);
    if (CM.home) { CM.home.rig.root.visible = true; CM.home.anim.post = null; if (CM.home.rig.propL) CM.home.rig.propL.visible = false; if (CM.home.rig.prop) CM.home.rig.prop.visible = true; }
    for (const a of CM.auras) a.dead = true; CM.auras = [];
    WORLD.dim = 1; PostFX.vigTarget = 0; P.asBuff = 1;
  },
  intercept(id) {
    if (CM.pick || (CM.horror && !CM.horror.done)) return true;
    if (CM.form === 'roll' && id !== 'cf') { HUD.warn('Rolling – press E to stand up'); return true; }
    if (CM.form === 'rage') {
      if (CM_RAGE_IDS.includes(id)) return false;   // (the rage's own Q E R: cast as usual)
      HUD.warn(id === 'hr' ? 'Not in Cookie Rage' : 'Cookie Rage is already burning'); return true;
    }
    if (CM_RAGE_IDS.includes(id)) return true;   // (a rage ability outside the rage: nothing)
    if (id === 'cf') { if (CM.form === 'normal' || CM.form === 'roll') { castCrumble(); } return true; }   // the free toggle (no mana, no cooldown)
    if (id === 'hr' && !CM.pick) { if (!Net.ctx && canCast('hr')) cmPickerOpen(); return true; }   // (a replay: the victim comes as its own event, castOn)
    return false;
  },
  // online, another player's Cookie Monster (14n_net.js, the K event): he ate a cookie, or chose his Cookie Horror victim
  castOn(id, d) {
    if (id === 'eat') { if (!CM.eat) cmStartEat(); }
    else if ((id === 'hr' || id === 'ch') && d && d.alive && !CM.horror) cmHorrorStart(d);
  },
  busy: cmBusy,
  cast(id) { const f = ({ cp: castChomp, cf: castCrumble, mo: castMolten, cr: castCookieRage, hr: () => cmPickerOpen(), bx: castBurningCross, mh: castMoltenCharge, sk: castSkyfall })[id]; if (f) f(); },
  basic: cookieBasic,
  preUpdate() { if (CM.pick) cmPickerInput(); },
  rmb() { if (CM.pick) { cmPickerClose(); Sound.cancel(); } },
  moveOverride() {
    if ((CM.horror && !CM.horror.done) || CM.pick || (CM.rage && CM.rage.phase === 'in')) { P.vel.set(0, 0, 0); return true; }
    if (CM.act) { if (!(CM.act.id === 'mh' && CM.act.phase === 'run')) P.vel.set(0, 0, 0); return true; }   // (his rage abilities move him themselves)
    if (CM.chomp && CM.chomp.t < CM_CHOMP.lungeEnd + 0.05) { P.vel.set(0, 0, 0); return true; }
    return false;
  },
  speedMul() { return CM.form === 'roll' ? 1 + CM_ROLL.speed : CM.form === 'rage' ? 1 + CM_RAGE.ms : 1; },
  noJump() { return cmBusy() || CM.form === 'roll'; },
  animVel() { return (CM.horror && !CM.horror.done) || CM.pick || CM.form === 'roll' || (CM.act && !(CM.act.id === 'mh' && CM.act.phase === 'run')) ? _v1.set(0, 0, 0) : P.vel; },   // (rolling: the hidden body stands still - no steps, no footprints)
  lockYaw() { return !!((CM.horror && !CM.horror.done) || CM.act || (CM.chomp && !CM.chomp.bit)); },
  dashing() { return CM.form === 'roll' || !!(CM.act && CM.act.id === 'mh' && CM.act.phase === 'run'); },
  eyeBoost() { return (CM.horror ? 1.6 : 0) + (CM.form === 'rage' ? 2.2 + 0.4 * Math.sin(Game.time * 9) : 0) + (CM.eat ? 0.4 : 0) + (CM.chomp ? 0.8 : 0); },   // (rage: blazing)
  // the cinematic cut to the victim's eyes during the music, the cookie rain, the glitch and the scream: it looks up into
  // the dark sky as the first cookies fall, then straight ahead into what is coming
  postCamera() {
    const H = CM.horror; if (!H || H.t >= CM_HORROR.silence + 0.05) return;
    const d = H.d, yaw = d.facing !== undefined ? d.facing : Math.atan2(P.pos.x - d.pos.x, P.pos.z - d.pos.z);
    const eye = _c1.set(d.pos.x, (d.height || 2) * 0.88 + (d.lift || 0), d.pos.z).addScaledVector(fwdOf(yaw, _c2), 0.35);
    camera.position.copy(eye).add(_c3.set(Math.sin(H.t * 0.9) * 0.02, Math.sin(H.t * 1.3) * 0.015, 0));
    const up = 3.2 * smoothstep(0.4, 1.4, H.t) * (1 - smoothstep(2.4, 3.6, H.t));
    camera.lookAt(_c4.copy(eye).addScaledVector(fwdOf(yaw + Math.sin(H.t * 0.4) * 0.12, _c2), 6).add(_c5.set(0, -0.35 + up, 0)));
    camera.fov = 58; camera.updateProjectionMatrix();
  },
  update(dt, t) {
    CM.comboT = Math.max(0, CM.comboT - dt);
    P.asBuff = CM.form === 'rage' ? 1 + CM_RAGE.as : 1;
    // the abilities off the bar (the other form's) keep cooling down
    for (const k of [...CM_ORDER.normal, ...CM_RAGE_IDS]) if (!ABILITY_ORDER.includes(k)) P.cd[k] = settings.noCooldowns ? 0 : Math.max(0, (P.cd[k] || 0) - dt);
    // the cookie in his hand regrows after he throws it
    const pr = CM.home && CM.home.rig.prop;
    if (pr) { if (CM.cookieBack > 0) { CM.cookieBack -= dt; pr.visible = false; if (CM.cookieBack <= 0) { pr.visible = true; pr.scale.setScalar(0.01); } } else if (pr.scale.x < 1) pr.scale.setScalar(Math.min(1, pr.scale.x + dt * 4)); }
    cmUpdateEat(dt); cmUpdateChomp(dt); cmUpdateRoll(dt); cmUpdateThrows(dt); cmUpdatePools(dt, t); cmUpdateTrail(dt);
    cmUpdateRage(dt, t); cmUpdateWaves(dt, t); cmUpdateTrench(dt); cmUpdateHorror(dt, t); cmUpdateLifts(dt); cmUpdateCrumbs(dt, t);
    if (CM.form === 'normal' && Math.random() < dt * 2.5) cmCrumbs(cmMouth(_c3).add(_c4.set(rand(-0.2, 0.2), 0.2, rand(-0.2, 0.2))), 1, 0.3, 0.2);   // his head sheds crumbs
  },
  onKill(d) { CM.kills++; },
  targeter() {
    if (P.targeting === 'mo') { const c = groundTarget(AB.mo.range * SU, 3); circleTarget.show(c, CM_MOLTEN.radius, CMC.caramel); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.3, 0.3); }
    else if (P.targeting === 'sk') { const c = groundTarget(AB.sk.range * SU, 3); circleTarget.show(c, CM_SKY.radius, CMC.fire); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.3, 0.3); }
  },
  armed(id) { return (id === 'cf' && CM.form === 'roll') || (id === 'cr' && CM.form === 'rage') || (id === 'hr' && !!(CM.pick || CM.horror)) || (!!CM.act && CM.act.id === id); },
  cdHidden(id) { return id === 'cf'; },
  // Chomp shows how many enemies are food (3 Crumbs) right now
  stack(id) { if (id !== 'cp') return ''; let n = 0; for (const c of CM.crumbs.values()) if (c.n >= CM_CRUMB.max) n++; return n ? `${n}🍪` : ''; },
  buffs() {
    return [
      { icon: 'cm_eat', on: true, n: '', t: `${Math.max(0, Math.ceil(CM.eatT))}s` },
      { icon: 'cm_rage', on: CM.form === 'rage' && CM.rage, n: '', t: CM.rage ? Math.ceil(CM_RAGE.dur - CM.rage.t) + 's' : '' },
      { icon: CM.roll && CM.roll.coat > 0 ? 'cm_coat' : 'cm_roll', on: CM.form === 'roll', n: '', t: CM.roll && CM.roll.coat > 0 ? Math.ceil(CM.roll.coat) + 's' : '' },
    ];
  },
  onDummyDeath(d, p) { cmBurst(p.clone().setY(1.2), 0.7, { distort: false }); cmChips(p.clone().setY(1), 10, 0.9); },
  icon(ctx, S, id) {
    const glow = (fn, col = '#ffb35a', blur = 16) => glowText(ctx, fn, col, blur);
    const cookie = (x, y, r, col = '#c98a3e') => { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, rr = r * (0.94 + 0.06 * Math.sin(i * 3.7)); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); ctx.fillStyle = '#3a1806'; for (const [cx, cy, cr] of [[-0.35, -0.3, 0.14], [0.3, -0.2, 0.12], [0.05, 0.25, 0.15], [-0.3, 0.3, 0.1], [0.38, 0.32, 0.1], [0.0, -0.05, 0.09]]) { ctx.beginPath(); ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU); ctx.fill(); } };
    const face = (x, y, r) => { cookie(x, y, r); ctx.fillStyle = '#ff6a10'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.15, y - r * 0.25); ctx.lineTo(x + s * r * 0.5, y - r * 0.38); ctx.lineTo(x + s * r * 0.42, y - r * 0.12); ctx.closePath(); ctx.fill(); } ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.15); for (let i = 0; i <= 8; i++) ctx.lineTo(x - r * 0.5 + i * r * 0.125, y + r * (i % 2 ? 0.42 : 0.2)); ctx.lineTo(x + r * 0.5, y + r * 0.15); ctx.quadraticCurveTo(x, y + r * 0.7, x - r * 0.5, y + r * 0.15); ctx.fill(); };
    const blade = (x, y, ang, len) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = '#2a1206'; ctx.fillRect(-S * 0.035, -len, S * 0.07, len); ctx.fillStyle = '#ff6a10'; ctx.fillRect(-S * 0.015, -len, S * 0.03, len * 0.95); ctx.restore(); };
    if (id === 'passive' || id === 'cm_eat') { iconBase(ctx, S, '#8a4a14', '#200a02'); glow(() => { cookie(S * 0.5, S * 0.52, S * 0.3); ctx.fillStyle = '#200a02'; ctx.beginPath(); ctx.arc(S * 0.78, S * 0.3, S * 0.13, 0, TAU); ctx.fill(); }); }
    else if (id === 'cp') {   // the jaws: two half-cookies gaping, chocolate fangs
      iconBase(ctx, S, '#9a4a10', '#200802');
      glow(() => {
        for (const [y0, s] of [[S * 0.42, -1], [S * 0.6, 1]]) {
          ctx.save(); ctx.beginPath(); ctx.rect(0, s < 0 ? 0 : y0, S, s < 0 ? y0 : S - y0); ctx.clip(); cookie(S * 0.5, y0 + s * S * 0.02, S * 0.3); ctx.restore();
          ctx.fillStyle = '#f2e2c8'; for (let i = 0; i < 6; i++) { const x = S * (0.26 + i * 0.096); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + S * 0.048, y0); ctx.lineTo(x + S * 0.024, y0 - s * S * 0.09); ctx.closePath(); ctx.fill(); }
        }
        ctx.fillStyle = '#ff5a10'; for (const sx of [0.38, 0.62]) { ctx.beginPath(); ctx.arc(S * sx, S * 0.26, S * 0.035, 0, TAU); ctx.fill(); }
      }, '#ff8a20');
    }
    else if (id === 'cf' || id === 'cm_roll') { iconBase(ctx, S, '#7a4a18', '#1a0a02'); glow(() => { cookie(S * 0.5, S * 0.48, S * 0.3); ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = S * 0.04; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.48, S * 0.4, -0.4, 1.6); ctx.stroke(); ctx.fillStyle = 'rgba(200,140,70,0.8)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(S * (0.12 + i * 0.05), S * (0.86 - (i % 2) * 0.04), S * 0.025, 0, TAU); ctx.fill(); } }); }
    else if (id === 'cm_coat') { iconBase(ctx, S, '#7a2a08', '#1a0602'); glow(() => { cookie(S * 0.5, S * 0.48, S * 0.3, '#3a1808'); ctx.fillStyle = '#ff6a10'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(S * (0.3 + i * 0.13), S * 0.8, S * 0.04, S * 0.08, 0, 0, TAU); ctx.fill(); } }, '#ff5a10'); }
    else if (id === 'mo') {   // the molten pool with a cookie bursting into it
      iconBase(ctx, S, '#6a2a08', '#140402');
      glow(() => {
        ctx.fillStyle = '#3a1608'; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.7, S * 0.38, S * 0.15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff7a20'; for (const [x, y, r] of [[0.36, 0.7, 0.04], [0.58, 0.66, 0.05], [0.66, 0.74, 0.03]]) { ctx.beginPath(); ctx.arc(S * x, S * y, S * r, 0, TAU); ctx.fill(); }
        cookie(S * 0.5, S * 0.4, S * 0.2);
        ctx.fillStyle = '#4a1e0a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(S * (0.3 + i * 0.1), S * (0.56 - (i % 2) * 0.05), S * 0.03, S * 0.06, 0, 0, TAU); ctx.fill(); }
      }, '#ff6a10');
    }
    else if (id === 'cr' || id === 'cm_rage') { iconBase(ctx, S, '#a0300a', '#200402'); glow(() => { for (const s of [-1, 1]) blade(S * 0.5, S * 0.55, s * 0.65, S * 0.44); face(S * 0.5, S * 0.5, S * 0.17); }, '#ff5a10', 18); }
    else if (id === 'bx') { iconBase(ctx, S, '#b0380a', '#240402'); glow(() => { ctx.strokeStyle = '#ffb040'; ctx.lineWidth = S * 0.05; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(S * 0.5, S * (s < 0 ? 0.9 : 0.1), S * 0.55, s < 0 ? -2.3 : 0.84, s < 0 ? -0.84 : 2.3); ctx.stroke(); } for (const s of [-1, 1]) blade(S * 0.5, S * 0.8, s * 0.75, S * 0.5); }, '#ff5a10', 18); }
    else if (id === 'mh') { iconBase(ctx, S, '#902808', '#200402'); glow(() => { ctx.fillStyle = '#ff6a10'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(S * (0.5 + s * 0.12), S * 0.9); ctx.lineTo(S * (0.5 + s * 0.2), S * 0.35); ctx.lineTo(S * (0.5 + s * 0.16), S * 0.35); ctx.lineTo(S * (0.5 + s * 0.06), S * 0.9); ctx.closePath(); ctx.fill(); } face(S * 0.5, S * 0.32, S * 0.15); ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = S * 0.03; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(S * (0.2 + i * 0.3), S * 0.12); ctx.lineTo(S * (0.2 + i * 0.3), S * 0.22); ctx.stroke(); } }, '#ff5a10', 18); }
    else if (id === 'sk') { iconBase(ctx, S, '#a03008', '#200402'); glow(() => { ctx.fillStyle = '#3a1406'; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.82, S * 0.36, S * 0.1, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff7a20'; ctx.lineWidth = S * 0.035; ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.82, S * 0.4, S * 0.12, 0, 0, TAU); ctx.stroke(); blade(S * 0.5, S * 0.12, Math.PI, S * 0.62); }, '#ff5a10', 18); }
    else if (id === 'hr') { iconBase(ctx, S, '#5a0a06', '#0a0000'); glow(() => face(S * 0.5, S * 0.5, S * 0.34), '#ff2a10', 20); }
    else return false;
    return true;
  },
});

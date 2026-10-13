// ============================================================================
// The player god: movement, SMITE-style camera, input dispatch and shared casting helpers.
// Each playable god is a "kit" (11b_thoth.js, 11c_skadi.js, ...) registered in GODS; the active
// one is `Kit`. A kit implements cast(id), basic(), update(dt, t) and a few optional hooks
// (intercept, busy, moveOverride, speedMul, lmb, rmb, targeter, eyeBoost, ...).
// ============================================================================
const Game = { player: null, thoth: null, anim: null, book: null, mode: 'menu', time: 0, stopT: 0, stopScale: 1, god: 'thoth',
  hitStop(t, scale = 0.12) { if (Net.ctx) return; this.stopT = Math.max(this.stopT, t); this.stopScale = scale; } };   // (another player's replayed cast never stops my world; 14n_net.js)

// camera tuning (realism pass): SMITE-like and grounded - a little lower and closer, a slight over-the-shoulder
// offset, a wider lens, softer follow; small shakes / FOV kicks are filtered out, the big moments keep theirs
// (CAM_FOV is three.js's vertical FOV: 70 is ~102 degrees horizontally at 16:9)
const CAM_DIST = 5.9, CAM_MIN_DIST = 3.6, CAM_MAX_DIST = 9.5, CAM_PITCH = 0.34, CAM_FOV = 70, CAM_SHOULDER = 0.42, CAM_HEIGHT = 1.5, CAM_FOLLOW = 13;
const Cam = { yaw: 0, pitch: CAM_PITCH, dist: CAM_DIST, shake: 0, fov: 60, fovKick: 0, ix: 0.4, iy: 0.12, idist: 3.4, showT: 0, frame: 0, frameTarget: 0, focus: null, focusK: 0, fp: new THREE.Vector3(),
  aim: new THREE.Vector3(), look: new THREE.Vector3(), pos: new THREE.Vector3() };

const P = {
  pos: new THREE.Vector3(0, 0, -18), vel: new THREE.Vector3(), y: 0, vy: 0, grounded: true,
  yaw: 0, hp: 1, mp: 1,
  cd: {},
  ha: { shots: 0, t: 0, orbs: [], cast: 0, swirl: null },
  ep: { ready: 0, dash: null, pending: false, handGlow: null },
  fj: null,
  wrath: null,
  targeting: null,
  atkCd: 0, atkPenalty: 0, atkQueued: false, atkI: 0,
  speedPenalty: 1, speedBuff: 1, flying: false,
  // Arena 5v5: dead (waiting to respawn), crowd control from enemy bots, and the match's own multipliers
  dead: false, stunT: 0, rootT: 0, slowT: 0, slowAmt: 0, arenaSpeed: 1, arenaAs: 1,
};
Game.player = P;

const GODS = {};          // id -> kit
let Kit = null;           // the god being played
const registerGod = (kit) => { GODS[kit.id] = kit; Object.assign(AB, kit.ab || {}); return kit; };
const kitStats = () => (Kit ? Kit.stats : THOTH_STATS);
// (Stats, 16_items.js: the items' stat layer on top of the god's base + level growth)
const maxHp = () => statAt(kitStats().hp) + Stats.flat('hp');
const maxMp = () => statAt(kitStats().mp) + Stats.flat('mana');
// SMITE speed units to m/s (a little slower than SMITE, with soft starts/stops)
const moveSpeed = () => Net.ctx ? Net.ctx.run : kitStats().speed * 0.0145 * Stats.msMul() * (P.speedBuff || 1) * (P.arenaSpeed || 1) * (P.slowT > 0 ? 1 - P.slowAmt : 1);
const attackSpeed = () => Net.ctx ? Net.ctx.as : kitStats().as[0] * (1 + kitStats().as[1] * (lvl() - 1)) * Stats.asMul() * (P.asBuff || 1) * (P.arenaAs || 1);
const basicDamage = () => statAt(kitStats().basic) + kitStats().basicScale * Stats.basePower + Stats.basicBonus();
const fwdOf = (yaw, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
const rightOf = (yaw, out = new THREE.Vector3()) => out.set(-Math.cos(yaw), 0, Math.sin(yaw));
const costOf = (id) => AB[id].cost[rankOf(id) - 1];
const cdOf = (id) => AB[id].cd[rankOf(id) - 1] * (1 - settings.cdr);
const powerOf = () => settings.power;

let lineTarget = null, wallTarget = null, circleTarget = null;

// ---- keybinds: ability slots 1-5 are Q E R F G (the digit keys 1-5 stay as alternates).
// V switches god (14_main.js), B recalls (11y_recall.js). Every UI label reads ABILITY_KEYS.
const ABILITY_KEYS = ['Q', 'E', 'R', 'F', 'G'];
const ABILITY_CODES = [['KeyQ', 'Digit1'], ['KeyE', 'Digit2'], ['KeyR', 'Digit3'], ['KeyF', 'Digit4'], ['KeyG', 'Digit5']];
const keyOf = (id) => ABILITY_KEYS[ABILITY_ORDER.indexOf(id)] || '';   // the key label of an ability id ('' if not slotted)

// ribbons spiralling around a projectile's path (elegant DNA-like magic)
function makeHelix(n, radius, width, color, intensity = 2.6, spin = 24) {
  const h = { n, radius, spin, ph: rand(0, TAU), trails: [] };
  for (let i = 0; i < n; i++) h.trails.push(VFX.trail(width, color, intensity, 16));
  h.push = (pos, dir, t) => {
    const side = _v3.set(dir.z, 0, -dir.x).normalize();
    for (let i = 0; i < n; i++) {
      const a = t * h.spin + h.ph + (i / n) * TAU, r = h.radius * Math.min(1, t * 8);
      h.trails[i].push(_v4.copy(pos).addScaledVector(side, Math.cos(a) * r).add(_v1.set(0, Math.sin(a) * r, 0)));
    }
  };
  h.kill = () => h.trails.forEach((tr) => { tr.alive = false; });
  h.color = (c, k) => h.trails.forEach((tr) => tr.setColor(c, k));
  return h;
}
// a small impact signature: ground ring, scorch-crack and a glyph flare
function impactFx(at, size = 1, color = COL.cyan) {
  const g = at.clone().setY(0);
  VFX.ring(g, color, 0.2, 1.6 * size, 0.35, 2.2, 0.06);
  VFX.cracks(g, 1.1 * size, 2.2, { grow: 0.1, intensity: 1.8, color });
  VFX.add.spawn({ pos: at.clone(), life: 0.25, size: 1.4 * size, sizeEnd: 2.4 * size, color, intensity: 2.6, cell: FX.glyphring, alpha: 1, alphaEnd: 0, fadeIn: 0, rot: rand(0, TAU) });
}

function initPlayer() {
  P.hp = maxHp(); P.mp = maxMp();
  Combat.onKill = (d) => { if (Kit && Kit.onKill) Kit.onKill(d); VFX.later(0.5, () => Sound.voice('kill', { chance: d.isGod ? 0.85 : 0.2, cooldown: 12 })); };
  lineTarget = makeLineTargeter();
  wallTarget = makeWallTargeter();
  circleTarget = makeCircleTargeter();
}

// ---------------------------------------------------------------------------
// casting helpers
// ---------------------------------------------------------------------------
function kitBusy() { return !!(Kit && Kit.busy && Kit.busy()); }
function canCast(id, silent = false) {
  if (kitBusy()) return false;
  if (!settings.noCooldowns && P.cd[id] > 0.05) { if (!silent) { HUD.flashAbility(id); Sound.deny(); } return false; }
  if (!settings.infiniteMana && P.mp < costOf(id)) { if (!silent) { HUD.flashAbility(id); HUD.warn('Not enough mana'); Sound.deny(); } return false; }
  return true;
}
function spend(id, amount = costOf(id)) { if (!settings.infiniteMana) P.mp = Math.max(0, P.mp - amount); }
function startCd(id) { P.cd[id] = settings.noCooldowns ? 0 : cdOf(id); }
function handPos(side = 'R', out = new THREE.Vector3()) {
  const b = Game.thoth.bones['wrist' + side];
  return out.setFromMatrixPosition(b.matrixWorld).add(_v4.set(0, -0.06, 0));
}
function aimOrigin(out = new THREE.Vector3()) {
  const f = fwdOf(P.yaw, _v3), r = rightOf(P.yaw, _v4);
  return out.copy(P.pos).addScaledVector(f, 0.55).addScaledVector(r, 0.18).setY(P.y + 1.35);
}
function moveWish(out = new THREE.Vector3()) {
  if (Net.ctx) return out.set(Net.ctx.aim.mx, 0, Net.ctx.aim.mz);   // (a replayed cast: the caster's own wish, 14n_net.js)
  const f = (input.down.has('KeyW') ? 1 : 0) - (input.down.has('KeyS') ? 1 : 0);
  const s = (input.down.has('KeyD') ? 1 : 0) - (input.down.has('KeyA') ? 1 : 0);
  out.set(0, 0, 0);
  if (f || s) { out.addScaledVector(fwdOf(P.yaw, _v3), f).addScaledVector(rightOf(P.yaw, _v4), s).normalize(); }
  return out;
}
// where the reticle ray meets the ground, projected on the god's facing line
function groundTargetDistance(maxR, minR = 2.2) {
  if (Net.ctx) return Net.aimDist(maxR, minR);   // (a replayed cast: from the caster's own reticle)
  const o = camera.position, d = _v1.copy(Cam.look).sub(camera.position).normalize();
  let dist = maxR;
  if (d.y < -0.01) {
    const t = -o.y / d.y;
    const hit = _v2.copy(o).addScaledVector(d, t);
    const f = fwdOf(P.yaw, _v3);
    dist = (hit.x - P.pos.x) * f.x + (hit.z - P.pos.z) * f.z;
  }
  return clamp(dist, minR, maxR);
}
// ground point under the reticle (clamped to [minR, maxR] in front of the god)
function groundTarget(maxR, minR = 2.2, out = new THREE.Vector3()) {
  return out.copy(P.pos).addScaledVector(fwdOf(P.yaw, _v4), groundTargetDistance(maxR, minR)).setY(0);
}
// living dummies, nearest first, inside a radius / in a forward cone
function dummiesNear(pos, r, extra = 0) { return Combat.dummies.filter((d) => d.alive && Math.hypot(d.pos.x - pos.x, d.pos.z - pos.z) <= r + d.radius + extra).sort((a, b) => a.pos.distanceToSquared(pos) - b.pos.distanceToSquared(pos)); }
function dummiesInCone(pos, dir, range, halfAngle) {
  return Combat.dummies.filter((d) => {
    if (!d.alive) return false;
    const dx = d.pos.x - pos.x, dz = d.pos.z - pos.z, dist = Math.hypot(dx, dz);
    if (dist > range + d.radius) return false;
    if (dist < d.radius + 0.6) return true;
    return Math.acos(clamp((dx * dir.x + dz * dir.z) / dist, -1, 1)) <= halfAngle + Math.atan2(d.radius, dist);
  });
}
// first living dummy along a ray on the ground (projectile-style), within width
function firstAlongRay(origin, dir, range, width = 0.6, gods = false) {
  let best = null, bt = 1e9;
  for (const d of Combat.dummies) {
    if (!d.alive || (gods && !d.isGod)) continue;
    const rx = d.pos.x - origin.x, rz = d.pos.z - origin.z;
    const along = rx * dir.x + rz * dir.z; if (along < 0 || along > range) continue;
    const lat = Math.abs(rx * dir.z - rz * dir.x);
    if (lat <= width + d.radius && along < bt) { bt = along; best = d; }
  }
  return best;
}

function pressAbility(id) {
  if (Game.mode !== 'play' || !id || P.dead || P.stunT > 0) return;
  if (Recall.active) Recall.interrupt('ability');   // (casting breaks a recall channel)
  if (Kit.intercept && Kit.intercept(id)) { Net.cast('i', id); return; }   // (online: the others replay it on my god, 14n_net.js)
  if (kitBusy()) return;
  if (P.targeting === id) { castTargeted(id); return; }
  if (!canCast(id)) return;
  const def = AB[id];
  if (def.targeted && !settings.quickCast) { P.targeting = id; Sound.arm(); if (Kit.onArm) Kit.onArm(id); return; }
  Net.cast('c', id);
  Kit.cast(id, true);
}
function castTargeted(id) {
  P.targeting = null;
  if (!canCast(id)) return;
  Net.cast('c', id);
  Kit.cast(id, true);
}
function tryBasicAttack() {
  if (P.atkCd > 0 || kitBusy()) return;
  if (Recall.active) Recall.interrupt('attack');
  Net.seed();
  Kit.basic();
  if (P.atkCd > 0) Net.cast('b');   // (a basic attack that happened)
}
// the next basic-attack hand (alternating), for gods that strike with both
const DUST = new THREE.Color(0.62, 0.53, 0.42);

// ---------------------------------------------------------------------------
// per-frame player update
// ---------------------------------------------------------------------------
function updatePlayer(dt, t) {
  const playing = Game.mode === 'play';
  // (Arena 5v5) dead or stunned: the camera still turns, but the god does not act; rooted: no walking
  const acting = playing && !P.dead && !(P.stunT > 0), walking = acting && !(P.rootT > 0);
  // camera from mouse
  if (playing) {
    const sens = settings.sens;
    Cam.yaw -= input.mdx * 0.0024 * sens;
    Cam.pitch = clamp(Cam.pitch + input.mdy * 0.0019 * sens, -0.18, 0.92);
    // (Q/E used to turn the camera; they are abilities now - the arrow keys still turn it)
    if (input.down.has('ArrowLeft')) Cam.yaw += dt * 2.2;
    if (input.down.has('ArrowRight')) Cam.yaw -= dt * 2.2;
    if (input.wheel) Cam.dist = clamp(Cam.dist + input.wheel * 0.5, CAM_MIN_DIST, CAM_MAX_DIST);
  }
  if (!(Kit.lockYaw && Kit.lockYaw())) P.yaw = Cam.yaw;
  const st = kitStats();
  // regen (hp5/mp5 are per 5 seconds)
  P.hp = Math.min(maxHp(), P.hp + statAt(st.hp5) / 5 * dt);
  P.mp = Math.min(maxMp(), P.mp + statAt(st.mp5) / 5 * dt);
  if (settings.infiniteMana) P.mp = maxMp();
  for (const k of ABILITY_ORDER) P.cd[k] = Math.max(0, (P.cd[k] || 0) - dt);
  if (settings.noCooldowns) for (const k of ABILITY_ORDER) P.cd[k] = 0;
  P.atkCd = Math.max(0, P.atkCd - dt);
  P.atkPenalty = Math.max(0, P.atkPenalty - dt);
  if (Kit.preUpdate) Kit.preUpdate(dt, t);

  // inputs
  if (acting) {
    for (let i = 0; i < 5; i++) if (ABILITY_CODES[i].some((c) => input.pressed.has(c))) pressAbility(ABILITY_ORDER[i]);
    if (input.pressed.has('KeyB')) Recall.start();
    if (input.rmbPressed) { if (P.targeting) { P.targeting = null; Sound.cancel(); } else if (Kit.rmb) { Kit.rmb(); Net.cast('R'); } }
    let consumed = false;
    if (input.lmbPressed) {
      if (P.targeting) { castTargeted(P.targeting); consumed = true; P.atkCd = Math.max(P.atkCd, 0.25); }
      else if (Kit.lmb && Kit.lmb()) { consumed = true; P.atkCd = Math.max(P.atkCd, 0.4); Net.cast('L'); }
    }
    if (!consumed && (input.lmb || input.lmbPressed) && !P.targeting) tryBasicAttack();
    if (input.pressed.has('Space') && P.grounded && !kitBusy() && !(Kit.noJump && Kit.noJump())) { P.vy = 5.4; P.grounded = false; Sound.jump(); Net.act('j'); }
    if (input.pressed.has('KeyT') && !kitBusy()) { Recall.interrupt('taunt'); Game.anim.play('laugh'); if (Math.random() < 0.5 || !Sound.voice('taunt', { priority: 2, cooldown: 0 })) Sound.laugh(); Net.act('t'); }
  }

  if (playing) Recall.update(dt);   // B: the recall channel (11y_recall.js)

  // movement
  const overridden = Kit.moveOverride ? Kit.moveOverride(dt) : false;
  if (!overridden) {
    const wish = walking ? moveWish(_v2) : _v2.set(0, 0, 0);
    let speed = moveSpeed() * (Kit.speedMul ? Kit.speedMul() : 1);
    if (P.atkPenalty > 0 && !(Kit.noAtkPenalty && Kit.noAtkPenalty())) speed *= 0.5;
    const tx = wish.x * speed, tz = wish.z * speed;
    const k = 1 - Math.exp(-(speed < 0.01 ? 12 : Kit.accel || 7.5) * dt); // soft starts and stops
    P.vel.x += (tx - P.vel.x) * k; P.vel.z += (tz - P.vel.z) * k;
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
    resolveCircle(P.pos, 0.45);
  }
  // keep out of dummies
  for (const d of Combat.dummies) {
    if (!d.alive || (Kit.ghost && Kit.ghost(d))) continue;
    const dx = P.pos.x - d.pos.x, dz = P.pos.z - d.pos.z, rr = d.radius + 0.45, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const dd = Math.sqrt(d2) || 1e-3; P.pos.x = d.pos.x + dx / dd * rr; P.pos.z = d.pos.z + dz / dd * rr; }
  }
  // jump (kits that fly the god themselves set P.flying)
  if (!P.grounded && !P.flying) {
    P.vy -= 16 * dt; P.y += P.vy * dt;
    if (P.y <= 0) { P.y = 0; P.vy = 0; P.grounded = true; Game.anim.play('land'); Sound.land(); }
  }
  Kit.update(dt, t);

  // character transform + animation
  const th = Game.thoth;
  th.root.position.set(P.pos.x, P.y, P.pos.z);
  // the body turns with the camera quickly but not instantly (no robotic snapping on jerky mouse moves);
  // aiming still uses P.yaw exactly, and a big jump in facing (god switch, teleports) snaps at once
  const dy = wrapAngle(P.yaw - th.root.rotation.y);
  th.root.rotation.y = Math.abs(dy) > 2.6 || dt <= 0 ? P.yaw : wrapAngle(th.root.rotation.y + dy * (1 - Math.exp(-22 * dt)));
  const actx = { vel: Kit.animVel ? Kit.animVel() : P.vel, runSpeed: moveSpeed(), airborne: !P.grounded && !P.flying, vy: P.vy, aimPitch: (Cam.pitch - 0.42) * 0.6, eyeBoost: Kit.eyeBoost ? Kit.eyeBoost() : 0 };
  Game.anim.update(dt, actx);
  if (Net.online) Net.keepActx(actx);   // (online: the others pose my god from exactly these, 14n_net.js)
  Sound.glide(Game.mode === 'play' && Game.anim.cfg.loco.mode === 'glide' ? (Game.anim.moveW || 0) : 0);
}

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------
function updateCamera(dt, t) {
  const target = _v1;
  if (Game.mode === 'inspect' || Game.mode === 'menu') {
    if (Game.mode === 'inspect') {
      if (input.locked || input.dragLook) { Cam.ix -= input.mdx * 0.004; Cam.iy = clamp(Cam.iy + input.mdy * 0.003, -0.5, 1.2); }
      if (input.wheel) Cam.idist = clamp(Cam.idist + input.wheel * 0.25, 0.9, 8);
    } else {
      Cam.showT += dt;
      Cam.ix = P.yaw + Math.PI * 0.18 + Math.sin(Cam.showT * 0.15) * 0.55;
      Cam.iy = 0.08 + Math.sin(Cam.showT * 0.11) * 0.06;
      Cam.idist = 3.6;
    }
    const thY = P.y + Game.thoth.body.position.y;
    const zoomUp = Game.mode === 'inspect' ? smoothstep(3.2, 1.3, Cam.idist) * 0.55 : 0;
    target.set(P.pos.x, thY + (Game.mode === 'menu' ? 1.55 : 1.42 + zoomUp), P.pos.z);
    const yaw = Cam.ix;
    const off = _v2.set(Math.sin(yaw) * Math.cos(Cam.iy), Math.sin(Cam.iy), Math.cos(yaw) * Math.cos(Cam.iy)).multiplyScalar(Cam.idist);
    const desired = _v3.copy(target).add(off);
    if (Game.mode === 'menu') desired.add(_v4.set(Math.cos(yaw) * -0.9, 0, -Math.sin(yaw) * -0.9));
    camera.position.lerp(desired, 1 - Math.exp(-6 * dt));
    Cam.look.copy(target);
    if (Game.mode === 'menu') Cam.look.add(_v4.set(Math.cos(yaw) * -0.9, 0, -Math.sin(yaw) * -0.9));
    camera.lookAt(Cam.look);
    camera.fov = damp(camera.fov, 50, 4, dt); camera.updateProjectionMatrix();
    return;
  }
  // big finals pull the camera back and up so the whole spectacle stays in frame
  Cam.frame = damp(Cam.frame, Cam.frameTarget, Cam.frameTarget > Cam.frame ? 2.2 : 1.6, dt);
  const fr = smoothstep(0, 1, Cam.frame);
  const f = fwdOf(Cam.yaw, _v4);
  const lev = Game.thoth.body.position.y * 0.5;
  Cam.focusK = damp(Cam.focusK, Cam.focus ? 1 : 0, 5, dt);
  if (Cam.focus) Cam.fp.copy(Cam.focus);
  const fx = lerp(P.pos.x, Cam.fp.x, Cam.focusK), fz = lerp(P.pos.z, Cam.fp.z, Cam.focusK);
  // a kit can ask for a cinematic shot (Cam.shot: raise the look point, lower the camera, pull back)
  Cam.shotK = damp(Cam.shotK || 0, Cam.shot ? 1 : 0, Cam.shot ? 1.8 : 1.4, dt);
  if (Cam.shot) Cam.lastShot = Cam.shot;
  const sk = smoothstep(0, 1, Cam.shotK), sh = Cam.lastShot || { lift: 0, pitch: 0, dist: 0 };
  target.set(fx, Math.max(0, P.y) * 0.6 + CAM_HEIGHT + lev + fr * 0.85 + sh.lift * sk, fz);   // (a god sinking into the ground does not drag the camera down)
  // smooth follow (realism pass): the pivot the camera orbits trails the god softly, while turning stays exact
  // (yaw / pitch are applied around the smoothed pivot, so aiming never lags); teleports and respawns snap
  if (!Cam.pivot || Cam.pivot.distanceToSquared(target) > 16) Cam.pivot = (Cam.pivot || new THREE.Vector3()).copy(target);
  else Cam.pivot.lerp(target, 1 - Math.exp(-CAM_FOLLOW * dt));
  target.copy(Cam.pivot);
  // over the right shoulder (centred again for the big finals, cinematic shots and while the camera is pulled in tight)
  const shoulder = CAM_SHOULDER * (1 - fr) * (1 - sk) * smoothstep(CAM_MIN_DIST - 0.4, CAM_DIST, Cam.dist);
  if (shoulder > 0.001) target.addScaledVector(rightOf(Cam.yaw, _v3), shoulder);   // (rightOf = screen right: the god sits a little left of centre)
  const dist = Cam.dist + fr * 3.4 + sh.dist * sk, pitch = Cam.pitch + fr * 0.1 + sh.pitch * sk;
  const desired = _v2.copy(target).addScaledVector(f, -Math.cos(pitch) * dist);
  desired.y += Math.sin(pitch) * dist;
  // pull in if a wall/column is in the way
  // (pulled in fast when something blocks, eased back out when it clears - no pops either way)
  const tb = segmentBlocked(target.x, target.z, desired.x, desired.z);
  const pullT = tb < 1 && desired.y < 9 ? Math.max(0.15, tb - 0.05) : 1;
  Cam.pull = Cam.pull === undefined ? pullT : damp(Cam.pull, pullT, pullT < Cam.pull ? 22 : 5, dt);
  if (Cam.pull < 0.999) desired.lerpVectors(target, desired, Cam.pull);
  desired.y = Math.max(0.4, desired.y);
  Cam.pos.lerp(desired, 1 - Math.exp(-40 * dt));
  if (Cam.pos.distanceToSquared(desired) > 9 && fr < 0.01) Cam.pos.copy(desired);
  camera.position.copy(Cam.pos);
  if (Cam.shake > 0) {
    Cam.shake = Math.max(0, Cam.shake - dt * 1.4);
    // small knocks (< ~0.3) barely move it, the big moments still rock it; slower, heavier motion (less buzz)
    const s = Cam.shake * Cam.shake * 0.5 * smoothstep(0.22, 0.75, Cam.shake);
    camera.position.add(_v3.set((Math.sin(t * 37) + 0.5 * Math.sin(t * 71 + 2)) * s * 0.7, (Math.sin(t * 31 + 1) + 0.4 * Math.sin(t * 59)) * s * 0.7, Math.sin(t * 29 + 2) * s * 0.5));
  }
  Cam.look.copy(target).addScaledVector(f, 4.5).add(_v3.set(0, -0.2 + fr * 0.4, 0));
  camera.lookAt(Cam.look);
  Cam.fovKick = Math.max(0, Cam.fovKick - dt * 9);
  const kick = Cam.fovKick * smoothstep(3.5, 8.5, Cam.fovKick);   // (the small abilities' 4-5 degree kicks are filtered out)
  const fovT = CAM_FOV + kick + (Kit.dashing && Kit.dashing() ? 3 : 0) + fr * 4;
  camera.fov = damp(camera.fov, fovT, 8, dt);
  camera.updateProjectionMatrix();
}

// targeters + reticle state
function firstWallCross(len) {
  const f = fwdOf(P.yaw, _v4);
  let best = 2;
  const p0 = P.pos.clone().setY(1.5), p1 = P.pos.clone().addScaledVector(f, len).setY(1.5);
  for (const w of Combat.walls) { if (!Net.mine(w)) continue; const ip = w.cross(p0, p1, 0, 4); if (ip) best = Math.min(best, ip.distanceTo(p0) / len); }
  return best;
}
function updateTargeters(t) {
  lineTarget.mat.uniforms.uTime.value = t; circleTarget.mat.uniforms.uTime.value = t;
  lineTarget.hide(); wallTarget.hide(); circleTarget.hide();
  if (Game.mode !== 'play') return;
  if (Kit.targeter) Kit.targeter(t);
}


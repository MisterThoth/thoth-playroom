// ============================================================================
// THOTH, god of knowledge (SMITE 1 kit + the playroom finale Scribe's Wrath).
// ============================================================================
// ---------------------------------------------------------------------------
// 1 · Hieroglyphic Assault
// ---------------------------------------------------------------------------
function castHA() {
  spend('ha'); startCd('ha');
  P.ha.cast++;
  // clear old orbs
  for (const o of P.ha.orbs) disposeGroup(o.g);
  P.ha.orbs = [];
  P.ha.shots = AB.ha.shots; P.ha.t = AB.ha.life;
  Game.anim.play('conjure');
  Game.book.glowTarget = 1.0; VFX.later(0.6, () => { Game.book.glowTarget = BOOK_IDLE_GLOW; });
  Sound.haCast();
  Sound.voice('ha', { chance: 0.55, cooldown: 7 });
  VFX.later(0.25, () => {
    const hp = handPos('R');
    VFX.burst(hp, { color: COL.glyph, count: 26, speed: 4, flash: 1.4, glyphs: 6, gravity: 1 });
    VFX.flash(hp, COL.glyph, 22, 0.4);
    for (let i = 0; i < 3; i++) {
      const g = makeGlyphOrb(0.85, [3, 4, 0][i]);
      g.position.copy(hp);
      scene.add(g);
      P.ha.orbs.push({ g, i, born: 0, from: hp.clone() });
    }
  });
  if (!P.ha.swirl) {
    P.ha.swirl = VFX.decal(P.pos, VFX.runeTex, COL.glyph, 2.4, 9999, { spin: 0.8, follow: P.pos, intensity: 1.2 });
    P.ha.swirl.hold = () => (P.ha.shots > 0 ? 0.55 : 0);
  }
}
function updateHAOrbs(dt, t) {
  if (P.ha.shots > 0) {
    P.ha.t -= dt;
    if (P.ha.t <= 0) { // glyphs fade away
      for (const o of P.ha.orbs) { VFX.burst(o.g.position, { color: COL.glyph, count: 8, speed: 2, flash: 0.6 }); disposeGroup(o.g); }
      P.ha.orbs = []; P.ha.shots = 0;
    }
  }
  if (P.ha.swirl && P.ha.shots <= 0) { P.ha.swirl.dead = true; P.ha.swirl = null; }
  const n = P.ha.orbs.length;
  P.ha.orbs.forEach((o, k) => {
    o.born = Math.min(1, o.born + dt * 3);
    const a = t * 2.3 + (k / Math.max(n, 1)) * TAU;
    const target = _v1.set(P.pos.x + Math.sin(a) * 0.85, P.y + Game.thoth.body.position.y + 1.2 + Math.sin(t * 3 + k * 2) * 0.18, P.pos.z + Math.cos(a) * 0.85);
    o.g.position.lerpVectors(o.from, target, easeOutCubic(o.born));
    if (o.born >= 1) o.g.position.copy(target);
    animateGlyphOrb(o.g, dt, t);
    if (Math.random() < dt * 10) VFX.add.spawn({ pos: o.g.position.clone(), vel: V3(rand(-0.3, 0.3), rand(0.2, 0.8), rand(-0.3, 0.3)), life: 0.5, size: 0.05, sizeEnd: 0.01, color: COL.glyph, intensity: 2.5, cell: FX.ember });
    if (Math.random() < dt * 14) FX2.glow.spawn({ pos: o.g.position, life: rand(0.35, 0.55), size: rand(0.12, 0.2), sizeEnd: 0.02, cell: FXA.wisp, stretch: 1.2, pal: 'thoth', temp: 1, tempEnd: 0.4, int: 1.5, orbit: { c: o.g.position, r: rand(0.25, 0.4), w: rand(8, 11) * (k % 2 ? 1 : -1), y: rand(-0.15, 0.15) } });
  });
}
function fireHAShot() {
  const o = P.ha.orbs.shift();
  P.ha.shots--;
  const origin = aimOrigin();
  const dir = fwdOf(P.yaw);
  const rank = rankOf('ha');
  const castId = P.ha.cast;
  const orb = o ? o.g : makeGlyphOrb(0.85, 3);
  if (!o) scene.add(orb);
  const startPos = orb.position.clone();
  orb.scale.setScalar(1.35);
  const trail = VFX.trail(0.55, COL.glyph, 2.4, 20);
  const helix = makeHelix(3, 0.3, 0.12, COL.cyan, 2.8, 20);
  const proj = new Projectile({
    kind: 'ha', pos: origin, dir, speed: 27, radius: 0.55, pierce: true,
    maxDist: AB.ha.range * SU, glyphRange: AB.ha.rangeGlyph * SU,
    glyphBonus: AB.gp.abil[rankOf('gp') - 1] + AB.gp.abilScale * settings.power,
    onMove(p, dt) {
      const k = clamp(p.t / 0.09, 0, 1);
      orb.position.lerpVectors(startPos, p.pos, easeOutCubic(k));
      animateGlyphOrb(orb, dt, Combat.time);
      trail.push(orb.position); helix.push(orb.position, p.dir, p.t);
      FX2.trailTick(orb.position, _v4.copy(p.dir).multiplyScalar(27), p.empowered ? 'thothGold' : 'thoth', dt, { k: 2.0, size: 1.3 });
      if (Math.random() < dt * 40) VFX.glyphs.spawn({ pos: orb.position.clone(), vel: V3(rand(-0.4, 0.4), rand(-0.2, 0.6), rand(-0.4, 0.4)), life: 0.5, size: 0.16, sizeEnd: 0.04, color: p.empowered ? COL.gold : COL.glyph, intensity: 2, cell: VFX.glyphCell(), rot: 0 });
    },
    onEmpower() { trail.setColor(COL.ember, 2.8); helix.color(COL.gold, 2.8); orb.userData.core.material.color.copy(COL.ember).multiplyScalar(3.4); orb.scale.setScalar(1.65); },
    onHit(d, hp, p) {
      let dmg = AB.ha.dmg[rank - 1] + AB.ha.scale * settings.power + (p.empowered ? p.bonus : 0);
      if (d.isJungle) dmg *= 1 + AB.ha.jungle;
      if (d.isGod) {
        if (d.haCast !== castId) { d.haCast = castId; d.haHits = 0; }
        dmg *= 1 + AB.ha.godStack * d.haHits;
        d.haHits++;
        P.cd.ha = Math.max(0, P.cd.ha - AB.ha.cdPerGod);
      }
      Combat.deal(d, dmg, p.empowered ? 'glyph' : 'ability', 'Hieroglyphic Assault');
      VFX.burst(hp, { color: p.empowered ? COL.ember : COL.glyph, count: 16, speed: 5, flash: 1.5, glyphs: 4 });
      impactFx(hp, 0.9, p.empowered ? COL.gold : COL.cyan);
    },
    onDie(p, at) {
      trail.alive = false; helix.kill();
      VFX.burst(at, { color: p.empowered ? COL.ember : COL.glyph, count: 22, speed: 5, flash: 1.8, glyphs: 6 });
      VFX.shockwave(at.clone().setY(0), 2.6, 0.35, p.empowered ? COL.gold : COL.cyan, 0.9, 1.6);
      disposeGroup(orb);
    },
  });
  Combat.projectiles.push(proj);
  Sound.haShot();
  VFX.flash(origin, COL.glyph, 14, 0.2);
}

// ---------------------------------------------------------------------------
// 2 · Evade and Punish
// ---------------------------------------------------------------------------
function castEP() {
  spend('ep');
  const dir = moveWish(new THREE.Vector3());
  if (dir.lengthSq() < 0.01) fwdOf(P.yaw, dir);
  P.ep.dash = { dir, left: AB.ep.dash * SU, speed: 42, t: 0, crossed: new Set(), trail: VFX.trail(0.55, COL.glyph, 1.4, 18), last: P.pos.clone() };
  P.ep.pending = true;
  // local dash direction for the lean
  const f = fwdOf(P.yaw, _v3), r = rightOf(P.yaw, _v4);
  Game.anim.play('dash', { dx: -dir.dot(r), dz: dir.dot(f), dur: (AB.ep.dash * SU) / 42 + 0.12 });
  Sound.dash();
  Sound.voice('ep', { chance: 0.55, cooldown: 7 });
  VFX.burst(P.pos.clone().setY(P.y + 0.3), { color: COL.glyph, count: 20, speed: 3, flash: 1.2 });
  for (let i = 0; i < 10; i++) VFX.add.spawn({ pos: P.pos.clone().add(V3(rand(-0.4, 0.4), rand(0.3, 1.8), rand(-0.4, 0.4))), vel: V3(rand(-1, 1), rand(0, 1.5), rand(-1, 1)), life: rand(0.6, 1.1), size: rand(0.14, 0.24), sizeEnd: 0.05, color: new THREE.Color(0.25, 0.35, 0.9), intensity: 1.6, cell: FX.feather, rotVel: rand(-4, 4), drag: 1.5, gravity: -1.2 });
}
function updateDash(dt) {
  const d = P.ep.dash;
  if (!d) return;
  const step = Math.min(d.left, d.speed * dt);
  const p0 = P.pos.clone().setY(1.2);
  P.pos.addScaledVector(d.dir, step);
  const before = P.pos.clone();
  resolveCircle(P.pos, 0.45);
  const blocked = before.distanceTo(P.pos) > 0.05;
  d.left -= step; d.t += dt;
  const p1 = P.pos.clone().setY(1.2);
  for (const w of Combat.walls) {
    if (d.crossed.has(w) || !Net.mine(w)) continue;
    const ip = w.cross(p0, p1, 0, 4);
    if (ip) { d.crossed.add(w); d.left += AB.ep.rangeGlyph * SU; w.ripple(ip); Sound.empower(); }
  }
  // stops on the first enemy god
  let stop = blocked;
  for (const dm of Combat.dummies) {
    if (!dm.alive || !dm.isGod) continue;
    if (Math.hypot(dm.pos.x - P.pos.x, dm.pos.z - P.pos.z) < dm.radius + 0.55) { stop = true; break; }
  }
  d.trail.push(P.pos.clone().setY(P.y + 1.1));
  d.runeAcc = (d.runeAcc || 0) + step;
  if (d.runeAcc > 1.6) { // glowing sigils burn where he blinked
    d.runeAcc = 0;
    VFX.decal(P.pos, VFX.runeTex, COL.cyan, 1.3, 1.1, { spin: 2.5, intensity: 1.6 });
    for (let i = 0; i < 4; i++) VFX.glyphs.spawn({ pos: P.pos.clone().add(V3(rand(-0.3, 0.3), rand(0.2, 1.6), rand(-0.3, 0.3))), vel: V3(rand(-0.3, 0.3), rand(0.4, 1.2), rand(-0.3, 0.3)), life: rand(0.6, 1.0), size: 0.2, sizeEnd: 0.05, color: COL.cyan, intensity: 2.4, cell: VFX.glyphCell(), rot: 0 });
  }
  if (Math.random() < dt * 60) VFX.add.spawn({ pos: P.pos.clone().add(V3(rand(-0.3, 0.3), rand(0.2, 2.0), rand(-0.3, 0.3))), vel: d.dir.clone().multiplyScalar(-rand(1, 3)), life: rand(0.3, 0.6), size: rand(0.12, 0.22), sizeEnd: 0.02, color: COL.glyph, intensity: 2.2, cell: FX.streak, stretch: 1.5 });
  FX2.trailTick(_v4.copy(P.pos).setY(P.y + 1.1), _v3.copy(d.dir).multiplyScalar(d.speed), 'thoth', dt, { k: 2.4, size: 1.4 });
  if (d.left <= 0.001 || stop) {
    d.trail.alive = false;
    P.vel.copy(d.dir).multiplyScalar(moveSpeed() * 0.6);
    P.ep.dash = null;
    P.ep.ready = AB.ep.window;
    Sound.empowerReady();
    VFX.burst(P.pos.clone().setY(P.y + 1), { color: COL.cyan, count: 18, speed: 3, flash: 1.4, gravity: 1 });
  }
}
function fireEmpowered() {
  P.ep.ready = 0; P.ep.pending = false; startCd('ep');
  const origin = aimOrigin(), dir = fwdOf(P.yaw);
  const rank = rankOf('ep');
  const g = new THREE.Group(); scene.add(g);
  const pageMat = new THREE.MeshBasicMaterial({ map: Tex.char.page.glow, color: new THREE.Color(0.55, 1.0, 1.0).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), pageMat); g.add(page);
  const core = glowSprite(VFX.dotTex, COL.cyan, 1.3, 2.8); g.add(core);
  const eye = glowSprite(atlasCellTexture(VFX.fxTex, FX.eye), COL.white, 0.6, 2.4); g.add(eye);
  const trail = VFX.trail(0.8, COL.cyan, 2.8, 22);
  const helix = makeHelix(3, 0.42, 0.13, COL.glyphHot, 2.6, 16);
  let rooted = false;
  const proj = new Projectile({
    kind: 'ep', pos: origin, dir, speed: 34, radius: 0.8, pierce: true,
    maxDist: AB.ep.range * SU, glyphRange: AB.ep.rangeGlyph * SU,
    glyphBonus: AB.gp.abil[rankOf('gp') - 1] + AB.gp.abilScale * settings.power,
    onMove(p, dt) {
      g.position.copy(p.pos);
      page.rotation.set(p.t * 14, Math.atan2(dir.x, dir.z), 0, 'YXZ');
      trail.push(p.pos); helix.push(p.pos, p.dir, p.t);
      if (Math.random() < dt * 50) VFX.add.spawn({ pos: p.pos.clone(), vel: V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)), life: 0.45, size: 0.08, sizeEnd: 0.01, color: COL.cyan, intensity: 2.4, cell: FX.spark, stretch: 1.5, drag: 2 });
      FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(34), p.empowered ? 'thothGold' : 'thoth', dt, { k: 2.2, size: 1.4 });
    },
    onEmpower() { trail.setColor(COL.ember, 3); pageMat.color.copy(COL.ember).multiplyScalar(2.6); },
    onHit(d, hp, p) {
      const dmg = AB.ep.dmg[rank - 1] + AB.ep.scale * settings.power + (p.empowered ? p.bonus : 0);
      Combat.deal(d, dmg, p.empowered ? 'glyph' : 'ability', 'Evade and Punish');
      if (d.isGod && !rooted) {
        rooted = true; d.root = AB.ep.root;
        rootFx(d);
      } else { d.slow = AB.ep.slowDur; d.slowAmt = AB.ep.slow; slowFx(d); }
      VFX.burst(hp, { color: COL.cyan, count: 22, speed: 6, flash: 2.2, glyphs: 4, intensity: 2.7 });
      VFX.flash(hp, COL.cyan, 26, 0.3);
      Cam.shake = Math.max(Cam.shake, 0.18);
    },
    onDie(p, at) { trail.alive = false; helix.kill(); VFX.burst(at, { color: COL.cyan, count: 24, speed: 5, flash: 2, glyphs: 6 }); impactFx(at, 1.1); disposeGroup(g); },
  });
  Combat.projectiles.push(proj);
  Game.anim.play('empower');
  Sound.empowerShot();
  VFX.flash(origin, COL.cyan, 24, 0.25);
  VFX.burst(origin, { color: COL.glyphHot, count: 16, speed: 5, flash: 1.6, intensity: 2.6 });
}
function rootFx(d) {
  const dec = VFX.decal(d.pos, VFX.runeTex, COL.cyan, 2.2, AB.ep.root, { spin: -1.5, follow: d.pos, intensity: 2 });
  // a cage of light: six beams of glyph-fire pin the god in place
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, off = V3(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
    const follow = { get x() { return d.pos.x + off.x; }, get z() { return d.pos.z + off.z; } };
    const bar = VFX.pillar(follow, 0.07, 3.0, COL.glyphHot); bar.target = 1.4;
    VFX.later(AB.ep.root, () => { bar.dead = true; });
  }
  VFX.cracks(d.pos, 1.6, AB.ep.root + 0.8, { grow: 0.12, intensity: 2 });
  PostFX.shock(d.pos.clone().setY(1.2), 0.45, 0.45);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    VFX.later(i * 0.05, () => {
      const p = d.pos.clone().add(V3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9));
      for (let k = 0; k < 6; k++) VFX.add.spawn({ pos: p.clone().setY(0.1 + k * 0.35), vel: V3(0, 1.5, 0), life: 0.7, size: 0.35, sizeEnd: 0.1, color: COL.cyan, intensity: 2.6, cell: FX.ring, rot: 0, rotVel: 4 });
    });
  }
  VFX.ring(d.pos, COL.cyan, 0.4, 2.4, 0.5, 2.5);
}
function slowFx(d) {
  for (let i = 0; i < 10; i++) VFX.add.spawn({ pos: d.pos.clone().add(V3(rand(-0.4, 0.4), rand(0.2, 1.8), rand(-0.4, 0.4))), vel: V3(0, -0.8, 0), life: 0.9, size: 0.18, sizeEnd: 0.05, color: COL.glyph, intensity: 2, cell: FX.dot });
}

// ---------------------------------------------------------------------------
// basic attacks (and the empowered / glyph variants)
// ---------------------------------------------------------------------------
function fireBasic() {
  const origin = aimOrigin(), dir = fwdOf(P.yaw);
  const g = new THREE.Group(); scene.add(g);
  const core = glowSprite(VFX.dotTex, COL.glyph, 0.6, 3); g.add(core);
  const glyph = glowSprite(atlasCellTexture(VFX.glyphTex, VFX.glyphCell()), COL.glyphHot, 0.38, 2.4); g.add(glyph);
  const trail = VFX.trail(0.32, COL.glyph, 2.2, 14);
  const helix = makeHelix(2, 0.13, 0.07, COL.cyan, 2.4, 30);
  const proj = new Projectile({
    kind: 'basic', pos: origin, dir, speed: 33, radius: 0.32, pierce: false,
    maxDist: THOTH_STATS.range * SU, glyphRange: 0,
    glyphBonus: AB.gp.basicB[rankOf('gp') - 1] + AB.gp.basicScale * settings.power,
    onMove(p, dt) {
      g.position.copy(p.pos); glyph.material.rotation = p.t * 6; trail.push(p.pos); helix.push(p.pos, p.dir, p.t);
      FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(33), p.empowered ? 'thothGold' : 'thoth', dt, { k: 1.2, size: 0.8 });
    },
    onEmpower() { trail.setColor(COL.ember, 2.6); helix.color(COL.gold, 2.6); core.material.color.copy(COL.ember).multiplyScalar(3.2); g.scale.setScalar(1.35); },
    onHit(d, hp, p) {
      Combat.deal(d, basicDamage() + (p.empowered ? p.bonus : 0), p.empowered ? 'glyph' : 'basic', 'Basic attack');
      VFX.add.spawn({ pos: hp.clone(), life: 0.22, size: 0.9, sizeEnd: 1.6, color: COL.cyan, intensity: 2.4, cell: FX.glyphring, alpha: 1, alphaEnd: 0, fadeIn: 0, rot: rand(0, TAU) });
    },
    onDie(p, at) { trail.alive = false; helix.kill(); VFX.burst(at, { color: p.empowered ? COL.ember : COL.glyph, count: 12, speed: 3.5, flash: 1.0, glyphs: 3 }); disposeGroup(g); },
  });
  Combat.projectiles.push(proj);
  Sound.basic();
  VFX.add.spawn({ pos: origin.clone(), life: 0.15, size: 0.6, sizeEnd: 0.9, color: COL.glyph, intensity: 2.5, cell: FX.flare, fadeIn: 0 });
}

// ---------------------------------------------------------------------------
// 3 · Glyph of Pain
// ---------------------------------------------------------------------------
function castGlyph() {
  spend('gp'); startCd('gp');
  const dist = groundTargetDistance(AB.gp.range * SU);
  const yaw = P.yaw;
  const center = P.pos.clone().addScaledVector(fwdOf(yaw), dist); center.y = 0;
  Game.anim.play('glyph');
  Sound.voice('gp', { chance: 0.55, cooldown: 7 });
  Game.book.glowTarget = 1.6; Game.book.flipRate = 3;
  VFX.later(0.7, () => { Game.book.glowTarget = BOOK_IDLE_GLOW; Game.book.flipRate = 0.25; });
  Sound.glyphCast();
  // glyph stream from the book to the wall
  VFX.later(0.12, () => {
    const from = Game.book.group.position.clone();
    for (let i = 0; i < 18; i++) {
      VFX.glyphs.spawn({ pos: from.clone().add(V3(rand(-0.15, 0.15), rand(-0.1, 0.2), rand(-0.15, 0.15))), vel: V3(rand(-1.5, 1.5), rand(1, 3), rand(-1.5, 1.5)), life: 1.2, size: 0.26, sizeEnd: 0.12, color: COL.glyph, intensity: 2.4, cell: VFX.glyphCell(), rot: 0, attract: { x: center.x + rand(-2.5, 2.5), y: rand(0.5, 2.8), z: center.z, strength: 55, kill: 0.4 }, drag: 2 });
    }
  });
  VFX.later(0.32, () => {
    Combat.walls.push(new GlyphWall(center, yaw, rankOf('gp'), settings.power)); Sound.glyphWall(); Cam.shake = Math.max(Cam.shake, 0.14);
    const tang = V3(Math.cos(yaw), 0, -Math.sin(yaw)), W = 30 * SU;
    for (let i = 0; i < 4; i++) {
      const p = center.clone().addScaledVector(tang, (i / 3 - 0.5) * W * 0.9);
      VFX.cracks(p, rand(1.4, 2.0), AB.gp.dur, { grow: 0.2 + i * 0.05, intensity: 1.6 });
      VFX.shatter(p.clone().setY(-0.1), VFX.rubbleMat, 4, 0.8);
      for (let k = 0; k < 6; k++) FX2.smoke.spawn({ pos: p.clone().add(V3(rand(-0.8, 0.8), 0.3, rand(-0.8, 0.8))), vel: V3(rand(-0.6, 0.6), rand(0.6, 1.8), rand(-0.6, 0.6)), life: rand(1.2, 2.0), size: rand(0.7, 1.1), sizeEnd: 2.6, frames: 16, pal: 'dust', temp: 0.1, tempEnd: 0, int: 1, alpha: 0.65, drag: 1.2, turb: 0.5 });
      FX2.debris(p.clone().setY(0.2), null, 5, 0.8, FX2.pal('thoth'));
    }
    VFX.shockwave(center, 4.5, 0.45, COL.cyan, 1.2, 1.4);
  });
}

// ---------------------------------------------------------------------------
// 4 · Final Judgement
// ---------------------------------------------------------------------------
function startJudgement() {
  spend('fj');
  const g = new THREE.Group(); scene.add(g);
  const bigMat = new THREE.MeshBasicMaterial({ map: VFX.judgeTex, color: COL.glyphHot.clone().multiplyScalar(1.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const big = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), bigMat); g.add(big);
  const halo = glowSprite(VFX.dotTex, COL.glyph, 3.4, 1.0); g.add(halo);
  const corners = [V3(0, 1.75, 0), V3(-1.85, -0.95, 0), V3(1.85, -0.95, 0)];
  const beamMat = new THREE.MeshBasicMaterial({ color: COL.glyph.clone().multiplyScalar(2.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beams = [];
  for (let i = 0; i < 3; i++) {
    const a = corners[i], b = corners[(i + 1) % 3];
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 6), beamMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), _v1.copy(b).sub(a).normalize());
    m.scale.y = 0.001; g.add(m); beams.push(m);
  }
  P.fj = { t: 0, pages: 1, g, big, bigMat, halo, corners, orbs: [], beams, beamMat, circle: null };
  P.fj.circle = VFX.decal(P.pos, VFX.runeTex, COL.glyph, 4.5, 9999, { spin: 0.6, follow: P.pos, intensity: 1.8 });
  P.fj.circle.hold = () => 0.9;
  P.fj.pillar = null;   // (no column of light around him: he stays in view)
  P.fj.shade = GodFX.shade(P.pos.clone(), 3.6, 0.6);   // a dark pool under the circle so the azure magic reads saturated, not washed out
  PostFX.vigTarget = 0.55; WORLD.dim = 0.6;
  const glyphRing = new THREE.Group(); scene.add(glyphRing);
  for (let i = 0; i < 14; i++) {
    const sp = glowSprite(atlasCellTexture(VFX.glyphTex, (i * 5) % 28), COL.glyphHot, 0.42, 1.7);
    const a = (i / 14) * TAU; sp.position.set(Math.cos(a) * 1.7, Math.sin(i * 1.7) * 0.15, Math.sin(a) * 1.7); glyphRing.add(sp);
  }
  P.fj.glyphRing = glyphRing;
  VFX.cracks(P.pos, 2.6, AB.fj.channel + 2.5, { grow: AB.fj.channel, intensity: 1.4 });
  P.fj.aura = FX2.aura(P.pos, 'thoth', { radius: 1.2, height: 2.4, rate: 14, dur: AB.fj.channel + 0.1 });
  Game.anim.channelTarget = 1; Game.anim.bookFloatTarget = 1;
  Game.book.openTarget = 2.9; Game.book.flipRate = 4; Game.book.glowTarget = 2.0;
  Sound.ultStart();
  HUD.channel(1);
  VFX.burst(P.pos.clone().setY(1.5), { color: COL.glyph, count: 30, speed: 4, flash: 2, glyphs: 10, gravity: 2 });
}
function addJudgementPage() {
  const J = P.fj;
  const i = J.pages - 1;
  const o = makeGlyphOrb(1.55, [0, 3, 4][i]);
  o.position.copy(J.corners[i]);
  J.g.add(o); J.orbs.push(o);
  J.beams[i].userData.on = true;
  J.pages++;
  Game.anim.pulse = 1;
  HUD.channel(J.pages);
  Sound.ultPage(J.pages);
  const wp = new THREE.Vector3(); o.getWorldPosition(wp);
  VFX.burst(wp, { color: COL.glyph, count: 16, speed: 3, flash: 1.6, glyphs: 4 });
  VFX.flash(wp, COL.glyph, 20, 0.4);
}
function updateJudgement(dt, t) {
  const J = P.fj;
  if (!J) return;
  J.t += dt;
  // follow facing; float in front of Thoth
  const f = fwdOf(P.yaw);
  J.g.position.copy(P.pos).addScaledVector(f, 2.5).setY(2.35 + Game.thoth.body.position.y * 0.5);
  J.g.rotation.y = P.yaw;
  const appear = easeOutBack(clamp(J.t / 0.4, 0, 1));
  J.big.scale.setScalar(appear * (1 + Math.sin(t * 5) * 0.03));
  J.big.rotation.z = Math.sin(t * 1.3) * 0.05;
  J.halo.material.opacity = 0.6 + 0.2 * Math.sin(t * 7);
  J.orbs.forEach((o) => animateGlyphOrb(o, dt, t));
  J.beams.forEach((b) => { if (b.userData.on) b.scale.y = Math.min(1, b.scale.y + dt * 5); });
  if (J.pages <= 3 && J.t >= J.pages * (AB.fj.channel / 3)) addJudgementPage();
  if (Math.random() < dt * (12 + J.pages * 8)) FX2.glow.spawn({ pos: J.g.position.clone().add(V3(rand(-3, 3), rand(-2, 2), rand(-3, 3))), life: rand(0.4, 0.7), size: rand(0.06, 0.12), sizeEnd: 0.02, cell: Math.random() < 0.5 ? FXA.spark : FXA.ember, stretch: 1.5, pal: 'thoth', temp: 1.1, tempEnd: 0.5, int: 1.9, attract: { x: J.g.position.x, y: J.g.position.y, z: J.g.position.z, strength: 30, kill: 0.3 } });
  if (Math.random() < dt * 30) {
    const wp = J.g.position.clone().add(V3(rand(-1.5, 1.5), rand(-1, 1.4), rand(-0.3, 0.3)));
    VFX.add.spawn({ pos: wp, vel: V3(rand(-0.5, 0.5), rand(-0.2, 0.8), rand(-0.5, 0.5)), life: 0.7, size: 0.08, sizeEnd: 0.01, color: COL.glyph, intensity: 2.5, cell: FX.ember });
  }
  if (Math.random() < dt * 14) {
    const from = Game.book.group.position;
    VFX.glyphs.spawn({ pos: from.clone(), vel: V3(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)), life: 0.9, size: 0.22, sizeEnd: 0.1, color: COL.glyph, intensity: 2.2, cell: VFX.glyphCell(), rot: 0, attract: { x: J.g.position.x, y: J.g.position.y, z: J.g.position.z, strength: 30, kill: 0.5 } });
  }
  Cam.fovKick = Math.max(Cam.fovKick, J.pages * 1.2);
  if (J.pillar) J.pillar.target = 0.3 + J.pages * 0.2;
  if (J.glyphRing) { const gr = J.glyphRing; gr.position.set(P.pos.x, 1.25 + Game.thoth.body.position.y, P.pos.z); gr.rotation.y += dt * (0.45 + J.pages * 0.15); gr.scale.setScalar(easeOutBack(clamp(J.t / 0.5, 0, 1)) * (1 + J.pages * 0.08)); }
  if (Math.random() < dt * (4 + J.pages * 3)) { // crackling energy from the book up into the glyph
    const bp = Game.book.group.position;
    VFX.bolt(bp.clone(), J.g.position.clone().add(V3(rand(-1.2, 1.2), rand(-0.8, 1.2), 0)), COL.cyan, rand(0.12, 0.22), 0.035, 0.35);
  }
  // "It is... WRITTEN": the word lands 1.70 s into the line, so it starts before the release
  if (!J.voiced && J.t >= AB.fj.channel + 0.05 - FJ_LEAD) { J.voiced = true; Sound.voice('fj_fire', { priority: 5, gain: 1.2, cooldown: 0, offset: FJ_WRITTEN - FJ_LEAD, hold: 1.4 }); }
  if (J.t >= AB.fj.channel + 0.05) fireJudgement();
}
function endChannelPose() {
  Game.anim.channelTarget = 0; Game.anim.bookFloatTarget = 0;
  Game.book.openTarget = BOOK_OPEN_HELD; Game.book.flipRate = 0.25; Game.book.glowTarget = BOOK_IDLE_GLOW;
  if (P.fj && P.fj.circle) P.fj.circle.dead = true;
  if (P.fj && P.fj.pillar) P.fj.pillar.dead = true;
  if (P.fj && P.fj.shade) P.fj.shade.dead = true;
  if (P.fj && P.fj.aura) P.fj.aura.dead = true;
  if (P.fj && P.fj.vortex) P.fj.vortex.dead = true;
  if (P.fj && P.fj.glyphRing) { const h = P.fj.glyphRing; VFX.burst(h.position.clone(), { color: COL.cyan, count: 30, speed: 6, flash: 1.6, glyphs: 10 }); disposeGroup(h); P.fj.glyphRing = null; }
  PostFX.vigTarget = 0; WORLD.dim = 1;
  HUD.channel(0);
}
function cancelJudgement() {
  const J = P.fj;
  if (!J) return;
  if (!settings.infiniteMana) P.mp = Math.min(maxMp(), P.mp + Math.max(0, costOf('fj') - AB.fj.cancelCost));
  VFX.burst(J.g.position, { color: COL.glyph, count: 30, speed: 5, flash: 2, glyphs: 12 });
  disposeGroup(J.g);
  endChannelPose();
  P.fj = null;
  Sound.cancel();
}
function fireJudgement() {
  const J = P.fj;
  if (!J) return;
  const frac = AB.fj.steps[clamp(J.pages - 1, 0, 3)];
  const rank = rankOf('fj');
  const yaw = P.yaw, dir = fwdOf(yaw), perp = rightOf(yaw);
  const origin = P.pos.clone().setY(1.6), voiced = !!(P.fj && P.fj.voiced);
  endChannelPose();
  P.fj = null;
  startCd('fj');
  Game.anim.play('judgement');
  Sound.ultFire(frac, voiced);
  Cam.shake = 0.7; Cam.fovKick = 11;
  Game.hitStop(0.09, 0.15);
  PostFX.shock(origin.clone().addScaledVector(dir, 2), 0.9 * (0.6 + frac * 0.4), 0.7); PostFX.aberr = 0.006;
  // the sonic boom: a shockwave rolls off Thoth, lightning cracks along the path
  VFX.shockwave(P.pos, 7, 0.55, COL.cyan, 2.2, 3.2);
  VFX.cracks(P.pos, 3.2, 2.2, { grow: 0.18, intensity: 2.4 });
  for (let i = 0; i < 5; i++) VFX.bolt(origin.clone().setY(1.7), origin.clone().addScaledVector(dir, rand(6, 14)).addScaledVector(perp, rand(-2.5, 2.5)).setY(rand(0.5, 2.6)), COL.glyphHot, rand(0.25, 0.4), rand(0.06, 0.1), 1.1);
  // a sheet of light rides the wave front
  const sheetMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: COL.cyan.clone().multiplyScalar(2.2) }, uAlpha: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha, uTime; varying vec2 vUv; void main() { float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x); float s = 0.75 + 0.25 * sin(vUv.x * 40.0 - uTime * 20.0); float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.8) * edge * s * uAlpha * 0.8; gl_FragColor = vec4(uColor * a, a); }',
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheetMat); sheet.renderOrder = 8; sheet.frustumCulled = false; scene.add(sheet);
  const wave = {
    sheet, sheetMat,
    g: J.g, origin, dir, perp, front: 1.2, prevFront: 1.2, speed: 23, maxDist: AB.fj.range * SU, hit: new Set(), crossed: new Set(),
    empowered: false, bonus: 0, frac, rank, trails: [VFX.trail(2.2, COL.glyph, 1.5, 26, V3(0, 1, 0)), VFX.trail(2.2, COL.glyph, 1.5, 26, V3(0, 1, 0)), VFX.trail(3.2, COL.glyphHot, 1.2, 26, perp.clone())],
  };
  Combat.waves = Combat.waves || [];
  if (Net.ctx) wave.ctx = Net.ctx;   // (another player's replayed Judgement rolls on as that player: 14n_net.js)
  Combat.waves.push(wave);
  VFX.flash(J.g.position, COL.glyphHot, 26, 0.5);
}
const widthAt = (d) => lerp(3.4, 7.2, clamp(d / (AB.fj.range * SU), 0, 1));
function updateWaves(dt, t) {
  if (!Combat.waves) return;
  const step = (w) => {
    w.prevFront = w.front;
    w.front += w.speed * dt;
    const center = w.origin.clone().addScaledVector(w.dir, w.front);
    const wid = widthAt(w.front);
    // the formation rides the wave front, widening
    w.g.position.copy(center).setY(1.9);
    const sc = wid / 3.7;
    w.g.scale.set(sc, 1 + (sc - 1) * 0.5, sc);
    w.g.children.forEach((c) => { if (c.userData && c.userData.r1) animateGlyphOrb(c, dt, t); });
    // the wave tears a furrow of cracks and dust into the floor as it goes
    w.crackAcc = (w.crackAcc || 0) + (w.front - w.prevFront);
    if (w.crackAcc > 2.6) {
      w.crackAcc = 0;
      VFX.cracks(center.clone().setY(0), wid * 0.42, 2.8, { grow: 0.12, intensity: w.empowered ? 1.4 : 1.7, color: w.empowered ? COL.gold : COL.cyan });
      for (let i = 0; i < 6; i++) FX2.smoke.spawn({ pos: center.clone().addScaledVector(w.perp, rand(-wid / 2, wid / 2)).setY(0.3), vel: w.dir.clone().multiplyScalar(rand(1, 4)).add(V3(0, rand(0.5, 1.4), 0)), life: rand(1.0, 1.7), size: rand(0.7, 1.1), sizeEnd: 2.6, frames: 16, pal: w.empowered ? 'thothGold' : 'thoth', temp: 0.45, tempEnd: 0, int: 1.3, alpha: 0.6, drag: 1.5, turb: 0.5 });
      FX2.scorch(center, w.empowered ? 'thothGold' : 'thoth', { radius: wid * 0.35, dur: 2.4, int: 1.3 });
      if (Math.random() < 0.6) VFX.shatter(center.clone().addScaledVector(w.perp, rand(-wid / 3, wid / 3)).setY(-0.1), VFX.rubbleMat, 3, 0.7);
    }
    w.sheet.position.copy(center).setY(1.7); w.sheet.rotation.set(0, Math.atan2(w.dir.x, w.dir.z), 0); w.sheet.scale.set(wid, 3.4, 1);
    w.sheetMat.uniforms.uTime.value = t; w.sheetMat.uniforms.uAlpha.value = 1 - smoothstep(w.maxDist - 8, w.maxDist, w.front);
    if (w.empowered) w.sheetMat.uniforms.uColor.value.copy(COL.gold).multiplyScalar(2.2);
    const L = center.clone().addScaledVector(w.perp, -wid / 2).setY(1.0), R = center.clone().addScaledVector(w.perp, wid / 2).setY(1.0);
    w.trails[0].push(L); w.trails[1].push(R); w.trails[2].push(center.clone().setY(1.8));
    for (let i = 0; i < 6; i++) {
      const p = center.clone().addScaledVector(w.perp, rand(-wid / 2, wid / 2)).setY(rand(0.3, 2.6));
      VFX.add.spawn({ pos: p, vel: w.dir.clone().multiplyScalar(rand(2, 8)).add(V3(0, rand(-0.5, 1), 0)), life: rand(0.3, 0.6), size: rand(0.08, 0.16), sizeEnd: 0.01, color: w.empowered ? COL.gold : COL.glyph, intensity: 2.4, cell: FX.streak, stretch: 2 });
    }
    if (Math.random() < 0.7) VFX.glyphs.spawn({ pos: center.clone().addScaledVector(w.perp, rand(-wid / 2, wid / 2)).setY(rand(0.4, 2.4)), vel: V3(0, rand(0.2, 1), 0), life: 0.8, size: 0.3, sizeEnd: 0.1, color: w.empowered ? COL.gold : COL.glyph, intensity: 2.2, cell: VFX.glyphCell(), rot: 0 });
    for (let i = 0; i < 4; i++) FX2.glow.spawn({ pos: center.clone().addScaledVector(w.perp, rand(-wid / 2, wid / 2)).setY(rand(0.3, 2.6)), vel: w.dir.clone().multiplyScalar(rand(4, 10)).add(V3(rand(-1, 1), rand(-0.3, 1.5), rand(-1, 1))), life: rand(0.35, 0.7), size: rand(0.06, 0.12), sizeEnd: 0.01, cell: Math.random() < 0.5 ? FXA.spark : FXA.ember, stretch: 2, pal: w.empowered ? 'thothGold' : 'thoth', temp: 1.1, tempEnd: 0.5, int: 2, drag: 1, turb: 1.5 });
    w.hz = (w.hz || 0) + dt; if (w.hz > 0.1) { w.hz = 0; FX2.distort.heat(center.clone().setY(1.6), wid * 0.9, 0.006, 0.4); }
    // glyph of pain crossing
    const p0 = w.origin.clone().addScaledVector(w.dir, w.prevFront), p1 = center.clone();
    for (const wall of Combat.walls) {
      if (w.crossed.has(wall) || w.empowered || !Net.mine(wall)) continue;
      const ip = wall.cross(p0.setY(1.5), p1.setY(1.5), 0, 4);
      if (ip) { w.crossed.add(wall); w.empowered = true; w.maxDist += AB.fj.rangeGlyph * SU; w.bonus = AB.gp.abil[rankOf('gp') - 1] + AB.gp.abilScale * settings.power; wall.ripple(ip); w.trails.forEach((tr) => tr.setColor(COL.gold, 2.6)); Sound.empower(); }
    }
    // hits
    for (const d of Combat.dummies) {
      if (!d.alive || w.hit.has(d)) continue;
      const rel = _v1.copy(d.pos).sub(w.origin);
      const along = rel.dot(w.dir), lat = Math.abs(rel.dot(w.perp));
      if (along >= w.prevFront - d.radius - 0.4 && along <= w.front + d.radius && lat <= widthAt(along) / 2 + d.radius) {
        w.hit.add(d);
        const dmg = w.frac * (AB.fj.dmg[w.rank - 1] + AB.fj.scale * settings.power) + (w.empowered ? w.bonus : 0);
        Combat.deal(d, dmg, 'ult', 'Final Judgement');
        const hp = d.pos.clone().setY(1.3);
        VFX.burst(hp, { color: w.empowered ? COL.gold : COL.glyphHot, count: 30, speed: 7, flash: 2.6, glyphs: 6, intensity: 2.7 });
        VFX.flash(hp, COL.glyph, 30, 0.35);
        Cam.shake = Math.max(Cam.shake, 0.2);
      }
    }
    if (w.front >= w.maxDist) {
      VFX.burst(center.clone().setY(1.6), { color: w.empowered ? COL.gold : COL.glyph, count: 50, speed: 8, flash: 3.4, glyphs: 20, intensity: 2.6 });
      FX2.impact(center, w.empowered ? 'thothGold' : 'thoth', { size: 1.4, debris: 16, glowRocks: true, ring: 4, sparks: 40, dustPal: 'thoth', dustGlow: 0.5 });
      VFX.ring(center, COL.glyph, 0.5, 5, 0.6, 2.4);
      w.trails.forEach((tr) => { tr.alive = false; });
      disposeGroup(w.g);
      scene.remove(w.sheet); w.sheet.geometry.dispose(); w.sheetMat.dispose();
      return false;
    }
    return true;
  };
  Combat.waves = Combat.waves.filter((w) => (w.ctx ? Net.step(w.ctx, () => step(w)) : step(w)));
}

// ---------------------------------------------------------------------------
// 5 · THE FINAL SPELL (playroom finale): Thoth hurls the Book of Thoth into the sky and sits in the
// air beneath it. The book opens over him, vast, its pages turned to the earth, the spell of the end
// is written across the sky and the ground; stones tear loose and rise. Then he speaks the last word
// ever written and the spell rages down under the book and all around him: the ground splits open
// from end to end and the stones of the temple are hurled away. The Final Judgement.
// ---------------------------------------------------------------------------
const FS = { rise: 0.45, open: 0.9, impact: 4.2, descend: 5.0, land: 5.85, end: 7.0, R: 13, apex: 8.4 };
// when "Judgement" lands in "The final spell... Judgement." (each Thoth voice, measured on the processed lines)
const FS_VOX = { thoth: 1.765 };   // v13 (Alistair): the vowel of JUDGEMENT
const FJ_WRITTEN = 0.855;          // v13: "It is... WRITTEN!" - the word's onset in fj_fire
const FJ_LEAD = FJ_WRITTEN;        // the whole line starts so that WRITTEN lands on the release
const FS_DEEP = new THREE.Color(0.02, 0.22, 1.0), FS_HOT = new THREE.Color(0.4, 0.92, 1.0), FS_GOLD = new THREE.Color(1.0, 0.68, 0.18);
let FS_ROCK = null;
function spellRockKit() {
  if (FS_ROCK) return FS_ROCK;
  // a few irregular chunks of the temple floor (jittered icosahedra), sandstone with a faint inner glow
  const geos = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.IcosahedronGeometry(1, k % 2), p = g.attributes.position, r = mulberry32(31 + k);
    for (let i = 0; i < p.count; i++) { const s = 0.72 + r() * 0.5; p.setXYZ(i, p.getX(i) * s * (k === 2 ? 1.4 : 1), p.getY(i) * s * 0.75, p.getZ(i) * s); }
    g.computeVertexNormals(); geos.push(g);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a876b, roughness: 0.92, metalness: 0.0, emissive: new THREE.Color(0.0, 0.05, 0.14), emissiveIntensity: 1, flatShading: true });
  FS_ROCK = { geos, mat };
  return FS_ROCK;
}
function castFinalSpell() {
  spend('fs'); startCd('fs');
  P.targeting = null;
  const c = P.pos.clone().setY(0), fwd = fwdOf(P.yaw);
  const S = { t: 0, c, fwd, yaw: P.yaw, rank: rankOf('fs'), hit: false, rocks: [], beams: [], cracks: 0, apex: V3(c.x, FS.apex, c.z), heat: 0, pulse: 0 };
  P.spell = S;
  // the throw: arms up, the book leaves his hand
  Game.anim.play('conjure');
  Game.book.openTarget = Math.PI - 0.04; Game.book.flipRate = 3; Game.book.glowTarget = 2.6;
  Sound.play('fs_throw', { gain: 1.0 });
  Sound.play('fs_rise', { gain: 0.95, delay: FS.rise });
  Sound.play('fs_charge', { gain: 1.05, delay: FS.open });
  Sound.duckMusic(0.2, FS.descend + 0.5, 2.5);
  Sound.voice('fs_charge', { priority: 5, gain: 1.15, cooldown: 0, delay: 0.35, hold: 2.3 });
  const lead = FS_VOX[Sound.pack] || FS_VOX.thoth;
  VFX.later(Math.max(0.1, FS.impact - lead), () => { if (P.spell === S) Sound.voice('fs_cast', { priority: 6, gain: 1.2, cooldown: 0, hold: lead + 1.8 }); });
  VFX.burst(handPos('L').clone(), { color: COL.glyph, count: 26, speed: 4, flash: 1.6, glyphs: 12, gravity: 2 });
  FX2.burst(handPos('L').clone(), 'thoth', { size: 0.7, sparks: 30, embers: 20, puffs: 2, bursts: 1, int: 0.8 });
}
// the book's own flight: up out of his hand, open over him with the pages turned to the earth, growing
// vast; at the end it glides back down into his palm (the animator blends to this pose by `w`)
const _fsA = new THREE.Vector3(), _fsB = new THREE.Vector3(), _fsC = new THREE.Vector3(), _fsH = new THREE.Vector3(), _fsQ = new THREE.Quaternion(), _fsM = new THREE.Matrix4(), _fsUp = new THREE.Vector3(0, 1, 0);
function spellBook(S) {
  const A = Game.anim, t = S.t;
  const ov = A.bookOv || (A.bookOv = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: HOLD.scale, w: 0 });
  // pages turned to the earth (spine pointing back), turning slowly about the vertical
  const R = rightOf(S.yaw, _fsA), pages = _fsC.set(0, -0.94, 0).addScaledVector(S.fwd, -0.34).normalize(), spine = _fsB.crossVectors(pages, R);
  _fsQ.setFromRotationMatrix(_fsM.makeBasis(R, spine, pages));
  const spin = t * 0.55 + (t > FS.impact ? (t - FS.impact) * 1.4 : 0);
  ov.quat.setFromAxisAngle(_fsUp, spin).multiply(_fsQ);
  const hand = handPos('L', _fsH), top = S.apex, bob = Math.sin(t * 2.1) * 0.12;
  if (t < 0.12) { ov.w = 0; return; }
  if (t < FS.open) {                     // launched from the palm, decelerating as it climbs
    const k = easeOutCubic(clamp((t - 0.12) / (FS.open - 0.12), 0, 1)), u = 1 - k;
    const c1 = _fsA.copy(hand).addScaledVector(S.fwd, 0.9); c1.y += 2.4;
    ov.pos.copy(hand).multiplyScalar(u * u).addScaledVector(c1, 2 * u * k).addScaledVector(top, k * k);
    ov.scale = lerp(HOLD.scale, 2.2, k);
    ov.w = smoothstep(0.12, 0.3, t);
  } else if (t < FS.descend) {           // hanging over him, vast, breathing with the spell
    const kick = t > FS.impact ? Math.exp(-(t - FS.impact) * 5) * 0.9 : 0;
    ov.pos.copy(top); ov.pos.y += bob + kick * 0.6;
    ov.scale = lerp(2.2, 3.6, smoothstep(FS.open, FS.open + 1.2, t)) * (1 + 0.04 * Math.sin(t * 9) * smoothstep(2.5, FS.impact, t) + kick * 0.25);
    ov.w = 1;
  } else {                               // back down into his palm
    const k = clamp((t - FS.descend) / (FS.land + 0.5 - FS.descend), 0, 1), e = easeInOut(k);
    _fsB.copy(hand); _fsB.y += 0.2;
    ov.pos.lerpVectors(top, _fsB, e);
    ov.scale = lerp(3.6, HOLD.scale, e);
    ov.w = 1 - smoothstep(0.7, 1.0, k);
  }
}
function spellRock(S) {
  const K = spellRockKit();
  const a = rand(0, TAU), r = rand(2.4, FS.R * 0.88);
  const base = V3(S.c.x + Math.cos(a) * r, -0.35, S.c.z + Math.sin(a) * r);
  const m = new THREE.Mesh(K.geos[randInt(0, K.geos.length - 1)], K.mat);
  const s = rand(0.16, 0.5); m.scale.set(s * rand(0.8, 1.3), s * rand(0.7, 1.1), s * rand(0.8, 1.3));
  m.position.copy(base); m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); m.castShadow = true; scene.add(m);
  S.rocks.push({ m, base, s, h: rand(0.5, 3.4) * (0.6 + 0.4 * (1 - r / FS.R)), t0: S.t, av: V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(rand(0.4, 1.0)), ph: rand(0, TAU), v: null, bounced: 0, life: 0 });
  // it tears free of the floor: dust and a crack
  FX2.smoke.spawn({ pos: V3(base.x, 0.2, base.z), vel: V3(0, rand(0.5, 1.2), 0), life: rand(1.0, 1.5), size: 0.5, sizeEnd: 1.6, frames: 16, pal: 'dust', temp: 0.12, tempEnd: 0, int: 1, alpha: 0.6, drag: 1.5, turb: 0.4 });
  if (Math.random() < 0.5) VFX.cracks(V3(base.x, 0, base.z), rand(0.7, 1.3), FS.end - S.t, { grow: 0.3, intensity: 1.6, color: COL.cyan });
}
function updateSpell(dt, t) {
  const S = P.spell; if (!S) return;
  S.t += dt;
  const T = S.t, c = S.c, bp = Game.book.group.position;
  spellBook(S);
  // ---- Thoth rises and sits in the air beneath the book
  if (T >= FS.rise && !S.risen) { S.risen = true; Game.anim.channelTarget = 1; Game.anim.liftTarget = 1.0; Game.book.flipRate = 9; }
  if (T >= FS.descend && !S.down) { S.down = true; Game.anim.channelTarget = 0; Game.anim.liftTarget = 0; Game.book.flipRate = 2; }
  // ---- the book opens over him: the spell is written across the sky and the ground
  if (T >= FS.open && !S.opened) {
    S.opened = true;
    Cam.frameTarget = 1; Cam.shot = { lift: 1.9, pitch: -0.26, dist: 0.6 };   // low and wide: Thoth in the air, the book vast in the sky above him
    WORLD.dim = 0.4; GodFX.tint(new THREE.Color(0.04, 0.12, 0.6), 0.45); PostFX.vigTarget = 0.6;
    S.sigil = VFX.decal(c, VFX.runeTex, FS_DEEP, FS.R * 2.1, 9999, { spin: 0.22, intensity: 1.15 });
    S.sigil.hold = () => smoothstep(FS.open, FS.open + 0.8, S.t) * (S.broken ? Math.max(0, 1 - (S.t - FS.impact) * 3) : 1) * (0.75 + 0.25 * Math.sin(S.t * 6) * smoothstep(2.5, FS.impact, S.t));
    S.sigil2 = VFX.decal(c, VFX.judgeTex, COL.glyph, FS.R * 1.15, 9999, { spin: -0.45, intensity: 0.9 });
    S.sigil2.hold = () => smoothstep(FS.open + 0.3, FS.open + 1.2, S.t) * (S.broken ? Math.max(0, 1 - (S.t - FS.impact) * 3) : 1) * 0.7;
    S.shade = GodFX.shade(c.clone(), FS.R * 0.9, 0.55);
    const skyMat = new THREE.MeshBasicMaterial({ map: VFX.judgeTex, color: COL.glyphHot.clone().multiplyScalar(1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    S.sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyMat); S.sky.rotation.x = -Math.PI / 2; S.sky.renderOrder = 9; scene.add(S.sky);
    const ringMat = new THREE.MeshBasicMaterial({ map: VFX.runeTex, color: COL.glyph.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    S.skyRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat); S.skyRing.rotation.x = -Math.PI / 2; S.skyRing.renderOrder = 9; scene.add(S.skyRing);
    S.aura = FX2.aura(P.pos, 'thoth', { radius: 1.1, height: 3.6, rate: 20, dur: FS.descend - FS.open });
    FX2.burst(bp.clone(), 'thoth', { size: 1.3, sparks: 50, embers: 30, puffs: 4, bursts: 1, int: 0.75 });
    FX2.ring(c, 'thoth', { radius: FS.R + 1, dur: 0.9, width: 0.05, int: 1.0 });
    // six shafts of light from the pages down to the edge of the sigil
    for (let i = 0; i < 6; i++) {
      const a = S.yaw + (i / 6) * TAU, to = V3(c.x + Math.cos(a) * FS.R * 0.78, 0.05, c.z + Math.sin(a) * FS.R * 0.78);
      const b = GodFX.beam(bp, to, 0.07, FS_DEEP, { core: FS_HOT, scroll: 4, gain: 1.4 }); b.target = 0; S.beams.push({ b, to, i });
    }
    S.core = GodFX.beam(bp, c.clone().setY(0.05), 0.22, FS_DEEP, { core: FS_HOT, scroll: 6, gain: 1.6 }); S.core.target = 0;
  }
  if (S.opened && !S.hit) {
    const k = clamp((T - FS.open) / (FS.impact - FS.open), 0, 1);
    // the sky sigil unfurls under the book and turns
    S.sky.position.set(bp.x, bp.y + 0.9, bp.z); S.sky.rotation.z += dt * (0.6 + 2.2 * k);
    S.sky.scale.setScalar(2 + 8 * easeOutCubic(clamp(k * 2, 0, 1)) * (1 + 0.03 * Math.sin(t * 13)));
    S.sky.material.opacity = smoothstep(0, 0.2, k) * (0.55 + 0.35 * k);
    S.skyRing.position.set(bp.x, bp.y + 1.3, bp.z); S.skyRing.rotation.z -= dt * (0.4 + 1.4 * k);
    S.skyRing.scale.setScalar(5 + 11 * easeOutCubic(clamp(k * 1.6, 0, 1)));
    S.skyRing.material.opacity = smoothstep(0.05, 0.3, k) * 0.7;
    // the shafts of light come on one by one, the core beam swells
    for (const B of S.beams) { B.b.from.copy(bp); B.b.target = smoothstep(0.08 + B.i * 0.07, 0.2 + B.i * 0.07, k) * (0.55 + 0.25 * Math.sin(t * 9 + B.i)); }
    S.core.from.copy(bp); S.core.to.set(c.x, 0.05, c.z); S.core.target = smoothstep(0.35, 0.9, k) * 0.9;
    // the earth groans: cracks spread out from under him, stones tear loose and rise
    if (S.cracks < 3 && k >= [0.2, 0.5, 0.78][S.cracks]) { VFX.cracks(c, [4.5, 8, 11.5][S.cracks], FS.end - T + 2, { grow: 1.2, intensity: 1.6 + S.cracks * 0.3, color: COL.cyan }); S.cracks++; Cam.shake = Math.max(Cam.shake, 0.3); }
    if (T > 1.3 && S.rocks.length < 26 && Math.random() < dt * 16) spellRock(S);
    if (Math.random() < dt * (10 + 30 * k)) { const a = rand(0, TAU), r = rand(1, FS.R); FX2.rocks.spawn({ pos: V3(c.x + Math.cos(a) * r, 0.05, c.z + Math.sin(a) * r), vel: V3(rand(-0.3, 0.3), rand(1.5, 3.5) * (0.5 + k), rand(-0.3, 0.3)), size: rand(0.03, 0.08) }); }
    // every magic in the hall is drawn up into the pages
    if (Math.random() < dt * (40 + 120 * k)) { const a = rand(0, TAU), r = rand(3, FS.R + 2); FX2.glow.spawn({ pos: V3(c.x + Math.cos(a) * r, rand(0.1, 1.5), c.z + Math.sin(a) * r), life: rand(0.7, 1.2), size: rand(0.06, 0.13), sizeEnd: 0.02, cell: Math.random() < 0.6 ? FXA.spark : FXA.ember, stretch: 2, pal: Math.random() < 0.15 ? 'thothGold' : 'thoth', temp: 1.1, tempEnd: 0.5, int: 1.8, attract: { x: bp.x, y: bp.y, z: bp.z, strength: 26 + 34 * k, kill: 0.6 } }); }
    if (Math.random() < dt * (8 + 16 * k)) VFX.glyphs.spawn({ pos: V3(c.x + rand(-FS.R, FS.R) * 0.7, 0.1, c.z + rand(-FS.R, FS.R) * 0.7), vel: V3(0, rand(1, 2.5), 0), life: rand(1.4, 2.0), size: rand(0.25, 0.4), sizeEnd: 0.08, color: COL.glyph, intensity: 2.0, cell: VFX.glyphCell(), rot: 0, attract: { x: bp.x, y: bp.y, z: bp.z, strength: 12, kill: 0.6 } });
    if (Math.random() < dt * (1.5 + 6 * k)) VFX.bolt(bp.clone(), V3(c.x + rand(-FS.R, FS.R) * 0.6, 0.1, c.z + rand(-FS.R, FS.R) * 0.6), COL.glyphHot, rand(0.12, 0.22), 0.05, 0.9);
    // energy pulses race out over the sigil, faster and faster
    S.pulse -= dt;
    if (S.pulse <= 0) { S.pulse = lerp(0.9, 0.28, k); FX2.ring(c, 'thoth', { radius: FS.R * (0.5 + 0.5 * k), dur: 0.7, width: 0.04, int: 0.9, distortK: 0.008 }); Game.anim.pulse = 0.6; }
    S.heat -= dt;
    if (S.heat <= 0) { S.heat = 0.15; FX2.distort.heat(V3(c.x, 2.4, c.z), 6, 0.004 + 0.01 * k, 0.5); }
    Cam.shake = Math.max(Cam.shake, 0.05 + 0.32 * k * k);
    Cam.fovKick = Math.max(Cam.fovKick, 3 * k);
    if (T >= FS.impact) spellImpact(S);
  }
  // ---- the stones: rising while the spell gathers, hurled away by it, then they fall and settle
  S.rocks = S.rocks.filter((R) => {
    const m = R.m;
    if (!R.v) {
      const k = easeOutCubic(clamp((T - R.t0) / 1.4, 0, 1));
      m.position.set(R.base.x, lerp(R.base.y, R.h, k) + Math.sin(t * 1.6 + R.ph) * 0.1 * k, R.base.z);
      m.rotation.x += R.av.x * dt; m.rotation.y += R.av.y * dt; m.rotation.z += R.av.z * dt;
      if (Math.random() < dt * 3) FX2.glow.spawn({ pos: m.position.clone().add(V3(0, -R.s * 0.8, 0)), vel: V3(0, -0.3, 0), life: 0.6, size: R.s * 1.6, sizeEnd: R.s * 0.6, cell: FXA.glow, pal: 'thoth', temp: 0.7, tempEnd: 0.3, int: 0.6 });
      return true;
    }
    R.life += dt;
    R.v.y -= 20 * dt;
    m.position.addScaledVector(R.v, dt);
    m.rotation.x += R.av.x * dt * 6; m.rotation.z += R.av.z * dt * 6;
    const floor = R.s * 0.6;
    if (m.position.y < floor && R.v.y < 0) {
      if (R.bounced < 1) { R.bounced++; R.v.y = -R.v.y * 0.3; R.v.x *= 0.45; R.v.z *= 0.45; FX2.smoke.spawn({ pos: m.position.clone().setY(0.2), vel: V3(0, 0.6, 0), life: 0.9, size: 0.4, sizeEnd: 1.4, frames: 16, pal: 'dust', temp: 0.1, tempEnd: 0, int: 1, alpha: 0.55, drag: 2 }); }
      else { m.position.y = floor; R.v.set(0, 0, 0); R.av.multiplyScalar(0); }
    }
    if (R.life > 2.6) m.position.y -= dt * 0.6;
    if (R.life > 3.4) { scene.remove(m); return false; }
    return true;
  });
  // ---- the aftermath: the light fades, the book comes home
  if (S.hit) {
    const k = T - FS.impact;
    S.fade = 1 - smoothstep(0.6, 2.0, k);
    if (S.sky) { S.sky.material.opacity = 0.9 * S.fade; S.sky.position.set(bp.x, bp.y + 0.9, bp.z); S.sky.rotation.z += dt * 0.5; S.skyRing.material.opacity = 0.6 * S.fade; S.skyRing.position.set(bp.x, bp.y + 1.3, bp.z); }
    if (S.column && k > 0.9 && !S.column.dead) S.column.dead = true;
    if (S.column) S.column.m.scale.set(lerp(0.35, 1.25, easeOutCubic(clamp(k / 0.22, 0, 1))), 1, lerp(0.35, 1.25, easeOutCubic(clamp(k / 0.22, 0, 1))));
    if (k < 1.6 && Math.random() < dt * 40) VFX.glyphs.spawn({ pos: V3(bp.x + rand(-2, 2), bp.y - 0.4, bp.z + rand(-2, 2)), vel: V3(rand(-2, 2), rand(-4, -1.5), rand(-2, 2)), life: rand(1.0, 1.6), size: rand(0.25, 0.4), sizeEnd: 0.08, color: Math.random() < 0.2 ? COL.gold : COL.glyph, intensity: 2.0, cell: VFX.glyphCell(), rot: 0 });
    if (k > 1.0 && !S.calm) { S.calm = true; WORLD.dim = 1; GodFX.tint(COL.cyan, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.shot = null; for (const B of S.beams) B.b.dead = true; if (S.core) S.core.dead = true; if (S.shade) S.shade.dead = true; }
  }
  if (T >= FS.land + 0.5 && !S.home) { S.home = true; Sound.play('fs_end', { gain: 0.9 }); Game.book.openTarget = BOOK_OPEN_HELD; Game.book.flipRate = 0.25; Game.book.glowTarget = BOOK_IDLE_GLOW; }
  if (T >= FS.end) spellCleanup(S);
}
function spellImpact(S) {
  S.hit = true;
  const c = S.c, R = FS.R, bp = Game.book.group.position.clone();
  Sound.play('fs_impact', { gain: 1.2, bus: Sound.boomBus });
  Sound.play('sonic_boom', { gain: 0.55, bus: Sound.boomBus });
  Game.hitStop(0.12, 0.08);
  Cam.shake = 1.3; Cam.fovKick = 9;
  PostFX.shock(V3(c.x, 1.2, c.z), 1.3, 0.85); PostFX.aberr = 0.0018;
  VFX.flash(V3(c.x, 3, c.z), FS_DEEP, 8, 0.45);
  Game.anim.pulse = 1;
  Game.book.glowTarget = 3.6;
  // the spell rages down: a column of light from the pages to the earth, under the book and around him
  S.column = GodFX.column(c, 2.6, 18, FS_DEEP, { core: new THREE.Color(0.18, 0.55, 1.0), scroll: -7, flare: 1.0, gain: 0.8 }); S.column.target = 0.7;
  // everything that was gathering lets go at once (the sigils break with the ground, the shafts go out)
  for (const B of S.beams) B.b.dead = true;
  if (S.core) S.core.dead = true;
  S.broken = true;
  FX2.burst(V3(c.x, 1.0, c.z), 'thoth', { size: 1.6, sparks: 70, embers: 40, puffs: 12, bursts: 1, int: 0.3, smokeGlow: 0.12, smokeAlpha: 0.9, light: false });
  FX2.burst(V3(c.x, 2.4, c.z), 'thothGold', { size: 1.0, sparks: 36, embers: 26, puffs: 0, bursts: 1, int: 0.35, light: false, distort: false });
  FX2.debris(V3(c.x, 0.3, c.z), null, 40, 2.4, FX2.pal('thoth'));
  FX2.ring(c, 'thoth', { radius: R + 2, dur: 0.7, width: 0.08, int: 0.9 });
  VFX.later(0.1, () => FX2.ring(c, 'thothGold', { radius: R + 9, dur: 1.0, width: 0.05, int: 0.7 }));
  VFX.later(0.25, () => FX2.ring(c, 'thoth', { radius: R + 18, dur: 1.3, width: 0.03, int: 0.5 }));
  FX2.distort.ring(V3(c.x, 1.5, c.z), 48, 0.032, 0.9);
  VFX.later(0.18, () => FX2.distort.ring(V3(c.x, 0.8, c.z), 30, 0.03, 0.8));
  // the whole ground splits open: one great fracture, and more breaking out across the floor
  VFX.cracks(c, R, 7, { grow: 0.25, intensity: 1.7, color: COL.cyan });
  for (let i = 0; i < 7; i++) { const a = S.yaw + (i / 7) * TAU + rand(-0.3, 0.3), r = rand(4, R * 0.9); VFX.later(rand(0, 0.25), () => VFX.cracks(V3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r), rand(2.2, 3.6), 6, { grow: 0.4, intensity: 1.5, color: COL.cyan })); }
  FX2.scorch(c, 'thoth', { radius: 6.5, dur: 6, int: 1.0 });
  // the stones of the temple are hurled away, and more burst up out of the cracks
  for (const Rk of S.rocks) { const out = _v1.set(Rk.m.position.x - c.x, 0, Rk.m.position.z - c.z); const L = out.length() || 1; Rk.v = out.multiplyScalar(rand(6, 13) / L).setY(rand(3, 9)).clone(); }
  FX2.debris(V3(c.x, 0.4, c.z), null, 60, 2.2, FX2.pal('thoth'));
  for (let i = 0; i < 14; i++) { const a = rand(0, TAU), r = rand(2, R); VFX.later(rand(0, 0.3), () => FX2.debris(V3(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r), null, 5, 0.9)); }
  // a wall of dust and spell-smoke rolling out over the floor
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU + rand(-0.04, 0.04), ox = Math.cos(a), oz = Math.sin(a);
    FX2.smoke.spawn({ pos: V3(c.x + ox * 1.5, rand(0.3, 1.4), c.z + oz * 1.5), vel: V3(ox * rand(9, 16), rand(0.3, 1.8), oz * rand(9, 16)), life: rand(1.6, 2.6), size: 1.1, sizeEnd: rand(3.6, 5.2), frames: 16, pal: i % 4 ? 'dust' : 'thoth', temp: i % 4 ? 0.04 : 0.18, tempEnd: 0, int: 1.0, alpha: 0.85, drag: 2.4, turb: 0.7, fadeIn: 0.02, fadeOut: 0.55 });
  }
  for (let i = 0; i < 5; i++) VFX.bolt(bp.clone(), V3(c.x + rand(-R, R) * 0.8, 0.1, c.z + rand(-R, R) * 0.8), COL.glyph, rand(0.25, 0.4), rand(0.07, 0.1), 1.0);
  for (let i = 0; i < 34; i++) VFX.glyphs.spawn({ pos: V3(c.x, rand(0.5, 3), c.z), vel: V3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(6, 14)), life: rand(0.8, 1.4), size: rand(0.3, 0.5), sizeEnd: 0.08, color: Math.random() < 0.25 ? COL.gold : COL.glyph, intensity: 1.8, cell: VFX.glyphCell(), rot: 0, drag: 1.4 });
  // the judgement: heavy damage to everything on the broken ground, thrown up and back - not an execution
  const rank = S.rank, dmg = AB.fs.dmg[rank - 1] + AB.fs.scale * settings.power;
  for (const d of dummiesNear(c, R)) {
    const dist = Math.hypot(d.pos.x - c.x, d.pos.z - c.z), fall = lerp(1, AB.fs.edge, clamp(dist / R, 0, 1));
    Combat.deal(d, dmg * fall, 'final', 'The Final Spell');
    const out = _v1.set(d.pos.x - c.x, 0, d.pos.z - c.z), L = out.length() || 1;
    d.shove(out.multiplyScalar(1.6 / L), 2.5);
    d.applyStun(AB.fs.stun);
    const L0 = { d, t: 0 };
    GodFX.add({ update(dt) { L0.t += dt; const k = Math.min(1, L0.t / 0.7); if (d.alive) d.lift = Math.sin(k * Math.PI) * 1.1; if (k >= 1) { d.lift = 0; return false; } return true; }, dispose() { d.lift = 0; } });
    FX2.burst(d.pos.clone().setY(1.3), 'thoth', { size: 0.7, sparks: 20, embers: 10, puffs: 2, bursts: 1, distort: false });
  }
}
function spellCleanup(S) {
  if (P.spell !== S) return;
  for (const Rk of S.rocks) scene.remove(Rk.m);
  for (const B of S.beams) B.b.dead = true;
  for (const k of ['core', 'column', 'shade', 'aura']) if (S[k]) S[k].dead = true;
  if (S.sigil) S.sigil.dead = true; if (S.sigil2) S.sigil2.dead = true;
  for (const m of [S.sky, S.skyRing]) if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  if (Game.anim.bookOv) Game.anim.bookOv.w = 0;
  Game.anim.channelTarget = 0; Game.anim.liftTarget = 0;
  Game.book.openTarget = BOOK_OPEN_HELD; Game.book.flipRate = 0.25; Game.book.glowTarget = BOOK_IDLE_GLOW;
  WORLD.dim = 1; GodFX.tint(COL.cyan, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.focus = null; Cam.shot = null;
  P.spell = null;
}

// ---------------------------------------------------------------------------
// The kit: input, HUD and lifecycle hooks
// ---------------------------------------------------------------------------
AB.gp.targeted = true; AB.fj.targeted = true;
const THOTH_INFO = {
  passive: {
    name: 'Dead Reckoning', kind: 'Passive · Buff',
    text: 'Thoth writes the names of those he kills in his book. Every 20th kill grants a stack of 3 flat and 1% magical penetration. Killing a god completes the stack immediately. A new stack unlocks every 4th level, max 5 stacks from level 17.',
    rows: () => [['Stacks', `${Combat.reckon.stacks} / ${reckonMaxStacks()}`], ['Penetration', `${AB.passive.flat * Combat.reckon.stacks} flat · ${Combat.reckon.stacks}%`], ['Names in the book', `${Combat.reckon.names} / ${AB.passive.kills}`]],
  },
  ha: {
    name: 'Hieroglyphic Assault', kind: 'Buff · Line · Magical',
    text: 'Thoth conjures three hieroglyphs around himself and ignores the basic attack movement penalty. The next 3 basic attacks pass through enemies and deal ability damage. +25% against jungle minions. Each hit on a god makes the next shot 10% stronger and cuts the cooldown by 0.5 s. Through Glyph of Pain: +30 range.',
    rows: () => { const r = rankOf('ha'); return [['Damage per shot', `${AB.ha.dmg[r - 1]} (+25% of ${settings.power} MP) = ${Math.round(AB.ha.dmg[r - 1] + 0.25 * settings.power)}`], ['Range', '55 · 85 through the glyph'], ['Cost', `${costOf('ha')} mana`], ['Cooldown', `${cdOf('ha').toFixed(1)} s`]]; },
  },
  ep: {
    name: 'Evade and Punish', kind: 'Dash · Root · Magical',
    text: 'Thoth dashes in the direction he is moving. For 5 seconds afterwards, the next basic attack is empowered: the projectile roots the first god it hits and slows all other enemies. If the dash or the attack passes through Glyph of Pain, they gain +30 range. Cooldown only starts once the attack has been used.',
    rows: () => { const r = rankOf('ep'); return [['Damage', `${AB.ep.dmg[r - 1]} (+60% MP) = ${Math.round(AB.ep.dmg[r - 1] + 0.6 * settings.power)}`], ['Root / slow', '1.5 s · 30% for 1.5 s'], ['Range', 'Dash 45 · attack 55'], ['Cost', `${costOf('ep')} mana`], ['Cooldown', `${cdOf('ep').toFixed(1)} s`]]; },
  },
  gp: {
    name: 'Glyph of Pain', kind: 'Area · Buff · Magical',
    text: 'From his book, Thoth conjures a hieroglyph wall in front of him. His ability projectiles that pass through it deal more damage and gain +30 range. Basic attacks get a smaller bonus, but no extra range. The wall lasts 8 seconds.',
    rows: () => { const r = rankOf('gp'); return [['Ability bonus', `${AB.gp.abil[r - 1]} (+5% MP) = ${Math.round(AB.gp.abil[r - 1] + 0.05 * settings.power)}`], ['Basic bonus', `${AB.gp.basicB[r - 1]} (+5% MP) = ${Math.round(AB.gp.basicB[r - 1] + 0.05 * settings.power)}`], ['Range', '55'], ['Cost', `${costOf('gp')} mana`], ['Cooldown', `${cdOf('gp').toFixed(1)} s`]]; },
  },
  fj: {
    name: 'Final Judgement', kind: 'Ultimate · Line · Magical',
    text: 'Thoth conjures a large glyph from the book and writes three more in the corners, one per second. When all four are ready they are sent forward and damage all enemies in the way. Press F (or 4) again to fire early with reduced damage (40/60/80/100%), or cancel for 30 mana.',
    rows: () => { const r = rankOf('fj'); return [['Damage', `${AB.fj.dmg[r - 1]} (+120% MP) = ${Math.round(AB.fj.dmg[r - 1] + 1.2 * settings.power)}`], ['Range', '100 · 130 through the glyph'], ['Cost', '100 mana'], ['Cooldown', `${cdOf('fj').toFixed(0)} s`]]; },
  },
  fs: {
    name: 'The Final Spell', kind: 'Final ability · Doomsday · Magical',
    text: 'Not in SMITE – a finale unique to Thoth, the final judgement. Thoth hurls his book up into the sky and hovers in the air beneath it. The book opens above him, enormous, its pages turned toward the earth, and the spell is written across the sky and the ground while the stones tear loose and rise. Then he speaks the last word ever written: the formula crashes down beneath the book and around him, the whole ground cracks open and the stones are hurled away.',
    rows: () => { const r = rankOf('fs'); return [['Damage', `${AB.fs.dmg[r - 1]} (+${Math.round(AB.fs.scale * 100)}% MP) = ${Math.round(AB.fs.dmg[r - 1] + AB.fs.scale * settings.power)}, ${Math.round(AB.fs.edge * 100)}% at the edge`], ['Radius', `${FS.R} m around Thoth`], ['Stun', `${AB.fs.stun} s · knocked up and back`], ['Cost', `${costOf('fs')} mana`], ['Cooldown', `${cdOf('fs').toFixed(0)} s`]]; },
  },
};
registerGod({
  id: 'thoth', name: 'Thoth', title: 'God of Knowledge', epithet: 'Arbiter of the Damned', pantheon: 'Egyptian', role: 'Mage',
  color: '#7fe8ff', glyphs: '𓁟 𓅝 𓂀 𓋹 𓆣', asset: 'thoth', stats: THOTH_STATS, order: ['ha', 'ep', 'gp', 'fj', 'fs'],
  blurb: 'The scribe of secrets, book in hand. Glyphs, roots and the written judgement – and the finale <em>The Final Spell</em>.',
  info: THOTH_INFO, magical: true, voicePacks: true, fxColor: COL.cyan,
  init() {
    if (Game.book) Game.book.group.visible = true;
    // faint cyan sigil under his feet while he glides
    P.glideGlow = VFX.decal(P.pos, VFX.runeTex, COL.cyan, 1.8, 9999, { spin: 0.35, follow: P.pos, intensity: 1.2 });
    P.glideGlow.hold = () => (Game.anim.moveW || 0) * 0.42 * (P.y > 0.3 ? 0.3 : 1);
  },
  dispose() {
    if (P.fj) cancelJudgement();
    for (const o of P.ha.orbs) disposeGroup(o.g);
    P.ha.orbs = []; P.ha.shots = 0; if (P.ha.swirl) { P.ha.swirl.dead = true; P.ha.swirl = null; }
    P.ep.ready = 0; P.ep.pending = false; if (P.ep.dash) { P.ep.dash.trail.alive = false; P.ep.dash = null; }
    if (P.spell) spellCleanup(P.spell);
    if (P.glideGlow) { P.glideGlow.dead = true; P.glideGlow = null; }
    if (Game.book) Game.book.group.visible = false;
  },
  intercept(id) { if (P.spell) return true; if (P.fj) { if (id === 'fj') fireJudgement(); return true; } return false; },
  busy() { return !!(P.ep.dash || (P.spell && P.spell.t < FS.land)); },
  cast(id) { ({ ha: castHA, ep: castEP, gp: castGlyph, fj: startJudgement, fs: castFinalSpell })[id](); },
  basic() {
    if (P.ep.dash || P.fj || P.spell) return;
    P.atkCd = 1 / attackSpeed();
    if (P.ep.ready > 0) { Game.anim.play('empower'); VFX.later(0.1, fireEmpowered); return; }
    Game.anim.play('throw', { dur: Math.min(0.42, P.atkCd * 0.9) });
    if (P.ha.shots > 0) { VFX.later(0.09, fireHAShot); return; }
    P.atkPenalty = Math.min(0.45, P.atkCd * 0.8);
    VFX.later(0.1, fireBasic);
  },
  preUpdate(dt) {
    if (P.ep.ready > 0) {
      P.ep.ready -= dt;
      const hp = handPos('R');
      if (Math.random() < dt * 40) VFX.add.spawn({ pos: hp.clone().add(V3(rand(-0.06, 0.06), rand(-0.06, 0.06), rand(-0.06, 0.06))), vel: V3(rand(-0.2, 0.2), rand(0.3, 0.9), rand(-0.2, 0.2)), life: 0.4, size: 0.1, sizeEnd: 0.01, color: COL.glyphHot, intensity: 2.6, cell: FX.ember });
      if (P.ep.ready <= 0) { P.ep.ready = 0; if (P.ep.pending) { P.ep.pending = false; startCd('ep'); } }
    }
  },
  moveOverride(dt) {
    if (!P.ep.dash) return false;
    updateDash(dt);
    if (P.ep.dash) { P.vel.copy(P.ep.dash.dir).multiplyScalar(P.ep.dash.speed); return true; }
    return false;
  },
  speedMul() { return P.fj || (P.spell && P.spell.t < FS.land) ? 0 : 1; },
  noAtkPenalty() { return P.ha.shots > 0; },
  accel: 7.5,
  ghost(d) { return !!P.ep.dash && !d.isGod; },
  dashing() { return !!P.ep.dash; },
  animVel() { return P.ep.dash ? _v1.set(0, 0, 0) : P.vel; },
  eyeBoost() { return (P.fj ? 1 : 0) + (P.spell ? 1.4 : 0) + (P.ep.ready > 0 ? 0.4 : 0) + (P.ha.shots > 0 ? 0.3 : 0); },
  lmb() { if (P.fj) { fireJudgement(); return true; } return false; },
  rmb() { if (P.fj) cancelJudgement(); },
  noJump() { return !!(P.fj || P.spell); },
  lockYaw() { return !!P.spell; },
  update(dt, t) { updateHAOrbs(dt, t); updateJudgement(dt, t); updateSpell(dt, t); },
  targeter() {
    if (P.targeting === 'gp') {
      const dist = groundTargetDistance(AB.gp.range * SU);
      const c = P.pos.clone().addScaledVector(fwdOf(P.yaw), dist);
      wallTarget.show(c, P.yaw);
      lineTarget.show(P.pos, P.yaw, dist, 0.35, 0.35);
    } else if (P.targeting === 'fj' || P.fj) {
      const len0 = AB.fj.range * SU, split = firstWallCross(len0);
      const len = split < 1 ? len0 + AB.fj.rangeGlyph * SU : len0;
      lineTarget.show(P.pos, P.yaw, len, 3.4, 7.2, split < 1 ? (split * len0) / len : 2);
    } else if (P.ha.shots > 0 || P.ep.ready > 0) {
      const len0 = AB.ha.range * SU, split = firstWallCross(len0);
      const len = split < 1 ? len0 + AB.ha.rangeGlyph * SU : len0;
      const w = P.ep.ready > 0 ? 1.6 : 1.1;
      lineTarget.show(P.pos, P.yaw, len, w, w, split < 1 ? (split * len0) / len : 2);
    }
  },
  armed(id) { return (id === 'fj' && !!P.fj) || (id === 'fs' && !!P.spell) || (id === 'ep' && P.ep.ready > 0) || (id === 'ha' && P.ha.shots > 0); },
  stack(id) { return id === 'ha' && P.ha.shots > 0 ? P.ha.shots : ''; },
  cdHidden(id) { return id === 'ep' && P.ep.pending; },
  buffs() {
    const R = Combat.reckon;
    return [
      { icon: 'buffEye', on: P.ha.shots > 0, n: P.ha.shots, t: P.ha.shots > 0 ? Math.ceil(P.ha.t) + 's' : '' },
      { icon: 'buffPage', on: P.ep.ready > 0, n: '', t: P.ep.ready > 0 ? Math.ceil(P.ep.ready) + 's' : '' },
      { icon: 'buffBook', on: R.stacks > 0, n: R.stacks, t: '' },
    ];
  },
  // the slain's names fly into the Book of Thoth
  onDummyDeath(d, p) {
    if (!Game.book) return;
    const target = Game.book.group.position;
    for (let i = 0; i < 14; i++) {
      VFX.glyphs.spawn({ pos: p.clone().add(V3(rand(-0.3, 0.3), rand(1, 1.8), rand(-0.3, 0.3))), vel: V3(rand(-2, 2), rand(2, 4), rand(-2, 2)), life: 2.2, size: 0.28, sizeEnd: 0.12, color: COL.glyph, intensity: 2.4, cell: VFX.glyphCell(), rot: 0, attract: { x: target.x, y: target.y, z: target.z, strength: 40, kill: 0.3 }, drag: 1.5 });
    }
    VFX.later(0.6, () => { if (Game.book) { Game.book.glowTarget = 1.4; VFX.later(0.4, () => { Game.book.glowTarget = BOOK_IDLE_GLOW; }); } });
  },
  passivePanel: 'reckon',
});


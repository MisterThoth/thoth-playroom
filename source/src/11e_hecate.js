// ============================================================================
// HECATE, goddess of sorcery and keeper of the crossroads - SMITE 2's Hecate (Mythic Ritual,
// Triplicate Form, Spell Eater, Repel Magic, Open the Gates), in her SMITE 2 look: ivory and violet
// robes, a sceptre shaped like a great key and a torch, her Power and Hex forms splitting off her in
// every spell. Her magic is deep violet, rose and black - cosmic, starry, and dark.
// + the playroom finale THE KEY OF HADES: Hekate Kleidouchos, the key-bearer. The moon goes dark,
// three torches flare at the crossroads, a colossal key falls from the black sky and turns in the
// earth, the gate of Hades opens beneath her foes and the hands of the dead drag them down.
// ============================================================================
const HECATE_STATS = { hp: [380, 72], mp: [260, 50], speed: 360, range: 55, as: [0.95, 0.012], basic: [34, 1.5], basicScale: 0.2, hp5: [7, 0.5], mp5: [5, 0.45] };
const HK_SLAM = 3.3;
// The Key of Hades damage, [base, x magical power]: those dragged down / those at the edge. Balance (ability 5 >= 2 x
// ability 4): 2.23 x Open the Gates at rank 5 (520 + 0.85 MP) - was 380 + 0.7 MP, weaker than the 4. Ritual (+20 %) applies.
const HK_DMG = { dragged: [1160, 1.9], edge: [560, 0.95] };
const HE = { form: 0, sigil: null, shield: null, gates: null, key: null, tp: null, ritual: 0, atkI: 0 };
const HCOL = {
  violet: new THREE.Color(0.42, 0.08, 1.0), magenta: new THREE.Color(0.95, 0.1, 0.62), rose: new THREE.Color(1.0, 0.3, 0.7), deep: new THREE.Color(0.16, 0.02, 0.36),
  smoke: new THREE.Color(0.05, 0.0, 0.08), power: new THREE.Color(0.2, 0.36, 1.0), star: new THREE.Color(0.78, 0.6, 1.0), soul: new THREE.Color(0.55, 0.38, 1.0),
};
const hecateAB = {
  tf: { id: 'tf', name: 'Triplicate Form', dmg: [80, 125, 170, 215, 260], scale: 0.75, cost: [55, 60, 65, 70, 75], cd: [9, 8.5, 8, 7.5, 7], range: 70, mark: [0.08, 0.1, 0.12, 0.14, 0.16], markT: 5, mez: 1.0 },
  se: { id: 'se', name: 'Spell Eater', dmg: [80, 130, 180, 230, 280], scale: 0.5, cost: [60, 65, 70, 75, 80], cd: [9, 9, 9, 9, 9], range: 45, radius: 16, max: 12, life: 14, land: 0.75 },
  rm: { id: 'rm', name: 'Repel Magic', dmg: [75, 120, 165, 210, 255], scale: 0.7, cost: [60, 65, 70, 75, 80], cd: [12, 12, 12, 12, 12], radius: 16, dur: 5, shield: [90, 155, 220, 285, 350] },
  og: { id: 'og', name: 'Open the Gates', dmg: [320, 370, 420, 470, 520], scale: 0.85, cost: [90, 90, 90, 90, 90], cd: [90, 90, 90, 90, 90], range: 70, radius: 24, delay: 1.5, stun: 1.0, life: 10, targeted: true },
  hk: { id: 'hk', name: 'The Key of Hades', cost: [80, 85, 90, 95, 100], cd: [45, 42, 39, 36, 33], range: 80, radius: 6.5, targeted: true },
};
const powerMul = () => (HE.ritual > 0 ? 1.2 : 1);
// dark magic: billowing black-violet smoke with witchfire glowing inside it (FX2 volumetric smoke)
function witchSmoke(p, n = 6, size = 0.6, spread = 0.4) {
  for (let i = 0; i < n; i++) FX2.smoke.spawn({ pos: p.clone().add(V3(rand(-spread, spread), rand(-0.2, 0.3), rand(-spread, spread))), vel: V3(rand(-0.8, 0.8), rand(0.3, 1.4), rand(-0.8, 0.8)), life: rand(0.9, 1.7), size: size * rand(0.8, 1.3), sizeEnd: size * rand(2.4, 3.3), frames: 16, pal: Math.random() < 0.7 ? 'hecate' : 'hexpink', temp: rand(0.35, 0.85), tempEnd: 0, int: 1.3, alpha: 0.85, drag: 1.3, turb: 0.9, fadeIn: 0.05 });
}
// glittering star dust that swirls in the air (stars, embers and spark streaks)
function starDust(p, n = 8, spread = 0.6, col = null) {
  const force = col === HCOL.power ? 'hpower' : col === HCOL.rose || col === HCOL.magenta ? 'hexpink' : null;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    FX2.glow.spawn({ pos: p.clone().add(V3(rand(-spread, spread), rand(-spread, spread), rand(-spread, spread))), vel: V3(rand(-0.9, 0.9), rand(0.1, 1.3), rand(-0.9, 0.9)), life: rand(0.6, 1.4), size: r < 0.35 ? rand(0.14, 0.26) : rand(0.05, 0.11), sizeEnd: 0.01, cell: r < 0.35 ? FXA.star : r < 0.8 ? FXA.ember : FXA.spark, stretch: r >= 0.8 ? 1.5 : 0, pal: force || (Math.random() < 0.55 ? 'hecate' : 'hexpink'), temp: 1.15, tempEnd: 0.5, int: 1.9, drag: 0.8, turb: 2.4, rotVel: rand(-3, 3) });
  }
}
// orbiting witchfire wisps around a moving point (a bolt, a sigil, her hands)
function witchSwirl(c, n = 4, r = 0.6, pal = 'hecate', size = 1) {
  for (let i = 0; i < n; i++) FX2.glow.spawn({ pos: c, life: rand(0.35, 0.6), size: rand(0.16, 0.3) * size, sizeEnd: 0.03, cell: Math.random() < 0.6 ? FXA.wisp : FXA.spark, stretch: 1.2, pal, temp: 1.0, tempEnd: 0.4, int: 1.6, orbit: { c, r: r * rand(0.7, 1.2), w: rand(7, 11) * (Math.random() < 0.5 ? -1 : 1), y: rand(-0.35, 0.35), vr: -0.2 } });
}

// ---- basic attack: alternating violet and rose witch orbs ----------------------------------
function hecateBasic() {
  if (HE.key) return;
  P.atkCd = 1 / attackSpeed();
  // a three-beat chain: a violet orb flicked from the sceptre hand, a rose one from the torch hand, then a heavy violet hurl
  // from high over her shoulder; each orb leaves her palm at the release
  const A = Game.anim, step = autoStep(A), side = step === 1 ? 'L' : 'R', left = side === 'L';
  const rel = autoCast(A, step === 2 ? 'hurl' : 'flick', side, P.atkCd);
  P.atkPenalty = Math.min(0.45, P.atkCd * 0.8);
  HE.atkI++;
  VFX.later(rel, () => {
    const origin = autoOrigin(A, side), dir = fwdOf(P.yaw), col = left ? HCOL.magenta : HCOL.violet, pal = left ? 'hexpink' : 'hecate';
    FX2.burst(origin, pal, { size: 0.3, sparks: 8, embers: 4, puffs: 1, bursts: 1, light: false, distort: false });
    const g = new THREE.Group(); scene.add(g);
    g.add(glowSprite(VFX.dotTex, col, 0.55, 1.8)); const sk = glowSprite(GodFX.cellTex(GX.skull), HCOL.star, 0.34, 1.5); g.add(sk);
    const trail = VFX.trail(0.28, col, 1.8, 14), helix = makeHelix(2, 0.14, 0.06, left ? HCOL.violet : HCOL.rose, 1.8, 26);
    Combat.projectiles.push(new Projectile({
      kind: 'basic', pos: origin, dir, speed: 31, radius: 0.32, pierce: false, maxDist: HECATE_STATS.range * SU, glyphRange: 0,
      onMove(p, dt) { g.position.copy(p.pos); sk.material.rotation = Math.sin(p.t * 9) * 0.3; trail.push(p.pos); helix.push(p.pos, p.dir, p.t); FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(31), pal, dt, { k: 1.4, size: 0.9 }); if (Math.random() < dt * 14) witchSwirl(p.pos, 1, 0.35, pal, 0.7); },
      onHit(d, hp) { Combat.deal(d, basicDamage() * powerMul(), 'basic', 'Witch Orb', false, false); FX2.burst(hp, pal, { size: 0.45, sparks: 16, embers: 8, puffs: 2, bursts: 1 }); starDust(hp, 6, 0.3); Sound.god(`bolt_hit${1 + (HE.atkI % 2)}`, { gain: 0.7, pos: hp }); },
      onDie(p, at) { trail.alive = false; helix.kill(); FX2.burst(at, pal, { size: 0.35, sparks: 10, embers: 6, puffs: 2, bursts: 1, distort: false }); disposeGroup(g); },
    }));
    Sound.god(`bolt${1 + (HE.atkI % 3)}`, { gain: 0.85 });
    if (Math.random() < 0.06) Sound.voice('eff', { cooldown: 6 });
  });
}

// ---- 1 · Triplicate Form: her Power and Hex selves split off her and the spell flies ---------
function splitForms(colA, colB) {
  // her two other selves step out of her, one to each side, and fade
  const side = rightOf(P.yaw);
  [[-1, colA], [1, colB]].forEach(([s, c]) => {
    const g = ghostClone(Game.thoth, c, HCOL.star);
    const from = g.group.position.clone();
    GodFX.add({ update(dt, time) {
      g.mat.uniforms.uTime.value = time;
      const k = clamp(this.t / 0.22, 0, 1);
      g.group.position.copy(from).addScaledVector(side, s * 1.25 * easeOutCubic(k));
      g.mat.uniforms.uAlpha.value = Math.min(1, this.t * 8) * (1 - smoothstep(0.35, 0.7, this.t)) * 0.9;
      if (Math.random() < dt * 30) starDust(g.group.position.clone().setY(rand(0.5, 2.1)), 1, 0.3, c);
      if (this.t > 0.72) { g.dispose(); return false; } return true;
    }, dispose() { g.dispose(); } });
  });
  Sound.god('tf_split', { gain: 0.8 });
}
function castTriplicate() {
  spend('tf'); startCd('tf');
  const hex = HE.form === 1, rank = rankOf('tf');
  HE.form = 1 - HE.form;
  Game.anim.play('triple');
  Sound.god(hex ? 'tf_hex' : 'tf_power', { gain: 1.0 });
  Sound.voice('a1', { chance: 0.55, cooldown: 7 });
  splitForms(HCOL.power, HCOL.violet);
  VFX.later(0.2, () => {
    const origin = aimOrigin(), dir = fwdOf(P.yaw);
    const col = hex ? HCOL.violet : HCOL.power, hot = hex ? HCOL.magenta : new THREE.Color(0.45, 0.6, 1.0), pal = hex ? 'hecate' : 'hpower';
    VFX.flash(origin, col, 18, 0.3);
    FX2.burst(origin, pal, { size: 0.6, sparks: 22, embers: 12, puffs: 3, bursts: 1 });
    PostFX.shock(origin.clone().addScaledVector(dir, 1.5), 0.35, 0.4);
    const g = new THREE.Group(); scene.add(g);
    g.add(glowSprite(VFX.dotTex, col, 1.3, 1.6));
    const face = glowSprite(GodFX.cellTex(hex ? GX.skull : GX.fullmoon), hot, 0.9, 1.7); g.add(face);
    const ring = glowSprite(VFX.ringTex, hot, 1.6, 1.3); g.add(ring);
    const trail = VFX.trail(0.75, col, 2.0, 22), helix = makeHelix(3, 0.45, 0.1, hot, 1.8, 18);
    const R = AB.tf.range * SU;
    const proj = new Projectile({
      kind: 'ability', pos: origin, dir, speed: 30, radius: 0.75, pierce: true, maxDist: R + 1e6, glyphRange: 0, throughWalls: true,
      onMove(p, dt) {
        // it lingers for a second at max range, still biting anything that wanders in
        if (p.traveled >= R) { p.speed = 0; p.linger = (p.linger || 0) + dt; if (p.linger > 1) { p.die(p.pos, false); return; } }
        g.position.copy(p.pos); face.material.rotation = Math.sin(p.t * 7) * 0.25; ring.material.rotation = p.t * 3; ring.scale.setScalar(1.6 + Math.sin(p.t * 10) * 0.15);
        trail.push(p.pos); helix.push(p.pos, p.dir, p.t);
        FX2.trailTick(p.pos, _v4.copy(p.dir).multiplyScalar(p.speed || 4), pal, dt, { k: 2.4, size: 1.6 });
        if (Math.random() < dt * 30) witchSwirl(p.pos, 2, 0.8, pal, 1.1);
        if (Math.random() < dt * 40) starDust(p.pos, 1, 0.5, hex ? null : HCOL.power);
      },
      onHit(d, hp) {
        Combat.deal(d, (AB.tf.dmg[rank - 1] + AB.tf.scale * settings.power) * powerMul(), 'ability', 'Triplicate Form');
        if (hex) d.mesmerize(AB.tf.mez); else d.marked(AB.tf.markT, AB.tf.mark[rank - 1]);
        FX2.burst(hp, pal, { size: 0.85, sparks: 26, embers: 14, puffs: 4 });
        starDust(hp, 10, 0.5, hex ? null : HCOL.power);
        GodFX.spawn({ pos: hp.clone(), life: 0.4, size: 1.4, sizeEnd: 2.4, color: hot, intensity: 1.6, cell: hex ? GX.triskele : GX.fullmoon, alpha: 1, alphaEnd: 0, fadeIn: 0 });
      },
      onDie(p, at) { trail.alive = false; helix.kill(); FX2.burst(g.position, pal, { size: 1.0, sparks: 30, embers: 16, puffs: 6 }); disposeGroup(g); },
    });
    Combat.projectiles.push(proj);
  });
}

// ---- 2 · Spell Eater: a sigil above her drinks every spell cast near it; recast to drop it ---
function castSpellEater() {
  spend('se');
  Game.anim.play('sigil');
  Sound.god('se_place', { gain: 1.0 });
  Sound.voice('a2', { chance: 0.55, cooldown: 7 });
  const R = AB.se.radius * SU;
  const mat = new THREE.MeshBasicMaterial({ map: GodFX.sig.hex, color: HCOL.violet.clone().multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0 });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.3, R * 1.3), mat); disc.rotation.x = -Math.PI / 2; disc.renderOrder = 8; scene.add(disc);
  const back = new THREE.Mesh(new THREE.CircleGeometry(R * 0.6, 48), new THREE.MeshBasicMaterial({ color: 0x0a0014, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); back.rotation.x = -Math.PI / 2; back.renderOrder = 7; scene.add(back);
  const orbs = new THREE.Group(); scene.add(orbs);
  HE.sigil = { disc, back, mat, orbs, charges: 0, t: 0, drop: null, pos: P.pos.clone().setY(3.6) };
  HE.sigil.aura = FX2.aura(HE.sigil.pos, 'hecate', { radius: R * 0.55, height: 0.5, rate: 16, size: 0.9 });
  FX2.burst(HE.sigil.pos, 'hexpink', { size: 0.7, sparks: 18, embers: 10, puffs: 3, bursts: 1 });
}
function feedSigil(n) {
  const S = HE.sigil; if (!S || S.drop) return;
  const before = Math.floor(S.charges);
  S.charges = Math.min(AB.se.max, S.charges + n);
  for (let i = before; i < Math.floor(S.charges); i++) {
    const o = glowSprite(VFX.dotTex, i % 2 ? HCOL.magenta : HCOL.violet, 0.42, 1.8); o.userData.i = i; S.orbs.add(o);
    Sound.god('se_charge', { gain: 0.45 });
    const from = P.pos.clone().setY(1.5), tr = VFX.trail(0.16, HCOL.rose, 1.8, 12), cur = new THREE.Vector3();
    GodFX.add({ update(dt) { const k = clamp(this.t / 0.35, 0, 1); cur.lerpVectors(from, S.disc.position, easeInOut(k)).add(_v2.set(0, Math.sin(k * Math.PI) * 1.2, 0)); tr.push(cur); FX2.trailTick(cur, null, 'hexpink', dt, { k: 1.5, size: 0.7, smoke: false }); if (k >= 1) { tr.alive = false; FX2.burst(S.disc.position, 'hexpink', { size: 0.35, sparks: 10, embers: 6, puffs: 1, bursts: 1, distort: false }); return false; } return true; } });
  }
}
function dropSigil(at) {
  const S = HE.sigil; if (!S || S.drop) return;
  S.drop = { t: 0, from: S.disc.position.clone(), to: at.clone().setY(0.1) }; startCd('se');
  if (S.aura) { S.aura.dead = true; S.aura = null; }
  Game.anim.play('devour');
  Sound.voice('a2', { chance: 0.35, cooldown: 7 });
}
function updateSigil(dt, t) {
  const S = HE.sigil; if (!S) return;
  S.t += dt;
  const R = AB.se.radius * SU;
  if (!S.drop) { S.pos.lerp(_v1.copy(P.pos).setY(3.6 + Math.sin(t * 1.6) * 0.12), 1 - Math.exp(-6 * dt)); S.disc.position.copy(S.pos); }
  S.back.position.copy(S.disc.position).setY(S.disc.position.y - 0.02);
  S.mat.opacity = Math.min(1, S.t * 3) * (0.75 + 0.1 * Math.sin(t * 5));
  S.back.material.opacity = Math.min(0.6, S.t * 2);
  S.disc.rotation.z += dt * (0.6 + S.charges * 0.12);
  S.orbs.position.copy(S.disc.position);
  S.orbs.children.forEach((o) => { const a = t * 1.6 + o.userData.i / AB.se.max * TAU; o.position.set(Math.cos(a) * R * 0.62, Math.sin(t * 3 + o.userData.i) * 0.15, Math.sin(a) * R * 0.62); });
  if (Math.random() < dt * 20) starDust(S.disc.position.clone().add(V3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5))), 1, 0.2);
  // witch smoke drips from the hungry sigil, thicker the more it has eaten
  if (Math.random() < dt * (3 + S.charges * 0.8)) FX2.smoke.spawn({ pos: S.disc.position.clone().add(V3(rand(-R * 0.4, R * 0.4), -0.1, rand(-R * 0.4, R * 0.4))), vel: V3(rand(-0.2, 0.2), -rand(0.3, 0.8), rand(-0.2, 0.2)), life: rand(1.0, 1.6), size: 0.35, sizeEnd: 1.1, frames: 16, pal: 'hecate', temp: 0.6, tempEnd: 0, int: 1.3, alpha: 0.7, drag: 0.8, turb: 0.6 });
  if (S.drop && !S.drop.hit) FX2.trailTick(S.disc.position, null, 'hexpink', dt, { k: 3, size: 1.6 });
  if (!S.drop && S.t > AB.se.life) dropSigil(P.pos.clone().addScaledVector(fwdOf(P.yaw), 3));
  if (S.drop) {
    S.drop.t += dt;
    const k = clamp(S.drop.t / AB.se.land, 0, 1);
    // it flies to the spot and always lands after 0.75 s
    S.disc.position.lerpVectors(S.drop.from, S.drop.to, easeInCubic(k)); S.disc.position.y = lerp(S.drop.from.y, 0.1, easeInCubic(k)) + Math.sin(k * Math.PI) * 1.4;
    S.disc.scale.setScalar(1 + k * 0.4);
    if (k >= 1 && !S.drop.hit) {
      S.drop.hit = true;
      const mult = 1 + 0.075 * Math.floor(S.charges), rank = rankOf('se'), c = S.drop.to;
      Sound.god('se_drop', { gain: 1.0, pos: c });
      Game.hitStop(0.06, 0.15);
      Cam.shake = Math.max(Cam.shake, 0.45);
      PostFX.shock(c.clone().setY(1), 0.6, 0.5);
      FX2.impact(c, 'hecate', { size: 1.15 + S.charges * 0.04, debris: 16, glowRocks: true, ring: (R + 1.5) / 1.15, sparks: 40 + S.charges * 4, dustPal: 'hecate', dustGlow: 0.45 });
      FX2.vortex(c.clone(), 'hexpink', { radius: R * 0.55, height: 4.5, dur: 0.9, rate: 110, spin: 1.3 });
      VFX.later(0.08, () => FX2.ring(c, 'hexpink', { radius: R, dur: 0.45, width: 0.06 }));
      witchSmoke(c.clone().setY(0.4), 18, 1.0, R * 0.6); starDust(c.clone().setY(1), 36, R * 0.6);
      for (const d of dummiesNear(c, R)) { Combat.deal(d, (AB.se.dmg[rank - 1] + AB.se.scale * settings.power) * mult * powerMul(), 'ability', `Spell Eater ×${Math.floor(S.charges)}`); VFX.bolt(c.clone().setY(0.3), d.pos.clone().setY(1.2), HCOL.magenta, 0.3, 0.05, 0.6); }
    }
    if (S.drop.t > AB.se.land + 0.5) { scene.remove(S.disc); S.disc.geometry.dispose(); S.mat.dispose(); scene.remove(S.back); S.back.geometry.dispose(); S.back.material.dispose(); disposeGroup(S.orbs); HE.sigil = null; }
  }
}

// ---- 3 · Repel Magic: a ward of witchfire, a burst around her, speed, and food for the sigil ---
function castRepelMagic() {
  spend('rm'); startCd('rm');
  const rank = rankOf('rm'), R = AB.rm.radius * SU;
  Game.anim.play('shield');
  Sound.god('rm_shield', { gain: 1.0 });
  Sound.voice('a3', { chance: 0.55, cooldown: 7 });
  const b = GodFX.bubble(P.pos, 1.6, HCOL.violet, {}); b.target = 0.6; b.y = 1.15;
  HE.shield = { t: 0, b, rank, hp: AB.rm.shield[rank - 1] + 0.4 * settings.power };
  HE.shield.aura = FX2.aura(P.pos, 'hecate', { radius: 1.55, height: 2.4, rate: 34, size: 1.1 });
  HE.shield.sph = FX2.sphere(P.pos, 'hexpink', { radius: 1.6, hold: true, follow: P.pos, y: 1.15, int: 0.5 });
  feedSigil(3);
  VFX.later(0.12, () => {
    Sound.god('rm_pulse', { gain: 0.9 });
    FX2.ring(P.pos, 'hexpink', { radius: R + 1, dur: 0.5, width: 0.07 });
    FX2.burst(P.pos.clone().setY(1.2), 'hecate', { size: 1.1, sparks: 36, embers: 18, puffs: 0 });
    GodFX.decal(P.pos, GodFX.sig.hex, HCOL.violet, R * 2, 1.2, { spin: 2, intensity: 1.2 });
    witchSmoke(P.pos.clone().setY(0.3), 16, 0.9, R * 0.6);
    for (const d of dummiesNear(P.pos, R)) { Combat.deal(d, (AB.rm.dmg[rank - 1] + AB.rm.scale * settings.power) * powerMul(), 'ability', 'Repel Magic'); FX2.burst(d.pos.clone().setY(1.2), 'hecate', { size: 0.55, sparks: 14, embers: 8, puffs: 2, bursts: 1 }); starDust(d.pos.clone().setY(1.2), 6, 0.4); }
  });
}
function updateShield(dt, t) {
  const S = HE.shield; if (!S) return;
  S.t += dt;
  if (Math.random() < dt * 10) starDust(P.pos.clone().setY(rand(0.4, 2.0)), 1, 1.2);
  if (S.t > AB.rm.dur) { S.b.dead = true; if (S.aura) S.aura.dead = true; if (S.sph) S.sph.dead = true; FX2.burst(P.pos.clone().setY(1.2), 'hecate', { size: 0.6, sparks: 16, embers: 10, puffs: 3, bursts: 1 }); HE.shield = null; }
}

// ---- 4 · Open the Gates: two star-filled gates; after 1.5 s they burst, stun, and swap -------
// Each gate carries a "space marker" - a beacon of starlight with a turning constellation above it.
// Hecate can travel between them once: step into a gate (or press 4 again near one) and she sinks
// into the ground, races beneath the floor as a glow of witchfire, and rises out of the other gate.
function cosmicPortal(p, R, upright, yaw) {
  const flat = GodFX.portal(p, R, HCOL.violet, new THREE.Color(0.01, 0.0, 0.03), { flat: true, normal: true, dark: 0.92, y: 0.05 });
  const rim = GodFX.decal(p, GodFX.sig.crossroads, HCOL.magenta, R * 2.15, 9999, { spin: 0.6, intensity: 1.1 });
  const up = upright ? GodFX.portal(p.clone().setY(2.2), 1.9, HCOL.violet, new THREE.Color(0.02, 0.0, 0.05), { yaw, normal: true, dark: 0.9 }) : null;
  const mist = FX2.mist(p, 'hecate', { radius: R * 0.85, rate: 9, dur: AB.og.life, glow: 0.55, alpha: 0.65, rise: 0.6 });
  const tor = FX2.tornado(p, 'hecate', { r0: R * 0.2, r1: R * 0.5, height: 1.5, dur: AB.og.life, alpha: 0.32, twist: 2.4, spin: 0.55, rise: 0.5, density: 0.3, int: 0.8 });
  // the space marker: a pillar of starlight, a turning star-wheel and a ring above the gate
  const beam = GodFX.column(p, 0.28, 16, HCOL.violet, { core: HCOL.rose, gain: 0.65, scroll: 1.6 }); beam.target = 0.55;
  const top = new THREE.Vector3(p.x, 4.4, p.z);
  const star = glowSprite(GodFX.cellTex(GX.star), HCOL.rose, 2.4, 1.5); star.position.copy(top); star.renderOrder = 12; scene.add(star);
  const wheel = glowSprite(GodFX.cellTex(GX.triskele), HCOL.violet, 3.4, 1.1); wheel.position.copy(top); wheel.renderOrder = 12; scene.add(wheel);
  const halo = glowSprite(VFX.ringTex, HCOL.magenta, 3.9, 1.0); halo.position.copy(top); halo.renderOrder = 12; scene.add(halo);
  return { p, flat, rim, up, mist, tor, beam, top, star, wheel, halo, markA: 1, inside: Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 1.8 };
}
function closeGate(g) {
  if (g.up) g.up.dead = true; g.flat.dead = true; g.rim.dead = true;
  if (g.mist) g.mist.dead = true; if (g.tor) g.tor.dead = true; if (g.beam) g.beam.dead = true;
  for (const sp of [g.star, g.wheel, g.halo]) if (sp) { scene.remove(sp); sp.material.dispose(); }
  g.star = g.wheel = g.halo = null;
}
function castOpenGates() {
  spend('og'); startCd('og');
  const rank = rankOf('og'), yaw = P.yaw, R = AB.og.radius * SU;
  const A = P.pos.clone().addScaledVector(fwdOf(yaw), 1.0).setY(0), B = groundTarget(AB.og.range * SU, 5);
  Game.anim.play('gates');
  Sound.god('gate_open', { gain: 1.0 });
  VFX.later(0.4, () => Sound.voice('ult_scream', { priority: 4, gain: 1.1, cooldown: 0, hold: 2.05 }));
  VFX.later(2.6, () => Sound.voice('ult', { priority: 3, gain: 1.05, cooldown: 0, chance: 0.65 }));
  Sound.duckMusic(0.35, 3.0, 1.5);
  Cam.shake = Math.max(Cam.shake, 0.35); Cam.fovKick = 4;
  WORLD.dim = 0.58; GodFX.tint(new THREE.Color(0.32, 0.08, 0.7), 0.5);
  const gates = [cosmicPortal(A, R, false, yaw), cosmicPortal(B, R, true, yaw)];
  for (const g of gates) { FX2.burst(g.p.clone().setY(0.8), 'hecate', { size: 1.2, sparks: 40, embers: 22, puffs: 6 }); FX2.ring(g.p, 'hexpink', { radius: R + 1.5, dur: 0.5 }); }
  const loop = Sound.god('gate_loop', { gain: 0.5, loop: true });
  HE.gates = { t: 0, A, B, R, rank, gates, fired: false, loop, used: false, hinted: false };
}
// sink into one gate, race under the floor, rise from the other
function startGateTravel(G, from, to) {
  G.used = true;
  const fromP = P.pos.clone().setY(0), off = _v1.copy(P.pos).sub(from).setY(0).multiplyScalar(0.2);
  HE.tp = { t: 0, from: fromP, to: to.clone().add(off).setY(0), cur: fromP.clone(), G, smokeAcc: 0, risen: false };
  P.flying = true; P.vy = 0; P.vel.set(0, 0, 0);
  Sound.god('gate_swap', { gain: 0.9 });
  Game.anim.play('gates');
  HE.tp.vortex = FX2.vortex(fromP.clone(), 'hecate', { radius: 1.4, height: 3.2, dur: 0.6, rate: 140, spin: 1.6, down: true, vr: -0.8 });
  FX2.burst(fromP.clone().setY(0.6), 'hexpink', { size: 0.9, sparks: 30, embers: 18, puffs: 6 });
  starDust(P.pos.clone().setY(1.2), 20, 0.6);
}
const TP_SINK = 0.42, TP_RUN = 0.5, TP_RISE = 0.42;
function updateGateTravel(dt) {
  const T = HE.tp; if (!T) return;
  T.t += dt;
  const t = T.t;
  P.vel.set(0, 0, 0);
  if (t < TP_SINK) {
    // she spins and sinks into the gate
    const k = t / TP_SINK;
    P.y = -2.7 * easeInCubic(k); P.yaw += dt * 9 * k;
    if (Math.random() < dt * 40) witchSmoke(T.from.clone().setY(0.2), 1, 0.7, 0.6);
  } else if (t < TP_SINK + TP_RUN) {
    // beneath the floor: a racing glow of witchfire, the ground cracking open above it
    const k = (t - TP_SINK) / TP_RUN, e = k * k * (3 - 2 * k);
    T.cur.lerpVectors(T.from, T.to, e);
    P.pos.set(T.cur.x, 0, T.cur.z); P.y = -2.7;
    Cam.focus = Cam.focus || new THREE.Vector3(); Cam.focus.copy(T.cur);
    if (!T.light) T.light = FX2.light(T.cur.clone().setY(0.4), HCOL.magenta, 16, TP_RUN + 0.3, T.cur);
    T.smokeAcc += dt;
    if (T.smokeAcc > 0.045) {
      T.smokeAcc = 0;
      FX2.scorch(T.cur, 'hexpink', { radius: 1.1, dur: 1.4, int: 1.6, darkAlpha: 0.4 });
      FX2.smoke.spawn({ pos: T.cur.clone().setY(0.25), vel: V3(rand(-0.6, 0.6), rand(1.2, 2.6), rand(-0.6, 0.6)), life: rand(0.8, 1.3), size: 0.6, sizeEnd: 1.8, frames: 16, pal: 'hecate', temp: 0.8, tempEnd: 0, int: 1.4, alpha: 0.8, drag: 1.2, turb: 0.8 });
      starDust(T.cur.clone().setY(0.3), 3, 0.4);
    }
    for (let i = 0; i < 3; i++) FX2.glow.spawn({ pos: T.cur.clone().setY(0.1), vel: V3(rand(-2, 2), rand(2, 5), rand(-2, 2)), life: rand(0.3, 0.6), size: rand(0.05, 0.1), sizeEnd: 0.01, cell: FXA.spark, stretch: 2, pal: 'hexpink', temp: 1.2, tempEnd: 0.5, int: 2, drag: 1.5, gravity: -4 });
  } else {
    // she bursts up out of the far gate
    if (!T.risen) {
      T.risen = true;
      P.pos.set(T.to.x, 0, T.to.z);
      Sound.god('gate_blast', { gain: 0.8 });
      FX2.impact(T.to, 'hecate', { size: 1.0, debris: 12, glowRocks: true, ring: 3.2, sparks: 34, dustPal: 'hecate', dustGlow: 0.45 });
      FX2.vortex(T.to.clone(), 'hexpink', { radius: 1.2, height: 3.6, dur: 0.7, rate: 120, spin: 1.4 });
      Cam.shake = Math.max(Cam.shake, 0.4);
    }
    const k = Math.min(1, (t - TP_SINK - TP_RUN) / TP_RISE);
    P.y = -2.7 * (1 - easeOutCubic(k));
    if (Math.random() < dt * 30) starDust(P.pos.clone().setY(rand(0.2, 2)), 2, 0.5);
    if (k >= 1) { P.y = 0; P.flying = false; P.grounded = true; Cam.focus = null; HE.tp = null; }
  }
}
function updateGates(dt, t) {
  const G = HE.gates; if (!G) return;
  G.t += dt;
  const live = G.t < AB.og.life;
  // stars falling into the gates, ghosts streaming between them
  if (live) for (const g of G.gates) {
    if (Math.random() < dt * 34) { const a = rand(0, TAU), r = rand(0.3, G.R); FX2.glow.spawn({ pos: V3(g.p.x + Math.cos(a) * r, rand(0.1, 0.5), g.p.z + Math.sin(a) * r), life: rand(0.7, 1.2), size: rand(0.08, 0.18), sizeEnd: 0.01, cell: Math.random() < 0.4 ? FXA.star : FXA.ember, pal: Math.random() < 0.5 ? 'hecate' : 'hexpink', temp: 1.1, tempEnd: 0.5, int: 1.8, orbit: { c: g.p, r, w: -rand(1.5, 3), vr: -r * 0.6, y: rand(0.1, 0.5), vy: rand(-0.1, 0.4) } }); }
    // the marker turns and pulses; it dims once she has used the gates
    g.markA = damp(g.markA, G.used ? 0.25 : 1, 3, dt);
    if (g.star) {
      const bob = Math.sin(t * 2.2 + g.p.x) * 0.18;
      g.star.position.y = g.top.y + bob; g.wheel.position.y = g.top.y + bob; g.halo.position.y = g.top.y + bob;
      g.star.material.rotation = t * 0.8; g.wheel.material.rotation = -t * 0.45; g.halo.material.rotation = t * 0.2;
      const pulse = 0.8 + 0.2 * Math.sin(t * 6 + g.p.z);
      g.star.material.opacity = g.markA * pulse; g.wheel.material.opacity = g.markA * 0.8; g.halo.material.opacity = g.markA * (0.5 + 0.3 * Math.sin(t * 3));
      g.halo.scale.setScalar(3.9 + Math.sin(t * 3) * 0.25);
      if (Math.random() < dt * 14 * g.markA) FX2.glow.spawn({ pos: g.top, life: rand(0.5, 0.9), size: rand(0.08, 0.16), sizeEnd: 0.01, cell: FXA.star, pal: 'hexpink', temp: 1.1, tempEnd: 0.6, int: 1.8, orbit: { c: g.top, r: rand(1.2, 1.9), w: rand(1.5, 2.5), y: rand(-0.4, 0.4) } });
    }
  }
  if (live && Math.random() < dt * 6) { const tr = VFX.trail(0.35, Math.random() < 0.5 ? HCOL.violet : HCOL.magenta, 1.6, 16), a = G.A.clone().setY(1.8), b = G.B.clone().setY(1.8), h = rand(2, 4), cur = new THREE.Vector3(); GodFX.add({ update(dt2) { const k = clamp(this.t / 0.6, 0, 1); cur.lerpVectors(a, b, k).add(_v2.set(0, Math.sin(k * Math.PI) * h, 0)); tr.push(cur); FX2.trailTick(cur, null, 'hecate', dt2, { k: 0.8, size: 0.7, smoke: false }); if (k >= 1) { tr.alive = false; return false; } return true; } }); }
  // after 1.5 s: both gates burst, stun, and throw the stunned through to the other gate
  if (!G.fired && G.t >= AB.og.delay) {
    G.fired = true;
    Sound.god('gate_blast', { gain: 1.05 });
    Sound.god('sonic_boom', { gain: 0.45, shared: true });
    Game.hitStop(0.06, 0.18); Cam.shake = Math.max(Cam.shake, 0.6);
    const caught = [];
    for (const [g, other] of [[G.gates[0], G.B], [G.gates[1], G.A]]) {
      FX2.impact(g.p, 'hecate', { size: 1.2, debris: 16, glowRocks: true, ring: (G.R + 2) / 1.2, sparks: 44, dustPal: 'hecate', dustGlow: 0.45, int: 0.9 });
      FX2.burst(g.p.clone().setY(1.8), 'hexpink', { size: 0.8, sparks: 24, embers: 16, puffs: 3, bursts: 1, int: 0.9 });
      witchSmoke(g.p.clone().setY(0.4), 14, 1.0, G.R * 0.7); starDust(g.p.clone().setY(1), 30, G.R * 0.6);
      for (const d of dummiesNear(g.p, G.R)) caught.push({ d, from: g.p, to: other });
    }
    for (const c of caught) {
      const d = c.d;
      Combat.deal(d, (AB.og.dmg[G.rank - 1] + AB.og.scale * settings.power) * powerMul(), 'ult', 'Open the Gates');
      if (!d.alive) continue;
      d.applyStun(AB.og.stun);
      FX2.burst(d.pos.clone().setY(1.2), 'hecate', { size: 0.6, sparks: 16, embers: 10, puffs: 3, bursts: 1 });
      const off = _v1.copy(d.pos).sub(c.from).setY(0);
      d.placeAt(c.to.clone().add(off), 3.5);
      VFX.later(0.05, () => { FX2.burst(d.pos.clone().setY(1.2), 'hexpink', { size: 0.6, sparks: 16, embers: 10, puffs: 3, bursts: 1 }); });
    }
    if (caught.length) Sound.god('gate_swap', { gain: 1.0 });
    WORLD.dim = 0.8; GodFX.tint(HCOL.violet, 0.25);
  }
  // the marker hint, once
  if (!G.hinted && G.t > 0.4) { G.hinted = true; HUD.toast('Enter a gate – or press F at the gate – to travel through the ground'); }
  // Hecate may travel through the gates once
  // (walking in counts only when she steps INTO a gate - not when she cast it standing on one)
  if (live && !G.used && !HE.tp && G.t > 0.35) {
    for (const [g, to] of [[G.gates[0], G.B], [G.gates[1], G.A]]) {
      const d = Math.hypot(P.pos.x - g.p.x, P.pos.z - g.p.z);
      if (d > 1.8) g.inside = false;
      else if (d < 1.3 && !g.inside) { startGateTravel(G, g.p, to); break; }
    }
  }
  if (G.t > AB.og.delay + 1.2 && WORLD.dim < 1 && !G.calm) { G.calm = true; WORLD.dim = 1; GodFX.tint(HCOL.violet, 0); }
  if (!live) {
    for (const g of G.gates) closeGate(g);
    if (G.loop) G.loop.stop(0.6);
    HE.gates = null;
  }
}

// ---- 5 · THE KEY OF HADES (playroom finale) ---------------------------------------------------
// Hekate Kleidouchos, the key-bearer: at the dark of the moon she unlocks the underworld.
function makeHandTexture() {
  const W = 128, H = 256, c = cnv(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(W * 0.4, H); ctx.lineTo(W * 0.36, H * 0.42); ctx.lineTo(W * 0.64, H * 0.42); ctx.lineTo(W * 0.6, H); ctx.fill();   // the forearm
  ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.36, W * 0.2, H * 0.09, 0, 0, TAU); ctx.fill();                                        // the palm
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,1)';
  [[-0.17, -0.2, 0.06], [-0.07, -0.27, 0.055], [0.04, -0.28, 0.055], [0.14, -0.23, 0.05], [0.24, -0.08, 0.05]].forEach(([dx, dy, w]) => {
    ctx.lineWidth = W * w; ctx.beginPath(); ctx.moveTo(W * (0.5 + dx * 0.6), H * 0.32); ctx.quadraticCurveTo(W * (0.5 + dx * 1.2), H * (0.32 + dy * 0.6), W * (0.5 + dx * 1.05 + 0.03), H * (0.32 + dy)); ctx.stroke();   // long, crooked fingers
  });
  return toTex(c);
}
function castKey() {
  spend('hk'); startCd('hk');
  P.targeting = null;
  const c = groundTarget(AB.hk.range * SU, 6), R = AB.hk.radius;
  const K = { t: 0, c, R, torches: [], hands: [], hounds: [], dragged: new Set(), turned: 0, fired: false };
  HE.key = K;
  Game.anim.play('sigil');
  Cam.frameTarget = 1;
  WORLD.dim = 0.2; GodFX.tint(new THREE.Color(0.14, 0.02, 0.3), 0.85); PostFX.vigTarget = 0.85;
  Sound.god('hk_dark', { gain: 1.0 });
  VFX.later(0.8, () => Sound.god('hk_key', { gain: 1.05 }));
  VFX.later(1.6, () => Sound.god('hk_turn', { gain: 1.0 }));
  VFX.later(2.0, () => Sound.god('hk_abyss', { gain: 1.0 }));
  VFX.later(2.1, () => Sound.god('hk_drag', { gain: 0.9 }));
  VFX.later(2.2, () => Sound.god('hk_hounds', { gain: 0.85 }));
  // the moon goes dark on screen; she speaks the second half - "Hades' gates know my KEY" lands as the key stabs (1.6 s)
  Sound.voice('fin_charge', { priority: 5, gain: 1.15, cooldown: 0, offset: 1.545, hold: 2.2 });
  VFX.later(HK_SLAM - 1.8, () => Sound.voice('fin_roar', { priority: 6, gain: 1.2, cooldown: 0, hold: 2.5 }));   // "Down... to the DEAD" - on the slam
  Sound.duckMusic(0.2, 4.8, 2.4);
  K.sigil = GodFX.decal(c, GodFX.sig.crossroads, HCOL.magenta, R * 2.4, 9999, { spin: 0.25, intensity: 0.7 }); K.sigil.hold = () => smoothstep(0.2, 0.9, K.t) * (K.fade ?? 1);
  K.shade = GodFX.shade(c, R + 2, 0.7);
  K.mist = FX2.mist(c, 'hecate', { radius: R + 4, rate: 34, dur: HK_SLAM + 0.5, glow: 0.3, alpha: 0.75, size: 1.3, rise: 0.5 });
  FX2.burst(P.pos.clone().setY(1.6), 'hecate', { size: 0.9, sparks: 24, embers: 16, puffs: 4 });
  // three torches flare at the crossroads
  for (let i = 0; i < 3; i++) {
    const a = Math.atan2(P.pos.z - c.z, P.pos.x - c.x) + Math.PI / 3 + (i / 3) * TAU, p = V3(c.x + Math.cos(a) * (R + 1.6), 0, c.z + Math.sin(a) * (R + 1.6));
    K.torches.push({ p, on: 0.4 + i * 0.15, glow: null });
  }
  K.hand = makeHandTexture();
}
function updateKey(dt, t) {
  const K = HE.key; if (!K) return;
  K.t += dt;
  const c = K.c, R = K.R;
  Cam.focus = Cam.focus || new THREE.Vector3(); Cam.focus.copy(P.pos).lerp(c, 0.45);
  // the dark: black-violet mist rolls over the floor, stars wink out above
  // torches
  for (const tc of K.torches) {
    if (!tc.glow && K.t >= tc.on) {
      tc.glow = glowSprite(VFX.dotTex, HCOL.magenta, 2.4, 1.4); tc.glow.position.copy(tc.p).setY(2.2); scene.add(tc.glow);
      VFX.flash(tc.p.clone().setY(2.2), HCOL.magenta, 14, 0.5);
      tc.col = GodFX.column(tc.p, 0.18, 2.2, HCOL.deep, { core: HCOL.violet, gain: 0.8 }); tc.col.target = 0.5;
      FX2.burst(tc.p.clone().setY(2.2), 'hexpink', { size: 0.55, sparks: 18, embers: 10, puffs: 2, bursts: 1 });
    }
    if (tc.glow) {
      tc.glow.material.opacity = (0.75 + 0.25 * Math.sin(t * 13 + tc.on * 9)) * (K.fade ?? 1);
      // a living witchfire flame on the torch (flipbook fire), embers and black smoke rising from it
      const fk = (K.fade ?? 1);
      if (Math.random() < dt * 34 * fk) FX2.fire.spawn({ pos: tc.p.clone().add(V3(rand(-0.12, 0.12), 2.05 + rand(0, 0.1), rand(-0.12, 0.12))), vel: V3(rand(-0.2, 0.2), rand(0.6, 1.4), rand(-0.2, 0.2)), life: rand(0.45, 0.7), size: rand(0.7, 0.95), sizeEnd: 0.35, frames: 16, pal: Math.random() < 0.5 ? 'hexpink' : 'hecate', temp: 1.15, tempEnd: 0.55, int: 1.7, rot: rand(-0.25, 0.25), rotVel: 0, turb: 1.2, fadeIn: 0.06 });
      if (Math.random() < dt * 22 * fk) FX2.glow.spawn({ pos: tc.p.clone().add(V3(rand(-0.15, 0.15), 2.3, rand(-0.15, 0.15))), vel: V3(rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5)), life: rand(0.5, 1.0), size: rand(0.04, 0.08), sizeEnd: 0.01, cell: FXA.ember, pal: 'hexpink', temp: 1.2, tempEnd: 0.5, int: 2, turb: 3, drag: 0.6 });
      if (Math.random() < dt * 5 * fk) FX2.smoke.spawn({ pos: tc.p.clone().setY(2.9), vel: V3(rand(-0.2, 0.2), rand(0.8, 1.4), rand(-0.2, 0.2)), life: rand(1.2, 1.8), size: 0.35, sizeEnd: 1.3, frames: 16, pal: 'hecate', temp: 0.3, tempEnd: 0, int: 1, alpha: 0.6, drag: 0.6, turb: 0.6 });
    }
  }
  // the key falls from the black sky, stabs into the earth, turns twice
  if (!K.key && K.t >= 0.75) {
    K.key = summonModel('hecate_key', { height: 9.5, rim: HCOL.violet, rimK: 0.85, edge: HCOL.magenta, dir: 0.95, noise: 5, glow: 0.05 });
    K.keyY0 = 16; K.key.group.position.set(c.x, K.keyY0, c.z); K.key.group.rotation.y = rand(0, TAU);
  }
  if (K.key) {
    const kk = K.key;
    const fall = clamp((K.t - 0.75) / 0.85, 0, 1);
    kk.reveal(K.t < HK_SLAM ? smoothstep(0.75, 1.1, K.t) * 1.12 : 1.12 * (1 - smoothstep(HK_SLAM, HK_SLAM + 0.35, K.t)));
    if (K.t < 1.6) { kk.group.position.y = lerp(K.keyY0, -1.3, easeInCubic(fall)); kk.group.rotation.y += dt * 1.4; if (Math.random() < dt * 60) starDust(kk.group.position.clone().add(V3(0, rand(0, 9), 0)), 1, 0.8); FX2.trailTick(_v4.copy(kk.group.position).setY(kk.group.position.y + 1.0), V3(0, -14, 0), 'hexpink', dt, { k: 3, size: 1.8 }); }
    else {
      kk.group.position.y = -1.3 + (K.t < 1.75 ? Math.sin((K.t - 1.6) * 40) * 0.08 : 0);
      if (!K.stabbed) {
        K.stabbed = true;
        Game.hitStop(0.08, 0.12); Cam.shake = Math.max(Cam.shake, 0.9);
        PostFX.shock(c.clone().setY(1), 0.9, 0.6);
        FX2.impact(c, 'hecate', { size: 1.8, debris: 26, glowRocks: true, ring: (R + 2) / 1.8, sparks: 60, scorchDur: 4, dustPal: 'hecate', dustGlow: 0.45 });
        VFX.cracks(c, R * 1.05, HK_SLAM - 1.6 + 1.2, { grow: 0.4, intensity: 1.2, color: HCOL.magenta, glowHold: 1 });
        witchSmoke(c.clone().setY(0.4), 20, 1.2, 2);
      }
      // two turns of the key, then back again as the gate slams
      const turn = (tt) => smoothstep(0, 0.16, K.t - tt);
      const base = K.baseYaw ?? (K.baseYaw = kk.group.rotation.y);
      kk.group.rotation.y = base + (Math.PI / 2) * (turn(1.75) + turn(2.0)) - (Math.PI / 2) * turn(HK_SLAM - 0.12);
      kk.glow(0.05 + 0.25 * Math.max(0, 1 - Math.abs(K.t - 1.8) * 6) + 0.25 * Math.max(0, 1 - Math.abs(K.t - 2.05) * 6));
    }
  }
  // the gate of Hades opens beneath them
  if (!K.abyss && K.t >= 2.0) {
    K.abyss = GodFX.portal(c.clone(), R, HCOL.violet, new THREE.Color(0.0, 0.0, 0.01), { flat: true, normal: true, dark: 0.97, y: 0.05 });
    K.rim = GodFX.decal(c, VFX.ringTex, HCOL.magenta, R * 2.2, 9999, { intensity: 1.3, spin: 0.8 }); K.rim.hold = () => (K.fired ? 0 : 1);
    Cam.shake = Math.max(Cam.shake, 0.5);
    K.vortex = FX2.vortex(c.clone(), 'hecate', { radius: R * 0.9, height: 4, dur: HK_SLAM - 2.0, rate: 90, spin: 0.7, down: true, vr: -1.2, size: 1.0 });
    FX2.ring(c, 'hexpink', { radius: R + 1, dur: 0.6 });
    for (const d of dummiesNear(c, R)) { K.dragged.add(d); d.carried = true; d.applyStun(HK_SLAM - K.t + 0.6); }
    // the hands of the dead reach up around each of them
    for (const d of K.dragged) {
      for (let i = 0; i < 4; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.hand, color: (i % 2 ? HCOL.violet : HCOL.magenta).clone().multiplyScalar(0.95), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
        sp.renderOrder = 11; scene.add(sp);
        K.hands.push({ sp, d, a: (i / 4) * TAU + rand(-0.3, 0.3), r: rand(0.45, 0.8), delay: rand(0, 0.25), h: rand(1.5, 2.2) });
      }
    }
    for (let i = 0; i < 14; i++) {      // and more, clawing at nothing across the gate
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.hand, color: HCOL.violet.clone().multiplyScalar(0.85), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      sp.renderOrder = 11; scene.add(sp);
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (R - 0.8);
      K.hands.push({ sp, d: null, p: V3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r), a: 0, r: 0, delay: rand(0, 0.6), h: rand(1.2, 2.0) });
    }
    // her hounds howl at the torches
    for (const tc of K.torches) {
      const h = new SpectralBeast('wolf', { style: 'ghost', size: 1.5, color: new THREE.Color(0.16, 0.02, 0.3), rim: new THREE.Color(0.8, 0.2, 0.95), eyes: HCOL.magenta, tex: 0.4 });
      h.alpha = 0; h.group.position.copy(tc.p); h.group.rotation.y = Math.atan2(c.x - tc.p.x, c.z - tc.p.z); K.hounds.push(h);
    }
  }
  for (const h of K.hounds) { h.alpha = smoothstep(2.0, 2.4, K.t) * (K.fade ?? 1) * 0.95; h.group.rotation.x = -0.35 * Math.max(0, Math.sin((K.t - 2.2) * 2.4)); h.update(dt, 0.4, t); }
  for (const hd of K.hands) {
    const kt = K.t - 2.05 - hd.delay;
    const reach = smoothstep(0, 0.3, kt);
    const base = hd.d ? _v1.set(hd.d.pos.x + Math.cos(hd.a) * hd.r, (hd.d.lift || 0) * 0.6, hd.d.pos.z + Math.sin(hd.a) * hd.r) : _v1.copy(hd.p);
    const sway = Math.sin(t * 5 + hd.a * 3) * 0.12;
    hd.sp.position.set(base.x + sway, base.y + hd.h * 0.5 * reach - 0.2, base.z);
    hd.sp.scale.set(0.9, hd.h * reach + 0.01, 1);
    hd.sp.material.rotation = Math.sin(t * 3 + hd.a) * 0.15;
    hd.sp.material.opacity = reach * 0.8 * (K.fired ? Math.max(0, 1 - (K.t - HK_SLAM) * 4) : 1);
  }
  // dragged down into the dark, souls tearing loose
  if (K.abyss && !K.fired) {
    const k = smoothstep(2.15, HK_SLAM - 0.05, K.t);
    for (const d of K.dragged) {
      if (!d.alive) continue;
      const to = _v2.set(c.x - d.pos.x, 0, c.z - d.pos.z), L = to.length();
      if (L > 0.2) d.placeAt(_v3.copy(d.pos).addScaledVector(to, Math.min(1, dt * 1.2)), 2);
      d.lift = -k * ((d.height || 1.8) + 0.4) + Math.sin(t * 30) * 0.03;
      if (Math.random() < dt * 10) GodFX.spawn({ pos: d.pos.clone().setY(0.4 + rand(0, 0.6)), vel: V3(rand(-0.4, 0.4), rand(1.2, 2.4), rand(-0.4, 0.4)), life: rand(0.8, 1.3), size: 0.55, sizeEnd: 0.2, color: HCOL.soul, intensity: 1.4, cell: GX.ghost, alpha: 0.85, alphaEnd: 0, drag: 0.4 });
    }
    if (Math.random() < dt * 60) { const a = rand(0, TAU), r = rand(R * 0.6, R * 1.1); FX2.glow.spawn({ pos: V3(c.x + Math.cos(a) * r, rand(0.2, 2.5), c.z + Math.sin(a) * r), vel: V3(-Math.cos(a) * 3, -rand(0.5, 1.5), -Math.sin(a) * 3), life: rand(0.6, 1.0), size: rand(0.08, 0.16), sizeEnd: 0.01, cell: Math.random() < 0.5 ? FXA.star : FXA.spark, stretch: 1.5, pal: Math.random() < 0.5 ? 'hecate' : 'hexpink', temp: 1.1, tempEnd: 0.5, int: 1.9, rotVel: 4, attract: { x: c.x, y: -1, z: c.z, strength: 8, kill: 0.6 } }); }
  }
  // the gate slams shut
  if (!K.fired && K.t >= HK_SLAM) keySlam(K);
  if (K.fired) {
    const k = K.t - HK_SLAM;
    // the freed souls stream into her torch
    if (k < 1.2 && Math.random() < dt * 30) { const tip = Game.thoth.propL ? Game.thoth.propL.localToWorld(_v4.copy(Game.thoth.propL.userData.tip)) : P.pos.clone().setY(1.6); GodFX.spawn({ pos: c.clone().add(V3(rand(-2, 2), rand(0.2, 1.2), rand(-2, 2))), vel: V3(rand(-1, 1), rand(1, 3), rand(-1, 1)), life: 1.6, size: 0.4, sizeEnd: 0.1, color: HCOL.soul, intensity: 1.4, cell: GX.ghost, alpha: 0.9, alphaEnd: 0.2, attract: { x: tip.x, y: tip.y, z: tip.z, strength: 18, kill: 0.4 } }); }
    K.fade = 1 - smoothstep(0.8, 1.8, k);
    if (k > 1.0) { Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(HCOL.violet, 0); PostFX.vigTarget = 0; WORLD.dim = 1; }
    if (k > 2.2) keyCleanup(K);
  }
}
function keySlam(K) {
  K.fired = true;
  const c = K.c, R = K.R, mid = c.clone().setY(1);
  Sound.god('hk_slam', { gain: 1.1 });
  Game.anim.play('gates');
  Game.hitStop(0.16, 0.06);
  Cam.shake = 1.25; Cam.fovKick = 11;
  PostFX.shock(mid, 1.2, 0.9); PostFX.aberr = 0.008;
  VFX.flash(mid, HCOL.magenta, 26, 0.6);
  FX2.burst(mid.clone().setY(1.6), 'hexpink', { size: 1.9, sparks: 90, embers: 50, puffs: 12, bursts: 2, int: 0.9 });
  FX2.impact(c, 'hecate', { size: 2.2, debris: 30, glowRocks: true, ring: (R + 3) / 2.2, sparks: 70, dustPal: 'hecate', dustGlow: 0.45 });
  VFX.later(0.1, () => FX2.ring(c, 'hecate', { radius: R + 9, dur: 0.85, width: 0.05 }));
  FX2.distort.ring(mid, 30, 0.024, 0.7);
  if (K.abyss) K.abyss.dead = true;
  // the key bursts into dark glass
  if (K.key) { const mat = new THREE.MeshStandardMaterial({ color: 0x1a0626, roughness: 0.15, metalness: 0.6, emissive: HCOL.violet.clone(), emissiveIntensity: 0.8 }); VFX.shatter(c.clone().setY(1.5), mat, 30, 2.4); }
  starDust(mid, 60, 2.5); witchSmoke(c.clone().setY(0.5), 40, 1.4, R * 0.7);
  let kills = 0;
  for (const d of K.dragged) {
    if (d.alive) { Combat.deal(d, (HK_DMG.dragged[0] + HK_DMG.dragged[1] * settings.power) * powerMul(), 'final', 'The Key of Hades'); d.applyStun(1.0); if (!d.alive) kills++; }
    d.carried = false; d.lift = 0;
  }
  // anyone at the edge who escaped the hands is thrown back out
  for (const d of dummiesNear(c, R + 2)) { if (K.dragged.has(d) || !d.alive) continue; Combat.deal(d, (HK_DMG.edge[0] + HK_DMG.edge[1] * settings.power) * powerMul(), 'final', 'The Key of Hades'); d.applyStun(0.8); }
  if (kills >= 2) VFX.later(1.2, () => Sound.voice('fin_line', { priority: 3, cooldown: 20 }));
}
function keyCleanup(K) {
  if (HE.key !== K) return;
  if (K.key) K.key.dispose();
  for (const tc of K.torches) { if (tc.glow) { scene.remove(tc.glow); tc.glow.material.dispose(); } if (tc.col) tc.col.dead = true; }
  for (const hd of K.hands) { scene.remove(hd.sp); hd.sp.material.dispose(); }
  for (const h of K.hounds) h.dispose();
  for (const d of K.dragged) { d.carried = false; d.lift = 0; }
  if (K.abyss) K.abyss.dead = true; if (K.rim) K.rim.dead = true;
  K.sigil.dead = true; K.shade.dead = true; if (K.mist) K.mist.dead = true; if (K.vortex) K.vortex.dead = true;
  Cam.frameTarget = 0; Cam.focus = null; GodFX.tint(HCOL.violet, 0); PostFX.vigTarget = 0; WORLD.dim = 1;
  HE.key = null;
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------
const HECATE_INFO = {
  passive: { name: 'Mythic Ritual', kind: 'Passive · Ritual',
    text: 'In SMITE 2, Hecate channels a ritual on towers and allies. Here in the temple there are no allies, so the ritual is completed by the souls she takes: after a kill she deals 20% more damage for 6 seconds, and a circle of witchfire burns beneath her feet.',
    rows: () => [['Ritual', HE.ritual > 0 ? `${HE.ritual.toFixed(1)} s left` : 'inactive'], ['Bonus', '+20% damage']] },
  tf: { name: 'Triplicate Form', kind: 'Line · Mark / Mesmerize · Magical',
    text: 'Hecate splits in two – the Power form (electric blue) and the Hex form (dark purple) step out of her – and the spell flies through enemies and walls and lingers for one second at max range. The form alternates with each cast: Power marks enemies for 5 s so they take extra damage from everything, Hex mesmerizes them for 1 s.',
    rows: () => { const r = rankOf('tf'); return [['Damage', `${AB.tf.dmg[r - 1]} (+75% of ${settings.power} MP) = ${Math.round(AB.tf.dmg[r - 1] + 0.75 * settings.power)}`], ['Next form', HE.form ? 'Hex (mesmerize)' : 'Power (mark)'], ['Mark', `+${Math.round(AB.tf.mark[r - 1] * 100)}% damage for 5 s`], ['Cooldown', `${cdOf('tf').toFixed(1)} s`]]; } },
  se: { name: 'Spell Eater', kind: 'Sigil · Charges · Magical',
    text: 'A sigil hovers over Hecate and eats spells: each ability grants a charge (max 12), Repel Magic grants three. Press again and aim – the sigil flies there and strikes after 0.75 s, and each charge gives 7.5% more damage.',
    rows: () => { const r = rankOf('se'); return [['Damage', `${AB.se.dmg[r - 1]} (+50% MP) × (1 + 7.5% per charge)`], ['Charges', HE.sigil ? `${Math.floor(HE.sigil.charges)} / 12` : '–'], ['Radius', '3.2 m · up to 9 m away'], ['Cooldown', `${cdOf('se').toFixed(1)} s`]]; } },
  rm: { name: 'Repel Magic', kind: 'Shield · Speed · Magical',
    text: 'A shield of witchfire surrounds Hecate for 5 seconds (it only absorbs magical damage). Enemies around her take damage, she gains 15% speed, and Spell Eater gains 3 charges.',
    rows: () => { const r = rankOf('rm'); return [['Damage', `${AB.rm.dmg[r - 1]} (+70% MP)`], ['Shield', `${AB.rm.shield[r - 1]}`], ['Speed', '+15% for 5 s'], ['Cooldown', `${cdOf('rm').toFixed(1)} s`]]; } },
  og: { name: 'Open the Gates', kind: 'Ultimate · Stun · Teleport · Magical',
    text: 'Hecate tears open two starry gates between the worlds – one right in front of her and one at the target location – marked by a beacon of starlight. After 1.5 seconds both burst: enemies at the gates are damaged, stunned and thrown through to the other gate. The gates last 10 seconds, and Hecate can travel through once: enter a gate (or press F at it), and she sinks into the ground, speeds beneath the floor as a glow of witchfire and rises from the other gate.',
    rows: () => { const r = rankOf('og'); return [['Damage', `${AB.og.dmg[r - 1]} (+85% MP)`], ['Stun', '1 s after 1.5 s'], ['Radius', `${(AB.og.radius * SU).toFixed(1)} m`], ['Cooldown', `${cdOf('og').toFixed(0)} s`]]; } },
  hk: { name: 'The Key of Hades', kind: 'Final ability · The Underworld · True damage',
    text: 'Not in SMITE – Hekate Kleidouchos, the key-bearer. The moon goes out and everything turns dark, three torches flare up at the crossroads, and a colossal key falls from the black sky and is driven into the earth. It is turned – twice – and the gate to Hades opens beneath the enemies. The hands of the dead seize them and drag them down, her hounds howl, and when the gate slams shut they are thrown back up, shattered and stunned. The souls of those who fall fly into her torch.',
    rows: () => [['Center', `up to ${(AB.hk.range * SU).toFixed(0)} m away`], ['Gate', `${AB.hk.radius} m`], ['Damage', `${Math.round(HK_DMG.dragged[0] + HK_DMG.dragged[1] * settings.power)} to those dragged down, ${Math.round(HK_DMG.edge[0] + HK_DMG.edge[1] * settings.power)} at the edge`], ['Cost', `${costOf('hk')} mana`], ['Cooldown', `${cdOf('hk').toFixed(0)} s`]] },
};
registerGod({
  id: 'hecate', dbg: HE, name: 'Hecate', title: 'Keeper of the Crossroads', epithet: 'Goddess of Sorcery', pantheon: 'Greek', role: 'Mage',
  color: '#b77bff', glyphs: '☽ ○ ☾ ✶ ⚷', asset: 'hecate', stats: HECATE_STATS, order: ['tf', 'se', 'rm', 'og', 'hk'], ab: hecateAB,
  blurb: 'The key-bearer at the crossroads – key scepter, torch, the three forms and dark, starry magic – and the finale <em>The Key of Hades</em>.',
  info: HECATE_INFO, magical: true, textColor: '#d4a8ff', finalColor: '#ff7ad0', fxColor: HCOL.violet, accent: HCOL.violet,
  init() { HE.form = 0; HE.ritual = 0; },
  dispose() {
    if (HE.sigil) { const S = HE.sigil; if (S.aura) S.aura.dead = true; scene.remove(S.disc); scene.remove(S.back); S.mat.dispose(); disposeGroup(S.orbs); HE.sigil = null; }
    if (HE.shield) { const W = HE.shield; if (W.aura) W.aura.dead = true; if (W.sph) W.sph.dead = true; W.b.dead = true; HE.shield = null; }   // (the auras go with them: they used to be checked after the null)
    if (HE.gates) { for (const g of HE.gates.gates) closeGate(g); if (HE.gates.loop) HE.gates.loop.stop(0.1); HE.gates = null; }
    if (HE.tp) { HE.tp = null; P.y = 0; P.flying = false; P.grounded = true; }
    if (HE.key) keyCleanup(HE.key);
    if (HE.ritualFx) { HE.ritualFx.dead = true; HE.ritualFx = null; }
    Game.anim.channelTarget = 0;
    WORLD.dim = 1; GodFX.tint(HCOL.violet, 0); PostFX.vigTarget = 0; Cam.frameTarget = 0; Cam.focus = null; P.speedBuff = 1;
  },
  intercept(id) {
    if (HE.key || HE.tp) return true;
    // Open the Gates' recast: travel from the gate she stands at
    if (id === 'og' && HE.gates && !HE.gates.used) {
      const G = HE.gates;
      for (const [from, to] of [[G.A, G.B], [G.B, G.A]]) if (Math.hypot(P.pos.x - from.x, P.pos.z - from.z) < G.R + 1.5) { startGateTravel(G, from, to); return true; }
      HUD.toast('Go to one of the gates first'); return true;
    }
    // Spell Eater's recast: aim where the sigil should fall
    if (id === 'se' && HE.sigil && !HE.sigil.drop && P.targeting !== 'se') { P.targeting = 'se'; return true; }
    return false;
  },
  busy() { return !!(HE.key || HE.tp); },
  moveOverride() { if (HE.tp) { P.vel.set(0, 0, 0); return true; } return false; },
  cast(id) {
    if (id === 'se' && HE.sigil && !HE.sigil.drop) { dropSigil(groundTarget(AB.se.range * SU, 2)); return; }
    ({ tf: castTriplicate, se: castSpellEater, rm: castRepelMagic, og: castOpenGates, hk: castKey })[id]();
    if (id !== 'se') feedSigil(1);
  },
  basic: hecateBasic,
  speedMul() { return HE.key || HE.tp ? 0 : HE.shield ? 1.15 : 1; },
  noJump() { return !!(HE.key || HE.tp); },
  eyeBoost() { return (HE.key ? 1.6 : 0) + (HE.gates ? 0.8 : 0) + (HE.ritual > 0 ? 0.4 : 0) + (HE.shield ? 0.3 : 0); },
  update(dt, t) {
    updateSigil(dt, t); updateShield(dt, t); updateGates(dt, t); updateGateTravel(dt); updateKey(dt, t);
    if (HE.ritual > 0) { HE.ritual -= dt; if (HE.ritual <= 0 && HE.ritualFx) { HE.ritualFx.dead = true; HE.ritualFx = null; } }
  },
  targeter() {
    if (P.targeting === 'se') { const c = groundTarget(AB.se.range * SU, 2); circleTarget.show(c, AB.se.radius * SU, HCOL.violet); }
    else if (P.targeting === 'og') { const c = groundTarget(AB.og.range * SU, 5); circleTarget.show(c, AB.og.radius * SU, HCOL.magenta); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.4, 0.4); }
    else if (P.targeting === 'hk') { const c = groundTarget(AB.hk.range * SU, 6); circleTarget.show(c, AB.hk.radius, HCOL.magenta); lineTarget.show(P.pos, P.yaw, c.distanceTo(_v1.copy(P.pos).setY(0)), 0.4, 0.4); }
  },
  armed(id) { return (id === 'se' && !!HE.sigil) || (id === 'og' && !!HE.gates) || (id === 'hk' && !!HE.key) || (id === 'rm' && !!HE.shield); },
  stack(id) { return id === 'se' && HE.sigil ? Math.floor(HE.sigil.charges) : id === 'tf' ? (HE.form ? 'H' : 'P') : ''; },
  buffs() { return [{ icon: 'hecate_ritual', on: HE.ritual > 0, n: '', t: HE.ritual > 0 ? Math.ceil(HE.ritual) + 's' : '' }, { icon: 'hecate_shield', on: !!HE.shield, n: '', t: HE.shield ? Math.ceil(AB.rm.dur - HE.shield.t) + 's' : '' }]; },
  onKill() {
    if (HE.ritual <= 0) { HE.ritualFx = GodFX.decal(P.pos, GodFX.sig.hex, HCOL.magenta, 2.6, 9999, { spin: 1.2, follow: P.pos, intensity: 1.1 }); HE.ritualFx.hold = () => Math.min(1, HE.ritual) * 0.8; VFX.later(0.6, () => Sound.voice('passive', { priority: 2, cooldown: 25, chance: 0.5 })); }
    HE.ritual = 6;
  },
  onDummyDeath(d, p) { for (let i = 0; i < 5; i++) GodFX.spawn({ pos: p.clone().add(V3(rand(-0.3, 0.3), rand(0.8, 1.6), rand(-0.3, 0.3))), vel: V3(0, rand(0.5, 1.5), 0), life: 1.6, size: 0.6, sizeEnd: 0.15, color: HCOL.soul, intensity: 1.3, cell: GX.ghost, alpha: 0.85, alphaEnd: 0, attract: { x: P.pos.x, y: 1.5, z: P.pos.z, strength: 14, kill: 0.6 } }); },
  icon(ctx, S, id) {
    const witch = (fn, col = '#d6b0ff', blur = 16) => glowText(ctx, fn, col, blur);
    if (id === 'passive' || id === 'hecate_ritual') { iconBase(ctx, S, '#5a1a8a', '#0e0420'); witch(() => { ctx.drawImage(GodFX.sig.hex.image, S * 0.08, S * 0.08, S * 0.84, S * 0.84); }, '#ff7ad0'); }
    else if (id === 'tf') { iconBase(ctx, S, '#3a2ab0', '#08041e'); witch(() => { for (let i = -1; i <= 1; i++) drawMask(ctx, S / 2 + i * S * 0.24, S * (0.52 + Math.abs(i) * 0.04), S * 0.15, i === 0 ? '#ffffff' : i < 0 ? '#8fb0ff' : '#c07bff'); }); }
    else if (id === 'se') { iconBase(ctx, S, '#6a1a9a', '#120420'); witch(() => { ctx.drawImage(GodFX.sig.hex.image, S * 0.12, S * 0.12, S * 0.76, S * 0.76); }, '#ff7ad0'); }
    else if (id === 'rm' || id === 'hecate_shield') { iconBase(ctx, S, '#7a2ac8', '#140630'); witch(() => { ctx.strokeStyle = '#efe0ff'; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.32, 0, TAU); ctx.stroke(); ctx.lineWidth = S * 0.03; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.2, 0, TAU); ctx.stroke(); }); }
    else if (id === 'og') { iconBase(ctx, S, '#22104a', '#05020e'); witch(() => { for (const sx of [-1, 1]) { const g = ctx.createRadialGradient(S / 2 + sx * S * 0.2, S / 2, 1, S / 2 + sx * S * 0.2, S / 2, S * 0.2); g.addColorStop(0, '#f0d8ff'); g.addColorStop(0.5, sx < 0 ? '#9a5cff' : '#ff5ab8'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(S / 2 + sx * S * 0.2, S / 2, S * 0.15, S * 0.3, 0, 0, TAU); ctx.fill(); } }); }
    else if (id === 'hk') { iconBase(ctx, S, '#3a0a5a', '#020008'); witch(() => { ctx.fillStyle = '#e8d0ff'; ctx.beginPath(); ctx.arc(S / 2, S * 0.26, S * 0.14, 0, TAU); ctx.fill(); ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(S / 2, S * 0.26, S * 0.07, 0, TAU); ctx.fill(); ctx.restore(); ctx.fillRect(S * 0.46, S * 0.36, S * 0.08, S * 0.46); ctx.fillRect(S * 0.54, S * 0.66, S * 0.12, S * 0.05); ctx.fillRect(S * 0.54, S * 0.75, S * 0.09, S * 0.05); }, '#ff5ab8', 20); }
    else return false;
    return true;
  },
});
function drawMask(ctx, x, y, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, s * 0.8, s, 0, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * s * 0.32, y - s * 0.15, s * 0.18, s * 0.11, 0, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.ellipse(x, y + s * 0.45, s * 0.25, s * 0.08, 0, 0, TAU); ctx.fill();
  ctx.restore();
}


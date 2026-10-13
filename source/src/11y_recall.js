// ============================================================================
// RECALL (B): a 6-second channel home. Moving, jumping, casting, attacking, being hit, stunned or killed
// breaks it. The look is calm and Egyptian - no vortex: a golden sun-disc rune circle with an ankh opens
// at the feet, golden motes rise straight up, an ankh of light gathers above the head, and at the end a
// column of light carries the god home (a flash where they leave, a flash where they arrive).
//   Arena 5v5      -> the team's fountain (Arena.placePlayer)
//   Treningsrom    -> the player spawn (0, 0, -18)
// Bots in the arena recall too (Recall.botConsider / botTick, called from BotGod in 15b_arena_units.js)
// when they are low, far from home and nobody is near - same look, a lighter FX budget.
// Hooks elsewhere: 11_player.js (B key, interrupt on cast / basic attack), 14_main.js (no god switch while
// recalling), 15b_arena_units.js (bot think/update). Everything else lives in this file.
// ============================================================================
const RECALL = {
  time: 6.0,           // channel length (s)
  botTime: 6.0,
  botMinDist: 30,      // a bot only recalls when it is at least this far from its fountain...
  botSafeR: 16,        // ...no enemy god is within this radius...
  botQuiet: 2.5,       // ...and it has not been hit for this long
  gold: new THREE.Color(1.0, 0.62, 0.12),
  deep: new THREE.Color(0.95, 0.38, 0.04),
  sky: new THREE.Color(0.25, 0.62, 1.0),
};
// the ground sigil: a sun disc with rays and a great ankh inside a ring of hieroglyphs (white on clear, tinted)
function makeRecallSigil(S = 512) {
  const c = cnv(S), ctx = c.getContext('2d'), x = S / 2, y = S / 2, R = S * 0.47;
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; ctx.lineCap = 'round';
  const ring = (r, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
  ring(R, 6); ring(R * 0.94, 2); ring(R * 0.66, 3); ring(R * 0.6, 1.5);
  const keys = ['ankh', 'sun', 'djed', 'eye', 'feather', 'ibis', 'ankh', 'sun', 'djed', 'eye', 'feather', 'water'];
  keys.forEach((k, i) => { const a = i / keys.length * TAU - Math.PI / 2; ctx.save(); ctx.translate(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); ctx.rotate(a + Math.PI / 2); drawGlyph(ctx, k, 0, 0, R * 0.16, '#fff'); ctx.restore(); });
  // the sun disc: a soft filled disc, then rays
  const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.36); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 0.36, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff';
  ring(R * 0.36, 4);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.lineWidth = i % 2 ? 2 : 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.39, y + Math.sin(a) * R * 0.39); ctx.lineTo(x + Math.cos(a) * R * (i % 2 ? 0.48 : 0.56), y + Math.sin(a) * R * (i % 2 ? 0.48 : 0.56)); ctx.stroke(); }
  ctx.shadowBlur = 10; drawGlyph(ctx, 'ankh', x, y, R * 0.5, '#fff');
  return toTex(c, { srgb: false });
}
// an upright ankh of light (a billboard)
function makeAnkhSprite(S = 256) {
  const c = cnv(S), ctx = c.getContext('2d');
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; drawGlyph(ctx, 'ankh', S / 2, S / 2, S * 0.78, '#fff');
  ctx.shadowBlur = 0; drawGlyph(ctx, 'ankh', S / 2, S / 2, S * 0.78, '#fff');
  return toTex(c, { srgb: false });
}

const Recall = {
  active: null,        // the player's channel ({ t, pos, hp, fx... }) or null
  el: null, fillEl: null,
  tex() { if (!this._sig) { this._sig = makeRecallSigil(); this._ankh = makeAnkhSprite(); } return this._sig; },

  // ------------------------------------------------------------------ the player
  start() {
    if (this.active || Game.mode !== 'play' || P.dead || P.stunT > 0 || !P.grounded || kitBusy()) { if (!this.active && Game.mode === 'play' && !P.dead) Sound.deny(); return; }
    if (Arena.active && Arena.phase !== 'play') return;
    P.targeting = null;
    const pos = P.pos.clone().setY(0);
    const R = this.active = { t: 0, pos, hp: P.hp, kit: Kit, dur: RECALL.time };
    R.fx = this.channelFx(pos, 1);
    Sound.arena('ankh_spawn', { gain: 0.45 });
    this.bar(true);
    Net.act('rc', 0, Net.cm(pos.x), Net.cm(pos.z));   // (online: the others see the channel at my feet)
  },
  interrupt(reason = '') {
    const R = this.active; if (!R) return;
    this.active = null;
    this.stopFx(R.fx, false);
    this.bar(false);
    Net.act('rc', 1);
    if (reason && Game.mode === 'play') { HUD.warn('Recall canceled'); Sound.play('cancel', { gain: 0.45 }); }
  },
  // per frame, from updatePlayer (after the inputs)
  update(dt) {
    const R = this.active; if (!R) return;
    if (Game.mode !== 'play') return;   // paused / inspecting: the channel waits
    const moved = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some((k) => input.down.has(k)) || Math.hypot(P.pos.x - R.pos.x, P.pos.z - R.pos.z) > 0.5;
    if (P.dead || Kit !== R.kit || (Arena.active && Arena.phase !== 'play')) { this.interrupt(); return; }
    if (moved) { this.interrupt('move'); return; }
    if (P.stunT > 0) { this.interrupt('cc'); return; }
    if (P.hp < R.hp - 0.5) { this.interrupt('damage'); return; }
    if (input.lmb || input.rmbPressed) { this.interrupt('attack'); return; }
    R.hp = Math.max(R.hp, P.hp);   // (regen and fountain healing do not count as damage later)
    R.t += dt;
    this.tickFx(R.fx, R.t / R.dur, dt, 1);
    if (this.fillEl) this.fillEl.style.transform = `scaleX(${clamp(R.t / R.dur, 0, 1).toFixed(3)})`;
    if (R.t >= R.dur) this.finish();
  },
  finish() {
    const R = this.active; this.active = null; this.bar(false);
    const from = P.pos.clone().setY(0);
    this.stopFx(R.fx, true);
    this.flashAt(from, 1);
    // home
    if (Arena.active) Arena.placePlayer();
    else { P.pos.set(0, 0, -18); P.vel.set(0, 0, 0); P.y = 0; P.vy = 0; P.grounded = true; P.yaw = 0; Cam.yaw = 0; }
    P.vel.set(0, 0, 0);
    const to = P.pos.clone().setY(0);
    this.arrive(to, 1);
    Sound.arena('respawn', { gain: 0.8 });
    Net.act('rc', 2, Net.cm(from.x), Net.cm(from.z), Net.cm(to.x), Net.cm(to.z));
  },

  // ------------------------------------------------------------------ bots (Arena 5v5)
  // called from BotGod.think() while the bot is retreating
  botConsider(b) {
    if (b.recall || !b.alive || !Arena.active || Arena.phase !== 'play' || b.motion || !b.canAct) return false;
    const f = ArenaMap.fountains[b.team].pos;
    if (Math.hypot(b.pos.x - f.x, b.pos.z - f.z) < RECALL.botMinDist) return false;
    if (Combat.time - b.lastHit < RECALL.botQuiet) return false;
    for (const u of Arena.foesOf(b.team)) if (u.alive && (u.isGod || u.isPlayer) && Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z) < RECALL.botSafeR) return false;
    const pos = b.pos.clone().setY(0);
    b.recall = { t: 0, pos, hp: b.hp, dur: RECALL.botTime };
    b.recall.fx = this.channelFx(pos, 0.4, b);
    b.velocity.set(0, 0, 0);
    return true;
  },
  // instead of act() while recalling; returns false when the channel ended this frame
  botTick(b, dt) {
    const R = b.recall; if (!R) return false;
    if (!b.alive || !b.canAct || b.motion || b.hp < R.hp - 0.5 || Math.hypot(b.pos.x - R.pos.x, b.pos.z - R.pos.z) > 0.6 || !Arena.active || Arena.phase !== 'play') { this.botCancel(b); return false; }
    R.hp = Math.max(R.hp, b.hp);
    b.velocity.set(0, 0, 0);
    R.t += dt;
    this.tickFx(R.fx, R.t / R.dur, dt, 0.4, b);
    if (R.t < R.dur) return true;
    b.recall = null;
    const near = b.onScreen && b.camDist < 45;
    this.stopFx(R.fx, near);
    if (near) this.flashAt(R.pos, 0.45);
    Arena.placeAtFountain(b, b.slot);
    b.state = 'retreat'; b.target = null;
    if (camera.position.distanceTo(b.pos) < 45) this.arrive(b.pos.clone().setY(0), 0.45);
    return false;
  },
  // cancel every channel at once, silently (match teardown, restart)
  reset() {
    this.interrupt();
    if (this.active) this.active = null;
    for (const b of (Arena.bots || [])) if (b.recall) { const fx = b.recall.fx; b.recall = null; if (fx) { if (fx.sig) fx.sig.dead = true; if (fx.column) fx.column.dead = true; } }
  },
  botCancel(b) { const R = b.recall; if (!R) return; b.recall = null; this.stopFx(R.fx, false); },

  // ------------------------------------------------------------------ the look
  // k = FX budget (1 player, ~0.4 bots); `b` (bot) skips the work while it is off screen
  channelFx(pos, k = 1, b = null) {
    const tex = this.tex(), fx = { k, motes: 0, pos, column: null, ankh: null, b };
    fx.a = 0;
    fx.sig = VFX.decal(pos, tex, RECALL.gold, 3.4, 9999, { spin: 0.22, intensity: 1.55, y: 0.045 });
    fx.sig.hold = () => fx.a;
    if (k >= 0.8) {   // the player: a second, slower counter-turning ring of glyphs and an ankh of light above the head
      fx.inner = VFX.decal(pos, VFX.runeTex, RECALL.deep, 2.2, 9999, { spin: -0.35, intensity: 1.1, y: 0.05 });
      fx.inner.hold = () => fx.a * 0.7;
      const s = glowSprite(this._ankh, RECALL.gold, 0.6, 1.6); s.material.opacity = 0; s.position.set(pos.x, 2.5, pos.z); s.material.fog = false; scene.add(s);
      fx.ankh = s;
    }
    return fx;
  },
  tickFx(fx, p, dt, k = 1, b = null) {
    if (!fx) return;
    const pp = clamp(p, 0, 1);
    fx.a = smoothstep(0, 0.12, pp) * (0.75 + 0.25 * smoothstep(0.7, 1, pp));
    if (fx.sig) fx.sig.size = 3.4 * (0.92 + 0.08 * Math.sin(pp * Math.PI * 6) * (1 - pp));
    const show = !b || (b.onScreen && b.camDist < 45);
    if (!show || !FX2.ready) return;
    // golden motes rising straight up from the circle (a little more as the channel fills; no swirling)
    fx.motes += dt * (8 + 26 * pp) * k;
    while (fx.motes > 1) {
      fx.motes--;
      const a = rand(0, TAU), r = rand(0.35, 1.55);
      FX2.glow.spawn({ pos: V3(fx.pos.x + Math.cos(a) * r, rand(0.05, 0.3), fx.pos.z + Math.sin(a) * r), vel: V3(0, rand(0.9, 1.9), 0), life: rand(0.9, 1.5), size: rand(0.04, 0.085), sizeEnd: 0.015, cell: Math.random() < 0.6 ? FXA.spark : FXA.ember, stretch: 1.6, pal: 'thothGold', temp: 1.05, tempEnd: 0.45, int: 1.5, drag: 0.2, fadeIn: 0.15 });
    }
    // the ankh above the head gathers light and slowly rises
    if (fx.ankh) { fx.ankh.material.opacity = smoothstep(0.15, 0.6, pp) * 0.85; fx.ankh.position.y = 2.45 + pp * 0.45; fx.ankh.scale.setScalar(0.5 + pp * 0.25); }
    // the column of light builds over the last second
    if (pp > 0.83 && !fx.column) { fx.column = GodFX.column(fx.pos, 0.85 * (k < 0.8 ? 0.8 : 1), 16, RECALL.gold, { core: new THREE.Color(1.0, 0.86, 0.5), k: 3, gain: 0.9, scroll: -4 }); fx.column.target = 0.35; }
    if (fx.column) fx.column.target = 0.35 + 0.65 * smoothstep(0.83, 1, pp);
  },
  stopFx(fx, done) {
    if (!fx) return;
    // the circles fade out over a third of a second (decals with a hold() are only removed when marked dead)
    // (the decal removes itself once faded - no timer, so a cleared timer list can never strand one)
    const fade = (d, a0) => { if (!d) return; const t0 = performance.now(); d.hold = () => { const k = 1 - (performance.now() - t0) / 350; if (k <= 0) d.dead = true; return a0 * Math.max(0, k); }; };
    fade(fx.sig, fx.a); fade(fx.inner, fx.a * 0.7);
    if (fx.ankh) { scene.remove(fx.ankh); fx.ankh.material.dispose(); fx.ankh = null; }
    if (fx.column) { if (done) { const c = fx.column; c.target = 1; VFX.later(0.12, () => { c.dead = true; }); } else fx.column.dead = true; }
  },
  // the departure flash (k: FX budget)
  flashAt(pos, k = 1) {
    VFX.flash(pos.clone().setY(1.4), RECALL.gold, 22 * k, 0.4);
    if (!FX2.ready) return;
    FX2.burst(pos.clone().setY(1.1), 'thothGold', { size: 0.7 * Math.max(0.6, k), sparks: Math.round(22 * k), embers: Math.round(10 * k), puffs: 0, bursts: 1, light: false, distort: k > 0.8 });
    FX2.ring(pos, 'thothGold', { radius: 2.6, dur: 0.45, width: 0.06 });
  },
  // the arrival: a short column and a flash
  arrive(pos, k = 1) {
    VFX.flash(pos.clone().setY(1.4), RECALL.gold, 26 * k, 0.45);
    const c = GodFX.column(pos, 0.8, 16, RECALL.gold, { core: new THREE.Color(1.0, 0.86, 0.5), k: 30, gain: 0.9, scroll: -6 }); c.target = 0.9;
    VFX.later(0.28, () => { c.dead = true; });
    if (!FX2.ready) return;
    FX2.ring(pos, 'thothGold', { radius: 3, dur: 0.6, width: 0.06 });
    FX2.burst(pos.clone().setY(1.2), 'thothGold', { size: 0.8 * Math.max(0.6, k), sparks: Math.round(24 * k), embers: Math.round(12 * k), puffs: 0, bursts: 1, light: false, distort: false });
    if (k >= 0.8) VFX.decal(pos, this.tex(), RECALL.gold, 3.4, 0.9, { spin: 0.3, intensity: 1.35, grow: 0.25 });
  },

  // ------------------------------------------------------------------ the channel bar (HUD)
  bar(on) {
    if (!this.el) {
      const css = document.createElement('style');
      css.textContent = `
#recall { position: absolute; left: 50%; bottom: calc(176px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(280px, 70vw); display: grid; gap: 4px; justify-items: center; pointer-events: none; }
#recall .t { font: 800 13px var(--font-display); letter-spacing: .24em; color: #ffd27a; text-shadow: 0 0 10px rgba(255,150,30,.65), 0 1px 2px #000; text-transform: uppercase; }
#recall .b { position: relative; width: 100%; height: 8px; background: rgba(8,10,22,.85); border: 1px solid rgba(230,184,90,.6); box-shadow: 0 0 12px rgba(255,150,30,.25); overflow: hidden; }
#recall .b i { position: absolute; inset: 0; transform-origin: left center; transform: scaleX(0); background: linear-gradient(90deg, #b8650f, #ffb43a 60%, #ffe39a); }
`;
      document.head.appendChild(css);
      const el = document.createElement('div'); el.id = 'recall'; el.hidden = true;
      el.innerHTML = '<div class="t">𓋹 Recall · B</div><div class="b"><i></i></div>';
      (document.getElementById('hud') || document.body).appendChild(el);
      this.el = el; this.fillEl = el.querySelector('.b i');
    }
    this.el.hidden = !on;
    if (on) this.fillEl.style.transform = 'scaleX(0)';
  },
};


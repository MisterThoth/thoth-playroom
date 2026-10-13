// ============================================================================
// ARENA 5v5 (3/3) · the match. Tickets (200 each): -5 for a god slain by the enemy, -1 per own minion killed,
// -1 per enemy minion through your portal, -15 when the enemy's Sebek reaches it, -10 for losing the
// judgement of the Scales of Ma'at. Waves every 30 s, a siege colossus every 3 min, levels 3-20 over time
// and from kills (abilities rank up automatically), respawn at the fountain after 5 + level x 0.8 s.
// Features: Scarab Gifts, the Scales of Ma'at, Set's Sandstorm (once), the Ankh of Rebirth (comeback),
// announcer hooks (Sound.announce), kill feed, minimap, Tab scoreboard, victory / defeat screen.
// ============================================================================
const ARENA_TXT = {
  first_blood: 'First Blood!', double_kill: 'Double Kill!', triple_kill: 'Triple Kill!', killing_spree: 'Killing Spree!',
  victory: 'Victory!', defeat: 'Defeat!', scales_rise: 'The Scales of Ma’at rise!', scales_won: 'The judgement is passed!', sandstorm: 'Set’s Sandstorm!',
  siege_spawn: 'The Sebek Colossi awaken!', ankh: 'The Ankh of Rebirth has appeared!',
};
const SCARAB_GIFTS = [
  { id: 'heal', name: 'Healing', text: '+35% health' },
  { id: 'shield', name: 'Shield', text: 'shield for 8 s' },
  { id: 'speed', name: 'Speed', text: '+30% speed for 8 s' },
  { id: 'dmg', name: 'Strength', text: '+25% damage for 10 s' },
];
const xpNeed = (L) => 90 + 30 * L;
const ranksFor = (L) => [clamp(Math.ceil(L / 3.4), 1, 5), clamp(Math.ceil((L - 1) / 3.6), 1, 5), clamp(Math.ceil((L - 2) / 3.6), 1, 5),
  L >= 17 ? 5 : L >= 13 ? 4 : L >= 9 ? 3 : L >= 5 ? 2 : 1, clamp(1 + Math.floor((L - 3) / 4), 1, 5)];

const Arena = {
  active: false, phase: 'off', loading: false, time: 0, speedK: 1, tickets: [200, 200],
  units: [], bots: [], shots: [], scarabs: [], siege: [null, null], roster: null, pu: null,
  foes: [[], [], []], allies: [[], [], []], frustum: new THREE.Frustum(), visT: 0, mapT: 0, uiT: 0, xpT: 0,
  fountainUnits: [], pbuffs: {}, pstats: null, feed: [], wave: 0,
  myTeam: 0, humans: [], waiting: false,   // online: my team, the other humans' stand-ins (RemotePlayerUnit), set up and waiting for the start
  // the rules run here: single player, or the host of an online match (a client's world is the host's, replicated)
  get authority() { return !Net.online || !Net.match || Net.isHost; },

  // ---------------------------------------------------------------- launching
  async launch() {
    if (this.loading || this.active) return;
    this.loading = true;
    Sound.init();
    UI.play.disabled = true;
    const set = (p, txt) => { UI.loadBar.style.width = (p * 100).toFixed(0) + '%'; if (txt) UI.loadTxt.textContent = txt; };
    try {
      this.rollRoster();
      set(0.05, 'Gathering the gods for the arena');
      await this.loadAssets((p) => set(0.05 + p * 0.55, `Awakening the gods · 3D models ${Math.round(p * 100)}%`));
      await ArenaMap.build((p) => set(0.6 + p * 0.25, 'Building the Arena of Ma’at'));
      set(0.86, 'Tuning the instruments'); await Promise.race([Sound.loadArena(this.allGods()), new Promise((r) => setTimeout(r, 6000))]);
      set(0.9, 'Leading the gods into the arena'); await nextFrame();
      await this.setupMatch();
      set(0.96, 'Compiling magic'); await nextFrame();
      try { renderer.compile(scene, camera); } catch (e) { /* compiled on first draw */ }
      set(1, 'Ready');
      this.begin();
    } catch (e) {
      console.error('[arena]', e);
      UI.loadTxt.textContent = 'The arena could not be loaded: ' + e.message;
      if (this.active || ArenaMap.saved) this.exit(true);
    } finally { this.loading = false; UI.play.disabled = false; }
  },
  // online (14n_net.js): the host's match header m decides the teams; every page loads every god in it and sets
  // the match up, then waits (Arena.waiting) for the host's start - Net calls begin() on the 'play' edge
  async launchOnline(m) {
    if (this.loading || this.active) return false;
    this.loading = true; this.waiting = false;
    Sound.init();
    UI.play.disabled = true; UI.start.hidden = false;
    const set = (p, txt) => { UI.loadBar.style.width = (p * 100).toFixed(0) + '%'; if (txt) UI.loadTxt.textContent = txt; };
    try {
      this.roster = m.roster.map((t) => t.slice());
      set(0.05, 'Gathering the gods for the arena');
      await this.loadAssets((p) => set(0.05 + p * 0.55, `Awakening the gods · 3D models ${Math.round(p * 100)}%`));
      await ArenaMap.build((p) => set(0.6 + p * 0.25, 'Building the Arena of Ma’at'));
      set(0.86, 'Tuning the instruments'); await Promise.race([Sound.loadArena(this.allGods()), new Promise((r) => setTimeout(r, 6000))]);
      if (!Net.online || Net.abortLoad) return false;
      set(0.9, 'Leading the gods into the arena'); await nextFrame();
      await this.setupMatch();
      set(0.96, 'Compiling magic'); await nextFrame();
      if (!HEADLESS) try { renderer.compile(scene, camera); } catch (e) { /* compiled on first draw */ }
      set(1, 'Waiting for the other players …');
      this.waiting = true;
      return true;
    } catch (e) {
      console.error('[arena]', e);
      UI.loadTxt.textContent = 'The arena could not be loaded: ' + e.message;
      if (this.active || ArenaMap.saved) this.exit(true);
      return false;
    } finally { this.loading = false; UI.play.disabled = false; }
  },
  rollRoster() {
    const me = Kit ? Kit.id : settings.god;
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // (botGodList: the bots never play an owner-only / no-bot god such as Cookie Monster)
    this.roster = [[me, ...shuffle(botGodList().filter((g) => g !== me)).slice(0, 4)], shuffle(botGodList()).slice(0, 5)];
  },
  allGods() { return [...new Set([...this.roster[0], ...this.roster[1]])]; },
  async loadAssets(onP) {
    const names = [...this.allGods().filter((g) => !Assets.glb[g]), ...ARENA_ASSETS.map((a) => a[0]).filter((n) => !Assets.glb[n] && !this.missing?.has(n))];
    this.missing = this.missing || new Set();
    const total = names.reduce((a, n) => a + (GOD_MB[n] || 2), 0) * 1e6 || 1, got = {};
    await Promise.all(names.map((n) => loadAsset(n, (l) => { got[n] = l; onP(Math.min(1, Object.values(got).reduce((a, b) => a + b, 0) / total)); })
      .catch((e) => { this.missing.add(n); console.warn('[arena] asset', n, e.message); })));
    for (const g of this.allGods()) if (!Assets.glb[g]) throw new Error(`The 3D model for ${GODS[g].name} is missing`);
  },

  // ---------------------------------------------------------------- the match
  async setupMatch() {
    this.installHooks();
    if (!ArenaMap.saved) {
      ArenaMap.enter();
      // the playroom's dummies step aside (their statuses and meshes go quiet)
      this.savedDummies = Combat.dummies;
      for (const d of this.savedDummies) { d.clearStatus(); if (d.statusFx) { d.statusFx.dispose(); d.statusFx = null; } d.mesh.visible = false; }
      settingsOverride = { level: settings.level, power: settings.power, cdr: settings.cdr, ranks: settings.ranks.slice(), noCooldowns: settings.noCooldowns, infiniteMana: settings.infiniteMana };
      settings.noCooldowns = false; settings.infiniteMana = false;
    }
    Combat.dummies = [];
    this.clearFx();
    this.time = 0; this.tickets = [200, 200]; this.wave = 0; this.feed = []; this.firstBlood = false;
    this.phase = 'setup'; this.speedK = 1; this.pbuffs = {}; this.playerAnkh = false; this.playerShield = 0; this.playerShieldT = 0;
    this.pstats = { k: 0, d: 0, a: 0, dmg: 0, godDmg: 0, minions: 0, spree: 0, multi: 0, multiT: -99, taken: 0, healed: 0 };
    this.timers = { wave: 4, siege: 180, scales: 150, scarab: rand(45, 70), storm: false };
    this.scales = { active: false, phase: 'idle', t: 0, hold: [0, 0] };
    this.storm = { on: false, done: false, t: 0, k: 0 };
    this.ankh = [{ spawned: false, mesh: null }, { spawned: false, mesh: null }];
    // the player (online: on my lobby team, with my net id; 14n_net.js)
    const net = Net.online && Net.match ? Net.match : null;
    this.myTeam = net ? Net.myTeam : 0; this.humans = [];
    this.pu = new PlayerUnit();
    if (net) { this.pu.team = this.myTeam; this.pu.id = Net.myUid; }
    this.pu.level = 3; this.pu.xp = 0;
    P.dead = false; P.stunT = P.rootT = P.slowT = 0; P.slowAmt = 0; P.arenaSpeed = 1; P.arenaAs = 1;
    this.setPlayerLevel(3, true);
    if (Kit) Kit.dispose();
    for (const p of Combat.projectiles) if (p.alive) p.die(p.pos, false);
    Combat.projectiles = [];
    for (const w of Combat.walls) { w.alive = false; disposeGroup(w.group); }
    Combat.walls = [];
    await selectGod(net ? this.roster[Net.myTeam][Net.mySlot] : Kit ? Kit.id : this.roster[0][0], { force: true, voice: false });
    this.setPlayerLevel(3, true);
    Game.thoth.root.visible = true; Game.thoth.root.rotation.x = 0;
    this.placePlayer();
    // the bots (online: the other humans get stand-ins, and every page numbers the units the same way)
    this.units = []; this.bots = []; this.siege = [null, null];
    if (net) arenaUnitSeq = 0;
    this.roster.forEach((list, team) => list.forEach((g, i) => {
      if (net ? net.own[team][i] === Net.me : team === 0 && i === 0) return;
      if (net && net.own[team][i]) { const h = Net.makeHuman(net, team, i); this.placeAtFountain(h, i); this.units.push(h); this.humans.push(h); return; }
      const b = new BotGod(g, team, i);
      this.placeAtFountain(b, i);
      b.facing = team === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.units.push(b); this.bots.push(b);
    }));
    for (const c of ArenaMap.camps) this.spawnCamp(c);
    this.fountainUnits = [0, 1].map((t) => ({ team: t, isFountain: true, isGod: false, name: 'Fountain', alive: true, pos: ArenaMap.fountains[t].pos, radius: 1 }));
    this.syncTargets();
    this.buildScales();
  },
  begin() {
    this.active = true; this.phase = 'play'; this.waiting = false;
    if (Net.online) Net.hideLobby();   // (online: nothing of the lobby over the match)
    UI.start.hidden = true; UI.hud.hidden = false; UI.menu.hidden = true;
    this.ui.root.hidden = false; this.ui.end.hidden = true; this.ui.dead.hidden = true;
    document.getElementById('app').classList.add('arena-mode');
    input.enabled = true; Game.mode = 'play';
    Cam.yaw = P.yaw; Cam.pitch = CAM_PITCH; Cam.pos.copy(camera.position); Cam.focus = null; Cam.shot = null; Cam.frameTarget = 0;
    requestLock();
    setTimeout(() => { if (!input.locked && Game.mode === 'play' && !fallbackLook) enableFallbackLook(); }, 700);
    setTimeout(() => { try { drawPortrait(document.getElementById('portraitCv')); } catch (e) { /* cosmetic */ } }, 250);
    this.announce(null, 'Arena of Ma’at · the match begins!', true);
    Sound.arena('match_start', { gain: 0.8 });
    const mt = this.myTeam;
    [this.ui.t0, this.ui.t1].forEach((el, t) => { el.querySelector('span').textContent = TEAMS[t].name + (t === mt ? ' · your team' : ''); });
    HUD.toast(`${Kit.name} vs ${this.roster[1 - mt].map((g) => GODS[g].name).join(', ')}`);
  },
  // at my team's fountain, facing the arena (team 0 starts on the -x side)
  placePlayer() {
    const t = this.myTeam, f = ArenaMap.fountains[t].pos, dir = -TEAMS[t].side;
    P.pos.set(f.x + dir * 2.6, 0, rand(-1.5, 1.5)); P.vel.set(0, 0, 0); P.y = 0; P.vy = 0; P.grounded = true;
    P.yaw = dir * Math.PI / 2; Cam.yaw = P.yaw;
  },
  placeAtFountain(u, i = 0) {
    const f = ArenaMap.fountains[u.team].pos, dir = -TEAMS[u.team].side, a = (i / 5) * TAU + rand(-0.3, 0.3);
    u.pos.set(f.x + dir * 2.8 + Math.cos(a) * 1.6, 0, f.z + Math.sin(a) * 3.2);
  },
  // the units the player's kits may hit: the enemy team and the neutral camps (never allies)
  syncTargets() { const mt = this.myTeam; Combat.dummies = this.units.filter((u) => u.team !== mt && !u.gone); },
  foesOf(team) { return this.foes[team]; },
  refreshLists() {
    const F = this.foes, Al = this.allies;
    for (let i = 0; i < 3; i++) { F[i].length = 0; Al[i].length = 0; }
    for (const u of this.units) { if (u.gone) continue; Al[u.team].push(u); if (u.team !== 0) F[0].push(u); if (u.team !== 1) F[1].push(u); if (u.team !== 2) F[2].push(u); }
    if (this.pu) { const mt = this.myTeam; for (let i = 0; i < 3; i++) if (i !== mt) F[i].push(this.pu); Al[mt].push(this.pu); }
  },
  foesNear(c, R, team) { const out = []; for (const u of this.foes[team]) if (u.alive && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) <= R + u.radius) out.push(u); return out; },
  alliesNear(c, R, team) { const out = []; for (const u of this.allies[team]) if (u.alive && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) <= R + u.radius) out.push(u); return out; },
  visibleTo(u, team) { return u.team === team || !u.seen || u.seen[team] !== false; },
  inOwnBase(p, team) { return TEAMS[team].side * p.x > AM.gateX - 0.5; },
  inEnemyBase(p, team) { return this.inOwnBase(p, 1 - team); },
  inFountainZone(p, team) { const f = ArenaMap.fountains[team].pos; return Math.hypot(p.x - f.x, p.z - f.z) < AM.fountR; },
  // the base walls are only open at the gate: walk through the opening on the way in and out
  route(from, goal) {
    const sideOf = (p) => (p.x > AM.gateX - 0.3 ? 1 : p.x < -(AM.gateX - 0.3) ? -1 : 0);
    const sf = sideOf(from), sg = sideOf(goal), open = AM.gateOpen - 0.9;
    if (sf === sg) return { x: goal.x, z: goal.z, via: false };
    if (sf !== 0) {   // leaving a base
      if (Math.abs(from.z) > open) return { x: sf * (AM.gateX + 4), z: 0, via: true };
      return { x: sf * (AM.gateX - 4.5), z: clamp(goal.z, -2, 2), via: true };
    }
    if (Math.abs(from.z) < open && sg * from.x > AM.gateX - 6) return { x: sg * (AM.gateX + 4.5), z: 0, via: true };
    return { x: sg * (AM.gateX - 4.5), z: 0, via: true };
  },
  // where a team's push stands: its most advanced minion (or the middle of its half)
  frontline(team) {
    const dir = -TEAMS[team].side; let best = null, bx = -1e9;
    for (const u of this.allies[team]) if (u.isMinion && u.alive && dir * u.pos.x > bx) { bx = dir * u.pos.x; best = u; }
    if (best) return _au1.set(clamp(best.pos.x, -AM.gateX + 4, AM.gateX - 4), 0, best.pos.z);
    return _au1.set(-dir * 14, 0, 0);
  },

  // ---------------------------------------------------------------- damage, deaths, levels
  playerDmgMul() { let m = 1; if (this.pbuffs.sekhmet > 0) m *= 1.2; if (this.pbuffs.scarabDmg > 0) m *= 1.25; return m; },
  hurt(target, raw, src, o = {}) {
    if (!target || !target.alive || this.phase !== 'play') return 0;
    if (src && src.team === target.team) return 0;
    if (src && src.replica) return 0;   // (online: a replica's blow is only a picture; the host's unit deals it)
    let amt = raw * (src && src.dmgMul ? src.dmgMul() : 1);
    if (!o.true) { const prot = o.physical ? target.physProt : target.magProt; amt = amt * 100 / (100 + Math.max(0, prot)); }
    if (target.markT > 0) amt *= 1 + (target.markAmp || 0);
    amt = Math.max(1, Math.round(amt));
    if (src && (src.fixedDmg || (src.bk && src.bk.basic.fixed && (o.basic || raw === 1)))) amt = 1;
    if (raw === 1) amt = 1;   // Ullr's 1 damage stays 1 (no mitigation rounding it up or down)
    if (src && src.isGod) target.dmgBy.set(src, Combat.time);
    target.lastAttacker = src; target.lastAttackT = Combat.time;
    if (src && src.isGod && !src.isPlayer) src.dmgDone = (src.dmgDone || 0) + amt;
    if (target.isPlayer) return this.damagePlayer(amt, src, o);
    if (Net.online && !Net.ownsTarget(target)) return Net.hitOther(target, amt, src, o);   // (another human, or a host unit while I am a client)
    return this.applyHit(target, amt, src);
  },
  // the blow lands on a unit (after mitigation): shields first, then health
  applyHit(target, amt, src) {
    if (target.shield > 0) { const s = Math.min(target.shield, amt); target.shield -= s; amt -= s; if (amt <= 0) { target.flash = 0.5; return 0; } }
    target.hp -= amt; target.lastHit = Combat.time; target.flash = 1;
    if (target.hp <= 0) this.killUnit(target, src);
    return amt;
  },
  damagePlayer(amt, src, o = {}) {
    if (P.dead || this.immortal) return 0;
    if (this.playerShield > 0) { const s = Math.min(this.playerShield, amt); this.playerShield -= s; amt -= s; if (amt <= 0) return 0; }
    P.hp -= amt; this.pstats.taken += amt;
    this.hurtFlash = Math.min(1, (this.hurtFlash || 0) + 0.25 + amt / maxHp() * 2);
    if (!o.silent) Combat.floatNumber(P, P.pos.x, P.y + 2.3, P.pos.z, amt, '#ff5a4f', amt > 120, amt < 25, '-');   // (merged like every other number)
    if (amt > maxHp() * 0.12) Cam.shake = Math.max(Cam.shake, 0.25);
    if (P.hp <= 0) this.playerDie(src);
    return amt;
  },
  killUnit(u, src) {
    if (!u.alive) return;
    u.alive = false; u.hp = 0; u.lastAttacker = src || u.lastAttacker;
    u.onDeath();
  },
  // every unit's death runs through here (Combat.kill calls it too when the player's kit lands the blow)
  onUnitDied(u) {
    const p = u.pos.clone();
    if (u.frozen > 0 && u.ice) GodFX.shatterIce(u);
    u.clearStatus();
    const killer = u.lastAttacker && Combat.time - u.lastAttackT < 12 ? u.lastAttacker : null;
    if (killer === this.pu && Kit && Kit.onDummyDeath) { try { Kit.onDummyDeath(u, p); } catch (e) { /* cosmetic */ } }
    if (u.kind === 'god') {
      if (u.recall) Recall.botCancel(u);
      u.d++; u.spree = 0; u.dying = 1.6; u.buffs = {}; u.motion = null; u.lift = 0;
      u.respawn = (5 + u.level * 0.8) * (u.respawnHalf ? 0.5 : 1); u.respawnHalf = false;
      this.godDied(u, killer);
    } else if (u.kind === 'minion') {
      u.die();
      if (killer && killer.team !== u.team) this.lose(u.team, 1);
      for (const g of this.allies[1 - u.team]) if (g.isGod && g.alive && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 18) this.gainXp(g, 14);
      if (killer === this.pu) this.pstats.minions++;
      if (u.camDist < 25) Sound.arena('minion_death', { pos: p, gain: 0.5 });
    } else if (u.kind === 'siege') {
      u.die();
      for (const g of this.allies[1 - u.team]) if (g.isGod && g.alive && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 22) this.gainXp(g, 120);
      this.pushFeed(killer, null, `felled ${TEAMS[u.team].name}’s Sebek Colossus`);
      ArenaMap.roar(2.5);
    } else if (u.kind === 'camp') {
      u.die();
      const camp = u.camp;
      if (camp.mobs.every((m) => !m.alive)) {
        camp.alive = false; camp.respawnT = 90; camp.decalMat.emissiveIntensity = 0.15;
        const god = killer && killer.isGod ? killer : null;
        if (god) this.grantBuff(god, camp.buff);
        for (const g of this.allies[0].concat(this.allies[1])) if (g.isGod && g.alive && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 16) this.gainXp(g, 45);
      }
    }
  },
  godDied(v, killer) {
    const vTeam = v.team, now = Combat.time;
    if (!killer || killer.team !== vTeam) this.lose(vTeam, 5);
    let kg = killer && killer.isGod ? killer : null;
    if (!kg) { let bt = -1; for (const [g, t] of v.dmgBy) if (g.team !== vTeam && now - t < 10 && t > bt && g.alive !== undefined) { bt = t; kg = g; } }
    const assists = [];
    for (const [g, t] of v.dmgBy) if (g !== kg && g.team !== vTeam && now - t < 10) assists.push(g);
    v.dmgBy.clear();
    const S = (g) => (g === this.pu ? this.pstats : g);
    if (kg) {
      const s = S(kg); s.k++; s.spree = (s.spree || 0) + 1;
      s.multi = now - (s.multiT ?? -99) < 10 ? s.multi + 1 : 1; s.multiT = now;
      this.gainXp(kg, 110 + 12 * (v.level || 3));
      if (!this.firstBlood) { this.firstBlood = true; this.announce('first_blood'); }
      else if (s.multi === 3) this.announce('triple_kill');
      else if (s.multi === 2) this.announce('double_kill');
      else if (s.spree === 3) this.announce('killing_spree');
      if (kg === this.pu) Sound.arena('kill_ping', { gain: 0.8 });
    }
    for (const g of assists) { S(g).a++; this.gainXp(g, 50); }
    this.pushFeed(kg || killer, v);
    ArenaMap.roar(3);
  },
  lose(team, n) {
    if (this.phase !== 'play' || !this.authority) return;   // (online clients: the host's tickets arrive in its snapshots)
    this.tickets[team] = Math.max(0, this.tickets[team] - n);
    this.tkPulse = this.tkPulse || [0, 0]; this.tkPulse[team] = 1;
    if (this.tickets[team] <= 0) this.end(1 - team);
  },
  gainXp(g, amt) {
    if (!g || g.level >= 20 || !this.authority) return;   // (online clients: levels come from the host's bot table)
    g.xp += amt;
    while (g.level < 20 && g.xp >= xpNeed(g.level)) {
      g.xp -= xpNeed(g.level); g.level++;
      if (g === this.pu) this.setPlayerLevel(g.level);
      else { g.applyLevel(); if (g.camDist < 30 && g.alive) FX2.ring(g.pos, 'thothGold', { radius: 1.6, dur: 0.6 }); }
    }
  },
  setPlayerLevel(L, full = false) {
    const oldMax = maxHp(), oldMp = maxMp();
    settings.level = L; settings.power = 30 + 18 * L; settings.cdr = Math.min(0.2, Math.max(0, (L - 3) * 0.012)); settings.ranks = ranksFor(L);
    if (this.pu) this.pu.level = L;
    if (full) { P.hp = maxHp(); P.mp = maxMp(); return; }
    P.hp = Math.min(maxHp(), P.hp + (maxHp() - oldMax)); P.mp = Math.min(maxMp(), P.mp + (maxMp() - oldMp));
    HUD.toast(`Level ${L}`);
    FX2.ring(P.pos, 'thothGold', { radius: 2.2, dur: 0.7 }); FX2.burst(P.pos.clone().setY(1.2), 'thothGold', { size: 0.6, sparks: 18, embers: 10, puffs: 0, bursts: 1, light: true, distort: false });
    Sound.arena('level_up', { gain: 0.8 });
  },

  // ---------------------------------------------------------------- the player's death and rebirth
  playerDie(src) {
    if (P.dead) return;
    P.dead = true; P.hp = 0; P.targeting = null;
    this.pstats.spree = 0;
    try { if (Kit) { Kit.dispose(); Kit.init(); } } catch (e) { console.warn('[arena] kit reset', e); }
    P.speedBuff = 1; P.asBuff = 1; P.flying = false; P.y = 0; P.vy = 0; P.grounded = true;
    this.pstats.d++;
    this.pbuffs = {}; this.playerShield = 0;
    this.respawnT = (5 + this.pu.level * 0.8) * (this.playerAnkh ? 0.5 : 1); this.playerAnkh = false;
    this.deathT = 0;
    Game.thoth.root.rotation.order = 'YXZ';
    FX2.burst(P.pos.clone().setY(1.1), Kit.id === 'ullr' ? 'ullr' : FX2.pal(Kit.id) ? Kit.id : 'thoth', { size: 0.9, sparks: 20, embers: 10, puffs: 3, bursts: 1, light: true });
    Sound.arena('player_death', { gain: 0.9 });
    this.pu.d = this.pstats.d;
    if (this.authority) this.godDied(this.pu, src); else Net.died(src);   // (online clients: the host credits the kill and tells everyone)
    this.ui.dead.hidden = false; glCanvas.style.filter = 'grayscale(0.85) brightness(0.7)';
  },
  respawnPlayer() {
    P.dead = false; P.stunT = P.rootT = P.slowT = 0;
    this.placePlayer();
    P.hp = maxHp(); P.mp = maxMp();
    for (const k of ABILITY_ORDER) P.cd[k] = Math.min(P.cd[k] || 0, 2);
    const th = Game.thoth.root; th.rotation.x = 0; th.rotation.order = 'XYZ'; th.visible = true;
    if (Game.book) Game.book.group.visible = Kit.id === 'thoth';
    Cam.yaw = P.yaw;
    this.ui.dead.hidden = true; glCanvas.style.filter = '';
    FX2.ring(P.pos, Kit.id === 'ullr' ? 'ullr' : 'thothGold', { radius: 3, dur: 0.6 });
    FX2.burst(P.pos.clone().setY(1.2), 'thothGold', { size: 0.8, sparks: 22, embers: 12, puffs: 1, bursts: 1, light: true });
    Sound.arena('respawn', { gain: 0.8 });
    Net.act('rs', Net.cm(P.pos.x), Net.cm(P.pos.z));   // (online: the others see me rise)
  },
  respawnBot(b) {
    b.alive = true; b.hp = b.maxHp; b.dying = 0; b.clearStatus(); b.lastAttacker = null; b.target = null; b.state = 'push'; b.jungleCamp = null; b.shield = 0;
    this.placeAtFountain(b, b.slot);
    b.mesh.visible = true; b.mesh.position.y = 0; b.rig.root.rotation.x = 0; b.lift = 0;
    b.anim.firstFrame = true; b.anim.actions = [];
    if (b.camDist < 40) FX2.burst(b.pos.clone().setY(1.2), b.bk.pal, { size: 0.6, sparks: 14, embers: 6, puffs: 0, bursts: 1, light: false, distort: false });
  },

  // ---------------------------------------------------------------- the update
  update(dt, t) {
    if (!this.active) return;
    ArenaMap.update(dt, t);
    this.refreshLists();
    this.time += dt;
    const playing = this.phase === 'play';
    this.updateStorm(dt);
    // the player's crowd control, buffs and pickups
    this.updatePlayer(dt);
    // who can see whom (papyrus stealth), what is on screen (lighter updates far away)
    this.visT -= dt; if (this.visT <= 0) { this.visT = 0.2; this.updateVisibility(); }
    for (const u of this.units) u.update(dt, t);
    this.shots = this.shots.filter((s) => s.alive && s.update(dt));
    // tidy up the fallen
    if (this.units.some((u) => u.gone && u.kind !== 'god')) {
      for (const u of this.units) if (u.gone && u.kind !== 'god') u.dispose();
      this.units = this.units.filter((u) => !u.gone || u.kind === 'god');
      this.syncTargets();
    }
    if (playing && this.authority) {
      this.updateFountains(dt, t);
      this.updateTimers(dt);
      this.updateScarabs(dt, t);
      this.updateScales(dt, t);
      this.updateAnkhs(dt, t);
      for (const c of ArenaMap.camps) if (!c.alive && (c.respawnT -= dt) <= 0) this.spawnCamp(c);
      this.xpT += dt; if (this.xpT >= 1) { this.xpT -= 1; for (const g of [this.pu, ...this.bots, ...this.humans]) this.gainXp(g, 4); }
    } else if (playing) this.updateMirror(dt, t);
    else if (this.phase === 'ended') {
      this.endT += dt;
      if (this.endT > 2.6 && this.ui.end.hidden) this.showEnd();
    }
    UnitRings.update([...this.units, this.playerRing()]);
    this.updateUI(dt);
  },
  // an online client: the host runs the rules (its snapshots set tickets, timers, the Scales, camps and scarabs);
  // here only my own fountain and the pictures of what the snapshots describe
  updateMirror(dt, t) {
    this.updateFountains(dt, t, true);
    if (this.scales.phase !== 'idle') { this.scales.t += dt; this.posScales(dt, t); }
    this.updateAnkhs(dt, t);
    this.posScarabs(dt, t);
  },
  playerRing() { const r = this._pr || (this._pr = { pos: P.pos, radius: 0.5, team: 0, isGod: true, mesh: { visible: true } }); r.alive = !P.dead; r.team = this.myTeam; return r; },
  updatePlayer(dt) {
    P.stunT = Math.max(0, P.stunT - dt); P.rootT = Math.max(0, P.rootT - dt); P.slowT = Math.max(0, P.slowT - dt);
    for (const k in this.pbuffs) if (this.pbuffs[k] > 0) { this.pbuffs[k] -= dt; if (this.pbuffs[k] <= 0) { delete this.pbuffs[k]; this.dropAura(k); } }
    if (this.playerShieldT > 0) { this.playerShieldT -= dt; if (this.playerShieldT <= 0) { this.playerShield = 0; if (this.shieldFx) { this.shieldFx.dead = true; this.shieldFx = null; } } }
    P.arenaSpeed = (this.pbuffs.horus > 0 ? 1.15 : 1) * (this.pbuffs.scarabSpeed > 0 ? 1.3 : 1) * this.speedK;
    P.arenaAs = this.pbuffs.horus > 0 ? 1.25 : 1;
    if (this.pbuffs.isis > 0 && !P.dead) { for (const k of ABILITY_ORDER) P.cd[k] = Math.max(0, (P.cd[k] || 0) - dt * 0.25); P.mp = Math.min(maxMp(), P.mp + maxMp() * 0.02 * dt); }
    if (!P.dead) return;
    // fallen: the god topples and sinks into the sand; the screen greys while the timer runs
    P.hp = 0; this.deathT += dt; this.respawnT -= dt;
    const th = Game.thoth.root, k = Math.min(1, this.deathT / 0.9);
    th.rotation.x = -easeInCubic(k) * 1.45; th.position.y = -smoothstep(1.4, 3, this.deathT) * 1.2;
    if (this.deathT > 3 && th.visible) { th.visible = false; if (Game.book) Game.book.group.visible = false; }
    this.ui.deadN.textContent = Math.max(0, Math.ceil(this.respawnT));
    if (this.respawnT <= 0 && this.phase === 'play') this.respawnPlayer();
  },
  updateVisibility() {
    const reveal = this.storm.on ? 2.6 : AM.revealR;
    const all = [...this.units, this.pu];
    for (const u of all) u.inReeds = u.alive ? ArenaMap.inReeds(u.pos) : null;
    for (const u of all) {
      if (!u.seen) continue;
      for (let team = 0; team < 2; team++) {
        if (u.team === team || u.team === 2 || !u.inReeds || !u.alive) { u.seen[team] = true; continue; }
        let s = false;
        for (const o of this.allies[team]) if (o.alive && (o.isGod || o.isMinion) && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) < reveal) { s = true; break; }
        u.seen[team] = s;
      }
    }
    // what the camera sees
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(_m1.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const sph = this._sph || (this._sph = new THREE.Sphere());
    for (const u of this.units) {
      sph.center.set(u.pos.x, u.height * 0.5, u.pos.z); sph.radius = u.height * 0.9 + 0.5;
      u.onScreen = this.frustum.intersectsSphere(sph);
      u.camDist = camera.position.distanceTo(sph.center);
      const show = u.onScreen && (u.team === this.myTeam || u.seen[this.myTeam]) && !(u.kind === 'god' && !u.alive && u.dying <= 0) && !u.gone;
      if (u.mesh.visible !== show) u.mesh.visible = show;
      const sh = u.camDist < (u.kind === 'siege' ? 45 : 30);
      if (u.castsShadow !== sh) { u.castsShadow = sh; u.mesh.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = sh; }); }
    }
  },
  // mirror (an online client): my own healing, and the zaps only as a picture (the host deals them)
  updateFountains(dt, t, mirror = false) {
    for (let team = 0; team < 2; team++) {
      const f = ArenaMap.fountains[team].pos;
      for (const u of this.allies[team]) {
        if (!u.alive || !u.isGod || Math.hypot(u.pos.x - f.x, u.pos.z - f.z) > AM.fountR) continue;
        if (u.isRemotePlayer || (mirror && !u.isPlayer)) continue;   // (every human heals itself at its fountain)
        if (u.isPlayer) { if (P.hp < maxHp() || P.mp < maxMp()) { P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.14 * dt); P.mp = Math.min(maxMp(), P.mp + maxMp() * 0.14 * dt); if (Math.random() < dt * 8) this.healMote(P.pos, team); } }
        else if (u.hp < u.maxHp) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.14 * dt); if (u.onScreen && Math.random() < dt * 5) this.healMote(u.pos, team); }
      }
      // the fountain burns enemy gods that come too close
      const src = this.fountainUnits[team];
      for (const u of this.foes[team]) {
        if (!u.alive || !(u.isGod || u.isPlayer) || Math.hypot(u.pos.x - f.x, u.pos.z - f.z) > AM.fountR) continue;
        if (!mirror) this.hurt(u, u.maxHp * 0.3 * dt, src, { true: true, silent: true });
        u.fZap = (u.fZap || 0) - dt;
        if (u.fZap <= 0) {
          u.fZap = 0.5;
          const from = f.clone().setY(3), to = u.pos.clone().setY(1.2), P2 = TEAMS[team];
          const bm = GodFX.beam(from, to, 0.12, P2.col, { core: P2.hot, k: 40 }); VFX.later(0.25, () => { bm.dead = true; });
          Sound.arena('fountain_zap', { pos: to, gain: 0.7 });
        }
      }
    }
  },
  healMote(p, team) {
    FX2.glow.spawn({ pos: V3(p.x + rand(-0.5, 0.5), rand(0.2, 1.2), p.z + rand(-0.5, 0.5)), vel: V3(0, rand(1, 2), 0), life: rand(0.6, 1.0), size: rand(0.06, 0.12), sizeEnd: 0.02, cell: FXA.spark, pal: team === 0 ? 'thoth' : 'molten', temp: 1, tempEnd: 0.5, int: 1.6 });
  },
  updateTimers(dt) {
    const T = this.timers;
    T.wave -= dt; if (T.wave <= 0) { T.wave = 30; this.spawnWave(); }
    T.siege -= dt; if (T.siege <= 0) { T.siege = 180; this.spawnSiege(); }
    if (!this.storm.done && !this.storm.on && this.time > 180 && (this.time >= 450 || Math.min(...this.tickets) <= 100)) this.startStorm();
  },

  // ---------------------------------------------------------------- minions, siege, camps
  spawnWave() {
    this.wave++;
    for (let team = 0; team < 2; team++) {
      const own = this.units.filter((u) => u.isMinion && u.team === team && u.alive).length;
      if (own > 18) continue;
      const s = TEAMS[team].side, x0 = s * (AM.gateX + 5);
      const lanes = [-3, 0, 3, -1.5, 1.5];
      ['melee', 'melee', 'melee', 'ranged', 'ranged'].forEach((type, i) => {
        const m = new Minion(team, type, this.wave, lanes[i] * 1.6);
        m.pos.set(x0 + s * (i >= 3 ? 1.6 : 0), 0, (i % 3 - 1) * 1.4 + (i >= 3 ? 0.7 : 0)); m.facing = s < 0 ? Math.PI / 2 : -Math.PI / 2;
        this.units.push(m);
        m.spawnT = 0; m.mesh.scale.setScalar(0.01);
      });
      const g = ArenaMap.gates[team];
      g.flash = 1;
      if (camera.position.distanceTo(g.pos) < 45) Sound.arena('wave_spawn', { pos: g.pos, gain: 0.6 });
    }
    this.syncTargets();
  },
  minionThroughPortal(m) {
    if (!m.alive) return;
    m.alive = false; m.gone = true;
    this.lose(1 - m.team, 1);
    const g = ArenaMap.gates[1 - m.team]; g.flash = 1;
    const k = arenaFxK(m.pos);
    FX2.burst(m.pos.clone().setY(1), m.team === 0 ? 'thoth' : 'molten', { size: 0.6, sparks: Math.round(14 * k), embers: 6, puffs: 0, bursts: 1, light: k > 0.5, distort: false });
    Sound.arena('portal_hit', { pos: m.pos, gain: 0.8 });
  },
  spawnSiege() {
    let any = false;
    for (let team = 0; team < 2; team++) {
      if (this.siege[team] && this.siege[team].alive) continue;
      this.siegeN = (this.siegeN || 0) + 1;
      const s = new Siege(team, Math.floor(this.siegeN / 2));
      const sd = TEAMS[team].side;
      s.pos.set(sd * (AM.gateX - 3), 0, 0); s.facing = sd < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.units.push(s); this.siege[team] = s; any = true;
      FX2.impact(s.pos, team === 0 ? 'thoth' : 'molten', { size: 1.6, sparks: 30, debris: 14 });
      Sound.arena('siege_spawn', { pos: s.pos, gain: 1 });
    }
    if (any) { this.announce('siege_spawn'); this.syncTargets(); ArenaMap.roar(2); }
  },
  siegeThroughPortal(s) {
    if (!s.alive) return;
    s.alive = false; s.gone = true; if (s.aura) s.aura.dead = true;
    this.lose(1 - s.team, 15);
    const g = ArenaMap.gates[1 - s.team]; g.flash = 2;
    FX2.impact(s.pos, s.team === 0 ? 'thoth' : 'molten', { size: 2.2, sparks: 50, debris: 20 });
    GodFX.column(s.pos, 3, 30, TEAMS[s.team].col, { core: TEAMS[s.team].hot, k: 20 });
    Sound.arena('portal_siege', { pos: s.pos, gain: 1 });
    this.pushFeed(null, null, `${TEAMS[s.team].name}’s Sebek went through the portal · −15`);
    ArenaMap.roar(4);
  },
  spawnCamp(c) {
    c.mobs = [new CampMob(c, true), new CampMob(c, false)];
    const back = _au2.set(c.x, 0, c.z).normalize();
    c.mobs[0].pos.set(c.x, 0, c.z); c.mobs[1].pos.set(c.x - back.z * 2.2, 0, c.z + back.x * 2.2);
    for (const m of c.mobs) { m.home.copy(m.pos); m.facing = Math.atan2(-back.x, -back.z); this.units.push(m); }
    c.alive = true; c.decalMat.emissiveIntensity = 1.3;
    this.syncTargets();
  },
  grantBuff(g, buff) {
    const B = BUFFS[buff];
    if (g === this.pu) {
      this.pbuffs[buff] = 90;
      HUD.toast(`${B.name}: ${B.short} for 90 s`);
      this.dropAura(buff);
      this.auras = this.auras || {};
      this.auras[buff] = FX2.aura(P.pos, B.pal, { radius: 0.9, height: 2, rate: 9, dur: 90 });
    } else if (g.isRemotePlayer) Net.gift(g, 'buff', buff);   // (another human's buff: its own page applies it)
    else { g.buffs[buff] = 90; if (g.onScreen) FX2.aura(g.pos, B.pal, { radius: 0.9, height: 2, rate: 4, dur: 90 }); }
    FX2.ring(g.pos, B.pal, { radius: 2.4, dur: 0.6 });
    Sound.arena('buff_pickup', { pos: g.pos, gain: 0.8 });
  },
  dropAura(k) { if (this.auras && this.auras[k]) { this.auras[k].dead = true; delete this.auras[k]; } },

  // ---------------------------------------------------------------- Scarab Gifts
  updateScarabs(dt, t) {
    this.timers.scarab -= dt;
    if (this.timers.scarab <= 0 && this.scarabs.filter((s) => s.alive).length < 2) { this.timers.scarab = rand(60, 90); this.spawnScarab(); }
    for (const s of this.scarabs) {
      if (!s.alive) continue;
      s.t += dt; s.turn -= dt;
      if (s.turn <= 0) { s.turn = rand(0.4, 1.2); s.head += rand(-1.6, 1.6); }
      const home = _au1.copy(s.home).sub(s.pos); if (home.length() > 3) s.head = Math.atan2(home.x, home.z);
      const sp = 1.8 + Math.sin(t * 9) * 0.6;
      s.pos.x += Math.sin(s.head) * sp * dt; s.pos.z += Math.cos(s.head) * sp * dt; resolveCircle(s.pos, 0.3);
      s.mesh.position.set(s.pos.x, 0.12 + Math.abs(Math.sin(t * 18)) * 0.03, s.pos.z); s.mesh.rotation.y = s.head;
      for (const [i, l] of s.legs.entries()) l.rotation.y = Math.sin(t * 22 + i * 1.7) * 0.5;
      if (s.t > 50) { s.alive = false; this.removeScarab(s, false); continue; }
      for (const g of [this.pu, ...this.bots, ...this.humans]) {
        if (!g.alive || Math.hypot(g.pos.x - s.pos.x, g.pos.z - s.pos.z) > 1.5) continue;
        s.alive = false; this.removeScarab(s, true); this.scarabGift(g); break;
      }
    }
    this.scarabs = this.scarabs.filter((s) => s.alive);
  },
  // an online client: the scarabs the host's snapshot lists ([id, x, z, heading], Net.mirrorScarabs), walking in place
  posScarabs(dt, t) {
    for (const s of this.scarabs) {
      if (s.goal) { const k = Math.min(1, dt * 8); s.pos.x += (s.goal.x - s.pos.x) * k; s.pos.z += (s.goal.z - s.pos.z) * k; }
      s.mesh.position.set(s.pos.x, 0.12 + Math.abs(Math.sin(t * 18)) * 0.03, s.pos.z); s.mesh.rotation.y = s.head;
      for (const [i, l] of s.legs.entries()) l.rotation.y = Math.sin(t * 22 + i * 1.7) * 0.5;
    }
  },
  scarabMesh() {
    if (!this.scarabGeo) {
      const body = new THREE.SphereGeometry(1, 16, 10); body.scale(0.32, 0.17, 0.42); body.translate(0, 0.16, -0.04);
      const head = new THREE.SphereGeometry(1, 12, 8); head.scale(0.16, 0.1, 0.14); head.translate(0, 0.12, 0.36);
      const line = new THREE.BoxGeometry(0.02, 0.02, 0.62); line.translate(0, 0.33, -0.05);
      this.scarabGeo = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), line.toNonIndexed()]);
      this.scarabLeg = new THREE.BoxGeometry(0.5, 0.025, 0.03);
      this.scarabMat = new THREE.MeshStandardMaterial({ color: 0xf2c25e, metalness: 1, roughness: 0.18, emissive: 0x8a4a08, emissiveIntensity: 0.9 });
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.scarabGeo, this.scarabMat));
    const legs = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(this.scarabLeg, this.scarabMat); l.position.set(0, 0.06, -0.15 + i * 0.16); g.add(l); legs.push(l); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1, 0.62, 0.15), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7, fog: false }));
    glow.scale.setScalar(1.8); glow.position.y = 0.25; g.add(glow);
    g.scale.setScalar(1.25);
    return { g, legs };
  },
  spawnScarab(at = null) {
    const spots = ArenaMap.scarabSpots.filter((p) => !this.scarabs.some((s) => s.home.distanceTo(p) < 6));
    const home = at ? at.clone() : pick(spots.length ? spots : ArenaMap.scarabSpots).clone();
    const { g, legs } = this.scarabMesh(); scene.add(g);
    const s = { alive: true, t: 0, home, pos: home.clone(), head: rand(0, TAU), turn: 0, mesh: g, legs, id: this.scarabN = (this.scarabN || 0) + 1 };
    this.scarabs.push(s);
    FX2.burst(home.clone().setY(0.4), 'thothGold', { size: 0.5, sparks: 12, embers: 8, puffs: 1, bursts: 1, light: true, distort: false });
    Sound.arena('scarab_spawn', { pos: home, gain: 0.6 });
  },
  removeScarab(s, taken) {
    scene.remove(s.mesh); s.mesh.traverse((o) => { if (o.isSprite) o.material.dispose(); });
    if (taken) { FX2.burst(s.pos.clone().setY(0.6), 'thothGold', { size: 0.8, sparks: 26, embers: 14, puffs: 1, bursts: 1, light: true }); FX2.ring(s.pos, 'thothGold', { radius: 2.4, dur: 0.6 }); }
  },
  scarabGift(g, giftId = null) {
    const gift = SCARAB_GIFTS.find((x) => x.id === giftId) || pick(SCARAB_GIFTS), you = g === this.pu;
    Sound.arena('scarab_pickup', { pos: g.pos, gain: 1 });
    if (g.isRemotePlayer) Net.gift(g, 'scarab', gift.id);   // (another human's gift: its own page applies it)
    else if (gift.id === 'heal') { if (you) P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.35); else g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.35); }
    else if (gift.id === 'shield') {
      if (you) { this.playerShield = maxHp() * 0.25; this.playerShieldT = 8; if (this.shieldFx) this.shieldFx.dead = true; this.shieldFx = GodFX.bubble(P.pos, 1.3, new THREE.Color(1, 0.7, 0.2), {}); }
      else { g.shield = g.maxHp * 0.25; g.shieldT = 8; }
    } else if (gift.id === 'speed') { if (you) this.pbuffs.scarabSpeed = 8; else g.buffs.scarabSpeed = 8; }
    else if (gift.id === 'dmg') { if (you) this.pbuffs.scarabDmg = 10; else g.buffs.scarabDmg = 10; }
    for (let i = 0; i < 3; i++) VFX.later(i * 0.12, () => FX2.ring(g.pos, 'thothGold', { radius: 1.2 + i * 0.6, dur: 0.5 }));
    if (you) HUD.toast(`Scarab Gift · ${gift.name}: ${gift.text}`);
    else if (g.onScreen) this.floatText(g, gift.name, '#ffd27a');
  },

  // ---------------------------------------------------------------- the Scales of Ma'at
  // the Scales of Ma'at (maat_scales; a procedural golden balance stands in without it). Built once, kept in Arena.sv
  buildScales() {
    if (this.sv) { this.sv.obj.visible = false; this.sv.col.visible = false; this.sv.zone.material.opacity = 0; return; }
    const g = new THREE.Group(); g.visible = false; ArenaMap.group.add(g);
    const beamG = new THREE.Group(); g.add(beamG);
    const gold = ArenaMap.mats.gold;
    const pans = [];
    let tiltK = 1;
    if (Assets.glb.maat_scales) {
      propInstance('maat_scales', 11, 0, 0, 0, { env: 1.3, parent: beamG });   // (static: the whole balance sways a little toward the leader)
      tiltK = 0.18;
    } else {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 9, 24), gold); pil.position.y = 4.5; g.add(pil);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.8, 32), ArenaMap.mats.stoneDark); base.position.y = 0.4; g.add(base);
      beamG.position.y = 9;   // the beam pivots on top of the pillar
      const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 0.32, 0.32), gold); beamG.add(arm);
      for (const sx of [-1, 1]) {
        const hang = new THREE.Group(); hang.position.set(sx * 4.8, 0, 0); beamG.add(hang);
        for (const a of [0, 2.1, 4.2]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.2, 4), gold); ch.position.set(Math.cos(a) * 0.6, -2.1, Math.sin(a) * 0.6); ch.rotation.z = Math.cos(a) * 0.14; ch.rotation.x = -Math.sin(a) * 0.14; hang.add(ch); }
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.9, 0.3, 32), gold); pan.position.y = -4.3; hang.add(pan);
        if (sx < 0) { const f = new THREE.Mesh(extrude(featherShape(0.5, 2.2), 0.04, 0.01), new THREE.MeshStandardMaterial({ color: 0xf6efe0, emissive: 0x6a5a30, emissiveIntensity: 0.4, roughness: 0.6 })); f.position.set(0, -4.1, 0); hang.add(f); }
        else { const h = new THREE.Mesh(makeHeartGeometry(), new THREE.MeshStandardMaterial({ color: 0x9a1a1a, emissive: 0x400606, roughness: 0.4 })); h.scale.setScalar(0.9); h.position.set(0, -4.0, 0); hang.add(h); }
        pans.push(hang);
      }
    }
    const zone = new THREE.Mesh(new THREE.RingGeometry(AM.scalesR - 0.35, AM.scalesR, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.2).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.y = 0.05; ArenaMap.group.add(zone);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 30, 32, 1, true), beamMaterial(new THREE.Color(1.0, 0.62, 0.15), { core: GCOL.sunHot, gain: 0.9, scroll: 1 }));
    col.position.y = 15; col.renderOrder = 8; col.frustumCulled = false; col.visible = false; ArenaMap.group.add(col);
    this.sv = { obj: g, beamG, pans, zone, col, tiltK, coll: { x: 0, z: 0, r: 1.5, shots: false } };
  },
  updateScales(dt, t) {
    const S = this.scales, V = this.sv;
    if (S.phase === 'idle') {
      this.timers.scales -= dt;
      if (this.timers.scales <= 0) {
        S.phase = 'rising'; S.t = 0; S.hold = [0, 0]; S.active = true; V.obj.visible = true; V.col.visible = true;
        ArenaMap.circles.push(V.coll);
        this.announce('scales_rise');
        Sound.arena('scales_rise', { pos: V3(0, 2, 0), gain: 1 });
        FX2.impact(V3(0, 0, 0), 'thothGold', { size: 1.6, sparks: 30, debris: 16 });
      }
      return;
    }
    S.t += dt;
    if (S.phase === 'rising') { if (S.t >= 3) { S.phase = 'judging'; S.t = 0; } }
    else if (S.phase === 'judging') {
      const inZone = [0, 0];
      for (let team = 0; team < 2; team++) for (const u of this.allies[team]) if (u.alive && u.isGod && Math.hypot(u.pos.x, u.pos.z) < AM.scalesR) inZone[team]++;
      if (inZone[0] && !inZone[1]) S.hold[0] += dt; else if (inZone[1] && !inZone[0]) S.hold[1] += dt;
      S.contest = inZone;
      if (Math.floor(S.t) !== Math.floor(S.t - dt)) Sound.arena('scales_tick', { pos: V3(0, 3, 0), gain: 0.5 });
      if (S.t >= 20) this.judge();
    } else if (S.phase === 'sinking') {
      if (S.t >= 3) { S.phase = 'idle'; S.active = false; V.obj.visible = false; V.col.visible = false; this.timers.scales = 150; const i = ArenaMap.circles.indexOf(V.coll); if (i >= 0) ArenaMap.circles.splice(i, 1); }
    }
    this.posScales(dt, t);
  },
  // the balance's look from its phase and time (online clients get both from the host's snapshot)
  posScales(dt, t) {
    const S = this.scales, V = this.sv, k = Math.min(1, S.t / 3);
    V.obj.position.y = S.phase === 'rising' ? -12 * (1 - easeOutCubic(k)) : S.phase === 'sinking' || S.phase === 'idle' ? -12 * easeInCubic(k) : 0;
    // the beam dips toward the team holding the circle (team 0 holds the feather side, -x)
    const lean = clamp((S.hold[0] - S.hold[1]) * 0.035, -0.22, 0.22) * V.tiltK;
    V.beamG.rotation.z = damp(V.beamG.rotation.z, lean + Math.sin(t * 0.9) * 0.02 * V.tiltK, 2, dt);
    for (const p of V.pans) p.rotation.z = -V.beamG.rotation.z;
    V.zone.material.opacity = S.phase === 'judging' ? 0.55 + 0.25 * Math.sin(t * 3) : S.phase === 'rising' ? Math.min(1, S.t / 3) * 0.6 : Math.max(0, 0.6 - S.t / 3);
    V.col.material.uniforms.uTime.value = t; V.col.material.uniforms.uAlpha.value = S.phase === 'judging' ? 0.3 : 0.15;
  },
  judge() {
    const S = this.scales; S.phase = 'sinking'; S.t = 0;
    const [h0, h1] = S.hold;
    if (Math.abs(h0 - h1) < 0.5) { this.announce(null, 'The scales are balanced · no judgement'); return; }
    const win = h0 > h1 ? 0 : 1;
    this.lose(1 - win, 10);
    this.announce('scales_won', `${ARENA_TXT.scales_won} ${TEAMS[win].name} wins · ${TEAMS[1 - win].name} −10`);
    ArenaMap.roar(4);
    this.judgeFx();
  },
  judgeFx() {
    Sound.arena('scales_won', { gain: 1 });
    // a feather of Ma'at rains down: golden feathers drifting over the arena
    for (let i = 0; i < 140; i++) VFX.later(rand(0, 2.5), () => VFX.add.spawn({ pos: V3(rand(-16, 16), rand(9, 15), rand(-10, 10)), vel: V3(rand(-0.6, 0.6), -rand(1.2, 2.2), rand(-0.6, 0.6)), life: rand(3, 5), size: rand(0.35, 0.6), sizeEnd: 0.3, color: new THREE.Color(1.0, 0.8, 0.35), intensity: 1.8, cell: FX.feather, rot: rand(0, TAU), rotVel: rand(-1.5, 1.5), drag: 0.2 }));
    FX2.burst(V3(0, 9, 0), 'thothGold', { size: 2, sparks: 40, embers: 30, puffs: 2, bursts: 2, light: true });
  },

  // ---------------------------------------------------------------- Set's Sandstorm
  startStorm() {
    const St = this.storm; St.on = true; St.t = 0;
    this.announce('sandstorm', `${ARENA_TXT.sandstorm} Visibility drops · everyone moves 10% slower · papyrus conceals better`);
    Sound.wind(true);
  },
  updateStorm(dt) {
    const St = this.storm;
    if (St.on) { St.t += dt; if (St.t > 25 && this.authority) { St.on = false; St.done = true; Sound.wind(false); this.announce(null, 'The sandstorm subsides'); } }
    St.k = damp(St.k, St.on ? 1 : 0, St.on ? 0.6 : 0.8, dt);
    this.speedK = St.on ? 0.9 : 1;
    const k = St.k;
    if (k < 0.002 && !St.on) return;
    // the fog thickens and turns red-brown; sand streams across the arena (a few particles near the camera)
    WORLD.fogBase.copy(ArenaMap.fog.color).lerp(this._stormCol || (this._stormCol = new THREE.Color(0.34, 0.15, 0.06)), k * 0.85);
    scene.fog.density = lerp(ArenaMap.fog.density, 0.0115, k);
    if (ArenaMap.moteU) ArenaMap.moteU.uWind.value = k;
    if (ArenaMap.reedU) ArenaMap.reedU.uWind.value = 1 + k * 1.8;
    if (St.on && FX2.ready) {
      const c = camera.position, n = Math.round(dt * 40 * k + Math.random() * 0.6);
      for (let i = 0; i < n; i++) {
        const p = V3(c.x + rand(-18, 18), rand(0.2, 5), c.z + rand(-18, 18));
        FX2.smoke.spawn({ pos: p, vel: V3(rand(6, 10), rand(-0.2, 0.4), rand(-1.5, 1.5)), life: rand(1.2, 2), size: rand(1.4, 2.4), sizeEnd: 3.6, frames: 16, pal: 'sand', temp: 0.15, tempEnd: 0, int: 1, alpha: 0.35, drag: 0.3, turb: 0.5, fadeIn: 0.25, fadeOut: 0.5 });
        if (Math.random() < 0.6) FX2.glow.spawn({ pos: p.clone().setY(rand(0.2, 3)), vel: V3(rand(12, 18), rand(-0.5, 0.5), rand(-2, 2)), life: rand(0.5, 0.9), size: rand(0.04, 0.08), sizeEnd: 0.02, cell: FXA.spark, stretch: 3, pal: 'sand', temp: 0.9, tempEnd: 0.5, int: 1.1 });
      }
    }
  },

  // ---------------------------------------------------------------- the Ankh of Rebirth (comeback)
  updateAnkhs(dt, t) {
    for (let team = 0; team < 2; team++) {
      const A = this.ankh[team];
      if (!A.spawned && !A.taken && this.tickets[team] < 50) {
        A.spawned = true;
        const f = ArenaMap.fountains[team].pos, dir = -TEAMS[team].side;
        const mesh = new THREE.Group(); mesh.position.set(f.x + dir * 3.5, 1.4, f.z + 3.5);
        const a = new THREE.Mesh(extrude(ankhShape(1.3), 0.18, 0.03), new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 1, roughness: 0.15, emissive: TEAMS[team].hot, emissiveIntensity: 1.2 }));
        a.position.y = -0.2; mesh.add(a);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1, 0.75, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
        gl.scale.setScalar(3.2); mesh.add(gl);
        scene.add(mesh); A.mesh = mesh;
        if (team === this.myTeam) this.announce('ankh', `${ARENA_TXT.ankh} Grab it at the fountain: your next respawn is twice as fast`, true);
        else this.announce(null, 'The enemy’s ankh has appeared at their fountain', true);
        Sound.arena('ankh_spawn', { pos: mesh.position, gain: 0.9 });
        FX2.burst(mesh.position.clone(), 'thothGold', { size: 1, sparks: 24, embers: 16, puffs: 1, bursts: 1, light: true });
      }
      if (A.mesh) {
        A.mesh.rotation.y += dt * 1.2; A.mesh.position.y = 1.4 + Math.sin(t * 2) * 0.15;
        if (this.authority && !A.taken) for (const g of this.allies[team]) {   // (online clients: the host's snapshot says when it is taken)
          if (!g.alive || !g.isGod || Math.hypot(g.pos.x - A.mesh.position.x, g.pos.z - A.mesh.position.z) > 1.6) continue;
          if (g === this.pu) { this.playerAnkh = true; HUD.toast('Ankh of Rebirth: your next respawn is twice as fast'); }
          else if (g.isRemotePlayer) Net.gift(g, 'ankh');
          else g.respawnHalf = true;
          this.takeAnkh(team, g);
          break;
        }
      }
    }
  },
  takeAnkh(team, g) {
    const A = this.ankh[team]; A.taken = true;
    if (!A.mesh) return;
    FX2.burst(A.mesh.position.clone(), 'thothGold', { size: 1, sparks: 30, embers: 16, puffs: 1, bursts: 1, light: true }); if (g) FX2.ring(g.pos, 'thothGold', { radius: 2.6, dur: 0.6 });
    Sound.arena('ankh_pickup', { pos: g ? g.pos : A.mesh.position, gain: 1 });
    scene.remove(A.mesh); A.mesh = null;
  },

  // ---------------------------------------------------------------- the end
  end(winner) {
    if (this.phase !== 'play') return;
    this.phase = 'ended'; this.endT = 0; this.winner = winner;
    const won = winner === this.myTeam;
    this.announce(won ? 'victory' : 'defeat', null, true);
    Sound.arena(won ? 'victory' : 'defeat', { gain: 1 });
    Sound.duckMusic(0.4, 3, 2);
    ArenaMap.roar(6);
    Sound.wind(false);
  },
  showEnd() {
    const won = this.winner === this.myTeam, w = this.winner, s = this.pstats, E = this.ui.end;
    Game.mode = 'arenaEnd'; input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.dead.hidden = true; glCanvas.style.filter = won ? '' : 'grayscale(0.5) brightness(0.8)';
    const mm = Math.floor(this.time / 60), ss = Math.floor(this.time % 60);
    E.querySelector('h2').textContent = won ? 'VICTORY' : 'DEFEAT';
    E.classList.toggle('won', won);
    E.querySelector('.sub').textContent = won ? `${TEAMS[w].name} won Ma’at’s judgement · ${this.tickets[0]} – ${this.tickets[1]}` : `${TEAMS[w].name} won · ${this.tickets[0]} – ${this.tickets[1]}`;
    E.querySelector('.stats').innerHTML = [['Duration', `${mm}:${String(ss).padStart(2, '0')}`], ['Kills / deaths / assists', `${s.k} / ${s.d} / ${s.a}`], ['Damage', Math.round(s.dmg).toLocaleString('en-US')],
      ['Damage to gods', Math.round(s.godDmg).toLocaleString('en-US')], ['Minions killed', s.minions], ['Level', this.pu.level]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    E.hidden = false;
    this.renderBoard(E.querySelector('.board'));
    Net.endNote();   // (online: what happens next - the host's new match, or the lobby; offline: no note)
  },

  // ---------------------------------------------------------------- leaving and restarting
  teardown() {
    Recall.reset();
    for (const u of this.units) u.dispose();
    this.units = []; this.bots = []; this.humans = []; this.siege = [null, null]; Combat.dummies = []; this.waiting = false;
    for (const s of this.shots) if (s.alive) s.die(false);
    this.shots = [];
    for (const s of this.scarabs) this.removeScarab(s, false);
    this.scarabs = [];
    for (const A of this.ankh || []) if (A.mesh) scene.remove(A.mesh);
    if (this.sv) { this.sv.obj.visible = false; this.sv.col.visible = false; this.sv.zone.material.opacity = 0; const i = ArenaMap.circles.indexOf(this.sv.coll); if (i >= 0) ArenaMap.circles.splice(i, 1); }
    if (this.scales) { this.scales.phase = 'idle'; this.scales.active = false; }
    if (this.auras) { for (const k in this.auras) this.auras[k].dead = true; this.auras = {}; }
    if (this.shieldFx) { this.shieldFx.dead = true; this.shieldFx = null; }
    Sound.wind(false);
    this.storm = { on: false, done: false, t: 0, k: 0 };
    if (ArenaMap.moteU) ArenaMap.moteU.uWind.value = 0;
    if (ArenaMap.reedU) ArenaMap.reedU.uWind.value = 1;
    WORLD.fogBase.copy(ArenaMap.fog.color); scene.fog.density = ArenaMap.fog.density;
    this.clearFx();
    UnitRings.update([]);
    P.dead = false; P.stunT = P.rootT = P.slowT = 0; P.arenaSpeed = 1; P.arenaAs = 1;
    glCanvas.style.filter = '';
    if (Game.thoth) { Game.thoth.root.rotation.x = 0; Game.thoth.root.rotation.order = 'XYZ'; Game.thoth.root.visible = true; }
  },
  clearFx() {
    Recall.reset();   // (recall circles are hold-decals: they must be cancelled before the timers are dropped)
    VFX.timed.length = 0; GodFX.clear(); FX2.clear();
    for (const p of Combat.projectiles) if (p.alive) p.die(p.pos, false);
    Combat.projectiles = []; Combat.texts = [];
  },
  async restart(reroll = false) {
    if (Net.online && Net.match) return Net.restart(reroll);   // (online: only the host starts a new match, for everyone)
    if (this.loading) return;
    this.loading = true;
    try {
      this.teardown();
      this.ui.end.hidden = true; UI.menu.hidden = true;
      if (reroll) { this.rollRoster(); this.ui.ann.textContent = 'Loading the gods …'; await this.loadAssets(() => {}); }
      this.phase = 'setup';
      await this.setupMatch();
      this.begin();
    } catch (e) { console.error('[arena] restart', e); this.exit(); }
    finally { this.loading = false; }
  },
  exit(silent = false) {
    this.teardown();
    this.active = false; this.phase = 'off';
    ArenaMap.leave();
    // the playroom comes back as it was
    Combat.dummies = this.savedDummies || Combat.dummies;
    for (const d of Combat.dummies) { if (!d.alive) { d.dying = 0; d.respawn = 0; d.update(0.016, Combat.time); } d.mesh.visible = true; d.hp = d.maxHp; }
    if (settingsOverride) { Object.assign(settings, settingsOverride); settingsOverride = null; saveSettings(); }
    document.getElementById('app').classList.remove('arena-mode');
    this.ui.root.hidden = true; this.ui.end.hidden = true;
    if (Kit) { Kit.dispose(); }
    P.pos.set(0, 0, -18); P.vel.set(0, 0, 0); P.yaw = 0; P.y = 0; P.vy = 0;
    Cam.yaw = 0; Cam.pitch = CAM_PITCH; Cam.shake = 0; Cam.focus = null; Cam.shot = null; Cam.frameTarget = 0;
    selectGod(Kit ? Kit.id : settings.god, { force: true, voice: false });
    if (silent) return;
    Game.mode = 'menu'; input.enabled = false; input.down.clear(); input.lmb = input.rmb = false;
    if (document.pointerLockElement) document.exitPointerLock();
    UI.menu.hidden = true; UI.hud.hidden = true; UI.start.hidden = false;
    this.updateModeUI();
    Net.backToLobby();   // (online: the room's lobby, not the start screen)
  },

  // ---------------------------------------------------------------- test hooks (window.__thoth.Arena.dev)
  dev: {
    info() {
      const A = Arena, kinds = {};
      for (const u of A.units) if (u.alive) kinds[u.kind] = (kinds[u.kind] || 0) + 1;
      return { phase: A.phase, time: Math.round(A.time), tickets: A.tickets.slice(), level: A.pu && A.pu.level, playerHp: Math.round(P.hp), dead: P.dead, alive: kinds,
        bots: A.bots.map((b) => `${b.team}:${b.god} L${b.level} ${b.alive ? b.state : 'dead'} ${Math.round(b.hp)}/${b.maxHp} ${b.k}/${b.d}/${b.a}`),
        fx: FX2.ready ? { glow: FX2.glow.list.length, smoke: FX2.smoke.list.length, items: FX2.items.length } : null, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    },
    // (the world's helpers only work where the rules run: single player, or the host of an online match)
    scales() { const A = Arena; if (A.authority && A.scales.phase === 'idle') A.timers.scales = 0; },
    storm() { const A = Arena; if (A.authority && !A.storm.on) { A.storm.done = false; A.startStorm(); } },
    siege() { if (Arena.authority) Arena.spawnSiege(); },
    scarab(near = true) { if (!Arena.authority) return; Arena.spawnScarab(); if (near) { const s = Arena.scarabs[Arena.scarabs.length - 1]; s.home.set(P.pos.x + 3, 0, P.pos.z); s.pos.copy(s.home); } },
    wave() { if (Arena.authority) Arena.spawnWave(); },
    tickets(a = 60, b = 60) { if (Arena.authority) Arena.tickets = [a, b]; },
    level(L = 10) { Arena.pu.xp = 0; Arena.pu.level = L; Arena.setPlayerLevel(L); if (Arena.authority) for (const b of Arena.bots) { b.level = L; b.applyLevel(); } },
    immortal(on = true) { Arena.immortal = on; },
    kill() { Arena.playerDie(null); },
    teleport(x = 0, z = 0) { P.pos.set(x, 0, z); },
    end(win = true) { if (Arena.authority) Arena.end(win ? Arena.myTeam : 1 - Arena.myTeam); },
  },

  // ---------------------------------------------------------------- hooks into the playroom
  installHooks() {
    if (this.hooked) return;
    this.hooked = true;
    ArenaUnit.prototype.onDeath = function () { Arena.onUnitDied(this); };
    // the player's kits deal damage through Combat.deal: credit kills and assists, apply the arena's buffs
    const deal0 = Combat.deal;
    Combat.deal = function (target, raw, kind, src, trueDamage = false, physical = null) {
      if (Net.ctx) return 0;
      if (Arena.active && target && target.arena) {
        if (Arena.phase !== 'play' || !target.alive || P.dead) return 0;
        if (Net.online && target.team === Arena.myTeam) return 0;   // (online: never a team-mate)
        raw *= Arena.playerDmgMul();
        target.lastAttacker = Arena.pu; target.lastAttackT = Combat.time; target.dmgBy.set(Arena.pu, Combat.time);
        if (target.shield > 0 && !trueDamage && (!Net.online || Net.ownsTarget(target))) { const s = Math.min(target.shield, raw * 0.8); target.shield -= s; raw -= s; if (raw <= 0.5) return 0; }   // (online the target's owner applies its shield)
        const a = deal0.call(this, target, raw, kind, src, trueDamage, physical);
        Arena.pstats.dmg += a; if (target.isGod) Arena.pstats.godDmg += a;
        return a;
      }
      return deal0.call(this, target, raw, kind, src, trueDamage, physical);
    };
  },
  ccNote(label, t) { this.cc = { label, t: Math.max(t, (this.cc && this.cc.label === label) ? this.cc.t : 0) }; },
  floatText(u, text, color) { Combat.texts.push({ x: u.pos.x, y: (u.height || 2) + 0.6, z: u.pos.z, text, color, t: 0, big: false }); },

  // ---------------------------------------------------------------- announcer + kill feed
  // local: online, a line only for this page; the host passes the others on to every page (14n_net.js), and an
  // online client shows only those (its own copies of the rules stay quiet)
  announce(key, text, local = false) {
    if (!local && Net.online && Net.match) { if (!Net.isHost) return; Net.emit('an', key || '', text || ''); }
    const said = key ? (typeof Sound.announce === 'function' ? Sound.announce(key) : false) : false;
    void said;
    const msg = text || ARENA_TXT[key] || '';
    if (!msg || !this.ui) return;
    const el = this.ui.ann; el.textContent = msg; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    this.annT = 3.2;
  },
  pushFeed(killer, victim, text, local = false) {
    if (!local && Net.online && Net.match) { if (!Net.isHost) return; Net.emit('fd', Net.idOf(killer), Net.idOf(victim), text || ''); }   // (as the announcer)
    const name = (u) => netEsc(u === this.pu ? `You (${Kit.name})` : u ? (u.isGod ? u.name : u.name || '–') : '');   // (online: players' nicknames)
    const col = (u) => (u ? (u.team === 0 ? TEAMS[0].css : u.team === 1 ? TEAMS[1].css : TEAMS[2].css) : '#ccc');
    const el = document.createElement('div'); el.className = 'kf';
    if (victim) el.innerHTML = `${killer ? `<b style="color:${col(killer)}">${name(killer)}</b>` : '<b>The Arena</b>'}<i>𓂀</i><b style="color:${col(victim)}">${name(victim)}</b>`;
    else el.innerHTML = `${killer ? `<b style="color:${col(killer)}">${name(killer)}</b> ` : ''}<span>${netEsc(text)}</span>`;
    if (victim === this.pu || killer === this.pu) el.classList.add('me');
    this.ui.feed.prepend(el);
    while (this.ui.feed.children.length > 6) this.ui.feed.lastChild.remove();
    setTimeout(() => el.classList.add('old'), 7000);
    setTimeout(() => el.remove(), 9000);
  },

  // ---------------------------------------------------------------- UI
  initUI() {
    if (this.ui) return;
    const css = document.createElement('style');
    css.textContent = `
#arena { position: absolute; inset: 0; pointer-events: none; z-index: 8; }
#arena .top { position: absolute; left: 50%; top: calc(10px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); display: flex; align-items: center; gap: 14px; }
#arena .tk { display: grid; gap: 3px; min-width: 150px; text-align: center; }
#arena .tk b { font: 900 34px/1 var(--font-display); letter-spacing: .04em; text-shadow: 0 2px 8px #000, 0 0 18px currentColor; font-variant-numeric: tabular-nums; transition: transform .15s; }
#arena .tk.pulse b { transform: scale(1.18); }
#arena .tk .bar2 { height: 7px; background: rgba(6,8,18,.85); border: 1px solid rgba(0,0,0,.8); outline: 1px solid var(--edge-soft); overflow: hidden; }
#arena .tk .bar2 i { display: block; height: 100%; transform-origin: left; }
#arena .tk.t0 { color: #6fbaff; } #arena .tk.t0 .bar2 i { background: linear-gradient(90deg, #1a3fa8, #4aa8ff 70%, #f2c25e); }
#arena .tk.t1 { color: #ff6a5a; } #arena .tk.t1 .bar2 i { background: linear-gradient(270deg, #8a0e0a, #ff4b3e 70%, #ffb08a); transform-origin: right; }
#arena .tk span { font: 700 11px var(--font-display); letter-spacing: .2em; color: var(--muted); text-transform: uppercase; }
#arena .clock { display: grid; justify-items: center; gap: 2px; padding: 6px 14px; background: var(--panel); border: 1px solid var(--edge); min-width: 74px; }
#arena .clock b { font: 800 20px var(--font-ui); color: var(--parchment); font-variant-numeric: tabular-nums; }
#arena .clock small { font: 600 11px var(--font-ui); color: var(--gold); letter-spacing: .08em; white-space: nowrap; }
#arena .scales { position: absolute; left: 50%; top: calc(74px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); width: min(340px, 70vw); display: grid; gap: 3px; text-align: center; font: 700 12px var(--font-display); letter-spacing: .14em; color: var(--gold); text-shadow: 0 1px 3px #000; }
#arena .scales .sb { position: relative; height: 8px; background: rgba(6,8,18,.85); border: 1px solid var(--edge); }
#arena .scales .sb i { position: absolute; top: 0; bottom: 0; }
#arena .scales .sb i.a { left: 50%; right: 50%; background: #4aa8ff; } #arena .scales .sb i.b { left: 50%; right: 50%; background: #ff4b3e; }
#arena .feed { position: absolute; right: 16px; top: calc(14px + env(safe-area-inset-top, 0px)); display: grid; gap: 4px; justify-items: end; max-width: min(380px, 60vw); }
#arena .kf { background: var(--panel); border: 1px solid var(--edge-soft); padding: 4px 10px; font: 700 13px var(--font-ui); color: var(--parchment); display: flex; gap: 8px; align-items: center; transition: opacity .6s; white-space: nowrap; }
#arena .kf i { font: normal 14px var(--font-glyph); color: var(--gold); font-style: normal; }
#arena .kf span { color: var(--muted); font-weight: 600; }
#arena .kf.me { border-color: var(--gold); } #arena .kf.old { opacity: .35; }
#arena .ann { position: absolute; left: 50%; top: 24%; transform: translateX(-50%) scale(.9); font: 900 clamp(24px, 3.6vw, 44px)/1.1 var(--font-display); letter-spacing: .1em; text-align: center; color: #ffe2a0; text-shadow: 0 0 20px rgba(255,170,60,.7), 0 3px 6px #000; opacity: 0; transition: opacity .3s, transform .3s; text-wrap: balance; max-width: 80vw; }
#arena .ann.on { opacity: 1; transform: translateX(-50%) scale(1); }
#arena canvas.mm { position: absolute; left: 16px; top: calc(14px + env(safe-area-inset-top, 0px)); width: 260px; height: 140px; background: rgba(6,9,20,.78); border: 1px solid var(--edge); box-shadow: 0 6px 18px rgba(0,0,0,.5); }
#arena .dead { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); text-align: center; display: grid; gap: 4px; }
#arena .dead .t { font: 800 22px var(--font-display); letter-spacing: .2em; color: #e8dcc4; text-shadow: 0 2px 6px #000; }
#arena .dead .n { font: 900 72px/1 var(--font-display); color: #fff; text-shadow: 0 0 24px rgba(0,0,0,.9); }
#arena .dead small { color: var(--parchment); font-size: 14px; text-shadow: 0 1px 3px #000; }
#arena .hurt { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, rgba(200,20,10,.55) 100%); opacity: 0; }
#arena .cc { position: absolute; left: 50%; bottom: 196px; transform: translateX(-50%); font: 800 16px var(--font-display); letter-spacing: .2em; color: #ffd27a; text-shadow: 0 2px 4px #000; }
#arena .pb { position: absolute; left: 50%; bottom: 172px; transform: translateX(-50%); display: flex; gap: 6px; }
#arena .pb div { background: var(--panel); border: 1px solid; padding: 2px 8px; font: 700 12px var(--font-ui); letter-spacing: .04em; white-space: nowrap; }
#arena .board, #arena .end .board { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(6,9,22,.95); border: 1px solid var(--edge); padding: 14px 18px; min-width: min(640px, 92vw); box-shadow: 0 20px 60px rgba(0,0,0,.6); }
#arena .end .board { position: static; transform: none; margin-top: 10px; box-shadow: none; }
#arena table { width: 100%; border-collapse: collapse; font: 600 14px var(--font-ui); font-variant-numeric: tabular-nums; }
#arena th { font: 700 11px var(--font-display); letter-spacing: .14em; color: var(--gold); text-align: left; padding: 4px 8px; }
#arena td { padding: 4px 8px; border-top: 1px solid rgba(255,255,255,.06); color: var(--parchment); }
#arena td.n { text-align: right; } #arena tr.me td { color: #fff; background: rgba(230,184,90,.12); }
#arena tr.h0 th { color: #6fbaff; } #arena tr.h1 th { color: #ff6a5a; }
#arena tr.dead td { opacity: .5; }
#arena .end { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; background: radial-gradient(ellipse at center, rgba(8,12,30,.72), rgba(2,3,8,.92)); pointer-events: auto; z-index: 30; padding: 16px; overflow: auto; }
#arena .end h2 { margin: 0; font: 900 clamp(56px, 10vw, 128px)/1 var(--font-display); letter-spacing: .12em; background: linear-gradient(180deg, #ffb4a8, #ff4b3e 50%, #6a0a06); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 18px rgba(0,0,0,.7)); }
#arena .end.won h2 { background-image: linear-gradient(180deg, #fff1c8, var(--gold) 50%, #8a5f1c); }
#arena .end .sub { font: 700 16px var(--font-display); letter-spacing: .16em; color: var(--parchment); text-transform: uppercase; text-align: center; }
#arena .end .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 22px; margin-top: 8px; }
#arena .end .stats div { display: grid; gap: 2px; text-align: center; } #arena .end .stats span { font-size: 12px; color: var(--muted); letter-spacing: .06em; } #arena .end .stats b { font: 800 20px var(--font-ui); color: var(--parchment); }
#arena .end .row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; justify-content: center; }
#arena .end button, #menu .arenaRow button { pointer-events: auto; cursor: pointer; font: 700 15px var(--font-ui); letter-spacing: .12em; text-transform: uppercase; padding: 11px 22px; border: 1px solid var(--edge); background: var(--panel-solid); color: var(--parchment); }
#arena .end button.primary { background: linear-gradient(180deg, #ffe7a6, var(--gold) 55%, #b88a35); color: #05101e; border-color: #000; }
@media (max-width: 640px) { #arena .end .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } #arena canvas.mm { width: 180px; height: 98px; } #arena .tk { min-width: 96px; } #arena .tk b { font-size: 24px; } }
.modes { display: flex; gap: 8px; margin-top: 16px; }
.modes button { pointer-events: auto; cursor: pointer; font: 800 14px var(--font-display); letter-spacing: .14em; text-transform: uppercase; padding: 10px 18px; color: var(--parchment); background: rgba(10,16,36,.9); border: 1px solid rgba(255,255,255,.16); }
.modes button.on { border-color: var(--gold); color: #fff; box-shadow: 0 0 0 1px var(--gold), 0 0 22px rgba(230,184,90,.35); background: linear-gradient(180deg, rgba(230,184,90,.22), rgba(10,16,36,.9)); }
.modes button small { display: block; font: 600 11px var(--font-ui); letter-spacing: .06em; color: var(--muted); text-transform: none; margin-top: 2px; }
#app.arena-mode #topleft, #app.arena-mode #meter, #app.arena-mode #menu .godpick, #app.arena-mode #menu .ranks, #app.arena-mode #menu .checks, #app.arena-mode #menu .note,
#app.arena-mode #bReset, #app.arena-mode #bRestart, #app.arena-mode label[for=sLevel], #app.arena-mode label[for=sPower], #app.arena-mode label[for=sCdr] { display: none !important; }
#menu .arenaRow { display: none; gap: 10px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
#app.arena-mode #menu .arenaRow { display: flex; }
`;
    document.head.appendChild(css);
    const root = document.createElement('div'); root.id = 'arena'; root.hidden = true;
    root.innerHTML = `
      <div class="hurt"></div>
      <div class="top">
        <div class="tk t0"><b>200</b><div class="bar2"><i></i></div><span>${TEAMS[0].name} · your team</span></div>
        <div class="clock"><b>0:00</b><small>Arena of Ma’at</small></div>
        <div class="tk t1"><b>200</b><div class="bar2"><i></i></div><span>${TEAMS[1].name}</span></div>
      </div>
      <div class="scales" hidden><div class="lbl">Ma’at’s Judgement</div><div class="sb"><i class="a"></i><i class="b"></i></div></div>
      <canvas class="mm" width="520" height="280"></canvas>
      <div class="feed"></div>
      <div class="ann"></div>
      <div class="cc"></div>
      <div class="pb"></div>
      <div class="dead" hidden><div class="t">You have fallen</div><div class="n">0</div><small>You respawn at the fountain</small></div>
      <div class="board" hidden></div>
      <div class="end" hidden><h2>VICTORY</h2><div class="sub"></div><div class="stats"></div><div class="board"></div>
        <div class="row"><button type="button" class="again primary">New match</button><button type="button" class="same">Same teams again</button><button type="button" class="leave">To menu</button></div></div>`;
    document.getElementById('app').appendChild(root);
    const $ = (s) => root.querySelector(s);
    this.ui = { root, t0: $('.tk.t0'), t1: $('.tk.t1'), clock: $('.clock b'), phaseTxt: $('.clock small'), scales: $('.scales'), scalesA: $('.scales .a'), scalesB: $('.scales .b'), scalesLbl: $('.scales .lbl'),
      mm: $('canvas.mm'), feed: $('.feed'), ann: $('.ann'), cc: $('.cc'), pb: $('.pb'), dead: $('.dead'), deadN: $('.dead .n'), board: root.querySelector(':scope > .board'), end: $('.end'), hurt: $('.hurt') };
    this.ui.mmx = this.ui.mm.getContext('2d');
    $('.end .again').addEventListener('click', () => this.restart(true));
    $('.end .same').addEventListener('click', () => this.restart(false));
    $('.end .leave').addEventListener('click', () => this.exit());
    // the start screen: Treningsrom or Arena 5v5
    const modes = document.createElement('div'); modes.className = 'modes'; modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Choose mode');
    modes.innerHTML = '<button type="button" data-mode="play">Practice Room<small>Hall of Ma’at · targets and dummies</small></button><button type="button" data-mode="arena">Arena 5v5<small>You + 4 bots vs 5 bots</small></button>';
    UI.play.before(modes);
    modes.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { settings.mode = b.dataset.mode; saveSettings(); this.updateModeUI(); }));
    this.modesEl = modes;
    // the Esc menu during a match
    const row = document.createElement('div'); row.className = 'arenaRow';
    row.innerHTML = '<button type="button" class="leave">Leave to menu</button><button type="button" class="restart">Restart match</button>';
    document.querySelector('#menu .card').appendChild(row);
    row.querySelector('.leave').addEventListener('click', () => { UI.menu.hidden = true; this.exit(); });
    row.querySelector('.restart').addEventListener('click', () => { UI.menu.hidden = true; this.restart(false); });
    this.updateModeUI();
  },
  updateModeUI() {
    if (!this.modesEl) return;
    const arena = settings.mode === 'arena';
    this.modesEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === (arena ? 'arena' : 'play')));
    if (!UI.play.disabled) UI.play.textContent = arena ? 'Play Arena' : 'Play';
    const tag = document.getElementById('godTag');
    if (tag && Kit) tag.innerHTML = arena
      ? `${Kit.blurb} <em>Arena 5v5</em> in the Arena of Ma’at: you and four allied gods against five. 200 tickets each, minions, Sebek colossi, the Scales of Ma’at and Set’s Sandstorm.`
      : `${Kit.blurb} The training temple under the full moon has ushabti statues, wandering mummies and an Anubis guardian.`;
    const mt = document.getElementById('menuTitle'); if (mt) mt.textContent = this.active ? 'Arena 5v5 · paused' : 'Jungle Practice';
  },
  updateUI(dt) {
    const U = this.ui; if (!U) return;
    this.uiT -= dt;
    // announcer text
    if (this.annT > 0) { this.annT -= dt; if (this.annT <= 0) U.ann.classList.remove('on'); }
    // hurt vignette
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - dt * 1.6); U.hurt.style.opacity = (this.hurtFlash * 0.9).toFixed(3);
    if (this.uiT > 0) return;
    this.uiT = 0.1;
    this.tkPulse = this.tkPulse || [0, 0];
    [U.t0, U.t1].forEach((el, i) => {
      el.querySelector('b').textContent = this.tickets[i];
      el.querySelector('.bar2 i').style.transform = `scaleX(${this.tickets[i] / 200})`;
      el.classList.toggle('pulse', this.tkPulse[i] > 0); this.tkPulse[i] = Math.max(0, this.tkPulse[i] - 0.25);
    });
    const mm = Math.floor(this.time / 60), ss = Math.floor(this.time % 60);
    U.clock.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    U.phaseTxt.textContent = this.storm.on ? 'Set’s Sandstorm' : this.scales.active ? 'Ma’at’s Judgement' : `Wave ${this.wave} · next in ${Math.ceil(this.timers.wave)} s`;
    // the judgement bar
    const S = this.scales;
    U.scales.hidden = !(S.phase === 'judging');
    if (S.phase === 'judging') {
      const tot = 20; U.scalesA.style.left = `${50 - S.hold[0] / tot * 50}%`; U.scalesB.style.right = `${50 - S.hold[1] / tot * 50}%`;
      const c = S.contest || [0, 0];
      U.scalesLbl.textContent = `Ma’at’s Judgement · ${Math.max(0, Math.ceil(20 - S.t))} s · ${c[0] && c[1] ? 'contested' : c[0] ? `${TEAMS[0].name} holds` : c[1] ? `${TEAMS[1].name} holds` : 'empty'}`;
    }
    // crowd control + buffs on the player
    if (this.cc && this.cc.t > 0) { this.cc.t -= 0.1; U.cc.textContent = this.cc.label; } else U.cc.textContent = P.slowT > 0 ? 'SLOWED' : '';
    const pb = [];
    for (const [k, v] of Object.entries(this.pbuffs)) { if (v <= 0) continue; const B = BUFFS[k]; const nm = B ? B.name : k === 'scarabDmg' ? 'Scarab: strength' : k === 'scarabSpeed' ? 'Scarab: speed' : k; pb.push(`<div style="border-color:${B ? B.css : '#f2c25e'};color:${B ? B.css : '#ffd27a'}">${nm} ${Math.ceil(v)}s</div>`); }
    if (this.playerShield > 0) pb.push(`<div style="border-color:#f2c25e;color:#ffd27a">Shield ${Math.round(this.playerShield)}</div>`);
    if (this.playerAnkh) pb.push('<div style="border-color:#f2c25e;color:#ffd27a">Ankh: fast respawn</div>');
    const seen = this.pu && this.pu.seen[1 - this.myTeam];
    if (this.pu && this.pu.inReeds) pb.push(`<div style="border-color:#7faa4a;color:${seen ? '#ff9a8a' : '#bff59a'}">${seen ? 'In the papyrus · seen' : 'Hidden in the papyrus'}</div>`);
    const html = pb.join(''); if (U.pb._h !== html) { U.pb.innerHTML = html; U.pb._h = html; }
    // scoreboard (Tab)
    const showBoard = this.phase === 'play' && input.down.has('Tab');
    U.board.hidden = !showBoard;
    if (showBoard) this.renderBoard(U.board);
    this.drawMinimap();
  },
  renderBoard(el) {
    // (online: everyone's items too - mine, the other players' (their state), the bots' (the host's bot table))
    const net = Net.online, items = (u) => (net ? `<td class="iv">${(u === this.pu ? Items.slots : u.inv || []).filter((id) => ITEM[id]).map((id) => `<img src="${ItemIcons.url(id)}" alt="${netEsc(ITEM[id].name)}" title="${netEsc(ITEM[id].name)}">`).join('')}</td>` : '');
    const row = (u) => {
      const me = u === this.pu, s = me ? this.pstats : u, name = netEsc(me ? `You · ${Kit.name}` : u.name), alive = me ? !P.dead : u.alive;
      return `<tr class="${me ? 'me' : ''} ${alive ? '' : 'dead'}"><td>${name}</td><td class="n">${u.level}</td><td class="n">${s.k} / ${s.d} / ${s.a}</td>${items(u)}<td class="n">${alive ? '' : Math.ceil(me ? this.respawnT : u.respawn) + ' s'}</td></tr>`;
    };
    const team = (t) => [t === this.myTeam ? this.pu : null, ...this.humans.filter((h) => h.team === t), ...this.bots.filter((b) => b.team === t)].filter(Boolean);
    const ith = net ? '<th>Items</th>' : '';
    el.innerHTML = `<table><tr class="h0"><th>${TEAMS[0].name} · ${this.tickets[0]}</th><th>Level</th><th>K / D / A</th>${ith}<th></th></tr>${team(0).map(row).join('')}
      <tr class="h1"><th>${TEAMS[1].name} · ${this.tickets[1]}</th><th>Level</th><th>K / D / A</th>${ith}<th></th></tr>${team(1).map(row).join('')}</table>`;
  },
  drawMinimap() {
    const c = this.ui.mmx, W = 520, H = 280, sx = W / 152, sz = H / 80, X = (x) => W / 2 + x * sx, Z = (z) => H / 2 + z * sz;
    c.clearRect(0, 0, W, H);
    c.save();
    c.fillStyle = 'rgba(70,52,30,0.85)'; c.strokeStyle = 'rgba(230,184,90,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(X(0), Z(0), AM.A * sx, AM.B * sz, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = 'rgba(150,130,100,0.45)'; c.fillRect(X(-AM.gateX - 3), Z(-AM.laneHalf), (2 * AM.gateX + 6) * sx, 2 * AM.laneHalf * sz);
    c.fillStyle = 'rgba(80,140,50,0.55)'; for (const r of ArenaMap.reeds) { c.beginPath(); c.ellipse(X(r.x), Z(r.z), r.rx * sx, r.rz * sz, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(230,210,170,0.55)'; for (const b of ArenaMap.boxes) c.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * sx, (b.maxZ - b.minZ) * sz);
    for (const t of [0, 1]) { const f = ArenaMap.fountains[t].pos; c.strokeStyle = TEAMS[t].css; c.lineWidth = 2; c.beginPath(); c.arc(X(f.x), Z(f.z), AM.fountR * sx, 0, TAU); c.stroke(); const g = ArenaMap.gates[t].pos; c.fillStyle = TEAMS[t].css; c.beginPath(); c.arc(X(g.x), Z(g.z), 7, 0, TAU); c.fill(); }
    for (const cp of ArenaMap.camps) { c.fillStyle = cp.alive ? BUFFS[cp.buff].css : 'rgba(120,120,120,0.6)'; c.beginPath(); c.arc(X(cp.x), Z(cp.z), 6, 0, TAU); c.fill(); }
    if (this.scales.active) { c.strokeStyle = '#ffd27a'; c.lineWidth = 3; c.beginPath(); c.arc(X(0), Z(0), AM.scalesR * sx, 0, TAU); c.stroke(); }
    c.fillStyle = '#ffd27a'; for (const s of this.scarabs) { c.beginPath(); c.arc(X(s.pos.x), Z(s.pos.z), 4, 0, TAU); c.fill(); }
    for (const A of this.ankh) if (A.mesh) { c.fillStyle = '#fff1c8'; c.beginPath(); c.arc(X(A.mesh.position.x), Z(A.mesh.position.z), 5, 0, TAU); c.fill(); }
    for (const u of this.units) {
      if (!u.alive || (u.team === 1 - this.myTeam && !u.seen[this.myTeam])) continue;
      c.fillStyle = u.team === 2 ? BUFFS[u.camp.buff].css : TEAMS[u.team].css;
      if (u.isMinion) c.fillRect(X(u.pos.x) - 2.5, Z(u.pos.z) - 2.5, 5, 5);
      else if (u.kind === 'siege') { c.beginPath(); c.arc(X(u.pos.x), Z(u.pos.z), 9, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
      else if (u.isGod) { c.beginPath(); c.arc(X(u.pos.x), Z(u.pos.z), 7, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.stroke(); }
      else if (u.kind === 'camp' && u.big) { c.beginPath(); c.arc(X(u.pos.x), Z(u.pos.z), 4, 0, TAU); c.fill(); }
    }
    // you: a bright marker with the camera's view direction
    if (!P.dead) {
      const x = X(P.pos.x), z = Z(P.pos.z), f = fwdOf(Cam.yaw);
      c.fillStyle = 'rgba(255,240,200,0.18)'; c.beginPath(); c.moveTo(x, z);
      const a = Math.atan2(f.z * sz, f.x * sx); c.arc(x, z, 46, a - 0.5, a + 0.5); c.closePath(); c.fill();
      c.fillStyle = '#ffe7a6'; c.beginPath(); c.arc(x, z, 8.5, 0, TAU); c.fill(); c.strokeStyle = '#0a1024'; c.lineWidth = 2.5; c.stroke();
    }
    c.restore();
  },
  // bars and names over every unit (called from HUD.draw2D)
  drawBars(g, W, H, dt) {
    const v = _v1;
    for (const u of this.units) {
      if (!u.alive || !u.mesh.visible) continue;
      if (u.camDist > 58) continue;
      if (u.kind === 'minion' && u.hp >= u.maxHp - 0.5) continue;   // (clean HUD: a minion's bar shows once it is hurt)
      v.set(u.pos.x, u.height + 0.45 + u.lift, u.pos.z).project(camera);
      if (v.z > 1 || v.z < -1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const god = u.isGod, big = u.kind === 'siege' || (u.kind === 'camp' && u.big);
      const bw = god ? 96 : big ? 120 : u.kind === 'camp' ? 60 : 42, bh = god ? 8 : big ? 9 : 4;
      g.globalAlpha = clamp(1.35 - u.camDist / 50, 0.4, 1) * (u.away ? 0.55 : 1);   // (online: another player in the Esc menu is dimmed)
      g.fillStyle = 'rgba(4,5,12,0.85)'; g.fillRect(x - bw / 2 - 2, y - 2, bw + 4, bh + 4);
      const frac = clamp(u.hp / u.maxHp, 0, 1);
      u.lagHp = u.lagHp === undefined ? frac : Math.max(frac, u.lagHp - dt * 0.6);
      g.fillStyle = '#f2e7c8'; g.fillRect(x - bw / 2, y, bw * u.lagHp, bh);
      g.fillStyle = u.team === 0 ? (god ? '#4aa8ff' : '#3f86d8') : u.team === 1 ? (god ? '#ff4b3e' : '#c8382c') : BUFFS[u.camp.buff].css;
      g.fillRect(x - bw / 2, y, bw * frac, bh);
      if (u.shield > 0) { g.fillStyle = 'rgba(255,240,200,0.85)'; g.fillRect(x - bw / 2, y - 3, bw * clamp(u.shield / u.maxHp, 0, 1), 2); }
      if (god || big) {
        g.fillStyle = 'rgba(0,0,0,0.5)'; const seg = god ? 6 : 8; for (let i = 1; i < seg; i++) g.fillRect(x - bw / 2 + (bw * i) / seg, y, 1, bh);
        g.font = `700 ${god ? 13 : 12}px Rajdhani, system-ui, sans-serif`; g.textAlign = 'center';
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)';
        const label = u.away ? `${u.name} · away` : u.name;
        g.strokeText(label, x, y - 5);
        g.fillStyle = u.team === 0 ? '#ffd98a' : u.team === 1 ? '#ff8f80' : '#ffe2a0'; g.fillText(label, x, y - 5);
        if (god) {
          g.fillStyle = 'rgba(4,5,12,0.9)'; g.fillRect(x - bw / 2 - 20, y - 4, 16, 14); g.fillStyle = '#f2c25e'; g.font = '700 11px Rajdhani, system-ui, sans-serif'; g.fillText(String(u.level), x - bw / 2 - 12, y + 7);
          const st = u.stun > 0 ? 'STUN' : u.root > 0 ? 'ROOT' : u.slow > 0 ? 'SLOW' : u.inReeds ? 'HIDDEN' : '';
          if (st) { g.fillStyle = '#ffe28a'; g.font = '700 11px Rajdhani, system-ui, sans-serif'; g.fillText(st, x + bw / 2 + 18, y + 7); }
        }
      }
      g.globalAlpha = 1;
    }
  },
};


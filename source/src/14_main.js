// ============================================================================
// Boot, menus and the main loop
// ============================================================================
const UI = {
  start: document.getElementById('start'), play: document.getElementById('play'),
  loadBar: document.querySelector('#loadbar div'), loadTxt: document.getElementById('loadtxt'),
  menu: document.getElementById('menu'), hud: document.getElementById('hud'),
};
const bootT0 = performance.now(); let bootLast = bootT0; const bootTimes = [];
function setLoad(p, txt) { const now = performance.now(); bootTimes.push([UI.loadTxt.textContent, Math.round(now - bootLast)]); bootLast = now; UI.loadBar.style.width = (p * 100).toFixed(0) + '%'; if (txt) UI.loadTxt.textContent = txt; }

let lastNow = performance.now();
let fallbackLook = false;

// 3D assets: mocap-rigged Thoth + enemies and the temple props (published next to the page)
// (glTF JSON with an embedded buffer + WebP textures: tools/node/to_web.mjs)
const ASSET_LIST = [['sentinel', 1.3], ['mummy', 1.5], ['sphinx', 2.4], ['thoth_statue', 2.0], ['sarcophagus', 0.9],
  ['palm', 0.8], ['scales', 0.6], ['brazier', 0.6], ['amphorae', 0.6], ['ushabti', 0.6], ['canopic', 0.5], ['anubis_shrine', 0.5]]
  .map(([n, mb]) => [n, `assets/web/${n}.json`, mb]);
let assetProgress = 0;
async function loadAssets() {
  // the props + the god you play first (and the beasts of his or her kit); the others load on demand
  const first = startGodId();   // (an owner-only god the lock has not cleared yet starts as Thoth)
  const list = [...ASSET_LIST, ...[first, ...GOD_BEASTS[first]].map((n) => [n, `assets/web/${n}.json`, GOD_MB[n] || 1])];
  const total = list.reduce((a, x) => a + x[2], 0) * 1e6, got = new Map();
  const results = await Promise.allSettled(list.map(async ([name, url, mb]) => {
    const g = await loadGLB(url, (loaded) => { got.set(name, Math.min(loaded, mb * 1.2e6)); let l = 0; for (const v of got.values()) l += v; assetProgress = Math.min(1, l / total); });
    got.set(name, mb * 1e6);
    Assets.glb[name] = g; keepRest(name, g);
  }));
  results.forEach((r, i) => { if (r.status === 'rejected') console.warn('[thoth] asset failed', list[i][1], r.reason?.message || r.reason); });
  Assets.ok = !!Assets.glb[first];
}

async function boot() {
  try {
    setLoad(0.04, 'Loading hieroglyphs');
    const assetsReady = loadAssets().catch((e) => console.warn('[thoth] assets', e));
    Sound.preload();
    await loadGlyphFont();
    setLoad(0.12, 'Painting papyrus and gold'); await nextFrame();
    Tex.char = makeCharacterTextures();
    scene.environment = makeEnvironmentMap();
    scene.environmentIntensity = 0.62;
    makeMaterials(Tex.char);
    setLoad(0.3, 'Carving the temple'); await nextFrame();
    buildWorld();
    applyShadowQuality();   // (12b_realism.js)
    setLoad(0.55, 'Lighting the glyphs'); await nextFrame();
    VFX.init();
    GodFX.init();
    await FX2.init();
    setLoad(0.62, `Awakening ${GODS[startGodId()].name} (loading 3D models and mocap)`);
    const barT0 = parseFloat(UI.loadBar.style.width) / 100 || 0.62;
    const tick = setInterval(() => { UI.loadBar.style.width = ((barT0 + (0.8 - barT0) * assetProgress) * 100).toFixed(0) + '%'; UI.loadTxt.textContent = `Awakening the gods · 3D models ${Math.round(assetProgress * 100)}%`; }, 120);
    await assetsReady; clearInterval(tick);
    if (!Assets.ok) throw new Error('The 3D model could not be loaded');
    Game.book = new Book(); scene.add(Game.book.group); Game.book.group.visible = false;
    Net.captureTemplates();   // (the kits' state as it starts: online, each other player's god gets its own copy; 14n_net.js)
    initPlayer();
    await selectGod(startGodId(), { voice: false, force: true });
    placeProps();
    setLoad(0.8, 'Awakening the mummies'); await nextFrame();
    spawnDummies();
    HUD.init();
    initMenu();
    buildGodPickers();
    GodLock.check();   // (async, never blocks: the owner check unlocks owner-only gods when it answers)
    Arena.initUI();   // the mode choice on the start screen (Treningsrom / Arena 5v5) and the arena's overlay
    Net.initUI();     // the "Online med venner" button (the lobby itself is built when it is first opened)
    warmEffects();
    // warm up one frame so everything is posed, then compile shaders
    updatePlayer(0.016, 0);
    updateCamera(0.016, 0);
    setLoad(0.92, 'Compiling magic'); await nextFrame();
    renderer.compile(scene, camera);
    try { drawPortrait(document.getElementById('portraitCv')); } catch (e) { console.warn('portrait', e); }
    setLoad(1, 'Ready');
    UI.play.disabled = false; UI.play.textContent = settings.mode === 'arena' ? 'Play Arena' : 'Play';
    UI.play.focus({ preventScroll: true });
    console.info('[thoth] boot ms', Math.round(performance.now() - bootT0), JSON.stringify(bootTimes));
    window.__thoth = { THREE, Game, P, Combat, Cam, settings, VFX, GodFX, camera, scene, renderer, WORLD, M, input, Assets, Sound, PostFX, GODS, selectGod, cycleGod, get Kit() { return Kit; }, AB, GodLock, buildGodPickers, CM: typeof CM !== 'undefined' ? CM : null, cmHorrorStart: typeof cmHorrorStart !== 'undefined' ? cmHorrorStart : null, tick: debugTick, composer: () => composer, setupComposer, summonModel, FX2, FXA,
      Arena, ArenaMap, AM, BOT_KITS, BotCast, TEAMS, loadAsset,
      Recall, ContactShadows, applyShadowQuality, pressAbility, get BC() { return typeof BC !== 'undefined' ? BC : null; }, Net, RemoteActor, HUD };
    requestAnimationFrame(loop);
    Net.init();   // a #room=CODE link opens the lobby (nothing else happens without one)
  } catch (e) {
    console.error(e);
    UI.loadTxt.textContent = 'Something went wrong while loading: ' + e.message;
  }
}

// Compile the shaders of every common effect while the loading screen is up: one of each is spawned far
// outside the temple and dies at once (SHADER_KEEP then keeps the programs), so the first cast of any
// ability no longer freezes the game while its shaders compile.
function warmEffects() {
  const far = new THREE.Vector3(800, 0, 800), up = far.clone().setY(2);
  const tries = [
    () => FX2.ring(far, 'thoth', { radius: 2, dur: 0.05 }),
    () => { const h = FX2.tornado(far, 'thoth', { dur: 0.05 }); if (h) h.dead = true; },
    () => FX2.sphere(far, 'thoth', { radius: 1, dur: 0.05 }),
    () => FX2.sphere(far, 'thoth', { radius: 1, dur: 0.05, dome: true }),
    () => FX2.slash(up, 0, 'thoth', { dur: 0.05 }),
    () => FX2.scorch(far, 'thoth', { dur: 0.05 }),
    () => { const h = GodFX.column(far, 1, 2, COL.cyan, { core: COL.gold }); h.dead = true; },
    () => { const h = GodFX.beam(far, up, 0.1, COL.cyan, { core: COL.gold }); h.dead = true; },
    () => { const h = GodFX.portal(far, 1, COL.cyan, COL.gold, { flat: true }); h.dead = true; },
    () => { const h = GodFX.portal(up, 1, COL.cyan, COL.gold, {}); h.dead = true; },
    () => { const h = GodFX.bubble(far, 1, COL.cyan, {}); h.dead = true; },
    () => { const h = GodFX.bubble(far, 1, COL.cyan, { dome: true }); h.dead = true; },
    () => { const h = GodFX.shade(far, 2, 0.5); h.dead = true; },
    () => VFX.cracks(far, 1, 0.05, {}),
    () => VFX.bolt(far, up, COL.cyan, 0.05),
    () => { const h = VFX.pillar(far, 0.5, 2); h.dead = true; },
    () => VFX.shockwave(far, 2, 0.05),
    () => VFX.ring(far, COL.cyan, 0.2, 1, 0.05),
    () => { const tr = VFX.trail(0.1, COL.cyan, 1, 4); tr.push(far); tr.push(up); tr.alive = false; },
    () => VFX.decal(far, VFX.runeTex, COL.cyan, 1, 0.05),
    () => VFX.shatter(far, VFX.rubbleMat, 2, 0.5),
    () => FX2.burst(up, 'thoth', { size: 0.3, sparks: 2, embers: 2, puffs: 1, bursts: 1 }),
    () => FX2.debris(far, null, 2, 0.5, FX2.pal('thoth')),
  ];
  for (const f of tries) { try { f(); } catch (e) { console.warn('[warm]', e.message); } }
}
function startGame() {
  Sound.init();
  UI.start.hidden = true;
  UI.hud.hidden = false;
  input.enabled = true;
  Game.mode = 'play';
  Cam.yaw = P.yaw; Cam.pos.copy(camera.position);
  requestLock();
  setTimeout(() => { if (!input.locked && Game.mode === 'play') enableFallbackLook(); }, 700);
  setTimeout(() => { try { drawPortrait(document.getElementById('portraitCv')); } catch (e) { /* cosmetic */ } }, 250);
  prefetchGods();
}
function enableFallbackLook() {
  fallbackLook = true;
  HUD.toast('Click in the game to control with the mouse');
  const h = document.getElementById('lockhint'); if (h && (Game.mode === 'play' || Game.mode === 'inspect')) h.hidden = false;
}
function openMenu() {
  if (Game.mode === 'menu' || Game.mode === 'arenaEnd') return;
  Arena.updateModeUI();
  Game.prevMode = Game.mode === 'inspect' ? 'inspect' : 'play';
  Game.mode = 'paused';
  UI.menu.hidden = false;
  P.targeting = null;
  input.lmb = false;
  Net.setAway(true);   // (online the match does not pause)
}
function closeMenu() {
  UI.menu.hidden = true;
  Game.mode = Game.prevMode || 'play';
  Net.setAway(false);
  Sound.init();
  if (!fallbackLook) requestLock();
}
// a fresh round with the same god, without reloading: foes, cooldowns, buffs and every effect reset
async function restartGame() {
  if (godSwitching) return;
  Recall.reset();
  if (Kit) Kit.dispose();
  for (const p of Combat.projectiles) if (p.alive) p.die(p.pos, false);
  Combat.projectiles = [];
  for (const w of Combat.walls) { w.alive = false; disposeGroup(w.group); }
  Combat.walls = [];
  VFX.timed.length = 0;
  GodFX.clear(); FX2.clear();
  Game.stopT = 0; P.targeting = null;
  P.pos.set(0, 0, -18); P.vel.set(0, 0, 0); P.yaw = 0; P.y = 0; P.vy = 0;
  Cam.yaw = 0; Cam.pitch = CAM_PITCH; Cam.shake = 0; Cam.fovKick = 0; Cam.focus = null; Cam.shot = null; PostFX.aberr = 0;
  resetDummies();
  for (const d of Combat.dummies) { d.mesh.rotation.x = 0; d.mesh.rotation.z = 0; }
  UI.menu.hidden = true; Game.mode = 'play';
  await selectGod(Kit ? Kit.id : startGodId(), { force: true });
  HUD.toast(`New round · ${Kit.name}`);
  Sound.init();
  if (!fallbackLook) requestLock();
}
// browsers do not let a page close its own tab, so quitting shuts the whole game down instead:
// the loop stops, every sound stops, the GPU is released, and an end screen offers a fresh start
function quitGame() {
  Net.leave({ quiet: true });
  Game.mode = 'quit';
  input.enabled = false; input.down.clear(); input.lmb = input.rmb = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  Sound.shutdown();
  UI.menu.hidden = true; UI.hud.hidden = true; UI.start.hidden = true;
  fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* already gone */ }
  glCanvas.style.visibility = 'hidden';
  document.getElementById('quit').hidden = false;
  try { window.close(); } catch (e) { /* only works for windows a script opened */ }
}
onPointerLockChange = (locked) => {
  UI.hud && document.getElementById('lockhint') && (document.getElementById('lockhint').hidden = true);
  if (locked) fallbackLook = false;   // a click got the lock after all: normal mouse look again
  if (!locked && (Game.mode === 'play' || Game.mode === 'inspect') && !fallbackLook) openMenu();
};
UI.play.addEventListener('click', () => { if (Net.online) { if (!Arena.loading && !Arena.waiting && !Arena.active) Net.showLobby(); } else if (settings.mode === 'arena') Arena.launch(); else startGame(); });
document.getElementById('lockhint').addEventListener('click', () => { requestLock(); document.getElementById('lockhint').hidden = true; });
// any click in the game takes the mouse (also after a failed automatic lock, e.g. when Arena finished loading without a fresh click)
glCanvas.addEventListener('click', () => { if ((Game.mode === 'play' || Game.mode === 'inspect') && !input.locked) requestLock(); });

function initMenu() {
  const $ = (id) => document.getElementById(id);
  const bindRange = (id, label, get, set, fmt) => {
    const el = $(id), lab = $(label);
    el.value = get();
    lab.textContent = fmt(get());
    el.addEventListener('input', () => { set(parseFloat(el.value)); lab.textContent = fmt(get()); saveSettings(); });
  };
  bindRange('sLevel', 'vLevel', () => settings.level, (v) => { settings.level = v; P.hp = Math.min(P.hp, maxHp()); }, (v) => String(v));
  bindRange('sPower', 'vPower', () => settings.power, (v) => { settings.power = v; }, (v) => String(v));
  bindRange('sCdr', 'vCdr', () => Math.round(settings.cdr * 100), (v) => { settings.cdr = v / 100; }, (v) => `${v}%`);
  bindRange('sSens', 'vSens', () => settings.sens, (v) => { settings.sens = v; }, (v) => Number(v).toFixed(1));
  bindRange('sVolume', 'vVolume', () => Math.round(settings.volume * 100), (v) => { settings.volume = v / 100; Sound.setVolume(settings.volume); }, (v) => `${v}%`);
  bindRange('sMusic', 'vMusic', () => Math.round(settings.music * 100), (v) => { settings.music = v / 100; Sound.setMusic(settings.music); }, (v) => `${v}%`);
  const vs = $('sVoice');
  if (vs) {
  for (const [k, label] of Object.entries(VOICE_PACKS)) { const o = document.createElement('option'); o.value = k; o.textContent = label; vs.appendChild(o); }
  vs.value = VOICE_PACKS[settings.voice] ? settings.voice : 'thoth';
  vs.addEventListener('change', () => {
    settings.voice = vs.value; saveSettings();
    if (Kit.id === 'thoth') Sound.loadVoicePack(settings.voice).then(() => { Sound.lastVoice = {}; Sound.voice('awaken', { priority: 4, cooldown: 0 }); });
  });
  }
  const q = $('sQuality'); q.value = settings.quality;
  q.addEventListener('change', () => { settings.quality = q.value; saveSettings(); setupComposer(); applyShadowQuality(); });
  ['r1', 'r2', 'r3', 'r4', 'r5'].forEach((id, i) => {
    const s = $(id);
    s.innerHTML = [1, 2, 3, 4, 5].map((r) => `<option value="${r}">${r}</option>`).join('');
    s.value = String(settings.ranks[i]);
    s.addEventListener('change', () => { settings.ranks[i] = parseInt(s.value, 10); saveSettings(); });
    s.previousElementSibling.textContent = (Kit.info[Kit.order[i]] || AB[Kit.order[i]]).name;
  });
  const bindCheck = (id, key) => { const c = $(id); c.checked = !!settings[key]; c.addEventListener('change', () => { settings[key] = c.checked; saveSettings(); }); };
  bindCheck('cNoCd', 'noCooldowns'); bindCheck('cInfMana', 'infiniteMana'); bindCheck('cQuick', 'quickCast'); bindCheck('cMove', 'dummiesMove');
  $('bReset').addEventListener('click', () => { resetDummies(); });
  $('bResume').addEventListener('click', closeMenu);
  $('bRestart').addEventListener('click', () => { restartGame(); });
  $('bQuit').addEventListener('click', quitGame);
  $('bAgain').addEventListener('click', () => location.reload());
}

addEventListener('keydown', (e) => {
  if (isFormTarget(e) && e.code !== 'Escape') return;
  if (e.code === 'Escape') {
    if (Game.mode === 'paused') { e.preventDefault(); closeMenu(); }
    else if ((Game.mode === 'play' || Game.mode === 'inspect') && (!input.locked || fallbackLook)) { e.preventDefault(); openMenu(); }
  }
  if (Game.mode === 'play' || Game.mode === 'inspect') {
    if (e.code === 'KeyC' && !e.repeat && !Arena.active) {
      if (Game.mode === 'inspect') { Game.mode = 'play'; HUD.toast('Back in the fight'); }
      else { Game.mode = 'inspect'; Cam.ix = P.yaw + 0.35; Cam.iy = 0.1; Cam.idist = 3.2; P.targeting = null; HUD.toast('Inspect · mouse rotates · scroll zooms · C to go back'); }
    }
    if (e.code === 'KeyH' && !e.repeat) document.getElementById('keys').hidden = !document.getElementById('keys').hidden;
    if (e.code === 'KeyM' && !e.repeat) { const m = Sound.toggleMute(); HUD.toast(m ? 'Sound off' : 'Sound on'); }
    // V switches god (G is ability 5 now); not during a match or a recall
    if (e.code === 'KeyV' && !e.repeat && !kitBusy() && !Arena.active && !Recall.active) cycleGod(e.shiftKey ? -1 : 1);
  }
});

function simulate(dt, wdt = dt) {   // wdt: the unscaled dt (no hit-stop), for the shared world online
  // Arena 5v5 paused (Esc) or over: the whole match stands still, only the camera settles
  // (online the world is shared and never pauses: Esc only marks the player as away)
  if (Arena.active && Game.mode !== 'play' && Game.mode !== 'inspect' && !(Net.online && Game.mode === 'paused')) { input.mdx = 0; input.mdy = 0; updateCamera(dt, Game.time); return; }
  Game.time += dt;
  Combat.time = Game.time;
  const t = Game.time;
  const dragging = fallbackLook && input.dragLook;
  if (!input.locked && !dragging) { input.mdx = 0; input.mdy = 0; }

  updatePlayer(dt, t);
  if (Net.online) { Net.afterLocal(wdt, t); Net.applyIncoming(wdt, t); Net.updateRemotes(wdt, t); }   // my pose out; the host's world and the other players in
  if (Arena.active) Arena.update(Net.online ? wdt : dt, t);   // every arena unit, the rules, the features and the overlay
  else if (!Arena.waiting) for (const d of Combat.dummies) d.update(dt, t);   // (online, a match set up waits for its start: nobody moves)
  if (Net.online) Net.afterWorld(wdt, t);   // (the host: new and removed units as events, the world snapshot)
  Combat.projectiles = Combat.projectiles.filter((p) => (p.ctx ? Net.step(p.ctx, () => p.update(dt)) : p.update(dt)));
  Combat.walls = Combat.walls.filter((w) => w.update(dt, t));
  updateWaves(dt, t);
  VFX.update(dt);
  GodFX.update(dt, t);
  FX2.update(dt, t);
  if (Net.online) { ulRainUpdate(dt); ulConfUpdate(dt); }   // (Ullr's arrow rain and confetti: every Ullr's, mine and the others')
  updateTargeters(t);
  updateCamera(dt, t);
  if (Kit && Kit.postCamera) Kit.postCamera(dt, t);   // (a kit's cinematic cut, e.g. Cookie Horror's victim POV)
  updateWorld(dt, t, P.pos);
  ContactShadows.update();   // (12b_realism.js)
  if (UI.hud && !UI.hud.hidden) HUD.update(dt);
}
function loop(now) {
  if (Game.mode === 'quit') return;   // quit: no more frames
  Net.rafAt = now;   // (online: the pump simulates while frames stop, e.g. in a hidden tab)
  const dt = Math.min(1 / 20, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  // hit-stop: the world freezes for a heartbeat on the biggest impacts
  let sdt = dt;
  if (Game.stopT > 0) { Game.stopT -= dt; sdt = dt * Game.stopScale; }
  simulate(sdt, dt);
  PostFX.update(dt);
  if (!HEADLESS) {
    if (FX2.ready) FX2.distort.render();
    composer.render();
  }
  HUD.draw2D(dt);
  if (Net.online) Net.flush();
  endFrameInput();
  requestAnimationFrame(loop);
}
// test hook: advance the simulation in fixed steps, then draw one frame
function debugTick(seconds = 0.5) {
  const n = Math.max(1, Math.round(seconds * 60));
  for (let i = 0; i < n; i++) { simulate(1 / 60); PostFX.update(1 / 60); if (i === 0) endFrameInput(); }
  if (!HEADLESS) { if (FX2.ready) FX2.distort.render(); composer.render(); }
  HUD.draw2D(1 / 60);
  if (Net.online) Net.flush();
}

boot();

// ============================================================================
// God selection: models load on demand; switching swaps the rig, the animator, the HUD, the
// voice and the sound set. Start screen and Esc menu show a pantheon of cards; V cycles in play.
// ============================================================================
const GOD_LIST = ['thoth', 'skadi', 'bastet', 'hecate', 'ra', 'bacchus', 'ullr', 'cookie'];
// gods the Arena bots never pick (owner-only Cookie Monster has no bot kit)
const botGodList = () => GOD_LIST.filter((g) => !(GODS[g] && (GODS[g].noBot || GODS[g].ownerOnly)));
// ---- the owner lock: Cookie Monster is playable only by the artifact's owner (and on the local / dev copy).
// claude.ai's `user` capability answers isOwner(); use() may resolve null (unavailable) after up to 10 s, so the
// check never blocks the first paint: until it answers, owner-only gods show as locked.
// On the public website (no claude.ai viewer) the owner unlocks with a secret code instead: open the game with
// #owner=<code> once, or click the locked card five times and type it. Only the code's SHA-256 is in the source;
// the code itself is remembered in this browser's localStorage and checked against the hash on every load.
const OWNER_HASH = '71ee37cdeac0646ac53a10cee705b02f6f1e84253183e7fee27afd06cbe9deb9';
const OWNER_KEY = 'thoth.ownerCode';
const GodLock = {
  state: 'unknown', owner: false, wanted: null, taps: 0,
  local() { try { const h = location.hostname, f = location.pathname || ''; return location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost') || /dev\.html$/.test(f); } catch (e) { return false; } },
  get unlocked() { return this.local() || this.owner; },
  async codeOk(code) {
    try {
      if (!code || !crypto.subtle) return false;
      const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(code).trim()));
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('') === OWNER_HASH;
    } catch (e) { return false; }
  },
  // a code from the URL (#owner=...) or the prompt: remember it, unlock, rebuild the pickers
  async tryCode(code) {
    if (!(await this.codeOk(code))) return false;
    try { localStorage.setItem(OWNER_KEY, String(code).trim()); } catch (e) { /* private mode: unlocked for this visit */ }
    this.owner = true; this.state = 'done';
    if (typeof buildGodPickers === 'function') buildGodPickers();
    return true;
  },
  // five clicks on the locked card: ask for the code
  async tap() {
    if (++this.taps < 5) return;
    this.taps = 0;
    const code = prompt('Code');
    if (code && !(await this.tryCode(code)) && HUD.toast) HUD.toast('steens secret, good luck');
  },
  async check() {
    if (this.local()) { this.state = 'local'; return; }
    try {
      const m = /[#&]owner=([^&]+)/.exec(location.hash || '');
      if (m) {
        const ok = await this.tryCode(decodeURIComponent(m[1]));
        history.replaceState(null, '', location.pathname + location.search + location.hash.replace(/[#&]?owner=[^&]*/, ''));   // (the code never stays in the address bar)
        if (ok) this.owner = true;
      }
      let saved = null; try { saved = localStorage.getItem(OWNER_KEY); } catch (e) { /* no storage */ }
      if (!this.owner && saved) this.owner = await this.codeOk(saved);
      if (!this.owner) {
        const user = window.claude && window.claude.use ? await window.claude.use('user') : null;
        this.owner = user ? !!(await user.isOwner()) : false;
      }
    } catch (e) { this.owner = false; }
    this.state = 'done';
    if (typeof buildGodPickers === 'function') buildGodPickers();
    // the owner whose saved god was Cookie Monster started as Thoth while the check ran: switch back if still in the menu
    if (this.owner && this.wanted && GODS[this.wanted] && Game.mode === 'menu' && Kit && Kit.id !== this.wanted) selectGod(this.wanted, { voice: false });
  },
};
const godAllowed = (id) => !(GODS[id] && GODS[id].ownerOnly) || GodLock.unlocked;
// the god to start with: the saved one if it exists and is allowed (else Thoth; remember the wish for the owner check)
function startGodId() { const g = settings.god; if (GODS[g] && godAllowed(g)) return g; if (GODS[g]) GodLock.wanted = g; return 'thoth'; }
// each god's extra models: beasts and the summoned things of their finals
const GOD_BEASTS = { thoth: [], skadi: ['wolf', 'peak_spire', 'peak_cluster'], bastet: ['cat', 'apep_head'], hecate: ['wolf', 'hecate_key'], ra: ['falcon', 'barque'], bacchus: ['bacchus_jug'], ullr: ['ullr_clown'], cookie: ['cookie_rage', 'cookie_prop'] };
const GOD_MB = { thoth: 5.7, skadi: 8.6, bastet: 6.6, hecate: 6.9, ra: 6.5, bacchus: 7.2, wolf: 0.75, cat: 0.67, lioness: 0.52, falcon: 0.58, ammit: 1.47, apep_head: 1.22, barque: 1.59, hecate_key: 0.69, peak_spire: 2.5, peak_cluster: 2.36, bacchus_jug: 0.87, ullr: 6.5, ullr_clown: 6.7, cookie: 7.7, cookie_rage: 7.4, cookie_prop: 1.9 };
const godRigs = {};
const godLoads = {};
let godSwitching = false;
function loadAsset(name, onProgress) {
  if (Assets.glb[name]) return Promise.resolve(Assets.glb[name]);
  if (!godLoads[name]) godLoads[name] = loadGLB(`assets/web/${name}.json`, onProgress).then((g) => { Assets.glb[name] = g; keepRest(name, g); return g; }).catch((e) => { delete godLoads[name]; throw e; });
  return godLoads[name];
}
async function ensureGodAssets(id, onProgress) {
  const names = [id, ...GOD_BEASTS[id]];
  const total = names.reduce((a, n) => a + (GOD_MB[n] || 1), 0) * 1e6, got = {};
  await Promise.all(names.map((n) => loadAsset(n, (l) => { got[n] = l; if (onProgress) onProgress(Math.min(1, Object.values(got).reduce((a, b) => a + b, 0) / total)); })));
}
// quietly fetch the other gods in the background so switching is instant later
function prefetchGods() {
  let i = 0;
  const next = () => { let id = GOD_LIST[i++]; while (id && !godAllowed(id)) id = GOD_LIST[i++]; if (!id) return; ensureGodAssets(id).catch(() => {}).finally(() => setTimeout(next, 400)); };
  setTimeout(next, 2500);
}

async function selectGod(id, opts = {}) {
  if (!GODS[id]) id = 'thoth';
  if (!godAllowed(id)) { if (HUD.toast) HUD.toast(GODS[id].lockedTitle || 'Locked'); return false; }   // (owner-only god)
  if (godSwitching) return false;
  if (Kit && Kit.id === id && Game.thoth && !opts.force) return true;
  godSwitching = true;
  try {
    if (!Assets.glb[id] || GOD_BEASTS[id].some((b) => !Assets.glb[b])) {
      if (Game.mode === 'play' || Game.mode === 'paused') HUD.toast(`Loading ${GODS[id].name} …`);
      if (opts.onProgress) opts.onProgress(0);
      await ensureGodAssets(id, opts.onProgress);
    }
    // tear down the current god
    if (Kit) { Kit.dispose(); }
    P.targeting = null; P.speedBuff = 1; P.asBuff = 1; P.flying = false; P.y = 0; P.vy = 0; P.grounded = true; P.atkCd = 0; P.atkPenalty = 0;
    Cam.frameTarget = 0; Cam.shot = null; WORLD.dim = 1; PostFX.vigTarget = 0;
    if (Game.thoth) Game.thoth.root.visible = false;
    if (Game.book) Game.book.group.visible = false;
    // build (once) or reuse the new god's rig
    let R = godRigs[id];
    if (!R) {
      const rig = new GodRig(Assets.glb[id], id);
      scene.add(rig.root);
      R = godRigs[id] = { rig, anim: new RigAnimator(rig, id === 'thoth' ? Game.book : null) };
      R.anim.onStep = (p) => { if (Kit && Kit.id === id && Game.mode === 'play') Sound.step(p); };
    }
    R.rig.root.visible = true; R.rig.root.rotation.y = P.yaw;   // arrive already facing the camera
    R.anim.actions = []; R.anim.channelTarget = 0; R.anim.channel = 0; R.anim.liftTarget = 0; R.anim.extraLift = 0; R.anim.firstFrame = true; R.anim.wrathT = -1;
    Game.thoth = R.rig; Game.anim = R.anim; Game.god = id;
    Kit = GODS[id];
    ABILITY_ORDER = Kit.order.slice();
    for (const k of ABILITY_ORDER) P.cd[k] = 0;
    P.hp = maxHp(); P.mp = maxMp();
    Kit.init();
    settings.god = id; saveSettings();
    if (HUD.els && HUD.els.abilities) HUD.rebuild();
    updateGodUI();
    Sound.loadGod(id).then(() => { if (opts.voice !== false) { Sound.lastVoice = {}; Sound.voice('awaken', { priority: 4, delay: 0.3, cooldown: 0 }); } });
    if (Game.mode === 'play' || Game.mode === 'paused' || Game.mode === 'inspect') {
      // arrive in a flash of the god's own magic
      const c = (Kit.accent || COL.cyan);
      VFX.burst(P.pos.clone().setY(1.1), { color: c, count: 40, speed: 6, flash: 2.4, intensity: 3.2 });
      VFX.shockwave(P.pos, 4.5, 0.45, c, 1.4, 2);
      VFX.flash(P.pos.clone().setY(1.5), c, 30, 0.5);
      HUD.toast(`${Kit.name} · ${Kit.title}`);
    }
    // pose once and refresh the portrait
    updatePlayer(0.016, Game.time);
    try { drawPortrait(document.getElementById('portraitCv')); } catch (e) { /* portrait is cosmetic */ }
    return true;
  } catch (e) {
    console.warn('[gods] switch failed', e);
    HUD.toast && HUD.toast(`Could not load ${GODS[id] ? GODS[id].name : id}`);
    return false;
  } finally { godSwitching = false; }
}
function cycleGod(dir = 1) {
  const L = GOD_LIST.filter(godAllowed);   // (locked gods are skipped)
  const i = Math.max(0, L.indexOf(Kit ? Kit.id : 'thoth'));
  selectGod(L[(i + dir + L.length) % L.length]);
}

// ---- the pantheon cards (start screen + Esc menu) -------------------------------------------
function buildGodPickers() {
  for (const host of document.querySelectorAll('.godpick')) {
    host.innerHTML = '';
    for (const id of GOD_LIST) {
      const k = GODS[id];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'godcard'; b.dataset.god = id;
      b.style.setProperty('--gc', k.color);
      if (!godAllowed(id)) {   // owner-only and not the owner: a dark, locked card (no name, no picking; 5 clicks ask the owner for the code)
        b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); b.tabIndex = -1; b.title = k.lockedTitle || 'Locked';
        b.innerHTML = `<span class="gg">🔒</span><b>LOCKED</b><small>${k.lockedTitle || 'Locked'}</small>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); GodLock.tap(); });
        host.appendChild(b); continue;
      }
      b.innerHTML = `<span class="gg">${k.glyphs.split(' ')[0]}</span><b>${k.name}</b><small>${k.nick || `${k.role} · ${k.pantheon}`}</small>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (Net.online && (Arena.loading || Arena.waiting || Arena.active)) return; selectGod(id, { onProgress: (p) => { b.style.setProperty('--load', `${Math.round(p * 100)}%`); } }); });
      host.appendChild(b);
    }
  }
  updateGodUI();
}
function updateGodUI() {
  if (!Kit || Net.ctx) return;
  for (const b of document.querySelectorAll('.godcard')) b.classList.toggle('on', b.dataset.god === Kit.id);
  const $ = (id) => document.getElementById(id);
  if ($('godName')) $('godName').textContent = Kit.name.toUpperCase();
  if ($('godSub')) $('godSub').textContent = Kit.epithet;
  if ($('godGlyphs')) $('godGlyphs').textContent = Kit.glyphs;
  if ($('godTag')) $('godTag').innerHTML = `${Kit.blurb} The training temple under the full moon has ushabti statues, wandering mummies and an Anubis guardian.`;
  if ($('godKeys')) $('godKeys').innerHTML = Kit.order.map((id, i) => `<div><kbd>${ABILITY_KEYS[i]}</kbd>${(Kit.info[id] || AB[id]).name}${i === 4 ? ' (final)' : ''}</div>`).join('');
  document.documentElement.style.setProperty('--god', Kit.color);
  const vs = $('sVoice'); if (vs) { vs.closest('label').hidden = !Kit.voicePacks; }
  ['r1', 'r2', 'r3', 'r4', 'r5'].forEach((rid, i) => { const s = $(rid); if (s && s.previousElementSibling) s.previousElementSibling.textContent = (Kit.info[Kit.order[i]] || AB[Kit.order[i]]).name; });
  const pw = $('powerLabel'); if (pw) pw.textContent = Kit.physical ? 'Power (physical = 55%)' : 'Magical Power';
  Arena.updateModeUI();   // (the start screen's text follows the chosen mode)
}


// ============================================================================
// Sound (WebAudio, sample based). Every effect is a pre-rendered, layered recording
// (tools/audio/make_sfx.py: orchestral hits, cinematic drums, sub-bass sonic booms in cave
// reverb), Thoth's voice lines are processed ElevenLabs takes (make_voice.py) and the temple
// has its own calm Egyptian score (make_music.py). Here they are mixed: effects duck under
// the voice, the music ducks under the big moments, a soft magical hum follows his glide and
// a little synthesized night wind and brazier crackle fill the hall.
// ============================================================================
const SFX_FILES = ['basic1', 'basic2', 'basic3', 'basic_hit1', 'basic_hit2', 'cancel', 'ep_dash', 'ep_ready', 'ep_shot',
  'fj_channel', 'fj_fire', 'fj_page1', 'fj_page2', 'fj_page3', 'gp_cast', 'gp_cross', 'ha_cast', 'ha_shot1', 'ha_shot2', 'ha_shot3',
  'jump', 'land', 'shatter', 'shatter_god', 'ult_hit', 'book_flutter', 'glide_loop', 'sonic_boom',
  // The Final Spell (tools/audio/make_sfx10a.py)
  'fs_throw', 'fs_rise', 'fs_charge', 'fs_impact', 'fs_end'];
// Thoth's voice (v15: Caspian, regal 'majesty' chain on the normal lines - tools/audio/pack15.py; abilities 4 / 5 in the
// darker 'wrath / mountain echo' chain - tools/audio/wrath15.py; the ult files carry ~3 s echo tails, so their hold times matter)
const VOICE_PACKS = { thoth: 'Thoth' };
const SHARED_VOICE = new Set();
const VOICE_LINES = {
  fj_start: ['fj_start_1', 'fj_start_2', 'fj_start_3'],   // (fj_judgement is no longer used: it ran past the 3 s channel)
  fj_fire: ['fj_fire'],
  fs_charge: ['fs_charge'], fs_cast: ['fs_cast'],
  ha: ['ha_1', 'ha_2', 'ha_3'], ep: ['ep_1', 'ep_2', 'ep_3'], gp: ['gp_1', 'gp_2'], eff: ['eff_1', 'eff_2'],
  kill: ['kill_1', 'kill_2', 'kill_3'], taunt: ['taunt'], laugh: ['laugh'], knowledge: ['knowledge'], awaken: ['awaken'],
};
// the new gods share one line layout (assets/voice/<god>/<line>.mp3)
const GOD_VOICE_LINES = {
  awaken: ['awaken'], a1: ['a1_1', 'a1_2', 'a1_3'], a2: ['a2_1', 'a2_2'], a3: ['a3_1', 'a3_2'], ult: ['ult_1', 'ult_2'], ult_scream: ['ult_scream'],
  fin_charge: ['fin_charge'], fin_roar: ['fin_roar'], fin_line: ['fin_line'], kill: ['kill_1', 'kill_2', 'kill_3'], taunt: ['taunt'], laugh: ['laugh'],
  eff: ['eff_1', 'eff_2'], passive: ['passive'],
};
// lines a god does not ship: Ra has no third ability-1 take; Skadi's "the prey is marked" reads as "mocked"
const GOD_VOICE_SKIP = {   // v8: every line of the new packs was re-recorded and checked
  ullr: ['a1_3', 'ult_1', 'ult_2', 'ult_scream', 'fin_charge', 'fin_line', 'passive'],
  cookie: ['a1_1', 'a1_2', 'a1_3', 'a2_1', 'a2_2', 'a3_1', 'a3_2', 'ult_1', 'ult_2', 'ult_scream', 'fin_charge', 'fin_roar', 'fin_line', 'eff_1', 'eff_2', 'passive'],   // (his own groups below)   // lines Ullr's kit never calls (not recorded: no 404s)
};
// each god's own sound set (assets/sfx/<god>/<name>.mp3, tools/audio/make_sfx4.py)
const GOD_SFX = {
  skadi: ['basic1', 'basic2', 'basic3', 'basic_hit1', 'basic_hit2', 'pc_throw', 'pc_hit', 'rh_mark', 'kaldr_bite', 'kaldr_howl', 'pf_cast', 'pf_loop', 'wg_start', 'wg_loop', 'wg_root', 'kaldr_leap', 'wg_land', 'shatter_ice', 'step1', 'step2', 'step3',
    'th_call', 'th_mountain', 'th_howl', 'th_avalanche', 'th_bite', 'th_shatter'],
  bastet: ['swipe1', 'swipe2', 'swipe3', 'claw_hit1', 'claw_hit2', 'pounce', 'pounce_land', 'pounce_back', 'whip', 'bleed', 'claw_cast', 'claw_root', 'cat_meow', 'huntress_cast', 'huntress_hit', 'quicksand_loop', 'step1', 'step2', 'step3',
    'huntress_windup', 'huntress_carry', 'cat_attack', 'heal', 'ap_dusk', 'ap_emerge', 'ap_coil', 'ap_cat', 'ap_slash', 'ap_end'],
  hecate: ['bolt1', 'bolt2', 'bolt3', 'bolt_hit1', 'bolt_hit2', 'tf_power', 'tf_hex', 'tf_split', 'se_place', 'se_charge', 'se_drop', 'rm_shield', 'rm_pulse', 'gate_open', 'gate_loop', 'gate_swap', 'gate_blast',
    'hk_dark', 'hk_key', 'hk_turn', 'hk_abyss', 'hk_drag', 'hk_hounds', 'hk_slam'],
  ra: ['orb1', 'orb2', 'orb3', 'orb_hit1', 'orb_hit2', 'cb_cast', 'cb_sweep', 'cb_strike', 'dl_charge', 'dl_burst', 'sb_cast', 'sb_loop', 'sp_charge', 'sp_fire', 'sp_loop', 'falcon',
    'bq_dawn', 'bq_sail', 'bq_beam', 'bq_sunset'],
  bacchus: ['swing1', 'swing2', 'swing3', 'hit1', 'hit2', 'step1', 'step2', 'step3', 'chug', 'drunk_up', 'flop_jump', 'flop_land', 'belch_wave', 'intox_cast', 'intox_dizzy',
    'df_rumble', 'df_strain', 'df_fart', 'df_cloud', 'df_end',
    'df_toot1', 'df_toot2', 'df_toot3', 'df_toot4', 'df_toot5', 'df_toot6', 'df_toot7', 'df_toot8',
    'df_sputter1', 'df_sputter2', 'df_sputter3', 'df_sputter4', 'df_sputter5', 'df_squeak1', 'df_squeak2', 'df_squeak3', 'df_squeak4'],
  // Ullr «Bowelius» (tools/audio/ullr_sfx.py; names unique so none falls back to a shared sample)
  ullr: ['step1', 'step2', 'step3', 'bow_draw', 'arrow_release', 'arrow_hit', 'ba_release', 'ba_hit', 'axe_swing1', 'axe_swing2', 'axe_swing3', 'axe_hit', 'axe_throw',
    'ew_buff', 'hail_cast', 'hail_rain', 'hail_impact', 'iv_buff', 'leap', 'leap_land', 'stance_swap',
    'clown_poof', 'clown_honk', 'clown_music', 'clown_end', 'balloon_pop',
    'fart_toot2', 'fart_toot5', 'fart_toot7', 'fart_toot8', 'fart_sputter1', 'fart_sputter2', 'fart_sputter4', 'fart_sputter5',
    'arrow_plop', 'axe_thunk', 'bonk', 'faceplant', 'slip'],
  // Cookie Monster (tools/audio/cookie_sfx.py): see 11i_cookie.js for when each one fires
  cookie: ['step1', 'step2', 'step3', 'punch_swing1', 'punch_swing2', 'punch_swing3', 'cookie_throw', 'cookie_hit', 'crunch', 'eat', 'roll_loop',
    'mine_place', 'mine_arm', 'mine_boom', 'rage_transform', 'sword_swing1', 'sword_swing2', 'sword_swing3', 'sword_hit', 'fire_loop', 'stomp',
    'horror_music', 'glitch', 'scream_sting', 'teleport', 'clap_boom'],
};
// gods whose recordings do not exist yet: their voice/sfx files are not fetched at all (no 404s); every
// Sound.voice()/Sound.god() call simply stays silent. Remove the id here when assets/{voice,sfx}/<id>/ is filled.
const GOD_AUDIO_PENDING = new Set([]);   // every god's recordings exist (Cookie Monster: tools/audio/cookie_voice.py + cookie_sfx.py)
// lines only one god ships (Bacchus burps and hiccups)
const GOD_VOICE_EXTRA = { bacchus: { belch: ['belch'], hic: ['hic'] },
  cookie: { passive_eat: ['passive_eat_1', 'passive_eat_2'], q: ['q_1', 'q_2'], e_in: ['e_in'], e_out: ['e_out'], r: ['r_1', 'r_2'],
    g_clap_line: ['g_clap_line'],
    // Cookie Horror (G, v14, tools/audio/cookie_horror14.py --render): every whisper lives in g_horror_whisper.mp3, every
    // name scream in g_scream.mp3. g_coming_<god>: "<NAME>... Cookie Monster is coming for youuuu..." (creepy whisper);
    // g_name_<god>: Cookie Monster SCREAMS the name (ullr = "Bowelius"; _any = no name / "YOU!!!")
    g_coming_thoth: ['g_horror_whisper@0.340+4.738'], g_coming_skadi: ['g_horror_whisper@5.408+4.464'], g_coming_bastet: ['g_horror_whisper@10.202+5.063'],
    g_coming_hecate: ['g_horror_whisper@15.595+4.498'], g_coming_ra: ['g_horror_whisper@20.423+4.738'], g_coming_bacchus: ['g_horror_whisper@25.491+4.330'],
    g_coming_ullr: ['g_horror_whisper@30.151+4.993'], g_coming_any: ['g_horror_whisper@35.474+4.176'],
    g_name_thoth: ['g_scream@0.340+1.770'], g_name_skadi: ['g_scream@2.440+1.885'], g_name_bastet: ['g_scream@4.655+1.980'], g_name_hecate: ['g_scream@6.965+1.905'],
    g_name_ra: ['g_scream@9.200+1.770'], g_name_bacchus: ['g_scream@11.300+2.838'], g_name_ullr: ['g_scream@14.468+2.065'], g_name_any: ['g_scream@16.863+1.800'],
    g_horror_whisper: ['g_horror_whisper@35.474+4.176'], g_scream: ['g_scream@16.863+1.800'],   // the old keys = the _any takes
    // Cookie Rage (F): every take lives in ONE sprite, f_roar.mp3 (file@offset+duration, tools/audio/cookie_voice3.py --render)
    f_roar: ['f_roar@0.34+2.71', 'f_roar@3.38+3.085'],                                      // "RAAARGH! COOKIIIES!!!" / "GRAAAH! MY! COOKIES!!!"
    f_cry: ['f_roar@6.795+1.215', 'f_roar@8.34+0.98', 'f_roar@9.65+1.015', 'f_roar@10.995+1.385', 'f_roar@12.71+1.3', 'f_roar@14.34+1.14'],
    //      COOKIES! / MINE! / CRUMBLE! / NO SHARING! / GIVE THEM BACK! / RAAAH!
    f_slam: ['f_roar@15.81+2.205', 'f_roar@18.345+2.37', 'f_roar@21.045+1.65'],             // "ALL! THE! COOKIES!!!" x2 / "COOOKIIIEEES!!!"
    f_end: ['f_roar@23.025+3.725'] },                                                         // "...huff... more... cookies..."

  // Ullr: the axe scream (every Thrown Axe), the stance swap line, and a few takes of the passive shout
  ullr: { axe_scream: ['axe_scream_1', 'axe_scream_2', 'axe_scream_3'], stance: ['stance_1', 'stance_2'], 
    // the troll round: a groan on a miss, a yelp on a self-bonk, an "oof" on a bad landing, a startled "eep" when his own arrow
    // lands at his feet, and a loser line after the clown dance
    miss: ['miss_1', 'miss_2', 'miss_3', 'miss_4'], bonk: ['bonk_1', 'bonk_2', 'bonk_3'], oof: ['oof_1', 'oof_2'], yelp: ['yelp_1', 'yelp_2'], loser: ['loser_1', 'loser_2', 'loser_3'],
    clown_laugh: ['clown_laugh_1', 'clown_laugh_2', 'clown_laugh_3'], clown_taunt: ['clown_taunt_1', 'clown_taunt_2'] } };   // the clown voice (fin_roar's speaker)
// a voice entry is a file stem, or a slice of one: 'file@offset+duration' (seconds) - several lines packed into one file
const voiceFile = (n) => { const i = n.indexOf('@'); return i < 0 ? n : n.slice(0, i); };
const voiceSlice = (n) => { const m = /@([\d.]+)\+([\d.]+)$/.exec(n); return m ? { off: +m[1], dur: +m[2] } : null; };
const Sound = {
  ctx: null, master: null, sfxBus: null, duck: null, voiceBus: null, musicBus: null, musicDuck: null, ambBus: null,
  sfx: {}, vox: {}, gsfx: {}, lines: VOICE_LINES, banks: {}, godId: null, musicBuf: null, music: null, loading: null, started: false, muted: false,
  voiceNow: null, lastVoice: {}, lastHit: 0, basicI: 0, shotI: 0, ultCh: null, hum: null, noiseBuf: null,
  ensureCtx() {
    if (this.ctx) return this.ctx;
    if (this.dead) return null;   // the game was quit
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : settings.volume;
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -16; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.3; glue.knee.value = 8;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15; lim.knee.value = 0;
    this.master.connect(glue); glue.connect(lim); lim.connect(ctx.destination);
    // effects duck under Thoth's voice (gain + a cut where speech lives)
    this.duck = ctx.createGain();
    this.duckEQ = ctx.createBiquadFilter(); this.duckEQ.type = 'peaking'; this.duckEQ.frequency.value = 1800; this.duckEQ.Q.value = 0.8; this.duckEQ.gain.value = 0;
    this.duck.connect(this.duckEQ); this.duckEQ.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.duck);
    this.boomBus = ctx.createGain(); this.boomBus.gain.value = 0.9; this.boomBus.connect(this.master);   // not ducked under the voice
    this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = 1.3; this.voiceBus.connect(this.master);
    this.musicDuck = ctx.createGain(); this.musicDuck.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55 * settings.music; this.musicBus.connect(this.musicDuck);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 1; this.ambBus.connect(this.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    return ctx;
  },
  // The context is created during loading (suspended until the first click) so every sample is
  // already decoded when the game starts.
  preload() {
    if (!this.ensureCtx()) return Promise.resolve();
    const get = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? this.ctx.decodeAudioData(b) : null)).catch(() => null);
    const jobs = [];
    for (const n of SFX_FILES) jobs.push(get(`assets/sfx/${n}.mp3`).then((b) => { if (b) this.sfx[n] = b; }));
    jobs.push(this.loadGod(settings.god || 'thoth'));
    jobs.push(get('assets/music/temple.mp3').then((b) => { if (b) { this.musicBuf = b; if (this.started) this.startMusic(); } }));
    this.loading = Promise.all(jobs);
    return this.loading;
  },
  // switch the voice + sound set to another god (only the active god's samples stay decoded)
  loadGod(id) {
    if (!this.ctx) return Promise.resolve();
    if (this.godId === id && this.godLoading) return this.godLoading;
    this.godId = id;
    if (id === 'thoth') { this.lines = VOICE_LINES; this.gsfx = {}; this.godLoading = this.loadVoicePack(settings.voice); return this.godLoading; }
    this.godLoading = (this.banks[id] || this.fetchBank(id)).then((b) => { if (this.godId === id) { this.vox = b.vox; this.gsfx = b.gsfx; this.lines = b.lines; this.pack = id; } });
    return this.godLoading;
  },
  // a god's voice lines and own samples, decoded: { gsfx, vox, lines } (Thoth's effects are the shared Sound.sfx)
  fetchBank(id) {
    const get = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b && this.ctx ? this.ctx.decodeAudioData(b) : null)).catch(() => null);
    const vox = {}, gsfx = {};
    if (id === 'thoth') {
      const names = [...new Set(Object.values(VOICE_LINES).flat())];
      return Promise.all(names.map((n) => get(SHARED_VOICE.has(n) ? `assets/voice/${n}.mp3` : `assets/voice/thoth/${n}.mp3`).then((b) => { if (b) vox[n] = b; })))
        .then(() => ({ gsfx, vox, lines: VOICE_LINES }));
    }
    const skip = GOD_VOICE_SKIP[id] || [];
    const lines = { ...GOD_VOICE_LINES, ...(GOD_VOICE_EXTRA[id] || {}) };
    const names = GOD_AUDIO_PENDING.has(id) ? [] : [...new Set(Object.values(lines).flat().map(voiceFile))].filter((n) => !skip.includes(n));
    const sfxNames = GOD_AUDIO_PENDING.has(id) ? [] : (GOD_SFX[id] || []);
    return Promise.all([
      ...names.map((n) => get(`assets/voice/${id}/${n}.mp3`).then((b) => { if (b) vox[n] = b; })),
      ...sfxNames.map((n) => get(`assets/sfx/${id}/${n}.mp3`).then((b) => { if (b) gsfx[n] = b; })),
    ]).then(() => ({ gsfx, vox, lines }));
  },
  // the other players' gods online (RemoteActor): each god's bank decoded once and kept (my own Thoth's voice is shared)
  loadBank(id) {
    if (!this.ctx) return Promise.resolve({ gsfx: {}, vox: {}, lines: {} });
    if (!this.banks[id] && id === 'thoth' && this.godId === 'thoth' && this.pack === 'thoth' && Object.keys(this.vox).length) this.banks[id] = Promise.resolve({ gsfx: {}, vox: this.vox, lines: VOICE_LINES });
    return this.banks[id] || (this.banks[id] = this.fetchBank(id));
  },
  // decode only the chosen pack (all three at once would cost ~250 MB of PCM)
  loadVoicePack(pack) {
    if (!this.ctx) return Promise.resolve();
    if (!VOICE_PACKS[pack]) pack = 'thoth';
    const get = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? this.ctx.decodeAudioData(b) : null)).catch(() => null);
    this.packLoading = pack;
    const names = [...new Set(Object.values(VOICE_LINES).flat().map(voiceFile))];
    const next = {};
    return Promise.all(names.map((n) => get(SHARED_VOICE.has(n) ? `assets/voice/${n}.mp3` : `assets/voice/${pack}/${n}.mp3`).then((b) => { if (b) next[n] = b; })))
      .then(() => { if (this.packLoading === pack) { this.vox = next; this.pack = pack; } });
  },
  init() {
    if (!this.ensureCtx()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.started) return;
    this.started = true;
    this.startMusic();
    this.ambient();
    this.startHum();
    this.voice('awaken', { priority: 2, delay: 1.0, cooldown: 0 });
  },
  setVolume(v) { if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05); },
  setMusic(v) { if (this.musicBus) this.musicBus.gain.setTargetAtTime(0.55 * v, this.ctx.currentTime, 0.1); },
  toggleMute() { this.muted = !this.muted; this.setVolume(settings.volume); return this.muted; },
  // quit: every sound stops for good (music, ambience, loops); only a reload brings them back
  shutdown() {
    this.dead = true; this.muted = true;
    const c = this.ctx; this.ctx = null; this.music = null;
    if (c) c.close().catch(() => {});
  },

  // ---- music -----------------------------------------------------------------
  startMusic() {
    if (!this.musicBuf || this.music || !this.ctx) return;
    const buf = this.musicBuf, d = buf.getChannelData(0);
    // loop between the first and last audible samples (skips any decoder padding)
    let a = 0, b = d.length - 1;
    while (a < d.length && Math.abs(d[a]) < 1e-4) a++;
    while (b > a && Math.abs(d[b]) < 1e-4) b--;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = a / buf.sampleRate; src.loopEnd = (b + 1) / buf.sampleRate;
    const fade = this.ctx.createGain(); const t = this.ctx.currentTime;
    fade.gain.setValueAtTime(0.0001, t); fade.gain.exponentialRampToValueAtTime(1, t + 5);
    src.connect(fade); fade.connect(this.musicBus);
    src.start(t, src.loopStart);
    this.music = src;
  },
  duckMusic(level, hold, release = 1.2) {
    if (!this.musicDuck || Net.ctx) return;   // (another player's cast never ducks my music: 14n_net.js)
    const g = this.musicDuck.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(level, t, 0.06); g.setTargetAtTime(1, t + hold, release);
  },

  // where a world position sits in the stereo field (relative to the camera) and how far away it is
  spatial(pos) {
    if (!pos) return { pan: 0, gain: 1 };
    const right = (this._sr || (this._sr = new THREE.Vector3())).set(1, 0, 0).applyQuaternion(camera.quaternion);
    const d = (this._sd || (this._sd = new THREE.Vector3())).copy(pos).sub(camera.position), dist = d.length() || 1;
    return { pan: clamp(d.dot(right) / dist, -1, 1) * 0.75, gain: clamp(1.25 / (1 + dist / 16), 0.25, 1) };
  },

  // ---- samples ---------------------------------------------------------------
  play(name, { gain = 1, rate = 1, delay = 0, pan = 0, bus = null } = {}) {
    const buf = this.sfx[name];
    if (!buf || !this.ctx || this.muted) return null;
    if (Net.ctx && !pan) { const sp = this.spatial(Net.ctx.pos); pan = sp.pan; gain *= sp.gain; Net.ctx.sfx++; }   // (another player's: where it stands)
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g);
    let node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(bus || this.sfxBus);
    src.start(t0);
    return {
      src, g,
      stop: (fade = 0.12) => {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + fade);
        try { src.stop(t + fade + 0.02); } catch (e) { /* already stopped */ }
      },
    };
  },
  tone(f, f1, dur, gain, type = 'sine') { // tiny UI blips
    if (!this.ctx || this.muted || Net.ctx) return;
    const t0 = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t0); o.stop(t0 + dur + 0.02);
  },

  // ---- voice -----------------------------------------------------------------
  // one line at a time; a higher priority line cuts in (with a short fade) and effects duck under it
  // offset: start this far into the line (skip its first sentence); cut: fade it out after this many seconds;
  // hold: how long the words last (other lines wait for it; the echo tail may be talked over)
  voice(group, { chance = 1, priority = 1, gain = 1, cooldown = 4, delay = 0, offset = 0, cut = 0, hold = 0 } = {}) {
    if (!this.ctx || this.muted) return false;
    if (Net.ctx) return Net.voice(group, { chance, priority, gain, cooldown, delay });   // (another player's god speaks where it stands)
    const now = this.ctx.currentTime, t0 = now + delay;
    if (Math.random() > chance) return false;
    if ((this.lastVoice[group] || -99) + cooldown > now && priority < 3) return false;
    const cur = this.voiceNow;
    if (cur && cur.end > t0 && cur.priority >= priority) return false;
    const opts = ((this.lines || VOICE_LINES)[group] || []).filter((n) => this.vox[voiceFile(n)]);
    if (!opts.length) return false;
    if (cur && cur.end > t0) { cur.g.gain.cancelScheduledValues(t0); cur.g.gain.setTargetAtTime(0.0001, t0, 0.04); try { cur.src.stop(t0 + 0.3); } catch (e) { /* stopped */ } }
    const name = pick(opts), buf = this.vox[voiceFile(name)];
    const sl = voiceSlice(name), base = sl ? Math.min(sl.off, buf.duration) : 0, len = sl ? Math.max(0.05, Math.min(sl.dur, buf.duration - base)) : buf.duration;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(this.voiceBus);
    if (sl) src.start(t0, base + Math.min(offset, len * 0.9), len - Math.min(offset, len * 0.9));
    else src.start(t0, Math.min(offset, buf.duration * 0.9));
    if (cut > 0) { g.gain.setValueAtTime(gain, t0 + cut); g.gain.linearRampToValueAtTime(0.0001, t0 + cut + 0.35); try { src.stop(t0 + cut + 0.4); } catch (e) { /* stopped */ } }
    // the processed lines carry long echo tails: duck only for the spoken part
    const spoken = cut > 0 ? cut : hold > 0 ? hold : Math.min(len - offset, priority >= 4 ? 2.6 : 1.8), end = t0 + spoken;
    const depth = priority >= 3 ? 0.45 : 0.6, eqCut = priority >= 3 ? -8 : -6;
    this.duck.gain.cancelScheduledValues(t0); this.duckEQ.gain.cancelScheduledValues(t0);
    this.duck.gain.setTargetAtTime(depth, t0, 0.02); this.duckEQ.gain.setTargetAtTime(eqCut, t0, 0.02);
    this.duck.gain.setTargetAtTime(1, end, 0.35); this.duckEQ.gain.setTargetAtTime(0, end, 0.35);
    this.voiceNow = { src, g, end: t0 + (cut > 0 ? cut : hold > 0 ? hold : Math.min((len - offset) * 0.6, priority >= 4 ? 2.8 : 2.2)), priority }; // echo tails may be cut
    this.lastVoice[group] = now;
    return true;
  },

  // ---- the active god's own samples: Sound.god('pc_throw', { gain, pos, loop, dur, delay, rate, shared, noDuck })
  god(name, o = {}) {
    const nc = Net.ctx;
    if (nc) {   // (another player's: where it stands; none from a hidden enemy, no new loop once its kit is gone)
      nc.sfx++; if (!o.pos) o = { ...o, pos: nc.pos };
      if (nc.hid || (nc.dead && (o.loop || o.dur))) return null;
    }
    const buf = o.shared ? this.sfx[name] : this.gsfx[name] || this.sfx[name];
    if (!buf || !this.ctx || this.muted) return null;
    const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
    const sp = o.pos ? this.spatial(o.pos) : { pan: 0, gain: 1 };
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1;
    if (o.loop || o.dur) { src.loop = true; }
    const vol = Math.max(0.001, (o.gain ?? 1) * (o.pos ? Math.max(0.45, sp.gain) : 1));
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g);
    let node = g;
    if (sp.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = sp.pan; g.connect(pn); node = pn; }
    node.connect(o.noDuck ? this.boomBus : this.sfxBus);
    if (o.loop || o.dur) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.25); }
    src.start(t0);
    const h = { src, g, stop: (fade = 0.2) => { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + fade); try { src.stop(t + fade + 0.02); } catch (e) { /* stopped */ } } };
    if (o.dur) setTimeout(() => h.stop(0.5), o.dur * 1000);
    if (nc && (o.loop || o.dur)) (nc.sounds || (nc.sounds = [])).push(h);   // (its kit goes: its loops stop with it, Net.dropCtx)
    return h;
  },
  step(p) { const n = `step${1 + Math.floor(Math.random() * 3)}`; if (this.gsfx[n]) this.god(n, { gain: 0.32, rate: rand(0.92, 1.08) }); },

  // ---- game events -------------------------------------------------------------
  basic() {
    this.play(`basic${1 + (this.basicI++ % 3)}`, { gain: 0.85, rate: rand(0.95, 1.05) });
    if (Math.random() < 0.08) this.voice('eff', { chance: 1, cooldown: 6 });
  },
  haCast() { this.play('ha_cast', { gain: 1.0 }); },
  haShot() { this.play(`ha_shot${1 + (this.shotI++ % 3)}`, { gain: 0.95, rate: rand(0.97, 1.03) }); },
  dash() { this.play('ep_dash', { gain: 0.95 }); this.voice('eff', { chance: 0.35, cooldown: 5 }); },
  empowerReady() { this.play('ep_ready', { gain: 0.8 }); },
  empowerShot() { this.play('ep_shot', { gain: 1.0 }); },
  glyphCast() { this.play('gp_cast', { gain: 1.0 }); },
  glyphWall() { this.play('ult_hit', { gain: 0.3, rate: 0.75 }); },
  empower() { this.play('gp_cross', { gain: 0.9 }); },
  ultStart() {
    this.stopUlt();
    this.ultCh = this.play('fj_channel', { gain: 1.0 });
    this.play('book_flutter', { gain: 0.6 });
    this.voice('fj_start', { priority: 3, delay: 0.12, gain: 1.05 });
    this.duckMusic(0.35, 3.2, 1.5);
  },
  stopUlt() { if (this.ultCh) { this.ultCh.stop(0.15); this.ultCh = null; } },
  ultPage(n) { this.play(`fj_page${clamp(n - 1, 1, 3)}`, { gain: 0.95 }); },
  // the SONIC BOOM + the dark, echoing "HOOOUUU" scream
  ultFire(frac, voiced = false) {
    this.stopUlt();
    this.play('fj_fire', { gain: 0.8 + 0.2 * frac });
    // released early (before the line was started): skip in so "WRITTEN" still lands on the blast
    if (!voiced) this.voice('fj_fire', { priority: 5, gain: 1.2, delay: 0.03, cooldown: 0, offset: 0.6, hold: 1.4 });
    this.duckMusic(0.15, 3.5, 2.0);
  },
  cancel() { this.stopUlt(); this.play('cancel', { gain: 0.9 }); this.duckMusic(1, 0); },
  hit(kind, pos) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.045) return; // many targets at once: one impact sound
    this.lastHit = now;
    const sp = this.spatial(pos), g = sp.gain, pan = sp.pan;
    if (kind === 'ult') { this.play('ult_hit', { gain: 0.85 * g, rate: rand(0.95, 1.05), pan }); return; }
    if (kind === 'wrath') { this.play('ult_hit', { gain: 0.75 * g, rate: rand(0.8, 0.92), pan }); return; }
    if (kind === 'basic') { if (Kit && Kit.id !== 'thoth') return; this.play(`basic_hit${1 + (Math.random() < 0.5 ? 0 : 1)}`, { gain: 0.7 * g, rate: rand(0.95, 1.08), pan }); return; }
    this.play(`basic_hit${1 + (Math.random() < 0.5 ? 0 : 1)}`, { gain: 0.85 * g, rate: kind === 'glyph' ? 0.86 : 0.92, pan });
    this.play('ult_hit', { gain: 0.26 * g, rate: 1.15, pan });
  },
  shatter(god, pos) { const sp = this.spatial(pos); this.play(god ? 'shatter_god' : 'shatter', { gain: 0.9 * sp.gain, rate: rand(0.95, 1.05), pan: sp.pan }); },
  jump() { this.play('jump', { gain: 0.7 }); },
  land() { this.play('land', { gain: 0.55 }); },
  deny() { this.tone(170, 0, 0.09, 0.04, 'square'); },
  arm() { this.tone(1400, 1800, 0.06, 0.03); },
  laugh() { this.voice('laugh', { priority: 2, cooldown: 0 }); },

  // ---- glide: an airy loop of magic (pad, breath, glitter) that swells with Thoth's speed ----
  startHum() {
    const ctx = this.ctx, buf = this.sfx.glide_loop;
    if (!buf) { if (this.loading) this.loading.then(() => { if (!this.hum && this.sfx.glide_loop) this.startHum(); }); return; }
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(lp); lp.connect(g); g.connect(this.sfxBus); s.start();
    this.hum = { g, lp };
  },
  glide(v) {
    if (!this.hum) return;
    const t = this.ctx.currentTime;
    this.hum.g.gain.setTargetAtTime(this.muted ? 0 : v * 0.4, t, 0.18);
    this.hum.lp.frequency.setTargetAtTime(1800 + v * 5000, t, 0.25);
  },

  // ---- night wind + braziers ---------------------------------------------------
  ambient() {
    const ctx = this.ctx;
    for (const [f, q, gv, rate] of [[380, 0.6, 0.03, 0.07], [1100, 1.2, 0.01, 0.11]]) {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gv;
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = gv * 0.7; lfo.connect(lg); lg.connect(g.gain);
      s.connect(bp); bp.connect(g); g.connect(this.ambBus);
      s.start(); lfo.start();
    }
    const crackle = () => {
      if (!this.ctx) return;
      if (!this.muted) {
        const t0 = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = rand(1500, 4500);
        const g = ctx.createGain(), d = rand(0.02, 0.05);
        g.gain.setValueAtTime(rand(0.004, 0.016), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        s.connect(hp); hp.connect(g); g.connect(this.ambBus); s.start(t0, Math.random()); s.stop(t0 + d + 0.01);
      }
      setTimeout(crackle, rand(60, 420));
    };
    crackle();
  },
};
// ---- Arena 5v5 ---------------------------------------------------------------------------------
// Announcer lines: assets/voice/announcer/<key>.mp3. The arena's own effects: assets/sfx/arena/<name>.mp3.
// Until those recordings exist, ARENA_AUDIO_PENDING keeps them from being fetched (no 404s): the announcer
// stays silent (its text still shows) and the effects borrow the nearest existing sample (ARENA_SFX_FALLBACK).
// Set it to false when the folders are filled; a single missing file then only stays silent.
const ARENA_AUDIO_PENDING = false;
const ANNOUNCER_KEYS = ['first_blood', 'double_kill', 'triple_kill', 'killing_spree', 'victory', 'defeat', 'scales_rise', 'scales_won', 'sandstorm', 'siege_spawn', 'ankh'];
const ARENA_SFX = ['match_start', 'wave_spawn', 'minion_melee', 'minion_ranged', 'minion_death', 'portal_hit', 'portal_siege',
  'siege_spawn', 'siege_stomp', 'siege_death', 'fountain_zap', 'buff_pickup',
  'scarab_spawn', 'scarab_pickup', 'scales_rise', 'scales_tick', 'scales_won', 'sandstorm_wind', 'ankh_spawn', 'ankh_pickup',
  'level_up', 'player_death', 'respawn', 'kill_ping', 'victory', 'defeat'];
// [existing sample, gain, rate]
const ARENA_SFX_FALLBACK = {
  minion_melee: ['basic_hit1', 0.32, 0.8], minion_ranged: ['basic2', 0.25, 1.25], minion_hit: ['basic_hit2', 0.22, 1.1], minion_death: ['shatter', 0.35, 1.1],
  portal_hit: ['gp_cross', 0.7, 0.8], portal_siege: ['fs_impact', 0.9, 0.85], siege_spawn: ['fs_rise', 0.6, 0.8], siege_stomp: ['land', 0.9, 0.55], siege_death: ['shatter_god', 0.9, 0.7],
  fountain_zap: ['ult_hit', 0.5, 1.2], buff_pickup: ['ep_ready', 0.8, 0.9], scarab_pickup: ['ep_ready', 0.8, 1.25], scarab_spawn: ['book_flutter', 0.25, 1.4],
  scales_rise: ['fs_rise', 0.7, 1.0], scales_won: ['fs_impact', 0.8, 1.0], ankh_spawn: ['fs_rise', 0.45, 1.3], ankh_pickup: ['gp_cross', 0.9, 1.1],
  level_up: ['gp_cross', 0.55, 1.35], player_death: ['shatter_god', 0.8, 0.9], respawn: ['ep_ready', 0.8, 1.0], kill_ping: ['basic_hit1', 0.4, 1.3],
  wave_spawn: ['gp_cast', 0.25, 1.2], match_start: ['fs_rise', 0.6, 1.1], victory: ['fs_impact', 0.9, 1.0], defeat: ['fs_end', 0.9, 0.9],
};
// a few of each god's own samples for the bots (ten gods at once stay light in memory); Thoth's live in Sound.sfx
const BOT_SFX = {
  skadi: ['basic1', 'basic_hit1', 'pc_throw', 'pc_hit', 'kaldr_leap', 'wg_start', 'wg_root', 'th_howl', 'th_avalanche'],
  bastet: ['swipe1', 'swipe2', 'claw_hit1', 'pounce', 'pounce_land', 'claw_cast', 'cat_attack', 'huntress_cast', 'huntress_hit'],
  hecate: ['bolt1', 'bolt2', 'bolt_hit1', 'tf_power', 'se_drop', 'rm_shield', 'gate_open', 'gate_blast'],
  ra: ['orb1', 'orb_hit1', 'cb_strike', 'dl_burst', 'sb_cast', 'sp_fire'],
  bacchus: ['swing1', 'swing2', 'hit1', 'chug', 'flop_jump', 'flop_land', 'belch_wave', 'df_fart', 'df_toot2', 'df_toot5'],
  ullr: ['arrow_release', 'arrow_hit', 'arrow_plop', 'axe_throw', 'axe_hit', 'leap', 'leap_land', 'clown_honk', 'fart_toot2', 'bonk'],
};
Object.assign(Sound, {
  asfx: {}, ann: {}, bsfx: {}, arenaLoaded: false, botSoundT: 0, botSoundN: 0, windNode: null,
  fetchBuf(url) { return fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b && this.ctx ? this.ctx.decodeAudioData(b) : null)).catch(() => null); },
  // everything a match needs: the arena set + announcer (once), and the bots' borrowed god samples
  loadArena(godIds = []) {
    if (!this.ctx) return Promise.resolve();
    const jobs = [];
    if (!this.arenaLoaded && !ARENA_AUDIO_PENDING) {
      for (const n of ARENA_SFX) jobs.push(this.fetchBuf(`assets/sfx/arena/${n}.mp3`).then((b) => { if (b) this.asfx[n] = b; }));
      for (const k of ANNOUNCER_KEYS) jobs.push(this.fetchBuf(`assets/voice/announcer/${k}.mp3`).then((b) => { if (b) this.ann[k] = b; }));
    }
    this.arenaLoaded = true;
    for (const id of new Set(godIds)) {
      if (id === 'thoth' || this.bsfx[id] || GOD_AUDIO_PENDING.has(id)) continue;
      const set = this.bsfx[id] = {};
      for (const n of BOT_SFX[id] || []) jobs.push(this.fetchBuf(`assets/sfx/${id}/${n}.mp3`).then((b) => { if (b) set[n] = b; }));
    }
    return Promise.all(jobs);
  },
  // play a decoded buffer: { gain, rate, pos (spatial), falloff (metres for half volume), bus, loop, off + len (a slice of a sprite) }
  playBuf(buf, o = {}) {
    if (!buf || !this.ctx || this.muted) return null;
    const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
    let gain = o.gain ?? 1, pan = 0;
    if (o.pos) {
      const sp = this.spatial(o.pos), d = camera.position.distanceTo(o.pos), half = o.falloff ?? 16;
      if (o.maxDist && d > o.maxDist) return null;
      gain *= clamp(1.3 / (1 + d / half), 0.08, 1); pan = sp.pan;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1; src.loop = !!o.loop;
    const g = ctx.createGain(); g.gain.value = Math.max(0.0001, gain); src.connect(g);
    let node = g;
    if (pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); node = pn; }
    node.connect(o.bus || this.sfxBus);
    if (o.len > 0) src.start(t0, o.off || 0, o.len); else src.start(t0, o.off || 0);
    return { src, g, stop: (fade = 0.2) => { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + fade); try { src.stop(t + fade + 0.02); } catch (e) { /* stopped */ } } };
  },
  // the arena's own effects: Sound.arena('portal_hit', { pos, gain })
  arena(name, o = {}) {
    if (!this.ctx || this.muted) return null;
    const own = this.asfx[name];
    if (own) return this.playBuf(own, o);
    const fb = ARENA_SFX_FALLBACK[name];
    if (!fb || !this.sfx[fb[0]]) return null;
    return this.playBuf(this.sfx[fb[0]], { ...o, gain: (o.gain ?? 1) * fb[1], rate: (o.rate ?? 1) * fb[2] });
  },
  // a bot god's ability sound (its own sample set, quieter and shorter-ranged than the player's, and rate-limited)
  bot(god, name, o = {}) {
    if (!this.ctx || this.muted || !name) return null;
    const now = this.ctx.currentTime;
    if (now - this.botSoundT > 0.25) { this.botSoundT = now; this.botSoundN = 0; }
    if (this.botSoundN >= 4 && !o.big) return null;
    const buf = god === 'thoth' ? this.sfx[name] : (this.bsfx[god] || {})[name];
    if (!buf) return null;
    this.botSoundN++;
    return this.playBuf(buf, { falloff: 10, maxDist: 55, ...o, gain: (o.gain ?? 0.55) });
  },
  // the announcer (falls silent - the on-screen text remains - while assets/voice/announcer/ is empty)
  announce(key, o = {}) {
    const buf = this.ann[key];
    if (!buf || !this.ctx || this.muted) return false;
    const h = this.playBuf(buf, { gain: o.gain ?? 1.15, bus: this.voiceBus });
    if (h) { const t = this.ctx.currentTime; this.duck.gain.cancelScheduledValues(t); this.duck.gain.setTargetAtTime(0.55, t, 0.03); this.duck.gain.setTargetAtTime(1, t + Math.min(2.2, buf.duration), 0.3); }
    return !!h;
  },
  // Set's sandstorm: the recorded wind if there is one, else a synthesized howl of filtered noise
  wind(on) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (on && !this.windNode) {
      if (this.asfx.sandstorm_wind) { const h = this.playBuf(this.asfx.sandstorm_wind, { gain: 0.0001, loop: true }); if (h) { h.g.gain.setTargetAtTime(0.7, t, 1.2); this.windNode = h; } return; }
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.9;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency);
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.16, t, 1.5);
      s.connect(bp); bp.connect(g); g.connect(this.ambBus); s.start(); lfo.start();
      this.windNode = { g, stop: (f = 2) => { const t1 = ctx.currentTime; g.gain.cancelScheduledValues(t1); g.gain.setTargetAtTime(0.0001, t1, f / 3); try { s.stop(t1 + f + 0.1); lfo.stop(t1 + f + 0.1); } catch (e) { /* stopped */ } } };
    } else if (!on && this.windNode) { this.windNode.stop(2.5); this.windNode = null; }
  },
});

// never keep playing in the background: a hidden tab (switched away, minimized) goes silent
document.addEventListener('visibilitychange', () => {
  const c = Sound.ctx;
  if (!c || c.state === 'closed') return;
  if (document.hidden) c.suspend().catch(() => {});
  else if (Sound.started) c.resume().catch(() => {});
});
addEventListener('pagehide', () => { if (Sound.ctx && Sound.ctx.state === 'running') Sound.ctx.suspend().catch(() => {}); });


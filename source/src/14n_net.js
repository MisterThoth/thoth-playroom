// ============================================================================
// Online med venner (Arena 5v5 only). A Net facade over two transports with one interface:
//   p2p (default)  Trystero over public Nostr relays, WebRTC data channels in a full mesh; the vendored
//                  module is imported on demand, so single player never loads it
//   mem (?net=mem) a BroadcastChannel loopback for tests and local dev (?lat=ms&jitter=ms&drop=pct)
// Every peer broadcasts ONE state object: name, god, team, ready, role ... plus a seq-numbered ring of the
// last second's events. The host's state also carries the match header m (and in a match its world: see the shared
// Arena match below the facade). Host = the room's creator; when it leaves, the present peer with the smallest id
// takes over (every client reaches the same answer).
// Single player never gets here: Net.online stays false, nothing is imported and nothing is sent.
// ============================================================================
const NET_V = 'tp2-v31';                            // (v31: Cookie Monster in the god list, the K kit event)
const NET_V_PAD = '';                            // protocol + build: a mismatch is shown in the lobby and blocks Start
const NET_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  // room codes (no 0/O, 1/I/L)
const NET_TEAMS = ['Blue team', 'Red team'];
const NET_MAX_TEAM = 5;
const NET_RING_MAX = 240;   // events waiting in my ring at most (each rides >= 1 s and >= 3 states; ~30 bytes each)
const NET_SITE = 'https://misterthoth.github.io/thoth-playroom/';   // the public website (online play works there)
const NET_LONELY = 20000;   // ms: a joiner that has met nobody by then gets the help text
const netRand = (n, abc = 'abcdefghijklmnopqrstuvwxyz0123456789') => { let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(n))) s += abc[b % abc.length]; return s; };
const netCleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
const netCodeOk = (c) => typeof c === 'string' && c.length === 4 && [...c].every((ch) => NET_ABC.includes(ch));
const netEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const netName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);

// ---- transports: { kind, selfId, staleMs, aloneMs, join(code), send(data, to?), peers(), forget(id), leave() }
// and the callbacks onMessage(data, peerId), onPeerJoin(peerId), onPeerLeave(peerId)
class MemBackend {
  constructor(o = {}) {
    this.kind = 'mem'; this.selfId = /^m[a-z0-9]{1,15}$/.test(o.id || '') ? o.id : 'm' + netRand(11);   // (?netid= in tests: a known order of ids)
    this.lat = o.lat || 0; this.jitter = o.jitter || 0; this.drop = o.drop || 0;
    this.staleMs = 8000; this.aloneMs = 2000;   // (a closed tab says bye; a crashed or frozen one is gone after 8 s of silence)
    this.known = new Set(); this.gone = new Set(); this.dueT = 0; this.ch = null; this.hb = null;
    this.onMessage = this.onPeerJoin = this.onPeerLeave = this.onAlive = null;
  }
  async join(code) {
    const name = 'thoth-net-' + code;
    this.ch = new BroadcastChannel(name);
    this.ch.onmessage = (e) => this.recv(e.data);
    this.post({ k: 'hi' });
    // a heartbeat from a worker: a tab that is busy (loading the arena) or hidden is still here; a closed one stops
    try {
      const src = `const c = new BroadcastChannel(${JSON.stringify(name)}); setInterval(() => c.postMessage({ k: 'hb', f: ${JSON.stringify(this.selfId)}, to: null }), 1000);`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const w = new Worker(url);
      this.hb = () => { w.terminate(); URL.revokeObjectURL(url); };
    } catch (e) { /* the 1 Hz keepalive state is enough */ }
  }
  post(m, to = null) { if (this.ch) this.ch.postMessage({ ...m, f: this.selfId, to }); }
  send(data, to = null) { this.post({ k: 'd', d: data }, to); }
  recv(m) {
    if (!m || m.f === this.selfId || (m.to && m.to !== this.selfId) || this.gone.has(m.f)) return;
    if (m.k === 'd' && this.drop > 0 && Math.random() * 100 < this.drop) return;
    const now = performance.now(), delay = this.lat + Math.random() * this.jitter;
    if (delay <= 0 && this.dueT <= now) return this.dispatch(m);
    // in order, like a reliable data channel: never before the message ahead of it
    const due = Math.max(now + delay, this.dueT); this.dueT = due;
    setTimeout(() => this.dispatch(m), due - now);
  }
  dispatch(m) {
    if (!this.ch) return;
    const id = m.f;
    if (this.gone.has(id)) return;
    if (m.k === 'bye') { this.gone.add(id); if (this.known.delete(id)) this.onPeerLeave?.(id); return; }
    if (m.k === 'hb') { if (this.known.has(id)) this.onAlive?.(id); return; }
    if (!this.known.has(id)) { this.known.add(id); this.onPeerJoin?.(id); }
    if (m.k === 'hi') this.post({ k: 'ho' }, id);   // answer, so the newcomer learns of us too
    else if (m.k === 'd') this.onMessage?.(m.d, id);
  }
  peers() { return [...this.known]; }
  forget(id) { this.known.delete(id); }
  async leave() {
    if (this.hb) { this.hb(); this.hb = null; }
    this.post({ k: 'bye' }); try { this.ch.close(); } catch (e) { /* closed */ } this.ch = null; this.known.clear();
  }
}
// p2p (Trystero 0.25.4, nostr): joinRoom(config, roomId, callbacks) -> room; room.makeAction('p') -> { send(data,
// { target }) (a promise), onMessage = (data, { peerId }) }; room.onPeerJoin / onPeerLeave = (peerId); room.getPeers()
// (peerId -> RTCPeerConnection); room.leave(); the module's selfId and getRelaySockets() (url -> WebSocket). Optional:
// our own Nostr relays (relayConfig.urls, ?relays= or the lobby's Avansert) and TURN servers (turnConfig, ?turn=) for
// networks that block direct connections; callbacks.onJoinError when a peer was found but WebRTC could not connect
class P2PBackend {
  constructor(o = {}) {
    this.kind = 'p2p'; this.selfId = null; this.room = null; this.act = null; this.T = null;
    this.staleMs = 12000; this.aloneMs = 15000;   // (relays + WebRTC take a few seconds to find each other)
    this.relays = o.relays || []; this.turn = o.turn || []; this.joinErr = null; this.errs = 0;
    this.onMessage = this.onPeerJoin = this.onPeerLeave = this.onError = null;
  }
  async join(code) {
    const T = this.T = await import('./vendor/trystero/trystero-nostr.min.js');
    this.selfId = T.selfId;
    const cfg = { appId: 'thoth-playroom-v1' };
    if (this.relays.length) cfg.relayConfig = { urls: this.relays };
    if (this.turn.length) cfg.turnConfig = this.turn;
    const go = () => T.joinRoom(cfg, 'thoth-' + code.toLowerCase(), { onJoinError: (d) => { this.joinErr = d; this.errs++; this.onError?.(d); } });
    this.room = go();
    // (trystero hands back a room until its leave is done: the one just left would be a dead one)
    if (this.room && this.room === P2PBackend.left) { await new Promise((r) => setTimeout(r, 150)); this.room = go(); }
    this.act = this.room.makeAction('p');
    this.act.onMessage = (d, meta) => this.onMessage?.(d, meta && typeof meta === 'object' ? meta.peerId : meta);
    this.room.onPeerJoin = (id) => this.onPeerJoin?.(id);
    this.room.onPeerLeave = (id) => this.onPeerLeave?.(id);
  }
  send(data, to = null) {
    if (!this.act) return;
    try { const p = this.act.send(data, to ? { target: to } : {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* peer gone */ }
  }
  peers() { try { return Object.keys(this.room?.getPeers() || {}); } catch (e) { return []; } }
  forget() { /* trystero tracks its own peers */ }
  // the signalling relays this page reaches: open sockets of all
  relayState() {
    try { const s = Object.values(this.T?.getRelaySockets?.() || {}); return { open: s.filter((w) => w && w.readyState === 1).length, all: s.length }; } catch (e) { return { open: 0, all: 0 }; }
  }
  async leave() { const r = this.room; this.room = null; this.act = null; if (r) P2PBackend.left = r; try { await r?.leave(); } catch (e) { /* gone */ } }
}
P2PBackend.left = null;

// p2p with a fallback: peers meet on public MQTT brokers (MQTT over WebSocket, mqtt.js 5.15.2) as well as through
// Trystero. A peer whose WebRTC connection opens is reached directly; any other (a router or network that blocks
// direct connections) gets the same messages through the brokers. Two brokers at once, so one being down changes
// nothing; every relayed message carries the sender's counter, and a copy that arrives twice is dropped.
const NET_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
class HybridBackend {
  constructor(o = {}) {
    this.kind = 'p2p'; this.selfId = null;
    this.p2p = new P2PBackend(o);
    this.brokers = o.brokers && o.brokers.length ? o.brokers : NET_BROKERS;
    this.staleMs = 12000; this.aloneMs = 15000;
    this.known = new Set(); this.direct = new Set(); this.gone = new Set(); this.last = new Map();
    this.clients = []; this.topic = ''; this.n = 0; this.hb = null; this.sid = netRand(6);   // (sid: this join; a page that rejoins counts from 1 again)
    this.onMessage = this.onPeerJoin = this.onPeerLeave = this.onAlive = this.onError = null;
  }
  async join(code) {
    const p = this.p2p;
    p.onMessage = (d, id) => { this.seen(id); this.onMessage?.(d, id); };
    p.onPeerJoin = (id) => { this.direct.add(id); this.seen(id); };
    p.onPeerLeave = (id) => { this.direct.delete(id); };   // (still reachable through the brokers until it says bye or falls silent)
    p.onError = () => {};   // (no direct connection: the brokers carry it)
    await p.join(code);
    this.selfId = p.selfId;
    this.topic = 'thoth-playroom-v1/' + code.toLowerCase();
    try {
      const mqtt = await import('./vendor/mqtt/mqtt.esm.js');
      const connect = mqtt.connect || (mqtt.default && mqtt.default.connect);
      for (const url of this.brokers) {
        const c = connect(url, { clean: true, keepalive: 30, connectTimeout: 10000, reconnectPeriod: 3000, clientId: 'tp' + netRand(14) });
        c.on('connect', () => { c.subscribe(this.topic, { qos: 0 }); this.pub({ k: 'hi' }, null, c); });
        c.on('message', (t, buf) => this.recv(buf));
        c.on('error', () => {});
        this.clients.push(c);
      }
    } catch (e) { console.warn('[net] mqtt', e); }
    this.hb = setInterval(() => this.pub({ k: 'hb' }), 2000);
  }
  pub(m, to = null, only = null) {
    const s = JSON.stringify({ ...m, f: this.selfId, s: this.sid, to, n: ++this.n });
    for (const c of only ? [only] : this.clients) if (c.connected) { try { c.publish(this.topic, s, { qos: 0 }); } catch (e) { /* reconnecting */ } }
  }
  send(data, to = null) {
    if (to) { if (this.direct.has(to)) this.p2p.send(data, to); else this.pub({ k: 'd', d: data }, to); return; }
    if (this.direct.size) this.p2p.send(data);
    if ([...this.known].some((id) => !this.direct.has(id))) this.pub({ k: 'd', d: data, x: [...this.direct] });
  }
  recv(buf) {
    let m; try { m = JSON.parse(typeof buf === 'string' ? buf : new TextDecoder().decode(buf)); } catch (e) { return; }
    if (!m || typeof m.f !== 'string' || m.f === this.selfId || (m.to && m.to !== this.selfId)) return;
    if (this.gone.has(m.f)) { if (m.k !== 'hi') return; this.gone.delete(m.f); }   // (a page that left and joined again)
    if (Array.isArray(m.x) && m.x.includes(this.selfId)) return;   // (it reached me directly)
    const n = +m.n || 0, key = m.f + '/' + m.s; if (n <= (this.last.get(key) || 0)) return;   // (the copy from the other broker)
    this.last.set(key, n);
    const id = m.f;
    if (m.k === 'bye') { this.gone.add(id); this.direct.delete(id); if (this.known.delete(id)) this.onPeerLeave?.(id); return; }
    if (m.k === 'hb') { if (this.known.has(id)) this.onAlive?.(id); else this.seen(id); return; }
    this.seen(id);
    if (m.k === 'hi') this.pub({ k: 'ho' }, id);   // answer, so the newcomer learns of us too
    else if (m.k === 'd') this.onMessage?.(m.d, id);
  }
  seen(id) { if (this.gone.has(id)) return; if (!this.known.has(id)) { this.known.add(id); this.onPeerJoin?.(id); } else this.onAlive?.(id); }
  peers() { return [...this.known]; }
  forget(id) { this.known.delete(id); this.direct.delete(id); }
  relayState() { const r = this.p2p.relayState(); return { open: r.open + this.clients.filter((c) => c.connected).length, all: r.all + this.clients.length }; }
  async leave() {
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    this.pub({ k: 'bye' });
    const cs = this.clients; this.clients = []; this.known.clear(); this.direct.clear();
    setTimeout(() => { for (const c of cs) { try { c.end(true); } catch (e) { /* closed */ } } }, 300);
    await this.p2p.leave();
  }
}

// ---- the facade
const Net = {
  online: false, joining: false, backend: null, kind: null, code: null, me: null,
  isHost: false, hostId: null, epoch: 0, sawHost: false, joinT: 0,
  st: null,                 // my state object: what every other peer sees of me
  peers: new Map(),         // peerId -> { id, st, at, ms, seen, offs, off, rtt, first, sig }
  ring: [], seq: 0, handlers: {},
  match: null, lastMatchId: null, myTeam: 0, mySlot: 0, myUid: -1,   // the running match's header and my place in it
  dirty: false, lastSend: 0, tickAt: 0, pingAt: 0, rafAt: 0, pump: null, abortLoad: false, tmAuto: false,
  stats: { sent: 0, recv: 0, bytes: 0, maxBytes: 0, gaps: 0, events: 0, times: [] },
  q: new URLSearchParams(location.search),
  ui: null, uiDirty: false, uiAt: 0, msg: '', msgKind: '', msgT: 0,

  // ---------------------------------------------------------------- boot
  init() {
    const open = () => { const c = this.roomFromUrl(); if (c && !this.online && !this.joining) this.openWith(c); };
    addEventListener('hashchange', open);
    open();
  },
  roomFromUrl() {
    const h = /room=([A-Za-z0-9]{4})/.exec(location.hash);
    const c = netCleanCode(h ? h[1] : this.q.get('room'));
    return netCodeOk(c) ? c : null;
  },
  // a #room=CODE link: the lobby opens with the code filled in, and joins at once when we know the player's name
  openWith(code) {
    if (Game.mode !== 'menu' || Arena.active || Arena.loading) return;
    if (this.artifactHost()) { this.elsewhere(); return; }
    this.buildLobby();
    this.ui.code.value = code; this.invited = code;
    if (this.savedName()) { this.showLobby(); this.join(code); }
    else { this.flash('Enter a nickname and press “Join”'); this.showLobby(); this.ui.name.focus(); }
  },
  // the god I show the room: my chosen one, never an owner-only god I may not play (GodLock, 11z_gods.js) - then Thoth
  myGod() { const g = Kit ? Kit.id : settings.god; return GODS[g] && godAllowed(g) ? g : 'thoth'; },
  savedName() { let s = netName(this.q.get('name')); if (!s) { try { s = netName(localStorage.getItem('thoth-net-name')); } catch (e) { /* storage blocked */ } } return s; },
  nameFromField() {
    let n = netName(this.ui ? this.ui.name.value : '') || this.savedName();
    if (!n) n = 'Player ' + (10 + Math.floor(Math.random() * 90));
    if (this.ui) this.ui.name.value = n;
    try { localStorage.setItem('thoth-net-name', n); } catch (e) { /* storage blocked */ }
    return n;
  },

  // ---------------------------------------------------------------- joining and leaving
  create() { return this.join(netRand(4, NET_ABC), true); },
  async join(code, create = false) {
    if (this.online || this.joining) return false;
    code = netCleanCode(code);
    if (!netCodeOk(code)) { this.flash('The room code is four characters, e.g. K7QX', 'warn'); return false; }
    this.joining = true;
    if (this.leaving) { const l = this.leaving; await l; if (this.leaving === l) this.leaving = null; }   // (the last room is let go of first: p2p would hand back the one still closing)
    this.wire();   // (the shared match's events; nothing is sent until there is a match)
    this.tagScene();   // (another player's replayed kit marks what it adds to the scene: Net.leftovers)
    const name = this.nameFromField();
    this.flash('Connecting …'); this.renderLobby();
    try {
      const kind = this.q.get('net') === 'mem' ? 'mem' : 'p2p';
      const num = (k) => Math.max(0, parseFloat(this.q.get(k)) || 0);
      const b = kind === 'mem' ? new MemBackend({ lat: num('lat'), jitter: num('jitter'), drop: num('drop'), id: this.q.get('netid') }) : (this.q.get('net') === 'webrtc' ? new P2PBackend({ relays: this.relayList(), turn: this.turnList() }) : new HybridBackend({ relays: this.relayList(), turn: this.turnList(), brokers: (this.q.get('mqtt') || '').split(',').filter(Boolean) }));
      b.onError = () => { if (b instanceof P2PBackend) this.flash('Found a player but could not connect directly · your network or your friend’s is probably blocking direct connections (try another network, e.g. a phone hotspot)', 'warn'); };
      b.onMessage = (d, id) => this.onData(d, id);
      b.onPeerJoin = (id) => this.onPeerJoin(id);
      b.onPeerLeave = (id) => this.dropPeer(id);
      b.onAlive = (id) => { const p = this.peers.get(id); if (p) p.at = Math.max(p.at, performance.now()); };
      await b.join(code);
      const now = performance.now();
      Object.assign(this, { backend: b, kind, code, me: b.selfId, online: true, joinT: now, tickNow: 0, sawHost: create, hostId: create ? b.selfId : null, isHost: create,
        epoch: 0, ring: [], seq: 0, match: null, lastMatchId: null, myTeam: 0, mySlot: 0, myUid: -1, lastSend: 0, tickAt: 0, pingAt: now, abortLoad: false, tmAuto: !create,
        created: create, metAt: 0, aloneWarned: false, verWarned: new Set(), hostMid: null, migT: 0, dropped: new Map(), hostFar: null, yieldTo: null });
      this.peers.clear();
      this.stats = { sent: 0, recv: 0, bytes: 0, maxBytes: 0, gaps: 0, events: 0, times: [] };
      this.st = { v: NET_V, n: name, h: create ? 1 : 0, ct: create ? Date.now() : 0, ep: 0, rp: null, jt: Date.now(), g: this.myGod(), tm: 0, rd: 0, r: 'lobby', aw: 0, m: null,
        hf: create ? b.selfId : null, hc: 0, he: 0 };
      if (create) this.st.hc = this.st.ct;
      try { history.replaceState(null, '', this.inviteUrl(false)); } catch (e) { /* sandboxed */ }
      document.getElementById('app').classList.add('net-online');
      this.syncChrome();
      this.startPump();
      addEventListener('pagehide', this.onHide);
      this.msg = ''; this.msgT = 0;
      if (create) this.flash('Room is ready · send the link to your friends', 'ok');
      else this.flash(kind === 'p2p' ? 'Looking for the host …' : '');
      this.dirty = true; this.flush(true);
      this.showLobby();
      return true;
    } catch (e) {
      console.warn('[net] join', e);
      this.flash('Could not connect: ' + (e.message || e), 'warn');
      return false;
    } finally { this.joining = false; this.renderLobby(); }
  },
  onHide: () => Net.leave({ quiet: true }),
  // leave the room: quiet (quitting, closing the tab) skips the arena teardown and the lobby
  leave(o = {}) {
    if (!this.online) return;
    const b = this.backend;
    try { b.send({ k: 'bye' }); } catch (e) { /* gone */ }
    this.online = false; this.backend = null; this.isHost = false; this.hostId = null; this.st = null;
    this.match = null; this.ring = []; this.peers.clear(); this.resetWorld();
    if (this.hudEl) this.hudEl.hidden = true;   // (the match's corner goes with the room)
    const nn = Arena.ui && Arena.ui.end && Arena.ui.end.querySelector('.netNote'); if (nn) nn.textContent = '';
    try { this.leaving = Promise.resolve(b.leave()).catch(() => {}); } catch (e) { this.leaving = null; }   // (p2p: the next join waits for it)
    this.stopPump();
    removeEventListener('pagehide', this.onHide);
    document.getElementById('app').classList.remove('net-online');
    this.syncChrome();
    try { if (/room=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandboxed */ }
    if (o.quiet) return;
    if (Arena.loading) this.abortLoad = true;
    else if (Arena.active || Arena.waiting) Arena.exit();
    this.hideLobby();
  },
  // labels of the shared Arena controls while online (restart is the host's Start in the lobby)
  syncChrome() {
    const on = this.online;
    document.getElementById('app').classList.toggle('net-host', on && this.isHost);   // (online, only the host restarts a match)
    const a = document.querySelector('#menu .arenaRow .leave'); if (a) a.textContent = on ? 'Back to lobby' : 'Leave to menu';
    const e = document.querySelector('#arena .end .leave'); if (e) e.textContent = on ? 'Back to lobby' : 'To menu';
    // (the host's next match: the same room, everyone's current team and god; with new bots, or the same bots again)
    const g = document.querySelector('#arena .end .again'); if (g) g.textContent = on ? 'Play again' : 'New match';
    const s = document.querySelector('#arena .end .same'); if (s) s.textContent = on ? 'Same bots again' : 'Same teams again';
    this.endNote();
  },

  // ---------------------------------------------------------------- the wire
  // events: Net.emit('x', ...args) puts [seq, type, ms, ...args] in the ring; every peer runs Net.on('x', fn) handlers
  on(type, fn) { (this.handlers[type] || (this.handlers[type] = [])).push(fn); },
  emit(type, ...args) {
    if (!this.online) return;
    this.ring.push({ w: [++this.seq, type, Math.round(performance.now()), ...args], at: performance.now(), n: 0 });
    // (a storm of events, a page that cannot send: the oldest go first; the others count the gap)
    if (this.ring.length > NET_RING_MAX) { this.stats.ringDrop = (this.stats.ringDrop || 0) + this.ring.length - NET_RING_MAX; this.ring.splice(0, this.ring.length - NET_RING_MAX); }
    this.dirty = true;
  },
  set(patch) { if (this.st) { Object.assign(this.st, patch); this.dirty = true; } },
  // (the host's world snapshot and bot table ride once, in the next state sent to everyone)
  packet(now, keep = false) {
    const pk = { ...this.st, ms: Math.round(now), sq: this.seq, e: this.ring.map((x) => x.w) };
    if (!keep && this.wOut) { pk.w = this.wOut; this.wOut = null; }
    if (!keep && this.btOut) { pk.bt = this.btOut; this.btOut = null; }
    return pk;
  },
  count(pk) {
    const S = this.stats, now = performance.now();
    S.sent++; S.times.push(now); while (S.times.length && now - S.times[0] > 1000) S.times.shift();
    if (pk) { const n = JSON.stringify(pk).length; S.bytes += n; if (n > S.maxBytes) S.maxBytes = n; if (n > 8000) console.warn('[net] big state', n); }
  },
  // once per frame (and from the pump): at most one state per 50 ms (host) / 60 ms (others), only when something
  // changed or events are waiting; a keepalive every second
  flush(force = false) {
    if (!this.online || !this.backend) return;
    const now = performance.now();
    if (now - this.tickAt >= 100) { this.tickAt = now; this.tick(now); if (!this.online) return; }
    if (this.ring.length) this.ring = this.ring.filter((x) => now - x.at < 1000 || x.n < 3);
    const gap = now - this.lastSend;
    if (!force && (gap < (this.isHost ? 50 : 60) || !(this.dirty || this.ring.length || gap >= 1000))) return;
    if (this.poseDue && this.match && Arena.active) { this.poseDue = false; this.poseAt = now; this.st.s = this.sample(now); }   // (my pose, as fresh as can be)
    const pk = this.packet(now);
    this.backend.send(pk);
    this.count(pk);
    for (const x of this.ring) x.n++;
    this.lastSend = now; this.dirty = false;
  },
  onPeerJoin(id) {
    if (!this.online || id === this.me) return;
    this.peer(id);
    const pk = this.packet(performance.now(), true);   // the newcomer gets my state at once
    this.backend.send(pk, id); this.count(pk);
  },
  peer(id) {
    let p = this.peers.get(id);
    if (!p) { p = { id, st: null, at: performance.now(), ms: -1, seen: 0, offs: [], off: 0, rtt: 0, first: 0, sig: '' }; this.peers.set(id, p); }
    return p;
  },
  dropPeer(id, why = 'leave') {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (this.dropped) this.dropped.set(id, performance.now());
    this.note(`drop ${id} (${why})`);
    if (this.backend) this.backend.forget(id);
    if (p.st && this.online) this.flash(`${p.st.n} left the room`);
    this.uiDirty = true;
    if (this.online) this.elect(performance.now());
  },
  onData(d, id) {
    if (!this.online || !d || typeof d !== 'object' || id === this.me) return;
    const now = performance.now(), p = this.peer(id);
    p.at = now; this.stats.recv++;
    if (d.k === 'pi') { this.backend.send({ k: 'po', t: d.t }, id); this.count(); return; }
    if (d.k === 'po') { const r = now - d.t; p.rtt = p.rtt ? p.rtt * 0.7 + r * 0.3 : r; return; }
    if (d.k === 'bye') { this.dropPeer(id, 'bye'); return; }
    if (typeof d.ms !== 'number' || d.ms < p.ms) return;   // (late duplicate)
    // clock: one-way offset lower bound (my clock - theirs + latency), the minimum over the last 2 s
    p.offs.push([now, now - d.ms]); while (p.offs.length > 1 && now - p.offs[0][0] > 2000) p.offs.shift();
    p.off = Math.min(...p.offs.map((o) => o[1]));
    const fresh = !p.st;
    p.st = d; p.ms = d.ms;
    if (fresh) {
      this.metAt = this.metAt || now;
      // another build of the game: the lobby says so (and Start waits) - both should load the page again
      if (d.v !== NET_V && !this.verWarned.has(id)) { this.verWarned.add(id); this.flash(`${netName(d.n) || 'A player'} has a different version of the game · everyone should reload the page (Ctrl+F5 / pull down on mobile)`, 'warn'); }
    }
    if (this.match) {   // (in a match: a player's pose; the host's world and bot table)
      if (d.s) this.onPose(id, d.s);
      if (id === this.hostId && !this.isHost && d.m && d.m.id === this.match.id) { if (d.w) this.onWorld(d.w); if (d.bt) this.btIn = d.bt; }
    }
    if (typeof d.ep === 'number' && d.ep > this.epoch) this.epoch = d.ep;
    // events, in order, each once
    const E = Array.isArray(d.e) ? d.e : [];
    if (fresh) { p.first = now; p.seen = E.length ? E[0][0] - 1 : (d.sq || 0); }
    if (E.length && E[0][0] > p.seen + 1) this.stats.gaps += E[0][0] - p.seen - 1;
    for (const ev of E) {
      if (ev[0] <= p.seen) continue;
      p.seen = ev[0]; this.stats.events++;
      const hs = this.handlers[ev[1]];
      if (hs) for (const fn of hs) { try { fn(id, ev.slice(3), ev[2]); } catch (e) { console.warn('[net] event', ev[1], e); } }
    }
    if ((d.sq || 0) > p.seen) { if (!E.length) this.stats.gaps += d.sq - p.seen; p.seen = d.sq; }
    const sig = [d.n, d.g, d.tm, d.rd, d.r, d.h, d.v, d.aw, d.m ? d.m.id + d.m.phase : ''].join('|');
    if (sig !== p.sig) { p.sig = sig; this.uiDirty = true; if (d.g && GODS[d.g] && !Assets.glb[d.g]) ensureGodAssets(d.g).catch(() => {}); }
    if (fresh) this.elect(now);
  },
  present() { const a = []; for (const p of this.peers.values()) if (p.st) a.push(p); return a; },
  stateOf(id) { return id === this.me ? this.st : this.peers.get(id)?.st || null; },
  hostState() { return this.hostId ? this.stateOf(this.hostId) : null; },
  // a peer's / the host's clock, in my performance.now() terms
  peerNow(id) { const p = this.peers.get(id); return p ? performance.now() - p.off + p.rtt / 2 : performance.now(); },
  hostNow() { return this.isHost || !this.hostId ? performance.now() : this.peerNow(this.hostId); },

  // ---------------------------------------------------------------- every 100 ms
  tick(now) {
    const b = this.backend;
    // a long stall here (loading the arena, a busy tab) is not the others' silence: their messages wait in my queue
    const stall = now - (this.tickNow || now); this.tickNow = now;
    if (stall > 600) for (const p of this.peers.values()) p.at = Math.max(p.at, Math.min(now, p.at + stall));
    // silent too long: gone (a peer loading the arena may block for a while)
    for (const p of [...this.peers.values()]) if (now - p.at > (p.st && p.st.r === 'load' ? Math.max(20000, b.staleMs) : b.staleMs)) this.dropPeer(p.id, 'silent');
    if (now - this.pingAt > 2000 && this.peers.size) { this.pingAt = now; b.send({ k: 'pi', t: Math.round(now) }); this.count(); }
    const g = this.myGod();
    if (this.st.g !== g) this.set({ g });
    this.elect(now);
    this.lobbyTick(now);
    if (!this.online) return;
    this.hostSlots(now);   // (the host: a player gone from the match leaves a bot in its slot)
    this.lonely(now);
    this.hud(now);
    if (this.ui && !this.ui.root.hidden && (this.uiDirty || now - this.uiAt > 1000)) this.renderLobby();
  },
  // host election: the newest epoch's claim (h:1, ep) wins, then the earliest (ct), then the smallest id. A claim in
  // place of a lost host (rp) takes the next epoch, so a host that froze for a while and comes back loses to the page
  // that took over. Nobody claiming (the host left) -> the smallest present id claims; a page that has met nobody waits.
  // st.hf/hc/he: the host this page follows (and its claim): a peer that cannot reach that host itself (a link between
  // two of us never came up) follows it through the others, and never claims a room of its own
  elect(now) {
    const st = this.st; if (!st) return;
    const G = this.backend.staleMs + 3000;
    const gone = (id) => { const t = this.dropped.get(id); return t !== undefined && now - t < G; };   // (lost a moment ago: what the others say of it is old news)
    const live = (id) => { const s = this.stateOf(id); return !!(s && s.h === 1); };
    // a claim in place of a host I still have (present, claiming, never lost): not for me (the link between them broke,
    // or its maker was the one cut off); one in place of me: only when it was not its maker I lost
    const valid = (id, s) => {
      const x = s.rp; if (!x || id === this.me || id === this.yieldTo) return true;
      if (x === this.me) return !this.dropped.has(id);
      return !(this.peers.get(x)?.st && live(x) && !this.dropped.has(x));
    };
    const better = (a, b) => !b || a.ep > b.ep || (a.ep === b.ep && (a.ct < b.ct || (a.ct === b.ct && a.id < b.id)));
    let best = null;
    const cand = (id, s) => { if (s && s.h === 1 && valid(id, s)) { const c = { id, ct: s.ct, ep: s.ep | 0 }; if (better(c, best)) best = c; } };
    cand(this.me, st);
    for (const p of this.peers.values()) cand(p.id, p.st);
    // the host the others follow that I cannot see myself
    let far = null;
    for (const p of this.present()) {
      const x = p.st.hf; if (!x || x === this.me || this.peers.get(x)?.st || gone(x) || !(p.st.hc > 0)) continue;
      const c = { id: x, ct: p.st.hc, ep: p.st.he | 0, via: p.st.n }; if (better(c, far)) far = c;
    }
    if (far && better(far, best)) best = null; else far = null;
    // my claim, while everyone else follows another host (I was the one cut off): theirs
    const ps = this.present(), x = ps.length ? ps[0].st.hf : null;
    if (best && best.id === this.me && x && x !== this.me && !gone(x) && ps.every((p) => p.st.hf === x)) {
      if (!this.peers.get(x)?.st) { best = null; far = { id: x, ct: ps[0].st.hc, ep: ps[0].st.he | 0, via: ps[0].st.n }; }
      else if (live(x)) { const s = this.stateOf(x); best = { id: x, ct: s.ct, ep: s.ep | 0 }; this.yieldTo = x; }
    }
    let host = best ? best.id : null;
    if (st.h && host !== this.me) { st.h = 0; st.m = null; st.rp = null; this.dirty = true; }   // a stronger claim wins: yield
    if (!host && !far && (this.sawHost || (this.metAt && now - this.joinT > this.backend.aloneMs))) {
      // (the host's match goes on with one of its players as the new host: the smallest id among those in it, else
      // among everyone; every page has the same states and reaches the same answer)
      const mid = this.hostMid, all = [{ id: this.me, st }, ...this.present()];
      const inM = mid ? all.filter((p) => p.st.mi === mid && (p.st.r === 'play' || p.st.r === 'load')) : [];
      host = (inM.length ? inM : all).map((p) => p.id).sort()[0];
      if (host === this.me) {
        // (in place of a host: the next epoch; the first claim of a room nobody hosted yet: the epoch as it is)
        const rp = this.hostId && this.hostId !== this.me ? this.hostId : null;
        Object.assign(st, { h: 1, ct: Date.now(), ep: this.sawHost ? ++this.epoch : this.epoch, rp, m: null }); this.dirty = true;
      }
    }
    if (host) this.sawHost = true;
    const fid = far ? far.id : null;
    if (fid !== (this.hostFar ? this.hostFar.id : null)) { this.note(`far host ${fid}`); this.uiDirty = true; }
    this.hostFar = far;
    if (host !== this.hostId) this.onHostChange(this.hostId, host);
    // the host I follow, for the others (one that cannot see it learns of it from me)
    const hs = host ? this.stateOf(host) : null, hf = hs && hs.h === 1 ? host : null;
    const hc = hf ? hs.ct : 0, he = hf ? hs.ep | 0 : 0;
    if (st.hf !== hf || st.hc !== hc || st.he !== he) this.set({ hf, hc, he });
  },
  onHostChange(prev, next) {
    this.hostId = next; this.isHost = next === this.me;
    this.note(`host ${prev} -> ${next}`);
    let ended = false;
    if (prev === this.me && !this.isHost && this.match) {
      // a stronger claim than mine: the world is the other host's again - unless it gave my slot away (it lost me)
      const nm = next ? this.stateOf(next)?.m : null;
      if (!next) { ended = true; this.endMatch('Can’t reach the host directly · the match was ended'); }
      else if (nm && nm.id === this.match.id && !this.slotOf(nm, this.me)) { ended = true; this.endMatch('You lost your connection to the match · a bot took over your slot'); }
      else this.demote();
    }
    this.syncChrome();
    this.uiDirty = true;
    if (!prev || ended) { if (next && !this.isHost && !ended) this.flash(''); return; }
    const lost = prev !== this.me && !this.peers.has(prev);
    if (lost) {
      // the match goes on when the new host plays in it (host migration: it takes over the world it was shown,
      // the others draw the new host's); else it ends and everyone goes back to the lobby
      const m = this.match, ns = next ? this.stateOf(next) : null;
      const keep = !!(m && ns && ns.mi === m.id && (ns.r === 'play' || ns.r === 'load'));
      const who = this.isHost ? 'you are the new host' : next ? `${ns?.n || 'another player'} is the new host` : 'you can’t reach the new host directly';
      this.flash(`The host left the room · ${who}${keep ? ' · the match continues' : ''}`, 'warn');
      if (keep) this.migrate(ns);
      else if (m) this.endMatch(this.hostFar ? 'Can’t reach the host directly · the match was ended' : 'The host left the room · the match was ended');
    } else if (this.isHost) {
      // (the old host is still here, but gave way: the match is mine to run all the same)
      if (this.match && prev !== this.me) this.migrate(this.st); else this.flash('You are now the host', 'ok');
    } else if (this.match && prev !== this.me) {
      // another host while the old one is still here: its clock is not the old one's - the timeline starts over
      this.resync();
      if (!(next && this.stateOf(next)?.mi === this.match.id)) this.migT = performance.now();
    }
  },
  // my running match is over (the host left): back to the lobby
  endMatch(msg) {
    this.match = null;
    if (Arena.loading) { this.abortLoad = true; this.abortMsg = msg || ''; return; }
    if (Arena.active || Arena.waiting) Arena.exit();   // -> backToLobby
    else this.backToLobby();
    if (msg) this.flash(msg, 'warn');
  },
  lobbyTick(now) {
    const st = this.st;
    // a newcomer joins the smaller team once it has seen the room (unless the player picked one)
    if (this.tmAuto && !this.isHost && this.hostId) {
      const h = this.peers.get(this.hostId);
      if (h && h.st && now - h.first > 400) {
        this.tmAuto = false;
        const n = this.teamCounts(true), M = NET_MAX_TEAM;
        const tm = n[0] >= M ? (n[1] >= M ? st.tm : 1) : n[1] >= M ? 0 : n[1] < n[0] ? 1 : 0;
        if (tm !== st.tm) this.set({ tm });
        if (n[0] >= M && n[1] >= M) this.flash(`The room is full (${2 * M} players) · you wait until a spot opens up`, 'warn');
      }
    }
    // two who took a team's last place at once: the later one (by join time, then id - every page sees the same order)
    // goes to the other team, if it has room
    if (!this.tmAuto && this.hostId && st.r === 'lobby') {
      const t = st.tm ? 1 : 0, mine = [{ id: this.me, st }, ...this.present()].filter((p) => (p.st.tm ? 1 : 0) === t && p.st.r === 'lobby')
        .sort((a, b) => (a.st.jt - b.st.jt) || (a.id < b.id ? -1 : 1));
      if (mine.findIndex((p) => p.id === this.me) >= NET_MAX_TEAM && this.teamCounts()[1 - t] < NET_MAX_TEAM) {
        this.set({ tm: 1 - t, rd: 0 });
        this.flash(`${NET_TEAMS[t]} is full · you were moved to ${NET_TEAMS[1 - t]}`, 'warn');
      }
    }
    // the host's match header: load it when I have a slot in it (also straight from the last match, when the host restarts)
    const m = this.hostState()?.m, cur = this.match;
    if (m) this.hostMid = m.phase !== 'ended' ? m.id : null;   // (should the host leave: its match goes on with one of its players)
    const mine = !!(m && (m.phase === 'load' || m.phase === 'play') && m.id !== this.lastMatchId && this.slotOf(m, this.me));
    // (a new host just took over: its header comes in a moment; a match it never takes up ends after a while)
    const migrating = !this.isHost && this.migT && now - this.migT < 12000 && (!m || m.id !== cur?.id);
    if (cur && !this.isHost && this.migT && !migrating && (!m || m.id !== cur.id)) { this.migT = 0; this.endMatch('The new host did not respond · back to the lobby'); return; }
    if (m && cur && m.id === cur.id) this.migT = 0;
    if (mine && (st.r === 'lobby' || (st.r === 'play' && cur && cur.id !== m.id))) this.loadMatch(m);
    else if (migrating) { /* waiting for the new host */ }
    else if (cur && m && m.id === cur.id && !this.isHost && !this.slotOf(m, this.me) && m.phase !== 'ended' && !(Arena.active && Arena.phase === 'ended')) {
      // the host gave my slot to a bot (it lost me for a while): this match is over for me
      this.endMatch('You lost your connection to the match · a bot took over your slot');
    } else if (cur && !mine && !this.isHost && this.hostId && (!m || m.id !== cur.id || m.phase === 'ended')) {
      // the host left this match (back to the lobby, or on to one without me): the end screen may stay, the world stops
      if (!(Arena.active && Arena.phase === 'ended')) this.endMatch(m && m.id !== cur.id ? 'The host started a new match without you' : 'The host ended the match');
      else { this.match = null; this.endNote(); }
    }
    if (this.match && m && m.id === this.match.id) {
      this.match.phase = m.phase; this.match.t0 = m.t0;
      // the start: everybody has loaded (or the host stopped waiting)
      if (m.phase === 'play' && Arena.waiting && !Arena.active && !Arena.loading) { this.note(`match ${m.id} begin`); Arena.begin(); }
      // the end, should its event have been lost
      if (!this.isHost && m.win >= 0 && Arena.active && Arena.phase === 'play' && performance.now() - (this.winSeenT || (this.winSeenT = performance.now())) > 3000) this.ended(m.win, Arena.tickets[0], Arena.tickets[1]);
    }
    // host: the match is 'play' once every human has loaded (or after 30 s)
    if (this.isHost && st.m && st.m.phase === 'load') {
      // (a player still loading this match; one that has not begun to (in the lobby, or the last match) only for the
      // first seconds - one that gave up is not waited for)
      const fresh = Date.now() - st.m.at < 5000, id0 = st.m.id;
      const wait = (s) => !(s.mi === id0 && s.r === 'play') && ((s.mi === id0 && s.r === 'load') || (s.mi !== id0 && fresh));
      const waiting = st.m.own.flat().filter((id) => id && (id === this.me ? st.r !== 'play' : this.peers.get(id)?.st && wait(this.peers.get(id).st)));
      if (!waiting.length || Date.now() - st.m.at > 30000) this.set({ m: { ...st.m, phase: 'play', t0: Math.round(performance.now()) } });
    }
  },
  teamCounts(excludeMe = false) {
    const n = [0, 0];
    if (!excludeMe && this.st) n[this.st.tm ? 1 : 0]++;
    for (const p of this.present()) n[p.st.tm ? 1 : 0]++;
    return n;
  },
  slotOf(m, id) {
    for (let t = 0; t < 2; t++) for (let i = 0; i < 5; i++) if (m.own[t][i] === id) return [t, i];
    return null;
  },

  // ---------------------------------------------------------------- the match
  canStart() {
    if (!this.online) return { ok: false, why: '' };
    if (!this.created && !this.metAt) return { ok: false, why: 'Looking for the host …' };   // (a joiner who has met nobody never starts a room of its own)
    const all = [{ id: this.me, st: this.st }, ...this.present()];
    const others = all.filter((p) => p.id !== this.me);
    // (a sixth on a team plays on the other one, buildMatch; more than ten: the latest wait for the next match)
    const extra = Math.max(0, all.length - 2 * NET_MAX_TEAM);
    if (all.some((p) => p.st.v !== NET_V)) return { ok: false, why: 'Someone has a different version of the game · reload the page' };
    if (this.st.r !== 'lobby' || others.some((p) => p.st.r !== 'lobby')) return { ok: false, why: 'Waiting for everyone to return from the match' };
    const ready = others.filter((p) => p.st.rd).length;
    if (ready < others.length) return { ok: false, why: `Waiting for everyone to be ready (${ready}/${others.length})` };
    return { ok: true, why: !others.length ? 'You are alone in the room · Start fills the teams with bots' : extra ? `Everyone is ready · press Start (${extra} won’t fit and will wait for the next match)` : 'Everyone is ready · press Start' };
  },
  // host: humans into their chosen teams (slots in join order), bots fill the rest with gods not yet on that team.
  // A restart (prev) takes everyone in the lobby or the last match; reroll false keeps its bots' gods
  buildMatch(prev = null, reroll = true) {
    const all = [{ id: this.me, st: this.st }, ...this.present()].filter((p) => p.st.r === 'lobby' || (prev && p.st.r === 'play'))
      .sort((a, b) => (a.st.jt - b.st.jt) || (a.id < b.id ? -1 : 1));
    const own = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], roster = [[], []], nm = [['', '', '', '', ''], ['', '', '', '', '']];
    for (const p of all) {
      let t = p.st.tm ? 1 : 0;
      if (!own[t].includes(0)) t = 1 - t;
      const i = own[t].indexOf(0); if (i < 0) continue;
      own[t][i] = p.id; roster[t][i] = GODS[p.st.g] ? p.st.g : 'thoth'; nm[t][i] = p.st.n;
    }
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    for (let t = 0; t < 2; t++) {
      const keep = prev && !reroll ? prev.roster[t].filter((g, i) => !prev.own[t][i] && !roster[t].includes(g)) : [];
      const pool = shuffle(botGodList().filter((g) => !roster[t].includes(g) && !keep.includes(g)));   // (bots never play an owner-only god)
      for (let i = 0; i < 5; i++) if (!own[t][i]) roster[t][i] = keep.shift() || pool.pop() || botGodList()[Math.floor(Math.random() * botGodList().length)];
    }
    return { id: netRand(6), ep: this.epoch, mode: 'arena', phase: 'load', seed: (Math.random() * 2 ** 32) >>> 0, roster, own, nm, at: Date.now() };
  },
  start() {
    if (!this.isHost || !this.canStart().ok) return false;
    const m = this.buildMatch();
    this.set({ m });
    this.loadMatch(m);
    this.flush(true);
    return true;
  },
  // host, from the end screen or the Esc menu: a new match for everyone in it (and the lobby), at once
  restart(reroll = false) {
    if (!this.online || !this.isHost || !this.match || Arena.loading) return false;
    const m = this.buildMatch(this.match, reroll);
    this.set({ m });
    this.loadMatch(m);
    this.flush(true);
    return true;
  },
  // every page (host too): enter the match the header describes. Every god in it is loaded and the match set up
  // the same way everywhere (Arena.launchOnline); then 'play' tells the host I am ready, and its start (the
  // header's phase 'play', Net.lobbyTick) begins it on every page
  async loadMatch(m) {
    const slot = this.slotOf(m, this.me);
    if (!slot || !this.online || m.id === this.lastMatchId) return;   // (each match once)
    this.match = m; this.lastMatchId = m.id;
    this.note(`match ${m.id} load`);
    [this.myTeam, this.mySlot] = slot; this.myUid = -(1 + slot[0] * 5 + slot[1]);
    this.resetWorld();
    this.set({ r: 'load', mi: m.id, rd: 0, aw: 0 });   // (mi: the match I am loading / playing)
    this.abortLoad = false; this.tmAuto = false;
    this.hideLobby();
    let ok = false;
    try {
      if (Arena.active || Arena.waiting) Arena.exit(true);
      const g = m.roster[slot[0]][slot[1]];
      if (!Kit || Kit.id !== g) await selectGod(g, { force: true, voice: false });
      if (this.online && !this.abortLoad && this.match === m) ok = await Arena.launchOnline(m);
    } catch (e) { console.warn('[net] match', e); }
    const setUp = () => Arena.active || Arena.waiting || !!ArenaMap.saved;
    if (!this.online) { if (setUp() && Game.mode !== 'quit') Arena.exit(); return; }   // (left the room while loading)
    if (!ok || this.abortLoad || this.match !== m) {
      const msg = this.abortMsg || (ok || this.match !== m ? '' : 'The arena could not be loaded');
      this.abortLoad = false; this.abortMsg = '';
      if (this.match === m) this.match = null;
      if (setUp()) Arena.exit(); else this.backToLobby();   // (the lobby)
      if (msg) this.flash(msg, 'warn');
      return;
    }
    this.matchReady();
    this.set({ r: 'play' });
    this.flush(true);
  },
  // the match ended for me (Arena.exit online): the lobby again; the host's header says the match is over
  backToLobby(msg) {
    if (!this.online) return;
    this.note(`lobby${msg ? ' (' + msg + ')' : ''}`);
    this.match = null;
    this.resetWorld();
    this.set({ r: 'lobby', mi: '', rd: 0, aw: 0 });
    if (this.isHost && this.st.m && this.st.m.phase !== 'ended') this.set({ m: { ...this.st.m, phase: 'ended' } });
    if (msg) this.flash(msg, 'warn');
    this.showLobby();
  },
  // Esc online: the shared world keeps running; the others see the player as away
  setAway(on) { if (this.online && this.st && this.st.aw !== (on ? 1 : 0)) this.set({ aw: on ? 1 : 0 }); },

  // ---------------------------------------------------------------- hidden tab: a worker clock keeps the world and the wire going
  startPump() {
    if (this.pump) return;
    const tick = () => this.pumpTick();
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50);'], { type: 'text/javascript' }));
      const w = new Worker(url);
      w.onmessage = tick;
      this.pump = { stop: () => { w.terminate(); URL.revokeObjectURL(url); } };
    } catch (e) {
      const id = setInterval(tick, 50);
      this.pump = { stop: () => clearInterval(id) };
    }
  },
  stopPump() { if (this.pump) { this.pump.stop(); this.pump = null; } },
  pumpTick() {
    if (!this.online || Game.mode === 'quit') return;
    const now = performance.now(), gap = now - this.rafAt;
    // no frames (a hidden tab, or rAF stalled): simulate here, without drawing - by the clock, as the frame loop does
    // (at most 1/20 s a step; the ticks that piled up while the page was busy are one step, not a burst)
    if ((document.hidden && gap > 100) || gap > 1000) {
      const dt = Math.min(0.05, (now - (this.pumpAt || now - 50)) / 1000);
      if (dt >= 0.025) {
        this.pumpAt = now; this.pumpN = (this.pumpN || 0) + 1;
        try { simulate(dt, dt); endFrameInput(); } catch (e) { console.warn('[net] pump', e); }
      }
    } else this.pumpAt = now;
    this.flush();
  },

  // ---------------------------------------------------------------- the lobby
  initUI() {
    if (this.btn) return;
    const css = document.createElement('style');
    css.textContent = `
.modes { flex-wrap: wrap; }
.modes button.online { border-color: rgba(130,217,255,.55); }
.modes button.online:hover { box-shadow: 0 0 18px rgba(130,217,255,.3); }
#netLobby { position: absolute; inset: 0; z-index: 22; display: grid; place-items: center; padding: 16px; background: rgba(3,6,15,.7); overflow: auto; }
#netLobby .card { width: min(780px, 100%); max-height: calc(100% - 8px); overflow: auto; background: rgba(7,11,26,.97); border: 1px solid var(--edge); padding: 18px 20px; box-shadow: 0 20px 60px rgba(0,0,0,.6); display: grid; gap: 12px; box-sizing: border-box; }
#netLobby h2 { margin: 0; font: 800 22px var(--font-display); letter-spacing: .14em; color: var(--gold); }
#netLobby .note { margin: 0; font-size: 14px; line-height: 1.45; color: var(--muted); max-width: 70ch; }
#netLobby .note b { color: var(--parchment); }
#netLobby .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
#netLobby .row .spacer { flex: 1 1 auto; }
#netLobby .row .or { color: var(--muted); font-size: 13px; padding: 0 4px; }
#netLobby button { pointer-events: auto; cursor: pointer; font: 700 14px var(--font-ui); letter-spacing: .12em; text-transform: uppercase; padding: 9px 16px; border: 1px solid var(--edge); background: var(--panel-solid); color: var(--parchment); }
#netLobby button:hover:not([disabled]) { filter: brightness(1.15); }
#netLobby button.primary { background: linear-gradient(180deg, #ffe7a6, var(--gold) 55%, #b88a35); color: #05101e; border-color: #000; }
#netLobby button.danger { border-color: #8a2a24; color: #ffb3a6; }
#netLobby button[disabled] { opacity: .45; cursor: not-allowed; }
#netLobby input { user-select: text; background: var(--panel-solid); color: var(--parchment); border: 1px solid var(--edge-soft); padding: 8px 10px; font: 600 16px var(--font-ui); min-width: 0; box-sizing: border-box; }
#netLobby .f { display: grid; gap: 4px; color: var(--muted); font-size: 14px; max-width: 320px; }
#nlCode { width: 8ch; text-transform: uppercase; letter-spacing: .22em; font-weight: 800; }
#netLobby .code { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--muted); }
#netLobby .code b { font: 900 26px var(--font-display); letter-spacing: .22em; color: #fff; }
#netLobby .code .link { flex: 1 1 220px; font-size: 13px; color: var(--muted); }
#netLobby .status { min-height: 1.4em; color: var(--parchment); font-weight: 600; font-size: 15px; }
#netLobby .status.warn { color: #ff8a7a; } #netLobby .status.ok { color: #7fe0a0; }
#netLobby .teams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) { #netLobby .teams { grid-template-columns: 1fr; } #netLobby .card { padding: 14px 12px; } }
#netLobby .team { border: 1px solid rgba(74,168,255,.4); padding: 8px 10px; background: rgba(10,16,36,.6); min-width: 0; }
#netLobby .team.t1 { border-color: rgba(255,75,62,.4); }
#netLobby .team h3 { margin: 0 0 6px; font: 800 14px var(--font-display); letter-spacing: .14em; text-transform: uppercase; color: #6fbaff; display: flex; justify-content: space-between; }
#netLobby .team.t1 h3 { color: #ff6a5a; }
#netLobby .team h3 small { font: 600 12px var(--font-ui); letter-spacing: .04em; color: var(--muted); text-transform: none; }
#netLobby ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
#netLobby li { display: flex; gap: 7px; align-items: center; padding: 4px 6px; background: rgba(255,255,255,.05); font-size: 14px; min-width: 0; min-height: 26px; }
#netLobby li b { color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
#netLobby li .god { color: var(--parchment); opacity: .8; white-space: nowrap; }
#netLobby li .crown { font: 800 10px var(--font-ui); letter-spacing: .12em; color: #05101e; background: var(--gold); padding: 1px 5px; }
#netLobby li .chip { padding: 1px 6px; font-size: 11px; border: 1px solid rgba(74,168,255,.6); color: #9fd0ff; background: rgba(74,168,255,.12); letter-spacing: .06em; }
#netLobby li .chip.t1 { border-color: rgba(255,75,62,.6); color: #ffb0a6; background: rgba(255,75,62,.12); }
#netLobby li .rd { margin-left: auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
#netLobby li.ready .rd { color: #7fe0a0; }
#netLobby li .ping { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; min-width: 5ch; text-align: right; white-space: nowrap; }
#netLobby li.me { outline: 1px solid var(--gold); }
#netLobby li.away b { opacity: .55; }
#netLobby li.bot { color: var(--muted); background: transparent; border: 1px dashed rgba(255,255,255,.1); font-size: 12px; min-height: 0; padding: 2px 6px; }
#netLobby .tb.on.t0 { border-color: #4aa8ff; background: rgba(74,168,255,.28); color: #fff; }
#netLobby .tb.on.t1 { border-color: #ff4b3e; background: rgba(255,75,62,.28); color: #fff; }
#netLobby .godpick { margin-top: 0; max-width: none; }
#menu .arenaRow .netLeave { display: none; border-color: #8a2a24; color: #ffb3a6; }
#app.net-online #menu .arenaRow .netLeave { display: inline-block; }
#app.net-online #menu .arenaRow .restart, #app.net-online #arena .end .again, #app.net-online #arena .end .same { display: none !important; }
#app.net-online.net-host #menu .arenaRow .restart, #app.net-online.net-host #arena .end .again, #app.net-online.net-host #arena .end .same { display: inline-block !important; }
#arena td.iv { white-space: nowrap; padding-top: 2px; padding-bottom: 2px; }
#arena td.iv img { width: 18px; height: 18px; margin-right: 2px; vertical-align: middle; }
#arena .end .netNote { margin-top: 10px; color: var(--parchment); font: 600 14px var(--font-ui); text-align: center; }
#arena .end .netNote:empty { display: none; }
#netLobby .conn { display: flex; gap: 7px; align-items: center; margin-top: 6px; font-size: 13px; color: var(--muted); min-width: 0; overflow-wrap: anywhere; }
#netLobby .conn::before { content: ''; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); animation: nlPulse 1.1s ease-in-out infinite alternate; }
#netLobby .conn.ok::before { background: #7fe0a0; animation: none; }
#netLobby .conn.warn { color: #ff8a7a; } #netLobby .conn.warn::before { background: #ff6a5a; animation: none; }
@keyframes nlPulse { to { opacity: .3; } }
#netLobby .help .note { color: var(--parchment); }
#netLobby .adv { margin-top: 12px; color: var(--muted); font-size: 13px; }
#netLobby .adv summary { cursor: pointer; width: max-content; max-width: 100%; }
#netLobby .adv .note { font-size: 13px; margin-top: 6px; }
#netLobby .f.wide { max-width: none; margin-top: 8px; }
#netLobby .f.wide input { width: 100%; font-size: 14px; }
#netLobby .status { overflow-wrap: anywhere; }
#netLobby .touch .note { color: #ffb0a6; max-width: none; }
#netLobby .touch button { margin-left: 6px; padding: 4px 10px; font-size: 12px; }
#netLobby .note.invite { color: var(--parchment); }
#netHud { position: absolute; left: 16px; top: calc(162px + env(safe-area-inset-top, 0px)); max-width: min(360px, 60vw); font: 600 12px var(--font-ui); letter-spacing: .03em; color: var(--parchment); background: rgba(6,9,20,.62); border: 1px solid var(--edge-soft); padding: 2px 8px; text-shadow: 0 1px 2px #000; }
#netHud.warn { color: #ffb0a6; border-color: rgba(255,75,62,.6); }
@media (max-width: 640px) { #netHud { top: calc(120px + env(safe-area-inset-top, 0px)); } }
@media (max-width: 420px) {
  #netLobby { padding: 8px; }
  #netLobby .card { padding: 12px 10px; gap: 10px; }
  #netLobby h2 { font-size: 18px; }
  #netLobby button { padding: 8px 11px; font-size: 13px; letter-spacing: .08em; }
  #netLobby .code b { font-size: 22px; }
  #netLobby .code .link { flex-basis: 100%; }
  #netLobby .f { max-width: none; flex: 1 1 100%; }
  #netLobby .f input { width: 100%; }
  #netLobby li { gap: 5px; font-size: 13px; }
  #netLobby li .god { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
}
`;
    document.head.appendChild(css);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'online';
    b.innerHTML = 'Play online with friends<small>With or against your friends · free</small>';
    b.addEventListener('click', () => { if (Arena.loading || Arena.active || Arena.waiting) return; if (this.artifactHost()) this.elsewhere(); else this.showLobby(); });
    if (Arena.modesEl) Arena.modesEl.appendChild(b); else UI.play.before(b);
    this.btn = b;
    // the Esc menu during an online match: leave the room altogether
    const row = document.querySelector('#menu .arenaRow');
    if (row) {
      const l = document.createElement('button'); l.type = 'button'; l.className = 'netLeave'; l.textContent = 'Leave room';
      l.addEventListener('click', () => { UI.menu.hidden = true; this.leave(); });
      row.prepend(l);
    }
  },
  // inside the claude.ai artifact the sandbox blocks the relays and brokers online play needs (and vendor/ is not
  // published there): the button points to the public website instead, and nothing is imported or sent
  artifactHost() {
    try { const h = location.hostname || ''; return !!window.claude || h.endsWith('claudeusercontent.com') || h.endsWith('claude.ai') || this.q.get('artifact') === '1'; } catch (e) { return false; }
  },
  elsewhere() {
    let el = document.getElementById('netElsewhere');
    if (!el) {
      el = document.createElement('div'); el.id = 'netElsewhere';
      el.style.cssText = 'position:absolute;inset:0;z-index:22;display:grid;place-items:center;padding:16px;background:rgba(3,6,15,.7)';
      el.innerHTML = `<div role="dialog" aria-labelledby="neTitle" style="width:min(520px,100%);box-sizing:border-box;background:rgba(7,11,26,.97);border:1px solid var(--edge);padding:18px 20px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <h2 id="neTitle" style="margin:0;font:800 22px var(--font-display);letter-spacing:.14em;color:var(--gold)">Play online with friends</h2>
        <p style="margin:0;font-size:15px;line-height:1.5;color:var(--parchment)">Online play doesn’t work inside this claude.ai page. Play with your friends on the public website:</p>
        <p style="margin:0;font:700 16px var(--font-ui);overflow-wrap:anywhere"><a href="${NET_SITE}" target="_blank" rel="noopener" style="color:#9fd0ff">${NET_SITE.replace(/^https:\/\//, '')}</a></p>
        <p style="margin:0;font-size:13px;color:var(--muted)">Practice and Arena 5v5 against bots work right here.</p>
        <div style="display:flex;justify-content:flex-end"><button type="button" data-a="close" style="pointer-events:auto;cursor:pointer;font:700 14px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;border:1px solid var(--edge);background:var(--panel-solid);color:var(--parchment)">Close</button></div></div>`;
      el.addEventListener('click', (e) => { if (e.target === el || e.target.dataset.a === 'close') el.style.display = 'none'; });
      document.getElementById('app').appendChild(el);
    }
    el.style.display = 'grid';
  },
  buildLobby() {
    if (this.ui) return;
    const root = document.createElement('div'); root.id = 'netLobby'; root.hidden = true;
    root.innerHTML = `<div class="card" role="dialog" aria-labelledby="nlTitle">
      <h2 id="nlTitle">Play online with friends</h2>
      <div class="touch" hidden><p class="note">The arena is played with <b>keyboard and mouse</b> · open the link on a PC or Mac (on mobile you can share the invite). <button type="button" data-a="anyway">Play anyway</button></p></div>
      <div class="pre">
        <p class="note invite" hidden></p>
        <p class="note">Create a room and send the link to your friends · no account, no server. Choose <b>Blue team</b> or <b>Red team</b>: on the same team you play together, on opposite teams you play against each other. Empty slots are filled with bots, so it is always 5 v 5.</p>
        <div class="row" style="margin-top:12px"><label class="f" for="nlName"><span>Nickname</span><input id="nlName" maxlength="16" autocomplete="nickname" spellcheck="false" placeholder="Your name"></label></div>
        <div class="row" style="margin-top:12px"><button type="button" class="primary" data-a="create">Create room</button><span class="or">or</span>
          <input id="nlCode" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false" aria-label="Room code"><button type="button" data-a="join">Join</button>
          <span class="spacer"></span><button type="button" data-a="back">Back</button></div>
        <details class="adv"><summary>Advanced: custom servers</summary>
          <p class="note">Only if you cannot connect. Everyone in the room must use the same relays: they are included in the invite link (the TURN password is not shared).</p>
          <label class="f wide" for="nlRelays"><span>Nostr relays (wss://…, comma-separated)</span><input id="nlRelays" autocomplete="off" spellcheck="false" placeholder="wss://relay.example.com"></label>
          <label class="f wide" for="nlTurn"><span>TURN server (turn:host:3478|user|password)</span><input id="nlTurn" autocomplete="off" spellcheck="false" placeholder="turn:turn.example.com:3478|user|password"></label>
        </details>
      </div>
      <div class="in" hidden>
        <div class="code">Room <b class="cd"></b><input class="link" readonly aria-label="Invite link"><button type="button" data-a="copy">Copy link</button><button type="button" data-a="share">Share invite</button></div>
        <div class="conn" role="status"></div>
      </div>
      <div class="status" role="status" aria-live="polite"></div>
      <div class="in help" hidden>
        <p class="note">Found nobody else in the room. Check that the <b>code</b> is correct and that the host still has the room open. Try again in a moment. Some networks (school, work, some mobile networks and VPNs) block direct connections between browsers: try another network, e.g. a phone hotspot. If the host uses custom relays (Advanced), you must open the link from the host.</p>
        <div class="row"><button type="button" class="primary" data-a="retry">Try again</button><button type="button" data-a="own">Create your own room</button></div>
      </div>
      <div class="in" hidden>
        <div class="teams"><div class="team t0"><h3>Blue team<small></small></h3><ol></ol></div><div class="team t1"><h3>Red team<small></small></h3><ol></ol></div></div>
        <div class="row" style="margin-top:10px"><span class="or">Your team:</span><button type="button" class="tb t0" data-a="t0">Blue team</button><button type="button" class="tb t1" data-a="t1">Red team</button></div>
        <div class="godpick" aria-label="Choose god"></div>
        <div class="row" style="margin-top:12px"><button type="button" class="danger" data-a="leave">Leave room</button><span class="spacer"></span>
          <button type="button" data-a="ready">Ready</button><button type="button" class="primary" data-a="start">Start</button></div>
      </div>
    </div>`;
    document.getElementById('app').appendChild(root);
    const $ = (s) => root.querySelector(s), A = (a) => root.querySelector(`[data-a="${a}"]`);
    this.ui = { root, pre: $('.pre'), ins: [...root.querySelectorAll('.in:not(.help)')], help: $('.help'), conn: $('.conn'), name: $('#nlName'), code: $('#nlCode'), cd: $('.cd'), link: $('.link'), status: $('.status'),
      lists: [$('.team.t0 ol'), $('.team.t1 ol')], counts: [$('.team.t0 small'), $('.team.t1 small')], tb: [A('t0'), A('t1')], ready: A('ready'), start: A('start'), create: A('create'), join: A('join'),
      touch: $('.touch'), invite: $('.note.invite') };
    this.ui.name.value = this.savedName();
    this.ui.name.addEventListener('change', () => { const n = this.nameFromField(); if (this.online) this.set({ n }); });
    this.ui.code.addEventListener('input', () => { const c = netCleanCode(this.ui.code.value); if (c !== this.ui.code.value) this.ui.code.value = c; this.renderLobby(); });
    // (Enter in the name: into the room whose code is filled in, else a new one)
    this.ui.name.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || this.online) return; const c = netCleanCode(this.ui.code.value); if (netCodeOk(c)) this.join(c); else this.create(); });
    A('anyway').addEventListener('click', () => { this.touchOk = true; this.renderLobby(); });
    this.ui.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join(this.ui.code.value); });
    A('create').addEventListener('click', () => this.create());
    A('join').addEventListener('click', () => this.join(this.ui.code.value));
    A('back').addEventListener('click', () => this.hideLobby());
    A('copy').addEventListener('click', () => this.copyLink());
    A('share').addEventListener('click', () => this.share());
    A('retry').addEventListener('click', () => this.retry());
    A('own').addEventListener('click', () => { this.leave({ quiet: true }); this.showLobby(); this.create(); });
    // (our own relays and TURN servers: kept in this browser for the next room)
    const keep = (el, key, list) => { try { el.value = localStorage.getItem(key) || ''; } catch (e) { /* storage blocked */ }
      el.addEventListener('change', () => { try { localStorage.setItem(key, el.value.trim()); } catch (e) { /* storage blocked */ } const n = list(); this.flash(el.value.trim() ? (n.length ? `Saved · ${n.length} in use from the next room` : 'No valid addresses found') : 'Using defaults', n.length || !el.value.trim() ? 'ok' : 'warn'); this.renderLobby(); }); };
    keep($('#nlRelays'), 'thoth-net-relays', () => this.relayList());
    keep($('#nlTurn'), 'thoth-net-turn', () => this.turnList());
    A('leave').addEventListener('click', () => this.leave());
    A('ready').addEventListener('click', () => { if (this.online && !this.isHost) this.set({ rd: this.st.rd ? 0 : 1 }); this.renderLobby(); });
    A('start').addEventListener('click', () => this.start());
    this.ui.tb.forEach((el, t) => el.addEventListener('click', () => this.pickTeam(t)));
    buildGodPickers();   // (the lobby's pantheon: the same cards as the start screen)
  },
  pickTeam(t) {
    if (!this.online || this.st.r !== 'lobby') return;
    this.tmAuto = false;
    if (this.st.tm !== t && this.teamCounts(true)[t] >= NET_MAX_TEAM) { this.flash(`${NET_TEAMS[t]} is full (max ${NET_MAX_TEAM} players)`, 'warn'); return; }
    this.set({ tm: t }); this.renderLobby();
  },
  showLobby() {
    this.buildLobby();
    this.ui.root.hidden = false;
    updateGodUI();
    this.renderLobby();
  },
  hideLobby() { if (this.ui) this.ui.root.hidden = true; },
  // (our own relays go with the link: a friend on the default ones would never meet us; never the TURN password)
  inviteUrl(relays = true) {
    const q = new URLSearchParams(location.search); q.delete('name'); q.delete('room');
    if (relays && !q.has('relays')) { const r = this.relayList(); if (r.length) q.set('relays', r.join(',')); }
    const s = q.toString();
    return location.origin + location.pathname + (s ? '?' + s : '') + (this.code ? '#room=' + this.code : '');
  },
  copyLink() {
    const url = this.inviteUrl();
    const ok = () => this.flash('Link copied · send it to your friends', 'ok');
    const fallback = () => { this.ui.link.focus(); this.ui.link.select(); try { if (document.execCommand('copy')) return ok(); } catch (e) { /* no clipboard */ } this.flash('Select the link and copy it yourself'); };
    try { navigator.clipboard.writeText(url).then(ok, fallback); } catch (e) { fallback(); }
  },
  // a short trace of what happened on the wire (Net.debug().trace)
  note(s) { (this.trace || (this.trace = [])).push(`${(performance.now() / 1000).toFixed(1)} ${s}`); if (this.trace.length > 40) this.trace.shift(); },
  flash(msg, kind = '') {
    this.msg = msg; this.msgKind = kind; this.msgT = msg ? performance.now() + 7000 : 0; this.uiDirty = true;
    if (!this.online && this.ui && !this.ui.root.hidden) this.renderLobby();   // (online, Net.tick draws it)
  },
  renderLobby() {
    const U = this.ui; if (!U) return;
    this.uiDirty = false; this.uiAt = performance.now();
    const on = this.online;
    U.pre.hidden = on; for (const el of U.ins) el.hidden = !on;
    U.create.disabled = U.join.disabled = this.joining;
    // (a code in the field - an invitation - makes «Bli med» the way in; an empty one, «Lag rom»)
    const cc = netCleanCode(U.code.value), inv = !on && netCodeOk(cc);
    U.join.classList.toggle('primary', inv); U.create.classList.toggle('primary', !inv);
    U.invite.hidden = !(inv && cc === this.invited);
    if (!U.invite.hidden) U.invite.innerHTML = `You are invited to room <b>${netEsc(cc)}</b> · enter your nickname and press “Join”`;
    const touch = this.touchOnly(); U.touch.hidden = !touch || !!this.touchOk;
    // the status line: a fresh message first, else what the player waits for
    let msg = '', kind = '';
    if (this.msg && performance.now() < this.msgT) { msg = this.msg; kind = this.msgKind; }
    else if (on) {
      const m = this.hostState()?.m;
      if (!this.hostId && this.hostFar) { msg = `Can’t reach the host directly (${netName(this.hostFar.via) || 'another player'} can see it, you can’t) · your network or the host’s is probably blocking direct connections: try another network, or add TURN under Advanced`; kind = 'warn'; }
      else if (!this.hostId) msg = this.kind === 'p2p' ? 'Looking for the host … (this can take a few seconds)' : 'Looking for the host …';
      else if (this.isHost) { const c = this.canStart(); msg = c.why; kind = c.ok ? 'ok' : ''; }
      else if (m && m.phase !== 'ended' && m.win >= 0) msg = 'The match is over · the host will start the next match';
      else if (m && m.phase !== 'ended' && this.match && m.id === this.match.id) msg = 'You’re in the match · it starts shortly';
      else if (m && m.phase !== 'ended' && (!this.slotOf(m, this.me) || m.id === this.lastMatchId)) msg = 'Match in progress · waiting for the next round';
      else {
        const n = this.teamCounts(), t = this.st.tm ? 1 : 0;
        if (n[0] + n[1] > 2 * NET_MAX_TEAM && this.over()) { msg = `The room is full (${2 * NET_MAX_TEAM} players) · you wait until a spot opens up`; kind = 'warn'; }
        else if (n[t] > NET_MAX_TEAM) { msg = `${NET_TEAMS[t]} is full · switch teams`; kind = 'warn'; }
        else if (touch && !this.touchOk) { msg = 'You need a keyboard and mouse to play · open the link on a PC or Mac'; kind = 'warn'; }
        else msg = this.st.rd ? 'Ready · waiting for the host to start' : 'Pick a team and a god, then press Ready';
      }
    }
    // (a joiner who has met nobody: the help text, and a retry)
    const alone = on && !!this.aloneNow && !this.metAt;
    U.help.hidden = !alone;
    if (alone && !(this.msg && performance.now() < this.msgT)) { msg = `Found nobody else in room ${this.code} after ${Math.round(NET_LONELY / 1000)} seconds`; kind = 'warn'; }
    U.status.textContent = msg; U.status.className = 'status' + (kind ? ' ' + kind : '');
    if (!on) return;
    const [ct, ck] = this.connLine(); if (U.conn.textContent !== ct) U.conn.textContent = ct; U.conn.className = 'conn' + (ck ? ' ' + ck : '');
    U.cd.textContent = this.code; const url = this.inviteUrl(); if (U.link.value !== url) U.link.value = url;
    // the two teams: humans in join order, then the bot slots
    const rows = [{ id: this.me, st: this.st, me: true }, ...this.present()].sort((a, b) => (a.st.jt - b.st.jt) || (a.id < b.id ? -1 : 1));
    // (two with the same nickname: the later one gets a number)
    const nn = new Map(), label = new Map();
    for (const r of rows) { const n = netName(r.st.n) || '?', k = n.toLowerCase(), i = (nn.get(k) || 0) + 1; nn.set(k, i); label.set(r.id, i > 1 ? `${n} (${i})` : n); }
    for (let t = 0; t < 2; t++) {
      const list = rows.filter((r) => (r.st.tm ? 1 : 0) === t);
      const html = list.map((r) => {
        const s = r.st, p = this.peers.get(r.id), host = r.id === this.hostId;
        const ping = r.me ? '' : p && p.rtt ? `${Math.round(p.rtt)} ms` : '…';
        const state = s.r === 'play' || s.r === 'load' ? 'in match' : s.rd || host ? 'ready' : 'choosing';
        return `<li data-peer="${netEsc(r.id)}" class="${r.me ? 'me ' : ''}${s.rd || host ? 'ready ' : ''}${s.aw ? 'away' : ''}">${host ? '<span class="crown">HOST</span>' : ''}<b>${netEsc(label.get(r.id))}</b>`
          + `<span class="god">${netEsc(GODS[s.g] ? GODS[s.g].name : s.g || '')}</span><span class="chip t${t}">${t ? 'Red' : 'Blue'}</span>`
          + `${s.v !== NET_V ? '<span class="chip t1">other version</span>' : ''}<span class="rd">${state}</span><span class="ping">${ping}</span></li>`;
      }).join('') + Array.from({ length: Math.max(0, NET_MAX_TEAM - list.length) }, () => '<li class="bot">Bot</li>').join('');
      if (U.lists[t].dataset.v !== html) { U.lists[t].dataset.v = html; U.lists[t].innerHTML = html; }
      U.counts[t].textContent = `${Math.min(list.length, NET_MAX_TEAM)} ${list.length === 1 ? 'player' : 'players'} · ${Math.max(0, NET_MAX_TEAM - list.length)} bots`;
      U.tb[t].classList.toggle('on', (this.st.tm ? 1 : 0) === t);
      U.tb[t].disabled = this.st.r !== 'lobby' || ((this.st.tm ? 1 : 0) !== t && this.teamCounts(true)[t] >= NET_MAX_TEAM);
    }
    U.ready.hidden = this.isHost; U.start.hidden = !this.isHost;
    U.ready.textContent = this.st.rd ? 'Ready ✓' : 'Ready'; U.ready.classList.toggle('primary', !!this.st.rd);
    U.ready.disabled = this.st.r !== 'lobby' || (touch && !this.touchOk && !this.st.rd);
    U.ready.title = touch && !this.touchOk ? 'The arena is played with keyboard and mouse' : '';
    U.start.disabled = !this.canStart().ok;
  },

  // ---------------------------------------------------------------- tests and debugging
  debug() {
    const now = performance.now();
    return { online: this.online, kind: this.kind, code: this.code, me: this.me, hostId: this.hostId, isHost: this.isHost, epoch: this.epoch,
      st: this.st && { ...this.st }, match: this.match, myTeam: this.myTeam, mySlot: this.mySlot, myUid: this.myUid,
      peers: this.present().map((p) => ({ id: p.id, n: p.st.n, g: p.st.g, tm: p.st.tm, rd: p.st.rd, r: p.st.r, h: p.st.h, aw: p.st.aw, rtt: Math.round(p.rtt), off: Math.round(p.off), age: Math.round(now - p.at) })),
      stats: { sent: this.stats.sent, recv: this.stats.recv, bytes: this.stats.bytes, maxBytes: this.stats.maxBytes, gaps: this.stats.gaps, events: this.stats.events, rate: this.stats.times.filter((t) => now - t <= 1000).length, ringDrop: this.stats.ringDrop || 0 },
      migrating: !!this.migT, alone: !!this.aloneNow, conn: this.online ? this.connLine(now) : null,
      msg: this.msg, trace: (this.trace || []).slice(-20),
      world: this.match ? { snaps: this.snaps.length, queued: this.tq.length, replicas: this.rep.size, known: this.known.size, delay: this.isHost ? 0 : Math.round(this.hostNow() - this.rt) } : null };
  },
};

// ---- the shared Arena match -----------------------------------------------------------------------------
// The host's page runs the world (bots, minions, Sebek, the camps, scarabs, the Scales, Set's storm, tickets)
// and sends it beside its state: a snapshot w ~10 times a second and a bot table bt once a second. Every other
// page draws that world NET_DELAY ms in the past: positions interpolated between two snapshots, the host's
// events replayed at their own moment (sp spawn, gn gone, ba / bc a bot's attack and cast, fd the kill feed,
// an the announcer, rr the crowd, end). A client's copies of the host's units are replicas (u.replica): they
// only follow the snapshots, and their attacks and casts are pictures (Arena.hurt and BotCast.afflict ignore a
// replica). Every human plays its own god; the others are RemotePlayerUnits, drawn by a RemoteActor from their
// pose (st.s) with their jumps, taunts and recalls (j, t, rc).
// A blow on another page's unit or player goes to its owner: h (players' hits, batched; every page sees them, so
// the host keeps the kill credit), dmg (the host's units hitting a human), cc (crowd control), dp (displacements),
// hl (a heal), gf (a buff, a scarab's gift, the ankh), gd (gold), die (a client's god fell: the host credits the kill
// and tells everyone, kd; ku for anything else another human felled), rs (a human rose again).
// The economy: each page keeps its own gold, income, items and passives; the host's bots earn and shop on the host
// alone (their items ride in the bot table). The host decides what a kill, an assist, a minion, a camp or a fallen
// Sebek pays another human (gd), and every level-up (lv) and the scores a kill made (sc) go out at once. A player's items
// are in its state (iv), for its allies' auras and everyone's scoreboard; its purchases, drinks and relic show where
// it stands (ix).
const NET_DELAY = 180;    // ms: the others are drawn at least this far in the past (two snapshots and a little jitter; more when they arrive late)
const NET_REC = 11;       // a unit in a snapshot: [id, code, x*20, z*20, facing*100, hp, maxHp, flags, attacks, target, lift*100]
const NET_FOUNT = 9990;   // + team: a fountain as the source of damage
const NET_HITK = ['basic', 'ability', 'ult', 'final', 'dot', 'proc', 'glyph', 'wrath'];
const NET_BUFFS = ['sekhmet', 'isis', 'horus', 'scarabDmg', 'scarabSpeed'];
const NET_SCALES = ['idle', 'rising', 'judging', 'sinking'];
const netQ = Math.round;
const netLerpA = (a, b, k) => a + wrapAngle(b - a) * k;

// ---- another player's god as this page draws it (RemoteActor): its own copy of the god's rig, from the rest pose
// (cloneGodRig with Assets.rest), its own animator, and for Thoth his own book (its own page glow, no light). It is
// posed from the player's pose (Net.poseOf: NET_PDELAY ms in its past, interpolated between two poses, carried on
// at most NET_EXTRAP ms past the newest, snapped across a teleport). Its jumps, taunts and recalls (events j, t, rc)
// play when that timeline reaches them; its footsteps and voice come from the god's own sound bank (Sound.loadBank),
// where it stands. In the Arena a RemotePlayerUnit owns it: the rig hangs in the unit's mesh, a group that stays at
// the origin (the rig root carries the world position, as the player's own: the book and the foot IK work in world
// space), so the arena's visibility and shadow switches reach it; a kit's wobble on that group tilts the god instead.
const NET_PDELAY = 120;   // ms: another player is drawn at least this far in its past (more when its poses arrive late)
const NET_EXTRAP = 200;   // ms: past its newest pose a player is carried on along its velocity this long at most
const NET_TP = 6;         // m: a step this long between two poses is a teleport (recall, respawn): no gliding across
const _rav = new THREE.Vector3(), _rav0 = new THREE.Vector3();
class RemoteActor {
  constructor(peer, god, o = {}) {
    Object.assign(this, { peer, god: null, want: null, fetching: null, parent: o.parent || scene, unit: o.unit || null, fxK: o.fxK ?? 0.5,
      pos: o.pos || new THREE.Vector3(), y: 0, ry: 0, vel: new THREE.Vector3(), ps: null, q: [], seen: false, air: false,
      rig: null, anim: null, book: null, bank: null, recall: null, voiceH: null, animAcc: 0, frameSkip: 0, at: new THREE.Vector3(),
      onScreen: true, camDist: 0, gone: false, snaps: 0, heard: { step: 0, voice: 0, jump: 0, land: 0, recall: 0, cast: 0 }, ctx: null, tried: null });
    this.setGod(god, true);
  }
  // build the avatar (again, for another god); a god not loaded yet is fetched first
  setGod(g, quiet = false) {
    if (!GODS[g] || this.gone) return;
    this.want = g;
    if (g === this.god && this.rig) return;
    // (with its kit, the god's beasts and summoned things too: Kaldr, the cats, the barque ...)
    const kit = !!(this.unit && Net.online), need = !Assets.glb[g] || (kit && this.tried !== g && GOD_BEASTS[g].some((b) => !Assets.glb[b]));
    if (need) {
      if (this.fetching !== g && this.tried !== g) { this.fetching = g; (kit ? ensureGodAssets(g) : loadAsset(g)).catch(() => {}).then(() => { this.fetching = null; this.tried = g; if (this.want === g) this.setGod(g, quiet); }); }
      if (!Assets.glb[g]) return;
      if (this.fetching === g) return;
    }
    const swap = !!this.rig;
    this.free();
    this.god = g; this.bank = null;
    const rig = this.rig = cloneGodRig(Assets.glb[g], g, Assets.rest[g]);
    rig.root.rotation.order = 'YXZ';
    if (rig.props) for (const [key, p] of Object.entries(rig.props)) p.visible = key === 'bow';   // Ullr: bow out
    this.parent.add(rig.root);
    this.book = rig.cfg.book ? new Book({ own: true, light: false }) : null;
    if (this.book) this.parent.add(this.book.group);
    const a = this.anim = new RigAnimator(rig, this.book); a.fxK = this.fxK;
    a.onStep = (p) => this.step(p);
    rig.root.position.set(this.pos.x, this.y, this.pos.z); rig.root.rotation.y = this.ry; this.at.copy(rig.root.position);
    if (this.unit) this.unit.castsShadow = undefined;   // (the arena sets the new meshes' shadows on its next look)
    // (its shaders compiled in the background the first time this god turns up here: no hitch when it comes into sight)
    const W = Net.warmed || (Net.warmed = new Set());
    if (!HEADLESS && !W.has(g) && renderer.compileAsync) { W.add(g); renderer.compileAsync(rig.root, camera, scene).catch(() => {}); }
    Sound.loadBank(g).then((b) => { if (this.god === g && !this.gone) this.bank = b; });
    if (kit) this.ctx = Net.makeCtx(this);   // its kit: the player's casts are replayed on it (the Actor sandbox, below)
    if (swap && !quiet && this.near(50)) {   // (as selectGod: the new god arrives in a flash of its own magic)
      const c = GODS[g].accent || COL.cyan;
      VFX.burst(this.pos.clone().setY(1.1), { color: c, count: 26, speed: 5, flash: 1.8, intensity: 2.6 });
      VFX.shockwave(this.pos.clone(), 3.5, 0.45, c, 1.2, 2);
    }
  }
  near(d) { return camera.position.distanceTo(this.pos) < d; }
  free() {
    if (this.ctx) Net.dropCtx(this);   // (its kit goes first: it still holds the rig, the book and its effects)
    if (this.recall) { Recall.stopFx(this.recall.fx, false); this.recall = null; }
    if (this.voiceH) { this.voiceH.stop(0.1); this.voiceH = null; }
    const r = this.rig;
    if (r) {
      for (const f of this.anim.handFx) f.trail.alive = false;
      r.root.removeFromParent();
      r.root.traverse((o) => { if (o.isMesh && o.material && o.material !== r.material && o.material.dispose) o.material.dispose(); });
      if (r.material) r.material.dispose();
      for (const s of [...r.eyes, ...r.handGlows.flatMap((h) => [h.glow, h.core])]) s.material.dispose();
    }
    if (this.book) { this.book.group.removeFromParent(); this.book.dispose(); }
    this.rig = this.anim = this.book = null;
  }
  dispose() { this.free(); this.gone = true; this.q = []; }
  // a jump, a taunt or a recall (sent with the moment it happened): played when the pose timeline gets there
  later(ms, k, a) { this.q.push({ t: ms, k, a }); if (this.q.length > 32) this.q.shift(); }
  // the player's pose now (in its past), and what happened up to then
  sample() {
    const s = this.ps = Net.poseOf(this.peer);
    if (!s) return null;
    while (this.q.length && this.q[0].t <= s.t) { const e = this.q.shift(); if (s.t - e.t < 1500) { try { this.play(e.k, e.a); } catch (err) { console.warn('[net] avatar', e.k, err); } } }
    const tp = !this.seen || Math.hypot(s.x - this.pos.x, s.z - this.pos.z) > NET_TP;   // (its first pose, a teleport: it is simply there)
    this.seen = true;
    this.pos.set(s.x, 0, s.z); this.y = s.y; this.ry = s.ry; this.vel.set(s.vx, 0, s.vz);
    if (tp && this.anim) { this.anim.firstFrame = true; this.anim.actions = []; this.snaps++; }
    const air = !!(s.flags & 1) && !(s.flags & 4);
    if (this.air && !air && !tp) this.land();
    this.air = air;
    return s;
  }
  play(k, a) {
    if (!this.rig) return;
    if (k === 'j') { this.heard.jump++; this.sfx('jump', 0.6); }
    else if (k === 't') { this.anim.play('laugh'); this.say(Math.random() < 0.5 ? 'taunt' : 'laugh'); }
    else if (k === 'rc') this.recallEv(a);
    else if (k === 'rs') this.rise(a);
    else if (k === 'ix') this.itemFx(a);
    else if (NET_CAST.has(k)) Net.replay(this, k, a);   // a cast, a basic attack, a recast, a click: on its own kit
  }
  land() { if (this.anim) this.anim.play('land'); this.heard.land++; this.sfx('land', 0.45); }
  // up again at its fountain (rs): the ring and the sound (the body's own flash: RemotePlayerUnit.revived)
  rise(a) {
    const at = V3(a[0] / 100, 0, a[1] / 100); this.heard.rise = (this.heard.rise || 0) + 1;
    if (camera.position.distanceTo(at) > 60) return;
    FX2.ring(at, this.god === 'ullr' ? 'ullr' : 'thothGold', { radius: 3, dur: 0.6 });
    Sound.arena('respawn', { pos: at, gain: 0.6 });
  }
  // its items (ix): 0 a purchase, 1 a drink, 2 its relic (from x, z; to x, z in cm) - the look and the sound, where it stands
  // (what they do is its own page's: a shield, a sprint and a blink show in its pose, a frost's slow and blow come as cc / h)
  itemFx(a) {
    const it = ITEMS[a[1]]; if (!it) return;
    this.heard.item = (this.heard.item || 0) + 1;
    const p = this.pos, at = a.length > 3 ? V3(a[2] / 100, 0, a[3] / 100) : p.clone();
    if (camera.position.distanceTo(at) > 60 || !FX2.ready) return;
    const u = it.use;
    if (a[0] === 0) {
      FX2.ring(p, 'thothGold', { radius: 1.7, dur: 0.5 });
      FX2.burst(p.clone().setY(1.5), 'thothGold', { size: 0.4, sparks: 14, embers: 10, puffs: 0, bursts: 1, light: false, distort: false });
      Sound.arena('buff_pickup', { pos: p, gain: 0.4 });
    } else if (a[0] === 1) {
      FX2.burst(p.clone().setY(1.3), u === 'mana' ? 'thoth' : u === 'power' ? 'molten' : u === 'ward' ? 'thothGold' : 'turq', { size: 0.35, sparks: 10, embers: 10, puffs: 0, bursts: 1, light: false, distort: false });
    } else {
      if (u === 'bead') { FX2.burst(at.clone().setY(1.2), 'turq', { size: 0.8, sparks: 24, embers: 14, puffs: 1, bursts: 1, light: true }); FX2.ring(at, 'turq', { radius: 3, dur: 0.5 }); }
      else if (u === 'sprint') FX2.aura(p, 'thothGold', { radius: 0.8, height: 1.2, rate: 18, dur: 4 });
      else if (u === 'shield') FX2.aura(p, 'thothGold', { radius: 0.95, height: 2.2, rate: 14, dur: 3, int: 1.2 });
      else if (u === 'blink') {
        FX2.burst(at.clone().setY(1.1), 'hecate', { size: 0.6, sparks: 16, embers: 12, puffs: 2, bursts: 1, light: false });
        if (a.length > 5) FX2.burst(V3(a[4] / 100, 1.1, a[5] / 100), 'hecate', { size: 0.7, sparks: 20, embers: 12, puffs: 1, bursts: 1, light: true });
      } else if (u === 'frost') { FX2.ring(at, 'frost', { radius: 8, dur: 0.6 }); FX2.burst(at.clone().setY(1), 'frost', { size: 0.9, sparks: 26, embers: 18, puffs: 3, bursts: 1, light: true }); }
      Sound.arena('buff_pickup', { pos: at, gain: 0.5, rate: 1.2 });
    }
  }
  // its sounds, where it stands: the shared samples (jump, land), its god's footsteps and voice
  // an enemy hidden in the reeds from my team: not heard either
  hidden() { const u = this.unit; return !!(u && u.alive && Arena.active && u.team !== Arena.myTeam && u.seen && u.seen[Arena.myTeam] === false); }
  sfx(name, gain) { const b = Sound.sfx[name]; if (b && Sound.ctx && !this.hidden()) Sound.playBuf(b, { pos: _rav.copy(this.pos).setY(this.y + 0.3), gain, falloff: 10, maxDist: 45 }); }
  step(p) {
    const b = this.bank, n = `step${1 + Math.floor(Math.random() * 3)}`;
    if (!b || !b.gsfx[n] || !Sound.ctx || this.hidden()) return;
    this.heard.step++;
    Sound.playBuf(b.gsfx[n], { pos: p, gain: 0.32, rate: rand(0.92, 1.08), falloff: 7, maxDist: 30 });
  }
  say(group) {
    const b = this.bank; if (!b || !Sound.ctx || this.hidden()) return;
    const opts = (b.lines[group] || []).filter((n) => b.vox[n]); if (!opts.length) return;
    if (this.voiceH) this.voiceH.stop(0.12);
    this.heard.voice++;
    this.voiceH = Sound.playBuf(b.vox[pick(opts)], { pos: _rav.copy(this.pos).setY(this.y + 1.7), bus: Sound.voiceBus, falloff: 12, maxDist: 50 });
  }
  // recall (rc): 0 the channel opens at its feet, 1 broken, 2 home (from, to)
  recallEv(a) {
    const R = this.recall, b = this.unit || this, cam = camera.position;
    if (a[0] === 0) {
      if (R) Recall.stopFx(R.fx, false);
      const pos = V3(a[1] / 100, 0, a[2] / 100);
      this.recall = { t: 0, dur: RECALL.time, fx: Recall.channelFx(pos, 0.6, b) };
      this.heard.recall++;
      if (cam.distanceTo(pos) < 45) Sound.arena('ankh_spawn', { pos, gain: 0.35 });
    } else if (a[0] === 1) { if (R) { Recall.stopFx(R.fx, false); this.recall = null; } }
    else {
      if (R) Recall.stopFx(R.fx, true);
      this.recall = null;
      const from = V3(a[1] / 100, 0, a[2] / 100), to = V3(a[3] / 100, 0, a[4] / 100);
      if (cam.distanceTo(from) < 60) Recall.flashAt(from, 0.6);
      if (cam.distanceTo(to) < 60) { Recall.arrive(to, 0.6); Sound.arena('respawn', { pos: to, gain: 0.6 }); }
    }
  }
  // the rig where the pose says, the animator (lighter far away), the fall, the hit flash, the recall channel
  // (with a kit: run inside its sandbox, with the kit's current rig (Ullr's clown) and the kit's own tilt kx, kz)
  pose(dt, t, rig = this.rig, a = this.anim, kx = 0, kz = 0) {
    if (!rig) return;
    const u = this.unit, s = this.ps, root = rig.root;
    if (u) { this.onScreen = u.onScreen; this.camDist = u.camDist; } else { this.camDist = camera.position.distanceTo(this.pos); this.onScreen = this.camDist < 90; }
    const dead = u ? u.dead : !!(s && s.flags & 4), dT = u ? u.deathT : 9;
    // a kit's wobble on the unit's group (Bacchus' drunks) tilts the god in place (the group itself stays put)
    let wx = 0, wz = 0;
    if (this.parent !== scene && (this.parent.rotation.x || this.parent.rotation.z)) { wx = this.parent.rotation.x; wz = this.parent.rotation.z; this.parent.rotation.set(0, 0, 0); }
    // fallen: it topples and sinks into the sand (as a bot god), and stands up again on its next life
    let sink = 0, tip = 0;
    if (dead) { tip = -easeInCubic(Math.min(1, dT / 0.9)) * 1.45; sink = smoothstep(1.4, 3, dT) * 1.2; }
    root.rotation.set(tip + wx + kx, this.ry, wz + kz);
    root.position.set(this.pos.x, this.y - sink, this.pos.z);
    // far away or out of sight: the animator runs every 2nd to 4th frame (meanwhile the book is carried along; never
    // while its kit is busy with a cast that poses the body)
    this.animAcc += dt;
    const skip = this.ctx && Net.ctx === this.ctx && kitBusy() ? 1 : !this.onScreen ? 4 : this.camDist > 60 ? 3 : this.camDist > 32 ? 2 : 1;
    if (++this.frameSkip >= skip) {
      this.frameSkip = 0;
      a.update(this.animAcc, { vel: dead || !s ? _rav0.set(0, 0, 0) : this.vel, runSpeed: s ? s.run : 5, airborne: this.air, vy: s ? s.vy : 0, aimPitch: s ? s.pitch : 0, eyeBoost: s ? s.eye : 0 });
      this.animAcc = 0;
    } else if (this.book) this.book.group.position.add(_rav.copy(root.position).sub(this.at));
    this.at.copy(root.position);
    const f = u ? u.flash : 0, m = rig.material;
    if (m && m.userData.flash) m.userData.flash.value.setRGB(f * 0.5, f * 0.25, f * 0.15);
    const R = this.recall;
    if (R) {
      R.t += dt;
      if (dead || R.t > R.dur + 1.5 || (s && !(s.flags & 16) && R.t > 1)) { Recall.stopFx(R.fx, false); this.recall = null; }   // (its stop was lost)
      else Recall.tickFx(R.fx, R.t / R.dur, dt, 0.6, u || this);
    }
  }
  update(dt, t) { this.sample(); this.pose(dt, t); }   // (without a unit: a page that only draws the player)
}

// another human in the shared Arena: what the bots, minions and kits see and hit. Its owner's page plays the
// god; here its RemoteActor draws it (the unit's pos is the actor's). Damage, crowd control, heals and gifts are
// sent to the owner; its health is the owner's.
class RemotePlayerUnit extends ArenaUnit {
  constructor(peer, team, slot, god, nick) {
    const seq = arenaUnitSeq;
    super(team, 'god', { name: `${nick || 'Player'} (${GODS[god] ? GODS[god].name : god})`, radius: 0.45, height: 2.0, hp: 500, speed: 5 });
    arenaUnitSeq = seq;   // (a stand-in takes no unit number: every page numbers the host's units the same way)
    Object.assign(this, { id: -(1 + team * 5 + slot), isRemotePlayer: true, replica: false, peer, god, slot, nick: nick || 'Player',
      level: 3, xp: 0, k: 0, d: 0, a: 0, spree: 0, multi: 0, multiT: -99, respawnHalf: false, buffs: {}, present: false, dead: false, y: 0, deathT: 9, ps: null, away: false });
    this.actor = new RemoteActor(peer, god, { parent: this.mesh, pos: this.pos, unit: this });
    Net.armForwarding(this);   // (crowd control and displacements on it: shown here, applied by its owner)
  }
  get rig() { return this.actor.rig; }
  get anim() { return this.actor.anim; }
  // its items: its owner's state (iv, ITEMS indices; the auras, the scoreboard, a starter's minion gold)
  get inv() { return Net.invOf(this.peer); }
  // health is the owner's (its pose); a heal written here goes to the owner (damage is routed before it gets here)
  get hp() { return this.netHp || 0; }
  set hp(v) {
    if (this.netHp === undefined || !this.present) { this.netHp = v; return; }
    if (v > this.netHp + 0.5) Net.heal(this, v - this.netHp);
  }
  get alive() { return this.present && !this.dead; }
  set alive(v) { /* (its owner's page decides) */ }
  applyLevel() { /* (its owner levels the god; the host's bot table carries the level) */ }
  onHit() { this.flash = 1; }
  update(dt, t) {
    const st = Net.stateOf(this.peer), A = this.actor, was = this.present;
    this.present = !!(Net.match && st && st.r === 'play' && st.mi === Net.match.id && Net.peers.has(this.peer));
    if (was && !this.present && !this.dead && this.mesh.visible && A.near(45)) FX2.burst(this.pos.clone().setY(1.1), 'thothGold', { size: 0.7, sparks: 16, embers: 8, puffs: 1, bursts: 1, light: false, distort: false });   // (it left)
    // its god (the player may switch); gone from the match (the lobby, the room) a moment: its avatar goes too (and
    // comes back with it)
    if (this.present) { this.absentT = 0; this.lastInv = this.inv; const g = GODS[st.g] ? st.g : this.god; if (g !== A.want || !A.rig) A.setGod(g); }   // (its items stay known: a bot that takes over its slot gets them)
    else if (A.rig && (this.absentT = (this.absentT || 0) + dt) > 2) A.free();
    if (A.god && A.god !== this.god) { this.god = A.god; this.name = `${this.nick} (${GODS[A.god].name})`; }
    // (a kit of mine just moved it: it stays there until its owner's pose has caught up)
    const pin = this.netPin > performance.now(), px = this.pos.x, pz = this.pos.z;
    const s = this.ps = A.sample();
    if (pin) { this.pos.x = px; this.pos.z = pz; }
    if (s) {
      this.y = s.y; if (!pin) { Net.quiet++; this.lift = Math.max(0, s.y); Net.quiet--; } this.facing = s.ry;
      this.velocity.set(s.vx, 0, s.vz);
      if (this.netHp !== undefined && s.hp < this.netHp - 0.5 && !(s.flags & 4)) this.flash = 1;   // (hurt, by whatever: the hit flash)
      this.netHp = s.hp; this.maxHp = Math.max(1, s.maxHp);   // (the level is the host's: its experience, or its bot table)
      this.physProt = s.pp; this.magProt = s.mp; this.shield = s.shield; this.away = !!(s.flags & 8);
      const dead = !!(s.flags & 4) || (this.dead && s.t <= (this.deadMs || 0));   // (the host heard of the death before the pose shows it)
      if (dead !== this.dead) { this.dead = dead; this.deathT = 0; if (dead) { this.clearStatus(); Net.kitReset(A); } else this.revived(); }   // (its kit starts over, as the owner's does)
    }
    if (this.dead) this.respawn = Math.max(0, (this.respawn || 0) - dt);
    this.deathT += dt;
    this.dying = this.dead ? Math.max(0, 3 - this.deathT) : 0;   // (the body stays in sight while it topples)
    this.tickStatus(dt, t);
    if (A.ctx) Net.tickKit(A, dt, t); else A.pose(dt, t);   // (its kit's frame, then the pose: in its sandbox)
  }
  revived() {
    const a = this.actor; if (a.anim) { a.anim.firstFrame = true; a.anim.actions = []; }
    if (this.camDist < 40) FX2.burst(this.pos.clone().setY(1.2), 'thothGold', { size: 0.7, sparks: 16, embers: 8, puffs: 0, bursts: 1, light: false, distort: false });
  }
  dispose() { Net.dropCtx(this.actor); super.dispose(); this.actor.dispose(); }   // (its kit lets go first: it still holds the rig)
}

// ---- the host's units on a client: they follow the snapshots (Net.follow); deaths, revivals, attacks and
// statuses come from them too (Net.applyRec), casts and basic attacks from the host's events
BotGod.prototype.replicaUpdate = function (dt, t) {
  this.tickStatus(dt, t);
  for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] -= dt;
  if (!this.alive) { if (this.dying > 0) this.updateDead(dt, t); return; }   // (it rises again when the host's snapshot says so)
  this.castLock = Math.max(0, this.castLock - dt);
  if (this.recall) { this.recall.t += dt; Recall.tickFx(this.recall.fx, this.recall.t / this.recall.dur, dt, 0.4, this); }
  // a replayed leap or dash: the host's snapshots carry the flight (and its height); here only the belly flop's
  // tilt and the landing's effects, on time
  const M = this.motion;
  if (M) {
    M.t += dt; const k = Math.min(1, M.t / M.dur);
    if (M.flop) this.rig.root.rotation.x = Math.sin(k * Math.PI) * 1.1;
    if (k >= 1) { this.rig.root.rotation.x = 0; this.motion = null; }
  }
  Net.follow(this, dt);
  if (M && !this.motion && M.done) M.done();
  this.pose(dt, t);
};
Minion.prototype.replicaUpdate = function (dt, t) {
  this.tickStatus(dt, t);
  if (this.rig) this.rig.update(dt * (this.onScreen ? 1 : 0.5));
  if (!this.alive) { this.updateDead(dt); return; }
  this.atkCd = Math.max(0, this.atkCd - dt);
  Net.follow(this, dt);
  this.pose(dt, t);
};
// (Siege and CampMob: after their own status tick, animation and death)
Siege.prototype.replicaUpdate = function (dt, t) {
  this.introT -= dt; this.atkCd = Math.max(0, this.atkCd - dt);
  Net.follow(this, dt);
  const v = Math.hypot(this.velocity.x, this.velocity.z);
  if (this.atkCd > 1.0 || this.introT > 0) { /* a swing or the roar is playing over the idle */ }
  else if (v > 0.2) this.rig.loop('walk', 0.35, clamp(v / this.walkSpeed, 0.5, 1.6)); else this.rig.loop('idle', 0.4);
  for (const m of this.rig.mats) m.emissiveIntensity = 0.1 + this.flash * 0.5;
  this.mesh.position.set(this.pos.x, 0, this.pos.z); this.rig.root.rotation.y = this.facing;
};
CampMob.prototype.replicaUpdate = function (dt, t) {
  this.atkCd = Math.max(0, this.atkCd - dt);
  Net.follow(this, dt);
  const v = Math.hypot(this.velocity.x, this.velocity.z);
  if (this.big) { if (this.atkCd < 1.1 && this.atkCd > 0.4) { /* swinging */ } else if (v > 0.3) this.rig.loop('walk', 0.3, clamp(v / this.walkSpeed, 0.6, 1.8)); else this.rig.loop('idle', 0.4); }
  else if (this.rig.current === this.rig.acts.walk) this.rig.acts.walk.timeScale = v > 0.2 ? clamp(v / this.walkSpeed, 0.4, 3) : 0.35;
  for (const m of this.rig.mats) m.emissiveIntensity = 0.18 + 0.08 * Math.sin(t * 2 + this.id) + this.flash * 0.5;
  this.mesh.position.set(this.pos.x, this.lift, this.pos.z); this.rig.root.rotation.y = this.facing;
};
// (a replica's own bookkeeping is never sent back to the host as a kit's doing: Net.quiet)
for (const C of [BotGod, Minion, Siege, CampMob]) {
  const f = C.prototype.replicaUpdate;
  C.prototype.replicaUpdate = function (dt, t) { Net.quiet++; try { return f.call(this, dt, t); } finally { Net.quiet--; } };
}

// ---- the host's side: who attacked what (snapshots count attacks), what a bot does (events), the end
{
  const A = Arena, host = () => Net.online && Net.match && Net.isHost;
  for (const C of [Minion, CampMob]) {
    const at0 = C.prototype.attack;
    C.prototype.attack = function (tg) { if (Net.online) { this.atkN = ((this.atkN || 0) + 1) & 255; this.netTg = Net.idOf(tg); } return at0.call(this, tg); };
  }
  const st0 = Siege.prototype.stomp;
  Siege.prototype.stomp = function () { if (Net.online) this.atkN = ((this.atkN || 0) + 1) & 255; return st0.call(this); };
  const BP = BotGod.prototype, ba0 = BP.basicAttack;
  BP.basicAttack = function (tg) { if (host() && !this.replica) Net.emit('ba', this.id, Net.idOf(tg), this.atkI); return ba0.call(this, tg); };
  // a bot's cast: its aim (the target's position and velocity) and a seed for its rolls, so every page draws the same
  const bc0 = BotCast.cast;
  BotCast.cast = function (b, a, tg) {
    if (!host() || b.replica) return bc0.call(this, b, a, tg);
    const rs = (Math.random() * 4294967296) >>> 0, v = tg.velocity;
    Net.emit('bc', b.id, b.bk.abil.indexOf(a), Net.idOf(tg), netQ(tg.pos.x * 100), netQ(tg.pos.z * 100), netQ((v ? v.x : 0) * 100), netQ((v ? v.z : 0) * 100), rs);
    b.castRng = mulberry32(rs);
    try { return bc0.call(this, b, a, tg); } finally { b.castRng = null; }
  };
  // kills: who killed whom, with the assists (for the killer's page; the feed line itself is an fd event)
  const gd0 = A.godDied;
  A.godDied = function (v, killer) {
    if (!host()) return gd0.call(this, v, killer);
    const vTeam = v.team, now = Combat.time;
    let kg = killer && killer.isGod ? killer : null;
    if (!kg) { let bt = -1; for (const [g, t] of v.dmgBy) if (g.team !== vTeam && now - t < 10 && t > bt && g.alive !== undefined) { bt = t; kg = g; } }
    const assists = [];
    for (const [g, t] of v.dmgBy) if (g !== kg && g.team !== vTeam && now - t < 10) assists.push(g);
    const r = gd0.call(this, v, killer);
    Net.emit('kd', Net.idOf(v), Net.idOf(kg || killer), ...assists.map((g) => Net.idOf(g)));
    // (the scores it made, as they stand now: every scoreboard has them at once)
    const sc = [];
    for (const g of new Set([v, kg || killer, ...assists])) { const s = g === A.pu ? A.pstats : g; if (s && s.k !== undefined && (g === A.pu || g.isGod)) sc.push(Net.idOf(g), s.k, s.d, s.a); }
    if (sc.length) Net.emit('sc', ...sc);
    if (v.isRemotePlayer || v === A.pu) Net.slain(v, kg || killer, v.pos.clone());   // (a bot's fall: onUnitDied below)
    return r;
  };
  // a unit felled by another human: its page gets the killer's side (ku; a god's comes with its kd), and its god's
  // flourish plays here too
  const ud0 = A.onUnitDied;
  A.onUnitDied = function (u) {
    const killer = host() && u.lastAttacker && Combat.time - u.lastAttackT < 12 ? u.lastAttacker : null, p = u.pos.clone();
    const r = ud0.call(this, u);
    if (killer && killer.isRemotePlayer) {
      if (u.kind !== 'god') Net.emit('ku', u.id, killer.id, Net.cm(p.x), Net.cm(p.z));
      Net.slain(u, killer, p);
    }
    return r;
  };
  const mp0 = A.minionThroughPortal;
  A.minionThroughPortal = function (m) { if (m.alive) m.netWhy = 1; return mp0.call(this, m); };
  const sp0 = A.siegeThroughPortal;
  A.siegeThroughPortal = function (s) { if (s.alive) s.netWhy = 2; return sp0.call(this, s); };
  const end0 = A.end;
  A.end = function (winner) {
    const was = this.phase, r = end0.call(this, winner);
    if (host() && was === 'play' && this.phase === 'ended') { Net.emit('end', winner, this.tickets[0], this.tickets[1]); if (Net.st.m) Net.set({ m: { ...Net.st.m, win: winner } }); }
    return r;
  };
  // the crowd: the host's roars reach every page (a client's own copies of the rules stay quiet)
  const roar0 = ArenaMap.roar;
  ArenaMap.roar = function (sec = 3, fromNet = false) {
    if (Net.online && Net.match && Arena.active) { if (!Net.isHost && !fromNet) return; if (Net.isHost) Net.emit('rr', sec); }
    return roar0.call(this, sec);
  };
  // levels: every god's level-up goes out at once (lv: its id, the level); the bot table carries them too
  const gx0 = A.gainXp;
  A.gainXp = function (g, amt) {
    const L = g && g.level, r = gx0.call(this, g, amt);
    if (host() && g && g.level !== L) Net.emit('lv', Net.idOf(g), g.level);
    return r;
  };
  // my items' look for the others (ix): a purchase, a drink, the relic (what they do is my page's, or goes out as cc / h)
  const I = Items, pf0 = I.purchaseFx, uc0 = I.useCons, ur0 = I.useRelic;
  I.purchaseFx = function (it) { const r = pf0.call(this, it); Net.act('ix', 0, ITEMS.indexOf(it)); return r; };
  I.useCons = function (i) { const c = this.cons[i], r = uc0.call(this, i); if (r && c) Net.act('ix', 1, ITEMS.indexOf(ITEM[c.id])); return r; };
  I.useRelic = function () {
    const id = this.relic, x = P.pos.x, z = P.pos.z, r = ur0.call(this);
    if (r && id) Net.act('ix', 2, ITEMS.indexOf(ITEM[id]), Net.cm(x), Net.cm(z), Net.cm(P.pos.x), Net.cm(P.pos.z));
    return r;
  };
}

Object.assign(Net, {
  snaps: [], tq: [], wa: null, wb: null, wk: 0, rt: 0, rtAt: 0, rep: new Map(), made: new Set(), known: new Map(), poses: new Map(),
  dq: new Map(), hq: new Map(), cq: new Map(), pq: new Map(), held: new Set(), quiet: 0, dqAt: 0, hqAt: 0, wOut: null, btOut: null, btIn: null, wHist: [], wAt: 0, btAt: 0, poseAt: 0, waveFx: [0, 0], wired: false,

  // ---------------------------------------------------------------- the match's units and ids
  resetWorld() {
    Object.assign(this, { snaps: [], tq: [], wa: null, wb: null, wk: 0, rt: 0, rtAt: 0, late: 0, lates: [], rep: new Map(), made: new Set(), known: new Map(), poses: new Map(),
      dq: new Map(), hq: new Map(), cq: new Map(), pq: new Map(), held: new Set(), quiet: 0, wOut: null, btOut: null, btIn: null, wHist: [], wAt: 0, btAt: 0, poseAt: 0, poseDue: false, waveFx: [0, 0], winSeenT: 0 });
    if (this.st) { delete this.st.s; delete this.st.iv; }
    this.ivKey = '';
  },
  // set up (Arena.setupMatch): the units the host and I made the same way (bots, camps) are known by their numbers
  matchReady() {
    for (const u of Arena.units) {
      if (u.isRemotePlayer) continue;
      if (this.isHost) { if (u.replica) this.own(u); this.known.set(u.id, u); }   // (the host left while I was loading: the units are mine)
      else if (u.replica) { this.rep.set(u.id, u); this.made.add(u.id); this.armForwarding(u); }
    }
  },
  makeHuman(m, team, slot) { return new RemotePlayerUnit(m.own[team][slot], team, slot, m.roster[team][slot], m.nm[team][slot]); },
  ownsTarget(u) { return !u.replica && !u.isRemotePlayer; },
  idOf(u) { return !u ? 0 : u.isFountain ? NET_FOUNT + u.team : typeof u.id === 'number' ? u.id : 0; },
  unit(id) {
    if (!id || !(Arena.active || Arena.waiting)) return null;
    if (id === this.myUid) return Arena.pu;
    if (id >= NET_FOUNT) return Arena.fountainUnits[id - NET_FOUNT] || null;
    if (id < 0) return Arena.humans.find((h) => h.id === id) || null;
    const u = (this.isHost ? this.known : this.rep).get(id);
    return u && !u.gone ? u : null;
  },
  humanOf(peer) { return Arena.humans.find((h) => h.peer === peer) || null; },

  // ---------------------------------------------------------------- blows, crowd control, heals and gifts to their owners
  // Who decides: a unit's hits, crowd control and displacements are applied by its owner (the host for its units, each
  // human for its own god); the page whose kit lands them shows them at once (the number, the sound, the kit's own
  // reaction, the status) and sends them: h hits, cc crowd control, dp displacements, all merged per target and sent
  // every 50 ms. Deaths are the owners' too: a client's god falls on its own page (die), every other unit on the host
  // (Arena.applyHit); the host credits the kill (kd for a god, ku for anything else felled by another human), and the
  // killer's page runs the killer's side (Net.slain): its kit's kill reaction, Dead Reckoning, the items, the minion
  // count; the god's flourish (Kit.onDummyDeath) plays on every page.
  // my kit's hit on another page's unit or player (Combat.deal): merged per target (crit: the hit's flag)
  hit(u, amt, kind, crit = false) {
    if (u.team === Arena.myTeam && u.isRemotePlayer) return;   // (never a team-mate)
    const q = this.hq.get(u.id), k = Math.max(0, NET_HITK.indexOf(kind));
    if (q) { q[0] += amt; q[1] = Math.max(q[1], k); q[2] |= crit ? 1 : 0; } else this.hq.set(u.id, [amt, k, crit ? 1 : 0]);
  },
  // Arena.hurt on someone else's: the host's units hitting a human, or my own blow through the arena's rules
  hitOther(u, amt, src, o = {}) {
    if (src && src === Arena.pu) { this.hit(u, amt, o.basic ? 'basic' : 'proc'); return amt; }
    if (u.isRemotePlayer && this.isHost) return this.sendDamage(u, amt, src, o);
    return 0;
  },
  sendDamage(h, amt, src, o = {}) {
    const flags = (o.physical ? 1 : 0) | (o.true ? 2 : 0) | (o.silent ? 4 : 0) | (o.basic ? 8 : 0), sid = this.idOf(src), key = `${h.id}:${sid}:${flags}`;
    const q = this.dq.get(key); if (q) q[1] += amt; else this.dq.set(key, [h.id, amt, sid, flags]);
    h.flash = 1; h.lastHit = Combat.time;
    return amt;
  },
  // crowd control on another page's unit or player (codes: 1 stun 2 freeze 3 mesmerize 4 blind 5 root 6 slow
  // 7 mark 8 antiheal 9 drunk 10 gas): the longest of each kind per target, sent every 50 ms
  cc(h, code, t, amt = 0) {
    if (!this.online || !this.match || !h || !(t > 0) || h.id === undefined) return;
    const key = `${h.id}:${code}`, q = this.cq.get(key);
    if (q) { q[2] = Math.max(q[2], t); q[3] = Math.max(q[3], amt || 0); } else this.cq.set(key, [h.id, code, t, amt || 0, h]);
  },
  // ... and a displacement (bits: 1 placed, 2 carried / lifted, 4 slid): its latest place, sent every 50 ms
  disp(u, bit, v = null) {
    if (!this.online || !this.match || u.heavy) return;
    const q = this.pq.get(u.id) || { u, fl: 0, sx: 0, sz: 0 };
    q.fl |= bit; if (v) { q.sx = v.x; q.sz = v.z; }
    this.pq.set(u.id, q);
    u.netPin = performance.now() + 900;   // (held where my kit put it until the owner's picture catches up)
  },
  // a replica or another player's stand-in: crowd control, displacements and what a kit writes straight on it are
  // shown here and sent to its owner (per instance: the host's own units stay as they are). Net.quiet: my own
  // bookkeeping (snapshots, poses, the timers running out) is never sent
  armForwarding(u) {
    if (u.netArmed) return;
    u.netArmed = true;
    const N = this, cc = { applyStun: 1, freeze: 2, mesmerize: 3, blinded: 4, rooted: 5, slowed: 6, marked: 7 };
    for (const [k, code] of Object.entries(cc)) {
      const f = u[k];
      u[k] = function (a, b) {
        if (!this.alive) return;
        N.quiet++; let r; try { r = f.call(this, a, b); } finally { N.quiet--; }
        if (!N.quiet) { if (code === 6) N.cc(this, 6, b, a); else N.cc(this, code, a, code === 7 ? b : 0); }
        return r;
      };
    }
    for (const k of ['placeAt', 'shove']) { const f = u[k]; u[k] = function (p, hold) { const r = f.call(this, p, hold); if (!N.quiet && this.alive) N.disp(this, 1); return r; }; }
    const sl = u.slideAlong;
    u.slideAlong = function (v, hold) { const r = sl.call(this, v, hold); if (!N.quiet && this.alive) N.disp(this, 4, v); return r; };
    const cs = u.clearStatus;
    u.clearStatus = function () { N.quiet++; try { return cs.call(this); } finally { N.quiet--; } };
    // the fields the kits write straight (Thoth's root and slow, Hel's antiheal, Bacchus' drunks and gas, carries, lifts)
    const fields = { stun: 1, root: 5, slow: 6, antiheal: 8, drunk: 9, gas: 10 };
    for (const [k, code] of Object.entries(fields)) {
      let v = u[k] || 0;
      Object.defineProperty(u, k, { configurable: true, enumerable: true, get: () => v,
        set(x) { const o = v; v = x; if (!N.quiet && x > o + 0.05 && this.alive) N.cc(this, code, x, code === 6 ? this.slowAmt : 0); } });
    }
    let lift = u.lift || 0, carried = !!u.carried;
    Object.defineProperty(u, 'lift', { configurable: true, enumerable: true, get: () => lift, set(x) { const o = lift; lift = x; if (!N.quiet && Math.abs(x - o) > 0.01) N.disp(this, 2); } });
    Object.defineProperty(u, 'carried', { configurable: true, enumerable: true, get: () => carried, set(x) { const o = carried; carried = !!x; if (!N.quiet && carried !== o) N.disp(this, 2); } });
  },
  heal(h, amt) { if (this.online && this.match && amt >= 1) this.emit('hl', h.id, netQ(amt)); },
  gift(h, kind, arg = '') { if (this.online && this.match) this.emit('gf', h.id, kind, arg); },
  // the host: gold for another human (why: 1 a kill, 2 an assist, 3 a minion, 4 a camp, 5 Sebek), at the place it was earned
  gold(h, amt, at, why = 0) { if (this.online && this.match && amt) this.emit('gd', h.id, netQ(amt), at ? this.cm(at.x) : null, at ? this.cm(at.z) : null, why); },
  // ... on its owner's page: its own gold (and the team's news of a fallen Sebek)
  onGold(a) {
    if (a[0] !== this.myUid || !Arena.active || Arena.phase !== 'play') return;
    Items.addGold(Arena.pu, a[1], a[2] === null ? null : V3(a[2] / 100, 0, a[3] / 100));
    if (a[4] === 5) HUD.toast(`The Sebek colossus fell · +${a[1]} gold for the team`);
  },
  // my items in my state (iv: ITEMS indices of the six slots, -1 empty; then the relic): the others' auras and scoreboards
  syncInv() {
    const iv = [...Items.slots, Items.relic].map((id) => (id && ITEM[id] ? ITEMS.indexOf(ITEM[id]) : -1)), key = iv.join();
    if (key !== this.ivKey) { this.ivKey = key; this.set({ iv }); }
  },
  // another player's items (its state; the relic left out), as item ids
  invOf(peer) {
    const st = this.stateOf(peer), iv = st && Array.isArray(st.iv) ? st.iv : null;
    if (!iv) return [];
    const c = this.invC || (this.invC = new Map()), hit = c.get(peer);
    if (hit && hit.iv === iv) return hit.inv;
    const inv = iv.slice(0, 6).map((i) => ITEMS[i] && ITEMS[i].cat !== 'relic' && ITEMS[i].cat !== 'cons' ? ITEMS[i].id : null).filter(Boolean);
    c.set(peer, { iv, inv });
    return inv;
  },
  // the host's word on a level-up (lv): mine at once; another god's when my picture gets there
  levelTo(L) {
    const A = Arena;
    if (!A.pu || !A.pstats || !(L > A.pu.level) || L > 20) return;
    A.pu.xp = 0; A.setPlayerLevel(L);
  },
  leveled(a) {
    const u = this.unit(a[0]); if (!u || u === Arena.pu || !(a[1] > (u.level || 0))) return;
    u.level = a[1];
    if (u.alive && u.mesh && u.mesh.visible && u.camDist < 30) FX2.ring(u.pos, 'thothGold', { radius: 1.6, dur: 0.6 });
  },
  // a client: the scores a kill made on the host (sc: id, kills, deaths, assists) reach my scoreboard at once (its bot
  // table says the same a moment later; scores only ever go up in a match)
  scores(a) {
    const A = Arena;
    for (let i = 0; i + 4 <= a.length; i += 4) {
      const s = a[i] === this.myUid ? A.pstats : this.unit(a[i]);
      if (!s || s.k === undefined) continue;
      s.k = Math.max(s.k, a[i + 1]); s.d = Math.max(s.d, a[i + 2]); s.a = Math.max(s.a, a[i + 3]);
    }
  },
  // the end screen (online): the host starts the next match from here; the others wait for it, or go to the lobby
  // (to change team or god: the host's next match takes them from there)
  endNote() {
    const E = Arena.ui && Arena.ui.end; if (!E || E.hidden) return;
    let n = E.querySelector('.netNote');
    if (!n && !this.online) return;
    if (!n) { n = document.createElement('div'); n.className = 'netNote'; E.querySelector('.row').before(n); }
    n.textContent = !this.online ? '' : this.isHost ? 'You are the host: start a new match for everyone in the room, or go to the lobby'
      : this.match ? 'Waiting for the host to start a new match · in the lobby you can switch teams and gods'
      : 'The host is back in the lobby · go to the lobby for the next match';
  },
  died(src) { if (this.online && this.match) this.emit('die', this.idOf(src)); },
  flushOut(now) {
    if (now - this.hqAt >= 50 && (this.hq.size || this.cq.size || this.pq.size)) {
      this.hqAt = now;
      if (this.hq.size) { const a = []; for (const [id, q] of this.hq) a.push(id, Math.max(1, netQ(q[0])), q[1], q[2]); this.hq.clear(); this.emit('h', ...a); }
      if (this.cq.size) {
        const a = [];
        for (const q of this.cq.values()) { if (q[1] === 6) q[3] = Math.max(q[3], q[4].slowAmt || 0); else if (q[1] === 7) q[3] = Math.max(q[3], q[4].markAmp || 0); a.push(q[0], q[1], netQ(q[2] * 100), netQ(q[3] * 100)); }
        this.cq.clear(); this.emit('cc', ...a);
      }
      if (this.pq.size) {
        const a = [];
        for (const q of this.pq.values()) { const u = q.u; a.push(u.id, q.fl, netQ(u.pos.x * 10), netQ(u.pos.z * 10), netQ((u.lift || 0) * 100), u.carried ? 1 : 0, netQ(q.sx * 10), netQ(q.sz * 10)); }
        this.pq.clear(); this.emit('dp', ...a);
      }
    }
    if (this.dq.size && now - this.dqAt >= 100) { this.dqAt = now; for (const q of this.dq.values()) this.emit('dmg', q[0], Math.max(1, netQ(q[1])), q[2], q[3]); this.dq.clear(); }
    // (the host: a carry whose end never came lets go)
    if (this.held.size) for (const u of this.held) if (now - u.netHeldAt > 3000 || !u.alive || u.gone) { this.held.delete(u); u.carried = false; u.lift = 0; }
  },
  // the sender of a blow, a crowd control or a displacement on a unit of team `team`: a human of the other team (the
  // host's own bots' blows on a human come from the host)
  foeOf(peer, team) { const s = this.humanOf(peer); return s && s.team !== team ? s : null; },
  // players' hits (every page sees them): mine if aimed at me; the host applies those on its units
  onHit(peer, a) {
    if (!this.match || !Arena.active || Arena.phase !== 'play') return;
    for (let i = 0; i + 4 <= a.length; i += 4) {
      const tid = a[i], amt = a[i + 1], kc = a[i + 2], fl = a[i + 3];
      if (tid === this.myUid) {
        const src = this.foeOf(peer, Arena.myTeam);
        if (P.dead || !src) continue;
        const pu = Arena.pu; pu.dmgBy.set(src, Combat.time); pu.lastAttacker = src; pu.lastAttackT = Combat.time;
        const n = Combat.texts.length;
        Arena.damagePlayer(amt, src, { basic: kc === 0 });
        if (fl & 1 && Combat.texts.length > n) { const tx = Combat.texts[Combat.texts.length - 1]; tx.text += '!'; tx.big = true; }   // (a critical blow)
        continue;
      }
      if (!this.isHost) continue;
      const u = this.unit(tid);
      if (!u || !u.alive || u === Arena.pu) continue;
      const src = this.foeOf(peer, u.team);
      if (!src || Math.hypot(src.pos.x - u.pos.x, src.pos.z - u.pos.z) > 120) continue;   // (never a team-mate; nothing from across the world)
      u.dmgBy.set(src, Combat.time); u.lastAttacker = src; u.lastAttackT = Combat.time;
      if (u.isRemotePlayer) continue;   // (its own page takes the blow; the host keeps the credit)
      Arena.applyHit(u, amt, src);
      if (u.onHit) u.onHit(NET_HITK[kc] || 'ability');
    }
  },
  // the host's unit hit me
  onDamage(a) {
    if (a[0] !== this.myUid || !Arena.active || Arena.phase !== 'play' || P.dead) return;
    const src = this.unit(a[2]), f = a[3];
    if (src && src.team === Arena.myTeam) return;
    if (src && src.isGod) Arena.pu.dmgBy.set(src, Combat.time);
    if (src) { Arena.pu.lastAttacker = src; Arena.pu.lastAttackT = Combat.time; }
    Arena.damagePlayer(a[1], src, { physical: !!(f & 1), true: !!(f & 2), silent: !!(f & 4), basic: !!(f & 8) });
  },
  // crowd control: on me (from the host's units, or from a human of the other team), or by the host on its units
  onCC(peer, a) {
    if (!this.match || !Arena.active || Arena.phase !== 'play') return;
    for (let i = 0; i + 4 <= a.length; i += 4) {
      const id = a[i], code = a[i + 1], t = a[i + 2] / 100, amt = a[i + 3] / 100;
      if (!(t > 0)) continue;
      if (id === this.myUid) {
        if (P.dead || (peer !== this.hostId && !this.foeOf(peer, Arena.myTeam))) continue;
        const pu = Arena.pu;
        if (code === 1 || code === 3) pu.applyStun(t); else if (code === 2) pu.freeze(t); else if (code === 4) pu.blinded(t);
        else if (code === 5) pu.rooted(t); else if (code === 6) pu.slowed(amt, t); else if (code === 8) Items.antihealT = Math.max(Items.antihealT || 0, t);
        continue;
      }
      if (!this.isHost) {
        // (a mark on the host's unit: its strength in my picture too - my blows on it count it, as the host's do; the
        // snapshot only has the flag)
        if (code === 7) { const u = this.unit(id); if (u && u.alive && u.replica && this.foeOf(peer, u.team)) { u.markT = Math.max(u.markT || 0, t); u.markAmp = Math.max(u.markAmp || 0, amt); } }
        continue;
      }
      const u = this.unit(id);
      if (!u || !u.alive || u.isRemotePlayer || u === Arena.pu || !this.foeOf(peer, u.team)) continue;
      if (code === 1) u.applyStun(t); else if (code === 2) u.freeze(t); else if (code === 3) u.mesmerize(t); else if (code === 4) u.blinded(t);
      else if (code === 5) u.rooted(t); else if (code === 6) u.slowed(amt, t); else if (code === 7) u.marked(t, amt);
      else if (code === 8) u.antiheal = Math.max(u.antiheal || 0, t); else if (code === 9) u.drunk = Math.max(u.drunk || 0, t); else if (code === 10) u.gas = Math.max(u.gas || 0, t);
    }
  },
  // displacements: on me, or by the host on its units (they hold still a moment; a carry holds them until it ends)
  onDisp(peer, a) {
    if (!this.match || !Arena.active || Arena.phase !== 'play') return;
    for (let i = 0; i + 8 <= a.length; i += 8) {
      const id = a[i], fl = a[i + 1], x = a[i + 2] / 10, z = a[i + 3] / 10, lift = a[i + 4] / 100, carried = !!a[i + 5], sx = a[i + 6] / 10, sz = a[i + 7] / 10;
      if (id === this.myUid) {
        if (P.dead || !this.foeOf(peer, Arena.myTeam)) continue;
        if (fl & 1 && Math.hypot(x - P.pos.x, z - P.pos.z) < 30) { P.pos.x = x; P.pos.z = z; resolveCircle(P.pos, 0.45); }
        if (fl & 4) { P.pos.x += sx * 0.35; P.pos.z += sz * 0.35; resolveCircle(P.pos, 0.45); }
        if (fl & 2) {
          if (carried) P.rootT = Math.max(P.rootT, 0.3);
          if (lift > 0.05 && !P.flying) { P.y = Math.max(P.y, lift); P.grounded = false; P.vy = Math.max(P.vy, 0); }
        }
        continue;
      }
      if (!this.isHost) continue;
      const u = this.unit(id);
      if (!u || !u.alive || u.isRemotePlayer || u === Arena.pu || !this.foeOf(peer, u.team)) continue;
      if (fl & 1 && Math.hypot(x - u.pos.x, z - u.pos.z) < 30) { u.placeAt(_nv1.set(x, 0, z)); u.netHoldT = Math.max(u.netHoldT || 0, 0.35); }
      if (fl & 4) u.slideAlong(_nv1.set(sx, 0, sz));
      if (fl & 2) { u.carried = carried; u.lift = lift; u.netHoldT = Math.max(u.netHoldT || 0, 0.35); if (carried || lift) { u.netHeldAt = performance.now(); this.held.add(u); } else this.held.delete(u); }
    }
  },
  onGift(a) {
    if (a[0] !== this.myUid || !Arena.active || Arena.phase !== 'play') return;
    if (a[1] === 'scarab') Arena.scarabGift(Arena.pu, a[2]);
    else if (a[1] === 'buff' && BUFFS[a[2]]) Arena.grantBuff(Arena.pu, a[2]);
    else if (a[1] === 'ankh') { Arena.playerAnkh = true; HUD.toast('Ankh of Rebirth: your next respawn is twice as fast'); }
  },
  // a client's god fell: the host credits the kill (and the assists from the blows it saw)
  onDied(peer, a, ms) {
    const h = this.humanOf(peer);
    if (!h || !Arena.active || Arena.phase !== 'play' || h.dead) return;
    h.d++; h.spree = 0; h.respawn = (5 + h.level * 0.8) * (h.respawnHalf ? 0.5 : 1); h.respawnHalf = false;
    h.dead = true; h.deathT = 0; h.deadMs = ms;   // (down until a later pose of its own says otherwise)
    let k = this.unit(a[0]); if (k && k.team === h.team) k = null;   // (never a team-mate's kill)
    Arena.godDied(h, k);
  },
  // a kill decided on another page (the host's units, another human's god), on mine: the killer's side if it is me
  // (my kit's kill reaction and voice, Dead Reckoning, the items, the minion count, the kill ping), the killer's god's
  // flourish where the victim fell if it is another human (in its sandbox)
  slain(v, killer, pos) {
    if (!v || !killer || !pos) return;
    if (killer === Arena.pu) {
      try { Combat.credit(v); } catch (e) { console.warn('[net] credit', e); }
      if (Kit && Kit.onDummyDeath) { try { Kit.onDummyDeath(v, pos); } catch (e) { /* cosmetic */ } }
      if (v.kind === 'minion' && Arena.pstats) Arena.pstats.minions++;
      if (v.isGod && !this.isHost) Sound.arena('kill_ping', { gain: 0.8 });   // (the host's own: Arena.godDied)
    } else if (killer.isRemotePlayer && killer.actor && killer.actor.ctx) {
      const c = killer.actor.ctx, g = this.ghost(c, v === Arena.pu ? this.selfUnit() : v);
      this.withCtx(c, () => { if (Kit && Kit.onDummyDeath) Kit.onDummyDeath(g, pos.clone()); });
    }
  },
  // the host's word on a kill (kd a god: victim, killer, assists; ku anything else another human felled: victim,
  // killer, x, z), when my picture gets there
  onKill(a, god) {
    if (!Arena.active) return;
    const v = this.unit(a[0]) || (god ? null : { id: a[0], pos: V3(a[2] / 100, 0, a[3] / 100), isGod: false, kind: 'minion', alive: false, team: -1 });
    const killer = this.unit(a[1]), pos = god ? (v ? v.pos.clone() : null) : V3(a[2] / 100, 0, a[3] / 100);
    if (v && killer) this.slain(v, killer, pos || v.pos.clone());
    if (god && Items.has && Items.has('persephone_pomegranate') && (a[1] === this.myUid || a.slice(2).includes(this.myUid))) Items.heal(maxHp() * 0.2);   // (a takedown heals)
  },
  // ---------------------------------------------------------------- my pose (every page's god, ~16 per second)
  // (the pose is taken when the state goes out, Net.flush: the freshest one, and as many as are sent)
  afterLocal() {
    if (!this.match || !Arena.active || !this.st) return;
    this.syncInv();
    if (performance.now() - this.poseAt >= 45) { this.poseDue = true; this.dirty = true; }
  },
  // the animator's inputs of my last frame (updatePlayer): the others' copies of my god get exactly these
  keepActx(c) {
    const a = this.actx || (this.actx = {});
    a.vx = c.vel.x; a.vz = c.vel.z; a.run = c.runSpeed; a.air = c.airborne; a.vy = c.vy; a.pitch = c.aimPitch; a.eye = c.eyeBoost;
  },
  // an event of mine the others play on my avatar (j jump, t taunt, rc recall): only in a running match
  act(type, ...args) { if (this.online && this.match && Arena.active) this.emit(type, ...args); },
  cm: (v) => Math.round(v * 100),
  // [ms, x, y, z (cm), rendered yaw, aim yaw (mrad), vx, vz, vy (cm/s), run, pitch, eye (x100), flags, hp, maxHp, mp, level,
  //  cc, shield, physProt, magProt, attack speed x100]; flags: 1 airborne 2 flying 4 dead 8 away 16 recalling 32 ghost
  sample(now) {
    const th = Game.thoth && Game.thoth.root, pu = Arena.pu, c = this.actx, v = Kit && Kit.animVel ? Kit.animVel() : P.vel;
    const flags = (!P.grounded && !P.flying ? 1 : 0) | (P.flying ? 2 : 0) | (P.dead ? 4 : 0) | (Game.mode === 'paused' ? 8 : 0) | (Recall.active ? 16 : 0) | (Kit && Kit.ghost ? 32 : 0);
    const cc = (P.stunT > 0 ? 1 : 0) | (P.rootT > 0 ? 2 : 0) | (P.slowT > 0 ? 4 : 0);
    return [netQ(now), netQ(P.pos.x * 100), netQ(P.y * 100), netQ(P.pos.z * 100), netQ((th ? th.rotation.y : P.yaw) * 1000), netQ(P.yaw * 1000),
      netQ((c ? c.vx : v.x) * 100), netQ((c ? c.vz : v.z) * 100), netQ(P.vy * 100), netQ((c ? c.run : moveSpeed()) * 100), netQ((c ? c.pitch : (Cam.pitch - 0.42) * 0.6) * 100), netQ((c ? c.eye : Kit && Kit.eyeBoost ? Kit.eyeBoost() : 0) * 100),
      flags, Math.max(0, Math.ceil(P.hp)), netQ(maxHp()), netQ(P.mp), settings.level, cc, netQ(Arena.playerShield || 0), netQ(pu ? pu.physProt : 0), netQ(pu ? pu.magProt : 0), netQ(attackSpeed() * 100)];
  },
  onPose(id, s) {
    if (!Array.isArray(s) || s.length < 22) return;
    let b = this.poses.get(id); if (!b) this.poses.set(id, b = []);
    if (b.length && s[0] <= b[b.length - 1][0]) return;
    const pp = this.peers.get(id); if (pp) b.off = pp.off;   // (its clock, kept for a while after it is gone: peerSeen)
    // (as the snapshots: drawn late enough to have the next pose in hand - how late they arrive, and how far apart)
    const L = b.lates || (b.lates = []); L.push(this.peerSeen(id) - s[0]); if (L.length > 30) L.shift();
    b.late = L.length < 4 ? 0 : L.slice().sort((x, y) => y - x)[3];
    if (b.length) { const G = b.gaps || (b.gaps = []); G.push(Math.min(400, s[0] - b[b.length - 1][0])); if (G.length > 30) G.shift(); b.gap = G.length < 4 ? 70 : G.slice().sort((x, y) => y - x)[3]; }
    b.push(s); while (b.length > 2 && s[0] - b[1][0] > 1500) b.shift();
  },
  // a peer's clock as its quickest message says (no half round trip: a busy page's ping says little; the poses only need
  // a steady timeline, and how late they come on it)
  peerSeen(id) { const p = this.peers.get(id); return performance.now() - (p ? p.off : this.poses.get(id)?.off || 0); },
  // another player's pose NET_PDELAY ms in its past (by its own clock; later when its poses arrive late): interpolated;
  // past its newest pose carried on along its velocity (NET_EXTRAP ms at most); across a teleport it holds, then is there
  poseOf(id) {
    const b = this.poses.get(id); if (!b || !b.length) return null;
    const rt = this.peerSeen(id) - clamp((b.late || 0) + (b.gap || 70) + 15, NET_PDELAY, 600);
    let i = b.length - 1; while (i > 0 && b[i][0] > rt) i--;
    const A = b[i], B0 = b[i + 1], tp = !!B0 && Math.hypot(B0[1] - A[1], B0[3] - A[3]) > NET_TP * 100, B = tp ? null : B0;
    const k = B ? clamp((rt - A[0]) / Math.max(1, B[0] - A[0]), 0, 1) : 0;
    const L = (j) => (B ? A[j] + (B[j] - A[j]) * k : A[j]), N = B && k > 0.5 ? B : A;
    const ex = B0 || (A[12] & 4) ? 0 : clamp(rt - A[0], 0, NET_EXTRAP) / 1000;
    let y = L(2) / 100;
    if (ex && A[12] & 1) y = Math.max(Math.min(0, y), y + A[8] / 100 * ex - 8 * ex * ex);   // (in the air: on along its arc)
    return { t: rt, x: L(1) / 100 + A[6] / 100 * ex, y, z: L(3) / 100 + A[7] / 100 * ex, ry: B ? netLerpA(A[4] / 1000, B[4] / 1000, k) : A[4] / 1000, ay: B ? netLerpA(A[5] / 1000, B[5] / 1000, k) : A[5] / 1000,
      vx: L(6) / 100, vz: L(7) / 100, vy: L(8) / 100, run: L(9) / 100, pitch: L(10) / 100, eye: L(11) / 100,
      flags: N[12], hp: N[13], maxHp: N[14], mana: N[15], lvl: N[16], cc: N[17], shield: N[18], pp: N[19], mp: N[20], as: N[21] / 100, ex: Math.round(ex * 1000) };
  },
  // (the other players' avatars are Arena units: RemotePlayerUnit drives its RemoteActor and its kit, Net.tickKit;
  // here my own stand-in for their replayed casts is moved to where I am)
  updateRemotes() { if (Arena.active && Arena.humans.length) this.syncSelf(); },
  // tests: how this page draws the other players (t: the render time in that player's clock)
  avatars() {
    return Arena.humans.map((h) => { const a = h.actor, r = a.rig, s = h.ps, an = a.anim;
      return { id: h.id, peer: h.peer, nick: h.nick, name: h.name, god: a.god, present: h.present, alive: h.alive, dead: h.dead, away: h.away, visible: h.mesh.visible,
        t: s ? s.t : 0, delay: s ? Math.round(this.peerSeen(h.peer) - s.t) : 0, ex: s ? s.ex : 0, x: a.pos.x, y: a.y, z: a.pos.z, ry: a.ry, root: r ? [r.root.position.x, r.root.position.y, r.root.position.z] : null, inScene: !!(r && r.root.parent && r.root.parent.parent === scene),
        moveW: an ? an.moveW : 0, jumpW: an ? an.jumpW : 0, animT: an ? an.t : 0, acts: an ? an.actions.map((x) => x.name) : [], book: !!a.book, bookAt: a.book ? a.book.group.position.toArray() : null,
        ownPage: !!(a.book && a.book.pageMat !== M.page), bookLight: !!(a.book && a.book.light), bank: !!a.bank, recall: !!a.recall, snaps: a.snaps, heard: { ...a.heard }, flash: h.flash, onScreen: h.onScreen, camDist: h.camDist }; });
  },

  // ---------------------------------------------------------------- the host: the world out
  afterWorld() {
    if (!this.match) return;
    const now = performance.now();
    if (this.isHost && Arena.active) {
      // new and removed units, as events (sp carries a whole snapshot record; gn why: 1 a minion, 2 Sebek through a portal)
      const seen = new Set();
      for (const u of Arena.units) {
        if (u.isRemotePlayer) continue;
        seen.add(u.id);
        if (!this.known.has(u.id)) { this.known.set(u.id, u); this.emit('sp', ...this.record(u)); }
      }
      for (const [id, u] of this.known) if (!seen.has(id)) { this.known.delete(id); this.emit('gn', id, u.netWhy || 0); }
      if (now - this.wAt >= 100) {
        this.wAt = now; this.wOut = this.snapshot(now); this.dirty = true;
        this.wHist.push(this.wOut); while (this.wHist.length > 40) this.wHist.shift();
      }
      if (now - this.btAt >= 1000) { this.btAt = now; this.btOut = this.botTable(); this.dirty = true; }
    }
    this.flushOut(now);
  },
  record(u) {
    const kind = u.kind === 'god' ? 0 : u.kind === 'minion' ? (u.melee ? 1 : 2) : u.kind === 'siege' ? 3 : u.big ? 4 : 5;
    const sub = Math.max(0, u.kind === 'camp' ? ArenaMap.camps.indexOf(u.camp) : u.kind === 'god' ? u.slot : 0);
    const f = (u.alive ? 1 : 0) | (u.stun > 0 ? 2 : 0) | (u.root > 0 ? 4 : 0) | (u.slow > 0 ? 8 : 0) | (u.frozen > 0 ? 16 : 0) | (u.mez > 0 ? 32 : 0) | (u.blind > 0 ? 64 : 0)
      | (u.markT > 0 ? 128 : 0) | (u.carried ? 256 : 0) | (u.shield > 0 ? 512 : 0) | (u.recall ? 1024 : 0);
    return [u.id, kind | (u.team << 3) | (sub << 5), netQ(u.pos.x * 20), netQ(u.pos.z * 20), netQ(wrapAngle(u.facing) * 100), Math.max(0, Math.ceil(u.hp)), netQ(u.maxHp), f, u.atkN || 0, u.netTg || 0, netQ((u.lift || 0) * 100)];
  },
  // the world: { t: host ms, a: [time*10, tickets 0 1, wave, next wave*10, Scales phase, t*10, hold 0 1 (x10), contest bits,
  //   storm bits (1 on 2 done), ankh bits (per team: 1 spawned 2 taken), live camps (bit per camp), Sebek in*10, Scales in*10,
  //   scarab in*10, each camp's return*10], s: scarabs [id, x, z, heading], u: unit records }
  snapshot(now) {
    const A = Arena, S = A.scales, St = A.storm;
    const ankh = A.ankh.reduce((b, x, t) => b | ((x.spawned ? 1 : 0) | (x.taken ? 2 : 0)) << (t * 2), 0);
    const camps = ArenaMap.camps.reduce((b, c, i) => b | (c.alive ? 1 << i : 0), 0);
    const a = [netQ(A.time * 10), A.tickets[0], A.tickets[1], A.wave, netQ(A.timers.wave * 10), Math.max(0, NET_SCALES.indexOf(S.phase)), netQ(S.t * 10), netQ(S.hold[0] * 10), netQ(S.hold[1] * 10),
      S.contest ? (S.contest[0] ? 1 : 0) | (S.contest[1] ? 2 : 0) : 0, (St.on ? 1 : 0) | (St.done ? 2 : 0), ankh, camps,
      // (the host's clocks, for whoever takes over should it leave: Sebek, the Scales, the next scarab, each camp's return)
      netQ(A.timers.siege * 10), netQ(A.timers.scales * 10), netQ(A.timers.scarab * 10), ...ArenaMap.camps.map((c) => (c.alive ? 0 : netQ(Math.max(0, c.respawnT) * 10)))];
    const s = []; for (const x of A.scarabs) if (x.alive) s.push(x.id, netQ(x.pos.x * 20), netQ(x.pos.z * 20), netQ(x.head * 100));
    const u = []; for (const x of A.units) if (!x.isRemotePlayer && !x.gone) u.push(...this.record(x));
    return { t: netQ(now), a, s, u };
  },
  // once a second: levels, scores, respawn timers; the bots' buffs, protections and items
  botTable() {
    const A = Arena, rows = [[this.myUid, A.pu.level, A.pstats.k, A.pstats.d, A.pstats.a, P.dead ? netQ(Math.max(0, A.respawnT) * 10) : 0]];
    for (const h of A.humans) rows.push([h.id, h.level, h.k, h.d, h.a, netQ((h.respawn || 0) * 10)]);
    for (const b of A.bots) {
      let bits = 0; NET_BUFFS.forEach((k, i) => { if (b.buffs[k] > 0) bits |= 1 << i; });
      rows.push([b.id, b.level, b.k, b.d, b.a, netQ(Math.max(0, b.respawn) * 10), bits, netQ(b.physProt), netQ(b.magProt), ...(b.inv || []).map((id) => ITEMS.indexOf(ITEM[id]))]);
    }
    return rows;
  },

  // ---------------------------------------------------------------- a client: the host's world in
  wire() {
    if (this.wired) return;
    this.wired = true;
    // the host's world events wait for their moment on my timeline (only those of my match)
    const later = (id, ms, fn, vis = false) => {
      if (id !== this.hostId || this.isHost || !this.match || this.stateOf(id)?.m?.id !== this.match.id) return;
      this.tq.push({ t: ms, fn, vis });
      if (this.tq.length > 2000) this.tq.splice(0, this.tq.length - 2000);   // (a page that stopped drawing: the snapshots heal what goes)
    };
    this.on('sp', (id, a, ms) => later(id, ms, () => this.spawned(a)));
    this.on('gn', (id, a, ms) => later(id, ms, () => this.removeReplica(this.rep.get(a[0]), a[1])));
    this.on('ba', (id, a, ms) => later(id, ms, () => this.botBasic(a), true));
    this.on('bc', (id, a, ms) => later(id, ms, () => this.botCast(a), true));
    this.on('fd', (id, a, ms) => later(id, ms, () => Arena.pushFeed(this.unit(a[0]), this.unit(a[1]), a[2], true), true));
    this.on('an', (id, a, ms) => later(id, ms, () => Arena.announce(a[0] || null, a[1] || undefined, true), true));
    this.on('rr', (id, a, ms) => later(id, ms, () => ArenaMap.roar(a[0], true), true));
    this.on('end', (id, a, ms) => later(id, ms, () => this.ended(a[0], a[1], a[2])));
    // blows, crowd control, heals and gifts reach their owner at once
    this.on('h', (id, a) => this.onHit(id, a));
    // (the host's blows and crowd control on me land when my picture of its world gets there: the bolt reaches me as I
    // see it reach me)
    this.on('dmg', (id, a, ms) => later(id, ms, () => this.onDamage(a)));
    this.on('cc', (id, a, ms) => { if (id === this.hostId && !this.isHost) later(id, ms, () => this.onCC(id, a)); else this.onCC(id, a); });
    this.on('hl', (id, a) => {   // (a heal: the host's, or a team-mate's; on the host's units (Bragi's harp) only a team-mate's)
      if (!Arena.active || Arena.phase !== 'play') return;
      if (a[0] === this.myUid) { if (!P.dead && (id === this.hostId || this.humanOf(id)?.team === Arena.myTeam)) P.hp = Math.min(maxHp(), P.hp + a[1]); return; }
      const u = this.isHost && this.unit(a[0]), s = this.humanOf(id);
      if (u && u.alive && !u.isRemotePlayer && u !== Arena.pu && s && s.team === u.team) u.hp = Math.min(u.maxHp, u.hp + Math.max(0, a[1]));
    });
    this.on('gf', (id, a) => { if (id === this.hostId) this.onGift(a); });
    this.on('die', (id, a, ms) => { if (this.isHost && this.match) this.onDied(id, a, ms); });
    this.on('dp', (id, a) => this.onDisp(id, a));
    // the host's word on kills (the killer's side, the god's flourish: when my picture of the fall gets there) and gold
    this.on('kd', (id, a, ms) => later(id, ms, () => this.onKill(a, true)));
    this.on('sc', (id, a, ms) => later(id, ms, () => this.scores(a)));
    this.on('ku', (id, a, ms) => later(id, ms, () => this.onKill(a, false)));
    this.on('gd', (id, a) => { if (id === this.hostId) this.onGold(a); });
    // levels (the host's experience): mine at once, the others' as my picture of them gets there
    this.on('lv', (id, a, ms) => { if (id === this.hostId && !this.isHost && this.match && this.stateOf(id)?.m?.id === this.match.id && a[0] === this.myUid) this.levelTo(a[1]); else later(id, ms, () => this.leveled(a), true); });
    // another player's jump, taunt and recall: on its avatar, when its pose timeline gets there
    // ... and its casts, basic attacks, recasts and clicks (c b i L R): replayed on its own kit (the Actor sandbox)
    for (const k of ['j', 't', 'rc', 'rs', 'ix', ...NET_CAST]) this.on(k, (id, a, ms) => { const h = this.match && Arena.active && this.humanOf(id); if (h) h.actor.later(ms, k, a); });
  },
  onWorld(w) {
    if (!w || !Array.isArray(w.u) || !Array.isArray(w.a)) return;
    const last = this.snaps[this.snaps.length - 1];
    if (last && w.t <= last.t) return;
    // how late snapshots arrive (the 4th latest of the last 20, so a stalled frame or two does not count): the render
    // delay keeps the next one in hand
    const L = this.lates || (this.lates = []); L.push(this.hostNow() - w.t); if (L.length > 20) L.shift();
    this.late = L.length < 4 ? 0 : L.slice().sort((x, y) => y - x)[3];
    const m = new Map();
    for (let i = 0; i + NET_REC <= w.u.length; i += NET_REC) m.set(w.u[i], w.u.slice(i, i + NET_REC));
    this.snaps.push({ t: w.t, a: w.a, s: Array.isArray(w.s) ? w.s : [], m, done: false });
    while (this.snaps.length > 3 && this.snaps[1].done && w.t - this.snaps[1].t > 3000) this.snaps.shift();
    if (this.snaps.length > 40) this.snaps.splice(0, this.snaps.length - 40);   // (not started yet: each snapshot is whole, the last ones do)
  },
  // every frame (a client in a match): the render clock, then the timeline up to it, then the interpolation pair
  // (what the host says about its units is never sent back: Net.quiet)
  applyIncoming() { this.quiet++; try { this.incoming(); } finally { this.quiet--; } },
  incoming() {
    if (!this.match || this.isHost) return;
    if (this.btIn && (Arena.active || Arena.waiting)) { const bt = this.btIn; this.btIn = null; try { this.applyBots(bt); } catch (e) { console.warn('[net] bt', e); } }
    if (!Arena.active) return;
    const now = performance.now(), target = this.hostNow() - clamp((this.late || 0) + 130, NET_DELAY, 700);
    const ahead = this.rt + (now - this.rtAt);   // (my clock moves it on; a tenth of the error is taken back each frame)
    this.rt = !this.rt || Math.abs(target - ahead) > 400 ? target : ahead + (target - ahead) * 0.1;
    this.rtAt = now;
    const rt = this.rt;
    for (;;) {
      const s = this.snaps.find((x) => !x.done), e = this.tq[0];
      const st = s && s.t <= rt ? s.t : Infinity, et = e && e.t <= rt ? e.t : Infinity;
      if (st === Infinity && et === Infinity) break;
      if (et <= st) { this.tq.shift(); if (e.vis && rt - e.t > 1500) continue; try { e.fn(); } catch (err) { console.warn('[net] world event', err); } }
      else { s.done = true; try { this.applySnap(s, rt - s.t < 600); } catch (err) { console.warn('[net] snapshot', err); } this.wa = s; }
    }
    if (!this.wa) return;
    this.wb = this.snaps.find((x) => x.t > this.wa.t) || null;
    this.wk = this.wb ? clamp((rt - this.wa.t) / Math.max(1, this.wb.t - this.wa.t), 0, 1) : 0;
    Arena.time = this.wa.a[0] / 10 + Math.max(0, Math.min(1, (rt - this.wa.t) / 1000));
  },
  // one snapshot reached: the world's state and every unit's discrete changes (deaths, revivals, attacks, statuses)
  applySnap(S, fresh) {
    const A = Arena, a = S.a;
    A.tkPulse = A.tkPulse || [0, 0];
    for (let t = 0; t < 2; t++) if (a[1 + t] < A.tickets[t]) A.tkPulse[t] = 1;
    A.tickets = [a[1], a[2]]; A.wave = a[3]; A.timers.wave = a[4] / 10;
    this.mirrorScales(a);
    const St = A.storm, on = !!(a[10] & 1);
    if (on && !St.on) A.startStorm(); else if (!on && St.on) { St.on = false; Sound.wind(false); }
    St.done = !!(a[10] & 2);
    for (let t = 0; t < 2; t++) {
      const X = A.ankh[t];
      if ((a[11] >> (t * 2 + 1)) & 1 && !X.taken) { if (!X.mesh) X.spawned = true; const p = X.mesh ? X.mesh.position : ArenaMap.fountains[t].pos; let g = null, bd = 4; for (const u of A.allies[t]) if (u.alive && u.isGod) { const d = Math.hypot(u.pos.x - p.x, u.pos.z - p.z); if (d < bd) { bd = d; g = u; } } A.takeAnkh(t, g); }
    }
    ArenaMap.camps.forEach((c, i) => { const alive = !!((a[12] >> i) & 1); if (alive !== c.alive) { c.alive = alive; c.decalMat.emissiveIntensity = alive ? 1.3 : 0.15; } });
    if (a.length > 15) {   // (the host's clocks: only kept, for a takeover)
      const T = A.timers; T.siege = a[13] / 10; T.scales = a[14] / 10; T.scarab = a[15] / 10;
      ArenaMap.camps.forEach((c, i) => { if (a[16 + i] > 0) c.respawnT = a[16 + i] / 10; });
    }
    this.mirrorScarabs(S.s);
    for (const [id, r] of S.m) {
      let u = this.rep.get(id);
      if (!u && !this.made.has(id)) u = this.makeReplica(r);
      if (u && !u.gone) this.applyRec(u, r, fresh);
    }
    for (const [id, u] of this.rep) {
      if (u.gone) { this.rep.delete(id); continue; }
      if (!S.m.has(id) && (u.kind !== 'god' || u.netFill) && (u.netMiss = (u.netMiss || 0) + 1) >= 3) this.removeReplica(u, 0);   // (its gn was lost; a bot I put in a slot while I was host a moment)
    }
  },
  makeReplica(r) {
    const A = Arena, id = r[0], kind = r[1] & 7, team = (r[1] >> 3) & 3, sub = r[1] >> 5;
    let u = null;
    if (kind === 1 || kind === 2) { u = new Minion(team, kind === 1 ? 'melee' : 'ranged', A.wave, 0); u.spawnT = 0; u.mesh.scale.setScalar(0.01); A.units.push(u); }
    else if (kind === 3) { u = new Siege(team, sub); A.siege[team] = u; A.units.push(u); }
    else if (kind === 4 || kind === 5) {
      const c = ArenaMap.camps[sub]; if (!c) return null;
      const j = kind === 4 ? 0 : 1;
      if (!c.mobs[j] || !c.mobs[j].netPending || c.mobs[j].gone) { A.spawnCamp(c); for (const m of c.mobs) { m.netPending = true; m.id = 0; } }   // (the pair's other mob gets its number from its own record)
      u = c.mobs[j]; u.netPending = false;
    } else if (kind === 0) {
      // (every page set the bots up at the start; a new one stands in for a player who left the match)
      u = this.botFor(team, sub);
      if (!u) return null;
    } else return null;
    u.id = id; this.made.add(id); this.rep.set(id, u); this.armForwarding(u);
    u.pos.set(r[2] / 20, 0, r[3] / 20); u.facing = r[4] / 100;
    A.syncTargets();
    return u;
  },
  applyRec(u, r, fresh) {
    u.netMiss = 0;
    const f = r[7];
    u.maxHp = Math.max(1, r[6]); if (f & 1) u.hp = r[5];
    // statuses (kept fresh while the host's flag is up; a local kit's prediction is never cut short)
    const keep = (k, bit, fx) => { if (!(f & bit)) return; if (fx && !(u[k] > 0)) GodFX.status(u, fx); u[k] = Math.max(u[k] || 0, 0.3); };
    if (u.alive) {
      keep('stun', 2, 'stun'); keep('root', 4); keep('mez', 32, 'mez'); keep('blind', 64, 'blind'); keep('markT', 128, 'mark');
      if (f & 8) { u.slow = Math.max(u.slow, 0.3); u.slowAmt = Math.max(u.slowAmt, 0.25); }
      if (f & 16) { if (!u.ice) u.ice = GodFX.iceBlock(u); u.frozen = Math.max(u.frozen, 0.3); }
      if (!(u.netPin > performance.now())) u.carried = !!(f & 256);
      if (!(f & 512)) u.shield = 0; else if (!(u.shield > 0)) u.shield = 1;
    }
    if (u.alive && !(f & 1)) this.replicaDie(u);
    else if (!u.alive && (f & 1) && u.kind === 'god') this.replicaRevive(u, r);
    // a new attack (minions, Sebek, the camps: a bot god's come as events)
    if (u.netAtk === undefined) u.netAtk = r[8];
    else if (r[8] !== u.netAtk) { u.netAtk = r[8]; if (fresh && u.alive && u.kind !== 'god') this.replicaAttack(u, r[9]); }
    // a bot's recall channel
    if (u.kind === 'god') {
      const rc = !!(f & 1024) && u.alive;
      if (rc && !u.recall) { const pos = u.pos.clone().setY(0); u.recall = { t: 0, pos, hp: u.hp, dur: RECALL.botTime, fx: Recall.channelFx(pos, 0.4, u) }; }
      else if (!rc && u.recall) {
        const R = u.recall, done = R.t >= R.dur - 0.6 && u.alive; u.recall = null;
        const near = u.onScreen && u.camDist < 45;
        Recall.stopFx(R.fx, done && near); if (done && near) Recall.flashAt(R.pos, 0.45);
        u.netArrive = done ? performance.now() : 0;
      }
    }
  },
  replicaDie(u) {
    u.alive = false; u.hp = 0;
    if (u.frozen > 0 && u.ice) GodFX.shatterIce(u);
    if (u.recall) Recall.botCancel(u);
    u.clearStatus();
    if (u.kind === 'god') { u.dying = 1.6; u.buffs = {}; u.motion = null; u.lift = 0; return; }
    u.die();
    if (u.kind === 'minion' && u.camDist < 25) Sound.arena('minion_death', { pos: u.pos.clone(), gain: 0.5 });
  },
  replicaRevive(u, r) {
    Arena.respawnBot(u);   // (up again at the fountain: the look; the snapshot has the place)
    u.pos.set(r[2] / 20, 0, r[3] / 20); u.velocity.set(0, 0, 0);
  },
  replicaAttack(u, tid) {
    let tg = this.unit(tid);
    if (!tg) { const f = fwdOf(u.facing); tg = { pos: V3(u.pos.x + f.x * 4, 0, u.pos.z + f.z * 4), velocity: V3(), alive: true, radius: 0.5, team: 1 - u.team }; }
    if (u.kind === 'siege') u.stomp(); else u.attack(tg);
  },
  // interpolate a replica between the two snapshots around the render time
  follow(u, dt) {
    const A = this.wa && this.wa.m.get(u.id); if (!A) return;
    if (u.netPin > performance.now()) { u.velocity.set(0, 0, 0); return; }   // (where my kit put it, until the host's picture has it there)
    const B = this.wb && this.wb.m.get(u.id), k = B ? this.wk : 0;
    const L = (i) => (B ? A[i] + (B[i] - A[i]) * k : A[i]);
    const x = L(2) / 20, z = L(3) / 20, px = u.pos.x, pz = u.pos.z;
    const jump = Math.hypot(x - px, z - pz) > 6;   // (a recall home, a respawn: no running across the arena)
    u.pos.x = x; u.pos.z = z;
    u.facing = B ? netLerpA(A[4] / 100, B[4] / 100, k) : A[4] / 100;
    u.lift = L(10) / 100;
    if (jump || !(dt > 0)) {
      u.velocity.set(0, 0, 0);
      if (jump && u.anim) { u.anim.firstFrame = true; u.anim.actions = []; }
      if (jump && u.netArrive && performance.now() - u.netArrive < 2000) { u.netArrive = 0; if (camera.position.distanceTo(u.pos) < 45) Recall.arrive(u.pos.clone().setY(0), 0.45); }
    } else {
      const c = Math.min(1, dt * 12);
      u.velocity.x += ((x - px) / dt - u.velocity.x) * c; u.velocity.z += ((z - pz) / dt - u.velocity.z) * c;
    }
  },
  // the host's units appear (sp: a snapshot record) and go (gn)
  spawned(r) {
    if (this.rep.has(r[0]) || this.made.has(r[0])) return;
    const u = this.makeReplica(r); if (!u) return;
    this.applyRec(u, r, false);
    const kind = r[1] & 7, team = (r[1] >> 3) & 3;
    if (kind === 1 || kind === 2) {
      const g = ArenaMap.gates[team], now = performance.now(); g.flash = 1;
      if (now - this.waveFx[team] > 2000) { this.waveFx[team] = now; if (camera.position.distanceTo(g.pos) < 45) Sound.arena('wave_spawn', { pos: g.pos, gain: 0.6 }); }
    } else if (kind === 3) { FX2.impact(u.pos, team === 0 ? 'thoth' : 'molten', { size: 1.6, sparks: 30, debris: 14 }); Sound.arena('siege_spawn', { pos: u.pos, gain: 1 }); }
  },
  removeReplica(u, why) {
    if (u && u.netFill && !u.gone) { this.dropBot(u); return; }
    if (!u || u.gone || u.kind === 'god') return;
    if (why === 1 || why === 2) {
      const siege = why === 2, g = ArenaMap.gates[1 - u.team];
      u.alive = false; u.gone = true; if (u.aura) u.aura.dead = true; g.flash = siege ? 2 : 1;
      if (siege) { FX2.impact(u.pos, u.team === 0 ? 'thoth' : 'molten', { size: 2.2, sparks: 50, debris: 20 }); GodFX.column(u.pos, 3, 30, TEAMS[u.team].col, { core: TEAMS[u.team].hot, k: 20 }); Sound.arena('portal_siege', { pos: u.pos, gain: 1 }); }
      else { const k = arenaFxK(u.pos); FX2.burst(u.pos.clone().setY(1), u.team === 0 ? 'thoth' : 'molten', { size: 0.6, sparks: Math.round(14 * k), embers: 6, puffs: 0, bursts: 1, light: k > 0.5, distort: false }); Sound.arena('portal_hit', { pos: u.pos, gain: 0.8 }); }
    } else if (u.alive) this.replicaDie(u);   // (it died between two snapshots: a shattered ushabti)
    else if (!(u.dying > 0)) u.gone = true;
  },
  // a bot's basic attack and cast, replayed (a replica's blows are pictures)
  botBasic(a) {
    const b = this.rep.get(a[0]), tg = this.unit(a[1]);
    if (!b || !b.alive || b.kind !== 'god' || !tg) return;
    b.atkI = a[2]; b.basicAttack(tg);
  },
  botCast(a) {
    const b = this.rep.get(a[0]); if (!b || !b.alive || b.kind !== 'god') return;
    const ab = b.bk.abil[a[1]]; if (!ab) return;
    const real = this.unit(a[2]);
    const tg = { pos: V3(a[3] / 100, 0, a[4] / 100), velocity: V3(a[5] / 100, 0, a[6] / 100), radius: real ? real.radius : 0.5, alive: true, hp: 1, maxHp: 1, isGod: real ? !!real.isGod : true, kind: real ? real.kind : 'god', team: 1 - b.team };
    b.castRng = mulberry32(a[7]);
    try { BotCast.cast(b, ab, tg); } finally { b.castRng = null; }
  },
  ended(w, t0, t1) {
    if (!Arena.active || Arena.phase !== 'play') return;
    Arena.tickets = [t0, t1];
    Arena.end(w);
  },
  mirrorScales(a) {
    const A = Arena, S = A.scales, V = A.sv, phase = NET_SCALES[a[5]] || 'idle';
    if (phase !== S.phase && V) {
      if (S.phase === 'idle') {
        S.active = true; V.obj.visible = true; V.col.visible = true; if (!ArenaMap.circles.includes(V.coll)) ArenaMap.circles.push(V.coll);
        if (phase === 'rising') { Sound.arena('scales_rise', { pos: V3(0, 2, 0), gain: 1 }); FX2.impact(V3(0, 0, 0), 'thothGold', { size: 1.6, sparks: 30, debris: 16 }); }
      }
      if (phase === 'sinking' && S.phase === 'judging' && Math.abs(a[7] - a[8]) >= 5) A.judgeFx();
      if (phase === 'idle') { S.active = false; V.obj.visible = false; V.col.visible = false; V.zone.material.opacity = 0; const i = ArenaMap.circles.indexOf(V.coll); if (i >= 0) ArenaMap.circles.splice(i, 1); }
      S.phase = phase;
    }
    S.t = a[6] / 10; S.hold = [a[7] / 10, a[8] / 10]; S.contest = [a[9] & 1, (a[9] >> 1) & 1];
  },
  mirrorScarabs(list) {
    const A = Arena, ids = new Set();
    for (let i = 0; i + 4 <= list.length; i += 4) {
      const id = list[i], x = list[i + 1] / 20, z = list[i + 2] / 20; ids.add(id);
      let s = A.scarabs.find((q) => q.netId === id);
      if (!s) { A.spawnScarab(V3(x, 0, z)); s = A.scarabs[A.scarabs.length - 1]; s.netId = id; }
      s.goal = s.goal || V3(); s.goal.set(x, 0, z); s.head = list[i + 3] / 100;
    }
    for (const s of A.scarabs) {
      if (ids.has(s.netId)) continue;
      s.alive = false;
      const taken = [...A.units, A.pu].some((g) => g && g.alive && g.isGod && Math.hypot(g.pos.x - s.pos.x, g.pos.z - s.pos.z) < 2.2);
      A.removeScarab(s, taken);
    }
    A.scarabs = A.scarabs.filter((s) => s.alive);
  },
  // the bot table: my level and score; the others' levels, scores and respawn timers; the bots' buffs, protections and items
  applyBots(bt) {
    const A = Arena;
    for (const r of bt) {
      if (!Array.isArray(r) || r.length < 6) continue;
      const [id, L, k, d, a, resp] = r;
      // (levels and scores only ever go up in a match: a table sent before a level-up or a kill event never takes them back)
      if (id === this.myUid) {
        this.levelTo(L);
        if (A.pstats) { A.pstats.k = Math.max(A.pstats.k, k); A.pstats.a = Math.max(A.pstats.a, a); A.pstats.d = Math.max(A.pstats.d, d); }
        continue;
      }
      const u = this.unit(id); if (!u) continue;
      u.level = Math.max(u.level || 0, L); u.k = Math.max(u.k || 0, k); u.d = Math.max(u.d || 0, d); u.a = Math.max(u.a || 0, a); u.respawn = resp / 10;
      if (u.isRemotePlayer || r.length < 9) continue;
      NET_BUFFS.forEach((b, i) => {
        const on = (r[6] >> i) & 1;
        if (on && !(u.buffs[b] > 0) && i < 3 && u.onScreen && u.alive) FX2.aura(u.pos, BUFFS[b].pal, { radius: 0.9, height: 2, rate: 4, dur: 90 });
        u.buffs[b] = on ? 1.5 : 0;
      });
      u.physProt = r[7]; u.magProt = r[8];
      // its items (as the host's bot bought them): their stats for my picture of it, a bought tier III's golden ring
      const inv = r.slice(9).map((i) => ITEMS[i] && ITEMS[i].id).filter(Boolean), key = inv.join();
      if (key !== u.invKey) {
        const fresh = u.invKey !== undefined && inv.some((x) => ITEM[x].tier >= 3 && !(u.inv || []).includes(x));
        u.invKey = key; u.inv = inv; u.istats = sumItemStats(inv);
        if (fresh && u.alive && u.onScreen && u.camDist < 30 && FX2.ready) FX2.ring(u.pos, 'thothGold', { radius: 1.3, dur: 0.45 });
      }
    }
  },

  // ---------------------------------------------------------------- tests and debugging
  // the units as this page draws them: a client's replicas at its render time (host ms), the host's own units now
  probe() {
    const A = Arena, units = [];
    for (const u of A.units) if (!u.gone) units.push([u.id, Math.round(u.pos.x * 100) / 100, Math.round(u.pos.z * 100) / 100, u.alive ? 1 : 0, u.kind, u.team]);
    return { host: this.isHost, t: this.isHost ? performance.now() : this.rt, active: A.active, phase: A.phase, time: A.time, tickets: A.tickets.slice(), wave: A.wave, myTeam: A.myTeam, myUid: this.myUid,
      pu: A.pu ? [A.pu.id, A.pu.team] : null, units, snaps: this.snaps.length, tq: this.tq.length, delay: this.isHost ? 0 : Math.round(this.hostNow() - this.rt) };
  },
  // the host: where its units were at host time t (interpolated between its last snapshots)
  histAt(t) {
    const H = this.wHist; let i = H.length - 1; while (i > 0 && H[i].t > t) i--;
    const A = H[i], B = H[i + 1]; if (!A) return {};
    const k = B ? clamp((t - A.t) / Math.max(1, B.t - A.t), 0, 1) : 0, out = {};
    const ma = new Map(); for (let j = 0; j + NET_REC <= A.u.length; j += NET_REC) ma.set(A.u[j], A.u.slice(j, j + NET_REC));
    const mb = new Map(); if (B) for (let j = 0; j + NET_REC <= B.u.length; j += NET_REC) mb.set(B.u[j], B.u.slice(j, j + NET_REC));
    for (const [id, r] of ma) { const q = mb.get(id); out[id] = [(q ? r[2] + (q[2] - r[2]) * k : r[2]) / 20, (q ? r[3] + (q[3] - r[3]) * k : r[3]) / 20, r[7] & 1]; }
    return { t0: A.t, t1: B ? B.t : A.t, pos: out };
  },
});

// ---- the other players' casts with their whole look and sound: the Actor sandbox -----------------------------------
// Every kit keeps its caster's state in P (Thoth's too) and in one container of its own (SK, BA, HE, RA, BC, U), and
// reads a few global slots: Kit, ABILITY_ORDER, Game.thoth / anim / book, settings.ranks / level, Combat.dummies and
// the god's sound bank. Each other player's god here has an ActorContext with its own images of all of them (copies
// of the containers as they were at boot); Net.withCtx(ctx, fn) swaps them in, runs the kit's own unmodified code (a
// cast, a basic attack, its frame, a deferred callback) and swaps mine back. What it did to my view is thrown away
// on the way out: the camera (shake, FOV kick, the finales' framing and focus), the screen (dim, tint, vignette,
// shocks, aberration) and the hit-stop; it never ducks my music, writes my HUD, or speaks with my god's voice (its
// own speaks where it stands). Every deferred path remembers its context: VFX.later, GodFX / FX2 items, a decal's
// hold(), projectiles, Final Judgement's waves, Ullr's arrow rain and confetti. A replayed cast's targets are ghosts
// (Net.ghost): read-through proxies of the real units (and of a stand-in for me) that keep every write and every
// crowd control to themselves, so the shot stops where it stops on its caster's page and nothing here changes;
// Combat.deal deals nothing inside (the caster's page sends its blows, h). Ullr's luck (kroll) is seeded per cast.
// The caster sends (Net.cast): c cast [id, aim..., ranks, level, seed], b basic attack [aim..., seed], i a recast
// that Kit.intercept took [id, aim...], L / R a click the kit took [aim...]; aim = x, z, y (cm), yaw (mrad), the
// reticle's ground hit hx, hz (cm, or null), the move wish mx, mz (x100). They play on the avatar's pose timeline.
const NET_CAST = new Set(['c', 'b', 'i', 'L', 'R', 'K']);
const NET_CTX_GRACE = 8000;   // ms a gone kit's running effects may still play out (then they are disposed)
const NET_GHOSTS = { hecate: 2, bastet: 4 };   // afterimage copies a kit uses at once (Net.ghostClone)
const NET_KITSTATE = { skadi: SK, bastet: BA, hecate: HE, ra: RA, bacchus: BC, ullr: U, cookie: CM };   // each kit's own container (Thoth's lives in P)
const NET_GHOST_NOOP = new Set(['applyStun', 'freeze', 'mesmerize', 'blinded', 'rooted', 'slowed', 'marked', 'bleed', 'placeAt', 'shove', 'slideAlong',
  'onHit', 'onDeath', 'clearStatus', 'die', 'revive', 'applyLevel', 'updateDead']);
const NET_NOBANK = { gsfx: {}, vox: {}, lines: {} };
const netNoop = () => {};
const _nv1 = new THREE.Vector3(), _nv2 = new THREE.Vector3(), _nv3 = new THREE.Vector3();
// a kit container as it starts, copied: arrays, Maps, Sets, plain objects and three's maths; anything else as it is
function netClone(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(netClone);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, netClone(x)]));
  if (v instanceof Set) return new Set(v);
  if (v.isVector3 || v.isVector2 || v.isColor || v.isQuaternion || v.isEuler || v.isMatrix4) return v.clone();
  const pr = Object.getPrototypeOf(v);
  if (pr !== Object.prototype && pr !== null) return v;
  const o = {}; for (const k of Object.keys(v)) o[k] = netClone(v[k]);
  return o;
}
// swap a container's values: mine kept aside, the other player's in (keys never go away: missing ones are undefined)
function netSwapIn(X, img, save) { Object.assign(save, X); for (const k in X) if (!(k in img)) img[k] = undefined; Object.assign(X, img); }
function netSwapOut(X, img, save) { Object.assign(img, X); for (const k in X) if (!(k in save)) save[k] = undefined; Object.assign(X, save); }
// a copied rig (Ullr's clown) gone for good: off the scene, its own materials freed
function netFreeRig(r, a) {
  if (a) for (const f of a.handFx) f.trail.alive = false;
  r.root.removeFromParent();
  r.root.traverse((o) => { if (o.isMesh && o.material && o.material !== r.material && o.material.dispose) o.material.dispose(); });
  if (r.material) r.material.dispose();
  for (const sp of [...r.eyes, ...r.handGlows.flatMap((h) => [h.glow, h.core])]) sp.material.dispose();
}
// another player's god as its kit sees it (one per RemoteActor with a rig, in the Arena)
class ActorContext {
  constructor(A) {
    const u = A.unit, g = A.god, T = Net.tpl;
    Object.assign(this, { id: ++Net.ctxSeq, actor: A, god: g, team: u.team, uid: u.id, peer: A.peer, pos: A.pos,
      X: NET_KITSTATE[g] || null, P: netClone(T.P), K: NET_KITSTATE[g] ? netClone(T[g]) : null,
      rig: A.rig, anim: A.anim, book: A.book, ranks: [1, 1, 1, 1, 1], level: 1, as: 1, run: 5,
      order: (g === 'ullr' ? UL_ORDER.bow : GODS[g].order).slice(), uorder: UL_ORDER.bow.slice(),
      aim: { hx: null, hz: null, mx: 0, mz: 0 }, rng: Math.random, ghosts: new WeakMap(), tg: [], tgT: -1, ultCh: null,
      lastVoice: {}, voiceEnd: 0, voicePri: 0, px: A.pos.x, py: A.y, pz: A.pos.z, dead: false, made: 0, sfx: 0, fxK: 1, thinned: 0 });
    this.P.pos = A.pos;   // (its P.pos is the avatar's own position: whatever follows the caster follows the avatar)
  }
  get bank() { return this.actor.bank || NET_NOBANK; }
}
Object.assign(Net, {
  ctx: null, ctxSeq: 0, tpl: null, sv: null, me0: null, rs: 0, swaps: 0, fxScale: true,

  // ---------------------------------------------------------------- boot: the kits as they start (before my god's init)
  captureTemplates() {
    this.tpl = { P: netClone(P) };
    for (const [g, X] of Object.entries(NET_KITSTATE)) this.tpl[g] = netClone(X);
  },

  // ---------------------------------------------------------------- the caster: my casts as events
  live() { return this.online && !!this.match && Arena.active; },
  // a new seed for my kit's rolls (Ullr's luck), sent with the cast so every page rolls the same
  seed() { if (!this.live()) return; this.rs = (Math.random() * 4294967296) >>> 0; LocalActor.rng = mulberry32(this.rs); },
  // where my reticle's ray meets the ground (cm), as groundTargetDistance sees it
  aimHit() {
    const o = camera.position, d = _nv1.copy(Cam.look).sub(o).normalize();
    if (d.y >= -0.01) return null;
    const k = -o.y / d.y;
    return [netQ((o.x + d.x * k) * 100), netQ((o.z + d.z * k) * 100)];
  },
  cast(k, id = '', ...more) {
    if (!this.live()) return;
    if (k === 'c') this.seed();
    const h = this.aimHit(), w = moveWish(_nv2);
    const aim = [netQ(P.pos.x * 100), netQ(P.pos.z * 100), netQ(P.y * 100), netQ(P.yaw * 1000), h ? h[0] : null, h ? h[1] : null, netQ(w.x * 100), netQ(w.z * 100)];
    if (k === 'c') this.emit('c', id, ...aim, settings.ranks.slice(0, 5), settings.level, this.rs);
    else if (k === 'b') this.emit('b', ...aim, this.rs);
    else if (k === 'i') this.emit('i', id, ...aim);
    else if (k === 'K') this.emit('K', id, ...aim, ...more);   // (a kit's own moment: Cookie Monster's cookie, his Horror's victim)
    else this.emit(k, ...aim);
  },

  // ---------------------------------------------------------------- contexts
  makeCtx(A) {
    if (!this.tpl || !GODS[A.god] || !A.unit) return null;
    const c = new ActorContext(A);
    this.withCtx(c, () => Kit.init());
    // (the afterimages its kit makes, copied now while the avatar is being built anyway: Hecate's two forms, Bastet's leaps)
    const n = NET_GHOSTS[A.god] || 0;
    if (n && A.rig) this.withCtx(c, () => { const g = []; for (let i = 0; i < n; i++) g.push(this.ghostClone(A.rig, COL.white, COL.white)); for (const x of g) x.dispose(); });
    return c;
  },
  // its kit is done (the avatar goes, or changes god): everything it holds is let go
  dropCtx(A) {
    const c = A.ctx; if (!c) return;
    A.ctx = null; this.unveil(c); c.hid = false;
    this.withCtx(c, () => {
      Kit.dispose();
      if (c.god === 'ullr' && U.clownR) { const R = U.clownR; U.clownR = null; netFreeRig(R.rig, R.anim); }
      if (c.god === 'cookie' && CM.rageR) { const R = CM.rageR; CM.rageR = null; for (const rb of R.ribbons || []) rb.dispose(); netFreeRig(R.rig, R.anim); }   // (his rage form's copy)
    });
    if (c.ultCh) { c.ultCh.stop(0.1); c.ultCh = null; }
    if (c.gpool) { for (const e of c.gpool) { e.g.removeFromParent(); e.mat.dispose(); } c.gpool = null; }
    for (const h of c.sounds || []) h.stop(0.3);   // (the god has gone: its ambience with it)
    c.sounds = null;
    c.dead = true; c.deadAt = performance.now();
  },
  // a kit's afterimage (ghostClone: Hecate's three forms, Bastet's leaps) of another player's god: a few copies of its rig
  // kept per context and posed again for each use (copying a whole god every cast is the dearest thing a replay does);
  // none for a far one
  ghostClone(rig, color, rim) {
    const c = this.ctx, none = () => ({ group: new THREE.Group(), mat: { uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color() }, uRim: { value: new THREE.Color() } } }, dispose() {} });
    if (c.fxK < 0.6) return none();
    const pool = c.gpool || (c.gpool = []);
    let e = pool.find((x) => x.free && x.rig === rig);
    if (!e) {
      if (pool.length >= 8) return none();
      const clone = SkeletonUtils.clone(rig.model), mat = ghostCloneMaterial(color, rim), bones = [], src = {};
      rig.model.traverse((o) => { if (o.isBone) src[o.name] = o; });
      clone.traverse((o) => {
        if (o.isBone && src[o.name]) bones.push([o, src[o.name]]);
        if (o.isMesh) { o.material = mat; o.frustumCulled = false; o.renderOrder = 7; o.castShadow = false; }
        if (o.isSprite) o.visible = false;
      });
      const g = new THREE.Group(), b = new THREE.Group(); b.add(clone); g.add(b);
      e = { rig, mat, bones, g, b, free: true }; pool.push(e);
    }
    e.free = false;
    for (const [o, s] of e.bones) { o.position.copy(s.position); o.quaternion.copy(s.quaternion); }
    const U = e.mat.uniforms; U.uColor.value.copy(color); U.uRim.value.copy(rim); U.uAlpha.value = 1;
    e.g.position.copy(rig.root.position); e.g.rotation.copy(rig.root.rotation); e.b.position.copy(rig.body.position);
    scene.add(e.g);
    const api = { group: e.g, mat: e.mat, dispose() { if (api.done) return; api.done = true; e.g.removeFromParent(); e.free = true; } };   // (a late second dispose never takes the copy from its next use)
    return api;
  },
  // its god fell: its kit starts over (as the owner's does, Arena.playerDie)
  kitReset(A) {
    const c = A.ctx; if (!c) return;
    this.withCtx(c, () => {
      Kit.dispose(); Kit.init();
      Object.assign(P, { targeting: null, speedBuff: 1, asBuff: 1, flying: false, y: 0, vy: 0, grounded: true });
    });
  },
  // run fn as that player (re-entrant); a failure in another player's kit is reported, never thrown into my frame
  withCtx(c, fn) {
    if (this.ctx === c) return fn();
    const prev = this.ctx;
    if (prev) this.exit();
    this.enter(c);
    try { return fn(); } catch (e) { this.oops(c, e); return undefined; } finally { this.exit(); if (prev) this.enter(prev); }
  },
  oops(c, e) {
    const S = this.stats;
    if (c.dead) { S.deadErr = (S.deadErr || 0) + 1; return; }   // (a gone kit's effect that could not play out: it is let go)
    S.ctxErr = (S.ctxErr || 0) + 1;
    (S.ctxErrs || (S.ctxErrs = [])).length < 8 && S.ctxErrs.push(`${c.god}: ${e && e.message}`);
    if (S.ctxErr <= 3) console.warn('[net] replay', c.god, e);
  },
  // the deferred paths: a callback (VFX.later), a frame of a flight (projectiles, waves), a GodFX / FX2 item, a decal's hold
  run(c, fn) { if (c.dead && performance.now() - c.deadAt > NET_CTX_GRACE) return undefined; return this.withCtx(c, fn); },
  step(c, fn) { return this.withCtx(c, fn); },
  adopt(o) {
    const c = this.ctx, u = o.update, d = o.dispose;
    o.ctx = c; c.made++;
    // (its kit gone: the effect still plays out as its own code ends it - a loop stopped, a trail let go - for a while at most)
    if (typeof u === 'function') o.update = (dt, t) => (c.dead && performance.now() - c.deadAt > NET_CTX_GRACE ? false : this.withCtx(c, () => u.call(o, dt, t)));
    if (typeof d === 'function') o.dispose = () => this.withCtx(c, () => d.call(o));
  },
  hold(d) { if (d.ctx.dead) { d.dead = true; return 0; } return this.withCtx(d.ctx, d.hold) || 0; },
  enter(c) {
    const S = this.sv || (this.sv = { P: {}, K: new Map(), view: [], tint: new THREE.Color() });
    this.swaps++;
    netSwapIn(P, c.P, S.P);
    if (c.X) { let k = S.K.get(c.X); if (!k) S.K.set(c.X, k = {}); netSwapIn(c.X, c.K, k); }
    Object.assign(S, { Kit, order: ABILITY_ORDER, uorder: GODS.ullr.order, thoth: Game.thoth, anim: Game.anim, book: Game.book, god: Game.god,
      ranks: settings.ranks, level: settings.level, dummies: Combat.dummies, gsfx: Sound.gsfx, vox: Sound.vox, lines: Sound.lines, ultCh: Sound.ultCh });
    // my view, as it is (whatever the other player's kit does to it is undone on the way out)
    const v = S.view;
    v[0] = Cam.shake; v[1] = Cam.fovKick; v[2] = Cam.frameTarget; v[3] = Cam.focus; v[4] = Cam.focusK; v[5] = Cam.shot; v[6] = Cam.frame;
    v[7] = PostFX.vigTarget; v[8] = PostFX.aberr; v[9] = PostFX.shocks.length; v[10] = WORLD.dim; v[11] = WORLD.dimK; v[12] = WORLD.tint.target; v[13] = WORLD.tint.k;
    v[14] = Game.stopT; v[15] = Game.stopScale; S.tint.copy(WORLD.tint.color);
    Cam.focus = c.focus || null;   // (its own finale's focus: a kit writes into the vector it finds)
    Kit = GODS[c.god]; ABILITY_ORDER = c.order; GODS.ullr.order = c.uorder;
    Game.thoth = c.rig; Game.anim = c.anim; Game.book = c.book; Game.god = c.god;
    settings.ranks = c.ranks; settings.level = c.level; Combat.dummies = this.targets(c);
    const b = c.bank; Sound.gsfx = b.gsfx; Sound.vox = b.vox; Sound.lines = b.lines; Sound.ultCh = c.ultCh;
    this.ctx = c;
  },
  exit() {
    const c = this.ctx, S = this.sv; if (!c) return;
    this.ctx = null;
    netSwapOut(P, c.P, S.P);
    if (c.X) netSwapOut(c.X, c.K, S.K.get(c.X));
    c.order = ABILITY_ORDER; c.uorder = GODS.ullr.order; c.rig = Game.thoth; c.anim = Game.anim; c.book = Game.book;
    c.ranks = settings.ranks; c.level = settings.level; c.ultCh = Sound.ultCh;
    Kit = S.Kit; ABILITY_ORDER = S.order; GODS.ullr.order = S.uorder; Game.thoth = S.thoth; Game.anim = S.anim; Game.book = S.book; Game.god = S.god;
    settings.ranks = S.ranks; settings.level = S.level; Combat.dummies = S.dummies;
    Sound.gsfx = S.gsfx; Sound.vox = S.vox; Sound.lines = S.lines; Sound.ultCh = S.ultCh;
    const v = S.view;
    c.focus = Cam.focus;
    Cam.shake = v[0]; Cam.fovKick = v[1]; Cam.frameTarget = v[2]; Cam.focus = v[3]; Cam.focusK = v[4]; Cam.shot = v[5]; Cam.frame = v[6];
    PostFX.vigTarget = v[7]; PostFX.aberr = v[8]; if (PostFX.shocks.length > v[9]) PostFX.shocks.length = v[9];
    WORLD.dim = v[10]; WORLD.dimK = v[11]; WORLD.tint.target = v[12]; WORLD.tint.k = v[13]; WORLD.tint.color.copy(S.tint);
    Game.stopT = v[14]; Game.stopScale = v[15];
    // the avatar stays where its pose says (a replayed dash or teleport is in the pose already)
    c.P.pos.set(c.px, 0, c.pz); c.P.y = c.py;
  },

  // ---------------------------------------------------------------- what its casts can hit: ghosts
  // the units hostile to its team (and my stand-in, when I am one of them), as ghosts; once per frame
  targets(c) {
    if (c.tgT === Game.time) return c.tg;
    c.tgT = Game.time;
    const L = c.tg = [];
    if (Arena.active) {
      for (const u of Arena.units) if (u.team !== c.team && !u.gone && !u.isPlayer) L.push(this.ghost(c, u));
      if (this.me0 && this.me0.team !== c.team) L.push(this.ghost(c, this.me0));
    }
    return L;
  },
  // a unit as a replayed cast sees it: everything reads through, every write stays in the ghost, crowd control and
  // displacement do nothing (the caster's page sends them)
  ghost(c, u) {
    let g = c.ghosts.get(u);
    if (!g) {
      const sh = new Map([['bleeds', []]]);
      g = new Proxy(u, {
        get: (o, k) => (sh.has(k) ? sh.get(k) : k === 'isGhost' ? true : k === 'real' ? o : NET_GHOST_NOOP.has(k) ? netNoop : o[k]),
        set: (o, k, v) => { sh.set(k, v); return true; },
      });
      c.ghosts.set(u, g);
    }
    return g;
  },
  // my stand-in among their targets: an arena unit (as the kits know them) where I am, never in the arena's lists
  selfUnit() {
    if (!this.me0) {
      const seq = arenaUnitSeq;
      const u = this.me0 = new ArenaUnit(0, 'god', { name: 'me', radius: 0.45, height: 2.0, hp: 500 });
      arenaUnitSeq = seq; u.mesh.removeFromParent(); u.replica = false; u.isSelf = true;
    }
    return this.me0;
  },
  syncSelf() {
    const u = this.selfUnit();
    u.team = Arena.myTeam; u.id = this.myUid; u.pos.set(P.pos.x, 0, P.pos.z); u.velocity.copy(P.vel); u.facing = P.yaw; u.lift = Math.max(0, P.y);
    u.maxHp = maxHp(); u.hp = P.hp; u.alive = !P.dead;
  },

  // ---------------------------------------------------------------- the receiver: its kit's frame, its events
  // every frame (RemotePlayerUnit.update): the kit runs at the pose (the pose wins over the kit's own motion), then
  // the avatar is posed with the kit's rig (Ullr's clown), its tilt and its animator layers (Bacchus' flop, the L dance)
  tickKit(A, dt, t) {
    const c = A.ctx, s = A.ps;
    // (its effects as dense as distance and sight allow: all of them close by, a third far away or off screen)
    c.fxK = !this.fxScale ? 1 : !A.onScreen ? 0.25 : A.camDist < 28 ? 1 : A.camDist < 55 ? 0.6 : 0.35;
    // (an enemy hidden in the reeds: its kit's companions and glows by it are not shown, its particles not made, not heard)
    c.hid = A.hidden(); if (c.hid) c.fxK = 0;
    this.unveil(c);
    if (s) { if (s.as > 0) c.as = s.as; if (s.run > 0) c.run = s.run; if (s.lvl > 0) c.level = s.lvl; }
    c.px = A.pos.x; c.py = A.y; c.pz = A.pos.z;
    // far away or out of sight with nothing going on (no cast for 3 s, its kit not busy): its kit's frame every other
    // frame or so, with the time that passed (its avatar is posed every frame)
    const kdt = (c.acc || 0) + dt;
    if (this.fxScale && c.fxK < 0.5 && !c.busy && performance.now() - (c.castAt || 0) > 3000 && kdt < 0.045) { c.acc = kdt; c.lazy = (c.lazy || 0) + 1; A.pose(dt, t, c.rig, c.anim, c.kx || 0, c.kz || 0); this.veil(c); return; }
    const fdt = dt; c.acc = 0; dt = Math.min(0.05, kdt);   // (the kit gets the time since its last frame; the pose this frame's)
    this.withCtx(c, () => {
      if (s) Object.assign(P, { yaw: s.ay, vy: s.vy, grounded: !(s.flags & 3), flying: !!(s.flags & 2), dead: !!(s.flags & 4), hp: s.hp, mp: s.mana });
      if (s) P.vel.set(s.vx, 0, s.vz);
      P.y = c.py; settings.level = c.level;
      P.atkCd = Math.max(0, (P.atkCd || 0) - dt); P.atkPenalty = Math.max(0, (P.atkPenalty || 0) - dt);
      for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
      Game.thoth.root.rotation.x = 0; Game.thoth.root.rotation.z = 0;
      if (Kit.preUpdate) Kit.preUpdate(dt, t);
      if (Kit.moveOverride) Kit.moveOverride(dt);
      Kit.update(dt, t);
      P.pos.set(c.px, 0, c.pz); P.y = c.py;
      const r = Game.thoth.root;
      c.kx = r.rotation.x; c.kz = r.rotation.z; c.busy = kitBusy();
      A.pose(fdt, t, Game.thoth, Game.anim, r.rotation.x, r.rotation.z);
    });
    this.veil(c);
  },
  // what its kit put in the world by it (Skadi's Kaldr, glows at its feet), hidden while it hides; the kit's own
  // visibility comes back before its next frame (unveil), so it sets it again as it pleases
  veil(c) {
    if (!c.hid || !c.objs) return;
    const L = c.veiled = [];
    for (const o of c.objs) {
      if (!o.parent) { c.objs.delete(o); continue; }
      if (!o.visible || Math.hypot(o.position.x - c.pos.x, o.position.z - c.pos.z) > 6) continue;
      o.visible = false; L.push(o);
    }
  },
  unveil(c) { if (c.veiled) { for (const o of c.veiled) o.visible = true; c.veiled = null; } },
  // one of its events, when its pose timeline gets there: at the caster's place and aim, with its ranks and its seed
  replay(A, k, a) {
    const c = A.ctx; if (!c || c.dead || !Array.isArray(a)) return;
    let i = 0;
    const id = k === 'c' || k === 'i' || k === 'K' ? String(a[i++]) : '';
    const x = a[i++] / 100, z = a[i++] / 100, y = a[i++] / 100, yaw = a[i++] / 1000, hx = a[i++], hz = a[i++], mx = a[i++] / 100, mz = a[i++] / 100;
    if (![x, z, y, yaw].every(Number.isFinite)) return;
    c.aim.hx = Number.isFinite(hx) ? hx / 100 : null; c.aim.hz = Number.isFinite(hz) ? hz / 100 : null; c.aim.mx = mx || 0; c.aim.mz = mz || 0;
    A.heard.cast++; c.castAt = performance.now();
    this.withCtx(c, () => {
      P.pos.set(x, 0, z); P.y = y; P.yaw = yaw;
      if (k === 'c') {
        const ranks = a[i++], lv = a[i++], rs = a[i++];
        if (Array.isArray(ranks)) settings.ranks = ranks.slice(0, 5).map((r) => clamp(r | 0, 1, 5));
        if (lv > 0) settings.level = clamp(lv | 0, 1, 20);
        c.rng = mulberry32(rs >>> 0);
        const ids = Kit.id === 'ullr' ? [...UL_ORDER.bow, ...UL_ORDER.axe] : Kit.order;
        if (!ids.includes(id)) return;
        if (Kit.id === 'ullr' && !ABILITY_ORDER.includes(id)) ulSetStance(U.stance === 'bow' ? 'axe' : 'bow');   // (a stance switch was missed: catch up)
        Kit.cast(id, true);
      } else if (k === 'b') { c.rng = mulberry32(a[i++] >>> 0); Kit.basic(); }
      else if (k === 'i') { if (Kit.intercept) Kit.intercept(id); }
      else if (k === 'L') { if (Kit.lmb) Kit.lmb(); }
      else if (k === 'R') { if (Kit.rmb) Kit.rmb(); }
      else if (k === 'K') { if (Kit.castOn) Kit.castOn(id, this.ghostOf(c, a[i++])); }
    });
  },
  // a unit by its net id as another player's replayed cast sees it (a ghost; me: my stand-in)
  ghostOf(c, tid) {
    if (!tid || !Number.isFinite(tid)) return null;
    if (tid === this.myUid) return this.ghost(c, this.selfUnit());
    const u = this.unit(tid);
    return u && u !== Arena.pu ? this.ghost(c, u) : null;
  },
  // run fn outside the sandbox (my own view, for real) from inside a replayed kit: what lands on MY screen because I am
  // the one it happens to (Cookie Horror's victim); the other player's context comes back after it
  bare(fn) {
    const c = this.ctx; if (!c) return fn();
    this.exit();
    try { return fn(); } finally { this.enter(c); }
  },
  // the reticle distance of a replayed cast (groundTargetDistance): from the caster's own ground hit
  aimDist(maxR, minR) {
    const a = this.ctx.aim; let dist = maxR;
    if (a.hx !== null && a.hz !== null) { const f = fwdOf(P.yaw, _nv1); dist = (a.hx - P.pos.x) * f.x + (a.hz - P.pos.z) * f.z; }
    return clamp(dist, minR, maxR);
  },
  // a Glyph of Pain empowers only its own Thoth's spells
  mine(w) { return w.owner === undefined || w.owner === (this.ctx ? this.ctx.uid : this.myUid); },
  // its god speaks (Sound.voice in its sandbox): from its own bank, where it stands; my voice and my ducking stay mine
  voice(group, o) {
    const c = this.ctx, S = Sound, b = c.bank, A = c.actor, now = S.ctx.currentTime, t0 = now + (o.delay || 0);
    if (c.hid || Math.random() > o.chance) return false;
    if ((c.lastVoice[group] ?? -99) + o.cooldown > now && o.priority < 3) return false;
    if (c.voiceEnd > t0 && c.voicePri >= o.priority) return false;
    const opts = (b.lines[group] || []).filter((n) => b.vox[voiceFile(n)]); if (!opts.length) return false;
    if (A.voiceH && c.voiceEnd > now) A.voiceH.stop(0.1);
    const name = pick(opts), buf = b.vox[voiceFile(name)], sl = voiceSlice(name);   // (a take in a sprite: Cookie Monster's rage lines)
    A.voiceH = S.playBuf(buf, { pos: _nv3.copy(c.pos).setY(A.y + 1.7), bus: S.voiceBus, gain: o.gain, delay: o.delay || 0, falloff: 12, maxDist: 60, off: sl ? sl.off : 0, len: sl ? sl.dur : 0 });
    c.voiceEnd = t0 + Math.min((sl ? sl.dur : buf.duration) * 0.6, 2.2); c.voicePri = o.priority; c.lastVoice[group] = now;
    A.heard.voice++; c.sfx++;
    return true;
  },

  // ---------------------------------------------------------------- tests and debugging
  // the kit containers (a test compares mine around every replay)
  kitState() { return { P, SK, BA, HE, RA, BC, U, CM }; },
  // the other players' kits here, and what each one has going (its effects, flights, decals, callbacks ...)
  sandbox() {
    const S = this.stats || {};
    return { err: S.ctxErr || 0, errs: (S.ctxErrs || []).slice(), swaps: this.swaps, actors: Arena.humans.map((h) => { const c = h.actor.ctx;
      return { peer: h.peer, god: h.actor.god, ctx: c ? c.id : 0, kit: c ? c.god : null, heard: { ...h.actor.heard }, made: c ? c.made : 0, sfx: c ? c.sfx : 0, live: c ? this.leftovers(c.id) : null }; }) };
  },
  // what a context (alive or gone) still has in the world
  leftovers(id, detail = false) {
    const n = (L) => (L || []).filter((o) => o && o.ctx && o.ctx.id === id).length;
    const shared = new Set([ulRain.shaft, ulRain.head, ulConf.mesh, UL_BUBBLE]);   // (pools every Ullr shares, made by whichever came first)
    const objs = scene.children.filter((o) => o.userData && o.userData.netCtx === id && !shared.has(o)), sc = objs.length;
    if (detail) return { scene: objs.map((o) => `${o.type}:${o.name || ''}:${o.visible ? 'v' : 'h'}`), decals: VFX.decals.filter((d) => d.ctx && d.ctx.id === id).map((d) => `${d.dur}:${!!d.hold}:${d.t.toFixed(1)}`) };
    const c = Arena.humans.map((h) => h.actor.ctx).find((x) => x && x.id === id);
    return { godfx: n(GodFX.items), fx2: n(FX2.items), timed: n(VFX.timed), decals: n(VFX.decals), proj: n(Combat.projectiles), waves: n(Combat.waves),
      rain: n(ulRain.list), conf: n(ulConf.list), walls: c ? Combat.walls.filter((w) => w.owner === c.uid).length : 0, scene: sc };
  },
  // (online only) what another player's kit puts in the scene is marked with its context, for leftovers()
  tagScene() {
    if (scene.netTagged) return;
    scene.netTagged = true;
    const add0 = scene.add;
    scene.add = function (...o) {
      const c = Net.ctx;
      if (c) {
        c.made++;
        const S = c.objs || (c.objs = new Set());
        if (S.size > 256) for (const x of S) if (!x.parent) S.delete(x);
        for (const x of o) if (x && x.userData) { x.userData.netCtx = c.id; S.add(x); }
      }
      return add0.apply(this, o);
    };
    // (and counts what it makes: particles, trails)
    // ... and thins a far one's particles (ActorContext.fxK; never those that follow something: a kit may keep them)
    const count = (sys, k) => {
      if (!sys || typeof sys[k] !== 'function' || sys[k].netCounted) return;
      const f = sys[k];
      sys[k] = function (...a) {
        const c = Net.ctx;
        if (c) { c.made++; if (k === 'spawn' && c.fxK < 1 && a[0] && !a[0].follow && Math.random() > c.fxK) { c.thinned = (c.thinned || 0) + 1; return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, max: 0 }; } }
        return f.apply(this, a);
      };
      sys[k].netCounted = true;
    };
    for (const sys of [VFX.add, VFX.glyphs, VFX.smoke, GodFX.p, FX2.glow, FX2.fire, FX2.boom, FX2.smoke, FX2.solid, FX2.rocks, FX2.embers]) count(sys, 'spawn');
    count(VFX, 'trail');
  },
});

// ---- when someone leaves: host migration, a bot in a player's slot, the connection's health -------------------------
// The host leaves mid-match (closes its tab, loses its connection, leaves the room): the player in the match with the
// smallest id takes over (Net.elect: every page has the same states and reaches the same answer). Every page already
// holds the whole world as the host last sent it: its replicas, and the snapshot's clocks (tickets, waves, Sebek, the
// Scales, scarabs, camps). The new host plays out what it was sent, puts each unit where the last snapshot had it and
// makes it its own (Net.own: no longer a replica, its forwarding gone, a bot thinks again), then sends its world as the
// host did; the others start their timeline over on the new host's clock (Net.resync). A player who leaves the match
// (the room at once; the lobby, or never coming, after a few seconds) leaves a bot in its slot with its level, score and
// items (Net.fillSlot on the host; sp brings it to every page, Net.botFor). A player the host gave up on finds its match
// over when it comes back, and waits in the lobby for the next one.
const NET_ARMED_FN = ['applyStun', 'freeze', 'mesmerize', 'blinded', 'rooted', 'slowed', 'marked', 'placeAt', 'shove', 'slideAlong', 'clearStatus'];
const NET_ARMED_FIELD = ['stun', 'root', 'slow', 'antiheal', 'drunk', 'gas', 'lift', 'carried'];
Object.assign(Net, {
  // ---------------------------------------------------------------- host migration
  migrate(ns) {
    this.note(`migrate -> ${this.hostId}`);
    this.migT = performance.now();
    if (this.isHost) this.becomeHost(); else this.resync();
    if (Arena.active) HUD.toast(this.isHost ? 'The host left the match · you are the new host, the match continues' : `The host left the match · ${ns?.n || 'another player'} takes over`);
  },
  // a client: the new host's snapshots start my timeline over (my picture of the world stays until they come)
  resync() {
    Object.assign(this, { snaps: [], tq: [], wa: null, wb: null, wk: 0, rt: 0, rtAt: 0, late: 0, lates: [], btIn: null });
  },
  // I am the new host: the match header is mine (the same match), and the world it describes
  becomeHost() {
    const m = this.match; if (!m) return;
    const cp = (a) => a.map((t) => t.slice());
    this.set({ m: { ...m, own: cp(m.own), roster: cp(m.roster), nm: cp(m.nm), ep: this.epoch, at: m.phase === 'load' ? Date.now() : m.at } });
    if ((Arena.active || Arena.waiting) && !Arena.loading) this.takeOver();   // (still loading: matchReady makes the units mine)
    this.flush(true);
  },
  takeOver() {
    const A = Arena;
    // what the old host sent that my picture had not reached yet: all of it, now (the moments' pictures skipped)
    this.known = this.rep;   // (Net.unit looks there while it plays out)
    this.quiet++;
    try {
      for (;;) {
        const s = this.snaps.find((x) => !x.done), e = this.tq[0];
        if (!s && !e) break;
        if (e && (!s || e.t <= s.t)) { this.tq.shift(); if (!e.vis) { try { e.fn(); } catch (err) { console.warn('[net] takeover event', err); } } }
        else { s.done = true; try { this.applySnap(s, false); } catch (err) { console.warn('[net] takeover snapshot', err); } this.wa = s; }
      }
      // every unit where the old host last had it
      if (this.wa) { this.wb = null; this.wk = 0; for (const u of this.rep.values()) if (!u.gone) this.follow(u, 0); A.time = this.wa.a[0] / 10; }
    } finally { this.quiet--; }
    let top = arenaUnitSeq;
    for (const id of this.made) top = Math.max(top, id);
    this.known = new Map();
    for (const u of A.units) {
      if (u.isRemotePlayer) continue;
      if (u.replica || u.netArmed) this.own(u);
      this.known.set(u.id, u); top = Math.max(top, u.id);
    }
    arenaUnitSeq = top + 100;   // (a new unit never takes a number some page has seen)
    // the scarabs by the old host's numbers; Sebek's strength by the match's time; the first kill is long gone if anyone has one
    let sn = A.scarabN || 0;
    for (const s of A.scarabs) { if (s.netId) s.id = s.netId; s.goal = null; s.t = 0; s.turn = 0; s.home.copy(s.pos); sn = Math.max(sn, s.id); }
    A.scarabN = sn + 10;
    A.siegeN = Math.max(A.siegeN || 0, 2 * Math.floor(A.time / 180));
    for (const X of A.ankh) if (X.taken && X.mesh) { scene.remove(X.mesh); X.mesh = null; }   // (an ankh already taken is no pickup)
    A.firstBlood = A.firstBlood || A.pstats.k > 0 || A.bots.some((b) => b.k > 0) || A.humans.some((h) => h.k > 0);
    // my blows on what is mine now: dealt here (those on another player stay on their way to it)
    for (const [id, q] of [...this.hq]) { if (id < 0) continue; this.hq.delete(id); const u = this.known.get(id); if (u && u.alive) { A.applyHit(u, q[0], A.pu); if (u.onHit) u.onHit(NET_HITK[q[1]] || 'ability'); } }
    for (const [k, q] of [...this.cq]) if (q[0] > 0) this.cq.delete(k);   // (already on them: they are mine)
    for (const id of [...this.pq.keys()]) if (id > 0) this.pq.delete(id);
    Object.assign(this, { rep: new Map(), snaps: [], tq: [], wa: null, wb: null, held: new Set(), wHist: [], wAt: 0, btAt: 0 });
    A.refreshLists(); A.syncTargets();
    this.note(`takeover: ${this.known.size} units, seq ${arenaUnitSeq}`);
  },
  // a replica becomes mine: the class's own methods and plain fields again, its brain from a fresh start
  own(u) {
    if (u.netArmed) {
      for (const k of NET_ARMED_FN) if (Object.prototype.hasOwnProperty.call(u, k)) delete u[k];
      for (const k of NET_ARMED_FIELD) { const v = u[k]; delete u[k]; u[k] = v; }
      u.netArmed = false;
    }
    u.replica = false; u.netPin = 0; u.netHoldT = 0; u.netMiss = 0; u.carried = false;
    if (u.kind === 'god') {
      if (u.recall) { Recall.stopFx(u.recall.fx, false); u.recall = null; }
      Object.assign(u, { motion: null, castLock: 0, react: 0, atkCd: 0, target: null, state: 'push', jungleCamp: null, thinkT: Math.random() * 0.3, castRng: null });
      if (u.alive) { u.lift = 0; if (u.rig) u.rig.root.rotation.x = 0; }
      if (u.gold === undefined) u.gold = 0;
      if (!u.recv) { u.recv = {}; u.recvKey = ''; }
      try { u.applyLevel(); } catch (e) { /* its protections stay as the table had them */ }
    } else if (u.kind === 'minion' || u.kind === 'siege') { u.thinkT = 0; u.target = null; }
  },
  // a claim of mine lost to an earlier one (two pages took over at once): the units are pictures of the other host's again
  demote() {
    const A = Arena;
    this.note('demote');
    if (A.active || A.waiting) for (const u of A.units) { if (u.isRemotePlayer) continue; u.replica = true; this.armForwarding(u); this.rep.set(u.id, u); this.made.add(u.id); }
    this.known = new Map(); this.resync(); this.migT = performance.now();
  },
  dropBot(u) {
    const A = Arena; u.alive = false; u.gone = true;
    A.units = A.units.filter((x) => x !== u); A.bots = A.bots.filter((x) => x !== u);
    this.rep.delete(u.id); try { u.dispose(); } catch (e) { /* gone */ }
    A.refreshLists(); A.syncTargets();
  },

  // ---------------------------------------------------------------- a bot in a player's slot
  // the host: a player gone from the room is replaced at once; one back in the lobby (or never come) after 3 s of the match
  hostSlots(now) {
    const A = Arena, m = this.st && this.st.m;
    if (!this.isHost || !this.match || !m || m.id !== this.match.id || A.loading || !(A.active || A.waiting) || A.phase === 'ended') return;
    for (const h of [...A.humans]) {
      const p = this.peers.get(h.peer), s = p ? p.st : null;
      if (s && s.mi === m.id && (s.r === 'play' || s.r === 'load')) { h.outAt = 0; continue; }
      if (!h.outAt) h.outAt = now;
      if (!s || (A.active && now - h.outAt > 3000)) this.fillSlot(h);
    }
  },
  fillSlot(h) {
    const A = Arena, m = this.st.m, t = h.team, i = h.slot;
    const g = GODS[h.god] && Assets.glb[h.god] && BOT_KITS[h.god] ? h.god : m.roster[t][i];
    if (!GODS[g] || !Assets.glb[g]) return;
    const b = new BotGod(g, t, i);   // (a new number, the host's: sp takes it to every page)
    b.netFill = true;
    Object.assign(b, { level: clamp(h.level || 3, 1, 20), xp: 0, k: h.k || 0, d: h.d || 0, a: h.a || 0, gold: 0, recv: {}, recvKey: '' });
    b.inv = (h.lastInv || []).filter((id) => ITEM[id]).slice(0, 6); b.istats = sumItemStats(b.inv);
    b.applyLevel(true);
    // (where the player last was, as its newest pose says - the stand-in may already be drawn by a stale clock - and its health)
    const pb = this.poses.get(h.peer), q = pb && pb.length ? pb[pb.length - 1] : null;
    if (A.active && (h.dead || (q && q[12] & 4))) { b.alive = false; b.hp = 0; b.dying = 0; b.mesh.visible = false; b.respawn = Math.max(1, h.respawn || 3); if (q) b.pos.set(q[1] / 100, 0, q[3] / 100); else b.pos.copy(h.pos); }
    else if (A.active && q) { b.pos.set(q[1] / 100, 0, q[3] / 100); b.facing = q[5] / 1000; b.hp = Math.max(1, b.maxHp * clamp(q[13] / Math.max(1, q[14]), 0.05, 1)); }
    else { A.placeAtFountain(b, i); b.facing = t === 0 ? Math.PI / 2 : -Math.PI / 2; }
    this.poses.delete(h.peer);
    b.mesh.position.set(b.pos.x, 0, b.pos.z);
    A.units = A.units.filter((u) => u !== h); A.humans = A.humans.filter((u) => u !== h);
    for (const u of A.units) if (u.target === h) u.target = null;
    try { h.dispose(); } catch (e) { console.warn('[net] slot', e); }
    A.units.push(b); A.bots.push(b);
    const own = m.own.map((x) => x.slice()), roster = m.roster.map((x) => x.slice()), nm = m.nm.map((x) => x.slice());
    own[t][i] = 0; roster[t][i] = g; nm[t][i] = '';
    this.set({ m: { ...m, own, roster, nm } });
    if (this.match !== this.st.m) Object.assign(this.match, { own, roster, nm });
    A.refreshLists(); A.syncTargets();
    A.pushFeed(null, null, `${netEsc(h.nick)} left the match · a bot takes over`);
    this.note(`slot ${t}/${i} -> bot ${b.id}`);
  },
  // a client: the bot the host put in a player's slot (its sp, or its snapshot record); the slot's stand-in goes
  botFor(team, slot) {
    const A = Arena, m = this.hostState()?.m || this.match, h = A.humans.find((x) => x.team === team && x.slot === slot);
    let g = m && m.roster && m.roster[team] ? m.roster[team][slot] : null;
    if (!GODS[g] || !Assets.glb[g]) g = h && Assets.glb[h.god] ? h.god : null;
    if (!g) return null;
    const seq = arenaUnitSeq, b = new BotGod(g, team, slot); arenaUnitSeq = seq;
    b.netFill = true;
    if (h) {
      Object.assign(b, { k: h.k, d: h.d, a: h.a, level: h.level || 3 });
      b.pos.copy(h.pos);
      A.units = A.units.filter((u) => u !== h); A.humans = A.humans.filter((u) => u !== h);
      try { h.dispose(); } catch (e) { console.warn('[net] slot', e); }
    }
    A.units.push(b); A.bots.push(b); A.refreshLists();
    if (b.camDist < 40) FX2.burst(b.pos.clone().setY(1.2), b.bk.pal, { size: 0.6, sparks: 14, embers: 6, puffs: 0, bursts: 1, light: false, distort: false });
    return b;
  },

  // ---------------------------------------------------------------- the connection, as the lobby and the match show it
  // (?relays=wss://a,wss://b and ?turn=turn:host:3478|user|pass, or the lobby's Avansert: kept in this browser)
  relayList() {
    let s = this.q.get('relays'); if (!s) { try { s = localStorage.getItem('thoth-net-relays') || ''; } catch (e) { s = ''; } }
    return String(s || '').split(/[\s,]+/).filter((u) => /^wss?:\/\/\S+$/i.test(u)).slice(0, 12);
  },
  turnList() {
    let s = this.q.get('turn'); if (!s) { try { s = localStorage.getItem('thoth-net-turn') || ''; } catch (e) { s = ''; } }
    return String(s || '').split(/[\s,]+/).map((x) => x.split('|')).filter((a) => /^turns?:\S+$/i.test(a[0])).slice(0, 4)
      .map(([urls, username, credential]) => (username ? { urls, username, credential: credential || '' } : { urls }));
  },
  // a phone or tablet with no mouse: it can join and share, but the Arena needs a keyboard and a mouse (?touch=1 in tests)
  touchOnly() {
    if (this.q.get('touch') === '1') return true;
    try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) { return false; }
  },
  // more than ten in the room and I am among the latest: no place for me in the next match
  over() {
    const all = [{ id: this.me, st: this.st }, ...this.present()].sort((a, b) => (a.st.jt - b.st.jt) || (a.id < b.id ? -1 : 1));
    return all.findIndex((p) => p.id === this.me) >= 2 * NET_MAX_TEAM;
  },
  // a joiner who has met nobody after NET_LONELY ms: the lobby's help text (renderLobby) and a retry
  lonely(now) {
    const was = this.aloneNow, is = this.online && !this.created && !this.metAt && now - this.joinT > NET_LONELY;
    if (is !== was) { this.aloneNow = is; this.uiDirty = true; if (is) this.note('nobody found'); }
  },
  // the lobby's connection line: [text, kind]
  connLine(now = performance.now()) {
    const n = this.present().length, who = n === 1 ? '1 other player' : `${n} other players`;
    if (this.kind === 'mem') return [`Local test connection · ${n ? who + ' in the room' : 'nobody else yet'}`, n ? 'ok' : ''];
    const rs = this.backend && this.backend.relayState ? this.backend.relayState() : { open: 0, all: 0 }, own = this.relayList().length ? ' · custom relays' : '';
    if (n) return [`Connected · ${who} in the room · signaling ${rs.open}/${rs.all}${own}`, 'ok'];
    if (!rs.open && now - this.joinT > 8000) return ['Cannot reach the signaling network (Nostr relays) · check your internet connection, or try another network', 'warn'];
    return [`Looking for other players … · signaling ${rs.open}/${rs.all || '…'} relays${own}`, ''];
  },
  // the match's corner: who hosts, how far away it is, and a word when the link is in trouble
  hud(now) {
    const show = this.online && !!this.match && Arena.active;
    let el = this.hudEl;
    if (!show) { if (el && !el.hidden) el.hidden = true; return; }
    if (!el) { el = this.hudEl = document.createElement('div'); el.id = 'netHud'; (Arena.ui ? Arena.ui.root : document.getElementById('app')).appendChild(el); }
    const hp = this.isHost ? null : this.peers.get(this.hostId), n = this.present().filter((p) => p.st.mi === this.match.id).length + 1;
    let txt = `${this.isHost ? 'You are the host' : 'Host: ' + (hp && hp.st ? netName(hp.st.n) : '…')} · ${n} ${n === 1 ? 'player' : 'players'}`, kind = '';
    if (hp && hp.rtt) { const r = Math.round(hp.rtt); txt += ` · ${r} ms`; if (r > 250) kind = 'warn'; }
    if (!this.isHost && this.migT) { txt = 'Switching host …'; kind = 'warn'; }
    else if (hp && now - hp.at > 2500) { txt = `Lost contact with the host · waiting (${Math.round((now - hp.at) / 1000)} s)`; kind = 'warn'; }
    if (el.textContent !== txt) el.textContent = txt;
    const c = kind ? 'warn' : ''; if (el.className !== c) el.className = c;
    el.hidden = false;
  },
  inviteText() { return `Join me in Thoth Playroom · Arena 5v5! Open the link (free, no account): ${this.inviteUrl()} · room code ${this.code}`; },
  share() {
    const url = this.inviteUrl(), text = this.inviteText();
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: 'Thoth Playroom', text: text.replace(' ' + url, ''), url }).catch(() => {}); return; }
    const ok = () => this.flash('Invite copied · paste it into a message to your friends', 'ok');
    const fallback = () => { this.ui.link.value = text; this.ui.link.focus(); this.ui.link.select(); try { if (document.execCommand('copy')) return ok(); } catch (e) { /* no clipboard */ } this.flash('Select the text and copy it yourself'); };
    try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (e) { fallback(); }
  },
  retry() {
    const c = this.code; if (!c) return;
    this.leave({ quiet: true }); this.showLobby(); this.join(c);
  },
});


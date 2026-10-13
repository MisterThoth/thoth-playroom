// ============================================================================
// HUD: SMITE-style ability bar, bars, buffs, tooltips, floating combat text,
// enemy health bars and the reticle (2D overlay canvas).
// ============================================================================
// ---- procedural icons -------------------------------------------------------
function iconBase(ctx, S, c1, c2) {
  const g = ctx.createRadialGradient(S * 0.5, S * 0.42, 2, S * 0.5, S * 0.5, S * 0.75);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (let i = -S; i < S * 2; i += 10) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke(); }
}
function glowText(ctx, draw, color, blur = 14) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; draw(); ctx.restore(); draw();
}
function drawIcon(cv, id) {
  const S = cv.width, ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  if (Kit && Kit.icon && Kit.icon(ctx, S, id)) return;
  if (id === 'passive') {
    iconBase(ctx, S, '#2a4a9a', '#0a1028');
    ctx.save(); ctx.translate(S / 2, S * 0.56);
    glowText(ctx, () => {
      ctx.fillStyle = '#f2e4be'; ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-S * 0.18, -2, -S * 0.36, 4); ctx.lineTo(-S * 0.36, -S * 0.26); ctx.quadraticCurveTo(-S * 0.18, -S * 0.32, 0, -S * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(S * 0.18, -2, S * 0.36, 4); ctx.lineTo(S * 0.36, -S * 0.26); ctx.quadraticCurveTo(S * 0.18, -S * 0.32, 0, -S * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
    }, '#8fdcff', 16);
    ctx.restore();
    drawGlyph(ctx, 'ibis', S * 0.32, S * 0.42, S * 0.22, 'rgba(40,70,140,0.85)');
    drawGlyph(ctx, 'eye', S * 0.68, S * 0.42, S * 0.2, 'rgba(40,70,140,0.85)');
  } else if (id === 'ha') {
    iconBase(ctx, S, '#7a2fb0', '#1a0a32');
    glowText(ctx, () => drawGlyph(ctx, 'eye', S / 2, S / 2, S * 0.78, '#ffd9ff'), '#ff7ff0', 18);
  } else if (id === 'ep') {
    iconBase(ctx, S, '#7a2a6a', '#1c0a24');
    ctx.save(); ctx.translate(S * 0.56, S * 0.5); ctx.rotate(-0.25);
    glowText(ctx, () => {
      ctx.fillStyle = '#f6e7c8'; ctx.fillRect(-S * 0.2, -S * 0.26, S * 0.4, S * 0.52);
      ctx.fillStyle = 'rgba(90,50,20,0.7)'; for (let i = 0; i < 5; i++) ctx.fillRect(-S * 0.14, -S * 0.18 + i * S * 0.08, S * 0.28, 2);
    }, '#ff9be6', 14);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,200,240,0.85)'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(S * 0.08, S * (0.3 + i * 0.12)); ctx.lineTo(S * 0.34, S * (0.3 + i * 0.12)); ctx.stroke(); }
  } else if (id === 'gp') {
    iconBase(ctx, S, '#5a2aa0', '#130a2a');
    glowText(ctx, () => drawGlyph(ctx, 'scarab', S / 2, S * 0.52, S * 0.7, '#e9d6ff'), '#b07bff', 14);
    ctx.save(); ctx.strokeStyle = '#ff9b3d'; ctx.lineWidth = 4; ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(S * 0.12, S * 0.3); ctx.quadraticCurveTo(S * 0.55, S * 0.42, S * 0.9, S * 0.2); ctx.stroke(); ctx.restore();
  } else if (id === 'fj') {
    iconBase(ctx, S, '#2266d8', '#06123a');
    ctx.save(); ctx.translate(S * 0.52, S * 0.5); ctx.rotate(0.35);
    glowText(ctx, () => {
      ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.moveTo(-S * 0.22, -S * 0.28); ctx.lineTo(S * 0.18, -S * 0.3); ctx.quadraticCurveTo(S * 0.3, 0, S * 0.2, S * 0.3); ctx.lineTo(-S * 0.2, S * 0.28); ctx.quadraticCurveTo(-S * 0.1, 0, -S * 0.22, -S * 0.28); ctx.fill();
      ctx.fillStyle = 'rgba(40,90,180,0.7)'; for (let i = 0; i < 5; i++) ctx.fillRect(-S * 0.12, -S * 0.18 + i * S * 0.08, S * 0.28, 2);
    }, '#8fd6ff', 18);
    ctx.restore();
  } else if (id === 'fs') {
    // the Final Spell: the open book high in a dark sky, a column of light down onto ground split open
    iconBase(ctx, S, '#0b2f8a', '#01040f');
    ctx.save(); ctx.translate(S / 2, S * 0.5); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    glowText(ctx, () => {
      const g = ctx.createLinearGradient(0, -S * 0.2, 0, S * 0.3); g.addColorStop(0, 'rgba(190,240,255,0.95)'); g.addColorStop(1, 'rgba(60,140,255,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-S * 0.07, -S * 0.2); ctx.lineTo(S * 0.07, -S * 0.2); ctx.lineTo(S * 0.17, S * 0.3); ctx.lineTo(-S * 0.17, S * 0.3); ctx.closePath(); ctx.fill();   // the column
      ctx.fillStyle = '#eaf8ff'; ctx.beginPath(); ctx.moveTo(0, -S * 0.24); ctx.quadraticCurveTo(-S * 0.17, -S * 0.36, -S * 0.34, -S * 0.3); ctx.lineTo(-S * 0.34, -S * 0.18); ctx.quadraticCurveTo(-S * 0.17, -S * 0.24, 0, -S * 0.14); ctx.quadraticCurveTo(S * 0.17, -S * 0.24, S * 0.34, -S * 0.18); ctx.lineTo(S * 0.34, -S * 0.3); ctx.quadraticCurveTo(S * 0.17, -S * 0.36, 0, -S * 0.24); ctx.fill();   // the open book
    }, '#7fd8ff', 16);
    glowText(ctx, () => {
      ctx.strokeStyle = '#8fe4ff'; ctx.lineWidth = S * 0.028;
      for (const [x0, a] of [[-0.08, -2.6], [0.06, -0.5], [-0.02, 2.0], [0.1, 0.9], [-0.12, -1.6]]) { ctx.beginPath(); let x = S * x0, y = S * 0.32; ctx.moveTo(x, y); for (let k = 0; k < 3; k++) { x += Math.cos(a + k * 0.5) * S * 0.09; y += Math.abs(Math.sin(a + k * 0.5)) * S * 0.03; ctx.lineTo(x, y); } ctx.stroke(); }   // the split ground
      ctx.fillStyle = '#c9b48f'; for (const [x, y, r] of [[-0.3, 0.12, 0.035], [0.29, 0.08, 0.03], [-0.22, -0.02, 0.022], [0.24, -0.04, 0.025]]) { ctx.beginPath(); ctx.arc(S * x, S * y, S * r, 0, TAU); ctx.fill(); }   // stones thrown up
    }, '#3fb0ff', 10);
    ctx.restore();
  } else if (id === 'buffEye') {
    iconBase(ctx, S, '#2266d8', '#06123a');
    glowText(ctx, () => drawGlyph(ctx, 'eye', S / 2, S / 2, S * 0.8, '#d8f3ff'), '#7fd8ff', 12);
  } else if (id === 'buffPage') {
    iconBase(ctx, S, '#b07a20', '#2a1606');
    glowText(ctx, () => { ctx.fillStyle = '#fff1c8'; ctx.fillRect(S * 0.28, S * 0.2, S * 0.44, S * 0.6); }, '#ffcf6a', 12);
  } else if (id === 'buffBook') {
    iconBase(ctx, S, '#1f6a50', '#06180f');
    glowText(ctx, () => drawGlyph(ctx, 'ibis', S / 2, S / 2, S * 0.8, '#e8ffe8'), '#5fffa8', 10);
  }
}
function drawPortrait(cv) {
  // render Thoth's head into the portrait canvas with a tiny dedicated pass
  if (HEADLESS) return;   // (?headless=1 draws nothing: a whole-scene pass on a software GPU stalls every page for seconds)
  const S = cv.width;
  const rt = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const head = new THREE.Vector3().setFromMatrixPosition(Game.thoth.bones.head.matrixWorld);
  const f = fwdOf(P.yaw);
  cam.position.copy(head).addScaledVector(f, 1.05).add(new THREE.Vector3(Math.cos(P.yaw) * 0.45, 0.18, -Math.sin(P.yaw) * 0.45));
  cam.lookAt(head.clone().add(new THREE.Vector3(0, 0.1, 0)).addScaledVector(f, 0.12));
  const fogWas = scene.fog; scene.fog = null;
  const bgWas = scene.background; scene.background = new THREE.Color(0x12224a);
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.fog = fogWas; scene.background = bgWas;
  const px = new Uint8Array(S * S * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const si = ((S - 1 - y) * S + x) * 4, di = (y * S + x) * 4;
    // simple tone curve (linear -> sRGB-ish)
    for (let k = 0; k < 3; k++) img.data[di + k] = Math.min(255, Math.pow(px[si + k] / 255, 1 / 2.2) * 255 * 1.05);
    img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  rt.dispose();
}

const HUD = {
  els: {}, abilities: {}, toastT: 0, warnT: 0, texts: [],
  init() {
    const $ = (id) => document.getElementById(id);
    this.els = { hud: $('hud'), abilities: $('abilities'), hpFill: document.querySelector('.bar.hp .fill'), hpTxt: document.querySelector('.bar.hp .txt'), mpFill: document.querySelector('.bar.mp .fill'), mpTxt: document.querySelector('.bar.mp .txt'), lvl: $('lvl'), buffs: $('buffs'), toast: $('toast'), warn: $('warn'), channel: $('channel'), tip: $('tooltip'), mTotal: $('mTotal'), mDps: $('mDps'), mLast: $('mLast'), reckonStacks: document.querySelector('#reckon .stacks'), reckonBar: document.querySelector('#reckon .names div'), reckonTxt: $('reckonTxt'), keys: $('keys'), lockhint: $('lockhint') };
    const mk = (id, key, cls = '') => {
      const d = document.createElement('div'); d.className = 'ab ' + cls; d.dataset.id = id;
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; d.appendChild(cv); drawIcon(cv, id);
      if (id !== 'passive') {
        d.insertAdjacentHTML('beforeend', `<div class="cd"></div><div class="cdtxt"></div><div class="key">${key}</div><div class="cost"></div><div class="pips">${'<i></i>'.repeat(5)}</div><div class="stack"></div>`);
      }
      this.els.abilities.appendChild(d);
      d.addEventListener('mouseenter', () => this.showTip(id, d));
      d.addEventListener('mouseleave', () => this.hideTip());
      this.abilities[id] = { el: d, cd: d.querySelector('.cd'), cdtxt: d.querySelector('.cdtxt'), cost: d.querySelector('.cost'), pips: d.querySelectorAll('.pips i'), stack: d.querySelector('.stack') };
    };
    this.mk = mk;
    this.rebuild();
  },
  // per-god ability bar, buff slots and passive panel
  rebuild() {
    if (Net.ctx) return;   // (another player's replayed cast never touches my HUD: 14n_net.js)
    this.els.abilities.innerHTML = ''; this.abilities = {};
    this.mk('passive', '', 'passive');
    ABILITY_ORDER.forEach((id, i) => this.mk(id, ABILITY_KEYS[i], i === 4 ? 'final' : ''));   // Q E R F G (1-5 also work)
    this.els.buffs.innerHTML = ''; this.buffSlots = [];
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('div'); b.className = 'buff'; b.hidden = true;
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; b.appendChild(cv);
      b.insertAdjacentHTML('beforeend', '<b></b><span></span>');
      this.els.buffs.appendChild(b);
      this.buffSlots.push({ el: b, cv, n: b.querySelector('b'), t: b.querySelector('span'), icon: null });
    }
    const reck = document.getElementById('reckon'); if (reck) reck.hidden = Kit.passivePanel !== 'reckon';
    document.getElementById('bottom').style.setProperty('--god', Kit.color);
  },
  showTip(id, anchor) {
    const info = Kit && Kit.info ? Kit.info[id] : null;
    if (!info) return;
    const rows = info.rows().map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const key = keyOf(id);
    this.els.tip.innerHTML = `<div class="k">${key ? `${key} / ${ABILITY_ORDER.indexOf(id) + 1} · ` : ''}${info.kind}</div><h4>${info.name}</h4><p>${info.text}</p><dl>${rows}</dl>`;
    this.els.tip.hidden = false;
    const r = anchor.getBoundingClientRect(), tw = this.els.tip.offsetWidth, th = this.els.tip.offsetHeight;
    this.els.tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 16, innerWidth - tw - 16) + 'px';
    this.els.tip.style.top = Math.max(16, r.top - th - 12) + 'px';
  },
  hideTip() { this.els.tip.hidden = true; },
  toast(msg) { if (Net.ctx) return; this.els.toast.textContent = msg; this.els.toast.classList.add('on'); this.toastT = 2.4; },
  warn(msg) { if (Net.ctx) return; this.els.warn.textContent = msg; this.els.warn.classList.add('on'); this.warnT = 1.1; },
  flashAbility(id) { if (Net.ctx) return; const a = this.abilities[id]; if (!a) return; a.el.classList.remove('flash'); void a.el.offsetWidth; a.el.classList.add('flash'); },
  channel(pages) {
    if (Net.ctx) return;
    this.els.channel.hidden = pages <= 0;
    this.els.channel.querySelectorAll('.pages i').forEach((el, i) => el.classList.toggle('on', i < pages));
  },
  update(dt) {
    const e = this.els;
    const mh = maxHp(), mm = maxMp();
    e.hpFill.style.transform = `scaleX(${clamp(P.hp / mh, 0, 1)})`;
    e.hpTxt.textContent = `${Math.round(P.hp)} / ${Math.round(mh)}`;
    e.mpFill.style.transform = `scaleX(${clamp(P.mp / mm, 0, 1)})`;
    e.mpTxt.textContent = `${Math.round(P.mp)} / ${Math.round(mm)}`;
    e.lvl.textContent = lvl();
    for (const id of ABILITY_ORDER) {
      const a = this.abilities[id];
      const cdMax = cdOf(id) || 1;
      let cd = P.cd[id] || 0;
      if (Kit.cdHidden && Kit.cdHidden(id)) cd = 0;
      const pct = cd > 0 ? clamp(cd / cdMax, 0, 1) * 100 : 0;
      a.cd.style.setProperty('--p', pct.toFixed(1) + '%');
      a.cdtxt.textContent = cd > 0 ? (cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)) : '';
      a.cost.textContent = costOf(id);
      const noMana = !settings.infiniteMana && P.mp < costOf(id);
      a.el.classList.toggle('nomana', noMana);
      a.el.classList.toggle('armed', P.targeting === id || !!(Kit.armed && Kit.armed(id)));
      a.el.classList.toggle('ready', cd <= 0 && !noMana);
      const r = rankOf(id);
      a.pips.forEach((p, i) => p.classList.toggle('on', i < r));
      a.stack.textContent = Kit.stack ? Kit.stack(id) : '';
    }
    // buffs
    const bl = Kit.buffs ? Kit.buffs() : [];
    this.buffSlots.forEach((slot, i) => {
      const b = bl[i];
      slot.el.hidden = !b || !b.on;
      if (!b || !b.on) return;
      if (slot.icon !== b.icon) { slot.icon = b.icon; drawIcon(slot.cv, b.icon); }
      slot.n.textContent = b.n ?? ''; slot.t.textContent = b.t ?? '';
    });
    if (Kit.passivePanel !== 'reckon') { this.meterUpdate(dt); return; }
    const R = Combat.reckon;
    // dead reckoning panel
    const max = reckonMaxStacks();
    if (e.reckonStacks.children.length !== 5) { e.reckonStacks.innerHTML = '<i>𓅝</i>'.repeat(5); }
    [...e.reckonStacks.children].forEach((el, i) => { el.classList.toggle('on', i < R.stacks); el.classList.toggle('locked', i >= max); });
    e.reckonBar.style.width = (R.names / AB.passive.kills * 100).toFixed(1) + '%';
    e.reckonTxt.textContent = `${R.names} / ${AB.passive.kills} names · ${AB.passive.flat * R.stacks} pen`;
    this.meterUpdate(dt);
  },
  meterUpdate(dt) {
    const e = this.els;
    e.mTotal.textContent = Math.round(Combat.total).toLocaleString('en-US');
    e.mDps.textContent = Math.round(Combat.dps()).toLocaleString('en-US');
    e.mLast.textContent = Combat.lastHit ? `${Combat.lastHit.amount} · ${Combat.lastHit.name}` : '–';
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.classList.remove('on'); }
    if (this.warnT > 0) { this.warnT -= dt; if (this.warnT <= 0) e.warn.classList.remove('on'); }
  },
  // 2D overlay: bars, combat text, reticle
  draw2D(dt) {
    const W = innerWidth, H = innerHeight;
    fx.clearRect(0, 0, W, H);
    if (Game.mode !== 'play' && Game.mode !== 'inspect') return;
    const v = _v1;
    // Arena 5v5 draws its own team-coloured bars and names over every unit
    if (Arena.active) Arena.drawBars(fx, W, H, dt);
    else for (const d of Combat.dummies) {
      if (!d.alive) continue;
      v.set(d.pos.x, d.height + 0.35, d.pos.z).project(camera);
      if (v.z > 1 || v.z < -1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const dist = camera.position.distanceTo(d.pos);
      if (dist > 45) continue;
      const bw = d.isGod ? 118 : 74, bh = d.isGod ? 10 : 7;
      fx.globalAlpha = clamp(1.3 - dist / 40, 0.35, 1);
      fx.fillStyle = 'rgba(5,6,14,0.85)'; fx.fillRect(x - bw / 2 - 2, y - 2, bw + 4, bh + 4);
      const frac = clamp(d.hp / d.maxHp, 0, 1);
      d.lagHp = d.lagHp === undefined ? frac : Math.max(frac, d.lagHp - dt * 0.6);
      fx.fillStyle = '#f2e7c8'; fx.fillRect(x - bw / 2, y, bw * d.lagHp, bh);
      const grd = fx.createLinearGradient(0, y, 0, y + bh); grd.addColorStop(0, '#ff6a52'); grd.addColorStop(1, '#a51d14');
      fx.fillStyle = grd; fx.fillRect(x - bw / 2, y, bw * frac, bh);
      fx.fillStyle = 'rgba(0,0,0,0.5)';
      const seg = d.isGod ? 8 : 4; for (let i = 1; i < seg; i++) fx.fillRect(x - bw / 2 + (bw * i) / seg, y, 1, bh);
      fx.font = `700 ${d.isGod ? 13 : 11}px Rajdhani, system-ui, sans-serif`; fx.textAlign = 'center';
      fx.fillStyle = d.isGod ? '#ffcf6a' : '#d8e6ff';
      fx.fillText(d.isGod ? `${d.name} · god` : d.name, x, y - 5);
      let ix = x + bw / 2 + 8;
      for (const [on, label, col] of [[d.frozen, 'FROZEN', '#bff2ff'], [d.stun, 'STUN', '#ffe28a'], [d.mez, 'HEX', '#9bff8a'], [d.root, 'ROOT', '#ffcf6a'], [d.blind, 'BLIND', '#fff6c0'], [d.markT, 'MARKED', '#d0a8ff'], [d.bleeds.length, 'BLEED', '#ff8a7a'], [d.slow, 'SLOW', '#8fd6ff'], [d.drunk, 'DRUNK', '#e07bff'], [d.gas, 'GASSED', '#a6ff4a'], [d.antiheal, 'ANTIHEAL', '#ff6fa8']]) {
        if (!(on > 0)) continue;
        fx.fillStyle = col; const w = fx.measureText(label).width; fx.fillText(label, ix + w / 2, y + bh); ix += w + 8;
      }
      fx.globalAlpha = 1;
    }
    // floating combat text
    // (realism pass: smaller, shorter-lived numbers; Combat.floatNumber merges rapid ticks into one)
    Combat.texts = Combat.texts.filter((tx) => {
      tx.t += dt;
      const life = tx.big ? 1.3 : 0.95;
      if (tx.t >= life) { tx.done = true; return false; }
      v.set(tx.x, tx.y + tx.t * 0.9, tx.z).project(camera);
      if (v.z > 1) return true;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const pop = tx.t < 0.1 ? 1 + (0.1 - tx.t) * 3 : 1;
      const size = (tx.big ? 24 : tx.small ? 13 : 17) * pop;
      fx.globalAlpha = (1 - smoothstep(life * 0.55, life, tx.t)) * (tx.small ? 0.85 : 1);
      fx.font = `700 ${size}px Rajdhani, system-ui, sans-serif`; fx.textAlign = 'center';
      fx.lineWidth = 3; fx.strokeStyle = 'rgba(0,0,0,0.8)'; fx.strokeText(tx.text, x, y);
      fx.fillStyle = tx.color; fx.fillText(tx.text, x, y);
      fx.globalAlpha = 1;
      return true;
    });
    // reticle
    if (Game.mode === 'play') {
      v.copy(Cam.look).project(camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      fx.strokeStyle = P.targeting ? 'rgba(255,190,90,0.95)' : 'rgba(220,240,255,0.85)'; fx.lineWidth = 2;
      fx.beginPath(); fx.arc(x, y, 9, 0, TAU); fx.stroke();
      fx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { fx.moveTo(x + dx * 13, y + dy * 13); fx.lineTo(x + dx * 19, y + dy * 19); } fx.stroke();
      fx.fillStyle = 'rgba(220,240,255,0.9)'; fx.fillRect(x - 1, y - 1, 2, 2);
    }
  },
};


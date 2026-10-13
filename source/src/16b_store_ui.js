// ============================================================================
// ITEMS (2/2) · procedural item icons, the store (P), the HUD inventory, tooltips and the dev hooks.
// Icons are painted on canvas in memory (no image files): a gradient medallion per category, a metal
// symbol per item and a rim in the tier's colour (bronze I, silver II, gold III, jade starter).
// ============================================================================
const ICON_INK = {   // metal gradients: light, mid, dark
  gold: ['#fff4c8', '#f0be5a', '#7a4e12'], silver: ['#ffffff', '#c9d2e4', '#4f5870'], bronze: ['#ffd9a8', '#c98a4a', '#5a2c10'],
  jade: ['#d8ffe8', '#56d68e', '#0e5a32'], ruby: ['#ffd0c8', '#ff5a48', '#6a0c08'], azure: ['#d8f0ff', '#5ab4ff', '#0c3478'],
  violet: ['#f0dcff', '#b07cff', '#3a1478'], bone: ['#fffaf0', '#e8dcc0', '#7a6a48'], ice: ['#ffffff', '#aee8ff', '#2a6a9a'],
  ember: ['#fff0b0', '#ffa030', '#7a2a00'], teal: ['#d0fff6', '#3fd8c0', '#0a5048'], wood: ['#d8a878', '#8a5a30', '#3a2210'],
};
const ICON_BG = { start: ['#2f8a5a', '#061810'], phys: ['#a8402a', '#1e0806'], mag: ['#4a36c8', '#0a0624'], def: ['#2a7a72', '#04161a'], sup: ['#b8862a', '#201304'], cons: ['#a83a6a', '#1e0612'], relic: ['#2a90b8', '#041420'] };
const TIER_RIM = { 0: '#6fe0a0', 1: '#c98a4a', 2: '#dfe6f4', 3: '#f2c25e' };
const rimOf = (it) => (it.cat === 'cons' ? '#ff8ab8' : it.cat === 'relic' ? '#7fe8ff' : TIER_RIM[it.tier]);
const TIER_LABEL = (it) => (it.cat === 'start' ? 'Starter Item' : it.cat === 'cons' ? 'Consumable' : it.cat === 'relic' ? 'Relic' : `Tier ${['', 'I', 'II', 'III'][it.tier]}`);

// ---- the symbols, drawn in unit space (-1..1); F() fills with the item's metal and outlines
const SYM = (() => {
  const S = {};
  const lin = (c, a, b, stops) => { const g = c.createLinearGradient(a[0], a[1], b[0], b[1]); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const rad = (c, x, y, r, stops) => { const g = c.createRadialGradient(x, y - r * 0.3, r * 0.05, x, y, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const wood = (c) => lin(c, [-0.2, -1], [0.2, 1], ICON_INK.wood);
  const ring = (c, x, y, r) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); };
  S.sickle = (c, F, k) => {
    c.beginPath(); c.arc(0.12, -0.05, 0.74, Math.PI * 1.02, Math.PI * 1.97); c.arc(0.26, 0.14, 0.56, Math.PI * 1.9, Math.PI * 1.1, true); c.closePath(); F();
    c.save(); c.translate(-0.6, 0.0); c.rotate(0.75); c.beginPath(); c.rect(-0.08, 0, 0.16, 0.8); F(wood(c)); c.restore();
  };
  S.fang = (c, F) => {
    c.beginPath(); c.moveTo(-0.42, -0.55); c.quadraticCurveTo(0.1, -0.85, 0.42, -0.42); c.quadraticCurveTo(0.38, 0.35, -0.12, 0.85); c.quadraticCurveTo(0.02, 0.05, -0.42, -0.55); c.closePath(); F();
    c.beginPath(); c.moveTo(-0.3, -0.42); c.quadraticCurveTo(0.05, -0.6, 0.3, -0.35); c.lineWidth = 0.05; c.strokeStyle = 'rgba(80,50,20,.6)'; c.stroke();
  };
  S.tooth = (c, F, k) => { S.fang(c, F, k); c.beginPath(); c.moveTo(-0.08, 0.6); c.quadraticCurveTo(0.12, 0.85, -0.02, 0.98); c.quadraticCurveTo(-0.2, 0.85, -0.08, 0.6); F('#d0201a'); };
  S.arrow = (c, F) => {
    c.save(); c.rotate(Math.PI / 4);
    c.beginPath(); c.rect(-0.05, -0.45, 0.1, 1.25); F(wood(c));
    c.beginPath(); c.moveTo(0, -0.98); c.lineTo(0.24, -0.4); c.lineTo(0, -0.52); c.lineTo(-0.24, -0.4); c.closePath(); F();
    for (const s of [1, -1]) { c.beginPath(); c.moveTo(0, 0.42); c.lineTo(s * 0.26, 0.62); c.lineTo(s * 0.26, 0.9); c.lineTo(0, 0.72); c.closePath(); F('#c8382a'); }
    c.restore();
  };
  S.gem = (c, F, k) => {
    c.beginPath(); c.moveTo(0, -0.78); c.lineTo(0.62, -0.28); c.lineTo(0.46, 0.55); c.lineTo(0, 0.82); c.lineTo(-0.46, 0.55); c.lineTo(-0.62, -0.28); c.closePath(); F(rad(c, -0.1, -0.1, 0.9, [k[0], k[1], k[2]]));
    c.beginPath(); c.moveTo(-0.62, -0.28); c.lineTo(-0.25, -0.12); c.lineTo(0, -0.78); c.lineTo(0.25, -0.12); c.lineTo(0.62, -0.28); c.moveTo(-0.25, -0.12); c.lineTo(0, 0.82); c.lineTo(0.25, -0.12); c.lineTo(-0.25, -0.12);
    c.lineWidth = 0.035; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  };
  S.scroll = (c, F) => {
    c.beginPath(); c.rect(-0.55, -0.48, 1.1, 0.96); F(lin(c, [0, -0.5], [0, 0.5], ['#fbf0d0', '#e2c88e', '#c8a868']));
    for (const y of [-0.5, 0.5]) { c.beginPath(); c.ellipse(0, y, 0.66, 0.13, 0, 0, TAU); F(lin(c, [0, y - 0.13], [0, y + 0.13], ['#f4e2b4', '#b08848', '#6a4a20'])); }
    c.strokeStyle = 'rgba(90,50,20,.75)'; c.lineWidth = 0.05;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-0.38, -0.24 + i * 0.16); c.lineTo(0.3 - (i % 2) * 0.14, -0.24 + i * 0.16); c.stroke(); }
  };
  S.lotus = (c, F, k) => {
    for (const i of [-2, 2, -1, 1, 0]) { c.save(); c.translate(0, 0.42); c.rotate(i * 0.42); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.3, -0.55, 0, -1.15 + Math.abs(i) * 0.12); c.quadraticCurveTo(-0.3, -0.55, 0, 0); F(i === 0 ? null : lin(c, [0, 0], [0, -1], [k[2], k[1], k[0]])); c.restore(); }
    c.beginPath(); c.ellipse(0, 0.5, 0.5, 0.13, 0, 0, TAU); F('#2a8a5a');
  };
  S.shard = (c, F, k) => {
    c.beginPath(); [[0, -0.9], [0.26, -0.32], [0.12, 0.06], [0.32, 0.78], [-0.04, 0.42], [-0.3, 0.84], [-0.2, 0.02], [-0.34, -0.36]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); F();
    c.beginPath(); c.moveTo(0, -0.8); c.lineTo(-0.06, 0.1); c.lineTo(0.12, 0.6); c.lineWidth = 0.04; c.strokeStyle = k[0]; c.stroke();
  };
  S.hourglass = (c, F) => {
    c.beginPath(); c.moveTo(-0.42, -0.64); c.lineTo(0.42, -0.64); c.lineTo(0.07, 0); c.lineTo(0.42, 0.64); c.lineTo(-0.42, 0.64); c.lineTo(-0.07, 0); c.closePath(); F('rgba(190,230,255,0.35)');
    c.beginPath(); c.moveTo(-0.3, 0.6); c.lineTo(0.3, 0.6); c.lineTo(0, 0.25); c.closePath(); c.moveTo(-0.16, -0.36); c.lineTo(0.16, -0.36); c.lineTo(0, -0.12); c.closePath(); F('#f2c25e');
    for (const x of [-0.5, 0.5]) { c.beginPath(); c.rect(x - 0.05, -0.68, 0.1, 1.36); F(); }
    for (const y of [-0.82, 0.68]) { c.beginPath(); c.rect(-0.62, y, 1.24, 0.15); F(); }
  };
  S.scarab = (c, F, k) => {
    c.strokeStyle = k[2]; c.lineWidth = 0.08; c.lineCap = 'round';
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 0.3, -0.18 + i * 0.26); c.lineTo(s * 0.68, -0.34 + i * 0.36); c.lineTo(s * 0.78, -0.18 + i * 0.4); c.stroke(); }
    c.beginPath(); c.ellipse(0, 0.14, 0.42, 0.56, 0, 0, TAU); F();
    c.beginPath(); c.ellipse(0, -0.52, 0.24, 0.17, 0, 0, TAU); F();
    c.beginPath(); c.moveTo(0, -0.38); c.lineTo(0, 0.68); c.moveTo(-0.38, -0.12); c.quadraticCurveTo(0, -0.24, 0.38, -0.12); c.lineWidth = 0.045; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();
    c.beginPath(); c.arc(0, -0.86, 0.14, 0, TAU); F('#ff6a3a');
  };
  S.wraps = (c, F, k) => {
    c.save(); c.rotate(-0.55);
    c.beginPath(); c.roundRect(-0.3, -0.85, 0.6, 1.6, 0.24); F(lin(c, [-0.3, 0], [0.3, 0], ['#d8c8a0', '#f6ecd0', '#b8a478']));
    c.save(); c.clip(); c.strokeStyle = 'rgba(110,80,40,.55)'; c.lineWidth = 0.05; for (let i = -6; i < 8; i++) { c.beginPath(); c.moveTo(-0.4, i * 0.22); c.lineTo(0.4, i * 0.22 - 0.24); c.stroke(); } c.restore();
    c.beginPath(); c.moveTo(0.28, 0.5); c.bezierCurveTo(0.7, 0.55, 0.45, 0.95, 0.85, 0.9); c.lineWidth = 0.14; c.strokeStyle = k[1]; c.stroke();
    c.restore();
  };
  S.pearl = (c, F, k) => {
    c.beginPath(); c.moveTo(0, 0.72); c.arc(0, 0.72, 1.05, -Math.PI * 0.86, -Math.PI * 0.14); c.closePath(); F(lin(c, [0, -0.4], [0, 0.7], ['#ffe6d6', '#e8a890', '#7a4a3a']));
    c.strokeStyle = 'rgba(90,40,30,.6)'; c.lineWidth = 0.04; for (let i = 1; i < 7; i++) { const a = -Math.PI * (0.86 - i * 0.103); c.beginPath(); c.moveTo(0, 0.72); c.lineTo(Math.cos(a) * 1.0, 0.72 + Math.sin(a) * 1.0); c.stroke(); }
    c.beginPath(); c.arc(0, 0.3, 0.3, 0, TAU); F(rad(c, -0.08, 0.26, 0.36, ['#ffffff', '#e6eef8', '#8a96b0']));
  };
  S.sandal = (c, F, k) => {
    c.save(); c.rotate(0.35);
    c.beginPath(); c.ellipse(0, 0.05, 0.34, 0.82, 0, 0, TAU); F(wood(c));
    c.strokeStyle = k[1]; c.lineWidth = 0.12; c.beginPath(); c.moveTo(-0.32, -0.15); c.quadraticCurveTo(0, -0.45, 0.32, -0.15); c.stroke(); c.beginPath(); c.moveTo(-0.33, 0.2); c.quadraticCurveTo(0, -0.05, 0.33, 0.2); c.stroke();
    c.beginPath(); c.moveTo(0, -0.7); c.lineTo(0, -0.32); c.lineWidth = 0.08; c.stroke();
    c.restore();
  };
  S.wingsandal = (c, F, k) => { S.sandal(c, F, k); c.save(); c.translate(0.45, 0.35); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.3, -0.2 - i * 0.18, 0.55, -0.32 - i * 0.2); c.quadraticCurveTo(0.25, -0.05 - i * 0.12, 0, 0.08); F(lin(c, [0, 0], [0.5, -0.5], ['#ffffff', k[1]])); } c.restore(); };
  S.eye = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.78, 0); c.quadraticCurveTo(0, -0.62, 0.78, 0); c.quadraticCurveTo(0, 0.5, -0.78, 0); c.closePath(); F('#f4f0e6');
    c.beginPath(); c.arc(0, -0.04, 0.24, 0, TAU); F(rad(c, 0, -0.04, 0.26, [k[0], k[1], k[2]]));
    c.beginPath(); c.arc(0, -0.04, 0.09, 0, TAU); c.fillStyle = '#05101e'; c.fill();
    c.lineCap = 'round'; c.strokeStyle = k[1]; c.lineWidth = 0.1;
    c.beginPath(); c.moveTo(-0.72, -0.42); c.quadraticCurveTo(0, -0.86, 0.8, -0.36); c.stroke();
    c.beginPath(); c.moveTo(-0.06, 0.28); c.lineTo(-0.16, 0.8); c.stroke();
    c.beginPath(); c.moveTo(0.2, 0.24); c.quadraticCurveTo(0.5, 0.82, 0.78, 0.5); c.quadraticCurveTo(0.86, 0.36, 0.7, 0.36); c.stroke();
  };
  S.khopesh = (c, F) => {
    c.save(); c.rotate(-0.25);
    c.beginPath(); c.moveTo(-0.12, 0.3); c.lineTo(-0.12, -0.12); c.quadraticCurveTo(-0.2, -0.82, 0.42, -0.8); c.quadraticCurveTo(0.82, -0.76, 0.76, -0.32); c.quadraticCurveTo(0.5, -0.58, 0.18, -0.48); c.quadraticCurveTo(0.08, -0.34, 0.1, 0.3); c.closePath(); F();
    c.beginPath(); c.rect(-0.16, 0.28, 0.3, 0.1); F('#f2c25e');
    c.beginPath(); c.rect(-0.11, 0.38, 0.2, 0.5); F(wood(c));
    c.beginPath(); c.arc(-0.01, 0.92, 0.1, 0, TAU); F('#f2c25e');
    c.restore();
  };
  S.claw = (c, F) => { for (const i of [-1, 0, 1]) { c.beginPath(); c.moveTo(-0.5 + i * 0.32, 0.75); c.quadraticCurveTo(-0.12 + i * 0.32, 0.05, 0.3 + i * 0.32, -0.8); c.quadraticCurveTo(0.08 + i * 0.32, 0.05, -0.3 + i * 0.32, 0.75); c.closePath(); F(); } };
  S.axe = (c, F) => {
    c.save(); c.rotate(-0.45);
    c.beginPath(); c.rect(-0.06, -0.82, 0.12, 1.7); F(wood(c));
    c.beginPath(); c.moveTo(0.06, -0.68); c.lineTo(0.34, -0.74); c.quadraticCurveTo(0.9, -0.36, 0.34, 0.02); c.lineTo(0.06, -0.06); c.closePath(); F();
    c.beginPath(); c.moveTo(-0.06, -0.58); c.lineTo(-0.42, -0.42); c.lineTo(-0.06, -0.26); c.closePath(); F();
    c.restore();
  };
  S.quill = (c, F, k) => {
    c.save(); c.rotate(0.55);
    c.beginPath(); c.moveTo(0, 0.5); c.quadraticCurveTo(0.46, -0.12, 0.05, -0.9); c.quadraticCurveTo(-0.38, -0.2, 0, 0.5); F(lin(c, [-0.3, 0], [0.4, -0.8], ['#ffffff', k[1], k[2]]));
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.03; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0.02, 0.3 - i * 0.18); c.lineTo(0.28 - i * 0.02, 0.12 - i * 0.2); c.stroke(); }
    c.beginPath(); c.moveTo(0.02, 0.85); c.lineTo(0.04, -0.8); c.lineWidth = 0.04; c.strokeStyle = '#3a2a10'; c.stroke();
    c.beginPath(); c.moveTo(-0.04, 0.55); c.lineTo(0.02, 0.98); c.lineTo(0.08, 0.55); c.closePath(); c.fillStyle = '#1a1208'; c.fill();
    c.restore();
  };
  S.plume = (c, F, k) => { S.quill(c, F, k); c.save(); c.rotate(0.55); c.strokeStyle = 'rgba(60,30,10,.7)'; c.lineWidth = 0.07; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.18, -0.05 - i * 0.24); c.lineTo(0.24, -0.15 - i * 0.24); c.stroke(); } c.restore(); };
  S.moon = (c, F, k) => {
    c.beginPath(); c.arc(0, -0.18, 0.44, 0, TAU); F(rad(c, 0, -0.18, 0.5, ['#ffffff', k[1], k[2]]));
    c.beginPath(); c.arc(0, -0.02, 0.74, Math.PI * 0.08, Math.PI * 0.92); c.arc(0, -0.24, 0.64, Math.PI * 0.86, Math.PI * 0.14, true); c.closePath(); F('#f2c25e');
  };
  S.mooncrown = (c, F, k) => { S.moon(c, F, k); c.beginPath(); c.rect(-0.5, 0.62, 1.0, 0.18); F('#f2c25e'); for (const x of [-0.3, 0, 0.3]) { c.beginPath(); c.arc(x, 0.71, 0.05, 0, TAU); c.fillStyle = '#3a7bff'; c.fill(); } };
  S.candle = (c, F, k) => {
    c.beginPath(); c.rect(-0.2, -0.22, 0.4, 0.86); F(lin(c, [-0.2, 0], [0.2, 0], ['#d8ccb0', '#fff6e0', '#b8a888']));
    c.beginPath(); c.ellipse(0, 0.68, 0.46, 0.14, 0, 0, TAU); F('#c98a4a');
    c.save(); c.shadowColor = k[1]; c.shadowBlur = 18;
    c.beginPath(); c.moveTo(0, -0.92); c.quadraticCurveTo(0.3, -0.48, 0, -0.26); c.quadraticCurveTo(-0.3, -0.48, 0, -0.92); c.fillStyle = rad(c, 0, -0.45, 0.4, ['#ffffff', k[1], k[2]]); c.fill(); c.restore();
  };
  S.staff = (c, F, k) => {
    c.save(); c.rotate(0.42);
    c.beginPath(); c.rect(-0.05, -0.45, 0.1, 1.42); F(wood(c));
    c.beginPath(); c.moveTo(-0.05, -0.45); c.quadraticCurveTo(-0.38, -0.62, -0.2, -0.9); c.moveTo(0.05, -0.45); c.quadraticCurveTo(0.38, -0.62, 0.2, -0.9); c.lineWidth = 0.08; c.strokeStyle = '#f2c25e'; c.stroke();
    c.save(); c.shadowColor = k[1]; c.shadowBlur = 20; c.beginPath(); c.arc(0, -0.72, 0.22, 0, TAU); c.fillStyle = rad(c, 0, -0.72, 0.26, ['#ffffff', k[1], k[2]]); c.fill(); c.restore();
    c.restore();
  };
  S.shield = (c, F, k) => {
    c.beginPath(); c.arc(0, 0, 0.8, 0, TAU); F(rad(c, -0.2, -0.2, 1.0, [k[0], k[1], k[2]]));
    c.beginPath(); c.arc(0, 0, 0.62, 0, TAU); c.lineWidth = 0.06; c.strokeStyle = k[2]; c.stroke();
    c.strokeStyle = 'rgba(60,30,10,.55)'; c.lineWidth = 0.05; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 0.26, Math.sin(a) * 0.26); c.lineTo(Math.cos(a) * 0.58, Math.sin(a) * 0.58); c.stroke(); }
    c.beginPath(); c.arc(0, 0, 0.2, 0, TAU); F('#f2c25e');
  };
  S.cloak = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.32, -0.62); c.lineTo(0.32, -0.62); c.quadraticCurveTo(0.55, 0.18, 0.72, 0.84); c.quadraticCurveTo(0, 0.66, -0.72, 0.84); c.quadraticCurveTo(-0.55, 0.18, -0.32, -0.62); c.closePath(); F();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.05; for (const x of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(x * 0.5, -0.5); c.quadraticCurveTo(x, 0.2, x * 1.6, 0.76); c.stroke(); }
    c.beginPath(); c.ellipse(0, -0.64, 0.5, 0.17, 0, 0, TAU); F('#f4f6ff');
  };
  const vial = (c, F, k, liquid) => {
    c.beginPath(); c.rect(-0.15, -0.6, 0.3, 0.42); c.moveTo(0.52, 0.24); c.arc(0, 0.24, 0.52, 0, TAU); F('rgba(220,240,255,0.25)');
    c.save(); c.beginPath(); c.arc(0, 0.24, 0.49, 0, TAU); c.clip(); c.fillStyle = rad(c, 0, 0.4, 0.6, liquid || [k[0], k[1], k[2]]); c.fillRect(-0.6, 0.06, 1.2, 0.8); c.restore();
    c.beginPath(); c.rect(-0.18, -0.78, 0.36, 0.2); F(wood(c));
    c.beginPath(); c.ellipse(-0.2, 0.08, 0.08, 0.16, 0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
  };
  S.vial = (c, F, k) => vial(c, F, k);
  S.flask = (c, F, k) => vial(c, F, k);
  S.eyeflask = (c, F, k) => { vial(c, F, k); c.save(); c.translate(0, 0.32); c.scale(0.32, 0.32); S.eye(c, F, ICON_INK.azure); c.restore(); };
  S.isisflask = (c, F, k) => { vial(c, F, k); c.save(); c.translate(0, 0.34); c.scale(0.4, 0.4); S.wings(c, F, ICON_INK.gold); c.restore(); };
  S.wings = (c, F, k, low = false) => {
    for (const s of [1, -1]) {
      c.beginPath(); c.moveTo(s * 0.1, low ? 0.05 : -0.1);
      c.quadraticCurveTo(s * 0.55, low ? -0.25 : -0.72, s * 0.98, low ? -0.05 : -0.5);
      for (let i = 0; i < 5; i++) { const x = s * (0.98 - i * 0.19), y = (low ? 0.1 : -0.3) + i * 0.1; c.quadraticCurveTo(x - s * 0.02, y + 0.26, x - s * 0.18, y + 0.1); }
      c.lineTo(s * 0.1, 0.2); c.closePath(); F(lin(c, [0, -0.5], [s * 0.9, 0.3], [k[0], k[1], k[2]]));
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.035; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(s * 0.2, 0.05); c.lineTo(s * (0.98 - i * 0.19), (low ? 0.15 : -0.25) + i * 0.1); c.stroke(); }
    }
    c.beginPath(); c.arc(0, low ? 0.2 : -0.05, 0.2, 0, TAU); F(rad(c, 0, 0, 0.25, ['#fff0b0', '#ff7a2a', '#8a1a00']));
  };
  S.isiswings = (c, F, k) => {
    S.wings(c, F, k, true);
    c.beginPath(); c.moveTo(-0.22, -0.88); c.lineTo(0.12, -0.88); c.lineTo(0.12, -0.7); c.lineTo(0.24, -0.7); c.lineTo(0.24, -0.4); c.lineTo(-0.22, -0.4); c.closePath(); F('#f2c25e');   // Isis' throne glyph
  };
  S.collar = (c, F) => {
    const inks = ['#f2c25e', '#2a6aff', '#e0502a', '#f2c25e'];
    for (let i = 0; i < 4; i++) { const r = 0.86 - i * 0.16; c.beginPath(); c.arc(0, -0.4, r, Math.PI * 0.1, Math.PI * 0.9); c.arc(0, -0.4, r - 0.15, Math.PI * 0.9, Math.PI * 0.1, true); c.closePath(); F(inks[i]); }
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.14 + i * 0.09); c.beginPath(); c.arc(Math.cos(a) * 0.92, -0.4 + Math.sin(a) * 0.92, 0.07, 0, TAU); F('#f2c25e'); }
  };
  S.coin = (c, F, k) => {
    c.beginPath(); c.arc(0, 0, 0.78, 0, TAU); F(rad(c, -0.2, -0.2, 0.95, [k[0], k[1], k[2]]));
    c.beginPath(); c.arc(0, 0, 0.62, 0, TAU); c.lineWidth = 0.05; c.strokeStyle = k[2]; c.stroke();
    c.strokeStyle = k[2]; c.lineWidth = 0.07;
    for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 0.04, -0.42); c.quadraticCurveTo(s * 0.32, -0.36, s * 0.3, -0.12); c.lineTo(s * 0.44, 0.0); c.lineTo(s * 0.3, 0.08); c.quadraticCurveTo(s * 0.3, 0.36, s * 0.04, 0.44); c.stroke(); }
  };
  S.hammer = (c, F, k) => {
    c.beginPath(); c.rect(-0.1, -0.2, 0.2, 0.9); F(wood(c));
    c.beginPath(); c.arc(0, 0.8, 0.12, 0, TAU); c.lineWidth = 0.06; c.strokeStyle = '#f2c25e'; c.stroke();
    c.beginPath(); c.moveTo(-0.66, -0.72); c.lineTo(0.66, -0.72); c.lineTo(0.72, -0.62); c.lineTo(0.72, -0.24); c.lineTo(0.66, -0.16); c.lineTo(-0.66, -0.16); c.lineTo(-0.72, -0.24); c.lineTo(-0.72, -0.62); c.closePath(); F();
    c.save(); c.shadowColor = '#7fd8ff'; c.shadowBlur = 14; c.beginPath(); c.moveTo(-0.1, -0.66); c.lineTo(0.08, -0.48); c.lineTo(-0.06, -0.42); c.lineTo(0.12, -0.22); c.lineWidth = 0.06; c.strokeStyle = '#dff6ff'; c.stroke(); c.restore();
  };
  S.warhammer = (c, F, k) => { S.hammer(c, F, k); c.beginPath(); c.moveTo(-0.12, -0.72); c.lineTo(0, -1.0); c.lineTo(0.12, -0.72); c.closePath(); F(); };
  S.spear = (c, F) => {
    c.save(); c.rotate(Math.PI / 4);
    c.beginPath(); c.rect(-0.045, -0.32, 0.09, 1.3); F(wood(c));
    c.beginPath(); c.moveTo(0, -1.0); c.quadraticCurveTo(0.24, -0.62, 0, -0.3); c.quadraticCurveTo(-0.24, -0.62, 0, -1.0); F();
    c.beginPath(); c.rect(-0.16, -0.34, 0.32, 0.08); F('#f2c25e');
    c.strokeStyle = '#7fd8ff'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0, -0.88); c.lineTo(0, -0.42); c.stroke();
    c.restore();
  };
  S.bow = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.22, -0.86); c.quadraticCurveTo(0.8, 0, -0.22, 0.86); c.quadraticCurveTo(0.56, 0, -0.22, -0.86); c.closePath(); F();
    c.beginPath(); c.moveTo(-0.22, -0.86); c.lineTo(-0.22, 0.86); c.lineWidth = 0.025; c.strokeStyle = '#f4f8ff'; c.stroke();
    c.beginPath(); c.moveTo(-0.6, 0); c.lineTo(0.62, 0); c.lineWidth = 0.05; c.strokeStyle = '#d8b080'; c.stroke();
    c.beginPath(); c.moveTo(0.82, 0); c.lineTo(0.58, -0.1); c.lineTo(0.58, 0.1); c.closePath(); F();
  };
  S.sun = (c, F, k) => {
    c.save(); for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(-0.1, -0.5); c.lineTo(0, -0.95); c.lineTo(0.1, -0.5); c.closePath(); F('#ffd25e'); } c.restore();
    c.beginPath(); c.arc(0, 0, 0.5, 0, TAU); F(rad(c, 0, 0, 0.55, ['#fff6c0', k[1], k[2]]));
    c.beginPath(); c.moveTo(-0.12, 0.42); c.quadraticCurveTo(-0.2, 0.1, 0, 0.0); c.quadraticCurveTo(0.2, 0.1, 0.12, 0.42); c.lineWidth = 0.06; c.strokeStyle = '#2a8a5a'; c.stroke();   // uraeus
  };
  S.book = (c, F, k) => {
    c.beginPath(); c.moveTo(0, -0.38); c.quadraticCurveTo(-0.46, -0.6, -0.9, -0.42); c.lineTo(-0.9, 0.6); c.quadraticCurveTo(-0.46, 0.44, 0, 0.66); c.quadraticCurveTo(0.46, 0.44, 0.9, 0.6); c.lineTo(0.9, -0.42); c.quadraticCurveTo(0.46, -0.6, 0, -0.38); F(k[2]);
    for (const s of [1, -1]) { c.beginPath(); c.moveTo(0, -0.42); c.quadraticCurveTo(s * 0.4, -0.58, s * 0.8, -0.44); c.lineTo(s * 0.8, 0.5); c.quadraticCurveTo(s * 0.4, 0.36, 0, 0.56); c.closePath(); F(lin(c, [0, 0], [s * 0.8, 0], ['#d8c8a0', '#fbf0d0'])); }
    c.strokeStyle = 'rgba(40,60,120,.7)'; c.lineWidth = 0.035; for (const s of [1, -1]) for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(s * 0.14, -0.22 + i * 0.18); c.lineTo(s * 0.66, -0.3 + i * 0.18); c.stroke(); }
    c.save(); c.shadowColor = k[1]; c.shadowBlur = 16; c.beginPath(); c.arc(0, -0.78, 0.12, 0, TAU); c.fillStyle = '#e8f6ff'; c.fill(); c.restore();
  };
  S.lantern = (c, F, k) => {
    c.beginPath(); c.arc(0, -0.8, 0.13, Math.PI, 0); c.lineWidth = 0.06; c.strokeStyle = '#c9d2e4'; c.stroke();
    c.beginPath(); c.moveTo(-0.34, -0.56); c.lineTo(0.34, -0.56); c.lineTo(0.2, -0.72); c.lineTo(-0.2, -0.72); c.closePath(); F('#4f5870');
    c.save(); c.shadowColor = k[1]; c.shadowBlur = 22; c.beginPath(); c.rect(-0.3, -0.56, 0.6, 0.96); c.fillStyle = rad(c, 0, -0.05, 0.6, ['#ffffff', k[1], k[2]]); c.fill(); c.restore();
    c.strokeStyle = '#2a3040'; c.lineWidth = 0.06; for (const x of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(x, -0.56); c.lineTo(x, 0.4); c.stroke(); }
    c.beginPath(); c.rect(-0.38, 0.4, 0.76, 0.14); F('#4f5870');
  };
  S.crown = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.24, 0.3); c.quadraticCurveTo(-0.32, -0.6, 0, -0.9); c.quadraticCurveTo(0.32, -0.6, 0.24, 0.3); c.closePath(); F('#f6f0e0');
    c.beginPath(); c.moveTo(-0.55, 0.6); c.lineTo(-0.55, -0.12); c.lineTo(-0.34, -0.12); c.lineTo(-0.34, 0.24); c.lineTo(0.36, 0.24); c.lineTo(0.36, -0.42); c.lineTo(0.55, -0.42); c.lineTo(0.55, 0.6); c.closePath(); F('#d0302a');
    c.beginPath(); c.rect(-0.6, 0.52, 1.2, 0.2); F();
    c.save(); c.shadowColor = '#ffb030'; c.shadowBlur = 16; c.beginPath(); c.arc(0, -0.2, 0.14, 0, TAU); c.fillStyle = '#ffd25e'; c.fill(); c.restore();
  };
  S.serpent = (c, F, k) => {
    c.lineCap = 'round'; c.beginPath(); c.moveTo(-0.6, 0.78); c.bezierCurveTo(0.7, 0.62, -0.7, 0.0, 0.25, -0.35);
    c.lineWidth = 0.3; c.strokeStyle = '#1a0a30'; c.stroke(); c.lineWidth = 0.22; c.strokeStyle = lin(c, [-0.6, 0.8], [0.3, -0.4], [k[2], k[1], k[0]]); c.stroke();
    c.beginPath(); c.ellipse(0.38, -0.5, 0.3, 0.2, -0.6, 0, TAU); F();
    c.beginPath(); c.arc(0.42, -0.58, 0.05, 0, TAU); c.fillStyle = '#ffe23a'; c.fill();
    c.beginPath(); c.moveTo(0.58, -0.38); c.lineTo(0.66, -0.2); c.lineTo(0.7, -0.4); c.fillStyle = '#fff'; c.fill();
  };
  S.brush = (c, F, k) => {
    c.beginPath(); c.rect(-0.045, -0.15, 0.09, 1.05); F(wood(c));
    c.save(); c.translate(0, -0.4); for (let i = 0; i < 7; i++) { c.rotate(TAU / 7); c.beginPath(); c.moveTo(-0.08, -0.08); c.lineTo(0, -0.38); c.lineTo(0.08, -0.08); c.closePath(); F(); } c.beginPath(); c.arc(0, 0, 0.1, 0, TAU); F('#ffffff'); c.restore();
    c.beginPath(); c.arc(0, -0.86, 0.26, Math.PI, 0); c.lineWidth = 0.08; c.strokeStyle = k[1]; c.stroke();   // Seshat's bow
  };
  S.pomegranate = (c, F, k) => {
    c.beginPath(); c.arc(0, 0.12, 0.62, 0, TAU); F(rad(c, -0.1, 0.0, 0.7, ['#ff9a8a', '#d02a3a', '#4a0610']));
    c.beginPath(); c.moveTo(-0.2, -0.46); c.lineTo(-0.24, -0.76); c.lineTo(-0.1, -0.58); c.lineTo(0, -0.82); c.lineTo(0.1, -0.58); c.lineTo(0.24, -0.76); c.lineTo(0.2, -0.46); c.closePath(); F('#a02030');
    for (const [x, y] of [[0.1, 0.2], [0.26, 0.04], [0.3, 0.3], [0.12, 0.42], [-0.08, 0.3]]) { c.beginPath(); c.ellipse(x, y, 0.06, 0.08, 0.4, 0, TAU); c.fillStyle = '#ffd0e0'; c.fill(); }
    c.beginPath(); c.ellipse(-0.25, -0.1, 0.1, 0.18, 0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
  };
  S.feather = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.04, 0.9); c.quadraticCurveTo(0.42, 0.1, 0.22, -0.72); c.quadraticCurveTo(0.12, -0.95, 0.36, -0.9); c.quadraticCurveTo(-0.38, -0.5, -0.14, 0.62); c.closePath(); F(lin(c, [-0.3, 0.8], [0.3, -0.8], ['#ffffff', k[0], k[1]]));
    c.beginPath(); c.moveTo(-0.04, 0.95); c.quadraticCurveTo(0.08, 0, 0.18, -0.74); c.lineWidth = 0.035; c.strokeStyle = k[2]; c.stroke();
    c.strokeStyle = 'rgba(80,60,20,.35)'; c.lineWidth = 0.025; for (let i = 0; i < 7; i++) { const y = 0.55 - i * 0.2; c.beginPath(); c.moveTo(0.06 + i * 0.016, y); c.lineTo(0.3 - i * 0.01, y - 0.16); c.moveTo(0.06 + i * 0.016, y); c.lineTo(-0.12 + i * 0.01, y - 0.12); c.stroke(); }
  };
  S.ankh = (c, F) => {
    c.beginPath(); c.ellipse(0, -0.44, 0.32, 0.42, 0, 0, TAU); c.moveTo(0.15, -0.44); c.ellipse(0, -0.44, 0.15, 0.25, 0, 0, TAU, true); F(null, 'evenodd');
    c.beginPath(); c.rect(-0.58, -0.08, 1.16, 0.18); F();
    c.beginPath(); c.moveTo(-0.1, 0.06); c.lineTo(0.1, 0.06); c.lineTo(0.17, 0.88); c.lineTo(-0.17, 0.88); c.closePath(); F();
  };
  S.scales = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.66, -0.72); c.lineTo(0.66, -0.72); c.lineTo(0.62, 0.1); c.quadraticCurveTo(0.4, 0.62, 0, 0.9); c.quadraticCurveTo(-0.4, 0.62, -0.62, 0.1); c.closePath(); F();
    c.save(); c.clip(); c.strokeStyle = 'rgba(0,30,25,.6)'; c.lineWidth = 0.045;
    for (let r = 0; r < 7; r++) for (let i = -4; i <= 4; i++) { const x = i * 0.26 + (r % 2) * 0.13, y = -0.7 + r * 0.24; c.beginPath(); c.arc(x, y, 0.14, 0, Math.PI); c.stroke(); }
    c.restore();
  };
  S.veil = (c, F, k) => {
    c.globalAlpha = 0.75; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.8, -0.7 + i * 0.14); c.bezierCurveTo(-0.2, -0.1 + i * 0.2, 0.2, -0.9 + i * 0.3, 0.82, 0.78 - i * 0.12); c.lineWidth = 0.12; c.strokeStyle = lin(c, [-0.8, 0], [0.8, 0], ['rgba(255,255,255,0)', k[1], k[0]]); c.stroke(); } c.globalAlpha = 1;
    c.beginPath(); c.rect(-0.4, 0.02, 0.8, 0.46); c.rect(-0.22, 0.14, 0.44, 0.22); F(null, 'evenodd');   // Nephthys' glyph: the house...
    c.beginPath(); c.arc(0, 0.02, 0.32, Math.PI, 0); c.closePath(); F();   // ...and the basket
  };
  S.snow = (c, F, k) => {
    c.lineCap = 'round';
    for (const [w, col] of [[0.2, k[2]], [0.12, k[0]]]) {
      c.lineWidth = w; c.strokeStyle = col;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, ca = Math.cos(a), sa = Math.sin(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(ca * 0.86, sa * 0.86);
        for (const t of [0.42, 0.66]) { const px = ca * t, py = sa * t, b = 0.2; c.moveTo(px, py); c.lineTo(px + Math.cos(a + 0.8) * b, py + Math.sin(a + 0.8) * b); c.moveTo(px, py); c.lineTo(px + Math.cos(a - 0.8) * b, py + Math.sin(a - 0.8) * b); }
        c.stroke(); }
    }
    c.beginPath(); c.arc(0, 0, 0.16, 0, TAU); F('#ffffff');
  };
  S.tree = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.14, 0.62); c.lineTo(-0.1, -0.1); c.lineTo(0.1, -0.1); c.lineTo(0.14, 0.62); c.closePath(); F(wood(c));
    c.strokeStyle = '#8a5a30'; c.lineWidth = 0.07; c.lineCap = 'round'; for (const s of [-1, -0.4, 0.4, 1]) { c.beginPath(); c.moveTo(0, 0.6); c.quadraticCurveTo(s * 0.4, 0.66, s * 0.8, 0.88); c.stroke(); }
    for (const [x, y, r] of [[-0.42, -0.28, 0.34], [0.42, -0.28, 0.34], [0, -0.55, 0.42], [0, -0.12, 0.3]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); F(rad(c, x, y, r, [k[0], k[1], k[2]])); }
  };
  S.thyrsus = (c, F, k) => {
    c.save(); c.rotate(0.35);
    c.beginPath(); c.rect(-0.05, -0.36, 0.1, 1.3); F(wood(c));
    c.beginPath(); c.ellipse(0, -0.62, 0.22, 0.34, 0, 0, TAU); F(lin(c, [0, -1], [0, -0.3], ['#e8c070', '#9a6a28', '#5a3a14']));
    c.save(); c.clip(); c.strokeStyle = 'rgba(40,20,0,.6)'; c.lineWidth = 0.04; for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(-0.3, -0.62 + i * 0.12 - 0.2); c.lineTo(0.3, -0.62 + i * 0.12 + 0.2); c.moveTo(0.3, -0.62 + i * 0.12 - 0.2); c.lineTo(-0.3, -0.62 + i * 0.12 + 0.2); c.stroke(); } c.restore();
    for (const [y, s] of [[-0.1, 1], [0.2, -1], [0.5, 1]]) { c.beginPath(); c.ellipse(s * 0.18, y, 0.16, 0.08, s * 0.6, 0, TAU); F(k[1]); }
    c.beginPath(); c.moveTo(-0.05, -0.3); c.bezierCurveTo(0.4, -0.2, -0.4, 0.2, 0.3, 0.4); c.lineWidth = 0.06; c.strokeStyle = '#d0367e'; c.stroke();
    c.restore();
  };
  S.helmet = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.6, 0.7); c.lineTo(-0.6, -0.05); c.quadraticCurveTo(-0.58, -0.58, 0, -0.6); c.quadraticCurveTo(0.58, -0.58, 0.6, -0.05); c.lineTo(0.6, 0.7); c.lineTo(0.24, 0.7); c.lineTo(0.2, 0.12); c.lineTo(-0.2, 0.12); c.lineTo(-0.24, 0.7); c.closePath(); F();
    c.beginPath(); c.rect(-0.42, -0.06, 0.84, 0.12); c.fillStyle = '#0a0a14'; c.fill();
    c.beginPath(); c.moveTo(-0.5, -0.5); c.quadraticCurveTo(0, -1.15, 0.62, -0.62); c.quadraticCurveTo(0.1, -0.78, -0.5, -0.5); F('#d0302a');
  };
  S.caduceus = (c, F, k) => {
    c.beginPath(); c.rect(-0.04, -0.62, 0.08, 1.5); F();
    c.beginPath(); c.arc(0, -0.72, 0.1, 0, TAU); F();
    for (const s of [1, -1]) { c.beginPath(); c.moveTo(s * 0.05, -0.6); c.quadraticCurveTo(s * 0.4, -0.95, s * 0.62, -0.78); c.quadraticCurveTo(s * 0.4, -0.66, s * 0.05, -0.52); F('#ffffff'); }
    c.lineCap = 'round';
    for (const s of [1, -1]) { c.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24, x = s * 0.24 * Math.sin(t * Math.PI * 3), y = 0.78 - t * 1.22; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.lineWidth = 0.12; c.strokeStyle = '#0e5a32'; c.stroke(); c.lineWidth = 0.07; c.strokeStyle = '#56d68e'; c.stroke(); }
  };
  S.twoblade = (c, F, k) => {
    c.save(); c.rotate(Math.PI / 4);
    c.beginPath(); c.moveTo(0, -0.14); c.lineTo(0.12, -0.24); c.lineTo(0, -0.98); c.lineTo(-0.12, -0.24); c.closePath(); F();
    c.beginPath(); c.moveTo(0, 0.14); c.lineTo(0.12, 0.24); c.lineTo(0, 0.98); c.lineTo(-0.12, 0.24); c.closePath(); F(lin(c, [0, 0], [0, 1], ['#ffffff', '#b07cff', '#3a1478']));
    c.beginPath(); c.rect(-0.26, -0.06, 0.52, 0.12); F('#f2c25e');
    c.restore();
  };
  S.hand = (c, F) => {
    c.beginPath(); c.roundRect(-0.38, -0.1, 0.72, 0.8, 0.16);
    for (let i = 0; i < 4; i++) c.roundRect(-0.38 + i * 0.185, -0.78 + Math.abs(i - 1.5) * 0.1, 0.16, 0.8, 0.08);
    c.roundRect(0.26, 0.0, 0.42, 0.16, 0.08); F();
    c.beginPath(); c.moveTo(-0.38, 0.62); c.lineTo(0.34, 0.62); c.lineWidth = 0.08; c.strokeStyle = '#f2c25e'; c.stroke();
  };
  S.harp = (c, F, k) => {
    c.beginPath(); c.rect(-0.56, -0.58, 0.14, 1.42); F(wood(c));
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.5, -0.56); c.quadraticCurveTo(0.05, -1.0, 0.56, -0.46); c.lineWidth = 0.14; c.strokeStyle = k[1]; c.stroke();
    c.beginPath(); c.moveTo(0.56, -0.46); c.lineTo(-0.42, 0.8); c.lineWidth = 0.16; c.stroke();
    c.strokeStyle = '#fff6d8'; c.lineWidth = 0.02; for (let i = 1; i < 7; i++) { const t = i / 7, x = -0.42 + t * 0.98; c.beginPath(); c.moveTo(-0.42 + t * 0.95, -0.6 - Math.sin(t * Math.PI) * 0.22); c.lineTo(x - 0.0, 0.8 - t * 1.26); c.stroke(); }
  };
  S.inkwell = (c, F, k) => {
    c.save(); c.translate(0.2, -0.1); c.scale(0.8, 0.8); S.quill(c, F, k); c.restore();
    c.beginPath(); c.moveTo(-0.5, 0.2); c.quadraticCurveTo(-0.62, 0.86, 0, 0.86); c.quadraticCurveTo(0.62, 0.86, 0.5, 0.2); c.closePath(); F(rad(c, -0.1, 0.4, 0.7, ['#6a8aff', '#1a2a8a', '#040a30']));
    c.beginPath(); c.ellipse(0, 0.2, 0.5, 0.12, 0, 0, TAU); F('#f2c25e');
  };
  S.dagger = (c, F) => {
    c.save(); c.rotate(-Math.PI / 4);
    c.beginPath(); c.moveTo(0, -0.95); c.lineTo(0.14, -0.2); c.lineTo(-0.14, -0.2); c.closePath(); F();
    c.beginPath(); c.rect(-0.3, -0.22, 0.6, 0.1); F('#f2c25e');
    c.beginPath(); c.rect(-0.07, -0.12, 0.14, 0.62); F(wood(c));
    c.beginPath(); c.arc(0, 0.56, 0.1, 0, TAU); F('#c8382a');
    c.restore();
  };
  S.sphinx = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.3, -0.72); c.lineTo(0.3, -0.72); c.lineTo(0.74, 0.6); c.lineTo(-0.74, 0.6); c.closePath(); F();
    c.save(); c.clip(); c.strokeStyle = '#1a3a9a'; c.lineWidth = 0.08; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-0.9 + i * 0.22, 0.7); c.lineTo(-0.45 + i * 0.11, -0.8); c.stroke(); } c.restore();
    c.beginPath(); c.ellipse(0, -0.02, 0.26, 0.38, 0, 0, TAU); F('#c98a4a');
    c.beginPath(); c.moveTo(-0.1, -0.08); c.lineTo(-0.04, -0.08); c.moveTo(0.04, -0.08); c.lineTo(0.1, -0.08); c.lineWidth = 0.04; c.strokeStyle = '#1a1208'; c.stroke();
    c.beginPath(); c.moveTo(0, -0.6); c.quadraticCurveTo(0.08, -0.75, 0, -0.86); c.lineWidth = 0.07; c.strokeStyle = '#f2c25e'; c.stroke();
  };
  S.armlet = (c, F, k) => {
    c.beginPath(); c.ellipse(0, 0, 0.78, 0.5, 0, 0, TAU); c.moveTo(0.56, 0); c.ellipse(0, 0, 0.56, 0.3, 0, 0, TAU, true); F(null, 'evenodd');
    c.strokeStyle = 'rgba(60,30,10,.6)'; c.lineWidth = 0.04; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 0.58, Math.sin(a) * 0.32); c.lineTo(Math.cos(a) * 0.76, Math.sin(a) * 0.48); c.stroke(); }
    c.beginPath(); c.arc(0, -0.45, 0.16, 0, TAU); F(rad(c, 0, -0.45, 0.2, ['#ffd0c8', '#ff3a2a', '#5a0a06']));
  };
  S.bead = (c, F, k) => {
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.beginPath(); c.arc(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.1, 0, TAU); F('#f2c25e'); }
    c.save(); c.shadowColor = k[1]; c.shadowBlur = 24; c.beginPath(); c.arc(0, 0, 0.46, 0, TAU); c.fillStyle = rad(c, -0.1, -0.1, 0.55, ['#ffffff', k[1], k[2]]); c.fill(); c.restore();
    c.beginPath(); c.arc(-0.14, -0.16, 0.1, 0, TAU); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
  };
  S.paw = (c, F, k) => {
    c.strokeStyle = k[0]; c.lineWidth = 0.06; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.95, -0.2 + i * 0.28); c.lineTo(-0.55, -0.2 + i * 0.28); c.stroke(); }
    c.beginPath(); c.ellipse(0.12, 0.3, 0.36, 0.3, 0, 0, TAU); F();
    for (const [x, y] of [[-0.3, -0.18], [-0.02, -0.4], [0.3, -0.4], [0.56, -0.16]]) { c.beginPath(); c.ellipse(x, y, 0.13, 0.17, 0, 0, TAU); F(); }
  };
  S.blink = (c, F, k) => {
    c.save(); c.shadowColor = k[1]; c.shadowBlur = 20; c.beginPath(); c.ellipse(0.25, 0, 0.36, 0.72, 0, 0, TAU); c.moveTo(0.47, 0); c.ellipse(0.25, 0, 0.22, 0.54, 0, 0, TAU, true); c.fillStyle = lin(c, [0, -0.7], [0, 0.7], [k[0], k[1], k[2]]); c.fill('evenodd'); c.restore();
    c.beginPath(); c.moveTo(-0.9, -0.08); c.lineTo(0.05, -0.08); c.lineTo(0.05, -0.28); c.lineTo(0.45, 0); c.lineTo(0.05, 0.28); c.lineTo(0.05, 0.08); c.lineTo(-0.9, 0.08); c.closePath(); F('#f0dcff');
  };
  S.frost = (c, F, k) => {
    c.lineCap = 'round'; c.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 3.2, r = 0.08 + t * 0.72; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.lineWidth = 0.14; c.strokeStyle = k[2]; c.stroke(); c.lineWidth = 0.07; c.strokeStyle = k[0]; c.stroke();
    for (const [x, y] of [[0.6, -0.6], [-0.7, 0.5], [0.72, 0.42], [-0.4, -0.75]]) { c.beginPath(); c.arc(x, y, 0.07, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
  };
  S.aegis = (c, F, k) => {
    c.beginPath(); c.moveTo(-0.7, -0.74); c.lineTo(0.7, -0.74); c.lineTo(0.66, 0.08); c.quadraticCurveTo(0.42, 0.62, 0, 0.9); c.quadraticCurveTo(-0.42, 0.62, -0.66, 0.08); c.closePath(); F();
    c.lineCap = 'round'; c.strokeStyle = '#2a8a5a'; c.lineWidth = 0.06; for (let i = 0; i < 8; i++) { const a = -Math.PI * (0.1 + i * 0.115); c.beginPath(); c.moveTo(Math.cos(a) * 0.26, -0.1 + Math.sin(a) * 0.26); c.quadraticCurveTo(Math.cos(a + 0.3) * 0.44, -0.1 + Math.sin(a + 0.3) * 0.44, Math.cos(a) * 0.54, -0.1 + Math.sin(a) * 0.54); c.stroke(); }
    c.beginPath(); c.arc(0, -0.1, 0.24, 0, TAU); F('#e8dcc0');
    c.beginPath(); c.arc(-0.08, -0.14, 0.035, 0, TAU); c.arc(0.08, -0.14, 0.035, 0, TAU); c.fillStyle = '#c8382a'; c.fill();
  };
  return S;
})();

const ItemIcons = {
  cache: {},
  get(id) {
    if (this.cache[id]) return this.cache[id];
    const it = ITEM[id], S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    try { this.paint(c, S, it); } catch (e) { console.warn('[items] icon', id, e); }
    return (this.cache[id] = cv);
  },
  paint(c, S, it) {
    const [b1, b2] = it.bg || ICON_BG[it.cat];
    const g = c.createRadialGradient(S * 0.5, S * 0.36, S * 0.04, S * 0.5, S * 0.5, S * 0.8); g.addColorStop(0, b1); g.addColorStop(1, b2);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    // a sun-ray engraving and a lapis-blue inner ring
    c.save(); c.globalAlpha = 0.1; c.strokeStyle = '#fff3d0'; c.lineWidth = 1.5;
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; c.beginPath(); c.moveTo(S / 2 + Math.cos(a) * S * 0.12, S / 2 + Math.sin(a) * S * 0.12); c.lineTo(S / 2 + Math.cos(a) * S * 0.75, S / 2 + Math.sin(a) * S * 0.75); c.stroke(); }
    c.restore();
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.43, 0, TAU); c.strokeStyle = 'rgba(255,230,170,0.18)'; c.lineWidth = 2; c.stroke();
    // the symbol
    const ink = ICON_INK[it.ink] || ICON_INK.gold;
    c.save(); c.translate(S / 2, S / 2); c.scale(S * 0.36, S * 0.36);
    c.shadowColor = ink[1]; c.shadowBlur = S * 0.08; c.lineJoin = 'round';
    const metal = c.createLinearGradient(-1, -1, 1, 1); metal.addColorStop(0, ink[0]); metal.addColorStop(0.45, ink[1]); metal.addColorStop(1, ink[2]);
    const F = (style, rule) => {
      c.fillStyle = style || metal; if (rule) c.fill(rule); else c.fill();
      const sb = c.shadowBlur; c.shadowBlur = 0; c.lineWidth = 0.055; c.strokeStyle = 'rgba(12,6,2,0.85)'; c.stroke(); c.shadowBlur = sb;
    };
    (SYM[it.sym] || SYM.gem)(c, F, ink);
    c.restore();
    // vignette, rim in the tier's colour, corner studs and tier pips
    const v = c.createRadialGradient(S / 2, S / 2, S * 0.4, S / 2, S / 2, S * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = v; c.fillRect(0, 0, S, S);
    const rim = rimOf(it);
    c.strokeStyle = '#05070d'; c.lineWidth = S * 0.07; c.strokeRect(0, 0, S, S);
    c.strokeStyle = rim; c.lineWidth = S * 0.035; c.strokeRect(S * 0.03, S * 0.03, S * 0.94, S * 0.94);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1; c.strokeRect(S * 0.075, S * 0.075, S * 0.85, S * 0.85);
    c.fillStyle = rim; for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) { c.save(); c.translate(S * x, S * y); c.rotate(Math.PI / 4); c.fillRect(-S * 0.03, -S * 0.03, S * 0.06, S * 0.06); c.restore(); }
    if (it.tier > 0) { for (let i = 0; i < it.tier; i++) { c.save(); c.translate(S * (0.5 + (i - (it.tier - 1) / 2) * 0.09), S * 0.9); c.rotate(Math.PI / 4); c.fillRect(-S * 0.025, -S * 0.025, S * 0.05, S * 0.05); c.restore(); } }
  },
  canvas(id, px = 64) { const cv = document.createElement('canvas'); cv.width = cv.height = px; cv.getContext('2d').drawImage(this.get(id), 0, 0, px, px); return cv; },
  // a small picture for an <img> (online: the scoreboard's items)
  url(id) { const u = this.urls || (this.urls = {}); return u[id] || (u[id] = this.canvas(id, 40).toDataURL()); },
  draw(cv, id) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); if (id) c.drawImage(this.get(id), 0, 0, cv.width, cv.height); },
};

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------
const STORE_CSS = `
#store { position: absolute; inset: 0; z-index: 28; display: grid; place-items: center; padding: 12px; background: radial-gradient(ellipse at center, rgba(8,14,36,.72), rgba(2,3,10,.9)); pointer-events: auto; }
#store .sp { --lapis: #0c1a4a; position: relative; width: min(1220px, 100%); height: min(800px, 100%); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background:
  repeating-linear-gradient(90deg, rgba(230,184,90,.025) 0 1px, transparent 1px 64px), linear-gradient(180deg, #0f1b46 0%, #08102a 40%, #060a1c 100%);
  border: 1px solid var(--edge); box-shadow: 0 0 0 1px #000, 0 0 0 5px rgba(8,13,30,.95), 0 0 0 6px var(--edge-soft), 0 30px 90px rgba(0,0,0,.75), inset 0 0 120px rgba(230,184,90,.07); color: var(--parchment); font-family: var(--font-ui); }
#store .sh { display: flex; align-items: center; gap: 16px; padding: 10px 16px 8px; border-bottom: 1px solid var(--edge-soft); background: linear-gradient(180deg, rgba(230,184,90,.12), rgba(230,184,90,0)); }
#store .sh .tt { min-width: 0; flex: 1 1 auto; }
#store .sh .gl { font: 15px var(--font-glyph); color: var(--gold); letter-spacing: .35em; opacity: .85; white-space: nowrap; overflow: hidden; }
#store .sh h2 { margin: 0; font: 900 clamp(20px, 2.4vw, 30px)/1.05 var(--font-display); letter-spacing: .12em; background: linear-gradient(180deg, #fff1c8, var(--gold) 55%, #8a5f1c); -webkit-background-clip: text; background-clip: text; color: transparent; }
#store .sh small { color: var(--muted); font-size: 12px; letter-spacing: .06em; }
#store kbd { font: 700 11px var(--font-ui); color: var(--parchment); background: rgba(130,217,255,.1); border: 1px solid rgba(130,217,255,.35); padding: 0 4px; }
#store .warnb { flex: 0 1 auto; padding: 6px 12px; border: 1px solid #8a2a24; background: rgba(120,20,14,.45); color: #ffc2b8; font: 700 14px var(--font-ui); letter-spacing: .06em; animation: stpulse 1.6s ease-in-out infinite; white-space: nowrap; }
@keyframes stpulse { 50% { box-shadow: 0 0 18px rgba(255,90,70,.45); } }
#store .gold { display: flex; align-items: baseline; gap: 6px; padding: 4px 14px; border: 1px solid var(--edge); background: rgba(6,9,20,.8); }
#store .gold b { font: 800 26px var(--font-display); color: #ffd25e; text-shadow: 0 0 14px rgba(255,190,60,.5); font-variant-numeric: tabular-nums; }
#store .gold small { color: var(--muted); }
.coin { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff4c0, #f2c25e 45%, #8a5a14); box-shadow: 0 0 0 1px #3a2408, 0 0 8px rgba(255,200,80,.5); vertical-align: -1px; }
#store .x { pointer-events: auto; cursor: pointer; width: 36px; height: 36px; border: 1px solid var(--edge); background: var(--panel-solid); color: var(--parchment); font: 700 18px var(--font-ui); }
#store .x:hover { border-color: var(--gold); color: #fff; }
#store .sb { display: grid; grid-template-columns: 178px minmax(0, 1fr) 330px; min-height: 0; }
#store nav { display: grid; align-content: start; gap: 4px; padding: 10px 8px; border-right: 1px solid var(--edge-soft); overflow: auto; background: rgba(4,7,18,.35); }
#store nav button { pointer-events: auto; cursor: pointer; display: flex; align-items: center; gap: 8px; text-align: left; padding: 8px 10px; border: 1px solid transparent; border-left: 3px solid transparent; background: transparent; color: var(--muted); font: 700 14px var(--font-ui); letter-spacing: .06em; text-transform: uppercase; }
#store nav button i { font: normal 17px var(--font-glyph); color: var(--gold-dim); font-style: normal; width: 20px; text-align: center; }
#store nav button:hover { color: var(--parchment); background: rgba(230,184,90,.06); }
#store nav button.on { color: #fff; border-left-color: var(--gold); background: linear-gradient(90deg, rgba(230,184,90,.18), rgba(230,184,90,0)); }
#store nav button.on i { color: var(--gold); }
#store nav .n { margin-left: auto; font-size: 11px; color: var(--muted); }
#store .lst { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; }
#store .srch { padding: 8px 12px; border-bottom: 1px solid var(--edge-soft); }
#store .srch input { width: 100%; box-sizing: border-box; background: rgba(4,7,18,.8); color: var(--parchment); border: 1px solid var(--edge-soft); padding: 7px 10px; font: 600 14px var(--font-ui); }
#store .grid { overflow: auto; padding: 8px 12px 14px; }
#store .tierh { display: flex; align-items: center; gap: 10px; margin: 10px 0 6px; font: 800 12px var(--font-display); letter-spacing: .2em; color: var(--gold); text-transform: uppercase; }
#store .tierh::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--edge), transparent); }
#store .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
#store .card { pointer-events: auto; cursor: pointer; position: relative; display: grid; justify-items: center; gap: 3px; padding: 7px 5px 6px; border: 1px solid rgba(255,255,255,.08); background: linear-gradient(180deg, rgba(16,24,54,.92), rgba(6,9,22,.95)); color: var(--parchment); font: 600 12px/1.15 var(--font-ui); text-align: center; transition: transform .12s, border-color .12s, box-shadow .12s; }
#store .card canvas { width: 58px; height: 58px; display: block; }
#store .card .nm { min-height: 2.3em; display: grid; place-items: center; overflow-wrap: anywhere; }
#store .card .cs { font: 700 13px var(--font-ui); color: #ffd25e; font-variant-numeric: tabular-nums; }
#store .card.poor .cs { color: #ff7a6a; }
#store .card:hover { transform: translateY(-2px); border-color: var(--edge); }
#store .card.sel { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold), 0 0 20px rgba(230,184,90,.35); }
#store .card.own::after { content: '✓'; position: absolute; right: 4px; top: 3px; font: 800 13px var(--font-ui); color: #6fe0a0; text-shadow: 0 0 6px #000; }
#store .card.ullr .nm::after { content: ' · 0'; color: #9fffc8; }
#store .det { border-left: 1px solid var(--edge-soft); padding: 12px 14px; overflow: auto; background: rgba(4,7,18,.4); display: grid; align-content: start; gap: 10px; }
#store .det .hd { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 12px; align-items: center; }
#store .det .hd canvas { width: 84px; height: 84px; box-shadow: 0 6px 20px rgba(0,0,0,.6); }
#store .det h3 { margin: 0; font: 800 18px/1.15 var(--font-display); letter-spacing: .05em; color: #fff1c8; }
#store .det .en { font-size: 12px; color: var(--muted); font-style: italic; }
#store .det .tr { font: 700 11px var(--font-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--glyph); margin-top: 2px; }
#store .det .pr { margin-top: 4px; font: 800 18px var(--font-ui); color: #ffd25e; font-variant-numeric: tabular-nums; }
#store .det .pr small { font: 600 12px var(--font-ui); color: var(--muted); }
#store .det ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
#store .det li { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,.06); }
#store .det li b { color: #fff; font-variant-numeric: tabular-nums; }
#store .det li.z b { color: #9fffc8; text-decoration: line-through; }
#store .det .ul { font: 700 13px var(--font-ui); color: #9fffc8; }
#store .det .pas { padding: 8px 10px; border: 1px solid var(--edge-soft); background: rgba(230,184,90,.06); font-size: 13.5px; line-height: 1.4; }
#store .det .pas b { display: block; font: 800 12px var(--font-display); letter-spacing: .1em; color: var(--gold); margin-bottom: 2px; text-transform: uppercase; }
#store .det .sub { font: 800 11px var(--font-display); letter-spacing: .2em; color: var(--gold); text-transform: uppercase; }
#store .act { display: grid; gap: 6px; }
#store .act button { pointer-events: auto; cursor: pointer; padding: 10px 14px; font: 800 15px var(--font-display); letter-spacing: .14em; text-transform: uppercase; border: 1px solid #000; }
#store .act .buy { background: linear-gradient(180deg, #ffe7a6, var(--gold) 55%, #b88a35); color: #05101e; box-shadow: 0 0 22px rgba(230,184,90,.3); }
#store .act .buy[disabled] { filter: grayscale(.8) brightness(.6); cursor: not-allowed; box-shadow: none; }
#store .act .sell { background: var(--panel-solid); color: #ffb3a6; border-color: #8a2a24; }
#store .act .why { margin: 0; font-size: 13px; color: #ff9a8a; min-height: 1em; }
#store .into { display: flex; flex-wrap: wrap; gap: 6px; }
#store .into canvas, #store .tree canvas { width: 34px; height: 34px; display: block; cursor: pointer; }
#store .tree { overflow-x: auto; padding-bottom: 4px; }
#store .tree ul { position: relative; display: flex; justify-content: center; margin: 0; padding: 14px 0 0; }
#store .tree > ul { padding-top: 0; }
#store .tree li { list-style: none; position: relative; padding: 14px 3px 0; text-align: center; border: 0; display: block; }
#store .tree li::before, #store .tree li::after { content: ''; position: absolute; top: 0; right: 50%; width: 50%; height: 14px; border-top: 1px solid var(--edge); }
#store .tree li::after { right: auto; left: 50%; border-left: 1px solid var(--edge); }
#store .tree li:only-child::before, #store .tree li:only-child::after { display: none; }
#store .tree li:only-child { padding-top: 0; }
#store .tree li:first-child::before, #store .tree li:last-child::after { border: 0 none; }
#store .tree li:last-child::before { border-right: 1px solid var(--edge); }
#store .tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; height: 14px; border-left: 1px solid var(--edge); }
#store .tn { display: inline-grid; justify-items: center; gap: 1px; padding: 3px; border: 1px solid transparent; font: 700 11px var(--font-ui); color: #ffd25e; font-variant-numeric: tabular-nums; }
#store .tn.own { border-color: #6fe0a0; box-shadow: 0 0 10px rgba(111,224,160,.4); color: #6fe0a0; }
#store .sf { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 16px; border-top: 1px solid var(--edge-soft); background: linear-gradient(0deg, rgba(230,184,90,.08), rgba(230,184,90,0)); }
#store .inv { display: flex; gap: 6px; align-items: center; }
#store .inv .grp { display: flex; gap: 5px; padding: 4px; border: 1px solid var(--edge-soft); background: rgba(4,7,18,.6); }
#store .slot { pointer-events: auto; cursor: pointer; position: relative; width: 48px; height: 48px; border: 1px solid rgba(255,255,255,.1); background: rgba(10,14,30,.9) center/60% no-repeat; padding: 0; }
#store .slot canvas { width: 100%; height: 100%; display: block; }
#store .slot.sel { outline: 2px solid var(--gold); }
#store .slot.new { animation: stnew .7s ease-out; }
@keyframes stnew { from { box-shadow: 0 0 0 4px #ffd25e, 0 0 30px #ffd25e; } to { box-shadow: 0 0 0 0 transparent; } }
#store .slot b { position: absolute; right: 2px; bottom: 0; font: 800 12px var(--font-ui); color: #fff; text-shadow: 0 1px 2px #000; }
#store .slot kbd { position: absolute; left: -1px; top: -1px; font-size: 10px; padding: 0 3px; }
#store .slot.empty::before { content: '𓋹'; position: absolute; inset: 0; display: grid; place-items: center; font: 18px var(--font-glyph); color: rgba(230,184,90,.18); }
#store .stats { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--muted); min-width: 0; }
#store .stats span b { color: var(--parchment); font-variant-numeric: tabular-nums; }
#store .train { display: grid; gap: 5px; justify-items: end; }
#store .train label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--parchment); cursor: pointer; pointer-events: auto; }
#store .train input { accent-color: var(--gold); width: 15px; height: 15px; }
#store .train .row { display: flex; gap: 6px; }
#store .train button { pointer-events: auto; cursor: pointer; padding: 6px 10px; font: 700 12px var(--font-ui); letter-spacing: .08em; text-transform: uppercase; border: 1px solid var(--edge); background: var(--panel-solid); color: var(--parchment); }
#store .train button.danger { border-color: #8a2a24; color: #ffb3a6; }
#store .hint { grid-column: 1 / -1; font-size: 12px; color: var(--muted); }
@media (max-width: 1000px) { #store .sb { grid-template-columns: 150px minmax(0, 1fr) 270px; } }
@media (max-width: 820px) {
  #store .sb { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; overflow: auto; }
  #store nav { display: flex; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--edge-soft); }
  #store .det { border-left: 0; border-top: 1px solid var(--edge-soft); max-height: 40vh; }
  #store .sf { grid-template-columns: 1fr; }
  #store .train { justify-items: start; }
  #store .sh .gl { display: none; }
}
/* the HUD inventory, next to the ability bar */
#invHud { position: relative; display: grid; grid-template-columns: auto auto; gap: 4px 6px; align-self: flex-end; pointer-events: none; }
#invHud .ig { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; padding: 2px 8px; background: var(--panel); border: 1px solid var(--edge-soft); font: 800 15px var(--font-ui); color: #ffd25e; font-variant-numeric: tabular-nums; pointer-events: auto; cursor: pointer; }
#invHud .ig kbd { margin-left: auto; font: 700 11px var(--font-ui); color: var(--parchment); background: rgba(130,217,255,.1); border: 1px solid rgba(130,217,255,.35); padding: 0 4px; }
#invHud .ii, #invHud .is { display: grid; grid-template-columns: repeat(3, 34px); gap: 3px; }
#invHud .is { grid-template-columns: repeat(2, 34px); }
#invHud .s { position: relative; width: 34px; height: 34px; border: 1px solid var(--edge-soft); background: rgba(8,12,28,.85); pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
#invHud .s canvas { width: 100%; height: 100%; display: block; }
#invHud .s.empty canvas { visibility: hidden; }
#invHud .s.new { animation: stnew .7s ease-out; }
#invHud .s kbd { position: absolute; left: -2px; top: -2px; font: 700 10px/12px var(--font-ui); padding: 0 2px; background: var(--panel-solid); color: var(--gold); border: 1px solid var(--edge); }
#invHud .s b { position: absolute; right: 1px; bottom: -1px; font: 800 11px var(--font-ui); color: #fff; text-shadow: 0 1px 2px #000; }
#invHud .s .cd { position: absolute; inset: 0; background: conic-gradient(rgba(4,7,18,.8) var(--p, 0%), transparent 0); display: grid; place-items: center; font: 700 12px var(--font-ui); color: #fff; text-shadow: 0 1px 2px #000; }
#invHud .bf { position: absolute; left: 0; right: 0; bottom: calc(100% + 4px); display: flex; flex-wrap: wrap; gap: 3px; justify-content: flex-end; }
#invHud .bf span { padding: 1px 6px; background: var(--panel); border: 1px solid var(--edge-soft); font: 700 11px var(--font-ui); color: var(--parchment); white-space: nowrap; }
#invHud .bf span.sh { border-color: #ffd25e; color: #ffd25e; }
@media (max-width: 900px) { #invHud .ii { grid-template-columns: repeat(3, 26px); } #invHud .is { grid-template-columns: repeat(2, 26px); } #invHud .s { width: 26px; height: 26px; } }
`;
const CAT_GLYPH = { rec: '𓂀', start: '𓋹', phys: '𓌂', mag: '𓁟', def: '𓆣', sup: '𓅃', cons: '𓏊', relic: '𓇳' };

const Store = {
  open: false, el: null, cat: 'phys', sel: null, invSel: null, q: '', hud: null, hudT: 0, dynT: 0, lastGold: null,
  init() {
    if (this.el) return;
    const css = document.createElement('style'); css.textContent = STORE_CSS; document.head.appendChild(css);
    const el = this.el = document.createElement('div'); el.id = 'store'; el.hidden = true;
    el.innerHTML = `<div class="sp" role="dialog" aria-modal="true" aria-labelledby="stTitle">
      <header class="sh"><div class="tt"><div class="gl">𓋹 𓂀 𓆣 𓇳 𓁟 𓅃 𓃭 𓊽 𓋹 𓂀 𓆣 𓇳</div><h2 id="stTitle">Ma’at’s Treasury</h2><small>Store · <kbd>P</kbd> or <kbd>Esc</kbd> closes · double-click to buy · right-click in inventory to sell</small></div>
        <div class="warnb" hidden>Go to the fountain to shop</div>
        <div class="gold"><i class="coin"></i><b>0</b><small>gold</small></div>
        <button class="x" type="button" aria-label="Close store">✕</button></header>
      <div class="sb"><nav aria-label="Categories"></nav>
        <section class="lst"><div class="srch"><input type="search" placeholder="Search names, stats and passives …" aria-label="Search items"></div><div class="grid"></div></section>
        <aside class="det" aria-live="polite"></aside></div>
      <footer class="sf"><div class="inv"></div><div class="stats"></div><div class="train"></div></footer>
    </div>`;
    document.getElementById('app').appendChild(el);
    const $ = (s) => el.querySelector(s);
    this.u = { nav: $('nav'), grid: $('.grid'), det: $('.det'), inv: $('.inv'), stats: $('.stats'), train: $('.train'), gold: $('.gold b'), warn: $('.warnb'), search: $('.srch input') };
    $('.x').addEventListener('click', () => this.close());
    el.addEventListener('mousedown', (e) => { if (e.target === el) this.close(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.u.search.addEventListener('input', () => { this.q = this.u.search.value.trim().toLowerCase(); this.renderGrid(); });
    this.buildHud();
    // the pointer is released while the store is open: that must not open the Esc menu
    const plc0 = onPointerLockChange;
    onPointerLockChange = (locked) => { if (Store.open && !locked) return; if (plc0) plc0(locked); };
    // help lines (HUD + start screen)
    const keys = document.getElementById('keys'); if (keys) keys.insertAdjacentHTML('beforeend', '<div><kbd>P</kbd>store · <kbd>6</kbd><kbd>7</kbd>potions · <kbd>Z</kbd>relic</div>');
    const ctl = document.getElementById('controls'); if (ctl) ctl.insertAdjacentHTML('beforeend', '<div><kbd>P</kbd>Store (items)</div><div><kbd>6</kbd><kbd>7</kbd> Potions · <kbd>Z</kbd> Relic</div>');
    Items.load(); Items.recalc();
  },
  // ---------------------------------------------------------------- open / close
  openStore(force = false) {
    if (this.open) return;
    if (!force && (Game.mode !== 'play' || (UI.hud && UI.hud.hidden))) return;
    this.open = true; this.el.hidden = false;
    input.down.clear(); input.lmb = input.rmb = false; P.targeting = null;
    if (document.pointerLockElement) document.exitPointerLock();
    if (!this.sel) this.cat = Stats.ullr() ? 'sup' : Stats.physical() ? 'phys' : 'mag';
    this.render();
    Sound.tone(660, 990, 0.12, 0.03, 'triangle');
  },
  close(relock = true) {
    if (!this.open) return;
    this.open = false; this.el.hidden = true; HUD.hideTip && HUD.hideTip();
    if (document.activeElement && this.el.contains(document.activeElement)) document.activeElement.blur();
    if (relock && Game.mode === 'play' && !fallbackLook) {
      requestLock();
      setTimeout(() => { if (!input.locked && !this.open && Game.mode === 'play') { const h = document.getElementById('lockhint'); if (h) h.hidden = false; } }, 450);
    }
  },
  onChange(id) {
    this.hudDirty = true;
    if (id) this.flashId = id;
    if (this.open) this.render();
  },
  // ---------------------------------------------------------------- rendering
  render() {
    if (!this.el) return;
    this.renderNav(); this.renderGrid(); this.renderDetail(); this.renderFoot(); this.renderDynamic();
  },
  catItems(cat) {
    if (cat === 'rec') { const b = BOT_BUILDS[Kit ? Kit.id : 'thoth'] || BOT_BUILDS.Mage; return b.map((id) => ITEM[id]); }
    return ITEMS.filter((it) => it.cat === cat);
  },
  renderNav() {
    const cats = ['rec', ...CAT_ORDER];
    this.u.nav.innerHTML = cats.map((c) => `<button type="button" data-c="${c}" class="${this.cat === c && !this.q ? 'on' : ''}"><i>${CAT_GLYPH[c]}</i>${c === 'rec' ? 'Recommended' : CAT_NAMES[c]}<span class="n">${this.catItems(c).length}</span></button>`).join('');
    this.u.nav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.cat = b.dataset.c; this.q = ''; this.u.search.value = ''; this.renderNav(); this.renderGrid(); }));
  },
  matches(it, q) {
    if (!q) return true;
    const hay = `${it.name} ${it.en} ${it.pname} ${it.passive} ${Object.keys(it.stats).map((k) => STAT_NAMES[k]).join(' ')} ${CAT_NAMES[it.cat]}`.toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  },
  renderGrid() {
    const q = this.q, list = q ? ITEMS.filter((it) => this.matches(it, q)) : this.catItems(this.cat);
    const groups = [];
    if (q || this.cat === 'rec' || ['start', 'cons', 'relic'].includes(this.cat)) groups.push([q ? `Search: «${q}» · ${list.length} results` : this.cat === 'rec' ? `Recommended build for ${Kit ? Kit.name : ''}` : CAT_NAMES[this.cat], list]);
    else for (const t of [3, 2, 1]) { const l = list.filter((it) => it.tier === t); if (l.length) groups.push([['', 'Tier I · components', 'Tier II · upgrades', 'Tier III · finished items'][t], l]); }
    this.u.grid.innerHTML = '';
    for (const [title, items] of groups) {
      const h = document.createElement('div'); h.className = 'tierh'; h.textContent = title; this.u.grid.appendChild(h);
      const wrap = document.createElement('div'); wrap.className = 'cards'; this.u.grid.appendChild(wrap);
      for (const it of items) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.dataset.id = it.id;
        b.appendChild(ItemIcons.canvas(it.id, 96));
        b.insertAdjacentHTML('beforeend', `<span class="nm">${it.name}</span><span class="cs"><i class="coin"></i> ${it.cat === 'relic' ? 'free' : fmtGold(it.cost)}</span>`);
        b.addEventListener('click', () => this.select(it.id));
        b.addEventListener('dblclick', () => Items.buy(it.id));
        b.addEventListener('mouseenter', () => this.showTip(it.id, b));
        b.addEventListener('mouseleave', () => HUD.hideTip());
        wrap.appendChild(b);
      }
    }
    this.refreshCards();
  },
  refreshCards() {
    const free = Items.infinite && !Items.inArena(), ul = Stats.ullr();
    for (const b of this.u.grid.querySelectorAll('.card')) {
      const it = ITEM[b.dataset.id], q = Items.quote(it.id);
      b.classList.toggle('sel', this.sel === it.id);
      b.classList.toggle('own', Items.has(it.id) || Items.relic === it.id || Items.cons.some((c) => c && c.id === it.id));
      b.classList.toggle('poor', !free && q.cost > Items.gold);
      b.classList.toggle('ullr', ul && Object.keys(it.stats).some((k) => DMG_STATS.has(k)));
      const cs = b.querySelector('.cs');
      const txt = it.cat === 'relic' ? 'free' : fmtGold(q.cost);
      if (cs.dataset.v !== txt) { cs.dataset.v = txt; cs.innerHTML = `<i class="coin"></i> ${txt}`; }
    }
  },
  select(id) { this.sel = id; this.invSel = null; this.renderDetail(); this.refreshCards(); this.renderFoot(); },
  tree(id, pool, top = true) {
    const it = ITEM[id];
    let own = false;
    if (!top) { const i = pool.indexOf(id); if (i >= 0) { pool.splice(i, 1); own = true; } }
    const kids = own ? '' : it.from.map((c) => this.tree(c, pool, false)).join('');
    return `<li><div class="tn${own ? ' own' : ''}" data-id="${id}" title="${it.name}"><canvas data-icon="${id}" width="68" height="68"></canvas>${fmtGold(it.cost)}</div>${kids ? `<ul>${kids}</ul>` : ''}</li>`;
  },
  renderDetail() {
    const d = this.u.det, id = this.sel;
    if (!id) { d.innerHTML = `<div class="sub">Select an item</div><p style="margin:0;color:var(--muted);font-size:14px;line-height:1.45">Items are built in three steps: components (Tier I, ${fmtGold(600)}–${fmtGold(900)}) → Tier II (${fmtGold(1400)}–${fmtGold(1900)}) → finished Tier III (${fmtGold(2400)}–${fmtGold(3200)}). Components you own are deducted from the price. Selling refunds 50%.</p>`; return; }
    const it = ITEM[id], q = Items.quote(id), ul = Stats.ullr();
    const stats = Object.entries(it.stats).map(([k, v]) => `<li class="${ul && DMG_STATS.has(k) ? 'z' : ''}"><span>${STAT_NAMES[k]}</span><b>${fmtStat(k, v)}</b></li>`).join('');
    const hasDmg = Object.keys(it.stats).some((k) => DMG_STATS.has(k));
    const into = (BUILDS_INTO[id] || []).map((x) => `<canvas data-icon="${x}" data-id="${x}" width="68" height="68" title="${ITEM[x].name}"></canvas>`).join('');
    const ownIdx = Items.slots.indexOf(id);
    const priceTxt = it.cat === 'relic' ? 'Free' : `${fmtGold(q.cost)}${q.cost !== it.cost ? ` <small>(full price ${fmtGold(it.cost)})</small>` : ''}`;
    d.innerHTML = `<div class="hd"><canvas data-icon="${id}" width="168" height="168"></canvas><div><h3>${it.name}</h3>${it.en ? `<div class="en">${it.en}</div>` : ''}<div class="tr">${TIER_LABEL(it)} · ${CAT_NAMES[it.cat]}</div><div class="pr"><i class="coin"></i> ${priceTxt}</div></div></div>
      ${stats ? `<ul>${stats}</ul>` : ''}
      ${ul && hasDmg ? '<div class="ul">+0 damage (that’s Ullr) · his arrows always do 1</div>' : ''}
      ${it.passive ? `<div class="pas"><b>${it.cat === 'cons' || it.cat === 'relic' ? (it.cat === 'relic' ? `Active · ${it.pname} · ${it.cd} s` : `Use · ${it.pname}`) : `Passive · ${it.pname}`}</b>${it.passive}</div>` : ''}
      ${it.from.length ? `<div class="sub">Build tree</div><div class="tree"><ul>${this.tree(id, Items.owned())}</ul></div>` : ''}
      ${into ? `<div class="sub">Builds into</div><div class="into">${into}</div>` : ''}
      <div class="act"><button type="button" class="buy">${it.cat === 'relic' ? 'Equip relic' : q.used.length ? `Upgrade · ${fmtGold(q.cost)}` : `Buy · ${fmtGold(q.cost)}`}</button>
        ${ownIdx >= 0 ? `<button type="button" class="sell">Sell (+${fmtGold(it.cost * ECON.sellBack)})</button>` : ''}<p class="why"></p></div>`;
    for (const cv of d.querySelectorAll('canvas[data-icon]')) ItemIcons.draw(cv, cv.dataset.icon);
    for (const n of d.querySelectorAll('[data-id]')) {
      n.addEventListener('click', () => this.select(n.dataset.id));
      n.addEventListener('mouseenter', () => this.showTip(n.dataset.id, n));
      n.addEventListener('mouseleave', () => HUD.hideTip());
    }
    d.querySelector('.buy').addEventListener('click', () => Items.buy(id));
    const sell = d.querySelector('.sell'); if (sell) sell.addEventListener('click', () => { const i = Items.slots.indexOf(id); if (i >= 0) Items.sellSlot(i); });
    this.renderDynamic(true);
  },
  slotHtml(id, extra = '', cls = '') { return `<button type="button" class="slot${id ? '' : ' empty'}${cls}" ${extra}>${id ? `<canvas data-icon="${id}" width="96" height="96"></canvas>` : ''}</button>`; },
  renderFoot() {
    const I = Items;
    const sl = I.slots.map((id, i) => this.slotHtml(id, `data-s="${i}"`, this.flashId && id === this.flashId ? ' new' : '')).join('');
    const cs = I.cons.map((c, i) => this.slotHtml(c && c.id, `data-c="${i}"`).replace('</button>', `<kbd>${i + 6}</kbd>${c ? `<b>${c.n}</b>` : ''}</button>`)).join('');
    const rl = this.slotHtml(I.relic, 'data-r="0"').replace('</button>', '<kbd>Z</kbd></button>');
    this.u.inv.innerHTML = `<div class="grp">${sl}</div><div class="grp">${cs}</div><div class="grp">${rl}</div>`;
    this.flashId = null;
    for (const cv of this.u.inv.querySelectorAll('canvas[data-icon]')) ItemIcons.draw(cv, cv.dataset.icon);
    for (const b of this.u.inv.querySelectorAll('.slot')) {
      const id = b.dataset.s !== undefined ? I.slots[+b.dataset.s] : b.dataset.c !== undefined ? (I.cons[+b.dataset.c] || {}).id : I.relic;
      if (!id) continue;
      b.addEventListener('click', () => this.select(id));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); HUD.hideTip(); if (b.dataset.s !== undefined) I.sellSlot(+b.dataset.s); else if (b.dataset.c !== undefined) I.sellCons(+b.dataset.c); });
      b.addEventListener('mouseenter', () => this.showTip(id, b, b.dataset.s !== undefined ? `Right-click: sell for ${fmtGold(ITEM[id].cost * ECON.sellBack)}` : ''));
      b.addEventListener('mouseleave', () => HUD.hideTip());
    }
    // training-room controls
    const T = this.u.train;
    if (I.inArena()) { T.innerHTML = `<span style="font-size:12px;color:var(--muted)">Arena: +${ECON.perSec} gold/s · god kill ${ECON.godKill} · assist ${ECON.assist} · minion ${ECON.minion} · Sebek ${ECON.siege}</span>`; }
    else {
      T.innerHTML = `<label><input type="checkbox" class="inf" ${I.infinite ? 'checked' : ''}>Infinite gold (training room)</label>
        <div class="row"><button type="button" class="pw">Power slider: ${Math.round(Stats.basePower)}${Stats.basePower > 0 ? ' → 0' : ` → ${Math.round(this.savedBase || 600)}`}</button><button type="button" class="danger rs">Sell all / reset</button></div>`;
      T.querySelector('.inf').addEventListener('change', (e) => { I.infinite = e.target.checked; if (!I.infinite && !(I.gold > 0)) I.gold = ECON.trainGold; I.save(); this.render(); });
      T.querySelector('.rs').addEventListener('click', () => { I.resetAll(); HUD.toast('Everything sold · gold reset'); });
      T.querySelector('.pw').addEventListener('click', () => {
        if (Stats.basePower > 0) { this.savedBase = Stats.basePower; Stats.basePower = 0; } else Stats.basePower = this.savedBase || 600;
        saveSettings();
        const s = document.getElementById('sPower'), v = document.getElementById('vPower'); if (s) s.value = Stats.basePower; if (v) v.textContent = String(Math.round(settings.power));
        this.render();
      });
    }
    this.renderStats();
  },
  renderStats() {
    const s = Stats.cur, ul = Stats.ullr(), ph = Stats.physical();
    const pu = Items.inArena() && Arena.pu;
    const pp = pu ? Math.round(Arena.pu.physProt) : Math.round(s.pprot), mp = pu ? Math.round(Arena.pu.magProt) : Math.round(s.mprot);
    const pct = (v) => `${Math.round(v * 100)}%`;
    const rows = [
      [ul ? 'Power' : ph ? 'Physical power' : 'Magic power', ul ? "0 (that’s Ullr)" : ph ? Math.round(settings.power * 0.55) : Math.round(settings.power)],
      ['Basic', ul ? '1' : Math.round(basicDamage())], ['Attacks/s', attackSpeed().toFixed(2)], ['Crit', pct(s.crit)], ['Lifesteal', pct(s.ls)],
      ['Pen', `${Math.round(s.pen)} / ${pct(s.penP)}`], ['Protection', `${pp} / ${mp}`], ['Health', Math.round(maxHp())], ['Mana', Math.round(maxMp())],
      ['CDR', pct(settings.cdr)], ['Speed', Math.round(kitStats().speed * Stats.msMul())], ['CC red.', pct(s.ccr)],
    ];
    this.u.stats.innerHTML = rows.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('') + `<span class="hint" style="flex-basis:100%">Keys: <kbd>P</kbd> store · <kbd>6</kbd>/<kbd>7</kbd> potions · <kbd>Z</kbd> relic</span>`;
  },
  // gold, the fountain rule and the buy button's state (called often while open)
  renderDynamic(force = false) {
    if (!this.el || !this.open) return;
    const g = Items.goldText();
    if (force || g !== this.lastGold) { this.lastGold = g; this.u.gold.textContent = g; if (!force) this.refreshCards(); }
    this.u.warn.hidden = Items.canShop();
    const d = this.u.det, id = this.sel; if (!id) return;
    const btn = d.querySelector('.buy'), why = d.querySelector('.why');
    if (!btn) return;
    const w = Items.blocker(id);
    btn.disabled = !!w; why.textContent = w || '';
  },
  showTip(id, anchor, extra = '') {
    const it = ITEM[id], tip = HUD.els && HUD.els.tip; if (!it || !tip) return;
    const ul = Stats.ullr();
    const rows = Object.entries(it.stats).map(([k, v]) => `<dt>${STAT_NAMES[k]}</dt><dd${ul && DMG_STATS.has(k) ? ' style="color:#9fffc8;text-decoration:line-through"' : ''}>${fmtStat(k, v)}</dd>`).join('');
    const q = Items.quote(id);
    tip.innerHTML = `<div class="k">${TIER_LABEL(it)} · ${CAT_NAMES[it.cat]} · ${it.cat === 'relic' ? `${it.cd} s cooldown` : `${fmtGold(q.cost)} gold`}</div><h4>${it.name}</h4>${it.en ? `<div style="font-size:12px;color:var(--muted);font-style:italic">${it.en}</div>` : ''}${rows ? `<dl>${rows}</dl>` : ''}${ul && Object.keys(it.stats).some((k) => DMG_STATS.has(k)) ? '<p style="color:#9fffc8">+0 damage (that’s Ullr)</p>' : ''}${it.passive ? `<p><b style="color:var(--gold)">${it.pname}:</b> ${it.passive}</p>` : ''}${extra ? `<p style="color:var(--muted)">${extra}</p>` : ''}`;
    tip.hidden = false;
    const r = anchor.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 16, innerWidth - tw - 16) + 'px';
    tip.style.top = (r.top - th - 12 >= 16 ? r.top - th - 12 : Math.min(innerHeight - th - 16, r.bottom + 12)) + 'px';
  },

  // ---------------------------------------------------------------- HUD inventory (next to the ability bar)
  buildHud() {
    const bottom = document.getElementById('bottom'); if (!bottom || document.getElementById('invHud')) return;
    const h = document.createElement('div'); h.id = 'invHud';
    h.innerHTML = `<div class="bf"></div><div class="ig" title="Store (P)"><i class="coin"></i><b>0</b><kbd>P</kbd></div>
      <div class="ii">${'<div class="s empty"><canvas width="64" height="64"></canvas></div>'.repeat(6)}</div>
      <div class="is"><div class="s empty c"><canvas width="64" height="64"></canvas><kbd>6</kbd><b></b></div><div class="s empty c"><canvas width="64" height="64"></canvas><kbd>7</kbd><b></b></div><div class="s empty r"><canvas width="64" height="64"></canvas><kbd>Z</kbd><div class="cd" hidden></div></div><div class="s sh empty" title="Shield"><canvas width="64" height="64"></canvas><b></b></div></div>`;
    bottom.appendChild(h);
    const slots = [...h.querySelectorAll('.ii .s')], side = [...h.querySelectorAll('.is .s')];
    this.hud = { root: h, gold: h.querySelector('.ig b'), slots, cons: side.slice(0, 2), relic: side[2], relicCd: side[2].querySelector('.cd'), shield: side[3], buffs: h.querySelector('.bf'), ids: [] };
    h.querySelector('.ig').addEventListener('click', () => this.openStore());
    const tipFor = (el, get) => { el.addEventListener('mouseenter', () => { const id = get(); if (id) this.showTip(id, el); }); el.addEventListener('mouseleave', () => HUD.hideTip()); };
    slots.forEach((el, i) => tipFor(el, () => Items.slots[i]));
    this.hud.cons.forEach((el, i) => tipFor(el, () => Items.cons[i] && Items.cons[i].id));
    tipFor(this.hud.relic, () => Items.relic);
    // the shield slot draws a little golden aegis when a shield is up
    this.hudDirty = true;
  },
  hudUpdate(dt) {
    const H = this.hud; if (!H) return;
    this.hudT -= dt; this.dynT -= dt;
    if (this.open && this.dynT <= 0) { this.dynT = 0.25; this.renderDynamic(); }
    if (this.hudT > 0 && !this.hudDirty) return;
    this.hudT = 0.1;
    const I = Items, dirty = this.hudDirty; this.hudDirty = false;
    H.gold.textContent = I.goldText();
    const ids = [...I.slots, ...I.cons.map((c) => c && c.id), I.relic];
    ids.forEach((id, i) => {
      if (!dirty && H.ids[i] === id) return;
      const el = i < 6 ? H.slots[i] : i < 8 ? H.cons[i - 6] : H.relic;
      ItemIcons.draw(el.querySelector('canvas'), id); el.classList.toggle('empty', !id);
      if (id && H.ids[i] !== id && this.flashHud !== false) { el.classList.remove('new'); void el.offsetWidth; el.classList.add('new'); }
      H.ids[i] = id;
    });
    I.cons.forEach((c, i) => { const b = H.cons[i].querySelector('b'); const t = c ? String(c.n) : ''; if (b.textContent !== t) b.textContent = t; });
    const cd = I.relicCd, rc = H.relicCd;
    if (I.relic && cd > 0) { rc.hidden = false; rc.style.setProperty('--p', `${(cd / ITEM[I.relic].cd * 100).toFixed(1)}%`); rc.textContent = Math.ceil(cd); } else rc.hidden = true;
    const sh = Math.round(I.shieldNow());
    if (sh > 0) { if (!H.shieldOn) { ItemIcons.draw(H.shield.querySelector('canvas'), 'r_aegis'); H.shieldOn = true; } H.shield.classList.remove('empty'); H.shield.querySelector('b').textContent = sh; }
    else if (H.shieldOn) { H.shieldOn = false; H.shield.classList.add('empty'); H.shield.querySelector('b').textContent = ''; }
    // active item buffs as little chips above the inventory
    const chips = I.buffs.map((b) => `<span>${b.name}${b.n > 1 ? ` ×${b.n}` : ''} ${b.t.toFixed(b.t < 10 ? 1 : 0)}</span>`);
    if (I.has('thoth_book')) chips.unshift(`<span>Echo ${Math.min(75, I.st.book || 0)}/75</span>`);
    if (I.cds.ankh > 0 && I.has('osiris_ankh')) chips.push(`<span>Ankh ${Math.ceil(I.cds.ankh)}</span>`);
    if (I.cds.scarab > 0 && I.has('scarab_amulet')) chips.push(`<span>Scarab ${Math.ceil(I.cds.scarab)}</span>`);
    if (I.immuneT > 0) chips.push('<span class="sh">Immortal</span>');
    if (I.ccImmuneT > 0) chips.push('<span class="sh">CC immune</span>');
    const html = chips.join('');
    if (H.buffs.dataset.v !== html) { H.buffs.dataset.v = html; H.buffs.innerHTML = html; }
  },
};

// ---------------------------------------------------------------------------
// Keys: P opens / closes the store; while it is open the game gets no keys (Esc closes it, not the menu)
// ---------------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (!Store.el) return;
  if (e.code === ITEM_KEYS.store && !e.repeat && !isFormTarget(e)) {
    if (Store.open) { e.preventDefault(); e.stopImmediatePropagation(); Store.close(); return; }
    if (Game.mode === 'play' && UI.hud && !UI.hud.hidden) { e.preventDefault(); e.stopImmediatePropagation(); Store.openStore(); return; }
  }
  if (!Store.open) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); Store.close(); return; }
  if (isFormTarget(e)) return;
  e.stopImmediatePropagation();
  if (GAME_KEYS.has(e.code)) e.preventDefault();
}, true);

// ---------------------------------------------------------------------------
// Hooks: the store is built with the HUD; its inventory refreshes with it; dev hooks join window.__thoth
// ---------------------------------------------------------------------------
{
  const hi0 = HUD.init;
  HUD.init = function (...a) { const r = hi0.apply(this, a); try { Store.init(); } catch (e) { console.warn('[items] store init', e); } return r; };
  const hu0 = HUD.update;
  HUD.update = function (dt) {
    hu0.call(this, dt);
    try {
      Store.hudUpdate(dt);
      if (Store.open && Game.mode !== 'play' && Game.mode !== 'inspect') Store.close(false);
    } catch (e) { if (!Store.warned) { Store.warned = true; console.warn('[items] hud', e); } }
  };
}
Items.dev = {
  // open / close the store (also outside the fountain; buying still follows the rules unless force)
  open() { Store.openStore(true); return Store.open; },
  close() { Store.close(false); },
  buy(id, force = true) { const f0 = Items.canShop; if (force) Items.canShop = () => true; try { return Items.buy(id); } finally { Items.canShop = f0; } },
  build(ids, force = true) { return ids.map((id) => [id, this.buy(id, force)]); },
  sell(i) { const f0 = Items.canShop; Items.canShop = () => true; try { return Items.sellSlot(i); } finally { Items.canShop = f0; } },
  give(n = 5000) { Items.gold += n; Store.onChange(null); return Items.gold; },
  infinite(on = true) { Items.infinite = on; Store.onChange(null); },
  reset() { Items.resetAll(); },
  inv() { return { gold: Math.round(Items.gold), slots: Items.slots.slice(), cons: Items.cons.map((c) => c && `${c.id}×${c.n}`), relic: Items.relic, buffs: Items.buffs.map((b) => `${b.key}:${b.t.toFixed(1)}`) }; },
  stats() {
    const s = Stats.cur, o = { god: Kit && Kit.id, physical: Stats.physical() };
    for (const k of STAT_KEYS) if (s[k]) o[k] = +s[k].toFixed(3);
    Object.assign(o, { 'settings.power': Math.round(settings.power), basePower: Stats.basePower, ppow: Math.round(settings.power * 0.55), basicDamage: Math.round(basicDamage()), attackSpeed: +attackSpeed().toFixed(3), moveSpeed: +moveSpeed().toFixed(3), maxHp: Math.round(maxHp()), maxMp: Math.round(maxMp()), cdr: +settings.cdr.toFixed(3) });
    if (Items.inArena() && Arena.pu) Object.assign(o, { physProt: Math.round(Arena.pu.physProt), magProt: Math.round(Arena.pu.magProt) });
    return o;
  },
  // simulate a hit on yourself (raw damage before your protections); the Arena routes it through Arena.hurt
  hit(raw = 300, physical = true) {
    if (Items.inArena()) return Arena.hurt(Arena.pu, raw, { team: 1, isGod: true, alive: true, name: 'Test hit', level: 1, xp: 0, k: 0, d: 0, a: 0, pos: P.pos.clone() }, { physical });
    const prot = physical ? Stats.cur.pprot : Stats.cur.mprot;
    let amt = Math.round(Items.incoming(raw * 100 / (100 + prot), null, {}));
    if (Items.shieldHp > 0) { const s = Math.min(Items.shieldHp, amt); Items.shieldHp -= s; amt -= s; }
    P.hp = Math.max(1, P.hp - amt);
    Combat.texts.push({ x: P.pos.x, y: P.y + 2.3, z: P.pos.z, text: '-' + amt, color: '#ff5a4f', t: 0, big: false });
    Items.afterDamaged(amt, null, {});
    return { raw, prot, taken: amt, hp: Math.round(P.hp) };
  },
  bots() {
    if (!Items.inArena()) return 'No match';
    return Arena.bots.map((b) => ({ god: b.god, team: b.team, lvl: b.level, gold: Math.round(b.gold || 0), items: (b.inv || []).join(', '), hp: `${Math.round(b.hp)}/${b.maxHp}`, prot: `${Math.round(b.physProt)}/${Math.round(b.magProt)}`, power: +(b.power || 1).toFixed(2) }));
  },
  list() { return ITEMS.map((it) => ({ id: it.id, name: it.name, cat: it.cat, tier: it.tier, cost: it.cost, from: it.from.join('+'), stats: Object.entries(it.stats).map(([k, v]) => `${k} ${fmtStat(k, v)}`).join(', '), passive: it.pname })); },
};
{
  const attach = () => { if (window.__thoth) Object.assign(window.__thoth, { Items, Stats, ITEMS, ITEM, Store, ItemIcons, ECON, BOT_BUILDS }); else setTimeout(attach, 250); };
  setTimeout(attach, 0);
}


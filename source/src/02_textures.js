// ============================================================================
// Procedural textures (canvas). Everything is generated at load time.
// ============================================================================
const Tex = {};
function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true;
  return t;
}

// Tileable gradient noise ---------------------------------------------------
const Noise = (() => {
  const perm = new Uint16Array(512);
  const r = mulberry32(9001);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  function perlin(x, y, px = 256, py = 256) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[x0 & 255] + (y0 & 255)], ab = perm[perm[x0 & 255] + (y1 & 255)];
    const ba = perm[perm[x1 & 255] + (y0 & 255)], bb = perm[perm[x1 & 255] + (y1 & 255)];
    const l1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const l2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(l1, l2, v);
  }
  function fbm(x, y, oct = 4, px = 256, py = 256) {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * perlin(x * f, y * f, px * f, py * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
  return { perlin, fbm };
})();

// Pixel painter: fn(x, y, out) writes rgba 0..255 into out
function paint(w, h, fn) {
  const c = cnv(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data, out = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[3] = 255;
      fn(x, y, out);
      const o = (y * w + x) * 4;
      d[o] = out[0]; d[o + 1] = out[1]; d[o + 2] = out[2]; d[o + 3] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Hieroglyphs (Noto Sans Egyptian Hieroglyphs, with drawn fallbacks)
// ---------------------------------------------------------------------------
const GLYPH = {
  ibis: 0x1315D, ibis2: 0x1315E, thoth: 0x1305F, eye: 0x13080, ankh: 0x132F9, scarab: 0x131A3,
  sun: 0x131F3, water: 0x13216, mouth: 0x1308B, djed: 0x132BD, heart: 0x13123, nfr: 0x13124,
  viper: 0x13191, owl: 0x13153, cobra: 0x13193, feather: 0x13184, netjer: 0x132B9, reed: 0x131CB,
  bread: 0x133CF, arm: 0x1309D, foot: 0x130C0, quail: 0x13171, lion: 0x130ED, seated: 0x13000,
  walk: 0x130BB, cloth: 0x132F4, falcon: 0x13143, vulture: 0x1313F, wadjet: 0x13079,
};
const GLYPH_FONT = '"Noto Sans Egyptian Hieroglyphs"';
const gch = (k) => String.fromCodePoint(GLYPH[k] || GLYPH.ankh);
let glyphFontOK = false;
async function loadGlyphFont() {
  const sample = Object.keys(GLYPH).map(gch).join('');
  try {
    await Promise.race([
      document.fonts.load('64px ' + GLYPH_FONT, sample),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
    glyphFontOK = document.fonts.check('64px ' + GLYPH_FONT, gch('eye'));
  } catch (e) { glyphFontOK = false; }
  try { await Promise.race([document.fonts.load('800 32px "Cinzel"'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fallback font */ }
}
// Draw a glyph centred at (x, y) with given size (em)
function drawGlyph(ctx, key, x, y, size, fill = '#fff') {
  ctx.save();
  ctx.fillStyle = fill; ctx.strokeStyle = fill;
  if (glyphFontOK) {
    ctx.font = `${Math.round(size)}px ${GLYPH_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(gch(key), x, y + size * 0.04);
  } else {
    drawGlyphFallback(ctx, key, x, y, size);
  }
  ctx.restore();
}
function drawGlyphFallback(ctx, key, x, y, s) {
  ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  const h = s * 0.42;
  switch (key) {
    case 'ankh':
      ctx.ellipse(x, y - h * 0.55, h * 0.28, h * 0.38, 0, 0, TAU);
      ctx.moveTo(x - h * 0.5, y - h * 0.1); ctx.lineTo(x + h * 0.5, y - h * 0.1);
      ctx.moveTo(x, y - h * 0.15); ctx.lineTo(x, y + h); break;
    case 'eye': case 'wadjet':
      ctx.ellipse(x, y - h * 0.2, h * 0.75, h * 0.32, 0, 0, TAU);
      ctx.moveTo(x + h * 0.12, y - h * 0.2); ctx.arc(x, y - h * 0.2, h * 0.12, 0, TAU);
      ctx.moveTo(x - h * 0.1, y + h * 0.1); ctx.lineTo(x - h * 0.2, y + h * 0.8);
      ctx.moveTo(x + h * 0.1, y + h * 0.1); ctx.quadraticCurveTo(x + h * 0.5, y + h * 0.8, x + h * 0.8, y + h * 0.5); break;
    case 'sun': ctx.arc(x, y, h * 0.7, 0, TAU); ctx.moveTo(x + h * 0.12, y); ctx.arc(x, y, h * 0.12, 0, TAU); break;
    case 'water':
      ctx.moveTo(x - h, y); for (let i = 0; i <= 8; i++) ctx.lineTo(x - h + i * h / 4, y + (i % 2 ? -h * 0.18 : h * 0.18)); break;
    case 'viper': case 'cobra':
      ctx.moveTo(x - h, y + h * 0.3); ctx.bezierCurveTo(x - h * 0.3, y - h * 0.4, x + h * 0.2, y + h * 0.8, x + h, y - h * 0.2); break;
    case 'djed':
      ctx.moveTo(x, y - h); ctx.lineTo(x, y + h);
      for (let i = 0; i < 4; i++) { ctx.moveTo(x - h * 0.4, y - h * 0.8 + i * h * 0.2); ctx.lineTo(x + h * 0.4, y - h * 0.8 + i * h * 0.2); } break;
    case 'feather': ctx.moveTo(x, y + h); ctx.quadraticCurveTo(x + h * 0.4, y - h * 0.2, x + h * 0.1, y - h); ctx.quadraticCurveTo(x - h * 0.3, y, x, y + h); break;
    case 'heart': case 'nfr':
      ctx.ellipse(x, y, h * 0.45, h * 0.55, 0, 0, TAU); ctx.moveTo(x - h * 0.2, y - h * 0.55); ctx.lineTo(x - h * 0.3, y - h * 0.85); ctx.moveTo(x + h * 0.2, y - h * 0.55); ctx.lineTo(x + h * 0.3, y - h * 0.85); break;
    default: // ibis-ish bird / generic
      ctx.ellipse(x, y, h * 0.55, h * 0.3, -0.2, 0, TAU);
      ctx.moveTo(x + h * 0.45, y - h * 0.15); ctx.quadraticCurveTo(x + h * 0.6, y - h * 0.8, x + h * 0.75, y - h * 0.7);
      ctx.quadraticCurveTo(x + h * 1.0, y - h * 0.5, x + h * 0.95, y - h * 0.2);
      ctx.moveTo(x - h * 0.1, y + h * 0.3); ctx.lineTo(x - h * 0.15, y + h); ctx.moveTo(x + h * 0.15, y + h * 0.3); ctx.lineTo(x + h * 0.2, y + h);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Stone: temple floor tiles
// ---------------------------------------------------------------------------
function makeFloorTextures() {
  const S = 1024, T = 4, ts = S / T;
  const r = mulberry32(77);
  const tiles = [];
  for (let i = 0; i < T * T; i++) tiles.push({ l: r() * 0.16 - 0.08, warm: r() * 0.1 - 0.05, crack: r() < 0.35, glyph: r() < 0.18 });
  const col = paint(S, S, (x, y, o) => {
    const tx = Math.floor(x / ts), ty = Math.floor(y / ts);
    const tp = tiles[ty * T + tx];
    const lx = x - tx * ts, ly = y - ty * ts;
    const chip = Noise.perlin(x / 7, y / 7, S / 7 | 0, S / 7 | 0) * 2.2;
    const edge = Math.min(lx, ly, ts - 1 - lx, ts - 1 - ly) + chip;
    const n = Noise.fbm(x / 128, y / 128, 4, 8, 8);
    const d = Noise.perlin(x / 16, y / 16, 64, 64);
    const grout = smoothstep(1.2, 4.5, edge);
    const wear = 0.84 + 0.16 * smoothstep(2, 16, edge);
    const k = (1 + tp.l + n * 0.16 + d * 0.05) * wear;
    let R = 186 * k * (1 + tp.warm), G = 158 * k, B = 118 * k * (1 - tp.warm);
    R = lerp(58, R, grout); G = lerp(48, G, grout); B = lerp(40, B, grout);
    o[0] = clamp(R, 0, 255); o[1] = clamp(G, 0, 255); o[2] = clamp(B, 0, 255);
  });
  const bump = paint(S, S, (x, y, o) => {
    const tx = Math.floor(x / ts), ty = Math.floor(y / ts);
    const lx = x - tx * ts, ly = y - ty * ts;
    const chip = Noise.perlin(x / 7, y / 7, S / 7 | 0, S / 7 | 0) * 2.2;
    const edge = Math.min(lx, ly, ts - 1 - lx, ts - 1 - ly) + chip;
    const d = Noise.perlin(x / 16, y / 16, 64, 64);
    const v = smoothstep(0.5, 7, edge) * (205 + d * 22);
    o[0] = o[1] = o[2] = clamp(v, 0, 255);
  });
  const rough = paint(S / 2, S / 2, (x, y, o) => {
    const n = Noise.fbm(x / 64, y / 64, 3, 4, 4);
    const lx = (x * 2) % ts, ly = (y * 2) % ts;
    const edge = Math.min(lx, ly, ts - 1 - lx, ts - 1 - ly);
    const v = edge < 4 ? 245 : 120 + n * 60;
    o[0] = o[1] = o[2] = clamp(v, 0, 255);
  });
  // cracks + a few inlaid glyph tiles
  const cx = col.getContext('2d'), bx = bump.getContext('2d');
  tiles.forEach((tp, i) => {
    const ox = (i % T) * ts, oy = Math.floor(i / T) * ts;
    if (tp.crack) {
      let px = ox + 20 + r() * (ts - 40), py = oy + 20 + r() * (ts - 40), a = r() * TAU;
      cx.strokeStyle = 'rgba(60,45,30,0.55)'; bx.strokeStyle = 'rgba(40,40,40,0.9)';
      cx.lineWidth = 1.2; bx.lineWidth = 2;
      cx.beginPath(); bx.beginPath(); cx.moveTo(px, py); bx.moveTo(px, py);
      for (let s = 0; s < 14; s++) { a += (r() - 0.5) * 1.1; px += Math.cos(a) * 9; py += Math.sin(a) * 9; cx.lineTo(px, py); bx.lineTo(px, py); }
      cx.stroke(); bx.stroke();
    }
    if (tp.glyph) {
      const keys = ['ankh', 'eye', 'ibis', 'feather', 'djed', 'scarab'];
      const k = keys[Math.floor(r() * keys.length)];
      cx.globalAlpha = 0.5; drawGlyph(cx, k, ox + ts / 2, oy + ts / 2, ts * 0.55, '#6b4e2c'); cx.globalAlpha = 1;
      bx.globalAlpha = 0.85; drawGlyph(bx, k, ox + ts / 2, oy + ts / 2, ts * 0.55, '#3a3a3a'); bx.globalAlpha = 1;
    }
  });
  return {
    map: toTex(col, { repeat: true, aniso: 16 }),
    bump: toTex(bump, { srgb: false, repeat: true, aniso: 16 }),
    rough: toTex(rough, { srgb: false, repeat: true }),
  };
}

// Ashlar sandstone blocks for walls / pylons
function makeWallTextures() {
  const S = 1024, bw = 256, bh = 128;
  const r = mulberry32(5);
  const shade = []; for (let i = 0; i < 64; i++) shade.push(r() * 0.18 - 0.09);
  const blockInfo = (x, y) => {
    const row = Math.floor(y / bh);
    const off = (row % 2) * (bw / 2);
    const colI = Math.floor((x + off) / bw);
    const lx = (x + off) - colI * bw, ly = y - row * bh;
    return { row, colI, lx, ly, id: (row * 7 + colI * 13) & 63 };
  };
  const col = paint(S, S, (x, y, o) => {
    const b = blockInfo(x, y);
    const chip = Noise.perlin(x / 6, y / 6, S / 6 | 0, S / 6 | 0) * 2;
    const edge = Math.min(b.lx, b.ly, bw - 1 - b.lx, bh - 1 - b.ly) + chip;
    const n = Noise.fbm(x / 96, y / 96, 4, S / 96 | 0, S / 96 | 0);
    const strata = Math.sin(y * 0.09 + n * 4) * 0.04;
    const k = (1 + shade[b.id] + n * 0.18 + strata) * (0.8 + 0.2 * smoothstep(2, 14, edge));
    const g = smoothstep(1, 4, edge);
    o[0] = clamp(lerp(70, 196 * k, g), 0, 255);
    o[1] = clamp(lerp(56, 162 * k, g), 0, 255);
    o[2] = clamp(lerp(44, 116 * k, g), 0, 255);
  });
  const bump = paint(S, S, (x, y, o) => {
    const b = blockInfo(x, y);
    const chip = Noise.perlin(x / 6, y / 6, S / 6 | 0, S / 6 | 0) * 2;
    const edge = Math.min(b.lx, b.ly, bw - 1 - b.lx, bh - 1 - b.ly) + chip;
    const d = Noise.fbm(x / 24, y / 24, 3, S / 24 | 0, S / 24 | 0);
    o[0] = o[1] = o[2] = clamp(smoothstep(0, 8, edge) * (200 + d * 40), 0, 255);
  });
  return { map: toTex(col, { repeat: true, aniso: 16 }), bump: toTex(bump, { srgb: false, repeat: true }) };
}

// Carved + painted hieroglyph frieze (columns of glyphs between registers)
function makeReliefTexture(w = 2048, h = 512, seed = 3, emissive = false) {
  const r = mulberry32(seed);
  const base = paint(w, h, (x, y, o) => {
    const n = Noise.fbm(x / 80, y / 80, 4, w / 80 | 0, h / 80 | 0);
    const k = 1 + n * 0.2;
    o[0] = clamp(190 * k, 0, 255); o[1] = clamp(157 * k, 0, 255); o[2] = clamp(112 * k, 0, 255);
  });
  const ctx = base.getContext('2d');
  const bump = cnv(w, h), bx = bump.getContext('2d');
  bx.fillStyle = '#c8c8c8'; bx.fillRect(0, 0, w, h);
  const glow = emissive ? cnv(w, h) : null, gx = glow ? glow.getContext('2d') : null;
  if (gx) { gx.fillStyle = '#000'; gx.fillRect(0, 0, w, h); }
  // registers
  const band = (y0, y1, colA) => {
    ctx.fillStyle = colA; ctx.globalAlpha = 0.55; ctx.fillRect(0, y0, w, y1 - y0); ctx.globalAlpha = 1;
    bx.fillStyle = '#909090'; bx.fillRect(0, y0, w, 2); bx.fillRect(0, y1 - 2, w, 2);
  };
  band(0, h * 0.07, '#2c4f8f'); band(h * 0.93, h, '#2c4f8f');
  band(h * 0.07, h * 0.1, '#b0402c'); band(h * 0.9, h * 0.93, '#b0402c');
  const keys = Object.keys(GLYPH);
  const colW = 64, top = h * 0.13, bottom = h * 0.87;
  const paints = ['#23417e', '#9c3a22', '#2e6e4a', '#b07d22', '#23417e'];
  for (let x0 = 8; x0 < w - colW; x0 += colW) {
    // column divider
    bx.fillStyle = '#9a9a9a'; bx.fillRect(x0 - 3, top, 2, bottom - top);
    ctx.fillStyle = 'rgba(80,55,30,0.45)'; ctx.fillRect(x0 - 3, top, 1.5, bottom - top);
    let y = top + 30;
    while (y < bottom - 26) {
      const k = keys[Math.floor(r() * keys.length)];
      const s = 44 + r() * 8;
      const cxp = x0 + colW / 2, cyp = y + s / 2 - 8;
      drawGlyph(bx, k, cxp + 1.5, cyp + 1.5, s, '#5a5a5a');   // carved recess
      drawGlyph(bx, k, cxp, cyp, s, '#7a7a7a');
      drawGlyph(ctx, k, cxp + 1, cyp + 1, s, 'rgba(60,40,20,0.55)');
      drawGlyph(ctx, k, cxp, cyp, s, paints[Math.floor(r() * paints.length)]);
      if (gx) drawGlyph(gx, k, cxp, cyp, s, '#ffffff');
      y += s + 10;
    }
  }
  return {
    map: toTex(base, { repeat: true, aniso: 16 }),
    bump: toTex(bump, { srgb: false, repeat: true }),
    glow: glow ? toTex(glow, { repeat: true }) : null,
  };
}

// Painted papyrus column shaft (u around, v up)
function makeColumnTexture() {
  const W = 512, H = 1024;
  const r = mulberry32(11);
  const c = paint(W, H, (x, y, o) => {
    const n = Noise.fbm(x / 64, y / 64, 4, W / 64, H / 64);
    const flute = 0.5 + 0.5 * Math.cos((x / W) * TAU * 12);
    const k = (1 + n * 0.16) * (0.86 + 0.14 * flute);
    o[0] = clamp(198 * k, 0, 255); o[1] = clamp(164 * k, 0, 255); o[2] = clamp(118 * k, 0, 255);
  });
  const ctx = c.getContext('2d');
  // painted bands near the top (canvas y=0 is top of texture = top of shaft with flipY)
  const bands = [['#b0402c', 10], ['#e3c070', 6], ['#23417e', 14], ['#e3c070', 6], ['#2e6e4a', 10], ['#e3c070', 6], ['#b0402c', 8]];
  let y = 40;
  for (const [colr, hgt] of bands) { ctx.fillStyle = colr; ctx.globalAlpha = 0.8; ctx.fillRect(0, y, W, hgt); y += hgt + 3; }
  ctx.globalAlpha = 1;
  // cartouche glyph column front + back
  for (const cxp of [W * 0.25, W * 0.75]) {
    ctx.strokeStyle = 'rgba(70,45,20,0.75)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(cxp - 34, 190, 68, 420, 30); ctx.stroke();
    let gy = 230;
    for (let i = 0; i < 6; i++) {
      const k = pick(['ankh', 'ibis', 'eye', 'djed', 'sun', 'water', 'reed', 'netjer', 'feather']);
      drawGlyph(ctx, k, cxp, gy, 50, ['#23417e', '#9c3a22', '#2e6e4a'][i % 3]);
      gy += 64;
    }
  }
  // lower band
  ctx.fillStyle = '#23417e'; ctx.globalAlpha = 0.7; ctx.fillRect(0, H - 90, W, 14); ctx.fillStyle = '#b0402c'; ctx.fillRect(0, H - 70, W, 8); ctx.globalAlpha = 1;
  // leaf pattern at foot
  ctx.strokeStyle = 'rgba(46,110,74,0.75)'; ctx.lineWidth = 4;
  for (let i = 0; i < 24; i++) { const x0 = i * W / 24; ctx.beginPath(); ctx.moveTo(x0, H - 60); ctx.quadraticCurveTo(x0 + W / 48, H - 140, x0 + W / 24, H - 60); ctx.stroke(); }
  return toTex(c, { repeat: true, aniso: 16 });
}

// Subtle engraving / grain for gold
function makeGoldDetail() {
  const S = 512;
  const c = paint(S, S, (x, y, o) => {
    const n = Noise.fbm(x / 40, y / 40, 4, S / 40 | 0, S / 40 | 0);
    const lines = 0.5 + 0.5 * Math.sin((y + n * 30) * 0.35);
    const v = 150 + n * 50 + lines * 25;
    o[0] = o[1] = o[2] = clamp(v, 0, 255);
  });
  return toTex(c, { srgb: false, repeat: true });
}

// ---------------------------------------------------------------------------
// Character textures. Pattern maps paired with metal/rough maps (G = roughness, B = metalness)
// ---------------------------------------------------------------------------
function patternPair(w, h, painter) {
  const col = cnv(w, h), mr = cnv(w, h);
  const c = col.getContext('2d'), m = mr.getContext('2d');
  // helper fills both colour + material response
  const GOLD = { col: '#e1b052', rough: 0.3, metal: 1 };
  const P = {
    c, m, w, h,
    fill(style, x, y, ww, hh, mat = null) {
      c.fillStyle = style; c.fillRect(x, y, ww, hh);
      if (mat) { m.fillStyle = `rgb(0,${Math.round(mat.rough * 255)},${Math.round(mat.metal * 255)})`; m.fillRect(x, y, ww, hh); }
    },
    gold(x, y, ww, hh) { P.fill(GOLD.col, x, y, ww, hh, GOLD); },
    enamel(style, x, y, ww, hh, rough = 0.32) { P.fill(style, x, y, ww, hh, { rough, metal: 0 }); },
    matPath(mat) { m.fillStyle = `rgb(0,${Math.round(mat.rough * 255)},${Math.round(mat.metal * 255)})`; },
    GOLD,
  };
  P.gold(0, 0, w, h);
  painter(P);
  // grain on colour
  const g = c.getImageData(0, 0, w, h), d = g.data;
  for (let i = 0; i < d.length; i += 4) { const k = 1 + (Math.random() - 0.5) * 0.06; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
  c.putImageData(g, 0, 0);
  return { map: toTex(col), mr: toTex(mr, { srgb: false }) };
}

function makeCharacterTextures() {
  const T = {};
  // Usekh broad collar: v = inner (top of canvas) -> outer (bottom)
  T.collar = patternPair(1024, 256, (P) => {
    const { w, h } = P;
    const rows = [
      ['gold', 0, 0.09], ['lapis', 0.09, 0.22], ['gold', 0.22, 0.27], ['turq', 0.27, 0.42],
      ['gold', 0.42, 0.47], ['carn', 0.47, 0.6], ['gold', 0.6, 0.65], ['lapis', 0.65, 0.8], ['gold', 0.8, 1],
    ];
    for (const [k, a, b] of rows) {
      const y0 = a * h, y1 = b * h;
      if (k === 'gold') P.gold(0, y0, w, y1 - y0);
      else {
        const col = k === 'lapis' ? '#1d3a8c' : k === 'turq' ? '#1fa3a0' : '#c2532e';
        P.enamel(col, 0, y0, w, y1 - y0);
        // bead segmentation
        P.c.fillStyle = 'rgba(0,0,0,0.35)';
        const seg = k === 'lapis' ? 18 : 12;
        for (let x = 0; x < w; x += seg) P.c.fillRect(x, y0, 2, y1 - y0);
        P.c.fillStyle = 'rgba(255,255,255,0.18)';
        for (let x = 0; x < w; x += seg) P.c.fillRect(x + 3, y0 + 2, seg - 6, 3);
      }
    }
    // teardrop fringe on outer band
    for (let x = 6; x < w; x += 24) {
      P.c.fillStyle = '#1d3a8c'; P.matPath({ rough: 0.3, metal: 0 });
      P.c.beginPath(); P.c.ellipse(x + 6, h * 0.9, 6, 12, 0, 0, TAU); P.c.fill();
      P.m.beginPath(); P.m.ellipse(x + 6, h * 0.9, 6, 12, 0, 0, TAU); P.m.fill();
    }
  });
  // Belt: lapis band with teal triangles, gold rims (v: top -> bottom on canvas)
  T.belt = patternPair(1024, 128, (P) => {
    const { w, h } = P;
    P.gold(0, 0, w, h * 0.16); P.gold(0, h * 0.84, w, h * 0.16);
    P.enamel('#1d3a8c', 0, h * 0.16, w, h * 0.68);
    P.c.fillStyle = '#1fa3a0';
    for (let x = 0; x < w; x += 40) { P.c.beginPath(); P.c.moveTo(x, h * 0.84); P.c.lineTo(x + 20, h * 0.3); P.c.lineTo(x + 40, h * 0.84); P.c.fill(); }
    P.c.fillStyle = '#e1b052'; P.matPath(P.GOLD);
    for (let x = 0; x < w; x += 40) { P.c.fillRect(x + 18, h * 0.18, 4, 6); P.m.fillRect(x + 18, h * 0.18, 4, 6); }
  });
  // Straps: chevron zigzag blue/teal with gold edges (u across strap, v along)
  T.strap = patternPair(128, 512, (P) => {
    const { w, h } = P;
    P.enamel('#1d3a8c', 0, 0, w, h);
    P.c.strokeStyle = '#21b3ad'; P.c.lineWidth = 12;
    for (let y = -40; y < h + 40; y += 44) { P.c.beginPath(); P.c.moveTo(0, y); P.c.lineTo(w / 2, y + 26); P.c.lineTo(w, y); P.c.stroke(); }
    P.c.strokeStyle = '#7a4bd0'; P.c.lineWidth = 4;
    for (let y = -18; y < h + 40; y += 44) { P.c.beginPath(); P.c.moveTo(0, y); P.c.lineTo(w / 2, y + 26); P.c.lineTo(w, y); P.c.stroke(); }
    P.gold(0, 0, w * 0.12, h); P.gold(w * 0.88, 0, w * 0.12, h);
  });
  // Woven gold mesh panel
  T.mesh = patternPair(256, 512, (P) => {
    const { w, h } = P;
    P.gold(0, 0, w, h);
    P.c.strokeStyle = 'rgba(80,50,10,0.55)'; P.c.lineWidth = 2;
    for (let y = 0; y < h; y += 14) { P.c.beginPath(); P.c.moveTo(0, y); P.c.lineTo(w, y); P.c.stroke(); }
    for (let x = 0; x < w; x += 14) { P.c.beginPath(); P.c.moveTo(x, 0); P.c.lineTo(x, h); P.c.stroke(); }
    P.c.fillStyle = 'rgba(255,240,190,0.25)';
    for (let y = 0; y < h; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < w; x += 14) P.c.fillRect(x + 3, y + 3, 6, 6);
  });
  // Crown modius: green enamel with gold zigzag and stripes
  T.crown = patternPair(512, 256, (P) => {
    const { w, h } = P;
    P.enamel('#118a4c', 0, 0, w, h, 0.28);
    P.gold(0, 0, w, h * 0.1); P.gold(0, h * 0.9, w, h * 0.1);
    P.c.fillStyle = '#e1b052'; P.matPath(P.GOLD);
    for (let x = 0; x < w; x += 48) {
      P.c.beginPath(); P.c.moveTo(x, h * 0.9); P.c.lineTo(x + 24, h * 0.42); P.c.lineTo(x + 48, h * 0.9); P.c.closePath(); P.c.fill();
      P.m.beginPath(); P.m.moveTo(x, h * 0.9); P.m.lineTo(x + 24, h * 0.42); P.m.lineTo(x + 48, h * 0.9); P.m.closePath(); P.m.fill();
    }
    P.c.fillStyle = '#16b3a8'; for (let x = 12; x < w; x += 48) P.c.fillRect(x, h * 0.14, 24, h * 0.18);
  });
  // Linen kilt with pleats (u across, v down)
  T.kilt = (() => {
    const W = 512, H = 256;
    const c = paint(W, H, (x, y, o) => {
      const pleat = 0.5 + 0.5 * Math.sin((x / W) * TAU * 22);
      const n = Noise.fbm(x / 32, y / 32, 3, W / 32, H / 32);
      const k = (0.78 + 0.22 * pleat) * (1 + n * 0.1);
      o[0] = clamp(188 * k, 0, 255); o[1] = clamp(150 * k, 0, 255); o[2] = clamp(98 * k, 0, 255);
    });
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8aa4e'; ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = '#1d3a8c'; ctx.fillRect(0, H - 22, W, 6);
    const bump = paint(W, H, (x, y, o) => { const pleat = 0.5 + 0.5 * Math.sin((x / W) * TAU * 22); o[0] = o[1] = o[2] = 90 + pleat * 140; });
    return { map: toTex(c), bump: toTex(bump, { srgb: false }) };
  })();
  // Green enamel kilt panel with gold trim
  T.kiltGreen = patternPair(256, 512, (P) => {
    const { w, h } = P;
    P.enamel('#13804a', 0, 0, w, h, 0.4);
    P.gold(0, 0, w, 18); P.gold(0, h - 26, w, 26); P.gold(0, 0, 14, h); P.gold(w - 14, 0, 14, h);
    P.c.fillStyle = '#1d3a8c'; P.c.fillRect(14, h - 40, w - 28, 12);
    P.c.strokeStyle = 'rgba(225,176,82,0.85)'; P.c.lineWidth = 6;
    P.c.beginPath(); P.c.moveTo(w / 2, 40); P.c.lineTo(w / 2, h - 60); P.c.stroke();
  });
  // Front apron: green field, gold frame, scrolls
  T.apron = patternPair(256, 512, (P) => {
    const { w, h } = P;
    P.gold(0, 0, w, h);
    P.enamel('#13804a', 22, 22, w - 44, h - 44, 0.3);
    P.enamel('#1d3a8c', 40, 40, w - 80, 70, 0.3);
    const c = P.c, m = P.m;
    c.strokeStyle = '#e1b052'; c.lineWidth = 10; m.strokeStyle = 'rgb(0,77,255)'; m.lineWidth = 10;
    const scroll = (ctx, x, y, s, dir) => { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 1.4; const rr = s * (1 - i / 48); ctx.lineTo(x + Math.cos(a) * rr * dir, y + Math.sin(a) * rr); } ctx.stroke(); };
    for (const ctx of [c, m]) {
      scroll(ctx, w * 0.32, h * 0.38, 46, 1); scroll(ctx, w * 0.68, h * 0.38, 46, -1);
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.3); ctx.lineTo(w / 2, h * 0.92); ctx.stroke();
      scroll(ctx, w * 0.35, h * 0.7, 36, 1); scroll(ctx, w * 0.65, h * 0.7, 36, -1);
    }
  });
  // Bracer: green with gold trim & purple/blue stripes (u around, v along)
  T.bracer = patternPair(512, 256, (P) => {
    const { w, h } = P;
    P.enamel('#13804a', 0, 0, w, h, 0.35);
    P.gold(0, 0, w, 28); P.gold(0, h - 28, w, 28);
    P.enamel('#5b3fb5', 0, 30, w, 10); P.enamel('#1d3a8c', 0, h - 40, w, 10);
    P.c.strokeStyle = '#e1b052'; P.c.lineWidth = 6; P.m.strokeStyle = 'rgb(0,77,255)'; P.m.lineWidth = 6;
    for (let x = 0; x < w; x += 64) for (const ctx of [P.c, P.m]) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x + 32, h / 2); ctx.lineTo(x, h - 50); ctx.stroke(); }
  });
  // Gold cuff with stripes
  T.cuff = patternPair(512, 128, (P) => {
    const { w, h } = P;
    P.gold(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { P.enamel(x % 64 ? '#1d3a8c' : '#13a05a', x + 4, h * 0.32, 24, h * 0.36, 0.3); }
  });
  // Skin
  T.skin = (() => {
    const S = 512;
    const c = paint(S, S, (x, y, o) => {
      const n = Noise.fbm(x / 48, y / 48, 4, S / 48 | 0, S / 48 | 0);
      const d = Noise.perlin(x / 6, y / 6, S / 6 | 0, S / 6 | 0);
      const k = 1 + n * 0.12 + d * 0.03;
      o[0] = clamp(96 * k, 0, 255); o[1] = clamp(66 * k, 0, 255); o[2] = clamp(74 * k + n * 8, 0, 255);
    });
    const b = paint(S, S, (x, y, o) => { const d = Noise.perlin(x / 3, y / 3, S / 3 | 0, S / 3 | 0); o[0] = o[1] = o[2] = 128 + d * 60; });
    return { map: toTex(c, { repeat: true }), bump: toTex(b, { srgb: false, repeat: true }) };
  })();
  // Feathers: overlapping scales, navy with blue tips
  T.feather = (() => {
    const W = 512, H = 512, cw = 32, ch = 28;
    const draw = (bumpMode) => {
      const c = cnv(W, H), ctx = c.getContext('2d');
      ctx.fillStyle = bumpMode ? '#202020' : '#0d1226'; ctx.fillRect(0, 0, W, H);
      for (let row = -1; row < H / ch + 2; row++) {
        for (let col = -1; col < W / cw + 2; col++) {
          const x = col * cw + (row % 2) * cw / 2, y = row * ch;
          const g = ctx.createLinearGradient(x, y - ch, x, y + ch * 0.6);
          if (bumpMode) { g.addColorStop(0, '#303030'); g.addColorStop(1, '#f0f0f0'); }
          else { g.addColorStop(0, '#0b1023'); g.addColorStop(0.65, '#16204a'); g.addColorStop(1, '#2d58b8'); }
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(x, y, cw * 0.62, ch * 0.95, 0, 0, Math.PI); ctx.lineTo(x - cw * 0.62, y - ch); ctx.lineTo(x + cw * 0.62, y - ch); ctx.fill();
          if (!bumpMode) { ctx.strokeStyle = 'rgba(120,170,255,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - ch * 0.6); ctx.lineTo(x, y + ch * 0.8); ctx.stroke(); }
        }
      }
      return c;
    };
    return { map: toTex(draw(false), { repeat: true }), bump: toTex(draw(true), { srgb: false, repeat: true }) };
  })();
  // Linen bandage wraps (diagonal)
  T.bandage = (() => {
    const W = 256, H = 512;
    const stripe = (x, y) => { const t = (y + x * 0.55) / 34; return t - Math.floor(t); };
    const c = paint(W, H, (x, y, o) => {
      const s = stripe(x, y);
      const n = Noise.fbm(x / 20, y / 20, 3, W / 20 | 0, H / 20 | 0);
      const edge = Math.min(s, 1 - s);
      const k = (0.72 + 0.28 * smoothstep(0, 0.22, edge)) * (1 + n * 0.12);
      o[0] = clamp(178 * k, 0, 255); o[1] = clamp(146 * k, 0, 255); o[2] = clamp(104 * k, 0, 255);
    });
    const b = paint(W, H, (x, y, o) => { const s = stripe(x, y); const edge = Math.min(s, 1 - s); o[0] = o[1] = o[2] = 60 + 190 * smoothstep(0, 0.25, edge); });
    return { map: toTex(c, { repeat: true }), bump: toTex(b, { srgb: false, repeat: true }) };
  })();
  // Book cover: ornate gold-bronze leather
  T.cover = (() => {
    const W = 512, H = 640;
    const c = paint(W, H, (x, y, o) => {
      const n = Noise.fbm(x / 40, y / 40, 4, W / 40 | 0, H / 40 | 0);
      const k = 1 + n * 0.25;
      o[0] = clamp(150 * k, 0, 255); o[1] = clamp(108 * k, 0, 255); o[2] = clamp(46 * k, 0, 255);
    });
    const ctx = c.getContext('2d');
    const b = cnv(W, H), bx = b.getContext('2d'); bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, H);
    for (const [g, col] of [[ctx, '#e6b85a'], [bx, '#e0e0e0']]) {
      g.strokeStyle = col; g.lineWidth = 14; g.strokeRect(22, 22, W - 44, H - 44);
      g.lineWidth = 5; g.strokeRect(48, 48, W - 96, H - 96);
      g.lineWidth = 4;
      for (let i = 0; i < 10; i++) { const y = 70 + i * (H - 140) / 9; g.beginPath(); g.arc(34, y, 6, 0, TAU); g.stroke(); g.beginPath(); g.arc(W - 34, y, 6, 0, TAU); g.stroke(); }
      // rays behind the scarab
      g.lineWidth = 3;
      for (let i = 0; i < 18; i++) { const a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 17); g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * 80, H * 0.5 + Math.sin(a) * 80); g.lineTo(W / 2 + Math.cos(a) * 190, H * 0.5 + Math.sin(a) * 190); g.stroke(); }
    }
    return { map: toTex(c), bump: toTex(b, { srgb: false }) };
  })();
  // Pages with hieroglyph columns + glow version
  T.page = (() => {
    const W = 512, H = 640;
    const c = paint(W, H, (x, y, o) => {
      const n = Noise.fbm(x / 50, y / 50, 4, W / 50 | 0, H / 50 | 0);
      const vign = 1 - 0.25 * Math.pow(Math.max(Math.abs(x / W - 0.5), Math.abs(y / H - 0.5)) * 2, 3);
      const k = (1 + n * 0.1) * vign;
      o[0] = clamp(238 * k, 0, 255); o[1] = clamp(220 * k, 0, 255); o[2] = clamp(176 * k, 0, 255);
    });
    const ctx = c.getContext('2d');
    const g = cnv(W, H), gx = g.getContext('2d'); gx.fillStyle = '#000'; gx.fillRect(0, 0, W, H);
    const keys = Object.keys(GLYPH);
    const r = mulberry32(21);
    ctx.strokeStyle = 'rgba(120,70,30,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(30, 30, W - 60, H - 60);
    for (let x = 62; x < W - 40; x += 58) {
      ctx.fillStyle = 'rgba(120,70,30,0.35)'; ctx.fillRect(x + 27, 40, 1.5, H - 80);
      for (let y = 66; y < H - 50; y += 50) {
        const k = keys[Math.floor(r() * keys.length)];
        drawGlyph(ctx, k, x, y, 40, Math.random() < 0.15 ? '#a3341e' : '#3a2412');
        drawGlyph(gx, k, x, y, 40, '#ffffff');
      }
    }
    return { map: toTex(c), glow: toTex(g) };
  })();
  // Gilded page edges
  T.pageEdge = (() => {
    const c = paint(64, 256, (x, y, o) => {
      const l = 0.75 + 0.25 * Math.sin(x * 2.2 + Math.sin(y * 0.1));
      o[0] = clamp(226 * l, 0, 255); o[1] = clamp(120 * l, 0, 255); o[2] = clamp(40 * l, 0, 255);
    });
    return toTex(c);
  })();
  // Ushabti faience (lathe UV: u around with back at 0/1, front at 0.5; v up)
  T.ushabti = (() => {
    const W = 512, H = 1024;
    const c = paint(W, H, (x, y, o) => {
      const n = Noise.fbm(x / 40, y / 40, 4, W / 40 | 0, H / 40 | 0);
      const k = 1 + n * 0.18;
      o[0] = clamp(48 * k, 0, 255); o[1] = clamp(170 * k, 0, 255); o[2] = clamp(160 * k, 0, 255);
    });
    const ctx = c.getContext('2d');
    const ink = '#0d1b22';
    // canvas y=0 is top of figure
    const vy = (v) => (1 - v) * H;
    // wig stripes (sides and back), face window at front
    ctx.fillStyle = ink;
    for (let v = 0.8; v < 0.975; v += 0.02) {
      ctx.fillRect(0, vy(v), W * 0.4, 5); ctx.fillRect(W * 0.6, vy(v), W * 0.4, 5);
    }
    // face
    ctx.fillStyle = '#15a39a'; ctx.fillRect(W * 0.41, vy(0.94), W * 0.18, vy(0.82) - vy(0.94));
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(W * 0.465, vy(0.885), 9, 5, 0, 0, TAU); ctx.ellipse(W * 0.535, vy(0.885), 9, 5, 0, 0, TAU); ctx.fill();
    ctx.fillRect(W * 0.445, vy(0.9), 28, 3); ctx.fillRect(W * 0.515, vy(0.9), 28, 3);
    ctx.fillRect(W * 0.49, vy(0.865), 10, 16);
    // collar bands
    const bands = ['#0d1b22', '#e7c45a', '#0d1b22', '#c2532e', '#0d1b22'];
    bands.forEach((b, i) => { ctx.fillStyle = b; ctx.fillRect(0, vy(0.78 - i * 0.012), W, 7); });
    // glyph column on legs front
    ctx.strokeStyle = ink; ctx.lineWidth = 3;
    ctx.strokeRect(W * 0.44, vy(0.62), W * 0.12, vy(0.12) - vy(0.62));
    let gy = vy(0.6) + 26;
    const keys = ['ankh', 'ibis', 'eye', 'sun', 'water', 'djed', 'reed', 'netjer'];
    for (let i = 0; i < 9 && gy < vy(0.14); i++) { drawGlyph(ctx, keys[i % keys.length], W * 0.5, gy, 34, ink); gy += 46; }
    // horizontal text bands around the legs
    for (let v = 0.2; v < 0.6; v += 0.1) { ctx.fillStyle = ink; ctx.fillRect(0, vy(v), W * 0.42, 3); ctx.fillRect(W * 0.58, vy(v), W * 0.42, 3); }
    return toTex(c);
  })();
  // Nemes-like lappets: horizontal gold / lapis stripes
  T.lappet = patternPair(128, 512, (P) => {
    const { w, h } = P;
    for (let y = 0, i = 0; y < h; y += 32, i++) { if (i % 2) P.enamel('#1d3a8c', 0, y, w, 32); else P.gold(0, y, w, 32); }
    P.gold(0, 0, 8, h); P.gold(w - 8, 0, 8, h);
  });
  // Gold scales for the hip guards
  T.scales = patternPair(256, 256, (P) => {
    const { w, h } = P;
    P.gold(0, 0, w, h);
    P.c.strokeStyle = 'rgba(70,40,5,0.75)'; P.c.lineWidth = 3;
    for (let row = 0; row < 12; row++) for (let col = -1; col < 12; col++) {
      const x = col * 24 + (row % 2) * 12, y = row * 22;
      P.c.beginPath(); P.c.arc(x, y, 13, 0.1, Math.PI - 0.1); P.c.stroke();
    }
  });
  // Ibis skull: feathers flowing back/down, teal bare-skin patches around the eyes (SphereGeometry UVs)
  T.skull = (() => {
    const W = 1024, H = 512;
    const eyeUV = [[0.407, 0.557], [0.093, 0.557]];
    const draw = (bumpMode) => {
      const c = cnv(W, H), ctx = c.getContext('2d');
      ctx.fillStyle = bumpMode ? '#202020' : '#0c1124'; ctx.fillRect(0, 0, W, H);
      const cw = 22, chh = 20;
      for (let row = -1; row < H / chh + 2; row++) for (let col = -1; col < W / cw + 2; col++) {
        const x = col * cw + (row % 2) * cw / 2, y = row * chh;
        const g = ctx.createLinearGradient(x, y - chh, x, y + chh * 0.6);
        if (bumpMode) { g.addColorStop(0, '#303030'); g.addColorStop(1, '#e8e8e8'); }
        else { g.addColorStop(0, '#0a0f20'); g.addColorStop(0.7, '#141d44'); g.addColorStop(1, '#2a52ad'); }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, cw * 0.62, chh * 0.95, 0, 0, Math.PI); ctx.lineTo(x - cw * 0.62, y - chh); ctx.lineTo(x + cw * 0.62, y - chh); ctx.fill();
      }
      for (const [u, v] of eyeUV) {
        const x = u * W, y = (1 - v) * H;
        const g = ctx.createRadialGradient(x, y, 4, x, y, 64);
        if (bumpMode) { g.addColorStop(0, 'rgba(128,128,128,1)'); g.addColorStop(1, 'rgba(128,128,128,0)'); }
        else { g.addColorStop(0, 'rgba(40,190,200,1)'); g.addColorStop(0.45, 'rgba(26,140,170,0.9)'); g.addColorStop(1, 'rgba(20,60,140,0)'); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 70, 46, 0, 0, TAU); ctx.fill();
      }
      return c;
    };
    return { map: toTex(draw(false)), bump: toTex(draw(true), { srgb: false }) };
  })();
  // Obsidian with gold veins for the jackal sentinel
  T.obsidian = (() => {
    const S = 512;
    const c = paint(S, S, (x, y, o) => {
      const n = Noise.fbm(x / 64, y / 64, 5, S / 64, S / 64);
      const vein = Math.abs(Noise.perlin(x / 90 + n * 1.5, y / 90, S / 90 | 0, S / 90 | 0));
      const g = smoothstep(0.035, 0.0, vein);
      o[0] = clamp(lerp(22 + n * 10, 230, g), 0, 255); o[1] = clamp(lerp(20 + n * 10, 170, g), 0, 255); o[2] = clamp(lerp(30 + n * 14, 70, g), 0, 255);
    });
    return toTex(c, { repeat: true });
  })();
  return T;
}

// ---------------------------------------------------------------------------
// VFX textures
// ---------------------------------------------------------------------------
const GLYPH_ATLAS_KEYS = ['ibis', 'ibis2', 'thoth', 'eye', 'ankh', 'scarab', 'sun', 'water', 'mouth', 'djed', 'heart', 'nfr',
  'viper', 'owl', 'cobra', 'feather', 'netjer', 'reed', 'bread', 'arm', 'foot', 'quail', 'lion', 'seated',
  'walk', 'cloth', 'falcon', 'vulture', 'wadjet', 'sun', 'ankh', 'eye'];
function makeGlyphAtlas() {
  const cell = 128, cols = 8, rows = 4;
  const c = cnv(cell * cols, cell * rows), ctx = c.getContext('2d');
  GLYPH_ATLAS_KEYS.forEach((k, i) => {
    const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2;
    ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 10;
    drawGlyph(ctx, k, x, y, cell * 0.74, '#ffffff'); ctx.restore();
    drawGlyph(ctx, k, x, y, cell * 0.74, '#ffffff');
  });
  const t = toTex(c, { srgb: true });
  t.userData = { cols, rows };
  return t;
}
// Particle sprite atlas, 4x4 cells
const FX = { dot: 0, core: 1, streak: 2, star: 3, ring: 4, smoke: 5, rune: 6, feather: 7, shard: 8, ember: 9, crescent: 10, eye: 11, flare: 12, spark: 13, petal: 14, glyphring: 15 };
function makeFxAtlas() {
  const cell = 128, N = 4;
  const c = cnv(cell * N, cell * N), ctx = c.getContext('2d');
  const at = (i) => [(i % N) * cell + cell / 2, Math.floor(i / N) * cell + cell / 2];
  const radial = (i, stops, r = cell / 2) => { const [x, y] = at(i); const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, col]) => g.addColorStop(o, col)); ctx.fillStyle = g; ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell); };
  radial(FX.dot, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  radial(FX.core, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  { const [x, y] = at(FX.streak); const g = ctx.createLinearGradient(x - 60, y, x + 60, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 60, 7, 0, 0, TAU); ctx.fill(); }
  { const [x, y] = at(FX.star); ctx.save(); ctx.translate(x, y); radial(FX.star, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.6)'], [0.4, 'rgba(255,255,255,0)']]);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(60, 0); ctx.lineTo(0, 4); ctx.fill(); } ctx.restore(); }
  { const [x, y] = at(FX.ring); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0; }
  { const [x, y] = at(FX.smoke);
    for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, rr = Math.random() * 26; const g = ctx.createRadialGradient(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 34); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 64, y - 64, 128, 128); } }
  { const [x, y] = at(FX.rune); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 38, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 38, y + Math.sin(a) * 38); ctx.lineTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50); ctx.stroke(); }
    drawGlyph(ctx, 'eye', x, y, 52, '#fff'); }
  { const [x, y] = at(FX.feather); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 50, y + 6); ctx.quadraticCurveTo(x, y - 30, x + 52, y - 4); ctx.quadraticCurveTo(x + 4, y + 22, x - 50, y + 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 50, y + 6); ctx.lineTo(x + 50, y - 3); ctx.stroke(); }
  { const [x, y] = at(FX.shard); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 30, y + 40); ctx.lineTo(x - 8, y - 50); ctx.lineTo(x + 36, y + 10); ctx.closePath(); ctx.fill(); }
  radial(FX.ember, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.3)'], [0.6, 'rgba(255,255,255,0)']]);
  { const [x, y] = at(FX.crescent); ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 48, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x + 20, y - 14, 44, 0, TAU); ctx.fill(); ctx.restore(); }
  { const [x, y] = at(FX.eye); ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; drawGlyph(ctx, 'eye', x, y, 104, '#fff'); ctx.restore(); }
  { const [x, y] = at(FX.flare); radial(FX.flare, [[0, 'rgba(255,255,255,1)'], [0.08, 'rgba(255,255,255,0.8)'], [0.25, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, 62, 3, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y, 3, 40, 0, 0, TAU); ctx.fill(); }
  { const [x, y] = at(FX.spark); const g = ctx.createLinearGradient(x - 50, y, x + 50, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 50, 4, 0, 0, TAU); ctx.fill(); }
  { const [x, y] = at(FX.petal); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, 20, 46, 0.3, 0, TAU); ctx.fill(); }
  { const [x, y] = at(FX.glyphring); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 56, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.stroke();
    const ks = ['ankh', 'eye', 'ibis', 'sun', 'djed', 'feather']; ks.forEach((k, i) => { const a = i / ks.length * TAU; drawGlyph(ctx, k, x + Math.cos(a) * 43, y + Math.sin(a) * 43, 20, '#fff'); }); }
  const t = toTex(c);
  t.userData = { cols: N, rows: N };
  return t;
}
// Glyph of Pain column: ibis, heart, viper stacked (white line glyphs with glow)
function makeWallGlyphTexture() {
  const W = 256, H = 768;
  const c = cnv(W, H), ctx = c.getContext('2d');
  ['ibis', 'heart', 'viper'].forEach((k, i) => {
    const y = 128 + i * 256;
    ctx.save(); ctx.shadowColor = 'rgba(160,220,255,1)'; ctx.shadowBlur = 18; drawGlyph(ctx, k, W / 2, y, 200, '#e8f6ff'); ctx.restore();
    drawGlyph(ctx, k, W / 2, y, 200, '#ffffff');
  });
  return toTex(c);
}
// Final Judgement "large glyph": crescent moon cradling a disc with the eye
function makeJudgementGlyph() {
  const S = 512, c = cnv(S), ctx = c.getContext('2d');
  const x = S / 2, y = S / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(255,230,160,1)'; ctx.shadowBlur = 24;
  ctx.strokeStyle = '#ffe3a0'; ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y + 30, 170, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
  ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(x, y + 30, 132, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(150,220,255,1)'; ctx.shadowBlur = 26;
  ctx.strokeStyle = '#cfefff'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(x, y - 10, 104, 0, TAU); ctx.stroke();
  drawGlyph(ctx, 'eye', x, y - 12, 150, '#ffffff');
  ctx.restore();
  // little rays
  ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 5;
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 124, y - 10 + Math.sin(a) * 124); ctx.lineTo(x + Math.cos(a) * 146, y - 10 + Math.sin(a) * 146); ctx.stroke(); }
  return toTex(c);
}
// Magic circle for ground decals
function makeRuneCircle() {
  const S = 1024, c = cnv(S), ctx = c.getContext('2d');
  const x = S / 2, y = S / 2;
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
  ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(x, y, 480, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 455, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 345, 0, TAU); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, 320, 0, TAU); ctx.stroke();
  const keys = Object.keys(GLYPH);
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    ctx.save(); ctx.translate(x + Math.cos(a) * 400, y + Math.sin(a) * 400); ctx.rotate(a + Math.PI / 2);
    drawGlyph(ctx, keys[(i * 5) % keys.length], 0, 0, 74, '#fff'); ctx.restore();
  }
  // inner triangle + crescent
  ctx.lineWidth = 6; ctx.beginPath();
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i / 3 * TAU; ctx.lineTo(x + Math.cos(a) * 310, y + Math.sin(a) * 310); }
  ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 150, 0, TAU); ctx.stroke();
  drawGlyph(ctx, 'eye', x, y, 190, '#fff');
  for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; ctx.lineWidth = i % 6 ? 2 : 5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 455, y + Math.sin(a) * 455); ctx.lineTo(x + Math.cos(a) * (i % 6 ? 440 : 425), y + Math.sin(a) * (i % 6 ? 440 : 425)); ctx.stroke(); }
  return toTex(c);
}
// Sand for the dunes
function makeSandTexture() {
  const S = 512;
  const c = paint(S, S, (x, y, o) => {
    const n = Noise.fbm(x / 64, y / 64, 4, S / 64, S / 64);
    const rip = 0.5 + 0.5 * Math.sin((y + n * 40) * 0.25);
    const k = 1 + n * 0.12 + rip * 0.05;
    o[0] = clamp(190 * k, 0, 255); o[1] = clamp(152 * k, 0, 255); o[2] = clamp(104 * k, 0, 255);
  });
  return toTex(c, { repeat: true });
}
// Tileable water normal map
function makeWaterNormals() {
  const S = 256;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = Noise.fbm(x / 32, y / 32, 4, 8, 8);
  const c = paint(S, S, (x, y, o) => {
    const hx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const hy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    const nx = -hx * 3, ny = -hy * 3, nz = 1; const l = Math.hypot(nx, ny, nz);
    o[0] = (nx / l * 0.5 + 0.5) * 255; o[1] = (ny / l * 0.5 + 0.5) * 255; o[2] = (nz / l * 0.5 + 0.5) * 255;
  });
  return toTex(c, { srgb: false, repeat: true });
}


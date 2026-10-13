// ============================================================================
// GodFX: the shared magic of the new gods - ice, frost and aurora (Skadi), gold, claws and sand
// (Bastet), witchfire, moons, portals and ghosts (Hecate), sunlight, beams and the eclipse (Ra) -
// plus spectral beasts that run on a procedural gait, ice blocks and status markers on targets.
// ============================================================================
const GCOL = {
  ice: new THREE.Color(0.45, 0.85, 1.0), iceHot: new THREE.Color(0.85, 0.97, 1.0), frost: new THREE.Color(0.7, 0.88, 1.0), glacier: new THREE.Color(0.18, 0.5, 1.0),
  aurora: new THREE.Color(0.25, 1.0, 0.65), aurora2: new THREE.Color(0.35, 0.6, 1.0), aurora3: new THREE.Color(0.75, 0.4, 1.0),
  gold: new THREE.Color(1.0, 0.75, 0.28), goldHot: new THREE.Color(1.0, 0.93, 0.62), emerald: new THREE.Color(0.2, 1.0, 0.55), sand: new THREE.Color(0.85, 0.66, 0.38), blood: new THREE.Color(1.0, 0.18, 0.12),
  witch: new THREE.Color(0.58, 0.3, 1.0), witchHot: new THREE.Color(0.86, 0.72, 1.0), hex: new THREE.Color(0.35, 1.0, 0.45), soul: new THREE.Color(0.55, 1.0, 0.85), moon: new THREE.Color(0.85, 0.9, 1.0),
  sun: new THREE.Color(1.0, 0.62, 0.18), sunHot: new THREE.Color(1.0, 0.92, 0.6), solar: new THREE.Color(1.0, 0.4, 0.08), dawn: new THREE.Color(1.0, 0.82, 0.45),
};
const GX = { snow: 0, shard: 1, claw: 2, cateye: 3, paw: 4, crescent: 5, fullmoon: 6, skull: 7, key: 8, triskele: 9, sunrays: 10, wedjat: 11, rune: 12, flame: 13, ghost: 14, star: 15 };

// ---------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------
function makeGodAtlas() {
  const cell = 128, N = 4, c = cnv(cell * N, cell * N), ctx = c.getContext('2d');
  const at = (i) => [(i % N) * cell + cell / 2, Math.floor(i / N) * cell + cell / 2];
  const glow = (fn, blur = 10) => { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = blur; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; fn(); ctx.restore(); };
  // snowflake
  { const [x, y] = at(GX.snow); glow(() => { ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 48, y + Math.sin(a) * 48); ctx.stroke();
    for (const r of [22, 34]) { const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + s * 0.8) * 13, by + Math.sin(a + s * 0.8) * 13); ctx.stroke(); } } } }); }
  // ice shard
  { const [x, y] = at(GX.shard); glow(() => { ctx.beginPath(); ctx.moveTo(x, y - 58); ctx.lineTo(x + 14, y - 6); ctx.lineTo(x + 6, y + 52); ctx.lineTo(x - 9, y + 30); ctx.lineTo(x - 16, y - 10); ctx.closePath(); ctx.fill(); }, 6); }
  // three claw slashes
  { const [x, y] = at(GX.claw); glow(() => { for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x - 44 + k * 6, y - 50 + k * 22); ctx.quadraticCurveTo(x + k * 18, y - 8 + k * 6, x + 48 + k * 6, y + 30 + k * 18); ctx.quadraticCurveTo(x + k * 16, y + 4 + k * 8, x - 44 + k * 6, y - 50 + k * 22); ctx.fill(); ctx.lineWidth = 4; ctx.stroke(); } }, 8); }
  // cat eye (slit pupil)
  { const [x, y] = at(GX.cateye); glow(() => { ctx.beginPath(); ctx.ellipse(x, y, 54, 30, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.ellipse(x, y, 6, 26, 0, 0, TAU); ctx.fill(); }, 8); }
  // paw print
  { const [x, y] = at(GX.paw); glow(() => { ctx.beginPath(); ctx.ellipse(x, y + 16, 24, 20, 0, 0, TAU); ctx.fill(); for (const [dx, dy] of [[-26, -12], [-9, -30], [9, -30], [26, -12]]) { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 9, 12, dx * 0.02, 0, TAU); ctx.fill(); } }, 6); }
  // crescent + full moon
  { const [x, y] = at(GX.crescent); glow(() => { ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x + 22, y - 10, 46, 0, TAU); ctx.fill(); }, 12); }
  { const [x, y] = at(GX.fullmoon); const g = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 52); g.addColorStop(0, '#fff'); g.addColorStop(0.85, 'rgba(235,240,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 52, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(150,160,190,0.35)'; for (const [dx, dy, r] of [[-14, -8, 10], [16, 12, 13], [6, -22, 6], [-20, 18, 7]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); } }
  // skull
  { const [x, y] = at(GX.skull); glow(() => { ctx.beginPath(); ctx.arc(x, y - 8, 40, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(x + 26, y + 38); ctx.lineTo(x - 26, y + 38); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * 16, y, 11, 13, 0, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x - 6, y + 24); ctx.lineTo(x + 6, y + 24); ctx.fill(); for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 9 - 2, y + 30, 4, 10); }, 10); }
  // key
  { const [x, y] = at(GX.key); glow(() => { ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x - 26, y, 18, 0, TAU); ctx.stroke(); ctx.fillRect(x - 8, y - 4, 60, 8); ctx.fillRect(x + 34, y, 8, 18); ctx.fillRect(x + 46, y, 6, 12); }, 8); }
  // triskele / crossroads (three roads meeting)
  { const [x, y] = at(GX.triskele); glow(() => { ctx.lineWidth = 7; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i / 3 * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 48, y + Math.sin(a) * 48); ctx.stroke(); ctx.beginPath(); ctx.arc(x + Math.cos(a) * 28, y + Math.sin(a) * 28, 12, a, a + Math.PI * 1.2); ctx.stroke(); } ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); }, 10); }
  // sun with rays
  { const [x, y] = at(GX.sunrays); glow(() => { ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 0.06) * 26, y + Math.sin(a - 0.06) * 26); ctx.lineTo(x + Math.cos(a) * (i % 2 ? 46 : 58), y + Math.sin(a) * (i % 2 ? 46 : 58)); ctx.lineTo(x + Math.cos(a + 0.06) * 26, y + Math.sin(a + 0.06) * 26); ctx.fill(); } }, 14); }
  // wedjat (Eye of Ra)
  { const [x, y] = at(GX.wedjat); ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; drawGlyph(ctx, 'eye', x, y, 108, '#fff'); ctx.restore(); }
  // norse rune (algiz, the elk / protection rune)
  { const [x, y] = at(GX.rune); glow(() => { ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 50); ctx.lineTo(x, y - 50); ctx.moveTo(x, y - 6); ctx.lineTo(x - 34, y - 44); ctx.moveTo(x, y - 6); ctx.lineTo(x + 34, y - 44); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 58, 0, TAU); ctx.stroke(); }, 12); }
  // flame tongue
  { const [x, y] = at(GX.flame); const g = ctx.createRadialGradient(x, y + 20, 2, x, y + 10, 50); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y - 58); ctx.bezierCurveTo(x + 30, y - 10, x + 40, y + 30, x, y + 50); ctx.bezierCurveTo(x - 40, y + 30, x - 30, y - 10, x, y - 58); ctx.fill(); }
  // ghost: a hooded wail
  { const [x, y] = at(GX.ghost); const g = ctx.createLinearGradient(0, y - 50, 0, y + 58); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - 18, 30, Math.PI, 0); ctx.bezierCurveTo(x + 34, y + 20, x + 20, y + 40, x + 12, y + 60); ctx.lineTo(x, y + 44); ctx.lineTo(x - 12, y + 60); ctx.bezierCurveTo(x - 20, y + 40, x - 34, y + 20, x - 30, y - 18); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * 11, y - 18, 6, 9, 0, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.ellipse(x, y + 4, 7, 12, 0, 0, TAU); ctx.fill(); }
  // 8-point star
  { const [x, y] = at(GX.star); glow(() => { ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? 12 : (i % 4 ? 36 : 58); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }, 12); }
  const t = toTex(c); t.userData = { cols: N, rows: N };
  return t;
}
// ground sigils (white on transparent, tinted by the material)
function makeSigil(kind, S = 1024) {
  const c = cnv(S), ctx = c.getContext('2d'), x = S / 2, y = S / 2, R = S * 0.47;
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ring = (r, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
  const rnd = mulberry32(kind.length * 977 + 13);
  if (kind === 'norse') {        // Skadi: a ring of runes, crossed spears and a wolf's eye
    ring(R, 12); ring(R * 0.93, 4); ring(R * 0.68, 6); ring(R * 0.62, 3);
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    ctx.font = `bold ${S * 0.07}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.save(); ctx.translate(x + Math.cos(a) * R * 0.805, y + Math.sin(a) * R * 0.805); ctx.rotate(a + Math.PI / 2); ctx.fillText(runes[i], 0, 0); ctx.restore(); }
    ctx.lineWidth = 8; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.62, y + Math.sin(a) * R * 0.62); ctx.lineTo(x - Math.cos(a) * R * 0.62, y - Math.sin(a) * R * 0.62); ctx.stroke(); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2); ctx.lineTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5); ctx.lineTo(x + Math.cos(a + 0.18) * R * 0.38, y + Math.sin(a + 0.18) * R * 0.38); ctx.stroke(); }
    ring(R * 0.18, 8);
  } else if (kind === 'frost') { // ice crystals branching outward (permafrost / the great freeze)
    ctx.shadowBlur = 6;
    const branch = (bx, by, a, len, w, d) => { if (d > 4 || len < 8) return; const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      const n = 2 + Math.floor(rnd() * 3); for (let k = 1; k <= n; k++) { const t = k / (n + 1), px = bx + (ex - bx) * t, py = by + (ey - by) * t; for (const s of [-1, 1]) branch(px, py, a + s * (0.9 + rnd() * 0.3), len * (0.32 + rnd() * 0.15), w * 0.6, d + 1); } };
    for (let i = 0; i < 9; i++) branch(x, y, i / 9 * TAU + rnd() * 0.3, R * (0.62 + rnd() * 0.3), 7, 0);
    const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.75, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  } else if (kind === 'cat') {   // Bastet: sun disc, sistrum and a ring of paws
    ring(R, 10); ring(R * 0.9, 3); ring(R * 0.55, 6);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU - Math.PI / 2, px = x + Math.cos(a) * R * 0.73, py = y + Math.sin(a) * R * 0.73; ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, 10, 26, 22, 0, 0, TAU); ctx.fill(); for (const [dx, dy] of [[-28, -14], [-10, -34], [10, -34], [28, -14]]) { ctx.beginPath(); ctx.ellipse(dx, dy, 10, 13, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
    drawGlyph(ctx, 'sun', x, y, R * 0.75, '#fff');
  } else if (kind === 'crossroads') { // Hecate: three roads meeting, three moons, keys and the strophalos
    ring(R, 12); ring(R * 0.94, 3); ring(R * 0.42, 5);
    ctx.lineWidth = 26; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i / 3 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.42, y + Math.sin(a) * R * 0.42); ctx.lineTo(x + Math.cos(a) * R * 0.94, y + Math.sin(a) * R * 0.94); ctx.stroke(); }
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + Math.PI / 3 + i / 3 * TAU, mx = x + Math.cos(a) * R * 0.7, my = y + Math.sin(a) * R * 0.7; ctx.beginPath(); ctx.arc(mx, my, R * 0.11, 0, TAU); ctx.fill(); ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(mx + (i - 1) * R * 0.06, my - R * 0.02, R * 0.1, 0, TAU); if (i !== 1) ctx.fill(); ctx.restore(); }
    // strophalos: a serpentine spiral in the centre
    ctx.lineWidth = 7; ctx.beginPath(); for (let k = 0; k < 400; k++) { const t = k / 400, a = t * TAU * 3.2, r = R * 0.38 * (1 - t * 0.85); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke();
    ctx.font = `bold ${S * 0.05}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const greek = 'ΕΚΑΤΗΤΡΙΟΔΙΤΙΣ';
    for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; ctx.save(); ctx.translate(x + Math.cos(a) * R * 0.97, y + Math.sin(a) * R * 0.97); ctx.rotate(a + Math.PI / 2); ctx.fillText(greek[i % greek.length], 0, 0); ctx.restore(); }
  } else if (kind === 'hex') {   // Hecate: a hexagram ward of witchfire
    ring(R, 8); ring(R * 0.84, 3);
    ctx.lineWidth = 7; for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const a = -Math.PI / 2 + k * Math.PI / 3 + i / 3 * TAU; ctx.lineTo(x + Math.cos(a) * R * 0.84, y + Math.sin(a) * R * 0.84); } ctx.stroke(); }
    ring(R * 0.3, 5);
    ctx.font = `bold ${S * 0.06}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const sy = '☽○☾✶✷☽○☾✶✷☽○';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillText(sy[i], x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92); }
  } else if (kind === 'sun') {   // Ra: the solar disc with rays, ankhs and the eye
    ring(R, 12); ring(R * 0.9, 4); ring(R * 0.4, 9);
    for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; ctx.lineWidth = i % 2 ? 5 : 11; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.43, y + Math.sin(a) * R * 0.43); ctx.lineTo(x + Math.cos(a) * R * (i % 2 ? 0.68 : 0.86), y + Math.sin(a) * R * (i % 2 ? 0.68 : 0.86)); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.save(); ctx.translate(x + Math.cos(a) * R * 0.78, y + Math.sin(a) * R * 0.78); ctx.rotate(a + Math.PI / 2); drawGlyph(ctx, 'ankh', 0, 0, R * 0.14, '#fff'); ctx.restore(); }
    drawGlyph(ctx, 'eye', x, y, R * 0.55, '#fff');
  } else if (kind === 'quicksand') {
    ctx.shadowBlur = 4; for (let k = 0; k < 7; k++) { ctx.lineWidth = 10 - k; ctx.beginPath(); for (let i = 0; i < 260; i++) { const t = i / 260, a = t * TAU * 1.6 + k / 7 * TAU, r = R * (1 - t * 0.9); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); }
  } else if (kind === 'claws') { // three huge claw marks torn into the floor
    ctx.shadowBlur = 16;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); const ox = k * S * 0.16; ctx.moveTo(x + ox - S * 0.06, y - R * 0.95); ctx.quadraticCurveTo(x + ox + S * 0.05, y, x + ox - S * 0.02, y + R * 0.95); ctx.quadraticCurveTo(x + ox - S * 0.005, y, x + ox - S * 0.06, y - R * 0.95); ctx.fill(); }
  }
  return toTex(c, { srgb: false });
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------
const _gfxVS = 'varying vec2 vUv; varying float vDepth; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const _noiseGLSL = /* glsl */`
  float gh(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
  float gfbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * gn(p); p *= 2.07; a *= 0.5; } return s; }`;
// a column of light (vertical) or a beam (any axis): bright core, streaming streaks, soft edges
function beamMaterial(color, opts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: color.clone() }, uCore: { value: (opts.core || GCOL.sunHot).clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uScroll: { value: opts.scroll ?? -3 }, uFade: { value: opts.fade ?? 1 }, uGain: { value: opts.gain ?? 1.6 } },
    vertexShader: _gfxVS,
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform vec3 uColor, uCore; uniform float uAlpha, uTime, uScroll, uFade, uGain; varying vec2 vUv; varying float vDepth; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = clamp(abs(dot(vN, vV)), 0.0, 1.0);
        float core = pow(facing, 3.0);
        float s = gfbm(vec2(vUv.x * 10.0, vUv.y * 3.0 + uTime * uScroll));
        float streak = smoothstep(0.45, 0.85, s);
        float ends = smoothstep(0.0, 0.06, vUv.y) * mix(1.0, smoothstep(1.0, 0.75, vUv.y), uFade);
        float a = (0.22 + facing * 0.45 + core * 0.85 + streak * (0.25 + 0.3 * facing)) * ends * uAlpha * smoothstep(0.8, 3.5, vDepth);
        vec3 c = mix(uColor, uCore, core * 0.85);
        gl_FragColor = vec4(c * a * uGain, a);
      }`,
  });
}
// a swirling portal / abyss disc
function vortexMaterial(c1, c2, opts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: opts.normal ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uC1: { value: c1.clone() }, uC2: { value: c2.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uDark: { value: opts.dark ?? 0.0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform vec3 uC1, uC2; uniform float uAlpha, uTime, uDark; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float sw = a + r * 7.0 - uTime * 2.2;
        float arms = 0.5 + 0.5 * sin(sw * 3.0);
        float n = gfbm(vec2(sw * 0.8, r * 4.0 - uTime * 0.6));
        float rim = smoothstep(0.72, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r));
        float body = (arms * 0.6 + n * 0.8) * smoothstep(1.0, 0.2, r);
        vec3 c = mix(uC2, uC1, clamp(body + rim * 1.5, 0.0, 1.0));
        float k = (body * 0.8 + rim * 1.8 + smoothstep(0.35, 0.0, r) * 0.7) * uAlpha;
        // the dark heart of an abyss
        float hole = uDark * smoothstep(0.75, 0.0, r);
        gl_FragColor = vec4(c * k * 0.95, clamp(k + hole, 0.0, 1.0));
      }`,
  });
}
// a fresnel bubble (shields, the blizzard dome)
function bubbleMaterial(color, opts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: color.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uHex: { value: opts.hex ?? 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vDepth; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform vec3 uColor; uniform float uAlpha, uTime, uHex; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vDepth;
      void main() {
        float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.2);
        vec2 q = vec2(atan(vP.z, vP.x) * 6.0, vP.y * 5.0);
        vec2 g = abs(fract(q) - 0.5); float hex = smoothstep(0.42, 0.5, max(g.x, g.y)) * uHex;
        float n = gfbm(q * 0.6 + uTime * 0.4);
        float a = (f * 0.9 + hex * 0.25 + n * 0.12) * uAlpha * smoothstep(0.6, 2.5, vDepth);
        gl_FragColor = vec4(uColor * a * 1.5, a);
      }`,
  });
}
// aurora borealis curtains for the sky
function auroraMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uC1: { value: GCOL.aurora.clone() }, uC2: { value: GCOL.aurora3.clone() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform float uAlpha, uTime; uniform vec3 uC1, uC2; varying vec2 vUv;
      void main() {
        float x = vUv.x * 6.0;
        float fold = gfbm(vec2(x * 0.7 + uTime * 0.05, uTime * 0.08));
        float rays = pow(gn(vec2(x * 14.0 + fold * 6.0, uTime * 0.4)), 2.0);
        float h = vUv.y;
        float base = smoothstep(0.0, 0.1, h) * pow(1.0 - h, 1.6);
        vec3 c = mix(uC1, uC2, smoothstep(0.25, 1.0, h));
        float a = base * (0.35 + rays * 1.1) * (0.6 + 0.4 * fold) * uAlpha * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(c * a * 1.4, a);
      }`,
  });
}

// ---------------------------------------------------------------------------
// spectral beasts: static Tripo meshes made to trot by a vertex-shader gait (diagonal leg pairs swing
// about the hips, the body bobs, the tail sways); solid or ghostly (fresnel, translucent)
// ---------------------------------------------------------------------------
const GAIT_VS = /* glsl */`
  uniform float uPhase, uGait, uLeap, uFlap; uniform vec4 uBox; // box: minY, maxY, minZ, maxZ (model space, head at minZ)
  vec3 gaitPos(vec3 p) {
    float H = uBox.y - uBox.x, L = uBox.w - uBox.z;
    float hy = uBox.x + H * 0.46;                                    // hip height
    float zf = uBox.z + L * 0.25, zb = uBox.w - L * 0.3;             // front / back leg columns
    float legK = smoothstep(hy + H * 0.05, hy - H * 0.12, p.y);      // 1 on the legs, 0 on the body
    float side = p.x > 0.0 ? 1.0 : -1.0;
    float front = 1.0 - smoothstep(zf + L * 0.1, zb - L * 0.1, p.z);
    float backK = smoothstep(zb - L * 0.16, zb - L * 0.04, p.z) * (1.0 - smoothstep(zb + L * 0.16, zb + L * 0.24, p.z));
    float isLeg = legK * max(front * (1.0 - smoothstep(zf + L * 0.14, zf + L * 0.24, p.z)), backK);
    float pair = (front > 0.5 ? side : -side);
    float ang = sin(uPhase + (pair > 0.0 ? 0.0 : 3.14159)) * 0.55 * uGait;
    // leap: front legs reach forward, hind legs kick back
    ang += uLeap * (front > 0.5 ? -0.9 : 0.8);
    float pz = front > 0.5 ? zf : zb;
    float dy = p.y - hy, dz = p.z - pz;
    float c = cos(ang * isLeg), s = sin(ang * isLeg);
    p.y = hy + dy * c - dz * s; p.z = pz + dy * s + dz * c;
    // body bob, head nod, tail sway, wing flap
    p.y += abs(sin(uPhase)) * 0.035 * H * uGait * (1.0 - isLeg);
    float head = smoothstep(uBox.z + L * 0.22, uBox.z, p.z);
    p.y += sin(uPhase * 2.0) * 0.02 * H * head * uGait;
    float tail = smoothstep(uBox.w - L * 0.18, uBox.w, p.z) * (1.0 - legK);
    p.x += sin(uPhase * 1.0 + p.z * 4.0) * 0.08 * L * tail * (0.4 + uGait);
    p.y += uFlap * pow(abs(p.x) / max(0.001, H), 1.5) * sin(uPhase) * 0.5;
    return p;
  }`;
function patchGait(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GAIT_VS).replace('#include <begin_vertex>', 'vec3 transformed = gaitPos(vec3(position));');
  };
  mat.customProgramCacheKey = () => 'gait';
}
function ghostBeastMaterial(color, rim, map, uniforms, opts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
    uniforms: Object.assign({ uColor: { value: color.clone() }, uRim: { value: rim.clone() }, uMap: { value: map }, uAlpha: { value: 1 }, uTime: { value: 0 }, uTex: { value: opts.tex ?? 0.45 } }, uniforms),
    vertexShader: GAIT_VS + /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() { vUv = uv; vec3 p = gaitPos(position); vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = p.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform vec3 uColor, uRim; uniform sampler2D uMap; uniform float uAlpha, uTime, uTex; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec3 t = texture2D(uMap, vUv).rgb;
        float lum = dot(t, vec3(0.3, 0.59, 0.11));
        float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.0);
        float n = gfbm(vec2(vUv.x * 30.0, vUv.y * 30.0 - uTime * 1.5));
        vec3 c = uColor * (0.3 + lum * uTex * 1.3) + uRim * f * 0.85 + uRim * n * 0.12;
        float a = (0.32 + f * 0.6 + n * 0.12) * uAlpha;
        gl_FragColor = vec4(c * a, a);
      }`,
  });
}
class SpectralBeast {
  // kind: 'wolf' | 'cat' | 'lioness' | 'falcon'; style: 'solid' | 'ghost'
  constructor(kind, opts = {}) {
    const g = Assets.glb[kind];
    this.kind = kind; this.group = new THREE.Group(); this.alive = true;
    this.phase = rand(0, TAU); this.gait = 0; this.leap = 0; this.flap = kind === 'falcon' ? 1 : 0; this.speed = 0;
    this.uniforms = { uPhase: { value: 0 }, uGait: { value: 0 }, uLeap: { value: 0 }, uFlap: { value: 0 }, uBox: { value: new THREE.Vector4() } };
    this.size = opts.size ?? 1;
    this.mats = [];
    if (g) {
      const m = g.scene.clone(true);
      const box = new THREE.Box3().setFromObject(m);
      this.uniforms.uBox.value.set(box.min.y, box.max.y, box.min.z, box.max.z);
      this.len = box.max.z - box.min.z; this.h = box.max.y - box.min.y;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (opts.style === 'ghost') {
          o.material = ghostBeastMaterial(opts.color || GCOL.ice, opts.rim || GCOL.iceHot, o.material.map, this.uniforms, opts);
          o.renderOrder = 7;
        } else {
          const mat = o.material.clone(); mat.envMapIntensity = 1.2;
          if (opts.tint) mat.color = opts.tint.clone();
          mat.emissive = (opts.rim || GCOL.ice).clone(); mat.emissiveIntensity = opts.glow ?? 0.12;
          patchGait(mat, this.uniforms); o.material = mat; o.castShadow = true;
        }
        this.mats.push(o.material);
      });
      // Tripo beasts face -Z: turn them to face +Z (falcon: body horizontal, head forward, wings out)
      const holder = new THREE.Group(); holder.add(m);
      if (kind === 'falcon') holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(0, -1, 0), V3(0, 0, 1), V3(-1, 0, 0)));
      else holder.rotation.y = Math.PI;
      this.group.add(holder);
    } else {
      const s = glowSprite(VFX.dotTex, opts.color || GCOL.ice, 1.2, 2); this.group.add(s); this.len = 1; this.h = 0.7;
    }
    // glowing eyes
    if (opts.eyes) {
      for (const sx of [-1, 1]) {
        const e = glowSprite(VFX.dotTex, opts.eyes, 0.07, 3); e.position.set(sx * 0.035 * (kind === 'lioness' ? 1.3 : 1), this.h * (kind === 'cat' ? 0.86 : 0.8), this.len * 0.45); e.renderOrder = 8;
        this.group.add(e);
      }
    }
    this.group.scale.setScalar(this.size);
    scene.add(this.group);
  }
  set alpha(a) { for (const m of this.mats) { if (m.uniforms) m.uniforms.uAlpha.value = a; else { m.transparent = a < 1; m.opacity = a; } } }
  update(dt, speed = 0, t = 0) {
    this.speed = speed;
    const stride = this.kind === 'cat' ? 1.0 : this.kind === 'lioness' ? 1.8 : 1.5;
    this.gait = damp(this.gait, clamp(speed / (2.5 * this.size), 0, 1), 6, dt);
    this.phase += dt * (this.kind === 'falcon' ? 9 : clamp(speed / (stride * this.size), 0, 9) * TAU * 0.5 + 0.8 * this.gait);
    this.uniforms.uPhase.value = this.phase; this.uniforms.uGait.value = this.gait; this.uniforms.uLeap.value = this.leap; this.uniforms.uFlap.value = this.flap;
    for (const m of this.mats) if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = t;
  }
  dispose() { this.alive = false; scene.remove(this.group); this.group.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); }); }
}

// ---------------------------------------------------------------------------
// a ghostly afterimage of a god (Bastet's huntresses, Hecate's three faces), frozen in a pose
// ---------------------------------------------------------------------------
function ghostCloneMaterial(color, rim) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: color.clone() }, uRim: { value: rim.clone() }, uAlpha: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vN = normalize(normalMatrix * objectNormal); vV = normalize(-mv.xyz); vY = (modelMatrix * vec4(transformed, 1.0)).y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: _noiseGLSL + /* glsl */`
      uniform vec3 uColor, uRim; uniform float uAlpha, uTime; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 1.8);
        float scan = 0.75 + 0.25 * sin(vY * 40.0 - uTime * 6.0);
        float n = gn(vec2(vY * 8.0 - uTime * 2.0, f * 4.0));
        float a = (0.1 + f * 0.85) * scan * (0.8 + n * 0.4) * uAlpha;
        gl_FragColor = vec4((uColor * 0.55 + uRim * f * 0.6) * a * 0.95, a);
      }`,
  });
}
function ghostClone(rig, color, rim) {
  if (Net.ctx) return Net.ghostClone(rig, color, rim);   // (another player's god: kept copies, posed again; 14n_net.js)
  const clone = SkeletonUtils.clone(rig.model);
  const mat = ghostCloneMaterial(color, rim);
  // copy the current pose bone by bone
  const src = {}; rig.model.traverse((o) => { if (o.isBone) src[o.name] = o; });
  clone.traverse((o) => {
    if (o.isBone && src[o.name]) { o.position.copy(src[o.name].position); o.quaternion.copy(src[o.name].quaternion); }
    if (o.isMesh) { o.material = mat; o.frustumCulled = false; o.renderOrder = 7; o.castShadow = false; }
    if (o.isSprite) o.visible = false;
  });
  const g = new THREE.Group(); g.add(clone);
  g.position.copy(rig.root.position); g.rotation.copy(rig.root.rotation);
  const b = new THREE.Group(); b.position.copy(rig.body.position); clone.removeFromParent(); b.add(clone); g.add(b);
  scene.add(g);
  return { group: g, mat, dispose() { scene.remove(g); mat.dispose(); } };
}

// ---------------------------------------------------------------------------
// summoned models (the scales of Ma'at, Ammit, Apep, the solar barque, Hecate's key): the real
// textured mesh, materialising out of / dissolving into burning motes (a noise + height front with
// a hot edge), a coloured fresnel rim, and optionally the balance beam of the scales tipping
// (beam rotates about its pivot, chains and pans hang straight from the moving beam ends)
// ---------------------------------------------------------------------------
const SUMMON_GLSL = /* glsl */`
  float sh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float sn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  float sfield(vec3 p) { return sn3(p) * 0.6 + sn3(p * 2.3) * 0.3 + sn3(p * 5.1) * 0.1; }`;
function summonMaterial(src, opts = {}) {
  const mat = src.clone();
  const u = {
    uReveal: { value: 0 }, uEdge: { value: (opts.edge || GCOL.gold).clone() }, uRim: { value: (opts.rim || GCOL.gold).clone() }, uRimK: { value: opts.rimK ?? 0.6 },
    uBoxY: { value: new THREE.Vector2(0, 1) }, uNoise: { value: opts.noise ?? 6 }, uDir: { value: opts.dir ?? 0.6 }, uGlow: { value: opts.glow ?? 0 },
    uTip: { value: 0 }, uTipOn: { value: opts.tip ? 1 : 0 }, uSc: { value: new THREE.Vector4(0, 0, 0, 0) }, uBeamHi: { value: 0 }, uBaseTop: { value: -1e9 }, uAxisX: { value: 1 },
  };
  mat.userData.summon = u;
  if (opts.tint) mat.color = opts.tint.clone();
  if (opts.darken !== undefined) mat.color = (mat.color || new THREE.Color(1, 1, 1)).clone().multiplyScalar(opts.darken);
  mat.transparent = false; mat.depthWrite = true;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTip, uTipOn, uBeamHi, uBaseTop, uAxisX; uniform vec4 uSc; varying vec3 vSumP;
        vec3 tipScale(vec3 p) {
          if (uTipOn < 0.5) return p;
          float al = mix(p.z, p.x, uAxisX), s = al < 0.0 ? -1.0 : 1.0;
          if (abs(al) > uSc.z) {
            if (p.y >= uSc.w && p.y <= uBeamHi) { float dy = p.y - uSc.x, c = cos(uTip), sn = sin(uTip); float a2 = al * c - dy * sn; p.y = uSc.x + al * sn + dy * c; al = a2; }
            else if (p.y < uSc.w && p.y > uBaseTop) { p.y += s * uSc.y * sin(uTip); al += s * uSc.y * (cos(uTip) - 1.0); }
          }
          if (uAxisX > 0.5) p.x = al; else p.z = al;
          return p;
        }`)
      .replace('#include <begin_vertex>', 'vec3 transformed = tipScale(vec3(position)); vSumP = transformed;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uReveal, uRimK, uNoise, uDir, uGlow; uniform vec3 uEdge, uRim; uniform vec2 uBoxY; varying vec3 vSumP;
        ${SUMMON_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float sumH = clamp((vSumP.y - uBoxY.x) / max(1e-4, uBoxY.y - uBoxY.x), 0.0, 1.0);
        float sumF = mix(sfield(vSumP * uNoise), 1.0 - sumH, uDir) * 0.92 + sfield(vSumP * uNoise * 3.1) * 0.08;
        if (sumF > uReveal) discard;
        float sumEdge = 1.0 - smoothstep(0.0, 0.07, uReveal - sumF);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float sumRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
        totalEmissiveRadiance += uEdge * sumEdge * 3.0 * step(uReveal, 1.0) + uRim * sumRim * uRimK + uRim * uGlow;`);
  };
  mat.customProgramCacheKey = () => 'summon' + (opts.tip ? 't' : '');
  return mat;
}
// a summoned copy of a loaded model: { group, mats, box, reveal(k), tip(rad), dispose() }
function summonModel(name, opts = {}) {
  const g = Assets.glb[name];
  const group = new THREE.Group(), inner = new THREE.Group(); group.add(inner);
  const mats = [];
  if (!g) return { group, mats, box: new THREE.Box3(), reveal() {}, tip() {}, dispose() {} };
  const m = g.scene.clone(true);
  let mesh0 = null;
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.material = summonMaterial(o.material, opts); o.castShadow = opts.shadow ?? true; o.receiveShadow = false; o.frustumCulled = false;
    // the shader works in the mesh's own (local) coordinates
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    o.material.userData.summon.uBoxY.value.set(o.geometry.boundingBox.min.y, o.geometry.boundingBox.max.y);
    mats.push(o.material); if (!mesh0) mesh0 = o;
  });
  inner.add(m);
  const box = new THREE.Box3().setFromObject(m);
  // fit: a target height (or length) in metres
  const size = box.getSize(new THREE.Vector3());
  const k = opts.height ? opts.height / size.y : opts.length ? opts.length / Math.max(size.x, size.z) : 1;
  inner.scale.setScalar(k);
  scene.add(group);
  const api = {
    group, inner, model: m, mats, box, size, k, mesh: mesh0, lbox: mesh0 ? mesh0.geometry.boundingBox : box,
    reveal(v) { for (const mt of mats) mt.userData.summon.uReveal.value = v; },
    glow(v) { for (const mt of mats) mt.userData.summon.uGlow.value = v; },
    // balance-beam setup in the mesh's local units (see tipScale)
    setupTip(pivotY, armLen, colR, beamLo, beamHi, baseTop, axisX) { for (const mt of mats) { const s = mt.userData.summon; s.uSc.value.set(pivotY, armLen, colR, beamLo); s.uBeamHi.value = beamHi; s.uBaseTop.value = baseTop; s.uAxisX.value = axisX ? 1 : 0; } },
    tip(rad) { for (const mt of mats) mt.userData.summon.uTip.value = rad; },
    dispose() { scene.remove(group); for (const mt of mats) mt.dispose(); },
  };
  return api;
}
// Ma'at's feather (ostrich plume): a curved shaft with soft, slightly ragged barbs
function makeFeatherTexture() {
  const W = 256, H = 512, c = cnv(W, H), ctx = c.getContext('2d');
  const shaft = (t) => [W * 0.5 + Math.sin(t * 2.4) * W * 0.08 * t, H * 0.96 - t * H * 0.9];
  const rnd = mulberry32(5150);
  for (let i = 0; i < 230; i++) {
    const t = 0.08 + (i / 230) * 0.9, [x, y] = shaft(t), side = i % 2 ? 1 : -1;
    const len = W * 0.34 * Math.sin(Math.PI * Math.min(1, t * 1.05)) * (0.8 + rnd() * 0.25);
    const g = ctx.createLinearGradient(x, y, x + side * len, y - len * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.6 + rnd() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + side * len * 0.5, y - len * 0.05, x + side * len, y - len * (0.3 + rnd() * 0.15)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const [x, y] = shaft(i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  return toTex(c);
}
// the heart (ib) as the Egyptians drew it: a vessel with a short neck and two little lugs
function makeHeartGeometry() {
  const pts = [];
  const prof = [[0, -0.5], [0.16, -0.47], [0.3, -0.36], [0.38, -0.18], [0.39, 0.0], [0.34, 0.18], [0.24, 0.3], [0.16, 0.36], [0.15, 0.42], [0.19, 0.47], [0.17, 0.5], [0, 0.5]];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 24);
  const lug = new THREE.TorusGeometry(0.07, 0.025, 6, 12);
  const merged = [g];
  for (const s of [-1, 1]) { const l = lug.clone(); l.rotateY(Math.PI / 2); l.translate(s * 0.3, 0.28, 0); merged.push(l); }
  return mergeGeometries ? mergeGeometries(merged.map((x) => x.toNonIndexed()), false) : g;
}

// ---------------------------------------------------------------------------
// a serpent (Apep): a tube that follows any animated curve (parallel-transport frames, written in
// place every frame), with overlapping scales and molten cracks glowing between them
// ---------------------------------------------------------------------------
function makeScaleTextures() {
  const S = 512, c = cnv(S), ctx = c.getContext('2d'), e = cnv(S), ex = e.getContext('2d');
  ctx.fillStyle = '#0c0612'; ctx.fillRect(0, 0, S, S);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
  const rows = 8, cols = 8, w = S / cols, h = S / rows;
  for (let r = -1; r <= rows; r++) {
    for (let k = -1; k <= cols; k++) {
      const x = k * w + (r % 2 ? w / 2 : 0), y = r * h;
      const g = ctx.createRadialGradient(x, y + h * 0.2, 2, x, y + h * 0.35, w * 0.75);
      g.addColorStop(0, '#5a2a78'); g.addColorStop(0.55, '#2a1238'); g.addColorStop(1, '#08040c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + h * 0.5, w * 0.56, h * 0.82, 0, Math.PI, TAU); ctx.lineTo(x + w * 0.56, y + h * 0.5); ctx.quadraticCurveTo(x, y + h * 1.25, x - w * 0.56, y + h * 0.5); ctx.fill();
      ctx.strokeStyle = 'rgba(160,110,200,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      // molten seams between the scales
      ex.strokeStyle = `rgba(255,${80 + Math.floor(Math.random() * 60)},20,${0.55 + Math.random() * 0.45})`; ex.lineWidth = 3 + Math.random() * 2;
      ex.beginPath(); ex.moveTo(x + w * 0.56, y + h * 0.5); ex.quadraticCurveTo(x, y + h * 1.25, x - w * 0.56, y + h * 0.5); ex.stroke();
    }
  }
  const map = toTex(c), emi = toTex(e);
  for (const t of [map, emi]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return { map, emi };
}
class Serpent {
  constructor(n = 72, radius = 1.0, opts = {}) {
    this.n = n; this.m = opts.radial || 14; this.radius = radius;
    const N = n * (this.m + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.nor = new Float32Array(N * 3);
    const uv = new Float32Array(N * 2), idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j <= this.m; j++) { const k = i * (this.m + 1) + j; uv[k * 2] = j / this.m * 3; uv[k * 2 + 1] = i / (n - 1) * (opts.len || 18); }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < this.m; j++) { const a = i * (this.m + 1) + j, b = a + this.m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    if (!GodFX.scaleTex) GodFX.scaleTex = makeScaleTextures();
    this.mat = new THREE.MeshStandardMaterial({ map: GodFX.scaleTex.map, emissiveMap: GodFX.scaleTex.emi, emissive: (opts.molten || new THREE.Color(1.0, 0.32, 0.06)).clone(), emissiveIntensity: opts.glow ?? 1.4, roughness: 0.42, metalness: 0.35, transparent: true, opacity: 1 });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.taper = opts.taper || ((u) => (0.55 + 0.45 * smoothstep(0, 0.06, u)) * (1 - 0.82 * u));
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._p = new THREE.Vector3();
  }
  // points[0] = head end; scale (0..1) shrinks the whole body (for dissolving)
  setPoints(points, scale = 1) {
    const n = this.n, m = this.m, T = this._t, Nn = this._n, B = this._b;
    let prevN = null;
    for (let i = 0; i < n; i++) {
      const p = points[i], q = points[Math.min(n - 1, i + 1)], o = points[Math.max(0, i - 1)];
      T.copy(q).sub(o); if (T.lengthSq() < 1e-8) T.set(0, 1, 0); T.normalize();
      if (!prevN) { Nn.set(0, 1, 0); if (Math.abs(T.y) > 0.9) Nn.set(1, 0, 0); Nn.addScaledVector(T, -Nn.dot(T)).normalize(); }
      else { Nn.copy(prevN).addScaledVector(T, -prevN.dot(T)); if (Nn.lengthSq() < 1e-8) Nn.set(1, 0, 0); Nn.normalize(); }
      prevN = (prevN || new THREE.Vector3()).copy(Nn);
      B.crossVectors(T, Nn);
      const r = this.radius * this.taper(i / (n - 1)) * scale;
      for (let j = 0; j <= m; j++) {
        const a = (j / m) * TAU, c = Math.cos(a), s = Math.sin(a), k = (i * (m + 1) + j) * 3;
        const nx = Nn.x * c + B.x * s, ny = Nn.y * c + B.y * s, nz = Nn.z * c + B.z * s;
        this.pos[k] = p.x + nx * r; this.pos[k + 1] = p.y + ny * r; this.pos[k + 2] = p.z + nz * r;
        this.nor[k] = nx; this.nor[k + 1] = ny; this.nor[k + 2] = nz;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.normal.needsUpdate = true;
  }
  dispose() { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
// a sweeping crescent blade of light (the Great Cat's knife)
function makeCrescentTexture() {
  const S = 512, c = cnv(S), ctx = c.getContext('2d');
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 24; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(S / 2, S * 0.62, S * 0.44, Math.PI * 1.08, Math.PI * 1.92); ctx.arc(S / 2, S * 0.7, S * 0.4, Math.PI * 1.9, Math.PI * 1.1, true); ctx.closePath(); ctx.fill();
  return toTex(c);
}

// ---------------------------------------------------------------------------
// the GodFX manager
// ---------------------------------------------------------------------------
const GodFX = {
  items: [],
  init() {
    this.atlas = makeGodAtlas();
    this.p = new ParticleSystem(2500, this.atlas, 4, 4, true);
    this.sig = {};
    for (const k of ['norse', 'frost', 'cat', 'crossroads', 'hex', 'sun', 'quicksand', 'claws']) this.sig[k] = makeSigil(k);
    this.cellTex = (i) => atlasCellTexture(this.atlas, i);
    this.iceMat = new THREE.MeshPhysicalMaterial({ color: 0xa8e6ff, roughness: 0.06, metalness: 0.05, transmission: 0.35, thickness: 0.6, ior: 1.31, emissive: new THREE.Color(0.18, 0.55, 0.95), emissiveIntensity: 0.9, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
    this.iceGeos = [new THREE.OctahedronGeometry(1, 0), new THREE.ConeGeometry(1, 1, 5, 1), new THREE.IcosahedronGeometry(1, 0)];
    this.iceGeos[1].translate(0, 0.5, 0);
  },
  add(o) { if (Net.ctx) Net.adopt(o); this.items.push(o); return o; },
  // generic timed effect: { t, dur, update(dt, t) -> keep?, dispose() }
  update(dt, time) {
    this.p.update(dt);
    this.items = this.items.filter((o) => { o.t = (o.t || 0) + dt; const keep = o.update(dt, time); if (!keep && o.dispose) o.dispose(); return keep; });
  },
  clear() { for (const o of this.items) if (o.dispose) o.dispose(); this.items = []; },
  spawn(o) { return this.p.spawn(o); },
  // a ground decal with any texture (like VFX.decal) that also supports fade-out by handle
  decal(pos, tex, color, size, dur, opts = {}) { return VFX.decal(pos, tex, color, size, dur, opts); },
  // a vertical column of light; handle: .target alpha, .dead, .radius, .height
  column(pos, radius, height, color, opts = {}) {
    const mat = beamMaterial(color, opts);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * (opts.flare ?? 1), height, 40, 1, true), mat);
    m.position.set(pos.x, height / 2 + (opts.y ?? 0), pos.z); m.renderOrder = 8; m.frustumCulled = false; scene.add(m);
    const h = { m, mat, target: 1, alpha: 0, dead: false, k: opts.k ?? 10, follow: opts.follow || null };
    return this.add({ ...h, h, update(dt, time) { h.alpha = damp(h.alpha, h.dead ? 0 : h.target, h.dead ? 7 : h.k, dt); mat.uniforms.uAlpha.value = h.alpha; mat.uniforms.uTime.value = time; if (h.follow) m.position.set(h.follow.x, m.position.y, h.follow.z); return !(h.dead && h.alpha < 0.01); },
      dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } }).h;
  },
  // a beam between two points (cylinder along the segment)
  beam(from, to, radius, color, opts = {}) {
    const mat = beamMaterial(color, opts);
    const geo = new THREE.CylinderGeometry(radius, radius * (opts.taper ?? 1), 1, 32, 1, true); geo.translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 9; m.frustumCulled = false; scene.add(m);
    const h = { m, mat, target: 1, alpha: 0, dead: false, from: from.clone(), to: to.clone(), k: opts.k ?? 14 };
    const place = () => { const d = _v1.copy(h.to).sub(h.from); const L = d.length(); m.position.copy(h.from); m.scale.set(1, Math.max(0.001, L), 1); m.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), d.normalize()); };
    place();
    return this.add({ h, update(dt, time) { h.alpha = damp(h.alpha, h.dead ? 0 : h.target, h.dead ? 9 : h.k, dt); mat.uniforms.uAlpha.value = h.alpha; mat.uniforms.uTime.value = time; place(); return !(h.dead && h.alpha < 0.01); },
      dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } }).h;
  },
  // a swirling portal disc, upright (facing `yaw`) or flat on the ground
  portal(pos, radius, c1, c2, opts = {}) {
    const mat = vortexMaterial(c1, c2, opts);
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat); m.renderOrder = 8; m.frustumCulled = false;
    m.position.copy(pos); if (opts.flat) { m.rotation.x = -Math.PI / 2; m.position.y = opts.y ?? 0.05; } else m.rotation.y = opts.yaw ?? 0;
    scene.add(m);
    const h = { m, mat, target: 1, alpha: 0, dead: false, scale: 0, k: opts.k ?? 5 };
    return this.add({ h, update(dt, time) { h.alpha = damp(h.alpha, h.dead ? 0 : h.target, h.dead ? 5 : h.k, dt); h.scale = damp(h.scale, h.dead ? 0.2 : 1, h.dead ? 4 : 6, dt); m.scale.setScalar(Math.max(0.01, h.scale)); mat.uniforms.uAlpha.value = h.alpha; mat.uniforms.uTime.value = time; return !(h.dead && h.alpha < 0.01); },
      dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } }).h;
  },
  // a fresnel dome / bubble following a point
  bubble(follow, radius, color, opts = {}) {
    const mat = bubbleMaterial(color, opts);
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24, 0, TAU, 0, opts.dome ? Math.PI / 2 : Math.PI), mat); m.renderOrder = 9; m.frustumCulled = false; scene.add(m);
    const h = { m, mat, target: 1, alpha: 0, dead: false, follow, y: opts.y ?? 1.1, pulse: 0 };
    return this.add({ h, update(dt, time) { h.alpha = damp(h.alpha, h.dead ? 0 : h.target, h.dead ? 6 : 8, dt); h.pulse = Math.max(0, h.pulse - dt * 3); mat.uniforms.uAlpha.value = h.alpha * (1 + h.pulse * 1.5); mat.uniforms.uTime.value = time;
      m.position.set(h.follow.x, (h.follow.isVector3 ? 0 : 0) + h.y + (h.follow.y && !opts.dome ? 0 : 0), h.follow.z); m.scale.setScalar(1 + h.pulse * 0.08); return !(h.dead && h.alpha < 0.01); },
      dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } }).h;
  },
  // aurora curtains arcing across the sky above a point
  aurora(center, dur) {
    const mat = auroraMaterial(), g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.CylinderGeometry(60 + i * 18, 60 + i * 18, 26, 96, 1, true, rand(0, TAU), Math.PI * 0.9);
      const m = new THREE.Mesh(geo, mat); m.position.set(center.x, 24 + i * 6, center.z); m.rotation.z = rand(-0.12, 0.12); m.renderOrder = -5; m.frustumCulled = false; g.add(m);
    }
    scene.add(g);
    return this.add({ update(dt, time) { const k = this.t / dur; mat.uniforms.uAlpha.value = smoothstep(0, 0.15, k) * (1 - smoothstep(0.75, 1, k)) * 1.3; mat.uniforms.uTime.value = time; return this.t < dur; },
      dispose() { scene.remove(g); g.traverse((o) => o.geometry && o.geometry.dispose()); mat.dispose(); } });
  },
  // a sprite in the sky (moons, the eclipse, the Eye of Ra)
  skySprite(tex, color, pos, size, intensity = 2, opts = {}) {
    const s = glowSprite(tex, color, size, intensity); s.material.depthTest = opts.depthTest ?? true; s.material.fog = false; s.position.copy(pos); s.renderOrder = opts.order ?? 2;
    if (opts.normal) { s.material.blending = THREE.NormalBlending; }
    scene.add(s);
    const h = { s, target: 1, a: 0, dead: false, size };
    return this.add({ h, update(dt) { h.a = damp(h.a, h.dead ? 0 : h.target, h.dead ? 4 : opts.k ?? 3, dt); s.material.opacity = h.a; s.scale.setScalar(h.size); return !(h.dead && h.a < 0.01); }, dispose() { scene.remove(s); s.material.dispose(); } }).h;
  },
  // the floor inside a radius goes dark (finals) so the coloured magic blazes on top of it; handle.k = 0..1
  shade(c, R, opacity = 0.6) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, 64), new THREE.MeshBasicMaterial({ map: VFX.shadeTex || (VFX.shadeTex = makeShadeTexture()), color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.018, c.z); m.renderOrder = 5; scene.add(m);
    const h = { m, k: 0, target: 1, dead: false };
    return this.add({ h, update(dt) { h.k = damp(h.k, h.dead ? 0 : h.target, h.dead ? 2.5 : 4, dt); m.material.opacity = h.k * opacity; return !(h.dead && h.k < 0.01); }, dispose() { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }).h;
  },
  // tint the sky and the moonlight (finals)
  tint(color, k) { WORLD.tint.color.copy(color); WORLD.tint.target = k; },
  // particle storms: snow / sand / embers swirling inside a radius around a moving centre
  storm(center, radius, dur, kind = 'snow', rate = 260) {
    const c = center;
    return this.add({ rate, update(dt) {
      const k = this.t / dur, w = smoothstep(0, 0.12, k) * (1 - smoothstep(0.82, 1, k));
      const n = Math.round(dt * this.rate * w + Math.random() * 0.8);
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), r = Math.sqrt(Math.random()) * radius, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        const tang = V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(rand(4, 9));
        if (kind === 'snow') GodFX.p.spawn({ pos: V3(x, rand(0.2, 6), z), vel: tang.add(V3(rand(-1, 1), rand(-2.5, -0.5), rand(-1, 1))), life: rand(0.8, 1.6), size: rand(0.06, 0.16), sizeEnd: 0.04, color: Math.random() < 0.3 ? GCOL.ice : GCOL.iceHot, intensity: 1.6, cell: GX.snow, rotVel: rand(-4, 4), drag: 0.6 });
        else if (kind === 'sand') VFX.smoke.spawn({ pos: V3(x, rand(0.1, 3), z), vel: tang.add(V3(0, rand(0.2, 1.4), 0)), life: rand(0.9, 1.6), size: rand(0.6, 1.2), sizeEnd: 2.2, color: GCOL.sand, alpha: 0.32, alphaEnd: 0, cell: FX.smoke, drag: 0.8 });
        else VFX.add.spawn({ pos: V3(x, rand(0.1, 4), z), vel: tang.add(V3(0, rand(0.5, 2), 0)), life: rand(0.6, 1.2), size: rand(0.04, 0.09), sizeEnd: 0.01, color: kind === 'ember' ? GCOL.sun : GCOL.witch, intensity: 3, cell: FX.ember, drag: 0.6 });
      }
      return this.t < dur; } });
  },
  // a ring of ice spikes erupting from the floor; returns the spike list
  iceSpikes(center, r0, r1, count, opts = {}) {
    const spikes = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand(-0.15, 0.15), r = rand(r0, r1);
      const m = new THREE.Mesh(this.iceGeos[1], this.iceMat);
      const h = rand(0.9, 2.2) * (opts.height ?? 1), w = h * rand(0.16, 0.26);
      m.position.set(center.x + Math.cos(a) * r, -h, center.z + Math.sin(a) * r);
      m.rotation.set(rand(-0.35, 0.35), rand(0, TAU), rand(-0.35, 0.35)); m.scale.set(w, h, w); m.castShadow = true;
      scene.add(m);
      spikes.push({ m, h, delay: (opts.delay ?? 0) + (r / Math.max(r1, 1)) * (opts.sweep ?? 0.35) + rand(0, 0.05) });
    }
    return this.add({ spikes, life: opts.life ?? 3, update(dt) {
      for (const s of spikes) { const k = clamp((this.t - s.delay) / 0.16, 0, 1); s.m.position.y = lerp(-s.h, -s.h * 0.15, easeOutBack(k)); }
      if (this.t > this.life) { for (const s of spikes) { GodFX.shards(s.m.position.clone().setY(s.h * 0.4), 5, 0.8); scene.remove(s.m); } return false; }
      return true; }, dispose() { for (const s of spikes) scene.remove(s.m); } });
  },
  // flying ice shards (particles + a few real crystals)
  shards(pos, n = 8, scale = 1) {
    for (let i = 0; i < n; i++) GodFX.p.spawn({ pos: pos.clone().add(V3(rand(-0.3, 0.3), rand(0, 0.8), rand(-0.3, 0.3))), vel: V3(rand(-4, 4), rand(2, 7), rand(-4, 4)).multiplyScalar(scale), life: rand(0.5, 1.0), size: rand(0.12, 0.26) * scale, sizeEnd: 0.03, color: Math.random() < 0.5 ? GCOL.ice : GCOL.iceHot, intensity: 2.2, cell: GX.shard, rotVel: rand(-10, 10), gravity: -14, drag: 0.4 });
    VFX.shatter(pos.clone().setY(Math.max(0, pos.y - 0.4)), this.iceMat, Math.ceil(n * 0.6), 0.7 * scale);
  },
  // ---- ice blocks encasing frozen targets
  iceBlock(d) {
    const g = new THREE.Group();
    const H = d.height * 1.05, R = d.radius * 1.5;
    const core = new THREE.Mesh(this.iceGeos[2], this.iceMat); core.scale.set(R, H * 0.55, R); core.position.y = H * 0.5; g.add(core);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rand(-0.2, 0.2), m = new THREE.Mesh(this.iceGeos[1], this.iceMat), h = rand(0.5, 1.2) * H * 0.6; m.scale.set(h * 0.25, h, h * 0.25); m.position.set(Math.cos(a) * R * 0.75, rand(0, H * 0.5), Math.sin(a) * R * 0.75); m.rotation.set(Math.cos(a) * 0.5, rand(0, TAU), -Math.sin(a) * 0.5); g.add(m); }
    g.position.copy(d.pos); g.scale.setScalar(0.01); scene.add(g);
    const h = { g, d, t: 0, state: 'grow' };
    GodFX.shards(d.pos.clone().setY(1), 6, 0.6);
    VFX.flash(d.pos.clone().setY(1.2), GCOL.ice, 16, 0.35);
    this.add({ update(dt) { h.t += dt; g.position.copy(d.pos); if (h.state === 'grow') g.scale.setScalar(easeOutBack(clamp(h.t / 0.22, 0, 1))); else if (h.state === 'melt') { h.mt = (h.mt || 0) + dt; g.scale.setScalar(Math.max(0.001, 1 - h.mt / 0.4)); if (h.mt > 0.4) return false; } else if (h.state === 'gone') return false;
      if (Math.random() < dt * 6) GodFX.p.spawn({ pos: d.pos.clone().add(V3(rand(-0.6, 0.6), rand(0.3, H), rand(-0.6, 0.6))), vel: V3(0, rand(0.1, 0.4), 0), life: 0.8, size: 0.12, sizeEnd: 0.02, color: GCOL.iceHot, intensity: 1.8, cell: GX.snow, rotVel: 2 });
      return true; }, dispose() { scene.remove(g); } });
    return h;
  },
  thaw(h) { if (h) { h.state = 'melt'; GodFX.shards(h.d.pos.clone().setY(1), 5, 0.5); } },
  removeIce(h) { if (h) h.state = 'gone'; },
  shatterIce(d) {
    if (!d.ice) return;
    d.ice.state = 'gone';
    const p = d.pos.clone().setY(1.1);
    GodFX.shards(p, 22, 1.3);
    VFX.flash(p, GCOL.ice, 30, 0.4);
    VFX.add.spawn({ pos: p, life: 0.3, size: 2.2, sizeEnd: 3.5, color: GCOL.iceHot, intensity: 3, cell: FX.flare, alpha: 1, alphaEnd: 0, fadeIn: 0 });
    Sound.god('shatter_ice', { gain: 0.9, pos: p });
  },
  // ---- status markers above a target's head
  status(d, kind) {
    if (d.isGhost) return;   // (a replayed cast's target: nothing happens to it here)
    if (!d.statusFx) d.statusFx = makeStatusFx(d);
    d.statusFx.kick(kind);
  },
};
const STATUS_LOOK = {
  stun: { cell: GX.star, color: () => GCOL.goldHot, n: 4 }, frozen: { cell: GX.snow, color: () => GCOL.iceHot, n: 3 }, mez: { cell: GX.triskele, color: () => GCOL.hex, n: 3 },
  blind: { cell: GX.sunrays, color: () => GCOL.sunHot, n: 1 }, mark: { cell: GX.fullmoon, color: () => GCOL.witch, n: 3 }, bleed: { cell: GX.claw, color: () => GCOL.blood, n: 1 },
  root: { cell: GX.rune, color: () => (Kit && Kit.accent) || GCOL.gold, n: 2 },
};
function makeStatusFx(d) {
  const g = new THREE.Group(); scene.add(g);
  const sprites = {};
  const fx = {
    kick(kind) {
      if (sprites[kind]) return;
      const L = STATUS_LOOK[kind], arr = [];
      for (let i = 0; i < L.n; i++) { const s = glowSprite(GodFX.cellTex(L.cell), L.color(), kind === 'blind' ? 0.9 : 0.34, 2.4); s.renderOrder = 12; g.add(s); arr.push(s); }
      sprites[kind] = arr;
    },
    update(dt, t) {
      g.position.set(d.pos.x, d.height + 0.75 + d.lift, d.pos.z);
      for (const [kind, arr] of Object.entries(sprites)) {
        const on = kind === 'stun' ? d.stun : kind === 'frozen' ? d.frozen : kind === 'mez' ? d.mez : kind === 'blind' ? d.blind : kind === 'mark' ? d.markT : kind === 'bleed' ? (d.bleeds.length ? 1 : 0) : kind === 'root' ? d.root : 0;
        if (on <= 0) { for (const s of arr) { g.remove(s); s.material.dispose(); } delete sprites[kind]; continue; }
        arr.forEach((s, i) => {
          const a = t * (kind === 'mez' ? 4 : 2.6) + i / arr.length * TAU;
          if (kind === 'blind') s.position.set(0, -0.2, 0);
          else if (kind === 'bleed') s.position.set(0, 0.25 + Math.sin(t * 6) * 0.05, 0);
          else s.position.set(Math.cos(a) * 0.45, (kind === 'mark' ? 0.35 : 0) + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.45);
          s.material.rotation = kind === 'mez' ? t * 5 : 0;
          s.material.opacity = Math.min(1, on * 3) * (0.8 + 0.2 * Math.sin(t * 9 + i));
        });
      }
    },
    dispose() { scene.remove(g); g.traverse((o) => { if (o.material) o.material.dispose(); }); },
  };
  return fx;
}

// a ground AoE targeter: a glowing ring + soft fill, tinted per god
function makeCircleTargeter() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color(0.2, 0.85, 1.0) }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uTime; void main() { float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard; float edge = smoothstep(0.86, 0.95, r) * (1.0 - smoothstep(0.97, 1.0, r)); float pulse = smoothstep(0.08, 0.0, abs(r - fract(uTime * 0.7))) * 0.25; float a = edge * 0.95 + 0.06 + pulse; gl_FragColor = vec4(uColor * a * 1.15, a); }',
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 6; m.visible = false; m.frustumCulled = false; scene.add(m);
  return { mesh: m, mat, show(pos, r, color) { m.visible = true; m.position.set(pos.x, 0.07, pos.z); m.scale.set(r * 2, r * 2, 1); if (color) mat.uniforms.uColor.value.copy(color); }, hide() { m.visible = false; } };
}


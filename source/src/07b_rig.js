// ============================================================================
// Mocap characters: GLB skinned meshes driven by retargeted motion-capture clips
// (Meshy auto-rig + animation library, merged by tools/node/merge_rig.mjs).
// Every playable god gets the same hand-built pose mixer, configured per god (GOD_RIG):
// locomotion (Thoth, Hecate and Ra glide on magic with a shortened stride; Skadi and Bastet
// run), cast layers that become full-body when standing, jump + landing, a levitating channel
// pose, aim, head glances, glowing eyes and hands, held props, and for Thoth a two-bone IK left
// arm that holds the open Book of Thoth on its palm.
// ============================================================================
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
// Packed models (tools/pack_web.py) carry their textures as data: URIs. The artifact's sandbox refuses to fetch data: URIs,
// and GLTFLoader fetches every image, so the textures would silently go missing. loadGLB decodes them itself
// (createImageBitmap on an in-memory Blob - no fetch, no URL) and this plugin hands the finished textures to the parser.
const PRE_IMAGES = new Map(); let preImageSeq = 0;
gltfLoader.register((parser) => {
  const tok = parser.json && parser.json.asset && parser.json.asset.extras && parser.json.asset.extras.preImages;
  const list = tok && PRE_IMAGES.get(tok);
  if (list) { list.forEach((pr, i) => { if (pr) parser.sourceCache[i] = pr; }); PRE_IMAGES.delete(tok); }
  return { name: 'thoth_pre_decoded_images' };
});
function preDecodeImages(json) {
  const imgs = json.images;
  if (!imgs || !imgs.some((im) => im.uri && im.uri.startsWith('data:'))) return;
  const tok = 'pi' + (++preImageSeq);
  const list = imgs.map((im, i) => {
    if (!im.uri || !im.uri.startsWith('data:')) return null;
    const comma = im.uri.indexOf(','), mime = im.mimeType || im.uri.slice(5, im.uri.indexOf(';')) || 'image/webp';
    const raw = atob(im.uri.slice(comma + 1)), u8 = new Uint8Array(raw.length);
    for (let k = 0; k < raw.length; k++) u8[k] = raw.charCodeAt(k);
    im.uri = `packed-${tok}-${i}`;   // a unique placeholder (the loader's texture cache keys on it); never fetched
    return createImageBitmap(new Blob([u8], { type: mime }), { premultiplyAlpha: 'none' }).then((bmp) => {
      const t = new THREE.Texture(bmp); t.needsUpdate = true; t.userData.mimeType = mime; return t;
    });
  });
  json.asset = json.asset || {}; json.asset.extras = Object.assign({}, json.asset.extras, { preImages: tok });
  PRE_IMAGES.set(tok, list);
}
const Assets = { glb: {}, rest: {}, ok: false };
// Assets ship as glTF JSON with the binary buffer embedded as base64 (artifacts don't serve .glb).
// Instead of letting the loader fetch a data: URI, decode it here and hand GLTFLoader an in-memory GLB.
// realism pass: every texture of a loaded model gets anisotropic filtering (the GPU's maximum; 4 on low quality),
// so cloth, gold and stone stay crisp at grazing angles instead of smearing
async function loadGLB(path, onProgress) { const g = await loadGLBRaw(path, onProgress); sharpenModelTextures(g.scene); return g; }
function sharpenModelTextures(root) {
  const an = Math.min(settings.quality === 'low' ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
  root.traverse((o) => {
    const ms = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) { const t = m[k]; if (t && t.anisotropy !== an) { t.anisotropy = an; t.needsUpdate = true; } }
  });
}
async function loadGLBRaw(path, onProgress) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0;
  let text;
  if (res.body && onProgress) {
    const reader = res.body.getReader(), chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(got, total); }
    const all = new Uint8Array(got); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    text = new TextDecoder().decode(all);
  } else text = await res.text();
  const base = path.slice(0, path.lastIndexOf('/') + 1);
  if (text.charCodeAt(0) !== 123) return gltfLoader.parseAsync(new TextEncoder().encode(text).buffer, base); // not JSON
  const json = JSON.parse(text);
  preDecodeImages(json);
  const b0 = json.buffers && json.buffers[0];
  if (!b0 || !b0.uri || !b0.uri.startsWith('data:')) return gltfLoader.parseAsync(JSON.stringify(json), base);
  const b64 = b0.uri.slice(b0.uri.indexOf(',') + 1), raw = atob(b64);
  const bin = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  delete b0.uri; b0.byteLength = bin.length;
  // GLB container: header + JSON chunk (space padded) + BIN chunk (zero padded)
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jLen = (jsonBytes.length + 3) & ~3, bLen = (bin.length + 3) & ~3;
  const glb = new ArrayBuffer(12 + 8 + jLen + 8 + bLen), dv = new DataView(glb), u8 = new Uint8Array(glb);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.byteLength, true);
  dv.setUint32(12, jLen, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(jsonBytes, 20); u8.fill(0x20, 20 + jsonBytes.length, 20 + jLen);
  dv.setUint32(20 + jLen, bLen, true); dv.setUint32(24 + jLen, 0x004e4942, true); u8.set(bin, 28 + jLen);
  return gltfLoader.parseAsync(glb, base);
}

// share of the walk pose that survives in a glide, per bone (unlisted bones: 0.5)
const GLIDE_MASK = { Hips: 0.4, Spine02: 0.45, Spine01: 0.45, Spine: 0.45, neck: 0.35, Head: 0.35,
  LeftUpLeg: 0.55, LeftLeg: 0.55, LeftFoot: 0.45, LeftToeBase: 0.45, RightUpLeg: 0.55, RightLeg: 0.55, RightFoot: 0.45, RightToeBase: 0.45,
  LeftShoulder: 0.25, LeftArm: 0.25, LeftForeArm: 0.25, LeftHand: 0.25, RightShoulder: 0.35, RightArm: 0.35, RightForeArm: 0.4, RightHand: 0.45 };
// Glide (Thoth): the proud-walk mocap plays gently with a shortened stride while he hovers a few
// centimetres above the floor and slides along, feet turned toward the travel direction.
const GLIDE = { clip: 'glide', rate: 1.2, hover: 0.06, lean: 4.5 * DEG, maxTwist: 50 * DEG };
// Cast layers. from/to: clip window (s), rate: playback speed, full: how much of the lower body
// joins in when the god stands still, yaw: turn (deg) that points the cast along the facing.
// keys: [[t, clipTime], ...] time-warp instead of from/to/rate; delay: start offset (s);
// book: where Thoth's held book moves during the cast (Thoth-space metres: left, up, forward).
const COMMON_ACTS = {
  laugh: { clip: 'shout', from: 0.1, to: 3.3, rate: 1.05, fadeIn: 0.18, fadeOut: 0.35, full: 1, yaw: 0 },
  land: { clip: 'jump', from: 1.14, to: 1.62, rate: 1.5, fadeIn: 0.02, fadeOut: 0.55, full: 1, yaw: 0, lowerOnly: true, weight: 0.6 },
  rage: { clip: 'shout', from: 1.92, to: 2.24, rate: 0.52, fadeIn: 0.1, fadeOut: 0.16, full: 1, yaw: 0 },
  throw: { clip: 'cast_throw', from: 0.9, to: 1.62, rate: 1.55, fadeIn: 0.06, fadeOut: 0.3, full: 0.55, yaw: 9 },
};
const RIG_ACTS = {
  ...COMMON_ACTS,
  empower: { clip: 'cast_lunge', from: 0.45, to: 1.25, rate: 1.4, fadeIn: 0.05, fadeOut: 0.32, full: 0.8, yaw: 30, book: [0, 0.04, 0.06] },
  conjure: { clip: 'cast_overhead', from: 0.42, to: 1.5, rate: 1.55, fadeIn: 0.08, fadeOut: 0.32, full: 0.75, yaw: 0, book: [-0.04, 0.16, 0.08] },
  glyph: { clip: 'cast_crouch', from: 0.55, to: 1.65, rate: 1.6, fadeIn: 0.08, fadeOut: 0.32, full: 0.9, yaw: 0, book: [-0.06, 0.1, 0.16] },
  judgement: { clip: 'cast_push', from: 0.88, to: 1.85, rate: 1.25, fadeIn: 0.04, fadeOut: 0.4, full: 1, yaw: 10 },
  // Scribe's Wrath: a roar with the arms flung wide, then the slow, furious knee-lift and the stomp
  wrath: { clip: 'wrath', keys: [[0, 0.3], [0.75, 0.7], [1.65, 1.55]], fadeIn: 0.16, fadeOut: 0.45, full: 1, yaw: 0, delay: 0.5 },
};
const WRATH_IMPACT = 0.5 + 0.75; // s after the cast: the stomp lands (rage delay + wrath key)
// the book's flight through Scribe's Wrath (s after the cast): out and up, hold over his head, back down
const WRATH_BOOK = { rise: 0.78, fall0: 1.9, fall1: 2.72, w1: 2.4, ramp: 0.15, turns: 2 };
// its spin about the world up axis, integrated in closed form so every frame agrees with every other:
// a slow turn while it rises, smoothly kicked to full speed by the blast, then an ease-out that lands
// on exactly `turns` whole turns at the moment it settles into his palm (no snap, no rewind)
function wrathSpin(wt) {
  const B = WRATH_BOOK, WI = WRATH_IMPACT, w1 = B.w1, tau = B.ramp, D = B.fall1 - B.fall0;
  const w2 = (B.turns * 2 * Math.PI - w1 * (WI + tau / 2)) / (B.fall0 - WI - tau / 2 + D / 2);
  if (wt <= WI) return w1 * Math.max(0, wt);
  let th = w1 * WI;
  if (wt <= WI + tau) { const x = (wt - WI) / tau; return th + w1 * (wt - WI) + (w2 - w1) * tau * (x * x * x - x * x * x * x / 2); }
  th += w1 * tau + (w2 - w1) * tau / 2;
  if (wt <= B.fall0) return th + w2 * (wt - WI - tau);
  th += w2 * (B.fall0 - WI - tau);
  const x = Math.min(1, (wt - B.fall0) / D);
  return th + w2 * D * (x - x * x * x + x * x * x * x / 2);
}
const UPPER_MASK = { Spine02: 0.3, Spine01: 0.65, Spine: 1, neck: 1, Head: 1, head_end: 1, headfront: 1,
  LeftShoulder: 1, LeftArm: 1, LeftForeArm: 1, LeftHand: 1, RightShoulder: 1, RightArm: 1, RightForeArm: 1, RightHand: 1 };
// The held Book of Thoth. Left wrist target relative to the left shoulder joint, elbow pole,
// finger and palm directions, all in Thoth's chest frame (x = his left, y = up, z = forward);
// palm: book spine offset from the wrist along the fingers / out of the palm (m).
const HOLD = { off: [0.15, -0.34, 0.3], pole: [0.6, -0.55, -0.4], fingers: [0.1, 0.16, 1], palmN: [-0.3, 1, -0.2], palm: [0.085, 0.07], scale: 0.85 };
// Slimmer silhouette: every vertex is pulled toward the axis of the bones it is skinned to
// (factor = remaining distance), so torso and limbs get thinner while the skeleton is unchanged.
const SLIM = { Hips: 0.9, Spine02: 0.86, Spine01: 0.86, Spine: 0.87, neck: 0.93, LeftShoulder: 0.9, RightShoulder: 0.9,
  LeftArm: 0.85, RightArm: 0.85, LeftForeArm: 0.88, RightForeArm: 0.88, LeftUpLeg: 0.86, RightUpLeg: 0.86, LeftLeg: 0.88, RightLeg: 0.88 };
const SLIM_NEXT = { Hips: 'Spine02', Spine02: 'Spine01', Spine01: 'Spine', Spine: 'neck', neck: 'Head', LeftShoulder: 'LeftArm', RightShoulder: 'RightArm',
  LeftArm: 'LeftForeArm', RightArm: 'RightForeArm', LeftForeArm: 'LeftHand', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', RightUpLeg: 'RightLeg', LeftLeg: 'LeftFoot', RightLeg: 'RightFoot' };

// ---------------------------------------------------------------------------
// Per-god rig setup. eyes: Head-bone local eye centres (cm, mirrored in x); grade: colour grading
// of the generated textures (dark/light tint, luminance gamma, metal + roughness for bright parts);
// hands: glowing hands; loco: glide (hover, shortened stride) or run; acts: cast layers.
// ---------------------------------------------------------------------------
const GOD_RIG = {
  thoth: {
    eyes: [6.85, 3.95, -13.8], eyeColor: [0.4, 1.0, 1.0], eyeSize: 4.5, rim: [0x5fe8ff, 0.24, 2.6], env: 1.15, slim: true,
    hands: { R: { color: [0.25, 0.9, 1.0], core: [0.8, 1.0, 1.0], size: 34 } },
    // a dignified, gliding scholar: short hovering steps, pelvis nearly square, a very calm torso; glyph motes trail his feet
    loco: { mode: 'glide', rate: 1.2, hover: 0.06, stride: 0.5, lift: 0.5, lean: 3 * DEG, side: 0.2, twistW: 0.12, maxTwist: 10 * DEG, calm: 0.85, upright: 0.9, halfW: 0.075, fx: 'glyph' },
    acts: RIG_ACTS, book: true, fx: 'cyan', channel: { clip: 'charged', legs: 'jump', lift: 0.62 },
  },
  skadi: {
    eyes: [4.2, 13.9, 8.5], eyeColor: [0.55, 0.85, 1.0], eyeSize: 3.2, rim: [0x8fd8ff, 0.3, 2.4], env: 1.25,
    grade: { dark: [0.52, 0.66, 0.92], light: [0.9, 0.97, 1.08], gamma: 1.12, metal: 0.55, rough: 0.32, lo: 0.42, hi: 0.86 },
    hands: { R: { color: [0.45, 0.8, 1.0], core: [0.85, 0.95, 1.0], size: 26 } },
    // a light, predatory huntress: narrow track, head steady on the prey; frost prints and a kick of snow
    loco: { mode: 'run', lean: 8 * DEG, twistW: 0.15, twistR: 0.25, maxTwist: 25 * DEG, calm: 0.6, width: 0.85, fx: 'frost' },
    acts: {
      ...COMMON_ACTS,
      spear: { clip: 'cast_throw', from: 0.72, to: 1.78, rate: 1.3, fadeIn: 0.06, fadeOut: 0.32, full: 0.85, yaw: 14 },
      mark: { clip: 'cast_lunge', from: 0.45, to: 1.25, rate: 1.35, fadeIn: 0.05, fadeOut: 0.32, full: 0.8, yaw: 26 },
      frost: { clip: 'slam', from: 1.25, to: 2.45, rate: 1.55, fadeIn: 0.06, fadeOut: 0.3, full: 1, yaw: 0 },
      storm: { clip: 'charged', from: 0.15, to: 1.0, rate: 0.8, fadeIn: 0.1, fadeOut: 0.4, full: 1, yaw: 0 },
      fimbul: { clip: 'slam', keys: [[0, 0.25], [2.15, 1.5], [2.6, 1.86], [3.7, 2.8]], fadeIn: 0.18, fadeOut: 0.5, full: 1, yaw: 0 },
    },
    fx: 'ice', prop: 'spear', channel: { clip: 'charged', legs: 'stand', lift: 0 },
  },
  bastet: {
    eyes: [4.2, 13.9, 6.8], eyeColor: [0.35, 1.0, 0.55], eyeSize: 3.0, rim: [0xffd27a, 0.26, 2.4], env: 1.2,
    hands: { R: { color: [1.0, 0.78, 0.3], core: [1.0, 0.95, 0.7], size: 20 }, L: { color: [1.0, 0.78, 0.3], core: [1.0, 0.95, 0.7], size: 20 } },
    // feline: low and light-footed, paws on one line, high soft steps; little puffs of sand
    loco: { mode: 'run', lean: 9 * DEG, twistW: 0.15, twistR: 0.25, maxTwist: 25 * DEG, calm: 0.55, width: 0.7, crouch: 0.035, lift: 1.1, fx: 'sand' },
    acts: {
      ...COMMON_ACTS,
      // the basic-attack chain (RigAnimator.swing; hit = the clip time the claws pass through the target): left_slash = Meshy
      // "Left_Slash" (a rising slash, then the backhand cut down the other way, one flowing into the next), cross = "Charged_Slash"
      // (arms crossed, then torn apart: the X-slash finisher; retargeted from cookie_rage__cross.glb, add_clips --fit)
      claw1: { clip: 'left_slash', from: 0.45, hit: 0.78, to: 1.1, rate: 1.35, fadeIn: 0.16, fadeOut: 0.3, full: 0.8, yaw: -25, chain: true },
      claw2: { clip: 'left_slash', from: 1.07, hit: 1.3, to: 1.62, rate: 1.35, fadeIn: 0.16, fadeOut: 0.3, full: 0.8, yaw: 0, chain: true },
      claw3: { clip: 'cross', from: 0.62, hit: 1.22, to: 1.7, rate: 1.35, fadeIn: 0.2, fadeOut: 0.35, full: 0.85, yaw: 25, chain: true },
      pounce: { clip: 'jump_punch', keys: [[0, 0.25], [0.12, 0.5], [0.42, 0.7], [0.62, 0.74]], fadeIn: 0.03, fadeOut: 0.12, full: 1, yaw: 0, rootFix: true },
      flip: { clip: 'backflip', keys: [[0, 0.8], [0.52, 1.95], [0.72, 2.45]], fadeIn: 0.04, fadeOut: 0.18, full: 1, yaw: 0, rootFix: true },
      whip: { clip: 'left_slash', from: 0.75, to: 1.8, rate: 1.55, fadeIn: 0.05, fadeOut: 0.25, full: 0.85, yaw: 20 },
      toss: { clip: 'cast_throw', from: 0.85, to: 1.62, rate: 1.4, fadeIn: 0.06, fadeOut: 0.3, full: 0.7, yaw: 9 },
      huntress: { clip: 'cast_push', from: 0.88, to: 1.85, rate: 1.3, fadeIn: 0.04, fadeOut: 0.4, full: 1, yaw: 10 },
      roar: { clip: 'shout', from: 1.55, to: 2.55, rate: 0.95, fadeIn: 0.08, fadeOut: 0.3, full: 1, yaw: 0 },
      spin: { clip: 'blade_spin', from: 0.95, to: 2.1, rate: 2.2, fadeIn: 0.04, fadeOut: 0.2, full: 1, yaw: 0, rootFix: true },
      slam: { clip: 'slam', from: 1.3, to: 2.5, rate: 1.4, fadeIn: 0.05, fadeOut: 0.4, full: 1, yaw: 0, rootFix: true },
    },
    fx: 'gold', channel: { clip: 'charged', legs: 'stand', lift: 0 },
  },
  hecate: {
    eyes: [4.0, 14.8, 6.5], eyeColor: [0.72, 0.42, 1.0], eyeSize: 2.6, rim: [0x9a5cff, 0.26, 2.3], env: 1.15,
    hands: { R: { color: [0.62, 0.35, 1.0], core: [0.75, 1.0, 0.7], size: 26 }, L: { color: [0.35, 1.0, 0.5], core: [0.9, 1.0, 0.8], size: 22 } },
    // a regal glide above the ground, barely a step; dark mist pools at her hem
    loco: { mode: 'glide', rate: 1.1, hover: 0.16, stride: 0.4, lift: 0.4, lean: 3 * DEG, side: 0.2, twistW: 0.12, maxTwist: 10 * DEG, calm: 0.85, upright: 0.85, fx: 'mist' },
    acts: {
      ...COMMON_ACTS,
      triple: { clip: 'mage1', from: 0.62, to: 2.3, rate: 1.75, fadeIn: 0.06, fadeOut: 0.3, full: 0.8, yaw: 6 },
      sigil: { clip: 'cast_overhead', from: 0.42, to: 1.5, rate: 1.55, fadeIn: 0.08, fadeOut: 0.32, full: 0.75, yaw: 0 },
      devour: { clip: 'mage2', from: 0.75, to: 1.9, rate: 1.35, fadeIn: 0.06, fadeOut: 0.35, full: 1, yaw: 0 },
      shield: { clip: 'cast_crouch', from: 0.55, to: 1.65, rate: 1.6, fadeIn: 0.08, fadeOut: 0.32, full: 0.9, yaw: 0 },
      gates: { clip: 'charged1', from: 1.0, to: 3.0, rate: 1.45, fadeIn: 0.08, fadeOut: 0.4, full: 1, yaw: 10 },
      moonslam: { clip: 'mage2', keys: [[0, 0.95], [0.25, 1.15], [0.45, 1.42], [1.4, 2.3]], fadeIn: 0.05, fadeOut: 0.45, full: 1, yaw: 0 },
    },
    fx: 'witch', prop: 'keystaff', propL: 'torch', channel: { clip: 'charged', legs: 'jump', lift: 1.1 },
  },
  ra: {
    eyes: [7.6, 13.5, 7.5], eyeColor: [1.0, 0.85, 0.45], eyeSize: 3.4, rim: [0xffb24a, 0.24, 2.4], env: 1.15,
    hands: { R: { color: [1.0, 0.7, 0.25], core: [1.0, 0.95, 0.75], size: 30 } },
    // a proud, upright king's stride (long steps just above the ground, chest up); sun-ember footprints that fade
    loco: { mode: 'glide', rate: 1.1, hover: 0.05, stride: 0.75, lift: 0.7, lean: 1.5 * DEG, side: 0.2, twistW: 0.15, maxTwist: 12 * DEG, calm: 0.8, upright: 0.8, chestUp: 4 * DEG, fx: 'ember' },
    acts: {
      ...COMMON_ACTS,
      beam: { clip: 'mage2', from: 0.55, to: 1.95, rate: 1.4, fadeIn: 0.06, fadeOut: 0.35, full: 1, yaw: 0 },
      radiance: { clip: 'charged', from: 0.2, to: 2.2, rate: 1.0, fadeIn: 0.1, fadeOut: 0.3, full: 1, yaw: 0 },
      bless: { clip: 'cast_overhead', from: 0.42, to: 1.5, rate: 1.4, fadeIn: 0.08, fadeOut: 0.32, full: 0.75, yaw: 0 },
      sear: { clip: 'cast_push', keys: [[0, 0.75], [1.2, 1.3], [3.6, 2.5], [4.0, 2.75]], fadeIn: 0.1, fadeOut: 0.4, full: 1, yaw: 10 },
      sunslam: { clip: 'slam', keys: [[0, 0.3], [2.3, 1.45], [2.8, 1.86], [3.8, 2.8]], fadeIn: 0.15, fadeOut: 0.5, full: 1, yaw: 0 },
    },
    fx: 'sun', prop: 'staff', channel: { clip: 'charged', legs: 'jump', lift: 0.9 },
  },
  bacchus: {
    eyes: [3.6, 12.6, 9.0], eyeColor: [1.0, 0.3, 0.6], eyeSize: 1.2, rim: [0xc2387a, 0.2, 2.4], env: 1.2,
    hands: {}, mirror: { drink: 'drink_m' },   // the mocap drinks left-handed; his jug is in the right
    // a heavy, jolly waddle: wide stance, rocking onto each foot, the belly bouncing; the odd drop of wine
    loco: { mode: 'run', lean: 5 * DEG, twistW: 0.15, twistR: 0.22, maxTwist: 22 * DEG, calm: 0.35, upright: 0.2, width: 1.25, waddle: 5 * DEG, belly: 2.5 * DEG, fx: 'wine' },
    acts: {
      ...COMMON_ACTS,
      // the basic-attack chain (RigAnimator.swing): wcombo = Meshy "Weapon_Combo" (a rising backhand, then the forehand sweep
      // back across, one flowing out of the other; retargeted from cookie_rage__wcombo.glb, add_clips --fit), then the jug brought
      // down two-handed from over his head (hammer = "Heavy_Hammer_Swing")
      swing1: { clip: 'wcombo', from: 0.3, hit: 0.7, to: 1.0, rate: 1.15, fadeIn: 0.18, fadeOut: 0.32, full: 0.8, yaw: -20, chain: true },
      swing2: { clip: 'wcombo', from: 0.95, hit: 1.3, to: 1.62, rate: 1.15, fadeIn: 0.18, fadeOut: 0.32, full: 0.8, yaw: 15, chain: true },
      smash: { clip: 'hammer', from: 0.62, hit: 1.6, to: 1.86, rate: 1.4, fadeIn: 0.2, fadeOut: 0.4, full: 0.9, yaw: -20, chain: true, maxK: 1.9 },
      chug: { clip: 'drink_m', keys: [[0, 2.2], [0.55, 3.9], [0.95, 4.7], [1.3, 5.6]], fadeIn: 0.12, fadeOut: 0.3, full: 0.4, yaw: 0 },
      // the belly flop: arms swing up over his head while the kit pitches the whole body into a dive
      flop: { clip: 'slam', keys: [[0, 0.5], [0.25, 0.95], [0.75, 1.2], [1.25, 1.2]], fadeIn: 0.05, fadeOut: 0.35, full: 1, yaw: 0, rootFix: true },   // (Arena bots)
      // the player's belly flop (11g_bacchus.js drives the timing and fades): the wind-up crouch of the 'flop' clip, the
      // jump clip's launch with the arms flung over his head (held as he flies flat), and a push-up off the floor
      flopCrouch: { clip: 'flop', keys: [[0, 0.02], [0.24, 0.3], [3, 0.3]], fadeIn: 0.06, fadeOut: 0.1, full: 1, yaw: 0, rootFix: true },
      flopAir: { clip: 'jump', keys: [[0, 0.48], [0.16, 0.62], [4, 0.64]], fadeIn: 0.07, fadeOut: 0.2, full: 1, yaw: 0, rootFix: true },
      flopPush: { clip: 'cast_push', keys: [[0, 1.12], [0.3, 1.2], [3, 1.25]], fadeIn: 0.2, fadeOut: 0.3, full: 1, yaw: 0, rootFix: true },
      belch: { clip: 'shout', keys: [[0, 1.5], [0.3, 1.95], [1.5, 2.25], [1.9, 2.6]], fadeIn: 0.1, fadeOut: 0.35, full: 1, yaw: 0 },
      ixraise: { clip: 'charged', from: 0.25, to: 0.75, rate: 0.9, fadeIn: 0.08, fadeOut: 0.15, full: 1, yaw: 0 },
      intox: { clip: 'spin', from: 0.3, to: 2.2, rate: 1.9, fadeIn: 0.1, fadeOut: 0.35, full: 1, yaw: 0, rootFix: true },
      // the final: hands to the belly, a deep braced squat, and the arms flung up as it all comes out
      fart: { clip: 'charged', keys: [[0, 0.4], [1.0, 0.95], [1.4, 1.05], [3.4, 1.35], [3.6, 1.5], [3.9, 1.9], [4.8, 2.4]], fadeIn: 0.2, fadeOut: 0.5, full: 1, yaw: 0 },
    },
    fx: 'wine', prop: 'jug', channel: { clip: 'charged', legs: 'stand', lift: 0 },
  },
  // Ullr: a rune-carved yew longbow in the left hand (Bow stance), a bearded throwing axe in each hand
  // (Axe stance); the kit shows/hides them on a stance swap (props: key -> kind, bone). The archery
  // mocap shoots off to the archer's left, so the shot layers turn the hips (yaw) to aim it forward.
  ullr: {
    eyes: [3.3, 15.0, 15.4], eyeColor: [0.3, 1.0, 0.55], eyeSize: 1.0,   // v2 hooded mesh: measured from the face profile (eyes ~15 cm above, 15 cm in front of the base rig's Head bone), a faint glow in the hood's shadow
    rim: [0x3fd08a, 0.24, 2.4], env: 1.25,
    hands: {},
    // a hunter's stride: steady and quiet; green leaves and rune motes in his wake
    loco: { mode: 'run', lean: 7 * DEG, twistW: 0.15, twistR: 0.25, maxTwist: 25 * DEG, calm: 0.6, width: 0.9, fx: 'leaf' },
    acts: {
      ...COMMON_ACTS,
      // the bow is a kit-held aim layer on drawshot = Meshy "Draw and Shoot from Back" (see RigAnimator.aim and UL_AIM)
      volley: { clip: 'cast_overhead', from: 0.42, to: 1.5, rate: 1.4, fadeIn: 0.12, fadeOut: 0.35, full: 0.8, yaw: 0 },
      expose: { clip: 'charged', from: 0.2, to: 1.3, rate: 1.2, fadeIn: 0.14, fadeOut: 0.35, full: 1, yaw: 0 },
      // axes: axecombo = "Weapon Combo 2" (three chops ~0.9 / 2.0 / 3.0 s), axechop = "Charged Axe Chop"
      // (chain swings, RigAnimator.swing; hit = the clip time the axe passes through the target: 1.12 / 1.98 / 3.05)
      chop1: { clip: 'axecombo', from: 0.5, hit: 1.12, to: 1.5, rate: 1.5, fadeIn: 0.18, fadeOut: 0.3, full: 0.8, yaw: -25, chain: true },
      chop2: { clip: 'axecombo', from: 1.5, hit: 1.98, to: 2.45, rate: 1.5, fadeIn: 0.18, fadeOut: 0.3, full: 0.8, yaw: -5, chain: true },
      chop3: { clip: 'axecombo', from: 2.45, hit: 3.05, to: 3.5, rate: 1.4, fadeIn: 0.2, fadeOut: 0.35, full: 0.85, yaw: 0, chain: true },
      axethrow: { clip: 'cast_throw', from: 0.72, to: 1.78, rate: 1.35, fadeIn: 0.09, fadeOut: 0.32, full: 0.85, yaw: 14 },
      invig: { clip: 'shout', from: 1.55, to: 2.55, rate: 1.0, fadeIn: 0.14, fadeOut: 0.35, full: 1, yaw: 0 },
      // Glory Bound: crouch (0-0.14 s, he is still on the ground), rise, axes overhead in the air, the chop lands at 0.86 s (UL_LEAP)
      leap: { clip: 'axechop', keys: [[0, 2.19], [0.14, 2.86], [0.62, 3.8], [0.86, 4.27], [1.25, 5.1]], fadeIn: 0.14, fadeOut: 0.4, full: 1, yaw: 0, rootFix: true },
      // the stance swap: a quick spin with the weapons ("Axe Spin Attack")
      swap: { clip: 'axespin', keys: [[0, 0.16], [0.62, 1.82], [0.85, 2.13]], fadeIn: 0.12, fadeOut: 0.3, full: 1, yaw: 0, rootFix: true },
      // a self-bonk: the knees buckle for a moment
      flinch: { clip: 'jump', keys: [[0, 1.14], [0.18, 1.32], [0.5, 1.62]], fadeIn: 0.05, fadeOut: 0.3, full: 1, yaw: 0, weight: 0.8 },
      roar: { clip: 'shout', from: 1.55, to: 2.55, rate: 0.95, fadeIn: 0.08, fadeOut: 0.3, full: 1, yaw: 0 },
    },
    fx: 'jade', channel: { clip: 'charged', legs: 'stand', lift: 0 },
    props: [{ key: 'bow', kind: 'bow', bone: 'LeftHand' }, { key: 'axeR', kind: 'axe', bone: 'RightHand' }, { key: 'axeL', kind: 'axeL', bone: 'LeftHand' }, { key: 'arrow', kind: 'arrow', bone: 'RightHand' }],
  },
  // Ullr's finale form, "Bowelius the Clown": his own rig in a clown suit, dancing (two Meshy hip-hop clips)
  ullr_clown: {
    eyes: [3.4, 12.6, 8.6], eyeColor: [1.0, 0.5, 0.75], eyeSize: 0.01, rim: [0xffc0e0, 0.22, 2.4], env: 1.2,
    hands: {},
    loco: { mode: 'run', lean: 6 * DEG, twistW: 0.15, twistR: 0.25, maxTwist: 25 * DEG, calm: 0.4, waddle: 3 * DEG, fx: null },
    acts: {
      ...COMMON_ACTS,
      dance1: { clip: 'dance1', from: 0, to: 3.38, rate: 1.0, fadeIn: 0.15, fadeOut: 0.2, full: 1, yaw: 0, rootFix: true },
      dance2: { clip: 'dance2', from: 0, to: 6.1, rate: 1.05, fadeIn: 0.2, fadeOut: 0.3, full: 1, yaw: 0, rootFix: true },
    },
    fx: 'gold', channel: { clip: 'charged', legs: 'stand', lift: 0 },
  },
  // Cookie Monster (owner-only): a hulking brute with a giant cookie for a head. Clips: punches = Meshy "Punch Combo"
  // (jab ~0.89 s, haymaker ~1.41 s), hammer = "Heavy Hammer Swing" (both fists overhead, slams down ~1.41 s),
  // scream = "Zombie Scream" (crouched roar 1.0-1.9 s), sprint = "Male Head Down Charge" (a heavy, head-down run),
  // drink = Bacchus's drink (the hand-to-mouth he eats his passive cookies with; left hand, the right holds his cookie)
  cookie: {
    eyes: [8, 27, 32], eyeColor: [1.0, 0.42, 0.08], eyeSize: 3.0,   // (the cookie face: measured, ~27 cm above / 32 cm in front of the Head bone)
    rim: [0xff6a20, 0.22, 2.4], env: 1.15,
    hands: {},
    // heavy: run_f = Meshy "Monster Walk" (a lumbering walk, slow speeds), sprint = "Male Head Down Charge" (the head-down
    // charge at speed); full vertical bob, a wide planted stance, rolling shoulders, a forward lean; the kit adds the
    // footfall impacts (a nod through the spine, camera thumps, crumb puffs)
    loco: { mode: 'run', lean: 11 * DEG, twistW: 0.15, twistR: 0.25, maxTwist: 20 * DEG, calm: 0.15, upright: 0.15, width: 1.35, waddle: 5 * DEG, crouch: 0.05, bob: 1.0, tier: [1.8, 3.8], fx: 'crumb' },
    acts: {
      ...COMMON_ACTS,
      punch1: { clip: 'punches', from: 0.47, to: 1.09, rate: 1.5, fadeIn: 0.08, fadeOut: 0.24, full: 0.6, yaw: 10 },
      punch2: { clip: 'punches', from: 1.09, to: 1.82, rate: 1.5, fadeIn: 0.08, fadeOut: 0.26, full: 0.6, yaw: 10 },
      smash: { clip: 'hammer', from: 0.31, to: 1.82, rate: 1.5, fadeIn: 0.1, fadeOut: 0.3, full: 0.85, yaw: 0 },
      hurl: { clip: 'cast_throw', from: 0.6, to: 1.85, rate: 1.15, fadeIn: 0.16, fadeOut: 0.42, full: 0.75, yaw: 12 },
      plant: { clip: 'cast_crouch', from: 0.55, to: 1.65, rate: 1.7, fadeIn: 0.1, fadeOut: 0.3, full: 0.85, yaw: 0 },
      roar: { clip: 'scream', from: 0.52, to: 2.2, rate: 1.15, fadeIn: 0.12, fadeOut: 0.35, full: 1, yaw: 0 },
      eat: { clip: 'drink', keys: [[0, 2.2], [0.5, 3.9], [1.2, 4.7], [1.6, 5.6]], fadeIn: 0.15, fadeOut: 0.35, full: 0, yaw: 0 },
      clapwind: { clip: 'hammer', keys: [[0, 0.31], [0.3, 0.9], [0.45, 1.05]], fadeIn: 0.08, fadeOut: 0.2, full: 1, yaw: 0 },
      // v4: chomp = Meshy 132 "mage_soell_cast_3" (a two-handed lunge, the hands slam together forward ~1.05 s = the bite);
      // clap = Meshy 130 "mage_soell_cast_1" (arms flung wide 1.5-2.2 s, then brought together, hands meet ~2.68 s) for Cookie Horror
      chomp: { clip: 'chomp', from: 0.15, to: 1.75, rate: 1.9, fadeIn: 0.07, fadeOut: 0.3, full: 1, yaw: 0, rootFix: true },
      clap: { clip: 'clap', keys: [[0, 1.45], [0.22, 1.7], [0.4, 2.2], [0.62, 2.68], [1.3, 3.3]], fadeIn: 0.06, fadeOut: 0.35, full: 1, yaw: 0, rootFix: true },
    },
    fx: 'caramel', prop: 'cookie', propL: 'cookieS', channel: { clip: 'charged', legs: 'stand', lift: 0 },
  },
  // Cookie Rage (his F form), v3: 4.75 m, a real dual-sword brute. Clips (Meshy, rigged on the rage mesh): wcombo = "Weapon_Combo"
  // (199: a flowing three-swing right-hand combo - rising slash ~0.72 s, sweep ~1.45 s, overhead diagonal chop ~2.27 s - stepping
  // forward ~1.2 m per swing), mirrored into wcomboM for the left sword; spinslash = "Charged_Upward_Slash" (221: coiled windup,
  // rising slash ~1.05 s that spins him round, turning back by ~2.2 s); dspin = "Double_Blade_Spin" (91: a genuine two-blade
  // move - low double sweep ~0.6 s, a spinning leap, both blades crashing down on landing ~1.65 s, crouched by 1.8 s);
  // slam = "Heavy Hammer Swing" (both swords overhead, down ~1.41 s); warcry = "Sword_Shout" (101: the sword thrust to the sky,
  // 1.0-2.4 s); roar = "Zombie Scream". The swings carry their own root motion (rootMotion: the kit steps him forward with the
  // clip, feet planted) and overlap with long crossfades: each swing's follow-through melts into the next one's anticipation.
  cookie_rage: {
    eyes: [32, 40, 98], eyeColor: [1.0, 0.32, 0.03], eyeSize: 13.0, rim: [0xff4a08, 0.34, 2.2], env: 1.1,   // (the angry face on the cookie disc: ~40 cm above / ~1 m in front of the Head bone; blazing in rage)
    magma: { color: [1.0, 0.28, 0.03], lo: 0.3, hi: 0.62, k: 1.2 },   // his lava cracks glow (the kit pulses them with his breathing)
    hands: {},
    mirror: { wcombo: 'wcomboM' },
    loco: { mode: 'run', lean: 12 * DEG, twistW: 0.15, twistR: 0.25, maxTwist: 20 * DEG, calm: 0.15, upright: 0.15, width: 1.5, waddle: 6 * DEG, crouch: 0.06, bob: 1.0, fx: 'crumb' },
    acts: {
      ...COMMON_ACTS,
      // the combo chain (11i_cookie.js CM_CHAIN): right chop, left chop, right sweep, the spinning rising slash, a finisher
      wC: { clip: 'wcombo', from: 1.86, to: 3.25, rate: 1.3, fadeIn: 0.24, fadeOut: 0.45, full: 0.85, yaw: 22, rootMotion: 1 },
      wCL: { clip: 'wcomboM', from: 1.86, to: 3.25, rate: 1.3, fadeIn: 0.24, fadeOut: 0.45, full: 0.85, yaw: -22, rootMotion: 1 },
      wB: { clip: 'wcombo', from: 1.0, to: 2.2, rate: 1.25, fadeIn: 0.24, fadeOut: 0.3, full: 0.85, yaw: 22, rootMotion: 1 },
      wA: { clip: 'wcombo', from: 0.3, to: 1.25, rate: 1.3, fadeIn: 0.22, fadeOut: 0.34, full: 0.85, yaw: 22, rootMotion: 1 },
      ss: { clip: 'spinslash', from: 0.3, to: 2.45, rate: 1.55, fadeIn: 0.26, fadeOut: 0.4, full: 0.9, yaw: 20, noDrift: true },
      ds: { clip: 'dspin', from: 0.3, to: 2.3, rate: 1.12, fadeIn: 0.24, fadeOut: 0.6, full: 1, yaw: 20, rootMotion: 0.8 },
      rs3: { clip: 'slam', from: 0.2, to: 1.87, rate: 1.3, fadeIn: 0.2, fadeOut: 0.45, full: 0.95, yaw: 0 },
      // legacy swings (kept for the bots / fallbacks)
      rs1: { clip: 'chops', from: 0.3, to: 1.35, rate: 1.5, fadeIn: 0.14, fadeOut: 0.32, full: 0.55, yaw: 10 },
      rs2: { clip: 'chops', from: 1.4, to: 2.45, rate: 1.5, fadeIn: 0.14, fadeOut: 0.32, full: 0.55, yaw: 10 },
      rs4: { clip: 'combo', from: 0.1, to: 1.0, rate: 1.4, fadeIn: 0.14, fadeOut: 0.32, full: 0.55, yaw: 8 },
      roar: { clip: 'warcry', from: 0.45, to: 3.0, rate: 1.05, fadeIn: 0.2, fadeOut: 0.5, full: 1, yaw: 0 },   // the transform: the sword thrust to the sky
      roar2: { clip: 'roar', from: 0.9, to: 1.9, rate: 1.1, fadeIn: 0.25, fadeOut: 0.4, full: 0.15, yaw: 0 },   // the periodic roar (only between swings)
      // v4 rage abilities: cross = Meshy 242 "Charged_Slash" (blades crossed at ~1.05 s, torn apart ~1.25 s: Burning Cross);
      // sky = Meshy 102 "Sword_Judgment" (crouch, leap ~0.6-1.0 s, crashing down ~1.3 s: Skyfall), time-warped for a long flight
      cross: { clip: 'cross', from: 0.2, to: 2.1, rate: 1.7, fadeIn: 0.12, fadeOut: 0.35, full: 1, yaw: 0, rootFix: true },
      sky: { clip: 'skyfall', keys: [[0, 0.1], [0.3, 0.55], [0.42, 0.72], [1.02, 0.95], [1.16, 1.3], [1.75, 1.85]], fadeIn: 0.1, fadeOut: 0.4, full: 1, yaw: 0, rootFix: true },
    },
    fx: 'caramel', channel: { clip: 'charged', legs: 'stand', lift: 0 },
    props: [{ key: 'swordR', kind: 'csword', bone: 'RightHand' }, { key: 'swordL', kind: 'csword', bone: 'LeftHand' }],
  },
};

function slimSkinnedMesh(mesh) {
  const sk = mesh.skeleton, pos = mesh.geometry.attributes.position;
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  if (!sk || !si || !sw || mesh.geometry.userData.slimmed) return;   // (clones share the geometry: slim it once)
  mesh.geometry.userData.slimmed = true;
  const idx = {}; sk.bones.forEach((b, i) => { idx[b.name] = i; });
  const J = sk.bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[i]).invert()));
  const seg = sk.bones.map((b, i) => {
    const f = SLIM[b.name], n = idx[SLIM_NEXT[b.name]];
    return f && n !== undefined ? { a: J[i], ab: J[n].clone().sub(J[i]), f } : null;
  });
  // bind space = bindMatrix * position (mesh.bindMatrixInverse follows matrixWorld in 'attached' mode, so invert it here)
  const bm = mesh.bindMatrix, bmi = bm.clone().invert();
  const v = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).applyMatrix4(bm);
    d.set(0, 0, 0);
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(k, j); if (w <= 0) continue;
      const s = seg[si.getComponent(k, j)]; if (!s) continue;
      const t = clamp(p.copy(v).sub(s.a).dot(s.ab) / s.ab.lengthSq(), 0, 1);
      p.copy(s.a).addScaledVector(s.ab, t).sub(v);   // toward the closest point on the bone axis
      d.addScaledVector(p, w * (1 - s.f));
    }
    v.add(d).applyMatrix4(bmi);
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}

class RigPose {
  constructor(n) { this.q = new Float32Array(n * 4); this.p = new Float32Array(3); }
  copy(o) { this.q.set(o.q); this.p.set(o.p); return this; }
}

class ClipSampler {
  constructor(clip, rig) {
    this.clip = clip; this.duration = clip.duration;
    this.rot = new Array(rig.n).fill(null); this.pos = null;
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const i = rig.index[tr.name.slice(0, dot)], prop = tr.name.slice(dot + 1);
      if (i === undefined) continue;
      if (prop === 'quaternion') this.rot[i] = tr.createInterpolant();
      else if (prop === 'position' && i === rig.hipsIndex) this.pos = tr.createInterpolant();
    }
  }
  sample(t, pose, rig) {
    t = clamp(t, 0, this.duration);
    for (let i = 0; i < rig.n; i++) {
      const it = this.rot[i], o = i * 4;
      if (it) { const r = it.evaluate(t); pose.q[o] = r[0]; pose.q[o + 1] = r[1]; pose.q[o + 2] = r[2]; pose.q[o + 3] = r[3]; }
      else { pose.q[o] = rig.rest.q[o]; pose.q[o + 1] = rig.rest.q[o + 1]; pose.q[o + 2] = rig.rest.q[o + 2]; pose.q[o + 3] = rig.rest.q[o + 3]; }
    }
    if (this.pos) { const r = this.pos.evaluate(t); pose.p[0] = r[0]; pose.p[1] = r[1]; pose.p[2] = r[2]; }
    else pose.p.set(rig.rest.p);
    return pose;
  }
  sampleLoop(t, pose, rig) { const d = this.duration; return this.sample(((t % d) + d) % d, pose, rig); }
}

// A clip played with the other hand: every bone takes the motion of its Left/Right twin, reflected
// through the body's mid-plane (x -> -x in model space). Each bone's rotation is handled as a
// model-space delta from the rest pose, so it works without knowing the rig's local axis conventions
// (the A-pose rigs are close to symmetric).
const _mq = new THREE.Quaternion(), _mv = new THREE.Vector3();
class MirrorSampler {
  constructor(src, rig) {
    this.src = src; this.duration = src.duration; this.tmp = new RigPose(rig.n);
    const n = rig.n, bl = rig.boneList;
    this.twin = new Int32Array(n); this.par = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const nm = bl[i].name, tn = nm.startsWith('Left') ? 'Right' + nm.slice(4) : nm.startsWith('Right') ? 'Left' + nm.slice(5) : nm;
      this.twin[i] = rig.index[tn] ?? i;
      const pn = bl[i].parent ? rig.index[bl[i].parent.name] : undefined;
      this.par[i] = pn === undefined ? -1 : pn;
    }
    // model-space transform of every root bone's (non-bone) parent, then the rest pose in model space
    rig.model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(rig.model.matrixWorld).invert(), pp = new THREE.Vector3(), sc = new THREE.Vector3();
    this.A = new Array(n).fill(null); this.Am = new Array(n).fill(null); this.AmInv = new Array(n).fill(null);
    for (let i = 0; i < n; i++) if (this.par[i] < 0) {
      const m = new THREE.Matrix4().multiplyMatrices(inv, bl[i].parent.matrixWorld), q = new THREE.Quaternion();
      m.decompose(pp, q, sc); this.A[i] = q; this.Am[i] = m; this.AmInv[i] = m.clone().invert();
    }
    this.G = Array.from({ length: n }, () => new THREE.Quaternion()); this.G2 = Array.from({ length: n }, () => new THREE.Quaternion());
    this.G0 = Array.from({ length: n }, () => new THREE.Quaternion());
    this.toModel(rig.rest.q, this.G0, n);
    this.G0inv = this.G0.map((g) => g.clone().invert());
  }
  toModel(q, out, n) {   // boneList is parent-first (scene traverse order)
    for (let i = 0; i < n; i++) { const pi = this.par[i]; out[i].copy(pi >= 0 ? out[pi] : this.A[i]).multiply(_mq.fromArray(q, i * 4)); }
  }
  sample(t, pose, rig) {
    const n = rig.n, S = this.src.sample(t, this.tmp, rig), G = this.G, G2 = this.G2;
    this.toModel(S.q, G, n);
    for (let i = 0; i < n; i++) {   // the twin's model-space delta, reflected, re-applied to this bone's rest
      const j = this.twin[i];
      _mq.copy(G[j]).multiply(this.G0inv[j]);
      _mq.set(_mq.x, -_mq.y, -_mq.z, _mq.w);
      G2[i].copy(_mq).multiply(this.G0[i]);
    }
    for (let i = 0; i < n; i++) { const pi = this.par[i]; _mq.copy(pi >= 0 ? G2[pi] : this.A[i]).invert().multiply(G2[i]).toArray(pose.q, i * 4); }
    const hi = rig.hipsIndex;
    if (this.Am[hi]) { _mv.fromArray(S.p).applyMatrix4(this.Am[hi]); _mv.x = -_mv.x; _mv.applyMatrix4(this.AmInv[hi]).toArray(pose.p); } else pose.p.set(S.p);
    return pose;
  }
  sampleLoop(t, pose, rig) { const d = this.duration; return this.sample(((t % d) + d) % d, pose, rig); }
}

// out = slerp(a, b, w * mask[i]); out may alias a or b
function blendPose(out, a, b, w, mask = null, rig = null, posW = null) {
  const n = a.q.length / 4;
  for (let i = 0; i < n; i++) {
    const wi = mask ? w * mask[i] : w;
    if (wi <= 0.0005) { if (out !== a) for (let k = 0; k < 4; k++) out.q[i * 4 + k] = a.q[i * 4 + k]; continue; }
    THREE.Quaternion.slerpFlat(out.q, i * 4, a.q, i * 4, b.q, i * 4, Math.min(1, wi));
  }
  const pw = posW ?? (mask && rig ? w * mask[rig.hipsIndex] : w);
  for (let k = 0; k < 3; k++) out.p[k] = lerp(a.p[k], b.p[k], clamp(pw, 0, 1));
  return out;
}

const _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rv = new THREE.Vector3(), _rv2 = new THREE.Vector3();
// rotate a bone about a WORLD axis (applied on top of its current local rotation)
function rotateBoneWorld(bone, axisW, angle) {
  if (Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_rq2);
  _rv.copy(axisW).applyQuaternion(_rq2.invert());
  _rq.setFromAxisAngle(_rv, angle);
  bone.quaternion.premultiply(_rq);
}
// ---- IK helpers (world space, independent of each rig's bone-axis conventions)
const _ik = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), n: new THREE.Vector3(), e: new THREE.Vector3(),
  t: new THREE.Vector3(), u: new THREE.Vector3(), w: new THREE.Vector3(), x: new THREE.Vector3(),
  qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), qc: new THREE.Quaternion(), id: new THREE.Quaternion(), ma: new THREE.Matrix4(), mb: new THREE.Matrix4() };
// turn a bone so that world direction `from` becomes `to` (weight: fraction of that turn)
function aimBoneWorld(bone, from, to, weight = 1) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const q = _ik.qa.setFromUnitVectors(from.normalize(), to.normalize());
  if (weight < 1) q.slerp(_ik.id, 1 - weight);
  bone.parent.getWorldQuaternion(_ik.qb);
  q.premultiply(_ik.qc.copy(_ik.qb).invert()).multiply(_ik.qb); // parent-local: P^-1 q P
  bone.quaternion.premultiply(q);
}
// analytic two-bone IK: upper/lower reach `target` with the middle joint bending toward `poleDir`
function solveTwoBoneIK(upper, lower, end, target, poleDir, weight = 1) {
  const A = _ik.a.setFromMatrixPosition(upper.matrixWorld), B = _ik.b.setFromMatrixPosition(lower.matrixWorld), C = _ik.c.setFromMatrixPosition(end.matrixWorld);
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  const dir = _ik.d.copy(target).sub(A); let L = dir.length(); dir.divideScalar(L || 1);
  L = clamp(L, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.004);
  const n = _ik.n.copy(poleDir).addScaledVector(dir, -poleDir.dot(dir)).normalize();
  const cosA = clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
  const E = _ik.e.copy(A).addScaledVector(dir, cosA * l1).addScaledVector(n, Math.sqrt(1 - cosA * cosA) * l1);
  aimBoneWorld(upper, _ik.u.copy(B).sub(A), _ik.w.copy(E).sub(A), weight);
  upper.updateMatrixWorld(true);
  B.setFromMatrixPosition(lower.matrixWorld); C.setFromMatrixPosition(end.matrixWorld);
  const T = _ik.t.copy(A).addScaledVector(dir, L);
  aimBoneWorld(lower, _ik.u.copy(C).sub(B), _ik.w.copy(T).sub(B), weight);
  lower.updateMatrixWorld(true);
}
// slerp along an explicit arc of the 4D sphere: the short one, or the long way round
function slerpArc(a, b, t, long, out) {
  let d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w, s = 1;
  if ((d < 0) !== long) { s = -1; d = -d; }
  if (d > 0.9995) return out.set(a.x + (s * b.x - a.x) * t, a.y + (s * b.y - a.y) * t, a.z + (s * b.z - a.z) * t, a.w + (s * b.w - a.w) * t).normalize();
  const om = Math.acos(Math.max(-1, d)), so = Math.sin(om);
  const k0 = Math.sin((1 - t) * om) / so, k1 = s * Math.sin(t * om) / so;
  return out.set(a.x * k0 + b.x * k1, a.y * k0 + b.y * k1, a.z * k0 + b.z * k1, a.w * k0 + b.w * k1).normalize();
}
const _arcS = new THREE.Quaternion(), _arcL = new THREE.Quaternion();
// set a bone's world orientation from two directions: its local Y -> yDir, local `pAxis` -> pDir.
// `memo` ({ q, f }, plus the caller's frame number) keeps a partial blend on the arc it took last
// frame: where the animated pose and the target drift ~180 degrees apart, the plain shortest-arc
// slerp would whip the bone round to the other side in a single frame
function orientBoneWorld(bone, yDir, pDir, pAxis, weight = 1, memo = null, frame = 0) {
  const z = _ik.x.crossVectors(yDir, pDir);
  _ik.ma.makeBasis(yDir, pDir, z);
  const yl = _ik.u.set(0, 1, 0), zl = _ik.w.crossVectors(yl, pAxis);
  _ik.mb.makeBasis(yl, pAxis, zl).transpose();
  _ik.qa.setFromRotationMatrix(_ik.ma.multiply(_ik.mb));      // world rotation wanted for the bone
  bone.parent.getWorldQuaternion(_ik.qb);
  _ik.qa.premultiply(_ik.qb.invert());                          // -> parent-local
  if (!memo || weight >= 0.999) bone.quaternion.slerp(_ik.qa, weight);
  else {
    slerpArc(bone.quaternion, _ik.qa, weight, false, _arcS);
    let q = _arcS;
    if (memo.f === frame - 1) {
      slerpArc(bone.quaternion, _ik.qa, weight, true, _arcL);
      if (Math.abs(_arcL.dot(memo.q)) > Math.abs(_arcS.dot(memo.q))) q = _arcL;
    }
    bone.quaternion.copy(q);
  }
  if (memo) { memo.q.copy(bone.quaternion); memo.f = frame; }
}

// Rim/fresnel glow for SMITE-style readability + optional colour grading of the generated
// textures (patched into the standard material)
// magma (optional): { color: [r,g,b], lo, hi } - the albedo's saturated-red lava cracks glow (diffuse.r - diffuse.g picks them
// out of the crust and the chocolate); mat.userData.magmaK.value is the live heat (the kit pulses it with his breathing)
function addRimLight(mat, color = 0x6fc8ff, strength = 0.35, power = 3.0, grade = null, magma = null) {
  mat.userData.rim = { value: new THREE.Color(color) };
  mat.userData.rimStrength = { value: strength };
  mat.userData.flash = { value: new THREE.Color(0, 0, 0) };
  mat.userData.magmaK = { value: magma ? (magma.k ?? 0) : 0 };
  mat.userData.magmaColor = { value: new THREE.Color(...(magma ? magma.color : [1, 0.3, 0.05])) };
  const G = grade, MG = magma;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = mat.userData.rim; sh.uniforms.rimStrength = mat.userData.rimStrength; sh.uniforms.flashColor = mat.userData.flash;
    sh.uniforms.magmaK = mat.userData.magmaK; sh.uniforms.magmaColor = mat.userData.magmaColor;
    let fs = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimStrength; uniform vec3 flashColor; uniform float magmaK; uniform vec3 magmaColor; float mgMask = 0.0;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(2)});
        totalEmissiveRadiance += rimColor * rimF * rimStrength + flashColor + magmaColor * mgMask * magmaK;`);
    if (MG) fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
        mgMask = smoothstep(${(MG.lo ?? 0.35).toFixed(3)}, ${(MG.hi ?? 0.65).toFixed(3)}, diffuseColor.r - max(diffuseColor.g, diffuseColor.b) * 1.1);
        mgMask *= mgMask;`);
    if (G) {
      const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(', ')})`;
      fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
        float gLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float gK = smoothstep(${G.lo.toFixed(3)}, ${G.hi.toFixed(3)}, gLum);
        diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(${G.gamma.toFixed(3)})) * mix(${v3(G.dark)}, ${v3(G.light)}, gK);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = max(metalnessFactor, gK * ${G.metal.toFixed(3)});
        roughnessFactor = mix(roughnessFactor, ${G.rough.toFixed(3)}, gK * 0.85);`);
    }
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'rim' + power + (G ? JSON.stringify(G) : '') + (MG ? 'mg' + MG.lo + MG.hi : '');
  mat.needsUpdate = true;
}

let _glowSpriteTex = null;
function glowSpriteTexture() {
  if (_glowSpriteTex) return _glowSpriteTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glowSpriteTex = new THREE.CanvasTexture(c); _glowSpriteTex.colorSpace = THREE.SRGBColorSpace;
  return _glowSpriteTex;
}

// ---------------------------------------------------------------------------
// Held props (built in metres; attached to the hand bone, whose space is in centimetres)
// ---------------------------------------------------------------------------
function makeIceSpear() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.55, metalness: 0.6 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc8d6e8, roughness: 0.25, metalness: 1.0, emissive: new THREE.Color(0.1, 0.25, 0.45), emissiveIntensity: 0.6 });
  const ice = new THREE.MeshPhysicalMaterial({ color: 0x9fe4ff, roughness: 0.08, metalness: 0.1, transmission: 0.2, thickness: 0.2, emissive: new THREE.Color(0.25, 0.75, 1.0), emissiveIntensity: 1.6, transparent: true, opacity: 0.92 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2.3, 10), wood); shaft.position.y = 0.25; g.add(shaft);
  for (const y of [-0.72, -0.2, 0.35, 1.18]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 14), silver); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const collar = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), silver); collar.position.y = 1.43; collar.rotation.x = Math.PI; g.add(collar);
  // the spearhead: a long jagged ice crystal with two side shards
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), ice); head.scale.set(0.055, 0.34, 0.03); head.position.y = 1.72; g.add(head);
  for (const s of [1, -1]) { const sh = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), ice); sh.scale.set(0.03, 0.13, 0.02); sh.position.set(s * 0.05, 1.5, 0); sh.rotation.z = s * 0.5; g.add(sh); }
  const butt = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), ice); butt.scale.set(0.03, 0.09, 0.03); butt.position.y = -0.95; g.add(butt);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.4, 0.85, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
  glow.scale.setScalar(0.5); glow.position.y = 1.72; glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 1.95, 0), glow, ice };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeSunStaff() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc35a, roughness: 0.22, metalness: 1.0, emissive: new THREE.Color(0.35, 0.18, 0.02), emissiveIntensity: 0.5 });
  const lapis = new THREE.MeshStandardMaterial({ color: 0x1d3f9a, roughness: 0.3, metalness: 0.2 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 2.1, 10), gold); shaft.position.y = 0.2; g.add(shaft);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.05, 10), i % 2 ? lapis : gold); b.position.y = -0.6 + i * 0.32; g.add(b); }
  // falcon-headed was-sceptre top cradling a burning sun disc
  const fork = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 24, Math.PI), gold); fork.position.y = 1.28; fork.rotation.z = Math.PI; g.add(fork);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: new THREE.Color(1.0, 0.45, 0.08), emissiveIntensity: 3.2, roughness: 0.3 }));
  disc.position.y = 1.4; g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 8, 32), gold); ring.position.y = 1.4; g.add(ring);
  const uraeus = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 6), gold); uraeus.position.set(0, 1.4, 0.1); uraeus.rotation.x = 0.3; g.add(uraeus);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1.0, 0.62, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  glow.scale.setScalar(0.85); glow.position.y = 1.4; glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 1.4, 0), glow, disc };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Hecate's sceptre: the key to the underworld (the same model her finale summons), gems aglow
function makeKeyStaff() {
  const g = new THREE.Group();
  const src = Assets.glb.hecate_key;
  if (src) {
    const m = src.scene.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0.32, 0.08, 0.6); o.material.emissiveIntensity = 0.55; o.castShadow = true; } });
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    const k = 1.55 / size.y; m.scale.setScalar(k); m.position.y = -box.min.y * k - 0.55;   // gripped a third of the way up the shaft
    g.add(m);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.62, 0.22, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  glow.scale.setScalar(0.7); glow.position.y = 0.8; glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 0.8, 0), glow };
  return g;
}
// Hecate's torch (dadophoros): a bronze torch burning with violet witchfire
function makeTorch() {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.35, metalness: 0.9, emissive: new THREE.Color(0.08, 0.02, 0.12), emissiveIntensity: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.62, 10), bronze); shaft.position.y = 0.05; g.add(shaft);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.03, 0.12, 14, 1, true), bronze); cup.position.y = 0.42; g.add(cup);
  for (const y of [-0.12, 0.2]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 14), bronze); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.75, 0.2, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  glow.scale.setScalar(0.55); glow.position.y = 0.55; glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 0.55, 0), glow };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Bacchus's wine jug (assets/web/bacchus_jug: a Tripo ewer one unit tall, base at y 0, handle on -x and
// spout on +x), held by its handle with the mouth up; userData.tip is the spout the wine pours from
const JUG = { h: 0.56, grip: [-0.235, 0.7, 0], tip: [0.21, 0.97, 0] };
function makeJug() {
  const g = new THREE.Group(), inner = new THREE.Group(), src = Assets.glb.bacchus_jug, k = JUG.h;
  g.add(inner);
  if (src) {
    const m = src.scene.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.envMapIntensity = 1.35; o.castShadow = true; o.frustumCulled = false; } });
    inner.add(m);
  } else {   // fallback: a lathed bronze ewer
    const pts = [[0.13, 0], [0.16, 0.08], [0.24, 0.3], [0.26, 0.45], [0.2, 0.62], [0.1, 0.74], [0.12, 0.86], [0.2, 0.97], [0.18, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
    inner.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: 0xb8862e, metalness: 0.9, roughness: 0.32 })));
  }
  inner.scale.setScalar(k);
  inner.position.set(-JUG.grip[0] * k, -JUG.grip[1] * k, -JUG.grip[2] * k);
  const tip = new THREE.Vector3((JUG.tip[0] - JUG.grip[0]) * k, (JUG.tip[1] - JUG.grip[1]) * k, (JUG.tip[2] - JUG.grip[2]) * k);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.42, 0.02, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  glow.scale.setScalar(0.32); glow.position.copy(tip); glow.renderOrder = 6; g.add(glow);
  g.userData = { tip, glow, inner };
  return g;
}
// ---- Ullr's weapons (procedural, metres; long axis +Y, grip at the origin, "front" +Z) -----------
// shared materials and a rune strip texture (Elder Futhark, glowing frost-blue on transparent)
let _ullrMats = null;
function ullrMats() {
  if (_ullrMats) return _ullrMats;
  const c = document.createElement('canvas'); c.width = 64; c.height = 1024;
  const g = c.getContext('2d'); g.clearRect(0, 0, 64, 1024);
  g.font = '44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(30,220,120,1)'; g.shadowBlur = 14; g.fillStyle = '#c8ffdc';
  const runes = 'ᚢᛚᛚᚱ ᛒᛟᚹ ᛃᚨᚷᛏ ᚹᛁᚾᛏᚱ ᛞᚢᛖᛚ';
  for (let i = 0, y = 34; y < 1000; i++, y += 50) g.fillText(runes[i % runes.length], 32, y);
  const runeTex = new THREE.CanvasTexture(c); runeTex.colorSpace = THREE.SRGBColorSpace;
  _ullrMats = {
    yew: new THREE.MeshStandardMaterial({ color: 0x2e1b10, roughness: 0.42, metalness: 0.05 }),   // dark polished yew (v2 look)
    yewDark: new THREE.MeshStandardMaterial({ color: 0x2a170c, roughness: 0.6 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.75 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc6d6ea, roughness: 0.22, metalness: 1.0, emissive: new THREE.Color(0.05, 0.14, 0.3), emissiveIntensity: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0a83a, roughness: 0.28, metalness: 1.0, emissive: new THREE.Color(0.18, 0.09, 0.01), emissiveIntensity: 0.5 }),
    goldWrap: new THREE.MeshStandardMaterial({ color: 0xb8862a, roughness: 0.45, metalness: 0.85 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd2d8e0, roughness: 0.2, metalness: 1.0, emissive: new THREE.Color(0.02, 0.04, 0.08), emissiveIntensity: 0.4 }),
    ice: new THREE.MeshStandardMaterial({ color: 0x2fd884, roughness: 0.1, metalness: 0.2, emissive: new THREE.Color(0.02, 0.65, 0.28), emissiveIntensity: 1.8, transparent: true, opacity: 0.92 }),   // (emerald, despite the name)
    glowLine: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.85, 0.4).multiplyScalar(2.0), toneMapped: false }),
    string: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.9, 0.5).multiplyScalar(1.5), toneMapped: false }),
    runes: new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.1, 0.9, 0.45).multiplyScalar(2.0), toneMapped: false, side: THREE.DoubleSide }),
    fletch: new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.7, side: THREE.DoubleSide }),
  };
  return _ullrMats;
}
// a tapered, flattened rod along a centre line (pts: [x, y, z, rx, rz] per ring)
function ullrRod(pts, n = 10) {
  const pos = [], idx = [];
  pts.forEach(([x, y, z, rx, rz]) => { for (let j = 0; j < n; j++) { const a = (j / n) * TAU; pos.push(x + Math.cos(a) * rx, y, z + Math.sin(a) * rz); } });
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + ((j + 1) % n), c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// a flat ribbon along a centre line, facing +Z (the rune inlay on the bow's back)
function ullrRibbon(pts, w) {
  const pos = [], uv = [], idx = [];
  pts.forEach(([x, y, z], i) => { pos.push(x - w, y, z, x + w, y, z); const v = i / (pts.length - 1); uv.push(0, v, 1, v); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// the great longbow (v2 look): dark yew with gold fittings, a glowing rune inlay down the back, a frost string
const ULLR_BOW = { half: 0.9, brace: 0.13 };
function makeUllrBow() {
  const M = ullrMats(), g = new THREE.Group(), H = ULLR_BOW.half;
  // limb profile (top half; the bottom mirrors it): y, back offset z (the string side is -z), width, thickness
  const prof = [[0, 0.0, 0.03, 0.026], [0.12, 0.004, 0.032, 0.024], [0.3, -0.012, 0.03, 0.019], [0.5, -0.04, 0.025, 0.015], [0.68, -0.075, 0.019, 0.012], [0.8, -0.1, 0.014, 0.01], [0.86, -0.1, 0.012, 0.009], [0.9, -0.07, 0.01, 0.008]];
  const pts = [];
  for (let i = prof.length - 1; i > 0; i--) { const [y, z, w, t] = prof[i]; pts.push([0, -y * H / 0.9, z, w, t]); }
  for (const [y, z, w, t] of prof) pts.push([0, y * H / 0.9, z, w, t]);
  g.add(new THREE.Mesh(ullrRod(pts, 12), M.yew));
  // runes inlaid along the back of both limbs
  const rp = pts.filter((p) => Math.abs(p[1]) > 0.1 && Math.abs(p[1]) < 0.82).map(([x, y, z, w, t]) => [x, y, z + t + 0.002]);
  const rib = new THREE.Mesh(ullrRibbon(rp, 0.011), M.runes); rib.renderOrder = 7; g.add(rib);
  // leather-wrapped grip with silver bands and a frost crystal set into the riser
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.16, 12), M.leather); g.add(grip);
  for (const y of [-0.085, 0.085, -0.3, 0.3]) { const b = new THREE.Mesh(new THREE.TorusGeometry(Math.abs(y) > 0.1 ? 0.027 : 0.031, 0.007, 6, 16), M.gold); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), M.ice); gem.scale.set(0.022, 0.045, 0.014); gem.position.set(0, 0.13, 0.024); g.add(gem);
  // silver tips (nocks) with little ice spikes
  for (const s of [1, -1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.08, 8), M.gold); tip.position.set(0, s * (H + 0.02), -0.07); tip.rotation.x = s > 0 ? -0.5 : Math.PI + 0.5; g.add(tip);
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), M.ice); sp.scale.set(0.008, 0.035, 0.008); sp.position.set(0, s * (H - 0.03), -0.04); sp.rotation.x = s * 0.6; g.add(sp);
  }
  // the string: a thin glowing line between the nocks (the nock point can be pulled back while drawing)
  const nockY = H * 0.94, sz = -0.095;
  const strTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 5), M.string), strBot = strTop.clone();
  g.add(strTop, strBot);
  const nock = new THREE.Vector3(0, 0, sz);
  const placeString = (pull = 0) => {
    nock.set(0, 0, sz - pull);
    for (const [m, s] of [[strTop, 1], [strBot, -1]]) {
      const a = new THREE.Vector3(0, s * nockY, -0.08), d = a.clone().sub(nock), L = d.length();
      m.position.copy(nock).addScaledVector(d, 0.5); m.scale.set(1, L, 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
  };
  placeString(0);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.05, 0.75, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  glow.scale.setScalar(0.3); glow.position.set(0, 0.13, 0.03); glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 0.13, 0.04), glow, nock, pull: placeString, runes: rib };
  g.traverse((o) => { if (o.isMesh && o !== rib && o.material !== M.string) o.castShadow = true; });
  return g;
}
// a bearded hand axe (v2 look): gold-wrapped wooden haft, an engraved silver head with a glowing frost edge
function makeUllrAxe(scale = 1) {
  const M = ullrMats(), g = new THREE.Group();
  const haft = new THREE.Mesh(ullrRod([[0, -0.15, 0, 0.016, 0.016], [0, 0.0, 0, 0.018, 0.018], [0, 0.3, 0, 0.017, 0.017], [0, 0.48, 0, 0.019, 0.019], [0, 0.56, 0, 0.017, 0.017]], 10), M.yewDark); g.add(haft);
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.26, 10), M.goldWrap); wrap.position.y = -0.01; g.add(wrap);
  for (const y of [-0.14, 0.12, 0.42]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 6, 14), M.gold); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), M.gold); pommel.position.y = -0.16; g.add(pommel);
  // the head: a bearded blade profile in the (z = forward, y = up) plane, extruded across x
  const sh = new THREE.Shape();
  sh.moveTo(-0.02, 0.555); sh.lineTo(0.06, 0.56); sh.quadraticCurveTo(0.13, 0.565, 0.19, 0.625);
  sh.quadraticCurveTo(0.23, 0.5, 0.2, 0.36); sh.quadraticCurveTo(0.17, 0.3, 0.13, 0.27);
  sh.quadraticCurveTo(0.09, 0.36, 0.04, 0.42); sh.lineTo(-0.02, 0.43);
  sh.lineTo(-0.05, 0.46); sh.lineTo(-0.075, 0.49); sh.lineTo(-0.05, 0.53); sh.closePath();
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
  hg.translate(0, 0, -0.007); hg.rotateY(-Math.PI / 2);   // shape x -> +z (forward), extrusion -> x
  const head = new THREE.Mesh(hg, M.steel); g.add(head);
  // the cutting edge glows frost-blue
  const edge = new THREE.CatmullRomCurve3([[0.19, 0.625], [0.214, 0.55], [0.212, 0.45], [0.2, 0.36], [0.17, 0.3], [0.13, 0.27]].map(([z, y]) => new THREE.Vector3(0, y, z)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(edge, 24, 0.0045, 5, false), M.glowLine));
  // a rune on each face of the blade
  for (const s of [1, -1]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), M.runes); r.position.set(s * 0.012, 0.46, 0.12); r.rotation.y = s * Math.PI / 2; g.add(r); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.05, 0.75, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  glow.scale.setScalar(0.24); glow.position.set(0, 0.46, 0.17); glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 0.46, 0.2), glow };
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh && o.material !== M.runes && o.material !== M.glowLine) o.castShadow = true; });
  return g;
}
// an arrow (long axis +Y, tip at +Y): ash shaft, white fletching, an ice-steel broadhead
function makeUllrArrow(scale = 1) {
  const M = ullrMats(), g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.78, 6), M.yew); shaft.position.y = 0.39 - 0.1; g.add(shaft);
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), M.ice); head.scale.set(0.022, 0.07, 0.006); head.position.y = 0.72; g.add(head);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 6), M.silver); collar.position.y = 0.665; g.add(collar);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.11), M.fletch); f.position.set(Math.cos(i * TAU / 3) * 0.014, -0.03, Math.sin(i * TAU / 3) * 0.014); f.rotation.y = -i * TAU / 3; g.add(f); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.05, 0.75, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  glow.scale.setScalar(0.16); glow.position.y = 0.72; glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, 0.75, 0), glow };
  g.scale.setScalar(scale);
  return g;
}
// ---- Cookie Monster's cookies (assets/web/cookie_prop: a Meshy cookie, normalised here) and burning cookie swords ----
// makeCookieDisc(d): a cookie of diameter d (metres), centred at the origin, its flat faces along +-X (the axle when
// it rolls); falls back to a lathed procedural cookie with a painted crust if the model is missing
let _cookieTex = null;
function cookieCrustTexture() {
  if (_cookieTex) return _cookieTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#b8742c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = `rgba(${90 + v * 120 | 0},${45 + v * 60 | 0},${10 + v * 20 | 0},0.35)`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 5, 0, TAU); g.fill(); }
  for (let i = 0; i < 26; i++) { g.fillStyle = Math.random() < 0.7 ? '#2a1206' : '#3d1a08'; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 10; g.ellipse(x, y, r, r * 0.75, Math.random() * 3, 0, TAU); g.fill(); }
  _cookieTex = new THREE.CanvasTexture(c); _cookieTex.colorSpace = THREE.SRGBColorSpace; _cookieTex.wrapS = _cookieTex.wrapT = THREE.RepeatWrapping;
  return _cookieTex;
}
function makeCookieDisc(d = 1) {
  const g = new THREE.Group(), src = Assets.glb.cookie_prop;
  if (src) {
    const m = src.scene.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group(); wrap.add(m); m.position.sub(ctr);
    // the thinnest box axis is the cookie's axle: turn it onto +X
    const thin = size.x <= size.y && size.x <= size.z ? 'x' : size.y <= size.z ? 'y' : 'z';
    if (thin === 'y') wrap.rotation.z = Math.PI / 2; else if (thin === 'z') wrap.rotation.y = Math.PI / 2;
    const dia = Math.max(...['x', 'y', 'z'].filter((a) => a !== thin).map((a) => size[a]));
    wrap.scale.setScalar(d / dia);
    g.add(wrap);
  } else {
    const r = d / 2, t = d * 0.16;
    const pts = [[0, -t / 2], [r * 0.9, -t / 2], [r, -t * 0.25], [r * 1.0, t * 0.2], [r * 0.9, t / 2], [0, t / 2]].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 40); geo.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: cookieCrustTexture(), roughness: 0.85, color: 0xffffff });
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(0.6, 0.18, 0.02), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  glow.scale.setScalar(d * 0.6); glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, d * 0.45, 0), glow, d };
  return g;
}
// The molten cookie greatsword's two canvas textures (made once): the blade's albedo (dark, glossy tempered chocolate with
// baked-crust edges) and its glow map (branching ember veins running up the blade + a column of carved fire runes, black elsewhere)
let _cswordTex = null;
function cookieSwordTextures() {
  if (_cswordTex) return _cswordTex;
  const R = mulberry32(7171), W = 128, H = 512;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [ca, a] = mk(), [ce, e] = mk();
  // albedo: tempered chocolate, darker toward the spine, a crumbly baked rim on both edges
  const gr = a.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#5a2a0e'); gr.addColorStop(0.18, '#2a1106'); gr.addColorStop(0.5, '#1c0a03'); gr.addColorStop(0.82, '#2a1106'); gr.addColorStop(1, '#6a3412');
  a.fillStyle = gr; a.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const x = R() * W, y = R() * H, r = 0.6 + R() * 2.2; a.fillStyle = `rgba(${R() < 0.5 ? '90,45,15' : '10,4,1'},${0.15 + R() * 0.3})`; a.beginPath(); a.arc(x, y, r, 0, Math.PI * 2); a.fill(); }
  for (const x0 of [0, W - 9]) for (let y = 0; y < H; y += 3) { a.fillStyle = `rgba(${150 + R() * 50 | 0},${80 + R() * 40 | 0},${30 + R() * 20 | 0},0.8)`; a.fillRect(x0 + R() * 4, y, 5 + R() * 4, 3 + R() * 3); }
  // glow: ember veins (random walks that fork, thick and hot near the hilt, thinning toward the tip)
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  e.lineCap = 'round'; e.shadowColor = '#ff5a08';
  const vein = (x, y, w, life) => {
    let ang = -Math.PI / 2 + (R() - 0.5) * 0.6;
    for (let k = 0; k < life && y > 4; k++) {
      const nx = clamp(x + Math.cos(ang) * 7, 10, W - 10), ny = y + Math.sin(ang) * 7;
      e.strokeStyle = `rgb(255,${140 + (w * 25) | 0},${40 + (w * 14) | 0})`; e.lineWidth = w; e.shadowBlur = 5 + w * 2;
      e.beginPath(); e.moveTo(x, y); e.lineTo(nx, ny); e.stroke();
      x = nx; y = ny; ang += (R() - 0.5) * 0.9; ang = clamp(ang, -Math.PI * 0.85, -Math.PI * 0.15); w = Math.max(0.8, w * 0.985);
      if (R() < 0.07 && w > 1.2) vein(x, y, w * 0.65, life * 0.5);
    }
  };
  for (let i = 0; i < 5; i++) vein(18 + R() * (W - 36), H - 4, 3.2 + R() * 1.4, 80);
  // the fire runes, carved down the fuller (simple angular glyph strokes, glowing hot white-gold)
  e.shadowBlur = 8; e.lineWidth = 2.6; e.strokeStyle = '#ffd9a0';
  for (let k = 0; k < 6; k++) {
    const cx = W / 2, cy = H - 70 - k * 58, sz = 11;
    e.beginPath();
    const n = 3 + (R() * 3 | 0);
    for (let j = 0; j < n; j++) { const x0 = cx + (R() - 0.5) * sz * 2, y0 = cy + (R() - 0.5) * sz * 2.4; e.moveTo(x0, y0); e.lineTo(cx + (R() - 0.5) * sz * 2, cy + (R() - 0.5) * sz * 2.4); }
    e.stroke();
  }
  const tA = new THREE.CanvasTexture(ca), tE = new THREE.CanvasTexture(ce);
  tA.colorSpace = THREE.SRGBColorSpace; tE.colorSpace = THREE.SRGBColorSpace; tA.anisotropy = tE.anisotropy = 8;
  _cswordTex = { albedo: tA, glow: tE };
  return _cswordTex;
}
// a molten cookie greatsword (long axis +Y, grip at the origin, edge toward +Z): a broad blade of dark, glossy tempered chocolate
// with a jagged, bitten cookie-crust edge, cracked through with glowing ember veins and carved fire runes that pulse with heat,
// a white-hot edge line, a caramel crossguard and grip. The fire, the heat haze and the sword trails are FX (the kit drives
// userData.heat: the veins, runes and edge glow with it).
function makeCookieSword() {
  const g = new THREE.Group(), TX = cookieSwordTextures();
  const blade = new THREE.MeshStandardMaterial({ map: TX.albedo, roughness: 0.24, metalness: 0.2, emissiveMap: TX.glow, emissive: new THREE.Color(1.0, 0.36, 0.06), emissiveIntensity: 1.6 });
  const crust = new THREE.MeshStandardMaterial({ map: cookieCrustTexture(), roughness: 0.8, emissive: new THREE.Color(0.45, 0.12, 0.0), emissiveIntensity: 0.5 });
  const caramel = new THREE.MeshStandardMaterial({ color: 0xc8701c, roughness: 0.3, metalness: 0.45, emissive: new THREE.Color(0.2, 0.06, 0.0), emissiveIntensity: 0.4 });
  const L = 1.32, y0 = 0.13, steps = 12;
  // the broad blade: a straight spine (-x), a jagged bitten crust edge (+x) that swells a little before the tip (a cleaver-ish greatsword)
  const sh = new THREE.Shape(); sh.moveTo(-0.07, y0);
  for (let i = 1; i <= steps; i++) { const k = i / steps; sh.lineTo(-0.07 + 0.012 * Math.sin(i * 2.3) + 0.03 * k * k, y0 + L * k); }
  sh.lineTo(0.02, y0 + L + 0.2);
  for (let i = steps; i >= 1; i--) { const k = i / steps, swell = 0.025 * Math.sin(k * Math.PI * 0.9); sh.lineTo(0.085 + swell + (i % 2 ? 0.024 : -0.006) - 0.03 * k * k, y0 + L * k); }
  sh.lineTo(0.075, y0); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 });
  bg.translate(0, 0, -0.02); bg.rotateY(-Math.PI / 2);   // shape x -> +z (the edge forward)
  // planar UVs over the blade's face (z across, y along) so the textures run up the blade on every face
  { const pos = bg.attributes.position, uv = bg.attributes.uv; bg.computeBoundingBox(); const bb = bg.boundingBox;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
    uv.needsUpdate = true; }
  g.add(new THREE.Mesh(bg, blade));
  // the white-hot cutting edge: a thin additive strip along the crust (it flares with the heat)
  const edgePts = []; for (let i = 0; i <= steps; i++) { const k = i / steps; edgePts.push(new THREE.Vector3(0, y0 + L * k, 0.1 + 0.025 * Math.sin(k * Math.PI * 0.9) - 0.03 * k * k)); }
  edgePts.push(new THREE.Vector3(0, y0 + L + 0.2, 0.02));
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.36, 0.06), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts), 24, 0.011, 5, false), edgeMat); edge.renderOrder = 6; g.add(edge);
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), crust); c.scale.set(1, 0.7, 1); c.position.set(i % 2 ? 0.024 : -0.024, 0.32 + i * 0.19, 0.03 + rand(-0.02, 0.02)); g.add(c); }
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.034, 8, 22), crust); guard.position.y = 0.11; guard.rotation.y = Math.PI / 2; guard.scale.set(1, 0.45, 1); g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.28, 10), caramel); grip.position.y = -0.04; g.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), crust); pommel.position.y = -0.2; g.add(pommel);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: new THREE.Color(1.0, 0.32, 0.04), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  glow.scale.setScalar(0.75); glow.position.y = 0.8; glow.renderOrder = 6; g.add(glow);
  g.userData = { tip: new THREE.Vector3(0, y0 + L + 0.16, 0.03), base: new THREE.Vector3(0, 0.24, 0.03), edgeZ: 0.1, glow, L, bladeMat: blade, edgeMat, heat: 1 };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  edge.castShadow = false;
  g.scale.setScalar(2.3);   // (the rage form is ~4.75 m tall: a ~3.4 m greatsword)
  return g;
}
// prop placement in the right hand (hand-bone space, cm): grip offset and the prop's long axis
const PROP_GRIP = { spear: { off: [0, 7, 3], axis: [1, 0, 0], up: [0, 0, 1], len: 0.0 }, staff: { off: [0, 7, 3], axis: [1, 0, 0], up: [0, 0, 1], len: 0.0 },
  // Hecate's hands hang open at her sides: world-up is -Y in hand space, so the sceptre and torch point that way
  keystaff: { off: [0, 8, 2], axis: [0.18, -0.95, -0.25], up: [0, 0, 1], len: 0.0 }, torch: { off: [0, 8, 2], axis: [-0.1, -0.99, -0.05], up: [0, 0, 1], len: 0.0 },
  // Bacchus carries his jug by the handle at his side, mouth up, the belly of it outside his thigh
  jug: { off: [0, 8, 3], axis: [0, -1, 0], up: [1, 0, 0], len: 0.0 },
  // Ullr (Meshy rig, measured in the bind pose): hand Y runs along the fingers, Z across the knuckles (thumb side),
  // X is the palm normal (mirrored between the hands). Bow limbs and axe hafts run through the fist (hand Z), the bow's
  // back and the axe blades face the knuckles (hand Y); the nocked arrow lies along the fingers.
  // (If a weapon shows up flipped in the browser, flip the sign of axis/up here - the props are symmetric otherwise.)
  bow: { off: [0, 8, 0], axis: [0, 0, 1], up: [0, 1, 0], len: 0.0 }, axe: { off: [0, 8, 0], axis: [0, 0, 1], up: [0, 1, 0], len: 0.0 },
  axeL: { off: [0, 8, 0], axis: [0, 0, 1], up: [0, 1, 0], len: 0.0 }, arrow: { off: [0, 6, 0], axis: [0, 1, 0], up: [0, 0, 1], len: 0.0 },
  // Cookie Monster: his big cookie gripped by the rim (prop Y along the fingers, the cookie's axle = the palm normal),
  // the little passive cookie in the left hand, and the rage form's burning swords (blade through the fist, edge to the knuckles)
  cookie: { off: [0, 40, 0], axis: [0, 1, 0], up: [0, 0, 1], len: 0.0 }, cookieS: { off: [0, 14, 2], axis: [0, 1, 0], up: [0, 0, 1], len: 0.0 },
  csword: { off: [0, 8, 1], axis: [0, 0.3, 1], up: [0, 1, 0], len: 0.0 } };

// ---------------------------------------------------------------------------
// A god's GLB rig (same outward shape as the procedural Character)
// ---------------------------------------------------------------------------
class GodRig {
  constructor(gltf, id = 'thoth') {
    this.kind = id; this.id = id;
    const cfg = this.cfg = GOD_RIG[id];
    this.root = new THREE.Group(); this.root.name = id;
    this.body = new THREE.Group(); this.root.add(this.body);
    this.model = gltf.scene; this.body.add(this.model);
    this.tails = []; this.kilt = []; this.parts = {}; this.fingers = {};
    this.boneList = []; this.index = {};
    this.model.traverse((o) => {
      if (o.isBone) { this.index[o.name] = this.boneList.length; this.boneList.push(o); }
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        this.mesh = o;
      }
    });
    this.n = this.boneList.length;
    this.hipsIndex = this.index.Hips;
    this.b = (name) => this.boneList[this.index[name]];
    this.hips = this.b('Hips');
    // compatibility aliases used by the game code / HUD
    this.bones = { head: this.b('Head'), neck: this.b('neck'), wristL: this.b('LeftHand'), wristR: this.b('RightHand'), chest: this.b('Spine'), hips: this.hips };
    this.rest = new RigPose(this.n);
    this.boneList.forEach((b, i) => b.quaternion.toArray(this.rest.q, i * 4));
    this.hips.position.toArray(this.rest.p);
    this.clips = {}; this.animKey = gltf.animations;   // (clones share the animations array: one loco calibration per god)
    for (const c of gltf.animations) this.clips[c.name] = new ClipSampler(c, this);
    for (const [src, dst] of Object.entries(cfg.mirror || {})) if (this.clips[src]) this.clips[dst] = new MirrorSampler(this.clips[src], this);
    const maskOf = (table, dflt) => { const m = new Float32Array(this.n).fill(dflt); for (const [k, v] of Object.entries(table)) if (this.index[k] !== undefined) m[this.index[k]] = v; return m; };
    this.upperMask = maskOf(UPPER_MASK, 0);
    this.lowerMask = this.upperMask.map((v) => 1 - v);
    this.fullMask = new Float32Array(this.n).fill(1);
    this.glideMask = maskOf(GLIDE_MASK, 0.5);
    // world up expressed in the hips' parent (armature) space, for yaw corrections
    const pq = new THREE.Quaternion(); this.model.updateMatrixWorld(true); this.hips.parent.getWorldQuaternion(pq);
    this.upInHipsParent = new THREE.Vector3(0, 1, 0).applyQuaternion(pq.invert()).normalize();
    // Thoth: a wise, slender scribe rather than a brawler
    if (cfg.slim && this.mesh.isSkinnedMesh) slimSkinnedMesh(this.mesh);
    // material: PBR textures from Meshy + rim light in the god's colour (+ grading)
    const m = this.mesh.material;
    m.envMapIntensity = cfg.env ?? 1.15;
    addRimLight(m, cfg.rim[0], cfg.rim[1], cfg.rim[2], cfg.grade || null, cfg.magma || null);
    this.material = m;
    // glowing eyes (Head-bone space, cm)
    this.eyes = [];
    const eyeTex = glowSpriteTexture();
    const e = cfg.eyes;
    for (const sx of [1, -1]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: new THREE.Color(...cfg.eyeColor), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      s.position.set(e[0] * sx, e[1], e[2]); s.scale.setScalar(cfg.eyeSize); s.renderOrder = 6; s.userData.rigExtra = true;
      this.b('Head').add(s); this.eyes.push(s);
    }
    // glowing hands
    const glowMat = (c, o) => new THREE.SpriteMaterial({ map: eyeTex, color: c, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.handGlows = [];
    for (const [side, h] of Object.entries(cfg.hands || {})) {
      const glow = new THREE.Sprite(glowMat(new THREE.Color(...h.color), 0.8)); glow.position.set(0, 10, 0); glow.scale.setScalar(h.size); glow.renderOrder = 6;
      const core = new THREE.Sprite(glowMat(new THREE.Color(...h.core), 0.9)); core.position.set(0, 10, 0); core.scale.setScalar(h.size * 0.24); core.renderOrder = 6;
      glow.userData.rigExtra = core.userData.rigExtra = true;
      this.b(side === 'R' ? 'RightHand' : 'LeftHand').add(glow, core);
      this.handGlows.push({ side, glow, core, size: h.size });
    }
    this.handGlow = this.handGlows[0]?.glow; this.handCore = this.handGlows[0]?.core;
    // held prop
    this.prop = null;
    const attach = (kind, bone) => {
      const p = kind === 'spear' ? makeIceSpear() : kind === 'keystaff' ? makeKeyStaff() : kind === 'torch' ? makeTorch() : kind === 'jug' ? makeJug()
        : kind === 'bow' ? makeUllrBow() : kind === 'axe' || kind === 'axeL' ? makeUllrAxe() : kind === 'arrow' ? makeUllrArrow()
        : kind === 'cookie' ? makeCookieDisc(0.72) : kind === 'cookieS' ? makeCookieDisc(0.2) : kind === 'csword' ? makeCookieSword() : makeSunStaff();
      const grip = PROP_GRIP[kind];
      const holder = new THREE.Group(); holder.position.fromArray(grip.off); holder.scale.setScalar(100); holder.userData.rigExtra = true;
      // prop Y (its long axis) -> grip axis, prop Z -> grip up
      const ax = new THREE.Vector3().fromArray(grip.axis).normalize(), up = new THREE.Vector3().fromArray(grip.up);
      up.addScaledVector(ax, -up.dot(ax)).normalize();
      const side = new THREE.Vector3().crossVectors(ax, up);
      holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, ax, up));
      holder.add(p); this.b(bone).add(holder);
      return { p, holder };
    };
    if (cfg.prop) { const a = attach(cfg.prop, 'RightHand'); this.prop = a.p; this.propHolder = a.holder; }
    if (cfg.propL) { const a = attach(cfg.propL, 'LeftHand'); this.propL = a.p; this.propLHolder = a.holder; }
    // several named props (Ullr's bow and axes); the kit toggles .visible on them
    this.props = {};
    for (const d of cfg.props || []) { const a = attach(d.kind, d.bone); this.props[d.key] = a.p; a.p.userData.holder = a.holder; }
    if (!this.prop && this.props.axeR) this.prop = this.props.axeR;
  }
  setVisible(v) { this.root.visible = v; }
}
const ThothRig = (gltf) => new GodRig(gltf, 'thoth');
// a god's bones as loaded (its rest pose), kept before any rig animates the shared source (loadAssets, loadAsset)
function keepRest(name, g) {
  if (!GOD_RIG[name] || Assets.rest[name] || !g || !g.scene) return;
  const r = {}; g.scene.traverse((o) => { if (o.isBone) r[o.name] = [o.position.clone(), o.quaternion.clone(), o.scale.clone()]; });
  Assets.rest[name] = r;
}
// A second (third, ...) copy of a god for Arena bots: its own skeleton and materials over the shared
// geometry and textures, without the eyes/props a GodRig already hung on the source bones.
// (rest: Assets.rest[id] puts the copy's bones back in the rest pose - the source may be the player's own god in mid-step,
// and a GodRig takes its rest pose from its bones; another player's avatar starts from it, 14n_net.js)
function cloneGodRig(gltf, id, rest = null) {
  // (three copies userData as JSON: links a GodRig hung on the source - Ullr's prop holders - are set aside meanwhile,
  // else a copy of the player's own Ullr fails; the copy drops those props anyway)
  const held = [];
  gltf.scene.traverse((o) => { if (o.userData && o.userData.holder) { held.push([o, o.userData.holder]); delete o.userData.holder; } });
  let scene2;
  try { scene2 = SkeletonUtils.clone(gltf.scene); } finally { for (const [o, h] of held) o.userData.holder = h; }
  scene2.position.set(0, 0, 0); scene2.rotation.set(0, 0, 0);
  if (rest) scene2.traverse((o) => { const r = o.isBone && rest[o.name]; if (r) { o.position.copy(r[0]); o.quaternion.copy(r[1]); o.scale.copy(r[2]); } });
  const extras = [];
  // (a god model is one skinned mesh on a skeleton: anything else on the bones was hung there by a GodRig or a kit)
  scene2.traverse((o) => {
    if ((o.userData && o.userData.rigExtra) || o.isSprite || o.isPoints || o.isLine || (o.isMesh && !o.isSkinnedMesh)) extras.push(o);
    else if (o.isMesh) o.material = o.material.clone();
  });
  for (const o of extras) o.parent && o.parent.remove(o);
  return new GodRig({ scene: scene2, animations: gltf.animations }, id);
}
// eye centres in Head-bone local space (armature units = cm), found by tools/eyes.html / eyecheck.html
const THOTH_EYES = [[6.85, 3.95, -13.8], [-6.85, 3.95, -13.8]];

// magic colours per god for the shared animator effects (hand trails, sparks, wisps)
const RIG_FX = {
  cyan: () => ({ trail: COL.cyan, spark: COL.cyan, wisp: COL.cyan }),
  ice: () => ({ trail: new THREE.Color(0.55, 0.88, 1.0), spark: new THREE.Color(0.7, 0.92, 1.0), wisp: new THREE.Color(0.75, 0.9, 1.0) }),
  gold: () => ({ trail: new THREE.Color(1.0, 0.78, 0.32), spark: new THREE.Color(1.0, 0.85, 0.45), wisp: new THREE.Color(0.95, 0.75, 0.4) }),
  witch: () => ({ trail: new THREE.Color(0.6, 0.35, 1.0), spark: new THREE.Color(0.45, 1.0, 0.55), wisp: new THREE.Color(0.5, 0.3, 0.9) }),
  sun: () => ({ trail: new THREE.Color(1.0, 0.62, 0.2), spark: new THREE.Color(1.0, 0.8, 0.35), wisp: new THREE.Color(1.0, 0.6, 0.2) }),
  wine: () => ({ trail: new THREE.Color(0.7, 0.04, 0.38), spark: new THREE.Color(1.0, 0.32, 0.62), wisp: new THREE.Color(0.5, 0.08, 0.42) }),
  caramel: () => ({ trail: new THREE.Color(0.85, 0.32, 0.04), spark: new THREE.Color(1.0, 0.55, 0.12), wisp: new THREE.Color(0.55, 0.18, 0.03) }),
  jade: () => ({ trail: new THREE.Color(0.05, 0.75, 0.38), spark: new THREE.Color(1.0, 0.75, 0.28), wisp: new THREE.Color(0.08, 0.6, 0.32) }),
};

// ---------------------------------------------------------------------------
// RigAnimator: same interface as the procedural Animator, configured per god
// ---------------------------------------------------------------------------
const _ra = { v1: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(), v4: new THREE.Vector3(), v5: new THREE.Vector3(), v6: new THREE.Vector3(),
  v7: new THREE.Vector3(), v8: new THREE.Vector3(),
  q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), q3: new THREE.Quaternion(), m: new THREE.Matrix4(), e: new THREE.Euler(), up: new THREE.Vector3(0, 1, 0), yAxis: new THREE.Vector3(0, 1, 0) };
const _rm3 = new THREE.Matrix3();
const _wq = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), c: new THREE.Quaternion() };
const _ht = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(), g: new THREE.Vector3(), m: new THREE.Matrix4() };
const _bez = (a, b, c, d, t, out) => { const u = 1 - t; return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
class RigAnimator {
  constructor(rig, book = null) {
    this.ch = rig; this.book = book;
    this.cfg = rig.cfg || GOD_RIG.thoth;
    this.acts = this.cfg.acts;
    this.fxc = RIG_FX[this.cfg.fx || 'cyan']();
    const n = rig.n;
    this.pose = new RigPose(n); this.tA = new RigPose(n); this.tB = new RigPose(n); this.tC = new RigPose(n); this.idleP = new RigPose(n);
    this.t = 0; this.phase = 0; this.dirAng = 0; this.dirSign = 1; this.twist = 0; this.speedNorm = 0; this.moveW = 0;
    this.moveLocal = new THREE.Vector3();
    this.airborne = false; this.vy = 0; this.jumpW = 0;
    this.actions = [];
    this.channel = 0; this.channelTarget = 0; this.pulse = 0; this.chanT = 0;
    this.aimPitch = 0; this.eyeGlow = 0;
    this.dash = null; this.dashW = 0;
    this.bookFloat = 0; this.bookFloatTarget = 0; this.bookHigh = 0;
    this.prevRootPos = new THREE.Vector3(); this.rootVel = new THREE.Vector3(); this.firstFrame = true;
    this.glance = { t: 1.5, x: 0, y: 0, cx: 0, cy: 0 };
    this.noGlance = false;
    this.idleVar = null; this.idleVarT = rand(7, 12);
    this.rageW = 0; this.handKick = 0; this.handFx = []; this.wispT = 0; this.stepPh = 0;
    this.wrathT = -1; this.wrathLift = 0; this.wrathBookW = 0; this.moteT = 0;
    this.extraLift = 0; this.liftTarget = 0;   // kit-driven levitation (finals)
    this.bookOff = new THREE.Vector3();
    this.onStep = null;
    // hand-bone local axis that points out of the palm (Y runs along the fingers); see tools/measure.html
    this.palmAxis = new THREE.Vector3(0, 0, 1);
    this.fxK = 1;   // share of the cosmetic particles (hand sparks, wisps, footfall dust): Arena bots run lighter
    this.loco = new LocoState(this);   // the 8-way locomotion blend space with foot IK (07c_loco.js)
    this.rootMoveLocal = new THREE.Vector3(); this.rootMove = new THREE.Vector3();   // root motion of rootMotion acts (the kit consumes rootMove)
  }
  play(name, opts = {}) {
    if (name === 'dash') { this.dash = { t: 0, dur: opts.dur ?? 0.3, dx: opts.dx || 0, dz: opts.dz ?? 1 }; return; }
    if (name === 'wrath') { this.play('rage'); this.wrathT = 0; }
    const def = this.acts[name]; if (!def) return;
    // (an ability takes the arms back from a casting gesture still lingering in its guard: it melts away quickly underneath)
    if (!def.chain && !def.lowerOnly && this.gests) for (const g of this.gests) { const e = g.K[g.K.length - 1].t; g.hold = Math.max(0, Math.min(g.hold, g.t - e)); g.out = Math.min(g.out, 0.16); }
    // (a chained basic-attack swing played again lets its previous run fade out underneath instead of vanishing: no pop)
    if (def.chain) { for (const a of this.actions) if (a.name === name) a.name = name + '~'; } else this.actions = this.actions.filter((a) => a.name !== name);
    let rate = (def.rate || 1) * (opts.speed || 1);
    if (opts.dur && !def.keys) rate = Math.max(def.rate, ((def.to - def.from) / opts.dur) * 0.7);
    // opts.keys: a time warp for this one run (chain swings, RigAnimator.swing), in real seconds
    const keys = opts.keys || def.keys, ks = opts.keys ? 1 : (opts.speed || 1);
    const len = keys ? keys[keys.length - 1][0] / ks : (def.to - def.from) / rate;
    this.actions.push({ name, def, keys: opts.keys || null, t: -(def.delay || 0), rate, len, weight: opts.weight ?? def.weight ?? 1, speed: ks });
    if (!def.lowerOnly && name !== 'laugh' && name !== 'rage' && name !== 'wrath' && !opts.noFx) this.castFx(name, opts.side);
  }
  stop(name) { this.actions = this.actions.filter((a) => a.name !== name); }
  // an action's blend weight now (fade in, fade out; a held action keeps its weight until holdAt, then fades out)
  actW(act) {
    const d = act.def;
    if (act.holdAt !== undefined) return act.holdW * (1 - smoothstep(act.holdAt, act.holdAt + (d.fadeOut || 0.3), act.t));
    const tn = act.t / act.len;
    // (a chain swing lingering after its follow-through relaxes half-way back toward the god's own pose: RigAnimator.swing)
    const rk = act.relaxAt === undefined ? 1 : lerp(1, act.relaxK, smoothstep(act.relaxAt, act.relaxAt + 0.4, act.t));
    return Math.min(smoothstep(0, (act.fadeIn ?? d.fadeIn) / act.len, tn), 1 - smoothstep(1 - d.fadeOut / act.len, 1, tn)) * act.weight * rk;
  }
  // keep an action at its current weight (the clip playing on) for dur seconds, then let it fade out: the next action fades
  // in over it, so a chain of swings never dips back to the idle pose in between
  holdUnder(act, dur) {
    if (!act || act.t < 0) return;
    act.holdW = this.actW(act); act.holdAt = act.t + dur;
    act.len = Math.max(act.len, act.holdAt + (act.def.fadeOut || 0.3));
  }
  isPlaying(name) { return this.actions.some((a) => a.name === name); }
  clipTime(act) {
    const d = act.def;
    if (!d.keys && !act.keys) return d.from + act.t * act.rate;
    const k = act.keys || d.keys, t = act.t * act.speed; let i = 0;
    while (i < k.length - 2 && t > k[i + 1][0]) i++;
    return lerp(k[i][1], k[i + 1][1], clamp((t - k[i][0]) / (k[i + 1][0] - k[i][0]), 0, 1));
  }
  // a ribbon of the god's magic follows the casting hand for a moment
  castFx(name, side = 'R') {
    const big = name === 'judgement' || name === 'conjure' || name === 'spear' || name === 'beam' || name === 'triple' || name === 'whip' || name === 'huntress';
    this.handFx.push({ t: 0, dur: big ? 0.7 : 0.42, side, trail: VFX.trail(big ? 0.3 : 0.18, this.fxc.trail, big ? 3.4 : 2.8, 18) });
    this.handKick = big ? 2.4 : 1.4;
  }

  update(dt, ctx) {
    const rig = this.ch, cfg = this.cfg, loco = cfg.loco;
    this.frameNo = (this.frameNo || 0) + 1;
    const vxIn = ctx.vel ? ctx.vel.x : null, vzIn = ctx.vel ? ctx.vel.z : null; // ctx.vel may be a shared temp
    this.t += dt;
    const rp = rig.root.position;
    if (this.firstFrame) { this.prevRootPos.copy(rp); this.firstFrame = false; }
    this.rootVel.copy(rp).sub(this.prevRootPos).divideScalar(Math.max(dt, 1e-4)); this.prevRootPos.copy(rp);
    const yaw = rig.root.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const vx = vxIn ?? this.rootVel.x, vz = vzIn ?? this.rootVel.z;
    // local: x = the god's left, z = forward
    const lx = vx * cs - vz * sn, lz = vx * sn + vz * cs;
    this.moveLocal.set(lx, 0, lz);
    const speed = Math.hypot(lx, lz), runSpeed = ctx.runSpeed || 5.2;
    this.speedNorm = damp(this.speedNorm, clamp(speed / runSpeed, 0, 1.3), 7, dt);
    this.moveW = smoothstep(0.04, 0.4, this.speedNorm);
    if (speed > 0.4) this.dirAng = dampAngle(this.dirAng, Math.atan2(lx, lz), 8, dt);
    this.airborne = !!ctx.airborne; this.vy = ctx.vy || 0;
    this.aimPitch = damp(this.aimPitch, ctx.aimPitch || 0, 8, dt);
    this.channel = damp(this.channel, this.channelTarget, this.channelTarget > 0 ? 4 : 6, dt);
    this.chanT = this.channelTarget > 0 ? this.chanT + dt : 0;
    this.pulse = Math.max(0, this.pulse - dt * 3);
    this.extraLift = damp(this.extraLift, this.liftTarget, this.liftTarget > this.extraLift ? 2.6 : 5, dt);
    const P0 = this.pose;

    // ---- idle (+ now and then the second idle, once through)
    rig.clips.idle.sampleLoop(this.t, this.idleP, rig);
    const calm = this.moveW < 0.05 && !this.actions.length && this.channel < 0.05 && !this.airborne;
    if (!this.idleVar && calm) { this.idleVarT -= dt; if (this.idleVarT <= 0 && rig.clips.idle_b) this.idleVar = { t: 0, w: 0 }; }
    if (this.idleVar) {
      const iv = this.idleVar, dur = rig.clips.idle_b.duration;
      iv.t += dt;
      iv.w = damp(iv.w, calm && iv.t < dur - 0.8 ? 1 : 0, 3, dt);
      rig.clips.idle_b.sample(Math.min(iv.t, dur), this.tA, rig);
      blendPose(this.idleP, this.idleP, this.tA, iv.w);
      if (iv.t > dur || (iv.t > 1 && iv.w < 0.01)) { this.idleVar = null; this.idleVarT = rand(9, 16); }
    }
    P0.copy(this.idleP);
    // ---- locomotion: the 8-way blend space (07c_loco.js): forward / side / back clips by travel direction and speed,
    // phase-synced, laid over the idle by moveW; the legs are put on the speed-matched foot paths by IK further down
    this.loco.pose(dt, P0, lx, lz, runSpeed);
    // ---- dash: a levitating lunge, legs drawn up like a bird taking off
    if (this.dash) { this.dash.t += dt; if (this.dash.t > this.dash.dur) this.dash = null; }
    this.dashW = damp(this.dashW, this.dash ? 1 : 0, this.dash ? 30 : 10, dt);
    if (this.dashW > 0.01) {
      rig.clips.jump.sample(0.8, this.tC, rig);
      blendPose(P0, P0, this.tC, this.dashW * 0.75, rig.lowerMask, rig, 0);
    }
    // ---- airborne
    this.jumpW = damp(this.jumpW, this.airborne ? 1 : 0, this.airborne ? 14 : 18, dt);
    if (this.jumpW > 0.01) {
      const tj = lerp(0.64, 1.06, smoothstep(5.4, -5.4, this.vy));
      rig.clips.jump.sample(tj, this.tC, rig);
      blendPose(P0, P0, this.tC, this.jumpW * 0.92, null, rig, 0);
    }
    // ---- channel: arms raised, (legs drawn up), levitating
    const chW = smoothstep(0, 1, this.channel), chc = cfg.channel || { clip: 'charged', legs: 'jump', lift: 0.62 };
    if (chW > 0.001) {
      const tc = Math.min(0.32, 0.05 + this.chanT * 0.9) + 0.025 * Math.sin(this.t * 2.1) - this.pulse * 0.05;
      rig.clips[chc.clip].sample(tc, this.tC, rig);
      if (chc.legs === 'jump') { rig.clips.jump.sample(0.74, this.tA, rig); blendPose(this.tC, this.tC, this.tA, 1, rig.lowerMask, rig, 0); }
      blendPose(P0, P0, this.tC, chW, null, rig, 0);
    }
    // ---- cast layers
    let fullYaw = 0, upperYaw = 0, rage = 0, castW = 0, legCast = 0, steadyW = 0;
    this.rootMoveLocal.set(0, 0, 0);
    const standing = 1 - this.moveW;
    this.bookOff.set(0, 0, 0);
    // ---- kit-held aim layer (Ullr's bow): a pose held from a clip at a kit-driven clip time, eased in and out;
    // its yaw turns the whole body while he stands and is spread up the spine while he runs (no 80-degree pops)
    this._aimSpread = 0;
    const A = this.aim;
    if (A) {
      A.w = damp(A.w || 0, A.on ? 1 : 0, A.on ? (A.kin ?? 12) : (A.kout ?? 6), dt);
      const aclip = A.w > 0.001 ? rig.clips[A.clip] : null;
      if (aclip) {
        aclip.sample(A.time, this.tC, rig);
        const fullK = (A.full ?? 0.6) * standing * (1 - this.jumpW) * (1 - chW);
        const mask = this._amask || (this._amask = new Float32Array(rig.n));
        for (let i = 0; i < rig.n; i++) mask[i] = rig.upperMask[i] + (1 - rig.upperMask[i]) * fullK;
        this.tC.p[0] = rig.rest.p[0]; this.tC.p[2] = rig.rest.p[2];
        blendPose(P0, P0, this.tC, A.w, mask, rig, A.w * fullK);
        castW = Math.max(castW, A.w); legCast = Math.max(legCast, A.w * fullK);
        const yw = (A.yaw || 0) * DEG * (A.yawK ?? 1) * A.w;
        fullYaw += yw * fullK; this._aimSpread = yw * (1 - fullK);
      }
    }
    for (const act of this.actions) {
      act.t += dt;
      if (act.t < 0) continue;
      const d = act.def, ct = this.clipTime(act);
      const w = this.actW(act);
      if (act.name === 'rage') rage = Math.max(rage, w);
      if (act.name === 'wrath') rage = Math.max(rage, w * (1 - smoothstep(0.75, 1.1, act.t)));
      if (w <= 0.001) continue;
      const clip = rig.clips[d.clip]; if (!clip) continue;
      clip.sample(ct, this.tC, rig);
      if (d.book) this.bookOff.x += d.book[0] * w, this.bookOff.y += d.book[1] * w, this.bookOff.z += d.book[2] * w;
      const fullK = d.lowerOnly ? 1 : d.full * (d.rootFix ? 1 : standing) * (1 - this.jumpW) * (1 - chW);
      if (d.lowerOnly) {
        blendPose(P0, P0, this.tC, w * (1 - this.moveW * 0.7), rig.lowerMask, rig, w * (1 - this.moveW * 0.7));
        legCast = Math.max(legCast, w * 0.5);
        continue;
      }
      // upper body always, lower body + hips height when standing
      const mask = this._mask || (this._mask = new Float32Array(rig.n));
      for (let i = 0; i < rig.n; i++) mask[i] = rig.upperMask[i] + (1 - rig.upperMask[i]) * fullK;
      // root motion (d.rootMotion = scale): the clip's own horizontal hips travel since the last frame, weighted, while standing;
      // the kit moves the god by it (this.rootMove, world space) so the planted feet stay planted while he steps into a swing
      if (d.rootMotion) {
        const lp = act.lastP, rk = d.rootMotion * w * standing * (1 - this.jumpW);
        if (lp && rk > 0) { this._rmv = (this._rmv || new THREE.Vector3()).set(this.tC.p[0] - lp[0], this.tC.p[1] - lp[1], this.tC.p[2] - lp[2]); this.rootMoveLocal.addScaledVector(this._rmv, rk); }
        act.lastP = act.lastP || [0, 0, 0]; act.lastP[0] = this.tC.p[0]; act.lastP[1] = this.tC.p[1]; act.lastP[2] = this.tC.p[2];
      }
      // keep cast hips over the feet: damp horizontal drift (fully for root-motion / noDrift clips), keep height
      const keep = d.rootFix || d.noDrift || d.rootMotion ? 0 : 0.25;
      this.tC.p[0] = lerp(rig.rest.p[0], this.tC.p[0], keep); this.tC.p[2] = lerp(rig.rest.p[2], this.tC.p[2], keep);
      blendPose(P0, P0, this.tC, w, mask, rig, w * fullK);
      castW = Math.max(castW, w); legCast = Math.max(legCast, w * fullK);
      if (d.chain) steadyW = Math.max(steadyW, w);   // (a chain swing keeps the chest on the aim while the pelvis turns with the run)
      fullYaw += (d.yaw * DEG) * w * fullK;
      upperYaw += (d.yaw * DEG) * w * (1 - fullK);
    }
    this.actions = this.actions.filter((a) => a.t < a.len);
    this.rageW = damp(this.rageW, rage, 10, dt);
    // root motion -> world (hips-parent space carries the armature's rotation and scale); the kit consumes this.rootMove
    if (this.rootMoveLocal.lengthSq() > 0) {
      const hp = rig.hips.parent; hp.updateWorldMatrix(true, false);
      this.rootMove.add(_ra.v8.copy(this.rootMoveLocal).applyMatrix3(_rm3.setFromMatrix4(hp.matrixWorld)).setY(0));
    }

    // ---- Scribe's Wrath (Thoth): he rises in fury while the book tears free, then slams down on the stomp
    if (this.wrathT >= 0) { this.wrathT += dt; if (this.wrathT > 2.8) { this.wrathT = -1; this.wrathFrom = null; } }
    const wt = this.wrathT, WI = WRATH_IMPACT;
    this.wrathLift = wt < 0 ? 0 : wt < 0.85 ? 0.95 * easeOutCubic(clamp((wt - 0.08) / 0.77, 0, 1))
      : wt < WI - 0.14 ? 0.95 + 0.035 * Math.sin(wt * 47) : wt < WI ? 0.95 * (1 - easeInCubic((wt - (WI - 0.14)) / 0.14)) : 0;
    this.wrathBookW = wt < 0 ? 0 : wt < WRATH_BOOK.fall1 ? 1 : 0;

    // ---- write the pose
    const bl = rig.boneList;
    for (let i = 0; i < rig.n; i++) bl[i].quaternion.fromArray(P0.q, i * 4);
    rig.hips.position.fromArray(P0.p);
    if (fullYaw) { _rq.setFromAxisAngle(rig.upInHipsParent, fullYaw); rig.hips.quaternion.premultiply(_rq); }
    // hover while gliding / dashing, lift while channelling (+ gentle bob)
    const hover = loco.mode === 'glide' ? loco.hover : 0;
    rig.body.position.y = chW * ((chc.lift ?? 0.62) + 0.06 * Math.sin(this.t * 2.3))
      + this.moveW * (hover + (hover > 0 ? 0.012 * Math.sin(this.t * 2.6) : 0)) * (1 - chW) + this.dashW * 0.22 + this.wrathLift + this.loco.bodyY
      + this.extraLift * (1 + 0.04 * Math.sin(this.t * 2.2)) + (hover > 0.08 ? (1 - this.moveW) * (hover * 0.5 + 0.015 * Math.sin(this.t * 1.7)) * (1 - chW) : 0);
    rig.root.updateMatrixWorld(true);
    // ---- additive layers in world space: twist + lean, cast twist, aim pitch, dash lean, rage tremble, head glances
    const up = _ra.up, right = _ra.v5.set(-cs, 0, sn), fwd = _ra.v6.set(sn, 0, cs);
    // pelvis turns a little toward the travel, the spine keeps the chest and head on the aim, calm torso, lean, style
    this.loco.torso(dt, castW, steadyW);
    rig.root.updateMatrixWorld(true);
    if (upperYaw) { rotateBoneWorld(rig.b('Spine02'), up, upperYaw * 0.5); rig.b('Spine02').updateMatrixWorld(true); rotateBoneWorld(rig.b('Spine01'), up, upperYaw * 0.5); }
    rig.root.updateMatrixWorld(true);
    if (Math.abs(this._aimSpread) > 1e-4) {   // the aim's twist while running: spread over the three spine joints
      for (const [bn, k] of [['Spine02', 0.3], ['Spine01', 0.35], ['Spine', 0.35]]) { const b = rig.b(bn); rotateBoneWorld(b, up, this._aimSpread * k); b.updateMatrixWorld(true); }
    }
    rotateBoneWorld(rig.b('Spine'), right, -this.aimPitch * 0.35);
    if (this.dashW > 0.01 && this.dash) {
      const lean = 0.34 * this.dashW;
      rotateBoneWorld(rig.hips, right, -lean * this.dash.dz);
      rotateBoneWorld(rig.hips, fwd, lean * 0.6 * this.dash.dx);
    }
    if (this.rageW > 0.01) { // shaking with fury
      const k = this.rageW * 0.035;
      rotateBoneWorld(rig.b('Spine'), fwd, Math.sin(this.t * 71) * k);
      rotateBoneWorld(rig.b('Spine'), up, Math.sin(this.t * 53 + 1) * k * 0.7);
      rotateBoneWorld(rig.b('Head'), right, Math.sin(this.t * 61 + 2) * k * 1.4);
    }
    rig.root.updateMatrixWorld(true);
    const g = this.glance;
    g.t -= dt;
    if (g.t <= 0) {
      g.t = rand(1.1, 3.4);
      const r = Math.random();
      if (r < 0.3 && cfg.book) { g.x = -0.32; g.y = 0.22; g.t += 0.8; }          // reads from the book
      else if (r < 0.55) { g.x = 0; g.y = 0; }
      else { g.x = rand(-0.12, 0.1); g.y = r < 0.75 ? rand(-0.6, 0.6) : rand(-0.22, 0.22); }
    }
    const gk = 1 - Math.exp(-12 * dt);
    g.cx += (g.x - g.cx) * gk; g.cy += (g.y - g.cy) * gk;
    const busy = Math.max(chW, this.rageW, this.gestW || 0, ...this.actions.map((a) => (a.t > 0 ? a.def.full : 0))) || 0;
    const glW = (1 - this.moveW * 0.75) * (1 - busy) * (this.noGlance ? 0 : 1);
    rotateBoneWorld(rig.b('Head'), up, g.cy * glW);
    rotateBoneWorld(rig.b('Head'), right, (g.cx * glW) - this.aimPitch * 0.25);
    rig.root.updateMatrixWorld(true);
    // ---- legs: two-bone IK onto the warped, speed-matched foot paths (planted feet, no sliding)
    this.loco.feet(this.moveW * (1 - this.jumpW) * (1 - this.dashW) * (1 - chW) * (1 - legCast));
    // ---- a kit's procedural layer on top of everything (Ullr's clown dance), in world space
    // ---- procedural casting gestures (the mages' and Skadi's basic attacks): chest twist + an IK arm on top of everything
    if (this.gests && this.gests.length) this.applyGestures(dt);
    if (this.post) this.post(rig, dt, this);

    // ---- Thoth: the left hand holds the open book (two-bone IK + palm orientation), unless it floats
    if (this.book) {
      this.bookFloat = damp(this.bookFloat, this.bookFloatTarget, 5, dt);
      const holdW = (1 - smoothstep(0, 1, this.bookFloat * 1.6)) * (1 - this.wrathHoldOff());
      if (holdW > 0.001) this.holdBook(holdW);
    }

    // ---- eyes, hand glow, book
    this.eyeGlow = damp(this.eyeGlow, (ctx.eyeBoost || 0) + this.rageW * 1.2, 6, dt);
    const eo = 0.55 + Math.sin(this.t * 2.2) * 0.08 + this.eyeGlow * 0.45;
    const es = cfg.eyeSize ?? 4.5;
    for (const e of rig.eyes) { e.material.opacity = Math.min(1, eo); e.scale.setScalar(es * (0.93 + this.eyeGlow * 0.7)); }
    rig.material.userData.rimStrength.value = cfg.rim[1] + this.eyeGlow * 0.18 + chW * 0.25;
    this.handKick = Math.max(0, this.handKick - dt * 3.5);
    const hg = 0.75 + 0.12 * Math.sin(this.t * 5.3) + 0.06 * Math.sin(this.t * 13.1) + this.handKick * 0.5 + this.eyeGlow * 0.3;
    for (const h of rig.handGlows) { h.glow.scale.setScalar(h.size * 0.94 * hg); h.glow.material.opacity = Math.min(1, 0.7 * hg); h.core.scale.setScalar(h.size * 0.2 + this.handKick * 5); }
    if (rig.prop) { const u = rig.prop.userData; u.glow.material.opacity = Math.min(1, 0.65 + 0.15 * Math.sin(this.t * 4.1) + this.handKick * 0.25 + this.eyeGlow * 0.2); }
    this.updateFx(dt);
    if (this.book) this.updateBook(dt);
  }
  // where the hold IK will put the book (chest frame, independent of the clip the hand is playing):
  // the wrath aims its return flight here, so the landing never depends on a mid-fling wrist
  heldTargetQ(out) {
    const rig = this.ch, up = _ra.up, o = this.bookOff;
    const sL = _ht.a.setFromMatrixPosition(rig.b('LeftArm').matrixWorld), sR = _ht.b.setFromMatrixPosition(rig.b('RightArm').matrixWorld);
    const L = _ht.c.copy(sL).sub(sR).setY(0).normalize(), F = _ht.d.crossVectors(L, up);
    const toW = (x, y, z, v) => v.set(0, 0, 0).addScaledVector(L, x).addScaledVector(up, y).addScaledVector(F, z);
    const fing = toW(HOLD.fingers[0], HOLD.fingers[1], HOLD.fingers[2], _ht.e).normalize();
    const palm = toW(HOLD.palmN[0] - o.z * 0.6, HOLD.palmN[1], HOLD.palmN[2], _ht.f);
    palm.addScaledVector(fing, -palm.dot(fing)).normalize();
    return out.setFromRotationMatrix(_ht.m.makeBasis(_ht.g.crossVectors(fing, palm), fing, palm));
  }
  // 0..1: how far Scribe's Wrath has pulled the book out of Thoth's hand
  wrathHoldOff() {
    const wt = this.wrathT;
    if (wt < 0) return 0;
    return wt < 0.3 ? smoothstep(0, 0.3, wt) : wt < WRATH_BOOK.fall1 - 0.4 ? 1 : 1 - smoothstep(WRATH_BOOK.fall1 - 0.4, WRATH_BOOK.fall1, wt);
  }

  // a foot plants (from the loco gait phase): the god's lore mark on the ground (LocoFX) and the step sound
  footfall(side, pos) {
    const p = _ra.v7.copy(pos); p.y = 0.04;
    LocoFX.step(this, side, p);
    if (this.onStep && this.cfg.loco.mode !== 'glide') this.onStep(p);
  }

  // left wrist on an IK target in front of the chest, palm up under the book's spine
  holdBook(w) {
    const rig = this.ch, up = _ra.up;
    const sL = _ra.v1.setFromMatrixPosition(rig.b('LeftArm').matrixWorld), sR = _ra.v2.setFromMatrixPosition(rig.b('RightArm').matrixWorld);
    // chest frame from the shoulder line (follows casts that twist the torso)
    const L = _ra.v3.copy(sL).sub(sR).setY(0).normalize(), F = _ra.v4.crossVectors(L, up);
    const toW = (x, y, z, out) => out.set(0, 0, 0).addScaledVector(L, x).addScaledVector(up, y).addScaledVector(F, z);
    const o = this.bookOff, t = this.t;
    const target = toW(HOLD.off[0] + o.x + 0.008 * Math.sin(t * 0.7), HOLD.off[1] + o.y + 0.01 * Math.sin(t * 1.1), HOLD.off[2] + o.z, _ra.v6).add(sL);
    const pole = toW(HOLD.pole[0], HOLD.pole[1], HOLD.pole[2], _ra.v2);
    const arm = rig.b('LeftArm'), fore = rig.b('LeftForeArm'), hand = rig.b('LeftHand');
    solveTwoBoneIK(arm, fore, hand, target, pole, w);
    solveTwoBoneIK(arm, fore, hand, target, pole, w);   // second pass mops up the residual
    const fing = toW(HOLD.fingers[0], HOLD.fingers[1], HOLD.fingers[2], _ra.v1).normalize();
    const palm = toW(HOLD.palmN[0] - o.z * 0.6, HOLD.palmN[1], HOLD.palmN[2], _ra.v2);
    palm.addScaledVector(fing, -palm.dot(fing)).normalize();
    orientBoneWorld(hand, fing, palm, this.palmAxis, w, this.handMemo || (this.handMemo = { q: new THREE.Quaternion(), f: -9 }), this.frameNo);
    hand.updateMatrixWorld(true);
  }

  updateFx(dt) {
    const rig = this.ch, c = this.fxc;
    const hp = _ra.v1;
    if (this.handFx.length) {
      this.handFx = this.handFx.filter((f) => {
        f.t += dt;
        hp.set(0, 10, 0).applyMatrix4(rig.b(f.side === 'L' ? 'LeftHand' : 'RightHand').matrixWorld);
        f.trail.push(hp);
        if (f.t > f.dur) { f.trail.alive = false; return false; }
        return true;
      });
    }
    // sparks drifting off the glowing hand(s); magic wisps under gliding feet (realism pass: ~40 % fewer at rest)
    for (const h of rig.handGlows) {
      if (Math.random() < dt * this.fxK * (5 + this.handKick * 26) / rig.handGlows.length) {
        hp.set(rand(-3, 3), rand(6, 14), rand(-3, 3)).applyMatrix4(rig.b(h.side === 'L' ? 'LeftHand' : 'RightHand').matrixWorld);
        VFX.add.spawn({ pos: hp.clone(), vel: V3(rand(-0.25, 0.25), rand(0.2, 0.7), rand(-0.25, 0.25)), life: rand(0.5, 0.9), size: rand(0.03, 0.06), sizeEnd: 0.005, color: h.side === 'L' ? (this.cfg.fx === 'witch' ? c.spark : c.spark) : c.spark, intensity: 3, cell: FX.ember, drag: 1 });
      }
    }
    if (this.cfg.fx === 'witch' && rig.propL) { // her torch burns with violet and rose witchfire, smoke curling off it
      const tip = rig.propL.localToWorld(hp.copy(rig.propL.userData.tip));
      if (Math.random() < dt * 22 * this.fxK) VFX.add.spawn({ pos: tip.clone().add(V3(rand(-0.04, 0.04), rand(-0.02, 0.05), rand(-0.04, 0.04))), vel: V3(rand(-0.15, 0.15), rand(0.7, 1.4), rand(-0.15, 0.15)), life: rand(0.3, 0.55), size: rand(0.1, 0.17), sizeEnd: 0.02, color: Math.random() < 0.55 ? new THREE.Color(0.55, 0.12, 1.0) : new THREE.Color(1.0, 0.22, 0.65), intensity: 1.7, cell: FX.ember, drag: 0.6 });
      if (Math.random() < dt * 6) VFX.smoke.spawn({ pos: tip.clone().add(V3(0, 0.12, 0)), vel: V3(rand(-0.1, 0.1), rand(0.4, 0.8), rand(-0.1, 0.1)), life: rand(0.8, 1.3), size: 0.12, sizeEnd: 0.45, color: new THREE.Color(0.08, 0.02, 0.12), alpha: 0.45, alphaEnd: 0, cell: FX.smoke, drag: 0.6 });
      rig.propL.userData.glow.material.opacity = 0.75 + 0.2 * Math.sin(this.t * 13) * Math.sin(this.t * 7.3);
    }
    // lore motes while moving (Thoth's glyphs, Hecate's hem mist, Ra's sun motes, Ullr's leaves); the plain glide wisps otherwise
    LocoFX.update();
    const glide = this.cfg.loco.mode === 'glide' && !LocoFX.trail(this, dt);
    if (this.cfg.loco.mode !== 'glide') LocoFX.trail(this, dt);
    const wisp = (glide ? this.moveW * 13 : 0) + this.dashW * 30 + (this.channel > 0.1 ? 7 : 0) + (this.cfg.loco.hover > 0.12 ? 3.5 : 0);
    this.wispT += dt * wisp * this.fxK;
    while (this.wispT > 1) {
      this.wispT -= 1;
      const foot = rig.b(Math.random() < 0.5 ? 'LeftFoot' : 'RightFoot');
      const p = _ra.v2.setFromMatrixPosition(foot.matrixWorld); p.y = Math.max(0.03, p.y - 0.08);
      p.x += rand(-0.12, 0.12); p.z += rand(-0.12, 0.12);
      VFX.add.spawn({ pos: p.clone(), vel: V3(rand(-0.3, 0.3), rand(0.15, 0.6), rand(-0.3, 0.3)).addScaledVector(this.rootVel, -0.08), life: rand(0.5, 0.9), size: rand(0.1, 0.18), sizeEnd: 0.32, color: c.wisp, alpha: 0.55, alphaEnd: 0, intensity: 1.3, cell: FX.dot, drag: 1.5 });
    }
  }

  updateBook(dt) {
    const book = this.book;
    if (!book) return;
    const rig = this.ch, root = rig.root;
    const yaw = root.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const w = smoothstep(0, 1, this.bookFloat);
    // held: rigid on the left palm, spine along the fingers, pages facing up toward his eyes
    const hand = rig.b('LeftHand');
    hand.getWorldQuaternion(_ra.q1);
    const F = _ra.v1.copy(_ra.yAxis).applyQuaternion(_ra.q1).normalize();
    const N = _ra.v2.copy(this.palmAxis).applyQuaternion(_ra.q1);
    N.addScaledVector(F, -N.dot(F)).normalize();
    _ra.m.makeBasis(_ra.v3.crossVectors(F, N), F, N);
    const heldQ = _ra.q1.setFromRotationMatrix(_ra.m);
    const heldP = _ra.v4.setFromMatrixPosition(hand.matrixWorld).addScaledVector(F, HOLD.palm[0]).addScaledVector(N, HOLD.palm[1]);
    // floating (Final Judgement): in front of the chest, open, facing forward
    const hi = this.bookHigh;
    const fpos = _ra.v5.set(root.position.x + fx * (0.95 - hi * 0.35), root.position.y + rig.body.position.y + 1.72 + hi * 0.75 + Math.sin(this.t * 2.2) * 0.05, root.position.z + fz * (0.95 - hi * 0.35));
    _ra.e.set(-0.35 - hi * 0.9, yaw, 0, 'YXZ');
    const fq = _ra.q2.setFromEuler(_ra.e);
    book.group.position.lerpVectors(heldP, fpos, w);
    book.group.quaternion.slerpQuaternions(heldQ, fq, w);
    let scale = HOLD.scale * (1 + w * 0.15);
    // Scribe's Wrath: the book tears free where it is, sweeps out in FRONT of Thoth and up over his head
    // along a curve in his own frame (never through his body), tips back so its glowing pages face the
    // camera, rolls onto its face and spins, hangs in the air as he slams down (kicked up by the blast),
    // then glides back down the same way into his palm. Every channel is continuous: the tilt runs
    // through fixed in-between poses (no 180-degree slerp ambiguity), the spin is integrated in closed
    // form and lands on whole turns exactly as the book settles into his hand.
    const B = WRATH_BOOK;
    if (this.wrathT >= 0 && this.wrathT < B.fall1) {
      const wt = this.wrathT, WI = WRATH_IMPACT;
      const R = _ra.v6.set(-fz, 0, fx), Fw = _ra.v7.set(fx, 0, fz);           // his right / forward
      const bodyY = rig.body.position.y;
      // the flight starts where the book was when his fury broke (the hand flings away with the roar)
      if (!this.wrathFrom || wt < 0.02) {
        this.wrathFrom = (this.wrathFrom || new THREE.Vector3()).copy(book.group.position);
        this.wrathFromQ = (this.wrathFromQ || new THREE.Quaternion()).copy(book.group.quaternion);
        this.bookBaseY = bodyY; this.bookBaseV = 0;
      } else {   // its anchor trails his body on a critically damped spring: it stays aloft through the slam
        const w0 = 9, x = this.bookBaseY - bodyY;
        this.bookBaseV += (-w0 * w0 * x - 2 * w0 * this.bookBaseV) * Math.min(dt, 0.05);
        this.bookBaseY += this.bookBaseV * Math.min(dt, 0.05);
      }
      const base = _ra.v8.set(root.position.x, root.position.y + this.bookBaseY, root.position.z);
      const loc = (l, u, f, out) => out.copy(base).addScaledVector(R, -l).addScaledVector(_ra.up, u).addScaledVector(Fw, f);
      const tremble = wt < WI ? 0.025 * smoothstep(0.4, WI, wt) : 0;
      const jt = (wt - WI) / 0.13;                                              // the blast kicks it up (smooth bump)
      const jolt = jt > 0 ? 0.36 * jt * jt * Math.exp(2 * (1 - jt)) : 0;
      const top = loc(0, 2.72 + 0.06 * Math.sin(wt * 6) + jolt, 0.42, new THREE.Vector3());
      top.x += Math.sin(this.t * 53) * tremble; top.z += Math.cos(this.t * 61) * tremble;
      let p, ow, from;
      if (wt < B.rise) {        // hand -> out in front -> up over the head
        const k = easeInOut(wt / B.rise);
        const c1 = this.wrathFrom.clone().addScaledVector(Fw, 0.6).addScaledVector(_ra.up, 0.3);
        const c2 = loc(0.05, 2.25, 1.05, new THREE.Vector3());
        p = _bez(this.wrathFrom, c1, c2, top, k, new THREE.Vector3());
        ow = smoothstep(0.05, B.rise * 0.85, wt); from = this.wrathFromQ;
      } else if (wt < B.fall0) { p = top; ow = 1; from = heldQ; }
      else {                    // back down the same way into the palm
        const u = (wt - B.fall0) / (B.fall1 - B.fall0);
        const c1 = loc(0.05, 2.25, 1.05, new THREE.Vector3());
        const c2 = heldP.clone().addScaledVector(Fw, 0.55).addScaledVector(_ra.up, 0.35);
        p = _bez(top, c1, c2, heldP, easeInOut(u), new THREE.Vector3());
        ow = 1 - smoothstep(0, 1, u);
        // aim at the hold pose; hand over to the live palm only once the hand has re-gripped
        from = this.heldTargetQ(_wq.c).slerp(heldQ, smoothstep(0.8, 1, u));
      }
      // tilt: held -> pages facing back at the camera (spine up) -> face-down (spine back), as a
      // quadratic spherical Bezier through those fixed poses; then the spin about world up on top
      const qP = _ra.q2.setFromRotationMatrix(_ra.m.makeBasis(R, _ra.up, _ra.v1.copy(Fw).negate()));
      const qD = _ra.q3.setFromRotationMatrix(_ra.m.makeBasis(R, _ra.v2.copy(Fw).negate(), _ra.v1.set(0, -1, 0)));
      const qa = _wq.a.slerpQuaternions(from, qP, ow), qb = _wq.b.slerpQuaternions(qP, qD, ow);
      const tilt = qa.slerp(qb, ow);
      const spin = wrathSpin(wt) * (wt < B.rise ? ow : 1);
      book.group.position.copy(p);
      book.group.quaternion.setFromAxisAngle(_ra.up, spin).multiply(tilt);
      scale = HOLD.scale * lerp(1, 1.15 + 0.75 * smoothstep(0.15, 0.7, Math.min(wt, B.fall0)), ow);
    }
    // a kit can take the book out of his hands entirely (The Final Spell): blend to its pose by w
    const ov = this.bookOv, ovw = ov ? smoothstep(0, 1, ov.w) : 0;
    if (ovw > 0) { book.group.position.lerp(ov.pos, ovw); book.group.quaternion.slerp(ov.quat, ovw); scale = lerp(scale, ov.scale, ovw); }
    book.group.scale.setScalar(scale);
    const ww = this.wrathT >= 0 ? 1 - smoothstep(B.fall1 - 0.35, B.fall1, this.wrathT) : 0;
    const fw = Math.max(w, ww, ovw);
    book.inner.position.set(0, Math.sin(this.t * 2.4) * 0.02 * fw, Math.sin(this.t * 1.9) * 0.012 * fw);
    book.inner.rotation.set(Math.sin(this.t * 1.3) * 0.06 * fw, Math.sin(this.t * 1.1) * 0.08 * fw, Math.sin(this.t * 0.9) * 0.04 * fw);
    // glyph motes drift up off the open pages while he reads
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = fw > 0.5 ? 0.04 : rand(0.16, 0.32);
      const bp = book.group.position;
      VFX.glyphs.spawn({ pos: V3(bp.x + rand(-0.1, 0.1), bp.y + 0.06, bp.z + rand(-0.1, 0.1)), vel: V3(rand(-0.06, 0.06), rand(0.22, 0.5), rand(-0.06, 0.06)).multiplyScalar(fw > 0.5 ? 3 : 1),
        life: rand(1.0, 1.6), size: rand(0.06, 0.11) * (fw > 0.5 ? 2 : 1), sizeEnd: 0.02, color: COL.cyan, intensity: 1.9, cell: VFX.glyphCell(), rot: 0, wobble: 0.6 });
    }
    book.update(dt);
  }
}

// ---------------------------------------------------------------------------
// Basic-attack chains (Thoth, Skadi, Bastet, Hecate, Ra, Bacchus, Ullr; Cookie Monster's kit drives its own swings)
// 1) Clip swings: acts with chain: true and hit = the clip time of the strike. RigAnimator.swing(name, cd) plays the swing's
//    whole wind-up, strike and follow-through; the previous swing is held under it while it fades in, so every swing grows
//    out of the last one's follow-through (never out of the idle). At a high attack speed the wind-up is compressed (up to
//    maxK x; the strike itself keeps most of its natural speed) and the follow-through is cut short by the next swing,
//    instead of the whole clip being sped into a blur. Returns the real time of the strike: the kit lands its hit then.
// 2) Casting gestures (GESTURES): the mages' bolts and Skadi's javelins are thrown by a keyed hand path in the aim frame
//    (anticipation -> release -> follow-through), reached with two-bone IK on top of whatever the body is doing (standing,
//    running, strafing), with a chest twist and lean that carry the throw and a head that stays on the target. The bolt
//    leaves the hand at the release key (RigAnimator.castPoint). Each gesture starts from where the hand really is, so a
//    chain of throws (alternating hands or not) flows from one into the next.
// ---------------------------------------------------------------------------
// keys: t (s, natural speed), p: hand [inward, up, forward] from the shoulder in arm lengths, f: finger direction,
// n: palm direction, pole: elbow direction, tw: chest twist (rad, + = the throwing shoulder forward), ln: forward lean (rad).
// rel: index of the release key; out: s to melt back into the god's own pose after the last key.
const GESTURES = {
  // a palm strike: the hand cocks back beside the shoulder (palm already toward the target), snaps out along the aim
  flick: { rel: 1, out: 0.3, keys: [
    { t: 0.11, p: [0.16, 0.16, -0.02], f: [0.05, 1, -0.15], n: [0.05, 0.12, 1], d: [0.1, 1, -0.15], pole: [-0.9, -0.35, -0.3], tw: -0.42, ln: -0.04 },
    { t: 0.19, p: [0.1, 0.06, 0.97], f: [0, 1, 0.2], n: [0, -0.2, 1], d: [0, 0.75, 0.65], pole: [-0.55, -0.85, 0], tw: 0.22, ln: 0.08 },
    { t: 0.36, p: [0.2, -0.1, 0.86], f: [0.15, 0.6, 1], n: [0.05, -0.85, 0.5], d: [0.05, 0.85, 0.5], pole: [-0.5, -0.9, 0], tw: 0.26, ln: 0.05 },
  ] },
  // a backhand sweep: the hand winds in to the far shoulder, then whips flat across the front and out to the side
  sweep: { rel: 1, out: 0.3, keys: [
    { t: 0.11, p: [0.78, 0.08, 0.22], f: [0.55, 0.75, 0.3], n: [0.6, -0.1, -0.8], d: [0.5, 0.85, 0], pole: [-0.3, -0.75, 0.6], tw: 0.36, ln: 0.0 },
    { t: 0.19, p: [-0.02, 0.04, 0.97], f: [-0.2, 0.9, 0.35], n: [-0.25, -0.3, 1], d: [-0.2, 0.75, 0.6], pole: [-0.6, -0.8, 0], tw: -0.08, ln: 0.07 },
    { t: 0.36, p: [-0.62, -0.06, 0.66], f: [-0.75, 0.4, 0.55], n: [-0.4, -0.7, 0.6], d: [-0.5, 0.8, 0.3], pole: [-0.5, -0.8, -0.3], tw: -0.3, ln: 0.04 },
  ] },
  // a staff thrust: the fist drawn back to the hip, then driven straight out along the aim (Ra's sun staff leads with its disc)
  thrust: { rel: 1, out: 0.3, keys: [
    { t: 0.11, p: [0.06, -0.42, -0.12], f: [0.1, -0.2, 1], n: [0.6, 0.6, 0], d: [0, 0.55, 0.85], pole: [-0.6, -0.4, -0.7], tw: -0.38, ln: -0.03 },
    { t: 0.19, p: [0.12, -0.04, 0.97], f: [0.05, 0.3, 1], n: [0.6, 0.7, 0], d: [0, 0.35, 1], pole: [-0.6, -0.8, 0], tw: 0.24, ln: 0.09 },
    { t: 0.36, p: [0.16, -0.14, 0.88], f: [0.1, 0.1, 1], n: [0.6, 0.7, 0], d: [0, 0.5, 0.9], pole: [-0.55, -0.85, 0], tw: 0.26, ln: 0.05 },
  ] },
  // the heavy third: a hurl from high over the shoulder, the whole torso coming down behind it
  hurl: { rel: 1, out: 0.36, keys: [
    { t: 0.15, p: [-0.04, 0.52, -0.2], f: [0, 0.8, -0.6], n: [0.1, 0.6, 0.8], d: [0.12, 0.9, -0.42], pole: [-0.8, 0.15, -0.6], tw: -0.48, ln: -0.1 },
    { t: 0.25, p: [0.1, 0.0, 0.97], f: [0, 0.75, 0.65], n: [0, -0.65, 0.75], d: [0, 0.45, 0.9], pole: [-0.5, -0.85, 0], tw: 0.26, ln: 0.16 },
    { t: 0.45, p: [0.26, -0.34, 0.72], f: [0.15, -0.25, 1], n: [0.1, -1, -0.2], d: [0.1, 0.3, 1], pole: [-0.45, -0.9, 0], tw: 0.32, ln: 0.11 },
  ] },
};
// d: where a held rod (Ra's staff, Skadi's spear, Hecate's sceptre and torch) points; such a hand is turned by its rod instead
// between throws the hand settles into a loose guard in front of the chest (held a moment, so a chain never drops to the
// idle and lifts again; then it melts back into the god's own pose)
const GEST_GUARD = { p: [0.3, -0.5, 0.45], f: [0.25, 0.35, 1], n: [0.15, -1, 0.3], d: [0.1, 1, 0.2], pole: [-0.55, -0.8, -0.1], tw: 0.04, ln: 0.02 };
const _gq = { F: new THREE.Vector3(), L: new THREE.Vector3(), U: new THREE.Vector3(0, 1, 0), R: new THREE.Vector3(), I: new THREE.Vector3(),
  a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion() };
const _crom = (a, b, c, d, u, k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u * u + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * u * u * u);
const _nl = (a, b, u) => { const x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u), z = lerp(a[2], b[2], u), l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
Object.assign(RigAnimator.prototype, {
  // a chained clip swing fitted to the attack's cycle cd (s); returns { hit, len } (real seconds) or null
  swing(name, cd, opts = {}) {
    const def = this.acts[name]; if (!def || def.hit === undefined) return null;
    const r = def.rate || 1, A = (def.hit - def.from) / r, F = (def.to - def.hit) / r;
    const Ta = Math.max(0.1, cd * (def.antK ?? 0.55)), sA = clamp(A / Ta, 1, def.maxK ?? 1.7);
    let from = def.from;
    if (A / sA > Ta) from = def.hit - Ta * sA * r;   // faster still: the swing starts further into its wind-up
    const pre = def.hit - (def.hit - from) * 0.3, As = (def.hit - pre) / r, Aw = (pre - from) / r;
    let sS = Math.min(sA, 1.25), tw = A / sA * ((def.hit - from) / (def.hit - def.from)) - As / sS;
    if (tw < Aw / 3) { sS = sA; tw = Aw / sA; }
    const hit = tw + As / sS, sF = clamp(1 + (sA - 1) * 0.5, 1, 1.35);
    const keys = [[0, from], [tw, pre], [hit, def.hit], [hit + F / sF, def.to]];
    // the follow-through lingers (the clip creeping on at a third of its speed) until the next swing is due, so a steady chain
    // never drops back to the idle between blows; with no next swing it then fades out as usual
    const hold = cd + 0.06 + (def.fadeOut ?? 0.3) - keys[3][0], clip = this.ch.clips[def.clip];
    if (hold > 0.02) keys.push([keys[3][0] + hold, Math.min(def.to + hold * r * 0.33, clip ? clip.duration : def.to)]);
    // the swing still playing holds its weight until this one has faded in over it, then fades out underneath
    const prev = this.actions.filter((x) => x.def.chain && x.t >= 0 && x.holdAt === undefined).pop();
    const fadeIn = Math.min(def.fadeIn ?? 0.2, hit * 0.6);
    if (prev) this.holdUnder(prev, fadeIn * 1.15);
    this.play(name, { keys, noFx: opts.noFx ?? true, side: opts.side });
    const act = this.actions[this.actions.length - 1];
    if (act && act.name === name) { act.fadeIn = fadeIn; if (keys.length > 4) { act.relaxAt = keys[3][0]; act.relaxK = def.relax ?? 0.5; } }
    return { hit, len: keys[keys.length - 1][0] };
  },
  // a casting gesture on one hand (side 'R' / 'L'), fitted to the attack's cycle cd; returns the release time (s)
  gesture(name, side = 'R', cd = 1, opts = {}) {
    const G = GESTURES[name]; if (!G) return 0.1;
    const arm = this.gestArm(side);
    this.gests = this.gests || [];
    const old = this.gests.find((g) => g.side === side);
    // the natural timing, compressed for a fast attack: the wind-up up to 1.8x, the follow-through less
    const Rn = G.keys[G.rel].t, Ta = Math.max(0.1, cd * (opts.antK ?? 0.5)), sA = clamp(Rn / Ta, 1, 1.8), sF = clamp(1 + (sA - 1) * 0.6, 1, 1.5);
    const tOf = (t) => (t <= Rn ? t / sA : Rn / sA + (t - Rn) / sF);
    const k0 = this.gestNow(side, arm, old);
    const K = [k0, ...G.keys.map((k) => ({ t: tOf(k.t), p: k.p, f: k.f, n: k.n, d: k.d || k.f, pole: k.pole, tw: k.tw * (opts.k ?? 1), ln: k.ln * (opts.k ?? 1) }))];
    K.push({ ...(G.guard || GEST_GUARD), t: K[K.length - 1].t + 0.26 / sF });
    const g = { name, side, G, K, rel: G.rel + 1, t: 0, w0: old ? old.w : 0, w: old ? old.w : 0, tin: Math.min(0.08, K[1].t * 0.5), out: G.out, hold: opts.hold ?? 0.5, cur: null, arm };
    if (old) this.gests.splice(this.gests.indexOf(old), 1);
    this.gests.push(g);
    if (!opts.noFx) this.castFx(name, side);   // (a ribbon of the god's magic follows the casting hand)
    return K[g.rel].t;
  },
  // per arm: bones, reach and the hand-local palm axis (Meshy rigs: -X on the right hand, +X on the left; GOD_RIG palm overrides)
  gestArm(side) {
    const m = this._gArm || (this._gArm = {});
    if (m[side]) return m[side];
    const rig = this.ch, S = side === 'L' ? 'Left' : 'Right', a = rig.b(S + 'Arm'), f = rig.b(S + 'ForeArm'), h = rig.b(S + 'Hand');
    rig.root.updateMatrixWorld(true);
    const pa = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld), pf = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld), ph = new THREE.Vector3().setFromMatrixPosition(h.matrixWorld);
    const pal = (this.cfg.palm && this.cfg.palm[side]) || (side === 'L' ? [1, 0, 0] : [-1, 0, 0]);
    const A = { a, f, h, reach: pa.distanceTo(pf) + pf.distanceTo(ph), palm: new THREE.Vector3().fromArray(pal), memo: { q: new THREE.Quaternion(), f: -9 }, rod: 0 };
    // a rod held in this hand: along the fingers (rod 1 / -1) or along the palm normal (rod 2 / -2)
    const pk = side === 'L' ? this.cfg.propL : this.cfg.prop, gr = pk && PROP_GRIP[pk];
    if (gr) {
      const ax = new THREE.Vector3().fromArray(gr.axis).normalize(), dy = ax.y, dp = ax.dot(A.palm);
      A.rod = Math.abs(dy) > 0.8 ? Math.sign(dy) : Math.abs(dp) > 0.8 ? 2 * Math.sign(dp) : 0;
    }
    return (m[side] = A);
  },
  // the aim frame: forward, up, and inward for that hand
  gestFrame(side) {
    const yaw = this.ch.root.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    _gq.F.set(sn, 0, cs); _gq.L.set(cs, 0, -sn); _gq.R.set(-cs, 0, sn);
    _gq.I.copy(side === 'L' ? _gq.R : _gq.L);
    return _gq;
  },
  // the hand as it is now (last frame), as a gesture key
  gestNow(side, arm, old) {
    const Q = this.gestFrame(side), S = _gq.a.setFromMatrixPosition(arm.a.matrixWorld), H = _gq.b.setFromMatrixPosition(arm.h.matrixWorld).sub(S).divideScalar(arm.reach);
    const toF = (v) => [v.dot(Q.I), v.dot(Q.U), v.dot(Q.F)];
    arm.h.getWorldQuaternion(_gq.q);
    const f = _gq.c.set(0, 1, 0).applyQuaternion(_gq.q), n = _gq.d.copy(arm.palm).applyQuaternion(_gq.q);
    const c = old && old.cur, rd = arm.rod;
    const d = rd === 1 ? toF(f) : rd === -1 ? toF(f).map((x) => -x) : rd === 2 ? toF(n) : rd === -2 ? toF(n).map((x) => -x) : toF(f);
    return { t: 0, p: toF(H), f: toF(f), n: toF(n), d, pole: c ? c.pole : [-0.6, -0.8, -0.1], tw: c ? c.tw * old.w : 0, ln: c ? c.ln * old.w : 0 };
  },
  // a gesture's key values at its time t
  gestEval(g) {
    const K = g.K, n = K.length, t = g.t;
    let i = 0; while (i < n - 2 && t > K[i + 1].t) i++;
    let u = clamp((t - K[i].t) / Math.max(1e-4, K[i + 1].t - K[i].t), 0, 1);
    u = i + 1 === g.rel ? Math.pow(u, 1.6) : i === g.rel ? 1 - Math.pow(1 - u, 2.2) : u * u * (3 - 2 * u);
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(n - 1, i + 2)];
    const cur = g.cur || (g.cur = {});
    cur.p = [0, 1, 2].map((k) => _crom(a.p, b.p, c.p, d.p, u, k));
    cur.f = _nl(b.f, c.f, u); cur.n = _nl(b.n, c.n, u); cur.d = _nl(b.d, c.d, u); cur.pole = _nl(b.pole, c.pole, u);
    cur.tw = lerp(b.tw, c.tw, u); cur.ln = lerp(b.ln, c.ln, u);
    const end = K[n - 1].t + g.hold;
    g.w = lerp(g.w0, 1, smoothstep(0, g.tin, t)) * (1 - smoothstep(end, end + g.out, t));
    return cur;
  },
  // the release point of a hand (palm centre), world space
  castPoint(side = 'R', out = new THREE.Vector3()) {
    const arm = this.gestArm(side); arm.h.updateWorldMatrix(true, false);
    arm.h.getWorldQuaternion(_gq.q);
    return out.setFromMatrixPosition(arm.h.matrixWorld).addScaledVector(_gq.c.set(0, 1, 0).applyQuaternion(_gq.q), 0.09);
  },
  applyGestures(dt) {
    const rig = this.ch;
    let tw = 0, ln = 0, gw = 0;
    for (const g of this.gests) {
      g.t += dt; this.gestEval(g);
      tw += g.cur.tw * g.w * (g.side === 'L' ? -1 : 1); ln += g.cur.ln * g.w; gw = Math.max(gw, g.w);
    }
    this.gests = this.gests.filter((g) => g.t < g.K[g.K.length - 1].t + g.hold + g.out);
    this.gestW = gw;
    const Q = this.gestFrame('R');
    // the torso carries the throw: twist (spread up the spine) and a lean into the release; the head stays on the target
    if (Math.abs(tw) > 1e-4 || Math.abs(ln) > 1e-4) {
      for (const [bn, k] of [['Spine02', 0.25], ['Spine01', 0.35], ['Spine', 0.4]]) {
        const b = rig.b(bn); rotateBoneWorld(b, Q.U, tw * k); b.updateMatrixWorld(true);
        if (bn !== 'Spine') { rotateBoneWorld(b, Q.R, -ln * 0.5); b.updateMatrixWorld(true); }
      }
      const hd = rig.b('Head'); rotateBoneWorld(hd, Q.U, -tw * 0.8); rotateBoneWorld(hd, Q.R, ln * 0.6);
      rig.root.updateMatrixWorld(true);
    }
    for (const g of this.gests) {
      if (g.w < 0.002) continue;
      const A = g.arm, c = g.cur; this.gestFrame(g.side);
      const S = _gq.a.setFromMatrixPosition(A.a.matrixWorld);
      const tgt = _gq.b.copy(S).addScaledVector(_gq.I, c.p[0] * A.reach).addScaledVector(_gq.U, c.p[1] * A.reach).addScaledVector(_gq.F, c.p[2] * A.reach);
      const pole = _gq.c.set(0, 0, 0).addScaledVector(_gq.I, c.pole[0]).addScaledVector(_gq.U, c.pole[1]).addScaledVector(_gq.F, c.pole[2]);
      solveTwoBoneIK(A.a, A.f, A.h, tgt, pole, g.w);
      solveTwoBoneIK(A.a, A.f, A.h, tgt, pole, g.w);
      const fing = _gq.c.set(0, 0, 0).addScaledVector(_gq.I, c.f[0]).addScaledVector(_gq.U, c.f[1]).addScaledVector(_gq.F, c.f[2]).normalize();
      const palm = _gq.d.set(0, 0, 0).addScaledVector(_gq.I, c.n[0]).addScaledVector(_gq.U, c.n[1]).addScaledVector(_gq.F, c.n[2]);
      if (A.rod) {   // a held rod points along d: the fingers (or the palm) follow it, the other axis keeps as near its key as it can
        const rod = _gq.a.set(0, 0, 0).addScaledVector(_gq.I, c.d[0]).addScaledVector(_gq.U, c.d[1]).addScaledVector(_gq.F, c.d[2]).normalize();
        if (Math.abs(A.rod) === 1) { fing.copy(rod).multiplyScalar(A.rod); }
        else { palm.copy(rod).multiplyScalar(Math.sign(A.rod)); fing.addScaledVector(palm, -fing.dot(palm)).normalize(); }
      }
      palm.addScaledVector(fing, -palm.dot(fing)).normalize();
      orientBoneWorld(A.h, fing, palm, A.palm, g.w, A.memo, this.frameNo);
      A.h.updateMatrixWorld(true);
    }
  },
});

// kit helpers (the kit state they touch is the animator's own, so another player's replayed attack chains on its avatar)
// the step of a basic-attack chain (0..n-1); a pause longer than gap starts it over
function autoStep(anim, n = 3, gap = 1.6) {
  const s = anim.autoS || (anim.autoS = { i: 0, at: -9 });
  if (anim.t - s.at > gap) s.i = 0;
  s.at = anim.t;
  return s.i++ % n;
}
// a casting gesture (falls back to the plain throw on an animator without them); returns the release time (s)
function autoCast(anim, name, side, cd, opts) {
  if (anim && anim.gesture) return anim.gesture(name, side, cd, opts);
  if (anim) anim.play('throw', { dur: Math.min(0.42, cd * 0.9) });
  return 0.1;
}
// where the bolt leaves the casting hand at the release (kept between waist and head height)
function autoOrigin(anim, side = 'R', out = new THREE.Vector3()) {
  if (!anim || !anim.castPoint) return aimOrigin(out);
  anim.castPoint(side, out); out.y = clamp(out.y, P.y + 1.0, P.y + 2.0);
  return out;
}

// ---------------------------------------------------------------------------
// Enemy rigs: plain AnimationMixer with cross-fades (sentinel + mummies)
// ---------------------------------------------------------------------------
function stripRootMotion(clip, keepXZ = 0, keepUp = 1) {
  const tr = clip.tracks.find((t) => t.name === 'Hips.position');
  if (!tr) return clip;
  const v = tr.values, x0 = v[0], y0 = v[1], z0 = v[2];
  for (let i = 0; i < v.length; i += 3) {
    v[i] = x0 + (v[i] - x0) * keepXZ; v[i + 2] = z0 + (v[i + 2] - z0) * keepXZ;
    if (v[i + 1] > y0) v[i + 1] = y0 + (v[i + 1] - y0) * keepUp; // tame upward launches, keep falls
  }
  return clip;
}
class MixerRig {
  constructor(gltf, opts = {}) {
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.model);
    this.mats = [];
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffd9a0); o.material.emissiveIntensity = 0;
        o.material.envMapIntensity = opts.env ?? 1;
        this.mats.push(o.material);
      }
      if (o.isBone && o.name === 'Head') this.head = o;
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.acts = {};
    for (const c of gltf.animations) {
      const clip = c.clone();
      stripRootMotion(clip, opts.keepXZ?.[c.name] ?? 0, opts.keepUp?.[c.name] ?? 1);
      const a = this.mixer.clipAction(clip);
      if (opts.once?.includes(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.acts[c.name] = a;
    }
    this.current = null;
  }
  loop(name, fade = 0.25, timeScale = 1) {
    const a = this.acts[name]; if (!a) return;
    a.timeScale = timeScale;
    if (this.current === a) return;
    a.reset().setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }
  oneShot(name, fade = 0.08, weight = 1, timeScale = 1) {
    const a = this.acts[name]; if (!a) return null;
    a.reset(); a.timeScale = timeScale; a.setEffectiveWeight(weight); a.fadeIn(fade).play();
    return a;
  }
  flash(v) { for (const m of this.mats) m.emissiveIntensity = v; }
  update(dt) { this.mixer.update(dt); }
}


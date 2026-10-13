// ============================================================================
// Characters: skeleton, skinned body, Thoth's regalia and the jackal sentinel.
// Character faces +Z, its left side is +X. Units are metres.
// ============================================================================
function buildSkeleton() {
  const bones = {}, list = [];
  const B = (name, parent, x, y, z, rest = null) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (rest) b.rotation.set(rest[0], rest[1], rest[2]);
    b.userData.rest = b.rotation.clone();
    b.userData.restPos = b.position.clone();
    b.userData.index = list.length;
    if (parent) bones[parent].add(b);
    bones[name] = b;
    list.push(b);
    return b;
  };
  B('root', null, 0, 0, 0);
  B('hips', 'root', 0, 1.06, 0);
  B('spine', 'hips', 0, 0.1, 0);
  B('chest', 'spine', 0, 0.26, 0);
  B('neck', 'chest', 0, 0.35, -0.01);
  B('head', 'neck', 0, 0.13, 0.04);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    B('clav' + s, 'chest', 0.075 * sx, 0.26, -0.01);
    B('shoulder' + s, 'clav' + s, 0.215 * sx, 0.01, -0.01, [0, 0, 0.26 * sx]);
    B('elbow' + s, 'shoulder' + s, 0, -0.34, 0);
    B('wrist' + s, 'elbow' + s, 0, -0.3, 0);
    B('thigh' + s, 'hips', 0.115 * sx, -0.05, 0);
    B('knee' + s, 'thigh' + s, 0, -0.47, 0);
    B('ankle' + s, 'knee' + s, 0, -0.45, 0);
  }
  return { bones, list };
}

class Character {
  constructor(kind) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.root.name = kind;
    this.body = new THREE.Group();
    this.root.add(this.body);
    const { bones, list } = buildSkeleton();
    this.bones = bones;
    this.boneList = list;
    this.body.add(bones.root);
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(list);
    this.parts = {};
    this.fingers = { L: null, R: null };
    this.kilt = [];
    this.tails = [];
    this.glowMats = [];
  }
  bi(name) { return this.bones[name].userData.index; }
  addSkinned(geo, mat) {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    this.body.add(m);
    m.updateMatrixWorld(true);
    m.bind(this.skeleton, m.matrixWorld);
    return m;
  }
  // group parented to a bone, mirrored for right-side bones
  sideGroup(boneName, side) {
    const g = new THREE.Group();
    if (side === 'R') g.scale.x = -1;
    this.bones[boneName + side].add(g);
    return g;
  }
}

function remapSkin(geo, map) {
  const a = geo.attributes.skinIndex;
  for (let i = 0; i < a.count * 4; i++) { const v = a.array[i]; if (map[v] !== undefined) a.array[i] = map[v]; }
  a.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------------------
// Shared body lofts
// ---------------------------------------------------------------------------
function makeTorsoLoft(scale = 1) {
  return new Loft([
    { y: 0.93, rx: 0.085, rz: 0.07 },
    { y: 0.97, rx: 0.15, rz: 0.11 },
    { y: 1.03, rx: 0.172, rz: 0.122, cz: -0.005 },
    { y: 1.09, rx: 0.168, rz: 0.118, cz: -0.004 },
    { y: 1.15, rx: 0.152, rz: 0.11 },
    { y: 1.21, rx: 0.15, rz: 0.109, cz: 0.004 },
    { y: 1.29, rx: 0.164, rz: 0.116, cz: 0.01 },
    { y: 1.37, rx: 0.186, rz: 0.125, cz: 0.014 },
    { y: 1.45, rx: 0.212 * scale, rz: 0.134, cz: 0.018 },
    { y: 1.53, rx: 0.248 * scale, rz: 0.142, cz: 0.02 },
    { y: 1.6, rx: 0.268 * scale, rz: 0.142, cz: 0.016 },
    { y: 1.665, rx: 0.272 * scale, rz: 0.132, cz: 0.008 },
    { y: 1.715, rx: 0.245 * scale, rz: 0.118, cz: 0.0 },
    { y: 1.755, rx: 0.19, rz: 0.104, cz: -0.006 },
    { y: 1.79, rx: 0.118, rz: 0.088, cz: -0.006 },
    { y: 1.83, rx: 0.088, rz: 0.078, cz: -0.002 },
  ], {
    radial: 48, sub: 3, n: 2.3, bumps: [
      { th: 0.52, y: 1.53, a: 0.085, wt: 0.42, wy: 0.065 },
      { th: -0.52, y: 1.53, a: 0.085, wt: 0.42, wy: 0.065 },
      { th: 0, y: 1.3, a: 0.035, wt: 0.4, wy: 0.1 },
      { th: 1.8, y: 1.47, a: 0.05, wt: 0.4, wy: 0.1 }, { th: -1.8, y: 1.47, a: 0.05, wt: 0.4, wy: 0.1 },
      { th: Math.PI - 0.6, y: 1.6, a: 0.045, wt: 0.4, wy: 0.09 }, { th: -(Math.PI - 0.6), y: 1.6, a: 0.045, wt: 0.4, wy: 0.09 },
      { th: Math.PI, y: 1.4, a: -0.035, wt: 0.14, wy: 0.35 },
      { th: Math.PI - 0.55, y: 1.0, a: 0.07, wt: 0.5, wy: 0.06 }, { th: -(Math.PI - 0.55), y: 1.0, a: 0.07, wt: 0.5, wy: 0.06 },
    ],
  });
}
function makeArmLoft() {
  return new Loft([
    { y: 0.05, rx: 0.068, rz: 0.068 },
    { y: 0.0, rx: 0.097, rz: 0.093 },
    { y: -0.06, rx: 0.095, rz: 0.090 },
    { y: -0.12, rx: 0.084, rz: 0.084 },
    { y: -0.19, rx: 0.077, rz: 0.081 },
    { y: -0.27, rx: 0.068, rz: 0.070 },
    { y: -0.335, rx: 0.060, rz: 0.061 },
    { y: -0.37, rx: 0.060, rz: 0.061 },
    { y: -0.43, rx: 0.066, rz: 0.062 },
    { y: -0.51, rx: 0.058, rz: 0.053 },
    { y: -0.59, rx: 0.049, rz: 0.042 },
    { y: -0.645, rx: 0.044, rz: 0.035 },
  ], {
    radial: 28, sub: 3, n: 2, bumps: [
      { th: 0, y: -0.19, a: 0.12, wt: 0.7, wy: 0.06 },
      { th: Math.PI, y: -0.15, a: 0.09, wt: 0.8, wy: 0.07 },
      { th: Math.PI / 2, y: -0.02, a: 0.08, wt: 0.9, wy: 0.06 },
      { th: Math.PI * 0.6, y: -0.43, a: 0.08, wt: 0.7, wy: 0.06 },
    ],
  });
}
function makeLegLoft() {
  return new Loft([
    { y: 0.07, rx: 0.101, rz: 0.112 },
    { y: 0.0, rx: 0.119, rz: 0.125 },
    { y: -0.08, rx: 0.116, rz: 0.121, cz: 0.006 },
    { y: -0.18, rx: 0.105, rz: 0.110, cz: 0.008 },
    { y: -0.3, rx: 0.090, rz: 0.094, cz: 0.006 },
    { y: -0.4, rx: 0.076, rz: 0.080, cz: 0.003 },
    { y: -0.47, rx: 0.068, rz: 0.072 },
    { y: -0.52, rx: 0.063, rz: 0.068, cz: -0.004 },
    { y: -0.6, rx: 0.065, rz: 0.073, cz: -0.01 },
    { y: -0.7, rx: 0.059, rz: 0.062, cz: -0.007 },
    { y: -0.81, rx: 0.047, rz: 0.048, cz: -0.002 },
    { y: -0.9, rx: 0.040, rz: 0.041 },
    { y: -0.945, rx: 0.039, rz: 0.040 },
  ], {
    radial: 28, sub: 3, n: 2, bumps: [
      { th: 0.25, y: -0.16, a: 0.07, wt: 0.6, wy: 0.09 },
      { th: -0.6, y: -0.34, a: 0.06, wt: 0.5, wy: 0.06 },
      { th: Math.PI, y: -0.6, a: 0.12, wt: 0.8, wy: 0.07 },
      { th: 0, y: -0.47, a: 0.045, wt: 0.4, wy: 0.03 },
    ],
  });
}
function makeNeckLoft() {
  return new Loft([
    { y: 1.7, rx: 0.112, rz: 0.102, cz: -0.012 },
    { y: 1.78, rx: 0.102, rz: 0.097, cz: -0.006 },
    { y: 1.86, rx: 0.094, rz: 0.092, cz: 0.012 },
    { y: 1.93, rx: 0.09, rz: 0.09, cz: 0.032 },
    { y: 1.99, rx: 0.082, rz: 0.084, cz: 0.05 },
  ], { radial: 32, sub: 3, n: 2 });
}

// Skinned body: torso, neck, arms, legs.  mats: { skin, neck, shin }
function buildBody(ch, mats) {
  const I = (n) => ch.bi(n);
  const torso = makeTorsoLoft();
  ch.torsoLoft = torso;
  const torsoChain = { bones: [I('hips'), I('spine'), I('chest'), I('neck')], cuts: [1.12, 1.4, 1.8], blend: [0.05, 0.07, 0.03] };
  ch.torsoChain = torsoChain;
  const tg = torso.geometry({ capStart: true });
  skinGeometry(tg, (y) => chainWeight(y, torsoChain));
  ch.parts.torso = ch.addSkinned(tg, mats.skin);

  const neck = makeNeckLoft();
  const ng = neck.geometry();
  skinGeometry(ng, (y) => chainWeight(y, { bones: [I('chest'), I('neck'), I('head')], cuts: [1.78, 1.9], blend: [0.03, 0.04] }));
  ch.addSkinned(ng, mats.neck);

  const arm = makeArmLoft();
  ch.armLoft = arm;
  const ag = arm.geometry({ capEnd: true });
  skinGeometry(ag, (y) => chainWeight(-y, { bones: [I('shoulderL'), I('elbowL'), I('wristL')], cuts: [0.335, 0.64], blend: [0.045, 0.02] }));
  ag.applyMatrix4(ch.bones.shoulderL.matrixWorld);
  const agR = remapSkin(mirrorX(ag), { [I('shoulderL')]: I('shoulderR'), [I('elbowL')]: I('elbowR'), [I('wristL')]: I('wristR') });
  ch.addSkinned(ag, mats.skin);
  ch.addSkinned(agR, mats.skin);

  const leg = makeLegLoft();
  ch.legLoft = leg;
  const lg = leg.geometry({ capEnd: true, splitAtY: -0.5 });
  skinGeometry(lg, (y) => chainWeight(-y, { bones: [I('thighL'), I('kneeL'), I('ankleL')], cuts: [0.47, 0.93], blend: [0.05, 0.02] }));
  lg.applyMatrix4(ch.bones.thighL.matrixWorld);
  const lgR = remapSkin(mirrorX(lg), { [I('thighL')]: I('thighR'), [I('kneeL')]: I('kneeR'), [I('ankleL')]: I('ankleR') });
  ch.addSkinned(lg, [mats.skin, mats.shin]);
  ch.addSkinned(lgR, [mats.skin, mats.shin]);
}

// Surface ring that follows the torso, as a rigid mesh in a bone's local space
function torsoBand(ch, y0, y1, offset, mat, boneName, nu = 64, nv = 4) {
  const g = ch.torsoLoft.strip(-Math.PI, Math.PI, y0, y1, nu, nv, offset);
  const bp = new THREE.Vector3().setFromMatrixPosition(ch.bones[boneName].matrixWorld);
  g.translate(-bp.x, -bp.y, -bp.z);
  const m = meshOf(g, mat);
  ch.bones[boneName].add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Feet: bird talons (ankle-local)
// ---------------------------------------------------------------------------
function buildTalons(g, skinMat, clawMat, wrapMat, goldMat) {
  const pad = meshOf(new THREE.SphereGeometry(1, 18, 12), skinMat);
  pad.scale.set(0.05, 0.034, 0.07); pad.position.set(0, -0.052, 0.035);
  g.add(pad);
  const toe = (yaw, len, r0, pitch = 0) => {
    const tg = new THREE.Group();
    tg.position.set(Math.sin(yaw) * 0.03, -0.058, 0.07 + Math.cos(yaw) * 0.01);
    tg.rotation.set(pitch, yaw, 0);
    g.add(tg);
    tg.add(meshOf(sweep([V3(0, 0, 0), V3(0, 0.006, len * 0.5), V3(0, -0.012, len)], { segs: 10, radial: 10, rx: (t) => r0 * (1 - t * 0.35), ry: (t) => r0 * 0.85 * (1 - t * 0.35) }), skinMat));
    tg.add(meshOf(sweep([V3(0, -0.008, len * 0.9), V3(0, -0.006, len + 0.022), V3(0, -0.022, len + 0.04), V3(0, -0.035, len + 0.045)], { segs: 10, radial: 8, rx: (t) => r0 * 0.62 * (1 - t) + 0.0008, capEnd: false }), clawMat));
    return tg;
  };
  toe(-0.42, 0.1, 0.019); toe(0, 0.125, 0.021); toe(0.42, 0.1, 0.019);
  const back = new THREE.Group(); back.position.set(0, -0.06, 0.0); back.rotation.y = Math.PI; g.add(back);
  back.add(meshOf(sweep([V3(0, 0, 0), V3(0, -0.004, 0.035), V3(0, -0.014, 0.055)], { segs: 8, radial: 8, rx: (t) => 0.014 * (1 - t * 0.3) }), skinMat));
  back.add(meshOf(sweep([V3(0, -0.012, 0.05), V3(0, -0.016, 0.07), V3(0, -0.03, 0.08)], { segs: 8, radial: 8, rx: (t) => 0.009 * (1 - t) + 0.0006, capEnd: false }), clawMat));
  // linen wraps over the instep + gold anklet
  const wrap = meshOf(new THREE.CylinderGeometry(0.044, 0.05, 0.06, 18, 1, true), wrapMat);
  wrap.position.set(0, -0.025, 0.012); wrap.rotation.x = 0.25; g.add(wrap);
  const ank = meshOf(new THREE.TorusGeometry(0.042, 0.007, 8, 28), goldMat);
  ank.rotation.x = Math.PI / 2; ank.position.set(0, 0.012, 0); g.add(ank);
}

// ---------------------------------------------------------------------------
// Hands: three clawed fingers + thumb (wrist-local, left-handed, palm faces -X)
// ---------------------------------------------------------------------------
function buildHand(ch, g, side, mats) {
  const palm = meshOf(new THREE.SphereGeometry(1, 20, 14), mats.palm);
  palm.scale.set(0.024, 0.058, 0.046); palm.position.set(0, -0.058, 0);
  g.add(palm);
  const knuck = meshOf(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12), mats.skin);
  knuck.rotation.x = Math.PI / 2; knuck.position.set(0.002, -0.104, 0); knuck.scale.set(1, 1, 0.9);
  g.add(knuck);
  const fz = [0.033, 0.0, -0.033];
  const fingers = [];
  for (let k = 0; k < 3; k++) {
    const len1 = k === 1 ? 0.06 : 0.054, len2 = k === 1 ? 0.048 : 0.043;
    const f1 = new THREE.Group(); f1.position.set(0.002, -0.11, fz[k]); g.add(f1);
    f1.add(meshOf(sweep([V3(0, 0, 0), V3(0, -len1 * 0.5, 0), V3(0, -len1, 0)], { segs: 5, radial: 10, rx: (t) => 0.0135 - t * 0.0015 }), mats.skin));
    const f2 = new THREE.Group(); f2.position.set(0, -len1, 0); f1.add(f2);
    f2.add(meshOf(sweep([V3(0, 0.004, 0), V3(0, -len2 * 0.5, 0), V3(0, -len2, 0)], { segs: 5, radial: 10, rx: (t) => 0.0118 - t * 0.0015 }), mats.skin));
    f2.add(meshOf(sweep([V3(0, -len2 + 0.006, 0), V3(-0.002, -len2 - 0.018, 0), V3(-0.01, -len2 - 0.036, 0), V3(-0.022, -len2 - 0.046, 0)], { segs: 10, radial: 8, rx: (t) => 0.0098 * (1 - t) + 0.0005, capEnd: false }), mats.claw));
    fingers.push([f1, f2]);
  }
  const t1 = new THREE.Group(); t1.position.set(-0.012, -0.028, 0.04); t1.rotation.set(-0.35, 0, -0.55); g.add(t1);
  t1.add(meshOf(sweep([V3(0, 0, 0), V3(0, -0.024, 0), V3(0, -0.046, 0)], { segs: 5, radial: 10, rx: (t) => 0.015 - t * 0.002 }), mats.skin));
  const t2 = new THREE.Group(); t2.position.set(0, -0.046, 0); t1.add(t2);
  t2.add(meshOf(sweep([V3(0, 0.004, 0), V3(0, -0.02, 0), V3(0, -0.036, 0)], { segs: 5, radial: 10, rx: (t) => 0.0125 - t * 0.0015 }), mats.skin));
  t2.add(meshOf(sweep([V3(0, -0.03, 0), V3(-0.002, -0.05, 0), V3(-0.01, -0.066, 0), V3(-0.02, -0.074, 0)], { segs: 10, radial: 8, rx: (t) => 0.0098 * (1 - t) + 0.0005, capEnd: false }), mats.claw));
  ch.fingers[side] = { fingers, thumb: [t1, t2], curl: 0.35, spread: 0 };
  // socket for held items (book floats above the palm)
  const sock = new THREE.Group(); sock.position.set(-0.05, -0.09, 0); g.add(sock);
  ch.parts['palm' + side] = sock;
}

// ---------------------------------------------------------------------------
// THOTH
// ---------------------------------------------------------------------------
function beakColor(t) {
  const stops = [[0, 0x1a110c], [0.12, 0x2a190f], [0.26, 0x9c5418], [0.42, 0xd98a2a], [0.62, 0xe8a03a], [0.86, 0xc26a1c], [1, 0x6e3410]];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1][0]) {
      const a = new THREE.Color(stops[i][1]), b = new THREE.Color(stops[i + 1][1]);
      return a.lerp(b, (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
    }
  }
  return new THREE.Color(stops[stops.length - 1][1]);
}

function buildThothHead(ch) {
  const head = new THREE.Group();
  ch.bones.head.add(head);
  ch.parts.headGroup = head;
  // skull (head-local; skull centre at (0, 0.1, 0.02))
  const SX = 0.094, SY = 0.104, SZ = 0.13;
  const sg = new THREE.SphereGeometry(1, 56, 36);
  const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = Math.max(0, z);
    x *= SX * (1 - 0.28 * f * f);
    y *= SY * (1 - 0.14 * f * f);
    if (y < 0) y *= 0.88;
    z *= SZ;
    p.setXYZ(i, x, y + 0.1, z + 0.02);
  }
  sg.computeVertexNormals();
  head.add(meshOf(sg, M.skull));
  // eyes
  for (const sx of [1, -1]) {
    const dir = new THREE.Vector3(0.8 * sx, 0.14, 0.58).normalize();
    const eye = meshOf(new THREE.SphereGeometry(0.0195, 20, 14), M.eye, { shadow: false });
    eye.position.set(0.0655 * sx, 0.12, 0.09);
    head.add(eye);
    const pupil = meshOf(new THREE.SphereGeometry(0.0092, 12, 8), M.pupil, { shadow: false });
    pupil.position.copy(eye.position).addScaledVector(dir, 0.013);
    pupil.scale.set(1, 1.35, 1);
    head.add(pupil);
    const ring = meshOf(new THREE.TorusGeometry(0.0215, 0.0034, 8, 28), M.goldPolished, { shadow: false });
    ring.position.copy(eye.position).addScaledVector(dir, 0.004);
    ring.quaternion.setFromUnitVectors(V3(0, 0, 1), dir);
    head.add(ring);
    ch.parts['eye' + (sx > 0 ? 'L' : 'R')] = eye;
  }
  // beak: thick golden-orange upper mandible + hinged lower mandible
  const pts = [V3(0, 0.104, 0.09), V3(0, 0.096, 0.2), V3(0, 0.062, 0.31), V3(0, 0.0, 0.405), V3(0, -0.078, 0.465), V3(0, -0.158, 0.492)];
  const upper = sweep(pts, {
    segs: 44, radial: 22, side: V3(1, 0, 0),
    rx: (t) => 0.043 * Math.pow(1 - t, 1.0) + 0.0018,
    ry: (t) => 0.041 * Math.pow(1 - t, 1.15) + 0.0018,
    color: (t) => beakColor(t), capEnd: false,
  });
  head.add(meshOf(upper, M.beak));
  const jaw = new THREE.Group(); jaw.position.set(0, 0.082, 0.1); head.add(jaw);
  const lowPts = pts.slice(0, 5).map((q, i) => q.clone().add(V3(0, -0.02 - i * 0.003, -0.006)).sub(jaw.position));
  const lower = sweep(lowPts, {
    segs: 34, radial: 16, side: V3(1, 0, 0),
    rx: (t) => 0.034 * Math.pow(1 - t, 1.1) + 0.0015,
    ry: (t) => 0.022 * Math.pow(1 - t, 1.1) + 0.0015,
    color: (t) => beakColor(t * 0.85).multiplyScalar(0.8), capEnd: false,
  });
  jaw.add(meshOf(lower, M.beak));
  ch.parts.jaw = jaw;
  // cheek / nape feather tufts
  const fGeo = extrude(featherShape(0.05, 0.15, 0.28), 0.004, 0.0015);
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - 0.5) * 2.2;
    const fm = meshOf(fGeo, M.featherCard);
    fm.position.set(Math.sin(a) * 0.075, 0.07, -0.07 + Math.abs(a) * 0.025);
    fm.rotation.set(-2.45 + Math.abs(a) * 0.25, a * 0.55, -a * 0.35);
    head.add(fm);
  }

  // ---- headdress: gold cap + forehead band (tilted group)
  const capG = new THREE.Group(); capG.position.set(0, 0.106, 0.012); capG.rotation.x = -0.36; head.add(capG);
  const thR = Math.PI * 0.4;
  const CX = 0.101, CY = 0.113, CZ = 0.139;
  const capGeo = new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, thR);
  capGeo.scale(CX, CY, CZ);
  capG.add(meshOf(capGeo, M.gold));
  const band = new THREE.TorusGeometry(1, 0.06, 10, 72);
  band.rotateX(Math.PI / 2);
  band.scale(CX * Math.sin(thR) * 1.02, 0.18, CZ * Math.sin(thR) * 1.02);
  band.translate(0, Math.cos(thR) * CY, 0);
  capG.add(meshOf(band, M.goldPolished));
  // green enamel panels on the cap (front/back meridians)
  for (const ph of [Math.PI / 2 - 0.62, Math.PI / 2 + 0.62 - 0.26, -Math.PI / 2 - 0.13]) {
    const st = new THREE.SphereGeometry(1, 16, 12, ph, 0.26, 0.1, thR - 0.16);
    st.scale(CX + 0.0015, CY + 0.0015, CZ + 0.0015);
    capG.add(meshOf(st, M.green));
  }
  // uraeus cobra on the forehead
  const ur = new THREE.Group(); ur.position.set(0, 0.176, 0.112); ur.rotation.x = -0.12; head.add(ur);
  ur.add(meshOf(sweep([V3(0, -0.02, -0.012), V3(0, 0.0, 0.012), V3(0, 0.03, 0.004), V3(0, 0.058, 0.012)], { segs: 12, radial: 10, rx: () => 0.01 }), M.gold));
  const hood = meshOf(new THREE.SphereGeometry(1, 18, 12), M.lapis); hood.scale.set(0.026, 0.036, 0.008); hood.position.set(0, 0.052, 0.017); ur.add(hood);
  const hoodRim = meshOf(new THREE.TorusGeometry(1, 0.13, 6, 24), M.goldPolished); hoodRim.scale.set(0.027, 0.037, 0.03); hoodRim.position.copy(hood.position); ur.add(hoodRim);
  const uh = meshOf(new THREE.SphereGeometry(1, 12, 10), M.gold); uh.scale.set(0.011, 0.01, 0.018); uh.position.set(0, 0.082, 0.028); ur.add(uh);
  for (const sx of [1, -1]) { const ue = meshOf(new THREE.SphereGeometry(0.003, 6, 6), M.gemTeal, { shadow: false }); ue.position.set(0.007 * sx, 0.085, 0.039); ur.add(ue); }
  // low modius band
  const mod = meshOf(new THREE.CylinderGeometry(0.084, 0.074, 0.06, 40, 1, true), M.crown);
  mod.position.set(0, 0.235, -0.038); mod.rotation.x = -0.18; head.add(mod);
  const modTop = meshOf(new THREE.TorusGeometry(0.084, 0.0075, 8, 40), M.goldPolished); modTop.rotation.x = Math.PI / 2; modTop.position.set(0, 0.03, 0); mod.add(modTop);
  const modBot = meshOf(new THREE.TorusGeometry(0.075, 0.0075, 8, 40), M.goldPolished); modBot.rotation.x = Math.PI / 2; modBot.position.set(0, -0.03, 0); mod.add(modBot);
  // tall fan of gold plumes with green inlays
  const plumeG = new THREE.Group(); plumeG.position.set(0, 0.262, -0.048); plumeG.rotation.x = -0.24; head.add(plumeG);
  const fan = [-0.78, -0.52, -0.26, 0, 0.26, 0.52, 0.78];
  fan.forEach((a) => {
    const l = 0.29 - Math.abs(a) * 0.06;
    const pg = new THREE.Group(); pg.rotation.z = -a; pg.position.x = Math.sin(a) * 0.05; pg.position.z = -Math.abs(a) * 0.01; plumeG.add(pg);
    pg.add(meshOf(extrude(featherShape(0.072, l, 0.3), 0.009, 0.0032), M.gold));
    const inl = meshOf(extrude(featherShape(0.044, l * 0.8, 0.3), 0.005, 0.0016), M.green); inl.position.set(0, l * 0.09, 0.007); pg.add(inl);
    const inl2 = inl.clone(); inl2.position.z = -0.007; pg.add(inl2);
  });
  // back sweeps (tall gold/teal plates raking up and back)
  for (const sx of [1, -1]) {
    const sw = new THREE.Group(); sw.position.set(0.06 * sx, 0.2, -0.07); sw.rotation.set(-0.72, 0.42 * sx, -0.2 * sx); head.add(sw);
    const geo = bendAroundX(extrude(featherShape(0.085, 0.38, 0.22), 0.01, 0.0035), 0.6);
    sw.add(meshOf(geo, M.gold));
    const ig = bendAroundX(extrude(featherShape(0.05, 0.3, 0.22), 0.006, 0.0018), 0.6);
    const inl = meshOf(ig, M.teal); inl.position.set(0, 0.03, 0.007); sw.add(inl);
    const inl2 = meshOf(ig, M.teal); inl2.position.set(0, 0.03, -0.007); sw.add(inl2);
  }
  // striped lappets on the sides of the head
  for (const sx of [1, -1]) {
    const lg = new THREE.PlaneGeometry(0.065, 0.16, 1, 6);
    bendAroundY(lg, 0.2);
    const lp = meshOf(lg, M.lappet); lp.position.set(0.097 * sx, 0.085, -0.04); lp.rotation.set(0.1, (Math.PI / 2) * sx, 0);
    head.add(lp);
  }
}

function buildPauldron(g) {
  const dome = meshOf(new THREE.SphereGeometry(1, 30, 14, 0, TAU, 0, Math.PI * 0.46), M.gold);
  dome.scale.set(0.138, 0.088, 0.128); dome.rotation.z = -0.55; dome.position.set(0.035, 0.035, 0);
  g.add(dome);
  const domeIn = meshOf(new THREE.SphereGeometry(1, 30, 10, 0, TAU, 0, Math.PI * 0.28), M.teal);
  domeIn.scale.set(0.141, 0.091, 0.131); domeIn.rotation.z = -0.55; domeIn.position.set(0.035, 0.035, 0);
  g.add(domeIn);
  for (let k = 0; k < 3; k++) {
    const R = 0.104 + k * 0.011, w = 0.235 - k * 0.018, h = 0.088;
    const holder = new THREE.Group(); holder.rotation.y = Math.PI / 2; holder.position.set(0.004, -0.015 - k * 0.052, 0); holder.rotation.z = 0.08 * k;
    const plate = extrude(roundRectShape(w, h, 0.03), 0.01, 0.0035); bendAroundY(plate, R); plate.translate(0, 0, R);
    holder.add(meshOf(plate, M.gold));
    const inl = extrude(roundRectShape(w - 0.06, h - 0.04, 0.015), 0.006, 0.002); bendAroundY(inl, R + 0.009); inl.translate(0, 0, R + 0.009);
    holder.add(meshOf(inl, k === 1 ? M.lapis : M.teal));
    g.add(holder);
  }
  // curling horn at the top
  const horn = new THREE.Group(); horn.position.set(0.075, 0.075, -0.035); horn.rotation.set(-0.5, 0.9, -0.7); g.add(horn);
  horn.add(meshOf(bendAroundX(extrude(featherShape(0.06, 0.2, 0.2), 0.009, 0.003), 0.085), M.gold));
  const hi = meshOf(bendAroundX(extrude(featherShape(0.032, 0.15, 0.2), 0.005, 0.0015), 0.085), M.teal); hi.position.z = 0.006; horn.add(hi);
  // jewel
  const gem = meshOf(new THREE.SphereGeometry(0.022, 18, 12), M.gemBlue); gem.position.set(0.118, 0.03, 0.07); g.add(gem);
  const bez = meshOf(new THREE.TorusGeometry(0.024, 0.005, 8, 24), M.goldPolished); bez.position.copy(gem.position); bez.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(0.6, 0.2, 0.75).normalize()); g.add(bez);
}

function buildThoth() {
  const ch = new Character('thoth');
  const b = ch.bones;
  buildBody(ch, { skin: M.skin, neck: M.feather, shin: M.bandage });
  const torso = ch.torsoLoft;

  // straps + woven gold panel (skinned with the torso so they bend with it)
  const sk = (geo) => skinGeometry(geo, (y) => chainWeight(y, ch.torsoChain));
  for (const sd of [1, -1]) {
    const sg = torso.strip(0, 0, 1.63, 1.12, 4, 26, 0.007, (u, v) => sd * lerp(0.4, 0.3, v) + (u - 0.5) * 2 * lerp(0.15, 0.12, v));
    ch.addSkinned(sk(sg), M.strap);
  }
  ch.addSkinned(sk(torso.strip(0, 0, 1.585, 1.13, 10, 22, 0.005, (u, v) => (u - 0.5) * 2 * lerp(0.25, 0.19, v))), M.meshPanel);

  // usekh collar (rigid on chest), hugging the torso surface
  {
    const nu = 72, nv = 10, pos = [], uv = [], idx = [];
    const pt = new THREE.Vector3();
    for (let i = 0; i <= nv; i++) {
      const v = i / nv;
      for (let j = 0; j <= nu; j++) {
        const u = j / nu, th = (u - 0.5) * TAU, at = Math.abs(th);
        const drop = at < Math.PI / 2 ? lerp(0.205, 0.095, smoothstep(0, Math.PI / 2, at)) : lerp(0.095, 0.13, smoothstep(Math.PI / 2, Math.PI, at));
        const y = 1.792 - drop * Math.pow(v, 1.12);
        torso.pointAt(th, y, 0.013 + 0.011 * v, pt);
        pos.push(pt.x, pt.y - 1.42, pt.z); uv.push(u * 5, 1 - v);
      }
    }
    const W = nu + 1;
    for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) { const a = i * W + j, bb = a + 1, c = a + W, d = c + 1; idx.push(a, c, bb, bb, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    M.collar.map.wrapS = M.collar.metalnessMap.wrapS = THREE.RepeatWrapping;
    b.chest.add(meshOf(g, M.collar));
    // golden feather fringe near the shoulders
    for (const sd of [1, -1]) {
      for (let k = 0; k < 6; k++) {
        const th = sd * (0.55 + k * 0.15);
        const at = Math.abs(th);
        const drop = lerp(0.205, 0.095, smoothstep(0, Math.PI / 2, at));
        const y = 1.792 - drop + 0.01;
        torso.pointAt(th, y, 0.03, pt);
        const f = meshOf(extrude(featherShape(0.026, 0.1, 0.2), 0.004, 0.0015), M.gold);
        f.position.set(pt.x, pt.y - 1.42, pt.z);
        f.rotation.set(Math.PI - 0.22, th, 0, 'YXZ');
        b.chest.add(f);
      }
    }
    // pendant (ankh with a sapphire)
    const ankhY = 1.585;
    torso.pointAt(0, ankhY, 0.03, pt);
    const ank = meshOf(extrude(ankhShape(0.11), 0.01, 0.003), M.goldPolished);
    ank.position.set(0, pt.y - 1.42, pt.z + 0.004); ank.rotation.x = -0.12;
    b.chest.add(ank);
    const ag = meshOf(new THREE.SphereGeometry(0.014, 16, 12), M.gemBlue); ag.position.set(0, pt.y - 1.42 + 0.04, pt.z + 0.012); b.chest.add(ag);
    for (let k = 0; k < 3; k++) {
      torso.pointAt(0, ankhY - 0.075 - k * 0.022, 0.02, pt);
      const bd = meshOf(new THREE.SphereGeometry(0.0085, 10, 8), M.gemBlue); bd.position.set(0, pt.y - 1.42, pt.z + 0.004); b.chest.add(bd);
    }
  }
  // neck feather ruff (over the collar inner edge)
  {
    const fg = extrude(featherShape(0.05, 0.11, 0.3), 0.004, 0.0015);
    const count = 34;
    const inst = new THREE.InstancedMesh(fg, M.featherCard, count);
    inst.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const ring = i < 18 ? 0 : 1, k = ring ? i - 18 : i, n = ring ? 16 : 18;
      const th = (k / n) * TAU + ring * 0.17;
      const y = ring ? 1.83 : 1.795;
      const r = ring ? 0.082 : 0.098;
      pp.set(Math.sin(th) * r, y - 1.42 + 0.01, Math.cos(th) * r * 0.95 - 0.006);
      e.set(Math.PI - 0.55, th, 0, 'YXZ'); q.setFromEuler(e);
      s.setScalar(ring ? 0.85 : 1);
      m4.compose(pp, q, s); inst.setMatrixAt(i, m4);
    }
    b.chest.add(inst);
    // fluffy feather mane up the neck (rides the neck bone)
    const mane = new THREE.InstancedMesh(fg, M.featherCard, 3 * 15);
    mane.castShadow = true;
    let mi = 0;
    for (let ring = 0; ring < 3; ring++) {
      const n = 15, y = 0.02 + ring * 0.055, r = 0.098 - ring * 0.006;
      for (let k = 0; k < n; k++) {
        const th = (k / n) * TAU + ring * 0.21;
        const front = Math.cos(th) > 0.55 ? 0.82 : 1;
        pp.set(Math.sin(th) * r, y, Math.cos(th) * r + 0.012 + ring * 0.014);
        e.set(Math.PI - 0.42 + ring * 0.08, th, 0, 'YXZ'); q.setFromEuler(e);
        s.set(front, (1.05 - ring * 0.12) * front, 1);
        m4.compose(pp, q, s); mane.setMatrixAt(mi++, m4);
      }
    }
    b.neck.add(mane);
  }
  buildThothHead(ch);

  // belt + buckle + apron + hip guards
  torsoBand(ch, 1.195, 1.085, 0.015, M.belt, 'hips', 72, 4);
  M.belt.map.wrapS = M.belt.metalnessMap.wrapS = THREE.RepeatWrapping;
  {
    const pt = new THREE.Vector3();
    torso.pointAt(0, 1.15, 0.03, pt);
    const eyeG = new THREE.Group(); eyeG.position.set(0, pt.y - 1.06, pt.z + 0.004); b.hips.add(eyeG);
    eyeG.add(meshOf(extrude(eyeOfHorusShape(0.14), 0.01, 0.003), M.goldPolished));
    eyeG.add(meshOf(extrude(eyeBrowShape(0.14), 0.01, 0.003), M.goldPolished));
    const pup = meshOf(new THREE.SphereGeometry(0.016, 16, 12), M.gemBlue); pup.position.set(-0.004, 0.01, 0.01); pup.scale.z = 0.7; eyeG.add(pup);
    for (let k = 0; k < 7; k++) {
      const a = (k / 6 - 0.5) * 1.9;
      const f = meshOf(extrude(featherShape(0.024, 0.07, 0.3), 0.006, 0.002), M.gold);
      f.position.set(Math.sin(a) * 0.03, 0.04 + Math.cos(a) * 0.012, -0.004); f.rotation.z = -a;
      eyeG.add(f);
    }
    // apron hanging from under the buckle
    const ap = new THREE.Shape(); ap.moveTo(-0.075, 0); ap.lineTo(0.075, 0); ap.lineTo(0.062, -0.37); ap.quadraticCurveTo(0, -0.395, -0.062, -0.37); ap.closePath();
    const apG = new THREE.Group(); apG.position.set(0, pt.y - 1.06 - 0.035, pt.z - 0.004); b.hips.add(apG);
    const apM = meshOf(extrude(ap, 0.008, 0.003), M.apron); apG.add(apM);
    ch.parts.apron = apG;
    // gold scale hip guards
    for (const sd of [1, -1]) {
      const hgG = new THREE.Group(); hgG.rotation.y = sd * Math.PI / 2; hgG.position.set(0, -0.02, 0); b.hips.add(hgG);
      const plate = extrude(roundRectShape(0.15, 0.13, 0.03), 0.006, 0.002); bendAroundY(plate, 0.2); plate.translate(0, -0.03, 0.2);
      hgG.add(meshOf(plate, M.scales));
    }
  }
  // kilt panels (pleated linen + green enamel side panels)
  {
    const ring = torso.ringAt(1.085);
    const nP = 12;
    for (let i = 0; i < nP; i++) {
      const thc = (i / nP) * TAU;
      const at = Math.abs(wrapAngle(thc));
      const green = at > 0.7 && at < 1.75;
      const L = at < 0.4 ? 0.27 : at > 2.4 ? 0.33 : 0.31;
      const rx0 = ring.rx + 0.02, rz0 = ring.rz + 0.02;
      const rAvg = (rx0 + rz0) / 2;
      const wTop = (TAU / nP) * rAvg * 1.28, wBot = wTop * 1.5;
      const cols = 4, rows = 6, pos = [], uv = [], idx = [];
      for (let r = 0; r <= rows; r++) {
        const v = r / rows;
        for (let c = 0; c <= cols; c++) {
          const u = c / cols;
          const w = lerp(wTop, wBot, v);
          const x = (u - 0.5) * w;
          const z = 0.085 * Math.pow(v, 0.9) - (x * x) / (2 * (rAvg + 0.08 * v));
          pos.push(x, -L * v, z); uv.push(u, 1 - v);
        }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, bb = a + 1, cc = a + cols + 1, d = cc + 1; idx.push(a, cc, bb, bb, cc, d); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(thc) * rx0, 1.085 - 1.06, Math.cos(thc) * rz0 + ring.cz);
      pivot.rotation.y = thc;
      const swing = new THREE.Group(); pivot.add(swing);
      const mesh = meshOf(g, green ? M.kiltGreen : M.linen);
      swing.add(mesh);
      b.hips.add(pivot);
      ch.kilt.push({ swing, thc, L, ang: 0, vel: 0 });
    }
  }
  // cream sash tails at the back (simulated as cloth)
  for (const sd of [1, -1]) {
    const n = 8;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const uvs = [], idx = [];
    for (let i = 0; i < n; i++) { uvs.push(0, 1 - i / (n - 1), 1, 1 - i / (n - 1)); }
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, M.cloth); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    ch.tails.push({ mesh, n, seg: 0.085, width: 0.07, anchor: V3(0.045 * sd, 0.1, -0.135), nodes: [], prev: [], ready: false });
  }

  // limbs: pauldrons, armbands, bracers, hands, shin gear, feet
  const arm = ch.armLoft, leg = ch.legLoft;
  for (const s of ['L', 'R']) {
    const pgp = ch.sideGroup('shoulder', s); pgp.scale.multiplyScalar(1.2); pgp.position.set(0, 0.012, 0); buildPauldron(pgp);
    const ab = ch.sideGroup('shoulder', s);
    ab.add(meshOf(arm.strip(-Math.PI, Math.PI, -0.212, -0.258, 40, 3, 0.009), M.cuff));
    const br = ch.sideGroup('elbow', s);
    const bg = arm.strip(-Math.PI, Math.PI, -0.392, -0.626, 40, 10, 0.012); bg.translate(0, 0.34, 0);
    br.add(meshOf(bg, M.bracer));
    for (const yy of [-0.39, -0.613]) {
      const rim = arm.strip(-Math.PI, Math.PI, yy, yy - 0.014, 40, 2, 0.017); rim.translate(0, 0.34, 0);
      br.add(meshOf(rim, M.goldPolished));
    }
    buildHand(ch, ch.sideGroup('wrist', s), s, { skin: M.skin, palm: M.bandage, claw: M.claw });
    // shin gear (knee-local)
    const kg = ch.sideGroup('knee', s);
    const cuff = leg.strip(-Math.PI, Math.PI, -0.535, -0.585, 36, 3, 0.012); cuff.translate(0, 0.47, 0); kg.add(meshOf(cuff, M.cuff));
    const cuff2 = leg.strip(-Math.PI, Math.PI, -0.59, -0.62, 36, 2, 0.01); cuff2.translate(0, 0.47, 0); kg.add(meshOf(cuff2, M.bracer));
    const ank = leg.strip(-Math.PI, Math.PI, -0.855, -0.885, 36, 2, 0.01); ank.translate(0, 0.47, 0); kg.add(meshOf(ank, M.goldPolished));
    const guard = new THREE.Group(); const fr = leg.pointAt(0, -0.7, 0, new THREE.Vector3());
    guard.position.set(0, -0.23, fr.z + 0.006); kg.add(guard);
    const gp = extrude(featherShape(0.09, 0.36, 0.3), 0.008, 0.003);
    gp.rotateZ(Math.PI); gp.translate(0, 0.18, 0);
    bendAroundY(gp, 0.075); bendAroundX(gp, 0.9);
    guard.add(meshOf(gp, M.gold));
    const gi = extrude(featherShape(0.055, 0.3, 0.3), 0.005, 0.0015);
    gi.rotateZ(Math.PI); gi.translate(0, 0.165, 0.006); bendAroundY(gi, 0.081); bendAroundX(gi, 0.9);
    guard.add(meshOf(gi, M.lapis));
    buildTalons(ch.sideGroup('ankle', s), M.skin, M.claw, M.bandage, M.goldPolished);
  }
  // book socket helper: palm L
  ch.root.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; } });
  return ch;
}

// ---------------------------------------------------------------------------
// The Jackal Sentinel (enemy "god" practice target)
// ---------------------------------------------------------------------------
function buildSentinel() {
  const ch = new Character('sentinel');
  const b = ch.bones;
  buildBody(ch, { skin: M.obsidian, neck: M.obsidian, shin: M.goldDark });
  // jackal head
  const head = new THREE.Group(); b.head.add(head); ch.parts.headGroup = head;
  const sk = meshOf(new THREE.SphereGeometry(1, 32, 20), M.obsidian); sk.scale.set(0.09, 0.095, 0.105); sk.position.set(0, 0.1, 0.0); head.add(sk);
  const snout = meshOf(sweep([V3(0, 0.08, 0.05), V3(0, 0.07, 0.15), V3(0, 0.055, 0.25)], { segs: 12, radial: 16, side: V3(1, 0, 0), rx: (t) => 0.045 * (1 - t * 0.55), ry: (t) => 0.05 * (1 - t * 0.5) }), M.obsidian);
  head.add(snout);
  const nose = meshOf(new THREE.SphereGeometry(0.016, 12, 8), M.claw); nose.position.set(0, 0.07, 0.255); head.add(nose);
  for (const sx of [1, -1]) {
    const ear = new THREE.Shape(); ear.moveTo(-0.04, 0); ear.lineTo(0.04, 0); ear.quadraticCurveTo(0.02, 0.12, 0, 0.2); ear.quadraticCurveTo(-0.02, 0.12, -0.04, 0);
    const eg = meshOf(bendAroundY(extrude(ear, 0.012, 0.004), 0.06), M.obsidian);
    eg.position.set(0.05 * sx, 0.17, -0.02); eg.rotation.set(-0.15, 0.2 * sx, -0.25 * sx); head.add(eg);
    const eyeM = meshOf(new THREE.SphereGeometry(0.014, 12, 8), M.enemyEye, { shadow: false }); eyeM.scale.set(1, 0.6, 1); eyeM.position.set(0.05 * sx, 0.12, 0.08); head.add(eyeM);
  }
  // gold collar, belt, bracers, kilt
  const torso = ch.torsoLoft;
  torsoBand(ch, 1.79, 1.66, 0.015, M.gold, 'chest', 64, 6);
  torsoBand(ch, 1.195, 1.085, 0.015, M.gold, 'hips', 64, 4);
  const ring = torso.ringAt(1.085);
  for (let i = 0; i < 10; i++) {
    const thc = (i / 10) * TAU;
    const plate = new THREE.Group();
    plate.position.set(Math.sin(thc) * (ring.rx + 0.02), 0.025, Math.cos(thc) * (ring.rz + 0.02)); plate.rotation.y = thc;
    const sw = new THREE.Group(); plate.add(sw);
    const g = extrude(roundRectShape(0.11, 0.3, 0.02), 0.006, 0.002); g.translate(0, -0.15, 0.01); g.rotateX(-0.25);
    sw.add(meshOf(g, i % 2 ? M.gold : M.lapis));
    b.hips.add(plate);
    ch.kilt.push({ swing: sw, thc, L: 0.3, ang: 0, vel: 0 });
  }
  const arm = ch.armLoft;
  for (const s of ['L', 'R']) {
    const br = ch.sideGroup('elbow', s);
    const bg = arm.strip(-Math.PI, Math.PI, -0.392, -0.626, 32, 6, 0.012); bg.translate(0, 0.34, 0);
    br.add(meshOf(bg, M.gold));
    buildHand(ch, ch.sideGroup('wrist', s), s, { skin: M.obsidian, palm: M.obsidian, claw: M.claw });
    buildTalons(ch.sideGroup('ankle', s), M.obsidian, M.claw, M.goldDark, M.gold);
    const pd = ch.sideGroup('shoulder', s);
    const dome = meshOf(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI * 0.45), M.gold);
    dome.scale.set(0.13, 0.08, 0.12); dome.rotation.z = -0.55; dome.position.set(0.035, 0.035, 0); pd.add(dome);
  }
  // was-sceptre in the right hand
  const staff = new THREE.Group();
  ch.parts.palmR.add(staff);
  staff.position.set(0.03, 0.0, 0); staff.rotation.set(Math.PI / 2, 0, 0);
  const shaft = meshOf(new THREE.CylinderGeometry(0.014, 0.014, 1.9, 10), M.gold); staff.add(shaft);
  const top = meshOf(sweep([V3(0, 0.95, 0), V3(0, 1.02, 0.02), V3(0, 1.05, 0.09)], { segs: 8, radial: 10, rx: (t) => 0.02 * (1 - t * 0.4) }), M.gold); staff.add(top);
  const fork = meshOf(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), M.gold); fork.position.y = -0.95; fork.rotation.z = Math.PI; staff.add(fork);
  ch.root.scale.setScalar(1.12);
  return ch;
}


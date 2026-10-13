// ============================================================================
// Materials + environment lighting (PMREM from a procedural night sky)
// ============================================================================
const M = {};

function makeEnvironmentMap() {
  const envScene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vP;
      void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vP;
      void main() {
        float h = vP.y;
        vec3 top = vec3(0.025, 0.045, 0.13);
        vec3 hor = vec3(0.20, 0.17, 0.30);
        vec3 gnd = vec3(0.13, 0.09, 0.055);
        vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(hor * 0.8, gnd, pow(clamp(-h, 0.0, 1.0), 0.4));
        vec3 md = normalize(vec3(-0.35, 0.62, 0.70));
        float m = max(dot(vP, md), 0.0);
        c += vec3(0.75, 0.85, 1.0) * (pow(m, 600.0) * 60.0 + pow(m, 10.0) * 0.35);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785 + 0.3;
          vec3 d = normalize(vec3(cos(a), 0.06, sin(a)));
          float t = max(dot(vP, d), 0.0);
          c += vec3(1.0, 0.5, 0.18) * pow(t, 90.0) * 5.0;
        }
        // soft warm ground bounce + cool rim
        c += vec3(0.25, 0.32, 0.6) * pow(max(dot(vP, normalize(vec3(0.6, 0.35, -0.7))), 0.0), 6.0) * 0.25;
        // realism pass: two broad, soft "softbox" lobes (warm torch key, cool moon fill) so the gods' gold, enamel and
        // skin pick up shaped reflections and read as round 3D forms, not flat cut-outs
        c += vec3(1.0, 0.62, 0.32) * pow(max(dot(vP, normalize(vec3(0.55, 0.3, 0.78))), 0.0), 7.0) * 0.32;
        c += vec3(0.3, 0.45, 1.0) * pow(max(dot(vP, normalize(vec3(-0.65, 0.55, -0.5))), 0.0), 5.0) * 0.2;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.015);
  pmrem.dispose();
  return rt.texture;
}

function patternMat(pair, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({
    map: pair.map, metalnessMap: pair.mr, roughnessMap: pair.mr, metalness: 1, roughness: 1,
  }, opts));
}

function makeMaterials(T) {
  const goldDetail = makeGoldDetail();
  goldDetail.repeat.set(3, 3);
  M.gold = new THREE.MeshStandardMaterial({ color: 0xe3ad4c, metalness: 1, roughness: 0.27, bumpMap: goldDetail, bumpScale: 0.35 });
  M.goldPolished = new THREE.MeshStandardMaterial({ color: 0xf2c25e, metalness: 1, roughness: 0.16 });
  M.goldDark = new THREE.MeshStandardMaterial({ color: 0xa8792c, metalness: 1, roughness: 0.42 });
  M.bronze = new THREE.MeshStandardMaterial({ color: 0x7a5530, metalness: 1, roughness: 0.42 });
  const enamel = (c, r = 0.26) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  M.green = enamel(0x10834a);
  M.teal = enamel(0x18a7a0);
  M.lapis = enamel(0x1d3b92);
  M.purple = enamel(0x5a3fb8);
  M.gemBlue = new THREE.MeshPhysicalMaterial({ color: 0x2f62ff, emissive: 0x1238c0, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 });
  M.gemGreen = new THREE.MeshPhysicalMaterial({ color: 0x27c45e, emissive: 0x0b7a32, emissiveIntensity: 0.65, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 });
  M.gemTeal = new THREE.MeshPhysicalMaterial({ color: 0x5fe0e0, emissive: 0x168f9a, emissiveIntensity: 0.8, roughness: 0.05, clearcoat: 1 });
  M.skin = new THREE.MeshPhysicalMaterial({
    map: T.skin.map, bumpMap: T.skin.bump, bumpScale: 0.25, roughness: 0.48, metalness: 0,
    sheen: 0.32, sheenColor: new THREE.Color(0x5d70d8), sheenRoughness: 0.5,
  });
  T.skin.map.repeat.set(2, 2); T.skin.bump.repeat.set(4, 4);
  M.feather = new THREE.MeshPhysicalMaterial({
    map: T.feather.map, bumpMap: T.feather.bump, bumpScale: 1.4, roughness: 0.55, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(0x3d6cff), sheenRoughness: 0.32, vertexColors: false,
  });
  T.feather.map.repeat.set(2.5, 0.8); T.feather.bump.repeat.set(2.5, 0.8);
  M.skull = new THREE.MeshPhysicalMaterial({
    map: T.skull.map, bumpMap: T.skull.bump, bumpScale: 1.1, roughness: 0.5, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(0x3d6cff), sheenRoughness: 0.3,
  });
  M.featherCard = new THREE.MeshPhysicalMaterial({ color: 0x141c3c, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0x4f7dff), sheenRoughness: 0.3, side: THREE.DoubleSide });
  M.beak = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.0, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  M.eye = new THREE.MeshStandardMaterial({ color: 0x0a2414, emissive: 0x4dff8f, emissiveIntensity: 2.2, roughness: 0.2 });
  M.pupil = new THREE.MeshStandardMaterial({ color: 0x020302, roughness: 0.1 });
  M.claw = new THREE.MeshPhysicalMaterial({ color: 0x0b0b12, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  M.linen = new THREE.MeshStandardMaterial({ map: T.kilt.map, bumpMap: T.kilt.bump, bumpScale: 0.6, roughness: 0.82, side: THREE.DoubleSide });
  M.linenDark = new THREE.MeshStandardMaterial({ color: 0x6a5232, roughness: 0.9 });
  M.cloth = new THREE.MeshStandardMaterial({ color: 0xc9b58a, roughness: 0.9, side: THREE.DoubleSide, map: T.kilt.map });
  M.kiltGreen = patternMat(T.kiltGreen, { side: THREE.DoubleSide });
  M.collar = patternMat(T.collar);
  M.belt = patternMat(T.belt);
  M.strap = patternMat(T.strap);
  M.meshPanel = patternMat(T.mesh);
  M.crown = patternMat(T.crown, { side: THREE.DoubleSide });
  M.apron = patternMat(T.apron);
  M.bracer = patternMat(T.bracer);
  M.cuff = patternMat(T.cuff);
  M.lappet = patternMat(T.lappet, { side: THREE.DoubleSide });
  M.scales = patternMat(T.scales);
  M.bandage = new THREE.MeshStandardMaterial({ map: T.bandage.map, bumpMap: T.bandage.bump, bumpScale: 1.2, roughness: 0.92 });
  T.bandage.map.repeat.set(2, 1); T.bandage.bump.repeat.set(2, 1);
  M.cover = new THREE.MeshStandardMaterial({ map: T.cover.map, bumpMap: T.cover.bump, bumpScale: 1.5, metalness: 0.7, roughness: 0.42 });
  M.coverPlain = new THREE.MeshStandardMaterial({ color: 0x8a5f22, metalness: 0.75, roughness: 0.4 });
  M.page = new THREE.MeshStandardMaterial({ map: T.page.map, emissiveMap: T.page.glow, emissive: 0x8fe2ff, emissiveIntensity: 0.0, roughness: 0.95, side: THREE.DoubleSide, color: 0xc9b99a });
  M.pageEdge = new THREE.MeshStandardMaterial({ map: T.pageEdge, roughness: 0.55, metalness: 0.35 });
  M.ushabti = new THREE.MeshPhysicalMaterial({ map: T.ushabti, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.ushabtiDark = new THREE.MeshPhysicalMaterial({ color: 0x15807a, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  M.obsidian = new THREE.MeshPhysicalMaterial({ map: T.obsidian, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
  T.obsidian.repeat.set(2, 2);
  M.enemyEye = new THREE.MeshStandardMaterial({ color: 0x220400, emissive: 0xff4a1a, emissiveIntensity: 4 });
  M.basalt = new THREE.MeshPhysicalMaterial({ color: 0x17181f, roughness: 0.32, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  return M;
}


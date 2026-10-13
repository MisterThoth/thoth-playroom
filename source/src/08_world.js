// ============================================================================
// The playroom: "Hall of Ma'at" — a moonlit temple courtyard.
// ============================================================================
const WORLD = {
  dim: 1, dimK: 1, dimLights: [],   // the temple darkens while a god gathers power (0..1)
  tint: { color: new THREE.Color(0, 0, 0), target: 0, k: 0 }, tmpCol: new THREE.Color(),   // finals tint sky + moonlight (aurora, eclipse, blood moon)
  minX: -21.6, maxX: 21.6, minZ: -27.4, maxZ: 31.8,
  circles: [], boxes: [], updaters: [], braziers: [], glowMats: [],
  moonDir: new THREE.Vector3(0.22, 0.36, 0.9).normalize(),
  lightDir: new THREE.Vector3(-0.5, 0.8, -0.36).normalize(),
};

function boxWorldUV(geo, scale = 4) {
  // rescale BoxGeometry face UVs to world size so textures don't stretch
  geo.computeBoundingBox();
  const s = new THREE.Vector3(); geo.boundingBox.getSize(s);
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let w, h;
    if (nx > 0.5) { w = s.z; h = s.y; } else if (ny > 0.5) { w = s.x; h = s.z; } else { w = s.x; h = s.y; }
    uv.setXY(i, uv.getX(i) * w / scale, uv.getY(i) * h / scale);
  }
  return geo;
}

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uMoonDir: { value: WORLD.moonDir }, uTint: { value: WORLD.tint.color }, uTintK: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform float uTime; uniform vec3 uMoonDir; uniform vec3 uTint; uniform float uTintK;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x) {
        vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zen = vec3(0.006, 0.012, 0.045);
        vec3 mid = vec3(0.03, 0.045, 0.13);
        vec3 hor = vec3(0.16, 0.12, 0.24);
        vec3 col = mix(hor, mid, smoothstep(-0.02, 0.22, h));
        col = mix(col, zen, smoothstep(0.22, 0.95, h));
        col = mix(col, vec3(0.04, 0.03, 0.05), smoothstep(0.0, -0.12, h));
        // nebula / milky way
        vec3 band = normalize(vec3(0.35, 0.55, -0.75));
        float bq = dot(d, band) * 2.6; float bw = exp(-bq * bq);
        float n = fbm(d * 5.0 + vec3(0.0, uTime * 0.004, 0.0));
        float n2 = fbm(d * 13.0 - 3.1);
        col += vec3(0.18, 0.2, 0.42) * bw * pow(max(n, 0.0), 2.0) * 1.1 * smoothstep(0.0, 0.25, h);
        col += vec3(0.25, 0.12, 0.35) * bw * pow(max(n2, 0.0), 3.0) * 0.6 * smoothstep(0.0, 0.25, h);
        // stars
        vec3 sp = d * 260.0; vec3 cell = floor(sp); float r = hash(cell);
        if (r > 0.972) {
          vec3 c = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.1), hash(cell + 3.7)) - 0.5) * 0.6;
          float st = smoothstep(0.32, 0.0, length(sp - c));
          float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 6.0) + r * 91.0);
          col += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), hash(cell + 9.0)) * st * tw * (r > 0.995 ? 5.0 : 1.8) * smoothstep(0.0, 0.12, h);
        }
        // moon
        float md = dot(d, uMoonDir);
        float disc = smoothstep(0.99905, 0.99925, md);
        float crater = fbm(d * 160.0) * 0.5 + fbm(d * 60.0) * 0.5;
        col = mix(col, vec3(1.0, 0.96, 0.88) * (2.3 + crater * 0.9 - 0.6), disc);
        col += vec3(0.55, 0.65, 1.0) * (pow(max(md, 0.0), 900.0) * 0.6 + pow(max(md, 0.0), 40.0) * 0.12 + pow(max(md, 0.0), 6.0) * 0.05);
        col = mix(col, col * 0.3 + uTint * (0.04 + 0.32 * smoothstep(-0.1, 0.75, h)), uTintK);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  WORLD.skyMat = mat;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 64, 32), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  WORLD.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; sky.position.copy(camera.position); });
  return sky;
}

function makeFlameMaterial(seed) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uSize: { value: new THREE.Vector2(0.9, 1.5) } },
    vertexShader: /* glsl */`
      uniform vec2 uSize; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += (uv - vec2(0.5, 0.0)) * uSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime; uniform float uSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
      void main() {
        vec2 uv = vUv;
        float n = fbm(vec2(uv.x * 3.2 + uSeed, uv.y * 2.4 - uTime * 2.6));
        float width = mix(0.36, 0.03, pow(uv.y, 0.75));
        float dx = abs(uv.x - 0.5 + (n - 0.5) * 0.32 * uv.y);
        float body = smoothstep(width, width * 0.2, dx);
        float hgt = smoothstep(1.0, 0.2, uv.y + n * 0.42);
        float f = body * hgt * smoothstep(0.0, 0.06, uv.y);
        vec3 col = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.68, 0.22), f);
        col = mix(col, vec3(1.0, 0.95, 0.78), smoothstep(0.72, 1.0, f));
        gl_FragColor = vec4(col * f * 2.6, f);
      }`,
  });
}

function addCollBox(minX, maxX, minZ, maxZ, blocksShots = true) { WORLD.boxes.push({ minX, maxX, minZ, maxZ, shots: blocksShots }); }
function addCollCircle(x, z, r, blocksShots = true) { WORLD.circles.push({ x, z, r, shots: blocksShots }); }

function buildWorld() {
  const floorT = makeFloorTextures();
  const wallT = makeWallTextures();
  const relief = makeReliefTexture(2048, 512, 3, true);
  const colT = makeColumnTexture();
  const sandT = makeSandTexture();
  const waterN = makeWaterNormals();
  const rune = makeRuneCircle();
  WORLD.tex = { floorT, wallT, relief, colT, sandT, waterN, rune };
  // the temple's scenery lives in one group, so another map (Arena 5v5) can hide it; sky, moon and hemisphere light stay shared
  const scene = WORLD.group = new THREE.Group(); WORLD.group.name = 'hall-of-maat';
  rootScene.add(WORLD.group);

  const stone = new THREE.MeshStandardMaterial({ map: wallT.map, bumpMap: wallT.bump, bumpScale: 2.2, roughness: 0.86, color: 0xd8cbb6 });
  const stoneDark = new THREE.MeshStandardMaterial({ map: wallT.map, bumpMap: wallT.bump, bumpScale: 2.2, roughness: 0.9, color: 0x9a8a78 });
  const reliefMat = new THREE.MeshStandardMaterial({ map: relief.map, bumpMap: relief.bump, bumpScale: 3, roughness: 0.85, color: 0xe2d4bc,
    emissiveMap: relief.glow, emissive: 0x5fb8ff, emissiveIntensity: 0.0 });
  WORLD.reliefMat = reliefMat;

  // ---- sky, lights, fog
  makeSky();
  const S0 = rootScene;
  S0.fog = new THREE.FogExp2(0x0d1230, 0.0042);
  const hemi = new THREE.HemisphereLight(0x3a4f9a, 0x4a3420, 0.75);
  S0.add(hemi);
  const moon = new THREE.DirectionalLight(0xb4c6ff, 1.55);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.035;
  S0.add(moon); S0.add(moon.target);
  WORLD.moon = moon;
  WORLD.hemi = hemi; WORLD.hemiBase = hemi.color.clone(); WORLD.moonBase = moon.color.clone(); WORLD.fogBase = S0.fog.color.clone();
  WORLD.dimLights.push([hemi, hemi.intensity], [moon, moon.intensity]);

  // ---- floor
  const fW = 46, fD = 62, fz = (WORLD.minZ + WORLD.maxZ) / 2 + 0.6;
  for (const t of [floorT.map, floorT.bump, floorT.rough]) t.repeat.set(fW / 8, fD / 8);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorT.map, bumpMap: floorT.bump, bumpScale: 1.6, roughnessMap: floorT.rough, roughness: 1, metalness: 0, color: 0xe8dccb });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fW, fD), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, fz); floor.receiveShadow = true;
  scene.add(floor);
  // processional path: polished granite with glowing glyph borders
  const pathMap = floorT.map.clone(); pathMap.needsUpdate = true; pathMap.repeat.set(6.4 / 8, (fD - 4) / 8);
  const pathBump = floorT.bump.clone(); pathBump.needsUpdate = true; pathBump.repeat.copy(pathMap.repeat);
  const granite = new THREE.MeshStandardMaterial({ color: 0x9c8078, roughness: 0.3, metalness: 0.0, map: pathMap, bumpMap: pathBump, bumpScale: 1.2 });
  const pathGeo = new THREE.PlaneGeometry(6.4, fD - 4);
  const path = new THREE.Mesh(pathGeo, granite); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.006, fz); path.receiveShadow = true;
  scene.add(path);
  const bandTex = relief.glow.clone(); bandTex.needsUpdate = true; bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping; bandTex.repeat.set(1, 14);
  const bandColor = relief.map.clone(); bandColor.needsUpdate = true; bandColor.wrapS = bandColor.wrapT = THREE.RepeatWrapping; bandColor.repeat.set(1, 14);
  const bandMat = new THREE.MeshStandardMaterial({ map: bandColor, emissiveMap: bandTex, emissive: 0x58b6ff, emissiveIntensity: 1.2, roughness: 0.5, color: 0x8f6a3a });
  WORLD.glowMats.push({ mat: bandMat, base: 1.0, amp: 0.5, speed: 0.9 });
  for (const sx of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.42, fD - 4), bandMat);
    band.rotation.x = -Math.PI / 2; band.rotation.z = Math.PI / 2 * 0; band.position.set(sx * 3.45, 0.008, fz); band.receiveShadow = true;
    // rotate texture so glyph columns run along the path
    scene.add(band);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, fD - 4), M.goldPolished); gl.position.set(sx * 3.72, 0.012, fz); gl.receiveShadow = true; scene.add(gl);
    const gl2 = gl.clone(); gl2.position.x = sx * 3.18; scene.add(gl2);
  }
  // central medallion (Thoth's eye + crescent)
  const medMat = new THREE.MeshStandardMaterial({ map: rune, emissiveMap: rune, emissive: 0x6fc8ff, emissiveIntensity: 0.9, transparent: true, depthWrite: false, color: 0xd9b25a, roughness: 0.35, metalness: 0.6 });
  const med = new THREE.Mesh(new THREE.CircleGeometry(4.2, 96), medMat);
  med.rotation.x = -Math.PI / 2; med.position.set(0, 0.012, 6); med.receiveShadow = true; scene.add(med);
  WORLD.glowMats.push({ mat: medMat, base: 0.8, amp: 0.4, speed: 0.6 });
  WORLD.updaters.push((dt) => { med.rotation.z += dt * 0.04; });
  const medRing = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.06, 8, 128), M.goldPolished); medRing.rotation.x = Math.PI / 2; medRing.position.set(0, 0.015, 6); scene.add(medRing);

  // ---- perimeter walls with reliefs
  const wallH = 7.2, wallT2 = 1.6;
  const mkWall = (cx, cz, w, d) => {
    const g = boxWorldUV(new THREE.BoxGeometry(w, wallH, d), 6);
    const m = new THREE.Mesh(g, stone); m.position.set(cx, wallH / 2, cz); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    addCollBox(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
    // cavetto cornice
    const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.lineTo(0.15, 0); prof.quadraticCurveTo(0.2, 0.55, 0.75, 0.85); prof.lineTo(0.75, 1.0); prof.lineTo(0, 1.0); prof.closePath();
    const len = Math.max(w, d);
    for (const side of [-1, 1]) {
      const cg = new THREE.ExtrudeGeometry(prof, { depth: len, bevelEnabled: false, curveSegments: 10 });
      const cm = new THREE.Mesh(cg, stoneDark); cm.castShadow = true; cm.receiveShadow = true;
      if (w > d) { cm.rotation.y = Math.PI / 2; cm.scale.x = side; cm.position.set(cx - len / 2, wallH, cz + side * d / 2); if (side < 0) cm.position.x = cx + len / 2; cm.scale.z = side; }
      else { cm.position.set(cx + side * w / 2, wallH, cz - len / 2); cm.scale.x = side; }
      scene.add(cm);
    }
    const torus = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 10), stoneDark);
    if (w > d) torus.rotation.z = Math.PI / 2; else torus.rotation.x = Math.PI / 2;
    torus.position.set(cx, wallH - 0.1, cz); torus.scale.set(1, 1, 1);
    return m;
  };
  mkWall(-(WORLD.maxX + 0.4 + wallT2 / 2), (WORLD.minZ + WORLD.maxZ) / 2 + 1, wallT2, WORLD.maxZ - WORLD.minZ + 6);
  mkWall(WORLD.maxX + 0.4 + wallT2 / 2, (WORLD.minZ + WORLD.maxZ) / 2 + 1, wallT2, WORLD.maxZ - WORLD.minZ + 6);
  mkWall(0, WORLD.minZ - 0.4 - wallT2 / 2, WORLD.maxX * 2 + 4.6, wallT2);
  // relief friezes on the inner faces of the long walls + back wall
  relief.map.repeat.set(1, 1); relief.bump.repeat.set(1, 1); relief.glow.repeat.set(1, 1);
  const frieze = (x, z, len, rotY) => {
    const g = new THREE.PlaneGeometry(len, 2.8);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 11);
    const m = new THREE.Mesh(g, reliefMat); m.position.set(x, 3.3, z); m.rotation.y = rotY; m.receiveShadow = true; scene.add(m);
  };
  frieze(WORLD.minX - 0.38, 2, 58, Math.PI / 2);
  frieze(WORLD.maxX + 0.38, 2, 58, -Math.PI / 2);
  frieze(0, WORLD.minZ - 0.38, 44, 0);

  // ---- colonnades (papyrus columns, instanced)
  const colLoft = new Loft([
    { y: 0, rx: 0.66 }, { y: 0.3, rx: 0.6 }, { y: 1.4, rx: 0.64 }, { y: 4.0, rx: 0.58 }, { y: 6.2, rx: 0.5 }, { y: 6.45, rx: 0.48 },
  ], { radial: 64, sub: 4, n: 2, shape: (th) => 1 + 0.045 * Math.pow(Math.abs(Math.cos(th * 4)), 0.6) });
  const shaftGeo = colLoft.geometry();
  const shaftMat = new THREE.MeshStandardMaterial({ map: colT, roughness: 0.82, color: 0xf0e2c8 });
  const capLoft = new Loft([
    { y: 6.4, rx: 0.5 }, { y: 6.8, rx: 0.62 }, { y: 7.25, rx: 1.0 }, { y: 7.45, rx: 1.16 }, { y: 7.55, rx: 1.12 },
  ], { radial: 64, sub: 4, n: 2, shape: (th, y) => 1 + 0.08 * Math.pow(Math.abs(Math.cos(th * 8)), 2.0) * smoothstep(6.5, 7.4, y) });
  const capGeo = capLoft.geometry({ capEnd: true });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.75, map: colT });
  const abGeo = boxWorldUV(new THREE.BoxGeometry(1.5, 0.5, 1.5), 3);
  const baseGeo = new THREE.CylinderGeometry(0.95, 1.0, 0.32, 40);
  const colPositions = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) colPositions.push([sx * 17.6, WORLD.minZ + 3.2 + i * 6.6]);
  const inst = (geo, mat, yOff = 0) => {
    const im = new THREE.InstancedMesh(geo, mat, colPositions.length);
    const m4 = new THREE.Matrix4();
    colPositions.forEach(([x, z], i) => { m4.makeTranslation(x, yOff, z); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im); return im;
  };
  inst(shaftGeo, shaftMat, 0.32); inst(capGeo, capMat, 0.32); inst(abGeo, stoneDark, 8.12); inst(baseGeo, stoneDark, 0.16);
  colPositions.forEach(([x, z]) => addCollCircle(x, z, 0.85));
  for (const sx of [-1, 1]) {
    const len = WORLD.maxZ - WORLD.minZ + 4;
    const arch = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(1.4, 1.0, len), 5), stone);
    arch.position.set(sx * 17.6, 8.87, (WORLD.minZ + WORLD.maxZ) / 2 + 0.6); arch.castShadow = true; arch.receiveShadow = true; scene.add(arch);
    const roof = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(5.6, 0.5, len), 5), stoneDark);
    roof.position.set(sx * 20.2, 9.5, (WORLD.minZ + WORLD.maxZ) / 2 + 0.6); roof.castShadow = true; roof.receiveShadow = true; scene.add(roof);
    const archRelief = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), reliefMat);
    const uv = archRelief.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 4);
    archRelief.position.set(sx * (17.6 - 0.71), 8.87, arch.position.z); archRelief.rotation.y = -sx * Math.PI / 2; scene.add(archRelief);
  }

  // ---- pylon gate at the far end
  const pyl = (x) => {
    const g = new THREE.CylinderGeometry(Math.SQRT2 * 0.5, Math.SQRT2 * 0.5 * 1.18, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(10.5, 15, 5.5);
    g.translate(0, 7.5, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5, uv.getY(i) * 2.5);
    const m = new THREE.Mesh(g, stone); m.position.set(x, 0, WORLD.maxZ + 4.2); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 9.5), reliefMat);
    const fuv = face.geometry.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 0.8 + (x > 0 ? 0.2 : 0), fuv.getY(i) * 3.4);
    face.position.set(x, 6.2, WORLD.maxZ + 4.2 - 2.92); face.rotation.x = -0.055; face.rotation.y = Math.PI; face.rotation.y = 0; scene.add(face);
    face.position.z = WORLD.maxZ + 4.2 - 3.05; face.rotation.x = 0.06;
    const corn = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(10.2, 1.0, 5.4), 4), stoneDark); corn.position.set(x, 15.4, WORLD.maxZ + 4.2); corn.castShadow = true; scene.add(corn);
    addCollBox(x - 5.6, x + 5.6, WORLD.maxZ + 0.6, WORLD.maxZ + 8);
  };
  pyl(-8.3); pyl(8.3);
  const lintel = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(7.2, 2.2, 4.2), 4), stone); lintel.position.set(0, 10.6, WORLD.maxZ + 4.2); lintel.castShadow = true; scene.add(lintel);
  // winged sun disc over the gate
  const wsd = new THREE.Group(); wsd.position.set(0, 10.6, WORLD.maxZ + 2.05); scene.add(wsd);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), M.goldPolished); disc.scale.z = 0.4; wsd.add(disc);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Shape(); wing.moveTo(0, 0.25); wing.quadraticCurveTo(1.6, 0.6, 2.9, 0.15); wing.lineTo(2.8, -0.05); wing.quadraticCurveTo(1.4, 0.0, 0.2, -0.4); wing.closePath();
    const wg = new THREE.Mesh(extrude(wing, 0.08, 0.03), M.gold); wg.position.x = sx * 0.45; wg.scale.x = sx; wsd.add(wg);
    const wi = new THREE.Mesh(extrude(wing, 0.06, 0.02), M.lapis); wi.position.set(sx * 0.55, -0.05, 0.03); wi.scale.set(sx * 0.82, 0.62, 1); wsd.add(wi);
    const cob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.gold); cob.position.set(sx * 0.5, -0.45, 0.05); cob.scale.set(0.6, 1.2, 0.5); wsd.add(cob);
  }
  const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 9.5), new THREE.MeshBasicMaterial({ color: 0x0a1a3a, transparent: true, opacity: 0.92, fog: false }));
  gateGlow.position.set(0, 4.75, WORLD.maxZ + 6.0); gateGlow.rotation.y = Math.PI; scene.add(gateGlow);
  const gateLight = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 9.5), new THREE.MeshBasicMaterial({ color: 0x2a6cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  gateLight.position.set(0, 4.75, WORLD.maxZ + 5.9); scene.add(gateLight);
  addCollBox(-3, 3, WORLD.maxZ + 0.6, WORLD.maxZ + 8);

  // ---- obelisks with glowing inscriptions
  const obGlow = makeReliefTexture(256, 2048, 17, true);
  const obMat = new THREE.MeshStandardMaterial({ color: 0x8a6a62, roughness: 0.42, map: obGlow.map, bumpMap: obGlow.bump, bumpScale: 2.5, emissiveMap: obGlow.glow, emissive: 0x4fb4ff, emissiveIntensity: 1.6 });
  WORLD.glowMats.push({ mat: obMat, base: 1.3, amp: 0.8, speed: 1.3 });
  for (const sx of [-1, 1]) {
    const x = sx * 7.6, z = 26.2;
    const ped = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(2.4, 1.0, 2.4), 3), stoneDark); ped.position.set(x, 0.5, z); ped.castShadow = true; ped.receiveShadow = true; scene.add(ped);
    const g = new THREE.CylinderGeometry(Math.SQRT2 * 0.42, Math.SQRT2 * 0.66, 11.5, 4, 1); g.rotateY(Math.PI / 4);
    const ob = new THREE.Mesh(g, obMat); ob.position.set(x, 1 + 5.75, z); ob.castShadow = true; ob.receiveShadow = true; scene.add(ob);
    const pg = new THREE.ConeGeometry(Math.SQRT2 * 0.42, 1.1, 4); pg.rotateY(Math.PI / 4);
    const py = new THREE.Mesh(pg, M.goldPolished); py.position.set(x, 1 + 11.5 + 0.55, z); py.castShadow = true; scene.add(py);
    addCollCircle(x, z, 1.5);
  }

  // ---- giant ibis statues on plinths (replaced by sphinxes when the GLB props load)
  WORLD.ibis = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * 12.2, 0, 22.5); g.rotation.y = -sx * 0.35 + Math.PI * 0; scene.add(g);
    WORLD.ibis.push(g);
    const pl = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(3.4, 3.0, 4.4), 3), stone); pl.position.y = 1.5; pl.castShadow = true; pl.receiveShadow = true; g.add(pl);
    const plc = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(3.7, 0.3, 4.7), 3), stoneDark); plc.position.y = 3.1; g.add(plc);
    const bird = new THREE.Group(); bird.position.y = 3.25; bird.scale.setScalar(2.1); g.add(bird);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), M.basalt); body.scale.set(0.42, 0.42, 0.72); body.position.set(0, 1.25, 0.0); body.rotation.x = 0.25; bird.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 16), M.basalt); tail.position.set(0, 1.05, -0.8); tail.rotation.x = -1.9; bird.add(tail);
    const neck = new THREE.Mesh(sweep([V3(0, 1.4, 0.45), V3(0, 1.75, 0.62), V3(0, 2.0, 0.6), V3(0, 2.15, 0.7)], { segs: 16, radial: 14, rx: (t) => 0.16 - t * 0.07 }), M.basalt); bird.add(neck);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), M.basalt); hd.position.set(0, 2.2, 0.76); hd.scale.set(0.9, 1, 1.2); bird.add(hd);
    const bk = new THREE.Mesh(sweep([V3(0, 2.22, 0.88), V3(0, 2.2, 1.15), V3(0, 2.05, 1.45), V3(0, 1.8, 1.62)], { segs: 20, radial: 12, side: V3(1, 0, 0), rx: (t) => 0.05 * (1 - t) + 0.004 }), M.goldPolished); bird.add(bk);
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 24), M.gold); col.position.set(0, 1.65, 0.55); col.rotation.x = 1.2; bird.add(col);
    for (const lx of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.95, 8), M.basalt); leg.position.set(lx, 0.48, 0.05); bird.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.3), M.basalt); foot.position.set(lx, 0.02, 0.12); bird.add(foot);
    }
    const eyeG = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), M.gemTeal); eyeG.position.set(0.11, 2.24, 0.82); bird.add(eyeG);
    const eyeG2 = eyeG.clone(); eyeG2.position.x = -0.11; bird.add(eyeG2);
    bird.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const wp = new THREE.Vector3(); pl.getWorldPosition(wp);
    addCollCircle(g.position.x, g.position.z, 2.6);
    g.userData.coll = WORLD.circles[WORLD.circles.length - 1];
  }

  // ---- braziers (fire + flickering light)
  const bowlLoft = new Loft([{ y: 0, rx: 0.12 }, { y: 0.08, rx: 0.42 }, { y: 0.28, rx: 0.62 }, { y: 0.4, rx: 0.66 }], { radial: 32, sub: 3 });
  const bowlGeo = bowlLoft.geometry({ capStart: true });
  const standGeo = new THREE.CylinderGeometry(0.1, 0.22, 1.1, 16);
  const footGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.16, 24);
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x1a0a04, emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 0.9 });
  const brazierSpots = [[-5.2, -15], [5.2, -15], [-5.2, 1], [5.2, 1], [-5.2, 17], [5.2, 17]];
  brazierSpots.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const ft = new THREE.Mesh(footGeo, M.bronze); ft.position.y = 0.08; g.add(ft);
    const st = new THREE.Mesh(standGeo, M.bronze); st.position.y = 0.7; g.add(st);
    const bw = new THREE.Mesh(bowlGeo, M.bronze); bw.position.y = 1.22; g.add(bw);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.04, 8, 40), M.goldPolished); rim.rotation.x = Math.PI / 2; rim.position.y = 1.62; g.add(rim);
    const coal = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), coalMat); coal.rotation.x = -Math.PI / 2; coal.position.y = 1.56; g.add(coal);
    g.userData.procedural = [ft, st, bw, rim, coal];
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const flames = [];
    for (let k = 0; k < 3; k++) {
      const fm = makeFlameMaterial(i * 3.7 + k * 1.3);
      fm.uniforms.uSize.value.set(0.95 - k * 0.15, 1.7 - k * 0.3);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fm);
      f.position.set((k - 1) * 0.16, 1.55, (k % 2) * 0.1 - 0.05); f.frustumCulled = false; f.renderOrder = 5;
      g.add(f); flames.push(fm); f.userData.flame = true;
    }
    const light = new THREE.PointLight(0xff8a3a, 30, 22, 1.8);
    light.position.set(0, 2.3, 0); g.add(light);
    WORLD.braziers.push({ g, light, flames, x, z, seed: i * 1.37, coalMat });
    addCollCircle(x, z, 0.6, false);
  });
  WORLD.updaters.push((dt, t) => {
    WORLD.dimK = damp(WORLD.dimK, WORLD.dim, WORLD.dim < WORLD.dimK ? 3.5 : 2.2, dt);
    const T = WORLD.tint; T.k = damp(T.k, T.target, T.target > T.k ? 2.2 : 1.6, dt);
    if (WORLD.skyMat) WORLD.skyMat.uniforms.uTintK.value = T.k;
    if (WORLD.hemi) { WORLD.hemi.color.copy(WORLD.hemiBase).lerp(T.color, T.k * 0.6); WORLD.moon.color.copy(WORLD.moonBase).lerp(T.color, T.k * 0.5); S0.fog.color.copy(WORLD.fogBase).lerp(WORLD.tmpCol.copy(T.color).multiplyScalar(0.18), T.k * 0.7); }
    for (const [l, i] of WORLD.dimLights) l.intensity = i * WORLD.dimK;
    S0.environmentIntensity = 0.62 * (0.3 + 0.7 * WORLD.dimK);
    for (const b of WORLD.braziers) {
      const fl = 0.78 + 0.12 * Math.sin(t * 11 + b.seed) + 0.08 * Math.sin(t * 23.7 + b.seed * 3) + 0.05 * Math.sin(t * 4.1 + b.seed);
      b.light.intensity = 30 * fl * (0.25 + 0.75 * WORLD.dimK);
      for (const f of b.flames) f.uniforms.uTime.value = t;
    }
  });

  // ---- reflecting pools with lotus
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x07182c, roughness: 0.04, metalness: 0, normalMap: waterN, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  waterN.repeat.set(4, 12);
  WORLD.updaters.push((dt, t) => { waterN.offset.set(t * 0.012, t * 0.02); });
  const lotusPad = new THREE.MeshStandardMaterial({ color: 0x2d6b34, roughness: 0.6, side: THREE.DoubleSide });
  const lotusFlower = new THREE.MeshStandardMaterial({ color: 0xf0c8de, roughness: 0.5, emissive: 0x3a1020, emissiveIntensity: 0.3, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const cx = sx * 10.9, cz = -1.2, w = 5.4, d = 26;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(cx, -0.12, cz); water.receiveShadow = true; scene.add(water);
    const basin = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), new THREE.MeshStandardMaterial({ color: 0x1d2a35, roughness: 0.9, side: THREE.BackSide })); basin.position.set(cx, -0.42, cz); scene.add(basin);
    for (const [rw, rd, ox, oz] of [[w + 0.9, 0.45, 0, d / 2 + 0.225], [w + 0.9, 0.45, 0, -d / 2 - 0.225], [0.45, d, w / 2 + 0.225, 0], [0.45, d, -w / 2 - 0.225, 0]]) {
      const rim = new THREE.Mesh(boxWorldUV(new THREE.BoxGeometry(rw, 0.3, rd), 3), stoneDark); rim.position.set(cx + ox, 0.15, cz + oz); rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
    }
    addCollBox(cx - w / 2 - 0.45, cx + w / 2 + 0.45, cz - d / 2 - 0.45, cz + d / 2 + 0.45, false);
    const r = mulberry32(sx > 0 ? 12 : 34);
    const pads = [], petals = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 26; i++) {
      const pr = 0.25 + r() * 0.35;
      const pad = new THREE.CircleGeometry(pr, 20, 0.3, TAU - 0.3);
      pad.rotateX(-Math.PI / 2); pad.rotateY(r() * TAU);
      const px = cx + (r() - 0.5) * (w - 1), pz = cz + (r() - 0.5) * (d - 1);
      pad.translate(px, -0.1, pz); pads.push(pad);
      if (r() < 0.3) {
        for (let k = 0; k < 7; k++) {
          const pt = new THREE.SphereGeometry(1, 8, 6, 0, TAU, 0, Math.PI / 2);
          pt.scale(0.05, 0.16, 0.025);
          e.set(0.5, (k / 7) * TAU, 0, 'YXZ'); q.setFromEuler(e);
          m4.compose(new THREE.Vector3(px, -0.08, pz), q, one);
          pt.applyMatrix4(m4); petals.push(pt);
        }
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(pads), lotusPad));
    if (petals.length) scene.add(new THREE.Mesh(mergeGeometries(petals), lotusFlower));
  }

  // ---- desert outside: dunes + pyramids
  const duneGeo = new THREE.RingGeometry(34, 520, 96, 24);
  const dp = duneGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i), y = dp.getY(i), r = Math.hypot(x, y);
    const h = (Noise.fbm(x / 60, y / 60, 4) * 0.5 + 0.5) * 26 * smoothstep(36, 120, r) + Math.sin(x / 23 + y / 41) * 2.5 * smoothstep(40, 90, r);
    dp.setZ(i, h);
  }
  duneGeo.computeVertexNormals();
  sandT.repeat.set(60, 60);
  const dunes = new THREE.Mesh(duneGeo, new THREE.MeshStandardMaterial({ map: sandT, color: 0x8a7a8a, roughness: 0.95 }));
  dunes.rotation.x = -Math.PI / 2; dunes.position.y = -0.2; dunes.receiveShadow = false; scene.add(dunes);
  const pyrMat = new THREE.MeshStandardMaterial({ color: 0x6f6273, roughness: 0.9, map: sandT });
  for (const [x, z, s] of [[120, 300, 120], [-150, 340, 150], [-30, 420, 95], [330, 120, 80]]) {
    const pg = new THREE.ConeGeometry(s * 0.75, s * 0.62, 4); pg.rotateY(Math.PI / 4);
    const pm = new THREE.Mesh(pg, pyrMat); pm.position.set(x, s * 0.31 - 2, z); scene.add(pm);
  }

  // ---- ambient motes (realism pass: 700 -> 420, less glitter in the air)
  const moteN = 420;
  const mg = new THREE.BufferGeometry();
  const mp = new Float32Array(moteN * 3), ms = new Float32Array(moteN);
  for (let i = 0; i < moteN; i++) { mp[i * 3] = rand(WORLD.minX, WORLD.maxX); mp[i * 3 + 1] = rand(0.2, 9); mp[i * 3 + 2] = rand(WORLD.minZ, WORLD.maxZ); ms[i] = rand(0, 100); }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('seed', new THREE.BufferAttribute(ms, 1));
  const moteMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.2 + seed) * 0.8; p.y += sin(uTime * 0.13 + seed * 1.7) * 0.6; p.z += cos(uTime * 0.17 + seed * 0.7) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (0.03 + 0.02 * fract(seed * 7.13)) / -mv.z;
        vA = 0.35 + 0.35 * sin(uTime * 1.3 + seed * 3.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * a * vA * 1.4, a * vA); }`,
  });
  const motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false; scene.add(motes);
  WORLD.updaters.push((dt, t) => { moteMat.uniforms.uTime.value = t; moteMat.uniforms.uScale.value = innerHeight * 0.55; });
  WORLD.updaters.push((dt, t) => {
    for (const g of WORLD.glowMats) g.mat.emissiveIntensity = g.base + g.amp * Math.sin(t * g.speed);
  });
  return WORLD;
}

// ---------------------------------------------------------------------------
// AI-generated 3D props (Tripo H3.1 from concept art), placed around the temple
// ---------------------------------------------------------------------------
function propInstance(name, height, x, z, rotY = 0, opts = {}) {
  const scene = opts.parent || WORLD.group || rootScene;
  const src = Assets.glb[name];
  if (!src) return null;
  const m = src.scene.clone(true);
  const box = new THREE.Box3().setFromObject(m);
  const s = height / Math.max(1e-3, box.max.y - box.min.y);
  m.scale.setScalar(s);
  const g = new THREE.Group(); g.add(m);
  g.position.set(x, opts.y || 0, z); g.rotation.y = rotY;
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = opts.shadow !== false; o.receiveShadow = true;
    o.material.envMapIntensity = opts.env ?? 1.0;
    if (opts.tint) o.material.color.multiply(new THREE.Color(opts.tint));
  });
  scene.add(g);
  return g;
}

function placeProps() {
  const P = Assets.glb, scene = WORLD.group;
  // colossal seated Thoth behind the spawn, lit from below by two fires and a cold moon spot
  if (P.thoth_statue) {
    propInstance('thoth_statue', 9.2, 0, -25.3, 0, { env: 0.9 });
    addCollBox(-1.6, 1.6, -27.4, -23.0);
    for (const sx of [-1, 1]) { // cold uplights at the colossus' feet (aimed away from the spawn)
      const spot = new THREE.SpotLight(0x7fa6ff, 90, 16, 0.55, 0.7, 1.4); WORLD.dimLights.push([spot, 90]);
      spot.position.set(sx * 2.6, 0.25, -22.2); spot.target.position.set(sx * 0.4, 6.5, -25.6);
      scene.add(spot, spot.target);
    }
  }
  // sphinx avenue guardians replace the ibis statues
  if (P.sphinx) {
    for (const g of WORLD.ibis) {
      scene.remove(g);
      const c = g.userData.coll; if (c) WORLD.circles.splice(WORLD.circles.indexOf(c), 1);
    }
    for (const sx of [-1, 1]) {
      propInstance('sphinx', 4.4, sx * 12.4, 22.6, sx < 0 ? Math.PI / 2 : -Math.PI / 2, { env: 0.8 });
      addCollBox(sx * 12.4 - 3.3, sx * 12.4 + 3.3, 21.1, 24.1);
    }
  }
  // the Scales of Ma'at before the glowing gate
  if (P.scales) {
    propInstance('scales', 4.2, 0, 30.4, 0, { env: 1.3 });
    addCollCircle(0, 30.4, 1.3, false);
  }
  // Anubis shrines + canopic chests + upright sarcophagi along the covered colonnades
  for (const sx of [-1, 1]) {
    const x = sx * 20.0, face = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    if (P.anubis_shrine) for (const z of [-6.5, 13.5]) { propInstance('anubis_shrine', 3.0, x, z, 0, { env: 1.1 }); addCollBox(x - 0.75, x + 0.75, z - 1.7, z + 1.7); }
    if (P.sarcophagus) for (const z of [-20.2, 3.5, 23.5]) { propInstance('sarcophagus', 2.7, sx * 21.15, z, face, { env: 1.25 }); addCollCircle(sx * 21.15, z, 0.55); }
    if (P.canopic) { propInstance('canopic', 1.15, sx * 20.2, -10.6, face, { env: 1.0 }); addCollCircle(sx * 20.2, -10.6, 0.8, false); }
    if (P.amphorae) for (const [z, r] of [[-24.6, 0.4], [28.6, -0.6], [9.2, 1.2]]) { propInstance('amphorae', 1.25, sx * 19.9, z, face + r, { env: 0.9 }); addCollCircle(sx * 19.9, z, 1.0, false); }
    if (P.palm) for (const z of [-16.6, 14.0]) { propInstance('palm', 5.6, sx * 14.4, z, rand(0, TAU), { env: 0.8 }); addCollCircle(sx * 14.4, z, 0.55); }
  }
  // bronze tripod braziers replace the procedural bowls; two more flank the colossus
  if (P.brazier) {
    const coalMat = WORLD.braziers[0]?.coalMat;
    const upgrade = (b) => {
      for (const o of b.g.userData.procedural || []) o.visible = false;
      const m = propInstance('brazier', 1.78, 0, 0, b.seed * 2, { env: 1.2 });
      scene.remove(m); b.g.add(m); m.position.set(0, 0, 0);
      b.g.children.forEach((c) => { if (c.userData.flame) c.position.y = 1.72; });
      if (coalMat) { const coal = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), coalMat); coal.rotation.x = -Math.PI / 2; coal.position.y = 1.66; b.g.add(coal); }
      b.light.position.y = 2.5;
    };
    for (const b of WORLD.braziers) upgrade(b);
    if (P.thoth_statue) for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 3.4, 0, -22.4); scene.add(g);
      const flames = [];
      for (let k = 0; k < 3; k++) {
        const fm = makeFlameMaterial(sx * 5.1 + k * 1.3); fm.uniforms.uSize.value.set(0.95 - k * 0.15, 1.7 - k * 0.3);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fm); f.position.set((k - 1) * 0.14, 1.72, (k % 2) * 0.1 - 0.05); f.frustumCulled = false; f.renderOrder = 5; f.userData.flame = true;
        g.add(f); flames.push(fm);
      }
      const light = new THREE.PointLight(0xff8a3a, 30, 22, 1.8); light.position.set(0, 2.5, 0); g.add(light);
      const b = { g, light, flames, x: g.position.x, z: g.position.z, seed: 7 + sx, coalMat };
      WORLD.braziers.push(b); upgrade(b); addCollCircle(g.position.x, g.position.z, 0.6, false);
    }
  }
}

function updateWorld(dt, t, focus) {
  for (const u of WORLD.updaters) u(dt, t);
  // shadow camera follows the focus point, centred a little ahead of the god (realism pass: the map's texels go
  // where the camera looks, not behind it)
  const m = WORLD.moon, c = _v4.copy(focus);
  if (Game.mode === 'play' || Game.mode === 'paused') c.addScaledVector(fwdOf(Cam.yaw, _v3), 5).setY(0);
  // snap the centre to whole shadow texels in light space, so the shadow edges do not crawl as the camera turns
  const L = WORLD.lightDir, sc = m.shadow.camera, tx = (sc.right - sc.left) / m.shadow.mapSize.x;
  const ax = _v3.set(L.z, 0, -L.x).normalize(), ay = _v2.crossVectors(L, ax);
  const a = Math.round(c.dot(ax) / tx) * tx, b = Math.round(c.dot(ay) / tx) * tx, d = c.dot(L);
  c.copy(ax).multiplyScalar(a).addScaledVector(ay, b).addScaledVector(L, d);
  m.position.copy(c).addScaledVector(WORLD.lightDir, 60);
  m.target.position.copy(c);
  m.target.updateMatrixWorld();
}

// ---------------------------------------------------------------------------
// Collision helpers (XZ plane)
// ---------------------------------------------------------------------------
function resolveCircle(pos, radius) {
  pos.x = clamp(pos.x, WORLD.minX + radius, WORLD.maxX - radius);
  pos.z = clamp(pos.z, WORLD.minZ + radius, WORLD.maxZ - radius);
  if (WORLD.oval) {   // Arena 5v5: an elliptic floor (semi-axes a, b)
    const a = WORLD.oval.a - radius, b = WORLD.oval.b - radius, q = (pos.x * pos.x) / (a * a) + (pos.z * pos.z) / (b * b);
    if (q > 1) { const k = 1 / Math.sqrt(q); pos.x *= k; pos.z *= k; }
  }
  for (const c of WORLD.circles) {
    const dx = pos.x - c.x, dz = pos.z - c.z, rr = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; }
  }
  for (const b of WORLD.boxes) {
    const minX = b.minX - radius, maxX = b.maxX + radius, minZ = b.minZ - radius, maxZ = b.maxZ + radius;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const pl = pos.x - minX, pr = maxX - pos.x, pd = pos.z - minZ, pu = maxZ - pos.z;
      const m = Math.min(pl, pr, pd, pu);
      if (m === pl) pos.x = minX; else if (m === pr) pos.x = maxX; else if (m === pd) pos.z = minZ; else pos.z = maxZ;
    }
  }
  return pos;
}
// first blocking hit along a segment (XZ) for projectiles; returns t in [0,1] or 1
function segmentBlocked(ax, az, bx, bz) {
  let tMin = 1;
  const dx = bx - ax, dz = bz - az;
  for (const c of WORLD.circles) {
    if (!c.shots) continue;
    const fx = ax - c.x, fz = az - c.z;
    const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - c.r * c.r;
    const disc = B * B - 4 * A * C;
    if (disc < 0 || A < 1e-9) continue;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    if (t >= 0 && t < tMin) tMin = t;
  }
  for (const b of WORLD.boxes) {
    if (!b.shots) continue;
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[ax, dx, b.minX, b.maxX], [az, dz, b.minZ, b.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
      let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 >= 0 && t0 < tMin) tMin = t0;
  }
  // arena bounds
  const bound = (p, d, lo, hi) => { if (d > 0 && p + d > hi) return (hi - p) / d; if (d < 0 && p + d < lo) return (lo - p) / d; return 1; };
  tMin = Math.min(tMin, bound(ax, dx, WORLD.minX, WORLD.maxX), bound(az, dz, WORLD.minZ, WORLD.maxZ));
  if (WORLD.oval) {   // where the segment leaves the elliptic floor
    const ia = 1 / (WORLD.oval.a * WORLD.oval.a), ib = 1 / (WORLD.oval.b * WORLD.oval.b);
    const A = dx * dx * ia + dz * dz * ib, B = 2 * (ax * dx * ia + az * dz * ib), C = ax * ax * ia + az * az * ib - 1;
    if (A > 1e-12) { const disc = B * B - 4 * A * C; if (disc >= 0) { const t = (-B + Math.sqrt(disc)) / (2 * A); if (t < tMin) tMin = Math.max(0, t); } }
  }
  return tMin;
}


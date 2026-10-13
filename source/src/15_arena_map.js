// ============================================================================
// ARENA 5v5 (1/3) · the map: the Arena of Ma'at, an oval colosseum under the stars.
// 140 x 72 m of packed sand inside a carved hieroglyph wall with gold inlay; tiered sandstone stands
// with a cheering crowd, seated colossi and team banners (lapis vs crimson); a Sun Gate (portal) with a
// healing fountain at each end; a paved central lane with papyrus reed beds (stealth); two jungle
// corridors behind colonnades with three buff camps each; the Nile glittering beyond the walls.
// Everything here is built once into one group (hidden in the playroom) from merged / instanced
// geometry, emissive glows and two gate lights. Gameplay data (camps, reeds, gates) lives in AM.
// ============================================================================
const AM = {
  A: 70, B: 36,             // floor: oval semi-axes (x, z)
  gateX: 57,                // the base entrances (pylon gates) stand at x = +-gateX; the opening is |z| < gateOpen
  gateOpen: 3.8,
  fountX: 63.5, fountR: 9,  // fountain pool (heals allies, burns enemy gods inside fountR)
  portalX: 68.4,            // the Sun Gate portal at the very end of each base (the ticket sink)
  portalR: 3.4,             // an enemy minion this close to it passes through (-1 ticket)
  sunPortal: { height: 15, ringY: 0.62, ringR: 0.21, x: 74 },   // the sun_portal model: size, ring centre and radius (x height), where it stands
  laneHalf: 11,             // the paved lane: |z| < laneHalf
  sepZ: 14.5,               // colonnades between the lane and the jungle corridors
  scalesR: 9,               // the Scales of Ma'at's judgement circle
  revealR: 4.6,             // an enemy this close sees into a reed bed
};
// team 0 = the player's (lapis, west, pushes toward +x), team 1 = crimson (east), 2 = neutral camps
const TEAMS = [
  { id: 0, name: 'Lapis', css: '#4aa8ff', css2: '#f2c25e', col: new THREE.Color(0.06, 0.32, 1.0), hot: new THREE.Color(0.35, 0.7, 1.0), side: -1 },
  { id: 1, name: 'Crimson', css: '#ff4b3e', css2: '#ffb08a', col: new THREE.Color(1.0, 0.08, 0.05), hot: new THREE.Color(1.0, 0.45, 0.2), side: 1 },
  { id: 2, name: 'Neutral', css: '#ffcf6a', css2: '#ffcf6a', col: new THREE.Color(1.0, 0.7, 0.2), hot: new THREE.Color(1.0, 0.85, 0.5), side: 0 },
];
// the jungle buffs (our own): a coloured aura for 90 s
const BUFFS = {
  sekhmet: { name: 'Sekhmet’s Wrath', short: '+20% damage', css: '#ff4a3a', col: new THREE.Color(1.0, 0.12, 0.06), pal: 'molten' },
  isis: { name: 'Isis’ Wisdom', short: 'faster cooldowns and mana', css: '#4a9bff', col: new THREE.Color(0.1, 0.45, 1.0), pal: 'hpower' },
  horus: { name: 'Horus’ Wings', short: '+15% speed and attack speed', css: '#b46bff', col: new THREE.Color(0.6, 0.15, 1.0), pal: 'hecate' },
};
// the arena's own 3D models (assets/web, loaded when a match starts; each falls back to procedural geometry)
const ARENA_ASSETS = [['sebek', 6.32], ['sebek_khopesh', 0.69], ['sun_portal', 4.11], ['maat_scales', 4.1], ['pharaoh_colossus', 3.71], ['arena_obelisk', 3.42]];
for (const [n, mb] of ARENA_ASSETS) GOD_MB[n] = mb;
const ovalZ = (x, a = AM.A, b = AM.B) => b * Math.sqrt(Math.max(0, 1 - (x * x) / (a * a)));
const insideOval = (x, z, m = 0) => (x * x) / ((AM.A - m) * (AM.A - m)) + (z * z) / ((AM.B - m) * (AM.B - m)) <= 1;

const ArenaMap = {
  built: false, group: null, circles: [], boxes: [], updaters: [], reeds: [], camps: [], gates: [], fountains: [],
  scarabSpots: [], crowd: null, cheer: 0, cheerT: 0, mats: {}, fog: { color: new THREE.Color(0x0f0d24), density: 0.0026 },
  add(o) { this.group.add(o); return o; },
  coll(x, z, r, shots = true) { this.circles.push({ x, z, r, shots }); },
  collBox(minX, maxX, minZ, maxZ, shots = true) { this.boxes.push({ minX, maxX, minZ, maxZ, shots }); },
  inReeds(p) { for (const r of this.reeds) { const dx = (p.x - r.x) / r.rx, dz = (p.z - r.z) / r.rz; if (dx * dx + dz * dz <= 1) return r; } return null; },
  update(dt, t) {
    this.cheer = damp(this.cheer, this.cheerT > 0 ? 1 : 0.12, 3, dt); this.cheerT = Math.max(0, this.cheerT - dt);
    for (const u of this.updaters) u(dt, t);
  },
  roar(sec = 3) { this.cheerT = Math.max(this.cheerT, sec); },

  async build(progress = () => {}) {
    if (this.built) return;
    const G = this.group = new THREE.Group(); G.name = 'arena-of-maat'; G.visible = false; scene.add(G);
    const T = WORLD.tex;
    const tx = (tex, rx = 1, ry = 1) => { const c = tex.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
    const mats = this.mats;
    mats.stone = new THREE.MeshStandardMaterial({ map: tx(T.wallT.map), bumpMap: tx(T.wallT.bump), bumpScale: 2.0, roughness: 0.86, color: 0xdcc6a2, side: THREE.DoubleSide });
    mats.stoneDark = new THREE.MeshStandardMaterial({ map: tx(T.wallT.map), bumpMap: tx(T.wallT.bump), bumpScale: 2.0, roughness: 0.9, color: 0x95806a, side: THREE.DoubleSide });
    mats.relief = new THREE.MeshStandardMaterial({ map: tx(T.relief.map), bumpMap: tx(T.relief.bump), bumpScale: 3, roughness: 0.82, color: 0xe6d3b4,
      emissiveMap: tx(T.relief.glow), emissive: 0xffa53a, emissiveIntensity: 0.55, side: THREE.DoubleSide });   // the glyphs' gold inlay catches the torchlight
    mats.gold = new THREE.MeshStandardMaterial({ color: 0xf2c25e, metalness: 1, roughness: 0.2, emissive: 0x5a3608, emissiveIntensity: 0.6 });
    mats.teamRelief = TEAMS.slice(0, 2).map((tm) => new THREE.MeshStandardMaterial({ map: tx(T.relief.map), bumpMap: tx(T.relief.bump), bumpScale: 3, roughness: 0.8, color: 0xd8c4a4,
      emissiveMap: tx(T.relief.glow), emissive: tm.col.clone(), emissiveIntensity: 1.4, side: THREE.DoubleSide }));
    const glowPulse = [];
    this.updaters.push((dt, t) => { for (const g of glowPulse) g.mat.emissiveIntensity = g.base + g.amp * Math.sin(t * g.speed + (g.ph || 0)); });
    glowPulse.push({ mat: mats.relief, base: 0.5, amp: 0.12, speed: 0.7 }, ...mats.teamRelief.map((m, i) => ({ mat: m, base: 1.3, amp: 0.4, speed: 1.1, ph: i * 1.7 })));

    // ---- the floor: packed sand, the paved lane with gold-inlaid borders, the judgement medallion, the base plazas
    {
      const sand = new THREE.MeshStandardMaterial({ map: tx(T.sandT, (2 * AM.A) / 6, (2 * AM.B) / 6), color: 0xc9a77a, roughness: 0.96 });
      const fg = new THREE.CircleGeometry(1, 160); fg.scale(AM.A + 0.3, AM.B + 0.3, 1); fg.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(fg, sand); floor.receiveShadow = true; G.add(floor);
      const L = 2 * AM.gateX + 6, W = 2 * AM.laneHalf;
      const lane = new THREE.MeshStandardMaterial({ map: tx(T.floorT.map, L / 8, W / 8), bumpMap: tx(T.floorT.bump, L / 8, W / 8), bumpScale: 1.4, roughnessMap: tx(T.floorT.rough, L / 8, W / 8), roughness: 1, color: 0xe2d2bb });
      const lm = new THREE.Mesh(new THREE.PlaneGeometry(L, W), lane); lm.rotation.x = -Math.PI / 2; lm.position.y = 0.008; lm.receiveShadow = true; G.add(lm);
      // the lane's borders: a glowing glyph band between two gold strips
      const band = new THREE.MeshStandardMaterial({ map: tx(T.relief.map, 1, L / 3), emissiveMap: tx(T.relief.glow, 1, L / 3), emissive: 0xffa23a, emissiveIntensity: 1.1, roughness: 0.5, color: 0x8f6a3a });
      glowPulse.push({ mat: band, base: 0.95, amp: 0.35, speed: 0.9 });
      for (const sz of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(0.55, L), band); b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2; b.position.set(0, 0.012, sz * (AM.laneHalf - 0.45)); b.receiveShadow = true; G.add(b);
        for (const off of [0.06, 0.84]) { const g = new THREE.Mesh(new THREE.BoxGeometry(L, 0.03, 0.08), mats.gold); g.position.set(0, 0.014, sz * (AM.laneHalf - off)); G.add(g); }
      }
      // the judgement medallion in the middle (the Scales of Ma'at rise here)
      const med = new THREE.MeshStandardMaterial({ map: T.rune, emissiveMap: T.rune, emissive: 0xffb04a, emissiveIntensity: 0.9, transparent: true, depthWrite: false, color: 0xd9b25a, roughness: 0.35, metalness: 0.6 });
      glowPulse.push({ mat: med, base: 0.8, amp: 0.35, speed: 0.6 });
      const mm = new THREE.Mesh(new THREE.CircleGeometry(AM.scalesR, 96), med); mm.rotation.x = -Math.PI / 2; mm.position.y = 0.02; mm.receiveShadow = true; G.add(mm);
      this.updaters.push((dt) => { mm.rotation.z += dt * 0.03; });
      for (const r of [AM.scalesR + 0.15, AM.scalesR - 1.6]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 160), mats.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; G.add(ring); }
      // the two base plazas: stone discs ringed in the team's colour
      for (const tm of TEAMS.slice(0, 2)) {
        const cx = tm.side * AM.fountX;
        const pl = new THREE.MeshStandardMaterial({ map: tx(T.floorT.map, 3, 3), bumpMap: tx(T.floorT.bump, 3, 3), bumpScale: 1.4, roughness: 0.7, color: 0xcdbca3 });
        const d = new THREE.Mesh(new THREE.CircleGeometry(12, 64), pl); d.rotation.x = -Math.PI / 2; d.position.set(cx, 0.01, 0); d.receiveShadow = true; G.add(d);
        const ring = new THREE.Mesh(new THREE.RingGeometry(AM.fountR - 0.25, AM.fountR, 96), new THREE.MeshBasicMaterial({ color: tm.col.clone().multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.03, 0); G.add(ring);
      }
    }
    progress(0.15); await nextFrame();

    // ---- the carved wall, the stands, the crowd and the crown of columns
    {
      const N = 220;
      // a strip between two ellipses: (a0, b0) at y0 and (a1, b1) at y1; u runs along the arc (metres / uScale)
      const ovalStrip = (a0, b0, y0, a1, b1, y1, uScale, vMax) => {
        const pos = [], uv = [], idx = [];
        let arc = 0, px = a0, pz = 0;
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * TAU, c = Math.cos(th), s = Math.sin(th);
          const x0 = a0 * c, z0 = b0 * s;
          if (i > 0) arc += Math.hypot(x0 - px, z0 - pz); px = x0; pz = z0;
          pos.push(x0, y0, z0, a1 * c, y1, b1 * s);
          uv.push(arc / uScale, 0, arc / uScale, vMax);
          if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
        g.computeVertexNormals();
        return g;
      };
      const H = 4.6;
      const wall = new THREE.Mesh(ovalStrip(AM.A + 0.25, AM.B + 0.25, 0, AM.A + 0.25, AM.B + 0.25, H, H * 4, 1), mats.relief); wall.receiveShadow = true; wall.castShadow = true; G.add(wall);
      const inlay = new THREE.Mesh(ovalStrip(AM.A + 0.2, AM.B + 0.2, H - 0.42, AM.A + 0.2, AM.B + 0.2, H - 0.2, 6, 1), mats.gold); G.add(inlay);
      const skirt = new THREE.Mesh(ovalStrip(AM.A + 0.18, AM.B + 0.18, 0, AM.A + 0.18, AM.B + 0.18, 0.32, 6, 0.05), mats.stoneDark); G.add(skirt);
      // the stands: six tiers of risers and seats, merged into one mesh
      const tiers = [], o0 = 0.25, step = 2.3, rise = 1.45, n = 6;
      tiers.push(ovalStrip(AM.A + o0, AM.B + o0, H, AM.A + o0 + 1.8, AM.B + o0 + 1.8, H, 6, 0.3));
      for (let i = 0; i < n; i++) {
        const a = AM.A + o0 + 1.8 + i * step, b = AM.B + o0 + 1.8 + i * step, y = H + i * rise;
        tiers.push(ovalStrip(a, b, y, a, b, y + rise, 6, rise / 6));
        tiers.push(ovalStrip(a, b, y + rise, a + step, b + step, y + rise, 6, step / 6));
      }
      const aTop = AM.A + o0 + 1.8 + n * step, bTop = AM.B + o0 + 1.8 + n * step, yTop = H + n * rise;
      tiers.push(ovalStrip(aTop, bTop, yTop, aTop, bTop, yTop + 3.2, 6, 3.2 / 6));
      tiers.push(ovalStrip(aTop, bTop, -0.5, aTop, bTop, yTop, 6, (yTop + 0.5) / 6));   // the outer face
      const stands = new THREE.Mesh(mergeGeometries(tiers), mats.stone); stands.receiveShadow = true; G.add(stands);
      this.standsTop = { a: aTop, b: bTop, y: yTop };
      // the crowd: simple figures in their team's colours (and linen and gold), bouncing when a god falls
      {
        const body = new THREE.CylinderGeometry(0.2, 0.3, 0.95, 6, 1); body.translate(0, 0.48, 0);
        const head = new THREE.SphereGeometry(0.17, 6, 4); head.translate(0, 1.12, 0);
        const fig = mergeGeometries([body.toNonIndexed(), head.toNonIndexed()]);
        const spots = [], rnd = mulberry32(2026);
        for (let i = 0; i < n; i++) {
          const a = AM.A + o0 + 1.8 + i * step + step * 0.45, b = AM.B + o0 + 1.8 + i * step + step * 0.45, y = H + (i + 1) * rise;
          const circ = TAU * Math.sqrt((a * a + b * b) / 2), cnt = Math.floor(circ / 1.05);
          for (let k = 0; k < cnt; k++) {
            if (rnd() < 0.38) continue;
            const th = (k + rnd() * 0.5) / cnt * TAU, x = Math.cos(th) * a, z = Math.sin(th) * b;
            if (Math.abs(x) > AM.A * 0.86 && Math.abs(z) < 16) continue;   // (the gate ends stay clear for the obelisks)
            spots.push([x, y, z, Math.atan2(-x, -z) + rand(-0.4, 0.4), rnd()]);
          }
        }
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
        const U = { uTime: { value: 0 }, uCheer: { value: 0 } };
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = U.uTime; sh.uniforms.uCheer = U.uCheer;
          sh.vertexShader = 'uniform float uTime; uniform float uCheer;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            float ph = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 1.37;
            transformed.y += uCheer * abs(sin(uTime * 8.5 + ph)) * 0.42 + sin(uTime * 1.3 + ph) * 0.03;
            transformed.x += sin(uTime * 2.1 + ph) * 0.04 * position.y;`);
        };
        mat.customProgramCacheKey = () => 'arena-crowd';
        const im = new THREE.InstancedMesh(fig, mat, spots.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), c = new THREE.Color();
        const linen = new THREE.Color(0.78, 0.7, 0.55), goldC = new THREE.Color(0.85, 0.62, 0.2);
        spots.forEach(([x, y, z, yaw, r], i) => {
          e.set(0, yaw, 0); q.setFromEuler(e); sc.setScalar(0.9 + r * 0.25);
          m4.compose(new THREE.Vector3(x, y, z), q, sc); im.setMatrixAt(i, m4);
          const tm = x < -4 ? TEAMS[0] : x > 4 ? TEAMS[1] : TEAMS[2];
          c.copy(r < 0.55 ? tm.col : r < 0.85 ? linen : goldC).multiplyScalar(r < 0.55 ? 0.55 : 0.75); im.setColorAt(i, c);
        });
        im.castShadow = false; im.receiveShadow = false; G.add(im);
        this.crowd = U;
        this.updaters.push((dt, t) => { U.uTime.value = t; U.uCheer.value = this.cheer; });
      }
      // a crown of columns along the top of the stands
      const colLoft = new Loft([{ y: 0, rx: 0.55 }, { y: 0.3, rx: 0.5 }, { y: 1.4, rx: 0.53 }, { y: 4.0, rx: 0.48 }, { y: 5.6, rx: 0.42 }, { y: 5.8, rx: 0.4 }],
        { radial: 24, sub: 2, n: 2, shape: (th) => 1 + 0.045 * Math.pow(Math.abs(Math.cos(th * 4)), 0.6) });
      const capLoft = new Loft([{ y: 5.75, rx: 0.42 }, { y: 6.1, rx: 0.52 }, { y: 6.5, rx: 0.86 }, { y: 6.7, rx: 0.98 }, { y: 6.8, rx: 0.95 }], { radial: 24, sub: 2, n: 2 });
      this.colGeo = { shaft: colLoft.geometry(), cap: capLoft.geometry({ capEnd: true }) };
      this.colMat = new THREE.MeshStandardMaterial({ map: T.colT, roughness: 0.82, color: 0xf0e2c8 });
      this.capMat = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.75, map: T.colT });
      const crown = [];
      const cn = 64;
      for (let i = 0; i < cn; i++) { const th = (i / cn) * TAU; crown.push([Math.cos(th) * (aTop - 1), yTop, Math.sin(th) * (bTop - 1)]); }
      this.columns(crown, 1.15, false);
      const arch = new THREE.Mesh(ovalStrip(aTop - 1.6, bTop - 1.6, yTop + 7.4, aTop - 0.4, bTop - 0.4, yTop + 7.4, 6, 0.2), mats.stoneDark); G.add(arch);
      const archF = new THREE.Mesh(ovalStrip(aTop - 1.6, bTop - 1.6, yTop + 6.8, aTop - 1.6, bTop - 1.6, yTop + 7.4, 8, 0.15), mats.relief); G.add(archF);
    }
    progress(0.3); await nextFrame();

    // ---- the Sun Gates (team portals), their fountains and their towering obelisks
    for (const tm of TEAMS.slice(0, 2)) this.buildGate(tm);
    progress(0.45); await nextFrame();

    // ---- colonnades between the lane and the jungle corridors, obelisks and sphinxes
    {
      const cols = [];
      for (const sz of [-1, 1]) for (const cx of [-46, -22, 22, 46]) {
        for (const dx of [-4, 0, 4]) { cols.push([cx + dx, 0, sz * AM.sepZ]); this.coll(cx + dx, sz * AM.sepZ, 0.75); }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 1.5), mats.stoneDark); beam.position.set(cx, 7.2, sz * AM.sepZ); beam.castShadow = true; beam.receiveShadow = true; G.add(beam);
        const fr = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.7), mats.relief); fr.position.set(cx, 7.2, sz * (AM.sepZ - 0.77)); fr.rotation.y = sz > 0 ? Math.PI : 0; G.add(fr);
      }
      this.columns(cols, 1, true);
      for (const [x, z] of [[-34, AM.sepZ], [34, AM.sepZ], [-34, -AM.sepZ], [34, -AM.sepZ]]) this.obelisk(x, z, 13, x < 0 ? TEAMS[0] : TEAMS[1]);
      if (Assets.glb.sphinx) for (const [x, z] of [[-51, AM.sepZ - 0.5], [51, AM.sepZ - 0.5], [-51, -AM.sepZ + 0.5], [51, -AM.sepZ + 0.5]]) {
        propInstance('sphinx', 3.6, x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, { env: 0.8, parent: G });
        this.collBox(x - 2.7, x + 2.7, z - 1.2, z + 1.2);
      }
    }
    progress(0.55); await nextFrame();

    // ---- the jungle: three buff camps per team, each a glowing rune platform before a shrine
    {
      const C = [['sekhmet', -45, 21], ['isis', -25, 27], ['horus', -6, 28.5]];
      for (const tm of TEAMS.slice(0, 2)) for (const [buff, x0, z0] of C) {
        const s = tm.side < 0 ? 1 : -1, x = x0 * s, z = z0 * s, B = BUFFS[buff];
        const camp = { team: tm.id, buff, x, z, pos: new THREE.Vector3(x, 0, z), mobs: [], respawnT: 0, alive: false };
        this.camps.push(camp);
        const mat = new THREE.MeshStandardMaterial({ map: T.rune, emissiveMap: T.rune, emissive: B.col.clone(), emissiveIntensity: 1.3, transparent: true, depthWrite: false, color: 0xb89a6a, roughness: 0.5, metalness: 0.4 });
        glowPulse.push({ mat, base: 1.1, amp: 0.45, speed: 1.4, ph: x });
        camp.decalMat = mat;
        const d = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), mat); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.025, z); G.add(d);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.06, 6, 96), mats.gold); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.03, z); G.add(ring);
        // the shrine behind it (toward the outer wall)
        const back = new THREE.Vector3(x, 0, z).normalize();
        const bx = x + back.x * 6.2, bz = z + back.z * 6.2, face = Math.atan2(-back.x, -back.z);
        if (Assets.glb.anubis_shrine) { propInstance('anubis_shrine', 3.2, bx, bz, face, { env: 1.1, parent: G }); this.coll(bx, bz, 1.4); }
        if (Assets.glb.amphorae) { const ax = x + back.x * 5 + back.z * 3.8, az = z + back.z * 5 - back.x * 3.8; propInstance('amphorae', 1.2, ax, az, rand(0, TAU), { env: 0.9, parent: G }); this.coll(ax, az, 0.9, false); }
        if (Assets.glb.canopic && buff === 'isis') { const ax = x + back.x * 5 - back.z * 3.8, az = z + back.z * 5 + back.x * 3.8; propInstance('canopic', 1.1, ax, az, face, { env: 1.0, parent: G }); this.coll(ax, az, 0.8, false); }
        this.brazier(x - back.z * 5.2, z + back.x * 5.2, 0.8); this.brazier(x + back.z * 5.2, z - back.x * 5.2, 0.8);
      }
      // the other halves of the corridors: sarcophagi, palms and amphorae, where scarabs like to roam
      for (const s of [1, -1]) {
        if (Assets.glb.sarcophagus) for (const [x, z] of [[32, 27], [48, 21]]) { propInstance('sarcophagus', 2.6, x * s, z * s, Math.atan2(-x * s, -z * s), { env: 1.2, parent: G }); this.coll(x * s, z * s, 0.6); }
        if (Assets.glb.palm) for (const [x, z] of [[14, 30], [40, 26], [-52, 20], [58, 14]]) { if (!insideOval(x * s, z * s, 2)) continue; propInstance('palm', 6.2, x * s, z * s, rand(0, TAU), { env: 0.8, parent: G }); this.coll(x * s, z * s, 0.5); }
        for (const [x, z] of [[22, 22], [36, 20], [10, 24], [-36, 20], [-14, 22]]) this.scarabSpots.push(new THREE.Vector3(x * s, 0, z * s));
      }
      for (const [x, z] of [[0, 4], [-20, 0], [20, 0], [-40, -6], [40, 6]]) this.scarabSpots.push(new THREE.Vector3(x, 0, z));
    }
    progress(0.65); await nextFrame();

    // ---- papyrus reed beds (stealth): instanced stalks that sway in the night wind
    {
      this.reeds = [{ x: -30, z: 7.6, rx: 6.5, rz: 3.0 }, { x: 30, z: -7.6, rx: 6.5, rz: 3.0 }, { x: -11, z: -7.8, rx: 5.2, rz: 2.8 }, { x: 11, z: 7.8, rx: 5.2, rz: 2.8 },
        { x: 20, z: 24.5, rx: 5.5, rz: 3.2 }, { x: -20, z: -24.5, rx: 5.5, rz: 3.2 }];
      const stalk = new THREE.CylinderGeometry(0.018, 0.03, 2.3, 4, 1); stalk.translate(0, 1.15, 0);
      const umbel = new THREE.ConeGeometry(0.2, 0.32, 6, 1, true); umbel.rotateX(Math.PI); umbel.translate(0, 2.42, 0);
      const geo = mergeGeometries([stalk.toNonIndexed(), umbel.toNonIndexed()]);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6f8a34, roughness: 0.8, side: THREE.DoubleSide });
      const U = { uTime: { value: 0 }, uWind: { value: 1 } };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
        sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61;
          float bend = position.y * position.y * 0.05 * uWind;
          transformed.x += (sin(uTime * 1.7 + ph) + 0.5 * sin(uTime * 3.1 + ph * 2.0)) * bend;
          transformed.z += cos(uTime * 1.3 + ph * 1.3) * bend * 0.6;`);
      };
      mat.customProgramCacheKey = () => 'arena-reeds';
      const pts = [], rnd = mulberry32(77);
      for (const r of this.reeds) {
        const n = Math.round(r.rx * r.rz * 9);
        for (let i = 0; i < n; i++) { const a = rnd() * TAU, k = Math.sqrt(rnd()); pts.push([r.x + Math.cos(a) * r.rx * k, r.z + Math.sin(a) * r.rz * k, 0.8 + rnd() * 0.45, rnd()]); }
        const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x3a3a1c, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false }));
        bed.scale.set(r.rx + 0.6, r.rz + 0.6, 1); bed.rotation.x = -Math.PI / 2; bed.position.set(r.x, 0.03, r.z); bed.receiveShadow = true; G.add(bed);
      }
      const im = new THREE.InstancedMesh(geo, mat, pts.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      pts.forEach(([x, z, s, r], i) => { e.set(rand(-0.12, 0.12), r * TAU, rand(-0.12, 0.12)); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, s, 1)); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(0.2 + r * 0.06, 0.5, 0.22 + r * 0.12)); });
      im.castShadow = true; im.receiveShadow = true; G.add(im);
      this.reedU = U;
      this.updaters.push((dt, t) => { U.uTime.value = t; });
    }

    // ---- braziers along the lane and around the medallion (flames + baked glow; no dynamic lights)
    for (const sx of [-52, -34, -12, 12, 34, 52]) for (const sz of [-1, 1]) this.brazier(sx, sz * (AM.laneHalf + 1.3), 1);
    for (const [x, z] of [[-7, 9.3], [7, 9.3], [-7, -9.3], [7, -9.3]]) this.brazier(x, z, 1);
    this.finishBraziers();
    progress(0.75); await nextFrame();

    // ---- the colossi on the stands, banners in the team colours
    {
      const sTop = this.standsTop;
      const colossus = (name, h, x, sz) => {
        const z = sz * ovalZ(x, AM.A + 7, AM.B + 7);
        const g = propInstance(name, h, x, z, Math.atan2(-x * 0.15, -z), { env: 0.9, parent: G, y: 4.6 + 1.45 * 3, shadow: false });
        return g;
      };
      for (const sz of [1, -1]) {
        if (Assets.glb.pharaoh_colossus) for (const x of [-44, -18, 18, 44]) colossus('pharaoh_colossus', 15, x, sz);
        else if (Assets.glb.thoth_statue) for (const x of [-30, 30]) colossus('thoth_statue', 15, x, sz);
        if (Assets.glb.thoth_statue) colossus('thoth_statue', 17, 0, sz);
      }
      this.banners();
      void sTop;
    }

    // ---- beyond the walls: dunes, the Nile glittering under the moon, palms and pyramids
    this.buildOutside();
    progress(0.88); await nextFrame();

    // ---- light: the moon (shared), two gate lights, shafts of moonlight and drifting sand motes
    this.buildAtmosphere();
    this.built = true;
    progress(1);
  },

  // instanced papyrus columns (shaft + capital + base) at [x, y, z]
  columns(list, scale = 1, shadow = true) {
    const G = this.group, m4 = new THREE.Matrix4(), sc = new THREE.Vector3(scale, scale, scale), q = new THREE.Quaternion();
    const mk = (geo, mat, yOff) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z], i) => { m4.compose(new THREE.Vector3(x, y + yOff * scale, z), q, sc); im.setMatrixAt(i, m4); });
      im.castShadow = shadow; im.receiveShadow = true; G.add(im);
    };
    mk(this.colGeo.shaft, this.colMat, 0.3); mk(this.colGeo.cap, this.capMat, 0.3);
    if (!this.baseGeo) this.baseGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.3, 24);
    mk(this.baseGeo, this.mats.stoneDark, 0.15);
  },

  obelisk(x, z, h, tm, y = 0) {
    const G = this.group;
    if (Assets.glb.arena_obelisk) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(h * 0.17, 1.0, h * 0.17), this.mats.stoneDark); ped.position.set(x, y + 0.5, z); ped.castShadow = true; ped.receiveShadow = true; G.add(ped);
      propInstance('arena_obelisk', h, x, z, 0, { env: 1.1, parent: G, y: y + 1 });
      // its glyphs answer in the team's colour: a soft glow at the foot (no light)
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: tm.col.clone().multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, fog: false }));
      gl.position.set(x, y + 1.6, z); gl.scale.setScalar(h * 0.42); G.add(gl);
      if (y === 0) this.coll(x, z, 1.4);
      return;
    }
    if (!this.obMat) {
      const T = WORLD.tex;
      this.obMat = TEAMS.map((t) => new THREE.MeshStandardMaterial({ color: 0x8a6a62, roughness: 0.42, map: T.relief.map, bumpMap: T.relief.bump, bumpScale: 2.5, emissiveMap: T.relief.glow, emissive: t.col.clone(), emissiveIntensity: 1.5 }));
    }
    const ped = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 2.2), this.mats.stoneDark); ped.position.set(x, y + 0.5, z); ped.castShadow = true; ped.receiveShadow = true; G.add(ped);
    const g = new THREE.CylinderGeometry(Math.SQRT2 * 0.4 * h / 13, Math.SQRT2 * 0.62 * h / 13, h, 4, 1); g.rotateY(Math.PI / 4);
    const ob = new THREE.Mesh(g, this.obMat[tm.id]); ob.position.set(x, y + 1 + h / 2, z); ob.castShadow = true; ob.receiveShadow = true; G.add(ob);
    const pg = new THREE.ConeGeometry(Math.SQRT2 * 0.4 * h / 13, 1.1 * h / 13, 4); pg.rotateY(Math.PI / 4);
    const py = new THREE.Mesh(pg, this.mats.gold); py.position.set(x, y + 1 + h + 0.55 * h / 13, z); G.add(py);
    if (y === 0) this.coll(x, z, 1.4);
  },

  // a bronze brazier with fire; flames share a handful of materials, the glow on the floor is one instanced pass
  brazier(x, z, s = 1) {
    (this.brazierSpots || (this.brazierSpots = [])).push([x, z, s]);
  },
  finishBraziers() {
    const G = this.group, spots = this.brazierSpots || [];
    if (!this.flameMats) this.flameMats = [0, 1, 2, 3].map((i) => { const m = makeFlameMaterial(i * 3.7 + 1.1); return m; });
    const glowTex = glowSpriteTexture();
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(1.0, 0.42, 0.1), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const gim = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    spots.forEach(([x, z, s], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); G.add(g);
      if (Assets.glb.brazier) { const m = propInstance('brazier', 1.78 * s, 0, 0, i * 1.3, { env: 1.2, parent: g }); if (m) m.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
      else {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 1.2, 10), M.bronze); st.position.y = 0.6; g.add(st);
        const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.2, 0.42, 20), M.bronze); bw.position.y = 1.4; g.add(bw);
      }
      for (let k = 0; k < 2; k++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.flameMats[(i + k) % 4]);
        f.position.set((k - 0.5) * 0.18 * s, 1.72 * s, 0); f.scale.setScalar(s); f.frustumCulled = false; f.renderOrder = 5; g.add(f);
      }
      m4.compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(7 * s, 1, 7 * s)); gim.setMatrixAt(i, m4);
      this.coll(x, z, 0.55, false);
    });
    gim.renderOrder = 4; G.add(gim);
    this.updaters.push((dt, t) => { for (const m of this.flameMats) m.uniforms.uTime.value = t; glowMat.opacity = 0.5 + 0.06 * Math.sin(t * 11) + 0.04 * Math.sin(t * 23.7); });
  },

  // a Sun Gate: two pylon towers with team-glowing reliefs, a lintel crowned by a winged golden sun disc, a portal
  // veil swirling between them, walls closing the base, the fountain pool behind and two towering obelisks
  buildGate(tm) {
    const G = this.group, s = tm.side, gx = s * AM.gateX, mats = this.mats;
    const face = s < 0 ? Math.PI / 2 : -Math.PI / 2;   // toward the middle
    const SP = AM.sunPortal, hasPortal = !!Assets.glb.sun_portal;
    const gate = { team: tm.id, x: gx, pos: new THREE.Vector3(hasPortal ? s * AM.portalX : gx, 0, 0), front: new THREE.Vector3(gx - s * 3.5, 0, 0), inside: new THREE.Vector3(gx + s * 3.5, 0, 0) };
    this.gates[tm.id] = gate;
    // with the Sun Gate model at the end of the base, the entrance is a pair of obelisks set into carved walls;
    // without it, a pylon gate crowned by a winged sun disc
    const pylons = !(hasPortal && Assets.glb.arena_obelisk);
    if (!pylons) for (const sz of [-1, 1]) this.obelisk(gx, sz * (AM.gateOpen + 1.6), 16, tm, 0);
    if (pylons) {
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(Math.SQRT2 * 0.5, Math.SQRT2 * 0.5 * 1.2, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(5.2, 15, 6.4); g.translate(0, 7.5, 0);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2.5);
        const t = new THREE.Mesh(g, mats.stone); t.position.set(gx, 0, sz * 7.1); t.castShadow = true; t.receiveShadow = true; G.add(t);
        const rf = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 9.6), mats.teamRelief[tm.id]);
        rf.position.set(gx - s * 2.85, 6.4, sz * 7.1); rf.rotation.y = face; rf.rotation.x = 0; G.add(rf);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.9, 7.0), mats.stoneDark); cap.position.set(gx, 15.2, sz * 7.1); cap.castShadow = true; G.add(cap);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 8.4), mats.stone); lintel.position.set(gx, 11.4, 0); lintel.castShadow = true; lintel.receiveShadow = true; G.add(lintel);
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.2), mats.teamRelief[tm.id]); lf.position.set(gx - s * 2.22, 11.4, 0); lf.rotation.y = face; G.add(lf);
      // the winged sun disc
      const wsd = new THREE.Group(); wsd.position.set(gx - s * 0.6, 14.6, 0); wsd.rotation.y = face; G.add(wsd);
      // a deep gold-orange sun (kept well below the bloom threshold: never a white blob) with a saturated team-tinted glow
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.5, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc98a24, metalness: 1, roughness: 0.28, emissive: 0xb84a00, emissiveIntensity: 0.55 }));
      wsd.add(disc);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: tm.col.clone().lerp(new THREE.Color(1.0, 0.38, 0.02), 0.45).multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, fog: false }));
      halo.scale.setScalar(9); halo.position.z = -0.3; wsd.add(halo);
      for (const sx of [-1, 1]) {
        const wing = new THREE.Shape(); wing.moveTo(0, 0.25); wing.quadraticCurveTo(1.6, 0.6, 2.9, 0.15); wing.lineTo(2.8, -0.05); wing.quadraticCurveTo(1.4, 0.0, 0.2, -0.4); wing.closePath();
        const wg = new THREE.Mesh(extrude(wing, 0.12, 0.03), mats.gold); wg.scale.set(sx * 2.4, 2.4, 2.4); wg.position.x = sx * 2.0; wsd.add(wg);
        const wi = new THREE.Mesh(extrude(wing, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: tm.col, emissive: tm.col, emissiveIntensity: 0.9, roughness: 0.3 }));
        wi.scale.set(sx * 1.9, 1.5, 2.4); wi.position.set(sx * 2.3, -0.12, 0.12); wsd.add(wi);
      }
      this.updaters.push((dt, t) => { halo.material.opacity = 0.4 + 0.08 * Math.sin(t * 1.3 + s); });
    }
    // walls closing the base on both sides of the gate
    for (const sz of [-1, 1]) {
      const z0 = pylons ? 10.3 : AM.gateOpen + 0.4, z1 = ovalZ(gx) + 2, len = z1 - z0;
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6, len), mats.stone); w.position.set(gx, 3, sz * (z0 + len / 2)); w.castShadow = true; w.receiveShadow = true; G.add(w);
      const rf = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.4), mats.relief); rf.position.set(gx - s * 1.31, 3.2, sz * (z0 + len / 2)); rf.rotation.y = face; G.add(rf);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, len), mats.stoneDark); cap.position.set(gx, 6.2, sz * (z0 + len / 2)); G.add(cap);
      this.collBox(gx - 1.3, gx + 1.3, sz > 0 ? z0 : -z1, sz > 0 ? z1 : -z0);
    }
    if (pylons) for (const sz of [-1, 1]) this.collBox(gx - 2.7, gx + 2.7, sz > 0 ? AM.gateOpen : -10.4, sz > 0 ? 10.4 : -AM.gateOpen);
    // the portal: the Sun Gate at the end of the base (sun_portal), its ring filled with a slow swirl of the team's
    // light, and a glowing threshold at its foot where enemy minions pass through. Without the model, the swirl
    // fills the entrance between the pylons instead.
    {
      const mat = vortexMaterial(tm.hot, tm.col, {}); mat.uniforms.uAlpha.value = 0.5;
      const veil = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat); veil.renderOrder = 8; veil.rotation.y = face; G.add(veil);
      if (hasPortal) {
        propInstance('sun_portal', SP.height, s * SP.x, 0, face, { env: 1.15, parent: G });
        veil.scale.setScalar(SP.height * SP.ringR); veil.position.set(s * (SP.x - 0.4), SP.height * SP.ringY, 0);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, AM.portalR * 0.8, SP.height * SP.ringY, 24, 1, true), beamMaterial(tm.col, { core: tm.col.clone().lerp(tm.hot, 0.35), gain: 0.8, scroll: 2.0 }));
        beam.position.set(gate.pos.x, SP.height * SP.ringY / 2, 0); beam.renderOrder = 8; beam.frustumCulled = false; G.add(beam); gate.beam = beam;
        this.collBox(s * (SP.x - 4.5) - 6, s * (SP.x - 4.5) + 6, -16, -7.5); this.collBox(s * (SP.x - 4.5) - 6, s * (SP.x - 4.5) + 6, 7.5, 16);
      } else { veil.scale.set(AM.gateOpen + 0.4, 5.4, 1); veil.position.set(gx, 5.0, 0); }
      gate.veil = veil; gate.veilMat = mat; gate.flash = 0;
      const sill = new THREE.Mesh(new THREE.RingGeometry(AM.portalR - 0.3, AM.portalR, 64), new THREE.MeshBasicMaterial({ color: tm.col.clone().multiplyScalar(2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sill.rotation.x = -Math.PI / 2; sill.position.set(gate.pos.x, 0.04, 0); G.add(sill);
      this.updaters.push((dt, t) => {
        gate.flash = Math.max(0, gate.flash - dt * 1.6); mat.uniforms.uTime.value = t * (1 + gate.flash); mat.uniforms.uAlpha.value = 0.5 + gate.flash * 0.8;
        if (gate.beam) { gate.beam.material.uniforms.uTime.value = t; gate.beam.material.uniforms.uAlpha.value = 0.12 + gate.flash * 0.6; }
      });
      const L = new THREE.PointLight(tm.hot, 70, 32, 1.8); L.position.set(hasPortal ? s * (AM.portalX - 3) : gx - s * 3, hasPortal ? 7 : 6, 0); G.add(L);
      gate.light = L;
    }
    // the fountain: a pool of the team's light with a golden ankh rising from it
    {
      const fx = s * AM.fountX, f = { team: tm.id, pos: new THREE.Vector3(fx, 0, 0) };
      this.fountains[tm.id] = f;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.42, 10, 64), mats.stoneDark); rim.rotation.x = Math.PI / 2; rim.position.set(fx, 0.22, 0); rim.castShadow = true; rim.receiveShadow = true; G.add(rim);
      const wn = WORLD.tex.waterN.clone(); wn.wrapS = wn.wrapT = THREE.RepeatWrapping; wn.repeat.set(2, 2); wn.needsUpdate = true;
      const water = new THREE.Mesh(new THREE.CircleGeometry(3.8, 48), new THREE.MeshStandardMaterial({ color: 0x041022, roughness: 0.06, metalness: 0.3, normalMap: wn, normalScale: new THREE.Vector2(0.5, 0.5), emissive: tm.col, emissiveIntensity: 0.55 }));
      water.rotation.x = -Math.PI / 2; water.position.set(fx, 0.16, 0); G.add(water);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 16), mats.stoneDark); ped.position.set(fx, 0.6, 0); G.add(ped);
      const ankh = new THREE.Mesh(extrude(ankhShape(3.4), 0.36, 0.04), new THREE.MeshStandardMaterial({ color: 0xf2c25e, metalness: 1, roughness: 0.2, emissive: tm.hot, emissiveIntensity: 0.45 }));
      ankh.position.set(fx, 1.2 + 1.7, 0); ankh.castShadow = true; G.add(ankh);
      // a column of the team's light over the pool: tinted glass, not a white dome
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 26, 32, 1, true), beamMaterial(tm.col, { core: tm.col.clone().lerp(tm.hot, 0.35), gain: 0.75, scroll: 1.2 }));
      col.position.set(fx, 13, 0); col.renderOrder = 8; col.frustumCulled = false; G.add(col);
      this.coll(fx, 0, 1.0);
      this.updaters.push((dt, t) => { ankh.rotation.y += dt * 0.5; ankh.position.y = 2.9 + Math.sin(t * 1.1 + s) * 0.12; wn.offset.set(t * 0.03, t * 0.05); col.material.uniforms.uTime.value = t; col.material.uniforms.uAlpha.value = 0.13 + 0.03 * Math.sin(t * 2 + s); });
      f.ankh = ankh;
    }
    // towering obelisks at the ends of the stands, flanking the gate
    for (const sz of [-1, 1]) this.obelisk(s * 67.5, sz * 13.5, 20, tm, 0);
  },

  banners() {
    const G = this.group;
    const tex = (tm, glyph) => {
      const c = cnv(128, 384), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, tm.id === 2 ? '#7a5410' : tm.id === 0 ? '#0c2a8a' : '#8a0c0a'); gr.addColorStop(1, tm.id === 2 ? '#3a2406' : tm.id === 0 ? '#06123e' : '#3e0505');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 0); g.lineTo(128, 344); g.lineTo(64, 384); g.lineTo(0, 344); g.closePath(); g.fill();
      g.strokeStyle = '#e8b85a'; g.lineWidth = 6; g.beginPath(); g.moveTo(8, 4); g.lineTo(8, 338); g.lineTo(64, 374); g.lineTo(120, 338); g.lineTo(120, 4); g.stroke();
      g.fillStyle = '#e8b85a'; for (let y = 24; y < 320; y += 22) { g.fillRect(16, y, 10, 4); g.fillRect(102, y, 10, 4); }
      g.beginPath(); g.arc(64, 120, 34, 0, TAU); g.lineWidth = 4; g.stroke();
      drawGlyph(g, glyph, 64, 122, 46, '#f6d27a');
      drawGlyph(g, 'ankh', 64, 250, 56, '#f6d27a');
      const t = toTex(c); return t;
    };
    const mats = TEAMS.map((tm, i) => {
      const m = new THREE.MeshStandardMaterial({ map: tex(tm, i === 0 ? 'eye' : i === 1 ? 'sun' : 'feather'), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85, emissive: tm.col, emissiveIntensity: 0.12 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.bannerT || (this.bannerT = { value: 0 });
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float hang = (1.0 - uv.y);
          transformed.z += sin(uTime * 1.6 + position.y * 0.9 + modelMatrix[3].x * 0.3) * 0.22 * hang * hang;`);
      };
      m.customProgramCacheKey = () => 'arena-banner';
      return m;
    });
    this.bannerT = this.bannerT || { value: 0 };
    this.updaters.push((dt, t) => { this.bannerT.value = t; });
    const geo = new THREE.PlaneGeometry(2.3, 6.4, 1, 10);
    const n = 28;
    for (let i = 0; i < n; i++) {
      const th = (i + 0.5) / n * TAU, x = Math.cos(th) * (AM.A - 0.05), z = Math.sin(th) * (AM.B - 0.05);
      if (Math.abs(x) > AM.A * 0.74) continue;   // (not over the gates)
      const tm = Math.abs(x) < 7 ? TEAMS[2] : x < 0 ? TEAMS[0] : TEAMS[1];
      const b = new THREE.Mesh(geo, mats[tm.id]);
      b.position.set(x, 4.6 + 1.45 - 3.2 + 1.2, z); b.lookAt(0, b.position.y, 0); b.castShadow = false; G.add(b);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6).rotateZ(Math.PI / 2), this.mats.gold); rod.position.set(0, 3.25, 0.02); b.add(rod);
    }
  },

  buildOutside() {
    const G = this.group, T = WORLD.tex;
    // the ground beyond the stands: dunes, carved by the Nile in the north
    const S = 1400, n = 140;
    const geo = new THREE.PlaneGeometry(S, S, n, n); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, riverZ = 118, riverW = 34;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const e = (x * x) / ((AM.A + 22) ** 2) + (z * z) / ((AM.B + 22) ** 2);
      const out = smoothstep(1.0, 1.8, e), dr = Math.abs(z - riverZ - Math.sin(x / 90) * 12);
      let h = (Noise.fbm(x / 70, z / 70, 4) * 0.5 + 0.5) * 24 * smoothstep(1.2, 6, e) + Math.sin(x / 31 + z / 47) * 2.2 * out;
      h *= smoothstep(riverW * 0.5, riverW * 2.4, dr);
      if (dr < riverW * 0.5) h = -1.6;
      p.setY(i, (e < 1 ? -0.3 : h - 0.3));
    }
    geo.computeVertexNormals();
    const dunes = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: (() => { const t = T.sandT.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 140); t.needsUpdate = true; return t; })(), color: 0x8a7a8a, roughness: 0.95 }));
    G.add(dunes);
    // the river: dark water whose ripples catch the moon (and a scatter of glints along the moon's path)
    const wn = T.waterN.clone(); wn.wrapS = wn.wrapT = THREE.RepeatWrapping; wn.repeat.set(60, 4); wn.needsUpdate = true;
    const river = new THREE.Mesh(new THREE.PlaneGeometry(S, riverW * 1.3, 64, 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x020814, roughness: 0.12, metalness: 0.55, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.8 }));
    const rp = river.geometry.attributes.position; for (let i = 0; i < rp.count; i++) rp.setZ(i, rp.getZ(i) + Math.sin(rp.getX(i) / 90) * 12);
    river.position.set(0, -0.9, riverZ); G.add(river);
    this.updaters.push((dt, t) => { wn.offset.set(t * 0.01, t * 0.004); });
    {
      const N2 = 700, pos = new Float32Array(N2 * 3), seed = new Float32Array(N2);
      for (let i = 0; i < N2; i++) { const x = rand(-260, 260); pos[i * 3] = x; pos[i * 3 + 1] = -0.7; pos[i * 3 + 2] = riverZ + Math.sin(x / 90) * 12 + rand(-riverW * 0.55, riverW * 0.55); seed[i] = rand(0, 100); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
        vertexShader: 'attribute float seed; uniform float uTime; uniform float uScale; varying float vA; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float tw = pow(max(0.0, sin(uTime * (1.5 + fract(seed) * 3.0) + seed * 7.0)), 12.0); vA = tw; gl_PointSize = uScale * 0.5 * (0.6 + tw) / -mv.z; }',
        fragmentShader: 'varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a * 2.0, a); }' });
      const glints = new THREE.Points(g, mat); glints.frustumCulled = false; G.add(glints);
      this.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = innerHeight * 0.6; });
    }
    if (Assets.glb.palm) for (let i = 0; i < 14; i++) {
      const x = -230 + i * 34 + rand(-8, 8), bank = i % 2 ? riverZ - riverW * 0.75 : riverZ + riverW * 0.75;
      const m = propInstance('palm', rand(7, 10), x, bank + Math.sin(x / 90) * 12, rand(0, TAU), { env: 0.6, parent: G, shadow: false });
      void m;
    }
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0x6f6273, roughness: 0.9, map: T.sandT });
    for (const [x, z, s] of [[-160, 330, 140], [120, 390, 110], [330, -160, 90], [-340, -240, 120]]) {
      const pg = new THREE.ConeGeometry(s * 0.75, s * 0.62, 4); pg.rotateY(Math.PI / 4);
      const pm = new THREE.Mesh(pg, pyrMat); pm.position.set(x, s * 0.31 - 2, z); G.add(pm);
    }
  },

  buildAtmosphere() {
    const G = this.group;
    // shafts of moonlight slanting down onto the sand
    const md = WORLD.moonDir.clone().normalize();
    for (const [x, z, r] of [[0, 0, 7], [-36, -4, 5], [36, 4, 5], [-14, 22, 4], [14, -22, 4]]) {
      const L = 70;
      const mat = beamMaterial(new THREE.Color(0.25, 0.4, 0.9), { core: new THREE.Color(0.55, 0.7, 1.0), gain: 0.5, scroll: 0.15, fade: 1 });
      mat.uniforms.uAlpha.value = 0.12;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, L, 24, 1, true), mat);
      m.position.set(x, 0, z).addScaledVector(md, L / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), md);
      m.renderOrder = 3; m.frustumCulled = false; G.add(m);
      this.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uAlpha.value = 0.1 + 0.03 * Math.sin(t * 0.4 + x); });
    }
    // drifting sand motes, warm in the torchlight
    const N = 660, pos = new Float32Array(N * 3), seed = new Float32Array(N);   // (realism pass: was 1100)
    for (let i = 0; i < N; i++) { let x, z; do { x = rand(-AM.A, AM.A); z = rand(-AM.B, AM.B); } while (!insideOval(x, z)); pos[i * 3] = x; pos[i * 3 + 1] = rand(0.2, 8); pos[i * 3 + 2] = z; seed[i] = rand(0, 100); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uWind: { value: 0 } },
      vertexShader: /* glsl */`
        attribute float seed; uniform float uTime; uniform float uScale; uniform float uWind; varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.2 + seed) * 0.9 + mod(uTime * uWind * 9.0 + seed * 13.0, 140.0) * uWind * 0.6; p.y += sin(uTime * 0.13 + seed * 1.7) * 0.6; p.z += cos(uTime * 0.17 + seed * 0.7) * 0.9;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * (0.035 + 0.025 * fract(seed * 7.13)) / -mv.z;
          vA = 0.35 + 0.35 * sin(uTime * 1.3 + seed * 3.0);
        }`,
      fragmentShader: 'varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.68, 0.32) * a * vA * 1.3, a * vA); }' });
    const motes = new THREE.Points(g, mat); motes.frustumCulled = false; G.add(motes);
    this.moteU = mat.uniforms;
    this.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = innerHeight * 0.55; });
  },

  // ---- switching maps: the playroom's scenery, collision and fog swap out for the arena's (and back)
  enter() {
    const W = WORLD;
    this.saved = { circles: W.circles, boxes: W.boxes, minX: W.minX, maxX: W.maxX, minZ: W.minZ, maxZ: W.maxZ, fogC: W.fogBase.clone(), fogD: scene.fog.density,
      dim: W.dimLights.map((e) => e[1]) };
    if (W.group) W.group.visible = false;
    this.group.visible = true;
    W.circles = this.circles; W.boxes = this.boxes;
    W.minX = -AM.A; W.maxX = AM.A; W.minZ = -AM.B; W.maxZ = AM.B; W.oval = { a: AM.A, b: AM.B };
    W.fogBase.copy(this.fog.color); scene.fog.color.copy(this.fog.color); scene.fog.density = this.fog.density;
    // a touch more moon and sky light for a big open arena (the brazier lights of the temple stay off)
    for (const e of W.dimLights) { if (e[0] === W.hemi) e[1] = 0.95; else if (e[0] === W.moon) e[1] = 1.75; }
  },
  leave() {
    const W = WORLD, s = this.saved;
    if (!s) return;
    this.group.visible = false;
    if (W.group) W.group.visible = true;
    W.circles = s.circles; W.boxes = s.boxes; W.minX = s.minX; W.maxX = s.maxX; W.minZ = s.minZ; W.maxZ = s.maxZ; W.oval = null;
    W.fogBase.copy(s.fogC); scene.fog.color.copy(s.fogC); scene.fog.density = s.fogD;
    W.dimLights.forEach((e, i) => { e[1] = s.dim[i]; });
    this.saved = null;
  },
};


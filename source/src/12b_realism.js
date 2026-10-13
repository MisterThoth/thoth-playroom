// ============================================================================
// Realism pass (grounding and shadows). Kept in one place:
//   ContactShadows      - a soft dark contact blob under every god and walking unit near the camera (one
//                         instanced draw), so feet sit on the floor even where the moon's shadow falls away
//   applyShadowQuality  - the moon's shadow map per quality: 4096 on high (crisper, softer PCF edges on the
//                         gods near you), 2048 medium, 1024 low; tuned bias against acne and peter-panning
// Called from 14_main.js (simulate -> ContactShadows.update, buildWorld/quality change -> applyShadowQuality).
// The other parts of the pass live where they act (each marked "realism pass"): camera (11_player.js), model
// texture anisotropy (07b_rig.js loadGLB), environment light (03_materials.js), floating numbers (10_combat.js,
// 12_hud.js), particle/decal budgets (07b_rig.js, 08_world.js, 09_vfx.js, 09c_fx2.js, 15_arena_map.js).
// ============================================================================
const ContactShadows = {
  im: null, max: 64,
  init() {
    const c = cnv(128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tex = toTex(c, { srgb: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, this.max);
    this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.im.count = 0; this.im.frustumCulled = false; this.im.renderOrder = 1;
    this.im.castShadow = false; this.im.receiveShadow = false;
    scene.add(this.im);
  },
  update() {
    if (Game.mode === 'menu' || Game.mode === 'quit') { if (this.im) this.im.count = 0; return; }
    if (!this.im) this.init();
    const m4 = _m1, q = _q1.identity(), cam = camera.position; let n = 0;
    const put = (x, z, y, r) => {
      if (n >= this.max) return;
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 38 * 38) return;
      const k = clamp(1 - y / 3, 0.25, 1), s = r * (1.15 - 0.35 * (1 - k)) * 2;   // higher off the floor: smaller and fainter
      m4.compose(_v4.set(x, 0.015, z), q, _v3.set(s, 1, s * 0.92));
      // (opacity per instance is not available on MeshBasicMaterial; fainter = smaller here)
      this.im.setMatrixAt(n++, m4);
    };
    // the player (not while dead / sunk into the sand in the arena)
    if (Game.thoth && Game.thoth.root.visible && !P.dead) put(P.pos.x, P.pos.z, Math.max(0, P.y), 0.62);
    // dummies (the walking ones; ushabti statues stand on plinths) and every arena unit near the camera
    const list = Arena.active ? Arena.units : Combat.dummies;
    for (const u of list) {
      if (!u.alive || !u.mesh || !u.mesh.visible || u.kind === 'ushabti') continue;
      const r = u.kind === 'siege' ? 1.9 : u.isGod ? 0.6 : u.isMummy ? 0.5 : (u.radius || 0.5) * 1.05;
      put(u.pos.x, u.pos.z, u.lift || 0, r);
    }
    this.im.count = n; this.im.instanceMatrix.needsUpdate = true;
  },
};

function applyShadowQuality() {
  const m = WORLD.moon; if (!m) return;
  const size = settings.quality === 'high' ? 4096 : settings.quality === 'low' ? 1024 : 2048;
  if (m.shadow.mapSize.x !== size) {
    m.shadow.mapSize.set(size, size);
    if (m.shadow.map) { m.shadow.map.dispose(); m.shadow.map = null; }
  }
  // a finer map needs less normal offset; a touch of constant bias kills acne on the curved bodies
  m.shadow.bias = -0.00025;
  m.shadow.normalBias = size >= 4096 ? 0.022 : size >= 2048 ? 0.03 : 0.045;
  renderer.shadowMap.needsUpdate = true;   // (the type stays PCFSoft: switching it live would need every material rebuilt)
}


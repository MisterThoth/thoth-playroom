// ============================================================================
// The Book of Thoth: two hinged halves, flipping pages, glowing glyphs.
// Local frame: spine along Y at the origin; open flat the pages face +Z,
// left half extends -X, right half +X. Closed, the fore-edge points +Z.
// ============================================================================
const BOOK_IDLE_GLOW = 0.4, BOOK_OPEN_HELD = 2.3;
class Book {
  // o.own: its own page material (another player's Thoth: his pages glow on their own); o.light false: no point light
  // (a second light would recompile every lit material)
  constructor(o = {}) {
    const pm = this.pageMat = o.own ? M.page.clone() : M.page;
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    const W = 0.3, H = 0.4, Tc = 0.016, Tp = 0.046;
    Object.assign(this, { W, H, Tc, Tp });
    this.left = new THREE.Group(); this.right = new THREE.Group();
    this.inner.add(this.left, this.right);
    const coverGeo = new THREE.BoxGeometry(W, H, Tc);
    const coverMats = [M.coverPlain, M.coverPlain, M.coverPlain, M.coverPlain, M.coverPlain, M.cover];
    const stackGeo = new THREE.BoxGeometry(W - 0.016, H - 0.02, Tp);
    const stackMats = [M.pageEdge, M.pageEdge, M.pageEdge, M.pageEdge, pm, M.pageEdge];
    for (const [half, sx] of [[this.left, -1], [this.right, 1]]) {
      const c = meshOf(coverGeo, coverMats); c.position.set((sx * W) / 2, 0, -Tp - Tc / 2); half.add(c);
      const s = meshOf(stackGeo, stackMats); s.position.set(sx * ((W - 0.016) / 2 + 0.004), 0, -Tp / 2); half.add(s);
      // corner caps on the outside
      for (const cy of [1, -1]) {
        const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.06, 0); tri.lineTo(0, 0.06); tri.closePath();
        const cap = meshOf(extrude(tri, 0.006, 0.002), M.goldPolished);
        cap.position.set(sx * (W - 0.004), cy * (H / 2 - 0.004), -Tp - Tc - 0.002);
        cap.rotation.set(0, Math.PI, 0); cap.scale.set(sx, -cy, 1);
        half.add(cap);
        const stud = meshOf(new THREE.SphereGeometry(0.008, 10, 8), M.gemBlue);
        stud.position.set(sx * (W - 0.03), cy * (H / 2 - 0.03), -Tp - Tc - 0.008); half.add(stud);
      }
    }
    // spine
    const spine = meshOf(new THREE.CylinderGeometry(Tp + Tc, Tp + Tc, H, 20, 1, true, Math.PI / 2, Math.PI), M.coverPlain);
    this.inner.add(spine);
    for (let k = 0; k < 4; k++) {
      const rib = meshOf(new THREE.TorusGeometry(Tp + Tc + 0.002, 0.005, 6, 20, Math.PI), M.goldPolished);
      rib.rotation.set(Math.PI / 2, 0, Math.PI); rib.position.y = -H / 2 + 0.05 + k * (H - 0.1) / 3;
      this.inner.add(rib);
    }
    // front cover: winged scarab + sun disc
    const deco = new THREE.Group(); deco.position.set(W / 2, 0, -Tp - Tc - 0.002); deco.rotation.y = Math.PI; this.right.add(deco);
    const body = meshOf(new THREE.SphereGeometry(1, 24, 16), M.gemGreen); body.scale.set(0.04, 0.055, 0.022); body.position.set(0, -0.02, 0.012); deco.add(body);
    const head = meshOf(new THREE.SphereGeometry(1, 16, 12), M.goldPolished); head.scale.set(0.022, 0.015, 0.012); head.position.set(0, 0.042, 0.01); deco.add(head);
    const seam = meshOf(new THREE.BoxGeometry(0.003, 0.1, 0.006), M.goldPolished); seam.position.set(0, -0.02, 0.031); deco.add(seam);
    const wing = new THREE.Shape();
    wing.moveTo(0, 0.012); wing.quadraticCurveTo(0.07, 0.075, 0.145, 0.05); wing.lineTo(0.14, 0.028);
    wing.quadraticCurveTo(0.09, 0.03, 0.12, 0.0); wing.quadraticCurveTo(0.07, -0.005, 0.0, -0.03); wing.closePath();
    for (const sx of [1, -1]) {
      const wg = meshOf(extrude(wing, 0.006, 0.002), M.gold); wg.position.set(0.026 * sx, 0.0, 0.006); wg.scale.x = sx; deco.add(wg);
    }
    const sun = meshOf(new THREE.SphereGeometry(0.025, 20, 14), M.gemBlue); sun.position.set(0, 0.098, 0.012); sun.scale.z = 0.75; deco.add(sun);
    const bez = meshOf(new THREE.TorusGeometry(0.027, 0.005, 8, 26), M.goldPolished); bez.position.set(0, 0.098, 0.012); deco.add(bez);
    for (const sx of [1, -1]) {
      const legs = meshOf(new THREE.TorusGeometry(0.05, 0.004, 6, 12, 1.0), M.goldPolished);
      legs.position.set(0.0, -0.035, 0.008); legs.rotation.z = sx > 0 ? -0.5 : Math.PI - 0.5; deco.add(legs);
    }
    // flipping pages
    this.pages = [];
    for (let i = 0; i < 6; i++) {
      const pw = W - 0.024;
      const geo = new THREE.PlaneGeometry(pw, H - 0.026, 14, 1);
      geo.translate(pw / 2, 0, 0);
      const mesh = new THREE.Mesh(geo, pm);
      const pg = new THREE.Group(); pg.add(mesh); this.inner.add(pg);
      const base = new Float32Array(geo.attributes.position.count);
      for (let k = 0; k < base.length; k++) base[k] = geo.attributes.position.getX(k);
      this.pages.push({ pg, mesh, geo, base, phase: i / 6 });
    }
    this.light = o.light === false ? null : new THREE.PointLight(0x4fe6ff, 0, 5, 2);
    if (this.light) { this.light.position.set(0, 0, 0.42); this.inner.add(this.light); }
    this.open = BOOK_OPEN_HELD; this.openTarget = BOOK_OPEN_HELD;
    this.flipPhase = 0; this.flipRate = 0.25;
    this.glow = BOOK_IDLE_GLOW; this.glowTarget = BOOK_IDLE_GLOW;
    this.curl = 2.2;
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    for (const p of this.pages) p.mesh.castShadow = false;
  }
  update(dt) {
    this.open = damp(this.open, this.openTarget, 7, dt);
    this.glow = damp(this.glow, this.glowTarget, 6, dt);
    const half = (Math.PI - this.open) / 2;
    this.left.rotation.y = half;
    this.right.rotation.y = -half;
    const rR = -half, rL = -Math.PI + half;
    this.flipPhase += dt * this.flipRate;
    for (const p of this.pages) {
      const ph = (((this.flipPhase + p.phase) % 1) + 1) % 1;
      const prog = smoothstep(0, 1, clamp(ph * 1.6, 0, 1));
      p.pg.rotation.y = lerp(rR, rL, prog);
      const c = -this.curl * Math.sin(Math.PI * prog);
      const pos = p.geo.attributes.position;
      for (let k = 0; k < p.base.length; k++) {
        const s = p.base[k];
        let x = s, z = 0;
        if (Math.abs(c) > 1e-3) { x = Math.sin(c * s) / c; z = (1 - Math.cos(c * s)) / c; }
        pos.setX(k, x); pos.setZ(k, z + 0.0018);
      }
      pos.needsUpdate = true;
      p.mesh.visible = this.open > 0.5;
    }
    this.pageMat.emissiveIntensity = this.glow * 1.5;
    if (this.light) this.light.intensity = this.glow * 1.6;
  }
  // (its own geometry; the materials are the shared ones, but for an own page material)
  dispose() {
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    if (this.pageMat !== M.page) this.pageMat.dispose();
  }
}


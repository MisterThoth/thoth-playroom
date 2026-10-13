// ============================================================================
// Geometry helpers: lofts (organic limbs/torso), sweeps (beaks, claws), bends,
// extrusions and skin weights.
// ============================================================================

// Loft along local Y through elliptical / superelliptical rings.
// th = 0 points to +Z (front), th = +PI/2 points to +X.
class Loft {
  constructor(rings, opts = {}) {
    this.radial = opts.radial ?? 32;
    this.sub = opts.sub ?? 3;
    this.n = opts.n ?? 2;
    this.bumps = opts.bumps || [];
    this.shape = opts.shape || null;
    const R = rings.map((r) => ({ y: r.y, rx: r.rx, rz: r.rz ?? r.rx, cx: r.cx ?? 0, cz: r.cz ?? 0 }));
    const keys = ['y', 'rx', 'rz', 'cx', 'cz'];
    const dense = [];
    for (let i = 0; i < R.length - 1; i++) {
      const p0 = R[Math.max(i - 1, 0)], p1 = R[i], p2 = R[i + 1], p3 = R[Math.min(i + 2, R.length - 1)];
      for (let s = 0; s < this.sub; s++) {
        const t = s / this.sub, o = {};
        for (const k of keys) o[k] = catmull(p0[k], p1[k], p2[k], p3[k], t);
        dense.push(o);
      }
    }
    dense.push({ ...R[R.length - 1] });
    this.dense = dense;
    this.up = R[R.length - 1].y > R[0].y;
  }
  ringAt(y) {
    const d = this.dense;
    const asc = this.up;
    const first = d[0].y, last = d[d.length - 1].y;
    if (asc ? y <= first : y >= first) return d[0];
    if (asc ? y >= last : y <= last) return d[d.length - 1];
    for (let i = 0; i < d.length - 1; i++) {
      const a = d[i], b = d[i + 1];
      if ((asc && y >= a.y && y <= b.y) || (!asc && y <= a.y && y >= b.y)) {
        const t = (y - a.y) / (b.y - a.y || 1);
        return { y, rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), cx: lerp(a.cx, b.cx, t), cz: lerp(a.cz, b.cz, t) };
      }
    }
    return d[d.length - 1];
  }
  point(th, ring, offset = 0, out = new THREE.Vector3()) {
    const s = Math.sin(th), c = Math.cos(th), e = 2 / this.n;
    const x = ring.rx * Math.sign(s) * Math.pow(Math.abs(s), e);
    const z = ring.rz * Math.sign(c) * Math.pow(Math.abs(c), e);
    let k = 1;
    for (const b of this.bumps) {
      const dth = wrapAngle(th - b.th);
      k += b.a * Math.exp(-(dth * dth) / (b.wt * b.wt)) * Math.exp(-((ring.y - b.y) ** 2) / (b.wy * b.wy));
    }
    if (this.shape) k *= this.shape(th, ring.y);
    const len = Math.hypot(x, z) * k;
    const sc = len > 1e-6 ? ((len + offset) / len) * k : 1;
    return out.set(ring.cx + x * sc, ring.y, ring.cz + z * sc);
  }
  pointAt(th, y, offset = 0, out) { return this.point(th, this.ringAt(y), offset, out); }

  geometry({ capStart = false, capEnd = false, splitAtY = null } = {}) {
    const radial = this.radial, rings = this.dense, W = radial + 1;
    const pos = [], uv = [], ly = [];
    const lens = [0];
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1], b = rings[i];
      lens.push(lens[i - 1] + Math.hypot(b.y - a.y, (b.rx + b.rz - a.rx - a.rz) * 0.5));
    }
    const L = lens[lens.length - 1] || 1;
    const p = new THREE.Vector3();
    for (let i = 0; i < rings.length; i++) {
      for (let j = 0; j <= radial; j++) {
        this.point((j / radial) * TAU, rings[i], 0, p);
        pos.push(p.x, p.y, p.z); uv.push(j / radial, lens[i] / L); ly.push(rings[i].y);
      }
    }
    const idxA = [], idxB = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const target = splitAtY !== null && ((this.up ? rings[i].y >= splitAtY : rings[i].y <= splitAtY)) ? idxB : idxA;
      for (let j = 0; j < radial; j++) {
        const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
        if (this.up) target.push(a, b, c, b, d, c); else target.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idxA.concat(idxB));
    if (splitAtY !== null) { g.addGroup(0, idxA.length, 0); g.addGroup(idxA.length, idxB.length, 1); }
    g.computeVertexNormals();
    // weld seam normals
    const n = g.attributes.normal;
    for (let i = 0; i < rings.length; i++) {
      const a = i * W, b = i * W + radial;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
    let geo = g;
    if (capStart || capEnd) {
      const caps = [];
      const mk = (ri, top) => {
        const ring = rings[ri];
        const cpos = [ring.cx, ring.y, ring.cz], cuv = [0.5, 0.5], cly = [ring.y], cidx = [];
        for (let j = 0; j <= radial; j++) {
          this.point((j / radial) * TAU, ring, 0, p);
          cpos.push(p.x, p.y, p.z); cuv.push(0.5 + 0.5 * Math.sin(j / radial * TAU), 0.5 + 0.5 * Math.cos(j / radial * TAU)); cly.push(ring.y);
        }
        for (let j = 0; j < radial; j++) { if (top) cidx.push(0, j + 1, j + 2); else cidx.push(0, j + 2, j + 1); }
        const cg = new THREE.BufferGeometry();
        cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
        cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
        cg.setIndex(cidx); cg.computeVertexNormals();
        cg.userData.ly = cly;
        caps.push(cg);
      };
      const lastI = rings.length - 1;
      // "top" means the cap whose outward normal is +Y
      if (capStart) mk(0, !this.up);
      if (capEnd) mk(lastI, this.up);
      g.userData.ly = ly;
      const all = [g, ...caps];
      const merged = mergeGeometries(all.map((x) => { const c = x.clone(); c.clearGroups(); return c; }), false);
      merged.userData.ly = all.flatMap((x) => x.userData.ly);
      if (splitAtY !== null) { merged.clearGroups(); merged.addGroup(0, idxA.length, 0); merged.addGroup(idxA.length, merged.index.count - idxA.length, 1); }
      geo = merged;
    } else {
      g.userData.ly = ly;
    }
    return geo;
  }

  // Patch that follows the loft surface (straps, belts, bracers). th range and y range, offset outward.
  strip(th0, th1, y0, y1, nu = 12, nv = 12, offset = 0.005, thFn = null) {
    const pos = [], uv = [], ly = [], idx = [];
    const p = new THREE.Vector3();
    for (let i = 0; i <= nv; i++) {
      const v = i / nv, y = lerp(y0, y1, v);
      const ring = this.ringAt(y);
      for (let j = 0; j <= nu; j++) {
        const u = j / nu;
        const th = thFn ? thFn(u, v) : lerp(th0, th1, u);
        this.point(th, ring, offset, p);
        pos.push(p.x, p.y, p.z); uv.push(u, 1 - v); ly.push(y);
      }
    }
    const W = nu + 1;
    const goingUp = y1 > y0;
    for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
      const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
      if (goingUp) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    g.userData.ly = ly;
    return g;
  }
}

// Sweep a (possibly elliptical) cross-section along a curve.
// rx(t), ry(t) radii; side: constant vector defining the rx axis (else Frenet frames).
function sweep(points, opts = {}) {
  const segs = opts.segs ?? 24, radial = opts.radial ?? 12;
  const rx = opts.rx || (() => 0.02), ry = opts.ry || rx;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const frames = opts.side ? null : curve.computeFrenetFrames(segs, false);
  const pos = [], uv = [], col = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    if (frames) { B.copy(frames.binormals[i]); N.copy(frames.normals[i]); T.copy(frames.tangents[i]); N.crossVectors(T, B).normalize(); }
    else {
      curve.getTangentAt(t, T);
      B.copy(opts.side).addScaledVector(T, -opts.side.dot(T)).normalize();
      N.crossVectors(T, B).normalize();
    }
    const a = rx(t), b = ry(t);
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * TAU;
      const cx = Math.cos(ang) * a, cy = Math.sin(ang) * b;
      pos.push(P.x + B.x * cx + N.x * cy, P.y + B.y * cx + N.y * cy, P.z + B.z * cx + N.z * cy);
      uv.push(j / radial, t);
      if (opts.color) { const c = opts.color(t, ang); col.push(c.r, c.g, c.b); }
    }
  }
  const W = radial + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // end caps (fan) when radius not ~0
  const addCap = (i, flip) => {
    const t = i / segs; curve.getPointAt(t, P);
    const ci = pos.length / 3; pos.push(P.x, P.y, P.z); uv.push(0.5, t);
    if (opts.color) { const c = opts.color(t, 0); col.push(c.r, c.g, c.b); }
    for (let j = 0; j < radial; j++) { const a = i * W + j, b = a + 1; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (opts.capStart !== false && rx(0) > 1e-4) addCap(0, true);
  if (opts.capEnd !== false && rx(1) > 1e-4) addCap(segs, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (opts.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i <= segs; i++) {
    const a = i * W, b = i * W + radial;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// Bend a flat geometry (laid out in XY, thickness along +Z) around a vertical cylinder.
function bendAroundY(geo, R) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = x / R;
    p.setXYZ(i, Math.sin(a) * (R + z), p.getY(i), Math.cos(a) * (R + z) - R);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}
// Bend around a horizontal (X) axis: y becomes arc length.
function bendAroundX(geo, R) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i), a = y / R;
    p.setXYZ(i, p.getX(i), Math.sin(a) * (R + z), Math.cos(a) * (R + z) - R);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}
function extrude(shape, depth, bevel = 0.003, curveSegments = 14, bevelSegments = 2) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  // normalise UVs to shape bounds
  g.computeBoundingBox();
  const bb = g.boundingBox, uv = g.attributes.uv, pp = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (pp.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
  return g;
}
// Tapered feather / leaf outline pointing +Y (base at origin)
function featherShape(w, l, tipRound = 0.25) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.62, l * 0.05, w * 0.55, l * 0.65, w * tipRound, l * 0.92);
  s.quadraticCurveTo(0, l * 1.02, -w * tipRound, l * 0.92);
  s.bezierCurveTo(-w * 0.55, l * 0.65, -w * 0.62, l * 0.05, 0, 0);
  return s;
}
function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function ankhShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.12 * s, -0.5 * s); sh.lineTo(0.12 * s, -0.5 * s); sh.lineTo(0.07 * s, 0.02 * s);
  sh.lineTo(0.36 * s, 0.0); sh.lineTo(0.36 * s, 0.14 * s); sh.lineTo(0.12 * s, 0.12 * s);
  sh.bezierCurveTo(0.34 * s, 0.32 * s, 0.24 * s, 0.62 * s, 0, 0.62 * s);
  sh.bezierCurveTo(-0.24 * s, 0.62 * s, -0.34 * s, 0.32 * s, -0.12 * s, 0.12 * s);
  sh.lineTo(-0.36 * s, 0.14 * s); sh.lineTo(-0.36 * s, 0.0); sh.lineTo(-0.07 * s, 0.02 * s);
  sh.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 0.2 * s); hole.bezierCurveTo(0.14 * s, 0.32 * s, 0.12 * s, 0.5 * s, 0, 0.5 * s);
  hole.bezierCurveTo(-0.12 * s, 0.5 * s, -0.14 * s, 0.32 * s, 0, 0.2 * s);
  sh.holes.push(hole);
  return sh;
}
// Eye of Horus outline (plate) centred at origin, ~1 unit wide
function eyeOfHorusShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.5 * s, 0.02 * s);
  sh.bezierCurveTo(-0.3 * s, 0.26 * s, 0.25 * s, 0.26 * s, 0.5 * s, 0.05 * s);
  sh.lineTo(0.62 * s, 0.06 * s); sh.lineTo(0.62 * s, -0.02 * s); sh.lineTo(0.44 * s, -0.04 * s);
  sh.bezierCurveTo(0.24 * s, -0.2 * s, -0.08 * s, -0.2 * s, -0.22 * s, -0.12 * s);
  // spiral tail
  sh.bezierCurveTo(-0.05 * s, -0.3 * s, 0.05 * s, -0.48 * s, -0.12 * s, -0.5 * s);
  sh.bezierCurveTo(-0.26 * s, -0.5 * s, -0.24 * s, -0.36 * s, -0.16 * s, -0.36 * s);
  sh.bezierCurveTo(-0.24 * s, -0.42 * s, -0.12 * s, -0.46 * s, -0.08 * s, -0.4 * s);
  sh.bezierCurveTo(-0.06 * s, -0.3 * s, -0.22 * s, -0.22 * s, -0.36 * s, -0.12 * s);
  sh.bezierCurveTo(-0.42 * s, -0.08 * s, -0.48 * s, -0.04 * s, -0.5 * s, 0.02 * s);
  const brow = new THREE.Path();
  return sh;
}
function eyeBrowShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.52 * s, 0.24 * s);
  sh.bezierCurveTo(-0.2 * s, 0.44 * s, 0.3 * s, 0.42 * s, 0.6 * s, 0.26 * s);
  sh.lineTo(0.6 * s, 0.32 * s);
  sh.bezierCurveTo(0.3 * s, 0.5 * s, -0.2 * s, 0.52 * s, -0.54 * s, 0.3 * s);
  sh.closePath();
  return sh;
}

// ---------------------------------------------------------------------------
// Skinning helpers
// ---------------------------------------------------------------------------
// chain: { bones: [i0, i1, ...], cuts: [c1, ...], blend: [h1, ...] } along scalar s
function chainWeight(s, chain) {
  const { bones, cuts, blend } = chain;
  for (let k = 0; k < cuts.length; k++) {
    const c = cuts[k], h = blend[k];
    if (s < c - h) return [[bones[k], 1]];
    if (s <= c + h) { const t = smoothstep(c - h, c + h, s); return [[bones[k], 1 - t], [bones[k + 1], t]]; }
  }
  return [[bones[bones.length - 1], 1]];
}
// Assign skin attributes using a function of each vertex's local "ly" value
function skinGeometry(geo, weightFn) {
  const ly = geo.userData.ly;
  const n = geo.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const ws = weightFn(ly ? ly[i] : 0, i);
    for (let k = 0; k < Math.min(4, ws.length); k++) { si[i * 4 + k] = ws[k][0]; sw[i * 4 + k] = ws[k][1]; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}
// Rigidly skin a whole geometry to one bone
function skinRigid(geo, bone) { return skinGeometry(geo, () => [[bone, 1]]); }
// Mirror a geometry across X (flips winding, keeps outward normals)
function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.index.needsUpdate = true;
  }
  g.userData = { ...geo.userData };
  return g;
}
function addVertexColors(geo, fn) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i); fn(v, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
function meshOf(geo, mat, { shadow = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = receive;
  return m;
}


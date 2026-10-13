// ============================================================================
// God locomotion (SMITE-style): the god always faces the camera and moves in any direction on
// planted feet. An 8-way blend space of mocap gait clips with orientation warping and foot IK:
//  - base clips per speed tier, each with its measured travel direction: walk tier = jog forward
//    (run_f), side-step left / right (crouch_l / its mirror crouch_r, raised to full height), walk
//    back (walk_b); run tier = sprint forward, run back (run_bk = back-left + back-right in step).
//    Glide gods (Thoth, Hecate, Ra) use the proud strut forward with the same side and back steps.
//  - the two clips that bracket the travel direction are blended (phase-synced: every clip is
//    re-timed so that its left-foot plant lands on the shared gait phase), and so are the tiers by speed.
//  - each clip's foot path (a table measured on this god's own skeleton) is turned onto the exact
//    travel direction, scaled to the stride the ground speed needs, and the legs reach it with two-bone
//    IK: the planted foot moves backward at exactly the ground speed (no sliding, no moonwalk).
//  - the pelvis turns only a little toward the travel (small max twist); the spine takes it back so the
//    chest and head stay on the aim, and the run cycle's shoulder swing is calmed (no wobble).
//  - start step, quick stop with a settle dip, acceleration lean; per-god style (waddle, crouch,
//    upright chest, stance width) and lore footprints / motes (LocoFX).
// ============================================================================
const LOCO_CAL = new WeakMap();   // gltf animations array -> this skeleton's calibration (shared by Arena clones)
const LOCO_SETS = {
  run: { walk: ['run_f', 'crouch_l', 'crouch_r', 'walk_b'], run: ['sprint', 'run_bk'] },
  glide: { walk: ['glide', 'crouch_l', 'crouch_r', 'walk_b'] },
};
const LOCO_COMPOSITE = { run_bk: ['run_bl', 'run_br'] };
const LOCO_UPPER_IDLE = { crouch_l: 1, crouch_r: 1 };   // the cautious side-step's hunched upper body is swapped for the idle's
const _lc = { v: new THREE.Vector3(), w: new THREE.Vector3(), t: new THREE.Vector3(), p: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() };
const posMod = (x, m) => ((x % m) + m) % m;
const circMean = (a) => { let s = 0, c = 0; for (const x of a) { s += Math.sin(x); c += Math.cos(x); } return Math.atan2(s, c); };

// Measure every locomotion clip on this skeleton: per-sample ankle positions in body space (x = his left,
// z = forward, metres), the ground speed and travel direction of the planted foot, gait cycles, the time of
// the first left-foot plant, mean pelvis / chest yaw, neutral foot positions and hips height.
function locoCalibrate(rig) {
  const key = rig.animKey;
  if (key && LOCO_CAL.has(key)) return LOCO_CAL.get(key);
  const bl = rig.boneList, n = rig.n, P = new RigPose(n), Q = new RigPose(n);
  const saveQ = bl.map((b) => b.quaternion.clone()), saveP = rig.hips.position.clone();
  const F = [rig.b('LeftFoot'), rig.b('RightFoot')], TO = [rig.b('LeftToeBase'), rig.b('RightToeBase')], U = [rig.b('LeftUpLeg'), rig.b('RightUpLeg')], A = [rig.b('LeftArm'), rig.b('RightArm')];
  const inv = _lc.m, v = _lc.v, w = _lc.w;
  const lineYaw = (a, b) => { const l = v.setFromMatrixPosition(a.matrixWorld).applyMatrix4(inv), r = w.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv); return Math.atan2(-(l.z - r.z), l.x - r.x); };
  const measure = (sampleFn, dur, ns) => {
    const rows = new Float32Array((ns + 1) * 6), trows = new Float32Array((ns + 1) * 6), hy = [], cy = [], py = [];
    for (let k = 0; k <= ns; k++) {
      sampleFn((k / ns) * dur, P);
      for (let i = 0; i < n; i++) bl[i].quaternion.fromArray(P.q, i * 4);
      rig.hips.position.fromArray(P.p);
      rig.root.updateMatrixWorld(true);
      inv.copy(rig.body.matrixWorld).invert();
      for (let s = 0; s < 2; s++) {
        v.setFromMatrixPosition(F[s].matrixWorld).applyMatrix4(inv); rows[k * 6 + s * 3] = v.x; rows[k * 6 + s * 3 + 1] = v.y; rows[k * 6 + s * 3 + 2] = v.z;
        v.setFromMatrixPosition(TO[s].matrixWorld).applyMatrix4(inv); trows[k * 6 + s * 3] = v.x; trows[k * 6 + s * 3 + 1] = v.y; trows[k * 6 + s * 3 + 2] = v.z;
      }
      hy.push(lineYaw(U[0], U[1])); cy.push(lineYaw(A[0], A[1])); py.push(P.p[1]);
    }
    return { rows, trows, hy, cy, py };
  };
  // gait of a measured loop
  const gait = (M, dur, ns) => {
    const R = M.rows, dt = dur / ns;
    const T = M.trows, gnd = [1e9, 1e9], gT = [1e9, 1e9];
    for (let s = 0; s < 2; s++) for (let k = 0; k <= ns; k++) { gnd[s] = Math.min(gnd[s], R[k * 6 + s * 3 + 1]); gT[s] = Math.min(gT[s], T[k * 6 + s * 3 + 1]); }
    // ground speed: the mean velocity of the contact point (the heel / ankle or the toe, whichever is down), over
    // every sample where it is within 2 cm of the floor: the playback speed that leaves the least slide overall
    let ax = 0, az = 0, cnt = 0;
    for (let s = 0; s < 2; s++) for (let k = 0; k < ns; k++) {
      const o = s * 3, la = R[k * 6 + o + 1] - gnd[s], lt = T[k * 6 + o + 1] - gT[s], la1 = R[(k + 1) * 6 + o + 1] - gnd[s], lt1 = T[(k + 1) * 6 + o + 1] - gT[s];
      const useT = lt < la; if (useT !== lt1 < la1) continue;
      if ((useT ? lt : la) > 0.02 || (useT ? lt1 : la1) > 0.02) continue;
      const A = useT ? T : R;
      ax += A[(k + 1) * 6 + o] - A[k * 6 + o]; az += A[(k + 1) * 6 + o + 2] - A[k * 6 + o + 2]; cnt++;
    }
    const aw = cnt * dt;
    const vx = aw ? -ax / aw : 0, vz = aw ? -az / aw : 0, speed = Math.hypot(vx, vz), dir = Math.atan2(vx, vz);
    // left-foot plants: the left ankle furthest along the travel direction
    const tx = Math.sin(dir), tz = Math.cos(dir), proj = [];
    for (let k = 0; k < ns; k++) proj.push(R[k * 6] * tx + R[k * 6 + 2] * tz);
    const mean = proj.reduce((a, b) => a + b, 0) / ns, win = Math.max(2, Math.round(ns * 0.11)), peaks = [];
    for (let k = 0; k < ns; k++) {
      if (proj[k] <= mean) continue;
      let ok = true; for (let j = -win; j <= win && ok; j++) if (j && proj[(k + j + ns) % ns] > proj[k] + 1e-7) ok = false;
      if (ok && !(peaks.length && k - peaks[peaks.length - 1] < win)) peaks.push(k);
    }
    let nl = [0, 0], nr = [0, 0];
    for (let k = 0; k < ns; k++) { nl[0] += R[k * 6]; nl[1] += R[k * 6 + 2]; nr[0] += R[k * 6 + 3]; nr[1] += R[k * 6 + 5]; }
    nl = nl.map((x) => x / ns); nr = nr.map((x) => x / ns);
    return { speed, dir, peaks: peaks.map((k) => k * dt), gnd, gT, nl, nr, p: circMean(M.hy), c: circMean(M.cy), py: M.py.reduce((a, b) => a + b, 0) / M.py.length };
  };
  const pin = (pose) => { pose.p[0] = rig.rest.p[0]; pose.p[2] = rig.rest.p[2]; return pose; };   // in-place clips: the god's own motion moves him
  const single = (name) => {
    const s = rig.clips[name]; if (!s) return null;
    const ns = Math.max(72, Math.round(s.duration * 60));
    const fn = (t, out) => pin(s.sample(posMod(t, s.duration), out, rig));
    const M = measure(fn, s.duration, ns), g = gait(M, s.duration, ns);
    return { name, fn, dur: s.duration, ns, M, g };
  };
  const cal = {};
  const make = (r) => {
    if (!r) return null;
    const cyc = Math.max(1, r.g.peaks.length), len = r.dur / cyc;
    return { name: r.name, sample: r.fn, dur: r.dur, ns: r.ns, rows: r.M.rows, trows: r.M.trows, gT: r.g.gT, speed: r.g.speed, dir: r.g.dir, cyc, len, u0: (r.g.peaks[0] ?? 0) / len,
      p: r.g.p, c: r.g.c, nl: r.g.nl, nr: r.g.nr, gnd: r.g.gnd, py: r.g.py, upperIdle: !!LOCO_UPPER_IDLE[r.name] };
  };
  const names = new Set(); for (const set of Object.values(LOCO_SETS)) for (const t of Object.values(set)) t.forEach((x) => names.add(x));
  for (const nm of names) {
    if (LOCO_COMPOSITE[nm]) {
      const parts = LOCO_COMPOSITE[nm].map(single);
      if (parts.some((p) => !p)) continue;
      // both parts in step from their own left plants, blended evenly, over one shared cycle
      const dur = parts.reduce((a, p) => a + p.dur, 0) / parts.length, ns = Math.max(72, Math.round(dur * 60));
      const fn = (t, out) => {
        const u = posMod(t, dur) / dur;
        parts.forEach((p, i) => {
          const t0 = p.g.peaks[0] ?? 0, ti = posMod(t0 + u * p.dur, p.dur);
          if (i === 0) p.fn(ti, out); else { p.fn(ti, Q); blendPose(out, out, Q, 1 / (i + 1)); }
        });
        return pin(out);
      };
      const M = measure(fn, dur, ns), g = gait(M, dur, ns);
      cal[nm] = make({ name: nm, fn, dur, ns, M, g });
    } else { const r = single(nm); if (r) cal[nm] = make(r); }
  }
  // hips height of the idle (the side steps are crouched: raised back to standing height in the pose)
  if (rig.clips.idle) { const s = rig.clips.idle; let h = 0; for (let k = 0; k < 24; k++) { s.sample((k / 24) * s.duration, P, rig); h += P.p[1]; } cal._idleP1 = h / 24; }
  const idle = single('idle'); cal._idleYaw = idle ? { p: idle.g.p, c: idle.g.c } : { p: 0, c: 0 };
  // restore the bind pose
  bl.forEach((b, i) => b.quaternion.copy(saveQ[i])); rig.hips.position.copy(saveP); rig.root.updateMatrixWorld(true);
  if (key) LOCO_CAL.set(key, cal);
  return cal;
}

class LocoState {
  constructor(anim) {
    this.a = anim;
    const rig = anim.ch, cfg = anim.cfg.loco;
    this.cfg = cfg;
    this.cal = locoCalibrate(rig);
    const set = LOCO_SETS[cfg.mode] || LOCO_SETS.run;
    this.tiers = Object.entries(set).map(([tier, names]) => ({ tier, list: names.map((nm) => this.cal[nm]).filter(Boolean).sort((a, b) => a.dir - b.dir) })).filter((t) => t.list.length);
    this.ok = this.tiers.length > 0;
    const n = rig.n;
    this.acc = new RigPose(n); this.tmp = new RigPose(n); this.accPrev = new RigPose(n); this.xf = 0;
    this.vx = 0; this.vz = 0; this.vs = 0; this.th = 0; this.ph = 0.8; this.h = 0; this.f = 0; this.s = 1;
    this.active = []; this.pMean = 0; this.cMean = 0; this.tierW = 0;
    this.acc1 = 0; this.vsPrev = 0; this.dip = 0; this.dipV = 0; this.bodyY = 0;
    this.hipRef = 0; this.chestRef = 0; this.step = -1; this.pending = null; this.wasStill = true;
    this.knee = 0; this.lock = [0, 1].map(() => ({ on: false, toe: false, p: new THREE.Vector3(), ox: 0, oz: 0 })); this.backHalf = false;
    // hips-parent units per metre (Meshy rigs: armature in centimetres)
    rig.root.updateMatrixWorld(true);
    const hw = _lc.v.setFromMatrixPosition(rig.hips.matrixWorld).applyMatrix4(_lc.m.copy(rig.body.matrixWorld).invert());
    this.unit = Math.abs(rig.rest.p[1]) / Math.max(0.3, hw.y);
  }
  // the clips (and weights) for the current travel direction and speed
  pick(dt) {
    const out = this.active; out.length = 0;
    const two = this.tiers.length > 1;
    const v0 = this.cfg.tier ? this.cfg.tier[0] : 2.3, v1 = this.cfg.tier ? this.cfg.tier[1] : 4.1;
    this.tierW = two ? damp(this.tierW, smoothstep(v0, v1, this.vs), 5, dt) : 0;   // (eased: a quick stop does not snap from run to jog)
    this.tiers.forEach((T, ti) => {
      const wt = two ? (ti === 0 ? 1 - this.tierW : this.tierW) : 1;
      if (wt < 0.002) return;
      const L = T.list;
      if (L.length === 1) { out.push({ e: L[0], w: wt }); return; }
      for (let i = 0; i < L.length; i++) {
        const a = L[i].dir, b = L[(i + 1) % L.length].dir;
        const g = posMod(b - a, TAU) || TAU, d = posMod(this.th - a, TAU);
        if (d <= g + 1e-6) {
          const k = clamp(d / g, 0, 1);
          if (1 - k > 0.002) out.push({ e: L[i], w: wt * (1 - k) });
          if (k > 0.002) out.push({ e: L[(i + 1) % L.length], w: wt * k });
          return;
        }
      }
      out.push({ e: L[0], w: wt });
    });
    let W = 0; for (const x of out) W += x.w; for (const x of out) x.w /= W || 1;
    return out;
  }
  // gait phase + the blended locomotion pose (written into `out`, which holds the idle at weight 1 - moveW)
  pose(dt, out, lx, lz, runSpeed) {
    const a = this.a, rig = a.ch, cfg = this.cfg;
    this.vx = damp(this.vx, lx, 10, dt); this.vz = damp(this.vz, lz, 10, dt);
    const vs = this.vs = Math.hypot(this.vx, this.vz);
    if (vs > 0.25) this.th = Math.atan2(this.vx, this.vz);   // the travel direction is held while nearly still
    // acceleration (start step / stop lean) and the settle dip when a run comes to a stop
    const accel = (vs - this.vsPrev) / Math.max(dt, 1e-3); this.vsPrev = vs;
    this.acc1 = damp(this.acc1, clamp(accel, -30, 30), 10, dt);
    if (a.moveW < 0.04) this.wasStill = true;
    if (this.wasStill && a.moveW > 0.04) { this.wasStill = false; this.ph = Math.floor(this.ph) + 0.78; }   // start step: the first plant comes at once
    if (this.acc1 < -9 && a.moveW > 0.35 && this.dipV === 0 && this.dip < 0.2) this.dipV = 1;
    if (this.dipV) { this.dip += dt / 0.38; if (this.dip >= 1) { this.dip = 0; this.dipV = 0; } }
    this.bodyY = this.dipV ? -0.035 * Math.sin(Math.PI * this.dip) * (1 - 0.4 * this.dip) : 0;
    if (!this.ok || a.moveW < 0.001) return false;
    // a reversal (left -> right, forward -> back) jumps the travel direction: cross-fade from the last pose and feet
    if (this.thPrev !== undefined && Math.abs(wrapAngle(this.th - this.thPrev)) > 0.6 && a.moveW > 0.05) {
      this.accPrev.copy(this.acc); this.xf = 1; this.pcPrev = [this.pMean, this.cMean];
      if (this.ft) this.ftPrev = this.ft.map((f) => ({ ...f }));
    }
    this.thPrev = this.th;
    this.xf = Math.max(0, (this.xf || 0) - dt / 0.2);
    const act = this.pick(dt);
    // cadence: natural cycles per second of the blend, and the stride scale that matches the ground speed
    let fb = 0, Lb = 0, pM = 0, cM = 0;
    const sp = [0, 0], cp = [0, 0];
    for (const { e, w } of act) { fb += w / e.len; Lb += w * e.speed * e.len; sp[0] += w * Math.sin(e.p); sp[1] += w * Math.cos(e.p); cp[0] += w * Math.sin(e.c); cp[1] += w * Math.cos(e.c); }
    pM = Math.atan2(sp[0], sp[1]); cM = Math.atan2(cp[0], cp[1]);
    if (this.xf > 0 && this.pcPrev) { const k = smoothstep(0, 1, this.xf); pM = wrapAngle(pM + wrapAngle(this.pcPrev[0] - pM) * k); cM = wrapAngle(cM + wrapAngle(this.pcPrev[1] - cM) * k); }
    this.pMean = pM; this.cMean = cM;
    let f, s;
    if (cfg.mode === 'glide') { f = fb * (cfg.rate ?? 1.0) * clamp(vs / Math.max(runSpeed, 0.1), 0.55, 1.15); s = cfg.stride ?? 0.55; }
    else {
      const r = clamp(vs / Math.max(Lb * fb, 0.05), cfg.rmin ?? 0.62, cfg.rmax ?? 2.1);
      f = r * fb; s = clamp(vs / Math.max(f * Lb, 0.01), 0.12, 1.35);
    }
    // stopping: finish the step toward the next plant instead of freezing a foot in the air
    if (vs < 0.3 && posMod(this.ph * 2, 1) > 0.06) f = Math.max(f, fb * 0.9);
    this.f = f; this.s = damp(this.s, s, 12, dt);
    const prev = this.ph; this.ph += f * dt;
    if (Math.floor(prev * 2) !== Math.floor(this.ph * 2) && a.moveW > 0.45 && !a.airborne) this.pending = Math.floor(this.ph * 2) & 1 ? 'R' : 'L';
    // blend the clips' poses (phase-synced) and lay them over the idle
    const acc = this.acc, tmp = this.tmp;
    let Wsum = 0;
    for (const { e, w } of act) {
      const t = posMod(this.ph + e.u0, e.cyc) * e.len;
      const dst = Wsum === 0 ? acc : tmp;
      e.sample(t, dst);
      if (e.upperIdle) blendPose(dst, dst, a.idleP, 1, rig.upperMask, rig, 0);
      if (e.upperIdle && this.cal._idleP1) dst.p[1] += (this.cal._idleP1 - e.py) * 0.35;   // the crouched side steps rise to standing height
      if (Wsum > 0) blendPose(acc, acc, tmp, w / (Wsum + w));
      Wsum += w;
    }
    if (cfg.mode !== 'glide') {   // a smoother, more powerful run: part of the clips' vertical bob taken out (the IK keeps the feet down)
      let my = 0; for (const { e, w } of act) my += w * (e.upperIdle ? this.cal._idleP1 : e.py);
      acc.p[1] = my + (acc.p[1] - my) * (cfg.bob ?? 0.7);
    }
    if (cfg.crouch) acc.p[1] -= cfg.crouch * this.unit;
    if (this.xf > 0) blendPose(acc, acc, this.accPrev, smoothstep(0, 1, this.xf), null, rig, smoothstep(0, 1, this.xf));
    if (cfg.mode === 'glide') {
      blendPose(tmp, a.idleP, acc, 1, rig.glideMask, rig, 0);   // (acc itself stays unmasked: the reversal cross-fade snapshots it)
      blendPose(out, out, tmp, a.moveW, null, rig, 0);
    } else blendPose(out, out, acc, a.moveW, null, rig, a.moveW);
    return true;
  }
  // twist, chest stabilisation, lean and style: after the pose is written, before cast twists and glances
  torso(dt, castW) {
    const a = this.a, rig = a.ch, cfg = this.cfg, mw = a.moveW * (1 - a.dashW) * (1 - a.jumpW * 0.6);
    const up = _ra.up, yaw = rig.root.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    // pelvis: a small turn toward the travel (backward travel folds onto the front half)
    const thf = this.thf();
    const gain = lerp(cfg.twistW ?? 0.2, cfg.twistR ?? 0.42, this.tierW), maxT = cfg.maxTwist ?? 30 * DEG;
    this.h = damp(this.h, a.moveW > 0.05 ? clamp(thf * gain, -maxT, maxT) : 0, 6, dt);
    if (mw < 0.002) { this.headRef = this.chestRef = null; return; }
    // the pose's own pelvis / chest yaw: the idle's, moved toward the clips' by how much of them is in the pose
    // (moveW; a glide only keeps part of the clip on the hips and spine)
    const iy = this.cal._idleYaw, gm = cfg.mode === 'glide' ? rig.glideMask : null;
    const mp = mw * (gm ? gm[rig.hipsIndex] : 1), mc = mw * (gm ? gm[rig.index.Spine01] : 1);
    const tw = wrapAngle(this.h - iy.p) * mw - wrapAngle(this.pMean - iy.p) * mp;
    rotateBoneWorld(rig.hips, up, tw);
    rig.hips.updateMatrixWorld(true);
    // the spine brings the chest back onto the aim
    const keep = 1 - castW;
    const counter = (-wrapAngle(iy.c) * mw - wrapAngle(this.cMean - iy.c) * mc - tw) * keep;
    for (const [bn, k] of [['Spine02', 0.4], ['Spine01', 0.35], ['Spine', 0.25]]) { const b = rig.b(bn); rotateBoneWorld(b, up, counter * k); b.updateMatrixWorld(true); }
    // calm: take out part of the run cycle's shoulder swing (low-passed yaw of the shoulder line as reference)
    const calm = (cfg.calm ?? 0.55) * mw * keep;
    if (calm > 0.01) {
      const inv = _lc.m.copy(rig.body.matrixWorld).invert();
      const l = _lc.v.setFromMatrixPosition(rig.b('LeftArm').matrixWorld).applyMatrix4(inv), r = _lc.w.setFromMatrixPosition(rig.b('RightArm').matrixWorld).applyMatrix4(inv);
      const cy = Math.atan2(-(l.z - r.z), l.x - r.x);
      if (this.chestRef === null || this.chestRef === undefined) this.chestRef = cy;
      this.chestRef = dampAngle(this.chestRef, cy, 2.5, dt);
      const b = rig.b('Spine'); rotateBoneWorld(b, up, -wrapAngle(cy - this.chestRef) * calm); b.updateMatrixWorld(true);
    }
    // lean: into the forward / backward motion, only a touch sideways (no full-body sway on a strafe)
    if (this.vs > 0.05) {
      const lx = this.vx / this.vs, lz = this.vz / this.vs;
      const accLean = clamp(this.acc1 * 0.012, -0.07, 0.09) * a.moveW;   // start: leans into the step, stop: rocks back
      const lean = (cfg.lean ?? 6 * DEG) * mw + accLean;
      const sx = lx * (cfg.side ?? 0.3), sz = lz;   // local, sideways part damped
      const wx = sx * cs + sz * sn, wz = -sx * sn + sz * cs;
      rotateBoneWorld(rig.hips, _lc.t.set(wz, 0, -wx), lean);
    }
    const fwd = _lc.p.set(sn, 0, cs), right = _lc.w.set(-cs, 0, sn);
    // upright: the head's side-to-side sway (a strut's catwalk roll) is rolled back out at the lower spine
    const upr = (cfg.upright ?? 0.5) * mw * keep;
    if (upr > 0.01) {
      rig.root.updateMatrixWorld(true);
      const hx = _lc.t.setFromMatrixPosition(rig.b('Head').matrixWorld).sub(rig.root.position).dot(_lc.v.set(cs, 0, -sn));   // + = his left
      if (this.headRef === null || this.headRef === undefined) this.headRef = hx;
      this.headRef = damp(this.headRef, hx, 2, dt);
      rotateBoneWorld(rig.b('Spine02'), fwd, Math.atan2(hx - this.headRef, 0.6) * upr); rig.b('Spine02').updateMatrixWorld(true);
    }
    // style: Bacchus' waddle (rocks onto the planted foot) and belly bounce; Ra's proud chest
    if (cfg.waddle) {
      const rock = cfg.waddle * Math.sin(TAU * this.ph) * mw;
      rotateBoneWorld(rig.hips, fwd, -rock); rig.hips.updateMatrixWorld(true);
      rotateBoneWorld(rig.b('Spine01'), fwd, rock * 0.55);
    }
    if (cfg.belly) rotateBoneWorld(rig.b('Spine02'), right, cfg.belly * Math.sin(2 * TAU * this.ph - 0.7) * mw);
    if (cfg.chestUp) rotateBoneWorld(rig.b('Spine'), right, cfg.chestUp * a.moveW);
    rig.root.updateMatrixWorld(true);
  }
  // legs: two-bone IK onto the warped, speed-matched foot paths
  feet(w) {
    const a = this.a, rig = a.ch, cfg = this.cfg;
    const root = rig.root;
    if (Math.abs(root.rotation.x) > 0.05 || Math.abs(root.rotation.z) > 0.05 || Math.abs(root.scale.y - 1) > 0.02) w = 0;
    w *= cfg.ik ?? 1;
    if (w > 0.01 && this.active.length) {
      root.updateMatrixWorld(true);
      const s = this.s, liftK = cfg.mode === 'glide' ? (cfg.lift ?? 0.6) : clamp(0.45 + 0.6 * s, 0.45, 1.05) * (cfg.lift ?? 1);
      const width = cfg.width ?? 1, stag = (cfg.stagger ?? 0.18) * Math.sin(this.th), bm = rig.body.matrixWorld;
      this.knee = this.h + 0.35 * wrapAngle(this.thf() - this.h);
      const F = this.ft || (this.ft = [0, 1].map(() => ({ x: 0, y: 0, z: 0, ox: 0, oz: 0, la: 0, lt: 0 })));
      for (let side = 0; side < 2; side++) {
        let tx = 0, ty = 0, tz = 0, ox = 0, oz = 0, la = 0, lt = 0;   // ankle target, toe offset from it, ankle / toe lift
        for (const { e, w: wi } of this.active) {
          const x = (posMod(this.ph + e.u0, e.cyc) / e.cyc) * e.ns, i = Math.floor(x), fr = x - i, i1 = Math.min(i + 1, e.ns), R = e.rows, T = e.trows, o = side * 3;
          const at = (A, c) => lerp(A[i * 6 + o + c], A[i1 * 6 + o + c], fr);
          const px = at(R, 0), py = at(R, 1), pz = at(R, 2);
          const nx = side ? e.nr[0] : e.nl[0], nz = side ? e.nr[1] : e.nl[1], g = e.gnd[side];
          const lift = Math.max(0, py - g), liftT = Math.max(0, at(T, 1) - e.gT[side]);
          // stride: onto the travel direction (a high back-kick is turned only half way: no sideways flamingo fold)
          const warp = wrapAngle(this.th - e.dir) * lerp(1, 0.5, smoothstep(0.1, 0.4, lift));
          const dx = (px - nx) * s, dz = (pz - nz) * s, cw = Math.cos(warp), sw = Math.sin(warp);
          // neutral stance: turns a third of the way with the pelvis (its own pelvis yaw -> ours), width per god;
          // forward / back strides turned sideways get the lead foot ahead and the trailing one behind (it crosses behind)
          const side_ = Math.abs(Math.sin(e.dir)) > 0.5, wk = side_ ? Math.max(1, width) : width;   // (a narrow track is for running, not for side steps)
          const rn = (this.h - e.p) * 0.35, cn = Math.cos(rn), snn = Math.sin(rn), wx0 = (side ? -1 : 1) * Math.max((side ? -nx : nx) * wk, cfg.halfW ?? 0.06);
          if (!side_) tz += wi * stag * (side ? -1 : 1);
          tx += wi * (wx0 * cn + nz * snn + dx * cw + dz * sw);
          tz += wi * (-wx0 * snn + nz * cn - dx * sw + dz * cw);
          ty += wi * (g + lift * liftK);
          const fx = at(T, 0) - px, fz = at(T, 2) - pz;   // the toe, relative to the ankle, turned the same way
          ox += wi * (fx * cw + fz * sw); oz += wi * (-fx * sw + fz * cw);
          la += wi * lift; lt += wi * liftT;
        }
        Object.assign(F[side], { x: tx, y: ty, z: tz, ox, oz, la, lt });
      }
      if (this.xf > 0 && this.ftPrev) {   // (the reversal's cross-fade)
        const k = smoothstep(0, 1, this.xf);
        for (let sd = 0; sd < 2; sd++) for (const key of ['x', 'y', 'z', 'ox', 'oz', 'la', 'lt']) F[sd][key] = lerp(F[sd][key], this.ftPrev[sd][key], k);
      }
      // the feet never pass through each other: keep them apart across the travel line (the lifted foot gives way)
      const minGap = cfg.gap ?? 0.17, gx = F[0].x - F[1].x, gz = F[0].z - F[1].z, gd = Math.hypot(gx, gz);
      if (gd < minGap) {
        const nx = Math.cos(this.th), nz = -Math.sin(this.th);   // across the travel, toward his left when moving forward
        let sgn = Math.sign(gx * nx + gz * nz) || 1;
        const push = minGap - gd, k0 = F[0].la > F[1].la ? 0.75 : 0.25;
        F[0].x += nx * sgn * push * k0; F[0].z += nz * sgn * push * k0; F[1].x -= nx * sgn * push * (1 - k0); F[1].z -= nz * sgn * push * (1 - k0);
      }
      const spread = 0.15 + 0.12 * Math.abs(Math.sin(this.th));
      for (let side = 0; side < 2; side++) {
        const ky = this.knee + (side ? -spread : spread);   // knees a little apart (more on a strafe)
        const pole = _lc.p.set(Math.sin(ky), -0.15, Math.cos(ky)).applyQuaternion(root.quaternion);
        const { x: tx, z: tz, ox, oz, la, lt } = F[side];
        const target = _lc.t.set(tx, F[side].y, tz).applyMatrix4(bm);
        // foot lock: the point that carries the weight (heel / ankle, then the toe as the heel comes up) holds its
        // spot on the ground from touchdown (the clip's stance speed is not quite even) and lets go as the foot
        // lifts; at once if the body has moved too far from it (sharp turns, stops)
        const L = this.lock[side];
        const down = Math.min(la, lt);
        if (down < 0.03 && cfg.mode !== 'glide') {
          const toe = lt < la;
          // the contact point in world space (toe = ankle + the turned toe offset, in body axes)
          const c = _lc.w.set(tx + (toe ? ox : 0), 0, tz + (toe ? oz : 0)).applyMatrix4(bm);
          if (!L.on && down < 0.015) { L.on = true; L.toe = toe; L.p.set(c.x, 0, c.z); }
          if (L.on) {
            if (L.toe !== toe) { L.p.x = c.x + L.ox; L.p.z = c.z + L.oz; L.toe = toe; }   // heel -> toe: carry the offset over
            L.ox = L.p.x - c.x; L.oz = L.p.z - c.z;
            if (L.ox * L.ox + L.oz * L.oz > 0.09) L.on = false;
            else { const k = 1 - smoothstep(0.015, 0.03, down); target.x += L.ox * k; target.z += L.oz * k; }
          }
        } else L.on = false;
        const up = rig.b(side ? 'RightUpLeg' : 'LeftUpLeg'), lo = rig.b(side ? 'RightLeg' : 'LeftLeg'), ft = rig.b(side ? 'RightFoot' : 'LeftFoot');
        solveTwoBoneIK(up, lo, ft, target, pole, w);
        if (this.dbg) this.dbg[side] = target.clone();   // (tools/node/loco_sim.mjs)
      }
    }
    if (this.pending) {
      const side = this.pending; this.pending = null;
      const p = _lc.v.setFromMatrixPosition(rig.b(side === 'L' ? 'LeftFoot' : 'RightFoot').matrixWorld);
      a.footfall(side, p);
    }
  }
  // the travel direction folded onto the front half (backing up turns the pelvis toward the travel's opposite),
  // with hysteresis around the pure sideways direction (no flip-flop of the pelvis on a strafe)
  thf() {
    const ab = Math.abs(this.th);
    if (ab > Math.PI / 2 - 0.15) this.backHalf = true; else if (ab < Math.PI / 2 - 0.45) this.backHalf = false;   // (a pure strafe opens the pelvis away from the travel: the crossing legs keep apart)
    return this.backHalf ? wrapAngle(this.th - Math.PI) : this.th;
  }
}

// ---------------------------------------------------------------------------
// LocoFX: lore footprints and motes, subtle and cheap. Footprints are pooled instanced quads (one draw call
// per kind, fixed size), fading by instance colour under additive blending; motes reuse the VFX particles.
// ---------------------------------------------------------------------------
const LocoFX = {
  pools: {}, lastT: 0,
  tex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    if (kind === 'splat') {   // a wine drop: a round splash with a few droplets
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 20); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 20, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (const [x, y, r] of [[52, 22, 4], [14, 44, 3], [46, 50, 2.5], [18, 16, 2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    } else {                  // a footprint: sole + heel + toe pad, soft edged (toes toward +y of the texture)
      g.filter = 'blur(1.5px)';
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.ellipse(32, 24, 11, 15, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(32, 46, 8, 9, 0, 0, TAU); g.fill();
      if (kind === 'frost') { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const an = i / 7 * TAU; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(an) * 28, 32 + Math.sin(an) * 28); g.stroke(); } }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  },
  pool(kind) {
    if (this.pools[kind]) return this.pools[kind];
    const N = 28, geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: this.tex(kind === 'wine' ? 'splat' : kind), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.userData.fx = true;
    const col = new THREE.Color(0, 0, 0);
    for (let i = 0; i < N; i++) { mesh.setMatrixAt(i, _lc.m.makeScale(0, 0, 0)); mesh.setColorAt(i, col); }
    scene.add(mesh);
    return (this.pools[kind] = { mesh, N, next: 0, items: Array.from({ length: N }, () => ({ t: 0, life: 0, c: new THREE.Color() })) });
  },
  print(kind, pos, yaw, size, color, life) {
    const P = this.pool(kind), i = P.next; P.next = (P.next + 1) % P.N;
    const it = P.items[i]; it.t = 0; it.life = life; it.c.copy(color);
    _lc.q.setFromAxisAngle(_ra.up, yaw + Math.PI);   // (the texture's toes run along the quad's -z)
    P.mesh.setMatrixAt(i, _lc.m.compose(_lc.v.set(pos.x, 0.025 + i * 0.0004, pos.z), _lc.q, _lc.w.set(size * 0.62, 1, size)));
    P.mesh.instanceMatrix.needsUpdate = true;
  },
  update() {
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastT) / 1000);
    if (dt < 0.008) return;   // (animators call this every frame; run it once)
    this.lastT = now;
    for (const P of Object.values(this.pools)) {
      let any = false;
      P.items.forEach((it, i) => {
        if (it.life <= 0) return;
        it.t += dt; any = true;
        const k = it.t / it.life;
        const a = k >= 1 ? 0 : Math.min(1, it.t / 0.08) * (1 - smoothstep(0.35, 1, k));
        P.mesh.setColorAt(i, _lc.p.set(it.c.r * a, it.c.g * a, it.c.b * a));
        if (k >= 1) { it.life = 0; P.mesh.setMatrixAt(i, _lc.m.makeScale(0, 0, 0)); P.mesh.instanceMatrix.needsUpdate = true; }
      });
      if (any && P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
    }
  },
  // a footfall: the god's own mark on the ground
  step(anim, side, p) {
    const kind = anim.cfg.loco.fx, k = anim.fxK, rig = anim.ch, yaw = rig.root.rotation.y + (anim.loco ? anim.loco.knee : 0);
    if (!kind || Math.random() > k + 0.15) return;
    const sideOff = side === 'L' ? 1 : -1;
    if (kind === 'frost') {   // Skadi: a frost print that rimes over and fades, and a little kick of snow
      this.print('frost', p, yaw, 0.36, new THREE.Color(0.18, 0.55, 1.0).multiplyScalar(0.9), 2.6);
      for (let i = 0; i < 3; i++) VFX.add.spawn({ pos: V3(p.x + rand(-0.08, 0.08), 0.06, p.z + rand(-0.08, 0.08)), vel: V3(rand(-0.6, 0.6), rand(0.5, 1.3), rand(-0.6, 0.6)), life: rand(0.4, 0.7), size: rand(0.03, 0.05), sizeEnd: 0.01, color: new THREE.Color(0.45, 0.78, 1.0), intensity: 1.6, cell: FX.dot, drag: 2.5, gravity: -3 });
      VFX.smoke.spawn({ pos: V3(p.x, 0.07, p.z), vel: V3(rand(-0.3, 0.3), 0.25, rand(-0.3, 0.3)), life: 0.6, size: 0.16, sizeEnd: 0.38, color: new THREE.Color(0.62, 0.78, 0.95), alpha: 0.22, alphaEnd: 0, cell: FX.smoke, drag: 2 });
    } else if (kind === 'sand') {   // Bastet: a soft puff of desert sand off a light, padded step
      for (let i = 0; i < 2; i++) VFX.smoke.spawn({ pos: V3(p.x + rand(-0.08, 0.08), 0.06, p.z + rand(-0.08, 0.08)), vel: V3(rand(-0.4, 0.4), rand(0.15, 0.45), rand(-0.4, 0.4)), life: rand(0.5, 0.8), size: rand(0.14, 0.22), sizeEnd: 0.45, color: new THREE.Color(0.78, 0.58, 0.32), alpha: 0.26, alphaEnd: 0, cell: FX.smoke, drag: 2.2 });
      if (Math.random() < 0.5) VFX.add.spawn({ pos: V3(p.x, 0.08, p.z), vel: V3(rand(-0.3, 0.3), rand(0.4, 0.8), rand(-0.3, 0.3)), life: 0.5, size: 0.035, sizeEnd: 0.005, color: new THREE.Color(1.0, 0.7, 0.2), intensity: 2, cell: FX.ember, drag: 1.5, gravity: -1.5 });
    } else if (kind === 'ember') {   // Ra: a sun-scorched print, embers lifting off it
      this.print('ember', p, yaw, 0.38, new THREE.Color(1.0, 0.42, 0.06), 1.8);
      for (let i = 0; i < 2; i++) VFX.add.spawn({ pos: V3(p.x + rand(-0.06, 0.06), 0.05, p.z + rand(-0.06, 0.06)), vel: V3(rand(-0.15, 0.15), rand(0.5, 1.0), rand(-0.15, 0.15)), life: rand(0.6, 1.0), size: rand(0.03, 0.05), sizeEnd: 0.005, color: new THREE.Color(1.0, 0.55, 0.1), intensity: 2.4, cell: FX.ember, drag: 1.2 });
    } else if (kind === 'crumb') {   // Cookie Monster: a heavy, dark print, cookie crumbs bouncing off it, a little dust
      this.print('crumb', p, yaw, 0.46, new THREE.Color(0.32, 0.14, 0.03), 2.4);
      for (let i = 0; i < 4; i++) VFX.add.spawn({ pos: V3(p.x + rand(-0.1, 0.1), 0.08, p.z + rand(-0.1, 0.1)), vel: V3(rand(-0.8, 0.8), rand(0.8, 1.8), rand(-0.8, 0.8)), life: rand(0.5, 0.8), size: rand(0.03, 0.05), sizeEnd: 0.02, color: new THREE.Color(0.7, 0.38, 0.1), intensity: 0.9, cell: FX.dot, drag: 1.5, gravity: -9 });
      VFX.smoke.spawn({ pos: V3(p.x, 0.07, p.z), vel: V3(rand(-0.3, 0.3), 0.3, rand(-0.3, 0.3)), life: 0.7, size: 0.2, sizeEnd: 0.5, color: new THREE.Color(0.5, 0.36, 0.22), alpha: 0.25, alphaEnd: 0, cell: FX.smoke, drag: 2 });
    } else if (kind === 'wine') {   // Bacchus: now and then a drop of wine spills from the jug and splats
      if (Math.random() < 0.3) {
        const src = rig.prop ? rig.prop.localToWorld(_lc.w.set(0, 0.25, 0)) : _lc.w.copy(p).setY(1.1);
        const at = V3(p.x - sideOff * 0.15, 0, p.z);
        VFX.add.spawn({ pos: src.clone(), vel: V3(rand(-0.2, 0.2), -0.5, rand(-0.2, 0.2)), life: 0.45, size: 0.045, sizeEnd: 0.03, color: new THREE.Color(0.75, 0.03, 0.32), intensity: 1.3, cell: FX.dot, gravity: -9 });
        VFX.later(0.4, () => this.print('wine', at, rand(0, TAU), 0.3, new THREE.Color(0.55, 0.02, 0.24), 2.2));
      }
    }
  },
  // continuous motes while moving (per second rates; the Arena bots' fxK thins them out)
  trail(anim, dt) {
    const kind = anim.cfg.loco.fx, mw = anim.moveW, k = anim.fxK, rig = anim.ch;
    if (!kind) return false;
    const foot = () => _lc.v.setFromMatrixPosition(rig.b(Math.random() < 0.5 ? 'LeftFoot' : 'RightFoot').matrixWorld);
    const back = (s) => _lc.w.copy(anim.rootVel).multiplyScalar(-s);
    anim.locoMoteT = (anim.locoMoteT || 0) + dt;
    const due = (rate) => { if (rate <= 0.01) { anim.locoMoteT = 0; return 0; } anim.locoMoteT = Math.min(anim.locoMoteT, 3 / rate); const n = Math.floor(anim.locoMoteT * rate); anim.locoMoteT -= n / rate; return n; };
    if (kind === 'glyph') {   // Thoth: golden-blue glyph motes drift up behind his feet as he glides
      const n = due(mw > 0.2 ? 9 * mw * k : 0);
      for (let i = 0; i < n; i++) {
        const p = foot(); p.y = Math.max(0.08, p.y - 0.02);
        const gold = Math.random() < 0.45;
        VFX.glyphs.spawn({ pos: p.clone().add(back(0.06)), vel: V3(rand(-0.12, 0.12), rand(0.25, 0.55), rand(-0.12, 0.12)).add(back(0.08)), life: rand(0.9, 1.4), size: rand(0.07, 0.11), sizeEnd: 0.02,
          color: gold ? COL.gold : COL.glyph, intensity: 1.7, cell: VFX.glyphCell(), rot: 0, wobble: 0.5 });
      }
      return true;
    }
    if (kind === 'mist') {    // Hecate: dark mist pooling at her hem, a violet or green spark now and then
      const n = due((3 + 9 * mw) * k);
      for (let i = 0; i < n; i++) {
        const p = foot(); p.y = Math.max(0.06, p.y - 0.05);
        VFX.smoke.spawn({ pos: p.clone().add(V3(rand(-0.15, 0.15), 0, rand(-0.15, 0.15))), vel: V3(rand(-0.2, 0.2), rand(0.05, 0.25), rand(-0.2, 0.2)).add(back(0.1)), life: rand(0.9, 1.4), size: rand(0.25, 0.4), sizeEnd: 0.7, color: new THREE.Color(0.1, 0.02, 0.16), alpha: 0.42, alphaEnd: 0, cell: FX.smoke, drag: 1.2 });
        if (Math.random() < 0.25) VFX.add.spawn({ pos: p.clone(), vel: V3(rand(-0.2, 0.2), rand(0.2, 0.5), rand(-0.2, 0.2)), life: rand(0.5, 0.8), size: 0.04, sizeEnd: 0.005, color: Math.random() < 0.6 ? new THREE.Color(0.5, 0.15, 1.0) : new THREE.Color(0.2, 1.0, 0.4), intensity: 2.2, cell: FX.ember, drag: 1 });
      }
      return true;
    }
    if (kind === 'ember') {   // Ra: a faint shimmer of sun-motes at his feet
      const n = due(mw > 0.2 ? 4 * mw * k : 0);
      for (let i = 0; i < n; i++) { const p = foot(); VFX.add.spawn({ pos: p.clone(), vel: V3(rand(-0.15, 0.15), rand(0.3, 0.7), rand(-0.15, 0.15)), life: rand(0.5, 0.9), size: rand(0.025, 0.045), sizeEnd: 0.005, color: new THREE.Color(1.0, 0.6, 0.12), intensity: 2.2, cell: FX.ember, drag: 1.2 }); }
      return true;
    }
    if (kind === 'leaf') {    // Ullr: green leaves and the odd rune mote whirl up in a hunter's wake
      const n = due(mw > 0.3 ? 5 * mw * k : 0);
      for (let i = 0; i < n; i++) {
        const p = foot(); p.y = 0.15;
        if (Math.random() < 0.75) VFX.add.spawn({ pos: p.clone().add(back(0.05)), vel: V3(rand(-0.4, 0.4), rand(0.4, 0.9), rand(-0.4, 0.4)), life: rand(0.7, 1.1), size: rand(0.05, 0.08), sizeEnd: 0.03, color: Math.random() < 0.7 ? new THREE.Color(0.08, 0.62, 0.22) : new THREE.Color(0.45, 0.7, 0.08), intensity: 1.3, cell: FX.petal, drag: 1.6, gravity: -0.6, rotVel: rand(-6, 6) });
        else VFX.glyphs.spawn({ pos: p.clone().setY(0.3), vel: V3(rand(-0.1, 0.1), rand(0.3, 0.5), rand(-0.1, 0.1)), life: 0.9, size: 0.08, sizeEnd: 0.02, color: new THREE.Color(0.1, 0.85, 0.42), intensity: 1.8, cell: VFX.glyphCell(), rot: 0 });
      }
      return true;
    }
    return kind === 'frost' || kind === 'sand' || kind === 'wine' || kind === 'crumb';   // (these mark the ground on each step instead)
  },
};

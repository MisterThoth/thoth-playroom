// ============================================================================
// Procedural animation: locomotion, idle, casts, ult channel, cloth + kilt,
// fingers, beak and the floating book.
// ============================================================================
const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'clavR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
  'wristL', 'wristR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
const UPPER = new Set(['spine', 'chest', 'neck', 'head', 'clavL', 'clavR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR']);
const LOWER = new Set(['hips', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']);

class Pose {
  constructor() { this.r = {}; for (const j of JOINTS) this.r[j] = [0, 0, 0]; this.reset(); }
  reset() { for (const j of JOINTS) { const a = this.r[j]; a[0] = a[1] = a[2] = 0; } this.bodyY = 0; this.curlL = 0.35; this.curlR = 0.4; this.jaw = 0; return this; }
  copy(o) { for (const j of JOINTS) { const a = this.r[j], b = o.r[j]; a[0] = b[0]; a[1] = b[1]; a[2] = b[2]; } this.bodyY = o.bodyY; this.curlL = o.curlL; this.curlR = o.curlR; this.jaw = o.jaw; return this; }
  add(j, x, y, z, w = 1) { const a = this.r[j]; a[0] += x * w; a[1] += y * w; a[2] += z * w; }
  set(j, x, y, z) { const a = this.r[j]; a[0] = x; a[1] = y; a[2] = z; }
  side(j, s, x, y, z, w = 1) { const k = s === 'L' ? 1 : -1; this.add(j + s, x, y * k, z * k, w); }
  setSide(j, s, x, y, z) { const k = s === 'L' ? 1 : -1; this.set(j + s, x, y * k, z * k); }
  blend(o, w, mask = null) {
    if (w <= 0) return;
    for (const j of JOINTS) {
      if (mask && !mask.has(j)) continue;
      const a = this.r[j], b = o.r[j];
      a[0] = lerp(a[0], b[0], w); a[1] = lerp(a[1], b[1], w); a[2] = lerp(a[2], b[2], w);
    }
    if (!mask || mask === UPPER) { this.curlL = lerp(this.curlL, o.curlL, w); this.curlR = lerp(this.curlR, o.curlR, w); this.jaw = lerp(this.jaw, o.jaw, w); }
    if (!mask) this.bodyY = lerp(this.bodyY, o.bodyY, w);
  }
}

// Overlay actions: fn(p, t, act) writes target offsets (t normalised 0..1)
const ACTIONS = {
  throw: {
    dur: 0.42, mask: UPPER, ain: 0.14, aout: 0.38,
    fn(p, t) {
      const k = smoothstep(0.12, 0.42, t);
      p.setSide('shoulder', 'R', lerp(-0.85, -1.55, k), lerp(0.35, 0.0, k), lerp(0.55, 0.12, k));
      p.setSide('elbow', 'R', lerp(-1.55, -0.12, k), 0, 0);
      p.setSide('wrist', 'R', lerp(0.3, -0.25, k), lerp(-0.6, 0.0, k), 0);
      p.add('chest', 0.03, lerp(-0.2, 0.24, k), 0);
      p.add('spine', 0.05 * k, lerp(-0.05, 0.08, k), 0);
      p.curlR = lerp(0.65, -0.3, k);
    },
  },
  empower: {
    dur: 0.5, mask: UPPER, ain: 0.12, aout: 0.35,
    fn(p, t) {
      const k = smoothstep(0.15, 0.45, t);
      p.setSide('shoulder', 'R', lerp(-0.6, -1.6, k), lerp(0.5, 0.0, k), lerp(0.85, 0.1, k));
      p.setSide('elbow', 'R', lerp(-1.7, -0.05, k), 0, 0);
      p.setSide('wrist', 'R', lerp(0.4, -0.3, k), 0, 0);
      p.add('chest', 0.05, lerp(-0.35, 0.32, k), 0);
      p.add('spine', 0.1 * k, lerp(-0.1, 0.12, k), 0);
      p.curlR = lerp(0.7, -0.35, k);
    },
  },
  conjure: {
    dur: 0.62, mask: UPPER, ain: 0.18, aout: 0.32,
    fn(p, t) {
      const k = smoothstep(0.05, 0.4, t);
      p.setSide('shoulder', 'R', lerp(-0.4, -2.75, k), 0.1, lerp(0.2, 0.28, k));
      p.setSide('elbow', 'R', lerp(-1.2, -0.35, k), 0, 0);
      p.setSide('wrist', 'R', -0.3, 0.4, 0);
      p.add('head', -0.28 * k, -0.12 * k, 0.08 * k);
      p.add('chest', -0.08 * k, -0.1 * k, 0.04 * k);
      p.curlR = lerp(0.5, -0.35, k);
      p.jaw = 0.12 * bell(t, 0.2, 0.8);
    },
  },
  glyph: {
    dur: 0.62, mask: UPPER, ain: 0.15, aout: 0.35,
    fn(p, t) {
      const k = smoothstep(0.05, 0.45, t);
      p.setSide('shoulder', 'L', lerp(-0.5, -1.3, k), 0.0, lerp(0.15, 0.08, k));
      p.setSide('elbow', 'L', lerp(-1.3, -0.4, k), 0, 0);
      p.setSide('shoulder', 'R', lerp(-0.9, -1.25, k), 0.1, lerp(1.0, 0.15, k));
      p.setSide('elbow', 'R', -0.45, 0, 0);
      p.add('chest', 0.06 * k, lerp(-0.15, 0.18, k), 0);
      p.curlR = lerp(0.4, -0.3, k);
    },
  },
  dash: {
    dur: 0.3, mask: null, ain: 0.12, aout: 0.35,
    fn(p, t, a) {
      const dx = a.dx || 0, dz = a.dz ?? 1;
      p.add('spine', 0.32 * dz, 0, -0.32 * dx);
      p.add('chest', 0.1 * dz, 0, -0.1 * dx);
      p.setSide('thigh', 'L', -0.75, 0, 0.05); p.setSide('thigh', 'R', -0.25, 0, 0.05);
      p.setSide('knee', 'L', 1.35, 0, 0); p.setSide('knee', 'R', 0.85, 0, 0);
      p.setSide('ankle', 'L', 0.5, 0, 0); p.setSide('ankle', 'R', 0.4, 0, 0);
      for (const s of ['L', 'R']) { p.setSide('shoulder', s, 0.75, 0, 0.45); p.setSide('elbow', s, -0.35, 0, 0); }
      p.bodyY = 0.16 * Math.sin(Math.PI * t);
    },
  },
  laugh: {
    dur: 2.1, mask: UPPER, ain: 0.08, aout: 0.12,
    fn(p, t) {
      const b = Math.sin(t * 2.1 * 26);
      p.add('head', -0.42 + b * 0.16, 0, 0.05 * Math.sin(t * 9));
      p.add('neck', -0.12, 0, 0);
      p.add('chest', -0.14 + b * 0.04, 0, 0);
      p.setSide('shoulder', 'R', -0.45, -0.2, 0.05); p.setSide('elbow', 'R', -1.75, 0, 0);
      p.setSide('shoulder', 'L', -0.95, 0.2, 0.32); p.setSide('elbow', 'L', -1.0, 0, 0);
      p.jaw = 0.28 + 0.22 * Math.abs(b);
      p.curlR = 0.55;
    },
  },
  judgement: {
    dur: 0.55, mask: UPPER, ain: 0.08, aout: 0.45,
    fn(p, t) {
      const k = smoothstep(0, 0.25, t);
      for (const s of ['L', 'R']) { p.setSide('shoulder', s, -1.5, 0, 0.14); p.setSide('elbow', s, -0.06, 0, 0); p.setSide('wrist', s, -0.5, 0, 0); }
      p.add('chest', 0.18 * k, 0, 0);
      p.add('spine', 0.1 * k, 0, 0);
      p.curlL = p.curlR = -0.35;
      p.jaw = 0.3 * bell(t, 0, 0.7);
    },
  },
  land: {
    dur: 0.24, mask: LOWER, ain: 0.05, aout: 0.6,
    fn(p) {
      for (const s of ['L', 'R']) { p.setSide('thigh', s, -0.55, 0, 0.06); p.setSide('knee', s, 1.0, 0, 0); p.setSide('ankle', s, -0.45, 0, 0); }
      p.add('hips', 0.12, 0, 0);
    },
  },
};

class Animator {
  constructor(ch, book = null) {
    this.ch = ch; this.book = book;
    this.t = 0; this.phase = 0; this.dir = 1;
    this.speedNorm = 0; this.hipYaw = 0;
    this.moveLocal = new THREE.Vector3();
    this.airborne = false; this.vy = 0;
    this.actions = [];
    this.channel = 0; this.channelTarget = 0; this.pulse = 0;
    this.aimPitch = 0;
    this.glance = { t: 1.5, x: 0, y: 0, z: 0, cx: 0, cy: 0, cz: 0 };
    this.pose = new Pose(); this.tmp = new Pose();
    this.curl = { L: 0.35, R: 0.4 }; this.jaw = 0;
    this.prevRootPos = new THREE.Vector3(); this.rootVel = new THREE.Vector3(); this.firstFrame = true;
    this.bookMode = 'hand'; this.bookFloat = 0; this.bookFloatTarget = 0;
    this.bookAnchor = new THREE.Object3D();
    if (ch.parts.palmL) {
      ch.parts.palmL.add(this.bookAnchor);
      this.bookAnchor.position.set(-0.14, -0.03, 0.0);
      this.bookAnchor.rotation.set(0, -Math.PI / 2, -Math.PI / 2, 'YXZ');
    }
    this.eyeGlow = 0;
  }
  play(name, opts = {}) {
    const def = ACTIONS[name];
    if (!def) return;
    const dur = opts.dur ?? def.dur;
    // restart the same action instead of stacking it
    this.actions = this.actions.filter((a) => a.name !== name);
    this.actions.push({ name, def, t: 0, dur, ...opts });
  }
  stop(name) { this.actions = this.actions.filter((a) => a.name !== name); }
  isPlaying(name) { return this.actions.some((a) => a.name === name); }

  update(dt, ctx) {
    const ch = this.ch;
    this.t += dt;
    // root velocity (world) -> local movement
    const rp = ch.root.position;
    if (this.firstFrame) { this.prevRootPos.copy(rp); this.firstFrame = false; }
    this.rootVel.copy(rp).sub(this.prevRootPos).divideScalar(Math.max(dt, 1e-4));
    this.prevRootPos.copy(rp);
    const yaw = ch.root.rotation.y;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const vx = ctx.vel ? ctx.vel.x : this.rootVel.x, vz = ctx.vel ? ctx.vel.z : this.rootVel.z;
    // local: x = character left (+X), z = forward
    const lx = vx * cs - vz * sn, lz = vx * sn + vz * cs;
    this.moveLocal.set(lx, 0, lz);
    const speed = Math.hypot(lx, lz);
    const runSpeed = ctx.runSpeed || 6.4;
    this.speedNorm = damp(this.speedNorm, clamp(speed / runSpeed, 0, 1.25), 10, dt);
    this.airborne = !!ctx.airborne; this.vy = ctx.vy || 0;
    this.aimPitch = damp(this.aimPitch, ctx.aimPitch || 0, 8, dt);
    this.channel = damp(this.channel, this.channelTarget, 5, dt);
    this.pulse = Math.max(0, this.pulse - dt * 3);

    // strafe / backpedal: lower body turns toward travel
    let hipT = 0, dir = 1;
    if (speed > 0.6) {
      const a = Math.atan2(lx, lz);
      if (Math.abs(a) <= 1.75) hipT = clamp(a, -0.95, 0.95) * 0.75;
      else { hipT = clamp(wrapAngle(a - Math.PI), -0.95, 0.95) * 0.75; dir = -1; }
    }
    this.hipYaw = damp(this.hipYaw, hipT, 9, dt);
    if (dir !== this.dir && speed > 0.6) this.dir = dir;
    const stride = 3.4;
    this.phase += (speed / stride) * TAU * dt * this.dir;

    const p = this.pose.reset();
    this.buildBase(p, dt);
    // ult channel override
    if (this.channel > 0.001) { this.tmp.copy(p); this.buildChannel(this.tmp); p.blend(this.tmp, smoothstep(0, 1, this.channel)); }
    // overlay actions
    for (const a of this.actions) {
      a.t += dt;
      const tn = clamp(a.t / a.dur, 0, 1);
      this.tmp.copy(p);
      a.def.fn(this.tmp, tn, a);
      const w = envelope(tn, a.def.ain, a.def.aout) * (a.weight ?? 1);
      p.blend(this.tmp, w, a.def.mask);
      if (a.def.mask === UPPER || a.def.mask === null) { /* curls blended in blend() */ }
    }
    this.actions = this.actions.filter((a) => a.t < a.dur);
    this.apply(p, dt);
    this.updateKilt(dt);
    this.updateTails(dt);
    this.updateBook(dt, ctx);
    // eyes
    this.eyeGlow = damp(this.eyeGlow, ctx.eyeBoost || 0, 6, dt);
    if (ch.kind === 'thoth') M.eye.emissiveIntensity = 1.9 + Math.sin(this.t * 2.2) * 0.3 + this.eyeGlow * 3.5;
  }

  buildBase(p, dt) {
    const s = clamp(this.speedNorm, 0, 1.2);
    const t = this.t, ph = this.phase;
    const br = Math.sin(t * 1.7);
    const idle = 1 - clamp(s * 1.6, 0, 1);
    // ---- idle (weighted by idle)
    p.add('spine', 0.035 + br * 0.012, 0, 0.02 * Math.sin(t * 0.6), idle);
    p.add('chest', -0.03 + br * 0.02, 0.04 * Math.sin(t * 0.5), 0, idle);
    p.add('hips', 0, 0, 0.025 * Math.sin(t * 0.6), idle);
    for (const sd of ['L', 'R']) {
      const k = sd === 'L' ? 1 : -1;
      p.side('thigh', sd, -0.06, 0.05, 0.035 - 0.02 * k * Math.sin(t * 0.6), idle);
      p.side('knee', sd, 0.12, 0, 0, idle);
      p.side('ankle', sd, -0.06, 0, -0.02, idle);
      p.side('clav', sd, 0, 0, br * 0.012, idle);
    }
    p.bodyY -= 0.012 * idle;
    // arms (always): right relaxed, left carries the book
    p.side('shoulder', 'R', -0.12, 0.15, -0.08);
    p.side('elbow', 'R', -0.38 - 0.04 * br, 0, 0);
    p.side('wrist', 'R', 0.1, -0.2, 0);
    p.side('shoulder', 'L', -0.32, 0.25, 0.26);
    p.side('elbow', 'L', -1.42, 0, 0);
    p.side('wrist', 'L', -0.2, -1.35, 0.1);
    // ---- run cycle
    if (s > 0.01) {
      const w = clamp(s, 0, 1);
      const sL = Math.sin(ph), cL = Math.cos(ph), sR = -sL, cR = -cL;
      const amp = 0.7 * clamp(s, 0.4, 1.15);
      p.side('thigh', 'L', -amp * sL + 0.05, 0, 0.02, w);
      p.side('thigh', 'R', -amp * sR + 0.05, 0, 0.02, w);
      p.side('knee', 'L', 0.2 + 1.1 * Math.pow(Math.max(0, cL), 1.4) + 0.3 * Math.max(0, -sL), 0, 0, w);
      p.side('knee', 'R', 0.2 + 1.1 * Math.pow(Math.max(0, cR), 1.4) + 0.3 * Math.max(0, -sR), 0, 0, w);
      p.side('ankle', 'L', 0.38 * Math.max(0, -sL) - 0.2 * Math.max(0, sL) + 0.1, 0, 0, w);
      p.side('ankle', 'R', 0.38 * Math.max(0, -sR) - 0.2 * Math.max(0, sR) + 0.1, 0, 0, w);
      p.add('hips', 0.05, -0.12 * sL, 0.04 * cL, w);
      p.add('spine', 0.14 * s, 0.1 * sL, 0, w);
      p.add('chest', 0.02, 0.06 * sL, 0, w);
      p.add('head', -0.1 * s, -0.08 * sL, 0, w);
      p.bodyY += (-0.03 * Math.cos(2 * ph) - 0.025) * w;
      p.side('shoulder', 'R', 0.55 * sR - 0.1, 0, 0.05, w);
      p.side('elbow', 'R', -0.75 - 0.35 * Math.max(0, -sR), 0, 0, w);
      p.side('shoulder', 'L', 0.12 * sL, 0, 0.04, w);
      p.side('elbow', 'L', -0.08, 0, 0, w);
    }
    // ---- strafe twist
    p.add('hips', 0, this.hipYaw, 0);
    p.add('spine', 0, -this.hipYaw * 0.6, 0);
    p.add('chest', 0, -this.hipYaw * 0.4, 0);
    // ---- airborne
    if (this.airborne) {
      const up = clamp(this.vy / 5, -1, 1);
      p.side('thigh', 'L', -0.65, 0, 0.06); p.side('thigh', 'R', -0.2 + up * 0.1, 0, 0.06);
      p.side('knee', 'L', 0.95, 0, 0); p.side('knee', 'R', 0.55, 0, 0);
      p.side('ankle', 'L', 0.35, 0, 0); p.side('ankle', 'R', 0.3, 0, 0);
      p.side('shoulder', 'R', -0.3 - up * 0.3, 0, 0.35);
    }
    // ---- head: aim pitch + bird glances
    const g = this.glance;
    g.t -= dt;
    if (g.t <= 0) {
      g.t = rand(1.2, 3.6);
      const big = Math.random() < 0.3;
      g.x = rand(-0.1, 0.12); g.y = big ? rand(-0.55, 0.55) : rand(-0.2, 0.2); g.z = rand(-0.18, 0.18);
      if (Math.random() < 0.35) { g.x = 0; g.y = 0; g.z = 0; }
    }
    const gk = 1 - Math.exp(-16 * dt);
    g.cx += (g.x - g.cx) * gk; g.cy += (g.y - g.cy) * gk; g.cz += (g.z - g.cz) * gk;
    const glanceW = (1 - clamp(s, 0, 1) * 0.7) * (this.noGlance ? 0 : 1);
    p.add('neck', this.aimPitch * 0.18, g.cy * 0.3 * glanceW, 0);
    p.add('head', this.aimPitch * 0.3 + g.cx * glanceW, g.cy * 0.7 * glanceW, g.cz * glanceW);
    p.curlL = 0.25; p.curlR = 0.45;
  }

  buildChannel(p) {
    const t = this.t;
    p.bodyY = 0.55 + 0.05 * Math.sin(t * 2.4);
    for (const s of ['L', 'R']) {
      p.setSide('thigh', s, 0.12, 0, -0.03);
      p.setSide('knee', s, 0.45, 0, 0);
      p.setSide('ankle', s, 0.8, 0, 0);
      p.setSide('shoulder', s, -0.4 - this.pulse * 0.25, -0.25, 1.05 - this.pulse * 0.15);
      p.setSide('elbow', s, -0.3, 0, 0);
      p.setSide('wrist', s, -0.35, 0.3, 0);
    }
    p.set('hips', 0.02, 0, 0);
    p.set('spine', -0.04, 0, 0);
    p.set('chest', -0.14, 0, 0);
    p.set('neck', -0.05, 0, 0);
    p.set('head', -0.12 + 0.03 * Math.sin(t * 3.1), 0, 0);
    p.curlL = p.curlR = -0.3;
    p.jaw = 0.06 + this.pulse * 0.2;
  }

  apply(p, dt) {
    const B = this.ch.bones;
    for (const j of JOINTS) {
      const b = B[j], r = b.userData.rest, a = p.r[j];
      b.rotation.set(r.x + a[0], r.y + a[1], r.z + a[2]);
    }
    this.ch.body.position.y = p.bodyY;
    // fingers
    this.curl.L = damp(this.curl.L, p.curlL, 14, dt);
    this.curl.R = damp(this.curl.R, p.curlR, 14, dt);
    for (const s of ['L', 'R']) {
      const h = this.ch.fingers[s];
      if (!h) continue;
      const c = this.curl[s];
      h.fingers.forEach(([f1, f2], i) => {
        f1.rotation.z = -c * 0.95 - 0.08;
        f2.rotation.z = -c * 1.15 - 0.06;
        f1.rotation.x = (i - 1) * -0.12 * (1 - Math.max(0, c));
      });
      h.thumb[0].rotation.z = -0.55 - c * 0.35;
      h.thumb[1].rotation.z = -c * 0.6;
    }
    this.jaw = damp(this.jaw, p.jaw, 20, dt);
    if (this.ch.parts.jaw) this.ch.parts.jaw.rotation.x = this.jaw;
    this.ch.root.updateMatrixWorld(true);
  }

  updateKilt(dt) {
    const ch = this.ch;
    if (!ch.kilt.length) return;
    const hips = ch.bones.hips;
    const inv = _m1.copy(hips.matrixWorld).invert();
    const kneeL = _v1.setFromMatrixPosition(ch.bones.kneeL.matrixWorld).applyMatrix4(inv);
    const kneeR = _v2.setFromMatrixPosition(ch.bones.kneeR.matrixWorld).applyMatrix4(inv);
    const thL = _v3.setFromMatrixPosition(ch.bones.thighL.matrixWorld).applyMatrix4(inv);
    const thR = _v4.setFromMatrixPosition(ch.bones.thighR.matrixWorld).applyMatrix4(inv);
    const accLocalZ = clamp(this.moveLocal.z * 0.02, -0.1, 0.1);
    for (const k of ch.kilt) {
      const dx = Math.sin(k.thc), dz = Math.cos(k.thc);
      const piv = k.swing.parent.position;
      const base = piv.x * dx + piv.z * dz;
      let need = 0;
      for (const [kn, th] of [[kneeL, thL], [kneeR, thR]]) {
        for (const f of [0.55, 1.0]) {
          const px = lerp(th.x, kn.x, f), pz = lerp(th.z, kn.z, f), py = lerp(th.y, kn.y, f);
          const drop = clamp(piv.y - py, 0.05, k.L);
          const out = px * dx + pz * dz + 0.095 - base;
          const flare = 0.11 * Math.pow(drop / k.L, 0.9);
          const req = Math.atan2(Math.max(0, out - flare), drop);
          need = Math.max(need, req);
        }
      }
      const target = -need - accLocalZ * dz * 2 - 0.02;
      const stiff = 1 - Math.exp(-22 * dt);
      k.ang += (target - k.ang) * stiff;
      k.swing.rotation.x = k.ang;
    }
    if (ch.parts.apron) {
      const rL = ch.bones.thighL.rotation.x, rR = ch.bones.thighR.rotation.x;
      const fwd = Math.max(0, -Math.min(rL, rR));
      ch.parts.apron.rotation.x = damp(ch.parts.apron.rotation.x, -0.92 * fwd - 0.05, 18, dt);
    }
  }

  updateTails(dt) {
    const ch = this.ch;
    if (!ch.tails.length || dt <= 0) return;
    const hips = ch.bones.hips;
    const g = -9.8, damping = 0.965;
    const back = _v3.set(0, 0, -1).transformDirection(ch.root.matrixWorld);
    const right = _v4.set(1, 0, 0).transformDirection(hips.matrixWorld);
    const legs = [];
    for (const s of ['L', 'R']) {
      const a = new THREE.Vector3().setFromMatrixPosition(ch.bones['thigh' + s].matrixWorld);
      const k = new THREE.Vector3().setFromMatrixPosition(ch.bones['knee' + s].matrixWorld);
      const an = new THREE.Vector3().setFromMatrixPosition(ch.bones['ankle' + s].matrixWorld);
      legs.push([a, k, 0.12], [k, an, 0.09]);
    }
    const hipsPos = new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld);
    for (const tail of ch.tails) {
      const anchor = tail.anchor.clone().applyMatrix4(hips.matrixWorld);
      if (!tail.ready) {
        for (let i = 0; i < tail.n; i++) { const p = anchor.clone().add(V3(0, -i * tail.seg, -0.02 * i)); tail.nodes.push(p); tail.prev.push(p.clone()); }
        tail.ready = true;
      }
      const sub = 2, h = Math.min(dt, 1 / 30) / sub;
      for (let s = 0; s < sub; s++) {
        tail.nodes[0].copy(anchor); tail.prev[0].copy(anchor);
        for (let i = 1; i < tail.n; i++) {
          const p = tail.nodes[i], q = tail.prev[i];
          const vx = (p.x - q.x) * damping, vy = (p.y - q.y) * damping, vz = (p.z - q.z) * damping;
          q.copy(p);
          p.x += vx + Math.sin(this.t * 1.7 + i) * 0.00008;
          p.y += vy + g * h * h;
          p.z += vz;
        }
        for (let it = 0; it < 4; it++) {
          for (let i = 1; i < tail.n; i++) {
            const a = tail.nodes[i - 1], b = tail.nodes[i];
            const d = _v1.copy(b).sub(a); const l = d.length() || 1e-6;
            const diff = (l - tail.seg) / l;
            if (i === 1) b.addScaledVector(d, -diff);
            else { a.addScaledVector(d, diff * 0.5); b.addScaledVector(d, -diff * 0.5); }
          }
          // collisions with legs and keep behind the body
          for (let i = 1; i < tail.n; i++) {
            const p = tail.nodes[i];
            for (const [a, b, r] of legs) {
              const ab = _v2.copy(b).sub(a); const tt = clamp(_v1.copy(p).sub(a).dot(ab) / ab.lengthSq(), 0, 1);
              const c = _v1.copy(a).addScaledVector(ab, tt);
              const off = c.sub(p).negate(); const dl = off.length();
              if (dl < r) p.addScaledVector(off, (r - dl) / (dl || 1e-4));
            }
            const rel = _v1.copy(p).sub(hipsPos);
            const db = rel.dot(back);
            const minBack = 0.13 - Math.max(0, -rel.y) * 0.05;
            if (db < minBack) p.addScaledVector(back, minBack - db);
          }
        }
      }
      // write ribbon
      const pos = tail.mesh.geometry.attributes.position;
      for (let i = 0; i < tail.n; i++) {
        const p = tail.nodes[i], w = tail.width * (1 - i / tail.n * 0.25) * 0.5;
        pos.setXYZ(i * 2, p.x - right.x * w, p.y - right.y * w, p.z - right.z * w);
        pos.setXYZ(i * 2 + 1, p.x + right.x * w, p.y + right.y * w, p.z + right.z * w);
      }
      pos.needsUpdate = true;
      tail.mesh.geometry.computeVertexNormals();
      tail.mesh.geometry.computeBoundingSphere();
    }
  }

  updateBook(dt, ctx) {
    const book = this.book;
    if (!book) return;
    const ch = this.ch;
    this.bookFloat = damp(this.bookFloat, this.bookFloatTarget, 5, dt);
    const yaw = ch.root.rotation.y;
    // held: rests upright on the left palm, pages turned toward Thoth's face, cover facing outward
    ch.parts.palmL.updateMatrixWorld(true);
    const handPos = _v1.setFromMatrixPosition(ch.parts.palmL.matrixWorld);
    handPos.y += 0.2;
    handPos.x += Math.cos(yaw) * 0.04 + Math.sin(yaw) * 0.02;
    handPos.z += -Math.sin(yaw) * 0.04 + Math.cos(yaw) * 0.02;
    if (!this._heldQ) {
      const Z = new THREE.Vector3(-0.78, 0.22, 0.58).normalize();
      const Y0 = new THREE.Vector3(0, 1, 0.18).normalize();
      const X = new THREE.Vector3().crossVectors(Y0, Z).normalize();
      const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
      this._heldQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    }
    const handQ = _q1.setFromAxisAngle(_v3.set(0, 1, 0), yaw).multiply(this._heldQ);
    // floating target: in front of the chest, open, facing forward
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const fpos = _v2.set(ch.root.position.x + fx * 0.85, ch.root.position.y + ch.body.position.y + 1.62 + Math.sin(this.t * 2.2) * 0.04, ch.root.position.z + fz * 0.85);
    _e1.set(-0.35, yaw, 0, 'YXZ');
    const fq = _q2.setFromEuler(_e1);
    const w = smoothstep(0, 1, this.bookFloat);
    book.group.position.lerpVectors(handPos, fpos, w);
    book.group.quaternion.slerpQuaternions(handQ, fq, w);
    // gentle hover wobble in the hand
    const hw = 1 - w;
    book.inner.position.set(0, Math.sin(this.t * 2.4) * 0.012 * hw, Math.sin(this.t * 1.9) * 0.01 * hw);
    book.inner.rotation.set(Math.sin(this.t * 1.3) * 0.05 * hw, Math.sin(this.t * 1.1) * 0.06 * hw, 0);
    book.update(dt);
  }
}


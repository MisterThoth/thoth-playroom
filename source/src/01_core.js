import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ============================================================================
// Core: math helpers, renderer, composer, input
// ============================================================================
const TAU = Math.PI * 2;
const SU = 0.2; // metres per SMITE range unit (55 range basic attack ~ 11 m)
const DEG = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smoothstep = (a, b, v) => { const t = inv(a, b, v); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
// (the result is wrapped too: an angle that is only ever damped never drifts off by whole turns)
const dampAngle = (a, b, k, dt) => wrapAngle(a + wrapAngle(b - a) * (1 - Math.exp(-k * dt)));
const rand = (a = 0, b = 1) => a + (b - a) * Math.random();
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const bell = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));
// 0→1 in [0,ain], hold, 1→0 in [1-aout,1]  (t normalised 0..1)
const envelope = (t, ain, aout) => Math.min(smoothstep(0, ain, t), 1 - smoothstep(1 - aout, 1, t));
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
// yields to the browser; falls back to a timer when rAF is paused (hidden tab)
const nextFrame = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 50); });

// ---------------------------------------------------------------------------
// Settings (menu-backed)
// ---------------------------------------------------------------------------
const settings = {
  level: 20,
  power: 600,
  cdr: 0.2,
  sens: 1.0,
  quality: matchMedia('(pointer: coarse)').matches ? 'medium' : 'high',
  volume: 0.7,
  music: 0.45,
  voice: 'thoth',
  god: 'thoth',
  ranks: [5, 5, 5, 5, 5],
  noCooldowns: false,
  infiniteMana: false,
  quickCast: false,
  dummiesMove: true,
};
try {
  const saved = JSON.parse(localStorage.getItem('thoth-playroom-settings') || 'null');
  if (saved && typeof saved === 'object') {
    const q = settings.quality;
    Object.assign(settings, saved);
    if (saved.v !== 2 && saved.v !== 3) settings.quality = q; // v2 (mocap/AO upgrade) starts on the new default quality
    if (!Array.isArray(settings.ranks)) settings.ranks = [5, 5, 5, 5, 5];
    while (settings.ranks.length < 5) settings.ranks.push(5); // v3: fifth ability
    if (typeof settings.music !== 'number') settings.music = 0.45;
    if (typeof settings.god !== 'string') settings.god = 'thoth';
  }
  settings.v = 3;
} catch (e) { /* storage unavailable */ }
// ?headless=1 (automated tests on a software GPU): low quality, and the loop skips drawing the 3D frame
const HEADLESS = new URLSearchParams(location.search).get('headless') === '1';
if (HEADLESS) settings.quality = 'low';
// Arena 5v5 drives level, power, cooldown reduction and ranks itself; while a match runs, settingsOverride
// holds the player's own values, and those (not the match's) are what gets saved
let settingsOverride = null;
function saveSettings() { try { localStorage.setItem('thoth-playroom-settings', JSON.stringify(settingsOverride ? { ...settings, ...settingsOverride } : settings)); } catch (e) { /* ignore */ } }

// ---------------------------------------------------------------------------
// Renderer + post processing
// ---------------------------------------------------------------------------
const glCanvas = document.getElementById('gl');
const fxCanvas = document.getElementById('fx2d');
const fx = fxCanvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Keep every compiled shader program alive for the session. three.js frees a program as soon as the
// last material using it is disposed, so an effect that comes and goes (cracks, bolts, rings, beams...)
// was recompiled every time it reappeared - a 100-200 ms freeze in the middle of a cast. Each effect
// still disposes its own material; only the first material of each compiled program is kept instead.
const SHADER_KEEP = new Map();
{
  const dispose0 = THREE.Material.prototype.dispose;
  THREE.Material.prototype.dispose = function () {
    const prog = renderer.properties.get(this).currentProgram;
    if (prog && prog.cacheKey && !SHADER_KEEP.has(prog.cacheKey)) { SHADER_KEEP.set(prog.cacheKey, this); return; }
    dispose0.call(this);
  };
}

const scene = new THREE.Scene();
const rootScene = scene;   // (for code that shadows `scene` with a sub-group)
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1200);
scene.add(camera);

let composer = null, bloomPass = null, renderTarget = null, shockPass = null;
// Screen-space magic: a refracting shockwave ring with chromatic fringes, plus a cyan vignette of fury
const ShockShader = {
  uniforms: { tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uRadius: { value: 0 }, uWidth: { value: 0.06 },
    uStrength: { value: 0 }, uAberr: { value: 0 }, uAspect: { value: 1 }, uVig: { value: 0 }, uTint: { value: new THREE.Color(0.1, 0.8, 1.0) },
    tDistort: { value: null }, uDistK: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uRadius, uWidth, uStrength, uAberr, uAspect, uVig; uniform vec3 uTint;
    uniform sampler2D tDistort; uniform float uDistK;
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - uCenter; d.x *= uAspect;
      float r = length(d);
      float x = (r - uRadius) / uWidth;
      float ring = exp(-x * x) * uStrength;
      vec2 dir = r > 1e-4 ? d / r : vec2(0.0); dir.x /= uAspect;
      // FX2 distortion buffer: shock rings and heat haze bend the image (and split its colours a little)
      vec2 dofs = uDistK > 0.0 ? texture2D(tDistort, vUv).rg * uDistK : vec2(0.0);
      vec2 uv = vUv - dir * ring * 0.03 + dofs;
      float dl = length(dofs);
      vec2 cdir = dl > 1e-5 ? mix(dir, dofs / dl, clamp(dl * 60.0, 0.0, 1.0)) : dir;
      float ab = uAberr + ring * 0.007 + dl * 0.18;
      vec3 c = vec3(texture2D(tDiffuse, uv + cdir * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - cdir * ab).b);
      c += uTint * ring * 0.35;
      vec2 q = vUv - 0.5; q.x *= uAspect * 0.8;
      float v = smoothstep(0.25, 0.85, length(q));
      c = c * (1.0 - v * uVig * 0.7) + uTint * v * uVig * 0.08;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
const PostFX = {
  shocks: [], vig: 0, vigTarget: 0, aberr: 0,
  shock(worldPos, strength = 1, dur = 0.7) { this.shocks.push({ p: worldPos.clone(), t: 0, dur, s: strength }); },
  update(dt) {
    this.vig = damp(this.vig, this.vigTarget, 4, dt);
    this.aberr = Math.max(0, this.aberr - dt * 0.02);
    let best = null;
    this.shocks = this.shocks.filter((k) => { k.t += dt; if (k.t >= k.dur) return false; if (!best || k.t < best.t) best = k; return true; });
    if (!shockPass) return;
    const u = shockPass.uniforms;
    u.uAspect.value = camera.aspect; u.uVig.value = this.vig; u.uAberr.value = this.aberr;
    // shock rings and the fury vignette take the active god's own colour (Thoth cyan, Hecate violet, ...)
    const gc = (typeof Kit !== 'undefined' && Kit && (Kit.fxColor || Kit.accent)) || null;
    if (gc) u.uTint.value.copy(gc).multiplyScalar(0.8);
    if (best) {
      const k = best.t / best.dur, p = best.p.clone().project(camera);
      u.uCenter.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      u.uRadius.value = easeOutCubic(k) * 1.1; u.uWidth.value = 0.05 + 0.1 * k;
      u.uStrength.value = best.s * (1 - k) * (p.z < 1 ? 1 : 0);
    } else u.uStrength.value = 0;
  },
};
// GTAO that ignores glow sprites, particles and other transparent effects in its G-buffer
class GameGTAOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      const m = o.material;
      if (o.isPoints || o.isLine || o.isSprite || (m && (m.transparent || m.blending === THREE.AdditiveBlending || m.depthWrite === false))) o.visible = false;
    });
  }
}
function qualityPixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  if (settings.quality === 'high') return Math.min(dpr, 2);
  if (settings.quality === 'low') return Math.min(dpr, 1);
  return Math.min(dpr, 1.5);
}
function setupComposer() {
  const pr = qualityPixelRatio();
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  if (renderTarget) renderTarget.dispose();
  if (composer) composer.dispose?.();
  renderTarget = new THREE.WebGLRenderTarget(Math.floor(w * pr), Math.floor(h * pr), {
    type: THREE.HalfFloatType,
    samples: settings.quality === 'low' ? 0 : 4,
  });
  composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  if (settings.quality === 'high') {
    // ground-truth ambient occlusion: contact darkening under props, in column flutes and costume folds
    const ao = new GameGTAOPass(scene, camera, Math.floor(w * pr), Math.floor(h * pr));
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
  }
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.42, 1.0);
  composer.addPass(bloomPass);
  shockPass = new ShaderPass(ShockShader);
  composer.addPass(shockPass);
  composer.addPass(new OutputPass());
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const fpr = Math.min(window.devicePixelRatio || 1, 2);
  fxCanvas.width = Math.floor(w * fpr);
  fxCanvas.height = Math.floor(h * fpr);
  fx.setTransform(fpr, 0, 0, fpr, 0, 0);
}
setupComposer();
addEventListener('resize', () => { if (Game.mode !== 'quit') setupComposer(); });

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const input = {
  down: new Set(), pressed: new Set(), released: new Set(),
  mdx: 0, mdy: 0, wheel: 0,
  lmb: false, rmb: false, lmbPressed: false, rmbPressed: false, lmbReleased: false, rmbReleased: false,
  locked: false, dragLook: false, enabled: false,
};
// abilities: Q E R F G (digits 1-5 still work) · V switches god · B recalls (see 11_player.js ABILITY_KEYS)
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyG', 'KeyV', 'KeyB',
  'Tab', 'KeyT', 'KeyC', 'KeyM', 'KeyH', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
function isFormTarget(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); }
addEventListener('keydown', (e) => {
  if (isFormTarget(e)) return;
  if (input.enabled && GAME_KEYS.has(e.code) && !e.ctrlKey && !e.metaKey) e.preventDefault();   // (Ctrl/Cmd+R etc. stay the browser's)
  if (!e.repeat) input.pressed.add(e.code);
  input.down.add(e.code);
});
addEventListener('keyup', (e) => { input.down.delete(e.code); input.released.add(e.code); });
addEventListener('blur', () => { input.down.clear(); input.lmb = input.rmb = false; input.dragLook = false; });
document.addEventListener('mousedown', (e) => {
  if (!input.enabled) return;
  if (e.target !== glCanvas && !input.locked) return;
  if (e.button === 0) { input.lmb = true; input.lmbPressed = true; }
  if (e.button === 2) { input.rmb = true; input.rmbPressed = true; if (!input.locked) input.dragLook = true; }
  if (e.button === 1) { if (!input.locked) input.dragLook = true; e.preventDefault(); }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) { input.lmb = false; input.lmbReleased = true; }
  if (e.button === 2) { input.rmb = false; input.rmbReleased = true; input.dragLook = false; }
  if (e.button === 1) input.dragLook = false;
});
addEventListener('mousemove', (e) => {
  if (input.locked || input.dragLook) { input.mdx += e.movementX || 0; input.mdy += e.movementY || 0; }
});
glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
glCanvas.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
let onPointerLockChange = null;
document.addEventListener('pointerlockchange', () => {
  input.locked = document.pointerLockElement === glCanvas;
  if (onPointerLockChange) onPointerLockChange(input.locked);
});
document.addEventListener('pointerlockerror', () => { input.locked = false; });
function requestLock() {
  try {
    const p = glCanvas.requestPointerLock({ unadjustedMovement: true });
    if (p && typeof p.catch === 'function') p.catch(() => { try { const q = glCanvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (err) { /* no lock */ } });
  } catch (e) {
    try { glCanvas.requestPointerLock(); } catch (err) { /* no pointer lock available */ }
  }
}
function endFrameInput() {
  input.pressed.clear(); input.released.clear();
  input.mdx = 0; input.mdy = 0; input.wheel = 0;
  input.lmbPressed = input.rmbPressed = input.lmbReleased = input.rmbReleased = false;
}


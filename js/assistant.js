/* R.A.I. — Raunak's Artificial Intern.
   Loaded on demand (from main.js) the first time #assistant opens.
   The conversation script lives in js/data.js → assistant. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const D = window.PORTFOLIO;
const A = D.assistant;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MOTION = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&@ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const view = document.querySelector('[data-view="assistant"]');
const root = $('#rai');
const canvas = $('#rai-canvas');
const sayEl = $('#rai-say');
const actions = $('#rai-actions');
const panel = $('#rai-panel');
const backBtn = $('#rai-back');
const bar = $('#rai-progress');
const wakeBtn = $('#rai-wake');
const loading = $('#rai-loading');
const loadPct = $('#rai-load-pct');
const soundBtn = $('#rai-sound');

let started = false;
let awake = false;

export function open() {
  if (!started) { started = true; init(); }
}

/* ======================= 3D: R.A.I. in a neon room ======================= */
let renderer, composer, bloomComposer, scene, camera, mixer, model, head, neck, spine, dust, idleAction, jumpAction;
const rest = new Map();
const facing = new THREE.Vector3(0, 0, 1);
const target = new THREE.Vector3();
const headHome = new THREE.Vector3();  // head position in the idle pose — the camera frames this and stays still
let power = 0;                          // room light: 0 = off, 1 = on (follows the tubes after waking)
let slump = 1;                          // 1 = asleep, head down; 0 = upright
const look = { x: 0, y: 0 };
const ptr = { x: 0, y: 0 };
const lights = {};
const BG = new THREE.Color(0x0d0d0d);
// the cursor is a little light source: it moves on a plane just in front of R.A.I. and lights his armour
const cursor = { x: 0, y: 0, inside: false, level: 0 };
let cursorRing; // the cursor's neon ring light: three coloured lights + a ring seen only in reflections
const ringLights = [], ringArcs = [];
const RING_R = 0.22;
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();

// The animation clip mixes still moments and big moves. R.A.I. holds a still pose (with breathing and
// mouse-follow layered on top) and only plays the one clean jump when you answer him.
const IDLE_AT = 12.8;                    // seconds: standing still
const JUMP_FROM = 13.1, JUMP_TO = 15.3;  // seconds: crouch, one jump, land back in the idle pose
let jumping = false, jumpW = 0;

// The site's skill-bar colours (same hues as the dashboard's skill matrix), used for R.A.I.'s neon tubes.
const PALETTE = (() => {
  const items = D.skills.items, n = items.length;
  return items.map((_, i) => new THREE.Color().setHSL(((((75 - i * (330 / n)) % 360) + 360) % 360) / 360, 0.95, 0.55));
})();
const ENV_ONLY = 1;              // layer seen by the reflection camera but not by the viewer
const GLOW = 2;                  // layer of things allowed to bloom (only the tube cores)
const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
const _saved = new Map(), _hidden = [];
let cubeRT, cubeCam, pmremGen, envRT = null, softbox, envTick = 0, wakeAt = 0, baseAng = 0;
const COS75 = Math.cos((75 * Math.PI) / 180);
const tubes = [];
const tubeLights = [];
const OFF_CORE = new THREE.Color(0x1a1a1a), _c = new THREE.Color();
const rand = (i) => ((Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1;

function init3D() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    loading.textContent = "My 3D body didn't load on this device — but I can still talk.";
    return false;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = BG.clone();
  scene.fog = new THREE.Fog(BG, 6.5, 13);
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  // Reflections: a cube camera photographs the room from R.A.I.'s chest a few times a second,
  // and that becomes what his metal (and the glass tubes) reflect.
  cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  cubeCam = new THREE.CubeCamera(0.05, 40, cubeRT);
  cubeCam.layers.enable(ENV_ONLY);
  cubeCam.children.forEach((c) => c.layers.enable(ENV_ONLY));
  pmremGen = new THREE.PMREMGenerator(renderer);
  // an overhead softbox only visible in reflections (dims with the room)
  softbox = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false }));
  softbox.layers.set(ENV_ONLY);
  scene.add(softbox);

  // lights: a faint cold rim even when the room is off, a soft key that casts his shadow, palette fills
  lights.moon = new THREE.DirectionalLight(0x7d9cff, 0.55);
  lights.hemi = new THREE.HemisphereLight(0xffffff, 0x0a0a0a, 0);
  lights.key = new THREE.DirectionalLight(0xfff3e6, 0);
  lights.key.castShadow = true;
  lights.key.shadow.mapSize.set(1024, 1024);
  Object.assign(lights.key.shadow.camera, { left: -2.2, right: 2.2, top: 2.6, bottom: -0.4, near: 0.5, far: 14 });
  lights.key.shadow.bias = -0.0004;
  lights.key.shadow.radius = 6;
  lights.key.target.position.set(0, 1, 0);
  scene.add(lights.moon, lights.hemi, lights.key, lights.key.target);
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(PALETTE[(i * 2) % PALETTE.length], 0, 12, 2);
    tubeLights.push(l); scene.add(l);
  }
  // three arcs of neon, each with its own light, forming a ring that cycles through the hues
  cursorRing = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.011, 10, 40, (Math.PI * 2) / 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    arc.rotation.z = (k * Math.PI * 2) / 3;
    arc.layers.set(ENV_ONLY); // never drawn for the viewer — it only shows up as a reflection on him
    const light = new THREE.PointLight(0xffffff, 0, 2.6, 2);
    const mid = ((k + 0.5) * Math.PI * 2) / 3;
    light.position.set(Math.cos(mid) * RING_R, Math.sin(mid) * RING_R, 0);
    cursorRing.add(arc, light);
    ringArcs.push(arc); ringLights.push(light);
  }
  scene.add(cursorRing);
  // listen on the whole R.A.I. view, so the light keeps following over the dialogue too
  root.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    cursor.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    cursor.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    cursor.inside = true;
  }, { passive: true });
  root.addEventListener('pointerleave', () => { cursor.inside = false; });

  // glossy dark floor that catches the coloured light, plus a soft contact shadow under his feet
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 72), new THREE.MeshPhysicalMaterial({
    color: 0x0b0b0b, roughness: 0.3, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.18,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const blob = document.createElement('canvas'); blob.width = blob.height = 128;
  const bx = blob.getContext('2d'); const bg = bx.createRadialGradient(64, 64, 4, 64, 64, 64);
  bg.addColorStop(0, 'rgba(0,0,0,.75)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = bg; bx.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.003;
  scene.add(contact);

  // drifting dust for depth (only visible once the room is lit)
  const N = 220, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 6; pos[i * 3 + 1] = Math.random() * 3.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd2b0, size: 0.01, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(dust);

  // post-processing: selective bloom — only the neon cores glow (never glints on his armour).
  // Pass 1 renders the scene with everything except the cores blacked out and blooms it;
  // pass 2 renders the normal scene and adds that glow on top.
  const hdr = { type: THREE.HalfFloatType };
  bloomComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, hdr));
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0));
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, hdr));
  composer.addPass(new RenderPass(scene, camera));
  const mix = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv); }',
  }), 'baseTexture');
  mix.needsSwap = true;
  composer.addPass(mix);
  composer.addPass(new OutputPass());

  addEventListener('pointermove', (e) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(A.model.src, onModel, (e) => {
    // servers may gzip the model, so loaded can overshoot total — cap at 99% until it's actually parsed
    if (e.total) loadPct.textContent = `${Math.min(99, Math.round((e.loaded / e.total) * 100))}%`;
  }, () => {
    loading.textContent = "My 3D body didn't load — but I can still talk.";
    showWake();
  });
  requestAnimationFrame(loop);
  return true;
}

function findBone(...patterns) {
  for (const re of patterns) {
    let found = null;
    model.traverse((o) => { if (!found && o.isBone && re.test(o.name)) found = o; });
    if (found) return found;
  }
  return null;
}

function onModel(gltf) {
  model = gltf.scene;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = true;
    // The body is exported as "transparent" though its texture is fully opaque; drawn that way the
    // back and inner faces show through the front. Render it as a solid surface instead.
    for (const m of [].concat(o.material)) {
      if (m.transparent && m.opacity >= 1) { m.transparent = false; m.depthWrite = true; m.needsUpdate = true; }
    }
  });
  scene.add(model);

  // normalise: 2 units tall, feet on the floor, centred
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(2 / (size.y || 1));
  model.updateMatrixWorld(true);
  box.setFromObject(model, true);
  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);

  head = findBone(/CC_Base_Head(_|$)/, /head/i);
  neck = findBone(/NeckTwist01/, /neck/i);
  spine = findBone(/Spine02/, /spine/i);
  for (const b of [head, neck, spine]) if (b) rest.set(b, b.quaternion.clone());

  // which way is the robot facing? (from its eyes, if it has them)
  const eyeL = findBone(/L_Eye/), eyeR = findBone(/R_Eye/);
  if (head && eyeL && eyeR) {
    const h = head.getWorldPosition(new THREE.Vector3());
    const e = eyeL.getWorldPosition(new THREE.Vector3()).add(eyeR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const f = e.sub(h); f.y = 0;
    if (f.lengthSq() > 1e-8) facing.copy(f.normalize());
  }

  // idle = the clip held at a still moment; jump = the same clip played from JUMP_FROM to JUMP_TO
  mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations[0];
  if (clip) {
    idleAction = mixer.clipAction(clip);
    idleAction.play();
    idleAction.paused = true;
    idleAction.time = IDLE_AT;
    jumpAction = mixer.clipAction(clip.clone());
    jumpAction.play();
    jumpAction.paused = true;
    jumpAction.time = JUMP_FROM;
    jumpAction.setEffectiveWeight(0);
    mixer.update(0);
  }
  model.updateMatrixWorld(true);
  (head || model).getWorldPosition(headHome);
  target.set(headHome.x, headHome.y - 0.24, headHome.z); // headroom for his jump

  buildTubes();
  loading.hidden = true;
  showWake();
}

// Neon tubes in the site's palette, standing in a ring around R.A.I.: clear glass with rounded ends, a glowing
// core, metal caps, a little floor stand and a cable going up. Tubes in front of him only appear in
// reflections (ENV_ONLY), so they light his chest without blocking the view.
function buildTubes() {
  const N = 22;
  baseAng = Math.atan2(facing.x, facing.z);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.24,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false,
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, metalness: 1, roughness: 0.3 });
  const cable = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.55 });
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;                   // 0 = straight in front of him
    const R = [2.8, 4.2, 5.6][i % 3];                    // three evenly spaced rings: near, middle, far
    const a = baseAng + ang;
    const h = 1.35 + rand(i) * 1.7;                      // glowing length
    const y0 = 0.16;                                     // bottom of the glass
    const yc = y0 + 0.045 + h / 2;                       // centre of the tube
    const top = y0 + h + 0.09;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    g.rotation.y = a;
    const coreMat = new THREE.MeshBasicMaterial({ color: OFF_CORE.clone() });
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, h, 6, 12), coreMat);
    core.position.y = yc;
    core.layers.enable(GLOW);
    const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, h, 10, 24), glass);
    tube.position.y = yc;
    const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.1, 24), metal);
    capB.position.y = y0 + 0.03;
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.058, 0.1, 24), metal);
    capT.position.y = top - 0.03;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.025, 28), metal);
    stand.position.y = 0.0125;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, y0 - 0.02, 10), metal);
    rod.position.y = 0.025 + (y0 - 0.02) / 2;
    const wireLen = 7 - top;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, wireLen, 6), cable);
    wire.position.y = top + wireLen / 2;
    g.add(core, tube, capB, capT, stand, rod, wire);
    scene.add(g);
    // on wake each tube flickers like a fluorescent starter before it settles
    const flicks = [];
    let tt = 0;
    const n = 2 + Math.floor(rand(i + 50) * 3);
    for (let k = 0; k < n; k++) {
      tt += 0.04 + rand(i * 7 + k) * 0.12; flicks.push([tt, k % 2 === 0 ? 1 : 0.05]);
      tt += 0.03 + rand(i * 11 + k) * 0.1; flicks.push([tt, k % 2 === 0 ? 0.05 : 1]);
    }
    flicks.push([tt + 0.08, 1]);
    tubes.push({
      g, core, parts: [core, tube, capB, capT, stand, rod, wire], coreMat, col: PALETTE[i % PALETTE.length],
      // orbit: the whole ring turns together, slowly, so the tubes stay evenly spaced
      ang, R, speed: 0.03, front: null,
      phase: i * 1.7, start: 0.15 + i * 0.045 + rand(i + 99) * 0.35, flicks, level: 0, lit: false, light: null,
    });
  }
  // the coloured fill lights ride along with a few of the tubes
  tubeLights.forEach((l, k) => {
    const tb = tubes[Math.round((k * N) / tubeLights.length) % N];
    tb.light = l;
    l.color.copy(tb.col);
  });
  softbox.position.copy(facing).multiplyScalar(1.8).add(new THREE.Vector3(0, 3.8, 0));
  softbox.lookAt(0, 1.2, 0);
  placeTubes(0);
}

// move every tube along its orbit; tubes passing in front of him (between him and the camera) are
// shown only in reflections, and the switch happens well outside the camera's view
function placeTubes(dt) {
  for (const tb of tubes) {
    tb.ang += tb.speed * dt * MOTION;
    const a = baseAng + tb.ang;
    tb.g.position.set(Math.sin(a) * tb.R, 0, Math.cos(a) * tb.R);
    tb.g.rotation.y = a;
    const front = Math.cos(tb.ang) > COS75;
    if (front !== tb.front) {
      tb.front = front;
      for (const o of tb.parts) o.layers.set(front ? ENV_ONLY : 0);
      if (!front) tb.core.layers.enable(GLOW);
    }
    if (tb.light) {
      const r = tb.R - 0.35;
      tb.light.position.set(Math.sin(a) * r, 1.5, Math.cos(a) * r);
    }
  }
}

function tubeState(tb, since) {
  if (since < tb.start) return 0;
  const x = since - tb.start;
  let v = 0;
  for (const [t, val] of tb.flicks) { if (x >= t) v = val; else break; }
  return v;
}

function updateTubes(now, dt) {
  const t = now / 1000;
  const since = awake ? (now - wakeAt) / 1000 : -1;
  placeTubes(dt);
  let total = 0;
  for (const tb of tubes) {
    const goal = MOTION ? tubeState(tb, since) : (awake ? 1 : 0);
    tb.level += (goal - tb.level) * Math.min(1, dt * 40);  // fast, so the flicker reads as a flicker
    if (goal > 0.5 && !tb.lit) { tb.lit = true; buzz(); }
    const breathe = 0.86 + 0.14 * Math.sin(t * 1.1 + tb.phase);
    const lvl = tb.level * (tb.level > 0.9 ? breathe : 1);
    // off = dark core behind clear glass; on = HDR colour that the bloom turns into a neon glow
    tb.coreMat.color.copy(OFF_CORE).lerp(_c.copy(tb.col).multiplyScalar(1.5), lvl);
    total += tb.level;
    // farther tubes get a stronger light so they still reach him
    if (tb.light) tb.light.intensity = 6 * Math.min(3, (tb.R / 2.6) ** 2) * lvl;
  }
  // the room light comes up once the tubes are mostly on
  const roomGoal = awake && since > 0.55 ? 1 : 0;
  power += (roomGoal - power) * Math.min(1, dt * (MOTION ? 1.6 : 60));
  lights.key.intensity = 1.25 * power;
  lights.hemi.intensity = 0.22 * power;
  lights.moon.intensity = 0.55 - 0.3 * power;
  softbox.material.color.setScalar(0.05 + 1.5 * power);
  if (dust) dust.material.opacity = 0.45 * power;
}

// re-photograph the surroundings for reflections (every few frames is plenty)
function updateReflections() {
  if (!cubeCam || !model) return;
  if (envTick++ % 3) return;
  model.visible = false;
  if (dust) dust.visible = false;
  // reflections are switched off while the room is photographed — otherwise the glass, floor and metal
  // would read from the very image being written (a feedback loop that made every 3rd frame flash)
  scene.environment = null;
  cubeCam.position.set(headHome.x, headHome.y - 0.5, headHome.z);
  cubeCam.update(renderer, scene);
  envRT = pmremGen.fromCubemap(cubeRT.texture, envRT);
  scene.environment = envRT.texture;
  model.visible = true;
  if (dust) dust.visible = true;
}

// rotate a bone by a rotation given in world space (works whatever the rig's local axes are)
const _pq = new THREE.Quaternion(), _t = new THREE.Quaternion();
function addWorldRotation(bone, q) {
  if (!bone || !bone.parent) return;
  bone.parent.getWorldQuaternion(_pq);
  _t.copy(_pq).invert().multiply(q).multiply(_pq);
  bone.quaternion.premultiply(_t);
}

const UP = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3(), _qy = new THREE.Quaternion(), _qx = new THREE.Quaternion(), _q = new THREE.Quaternion();
function turn(bone, yaw, pitch) {
  _qy.setFromAxisAngle(UP, yaw);
  _qx.setFromAxisAngle(_right, pitch);
  _q.copy(_qy).multiply(_qx);
  addWorldRotation(bone, _q);
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const s = renderer.getSize(new THREE.Vector2());
  if (s.x !== w || s.y !== h) {
    renderer.setSize(w, h, false);
    for (const c of [composer, bloomComposer]) { c.setPixelRatio(renderer.getPixelRatio()); c.setSize(w, h); }
  }
  camera.aspect = w / h;
  // leave room for the dialogue: robot sits right of centre on wide screens, higher up on phones
  if (w > 820) camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
  else camera.setViewOffset(w, h, 0, h * 0.26, w, h);
  camera.updateProjectionMatrix();
}

function updateCursorLight(dt) {
  if (!cursorRing) return;
  // project the mouse onto a plane ~0.7 in front of his chest (facing the viewer)
  _plane.setFromNormalAndCoplanarPoint(facing, _hit.copy(target).addScaledVector(facing, 0.7));
  _ray.setFromCamera(_ndc.set(cursor.x, cursor.y), camera);
  if (_ray.ray.intersectPlane(_plane, _hit)) cursorRing.position.copy(_hit);
  cursorRing.lookAt(camera.position);            // the ring faces him/the viewer…
  cursorRing.rotateZ(performance.now() / 1000 * 0.9); // …and slowly spins
  // on whenever the mouse is over the scene (awake or asleep); fades in and out softly
  const goal = cursor.inside ? 1 : 0;
  cursor.level += (goal - cursor.level) * Math.min(1, dt * 6);
  // cycles through the spectrum like the cursor trail; the three arcs sit 40° apart in hue so the ring
  // reads as one rich, shifting colour (120° apart would mix back to white on his armour)
  const t = Date.now() / 1000;
  const strength = (0.55 + 0.75 * power) * cursor.level; // softer while he's asleep
  for (let k = 0; k < 3; k++) {
    _c.setHSL(((t * 120 + k * 40) % 360) / 360, 1, 0.55); // same speed as the trail
    ringLights[k].color.copy(_c);
    ringLights[k].intensity = strength;
    ringArcs[k].material.color.copy(_c).multiplyScalar(0.3 + 3 * cursor.level);
  }
  cursorRing.visible = cursor.level > 0.02;
}

function startJump() {
  if (!jumpAction || jumping || !MOTION) return;
  jumping = true;
  jumpAction.time = JUMP_FROM;
  jumpAction.paused = false;
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (view.hidden || document.hidden) return;
  resize();
  if (tubes.length) updateTubes(now, dt);
  if (dust) {
    dust.rotation.y += dt * 0.02;
    const p = dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.04; if (y > 3.2) y = 0; p.setY(i, y); }
    p.needsUpdate = true;
  }

  // fixed camera framing the idle pose — it doesn't chase him when he moves
  const dist = 3.15 * Math.max(1, 1.05 / Math.max(camera.aspect, 0.3));
  camera.position.copy(target).addScaledVector(facing, dist).add(new THREE.Vector3(0, 0.14, 0));
  camera.lookAt(target);
  _right.crossVectors(UP, facing); // the viewer's right, in world space
  lights.key.position.copy(camera.position).add(new THREE.Vector3(1.6, 2.4, 0.4));
  lights.moon.position.copy(facing).multiplyScalar(-4).add(new THREE.Vector3(-1.5, 3, 0));
  updateCursorLight(dt);

  if (model) {
    for (const [b, q] of rest) b.quaternion.copy(q);
    if (mixer) {
      // the jump plays once, then blends back into the still idle pose
      if (jumping && jumpAction.time >= JUMP_TO) { jumping = false; jumpAction.paused = true; }
      jumpW += ((jumping ? 1 : 0) - jumpW) * Math.min(1, dt * (jumping ? 10 : 3.5));
      jumpAction.setEffectiveWeight(jumpW);
      idleAction.setEffectiveWeight(1 - jumpW);
      mixer.update(dt);
    }
    model.updateMatrixWorld(true);

    const t = now / 1000;
    // asleep he slumps forward; after waking he lifts his head as the room lights up
    const since = awake ? (now - wakeAt) / 1000 : -1;
    const slumpGoal = since > 0.7 ? 0 : 1;
    slump += (slumpGoal - slump) * Math.min(1, dt * (MOTION ? 1.8 : 60));
    // follow the mouse when awake, on top of slow breathing and a gentle sway
    const k = awake ? 1 - slump : 0;
    look.x += (ptr.x * k - look.x) * Math.min(1, dt * 4);
    look.y += (ptr.y * k - look.y) * Math.min(1, dt * 4);
    const breathe = MOTION ? Math.sin(t * 1.7) * 0.016 : 0;
    const sway = MOTION ? Math.sin(t * 0.45) * 0.035 + Math.sin(t * 0.23 + 1) * 0.02 : 0;
    // +yaw turns towards the viewer's right, +pitch looks down
    const yaw = look.x * 0.75, pitch = look.y * 0.35;
    turn(spine, yaw * 0.25 + sway * 0.6, pitch * 0.15 + breathe + slump * 0.18);
    turn(neck, yaw * 0.3 + sway * 0.3, pitch * 0.3 + breathe * 0.5 + slump * 0.25);
    turn(head, yaw * 0.45 + sway * 0.4, pitch * 0.55 + slump * 0.5);
    updateReflections();
  }
  renderWithGlow();
}

function renderWithGlow() {
  // black out everything that isn't allowed to glow, bloom it, put the real materials back, composite
  const bg = scene.background, fog = scene.fog;
  scene.background = null; scene.fog = null;
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints) || o.layers.isEnabled(GLOW)) return;
    // see-through things (glass, the contact shadow, dust) are skipped so they don't hide the cores;
    // everything solid is drawn black so it still blocks the glow correctly
    if (o.material.transparent || o.isPoints) { if (o.visible) { _hidden.push(o); o.visible = false; } }
    else { _saved.set(o, o.material); o.material = BLACK; }
  });
  bloomComposer.render();
  for (const [o, m] of _saved) o.material = m;
  for (const o of _hidden) o.visible = true;
  _saved.clear(); _hidden.length = 0;
  scene.background = bg; scene.fog = fog;
  composer.render();
}

/* ======================= power on ======================= */
function showWake() {
  if (awake) return;
  wakeBtn.hidden = false;
}
function wake() {
  if (awake) return;
  awake = true;
  wakeAt = performance.now();
  wakeBtn.hidden = true;
  // the tubes flicker on, the room light rises, then he lifts his head and starts talking
  setTimeout(() => { panel.hidden = false; go(A.start); }, MOTION ? 1500 : 0);
}

/* ======================= sound (optional typing blips) ======================= */
let soundOn = store.get('rai-sound') === 'on';
let audio = null;
function syncSound() {
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.classList.toggle('on', soundOn);
}
function buzz() {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const len = Math.floor(audio.sampleRate * 0.05), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 600; g.gain.value = 0.05;
    src.connect(f).connect(g).connect(audio.destination); src.start();
  } catch { /* no audio */ }
}
function blip() {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square';
    o.frequency.value = 1400 + Math.random() * 500;
    g.gain.setValueAtTime(0.025, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.03);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.035);
  } catch { /* no audio */ }
}

/* ======================= the conversation ======================= */
const answers = {};
let history = [];
let typingToken = 0;
let skipTyping = null;
let autoTimer = 0;
const lastLine = {};
const prevEl = document.createElement('p');
prevEl.className = 'rai-prev';
panel.insertBefore(prevEl, sayEl);

const fill = (text) => text
  .replace(/\{name\}/g, answers.name || 'friend')
  .replace(/\{visitor\}/g, answers.name || 'stranger');

function lineFor(id, step) {
  const options = step.say || [''];
  let line = pick(options);
  if (options.length > 1) while (line === lastLine[id]) line = pick(options);
  lastLine[id] = line;
  return fill(line);
}

function typeLine(text) {
  const my = ++typingToken;
  sayEl.classList.remove('done');
  if (!MOTION) { sayEl.textContent = text; return Promise.resolve(); }
  return new Promise((resolve) => {
    let i = 0;
    const finish = () => { if (my !== typingToken) return; sayEl.textContent = text; sayEl.classList.add('done'); skipTyping = null; resolve(); };
    skipTyping = finish;
    const tick = () => {
      if (my !== typingToken) return;
      i += 1;
      if (i >= text.length) return finish();
      const tail = Array.from({ length: Math.min(3, text.length - i) }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
      sayEl.innerHTML = `${esc(text.slice(0, i))}<span class="rai-scr">${esc(tail)}</span>`;
      if (i % 2 === 0) blip();
      setTimeout(tick, text[i - 1] === ',' || text[i - 1] === '.' ? 90 : 22);
    };
    tick();
  });
}

function go(id, push = true) {
  const step = A.steps[id];
  if (!step) return;
  clearTimeout(autoTimer);
  if (push) history.push(id);
  const prevText = sayEl.textContent;
  prevEl.textContent = prevText;
  prevEl.classList.toggle('show', !!prevText);
  bar.style.width = `${(step.progress || 0) * 100}%`;
  // no going back into (or out of) the 'sending' steps — it would open the email again
  backBtn.hidden = !canGoBack() || !!step.send || id.endsWith('-completion');
  actions.innerHTML = '';
  if (step.send) compose(step.send);
  typeLine(lineFor(id, step)).then(() => showActions(id, step));
}

function react() { startJump(); }

// lines that just talk and move on by themselves aren't worth going "back" to
const isInteractive = (id) => { const s = A.steps[id]; return !!(s && (s.input || s.choices || s.story)); };
const canGoBack = () => history.slice(0, -1).some(isInteractive);

function button(label, cls, onClick, delay) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.style.animationDelay = `${delay}ms`;
  b.addEventListener('click', onClick);
  actions.appendChild(b);
  return b;
}

function showActions(id, step) {
  actions.innerHTML = '';
  if (step.input) {
    const inp = step.input;
    const field = document.createElement('div');
    field.className = 'rai-field';
    const el = document.createElement(inp.multiline ? 'textarea' : 'input');
    el.name = inp.name;
    el.placeholder = inp.label;
    el.setAttribute('aria-label', inp.label);
    if (!inp.multiline) el.type = inp.type || 'text';
    if (inp.type === 'email') el.autocomplete = 'email';
    if (inp.name === 'name') el.autocomplete = 'name';
    if (inp.multiline) el.rows = 3;
    el.value = answers[inp.name] || '';
    const send = document.createElement('button');
    send.type = 'submit';
    send.className = 'rai-send';
    send.setAttribute('aria-label', 'Send');
    send.textContent = '→';
    field.append(el, send);
    actions.appendChild(field);
    const err = document.createElement('p');
    err.className = 'rai-error';
    actions.appendChild(err);
    if (inp.optional) button('Skip', 'rai-skip', () => { answers[inp.name] = ''; go(step.next); }, 120);
    if (inp.multiline) {
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); actions.requestSubmit(); } });
    }
    actions.onsubmit = (e) => {
      e.preventDefault();
      const v = el.value.trim();
      if (!v && !inp.optional) { err.textContent = 'I need something here first.'; el.focus(); return; }
      if (inp.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { err.textContent = "That doesn't look like an email address."; el.focus(); return; }
      answers[inp.name] = v;
      if (inp.name === 'name') store.set('rai-name', v);
      react();
      go(step.next);
    };
    setTimeout(() => el.focus({ preventScroll: true }), 50);
    return;
  }
  actions.onsubmit = (e) => e.preventDefault();
  if (step.choices) {
    step.choices.forEach((c, i) => button(c.label, 'rai-choice', () => {
      react();
      if (c.set) Object.assign(answers, c.set);
      if (c.send) compose(c.send);
      else if (c.href) {
        if (/^https?:/.test(c.href)) window.open(c.href, '_blank', 'noopener');
        else location.hash = c.href;
      } else if (c.to) go(c.to);
    }, i * 70));
    return;
  }
  if (step.story) {
    button('Next →', 'rai-choice rai-next', () => go(step.story), 0);
    if (step.story !== 'story-done') button('Skip the story', 'rai-skip', () => go('story-done'), 80);
    return;
  }
  if (step.next) autoTimer = setTimeout(() => go(step.next), 1300);
}

// No server needed: open the visitor's email app with everything filled in.
function compose(kind) {
  const lines = [];
  let subject;
  if (kind === 'hire') {
    subject = `Working together — ${answers.kind || 'an opportunity'}${answers.name ? ` (${answers.name})` : ''}`;
    lines.push('Hi Raunak,', '', answers.brief || '', '');
    lines.push(`What: ${answers.kind || '—'}`);
    if (answers.company) lines.push(`Company / team: ${answers.company}`);
  } else {
    subject = `A quick word${answers.name ? ` from ${answers.name}` : ''}`;
    lines.push('Hi Raunak,', '', answers.message || '', '');
  }
  if (answers.name) lines.push(`Name: ${answers.name}`);
  if (answers.email) lines.push(`Email: ${answers.email}`);
  lines.push('', '— sent via R.A.I. on raunakpatil.com');
  const href = `mailto:${A.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  const a = document.createElement('a');
  a.href = href;
  a.click();
}

/* ======================= wiring ======================= */
function init() {
  const m = A.model;
  $('#rai-credit').innerHTML = `3D model: <a href="${esc(m.creditUrl)}" target="_blank" rel="noopener">${esc(m.credit)}</a> by <a href="${esc(m.authorUrl)}" target="_blank" rel="noopener">${esc(m.author)}</a>, <a href="${esc(m.licenseUrl)}" target="_blank" rel="noopener">${esc(m.license)}</a>`;
  const saved = store.get('rai-name');
  if (saved) answers.name = saved;
  syncSound();
  soundBtn.addEventListener('click', () => { soundOn = !soundOn; store.set('rai-sound', soundOn ? 'on' : 'off'); syncSound(); if (soundOn) blip(); });
  wakeBtn.addEventListener('click', wake);
  backBtn.addEventListener('click', () => {
    if (!canGoBack()) return;
    history.pop();
    while (history.length > 1 && !isInteractive(history[history.length - 1])) history.pop();
    go(history[history.length - 1], false);
  });
  sayEl.addEventListener('click', () => { if (skipTyping) skipTyping(); });
  addEventListener('keydown', (e) => {
    if (view.hidden) return;
    if (e.key === 'Escape') location.hash = '#dashboard';
    if (!awake && (e.key === 'Enter' || e.key === ' ') && document.activeElement === wakeBtn) { e.preventDefault(); wake(); }
  });
  if (!init3D()) showWake();
}

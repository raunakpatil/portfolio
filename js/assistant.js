/* R.O.N.I.E. ("Ronie") — Raunak's Own Neural Intelligence Engine.
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
let warmup = -1; // >0: frames left to render hidden before revealing the scene

function reveal() {
  root.classList.add('ready');
  loading.hidden = true;
  showWake();
}

export function open() {
  if (!started) { started = true; init(); }
}

/* ======================= 3D: Ronie in a neon room ======================= */
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
// the cursor is a little light source: it moves on a plane just in front of Ronie and lights his armour
const cursor = { x: 0, y: 0, inside: false, level: 0 };
let floorMat, tubeGlass, tubeMetal; // room materials that fade back while he's asleep
let smokeMat; const puffs = [];       // soft smoke, lit by the room's own lights
let dustVel = null;                    // per-particle velocity, so dust can be pushed around by the mouse
const cursorVel = new THREE.Vector3(), _prevCursor = new THREE.Vector3(); let cursorTracked = false;
let cursorRing; // the cursor's neon ring light: three coloured lights + a ring seen only in reflections
const ringLights = [], ringArcs = [];
const RING_R = 0.22;
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();

// The animation clip mixes still moments and big moves. Ronie holds a still pose (with breathing and
// mouse-follow layered on top) and only plays the one clean jump when you answer him.
const IDLE_AT = 12.8;                    // seconds: standing still
const JUMP_FROM = 13.1, JUMP_TO = 15.3;  // seconds: crouch, one jump, land back in the idle pose
let jumping = false, jumpW = 0;
// Waking up: he waits further back in the room, then takes one huge leap to his spot.
// The leap reuses the clip's biggest jump (crouch 6.6 s → take-off 7.35 s → landing 8.0 s → settled 8.8 s),
// with forward travel and the body leaning into the jump on top. In the air the clip only moves his limbs:
// his hips follow a true ballistic arc (a parabola), so the flight reads like a real jump.
const LEAP_BACK = 2.45, LEAP_APEX = 0.5;              // metres behind his spot; hip rise at the top of the arc
const LEAP_DELAY = 0.9, LEAP_CROUCH = 0.6, LEAP_AIR = 0.72, LEAP_LAND = 0.9; // seconds after waking
let hipBone = null, hipTakeoff = 0, hipLanding = 0, airK = -1; // hip heights (above his feet) at take-off and landing
const modelQuat = new THREE.Quaternion(), _lean = new THREE.Quaternion();
let leapAction = null, leapW = 0, landed = false, shake = 0, contact;
const homePos = new THREE.Vector3();

// The site's skill-bar colours (same hues as the dashboard's skill matrix), used for Ronie's neon tubes.
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
const OFF_CORE = new THREE.Color(0x070707), _c = new THREE.Color();
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
  scene.background = new THREE.Color(0x000000); // pitch black while he's asleep, rises to BG with the room light
  scene.fog = new THREE.Fog(0x000000, 6.5, 13);
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  // Reflections: a cube camera photographs the room from Ronie's chest a few times a second,
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
    const light = new THREE.PointLight(0xffffff, 0, 4, 2);
    const mid = ((k + 0.5) * Math.PI * 2) / 3;
    light.position.set(Math.cos(mid) * RING_R, Math.sin(mid) * RING_R, 0);
    cursorRing.add(arc, light);
    ringArcs.push(arc); ringLights.push(light);
  }
  scene.add(cursorRing);
  // listen on the whole Ronie view, so the light keeps following over the dialogue too
  root.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    cursor.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    cursor.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    cursor.inside = true;
  }, { passive: true });
  root.addEventListener('pointerleave', () => { cursor.inside = false; });

  // an unlit black floor (no coloured pools or reflections on it), plus a soft contact shadow under his feet
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 72), floorMat = new THREE.MeshBasicMaterial({ color: 0x000000 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const blob = document.createElement('canvas'); blob.width = blob.height = 128;
  const bx = blob.getContext('2d'); const bg = bx.createRadialGradient(64, 64, 4, 64, 64, 64);
  bg.addColorStop(0, 'rgba(0,0,0,.75)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = bg; bx.fillRect(0, 0, 128, 128);
  contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.003;
  scene.add(contact);


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
    root.classList.add('ready');
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
    leapAction = mixer.clipAction(clip.clone());
    leapAction.play();
    leapAction.paused = true;
    leapAction.time = 6.6;
    // measure how high his hips are at the moment of take-off and of landing
    hipBone = findBone(/CC_Base_Hip(_|$)/, /hip|pelvis/i);
    if (hipBone) {
      const hipAt = (time) => {
        idleAction.setEffectiveWeight(0); leapAction.setEffectiveWeight(1); leapAction.time = time;
        mixer.update(0); model.updateMatrixWorld(true);
        return hipBone.getWorldPosition(new THREE.Vector3()).y - model.position.y;
      };
      hipTakeoff = hipAt(7.35); hipLanding = hipAt(8.0);
      idleAction.setEffectiveWeight(1); leapAction.time = 6.6;
    }
    leapAction.setEffectiveWeight(0);
    mixer.update(0);
  }
  model.updateMatrixWorld(true);
  (head || model).getWorldPosition(headHome);
  target.set(headHome.x, headHome.y - 0.24, headHome.z); // headroom for his jump
  homePos.copy(model.position);
  modelQuat.copy(model.quaternion);
  placeForLeap(performance.now());

  buildTubes();
  buildAtmosphere();
  // the canvas stays hidden (black) while a few frames render, so nothing pops in; then it all fades in at once
  warmup = 3;
}

// Neon tubes in the site's palette, standing in a ring around Ronie: clear glass with rounded ends, a glowing
// core and metal caps, hanging from the ceiling on a cable and swaying gently. Tubes in front of him only appear in
// reflections (ENV_ONLY), so they light his chest without blocking the view.
function buildTubes() {
  const N = 22;
  baseAng = Math.atan2(facing.x, facing.z);
  const glass = tubeGlass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.24,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false,
  });
  const metal = tubeMetal = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, metalness: 1, roughness: 0.3 });
  const cable = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.55 });
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;                   // 0 = straight in front of him
    const R = [2.8, 4.2, 5.6][i % 3];                    // three evenly spaced rings: near, middle, far
    const a = baseAng + ang;
    const h = 1.1 + rand(i) * 1.3;                       // glowing length
    const y0 = 0.45 + rand(i + 300) * 0.9;               // each hangs at its own height (bottom of the glass)
    const top = y0 + h + 0.09;                           // where the cable attaches
    const yc = y0 + 0.045 + h / 2 - top;                 // centre of the tube, relative to the hanging point
    // the group's origin is the hanging point, so a small rotation reads as the tube swaying on its cable
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.position.set(Math.sin(a) * R, top, Math.cos(a) * R);
    g.rotation.y = a;
    const coreMat = new THREE.MeshBasicMaterial({ color: OFF_CORE.clone() });
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, h, 6, 12), coreMat);
    core.position.y = yc;
    core.layers.enable(GLOW);
    const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, h, 10, 24), glass);
    tube.position.y = yc;
    const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.1, 24), metal);
    capB.position.y = y0 + 0.03 - top;
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.058, 0.1, 24), metal);
    capT.position.y = -0.03;
    const wireLen = 7 - top;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, wireLen, 6), cable);
    wire.position.y = wireLen / 2;
    g.add(core, tube, capB, capT, wire);
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
      g, core, parts: [core, tube, capB, capT, wire], coreMat, col: PALETTE[i % PALETTE.length], top, mid: y0 + 0.045 + h / 2,
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
    tb.g.position.set(Math.sin(a) * tb.R, tb.top, Math.cos(a) * tb.R);
    // a slow, small sway on the cable
    const ts = performance.now() / 1000;
    tb.g.rotation.set(Math.sin(ts * 0.6 + tb.phase) * 0.03 * MOTION, a, Math.cos(ts * 0.47 + tb.phase * 1.3) * 0.025 * MOTION);
    const front = Math.cos(tb.ang) > COS75;
    if (front !== tb.front) {
      tb.front = front;
      for (const o of tb.parts) o.layers.set(front ? ENV_ONLY : 0);
      if (!front) tb.core.layers.enable(GLOW);
    }
    if (tb.light) {
      const r = tb.R - 0.35;
      tb.light.position.set(Math.sin(a) * r, tb.mid, Math.cos(a) * r);
    }
  }
}

// a soft, cloudy smoke sprite drawn once into a canvas
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const r = 30 + Math.random() * 70;
    const px = 128 + (Math.random() - 0.5) * 120, py = 128 + (Math.random() - 0.5) * 120;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }
  // fade the edges so no square ever shows
  x.globalCompositeOperation = 'destination-in';
  const m = x.createRadialGradient(128, 128, 40, 128, 128, 128);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Smoke and dust. Positions are set up around him relative to the way he faces.
const _right2 = new THREE.Vector3();
function buildAtmosphere() {
  _right2.crossVectors(UP, facing);
  const place = (sideways, height, depth) => new THREE.Vector3().addScaledVector(_right2, sideways).addScaledVector(facing, depth).setY(height);

  // smoke: camera-facing puffs with a lit (Lambert) material, so the tube colours and the mouse light tint them
  smokeMat = new THREE.MeshLambertMaterial({ map: smokeTexture(), color: 0x9a9a9a, transparent: true, opacity: 0, depthWrite: false });
  // each puff is a flat sprite; where one dips into the floor it would show a hard straight edge,
  // so the smoke fades out over the last 0.6 m above the floor
  smokeMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSmokeY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSmokeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSmokeY;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(0.0, 0.6, vSmokeY);');
  };
  for (let i = 0; i < 18; i++) {
    const ang = rand(i + 500) * Math.PI * 2, r = 1.6 + rand(i + 600) * 4;
    // keep the space right between him and the camera clear
    const sideways = Math.sin(ang) * r, depth = Math.cos(ang) * r;
    const near = depth > 0.6 && Math.abs(sideways) < 1.4;
    const size = 2 + rand(i + 700) * 2.4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), smokeMat);
    mesh.position.copy(place(near ? sideways + Math.sign(sideways || 1) * 1.6 : sideways, 0.15 + rand(i + 800) ** 2 * 1.3, near ? depth - 1.2 : depth));
    scene.add(mesh);
    puffs.push({ mesh, vel: new THREE.Vector3(), drift: new THREE.Vector3((rand(i + 900) - 0.5) * 0.04, 0.012 + rand(i + 950) * 0.02, (rand(i + 990) - 0.5) * 0.04), rot: rand(i) * 6, spin: (rand(i + 77) - 0.5) * 0.06, home: mesh.position.clone() });
  }

  // dust: tiny floating particles, mostly in the air around and in front of him
  const N = 420, pos = new Float32Array(N * 3);
  dustVel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = place((Math.random() - 0.5) * 6.5, Math.random() * 3.2, (Math.random() - 0.5) * 4.5 + 0.4);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe2c8, size: 0.013, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(dust);
}

// the mouse pushes particles out of its way and stirs them along the direction it moves
const _d = new THREE.Vector3();
function updateAtmosphere(dt) {
  const P = cursorRing ? cursorRing.position : null;
  const active = cursor.level > 0.05 && P;
  if (dust && dustVel) {
    const a = dust.geometry.attributes.position, arr = a.array;
    const damp = Math.exp(-2.4 * dt);
    for (let i = 0; i < arr.length; i += 3) {
      if (active) {
        const dx = arr[i] - P.x, dy = arr[i + 1] - P.y, dz = arr[i + 2] - P.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.8) {
          const d = Math.sqrt(d2) || 0.001, f = (1 - d / 0.894) * cursor.level;
          dustVel[i] += (dx / d * 2.2 + cursorVel.x * 0.9) * f * dt * 6;
          dustVel[i + 1] += (dy / d * 2.2 + cursorVel.y * 0.9) * f * dt * 6;
          dustVel[i + 2] += (dz / d * 2.2 + cursorVel.z * 0.9) * f * dt * 6;
        }
      }
      dustVel[i] *= damp; dustVel[i + 1] *= damp; dustVel[i + 2] *= damp;
      arr[i] += dustVel[i] * dt;
      arr[i + 1] += (dustVel[i + 1] + 0.035 * MOTION) * dt;   // a slow rise
      arr[i + 2] += dustVel[i + 2] * dt;
      if (arr[i + 1] > 3.3) arr[i + 1] = 0.02;
      if (arr[i + 1] < 0) arr[i + 1] = 0.02;
    }
    a.needsUpdate = true;
  }
  for (const p of puffs) {
    const m = p.mesh;
    if (active) {
      _d.subVectors(m.position, P);
      const d = _d.length();
      if (d < 1.6) {
        const f = (1 - d / 1.6) * cursor.level;
        p.vel.addScaledVector(_d.normalize(), 0.9 * f * dt).addScaledVector(cursorVel, 0.25 * f * dt);
      }
    }
    // drift, ease back towards where it started, damp the pushes
    p.vel.multiplyScalar(Math.exp(-0.8 * dt));
    m.position.addScaledVector(p.vel, dt).addScaledVector(p.drift, dt * MOTION);
    m.position.lerp(p.home, Math.min(1, dt * 0.05));
    p.rot += p.spin * dt * MOTION;
    m.lookAt(camera.position);
    m.rotateZ(p.rot);
  }
  if (smokeMat) smokeMat.opacity = 0.004 + 0.088 * power;
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
  scene.background.copy(BG).multiplyScalar(power);
  scene.fog.color.copy(scene.background);
  // while he's asleep the room is barely there: near-clear glass and dull caps
  // (his own lighting is untouched). Clearcoat never quite hits 0 so the shader isn't rebuilt.
  if (tubeGlass) {
    tubeGlass.opacity = 0.012 + 0.228 * power;
    tubeGlass.clearcoat = 0.02 + 0.98 * power;
    tubeGlass.envMapIntensity = 0.08 + 1.52 * power;
  }
  if (tubeMetal) { tubeMetal.color.setScalar(0.035 + 0.135 * power); tubeMetal.envMapIntensity = 0.05 + 0.95 * power; }
  if (dust) dust.material.opacity = 0.025 + 0.475 * power;
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
  // project the mouse onto a plane ~0.7 in front of his chest (facing the viewer) — wherever he's standing
  _hit.copy(target).addScaledVector(facing, 0.7);
  if (model) _hit.add(model.position).sub(homePos).setY(_hit.y);
  _plane.setFromNormalAndCoplanarPoint(facing, _hit);
  _ray.setFromCamera(_ndc.set(cursor.x, cursor.y), camera);
  if (_ray.ray.intersectPlane(_plane, _hit)) {
    if (cursorTracked && dt > 0) cursorVel.lerp(_d.subVectors(_hit, _prevCursor).divideScalar(dt), 0.35);
    _prevCursor.copy(_hit); cursorTracked = true;
    cursorRing.position.copy(_hit);
  }
  if (!cursor.inside) cursorVel.multiplyScalar(0.8);
  cursorRing.lookAt(camera.position);            // the ring faces him/the viewer…
  cursorRing.rotateZ(performance.now() / 1000 * 0.9); // …and slowly spins
  // on whenever the mouse is over the scene (awake or asleep); fades in and out softly
  const goal = cursor.inside ? 1 : 0;
  cursor.level += (goal - cursor.level) * Math.min(1, dt * 6);
  // cycles through the spectrum like the cursor trail; the three arcs sit 40° apart in hue so the ring
  // reads as one rich, shifting colour (120° apart would mix back to white on his armour)
  const t = Date.now() / 1000;
  const strength = (2.4 - 1.1 * power) * cursor.level; // stronger in the dark while he's asleep
  for (let k = 0; k < 3; k++) {
    // a slow cycle (~12 s round the spectrum); white while he's asleep, colour fades in as he wakes
    _c.setHSL(((t * 30 + k * 40) % 360) / 360, power, 0.55 + 0.45 * (1 - power));
    ringLights[k].color.copy(_c);
    ringLights[k].intensity = strength;
    ringArcs[k].material.color.copy(_c).multiplyScalar(0.3 + 3 * cursor.level);
  }
  cursorRing.visible = cursor.level > 0.02;
}

// where he is during the wake-up leap, and which moment of the clip he's in
const lerp = (a, b, k) => a + (b - a) * k;
const _hipW = new THREE.Vector3();
const smooth = (k) => k * k * (3 - 2 * k);
function placeForLeap(now) {
  if (!model) return 0;
  const since = awake ? (now - wakeAt) / 1000 - LEAP_DELAY : -1;
  let clipT = 6.6, prog = 0, w = 0, lean = 0;
  airK = -1;
  if (!MOTION || since >= LEAP_CROUCH + LEAP_AIR + LEAP_LAND) prog = 1;   // done (or motion reduced: just be there)
  else if (since >= 0 && since < LEAP_CROUCH) {
    // wind-up: ease down into the crouch, leaning forward and rocking back a touch
    const k = smooth(since / LEAP_CROUCH);
    clipT = lerp(6.6, 7.35, k); w = smooth(Math.min(1, (since / LEAP_CROUCH) * 2.5));
    lean = 0.14 * k; prog = -0.03 * k;
  } else if (since >= LEAP_CROUCH && since < LEAP_CROUCH + LEAP_AIR) {
    // air: explosive take-off and landing, a moment of hang at the top (clip runs fast-slow-fast)
    const k = (since - LEAP_CROUCH) / LEAP_AIR, u = 2 * k - 1;
    clipT = 7.675 + 0.325 * Math.sign(u) * Math.abs(u) ** 0.6;
    prog = -0.03 + 0.98 * k;                                  // steady forward speed, like a thrown body
    airK = k;
    lean = lerp(0.2, -0.1, smooth(k));                        // dives forward, then leans back to brake
    w = 1;
  } else if (since >= LEAP_CROUCH + LEAP_AIR) {
    // landing: absorb the impact, slide the last few centimetres, straighten up
    const k = (since - LEAP_CROUCH - LEAP_AIR) / LEAP_LAND;
    clipT = lerp(8.0, 8.8, k);
    prog = 0.95 + 0.05 * (1 - (1 - Math.min(1, k * 2.5)) ** 2);
    lean = -0.1 * (1 - smooth(Math.min(1, k * 1.6)));
    w = 1 - smooth(Math.max(0, (k - 0.45) / 0.55));
    if (!landed) { landed = true; landingBurst(); }
  }
  model.position.copy(homePos).addScaledVector(facing, -LEAP_BACK * (1 - prog));
  // lean around his feet, about the viewer's left-right axis (+ tips him towards the camera)
  model.quaternion.copy(modelQuat).premultiply(_lean.setFromAxisAngle(_right.crossVectors(UP, facing), lean));
  if (contact) {
    contact.position.set(model.position.x, 0.003, model.position.z);
    const up = airK >= 0 ? 4 * LEAP_APEX * airK * (1 - airK) : 0;
    contact.scale.setScalar(1 - Math.min(0.5, up * 0.5));
    contact.material.opacity = 1 - Math.min(0.75, up * 0.8);
  }
  if (leapAction) leapAction.time = clipT;
  return w;
}

// the landing: the camera jolts and the dust on the floor around his feet is thrown outwards
function landingBurst() {
  shake = 1;
  if (dust && dustVel) {
    const arr = dust.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const dx = arr[i] - homePos.x, dz = arr[i + 2] - homePos.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > 1.8 || arr[i + 1] > 1.4) continue;
      const f = (1 - d / 1.8) * (1 - arr[i + 1] / 1.4);
      dustVel[i] += (dx / d) * 3.2 * f; dustVel[i + 1] += 1.6 * f; dustVel[i + 2] += (dz / d) * 3.2 * f;
    }
  }
  for (const p of puffs) {
    _d.subVectors(p.mesh.position, homePos).setY(0);
    const d = _d.length() || 0.001;
    if (d < 3) p.vel.addScaledVector(_d.normalize(), 0.5 * (1 - d / 3));
  }
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

  // fixed camera framing the idle pose — it doesn't chase him when he moves
  const dist = 2.7 * Math.max(1, 1.05 / Math.max(camera.aspect, 0.3));
  camera.position.copy(target).addScaledVector(facing, dist).add(new THREE.Vector3(0, 0.14, 0));
  camera.lookAt(target);
  if (shake > 0.002) {
    // a short, decaying jolt when he lands
    const a = shake * shake * 0.05;
    camera.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0));
    shake *= Math.exp(-dt * 7);
  }
  _right.crossVectors(UP, facing); // the viewer's right, in world space
  lights.key.position.copy(camera.position).add(new THREE.Vector3(1.6, 2.4, 0.4));
  lights.moon.position.copy(facing).multiplyScalar(-4).add(new THREE.Vector3(-1.5, 3, 0));
  updateCursorLight(dt);
  updateAtmosphere(dt);

  if (model) {
    for (const [b, q] of rest) b.quaternion.copy(q);
    if (mixer) {
      // the jump plays once, then blends back into the still idle pose
      if (jumping && jumpAction.time >= JUMP_TO) { jumping = false; jumpAction.paused = true; }
      jumpW += ((jumping ? 1 : 0) - jumpW) * Math.min(1, dt * (jumping ? 10 : 3.5));
      jumpAction.setEffectiveWeight(jumpW);
      leapW = placeForLeap(now);
      leapAction.setEffectiveWeight(leapW);
      idleAction.setEffectiveWeight(Math.max(0, 1 - jumpW - leapW));
      mixer.update(dt);
    }
    model.updateMatrixWorld(true);
    if (airK >= 0 && hipBone) {
      // in flight: move him so his hips trace a clean parabola from take-off height to landing height
      const want = homePos.y + lerp(hipTakeoff, hipLanding, airK) + 4 * LEAP_APEX * airK * (1 - airK);
      model.position.y += want - hipBone.getWorldPosition(_hipW).y;
      model.updateMatrixWorld(true);
    }

    const t = now / 1000;
    // asleep he slumps forward; after waking he lifts his head as the room lights up
    const since = awake ? (now - wakeAt) / 1000 : -1;
    const slumpGoal = since > 0.7 ? 0 : 1;
    slump += (slumpGoal - slump) * Math.min(1, dt * (MOTION ? (awake ? 3 : 1.8) : 60));
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
  if (warmup > 0 && --warmup === 0) reveal();
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
  // the tubes flicker on, the room light rises, he lifts his head, leaps to his spot and starts talking
  setTimeout(() => { panel.hidden = false; go(A.start); }, MOTION ? (LEAP_DELAY + LEAP_CROUCH + LEAP_AIR + 0.45) * 1000 : 0);
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
  lines.push('', '— sent via Ronie on raunakpatil.com');
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

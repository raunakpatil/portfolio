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

// his spec sheet stays up for at least SHEET_MIN — worth a look even when he loads in a flash (from the cache)
const SHEET_MIN = 3000, sheetSince = performance.now();
function reveal() {
  const wait = SHEET_MIN - (performance.now() - sheetSince);
  if (wait > 0) { loadPct.textContent = '100%'; return void setTimeout(reveal, wait); }
  root.classList.add('ready');
  loading.hidden = true;
  showWake();
}

export function open() {
  if (!started) { started = true; init(); }
}

/* ======================= 3D: Ronie in a neon room ======================= */
let renderer, composer, bloomComposer, scene, camera, mixer, model, head, neck, spine, dust, idleAction, jumpAction;
let talkK = 0, talkBeat = 0;             // how much he's talking (0..1, eased) and the smoothed beat of his voice
const rest = new Map();                 // head/neck/spine: their animated pose, before the look/breathing offsets
const facing = new THREE.Vector3(0, 0, 1);
const target = new THREE.Vector3();
const headHome = new THREE.Vector3();  // head position in the idle pose — the camera frames this and stays still
let power = 0;                          // room light: 0 = off, 1 = on (follows the tubes after waking)
let slump = 1;                          // 1 = asleep, head down; 0 = upright
let listen = 0, listenUntil = 0;        // while the visitor types he leans in a little and tilts his head
const look = { x: 0, y: 0 };
const ptr = { x: 0, y: 0 };
const lights = {};
const BG = new THREE.Color(0x0d0d0d);
// the cursor is a little light source: it moves on a plane just in front of Ronie and lights his armour
const cursor = { x: 0, y: 0, inside: false, level: 0 };
let floorMat, tubeGlass, tubeMetal; // room materials that fade back while he's asleep
let emblemMat = null;                  // the glowing R.O.N.I.E crest on his chest plate
let faceMat = null;                    // his visor is an old CRT screen showing two expressive eyes
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
// Extra moves authored in Blender (models/ronie-anims.glb): idle variations he drifts into now and then,
// plus 'excited' and 'confused'. Each starts and ends in the idle pose, so they blend in and out cleanly.
const IDLE_MOVES = ['idle_look', 'idle_sway', 'idle_stretch', 'idle_hand'];
const gestures = {};
// 'gesture' is the move currently blended in (gestureW); 'fading' is one being faded out after it was interrupted
let gesture = null, gestureW = 0, playing = false, fading = null, fadingW = 0, nextIdleMove = 0, lastIdleMove = '';
// Waking up: he waits further back in the room, then takes one huge leap to his spot.
// The leap reuses the clip's biggest jump (crouch 6.6 s → take-off 7.35 s → landing 8.0 s → settled 8.8 s),
// with forward travel and the body leaning into the jump on top. In the air the clip only moves his limbs:
// his hips follow a true ballistic arc (a parabola), so the flight reads like a real jump.
const LEAP_BACK = 2.45, LEAP_APEX = 0.5;              // metres behind his spot; hip rise at the top of the arc
const LEAP_DELAY = 0.9, LEAP_CROUCH = 0.6, LEAP_AIR = 0.72, LEAP_LAND = 0.9; // seconds after waking
let hipBone = null, hipTakeoff = 0, hipLanding = 0, airK = -1; // hip heights (above his feet) at take-off and landing
const modelQuat = new THREE.Quaternion(), _lean = new THREE.Quaternion();
let leapAction = null, leapW = 0, landed = false, waved = false, shake = 0, contact;
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

// a real mouse (or pen) hovering: the only pointer he follows with his head and the cursor light. Phones and other
// touch screens can't hover, so there he just looks ahead and the light stays off.
const TOUCH = matchMedia('(hover: none), (pointer: coarse)');
const hovers = (e) => e.pointerType === 'mouse' && !TOUCH.matches;

function init3D() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    loading.textContent = "My 3D body didn't load on this device — but I can still talk.";
    return false;
  }
  renderer.setPixelRatio(quality.ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // pitch black while he's asleep, rises to BG with the room light
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
    if (!hovers(e)) return;                      // touch: no hovering, so no light to follow a finger around
    const r = canvas.getBoundingClientRect();
    cursor.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    cursor.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    cursor.inside = true;
  }, { passive: true });
  root.addEventListener('pointerleave', () => { cursor.inside = false; });

  // an unlit black floor (no coloured pools or reflections on it), plus a soft contact shadow under his feet
  // (it fades out towards its edge, so there's no horizon line where it meets the background)
  const fade = document.createElement('canvas'); fade.width = fade.height = 256;
  const fx = fade.getContext('2d'), fg = fx.createRadialGradient(128, 128, 0, 128, 128, 128);
  fg.addColorStop(0, '#fff'); fg.addColorStop(0.35, '#fff'); fg.addColorStop(1, '#000');
  fx.fillStyle = fg; fx.fillRect(0, 0, 256, 256);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 72), floorMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, alphaMap: new THREE.CanvasTexture(fade), depthWrite: false }));
  floor.renderOrder = -1;
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
    if (!hovers(e)) return;                      // touch: he looks ahead rather than chasing a finger
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
  buildPokeParts();

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
    loadGestures(clip);
  }
  model.updateMatrixWorld(true);
  (head || model).getWorldPosition(headHome);
  target.set(headHome.x, headHome.y - 0.24, headHome.z); // headroom for his jump
  homePos.copy(model.position);
  modelQuat.copy(model.quaternion);
  buildEmblem();
  buildFace();
  rHand = findBone(/CC_Base_R_Hand(_|$)/);
  buildCard();
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

// Dust. Positions are set up around him relative to the way he faces.
const _right2 = new THREE.Vector3();
function buildAtmosphere() {
  _right2.crossVectors(UP, facing);
  const place = (sideways, height, depth) => new THREE.Vector3().addScaledVector(_right2, sideways).addScaledVector(facing, depth).setY(height);

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
  if (envTick++ % 6) return;
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

// Render resolution adapts to the device: it starts at up to 1.5× the CSS size and steps down when frames come
// slowly (and back up when there's headroom). The glow pass runs at half that — it's a blur anyway.
const quality = { max: Math.min(1.5, window.devicePixelRatio || 1), ratio: Math.min(1.5, window.devicePixelRatio || 1), frames: 0, time: 0, dirty: false };
function adaptQuality(dt) {
  quality.frames++; quality.time += dt;
  if (quality.time < 2) return;
  const ms = (quality.time / quality.frames) * 1000;
  quality.frames = 0; quality.time = 0;
  const next = ms > 24 ? Math.max(0.75, quality.ratio - 0.25) : ms < 15 ? Math.min(quality.max, quality.ratio + 0.125) : quality.ratio;
  if (next !== quality.ratio) { quality.ratio = next; quality.dirty = true; }
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const s = renderer.getSize(new THREE.Vector2());
  if (s.x !== w || s.y !== h || quality.dirty) {
    quality.dirty = false;
    renderer.setPixelRatio(quality.ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(quality.ratio); composer.setSize(w, h);
    bloomComposer.setPixelRatio(quality.ratio * 0.5); bloomComposer.setSize(w, h);
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
  cursorRing.visible = cursor.level > 0.01;      // (off, it's not even faintly there — on phones it never comes on)
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

/* ======================= chest crest ======================= */
// "R.O.N.I.E" across his chest plate with a big R in a shield below, Superman style. The plate is curved, so
// the crest is a thin sheet baked to hug it (models/ronie-emblem.json: a grid of points on the plate, stored
// in the space of the bone that carries the plate). It rides on that bone, so it moves with him.
function emblemTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const font = '"Inter Tight", "Segoe UI", Arial, sans-serif';
  const neon = (draw) => {
    // a soft orange halo, then a bright warm core on top
    x.save(); x.shadowColor = '#ff7a1a'; x.shadowBlur = 34; x.strokeStyle = x.fillStyle = '#ff8a3d'; draw(); x.restore();
    x.save(); x.strokeStyle = x.fillStyle = '#ffe2c4'; draw(); x.restore();
  };
  const cx = 520;                                   // the plate's centre line on the texture
  // name across the top of the plate
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 88px ${font}`;
  if ('letterSpacing' in x) x.letterSpacing = '10px';
  neon(() => x.fillText('R.O.N.I.E', cx + 5, 182));
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  // the shield: flat top with bevelled corners, sides running down to a point
  const top = 262, bot = 762, w = 410;
  const shield = () => {
    x.beginPath();
    x.moveTo(cx - w / 2, top + 70); x.lineTo(cx - w / 2 + 70, top); x.lineTo(cx + w / 2 - 70, top); x.lineTo(cx + w / 2, top + 70);
    x.lineTo(cx, bot); x.closePath();
  };
  x.lineJoin = 'round'; x.lineWidth = 16;
  neon(() => { shield(); x.stroke(); });
  // the big R inside it
  x.font = `900 300px ${font}`;
  neon(() => x.fillText('R', cx, top + 200));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Rebuild a baked sheet: a grid of points (some missing) in a bone's space, with uvs across the grid.
// An optional per-point 'vis' (1 = on the dark glass) becomes an attribute for masking.
function bakedSheet(data) {
  let bone = null;
  model.traverse((o) => { if (!bone && o.isBone && o.name === data.bone) bone = o; });
  if (!bone) return null;
  const { nx, ny } = data, pos = [], uv = [], vis = [], index = [], at = new Int32Array(nx * ny).fill(-1);
  data.pos.forEach((p, k) => {
    if (!p) return;
    at[k] = pos.length / 3;
    pos.push(p[0], p[1], p[2]);
    uv.push((k % nx) / (nx - 1), 1 - Math.floor(k / nx) / (ny - 1));
    vis.push(data.vis ? data.vis[k] : 1);
  });
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = at[j * nx + i], b = at[j * nx + i + 1], c = at[(j + 1) * nx + i], d = at[(j + 1) * nx + i + 1];
    if (a >= 0 && b >= 0 && c >= 0) index.push(a, c, b);
    if (b >= 0 && c >= 0 && d >= 0) index.push(b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('vis', new THREE.Float32BufferAttribute(vis, 1));
  geo.setIndex(index);
  return { bone, geo, aspect: (data.x[1] - data.x[0]) / (data.y[1] - data.y[0]) };
}

async function buildEmblem() {
  try {
    const v = new URL(import.meta.url).search;
    const [data] = await Promise.all([
      fetch(`models/ronie-emblem.json${v}`).then((r) => r.json()),
      document.fonts ? document.fonts.load('900 100px "Inter Tight"').catch(() => {}) : null,
    ]);
    const sheet = bakedSheet(data);
    if (!sheet) return;
    const { bone, geo } = sheet;
    emblemMat = new THREE.MeshBasicMaterial({
      map: emblemTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, color: 0x000000,
    });
    const mesh = new THREE.Mesh(geo, emblemMat);
    mesh.frustumCulled = false;
    mesh.layers.enable(GLOW);                       // the neon blooms like the tubes
    bone.add(mesh);
  } catch (err) { console.warn('chest crest not loaded', err); }
}

/* ======================= CRT face ======================= */
// Two glowing eyes drawn by a shader on a sheet baked over his visor (models/ronie-visor.json, in head-bone
// space), plus one small icon at a time (an "emote" by the top corner, a topic icon below the eyes, or blush).
// Each eye morphs between a rounded box (circle ↔ bar), a happy ^ arc, a heart, a star and an ×, and can tilt.
// Per eye: [half width, half height, corner radius, arc, heart, star, cross, tilt]  (units: visor height = 1;
// tilt in radians, + lifts the outer corner)
const EYE = (w, h, r = Math.min(w, h), o = {}) => [w, h, r, o.arc || 0, o.heart || 0, o.star || 0, o.cross || 0, o.tilt || 0, o.quest || 0];
const O = (s) => EYE(s, s, s);
const BAR = (w, h, tilt = 0) => EYE(w, h, h, { tilt });
const ARC = (s) => EYE(s, s, s, { arc: 1 });
const FACES = {
  neutral:    { L: O(0.095), R: O(0.095) },
  happy:      { L: ARC(0.1), R: ARC(0.1) },
  laugh:      { L: ARC(0.112), R: ARC(0.112), bounce: 1 },
  love:       { L: EYE(0.11, 0.11, 0.11, { heart: 1 }), R: EYE(0.11, 0.11, 0.11, { heart: 1 }) },
  excited:    { L: EYE(0.118, 0.118, 0.118, { star: 1 }), R: EYE(0.118, 0.118, 0.118, { star: 1 }), bounce: 0.5 },
  wink:       { L: BAR(0.11, 0.02), R: O(0.095) },
  thinking:   { L: O(0.075), R: O(0.075), look: [0.07, 0.06] },
  curious:    { L: O(0.112), R: O(0.08), skew: -0.022, look: [0.03, 0.02] },
  surprised:  { L: O(0.125), R: O(0.125) },
  confused:   { L: EYE(0.1, 0.1, 0.1, { quest: 1, tilt: 0.12 }), R: EYE(0.1, 0.1, 0.1, { quest: 1, tilt: -0.12 }), look: [0.02, 0] },
  sad:        { L: BAR(0.1, 0.045, -0.32), R: BAR(0.1, 0.045, -0.32), look: [0, -0.05] },
  shy:        { L: ARC(0.09), R: ARC(0.09), look: [-0.04, -0.05] },
  proud:      { L: ARC(0.105), R: ARC(0.105), look: [0, 0.04] },
  smug:       { L: BAR(0.105, 0.045, 0.1), R: BAR(0.105, 0.045, 0.1), look: [0.05, 0] },
  nervous:    { L: O(0.085), R: O(0.085), jitter: 1 },
  determined: { L: BAR(0.105, 0.06, 0.3), R: BAR(0.105, 0.06, 0.3) },
  angry:      { L: BAR(0.118, 0.055, 0.78), R: BAR(0.118, 0.055, 0.78), jitter: 1, look: [0, -0.02] },
  dizzy:      { L: EYE(0.1, 0.1, 0.1, { cross: 1 }), R: EYE(0.1, 0.1, 0.1, { cross: 1 }) },
  sleepy:     { L: BAR(0.11, 0.016), R: BAR(0.11, 0.016) },
  // idle moments (see IDLE_BEATS)
  bored:      { L: BAR(0.105, 0.032, -0.05), R: BAR(0.105, 0.032, -0.05), look: [0, -0.035] },
  dreamy:     { L: ARC(0.092), R: ARC(0.092), look: [0.055, 0.065] },
  squint:     { L: BAR(0.105, 0.02, 0.2), R: EYE(0.075, 0.062, 0.05), look: [0, 0.005] },   // one eye narrowed: suspicious
  yawn:       { L: BAR(0.112, 0.013, -0.24), R: BAR(0.112, 0.013, -0.24), look: [0, 0.02] },
};
const face = {
  name: 'sleepy', L: [...FACES.sleepy.L], R: [...FACES.sleepy.R], look: [0, 0],
  glitch: 0, blinkAt: 0, blinkT: -1e9, talkUntil: 0, on: 0, skew: 0,
};
function setFace(name) {
  faceSetAt = performance.now();
  if (idle.beat) endBeat(true);
  if (!FACES[name] || name === face.name) return;
  face.name = name;
  face.glitch = 1;                                   // a short CRT glitch as the picture changes
}
// Idle faces: while nobody is talking to him he isn't just staring. Every few seconds he plays a little beat —
// glances around, gets bored, nods off and jolts awake, hums, winks, daydreams, eyes the cursor, yawns — then goes
// back to his face. Steps: [face, ms, { look: [x, y], icon, blink: count }]. Anything the conversation does
// (a new face, typing, his voice, the game) cuts a beat short.
const IDLE_BEATS = {
  look:     [['neutral', 800, { look: [-0.075, 0.012] }], ['neutral', 800, { look: [0.075, 0.012] }], ['curious', 900]],
  bored:    [['bored', 2800]],
  doze:     [['bored', 1000], ['sleepy', 1700, { icon: 'zzz' }], ['surprised', 650], ['neutral', 500, { blink: 1 }]],
  hum:      [['happy', 2800, { icon: 'music' }]],
  wink:     [['wink', 650]],
  daydream: [['dreamy', 2600, { icon: 'sparkle' }]],
  squint:   [['squint', 2200]],
  blinks:   [['neutral', 700, { blink: 2 }]],
  shy:      [['shy', 1800, { icon: 'blush' }]],
  yawn:     [['yawn', 1300], ['neutral', 350, { blink: 1 }]],
  smug:     [['smug', 1700, { look: [0.06, 0] }]],
};
const idle = { beat: null, step: null, i: 0, stepEnd: 0, next: 0, last: '', icon: false };
let faceSetAt = 0;
function endBeat(cut = false) {
  if (cut && idle.icon) setIcon(null);
  idle.beat = null; idle.step = null; idle.icon = false;
}
function updateIdleFace(now) {
  const quiet = awake && landed && MOTION && face.on >= 1 && face.name !== 'sleepy'
    && !voiceSrc && !('speechSynthesis' in window && speechSynthesis.speaking) && !skipTyping
    && now > face.talkUntil + 1500 && now > listenUntil + 3000 && now - faceSetAt > 6000
    && (idle.beat || icon.hideAt < now) && card.state === 'off' && !/busy|game/.test((tagEl && tagEl.dataset.mode) || '');
  if (!quiet) {
    if (idle.beat) endBeat(true);
    idle.next = Math.max(idle.next, now + 3500);
    return;
  }
  if (!idle.beat) {
    if (now < idle.next) return;
    const names = Object.keys(IDLE_BEATS).filter((n) => n !== idle.last);
    idle.last = names[(Math.random() * names.length) | 0];
    Object.assign(idle, { beat: IDLE_BEATS[idle.last], i: -1, stepEnd: now });
  }
  if (now < idle.stepEnd) return;
  idle.i++;
  if (idle.i >= idle.beat.length) { endBeat(); idle.next = now + 5000 + Math.random() * 6000; return; }
  const [name, ms, o = {}] = idle.beat[idle.i];
  idle.step = { face: name, look: o.look };
  idle.stepEnd = now + ms;
  face.glitch = Math.max(face.glitch, 0.3);
  if (o.icon) { setIcon(o.icon, ms); idle.icon = true; }
  if (o.blink) { face.blinkT = now; face.blinkAt = now + (o.blink > 1 ? 280 : 2400); }
}

// which face goes with which moment of the chat (a step can also say { face: '…' } in data.js)
function faceFor(id, step) {
  if (step && step.face) return step.face;
  if (/processing/.test(id)) return 'thinking';
  if (/completion|done/.test(id)) return 'happy';
  if (id === 'word-message') return 'wink';
  if (id === 'intro') return 'happy';
  if (/^(work|story|hire-intro)/.test(id)) return 'excited';
  return 'neutral';
}

/* ---- icon pack: glowing line icons drawn once into a small texture, shown on the visor ---- */
// slot: 'emote' floats by the top corner (anime style), 'topic' replaces both eyes, 'cheeks' spans under them
const ICON_SLOTS = { emote: { pos: [0.27, 0.33], size: 0.21 }, topic: { pos: [0, 0], size: 0.24 }, cheeks: { pos: [-0.035, -0.035], size: 0.62 } };
const PINK = [1, 0.45, 0.7], GOLD = [1, 0.85, 0.45], CYAN = [0.55, 0.95, 1], WHITE = [1, 0.97, 0.93];
const ICONS = (() => {
  const L = (x, pts, close) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); if (close) x.closePath(); x.stroke(); };
  const C = (x, cx, cy, r, a0 = 0, a1 = Math.PI * 2) => { x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke(); };
  const R = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r); x.stroke(); };
  const T = (x, s, size = 190) => { x.font = `900 ${size}px "Inter Tight", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 128, 136); };
  const star = (x, cx, cy, r1, r2, n = 4) => {
    x.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r2 : r1; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    x.closePath(); x.stroke();
  };
  return {
    heart: { slot: 'emote', tint: PINK, draw: (x) => { x.beginPath(); x.moveTo(128, 210); x.bezierCurveTo(30, 140, 40, 50, 128, 92); x.bezierCurveTo(216, 50, 226, 140, 128, 210); x.stroke(); } },
    sparkle: { slot: 'emote', tint: GOLD, draw: (x) => { star(x, 110, 140, 92, 22); star(x, 200, 60, 38, 10); } },
    star: { slot: 'emote', tint: GOLD, draw: (x) => star(x, 128, 136, 100, 42, 5) },
    question: { slot: 'emote', tint: CYAN, draw: (x) => T(x, '?', 210) },
    exclamation: { slot: 'emote', tint: GOLD, draw: (x) => T(x, '!', 210) },
    idea: { slot: 'emote', tint: GOLD, draw: (x) => { C(x, 128, 112, 58, Math.PI * 0.8, Math.PI * 2.2); L(x, [[100, 170], [156, 170]]); L(x, [[108, 200], [148, 200]]); L(x, [[128, 22], [128, 6]]); L(x, [[48, 60], [34, 46]]); L(x, [[208, 60], [222, 46]]); } },
    sweat: { slot: 'emote', tint: CYAN, draw: (x) => { x.beginPath(); x.moveTo(128, 40); x.bezierCurveTo(128, 40, 70, 130, 82, 170); x.arc(128, 165, 48, Math.PI * 0.9, Math.PI * 0.1, true); x.bezierCurveTo(186, 130, 128, 40, 128, 40); x.stroke(); } },
    music: { slot: 'emote', tint: CYAN, draw: (x) => { L(x, [[92, 190], [92, 60], [196, 40], [196, 170]]); L(x, [[92, 88], [196, 68]]); C(x, 70, 192, 24); C(x, 174, 172, 24); } },
    zzz: { slot: 'emote', tint: CYAN, draw: (x) => { L(x, [[40, 120], [110, 120], [40, 200], [110, 200]]); L(x, [[140, 50], [216, 50], [140, 130], [216, 130]]); } },
    dots: { slot: 'emote', tint: WHITE, draw: (x) => { for (const cx of [62, 128, 194]) C(x, cx, 140, 16); } },
    blush: { slot: 'cheeks', tint: PINK, draw: (x) => { for (const cx of [44, 212]) for (const d of [-14, 6, 26]) L(x, [[cx + d - 8, 150], [cx + d + 6, 128]]); } },
    briefcase: { slot: 'topic', tint: WHITE, draw: (x) => { R(x, 30, 84, 196, 130, 18); L(x, [[96, 84], [96, 56], [160, 56], [160, 84]]); L(x, [[30, 140], [226, 140]]); } },
    mail: { slot: 'topic', tint: WHITE, draw: (x) => { R(x, 28, 62, 200, 140, 14); L(x, [[34, 70], [128, 146], [222, 70]]); } },
    cap: { slot: 'topic', tint: WHITE, draw: (x) => { L(x, [[128, 50], [236, 100], [128, 150], [20, 100]], true); L(x, [[70, 124], [70, 180], [186, 180], [186, 124]]); L(x, [[236, 100], [236, 170]]); } },
    code: { slot: 'topic', tint: CYAN, draw: (x) => { L(x, [[84, 70], [30, 132], [84, 194]]); L(x, [[172, 70], [226, 132], [172, 194]]); L(x, [[146, 54], [110, 210]]); } },
    chip: { slot: 'topic', tint: CYAN, draw: (x) => { R(x, 64, 64, 128, 128, 14); R(x, 100, 100, 56, 56, 6); for (const v of [92, 128, 164]) { L(x, [[v, 64], [v, 30]]); L(x, [[v, 192], [v, 226]]); L(x, [[64, v], [30, v]]); L(x, [[192, v], [226, v]]); } } },
    chart: { slot: 'topic', tint: CYAN, draw: (x) => { L(x, [[30, 30], [30, 220], [226, 220]]); L(x, [[76, 190], [76, 140]]); L(x, [[124, 190], [124, 96]]); L(x, [[172, 190], [172, 60]]); } },
    play: { slot: 'topic', tint: [1, 0.5, 0.45], draw: (x) => { R(x, 22, 52, 212, 152, 40); L(x, [[106, 92], [170, 128], [106, 164]], true); } },
    pin: { slot: 'topic', tint: PINK, draw: (x) => { x.beginPath(); x.moveTo(128, 226); x.bezierCurveTo(60, 140, 54, 110, 54, 96); x.arc(128, 96, 74, Math.PI, 0); x.bezierCurveTo(202, 110, 196, 140, 128, 226); x.stroke(); C(x, 128, 96, 24); } },
    speech: { slot: 'topic', tint: WHITE, draw: (x) => { x.beginPath(); x.roundRect(26, 40, 204, 136, 30); x.moveTo(70, 176); x.lineTo(54, 222); x.lineTo(110, 176); x.stroke(); for (const cx of [86, 128, 170]) C(x, cx, 108, 8); } },
    trophy: { slot: 'topic', tint: GOLD, draw: (x) => { L(x, [[72, 40], [184, 40], [178, 110]]); C(x, 128, 104, 52, 0, Math.PI); L(x, [[72, 40], [78, 110]]); C(x, 64, 76, 26, Math.PI * 0.5, Math.PI * 1.5); C(x, 192, 76, 26, -Math.PI * 0.5, Math.PI * 0.5); L(x, [[128, 156], [128, 190]]); L(x, [[86, 214], [170, 214]]); L(x, [[100, 190], [156, 190]]); } },
    rocket: { slot: 'topic', tint: WHITE, draw: (x) => { x.beginPath(); x.moveTo(128, 22); x.bezierCurveTo(180, 60, 176, 130, 160, 170); x.lineTo(96, 170); x.bezierCurveTo(80, 130, 76, 60, 128, 22); x.stroke(); C(x, 128, 90, 18); L(x, [[96, 150], [62, 196], [100, 186]]); L(x, [[160, 150], [194, 196], [156, 186]]); L(x, [[114, 196], [128, 234], [142, 196]]); } },
    shield: { slot: 'topic', tint: CYAN, draw: (x) => { x.beginPath(); x.moveTo(128, 26); x.lineTo(210, 58); x.bezierCurveTo(210, 140, 176, 196, 128, 226); x.bezierCurveTo(80, 196, 46, 140, 46, 58); x.closePath(); x.stroke(); L(x, [[92, 128], [118, 156], [168, 98]]); } },
    coffee: { slot: 'topic', tint: GOLD, draw: (x) => { L(x, [[46, 100], [56, 210], [170, 210], [180, 100]], true); C(x, 186, 146, 30, -Math.PI * 0.5, Math.PI * 0.5); for (const v of [84, 114, 144]) L(x, [[v, 80], [v - 10, 60], [v, 40]]); } },
    wave: { slot: 'emote', tint: GOLD, draw: (x) => { R(x, 84, 96, 92, 120, 40); for (const [a, h] of [[96, 64], [118, 48], [140, 52], [162, 70]]) L(x, [[a, 110], [a, h]]); L(x, [[84, 150], [56, 118]]); for (const r of [40, 66]) C(x, 196, 70, r, -Math.PI * 0.45, -Math.PI * 0.05); } },
  };
})();
const icon = { name: null, slot: 'emote', tint: WHITE, shownAt: -1e9, hideAt: 0, tex: null, canvas: null };
// show an icon (by name) for a while; null hides the current one
function setIcon(name, holdMs = 4500) {
  const def = name && ICONS[name];
  if (!def) { icon.hideAt = Math.min(icon.hideAt, performance.now()); return; }
  if (!icon.canvas) { icon.canvas = document.createElement('canvas'); icon.canvas.width = icon.canvas.height = 256; }
  const x = icon.canvas.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = x.strokeStyle = '#fff';
  x.lineWidth = 15; x.lineCap = x.lineJoin = 'round';
  def.draw(x);
  if (icon.tex) icon.tex.needsUpdate = true;
  if (def.slot === 'topic') holdMs = Math.min(holdMs, 3600);
  Object.assign(icon, { name, slot: def.slot, tint: def.tint, shownAt: performance.now(), hideAt: performance.now() + holdMs });
}
// a topic icon for a chat reply, from what it's about (used when the model doesn't pick one)
const TOPIC_ICONS = [
  [/e-?mail|contact|reach (him|out)|get in touch/i, 'mail'], [/hire|hiring|job|recruit|career|work(s|ed|ing)? (at|for)|Sigma/i, 'briefcase'],
  [/MSc|degree|universit|studied|education|dissertation|graduat/i, 'cap'], [/YouTube|video|channel/i, 'play'],
  [/project|built|builds|app\b|GitHub|open.source|tool/i, 'code'], [/London|Nagpur|Bengaluru|Liverpool|based in|lives? in/i, 'pin'],
  [/Hindi|Marathi|languages?|speaks/i, 'speech'], [/certif|award|DIAT|trophy/i, 'trophy'],
  [/%|accuracy|consisten|dashboard|Power BI|data/i, 'chart'], [/RAG|LLM|RLHF|model|neural|\bAI\b/i, 'chip'],
  [/don.t know|not sure|no idea/i, 'question'],
];
const iconFor = (text) => (TOPIC_ICONS.find(([re]) => re.test(text)) || [])[1] || null;

const FACE_VERT = `
attribute float vis;
varying vec2 vUv; varying float vVis;
void main() { vUv = uv; vVis = vis; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FACE_FRAG = `
uniform vec4 uL, uR, uLx, uRx; uniform vec2 uLook, uCentre, uIconPos, uQ; uniform vec3 uIconTint;
uniform float uIconEyes;                                // 1: the icon is drawn twice, in place of the eyes
uniform float uAspect, uTime, uOn, uGlitch, uBright, uSkew, uIconSize, uIconAmt;
uniform sampler2D uIcon;
varying vec2 vUv; varying float vVis;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 turn(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdArc(vec2 p, float R, float t) {               // an upside-down U: happy closed eyes (^ ^)
  if (p.y < 0.0) return length(vec2(abs(p.x) - R, p.y)) - t;
  return abs(length(p) - R) - t;
}
float sdHeart(vec2 p) {                                // Inigo Quilez's heart, unit size
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)), dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float sdStar(vec2 p, float r) {                        // Inigo Quilez's 5-point star
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = 0.45 * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float sdCross(vec2 p, float w, float t) { return min(sdBox(turn(p, 0.785398), vec2(w, t), t), sdBox(turn(p, -0.785398), vec2(w, t), t)); }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// a "?" about 2s tall: a hook (a ring with a gap at the lower left), a stem down to the middle, and a dot
float sdQuestion(vec2 p, float s) {
  float t = 0.11 * s, R = 0.36 * s;
  vec2 c = vec2(0.0, 0.4 * s), q = p - c;
  const float gap = -1.806, hw = 0.864;                // gap centred at -103°, ±49.5°
  float a = atan(q.y, q.x) - gap;
  a = mod(a + 3.14159265, 6.2831853) - 3.14159265;
  float hook = abs(a) > hw ? abs(length(q) - R) - t
    : min(length(q - R * vec2(cos(gap - hw), sin(gap - hw))), length(q - R * vec2(cos(gap + hw), sin(gap + hw)))) - t;
  vec2 e0 = c + R * vec2(cos(gap + hw), sin(gap + hw));
  float stem = min(sdSegment(p, e0, vec2(0.0, -0.06 * s)), sdSegment(p, vec2(0.0, -0.06 * s), vec2(0.0, -0.2 * s))) - t;
  float dot0 = length(p - vec2(0.0, -0.5 * s)) - t * 1.25;
  return min(min(hook, stem), dot0);
}
// x: (heart, star, cross, tilt) — tilt already signed per eye; qm: how much the eye is a "?"
float eye(vec2 p, vec4 e, vec4 x, float qm) {
  p = turn(p, x.w);
  float d = sdBox(p, e.xy, min(e.z, min(e.x, e.y)));
  d = mix(d, sdArc(p + vec2(0.0, 0.035), e.x * 0.85, 0.026), e.w);
  if (x.x > 0.001) { float s = e.x * 2.0; d = mix(d, sdHeart((p + vec2(0.0, s * 0.55)) / s) * s, x.x); }
  if (x.y > 0.001) d = mix(d, sdStar(p + vec2(0.0, 0.01), e.x * 1.15), x.y);
  if (x.z > 0.001) d = mix(d, sdCross(p, e.x * 0.95, 0.024), x.z);
  if (qm > 0.001) d = mix(d, sdQuestion(p, e.x * 1.05), qm);
  return d;
}
float faceAt(vec2 p) {
  vec2 c = uCentre + uLook;
  return min(eye(p - (c + vec2(-0.2, uSkew)), uL, uLx, uQ.x), eye(p - (c + vec2(0.2, -uSkew)), uR, uRx, uQ.y));
}
float iconOne(vec2 p, vec2 at) {
  vec2 q = (p - at) / uIconSize + 0.5;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 0.0;
  return texture2D(uIcon, q).a;
}
float iconAt(vec2 p) {
  if (uIconEyes < 0.5) return iconOne(p, uIconPos);
  vec2 c = uCentre + uLook;                             // follow the gaze, like the eyes they replace
  return max(iconOne(p, c + vec2(-0.2, 0.0)), iconOne(p, c + vec2(0.2, 0.0)));
}
float glow(float d) { return smoothstep(0.008, -0.004, d) * 0.85 + 0.22 * exp(-max(d, 0.0) * 45.0); }
void main() {
  vec2 uv = vUv;
  // glitch: bands of the picture slip sideways
  float band = floor(uv.y * 38.0);
  uv.x += uGlitch * (hash(vec2(band, floor(uTime * 24.0))) - 0.5) * 0.14 * step(0.55, hash(vec2(band, 7.0)));
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  vec2 ca = vec2(0.007 + uGlitch * 0.025, 0.0);        // RGB fringing, like an old tube
  vec3 col = vec3(glow(faceAt(p + ca)), glow(faceAt(p)), glow(faceAt(p - ca)));
  col *= vec3(1.0, 0.97, 0.93) * (1.0 - uIconEyes * uIconAmt);   // the eyes step aside
  if (uIconAmt > 0.001) col += vec3(iconAt(p + ca), iconAt(p), iconAt(p - ca)) * uIconTint * uIconAmt * 0.95;
  // AMOLED: the screen itself stays pure black; only the eyes and icons give off light, with the CRT look
  col *= 0.74 + 0.26 * sin(vUv.y * 6.2832 * 72.0);    // scanlines
  col *= 0.95 + 0.05 * sin(uTime * 57.0);              // mains flicker
  col *= 0.88 + 0.24 * hash(vUv * 640.0 + fract(uTime) * 91.0); // grain inside the light
  // switching on: a dot, then a bright line, then the picture opens up
  float hOpen = smoothstep(0.0, 0.3, uOn), vOpen = smoothstep(0.3, 1.0, uOn);
  float inside = step(abs(vUv.x - 0.5), hOpen * 0.5 + 0.004) * step(abs(vUv.y - 0.5), vOpen * 0.5 + 0.004);
  float line = exp(-abs(vUv.y - 0.5) / (0.004 + vOpen * 0.2)) * exp(-abs(vUv.x - 0.5) / (0.01 + hOpen * 0.7)) * (1.0 - vOpen) * 2.2;
  col = max(col, 0.0) * inside * vOpen + vec3(line) * step(0.001, uOn);
  gl_FragColor = vec4(col * uBright * vVis, 1.0);
}`;

async function buildFace() {
  try {
    const data = await fetch(`models/ronie-visor.json${new URL(import.meta.url).search}`).then((r) => r.json());
    const sheet = bakedSheet(data);
    if (!sheet) return;
    if (!icon.canvas) { icon.canvas = document.createElement('canvas'); icon.canvas.width = icon.canvas.height = 256; }
    icon.tex = new THREE.CanvasTexture(icon.canvas);
    faceMat = new THREE.ShaderMaterial({
      vertexShader: FACE_VERT, fragmentShader: FACE_FRAG,
      uniforms: {
        uL: { value: new THREE.Vector4() }, uR: { value: new THREE.Vector4() },
        uLx: { value: new THREE.Vector4() }, uRx: { value: new THREE.Vector4() }, uQ: { value: new THREE.Vector2() },
        uLook: { value: new THREE.Vector2() }, uCentre: { value: new THREE.Vector2(-0.035, 0.09) },
        uAspect: { value: sheet.aspect }, uTime: { value: 0 }, uOn: { value: 0 }, uGlitch: { value: 0 }, uBright: { value: 1 }, uSkew: { value: 0 },
        uIcon: { value: icon.tex }, uIconPos: { value: new THREE.Vector2() }, uIconSize: { value: 0.2 }, uIconAmt: { value: 0 },
        uIconTint: { value: new THREE.Vector3(1, 1, 1) }, uIconEyes: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4,
    });
    // a black panel just under the eyes turns the glass into a deep AMOLED black (reflections stay faintly visible)
    const panel = new THREE.Mesh(sheet.geo, new THREE.ShaderMaterial({
      vertexShader: FACE_VERT,
      fragmentShader: 'varying vec2 vUv; varying float vVis; uniform float uDark; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uDark * vVis); }',
      uniforms: { uDark: { value: 0.82 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2,
    }));
    panel.frustumCulled = false;
    panel.renderOrder = 1;
    const mesh = new THREE.Mesh(sheet.geo, faceMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.layers.enable(GLOW);
    sheet.bone.add(panel, mesh);
  } catch (err) { console.warn('visor face not loaded', err); }
}

const easeOutBack = (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
function updateFace(now, dt) {
  if (!faceMat) return;
  const u = faceMat.uniforms, t = now / 1000;
  // the screen switches on just after the tubes start flickering
  const since = awake ? (now - wakeAt) / 1000 : -1;
  face.on = awake ? Math.min(1, Math.max(0, (since - 0.35) / (MOTION ? 0.7 : 0.01))) : 0;
  // morph towards the current expression (or the idle beat's, while he's left to himself)
  updateIdleFace(now);
  const goal = FACES[idle.step ? idle.step.face : face.name], k = 1 - Math.exp(-dt * 14);
  for (let i = 0; i < 9; i++) { face.L[i] += (goal.L[i] - face.L[i]) * k; face.R[i] += (goal.R[i] - face.R[i]) * k; }
  // blink every few seconds (not when the eyes are already closed or drawn as shapes)
  if (now > face.blinkAt) { face.blinkAt = now + 2200 + Math.random() * 3800; face.blinkT = now; }
  const bt = (now - face.blinkT) / 150;
  const open = face.L[1] > 0.04 && face.L[3] < 0.5 && face.L[4] + face.L[5] + face.L[6] + face.L[8] < 0.5;
  const blink = open && MOTION && bt < 2 ? 1 - Math.abs(bt - 1) : 0;
  // while he speaks, the eyes bounce with the loudness of his voice; otherwise a little bob as the text types
  const loud = voiceLoudness();
  const talk = !MOTION ? 0 : voiceSrc ? loud : now < face.talkUntil ? Math.abs(Math.sin(t * 17)) : 0;
  // eyes follow the mouse; an expression can add its own glance, a laughing bounce or a nervous jitter
  const g = (idle.step && idle.step.look) || goal.look || [0, 0];
  const bounce = MOTION && goal.bounce ? Math.abs(Math.sin(t * 9)) * 0.03 * goal.bounce : 0;
  const jitter = MOTION && goal.jitter ? [(Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.008] : [0, 0];
  face.look[0] += (look.x * 0.07 + g[0] - face.look[0]) * k;
  face.look[1] += (-look.y * 0.05 + g[1] + talk * 0.012 - face.look[1]) * k;
  const squash = (e) => {
    const h = Math.max(0.012, e[1] * (1 - 0.88 * blink) * (1 - talk * 0.08));
    return [e[0] * (1 + talk * 0.04), h, Math.min(e[2], h), e[3]];
  };
  u.uL.value.fromArray(squash(face.L));
  u.uR.value.fromArray(squash(face.R));
  // shapes + tilt (the tilt is mirrored, so + lifts both outer corners)
  u.uLx.value.set(face.L[4], face.L[5], face.L[6], -face.L[7]);
  u.uRx.value.set(face.R[4], face.R[5], face.R[6], face.R[7]);
  u.uQ.value.set(face.L[8], face.R[8]);
  u.uLook.value.set(face.look[0] + jitter[0], face.look[1] + bounce + jitter[1]);
  face.skew += ((goal.skew || 0) - face.skew) * k;
  u.uSkew.value = face.skew;
  // the icon pops in (with a little overshoot), bobs, and fades out when its time is up
  const age = (now - icon.shownAt) / 1000, left = (icon.hideAt - now) / 1000;
  const amt = !icon.name ? 0 : Math.max(0, Math.min(1, age / 0.15, left / 0.35));
  const slot = ICON_SLOTS[icon.slot];
  const pop = MOTION ? easeOutBack(Math.min(1, age / 0.35)) : 1;
  u.uIconAmt.value = amt;
  u.uIconSize.value = slot.size * Math.max(0.05, pop);
  u.uIconPos.value.set(slot.pos[0], slot.pos[1] + (MOTION && icon.slot === 'emote' ? Math.sin(t * 2.6) * 0.012 : 0));
  u.uIconTint.value.fromArray(icon.tint);
  u.uIconEyes.value = icon.slot === 'topic' ? 1 : 0;
  face.glitch *= Math.exp(-dt * 5);
  if (MOTION && Math.random() < dt * 0.08) face.glitch = Math.max(face.glitch, 0.5);  // the odd random glitch
  u.uGlitch.value = MOTION ? face.glitch : 0;
  u.uTime.value = t % 1000;
  u.uOn.value = face.on;
  u.uBright.value = 0.9 + 0.1 * power;
}

// the crest is dark while he sleeps and powers up with the room, flickering on like the tubes
function updateEmblem(now) {
  if (!emblemMat) return;
  const since = awake ? (now - wakeAt) / 1000 : -1;
  const flick = since > 0.3 && since < 0.9 ? (Math.sin(since * 61) > 0.2 ? 1 : 0.25) : 1;
  const hum = 0.94 + 0.06 * Math.sin(now / 1000 * 2.1);
  emblemMat.color.setScalar((0.06 + 1.1 * power) * flick * hum);
}

/* ======================= extra moves ======================= */
function loadGestures(idleClip) {
  const loader = new GLTFLoader();
  loader.load(`models/ronie-anims.glb${new URL(import.meta.url).search}`, (g) => {
    for (const clip of g.animations) {
      // only the skeleton's own bones: the file also carries the empty root nodes above them, which must keep
      // the model's own placement and scale
      clip.tracks = clip.tracks.filter((t) => t.name.startsWith('CC_Base_'));
      // a clip only animates the bones it moves; every other bone is held in the idle pose, so blending
      // it in never pulls an untouched limb towards the model's default pose
      const have = new Set(clip.tracks.map((t) => t.name));
      for (const tr of idleClip.tracks) {
        if (have.has(tr.name)) continue;
        const v = tr.createInterpolant().evaluate(IDLE_AT);
        clip.tracks.push(new tr.constructor(tr.name, [0], Array.from(v)));
      }
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.setEffectiveWeight(0);
      gestures[clip.name] = a;
    }
    nextIdleMove = performance.now() + 6000;
  }, undefined, (err) => console.warn('extra moves not loaded', err));
}

// play one of the moves (only when he's standing in his spot and not already busy)
function playGesture(name, duringLanding = false) {
  const a = gestures[name];
  if (!a || !MOTION || !awake || jumping) return false;
  if (!duringLanding && (!landed || leapW > 0.01)) return false;
  if (playing && (IDLE_MOVES.includes(name) || a === gesture)) return false;   // an idle never cuts a move short
  if (fading === a) { a.stop(); fading = null; fadingW = 0; }
  if (gesture === a) {
    // the same move is still fading out on its last frame (the idle pose, = its first frame): just run it again
    a.reset(); a.play(); playing = true;
    return true;
  }
  if (gesture) {
    // whatever was blended in fades out underneath the new move instead of snapping away
    if (fading) fading.stop();
    fading = gesture; fadingW = gestureW;
  }
  a.reset();
  a.setEffectiveWeight(0);
  a.play();
  gesture = a; gestureW = 0; playing = true;
  return true;
}

function updateGestures(now, dt) {
  if (gesture) {
    // a finished move holds its last frame (which is the idle pose) while its weight fades out
    // (except 'pickup': he keeps the photo up, on its last frame, until one of the throws takes over)
    if (playing && gesture.time >= gesture.getClip().duration - 0.001 && !(gesture === gestures.pickup && card.state === 'held')) playing = false;
    gestureW += ((playing ? 1 : 0) - gestureW) * Math.min(1, dt * (playing ? 9 : 5));
    gesture.setEffectiveWeight(gestureW);
    if (!playing && gestureW < 0.005) { gesture.stop(); gesture = null; gestureW = 0; }
  }
  if (fading) {
    fadingW *= Math.exp(-dt * 8);
    fading.setEffectiveWeight(fadingW);
    if (fadingW < 0.005) { fading.stop(); fading = null; fadingW = 0; }
  }
  // now and then, while he's just standing there, drift into one of the idle variations
  if (!gesture && awake && landed && leapW < 0.01 && !jumping && now > nextIdleMove && Object.keys(gestures).length) {
    const pick = IDLE_MOVES.filter((n) => n !== lastIdleMove && gestures[n]);
    const name = pick[(Math.random() * pick.length) | 0];
    if (name && playGesture(name)) lastIdleMove = name;
    nextIdleMove = now + 8000 + Math.random() * 7000;
  }
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
  if (!MOTION || since >= LEAP_CROUCH + LEAP_AIR + LEAP_LAND) {
    prog = 1;                                                // done (or motion reduced: just be there)
    // a tab in the background may skip the landing frames entirely: he has still landed
    if (awake && !landed) { landed = true; waved = true; }
  }
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
    // as he straightens up from the landing, an excited wave hello (it blends over the end of the landing)
    if (!waved && k > 0.4) {
      waved = true;
      if (playGesture('wave', true)) { setFace('happy'); setIcon('wave', 2600); nextIdleMove = now + 9000; }
    }
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
}

function startJump() {
  if (!jumpAction || jumping || !MOTION || playing) return;
  jumping = true;
  jumpAction.time = JUMP_FROM;
  jumpAction.paused = false;
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (view.hidden || document.hidden) { if (voiceSrc) stopVoice(); return; }   // left the page: stop talking
  adaptQuality(dt);
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
  updateEmblem(now);
  updateFace(now, dt);

  if (model) {
    // undo last frame's look/breathing offsets: put back the pose the animation itself produced. (The mixer
    // only writes a bone when its value changes, so resetting to the bind pose here made bones snap to it.)
    for (const [b, q] of rest) b.quaternion.copy(q);
    if (mixer) {
      // the jump plays once, then blends back into the still idle pose
      if (jumping && jumpAction.time >= JUMP_TO) { jumping = false; jumpAction.paused = true; }
      jumpW += ((jumping ? 1 : 0) - jumpW) * Math.min(1, dt * (jumping ? 10 : 3.5));
      jumpAction.setEffectiveWeight(jumpW);
      leapW = placeForLeap(now);
      leapAction.setEffectiveWeight(leapW);
      updateGestures(now, dt);
      idleAction.setEffectiveWeight(Math.max(0, 1 - jumpW - leapW - gestureW - fadingW));
      mixer.update(dt);
    }
    for (const [b, q] of rest) q.copy(b.quaternion);   // the animated pose, before this frame's offsets
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
    // talking: his head moves with what he says — small nods that dip on the louder syllables, slow glances to the
    // side and a slight conversational tilt — and the idle sway settles down while he does
    const speaking = MOTION && (voiceSrc || ('speechSynthesis' in window && speechSynthesis.speaking) || now < face.talkUntil);
    talkK += ((speaking ? 1 : 0) - talkK) * Math.min(1, dt * (speaking ? 5 : 2.5));
    const beat = voiceSrc ? voiceLevel : 0.5 + 0.5 * Math.sin(t * 8.3) * Math.sin(t * 2.9 + 1);   // no voice: a made-up rhythm
    talkBeat += (beat - talkBeat) * Math.min(1, dt * 9);
    const talkNod = talkK * (Math.sin(t * 4.6 + Math.sin(t * 1.3) * 2) * 0.03 + talkBeat * 0.05);
    const talkYaw = talkK * (Math.sin(t * 1.15 + Math.sin(t * 0.41) * 3) * 0.06);
    const sway = MOTION ? (Math.sin(t * 0.45) * 0.035 + Math.sin(t * 0.23 + 1) * 0.02) * (1 - 0.7 * talkK) : 0;
    // +yaw turns towards the viewer's right, +pitch looks down
    const yaw = look.x * 0.75 + talkYaw, pitch = look.y * 0.35 + talkNod;
    listen += ((now < listenUntil ? 1 : 0) - listen) * Math.min(1, dt * 3.5);
    turn(spine, yaw * 0.25 + sway * 0.6, pitch * 0.15 + breathe + slump * 0.18 + listen * 0.06);
    // the neck carries most of the turn: the helmet is skinned to both neck and head, so turning the head
    // much further than the neck bends it
    turn(neck, yaw * 0.5 + sway * 0.45, pitch * 0.5 + breathe * 0.5 + slump * 0.4);
    turn(head, yaw * 0.25 + sway * 0.25, pitch * 0.35 + slump * 0.35 + listen * 0.05);
    if (listen > 0.002) addWorldRotation(head, _q.setFromAxisAngle(facing, -0.17 * listen));   // a curious head tilt
    if (talkK > 0.002) addWorldRotation(head, _q.setFromAxisAngle(facing, talkK * Math.sin(t * 0.7 + 2) * 0.06));
    updatePokes(now, dt);
    updateCard(now, dt);
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
  face.name = 'surprised';
  // waking him is a click, so the browser lets him speak; start fetching the natural voice right away
  if (soundOn) { audioCtx().resume?.(); loadKokoro(); }
  // the tubes flicker on, the room light rises, he lifts his head, leaps to his spot and starts talking
  // (if his natural voice is still loading, he gives it up to 3 more seconds so his first line is spoken in it)
  setTimeout(async () => {
    if (soundOn) await Promise.race([loadKokoro(), new Promise((r) => setTimeout(r, 3000))]);
    panel.hidden = false; go(A.start);
  }, MOTION ? (LEAP_DELAY + LEAP_CROUCH + LEAP_AIR + 0.45) * 1000 : 0);
}

/* ======================= sound (optional typing blips) ======================= */
let soundOn = store.get('rai-sound') !== 'off';   // on unless the visitor switched it off
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
/* ======================= voice ======================= */
// With sound on, Ronie says every line he types. Computers that can run it get Kokoro, a small, natural and
// expressive voice model that runs in the browser (no server, no quota); it starts loading as soon as his room opens,
// and a line he says before it's ready just goes unspoken — never a different voice for a moment, as the mix sounds
// like two robots. Phones, and computers where Kokoro can't run or fails to load, get the device's own speech voice
// (a male English one where available) for the whole visit. No server voice: it would spend the free AI allowance
// the chat needs.
const VOICE = { model: 'onnx-community/Kokoro-82M-v1.0-ONNX', voice: 'am_puck', speed: 1.04, ...(A.voice || {}) };
let kokoroReady = false, kokoroFailed = false, kokoroLoading = null, voiceToken = 0, voiceSrc = null, voiceAnalyser = null, voiceLevel = 0;
let speechDone = Promise.resolve();               // settles when the line he's saying now is finished
const voiceData = new Uint8Array(256);
const audioCtx = () => (audio ||= new (window.AudioContext || window.webkitAudioContext)());

// The natural voice runs in a background thread (js/ronie-voice-worker.js), so generating speech never stalls the
// page; this is a tiny request/reply wrapper around it.
let voiceWorker = null, rpcId = 0;
const rpcWaiting = new Map();
function voiceRpc(msg) {
  return new Promise((resolve, reject) => {
    const id = ++rpcId;
    rpcWaiting.set(id, { resolve, reject });
    voiceWorker.postMessage({ ...msg, id });
  });
}
function loadKokoro() {
  if (kokoroLoading) return kokoroLoading;
  kokoroLoading = (async () => {
    // only where it runs well: a desktop browser with a GPU (WebGPU)
    if (!('gpu' in navigator) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return false;
    voiceWorker = new Worker(`js/ronie-voice-worker.js${new URL(import.meta.url).search}`, { type: 'module' });
    voiceWorker.onmessage = ({ data }) => {
      const w = rpcWaiting.get(data.id);
      if (!w) return;
      rpcWaiting.delete(data.id);
      if (data.ok) w.resolve(data); else w.reject(new Error(data.error));
    };
    await voiceRpc({ type: 'load', model: VOICE.model });
    kokoroReady = true;
    return true;
  })().catch((err) => { console.warn('natural voice unavailable, using the quick one', err); return false; })
    .then((ok) => { if (!ok) kokoroFailed = true; return ok; });
  return kokoroLoading;
}

function stopVoice() {
  voiceToken++;
  if (voiceSrc) { try { voiceSrc.stop(); } catch { /* already stopped */ } voiceSrc = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// play one chunk of audio through an analyser (so his eyes can move with his voice); resolves when it ends
function playVoice(buffer, my) {
  return new Promise((resolve) => {
    if (my !== voiceToken) return resolve();
    const ctx = audioCtx();
    // if the browser hasn't allowed audio, don't hold the conversation up waiting for silence to "finish"
    if (ctx.state !== 'running') return resolve();
    const failsafe = setTimeout(resolve, (buffer.duration + 1.5) * 1000);
    if (!voiceAnalyser) { voiceAnalyser = ctx.createAnalyser(); voiceAnalyser.fftSize = 256; voiceAnalyser.connect(ctx.destination); }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(voiceAnalyser);
    src.onended = () => { clearTimeout(failsafe); if (voiceSrc === src) voiceSrc = null; resolve(); };
    voiceSrc = src;
    src.start();
  });
}

// how loud he's speaking right now (0..1), smoothed — drives the eye bounce
function voiceLoudness() {
  if (!voiceSrc || !voiceAnalyser) { voiceLevel *= 0.8; return voiceLevel; }
  voiceAnalyser.getByteTimeDomainData(voiceData);
  let sum = 0;
  for (let i = 0; i < voiceData.length; i++) { const v = (voiceData[i] - 128) / 128; sum += v * v; }
  voiceLevel += (Math.min(1, Math.sqrt(sum / voiceData.length) * 5) - voiceLevel) * 0.5;
  return voiceLevel;
}

async function speak(text) {
  stopVoice();
  if (!soundOn || !text) return;
  const my = voiceToken;
  const said = text.replace(/R\.O\.N\.I\.E\./g, 'Ronie').replace(/\s+/g, ' ').trim();
  try {
    if (kokoroReady) {
      // sentence by sentence: the next one is generated while this one plays, so he starts talking quickly
      const parts = said.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) || [said];
      const make = (s) => voiceRpc({ type: 'speak', text: s.trim(), voice: VOICE.voice, speed: VOICE.speed });
      let next = make(parts[0]);
      for (let i = 0; i < parts.length; i++) {
        const out = await next;
        if (my !== voiceToken) return;
        next = i + 1 < parts.length ? make(parts[i + 1]) : null;
        const ctx = audioCtx(), buf = ctx.createBuffer(1, out.audio.length, out.rate);
        buf.copyToChannel(out.audio, 0);
        await playVoice(buf, my);
      }
      return;
    }
    // Kokoro is still on its way: this line goes unspoken rather than in a second, different voice
    if (!kokoroFailed) return;
    // phones, and computers that can't run Kokoro: the device's own voice (free, no server, no quota)
    await speakDevice(said, my);
  } catch { /* no voice this time — the text is still there */ }
}

// the most natural male English voice this device offers (Edge's "Natural" voices, iOS/macOS, Google's)
let deviceVoice;
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { deviceVoice = undefined; });
function pickDeviceVoice() {
  if (deviceVoice !== undefined) return deviceVoice;
  const all = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  if (!all.length) return null;           // not loaded yet — try again next line
  const en = all.filter((v) => /^en/i.test(v.lang));
  const male = /\b(guy|ryan|eric|davis|andrew|brian|christopher|roger|steffan|thomas|william|daniel|aaron|arthur|alex|fred|oliver|george|james|david|mark|male)\b/i;
  const score = (v) => (male.test(v.name) ? 4 : 0) + (/natural|neural|online|enhanced|premium/i.test(v.name) ? 3 : 0)
    + (/en-(gb|us)/i.test(v.lang) ? 1 : 0) + (/female|zira|susan|samantha|karen|moira|tessa|hazel|libby|sonia|aria|jenny/i.test(v.name) ? -6 : 0);
  deviceVoice = en.sort((a, b) => score(b) - score(a))[0] || null;
  return deviceVoice;
}
function speakDevice(text, my) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || my !== voiceToken) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickDeviceVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    u.rate = 1.03; u.pitch = 0.95;
    // no audio graph to measure here: his eyes bob along with each word instead
    u.onboundary = () => { face.talkUntil = performance.now() + 260; };
    const done = () => { clearTimeout(failsafe); resolve(); };
    u.onend = done; u.onerror = done;
    const failsafe = setTimeout(done, 1500 + text.length * 90);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

function blip() {
  if (!soundOn || kokoroReady || 'speechSynthesis' in window) return;   // when Ronie has a voice, the typing blips step aside
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
// what the visitor just said, in a white bubble above Ronie's answer (the same bubble as the dashboard's tunnel)
const prevEl = document.createElement('p');
prevEl.className = 'rai-prev';
panel.insertBefore(prevEl, sayEl);
function showYou(text) {
  prevEl.textContent = text || '';
  prevEl.classList.toggle('show', !!text);
}
// the label at the top of the panel: "R.O.N.I.E online / thinking… / mind reader · Q 07/30"
const statusEl = $('#rai-status');
const tagEl = $('#rai-tag');
function setStatus(text, mode = '') {
  if (statusEl) statusEl.textContent = text;
  if (tagEl) tagEl.dataset.mode = mode;
}

const fill = (text) => text
  .replace(/\{name\}/g, answers.name || 'friend')
  .replace(/\{visitor\}/g, answers.name || 'stranger')
  .replace(/\{email\}/g, A.email);

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
  // long answers get a smaller size so they fit the panel
  sayEl.classList.toggle('long', text.length > 150);
  sayEl.classList.toggle('xlong', text.length > 260);
  speechDone = speak(text);
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
      face.talkUntil = performance.now() + 140;
      setTimeout(tick, text[i - 1] === ',' || text[i - 1] === '.' ? 90 : 22);
    };
    tick();
  });
}

function go(id, push = true) {
  const step = A.steps[id];
  if (!step) return;
  // returning visitors: no need to ask their name again
  if (step.skipIfName && answers.name) return go(step.skipIfName, push);
  clearTimeout(autoTimer);
  if (push) history.push(id);
  showYou(null);
  setStatus('online');
  bar.style.width = `${(step.progress || 0) * 100}%`;
  // no going back into (or out of) the 'sending' steps — it would open the email again
  backBtn.hidden = !canGoBack() || !!step.send || id.endsWith('-completion');
  actions.innerHTML = '';
  if (step.send) compose(step.send);
  clearTimeout(confusedTimer);
  const mood = faceFor(id, step);
  setFace(mood);
  setIcon(step.icon || null);
  if (mood === 'excited' && playGesture('excited')) reacting = false;
  else if (reacting) { reacting = false; startJump(); }
  typeLine(lineFor(id, step)).then(() => showActions(id, step));
}

let reacting = false;
function react() {
  // go() usually follows straight away and decides how to react; if it doesn't (a link), just hop
  reacting = true;
  setTimeout(() => { if (reacting) { reacting = false; startJump(); } }, 0);
}
let confusedTimer = 0;
function confused() {
  setFace('confused');
  setIcon(null);
  playGesture('confused');
  clearTimeout(confusedTimer);
  confusedTimer = setTimeout(() => { const id = history[history.length - 1]; setFace(faceFor(id, A.steps[id])); }, 2600);
}

// lines that just talk and move on by themselves aren't worth going "back" to
const isInteractive = (id) => { const s = A.steps[id]; return !!(s && (s.input || s.choices || s.story || s.chat)); };
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

/* ======================= free chat ======================= */
// a body move for an answer when the model didn't pick one: from what was asked, and what he said
function moveFor(question, reply) {
  if (/\b(thank|thanks|cheers|ty)\b/i.test(question)) return 'bow';
  if (/^\s*(hi|hello|hey|yo|hiya|bye|goodbye|see you)\b/i.test(question)) return 'wave';
  if (/\byou(.re| are)\b.*\b(cute|adorable|funny|hilarious|smart|great|cool|awesome|amazing|nice)\b/i.test(question)) return 'scratch';
  if (/don.t know|not sure|no information|don.t have/i.test(reply)) return 'shake';
  if (/project|built|builds|YouTube|ResRescue|TriviaFlux|Interdimensional/i.test(reply)) return 'present';
  if (/certif|award|DIAT|\d+%/i.test(reply)) return 'flex';
  return Math.random() < 0.5 ? 'nod' : null;
}

// "Ask me anything": questions go to Ronie's chat worker (worker/), a small AI model that only knows the facts
// in data.js. The last few messages go along so follow-up questions work. If the worker can't answer (free daily
// allowance used up, offline…), Ronie says so in character and offers the menu.
const chatLog = [];
// Which model answers (Workers AI, or one of the Google fallbacks once its free allowance is used up) is settled
// while the room loads: the worker pings down its list and names the first that responds. Every message then goes
// straight to that model, and if a reply comes back from another one, Ronie sticks with that from then on.
let brain = null;
let brainReady = Promise.resolve();
function pickBrain() {
  if (!A.chatUrl) return;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  brainReady = fetch(A.chatUrl.replace(/\/chat$/, '/pick'), { method: 'POST', signal: ctl.signal })
    .then((r) => r.json()).then((j) => { if (typeof j.model === 'string') brain = j.model; })
    .catch(() => {}).finally(() => clearTimeout(timer));
}
async function askRonie() {
  if (!A.chatUrl) return null;
  await brainReady;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(A.chatUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: brain, messages: chatLog.slice(-8), name: answers.name || '' }), signal: ctl.signal,
    });
    if (!r.ok) return (await r.json().catch(() => ({}))).error === 'quota' ? { quota: true } : null;
    const j = await r.json();
    if (typeof j.model === 'string') brain = j.model;
    // { reply, face?, icon? } — the face and icon are the model's pick for this answer
    return typeof j.reply === 'string' && j.reply.trim() ? { ...j, reply: j.reply.trim() } : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

// buttons for the places an answer points to — his email, LinkedIn, GitHub, YouTube channel, or a project he names —
// so nobody has to copy an address out of a sentence; any address the model still writes out is swapped for words
const linkOf = (label) => (D.links.find((l) => l.label === label) || {}).href;
const PLACES = [
  { label: 'Email Raunak', href: () => `mailto:${A.email}`, test: /e-?mail|@\w+\.\w|get in touch|reach (out|him)|contact/i },
  { label: 'LinkedIn', href: () => linkOf('LinkedIn'), test: /linked\s?in/i },
  { label: 'GitHub', href: () => linkOf('GitHub'), test: /git\s?hub/i },
  { label: 'YouTube channel', href: () => linkOf('YouTube'), test: /youtube channel|fractured timelines/i },
];
function linksFor(reply) {
  const out = [];
  for (const p of PLACES) if (p.test.test(reply) && p.href()) out.push({ label: p.label, href: p.href() });
  for (const p of D.projects) {
    if (p.link && p.link !== '#' && reply.toLowerCase().includes(p.title.toLowerCase())) out.push({ label: p.title, href: p.link });
  }
  // about hiring or reaching him, but no place named: the ways to reach Raunak
  if (!out.length && /open to (work|new roles|opportunities)|\bhir(e|ing)\b|reach (him|out|raunak)|contact|connect|get in touch|next role/i.test(reply)) {
    for (const p of PLACES.slice(0, 2)) if (p.href()) out.push({ label: p.label, href: p.href() });
  }
  return out.slice(0, 6);
}
const scrubLinks = (text) => text
  .replace(/\s*\[\s*[a-z]+\s*:[^\]]*\]/gi, '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+\w/g, 'his email')
  .replace(/\(?https?:\/\/\S+?\)?(?=[\s,]|[.!?]?$|[.!?]\s)/g, 'the link below')
  .replace(/\s{2,}/g, ' ');
// the project an answer is about (the first one it names that has a picture), for him to hold up
function projectIn(text) {
  const t = text.toLowerCase();
  let best = null, at = Infinity;
  for (const p of D.projects) {
    const i = p.image && p.link && p.link !== '#' ? t.indexOf(p.title.toLowerCase()) : -1;
    if (i >= 0 && i < at) { best = p; at = i; }
  }
  return best;
}

// when there are buttons, he points at them — a different line each time
const POINT = ['The links are just below.', 'Tap one below to take a look.', "They're waiting right under this message.", 'Buttons below, if you want a closer look.', 'Everything you need is one tap below.', 'I left the links right underneath.', 'Scroll a hair down — the links are there.'];
const POINTS_DOWN = /\b(below|underneath|under this)\b/i;
function linkRow(links) {
  const row = document.createElement('div');
  row.className = 'rai-links';
  links.forEach((l, i) => {
    const a = document.createElement('a');
    a.className = 'rai-link';
    a.href = l.href;
    if (!l.href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    a.textContent = l.label;
    a.insertAdjacentHTML('beforeend', '<span aria-hidden="true">↗</span>');
    a.style.animationDelay = `${i * 60}ms`;
    row.appendChild(a);
  });
  return row;
}

// tap-to-ask suggestions: the ones not asked yet, best first
const suggested = new Set();
const nextSuggestions = (step, n = 3) => (step.suggest || []).filter((q) => !suggested.has(q)).slice(0, n);

function sendButton() {
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'rai-send';
  send.setAttribute('aria-label', 'Send');
  send.textContent = '→';
  return send;
}

// Talk to him: the browser's own speech recognition (Chrome, Edge, Safari — free, nothing of ours on a server).
// Tap the mic, ask out loud; the words appear in the box as you speak and go off when you stop. While he listens he
// leans in with his head tilted. Browsers without it just don't get the button.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
function micButton(el, err, submit) {
  const mic = document.createElement('button');
  mic.type = 'button';
  mic.className = 'rai-mic';
  mic.setAttribute('aria-label', 'Ask out loud');
  mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
  mic.addEventListener('click', () => {
    if (recognizer) { recognizer.stop(); return; }    // a second tap: done talking
    stopVoice();                                        // so he doesn't hear himself
    const r = recognizer = new Recognition();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    let heard = '';
    const before = el.placeholder;
    mic.classList.add('on'); mic.setAttribute('aria-label', 'Stop listening');
    el.placeholder = 'Listening…';
    err.textContent = '';
    setFace('curious');
    r.onresult = (e) => {
      heard = Array.from(e.results, (x) => x[0].transcript).join('').trim();
      el.value = heard;
      listenUntil = performance.now() + 1400;           // he leans in as the words come
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') err.textContent = 'The microphone is blocked — allow it in your browser to talk to me.';
      else if (e.error === 'no-speech') err.textContent = "I didn't catch that. Tap the mic and try again?";
      else if (e.error !== 'aborted') err.textContent = "My ears glitched. Try again, or type it.";
    };
    r.onend = () => {
      recognizer = null;
      mic.classList.remove('on'); mic.setAttribute('aria-label', 'Ask out loud');
      el.placeholder = before;
      if (heard) submit();
    };
    try { r.start(); } catch { recognizer = null; mic.classList.remove('on'); el.placeholder = before; }
  });
  return mic;
}

function showChat(id, step, offerEmail = false, links = []) {
  actions.innerHTML = '';
  actions.classList.remove('row');
  setStatus('online');
  if (links.length) actions.appendChild(linkRow(links));
  const field = document.createElement('div');
  field.className = 'rai-field';
  const el = document.createElement('input');
  el.type = 'text';
  el.maxLength = 300;
  el.placeholder = 'Ask about his work, projects, skills…';
  el.setAttribute('aria-label', 'Your question for Ronie');
  el.autocomplete = 'off';
  el.addEventListener('input', () => { listenUntil = performance.now() + 1400; });
  const send = sendButton();
  const err = document.createElement('p');
  err.className = 'rai-error';
  field.append(el);
  if (Recognition) field.append(micButton(el, err, () => actions.requestSubmit()));
  field.append(send);
  actions.appendChild(field);
  actions.appendChild(err);
  if (offerEmail) button('Email Raunak instead', 'rai-choice', () => { location.href = `mailto:${A.email}`; }, 60);
  // for anyone who'd rather not type
  const ideas = nextSuggestions(step);
  if (ideas.length) {
    const row = document.createElement('div');
    row.className = 'rai-suggest';
    row.setAttribute('aria-label', 'Suggested questions');
    ideas.forEach((q, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rai-chip';
      b.textContent = q;
      b.style.animationDelay = `${80 + i * 50}ms`;
      b.addEventListener('click', () => { el.value = q; actions.requestSubmit(); });
      row.appendChild(b);
    });
    actions.appendChild(row);
  }
  // the guessing game, offered as a tile under the chat
  if (G.offer && A.chatUrl) {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'rai-play';
    t.style.animationDelay = '220ms';
    // a four-point spark in the profile highlights' family of shapes; it turns on hover like theirs
    t.innerHTML = '<span class="rai-play-tile" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5c.7 4.6 3.9 7.8 8.5 8.5-4.6.7-7.8 3.9-8.5 8.5-.7-4.6-3.9-7.8-8.5-8.5 4.6-.7 7.8-3.9 8.5-8.5Z"/></svg></span>'
      + `<span class="rai-play-txt"><b>${esc(G.offer.title)}</b><span class="rai-play-sub">${esc(G.offer.kicker)}</span><span class="rai-play-s">${esc(G.offer.sub)}</span></span>`;
    t.addEventListener('click', startGame);
    actions.appendChild(t);
  }
  // someone else at this computer? let them give their own name
  if (answers.name) {
    const who = document.createElement('p');
    who.className = 'rai-who';
    who.style.animationDelay = '280ms';
    who.append(`// talking to ${answers.name} · `);
    const not = document.createElement('button');
    not.type = 'button';
    not.textContent = 'not you?';
    not.addEventListener('click', () => {
      delete answers.name;
      store.set('rai-name', '');
      chatLog.length = 0;
      go('your-name');
    });
    who.appendChild(not);
    actions.appendChild(who);
  }
  actions.onsubmit = async (e) => {
    e.preventDefault();
    if (recognizer) recognizer.abort();
    const q = el.value.trim();
    if (!q) { err.textContent = 'Type a question first.'; el.focus(); confused(); return; }
    el.disabled = send.disabled = true;
    suggested.add(q);
    el.value = '';   // the question moves up into the bubble
    // while he thinks, only the question stays: the suggestions and the game step aside
    actions.querySelectorAll('.rai-links, .rai-suggest, .rai-play, .rai-who, .rai-choice').forEach((n) => n.remove());
    setStatus('thinking…', 'busy');
    // the visitor's question sits above Ronie's answer
    showYou(q);
    chatLog.push({ role: 'user', content: q });
    setFace('thinking');
    setIcon('dots', 30000);
    if (!(holdingProject() && throwPhoto('toss'))) playGesture('think');
    sayEl.classList.remove('done');
    sayEl.textContent = '…';
    const answer = await askRonie();
    if (!history.length || history[history.length - 1] !== id) return;   // they've moved on meanwhile
    if (answer && answer.quota) {
      chatLog.pop();
      setFace('sleepy'); setIcon('zzz', 6000);
      setStatus('recharging', 'off');
      await typeLine(fill(step.quota || step.fallback));
      setFace('neutral');
      return showChat(id, step, true);
    }
    if (answer) {
      let reply = scrubLinks(answer.reply);
      const links = linksFor(`${answer.reply} ${reply}`);
      if (links.length && !POINTS_DOWN.test(reply)) reply = `${reply} ${pick(POINT)}`;
      chatLog.push({ role: 'assistant', content: reply });
      // his expression and icon follow the answer: the model's pick, or what the answer is about
      const mood = FACES[answer.face] ? answer.face : 'happy';
      const move = gestures[answer.move] ? answer.move : moveFor(q, reply);
      // about a project: he picks up its card and shows it while he talks (once a throw has landed); else his move
      const proj = projectIn(reply);
      if (proj) untilFree().then(() => { if (history[history.length - 1] === id && !pickUpProject(proj) && move) playGesture(move); });
      else if (move) playGesture(move);
      setFace(mood);
      // a "?" only when he's actually unsure; otherwise show what the answer is about
      const unsure = /don.t know|not sure|no information|don.t have/i.test(reply);
      const picked = ICONS[answer.icon] && !(answer.icon === 'question' && !unsure) ? answer.icon : null;
      const shown = picked || iconFor(reply);
      setIcon(mood === 'confused' && shown === 'question' ? null : shown, 9000);
      await typeLine(reply);
      setTimeout(() => { if (face.name === mood) setFace('neutral'); }, 2500);
      showChat(id, step, false, links);
    } else {
      chatLog.pop();
      setFace('sleepy');
      setIcon('zzz', 6000);
      setStatus('napping', 'off');
      await typeLine(fill(step.fallback || "I can't think right now. Try again in a bit?"));
      setFace('neutral');
      showChat(id, step, true);
    }
  };
  setTimeout(() => el.focus({ preventScroll: true }), 50);
}

/* ======================= guessing game ======================= */
// A picture of whoever he guesses. Only freely licensed pictures (Wikimedia Commons), so no film stills or posters.
// Wikidata first: of the things matching the name, people, characters and animals come before books, films and
// places (so "Harry Potter" is the boy, not the book series), and a film character with no free picture of their
// own gets the actor who played them. If that finds nothing, Wikipedia's free page images; else just the name.
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
const NOT_PIC = /logo|wordmark|signature|emblem|icon|symbol|flag|coat of arms|title card|poster|map|seal|autograph|districts/i;
const WHO = /character|actor|actress|singer|player|politician|cricketer|footballer|athlete|person|scientist|physicist|writer|author|musician|rapper|youtuber|businessperson|entrepreneur|mascot|species|animal|superhero|villain|wizard|detective|princess|king|queen|president|human|comedian|director|dancer|model|influencer|celebrity|leader/i;
const NOT_IT = /novel|book|film|video game|series|album|song|painting|sculpture|record label|pub|company|episode|experiment|television|franchise|play|musical|comic book|magazine|newspaper|ship|disambiguation|province|district|city|town|village|river|county|municipality|region|family name|given name/i;
async function getJSON(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try { return await (await fetch(url, { signal: ctl.signal })).json(); } catch { return null; } finally { clearTimeout(timer); }
}
const claims = (e, prop) => ((e && e.claims && e.claims[prop]) || []).map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(Boolean);
// its pictures, minus logos; "Daniel Radcliffe as Harry Potter" (the actor in the role) beats a drawing
const goodFile = (e) => { const f = claims(e, 'P18').filter((n) => !NOT_PIC.test(n)); return f.find((n) => / as /i.test(n)) || f[0]; };
async function commonsThumb(file) {
  const j = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=400'
    + `&titles=${encodeURIComponent(`File:${file}`)}`);
  const page = j && j.query && Object.values(j.query.pages || {})[0];
  return (page && page.imageinfo && page.imageinfo[0] && page.imageinfo[0].thumburl) || null;
}
async function findPicture(raw) {
  const name = raw.replace(/^(a|an|the)\s+/i, '');           // "Is it a lion?" → lion
  const found = await getJSON(`${WD}&action=wbsearchentities&language=en&uselang=en&type=item&limit=7&search=${encodeURIComponent(name)}`);
  const ids = ((found && found.search) || []).map((r) => r.id);
  if (ids.length) {
    const ents = ((await getJSON(`${WD}&action=wbgetentities&props=claims|descriptions&languages=en&ids=${ids.join('|')}`)) || {}).entities || {};
    const ranked = ids.map((id, i) => {
      const d = (ents[id] && ents[id].descriptions && ents[id].descriptions.en && ents[id].descriptions.en.value) || '';
      return { id, score: (WHO.test(d) ? 3 : NOT_IT.test(d) ? -2 : 0) - i * 0.1 };
    }).filter((c) => c.score > -1).sort((x, y) => y.score - x.score);
    for (const { id } of ranked) {
      const own = goodFile(ents[id]);
      if (own) return commonsThumb(own);
      // a film or TV character: the actor who played them
      const actor = claims(ents[id], 'P175')[0];
      if (actor && actor.id) {
        const a = ((await getJSON(`${WD}&action=wbgetentities&props=claims&ids=${actor.id}`)) || {}).entities;
        const file = a && goodFile(a[actor.id]);
        if (file) return commonsThumb(file);
      }
    }
  }
  const j = await getJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1'
    + `&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrlimit=1`
    + '&prop=pageimages&piprop=thumbnail&pithumbsize=400&pilicense=free');
  const page = j && j.query && Object.values(j.query.pages || {})[0];
  const src = page && page.thumbnail && page.thumbnail.source;
  return src && !NOT_PIC.test(decodeURIComponent(src)) && !/\.svg/i.test(src) ? src : null;
}
// The polaroid. When he guesses, he crouches ('pickup'), comes up holding a photo of the guess by his face, and
// later throws it away: 'toss_happy' when he got it right, 'toss_angry' when he didn't, 'toss' when the game stops.
// The photo turns up in his right hand at the bottom of the crouch (below the frame on a desktop), rides up with the
// hand, turns to face the viewer while he holds it, and flies off with spin and gravity once he lets go.
const PICK_GRAB = 1.0;                       // s into 'pickup': his hand is down at the floor
const TOSS = {                               // when each throw lets go, and its push: [viewer's right, up, towards the viewer] m/s
  toss_happy: { release: 0.5, push: [0.3, 4.6, -1.1], spin: 10 },
  toss_angry: { release: 0.52, push: [-1.0, -3.2, 1.4], spin: 15 },
  toss: { release: 0.42, push: [-2.6, 1.4, 0.3], spin: 8 },
};
const CARD_W = 0.27, CARD_H = 0.33;
const PROJ_W = 0.42, PROJ_H = 0.3;          // a project's card: landscape, so its 16:9 picture shows whole
const card = {
  group: null, tex: null, canvas: null, state: 'off', toss: null, token: 0, scale: 0, flyT: 0, name: '', img: null,
  mode: 'photo', project: null, faces: null, pCanvas: null, pTex: null, pFront: null, heldTimer: 0, dev: 1, picPending: false,
  vel: new THREE.Vector3(), spin: new THREE.Vector3(), prev: new THREE.Vector3(), handVel: new THREE.Vector3(),
};
let rHand = null, busyUntil = 0;
const _cv = new THREE.Vector3(), _cv2 = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cq2 = new THREE.Quaternion();
const _ce = new THREE.Euler(), _cz = new THREE.Vector3(0, 0, 1);
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));   // lying face-up
const untilFree = () => new Promise((r) => setTimeout(r, Math.max(0, busyUntil - performance.now())));

function buildCard() {
  card.canvas = document.createElement('canvas');
  card.canvas.width = 512; card.canvas.height = 626;
  card.tex = new THREE.CanvasTexture(card.canvas);
  card.tex.colorSpace = THREE.SRGBColorSpace;
  card.tex.anisotropy = 4;
  // lit by the room, but with a little glow of its own so it reads in the dark
  const front = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshStandardMaterial({
    map: card.tex, emissiveMap: card.tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.55 }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshStandardMaterial({
    color: 0xe8e3d8, emissive: 0xe8e3d8, emissiveIntensity: 0.15, roughness: 0.85 }));
  back.rotation.y = Math.PI;
  // the project card: the same paper, landscape
  card.pCanvas = document.createElement('canvas');
  card.pCanvas.width = 700; card.pCanvas.height = 500;
  card.pTex = new THREE.CanvasTexture(card.pCanvas);
  card.pTex.colorSpace = THREE.SRGBColorSpace;
  card.pTex.anisotropy = 4;
  card.pFront = new THREE.Mesh(new THREE.PlaneGeometry(PROJ_W, PROJ_H), new THREE.MeshStandardMaterial({
    map: card.pTex, emissiveMap: card.pTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.55 }));
  const pBack = new THREE.Mesh(new THREE.PlaneGeometry(PROJ_W, PROJ_H), back.material);
  pBack.rotation.y = Math.PI;
  card.faces = { photo: [front, back], project: [card.pFront, pBack] };
  card.group = new THREE.Group();
  card.group.add(front, back, card.pFront, pBack);
  card.group.visible = false;
  scene.add(card.group);
  setCardMode('photo');
}
function setCardMode(mode) {
  card.mode = mode;
  for (const [m, meshes] of Object.entries(card.faces)) for (const o of meshes) o.visible = m === mode;
}

// a project's card: its picture whole (16:9), its name underneath and a small "tap to open"
function drawProjectCard() {
  const c = card.pCanvas, x = c.getContext('2d'), W = c.width, H = c.height, m = 26, iw = W - 2 * m, ih = Math.round(iw * 9 / 16);
  const p = card.project || {}, img = card.img;
  x.fillStyle = '#f3efe6'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#1b1b1b'; x.fillRect(m, m, iw, ih);
  if (img) {
    const k = Math.min(iw / img.width, ih / img.height), dw = img.width * k, dh = img.height * k;
    x.drawImage(img, m + (iw - dw) / 2, m + (ih - dh) / 2, dw, dh);
  }
  x.textBaseline = 'middle';
  x.fillStyle = '#29241e'; x.textAlign = 'left';
  let size = 46;
  do { x.font = `italic ${size}px "Instrument Serif", Georgia, serif`; size -= 2; } while (x.measureText(p.title || '').width > iw - 150 && size > 24);
  x.fillText(p.title || '', m + 4, m + ih + (H - m - ih) * 0.42);
  x.fillStyle = '#8a8478'; x.textAlign = 'right'; x.font = '500 17px "JetBrains Mono", monospace';
  x.fillText('TAP TO OPEN ↗', W - m - 4, m + ih + (H - m - ih) * 0.42);
  card.pTex.needsUpdate = true;
}

/* ======================= pokes ======================= */
// Click (or tap) a part of him and he reacts. Each part is a capsule between two bones, measured on screen, so
// finding what was hit is cheap (no raycasting the skinned mesh) and the cursor can show it. The poked part flinches
// away from the push on a damped spring — out, back, a little wobble, settled — while his face, visor icon and,
// where it fits, a whole-body move react on top. He may glance at the spot. Keep poking and his patience runs out.
const POKE_K = 95, POKE_DAMP = 0.42;          // spring stiffness and damping ratio (under 1: one soft wobble)
const springs = [];                           // { bone, axis (world), angle, vel }
const glance = { yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, until: 0 };
const pokes = [];                             // when he was last poked, for his patience
// the shove: a tap pushes his whole body back a little along the push, then he eases back to his spot. His place
// is set afresh every frame (placeForLeap), so this is simply added on top, shadow and all.
const SHOVE_K = 55, SHOVE_DAMP = 0.78;
const shove = { off: 0, vel: 0, dir: new THREE.Vector3() };
const _shv = new THREE.Vector3();
// what he says when he's poked again and again
const OUCH = ['Ouch!', 'Oww!', 'Oof!', 'Ow, ow, ow!', 'Ouchie.', 'Hey! Ow!', 'Owie!', 'Okay — ow.', 'Ow! Rude.', 'Yowch!'];
let lastOuch = -1, ouchEl = null;
// poked in the crotch: both hands come down to cover it (two-bone IK on each arm, blended in over his pose) while he
// shakes his head — "no" — then everything eases back
const cover = { w: 0, until: 0, noAt: 0 };
const _ikS = new THREE.Vector3(), _ikE = new THREE.Vector3(), _ikH = new THREE.Vector3(), _ikT = new THREE.Vector3(), _ikD = new THREE.Vector3();
const _ikP = new THREE.Vector3(), _ikE2 = new THREE.Vector3(), _ikV1 = new THREE.Vector3(), _ikV2 = new THREE.Vector3();
const _ikQ = new THREE.Quaternion(), _ikI = new THREE.Quaternion();
// turn one arm (upper arm, forearm, hand) so the hand reaches target, the elbow bending towards pole; w blends it in
function armTo(up, fore, hand, target, pole, w) {
  up.getWorldPosition(_ikS); fore.getWorldPosition(_ikE); hand.getWorldPosition(_ikH);
  const a = _ikS.distanceTo(_ikE), b = _ikE.distanceTo(_ikH);
  _ikD.subVectors(target, _ikS);
  const d = Math.min(Math.max(_ikD.length(), Math.abs(a - b) + 1e-3), (a + b) * 0.995);
  _ikD.normalize();
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
  _ikP.subVectors(pole, _ikS);
  _ikP.addScaledVector(_ikD, -_ikP.dot(_ikD));                                             // the bend, square to the reach
  if (_ikP.lengthSq() < 1e-8) return;
  _ikP.normalize();
  _ikE2.copy(_ikS).addScaledVector(_ikD, a * cosA).addScaledVector(_ikP, a * sinA);       // where the elbow goes
  _ikQ.setFromUnitVectors(_ikV1.subVectors(_ikE, _ikS).normalize(), _ikV2.subVectors(_ikE2, _ikS).normalize());
  addWorldRotation(up, _ikI.identity().slerp(_ikQ, w));
  up.updateMatrixWorld(true);
  fore.getWorldPosition(_ikE); hand.getWorldPosition(_ikH);
  _ikT.copy(_ikS).addScaledVector(_ikD, d);                                                // the reachable target
  _ikQ.setFromUnitVectors(_ikV1.subVectors(_ikH, _ikE).normalize(), _ikV2.subVectors(_ikT, _ikE).normalize());
  addWorldRotation(fore, _ikI.identity().slerp(_ikQ, w));
  fore.updateMatrixWorld(true);
}
function updateCover(now, dt) {
  const B = pokeParts.B;
  if (!B || !B.pelvis || !B.lUp || !B.rUp || !B.lFore || !B.rFore || !B.lHand || !B.rHand) return;
  const goal = now < cover.until && card.state === 'off' ? 1 : 0;
  cover.w += (goal - cover.w) * Math.min(1, dt * (goal ? 9 : 3.6));
  if (cover.w > 0.002) {
    model.updateMatrixWorld(true);
    const w = smooth(Math.min(1, cover.w));
    B.pelvis.getWorldPosition(_pa);
    _pa.addScaledVector(facing, 0.17).addScaledVector(UP, -0.08);                         // just in front of his hips
    for (const side of [1, -1]) {
      const up = side > 0 ? B.lUp : B.rUp;
      up.getWorldPosition(_pb);
      _pc.copy(_pa).addScaledVector(_right, side * 0.055);                                   // the hands side by side
      _pm.copy(_pb).addScaledVector(_right, side * 0.45).addScaledVector(facing, -0.2).addScaledVector(UP, -0.25);   // elbows out
      armTo(up, side > 0 ? B.lFore : B.rFore, side > 0 ? B.lHand : B.rHand, _pc, _pm, w);
    }
  }
  // the "no": a quick head shake that fades
  const t = (now - cover.noAt) / 1000;
  if (cover.noAt && t >= 0 && t < 1.1) {
    const yaw = Math.sin(t * Math.PI * 2 * 2.4) * 0.26 * (1 - t / 1.1) * Math.min(1, t * 8);
    addWorldRotation(neck, _q.setFromAxisAngle(UP, yaw * 0.45));
    addWorldRotation(head, _q.setFromAxisAngle(UP, yaw * 0.55));
  }
}
let pokeParts = [], pokeFaceTimer = 0;
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _pm = new THREE.Vector3(), _ps = new THREE.Vector3(), _pdir = new THREE.Vector3();

function buildPokeParts() {
  const b = (re) => findBone(re);
  const B = {
    head, neck, spine, waist: b(/CC_Base_Waist_\d/), spine1: b(/CC_Base_Spine01_\d/), pelvis: b(/CC_Base_Pelvis_\d/),
    lClav: b(/CC_Base_L_Clavicle_\d/), rClav: b(/CC_Base_R_Clavicle_\d/),
    lUp: b(/CC_Base_L_Upperarm_\d/), rUp: b(/CC_Base_R_Upperarm_\d/), lFore: b(/CC_Base_L_Forearm_\d/), rFore: b(/CC_Base_R_Forearm_\d/),
    lHand: b(/CC_Base_L_Hand_\d/), rHand: b(/CC_Base_R_Hand_\d/),
    lThigh: b(/CC_Base_L_Thigh_\d/), rThigh: b(/CC_Base_R_Thigh_\d/), lCalf: b(/CC_Base_L_Calf_\d/), rCalf: b(/CC_Base_R_Calf_\d/),
    lFoot: b(/CC_Base_L_Foot_\d/), rFoot: b(/CC_Base_R_Foot_\d/),
  };
  // bones the springs move keep their animated pose between frames (see the frame loop)
  for (const k of ['pelvis', 'waist', 'lClav', 'rClav', 'lUp', 'rUp', 'lFore', 'rFore', 'lThigh', 'rThigh']) {
    if (B[k] && !rest.has(B[k])) rest.set(B[k], B[k].quaternion.clone());
  }
  // [part, from bone, to bone (or a lift up from 'from'), radius in m]; L/R are his left and right
  const P = (part, from, to, r, side = 0) => from && (to || typeof to === 'number') && pokeParts.push({ part, from, to, r, side });
  pokeParts = [];
  P('head', B.head, 0.2, 0.14);
  P('chest', B.spine1, B.neck, 0.2);
  P('belly', B.waist, B.spine1, 0.15);
  P('crotch', B.pelvis, -0.16, 0.12);
  P('shoulder', B.lClav, B.lUp, 0.12, 1); P('shoulder', B.rClav, B.rUp, 0.12, -1);
  P('arm', B.lUp, B.lFore, 0.09, 1); P('arm', B.rUp, B.rFore, 0.09, -1);
  P('arm', B.lFore, B.lHand, 0.08, 1); P('arm', B.rFore, B.rHand, 0.08, -1);
  P('hand', B.lHand, 0.12, 0.09, 1); P('hand', B.rHand, 0.12, 0.09, -1);
  P('leg', B.lThigh, B.lCalf, 0.12, 1); P('leg', B.rThigh, B.rCalf, 0.12, -1);
  P('leg', B.lCalf, B.lFoot, 0.1, 1); P('leg', B.rCalf, B.rFoot, 0.1, -1);
  pokeParts.B = B;
}

// a world point → canvas pixels
function toScreen(v, r) {
  _ps.copy(v).project(camera);
  return { x: (_ps.x + 1) / 2 * r.width, y: (1 - _ps.y) / 2 * r.height };
}
// the part under a pointer event, or null (with how far along it the hit was, 0 at 'from' … 1 at 'to')
function partAt(e) {
  if (!model || !camera || !pokeParts.length) return null;
  const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  let best = null, bestD = 1;
  for (const p of pokeParts) {
    p.from.getWorldPosition(_pa);
    if (typeof p.to === 'number') _pb.copy(_pa).addScaledVector(UP, p.to); else p.to.getWorldPosition(_pb);
    const a = toScreen(_pa, r), b = toScreen(_pb, r);
    // the capsule's radius on screen, from a point beside its middle
    _pm.addVectors(_pa, _pb).multiplyScalar(0.5);
    const m = toScreen(_pm, r), side = toScreen(_pm.addScaledVector(_right, p.r), r);
    const rad = Math.max(8, Math.hypot(side.x - m.x, side.y - m.y));
    const vx = b.x - a.x, vy = b.y - a.y, len2 = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / len2));
    const d = Math.hypot(px - (a.x + vx * u), py - (a.y + vy * u)) / rad;
    if (d < bestD) { bestD = d; best = { ...p, u }; }
  }
  return best;
}

// a flinch: the bone tips the way it was pushed and springs back
function flinch(bone, push, amount) {
  if (!bone) return;
  _pc.crossVectors(UP, push);
  if (_pc.lengthSq() < 1e-6) _pc.copy(_right);
  springs.push({ bone, axis: _pc.clone().normalize(), angle: 0, vel: amount });
}
// a twist: the bone turns about the vertical
function twist(bone, amount) { if (bone) springs.push({ bone, axis: UP.clone(), angle: 0, vel: amount }); }
function glanceAt(yaw, pitch, ms = 1300) { Object.assign(glance, { toYaw: yaw, toPitch: pitch, until: performance.now() + ms }); }

function updatePokes(now, dt) {
  if (dt > 0) {
    const c = 2 * POKE_DAMP * Math.sqrt(POKE_K);
    for (let i = springs.length - 1; i >= 0; i--) {
      const sp = springs[i];
      sp.vel += (-POKE_K * sp.angle - c * sp.vel) * dt;
      sp.angle += sp.vel * dt;
      if (Math.abs(sp.angle) < 1e-4 && Math.abs(sp.vel) < 1e-3) springs.splice(i, 1);
    }
  }
  for (const sp of springs) addWorldRotation(sp.bone, _q.setFromAxisAngle(sp.axis, sp.angle));
  if (model && (shove.off || shove.vel)) {
    if (dt > 0) {
      shove.vel += (-SHOVE_K * shove.off - 2 * SHOVE_DAMP * Math.sqrt(SHOVE_K) * shove.vel) * dt;
      shove.off += shove.vel * dt;
      if (Math.abs(shove.off) < 1e-4 && Math.abs(shove.vel) < 1e-3) shove.off = shove.vel = 0;
    }
    _shv.copy(shove.dir).multiplyScalar(shove.off).setY(0);
    model.position.add(_shv);
    if (contact) contact.position.add(_shv);
  }
  if (MOTION) updateCover(now, dt);
  // a glance at the spot: eases there, holds, eases back
  if (now > glance.until) glance.toYaw = glance.toPitch = 0;
  const k = Math.min(1, dt * 7);
  glance.yaw += (glance.toYaw - glance.yaw) * k; glance.pitch += (glance.toPitch - glance.pitch) * k;
  if (Math.abs(glance.yaw) > 1e-4) { addWorldRotation(neck, _q.setFromAxisAngle(UP, glance.yaw * 0.5)); addWorldRotation(head, _q.setFromAxisAngle(UP, glance.yaw * 0.5)); }
  if (Math.abs(glance.pitch) > 1e-4) { addWorldRotation(neck, _q.setFromAxisAngle(_right, glance.pitch * 0.5)); addWorldRotation(head, _q.setFromAxisAngle(_right, glance.pitch * 0.5)); }
}

// how he takes it: [faces (more annoyed further along), visor icon, a move now and then]
// for each part: faces for the first poke, faces once it keeps happening, visor icons, and a move now and then.
// Any of them can come up (never the same face twice running); past four pokes in a row it's the ANNOYED set.
const POKE = {
  head: { first: ['surprised', 'dizzy', 'squint', 'confused', 'nervous'], again: ['dizzy', 'squint', 'sad', 'nervous', 'bored'], icons: ['sweat', 'star', 'exclamation', 'question'], move: 'scratch' },
  chest: { first: ['laugh', 'surprised', 'proud', 'wink', 'happy'], again: ['smug', 'squint', 'nervous', 'determined', 'proud'], icons: ['exclamation', 'heart', 'sparkle', 'shield'], move: 'chest' },
  belly: { first: ['laugh', 'happy', 'wink', 'excited', 'love'], again: ['laugh', 'nervous', 'squint', 'dizzy'], icons: ['music', 'sparkle', 'heart', 'sweat'], move: 'laugh' },
  crotch: { first: ['shy', 'surprised', 'nervous', 'squint'], again: ['squint', 'angry', 'sad', 'determined', 'shy'], icons: ['blush', 'exclamation', 'sweat', 'shield'], move: null },
  shoulder: { first: ['curious', 'surprised', 'happy', 'wink', 'thinking'], again: ['confused', 'bored', 'smug', 'squint', 'curious'], icons: ['question', 'wave', 'speech', 'exclamation'], move: null },
  arm: { first: ['surprised', 'curious', 'happy', 'wink'], again: ['confused', 'bored', 'squint', 'nervous'], icons: [null, 'question', 'exclamation', 'sweat'], move: null },
  hand: { first: ['happy', 'excited', 'love', 'wink', 'surprised'], again: ['confused', 'smug', 'bored', 'happy'], icons: ['wave', 'heart', 'sparkle', 'star'], move: 'wave' },
  leg: { first: ['surprised', 'nervous', 'dizzy', 'curious'], again: ['confused', 'squint', 'sad', 'bored'], icons: ['exclamation', 'sweat', 'question', 'star'], move: null },
};
const ANNOYED = { faces: ['angry', 'squint', 'determined', 'smug', 'bored'], icons: ['exclamation', 'shield', 'sweat', 'zzz'] };
let lastPokeFace = '';
const pickNew = (list, not) => { const ok = list.filter((x) => x !== not && (!x || FACES[x] || ICONS[x])); return pick(ok.length ? ok : list); };
function poke(hit, e) {
  const now = performance.now();
  if (!awake) { if (wakeBtn && !wakeBtn.hidden) wake(); return; }   // asleep: a poke wakes him
  while (pokes.length && now - pokes[0] > 8000) pokes.shift();
  pokes.push(now);
  const n = pokes.length;                     // pokes in the last 8 s: 1 surprised … 3+ running out of patience
  const B = pokeParts.B, side = hit.side;
  // which way the push goes: from the camera through the spot, flattened
  const r = canvas.getBoundingClientRect();
  _ray.setFromCamera(_ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  _pdir.copy(_ray.ray.direction).setY(0).normalize();
  const f = MOTION ? Math.min(1.5, 1 + (n - 1) * 0.12) : 0;   // the more he's poked, the bigger the jolt
  const lr = side * 1;                        // +1 his left (the viewer's right)
  // the whole of him rocks back a step's worth, leaning with it, then settles back into place
  if (MOTION) {
    shove.dir.copy(_pdir);
    shove.vel += (hit.part === 'leg' || hit.part === 'hand' ? 0.45 : 0.8) * f;
    flinch(B.waist, _pdir, 0.7 * f);
  }
  switch (hit.part) {
    case 'head':
      flinch(head, _pdir, 2.6 * f); flinch(neck, _pdir, 1.6 * f); flinch(spine, _pdir, 0.5 * f);
      break;
    case 'chest':
      flinch(spine, _pdir, 2.2 * f); flinch(B.waist, _pdir, 0.8 * f); flinch(head, _pdir, -0.9 * f);   // the head lags behind
      glanceAt(0, 0.28);
      break;
    case 'belly':
      flinch(B.waist, _pdir, 2.0 * f); flinch(B.spine1, _pdir, 1.2 * f); flinch(head, _pdir, -0.8 * f);
      twist(spine, (Math.random() - 0.5) * 2.4 * f);   // squirms
      glanceAt(0, 0.35);
      break;
    case 'crotch':
      flinch(B.pelvis, _pdir, 2.4 * f); flinch(spine, _pdir, -1.6 * f);   // hips back, chest forward: a jolt
      glanceAt(0, 0.45, 900);
      cover.until = now + 1500; cover.noAt = now + 180;                  // both hands down to cover, and a "no"
      break;
    case 'shoulder': {
      const clav = side > 0 ? B.lClav : B.rClav, up = side > 0 ? B.lUp : B.rUp;
      flinch(clav, _pdir, 3.0 * f); flinch(up, _pdir, 1.6 * f);
      twist(spine, lr * 1.4 * f);             // the shoulder turns away
      glanceAt(lr * 0.75, 0.32, 1500);            // and he looks at it
      break;
    }
    case 'arm':
      flinch(side > 0 ? B.lUp : B.rUp, _pdir, 2.4 * f); flinch(side > 0 ? B.lFore : B.rFore, _pdir, 2.0 * f);
      glanceAt(lr * 0.6, 0.38, 1100);
      break;
    case 'hand':
      flinch(side > 0 ? B.lFore : B.rFore, _pdir, 2.8 * f);
      glanceAt(lr * 0.55, 0.5, 1100);
      break;
    case 'leg':
      flinch(side > 0 ? B.lThigh : B.rThigh, _pdir, 2.2 * f); flinch(B.pelvis, _pdir, 0.8 * f);
      glanceAt(lr * 0.3, 0.6, 1100);
      break;
  }
  blip();
  if (n >= 2) ouch();
  // his face and icon, angrier the more he's poked; a move, when he's free to make one
  const R = POKE[hit.part], fed = n >= 5;
  const mood = pickNew(fed ? ANNOYED.faces : n === 1 ? R.first : R.again, lastPokeFace);
  lastPokeFace = mood;
  setFace(mood);
  setIcon(pick(fed ? ANNOYED.icons : R.icons), 2200);
  clearTimeout(pokeFaceTimer);
  pokeFaceTimer = setTimeout(() => { if (face.name === mood) setFace('neutral'); }, 2400);
  const free = card.state === 'off' && !skipTyping;          // not holding a card, not mid-sentence
  if (free && MOTION) {
    const move = hit.part === 'crotch' ? null : n >= 6 ? 'shake' : n >= 4 && hit.part !== 'hand' ? 'confused' : R.move;
    if (move && (n === 1 || n >= 4 || Math.random() < 0.5)) setTimeout(() => playGesture(move), 260);   // after the flinch
  }
}

// "Ouch!": a little bubble that pops up by his head and floats away — and, with sound on, said out loud
// (unless he's in the middle of saying something, which a poke shouldn't cut off)
function ouch() {
  let i = (Math.random() * OUCH.length) | 0;
  if (i === lastOuch) i = (i + 1) % OUCH.length;
  lastOuch = i;
  const text = OUCH[i];
  if (head && camera) {
    if (!ouchEl) { ouchEl = document.createElement('span'); ouchEl.className = 'rai-ouch'; ouchEl.setAttribute('aria-hidden', 'true'); root.appendChild(ouchEl); }
    head.getWorldPosition(_pa).addScaledVector(UP, 0.3).addScaledVector(_right, 0.18);
    const r = canvas.getBoundingClientRect(), rr = root.getBoundingClientRect(), p = toScreen(_pa, r);
    ouchEl.textContent = text;
    ouchEl.style.left = `${Math.round(r.left - rr.left + p.x)}px`;
    ouchEl.style.top = `${Math.round(r.top - rr.top + p.y)}px`;
    ouchEl.style.setProperty('--tilt', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
    ouchEl.classList.remove('pop'); void ouchEl.offsetWidth; ouchEl.classList.add('pop');
  }
  const talking = voiceSrc || ('speechSynthesis' in window && speechSynthesis.speaking) || skipTyping;
  if (!talking) speak(text);
}

// talking about a project: down he goes for its card, and holds it up while he answers (false if he can't move now)
function pickUpProject(p) {
  if (!card.group || !rHand || !gestures.pickup || !playGesture('pickup')) return false;
  const my = ++card.token;
  Object.assign(card, { state: 'wait', toss: null, scale: 0, name: '', img: null, project: p });
  setCardMode('project');
  card.group.visible = false;
  drawProjectCard();
  if (document.fonts) document.fonts.load('italic 46px "Instrument Serif"').then(() => { if (my === card.token) drawProjectCard(); }).catch(() => {});
  const img = new Image();
  img.onload = () => { if (my === card.token) { card.img = img; drawProjectCard(); } };
  img.src = p.image;
  busyUntil = performance.now() + gestures.pickup.getClip().duration * 1000;
  // he doesn't hold it forever: after a while it goes over his shoulder
  clearTimeout(card.heldTimer);
  card.heldTimer = setTimeout(() => { if (my === card.token && card.mode === 'project') throwPhoto('toss'); }, 30000);
  return true;
}
const holdingProject = () => card.mode === 'project' && (card.state === 'held' || card.state === 'wait');

// tap the card he's holding to open the project
function cardUnder(e) {
  if (!holdingProject() || card.state !== 'held' || !card.project) return false;
  const r = canvas.getBoundingClientRect();
  _ray.setFromCamera(_ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  return _ray.intersectObject(card.pFront, false).length > 0;
}

// a guess's photo, found and downloaded (null if there's no free picture of it); started the moment the guess
// arrives, so it's usually ready by the time he picks the card up
function preparePicture(name) {
  if (!name) return Promise.resolve(null);
  return findPicture(name).then((url) => url && new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  })).catch(() => null);
}

// a polaroid: the picture (cover-fit, faces sit near the top of a portrait) and the name written underneath. While
// the photo is still on its way the square is a dark "developing" grey, and once it's in it fades up like a real
// polaroid (card.dev 0→1); a "?" only when there's no picture to be had
function drawCard() {
  const c = card.canvas, x = c.getContext('2d'), W = c.width, H = c.height, m = 30, side = W - 2 * m, img = card.img;
  x.fillStyle = '#f3efe6'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#1b1b1b'; x.fillRect(m, m, side, side);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (img) {
    x.fillStyle = '#ece8e0'; x.fillRect(m, m, side, side);
    const sz = Math.min(img.width, img.height);
    x.globalAlpha = card.dev;
    x.drawImage(img, (img.width - sz) / 2, (img.height - sz) * 0.12, sz, sz, m, m, side, side);   // heads sit near the top
    x.globalAlpha = 1;
    if (card.dev < 1) { x.fillStyle = `rgba(42, 40, 38, ${(1 - card.dev) * 0.9})`; x.fillRect(m, m, side, side); }
  } else if (card.picPending) {
    x.fillStyle = '#2a2826'; x.fillRect(m, m, side, side);
  } else {
    x.fillStyle = '#3c3c3c'; x.font = '300 230px "Inter Tight", sans-serif';
    x.fillText('?', W / 2, m + side / 2 + 10);
  }
  if (card.name) {
    x.fillStyle = '#29241e';
    let size = 56;
    do { x.font = `italic ${size}px "Instrument Serif", Georgia, serif`; size -= 2; } while (x.measureText(card.name).width > W - 2 * m && size > 22);
    x.fillText(card.name, W / 2, m + side + (H - m - side) * 0.4);   // high in the border: his fist holds the bottom
  }
  card.tex.needsUpdate = true;
}

// his guess: down he goes for a photo of it (false if he can't move right now). pic: the photo, from preparePicture
function pickUpPhoto(name, pic = preparePicture(name)) {
  if (!card.group || !rHand || !gestures.pickup || !playGesture('pickup')) return false;
  const my = ++card.token;
  Object.assign(card, { state: 'wait', toss: null, scale: 0, name: name || '', img: null, project: null, dev: 1, picPending: !!name });
  setCardMode('photo');
  clearTimeout(card.heldTimer);
  card.group.visible = false;
  drawCard();
  if (document.fonts) document.fonts.load('italic 56px "Instrument Serif"').then(() => { if (my === card.token) drawCard(); }).catch(() => {});
  pic.then((img) => {
    if (my !== card.token) return;
    card.picPending = false;
    // already in by the time he grabs it: shown straight away; else it develops in his hand
    if (img) { card.img = img; card.dev = card.state === 'wait' ? 1 : 0; }
    drawCard();
  });
  busyUntil = performance.now() + gestures.pickup.getClip().duration * 1000;
  return true;
}

// throw the photo away with one of the throws; returns false if there was nothing in his hand
function throwPhoto(kind) {
  if (card.state === 'wait') { card.state = 'off'; card.group.visible = false; return false; }   // not picked up yet
  if (card.state !== 'held') return false;
  if (!playGesture(kind)) { letGo(TOSS[kind].push, TOSS[kind].spin); return true; }
  card.toss = kind;
  busyUntil = performance.now() + gestures[kind].getClip().duration * 1000;
  return true;
}

function letGo(push, spin = 6) {
  card.state = 'flying'; card.flyT = 0; card.toss = null;
  card.vel.copy(card.handVel).multiplyScalar(0.5)
    .addScaledVector(_right, push[0]).addScaledVector(UP, push[1]).addScaledVector(facing, push[2]);
  card.spin.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
}

function updateCard(now, dt) {
  if (!card.group || card.state === 'off') return;
  const g = card.group, pick = gestures.pickup;
  if (card.state === 'flying') {
    card.flyT += dt;
    card.vel.y -= 9.8 * dt;
    g.position.addScaledVector(card.vel, dt);
    if (g.position.y < 0.02) {               // the floor: a soft bounce, then it slides to a stop
      g.position.y = 0.02;
      card.vel.y = Math.abs(card.vel.y) * 0.3; card.vel.x *= 0.55; card.vel.z *= 0.55; card.spin.multiplyScalar(0.5);
    }
    g.quaternion.multiply(_cq2.setFromEuler(_ce.set(card.spin.x * dt, card.spin.y * dt, card.spin.z * dt)));
    if (card.flyT > 1.6) card.scale -= dt * 3;
    g.scale.setScalar(Math.max(0.001, card.scale));
    if (card.scale <= 0) { card.state = 'off'; g.visible = false; }
    return;
  }
  rHand.updateWorldMatrix(true, false);
  rHand.getWorldPosition(_cv);
  if (dt > 0) card.handVel.lerp(_cv2.subVectors(_cv, card.prev).divideScalar(dt), 0.5);
  card.prev.copy(_cv);
  const holding = gesture === pick, tossing = !!card.toss && gesture === gestures[card.toss];
  if (card.state === 'wait') {
    if (!holding) { card.state = 'off'; return; }          // interrupted before his hand got there
    if (pick.time < PICK_GRAB) return;
    card.state = 'held'; g.visible = true; card.handVel.set(0, 0, 0);
  }
  if (!holding && !tossing) return letGo([0, 0.5, 0.4]);    // whatever he was doing got cut short: it drops
  if (tossing && gesture.time >= TOSS[card.toss].release) return letGo(TOSS[card.toss].push, TOSS[card.toss].spin);
  if (card.mode === 'photo' && card.img && card.dev < 1) { card.dev = Math.min(1, card.dev + dt / 1.3); drawCard(); }
  // in his hand: flat and low at the grab, upright by his face (turned to the viewer, a little tilted) once he stands
  const k = holding ? smooth(Math.min(1, Math.max(0, (pick.time - PICK_GRAB) / 0.8))) : 1;
  card.scale = Math.min(1, card.scale + dt * 7);
  g.position.copy(_cv).addScaledVector(UP, lerp(0.04, 0.2, k)).addScaledVector(facing, lerp(0.1, 0.05, k));
  if (card.mode === 'project') g.position.addScaledVector(_right, -0.09 * k);   // the wide card sits out clear of his face
  g.lookAt(camera.position);
  _cq.copy(g.quaternion).multiply(_cq2.setFromAxisAngle(_cz, -0.1 + (MOTION ? Math.sin(now / 650) * 0.025 : 0)));
  g.quaternion.copy(FLAT).slerp(_cq, k);
  g.scale.setScalar(Math.max(0.001, card.scale));
}
const guessedName = (text) => {
  const m = text.match(/\b(?:is it|was it|did you mean|are you thinking of|is this person|was this person|is this character|is the character|is he|is she)\s+(?:the\s+)?["“]?([^?"”]{2,60}?)["”]?\s*\?/i);
  return m ? m[1].trim().replace(/^(a|an|the)\s+/i, '').replace(/^(type|kind|sort) of\s+/i, '') : null;
};

// Like Akinator: the visitor thinks of someone or something; Ronie asks yes/no questions (worker mode 'game') and
// guesses. Every game opens with the same first question so the model starts on the right foot.
const G = A.game || {};
const GAME_ANSWERS = ['Yes', 'No', 'Probably', 'Probably not', "Don't know"];
const GAME_MAX = 30;
const game = { log: [], asked: 0, token: 0 };
const gfill = (s, extra = {}) => fill(s).replace(/\{answer\}/g, extra.answer || '');

async function askGame() {
  if (!A.chatUrl) return null;
  await brainReady;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(A.chatUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ mode: 'game', model: brain, messages: game.log.slice(-60), asked: game.asked, name: answers.name || '' }),
    });
    if (!r.ok) return (await r.json().catch(() => ({}))).error === 'quota' ? { quota: true } : null;
    const j = await r.json();
    if (typeof j.model === 'string') brain = j.model;
    return typeof j.reply === 'string' && j.reply.trim() ? j : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function gameButtons(list) {
  actions.innerHTML = '';
  actions.onsubmit = (e) => e.preventDefault();
  actions.classList.toggle('row', list.length > 2);
  list.forEach(([label, cls, fn], i) => button(label, cls, fn, i * 50));
}

async function startGame() {
  const my = ++game.token;
  throwPhoto('toss');
  Object.assign(game, { log: [], asked: 0 });
  clearTimeout(autoTimer);
  showYou(null);
  setStatus('mind reader', 'game');
  bar.style.width = '0%';
  setFace('excited'); setIcon('question', 3000); playGesture('present');
  actions.innerHTML = '';
  await typeLine(gfill(pick(G.intro || ['Think of someone. Ready?'])));
  if (my !== game.token) return;
  gameButtons([["I'm ready", 'rai-choice', () => gameAsk(my, true)], ['Never mind', 'rai-skip', endGame]]);
}

// Ronie's turn: the fixed first question, or whatever the model asks next
async function gameAsk(my, first = false) {
  if (my !== game.token) return;
  if (first) {
    game.log.push({ role: 'user', content: "I've thought of something. Start asking!" });
    game.log.push({ role: 'assistant', content: G.first });
    game.asked = 1;
    return showQuestion(my, { reply: G.first, face: 'curious', move: 'think' });
  }
  actions.innerHTML = '';
  setStatus('mind reader · thinking…', 'game busy');
  // (if he's still throwing away a wrong guess, he finishes that first)
  if (performance.now() >= busyUntil) { setFace('thinking'); setIcon('dots', 30000); if (Math.random() < 0.5) playGesture(Math.random() < 0.6 ? 'think' : 'scratch'); }
  else untilFree().then(() => { if (my === game.token && sayEl.textContent === '…') { setFace('thinking'); setIcon('dots', 30000); } });
  sayEl.classList.remove('done'); sayEl.textContent = '…';
  const res = await askGame();
  if (my !== game.token) return;
  if (!res || res.quota) {
    game.log.pop();
    setFace('sleepy'); setIcon('zzz', 5000);
    await typeLine(gfill((res && res.quota && G.quota) || G.fallback || 'Let me try again in a bit.'));
    if (my !== game.token) return;
    return gameButtons([['Try again', 'rai-choice', () => gameAnswer(my, game.lastAnswer)], ['Stop playing', 'rai-skip', endGame]]);
  }
  game.log.push({ role: 'assistant', content: res.reply });
  if (!res.guess) game.asked++;
  else { res.name = res.name || guessedName(res.reply); res.pic = preparePicture(res.name); }
  showQuestion(my, res);
}

// each question gets its own body language: a mix of moves, never the same one twice running, now and then none
const ASK_MOVES = ['think', 'scratch', 'point', 'present', 'nod', 'think', 'point'];
const askMoves = [];
function askMove(wanted) {
  if (Math.random() < 0.2) return null;
  const fresh = (m) => gestures[m] && !askMoves.slice(-2).includes(m);
  const m = wanted === 'shake' && fresh('shake') ? 'shake' : pick(ASK_MOVES.filter(fresh)) || null;
  if (m) askMoves.push(m);
  return m;
}

async function showQuestion(my, res) {
  await untilFree();                       // a photo still being thrown away lands first
  if (my !== game.token) return;
  bar.style.width = `${Math.min(1, game.asked / GAME_MAX) * 100}%`;
  setStatus(res.guess ? 'mind reader · my guess' : `mind reader · Q ${String(game.asked).padStart(2, '0')}/${GAME_MAX}`, 'game');
  let held = false;
  if (res.guess) {
    // he's got it! down he goes for a photo of his guess, and comes up holding it, thrilled
    setFace('excited'); setIcon(null);
    // a moment for the photo to arrive first (he's still "thinking"), so it's in his hand when he comes up
    await Promise.race([res.pic, new Promise((r) => setTimeout(r, 2500))]);
    if (my !== game.token) return;
    held = pickUpPhoto(res.name, res.pic);
    if (!held) playGesture('point');
  } else {
    setFace(FACES[res.face] ? res.face : 'curious'); setIcon(null);
    const move = askMove(res.move);
    if (move) playGesture(move);
  }
  await typeLine(res.reply);
  if (my !== game.token) return;
  if (res.guess) {
    if (held) await untilFree();           // the answers wait until he's up with the photo
    if (my !== game.token) return;
    return gameButtons([['Yes, you got it!', 'rai-choice rai-next', () => gameWon(my)],
      ['No, keep going', 'rai-choice', () => gameAnswer(my, 'No, that is not it. Keep asking.')], ['Stop playing', 'rai-skip', endGame]]);
  }
  if (game.asked > GAME_MAX) return gameLost(my);
  gameButtons([...GAME_ANSWERS.map((a) => [a, 'rai-choice', () => gameAnswer(my, a)]), ['Stop playing', 'rai-skip', endGame]]);
}

function gameAnswer(my, a) {
  if (my !== game.token) return;
  // a wrong guess: the photo gets hurled away in a huff
  if (throwPhoto('toss_angry')) { setFace('angry'); setIcon(null); }
  game.lastAnswer = a;
  game.log.push({ role: 'user', content: a });
  showYou(a.replace('No, that is not it. Keep asking.', 'No, keep going'));
  gameAsk(my);
}

async function gameWon(my) {
  if (my !== game.token) return;
  actions.innerHTML = '';
  bar.style.width = '100%';
  setStatus('mind reader · got it', 'game');
  // right! the photo goes flying, with a little jump of joy
  setFace('excited'); setIcon('star', 5000);
  if (!throwPhoto('toss_happy')) playGesture('excited');
  await typeLine(gfill(pick(G.win || ['Got it!'])));
  if (my !== game.token) return;
  gameButtons([['Play again', 'rai-choice rai-next', startGame], ['Back to chat', 'rai-skip', endGame]]);
}

async function gameLost(my) {
  actions.innerHTML = '';
  setFace('sad'); setIcon('sweat', 4000); playGesture('facepalm');
  setStatus('mind reader · you win', 'game');
  await typeLine(gfill(pick(G.lose || ['You win! Who was it?'])));
  if (my !== game.token) return;
  // let them tell him who it was
  actions.classList.remove('row');
  actions.innerHTML = '';
  const field = document.createElement('div');
  field.className = 'rai-field';
  const el = document.createElement('input');
  el.type = 'text'; el.maxLength = 60; el.placeholder = 'Who was it?'; el.setAttribute('aria-label', 'Who you were thinking of');
  field.append(el, sendButton());
  actions.appendChild(field);
  button('Back to chat', 'rai-skip', endGame, 100);
  actions.onsubmit = async (e) => {
    e.preventDefault();
    const who = el.value.trim().slice(0, 60);
    if (!who) { el.focus(); return; }
    showYou(who);
    actions.innerHTML = '';
    setFace('surprised'); playGesture('facepalm');
    await typeLine(gfill(pick(G.reveal || ['{answer}! Rematch?']), { answer: who }));
    if (my !== game.token) return;
    gameButtons([['Play again', 'rai-choice rai-next', startGame], ['Back to chat', 'rai-skip', endGame]]);
  };
  setTimeout(() => el.focus({ preventScroll: true }), 50);
}

function endGame() {
  game.token++;
  throwPhoto('toss');
  actions.classList.remove('row');
  go('ask');
}

function showActions(id, step) {
  if (step.chat) return showChat(id, step);
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
    if (inp.name === 'name') el.maxLength = 40;
    el.addEventListener('input', () => { listenUntil = performance.now() + 1400; });
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
      if (!v && !inp.optional) { err.textContent = 'I need something here first.'; el.focus(); confused(); return; }
      if (inp.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { err.textContent = "That doesn't look like an email address."; el.focus(); confused(); return; }
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
  // lines that move on by themselves wait until he has finished saying them
  if (step.next) {
    const mine = typingToken;
    speechDone.then(() => { if (mine === typingToken) autoTimer = setTimeout(() => go(step.next), soundOn ? 450 : 1300); });
  }
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
  const saved = store.get('rai-name');
  if (saved) answers.name = saved;
  pickBrain(); // settles which model answers while the room is still loading
  if (soundOn) loadKokoro();   // and his natural voice starts downloading now, not when he's woken
  syncSound();
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set('rai-sound', soundOn ? 'on' : 'off');
    syncSound();
    if (soundOn) { audioCtx().resume?.(); loadKokoro(); blip(); } else stopVoice();
  });
  wakeBtn.addEventListener('click', wake);
  // the project card in his hand opens the project
  canvas.addEventListener('click', (e) => {
    if (cardUnder(e)) return window.open(card.project.link, '_blank', 'noopener');
    const hit = partAt(e);
    if (hit) poke(hit, e);
  });
  canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = cardUnder(e) || partAt(e) ? 'pointer' : ''; }, { passive: true });
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




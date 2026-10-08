/* R.A.I. — Raunak's Artificial Intern.
   Loaded on demand (from main.js) the first time #assistant opens.
   The conversation script lives in js/data.js → assistant. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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

/* ======================= 3D: the robot ======================= */
let renderer, scene, camera, mixer, model, head, neck, spine, dust;
const rest = new Map();
const facing = new THREE.Vector3(0, 0, 1);
const target = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let power = MOTION ? 0.1 : 1;     // 0 = dark, 1 = fully on
let powerGoal = 0.1;
let nod = 0;                       // a quick nod when you answer
const look = { x: 0, y: 0 };
const ptr = { x: 0, y: 0 };
const lights = {};

function init3D() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    loading.textContent = "My 3D body didn't load on this device — but I can still talk.";
    return false;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

  lights.hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.5);
  lights.key = new THREE.DirectionalLight(0xffffff, 2.4);
  lights.orange = new THREE.PointLight(0xff7a1a, 0, 12, 1.6);
  lights.cyan = new THREE.PointLight(0x38e8ff, 0, 12, 1.6);
  scene.add(lights.hemi, lights.key, lights.orange, lights.cyan);

  // drifting dust for depth
  const N = 260, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 6; pos[i * 3 + 1] = Math.random() * 3.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffb27a, size: 0.012, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(dust);

  addEventListener('pointermove', (e) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(A.model.src, onModel, (e) => {
    if (e.total) loadPct.textContent = `${Math.round((e.loaded / e.total) * 100)}%`;
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
  model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
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
  // remember rest poses: bones the animation doesn't drive are reset each frame, so the mouse-follow never accumulates
  for (const b of [head, neck, spine]) if (b) rest.set(b, b.quaternion.clone());

  // which way is the robot facing? (from its eyes, if it has them)
  const eyeL = findBone(/L_Eye/), eyeR = findBone(/R_Eye/);
  if (head && eyeL && eyeR) {
    const h = head.getWorldPosition(new THREE.Vector3());
    const e = eyeL.getWorldPosition(new THREE.Vector3()).add(eyeR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const f = e.sub(h); f.y = 0;
    if (f.lengthSq() > 1e-8) facing.copy(f.normalize());
  }

  mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();

  (head || model).getWorldPosition(lookAt);
  target.copy(lookAt);
  loading.hidden = true;
  showWake();
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
  if (s.x !== w || s.y !== h) renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // leave room for the dialogue: robot sits right of centre on wide screens, higher up on phones
  if (w > 820) camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
  else camera.setViewOffset(w, h, 0, h * 0.26, w, h);
  camera.updateProjectionMatrix();
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (view.hidden || document.hidden) return;
  resize();

  power += (powerGoal - power) * Math.min(1, dt * (MOTION ? 2.2 : 60));
  renderer.toneMappingExposure = 0.06 + 0.94 * power;
  lights.key.intensity = 0.4 + 2.2 * power;
  lights.orange.intensity = 14 * power;
  lights.cyan.intensity = 9 * power;
  if (dust) {
    dust.material.opacity = 0.55 * power;
    dust.rotation.y += dt * 0.02;
    const p = dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.04; if (y > 3.2) y = 0; p.setY(i, y); }
    p.needsUpdate = true;
  }

  if (model) {
    for (const [b, q] of rest) b.quaternion.copy(q);
    if (mixer) mixer.update(MOTION ? dt : 0);
    model.updateMatrixWorld(true);

    // keep the camera framed on the head (in case the animation moves the body)
    const hp = (head || model).getWorldPosition(new THREE.Vector3());
    lookAt.lerp(hp, 1 - Math.pow(0.001, dt));
    target.set(lookAt.x, lookAt.y - 0.34, lookAt.z);
    // narrow/portrait screens pull the camera back so the whole upper body fits above the dialogue
    const dist = 2.9 * Math.max(1, 1.05 / Math.max(camera.aspect, 0.3));
    camera.position.copy(target).addScaledVector(facing, dist).add(new THREE.Vector3(0, 0.14, 0));
    camera.lookAt(target);
    _right.crossVectors(UP, facing); // the viewer's right, in world space
    lights.key.position.copy(camera.position).add(new THREE.Vector3(1.5, 2, 0));
    lights.orange.position.copy(lookAt).addScaledVector(facing, -1.2).add(new THREE.Vector3(-1.4, 0.4, 0));
    lights.cyan.position.copy(lookAt).addScaledVector(facing, -1.0).add(new THREE.Vector3(1.4, 0.2, 0));

    // follow the mouse: a little from the spine, more from the neck and head
    const k = awake ? 1 : 0.15;
    look.x += (ptr.x * k - look.x) * Math.min(1, dt * 5);
    look.y += (ptr.y * k - look.y) * Math.min(1, dt * 5);
    nod *= Math.pow(0.02, dt);
    const nodNow = Math.sin((1 - nod) * Math.PI * 2) * nod * 0.35;
    // +yaw turns towards the viewer's right, +pitch looks down
    const yaw = look.x * 0.75, pitch = look.y * 0.35 + nodNow;
    turn(spine, yaw * 0.25, pitch * 0.15);
    turn(neck, yaw * 0.3, pitch * 0.3);
    turn(head, yaw * 0.45, pitch * 0.55);
  }
  renderer.render(scene, camera);
}

/* ======================= power on ======================= */
function showWake() {
  if (awake) return;
  wakeBtn.hidden = false;
}
function wake() {
  if (awake) return;
  awake = true;
  wakeBtn.hidden = true;
  powerGoal = 1;
  if (MOTION) { root.classList.add('rai-glitch-on'); setTimeout(() => root.classList.remove('rai-glitch-on'), 800); }
  setTimeout(() => { panel.hidden = false; go(A.start); }, MOTION ? 650 : 0);
}

/* ======================= sound (optional typing blips) ======================= */
let soundOn = store.get('rai-sound') === 'on';
let audio = null;
function syncSound() {
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.classList.toggle('on', soundOn);
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

function react() { nod = 1; }

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
    button('Next →', 'rai-choice rai-next', () => { react(); go(step.story); }, 0);
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

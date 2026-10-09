/* Portfolio — interactive pieces. Content lives in js/data.js */
(() => {
  'use strict';

  const D = window.PORTFOLIO;
  // index.html loads this file as main.js?v=…; reuse that version so lazily-loaded files are fresh too
  const ASSET_V = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch { return ''; } })();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const TAU = Math.PI * 2;
  const MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
  const fmtDeg = (v, pos, neg) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  const coords = (lat, lon) => `${fmtDeg(lat, 'N', 'S')} ${fmtDeg(lon, 'E', 'W')}`;
  const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&@ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const randGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

  // Scramble a share of the characters for a moment, then settle on the real text.
  function glitch(el, text, { chars = '0123456789', percent = 0.3, duration = 800, speed = 50, color = 'rgba(255,255,255,.55)' } = {}) {
    clearInterval(el._glitch);
    if (!MOTION) { el.textContent = text; return; }
    const start = performance.now();
    el._glitchBusy = true;
    el._glitch = setInterval(() => {
      if (performance.now() - start >= duration) { clearInterval(el._glitch); el._glitchBusy = false; el.textContent = text; return; }
      el.innerHTML = [...text].map((ch) => (/[^\s,.]/.test(ch) && Math.random() < percent
        ? `<span style="color:${color}">${esc(chars[(Math.random() * chars.length) | 0])}</span>`
        : esc(ch))).join('');
    }, speed);
  }
  const PIN_ICON = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 9.5S1.5 6 1.5 4a3.5 3.5 0 0 1 7 0c0 2-3.5 5.5-3.5 5.5Z" fill="none" stroke="currentColor"/><circle cx="5" cy="4" r="1.1" fill="currentColor"/></svg>';

  function seeded(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    h |= 1;
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }

  /* ---------- shared animation loop: only runs components that are on screen ---------- */
  const loops = [];
  function onFrame(el, fn) {
    const entry = { el, fn, visible: false, warned: false };
    new IntersectionObserver((es) => { entry.visible = es[es.length - 1].isIntersecting; }).observe(el);
    loops.push(entry);
  }
  let prevT = performance.now();
  function frame(now) {
    // schedule the next frame first, so nothing below can ever stop the loop
    requestAnimationFrame(frame);
    const dt = Math.min(50, now - prevT);
    prevT = now;
    if (document.hidden) return;
    for (const l of loops) {
      // IntersectionObserver reports a frame late when a page is hidden; skip
      // anything with no size (its view is display:none) instead of drawing at 0×0
      if (!l.visible || !l.el.offsetWidth || !l.el.offsetHeight) continue;
      try {
        l.fn(now, dt);
      } catch (err) {
        if (!l.warned) { l.warned = true; console.error('Animation error (others keep running):', err); }
      }
    }
  }

  function fit(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    const changed = canvas.width !== w || canvas.height !== h;
    if (changed) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: width, h: height, changed };
  }

  function trackPointer(el) {
    const p = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      p.x = e.clientX - r.left; p.y = e.clientY - r.top;
      p.nx = (p.x / r.width) * 2 - 1; p.ny = (p.y / r.height) * 2 - 1;
      p.inside = true;
    });
    el.addEventListener('pointerleave', () => { p.x = p.y = -9999; p.nx = p.ny = 0; p.inside = false; });
    return p;
  }

  /* ---------- generated thumbnails (used when a project has no image) ---------- */
  const KIND = { dashboard: 'dashboard', app: 'app', website: 'website', web: 'website', visual: 'visual', 'ai agents': 'ai', ai: 'ai', 'ai / ml': 'ai', ml: 'ai' };
  const kindOf = (p) => KIND[String(p.category || '').toLowerCase()] || 'fun';

  function thumb(p) {
    if (p.image) return `<div class="thumb"><img src="${esc(p.image)}" alt="" loading="lazy"></div>`;
    const rnd = seeded(p.title);
    const [c1, c2] = p.colors || ['#7c5cff', '#22d3ee'];
    const k = kindOf(p);
    let m;
    if (k === 'dashboard') {
      const pts = Array.from({ length: 9 }, (_, i) => `${i * 12.5},${(6 + rnd() * 28).toFixed(1)}`).join(' ');
      const bars = Array.from({ length: 12 }, () => `<i style="height:${(20 + rnd() * 80).toFixed(0)}%"></i>`).join('');
      m = `<div class="m m-dash"><div class="m-side"><b></b><i></i><i></i><i></i><i></i></div><div class="m-body"><div class="m-kpis"><i></i><i></i><i></i></div><svg class="m-line" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="${pts}"/></svg><div class="m-bars">${bars}</div></div></div>`;
    } else if (k === 'app') {
      const phone = (cls) => `<div class="m m-phone ${cls}"><div class="m-notch"></div><div class="m-hero"></div><div class="m-list"><i></i><i></i><i></i></div><div class="m-tab"><i></i><i></i><i></i></div></div>`;
      m = phone('a') + phone('b');
    } else if (k === 'website') {
      m = `<div class="m m-browser"><div class="m-bar"><b></b><b></b><b></b></div><div class="m-site"><h4>${esc(p.title)}</h4><p></p><p class="s"></p><span class="m-cta"></span><div class="m-cards"><i></i><i></i><i></i></div></div></div>`;
    } else if (k === 'ai') {
      const lines = ['research', 'script', 'narrate', 'render', 'upload'];
      m = `<div class="m m-term"><div class="m-bar"><b></b><b></b><b></b></div><div class="m-code">${lines.map((l, i) => `<p><span>›</span> agent.${l}()<em style="width:${(20 + rnd() * 35).toFixed(0)}%"></em>${i < 4 ? '<u>✓</u>' : '<s></s>'}</p>`).join('')}</div></div>`;
    } else if (k === 'visual') {
      m = `<div class="m m-poster"><div class="m-orb"></div><h4>${esc(p.title)}</h4><span>${esc(p.year)}</span></div>`;
    } else {
      const cells = Array.from({ length: 12 }, () => {
        const r = rnd();
        return `<i style="border-radius:${r < 0.33 ? '50%' : r < 0.66 ? '18%' : '50% 0'};opacity:${(0.35 + rnd() * 0.65).toFixed(2)}"></i>`;
      }).join('');
      m = `<div class="m m-fun">${cells}</div>`;
    }
    return `<div class="thumb t-${k}" style="--c1:${esc(c1)};--c2:${esc(c2)}">${m}</div>`;
  }

  /* ---------- detail modal ---------- */
  const modal = $('#detail');
  function openDetail(item) {
    $('#detail-media').innerHTML = item.mediaHTML || thumb(item.thumbAs || item);
    $('#detail-meta').innerHTML = [item.category, item.year].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('');
    $('#detail-title').textContent = item.title;
    $('#detail-desc').textContent = item.description || '';
    $('#detail-tags').innerHTML = (item.tags || []).map((t) => `<span>${esc(t)}</span>`).join('');
    const link = $('#detail-link');
    const has = item.link && item.link !== '#';
    link.hidden = !has;
    if (has) link.href = item.link;
    modal.showModal();
  }
  $('.modal-close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  /* ---------- Ronie loading screen: a spinning ASCII core + a boot log, while the 3D files download ---------- */
  let bootRunning = false;
  const BOOT_LOG = [
    [0, 'fetching 3D engine'],
    [10, 'loading armour textures'],
    [35, 'calibrating servos'],
    [60, 'syncing neon tubes'],
    [85, 'warming up personality'],
  ];
  function bootScreen() {
    const pre = document.getElementById('rai-ascii');
    const log = document.getElementById('rai-bootlog');
    const pctEl = document.getElementById('rai-load-pct');
    const box = document.getElementById('rai-loading');
    if (!pre || bootRunning || box.hidden) return;
    bootRunning = true;
    // ASCII Ronie: a turntable of the real 3D model, baked into characters (js/ronie-ascii.json).
    // He's "assembled" from the feet up as the download progresses, with a scan line at the edge.
    const RAMP = ' .:-=+*#%@';
    let art = null, spin = 0, last = performance.now(), shown = 0;
    fetch(`js/ronie-ascii.json${ASSET_V ? `?v=${ASSET_V}` : ''}`).then((r) => r.json()).then((j) => {
      art = { w: j.w, h: j.h, frames: j.frames.map((f) => f.split('\n')) };
    }).catch(() => {});
    const step = (now) => {
      // stop once Ronie has loaded (or the loading box was replaced by an error message)
      if (box.hidden || !pre.isConnected) { bootRunning = false; return; }
      requestAnimationFrame(step);
      const dt = Math.min(50, now - last); last = now;
      if (document.querySelector('[data-view="assistant"]').hidden || !art) return;
      spin += dt * 0.00014 * MOTION;                    // one full turn every ~7 s
      const frame = art.frames[Math.floor(((spin % 1) + 1) % 1 * art.frames.length) % art.frames.length];
      const pct = parseInt(pctEl.textContent, 10) || 0;
      shown += (Math.min(1, 0.08 + pct / 100) - shown) * Math.min(1, dt / 160);
      const edge = art.h * (1 - shown);                 // rows above this are still being "printed"
      let txt = '';
      for (let r = 0; r < art.h; r++) {
        const row = frame[r] || '';
        const scan = Math.abs(r - edge) < 0.9;
        for (let c = 0; c < art.w; c++) {
          const code = row.charCodeAt(c);
          if (!(code >= 97)) { txt += ' '; continue; }   // empty cell
          let v = (code - 97) / 25;
          if (r < edge - 0.9) { txt += (r * 7 + c * 3) % 5 ? ' ' : '.'; continue; } // faint outline still to come
          if (scan) v = 1;
          else v *= 0.9 + 0.1 * Math.sin(now / 240 + r * 0.6 + c * 0.2);   // a slow shimmer
          txt += RAMP[Math.max(1, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))))];
        }
        txt += '\n';
      }
      pre.textContent = txt;
      // boot log follows the download percentage
      log.textContent = BOOT_LOG.filter(([at]) => pct >= at).map(([at, label], i, shown) => {
        const done = i < shown.length - 1;
        return `› ${label} ${done ? '… ok' : '.'.repeat(1 + (((now / 400) | 0) % 3))}`;
      }).join('\n');
    };
    requestAnimationFrame(step);
  }

  /* ---------- header, nav, menu ---------- */
  function initChrome() {
    document.title = `${D.name} — Portfolio`;
    $('.brand-full').textContent = D.name;
    $('.brand-short').textContent = D.shortName || D.name;

    const links = $$('.tabs a');
    const ind = $('.tabs-indicator');
    const routes = [...links.map((a) => a.dataset.route), 'profile', 'assistant'];
    const active = () => links.find((a) => a.classList.contains('active'));
    const moveIndicator = () => {
      const a = active();
      ind.style.opacity = a ? '1' : '0';
      if (!a) return;
      ind.style.width = `${a.offsetWidth}px`;
      ind.style.transform = `translateX(${a.offsetLeft - 3}px)`;
    };
    // Ronie has his own address, raunakpatil.com/ronie (ronie.html sends visitors in); every other page is /#page
    const onRonie = () => /^\/ronie\/?$/.test(location.pathname);
    // old addresses that still work: the Case Study page is now the Library
    const RENAMED = { 'case-study': 'library' };
    const go = () => {
      let h = location.hash.slice(1);
      if (RENAMED[h]) { h = RENAMED[h]; history.replaceState(null, '', `#${h}`); }
      const r = routes.includes(h) ? h : !h && onRonie() ? 'assistant' : 'dashboard';
      if (r === 'assistant' && (h || !onRonie())) history.replaceState(null, '', '/ronie');
      else if (r !== 'assistant' && onRonie()) history.replaceState(null, '', `/#${r}`);
      $$('.view').forEach((v) => { v.hidden = v.dataset.view !== r; });
      links.forEach((a) => {
        const on = a.dataset.route === r;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      moveIndicator();
      window.scrollTo(0, 0);
      document.body.dataset.route = r;
      // Ronie (three.js + the robot) only loads when someone actually opens it
      if (r === 'assistant') {
        bootScreen();
        import(`./assistant.js${ASSET_V ? `?v=${ASSET_V}` : ''}`).then((m) => m.open()).catch((err) => {
          console.error('Assistant failed to load', err);
          const l = document.getElementById('rai-loading');
          if (l) l.textContent = "Ronie couldn't start on this browser. Try refreshing.";
        });
      }
    };
    addEventListener('hashchange', go);
    addEventListener('resize', moveIndicator);
    document.fonts?.ready.then(moveIndicator);
    go();

    // menu
    const btn = $('.menu-btn');
    const menu = $('#menu');
    menu.innerHTML = `
      <p class="menu-bio">${esc(D.bio)}</p>
      <nav class="menu-links"><a href="#profile">My Profile<span>→</span></a>${D.links.map((l) => `<a href="${esc(l.href)}" ${/^https?:/.test(l.href) ? 'target="_blank" rel="noopener"' : ''}>${esc(l.label)}<span>↗</span></a>`).join('')}</nav>
      <div class="menu-meta"><span>Local time</span><span id="clock"></span></div>`;
    const clock = $('#clock');
    const tick = () => {
      try {
        clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: D.timezone, timeZoneName: 'short' }).format(new Date());
      } catch { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    };
    tick(); setInterval(tick, 30000);
    const setOpen = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    addEventListener('hashchange', () => setOpen(false));
  }

  /* ---------- card 1: hello + Ronie as a hologram ---------- */
  // Ronie's ASCII turntable (the one on his loading screen, js/ronie-ascii.json) projected like a mecha HUD
  // hologram, in the site's white: a soft glow, scanlines, a sweeping scan bar, the odd glitch tear, target brackets, a
  // reticle on his head, a projector base under his feet and a column of readouts. Hover to turn him with the mouse.
  function initHello() {
    const H = D.hello;
    const card = $('#card-hello');
    const canvas = $('#ascii');
    const title = $('#hello-title');
    title.innerHTML = H.greeting.map((w) => `<span>${esc(w)}</span>`).join('');

    const ptr = trackPointer(card);
    const RAMP = ' .:-=+*#%@';
    const CW = 5.6, CH = 8.6;                    // a finer grid than the page's other ASCII: more of him shows
    const HOLO = '#f2f2f2', HOT = '#ffffff';    // the site's white, like the old donut
    let art = null;
    fetch(`js/ronie-ascii.json${ASSET_V ? `?v=${ASSET_V}` : ''}`).then((r) => r.json()).then((j) => {
      art = { w: j.w, h: j.h, frames: j.frames.map((f) => f.split('\n')) };
    }).catch(() => {});
    let spin = 0.62, vel = 0.00011, nextGlitch = 0, tear = null, scanPat = null, scanCtx = null;
    const noise = Float32Array.from({ length: 4096 }, Math.random);

    onFrame(card, (now, dt) => {
      const { ctx, w, h } = fit(canvas);
      ctx.clearRect(0, 0, w, h);
      if (!art) return;
      // turn: a slow turntable; hovering steers it (pointer left/right of centre)
      const want = ptr.inside ? ptr.nx * 0.0005 : 0.00011;
      vel += (want - vel) * Math.min(1, dt / 220);
      spin += vel * dt * MOTION;
      const turn = ((spin % 1) + 1) % 1;
      const frame = art.frames[Math.floor(turn * art.frames.length) % art.frames.length];
      // where he stands: right of centre, feet near the bottom, as big as the card allows
      const k = Math.min(1, (h * 0.8) / (art.h * CH), (w * 0.85) / (art.w * CW));
      const cw = CW * k, ch = CH * k, bw = art.w * cw, bh = art.h * ch;
      const ox = w * 0.65 - bw / 2, oy = h * 0.93 - bh;
      const t = now / 1000, live = MOTION ? 1 : 0;

      // glitches: now and then a few bands of rows tear sideways for a moment
      if (live && now > nextGlitch) {
        const r0 = (Math.random() * art.h) | 0;
        tear = { until: now + 90 + Math.random() * 90, bands: [[r0, r0 + 1 + ((Math.random() * 4) | 0), (Math.random() - 0.5) * 16],
          [(r0 + 9 + Math.random() * 20) % art.h | 0, 0, (Math.random() - 0.5) * 10]] };
        tear.bands[1][1] = tear.bands[1][0] + 1;
        nextGlitch = now + 1600 + Math.random() * 3600;
      }
      const torn = tear && now < tear.until;
      const flick = live ? (Math.random() < 0.025 ? 0.55 : 0.93 + 0.07 * Math.sin(t * 31)) : 1;
      const scanRow = live ? ((t / 2.8) % 1) * (art.h + 10) - 5 : -99;
      // the scan line runs through shades of blue as it travels down him: pale sky blue at his head, deep blue at his feet
      const sp = clamp(scanRow / art.h, 0, 1);
      const SCAN = `hsl(${(195 + sp * 45).toFixed(0)} ${(90 + sp * 8).toFixed(0)}% ${(76 - sp * 22).toFixed(0)}%)`;

      // the projector: a cone of light rising from rings under his feet
      const fx = ox + bw * 0.5, fy = oy + bh - ch * 0.4, rx = bw * 0.36;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cone = ctx.createLinearGradient(0, fy, 0, oy);
      cone.addColorStop(0, 'rgba(255, 255, 255, 0.07)'); cone.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath(); ctx.moveTo(fx - rx, fy); ctx.lineTo(fx + rx, fy); ctx.lineTo(fx + rx * 1.5, oy); ctx.lineTo(fx - rx * 1.5, oy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = HOLO; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ph = live ? (t / 1.7 + i / 3) % 1 : i / 3;
        ctx.globalAlpha = (1 - ph) * 0.55;
        ctx.beginPath(); ctx.ellipse(fx, fy, rx * (0.5 + ph * 0.8), rx * (0.5 + ph * 0.8) * 0.16, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();

      // Ronie, in characters
      ctx.font = `${Math.max(6, ch * 1.02)}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = HOLO;
      const R2 = 80 * 80;
      for (let r = 0; r < art.h; r++) {
        const row = frame[r] || '';
        let dx = 0;
        if (torn) for (const [a, b, s] of tear.bands) if (r >= a && r < b) dx = s;
        const scan = Math.abs(r - scanRow) < 1.2;
        const y = oy + r * ch;
        ctx.fillStyle = scan ? SCAN : HOLO;
        for (let c = 0; c < art.w; c++) {
          const code = row.charCodeAt(c);
          const x = ox + c * cw + dx;
          const ddx = x - ptr.x, ddy = y - ptr.y, d2 = ddx * ddx + ddy * ddy;
          const glow = d2 < R2 ? 1 - d2 / R2 : 0;
          if (!(code >= 97)) {
            // empty cells: a faint dust of the projection
            if (noise[(r * art.w + c) & 4095] > 0.985) { ctx.globalAlpha = 0.1 * flick; ctx.fillText('.', x, y); }
            continue;
          }
          let v = (code - 97) / 25;
          v *= 0.86 + 0.14 * Math.sin(t * 4.2 + r * 0.55 + c * 0.17) * live;
          if (scan) v = Math.max(v, 0.92);
          const idx = clamp(Math.round((v + glow * 0.4) * (RAMP.length - 1)), 1, RAMP.length - 1);
          ctx.globalAlpha = clamp((0.18 + v * 0.82 + glow * 0.4) * flick, 0, 1);
          ctx.fillText(glow > 0.3 && Math.random() < glow * 0.3 ? randGlyph() : RAMP[idx], x, y);
        }
      }
      ctx.globalAlpha = 1;

      // glow: the hologram blurred back over itself (browsers without canvas filters just skip it)
      ctx.save();
      ctx.filter = 'blur(3px)';
      if (ctx.filter === 'blur(3px)') {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3;
        ctx.drawImage(canvas, 0, 0, w, h);
      }
      ctx.restore();
      // scanlines: every third line dimmed, and a bright bar sweeping down him
      if (scanCtx !== ctx) {
        const p = document.createElement('canvas'); p.width = 1; p.height = 3;
        const pc = p.getContext('2d'); pc.fillStyle = '#000'; pc.fillRect(0, 0, 1, 1);
        scanPat = ctx.createPattern(p, 'repeat'); scanCtx = ctx;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 0.45; ctx.fillStyle = scanPat;
      ctx.fillRect(ox - 20, oy - 20, bw + 40, bh + 40);
      ctx.restore();
      if (scanRow > -2 && scanRow < art.h + 2) {
        ctx.fillStyle = HOLO; ctx.globalAlpha = 0.4;   // the thin line stays white; only the characters take the blue
        ctx.fillRect(ox - 10, oy + scanRow * ch, bw + 20, 1);
        ctx.globalAlpha = 1;
      }

      // HUD: target brackets round him, a turning reticle on his head, readouts down the right
      ctx.strokeStyle = HOLO; ctx.lineWidth = 1;
      const br = live ? Math.sin(t * 2.2) * 2 : 0, L = 12;
      const x0 = ox - 8 - br, y0 = oy - 6 - br, x1 = ox + bw + 8 + br, y1 = oy + bh + 2 + br;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      // (no bottom-left corner: the readouts sit there)
      for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1]]) {
        ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L);
      }
      ctx.stroke();
      const hx = ox + bw * 0.5, hy = oy + bh * 0.11, hr = bw * 0.13, rot = live ? t * 0.9 : 0;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx, hy, hr, rot + i * TAU / 4, rot + i * TAU / 4 + 0.9); ctx.stroke(); }
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx, hy, hr * 1.38, -rot * 1.3 + i * TAU / 3, -rot * 1.3 + i * TAU / 3 + 0.5); ctx.stroke(); }
      ctx.globalAlpha = 0.55;
      // a leader line out to a small "LOCK" tag (kept inside the card)
      const lx = Math.min(hx + hr * 1.9, w - 34);
      ctx.beginPath(); ctx.moveTo(hx + hr * 1.38, hy); ctx.lineTo(hx + hr * 1.6, hy - hr * 0.55); ctx.lineTo(lx + 24, hy - hr * 0.55); ctx.stroke();
      ctx.font = '8px "JetBrains Mono", monospace'; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillStyle = HOLO;
      ctx.fillText('LOCK', lx, hy - hr * 0.55 - 2);

      const sync = (98.2 + Math.sin(t * 0.7) * 1.1 + (live ? Math.sin(t * 5.3) * 0.15 : 0)).toFixed(1);
      const core = Math.round(4 + 2 * (0.5 + 0.5 * Math.sin(t * 1.3)) * live);
      const rows = [
        [['R.O.N.I.E', HOT], [' // UNIT 01', HOLO]],
        [[`SYNC  ${sync}%`, HOLO]],
        [[`ROT   ${String(Math.round(turn * 360)).padStart(3, '0')}°`, HOLO]],
        [[`CORE  ${'▮'.repeat(core)}${'▯'.repeat(6 - core)}`, HOLO]],
        [['MODE  STANDBY', HOLO]],
      ];
      // a data column in the bottom-left corner
      const block = rows.length * 13 + 6 + 11;
      const ry = Math.max(title.offsetTop + title.offsetHeight + 14, h - 18 - block), rx0 = 18;
      ctx.font = '9px "JetBrains Mono", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.globalAlpha = 0.5; ctx.fillStyle = HOLO; ctx.fillRect(rx0, ry - 7, 26, 1);
      rows.forEach((parts, i) => {
        let x = rx0;
        ctx.globalAlpha = 0.85 * flick;
        for (const [txt, col] of parts) { ctx.fillStyle = col; ctx.fillText(txt, x, ry + i * 13); x += ctx.measureText(txt).width; }
      });
      // the old "Talk to Ronie" button, as a HUD prompt: blinks, steadies on hover
      ctx.globalAlpha = ptr.inside ? 1 : (live ? (Math.sin(t * 4) > -0.2 ? 0.9 : 0.25) : 0.9);
      ctx.fillStyle = ptr.inside ? HOT : HOLO;
      ctx.fillText(ptr.inside ? '▸ ENGAGE: CLICK TO TALK' : '▸ CLICK TO WAKE', rx0, ry + rows.length * 13 + 6);
      ctx.globalAlpha = 1;
    });
  }

  // Live total: `hours` on the `since` date, plus a fixed 4–6 h for every day after it
  // (seeded by the date, so every visitor sees the same number), creeping up through today.
  function liveHours(T) {
    const DAY = 864e5;
    const [lo, hi] = T.perDay || [4, 6];
    const base = new Date(`${T.since}T00:00:00`);
    const elapsed = Math.max(0, (Date.now() - base) / DAY);
    const days = Math.floor(elapsed);
    const perDay = (i) => lo + seeded(`${T.since}#${i}`)() * (hi - lo);
    let total = T.hours;
    for (let i = 0; i < days; i++) total += perDay(i);
    const today = perDay(days) * (elapsed - days);
    return { total: total + today, today };
  }

  /* ---------- card 2: hours dial ---------- */
  function initTime() {
    const T = D.time;
    const card = $('#card-time');
    const num = $('#time-num'), unit = $('#time-unit'), todayEl = $('#time-today');
    $('#time-title').textContent = T.title;
    const endYear = T.end.year === 'now' ? new Date().getFullYear() : T.end.year;
    const end = (e, side, year) => `<div class="time-end${side === 'end' ? ' right' : ''}" data-side="${side}"><b>${esc(year)}</b><span>${esc(e.city)}<br>${fmtDeg(e.lat, 'N', 'S')}<br>${fmtDeg(e.lon, 'E', 'W')}</span></div>`;
    $('#time-ends').innerHTML = end(T.start, 'start', T.start.year) + end(T.end, 'end', endYear);

    // dial geometry: a big ring whose centre sits below the card; the glowing segment points up
    const CX = 150, CY = 240, R = 150, MR = 112;
    const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
    const [sx, sy] = pt(-122, R), [ex, ey] = pt(-58, R);
    $$('.dial-seg', card).forEach((p) => p.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${R} ${R} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`));
    const MARK = { start: -142, end: -38 };
    $$('.dial-marker', card).forEach((g) => {
      const [x, y] = pt(MARK[g.dataset.side], MR);
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    });

    const fmt = (h) => Math.floor(h).toLocaleString();
    const values = () => {
      const { total, today } = liveHours(T);
      return { total, today, start: T.start.hours || 0, end: total - (T.start.hours || 0) };
    };
    let side = '', counted = false;
    function render(withGlitch) {
      const v = values();
      const value = side === 'start' ? v.start : side === 'end' ? v.end : v.total;
      if (withGlitch) glitch(num, fmt(value), { percent: 0.8, duration: 700 }); else if (!num._glitchBusy) num.textContent = fmt(value);
      unit.textContent = side === 'start' ? `Hours in ${T.start.region}` : side === 'end' ? `Hours in ${T.end.region}` : T.unit;
      todayEl.textContent = side === 'start' ? `${T.start.year} — ${T.start.year + 1}` : '';
    }
    const setSide = (s) => {
      if (s === side) return;
      side = s;
      card.dataset.side = s;
      if (counted) render(true);
    };
    // cycles total → India → UK every 3 s on its own; hovering a marker takes over until the mouse leaves
    const CYCLE = ['', 'start', 'end'];
    let hovered = false;
    $$('[data-side]', card).forEach((el) => {
      el.addEventListener('pointerenter', () => { hovered = true; setSide(el.dataset.side); });
      el.addEventListener('pointerleave', () => { hovered = false; });
    });
    setInterval(() => {
      if (!counted || hovered || document.hidden || !card.offsetWidth) return;
      setSide(CYCLE[(CYCLE.indexOf(side) + 1) % CYCLE.length]);
    }, 3000);

    // count up on first view, then keep the live number ticking
    let start = null;
    onFrame(card, (now) => {
      if (counted) return;
      if (start === null) start = now;
      const k = MOTION ? easeOut(clamp((now - start) / 2400, 0, 1)) : 1;
      num.textContent = fmt(values().total * k);
      if (k >= 1) { counted = true; render(true); }
    });
    setInterval(() => { if (counted && !document.hidden) render(false); }, 30000);
  }

  /* ---------- card 3: skill matrix ---------- */
  function initSkills() {
    const S = D.skills;
    const card = $('#card-skills');
    const list = $('#skill-list');
    const canvas = $('#skill-bars');
    const n = S.items.length;
    const total = S.items.reduce((s, x) => s + x.score, 0);
    const hueOf = (i) => (((75 - i * (330 / n)) % 360) + 360) % 360;

    $('#skills-title').textContent = S.title;
    list.innerHTML = S.items.map((s, i) => `<li data-i="${i}" style="--hue:hsl(${hueOf(i).toFixed(0)} 85% 65%)"><span>${esc(s.name)}</span><b class="badge">0</b></li>`).join('');
    $('#tool-list').innerHTML = S.tools.map((t) => `<li data-tool="${esc(t)}">${esc(t)}</li>`).join('');
    $('#skills-note').innerHTML = S.notes.map((x) => `// ${esc(x)}`).join('<br>');

    const items = $$('li', list);
    const badges = $$('.badge', list);
    const toolList = $('#tool-list');
    const toolEls = $$('li', toolList);
    const usesTool = (i, tool) => (S.items[i].tools || []).includes(tool);
    // hot = set of highlighted skill indices; hovering a skill lights its tools,
    // hovering a tool lights every skill that uses it
    let hot = new Set();
    let hotKey = '';
    const setHot = (skills, tools = null) => {
      const key = [...skills].join(',') + '|' + (tools ? [...tools].join(',') : '');
      if (key === hotKey) return;
      hotKey = key;
      hot = skills;
      const lit = tools || new Set([...skills].flatMap((i) => S.items[i].tools || []));
      list.classList.toggle('has-hot', hot.size > 0);
      items.forEach((li, k) => li.classList.toggle('hot', hot.has(k)));
      toolList.classList.toggle('has-hot', hot.size > 0 || lit.size > 0);
      const colorOf = hot.size === 1 ? items[[...hot][0]].style.getPropertyValue('--hue') : '';
      toolEls.forEach((li) => {
        const on = lit.has(li.dataset.tool);
        li.classList.toggle('hot', on);
        li.style.setProperty('--hue', on && colorOf ? colorOf : '');
      });
    };
    const none = () => setHot(new Set());
    items.forEach((li, i) => {
      li.addEventListener('pointerenter', () => setHot(new Set([i])));
      li.addEventListener('pointerleave', none);
    });
    toolEls.forEach((li) => {
      const tool = li.dataset.tool;
      li.addEventListener('pointerenter', () => setHot(new Set(S.items.map((_, i) => i).filter((i) => usesTool(i, tool))), new Set([tool])));
      li.addEventListener('pointerleave', none);
    });

    const GAP = 4, STEP = 3;
    let segs = [];
    const ptr = trackPointer(canvas);
    canvas.addEventListener('pointermove', () => {
      const s = segs.find((g) => ptr.x >= g.x && ptr.x <= g.x + g.w);
      setHot(s ? new Set([s.i]) : new Set());
    });
    canvas.addEventListener('pointerleave', none);

    let start = null, t = 0;
    onFrame(card, (now, dt) => {
      if (start === null) start = now;
      const k = MOTION ? easeOut(clamp((now - start) / 1800, 0, 1)) : 1;
      badges.forEach((b, i) => { b.textContent = Math.round(S.items[i].score * k); });
      t += dt * MOTION;

      const { ctx, w, h } = fit(canvas);
      ctx.clearRect(0, 0, w, h);
      const usable = w - GAP * (n - 1);
      segs = [];
      let x = 0;
      for (let i = 0; i < n; i++) {
        const sw = (usable * S.items[i].score) / total;
        segs.push({ i, x, w: sw });
        const h0 = hueOf(i), h1 = hueOf(i + 1);
        const dh = ((h1 - h0 + 540) % 360) - 180; // shortest way round the hue wheel
        ctx.globalAlpha = hot.size === 0 ? 0.92 : hot.has(i) ? 1 : 0.16;
        for (let bx = x; bx < x + sw - 1; bx += STEP) {
          const u = (bx - x) / sw;
          const gx = bx / STEP;
          const wave = 0.5 + 0.5 * Math.sin(t * 0.0016 + gx * 0.11 + i) * Math.cos(t * 0.0007 + gx * 0.037);
          const bh = h * (0.22 + 0.78 * wave) * (0.4 + 0.6 * k);
          ctx.fillStyle = `hsl(${(h0 + dh * u).toFixed(1)} 85% ${hot.has(i) ? 68 : 62}%)`;
          ctx.fillRect(bx, h - bh, 2, bh);
        }
        x += sw + GAP;
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ---------- card 4: 3D tunnel ---------- */
  function initTunnel() {
    const card = $('#card-tunnel');
    const stage = $('#tunnel-stage');
    const tunnel = $('#tunnel');
    const fog = $('#tunnel-fog');
    const L = 2200, SPEED = 0.07, CELL = 120;
    const walls = {};
    for (const side of ['floor', 'ceil', 'left', 'right']) {
      const w = document.createElement('div');
      w.className = `wall wall-${side}`;
      tunnel.appendChild(w);
      walls[side] = w;
    }

    let W = 0, Hh = 0;
    const layout = () => {
      const r = stage.getBoundingClientRect();
      W = r.width; Hh = r.height;
      Object.assign(walls.floor.style, { width: `${W}px`, height: `${L}px`, left: '0px', top: `${Hh}px`, backgroundSize: `${W / 6}px ${CELL}px` });
      Object.assign(walls.ceil.style, { width: `${W}px`, height: `${L}px`, left: '0px', top: `${-L}px`, backgroundSize: `${W / 6}px ${CELL}px` });
      Object.assign(walls.left.style, { width: `${L}px`, height: `${Hh}px`, left: `${-L}px`, top: '0px', backgroundSize: `${CELL}px ${Hh / 4}px` });
      Object.assign(walls.right.style, { width: `${L}px`, height: `${Hh}px`, left: `${W}px`, top: '0px', backgroundSize: `${CELL}px ${Hh / 4}px` });
      items.forEach(place);
    };

    const sides = ['floor', 'right', 'ceil', 'left'];
    const P = D.projects;
    const N = Math.max(20, P.length);
    const rnd = seeded('tunnel');
    const items = [];
    let slowdown = 1;
    for (let i = 0; i < N; i++) {
      const p = P[i % P.length];
      const side = sides[i % 4];
      const tall = kindOf(p) === 'app' || kindOf(p) === 'visual';
      const across = tall ? 110 : 190, along = tall ? 180 : 125;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tcard';
      el.setAttribute('aria-label', `Open ${p.title}`);
      el.innerHTML = `<div class="tcard-in">${thumb(p)}</div>`;
      el.addEventListener('click', () => openDetail(p));
      el.addEventListener('pointerenter', () => { slowdown = 0.12; });
      el.addEventListener('pointerleave', () => { slowdown = 1; });
      const vertical = side === 'floor' || side === 'ceil';
      el.style.width = `${vertical ? across : along}px`;
      el.style.height = `${vertical ? along : across}px`;
      walls[side].appendChild(el);
      items.push({ el, side, across, along, off: rnd(), d: (i / N) * L });
    }

    function place(it) {
      const span = (it.side === 'floor' || it.side === 'ceil' ? W : Hh) - it.across - 24;
      const a = 12 + it.off * Math.max(0, span);
      const d = it.d;
      let x, y;
      if (it.side === 'floor') { x = a; y = d; }
      else if (it.side === 'ceil') { x = a; y = L - d - it.along; }
      else if (it.side === 'right') { x = d; y = a; }
      else { x = L - d - it.along; y = a; }
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      it.el.style.opacity = clamp((L - d) / 700, 0, 1).toFixed(3);
    }

    new ResizeObserver(layout).observe(stage);

    // chat: the answer floats as a sparkling particle cloud and snaps into crisp text on hover
    const T = D.tunnel;
    $('#chat-q').textContent = T.question;
    const pill = $('.answer');
    const ans = $('#chat-a');
    const pc = document.createElement('canvas');
    pc.className = 'answer-particles';
    pc.setAttribute('aria-hidden', 'true');
    pill.appendChild(pc);
    const SPREAD = 9, PSPEED = 0.5;
    let parts = [], hovered = false, built = false, pw = 0, ph = 0, revealTimer = 0;
    // shuffle-bag: every answer shows once before any repeats, and never twice in a row
    let bag = [], last = -1;
    const nextAnswer = () => {
      if (!bag.length) {
        bag = T.answers.map((_, i) => i).sort(() => Math.random() - 0.5);
        if (bag[bag.length - 1] === last && bag.length > 1) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      last = bag.pop();
      return T.answers[last];
    };
    ans.textContent = nextAnswer();
    if (!MOTION) pill.classList.add('on');

    function buildParticles() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cr = pc.getBoundingClientRect();
      const tr = ans.getBoundingClientRect();
      pw = cr.width; ph = cr.height;
      if (!pw || !ph) return;
      pc.width = Math.round(pw * dpr); pc.height = Math.round(ph * dpr);
      const off = document.createElement('canvas');
      off.width = pc.width; off.height = pc.height;
      const o = off.getContext('2d', { willReadFrequently: true });
      o.scale(dpr, dpr);
      o.font = getComputedStyle(ans).font;
      o.textBaseline = 'middle';
      o.fillStyle = '#fff';
      o.fillText(ans.textContent, tr.left - cr.left, tr.top - cr.top + tr.height / 2);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const step = 2;
      const old = parts;
      parts = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          const a = data[(y * off.width + x) * 4 + 3];
          if (a < 90) continue;
          const src = old.length ? old[(Math.random() * old.length) | 0] : null;
          const ox = x / dpr, oy = y / dpr;
          parts.push({
            x: src ? src.x : ox + (Math.random() - 0.5) * SPREAD * 2,
            y: src ? src.y : oy + (Math.random() - 0.5) * SPREAD * 2,
            ox, oy, op: 0, oa: a / 255, top: a / 255,
            fa: Math.random() * TAU, fs: 0.4 + Math.random() * 0.8, ss: Math.random() * 3 + 1,
          });
        }
      }
      built = true;
    }

    function updateParticles(dt) {
      const s = SPREAD, c = PSPEED, l = 5 * c, u = 0.6, dd = 1.3;
      const tnow = Date.now() * 0.001;
      for (const p of parts) {
        if (hovered) {
          const dx = p.ox - p.x, dy = p.oy - p.y, d = Math.hypot(dx, dy);
          if (d > 0.1) { const m = Math.min(d, 3 * dt * 60); p.x += (dx / d) * m; p.y += (dy / d) * m; } else { p.x = p.ox; p.y = p.oy; }
          p.op = Math.max(0, p.op - 5 * dt);
          continue;
        }
        p.fa += dt * p.fs * (1 + Math.random() * dd);
        const r = p.fs * 2000;
        const ix = (Math.sin(tnow * p.fs + p.fa) * 1.2 + Math.sin((tnow + r) * 0.5) * 0.8 + (Math.random() - 0.5) * dd) * u;
        const iy = (Math.cos(tnow * p.fs + p.fa * 1.5) * 0.6 + Math.cos((tnow + r) * 0.5) * 0.4 + (Math.random() - 0.5) * dd) * u;
        const hx = p.ox + s * ix - p.x, hy = p.oy + s * iy - p.y;
        const v = Math.min(1, Math.hypot(hx, hy) / (s * 1.5));
        p.x += hx * l * dt + (Math.random() - 0.5) * c * v;
        p.y += hy * l * dt + (Math.random() - 0.5) * c * v;
        const away = Math.hypot(p.x - p.ox, p.y - p.oy);
        if (away > s) {
          const ang = Math.atan2(p.y - p.oy, p.x - p.ox), pull = (away - s) * 0.1;
          p.x -= Math.cos(ang) * pull; p.y -= Math.sin(ang) * pull;
        }
        const S = p.top - p.op;
        p.op += S * p.ss * dt * 3;
        if (Math.abs(S) < 0.01) { p.top = Math.random() < 0.5 ? Math.random() * 0.1 * p.oa : p.oa * 3; p.ss = Math.random() * 3 + 1; }
      }
    }

    function drawParticles() {
      const ctx = pc.getContext('2d');
      const dpr = pc.width / pw;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.fillStyle = '#fff';
      for (const p of parts) {
        if (p.op <= 0.01) continue;
        ctx.globalAlpha = Math.min(1, p.op);
        ctx.fillRect(p.x, p.y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    pill.addEventListener('pointerenter', () => {
      // new answer on every hover: the cloud re-forms into the next line, then the text sharpens
      ans.textContent = nextAnswer();
      if (!MOTION) return;
      buildParticles();
      hovered = true;
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => { if (hovered) pill.classList.add('on'); }, 280);
    });
    pill.addEventListener('pointerleave', () => {
      hovered = false;
      clearTimeout(revealTimer);
      if (MOTION) pill.classList.remove('on');
    });
    new ResizeObserver(() => { built = false; }).observe(pill);
    document.fonts?.ready.then(() => { built = false; });

    function chat(now, dt) {
      if (!MOTION) return;
      if (!built) buildParticles();
      updateParticles(dt / 1000);
      drawParticles();
    }

    const ptr = trackPointer(card);
    // warp-speed stars streaming out of the tunnel's vanishing point
    const starC = document.createElement('canvas');
    starC.className = 'tunnel-stars';
    starC.setAttribute('aria-hidden', 'true');
    card.insertBefore(starC, $('.chat', card));
    const STAR_COLORS = [null, null, null, null, null, '#ff9cf0', '#9cf6ff', '#e4ff9c'];
    const newStar = (anyDepth) => {
      let x = Math.random() * 2 - 1, y = Math.random() * 2 - 1;
      if (Math.abs(x) < 0.12 && Math.abs(y) < 0.12) { x += Math.sign(x || 1) * 0.12; y += Math.sign(y || 1) * 0.12; }
      return { x, y, z: anyDepth ? 0.05 + Math.random() * 0.95 : 1, c: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0] };
    };
    const stars = Array.from({ length: 160 }, () => newStar(true));
    function drawStars(dt) {
      const { ctx, w, h } = fit(starC);
      ctx.clearRect(0, 0, w, h);
      const vx = (w * ox) / 100, vy = (h * oy) / 100, k = Math.min(w, h) * 0.16;
      const dz = dt * 0.00016 * MOTION * spd;
      for (const st of stars) {
        const pz = st.z;
        st.z -= dz;
        const sx = vx + (st.x / st.z) * k, sy = vy + (st.y / st.z) * k;
        if (st.z <= 0.03 || sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) { Object.assign(st, newStar(false)); continue; }
        const near = 1 - st.z;
        const px = vx + (st.x / pz) * k, py = vy + (st.y / pz) * k;
        ctx.globalAlpha = Math.min(1, near * near * 1.3);
        ctx.strokeStyle = ctx.fillStyle = st.c || '#ffffff';
        ctx.lineWidth = 0.6 + near * 1.6;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke(); // streak
        ctx.beginPath(); ctx.arc(sx, sy, 0.3 + near * 1.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    let ox = 50, oy = 50, travelled = 0, spd = 1;
    onFrame(card, (now, dt) => {
      spd = lerp(spd, slowdown, 0.08);
      const step = dt * SPEED * MOTION * spd;
      travelled += step;
      const g = travelled % CELL;
      walls.floor.style.backgroundPosition = `0 ${-g}px`;
      walls.ceil.style.backgroundPosition = `0 ${g}px`;
      walls.right.style.backgroundPosition = `${-g}px 0`;
      walls.left.style.backgroundPosition = `${g}px 0`;
      for (const it of items) {
        it.d -= step;
        if (it.d < -it.along - 60) it.d += L + it.along;
        place(it);
      }
      ox = lerp(ox, 50 - ptr.nx * 14, 0.06);
      oy = lerp(oy, 50 - ptr.ny * 14, 0.06);
      stage.style.perspectiveOrigin = `${ox}% ${oy}%`;
      fog.style.setProperty('--fx', `${ox}%`);
      fog.style.setProperty('--fy', `${oy}%`);
      drawStars(dt);
      chat(now, dt);
    });
  }

  /* ---------- card 5: dotted world map ---------- */
  // Coastline rings, fetched once and shared by every map on the site.
  let landPromise = null;
  function loadLand() {
    if (landPromise) return landPromise;
    if (!window.topojson) return (landPromise = Promise.resolve(null));
    landPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json').then((r) => r.json()).then((topo) => {
      const fc = topojson.feature(topo, topo.objects.land);
      const out = [];
      for (const f of fc.features) {
        const g = f.geometry;
        const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of list) {
          for (const ring of poly) {
            // unwrap longitudes so rings crossing the antimeridian (e.g. Russia) stay continuous
            let prev = ring[0][0], shift = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            const pts = ring.map(([lon, lat]) => {
              if (lon - prev > 180) shift -= 360; else if (prev - lon > 180) shift += 360;
              prev = lon;
              const x = lon + shift;
              x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat);
              return [x, lat];
            });
            out.push({ pts, x0, x1, y0, y1 });
          }
        }
      }
      return out;
    }).catch(() => null);
    return landPromise;
  }

  function initMap(card) {
    const canvas = $('.map-canvas', card);
    const pinsEl = $('.map-pins', card);
    const info = $('.map-info', card);
    const E = D.experience;
    const B = D.mapBounds || { w: -130, e: 160, n: 74, s: -46 };
    const SP = 7; // dot pitch in px — smaller = more detailed coastline
    const COLORS = ['#c6f432', '#b18cff', '#ff7ab6', '#5eead4', '#ffb547', '#7cc4ff'];
    const colorOf = (i) => COLORS[i % COLORS.length];

    let rings = null, dots = [], key = '', W = 0, Hh = 0, base = null;
    const proj = (lat, lon) => ({ x: ((lon - B.w) / (B.e - B.w)) * W, y: ((B.n - lat) / (B.n - B.s)) * Hh });
    loadLand().then((r) => { if (r) { rings = r; key = ''; } });

    // Rasterise the coastline once per size, then test each dot against the pixels.
    function buildDots() {
      dots = [];
      if (W < 2 || Hh < 2) return; // hidden — nothing to draw
      const cols = Math.floor(W / SP), rows = Math.floor(Hh / SP);
      const ox = (W - (cols - 1) * SP) / 2, oy = (Hh - (rows - 1) * SP) / 2;
      let land = null;
      if (rings) {
        const m = document.createElement('canvas');
        m.width = Math.ceil(W); m.height = Math.ceil(Hh);
        const mc = m.getContext('2d', { willReadFrequently: true });
        mc.beginPath();
        for (const ring of rings) {
          if (ring.y1 < B.s || ring.y0 > B.n) continue;
          for (const off of [-360, 0, 360]) {
            if (ring.x1 + off < B.w || ring.x0 + off > B.e) continue;
            ring.pts.forEach(([lon, lat], i) => {
              const { x, y } = proj(lat, lon + off);
              if (i) mc.lineTo(x, y); else mc.moveTo(x, y);
            });
            mc.closePath();
          }
        }
        mc.fill('evenodd');
        land = mc.getImageData(0, 0, m.width, m.height).data;
      }
      const hit = (x, y) => {
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= Math.ceil(W) || yi >= Math.ceil(Hh)) return 0;
        return land[(yi * Math.ceil(W) + xi) * 4 + 3] > 0 ? 1 : 0;
      };
      const o = SP * 0.32;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ox + c * SP, y = oy + r * SP;
          if (!land) { dots.push({ x, y, land: false }); continue; }
          // centre hit, or most of the cell is land — keeps thin coasts and small islands
          const corners = hit(x - o, y - o) + hit(x + o, y - o) + hit(x - o, y + o) + hit(x + o, y + o);
          if (hit(x, y) || corners >= 2) dots.push({ x, y, land: true });
        }
      }
      // static layer, so each frame only redraws the few dots that glow
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      base = document.createElement('canvas');
      base.width = Math.round(W * dpr); base.height = Math.round(Hh * dpr);
      const bc = base.getContext('2d');
      bc.scale(dpr, dpr);
      bc.fillStyle = '#d9d9d9';
      for (const d of dots) {
        bc.globalAlpha = d.land ? 0.34 : 0.06;
        bc.beginPath(); bc.arc(d.x, d.y, DOT_R, 0, TAU); bc.fill();
      }
    }
    const DOT_R = 1.45;

    pinsEl.innerHTML = E.map((e, i) => `<button class="pin" type="button" data-i="${i}" style="--c:${colorOf(i)}" aria-label="${esc(e.org)}, ${esc(e.place)}"><i></i><span class="pin-label"><span class="pin-row">${PIN_ICON}<span class="pin-coords">${coords(e.lat, e.lon)}</span></span><span class="pin-more"><b>${esc(e.place)}</b><em>${esc(e.years)}</em><span>${esc(e.org)}</span></span></span></button>`).join('');
    const pins = $$('.pin', pinsEl);
    // ---- the journey: every stop in order, then home to the first stop, fade out, repeat
    const legs = E.map((_, i) => [i, (i + 1) % E.length]); // the last leg is the trip home
    // HOLD at each stop, TRAVEL per leg; on the trip home the map glitches out, VANISH, sits empty for VOID, then restarts
    const HOLD = 2600, TRAVEL = 1800, HOME_TRAVEL = 2400, VANISH = 165, VOID = 1300, APPEAR = 900;
    const qb = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
    let curves = [];

    function buildCurves() {
      curves = legs.map(([i, j], L) => {
        const a = proj(E[i].lat, E[i].lon), b = proj(E[j].lat, E[j].lon);
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const home = L === legs.length - 1;
        // outbound legs arc upwards; the trip home bows the other way so it doesn't retrace a route
        const bend = (home ? 1 : -1) * (d * 0.3 + 12);
        const c = { a, b, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 + bend, i, j, pts: [] };
        for (let s = 0; s <= 80; s++) { const u = s / 80; c.pts.push({ x: qb(a.x, c.mx, b.x, u), y: qb(a.y, c.my, b.y, u) }); }
        return c;
      });
    }

    function layoutPins() {
      buildCurves();
      const placed = [];
      const linePts = curves.flatMap((c) => c.pts);
      const overlap = (a, b) => a.x < b.x + b.w + 4 && a.x + a.w + 4 > b.x && a.y < b.y + b.h + 4 && a.y + a.h + 4 > b.y;
      const crossesLine = (r) => linePts.filter((p) => p.x > r.x - 3 && p.x < r.x + r.w + 3 && p.y > r.y - 3 && p.y < r.y + r.h + 3).length;
      pins.forEach((pin, i) => {
        const { x, y } = proj(E[i].lat, E[i].lon);
        pin.style.transform = `translate(${x}px, ${y}px)`;
        const lab = $('.pin-label', pin);
        const lw = lab.offsetWidth, lh = lab.offsetHeight;
        // try spots all around the pin, near and a little further out
        const cands = [];
        for (const gap of [12, 26, 42]) {
          cands.push([gap, -lh / 2], [-gap - lw, -lh / 2], [-lw / 2, gap], [-lw / 2, -gap - lh],
            [gap, gap * 0.4], [gap, -lh - gap * 0.4], [-gap - lw, gap * 0.4], [-gap - lw, -lh - gap * 0.4]);
        }
        let best = cands[0], bestScore = Infinity;
        for (const [dx, dy] of cands) {
          const r = { x: x + dx, y: y + dy, w: lw, h: lh };
          let score = Math.hypot(dx + lw / 2, dy + lh / 2) * 0.02; // prefer staying close to the pin
          if (r.x < 6 || r.y < 36 || r.x + lw > W - 6 || r.y + lh > Hh - 80) score += 40;
          for (const q of placed) if (overlap(r, q)) score += 25;
          score += crossesLine(r) * 3; // keep labels off the journey lines
          if (score < bestScore) { bestScore = score; best = [dx, dy]; }
        }
        lab.style.transform = `translate(${best[0]}px, ${best[1]}px)`;
        placed.push({ x: x + best[0], y: y + best[1], w: lw, h: lh });
      });
    }

    function showInfo(e, c) {
      info.style.setProperty('--c', c);
      info.innerHTML = `${e.years ? `<span class="mi-years">${esc(e.years)}</span>` : ''}<b>${esc(e.org)}</b><span>${esc(e.role)}${e.place ? ` · ${esc(e.place)}` : ''}</span>`;
      info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
    }
    const setPins = (visited, here) => pins.forEach((p, k) => {
      p.classList.toggle('shown', visited.has(k));
      p.classList.toggle('active', k === here);
    });

    // stage: 'hold' at a stop → 'travel' along a leg → … the trip home glitches everything out
    //        → 'vanish' (gone) → 'void' (empty map) → restart
    let stage = null, at = 0, leg = 0, t = 0, visited = new Set(), hovering = false, appear = 0, glitchingText = false;
    function arrive(k) {
      visited.add(k); at = k; stage = 'hold'; t = 0;
      setPins(visited, k);
      showInfo(E[k], colorOf(k));
    }
    function restart() {
      card.classList.remove('glitching', 'glitch-out');
      pins.forEach((p) => p.classList.remove('shown', 'active'));
      glitchingText = false;
      visited = new Set(); arrive(0);
    }
    // scramble the coordinates as they glitch out
    function scrambleText(duration) {
      const els = $$('.pin.shown .pin-coords', card);
      els.forEach((el) => glitch(el, el.textContent, { chars: GLYPHS, percent: 0.55, duration, speed: 55, color: 'rgba(255,255,255,.7)' }));
    }

    pins.forEach((p, i) => p.addEventListener('click', () => { if (p.classList.contains('shown')) showInfo(E[i], colorOf(i)); }));
    card.addEventListener('pointerenter', () => { hovering = true; });  // pause so the card can be read
    card.addEventListener('pointerleave', () => { hovering = false; });
    const ptr = trackPointer(card);

    function strokeLeg(ctx, c, u, alpha) {
      const grad = ctx.createLinearGradient(c.a.x, c.a.y, c.b.x, c.b.y);
      grad.addColorStop(0, colorOf(c.i)); grad.addColorStop(1, colorOf(c.j));
      ctx.globalAlpha = alpha; ctx.strokeStyle = grad; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let s = 0; s <= 48; s++) {
        const v = (s / 48) * u;
        const x = qb(c.a.x, c.mx, c.b.x, v), y = qb(c.a.y, c.my, c.b.y, v);
        if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }

    onFrame(card, (now, dt) => {
      const f = fit(canvas);
      const { ctx } = f;
      W = f.w; Hh = f.h;
      const k = `${Math.round(W)}x${Math.round(Hh)}:${rings ? 1 : 0}`;
      if (k !== key) { key = k; buildDots(); layoutPins(); }
      if (!stage) restart();

      // advance the journey (paused while hovered)
      if (!hovering) { t += dt; appear += dt; }
      const homeLeg = stage === 'travel' && leg === legs.length - 1;
      const travelTime = homeLeg ? HOME_TRAVEL : TRAVEL;
      if (stage === 'hold' && t > HOLD) {
        stage = 'travel'; leg = at; t = 0;
        pins.forEach((p) => p.classList.remove('active'));
      } else if (stage === 'travel' && (t > travelTime || !MOTION)) {
        if (homeLeg) { stage = 'vanish'; t = 0; card.classList.add('glitch-out'); }
        else arrive(legs[leg][1]);
      } else if (stage === 'vanish' && t > VANISH) { stage = 'void'; t = 0; }
      else if (stage === 'void' && t > VOID) restart();

      // where the traveller is right now
      let head = proj(E[at].lat, E[at].lon), u = 1;
      const onHomeLeg = stage === 'travel' && leg === legs.length - 1;
      const legTime = onHomeLeg ? HOME_TRAVEL : TRAVEL;
      if (stage === 'travel') {
        u = MOTION ? easeInOut(clamp(t / legTime, 0, 1)) : 1;
        const c = curves[leg];
        head = { x: qb(c.a.x, c.mx, c.b.x, u), y: qb(c.a.y, c.my, c.b.y, u) };
      }
      // glitch builds up over the second half of the trip home, peaks, then everything is gone
      let gi = 0;
      if (onHomeLeg && MOTION) gi = clamp((t / legTime - 0.84) / 0.16, 0, 1); // last moments of the trip home
      if (stage === 'vanish') gi = 1;
      if (gi > 0 && !glitchingText) {
        glitchingText = true;
        card.classList.add('glitching');
        scrambleText(HOME_TRAVEL * 0.16 + VANISH);
      }

      // the map itself always stays — it only fades in once, when the page first loads
      const dotsA = clamp(appear / APPEAR, 0, 1);

      ctx.clearRect(0, 0, W, Hh);
      if (base) { ctx.globalAlpha = dotsA; ctx.drawImage(base, 0, 0, W, Hh); }
      ctx.fillStyle = '#ffffff';
      for (const d of dots) {
        const dx = d.x - ptr.x, dy = d.y - ptr.y, m = dx * dx + dy * dy;
        const ax = d.x - head.x, ay = d.y - head.y, am = ax * ax + ay * ay;
        let g = 0;
        if (m < 6400) g = 1 - m / 6400;
        if (d.land && am < 1600 && stage !== 'void') g = Math.max(g, (1 - am / 1600) * 0.5);
        if (!g) continue;
        ctx.globalAlpha = Math.min(1, g * 0.85) * dotsA;
        ctx.beginPath(); ctx.arc(d.x, d.y, DOT_R + g * 0.8, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // the lines don't glitch either: they stay until the trip home ends, then fade out with the dots
      let linesA = 1;
      if (stage === 'vanish') linesA = 1 - 0.55 * clamp(t / VANISH, 0, 1);
      else if (stage === 'void') linesA = 0.45 * (1 - clamp(t / (VOID * 0.85), 0, 1));
      if (linesA <= 0) return;
      // finished legs stay as a trail; the current leg draws itself
      const finished = stage === 'travel' ? leg : stage === 'hold' ? Math.max(0, visited.size - 1) : legs.length;
      for (let L = 0; L < finished; L++) strokeLeg(ctx, curves[L], 1, 0.55 * linesA);
      if (stage === 'travel') {
        strokeLeg(ctx, curves[leg], u, 0.95);
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(head.x, head.y, 2.8, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ---------- projects page ---------- */
  function initProjects() {
    const P = D.projects;
    const cats = ['All', ...new Set(P.map((p) => p.category))];
    const chips = $('#chips');
    const grid = $('#pgrid');
    const list = $('#plist');
    const preview = $('#float-preview');
    let filter = 'All', mode = 'grid';

    chips.innerHTML = cats.map((c) => `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${c === 'All'}">${esc(c)}<b>${c === 'All' ? P.length : P.filter((p) => p.category === c).length}</b></button>`).join('');
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filter = b.dataset.cat;
      $$('.chip', chips).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      render();
    });
    $$('.viewby button').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      $$('.viewby button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    }));

    const SPANS = [4, 2, 2, 4, 3, 3];
    function render() {
      const items = P.filter((p) => filter === 'All' || p.category === filter);
      grid.hidden = mode !== 'grid';
      list.hidden = mode !== 'list';
      if (mode === 'grid') {
        let acc = 0;
        grid.innerHTML = items.map((p, i) => {
          let span = SPANS[i % SPANS.length];
          if (i === items.length - 1 && (acc % 6) + span < 6) span = 6 - (acc % 6);
          acc += span;
          return `<article class="pcard" style="--span:${span};animation-delay:${i * 50}ms"><button class="pcard-btn" type="button" data-i="${P.indexOf(p)}"><div class="pcard-top"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></div><div class="pcard-media">${thumb(p)}</div><div class="pcard-bot"><h3>${esc(p.title)}</h3><span class="discover">Discover →</span></div></button></article>`;
        }).join('');
      } else {
        list.innerHTML = items.map((p, i) => `<li><button type="button" data-i="${P.indexOf(p)}" style="animation-delay:${i * 35}ms"><span class="idx">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(p.title)}</span><span class="c">${esc(p.category)}</span><span class="yr">${esc(p.year)}</span><span class="ar">↗</span></button></li>`).join('');
      }
    }
    const open = (e) => { const b = e.target.closest('[data-i]'); if (b) openDetail(P[+b.dataset.i]); };
    grid.addEventListener('click', open);
    list.addEventListener('click', open);

    let shown = -1;
    list.addEventListener('pointermove', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) { preview.classList.remove('show'); shown = -1; return; }
      const i = +b.dataset.i;
      if (i !== shown) { preview.innerHTML = thumb(P[i]); shown = i; }
      preview.style.transform = `translate(${e.clientX + 24}px, ${e.clientY - 100}px)`;
      preview.classList.add('show');
    });
    list.addEventListener('pointerleave', () => { preview.classList.remove('show'); shown = -1; });
    render();
  }

  /* ---------- library page: case studies as a shelf of 3D books ---------- */
  // Generated cover (used until the real cover image exists at c.cover).
  function coverHTML(c, i) {
    const rnd = seeded(c.title);
    const [c1, c2] = c.colors || ['#eee', '#222'];
    const v = i % 4;
    let art = '';
    if (v === 0) { // sun over a hill
      art = `<i class="ca-sun" style="background:${esc(c.spine)}"></i><i class="ca-hill" style="background:${esc(c2)}"></i>`;
    } else if (v === 1) { // punched-hole pattern
      art = Array.from({ length: 14 }, () => { const sz = 6 + rnd() * 22; return `<i class="ca-dot" style="left:${(8 + rnd() * 80).toFixed(1)}%;top:${(30 + rnd() * 55).toFixed(1)}%;width:${sz.toFixed(1)}cqw;height:${sz.toFixed(1)}cqw;background:${esc(c2)}"></i>`; }).join('');
    } else if (v === 2) { // stacked, evening-out blocks
      art = Array.from({ length: 6 }, (_, k) => `<i class="ca-block" style="bottom:${12 + k * 9}%;width:${(70 - Math.abs(2.5 - k) * (8 - k) * 1.5).toFixed(0)}%;background:${k % 2 ? esc(c2) : esc(c.ink)}"></i>`).join('');
    } else { // scattered dots gathering into clusters
      const centers = [[30, 52], [68, 62], [44, 80]];
      art = Array.from({ length: 36 }, (_, k) => { const [cx, cy] = centers[k % 3]; const r = 4 + rnd() * 14; const a = rnd() * TAU; return `<i class="ca-dot" style="left:${(cx + Math.cos(a) * r).toFixed(1)}%;top:${(cy + Math.sin(a) * r * 0.7).toFixed(1)}%;width:4cqw;height:4cqw;background:${['#e8553b', esc(c2), '#2f9e6b'][k % 3]}"></i>`; }).join('');
    }
    return `<div class="cover" style="--c1:${esc(c1)};--c2:${esc(c2)};--spine:${esc(c.spine)};--ink:${esc(c.ink)};--title:${esc(c.coverInk || c.spine)}">
      <div class="cover-art">${art}</div>
      <p class="cover-kicker">Case study ${String(i + 1).padStart(2, '0')} · ${esc(c.year)}</p>
      <h3 class="cover-title">${esc(c.coverTitle || c.title)}</h3>
      <p class="cover-by">${esc(D.name)}</p>
      ${c.cover ? `<img class="cover-img" src="${esc(c.cover)}" alt="" onerror="this.remove()">` : ''}
      <span class="grain"></span>
    </div>`;
  }

  function initCases() {
    const C = D.caseStudies;
    const el = $('#cases');
    el.innerHTML = C.map((c, i) => `<button class="book" type="button" data-i="${i}" aria-label="${esc(c.title)}" style="--spine:${esc(c.spine)};--ink:${esc(c.ink)};animation-delay:${i * 90}ms">
      <div class="book-3d">
        <div class="book-face book-front">${coverHTML(c, i)}</div>
        <div class="book-face book-spine"><span class="spine-no">${String(i + 1).padStart(2, '0')}</span><span class="spine-title">${esc(c.title)}</span><span class="spine-year">${esc(c.year)}</span><span class="grain"></span></div>
        <div class="book-face book-pages"></div>
        <div class="book-face book-back"><span class="grain"></span></div>
      </div>
    </button>`).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      const c = C[i];
      if (c.link && c.link !== '#') window.open(c.link, '_blank', 'noopener');
      else openDetail({ ...c, category: 'Case Study', mediaHTML: `<div class="modal-cover" style="--spine:${esc(c.spine)}">${coverHTML(c, i)}</div>` });
    });
  }

  /* ---------- certificates: a file folder with a sticky note poking out for each ---------- */
  // Closed, it's a kraft folder with a label and a printed seal. Click a note (or the folder) and the cover swings
  // open like a book: its inside lists every certificate, and the page on the right shows the one you picked.
  function initCerts() {
    const C = D.certifications || [];
    const fd = $('#folder');
    if (!fd || !C.length) return;
    const NOTE = ['#f6dd5f', '#ff9fc2', '#8fc3ff', '#a8e39f', '#ffb366', '#c8b4ff', '#8fe0cd'];
    const years = C.map((c) => +String(c.date).slice(-4)).filter(Boolean);
    const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';
    const no = (i) => String(i + 1).padStart(2, '0');
    const tilt = (i) => (seeded(`note${i}`)() - 0.5) * 4;
    fd.innerHTML = `
      <span class="fd-side" aria-hidden="true"></span>
      <div class="fd-body">
        <span class="fd-tab" aria-hidden="true"></span>
        <span class="fd-sheets" aria-hidden="true"></span>
        <div class="fd-page" id="fd-page" aria-live="polite"></div>
        <div class="fd-notes">${C.map((c, i) => `<button class="fd-note" type="button" data-i="${i}" aria-label="Open certificate: ${esc(c.title)}"
          style="--note:${NOTE[i % NOTE.length]};--tilt:${tilt(i).toFixed(2)}deg;top:${(6 + i * (86 / C.length)).toFixed(2)}%;animation-delay:${200 + i * 60}ms"><span>${esc(c.short || c.title)}</span></button>`).join('')}</div>
        <span class="grain"></span>
      </div>
      <div class="fd-cover">
        <button class="fd-front" type="button" aria-label="Open the certificates folder">
          <span class="fd-secret" aria-hidden="true">Not secret</span>
          <span class="fd-label">
            <span class="fd-kicker">No. 01–${no(C.length - 1)} · ${esc(span)}</span>
            <span class="fd-title">Certificates &amp; courses</span>
            <span class="fd-by">${esc(D.name)}</span>
          </span>
          <span class="grain"></span>
        </button>
        <div class="fd-inside">
          <p class="fd-kicker">Contents</p>
          <ol>${C.map((c, i) => `<li><button type="button" data-i="${i}"><span>${no(i)}</span>${esc(c.short || c.title)}</button></li>`).join('')}</ol>
          <span class="grain"></span>
        </div>
      </div>`;
    const page = $('#fd-page', fd);
    const show = (i) => {
      const c = C[i];
      // opening the folder: the certificate fades in once the cover has swung clear; switching while open: at once
      const delay = fd.dataset.open === 'true' ? 0 : 0.45;
      page.innerHTML = `<article class="fd-doc${c.title.length > 48 ? ' long' : ''}" style="--note:${NOTE[i % NOTE.length]};--doc-delay:${delay}s">
        <p class="fd-doc-top"><span>No. ${no(i)}</span><span>${esc(c.date)}</span></p>
        <p class="fd-doc-kind">Certificate</p>
        <h3>${esc(c.title)}</h3>
        <p class="fd-doc-by">issued by <b>${esc(c.issuer)}</b></p>
        ${c.id ? `<p class="fd-doc-id">ID ${esc(c.id)}</p>` : ''}
        <div class="cert-skills">${(c.skills || []).map((x) => `<span>${esc(x)}</span>`).join('')}</div>
        ${c.url ? `<a class="cert-link" href="${esc(c.url)}" target="_blank" rel="noopener">Show credential ↗</a>` : ''}
        <button class="fd-back" type="button">← close</button>
        <span class="fd-stamp" aria-hidden="true"></span>
      </article>`;
      $$('.fd-note', fd).forEach((n) => n.classList.toggle('on', +n.dataset.i === i));
      fd.dataset.open = 'true';
    };
    const close = () => {
      if (fd.dataset.open !== 'true') return;
      fd.dataset.open = 'false';
      $$('.fd-note', fd).forEach((n) => n.classList.remove('on'));
    };
    fd.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-i]');
      if (pick) return show(+pick.dataset.i);
      if (e.target.closest('.fd-back')) return close();
      if (e.target.closest('.fd-front')) show(0);
    });
    // a click anywhere outside the folder, or Esc, closes it
    document.addEventListener('click', (e) => { if (!fd.contains(e.target)) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ---------- my profile page ---------- */
  const ICONS = {
    chip: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/></svg>',
    code: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9.5 7.5 12l2.5 2.5M14 9.5l2.5 2.5-2.5 2.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5.5c0 4.2 2.9 7.9 7 9.5 4.1-1.6 7-5.3 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.2c2.3.1 4.3 1.6 4.9 4.3"/></svg>',
  };
  const SHAPES = [
    '<svg viewBox="0 0 24 24"><path d="M12 5 20 19H4Z"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 4.5 19.5 12 12 19.5 4.5 12Z"/></svg>',
  ];

  function initProfile() {
    const P = D.profile;
    if (!P) return;

    $('#traits').innerHTML = P.traits.map((t, i) => `<article class="trait" style="animation-delay:${i * 60}ms">
      <span class="trait-icon">${ICONS[t.icon] || ICONS.code}</span>
      <p>${esc(t.text)}</p>
      <div class="trait-tags">${t.tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <h2>${esc(t.title)}</h2>
    </article>`).join('');

    // persona — radar chart
    const pe = P.persona;
    const svg = $('#radar');
    const n = pe.traits.length, CX = 160, CY = 158, R = 104;
    const pt = (i, r) => { const a = -Math.PI / 2 + (i * TAU) / n; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
    const hue = (i) => ['#ff6ad5', '#c6f432', '#5eead4', '#7c8cff', '#ffb547'][i % 5];
    const rings = [0.2, 0.4, 0.6, 0.8, 1].map((k) => `<circle cx="${CX}" cy="${CY}" r="${(R * k).toFixed(1)}" class="r-ring"/>`).join('');
    const axes = pe.traits.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="r-axis"/>`; }).join('');
    const scale = [20, 40, 60, 80, 100].map((v) => `<text x="${(CX - (R * v) / 100).toFixed(1)}" y="${CY + 3}" class="r-scale">${v}</text>`).join('');
    const vpts = pe.traits.map((t, i) => pt(i, (R * t.value) / 100));
    const edges = vpts.map((p, i) => { const q = vpts[(i + 1) % n]; return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${hue(i)}" class="r-edge"/>`; }).join('');
    const spokes = vpts.map((p, i) => `<line x1="${CX}" y1="${CY}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="${hue(i)}" class="r-spoke"/>`).join('');
    const nodes = vpts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${hue(i)}" class="r-node"><title>${esc(pe.traits[i].label)}: ${pe.traits[i].value}</title></circle>`).join('');
    const labels = pe.traits.map((t, i) => {
      const [x, y] = pt(i, R + 20);
      const anchor = Math.abs(x - CX) < 8 ? 'middle' : x < CX ? 'end' : 'start';
      return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" class="r-label">${esc(t.label)}</text>`;
    }).join('');
    svg.innerHTML = `<defs><radialGradient id="r-fill" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#7c8cff" stop-opacity=".05"/><stop offset="1" stop-color="#ff6ad5" stop-opacity=".32"/></radialGradient></defs>
      ${rings}${axes}${scale}
      <g class="r-shape" style="transform-origin:${CX}px ${CY}px"><polygon points="${vpts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="url(#r-fill)"/>${spokes}${edges}${nodes}</g>
      ${labels}`;
    new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) svg.classList.add('in'); }).observe(svg);

    const list = (el, items) => { $(el).innerHTML = items.map((x) => `<li>${esc(x)}</li>`).join(''); };
    list('#persona-goal', pe.goal);
    list('#persona-mindset', pe.mindset);
    $('#persona-name').textContent = D.name;
    $('#persona-role').textContent = pe.role;
    $('#persona-quote').textContent = `“${pe.quote}”`;
    const photo = $('#persona-photo');
    const photoBox = photo.parentElement;
    if (pe.photo) {
      photo.onerror = () => { photo.remove(); photoBox.classList.add('no-photo'); };
      photo.src = pe.photo;
    } else { photo.remove(); photoBox.classList.add('no-photo'); }
    const persona = $('#persona');
    $$('.flip-btn', persona).forEach((b) => b.addEventListener('click', () => {
      persona.classList.toggle('flipped');
    }));

    $('#hl-title').textContent = P.highlightsTitle || 'Highlights';
    $('#highlights').innerHTML = P.highlights.map((h, i) => `<li class="hl" style="animation-delay:${i * 70}ms">
      <span class="hl-shape">${SHAPES[i % SHAPES.length]}</span>
      <div><h3>${esc(h.title)}</h3><p class="hl-sub">${esc(h.sub)}</p><p>${esc(h.text)}</p></div>
    </li>`).join('');
  }

  /* ---------- global: glowing RGB cursor trail ---------- */
  function initCursorTrail() {
    if (!MOTION || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const NS = 'http://www.w3.org/2000/svg';
    const LEN = 15, FLOW = 0.5;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'cursor-trail');
    svg.setAttribute('aria-hidden', 'true');
    // userSpaceOnUse: a bounding-box gradient disappears when the trail is a perfectly straight line
    svg.innerHTML = '<defs><linearGradient id="trail-grad" gradientUnits="userSpaceOnUse"><stop offset="0%"/><stop offset="50%"/><stop offset="100%"/></linearGradient></defs><path stroke="url(#trail-grad)"/>';
    document.body.appendChild(svg);
    const path = svg.querySelector('path');
    const grad = svg.querySelector('linearGradient');
    const stops = [...svg.querySelectorAll('stop')];
    const mouse = { x: 0, y: 0 };
    let pts = null, running = false;

    const smooth = (p) => { // Catmull-Rom → cubic Bézier, so the trail reads as one smooth stroke
      let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
        d += ` C${(b.x + (c.x - a.x) / 6).toFixed(1)},${(b.y + (c.y - a.y) / 6).toFixed(1)} ${(c.x - (e.x - b.x) / 6).toFixed(1)},${(c.y - (e.y - b.y) / 6).toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
      }
      return d;
    };
    function step() {
      if (!pts) { running = false; return; } // pointer left the window since this frame was queued
      for (let i = pts.length - 1; i > 0; i--) {
        pts[i].x += (pts[i - 1].x - pts[i].x) * FLOW;
        pts[i].y += (pts[i - 1].y - pts[i].y) * FLOW;
      }
      pts[0].x = mouse.x; pts[0].y = mouse.y;
      const t = Date.now() / 1000;
      stops.forEach((s, k) => s.setAttribute('stop-color', `hsl(${(t * 120 + k * 120) % 360},100%,60%)`));
      // stretch the gradient from the trail's head to its tail
      const tl = pts[pts.length - 1];
      grad.setAttribute('x1', pts[0].x); grad.setAttribute('y1', pts[0].y);
      grad.setAttribute('x2', tl.x + (Math.abs(tl.x - pts[0].x) + Math.abs(tl.y - pts[0].y) < 1 ? 1 : 0)); grad.setAttribute('y2', tl.y);
      path.setAttribute('d', smooth(pts));
      const tail = pts[pts.length - 1];
      if (Math.hypot(tail.x - mouse.x, tail.y - mouse.y) < 0.5) { running = false; path.setAttribute('d', ''); return; }
      requestAnimationFrame(step);
    }
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!pts) pts = Array.from({ length: LEN }, () => ({ x: mouse.x, y: mouse.y }));
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pts = null; path.setAttribute('d', ''); });
  }

  /* ---------- global: wavy burst on click ---------- */
  function initClickWaves() {
    if (!MOTION) return;
    const NS = 'http://www.w3.org/2000/svg';
    const SIZE = 65, DUR = 800, STROKE = 2;
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'click-wave');
      svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
      svg.style.left = `${e.clientX}px`;
      svg.style.top = `${e.clientY}px`;
      const c = SIZE / 2, g = SIZE * 0.05;
      svg.innerHTML = [45, 90, 135, 180].map((deg) => {
        const r = (deg * Math.PI) / 180, n = r + Math.PI / 2;
        const x1 = c + SIZE * 0.1 * Math.cos(r), y1 = c - SIZE * 0.1 * Math.sin(r);
        const x2 = c + SIZE * 0.5 * Math.cos(r), y2 = c - SIZE * 0.5 * Math.sin(r);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        return `<path d="M ${x1} ${y1} Q ${mx + g * Math.cos(n)} ${my - g * Math.sin(n)} ${mx} ${my} T ${x2} ${y2}"/>`;
      }).join('');
      document.body.appendChild(svg);
      svg.querySelectorAll('path').forEach((p) => {
        const L = p.getTotalLength();
        p.animate([
          { strokeDasharray: `1 ${L}`, strokeDashoffset: 0, strokeWidth: STROKE },
          { strokeDasharray: `${L * 0.6} ${L}`, strokeDashoffset: -L * 0.4, strokeWidth: STROKE, offset: 0.6 },
          { strokeDasharray: `${L} ${L}`, strokeDashoffset: -L, strokeWidth: 0 },
        ], { duration: DUR, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' });
      });
      setTimeout(() => svg.remove(), DUR + 50);
    });
  }

  // Dashboard cards that open another page ("Who are you?" → Projects, the map → My Profile).
  // Clicks on the floating project cards in the tunnel keep opening their own popups.
  function initCardLinks() {
    $$('[data-link]').forEach((card) => {
      const go = () => { location.hash = card.dataset.link; };
      card.addEventListener('click', (e) => { if (!e.target.closest('.tcard, a, .modal')) go(); });
      card.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); go(); }
      });
    });
  }

  initChrome();
  initCardLinks();
  initCursorTrail();
  initClickWaves();
  initHello();
  initTime();
  initSkills();
  initTunnel();
  $$('.card-map').forEach(initMap);
  initProjects();
  initCases();
  initCerts();
  initProfile();
  requestAnimationFrame(frame);
})();

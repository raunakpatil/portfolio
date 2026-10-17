// Radar (raunakpatil.com/radar): what's new in AI, and the AI tools worth knowing.
//  - Latest in AI: the newest headlines and the open models trending on Hugging Face, live from Ronie's worker (/feed,
//    rebuilt every half hour — worker/src/feed.js), or the saved snapshot (data/feed.json) should that not answer.
//  - The directory: data/tools.json, picked by hand and refreshed every few weeks (icons in img/tools/, fetched by
//    scripts/tool-icons.py), then the catalogue, data/catalog.json — open-source AI projects on GitHub and apps on
//    Hugging Face Spaces, rebuilt every week by scripts/build-catalog.mjs.
// main.js loads this once the page is headed for (or opened), and calls open() each time it's shown.

const D = window.PORTFOLIO;
const V = new URL(import.meta.url).searchParams.get('v') || '';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOTION = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const view = $('.view[data-view="radar"]');

const FEED_URL = (D.assistant?.chatUrl || '').replace(/\/chat$/, '/feed');
const PRICES = { free: 'Free', freemium: 'Freemium', paid: 'Paid', open: 'Open source' };
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const ago = (iso, long) => {
  const m = (Date.now() - Date.parse(iso)) / 6e4;
  if (m < 60) { const n = Math.max(1, Math.round(m)); return long ? `${n} min ago` : `${n}m`; }
  if (m < 1440) { const n = Math.round(m / 60); return long ? `${n} hour${n > 1 ? 's' : ''} ago` : `${n}h`; }
  const n = Math.round(m / 1440); return long ? (n === 1 ? 'yesterday' : `${n} days ago`) : `${n}d`;
};
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n)).replace('.0', '');
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/* ---------- the data ---------- */
async function getFeed() {
  // live first (a few seconds at most), then the snapshot that ships with the site
  if (FEED_URL) {
    try {
      const r = await fetch(FEED_URL, { signal: AbortSignal.timeout(6000) });
      if (r.ok) { const f = await r.json(); if (f.news?.length) return { ...f, live: true }; }
    } catch { /* falls back */ }
  }
  const r = await fetch(`data/feed.json${V ? `?v=${V}` : ''}`);
  return { ...(await r.json()), live: false };
}
const tools = fetch(`data/tools.json${V ? `?v=${V}` : ''}`).then((r) => r.json());
// the long list (data/catalog.json, scripts/build-catalog.mjs, refreshed weekly) — fetched alongside, shown when in
let startCatalog;
const catalog = new Promise((done) => { startCatalog = () => done(fetch(`data/catalog.json${V ? `?v=${V}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)); });
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1200 }) : setTimeout(f, 300));
const feed = getFeed().catch(() => ({ news: [], models: [], live: false }));

/* ---------- latest in AI ---------- */
const LEAD_N = 5, LEAD_MS = 8000;
let lead = [], leadAt = 0, leadI = 0, leadTimer = 0, leadPaused = false;

function showLead(i, animate = true) {
  const box = $('#tl-lead-story');
  if (!box || !lead.length) return;
  leadI = (i + lead.length) % lead.length;
  const n = lead[leadI];
  const html = `<a class="tl-lead-link" href="${esc(n.link)}" target="_blank" rel="noopener">
      <span class="tl-kicker">${esc(n.source)}${n.topic ? ` <i>·</i> ${esc(n.topic)}` : ''}</span>
      <h2>${esc(n.title)}</h2>
      <span class="tl-lead-foot"><span>${esc(ago(n.date, true))}</span><span class="tl-read">Read the story <b>↗</b></span></span>
    </a>`;
  picture(n.image);
  if (animate && MOTION) {
    box.classList.add('out');
    setTimeout(() => { box.innerHTML = html; box.classList.remove('out'); }, 260);
  } else box.innerHTML = html;
  $$('#tl-lead-bars button').forEach((b, k) => {
    b.firstChild.style.transform = '';
    b.classList.toggle('done', k < leadI);
    b.classList.toggle('on', k === leadI);
    b.setAttribute('aria-current', String(k === leadI));
  });
  leadAt = performance.now();
}
// the story's picture fills the card behind its words: the next one fades in over the last once it has loaded
const imgAttrs = 'alt="" referrerpolicy="no-referrer" decoding="async"';
function picture(src) {
  const box = $('#tl-lead-pic');
  if (!box) return;
  const old = [...box.children];
  const done = () => old.forEach((o) => { o.classList.remove('in'); setTimeout(() => o.remove(), 700); });
  if (!src) { done(); return; }
  const img = new Image();
  img.alt = ''; img.referrerPolicy = 'no-referrer'; img.decoding = 'async';
  img.onload = () => { box.appendChild(img); requestAnimationFrame(() => img.classList.add('in')); done(); };
  img.onerror = done;
  img.src = src;
}
let lastFrame = 0;
function tickLead(now) {
  leadTimer = requestAnimationFrame(tickLead);
  const dt = lastFrame ? now - lastFrame : 0;
  lastFrame = now;
  // (held while the page is away, or the pointer is on the story: its time doesn't run)
  if (view.hidden || leadPaused || document.hidden || !MOTION || lead.length < 2) { leadAt += dt; return; }
  const t = Math.min(1, (now - leadAt) / LEAD_MS);
  const bar = $('#tl-lead-bars button.on b');
  if (bar) bar.style.transform = `scaleX(${t})`;
  if (t >= 1) showLead(leadI + 1);
}

function renderNews(f) {
  const box = $('#tl-news');
  box.removeAttribute('aria-busy');
  if (!f.news.length) {
    box.innerHTML = '<p class="tl-empty">The headlines couldn\'t be fetched just now — try again in a little while.</p>';
    return;
  }

  lead = f.news.slice(0, LEAD_N);
  $('#tl-lead-bars').innerHTML = lead.map((n, k) => `<button type="button" aria-label="Story ${k + 1}: ${esc(n.title)}"><b></b></button>`).join('');
  showLead(0, false);

  const rest = f.news;   // (the list has every story, newest first — the lead card turns through its first five)
  const topics = ['All', ...new Set(rest.map((n) => n.topic).filter(Boolean))];
  const chips = $('#tl-topics');
  chips.innerHTML = topics.length > 2 ? topics.map((t) => `<button class="chip" type="button" data-topic="${esc(t)}" aria-pressed="${t === 'All'}">${esc(t)}</button>`).join('') : '';
  // every headline is in the list; the card stays its size and the list scrolls inside it
  let topic = 'All';
  const list = $('#tl-wire-list');
  const draw = () => {
    const items = rest.filter((n) => topic === 'All' || n.topic === topic);
    list.innerHTML = items.map((n, i) => `<li><a class="tl-row" href="${esc(n.link)}" target="_blank" rel="noopener" style="animation-delay:${Math.min(i, 10) * 35}ms">
        <span class="tl-ago">${esc(ago(n.date))}</span>
        <span class="tl-thumb" data-l="${esc(n.source[0])}">${n.image ? `<img src="${esc(n.image)}" ${imgAttrs} loading="lazy" onerror="this.remove()">` : ''}</span>
        <span class="tl-h">${esc(n.title)}</span>
        <span class="tl-src">${esc(n.source)}</span>
        <span class="ar" aria-hidden="true">↗</span></a></li>`).join('') || '<li class="tl-none">No stories on that today.</li>';
    list.scrollTop = 0;
  };
  chips.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    topic = b.dataset.topic;
    $$('.chip', chips).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    draw();
  };
  draw();

  const strip = $('#tl-models');
  if (!f.models?.length) { strip.closest('.tl-models').hidden = true; return; }
  // each model its own colour, sweeping the skill matrix's spectrum along the strip
  const count = f.models.length;
  const tile = (m, i, copy) => `<a class="tl-model" href="${esc(m.link)}" target="_blank" rel="noopener"${copy ? ' aria-hidden="true" tabindex="-1"' : ''} draggable="false" style="--h:${Math.round((((75 - i * (330 / count)) % 360) + 360) % 360)}">
      <span class="tl-model-top"><span>${esc(m.maker)}</span><span class="tl-rank">${String(i + 1).padStart(2, '0')}</span></span>
      <span class="tl-model-name">${esc(m.name)}</span>
      <span class="tl-model-bot"><span class="tl-task">${esc(m.task)}</span><span class="tl-stats"><span title="Likes">♥ ${short(m.likes)}</span><span title="Downloads last month">↓ ${short(m.downloads)}</span></span></span>
    </a>`;
  // one row that drifts along by itself — twice over, so it runs on without a seam — and can be swiped or dragged
  strip.innerHTML = f.models.map((m, i) => tile(m, i)).join('') + (MOTION ? f.models.map((m, i) => tile(m, i, true)).join('') : '');
  if (MOTION) drift(strip);
}

// the trending strip's drift: ~30 px a second, held while the pointer is on it (or a finger, or the keyboard), and for
// a moment after someone has scrolled it themselves; a drag with the mouse scrolls it too
function drift(strip) {
  let pos = 0, last = 0, hold = 0, over = false, drag = null, moved = false;
  const half = () => strip.scrollWidth / 2;
  const step = (now) => {
    requestAnimationFrame(step);
    const dt = Math.min(64, last ? now - last : 0);
    last = now;
    if (view.hidden || document.hidden || over || drag || now < hold) { pos = strip.scrollLeft; return; }
    pos += dt * 0.03;
    if (pos >= half()) pos -= half();
    strip.scrollLeft = pos;
  };
  requestAnimationFrame(step);
  const rest = (ms = 2500) => { hold = performance.now() + ms; };
  strip.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') over = true; });
  strip.addEventListener('pointerleave', () => { over = false; rest(600); });
  strip.addEventListener('touchstart', () => rest(4000), { passive: true });
  strip.addEventListener('wheel', () => rest(), { passive: true });
  strip.addEventListener('focusin', () => { over = true; });
  strip.addEventListener('focusout', () => { over = false; });
  // (a manual scroll past the copy's start jumps back by one set, so it never runs out)
  strip.addEventListener('scroll', () => {
    if (strip.scrollLeft >= half() + 1) strip.scrollLeft -= half();
    else if (strip.scrollLeft <= 0 && (drag || performance.now() < hold)) strip.scrollLeft += half();
  }, { passive: true });
  strip.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button) return;
    drag = { x: e.clientX, left: strip.scrollLeft };
    moved = false;
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) { moved = true; strip.classList.add('dragging'); }
    strip.scrollLeft = drag.left - dx;
  });
  addEventListener('pointerup', () => { if (drag) { drag = null; strip.classList.remove('dragging'); rest(1500); } });
  // a drag isn't a click on the tile it ended over
  strip.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
}

/* ---------- the directory ---------- */
// three sources in one list: Raunak's hand-picked tools first, then the catalogue — open-source projects on GitHub
// and apps on Hugging Face Spaces, taken in turns by how popular each is in its own place
const GH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>';
const SOURCES = {
  all: ['Everything', ''],
  star: ["Raunak's picks", '<span class="tl-star" aria-hidden="true">★</span>'],
  saved: ['Saved', '<span class="tl-saved" aria-hidden="true">♥</span>'],
  pick: ['Hand-picked', ''],
  gh: ['GitHub', GH_SVG],
  hf: ['Hugging Face', '<span aria-hidden="true">🤗</span>'],
  ph: ['Product Hunt', '<span class="tl-ph" aria-hidden="true">P</span>'],
};
const SORTS = { picks: 'Featured', rising: 'Rising', az: 'A–Z', new: 'Newest' };
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>';
const GRAD = { red: '#fda4af', yellow: '#fde68a', green: '#86efac', blue: '#93c5fd', indigo: '#a5b4fc', purple: '#d8b4fe', pink: '#f9a8d4', gray: '#e5e7eb' };
const fmt = (n) => n.toLocaleString('en-US');
// (a Space's icon is sometimes several emoji: just the first)
const GRAPHEMES = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const firstGlyph = (e) => (GRAPHEMES ? GRAPHEMES.segment(e)[Symbol.iterator]().next().value?.segment : [...e][0]) || '🤗';
const CHEVRON = '<svg class="tl-dd-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';

// a small menu that drops from a pill: its options (with counts) are drawn each time it opens
function dropdown(host, { key, label, options, value, onPick }) {
  const box = document.createElement('div');
  box.className = 'tl-dd';
  box.innerHTML = `<button type="button" class="tl-dd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="k">${label}</span><span class="v"></span>${CHEVRON}</button><div class="tl-dd-menu" role="listbox" aria-label="${label}"></div>`;
  host.appendChild(box);
  const btn = box.firstChild, menu = box.lastChild;
  const opts = () => menu.querySelectorAll('[role="option"]:not(:disabled)');
  const close = (focus) => {
    if (!box.classList.contains('open')) return;
    box.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    if (focus) btn.focus();
  };
  const open = () => {
    document.dispatchEvent(new CustomEvent('tl-dd-open', { detail: box }));
    menu.innerHTML = options().map(([v, text, n, pre = '']) => `<button type="button" role="option" data-v="${esc(v)}" aria-selected="${v === value()}"${n === 0 && v !== value() ? ' disabled' : ''}>${pre}<span class="t">${text}</span>${n == null ? '' : `<span class="n">${fmt(n)}</span>`}</button>`).join('');
    box.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    // (kept inside the window: it opens leftwards when there's no room on the right)
    menu.classList.toggle('left', btn.getBoundingClientRect().left + 260 > innerWidth);
    (menu.querySelector('[aria-selected="true"]') || opts()[0])?.focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => (box.classList.contains('open') ? close() : open()));
  menu.addEventListener('click', (e) => { const o = e.target.closest('[role="option"]'); if (o && !o.disabled) { onPick(o.dataset.v); close(true); } });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
    if (!/^Arrow(Up|Down)$/.test(e.key)) return;
    e.preventDefault();
    if (!box.classList.contains('open')) { open(); return; }
    const list = [...opts()], i = list.indexOf(document.activeElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  });
  document.addEventListener('tl-dd-open', (e) => { if (e.detail !== box) close(); });
  document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) close(); });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget) && e.relatedTarget) close(); });
  return {
    // the pill shows what's chosen, and turns dark while it narrows the list
    update(text, on) { box.querySelector('.v').innerHTML = text; box.classList.toggle('set', on); },
  };
}

function renderDirectory(T, catalogP) {
  const S = { view: 'all', q: '', src: 'all', price: 'all', cat: 'all', sort: 'picks', limit: 24 };
  const NEW_DAYS = 90;
  const STEP = 48;
  const grid = $('#tl-grid'), more = $('#tl-more'), count = $('#tl-count'), search = $('#tl-search'), clear = $('#tl-clear');
  const keyOf = (t) => `${t.n} ${t.d} ${T.categories[t.c]} ${PRICES[t.p] || ''} ${t.uses || ''} ${t.by || ''}`.toLowerCase();

  const curated = T.tools.map((t, i) => ({ ...t, src: 'pick', i }));
  let rising = new Set();
  // saved tools: kept in this browser only
  const SAVE_KEY = 'radar-saved';
  const saved = new Set((() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch { return []; } })());
  const keepSaved = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify([...saved])); } catch { /* private window: this visit only */ } };
  let all = curated.map((t) => ({ ...t, key: keyOf(t) }));

  // the catalogue joins when it arrives (it's the bigger file); anything already hand-picked isn't listed twice
  catalogP.then((C) => {
    if (!C) return;
    // (the catalogue is already one of each — scripts/build-catalog.mjs — but a name or link seen once is never shown twice)
    const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const known = new Set(curated.flatMap((t) => [norm(t.n), t.u.replace(/\/$/, '').toLowerCase()]));
    const take = (list, make) => list.map(make).filter((t) => {
      const k = norm(t.n), u = t.u.toLowerCase();
      if (known.has(k) || known.has(u)) return false;
      known.add(k); known.add(u);
      return true;
    });
    const gh = take(C.gh || [], ([n, full, d, stars, c, oid, rel, rise]) => ({ n, u: `https://github.com/${full}`, d, c, p: 'open', src: 'gh', pop: stars, oid, by: full.split('/')[0], rel, rise }));
    const hf = take(C.hf || [], ([n, id, d, likes, c, emoji, from, to, rel, rise]) => ({ n, u: `https://huggingface.co/spaces/${id}`, d, c, p: 'free', src: 'hf', pop: likes, emoji, from, to, by: id.split('/')[0], rel, rise }));
    // in turns: the nth-most-popular GitHub project sits by the nth-most-liked Space
    gh.forEach((t, k) => { t.rank = k / gh.length; });
    // (Product Hunt's price label, where it gives one: otherwise "price on site")
    const ph = take(C.ph || [], ([n, slug, d, votes, c, thumb, p, link, rel, rise]) => ({ n, u: link, d, c, p: p || 'na', src: 'ph', pop: votes, thumb, slug, by: 'Product Hunt', rel, rise }));
    hf.forEach((t, k) => { t.rank = (k + 0.5) / hf.length; });
    ph.forEach((t, k) => { t.rank = (k + 0.25) / ph.length; });
    // rising: in turns again, the fastest-climbing of each place first (its stars, likes or upvotes gained a day)
    for (const list of [gh, hf, ph]) [...list].sort((a, b) => (b.rise || 0) - (a.rise || 0)).forEach((t, k, arr) => { t.riseRank = (k + 0.5) / arr.length; });
    const extra = [...gh, ...hf, ...ph].sort((a, b) => a.rank - b.rank).map((t, k) => ({ ...t, i: curated.length + k }));
    rising = new Set(extra.filter((t) => t.rise > 0).sort((a, b) => a.riseRank - b.riseRank).slice(0, 24).map((t) => t.i));
    all = [...all, ...extra.map((t) => ({ ...t, key: keyOf(t) }))];
    rankAll();
    search.placeholder = `Search ${fmt(all.length)} AI tools`;
    drawViews();
    draw();
  });

  const inSrc = (t, s) => s === 'all' || (s === 'star' ? t.pick : s === 'saved' ? saved.has(keyFor(t)) : t.src === s);
  const matches = (t, skip) => (skip === 'q' || !S.q || S.q.split(/\s+/).every((w) => t.key.includes(w)))
    && (skip === 'src' || inSrc(t, S.src))
    && (skip === 'price' || S.price === 'all' || t.p === S.price)
    && (skip === 'cat' || S.cat === 'all' || t.c === S.cat);
  // the three ways in: Raunak's top 20, everything, or what's newly released (in the last NEW_DAYS days)
  // (new releases: released — the project or Space created, the product launched — in the last NEW_DAYS days)
  // (and only real launches: a proper description, a GitHub project that's about AI, a Space people have liked)
  const AI_WORDS = /\b(ai|llms?|gpt[\w.-]*|agents?|agentic|models?|neural|ml|machine learning|deep learning|diffusion|transformers?|rag|embeddings?|chatbots?|vision|speech|tts|asr|stt|generative|prompts?|copilot|openai|anthropic|claude|gemini|llama|mistral|qwen|deepseek|ollama|langchain|inference|nlp|mcp|ocr|text-to-\w+|image-to-\w+|voice|lora|fine-?tun\w*|multimodal|reasoning|semantic)\b/i;
  const isFresh = (t) => t.rel && Date.now() - Date.parse(t.rel) < NEW_DAYS * 864e5 && (t.d || '').length >= 24
    && (t.src === 'gh' ? AI_WORDS.test(`${t.n} ${t.d}`) : t.src === 'hf' ? t.pop >= 50 : t.src !== 'pick');
  const pool = () => (S.view === 'top' ? all.filter((t) => t.pick) : S.view === 'new' ? all.filter(isFresh) : all);
  const tally = (skip, test) => pool().reduce((n, t) => n + (matches(t, skip) && test(t) ? 1 : 0), 0);
  const views = $('#tl-views');
  const drawViews = () => {
    const n = { top: all.filter((t) => t.pick).length, all: all.length, new: all.filter(isFresh).length };
    $('[data-v="top"] .tl-view-t', views).textContent = `Top ${n.top} AI tools`;
    $('[data-v="all"] small', views).textContent = `Search all ${fmt(n.all)} in the directory`;
    $('[data-v="new"] small', views).textContent = n.new ? `${fmt(n.new)} released in the last ${NEW_DAYS} days` : 'The latest releases';
  };
  views.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b || b.dataset.v === S.view) return;
    $$('[data-v]', views).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    S.view = b.dataset.v;
    $('.tl-bar').classList.toggle('top', S.view === 'top');
    $('.tl-bar').classList.toggle('new', S.view === 'new');
    set('view', S.view);
  });

  const bar = $('#tl-dds');
  const dd = {
    src: dropdown(bar, {
      key: 'src', label: 'Source', value: () => S.src, onPick: (v) => set('src', v),
      options: () => Object.entries(SOURCES).map(([k, [v, pre]]) => [k, v, tally('src', (t) => inSrc(t, k)), pre]),
    }),
    price: dropdown(bar, {
      key: 'price', label: 'Price', value: () => S.price, onPick: (v) => set('price', v),
      options: () => [['all', 'Any price', tally('price', () => true)], ...Object.entries(PRICES).map(([k, v]) => [k, v, tally('price', (t) => t.p === k), `<span class="tl-dot p-${k}" aria-hidden="true"></span>`])],
    }),
    cat: dropdown(bar, {
      key: 'cat', label: 'Category', value: () => S.cat, onPick: (v) => set('cat', v),
      options: () => [['all', 'All categories', tally('cat', () => true)], ...Object.entries(T.categories).map(([k, v]) => [k, esc(v), tally('cat', (t) => t.c === k)])],
    }),
    sort: dropdown(bar, {
      key: 'sort', label: 'Sort', value: () => S.sort, onPick: (v) => set('sort', v),
      options: () => Object.entries(SORTS).filter(([k]) => k !== 'new' || curated.some((t) => t.added)).map(([k, v]) => [k, v]),
    }),
  };
  const drawPills = () => {
    dd.src.update(`${SOURCES[S.src][1]}${SOURCES[S.src][0]}`, S.src !== 'all');
    dd.price.update(S.price === 'all' ? 'Any' : `<span class="tl-dot p-${S.price}" aria-hidden="true"></span>${PRICES[S.price]}`, S.price !== 'all');
    dd.cat.update(S.cat === 'all' ? 'All' : esc(T.categories[S.cat]), S.cat !== 'all');
    dd.sort.update(S.view === 'new' ? 'Newest' : SORTS[S.sort], false);
    clear.hidden = S.view === 'top' || !(S.q || S.src !== 'all' || S.price !== 'all' || S.cat !== 'all');
  };

  const icon = (t) => {
    if (t.src === 'gh') return `<span class="tool-icon" data-l="${esc(t.n[0])}"><img class="av" src="https://avatars.githubusercontent.com/u/${+t.oid}?s=64&amp;v=4" alt="" loading="lazy" width="64" height="64" onerror="this.remove()"></span>`;
    if (t.src === 'hf') return `<span class="tool-icon emo" style="--g1:${GRAD[t.from] || GRAD.gray};--g2:${GRAD[t.to] || GRAD.gray}">${esc(firstGlyph(t.emoji))}</span>`;
    if (t.src === 'ph') {
      const src = /^https:\/\//.test(t.thumb || '') ? `${t.thumb.split('?')[0]}?auto=format&fit=crop&w=96&h=96` : '';
      return `<span class="tool-icon" data-l="${esc(t.n[0])}">${src ? `<img class="av" src="${esc(src)}" alt="" loading="lazy" width="64" height="64" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
    }
    return `<span class="tool-icon" data-l="${esc(t.n[0])}">${t.icon === false ? '' : `<img src="img/tools/${slug(t.n)}.webp" alt="" loading="lazy" width="64" height="64" onerror="this.remove()">`}</span>`;
  };
  // each card has two sides. A tap anywhere on it turns it over (and back); only its ↗ goes to the tool's page.
  // The back only says what the front doesn't: what it does in plain words (written for each tool by Ronie's worker,
  // /explain, the first time anyone turns it over), how to get it, when it joined, where it ranks, what's like it.
  const GET = {
    pick: { free: 'Free on {host}', freemium: 'Free plan on {host}', paid: 'Paid plans on {host}', open: 'Free and open source' },
    gh: 'Clone it from GitHub', hf: 'Use it in the browser, nothing to install', ph: 'Plans on its own site',
  };
  const keyFor = (t) => (t.src === 'pick' ? `pick:${t.n}` : t.src === 'gh' ? `gh:${t.u.replace('https://github.com/', '')}`
    : t.src === 'hf' ? `hf:${t.u.replace('https://huggingface.co/spaces/', '')}` : `ph:${t.slug}`);
  const EX = new Map();
  const EX_URL = (D.assistant?.chatUrl || '').replace(/\/chat$/, '/explain');
  const explainOf = (t) => {
    const k = keyFor(t);
    if (!EX.has(k)) {
      EX.set(k, !EX_URL ? Promise.resolve('') : fetch(EX_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }), signal: AbortSignal.timeout(15000) })
        .then((r) => (r.ok ? r.json() : {})).then((j) => j.text || '').catch(() => ''));
      EX.get(k).then((x) => { if (!x) EX.delete(k); });   // (a miss can be tried again later)
    }
    return EX.get(k);
  };
  // where each one stands in its category (the order the directory lists them in)
  let standing = new Map(), leaders = {}, byI = new Map();
  const rankAll = () => {
    byI = new Map(all.map((t) => [t.i, t]));
    standing = new Map();
    leaders = {};
    const seen = {};
    for (const t of [...all].sort((a, b) => (a.src === 'pick' && b.src === 'pick' ? (b.pick ? 1 : 0) - (a.pick ? 1 : 0) : 0) || a.i - b.i)) {
      seen[t.c] = (seen[t.c] || 0) + 1;
      standing.set(t, seen[t.c]);
      (leaders[t.c] ||= []).push(t);
    }
    rankAll.size = seen;
  };
  const back = (t) => {
    const get = t.src === 'pick' ? GET.pick[t.p].replace('{host}', esc(host(t.u))) : GET[t.src];
    const kicker = t.src === 'pick'
      ? (t.pick ? `★ Raunak's top ${all.filter((x) => x.pick).length} · No. ${curatedTop.indexOf(t.n) + 1}` : 'Hand-picked by Raunak')
      : t.src === 'gh' ? 'Open-source project' : t.src === 'ph' ? `Product Hunt launch · ▲ ${fmt(t.pop)}` : 'Hugging Face Space';
    // its neighbours in its category's ranking: the ones just above and below it
    const list = leaders[t.c] || [], at = (standing.get(t) || 1) - 1;
    const from = Math.max(0, Math.min(at - 1, list.length - 4));
    const like = list.slice(from, from + 4).filter((x) => x !== t).slice(0, 3).map((x) => esc(x.n)).join(', ');
    const rows = [
      ['Get it', get],
      t.rel ? ['Released', `${day(t.rel)} <i>· ${ago(t.rel, true)}</i>`, 'r-added'] : null,
      standing.get(t) ? ['Ranks', `No. ${fmt(standing.get(t))} of ${fmt(rankAll.size[t.c])} in ${esc(T.categories[t.c])}`] : null,
      like ? ['Similar', like] : null,
    ].filter(Boolean);
    return `<span class="tool-back-head">${icon(t)}<span class="tool-back-kicker">${kicker}</span></span>
      <p class="tool-back-what"><span class="tl-skel-line"></span><span class="tl-skel-line short"></span></p>
      <dl>${rows.map(([k, v, cls]) => `<div${cls ? ` class="${cls}"` : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  };
  const curatedTop = curated.filter((t) => t.pick).map((t) => t.n);
  const card = (t, k) => {
    const isNew = t.added && Date.now() - Date.parse(t.added) < 30 * 864e5;
    const rank = S.view === 'top' ? `<span class="tool-rank">${String(k + 1).padStart(2, '0')}</span>` : '';
    const when = S.view === 'new' && t.rel ? ` · ${ago(t.rel, true)}` : '';
    const pop = t.src === 'gh' ? `<span class="tool-pop" title="${fmt(t.pop)} stars on GitHub">★ ${short(t.pop)}</span>`
      : t.src === 'hf' ? `<span class="tool-pop" title="${fmt(t.pop)} likes on Hugging Face">♥ ${short(t.pop)}</span>`
      : t.src === 'ph' ? `<span class="tool-pop" title="${fmt(t.pop)} upvotes on Product Hunt">▲ ${short(t.pop)}</span>` : '';
    return `<div class="tool-card" data-i="${t.i}" style="animation-delay:${Math.min(k % STEP, 16) * 30}ms"><div class="tool-inner">
      <div class="tool tool-front${t.src === 'pick' ? '' : ' cat'}" role="button" tabindex="0" aria-label="${esc(t.n)} — turn over for details">
      <span class="tool-top">
        ${icon(t)}
        <span class="tool-flags">${rank}${t.uses ? `<span class="tool-uses">${esc(t.uses)}</span>` : ''}${isNew ? '<span class="tool-new">New</span>' : ''}${t.pick ? '<span class="tool-pick" title="One of Raunak\'s picks">★</span>' : ''}${rising.has(t.i) && S.sort !== 'rising' ? '<span class="tool-rise" title="Climbing fast right now">↑ Rising</span>' : ''}${pop}<button type="button" class="tool-save" aria-pressed="${saved.has(keyFor(t))}" aria-label="Save ${esc(t.n)}" title="Save">${HEART}</button><a class="tool-go" href="${esc(t.u)}" target="_blank" rel="noopener" aria-label="Open ${esc(t.n)} (${esc(host(t.u))})" title="Open ${esc(host(t.u))}">↗</a></span>
      </span>
      <h3>${esc(t.n)}</h3>
      ${t.src === 'ph' ? `<span class="tool-by">Product Hunt${when}</span>` : t.by ? `<span class="tool-by">${t.src === 'gh' ? 'GitHub' : 'Hugging Face'} · ${esc(t.by)}${when}</span>` : when ? `<span class="tool-by">Added${when}</span>` : ''}
      <p>${esc(t.d)}</p>
      <span class="tool-bot"><span class="tool-cat">${esc(T.categories[t.c])}</span><span class="tool-price"><span class="tl-dot p-${t.p}"></span>${PRICES[t.p] || 'Price on site'}</span></span>
      </div>
      <div class="tool tool-back" role="button" tabindex="-1" aria-label="Turn ${esc(t.n)} back over" inert></div>
    </div></div>`;
  };
  // (the back is written as it turns, so its ranks and look-alikes are always the current ones; its plain-words line
  // arrives a moment later the first time, then straight away)
  const turn = (c, over) => {
    const [front, rear] = c.querySelectorAll('.tool');
    if (over) {
      const t = byI.get(+c.dataset.i);
      rear.innerHTML = back(t);
      const what = rear.querySelector('.tool-back-what');
      explainOf(t).then((x) => {
        if (!what.isConnected) return;
        if (x) { what.textContent = x; what.classList.add('in'); } else what.remove();
      });
    }
    c.classList.toggle('flipped', over);
    front.inert = over;
    rear.inert = !over;
    rear.tabIndex = over ? 0 : -1;
    (over ? rear : front).focus({ preventScroll: true });
  };
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.tool-card');
    if (!c || e.target.closest('.tool-go')) return;   // (↗ only opens the page)
    const sv = e.target.closest('.tool-save');
    if (sv) {   // (♥ saves it, or lets it go)
      const k = keyFor(byI.get(+c.dataset.i));
      if (saved.has(k)) saved.delete(k); else saved.add(k);
      keepSaved();
      sv.setAttribute('aria-pressed', String(saved.has(k)));
      if (S.src === 'saved') draw();
      return;
    }
    turn(c, !c.classList.contains('flipped'));
  });
  grid.addEventListener('keydown', (e) => {
    const side = e.target.closest('.tool-front, .tool-back');
    if (!side || e.target.closest('.tool-go, .tool-save')) return;
    if (e.key === 'Enter' || e.key === ' ' || (e.key === 'Escape' && side.classList.contains('tool-back'))) {
      e.preventDefault();
      turn(side.closest('.tool-card'), side.classList.contains('tool-front'));
    }
  });
  let items = [], shownN = 0, shownSig = '';
  function draw() {
    const top = S.view === 'top';
    items = top ? pool() : pool().filter((t) => matches(t));
    items = top ? items.sort((a, b) => a.i - b.i)
      : S.view === 'new' ? items.sort((a, b) => b.rel.localeCompare(a.rel) || a.i - b.i)
      : S.sort === 'az' ? items.sort((a, b) => a.n.localeCompare(b.n))
      : S.sort === 'rising' ? items.sort((a, b) => (a.riseRank ?? 2) - (b.riseRank ?? 2) || a.i - b.i)
      : S.sort === 'new' ? items.sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.i - b.i)
      : items.sort((a, b) => (a.src === 'pick' && b.src === 'pick' ? (b.pick ? 1 : 0) - (a.pick ? 1 : 0) : 0) || a.i - b.i);
    count.textContent = top ? `Raunak's top ${items.length} · ${day(T.updated)}` : S.view === 'new' ? `${fmt(items.length)} new releases · newest first` : `${fmt(items.length)} of ${fmt(all.length)}`;
    const n = Math.min(items.length, S.limit);
    const sig = `${S.view}|${items.slice(0, n).map((t) => t.i).join()}|${S.q}`;
    if (sig !== shownSig) {   // (the catalogue arriving under an unchanged first screen redraws nothing)
      grid.innerHTML = items.slice(0, n).map(card).join('') || (S.src === 'saved' && !saved.size
        ? '<div class="tl-none-box"><p>Nothing saved yet — tap the ♥ on any tool to keep it here.</p></div>'
        : !$('#tl-answer').hidden ? '<div class="tl-none-box"><p>Radar&rsquo;s suggestions are just above — or clear the search to browse everything.</p><button type="button" class="tl-pill" id="tl-reset">Clear the search</button></div>'
        : `<div class="tl-none-box"><p>Nothing matches${S.q ? ` “${esc(S.q)}”` : ''}.</p><button type="button" class="tl-pill" id="tl-reset">Clear the filters</button></div>`);
      shownN = n;
      shownSig = sig;
    }
    more.hidden = items.length <= S.limit;
    more.textContent = `Show more · ${fmt(Math.min(S.limit, items.length))} of ${fmt(items.length)}`;
    drawPills();
  }
  // more cards: the next lot is added under the ones already there (nothing above them redraws)
  more.addEventListener('click', () => {
    const from = S.limit;
    S.limit += STEP;
    grid.insertAdjacentHTML('beforeend', items.slice(from, S.limit).map(card).join(''));
    shownN = Math.min(items.length, S.limit);
    shownSig = `${S.view}|${items.slice(0, shownN).map((t) => t.i).join()}|${S.q}`;
    more.hidden = items.length <= S.limit;
    more.textContent = `Show more · ${fmt(shownN)} of ${fmt(items.length)}`;
  });
  const set = (k, v) => { S[k] = v; S.limit = 24; draw(); toURL(k !== 'q'); };
  const reset = () => { Object.assign(S, { q: '', src: 'all', price: 'all', cat: 'all', limit: 24 }); search.value = ''; draw(); toURL(true); };
  // a view of the directory is a link: raunakpatil.com/radar?view=new&cat=video&price=free — and back steps back
  const PARAMS = { view: 'all', q: '', src: 'all', price: 'all', cat: 'all', sort: 'picks' };
  const onRadar = () => /^\/radar(\.html)?\/?$/.test(location.pathname);
  function fromURL() {
    const u = new URLSearchParams(location.search);
    for (const k of Object.keys(PARAMS)) S[k] = u.get(k) || PARAMS[k];
    if (!['all', 'top', 'new'].includes(S.view)) S.view = 'all';
    if (!SOURCES[S.src]) S.src = 'all';
    if (S.price !== 'all' && !PRICES[S.price]) S.price = 'all';
    if (S.cat !== 'all' && !T.categories[S.cat]) S.cat = 'all';
    if (!SORTS[S.sort]) S.sort = 'picks';
    S.q = S.q.toLowerCase().slice(0, 80);
    search.value = S.q;
    $$('[data-v]', views).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.v === S.view)));
    $('.tl-bar').classList.toggle('top', S.view === 'top');
    $('.tl-bar').classList.toggle('new', S.view === 'new');
  }
  function toURL(push) {
    if (!onRadar()) return;
    const u = new URLSearchParams();
    for (const [k, d] of Object.entries(PARAMS)) if (S[k] && S[k] !== d) u.set(k, S[k]);
    const url = `/radar${u.toString() ? `?${u}` : ''}`;
    if (url !== location.pathname + location.search) history[push ? 'pushState' : 'replaceState'](null, '', url);
  }
  addEventListener('popstate', () => { if (onRadar()) { fromURL(); S.limit = 24; draw(); } });
  clear.addEventListener('click', reset);
  let qt = 0;
  search.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => set('q', search.value.trim().toLowerCase()), 140); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; set('q', ''); } });
  // "/" jumps to the search, as on most sites with one
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || view.hidden || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
    e.preventDefault();
    search.focus();
  });
  grid.addEventListener('click', (e) => { if (e.target.closest('#tl-reset')) reset(); });
  search.placeholder = `Search ${fmt(all.length)} AI tools`;
  rankAll();
  fromURL();
  drawViews();
  draw();
  initAsk({ all: () => all, keyFor, icon, esc, onAnswer: () => { shownSig = ''; draw(); } });
}

/* ---------- Ask Radar ---------- */
// Describe what you need ("something to turn my podcast into clips") and Radar suggests a few tools. The page picks the
// likeliest few dozen by their words; Ronie's worker (POST /ask) reads those and chooses, saying why for each.
const ASK_URL = (D.assistant?.chatUrl || '').replace(/\/chat$/, '/ask');
const STOP = new Set('a an and any app apps are best can could do does find for from get give good great help how i if in into is it its like make me my need of on or please recommend something some suggest that the thing this to tool tools use using want way what which with without would you your ai an'.split(' '));
const ALSO = {
  podcast: ['audio', 'voice', 'speech'], podcasts: ['audio', 'voice'], clip: ['video', 'short'], clips: ['video', 'short'],
  photo: ['image', 'picture'], photos: ['image', 'picture'], picture: ['image', 'photo'], pictures: ['image'], image: ['photo', 'picture'],
  images: ['image', 'photo'], art: ['image', 'drawing'], code: ['coding', 'developer', 'programming'], coding: ['code'],
  write: ['writing', 'copy', 'text'], writing: ['write', 'copy'], essay: ['writing'], slides: ['presentation', 'deck'],
  presentation: ['slides', 'deck'], song: ['music', 'audio'], songs: ['music'], music: ['song', 'audio'], meeting: ['notes', 'transcribe', 'transcription'],
  meetings: ['meeting', 'notes'], notes: ['meeting', 'note'], voice: ['speech', 'tts', 'audio'], video: ['clip', 'film'], videos: ['video'],
  chat: ['assistant', 'chatbot'], research: ['papers', 'search'], papers: ['research'], pdf: ['document', 'documents'], pdfs: ['pdf', 'document'],
  translate: ['translation', 'language'], logo: ['brand', 'design'], website: ['site', 'web'], '3d': ['model', 'mesh'],
  email: ['inbox', 'mail'], emails: ['email', 'inbox'], resume: ['cv', 'job'], transcribe: ['transcription', 'speech'],
};
const words = (q) => q.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 1 && !STOP.has(w));

function initAsk({ all, keyFor, icon, esc: e, onAnswer }) {
  const search = $('#tl-search'), btn = $('#tl-ask'), box = $('#tl-answer');
  if (!btn || !box || !ASK_URL) return;
  const ready = () => words(search.value).length >= 2 && search.value.trim().split(/\s+/).length >= 3;
  const toggle = () => { btn.hidden = !ready(); };
  search.addEventListener('input', toggle);
  toggle();
  // the likeliest few dozen, by their own words (a word's ending is let go, so "podcasts" finds "podcast"): room for
  // the 16 best of the hand-picked tools and the 20 best of the catalogue, so a polished product isn't crowded out
  const likely = (q) => {
    const stem = (w) => (w.length > 5 ? w.slice(0, -2) : w.length > 3 ? w.replace(/s$/, '') : w);
    const terms = [...new Set(words(q).flatMap((w) => [w, ...(ALSO[w] || [])]).map(stem))];
    const scored = all().map((t) => {
      const name = t.n.toLowerCase();
      let s = 0;
      for (const w of terms) { if (name.includes(w)) s += 4; if (t.key.includes(w)) s += 2; }
      if (s) s += t.src === 'pick' ? (t.pick ? 2 : 1) : 1 - (t.rank || 0);
      return [s, t];
    }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, t]) => t);
    return [...scored.filter((t) => t.src === 'pick').slice(0, 16), ...scored.filter((t) => t.src !== 'pick').slice(0, 20)];
  };
  let asked = 0;
  async function ask() {
    const q = search.value.trim().slice(0, 200);
    if (!ready()) return;
    const n = ++asked;
    box.hidden = false;
    box.innerHTML = `<div class="tl-answer-head"><span><b>✦ Radar</b> is looking for “${e(q)}”…</span><button type="button" class="tl-answer-x" aria-label="Close">×</button></div><div class="tl-answer-wait"><i></i><i></i><i></i></div>`;
    const pool = likely(q);
    const byKey = new Map(pool.map((t) => [keyFor(t), t]));
    let picks = [];
    if (pool.length) {
      try {
        const r = await fetch(ASK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, keys: [...byKey.keys()] }), signal: AbortSignal.timeout(20000) });
        picks = r.ok ? ((await r.json()).picks || []) : [];
      } catch { picks = []; }
    }
    if (n !== asked) return;   // (a newer question took over)
    onAnswer?.();
    const found = picks.map((p) => [byKey.get(p.key), p.why]).filter(([t]) => t);
    // (if the model can't be reached, the best word matches still help)
    const list = found.length ? found : pool.slice(0, 4).map((t) => [t, '']);
    box.innerHTML = `<div class="tl-answer-head"><span><b>✦ Radar</b> suggests, for “${e(q)}”</span><button type="button" class="tl-answer-x" aria-label="Close">×</button></div>`
      + (list.length ? `<ul class="tl-answer-list">${list.map(([t, why]) => `<li><a href="${e(t.u)}" target="_blank" rel="noopener">${icon(t)}<span class="tl-answer-t"><b>${e(t.n)}</b><span>${e(why || t.d)}</span></span><span class="ar" aria-hidden="true">↗</span></a></li>`).join('')}</ul>`
        : '<p class="tl-answer-none">Nothing close in the directory — try describing it another way.</p>');
  }
  btn.addEventListener('click', ask);
  search.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ready()) { ev.preventDefault(); ask(); } });
  box.addEventListener('click', (ev) => { if (ev.target.closest('.tl-answer-x')) { asked++; box.hidden = true; box.innerHTML = ''; onAnswer?.(); } });
}

/* ---------- wiring ---------- */
const ready = Promise.all([
  tools.then((T) => { renderDirectory(T, catalog); idle(startCatalog); }).catch((e) => { console.error('Tools list failed', e); $('#tl-grid').innerHTML = '<p class="tl-empty">The tools list didn\'t load. Refresh to try again.</p>'; }),
  feed.then(renderNews),
]);
const leadBox = $('#tl-lead');
leadBox.addEventListener('pointerenter', () => { leadPaused = true; });
leadBox.addEventListener('pointerleave', () => { leadPaused = false; });
leadBox.addEventListener('focusin', () => { leadPaused = true; });
leadBox.addEventListener('focusout', () => { leadPaused = false; });
$('#tl-lead-bars').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = $$('#tl-lead-bars button').indexOf(b);
  showLead(k);
});
$('#tl-lead-prev').addEventListener('click', () => showLead(leadI - 1));
$('#tl-lead-next').addEventListener('click', () => showLead(leadI + 1));

export function open() {
  ready.then(() => {
    leadAt = performance.now();
    lastFrame = 0;
    if (!leadTimer) leadTimer = requestAnimationFrame(tickLead);
  });
}

// The Tools page (raunakpatil.com/tools): what's new in AI, and the AI tools worth knowing.
//  - Latest in AI: the newest headlines and the open models trending on Hugging Face, live from Ronie's worker (/feed,
//    rebuilt every half hour — worker/src/feed.js), or the saved snapshot (data/feed.json) should that not answer.
//  - The directory: data/tools.json, picked by hand and refreshed every few weeks; icons in img/tools/
//    (scripts/tool-icons.py fetches any that are missing).
// main.js loads this once the page is headed for (or opened), and calls open() each time it's shown.

const D = window.PORTFOLIO;
const V = new URL(import.meta.url).searchParams.get('v') || '';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOTION = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const view = $('.view[data-view="tools"]');

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
const feed = getFeed().catch(() => ({ news: [], models: [], live: false }));

/* ---------- latest in AI ---------- */
const LEAD_N = 5, LEAD_MS = 8000, WIRE_N = 8;
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
  const status = $('#tl-status');
  const box = $('#tl-news');
  box.removeAttribute('aria-busy');
  if (!f.news.length) {
    box.innerHTML = '<p class="tl-empty">The headlines couldn\'t be fetched just now — try again in a little while.</p>';
    status.innerHTML = '<span>Offline</span>';
    return;
  }
  status.classList.toggle('live', f.live);
  status.innerHTML = f.live
    ? `<i></i><span>Live · updated ${esc(ago(f.updated, true))}</span>`
    : `<i></i><span>Snapshot · ${esc(day(f.updated))}</span>`;

  lead = f.news.slice(0, LEAD_N);
  $('#tl-lead-bars').innerHTML = lead.map((n, k) => `<button type="button" aria-label="Story ${k + 1}: ${esc(n.title)}"><b></b></button>`).join('');
  showLead(0, false);

  const rest = f.news.slice(LEAD_N);
  const topics = ['All', ...new Set(rest.map((n) => n.topic).filter(Boolean))];
  const chips = $('#tl-topics');
  chips.innerHTML = topics.length > 2 ? topics.map((t) => `<button class="chip" type="button" data-topic="${esc(t)}" aria-pressed="${t === 'All'}">${esc(t)}</button>`).join('') : '';
  let topic = 'All', more = false;
  const list = $('#tl-wire-list'), moreBtn = $('#tl-wire-more');
  const draw = () => {
    const items = rest.filter((n) => topic === 'All' || n.topic === topic);
    const shown = more ? items : items.slice(0, WIRE_N);
    list.innerHTML = shown.map((n, i) => `<li><a class="tl-row" href="${esc(n.link)}" target="_blank" rel="noopener" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <span class="tl-ago">${esc(ago(n.date))}</span>
        <span class="tl-h">${esc(n.title)}</span>
        <span class="tl-src">${esc(n.source)}</span>
        <span class="ar" aria-hidden="true">↗</span></a></li>`).join('') || '<li class="tl-none">No stories on that today.</li>';
    moreBtn.hidden = items.length <= WIRE_N;
    moreBtn.textContent = more ? 'Fewer headlines' : `All ${items.length} headlines`;
  };
  chips.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    topic = b.dataset.topic;
    $$('.chip', chips).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    draw();
  };
  moreBtn.onclick = () => { more = !more; draw(); };
  draw();

  const strip = $('#tl-models');
  if (!f.models?.length) { strip.closest('.tl-models').hidden = true; return; }
  strip.innerHTML = f.models.map((m, i) => `<a class="tl-model" href="${esc(m.link)}" target="_blank" rel="noopener" style="animation-delay:${i * 45}ms">
      <span class="tl-model-top"><span>${esc(m.maker)}</span><span class="tl-rank">${String(i + 1).padStart(2, '0')}</span></span>
      <span class="tl-model-name">${esc(m.name)}</span>
      <span class="tl-model-bot"><span class="tl-task">${esc(m.task)}</span><span class="tl-stats"><span title="Likes">♥ ${short(m.likes)}</span><span title="Downloads last month">↓ ${short(m.downloads)}</span></span></span>
    </a>`).join('');
}

/* ---------- the directory ---------- */
function renderDirectory(T) {
  const all = T.tools.map((t, i) => ({ ...t, i, key: `${t.n} ${t.d} ${T.categories[t.c]} ${PRICES[t.p]} ${t.uses || ''}`.toLowerCase() }));
  const S = { q: '', price: 'all', cat: 'all', sort: 'picks', limit: 24 };
  const grid = $('#tl-grid'), more = $('#tl-more'), count = $('#tl-count');
  const priceBox = $('#tl-price'), catBox = $('#tl-cats'), search = $('#tl-search');
  $('#tl-updated').textContent = day(T.updated);

  const matches = (t, skip) => (skip === 'q' || !S.q || S.q.split(/\s+/).every((w) => t.key.includes(w)))
    && (skip === 'price' || S.price === 'all' || (S.price === 'pick' ? t.pick : t.p === S.price))
    && (skip === 'cat' || S.cat === 'all' || t.c === S.cat);
  const chip = (attr, val, label, n, on) => `<button class="chip" type="button" data-${attr}="${esc(val)}" aria-pressed="${on}">${label}<b>${n}</b></button>`;
  const drawChips = () => {
    const forPrice = all.filter((t) => matches(t, 'price'));
    priceBox.innerHTML = [
      chip('price', 'all', 'All', forPrice.length, S.price === 'all'),
      chip('price', 'pick', '<span class="tl-star" aria-hidden="true">★</span> Raunak\'s picks', forPrice.filter((t) => t.pick).length, S.price === 'pick'),
      ...Object.entries(PRICES).map(([k, v]) => chip('price', k, `<span class="tl-dot p-${k}" aria-hidden="true"></span>${v}`, forPrice.filter((t) => t.p === k).length, S.price === k)),
    ].join('');
    const forCat = all.filter((t) => matches(t, 'cat'));
    catBox.innerHTML = [chip('cat', 'all', 'All categories', forCat.length, S.cat === 'all'),
      ...Object.entries(T.categories).map(([k, v]) => chip('cat', k, esc(v), forCat.filter((t) => t.c === k).length, S.cat === k))].join('');
  };
  const card = (t, k) => {
    const isNew = t.added && Date.now() - Date.parse(t.added) < 30 * 864e5;
    return `<a class="tool" href="${esc(t.u)}" target="_blank" rel="noopener" style="animation-delay:${Math.min(k, 16) * 30}ms" title="${esc(host(t.u))}">
      <span class="tool-top">
        <span class="tool-icon" data-l="${esc(t.n[0])}">${t.icon === false ? '' : `<img src="img/tools/${slug(t.n)}.webp" alt="" loading="lazy" width="64" height="64" onerror="this.remove()">`}</span>
        <span class="tool-flags">${t.uses ? `<span class="tool-uses">${esc(t.uses)}</span>` : ''}${isNew ? '<span class="tool-new">New</span>' : ''}${t.pick ? '<span class="tool-pick" title="One of Raunak\'s picks">★</span>' : ''}<span class="tool-go" aria-hidden="true">↗</span></span>
      </span>
      <h3>${esc(t.n)}</h3>
      <p>${esc(t.d)}</p>
      <span class="tool-bot"><span class="tool-cat">${esc(T.categories[t.c])}</span><span class="tool-price"><span class="tl-dot p-${t.p}"></span>${PRICES[t.p]}</span></span>
    </a>`;
  };
  const draw = () => {
    let items = all.filter((t) => matches(t));
    items = S.sort === 'az' ? items.sort((a, b) => a.n.localeCompare(b.n))
      : S.sort === 'new' ? items.sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.i - b.i)
      : items.sort((a, b) => (b.pick ? 1 : 0) - (a.pick ? 1 : 0) || a.i - b.i);
    count.textContent = `${items.length} of ${all.length}`;
    const shown = items.slice(0, S.limit);
    grid.innerHTML = shown.map(card).join('') || `<div class="tl-none-box"><p>Nothing matches${S.q ? ` “${esc(S.q)}”` : ''}.</p><button type="button" class="tl-pill" id="tl-reset">Clear the filters</button></div>`;
    more.hidden = items.length <= S.limit;
    more.textContent = `Show all ${items.length} tools`;
    drawChips();
  };
  const reset = () => { Object.assign(S, { q: '', price: 'all', cat: 'all', limit: 24 }); search.value = ''; draw(); };
  priceBox.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { S.price = b.dataset.price; S.limit = 24; draw(); } });
  catBox.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { S.cat = b.dataset.cat; S.limit = 24; draw(); } });
  let qt = 0;
  search.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { S.q = search.value.trim().toLowerCase(); S.limit = 24; draw(); }, 120); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; S.q = ''; draw(); } });
  // "/" jumps to the search, as on most sites with one
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || view.hidden || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
    e.preventDefault();
    search.focus();
  });
  grid.addEventListener('click', (e) => { if (e.target.closest('#tl-reset')) reset(); });
  more.addEventListener('click', () => { S.limit = Infinity; draw(); });
  $$('#tl-sort button').forEach((b) => b.addEventListener('click', () => {
    S.sort = b.dataset.sort;
    $$('#tl-sort button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  if (!all.some((t) => t.added)) $('#tl-sort [data-sort="new"]')?.remove();   // (nothing added since the first batch yet)
  draw();
}

/* ---------- wiring ---------- */
const ready = Promise.all([
  tools.then(renderDirectory).catch((e) => { console.error('Tools list failed', e); $('#tl-grid').innerHTML = '<p class="tl-empty">The tools list didn\'t load. Refresh to try again.</p>'; }),
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

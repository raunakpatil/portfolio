// Builds Radar's pages for search engines, plain HTML under /ai-tools, from the same data the Radar page shows:
//   /ai-tools/                         the hub: every category, the collections and the Top 50
//   /ai-tools/best-ai-video-tools ...  one page per category, its tools ranked as Radar ranks them
//   /ai-tools/top-50, free-ai-tools, open-source-ai-tools, new-ai-tools
//   /ai-tools/alternatives/<tool>      alternatives to each of the Top 50
//   /ai-tools/tool/<tool>              a page per tool: the hand-picked ones and the best-known of the catalogue
// plus sitemap.xml with all of them. Each tool's plain-words line comes from Ronie's worker (/explained: only the ones
// already written), kept in data/explained.json so a build never depends on it. The Refresh Radar Action runs this
// after each refresh; run it by hand after editing data/tools.json:  node scripts/build-seo-pages.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';

const at = (p) => new URL(`../${p}`, import.meta.url);
const read = (p, d) => { try { return JSON.parse(readFileSync(at(p), 'utf8')); } catch { return d; } };
const T = read('data/tools.json');
const C = read('data/catalog.json', { gh: [], hf: [], ph: [] });
const SITE = 'https://raunakpatil.com';
const WORKER = 'https://ronie-chat.ronie-chat.workers.dev';
const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const MONTH = NOW.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const YEAR = NOW.getUTCFullYear();
const V = (readFileSync(at('index.html'), 'utf8').match(/css\/style\.css\?v=(\d+)/) || [])[1] || '';

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const undash = (s) => String(s ?? '').replace(/\s*\u2014\s*(?=[.,)!?])/g, '').replace(/\s*\u2014\s*/g, ', ');
const slug = (n) => n.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tool';
const fmt = (n) => Number(n).toLocaleString('en-US');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '');

// ---------- the tools, as Radar lists them ----------
const CATS = T.categories;
const curated = T.tools.map((t, i) => ({ ...t, d: undash(t.d), src: 'pick', i }));
const known = new Set(curated.flatMap((t) => [norm(t.n), t.u.replace(/\/$/, '').toLowerCase()]));
const take = (list, make) => list.map(make).filter((t) => {
  const k = norm(t.n), u = t.u.toLowerCase();
  if (known.has(k) || known.has(u)) return false;
  known.add(k); known.add(u);
  return true;
});
const gh = take(C.gh || [], ([n, full, d, stars, c, oid, rel]) => ({ n, u: `https://github.com/${full}`, d: undash(d), c, p: 'open', src: 'gh', pop: stars, oid, by: full.split('/')[0], full, rel }));
const hf = take(C.hf || [], ([n, id, d, likes, c, emoji, from, to, rel]) => ({ n, u: `https://huggingface.co/spaces/${id}`, d: undash(d), c, p: 'free', src: 'hf', pop: likes, emoji, by: id.split('/')[0], full: id, rel }));
const ph = take(C.ph || [], ([n, s, d, votes, c, thumb, p, link, rel]) => ({ n, u: link, d: undash(d), c, p: p || 'na', src: 'ph', pop: votes, thumb, slug: s, rel }));
const catalogue = [...gh, ...hf, ...ph].filter((t) => CATS[t.c] && t.d);
const all = [...curated, ...catalogue];
const keyFor = (t) => (t.src === 'pick' ? `pick:${t.n}` : t.src === 'gh' ? `gh:${t.full}` : t.src === 'hf' ? `hf:${t.full}` : `ph:${t.slug}`);

// which get a page of their own: every hand-picked tool, and the catalogue's best-known (popular enough that people
// search for them by name)
const PAGE_MIN = { gh: 20000, hf: 500, ph: 500 };
const paged = [...curated, ...catalogue.filter((t) => t.pop >= PAGE_MIN[t.src] && t.d.length >= 24)];
const used = new Set();
for (const t of paged) {
  let s = slug(t.n);
  if (used.has(s)) s = `${s}-${t.src === 'gh' ? 'github' : t.src === 'hf' ? 'hugging-face' : 'product-hunt'}`;
  for (let k = 2; used.has(s); k++) s = `${slug(t.n)}-${k}`;
  used.add(s);
  t.page = `/ai-tools/tool/${s}`;
}

// where each stands in its category: Raunak's picks first, then the rest of the hand-picked in Radar's order, then the
// catalogue by popularity; his own projects sit in the middle of the hand-picked ones, well placed but never leading
// (the same as the card backs on Radar)
const top = curated.filter((t) => t.pick);
const ranked = {};
for (const c of Object.keys(CATS)) {
  const mine = curated.filter((t) => t.c === c && t.mine);
  const picks = curated.filter((t) => t.c === c && !t.mine).sort((a, b) => ((b.pick ? 1 : 0) - (a.pick ? 1 : 0)) || a.i - b.i);
  for (const t of mine) picks.splice(Math.ceil(picks.length / 2), 0, t);
  const rest = catalogue.filter((t) => t.c === c);
  // (the catalogue's three places in turns, each by its own popularity)
  const bySrc = ['gh', 'hf', 'ph'].map((s) => rest.filter((t) => t.src === s).sort((a, b) => b.pop - a.pop));
  const mixed = [];
  for (let k = 0; bySrc.some((l) => l[k]); k++) for (const l of bySrc) if (l[k]) mixed.push(l[k]);
  ranked[c] = [...picks, ...mixed];
  ranked[c].forEach((t, k) => { t.rank = k + 1; });
}
const catSize = (c) => ranked[c].length;

// ---------- the plain-words lines ----------
const kept = read('data/explained.json', {});
async function explained() {
  const want = paged.map(keyFor).filter((k) => !kept[k]);
  for (let i = 0; i < want.length; i += 100) {
    try {
      const r = await fetch(`${WORKER}/explained`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: want.slice(i, i + 100) }), signal: AbortSignal.timeout(20000) });
      if (r.ok) Object.assign(kept, (await r.json()).texts || {});
    } catch { /* the ones kept still serve */ }
  }
  const live = new Set(paged.map(keyFor));
  for (const k of Object.keys(kept)) if (!live.has(k)) delete kept[k];
  writeFileSync(at('data/explained.json'), `${JSON.stringify(Object.fromEntries(Object.entries(kept).sort()), null, 1)}\n`);
}

// ---------- words about each category (written by hand; the lists are from the data) ----------
const CAT_PAGE = {
  chat: { s: 'best-ai-chatbots', h: 'AI chatbots and assistants', intro: 'The assistants people use every day to ask questions, write, plan, read files and get things done, from the big general ones to the ones built around a single job.' },
  research: { s: 'best-ai-research-tools', h: 'AI research and search tools', intro: 'Tools that search the web, read papers and documents for you, and answer with sources you can check.' },
  code: { s: 'best-ai-coding-tools', h: 'AI coding tools', intro: 'Editors, coding agents and app builders that write, explain and fix code, for developers and for people who have never written a line.' },
  agents: { s: 'best-ai-agents', h: 'AI agents and automation tools', intro: 'Agents that take a task and carry it out across apps and the web, and the automation platforms that wire tools together without code.' },
  image: { s: 'best-ai-image-generators', h: 'AI image generators and editors', intro: 'Tools that make pictures from a sentence, edit photos, remove backgrounds and upscale, for art, products and everything between.' },
  video: { s: 'best-ai-video-tools', h: 'AI video tools', intro: 'Video generators, avatar and dubbing tools, and editors that cut, caption and clip footage for you.' },
  voice: { s: 'best-ai-voice-tools', h: 'AI voice and audio tools', intro: 'Text to speech, voice cloning, transcription and dictation, and clean-up for recordings and calls.' },
  music: { s: 'best-ai-music-generators', h: 'AI music generators', intro: 'Tools that compose songs, beats and soundtracks from a prompt, separate stems and help musicians work faster.' },
  writing: { s: 'best-ai-writing-tools', h: 'AI writing tools', intro: 'Help with drafting, rewriting, grammar, tone and translation, for emails, essays, posts and books.' },
  work: { s: 'best-ai-productivity-tools', h: 'AI productivity tools', intro: 'Meeting notes, slides, email, calendars, docs and to-do lists, with AI that takes the busywork off your hands.' },
  design: { s: 'best-ai-design-tools', h: 'AI design and 3D tools', intro: 'Design tools for interfaces, graphics, logos and 3D, with AI that drafts layouts, assets and models.' },
  build: { s: 'best-ai-developer-tools', h: 'AI tools for building with AI', intro: 'Models, APIs, frameworks and local runners for people building their own AI apps and agents.' },
};
const PRICE = { free: 'Free', freemium: 'Free plan', paid: 'Paid', open: 'Open source', na: 'Price on site' };
const PRICE_LONG = { free: 'Free to use', freemium: 'Free plan, with paid upgrades', paid: 'Paid plans', open: 'Free and open source', na: 'Pricing on its own site' };
const FROM = (t) => (t.mine ? 'Built by Raunak, listed among the other tools'
  : t.src === 'pick' ? (t.pick ? `Hand-picked: No. ${top.indexOf(curated[t.i]) + 1} in Raunak's Top 50` : 'Hand-picked by Raunak')
  : t.src === 'gh' ? `Open-source project on GitHub, ${fmt(t.pop)} stars` : t.src === 'hf' ? `App on Hugging Face Spaces, ${fmt(t.pop)} likes` : `Launched on Product Hunt, ${fmt(t.pop)} upvotes`);
const catLink = (c) => `/ai-tools/${CAT_PAGE[c].s}`;
// (a category's name inside a sentence: lower case, but AI and 3D stay as they are)
const lowH = (c) => CAT_PAGE[c].h.toLowerCase().replace(/\bai\b/g, 'AI').replace(/\b3d\b/g, '3D');

// ---------- the page around the content ----------
const icon = (t) => {
  if (t.src === 'pick') return t.icon === false ? `<span class="pg-ic" data-l="${esc(t.n[0])}"></span>` : `<span class="pg-ic" data-l="${esc(t.n[0])}"><img src="/img/tools/${slug(t.n)}.webp" alt="" width="40" height="40" loading="lazy" onerror="this.remove()"${t.full ? ' class="av"' : ''}></span>`;
  if (t.src === 'gh') return `<span class="pg-ic" data-l="${esc(t.n[0])}"><img class="av" src="https://avatars.githubusercontent.com/u/${t.oid}?s=80" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></span>`;
  if (t.src === 'hf') return `<span class="pg-ic emo">${esc([...(t.emoji || '🤗')][0])}</span>`;
  return `<span class="pg-ic" data-l="${esc(t.n[0])}">${t.thumb ? `<img class="av" src="${esc(t.thumb)}&w=80&h=80&fit=crop" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
};
const nameLink = (t) => (t.page ? `<a href="${t.page}">${esc(t.n)}</a>` : `<a href="${esc(t.u)}" rel="noopener nofollow" target="_blank">${esc(t.n)}</a>`);
const row = (t, k) => `<li class="pg-row">${k != null ? `<span class="pg-n">${k}</span>` : ''}${icon(t)}<span class="pg-t"><b>${nameLink(t)}</b><span>${esc(t.d)}</span></span><span class="pg-m">${esc(t.src === 'pick' ? PRICE[t.p] : t.src === 'gh' ? `★ ${fmt(t.pop)}` : t.src === 'hf' ? `♥ ${fmt(t.pop)}` : `▲ ${fmt(t.pop)}`)}</span></li>`;
const list = (items, numbered = true, from = 1) => `<ol class="pg-list">${items.map((t, k) => row(t, numbered ? from + k : null)).join('')}</ol>`;

const NAV = `<header class="pg-bar"><a class="pg-brand" href="/">Raunak Patil</a><nav aria-label="Site"><a href="/">Dashboard</a><a href="/#projects">Projects</a><a href="/#library">Library</a><a class="on" href="/radar">Radar</a></nav></header>`;
const FOOT = `<footer class="pg-foot">
  <nav aria-label="AI tools by category"><b>Best AI tools by category</b>${Object.keys(CATS).map((c) => `<a href="${catLink(c)}">${esc(CAT_PAGE[c].h)}</a>`).join('')}</nav>
  <nav aria-label="Collections"><b>Collections</b><a href="/ai-tools/top-50">Top 50 AI tools</a><a href="/ai-tools/new-ai-tools">New AI tools</a><a href="/ai-tools/free-ai-tools">Free AI tools</a><a href="/ai-tools/open-source-ai-tools">Open-source AI tools</a><a href="/ai-tools/">All of Radar's lists</a></nav>
  <p>Radar is kept by <a href="/">Raunak Patil</a> and updated every week from his hand-picked list, GitHub, Hugging Face and Product Hunt. Last updated ${day(TODAY)}.</p>
</footer>`;
const crumbs = (trail) => ({
  html: `<nav class="pg-crumbs" aria-label="Breadcrumb">${trail.map(([n, u], k) => (k < trail.length - 1 ? `<a href="${u}">${esc(n)}</a><i>/</i>` : `<span>${esc(n)}</span>`)).join('')}</nav>`,
  ld: { '@type': 'BreadcrumbList', itemListElement: trail.map(([n, u], k) => ({ '@type': 'ListItem', position: k + 1, name: n, item: SITE + u })) },
});
const pages = [];
function page({ path, title, desc, h1, sub, body, ld = [], trail, prio = 0.6 }) {
  const c = crumbs(trail);
  const graph = { '@context': 'https://schema.org', '@graph': [c.ld, ...ld] };
  const html = `<!doctype html>
<!-- Generated by scripts/build-seo-pages.mjs from Radar's data, edit that script or the data, then run it again. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(clip(desc, 158))}">
  <link rel="canonical" href="${SITE}${path}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Radar · Raunak Patil">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(clip(desc, 200))}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/img/radar-og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico?v=2" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
  <link rel="stylesheet" href="/css/pages.css${V ? `?v=${V}` : ''}">
  <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>
</head>
<body>
${NAV}
<main class="pg">
  ${c.html}
  <h1>${h1}</h1>
  ${sub ? `<p class="pg-sub">${sub}</p>` : ''}
  ${body}
</main>
${FOOT}
</body>
</html>
`;
  pages.push({ path, html, prio });
}
const itemList = (name, items) => ({ '@type': 'ItemList', name, numberOfItems: items.length, itemListElement: items.map((t, k) => ({ '@type': 'ListItem', position: k + 1, name: t.n, url: t.page ? SITE + t.page : t.u })) });
const cta = (href, text) => `<a class="pg-btn" href="${href}">${text}</a>`;
const HUB = ['Radar', '/radar'], AT = ['AI tools', '/ai-tools/'];

// ---------- category pages ----------
for (const c of Object.keys(CATS)) {
  const P = CAT_PAGE[c], list1 = ranked[c].filter((t) => t.src === 'pick');
  const extra = (s) => ranked[c].filter((t) => t.src === s).slice(0, 10);
  const freeOnes = list1.filter((t) => ['free', 'freemium', 'open'].includes(t.p)).slice(0, 3);
  const sections = [
    ['gh', `Popular open-source ${lowH(c)} on GitHub`, 'By stars on GitHub.'],
    ['hf', 'Apps to try in the browser, on Hugging Face Spaces', 'By likes on Hugging Face.'],
    ['ph', 'Launched on Product Hunt', 'By upvotes on Product Hunt.'],
  ].filter(([s]) => extra(s).length);
  page({
    path: catLink(c),
    title: `Best ${P.h} in ${YEAR}, ranked | Radar`,
    desc: `The best ${lowH(c)} in ${MONTH}: ${list1.slice(0, 4).map((t) => t.n).join(', ')} and more, ranked, with prices. ${P.intro}`,
    h1: `Best ${esc(P.h)} <em>in ${esc(MONTH)}</em>`,
    sub: `${esc(P.intro)} Below are the ${list1.length} that Raunak picked, in Radar's order, then the most popular of the other ${fmt(catSize(c) - list1.length)} in this category on Radar.`,
    trail: [HUB, AT, [P.h, catLink(c)]],
    prio: 0.9,
    ld: [itemList(`Best ${P.h}`, list1)],
    body: `${list(list1)}
  ${freeOnes.length ? `<p class="pg-note">Free to start: ${freeOnes.map(nameLink).join(', ')}${freeOnes.length > 1 ? ' all have' : ' has'} a free plan or ${freeOnes.length > 1 ? 'are' : 'is'} free outright.</p>` : ''}
  ${sections.map(([s, h, by]) => `<h2>${esc(h)}</h2><p class="pg-by">${by}</p>${list(extra(s), false)}`).join('\n  ')}
  <div class="pg-ctas">${cta(`/radar?cat=${c}`, `Browse all ${fmt(catSize(c))} on Radar`)}${cta('/radar?ask=1', 'Ask Radar what you need')}</div>`,
  });
}

// ---------- collections ----------
page({
  path: '/ai-tools/top-50',
  title: `Top 50 AI tools right now (${MONTH}) | Radar`,
  desc: `The 50 AI tools worth knowing in ${MONTH}, from ${top.slice(0, 5).map((t) => t.n).join(', ')} to the best for video, voice, music and code. Picked by hand and kept current.`,
  h1: `Top 50 AI tools <em>right now</em>`,
  sub: 'The fifty Raunak recommends, across every kind of work, in his order. Each links to what it does, what it costs and its alternatives.',
  trail: [HUB, AT, ['Top 50', '/ai-tools/top-50']],
  prio: 0.9,
  ld: [itemList('Top 50 AI tools', top)],
  body: `${list(top.map((t) => paged.find((x) => x.src === 'pick' && x.i === t.i)))}<div class="pg-ctas">${cta('/radar?view=top', 'See the Top 50 on Radar')}</div>`,
});
const freeCur = curated.filter((t) => ['free', 'freemium', 'open'].includes(t.p));
page({
  path: '/ai-tools/free-ai-tools',
  title: `Free AI tools: ${freeCur.length} that cost nothing to start (${YEAR}) | Radar`,
  desc: `${freeCur.length} hand-picked AI tools that are free, have a free plan, or are open source, in every category: chat, coding, images, video, voice, music and more.`,
  h1: 'Free AI tools <em>by category</em>',
  sub: `${freeCur.length} of Radar's hand-picked tools you can start with for free: free outright, with a free plan, or open source.`,
  trail: [HUB, AT, ['Free AI tools', '/ai-tools/free-ai-tools']],
  prio: 0.8,
  ld: [itemList('Free AI tools', freeCur)],
  body: Object.keys(CATS).map((c) => { const l = ranked[c].filter((t) => t.src === 'pick' && freeCur.includes(curated[t.i])); return l.length ? `<h2><a href="${catLink(c)}">${esc(CAT_PAGE[c].h)}</a></h2>${list(l, false)}` : ''; }).join('\n  ') + `<div class="pg-ctas">${cta('/radar?price=free', 'Free tools on Radar')}</div>`,
});
const openCur = curated.filter((t) => t.p === 'open');
const openGh = gh.filter((t) => CATS[t.c]).sort((a, b) => b.pop - a.pop).slice(0, 60);
page({
  path: '/ai-tools/open-source-ai-tools',
  title: `Open-source AI tools: the best on GitHub (${MONTH}) | Radar`,
  desc: `Open-source AI you can run, read and change: ${openCur.slice(0, 4).map((t) => t.n).join(', ')}, and the ${openGh.length} most-starred AI projects on GitHub right now.`,
  h1: 'Open-source AI tools',
  sub: `The open-source tools Raunak picked, then the ${openGh.length} most-starred AI projects on GitHub, refreshed every week.`,
  trail: [HUB, AT, ['Open-source AI tools', '/ai-tools/open-source-ai-tools']],
  prio: 0.8,
  ld: [itemList('Open-source AI tools', [...openCur, ...openGh])],
  body: `<h2>Hand-picked</h2>${list(openCur.map((t) => paged.find((x) => x.src === 'pick' && x.i === t.i)), false)}<h2>Most-starred on GitHub</h2>${list(openGh)}<div class="pg-ctas">${cta('/radar?src=gh', 'All open-source projects on Radar')}</div>`,
});
const AI_WORDS = /\b(ai|llms?|gpt[\w.-]*|agents?|agentic|models?|neural|ml|machine learning|deep learning|diffusion|transformers?|rag|embeddings?|chatbots?|vision|speech|tts|asr|stt|generative|prompts?|copilot|openai|anthropic|claude|gemini|llama|mistral|qwen|deepseek|ollama|langchain|inference|nlp|mcp|ocr|text-to-\w+|image-to-\w+|voice|lora|fine-?tun\w*|multimodal|reasoning|semantic)\b/i;
const fresh = catalogue.filter((t) => t.rel && NOW - Date.parse(t.rel) < 90 * 864e5 && t.d.length >= 24 && (t.src === 'gh' ? AI_WORDS.test(`${t.n} ${t.d}`) : t.src === 'hf' ? t.pop >= 50 : true))
  .sort((a, b) => b.rel.localeCompare(a.rel) || b.pop - a.pop).slice(0, 80);
page({
  path: '/ai-tools/new-ai-tools',
  title: `New AI tools: the latest releases (${MONTH}) | Radar`,
  desc: `The newest AI tools, newest first: open-source projects, Hugging Face apps and Product Hunt launches from the last 90 days, refreshed every week. Latest: ${fresh.slice(0, 3).map((t) => t.n).join(', ')}.`,
  h1: `New AI tools <em>this week</em>`,
  sub: `The ${fresh.length} newest on Radar from the last 90 days, newest first, from GitHub, Hugging Face and Product Hunt. Updated ${day(TODAY)}.`,
  trail: [HUB, AT, ['New AI tools', '/ai-tools/new-ai-tools']],
  prio: 0.9,
  ld: [itemList('New AI tools', fresh)],
  body: `<ol class="pg-list">${fresh.map((t) => row(t, null).replace('<span class="pg-m">', `<span class="pg-m"><time datetime="${t.rel}">${esc(new Date(t.rel).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}</time> · `)).join('')}</ol><div class="pg-ctas">${cta('/radar?view=new', 'New releases on Radar')}</div>`,
});

// ---------- alternatives to each of the Top 50 (not to his own projects) ----------
const altOf = new Map();
for (const t0 of top.filter((t) => !t.mine)) {
  const t = paged.find((x) => x.src === 'pick' && x.i === t0.i);
  const alts = ranked[t.c].filter((x) => x !== t && !x.mine).slice(0, 14);
  const path = `/ai-tools/alternatives/${slug(t.n)}`;
  altOf.set(t, path);
  const freeAlts = alts.filter((x) => ['free', 'freemium', 'open'].includes(x.p)).slice(0, 3);
  page({
    path,
    title: `Best ${t.n} alternatives in ${YEAR} (${alts.length} compared) | Radar`,
    desc: `Looking for something other than ${t.n}? ${alts.slice(0, 4).map((x) => x.n).join(', ')} and more ${lowH(t.c)}, compared by what they do and what they cost.`,
    h1: `${esc(t.n)} alternatives`,
    sub: `${esc(t.n)}: ${esc(t.d)} If it isn't quite right, here are ${alts.length} other ${esc(lowH(t.c))} from Radar, in Radar's order.`,
    trail: [HUB, AT, [CAT_PAGE[t.c].h, catLink(t.c)], [`${t.n} alternatives`, path]],
    prio: 0.8,
    ld: [itemList(`${t.n} alternatives`, alts)],
    body: `${list(alts)}
  ${freeAlts.length ? `<p class="pg-note">Free to start: ${freeAlts.map(nameLink).join(', ')}.</p>` : ''}
  <div class="pg-ctas">${cta(t.page, `About ${esc(t.n)}`)}${cta(catLink(t.c), `All ${esc(lowH(t.c))}`)}</div>`,
  });
}

// (for whoever makes it: the "Listed on Radar" badge, linking back to this page, ready to copy)
const badge = (t) => {
  const snip = `<a href="${SITE}${t.page}"><img src="${SITE}/img/badges/listed-on-radar.svg" alt="${esc(t.n)} is listed on Radar" height="40"></a>`;
  return `<details class="pg-own"><summary>Make ${esc(t.n)}? Show it's listed on Radar</summary>
    <p>Add this badge to your site or README. It links to this page.</p>
    <img src="/img/badges/listed-on-radar.svg" alt="Listed on Radar" width="168" height="40">
    <pre><code>${esc(snip)}</code></pre>
    <pre><code>${esc(`[![Listed on Radar](${SITE}/img/badges/listed-on-radar.svg)](${SITE}${t.page})`)}</code></pre>
  </details>`;
};

// ---------- a page per tool ----------
const APP_CAT = { chat: 'CommunicationApplication', research: 'ReferenceApplication', code: 'DeveloperApplication', agents: 'BusinessApplication', image: 'MultimediaApplication', video: 'MultimediaApplication', voice: 'MultimediaApplication', music: 'MultimediaApplication', writing: 'BusinessApplication', work: 'BusinessApplication', design: 'DesignApplication', build: 'DeveloperApplication' };
function toolPages() {
  for (const t of paged) {
    const list0 = ranked[t.c], at0 = t.rank - 1;
    const from = Math.max(0, Math.min(at0 - 3, list0.length - 7));
    const like = list0.slice(from, from + 7).filter((x) => x !== t).slice(0, 6);
    const plain = kept[keyFor(t)] ? undash(kept[keyFor(t)]) : '';
    const facts = [
      ['What it costs', esc(PRICE_LONG[t.p] || PRICE_LONG.na)],
      ['Category', `<a href="${catLink(t.c)}">${esc(CATS[t.c])}</a>`],
      ['On Radar', esc(FROM(t))],
      ['Ranks', `No. ${fmt(t.rank)} of ${fmt(catSize(t.c))} in ${esc(CATS[t.c])}`],
      t.rel ? ['Released', esc(day(t.rel))] : null,
      ['Website', `<a href="${esc(t.u)}" rel="noopener${t.src === 'pick' ? '' : ' nofollow'}" target="_blank">${esc(host(t.u))}${t.full ? ` · ${esc(t.full)}` : ''} ↗</a>`],
    ].filter(Boolean);
    const alt = altOf.get(t);
    const ld = { '@type': 'SoftwareApplication', name: t.n, description: plain || t.d, applicationCategory: APP_CAT[t.c] || 'Application', url: t.u, ...(['free', 'open'].includes(t.p) ? { offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' } } : {}) };
    page({
      path: t.page,
      title: `${t.n}: what it is, price and alternatives | Radar`,
      desc: `${plain || t.d} ${PRICE_LONG[t.p] || ''}. Similar: ${like.slice(0, 3).map((x) => x.n).join(', ')}.`,
      h1: `${icon(t)}${esc(t.n)}`,
      sub: esc(t.d),
      trail: [HUB, AT, [CAT_PAGE[t.c].h, catLink(t.c)], [t.n, t.page]],
      prio: t.src === 'pick' ? 0.7 : 0.5,
      ld: [ld],
      body: `${plain ? `<p class="pg-plain"><b>In plain words</b>${esc(plain)}</p>` : ''}
  <dl class="pg-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  <div class="pg-ctas"><a class="pg-btn key" href="${esc(t.u)}" rel="noopener${t.src === 'pick' ? '' : ' nofollow'}" target="_blank">Open ${esc(host(t.u))} ↗</a>${cta(`/radar?q=${encodeURIComponent(t.n.toLowerCase())}`, 'See it on Radar')}${alt ? cta(alt, `${esc(t.n)} alternatives`) : ''}</div>
  <h2>Similar ${esc(lowH(t.c))}</h2>
  ${list(like, false)}
  ${badge(t)}`,
    });
  }
}

// ---------- the hub ----------
function hub() {
  page({
    path: '/ai-tools/',
    title: `Best AI Tools on the Radar: ${fmt(all.length)} AI tools, ranked and updated weekly`,
    desc: `The best AI tools by category, the Top 50, new releases, free and open-source tools: ${fmt(all.length)} AI tools hand-picked or gathered from GitHub, Hugging Face and Product Hunt, updated every week.`,
    h1: 'Best AI tools <em>on the Radar</em>',
    sub: `${fmt(all.length)} AI tools: ${curated.length} hand-picked by Raunak, and the best of GitHub, Hugging Face and Product Hunt, updated every week. Pick a list, or <a href="/radar">search them all on Radar</a>.`,
    trail: [HUB, AT],
    prio: 1,
    ld: [{ '@type': 'CollectionPage', name: 'Best AI Tools on the Radar', url: `${SITE}/ai-tools/` }],
    body: `<h2>By category</h2>
  <ul class="pg-cats">${Object.keys(CATS).map((c) => `<li><a href="${catLink(c)}"><b>${esc(CAT_PAGE[c].h)}</b><span>${ranked[c].filter((t) => t.src === 'pick').slice(0, 3).map((t) => esc(t.n)).join(', ')} and ${fmt(catSize(c) - 3)} more</span></a></li>`).join('')}</ul>
  <h2>Collections</h2>
  <ul class="pg-cats">
    <li><a href="/ai-tools/top-50"><b>Top 50 AI tools</b><span>The fifty worth knowing right now</span></a></li>
    <li><a href="/ai-tools/new-ai-tools"><b>New AI tools</b><span>The latest releases, newest first</span></a></li>
    <li><a href="/ai-tools/free-ai-tools"><b>Free AI tools</b><span>${freeCur.length} that cost nothing to start</span></a></li>
    <li><a href="/ai-tools/open-source-ai-tools"><b>Open-source AI tools</b><span>The most-starred on GitHub</span></a></li>
  </ul>
  <h2>Alternatives</h2>
  <ul class="pg-tags">${[...altOf].map(([t, p]) => `<li><a href="${p}">${esc(t.n)} alternatives</a></li>`).join('')}</ul>`,
  });
}

// ---------- write it all ----------
await explained();
toolPages();
hub();
if (existsSync(at('ai-tools'))) rmSync(at('ai-tools'), { recursive: true });
for (const p of pages) {
  const file = p.path.endsWith('/') ? `${p.path}index.html` : `${p.path}.html`;
  const url = at(file.slice(1));
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, p.html);
}
// the same lists as open data (/ai-tools/radar.json): what the best-ai-tools-on-the-radar repo builds its README from
// each week, and free for anyone to use with a link back
const pub = (t) => ({ name: t.n, url: t.u, about: t.d, plain: kept[keyFor(t)] ? undash(kept[keyFor(t)]) : undefined, category: t.c, price: t.p, from: t.src === 'pick' ? 'hand-picked' : { gh: 'github', hf: 'hugging-face', ph: 'product-hunt' }[t.src], stars: t.src === 'gh' ? t.pop : undefined, likes: t.src === 'hf' ? t.pop : undefined, upvotes: t.src === 'ph' ? t.pop : undefined, released: t.rel || undefined, rank: t.rank, mine: t.mine || undefined, page: t.page ? SITE + t.page : undefined });
writeFileSync(at('ai-tools/radar.json'), `${JSON.stringify({
  about: 'Radar (raunakpatil.com/radar): the best AI tools on the radar, updated every week. Free to use with a link to https://raunakpatil.com/radar',
  updated: TODAY, total: all.length,
  categories: Object.fromEntries(Object.keys(CATS).map((c) => [c, { name: CATS[c], title: `Best ${CAT_PAGE[c].h}`, page: SITE + catLink(c), size: catSize(c), tools: ranked[c].slice(0, 40).map(pub) }])),
  top50: top.map(pub),
  new: fresh.slice(0, 40).map(pub),
  openSource: openGh.slice(0, 30).map(pub),
  free: freeCur.map(pub),
  pages: { hub: `${SITE}/ai-tools/`, top50: `${SITE}/ai-tools/top-50`, new: `${SITE}/ai-tools/new-ai-tools`, free: `${SITE}/ai-tools/free-ai-tools`, openSource: `${SITE}/ai-tools/open-source-ai-tools`, alternatives: Object.fromEntries([...altOf].map(([t, p]) => [t.n, SITE + p])) },
})}\n`);
// the sitemap: the site's own pages, then all of these
const own = [['/', 1.0, 'weekly'], ['/radar', 0.9, 'daily'], ['/ronie', 0.6, 'monthly']];
writeFileSync(at('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${own.map(([u, p, f]) => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod><changefreq>${f}</changefreq><priority>${p.toFixed(1)}</priority></url>`).join('\n')}
${pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${TODAY}</lastmod><priority>${p.prio.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`);
const n = (re) => pages.filter((p) => re.test(p.path)).length;
console.log(`ai-tools: ${pages.length} pages (${n(/\/tool\//)} tools, ${n(/\/alternatives\//)} alternatives, ${Object.keys(CATS).length} categories, 4 collections, the hub); ${Object.keys(kept).length} plain-words lines; sitemap.xml: ${pages.length + own.length} addresses`);

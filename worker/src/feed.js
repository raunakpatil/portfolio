// Radar's live corner (raunakpatil.com/radar): the latest AI headlines from a handful of newsrooms and labs'
// own blogs, and the open models trending on Hugging Face this week. Only each story's headline, source, date and
// link are kept — the reading happens on the publisher's site. Built on request, kept at the edge for half an hour.
// (scripts/build-feed.mjs runs the same code to save a snapshot, data/feed.json, which the page falls back on.)

export const FEEDS = [
  { source: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { source: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { source: 'Ars Technica', url: 'https://arstechnica.com/ai/feed/' },
  { source: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { source: 'The Decoder', url: 'https://the-decoder.com/feed/' },
  { source: 'OpenAI', url: 'https://openai.com/news/rss.xml', lab: true },
  { source: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', lab: true },
  { source: 'Google', url: 'https://blog.google/technology/ai/rss/', lab: true },
  { source: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', lab: true },
];

// trending models are only shown from these makers — the trending list itself is open to anyone's uploads
const MAKERS = {
  'google': 'Google', 'meta-llama': 'Meta', 'facebook': 'Meta', 'Qwen': 'Qwen', 'mistralai': 'Mistral AI',
  'deepseek-ai': 'DeepSeek', 'openai': 'OpenAI', 'microsoft': 'Microsoft', 'nvidia': 'NVIDIA', 'apple': 'Apple',
  'black-forest-labs': 'Black Forest Labs', 'stabilityai': 'Stability AI', 'ibm-granite': 'IBM', 'allenai': 'Ai2',
  'HuggingFaceTB': 'Hugging Face', 'moonshotai': 'Moonshot AI', 'zai-org': 'Z.ai', 'THUDM': 'Z.ai',
  'MiniMaxAI': 'MiniMax', 'tencent': 'Tencent', 'baidu': 'Baidu', 'ByteDance-Seed': 'ByteDance', 'ByteDance': 'ByteDance',
  'xai-org': 'xAI', 'LiquidAI': 'Liquid AI', 'CohereLabs': 'Cohere', 'CohereForAI': 'Cohere', 'ai21labs': 'AI21',
  'Lightricks': 'Lightricks', 'Wan-AI': 'Wan', 'hexgrad': 'Kokoro', 'sesame': 'Sesame', 'ResembleAI': 'Resemble AI',
  'openbmb': 'OpenBMB', 'internlm': 'InternLM', 'OpenGVLab': 'OpenGVLab', 'stepfun-ai': 'StepFun', 'unsloth': 'Unsloth',
  'Kwai-Kolors': 'Kuaishou', 'inclusionAI': 'Ant Group', 'XiaomiMiMo': 'Xiaomi', 'swiss-ai': 'Swiss AI',
};
const TASKS = {
  'text-generation': 'Language', 'image-text-to-text': 'Vision + language', 'text-to-image': 'Image',
  'image-to-image': 'Image editing', 'text-to-video': 'Video', 'image-to-video': 'Video', 'text-to-speech': 'Speech',
  'automatic-speech-recognition': 'Speech to text', 'feature-extraction': 'Embeddings', 'sentence-similarity': 'Embeddings',
  'any-to-any': 'Multimodal', 'text-to-audio': 'Audio', 'audio-text-to-text': 'Audio + language', 'text-ranking': 'Reranking',
  'image-to-3d': '3D', 'text-to-3d': '3D', 'robotics': 'Robotics', 'object-detection': 'Vision', 'image-segmentation': 'Vision',
};

// a rough topic for each headline, for the little label beside it
const TOPICS = [
  ['Policy', /\b(law|laws|lawsuit|sue[sd]?|court|judge|regulat\w*|senate|congress|eu|ftc|ban(s|ned)?|copyright|policy|government|white house|pentagon|military|election)\b/i],
  ['Business', /\b(raises?|raised|funding|valuation|acquir\w*|acquisition|ipo|investors?|revenue|deal|layoffs?|billion|startup|ceo|stock|shares)\b/i],
  ['Hardware', /\b(chips?|gpus?|tpus?|nvidia|semiconductor|data ?cent(er|re)s?|laptops?|hardware|phones?|glasses|devices?|robots?|robotics)\b/i],
  ['Research', /\b(research\w*|paper|study|scientists?|discover\w*|benchmark|dataset|pretraining|training data|biology|protein|math)\b/i],
  ['Agents', /\b(agents?|agentic|automation|computer use|browser)\b/i],
  ['Models', /\b(models?|llms?|gpt[-\w.]*|chatgpt|gemini|claude|llama|qwen|mistral|deepseek|grok|copilot|open[- ]weights?)\b/i],
  ['Safety', /\b(safety|security|hack\w*|breach\w*|jailbreak\w*|misuse|deepfakes?|scams?|privacy)\b/i],
];
const topicOf = (t) => (TOPICS.find(([, re]) => re.test(t)) || [null])[0];
// it's a portfolio: stories about crime, abuse or adult content, and party politics, are left out
const SKIP = /\b(csam|child|children|porn\w*|horny|sex\w*|nude\w*|nsfw|onlyfans|explicit|rape|abus\w*|murder\w*|suicid\w*|kill(s|ed|ing)?|shooting|trump|biden|vance|harris|democrats?|republicans?|gop|maga)\b|pervert/i;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
const clean = (s) => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();
const tag = (block, name) => (block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')) || [])[1];

// the start of a feed is enough (the newest stories come first); some feeds run to most of a megabyte
async function head(url, limit = 140000) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'raunakpatil.com news shelf (+https://raunakpatil.com/radar)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    cf: { cacheTtl: 900, cacheEverything: true },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok || !r.body) throw new Error(`${r.status}`);
  const reader = r.body.getReader(), dec = new TextDecoder();
  let text = '';
  while (text.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return text;
}

// a story's picture: the feed's own (media:content / media:thumbnail / an image enclosure / the first <img> in its
// text), and failing that, the article's preview image (og:image) — fetched for those that need it
const unesc = (u) => u.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&');
const okImg = (u) => /^https:\/\//.test(u || '') && !/\.(svg|gif)(\?|$)|gravatar|pixel|spacer|1x1|feedburner|logo/i.test(u);
function imageIn(b) {
  const tries = [
    ...[...b.matchAll(/<media:content\b[^>]*>/gi)].map((m) => m[0]).filter((t) => !/medium="(video|audio)"|type="(video|audio)/i.test(t)).map((t) => (t.match(/url="([^"]+)"/i) || [])[1]),
    (b.match(/<media:thumbnail\b[^>]*url="([^"]+)"/i) || [])[1],
    (b.match(/<enclosure\b(?=[^>]*type="image)[^>]*url="([^"]+)"/i) || [])[1],
    (clean(b.replace(/<!\[CDATA\[|\]\]>/g, '')) && (b.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1]),
  ];
  for (const u of tries) if (u && okImg(unesc(u))) return unesc(u);
  return '';
}
async function ogImage(link) {
  try {
    const html = await head(link, 90000);
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    const u = m && unesc(m[1]);
    return okImg(u) ? u : '';
  } catch { return ''; }
}

function parse(xml, feed) {
  const out = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/g)) {
    const b = m[0];
    const title = clean(tag(b, 'title'));
    let link = clean(tag(b, 'link'));
    if (!/^https?:/.test(link)) link = (b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    const when = Date.parse(clean(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    if (!title || !/^https:\/\//.test(link) || !when || SKIP.test(title)) continue;
    out.push({ title, link: link.replace(/&amp;/g, '&'), source: feed.source, lab: !!feed.lab, date: new Date(when).toISOString(), topic: topicOf(title), image: imageIn(b) });
    if (out.length >= 12) break;
  }
  return out;
}

async function news(now) {
  const lists = await Promise.all(FEEDS.map((f) => head(f.url).then((x) => parse(x, f)).catch(() => [])));
  const seen = new Set();
  const all = lists.flat()
    .filter((n) => now - Date.parse(n.date) < 10 * 864e5 && Date.parse(n.date) < now + 864e5)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((n) => { const k = n.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 60); return !seen.has(k) && seen.add(k); });
  // newest first, with no one source more than five times
  const per = {};
  const list = all.filter((n) => (per[n.source] = (per[n.source] || 0) + 1) <= 5).slice(0, 30);
  await Promise.all(list.filter((n) => !n.image).map(async (n) => { n.image = await ogImage(n.link); }));
  return list;
}

async function models() {
  const r = await fetch('https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=80', {
    cf: { cacheTtl: 1800, cacheEverything: true }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return [];
  const list = await r.json();
  return list
    .filter((m) => MAKERS[m.id.split('/')[0]])
    .slice(0, 10)
    .map((m) => ({
      id: m.id, name: m.id.split('/')[1], maker: MAKERS[m.id.split('/')[0]], task: TASKS[m.pipeline_tag] || 'Model',
      likes: m.likes || 0, downloads: m.downloads || 0, link: `https://huggingface.co/${m.id}`,
    }));
}

export async function buildFeed(now = Date.now()) {
  const [n, m] = await Promise.all([news(now), models().catch(() => [])]);
  return { updated: new Date(now).toISOString(), news: n, models: m };
}

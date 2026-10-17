# Raunak Patil — Portfolio

A dashboard-style portfolio (bento cards, ASCII greeting, hours gauge, skill matrix,
3D project tunnel, dotted experience map) plus Projects and Library pages (case studies and certificates).
Plain HTML/CSS/JS with no build step.

## Edit your content
Everything lives in **`js/data.js`**: name, links, skills, experience (map pins),
projects and case studies. Values marked *estimate* (hours, skill scores) are guesses.

- **Real screenshots:** add `image: 'img/resrescue.png'` to a project to replace the generated mock-up.
- **ASCII portrait:** set `hello.asciiImage` to a portrait on a plain background (e.g. `img/me.png`).
- **Map region:** `mapBounds` controls which part of the world is shown; delete it for the full map.

## Run locally
Serve the folder over http, because a local portrait image won't render as ASCII from `file://`:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Deploy
Hosted free on GitHub Pages from the `portfolio` repo, at https://raunakpatil.com
(the `CNAME` file holds the domain). Every push to `main` goes live within a minute or two.

Browsers cache files for 10 minutes, so `index.html` loads the CSS/JS as `?v=<version>`. Before every push run
`node scripts/deploy-prep.mjs`: it sets a new version and rebuilds `radar.html` (the page `/radar` serves — a copy of
`index.html` with Radar's own title and a list for search engines), so the two always match.

DNS for raunakpatil.com (at GoDaddy):
- `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- `CNAME` record `www` → `raunakpatil.github.io`

## Library: the certificate shelf
Certificates (`certifications` in `js/data.js`) are books on their own shelf, in the same style as the case studies:
`spine`, `ink`, `coverInk` and `colors` set a book's colours, `short` is the title on its cover and spine, and the cover
window shows `photo` (a picture in `img/certs/`) or, failing that, `logo` (an issuer's emblem): `img/logos/helsinki.svg`
(University of Helsinki, public domain, Wikimedia Commons) and `img/logos/drdo.webp` / `img/logos/nielit.webp` (DRDO's
and NIELIT's emblems, used to identify who issued a certificate). Opening a book shows `brief`, the skills, the
credential `id` and a link to `url`.

## Radar (raunakpatil.com/radar)
AI news, trending open models and a directory of AI tools. `radar.html` sends visitors to `/#radar` and the site keeps
`/radar` in the address bar (like `/ronie`); the page's first address, `/tools`, still works. The page itself is
`js/radar.js`, loaded once someone heads that way.
- **Latest in AI** (headlines with their pictures, and trending open models) comes live from Ronie's worker,
  `GET /feed` (`worker/src/feed.js`): a cron trigger rebuilds it every 30 minutes into the `FEED` KV namespace. Only
  headlines, sources, dates, links and each story's preview picture are kept; stories on crime, adult content or party
  politics are left out, and trending models are only shown from the makers listed in `MAKERS`. If the worker doesn't
  answer, the page shows the snapshot in `data/feed.json` (`node scripts/build-feed.mjs`).
- **AI Tools, hand-picked** is `data/tools.json`: `n` name, `u` link, `d` one line about it, `c` category (a key of
  `categories`), `p` price (`free`, `freemium`, `paid` or `open`), `pick` for Raunak's picks, `uses` for a badge
  ("Ronie's voice"), `added` (YYYY-MM-DD) on new ones — they show as New for a month and turn on the New sort. Update
  `updated` too. Icons: `python -I scripts/tool-icons.py` fetches any missing ones into `img/tools/` (`icon` names
  another domain to take the icon from; `"icon": false` shows the tool's first letter instead).
- **AI Tools, the catalogue** is `data/catalog.json`, thousands more: the most-starred open-source AI projects on GitHub
  (1,000+ stars), the most-liked running apps on Hugging Face Spaces, and the most upvoted AI launches on Product Hunt
  (150+ votes, with its price label — this part needs a Product Hunt developer token saved as the `PRODUCTHUNT_TOKEN`
  repository secret), in their makers' own words, with a category guessed from them (`scripts/build-catalog.mjs`).
  Each is listed once: nothing already hand-picked, no two with the same name or description (the most popular
  stays), no copied Spaces, and no lists, courses or templates. Each entry ends with two dates: the day it joined
  Radar, and the day it was released (the project or Space created, the product launched), which drives **New
  releases** (the last 90 days). The **Refresh Radar** GitHub Action rebuilds it on Mondays and Thursdays and commits
  it — so pull before pushing.
- The page's three views: **Browse all** (search, then Source, Price, Category and Sort; the default), **Top 20** (the
  `pick`s, in the order they're listed), **New releases**. A tap turns a card over to its details: what it does in
  plain words (written once per tool by Ronie's worker, `POST /explain`, which looks the tool up in the site's own data
  and keeps the answer in KV), how to get it, when it was added, where it ranks and what's like it; only its ↗ opens
  the page. The trending models each take a colour along the skill matrix's spectrum.

- **Rising** (a sort, and a chip on the fastest climbers): each entry's stars, likes or upvotes gained a day, measured
  from its counts on earlier runs (kept in `data/catalog-state.json`, which visitors never download); until there's
  history, only things released in the last 120 days count, by their average since release.
- **Saved**: the ♥ on a card keeps it in this browser (`localStorage`), shown under Source → Saved.
- **Links to a view**: search, filters and view live in the address (`/radar?view=new&cat=video&price=free`), and the
  back button steps back through them.
- **Ask Radar**: the sparkle at the end of the search box. Focusing the empty box shows examples to try; once what's
  typed reads as a question (three words or more) the sparkle opens into "Ask Radar ↵". The page picks the likeliest
  few dozen tools by their words and Ronie's worker (`POST /ask`) chooses the best few, saying how each helps; the
  other likely ones fill the grid below. A question is part of the link (`/radar?q=…&ask=1`) and is asked again when
  it's opened. Card backs are also written ahead of time by the worker's cron, a few each half hour.
- **No em dashes**: the site's own text uses commas, colons and en dashes; outside text (headlines, makers'
  descriptions, the model's lines) has them turned into commas as it's gathered and as it's shown.
- **Broken links**: the Refresh Radar Action checks every hand-picked link (`scripts/check-links.mjs`) and keeps a
  GitHub issue open listing any that look broken; it closes itself once they answer again.
- `robots.txt` and `sitemap.xml` point search engines at `/`, `/radar` and `/ronie`.

## Ronie's surroundings
By default Ronie stands in front of a picture (neon mountains under a colossal moon, 3:1) behind his transparent
3D canvas. It's a pair: `img/ronie-bg.webp` has the mountains' neon subdued, and `img/ronie-bg-lit.webp` has it
glowing. The lit one lies over the other and fades in and out. The subdued one was warped (optical flow) to line up
with the lit one exactly, so swapping in new versions means re-aligning them. `placeBackdrop` in `js/assistant.js` fits it to the window: on landscape
screens it fills the frame with the moon just right of him and the waterline 87% down; on portrait screens the
moon sits behind his head like a halo. A canvas over it brings it to life (`drawBackdropFx`):
- the water ripples;
- the neon glows up and down in a slow, smooth breath, as the lit picture fades in and out, its reflections included;
- mist drifts along the mountains;
- embers float up off the glowing veins (wherever the lit picture is brighter than the subdued one);
- the moon's rim glows;
- the stars (soft glowing points, the brightest with diffraction spikes, plus a faint field between them) twinkle
  unevenly;
- a shooting star, sometimes two, crosses now and then;
- the picture drifts slightly against the mouse.

In the 3D scene, soft lavender motes of light drift around him.

Other rooms are kept: `/ronie?room=space` builds the same idea in 3D, and `/ronie?room=tubes` is the earlier
neon-tube room.

## Ronie's extra moves (Blender)
`models/ronie-anims.glb` holds Ronie's idle variations, the chat moves, and the guessing game's photo moves
(`pickup`, `toss_happy`, `toss_angry`, `toss`) and the project card's `pickup_show` (held out to the viewer, gripped by its bottom-left corner), authored in Blender 5.2 by
`scripts/blender/ronie_anims.py` on the original model (unzip `3dmodel/sci-fi_o.b._robot_unit_th-icc02_animated.zip`):

```
blender -b --factory-startup --python scripts/blender/ronie_anims.py -- path/to/scene.gltf models/ronie-anims.glb
python -I scripts/squeeze-anims.py models/ronie-anims.glb models/ronie-anims.glb 1e-4
```

The second step shrinks the export (a quarter less to download) without changing a pose: it drops the keyframes
the motion between their neighbours already reproduces (checked: no joint ends up more than 0.06° off, at any
frame) and the channels on non-bone nodes.

The dotted maps' coastline, `js/world-land.json`, is baked from world-atlas's land-50m by `scripts/bake-world-land.py`
(how to run it is at the top of that file).

Poses are written as world-space rotations on top of his idle pose, so edit the angle tables in that script.
It also saves a `.blend` next to the output; `scripts/blender/ronie_preview.py` (body) and `ronie_hands_preview.py` (hands)
render poses from it to check them. Fingers: each hand has a finger block (Index1-3) and a thumb; poses for them
(`FL`/`FR`) are in the script but switched off with `FINGERS = False`.

Crouching: a pose's `CR` entry (`{'d': drop, 'b': hips back}`, metres) lowers his hips and re-solves both legs so
the feet stay planted. In the guessing game he crouches (`pickup`) and comes up holding a polaroid of his guess by
his face; the page holds that last frame until a throw takes over. The polaroid is a small card in the 3D scene
(`updateCard` in `js/assistant.js`): picture from Wikipedia's free images, name written underneath. It rides on his
right hand and flies off with spin and gravity at each throw's release time (`TOSS` in the same file — keep those
in step with the clips' timings).

## Ronie's chat (Cloudflare Workers AI)
"Ask me anything" sends visitors' questions to a tiny Cloudflare Worker (`worker/`) running a small model on
Workers AI's free daily allowance. Ronie only knows `worker/src/facts.js`, generated from `js/data.js`, and the
site falls back to the scripted menu if the worker can't answer. The worker URL is `assistant.chatUrl` in data.js.

After changing your details in data.js (wrangler needs Node 22; this runs it without changing your system Node):

```
node scripts/ronie-facts.mjs
cd worker
npx -y -p node@22 -p wrangler@4 -- wrangler deploy
```

Persona, rules and the model live in `worker/src/index.js`. Usage is visible in the Cloudflare dashboard → AI.

### Ronie's voice
With sound on (the default), Ronie speaks every line, using no server and no AI quota:
- **Kokoro** (`am_puck`) runs in the visitor's browser on computers with WebGPU: natural and expressive. The model
  (325 MB) is too big for the browser's caches, so `sw.js` (a service worker that touches only these files) keeps it in
  IndexedDB: on a computer it's fetched quietly after the first landing — stored only, nothing on the graphics chip —
  and every later visit loads the voice from disk in a few seconds when his room opens.
- Phones, and the moments before Kokoro has loaded, use the **device's own speech voice** (the most natural male
  English voice it has).
A server voice (Deepgram Aura) was tried and removed: ~150 neurons per line used up the free allowance the chat needs.

### Model fallback chain (Gemini API free tier)
If Workers AI fails (e.g. its 10,000-neuron daily allowance is used up), the worker walks down a list of Google
models (`GOOGLE` in `worker/src/index.js`: Gemini 2.5 Flash-Lite, Flash-Lite latest, 3.1 / 3.5 Flash-Lite,
2.5 Flash), each with its own free rate limit. Gemma 4 was tried and dropped: it always thinks first (60 s+).

The model is settled while the room loads: the page calls `POST /pick`, the worker pings down the list and names
the first that answers, and every message then goes straight to it (`model` in the request; the reply says which
model answered, and the page sticks with that). The worker remembers a used-up Workers AI until 00:00 UTC and a
rate-limited Google model for 5 minutes, so neither costs a wasted round trip.

The key is a worker secret. In PowerShell, from `worker/` (a hidden prompt, so the key never shows or lands in history):

```
$k = Read-Host 'Gemini key' -AsSecureString; [Net.NetworkCredential]::new('', $k).Password | npx.cmd -y -p node@22 -p wrangler@4 -- wrangler secret put GEMINI_API_KEY
```

### Address
Ronie lives at **raunakpatil.com/ronie** (`ronie.html` hands visitors to the site, which keeps `/ronie` in the
address bar); every other page is `/#page`.

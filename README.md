# Raunak Patil — Portfolio

A dashboard-style portfolio (bento cards, ASCII greeting, hours gauge, skill matrix,
3D project tunnel, dotted experience map) plus Projects and Case Study pages.
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

Browsers cache files for 10 minutes, so `index.html` loads the CSS/JS as `?v=<version>`.
Change that version (one value, used on all three lines) whenever you publish, so visitors get the new files immediately.

DNS for raunakpatil.com (at GoDaddy):
- `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- `CNAME` record `www` → `raunakpatil.github.io`

## Ronie's extra moves (Blender)
`models/ronie-anims.glb` holds Ronie's idle variations plus `excited` and `confused`, authored in Blender 5.2 by
`tools/blender/ronie_anims.py` on the original model (unzip `3dmodel/sci-fi_o.b._robot_unit_th-icc02_animated.zip`):

```
blender -b --factory-startup --python tools/blender/ronie_anims.py -- path/to/scene.gltf models/ronie-anims.glb
```

Poses are written as world-space rotations on top of his idle pose, so edit the angle tables in that script.
It also saves a `.blend` next to the output; `tools/blender/ronie_preview.py` (body) and `ronie_hands_preview.py` (hands)
render poses from it to check them. Fingers: each hand has a finger block (Index1-3) and a thumb; poses for them
(`FL`/`FR`) are in the script but switched off with `FINGERS = False`.

## Ronie's chat (Cloudflare Workers AI)
"Ask me anything" sends visitors' questions to a tiny Cloudflare Worker (`worker/`) running a small model on
Workers AI's free daily allowance. Ronie only knows `worker/src/facts.js`, generated from `js/data.js`, and the
site falls back to the scripted menu if the worker can't answer. The worker URL is `assistant.chatUrl` in data.js.

After changing your details in data.js (wrangler needs Node 22; this runs it without changing your system Node):

```
node tools/ronie-facts.mjs
cd worker
npx -y -p node@22 -p wrangler@4 -- wrangler deploy
```

Persona, rules and the model live in `worker/src/index.js`. Usage is visible in the Cloudflare dashboard → AI.

### Ronie's voice
With sound on (the default), Ronie speaks every line. Two male voices, both free:
- **Kokoro** (`am_puck`) runs in the visitor's browser on computers with WebGPU: natural and expressive, no
  server and no quota. The model (~300 MB) is fetched once in the background when he wakes, then cached.
- **Deepgram Aura-1** (`arcas`) via the worker's `/speak` endpoint, for phones and the moments before Kokoro
  has loaded. It uses the Workers AI free allowance (about 160 neurons per spoken reply).
Change the Kokoro voice with `assistant.voice: { voice: 'am_michael' }` in data.js; the Aura speaker is in
`worker/src/index.js`.

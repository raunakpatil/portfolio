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

Browsers cache files for 10 minutes, so `index.html` loads the CSS/JS as `?v=<version>`.
Change that version (one value, used on all three lines) whenever you publish, so visitors get the new files immediately.

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
(`pickup`, `toss_happy`, `toss_angry`, `toss`) and the project card's `pickup_show` (held out to the viewer by its bottom-left corner), authored in Blender 5.2 by
`tools/blender/ronie_anims.py` on the original model (unzip `3dmodel/sci-fi_o.b._robot_unit_th-icc02_animated.zip`):

```
blender -b --factory-startup --python tools/blender/ronie_anims.py -- path/to/scene.gltf models/ronie-anims.glb
```

Poses are written as world-space rotations on top of his idle pose, so edit the angle tables in that script.
It also saves a `.blend` next to the output; `tools/blender/ronie_preview.py` (body) and `ronie_hands_preview.py` (hands)
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
node tools/ronie-facts.mjs
cd worker
npx -y -p node@22 -p wrangler@4 -- wrangler deploy
```

Persona, rules and the model live in `worker/src/index.js`. Usage is visible in the Cloudflare dashboard → AI.

### Ronie's voice
With sound on (the default), Ronie speaks every line, using no server and no AI quota:
- **Kokoro** (`am_puck`) runs in the visitor's browser on computers with WebGPU: natural and expressive. The model
  (~300 MB) is fetched once in the background when he wakes, then cached.
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

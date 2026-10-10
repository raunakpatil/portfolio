# Ronie's spec-sheet renders

The pictures on Ronie's loading screen (`img/ronie-spec/`) are renders of his real model, made in Blender.

1. Decompress the site's model (it's meshopt-compressed, which Blender can't read):
   `npm i @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer@0.21`, then
   `node decode.mjs ../../models/rai-robot.glb ronie-plain.glb`
2. Render (Blender 4.2+), once per job — `ortho`, `details`, `armor`, `joints`:
   `RONIE_POSE=anim blender -b -P render.py -- ronie-plain.glb out <job>`
   `joints` also writes `joints.json`: where his joints land in the picture, for the labels in index.html.
3. Convert the PNGs to WebP (ortho 480 px wide, details 600, armor 320, joints 450) into `img/ronie-spec/`,
   and bump the `?v=` on their URLs in index.html.

The renders and `ronie-plain.glb` stay out of the repo.

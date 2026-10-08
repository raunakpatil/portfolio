# Render a few named poses large from a 3/4 front view and a side view
import bpy, sys, os, math
args = sys.argv[sys.argv.index('--') + 1:]
OUTDIR = args[0]
shots = [s.split('@') for s in args[1].split(',')]   # clip@seconds
scene = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name == 'Icosphere': o.hide_render = True
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.color_type = 'TEXTURE'
scene.display.shading.light = 'STUDIO'
scene.render.resolution_x, scene.render.resolution_y = 420, 520
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 2.6
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
fps = scene.render.fps / scene.render.fps_base
views = {'f': ((0, -8, 1.3), (math.radians(90), 0, 0)), 'q': ((5.5, -5.5, 1.3), (math.radians(90), 0, math.radians(45))), 's': ((-8, 0, 1.2), (math.radians(90), 0, math.radians(-90)))}
for clip, sec in shots:
    arm.animation_data.action = bpy.data.actions[clip]
    scene.frame_set(int(round(float(sec) * fps)))
    for v, (loc, rot) in views.items():
        cam.location, cam.rotation_euler = loc, rot
        scene.render.filepath = os.path.join(OUTDIR, f'{clip}_{sec}_{v}.png')
        bpy.ops.render.render(write_still=True)
print('DONE')

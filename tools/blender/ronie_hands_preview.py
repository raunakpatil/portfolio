# Close-ups of both hands at given clip@seconds poses (front view), from the authored .blend
import bpy, sys, os, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
OUTDIR = args[0]
shots = [s.split('@') for s in args[1].split(',')]
scene = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name == 'Icosphere': o.hide_render = True
pb = arm.pose.bones
B = lambda s: next(n for n in pb.keys() if n.startswith('CC_Base_' + s + '_'))
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.color_type = 'TEXTURE'
scene.display.shading.light = 'STUDIO'
scene.render.resolution_x, scene.render.resolution_y = 300, 300
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 0.6
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
fps = scene.render.fps / scene.render.fps_base
for clip, sec in shots:
    arm.animation_data.action = bpy.data.actions[clip]
    scene.frame_set(int(round(float(sec) * fps)))
    for side in ('R', 'L'):
        h = arm.matrix_world @ pb[B(f'{side}_Hand')].tail
        cam.location = h + Vector((0, -3, 0)); cam.rotation_euler = (math.radians(90), 0, 0)
        scene.render.filepath = os.path.join(OUTDIR, f'{clip}_{sec}_{side}.png'); bpy.ops.render.render(write_still=True)
print('DONE')

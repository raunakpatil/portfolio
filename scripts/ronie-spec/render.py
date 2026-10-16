"""Renders Ronie's 3D model for the loading screen's spec sheet.
blender -b -P render.py -- <model.glb> <outdir> <job> [frame]
jobs: test | ortho | details | armor | joints"""
import bpy, math, sys, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT, JOB = argv[0], argv[1], argv[2]
FRAME = int(argv[3]) if len(argv) > 3 else 0
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
scene = bpy.context.scene
arm = next((o for o in scene.objects if o.type == 'ARMATURE'), None)
meshes = [o for o in scene.objects if o.type == 'MESH']
POSE = os.environ.get('RONIE_POSE', 'rest')
if arm and POSE == 'rest':
    arm.data.pose_position = 'REST'          # his bind pose: standing straight
elif arm and arm.animation_data and arm.animation_data.action:
    scene.frame_set(FRAME)
bpy.context.view_layer.update()

# ---------- a satin finish: the model's mirror-like gloss throws hard white streaks in a studio render
SATIN = float(os.environ.get('RONIE_SATIN', '0.38'))
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'BSDF_PRINCIPLED': continue
        r = n.inputs['Roughness']
        if r.is_linked:
            src = r.links[0].from_socket
            m = nt.nodes.new('ShaderNodeMath'); m.operation = 'MAXIMUM'; m.inputs[1].default_value = SATIN
            nt.links.new(src, m.inputs[0]); nt.links.new(m.outputs[0], r)
        else:
            r.default_value = max(r.default_value, SATIN)
        for k in ('Coat Weight', 'Clearcoat'):
            if k in n.inputs: n.inputs[k].default_value = 0.0

# ---------- render settings
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except TypeError:
    pass
ee = scene.eevee
for k, v in (('taa_render_samples', 64), ('use_gtao', True), ('use_raytracing', True), ('use_shadows', True)):
    try: setattr(ee, k, v)
    except Exception: pass

world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.012, 0.014, 0.018, 1); bg.inputs[1].default_value = 1.0

# ---------- bounds of the posed model (evaluated, so the skinning is applied)
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in meshes:
    ev = o.evaluated_get(dg)
    m = ev.to_mesh()
    mw = o.matrix_world
    pts += [mw @ v.co for i, v in enumerate(m.vertices) if i % 7 == 0]
    ev.to_mesh_clear()
# robust: ignore the odd stray vertex
def q(vals, f): vals = sorted(vals); return vals[int(f * (len(vals) - 1))]
lo = Vector((q([p.x for p in pts], .002), q([p.y for p in pts], .002), q([p.z for p in pts], .001)))
hi = Vector((q([p.x for p in pts], .998), q([p.y for p in pts], .998), q([p.z for p in pts], .999)))
ctr = (lo + hi) / 2; size = hi - lo
print('BOUNDS', tuple(round(x, 3) for x in lo), tuple(round(x, 3) for x in hi))

# which way he faces: the glTF importer leaves models facing -Y; check the eye/visor side if bones exist
FWD = Vector((0, -1, 0))

def bone_pos(name_part):
    if not arm: return None
    for b in arm.pose.bones:
        if name_part in b.name:
            return arm.matrix_world @ b.head
    return None

# ---------- lights: a warm key, a cool rim from behind each side, a soft top fill
def light(name, kind, loc, energy, color, size=1.0, target=None):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if kind == 'AREA': d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o)
    o.location = loc
    t = target or ctr
    o.rotation_euler = (t - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

H = size.z
light('key', 'AREA', ctr + Vector((-1.6, -2.6, 0.9)) * H * 0.9, 160 * H * H, (1.0, 0.95, 0.88), size=1.6 * H)
light('fill', 'AREA', ctr + Vector((2.0, -2.2, 0.2)) * H * 0.9, 45 * H * H, (0.85, 0.9, 1.0), size=1.8 * H)
light('rimL', 'AREA', ctr + Vector((-2.2, 1.8, 0.6)) * H * 0.9, 140 * H * H, (0.55, 0.75, 1.0), size=0.8 * H)
light('rimR', 'AREA', ctr + Vector((2.2, 1.8, 0.6)) * H * 0.9, 140 * H * H, (1.0, 0.65, 0.4), size=0.8 * H)
light('top', 'AREA', ctr + Vector((0, 0, 1.6)) * H, 50 * H * H, (1, 1, 1), size=1.2 * H)

cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam

def shoot(path, w, h, eye, target, ortho=None, lens=85, rot_dir=None):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    if ortho:
        cam_d.type = 'ORTHO'; cam_d.ortho_scale = ortho
    else:
        cam_d.type = 'PERSP'; cam_d.lens = lens
    cam.location = eye
    cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('WROTE', path)

def around(angle_deg, dist, height=None, target=None):
    """a point at angle (0 = in front of him, 90 = his left side) and distance from target, horizontally"""
    t = target or ctr
    a = math.radians(angle_deg)
    d = Vector((math.sin(a), -math.cos(a), 0))       # rotate FWD about Z
    p = t + d * dist
    p.z = t.z if height is None else height
    return p

if JOB == 'test':
    shoot(os.path.join(OUT, 'test-front.png'), 600, 1000, around(0, H * 3), ctr, ortho=H * 1.08)

elif JOB == 'ortho':
    for name, ang in (('front', 0), ('side', 90), ('back', 180)):
        shoot(os.path.join(OUT, f'ortho-{name}.png'), 900, 1500, around(ang, H * 3), ctr, ortho=H * 1.1)

elif JOB == 'details':
    # close-ups: [name, bone, angle, distance (× height), lens, lift]
    jobs = [
        ('helmet', 'Head', 15, 0.55, 70, 0.08),
        ('chest', 'Spine02', 8, 0.75, 70, 0.0),
        ('shoulder', 'L_Upperarm', 55, 0.55, 70, 0.05),
        ('forearm', 'R_Forearm', -50, 0.7, 70, 0.0),
        ('back', 'Spine02', 180, 0.8, 70, 0.0),
        ('boot', 'R_Foot', -30, 0.6, 70, 0.05),
    ]
    for name, bone, ang, dist, lens, lift in jobs:
        t = bone_pos(bone) or ctr
        shoot(os.path.join(OUT, f'd-{name}.png'), 900, 540, around(ang, H * dist, t.z + H * lift, t), t, lens=lens)

elif JOB == 'armor':
    jobs = [
        ('helmet', 'Head', 25, 0.45, 70, 0.1),
        ('shoulder', 'L_Clavicle', 70, 0.45, 70, 0.04),
        ('chest', 'Spine02', 0, 0.62, 70, 0.02),
        ('forearm', 'L_Forearm', 80, 0.55, 70, 0.0),
        ('thigh', 'L_Thigh', 30, 0.6, 70, -0.08),
        ('knee', 'L_Calf', 20, 0.5, 70, 0.02),
        ('boot', 'L_Foot', 45, 0.5, 70, 0.04),
    ]
    for name, bone, ang, dist, lens, lift in jobs:
        t = bone_pos(bone) or ctr
        shoot(os.path.join(OUT, f'a-{name}.png'), 600, 600, around(ang, H * dist, t.z + H * lift, t), t, lens=lens)

elif JOB == 'joints':
    # a see-through hologram of him: bright where his surfaces turn away (the outlines), clear where they face you
    hm = bpy.data.materials.new('holo'); hm.use_nodes = True
    try: hm.surface_render_method = 'BLENDED'
    except Exception: hm.blend_method = 'BLEND'
    nt = hm.node_tree; nt.nodes.clear()
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.42
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 1.6
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (0.82, 0.88, 0.95, 1); em.inputs[1].default_value = 2.2
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(lw.outputs['Facing'], pw.inputs[0]); nt.links.new(pw.outputs[0], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
    for o in meshes:
        o.data.materials.clear(); o.data.materials.append(hm)
    W, Hpx = 900, 1500
    eye = around(0, H * 3); shoot(os.path.join(OUT, 'joints.png'), W, Hpx, eye, ctr, ortho=H * 1.1)
    # where his joints land in the picture (0..1 from the top-left), for the labels drawn over it on the page
    from bpy_extras.object_utils import world_to_camera_view
    import json
    spots = {}
    for key, bone in (('shoulder', 'L_Upperarm'), ('elbow', 'L_Forearm'), ('hip', 'L_Thigh'), ('knee', 'L_Calf'), ('ankle', 'L_Foot')):
        p = bone_pos(bone)
        if p is None: continue
        v = world_to_camera_view(scene, cam, p)
        spots[key] = [round(v.x, 4), round(1 - v.y, 4)]
    json.dump(spots, open(os.path.join(OUT, 'joints.json'), 'w'))
    print('JOINTS', spots)

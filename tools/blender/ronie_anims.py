# Author Ronie's extra animations in Blender, starting from his idle pose (frame at 12.8 s of the source clip).
# Poses are written as world-space rotations ("turn the head 25° to his left"), so the rig's bone axes don't matter.
import bpy, sys, math
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene
FPS = scene.render.fps / scene.render.fps_base
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
src_action = arm.animation_data.action
pb = arm.pose.bones
for p in pb: p.rotation_mode = 'QUATERNION'

B = lambda s: next(n for n in pb.keys() if n.startswith('CC_Base_' + s + '_') or n == 'CC_Base_' + s)
HIP, PELVIS, WAIST, SP1, SP2 = B('Hip'), B('Pelvis'), B('Waist'), B('Spine01'), B('Spine02')
NK1, NK2, HEAD = B('NeckTwist01'), B('NeckTwist02'), B('Head')
CL_L, UA_L, FA_L, HD_L = B('L_Clavicle'), B('L_Upperarm'), B('L_Forearm'), B('L_Hand')
CL_R, UA_R, FA_R, HD_R = B('R_Clavicle'), B('R_Upperarm'), B('R_Forearm'), B('R_Hand')
LEGS = [n for n in pb.keys() if any(k in n for k in ('Thigh', 'Calf', 'Foot', 'Toe', 'Knee'))]
ORDER = [HIP, PELVIS, WAIST, SP1, SP2, NK1, NK2, HEAD, CL_L, UA_L, FA_L, HD_L, CL_R, UA_R, FA_R, HD_R]

# world axes → armature space.  He faces -Y in Blender; his right is -X.
mw3 = arm.matrix_world.to_3x3()
toArm = lambda v: (mw3.inverted() @ Vector(v)).normalized()
AX = {'up': toArm((0, 0, 1)), 'right': toArm((-1, 0, 0)), 'fwd': toArm((0, -1, 0))}
# conventions (degrees): up+ = turn to HIS left; right+ = top tips back / a hanging limb swings forward;
#                        fwd+ = top tilts to HIS right / a hanging limb swings to his left

def frame_of(t): return t * FPS

def basis_at(action_time):
    scene.frame_set(int(math.floor(frame_of(action_time))), subframe=frame_of(action_time) % 1)
    return {n: (p.location.copy(), p.rotation_quaternion.copy()) for n, p in pb.items()}

BASE = basis_at(12.8)
JUMP = {k: basis_at(13.1 + k / FPS) for k in range(0, int(2.2 * FPS) + 2)}   # the source clip's clean hop
arm.animation_data.action = None

def set_basis(snap, names=None):
    for n, (loc, q) in snap.items():
        if names is None or n in names:
            pb[n].location = loc; pb[n].rotation_quaternion = q
    bpy.context.view_layer.update()

def rot_world(name, axis, deg, pivot=None):
    p = pb[name]
    M = p.matrix.copy()
    c = pivot if pivot is not None else M.translation.copy()
    R = Matrix.Rotation(math.radians(deg), 4, AX[axis])
    p.matrix = Matrix.Translation(c) @ R @ Matrix.Translation(-c) @ M
    bpy.context.view_layer.update()

def ease(x): return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, x)))

def offsets_at(keys, t):
    """keys: [(time, {bone: {axis: deg}})] → interpolated {bone: {axis: deg}} with ease in/out."""
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            f = ease((t - t0) / (t1 - t0)) if t1 > t0 else 1
            out = {}
            for bone in set(a) | set(b):
                axes = set(a.get(bone, {})) | set(b.get(bone, {}))
                out[bone] = {ax: a.get(bone, {}).get(ax, 0) * (1 - f) + b.get(bone, {}).get(ax, 0) * f for ax in axes}
            return out
    return keys[-1][1] if t >= keys[-1][0] else keys[0][1]

FEET_MID = None
def apply(offs):
    for bone in ORDER:
        if bone not in offs: continue
        for ax in ('up', 'right', 'fwd'):
            d = offs[bone].get(ax, 0)
            if abs(d) > 1e-4:
                rot_world(bone, ax, d, FEET_MID if bone == HIP else None)

def key(names, f):
    for n in names:
        pb[n].keyframe_insert('rotation_quaternion', frame=f)
        if n == HIP: pb[n].keyframe_insert('location', frame=f)

def make(name, length, keys, touched, legs_from_jump=False, step=2):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    global FEET_MID
    set_basis(BASE)
    FEET_MID = (pb[B('L_Foot')].head + pb[B('R_Foot')].head) / 2
    names = set(touched) | ({HIP, PELVIS, WAIST, SP1, SP2} | set(LEGS) if legs_from_jump else set())
    n = int(round(length * FPS))
    for f in list(range(0, n, step)) + [n]:
        t = f / FPS
        set_basis(BASE)
        if legs_from_jump:
            set_basis(JUMP[min(f, max(JUMP))], names={HIP, PELVIS, WAIST, SP1, SP2, *LEGS})
        apply(offsets_at(keys, t))
        key(names, f)
    for fc in getattr(act, 'fcurves', []):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    arm.animation_data.action = None
    print('MADE', name, n, 'frames', len(names), 'bones')

Z = {}
# ---------------- idle variations ----------------
look_l = {HEAD: {'up': 26, 'right': 4}, NK2: {'up': 8}, SP2: {'up': 6}}
look_r = {HEAD: {'up': -24, 'right': 2, 'fwd': 3}, NK2: {'up': -8}, SP2: {'up': -6}}
make('idle_look', 6.0, [(0, Z), (1.1, look_l), (2.3, {**look_l, HEAD: {'up': 30, 'right': 2}}), (3.3, look_r),
                        (4.5, {**look_r, HEAD: {'up': -27, 'right': 0, 'fwd': 3}}), (5.6, Z), (6.0, Z)],
     [HEAD, NK2, SP2])

sway_r = {HIP: {'fwd': 2.2}, SP1: {'fwd': -1.6}, NK2: {'fwd': -1.0}, HEAD: {'fwd': 1.5},
          UA_R: {'fwd': -2}, UA_L: {'fwd': -2}}
sway_l = {HIP: {'fwd': -2.2}, SP1: {'fwd': 1.6}, NK2: {'fwd': 1.0}, HEAD: {'fwd': -1.5},
          UA_R: {'fwd': 2}, UA_L: {'fwd': 2}}
make('idle_sway', 6.4, [(0, Z), (1.6, sway_r), (2.4, sway_r), (4.0, sway_l), (4.8, sway_l), (6.4, Z)],
     [HIP, SP1, NK2, HEAD, UA_L, UA_R])

stretch = {SP2: {'right': 10}, NK2: {'right': 4}, HEAD: {'right': 16}, CL_L: {'fwd': 7, 'right': -6}, CL_R: {'fwd': -7, 'right': -6},
           UA_L: {'fwd': 18, 'right': -24}, UA_R: {'fwd': -18, 'right': -24}, FA_L: {'right': 10}, FA_R: {'right': 10}}
stretch2 = {**stretch, UA_L: {'fwd': 22, 'right': -30}, UA_R: {'fwd': -22, 'right': -30}, SP2: {'right': 12}, HEAD: {'right': 20}}
make('idle_stretch', 5.6, [(0, Z), (1.1, stretch), (1.9, stretch2),
                           (2.8, {HEAD: {'fwd': 16}, NK2: {'fwd': 5}}), (3.6, {HEAD: {'fwd': -16}, NK2: {'fwd': -5}}),
                           (4.6, Z), (5.6, Z)],
     [SP2, NK2, HEAD, CL_L, CL_R, UA_L, UA_R, FA_L, FA_R])

check = {SP2: {'up': -5, 'right': -3}, HEAD: {'up': -16, 'right': -18}, NK2: {'right': -5},
         UA_R: {'right': 32, 'fwd': 14}, FA_R: {'right': 78}, HD_R: {'up': 0}}
make('idle_hand', 5.6, [(0, Z), (1.0, check), (1.8, {**check, HD_R: {'fwd': 28}}), (2.6, {**check, HD_R: {'fwd': -22}}),
                        (3.4, check), (4.5, Z), (5.6, Z)],
     [SP2, NK2, HEAD, UA_R, FA_R, HD_R])

# ---------------- excited: a hop with both fists pumping ----------------
arms_back = {UA_L: {'right': -14}, UA_R: {'right': -14}}
arms_up = {UA_L: {'fwd': 115, 'right': 30}, UA_R: {'fwd': -115, 'right': 30}, FA_L: {'right': 25}, FA_R: {'right': 25},
           SP2: {'right': 8}, HEAD: {'right': 14}}
pump = {UA_L: {'right': 55, 'fwd': 10}, UA_R: {'right': 55, 'fwd': -10}, FA_L: {'right': 105}, FA_R: {'right': 105},
        SP2: {'right': -4}, HEAD: {'right': 6}}
make('excited', 2.2, [(0, Z), (0.45, arms_back), (0.8, arms_up), (1.05, arms_up), (1.35, pump), (1.6, pump), (2.2, Z)],
     [SP2, HEAD, UA_L, UA_R, FA_L, FA_R], legs_from_jump=True, step=1)

# ---------------- confused: head tilt and a palms-up shrug ----------------
shrug = {HEAD: {'fwd': 18, 'up': 8}, NK2: {'fwd': 6}, SP2: {'right': 4},
         CL_L: {'fwd': 9}, CL_R: {'fwd': -9},
         UA_L: {'fwd': 4, 'right': 8}, UA_R: {'fwd': -4, 'right': 8}, FA_L: {'right': 75, 'up': 22}, FA_R: {'right': 75, 'up': -22},
         HD_L: {'fwd': -55}, HD_R: {'fwd': 55}}
hmm = {**shrug, HEAD: {'fwd': -12, 'up': -6, 'right': -6}, NK2: {'fwd': -4}}
make('confused', 3.4, [(0, Z), (0.55, shrug), (1.2, shrug), (1.8, hmm), (2.5, hmm), (3.4, Z)],
     [HEAD, NK2, SP2, CL_L, CL_R, UA_L, UA_R, FA_L, FA_R, HD_L, HD_R])

# drop the source clip; export only the skeleton and the new actions
bpy.data.actions.remove(src_action)
for o in bpy.data.objects: o.select_set(False)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_def_bones=False, export_skins=False,
                          export_optimize_animation_size=True, export_force_sampling=False)
print('EXPORTED', OUT)

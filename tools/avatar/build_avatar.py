"""Build TrackCal's realistic training avatar as a .glb (run inside Blender with the MPFB extension).

Everything in the output is MakeHuman/MPFB core assets (CC0: base mesh, body targets, bundled game-engine rig and
weights) or made here (sportswear, hair and eye colours as plain materials). No real person is scanned or depicted.

    blender -b --python tools/avatar/build_avatar.py -- <out.glb> [--gender 0..1] [--inspect]

Run Blender with a separate profile that has MPFB installed (tools/avatar/README.md)."""
import sys
import bpy
import bmesh
import addon_utils
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = args[0] if args else 'avatar.glb'
GENDER = float(args[args.index('--gender') + 1]) if '--gender' in args else 1.0
INSPECT = '--inspect' in args

addon_utils.enable('bl_ext.blender_org.mpfb', default_set=True, persistent=True)   # temporary profile only
from bl_ext.blender_org.mpfb.services.humanservice import HumanService            # noqa: E402
from bl_ext.blender_org.mpfb.services.targetservice import TargetService          # noqa: E402

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# An athletic adult in their mid-twenties; ethnicity left at MakeHuman's even mix, for an international look.
macros = TargetService.get_default_macro_info_dict()
macros.update({"gender": GENDER, "age": 0.42, "muscle": 0.72, "weight": 0.42, "proportions": 0.75, "height": 0.55,
               "cupsize": 0.45, "firmness": 0.6})
human = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True,
                                  feet_on_ground=True, scale=0.1, macro_detail_dict=macros)
rig = HumanService.add_builtin_rig(human, "game_engine", import_weights=True)

if INSPECT:
    print("BONES", [b.name for b in rig.data.bones])
    print("VERTS", len(human.data.vertices), "FACES", len(human.data.polygons))

# ── 1. Bake the body shape into the mesh (no MPFB shape keys left).
bpy.context.view_layer.objects.active = human
for o in bpy.context.view_layer.objects:
    o.select_set(o is human)
if human.data.shape_keys:
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)

# ── 2. Delete helper geometry (clothes-fitting shells, joint cubes, teeth…) except the eyeballs.
names = {g.index: g.name for g in human.vertex_groups}
KEEP = {"helper-l-eye", "helper-r-eye"}
def groups_of(v):
    return {names[g.group]: g.weight for g in v.groups if g.weight > 0.0}
drop = set()
for v in human.data.vertices:
    gs = groups_of(v)
    if ("HelperGeometry" in gs or "JointCubes" in gs) and not (KEEP & gs.keys()):
        drop.add(v.index)
bm = bmesh.new(); bm.from_mesh(human.data)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in drop], context='VERTS')
bm.to_mesh(human.data); bm.free()
for m in list(human.modifiers):
    if m.type != 'ARMATURE':
        human.modifiers.remove(m)
names = {g.index: g.name for g in human.vertex_groups}

# ── 2b. Flatten the chest detail under the sports top, so the top reads as fabric. For each side: every vertex
# within 4 cm of the detail is pulled back onto a plane fitted to the surrounding ring (4–6 cm away), fully at the
# centre and fading to nothing at the edge.
mw = human.matrix_world; inv = mw.inverted()
def fit_plane(points):
    """Least-squares y = a + b*x + c*z (y is depth: the body faces -Y)."""
    n = len(points); sx = sum(p.x for p in points); sz = sum(p.z for p in points); sy = sum(p.y for p in points)
    sxx = sum(p.x * p.x for p in points); szz = sum(p.z * p.z for p in points); sxz = sum(p.x * p.z for p in points)
    sxy = sum(p.x * p.y for p in points); szy = sum(p.z * p.y for p in points)
    import numpy as np                                                                # bundled with Blender
    A = np.array([[n, sx, sz], [sx, sxx, sxz], [sz, sxz, szz]]); B = np.array([sy, sxy, szy])
    return np.linalg.solve(A, B)
world = [mw @ v.co for v in human.data.vertices]
for side_test in (lambda x: x > 0, lambda x: x < 0):
    tips = [world[v.index] for v in human.data.vertices if {"nipple", "nippleTip"} & groups_of(v).keys() and side_test(world[v.index].x)]
    if not tips:
        continue
    c = sum(tips, Vector()) / len(tips)
    inner = [i for i, w in enumerate(world) if (w - c).length < 0.04]
    ring = [world[i] for i, w in enumerate(world) if 0.04 <= (w - c).length < 0.06 and w.y < c.y + 0.03]
    a0, b0, c0 = fit_plane(ring)
    before = max(a0 + b0 * world[i].x + c0 * world[i].z - world[i].y for i in inner)
    for i in inner:
        w = world[i]; target = a0 + b0 * w.x + c0 * w.z
        k = max(0.0, 1 - (w - c).length / 0.04) ** 0.5
        if w.y < target:                                                              # only pull bumps back, never push in
            world[i] = Vector((w.x, w.y + (target - w.y) * k, w.z))
            human.data.vertices[i].co = inv @ world[i]
    after = max(a0 + b0 * world[i].x + c0 * world[i].z - world[i].y for i in inner)
    print("CHEST", len(inner), "vertices, bump %.1f mm -> %.1f mm" % (before * 1000, after * 1000))
bpy.context.view_layer.objects.active = human
if human.data.has_custom_normals:                                                     # MPFB's stored normals would keep the old shading
    bpy.ops.mesh.customdata_custom_splitnormals_clear()

# ── 3. Materials: skin, sports top, shorts, shoes, sole, short hair, eye white and iris.
def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]
def material(name, hexcolor, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = srgb(hexcolor)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = 0.0
    return m
MATS = {"skin": material("skin", "#b07a5a", 0.5), "top": material("top", "#7c3aed", 0.65),
        "shorts": material("shorts", "#1e1b4b", 0.7), "shoes": material("shoes", "#f1f5f9", 0.45),
        "sole": material("sole", "#0d9488", 0.6), "hair": material("hair", "#1c1410", 0.85),
        "eye": material("eye", "#f4f1ea", 0.2), "iris": material("iris", "#3b2416", 0.15)}
human.data.materials.clear()
order = list(MATS)
for k in order:
    human.data.materials.append(MATS[k])

bones = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}
def along(bone, p):
    """0 at the bone's head, 1 at its tail."""
    h, t = bones[bone]; d = t - h
    return max(0.0, min(1.0, (p - h).dot(d) / d.length_squared))

BONE_GROUPS = set(bones)
eye_centre = {}
for side in ("l", "r"):
    vs = [human.matrix_world @ v.co for v in human.data.vertices if f"helper-{side}-eye" in groups_of(v)]
    if vs:
        c = sum(vs, Vector()) / len(vs)
        eye_centre[side] = (c, max((v - c).length for v in vs))

NECK_Z = bones["neck_01"][0].z - 0.02          # crew neckline just below the base of the neck
WAIST_Z = bones["spine_01"][0].z + 0.02        # waistband at the navel
HEM_Z = bones["thigh_l"][0].z - 0.42 * (bones["thigh_l"][0].z - bones["calf_l"][0].z)   # shorts end above mid-thigh

def category(poly):
    gsum, centre, eye = {}, Vector(), None
    for vi in poly.vertices:
        v = human.data.vertices[vi]
        centre += human.matrix_world @ v.co
        for n, w in groups_of(v).items():
            if n in ("helper-l-eye", "helper-r-eye"):
                eye = n[7]
            if n in BONE_GROUPS or n in ("scalp", "fingernails", "toenails", "genitals", "nipple"):
                gsum[n] = gsum.get(n, 0) + w
    centre /= len(poly.vertices)
    if eye:
        c, r = eye_centre[eye]
        return "iris" if (centre - c).dot(Vector((0, -1, 0))) > 0.72 * r else "eye"
    if gsum.get("scalp", 0) > 1.5:
        return "hair"
    bone = max((n for n in gsum if n in BONE_GROUPS), key=lambda n: gsum[n], default="")
    if bone in ("foot_l", "foot_r", "ball_l", "ball_r") or gsum.get("toenails"):
        return "sole" if centre.z < 0.018 else "shoes"
    if bone in ("upperarm_l", "upperarm_r"):
        return "top" if along(bone, centre) < 0.3 else "skin"
    if bone.startswith(("lowerarm", "hand", "index", "middle", "ring", "pinky", "thumb", "neck", "head", "calf")):
        return "skin"
    # Torso and upper legs: straight hems at fixed heights from the skeleton.
    if centre.z > NECK_Z:
        return "skin"
    if centre.z > WAIST_Z:
        return "top"
    if centre.z > HEM_Z:
        return "shorts"
    return "skin"

for poly in human.data.polygons:
    poly.material_index = order.index(category(poly))
    poly.use_smooth = True

# ── 4. Export: the mesh skinned to the rig, no animation (the app poses the bones from its own keyframes).
bpy.ops.object.select_all(action='DESELECT')
human.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_skins=True,
                          export_animations=False, export_morph=False, export_texcoords=False, export_normals=True,
                          export_materials='EXPORT', export_yup=True, export_apply=False)
print("EXPORTED", OUT, "faces", len(human.data.polygons))

"""MetaHuman export (tools/metahuman/build.sh) -> a light GLB for the web app's 3D coach.

blender -b --factory-startup --python tools/metahuman/to_web.py -- D:/TrackCalMetaHuman/Export/CoachA frontend/web/public/avatar/coach-f.glb

- The phone-friendly mesh level (LOD1, ~12.6k vertices) and its skeleton (same bone names as the app's rig).
- Real skin: the face and body colour and normal maps, eyes and eyelashes.
- Sportswear (top, shorts, shoes) made by cutting the body along straight planes first, so every hem is a clean line,
  then colouring the faces: no torn edges where a hem used to follow the triangles.
- Hair and eyebrows as cards (flat strips with an alpha mask) fixed to the head bone.
- Material names the app's look editor already recolours: skin, hair, top, shorts, shoes (and sole, eye, lashes).
- Textures resized and stored as WebP to keep the download small.
"""
import sys, os
import bpy, bmesh
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0].rstrip("/\\"), args[1]
NAME = os.path.basename(SRC)
TEX = int(os.environ.get("TEX_SIZE", "1024"))
MAPS, FACE, GROOM = f"{SRC}/{NAME}/Maps", f"{SRC}/Face", f"{SRC}/Groom"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=f"{SRC}/{NAME}_body.fbx", use_custom_normals=True)
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
body = next(o for o in meshes if o.name.endswith("_LOD1"))
for o in meshes:
    if o is not body:
        bpy.data.objects.remove(o, do_unlink=True)
body.name = "coach"
W = body.matrix_world
bones = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}


# ── 1. Images ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def image(path, size=TEX, keep_alpha=False, flip_green=False):
    """Load, resize and make opaque. The GPU-captured face maps have alpha 0 everywhere, and WebP throws away the colour
    of fully transparent pixels (the face came out flat grey and see-through), so only masks keep their alpha."""
    im = bpy.data.images.load(path)
    if im.size[0] > size:
        im.scale(size, size)
    if not keep_alpha or flip_green:
        px = np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
        if not keep_alpha:
            px[:, 3] = 1.0
        if flip_green:   # Unreal normal maps are DirectX-style; glTF expects OpenGL-style (the face looked metallic)
            px[:, 1] = 1.0 - px[:, 1]
        im.pixels[:] = px.ravel()
    im.pack()
    return im


def material(name, color=(1, 1, 1), rough=0.6, base=None, normal=None, alpha=False, two_sided=False, tint=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = 0.0
    if base is not None:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = base
        if tint:   # texture x colour: glTF keeps both (baseColorTexture and baseColorFactor)
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = (*color, 1)
            nt.links.new(t.outputs["Color"], mix.inputs[6]); nt.links.new(mix.outputs[2], p.inputs["Base Color"])
        else:
            nt.links.new(t.outputs["Color"], p.inputs["Base Color"])
        if alpha:
            nt.links.new(t.outputs["Alpha"], p.inputs["Alpha"])
    if normal is not None:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = normal; t.image.colorspace_settings.name = "Non-Color"
        n = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(t.outputs["Color"], n.inputs["Color"]); nt.links.new(n.outputs["Normal"], p.inputs["Normal"])
    if alpha:
        m.blend_method = "CLIP" if hasattr(m, "blend_method") else None
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            pass
    m.use_backface_culling = not two_sided
    return m


def srgb(h):
    return tuple((c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)))


face_img = image(f"{FACE}/Face_BASECOLOR.png")
face_nrm = image(f"{FACE}/Face_NORMAL.png", TEX // 2, flip_green=True)
body_img = image(f"{MAPS}/Body_Basecolor.png")
body_nrm = image(f"{MAPS}/Body_Normal.png", TEX // 2, flip_green=True)
eye_img = image(f"{MAPS}/Eyes_Color.png", 256)
lash_img = image(f"{MAPS}/Eyelashes_Color.png", 256, keep_alpha=True) if os.path.exists(f"{MAPS}/Eyelashes_Color.png") else None

MATS = {
    "skin_face": material("skin_face", rough=0.55, base=face_img, normal=face_nrm if os.environ.get("FACE_NORMAL", "0") == "1" else None),
    "skin": material("skin", rough=0.6, base=body_img, normal=body_nrm),
    "top": material("top", srgb("#7c3aed"), 0.7),
    "shorts": material("shorts", srgb("#1e1b4b"), 0.75),
    "shoes": material("shoes", srgb("#f1f5f9"), 0.5),
    "sole": material("sole", srgb("#0d9488"), 0.6),
    "eye": material("eye", rough=0.15, base=eye_img),
    "lashes": material("lashes", srgb("#120c08"), 0.8, base=lash_img, alpha=lash_img is not None, two_sided=True),
}
order = list(MATS)
body.data.materials.clear()
for k in order:
    body.data.materials.append(MATS[k])

# ── 2. Clean straight hems: cut the body along planes before colouring it ─────────────────────────────────────────────
NECK_Z = bones["neck_01"][0].z - 0.03
WAIST_Z = bones["spine_01"][0].z + 0.03
HEM_Z = bones["thigh_l"][0].z - 0.40 * (bones["thigh_l"][0].z - bones["calf_l"][0].z)
ANKLE_Z = bones["foot_l"][0].z + 0.035

bm = bmesh.new(); bm.from_mesh(body.data); bm.faces.ensure_lookup_table()
inv = W.inverted()
deform = bm.verts.layers.deform.active
group_names = {g.index: g.name for g in body.vertex_groups}


def faces_of(pred):
    return [f for f in bm.faces if pred(f)]


def world(v):
    return W @ v.co


def cut(point, normal, faces):
    """Split the given faces along a plane (world space)."""
    if not faces:
        return
    co, no = inv @ point, (inv.to_3x3() @ normal).normalized()
    geom = list({e for f in faces for e in f.edges}) + faces + list({v for f in faces for v in f.verts})
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_inner=False, clear_outer=False)
    bm.faces.ensure_lookup_table()


def dominant(f):
    w = {}
    for v in f.verts:
        for gi, wt in v[deform].items():
            w[group_names.get(gi, "")] = w.get(group_names.get(gi, ""), 0) + wt
    return max(w, key=w.get) if w else ""


up = Vector((0, 0, 1))
torso = lambda f: not dominant(f).startswith(("upperarm", "lowerarm", "hand", "index", "middle", "ring", "pinky", "thumb", "head", "neck", "FACIAL"))
cut(Vector((0, 0, NECK_Z)), up, faces_of(torso))
NECK_HALF = 0.062   # a crew neck: skin only close to the neck
for sx in (1, -1):   # the neckline's sides: straight cuts, so the scoop has clean edges
    cut(Vector((sx * NECK_HALF, 0, 0)), Vector((1, 0, 0)), faces_of(lambda f: torso(f) and (W @ f.calc_center_median()).z > NECK_Z - 0.01))
cut(Vector((0, 0, WAIST_Z)), up, faces_of(torso))
cut(Vector((0, 0, HEM_Z)), up, faces_of(lambda f: dominant(f).startswith(("thigh", "pelvis"))))
cut(Vector((0, 0, ANKLE_Z)), up, faces_of(lambda f: dominant(f).startswith(("calf", "foot", "ball"))))
for side in ("l", "r"):   # short sleeves: a plane across the upper arm, 30% of the way to the elbow
    h, t = bones[f"upperarm_{side}"][0], bones[f"lowerarm_{side}"][0]
    cut(h + 0.3 * (t - h), (t - h).normalized(), faces_of(lambda f, s=side: dominant(f) in (f"upperarm_{s}", f"upperarm_twist_01_{s}", f"upperarm_twist_02_{s}", f"clavicle_{s}")))

# ── 3. What each face is ─────────────────────────────────────────────────────────────────────────────────────────────
# Loose pieces: the head is the largest piece above the shoulders; eyes are the two round 85-vertex pieces; the tiny
# 4-face cards are eyelashes; other small pieces inside the head (eye edges, teeth) are dropped for the web.
pieces, seen = [], set()
for f0 in bm.faces:
    if f0.index in seen:
        continue
    stack, comp = [f0], []
    while stack:
        f = stack.pop()
        if f.index in seen:
            continue
        seen.add(f.index); comp.append(f)
        for e in f.edges:
            stack.extend(g for g in e.link_faces if g.index not in seen)
    pieces.append(comp)
head_z = bones["head"][0].z - 0.12
head_piece = max((p for p in pieces if min(world(v).z for f in p for v in f.verts) > bones["spine_05"][0].z), key=len)
drop, fixed, eye_centres = [], {}, []
for p in pieces:
    vs = {v for f in p for v in f.verts}
    zmin = min(world(v).z for v in vs)
    if p is head_piece:
        kind = "skin_face"
        head_top = max(world(v).z for v in vs)
        head_pts = [world(v) for v in vs]
    elif zmin > head_z and len(vs) <= 8:
        kind = "lashes"
    elif zmin > head_z and 60 <= len(vs) <= 120:
        kind = "eye"
        eye_centres.append(sum((world(v) for v in vs), Vector()) / len(vs))
    elif zmin > head_z and len(vs) < 400:
        drop.extend(p); continue
    else:
        continue
    for f in p:
        fixed[f.index] = kind
def arm_share(c):
    """How far along the upper arm a point is (0 shoulder, 1 elbow), or None if it is not on an arm."""
    for sd in ("l", "r"):
        h, t = bones[f"upperarm_{sd}"][0], bones[f"lowerarm_{sd}"][0]
        d = t - h; along = (c - h).dot(d) / d.length_squared
        off = (c - (h + along * d)).length                     # distance from the arm's own axis
        side = (c.x - h.x) * (1 if h.x > 0 else -1)          # out beyond the shoulder joint, not the chest
        if 0 < along < 1.15 and off < 0.075 and side > -0.01:
            return along
    return None


for f in bm.faces:
    if f.index in fixed:
        kind = fixed[f.index]
    else:
        c = W @ f.calc_center_median()
        b = dominant(f)
        if b.startswith(("foot", "ball", "bigtoe", "indextoe", "middletoe", "ringtoe", "littletoe")) or (b.startswith("calf") and c.z < ANKLE_Z) or c.z < ANKLE_Z - 0.01:
            kind = "sole" if c.z < 0.02 else "shoes"
        elif arm_share(c) is not None:
            kind = "top" if arm_share(c) < 0.3 else "skin"
        elif b.startswith(("upperarm", "clavicle")) and c.z > WAIST_Z:
            kind = "top"
        elif torso(f) and c.z > NECK_Z and abs(c.x) < NECK_HALF:
            kind = "skin"
        elif torso(f) and c.z > WAIST_Z:
            kind = "top"
        elif (torso(f) or b.startswith("thigh")) and c.z > HEM_Z:
            kind = "shorts"
        else:
            kind = "skin"
    f.material_index = order.index(kind)
    f.smooth = True
bmesh.ops.delete(bm, geom=list(set(drop)), context="FACES")
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001 / W.to_scale()[0])
THICK = {"top": 0.003, "shorts": 0.0035, "shoes": 0.007, "sole": 0.007}
bm.verts.ensure_lookup_table(); bm.normal_update()
for v in bm.verts:
    kinds = {order[f.material_index] for f in v.link_faces}
    if len(kinds) == 1:
        k = kinds.pop()
        if k in THICK:
            v.co += v.normal * (THICK[k] / W.to_scale()[0])
bm.to_mesh(body.data); bm.free()

# ── 4. Hair and eyebrows (cards), fixed to the head bone ─────────────────────────────────────────────────────────────
def cards(kind, lod=1):
    """The densest card level under ~20k vertices (a short haircut's LOD1 has 41k: heavier than the whole body)."""
    path = f"{GROOM}/{kind}_cards_lod{lod}.fbx"
    if not os.path.exists(path):
        return None
    if lod < 3 and os.path.getsize(path) > 2_000_000 and os.path.exists(f"{GROOM}/{kind}_cards_lod{lod + 1}.fbx"):
        return cards(kind, lod + 1)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    obj = next(o for o in new if o.type == "MESH")
    for o in new:
        if o is not obj:
            bpy.data.objects.remove(o, do_unlink=True)
    obj.data.materials.clear()
    # The card atlas: green is the strand coverage, used as the alpha mask; the colour comes from the look (hair).
    atlas = bpy.data.images.load(f"{GROOM}/{kind}_atlas_attribute.png")
    px = np.array(atlas.pixels[:], dtype=np.float32).reshape(-1, 4)
    w, h = atlas.size
    mask = bpy.data.images.new(f"{kind}_mask", w, h, alpha=True)
    shade = 0.55 + 0.45 * px[:, 2:3]                      # a little root-to-tip variation from the blue channel
    out = np.concatenate([np.repeat(shade, 3, axis=1), px[:, 1:2]], axis=1)
    mask.pixels[:] = out.ravel()
    if w > TEX:
        mask.scale(TEX, TEX)
    mask.pack()
    obj.data.materials.append(material("hair", srgb("#2a1a12"), 0.75, base=mask, alpha=True, two_sided=True, tint=True))
    # Skinned to the head bone (weight 1), like the body: a bone-parented mesh lands in the wrong place after the
    # glTF axis conversion, a skinned one follows the head exactly.
    keep = obj.matrix_world.copy()
    obj.parent = rig; obj.matrix_world = keep
    group = obj.vertex_groups.new(name="head")
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    mod = obj.modifiers.new("rig", "ARMATURE"); mod.object = rig
    obj.name = kind
    return obj


hair_mat_shared, groom = None, []
helmet_path = f"{GROOM}/hair_helmet.fbx"
if os.path.exists(helmet_path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=helmet_path)
    new = [o for o in bpy.data.objects if o not in before]
    helmet = next(o for o in new if o.type == "MESH")
    for o in new:
        if o is not helmet:
            bpy.data.objects.remove(o, do_unlink=True)
    helmet.data.materials.clear()
    helmet.data.materials.append(material("hair", srgb("#2a1a12"), 0.85))
    keep = helmet.matrix_world.copy(); helmet.parent = rig; helmet.matrix_world = keep
    g = helmet.vertex_groups.new(name="head"); g.add(range(len(helmet.data.vertices)), 1.0, "REPLACE")
    helmet.modifiers.new("rig", "ARMATURE").object = rig
    helmet.name = "hair_helmet"
    groom.append(helmet)
for kind in ("hair", "brows"):
    o = cards(kind)
    if o is None:
        continue
    groom.append(o)
    if hair_mat_shared is None:
        hair_mat_shared = o.data.materials[0]
    else:                                              # one "hair" material so the look recolours both
        o.data.materials[0].name = "hair_brows"

# Grooms are authored on MetaHuman's template head; each coach's head sits elsewhere (height differs). Brows sit about
# 2.6 cm above and 1.2 cm in front of the eye centres, so the offset that puts them there moves the hair too.
brows = next((o for o in groom if o.name == "brows"), None)
helmet = next((o for o in groom if o.name == "hair_helmet"), None)
hair_parts = [o for o in groom if o.name != "brows"]
if len(eye_centres) >= 2:
    eyes = sum(eye_centres, Vector()) / len(eye_centres)
    # Hair: fit the helmet (the scalp shell the hair was made on) to this coach's skull: width above the eyes and the
    # crown height, then move the cards with it. Grooms are not all authored in the same space, so the brows can't anchor it.
    if helmet is not None:
        hp = [helmet.matrix_world @ v.co for v in helmet.data.vertices]
        h_top = max(w.z for w in hp)
        skull = [w for w in head_pts if w.z > eyes.z + 0.03]
        cut_h = head_top - (eyes.z + 0.03)
        shell = [w for w in hp if w.z > h_top - cut_h] or hp
        width = lambda ps: max(w.x for w in ps) - min(w.x for w in ps)
        centre = lambda ps: Vector(((max(w.x for w in ps) + min(w.x for w in ps)) / 2, (max(w.y for w in ps) + min(w.y for w in ps)) / 2, max(w.z for w in ps)))
        scale = width(skull) / max(0.05, width(shell)) * 1.04            # a little proud of the scalp
        src, dst = centre(shell), centre(skull) + Vector((0, 0, 0.004))
        for o in hair_parts:
            m = o.matrix_world.copy(); mi = m.inverted()
            for v in o.data.vertices:
                v.co = mi @ (dst + ((m @ v.co) - src) * scale)
        print("HAIR FIT scale", round(scale, 3), "move", tuple(round(x, 3) for x in dst - src))
    # Brows: just above and in front of the eyes.
    if brows is not None:
        pts = [brows.matrix_world @ v.co for v in brows.data.vertices]
        shift = eyes + Vector((0, -0.012, 0.026)) - sum(pts, Vector()) / len(pts)
        brows.matrix_world.translation += shift
        print("BROWS shift", tuple(round(x, 3) for x in shift))

# ── 5. Export ────────────────────────────────────────────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    o.select_set(o.type in ("MESH", "ARMATURE"))
bpy.context.view_layer.objects.active = rig
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_skins=True, export_animations=False,
                          export_morph=False, export_yup=True, export_apply=False, export_image_format="WEBP",
                          export_materials="EXPORT", export_normals=True, export_texcoords=True)
print("EXPORTED", OUT, os.path.getsize(OUT) // 1024, "KB,", len(body.data.polygons), "faces,", len(rig.data.bones), "bones")

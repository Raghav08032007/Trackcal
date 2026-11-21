"""Render a front and three-quarter preview of an avatar .glb (for checking the build, not shipped).

    blender -b --python tools/avatar/preview.py -- <in.glb> <out-prefix>"""
import sys
import math
import bpy

args = sys.argv[sys.argv.index('--') + 1:]
GLB, PREFIX = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 600, 900
scene.world = bpy.data.worlds.new("w"); scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.94, 0.97, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
for name, loc, energy in (("key", (2.5, -3, 3.5), 900), ("fill", (-3, -2, 2), 350), ("rim", (0, 3, 3), 500)):
    light = bpy.data.lights.new(name, 'AREA'); light.energy = energy; light.size = 2.5
    obj = bpy.data.objects.new(name, light); obj.location = loc
    scene.collection.objects.link(obj)
    obj.rotation_euler = (math.atan2(math.hypot(loc[0], loc[1]), loc[2] - 1), 0, math.atan2(loc[0], -loc[1]))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 50
for i, angle in enumerate((0, 35)):
    a = math.radians(angle)
    cam.location = (4.6 * math.sin(a), -4.6 * math.cos(a), 0.95)
    cam.rotation_euler = (math.radians(90), 0, a)
    scene.render.filepath = f"{PREFIX}-{i}.png"
    bpy.ops.render.render(write_still=True)
print("RENDERED")

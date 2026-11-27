"""Turn an avatar exercise video into a y4m file Chrome can use as a fake webcam (keeps the frame rate).
blender -b --factory-startup --python tools/camera-e2e/make_fakecam.py -- <input.webm> <output.y4m> [loops]"""
import sys, os, glob, tempfile
import bpy, numpy as np

src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
loops = int((sys.argv[sys.argv.index("--") + 1:] + ["", "", "3"])[2] or 3)
tmp = tempfile.mkdtemp()
sc = bpy.context.scene
strip = sc.sequence_editor_create().strips.new_movie("v", src, 1, 1)
sc.frame_start, sc.frame_end = 1, strip.frame_final_duration
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 640, 480, 100
fps = int(round(sc.render.fps / sc.render.fps_base))
sc.render.image_settings.file_format = "JPEG"; sc.render.filepath = os.path.join(tmp, "f_")
bpy.ops.render.render(animation=True)
W, H = 640, 480
with open(dst, "wb") as out:
    out.write(f"YUV4MPEG2 W{W} H{H} F{fps}:1 Ip A1:1 C420jpeg\n".encode())
    for _ in range(loops):
        for f in sorted(glob.glob(os.path.join(tmp, "f_*.jpg"))):
            im = bpy.data.images.load(f); a = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1, :, :3] * 255; bpy.data.images.remove(im)
            r, g, b = a[..., 0], a[..., 1], a[..., 2]
            y = .299 * r + .587 * g + .114 * b; u = -.168736 * r - .331264 * g + .5 * b + 128; v = .5 * r - .418688 * g - .081312 * b + 128
            u = u.reshape(H // 2, 2, W // 2, 2).mean((1, 3)); v = v.reshape(H // 2, 2, W // 2, 2).mean((1, 3))
            out.write(b"FRAME\n")
            for plane in (y, u, v):
                out.write(np.clip(plane, 0, 255).astype(np.uint8).tobytes())
print("wrote", dst)

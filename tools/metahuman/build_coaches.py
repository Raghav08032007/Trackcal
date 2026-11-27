"""Build the TrackCal coach characters with MetaHuman Creator and export them for Blender.

Runs inside the full Unreal editor (the skin textures are baked by Texture Graph, which only runs there), in two passes
(TCMH_STEP=prepare, then TCMH_STEP=export) because new textures finish compiling only after the script returns.
Use tools/metahuman/build.sh, which runs both.
Each coach in coaches.json starts from one of Epic's fictional MetaHuman presets (no real person is scanned).
Output per coach, in D:/TrackCalMetaHuman/Export/<name>/:
  <name>/          DCC export: head.dna, body.dna, Maps/*.png (2K skin, eyes, teeth)
  <name>_body.fbx  the combined body + head skeletal mesh with its skeleton and all LODs, for tools/metahuman/to_web.py
The cloud steps (texture download, auto-rig) use the Epic account signed in to the launcher.
"""
import json, os, traceback
import unreal

HERE = "F:/track cal/tools/metahuman"
OUT = "D:/TrackCalMetaHuman/Export"
log = lambda m: unreal.log(f"TCMH {m}")
lib = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous(["/MetaHumanCharacter/Optional"], True)


def edit(ch):
    if not sub.try_add_object_to_edit(ch):
        raise RuntimeError(f"cannot edit {ch}")


def done(ch):
    if sub.is_object_added_for_editing(ch):
        sub.remove_object_to_edit(ch)


def body(ch, measures):
    if not measures:
        return
    cons = {str(c.name).lower().replace(" ", "_"): c for c in sub.get_body_constraints(ch)}
    for key, value in measures.items():
        if key in cons:
            cons[key].is_active = True
            cons[key].target_measurement = float(value)
        else:
            log(f"unknown body measure {key}; known: {sorted(cons)}")
    sub.set_body_constraints(ch, list(cons.values()))
    sub.commit_body_state(ch)


def export_fbx(mesh_path, file_path):
    mesh = unreal.load_asset(mesh_path)
    if not mesh:
        raise RuntimeError(f"no mesh at {mesh_path}")
    task = unreal.AssetExportTask()
    task.object = mesh
    task.filename = file_path
    task.automated = True
    task.prompt = False
    task.replace_identical = True
    opts = unreal.FbxExportOption()
    opts.level_of_detail = True          # keep every LOD; Blender picks a light one for phones
    opts.export_morph_targets = True
    opts.ascii = False
    opts.collision = False
    task.options = opts
    if not unreal.Exporter.run_asset_export_task(task):
        raise RuntimeError(f"FBX export failed for {mesh_path}")


def capture_face(ch, folder):
    """The face textures live only in memory (no asset path), which the DCC bake can't read, so it writes a grey
    checkerboard. Copy each one through a GPU render target and save it as a PNG instead."""
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    rl = unreal.RenderingLibrary
    count = 0
    for key, texture in ch.synthesized_face_textures.items():
        if not texture:
            continue
        w, h = texture.blueprint_get_size_x(), texture.blueprint_get_size_y()
        rt = rl.create_render_target2d(world, w, h, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB if texture.srgb else unreal.TextureRenderTargetFormat.RTF_RGBA8)
        canvas, size, ctx = rl.begin_draw_canvas_to_render_target(world, rt)
        canvas.draw_texture(texture, unreal.Vector2D(0, 0), unreal.Vector2D(w, h), unreal.Vector2D(0, 0), unreal.Vector2D(1, 1),
                            unreal.LinearColor(1, 1, 1, 1), unreal.BlendMode.BLEND_OPAQUE, 0.0, unreal.Vector2D(0.5, 0.5))
        rl.end_draw_canvas_to_render_target(world, ctx)
        name = getattr(key, "name", str(key)).split(".")[-1].split(":")[0].strip("<> ")
        rl.export_render_target(world, rt, folder, f"Face_{name}.png")
        count += 1
    log(f"face images captured: {count}")


GROOMS = "/MetaHumanCharacter/Optional/Grooms/GroomAssets"


def export_asset(path, file_path):
    """A plugin asset with real source data (a static mesh or a texture) to FBX or PNG."""
    obj = unreal.load_asset(path)
    if not obj:
        log(f"missing {path}")
        return False
    task = unreal.AssetExportTask()
    task.object = obj; task.filename = file_path; task.automated = True; task.prompt = False; task.replace_identical = True
    if file_path.endswith(".fbx"):
        opts = unreal.FbxExportOption(); opts.collision = False; opts.level_of_detail = False; task.options = opts
    ok = unreal.Exporter.run_asset_export_task(task)
    if not ok:
        log(f"export failed {path}")
    return ok


def export_grooms(coach):
    """Hair and eyebrows as cards (flat strips with an alpha atlas): strands can't render on the web."""
    folder = f"{OUT}/{coach['name']}/Groom"
    for kind, group in (("hair", "Hair"), ("brows", "Eyebrows")):
        style = coach.get(kind)
        if not style:
            continue
        base = f"{GROOMS}/{group}/{style}/{style}"
        for lod in (1, 2, 3):
            export_asset(f"{base}_CardsMesh_Group0_LOD{lod}", f"{folder}/{kind}_cards_lod{lod}.fbx")
        export_asset(f"{base}_CardsAtlas_Attribute", f"{folder}/{kind}_atlas_attribute.png")
        export_asset(f"{base}_CardsAtlas_Tangent", f"{folder}/{kind}_atlas_tangent.png")
        export_asset(f"{base}_Helmet_LOD5", f"{folder}/{kind}_helmet.fbx")
    log(f"{coach['name']}: grooms exported")


def build(coach):
    name, preset = coach["name"], coach["preset"]
    path = f"/Game/Coaches/{name}"
    if not lib.does_asset_exist(path):
        if not lib.duplicate_asset(f"/MetaHumanCharacter/Optional/Presets/{preset}", path):
            raise RuntimeError(f"preset {preset} not found")
    ch = unreal.load_asset(path)
    edit(ch)
    try:
        prepare(ch, coach, path)
    finally:
        done(ch)


def prepare(ch, coach, path):
    """Pass 1: shape, skin, textures and rig, then save. Textures finish compiling after this run."""
    name = coach["name"]
    if True:
        body(ch, coach.get("body"))
        # A copied preset has no generated face skin yet: re-applying its skin settings runs the face texture synthesis.
        sub.commit_skin_settings(ch, ch.skin_settings)
        log(f"{name}: face textures {len(ch.synthesized_face_textures)}")
        tex = unreal.MetaHumanCharacterTextureRequestParams(); tex.blocking = True; tex.report_progress = False
        sub.request_texture_sources(ch, tex)
        log(f"{name}: textures")
        rig = unreal.MetaHumanCharacterAutoRiggingRequestParams(); rig.blocking = True; rig.report_progress = False
        rig.rig_type = unreal.MetaHumanRigType.JOINTS_ONLY
        sub.request_auto_rigging(ch, rig)
        log(f"{name}: rigged")
        lib.save_asset(path)


def export(ch, name):
    """Pass 2: every texture is compiled now, so the baked skin is real (not the loading checkerboard)."""
    if True:
        dcc = unreal.MetaHumanDCCExportParams()
        dcc.external_path = f"{OUT}/{name}"; dcc.bake_make_up = True; dcc.compress_in_zip_file = False; dcc.archive_name = name
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_dcc(ch, dcc)
        geo = unreal.MetaHumanGeometryExportParams()
        geo.project_path = f"/Game/Coaches/{name}_Geo"
        geo.head_skeletal_mesh = False; geo.body_skeletal_mesh = False; geo.full_body_skeletal_mesh = True
        geo.overwrite_existing_assets = True
        unreal.MetaHumanCharacterExportBlueprintLibrary.export_geometry(ch, geo)


# The editor has to keep running between opening a character and baking it, or the face textures are still not on
# the GPU and the bake reads a grey checkerboard. So the work runs from the editor's tick, with a pause before exporting.
coaches = json.load(open(f"{HERE}/coaches.json", encoding="utf-8"))
only = os.environ.get("TCMH_ONLY")
queue = [c for c in coaches if not only or c["name"] == only]
STEP = os.environ.get("TCMH_STEP", "prepare")
WAIT = float(os.environ.get("TCMH_WAIT", "90"))
state = {"coach": None, "ch": None, "since": 0.0, "clock": 0.0, "capture": []}


def finish():
    log("finish called")
    unreal.unregister_slate_post_tick_callback(handle)
    log("finished")
    unreal.SystemLibrary.quit_editor()


def tick(delta):
    state["clock"] += delta
    if state["capture"]:
        if state["clock"] < WAIT:
            return
        for ch, folder in state["capture"]:
            try:
                capture_face(ch, folder)
            except Exception:
                log(f"capture FAILED: {traceback.format_exc()}")
            done(ch)
        state["capture"] = []
        return
    try:
        if state["coach"] is None:
            if not queue:
                return finish()
            coach = queue.pop(0)
            state["coach"] = coach
            if STEP == "prepare":
                build(coach)
                state["coach"] = None
                return
            path = f"/Game/Coaches/{coach['name']}"
            ch = state.pop("opened")      # opened in the start-up script (opening from a tick fails)
            state["ch"], state["since"] = ch, state["clock"]
            log(f"{coach['name']}: open with {len(ch.synthesized_face_textures)} face textures; waiting {WAIT:.0f}s for the GPU")
            return
        if state["clock"] - state["since"] < WAIT:
            return
        coach, ch = state["coach"], state["ch"]
        try:
            export(ch, coach["name"])
        finally:
            done(ch)
        meshes = [a for a in lib.list_assets(f"/Game/Coaches/{coach['name']}_Geo", recursive=True) if unreal.load_asset(a).get_class().get_name() == "SkeletalMesh"]
        for m in meshes:
            export_fbx(m.split(".")[0], f"{OUT}/{coach['name']}/{coach['name']}_body.fbx")
        log(f"{coach['name']}: exported")
        state["coach"] = None
    except Exception:
        log(f"{(state['coach'] or {}).get('name')} FAILED: {traceback.format_exc()}")
        if state["ch"] is not None:
            done(state["ch"])
        state["coach"] = state["ch"] = None


if STEP == "export":
    # Export runs straight from the start-up script: Epic's exporter builds the face mesh through an import that cannot
    # finish inside a tick callback. Compiled shaders are cached between runs, so the face bake reads the real skin.
    for coach in queue:
        try:
            ch = unreal.load_asset(f"/Game/Coaches/{coach['name']}")
            edit(ch)
            try:
                for kind in ("Texture", "Material", "StaticMesh", "SkeletalMesh"):
                    unreal.SystemLibrary.execute_console_command(None, f"Editor.Async{kind}CompilationFinishAll")
                log(f"{coach['name']}: {len(ch.synthesized_face_textures)} face textures")
                export(ch, coach["name"])
                # Ask for every mip of the face textures; they are captured after WAIT seconds, from the tick below.
                for texture in ch.synthesized_face_textures.values():
                    if texture:
                        texture.set_editor_property("never_stream", True)
                        texture.set_force_mip_levels_to_be_resident(600.0)
                state["capture"].append((ch, f"{OUT}/{coach['name']}/Face"))
            except Exception:
                done(ch)
                raise
            finally:
                pass
            for m in [a for a in lib.list_assets(f"/Game/Coaches/{coach['name']}_Geo", recursive=True) if unreal.load_asset(a).get_class().get_name() == "SkeletalMesh"]:
                export_fbx(m.split(".")[0], f"{OUT}/{coach['name']}/{coach['name']}_body.fbx")
            log(f"{coach['name']}: exported")
        except Exception:
            log(f"{coach['name']} FAILED: {traceback.format_exc()}")
    queue = []
    state["since"] = 0.0
handle = unreal.register_slate_post_tick_callback(tick)

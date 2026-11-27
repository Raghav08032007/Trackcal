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
state = {"coach": None, "ch": None, "since": 0.0, "clock": 0.0}


def finish():
    log("finish called")
    unreal.unregister_slate_post_tick_callback(handle)
    log("finished")
    unreal.SystemLibrary.quit_editor()


def tick(delta):
    state["clock"] += delta
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
            ch = unreal.load_asset(path)
            edit(ch)
            state["ch"], state["since"] = ch, state["clock"]
            log(f"{coach['name']}: opened, letting textures load for {WAIT:.0f}s")
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


handle = unreal.register_slate_post_tick_callback(tick)

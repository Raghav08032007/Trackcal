"""Hair and eyebrows for each coach as cards (flat strips + alpha atlas); strands can't render on the web.
Runs as a commandlet (no editor window or GPU needed):
  UnrealEditor-Cmd.exe D:/TrackCalMetaHuman/TrackCalMetaHuman.uproject -run=pythonscript -script=".../export_grooms.py"
"""
import json, os
import unreal

HERE = "F:/track cal/tools/metahuman"
OUT = "D:/TrackCalMetaHuman/Export"
GROOMS = "/MetaHumanCharacter/Optional/Grooms/GroomAssets"
log = lambda m: unreal.log(f"TCMH {m}")
unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous(["/MetaHumanCharacter/Optional/Grooms"], True)


def export_asset(path, file_path):
    obj = unreal.load_asset(path)
    if not obj:
        return False
    task = unreal.AssetExportTask()
    task.object = obj; task.filename = file_path; task.automated = True; task.prompt = False; task.replace_identical = True
    if file_path.endswith(".fbx"):
        opts = unreal.FbxExportOption(); opts.collision = False; opts.level_of_detail = False; task.options = opts
    ok = unreal.Exporter.run_asset_export_task(task) and os.path.exists(file_path)
    log(f"{'wrote' if ok else 'FAILED'} {file_path}")
    return ok


# The head every groom was authored on: to_web.py fits the hair from this head to each coach's own head.
export_asset("/MetaHumanCharacter/Optional/Grooms/GroomMesh/MH_Groom_Head", f"{OUT}/groom_head.fbx")

only = os.environ.get("TCMH_ONLY")
for coach in json.load(open(f"{HERE}/coaches.json", encoding="utf-8")):
    if only and coach["name"] != only:
        continue
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

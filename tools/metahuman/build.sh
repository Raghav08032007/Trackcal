#!/usr/bin/env bash
# Build every coach in coaches.json (or one: ./build.sh CoachA): MetaHuman in Unreal, then Blender for the web.
set -e
UE="${UE_DIR:-D:/Epic Games/UE_5.8}/Engine/Binaries/Win64/UnrealEditor.exe"
PROJECT="${MH_PROJECT:-D:/TrackCalMetaHuman/TrackCalMetaHuman.uproject}"
HERE="$(cd "$(dirname "$0")" && pwd)"
export TCMH_ONLY="$1"
cp "$HERE/init_unreal.py" "$(dirname "$PROJECT")/Content/Python/init_unreal.py"
for step in prepare export; do
  echo "== Unreal: $step ${1:-all coaches}"
  TCMH_STEP=$step "$UE" "$PROJECT" -RenderOffscreen -nop4 -nosplash -log -abslog="D:/TrackCalMetaHuman/$step.log" >/dev/null 2>&1 || true   # the editor may crash while closing, after saving
  grep -E "TCMH" "D:/TrackCalMetaHuman/$step.log" | sed 's/.*TCMH /  /'
done
echo "== Unreal: hair and eyebrow cards"
"$(dirname "$UE")/UnrealEditor-Cmd.exe" "$PROJECT" -run=pythonscript -script="$HERE/export_grooms.py" -unattended -nop4 -nosplash -stdout -FullStdOutLogOutput 2>&1 | grep "TCMH" | sed 's/.*TCMH /  /'
echo "== Blender: web models"
BLENDER="${BLENDER:-C:/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
WEB="$(cd "$HERE/../../frontend/web/public/avatar" && pwd)"
"F:/track cal/backend/.venv/Scripts/python.exe" -c "import json;[print(c['name'],c.get('model','f')) for c in json.load(open(r'$HERE/coaches.json',encoding='utf-8')) if not '$1' or c['name']=='$1']" | while read name model; do
  "$BLENDER" -b --factory-startup --python "$HERE/to_web.py" -- "D:/TrackCalMetaHuman/Export/$name" "$WEB/coach-$model.glb" 2>&1 | grep -E "EXPORTED|Error"
done

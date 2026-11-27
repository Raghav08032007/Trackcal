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

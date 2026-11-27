# Copied to D:/TrackCalMetaHuman/Content/Python/ by build.sh. Unreal runs it at editor start-up and, unlike
# -ExecutePythonScript, does not close the editor when it returns, so the build can wait for textures to load.
# It does nothing unless TCMH_STEP is set, so opening the project normally is unaffected.
import os
if os.environ.get("TCMH_STEP"):
    exec(open("F:/track cal/tools/metahuman/build_coaches.py", encoding="utf-8").read(), {"__name__": "tcmh_build"})

# MetaHuman coaches

Builds realistic coach characters with MetaHuman Creator (Unreal Engine 5.8) and hands them to Blender for the web app.
Everything runs from scripts; you only need Unreal 5.8 installed and the Epic launcher signed in (the auto-rig and
texture download use Epic's cloud service).

- `coaches.json`: which of Epic's fictional presets each coach starts from (no real person is scanned).
- `build.sh [Name]`: runs Unreal twice (prepare, then export), off-screen, for every coach or one.
- `build_coaches.py`: the Unreal side; `init_unreal.py` starts it inside the editor only when `TCMH_STEP` is set.
- The Unreal project lives at `D:/TrackCalMetaHuman` (large caches; kept off the repo drive). Exports go to
  `D:/TrackCalMetaHuman/Export/<Name>/`.

Licence: MetaHuman is covered by the Unreal Engine licence and may be used with other engines (free under US$1M
revenue). Confirm the current MetaHuman EULA wording on export to the web before launch.

Status: see docs/ROADMAP.md, Phase C2 (face texture bake still open).

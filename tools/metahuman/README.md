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

- `export_grooms.py`: hair and eyebrow cards (commandlet; run by build.sh).
- `to_web.py` (Blender): the phone-friendly mesh level, real face and body skin, sportswear cut along straight planes
  (clean hems, a little fabric and shoe thickness), hair cards on a scalp shell fitted to each skull, eyebrows placed by the
  eyes; writes `frontend/web/public/avatar/coach-<f|m>.glb` (about 3-4 MB). The app loads it first and falls back to the
  lighter `athlete-<f|m>.glb`.

Known limits: Unreal normal maps made the face look metallic in three.js, so the face uses colour only (FACE_NORMAL=1 to
try again); no facial animation yet; shoes are shaped from the feet (no separate shoe model).

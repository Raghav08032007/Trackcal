# The 3D coach avatars

`frontend/web/public/avatar/athlete-f.glb` and `athlete-m.glb` are the realistic people in the exercise and sport demos
(`src/components/avatar-3d.tsx`). They are built by `build_avatar.py` in Blender with MPFB (the MakeHuman plugin for
Blender).

## What they are made of, and the licence

- **Body, body-shape targets, game-engine skeleton and its skin weights:** MakeHuman / MPFB core assets, shared under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). MakeHuman's licence page says you are "free to do as you
  see fit with the asset or derivates of the assets", with no fee, notice or attribution required, including in
  closed-source products (static.makehumancommunity.org/about/license.html and the MPFB FAQ). MPFB's *code* is GPL, but
  no code ships with the app, only the exported model.
- **Sportswear, hair and eye colours:** plain materials made in `build_avatar.py`.
- No third-party asset packs (clothes, hair, skins) are used, so no other licence applies.
- No real person is scanned, photographed or depicted: the bodies are synthetic (an athletic adult, MakeHuman's even mix
  of ethnicities for an international look). The chest detail is flattened under the sports top.

## Rebuild

Blender 5.2 is enough. MPFB is installed into a **separate, temporary Blender profile** so your own Blender settings and
add-ons are never touched:

```sh
P=/tmp/blender-profile; mkdir -p $P/config $P/scripts $P/extensions $P/datafiles
export BLENDER_USER_RESOURCES=$P BLENDER_USER_CONFIG=$P/config BLENDER_USER_SCRIPTS=$P/scripts \
       BLENDER_USER_EXTENSIONS=$P/extensions BLENDER_USER_DATAFILES=$P/datafiles
blender --online-mode -c extension install -s mpfb          # into the temporary profile only
blender -b --python tools/avatar/build_avatar.py -- frontend/web/public/avatar/athlete-f.glb --gender 0.0
blender -b --python tools/avatar/build_avatar.py -- frontend/web/public/avatar/athlete-m.glb --gender 1.0
blender -b --factory-startup --python tools/avatar/preview.py -- frontend/web/public/avatar/athlete-f.glb /tmp/check
```

Each model is about 0.8 MB (13,518 faces) and loads only when someone opens a 3D demo. The app poses the skeleton
from the same keyframes the rep counter is tested on, so no animation is stored in the file. If the model can't load,
the demo falls back to the simpler 3D figure, then to the flat drawing.

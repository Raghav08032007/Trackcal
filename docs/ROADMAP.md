# TrackCal roadmap: end-to-end and next phases

Updated 27 November 2026. Each phase lists what "done" means and how it is checked. Scores are out of 100.

## Where things stand

| Area | Score | Notes |
|---|---|---|
| Page changes and stability | 92 | Fixed 27 Nov: no errors, crashes or stuck pages in a signed-in click-through of 55–58 pages on desktop and phone (`tools/nav-check`). |
| Languages | 81 | 9 languages complete; 7 newer ones complete through phase 8. About 1,100 texts left. |
| Camera coaching | 74 | Counting, live fixes and the video bench work on 3D-avatar videos; accuracy on real people is not yet measured. |
| Workouts fit your equipment | 85 | New 27 Nov: "Equipment I have", automatic swaps, Swap and Skip during a workout. |
| 3D character | 45 | Moves, but looks like a toy: weak face and hands, clothing clips, legs and posture are wrong in some moves. |
| End-to-end services | 60 | Email, payments, voice and social sign-in are not connected (see Phase E). |

## Phase N: smooth navigation (done 27 Nov)

- Pages download before the address changes; a thin progress bar shows while they load. No more "Loading…" flash or "Transition aborted" errors.
- Every page has an error screen with **Try again**. A failed download (usually after an update) reloads once at the page being opened.
- Events, Communities and Challenges no longer wait forever for signed-out visitors.
- Check: `LOGIN=… PASSWORD=… TRACKCAL_API_URL=http://127.0.0.1:8011 node tools/nav-check/run.mjs [--mobile]`. It must report `problems 0`.

## Phase Q: workouts that fit what you have (started 27 Nov)

Done:
1. **Equipment I have**: chips on the camera page (none, chair, dumbbells, barbell, kettlebell, band, cable, pull-up bar), saved on the device.
2. **Automatic fitting**: any workout, program day or muscle link swaps exercises you can't do. It uses a coach-style list: the same movement with gear you own first, then the bodyweight form of the pattern. It never jumps from easy to hard, and it says what it changed.
3. **Swap / Skip**: each exercise that needs gear shows "Swap for …" and, inside a workout, "Skip this exercise". Nothing is recorded for a skipped exercise.
4. The exercise list hides exercises you can't do.

Next:
- Q2: save "Equipment I have" to the account profile (`preferences.equipment` already exists) so it follows the user across devices, and ask for it during onboarding.
- Q3: the plan, program and "Make one for me" screens start from the saved equipment and show "With equipment / Without equipment" tabs.
- Q4: per-exercise "I can't do this" (injury or space), which reuses the same swap list with a reason.

## Phase E: end-to-end gaps

Features with a screen but no working connection behind it. "You" means a step only the owner can do (keys, accounts, legal).

| # | Feature | Missing | Who |
|---|---|---|---|
| E1 | Email verification, password reset | Mail server settings (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) and `PUBLIC_APP_URL` | You add the keys; I test the full flow (sign up → email → verify → reset) |
| E2 | Premium payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (test mode first) | You create a Razorpay test account; I run checkout → webhook → plan active → cancel |
| E3 | Voice meal entry (server) | `WHISPER_URL` (local Whisper service) | I add a start script; you run it |
| E4 | Push notifications | VAPID keys exist; no check on a real phone yet | I test on Android Chrome; iPhone needs the app added to the Home Screen |
| E5 | Sign in with Google / Apple | Not built | I build it after E1 (needs the OAuth client IDs from you) |
| E6 | Health sync (Health Connect / Apple Health) | Not possible from a web app | Needs the mobile app wrapper (Phase M) |
| E7 | Database upgrades | Migrations 0026–0031 and the recipe seed not yet run on your database | You run `alembic upgrade head` and `python scripts/seed_standard_recipes.py` |

For each E item, "done" means an automated browser test that walks the whole flow on the test database, plus a manual check by you on a phone.

## Phase C: realistic 3D coach (new, from your request)

**Goal:** a believable human coach that people connect with, moving with correct posture: feet planted, knees tracking over toes, a neutral spine, and arms that move only where the exercise says.

### C1: fix the motion first (works with any character)

The wrong legs and posture come from how moves are posed, not from the model, so a better model alone won't fix them. I'm doing this first:
1. **Feet stay planted**: two-bone leg IK locks each foot to the floor during standing moves, so legs can't cross, slide or float.
2. **Joint limits**: every joint is clamped to a healthy human range (no knees bending sideways, no wrists folding back).
3. **Moves written from coaching cues**: each exercise's key poses are rebuilt from its form rules in `exercise-forms.ts` (e.g. side raise: soft elbows, hands to shoulder height, shoulders down), then checked automatically by running the app's own camera form checker on the avatar video. If the coach's demo would fail our own form check, it's wrong.
4. **Clothing**: shorts and top fitted so the hem doesn't tear through the skin; fixes the jagged edge in your screenshot.

Check: the video bench gives each demo a form score; every demo must pass its own exercise's checks.

### C2: MetaHuman character

What MetaHuman means here, honestly:
- MetaHumans are made in **Unreal Engine 5.6+** (MetaHuman Creator). Since 5.6, Epic's license allows using MetaHuman characters outside Unreal. **Before launch, we confirm the current license terms** for a web app with a lawyer.
- A full MetaHuman is far too heavy for a phone browser: hundreds of thousands of triangles, 8K textures, strand hair. It has to be **exported at a low level of detail**. Target: body 20–30k triangles, 1–2K textures, card hair, compressed GLB (Draco or meshopt, KTX2), under 8 MB.
- Characters must be **invented ones, not scans of real people** (your rule).

Steps:
1. **You:** install Unreal Engine 5.6+ (free) with the MetaHuman plugin, then create 2–3 coaches (different skin tones, body types, genders) in MetaHuman Creator.
2. **I:** write the export pipeline: Unreal → FBX at a low level of detail → Blender script (decimate, bake textures, card hair, rename bones to our rig) → compressed GLB → `public/models/`.
3. **I:** map the MetaHuman skeleton to our motion system so every exercise from C1 plays on it, plus face blendshapes for blinking, smiling, breathing and an encouraging nod.
4. **I:** add a quality switch: the realistic coach on capable devices, the light model on low-end phones (picked automatically, with a setting to override).

Check: frame rate ≥ 50 on a mid-range Android phone; a first-load size limit; the form score from C1 still passes.

## Phase L: remaining languages

About 1,100 texts in 119 files for kn, ml, gu, pa, ur, fr, de. About 90 files have only one text left, so one sweep finishes many screens. Then the tool screens (design, testing guide, device, gym and media tools, moderation, coach booking).

## Phase P: polish pass

Every page at 360 px and 1366 px, light and dark: layout, overflow, contrast, focus order, tap sizes. Scores per page.

## Phase R: launch readiness

Security review, Lighthouse, backups and restore drill, monitoring and alerts, legal review of Terms and Privacy in all languages.

## Phase M: mobile app wrapper (later)

Capacitor wrapper for Android and iOS: Health Connect and Apple Health sync, native notifications, camera permissions.

## Order of work

1. Q2–Q4 (small, finishes your equipment request)
2. C1: motion fixes for the current character
3. E1–E4 as you supply the keys (they don't block the other work)
4. C2, after you've made the MetaHuman characters
5. L, then P, then R

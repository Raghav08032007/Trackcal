# Camera permissions, data and retention

28 October 2026. Recording, video uploads and microphone features are outside Phase 4.

## Permission lifecycle

Authenticated page explains local processing and limitations first. Enable camera explicitly calls getUserMedia with `audio:false`. Model loading follows permission. A visible local-only active indicator and immediate stop control remain in the camera stage. Pause also shuts down the camera; resume explicitly reacquires it. Device selection is enumerated only after access, with front/rear facing preference and exact device selection where supported. Pause before switching; OS/browser may override facing preferences.

Tracks stop and video references clear on stop, pause, end/review, hidden tab, pagehide, unmount/account navigation, disconnect and initialization/playback/model/frame failures. Permission results arriving after cancellation are stopped. No page-load activation or automatic resume. Browser-level permission revocation remains available.

## Data map

| Data | Location / retention |
|---|---|
| Raw video/image frames | Transient camera/worker memory only; transferred bitmaps closed; no recording/upload |
| Raw pose landmarks | Transient worker response/current analyzer/UI state only; no disk/backend landmark history |
| Camera labels/device IDs | Current page memory; not server profile/storage |
| Unsaved review | Account-scoped localStorage/IndexedDB count/aggregate draft, until save/discard/site-data clearing; excluded from workspace backup export |
| Confirmed counts, original estimates, corrections, exercise/method/engine version, aggregate confidence/sample totals | Existing owned MySQL workout session JSON, existing export/history; existing account retention policy applies |
| XP/participation achievements | Existing centralized reward/audit ledger; no confidence ranking, appearance/weight/calorie-burn rewards |

Storage is not encrypted by TrackCal on the device; use a trusted device and clear site data to remove local copies. Signing out does not erase local workspace data. Session deletion hides history and preserves participation audit; account closure deactivates access rather than promising immediate erasure. Operator retention/erasure/security obligations remain existing launch gates. No new analytics/vendor video pipeline is added.

## Trust and verification

Same-origin authenticated workout proxy with CSRF origin checks and bounded JSON; backend owner-scoped queries, strict extra-field rejection, numeric/array bounds, stable UUIDs and revision locks. Raw `video`, `landmarks`, forged XP and mismatched camera metadata are rejected. Client estimates and user corrections remain self-reported; server validation cannot cryptographically prove physical exercise, and capped participation badges must not be sold as verified skill or used for competitive confidence rankings.

Automated tests verify synthetic permission denial/late grants, pause/end/navigation cleanup, zero external inference and no media/landmark fields in workout writes. Actual device permission UI/OS indicators, interruption behavior and all network infrastructure are **NOT VERIFIED** until tested on deployment devices. Official public test image used for model QA is temporary test-only material, not customer video or an app media library.

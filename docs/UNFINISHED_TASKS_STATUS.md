# Completion follow-through — 2026-10-22

## Completed

- Standalone offline guest journal: public HTML/CSS/JS cached by the production service worker. Reopening without network serves the journal with no Next/React bundle or account request dependency. Manual meals persist under existing guest journal keys and reappear in the normal dashboard. Guest entries can be imported into a signed-in account through its existing account screen. Damaged data is preserved and storage errors are surfaced. JSON export is available.
- Queued backup retries now run throughout the signed-in app on startup, reconnect, focus and once per minute. Supported browsers also receive a Background Sync registration. Only explicitly queued snapshots are uploaded; owner binding and revision conflict protection apply. Browsers control background scheduling, so delivery while closed is not guaranteed. Conflicts remain paused for review.
- Direct microphone recording: explicit permission, active indicator, stop button, automatic 60-second limit, track cleanup on unmount and permission errors. Recordings are decoded and converted to mono PCM16 16 kHz WAV for the existing local Whisper endpoint. No transcript is sent for nutrition estimation until the user requests it.
- Mobile label uploads request the rear camera through the browser's capture hint, with regular file upload still available.
- Added `backend/scripts/bind_household_owner.py` to bind only an existing active, non-deleted account by email. It writes the owner UUID to the ignored server environment without printing credentials. Restart the API after binding.
- Fixed the build failure by replacing the custom Tailwind Turbopack loader with the documented Tailwind PostCSS plugin. Standard production build passes.

## Verified

Full web suite: 119 passing tests; one additional service-worker fallback test passes separately, giving 120 web checks. These include 10 new checks for guest isolation/corruption recovery, WAV format/duration, microphone denial/cleanup, background backup conflicts/races/account binding and cached offline navigation. Production build, TypeScript and ESLint were checked. The previous 119 backend and 4 standalone parser checks remain the backend baseline; they were not rerun for these frontend changes. Combined recorded coverage: 243 checks.

The standalone journal was opened and visually inspected in the production browser at `/offline.html`. Offline network fallback was exercised in the service-worker harness, not through a real disconnected phone. Physical camera/microphone capture and closed-browser Background Sync scheduling remain device verification items.

## Remaining external prerequisites

1. The requested household email had no TrackCal account when queried. Create it at `/signup`, then run from `backend`: `.venv/Scripts/python scripts/bind_household_owner.py <account-email>`. No account password was generated or guessed. Grocy's private stock API was verified in the earlier integration run; access stays restricted until binding completes.
2. Mealie is not deployed. Docker is absent, WSL is not installed, and the available Python environment is 3.12 while the checked-out Mealie version requires 3.14 and native LDAP dependencies. Its adapter and loopback-only Compose configuration are ready. A working Docker runtime or a suitable Linux host is needed to run the household Compose profile. No OS feature or reboot was forced.
3. Physical-device camera/microphone checks and the separate Expo prototype require a real device or configured emulator. Simulated tests and actual uploaded-media inference do not certify hardware capture.

Full authenticated offline startup remains outside this guest journal implementation. Private account HTML and API responses are deliberately not cached. Account recovery email, onboarding and other proposed additions from the roadmap have not been represented as completed tasks here.

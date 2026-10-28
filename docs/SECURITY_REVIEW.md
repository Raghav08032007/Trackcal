# Security review record — 22 October 2026

This is an implementation review and dependency scan, not independent penetration testing or compliance certification.

## Remediated

- Recovery and verification links are random, time-limited, purpose-bound and stored only as SHA-256 hashes. Consumption locks the database row; expired/used/wrong-purpose links fail. Password resets invalidate other reset links and existing access/refresh tokens through a keyed credential fingerprint.
- Replaced python-jose/ECDSA dependencies with PyJWT 2.15.1 restricted to HS256. Updated FastAPI 0.159.1, Starlette 1.9.0, multipart 0.0.32, Pillow 13.0.0, dotenv 1.2.4 and pip 26.2.2; regression tests pass.
- Added shared atomic MySQL request buckets for production authentication/recovery and AI/media/tool use. AI requires verified email in production. Global signup/recovery limits reduce bulk abuse. Failed provider attempts count toward limits.
- Production startup rejects a weak/missing signing secret, mock inference, invalid daily limits and non-HTTPS/wildcard CORS origins. Public upload-file serving is disabled in production. API liveness/readiness are separate.
- Cookies remain HttpOnly, Secure in production and SameSite=Lax. Web mutations reject foreign origins; a configured public origin supports HTTPS reverse proxies without trusting arbitrary forwarded headers. Recovery tokens use URL fragments and are removed after hydration. Responses set no-referrer and content-type protection.
- Deployment isolates MySQL/API from published ports, runs application containers without root, makes the API filesystem read-only with explicit writable volumes and restricts body size at the HTTPS edge. Container runtime is not yet validated on this workstation.

## Audit results and exceptions

- `npm audit --omit=dev`: zero advisories at the time checked.
- Full npm audit: five high development-tool advisories trace to `braces <=3.0.3` through the Next ESLint plugin. Registry latest was 3.0.3; no compatible patched release was available. The linter uses trusted repository configuration, not public request input. No forced incompatible Next downgrade or audit suppression was applied. Recheck before release and do not lint untrusted generated glob patterns.
- Final installed-backend OSV audit: **one advisory**, `PYSEC-2026-3740`, NLTK 3.10.3 model-artifact APIs bypassing allowed-root checks; no fixed version listed. TrackCal accepts ingredient text only, loads fixed application model resources and does not expose model-artifact APIs or user-selected model paths. Downloads are a fixed build/setup operation; a missing resource fails with an explicit error instead of downloading on request. The production API image is read-only. This is a mitigation assessment, not proof of non-exploitability. A security reviewer must approve reachability/controls or replace/update the dependency before public launch.

Audit JSON is in ignored `backend/runtime/security-audit-final.json`; no keys or submitted meals are included. The installed-environment audit does not certify future Linux image transitive dependencies. Scan the built container and its OS packages on the actual deployment host before release. Re-run advisories after dependency changes.

## Remaining review

Confirm real HTTPS proxy behavior, SMTP delivery and abuse resistance, session handling across devices, account closure/retention policy, secret rotation, backup encryption/restoration, provider terms/data processing, private household ownership and alerts. Resolve the embedded frontend gitlink before relying on remote CI. Run real device and independent security tests. No healthcare/allergen-safety or accuracy claim is supported by these tests.

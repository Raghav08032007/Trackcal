# Readiness execution — 26 October 2026

## REA installation verified

Used the reverse-engineer-anything skill. Read-only `rea-agents@6.7.0 doctor --client codex --json` reported healthy Codex registration and aligned skill version 42. The connected server's `binary_session` confirmed version 6.7.0, aligned identity and 207 exposed MCP tools. Ghidra 12.1.4 and its JDK are available. Hopper, IDA and Kuna are unavailable; Android JADX/ADB and some platform-specific tools require separate prerequisites. No unrelated engines were installed and no client configuration was changed.

An initial local-page capture failed because the web target was unavailable. After starting the rebuilt TrackCal web server, a fresh REA browser scenario succeeded against `/signup`: evidence `ev_6ab9fefa4a67f1ae5872ec4195dcc284959871a69c67c20ec39129d9d6733c5d`. It launched temporary Chromium, captured the final URL and terminated its owned process. This confirms the browser scenario path, not every optional REA capability or authenticated product journey. No binary target was opened.

## Completed improvements

- Production startup now rejects origin URLs containing credentials, wildcard hosts, paths, queries, fragments, invalid ports or whitespace, and rejects template signing-secret placeholders.
- Public subscription catalog now advertises only the actual free offer, states that billing is disconnected and reports the configured production AI limit. Unimplemented paid features/unlimited usage are no longer sold by this endpoint. Legacy billing records remain visible, but cancellation returns an explicit unavailable response instead of claiming a provider subscription was cancelled. No payment was charged or existing provider subscription changed.
- Signup/login requests have a 20-second request deadline and actionable timeout recovery. Signup warns that an account may already have been created and suggests signing in before resubmitting. The request is not retried automatically. Browser timeout errors are handled across JavaScript realms.
- Added `backend/scripts/release_preflight.py`: read-only environment checks, secret-free JSON output, nonzero exit for missing configuration. Runtime and customer evidence are explicitly separate. Running against the current local `.env` correctly reports that production mode/origin/mail are not ready; database/provider configuration is present. The report does not validate credentials or send email.
- Added `backend/scripts/package_source.py`: source allowlist and SHA-256 manifest, includes the actual embedded frontend source, rejects existing output paths and excludes real environment files, Git metadata, uploads, node_modules and installed Python/model runtimes. This provides a portable artifact without rewriting Git history. Remote parent-repository CI still needs proper source/submodule publication.
- Corrected the backend example environment to use SMTP_FROM, the actual email setting, and documented public origin and OpenRouter/quota fields.

## Verification

- Complete backend suite: **153 passed** with rollback-only MySQL transactions.
- Complete web suite: **140 passed**.
- Standalone meal-analysis checks: **4 passed**. Total: **297 checks**.
- Production webpack build, TypeScript and lint passed. Default Turbopack is not newly certified by this pass.
- Current `npm audit --omit=dev --audit-level=high`: zero vulnerabilities. This does not clear the prior backend/dev-tool review exceptions.
- Started the local API in its non-production testing environment with verbose development SQL logging suppressed. Live API readiness, web health proxy and the updated free-plan catalog returned HTTP 200. No public deployment was performed.
- Created a portable allowlisted source archive with 194 source files and verified every included file against its SHA-256 manifest. Environment files and runtime/customer data are excluded; example configuration templates are included. This verifies archive integrity, not a fresh Linux container build.
- Tests cover production-origin rejection, placeholder secret rejection, truthful plan/quota reporting, no false provider cancellation, timeout recovery, preflight secret redaction and package isolation.
- MySQL80 is running. Docker CLI is installed, but the Docker Desktop Linux engine is unavailable; container/image runtime verification remains outstanding.

## Remaining launch evidence

| Requirement | Status / next action |
| --- | --- |
| Domain, HTTPS deployment, production monitoring | Deferred owner setup; validate on selected host |
| Real verification/reset email | SMTP/provider/DNS setup and delivery test required |
| Container load, rollback and recovery drills | Need running Docker engine and isolated deployment host |
| Database plus uploaded-file recovery | SQL scripts exist; full restoration evidence still required |
| Security dependency exceptions | Prior NLTK/dev-tool exceptions still need fresh audit and independent review; not waived |
| Paid SaaS | Payment provider, webhook reconciliation, entitlements, invoices/cancellation/refunds remain unconnected |
| Coach/household ownership | Actual account registration/approval/binding still required |
| Physical devices and accessibility | Real iOS/Android, screen reader, permissions/interruption tests required |
| Accuracy | Independent weighed/reviewed nutrition dataset required |
| Demand, retention and profitability | Consenting pilot users, repeated-use cohorts and actual cost/revenue measurements required |

This is verified engineering progress, not a claim that every feature or business dimension is 10/10. Deployment/SMTP were explicitly deferred by the owner. No ratings, customer outcomes or accuracy measurements were fabricated.

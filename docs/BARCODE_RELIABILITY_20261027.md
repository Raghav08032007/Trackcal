# Barcode reliability and launch-quality follow-through

27 October 2026. Trigger: the user's camera preview opened but did not recognize the product barcode.

## What changed

The screenshot demonstrates camera access, not successful barcode decoding. Blur, glare, curvature, distance and camera capabilities can prevent decoding; an unknown product is a separate lookup failure. The original implementation provided no camera selection, requested no ideal capture dimensions and used a general-purpose default reader with little recovery guidance. These are confirmed implementation gaps, not proof of the single cause on the user's physical device.

- Product-focused ZXing 1D decoding with TRY_HARDER and UPC/EAN/ITF/Code128 formats.
- Requested ideal 1920×1080 capture, rear-facing preference and camera selection after permission.
- Continuous focus and zoom only when the track exposes the capability. Hardware may ignore ideal constraints.
- Full-width, non-cropped preview, scan guide and instructions for keeping quiet margins visible.
- Status for opening/ready/detected stages; after ten seconds, extra recovery guidance appears.
- Local barcode-photo decoding for JPG/PNG/WebP/BMP up to 10 MB, with object-URL cleanup and stale-request protection. The image is not uploaded by this path; the decoded number is used for lookup.
- Existing typed-code fallback and explicit unknown/incomplete-product messages remain available.
- Stops controls and media tracks on stop/unmount and when the document is hidden; duplicate callback results do not duplicate lookups.
- Removed the unsupported fixed product-count claim from the interface.

The existing installed @zxing/library 0.22.0 is now declared directly in package.json and the lockfile. An offline lock-only npm command failed because an unrelated optional Tailwind package was not cached; no extra version was installed. The existing locked library entry/integrity was preserved while adding its root dependency declaration.

Implementation follows the primary ZXing browser API for constraints, cameras and image decoding: https://github.com/zxing-js/browser . No server schema or payment behavior changed.

## Re-test the physical product

Reload the app and select Barcode scan. Choose the sharpest available camera. Keep the complete code and white margins inside the guide, remove reflections and adjust distance until the bars are sharp. For a curved bottle, face the barcode toward the lens. If it does not decode, upload a close-up photo or enter the printed digits. A valid code can still return no nutrition record; use the packaging label and manual journal entry in that case.

A generated EAN-13 fixture (`tests/fixtures/ean13-3017620422003.png`) supports repeatable browser decoding. It is synthetic test data, not a photo of the user's product. Physical-camera performance on the user's bottle must still be re-tested; fixture results do not certify it.

## What a high-quality paid release needs

Treat 10/10 as acceptance evidence rather than a score to claim in advance:

1. Core-loop reliability: capture → decode → lookup → review → grams → journal → progress, with recoverable errors. Agree a representative barcode/lighting/device test matrix and measure detection separately from database coverage. A proposed acceptance target is at least 95% detection of readable reference labels within five seconds across the agreed devices; it is not a measured result yet.
2. Nutrition trust: a consented, weighed/reviewed evaluation set; error reporting and corrections; no invented nutrients for missing products.
3. Production operations: HTTPS/domain, email verification/reset delivery, monitoring, backup restoration, load and rollback tests.
4. Paid lifecycle: test-mode checkout, signed/idempotent webhooks, quotas/entitlements, cancellation/refunds and reconciliation before live charging.
5. Accessibility and devices: keyboard, screen reader, reduced motion, real iOS/Android camera/microphone and interrupted network/permission flows.
6. Customer proof: a consenting pilot, documented activation, weekly repeat use, support failures and actual serving costs. Ratings should improve only after this evidence exists.

Domain/deployment and SMTP remain deferred by the owner. Existing launch limitations are not erased by this scanner update.


## Final verification

- Full frontend suite: 162 passed across 27 files using the thread pool with two workers. Existing camera lifecycle mocks were updated to the new reader class; their assertions were retained.
- Production webpack build, TypeScript and lint passed. Dark-mode status/error contrast was improved after browser review.
- Browser: uploaded the synthetic EAN-13 PNG through the real file chooser; the page reached an actual Open Food Facts product result for 3017620422003 with live source attribution. The source changed from the labeled demo record to the fetched Nutella record. No nutrition was logged and no account progress was altered.
- Screenshot: `barcode-photo-lookup-verification.png`.
- Physical camera decoding on the user's bottle remains unverified. The upload path proves actual image-to-lookup integration, not universal camera success or complete product coverage.


## Camera preview follow-up

User reported no visible camera after the first scanner update. Live DOM inspection confirmed an active scanner UI showing “Camera ready” while the video had no `srcObject`, readyState 0, videoWidth/videoHeight 0 and paused=true. This was a preview failure, not an unknown-product response.

The component now owns `getUserMedia` streams directly and uses ZXing's public `scan(video, callback)` on the owned preview after playback begins. Cleanup only clears the video when it still owns that exact stream; late cancelled camera requests cannot detach a replacement stream. Video playback events drive the ready state. A visible waiting panel and “Show camera preview” button provide a user-gesture recovery when autoplay is blocked. Permission/busy-device errors are explicit. Media tracks are still released on stop, unmount and hiding the document.

Regression verification: 164 frontend tests passed across 27 files. New checks cover autoplay recovery and a delayed cancelled camera request resolving after its replacement. Existing permission, duplicate detection, upload and cleanup assertions remain. No backend or user account data was modified.

Live follow-through: after rebuilding and restarting, the actual integrated webcam reached videoWidth=1280, videoHeight=720, readyState=4 and paused=false. The accessibility tree changed from “Unable to play media” to “Barcode camera preview,” and the status reported Camera ready. Saved a cropped controls-only screenshot (`camera-preview-recovery-verification.png`) without recording the user camera feed. The scanner was left open for the user. Production webpack build, TypeScript and ESLint passed.

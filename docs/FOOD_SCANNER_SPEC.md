# Food scanner and review specification

28 October 2026. Preserve existing barcode preview, uploaded barcode decoding, manual barcode input, photo/text estimates and manual journal tools.

## Two honest paths

1. Local reference/manual confirmation in `/nutrition`: select a JPEG/PNG/WebP photo under 10 MB, preview locally, search/select candidate foods or enter a regional/custom name, adjust ingredients/grams/nutrients, then explicitly confirm the diary entry. This is manual review, not AI recognition. Unknown composition remains blank. Delete local photo revokes the object URL; no server image was created.
2. Existing AI photo tools: explicit provider-transfer consent precedes inference. Without consent the original workspace keeps the preview local, blocks logging stale estimates and offers manual selection. Users may analyze the selected photo only after opting in. Existing configured inference is retained; no new paid provider is added. Real backend photo API calls require `consent=true` before transfer.

Uploads sent to the backend retain the existing MIME/size/Pillow format and pixel-count checks. Unsupported, missing and invalid images fail clearly. Provider failures do not substitute sample results. Multiple food components/possible catalog matches can be reviewed manually. Photos do not measure exact mass or reveal hidden ingredients; manual corrections/source labels are mandatory parts of the flow. Photo responses do not assert inferred allergens. Existing score heuristics/helpers are not clinical/allergen verification.

Camera permission/lifecycle tests remain in the regression suite. Native file input capture hints may offer a camera on supported phones; barcode live camera remains available. Camera permission, autoplay recovery, cleanup, duplicate detection and invalid input paths retain their earlier tests. No new physical-camera detection/AI accuracy claim is made.

## Deletion and retention

Local images never leave the browser in the manual path. The existing web inference relay is stateless with respect to image files but submits consented bytes to its configured provider, whose retention terms remain a release-review item. Existing backend stored photos can be deleted through authenticated DELETE `/api/v1/scan/images/{id}`: owner filter, resolved-root/filename guard and physical file removal; metadata is marked deleted. Scan/review records remain under the existing account-retention policy. No arbitrary filesystem path can be submitted for deletion.

Tests cover explicit no-transfer default, consented request handling, unsupported uploads, failure/stale-result behavior, manual confirmation, correction, local deletion, stored-image ownership/path checks and byte validation inherited from prior phases. Live acceptance used a synthetic local reference, not a measured recognition benchmark; zero inference calls were made. Physical hardware coverage, calibrated confidence, hidden ingredients and provider-side erasure are not certified.

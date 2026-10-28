# On-device pose architecture

28 October 2026. [Official MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) informed the pinned implementation. No cloud inference service.

## Flow

Explicit Enable camera → browser permission (`audio:false`) → muted playsInline video → lazy service/worker → same-origin WASM and Lite model → one transferred ImageBitmap at a time → transient landmarks → confidence/analyzer/state machine → UI counters. Only an explicitly confirmed aggregate summary reaches the existing authenticated workout API.

`PoseDetectionService` owns stream, initialization cancellation, model/frame watchdogs, timer, worker and video reference. Late permission results are stopped if navigation/cancel has invalidated the generation. Playback/model/frame errors stop the stream and worker. Track-ended, pause, immediate-stop, session end, hidden-tab/pagehide, unmount/account navigation all shut down resources. Resume reacquires the camera through an explicit action. No automatic page-load camera/model initialization.

## Runtime and scheduling

`@mediapipe/tasks-vision@1.2.0`, pose_landmarker_lite/float16/1, runningMode VIDEO, CPU delegate, up to two poses so crowd frames can be rejected. Detection/presence/tracking initialization thresholds .6; counting needs minimum relevant landmark visibility/presence .65. Classic worker supports the package's WASM script loader; actual runtime tests caught and resolved module-worker incompatibility.

640×480 maximum frame size, preserving source aspect ratio. Camera preference 15 fps (max 24), inference sampling about 10 Hz, one in flight and duplicate video timestamps skipped. An in-memory 16×12 brightness sample helps identify very dark scenes where OffscreenCanvas exists. Synchronous model inference stays in the worker; frame transfer and tiny brightness sampling remain on main thread. No segmentation mask, image serialization or landmarks are saved.

If inference exceeds 180 ms, interval increases to 250 ms. Sustained slow processing (20 slow responses) shuts down tracking with manual fallback. Initialization timeout 45 seconds; unanswered-frame watchdog 12 seconds. Stop terminates the worker/WASM state rather than awaiting an unresponsive model. OS/browser memory/thermal/battery behavior still needs physical-device testing. WebGPU/GPU is not assumed.

## Capability/support policy

Requires HTTPS/localhost, getUserMedia, Worker, createImageBitmap and working WASM. Test evidence: installed Windows Chromium desktop, real local model on blank/public-person static images; synthetic camera/poses in that browser; emulated mobile/tablet layouts. Capability failure, blocked permission, missing assets, busy/disconnected camera and slow devices offer manual workouts. No blanket mobile/browser support certification. No live phone/tablet test was available.

See phase4-model-performance.json and phase4-model-photo-performance.json for measured observations. Static-image inference and emulated layouts are not rep-accuracy or physical-phone benchmarks. Tests should be rerun on actual Safari/iOS, Android Chrome and lower-memory devices before naming them supported.

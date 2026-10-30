# Bake-off bench (tools/bench). Needs the app running at BASE_URL against a *test* database.
# Measure from a frozen checkout: export BENCH_REPO, and API_URL if not the default (docs/bench/METHOD.md).
# Windows: make is not installed by default — `winget install ezwinports.make`, or run the node commands directly.
LABEL ?= A
BASE_URL ?= http://127.0.0.1:3005

.PHONY: bench bench-quick bench-compare bench-install

bench-install:
	cd tools/bench && npm ci

bench:
	cd tools/bench && LABEL=$(LABEL) BASE_URL=$(BASE_URL) node bench.mjs

bench-quick:
	cd tools/bench && QUICK=1 LABEL=$(LABEL) BASE_URL=$(BASE_URL) node bench.mjs

bench-compare:
	cd tools/bench && A=$(A) B=$(B) node compare.mjs

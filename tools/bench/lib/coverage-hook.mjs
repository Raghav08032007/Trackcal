// Loaded with NODE_OPTIONS=--import so the app's own Vitest (and its workers) can find @vitest/coverage-v8,
// which is installed only in tools/bench: the app's package.json and node_modules stay untouched.
import {register} from 'node:module';
register('./coverage-resolve.mjs', import.meta.url);

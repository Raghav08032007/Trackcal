import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, oxc: { jsx: { runtime: "automatic" } }, test: { environment: "jsdom", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], setupFiles: ["./tests/setup.ts"], restoreMocks: true, maxWorkers: 1, testTimeout: 20000 } });

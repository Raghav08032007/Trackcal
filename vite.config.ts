import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// The Flask API serves both the browser routes (/api/*) and the versioned API (/api/v1/*).
// The dev proxy keeps the browser's Host header so cookie sessions and origin checks behave as in production.
const api = process.env.TRACKCAL_API_URL || "http://127.0.0.1:8000";
// The production Content Security Policy, read from the Caddyfile so the preview (and browser tests) run under it.
const csp = /header Content-Security-Policy "([^"]+)"/.exec(readFileSync(new URL("./Caddyfile", import.meta.url), "utf8"))![1];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000, strictPort: true, proxy: { "/api": { target: api }, "/uploads": { target: api } } },
  preview: { host: "127.0.0.1", port: 3000, strictPort: true, headers: { "Content-Security-Policy": csp, "Cross-Origin-Opener-Policy": "same-origin-allow-popups" }, proxy: { "/api": { target: api }, "/uploads": { target: api } } },
  build: { outDir: "dist", sourcemap: false },
});

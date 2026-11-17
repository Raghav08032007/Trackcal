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

/** Page speed (Phase I): the app's stylesheet is preloaded rather than render-blocking, so the static first screen in index.html
 *  (styled by the tiny /shell.css) paints at once. src/main.tsx attaches the stylesheet and waits for it before React draws, so
 *  nothing is ever shown unstyled. Done here because the security policy forbids the usual inline onload swap. */
const appStylesheetPreload = {
  name: "trackcal-app-stylesheet-preload",
  apply: "build" as const,
  transformIndexHtml: { order: "post" as const, handler: (html: string) => html.replace(/<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/, '<link rel="preload" as="style" crossorigin href="$1" data-app-css>') },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), appStylesheetPreload],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000, strictPort: true, proxy: { "/api": { target: api }, "/uploads": { target: api } } },
  preview: { host: "127.0.0.1", port: 3000, strictPort: true, headers: { "Content-Security-Policy": csp, "Cross-Origin-Opener-Policy": "same-origin-allow-popups" }, proxy: { "/api": { target: api }, "/uploads": { target: api } } },
  // Fonts stay as files: the security policy allows fonts from this site only, not inline data: URLs.
  build: { outDir: "dist", sourcemap: false, assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined) },
});

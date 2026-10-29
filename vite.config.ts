import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The Flask API serves both the browser routes (/api/*) and the versioned API (/api/v1/*).
// The dev proxy keeps the browser's Host header so cookie sessions and origin checks behave as in production.
const api = process.env.TRACKCAL_API_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000, strictPort: true, proxy: { "/api": { target: api }, "/uploads": { target: api } } },
  preview: { host: "127.0.0.1", port: 3000, strictPort: true, proxy: { "/api": { target: api }, "/uploads": { target: api } } },
  build: { outDir: "dist", sourcemap: false },
});

// Size budget, checked after every build (npm "postbuild"): what a phone downloads before the first screen must stay
// small. Fails the build when a limit is passed, with the file and the limit. Raise a limit only on purpose, and note why.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const pub = fileURLToPath(new URL("../public/", import.meta.url));
const kb = bytes => Math.round(bytes / 1024);
const gz = file => gzipSync(readFileSync(file), { level: 9 }).length;

const html = readFileSync(join(dist, "index.html"), "utf8");
const entryJs = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map(m => m[1]);
const entryCss = [...html.matchAll(/<link[^>]+href="\/assets\/([^"]+\.css)"/g)].map(m => m[1]);
const preloaded = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map(m => m[1]);

// Limits in kB (gzip for code, file size for images), with some room above today's sizes.
const checks = [
  ["first-screen JavaScript (entry and preloaded modules, gzip)", [...new Set([...entryJs, ...preloaded])].reduce((sum, f) => sum + gz(join(dist, "assets", f)), 0), 185],   // 174 kB on 2026-11-19 (was ~215 before the lazy layout pieces)
  ["first-screen CSS (gzip)", entryCss.reduce((sum, f) => sum + gz(join(dist, "assets", f)), 0), 80],
];
for (const f of readdirSync(join(pub, "photos")).filter(f => f.endsWith(".webp"))) {
  const limit = f.includes("-640") ? 80 : f.includes("-800") ? 130 : 360;   // phones get 640 or 800; 1200 is for wide screens
  checks.push([`photos/${f}`, statSync(join(pub, "photos", f)).size, limit]);
}
for (const f of readdirSync(join(pub, "characters")).filter(f => f.endsWith("-256.webp"))) checks.push([`characters/${f}`, statSync(join(pub, "characters", f)).size, 25]);

let failed = 0;
for (const [name, bytes, limit] of checks) {
  if (kb(bytes) > limit) { failed++; console.error(`size budget: ${name} is ${kb(bytes)} kB, over the ${limit} kB limit`); }
}
const [js, css] = checks;
console.log(`size budget: first-screen JS ${kb(js[1])}/${js[2]} kB, CSS ${kb(css[1])}/${css[2]} kB, ${checks.length - 2} images checked${failed ? `, ${failed} over` : ", all within limits"}`);
if (failed) process.exit(1);

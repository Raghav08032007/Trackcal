// Lists the source files a set of pages pulls in (following local imports) that are not yet in the translation coverage list,
// largest first, so a screen can be translated file by file.
//   node scripts/i18n/screens.mjs src/app/workouts/page.tsx src/app/workouts/camera/page.tsx ...
import fs from "node:fs";
import path from "node:path";

const coverage = fs.readFileSync("src/lib/i18n/coverage.ts", "utf8");
const resolve = (from, spec) => {
  const base = spec.startsWith("@/") ? "src/" + spec.slice(2) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".tsx", ".ts", "/index.ts"]) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p.split(path.sep).join("/");
  }
  return null;
};
const seen = new Set(), queue = process.argv.slice(2);
while (queue.length) {
  const file = queue.shift();
  if (seen.has(file)) continue;
  seen.add(file);
  for (const m of fs.readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
    const next = resolve(file, m[1]);
    if (next && !next.includes("/i18n/") && !next.endsWith(".css")) queue.push(next);
  }
}
const rows = [...seen].filter(f => !coverage.includes(`"${f}"`)).map(f => [fs.readFileSync(f, "utf8").split("\n").length, f]).sort((a, b) => b[0] - a[0]);
console.log(`${rows.length} files, ${rows.reduce((s, r) => s + r[0], 0)} lines`);
for (const [lines, f] of rows) console.log(lines, f);

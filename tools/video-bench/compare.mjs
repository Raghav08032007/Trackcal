// Compare video-bench reports from different pose models (lite / full / heavy) on the same videos.
// Usage: node tools/video-bench/compare.mjs report-lite.json report-full.json report-heavy.json
// Count accuracy uses only videos without an angle mistake (as in the bench report): exact, within ±1, mean error.
import {readFileSync} from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
const rows = files.map(f => {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  const counted = r.results.filter(x => x.truth != null && !x.mistake);
  const err = counted.map(x => Math.abs((x.reps ?? 0) - x.truth));
  const seen = r.results.reduce((n, x) => n + (x.seen || 0), 0), frames = r.results.reduce((n, x) => n + (x.frames || 0), 0);
  const caught = r.results.filter(x => x.mistake).map(x => !!x.caught);
  const alarms = r.results.filter(x => !x.mistake).reduce((n, x) => n + (x.falseAlarms || 0), 0);
  const worst = counted.map((x, i) => [err[i], x.file]).filter(([e]) => e > 1).map(([e, f]) => `${f} (${e > 0 ? '±' + e : e})`);
  return {
    model: r.variant || path.basename(f), videos: counted.length,
    exact: Math.round(100 * err.filter(e => e === 0).length / err.length),
    within1: Math.round(100 * err.filter(e => e <= 1).length / err.length),
    meanErr: (err.reduce((a, b) => a + b, 0) / err.length).toFixed(2),
    tracked: Math.round(100 * seen / frames),
    mistakesCaught: caught.length ? `${caught.filter(Boolean).length}/${caught.length}` : '-',
    falseAlarms: alarms, worst,
  };
});
console.log('| Model | Videos | Exact | Within ±1 | Mean error | Frames tracked | Mistakes caught | False alarms |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.model} | ${r.videos} | ${r.exact}% | ${r.within1}% | ${r.meanErr} | ${r.tracked}% | ${r.mistakesCaught} | ${r.falseAlarms} |`);
for (const r of rows) if (r.worst.length) console.log(`\n${r.model} off by more than 1: ${r.worst.join(', ')}`);

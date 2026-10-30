// make bench-compare A=A B=B
// Reads docs/bench/results/<A>/summary.json and <B>/summary.json, re-scores both with the frozen formulas,
// and writes docs/bench/results/COMPARE-<A>-vs-<B>.md plus a JSON diff.
import path from 'node:path';
import fs from 'node:fs/promises';
import {readJson, resultsDir, ROOT, writeJson} from './lib/common.mjs';
import {score, WEIGHTS} from './lib/scorecard.mjs';

const A = process.env.A || process.argv[2], B = process.env.B || process.argv[3];
if (!A || !B) { console.error('Usage: make bench-compare A=<label> B=<label>'); process.exit(2); }
const load = async label => {
  const s = await readJson(path.join(resultsDir(label), 'summary.json'), null);
  if (!s) { console.error(`FAILED: no results for ${label}. Run "make bench LABEL=${label}" first.`); process.exit(1); }
  return {...s, scorecard: score(s)};
};
const a = await load(A), b = await load(B);
// A difference under the measured spread is reported as "no clear difference", never as a win.
const TIE = 2;
const delta = (x, y) => x === null || x === undefined || y === null || y === undefined ? 'n/a' : `${y - x >= 0 ? '+' : ''}${Math.round((y - x) * 10) / 10}`;
const gatesPass = s => Object.values(s.scorecard.gates).every(v => v === true);
let verdict;
if (!gatesPass(a) && !gatesPass(b)) verdict = 'Neither version passes every hard gate: no winner.';
else if (!gatesPass(b)) verdict = `${B} fails a hard gate, so ${A} stays (whatever the score).`;
else if (!gatesPass(a)) verdict = `${A} fails a hard gate; ${B} passes them all and wins.`;
else if (Math.abs(b.scorecard.total - a.scorecard.total) < TIE) verdict = `No clear difference (${a.scorecard.total} vs ${b.scorecard.total}, under ${TIE} points).`;
else verdict = `${b.scorecard.total > a.scorecard.total ? B : A} wins (${a.scorecard.total} vs ${b.scorecard.total}).`;

const ja = Object.fromEntries((a.journeys?.summary || []).map(j => [j.journey, j])), jb = Object.fromEntries((b.journeys?.summary || []).map(j => [j.journey, j]));
const ids = [...new Set([...Object.keys(ja), ...Object.keys(jb)])].sort();
const unreliable = ids.filter(id => ja[id]?.seconds.unreliable || jb[id]?.seconds.unreliable);
const lines = [`# ${A} vs ${B}`, '', `Generated ${new Date().toISOString().slice(0, 16)}Z from summary.json files; formulas in docs/bench/SCORECARD.md.`, '',
  `**Verdict:** ${verdict}`, '', '## Scorecard', '', `| Category | Weight | ${A} | ${B} | Δ |`, '|---|---|---|---|---|',
  ...Object.entries(WEIGHTS).map(([k, w]) => `| ${k} | ${w} | ${a.scorecard.categories[k] ?? 'n/a'} | ${b.scorecard.categories[k] ?? 'n/a'} | ${delta(a.scorecard.categories[k], b.scorecard.categories[k])} |`),
  `| **Total** | 100 | **${a.scorecard.total}** | **${b.scorecard.total}** | ${delta(a.scorecard.total, b.scorecard.total)} |`, '',
  '## Hard gates', '', `| Gate | ${A} | ${B} |`, '|---|---|---|', ...Object.keys(a.scorecard.gates).map(g => `| ${g} | ${fmt(a.scorecard.gates[g])} | ${fmt(b.scorecard.gates[g])} |`), '',
  '## Journeys (medians)', '', `| Journey | Taps ${A} → ${B} | Keys | Seconds | Max interaction ms | Success |`, '|---|---|---|---|---|---|',
  ...ids.map(id => { const x = ja[id], y = jb[id]; return `| ${id} ${(x || y).title} | ${x?.taps.median ?? '-'} → ${y?.taps.median ?? '-'} | ${x?.keystrokes.median ?? '-'} → ${y?.keystrokes.median ?? '-'} | ${x?.seconds.median ?? '-'} → ${y?.seconds.median ?? '-'} | ${x?.maxInteractionMs.median ?? '-'} → ${y?.maxInteractionMs.median ?? '-'} | ${pct(x)} → ${pct(y)} |`; }), '',
  unreliable.length ? `⚠ Spread over 15% on ${unreliable.join(', ')}: treat those time differences as noise.` : 'All journey timings were within the 15% spread limit.', '',
  '## Detail scores', '', `| Criterion | ${A} | ${B} |`, '|---|---|---|',
  ...['visual', 'perf', 'maint'].flatMap(group => Object.keys(a.scorecard.details[group]).map(k => `| ${group}.${k} | ${a.scorecard.details[group][k] ?? 'n/a'} | ${b.scorecard.details[group][k] ?? 'n/a'} |`)), '',
  '## Run settings', '', `- ${A}: ${a.meta?.base} · ${a.meta?.quick ? 'QUICK' : `${a.meta?.runs} runs`} · ${a.meta?.finished}`, `- ${B}: ${b.meta?.base} · ${b.meta?.quick ? 'QUICK' : `${b.meta?.runs} runs`} · ${b.meta?.finished}`,
  a.meta?.quick || b.meta?.quick ? '\n⚠ A QUICK run is not a valid comparison; rerun both without QUICK.' : '', ''];
const out = path.join(ROOT, 'docs/bench/results', `COMPARE-${A}-vs-${B}.md`);
await fs.writeFile(out, lines.join('\n'));
await writeJson(path.join(ROOT, 'docs/bench/results', `COMPARE-${A}-vs-${B}.json`), {verdict, a: a.scorecard, b: b.scorecard});
console.log(verdict); console.log(`Wrote ${path.relative(ROOT, out)}`);

function fmt(v) { return v === null ? 'NOT MEASURED' : v ? 'PASS' : '**FAIL**'; }
function pct(j) { return j ? `${Math.round(j.successRate * 100)}%` : '-'; }

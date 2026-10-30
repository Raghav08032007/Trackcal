// make bench LABEL=A BASE_URL=http://127.0.0.1:3005
// Runs everything and writes docs/bench/results/<LABEL>/ (JSON per area, summary.json, SUMMARY.md).
// PARTS=journeys,screens,perf,load,code limits the run; QUICK=1 is 1 run on 2 devices (for checking the harness).
// PARTS=report measures nothing: it re-summarizes the saved raw journey rows and rebuilds summary.json and SUMMARY.md.
import path from 'node:path';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config, context, launch, loginState, preflight, readJson, resultsDir, ROOT, seed, writeJson} from './lib/common.mjs';
import {runJourneys, summarize} from './lib/journeys.mjs';
import {runScreens} from './lib/screens.mjs';
import {runLighthouse, runLoad} from './lib/perf.mjs';
import {runCodeHealth} from './lib/codehealth.mjs';
import {score} from './lib/scorecard.mjs';

const parts = (process.env.PARTS || 'journeys,screens,perf,load,code').split(',');
const dir = resultsDir(); await fs.mkdir(dir, {recursive: true});
const started = new Date();
console.log(`Bench ${config.label} against ${config.base} (${config.quick ? 'QUICK' : 'full'}: ${config.runs} run(s))`);
// What is being measured, pinned: both commits, whether either tree has edits, and the served build.
async function provenance() {
  const git = (...a) => spawnSync('git', a, {cwd: config.repo, encoding: 'utf8'}).stdout.trim();
  const web = path.join(config.repo, 'frontend/web'), dist = await fs.stat(path.join(web, 'dist/index.html')).catch(() => null);
  const dirty = c => spawnSync('git', ['-C', c, 'status', '--short', '--', ':!docs'], {encoding: 'utf8'}).stdout.trim().split(/\r?\n/).filter(l => l &&!/\sfrontend\/web$/.test(l));
  return {repo: config.repo, commit: git('rev-parse', 'HEAD'), webCommit: spawnSync('git', ['-C', web, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).stdout.trim(), dirty: [...dirty(config.repo), ...dirty(web)], builtAt: dist?.mtime.toISOString() ?? null};
}
const stop = why => { console.error(`
BENCH FAILED: ${why}`); process.exit(1); };
const reportOnly = parts.length === 1 && parts[0] === 'report';
if (reportOnly) {
  const j = await readJson(path.join(dir, 'journeys.json'), null);
  if (j) { const {journeys} = await import(`./journeys/${config.label}.mjs`).catch(() => import('./journeys/A.mjs')); await writeJson(path.join(dir, 'journeys.json'), {...j, summary: summarize(j.rows, journeys.filter(x => j.rows.some(r => r.journey === x.id)))}); }
} else {
const pinned = await provenance();
if (config.label === 'A') {
  const tag = (c, t) => spawnSync('git', ['-C', c, 'rev-parse', t], {encoding: 'utf8'}).stdout.trim();
  if (pinned.commit !== tag(config.repo, 'legacy-baseline^{commit}') || pinned.webCommit !== tag(path.join(config.repo, 'frontend/web'), 'legacy-baseline^{commit}')) stop(`Version A must be measured at the legacy-baseline tag; ${config.repo} is at ${pinned.commit.slice(0, 8)} / ${pinned.webCommit.slice(0, 8)}. Set BENCH_REPO to a frozen worktree.`);
}
if (pinned.dirty.length) stop(`the checkout under test has uncommitted changes: ${pinned.dirty.slice(0, 5).join('; ')}`);
await writeJson(path.join(dir, 'provenance.json'), pinned);
await preflight();
const account = seed();
console.log(`Seeded ${account.meals} meals, ${account.workouts} workouts for ${account.email}`);

const browser = await launch();
try {
  if (parts.includes('journeys')) { console.log('Journeys…'); await writeJson(path.join(dir, 'journeys.json'), await runJourneys(browser)); }
  if (parts.includes('screens')) { console.log('Screens…'); await writeJson(path.join(dir, 'screens.json'), await runScreens(browser)); }
  if (parts.includes('perf')) { console.log('Lighthouse…'); await writeJson(path.join(dir, 'lighthouse.json'), await runLighthouse(browser, seed())); }
  if (parts.includes('load')) { console.log('Load test…'); await writeJson(path.join(dir, 'load.json'), await runLoad(seed())); }
  if (parts.includes('habit')) await writeJson(path.join(dir, 'habit.json'), await habitLoop(browser));
} finally { await browser.close(); }
if (parts.includes('code')) { console.log('Code health (runs both test suites)…'); await writeJson(path.join(dir, 'codehealth.json'), await runCodeHealth()); }
if (!parts.includes('habit')) { const b = await launch(); try { await writeJson(path.join(dir, 'habit.json'), await habitLoop(b)); } finally { await b.close(); } }
const after = await provenance();
if (JSON.stringify(after) !== JSON.stringify(pinned)) stop(`the code under test changed during the run, so these results are not valid.
  before: ${JSON.stringify(pinned)}
  after:  ${JSON.stringify(after)}`);
}

const results = await collect(config.label);
await writeJson(path.join(dir, 'summary.json'), {...results, scorecard: score(results), meta: {provenance: await readJson(path.join(dir, 'provenance.json'), null), label: config.label, base: config.base, quick: config.quick, runs: config.runs, started: started.toISOString(), finished: new Date().toISOString()}});
await fs.writeFile(path.join(dir, 'SUMMARY.md'), report(results, score(results)));
console.log(`\nDone: ${path.relative(ROOT, dir)}/SUMMARY.md`);

/** Habit-loop features, each with the evidence that decided it. */
async function habitLoop(browser) {
  const acc = seed(); const state = await loginState(browser, acc, path.join(ROOT, `tools/bench/.state-${config.label}.json`));
  const ctx = await context(browser, 'desktop-1280', {storageState: state, today: acc.today}); const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const text = async route => { await page.goto(config.base + route); await page.locator('main').first().waitFor(); await page.waitForLoadState('networkidle').catch(() => {}); return page.locator('main').innerText(); };
  const j = (await readJson(path.join(dir, 'journeys.json'), {summary: []})).summary;
  const journey = id => j.find(x => x.journey === id);
  const out = [
    {feature: 'Quick re-log from favourites or recents', present: !!journey('J3')?.success, evidence: 'J3 succeeded'},
    {feature: "Today's summary within 2 taps", present: !!journey('J7')?.success && journey('J7').taps.median <= 2, evidence: `J7 taps median ${journey('J7')?.taps.median}`},
    {feature: 'Repeat yesterday', present: /Copy yesterday/i.test(await text('/nutrition')), evidence: '"Copy yesterday\'s meals" on the diary'},
    {feature: 'Streaks / XP feedback', present: /\bXP\b|streak/i.test(await text('/play')), evidence: '/play mentions XP or streaks'},
    {feature: 'Companion encouragement', present: /on your team|companion/i.test(await text('/')), evidence: 'Home shows the companion'},
    {feature: 'Reminders', present: /remind/i.test(await text('/routine')), evidence: '/routine has reminders (push itself is behind a flag)'},
    {feature: 'Works offline for logging', present: !!journey('J5')?.success, evidence: 'Water and the journal are stored on the device (J5)'},
  ];
  await ctx.close(); return out;
}

async function collect(label) {
  const d = resultsDir(label);
  const screens = await readJson(path.join(d, 'screens.json'), null);
  const distinct = {}, usage = {};
  for (const a of Object.values(screens?.audits || {})) for (const [k, values] of Object.entries(a.tokens)) for (const [v, n] of Object.entries(values)) { usage[k] = usage[k] || {}; usage[k][v] = (usage[k][v] || 0) + n; }
  for (const [k, values] of Object.entries(usage)) distinct[k] = Object.keys(values).length;
  return {journeys: await readJson(path.join(d, 'journeys.json'), null), screens, tokens: {distinct, top: Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, 12)]))},
          perf: {lighthouse: await readJson(path.join(d, 'lighthouse.json'), null), load: await readJson(path.join(d, 'load.json'), null)},
          codehealth: await readJson(path.join(d, 'codehealth.json'), null), habit: await readJson(path.join(d, 'habit.json'), null)};
}

function report(r, s) {
  const lines = [`# Bench results: Version ${config.label}`, '', `${config.base} · ${config.quick ? 'QUICK (1 run, 2 devices)' : `${config.runs} runs`} · ${new Date().toISOString().slice(0, 16)}Z`, '',
    `## Score: ${s.total} / 100`, '', '| Category | Weight | Score |', '|---|---|---|', ...Object.entries(s.weights).map(([k, w]) => `| ${k} | ${w} | ${s.categories[k] ?? 'n/a'} |`), '',
    '## Hard gates', '', ...Object.entries(s.gates).map(([k, v]) => `- ${k}: ${v === null ? 'NOT MEASURED' : v ? 'PASS' : '**FAIL**'}`), '', '## Journeys (median of successful runs)', '',
    '| Journey | Success | Taps | Keys | Seconds | Spread | Max interaction ms | Notes |', '|---|---|---|---|---|---|---|---|',
    ...(r.journeys?.summary || []).map(j => `| ${j.journey} ${j.title} | ${Math.round(j.successRate * 100)}% | ${j.taps.median ?? '-'} | ${j.keystrokes.median ?? '-'} | ${j.seconds.median ?? '-'} | ${j.seconds.spread ?? '-'}${j.seconds.unreliable ? ' ⚠' : ''} | ${j.maxInteractionMs.median ?? '-'} | ${[j.note, ...j.failures].filter(Boolean).join('; ').replace(/\|/g, '/')} |`), ''];
  const lh = r.perf?.lighthouse; if (lh) lines.push('## Lighthouse (mobile, median)', '', '| Screen | Score | LCP ms | CLS | TBT ms |', '|---|---|---|---|---|', ...Object.entries(lh).map(([p, x]) => `| ${p} | ${x.score.median} | ${Math.round(x.lcpMs.median)} | ${x.cls.median} | ${Math.round(x.tbtMs.median)} |`), '');
  const ld = r.perf?.load; if (ld) lines.push('## API load (50 connections)', '', '| Endpoint | p50 ms | p95 ms (≤) | Errors | 429 |', '|---|---|---|---|---|', ...Object.entries(ld).map(([p, x]) => `| ${p} | ${x.p50Ms.median} | ${x.p95Ms.median} | ${Math.round(x.errorRate.median * 1000) / 10}% | ${Math.round(x.rateLimitedShare.median * 1000) / 10}% |`), '');
  if (r.screens) {
    const axe = Object.values(r.screens.axe).flat(); const contrast = Object.values(r.screens.audits).flatMap(a => a.contrast);
    lines.push('## Screens, accessibility and tokens', '', `- Screenshots: ${r.screens.manifest.length}; unreachable: ${r.screens.unreachable.length} (see screens.json)`, `- axe violations: ${axe.length} (${axe.filter(v => ['serious', 'critical'].includes(v.impact)).length} serious/critical)`,
      `- Text contrast failures: ${contrast.length} elements, ${s.details.contrastPairs} distinct colour pairs`, `- Distinct values: ${Object.entries(r.tokens.distinct).map(([k, v]) => `${k} ${v}`).join(', ')}`,
      `- Keyboard traps: ${Object.values(r.screens.keyboard).filter(k => k.trapped).length}; 200% zoom horizontal scroll on ${Object.values(r.screens.zoom).filter(z => z.horizontalScroll > 0).length} screens`,
      `- Animations still running with reduced motion: ${Object.values(r.screens.motion).reduce((a, m) => a + (m.reduced?.length || 0), 0)}`, `- Hindi/Tamil: ${JSON.stringify(r.screens.fonts)}`, '');
  }
  const c = r.codehealth; if (c) lines.push('## Code health', '', `- App code: ${c.size.appFiles} files, ${c.size.appLines} lines; ${c.size.over400.length} files over 400 lines`, `- Duplication: ${c.duplication.percentage}%`, `- Functions with complexity > 15: ${c.complexity.over15}`,
    `- TypeScript any: ${c.typeEscapes.any}, ts-ignore: ${c.typeEscapes.tsIgnore}`, `- Coverage: backend ${c.coverage.backendLinePct}%, web ${c.coverage.webLinePct}%; tests backend ${c.coverage.backendTests.passed} passed / ${c.coverage.backendTests.failed} failed, web ${c.coverage.webTests.passed} / ${c.coverage.webTests.failed}`,
    `- Add-a-field experiment: ${c.addField?.appFiles} app files + ${c.addField?.testFiles} tests`, '');
  if (r.habit) lines.push('## Habit loop', '', ...r.habit.map(h => `- ${h.present ? '✔' : '✘'} ${h.feature} (${h.evidence})`), '');
  return lines.join('\n');
}

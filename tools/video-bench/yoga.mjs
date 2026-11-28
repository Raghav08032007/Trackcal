// Yoga camera test on rendered video: the 3D coach holds each asana on camera, and the recording goes through the same pose
// model and scorer as the yoga page. No real people. Measures, per asana, the median match score (0-100) the scorer gives
// a correct pose as seen by the camera, and how often that asana is also the closest of all 41.
//
//   node tools/video-bench/yoga.mjs [out folder] [--models f,m] [--turns 0,20] [--secs 5] [--only vrikshasana] [--score-only]
//
// Videos go to videos/yoga (git-ignored). Writes report.md and report.json there.
import {mkdirSync, renameSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {config, chromium} from '../bench/lib/common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), WEB = path.join(ROOT, 'frontend/web'), PORT = 3012;
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? path.join(ROOT, 'videos/yoga'));
const models = opt('models', 'f,m').split(','), turns = opt('turns', '0').split(',').map(Number), secs = Number(opt('secs', '5')), only = opt('only', '');
const scoreOnly = args.includes('--score-only');
mkdirSync(out, {recursive: true});

const {createServer} = await import(pathToFileURL(path.join(WEB, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({root: WEB, configFile: path.join(WEB, 'vite.config.ts'), server: {port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: {ignored: ['**/*']}}, logLevel: 'error'});
await server.listen();
const base = `http://127.0.0.1:${PORT}`;
try {
  // The asana ids, read from the app itself so the list never drifts.
  const meta = await chromium.launch({executablePath: config.chrome, headless: true});
  const mp = await meta.newPage(); await mp.goto(`${base}/video-bench.html`); await mp.waitForFunction(() => 'runYoga' in window, null, {timeout: 120000});
  const all = await mp.evaluate(async () => (await import('/src/lib/yoga/asanas.ts')).ASANAS.map(a => ({id: a.id, view: a.view, family: a.family})));
  await meta.close();
  const asanas = all.filter(a => !only || only.split(',').includes(a.id));

  if (!scoreOnly) {
    const browser = await chromium.launch({executablePath: config.chrome, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
    try {
      for (const a of asanas) for (const model of models) for (const turn of turns) {
        const name = `${a.id}_${model}_t${turn}.webm`;
        if (existsSync(path.join(out, name))) { console.log(`have ${name}`); continue; }
        const ctx = await browser.newContext({viewport: {width: 640, height: 480}, recordVideo: {dir: out, size: {width: 640, height: 480}}});
        const page = await ctx.newPage();
        await page.goto(`${base}/avatar-stage.html?asana=${a.id}&secs=${secs}&reps=1&turn=${turn}&model=${model}`);
        await page.waitForFunction(() => window.stage?.done || document.title === 'avatar failed', null, {timeout: 180000});
        const failed = (await page.title()) === 'avatar failed', video = page.video();
        await ctx.close();
        if (failed) { console.log(`${name}: the 3D coach could not load`); continue; }
        renameSync(await video.path(), path.join(out, name)); console.log(`recorded ${name}`);
      }
    } finally { await browser.close(); }
  }

  const browser = await chromium.launch({executablePath: config.chrome, headless: true});
  try {
    const page = await browser.newPage();
    await page.route('**/bench-video/**', route => route.fulfill({path: path.join(out, decodeURIComponent(route.request().url().split('/bench-video/')[1]))}));
    await page.goto(`${base}/video-bench.html`); await page.waitForFunction(() => 'runYoga' in window, null, {timeout: 120000});
    const files = readdirSync(out).filter(f => f.endsWith('.webm') && asanas.some(a => f.startsWith(a.id + '_')));
    const results = [];
    for (const file of files) {
      const asana = asanas.filter(a => file.startsWith(a.id + '_')).sort((x, y) => y.id.length - x.id.length)[0];
      process.stdout.write(`${file} … `);
      const [r] = await page.evaluate(items => window.runYoga(items), [{url: '/bench-video/' + encodeURIComponent(file), asana: asana.id, fps: 6}]);
      delete r.scores; results.push({file, family: asana.family, view: asana.view, ...r});
      console.log(r.error ? `error: ${r.error}` : `median ${r.median}/100, recognised ${r.recognised}/${r.seen} (seen ${r.seen}/${r.frames})`);
    }
    writeFileSync(path.join(out, 'report.json'), JSON.stringify(results, null, 1));
    writeFileSync(path.join(out, 'report.md'), report(results));
    console.log('\n' + report(results));
  } finally { await browser.close(); }
} finally { await server.close(); }

function report(rs) {
  const ok = rs.filter(r => !r.error), pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const lines = ['# Yoga camera test (rendered 3D coach)', '', `${rs.length} videos; pose model: full; 6 frames a second.`, '',
    '| Kind | Videos | Median match | Videos scoring 70+ | Right asana closest (frames) | Body seen (frames) |', '|---|---|---|---|---|---|'];
  const groups = {};
  for (const r of ok) (groups[r.family] ??= []).push(r);
  const row = (name, g) => `| ${name} | ${g.length} | ${median(g.map(r => r.median))} | ${g.filter(r => r.median >= 70).length}/${g.length} | ${pct(sum(g, 'recognised'), sum(g, 'seen'))} % | ${pct(sum(g, 'seen'), sum(g, 'frames'))} % |`;
  for (const [k, g] of Object.entries(groups).sort()) lines.push(row(k, g));
  lines.push(row('**All**', ok), '', '## Each video', '', '| Video | Median match | Right asana closest | Most often mistaken for |', '|---|---|---|---|');
  for (const r of rs) lines.push(`| ${r.file} | ${r.error ? 'error: ' + r.error : r.median} | ${r.recognised}/${r.seen} | ${Object.entries(r.confusedWith ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => `${k} (${n})`).join(', ') || '–'} |`);
  return lines.join('\n') + '\n';
}
function sum(g, k) { return g.reduce((a, r) => a + (r[k] ?? 0), 0); }
function median(xs) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }

// Video bench: how well the camera coach counts and coaches on real recordings.
//
//   node tools/video-bench/run.mjs <folder> [--fps 15] [--lite]
//
// Name each video  <exercise>_<reps>reps[_<mistake>][_anything].mp4   e.g.  squat_10reps.mp4, kickback_8reps_upright_phone2.mp4
//   exercise: the camera exercise id (squat, pushup, kickback, overhead ... as in ?exercise= on the camera page)
//   mistake (optional, what you did wrong on purpose): bad (any form fix counts), shallow, fast, facing (side-only move filmed from the front),
//            side (front-only move filmed side-on), elbow-out (overhead), arm-swing (kickback), upright (rows/kickbacks),
//            body-swing (curls/presses/raises), or any live-coach key.
// Or put a labels.csv next to the videos:  file,exercise,reps,mistake
//
// Writes report.md and report.json into the folder. The videos never leave this computer and must never be committed.
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {config, chromium} from '../bench/lib/common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), WEB = path.join(ROOT, 'frontend/web');
const args = process.argv.slice(2), folder = path.resolve(args.find((a, i) => !a.startsWith('--') && !['--fps', '--only'].includes(args[i - 1])) ?? '');
const dump = args.includes('--dump'), only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const fps = Number(args[args.indexOf('--fps') + 1]) || 15, variant = args.includes('--lite') ? 'lite' : args.includes('--heavy') ? 'heavy' : 'full', PORT = 3010;
if (!existsSync(folder)) { console.error('Usage: node tools/video-bench/run.mjs <folder with videos>'); process.exit(1); }

const MISTAKE = {shallow: ['shallow'], half: ['shallow'], fast: ['too_fast'], facing: ['turn_side'], front: ['turn_side'], side: ['face_camera'],
  'elbow-out': ['elbow_up'], 'elbow-flare': ['elbow_up'], 'arm-swing': ['arm_tuck', 'still_elbows'], 'elbow-swing': ['arm_tuck', 'still_elbows'],
  bad: ['*'], upright: ['hinge'], 'no-hinge': ['hinge'], 'body-swing': ['swing'], swing: ['swing']};
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

function labels() {
  const csv = path.join(folder, 'labels.csv'), rows = [];
  if (existsSync(csv)) for (const line of readFileSync(csv, 'utf8').split(/\r?\n/).slice(1)) {
    const [file, exercise, reps, mistake] = line.split(',').map(s => s?.trim());
    if (file && exercise) rows.push({file, kind: exercise, truth: reps === '' || reps === undefined ? null : Number(reps), mistake: mistake || null});
  }
  const listed = new Set(rows.map(r => r.file));
  for (const file of readdirSync(folder).filter(f => VIDEO.test(f) && !listed.has(f))) {
    const m = /^([a-z]+)_(\d+)reps?(?:_([a-z-]+))?/i.exec(file);
    if (m) rows.push({file, kind: m[1].toLowerCase(), truth: Number(m[2]), mistake: m[3] && MISTAKE[m[3].toLowerCase()] ? m[3].toLowerCase() : null});
    else console.warn(`skipped ${file}: name it like squat_10reps.mp4 or list it in labels.csv`);
  }
  return rows;
}

const rows = labels().filter(r => !only || r.file.includes(only));
if (!rows.length) { console.error('No videos found.'); process.exit(1); }
const {createServer} = await import(pathToFileURL(path.join(WEB, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({root: WEB, configFile: path.join(WEB, 'vite.config.ts'), server: {port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: {ignored: ['**/*']}}, logLevel: 'error'});
await server.listen();
const browser = await chromium.launch({executablePath: config.chrome, headless: true});
try {
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.error('page:', m.text()); });
  await page.route('**/bench-video/**', route => route.fulfill({path: path.join(folder, ...route.request().url().split('/bench-video/')[1].split('/').map(decodeURIComponent))}));
  await page.goto(`http://127.0.0.1:${PORT}/video-bench.html`);
  await page.waitForFunction(() => 'runBench' in window, null, {timeout: 120000});
  const results = [];
  for (const row of rows) {
    process.stdout.write(`${row.file} … `);
    const encoded = row.file.split(/[\/]/).map(encodeURIComponent).join('/');
    const [r] = await page.evaluate(items => window.runBench(items), [{url: '/bench-video/' + encoded, kind: row.kind, fps, variant, dump}]);
    const wanted = row.mistake ? (MISTAKE[row.mistake] ?? [row.mistake]) : [];
    const fixes = r.said.filter(s => s.key !== 'better');
    const caught = wanted.includes('*') ? fixes.some(s => !['too_fast', 'too_slow', 'lost', 'step_in'].includes(s.key) && !s.key.startsWith('hidden_')) : wanted.length ? fixes.some(s => wanted.includes(s.key) || (s.key.startsWith('still_') && wanted.includes('still_elbows'))) : null;
    const falseAlarms = wanted.length ? 0 : fixes.filter(s => !['shallow', 'too_fast', 'too_slow', 'lost', 'different'].includes(s.key)).length;
    if (r.landmarks) { writeFileSync(path.join(folder, row.file + '.landmarks.json'), JSON.stringify(r.landmarks)); delete r.landmarks; }
    results.push({...row, ...r, caught, falseAlarms});
    console.log(r.error ? `error: ${r.error}` : `${r.reps}/${row.truth ?? '?'} reps [${Object.entries(r.rejections??{}).filter(([,n])=>n).map(([k,n])=>k+' '+n).join(', ')}${r.mismatches?.length?' | '+r.mismatches.join('; '):''}]${row.mistake ? `, mistake ${caught ? 'caught' : 'MISSED'}` : ''}${falseAlarms ? `, ${falseAlarms} false alarm(s)` : ''}`);
  }
  writeFileSync(path.join(folder, 'report.json'), JSON.stringify({fps, variant, results}, null, 1));
  writeFileSync(path.join(folder, 'report.md'), report(results));
  console.log(`\n${report(results)}\nWritten: ${path.join(folder, 'report.md')}`);
} finally { await browser.close(); await server.close(); }

function report(results) {
  const byKind = {};
  for (const r of results.filter(r => !r.error)) (byKind[r.kind] ??= []).push(r);
  const pct = (a, b) => b ? `${Math.round(100 * a / b)}` : '–';
  const lines = ['# Video bench', '', `${results.length} videos, ${fps} frames a second, ${variant} model.`, '',
    '| Exercise | Videos | Exact count | Within 1 rep | Mistakes caught | False alarms (clean videos) | Person seen |', '|---|---|---|---|---|---|---|'];
  for (const [kind, rs] of Object.entries(byKind).sort()) {
    const counted = rs.filter(r => r.truth !== null && !['facing', 'front', 'side'].includes(r.mistake)), mistakes = rs.filter(r => r.caught !== null), clean = rs.filter(r => r.caught === null);
    lines.push(`| ${kind} | ${rs.length} | ${pct(counted.filter(r => r.reps === r.truth).length, counted.length)} % | ${pct(counted.filter(r => Math.abs(r.reps - r.truth) <= 1).length, counted.length)} % | ${mistakes.length ? `${mistakes.filter(r => r.caught).length}/${mistakes.length}` : '–'} | ${clean.reduce((a, r) => a + r.falseAlarms, 0)} in ${clean.length} | ${pct(rs.reduce((a, r) => a + r.seen, 0), rs.reduce((a, r) => a + r.frames, 0))} % |`);
  }
  lines.push('', '## Each video', '', '| Video | Counted / true | Coach said |', '|---|---|---|');
  for (const r of results) lines.push(`| ${r.file} | ${r.error ? 'error: ' + r.error : `${r.reps} / ${r.truth ?? '?'}`} | ${r.said?.map(s => `${s.key} @${s.at}s`).join(', ') || '–'} |`);
  return lines.join('\n') + '\n';
}

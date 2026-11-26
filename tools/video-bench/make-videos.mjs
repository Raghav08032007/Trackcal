// Example videos of the 3D coach (synthetic, no real people), named the way run.mjs reads them.
//
//   node tools/video-bench/make-videos.mjs <out folder> [--kinds squat,pushup,kickback] [--reps 6] [--turns 0,30] [--speeds 1,1.4] [--models f,m]
//
// Each combination becomes one video, e.g. squat_6reps_avatar-f-t30-s1.4.webm. A turn of 90 or more films a side-on move
// from the front (or a front move side-on), so it is labelled with the angle mistake the live coach should catch.
import {mkdirSync, renameSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {config, chromium} from '../bench/lib/common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), WEB = path.join(ROOT, 'frontend/web'), PORT = 3011;
const args = process.argv.slice(2), opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--')) ?? 'videos/avatar');
const kinds = opt('kinds', 'squat,pushup,curl,lunge,jack,kickback,overhead,row').split(','), reps = Number(opt('reps', '6'));
const turns = opt('turns', '0').split(',').map(Number), speeds = opt('speeds', '1').split(',').map(Number), models = opt('models', 'f').split(',');
mkdirSync(out, {recursive: true});

const {createServer} = await import(pathToFileURL(path.join(WEB, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({root: WEB, configFile: path.join(WEB, 'vite.config.ts'), server: {port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: {ignored: ['**/*']}}, logLevel: 'error'});
await server.listen();
const browser = await chromium.launch({executablePath: config.chrome, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  for (const kind of kinds) for (const turn of turns) for (const speed of speeds) for (const model of models) {
    const ctx = await browser.newContext({viewport: {width: 640, height: 480}, recordVideo: {dir: out, size: {width: 640, height: 480}}});
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/avatar-stage.html?kind=${kind}&reps=${reps}&turn=${turn}&speed=${speed}&model=${model}`);
    await page.waitForFunction(() => window.stage?.done || document.title === 'avatar failed', null, {timeout: 180000});
    const failed = (await page.title()) === 'avatar failed', video = page.video();
    const oneAngle = await page.evaluate(() => window.stage?.oneAngle), plane = await page.evaluate(() => window.stage?.plane);
    await ctx.close();
    // Only a side-only or front-only move filmed from the other angle is a mistake; the rest count from either angle.
    const file = await video.path(), mistake = oneAngle && Math.abs(turn) >= 60 ? (plane === 'front' ? '_side' : '_facing') : '';
    const name = `${kind}_${reps}reps${mistake}_avatar-${model}-t${turn}-s${speed}.webm`;
    if (failed) { console.log(`${name}: the 3D avatar could not load`); continue; }
    renameSync(file, path.join(out, name)); console.log(name);
  }
} finally { await browser.close(); await server.close(); }

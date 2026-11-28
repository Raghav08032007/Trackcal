// Phone-size screenshots of the main screens, signed in, for a first-time-user review.
// Usage: LOGIN=.. PASSWORD=.. TRACKCAL_API_URL=http://127.0.0.1:8011 node tools/nav-check/screens.mjs [outdir] [paths...]
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {config, chromium} from '../bench/lib/common.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), WEB = path.join(ROOT, 'frontend/web');
const out = process.argv[2] || path.join(ROOT, 'docs/screens'); mkdirSync(out, {recursive: true});
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['/', '/journal', '/food', '/food-library', '/barcode', '/describe', '/move', '/workouts', '/workouts/camera', '/plan', '/progress', '/me', '/account', '/play', '/feed', '/onboarding'];
const {createServer} = await import(pathToFileURL(path.join(WEB, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({root: WEB, configFile: path.join(WEB, 'vite.config.ts'), server: {port: 3014, strictPort: true, host: '127.0.0.1', hmr: false, watch: {ignored: ['**/*']}}, logLevel: 'error'});
await server.listen(); const base = 'http://127.0.0.1:3014';
const b = await chromium.launch({executablePath: config.chrome, headless: true});
const ctx = await b.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
const p = await ctx.newPage(); const errors = [];
p.on('pageerror', e => errors.push(`${p.url()}: ${e.message.slice(0, 160)}`));
if (process.env.LOGIN) await p.request.post(base + '/api/account/login', {data: {email: process.env.LOGIN, password: process.env.PASSWORD}, headers: {Origin: base}});
for (const route of paths) {
  await p.goto(base + route, {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(2500);
  const name = (route === '/' ? 'home' : route.slice(1).replace(/[^A-Za-z0-9-]+/g, '-'));
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await p.screenshot({path: path.join(out, `${name}.png`), fullPage: true});
  console.log(`${route}  sideways overflow: ${wide}px`);
}
if (errors.length) console.log('ERRORS\n' + errors.join('\n'));
await b.close(); await server.close();

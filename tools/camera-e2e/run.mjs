// End-to-end camera workout: a fake webcam (a y4m video of the 3D avatar) -> reps counted -> review -> Confirm & save.
// Make the video first: blender -b --factory-startup --python tools/camera-e2e/make_fakecam.py -- videos/avatar/curl_5reps_avatar-f-t0-s1.webm videos/fakecam/curl.y4m
// Needs the test API on 8011 (DB_NAME=trackcal_phase3_test). Usage: node tools/camera-e2e/run.mjs
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {config, chromium} from '../bench/lib/common.mjs';
const S = process.env.FAKECAM_DIR || 'videos/fakecam';
const WEB = 'F:/track cal/frontend/web', base = 'http://127.0.0.1:3013';
process.env.TRACKCAL_API_URL = 'http://127.0.0.1:8011';
const {createServer} = await import(pathToFileURL(path.join(WEB, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({root: WEB, configFile: path.join(WEB, 'vite.config.ts'), server: {port: 3013, strictPort: true, host: '127.0.0.1', hmr: false, watch: {ignored: ['**/*']}}, logLevel: 'error'});
await server.listen();
const b = await chromium.launch({executablePath: config.chrome, headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${S}/curl.y4m`]});
const ctx = await b.newContext({viewport: {width: 1280, height: 860}, permissions: ['camera']});
const p = await ctx.newPage();
p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ECONN/.test(m.text())) console.log('console', m.text().slice(0, 200)); });
p.on('response', r => { if (r.url().includes('/api/wellness/sessions') && r.request().method() !== 'GET') r.text().then(t => console.log('API', r.request().method(), r.status(), t.slice(0, 160))); });
await p.request.post(base + '/api/account/login', {data: {email: 'cpmwrna80b@tests.example.com', password: 'Ui-audit-2026!'}, headers: {Origin: base}});
await p.goto(base + '/workouts/camera?steps=curl:4,hammer:4', {waitUntil: 'domcontentloaded'});
await p.waitForSelector('button:has-text("Enable camera")', {timeout: 60000});
await p.click('button:has-text("Enable camera")');
const t0 = Date.now(); let last = '';
while (Date.now() - t0 < 150000) {
  const st = await p.evaluate(() => ({notice: document.querySelector('.camera-notice')?.textContent || '', review: /Review your workout|Review your movement/.test(document.body.innerText), count: document.querySelector('.camera-mobile-controls strong')?.textContent || document.querySelector('.camera-count, .camera-reps')?.textContent || ''}));
  const line = `${st.count} | ${st.notice}`.slice(0, 160); if (line !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', line); last = line; }
  if (st.review) break;
  await p.waitForTimeout(1000);
}
await p.screenshot({path: `${S}/cam-review.png`, fullPage: false});
const btn = p.locator('button:has-text("Confirm & save workout")');
if (await btn.count()) {
  await btn.first().click();
  await p.waitForTimeout(6000);
  console.log('AFTER SAVE:', await p.evaluate(() => (document.querySelector('.camera-notice')?.textContent || '') + ' | alert: ' + (document.querySelector('.camera-error')?.textContent || 'none') + ' | saved section: ' + !!document.querySelector('.camera-review') ));
  await p.screenshot({path: `${S}/cam-saved.png`});
} else console.log('NO REVIEW / SAVE BUTTON');
await b.close(); await server.close();

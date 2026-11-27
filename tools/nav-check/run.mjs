// Clicks through the app like a person: every tab, every section page link, back and forward.
// Records console errors, page crashes, the router's error screen, time spent on "Loading…", and pages that never settle.
// Usage: [LOGIN=.. PASSWORD=..] [TRACKCAL_API_URL=http://127.0.0.1:8011] node tools/nav-check/run.mjs [--mobile] [--base URL]
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {writeFileSync, mkdirSync} from 'node:fs';
import {config, chromium} from '../bench/lib/common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), WEB = path.join(ROOT, 'frontend/web');
const args = process.argv.slice(2), mobile = args.includes('--mobile'), PORT = 3011;
let base = args.includes('--base') ? args[args.indexOf('--base') + 1] : null, server;
if (!base) {
  const {createServer} = await import(pathToFileURL(path.join(WEB, 'node_modules/vite/dist/node/index.js')).href);
  server = await createServer({root: WEB, configFile: path.join(WEB, 'vite.config.ts'), server: {port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: {ignored: ['**/*']}}, logLevel: 'error'});
  await server.listen(); base = `http://127.0.0.1:${PORT}`;
}

const browser = await chromium.launch({executablePath: config.chrome, headless: true});
const ctx = await browser.newContext(mobile ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2} : {viewport: {width: 1366, height: 860}});
const page = await ctx.newPage();
const problems = [], visits = [];
let here = '/';
const ignorable = t => /Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR|status of (401|404|502|503)|\/api\//i.test(t);
page.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) problems.push({at: here, kind: 'console', text: m.text().slice(0, 300)}); });
page.on('pageerror', e => problems.push({at: here, kind: 'crash', text: String(e.message || e).slice(0, 300)}));

async function settle(label) {
  const t0 = Date.now(); let loadingMs = 0, stuck = false;
  for (;;) {
    const s = await page.evaluate(() => ({loading: !!document.querySelector('.account-loading,[aria-busy="true"]'), boom: /Unexpected Application Error|Something went wrong/i.test(document.body.innerText), main: !!document.querySelector('main')}));
    if (s.boom) { problems.push({at: here, kind: 'error-screen', text: (await page.evaluate(() => document.body.innerText.slice(0, 300)))}); break; }
    if (s.loading) loadingMs = Date.now() - t0;
    if (!s.loading && s.main && Date.now() - t0 > 250) break;
    if (Date.now() - t0 > 12000) { stuck = true; problems.push({at: here, kind: 'stuck', text: `still loading after 12s (${label})`}); break; }
    await page.waitForTimeout(50);
  }
  return {loadingMs, ms: Date.now() - t0, stuck};
}

if (process.env.LOGIN) {
  const r = await page.request.post(base + '/api/account/login', {data: {email: process.env.LOGIN, password: process.env.PASSWORD}, headers: {Origin: base}});
  console.log(`signed in: ${r.status()}`);
}
await page.goto(base + '/', {waitUntil: 'domcontentloaded'});
await settle('first load');
const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]).filter(h => h && !h.startsWith('/api')))]);
const queue = [...links], seen = new Set(['/']);
while (queue.length && seen.size < 90) {
  const href = queue.shift(); if (seen.has(href)) continue; seen.add(href);
  // click a real link when one is on screen (an in-app navigation, with its transition); otherwise navigate in-app via history
  const clicked = await page.evaluate(h => { const a = [...document.querySelectorAll(`a[href="${h}"]`)].find(x => x.offsetParent); if (a) { a.click(); return true; } return false; }, href);
  if (!clicked) await page.evaluate(h => { history.pushState({}, '', h); dispatchEvent(new PopStateEvent('popstate')); }, href);
  here = href;
  const r = await settle(href); visits.push({href, clicked, ...r});
  for (const h of await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]))) if (h && !seen.has(h) && !queue.includes(h) && !h.includes(':')) queue.push(h);
}
// back and forward a few steps
for (let i = 0; i < 4; i++) { here = 'back'; await page.goBack(); await settle('back'); }
for (let i = 0; i < 2; i++) { here = 'forward'; await page.goForward(); await settle('forward'); }

await browser.close(); if (server) await server.close();
const out = path.join(ROOT, 'docs/nav-check'); mkdirSync(out, {recursive: true});
const slow = visits.filter(v => v.loadingMs > 300).sort((a, b) => b.loadingMs - a.loadingMs);
const report = {when: new Date().toISOString(), mobile, pages: visits.length, problems, slowLoading: slow.slice(0, 15)};
writeFileSync(path.join(out, `nav-${mobile ? 'mobile' : 'desktop'}.json`), JSON.stringify(report, null, 1));
const kinds = problems.reduce((m, p) => (m[p.kind] = (m[p.kind] || 0) + 1, m), {});
console.log(`pages ${visits.length} · problems ${problems.length} ${JSON.stringify(kinds)} · loading screen shown on ${visits.filter(v => v.loadingMs > 0).length} · >300ms on ${slow.length}`);
const uniq = [...new Map(problems.map(p => [p.kind + p.text.slice(0, 90), p])).values()];
for (const p of uniq.slice(0, 40)) console.log(`- [${p.kind}] ${p.at}: ${p.text.replace(/\s+/g, ' ').slice(0, 220)}`);

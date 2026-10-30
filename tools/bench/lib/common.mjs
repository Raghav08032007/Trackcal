// Shared harness pieces: configuration, devices, networks, browser launch, login, stats and the action counter.
// Counting rules live in docs/bench/METHOD.md; this file is their single implementation.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
export const {chromium} = require('playwright-core');
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const config = {
  label: process.env.LABEL || 'A',
  base: (process.env.BASE_URL || 'http://127.0.0.1:3005').replace(/\/$/, ''),
  // The load test hits the API server directly (production puts Caddy, not the Vite preview proxy, in front of it).
  api: (process.env.API_URL || 'http://127.0.0.1:8005').replace(/\/$/, ''),
  repo: process.env.BENCH_REPO || ROOT,  // the checkout under test; set it to a frozen worktree so other work can't change what's measured
  quick: process.env.QUICK === '1',
  runs: Number(process.env.RUNS || (process.env.QUICK === '1' ? 1 : 5)),
  chrome: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  dbName: process.env.BENCH_DB || 'trackcal_phase3_test',
  python: process.env.BENCH_PYTHON || path.join(ROOT, 'backend/.venv/Scripts/python.exe'),
  timezone: 'Asia/Kolkata', locale: 'en-IN',
};
export const resultsDir = (label = config.label) => path.join(ROOT, 'docs/bench/results', label);

export const DEVICES = {
  'android-360': {viewport: {width: 360, height: 800}, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'},
  'iphone-390': {viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'},
  'tablet-768': {viewport: {width: 768, height: 1024}, deviceScaleFactor: 2, isMobile: true, hasTouch: true},
  'desktop-1280': {viewport: {width: 1280, height: 800}, deviceScaleFactor: 1},
};
// Slow 4G as in Lighthouse's mobile preset, plus a 4x CPU slowdown.
export const NETWORKS = {normal: null, slow4g: {latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4}};

export function fail(message) { console.error(`\nBENCH FAILED: ${message}\n`); process.exit(1); }

/** The app and its API must both answer before anything is measured. */
export async function preflight(base = config.base) {
  for (const [what, url] of [['web app', base + '/'], ['API through the web app', base + '/api/v1/subscriptions/plans']]) {
    try { const r = await fetch(url, {signal: AbortSignal.timeout(10000)}); if (!r.ok) fail(`${what} at ${url} answered ${r.status}.`); }
    catch (e) { fail(`${what} is not reachable at ${url} (${e.cause?.code || e.message}). Start Version ${config.label} first.`); }
  }
}

/** Seed the demo account; stops the whole run if seeding fails. */
export function seed() {
  const r = spawnSync(config.python, [path.join(ROOT, 'tools/bench/seed.py')], {env: {...process.env, DB_NAME: config.dbName, PYTHONWARNINGS: 'ignore'}, encoding: 'utf8'});
  const line = (r.stdout || '').trim().split('\n').reverse().find(l => l.startsWith('{"barcode_not_found"'));
  if (r.status !== 0 || !line) fail(`seed failed (exit ${r.status}): ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')}`);
  return JSON.parse(line);
}

export async function launch() { return chromium.launch({executablePath: config.chrome, headless: true}); }

/** A browser context with the fixed device, locale, time zone, theme and clock (10:00 IST on the seed's day). */
export async function context(browser, device, {theme = 'light', reducedMotion = 'no-preference', storageState, today, offline = false, serviceWorkers = 'block'} = {}) {
  const ctx = await browser.newContext({...DEVICES[device], baseURL: config.base, locale: config.locale, timezoneId: config.timezone, colorScheme: theme, reducedMotion, storageState, serviceWorkers});
  if (today) await ctx.clock.install({time: new Date(`${today}T10:00:00+05:30`)});
  if (offline) await ctx.setOffline(true);
  return ctx;
}

export async function throttle(page, network) {
  const profile = NETWORKS[network]; if (!profile) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: profile.latency, downloadThroughput: profile.downloadThroughput, uploadThroughput: profile.uploadThroughput});
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: profile.cpu});
}

/** Log the demo account in once and return a storage state for later contexts. */
export async function loginState(browser, account, file) {
  const ctx = await context(browser, 'desktop-1280'); const page = await ctx.newPage();
  const r = await page.request.post(config.base + '/api/account/login', {data: {email: account.email, password: account.password}, headers: {Origin: config.base}});
  if (!r.ok()) fail(`demo login failed (${r.status()}): ${await r.text()}`);
  await ctx.storageState({path: file}); await ctx.close();
  return file;
}

export const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
/** Spread = (max - min) / median. Over 15% marks a metric unreliable. */
export function stats(values) {
  const xs = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!xs.length) return {median: null, min: null, max: null, spread: null, runs: values.length, unreliable: true};
  const m = median(xs), spread = m ? (Math.max(...xs) - Math.min(...xs)) / Math.abs(m) : 0;
  return {median: round(m), min: round(Math.min(...xs)), max: round(Math.max(...xs)), spread: round(spread, 3), runs: xs.length, unreliable: xs.length < values.length || spread > 0.15};
}
export const round = (v, d = 2) => v === null || v === undefined ? v : Math.round(v * 10 ** d) / 10 ** d;

export async function writeJson(file, value) { await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, JSON.stringify(value, null, 1)); }
export async function readJson(file, fallback = null) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }

/** Counts what a person would do. One tap = one click, check, selection or Enter on a control; keystrokes = characters
 *  typed (fill counts each character). Navigation the harness does to set up a state is not counted. */
export function counter(page) {
  const c = {taps: 0, keystrokes: 0, routes: [], consoleErrors: [], failedRequests: []};
  page.on('console', m => { if (m.type() === 'error') c.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('requestfailed', r => { if (!/favicon|razorpay|fonts\.g/.test(r.url())) c.failedRequests.push(`${r.method()} ${r.url().replace(config.base, '')} ${r.failure()?.errorText || ''}`); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/api/account/session')) c.failedRequests.push(`${r.request().method()} ${r.url().replace(config.base, '')} ${r.status()}`); });
  page.on('framenavigated', f => { if (f === page.mainFrame()) c.routes.push(new URL(f.url()).pathname); });
  const act = {
    tap: async locator => { await locator.click(); c.taps++; },
    check: async locator => { await locator.check(); c.taps++; },
    select: async (locator, value) => { await locator.selectOption(value); c.taps++; },
    type: async (locator, text) => { await locator.fill(''); await locator.pressSequentially(String(text), {delay: 0}); c.keystrokes += String(text).length; },
    enter: async locator => { await locator.press('Enter'); c.keystrokes++; },
  };
  return {c, act};
}

// Runs J1–J8 on the journey devices, RUNS times each, reseeding before every run so all runs start identical.
import path from 'node:path';
import {config, context, counter, loginState, seed, stats, ROOT, writeJson} from './common.mjs';

export const JOURNEY_DEVICES = ['android-360', 'desktop-1280'];
// Longest single interaction (Event Timing API) during the journey: a lab stand-in for INP.
const eventTiming = () => { window.__interactions = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) window.__interactions.push(e.duration); }).observe({type: 'event', durationThreshold: 16, buffered: true}); } catch { /* unsupported */ } };

async function diaryCount(page) { const r = await page.request.get('/api/wellness/diary'); return r.ok() ? ((await r.json()).entries || []).length : -1; }

/** Every seeded past-day meal must still exist after the journeys (no data loss). */
async function seededMealsIntact(browser, state, account) {
  const ctx = await context(browser, 'desktop-1280', {storageState: state}); const page = await ctx.newPage();
  await page.goto(config.base + '/');
  let total = 0;
  for (let back = 1; back <= 30; back++) {
    const day = new Date(Date.parse(account.today + 'T00:00:00Z') - back * 864e5).toISOString().slice(0, 10);
    const r = await page.request.get(`/api/wellness/diary?day=${day}&limit=100`); total += r.ok() ? ((await r.json()).entries || []).length : 0;
  }
  await ctx.close(); return {expected: account.meals, found: total, intact: total === account.meals};
}

export async function runJourneys(browser, label = config.label, {only} = {}) {
  // A version without its own journeys file reuses A's (same accessible names). Any other import error stops the run.
  const {journeys: all} = await import(`../journeys/${label}.mjs`).catch(e => {
    if (e.code !== 'ERR_MODULE_NOT_FOUND' || !String(e.message).includes(`journeys/${label}.mjs`) && !String(e.message).includes(`journeys\\${label}.mjs`)) throw e;
    console.log(`  No journeys/${label}.mjs: using journeys/A.mjs`); return import('../journeys/A.mjs');
  });
  const journeys = all.filter(x => !only || only.includes(x.id));
  const rows = [], integrity = [];
  for (const device of JOURNEY_DEVICES) {
    for (let run = 1; run <= config.runs; run++) {
      const account = seed();
      const state = await loginState(browser, account, path.join(ROOT, `tools/bench/.state-${label}.json`));
      for (const j of journeys) {
        const ctx = await context(browser, device, {storageState: j.guest ? undefined : state, today: account.today});
        await ctx.addInitScript(eventTiming);
        const page = await ctx.newPage(); page.setDefaultTimeout(15000);
        const {c, act} = counter(page);
        let success = false, note = '', error = null, ms = null;
        try {
          await page.goto(config.base + j.start); await page.waitForLoadState('networkidle').catch(() => {});
          const before = {diary: j.guest ? 0 : await diaryCount(page)};
          c.routes.length = 0; c.consoleErrors.length = 0; c.failedRequests.length = 0;
          const started = performance.now();
          await j.run(page, {act}, {email: `bn${Date.now().toString(36).slice(-7)}@tests.example.com`  /* always 27 characters */, barcode: account.barcode_not_found});
          ms = performance.now() - started;
          ({success, note} = await j.verify(page, before));
          if (!success && !note) note = 'The steps finished but the expected record was not found.';
        } catch (e) { error = String(e.message || e).split('\n')[0].slice(0, 300); }
        const interactions = await page.evaluate(() => window.__interactions || []).catch(() => []);
        rows.push({journey: j.id, title: j.title, device, run, success, taps: c.taps, keystrokes: c.keystrokes, seconds: ms === null ? null : Math.round(ms) / 1000,
                   routeChanges: c.routes.length, routes: c.routes, consoleErrors: c.consoleErrors, failedRequests: c.failedRequests,
                   maxInteractionMs: interactions.length ? Math.round(Math.max(...interactions)) : null, note, error});
        console.log(`  ${j.id} ${device} run ${run}: ${success ? 'OK' : 'FAILED'} ${c.taps} taps, ${c.keystrokes} keys, ${ms === null ? '-' : (ms / 1000).toFixed(1) + 's'}${error ? ' — ' + error : ''}`);
        await ctx.close();
      }
      integrity.push({device, run, ...await seededMealsIntact(browser, state, account)});
    }
  }
  return {rows, integrity, summary: summarize(rows, journeys)};
}

export function summarize(rows, journeys) {
  return journeys.map(j => {
    const mine = rows.filter(r => r.journey === j.id);
    const ok = mine.filter(r => r.success);
    const failures = mine.filter(r => !r.success).map(r => r.error || r.note);
    // Spread is judged per device (a phone and a desktop are expected to differ); the pooled seconds keep the worst device's spread.
    const byDevice = Object.fromEntries([...new Set(ok.map(r => r.device))].map(d => [d, stats(ok.filter(r => r.device === d).map(r => r.seconds))]));
    const worst = Object.values(byDevice).reduce((a, s) => (s.spread ?? 0) > (a?.spread ?? -1) ? s : a, null);
    const pooled = stats(ok.map(r => r.seconds));
    return {journey: j.id, title: j.title, success: ok.length === mine.length && mine.length > 0, successRate: mine.length ? ok.length / mine.length : 0,
            taps: stats(ok.map(r => r.taps)), keystrokes: stats(ok.map(r => r.keystrokes)),
            seconds: {...pooled, spread: worst?.spread ?? pooled.spread, unreliable: Object.values(byDevice).some(s => s.unreliable)}, secondsByDevice: byDevice,
            routeChanges: stats(ok.map(r => r.routeChanges)), maxInteractionMs: stats(ok.map(r => r.maxInteractionMs)),
            consoleErrors: [...new Set(mine.flatMap(r => r.consoleErrors))], failedRequests: [...new Set(mine.flatMap(r => r.failedRequests))],
            failures: [...new Set(failures)], note: mine.find(r => r.note)?.note || ''};
  });
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('journeys.mjs')) {
  const {launch} = await import('./common.mjs');
  const browser = await launch();
  // A partial run (ONLY=…) never replaces the full journeys.json the scorecard reads.
  const only = process.env.ONLY?.split(',');
  try { const out = await runJourneys(browser, config.label, {only}); await writeJson(path.join(ROOT, `docs/bench/results/${config.label}/${only ? `journeys-${only.join('-')}` : 'journeys'}.json`), out); process.exitCode = out.summary.every(j => j.success) ? 0 : 1; }
  finally { await browser.close(); }
}

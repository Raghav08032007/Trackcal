// Performance: Lighthouse (mobile preset: Moto G-class device, slow 4G, 4x CPU) on the main screens, RUNS times,
// and an autocannon load test (50 connections, 2 minutes in total) on the five busiest API endpoints.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import autocannon from 'autocannon';
import {config, loginState, ROOT, stats} from './common.mjs';

export const PERF_SCREENS = ['/', '/nutrition', '/workouts', '/play', '/progress', '/scanner', '/account'];
export const LOAD_ENDPOINTS = ['/api/v1/auth/me', '/api/v1/wellness/diary', '/api/v1/adventure/summary', '/api/v1/wellness/foods?q=rice', '/api/v1/wellness/training'];

export async function runLighthouse(browser, account, label = config.label) {
  const state = JSON.parse(await fs.readFile(await loginState(browser, account, path.join(ROOT, `tools/bench/.state-${label}.json`)), 'utf8'));
  const cookie = state.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  // A fresh Chrome for every run: each run is a cold load, and one bad trace (NO_NAVSTART) can't affect the next.
  const audit = async url => { const chrome = await chromeLauncher.launch({chromePath: config.chrome, chromeFlags: ['--headless=new', '--no-first-run']});
    try { return await lighthouse(url, {port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], extraHeaders: {Cookie: cookie}}); } finally { await chrome.kill(); } };
  const out = {};
  {
    for (const route of PERF_SCREENS) {
      const runs = [], errors = [];
      for (let i = 0; i < config.runs; i++) {
        // A Lighthouse runtime error (e.g. NO_LCP) scores 0; it is recorded and retried (twice at most), never averaged in.
        let r;
        for (let attempt = 0; attempt < 3; attempt++) {
          r = await audit(config.base + route);
          if (!r.lhr.runtimeError) break;
          errors.push(`${r.lhr.runtimeError.code}: ${r.lhr.runtimeError.message}`.slice(0, 200));
        }
        if (r.lhr.runtimeError) continue;
        const a = r.lhr.audits;
        runs.push({score: Math.round((r.lhr.categories.performance.score || 0) * 100), lcpMs: a['largest-contentful-paint']?.numericValue, cls: a['cumulative-layout-shift']?.numericValue,
                   tbtMs: a['total-blocking-time']?.numericValue, fcpMs: a['first-contentful-paint']?.numericValue, transferKb: (a['total-byte-weight']?.numericValue || 0) / 1024, finalUrl: r.lhr.finalDisplayedUrl});
      }
      out[route] = {score: stats(runs.map(x => x.score)), lcpMs: stats(runs.map(x => x.lcpMs)), cls: stats(runs.map(x => x.cls)), tbtMs: stats(runs.map(x => x.tbtMs)),
                    fcpMs: stats(runs.map(x => x.fcpMs)), transferKb: stats(runs.map(x => x.transferKb)), finalUrl: runs[0]?.finalUrl, validRuns: runs.length, lighthouseErrors: errors,
                    inp: 'Not measured by Lighthouse navigation runs; see journeys maxInteractionMs (Event Timing) instead.'};
      console.log(`  lighthouse ${route}: score ${out[route].score.median}, LCP ${Math.round(out[route].lcpMs.median)} ms${errors.length ? ` (${errors.length} Lighthouse errors retried)` : ''}`);
    }
  }
  return out;
}

// Food search allows 240 requests an hour per user, so it gets a fixed number of requests at the same 50 connections.
// The limit counters are cleared before each of its runs (bench databases only), so 429s can't replace the measurement.
const CAPPED = {'/api/v1/wellness/foods?q=rice': 200};
const resetLimits = () => { const r = spawnSync(config.python, [path.join(ROOT, 'tools/bench/reset_limits.py')], {env: {...process.env, DB_NAME: config.dbName}, encoding: 'utf8'}); if (r.status !== 0) throw new Error(`could not reset rate limits: ${r.stderr.trim().slice(-200)}`); };
export async function runLoad(account) {
  const login = await fetch(config.api + '/api/v1/auth/login', {method: 'POST', body: new URLSearchParams({username: account.email, password: account.password})});
  if (!login.ok) throw new Error(`load test login failed: ${login.status}`);
  const token = (await login.json()).access_token;
  const seconds = config.quick ? 5 : 24;  // 5 endpoints x 24 s = 2 minutes per run
  const out = {};
  for (const endpoint of LOAD_ENDPOINTS) {
    const runs = [];
    for (let i = 0; i < config.runs; i++) {
      const codes = {};
      if (CAPPED[endpoint]) resetLimits();
      const result = await new Promise((resolve, reject) => {
        const inst = autocannon({url: config.api + endpoint, connections: 50, ...(CAPPED[endpoint] ? {amount: CAPPED[endpoint]} : {duration: seconds}), headers: {Authorization: `Bearer ${token}`}}, (err, res) => err ? reject(err) : resolve(res));
        inst.on('response', (_client, status) => { codes[status] = (codes[status] || 0) + 1; });
      });
      // autocannon's `errors` already includes timeouts; requests that errored never produced a response, so they add to the total.
      const responses = Object.values(codes).reduce((a, b) => a + b, 0), total = responses + result.errors || 1, limited = codes[429] || 0;
      const errors = Object.entries(codes).filter(([c]) => Number(c) >= 400 && Number(c) !== 429).reduce((a, [, n]) => a + n, 0) + result.errors;
      runs.push({p50: result.latency.p50, p95: result.latency.p97_5 ?? result.latency.p99, p95exact: null, rps: result.requests.average, errorRate: errors / total, rateLimited: limited / total,
                 timeouts: result.timeouts, connectionErrors: result.errors - result.timeouts, codes});
    }
    out[endpoint] = {p50Ms: stats(runs.map(r => r.p50)), p95Ms: stats(runs.map(r => r.p95)), rps: stats(runs.map(r => r.rps)), errorRate: stats(runs.map(r => r.errorRate)),
                     rateLimitedShare: stats(runs.map(r => r.rateLimited)), codes: runs.map(r => r.codes), timeouts: runs.map(r => r.timeouts), connectionErrors: runs.map(r => r.connectionErrors),
                     note: 'autocannon reports p97.5, used as the p95 upper bound. 429s are the app\'s own rate limits, reported separately from errors.'};
    console.log(`  load ${endpoint}: p50 ${out[endpoint].p50Ms.median} ms, p95≤${out[endpoint].p95Ms.median} ms, errors ${Math.round(out[endpoint].errorRate.median * 1000) / 10}%, 429 ${Math.round(out[endpoint].rateLimitedShare.median * 1000) / 10}%`);
  }
  return out;
}

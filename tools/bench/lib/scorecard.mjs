// Scorecard formulas, fixed before any Version B exists (docs/bench/SCORECARD.md explains each one).
// Every criterion maps to 0–100; a category is the weighted mean of its criteria; the total is the weighted sum.
export const WEIGHTS = {speed: 30, visual: 20, performance: 15, maintainability: 15, regression: 10, habit: 10};
// Ideal taps and seconds per journey (a fluent person on a well-designed app); scoring is relative to these.
export const IDEAL = {J1: {taps: 4, seconds: 25}, J2: {taps: 4, seconds: 10}, J3: {taps: 2, seconds: 5}, J4: {taps: 5, seconds: 15}, J5: {taps: 1, seconds: 3}, J6: {taps: 4, seconds: 12}, J7: {taps: 1, seconds: 3}, J8: {taps: 2, seconds: 4}};
// Lab replay is much faster than a person; seconds are scaled by HUMAN_FACTOR before comparing with the ideal.
export const HUMAN_FACTOR = 1;
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
const lerp = (value, best, worst) => value === null || value === undefined ? null : clamp(100 * (worst - value) / (worst - best));
const mean = xs => { const v = xs.filter(x => x !== null && x !== undefined); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
const weighted = parts => { const v = parts.filter(([s]) => s !== null && s !== undefined); const w = v.reduce((a, [, x]) => a + x, 0); return w ? Math.round(v.reduce((a, [s, x]) => a + s * x, 0) / w) : null; };

export function score(r) {
  const j = r.journeys?.summary || [];
  // 1. Task speed and taps (30): per journey 60% taps (each tap over ideal −15), 40% time (ideal 100 → 3x ideal 0); failed = 0.
  const perJourney = Object.fromEntries(j.map(x => {
    if (!x.success) return [x.journey, 0];
    const ideal = IDEAL[x.journey]; const taps = clamp(100 - 15 * Math.max(0, x.taps.median - ideal.taps));
    const time = lerp(x.seconds.median * HUMAN_FACTOR, ideal.seconds, ideal.seconds * 3);
    return [x.journey, weighted([[taps, 0.6], [time, 0.4]])];
  }));
  const speed = mean(Object.values(perJourney));
  // 2. Visual quality and accessibility (20).
  const axeIssues = Object.values(r.screens?.axe || {}).flat().filter(v => ['serious', 'critical'].includes(v.impact)).length;
  const contrastPairs = new Set(Object.values(r.screens?.audits || {}).flatMap(a => a.contrast.map(c => `${c.color}|${c.background}`))).size;
  const targets = Object.values(r.screens?.audits || {}); const small = targets.reduce((a, t) => a + t.smallTargets.length, 0);
  const controls = targets.length ? small / Math.max(1, targets.length) : null;
  const sprawl = r.tokens?.distinct || {};
  const keyboard = Object.values(r.screens?.keyboard || {});
  const visual = {
    axe: clamp(100 - 10 * axeIssues), contrast: clamp(100 - 5 * contrastPairs),
    tapTargets: controls === null ? null : clamp(100 - 4 * controls),  // −4 per average undersized control per screen
    tokens: sprawl.fontSize === undefined ? null : clamp(100 - 5 * Math.max(0, sprawl.fontSize - 8) - 2 * Math.max(0, sprawl.color - 24) - 2 * Math.max(0, sprawl.spacing - 12)),
    keyboard: keyboard.length ? clamp(100 - 25 * keyboard.filter(k => k.trapped).length - 2 * keyboard.reduce((a, k) => a + k.withoutVisibleFocus.length, 0)) : null,
  };
  const visualScore = weighted([[visual.axe, 0.4], [visual.contrast, 0.25], [visual.tapTargets, 0.15], [visual.tokens, 0.1], [visual.keyboard, 0.1]]);
  // 3. Performance (15).
  const lh = Object.values(r.perf?.lighthouse || {});
  const load = Object.values(r.perf?.load || {});
  const perf = {
    lighthouse: mean(lh.map(x => x.score.median)), lcp: mean(lh.map(x => lerp(x.lcpMs.median, 2500, 4000))), cls: mean(lh.map(x => lerp(x.cls.median, 0.1, 0.25))),
    apiP95: mean(load.map(x => lerp(x.p95Ms.median, 300, 1000))), apiErrors: mean(load.map(x => lerp(x.errorRate.median, 0, 0.05))),
  };
  const performance = weighted([[perf.lighthouse, 0.45], [perf.lcp, 0.2], [perf.cls, 0.1], [perf.apiP95, 0.15], [perf.apiErrors, 0.1]]);
  // 4. Maintainability (15).
  const c = r.codehealth || {};
  const maint = {
    duplication: lerp(c.duplication?.percentage, 3, 15), bigFiles: c.size ? clamp(100 - 3 * c.size.over400.length) : null, complexity: c.complexity ? clamp(100 - 2 * c.complexity.over15) : null,
    typeEscapes: c.typeEscapes ? clamp(100 - 2 * (c.typeEscapes.any + c.typeEscapes.tsIgnore)) : null, addField: c.addField ? clamp(100 - 10 * Math.max(0, c.addField.appFiles - 4)) : null,
  };
  const maintainability = weighted([[maint.duplication, 0.3], [maint.bigFiles, 0.2], [maint.complexity, 0.2], [maint.typeEscapes, 0.1], [maint.addField, 0.2]]);
  // 5. Regression safety (10).
  const cov = c.coverage || {};
  const allPass = cov.backendTests && cov.webTests ? (cov.backendTests.failed === 0 && cov.webTests.failed === 0 && cov.backendTests.passed > 0 && cov.webTests.passed > 0 && cov.backendTests.exit === 0 && cov.webTests.exit === 0) : null;
  const regression = weighted([[allPass === null ? null : allPass ? 100 : 0, 0.4], [mean([lerp(cov.backendLinePct, 80, 40), lerp(cov.webLinePct, 80, 40)]), 0.4], [j.length ? clamp(100 * j.filter(x => x.success).length / j.length) : null, 0.2]]);
  // 6. Habit-loop features (10): each present feature counts equally; verified by journeys or screens where possible.
  const habit = r.habit ? clamp(100 * r.habit.filter(h => h.present).length / r.habit.length) : null;
  const categories = {speed, visual: visualScore, performance, maintainability, regression, habit};
  const total = Math.round(Object.entries(WEIGHTS).reduce((a, [k, w]) => a + (categories[k] ?? 0) * w, 0) / 100);
  // Hard gates: failing any one means the version can't win, whatever its score.
  const gates = {
    noDataLoss: (r.journeys?.integrity || []).length ? r.journeys.integrity.every(x => x.intact) : null,
    wcagTextContrast: contrastPairs === 0,
    zeroRegressions: allPass,
    allJourneysSucceed: j.length ? j.every(x => x.success) : null,
  };
  return {total, categories, details: {perJourney, visual, perf, maint, axeIssues, contrastPairs}, gates, weights: WEIGHTS};
}

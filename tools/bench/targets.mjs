// Fast count of undersized tap targets and sideways overflow while fixing them.
// LABEL=B BASE_URL=... node targets.mjs   The full screens pass stays the measurement of record.
import path from 'node:path';
import {config, context, launch, loginState, ROOT, seed} from './lib/common.mjs';
import {census, GUEST_SCREENS, MEMBER_SCREENS} from './lib/screens.mjs';

const browser = await launch(), account = seed();
const state = await loginState(browser, account, path.join(ROOT, `tools/bench/.state-${config.label}.json`));
const found = {}; let pages = 0, total = 0, overflow = 0;
for (const [screens, storageState] of [[MEMBER_SCREENS, state], [GUEST_SCREENS, undefined]]) for (const device of ['android-360', 'desktop-1280']) {
  const ctx = await context(browser, device, {theme: 'light', storageState, today: account.today}); const page = await ctx.newPage();
  for (const route of screens) {
    await page.goto(config.base + route); await page.locator('main, [role=main]').first().waitFor({timeout: 20000}).catch(() => {});
    await page.waitForLoadState('networkidle', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(300); pages++;
    for (const t of (await page.evaluate(census)).smallTargets) { total++; const key = `${t.selector} ${t.width}x${t.height} ${t.label.slice(0, 30)}`; found[key] = (found[key] || 0) + 1; }
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) { overflow++; console.log('overflow', device, route); }
  }
  await ctx.close();
}
await browser.close();
console.log(`${total} undersized over ${pages} pages: ${(total / pages).toFixed(1)} per page; ${overflow} pages overflow`);
for (const [k, n] of Object.entries(found).sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(n, k);

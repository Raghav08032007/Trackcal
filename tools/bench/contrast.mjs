// Fast contrast check while fixing colours: every screen, 360 and 1280, light and dark. Prints failing pairs.
// LABEL=B BASE_URL=... node contrast.mjs   (the full screens pass stays the measurement of record)
import path from 'node:path';
import {config, context, launch, loginState, ROOT, seed} from './lib/common.mjs';
import {census, GUEST_SCREENS, MEMBER_SCREENS} from './lib/screens.mjs';

const browser = await launch(), account = seed();
const state = await loginState(browser, account, path.join(ROOT, `tools/bench/.state-${config.label}.json`));
const found = new Map();
for (const [who, screens, storageState] of [['member', MEMBER_SCREENS, state], ['guest', GUEST_SCREENS, undefined]]) {
  for (const device of ['android-360', 'desktop-1280']) for (const theme of ['light', 'dark']) {
    const ctx = await context(browser, device, {theme, storageState, today: account.today}); const page = await ctx.newPage();
    for (const route of screens) {
      await page.goto(config.base + route); await page.locator('main, [role=main]').first().waitFor({timeout: 20000}).catch(() => {});
      await page.waitForLoadState('networkidle', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(400);
      for (const c of (await page.evaluate(census)).contrast) {
        const k = `${theme} ${c.color} on ${c.background} (${c.ratio})`;
        const e = found.get(k) || {n: 0, sel: c.selector, text: c.text, route, needed: c.needed}; e.n++; found.set(k, e);
      }
    }
    await ctx.close();
  }
}
await browser.close();
for (const [k, e] of [...found].sort((a, b) => b[1].n - a[1].n)) console.log(`${e.n}\t${k}\t${e.needed}\t${e.route}\t${e.sel}\t${e.text}`);
console.log(`${found.size} failing pairs, ${[...found.values()].reduce((a, e) => a + e.n, 0)} elements`);
process.exit(found.size ? 1 : 0);

// Distinct visual values across every screen at 360 and 1280, light and dark. Quick feedback while consolidating tokens.
// LABEL=B BASE_URL=... node tokens.mjs   Writes the counts to TOKENS_OUT if set.
import path from 'node:path';
import fs from 'node:fs';
import {config, context, launch, loginState, ROOT, seed} from './lib/common.mjs';
import {census, GUEST_SCREENS, MEMBER_SCREENS} from './lib/screens.mjs';

const browser = await launch(), account = seed();
const state = await loginState(browser, account, path.join(ROOT, `tools/bench/.state-${config.label}.json`));
const usage = {};
for (const [screens, storageState] of [[MEMBER_SCREENS, state], [GUEST_SCREENS, undefined]]) {
  for (const device of ['android-360', 'desktop-1280']) for (const theme of ['light', 'dark']) {
    const ctx = await context(browser, device, {theme, storageState, today: account.today}); const page = await ctx.newPage();
    for (const route of screens) {
      await page.goto(config.base + route); await page.locator('main, [role=main]').first().waitFor({timeout: 20000}).catch(() => {});
      await page.waitForLoadState('networkidle', {timeout: 8000}).catch(() => {}); await page.waitForTimeout(300);
      for (const [k, values] of Object.entries((await page.evaluate(census)).tokens)) for (const [v, n] of Object.entries(values)) { usage[k] ??= {}; usage[k][v] = (usage[k][v] || 0) + n; }
    }
    await ctx.close();
  }
}
await browser.close();
for (const [k, v] of Object.entries(usage)) console.log(k, Object.keys(v).length);
if (process.env.TOKENS_OUT) fs.writeFileSync(process.env.TOKENS_OUT, JSON.stringify(usage));

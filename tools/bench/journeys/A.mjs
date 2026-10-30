// Version A journey steps (the app tagged legacy-baseline). Version B gets its own file with the same journey ids,
// start states and success oracles; only the steps change. Each run(): start page is set up by the harness (not
// counted), steps use the counting actions, and verify() checks the outcome on the server or device, not the screen.
const ok = (done, note = '') => ({success: !!done, note});

async function diaryToday(page) {
  const r = await page.request.get('/api/wellness/diary'); if (!r.ok()) return [];
  return (await r.json()).entries || [];
}
async function deviceStore(page, prefix) {
  return page.evaluate(p => Object.entries(localStorage).filter(([k]) => k.includes(p)).map(([k, v]) => [k, JSON.parse(v)]), prefix);
}

export const journeys = [
  {
    id: 'J1', title: 'First run: sign up to first successful food log', start: '/signup', guest: true,
    async run(page, {act}, {email}) {
      await act.type(page.locator('input[name=name]'), 'New Person');
      await act.type(page.locator('input[name=email]'), email);
      await act.type(page.locator('input[name=password]'), 'Bench-new-person-2026!');
      await act.tap(page.getByRole('button', {name: 'Create free account'})); await page.waitForURL('**/onboarding');
      await act.tap(page.getByRole('link', {name: 'Continue tracking without finishing'})); await page.waitForURL(u => new URL(u).pathname === '/');
      await act.tap(page.getByRole('link', {name: 'Log a meal ↗'})); await page.getByRole('heading', {name: 'Your food diary'}).waitFor();
      await act.type(page.getByLabel('Food name 1', {exact: true}), 'Masala dosa');
      await act.type(page.getByLabel('calories per 100g · food 1', {exact: true}), '180');
      await act.tap(page.getByRole('button', {name: 'Confirm diary entry'}));
      await page.getByRole('status').filter({hasText: 'Meal saved'}).waitFor();
    },
    async verify(page) { return ok((await diaryToday(page)).some(e => e.items.some(i => i.name === 'Masala dosa'))); },
  },
  {
    id: 'J2', title: 'Log a meal by search from the home screen', start: '/',
    async run(page, {act}) {
      await act.tap(page.getByRole('link', {name: 'Log a meal ↗'})); await page.getByRole('heading', {name: 'Your food diary'}).waitFor();
      await act.type(page.getByLabel('Food search', {exact: true}), 'rice');
      await act.tap(page.getByRole('button', {name: 'Search catalog'}));
      await act.tap(page.getByRole('button', {name: /^Choose /}).first());
      await act.tap(page.getByRole('button', {name: 'Confirm diary entry'}));
      await page.getByRole('status').filter({hasText: 'Meal saved'}).waitFor();
    },
    async verify(page, before) { const after = await diaryToday(page); return ok(after.length === before.diary + 1 && after.some(e => e.items.some(i => /rice/i.test(i.name)))); },
  },
  {
    id: 'J3', title: 'Log a meal from favourites or recents', start: '/',
    async run(page, {act}) {
      await act.tap(page.getByRole('link', {name: 'Log a meal ↗'})); await page.getByRole('heading', {name: 'Your food diary'}).waitFor();
      await act.tap(page.getByRole('button', {name: 'Use favorite Idli with sambar'}));
      await act.tap(page.getByRole('button', {name: 'Confirm diary entry'}));
      await page.getByRole('status').filter({hasText: 'Meal saved'}).waitFor();
    },
    async verify(page, before) { const after = await diaryToday(page); return ok(after.length === before.diary + 1 && after.some(e => e.items.some(i => i.name === 'Idli with sambar'))); },
  },
  {
    id: 'J4', title: 'Barcode flow with manual fallback', start: '/',
    async run(page, {act}, {barcode}) {
      await act.tap(page.getByRole('link', {name: 'Food', exact: true}).first()); await page.getByRole('heading', {name: 'Your food diary'}).waitFor();
      await act.tap(page.getByRole('navigation', {name: 'Food pages'}).getByRole('link', {name: 'Barcode'}));
      await act.type(page.getByLabel('Barcode number'), barcode); await act.tap(page.getByRole('button', {name: 'Lookup Barcode'}));
      await page.getByText(/Product not found/).waitFor();
      // Manual fallback in A: the not-found message points to entering the label values in My journal.
      await act.tap(page.getByRole('navigation', {name: 'Food pages'}).getByRole('link', {name: 'Journal'}));
      await act.type(page.getByLabel('Food name', {exact: true}), 'Unknown biscuit');
      await act.type(page.getByLabel('calories', {exact: true}), '120');
      await act.tap(page.getByRole('button', {name: 'Add meal'}));
    },
    async verify(page) { return ok((await deviceStore(page, 'trackcal:journal:')).some(([, v]) => Array.isArray(v) && v.some(m => m.name === 'Unknown biscuit')), 'A logs barcode/manual meals to the device journal'); },
  },
  {
    id: 'J5', title: 'Log a glass of water', start: '/',
    async run(page, {act}) {
      await act.tap(page.getByRole('link', {name: 'Food', exact: true}).first()); await page.getByRole('heading', {name: 'Your food diary'}).waitFor();
      await act.tap(page.getByRole('navigation', {name: 'Food pages'}).getByRole('link', {name: 'Journal'}));
      await act.tap(page.getByRole('button', {name: '+250 ml'}));
    },
    async verify(page) { return ok((await deviceStore(page, 'trackcal:wellness:')).some(([, v]) => v?.water >= 250), 'A keeps water in device storage'); },
  },
  {
    id: 'J6', title: 'Start a workout and log one set', start: '/',
    async run(page, {act}) {
      await act.tap(page.getByRole('link', {name: 'Move', exact: true}).first()); await page.getByRole('heading', {name: 'Your activity overview'}).waitFor();
      await act.tap(page.getByRole('button', {name: 'Add Wall push fundamentals'}));
      await act.tap(page.getByRole('button', {name: 'Start workout'}));
      await act.tap(page.getByRole('button', {name: 'Add set for exercise 1'}));
      await act.type(page.getByLabel('reps · exercise 1 set 1', {exact: true}), '10');
      await act.type(page.getByLabel('Recorded session minutes', {exact: true}), '5');
      await act.tap(page.getByRole('button', {name: 'Complete workout'}));
      await page.getByText(/Session complete/).waitFor();
    },
    async verify(page) {
      const r = await page.request.get('/api/wellness/training'); const s = r.ok() ? (await r.json()).sessions || [] : [];
      return ok(s.some(x => x.status === 'completed' && x.details?.exercises?.some(e => e.sets?.some(set => set.reps === 10))));
    },
  },
  {
    id: 'J7', title: "Find today's progress summary", start: '/',
    async run(page, {act}) {
      await act.tap(page.getByRole('link', {name: 'Play', exact: true}).first());
      await act.tap(page.getByRole('link', {name: 'Progress', exact: true}).first());
      await page.getByRole('heading', {name: /See how far you/}).waitFor();
    },
    async verify(page) { return ok(new URL(page.url()).pathname === '/progress' && await page.getByRole('heading', {name: 'Your daily rhythm'}).count() > 0); },
  },
  {
    id: 'J8', title: 'Change language or theme', start: '/',
    async run(page, {act}) {
      await act.select(page.getByLabel('Appearance'), 'dark');
    },
    async verify(page) {
      const dark = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
      return ok(dark, 'Theme: yes (footer Appearance). Language: A has a language preference in the plan but no translated interface, so changing language has no visible effect.');
    },
  },
];

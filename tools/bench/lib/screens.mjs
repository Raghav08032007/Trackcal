// Screens: capture every screen on 4 devices x light/dark, plus empty / loading / error / offline states at 360 px,
// and collect visual tokens, contrast, tap targets, tabular figures, axe, keyboard, 200% zoom and motion.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {config, context, DEVICES, loginState, resultsDir, seed, throttle, ROOT} from './common.mjs';
const require = createRequire(import.meta.url);
const axeSource = await fs.readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

export const MEMBER_SCREENS = ['/', '/nutrition', '/scanner', '/barcode', '/describe', '/food-library', '/journal', '/recipes', '/workouts', '/workouts/camera', '/plan', '/play', '/progress', '/routine', '/account', '/tools', '/guide', '/onboarding', '/premium', '/feed', '/communities'];
export const GUEST_SCREENS = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms', '/help', '/guide'];
const slug = p => (p === '/' ? 'home' : p.slice(1).replace(/\//g, '-'));

async function ready(page) {
  await page.locator('main, [role=main]').first().waitFor({timeout: 20000});
  await page.waitForLoadState('networkidle', {timeout: 15000}).catch(() => {});
  await page.waitForTimeout(500);
}

/** Computed-style census of the visible page: tokens, contrast, tap targets, tabular figures. */
const census = () => {
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  // Computed colours can be oklch()/lab() (Tailwind 4), so anything that isn't rgb() is painted to a canvas and read back.
  const pen = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
  const parse = c => { const m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return {r, g, b, a}; } pen.clearRect(0, 0, 1, 1); pen.fillStyle = '#000'; pen.fillStyle = c; pen.fillRect(0, 0, 1, 1); const [r, g, b, a] = pen.getImageData(0, 0, 1, 1).data; return {r, g, b, a: a / 255}; };
  const lum = ({r, g, b}) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bottom) => ({r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1});
  const background = el => { const layers = []; for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.backgroundImage !== 'none' && !/^none$/.test(s.backgroundImage)) return null; const c = parse(s.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let out = {r: 255, g: 255, b: 255, a: 1}; for (const c of layers.reverse()) out = blend(c, out); return out; };
  const selector = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const tokens = {fontFamily: {}, fontSize: {}, fontWeight: {}, lineHeight: {}, color: {}, backgroundColor: {}, spacing: {}, borderRadius: {}, boxShadow: {}, zIndex: {}};
  const add = (k, v) => { if (v && v !== 'none' && v !== 'auto' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') tokens[k][v] = (tokens[k][v] || 0) + 1; };
  const contrast = [], small = [], numbers = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'borderRadius', 'boxShadow', 'zIndex']) add(k, s[k]);
    add('color', s.color); add('backgroundColor', s.backgroundColor);
    for (const k of ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'paddingLeft', 'gap']) add('spacing', s[k]);
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (text) {
      const fg = parse(s.color), bg = background(el);
      if (fg && bg) {
        const f = fg.a < 1 ? blend(fg, bg) : fg, l1 = lum(f), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) contrast.push({selector: selector(el), text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100, needed: large ? 3 : 4.5, color: s.color, background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`});
      }
      if (/^\s*[₹+\-]?[\d.,:%]+\s*(kcal|g|ml|kg|reps|xp|min|%|days?)?\s*$/i.test(text)) numbers.push({selector: selector(el), text, tabular: /tabular-nums/.test(s.fontVariantNumeric) || /tnum/.test(s.fontFeatureSettings)});
    }
    if (el.matches('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], summary')) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) small.push({selector: selector(el), label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('name') || '').trim().slice(0, 40), width: Math.round(r.width), height: Math.round(r.height)});
    }
  }
  return {tokens, contrast, smallTargets: small, numbers};
};

/** Every running animation: element, duration, easing, animated properties. */
const animations = () => document.getAnimations().filter(a => a.playState === 'running').map(a => {
  const t = a.effect?.target, k = a.effect?.getKeyframes?.() || [], timing = a.effect?.getComputedTiming?.() || {};
  return {target: t ? t.tagName.toLowerCase() + (t.classList?.length ? '.' + [...t.classList].slice(0, 2).join('.') : '') : '?', name: a.animationName || a.transitionProperty || a.constructor.name,
          duration: timing.duration, iterations: timing.iterations, easing: timing.easing, properties: [...new Set(k.flatMap(f => Object.keys(f).filter(x => !['offset', 'computedOffset', 'easing', 'composite'].includes(x))))]};
});

async function keyboardPass(page) {
  const steps = [];
  await page.locator('body').click({position: {x: 1, y: 1}}).catch(() => {});
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    steps.push(await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return {key: el.tagName + (el.id || '') + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), visibleFocus: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none', onScreen: r.width > 0 && r.height > 0};
    }));
  }
  const keys = steps.filter(Boolean).map(s => s.key);
  const trap = keys.length > 10 && new Set(keys.slice(-20)).size <= 2;
  return {focusable: new Set(keys).size, withoutVisibleFocus: [...new Set(steps.filter(s => s && !s.visibleFocus).map(s => s.key))], trapped: trap};
}

/** Which fonts actually render Tamil and Hindi text in the page's body font stack (Chrome's own answer, via CDP). */
async function fontProbe(page) {
  const samples = {tamil: 'தமிழ் உணவு', hindi: 'हिन्दी भोजन', latin: 'Daily food'};
  await page.evaluate(s => { for (const [k, t] of Object.entries(s)) { const el = document.createElement('p'); el.id = `bench-font-${k}`; el.textContent = t; el.style.cssText = 'position:absolute;left:0;top:0;opacity:0.01'; document.body.append(el); } }, samples);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const {root} = await cdp.send('DOM.getDocument');
    const out = {fontStack: await page.evaluate(() => getComputedStyle(document.body).fontFamily)};
    for (const k of Object.keys(samples)) {
      const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: `#bench-font-${k}`});
      out[k] = (await cdp.send('CSS.getPlatformFontsForNode', {nodeId})).fonts.map(f => `${f.familyName}${f.isCustomFont ? ' (web font)' : ' (system)'}`);
    }
    return out;
  } finally { await cdp.detach().catch(() => {}); await page.evaluate(() => document.querySelectorAll('[id^=bench-font-]').forEach(e => e.remove())).catch(() => {}); }
}

export async function runScreens(browser, {label = config.label} = {}) {
  const out = path.join(resultsDir(label), 'screens'); await fs.mkdir(out, {recursive: true});
  const account = seed(); const state = await loginState(browser, account, path.join(ROOT, `tools/bench/.state-${label}.json`));
  const manifest = [], unreachable = [], audits = {}, bundles = {}, axe = {}, keyboard = {}, zoom = {}, motion = {};
  let fonts = null;
  const visit = async (page, route) => { const r = await page.goto(config.base + route); await ready(page); return r; };
  const devices = config.quick ? ['android-360', 'desktop-1280'] : Object.keys(DEVICES);
  for (const [who, screens, storageState] of [['member', MEMBER_SCREENS, state], ['guest', GUEST_SCREENS, undefined]]) {
    for (const device of devices) for (const theme of ['light', 'dark']) {
      const ctx = await context(browser, device, {theme, storageState, today: account.today}); const page = await ctx.newPage(); page.setDefaultTimeout(20000);
      for (const route of screens) {
        const key = `${who}${route}`;
        try {
          const bytes = {js: 0, css: 0}; const tally = r => { const t = r.request().resourceType(); r.body().then(b => { if (t === 'script') bytes.js += b.length; if (t === 'stylesheet') bytes.css += b.length; }).catch(() => {}); };
          if (device === 'desktop-1280' && theme === 'light') page.on('response', tally);
          await visit(page, route);
          if (device === 'desktop-1280' && theme === 'light') { page.off('response', tally); bundles[key] = bytes; }
          const file = `${who}-${slug(route)}-${device}-${theme}.png`;
          await page.screenshot({path: path.join(out, file), fullPage: true});
          manifest.push({screen: key, device, theme, state: 'default', file, finalPath: new URL(page.url()).pathname});
          if (['android-360', 'desktop-1280'].includes(device)) audits[`${key} ${device} ${theme}`] = await page.evaluate(census);
          if (theme === 'light' && ['android-360', 'desktop-1280'].includes(device)) {
            axe[`${key} ${device}`] = await page.evaluate(async src => { eval(src); const r = await window.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}}); return r.violations.map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length})); }, axeSource);
          }
          if (device === 'desktop-1280' && theme === 'light') {
            motion[key] = {normal: await page.evaluate(animations)};
            if (!fonts) fonts = await fontProbe(page);
          }
        } catch (e) { unreachable.push({screen: key, device, theme, reason: String(e.message || e).split('\n')[0].slice(0, 200)}); }
      }
      await ctx.close();
    }
    // Keyboard-only pass, 200% zoom and reduced motion on desktop.
    for (const route of screens) {
      const key = `${who}${route}`;
      try {
        let ctx = await context(browser, 'desktop-1280', {storageState, today: account.today}); let page = await ctx.newPage();
        await visit(page, route); keyboard[key] = await keyboardPass(page); await ctx.close();
        ctx = await browser.newContext({viewport: {width: 640, height: 400}, deviceScaleFactor: 2, baseURL: config.base, storageState, locale: config.locale, timezoneId: config.timezone}); page = await ctx.newPage();
        await visit(page, route);
        zoom[key] = await page.evaluate(() => ({horizontalScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth}));
        await page.screenshot({path: path.join(out, `${who}-${slug(route)}-zoom200.png`)}); await ctx.close();
        ctx = await context(browser, 'desktop-1280', {storageState, reducedMotion: 'reduce', today: account.today}); page = await ctx.newPage();
        await visit(page, route); motion[key] = {...(motion[key] || {}), reduced: await page.evaluate(animations)}; await ctx.close();
      } catch (e) { unreachable.push({screen: key, check: 'keyboard/zoom/motion', reason: String(e.message || e).split('\n')[0].slice(0, 200)}); }
    }
  }
  // States at 360 px, light: empty (a brand-new account), loading (slow 4G), error (API fails), offline.
  const states = [];
  const fresh = await browser.newContext({baseURL: config.base}); const fp = await fresh.newPage();
  const email = `be${Date.now().toString(36).slice(-7)}@tests.example.com`;
  const signup = await fp.request.post('/api/account/signup', {data: {email, password: 'Bench-empty-state-2026!', display_name: 'Empty'}, headers: {Origin: config.base}});
  const emptyState = signup.ok() ? path.join(ROOT, `tools/bench/.state-${label}-empty.json`) : null; if (emptyState) await fresh.storageState({path: emptyState}); await fresh.close();
  for (const route of MEMBER_SCREENS) {
    for (const kind of ['empty', 'loading', 'error', 'offline']) {
      const file = `member-${slug(route)}-android-360-light-${kind}.png`;
      let ctx;
      try {
        if (kind === 'empty' && !emptyState) throw new Error('could not create an empty account');
        ctx = await context(browser, 'android-360', {storageState: kind === 'empty' ? emptyState : state, today: account.today, serviceWorkers: kind === 'offline' ? 'allow' : 'block'});
        const page = await ctx.newPage(); page.setDefaultTimeout(20000);
        if (kind === 'loading') { await throttle(page, 'slow4g'); page.goto(config.base + route).catch(() => {}); await page.waitForTimeout(700); }
        else if (kind === 'error') { await page.route('**/api/**', r => r.request().url().includes('/api/account/session') ? r.continue() : r.fulfill({status: 503, contentType: 'application/json', body: '{"error":"Service unavailable (bench simulated)"}'})); await visit(page, route); }
        else if (kind === 'offline') { await visit(page, route); await page.waitForTimeout(1500); await ctx.setOffline(true); await page.reload().catch(() => {}); await page.waitForTimeout(1500); }
        else await visit(page, route);
        await page.screenshot({path: path.join(out, file), fullPage: kind !== 'loading'});
        states.push({screen: `member${route}`, state: kind, file, finalPath: new URL(page.url()).pathname});
      } catch (e) { unreachable.push({screen: `member${route}`, state: kind, reason: String(e.message || e).split('\n')[0].slice(0, 200)}); }
      await ctx?.close();
    }
  }
  return {manifest: [...manifest, ...states], unreachable, audits, bundles, axe, keyboard, zoom, motion, fonts};
}
export {census};

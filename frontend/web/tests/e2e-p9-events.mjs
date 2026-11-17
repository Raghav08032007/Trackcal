// Phase 9 events journey in real Chrome with an organizer and a guest, under the production CSP. API on the disposable
// test schema with FEATURE_SOCIAL_FEED and FEATURE_VERIFIED_EVENTS on. Covers creating an event in the browser's time
// zone, signing up, the organizer's live QR code, checking in through the QR link (the link is read from the same
// endpoint the QR encodes; the image itself is not decoded), XP, the organizer's attendee list, axe, desktop and 360 px.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3004',stamp=Date.now().toString(36);
const axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js',{paths:[process.cwd()]}),'utf8');
const checks=[],errors=[];
async function person(browser,label,viewport){
 const email=`qa-p9event-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile('../../backend/runtime/phase3-qa.json','utf8'));}catch{/* new */}await fs.writeFile('../../backend/runtime/phase3-qa.json',JSON.stringify([...qa,email]));
 const context=await browser.newContext({viewport,serviceWorkers:'block',timezoneId:'Asia/Kolkata'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));});
 await page.goto(root+'/signup');await page.locator('input[name=name]').fill(label);await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(`Synthetic-p9-${stamp}-safe!`);
 await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
 const handle=`qa${label}${stamp}`.toLowerCase().slice(0,30);
 await page.goto(root+'/feed');await page.getByLabel('Handle').fill(handle);await page.getByLabel('Display name').fill(handle);await page.getByRole('button',{name:'Create my profile'}).click();await page.getByRole('heading',{name:'Wins worth sharing.'}).waitFor();
 return {context,page,handle};
}
async function axe(page,name){await page.evaluate(()=>document.querySelectorAll('[data-reveal]').forEach(e=>{e.dataset.reveal='in';}));await page.waitForFunction(()=>document.getAnimations().every(a=>a.effect?.getTiming().iterations===Infinity||a.playState!=='running'),null,{timeout:5000}).catch(()=>{});const v=await page.evaluate(async src=>{eval(src);const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(x=>`${x.impact}:${x.id}:${x.nodes.map(n=>n.target.join(' ')).slice(0,2).join(',')}`);},axeSource);assert.deepEqual(v,[],`${name} axe`);}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let org,guest;
const local=minutes=>{const d=new Date(Date.now()+minutes*60000+5.5*3600000);return d.toISOString().slice(0,16);};  // Asia/Kolkata wall clock
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  org=await person(browser,`o${label[0]}`,viewport);guest=await person(browser,`g${label[0]}`,viewport);
  await guest.page.evaluate(()=>fetch('/api/adventure/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timezone:'Asia/Kolkata'})}));
  const title=`Sunrise run ${stamp} ${label}`;
  await org.page.goto(root+'/events');await org.page.getByRole('button',{name:'Organize an event'}).click();
  await org.page.getByLabel('Title').fill(title);await org.page.getByLabel('Where').fill('Cubbon Park main gate');await org.page.getByLabel(/^Starts/).fill(local(15));
  await Promise.all([org.page.waitForURL('**/events/*'),org.page.getByRole('button',{name:'Create event'}).click()]);
  await org.page.getByRole('heading',{name:title}).waitFor();const eventUrl=org.page.url();checks.push(`${label}: event created in the browser's time zone`);
  await guest.page.goto(eventUrl);await guest.page.getByRole('button',{name:"I'm going"}).click();await guest.page.getByRole('button',{name:"Can't make it"}).waitFor();checks.push(`${label}: guest signs up`);
  await org.page.reload();const qr=org.page.getByRole('img',{name:'Check-in QR code'});await qr.waitFor();assert(await qr.locator('svg').count(),'QR is an inline SVG');
  const id=eventUrl.split('/events/')[1];const code=await org.page.evaluate(id=>fetch(`/api/events/${id}/check-in-code`).then(r=>r.json()),id);
  await guest.page.goto(root+code.path+'?t='+code.token);await guest.page.getByRole('heading',{name:"You're checked in!"}).waitFor();await guest.page.getByText('+50 XP · verified event').waitFor();
  checks.push(`${label}: organizer's live QR → guest checks in → +50 XP`);
  if(label==='desktop')await axe(guest.page,'check-in');
  await guest.page.goto(root+code.path+'?t='+code.token);await guest.page.getByText('You were already checked in.').waitFor();checks.push(`${label}: repeat scan changes nothing`);
  await org.page.reload();await org.page.getByText(/checked in/).first().waitFor();checks.push(`${label}: organizer sees the check-in`);
  if(label==='desktop'){await axe(org.page,'event (organizer)');await guest.page.goto(root+'/events');await guest.page.getByRole('heading',{name:title}).waitFor();await axe(guest.page,'events list');checks.push('axe WCAG 2.2 AA: list, event and check-in clean');}
  if(label==='360px'){for(const p of [org.page,guest.page]){const over=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(over<=0,`horizontal scroll ${over}px`);}checks.push('360px: no horizontal scroll');}
  await org.page.screenshot({path:`../../docs/p9-event-${label}.png`});
  for(const p of [org.page,guest.page])assert.deepEqual(await p.evaluate(()=>window.__csp),[],'CSP violations');
  await org.context.close();await guest.context.close();
 }
 assert.deepEqual(errors,[]);checks.push('no page errors, no CSP violations');
 console.log(JSON.stringify({passed:checks}));
}catch(error){for(const [n,x] of [['org',org],['guest',guest]])if(x)await x.page.screenshot({path:`../../backend/runtime/p9-failure-${n}.png`}).catch(()=>{});throw error;}finally{await browser.close();}

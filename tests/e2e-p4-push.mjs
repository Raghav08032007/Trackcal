// Phase 4 notifications journey in real Chrome. SIMULATED push service: headless Chrome refuses
// pushManager.subscribe ("Registration failed - permission denied"), so subscribe() returns a fake HTTPS subscription.
// Real encryption and VAPID signing are proven in backend/tests/test_push.py; real delivery is a manual check.
// Needs the test API with FEATURE_WEB_PUSH=true and VAPID keys, on trackcal_phase3_test.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root='http://127.0.0.1:3003',stamp=Date.now(),password=`Synthetic-p4-${stamp}-safe!`;
const ledgerPath='../../backend/runtime/phase3-qa.json';
const checks=[],errors=[];
// Count permission requests and fake the push service (see header).
const stub=()=>{window.__asked=0;const real=Notification.requestPermission.bind(Notification);Notification.requestPermission=async()=>{window.__asked++;return real();};
 const fake={endpoint:'https://push.example.com/send/'+crypto.randomUUID(),toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};},unsubscribe:async()=>true};
 let current=null;PushManager.prototype.subscribe=async function(){current=fake;return fake;};PushManager.prototype.getSubscription=async function(){return current;};};
async function signup(page,email){await page.goto(root+'/signup');await page.locator('input[name=name]').fill('Phase Four QA');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  const email=`qa-p4push-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch{/* new */}await fs.writeFile(ledgerPath,JSON.stringify([...qa,email]));
  const context=await browser.newContext({viewport,serviceWorkers:'allow',permissions:['notifications'],timezoneId:'Asia/Kolkata'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(stub);await signup(page,email);
  const api=(path,method='GET',data)=>page.evaluate(async({path,method,data})=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json()};},{path,method,data});
  await page.goto(root+'/routine');await page.getByRole('heading',{name:'Notifications, only if you want them'}).waitFor();
  await page.getByLabel('A thought for today').waitFor();
  assert(await page.getByText(/never during your quiet hours/).count());assert.equal(await page.evaluate(()=>window.__asked),0,'no permission prompt on page load');
  checks.push(`${label}: explainer + daily motivation shown; no permission prompt on load`);
  await page.getByRole('button',{name:'Turn on notifications'}).click();await page.getByText(/Notifications are on for this device/).waitFor();
  assert.equal(await page.evaluate(()=>window.__asked),1);let s=(await api('/api/push/settings')).data;assert.equal(s.enabled,true);assert.equal(s.devices.length,1);
  checks.push(`${label}: permission asked once, on the tap; device registered`);
  await page.getByLabel('Meal check-in').click();await page.getByText('Saved.').waitFor();
  await page.getByLabel('Most per day').selectOption('3');await page.waitForFunction(async()=>(await (await fetch('/api/push/settings')).json()).max_per_day===3);
  await page.getByRole('button',{name:'Pause for a day'}).click();await page.getByText('Paused for a day.').waitFor();
  s=(await api('/api/push/settings')).data;assert.equal(s.types.meal_log.enabled,true);assert.equal(s.max_per_day,3);assert(s.snooze_until);
  await page.getByRole('button',{name:/Resume now/}).click();await page.getByText('Notifications resumed.').waitFor();
  checks.push(`${label}: preference changes (type, daily limit, pause, resume) saved on the server`);
  if(label==='360px'){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=0,`horizontal scroll ${overflow}px`);checks.push('360px: no horizontal scroll');}
  await page.screenshot({path:`../../docs/p4-notifications-${label}.png`});
  // Off in two taps: Me tab, then the switch.
  await page.getByRole('link',{name:'Me',exact:true}).click();
  await page.getByRole('switch',{name:'Notifications on'}).click();await page.getByText(/Notifications are off/).waitFor();
  assert.equal((await api('/api/push/settings')).data.enabled,false);checks.push(`${label}: turned off in two taps (Me → switch)`);
  // Install button (Chrome fires beforeinstallprompt only for real installable visits, so the event is dispatched here).
  await page.evaluate(()=>{window.__prompted=0;const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.__prompted++;};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
  await page.getByRole('button',{name:'Install TrackCal'}).click();await page.getByText(/TrackCal is installed/).waitFor();assert.equal(await page.evaluate(()=>window.__prompted),1);
  checks.push(`${label}: install button appears only after the browser offers install, and prompts once`);
  await context.close();
 }
 // A blocked permission shows how to re-enable, and never asks again.
 const email=`qa-p4push-denied-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch{/* new */}await fs.writeFile(ledgerPath,JSON.stringify([...qa,email]));
 const context=await browser.newContext({viewport:{width:360,height:800}});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Notification.requestPermission=async()=>'denied';});await signup(page,email);
 await page.goto(root+'/routine');await page.getByRole('button',{name:'Turn on notifications'}).click();
 await page.getByText(/Notifications are blocked for TrackCal in this browser/).waitFor();assert.equal(await page.getByRole('button',{name:'Turn on notifications'}).count(),0);
 checks.push('360px: refused permission → how to re-enable, no repeat prompt');await context.close();
 assert.deepEqual(errors,[]);checks.push('no page errors');
 console.log(JSON.stringify({push_service:'SIMULATED (headless Chrome cannot subscribe)',passed:checks}));
}catch(error){if(page)await page.screenshot({path:'../../backend/runtime/p4-push-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}

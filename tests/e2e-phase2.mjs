// Bounded real-browser Phase 2 acceptance. Uses the already installed REA Playwright runtime.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const qa=JSON.parse(await fs.readFile(process.env.PHASE2_QA_PATH||'../../backend/runtime/phase2-qa.json','utf8'));
const root=process.env.PHASE2_TEST_URL||'http://127.0.0.1:3002';const checks=[];
console.log('Launching bounded tablet browser check');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:768,height:1024},reducedMotion:'reduce',colorScheme:'light',timezoneId:'Asia/Calcutta',serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(12000);
 const api=(path,method='GET',data)=>page.evaluate(async({path,method,data})=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json()};},{path,method,data});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/login',{waitUntil:'domcontentloaded'});console.log('Login page loaded');
 await page.locator('input[name=email]').fill(qa.email);await page.locator('input[name=password]').fill(qa.password);
 await Promise.all([page.waitForURL('**/account'),page.getByRole('button',{name:'Sign in',exact:true}).click()]);checks.push('real login');
 await page.goto(root+'/plan',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Weekly activity calendar'}).waitFor();
 let state=(await api('/api/personalization/state')).data;
 const activity=state.plan.activities.find(a=>a.status!=='completed'&&a.template_id!=='recovery'&&!state.preferences.rest_days.includes((new Date(a.day+'T12:00:00Z').getUTCDay()+6)%7));
 assert(activity,'Expected eligible future activity in synthetic plan');
 const alternative=state.eligible_templates.find(t=>t.id!==activity.template_id);assert(alternative);
 const card=page.locator('.personal-activity').filter({has:page.getByRole('heading',{name:activity.template.name,exact:true})}).first();
 const change=page.waitForResponse(r=>r.url().endsWith('/api/personalization/activities/'+activity.id)&&r.request().method()==='POST');
 await card.locator('select').first().selectOption(alternative.id);assert.equal((await change).status(),200);
 state=(await api('/api/personalization/state')).data;assert.equal(state.plan.activities.find(a=>a.id===activity.id).template_id,alternative.id);checks.push('owned activity substitution persisted');
 await page.screenshot({path:'../../docs/phase2-plan-tablet.png'});
 const planAX=await page.locator('body').ariaSnapshot();assert(planAX.includes('Weekly activity calendar'));assert(planAX.includes('Substitute'));checks.push('plan accessible names');
 const edit=page.getByRole('link',{name:'Edit preferences ↗'});await edit.focus();await page.keyboard.press('Enter');await page.waitForURL('**/onboarding');await page.getByRole('progressbar',{name:'Onboarding progress'}).waitFor();
 let step=Number(await page.getByRole('progressbar').getAttribute('value'));
 while(step!==2){const next=step>2?step-1:step+1;const response=page.waitForResponse(r=>r.url().endsWith('/api/personalization/onboarding')&&r.request().method()==='POST');await page.getByRole('button',{name:step>2?'Back':'Next',exact:true}).click();assert.equal((await response).status(),200);await page.waitForFunction(n=>document.querySelector('progress[aria-label="Onboarding progress"]')?.value===n,next);step=next;}
 await page.getByLabel('Display name',{exact:true}).focus();await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement?.tagName==='SELECT'&&document.activeElement.closest('label')?.textContent.startsWith('Age group')));checks.push('keyboard focus and native form navigation');
 const ax=await page.locator('body').ariaSnapshot();for(const name of ['Display name','Age group','Optional private measurements','Onboarding progress'])assert(ax.includes(name));assert(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));checks.push('profile accessibility tree and reduced motion');
 await fs.writeFile('../../docs/phase2-onboarding-accessibility.txt',ax);await page.screenshot({path:'../../docs/phase2-onboarding-tablet.png'});
 // Verify actual dashboard safeguard, not only a mocked component.
 state=(await api('/api/personalization/state')).data;const original=state.preferences;
 let saved=await api('/api/personalization/onboarding','POST',{preferences:{...original,age_group:'under18'},step:state.step,revision:state.revision,complete:false});assert.equal(saved.status,200);
 await page.goto(root+'/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'My goals',exact:true}).click();await page.getByRole('button',{name:'Calculate & Apply Targets'}).click();await page.getByRole('alert').filter({hasText:'confirmed adult age group'}).waitFor();checks.push('live youth calculator bypass rejected');
 state=(await api('/api/personalization/state')).data;saved=await api('/api/personalization/onboarding','POST',{preferences:original,step:state.step,revision:state.revision,complete:false});assert.equal(saved.status,200);
 assert.deepEqual(errors,[]);checks.push('no page errors');
 await fs.writeFile('../../docs/phase2-bounded-browser-evidence.json',JSON.stringify({date:'2026-10-28',viewport:{width:768,height:1024},checks,page_errors:errors,method:'Existing Playwright runtime, loopback production app, synthetic account; bounded action timeouts'},null,2));
 console.log(JSON.stringify({passed:checks}));
}finally{await browser.close();console.log('Owned tablet browser closed');}

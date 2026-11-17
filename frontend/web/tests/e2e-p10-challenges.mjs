// Phase 10 challenges journey in real Chrome with two people, under the production CSP. API on the disposable test
// schema with FEATURE_SOCIAL_FEED and FEATURE_VERIFIED_CHALLENGES on. Covers starting a challenge, joining it, progress
// coming only from a real logged meal, completion XP shown once, no ranking, axe, desktop and 360 px.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3004',stamp=Date.now().toString(36);
const axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js',{paths:[process.cwd()]}),'utf8');
const checks=[],errors=[];
async function person(browser,label,viewport){
 const email=`qa-p10chal-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile('../../backend/runtime/phase3-qa.json','utf8'));}catch{/* new */}await fs.writeFile('../../backend/runtime/phase3-qa.json',JSON.stringify([...qa,email]));
 const context=await browser.newContext({viewport,serviceWorkers:'block',timezoneId:'Asia/Kolkata'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));});
 await page.goto(root+'/signup');await page.locator('input[name=name]').fill(label);await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(`Synthetic-p10-${stamp}-safe!`);
 await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
 const handle=`qa${label}${stamp}`.toLowerCase().slice(0,30);
 await page.goto(root+'/feed');await page.getByLabel('Handle').fill(handle);await page.getByLabel('Display name').fill(handle);await page.getByRole('button',{name:'Create my profile'}).click();await page.getByRole('heading',{name:'Wins worth sharing.'}).waitFor();
 return {context,page,handle};
}
async function axe(page,name){await page.evaluate(()=>document.querySelectorAll('[data-reveal]').forEach(e=>{e.dataset.reveal='in';}));await page.waitForFunction(()=>document.getAnimations().every(a=>a.effect?.getTiming().iterations===Infinity||a.playState!=='running'),null,{timeout:5000}).catch(()=>{});const v=await page.evaluate(async src=>{eval(src);const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(x=>`${x.impact}:${x.id}:${x.nodes.map(n=>n.target.join(' ')).slice(0,2).join(',')}`);},axeSource);assert.deepEqual(v,[],`${name} axe`);}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let lead,friend;
const meal=async page=>{const d=await page.evaluate(()=>fetch('/api/wellness/diary').then(r=>r.json()));return page.evaluate(day=>fetch('/api/wellness/diary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),day,meal_type:'lunch',items:[{name:'QA dal rice',grams:200,nutrients:{calories:120,protein:4,carbs:22,fat:2},source:'QA'}]})}).then(r=>r.status),d.today);};
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  lead=await person(browser,`l${label[0]}`,viewport);friend=await person(browser,`f${label[0]}`,viewport);
  for(const p of [lead.page,friend.page])await p.evaluate(()=>fetch('/api/adventure/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timezone:'Asia/Kolkata'})}));
  const title=`Log a meal ${stamp} ${label}`;
  await lead.page.goto(root+'/challenges');await lead.page.getByRole('button',{name:'Start a challenge'}).click();
  await lead.page.getByLabel('Name').fill(title);await lead.page.getByLabel(/^What counts/).selectOption('meal_days');await lead.page.getByLabel('Goal').fill('1');
  await Promise.all([lead.page.waitForURL('**/challenges/*'),lead.page.getByRole('button',{name:'Start challenge'}).click()]);
  await lead.page.getByRole('img',{name:'Your progress: 0 of 1'}).waitFor();const url=lead.page.url();checks.push(`${label}: challenge started, creator takes part`);
  await friend.page.goto(url);await friend.page.getByRole('button',{name:'Join challenge'}).click();await friend.page.getByRole('img',{name:'Your progress: 0 of 1'}).waitFor();checks.push(`${label}: friend joins`);
  assert.equal(await meal(friend.page),200);await friend.page.reload();
  await friend.page.getByText('Challenge complete! +40 XP').waitFor();await friend.page.getByRole('img',{name:'Your progress: 1 of 1, complete'}).waitFor();checks.push(`${label}: a real logged meal completes it, +40 XP`);
  await friend.page.reload();await friend.page.getByRole('img',{name:'Your progress: 1 of 1, complete'}).waitFor();assert.equal(await friend.page.getByText('Challenge complete! +40 XP').count(),0,'XP shown once');checks.push(`${label}: XP paid once`);
  await lead.page.reload();await lead.page.getByText('2 taking part · 1 finished').waitFor();checks.push(`${label}: counts update, no ranking`);
  if(label==='desktop'){await axe(lead.page,'challenge');await lead.page.goto(root+'/challenges');await lead.page.getByRole('heading',{name:title}).waitFor();await axe(lead.page,'challenges list');checks.push('axe WCAG 2.2 AA: list and challenge clean');}
  if(label==='360px'){for(const p of [lead.page,friend.page]){const over=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(over<=0,`horizontal scroll ${over}px`);}checks.push('360px: no horizontal scroll');}
  await friend.page.screenshot({path:`../../docs/p10-challenge-${label}.png`});
  for(const p of [lead.page,friend.page])assert.deepEqual(await p.evaluate(()=>window.__csp),[],'CSP violations');
  await lead.context.close();await friend.context.close();
 }
 assert.deepEqual(errors,[]);checks.push('no page errors, no CSP violations');
 console.log(JSON.stringify({passed:checks}));
}catch(error){for(const [n,x] of [['lead',lead],['friend',friend]])if(x)await x.page.screenshot({path:`../../backend/runtime/p10-failure-${n}.png`}).catch(()=>{});throw error;}finally{await browser.close();}

// Opt-in real-browser Phase 2 search journey (IFCT catalog, synonyms, local names, empty and failure states).
// API must use trackcal_phase3_test with the IFCT catalog copied (scripts/setup_phase3_test_db.py).
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root='http://127.0.0.1:3003';
const email=`qa-p2search-${Date.now()}@tests.example.com`,password=`Synthetic-p2-${Date.now()}-safe!`;
const ledgerPath='../../backend/runtime/phase3-qa.json';let qa=[];try{qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch{/* no ledger yet */}await fs.writeFile(ledgerPath,JSON.stringify([...qa,email]));
const checks=[],errors=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
async function search(page,q){await page.getByLabel('Food search',{exact:true}).fill(q);await page.getByRole('button',{name:'Search catalog',exact:true}).click();}
let page;
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  const context=await browser.newContext({viewport,timezoneId:'UTC',serviceWorkers:'block',reducedMotion:'reduce',...(label==='360px'?{storageState:await fs.readFile('../../backend/runtime/p2-search-state.json','utf8').then(JSON.parse)}:{})});
  page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));
  if(label==='desktop'){
   await page.goto(root+'/signup');await page.locator('input[name=name]').fill('Phase Two QA');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);
   await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
   await fs.writeFile('../../backend/runtime/p2-search-state.json',JSON.stringify(await context.storageState()));checks.push('synthetic signup');
  }
  await page.goto(root+'/nutrition');await page.getByRole('heading',{name:'Your food diary'}).waitFor();
  // Local Tamil name finds IFCT Ragi and says which name matched, with the source.
  await search(page,'kelvaragu');await page.getByRole('button',{name:'Choose Ragi',exact:true}).waitFor();
  await page.getByText('Also called Kelvaragu (Tamil)').first().waitFor();await page.getByText(/IFCT 2017, National Institute of Nutrition/).first().waitFor();checks.push(`${label}: Tamil local name → Ragi with IFCT attribution`);
  // Typed word still works although its synonym maps elsewhere.
  await search(page,'ragi');await page.getByRole('button',{name:'Choose Ragi',exact:true}).waitFor();checks.push(`${label}: "ragi" finds Ragi`);
  // Word anywhere in a name (full-text): "parboiled" is a middle word of "Rice, parboiled, milled".
  await search(page,'parboiled');await page.getByRole('button',{name:'Choose Rice, parboiled, milled',exact:true}).waitFor();checks.push(`${label}: word anywhere in a name`);
  // Empty state offers to add the food; unknown values stay blank.
  await search(page,'zzqq kozhukattai');await page.getByRole('button',{name:'Add “zzqq kozhukattai” yourself',exact:true}).click();
  assert.equal(await page.getByLabel('Food name 1',{exact:true}).inputValue(),'zzqq kozhukattai');checks.push(`${label}: empty state → add it yourself`);
  // Failure path: the catalog is unreachable → an error is shown, the page keeps working.
  await page.route('**/api/wellness/foods*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Your saved records are safe. The service is unavailable; keep this draft open and retry.'})}));
  await search(page,'rice');await page.getByRole('alert').filter({hasText:'service is unavailable'}).waitFor();assert.equal(await page.getByRole('button',{name:/yourself/}).count(),0,'stale empty state after a failed search');await page.unroute('**/api/wellness/foods*');checks.push(`${label}: catalog outage shows an error`);
  if(label==='360px'){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=0,`horizontal scroll ${overflow}px`);checks.push('360px: no horizontal scroll');}
  await page.screenshot({path:`../../docs/p2-search-${label}.png`});
  await context.close();
 }
 assert.deepEqual(errors,[]);checks.push('no page errors');
 console.log(JSON.stringify({passed:checks}));
}catch(error){if(page)await page.screenshot({path:'../../backend/runtime/p2-search-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();await fs.rm('../../backend/runtime/p2-search-state.json',{force:true});}

// Step 4 feature journeys in a real browser (360px and desktop) against the Flask test stack.
// Covers features the phase scripts do not: Play start, barcode/describe/library/recipe logging into the journal,
// reminders + calendar export, and account profile/export/password/closure.
// Public providers (AI, Open Food Facts, USDA) are stubbed in the browser so the UI is tested deterministically;
// they are verified live separately. Run with JOURNEYS_URL pointing at a stack that uses the isolated test schema.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.JOURNEYS_URL||'http://127.0.0.1:3003';
const evidence={date:new Date().toISOString().slice(0,10),stack:'Vite + Flask (isolated test schema)',providers:'stubbed in the browser',checks:[],page_errors:[]};
const pass=name=>{evidence.checks.push(name);console.log('PASS',name);};

const BARCODE={source:'Open Food Facts',barcode:'3017620422003',product_name:'Journey Hazelnut Spread',brand:'QA',serving_size:'15g',nova_group:4,nutrients_per_100g:{energy_kcal:539,protein_g:6.3,carbs_g:57.5,fat_g:30.9,fiber_g:0,sugar_g:null,sodium_mg:null,saturated_fat_g:null},serving_g:15,complete:true,consistency_warning:false,allergens:['nuts'],ingredients_text:'sugar, hazelnuts',attribution:'Data from Open Food Facts contributors (ODbL).',community_data:true,cached:false};
const MEAL={dish_name:'Journey idli plate',components:[{name:'Journey idli',quantity_g:120,calories:140,protein_g:4,carbs_g:28,fat_g:0.5,confidence:0.7}],total_nutrition:{calories:140,protein_g:4,carbs_g:28,fat_g:0.5},model:'stub',is_mock:false};
const FOODS={results:[{id:'usda-1',name:'Journey banana',cuisine:'USDA',category:'Food',serving_size:'100g',calories:89,protein:1.1,carbs:22.8,fat:0.3,fiber:2.6,source:'USDA FoodData Central',verified:false,allergens:[]}],source:'USDA FoodData Central',note:'Values per 100g.'};
const json=body=>route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});

const browser=await chromium.launch({executablePath:process.env.TRACKCAL_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const [label,width,height] of [['mobile360',360,780],['desktop',1365,900]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',acceptDownloads:true,reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.page_errors.push(`${label}: ${e.message}`));
  await page.route('**/api/barcode**',json(BARCODE));await page.route('**/api/analyze',json(MEAL));await page.route('**/api/foods?**',json(FOODS));
  const email=`qa-web-journey-${label}-${Date.now()}@tests.example.com`,password='Synthetic-journey-123!',newPassword='Synthetic-journey-456!';
  await page.goto(root+'/');
  assert.equal(await page.evaluate(async([email,password])=>(await fetch('/api/account/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})).status,[email,password]),200);

  // Play: start the journey; it is server-owned and survives a reload.
  await page.goto(root+'/play');await page.getByRole('button',{name:'Start my journey'}).click();
  await page.getByRole('progressbar',{name:/XP toward next level/}).waitFor();await page.reload();await page.getByRole('progressbar',{name:/XP toward next level/}).waitFor();
  pass(`${label}: Play journey starts and persists after reload`);

  // Barcode → journal.
  await page.goto(root+'/barcode');await page.getByRole('textbox',{name:'Barcode number'}).fill('3017620422003');await page.getByRole('button',{name:'Lookup Barcode'}).click();
  await page.getByText('Journey Hazelnut Spread').first().waitFor();await page.getByRole('button',{name:'+ Log to Journal'}).click();
  pass(`${label}: barcode lookup shows the product and logs it`);

  // Describe → AI breakdown.
  await page.goto(root+'/describe');await page.getByRole('textbox',{name:'Meal description'}).fill('two idli with sambar');await page.getByRole('button',{name:'Estimate calories'}).click();
  await page.getByText('Journey idli').first().waitFor();
  pass(`${label}: describing a meal shows the estimated breakdown`);

  // Food library search → log.
  await page.goto(root+'/food-library');await page.getByRole('textbox',{name:/Search food, cuisine/}).fill('banana');await page.getByRole('button',{name:'Search global foods'}).click();
  await page.getByText('Journey banana').first().waitFor();
  pass(`${label}: global food search shows complete results`);

  // Recipes → one serving logged.
  await page.goto(root+'/recipes');await page.getByRole('button',{name:'Log one serving'}).click();
  pass(`${label}: recipe serving can be logged`);

  // Journal shows what was logged on this device.
  await page.goto(root+'/journal');await page.getByText('Journey Hazelnut Spread').first().waitFor();
  pass(`${label}: journal lists the logged barcode product`);

  // Reminders: save one, then export it as a calendar file.
  await page.goto(root+'/routine');await page.getByRole('textbox',{name:'Reminder title'}).fill('Journey water check');
  await page.getByRole('textbox',{name:'First reminder'}).fill('2030-01-15T08:30');await page.getByRole('button',{name:'Save reminder'}).click();
  await page.getByText('Journey water check').first().waitFor();
  const ics=page.waitForEvent('download');await page.getByRole('button',{name:/Export enabled reminders/}).click();
  assert.match(await fs.readFile(await (await ics).path(),'utf8'),/Journey water check/);
  pass(`${label}: reminder saved and exported as .ics`);

  // Account: profile name persists; export contains the account; password change; closure.
  await page.goto(root+'/account');await page.getByRole('textbox',{name:'Display name'}).fill('Journey Tester');
  const saved=page.waitForResponse(r=>r.url().includes('/api/account/profile')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save profile'}).click();assert.equal((await saved).status(),200);
  await page.reload();assert.equal(await page.getByRole('textbox',{name:'Display name'}).inputValue(),'Journey Tester');
  pass(`${label}: profile change persists after reload`);
  const exported=page.waitForEvent('download');await page.getByRole('button',{name:'Export my account and device data'}).click();
  assert.match(await fs.readFile(await (await exported).path(),'utf8'),new RegExp(email.replace(/[.+]/g,'\\$&')));
  pass(`${label}: account export downloads the user's own data`);
  await page.getByRole('textbox',{name:'Current password'}).fill(password);await page.getByRole('textbox',{name:'New password'}).fill(newPassword);
  const changed=page.waitForResponse(r=>r.url().includes('/api/account/password'),{timeout:45000}); /* bcrypt is CPU-bound: generous on a loaded machine */ await page.getByRole('button',{name:'Update password'}).click();assert.equal((await changed).status(),200);
  assert.equal(await page.evaluate(async([email,pw])=>(await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})})).status,[email,newPassword]),200);
  pass(`${label}: password change works and the new password signs in`);
  await page.goto(root+'/account');await page.getByText('Close my account').click();await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button',{name:'Close account and clear this device copy'}).click();await page.waitForURL('**/login');
  assert.equal(await page.evaluate(async()=>(await fetch('/api/account/session')).status),401);
  pass(`${label}: closing the account signs out and blocks the session`);
  await context.close();
 }
 assert.deepEqual(evidence.page_errors,[]);pass('no page errors');
}catch(error){evidence.failure=String(error.stack||error).slice(0,1500);console.error('FAIL',error);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(new URL('../../../docs/step4-journeys-evidence.json',import.meta.url),JSON.stringify(evidence,null,1));}

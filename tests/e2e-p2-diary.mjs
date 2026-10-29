// Opt-in real-browser Phase 2c journey: photo preparation before upload, portion range, copy yesterday, delete + undo,
// device journal import (preview, selective copy, no duplicates). API must use trackcal_phase3_test.
// The AI provider is never called: the browser's /api/analyze request is captured and answered here.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root='http://127.0.0.1:3003';
const email=`qa-p2diary-${Date.now()}@tests.example.com`,password=`Synthetic-p2-${Date.now()}-safe!`;
const ledgerPath='../../backend/runtime/phase3-qa.json';let qa=[];try{qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch{/* no ledger yet */}await fs.writeFile(ledgerPath,JSON.stringify([...qa,email]));
const checks=[],errors=[];
const estimate={dish_name:'Test thali',model:'test/none',is_mock:false,components:[{name:'Rice',quantity_g:200,calories:260,protein_g:5,carbs_g:57,fat_g:0.6,confidence:0.6,portion_range_g:[150,260],range_basis:'model',calorie_range:[195,338]}],total_nutrition:{calories:260,protein_g:5,carbs_g:57,fat_g:0.6},calorie_range:[195,338]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  const context=await browser.newContext({viewport,timezoneId:'Asia/Kolkata',serviceWorkers:'block',reducedMotion:'reduce'});
  page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));
  const api=(path,method='GET',data)=>page.evaluate(async({path,method,data})=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json()};},{path,method,data});
  const who=label==='desktop'?email:email.replace('@',`-${label}@`);
  if(label!=='desktop'){qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));await fs.writeFile(ledgerPath,JSON.stringify([...qa,who]));}
  await page.goto(root+'/signup');await page.locator('input[name=name]').fill('Phase Two Diary');await page.locator('input[name=email]').fill(who);await page.locator('input[name=password]').fill(password);
  await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);

  // Photo: the browser shrinks the photo and drops EXIF before upload; the range and confidence are shown.
  let sent=null;await page.route('**/api/analyze',async r=>{sent=JSON.parse(r.request().postData()).image;await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(estimate)});});
  await page.goto(root+'/scanner');await page.getByLabel('Allow this photo to be sent to the configured AI provider').check();
  await page.getByLabel('Meal or nutrition label photo').setInputFiles('../../backend/runtime/p2-phone-photo.jpg');
  await page.getByRole('note').filter({hasText:'Likely 150–260 g'}).waitFor();
  assert(sent?.startsWith('data:image/jpeg;base64,'),'photo sent as JPEG');
  const bytes=Buffer.from(sent.split(',')[1],'base64');assert(!bytes.includes('QAPhoneMaker')&&!bytes.includes('Exif'),'EXIF removed before upload');
  const size=await page.evaluate(src=>new Promise(ok=>{const i=new Image();i.onload=()=>ok([i.naturalWidth,i.naturalHeight]);i.src=src;}),sent);
  assert.deepEqual(size,[512,1024],`upright and at most 1024 px, got ${size}`);
  assert(await page.getByRole('note').filter({hasText:'Medium confidence'}).count());checks.push(`${label}: photo shrunk to ${size.join('x')}, EXIF/GPS removed in the browser, range + confidence shown`);
  await page.unroute('**/api/analyze');

  // Copy yesterday: preview first, then today's diary gets the copy.
  await page.goto(root+'/nutrition');await page.getByRole('heading',{name:'Your food diary'}).waitFor();
  const state=(await api('/api/wellness/diary')).data;const yesterday=new Date(state.today+'T00:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
  assert.equal((await api('/api/wellness/diary','POST',{id:crypto.randomUUID(),day:yesterday.toISOString().slice(0,10),meal_type:'breakfast',items:[{name:'QA idli',grams:120,nutrients:{calories:130,protein:4,carbs:28,fat:0.4},source:'Synthetic'}]})).status,200);
  await page.getByRole('button',{name:"Copy yesterday's meals"}).click();await page.getByText('Copy this meal to today?').waitFor();
  assert.equal((await api('/api/wellness/diary')).data.entries.length,0,'nothing copied before confirming');
  await page.getByRole('button',{name:'Copy 1 meal to today'}).click();await page.getByRole('status').filter({hasText:'Copied 1 meal to today'}).waitFor();
  assert.deepEqual((await api('/api/wellness/diary')).data.entries.map(e=>e.items[0].name),['QA idli']);checks.push(`${label}: copy yesterday with preview`);

  // Delete + undo.
  await page.getByRole('button',{name:'Delete meal'}).click();await page.getByRole('button',{name:'Undo delete'}).click();await page.getByRole('status').filter({hasText:'Meal restored.'}).waitFor();
  assert.equal((await api('/api/wellness/diary')).data.entries.length,1);checks.push(`${label}: delete then undo`);

  // Device journal: preview, untick one, copy; copying again doesn't duplicate.
  const me=(await api('/api/account/session')).data;assert(me.id,'session has the user id');
  await page.evaluate(({key,meals})=>localStorage.setItem(key,JSON.stringify(meals)),{key:`trackcal:account:${me.id}:trackcal:journal:${state.today}`,meals:[{time:'08:00',name:'QA poha',calories:250,protein:5,carbs:40,fat:7,method:'Manual'},{time:'20:00',name:'QA kichdi',calories:400,protein:12,carbs:60,fat:10,method:'Manual'}]});
  for(const round of [1,2]){
   await page.reload();await page.getByRole('button',{name:'Review device meals'}).click();
   await page.getByLabel(/QA kichdi/).uncheck();await page.getByRole('button',{name:'Copy 1 selected meal'}).click();await page.getByRole('status').filter({hasText:'Copied 1 meal to your diary'}).waitFor();
   const names=(await api('/api/wellness/diary')).data.entries.map(e=>e.items[0].name).sort();
   assert.deepEqual(names,['QA idli','QA poha'],`round ${round}: ${names}`);
  }
  await page.getByText('portion not recorded').first().waitFor();checks.push(`${label}: device journal preview, selective copy, no duplicate on repeat, portion shown as not recorded`);
  if(label==='360px'){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=0,`horizontal scroll ${overflow}px`);checks.push('360px: no horizontal scroll');}
  await page.screenshot({path:`../../docs/p2-diary-${label}.png`,fullPage:false});
  await context.close();
 }
 assert.deepEqual(errors,[]);checks.push('no page errors');
 console.log(JSON.stringify({passed:checks}));
}catch(error){if(page)await page.screenshot({path:'../../backend/runtime/p2-diary-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}

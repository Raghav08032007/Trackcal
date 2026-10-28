// Isolated production-browser acceptance for the button-first TrackCal home.
// Run against a local production build at TRACKCAL_E2E_URL; no user accounts/data are used.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3003';
const checks=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.TRACKCAL_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const [name,width,height] of [['desktop',1365,1000],['mobile',320,760],['mobile390',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(name+': '+e.message));
  await page.goto(root);await page.getByRole('heading',{name:'What would help you today?'}).waitFor();
  assert.equal(await page.getByRole('navigation').count(),0);
  for(const path of ['/nutrition','/workouts','/workouts/camera','/plan','/play','/scanner'])assert.equal(await page.locator(`a.destination-card[href="${path}"]`).count(),1);
  assert.equal(await page.locator('input[type=file]').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  checks.push(`${name}: focused home destinations, no nav bar/scanner clutter or horizontal overflow`);
  await page.getByRole('button',{name:/Ask Pip/}).click();await page.getByRole('heading',{name:'Find your next useful step'}).waitFor();
  await page.getByRole('button',{name:'Next step'}).click();await page.getByRole('button',{name:'Why is this useful?'}).click();await page.getByRole('button',{name:'What next?'}).click();
  await page.getByText(/does not award XP/).waitFor();await page.getByRole('button',{name:'Close guidance'}).click();
  checks.push(`${name}: guest companion explains how/why/next without reward side effects`);
  if(name==='desktop')await page.screenshot({path:'../../docs/ux-home-desktop-20261028.png',fullPage:true});
  if(name==='mobile')await page.screenshot({path:'../../docs/ux-home-mobile-20261028.png',fullPage:true});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);
 for(const [path,title] of [['/scanner','Food scanner'],['/barcode','Barcode scan'],['/describe','Describe a meal'],['/food-library','Food library'],['/journal','My journal'],['/recipes','Recipe studio']]){
  const response=await page.goto(root+path);assert.equal(response.status(),200);await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal(await page.locator('details.food-tool-picker').evaluate(e=>e.open),false);await page.getByText('Choose another food tool').click();
  await page.getByRole('button',{name:'My journal',exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  checks.push(`${path}: focused page title, collapsible tool buttons and no horizontal overflow`);
 }
 for(const width of [320,390]){
  await page.setViewportSize({width,height:850});const response=await page.goto(root+'/offline.html');assert.equal(response.status(),200);
  await page.getByRole('heading',{name:'A good habit, even offline.'}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const bounds=await page.locator('main').evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right};});assert(bounds.left>=0&&bounds.right<=width+1);
  checks.push(`offline journal ${width}px: heading and fields fit viewport`);
 }
 assert.deepEqual(errors,[]);
 const evidence={date:'2026-10-28',passed:checks.length,checks,page_errors:errors,scope:'Production Chromium desktop and mobile viewport emulation; synthetic guest session; no physical device, camera or customer data.'};
 await fs.writeFile('../../docs/studio-browser-evidence-20261028.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));await context.close();
}finally{await browser.close();}

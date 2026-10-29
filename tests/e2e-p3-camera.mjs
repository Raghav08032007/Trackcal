// Phase 3 camera journey in real Chrome. SIMULATED camera: Chrome's fake media device (a test pattern, no person), so
// this proves permission handling, lifecycle, privacy, the performance readout, correction and saving, NOT counting
// accuracy. Counting accuracy is covered by landmark fixtures (tests/pose-fixtures.test.ts) and the manual device
// matrix in docs/TEST_REPORT_P3.md. API must use trackcal_phase3_test.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root='http://127.0.0.1:3003',chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const email=`qa-p3cam-${Date.now()}@tests.example.com`,password=`Synthetic-p3-${Date.now()}-safe!`;
const ledgerPath='../../backend/runtime/phase3-qa.json';let qa=[];try{qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch{/* no ledger yet */}await fs.writeFile(ledgerPath,JSON.stringify([...qa,email]));
const checks=[],errors=[];
const probe=()=>{window.__streams=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await original(c);window.__streams.push(s);return s;};window.__live=()=>window.__streams.flatMap(s=>s.getTracks()).filter(t=>t.readyState==='live').length;};
async function signup(page){await page.goto(root+'/signup');await page.locator('input[name=name]').fill('Phase Three Camera');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);}
let page,browser;
try{
 // 1. Denied permission: no fake-UI auto-accept and no granted permission, so Chrome refuses the camera.
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-fake-device-for-media-stream']});
 let context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await signup(page);await context.storageState({path:'../../backend/runtime/p3-cam-state.json'});
 await page.addInitScript(probe);await page.goto(root+'/workouts/camera');
 await page.getByRole('button',{name:'Enable camera'}).click();
 await page.getByRole('alert').filter({hasText:'Camera permission was denied'}).waitFor();
 assert(await page.getByRole('link',{name:/manual workouts/i}).count(),'manual path offered');
 assert.equal(await page.evaluate(()=>window.__live()),0);checks.push('360px: denied permission explained, manual path offered, no live camera');
 await browser.close();

 // 2. Granted (SIMULATED fake camera).
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  context=await browser.newContext({viewport,serviceWorkers:'block',permissions:['camera'],storageState:'../../backend/runtime/p3-cam-state.json'});page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  if(process.env.DEBUG)page.on('console',m=>console.log('console',m.type(),m.text().slice(0,160)));
  const bodies=[];page.on('request',r=>{const d=r.postData();if(d)bodies.push({url:r.url(),size:d.length,frames:/landmark|bitmap|data:image|"frames"/.test(d)});});
  await page.addInitScript(probe);await page.goto(root+'/workouts/camera');await page.getByRole('heading',{name:'Make room for movement.'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__streams.length),0,'no camera before the tap');
  assert(await page.getByText(/Counting accuracy hasn.t been measured on real phones yet/).count(),'experimental label');
  await page.getByRole('button',{name:'Enable camera'}).click();
  await page.getByText('● Camera active — local only').waitFor();
  await page.getByText(/ fps · (GPU|CPU)/).waitFor();
  const readout=await page.getByText(/ fps · (GPU|CPU)/).first().textContent();checks.push(`${label}: camera only after tap; local model running (${readout.trim().split('· ').slice(-2).join('· ')})`);
  const plus=page.getByRole('button',{name:'Add one rep'}).first();await plus.click();await plus.click();await plus.click();await page.getByRole('button',{name:'Remove one rep'}).first().click();
  assert.equal(await page.getByLabel('Current repetitions',{exact:true}).textContent(),'2');checks.push(`${label}: +/- correction while tracking`);
  if(label==='desktop'){
   await page.getByRole('button',{name:'End & review session'}).click();
   assert.equal(await page.evaluate(()=>window.__live()),0,'camera off at review');
   await page.getByLabel('Recorded session minutes').fill('1');
   const saved=page.waitForResponse(r=>/\/api\/wellness\/sessions\/[0-9a-f-]+$/.test(r.url())&&r.request().method()==='PUT');
   await page.getByRole('button',{name:'Confirm & save workout'}).click();const body=await (await saved).json();
   const tracking=body.session.details.tracking;
   assert.equal(tracking.version,2);assert.deepEqual(Object.keys(tracking.sets[0]).sort(),['corrected_reps','duration_s','estimated_reps']);assert.equal(tracking.sets[0].corrected_reps,2);
   assert.deepEqual(Object.keys(tracking).sort(),['confidence_mean','engine','exercise_type','large_edit','low_confidence_frames','sampled_frames','sets','version']);
   checks.push('desktop: saved session holds only the v2 summary (counts, duration, confidence, edit flag), no frames');
  }else{
   await page.getByRole('link',{name:'Move',exact:true}).click();await page.waitForURL('**/workouts');
   assert.equal(await page.evaluate(()=>window.__live?.()??0),0);checks.push('360px: leaving the page stops every camera track');
  }
  assert(bodies.every(b=>!b.frames&&b.size<20000),`request carried frame data: ${JSON.stringify(bodies.filter(b=>b.frames||b.size>=20000))}`);checks.push(`${label}: no request carried image or landmark data`);
  await page.screenshot({path:`../../docs/p3-camera-${label}.png`}).catch(()=>{});
  await context.close();
 }
 assert.deepEqual(errors,[]);checks.push('no page errors');
 console.log(JSON.stringify({camera:'SIMULATED (Chrome fake media device)',passed:checks}));
}catch(error){if(page)console.error('page state:',await page.evaluate(()=>[...document.querySelectorAll('[role=alert],.camera-notice,.camera-stage-top strong')].map(e=>e.textContent).join(' | ')).catch(()=>''));if(page)await page.screenshot({path:'../../backend/runtime/p3-camera-failure.png'}).catch(()=>{});throw error;}finally{await browser?.close();await fs.rm('../../backend/runtime/p3-cam-state.json',{force:true});}

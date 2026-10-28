// Phase 1 privacy acceptance in a real Chromium browser (SIMULATED camera: Chromium fake media device).
// Proves: camera starts only after a tap; every media track stops on route change, tab hide and pagehide;
// no request carries video or frame data; the AI food scan sends nothing before consent.
// Run against a production build at TRACKCAL_E2E_URL with the API reachable. Creates one synthetic account.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3010';
const evidence={run_at:new Date().toISOString(),camera:'SIMULATED (Chromium --use-fake-device-for-media-stream)',checks:[],failures:[]};
const pass=(name)=>{evidence.checks.push(name);console.log('PASS',name);};

// Wraps getUserMedia so the test can see every stream the page opens and whether its tracks are still live.
const probe=()=>{
 window.__gum=[];window.__streams=[];
 const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async(constraints)=>{window.__gum.push({at:performance.now(),constraints:JSON.stringify(constraints)});const stream=await original(constraints);window.__streams.push(stream);return stream;};
 window.__live=()=>window.__streams.flatMap(s=>s.getTracks()).filter(t=>t.readyState==='live').length;
};
const frameLike=(request)=>{
 const type=(request.headers()['content-type']||'').toLowerCase(),body=request.postDataBuffer();
 return /^(image|video)\//.test(type)||type.includes('multipart')||type.includes('octet-stream')||(body&&body.length>200000)||(body&&/data:(image|video)\//.test(body.toString('latin1',0,Math.min(body.length,4096))));
};

const browser=await chromium.launch({executablePath:process.env.TRACKCAL_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
try{
 for(const [label,width,height] of [['mobile360',360,780],['desktop',1365,900]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',permissions:['camera']});
  await context.addInitScript(probe);
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const outgoing=[];page.on('request',r=>{if(r.method()!=='GET')outgoing.push({url:r.url(),method:r.method(),frameLike:frameLike(r)});});
  await page.goto(root+'/');
  const email=`qa-privacy-${label}-${Date.now()}@tests.example.com`;
  const signup=await page.evaluate(async(email)=>{const r=await fetch('/api/account/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Synthetic-privacy-test-123!'})});return r.status;},email);
  assert.equal(signup,200,'synthetic signup');

  // 1. No camera before a tap.
  await page.goto(root+'/workouts/camera');
  const enable=page.getByRole('button',{name:'Enable camera'});await enable.waitFor();
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>window.__gum.length),0);pass(`${label}: camera page opens without requesting the camera`);

  // 2. Tap starts the camera; tab hide stops every track.
  await enable.click();await page.waitForFunction(()=>window.__live()>0);
  pass(`${label}: camera starts after the user taps Enable camera`);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__live()===0);pass(`${label}: all media tracks stop when the tab is hidden`);
  await page.evaluate(()=>{delete document.visibilityState;delete document.hidden;});

  // 3. pagehide stops every track.
  await page.getByRole('button',{name:/Resume tracking|Enable camera/}).first().click();await page.waitForFunction(()=>window.__live()>0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
  await page.waitForFunction(()=>window.__live()===0);pass(`${label}: all media tracks stop on pagehide`);

  // 4. Client-side route change (unmount) stops every track.
  await page.getByRole('button',{name:/Resume tracking|Enable camera/}).first().click();await page.waitForFunction(()=>window.__live()>0);
  await page.waitForTimeout(2000); // let pose inference run on real frames before leaving
  await page.evaluate(()=>{const a=document.querySelector('a[href="/workouts"]');if(!a)throw Error('no in-app link to /workouts');a.click();});
  await page.waitForURL(u=>new URL(u).pathname==='/workouts');
  await page.waitForFunction(()=>window.__live()===0);pass(`${label}: all media tracks stop when navigating away (unmount)`);

  // 5. Nothing frame-like left the browser during the camera session.
  const leaked=outgoing.filter(r=>r.frameLike);
  assert.deepEqual(leaked,[]);pass(`${label}: no request carried video or frame data (${outgoing.length} non-GET requests inspected)`);

  // 6. AI scan sends nothing before consent.
  outgoing.length=0;
  await page.goto(root+'/scanner');
  const file=page.locator('input[type=file]').first();await file.waitFor({state:'attached'});
  await file.setInputFiles({name:'meal.jpg',mimeType:'image/jpeg',buffer:await fs.readFile(new URL('./fixtures/meal.jpg',import.meta.url))});
  await page.waitForTimeout(2500);
  const analyze=outgoing.filter(r=>/\/api\/analyze|\/scan\//.test(r.url)||r.frameLike);
  assert.deepEqual(analyze,[]);
  await page.getByText(/Confirm AI consent/).waitFor();pass(`${label}: selecting a photo without AI consent sends nothing and says why`);
  // Positive control: after consent the detector does see the upload (intercepted, so nothing reaches a provider).
  await page.route('**/api/analyze**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"intercepted by test"}'}));
  await page.getByRole('checkbox',{name:/Allow this photo to be sent/}).check();
  await page.getByRole('button',{name:/Analyze selected photo/}).click();
  await page.waitForRequest(r=>/\/api\/analyze/.test(r.url()));pass(`${label}: positive control: consented analysis request is detected (intercepted locally)`);
  await context.close();
 }
}catch(error){evidence.failures.push(String(error.stack||error));console.error('FAIL',error);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(new URL('../../../docs/phase1-privacy-browser-evidence.json',import.meta.url),JSON.stringify(evidence,null,1));}

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

// Chromium's fake camera is occasionally unavailable on first acquisition (NotFoundError or an ended track).
// The app reports that and offers retry; the test retries through the same button, at most twice, and records it.
evidence.camera_start_retries=[];
const startCamera=async(page,label)=>{
 for(let attempt=0;;attempt++){
  await page.getByRole('button',{name:/Resume tracking|Enable camera/}).first().click();
  try{await page.waitForFunction(()=>window.__live()>0,null,{timeout:8000});return;}
  catch(error){
   const shown=await page.locator('main').innerText(),reason=/requested device not found|camera disconnected/i.exec(shown);
   if(attempt>=2||!reason){evidence.camera_start_failure={label,attempt,status:(shown.match(/Session: [^\n]+/)||['?'])[0],page_text:shown.slice(0,600)};throw error;}
   evidence.camera_start_retries.push(`${label}: ${reason[0]}`);
  }
 }
};
// One browser per viewport: Chromium's fake camera can stay held inside a browser process after a context closes.
const launch=()=>chromium.launch({executablePath:process.env.TRACKCAL_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
let browser;
try{
 for(const [label,width,height] of [['mobile360',360,780],['desktop',1365,900]]){
  browser=await launch();
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
  await startCamera(page,label);
  pass(`${label}: camera starts after the user taps Enable camera`);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__live()===0);pass(`${label}: all media tracks stop when the tab is hidden`);
  await page.evaluate(()=>{delete document.visibilityState;delete document.hidden;});

  // 3. pagehide stops every track.
  await startCamera(page,label);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
  await page.waitForFunction(()=>window.__live()===0);pass(`${label}: all media tracks stop on pagehide`);

  // 4. Client-side route change (unmount) stops every track.
  await startCamera(page,label);
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
  const analyzed=page.waitForRequest(r=>/\/api\/analyze/.test(r.url())); // armed before the click: a fast request must not be missed
  await page.getByRole('button',{name:/Analyze selected photo/}).click();
  await analyzed;pass(`${label}: positive control: consented analysis request is detected (intercepted locally)`);
  await context.close();await browser.close();browser=null;
 }
}catch(error){evidence.failures.push(String(error.stack||error));console.error('FAIL',error);process.exitCode=1;}
finally{if(browser)await browser.close();await fs.writeFile(new URL('../../../docs/phase1-privacy-browser-evidence.json',import.meta.url),JSON.stringify(evidence,null,1));}

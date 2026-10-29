// Phase 5 Premium journey in real Chrome. SIMULATED Razorpay: the API runs with RAZORPAY_SIMULATED=1 (APP_ENV=testing
// only), and checkout.razorpay.com is answered by a stand-in that signs the result with the test key secret, so the
// server's real signature check runs. Webhooks are sent here with a real HMAC. Never uses Live or Test Mode keys.
import {createRequire} from 'node:module';
import {createHmac,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root='http://127.0.0.1:3003',api='http://127.0.0.1:8003',stamp=Date.now(),password=`Synthetic-p5-${stamp}-safe!`;
const KEY_SECRET='e2e-test-key-secret-0123456789',WEBHOOK_SECRET='e2e-test-webhook-secret-0123456789';
const ledgerPath='../../backend/runtime/phase3-qa.json',checks=[],errors=[];
// Stand-in for Razorpay Checkout: "pays" when opened and signs payment_id|subscription_id like Razorpay does.
const fakeCheckout=`window.Razorpay=function(o){this.o=o;};window.Razorpay.prototype.on=function(){};
window.Razorpay.prototype.open=async function(){const o=this.o;window.__checkout=o;const pay='pay_sim'+Math.random().toString(16).slice(2,10);
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(${JSON.stringify(KEY_SECRET)}),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(pay+'|'+o.subscription_id)))].map(b=>b.toString(16).padStart(2,'0')).join('');
setTimeout(()=>o.handler({razorpay_payment_id:pay,razorpay_subscription_id:o.subscription_id,razorpay_signature:sig}),300);};`;
async function webhook(event,subscriptionId,extra={}){
 const raw=JSON.stringify({event,payload:{subscription:{entity:{id:subscriptionId,...extra}}}});
 const r=await fetch(api+'/api/v1/billing/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Razorpay-Signature':createHmac('sha256',WEBHOOK_SECRET).update(raw).digest('hex'),'X-Razorpay-Event-Id':'evt_'+randomUUID()},body:raw});
 assert.equal(r.status,200);return r.json();
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  const email=`qa-p5premium-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch{/* new */}await fs.writeFile(ledgerPath,JSON.stringify([...qa,email]));
  const context=await browser.newContext({viewport,serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const external=[];page.on('request',r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname))external.push(u.host);});
  await page.route('https://checkout.razorpay.com/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:fakeCheckout}));
  const call=(path,method='GET',data)=>page.evaluate(async({path,method,data})=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json()};},{path,method,data});
  await page.goto(root+'/signup');await page.locator('input[name=name]').fill('Phase Five QA');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
  await page.goto(root+'/premium');await page.getByRole('heading',{name:/₹99/}).waitFor();
  assert(await page.getByText('Save 33%').count());assert(await page.getByText(/7 days free, then ₹99 a month/).count());assert(await page.getByText('Camera rep counting').count());
  assert.equal(external.filter(h=>h.includes('razorpay')).length,0,'Razorpay not loaded before the tap');
  checks.push(`${label}: prices, saving, trial terms and always-free list shown; Razorpay not loaded before a tap`);
  await page.getByRole('button',{name:'Start free trial'}).first().click();
  await page.getByRole('heading',{name:"You're on the free trial"}).waitFor();await page.getByText(/unless you cancel before then/).waitFor();
  let status=(await call('/api/billing/status')).data;assert.equal(status.status,'trialing');assert.equal(status.premium,true);assert.equal(status.ai_daily_limit,100);
  const subscriptionId=await page.evaluate(()=>window.__checkout.subscription_id);
  checks.push(`${label}: checkout → server-verified signature → 7-day trial with Premium perks`);
  assert.equal((await call('/api/adventure/initialize','POST',{timezone:'UTC'})).status,200);
  assert.equal((await call('/api/adventure/settings','POST',{character_id:'pip',accessory:'star'})).status,200);checks.push(`${label}: Premium accessory accepted`);
  await page.getByRole('link',{name:'Me',exact:true}).click();await page.getByText(/Premium is on/).waitFor();
  await page.goto(root+'/premium');await page.getByRole('button',{name:'Cancel Premium'}).click();await page.getByRole('button',{name:'Yes, cancel Premium'}).click();
  await page.getByText(/Cancelled\. You keep Premium until/).waitFor();status=(await call('/api/billing/status')).data;assert.equal(status.status,'cancelled');assert.equal(status.premium,true);
  checks.push(`${label}: cancel in two taps with confirmation; Premium kept until the trial ends`);
  await webhook('subscription.halted',subscriptionId);status=(await call('/api/billing/status')).data;assert.equal(status.premium,false);assert.equal(status.ai_daily_limit,15);
  const summary=(await call('/api/adventure/summary')).data;assert.equal(summary.customization.accessory,'none');
  checks.push(`${label}: signed webhook ends Premium; perks and accessory fall back`);
  if(label==='360px'){await page.goto(root+'/premium');await page.getByRole('heading',{name:/₹99/}).waitFor();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=0,`horizontal scroll ${overflow}px`);checks.push('360px: no horizontal scroll');}
  await page.goto(root+'/premium');await page.getByRole('heading',{name:/₹99|₹799/}).first().waitFor();await page.screenshot({path:`../../docs/p5-premium-${label}.png`});
  const leaked=external.filter(h=>!h.includes('razorpay'));assert.deepEqual(leaked,[],'no other third-party requests');
  await context.close();
 }
 const forged=await fetch(api+'/api/v1/billing/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Razorpay-Signature':'0'.repeat(64)},body:'{}'});assert.equal(forged.status,400);checks.push('forged webhook refused');
 assert.deepEqual(errors,[]);checks.push('no page errors');
 console.log(JSON.stringify({razorpay:'SIMULATED (test-only gateway, stand-in checkout script)',passed:checks}));
}catch(error){if(page)await page.screenshot({path:'../../backend/runtime/p5-premium-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}

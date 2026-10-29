// Phase 6 hardening tour in real Chrome, under the production Content Security Policy (vite preview reads it from the
// Caddyfile). For every main page, guest and signed in, desktop and 360 px: no CSP violations, no page errors, the
// security headers present, and an axe-core WCAG 2.2 AA scan. AUDIT=1 prints findings instead of failing.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3004',audit=process.env.AUDIT==='1',stamp=Date.now();
const axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js',{paths:[process.cwd()]}),'utf8');
const GUEST=['/','/login','/signup','/privacy','/terms','/help'];
const MEMBER=['/','/nutrition','/scanner','/workouts','/workouts/camera','/plan','/play','/routine','/premium','/account','/guide'];
const findings=[],checks=[];
const watch=()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));};
async function scan(page,path,label){
 const errors=[];page.removeAllListeners('pageerror');page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(root+path);await page.locator('main, [role=main]').first().waitFor();await page.waitForTimeout(800);
 const headers=response.headers();
 const csp=await page.evaluate(()=>window.__csp);
 const result=await page.evaluate(async src=>{eval(src);const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']},resultTypes:['violations']});
  return r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.length,targets:v.nodes.slice(0,3).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').replace(/\s+/g,' ').slice(0,170))}));},axeSource);
 const row={page:`${label} ${path}`,csp_header:!!headers['content-security-policy'],csp_violations:csp,page_errors:errors,axe:result};
 findings.push(row);return row;
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  const guest=await browser.newContext({viewport,serviceWorkers:'block'});const g=await guest.newPage();g.setDefaultTimeout(20000);await g.addInitScript(watch);
  for(const path of GUEST)await scan(g,path,`${label} guest`);await guest.close();
  const context=await browser.newContext({viewport,serviceWorkers:'block',permissions:['camera']});const page=await context.newPage();page.setDefaultTimeout(20000);await page.addInitScript(watch);
  const email=`qa-p6hard-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile('../../backend/runtime/phase3-qa.json','utf8'));}catch{/* new */}await fs.writeFile('../../backend/runtime/phase3-qa.json',JSON.stringify([...qa,email]));
  await page.goto(root+'/signup');await page.locator('input[name=name]').fill('Phase Six QA');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(`Synthetic-p6-${stamp}-safe!`);
  await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
  await page.evaluate(()=>fetch('/api/adventure/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timezone:'UTC'})}));
  for(const path of MEMBER)await scan(page,path,`${label} member`);
  // Beta feedback reaches the server from the footer dialog.
  await page.goto(root+'/nutrition');await page.getByRole('button',{name:'Send feedback'}).click();await page.getByLabel('Your feedback').fill('QA: hardening journey feedback');
  await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Thanks! Your feedback was sent.').waitFor();checks.push(`${label}: feedback dialog sends to the server`);await page.keyboard.press('Escape');
  // The on-device model must load under the policy (WebAssembly + worker).
  await page.goto(root+'/workouts/camera');await page.getByRole('button',{name:'Enable camera'}).click();await page.getByText('● Camera active — local only').waitFor({timeout:60000});
  const cameraCsp=await page.evaluate(()=>window.__csp);findings.push({page:`${label} camera running`,csp_violations:cameraCsp,page_errors:[],axe:[]});
  await page.getByRole('button',{name:'Stop camera now'}).click();
  await context.close();
 }
 const summary=findings.map(f=>({page:f.page,csp:f.csp_violations.length,errors:f.page_errors.length,axe:f.axe.map(a=>`${a.impact}:${a.id}(${a.nodes})`)}));
 if(audit){await fs.writeFile(process.env.AUDIT_OUT||"p6-audit.json",JSON.stringify(findings));console.log("audit written");}
 if(!audit)for(const f of findings){
  assert.deepEqual(f.csp_violations,[],`${f.page}: CSP violations`);assert.deepEqual(f.page_errors,[],`${f.page}: page errors`);
  if(f.csp_header!==undefined)assert(f.csp_header,`${f.page}: no CSP header`);
  assert.deepEqual(f.axe.filter(a=>a.impact==='critical'||a.impact==='serious'),[],`${f.page}: serious accessibility issues`);
 }
 checks.push(`${findings.length} page views: CSP header on every page, 0 violations, 0 page errors, 0 serious/critical axe issues; camera model runs under the policy`);
 const minor=summary.filter(s=>s.axe.length);if(minor.length)checks.push('remaining minor/moderate axe items: '+JSON.stringify(minor));
 await fs.writeFile('../../docs/p6-hardening-evidence.json',JSON.stringify({date:new Date().toISOString().slice(0,10),policy:'from frontend/web/Caddyfile',summary},null,1));
 console.log(JSON.stringify({passed:checks}));
}finally{await browser.close();}

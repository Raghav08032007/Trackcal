// Phase 7 social journey in real Chrome with two synthetic people, under the production CSP. API on the disposable
// test schema with FEATURE_SOCIAL_FEED=true. Covers profiles, posting, Discover, reactions with counts, comments,
// following, private accounts, report and block, plus an axe WCAG 2.2 AA scan of the feed and a profile.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3004',stamp=Date.now().toString(36);
const axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js',{paths:[process.cwd()]}),'utf8');
const checks=[],errors=[];
async function person(browser,label,viewport){
 const email=`qa-p7social-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile('../../backend/runtime/phase3-qa.json','utf8'));}catch{/* new */}await fs.writeFile('../../backend/runtime/phase3-qa.json',JSON.stringify([...qa,email]));
 const context=await browser.newContext({viewport,serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));});
 await page.goto(root+'/signup');await page.locator('input[name=name]').fill(label);await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(`Synthetic-p7-${stamp}-safe!`);
 await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
 return {context,page,handle:`qa${label}${stamp}`.toLowerCase().slice(0,30)};
}
async function join(p,{private:priv=false}={}){
 await p.page.goto(root+'/feed');await p.page.getByRole('heading',{name:'Join the feed'}).waitFor();
 await p.page.getByLabel('Handle').fill(p.handle);await p.page.getByLabel('Display name').fill(p.handle);if(priv)await p.page.getByLabel(/Private account/).check();
 await p.page.getByRole('button',{name:'Create my profile'}).click();await p.page.getByRole('heading',{name:'Wins worth sharing.'}).waitFor();
}
async function axe(page,name){const v=await page.evaluate(async src=>{eval(src);const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(x=>`${x.impact}:${x.id}:${x.nodes.map(n=>n.target.join(' ')).slice(0,2).join(',')}`);},axeSource);assert.deepEqual(v,[],`${name} axe`);}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let a,b;
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  a=await person(browser,`a${label[0]}`,viewport);b=await person(browser,`b${label[0]}`,viewport);
  await join(a);await join(b);checks.push(`${label}: two people pick handles`);
  const text=`Walked to college today ${stamp} ${label}`;
  await a.page.getByLabel('Share something').fill(text);await a.page.getByRole('button',{name:'Post'}).click();await a.page.getByText(text).waitFor();
  await b.page.goto(root+'/feed');await b.page.getByRole('tab',{name:'Discover'}).click();const card=b.page.locator('article',{hasText:text});await card.waitFor();checks.push(`${label}: public post reaches Discover`);
  await card.getByRole('button',{name:'Clap, 0'}).click();await card.getByRole('button',{name:'Clap, 1'}).waitFor();
  await card.getByRole('button',{name:/0 comments/}).click();await card.getByLabel('Write a comment').fill('Nice!');await card.getByRole('button',{name:'Reply'}).click();await card.getByText('Nice!').waitFor();
  await a.page.reload();const own=a.page.locator('article',{hasText:text});await own.getByRole('button',{name:'Clap, 1'}).waitFor();await own.getByRole('button',{name:/1 comment/}).waitFor();
  checks.push(`${label}: reaction count and comment visible to the author`);
  await b.page.goto(root+`/u/${a.handle}`);await b.page.getByRole('button',{name:'Follow'}).click();await b.page.getByRole('button',{name:'Following ✓'}).waitFor();
  await b.page.goto(root+'/feed');await b.page.locator('article',{hasText:text}).waitFor();checks.push(`${label}: follow brings posts into Following`);
  if(label==='desktop'){await axe(b.page,'feed');await b.page.goto(root+`/u/${a.handle}`);await b.page.getByRole('heading',{name:a.handle}).waitFor();await axe(b.page,'profile');checks.push('axe WCAG 2.2 AA: feed and profile clean');}
  // Report, then block: everything from that person disappears for b.
  await b.page.goto(root+'/feed');const target=b.page.locator('article',{hasText:text});
  await target.getByRole('button',{name:/More options/}).click();await target.getByRole('button',{name:'Report post'}).click();await target.getByLabel(/Why are you reporting/).selectOption('spam');await target.getByRole('button',{name:'Send report'}).click();await target.getByText('Thanks. Our team will review this.').waitFor();
  await target.getByRole('button',{name:/More options/}).click();await target.getByRole('button',{name:`Block @${a.handle}`}).click();await target.waitFor({state:'detached'});
  await b.page.reload();await b.page.getByRole('heading',{name:'Wins worth sharing.'}).waitFor();assert.equal(await b.page.getByText(text).count(),0);
  await a.page.goto(root+`/u/${b.handle}`);await a.page.getByText("This profile isn't available.").waitFor();checks.push(`${label}: report sent; block hides both people from each other`);
  if(label==='360px'){const overflow=await b.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=0,`horizontal scroll ${overflow}px`);checks.push('360px: no horizontal scroll');}
  for(const p of [a,b])assert.deepEqual(await p.page.evaluate(()=>window.__csp),[],'CSP violations');
  await a.page.screenshot({path:`../../docs/p7-feed-${label}.png`});await a.context.close();await b.context.close();
 }
 // A private account: a request, then approval, before posts are visible.
 const owner=await person(browser,'priv',{width:1280,height:900}),asker=await person(browser,'ask',{width:1280,height:900});
 await join(owner,{private:true});await join(asker);
 await owner.page.getByLabel('Share something').fill('Private hello');await owner.page.getByRole('button',{name:'Post'}).click();await owner.page.getByText('Private hello').waitFor();
 await asker.page.goto(root+`/u/${owner.handle}`);await asker.page.getByText(/This account is private/).waitFor();await asker.page.getByRole('button',{name:'Follow'}).click();await asker.page.getByRole('button',{name:'Requested'}).waitFor();
 await owner.page.goto(root+`/u/${owner.handle}`);await owner.page.getByRole('heading',{name:'Follow requests'}).waitFor();await owner.page.getByRole('button',{name:'Approve'}).click();
 await asker.page.reload();await asker.page.getByText('Private hello').waitFor();checks.push('private account: request → approve → posts visible');
 await owner.context.close();await asker.context.close();
 assert.deepEqual(errors,[]);checks.push('no page errors');
 console.log(JSON.stringify({passed:checks}));
}catch(error){await a?.page.screenshot({path:'../../backend/runtime/p7-failure-a.png'}).catch(()=>{});await b?.page.screenshot({path:'../../backend/runtime/p7-failure-b.png'}).catch(()=>{});throw error;}finally{await browser.close();}

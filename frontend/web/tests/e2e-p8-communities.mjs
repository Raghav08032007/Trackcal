// Phase 8 communities journey in real Chrome with two synthetic people, under the production CSP. API on the
// disposable test schema with FEATURE_SOCIAL_FEED and FEATURE_COMMUNITIES on. Covers creating a private community,
// a join request and approval, posting, a reaction and a comment, reporting, community moderation (hide), banning,
// community posts staying out of the main feed, axe WCAG 2.2 AA, desktop and 360 px.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const root=process.env.TRACKCAL_E2E_URL||'http://127.0.0.1:3004',stamp=Date.now().toString(36);
const axeSource=await fs.readFile(require.resolve('axe-core/axe.min.js',{paths:[process.cwd()]}),'utf8');
const checks=[],errors=[];
async function person(browser,label,viewport){
 const email=`qa-p8comm-${label}-${stamp}@tests.example.com`;let qa=[];try{qa=JSON.parse(await fs.readFile('../../backend/runtime/phase3-qa.json','utf8'));}catch{/* new */}await fs.writeFile('../../backend/runtime/phase3-qa.json',JSON.stringify([...qa,email]));
 const context=await browser.newContext({viewport,serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));});
 await page.goto(root+'/signup');await page.locator('input[name=name]').fill(label);await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(`Synthetic-p8-${stamp}-safe!`);
 await Promise.all([page.waitForURL('**/onboarding'),page.getByRole('button',{name:'Create free account'}).click()]);
 const handle=`qa${label}${stamp}`.toLowerCase().slice(0,30);
 await page.goto(root+'/feed');await page.getByLabel('Handle').fill(handle);await page.getByLabel('Display name').fill(handle);await page.getByRole('button',{name:'Create my profile'}).click();await page.getByRole('heading',{name:'Wins worth sharing.'}).waitFor();
 return {context,page,handle};
}
async function axe(page,name){await page.evaluate(()=>document.querySelectorAll('[data-reveal]').forEach(e=>{e.dataset.reveal='in';}));await page.waitForFunction(()=>document.getAnimations().every(a=>a.effect?.getTiming().iterations===Infinity||a.playState!=='running'),null,{timeout:5000}).catch(()=>{});const v=await page.evaluate(async src=>{eval(src);const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(x=>`${x.impact}:${x.id}:${x.nodes.map(n=>n.target.join(' ')).slice(0,2).join(',')}`);},axeSource);assert.deepEqual(v,[],`${name} axe`);}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let owner,member;
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['360px',{width:360,height:800}]]){
  owner=await person(browser,`o${label[0]}`,viewport);member=await person(browser,`m${label[0]}`,viewport);
  const name=`Dawn Yoga ${stamp} ${label}`;
  await owner.page.goto(root+'/communities');await owner.page.getByRole('button',{name:'Start a community'}).click();
  await owner.page.getByLabel('Name').fill(name);await owner.page.getByLabel('Who can join').selectOption('private');await owner.page.getByRole('button',{name:'Create community'}).click();
  await owner.page.getByRole('heading',{name}).waitFor();const slug=new URL(owner.page.url()).pathname.split('/').pop();checks.push(`${label}: private community created at /c/${slug}`);
  await owner.page.getByLabel('Post to this community').fill('Members-only welcome');await owner.page.getByRole('button',{name:'Post',exact:true}).click();await owner.page.getByText('Members-only welcome').waitFor();
  await member.page.goto(root+`/c/${slug}`);await member.page.getByText(/This community is private/).waitFor();assert.equal(await member.page.getByText('Members-only welcome').count(),0);
  await member.page.getByRole('button',{name:'Request to join'}).click();await member.page.getByText('Request sent. A moderator will review it.').waitFor();
  await owner.page.reload();await owner.page.getByRole('tab',{name:'Requests (1)'}).click();await owner.page.getByRole('button',{name:'Approve'}).click();await owner.page.getByText('No requests waiting.').waitFor();
  await member.page.reload();const card=member.page.locator('article',{hasText:'Members-only welcome'});await card.waitFor();checks.push(`${label}: request → approve → member sees posts`);
  await card.getByRole('button',{name:'Hug, 0'}).click();await card.getByRole('button',{name:'Hug, 1'}).waitFor();
  await card.getByRole('button',{name:/0 comments/}).click();await card.getByLabel('Write a comment').fill('Thanks for having me');await card.getByRole('button',{name:'Reply'}).click();await card.getByText('Thanks for having me').waitFor();
  await member.page.getByLabel('Post to this community').fill(`Spammy link ${label}`);await member.page.getByRole('button',{name:'Post',exact:true}).click();
  const spam=member.page.locator('article',{hasText:`Spammy link ${label}`});await spam.waitFor();checks.push(`${label}: member reacts, comments and posts`);
  await owner.page.goto(root+'/feed');await owner.page.getByRole('tab',{name:'Discover'}).click();await owner.page.waitForTimeout(500);assert.equal(await owner.page.getByText(`Spammy link ${label}`).count(),0,'community post leaked to Discover');
  checks.push(`${label}: community posts stay out of the main feed`);
  await owner.page.goto(root+`/c/${slug}`);const flagged=owner.page.locator('article',{hasText:`Spammy link ${label}`});await flagged.getByRole('button',{name:/More options/}).click();await flagged.getByRole('button',{name:'Report post'}).click();
  await flagged.getByLabel(/Why are you reporting/).selectOption('spam');await flagged.getByRole('button',{name:'Send report'}).click();await flagged.getByText('Thanks. Our team will review this.').waitFor();
  await owner.page.getByRole('tab',{name:'Reports'}).click();await owner.page.getByText(`Spammy link ${label}`).waitFor();await owner.page.getByRole('button',{name:'Hide'}).click();await owner.page.getByText('Nothing to review.').waitFor();
  await member.page.reload();await member.page.locator('article',{hasText:'Members-only welcome'}).waitFor();checks.push(`${label}: report → community moderator hides it`);
  await owner.page.getByRole('tab',{name:'Members'}).click();const row=owner.page.locator('.studio-list-row',{hasText:member.handle});await row.getByRole('button',{name:'Ban'}).click();await row.waitFor({state:'detached'});
  await member.page.reload();await member.page.getByText("This community isn't available.").waitFor();checks.push(`${label}: banned member loses access`);
  if(label==='desktop'){await owner.page.goto(root+'/communities');await owner.page.getByRole('heading',{name:'Find your people.'}).waitFor();await axe(owner.page,'directory');await owner.page.goto(root+`/c/${slug}`);await owner.page.getByRole('heading',{name}).waitFor();await axe(owner.page,'community');checks.push('axe WCAG 2.2 AA: directory and community clean');}
  else{const overflow=await owner.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=0,`horizontal scroll ${overflow}px`);checks.push('360px: no horizontal scroll');}
  for(const p of [owner,member])assert.deepEqual(await p.page.evaluate(()=>window.__csp),[],'CSP violations');
  await owner.page.screenshot({path:`../../docs/p8-community-${label}.png`});await owner.context.close();await member.context.close();
 }
 assert.deepEqual(errors,[]);checks.push('no page errors, no CSP violations');
 console.log(JSON.stringify({passed:checks}));
}catch(error){await owner?.page.screenshot({path:'../../backend/runtime/p8-failure-owner.png'}).catch(()=>{});await member?.page.screenshot({path:'../../backend/runtime/p8-failure-member.png'}).catch(()=>{});throw error;}finally{await browser.close();}

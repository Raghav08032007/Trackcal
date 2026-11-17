import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach,it,expect,vi } from 'vitest';
const account=vi.hoisted(()=>({id:''}));
vi.mock('../src/components/account-session',()=>({useAccount:()=>({ready:true,user:account.id?{id:account.id}:null}),useWorkspaceScope:()=>account.id||'guest'}));
import { AdventureHub } from '../src/components/adventure-hub';
import { exportLocalEntries,restoreLocalEntries } from '../src/lib/use-local-state';
import { resetDiaryStore } from '../src/lib/diary';
const summary={initialized:true,timezone:'UTC',today:'2026-10-27',xp:0,level:1,level_xp:0,streak:0,best_streak:0,active_days:[],weekly_days:0,weekly_complete:false,badges:[],history:[],quests:[{id:'meal',title:"Review today's first meal",xp:10,complete:false},{id:'plan',title:'Generate a feasible meal plan',xp:10,complete:false},{id:'quiz',title:'Complete Label Detective',xp:10,complete:false}]};
beforeEach(()=>{account.id='';resetDiaryStore();vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){}});});
it('explicitly initializes a journey and does not grant XP for starting it',async()=>{
 account.id='new-member';
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/summary'))return Response.json({initialized:false});
  if(url.startsWith('/api/wellness/diary'))return Response.json({entries:[],has_more:false});
  expect(url).toBe('/api/adventure/initialize');expect(typeof JSON.parse(String(init?.body)).timezone).toBe('string');return Response.json(summary);
 });vi.stubGlobal('fetch',fetcher);render(<AdventureHub/>);
 await userEvent.click(await screen.findByRole('button',{name:'Start my journey'}));
 expect(await screen.findByRole('heading',{name:'Level 1 0 XP'})).toBeTruthy();expect(fetcher.mock.calls.filter(([url])=>String(url).startsWith('/api/adventure'))).toHaveLength(2);
});
it('persists calm mode in its workspace backup without storing client XP',async()=>{
 render(<AdventureHub/>);await userEvent.click(screen.getByRole('button',{name:'Calm mode'}));
 const entries=exportLocalEntries('guest');expect(entries['trackcal:play:calm']).toBe(true);
 expect(Object.keys(entries).some(key=>key.includes('xp'))).toBe(false);
 restoreLocalEntries(entries,'another-account');expect(localStorage.getItem('trackcal:account:another-account:trackcal:play:calm')).toBe('true');
});
it('offers a guest practice game without inventing account XP',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<AdventureHub/>);
 await userEvent.click(screen.getByLabelText('100 kcal'));
 await userEvent.click(screen.getByRole('button',{name:'Check my answer'}));
 expect(screen.getByText(/50 g is half of 100 g/).textContent).toContain('Practice earns no account XP');expect(fetcher).not.toHaveBeenCalled();
});
it('plays a real session contract, submits answers without client XP and displays the server reward',async()=>{
 account.id='member';
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/summary'))return Response.json(summary);
  if(url.endsWith('/start'))return Response.json({id:'round-one',expires_at:'2099-01-01T12:00:00Z',questions:[1,2,3].map(value=>({prompt:`Question ${value}`,options:[`Q${value} correct`,`Q${value} other`]}))});
  if(url.endsWith('/submit')){expect(JSON.parse(String(init?.body))).toEqual({id:'round-one',answers:[0,0,0]});return Response.json({correct:3,completed:true,awarded_xp:10,explanations:['Explanation one','Explanation two','Explanation three'],summary:{...summary,xp:10,level_xp:10,badges:['Label detective'],quests:summary.quests.map(q=>({...q,complete:q.id==='quiz'}))}});}
  throw new Error('Unexpected request');
 });vi.stubGlobal('fetch',fetcher);render(<AdventureHub/>);
 await userEvent.click(await screen.findByRole('button',{name:'Open the case'}));
 for(const value of [1,2,3])await userEvent.click(screen.getByLabelText(`Q${value} correct`));
 await userEvent.click(screen.getByRole('button',{name:'Check my answers'}));
 await waitFor(()=>expect(screen.getByText(/Case closed! \+10 XP/)).toBeTruthy());
 expect((screen.getByRole('button',{name:'Check my answers'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByText('Explanation one')).toBeTruthy();
});
const entry=(id:string,name:string,method:string)=>({id,day:'2026-10-27',time:'12:00',meal_type:'lunch',method,notes:'',items:[{name,grams:100,nutrients:{calories:200,protein:5,carbs:40,fat:2}}],totals:{calories:200,protein:5,carbs:40,fat:2}});
it('reviews a current real diary entry with its server ID and explicit account ownership',async()=>{
 account.id='member';const id='11111111-2222-4333-8444-555555555555';
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/summary'))return Response.json(summary);
  if(url.startsWith('/api/wellness/diary'))return Response.json({entries:[entry(id,'Rice','manual')],has_more:false});
  const body=JSON.parse(String(init?.body));expect(body.owner_id).toBe('member');expect(body.name).toBe('Rice');expect(body).not.toHaveProperty('xp');expect(body.id).toBe(id);
  return Response.json({awarded_xp:10,summary:{...summary,xp:10,quests:summary.quests.map(q=>({...q,complete:q.id==='meal'}))}});});
 vi.stubGlobal('fetch',fetcher);render(<AdventureHub/>);
 await userEvent.click(await screen.findByRole('button',{name:'I reviewed this entry'}));
 await waitFor(()=>expect(screen.getByText(/\+10 XP. One thoughtful review/)).toBeTruthy());
});
it('does not automatically turn imported diary history into points',async()=>{
 account.id='member';
 const fetcher=vi.fn(async(url:string)=>url.startsWith('/api/wellness/diary')?Response.json({entries:[entry('11111111-2222-4333-8444-666666666666','Imported meal','copied')],has_more:false}):Response.json(summary));
 vi.stubGlobal('fetch',fetcher);render(<AdventureHub/>);
 const review=await screen.findByRole('button',{name:'I reviewed this entry'});expect((review as HTMLButtonElement).disabled).toBe(true);
 expect(fetcher.mock.calls.filter(([url])=>String(url).startsWith('/api/adventure/review'))).toHaveLength(0);
});


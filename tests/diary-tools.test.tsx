import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'p2-member'},ready:true}),useWorkspaceScope:()=>'p2-member'}));
import {NutritionDashboard} from '../src/components/nutrition-dashboard';
import {deviceMeals,stableId,DEVICE_SOURCE} from '../src/components/device-journal-import';
import type {CloudEntry} from '../src/lib/wellness';
const base={today:'2026-10-29',day:'2026-10-29',timezone:'UTC',entries:[] as CloudEntry[],has_more:false,favorites:[],saved_meals:[],recent:[],recent_searches:[],suggestions:{nutrition_note:'Review ingredients.',meals:[]}};
const entry=(id:string,name:string):CloudEntry=>({id,day:'2026-10-28',meal_type:'breakfast',method:'manual',notes:'',items:[{name,grams:150,nutrients:{calories:100,protein:2,carbs:20,fat:1},estimated:false,source:'User reviewed fixture',manual_override:true}],totals:{calories:150,protein:3,carbs:30,fat:1.5}});
const bodies=(fetcher:ReturnType<typeof vi.fn>,suffix:string)=>fetcher.mock.calls.filter(([url,o])=>String(url).endsWith(suffix)&&o?.body).map(([,o])=>JSON.parse(o.body));
beforeEach(()=>{localStorage.clear();});

it('undoes a delete with the restore route',async()=>{
 const fetcher=vi.fn(async(url:string,o?:RequestInit)=>Response.json(o?.method==='DELETE'?{status:'removed',awarded_xp:0}:url.endsWith('/restore')?{entry:entry('e1','Idli'),awarded_xp:0}:{...base,entries:[{...entry('e1','Idli'),day:'2026-10-29'}]}));
 vi.stubGlobal('fetch',fetcher);render(<NutritionDashboard/>);
 await userEvent.click(await screen.findByRole('button',{name:'Delete meal'}));
 await userEvent.click(await screen.findByRole('button',{name:'Undo delete'}));
 await screen.findByText('Meal restored.');
 expect(fetcher.mock.calls.some(([url,o])=>String(url).endsWith('/api/wellness/diary/e1/restore')&&o?.method==='POST')).toBe(true);
});

it("previews yesterday's meals and copies them to today only after confirming, with fresh ids",async()=>{
 const yesterday=[entry('y1','Idli'),entry('y2','Sambar')];
 const fetcher=vi.fn(async(url:string,o?:RequestInit)=>Response.json(o?.body?{awarded_xp:10,entry:{}}:url.includes('day=2026-10-28')?{...base,day:'2026-10-28',entries:yesterday}:base));
 vi.stubGlobal('fetch',fetcher);render(<NutritionDashboard/>);
 await userEvent.click(await screen.findByRole('button',{name:"Copy yesterday's meals"}));
 await screen.findByText('Copy these 2 meals to today? You can edit or delete them afterwards.');
 expect(bodies(fetcher,'/api/wellness/diary')).toEqual([]);
 await userEvent.click(screen.getByRole('button',{name:'Copy 2 meals to today'}));
 await screen.findByText(/Copied 2 meals to today · \+20/);
 const sent=bodies(fetcher,'/api/wellness/diary');
 expect(sent.map(b=>[b.day,b.method,b.items[0].name])).toEqual([['2026-10-29','copied','Idli'],['2026-10-29','copied','Sambar']]);
 expect(sent.every(b=>!['y1','y2'].includes(b.id))).toBe(true);
});

it('says when nothing was logged yesterday',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(base)));render(<NutritionDashboard/>);
 await userEvent.click(await screen.findByRole('button',{name:"Copy yesterday's meals"}));
 await screen.findByText('Nothing was logged yesterday.');
});

it('lists device journal meals from the last 30 days only, newest day first',()=>{
 const meals=deviceMeals({'trackcal:journal:2026-10-29':[{time:'08:00',name:'Poha',calories:250,protein:5,carbs:40,fat:7,method:'Manual'}],'trackcal:journal:2026-10-27':[{time:'13:00',name:'Thali',calories:700,protein:20,carbs:90,fat:25,method:'Manual'}],'trackcal:journal:2026-09-01':[{time:'09:00',name:'Too old',calories:1,protein:0,carbs:0,fat:0,method:'Manual'}],'trackcal:journal:2026-10-30':[{time:'09:00',name:'Future',calories:1,protein:0,carbs:0,fat:0,method:'Manual'}],'trackcal:water:2026-10-29':5},'2026-10-29');
 expect(meals.map(m=>[m.day,m.meal.name])).toEqual([['2026-10-29','Poha'],['2026-10-27','Thali']]);
});

it('derives the same valid UUID for the same meal, so a repeated copy is not duplicated',async()=>{
 const a=await stableId('p2-member','2026-10-29||08:00|Poha|250');
 expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 expect(await stableId('p2-member','2026-10-29||08:00|Poha|250')).toBe(a);
 expect(await stableId('other-member','2026-10-29||08:00|Poha|250')).not.toBe(a);
});

it('copies only the device meals the person keeps ticked, labelled with unknown portion',async()=>{
 localStorage.setItem('trackcal:account:p2-member:trackcal:journal:2026-10-29',JSON.stringify([{time:'08:00',name:'Poha',calories:250,protein:5,carbs:40,fat:7,method:'Manual'},{time:'20:00',name:'Kichdi',calories:400,protein:12,carbs:60,fat:10,method:'Manual'}]));
 const fetcher=vi.fn(async(_url:string,o?:RequestInit)=>Response.json(o?.body?{awarded_xp:0,entry:{}}:base));
 vi.stubGlobal('fetch',fetcher);render(<NutritionDashboard/>);
 await userEvent.click(await screen.findByRole('button',{name:'Review device meals'}));
 await userEvent.click(screen.getByLabelText(/Kichdi/));
 await userEvent.click(screen.getByRole('button',{name:'Copy 1 selected meal'}));
 await screen.findByText(/Copied 1 meal to your diary/);
 const sent=bodies(fetcher,'/api/wellness/diary');
 expect(sent).toHaveLength(1);
 expect(sent[0]).toMatchObject({day:'2026-10-29',method:'copied',meal_type:'other',items:[{name:'Poha',grams:100,nutrients:{calories:250,protein:5,carbs:40,fat:7},source:DEVICE_SOURCE}]});
 await waitFor(()=>expect(localStorage.getItem('trackcal:account:p2-member:trackcal:journal:2026-10-29')).toContain('Kichdi'));
});

it('shows "portion not recorded" for meals copied from the device journal, as the server labels them',async()=>{
 const imported={...entry('d1','Poha'),day:'2026-10-29',items:[{...entry('d1','Poha').items[0],grams:100,source:'User reviewed · '+DEVICE_SOURCE}]};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...base,entries:[imported]})));render(<NutritionDashboard/>);
 expect(await screen.findByText(/portion not recorded/)).toBeTruthy();
});

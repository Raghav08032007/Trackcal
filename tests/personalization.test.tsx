import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'phase2-member'},ready:true}),useWorkspaceScope:()=> 'phase2-member'}));
import {PersonalOnboarding} from '../src/components/personal-onboarding';
import {PersonalDashboard} from '../src/components/personal-dashboard';
import {MeasurementEntry} from '../src/components/measurement-entry';
import {PersonalReminderInbox} from '../src/components/personal-reminder-inbox';
import {MealIdeaTransfer} from '../src/components/meal-idea-transfer';
import {defaultPreferences,type PersonalState} from '../src/lib/personalization';
const template={name:'Comfortable walk',instructions:'Choose a comfortable pace.',equipment:[],difficulty:'gentle',alternative:'recovery',recovery:'Rest whenever needed.'};
const base:PersonalState={preferences:structuredClone(defaultPreferences),step:1,revision:0,completed:false,today:'2026-10-28',plan:null,eligible_templates:[{id:'walk',...template}],measurements:[],bmi:{value:null,classification:null,context:'Measurements are optional.'},recommendations:{meals:[],nutrition_note:'Review every ingredient.',needs_review:false,message:'At your pace.',budget_note:'No invented prices.'},education:[]};
beforeEach(()=>{window.history.replaceState(null,'','/');});
it('completes all eight steps without measurements and saves the first plan',async()=>{
 const writes:Record<string,unknown>[]=[];vi.stubGlobal('fetch',vi.fn(async(url,options)=>{if(!options?.body)return Response.json(base);const body=JSON.parse(options.body);writes.push(body);return Response.json(String(url).endsWith('/plans')?{plan:{id:'plan'}}:{revision:body.revision+1,awarded_xp:body.complete?10:0,summary:{initialized:!!body.complete}});}));
 render(<PersonalOnboarding/>);await screen.findByRole('heading',{name:'Welcome'});
 for(let i=0;i<7;i++)await userEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(screen.getByRole('progressbar').getAttribute('value')).toBe('8');
 await userEvent.click(screen.getByRole('button',{name:'Finish & create my plan'}));
 await screen.findByRole('heading',{name:'Your personal journey is ready.'});
 expect(writes.filter(v=>v.complete===true)).toHaveLength(1);expect(writes.at(-1)?.revision).toBe(8);
 expect(writes.some(v=>'height' in v||'weight' in v||'xp' in v)).toBe(false);
});
it('resumes a cloud draft, preserves comma-separated preferences and reports save errors without losing input',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...base,step:6,revision:4})).mockResolvedValue(Response.json({error:'Connection unavailable'},{status:503}));vi.stubGlobal('fetch',fetcher);
 render(<PersonalOnboarding/>);await screen.findByRole('heading',{name:'Nutrition preferences'});
 await userEvent.type(screen.getByLabelText('Food allergies (comma separated)'),'milk, egg');
 expect((screen.getByLabelText('Food allergies (comma separated)') as HTMLInputElement).value).toBe('milk, egg');
 await userEvent.click(screen.getByRole('button',{name:'Save & resume later'}));
 await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toContain('Connection unavailable');
 const body=JSON.parse(fetcher.mock.calls[1][1].body);expect(body.preferences.allergies).toEqual(['milk','egg']);expect(body.revision).toBe(4);
});
it('completes a planned activity through the server and adds one compatible workout record',async()=>{
 const plan={id:'plan',status:'active',week_start:'2026-10-26',explanation:{reason:'Fits your schedule.',professional_review:false},activities:[{id:'walk-id',template_id:'walk',day:base.today,minutes:10,status:'pending',feedback:null,template}]};
 const workout={id:'walk-id',date:base.today,name:'Comfortable walk',minutes:10,sets:0,reps:0,load:0,source:'Personal activity plan · self-reported'};
 const fetcher=vi.fn(async(url,options)=>Response.json(options?.body?{awarded_xp:20,workout,plan}:{...base,completed:true,revision:1,plan}));vi.stubGlobal('fetch',fetcher);
 render(<PersonalDashboard/>);await screen.findByRole('heading',{name:'Weekly activity calendar'});
 await userEvent.click(screen.getByRole('button',{name:'Mark completed'}));await screen.findByText('Saved · +20 participation XP');
 await waitFor(()=>expect(JSON.parse(localStorage.getItem('trackcal:account:phase2-member:trackcal:studio:workouts')||'[]')).toHaveLength(1));
 expect(fetcher.mock.calls.some(([url,options])=>String(url).endsWith('/activities/walk-id')&&JSON.parse(options?.body||'{}').action==='complete')).toBe(true);
});
it('saves a unit-aware measurement and never submits client XP',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({id:'measurement'}));vi.stubGlobal('fetch',fetcher);render(<MeasurementEntry imperial/>);
 fireEvent.change(screen.getByLabelText('Value (in)'),{target:{value:'70'}});await userEvent.click(screen.getByRole('button',{name:'Save optional measurement'}));
 await screen.findByText('Private measurement saved. No XP awarded.');const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.unit).toBe('in');expect(body.value).toBe(70);expect(body.xp).toBeUndefined();expect(body.recorded_at).toMatch(/Z$/);
});
it('shows only a bounded in-app reminder and persists snooze without requesting notification permission',async()=>{
 const fetcher=vi.fn(async(url,options)=>Response.json(options?.body?{status:'saved'}:{items:[{id:'reminder',category:'hydration',message:'A break at your pace.'}]}));vi.stubGlobal('fetch',fetcher);
 render(<PersonalReminderInbox/>);await screen.findByText('A break at your pace.');await userEvent.click(screen.getByRole('button',{name:'Snooze 15 min'}));
 expect(fetcher.mock.calls.some(([url,options])=>String(url).endsWith('/reminders/reminder')&&JSON.parse(options?.body||'{}').action==='snooze')).toBe(true);
});
it('requires explicit review before transferring a meal idea and invents no nutrition',async()=>{
 window.history.replaceState(null,'','/?mealIdea=Lentil%20bowl');const choose=vi.fn();render(<MealIdeaTransfer onChoose={choose}/>);expect(choose).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Review this meal idea'}));expect(choose).toHaveBeenCalledWith('Lentil bowl');
});

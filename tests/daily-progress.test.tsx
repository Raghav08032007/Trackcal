import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach,it,expect,vi } from 'vitest';
const account=vi.hoisted(()=>({id:''}));
vi.mock('../src/components/account-session',()=>({useAccount:()=>({ready:true,user:account.id?{id:account.id}:null}),useWorkspaceScope:()=>account.id||'guest'}));
import { DailyProgressHub } from '../src/components/daily-progress-hub';
const props={date:'2026-10-27',meals:[{name:'Reviewed meal',time:'12:00',method:'Manual',calories:300,protein:20,carbs:30,fat:10}],targets:{calories:2000,protein:100,carbs:200,fat:60},onJournal:vi.fn(),onGoals:vi.fn()};
beforeEach(()=>{account.id='';});
it('shows live nutrition references and working journal/goal actions without guest XP',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<DailyProgressHub {...props}/>);
 expect((screen.getByRole('progressbar',{name:'calories reference progress'}) as HTMLProgressElement).value).toBe(300);
 expect(screen.getByText('300 / 2000 kcal')).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Open my journal →'}));expect(props.onJournal).toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Edit goals ↗'}));expect(props.onGoals).toHaveBeenCalled();
 expect(fetcher).not.toHaveBeenCalled();expect(screen.getByText('No guest XP')).toBeTruthy();
});
it('uses server daily completions and level unlocks independently of calories',async()=>{
 account.id='member';vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({initialized:true,xp:250,level:2,level_xp:0,task_streak:4,today:'2026-10-27',timezone:'UTC',unlocked_companions:['pip','nova'],quests:[{id:'meal',title:'Review meal',complete:true,xp:10},{id:'plan',title:'Generate plan',complete:false,xp:10},{id:'quiz',title:'Finish quiz',complete:true,xp:10}]})));
 render(<DailyProgressHub {...props}/>);
 await waitFor(()=>expect(screen.getByText('4 day task streak')).toBeTruthy());
 expect(screen.getByText('2 / 3 daily quests')).toBeTruthy();expect(screen.getByText('Next: Milo at level 3')).toBeTruthy();
 expect((screen.getByRole('progressbar',{name:'Daily quest completion'}) as HTMLProgressElement).value).toBe(2);
 expect(screen.getByRole('link',{name:'Generate plan'}).getAttribute('href')).toBe('/tools');
});
it('caps visual nutrition bars while showing excess and handles unset goals',()=>{
 render(<DailyProgressHub {...props} targets={{calories:100,protein:0,carbs:200,fat:60}}/>);
 expect(screen.getByText('200 kcal above reference')).toBeTruthy();expect(screen.getByText('Set a reference goal')).toBeTruthy();
 expect((screen.getByRole('progressbar',{name:'protein reference progress'}) as HTMLProgressElement).value).toBe(0);
});

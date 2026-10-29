import {render,screen,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({id:'member',path:'/'}));
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:state.id?{id:state.id}:null}),useWorkspaceScope:()=>state.id||'guest'}));
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()),usePathname:()=>state.path}));
import {JourneyCompanion} from '../src/components/journey-companion';
const initial={initialized:true,owner_id:'member',xp:20,level:1,level_xp:20,level_step:250,today:'2026-10-28',customization:{character_id:'pip',accessory:'none',enabled:true,minimized:true,muted:false,position:'right',protection_enabled:true},achievements:[{code:'first_workout',title:'First Workout',status:'unlocked',progress:1,required:1,operational:true}],companion_unlocks:[{id:'pip',level:1,required_xp:0,unlocked:true},{id:'nova',level:2,required_xp:250,unlocked:false}],engagement_streak:{current:1,best:1,history:[{day:'2026-10-28',status:'engaged'}]},rest_days_remaining:2,rest_today:false};
beforeEach(()=>{state.id='member';state.path='/';vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{if(options?.body){const body=JSON.parse(options.body);return Response.json({...initial,customization:body});}return Response.json(initial);}));});
it('uses real backend progress across pages, expands and saves accessible preferences',async()=>{
 const {rerender}=render(<JourneyCompanion/>);await screen.findByRole('button',{name:/pip, level 1 companion/});
 await userEvent.click(screen.getByRole('button',{name:/pip, level 1 companion/}));
 expect((screen.getByRole('progressbar',{name:'XP toward next level'}) as HTMLProgressElement).value).toBe(20);
 expect(screen.getByText('20 XP · 1 day flexible streak')).toBeTruthy();
 expect((screen.getByRole('option',{name:/nova/}) as HTMLOptionElement).disabled).toBe(true);
 await userEvent.click(screen.getByText('Customize companion & motion'));
 await userEvent.click(screen.getByRole('button',{name:'Move to left'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Move to right'})).toBeTruthy());
 state.path='/tools';rerender(<JourneyCompanion/>);expect(screen.getByRole('link',{name:'Try a learning quest ↗'})).toBeTruthy();
 await userEvent.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('progressbar')).toBeNull());
});
it('hides for guests and protected routes, and clears the previous account state',async()=>{
 const {rerender}=render(<JourneyCompanion/>);await screen.findByRole('button',{name:/pip, level 1 companion/});
 state.path='/login';rerender(<JourneyCompanion/>);expect(screen.queryByRole('complementary')).toBeNull();
 state.path='/';state.id='';rerender(<JourneyCompanion/>);expect(screen.queryByRole('complementary')).toBeNull();
});
it('ignores a different account event and shows legitimate achievement notifications only after change',async()=>{
 render(<JourneyCompanion/>);await screen.findByRole('button',{name:/pip, level 1 companion/});
 await userEvent.click(screen.getByRole('button',{name:/pip, level 1 companion/}));
 act(()=>window.dispatchEvent(new CustomEvent('trackcal-gamification',{detail:{...initial,owner_id:'someone-else',xp:999}})));
 expect(screen.queryByText(/999 XP/)).toBeNull();
 act(()=>window.dispatchEvent(new CustomEvent('trackcal-gamification',{detail:{...initial,customization:{...initial.customization,minimized:false},achievements:[...initial.achievements,{code:'consistency',title:'Consistency Milestone',status:'unlocked',progress:3,required:3,operational:true}]}})));
 await screen.findByText('Achievement earned: Consistency Milestone. A small win to enjoy.');
});
it('retains the panel and gives a recoverable error when a preference save fails',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>String(url).includes('/personalization/')?Response.json({}):String(url).endsWith('/summary')?Response.json({...initial,customization:{...initial.customization,minimized:false}}):Response.json({error:'Try again later'},{status:503})));
 render(<JourneyCompanion/>);await screen.findByRole('progressbar');
 await userEvent.click(screen.getByText('Customize companion & motion'));
 await userEvent.click(screen.getByRole('button',{name:'Move to left'}));
 await screen.findByText('Try again later');expect(screen.getByRole('progressbar')).toBeTruthy();
});

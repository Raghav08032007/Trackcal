import { render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach,it,expect,vi } from 'vitest';
vi.mock('../src/components/account-session',()=>({useWorkspaceScope:()=> 'guest'}));
import { CharacterCompanion } from '../src/components/character-companion';
import { exportLocalEntries,restoreLocalEntries } from '../src/lib/use-local-state';
import type { AdventureSummary } from '../src/lib/adventure';
beforeEach(()=>{vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){}});});
const summary:AdventureSummary={initialized:true,timezone:'UTC',today:'2026-10-27',xp:1270,level:6,level_xp:20,streak:3,task_streak:3,best_streak:4,active_days:[],weekly_days:2,weekly_complete:false,badges:[],history:[],quests:[{id:'meal',title:'Review a meal',xp:10,complete:true},{id:'quiz',title:'Complete Label Detective',xp:10,complete:false}]};
it('offers six selectable personalities, persists choice and restores it without client XP',async()=>{
 render(<CharacterCompanion summary={summary} signedIn/>);
 for(const name of ['Pip','Nova','Milo','Luna','Rio','Sage'])expect(screen.getAllByRole('button',{name:new RegExp(name)}).length).toBeGreaterThan(0);
 await userEvent.click(screen.getByRole('button',{name:/Sage: unlocked/}));
 expect(screen.getByRole('heading',{name:'Sage is on your team.'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Wave to Sage'}));
 expect(screen.getByRole('status').textContent).toContain('Steady progress');
 const entries=exportLocalEntries('guest');expect(entries['trackcal:play:character']).toBe('sage');
 restoreLocalEntries(entries,'restored');expect(localStorage.getItem('trackcal:account:restored:trackcal:play:character')).toBe('"sage"');
 expect(()=>restoreLocalEntries({'trackcal:play:character':'unknown'},'restored')).toThrow();
});
it('guides the next unfinished quest and derives growth from server progress',async()=>{
 render(<CharacterCompanion summary={summary} signedIn celebration="+10 XP saved"/>);
 await userEvent.click(screen.getByRole('button',{name:'Help me choose'}));
 expect(screen.getByRole('status').textContent).toContain('complete label detective');
 expect(screen.getByRole('link',{name:/Take my next step/}).getAttribute('href')).toBe('#label-detective');
 expect(screen.getByText('Level 6 · 1270 XP · 3-day task streak')).toBeTruthy();
 expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(20);
});
it('encourages rest after all quests and does not invent guest progress',async()=>{
 const {rerender}=render(<CharacterCompanion summary={{...summary,quests:summary.quests.map(q=>({...q,complete:true}))}} signedIn/>);
 await userEvent.click(screen.getByRole('button',{name:'Help me choose'}));expect(screen.getByRole('status').textContent).toContain('rest is welcome');
 rerender(<CharacterCompanion summary={null} signedIn={false}/>);
 expect(screen.getByRole('status').textContent).toContain('Practice'.toLowerCase());
 expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(0);
});


it('prevents restored locked choices and previews requirements without granting XP',async()=>{
 localStorage.setItem('trackcal:play:character',JSON.stringify('sage'));
 render(<CharacterCompanion summary={{...summary,xp:249,level:1,level_xp:249}} signedIn/>);
 expect(screen.getByRole('heading',{name:'Pip is on your team.'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Nova: locked, level 2 required'}));
 expect(screen.getByText(/1 XP to go/)).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Pip is on your team.'})).toBeTruthy();
});
it('unlocks a companion exactly at its earned XP threshold',async()=>{
 render(<CharacterCompanion summary={{...summary,xp:250,level:2,level_xp:0}} signedIn/>);
 await userEvent.click(screen.getByRole('button',{name:'Nova: unlocked'}));
 expect(screen.getByRole('heading',{name:'Nova is on your team.'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Milo: locked, level 3 required'})).toBeTruthy();
});

it('follows the page when away and can be dismissed',async()=>{
 vi.stubGlobal('IntersectionObserver',class {callback:IntersectionObserverCallback;constructor(callback:IntersectionObserverCallback){this.callback=callback;}observe(){this.callback([{isIntersecting:false}] as IntersectionObserverEntry[],this as unknown as IntersectionObserver);}disconnect(){}});
 render(<CharacterCompanion summary={summary} signedIn/>);
 expect(await screen.findByLabelText(/follows your adventure/)).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Hide following companion'}));
 expect(screen.queryByLabelText(/follows your adventure/)).toBeNull();
});

it('builds a real daily plan from incomplete quests and adapts its pace without granting XP',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<CharacterCompanion summary={{...summary,quests:[{id:'meal',title:'Review a meal',xp:10,complete:true},{id:'plan',title:'Generate a meal plan',xp:10,complete:false},{id:'quiz',title:'Complete Label Detective',xp:10,complete:false}]}} signedIn/>);
 await userEvent.click(screen.getByRole('button',{name:'Build my daily plan'}));
 expect(screen.getByRole('link',{name:'Open my meal planner →'}).getAttribute('href')).toBe('/tools');
 expect(screen.getByText(/20 XP in this plan/)).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'One small step'}));
 expect(screen.queryByRole('link',{name:'Start Label Detective →'})).toBeNull();
 expect(screen.getByText(/10 XP in this plan/)).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();
});
it('responds to a gentle check-in and opens a manageable plan',async()=>{
 render(<CharacterCompanion summary={summary} signedIn/>);
 await userEvent.click(screen.getByRole('button',{name:'I need a gentle start'}));
 expect(screen.getByRole('status').textContent).toContain('A small step is enough today');
 expect(screen.getByRole('heading',{name:'Your next small wins.'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'One small step'}).getAttribute('aria-pressed')).toBe('true');
 await userEvent.click(screen.getByRole('button',{name:'Focus on my companion'}));
 expect(screen.getByRole('button',{name:'Leave focus view'}).getAttribute('aria-pressed')).toBe('true');
});
it('offers practice to guests and rest after server-confirmed completion',async()=>{
 const {rerender}=render(<CharacterCompanion summary={null} signedIn={false}/>);
 await userEvent.click(screen.getByRole('button',{name:'Build my daily plan'}));
 expect(screen.getByRole('link',{name:'Try the practice clue →'})).toBeTruthy();
 expect(screen.getByText('Practice first. No guest XP is awarded.')).toBeTruthy();
 rerender(<CharacterCompanion summary={{...summary,quests:summary.quests.map(q=>({...q,complete:true}))}} signedIn/>);
 expect(screen.getByText('Today’s quests are complete. You’ve earned a pause.')).toBeTruthy();
 expect(screen.queryByRole('list')).toBeNull();
});

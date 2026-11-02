import {describe,expect,it} from 'vitest';
import {coachCharacter,coachContext,foodStep,moveStep,newBest,streakDays,type CoachDay} from '@/lib/coach';
import type {AdventureSummary} from '@/lib/adventure';

const day=(extra:Partial<CoachDay>={}):CoachDay=>({hour:13,minor:false,meals:2,caloriesLeft:800,proteinEaten:120,proteinTarget:130,program:null,rested:'squat',streak:1,checkin:null,...extra});
const now=Date.parse('2026-11-02T12:00:00'),ago=(days:number)=>new Date(now-days*86400000).toISOString(),move=(days:number,proven=10)=>({at:ago(days),kind:'squat' as const,proven});

describe('choosing the coach',()=>{
 const summary=(value:object)=>value as unknown as AdventureSummary;
 it('uses an unlocked character and falls back to Pip for a locked one',()=>{
  expect(coachCharacter(summary({customization:{character_id:'rio'},unlocked_companions:['rio']}))).toBe('rio');
  expect(coachCharacter(summary({customization:{character_id:'rio'},unlocked_companions:[]}))).toBe('pip');
  expect(coachCharacter(null)).toBe('pip');
 });
 it('stays quiet when companions are turned off',()=>expect(coachCharacter(summary({customization:{enabled:false}}))).toBeNull());
});

describe('todays move',()=>{
 it('backs off when tired or very sore, ahead of everything else',()=>{
  expect(moveStep(day({program:'Home starter',checkin:{date:'x',energy:'low',sore:'no'}})).href).toBe('/recovery');
  expect(moveStep(day({checkin:{date:'x',energy:'great',sore:'very'}})).text).toContain('very sore');
 });
 it('calls for rest after six days in a row',()=>expect(moveStep(day({streak:6,program:'Home starter'})).text).toContain('Rest'));
 it('carries on a program before suggesting anything new',()=>expect(moveStep(day({program:'Home starter'})).href).toBe('/programs'));
 it('otherwise suggests a rested exercise',()=>expect(moveStep(day()).href).toContain('exercise=squat'));
 it('has an answer with nothing to go on',()=>expect(moveStep(day({rested:null})).href).toBe('/workouts'));
});

describe('todays food',()=>{
 it('names no numbers for under 18s',()=>{const line=foodStep(day({minor:true}));expect(line).not.toMatch(/kcal|protein|\d/);});
 it('asks for a first meal',()=>expect(foodStep(day({meals:0,hour:8}))).toContain('breakfast'));
 it('spots a protein gap',()=>expect(foodStep(day({proteinEaten:60}))).toContain('70 g short'));
 it('never tells someone to make up for going over',()=>{const line=foodStep(day({caloriesLeft:-300}));expect(line).toContain('No need to make up');expect(line).not.toContain('300');});
});

describe('streaks and bests',()=>{
 it('counts back from today or yesterday and stops at a gap',()=>{
  expect(streakDays([move(0),move(1),move(2),move(4)],now)).toBe(3);
  expect(streakDays([move(1),move(2)],now)).toBe(2);
  expect(streakDays([move(3)],now)).toBe(0);
 });
 it('does not call a first attempt a record',()=>{
  expect(newBest([],'squat',20)).toBe(false);
  expect(newBest([move(1,10)],'squat',11)).toBe(true);
  expect(newBest([move(1,10)],'squat',10)).toBe(false);
 });
});

describe('what the AI sees',()=>{
 it('leaves calories and protein out for under 18s',()=>{
  const seen=JSON.stringify(coachContext(day({minor:true})));
  expect(seen).not.toMatch(/calories|protein/);expect(seen).toContain('workout_streak_days');
 });
 it('gives adults the numbers',()=>expect(coachContext(day())).toMatchObject({calories_left:800,protein_target_g:130}));
});

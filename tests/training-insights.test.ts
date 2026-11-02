import {describe,expect,it} from 'vitest';
import {EXERCISES,type ExerciseKind} from '@/lib/pose/types';
import {movesFrom,muscleStates,musclesOf,nextTarget,NOT_A_MUSCLE,readyToProgress,restedChoice,slowdown} from '@/lib/training-insights';
import {RepCounter} from '@/lib/pose/rep-counter';
import {SessionTracker} from '@/lib/pose/session-tracker';
import type {Session} from '@/lib/wellness';
import {pose} from './fixtures/pose';

const now=Date.parse('2026-11-02T12:00:00Z'),ago=(hours:number)=>new Date(now-hours*3600000).toISOString();
const done=(kind:string,sets:{estimated_reps:number;corrected_reps:number|null}[],hours=1)=>({status:'completed',completed_at:ago(hours),details:{exercises:[],notes:'',tracking:{exercise_type:kind,confidence_mean:.9,sampled_frames:9,sets}}}) as unknown as Session;

describe('muscle map',()=>{
 it('places every muscle every exercise names',()=>{
  for(const [kind,exercise] of Object.entries(EXERCISES))for(const name of exercise.muscles.toLowerCase().split(',').map(n=>n.trim()))if(!NOT_A_MUSCLE.has(name))expect(musclesOf(kind as ExerciseKind).length,`${kind}: ${name}`).toBeGreaterThan(0);
 });
 it('fades a worked muscle over three days and keeps the most recent state',()=>{
  const state=(hours:number)=>muscleStates([{at:ago(hours),kind:'squat',proven:10}],now).get('quadriceps');
  expect([state(2),state(30),state(60),state(100)]).toEqual(['worked','recovering','nearly',undefined]);
  expect(muscleStates([{at:ago(60),kind:'squat',proven:5},{at:ago(2),kind:'squat',proven:5}],now).get('quadriceps')).toBe('worked');
 });
 it('ignores a workout dated in the future',()=>expect(muscleStates([{at:ago(-5),kind:'squat',proven:5}],now).size).toBe(0));
 it('suggests something that avoids tired muscles',()=>{
  const states=muscleStates([{at:ago(2),kind:'squat',proven:5}],now),pick=restedChoice(states)!;
  expect(musclesOf(pick).some(muscle=>muscle==='quadriceps'||muscle==='gluteal')).toBe(false);
 });
});

describe('progression',()=>{
 it('counts only reps the camera saw',()=>{
  expect(movesFrom([done('squat',[{estimated_reps:8,corrected_reps:30}])])[0].proven).toBe(8);
  expect(movesFrom([done('squat',[{estimated_reps:12,corrected_reps:10}])])[0].proven).toBe(10);
 });
 it('skips unfinished sessions and unknown exercises',()=>{
  expect(movesFrom([{...done('squat',[]),status:'active'},done('nonsense',[])])).toEqual([]);
 });
 it('offers a harder move in the same group after 15 proven reps, and not before',()=>{
  expect(readyToProgress([{at:ago(1),kind:'squat',proven:14}])).toEqual([]);
  const [step]=readyToProgress([{at:ago(1),kind:'squat',proven:15}]);
  expect(EXERCISES[step.to].group).toBe('legs');expect(EXERCISES[step.to].difficulty).toBe('medium');expect(EXERCISES[step.to].equipment).toBe('none');
 });
 it('drops the offer once the harder move has been tried, and has nothing above hard',()=>{
  const [step]=readyToProgress([{at:ago(1),kind:'squat',proven:15}]);
  expect(readyToProgress([{at:ago(1),kind:'squat',proven:15},{at:ago(1),kind:step.to,proven:1}]).map(s=>s.from)).not.toContain('squat');
  expect(readyToProgress([{at:ago(1),kind:'pistol',proven:40}])).toEqual([]);
 });
});

describe('tiredness',()=>{
 it('needs six reps and a real slowdown',()=>{
  expect(slowdown([1000,1000,3000,3000,3000])).toBeNull();
  expect(slowdown([1000,1000,1000,1100,1100,1100])).toBeNull();
  expect(slowdown([1000,1000,1000,1500,1600,1700])).toBe(60);
 });
 it('sets the next target where reps began to slow, or one more if they never did',()=>{
  expect(nextTarget([1000,1000,1000,1000,1000,1000])).toBe(7);
  expect(nextTarget([1000,1000,1000,1000,1000,1000,1000,1500,1600,1700])).toBe(8);
  expect(nextTarget([])).toBeNull();
 });
});

describe('rep log and replay',()=>{
 const run=(tracker:SessionTracker,reps:number)=>{let t=0;for(let rep=0;rep<reps;rep++){for(let i=0;i<12;i++)tracker.frame(pose('squat',false,t+=120));for(let i=0;i<12;i++)tracker.frame(pose('squat',true,t+=120));}for(let i=0;i<12;i++)tracker.frame(pose('squat',false,t+=120));};
 it('records each counted rep, and clears on reset',()=>{
  const tracker=new SessionTracker('squat');run(tracker,3);
  expect(tracker.counter.reps).toBeGreaterThan(0);
  expect(tracker.counter.repLog).toHaveLength(tracker.counter.reps);
  tracker.reset();expect(tracker.counter.repLog).toEqual([]);expect(tracker.replays()).toEqual({best:null,worst:null});
 });
 it('keeps a short outline of the rep, with only the twelve body joints',()=>{
  const tracker=new SessionTracker('squat');run(tracker,3);const {best}=tracker.replays();
  expect(best!.frames.length).toBeGreaterThan(3);expect(best!.frames[0]).toHaveLength(24);
 });
 it('a fresh counter starts with an empty log',()=>expect(new RepCounter(new SessionTracker('squat').config).repLog).toEqual([]));
});

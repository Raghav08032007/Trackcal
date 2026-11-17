// Phase F3: each person's own range. Learned only from agreeing sets in two or more sessions, never easier than MAX_EASE of the
// movement, never stricter than standard; and with it a person who moves less gets their honest reps counted, half reps still don't.
import {describe,it,expect} from 'vitest';
import {learnedReach,personalConfig,rangeGain,MAX_EASE} from '@/lib/pose/personal-range';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {SessionTracker} from '@/lib/pose/session-tracker';
import type {ExerciseKind} from '@/lib/pose/types';
import {exerciseSet} from './sim/move-sim';

const session=(day:number,kind:string,reach:(number|null)[])=>({status:'completed',completed_at:`2026-11-${String(day).padStart(2,'0')}T10:00:00Z`,details:{tracking:{exercise_type:kind,sets:reach.map(r=>r===null?{}:{reach_deg:r})}}});
const run=(k:ExerciseKind,seed:number,depth:[number,number],reach?:number|null)=>{const s=exerciseSet(k,seed,{depth}),t=new SessionTracker(k,'beginner',reach);s.frames.forEach(f=>t.frame(f));return {real:s.reps,got:Math.min(s.reps,t.counter.reps),reach:t.reach().reach_deg};};
const learnFrom=(k:ExerciseKind,depth:[number,number])=>{const r=[1,2,3].map(i=>run(k,700+i,depth).reach).filter((x):x is number=>x!==undefined);return learnedReach(r.map((x,i)=>session(i+1,k,[x])),k)?.reach??null;};

describe('learning a range from saved sets',()=>{
 it('needs three sets from two sessions, so one set never changes the target',()=>{
  expect(learnedReach([session(1,'squat',[150,150,150])],'squat')).toBeNull();
  expect(learnedReach([session(1,'squat',[150]),session(2,'squat',[151])],'squat')).toBeNull();
  expect(learnedReach([session(1,'squat',[150,152]),session(2,'squat',[151])],'squat')?.reach).toBe(151);
 });
 it('reads only this exercise, only completed sessions, and skips sets without a reach',()=>{
  const rows=[session(1,'squat',[150,null]),session(2,'lunge',[90,90,90]),{...session(3,'squat',[100,100]),status:'abandoned'},session(4,'squat',[140])];
  expect(learnedReach(rows,'squat')).toBeNull();                     // two usable squat sets so far
  expect(learnedReach([...rows,session(5,'squat',[145])],'squat')?.reach).toBe(145);
 });
 it('follows the latest sessions, and reports range gained against older ones',()=>{
  const rows=[...[1,2,3,4].map(d=>session(d,'squat',[150])),...[5,6,7,8,9,10].map(d=>session(d,'squat',[140]))];
  const r=learnedReach(rows,'squat')!;
  expect(r.reach).toBe(140);expect(rangeGain(r)).toBe(10);
 });
});

describe('the target follows the person, within limits',()=>{
 const squat=EXERCISE_CONFIG.situp,span=squat.up-squat.down;
 it('a full range keeps the standard target: never stricter',()=>{
  expect(personalConfig(squat,squat.down-20)).toEqual({config:squat,eased:0});
  expect(personalConfig(squat,null).eased).toBe(0);
 });
 it('a narrow movement band is not eased at all',()=>{expect(personalConfig(EXERCISE_CONFIG.squat,EXERCISE_CONFIG.squat.down+3).eased).toBe(0);});
 it('a shallower usual bottom moves the target to it, plus a small margin',()=>{
  const {config,eased}=personalConfig(squat,squat.down+2);
  expect(config.down).toBe(squat.down+7);expect(eased).toBeCloseTo(7/span);
  expect(config.minRangeDeg).toBeLessThan(squat.minRangeDeg);
 });
 it('never more than MAX_EASE of the movement, however shallow',()=>{
  for(const k of Object.keys(EXERCISE_CONFIG) as ExerciseKind[]){const c=EXERCISE_CONFIG[k],{config,eased}=personalConfig(c,1e3);
   expect(eased,k).toBeLessThanOrEqual(MAX_EASE+1e-9);expect(config.down,k).toBeLessThan(config.up-config.hysteresis);}
 });
});

describe('a person who moves less, filmed',()=>{
 const KINDS:ExerciseKind[]=['situp','kickback','legraise','wsquat','seatrow','bicycle','punch','bench'];
 it('gets most of their honest reps counted once their range is learned',()=>{
  let before=0,after=0,real=0;
  for(const k of KINDS){const reach=learnFrom(k,[.45,.6]);for(let s=1;s<=4;s++){const a=run(k,800+s,[.45,.6]),b=run(k,800+s,[.45,.6],reach);before+=a.got;after+=b.got;real+=a.real;}}
  expect(before/real).toBeLessThan(.25);expect(after/real).toBeGreaterThan(.6);
 },120000);
 it('still has half reps rejected',()=>{
  let got=0,real=0;
  for(const k of KINDS){const reach=learnFrom(k,[.45,.6]);for(let s=1;s<=4;s++){const h=run(k,850+s,[.2,.3],reach);got+=h.got;real+=h.real;}}
  expect(got/real).toBeLessThan(.05);
 },120000);
 it('a full range is counted exactly as before',()=>{
  for(const k of KINDS){const reach=learnFrom(k,[.8,1]);for(let s=1;s<=3;s++)expect(run(k,900+s,[.8,1],reach).got,k).toBe(run(k,900+s,[.8,1]).got);}
 },120000);
});

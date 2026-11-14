// Phase F4: sports games in Play, counted from the camera. The motions the page shows as examples are filmed like every exercise
// (any angle near the recommended one, phone or laptop, tracking noise, dropped frames), and each game must count its own movement
// and not the others, or everyday exercises.
import {describe,it,expect} from 'vitest';
import {exerciseSet} from './sim/move-sim';
import {SPORT_MOVES} from '@/lib/pose/sport-motions';
import {sportCounter,handKmh,type SportKind} from '@/lib/pose/sports';
import type {ExerciseKind} from '@/lib/pose/types';

const KINDS:SportKind[]=['skip','box','cricket','badminton'];
/** Box cycles are a jab and a cross: two punches each. Skipping is continuous, twenty jumps a set. */
const play=(k:SportKind,seed:number,counter:SportKind=k)=>{const m=SPORT_MOVES[k],s=exerciseSet('squat',seed+k.length*31,{move:m,timing:m.timing,per:m.tempo,rest:k==='skip'?[0,40]:[150,600],depth:[.8,1],reps:k==='skip'?20:undefined});
 const c=sportCounter(counter);s.frames.forEach(f=>c.frame(f));return {real:s.reps*(k==='box'?2:1),got:c.count};};
const film=(e:ExerciseKind,seed:number,k:SportKind,fast=false)=>{const s=exerciseSet(e,seed,fast?{per:[.7,1.1],rest:[50,200]}:{}),c=sportCounter(k);s.frames.forEach(f=>c.frame(f));return c.count;};
const LEAST:Record<SportKind,number>={skip:.95,box:.95,cricket:.88,badminton:.72};

describe('each game counts its own movement',()=>{
 for(const k of KINDS)it(`${k}: at least ${LEAST[k]*100}% counted, almost never more than done`,()=>{
  let real=0,got=0,over=0;for(let i=0;i<10;i++){const r=play(k,900+i);real+=r.real;got+=Math.min(r.real,r.got);over+=Math.max(0,r.got-r.real);}
  expect(got/real).toBeGreaterThanOrEqual(LEAST[k]);expect(over/real).toBeLessThan(.03);
 },120000);
});

describe('and not anything else',()=>{
 it('no game counts standing arm exercises as jumps, and boxing and badminton count no other exercise',()=>{
  for(const e of ['curl','hammer','press','raise','front','overhead','sidebend'] as ExerciseKind[])for(let i=0;i<2;i++)expect(film(e,910+i,'skip'),e).toBe(0);
  for(const k of ['box','badminton'] as SportKind[])for(const e of ['squat','lunge','jack','raise','front','curl','highknee','burpee','sidebend','latpull'] as ExerciseKind[])for(const fast of [false,true])expect(film(e,920,k,fast),`${k} ${e}`).toBe(0);
 },240000);
 it('one game never counts another: a few strays at most',()=>{
  for(const k of KINDS){let n=0,real=0;for(const o of KINDS)if(o!==k)for(let i=0;i<3;i++){n+=play(o,930+i,k).got;real+=play(o,930+i).real;}expect(n/real,k).toBeLessThan(.03);}
 },240000);
 it('squats, lunges and high knees are not skipping',()=>{
  let n=0;for(const e of ['squat','lunge','highknee','knee','buttkick'] as ExerciseKind[])for(let i=0;i<3;i++)n+=film(e,940+i,'skip');
  expect(n).toBeLessThanOrEqual(3);                                 // out of about 100 reps
 },120000);
});

it('hand speed is shown as an estimate in km/h',()=>{expect(handKmh(10)).toBe(18);});

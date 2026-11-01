// A jointed skeleton performs every exercise and every exercise's tracker watches it: each must count its own move and no other.
import {describe,it,expect} from 'vitest';
import {SessionTracker} from '@/lib/pose/session-tracker';
import {EXERCISES,type ExerciseKind,type Landmark,type PoseFrame} from '@/lib/pose/types';
import {MOVES,blend,full,layout,placement,type Move,type Pose} from '@/lib/pose/exercise-motions';

let seed=1;const noise=()=>{seed=(seed*16807)%2147483647;return (seed/2147483647-.5)*.004;};
function frameFor(m:Move,p:Required<Pose>,t:number,start:[number,number]):PoseFrame{
 const s=layout(m,p,start);
 const points:Landmark[]=Array.from({length:33},(_,id)=>{const at=s[id]??s[id%2?11:12];return {x:at[0]+noise(),y:at[1]+noise()-(s[id]?0:.08),visibility:.95,presence:1};});
 return {landmarks:[points],timestamp:t,width:480,height:480};
}
function watch(kind:ExerciseKind,m:Move,reps:number,report?:string[]){
 const t=new SessionTracker(kind),keys=m.keys.map(full),ms=1000/15,start=placement(m);let now=1000;
 for(let i=0;i<18;i++,now+=ms)t.frame(frameFor(m,keys[0],now,start));
 for(let r=0;r<reps;r++)for(let leg=0;leg<keys.length;leg++){const a=keys[leg],b=keys[(leg+1)%keys.length],steps=Math.round(1500/keys.length/ms)*2;for(let i=0;i<steps;i++,now+=ms)t.frame(frameFor(m,blend(a,b,(1-Math.cos(Math.PI*i/steps))/2),now,start));for(let i=0;i<4;i++,now+=ms)t.frame(frameFor(m,b,now,start));}
 for(let i=0;i<14;i++,now+=ms)t.frame(frameFor(m,keys[0],now,start));
 if(report)report.push(`${kind}:${t.counter.reps} ${t.counter.mismatches.join(',')} ${JSON.stringify(t.counter.rejections)}`);
 return t.counter.reps;
}
/** Same movement, same body: the camera sees no difference, so these are one exercise for counting. Weights themselves can't be seen. */
const SAME:ExerciseKind[][]=[['curl','hammer'],['knee','highknee'],['calf','wcalf'],['bridge','hipthrust'],['lunge','wlunge'],['squat','wsquat']];
/** The first counts the second because the second contains it: a jump squat is a squat with a jump on the end. */
const CONTAINS:[ExerciseKind,ExerciseKind][]=[['squat','squatjump'],['lunge','bulgarian'],['wlunge','bulgarian'],['deadlift','kbswing']];
const same=(a:ExerciseKind,b:ExerciseKind)=>SAME.some(g=>g.includes(a)&&g.includes(b))||CONTAINS.some(([x,y])=>x===a&&y===b);
const KINDS=Object.keys(EXERCISES) as ExerciseKind[];
const REPS=3;
describe('each exercise counts only itself',()=>{
 it('has a motion for every exercise',()=>{expect(KINDS.filter(k=>!MOVES[k])).toEqual([]);});
 for(const k of KINDS)it(`${k} counts its own reps`,()=>{const why:string[]=[];expect(watch(k,MOVES[k],REPS,why),why.join()).toBe(REPS);});
 it('no exercise counts any other exercise',()=>{
  const wrong:string[]=[];
  for(const tracker of KINDS)for(const done of KINDS){if(tracker===done||same(tracker,done))continue;const n=watch(tracker,MOVES[done],REPS);if(n>0)wrong.push(`${tracker} counted ${n} of ${done}`);}
  expect(wrong).toEqual([]);
 },240000);
});

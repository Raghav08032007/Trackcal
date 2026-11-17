// Every exercise filmed both ways: side-on and head-on. The angle it moves in must always count; the other angle must count too
// unless the exercise is listed as one-angle, in which case the camera page says which way to stand.
import {describe,it,expect} from 'vitest';
import {SessionTracker} from '@/lib/pose/session-tracker';
import {EXERCISES,type ExerciseKind,type Landmark,type PoseFrame} from '@/lib/pose/types';
import {MOVES,blend,full,layout,placement,seenFrom,type Move,type Pose} from '@/lib/pose/exercise-motions';
import {EXERCISE_CONFIG,ONE_ANGLE,angleTip} from '@/lib/pose/exercise-config';

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
const KINDS=Object.keys(EXERCISES) as ExerciseKind[];
const other=(v:'side'|'front')=>v==='side'?'front':'side';
describe('counting from both camera angles',()=>{
 for(const k of KINDS){
  const c=EXERCISE_CONFIG[k],plane=c.plane!;
  it(`${k} counts filmed ${plane==='side'?'side-on':'head-on'}`,()=>{const why:string[]=[];expect(watch(k,seenFrom(MOVES[k],plane),3,why),why.join()).toBe(3);});
  if(c.bothAngles)it(`${k} also counts filmed ${plane==='side'?'head-on':'side-on'}`,()=>{const why:string[]=[];expect(watch(k,seenFrom(MOVES[k],other(plane)),3,why),why.join()).toBe(3);});
 }
 it('most exercises count from both angles, and the page says which way to stand',()=>{
  expect(KINDS.filter(k=>EXERCISE_CONFIG[k].bothAngles).length).toBeGreaterThanOrEqual(60);
  expect(angleTip(EXERCISE_CONFIG.pushup)).toContain('side-on or facing');expect(angleTip(EXERCISE_CONFIG.situp)).toBe('Only counts side-on: from the other angle this movement is hidden.');
  expect([...ONE_ANGLE].every(k=>EXERCISES[k]),'one-angle list names real exercises').toBe(true);
 });
});

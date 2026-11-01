// Facing the camera: joints look straight in 2D, so counting has to come from how far the limb ends travel.
import {describe,it,expect} from 'vitest';
import {SessionTracker} from '@/lib/pose/session-tracker';
import {focusPerson} from '@/lib/pose/landmarks';
import type {ExerciseKind,Landmark,PoseFrame} from '@/lib/pose/types';

const standing=():Landmark[]=>Array.from({length:33},()=>({x:.5,y:.5,visibility:.9,presence:1}));
const put=(p:Landmark[],id:number,x:number,y:number)=>{p[id]={x,y,visibility:.9,presence:1};};

/** depth 0 is upright, 1 is the bottom of the rep. Knees stay in line with hips and ankles, as seen from the front. */
function squatFrame(depth:number,t:number):PoseFrame{
 const p=standing(),hipY=.5+.14*depth,shoulderY=.25+.12*depth;
 put(p,11,.42,shoulderY);put(p,12,.58,shoulderY);put(p,13,.4,shoulderY+.12);put(p,14,.6,shoulderY+.12);put(p,15,.4,shoulderY+.2);put(p,16,.6,shoulderY+.2);
 put(p,23,.45,hipY);put(p,24,.55,hipY);put(p,25,.45,(hipY+.9)/2);put(p,26,.55,(hipY+.9)/2);put(p,27,.45,.9);put(p,28,.55,.9);
 return {landmarks:[p],timestamp:t,width:640,height:480};
}
/** Elbow pinned by the side while the forearm comes up towards the camera. */
function curlFrame(depth:number,t:number):PoseFrame{
 const p=standing();
 put(p,11,.42,.3);put(p,12,.58,.3);put(p,13,.4,.42);put(p,14,.6,.42);put(p,15,.4,.54-.2*depth);put(p,16,.6,.54-.2*depth);
 put(p,23,.45,.55);put(p,24,.55,.55);put(p,25,.45,.72);put(p,26,.55,.72);put(p,27,.45,.9);put(p,28,.55,.9);
 return {landmarks:[p],timestamp:t,width:640,height:480};
}
function run(kind:ExerciseKind,build:(d:number,t:number)=>PoseFrame,reps:number,fps:number,secondsPerRep:number,peak=1){
 const tracker=new SessionTracker(kind),step=1000/fps;let t=1000;
 for(let i=0;i<fps;i++,t+=step)tracker.frame(build(0,t));
 for(let r=0;r<reps;r++){const n=Math.round(secondsPerRep*fps);for(let i=0;i<n;i++,t+=step)tracker.frame(build(peak*(1-Math.cos(2*Math.PI*i/n))/2,t));for(let i=0;i<4;i++,t+=step)tracker.frame(build(0,t));}
 return tracker.counter;
}
describe('counting while facing the camera',()=>{
 for(const fps of [10,15,24])for(const speed of [1.5,2.5])it(`squats at ${fps} fps, ${speed} s a rep`,()=>expect(run('squat',squatFrame,5,fps,speed).reps).toBe(5));
 it('curls at 10 fps',()=>expect(run('curl',curlFrame,5,10,2).reps).toBe(5));
 it('a small dip is not a rep, and says why',()=>{const c=run('squat',squatFrame,3,10,2,.4);expect(c.reps).toBe(0);expect(c.rejections.too_shallow).toBeGreaterThan(0);});
 it('standing still is never a rep',()=>expect(run('squat',squatFrame,0,10,2).reps).toBe(0));
 it('reports how far through the movement the person is',()=>{const t=new SessionTracker('squat');let last=null;for(let i=0;i<14;i++)t.frame(squatFrame(0,1000+i*100));for(let i=0;i<8;i++)last=t.frame(squatFrame(1,2400+i*100));expect(last?.progress).toBeGreaterThan(.8);});
});
describe('other things the model detects',()=>{
 const person=(size:number):Landmark[]=>standing().map((l,i)=>({...l,x:.5+size*(i/33-.5),y:.5+size*(i%7/7-.5)}));
 it('a small figure in the background is ignored',()=>{const main=person(.8),frame=focusPerson({landmarks:[person(.2),main],timestamp:1,width:640,height:480});expect(frame.landmarks).toEqual([main]);});
 it('a second person of similar size still pauses counting',()=>expect(focusPerson({landmarks:[person(.7),person(.8)],timestamp:1,width:640,height:480}).landmarks).toHaveLength(2));
});
describe('wall push-ups',()=>{
 /** Side view: hand fixed on the wall, the body leans in and the elbow bends. */
 function wallFrame(depth:number,t:number):PoseFrame{
  const p=standing(),shoulderX=.4+.13*depth;
  put(p,11,shoulderX,.3);put(p,12,shoulderX,.3);put(p,13,(shoulderX+.68)/2,.3+.1*depth);put(p,14,(shoulderX+.68)/2,.3+.1*depth);put(p,15,.68,.3);put(p,16,.68,.3);
  put(p,23,.38,.55);put(p,24,.38,.55);put(p,25,.38,.72);put(p,26,.38,.72);put(p,27,.38,.9);put(p,28,.38,.9);
  return {landmarks:[p],timestamp:t,width:640,height:480};
 }
 it('counts at 10 fps',()=>expect(run('wallpush',wallFrame,5,10,2).reps).toBe(5));
});

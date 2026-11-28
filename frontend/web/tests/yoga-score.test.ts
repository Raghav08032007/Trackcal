// The yoga scorer: every asana matches its own demo, near-misses score lower with the right correction, either side can
// lead, hidden joints never fail a pose, and only time in the pose is counted.
import {describe,expect,it} from 'vitest';
import {ASANAS,ASANA_BY_ID,moveOf,type Asana} from '@/lib/yoga/asanas';
import {AsanaTracker,closest,demoPoints,match,measure,tipFor} from '@/lib/yoga/score';
import {full,layout,placement,type Pose} from '@/lib/pose/exercise-motions';
import type {Landmark,PoseFrame} from '@/lib/pose/types';

const pointsFor=(a:Asana,pose:Pose=a.pose,jitter=0,seed=1):Landmark[]=>{
 const m=moveOf(a),s=layout(m,full(pose),placement(m));let r=seed;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647-.5;};
 return Array.from({length:33},(_,id)=>{const q=s[id]??s[11];return {x:q[0]+jitter*rnd(),y:q[1]+jitter*rnd(),visibility:.95,presence:1};});
};
const frame=(p:Landmark[],t:number):PoseFrame=>({landmarks:[p],timestamp:t,width:480,height:480});
const mirror=(p:Landmark[])=>p.map((_,i)=>{const j=i>=11&&i<=32?(i%2?i+1:i-1):i;return {...p[j],x:1-p[j].x};});

describe('yoga asanas',()=>{
 it('has 40 asanas with unique ids, steps and cautions',()=>{
  expect(ASANAS.length).toBeGreaterThanOrEqual(40);
  expect(new Set(ASANAS.map(a=>a.id)).size).toBe(ASANAS.length);
  for(const a of ASANAS){expect(a.steps.length,a.id).toBeGreaterThanOrEqual(3);expect(a.avoid,a.id).toBeTruthy();expect(a.hold,a.id).toBeGreaterThan(0);}
 });
 for(const a of ASANAS)it(`${a.id} scores full marks on its own demo`,()=>expect(match(a,measure(demoPoints(a))).score).toBeGreaterThanOrEqual(98));
 it('a shaky camera (about 1% jitter) still scores the right pose highly',()=>{
  for(const a of ASANAS)expect(match(a,measure(pointsFor(a,a.pose,.012,7))).score,a.id).toBeGreaterThanOrEqual(85);
 });
 it('a mirrored camera or the other side leading makes no difference',()=>{
  for(const id of ['vrikshasana','virabhadrasana-2','trikonasana','virabhadrasana-1','natarajasana']){const a=ASANA_BY_ID[id];expect(match(a,measure(mirror(demoPoints(a)))).score,id).toBeGreaterThanOrEqual(95);}
 });
 it('standing tall is not a warrior, a squat or a forward fold',()=>{
  const stand=measure(demoPoints(ASANA_BY_ID.tadasana));
  for(const id of ['virabhadrasana-2','utkatasana','uttanasana','adho-mukha-svanasana','shavasana','bhujangasana'])expect(match(ASANA_BY_ID[id],stand).score,id).toBeLessThan(60);
 });
 it('recognises distinct poses from each other (Surya Namaskar steps)',()=>{
  const steps=['pranamasana','urdhva-hastasana','uttanasana','ashwa-sanchalanasana','phalakasana','ashtanga-namaskara','bhujangasana','adho-mukha-svanasana'].map(id=>ASANA_BY_ID[id]);
  let right=0;for(const a of steps)for(let seed=1;seed<=5;seed++)if(closest(measure(pointsFor(a,a.pose,.01,seed)),steps)?.asana.id===a.id)right++;
  expect(right/(steps.length*5)).toBeGreaterThanOrEqual(.9);
 });
 it('a front knee that is not bent enough scores lower and gets the right tip',()=>{
  const a=ASANA_BY_ID['virabhadrasana-2'],weak={...a.pose,thigh:[-45,30] as [number,number],shin:[-45,10] as [number,number]};
  const m=match(a,measure(pointsFor(a,weak)));
  expect(m.score).toBeLessThan(85);expect(tipFor(m.worst,a)).toMatch(/Bend your (left|right) knee more/);
 });
 it('arms too low in tree pose: raise them',()=>{
  const a=ASANA_BY_ID.vrikshasana,low={...a.pose,arm:[-60,60] as [number,number],fore:[-60,60] as [number,number]};
  const m=match(a,measure(pointsFor(a,low)));
  expect(m.score).toBeLessThan(90);expect(tipFor(m.worst,a)).toMatch(/Raise your (left|right) arm higher/);
 });
 it('a fold that stops halfway: fold further',()=>{
  const a=ASANA_BY_ID.uttanasana,m=match(a,measure(pointsFor(a,{...a.pose,torso:90})));
  expect(m.score).toBeLessThan(80);expect(tipFor(m.worst,a)).toMatch(/Fold further|Fold more/);
 });
 it('hidden legs are left out, not failed; too little in view is not scored',()=>{
  const a=ASANA_BY_ID['urdhva-hastasana'],p=demoPoints(a).map((l,i)=>i>=25?{...l,visibility:.1}:l);
  const m=match(a,measure(p));expect(m.score).toBeGreaterThanOrEqual(95);
  const none=demoPoints(a).map(l=>({...l,visibility:.1}));expect(match(a,measure(none)).seen).toBe(0);
 });
});

describe('asana tracker',()=>{
 it('times only the seconds in the pose and keeps the best hold',()=>{
  const a=ASANA_BY_ID.vrikshasana,tr=new AsanaTracker(a);let r=tr.update(frame(demoPoints(a),0));
  for(let t=100;t<=3000;t+=100)r=tr.update(frame(demoPoints(a),t));
  expect(r.inPose).toBe(true);expect(r.held).toBeGreaterThan(2500);expect(r.score).toBeGreaterThanOrEqual(95);expect(r.average).toBeGreaterThanOrEqual(95);
  const stand=demoPoints(ASANA_BY_ID.tadasana);for(let t=3100;t<=5000;t+=100)r=tr.update(frame(stand,t));
  expect(r.inPose).toBe(false);expect(r.current).toBe(0);expect(r.best).toBeGreaterThan(2500);
 });
 it('gives a tip while off and drops it once the pose is good',()=>{
  const a=ASANA_BY_ID['virabhadrasana-2'],tr=new AsanaTracker(a),weak=pointsFor(a,{...a.pose,thigh:[-45,25],shin:[-45,15]});
  let r=tr.update(frame(weak,0));for(let t=100;t<=1000;t+=100)r=tr.update(frame(weak,t));
  expect(r.tip).toMatch(/knee/);
  for(let t=1100;t<=3000;t+=100)r=tr.update(frame(demoPoints(a),t));
  expect(r.tip).toBeNull();
 });
});

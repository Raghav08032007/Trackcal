// Every hold must recognise its own position, ignore the others, and time only what is actually held.
import {describe,expect,it} from 'vitest';
import {HOLD_KINDS,HOLDS,HoldTracker,type HoldKind} from '@/lib/pose/holds';
import {MOVES,full,layout,placement,type Move} from '@/lib/pose/exercise-motions';
import type {Landmark,PoseFrame} from '@/lib/pose/types';

function frameFor(m:Move,key=0,t=0,wobble=0):PoseFrame{
 const s=layout(m,full(m.keys[key]),placement(m));
 const points:Landmark[]=Array.from({length:33},(_,id)=>{const at=s[id]??s[id%2?11:12];return {x:at[0]+wobble,y:at[1]+(s[id]?0:-.08),visibility:.95,presence:1};});
 return {landmarks:[points],timestamp:t,width:480,height:480};
}
const holds=(m:Move,key=0)=>{const tracker=HOLD_KINDS.map(kind=>new HoldTracker(kind));let found:HoldKind[]=[];for(let t=0;t<=1000;t+=100){found=tracker.filter(h=>h.update(frameFor(m,key,t)).inPose).map(h=>h.kind);}return found;};

describe('holds',()=>{
 for(const kind of HOLD_KINDS)it(`${kind} is recognised in its own position, and only there`,()=>expect(holds(HOLDS[kind].move)).toEqual([kind]));
 it('standing tall, a jumping jack and a lunge are not holds',()=>{
  expect(holds(MOVES.squat)).toEqual([]);
  expect(holds(MOVES.jack,1)).toEqual([]);
  expect(holds(MOVES.lunge,1)).toEqual([]);
 });
 it('a lunge is not a wall sit: the feet are apart',()=>expect(holds(MOVES.lunge,1)).not.toContain('wallsit'));
 it('counts the seconds held and the best unbroken hold',()=>{
  const tracker=new HoldTracker('plank');let result=tracker.update(frameFor(HOLDS.plank.move,0,0));
  for(let t=100;t<=3000;t+=100)result=tracker.update(frameFor(HOLDS.plank.move,0,t));
  expect(result.held).toBeGreaterThan(2700);expect(result.best).toBe(result.current);
 });
 it('a short blip keeps the hold going, a real break ends it',()=>{
  const tracker=new HoldTracker('plank'),plank=(t:number)=>tracker.update(frameFor(HOLDS.plank.move,0,t)),stand=(t:number)=>tracker.update(frameFor(MOVES.squat,0,t));
  for(let t=0;t<=2000;t+=100)plank(t);stand(2100);stand(2200);let r=plank(2300);plank(2400);r=plank(2500);
  expect(r.current).toBeGreaterThan(2000);
  for(let t=2600;t<=4000;t+=100)stand(t);r=plank(4100);r=plank(4200);
  expect(r.current).toBeLessThan(300);expect(r.best).toBeGreaterThan(2000);
 });
 it('adds no time when frames arrive after a long gap',()=>{
  const tracker=new HoldTracker('wallsit');tracker.update(frameFor(HOLDS.wallsit.move,0,0));tracker.update(frameFor(HOLDS.wallsit.move,0,100));
  const r=tracker.update(frameFor(HOLDS.wallsit.move,0,60000));
  expect(r.held).toBeLessThan(500);
 });
 it('nothing counts when the body is out of view',()=>{
  const tracker=new HoldTracker('plank'),hidden=(t:number)=>{const f=frameFor(HOLDS.plank.move,0,t);f.landmarks[0]=f.landmarks[0].map(l=>({...l,visibility:.1}));return f;};
  let r=tracker.update(hidden(0));for(let t=100;t<=2000;t+=100)r=tracker.update(hidden(t));
  expect(r.held).toBe(0);expect(r.visible).toBe(false);
 });
});

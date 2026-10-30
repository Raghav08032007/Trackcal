// Deterministic rep counting on synthetic landmark fixtures (tests/fixtures/pose/generate.mjs), plus property tests.
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SessionTracker} from '@/lib/pose/session-tracker';
import {RepCounter} from '@/lib/pose/rep-counter';
import {OneEuroFilter} from '@/lib/pose/one-euro';
import {angle} from '@/lib/pose/landmarks';
import {EXERCISE_CONFIG,EXERCISE_LEVELS,withLevel} from '@/lib/pose/exercise-config';
import type {ExerciseKind,PoseFrame,TrackingResult} from '@/lib/pose/types';
type Fixture={fps:number;width:number;height:number;synthetic:boolean;base:number[][];frames:{t:number;p:Record<string,number[]>}[]};
const load=(ex:string,sc:string):Fixture=>JSON.parse(gunzipSync(readFileSync(`tests/fixtures/pose/${ex}-${sc}.json.gz`)).toString());
const frames=(f:Fixture)=>f.frames.map(fr=>({landmarks:[f.base.map((b,i)=>{const q=fr.p[i]??b;return {x:q[0],y:q[1],visibility:q[2],presence:1};})],timestamp:fr.t,width:f.width,height:f.height}) as PoseFrame);
function play(ex:ExerciseKind,sc:string){const t=new SessionTracker(ex),results:TrackingResult[]=[];for(const fr of frames(load(ex,sc))){const r=t.frame(fr);if(r)results.push(r);}return {t,results,last:results.at(-1)!};}
const none={too_shallow:0,too_fast:0,too_slow:0,lost_tracking:0};
// Expected answers come from how each fixture was built, not from running the counter.
const EXPECTED:Record<string,[number,Partial<typeof none>]>={
 clean:[5,{}],noisy:[5,{}],half_reps:[3,{too_shallow:3}],occlusion:[4,{lost_tracking:1}],walk_out:[3,{}],very_fast:[0,{too_fast:1}],very_slow:[2,{}],
};
describe('rep counts on synthetic landmark fixtures',()=>{
 for(const ex of ['squat','pushup','curl','press','situp'] as ExerciseKind[])for(const [sc,[reps,rejections]] of Object.entries(EXPECTED))
  it(`${ex} · ${sc}: ${reps} reps`,()=>{const {t}=play(ex,sc);expect(t.counter.reps).toBe(reps);expect(t.counter.rejections).toEqual({...none,...rejections});});
 for(const ex of ['squat','pushup','curl','press','situp'] as ExerciseKind[]){
  it(`${ex}: walking out of frame pauses counting with a clear instruction`,()=>{const {last}=play(ex,'walk_out');expect(last.paused).toBe(true);expect(last.message).toBe('Step back so your whole body is in frame.');});
  it(`${ex}: a half rep tells the person why it was not counted`,()=>{const {results}=play(ex,'half_reps');expect(results.some(r=>r.rejection==='too_shallow'&&r.message.includes('go a little deeper'))).toBe(true);});
  it(`${ex}: occlusion never counts while hidden`,()=>{const {results}=play(ex,'occlusion');const hidden=results.filter(r=>r.paused);expect(hidden.length).toBeGreaterThan(10);expect(new Set(hidden.map(r=>r.reps)).size).toBe(1);});
 }
 it('fixtures are labelled synthetic and sampled at a realistic rate',()=>{const f=load('squat','clean');expect(f.synthetic).toBe(true);expect(f.fps).toBe(20);});
});

describe('state machine details',()=>{
 const c=EXERCISE_CONFIG.squat,ok=(angle:number)=>({angle,confidence:.9,valid:true,reason:''});
 function drive(counter:RepCounter,points:[number,number][]){let r;for(const [t,a] of points)r=counter.update(ok(a),t);return r!;}
 const ramp=(from:number,to:number,start:number,ms:number,step=50)=>Array.from({length:Math.floor(ms/step)+1},(_,i)=>[start+i*step,from+(to-from)*i/Math.floor(ms/step)] as [number,number]);
 it('a rep slower than the maximum duration is rejected as too slow',()=>{const k=new RepCounter(c);drive(k,ramp(175,175,0,300));drive(k,ramp(175,90,350,7000,100));drive(k,ramp(90,175,7400,7000,100));expect(k.reps).toBe(0);expect(k.rejections.too_slow).toBe(1);});
 it('jitter around the top threshold never starts a cycle',()=>{const k=new RepCounter(c);drive(k,ramp(175,175,0,300));for(let t=350;t<3000;t+=50)k.update(ok(c.up+(t%100?3:-3)),t);expect(k.phase).toBe('UP');expect(Object.values(k.rejections).every(v=>v===0)).toBe(true);});
 it('a duplicate or stale frame changes nothing',()=>{const k=new RepCounter(c);drive(k,ramp(175,175,0,300));const before=k.phase;k.update(ok(80),300);k.update(ok(80),100);expect(k.phase).toBe(before);});
});

describe('properties',()=>{
 let seed=42;const rand=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
 it('the joint angle does not change when the body is scaled uniformly',()=>{
  for(let i=0;i<500;i++){const pts=[0,1,2].map(()=>({x:rand(),y:rand()})),k=.05+rand()*20,scaled=pts.map(p=>({x:p.x*k,y:p.y*k}));
   const a=angle(pts[0],pts[1],pts[2]),b=angle(scaled[0],scaled[1],scaled[2]);if(Number.isFinite(a))expect(b).toBeCloseTo(a,6);}
 });
 it('the count never goes down, whatever the input',()=>{
  for(const ex of ['squat','pushup','curl','press','situp'] as ExerciseKind[]){const k=new RepCounter(EXERCISE_CONFIG[ex]);let prev=0,t=0;
   for(let i=0;i<5000;i++){t+=rand()<.02?900:20+rand()*60;const valid=rand()>.05;k.update({angle:rand()*180,confidence:rand(),valid,reason:''},rand()<.01?t-100:t);expect(k.reps).toBeGreaterThanOrEqual(prev);prev=k.reps;}}
 });
 it('smoothing (applied to landmark coordinates) lowers jitter without losing the movement',()=>{
  // Standing still: jitter (frame-to-frame change) drops by more than half.
  const still=new OneEuroFilter(1.2,.02);let raw=0,smooth=0,prev=.5,prevS=.5;
  for(let i=0;i<200;i++){const v=.5+(rand()-.5)*.016,s=still.filter(v,i*50);if(i){raw+=Math.abs(v-prev);smooth+=Math.abs(s-prevS);}prev=v;prevS=s;}
  expect(smooth).toBeLessThan(raw*.5);
  // Moving: a real movement keeps most of its size.
  const moving=new OneEuroFilter(1.2,.02),vals:number[]=[];
  for(let i=0;i<200;i++){const t=i*50;vals.push(moving.filter(.5+.1*Math.sin(t/400)+(rand()-.5)*.016,t));}
  expect(Math.max(...vals.slice(40))-Math.min(...vals.slice(40))).toBeGreaterThan(.17);
 });
 it('rotating the phone (new frame size) keeps the count and restarts only the movement',()=>{
  const t=new SessionTracker('squat');for(const fr of frames(load('squat','clean')))t.frame(fr);const reps=t.counter.reps;
  t.counter.resetMovement();t.analyzer.reset();const turned=frames(load('squat','clean')).map(f=>({...f,timestamp:f.timestamp+20000,width:480,height:640}));for(const f of turned)t.frame(f);
  expect(t.counter.reps).toBeGreaterThanOrEqual(reps);
 });
});

describe('difficulty levels',()=>{
 const reps=(level:keyof typeof EXERCISE_LEVELS,bottom:number)=>{const c=new RepCounter(withLevel(EXERCISE_CONFIG.curl,level));const top=165;let t=0;const see=(a:number)=>{t+=50;c.update({angle:a,confidence:.9,valid:true,reason:''},t);};
  for(let i=0;i<20;i++)see(top);for(let r=0;r<3;r++){for(let i=0;i<=20;i++)see(top-(top-bottom)*i/20);for(let i=0;i<8;i++)see(bottom);for(let i=20;i>=0;i--)see(top-(top-bottom)*i/20);for(let i=0;i<8;i++)see(top);}return c.reps;};
 it('beginner counts a rep that advanced asks to go deeper on',()=>{expect(reps('beginner',65)).toBe(3);expect(reps('advanced',65)).toBe(0);expect(reps('advanced',45)).toBe(3);});
 it('beginner leaves the base thresholds unchanged and levels only get stricter',()=>{const c=EXERCISE_CONFIG.squat;expect(withLevel(c,'beginner').down).toBe(c.down);expect(withLevel(c,'advanced').down).toBeLessThan(withLevel(c,'intermediate').down);expect(withLevel(c,'advanced').up).toBeGreaterThan(c.up);});
 it('a standing person is not counted as sit-ups',()=>{const f=load('curl','clean');const t=new SessionTracker('situp');let r;for(const fr of frames(f))r=t.frame(fr)??r;expect(t.counter.reps).toBe(0);});
});

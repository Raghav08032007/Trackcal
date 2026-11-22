import { msg } from "../i18n";
import type {Landmark,PoseFrame} from './types';
import {JointAnalyzer} from './analyzers';
import {RepCounter} from './rep-counter';
import {EXERCISE_CONFIG} from './exercise-config';
import {readBody} from './body-shape';
import {normalize} from './landmarks';
import {personalConfig,MARGIN} from './personal-range';
import {SessionTracker} from './session-tracker';
import type {ExerciseKind} from './types';
/** Sports games in Play (Phase F4): skipping, shadow boxing and racket or bat swings, counted from the camera.
 *  Everything is measured in torso lengths (shoulders to hips in the picture), so it works at any distance, on a phone or a laptop.
 *  Each detector counts only its own movement: the tests film squats, jacks, punches, raises and more and expect zero. */
export type SportKind='skip'|'box'|'cricket'|'badminton';
export type SportEvent={at:number;speed?:number};
export type SportState={count:number;paused:boolean;message:string;last:SportEvent|null};
export interface SportCounter{frame(f:PoseFrame):SportState;readonly count:number;reset():void;}

type P={x:number;y:number;ok:boolean};
const seen=(l:Landmark|undefined,min=.5)=>!!l&&(l.visibility??1)>=min;
/** Landmarks in pixels, y up, so heights read naturally. */
function px(f:PoseFrame,i:number):P{const l=f.landmarks[0]?.[i];return l?{x:l.x*f.width,y:-l.y*f.height,ok:seen(l)}:{x:0,y:0,ok:false};}
const mid=(a:P,b:P):P=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,ok:a.ok&&b.ok});
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
/** Shoulders-to-hips length in pixels, smoothed so one noisy frame doesn't rescale everything. */
class Torso{private v=0;update(f:PoseFrame){const s=mid(px(f,11),px(f,12)),h=mid(px(f,23),px(f,24));if(!s.ok||!h.ok)return this.v;const d=dist(s,h);if(d>4)this.v=this.v?this.v*.85+d*.15:d;return this.v;}get value(){return this.v;}reset(){this.v=0;}}
const quantile=(v:number[],q:number)=>{const a=[...v].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(q*a.length))];};

/** Skipping: a jump is the whole body, both feet included, leaving the floor and landing again within 0.7 s.
 *  Each joint's floor is its low point over the last 1.5 s, so it follows the person if they drift or the phone tilts. The rise
 *  is averaged over twelve joints (shoulders to toes), which is far steadier than any one joint on a phone at 3 m.
 *  Squats (feet stay down), high knees (one foot), calf raises (toes stay down) and walking don't count. */
const SKIP_JOINTS=[11,12,23,24,25,26,27,28,29,30,31,32],LEFT_FOOT=[27,29,31],RIGHT_FOOT=[28,30,32],TOES=[31,32],HIPS=[23,24];
export class SkipCounter implements SportCounter{
 count=0;private torso=new Torso();private hist:{t:number;y:number[]}[]=[];private prevBody:number|null=null;private last:SportEvent|null=null;private lost=0;
 private air:{start:number;frames:number;l:number;r:number;toes:number;hip:number}|null=null;
 reset(){this.count=0;this.torso.reset();this.hist=[];this.air=null;this.prevBody=null;this.last=null;this.lost=0;}
 frame(f:PoseFrame):SportState{
  const t=f.timestamp,T=this.torso.update(f),pts=SKIP_JOINTS.map(i=>px(f,i)),ok=(i:number)=>pts[SKIP_JOINTS.indexOf(i)].ok;
  if(!T||![23,24,27,28].every(ok)){if(++this.lost>8){this.air=null;this.prevBody=null;}return this.state(this.lost>8,msg("Step back so your hips and both feet are in view."));}
  this.lost=0;
  // Heights stay in pixels; only the rise above each joint's floor is divided by the torso, so its small wobble doesn't look like a hop.
  this.hist.push({t,y:pts.map(p=>p.ok?p.y:NaN)});while(this.hist.length&&t-this.hist[0].t>1500)this.hist.shift();
  if(this.hist.length<6)return this.state(false,msg("Ready when you are: hop on the spot."));
  // Each joint against its own usual height (median), averaged over the group first, then the floor of that average: noise in one
  // joint mostly cancels before the floor is taken, instead of every joint's floor sitting a little low.
  const ref=SKIP_JOINTS.map((_,k)=>{const v=this.hist.map(h=>h.y[k]).filter(Number.isFinite);return v.length>=5?quantile(v,.5):NaN;});
  const level=(y:number[],ids:number[])=>{let sum=0,n=0;for(const id of ids){const k=SKIP_JOINTS.indexOf(id);if(Number.isFinite(y[k])&&Number.isFinite(ref[k])){sum+=y[k]-ref[k];n++;}}return n?sum/n:NaN;};
  const rise=(ids:number[])=>{const now=level(this.hist[this.hist.length-1].y,ids),past=this.hist.map(h=>level(h.y,ids)).filter(Number.isFinite);return Number.isFinite(now)&&past.length>=5?(now-quantile(past,.15))/T:0;};
  const mean=rise;
  const now=rise(SKIP_JOINTS),body=this.prevBody===null?now:(now+this.prevBody)/2;this.prevBody=now;
  if(!this.air){if(body>.07)this.air={start:t,frames:0,l:0,r:0,toes:0,hip:0};}
  const a=this.air;
  if(a){
   if(t-a.start>700)this.air=null;                                // too slow for a jump: a calf raise or standing up
   else if(body>.04){a.frames++;a.l+=mean(LEFT_FOOT);a.r+=mean(RIGHT_FOOT);a.toes+=mean(TOES);a.hip+=mean(HIPS);}
   else{
    // The average rise while off the floor, over two frames or more: hips and both feet together, toes off the floor too.
    const n=Math.max(1,a.frames),l=a.l/n,r=a.r/n,toes=a.toes/n,hip=a.hip/n;
    const both=Math.min(l,r)>=Math.max(.04,.5*hip)&&Math.min(l,r)>=.45*Math.max(l,r);
    if(a.frames>=2&&hip>=.05&&both&&toes>=.03&&Math.max(l,r)<hip*2.5+.05){this.count++;this.last={at:t};}
    this.air=null;
   }
  }
  return this.state(false,this.count?msg("Nice rhythm. Keep it light on your toes."):msg("Hop on the spot, both feet together."));
 }
 private state(paused:boolean,message:string):SportState{return {count:this.count,paused,message,last:this.last};}
}

const PUNCH=EXERCISE_CONFIG.punch;
/** A game can forgive an arm not quite straight: the punch target eased by 20% of the movement, inside the 35% the camera page allows
 *  for a person's own range (personal-range.ts), which the tests show never counts another exercise. */
export const BOX_CONFIG=personalConfig(PUNCH,PUNCH.down+.2*(PUNCH.up-PUNCH.down)-MARGIN).config;
/** Shadow boxing: each arm counted on its own, by the same rules as the camera punch exercise (Move > Shadow boxing punches), so a
 *  jab-cross combination counts both punches. One arm's counter alone follows whichever arm is more bent and blurs alternating punches. */
export class BoxCounter implements SportCounter{
 private config=BOX_CONFIG;private arms=[0,1].map(side=>({a:new JointAnalyzer(this.config,side as 0|1),c:new RepCounter(this.config),reps:0,high:false,punches:0}));
 private last:SportEvent|null=null;private longest=0;private lastT=-Infinity;private torso=new Torso();
 get count(){return this.arms[0].punches+this.arms[1].punches;}
 reset(){this.arms.forEach(x=>{x.a.reset();x.c.reset();x.reps=0;x.high=false;x.punches=0;});this.last=null;this.longest=0;this.lastT=-Infinity;this.torso.reset();}
 frame(f:PoseFrame):SportState{
  if(f.timestamp<=this.lastT)return {count:this.count,paused:false,message:'',last:this.last};
  this.lastT=f.timestamp;
  const p=normalize(f),body=p?readBody(p,this.longest):undefined;if(body&&!Number.isNaN(body.tilt))this.longest=Math.max(this.longest*.9995,body.scale);
  const r=this.arms.map(x=>x.c.update(x.a.observe(f),f.timestamp,body)),T=this.torso.update(f);
  // A punch goes out at about shoulder height: a fist well above the head (a smash, a reach) isn't one.
  this.arms.forEach((x,side)=>{const w=px(f,15+side),sh=px(f,11+side);if(T&&w.ok&&sh.ok&&(w.y-sh.y)/T>.6)x.high=true;
   if(x.c.reps>x.reps){x.reps=x.c.reps;if(!x.high){x.punches++;this.last={at:f.timestamp};}x.high=false;}});
  const paused=r.every(x=>x.paused);
  return {count:this.count,paused,message:paused?r[0].message:this.count?msg("Fast hands. Bring each fist back to your chin."):msg("Fists up by your chin, then punch."),last:this.last};
 }
}

/** A bat or racket swing: from its highest point the hand travels at least 1.6 torso lengths, comes down within 0.6 s, peaks at
 *  9 torso lengths a second or more (about 4.5 m/s at the hand; a relaxed return to the stance is far slower), and ends at least
 *  0.6 torso lengths below that top (a drive or a smash goes down through the ball).
 *  - cricket: both hands move together, as they do on a bat, from a backlift above the shoulders;
 *  - badminton: an overhead stroke, the racket hand leading from above the shoulder, the hands at clearly different heights
 *    (in jumping jacks, and on a bat, they stay level).
 *  Each hand's stroke is followed on its own, so the one that swings is the one measured; one count per swing either way.
 *  Rejected: arms moving as mirror images (jumping jacks), short out-and-back moves (punches), upward moves (the backswing, raises). */
type Stroke={start:number;sh:number;path:[number,number];peak:number;agree:number;moved:number;hi:number;lo:number;loAt:number;gap:number;frames:number};
export class SwingCounter implements SportCounter{
 count=0;private torso=new Torso();private prev:{t:number;l:P;r:P}|null=null;private strokes:[Stroke|null,Stroke|null]=[null,null];private cool=0;private sh:number|null=null;private last:SportEvent|null=null;
 constructor(readonly sport:'cricket'|'badminton'){}
 reset(){this.count=0;this.torso.reset();this.prev=null;this.strokes=[null,null];this.cool=0;this.sh=null;this.last=null;}
 frame(f:PoseFrame):SportState{
  const t=f.timestamp,T=this.torso.update(f),l=px(f,15),r=px(f,16),shoulders=mid(px(f,11),px(f,12));
  const ready=this.sport==='cricket'?msg("Hold the bat up behind you, then drive down through the ball."):msg("Racket hand up behind your head, then smash down and through.");
  if(shoulders.ok)this.sh=shoulders.y;
  if(!T||(!l.ok&&!r.ok)||this.sh===null){this.prev=null;this.strokes=[null,null];return this.state(true,msg("Step back so both hands and your shoulders are in view."));}
  // Each hand on its own: the far hand often blinks out side-on, and that shouldn't drop the near hand's swing.
  const p=this.prev;this.prev={t,l,r};
  if(!p||t-p.t>250||t<=p.t)return this.state(false,ready);
  const dt=(t-p.t)/1000,at=[l,r],was=[p.l,p.r],live=[0,1].map(h=>at[h].ok&&was[h].ok);
  const v=[0,1].map(h=>live[h]?{x:(at[h].x-was[h].x)/T/dt,y:(at[h].y-was[h].y)/T/dt}:{x:0,y:0}),sp=v.map(q=>Math.hypot(q.x,q.y)),sh=this.sh;
  for(const hand of [0,1] as const){
   if(!live[hand]){this.strokes[hand]=null;continue;}
   if(!this.strokes[hand]&&sp[hand]>2.5){const y=was[hand].y;this.strokes[hand]={start:p.t,sh,path:[0,0],peak:0,agree:0,moved:0,hi:y,lo:y,loAt:p.t,gap:0,frames:0};}
   const s=this.strokes[hand];if(!s)continue;
   // Measured from the highest point: a new high starts it again, so the slow lift back up never counts towards it.
   if(at[hand].y>s.hi){s.hi=at[hand].y;s.lo=at[hand].y;s.loAt=t;s.start=t;s.sh=sh;s.path=[0,0];s.peak=0;s.agree=0;s.moved=0;s.gap=0;s.frames=0;}
   else{if(at[hand].y<s.lo){s.lo=at[hand].y;s.loAt=t;}s.path[0]+=sp[0]*dt;s.path[1]+=sp[1]*dt;s.peak=Math.max(s.peak,sp[hand]);if(live[0]&&live[1]){s.gap+=Math.abs(l.y-r.y)/T;s.frames++;}if(sp[0]>1&&sp[1]>1){s.moved++;s.agree+=(v[0].x*v[1].x+v[0].y*v[1].y)/(sp[0]*sp[1]);}}
   // The hand is nearly still at the top, so the downswing gets 0.3 s to begin before a slow hand ends the stroke.
   if(!((sp[hand]<1.2&&(s.path[hand]>.3||t-s.start>300))||t-s.start>800))continue;
   this.strokes[hand]=null;
   const path=s.path[hand],other=s.path[1-hand],drop=(s.hi-s.lo)/T,together=s.moved?s.agree/s.moved:0,top=(s.hi-s.sh)/T;
   const mirror=other>.6*path&&together<-.2,gap=s.frames?s.gap/s.frames:1;
   const shape=this.sport==='cricket'?other>.6*path&&together>.25&&top>=.4:path>=.8*other&&together<.5&&gap>=.4&&top>.25;
   if(t>=this.cool&&s.loAt-s.start<=600&&path>=1.6&&s.peak>=9&&drop>=.6&&!mirror&&shape){this.count++;this.cool=t+350;this.strokes[1-hand]=null;this.last={at:t,speed:Math.round(s.peak*10)/10};}
  }
  return this.state(false,this.count?msg("Great swing. Reset, and go again."):ready);
 }
 private state(paused:boolean,message:string):SportState{return {count:this.count,paused,message,last:this.last};}
}

export function sportCounter(kind:SportKind):SportCounter{return kind==='skip'?new SkipCounter():kind==='box'?new BoxCounter():new SwingCounter(kind);}
/** A drill game (football footwork, a jump shot, raider steps, a sprint drill): counted by that camera exercise's own rules,
 *  so it is exactly as strict as the exercise in Move, and counts nothing else. */
export class DrillCounter implements SportCounter{
 private tracker:SessionTracker;private last:SportEvent|null=null;private seen=0;
 constructor(readonly exercise:ExerciseKind){this.tracker=new SessionTracker(exercise);}
 get count(){return this.tracker.counter.reps;}
 reset(){this.tracker=new SessionTracker(this.exercise);this.last=null;this.seen=0;}
 frame(f:PoseFrame):SportState{
  const r=this.tracker.frame(f),count=this.count;
  if(count>this.seen){this.seen=count;this.last={at:f.timestamp};}
  return {count,paused:!!r?.paused,message:r?.message??'',last:this.last};
 }
}
/** The counter for any game: its own sport detector, or the one it is built on (sport-game.ts GAMES). */
export function gameCounter(game:{base?:SportKind;drill?:ExerciseKind},id:string):SportCounter{
 if(game.drill)return new DrillCounter(game.drill);
 return sportCounter(game.base??id as SportKind);
}
/** Hand speed from torso lengths a second, using an average 0.5 m torso. An estimate, shown as one. */
export const handKmh=(torsoPerS:number)=>Math.round(torsoPerS*.5*3.6);

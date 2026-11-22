import { msg } from "../i18n";
/* The live coach: watches every frame and every rep of any exercise and says one clear fix at a time.
 * - Where the camera can't count the movement: the wrong angle (side-on only / facing only), a body part out of view.
 * - Why a rep wasn't counted, with how far it went ("you went 80% of the way"), too quick, or a part that should stay still.
 * - Exercise-specific posture: elbow pointing up on overhead extensions, upper arm tucked on kickbacks, a real hinge on
 *   rows, no body swing on standing arm work.
 * - Praise once the fix is made.
 * One message at a time, each repeated at most every few seconds, so it guides without nagging. Pure logic: no camera, no DOM. */
import type {Body,BodyPart} from './body-shape';
import type {ExerciseConfig,RejectionReason} from './exercise-config';
import {EXERCISE_VARIANTS,type ExerciseKind,type Landmark,type TrackingResult} from './types';

export type CoachTone='fix'|'good';
export type CoachMessage={key:string;text:string;tone:CoachTone;vars?:Record<string,string|number>};

export const LIVE_TIPS={
 turn_side:msg("Turn side-on to the camera: this exercise can only be seen from the side."),
 face_camera:msg("Face the camera: this exercise can only be seen from the front."),
 step_in:msg("Step into the frame so I can see you."),
 shallow:msg("Not counted: you went {pct}% of the way. Go further: {cue}."),
 too_fast:msg("Not counted: too quick. Take about two seconds down and two seconds up."),
 too_slow:msg("Not counted: that rep took a long time. Start the next one from the top."),
 lost:msg("Not counted: you left the frame during that rep."),
 different:msg("Not counted: that looked like a different movement. Follow the demo: {cue}."),
 elbow_up:msg("Keep your elbow pointing up, close to your head."),
 arm_tuck:msg("Keep your upper arm still, tucked by your side. Only your forearm moves."),
 hinge:msg("Hinge forward more: bring your chest towards the floor."),
 swing:msg("Keep your body still: don't swing to move the weight."),
 better:msg("That's it, much better!"),
} as const;
/** "I can't see your ..." and "Keep your ... still", one sentence per body part (word order differs by language). */
export const HIDDEN:Record<BodyPart|'toes',string>={shoulders:msg("I can't see your shoulders. Step back or move the camera."),elbows:msg("I can't see your elbows. Step back or move the camera."),
 wrists:msg("I can't see your hands. Step back or move the camera."),hips:msg("I can't see your hips. Step back or move the camera."),
 knees:msg("I can't see your knees. Step back or move the camera."),ankles:msg("I can't see your feet. Step back or move the camera."),toes:msg("I can't see your feet. Step back or move the camera.")};
export const KEEP_STILL:Record<BodyPart,string>={shoulders:msg("Keep your shoulders still."),elbows:msg("Keep your elbows still."),wrists:msg("Keep your hands steady."),
 hips:msg("Keep your hips still."),knees:msg("Keep your knees still."),ankles:msg("Keep your feet planted.")};

const PART_OF:Record<number,BodyPart|'toes'>={11:'shoulders',12:'shoulders',13:'elbows',14:'elbows',15:'wrists',16:'wrists',23:'hips',24:'hips',25:'knees',26:'knees',27:'ankles',28:'ankles',31:'toes',32:'toes'};
type Rule='elbow_up'|'arm_tuck'|'hinge'|'swing';
/** Posture rules by exercise (variants follow their base). Elbow pointing up on overhead work, a tucked upper arm and a real hinge on kickbacks and rows. */
const RULES:Partial<Record<ExerciseKind,Rule[]>>={overhead:['elbow_up','swing'],kickback:['arm_tuck','hinge'],row:['hinge'],revfly:['hinge'],
 curl:['swing'],hammer:['swing'],press:['swing'],raise:['swing'],front:['swing'],uprow:['swing']};
const SAME_FIX_MS=8000,ANY_FIX_MS=2600,HOLD_MS={angle:1500,hidden:1200,posture:700};
const deg=(r:number)=>r*180/Math.PI;
/** Angle of a→b from straight up, in degrees (0 = pointing up, 180 = pointing down). Image y grows downwards. */
const fromUp=(a:Landmark,b:Landmark)=>deg(Math.acos(Math.max(-1,Math.min(1,-(b.y-a.y)/(Math.hypot(b.x-a.x,b.y-a.y)||1e-6)))));
const between=(o:Landmark,a:Landmark,b:Landmark)=>{const ax=a.x-o.x,ay=a.y-o.y,bx=b.x-o.x,by=b.y-o.y;return deg(Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/((Math.hypot(ax,ay)*Math.hypot(bx,by))||1e-6)))));};

export class LiveCoach{
 private base:ExerciseKind;private since=new Map<string,number>();private said=new Map<string,number>();private lastAny=-Infinity;
 private lastRejection:RejectionReason|null=null;private reps=0;private pendingPraise=false;private tilt0:number|null=null;
 constructor(readonly kind:ExerciseKind,readonly config:ExerciseConfig){this.base=(EXERCISE_VARIANTS[kind as keyof typeof EXERCISE_VARIANTS]??kind) as ExerciseKind;}

 /** One frame. counter: what the rep counter knows about the cycle that just ended. Returns a message to show and say, or null. */
 update(r:TrackingResult,body:Body|undefined,p:Landmark[]|null,counter:{attempts:number[];mismatches:string[]},t:number):CoachMessage|null{
  const c=this.config;
  // 1. Rep events first: a rep that was not counted, with the reason; praise once a fix has worked.
  if(r.reps>this.reps){this.reps=r.reps;this.lastRejection=null;if(this.pendingPraise){this.pendingPraise=false;return this.emit({key:'better',text:LIVE_TIPS.better,tone:'good'},t,true);}}
  if(r.rejection&&r.rejection!==this.lastRejection){
   this.lastRejection=r.rejection;const m=this.rejection(r.rejection,counter);
   if(m)return this.emit(m,t,true);
  }else if(!r.rejection)this.lastRejection=null;
  // 2. Can the camera see the movement at all?
  if(!p||!p.length)return this.held('step_in',true,t,HOLD_MS.hidden)?this.emit({key:'step_in',text:LIVE_TIPS.step_in,tone:'fix'},t):null;
  this.held('step_in',false,t,0);
  const hidden=this.hidden(p);
  if(this.held('hidden',!!hidden,t,HOLD_MS.hidden)&&hidden)return this.emit({key:'hidden_'+hidden,text:HIDDEN[hidden],tone:'fix'},t);
  if(body&&Number.isFinite(body.facing)&&!c.bothAngles){
   const facing=body.facing>.45,side=body.facing<.3;
   if(this.held('turn_side',c.plane!=='front'&&facing,t,HOLD_MS.angle))return this.emit({key:'turn_side',text:LIVE_TIPS.turn_side,tone:'fix'},t);
   if(this.held('face_camera',c.plane==='front'&&side,t,HOLD_MS.angle))return this.emit({key:'face_camera',text:LIVE_TIPS.face_camera,tone:'fix'},t);
  }
  // 3. Posture for this exercise, only while a rep is under way (the start position may differ).
  const moving=r.phase==='GOING_DOWN'||r.phase==='DOWN'||r.phase==='GOING_UP';
  if(body&&Number.isFinite(body.tilt)&&(r.phase==='SETUP'||r.phase==='UP'))this.tilt0=this.tilt0===null?body.tilt:this.tilt0*.9+body.tilt*.1;
  for(const rule of RULES[this.base]??[]){
   const bad=moving&&this.broken(rule,p,body);
   if(this.held(rule,bad,t,HOLD_MS.posture))return this.emit({key:rule,text:LIVE_TIPS[rule],tone:'fix'},t);
  }
  return null;
 }

 reset(){this.since.clear();this.said.clear();this.lastAny=-Infinity;this.lastRejection=null;this.reps=0;this.pendingPraise=false;this.tilt0=null;}

 private rejection(reason:RejectionReason,counter:{attempts:number[];mismatches:string[]}):CoachMessage|null{
  const c=this.config,cue=c.cues[1]??'';
  if(reason==='too_shallow'){
   const bottom=counter.attempts[counter.attempts.length-1],pct=bottom===undefined?null:Math.round(Math.max(0,Math.min(.99,(c.up-bottom)/(c.up-c.down)))*100);
   return pct===null||pct<15?null:{key:'shallow',text:LIVE_TIPS.shallow,tone:'fix',vars:{pct,cue}};
  }
  if(reason==='too_fast')return {key:'too_fast',text:LIVE_TIPS.too_fast,tone:'fix'};
  if(reason==='too_slow')return {key:'too_slow',text:LIVE_TIPS.too_slow,tone:'fix'};
  if(reason==='lost_tracking')return {key:'lost',text:LIVE_TIPS.lost,tone:'fix'};
  const last=counter.mismatches[counter.mismatches.length-1]??'',[how,part]=last.split(' ') as [string,BodyPart|undefined];
  if(how==='moved'&&part&&KEEP_STILL[part])return {key:'still_'+part,text:KEEP_STILL[part],tone:'fix'};
  return {key:'different',text:LIVE_TIPS.different,tone:'fix',vars:{cue}};
 }

 /** The first body part the exercise needs that neither side shows clearly. */
 private hidden(p:Landmark[]):BodyPart|'toes'|null{
  const c=this.config,ok=(id:number)=>(p[id]?.visibility??0)>=c.minVisibility;
  const [left,right]=c.required;
  if(left.every(ok)||right.every(ok))return null;
  const side=left.filter(ok).length>=right.filter(ok).length?left:right,missing=side.find(id=>!ok(id));
  return missing===undefined?null:PART_OF[missing]??null;
 }

 private broken(rule:Rule,p:Landmark[],body:Body|undefined):boolean{
  const s=(p[11]?.visibility??0)+(p[13]?.visibility??0)>=(p[12]?.visibility??0)+(p[14]?.visibility??0)?0:1;
  const sh=p[11+s],el=p[13+s],hip=p[23+s],ok=(l?:Landmark)=>!!l&&(l.visibility??0)>=.6;
  if(rule==='elbow_up')return ok(sh)&&ok(el)&&fromUp(sh,el)>40;                    // upper arm should point up beside the head
  if(rule==='arm_tuck')return ok(sh)&&ok(el)&&ok(hip)&&between(sh,el,hip)>40;       // upper arm along the body, not swinging
  if(rule==='hinge')return !!body&&Number.isFinite(body.tilt)&&body.tilt<25;          // chest should come forward
  if(rule==='swing')return !!body&&Number.isFinite(body.tilt)&&this.tilt0!==null&&Math.abs(body.tilt-this.tilt0)>16;
  return false;
 }

 /** True once a condition has held for `ms` without a break. */
 private held(key:string,on:boolean,t:number,ms:number){
  if(!on){this.since.delete(key);return false;}
  const from=this.since.get(key)??t;this.since.set(key,from);return t-from>=ms;
 }

 private emit(m:CoachMessage,t:number,urgent=false):CoachMessage|null{
  if(t-(this.said.get(m.key)??-Infinity)<SAME_FIX_MS)return null;
  if(!urgent&&t-this.lastAny<ANY_FIX_MS)return null;
  this.said.set(m.key,t);this.lastAny=t;
  if(m.tone==='fix')this.pendingPraise=true;
  return m;
 }
}

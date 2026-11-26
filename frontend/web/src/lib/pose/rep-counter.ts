import { msg } from "../i18n";
import type {Observation,TrackingResult} from './types';
import {REJECTION_TIPS,type ExerciseConfig,type RejectionReason} from './exercise-config';
import type {ExerciseForm} from './exercise-forms';
import {Travel,type Body,type BodyPart} from './body-shape';
/** Heuristic participation estimates, never a form/medical-safety assessment.
 *  SETUP -> UP -> GOING_DOWN -> DOWN -> GOING_UP -> UP. A rep counts only on a full cycle: enough range of motion, a
 *  sane duration and the body visible throughout. Thresholds use hysteresis and must hold for minDwellMs, so jitter
 *  around a threshold never flips the phase. The count only ever goes up (or back to 0 on reset()). */
export type Phase='SETUP'|'UP'|'GOING_DOWN'|'DOWN'|'GOING_UP';
const GAP_MS=750,GRACE_MS=600,TIP_MS=2500,MAX_REPS=100,CROSSING_MARGIN=6,BOBBING=6;
/** More of a rep than this in the wrong shape, and it is a different exercise. Brief glitches stay below it. */
const WRONG_SHARE=.35,BANNED_FRAMES=4;
/** How far back up from the bottom a rep has to come to count. */
const RETURN_SHARE=.7;
/** What the other camera angle can't measure, marked unknown so no check fails on it.
 *  Head-on, a forward-and-back move hides lean and joint angles (a shorter torso still shows the lean).
 *  Side-on, a move out to the sides keeps lean and bends but hides how wide the feet and knees are. */
function unseen(b:Body,plane:'side'|'front'):Body{
 return plane==='side'?{...b,tilt:NaN,knee:NaN,kneeWide:NaN,kneeGap:NaN,hip:NaN,hipWide:NaN,hipGap:NaN,elbow:NaN,elbowWide:NaN,facing:NaN}
  :{...b,facing:NaN,stance:NaN,kneeGap:NaN,hipGap:NaN};
}
/** The left-side landmark of each body part, to tell whether a part belongs to the measured limb. */
const FIRST_ID:Record<BodyPart,number>={shoulders:11,elbows:13,wrists:15,hips:23,knees:25,ankles:27};
export class RepCounter{
 reps=0;phase:Phase='SETUP';private side:0|1|null=null;mismatches:string[]=[];repLog:{ms:number;range:number}[]=[];
 /** The bottom of each honest attempt this set (counted, or not deep enough), for learning the person's own range. */
 attempts:number[]=[];rejections:Record<RejectionReason,number>={too_shallow:0,too_fast:0,too_slow:0,lost_tracking:0,wrong_exercise:0};
 private last=-Infinity;private held:{key:string;since:number;frames:number}|null=null;
 private cycle:{start:number;top:number;bottom:number;crossings:number;below:boolean;frames:number;wrong:number;low:number;lowWrong:number;banned:number;reached:boolean;travel:Travel;across:number}|null=null;private top=0;private rejected:{reason:RejectionReason;at:number}|null=null;private lost:number|null=null;
 constructor(private config:ExerciseConfig){}
 /** Forget the movement in progress (pause, camera switch, rotation); the count stays. */
 resetMovement(){this.phase='SETUP';this.held=null;this.cycle=null;}
 reset(){this.reps=0;this.mismatches=[];this.repLog=[];this.attempts=[];this.last=-Infinity;this.rejected=null;for(const k in this.rejections)this.rejections[k as RejectionReason]=0;this.resetMovement();}
 private reject(reason:RejectionReason,t:number){if(reason==='too_shallow'&&this.cycle&&this.attempts.length<MAX_REPS)this.attempts.push(this.cycle.bottom);this.rejections[reason]++;this.rejected={reason,at:t};this.cycle=null;}
 /** True once `key` has held for the dwell time (at least two frames). */
 private hold(key:string,on:boolean,t:number){
  if(!on){if(this.held?.key===key)this.held=null;return false;}
  if(this.held?.key!==key)this.held={key,since:t,frames:0};
  this.held.frames++;return this.held.frames>=2&&t-this.held.since>=this.config.minDwellMs;
 }
 /** Follow the shape of the whole body through a rep. */
 private watch(body:Body|undefined,a:number){
  const y=this.cycle,form=this.config.form;if(!y||!body||!form)return;
  y.frames++;y.travel.add(body);if(this.across(body)){y.across++;body=unseen(body,this.config.plane!);}if(form.never?.(body))y.wrong++;
  if(form.reaches?.(body))y.reached=true;if(form.banned?.(body))y.banned++;
  // The bottom check looks only at the true bottom of the rep, not the frames on the way down to it.
  // Someone counted to their own range never reaches the full bottom shape, so it is checked only as deep as the standard target.
  if(a<=this.config.down){y.low++;if(form.atBottom?.(body))y.lowWrong++;}
 }
 /** Filmed from the other angle than the exercise moves in: side-on for a move out to the sides, head-on for one forward and back. */
 private across(body:Body){const plane=this.config.plane;return plane==='side'?body.facing>.5:plane==='front'?body.facing<.3:false;}
 /** Which check the movement that just finished failed, if any. */
 private mismatch(){
  const y=this.cycle,form=this.config.form;if(!y||!form||!y.frames)return '';
  if(y.banned>=BANNED_FRAMES)return 'banned';
  if(y.wrong/y.frames>WRONG_SHARE)return 'shape';
  // On a slow camera only a frame or two may land at the bottom: one odd frame must not decide the rep.
  if(y.low>=3&&y.lowWrong/y.low>.5)return 'bottom';
  // From the other angle the rep starts and ends at slightly different moments, so the start position may fall outside it.
  if(form.reaches&&!y.reached&&y.across/y.frames<=.5)return 'reach';
  // From the other angle part of the travel runs towards the camera, so half the usual distance on screen is enough.
  return this.travelled(form,y.across/y.frames>.5?.5:1);
 }
 private travelled(form:ExerciseForm,share=1){
  const y=this.cycle!;
  // A joint of the limb being counted is judged on the side the angle is read from: from the side or three-quarters, the far
  // one is half hidden behind the body and its point jitters (video bench: 0.5 torso lengths of jitter on a still far elbow).
  // Only for a joint of the limb being measured (the elbow of a curl): another limb on the far side must still be watched (bird dog vs donkey kick).
  const near=this.side!==null?this.side:undefined,own=new Set(this.config.joints[0]);
  for(const [part,most] of Object.entries(form.still??{}))if((form.planted&&part==='wrists'?y.travel.least(part as BodyPart):y.travel.of(part as BodyPart,own.has(FIRST_ID[part as BodyPart])?near:undefined))>most)return "moved "+part;
  for(const [part,least] of Object.entries(form.moves??{}))if(y.travel.of(part as BodyPart)<least*share)return "still "+part;
  return '';
 }
 update(o:Observation,t:number,body?:Body):TrackingResult{
  if(o.valid&&o.side!==undefined)this.side=o.side;
  const c=this.config,inCycle=()=>this.phase==='GOING_DOWN'||this.phase==='DOWN'||this.phase==='GOING_UP';
  const out=(accepted:boolean,message:string,paused=false):TrackingResult=>({reps:this.reps,phase:this.phase,confidence:o.confidence,message,accepted,paused,rejection:this.rejected&&t-this.rejected.at<TIP_MS?this.rejected.reason:null,progress:o.valid?Math.min(1,Math.max(0,(c.up-o.angle)/(c.up-c.down))):0});
  if(!Number.isFinite(t)||t<=this.last)return out(false,msg("Duplicate or stale frame ignored."));
  if(t-this.last>GAP_MS&&this.phase!=='SETUP'){if(inCycle())this.reject('lost_tracking',t);this.resetMovement();}
  this.last=t;
  // The analyzer started again from a new position: a rep in progress can't be finished against it.
  if(o.restart){if(inCycle())this.reject('lost_tracking',t);this.resetMovement();this.cycle=null;}
  // A low-confidence frame or two is normal in a dim room: the rep carries on unless tracking stays gone.
  if(!o.valid){this.lost??=t;if(t-this.lost<GRACE_MS)return out(false,o.reason||msg("Tracking paused."));if(inCycle())this.reject('lost_tracking',t);this.resetMovement();return out(false,o.reason||msg("Tracking paused."),true);}
  this.lost=null;
  const a=o.angle;
  if(this.cycle){this.cycle.bottom=Math.min(this.cycle.bottom,a);const mid=(c.up+c.down)/2,below=a<mid-CROSSING_MARGIN?true:a>mid+CROSSING_MARGIN?false:this.cycle.below;if(below!==this.cycle.below){this.cycle.below=below;this.cycle.crossings++;}}
  this.watch(body,a);
  if(this.cycle&&t-this.cycle.start>c.maxRepMs){this.reject('too_slow',t);this.phase='SETUP';}
  switch(this.phase){
   case 'SETUP':if(this.hold('up',a>=c.up,t)){this.phase='UP';this.top=a;}break;
   case 'UP':
    this.top=Math.max(this.top,a);
    if(a<c.up-c.hysteresis){this.phase='GOING_DOWN';this.cycle={start:t,top:this.top,bottom:a,crossings:0,below:false,frames:0,wrong:0,low:0,lowWrong:0,banned:0,reached:false,travel:new Travel(),across:0};this.held=null;}break;
   case 'GOING_DOWN':
    if(this.hold('down',a<=c.down,t))this.phase='DOWN';
    else if(this.hold('up',a>=c.up,t)){
     // Came back up without reaching the bottom: a half rep, or quick bobbing that never settles at the top or the
     // bottom (several mid-angle crossings in one cycle). A wobble under 15 degrees is ignored.
     if(this.cycle&&this.cycle.top-this.cycle.bottom>=15)this.reject(this.cycle.crossings>BOBBING||t-this.cycle.start<c.minRepMs*.75?'too_fast':'too_shallow',t);else this.cycle=null;  // much quicker than a rep takes: say so, rather than 'go deeper'
     this.phase='UP';this.top=a;}
    break;
   case 'DOWN':if(a>c.down+c.hysteresis){this.phase='GOING_UP';this.held=null;}break;
   case 'GOING_UP':
    if(this.hold('down',a<=c.down,t))this.phase='DOWN';
    // Back most of the way up from this rep's own bottom is back up: people rarely lock out fully between quick reps.
    // Only after a clear start position, so a movement that never stands tall (a dip seen as a squat) doesn't count.
    else if(this.cycle&&this.hold('up',a>=(this.cycle.top>=c.up+10?Math.min(c.up,Math.max(c.down+c.hysteresis+6,this.cycle.bottom+RETURN_SHARE*(this.cycle.top-this.cycle.bottom))):c.up),t)){
     const duration=t-this.cycle.start,range=Math.max(this.cycle.top,a)-this.cycle.bottom;
     // Far too quick is the first thing to say: a rushed rep often looks like another exercise too.
     const fast=this.cycle.crossings>BOBBING||duration<c.minRepMs,wrong=fast?'':this.mismatch();if(wrong)this.mismatches.push(wrong);
     if(fast)this.reject('too_fast',t);
     else if(wrong)this.reject('wrong_exercise',t);
     else if(range<c.minRangeDeg)this.reject('too_shallow',t);
     else{if(this.reps<MAX_REPS){this.repLog.push({ms:duration,range});this.attempts.push(this.cycle.bottom);}this.reps=Math.min(MAX_REPS,this.reps+1);this.rejected=null;this.cycle=null;}
     this.phase='UP';this.top=a;}
    break;
  }
  const tip=this.rejected&&t-this.rejected.at<TIP_MS?REJECTION_TIPS[this.rejected.reason]:'';
  return out(true,tip||(this.phase==='SETUP'?msg("Return to a comfortable starting position."):msg("Tracking is active. You can pause whenever you need.")));
 }
}

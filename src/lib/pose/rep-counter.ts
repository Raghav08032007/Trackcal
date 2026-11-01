import type {Observation,TrackingResult} from './types';
import {REJECTION_TIPS,type ExerciseConfig,type RejectionReason} from './exercise-config';
/** Heuristic participation estimates, never a form/medical-safety assessment.
 *  SETUP -> UP -> GOING_DOWN -> DOWN -> GOING_UP -> UP. A rep counts only on a full cycle: enough range of motion, a
 *  sane duration and the body visible throughout. Thresholds use hysteresis and must hold for minDwellMs, so jitter
 *  around a threshold never flips the phase. The count only ever goes up (or back to 0 on reset()). */
export type Phase='SETUP'|'UP'|'GOING_DOWN'|'DOWN'|'GOING_UP';
const GAP_MS=750,GRACE_MS=600,TIP_MS=2500,MAX_REPS=100,CROSSING_MARGIN=6,BOBBING=4;
export class RepCounter{
 reps=0;phase:Phase='SETUP';rejections:Record<RejectionReason,number>={too_shallow:0,too_fast:0,too_slow:0,lost_tracking:0};
 private last=-Infinity;private held:{key:string;since:number;frames:number}|null=null;
 private cycle:{start:number;top:number;bottom:number;crossings:number;below:boolean}|null=null;private top=0;private rejected:{reason:RejectionReason;at:number}|null=null;private lost:number|null=null;
 constructor(private config:ExerciseConfig){}
 /** Forget the movement in progress (pause, camera switch, rotation); the count stays. */
 resetMovement(){this.phase='SETUP';this.held=null;this.cycle=null;}
 reset(){this.reps=0;this.last=-Infinity;this.rejected=null;for(const k in this.rejections)this.rejections[k as RejectionReason]=0;this.resetMovement();}
 private reject(reason:RejectionReason,t:number){this.rejections[reason]++;this.rejected={reason,at:t};this.cycle=null;}
 /** True once `key` has held for the dwell time (at least two frames). */
 private hold(key:string,on:boolean,t:number){
  if(!on){if(this.held?.key===key)this.held=null;return false;}
  if(this.held?.key!==key)this.held={key,since:t,frames:0};
  this.held.frames++;return this.held.frames>=2&&t-this.held.since>=this.config.minDwellMs;
 }
 update(o:Observation,t:number):TrackingResult{
  const c=this.config,inCycle=()=>this.phase==='GOING_DOWN'||this.phase==='DOWN'||this.phase==='GOING_UP';
  const out=(accepted:boolean,message:string,paused=false):TrackingResult=>({reps:this.reps,phase:this.phase,confidence:o.confidence,message,accepted,paused,rejection:this.rejected&&t-this.rejected.at<TIP_MS?this.rejected.reason:null,progress:o.valid?Math.min(1,Math.max(0,(c.up-o.angle)/(c.up-c.down))):0});
  if(!Number.isFinite(t)||t<=this.last)return out(false,'Duplicate or stale frame ignored.');
  if(t-this.last>GAP_MS&&this.phase!=='SETUP'){if(inCycle())this.reject('lost_tracking',t);this.resetMovement();}
  this.last=t;
  // A low-confidence frame or two is normal in a dim room: the rep carries on unless tracking stays gone.
  if(!o.valid){this.lost??=t;if(t-this.lost<GRACE_MS)return out(false,o.reason||'Tracking paused.');if(inCycle())this.reject('lost_tracking',t);this.resetMovement();return out(false,o.reason||'Tracking paused.',true);}
  this.lost=null;
  const a=o.angle;
  if(this.cycle){this.cycle.bottom=Math.min(this.cycle.bottom,a);const mid=(c.up+c.down)/2,below=a<mid-CROSSING_MARGIN?true:a>mid+CROSSING_MARGIN?false:this.cycle.below;if(below!==this.cycle.below){this.cycle.below=below;this.cycle.crossings++;}}
  if(this.cycle&&t-this.cycle.start>c.maxRepMs){this.reject('too_slow',t);this.phase='SETUP';}
  switch(this.phase){
   case 'SETUP':if(this.hold('up',a>=c.up,t)){this.phase='UP';this.top=a;}break;
   case 'UP':
    this.top=Math.max(this.top,a);
    if(a<c.up-c.hysteresis){this.phase='GOING_DOWN';this.cycle={start:t,top:this.top,bottom:a,crossings:0,below:false};this.held=null;}break;
   case 'GOING_DOWN':
    if(this.hold('down',a<=c.down,t))this.phase='DOWN';
    else if(this.hold('up',a>=c.up,t)){
     // Came back up without reaching the bottom: a half rep, or quick bobbing that never settles at the top or the
     // bottom (several mid-angle crossings in one cycle). A wobble under 15 degrees is ignored.
     if(this.cycle&&this.cycle.top-this.cycle.bottom>=15)this.reject(this.cycle.crossings>BOBBING||t-this.cycle.start<c.minRepMs/3?'too_fast':'too_shallow',t);else this.cycle=null;
     this.phase='UP';this.top=a;}
    break;
   case 'DOWN':if(a>c.down+c.hysteresis){this.phase='GOING_UP';this.held=null;}break;
   case 'GOING_UP':
    if(this.hold('down',a<=c.down,t))this.phase='DOWN';
    else if(this.hold('up',a>=c.up,t)&&this.cycle){
     const duration=t-this.cycle.start,range=Math.max(this.cycle.top,a)-this.cycle.bottom;
     if(this.cycle.crossings>BOBBING||duration<c.minRepMs)this.reject('too_fast',t);
     else if(range<c.minRangeDeg)this.reject('too_shallow',t);
     else{this.reps=Math.min(MAX_REPS,this.reps+1);this.rejected=null;this.cycle=null;}
     this.phase='UP';this.top=a;}
    break;
  }
  const tip=this.rejected&&t-this.rejected.at<TIP_MS?REJECTION_TIPS[this.rejected.reason]:'';
  return out(true,tip||(this.phase==='SETUP'?'Return to a comfortable starting position.':'Tracking is active. You can pause whenever you need.'));
 }
}

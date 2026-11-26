import type {Observation} from './types';
import {EitherSideAnalyzer,JointAnalyzer,type ExerciseAnalyzer} from './analyzers';import {RepCounter} from './rep-counter';import {EXERCISE_CONFIG,withLevel} from './exercise-config';
import {readBody,type Body} from './body-shape';import {personalConfig} from './personal-range';import {normalize} from './landmarks';
import type {ExerciseKind,ExerciseLevel,PoseFrame,TrackingResult} from './types';
/** The body joints an outline needs, and how often to sample them. */
export const REPLAY_JOINTS=[11,12,13,14,15,16,23,24,25,26,27,28],REPLAY_GAP_MS=66;
export type RepReplay={ms:number;range:number;frames:number[][]};
export class SessionTracker{
 readonly config;readonly analyzer:ExerciseAnalyzer;readonly counter;private quality=0;private samples=0;private low=0;private last=-Infinity;private first=-Infinity;private longest=0;private trail:{t:number;pose:number[]}[]=[];private best:RepReplay|null=null;private worst:RepReplay|null=null;paused=false;
 /** The whole body in the latest frame, for posture tips. Kept for one frame only. */
 lastBody:Body|undefined;
 /** The joint reading of the latest frame (for the video bench). Kept for one frame only. */
 lastObservation:Observation|undefined;
 /** How far the bottom target was moved to this person's learned range (0 = the standard target). */
 readonly eased:number;
 constructor(readonly exercise:ExerciseKind,level:ExerciseLevel='beginner',reach?:number|null){const own=personalConfig(withLevel(EXERCISE_CONFIG[exercise],level),reach);this.config=own.config;this.eased=own.eased;this.analyzer=this.config.either?new EitherSideAnalyzer(this.config):new JointAnalyzer(this.config);this.counter=new RepCounter(this.config);}
 frame(frame:PoseFrame):TrackingResult|null{if(this.paused||frame.timestamp<=this.last)return null;this.last=frame.timestamp;if(this.first===-Infinity)this.first=frame.timestamp;const before=this.counter.reps,observation=this.analyzer.observe(frame);this.lastObservation=observation;this.lastBody=this.body(frame);const r=this.counter.update(observation,frame.timestamp,this.lastBody);this.remember(frame,before);this.samples++;this.quality+=observation.confidence;if(!r.accepted)this.low++;return r;}
 /** The outline of the rep just counted. Held in memory for this set: never saved or sent. */
 private remember(frame:PoseFrame,before:number){
  const joints=frame.landmarks[0],at=frame.timestamp,last=this.trail[this.trail.length-1];
  if(joints?.length&&(!last||at-last.t>=REPLAY_GAP_MS)){this.trail.push({t:at,pose:REPLAY_JOINTS.flatMap(id=>[Math.round(joints[id].x*1000)/1000,Math.round(joints[id].y*1000)/1000])});if(this.trail.length>200)this.trail.shift();}
  if(this.counter.reps===before)return;
  const rep=this.counter.repLog[this.counter.repLog.length-1];if(!rep)return;
  const replay={...rep,frames:this.trail.filter(row=>row.t>=at-rep.ms).map(row=>row.pose)};this.trail=[];
  if(!this.best||replay.range>this.best.range)this.best=replay;
  if(!this.worst||replay.range<this.worst.range)this.worst=replay;
 }
 replays(){return {best:this.best,worst:this.counter.reps>1?this.worst:null};}
 /** The whole body, for telling this exercise from any other. Nothing here is kept beyond the rep in progress. */
 private body(frame:PoseFrame){const p=normalize(frame);if(!p)return undefined;const b=readBody(p,this.longest);if(!Number.isNaN(b.tilt))this.longest=Math.max(this.longest*.9995,b.scale);return b;}
 pause(){this.paused=true;this.counter.resetMovement();this.analyzer.reset();}
 resume(){this.paused=false;this.counter.resetMovement();this.analyzer.reset();}
 reset(){this.counter.reset();this.analyzer.reset();this.trail=[];this.best=null;this.worst=null;this.longest=0;this.quality=0;this.samples=0;this.low=0;this.last=-Infinity;this.first=-Infinity;}
 /** The shallow end of this set's usual bottoms (70th percentile of three or more honest attempts), in the counter's degrees: one number, nothing about the body. */
 reach():{reach_deg?:number}{const a=[...this.counter.attempts].sort((x,y)=>x-y);return a.length>=3?{reach_deg:Math.round(a[Math.floor(a.length*.7)]*10)/10}:{};}
 /** Only these aggregates leave the tracker: no frames, no landmarks. duration_s spans the first to the last frame. */
 summary(){return {...this.reach(),estimated_reps:this.counter.reps,confidence_mean:this.samples?Math.round(this.quality/this.samples*1000)/1000:0,sampled_frames:this.samples,low_confidence_frames:this.low,duration_s:this.samples?Math.round((this.last-this.first)/100)/10:0};}
}

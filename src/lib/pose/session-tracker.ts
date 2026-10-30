import {JointAnalyzer} from './analyzers';import {RepCounter} from './rep-counter';import {EXERCISE_CONFIG,withLevel} from './exercise-config';
import type {ExerciseKind,ExerciseLevel,PoseFrame,TrackingResult} from './types';
export class SessionTracker{
 readonly config;readonly analyzer;readonly counter;private quality=0;private samples=0;private low=0;private last=-Infinity;private first=-Infinity;paused=false;
 constructor(readonly exercise:ExerciseKind,level:ExerciseLevel='beginner'){this.config=withLevel(EXERCISE_CONFIG[exercise],level);this.analyzer=new JointAnalyzer(this.config);this.counter=new RepCounter(this.config);}
 frame(frame:PoseFrame):TrackingResult|null{if(this.paused||frame.timestamp<=this.last)return null;this.last=frame.timestamp;if(this.first===-Infinity)this.first=frame.timestamp;const observation=this.analyzer.observe(frame),r=this.counter.update(observation,frame.timestamp);this.samples++;this.quality+=observation.confidence;if(!r.accepted)this.low++;return r;}
 pause(){this.paused=true;this.counter.resetMovement();this.analyzer.reset();}
 resume(){this.paused=false;this.counter.resetMovement();this.analyzer.reset();}
 reset(){this.counter.reset();this.analyzer.reset();this.quality=0;this.samples=0;this.low=0;this.last=-Infinity;this.first=-Infinity;}
 /** Only these aggregates leave the tracker: no frames, no landmarks. duration_s spans the first to the last frame. */
 summary(){return {estimated_reps:this.counter.reps,confidence_mean:this.samples?Math.round(this.quality/this.samples*1000)/1000:0,sampled_frames:this.samples,low_confidence_frames:this.low,duration_s:this.samples?Math.round((this.last-this.first)/100)/10:0};}
}

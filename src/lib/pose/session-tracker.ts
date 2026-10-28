import {SquatAnalyzer} from './squat';import {PushUpAnalyzer} from './pushup';import {BicepCurlAnalyzer} from './curl';import {RepCounter} from './rep-counter';
import type {ExerciseKind,PoseFrame,TrackingResult} from './types';
export class SessionTracker{
 readonly analyzer;readonly counter;private quality=0;private samples=0;private low=0;private last=-Infinity;paused=false;
 constructor(readonly exercise:ExerciseKind){this.analyzer=exercise==='squat'?new SquatAnalyzer():exercise==='pushup'?new PushUpAnalyzer():new BicepCurlAnalyzer();this.counter=new RepCounter(exercise==='curl'?150:155,exercise==='curl'?65:95);}
 frame(frame:PoseFrame):TrackingResult|null{if(this.paused||frame.timestamp<=this.last)return null;this.last=frame.timestamp;const observation=this.analyzer.observe(frame),r=this.counter.update(observation,frame.timestamp);this.samples++;this.quality+=observation.confidence;if(!r.accepted)this.low++;return r;}
 pause(){this.paused=true;this.counter.resetMovement();this.analyzer.reset();}
 resume(){this.paused=false;this.counter.resetMovement();this.analyzer.reset();}
 reset(){this.counter.reset();this.analyzer.reset();this.quality=0;this.samples=0;this.low=0;this.last=-Infinity;}
 summary(){return {estimated_reps:this.counter.reps,confidence_mean:this.samples?Math.round(this.quality/this.samples*1000)/1000:0,sampled_frames:this.samples,low_confidence_frames:this.low};}
}

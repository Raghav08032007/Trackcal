import type {Phase} from './rep-counter';
import type {RejectionReason} from './exercise-config';
export type Landmark={x:number;y:number;z?:number;visibility?:number;presence?:number};
export type PoseFrame={landmarks:Landmark[][];timestamp:number;width:number;height:number;brightness?:number};
export type ExerciseKind='squat'|'pushup'|'curl';
export type Observation={angle:number;confidence:number;valid:boolean;reason:string};
/** paused: tracking is gated (body out of frame, low visibility, …) and nothing can be counted until it returns.
 *  rejection: why the last movement cycle was not counted, for a few seconds after it happened. */
export type TrackingResult={reps:number;phase:Phase;confidence:number;message:string;accepted:boolean;paused:boolean;rejection:RejectionReason|null};
export const EXERCISES={squat:{title:'Squats',template:'camera_squat',setup:'Use a side view with shoulders, hips, knees and ankles visible.'},pushup:{title:'Push-ups',template:'camera_pushup',setup:'Use a side view with your whole body visible. Floor variation only.'},curl:{title:'Bicep curls',template:'camera_curl',setup:'Use a side view with shoulder, elbow, wrist and hip visible. Tracks one arm per set.'}} as const;

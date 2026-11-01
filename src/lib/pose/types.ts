import type {Phase} from './rep-counter';
import type {RejectionReason} from './exercise-config';
export type Landmark={x:number;y:number;z?:number;visibility?:number;presence?:number};
export type PoseFrame={landmarks:Landmark[][];timestamp:number;width:number;height:number;brightness?:number};
export type ExerciseKind='squat'|'pushup'|'curl'|'press'|'situp'|'wallpush';
export type ExerciseLevel='beginner'|'intermediate'|'advanced';
export type Observation={angle:number;confidence:number;valid:boolean;reason:string};
/** paused: tracking is gated (body out of frame, low visibility, …) and nothing can be counted until it returns.
 *  rejection: why the last movement cycle was not counted, for a few seconds after it happened. */
export type TrackingResult={reps:number;phase:Phase;confidence:number;message:string;accepted:boolean;paused:boolean;rejection:RejectionReason|null;progress:number};
export const EXERCISES={squat:{title:'Squats',template:'camera_squat',setup:'Face the camera or stand side-on, with your whole body from shoulders to ankles visible.'},pushup:{title:'Push-ups',template:'camera_pushup',setup:'Use a side view with your whole body visible. Floor variation only.'},curl:{title:'Bicep curls',template:'camera_curl',setup:'Face the camera or stand side-on, with shoulder, elbow, wrist and hip visible. Tracks one arm per set.'},press:{title:'Shoulder press',template:'camera_press',setup:'Face the camera or stand side-on, with shoulder, elbow, wrist and hip visible. Tracks one arm per set.'},situp:{title:'Sit-ups',template:'camera_situp',setup:'Use a side view while lying down, with shoulders, hips and knees visible. Floor variation only.'},wallpush:{title:'Wall push-ups',template:'camera_wallpush',setup:'Use a side view with shoulder, elbow, wrist and hip visible, hands on a stable wall.'}} as const;

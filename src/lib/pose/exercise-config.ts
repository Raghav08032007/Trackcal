import type {ExerciseKind,Landmark} from './types';
/** Every threshold the rep counter uses lives here, one typed config per exercise. Angles are degrees at the middle
 *  joint of the triplet; "up" is the starting position (straight joint), "down" the bent position.
 *  experimental: shown in the UI until the manual device matrix (docs/TEST_REPORT_P3.md) meets the accuracy target. */
export type ExerciseConfig={
 id:ExerciseKind;title:string;template:string;
 /** [left, right] joint triplets: angle measured at the middle landmark. */
 joints:[[number,number,number],[number,number,number]];
 /** [left, right] landmarks that must be visible for the side to be tracked. */
 required:[number[],number[]];
 up:number;down:number;hysteresis:number;
 minRangeDeg:number;minRepMs:number;maxRepMs:number;minDwellMs:number;minVisibility:number;
 /** One-Euro filter on the angle: lower minCutoff smooths more, higher beta reacts faster to quick moves. */
 smoothing:{minCutoff:number;beta:number};
 camera:{view:'side';distance:string};tips:string[];experimental:boolean;
 /** Optional pose check (aspect-corrected points), e.g. a push-up body must be roughly horizontal. */
 suitable?:(p:Landmark[],side:0|1)=>boolean;
};
const L={shoulder:[11,12],elbow:[13,14],wrist:[15,16],hip:[23,24],knee:[25,26],ankle:[27,28]};
const pick=(...parts:number[][])=>[parts.map(p=>p[0]),parts.map(p=>p[1])] as [number[],number[]];
export const EXERCISE_CONFIG:Record<ExerciseKind,ExerciseConfig>={
 squat:{id:'squat',title:'Squats',template:'camera_squat',joints:[[23,25,27],[24,26,28]],required:pick(L.shoulder,L.hip,L.knee,L.ankle),
  up:160,down:105,hysteresis:8,minRangeDeg:45,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.65,smoothing:{minCutoff:1.2,beta:.02},
  camera:{view:'side',distance:'2–3 m away, phone at hip height'},tips:['Turn side-on to the camera.','Keep shoulders, hips, knees and ankles in frame.','Even, bright light helps.'],experimental:true},
 pushup:{id:'pushup',title:'Push-ups',template:'camera_pushup',joints:[[11,13,15],[12,14,16]],required:pick(L.shoulder,L.elbow,L.wrist,L.hip,L.ankle),
  up:150,down:100,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.65,smoothing:{minCutoff:1.2,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Floor push-ups, side-on to the camera.','Keep your whole body in frame, head to feet.'],experimental:true,
  suitable:(p,s)=>{const shoulder=p[L.shoulder[s]],ankle=p[L.ankle[s]];return Math.abs(shoulder.x-ankle.x)>Math.abs(shoulder.y-ankle.y)*1.3;}},
 curl:{id:'curl',title:'Bicep curls',template:'camera_curl',joints:[[11,13,15],[12,14,16]],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:70,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.65,smoothing:{minCutoff:1.2,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, phone at chest height'},tips:['Stand side-on; one arm is tracked per set.','Keep shoulder, elbow, wrist and hip in frame.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y&&Math.abs(p[L.shoulder[s]].x-p[L.elbow[s]].x)<.25},
};
/** Why a movement cycle was not counted, and what to tell the person. */
export const REJECTION_TIPS={
 too_shallow:'Not counted: go a little deeper if it feels comfortable.',
 too_fast:'Not counted: that was very quick. Try a steadier pace.',
 too_slow:'Not counted: that rep took a long time. Pausing mid-rep is fine; start the next one from the top.',
 lost_tracking:'Not counted: you left the frame or were hidden during that rep.',
} as const;
export type RejectionReason=keyof typeof REJECTION_TIPS;

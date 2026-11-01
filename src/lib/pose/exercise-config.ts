import type {ExerciseKind,ExerciseLevel,Landmark} from './types';
/** Every threshold the rep counter uses lives here, one typed config per exercise. Angles are degrees at the middle
 *  joint of the triplet; "up" is the starting position (straight joint), "down" the bent position.
 *  experimental: shown in the UI until the manual device matrix (docs/TEST_REPORT_P3.md) meets the accuracy target. */
export type ExerciseConfig={
 id:ExerciseKind;title:string;template:string;
 /** Rough energy per rep for encouragement only; bodies differ and this is never a measurement. */
 kcalPerRep:number;
 /** [left, right] joint triplets: angle measured at the middle landmark. */
 joints:[[number,number,number],[number,number,number]];
 /** [left, right] limb ends. Their distance shrinks as the joint bends from any view, so a person facing the camera still counts. */
 span?:[[number,number],[number,number]];
 /** What to say: at the start, on the way down, on the way back. */
 cues:[string,string,string];
 /** [left, right] landmarks that help when visible but may be out of frame, like feet on a laptop camera. */
 optional?:[number[],number[]];
 /** Also read depth from how far the shoulders drop, which needs no legs in frame. */
 drop?:boolean;
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
 squat:{id:'squat',title:'Squats',template:'camera_squat',kcalPerRep:.4,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],cues:['Stand tall','Squat down','Stand up'],required:pick(L.shoulder),optional:pick(L.hip,L.knee,L.ankle),drop:true,
  up:150,down:110,hysteresis:8,minRangeDeg:45,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, phone at hip height'},tips:['Put the laptop at table height and stand back until your head and hips show.','Face the camera or turn side-on, whichever is easier.','Stand still for a moment first, then squat.','Even, bright light helps.'],experimental:true},
 pushup:{id:'pushup',title:'Push-ups',template:'camera_pushup',kcalPerRep:.32,joints:[[11,13,15],[12,14,16]],cues:['Arms straight','Lower your chest','Push up'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip,L.ankle),
  up:150,down:100,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Floor push-ups, side-on to the camera.','Keep your whole body in frame, head to feet.'],experimental:true,
  suitable:(p,s)=>{const shoulder=p[L.shoulder[s]],ankle=p[L.ankle[s]];return Math.abs(shoulder.x-ankle.x)>Math.abs(shoulder.y-ankle.y)*1.3;}},
 curl:{id:'curl',title:'Bicep curls',template:'camera_curl',kcalPerRep:.18,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:['Arm straight','Curl up','Lower your arm'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:70,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, phone at chest height'},tips:['Face the camera or stand side-on; one arm is tracked per set.','Keep shoulder, elbow, wrist and hip in frame.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y&&Math.abs(p[L.shoulder[s]].x-p[L.elbow[s]].x)<.25},
 press:{id:'press',title:'Shoulder press',template:'camera_press',kcalPerRep:.28,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:['Arm overhead','Lower your arm','Press up'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:155,down:100,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, phone at chest height'},tips:['Stand or sit facing the camera or side-on; one arm is tracked per set.','Start with your arm pressed overhead, then lower and press.','Leave room above your hand so it stays in frame.','Keep shoulder, elbow, wrist and hip in frame.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y&&p[L.wrist[s]].y<p[L.elbow[s]].y+.02},
 situp:{id:'situp',title:'Sit-ups',template:'camera_situp',kcalPerRep:.25,joints:[[11,23,25],[12,24,26]],cues:['Lie back','Curl up','Lie back'],required:pick(L.shoulder,L.hip,L.knee),
  up:135,down:80,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie side-on to the camera with your knees bent.','Start lying back, then curl up.','Keep shoulders, hips and knees in frame.'],experimental:true,
  suitable:(p,s)=>Math.abs(p[L.hip[s]].x-p[L.ankle[s]].x)>Math.abs(p[L.hip[s]].y-p[L.ankle[s]].y)*1.3},
 wallpush:{id:'wallpush',title:'Wall push-ups',template:'camera_wallpush',kcalPerRep:.12,joints:[[11,13,15],[12,14,16]],cues:['Arms straight','Lean into the wall','Push back'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:115,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, phone at chest height'},tips:['Stand side-on to the camera, hands on a stable wall.','Keep shoulder, elbow, wrist and hip in frame.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
};
/** Harder levels ask for a fuller range of motion: a straighter top and a deeper bottom. Beginner is the base config. */
export const EXERCISE_LEVELS:Record<ExerciseLevel,{title:string;up:number;down:number}>={beginner:{title:'Beginner',up:0,down:0},intermediate:{title:'Intermediate',up:5,down:10},advanced:{title:'Advanced',up:10,down:20}};
export const withLevel=(config:ExerciseConfig,level:ExerciseLevel):ExerciseConfig=>({...config,up:config.up+EXERCISE_LEVELS[level].up,down:config.down-EXERCISE_LEVELS[level].down});
/** Why a movement cycle was not counted, and what to tell the person. */
export const REJECTION_TIPS={
 too_shallow:'Not counted: go a little deeper if it feels comfortable.',
 too_fast:'Not counted: that was very quick. Try a steadier pace.',
 too_slow:'Not counted: that rep took a long time. Pausing mid-rep is fine; start the next one from the top.',
 lost_tracking:'Not counted: you left the frame or were hidden during that rep.',
} as const;
export type RejectionReason=keyof typeof REJECTION_TIPS;

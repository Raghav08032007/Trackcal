import type {ExerciseKind,ExerciseLevel,Landmark} from './types';
import {EXERCISE_FORMS,type ExerciseForm} from './exercise-forms';
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
 /** The move starts low and rises, like an arm raise: the angle is flipped so the rep runs the same way as a squat. */
 invert?:boolean;
 /** Either side can do the rep, so alternating legs all count. */
 either?:boolean;
 /** [left, right] landmarks that must be visible for the side to be tracked. */
 required:[number[],number[]];
 up:number;down:number;hysteresis:number;
 minRangeDeg:number;minRepMs:number;maxRepMs:number;minDwellMs:number;minVisibility:number;
 /** One-Euro filter on the angle: lower minCutoff smooths more, higher beta reacts faster to quick moves. */
 smoothing:{minCutoff:number;beta:number};
 camera:{view:'side';distance:string};tips:string[];experimental:boolean;
 /** How this exercise differs from every other one, so a different movement is never counted. */
 form?:ExerciseForm;
 /** Optional pose check (aspect-corrected points), e.g. a push-up body must be roughly horizontal. */
 suitable?:(p:Landmark[],side:0|1)=>boolean;
};
const L={shoulder:[11,12],elbow:[13,14],wrist:[15,16],hip:[23,24],knee:[25,26],ankle:[27,28],toe:[31,32]};
/** The body lies along the floor rather than standing up. Judged on the torso for floor moves: a lifted leg must not fail it. */
const flat=(end:number[])=>(p:Landmark[],s:0|1)=>Math.abs(p[L.shoulder[s]].x-p[end[s]].x)>Math.abs(p[L.shoulder[s]].y-p[end[s]].y)*.9;
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
 lunge:{id:'lunge',title:'Lunges',template:'camera_lunge',kcalPerRep:.45,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],cues:['Stand tall','Step and lower','Stand back up'],required:pick(L.shoulder),optional:pick(L.hip,L.knee,L.ankle),drop:true,
  up:150,down:115,hysteresis:8,minRangeDeg:30,minRepMs:700,maxRepMs:20000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera or stand side-on.','Keep your shoulders and hips in frame.','Step, lower, then stand tall before the next one.'],experimental:true},
 jack:{id:'jack',title:'Jumping jacks',template:'camera_jack',kcalPerRep:.2,joints:[[23,11,13],[24,12,14]],invert:true,cues:['Arms by your sides','Jump and reach up','Back down'],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:75,hysteresis:8,minRangeDeg:50,minRepMs:350,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera.','Leave room above your head.','Bring your arms fully down each time.'],experimental:true},
 raise:{id:'raise',title:'Side arm raises',template:'camera_raise',kcalPerRep:.12,joints:[[23,11,13],[24,12,14]],invert:true,cues:['Arms by your sides','Raise to shoulder height','Lower your arms'],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:105,hysteresis:8,minRangeDeg:35,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Face the camera.','Raise your arms out to the sides, up to shoulder height.','Keep shoulders, elbows and hips in frame.'],experimental:true},
 knee:{id:'knee',title:'Knee raises',template:'camera_knee',kcalPerRep:.15,joints:[[11,23,25],[12,24,26]],span:[[23,25],[24,26]],either:true,cues:['Stand tall','Lift one knee','Lower your foot'],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:110,hysteresis:8,minRangeDeg:30,minRepMs:400,maxRepMs:10000,minDwellMs:60,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera or stand side-on.','Lift one knee at a time; either leg counts.','Keep your hips and knees in frame.'],experimental:true},
 sumo:{id:'sumo',title:'Sumo squats',template:'camera_sumo',kcalPerRep:0.4,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:['Stand with feet wide','Squat down','Stand up'],required:pick(L.shoulder),
  up:150,down:110,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera with your feet wide.','Keep your head and hips in frame.'],experimental:true},
 bridge:{id:'bridge',title:'Glute bridges',template:'camera_bridge',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],invert:true,cues:['Lie back, knees bent','Lift your hips','Lower your hips'],required:pick(L.shoulder,L.hip,L.knee),
  up:42,down:18,hysteresis:8,minRangeDeg:20,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie side-on to the camera with your knees bent.','Keep shoulders, hips and knees in frame.'],experimental:true,
  suitable:flat(L.hip)},
 calf:{id:'calf',title:'Calf raises',template:'camera_calf',kcalPerRep:0.1,joints:[[25,27,31],[26,28,32]],invert:true,cues:['Stand tall','Rise onto your toes','Lower your heels'],required:pick(L.hip,L.knee,L.ankle,L.toe),
  up:62,down:50,hysteresis:4,minRangeDeg:10,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Stand side-on, with your feet clearly in frame.','Rise slowly: this is a small movement.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 sideleg:{id:'sideleg',title:'Side leg raises',template:'camera_sideleg',kcalPerRep:0.15,joints:[[24,23,25],[23,24,26]],either:true,invert:true,cues:['Stand tall','Lift one leg sideways','Lower your leg'],required:pick(L.shoulder,L.hip,L.knee),
  up:72,down:55,hysteresis:4,minRangeDeg:12,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera, near a wall for balance.','Either leg counts.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 donkey:{id:'donkey',title:'Donkey kicks',template:'camera_donkey',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],either:true,invert:true,cues:['On hands and knees','Kick one leg back','Bring your knee in'],required:pick(L.shoulder,L.hip,L.knee),
  up:70,down:35,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Hands and knees, side-on to the camera.','Either leg counts.'],experimental:true,
  suitable:flat(L.hip)},
 incline:{id:'incline',title:'Incline push-ups',template:'camera_incline',kcalPerRep:0.2,joints:[[11,13,15],[12,14,16]],cues:['Arms straight','Lower your chest','Push up'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:110,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Hands on a sturdy table or bench, side-on to the camera.','Keep shoulder, elbow, wrist and hip in frame.'],experimental:true},
 kneepush:{id:'kneepush',title:'Knee push-ups',template:'camera_kneepush',kcalPerRep:0.22,joints:[[11,13,15],[12,14,16]],cues:['Arms straight','Lower your chest','Push up'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip,L.knee),
  up:150,down:100,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Knees on the floor, side-on to the camera.','Keep your head to knees in frame.'],experimental:true,
  suitable:flat(L.hip)},
 row:{id:'row',title:'Bent-over rows',template:'camera_row',kcalPerRep:0.2,joints:[[11,13,15],[12,14,16]],cues:['Hinge forward, arm long','Pull your elbow back','Lower your arm'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:95,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Hinge at the hips, side-on to the camera.','A light weight or a full bottle works.'],experimental:true},
 superman:{id:'superman',title:'Superman lifts',template:'camera_superman',kcalPerRep:0.12,joints:[[11,23,25],[12,24,26]],cues:['Lie face down','Lift chest and legs','Lower down'],required:pick(L.shoulder,L.hip,L.knee),
  up:170,down:158,hysteresis:3,minRangeDeg:8,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie face down, side-on to the camera.','Lift gently and hold for a moment.'],experimental:true,
  suitable:flat(L.hip)},
 kickback:{id:'kickback',title:'Tricep kickbacks',template:'camera_kickback',kcalPerRep:0.12,joints:[[11,13,15],[12,14,16]],invert:true,cues:['Hinge forward, elbow bent','Straighten your arm','Bend your elbow'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:60,down:25,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Hinge forward, side-on to the camera.','Keep your upper arm still; one arm per set.'],experimental:true},
 overhead:{id:'overhead',title:'Overhead tricep extensions',template:'camera_overhead',kcalPerRep:0.15,joints:[[11,13,15],[12,14,16]],cues:['Arm straight overhead','Lower behind your head','Straighten your arm'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:90,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Stand side-on, with room above your hand.','Keep your elbow pointing up.'],experimental:true},
 hammer:{id:'hammer',title:'Hammer curls',template:'camera_hammer',kcalPerRep:0.18,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:['Arm straight','Curl up','Lower your arm'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:70,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Face the camera or stand side-on; one arm per set.','Counted the same way as a bicep curl.'],experimental:true},
 front:{id:'front',title:'Front raises',template:'camera_front',kcalPerRep:0.12,joints:[[23,11,13],[24,12,14]],invert:true,cues:['Arms by your sides','Raise to shoulder height','Lower your arms'],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:105,hysteresis:8,minRangeDeg:35,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Stand side-on to the camera.','Raise your arms forward to shoulder height.'],experimental:true},
 uprow:{id:'uprow',title:'Upright rows',template:'camera_uprow',kcalPerRep:0.15,joints:[[23,11,13],[24,12,14]],invert:true,cues:['Hands low','Pull elbows up and out','Lower your hands'],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:110,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Face the camera.','Lift your elbows out to the sides.'],experimental:true},
 crunch:{id:'crunch',title:'Crunches',template:'camera_crunch',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],cues:['Lie back, knees bent','Curl your shoulders up','Lie back'],required:pick(L.shoulder,L.hip,L.knee),
  up:125,down:108,hysteresis:4,minRangeDeg:12,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie side-on to the camera with your knees bent.','A small lift is enough.'],experimental:true,
  suitable:flat(L.hip)},
 legraise:{id:'legraise',title:'Leg raises',template:'camera_legraise',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],cues:['Lie flat, legs long','Lift your legs','Lower slowly'],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:115,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie side-on to the camera.','Bend your knees a little if your back lifts.'],experimental:true,
  suitable:flat(L.hip)},
 sidebend:{id:'sidebend',title:'Standing side bends',template:'camera_sidebend',kcalPerRep:0.08,joints:[[11,23,24],[12,24,23]],either:true,cues:['Stand tall','Lean to one side','Stand back up'],required:pick(L.shoulder,L.hip),
  up:88,down:72,hysteresis:4,minRangeDeg:12,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Face the camera.','Lean straight sideways; either side counts.'],experimental:true},
 highknee:{id:'highknee',title:'High knees',template:'camera_highknee',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],span:[[23,25],[24,26]],either:true,cues:['Stand tall','Drive one knee up','Switch legs'],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:110,hysteresis:8,minRangeDeg:30,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera or stand side-on.','Each knee lift counts.'],experimental:true},
 burpee:{id:'burpee',title:'Burpees',template:'camera_burpee',kcalPerRep:0.8,joints:[[23,25,27],[24,26,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:['Stand tall','Drop to the floor','Jump back up'],required:pick(L.shoulder),
  up:150,down:100,hysteresis:8,minRangeDeg:45,minRepMs:1200,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Stand far back so your whole body stays in frame on the floor.','Stand fully up between reps.'],experimental:true},
 climber:{id:'climber',title:'Mountain climbers',template:'camera_climber',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],either:true,cues:['Push-up position','Drive one knee in','Switch legs'],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:115,hysteresis:8,minRangeDeg:30,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Push-up position, side-on to the camera.','Each knee drive counts.'],experimental:true,
  suitable:flat(L.hip)},
 wsquat:{id:'wsquat',title:'Goblet or barbell squats',template:'camera_wsquat',kcalPerRep:0.5,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:['Hold the weight at your chest', 'Squat down', 'Stand up'],required:pick(L.shoulder),
  up:150,down:110,hysteresis:8,minRangeDeg:45,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Keep your hands near your chest or shoulders the whole time.'],experimental:true},
 ohsquat:{id:'ohsquat',title:'Overhead squats',template:'camera_ohsquat',kcalPerRep:0.5,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:['Arms overhead', 'Squat down', 'Stand up'],required:pick(L.shoulder),
  up:150,down:110,hysteresis:8,minRangeDeg:45,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Arms stay up for the whole rep.'],experimental:true},
 wlunge:{id:'wlunge',title:'Dumbbell lunges',template:'camera_wlunge',kcalPerRep:0.55,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:['Stand tall, weights down', 'Step and lower', 'Stand back up'],required:pick(L.shoulder),
  up:150,down:115,hysteresis:8,minRangeDeg:30,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Keep your hands down by your sides.', 'Step, lower, then stand tall before the next one.'],experimental:true},
 sidelunge:{id:'sidelunge',title:'Side lunges',template:'camera_sidelunge',kcalPerRep:0.45,joints:[[23,25,27],[24,26,28]],either:true,cues:['Stand tall', 'Step wide and bend one knee', 'Push back to centre'],required:pick(L.shoulder,L.hip,L.knee,L.ankle),
  up:150,down:115,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Face the camera and step out to one side.', 'Keep your feet in frame.'],experimental:true},
 squatjump:{id:'squatjump',title:'Jump squats',template:'camera_squatjump',kcalPerRep:0.6,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:['Stand tall', 'Squat down', 'Jump up'],required:pick(L.shoulder),
  up:150,down:110,hysteresis:8,minRangeDeg:40,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Your feet must leave the floor for it to count.'],experimental:true},
 buttkick:{id:'buttkick',title:'Butt kicks',template:'camera_buttkick',kcalPerRep:0.15,joints:[[23,25,27],[24,26,28]],either:true,cues:['Stand tall', 'Kick one heel up', 'Switch legs'],required:pick(L.hip,L.knee,L.ankle),
  up:150,down:90,hysteresis:8,minRangeDeg:45,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Keep your knee pointing down.', 'Side-on works best.'],experimental:true},
 deadlift:{id:'deadlift',title:'Deadlifts',template:'camera_deadlift',kcalPerRep:0.5,joints:[[11,23,25],[12,24,26]],cues:['Stand tall', 'Hinge and lower the weight', 'Stand up'],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:120,hysteresis:8,minRangeDeg:30,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Stand side-on.', 'Bend your knees a little and hinge at the hips.'],experimental:true},
 rdl:{id:'rdl',title:'Romanian deadlifts',template:'camera_rdl',kcalPerRep:0.45,joints:[[11,23,25],[12,24,26]],cues:['Stand tall', 'Push your hips back', 'Stand up'],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:120,hysteresis:8,minRangeDeg:30,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Keep your knees almost straight.'],experimental:true},
 goodmorning:{id:'goodmorning',title:'Good mornings',template:'camera_goodmorning',kcalPerRep:0.3,joints:[[11,23,25],[12,24,26]],cues:['Weight on your shoulders', 'Hinge forward', 'Stand up'],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:120,hysteresis:8,minRangeDeg:30,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Keep your hands at your shoulders.'],experimental:true},
 wcalf:{id:'wcalf',title:'Dumbbell calf raises',template:'camera_wcalf',kcalPerRep:0.14,joints:[[25,27,31],[26,28,32]],invert:true,cues:['Stand tall', 'Rise onto your toes', 'Lower your heels'],required:pick(L.hip,L.knee,L.ankle,L.toe),
  up:62,down:50,hysteresis:4,minRangeDeg:10,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Rise slowly: this is a small movement.'],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 hipthrust:{id:'hipthrust',title:'Weighted hip thrusts',template:'camera_hipthrust',kcalPerRep:0.3,joints:[[11,23,25],[12,24,26]],invert:true,cues:['Weight on your hips', 'Lift your hips', 'Lower your hips'],required:pick(L.shoulder,L.hip,L.knee),
  up:42,down:18,hysteresis:8,minRangeDeg:20,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie side-on to the camera.'],experimental:true,
  suitable:flat(L.hip)},
 bench:{id:'bench',title:'Bench press',template:'camera_bench',kcalPerRep:0.4,joints:[[11,13,15],[12,14,16]],cues:['Arms straight up', 'Lower to your chest', 'Press up'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:95,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Lie side-on to the camera.', 'Hands stay above your chest.'],experimental:true,
  suitable:flat(L.hip)},
 skull:{id:'skull',title:'Skull crushers',template:'camera_skull',kcalPerRep:0.2,joints:[[11,13,15],[12,14,16]],cues:['Arms straight up', 'Bend at the elbows only', 'Straighten your arms'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:85,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Keep your elbows where they are.'],experimental:true,
  suitable:flat(L.hip)},
 revfly:{id:'revfly',title:'Bent-over reverse flyes',template:'camera_revfly',kcalPerRep:0.15,joints:[[23,11,13],[24,12,14]],invert:true,cues:['Hinge forward, arms long', 'Lift your arms out', 'Lower your arms'],required:pick(L.shoulder,L.elbow,L.hip),
  up:75,down:45,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Keep your arms nearly straight.'],experimental:true},
 seatrow:{id:'seatrow',title:'Seated rows',template:'camera_seatrow',kcalPerRep:0.22,joints:[[11,13,15],[12,14,16]],cues:['Sit tall, arms long', 'Pull to your waist', 'Reach forward'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:95,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Sit side-on to the camera.', 'Pull to your waist, not your shoulder.'],experimental:true},
 conccurl:{id:'conccurl',title:'Concentration curls',template:'camera_conccurl',kcalPerRep:0.15,joints:[[11,13,15],[12,14,16]],cues:['Sit, arm long', 'Curl up', 'Lower your arm'],required:pick(L.shoulder,L.elbow,L.wrist),
  up:145,down:70,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Stay seated and lean forward a little.'],experimental:true},
 thruster:{id:'thruster',title:'Thrusters',template:'camera_thruster',kcalPerRep:0.7,joints:[[11,13,15],[12,14,16]],cues:['Press overhead', 'Squat with weights at your shoulders', 'Stand and press'],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:95,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Squat as you lower the weight, then press as you stand.'],experimental:true},
 pikepush:{id:'pikepush',title:'Pike push-ups',template:'camera_pikepush',kcalPerRep:0.28,joints:[[11,13,15],[12,14,16]],cues:['Hips high, arms straight', 'Lower your head', 'Push up'],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:100,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Keep your hips above your shoulders.'],experimental:true},
 dip:{id:'dip',title:'Chair dips',template:'camera_dip',kcalPerRep:0.25,joints:[[11,13,15],[12,14,16]],cues:['Arms straight', 'Lower your hips', 'Push up'],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:105,hysteresis:8,minRangeDeg:35,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'1.5–2 m away, laptop at chest height'},tips:['Keep your hands on the chair.', 'Side-on works best.'],experimental:true},
 pullup:{id:'pullup',title:'Pull-ups',template:'camera_pullup',kcalPerRep:0.8,joints:[[11,13,15],[12,14,16]],cues:['Hang with arms straight', 'Pull up', 'Lower down'],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:95,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Your hands stay on the bar, your body moves.'],experimental:true},
 birddog:{id:'birddog',title:'Bird dogs',template:'camera_birddog',kcalPerRep:0.1,joints:[[11,23,25],[12,24,26]],either:true,invert:true,cues:['On hands and knees', 'Reach arm and leg out', 'Bring them back'],required:pick(L.shoulder,L.hip,L.knee),
  up:70,down:35,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Your hand must reach forward as your leg goes back.'],experimental:true,
  suitable:flat(L.hip)},
 flutter:{id:'flutter',title:'Flutter kicks',template:'camera_flutter',kcalPerRep:0.1,joints:[[11,23,25],[12,24,26]],either:true,cues:['Lie flat, legs long', 'Kick one leg up', 'Switch legs'],required:pick(L.shoulder,L.hip,L.knee),
  up:168,down:150,hysteresis:4,minRangeDeg:12,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Small, quick kicks.'],experimental:true,
  suitable:flat(L.hip)},
 bicycle:{id:'bicycle',title:'Bicycle crunches',template:'camera_bicycle',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],either:true,cues:['Lie back, legs long', 'Drive one knee in', 'Switch legs'],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:105,hysteresis:8,minRangeDeg:30,minRepMs:350,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Bend the knee fully towards your chest.'],experimental:true,
  suitable:flat(L.hip)},
 revcrunch:{id:'revcrunch',title:'Reverse crunches',template:'camera_revcrunch',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],cues:['Lie back, knees bent', 'Pull your knees to your chest', 'Lower your feet'],required:pick(L.shoulder,L.hip,L.knee),
  up:125,down:85,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Your shoulders stay on the floor.'],experimental:true,
  suitable:flat(L.hip)},
 vup:{id:'vup',title:'V-ups',template:'camera_vup',kcalPerRep:0.3,joints:[[11,23,25],[12,24,26]],cues:['Lie flat', 'Lift chest and legs', 'Lie back'],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:95,hysteresis:8,minRangeDeg:40,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2 m away, phone on the floor'},tips:['Chest and legs lift at the same time.'],experimental:true},
 punch:{id:'punch',title:'Shadow boxing punches',template:'camera_punch',kcalPerRep:0.08,joints:[[11,13,15],[12,14,16]],either:true,invert:true,cues:['Fists up', 'Punch forward', 'Bring it back'],required:pick(L.shoulder,L.elbow,L.wrist),
  up:105,down:40,hysteresis:8,minRangeDeg:35,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:'2–3 m away, laptop at table height'},tips:['Punch at shoulder height, then bring your fist back.', 'Side-on shows the punch best.'],experimental:true},
};
for(const [id,form] of Object.entries(EXERCISE_FORMS))EXERCISE_CONFIG[id as ExerciseKind].form=form;
/** Harder levels ask for a fuller range of motion: a straighter top and a deeper bottom. Beginner is the base config. */
export const EXERCISE_LEVELS:Record<ExerciseLevel,{title:string;up:number;down:number}>={beginner:{title:'Beginner',up:0,down:0},intermediate:{title:'Intermediate',up:5,down:10},advanced:{title:'Advanced',up:10,down:20}};
export const withLevel=(config:ExerciseConfig,level:ExerciseLevel):ExerciseConfig=>({...config,up:Math.min(176,config.up+EXERCISE_LEVELS[level].up),down:Math.max(config.down*.6,config.down-EXERCISE_LEVELS[level].down)});  // small movements keep a reachable target
/** Why a movement cycle was not counted, and what to tell the person. */
export const REJECTION_TIPS={
 too_shallow:'Not counted: go a little deeper if it feels comfortable.',
 too_fast:'Not counted: that was very quick. Try a steadier pace.',
 too_slow:'Not counted: that rep took a long time. Pausing mid-rep is fine; start the next one from the top.',
 lost_tracking:'Not counted: you left the frame or were hidden during that rep.',
 wrong_exercise:'Not counted: that looks like a different exercise from the one you picked.',
} as const;
export type RejectionReason=keyof typeof REJECTION_TIPS;

import { localized, localizedMap, msg } from "../i18n";
import {EXERCISES,EXERCISE_VARIANTS,type ExerciseKind,type ExerciseLevel,type Landmark} from './types';
import {EXERCISE_FORMS,type ExerciseForm} from './exercise-forms';
import {MOVES} from './exercise-motions';
/** Every threshold the rep counter uses lives here, one typed config per exercise. Angles are degrees at the middle
 *  joint of the triplet; "up" is the starting position (straight joint), "down" the bent position.
 *  experimental: shown in the UI until the manual device matrix (docs/TEST_REPORT_P3.md) meets the accuracy target. */
export type ExerciseConfig={
 id:ExerciseKind;title:string;template:string;
 /** The joint and its limb span measure the same straightening arm (push-ups): near straight, trust the larger reading. */
 straightens?:boolean;
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
 /** Points that, when confidently tracked, must be inside the frame: a body cut off at the edge is asked to step back. */
 inFrame?:[number[],number[]];
 /** Also read depth from how far the shoulders drop, which needs no legs in frame. */
 drop?:boolean;
 /** Count how far the whole body rises above its standing level instead of a joint angle (calf raises). */
 rise?:boolean;
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
 /** The plane the body moves in: side for forward and back, front for out to the sides. */
 plane?:'side'|'front';
 /** Counts from both camera angles. False means only from the plane's own angle: from the other one the movement is hidden. */
 bothAngles?:boolean;
 /** Optional pose check (aspect-corrected points), e.g. a push-up body must be roughly horizontal. */
 suitable?:(p:Landmark[],side:0|1)=>boolean;
};
const L={shoulder:[11,12],elbow:[13,14],wrist:[15,16],hip:[23,24],knee:[25,26],ankle:[27,28],toe:[31,32]};
/** The body lies along the floor rather than standing up. Judged on the torso for floor moves: a lifted leg must not fail it. */
const flat=(end:number[])=>(p:Landmark[],s:0|1)=>Math.abs(p[L.shoulder[s]].x-p[end[s]].x)>Math.abs(p[L.shoulder[s]].y-p[end[s]].y)*.9;
/** A push-up seen side-on (body along the floor) or head-on (shoulders wide, hands below them). Null when it's neither. */
export function pushupView(p:Landmark[],s:0|1):'side'|'front'|null{
 const shoulder=p[L.shoulder[s]],ankle=p[L.ankle[s]],width=Math.abs(p[11].x-p[12].x),handsLow=p[15].y>p[11].y-.02&&p[16].y>p[12].y-.02;
 if((ankle?.visibility??0)>=.5&&Math.abs(shoulder.x-ankle.x)>Math.abs(shoulder.y-ankle.y)*1.3)return 'side';
 return handsLow&&width>.08&&width>.35*Math.abs(p[11].y-p[15].y)?'front':null;
}
const pick=(...parts:number[][])=>[parts.map(p=>p[0]),parts.map(p=>p[1])] as [number[],number[]];
export const EXERCISE_CONFIG={
 squat:{id:'squat',title:msg("Squats"),template:'camera_squat',kcalPerRep:.4,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],cues:[msg("Stand tall"),msg("Squat down"),msg("Stand up")],required:pick(L.shoulder),optional:pick(L.hip,L.knee,L.ankle),drop:true,
  up:150,down:137,hysteresis:8,minRangeDeg:26,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},  // a half squat (knees about 130) counts
  camera:{view:'side',distance:msg("2–3 m away, phone at hip height")},tips:[msg("Put the laptop at table height and stand back until your head and hips show."),msg("Face the camera or turn side-on, whichever is easier."),msg("Stand still for a moment first, then squat."),msg("Even, bright light helps.")],experimental:true},
 pushup:{id:'pushup',straightens:true,title:msg("Push-ups"),template:'camera_pushup',kcalPerRep:.32,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight"),msg("Lower your chest"),msg("Push up")],required:pick(L.shoulder,L.elbow,L.wrist),inFrame:pick(L.hip,L.ankle),
  up:150,down:110,hysteresis:8,minRangeDeg:35,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, phone on the floor")},tips:[msg("Side-on or facing the camera, whichever fits your room."),msg("Facing it: put the phone on the floor in front of your head and keep your shoulders and hands in view."),msg("Side-on: keep your whole body in frame.")],experimental:true,
  suitable:(p,s)=>pushupView(p,s)!==null},
 curl:{id:'curl',title:msg("Bicep curls"),template:'camera_curl',kcalPerRep:.18,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arm straight"),msg("Curl up"),msg("Lower your arm")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:96,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, phone at chest height")},tips:[msg("Face the camera or stand side-on; one arm is tracked per set."),msg("Keep shoulder, elbow, wrist and hip in frame.")],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y&&Math.abs(p[L.shoulder[s]].x-p[L.elbow[s]].x)<.25},
 press:{id:'press',title:msg("Shoulder press"),template:'camera_press',kcalPerRep:.28,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arm overhead"),msg("Lower your arm"),msg("Press up")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:149,down:100,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, phone at chest height")},tips:[msg("Stand or sit facing the camera or side-on; one arm is tracked per set."),msg("Start with your arm pressed overhead, then lower and press."),msg("Leave room above your hand so it stays in frame."),msg("Keep shoulder, elbow, wrist and hip in frame.")],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y&&p[L.wrist[s]].y<p[L.elbow[s]].y+.02},
 situp:{id:'situp',title:msg("Sit-ups"),template:'camera_situp',kcalPerRep:.25,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Lie back"),msg("Curl up"),msg("Lie back")],required:pick(L.shoulder,L.hip,L.knee),
  up:135,down:91,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie side-on to the camera with your knees bent."),msg("Start lying back, then curl up."),msg("Keep shoulders, hips and knees in frame.")],experimental:true,
  suitable:(p,s)=>Math.abs(p[L.hip[s]].x-p[L.ankle[s]].x)>Math.abs(p[L.hip[s]].y-p[L.ankle[s]].y)*1.3},
 wallpush:{id:'wallpush',straightens:true,title:msg("Wall push-ups"),template:'camera_wallpush',kcalPerRep:.12,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight"),msg("Lean into the wall"),msg("Push back")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:123,hysteresis:8,minRangeDeg:27,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, phone at chest height")},tips:[msg("Stand side-on to the camera, hands on a stable wall."),msg("Keep shoulder, elbow, wrist and hip in frame.")],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 lunge:{id:'lunge',title:msg("Lunges"),template:'camera_lunge',kcalPerRep:.45,either:true,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],cues:[msg("Stand tall"),msg("Step and lower"),msg("Stand back up")],required:pick(L.shoulder),optional:pick(L.hip,L.knee,L.ankle),drop:true,
  up:150,down:133,hysteresis:8,minRangeDeg:24,minRepMs:700,maxRepMs:20000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera or stand side-on."),msg("Keep your shoulders and hips in frame."),msg("Step, lower, then stand tall before the next one.")],experimental:true},
 jack:{id:'jack',title:msg("Jumping jacks"),template:'camera_jack',kcalPerRep:.2,joints:[[23,11,13],[24,12,14]],invert:true,cues:[msg("Arms by your sides"),msg("Jump and reach up"),msg("Back down")],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:77,hysteresis:8,minRangeDeg:50,minRepMs:350,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera."),msg("Leave room above your head."),msg("Bring your arms fully down each time.")],experimental:true},
 raise:{id:'raise',title:msg("Side arm raises"),template:'camera_raise',kcalPerRep:.12,joints:[[23,11,13],[24,12,14]],invert:true,cues:[msg("Arms by your sides"),msg("Raise to shoulder height"),msg("Lower your arms")],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:122,hysteresis:8,minRangeDeg:33,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Face the camera."),msg("Raise your arms out to the sides, up to shoulder height."),msg("Keep shoulders, elbows and hips in frame.")],experimental:true},
 knee:{id:'knee',title:msg("Knee raises"),template:'camera_knee',kcalPerRep:.15,joints:[[11,23,25],[12,24,26]],span:[[23,25],[24,26]],either:true,cues:[msg("Stand tall"),msg("Lift one knee"),msg("Lower your foot")],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:122,hysteresis:8,minRangeDeg:28,minRepMs:400,maxRepMs:10000,minDwellMs:60,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera or stand side-on."),msg("Lift one knee at a time; either leg counts."),msg("Keep your hips and knees in frame.")],experimental:true},
 sumo:{id:'sumo',title:msg("Sumo squats"),template:'camera_sumo',kcalPerRep:0.4,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Stand with feet wide"),msg("Squat down"),msg("Stand up")],required:pick(L.shoulder),
  up:150,down:121,hysteresis:8,minRangeDeg:34,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera with your feet wide."),msg("Keep your head and hips in frame.")],experimental:true},
 bridge:{id:'bridge',title:msg("Glute bridges"),template:'camera_bridge',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],invert:true,cues:[msg("Lie back, knees bent"),msg("Lift your hips"),msg("Lower your hips")],required:pick(L.shoulder,L.hip,L.knee),
  up:42,down:28,hysteresis:8,minRangeDeg:20,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie side-on to the camera with your knees bent."),msg("Keep shoulders, hips and knees in frame.")],experimental:true,
  suitable:flat(L.hip)},
 calf:{id:'calf',title:msg("Calf raises"),template:'camera_calf',kcalPerRep:0.1,joints:[[25,27,31],[26,28,32]],rise:true,cues:[msg("Stand tall"),msg("Rise onto your toes"),msg("Lower your heels")],required:pick(L.shoulder,L.hip,L.ankle),
  up:174,down:166,hysteresis:3,minRangeDeg:8,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stand side-on or facing the camera, with your feet in frame."),msg("Rise slowly onto your toes and pause for a moment at the top.")],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 sideleg:{id:'sideleg',title:msg("Side leg raises"),template:'camera_sideleg',kcalPerRep:0.15,joints:[[24,23,25],[23,24,26]],either:true,invert:true,cues:[msg("Stand tall"),msg("Lift one leg sideways"),msg("Lower your leg")],required:pick(L.shoulder,L.hip,L.knee),
  up:72,down:58,hysteresis:4,minRangeDeg:12,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera, near a wall for balance."),msg("Either leg counts.")],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 donkey:{id:'donkey',title:msg("Donkey kicks"),template:'camera_donkey',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],either:true,invert:true,cues:[msg("On hands and knees"),msg("Kick one leg back"),msg("Bring your knee in")],required:pick(L.shoulder,L.hip,L.knee),
  up:70,down:55,hysteresis:8,minRangeDeg:20,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Hands and knees, side-on to the camera."),msg("Either leg counts.")],experimental:true,
  suitable:flat(L.hip)},
 incline:{id:'incline',straightens:true,title:msg("Incline push-ups"),template:'camera_incline',kcalPerRep:0.2,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight"),msg("Lower your chest"),msg("Push up")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:110,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Hands on a sturdy table or bench, side-on to the camera."),msg("Keep shoulder, elbow, wrist and hip in frame.")],experimental:true},
 kneepush:{id:'kneepush',straightens:true,title:msg("Knee push-ups"),template:'camera_kneepush',kcalPerRep:0.22,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight"),msg("Lower your chest"),msg("Push up")],required:pick(L.shoulder,L.elbow,L.wrist),inFrame:pick(L.hip,L.knee),
  up:150,down:109,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Knees on the floor, side-on to the camera."),msg("Keep your head to knees in frame.")],experimental:true,
  suitable:(p,s)=>flat(L.hip)(p,s)||pushupView(p,s)==='front'},
 row:{id:'row',title:msg("Bent-over rows"),template:'camera_row',kcalPerRep:0.2,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Hinge forward, arm long"),msg("Pull your elbow back"),msg("Lower your arm")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:113,hysteresis:8,minRangeDeg:32,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Hinge at the hips, side-on to the camera."),msg("A light weight or a full bottle works.")],experimental:true},
 superman:{id:'superman',title:msg("Superman lifts"),template:'camera_superman',kcalPerRep:0.12,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Lie face down"),msg("Lift chest and legs"),msg("Lower down")],required:pick(L.shoulder,L.hip,L.knee),
  up:171,down:164,hysteresis:3,minRangeDeg:8,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie face down, side-on to the camera."),msg("Lift gently and hold for a moment.")],experimental:true,
  suitable:flat(L.hip)},
 kickback:{id:'kickback',title:msg("Tricep kickbacks"),template:'camera_kickback',kcalPerRep:0.12,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],invert:true,cues:[msg("Hinge forward, elbow bent"),msg("Straighten your arm"),msg("Bend your elbow")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:60,down:46,hysteresis:8,minRangeDeg:21,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Hinge forward, side-on to the camera."),msg("Keep your upper arm still; one arm per set.")],experimental:true},
 overhead:{id:'overhead',title:msg("Overhead tricep extensions"),template:'camera_overhead',kcalPerRep:0.15,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arm straight overhead"),msg("Lower behind your head"),msg("Straighten your arm")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:119,hysteresis:8,minRangeDeg:31,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stand side-on, with room above your hand."),msg("Keep your elbow pointing up.")],experimental:true},
 hammer:{id:'hammer',title:msg("Hammer curls"),template:'camera_hammer',kcalPerRep:0.18,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arm straight"),msg("Curl up"),msg("Lower your arm")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:83,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Face the camera or stand side-on; one arm per set."),msg("Counted the same way as a bicep curl.")],experimental:true},
 front:{id:'front',title:msg("Front raises"),template:'camera_front',kcalPerRep:0.12,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Arms by your sides"),msg("Raise to shoulder height"),msg("Lower your arms")],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:119,hysteresis:8,minRangeDeg:26,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stand side-on to the camera."),msg("Raise your arms forward to shoulder height.")],experimental:true},
 uprow:{id:'uprow',title:msg("Upright rows"),template:'camera_uprow',kcalPerRep:0.15,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Hands low"),msg("Pull elbows up and out"),msg("Lower your hands")],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:116,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Face the camera."),msg("Lift your elbows out to the sides.")],experimental:true},
 crunch:{id:'crunch',title:msg("Crunches"),template:'camera_crunch',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Lie back, knees bent"),msg("Curl your shoulders up"),msg("Lie back")],required:pick(L.shoulder,L.hip,L.knee),
  up:125,down:111,hysteresis:4,minRangeDeg:12,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie side-on to the camera with your knees bent."),msg("A small lift is enough.")],experimental:true,
  suitable:flat(L.hip)},
 legraise:{id:'legraise',title:msg("Leg raises"),template:'camera_legraise',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Lie flat, legs long"),msg("Lift your legs"),msg("Lower slowly")],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:136,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie side-on to the camera."),msg("Bend your knees a little if your back lifts.")],experimental:true,
  suitable:flat(L.hip)},
 sidebend:{id:'sidebend',title:msg("Standing side bends"),template:'camera_sidebend',kcalPerRep:0.08,joints:[[11,23,24],[12,24,23]],either:true,cues:[msg("Stand tall"),msg("Lean to one side"),msg("Stand back up")],required:pick(L.shoulder,L.hip),
  up:88,down:80,hysteresis:3,minRangeDeg:10,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Face the camera."),msg("Lean straight sideways; either side counts.")],experimental:true},
 highknee:{id:'highknee',title:msg("High knees"),template:'camera_highknee',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],span:[[23,25],[24,26]],either:true,cues:[msg("Stand tall"),msg("Drive one knee up"),msg("Switch legs")],required:pick(L.shoulder,L.hip,L.knee),
  up:148,down:123,hysteresis:8,minRangeDeg:25,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera or stand side-on."),msg("Each knee lift counts.")],experimental:true},
 burpee:{id:'burpee',title:msg("Burpees"),template:'camera_burpee',kcalPerRep:0.8,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Stand tall"),msg("Drop to the floor"),msg("Jump back up")],required:pick(L.shoulder),
  up:150,down:120,hysteresis:8,minRangeDeg:37,minRepMs:950,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Stand far back so your whole body stays in frame on the floor."),msg("Stand fully up between reps.")],experimental:true},
 climber:{id:'climber',title:msg("Mountain climbers"),template:'camera_climber',kcalPerRep:0.2,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],either:true,cues:[msg("Push-up position"),msg("Drive one knee in"),msg("Switch legs")],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:115,hysteresis:8,minRangeDeg:30,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Push-up position, side-on to the camera."),msg("Each knee drive counts.")],experimental:true,
  suitable:flat(L.hip)},
 wsquat:{id:'wsquat',title:msg("Goblet or barbell squats"),template:'camera_wsquat',kcalPerRep:0.5,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Hold the weight at your chest"), msg("Squat down"), msg("Stand up")],required:pick(L.shoulder),
  up:150,down:121,hysteresis:8,minRangeDeg:39,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Keep your hands near your chest or shoulders the whole time.")],experimental:true},
 ohsquat:{id:'ohsquat',title:msg("Overhead squats"),template:'camera_ohsquat',kcalPerRep:0.5,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Arms overhead"), msg("Squat down"), msg("Stand up")],required:pick(L.shoulder),
  up:150,down:120,hysteresis:8,minRangeDeg:38,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Arms stay up for the whole rep.")],experimental:true},
 wlunge:{id:'wlunge',title:msg("Dumbbell lunges"),template:'camera_wlunge',kcalPerRep:0.55,either:true,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Stand tall, weights down"), msg("Step and lower"), msg("Stand back up")],required:pick(L.shoulder),
  up:150,down:133,hysteresis:8,minRangeDeg:24,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Keep your hands down by your sides."), msg("Step, lower, then stand tall before the next one.")],experimental:true},
 sidelunge:{id:'sidelunge',title:msg("Side lunges"),template:'camera_sidelunge',kcalPerRep:0.45,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],either:true,cues:[msg("Stand tall"), msg("Step wide and bend one knee"), msg("Push back to centre")],required:pick(L.shoulder,L.hip,L.knee,L.ankle),
  up:150,down:130,hysteresis:8,minRangeDeg:20,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Face the camera and step out to one side."), msg("Keep your feet in frame.")],experimental:true},
 squatjump:{id:'squatjump',title:msg("Jump squats"),template:'camera_squatjump',kcalPerRep:0.6,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Stand tall"), msg("Squat down"), msg("Jump up")],required:pick(L.shoulder),
  up:150,down:123,hysteresis:8,minRangeDeg:37,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Your feet must leave the floor for it to count.")],experimental:true},
 buttkick:{id:'buttkick',title:msg("Butt kicks"),template:'camera_buttkick',kcalPerRep:0.15,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],either:true,cues:[msg("Stand tall"), msg("Kick one heel up"), msg("Switch legs")],required:pick(L.hip,L.knee,L.ankle),
  up:150,down:117,hysteresis:8,minRangeDeg:45,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Keep your knee pointing down."), msg("Side-on works best.")],experimental:true},
 deadlift:{id:'deadlift',title:msg("Deadlifts"),template:'camera_deadlift',kcalPerRep:0.5,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Stand tall"), msg("Hinge and lower the weight"), msg("Stand up")],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:127,hysteresis:8,minRangeDeg:28,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stand side-on."), msg("Bend your knees a little and hinge at the hips.")],experimental:true},
 rdl:{id:'rdl',title:msg("Romanian deadlifts"),template:'camera_rdl',kcalPerRep:0.45,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Stand tall"), msg("Push your hips back"), msg("Stand up")],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:137,hysteresis:8,minRangeDeg:18,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Keep your knees almost straight.")],experimental:true},
 goodmorning:{id:'goodmorning',title:msg("Good mornings"),template:'camera_goodmorning',kcalPerRep:0.3,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Weight on your shoulders"), msg("Hinge forward"), msg("Stand up")],required:pick(L.shoulder,L.hip,L.knee),
  up:155,down:137,hysteresis:8,minRangeDeg:18,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Keep your hands at your shoulders.")],experimental:true},
 wcalf:{id:'wcalf',title:msg("Dumbbell calf raises"),template:'camera_wcalf',kcalPerRep:0.14,joints:[[25,27,31],[26,28,32]],rise:true,cues:[msg("Stand tall"), msg("Rise onto your toes"), msg("Lower your heels")],required:pick(L.shoulder,L.hip,L.ankle),
  up:174,down:166,hysteresis:3,minRangeDeg:8,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stand side-on or facing the camera, with your feet in frame."),msg("Rise slowly: this is a small movement.")],experimental:true,
  suitable:(p,s)=>p[L.shoulder[s]].y<p[L.hip[s]].y},
 hipthrust:{id:'hipthrust',title:msg("Weighted hip thrusts"),template:'camera_hipthrust',kcalPerRep:0.3,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],invert:true,cues:[msg("Weight on your hips"), msg("Lift your hips"), msg("Lower your hips")],required:pick(L.shoulder,L.hip,L.knee),
  up:42,down:28,hysteresis:8,minRangeDeg:18,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie side-on to the camera.")],experimental:true,
  suitable:flat(L.hip)},
 bench:{id:'bench',title:msg("Bench press"),template:'camera_bench',kcalPerRep:0.4,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight up"), msg("Lower to your chest"), msg("Press up")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:119,hysteresis:8,minRangeDeg:31,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Lie side-on to the camera."), msg("Hands stay above your chest.")],experimental:true,
  suitable:flat(L.hip)},
 skull:{id:'skull',title:msg("Skull crushers"),template:'camera_skull',kcalPerRep:0.2,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight up"), msg("Bend at the elbows only"), msg("Straighten your arms")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:113,hysteresis:8,minRangeDeg:32,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your elbows where they are.")],experimental:true,
  suitable:flat(L.hip)},
 revfly:{id:'revfly',title:msg("Bent-over reverse flyes"),template:'camera_revfly',kcalPerRep:0.15,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Hinge forward, arms long"), msg("Lift your arms out"), msg("Lower your arms")],required:pick(L.shoulder,L.elbow,L.hip),
  up:75,down:61,hysteresis:8,minRangeDeg:18,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Keep your arms nearly straight.")],experimental:true},
 seatrow:{id:'seatrow',title:msg("Seated rows"),template:'camera_seatrow',kcalPerRep:0.22,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Sit tall, arms long"), msg("Pull to your waist"), msg("Reach forward")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:145,down:96,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Sit side-on to the camera."), msg("Pull to your waist, not your shoulder.")],experimental:true},
 conccurl:{id:'conccurl',title:msg("Concentration curls"),template:'camera_conccurl',kcalPerRep:0.15,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Sit, arm long"), msg("Curl up"), msg("Lower your arm")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:145,down:88,hysteresis:8,minRangeDeg:55,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stay seated and lean forward a little.")],experimental:true},
 thruster:{id:'thruster',title:msg("Thrusters"),template:'camera_thruster',kcalPerRep:0.7,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Press overhead"), msg("Squat with weights at your shoulders"), msg("Stand and press")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:95,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Squat as you lower the weight, then press as you stand.")],experimental:true},
 pikepush:{id:'pikepush',title:msg("Pike push-ups"),template:'camera_pikepush',kcalPerRep:0.28,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Hips high, arms straight"), msg("Lower your head"), msg("Push up")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:112,hysteresis:8,minRangeDeg:38,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your hips above your shoulders.")],experimental:true},
 dip:{id:'dip',title:msg("Chair dips"),template:'camera_dip',kcalPerRep:0.25,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Arms straight"), msg("Lower your hips"), msg("Push up")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:114,hysteresis:8,minRangeDeg:35,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Keep your hands on the chair."), msg("Side-on works best.")],experimental:true},
 pullup:{id:'pullup',title:msg("Pull-ups"),template:'camera_pullup',kcalPerRep:0.8,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Hang with arms straight"), msg("Pull up"), msg("Lower down")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:113,hysteresis:8,minRangeDeg:37,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Your hands stay on the bar, your body moves.")],experimental:true},
 birddog:{id:'birddog',title:msg("Bird dogs"),template:'camera_birddog',kcalPerRep:0.1,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],either:true,invert:true,cues:[msg("On hands and knees"), msg("Reach arm and leg out"), msg("Bring them back")],required:pick(L.shoulder,L.hip,L.knee),
  up:70,down:55,hysteresis:8,minRangeDeg:19,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Your hand must reach forward as your leg goes back.")],experimental:true,
  suitable:flat(L.hip)},
 flutter:{id:'flutter',title:msg("Flutter kicks"),template:'camera_flutter',kcalPerRep:0.1,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],either:true,cues:[msg("Lie flat, legs long"), msg("Kick one leg up"), msg("Switch legs")],required:pick(L.shoulder,L.hip,L.knee),
  up:163,down:150,hysteresis:4,minRangeDeg:12,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Small, quick kicks.")],experimental:true,
  suitable:flat(L.hip)},
 bicycle:{id:'bicycle',title:msg("Bicycle crunches"),template:'camera_bicycle',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],either:true,cues:[msg("Lie back, legs long"), msg("Drive one knee in"), msg("Switch legs")],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:131,hysteresis:8,minRangeDeg:27,minRepMs:350,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Bend the knee fully towards your chest.")],experimental:true,
  suitable:flat(L.hip)},
 revcrunch:{id:'revcrunch',title:msg("Reverse crunches"),template:'camera_revcrunch',kcalPerRep:0.15,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Lie back, knees bent"), msg("Pull your knees to your chest"), msg("Lower your feet")],required:pick(L.shoulder,L.hip,L.knee),
  up:125,down:100,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Your shoulders stay on the floor.")],experimental:true,
  suitable:flat(L.hip)},
 vup:{id:'vup',title:msg("V-ups"),template:'camera_vup',kcalPerRep:0.3,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Lie flat"), msg("Lift chest and legs"), msg("Lie back")],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:124,hysteresis:8,minRangeDeg:35,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Chest and legs lift at the same time.")],experimental:true},
 punch:{id:'punch',title:msg("Shadow boxing punches"),template:'camera_punch',kcalPerRep:0.08,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],either:true,invert:true,cues:[msg("Fists up"), msg("Punch forward"), msg("Bring it back")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:105,down:60,hysteresis:8,minRangeDeg:35,minRepMs:250,maxRepMs:10000,minDwellMs:40,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Punch at shoulder height, then bring your fist back."), msg("Side-on shows the punch best.")],experimental:true},
 latpull:{id:'latpull',title:msg("Lat pulldowns"),template:'camera_latpull',kcalPerRep:0.25,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Sit tall, arms up"), msg("Pull your elbows down"), msg("Reach back up")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:147,down:119,hysteresis:8,minRangeDeg:28,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Stay seated."), msg("Your hands move, your shoulders stay put.")],experimental:true},
 pullover:{id:'pullover',title:msg("Dumbbell pullovers"),template:'camera_pullover',kcalPerRep:0.2,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Arms above your chest"), msg("Lower behind your head"), msg("Pull back up")],required:pick(L.shoulder,L.elbow,L.hip),
  up:65,down:40,hysteresis:8,minRangeDeg:25,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your arms nearly straight.")],experimental:true,
  suitable:flat(L.hip)},
 kbswing:{id:'kbswing',title:msg("Kettlebell swings"),template:'camera_kbswing',kcalPerRep:0.5,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Hinge, weight behind you"), msg("Snap your hips forward"), msg("Let it swing back")],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:120,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("The swing comes from your hips, not your arms.")],experimental:true},
 legext:{id:'legext',title:msg("Seated leg extensions"),template:'camera_legext',kcalPerRep:0.15,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],either:true,invert:true,cues:[msg("Sit tall, knee bent"), msg("Straighten your leg"), msg("Lower your foot")],required:pick(L.hip,L.knee,L.ankle),
  up:65,down:39,hysteresis:8,minRangeDeg:25,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("1.5–2 m away, laptop at chest height")},tips:[msg("Keep your thigh on the seat.")],experimental:true},
 bulgarian:{id:'bulgarian',title:msg("Bulgarian split squats"),template:'camera_bulgarian',kcalPerRep:0.55,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Back foot on the bench"), msg("Lower straight down"), msg("Stand up")],required:pick(L.shoulder),
  up:140,down:115,hysteresis:8,minRangeDeg:25,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Stand side-on to the camera.")],experimental:true},
 pistol:{id:'pistol',title:msg("Pistol squats"),template:'camera_pistol',kcalPerRep:0.7,joints:[[23,25,27],[24,26,28]],either:true,span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Stand on one leg"), msg("Sit down on that leg"), msg("Stand up")],required:pick(L.shoulder),
  up:150,down:117,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Hold onto something sturdy if you need to.")],experimental:true},
 shouldertap:{id:'shouldertap',title:msg("Plank shoulder taps"),template:'camera_shouldertap',kcalPerRep:0.12,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],either:true,cues:[msg("Push-up position"), msg("Tap the other shoulder"), msg("Hand back down")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:149,down:100,hysteresis:8,minRangeDeg:35,minRepMs:400,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your hips still.")],experimental:true,
  suitable:flat(L.hip)},
 legcurl:{id:'legcurl',title:msg("Lying leg curls"),template:'camera_legcurl',kcalPerRep:0.1,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],cues:[msg("Lie face down"), msg("Bend your knees"), msg("Lower your feet")],required:pick(L.hip,L.knee,L.ankle),
  up:150,down:126,hysteresis:8,minRangeDeg:30,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your hips on the floor.")],experimental:true,
  suitable:flat(L.hip)},
 hspu:{id:'hspu',title:msg("Wall handstand push-ups"),template:'camera_hspu',kcalPerRep:0.9,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Handstand, arms straight"), msg("Lower your head"), msg("Press up")],required:pick(L.shoulder,L.elbow,L.wrist),
  up:150,down:100,hysteresis:8,minRangeDeg:40,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Only try this if you can already hold a wall handstand.")],experimental:true},
 hangleg:{id:'hangleg',title:msg("Hanging leg raises"),template:'camera_hangleg',kcalPerRep:0.5,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Hang with legs down"), msg("Lift your legs"), msg("Lower with control")],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:114,hysteresis:8,minRangeDeg:36,minRepMs:800,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Try not to swing.")],experimental:true},
 decline:{id:'decline',straightens:true,title:msg("Decline push-ups"),template:'camera_decline',kcalPerRep:0.45,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Feet raised, arms straight"), msg("Lower your chest"), msg("Push up")],required:pick(L.shoulder,L.elbow,L.wrist),inFrame:pick(L.hip,L.ankle),
  up:150,down:105,hysteresis:8,minRangeDeg:40,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your body in one straight line.")],experimental:true,
  suitable:(p,s)=>flat(L.hip)(p,s)||pushupView(p,s)==='front'},
 nordic:{id:'nordic',title:msg("Nordic curls"),template:'camera_nordic',kcalPerRep:0.6,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],invert:true,cues:[msg("Kneel tall, ankles anchored"), msg("Lower forward slowly"), msg("Pull back up")],required:pick(L.hip,L.knee,L.ankle),
  up:65,down:51,hysteresis:8,minRangeDeg:19,minRepMs:950,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone on the floor")},tips:[msg("Keep your hips straight."), msg("Use your hands to catch yourself.")],experimental:true},
 jumplunge:{id:'jumplunge',title:msg("Jump lunges"),template:'camera_jumplunge',kcalPerRep:0.65,either:true,joints:[[23,25,27],[24,26,28]],span:[[23,27],[24,28]],optional:pick(L.hip,L.knee,L.ankle),drop:true,cues:[msg("Stand in a split stance"), msg("Lower into a lunge"), msg("Jump and land")],required:pick(L.shoulder),
  up:150,down:135,hysteresis:8,minRangeDeg:24,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Your feet must leave the floor for it to count.")],experimental:true},
 tuckjump:{id:'tuckjump',title:msg("Tuck jumps"),template:'camera_tuckjump',kcalPerRep:0.7,joints:[[11,23,25],[12,24,26]],span:[[11,25],[12,26]],cues:[msg("Stand tall"), msg("Jump, knees to chest"), msg("Land softly")],required:pick(L.shoulder,L.hip,L.knee),
  up:150,down:122,hysteresis:8,minRangeDeg:35,minRepMs:500,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Both knees come up together.")],experimental:true},
 cleanpress:{id:'cleanpress',title:msg("Clean and press"),template:'camera_cleanpress',kcalPerRep:0.8,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Weight at your thighs"), msg("Pull to your shoulders, press overhead"), msg("Lower to your thighs")],required:pick(L.shoulder,L.elbow,L.hip),
  up:165,down:85,hysteresis:8,minRangeDeg:60,minRepMs:1000,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("Bend your elbows at the shoulders on the way up.")],experimental:true},
 snatch:{id:'snatch',title:msg("Dumbbell snatches"),template:'camera_snatch',kcalPerRep:0.8,joints:[[23,11,13],[24,12,14]],span:[[23,13],[24,14]],invert:true,cues:[msg("Hinge, weight low"), msg("Drive up overhead"), msg("Lower under control")],required:pick(L.shoulder,L.elbow,L.hip),
  up:145,down:76,hysteresis:8,minRangeDeg:60,minRepMs:700,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2–3 m away, laptop at table height")},tips:[msg("One smooth movement from your hips to overhead.")],experimental:true},
 inclinebench:{id:'inclinebench',title:msg("Incline dumbbell press"),template:'camera_inclinebench',kcalPerRep:0.35,joints:[[11,13,15],[12,14,16]],span:[[11,15],[12,16]],cues:[msg("Lean back, arms up"), msg("Lower to your chest"), msg("Press up")],required:pick(L.shoulder,L.elbow,L.wrist,L.hip),
  up:150,down:122,hysteresis:8,minRangeDeg:28,minRepMs:600,maxRepMs:10000,minDwellMs:100,minVisibility:.5,smoothing:{minCutoff:2.5,beta:.02},
  camera:{view:'side',distance:msg("2 m away, phone at bench height")},tips:[msg("Stand the phone side-on to the bench.")],experimental:true},
} as Record<ExerciseKind,ExerciseConfig>;
for(const [id,form] of Object.entries(EXERCISE_FORMS))EXERCISE_CONFIG[id as ExerciseKind].form=form;
/** Measured with the same motions filmed from the other angle (tests/pose-both-angles.test.ts). Mostly floor work, where the
 *  legs hide the body head-on, and moves whose travel runs straight towards the camera. */
export const ONE_ANGLE:ReadonlySet<ExerciseKind>=new Set<ExerciseKind>(['situp','wallpush','raise','bridge','sideleg','donkey','superman','kickback','front','crunch','legraise','sidebend','climber','hipthrust','revfly','seatrow','pullup','birddog','flutter','bicycle','revcrunch','vup','punch','pullover','kbswing','legext','shouldertap','legcurl','nordic']);
for(const [id,move] of Object.entries(MOVES)){const c=EXERCISE_CONFIG[id as ExerciseKind];if(!c)continue;const base=(EXERCISE_VARIANTS[id as ExerciseKind]??id) as ExerciseKind;c.plane=move.view;c.bothAngles=!ONE_ANGLE.has(base);}
/** The first camera tip: which way to stand, from what was measured. */
export function angleTip(c:ExerciseConfig){
 const front=c.plane==='front';
 if(c.bothAngles)return front?msg("Counts side-on or facing the camera; facing the camera gives the surest count."):msg("Counts side-on or facing the camera; side-on gives the surest count.");
 return front?msg("Only counts facing the camera: from the other angle this movement is hidden."):msg("Only counts side-on: from the other angle this movement is hidden.");
}
for(const [id,base] of Object.entries(EXERCISE_VARIANTS))EXERCISE_CONFIG[id as ExerciseKind]={...EXERCISE_CONFIG[base],id:id as ExerciseKind,title:EXERCISES[id as ExerciseKind].title,template:`camera_${id}`};
// Titles, spoken cues, camera tips and distances read in the chosen language (after the variants above copy their base).
localized(Object.values(EXERCISE_CONFIG), ["title", "cues", "tips"]);
localized(Object.values(EXERCISE_CONFIG).map(c => c.camera), ["distance"]);
/** Harder levels ask for a fuller range of motion: a straighter top and a deeper bottom. Beginner is the base config. */
export const EXERCISE_LEVELS:Record<ExerciseLevel,{title:string;up:number;down:number}>={beginner:{title:msg("Beginner"),up:0,down:0},intermediate:{title:msg("Intermediate"),up:5,down:10},advanced:{title:msg("Advanced"),up:10,down:20}};
export const withLevel=(config:ExerciseConfig,level:ExerciseLevel):ExerciseConfig=>({...config,up:Math.min(176,config.up+EXERCISE_LEVELS[level].up),down:Math.max(config.down*.6,config.down-EXERCISE_LEVELS[level].down)});  // small movements keep a reachable target
/** Why a movement cycle was not counted, and what to tell the person. */
export const REJECTION_TIPS={
 too_shallow:msg("Not counted: go a little deeper if it feels comfortable."),
 too_fast:msg("Not counted: that was very quick. Try a steadier pace."),
 too_slow:msg("Not counted: that rep took a long time. Pausing mid-rep is fine; start the next one from the top."),
 lost_tracking:msg("Not counted: you left the frame or were hidden during that rep."),
 wrong_exercise:msg("Not counted: that looks like a different exercise from the one you picked."),
} as const;
export type RejectionReason=keyof typeof REJECTION_TIPS;
localized(Object.values(EXERCISE_LEVELS), ["title"]);
localizedMap(REJECTION_TIPS as Record<string, string>);

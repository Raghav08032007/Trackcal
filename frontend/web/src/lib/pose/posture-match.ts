import { msg } from "../i18n";
// Posture compared with the example. Each exercise's example motion (exercise-motions.ts) is measured the same way the camera
// measures a person (body-shape.ts). The joints the example keeps steady through the whole move, such as a straight body in a push-up
// or an upright chest in a squat, are what posture means for that exercise. When yours drifts well away from the example's for a
// moment, one plain tip says what to change. How deep each rep goes is the rep counter's job, not this one's.
import {MOVES,full,layout,placement,type Move} from './exercise-motions';
import {readBody,type Body} from './body-shape';
import {EXERCISE_VARIANTS,type ExerciseKind,type Landmark} from './types';
import type {Phase} from './rep-counter';
import {formFamily} from './form-check';

export type PostureMetric='tilt'|'hip'|'knee'|'elbow';
export type PostureRule={metric:PostureMetric;ref:number;tip:string;point:string;/** Also judged while getting ready (a plank-like hold). */setup?:boolean};
/** A steady joint: it moves less than this across the example. */
const STEADY=15;
/** How far past the example a joint may drift before it's worth a word, in degrees. Generous on purpose: only clear drift. */
const SLACK:Record<PostureMetric,number>={tilt:18,hip:22,knee:35,elbow:40};
/** It has to stay off this long, so one jittery frame or the turn at the bottom of a rep says nothing. */
const HOLD_MS=700,QUIET_MS=4000;

/** The example's body, measured like a camera frame: 33 points in a 0-1 picture. */
export function exampleBody(m:Move,pose:Parameters<typeof full>[0]):Body{
 const at=layout(m,full(pose),placement(m)),points:Landmark[]=Array.from({length:33},(_,id)=>{const q=at[id]??at[11];return {x:q[0],y:q[1]+.02,visibility:1,presence:1};});
 return readBody(points,0);
}

const lying=(tilt:number)=>tilt>60;
const moveOf=(kind:ExerciseKind)=>MOVES[(EXERCISE_VARIANTS[kind]??kind) as ExerciseKind]??MOVES[kind];
/** How far each body part travels across the example's key poses, in degrees: what the exercise actually moves. */
function travel(m:Move){
 const keys=m.keys.map(full),range=(f:(p:ReturnType<typeof full>)=>number)=>{const v=keys.map(f);return Math.max(...v)-Math.min(...v);};
 return {torso:range(p=>p.torso),thigh:Math.max(range(p=>p.thigh[0]),range(p=>p.thigh[1])),arm:Math.max(range(p=>p.arm[0]),range(p=>p.arm[1])),
  armTop:Math.max(...keys.flatMap(p=>[Math.abs(p.arm[0]),Math.abs(p.arm[1])])),kneeBent:keys.some(p=>Math.abs(p.thigh[0]-p.shin[0])>40||Math.abs(p.thigh[1]-p.shin[1])>40)};
}
/** The posture rules for one exercise: each steady, straight joint of the example, with the tip for drifting from it. */
export function postureRules(kind:ExerciseKind):PostureRule[]{
 const m=moveOf(kind);if(!m)return [];
 const bodies=m.keys.map(k=>exampleBody(m,k)),rules:PostureRule[]=[],moves=travel(m),upsideDown=bodies.some(b=>b.headDown>.2);
 const span=(metric:PostureMetric)=>{const v=bodies.map(b=>b[metric]).filter(Number.isFinite);return v.length===bodies.length?{lo:Math.min(...v),hi:Math.max(...v),mean:v.reduce((a,b)=>a+b,0)/v.length}:null;};
 const tilt=span('tilt'),flat=!!tilt&&lying(tilt.mean);
 if(tilt&&!flat&&!upsideDown&&tilt.hi-tilt.lo<STEADY&&tilt.mean<30)rules.push({metric:'tilt',ref:tilt.mean,tip:msg("Stand up straight, like the example."),point:msg("Stand upright, back long")});
 const hip=span('hip');
 if(hip&&hip.hi-hip.lo<STEADY&&hip.mean>150)rules.push({metric:'hip',ref:hip.mean,setup:flat,tip:flat?msg("Keep your body in one straight line, like the example."):msg("Keep your hips straight, like the example."),point:flat?msg("Body in one straight line"):msg("Hips straight")});
 const knee=span('knee');
 if(knee&&knee.hi-knee.lo<STEADY&&knee.mean>150&&(moves.thigh>30||flat))rules.push({metric:'knee',ref:knee.mean,tip:msg("Keep your legs straight."),point:msg("Legs straight")});
 const elbow=span('elbow');
 if(elbow&&elbow.hi-elbow.lo<STEADY&&elbow.mean>150&&moves.arm>45&&moves.torso<40&&moves.thigh<40&&!(flat&&moves.torso>15))rules.push({metric:'elbow',ref:elbow.mean,tip:msg("Keep your arms straight."),point:msg("Arms straight")});
 return rules;
}

/** What the example asks of the moving joint at the bottom of each rep, in words. */
/** Moves whose main motion reads better in words of its own than from the joint that moves most. */
const DEPTH_WORDS:Partial<Record<ExerciseKind,string>>={
 ohsquat:msg("Bend your knees to about a right angle"),sidelunge:msg("Bend the stepping knee to about a right angle"),bulgarian:msg("Bend your front knee to about a right angle"),
 bridge:msg("Lift your hips until your body is in a line"),hipthrust:msg("Lift your hips until your body is in a line"),
 deadlift:msg("Hinge at your hips, back flat"),rdl:msg("Hinge at your hips, back flat"),goodmorning:msg("Hinge at your hips, back flat"),kbswing:msg("Hinge, then swing to chest height"),snatch:msg("Hinge, then lift all the way overhead"),
 hspu:msg("Bend your elbows to lower your head"),birddog:msg("Reach one arm and the opposite leg out straight"),donkey:msg("Lift one leg up behind you"),sidebend:msg("Lean to the side, then stand tall"),
 calf:msg("Rise onto your toes"),wcalf:msg("Rise onto your toes"),superman:msg("Lift your chest and legs off the floor"),punch:msg("Punch straight out at shoulder height"),
};
/** How far to move, as whole sentences so each language can word them: to about a right angle, about halfway, a little. */
const DEPTH_CUES={
 legs:[msg("Lift your legs to about a right angle"),msg("Lift your legs about halfway"),msg("Lift your legs a little")],
 curl:[msg("Curl your body up to about a right angle"),msg("Curl your body up about halfway"),msg("Curl your body up a little")],
 hinge:[msg("Hinge at your hips to about a right angle"),msg("Hinge at your hips about halfway"),msg("Hinge at your hips a little")],
 knees:[msg("Bend your knees to about a right angle"),msg("Bend your knees about halfway"),msg("Bend your knees a little")],
 elbows:[msg("Bend your elbows to about a right angle"),msg("Bend your elbows about halfway"),msg("Bend your elbows a little")],
};
export function depthPoint(kind:ExerciseKind):string|null{
 const base=(EXERCISE_VARIANTS[kind]??kind) as ExerciseKind;if(DEPTH_WORDS[base])return DEPTH_WORDS[base]!;
 const m=moveOf(kind);if(!m||m.keys.length<2)return null;
 const moves=travel(m);
 const bodies=m.keys.map(k=>exampleBody(m,k));let best:{metric:'knee'|'hip'|'elbow';low:number;range:number}|null=null;
 for(const metric of ['knee','hip','elbow'] as const){const v=bodies.map(b=>b[metric]).filter(Number.isFinite);if(v.length<2)continue;const range=Math.max(...v)-Math.min(...v);if(!best||range>best.range)best={metric,low:Math.min(...v),range};}
 // Straight arms swinging up (raises, jacks): say how high.
 if((!best||best.range<25||best.metric==='elbow'&&best.range<40)&&moves.arm>45)return moves.armTop>140?msg("Raise your arms overhead"):msg("Raise your arms to shoulder height");
 if(!best||best.range<25)return null;
 const how=best.low<105?0:best.low<140?1:2;   // to about a right angle, about halfway, a little
 if(best.metric==='hip'){
  // The hip closes either because the body bends (a hinge, a sit-up) or because the legs lift (knee raises, leg raises).
  if(moves.thigh>moves.torso)return moves.kneeBent?msg("Lift your knees to about hip height"):DEPTH_CUES.legs[how];
  const flatBody=bodies[0].tilt>60;return flatBody?DEPTH_CUES.curl[how]:DEPTH_CUES.hinge[how];
 }
 return {knee:DEPTH_CUES.knees[how],elbow:DEPTH_CUES.elbows[how]}[best.metric];
}

/** The points shown under the example: how deep to go, then what to keep steady. */
/** What the form checker (form-check.ts) also watches for these families. */
const FAMILY_POINTS:Record<string,string[]>={squat:[msg("Feet about shoulder width"),msg("Knees over your toes")],curl:[msg("Elbows close to your sides")],lunge:[msg("Front knee over your ankle")]};
export function formPoints(kind:ExerciseKind):string[]{
 const depth=depthPoint(kind),family=formFamily(kind);
 return [...(depth?[depth]:[]),...(family?FAMILY_POINTS[family]??[]:[]),...postureRules(kind).map(r=>r.point)].slice(0,3);
}

/** Watches a set and says, now and then, which steady joint has drifted from the example. Only joints the camera can see are judged:
 *  side-on for a move forward and back, facing for one out to the sides (the body readings are NaN otherwise, and NaN never fails). */
export class PostureMatcher{
 private rules:PostureRule[];private since:Partial<Record<PostureMetric,number>>={};private quietUntil=0;private startTilt=NaN;
 constructor(kind:ExerciseKind,private plane:'side'|'front'='side'){this.rules=postureRules(kind);const m=moveOf(kind);if(m)this.startTilt=exampleBody(m,m.keys[0]).tilt;}
 get watching(){return this.rules.map(r=>r.metric);}
 /** A tip to show, or null. Only while a rep or the start position is being held, never during setup. */
 update(body:Body|undefined,phase:Phase,t:number):string|null{
  if(!body||!this.rules.length){this.since={};return null;}
  // Seen from the wrong angle, joint angles are foreshortened: say nothing rather than guess.
  if(this.plane==='side'?body.facing>.5:body.facing<.3){this.since={};return null;}
  // Getting ready: only a plank-like hold is judged, and only once the body is clearly in its starting position.
  const ready=phase!=='SETUP',inPosition=Number.isFinite(body.tilt)&&Math.abs(body.tilt-this.startTilt)<20;
  let worst:{rule:PostureRule;by:number}|null=null;
  for(const rule of this.rules){
   const v=body[rule.metric],judged=ready||rule.setup&&inPosition;
   const by=!judged||!Number.isFinite(v)?0:rule.metric==='tilt'?v-rule.ref-SLACK.tilt:rule.ref-v-SLACK[rule.metric];  // leaning further, or bending a joint that should stay straight
   // Each joint keeps its own clock, so two joints drifting together don't keep resetting each other.
   if(by<=0){delete this.since[rule.metric];continue;}
   this.since[rule.metric]??=t;
   if(t-this.since[rule.metric]!>=HOLD_MS&&(!worst||by>worst.by))worst={rule,by};
  }
  if(!worst||t<this.quietUntil)return null;
  this.quietUntil=t+QUIET_MS;this.since={};return worst.rule.tip;
 }
}

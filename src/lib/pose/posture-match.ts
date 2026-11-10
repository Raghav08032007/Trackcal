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
 if(tilt&&!flat&&!upsideDown&&tilt.hi-tilt.lo<STEADY&&tilt.mean<30)rules.push({metric:'tilt',ref:tilt.mean,tip:'Stand up straight, like the example.',point:'Stand upright, back long'});
 const hip=span('hip');
 if(hip&&hip.hi-hip.lo<STEADY&&hip.mean>150)rules.push({metric:'hip',ref:hip.mean,setup:flat,tip:flat?'Keep your body in one straight line, like the example.':'Keep your hips straight, like the example.',point:flat?'Body in one straight line':'Hips straight'});
 const knee=span('knee');
 if(knee&&knee.hi-knee.lo<STEADY&&knee.mean>150&&(moves.thigh>30||flat))rules.push({metric:'knee',ref:knee.mean,tip:'Keep your legs straight.',point:'Legs straight'});
 const elbow=span('elbow');
 if(elbow&&elbow.hi-elbow.lo<STEADY&&elbow.mean>150&&moves.arm>45&&moves.torso<40&&moves.thigh<40&&!(flat&&moves.torso>15))rules.push({metric:'elbow',ref:elbow.mean,tip:'Keep your arms straight.',point:'Arms straight'});
 return rules;
}

/** What the example asks of the moving joint at the bottom of each rep, in words. */
/** Moves whose main motion reads better in words of its own than from the joint that moves most. */
const DEPTH_WORDS:Partial<Record<ExerciseKind,string>>={
 ohsquat:'Bend your knees to about a right angle',sidelunge:'Bend the stepping knee to about a right angle',bulgarian:'Bend your front knee to about a right angle',
 bridge:'Lift your hips until your body is in a line',hipthrust:'Lift your hips until your body is in a line',
 deadlift:'Hinge at your hips, back flat',rdl:'Hinge at your hips, back flat',goodmorning:'Hinge at your hips, back flat',kbswing:'Hinge, then swing to chest height',snatch:'Hinge, then lift all the way overhead',
 hspu:'Bend your elbows to lower your head',birddog:'Reach one arm and the opposite leg out straight',donkey:'Lift one leg up behind you',sidebend:'Lean to the side, then stand tall',
 calf:'Rise onto your toes',wcalf:'Rise onto your toes',superman:'Lift your chest and legs off the floor',punch:'Punch straight out at shoulder height',
};
export function depthPoint(kind:ExerciseKind):string|null{
 const base=(EXERCISE_VARIANTS[kind]??kind) as ExerciseKind;if(DEPTH_WORDS[base])return DEPTH_WORDS[base]!;
 const m=moveOf(kind);if(!m||m.keys.length<2)return null;
 const moves=travel(m);
 const bodies=m.keys.map(k=>exampleBody(m,k));let best:{metric:'knee'|'hip'|'elbow';low:number;range:number}|null=null;
 for(const metric of ['knee','hip','elbow'] as const){const v=bodies.map(b=>b[metric]).filter(Number.isFinite);if(v.length<2)continue;const range=Math.max(...v)-Math.min(...v);if(!best||range>best.range)best={metric,low:Math.min(...v),range};}
 // Straight arms swinging up (raises, jacks): say how high.
 if((!best||best.range<25||best.metric==='elbow'&&best.range<40)&&moves.arm>45)return `Raise your arms ${moves.armTop>140?'overhead':'to shoulder height'}`;
 if(!best||best.range<25)return null;
 const how=best.low<105?'to about a right angle':best.low<140?'about halfway':'a little';
 if(best.metric==='hip'){
  // The hip closes either because the body bends (a hinge, a sit-up) or because the legs lift (knee raises, leg raises).
  if(moves.thigh>moves.torso)return moves.kneeBent?'Lift your knees to about hip height':`Lift your legs ${how==='to about a right angle'?'to about a right angle':how}`;
  const flatBody=bodies[0].tilt>60;return flatBody?`Curl your body up ${how}`:`Hinge at your hips ${how}`;
 }
 return {knee:`Bend your knees ${how}`,elbow:`Bend your elbows ${how}`}[best.metric];
}

/** The points shown under the example: how deep to go, then what to keep steady. */
/** What the form checker (form-check.ts) also watches for these families. */
const FAMILY_POINTS:Record<string,string[]>={squat:['Feet about shoulder width','Knees over your toes'],curl:['Elbows close to your sides'],lunge:['Front knee over your ankle']};
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

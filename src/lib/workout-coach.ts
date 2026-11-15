import { msg, locale, t, localized } from "./i18n";
import { localeOf } from "./i18n/locales";
import type {RejectionReason} from './pose/exercise-config';
import type {ExerciseKind} from './pose/types';

export type CircuitStep={kind:ExerciseKind;target:number};
export type Circuit={id:string;name:string;rest:number;steps:CircuitStep[]};
/** Ready-made workouts, mixing moves that don't need a weight. */
export const CIRCUIT_PRESETS:Circuit[]=[
 {id:'starter',name:msg("Starter full body"),rest:45,steps:[{kind:'squat',target:10},{kind:'wallpush',target:10},{kind:'bridge',target:10},{kind:'crunch',target:10}]},
 {id:'legs',name:msg("Leg day"),rest:60,steps:[{kind:'squat',target:15},{kind:'lunge',target:10},{kind:'sumo',target:12},{kind:'calf',target:15}]},
 {id:'burn',name:msg("Quick cardio"),rest:30,steps:[{kind:'jack',target:20},{kind:'highknee',target:20},{kind:'climber',target:20},{kind:'burpee',target:5}]},
];
localized(CIRCUIT_PRESETS,["name"]);
export const MIN_REST=5,MAX_REST=180,MAX_STEPS=12;
/** The server needs at least a minute on a saved workout, so a quick exercise is recorded as one. */
export const stepMinutes=(seconds:number)=>Math.min(180,Math.max(1,Math.round(seconds/60*100)/100));
/** Rep calories are rough, so only half go back into the food budget. Eating all of a rough estimate undoes the work. */
export const earnedBack=(burned:number)=>Math.round(Math.max(0,burned)/2);
export const repCalories=(reps:number,kcalPerRep:number,kg:number)=>Math.round(reps*kcalPerRep*kg/70*10)/10;
/** Short things to say aloud when a rep doesn't count. */
export const VOICE_TIPS:Partial<Record<RejectionReason,string>>={too_shallow:msg("Go a little further"),too_fast:msg("Slow it down"),lost_tracking:msg("Step back into view"),wrong_exercise:msg("That one did not count")};
/** Speaks over anything still being said, so the count stays in time with the reps. */
export function say(text:string){
 try{
  if(typeof window==='undefined'||!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return;
  window.speechSynthesis.cancel();
  const line=new SpeechSynthesisUtterance(t(text));line.rate=1.1;
  // Spoken in the app's language: the browser picks a voice for it, preferring one installed for that exact language.
  const lang=localeOf(locale()).format,base=lang.split('-')[0];line.lang=lang;
  const voice=window.speechSynthesis.getVoices?.().find(v=>v.lang===lang)??window.speechSynthesis.getVoices?.().find(v=>v.lang.split('-')[0]===base);
  if(voice)line.voice=voice;
  window.speechSynthesis.speak(line);
 }catch{/* speech is a bonus, never a reason to stop the workout */}
}
export const voiceAvailable=()=>typeof window!=='undefined'&&!!window.speechSynthesis;

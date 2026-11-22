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
/** What the coach says as a rep is counted: the number, with a word of encouragement at the moments a real coach would
 *  speak up (halfway, two to go, the last one). Short sets get just the number. */
export function repLine(count:number,target:number){
 if(target>=6&&count===Math.ceil(target/2)&&count<target-2)return t("{n}, halfway there",{n:count});
 if(target>=5&&count===target-2)return t("{n}, two more",{n:count});
 if(target>=3&&count===target-1)return t("{n}, last one",{n:count});
 return String(count);
}

type VoiceLike={name:string;lang:string;localService?:boolean;voiceURI?:string};
/** Names that mark the natural-sounding voices browsers ship (Edge "Natural"/"Online", Chrome "Google", Apple
 *  "Premium"/"Enhanced"/"Siri"), best first; robotic engines are pushed to the back. */
const NATURAL=[/natural/i,/neural/i,/premium/i,/enhanced/i,/siri/i,/online/i,/wavenet/i,/google/i];
export const VOICE_KEY='trackcal:coach-voice';
/** How well a voice fits: the exact language first, then the same language from another region, then how natural it sounds. */
export function voiceScore(v:VoiceLike,lang:string){
 const have=(v.lang||'').replace('_','-').toLowerCase(),want=lang.toLowerCase();
 let score=have===want?100:have.split('-')[0]===want.split('-')[0]?60:-1000;
 NATURAL.forEach((pattern,i)=>{if(pattern.test(v.name))score+=40-i*3;});
 if(/espeak|compact|robot/i.test(v.name))score-=50;
 if(v.localService===false)score+=4;   // the cloud voices are the newer, smoother ones
 return score;
}
let cached:SpeechSynthesisVoice[]=[];
function allVoices(){try{const list=window.speechSynthesis.getVoices?.()??[];if(list.length)cached=list;}catch{/* not supported */}return cached;}
if(typeof window!=='undefined'&&window.speechSynthesis){try{window.speechSynthesis.addEventListener?.('voiceschanged',()=>{allVoices();});allVoices();}catch{/* older browsers: voices are read on first use */}}
/** The voices that speak the app's language, most natural first. */
export function coachVoices(){if(typeof window==='undefined'||!window.speechSynthesis)return [];const lang=localeOf(locale()).format;return allVoices().filter(v=>voiceScore(v,lang)>0).sort((a,b)=>voiceScore(b,lang)-voiceScore(a,lang));}
function chosenVoice(){
 const list=coachVoices();let picked:string|null=null;
 try{picked=localStorage.getItem(VOICE_KEY);}catch{/* private mode */}
 return (picked&&list.find(v=>v.voiceURI===picked||v.name===picked))||list[0];
}
let speaking:{kind:'count'|'cue';at:number}|null=null;
/** Speaks a line in the app's language with the most natural voice available. A rep count never cuts off a tip that has
 *  only just started (the number is on screen anyway); anything else replaces what is being said, so the coach stays in
 *  time with the reps. Counts are a little brisker than tips, like a coach calling them out. */
export function say(text:string,kind:'count'|'cue'=/^\d+$/.test(text)?'count':'cue'){
 try{
  if(typeof window==='undefined'||!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return;
  const synth=window.speechSynthesis,now=Date.now();
  if(kind==='count'&&speaking?.kind==='cue'&&synth.speaking&&now-speaking.at<2500)return;
  synth.cancel();
  const line=new SpeechSynthesisUtterance(kind==='count'?text:t(text));
  const lang=localeOf(locale()).format;line.lang=lang;
  const voice=chosenVoice();if(voice)line.voice=voice;
  line.rate=kind==='count'?1.05:.96;line.pitch=1;line.volume=1;
  speaking={kind,at:now};line.onend=()=>{if(speaking?.at===now)speaking=null;};
  synth.speak(line);
 }catch{/* speech is a bonus, never a reason to stop the workout */}
}
export const voiceAvailable=()=>typeof window!=='undefined'&&!!window.speechSynthesis;

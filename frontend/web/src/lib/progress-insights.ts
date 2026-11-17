import { t } from "./i18n";
import {EXERCISES,type ExerciseKind} from './pose/types';
import {HOLDS,type HoldKind} from './pose/holds';
import {oneRepMax} from './gym-math';
import type {Session} from './wellness';

const localDay=(stamp:string|number)=>{const d=new Date(stamp);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const done=(sessions:Session[])=>sessions.filter(s=>s.status==='completed'&&s.completed_at).sort((a,b)=>Date.parse(a.completed_at!)-Date.parse(b.completed_at!));

/* ── Habit strength ─────────────────────────────────────────────────────────────────────────────────────────
 * The scoring idea follows mhabit by FriesI23 (Apache-2.0): https://github.com/FriesI23/mhabit
 * Each day kept moves the score up a growth curve; a missed day takes 100/target points off (half for a partial day),
 * so one slip costs a little instead of wiping out a streak. The curve here is our own. */
export type HabitDay='done'|'part'|'miss';
export const HABIT_TARGET_DAYS=30;
const K=3/HABIT_TARGET_DAYS,curve=(days:number)=>100*(1-Math.exp(-K*days)),inverse=(score:number)=>score>=100?Infinity:-Math.log(1-score/100)/K;
export function habitScore(days:HabitDay[]){
 let score=0;
 for(const day of days){
  if(day==='done')score=curve(inverse(score)+1);
  else score=Math.max(0,score-(day==='part'?50:100)/HABIT_TARGET_DAYS);
 }
 return Math.round(Math.min(100,score));
}
export const habitLabel=(score:number)=>score>=85?t("A habit"):score>=60?t("Strong"):score>=25?t("Building"):t("Starting");
/** The last `length` days as kept or missed, oldest first, ending today. */
export function dayMarks(kept:Set<string>,now:number,length=60):HabitDay[]{
 return Array.from({length},(_,i)=>kept.has(localDay(now-(length-1-i)*86400000))?'done':'miss');
}
export const workoutDays=(sessions:Session[])=>new Set(done(sessions).map(s=>localDay(s.completed_at!)));

/* ── Training load ──────────────────────────────────────────────────────────────────────────────────────────
 * Fitness, fatigue and form as in elevate's fitness trend (https://github.com/thomaschampagne/elevate), using the
 * standard impulse-response model: fitness is a 42-day and fatigue a 7-day exponential average of daily load.
 * Written here from the published formula, not from elevate's code. Load is minutes moved. */
export function trainingLoad(sessions:Session[],now:number,days=90){
 const byDay=new Map<string,number>();
 for(const s of done(sessions))byDay.set(localDay(s.completed_at!),(byDay.get(localDay(s.completed_at!))??0)+(s.minutes||0));
 let fitness=0,fatigue=0;const series:{day:string;fitness:number;fatigue:number;form:number}[]=[];
 for(let i=days-1;i>=0;i--){
  const day=localDay(now-i*86400000),load=byDay.get(day)??0;
  fitness+=(load-fitness)/42;fatigue+=(load-fatigue)/7;
  series.push({day,fitness:Math.round(fitness*10)/10,fatigue:Math.round(fatigue*10)/10,form:Math.round((fitness-fatigue)*10)/10});
 }
 const last=series[series.length-1],ramp=last.fitness>0?last.fatigue/last.fitness:0;
 const note=last.fitness<1&&last.fatigue<1?t("Not enough training yet to show a trend."):ramp>1.5?t("You are ramping up fast. Fit in an easier day soon."):last.form>5?t("You are fresh. A good day for a harder session."):t("A steady balance of training and recovery.");
 return {series,today:last,note};
}

/* ── Progress per exercise ──────────────────────────────────────────────────────────────────────────────────
 * Like Flex's graphs (https://github.com/brandonp2412/Flex, MIT): the best of each session over time. Camera reps
 * count only what the camera saw, holds are seconds, and weighted sets show an estimated one-rep max. */
export type ProgressPoint={at:string;value:number};
export type ProgressSeries={key:string;title:string;unit:string;points:ProgressPoint[]};
export function progressSeries(sessions:Session[]):ProgressSeries[]{
 const all=new Map<string,ProgressSeries>();
 const add=(key:string,title:string,unit:string,at:string,value:number)=>{if(!(value>0))return;const row=all.get(key)??{key,title,unit,points:[]};row.points.push({at,value:Math.round(value*10)/10});all.set(key,row);};
 for(const s of done(sessions)){
  const tracking=s.details?.tracking,kind=tracking?.exercise_type;
  if(kind&&kind in HOLDS){add(kind,HOLDS[kind as HoldKind].title,'s',s.completed_at!,Math.max(0,...(tracking!.sets as {duration_s?:number}[]).map(set=>set.duration_s??0)));continue;}
  if(kind&&kind in EXERCISES){add(kind,EXERCISES[kind as ExerciseKind].title,'reps',s.completed_at!,Math.max(0,...tracking!.sets.map(set=>Math.min(set.estimated_reps,set.corrected_reps??set.estimated_reps))));continue;}
  for(const exercise of s.details?.exercises??[]){
   const sets=exercise.sets??[],weighted=sets.filter(set=>(set.load??0)>0&&(set.reps??0)>0);
   if(weighted.length)add(`${exercise.exercise_id}:1rm`,`${exercise.exercise_id} (estimated 1RM)`,'kg',s.completed_at!,Math.max(0,...weighted.map(set=>oneRepMax(set.load!,set.reps!)??0)));
   else add(exercise.exercise_id,exercise.exercise_id,'reps',s.completed_at!,Math.max(0,...sets.map(set=>set.reps??0)));
  }
 }
 return [...all.values()].sort((a,b)=>b.points.length-a.points.length);
}

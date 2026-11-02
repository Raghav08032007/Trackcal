import {EXERCISES,type ExerciseKind} from './pose/types';
import type {AdventureSummary} from './adventure';
import type {MoveRecord} from './training-insights';

export type Checkin={date:string;energy:'low'|'ok'|'great';sore:'no'|'bit'|'very'};
export type CoachDay={hour:number;minor:boolean;meals:number;caloriesLeft:number;proteinEaten:number;proteinTarget:number;program:string|null;rested:ExerciseKind|null;streak:number;checkin:Checkin|null};
export type CoachStep={text:string;href:string;label:string};

export const REST_AFTER_DAYS=6,PROTEIN_GAP=25;
export const PROTEIN_IDEAS='a bowl of dal, 100 g of paneer, two eggs or a cup of curd';

/** The chosen companion, falling back to Pip unless it is unlocked. Null when the person has turned companions off. */
export function coachCharacter(summary:AdventureSummary|null){
 if(summary?.customization?.enabled===false)return null;
 const wanted=summary?.customization?.character_id||'pip',allowed=wanted==='pip'||summary?.companion_unlocks?.some(c=>c.id===wanted&&c.unlocked)||summary?.unlocked_companions?.includes(wanted);
 return allowed?wanted:'pip';
}

const localDay=(stamp:number)=>{const d=new Date(stamp);return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;};
/** Days in a row with a saved workout, ending today or yesterday. */
export function streakDays(moves:MoveRecord[],now:number){
 const days=new Set(moves.map(move=>localDay(Date.parse(move.at))));
 let at=days.has(localDay(now))?now:now-86400000,count=0;
 while(days.has(localDay(at))){count++;at-=86400000;}
 return count;
}
/** A new best needs an earlier result to beat, so a first attempt isn't called a record. */
export function newBest(moves:MoveRecord[],kind:ExerciseKind,reps:number){
 const before=Math.max(0,...moves.filter(move=>move.kind===kind).map(move=>move.proven));
 return before>0&&reps>before;
}

export function moveStep(day:CoachDay):CoachStep{
 if(day.checkin?.sore==='very'||day.checkin?.energy==='low')return {text:`You said ${day.checkin.sore==='very'?'you are very sore':'your energy is low'}, so a short walk or a stretch is plenty today.`,href:'/recovery',label:'See recovery'};
 if(day.streak>=REST_AFTER_DAYS)return {text:`${day.streak} days in a row. Rest is part of training, so take today easy.`,href:'/recovery',label:'See recovery'};
 if(day.program)return {text:`Your next ${day.program} workout is ready.`,href:'/programs',label:'Open program'};
 if(day.rested)return {text:`${EXERCISES[day.rested].title} would suit you today.`,href:`/workouts/camera?exercise=${day.rested}`,label:`Start ${EXERCISES[day.rested].title}`};
 return {text:'Choose any workout you enjoy today.',href:'/workouts',label:'Open workouts'};
}
export function foodStep(day:CoachDay){
 if(day.minor)return 'Regular meals and plenty of water will keep your energy up.';
 if(!day.meals)return day.hour<11?'Log your breakfast and we can plan the day from there.':'Nothing logged yet. Snap your next meal and I will keep track.';
 const gap=Math.round(day.proteinTarget-day.proteinEaten);
 if(day.caloriesLeft<=0)return 'You have reached today\'s food target. No need to make up for it tomorrow, just carry on as normal.';
 if(gap>=PROTEIN_GAP)return `You are about ${gap} g short on protein. Try ${PROTEIN_IDEAS}.`;
 return `About ${Math.round(day.caloriesLeft)} kcal left today, and your protein is on track.`;
}
/** What the AI coach may see: a few numbers, with no names, photos or meal history. */
export function coachContext(day:CoachDay){
 return {time_of_day:day.hour<12?'morning':day.hour<17?'afternoon':'evening',meals_logged:day.meals,...(day.minor?{}:{calories_left:Math.round(day.caloriesLeft),protein_eaten_g:Math.round(day.proteinEaten),protein_target_g:day.proteinTarget}),workout_streak_days:day.streak,current_program:day.program,suggested_exercise:day.rested?EXERCISES[day.rested].title:null,energy_today:day.checkin?.energy??null,soreness_today:day.checkin?.sore??null};
}

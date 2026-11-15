import {EXERCISES,type ExerciseKind} from './pose/types';
import type {AdventureSummary} from './adventure';
import type {MoveRecord} from './training-insights';
import {t,msg} from './i18n';

export type Checkin={date:string;energy:'low'|'ok'|'great';sore:'no'|'bit'|'very'};
export type CoachDay={diet?:string;hour:number;minor:boolean;meals:number;caloriesLeft:number;proteinEaten:number;proteinTarget:number;program:string|null;rested:ExerciseKind|null;streak:number;checkin:Checkin|null};
export type CoachStep={text:string;href:string;label:string};

export const REST_AFTER_DAYS=6,PROTEIN_GAP=25;
const IDEAS:Record<string,string>={balanced:msg("a bowl of dal, 100 g of paneer, two eggs or a cup of curd"),vegetarian:msg("a bowl of dal, 100 g of paneer, a cup of curd or a bowl of chana"),vegan:msg("a bowl of dal, 100 g of tofu, a bowl of chana or soya chunks"),pescatarian:msg("a piece of fish, a bowl of dal, two eggs or a cup of curd")};
export const proteinIdeas=(diet?:string)=>t(IDEAS[diet??'']??IDEAS.balanced);
export function firstSteps(done:{meals:boolean;workouts:number;checkedIn:boolean}){
 return [{label:msg("Log your first meal"),href:'/scanner',done:done.meals},{label:msg("Do your first camera workout"),href:'/workouts/camera',done:done.workouts>0},{label:msg("Tell your coach how you feel"),href:'/coach',done:done.checkedIn}];
}

/** The chosen companion, falling back to Pip unless it is unlocked. Null when the person has turned companions off. */
export function coachCharacter(summary:AdventureSummary|null){
 if(summary?.customization?.enabled===false)return null;
 const wanted=summary?.customization?.character_id||'pip',allowed=wanted==='pip'||summary?.companion_unlocks?.some(c=>c.id===wanted&&c.unlocked)||summary?.unlocked_companions?.includes(wanted);
 return allowed?wanted:'pip';
}

const localDay=(stamp:number)=>{const d=new Date(stamp);return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;};
/** Days in a row with a saved workout, ending today or yesterday. */
/** Days in a row with movement, ending today (or yesterday). `extraDays` adds days from the account history: logged workouts and routes. */
export function streakDays(moves:MoveRecord[],now:number,extraDays:Iterable<string>=[]){
 const days=new Set([...moves.map(move=>localDay(Date.parse(move.at))),...[...extraDays].map(day=>localDay(Date.parse(day+'T12:00:00')))]);
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
 if(day.checkin?.sore==='very'||day.checkin?.energy==='low')return {text:day.checkin.sore==='very'?t("You said you are very sore, so a short walk or a stretch is plenty today."):t("You said your energy is low, so a short walk or a stretch is plenty today."),href:'/recovery',label:t("See recovery")};
 if(day.streak>=REST_AFTER_DAYS)return {text:t("{count} days in a row. Rest is part of training, so take today easy.",{count:day.streak}),href:'/recovery',label:t("See recovery")};
 if(day.program)return {text:t("Your next {program} workout is ready.",{program:day.program}),href:'/programs',label:t("Open program")};
 if(day.rested)return {text:t("{exercise} would suit you today.",{exercise:t(EXERCISES[day.rested].title)}),href:`/workouts/camera?exercise=${day.rested}`,label:t("Start {exercise}",{exercise:t(EXERCISES[day.rested].title)})};
 return {text:t("Choose any workout you enjoy today."),href:'/workouts',label:t("Open workouts")};
}
export function foodStep(day:CoachDay){
 if(day.minor)return t("Regular meals and plenty of water will keep your energy up.");
 if(!day.meals)return day.hour<11?t("Log your breakfast and we can plan the day from there."):t("Nothing logged yet. Snap your next meal and I will keep track.");
 const gap=Math.round(day.proteinTarget-day.proteinEaten);
 if(day.caloriesLeft<=0)return t("You have reached today\u2019s food target. No need to make up for it tomorrow, just carry on as normal.");
 if(gap>=PROTEIN_GAP)return t("You are about {gap} g short on protein. Try {ideas}.",{gap,ideas:proteinIdeas(day.diet)});
 return t("About {n} kcal left today, and your protein is on track.",{n:Math.round(day.caloriesLeft)});
}
/** What the AI coach may see: a few numbers, with no names, photos or meal history. */
export function coachContext(day:CoachDay){
 return {diet_preference:day.diet??null,time_of_day:day.hour<12?'morning':day.hour<17?'afternoon':'evening',meals_logged:day.meals,...(day.minor?{}:{calories_left:Math.round(day.caloriesLeft),protein_eaten_g:Math.round(day.proteinEaten),protein_target_g:day.proteinTarget}),workout_streak_days:day.streak,current_program:day.program,suggested_exercise:day.rested?EXERCISES[day.rested].title:null,energy_today:day.checkin?.energy??null,soreness_today:day.checkin?.sore??null};
}

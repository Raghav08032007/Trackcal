import { msg } from "./i18n";
import {EXERCISES,type ExerciseKind} from './pose/types';
import type {Circuit,CircuitStep} from './workout-coach';
import type {Session} from './wellness';

/* Multi-week programs */
type ProgramStep=[ExerciseKind,number];
export type Program={id:string;name:string;summary:string;weeks:number;rest:number;days:ProgramStep[][]};
export const PROGRAMS:Program[]=[
 {id:'home-start',name:'Home starter',summary:'Three short full-body days. No equipment.',weeks:4,rest:45,days:[[['squat',10],['wallpush',10],['bridge',10],['crunch',10]],[['lunge',8],['incline',10],['superman',10],['calf',15]],[['sumo',10],['kneepush',8],['bridge',12],['crunch',12]]]},
 {id:'legs-glutes',name:'Legs and glutes',summary:'Two lower-body days. No equipment.',weeks:4,rest:60,days:[[['squat',15],['lunge',10],['bridge',15],['calf',20]],[['sumo',12],['lunge',12],['bridge',15],['squat',15]]]},
 {id:'dumbbell',name:'Dumbbell basics',summary:'Three days with a pair of dumbbells.',weeks:4,rest:60,days:[[['wsquat',10],['press',8],['row',10],['curl',10]],[['rdl',10],['overhead',8],['hammer',10],['wlunge',8]],[['wsquat',12],['row',10],['press',10],['curl',12]]]},
];
export const programDays=(program:Program)=>program.weeks*program.days.length;
/** Each week adds about a tenth to every target. */
export function programDay(program:Program,index:number):Circuit|null{
 if(!Number.isInteger(index)||index<0||index>=programDays(program))return null;
 const perWeek=program.days.length,week=Math.floor(index/perWeek),steps:CircuitStep[]=program.days[index%perWeek].map(([kind,reps])=>({kind,target:Math.min(100,Math.round(reps*(1+week*.1)))}));
 return {id:`${program.id}:${index}`,name:`${program.name}, week ${week+1} day ${index%perWeek+1}`,rest:program.rest,steps};
}
export function nextProgramDay(program:Program,done:string[]){
 for(let index=0;index<programDays(program);index++)if(!done.includes(`${program.id}:${index}`))return index;
 return null;
}
export const stepsLabel=(circuit:Circuit)=>circuit.steps.map(step=>`${EXERCISES[step.kind].title} × ${step.target}`).join(', ');

/* Fasting customs. Practice differs by family and community, so these are starting points. */
export type FastMode={id:string;label:string;hours:number;eat:string;skip:string};
export const FAST_MODES:FastMode[]=[
 {id:'time',label:msg("Time-based"),hours:14,eat:msg("Your usual balanced meals in your eating window."),skip:msg("Nothing in particular.")},
 {id:'navratri',label:msg("Navratri"),hours:14,eat:msg("Sabudana, kuttu, singhara and rajgira flours, potato, fruit, curd, milk, rock salt."),skip:msg("Onion, garlic, wheat, rice and regular salt.")},
 {id:'ekadashi',label:msg("Ekadashi"),hours:12,eat:msg("Fruit, milk, nuts, potato, sabudana."),skip:msg("Rice, other grains and beans.")},
 {id:'ramadan',label:msg("Ramadan"),hours:14,eat:msg("Sehri: oats, eggs, curd, roti and water. Iftar: water and dates, then a balanced meal."),skip:msg("Very salty or fried food, which makes the next day harder.")},
];

/* Weekly review */
export type MealDay={date:string;calories:number};
const localDay=(stamp:string|number|Date)=>{const d=new Date(stamp);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const repsIn=(session:Session)=>(session.details?.exercises??[]).flatMap(exercise=>exercise.sets??[]).reduce((total,set)=>total+(set.reps||0),0);
export function weeklyReview(sessions:Session[],meals:MealDay[],now:number){
 const days=Array.from({length:7},(_,index)=>localDay(now-(6-index)*86400000));
 const done=sessions.filter(session=>session.status==='completed'&&session.completed_at&&days.includes(localDay(session.completed_at!)));
 const bars=days.map(day=>({day,minutes:done.filter(session=>localDay(session.completed_at!)===day).reduce((total,session)=>total+(session.minutes||0),0)}));
 const logged=meals.filter(meal=>days.includes(meal.date)&&meal.calories>0);
 const activeDays=bars.filter(bar=>bar.minutes>0).length,averageCalories=logged.length?Math.round(logged.reduce((total,meal)=>total+meal.calories,0)/logged.length):null;
 const nudge=!done.length&&!logged.length?'A quiet week. One short workout or one logged meal is a good place to restart.':activeDays>=4?'A strong week. Keep the same rhythm next week.':activeDays>0?`You moved on ${activeDays} of 7 days. Adding one more short session is the easiest next step.`:'You logged your food but did not save a workout. Try one short camera session this week.';
 return {workouts:done.length,reps:done.reduce((total,session)=>total+repsIn(session),0),activeDays,mealDays:logged.length,averageCalories,bars,nudge};
}

/* Menu picker */
export type MenuDish={name:string;calories:number;protein_g:number;carbs_g:number;fat_g:number;vegetarian:boolean|null};
/** Most protein per calorie among dishes that fit what is left today. */
export function pickDishes(dishes:MenuDish[],left:number,vegetarianOnly:boolean){
 const allowed=dishes.filter(dish=>!vegetarianOnly||dish.vegetarian===true),fits=allowed.filter(dish=>dish.calories<=left);
 const score=(dish:MenuDish)=>dish.protein_g/dish.calories;
 return {best:[...fits].sort((a,b)=>score(b)-score(a)).slice(0,3),tooBig:allowed.length-fits.length,checked:allowed.length};
}

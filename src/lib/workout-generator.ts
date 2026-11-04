/* The "build me a workout" flow follows workout-cool by Snouzy (MIT licence): https://github.com/Snouzy/workout-cool
 * Choose muscles and equipment, get one exercise per muscle, shuffle any of them, with suggested reps by type. */
import {EXERCISES,EXERCISE_VARIANTS,gearOf,styleOf,type ExerciseDifficulty,type ExerciseGear,type ExerciseKind} from './pose/types';
import type {Circuit,CircuitStep} from './workout-coach';

export type Group=(typeof EXERCISES)[ExerciseKind]['group'];
export type GeneratorInput={groups:Group[];equipment:'none'|'weights'|'any';gear?:ExerciseGear|'any';level:ExerciseDifficulty;minutes:number;rest:number};
const REPS={strength:10,calisthenics:12,cardio:20,plyometric:8,core:15} as const;
const LEVEL={easy:.8,medium:1,hard:1.25} as const,ORDER={easy:0,medium:1,hard:2} as const;
/** About four minutes per exercise with rest, never fewer than 3 or more than 8. */
export const stepsFor=(minutes:number)=>Math.max(3,Math.min(8,Math.round(minutes/4)));
export const targetFor=(kind:ExerciseKind,level:ExerciseDifficulty)=>Math.max(4,Math.min(100,Math.round(REPS[styleOf(kind)]*LEVEL[level])));

function choices(input:GeneratorInput,group:Group){
 return (Object.keys(EXERCISES) as ExerciseKind[]).filter(kind=>{const e=EXERCISES[kind];return e.group===group&&(input.equipment==='any'||e.equipment===input.equipment)&&(!input.gear||input.gear==='any'||gearOf(kind)===input.gear)&&ORDER[e.difficulty]<=ORDER[input.level];});
}
/** The movement an exercise shares with its variants, so a workout never repeats the same motion twice. */
const motion=(kind:ExerciseKind)=>EXERCISE_VARIANTS[kind]??kind;

export function generateWorkout(input:GeneratorInput,random:()=>number=Math.random):Circuit|null{
 if(!input.groups.length)return null;
 const steps:CircuitStep[]=[],used=new Set<ExerciseKind>(),count=stepsFor(input.minutes);
 for(let round=0;steps.length<count&&round<count;round++)for(const group of input.groups){
  if(steps.length>=count)break;
  const open=choices(input,group).filter(kind=>!used.has(motion(kind)));if(!open.length)continue;
  const pick=open[Math.floor(random()*open.length)];used.add(motion(pick));steps.push({kind:pick,target:targetFor(pick,input.level)});
 }
 return steps.length?{id:`made-${Date.now()}`,name:'Made for you',rest:input.rest,steps}:null;
}
/** Swap one exercise for another that fits the same choices. */
export function shuffleStep(circuit:Circuit,index:number,input:GeneratorInput,random:()=>number=Math.random):Circuit{
 const current=circuit.steps[index];if(!current)return circuit;
 const others=new Set(circuit.steps.filter((_,i)=>i!==index).map(step=>motion(step.kind)));
 const open=choices(input,EXERCISES[current.kind].group).filter(kind=>kind!==current.kind&&!others.has(motion(kind)));
 if(!open.length)return circuit;
 const pick=open[Math.floor(random()*open.length)];
 return {...circuit,steps:circuit.steps.map((step,i)=>i===index?{kind:pick,target:targetFor(pick,input.level)}:step)};
}

import {EXERCISES,EXERCISE_VARIANTS,type ExerciseDifficulty,type ExerciseKind} from './pose/types';
import {HOLDS,HOLD_KINDS,type HoldKind} from './pose/holds';
import {MUSCLE_LABELS,musclesFromText,type MapMuscle} from './training-insights';

/** Names the body diagram uses that aren't trainable groups here, or that fold into one. */
const FROM_DIAGRAM:Record<string,MapMuscle|null>={'left-soleus':'calves','right-soleus':'calves',head:null,neck:null,knees:null};
export const fromDiagram=(name:string):MapMuscle|null=>name in FROM_DIAGRAM?FROM_DIAGRAM[name]:name in MUSCLE_LABELS?name as MapMuscle:null;

export type Found={id:string;kind:ExerciseKind|null;hold:HoldKind|null;title:string;muscles:string;difficulty:ExerciseDifficulty;equipment:'none'|'weights';matched:MapMuscle[];primary:boolean};
export type FinderFilters={equipment:'any'|'none'|'weights';level:ExerciseDifficulty|'any'};
const ORDER={easy:0,medium:1,hard:2} as const;
const HOLD_LEVEL:Record<HoldKind,ExerciseDifficulty>={plank:'easy',wallsit:'easy',bridgehold:'easy',tree:'medium',legbalance:'easy',warrior:'medium',downdog:'medium',forwardfold:'easy'};

/** Exercises and holds that work any of the chosen muscles. The first muscle an exercise lists is its main target, so those come first. */
export function exercisesFor(selected:MapMuscle[],filters:FinderFilters):Found[]{
 if(!selected.length)return [];
 const rows:Found[]=[];
 const consider=(base:Omit<Found,'matched'|'primary'>)=>{
  const listed=musclesFromText(base.muscles),matched=listed.filter(m=>selected.includes(m));
  if(!matched.length)return;
  if(filters.equipment!=='any'&&base.equipment!==filters.equipment)return;
  if(filters.level!=='any'&&ORDER[base.difficulty]>ORDER[filters.level])return;
  const main=musclesFromText(base.muscles.split(',')[0]);
  rows.push({...base,matched,primary:main.some(m=>selected.includes(m))});
 };
 for(const kind of Object.keys(EXERCISES) as ExerciseKind[]){const e=EXERCISES[kind];consider({id:kind,kind,hold:null,title:e.title,muscles:e.muscles,difficulty:e.difficulty,equipment:e.equipment});}
 for(const hold of HOLD_KINDS){const h=HOLDS[hold];consider({id:`hold:${hold}`,kind:null,hold,title:h.title,muscles:h.muscles,difficulty:HOLD_LEVEL[hold],equipment:'none'});}
 return rows.sort((a,b)=>Number(b.primary)-Number(a.primary)||b.matched.length-a.matched.length||ORDER[a.difficulty]-ORDER[b.difficulty]||Number(!!(a.kind&&EXERCISE_VARIANTS[a.kind]))-Number(!!(b.kind&&EXERCISE_VARIANTS[b.kind]))||Number(a.equipment==='weights')-Number(b.equipment==='weights')||a.title.localeCompare(b.title));
}
/** A camera workout link: up to 12 exercises with their targets. */
export const cameraLink=(steps:{kind:ExerciseKind;target:number}[])=>`/workouts/camera?steps=${steps.slice(0,12).map(s=>`${s.kind}:${s.target}`).join(',')}`;
export function parseSteps(raw:string|null){
 if(!raw)return [];
 return raw.split(',').slice(0,12).flatMap(part=>{const [kind,target]=part.split(':');const n=Math.floor(Number(target));return kind in EXERCISES&&n>=1&&n<=100?[{kind:kind as ExerciseKind,target:n}]:[];});
}

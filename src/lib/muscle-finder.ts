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

/* ── Muscle groups and daily packages ─────────────────────────────────────────────────────────────────── */
export type MuscleCategory={id:string;label:string;hint:string;muscles:MapMuscle[]};
export const MUSCLE_CATEGORIES:MuscleCategory[]=[
 {id:'push',label:'Push',hint:'Chest, shoulders, triceps',muscles:['chest','front-deltoids','triceps']},
 {id:'pull',label:'Pull',hint:'Back, biceps, rear shoulders',muscles:['upper-back','trapezius','biceps','back-deltoids','forearm']},
 {id:'legs',label:'Legs',hint:'Quads, glutes, hamstrings, calves',muscles:['quadriceps','gluteal','hamstring','calves','adductor','abductors']},
 {id:'core',label:'Core',hint:'Abs, obliques, lower back',muscles:['abs','obliques','lower-back']},
 {id:'arms',label:'Arms',hint:'Biceps, triceps, forearms',muscles:['biceps','triceps','forearm']},
 {id:'upper',label:'Upper body',hint:'Chest, back, shoulders, arms',muscles:['chest','upper-back','front-deltoids','back-deltoids','biceps','triceps']},
 {id:'lower',label:'Lower body',hint:'Legs and glutes',muscles:['quadriceps','gluteal','hamstring','calves']},
 {id:'full',label:'Full body',hint:'A bit of everything',muscles:['quadriceps','gluteal','chest','upper-back','front-deltoids','abs']},
];
/** A simple weekly split: what today suggests. Sunday is for rest or gentle holds. */
export const WEEK_SPLIT=['rest','push','pull','legs','core','upper','lower'] as const;
export const todaysCategory=(date:Date)=>WEEK_SPLIT[date.getDay()];

const hash=(text:string)=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
/** A repeatable random sequence: the same seed always gives the same plan. */
export function seeded(seed:string){let a=hash(seed)||1;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export type PackageStep={kind:ExerciseKind;target:number};
/** Five camera-tracked exercises for a group: one per movement, main targets first, spread across the group's muscles.
 *  The same day and group give the same "standard" plan for everyone; a different seed gives a shuffle. */
export function dailyPackage(category:MuscleCategory,filters:FinderFilters,seed:string,size=5,targetFor:(kind:ExerciseKind,level:ExerciseDifficulty)=>number=()=>10):PackageStep[]{
 const random=seeded(seed),pool=exercisesFor(category.muscles,filters).filter(row=>row.kind&&row.primary);
 const motion=(kind:ExerciseKind)=>EXERCISE_VARIANTS[kind]??kind,used=new Set<ExerciseKind>(),covered=new Set<MapMuscle>(),out:PackageStep[]=[];
 // Shuffle, then put moves at the chosen level first, so an advanced plan is mostly advanced moves.
 const fit=(row:Found)=>filters.level==='any'?0:Math.abs(ORDER[row.difficulty]-ORDER[filters.level]);
 const shuffled=[...pool].map(row=>({row,key:random()})).sort((a,b)=>fit(a.row)-fit(b.row)||a.key-b.key).map(x=>x.row);
 // First pass: a new muscle each time. Second pass: fill up with anything left.
 for(const pass of [0,1])for(const row of shuffled){
  if(out.length>=size)break;const kind=row.kind!;if(used.has(motion(kind)))continue;
  if(pass===0&&row.matched.every(m=>covered.has(m)))continue;
  used.add(motion(kind));row.matched.forEach(m=>covered.add(m));out.push({kind,target:targetFor(kind,row.difficulty)});
 }
 return out;
}

/** How many exercises a daily plan has: fewer to start, more as you progress. */
export const PLAN_SIZE={easy:4,medium:6,hard:8} as const;
/** Holds for mobility and balance days, easiest first for beginners. */
const MOBILITY:HoldKind[]=['forwardfold','legbalance','downdog','warrior','tree','bridgehold'];
export const HOLD_SECONDS={easy:20,medium:30,hard:45} as const;
export function mobilityPlan(level:'easy'|'medium'|'hard',seed:string){
 const random=seeded(seed),count={easy:3,medium:4,hard:5}[level];
 const pool=MOBILITY.filter(h=>ORDER[HOLD_LEVEL[h]]<=ORDER[level]).map(h=>({h,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.h);
 return pool.slice(0,count).map(hold=>({hold,seconds:HOLD_SECONDS[level]}));
}
/** A hold that rounds off a group's workout. */
export const FINISHER:Partial<Record<string,HoldKind>>={push:'plank',core:'plank',full:'plank',legs:'wallsit',lower:'wallsit',upper:'plank',pull:'bridgehold'};

import {EXERCISES,type ExerciseKind} from './pose/types';
import type {Session} from './wellness';

/** A saved camera workout, reduced to what these insights need. `proven` is the best set counting only reps the camera saw. */
export type MoveRecord={at:string;kind:ExerciseKind;proven:number};
export type MuscleState='worked'|'recovering'|'nearly'|'ready';
export type MapMuscle='quadriceps'|'gluteal'|'hamstring'|'calves'|'adductor'|'abductors'|'chest'|'front-deltoids'|'back-deltoids'|'biceps'|'triceps'|'forearm'|'abs'|'obliques'|'upper-back'|'lower-back'|'trapezius';

const LEGS:MapMuscle[]=['quadriceps','gluteal','hamstring','calves'];
const NAMES:Record<string,MapMuscle[]>={quads:['quadriceps'],glutes:['gluteal'],hamstrings:['hamstring'],calves:['calves'],'inner thighs':['adductor'],'outer hips':['abductors'],'hip flexors':['quadriceps'],legs:LEGS,
 chest:['chest'],'upper chest':['chest'],shoulders:['front-deltoids','back-deltoids'],'front shoulders':['front-deltoids'],'side shoulders':['front-deltoids'],'rear shoulders':['back-deltoids'],
 biceps:['biceps'],triceps:['triceps'],forearms:['forearm'],arms:['biceps','triceps'],abs:['abs'],'lower abs':['abs'],obliques:['obliques'],core:['abs','obliques'],
 lats:['upper-back'],'upper back':['upper-back','trapezius'],'lower back':['lower-back'],'whole body':[...LEGS,'chest','front-deltoids','abs','upper-back']};
/** Words in an exercise's muscle list that aren't muscles on the map. */
export const NOT_A_MUSCLE=new Set(['heart rate','balance','grip']);
export const MUSCLE_LABELS:Record<MapMuscle,string>={quadriceps:'Quads',gluteal:'Glutes',hamstring:'Hamstrings',calves:'Calves',adductor:'Inner thighs',abductors:'Outer hips',chest:'Chest','front-deltoids':'Front shoulders','back-deltoids':'Rear shoulders',biceps:'Biceps',triceps:'Triceps',forearm:'Forearms',abs:'Abs',obliques:'Obliques','upper-back':'Upper back','lower-back':'Lower back',trapezius:'Traps'};

export const musclesOf=(kind:ExerciseKind):MapMuscle[]=>[...new Set(EXERCISES[kind].muscles.toLowerCase().split(',').map(name=>name.trim()).flatMap(name=>NAMES[name]??[]))];

export function movesFrom(sessions:Session[]):MoveRecord[]{
 return sessions.flatMap(session=>{
  const tracking=session.details?.tracking,kind=tracking?.exercise_type;
  if(session.status!=='completed'||!session.completed_at||!kind||!(kind in EXERCISES))return [];
  const proven=Math.max(0,...(tracking.sets??[]).map(set=>Math.min(set.estimated_reps,set.corrected_reps??set.estimated_reps)));
  return [{at:session.completed_at,kind:kind as ExerciseKind,proven}];
 });
}

/** A common rule of thumb, not a measurement of this person's body. */
const stateAfter=(hours:number):MuscleState=>hours<24?'worked':hours<48?'recovering':hours<72?'nearly':'ready';
const RANK:Record<MuscleState,number>={ready:0,nearly:1,recovering:2,worked:3};
export function muscleStates(moves:MoveRecord[],now:number){
 const states=new Map<MapMuscle,MuscleState>();
 for(const move of moves){
  const age=(now-Date.parse(move.at))/3600000;
  if(!(age>=0))continue;
  const state=stateAfter(age);
  for(const muscle of musclesOf(move.kind))if(RANK[state]>RANK[states.get(muscle)??'ready'])states.set(muscle,state);
 }
 return states;
}

/** The easiest exercise that leaves tired muscles alone. */
export function restedChoice(states:Map<MapMuscle,MuscleState>):ExerciseKind|null{
 const kinds=Object.keys(EXERCISES) as ExerciseKind[],tired=(kind:ExerciseKind)=>musclesOf(kind).some(muscle=>RANK[states.get(muscle)??'ready']>=2);
 const order={easy:0,medium:1,hard:2};
 return kinds.filter(kind=>!tired(kind)&&EXERCISES[kind].equipment==='none').sort((a,b)=>order[EXERCISES[a].difficulty]-order[EXERCISES[b].difficulty])[0]??null;
}

export const READY_REPS=15;
const NEXT={easy:'medium',medium:'hard'} as const;
/** Harder moves unlocked by proven reps. A suggestion only: every exercise stays open to everyone. */
export function readyToProgress(moves:MoveRecord[]){
 const best=new Map<ExerciseKind,number>();
 for(const move of moves)best.set(move.kind,Math.max(best.get(move.kind)??0,move.proven));
 const kinds=Object.keys(EXERCISES) as ExerciseKind[];
 return [...best].flatMap(([from,reps])=>{
  const exercise=EXERCISES[from],level=exercise.difficulty as keyof typeof NEXT;
  if(reps<READY_REPS||!(level in NEXT))return [];
  const options=kinds.filter(kind=>EXERCISES[kind].group===exercise.group&&EXERCISES[kind].equipment===exercise.equipment&&EXERCISES[kind].difficulty===NEXT[level]);
  const shared=(kind:ExerciseKind)=>musclesOf(kind).filter(muscle=>musclesOf(from).includes(muscle)).length;
  const to=options.sort((a,b)=>shared(b)-shared(a))[0];
  return to&&!best.has(to)?[{from,to,reps}]:[];
 });
}

const average=(values:number[])=>values.reduce((total,value)=>total+value,0)/values.length;
const SLOWED=1.35,MIN_REPS=6;
/** Reps taking much longer than the first three usually means tiredness. Returns how much slower the last three were. */
export function slowdown(repMs:number[]){
 if(repMs.length<MIN_REPS)return null;
 const start=average(repMs.slice(0,3)),end=average(repMs.slice(-3));
 return end>=start*SLOWED?Math.round((end/start-1)*100):null;
}
/** Stop where reps began to slow, or aim for one more if they never did. */
export function nextTarget(repMs:number[]){
 if(!repMs.length)return null;
 if(slowdown(repMs)===null)return repMs.length+1;
 const start=average(repMs.slice(0,3)),slowed=repMs.findIndex((ms,index)=>index>=3&&ms>=start*SLOWED);
 return Math.max(MIN_REPS,slowed<0?repMs.length:slowed+1);
}

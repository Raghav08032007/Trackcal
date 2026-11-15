import { t } from "@/lib/i18n";
import { useCircuits } from "@/lib/workouts";
import {useState} from 'react';
import {EXERCISES,EXERCISE_GEAR,EXERCISE_GROUPS,GEAR_CHOICES,type ExerciseDifficulty,type ExerciseGear,type ExerciseKind} from '@/lib/pose/types';
import {generateWorkout,shuffleStep,type GeneratorInput,type Group} from '@/lib/workout-generator';
import {CIRCUIT_PRESETS,MAX_REST,MAX_STEPS,MIN_REST,type Circuit,type CircuitStep} from '@/lib/workout-coach';

const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,Math.floor(value)||low));
const summary=(c:Circuit)=>c.steps.map(s=>`${EXERCISES[s.kind].title} × ${s.target}`).join(', ');
/** Build a workout of several camera exercises. The camera moves through them with a rest between each. */
export function CircuitBuilder({disabled,onStart}:{disabled:boolean;onStart:(circuit:Circuit)=>void}){
 const [saved,setSaved]=useCircuits(),[name,setName]=useState(''),[rest,setRest]=useState(30),[steps,setSteps]=useState<CircuitStep[]>([]),[kind,setKind]=useState<ExerciseKind>('squat'),[reps,setReps]=useState(10);
 const row=(c:Circuit,own:boolean)=><div className="library-row" key={c.id}><div><strong>{c.name}</strong><small>{t("{n} · {rest}s rest", { n: summary(c), rest: c.rest })}</small></div><button type="button" className="account-secondary" disabled={disabled} onClick={()=>onStart(c)}>{t("Use {name}", { name: c.name })}</button>{own&&<button type="button" className="account-secondary" onClick={()=>setSaved(all=>all.filter(item=>item.id!==c.id))}>{t("Delete {name}", { name: c.name })}</button>}</div>;
 return <details className="camera-settings"><summary>{t("Workout builder")}</summary><p>{t("Do several exercises in a row. Hit each target and the camera moves on by itself after a rest.")}</p>
  <MakeForMe disabled={disabled} onStart={onStart}/>
  {CIRCUIT_PRESETS.map(c=>row(c,false))}{saved.map(c=>row(c,true))}
  <label>{t("Add exercise")}<select aria-label={t("Add exercise")} value={kind} onChange={e=>setKind(e.target.value as ExerciseKind)}>{Object.entries(EXERCISES).map(([id,e])=><option key={id} value={id}>{e.title}</option>)}</select></label>
  <label>{t("Reps for this exercise")}<input type="number" min="1" max="100" value={reps} onChange={e=>setReps(clamp(Number(e.target.value),1,100))}/></label>
  <button type="button" disabled={steps.length>=MAX_STEPS} onClick={()=>setSteps(all=>[...all,{kind,target:reps}])}>{t("Add to workout")}</button>
  {steps.map((s,i)=><div className="library-row" key={i}><div><strong>{i+1}. {EXERCISES[s.kind].title}</strong><small>{t("{target} reps", { target: s.target })}</small></div><button type="button" className="account-secondary" onClick={()=>setSteps(all=>all.filter((_,at)=>at!==i))}>{t("Remove step {n}", { n: i+1 })}</button></div>)}
  <label>{t("Workout name")}<input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label>
  <label>{t("Rest between exercises (seconds)")}<input type="number" min={MIN_REST} max={MAX_REST} value={rest} onChange={e=>setRest(clamp(Number(e.target.value),MIN_REST,MAX_REST))}/></label>
  <button type="button" disabled={!steps.length||!name.trim()} onClick={()=>{setSaved(all=>[...all,{id:crypto.randomUUID(),name:name.trim(),rest,steps}]);setSteps([]);setName('');}}>{t("Save workout")}</button>
 </details>;
}

/** Pick muscles and equipment, get a workout, swap anything you don't fancy. */
function MakeForMe({disabled,onStart}:{disabled:boolean;onStart:(circuit:Circuit)=>void}){
 const [groups,setGroups]=useState<Group[]>(['legs','chest','core']),[equipment,setEquipment]=useState<GeneratorInput['equipment']>('none'),[gear,setGear]=useState<ExerciseGear|'any'>('any'),[level,setLevel]=useState<ExerciseDifficulty>('easy'),[minutes,setMinutes]=useState(20),[made,setMade]=useState<Circuit|null>(null);
 const input:GeneratorInput={groups,equipment,gear,level,minutes,rest:30};
 const toggle=(group:Group)=>setGroups(all=>all.includes(group)?all.filter(g=>g!==group):[...all,group]);
 return <section className="make-for-me" aria-label={t("Make a workout for me")}><h3>{t("Make one for me")}</h3>
  <div className="camera-equipment" role="group" aria-label={t("Muscles to train")}>{(Object.entries(EXERCISE_GROUPS) as [Group,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={groups.includes(id)} onClick={()=>toggle(id)}>{label}</button>)}</div>
  <label>{t("Equipment")}<select value={equipment} onChange={e=>{setEquipment(e.target.value as GeneratorInput['equipment']);setGear('any');}}><option value="none">{t("No equipment")}</option><option value="weights">{t("With equipment")}</option><option value="any">{t("Any")}</option></select></label>
  {equipment==='weights'&&<label>{t("Equipment type")}<select value={gear} onChange={e=>setGear(e.target.value as ExerciseGear|'any')}><option value="any">{t("Any")}</option>{GEAR_CHOICES.weights.map(id=><option key={id} value={id}>{EXERCISE_GEAR[id]}</option>)}</select></label>}
  <label>{t("Level")}<select value={level} onChange={e=>setLevel(e.target.value as ExerciseDifficulty)}><option value="easy">{t("Easy")}</option><option value="medium">{t("Up to medium")}</option><option value="hard">{t("Up to hard")}</option></select></label>
  <label>{t("Time")}<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[10,15,20,30,45].map(m=><option key={m} value={m}>{t("{m} minutes", { m })}</option>)}</select></label>
  <button type="button" disabled={!groups.length} onClick={()=>setMade(generateWorkout(input))}>{t("Make my workout")}</button>
  {made===null?null:made.steps.length?<div className="made-workout">{made.steps.map((step,i)=><div className="library-row" key={step.kind+i}><div><strong>{i+1}. {EXERCISES[step.kind].title}</strong><small>{t("{target} reps", { target: step.target })}</small></div><button type="button" className="account-secondary" aria-label={t("Swap {title}", { title: EXERCISES[step.kind].title })} onClick={()=>setMade(shuffleStep(made,i,input))}>{t("Swap")}</button></div>)}<button type="button" className="account-primary" disabled={disabled} onClick={()=>onStart(made)}>{t("Start this workout")}</button></div>:<p>{t("Nothing matches. Try more muscles or other equipment.")}</p>}
 </section>;
}

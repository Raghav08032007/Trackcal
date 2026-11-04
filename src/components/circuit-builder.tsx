import {useState} from 'react';
import {EXERCISES,EXERCISE_GEAR,EXERCISE_GROUPS,GEAR_CHOICES,type ExerciseDifficulty,type ExerciseGear,type ExerciseKind} from '@/lib/pose/types';
import {generateWorkout,shuffleStep,type GeneratorInput,type Group} from '@/lib/workout-generator';
import {useLocalState} from '@/lib/use-local-state';
import {CIRCUIT_PRESETS,MAX_REST,MAX_STEPS,MIN_REST,type Circuit,type CircuitStep} from '@/lib/workout-coach';

const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,Math.floor(value)||low));
const summary=(c:Circuit)=>c.steps.map(s=>`${EXERCISES[s.kind].title} × ${s.target}`).join(', ');
/** Build a workout of several camera exercises. The camera moves through them with a rest between each. */
export function CircuitBuilder({disabled,onStart}:{disabled:boolean;onStart:(circuit:Circuit)=>void}){
 const [saved,setSaved]=useLocalState<Circuit[]>('trackcal:studio:circuits',[]),[name,setName]=useState(''),[rest,setRest]=useState(30),[steps,setSteps]=useState<CircuitStep[]>([]),[kind,setKind]=useState<ExerciseKind>('squat'),[reps,setReps]=useState(10);
 const row=(c:Circuit,own:boolean)=><div className="library-row" key={c.id}><div><strong>{c.name}</strong><small>{summary(c)} · {c.rest}s rest</small></div><button type="button" className="account-secondary" disabled={disabled} onClick={()=>onStart(c)}>Use {c.name}</button>{own&&<button type="button" className="account-secondary" onClick={()=>setSaved(all=>all.filter(item=>item.id!==c.id))}>Delete {c.name}</button>}</div>;
 return <details className="camera-settings"><summary>Workout builder</summary><p>Do several exercises in a row. Hit each target and the camera moves on by itself after a rest.</p>
  <MakeForMe disabled={disabled} onStart={onStart}/>
  {CIRCUIT_PRESETS.map(c=>row(c,false))}{saved.map(c=>row(c,true))}
  <label>Add exercise<select aria-label="Add exercise" value={kind} onChange={e=>setKind(e.target.value as ExerciseKind)}>{Object.entries(EXERCISES).map(([id,e])=><option key={id} value={id}>{e.title}</option>)}</select></label>
  <label>Reps for this exercise<input type="number" min="1" max="100" value={reps} onChange={e=>setReps(clamp(Number(e.target.value),1,100))}/></label>
  <button type="button" disabled={steps.length>=MAX_STEPS} onClick={()=>setSteps(all=>[...all,{kind,target:reps}])}>Add to workout</button>
  {steps.map((s,i)=><div className="library-row" key={i}><div><strong>{i+1}. {EXERCISES[s.kind].title}</strong><small>{s.target} reps</small></div><button type="button" className="account-secondary" onClick={()=>setSteps(all=>all.filter((_,at)=>at!==i))}>Remove step {i+1}</button></div>)}
  <label>Workout name<input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label>
  <label>Rest between exercises (seconds)<input type="number" min={MIN_REST} max={MAX_REST} value={rest} onChange={e=>setRest(clamp(Number(e.target.value),MIN_REST,MAX_REST))}/></label>
  <button type="button" disabled={!steps.length||!name.trim()} onClick={()=>{setSaved(all=>[...all,{id:crypto.randomUUID(),name:name.trim(),rest,steps}]);setSteps([]);setName('');}}>Save workout</button>
 </details>;
}

/** Pick muscles and equipment, get a workout, swap anything you don't fancy. */
function MakeForMe({disabled,onStart}:{disabled:boolean;onStart:(circuit:Circuit)=>void}){
 const [groups,setGroups]=useState<Group[]>(['legs','chest','core']),[equipment,setEquipment]=useState<GeneratorInput['equipment']>('none'),[gear,setGear]=useState<ExerciseGear|'any'>('any'),[level,setLevel]=useState<ExerciseDifficulty>('easy'),[minutes,setMinutes]=useState(20),[made,setMade]=useState<Circuit|null>(null);
 const input:GeneratorInput={groups,equipment,gear,level,minutes,rest:30};
 const toggle=(group:Group)=>setGroups(all=>all.includes(group)?all.filter(g=>g!==group):[...all,group]);
 return <section className="make-for-me" aria-label="Make a workout for me"><h3>Make one for me</h3>
  <div className="camera-equipment" role="group" aria-label="Muscles to train">{(Object.entries(EXERCISE_GROUPS) as [Group,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={groups.includes(id)} onClick={()=>toggle(id)}>{label}</button>)}</div>
  <label>Equipment<select value={equipment} onChange={e=>{setEquipment(e.target.value as GeneratorInput['equipment']);setGear('any');}}><option value="none">No equipment</option><option value="weights">With equipment</option><option value="any">Any</option></select></label>
  {equipment==='weights'&&<label>Equipment type<select value={gear} onChange={e=>setGear(e.target.value as ExerciseGear|'any')}><option value="any">Any</option>{GEAR_CHOICES.weights.map(id=><option key={id} value={id}>{EXERCISE_GEAR[id]}</option>)}</select></label>}
  <label>Level<select value={level} onChange={e=>setLevel(e.target.value as ExerciseDifficulty)}><option value="easy">Easy</option><option value="medium">Up to medium</option><option value="hard">Up to hard</option></select></label>
  <label>Time<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[10,15,20,30,45].map(m=><option key={m} value={m}>{m} minutes</option>)}</select></label>
  <button type="button" disabled={!groups.length} onClick={()=>setMade(generateWorkout(input))}>Make my workout</button>
  {made===null?null:made.steps.length?<div className="made-workout">{made.steps.map((step,i)=><div className="library-row" key={step.kind+i}><div><strong>{i+1}. {EXERCISES[step.kind].title}</strong><small>{step.target} reps</small></div><button type="button" className="account-secondary" aria-label={`Swap ${EXERCISES[step.kind].title}`} onClick={()=>setMade(shuffleStep(made,i,input))}>Swap</button></div>)}<button type="button" className="account-primary" disabled={disabled} onClick={()=>onStart(made)}>Start this workout</button></div>:<p>Nothing matches. Try more muscles or other equipment.</p>}
 </section>;
}

import {useState} from 'react';
import {EXERCISES,type ExerciseKind} from '@/lib/pose/types';
import {useLocalState} from '@/lib/use-local-state';
import {CIRCUIT_PRESETS,MAX_REST,MAX_STEPS,MIN_REST,type Circuit,type CircuitStep} from '@/lib/workout-coach';

const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,Math.floor(value)||low));
const summary=(c:Circuit)=>c.steps.map(s=>`${EXERCISES[s.kind].title} × ${s.target}`).join(', ');
/** Build a workout of several camera exercises. The camera moves through them with a rest between each. */
export function CircuitBuilder({disabled,onStart}:{disabled:boolean;onStart:(circuit:Circuit)=>void}){
 const [saved,setSaved]=useLocalState<Circuit[]>('trackcal:studio:circuits',[]),[name,setName]=useState(''),[rest,setRest]=useState(30),[steps,setSteps]=useState<CircuitStep[]>([]),[kind,setKind]=useState<ExerciseKind>('squat'),[reps,setReps]=useState(10);
 const row=(c:Circuit,own:boolean)=><div className="library-row" key={c.id}><div><strong>{c.name}</strong><small>{summary(c)} · {c.rest}s rest</small></div><button type="button" className="account-secondary" disabled={disabled} onClick={()=>onStart(c)}>Use {c.name}</button>{own&&<button type="button" className="account-secondary" onClick={()=>setSaved(all=>all.filter(item=>item.id!==c.id))}>Delete {c.name}</button>}</div>;
 return <details className="camera-settings"><summary>Workout builder</summary><p>Do several exercises in a row. Hit each target and the camera moves on by itself after a rest.</p>
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

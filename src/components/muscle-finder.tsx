import {useState} from 'react';
import Model,{type IExerciseData,type Muscle} from 'react-body-highlighter';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {Celebration} from './celebration';
import {CoachLine} from './coach-card';
import {cameraLink,exercisesFor,fromDiagram,type FinderFilters,type Found} from '@/lib/muscle-finder';
import {EXERCISE_DIFFICULTY,EXERCISE_EQUIPMENT,type ExerciseKind} from '@/lib/pose/types';
import {MUSCLE_LABELS,type MapMuscle} from '@/lib/training-insights';
import {targetFor} from '@/lib/workout-generator';
import {wellnessRequest,type Session} from '@/lib/wellness';

export function MuscleFinder(){const {ready,user}=useAccount();return !ready?<main className="account-loading">Opening the muscle picker…</main>:user?<Finder key={user.id}/>:<main className="account-page"><section className="account-card"><h1>Train the muscles you choose.</h1><p>Sign in, tap a muscle, and get exercises for it.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;}

/** Tap muscles on the body, get exercises that build them, then track with the camera or log by hand. */
function Finder(){
 const [selected,setSelected]=useState<MapMuscle[]>([]),[filters,setFilters]=useState<FinderFilters>({equipment:'any',level:'any'}),[picked,setPicked]=useState<string[]>([]),[logging,setLogging]=useState<string|null>(null);
 const toggle=(muscle:MapMuscle)=>setSelected(all=>all.includes(muscle)?all.filter(m=>m!==muscle):[...all,muscle]);
 const tap=(name:string)=>{const muscle=fromDiagram(name);if(muscle)toggle(muscle);};
 const data:IExerciseData[]=selected.length?[{name:'Chosen',muscles:selected as unknown as Muscle[]}]:[];
 const found=exercisesFor(selected,filters),chosen=found.filter(row=>picked.includes(row.id)&&row.kind);
 const steps=chosen.map(row=>({kind:row.kind as ExerciseKind,target:targetFor(row.kind as ExerciseKind,row.difficulty)}));
 return <main className="wellness-page muscle-page"><section className="camera-intro"><span className="eyebrow">TRAIN BY MUSCLE</span><h1>Which muscles today?</h1><p>Tap muscles on the body, or choose from the list. You get exercises that build them, main target first.</p></section>
  <div className="muscle-layout">
   <section className="account-card muscle-picker">
    <div className="muscle-bodies"><div><small>Front</small><Model data={data} type="anterior" highlightedColors={['#6d4ae8']} bodyColor="#d9d5e8" onClick={stats=>tap(stats.muscle)}/></div><div><small>Back</small><Model data={data} type="posterior" highlightedColors={['#6d4ae8']} bodyColor="#d9d5e8" onClick={stats=>tap(stats.muscle)}/></div></div>
    <div className="camera-equipment muscle-chips" role="group" aria-label="Muscles">{(Object.entries(MUSCLE_LABELS) as [MapMuscle,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={selected.includes(id)} onClick={()=>toggle(id)}>{label}</button>)}</div>
    {selected.length>0&&<button type="button" className="account-secondary" onClick={()=>{setSelected([]);setPicked([]);}}>Clear</button>}
   </section>
   <section className="account-card muscle-results">
    <div className="muscle-filters"><label>Equipment<select value={filters.equipment} onChange={e=>setFilters({...filters,equipment:e.target.value as FinderFilters['equipment']})}><option value="any">Any</option>{(Object.entries(EXERCISE_EQUIPMENT) as [string,string][]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
     <label>Level<select value={filters.level} onChange={e=>setFilters({...filters,level:e.target.value as FinderFilters['level']})}><option value="any">Any</option><option value="easy">Easy only</option><option value="medium">Up to medium</option><option value="hard">Up to hard</option></select></label></div>
    {!selected.length?<CoachLine text="Pick a muscle and I will find the right exercises."/>:!found.length?<p>Nothing matches these filters. Try any equipment or a higher level.</p>:<>
     <p role="status">{found.length} exercises for {selected.map(m=>MUSCLE_LABELS[m].toLowerCase()).join(', ')}.</p>
     {found.map(row=><article className="muscle-row" key={row.id} data-primary={row.primary||undefined}>
      <div><strong>{row.title}</strong>{row.primary&&<span className="muscle-badge">Main target</span>}<small>Works {row.muscles.toLowerCase()} · {EXERCISE_EQUIPMENT[row.equipment]} · {EXERCISE_DIFFICULTY[row.difficulty]}{row.hold?' · hold':''}</small></div>
      <div className="account-actions">
       <Link className="destination-button" href={row.kind?`/workouts/camera?exercise=${row.kind}`:`/workouts/holds?hold=${row.hold}`}>Track with camera</Link>
       <button type="button" className="account-secondary" aria-expanded={logging===row.id} onClick={()=>setLogging(value=>value===row.id?null:row.id)}>Log it myself</button>
       {row.kind&&<label className="muscle-add"><input type="checkbox" checked={picked.includes(row.id)} onChange={()=>setPicked(all=>all.includes(row.id)?all.filter(id=>id!==row.id):[...all,row.id])}/> Add to my workout</label>}
      </div>
      {logging===row.id&&<ManualLog row={row} onDone={()=>setLogging(null)}/>}
     </article>)}
    </>}
    <p className="rep-replay-note"><strong>Track with camera</strong> counts your reps on this device; no video leaves your phone. <strong>Log it myself</strong> saves the sets you type, with no camera at all.</p>
   </section>
  </div>
  {chosen.length>0&&<div className="muscle-tray" role="region" aria-label="Your workout"><span>{chosen.length} {chosen.length===1?'exercise':'exercises'}: {chosen.map(row=>row.title).join(', ')}</span><Link className="destination-button" href={cameraLink(steps)}>Track all with camera</Link></div>}
 </main>;
}

/** Saves what you did without the camera: sets of reps (or seconds for a hold), and how long it took. */
function ManualLog({row,onDone}:{row:Found;onDone:()=>void}){
 const [sets,setSets]=useState(3),[amount,setAmount]=useState(row.hold?30:10),[load,setLoad]=useState(0),[minutes,setMinutes]=useState(10),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<number|null>(null);
 const template=`camera_${row.kind??row.hold}`;
 async function save(){
  if(busy)return;setBusy(true);setError('');
  try{
   const id=crypto.randomUUID(),opened=await wellnessRequest<{session:Session}>('sessions',{id,name:`${row.title} · logged by hand`,exercises:[template]});
   const set=row.hold?{reps:0,load:0,minutes:Math.round(amount/60*100)/100}:{reps:amount,load,minutes:0};
   const done=await wellnessRequest<{awarded_xp:number}>('sessions/'+id,{revision:opened.session.revision,action:'complete',minutes,notes:`${sets} × ${amount}${row.hold?' s':' reps'}${load?` at ${load} kg`:''}, logged without the camera.`,exercises:[{exercise_id:template,sets:Array.from({length:sets},()=>set)}]},'PUT');
   setSaved(done.awarded_xp);
  }catch(failure){setError(failure instanceof Error?failure.message:'Could not save. Try again.');}
  finally{setBusy(false);}
 }
 if(saved!==null)return <div className="celebration-host"><Celebration/><CoachLine text={`${row.title} saved${saved?`, +${saved} points`:''}. Nice work!`}/><button type="button" onClick={onDone}>Close</button></div>;
 return <form className="manual-log" onSubmit={e=>{e.preventDefault();void save();}}>
  <label>Sets<input type="number" min={1} max={20} value={sets} onChange={e=>setSets(Math.max(1,Math.min(20,Math.floor(Number(e.target.value))||1)))}/></label>
  <label>{row.hold?'Seconds each':'Reps each'}<input type="number" min={1} max={row.hold?600:100} value={amount} onChange={e=>setAmount(Math.max(1,Math.min(row.hold?600:100,Math.floor(Number(e.target.value))||1)))}/></label>
  {row.equipment==='weights'&&!row.hold&&<label>Weight (kg)<input type="number" min={0} max={500} step={0.5} value={load} onChange={e=>setLoad(Math.max(0,Math.min(500,Number(e.target.value)||0)))}/></label>}
  <label>Minutes<input type="number" min={1} max={180} value={minutes} onChange={e=>setMinutes(Math.max(1,Math.min(180,Math.floor(Number(e.target.value))||1)))}/></label>
  <button type="submit" className="account-primary" disabled={busy}>{busy?'Saving…':'Save'}</button>
  {error&&<p role="alert" className="camera-alert">{error}</p>}
 </form>;
}

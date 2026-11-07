import {useMemo,useState} from 'react';
import Model,{type IExerciseData,type Muscle} from 'react-body-highlighter';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {Celebration} from './celebration';
import {CoachLine} from './coach-card';
import {MoveDemo,MoveThumb} from './exercise-demo';
import {MUSCLE_CATEGORIES,cameraLink,dailyPackage,exercisesFor,fromDiagram,todaysCategory,type FinderFilters,type Found,type MuscleCategory} from '@/lib/muscle-finder';
import {MOVES} from '@/lib/pose/exercise-motions';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {HOLDS} from '@/lib/pose/holds';
import {EXERCISES,EXERCISE_DIFFICULTY,EXERCISE_EQUIPMENT,gearOf,type ExerciseKind} from '@/lib/pose/types';
import {MUSCLE_LABELS,type MapMuscle} from '@/lib/training-insights';
import {useLocalDate} from '@/lib/use-local-state';
import {targetFor} from '@/lib/workout-generator';
import {wellnessRequest,type Session} from '@/lib/wellness';

export function MuscleFinder(){const {ready,user}=useAccount();return !ready?<main className="account-loading">Opening the muscle picker…</main>:user?<Finder key={user.id}/>:<main className="account-page"><section className="account-card"><h1>Train the muscles you choose.</h1><p>Sign in, tap a muscle, and get exercises for it.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;}

const weightsOf=(kind:ExerciseKind)=>['dumbbell','barbell','kettlebell'].includes(gearOf(kind));
/** The little moving picture for any exercise or hold. */
function Thumb({row}:{row:{kind:ExerciseKind|null;hold:keyof typeof HOLDS|null;title:string}}){
 const move=row.kind?MOVES[row.kind]:HOLDS[row.hold!].move;
 return <span className="exercise-demo move-thumb-box"><MoveThumb move={move} weights={row.kind?weightsOf(row.kind):false} title={row.title}/></span>;
}

/** Tap muscles or pick a group, see each exercise move, then follow a daily package or choose your own. */
function Finder(){
 const date=useLocalDate(),today=todaysCategory(new Date());
 const [selected,setSelected]=useState<MapMuscle[]>([]),[category,setCategory]=useState<MuscleCategory|null>(null),[shuffle,setShuffle]=useState(''),[filters,setFilters]=useState<FinderFilters>({equipment:'any',level:'any'}),[picked,setPicked]=useState<string[]>([]),[logging,setLogging]=useState<string|null>(null),[watching,setWatching]=useState<string|null>(null),[planLevel,setPlanLevel]=useState<'easy'|'medium'|'hard'>('easy');
 const toggle=(muscle:MapMuscle)=>{setCategory(null);setSelected(all=>all.includes(muscle)?all.filter(m=>m!==muscle):[...all,muscle]);};
 const tap=(name:string)=>{const muscle=fromDiagram(name);if(muscle)toggle(muscle);};
 const chooseGroup=(next:MuscleCategory)=>{setCategory(next);setShuffle('');setSelected(next.muscles);setPicked([]);};
 const data:IExerciseData[]=selected.length?[{name:'Chosen',muscles:selected as unknown as Muscle[]}]:[];
 const found=exercisesFor(selected,filters),chosen=found.filter(row=>picked.includes(row.id)&&row.kind);
 const steps=chosen.map(row=>({kind:row.kind as ExerciseKind,target:targetFor(row.kind as ExerciseKind,row.difficulty)}));
 const plan=useMemo(()=>category?dailyPackage(category,{equipment:filters.equipment,level:planLevel},shuffle||`${date}:${category.id}:${planLevel}`,5,targetFor):[],[category,filters.equipment,planLevel,shuffle,date]);
 const suggested=MUSCLE_CATEGORIES.find(c=>c.id===today);
 return <main className="wellness-page muscle-page"><section className="camera-intro"><span className="eyebrow">TRAIN BY MUSCLE</span><h1>Which muscles today?</h1><p>Pick a muscle group for a ready-made workout, or tap muscles on the body. Every exercise shows how it is done.</p></section>

  <section className="account-card muscle-groups"><h2>Muscle groups</h2>
   <p className="muscle-today">{suggested?<>Today&apos;s suggestion: <strong>{suggested.label} day</strong>. <button type="button" className="account-secondary" onClick={()=>chooseGroup(suggested)}>Show {suggested.label.toLowerCase()} workout</button></>:<>Today is a <strong>rest day</strong> in the weekly plan. <Link href="/workouts/holds">Try gentle stretches and balance holds →</Link></>}</p>
   <div className="group-grid" role="group" aria-label="Muscle groups">{MUSCLE_CATEGORIES.map(c=><button key={c.id} type="button" aria-pressed={category?.id===c.id} onClick={()=>chooseGroup(c)}><strong>{c.label}</strong><small>{c.hint}</small></button>)}<Link className="group-link" href="/workouts/holds"><strong>Mobility &amp; balance</strong><small>Stretches and holds</small></Link></div>
   {category&&<div className="day-plan" aria-live="polite">
    <h3>{shuffle?'Shuffled':'Today’s standard'} {category.label.toLowerCase()} workout</h3>
    <div className="camera-equipment" role="group" aria-label="Plan level">{([['easy','Beginner'],['medium','Intermediate'],['hard','Advanced']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={planLevel===id} onClick={()=>{setPlanLevel(id);setShuffle('');}}>{label}</button>)}</div>
    {plan.length?<><ol>{plan.map(step=><li key={step.kind}><Thumb row={{kind:step.kind,hold:null,title:EXERCISES[step.kind].title}}/><div><strong>{EXERCISES[step.kind].title}</strong><small>{step.target} reps · {EXERCISE_DIFFICULTY[EXERCISES[step.kind].difficulty]}</small></div></li>)}</ol>
     <div className="account-actions"><Link className="account-primary" href={cameraLink(plan)}>Start with camera</Link><button type="button" onClick={()=>setShuffle(String(Date.now()))}>Shuffle</button>{shuffle&&<button type="button" onClick={()=>setShuffle('')}>Back to standard</button>}</div>
     <p className="rep-replay-note">The standard plan is the same all day, so you can come back to it. The camera counts each exercise in turn, with a short rest between, and nothing leaves your device.</p></>
    :<p>No exercises fit these filters. Try any equipment or a higher level below.</p>}
   </div>}
  </section>

  <div className="muscle-layout">
   <section className="account-card muscle-picker"><h2>Or pick muscles</h2>
    <div className="muscle-bodies"><div><small>Front</small><Model data={data} type="anterior" highlightedColors={['#6d4ae8']} bodyColor="#d9d5e8" onClick={stats=>tap(stats.muscle)}/></div><div><small>Back</small><Model data={data} type="posterior" highlightedColors={['#6d4ae8']} bodyColor="#d9d5e8" onClick={stats=>tap(stats.muscle)}/></div></div>
    <div className="camera-equipment muscle-chips" role="group" aria-label="Muscles">{(Object.entries(MUSCLE_LABELS) as [MapMuscle,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={selected.includes(id)} onClick={()=>toggle(id)}>{label}</button>)}</div>
    {selected.length>0&&<button type="button" className="account-secondary" onClick={()=>{setSelected([]);setPicked([]);setCategory(null);}}>Clear</button>}
   </section>
   <section className="account-card muscle-results">
    <div className="muscle-filters"><label>Equipment<select value={filters.equipment} onChange={e=>setFilters({...filters,equipment:e.target.value as FinderFilters['equipment']})}><option value="any">Any</option>{(Object.entries(EXERCISE_EQUIPMENT) as [string,string][]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
     <label>Level<select value={filters.level} onChange={e=>setFilters({...filters,level:e.target.value as FinderFilters['level']})}><option value="any">Any</option><option value="easy">Beginner (easy only)</option><option value="medium">Up to medium</option><option value="hard">Up to hard</option></select></label></div>
    {!selected.length?<CoachLine text="Pick a muscle group above, or tap the body, and I will show you how each exercise is done."/>:!found.length?<p>Nothing matches these filters. Try any equipment or a higher level.</p>:<>
     <p role="status">{found.length} exercises for {selected.map(m=>MUSCLE_LABELS[m].toLowerCase()).join(', ')}.</p>
     {found.map(row=><article className="muscle-row" key={row.id} data-primary={row.primary||undefined}>
      <div className="muscle-row-head"><Thumb row={row}/><div><strong>{row.title}</strong>{row.primary&&<span className="muscle-badge">Main target</span>}{row.difficulty==='easy'&&<span className="muscle-badge muscle-badge-easy">Beginner-friendly</span>}<small>Works {row.muscles.toLowerCase()} · {EXERCISE_EQUIPMENT[row.equipment]} · {EXERCISE_DIFFICULTY[row.difficulty]}{row.hold?' · hold':''}</small></div></div>
      {watching===row.id&&(row.kind?<MoveDemo move={MOVES[row.kind]} gear={gearOf(row.kind)} title={row.title} cues={EXERCISE_CONFIG[row.kind].cues}/>:<MoveDemo move={HOLDS[row.hold!].move} gear="body" title={row.title} cues={[HOLDS[row.hold!].cue]}/>)}
      <div className="account-actions">
       <Link className="destination-button" href={row.kind?`/workouts/camera?exercise=${row.kind}`:`/workouts/holds?hold=${row.hold}`}>Track with camera</Link>
       <button type="button" className="account-secondary" aria-expanded={watching===row.id} onClick={()=>setWatching(value=>value===row.id?null:row.id)}>{watching===row.id?'Hide 3D':'Watch in 3D'}</button>
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

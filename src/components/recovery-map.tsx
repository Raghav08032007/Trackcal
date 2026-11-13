import {RecoveryOverview} from '@/components/recovery-checkin';
import {useEffect,useMemo,useState} from 'react';
import Model,{type IExerciseData,type Muscle} from 'react-body-highlighter';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {CoachLine} from './coach-card';
import {EXERCISES} from '@/lib/pose/types';
import {MUSCLE_LABELS,movesFrom,muscleStates,readyToProgress,restedChoice,type MapMuscle,type MuscleState} from '@/lib/training-insights';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

const COLORS=['#f7d774','#f5a524','#e5484d'];
const LEVELS:{state:Exclude<MuscleState,'ready'>;label:string;frequency:number}[]=[{state:'worked',label:'Worked today',frequency:3},{state:'recovering',label:'Recovering',frequency:2},{state:'nearly',label:'Nearly ready',frequency:1}];

export function RecoveryMap(){const {user,ready}=useAccount();return !ready?<main className="account-loading">Opening your recovery map…</main>:user?<Map key={user.id}/>:<main className="account-page"><section className="account-card"><h1>See which muscles are ready.</h1><p>Sign in and your camera workouts fill in this map by themselves.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;}

function Map(){
 const [training,setTraining]=useState<TrainingData|null>(null),[error,setError]=useState(''),[now]=useState(()=>Date.now());
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setTraining(data);}).catch(()=>{if(live)setError('Your workouts could not be loaded. Try again shortly.');});return()=>{live=false;};},[]);
 const moves=useMemo(()=>movesFrom(training?.sessions??[]),[training]),states=useMemo(()=>muscleStates(moves,now),[moves,now]);
 const names=(state:MuscleState)=>[...states].filter(([,value])=>value===state).map(([muscle])=>muscle);
 const data:IExerciseData[]=LEVELS.map(({state,frequency})=>({name:state,frequency,muscles:names(state) as unknown as Muscle[]})).filter(row=>row.muscles.length);
 const choice=restedChoice(states),steps=readyToProgress(moves);
 return <main className="wellness-page recovery-page"><section className="camera-intro"><span className="eyebrow">FILLED IN BY YOUR REPS</span><h1>Recovery map</h1><p>Muscles you worked with the camera, fading over three days. This is a common rule of thumb, not a reading of your body, so go by how you feel.</p></section><RecoveryOverview/>
  {error&&<p role="alert" className="camera-alert">{error}</p>}
  {!training&&!error&&<p role="status">Loading your workouts…</p>}
  {training&&<>
   <CoachLine text={moves.length?(steps.length?'You have earned a harder move. Take a look below.':'Here is what your body has been up to.'):'Save a camera workout and I will fill this in for you.'}/>
   <section className="account-card"><div className="recovery-bodies" aria-hidden="true"><Model data={data} type="anterior" highlightedColors={COLORS} bodyColor="#c5dede"/><Model data={data} type="posterior" highlightedColors={COLORS} bodyColor="#c5dede"/></div>
    {moves.length===0?<p>Nothing here yet. Save a camera workout and your muscles light up by themselves.</p>:<ul className="recovery-legend">{LEVELS.map(({state,label},index)=>{const list=names(state);return <li key={state}><span style={{background:COLORS[2-index]}}/><strong>{label}</strong> {list.length?list.map(muscle=>MUSCLE_LABELS[muscle as MapMuscle]).join(', '):'None'}</li>;})}</ul>}
   </section>
   {choice&&<section className="account-card"><h2>Good for today</h2><p><strong>{EXERCISES[choice].title}</strong> works {EXERCISES[choice].muscles.toLowerCase()}{states.size?' and leaves your tired muscles alone':''}.</p><Link className="destination-button" href={`/workouts/camera?exercise=${choice}`}>Start {EXERCISES[choice].title}</Link></section>}
   {steps.length>0&&<section className="account-card"><h2>Ready for harder</h2>{steps.map(step=><div className="library-row" key={step.from}><div><strong>{EXERCISES[step.to].title}</strong><small>You did {step.reps} {EXERCISES[step.from].title.toLowerCase()} the camera saw.</small></div><Link className="destination-button" href={`/workouts/camera?exercise=${step.to}`}>Try {EXERCISES[step.to].title}</Link></div>)}</section>}
  </>}
 </main>;
}

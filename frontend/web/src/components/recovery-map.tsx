import { t, msg } from "@/lib/i18n";
import {RecoveryOverview} from '@/components/recovery-checkin';
import {useEffect,useMemo,useState} from 'react';
import Model,{type IExerciseData,type Muscle} from 'react-body-highlighter';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {CoachLine} from './coach-card';
import {EXERCISES} from '@/lib/pose/types';
import {WatchHow} from './exercise-demo';
import {movesFrom,readyToProgress,type MuscleState} from '@/lib/training-insights';
import {RECOVERY_NOTE,dosesOf,freshExercises,readiness,recovery} from '@/lib/muscle-recovery';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

const COLORS=['#f7d774','#f5a524','#e5484d'];
const LEVELS:{state:Exclude<MuscleState,'ready'>;label:string;frequency:number}[]=[{state:'worked',label:msg("Worked today"),frequency:3},{state:'recovering',label:msg("Recovering"),frequency:2},{state:'nearly',label:msg("Nearly ready"),frequency:1}];

export function RecoveryMap(){const {user,ready}=useAccount();return !ready?<main className="account-loading">{t("Opening your recovery map…")}</main>:user?<Map key={user.id}/>:<main className="account-page"><section className="account-card"><h1>{t("See which muscles are ready.")}</h1><p>{t("Sign in and your camera workouts fill in this map by themselves.")}</p><div className="gate-actions"><Link className="gate-primary" href="/login">{t("Sign in")}</Link></div></section></main>;}

function Map(){
 const [training,setTraining]=useState<TrainingData|null>(null),[error,setError]=useState(''),[now]=useState(()=>Date.now());
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setTraining(data);}).catch(()=>{if(live)setError(t("Your workouts could not be loaded. Try again shortly."));});return()=>{live=false;};},[]);
 const moves=useMemo(()=>movesFrom(training?.sessions??[]),[training]),doses=useMemo(()=>(training?.sessions??[]).flatMap(dosesOf),[training]);
 const list=useMemo(()=>recovery(doses,now),[doses,now]),score=readiness(list,now),trained=list.filter(m=>m.lastWorked!==null);
 const names=(state:MuscleState)=>list.filter(m=>m.state===state).map(m=>m.muscle);
 const data:IExerciseData[]=LEVELS.map(({state,frequency})=>({name:state,frequency,muscles:names(state) as unknown as Muscle[]})).filter(row=>row.muscles.length);
 const choice=freshExercises(list)[0]??null,tired=list.some(m=>m.percent<85),steps=readyToProgress(moves);
 return <main className="wellness-page recovery-page"><section className="camera-intro"><span className="eyebrow">{t("FILLED IN BY YOUR TRAINING")}</span><h1>{t("Recovery map")}</h1><p>{t("How recovered each muscle is, from everything you save: camera workouts, sets you log, holds, yoga and runs. Harder sessions take longer to recover from.")}</p></section><RecoveryOverview/>
  {error&&<p role="alert" className="camera-alert">{error}</p>}
  {!training&&!error&&<p role="status">{t("Loading your workouts…")}</p>}
  {training&&<>
   <CoachLine text={doses.length?(steps.length?t("You have earned a harder move. Take a look below."):t("Here is what your body has been up to.")):t("Save a camera workout and I will fill this in for you.")}/>
   {doses.length>0&&<section className="account-card recovery-score" data-band={score>=85?'good':score>=60?'ok':'low'}><div><strong>{score}</strong><small>/100</small></div><p><b>{t("Readiness")}</b> {score>=85?t("Fresh: a good day for a hard session."):score>=60?t("Partly recovered: train the fresh muscles, or go easy."):t("Tired: a light day, yoga or a walk would suit you.")}</p></section>}
   <section className="account-card"><div className="recovery-bodies" aria-hidden="true"><Model data={data} type="anterior" highlightedColors={COLORS} bodyColor="#c5dede"/><Model data={data} type="posterior" highlightedColors={COLORS} bodyColor="#c5dede"/></div>
    {doses.length===0?<p>{t("Nothing here yet. Save a camera workout and your muscles light up by themselves.")}</p>:<ul className="recovery-legend">{LEVELS.map(({state,label},index)=>{const list=names(state);return <li key={state}><span style={{background:COLORS[2-index]}}/><strong>{t(label)}</strong> {list.length?list.map(muscle=>trained.find(m=>m.muscle===muscle)?.label??muscle).join(', '):t("None")}</li>;})}</ul>}
    {trained.length>0&&<ul className="recovery-bars">{trained.map(m=><li key={m.muscle}><span>{m.label}</span><span className="recovery-bar" data-state={m.state}><i style={{width:`${m.percent}%`}}/></span><strong>{m.percent}%</strong><small>{m.readyInHours?t("ready in about {h} h",{h:m.readyInHours}):t("ready")}</small></li>)}</ul>}
    <p className="rep-replay-note">{t(RECOVERY_NOTE)}</p>
   </section>
   {choice&&<section className="account-card"><h2>{t("Good for today")}</h2><p>{tired?t("{title} works {muscles} and leaves your tired muscles alone.",{title:EXERCISES[choice].title,muscles:EXERCISES[choice].muscles.toLowerCase()}):t("{title} works {muscles}.",{title:EXERCISES[choice].title,muscles:EXERCISES[choice].muscles.toLowerCase()})}</p><Link className="destination-button" href={`/workouts/camera?exercise=${choice}`}>{t("Start {title}", { title: EXERCISES[choice].title })}</Link><WatchHow kind={choice}/></section>}
   {steps.length>0&&<section className="account-card"><h2>{t("Ready for harder")}</h2>{steps.map(step=><div className="library-row" key={step.from}><div><strong>{EXERCISES[step.to].title}</strong><small>{t("You did {reps} {n} the camera saw.", { reps: step.reps, n: EXERCISES[step.from].title.toLowerCase() })}</small></div><Link className="destination-button" href={`/workouts/camera?exercise=${step.to}`}>{t("Try {title}", { title: EXERCISES[step.to].title })}</Link><WatchHow kind={step.to}/></div>)}</section>}
  </>}
 </main>;
}

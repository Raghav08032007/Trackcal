import { t, msg } from "@/lib/i18n";
import {useCheckins} from "@/lib/days";
import {useEffect,useState} from 'react';
import Link from '@/lib/navigation';
import {useWorkspaceScope} from './account-session';
import {firstSteps} from '@/lib/coach';
import {movesFrom} from '@/lib/training-insights';
import {exportLocalEntries} from '@/lib/use-local-state';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

const SHORTCUTS=[['/recovery',msg('Recovery map')],['/programs',msg('Programs')],['/progress',msg('Your week')],['/menu',msg('Menu picker')]] as const;

/** Gets a new person to their first scan and workout, then steps aside for shortcuts. */
export function FirstSteps(){
 const scope=useWorkspaceScope(),[checkins]=useCheckins(),[workouts,setWorkouts]=useState<number|null>(null),[anyMeal,setAnyMeal]=useState(false);
 // The account diary's recent meals cover every day, so a meal logged on any screen or device ticks the first step.
 useEffect(()=>{let live=true;const check=()=>wellnessRequest<{recent?:unknown[];entries?:unknown[]}>('diary?limit=1').then(d=>{if(live)setAnyMeal(!!(d.recent?.length||d.entries?.length));}).catch(()=>{});void check();window.addEventListener('trackcal-diary',check);return()=>{live=false;window.removeEventListener('trackcal-diary',check);};},[]);
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setWorkouts(movesFrom(data.sessions??[]).length);}).catch(()=>{if(live)setWorkouts(0);});return()=>{live=false;};},[]);
 if(workouts===null)return null;
 const saved=Object.entries(exportLocalEntries(scope) as Record<string,unknown>);
 const steps=firstSteps({meals:anyMeal||saved.some(([key,value])=>key.startsWith('trackcal:journal:')&&Array.isArray(value)&&value.length>0),workouts,checkedIn:checkins.length>0});
 const done=steps.filter(step=>step.done).length;
 if(done===steps.length)return <nav className="home-shortcuts" aria-label={t("Shortcuts")}>{SHORTCUTS.map(([href,label])=><Link key={href} href={href}>{t(label)}</Link>)}</nav>;
 return <section className="first-steps" aria-label={t("Your first steps")}><p><strong>{done?t("{done} of {total} done. Keep going!", { done, total: steps.length }):t("Three small steps and you are set up.")}</strong></p>
  <div className="first-steps-meter" role="progressbar" aria-label={t("First steps done")} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><span style={{width:`${done/steps.length*100}%`}}/></div>
  <ol>{steps.map(step=><li key={step.href} data-done={step.done||undefined}>{step.done?<span>{t(step.label)}</span>:<Link href={step.href}>{t(step.label)}</Link>}</li>)}</ol>
 </section>;
}

import {useEffect,useState} from 'react';
import Link from '@/lib/navigation';
import {useWorkspaceScope} from './account-session';
import {firstSteps} from '@/lib/coach';
import {movesFrom} from '@/lib/training-insights';
import {exportLocalEntries} from '@/lib/use-local-state';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

const SHORTCUTS=[['/recovery','Recovery map'],['/programs','Programs'],['/progress','Your week'],['/menu','Menu picker']] as const;

/** Gets a new person to their first scan and workout, then steps aside for shortcuts. */
export function FirstSteps(){
 const scope=useWorkspaceScope(),[workouts,setWorkouts]=useState<number|null>(null);
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setWorkouts(movesFrom(data.sessions??[]).length);}).catch(()=>{if(live)setWorkouts(0);});return()=>{live=false;};},[]);
 if(workouts===null)return null;
 const saved=Object.entries(exportLocalEntries(scope) as Record<string,unknown>);
 const steps=firstSteps({meals:saved.some(([key,value])=>key.startsWith('trackcal:journal:')&&Array.isArray(value)&&value.length>0),workouts,checkedIn:saved.some(([key,value])=>key==='trackcal:studio:checkins'&&Array.isArray(value)&&value.length>0)});
 const done=steps.filter(step=>step.done).length;
 if(done===steps.length)return <nav className="home-shortcuts" aria-label="Shortcuts">{SHORTCUTS.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>;
 return <section className="first-steps" aria-label="Your first steps"><p><strong>{done?`${done} of ${steps.length} done. Keep going!`:'Three small steps and you are set up.'}</strong></p>
  <div className="first-steps-meter" role="progressbar" aria-label="First steps done" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><span style={{width:`${done/steps.length*100}%`}}/></div>
  <ol>{steps.map(step=><li key={step.href} data-done={step.done||undefined}>{step.done?<span>{step.label}</span>:<Link href={step.href}>{step.label}</Link>}</li>)}</ol>
 </section>;
}

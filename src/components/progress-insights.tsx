import {useActiveDays} from "@/lib/workouts";
import {useCheckins,useRecentDays} from "@/lib/days";
import {useEffect,useMemo,useState} from 'react';
import {useWorkspaceScope} from './account-session';
import {dayMarks,habitLabel,habitScore,progressSeries,trainingLoad,workoutDays,type ProgressSeries} from '@/lib/progress-insights';
import {exportLocalEntries} from '@/lib/use-local-state';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

/** A small line chart. Values only, so it reads the same in light and dark themes. */
function Line({values,label,color='#07807a'}:{values:number[];label:string;color?:string}){
 if(values.length<2)return null;
 const max=Math.max(...values),min=Math.min(...values),span=max-min||1,points=values.map((v,i)=>`${(i/(values.length-1)*100).toFixed(2)},${(36-(v-min)/span*32).toFixed(2)}`).join(' ');
 return <svg className="insight-line" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}><polyline points={points} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/></svg>;
}

/** Habit strength, training load and progress for each exercise, from one load of your workouts. */
export function ProgressInsights(){
 const scope=useWorkspaceScope(),[checkins]=useCheckins(),activeDays=useActiveDays(),{days:recentDays}=useRecentDays(),[training,setTraining]=useState<TrainingData|null>(null),[now]=useState(()=>Date.now()),[picked,setPicked]=useState('');
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setTraining(data);}).catch(()=>{});return()=>{live=false;};},[]);
 const view=useMemo(()=>{
  if(!training)return null;
  const saved=Object.entries(exportLocalEntries(scope) as Record<string,unknown>),sessions=training.sessions??[];
  // Signed in, meal days come from the account diary; signed out, from this browser's journal.
  const ate=new Set(recentDays?recentDays.filter(d=>(d.meals??0)>0).map(d=>d.day):saved.flatMap(([key,value])=>{const day=/^trackcal:journal:(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];return day&&Array.isArray(value)&&value.length?[day]:[];}));
  const checked=new Set(checkins.map(row=>row.date));
  const habits=[['Move',new Set([...workoutDays(sessions),...activeDays])],['Log food',ate],['Check in',checked]] as const;
  return {habits:habits.map(([name,days])=>({name,score:habitScore(dayMarks(days as Set<string>,now))})),load:trainingLoad(sessions,now),series:progressSeries(sessions)};
 },[training,scope,now,checkins,recentDays,activeDays]);
 if(!view)return null;
 const chosen:ProgressSeries|undefined=view.series.find(s=>s.key===picked)??view.series[0],recent=view.load.series.slice(-42);
 return <>
  <section className="account-card insight-card"><h2>Habit strength</h2><p>Each day you keep a habit makes it stronger. A missed day costs a little, not everything.</p>
   <ul className="habit-list">{view.habits.map(h=><li key={h.name}><span>{h.name}</span><div className="habit-meter" role="meter" aria-label={`${h.name} habit strength`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={h.score}><span style={{width:`${h.score}%`}}/></div><strong>{h.score}</strong><small>{habitLabel(h.score)}</small></li>)}</ul>
  </section>
  <section className="account-card insight-card"><h2>Training load</h2><p>{view.load.note}</p>
   <ul className="weekly-stats"><li><strong>{view.load.today.fitness}</strong> fitness</li><li><strong>{view.load.today.fatigue}</strong> fatigue</li><li><strong>{view.load.today.form>0?'+':''}{view.load.today.form}</strong> form</li></ul>
   <div className="insight-legend"><span className="key-fitness">Fitness</span><span className="key-fatigue">Fatigue</span></div>
   <div className="insight-stack"><Line values={recent.map(d=>d.fitness)} label="Fitness over the last six weeks"/><Line values={recent.map(d=>d.fatigue)} label="Fatigue over the last six weeks" color="#f5a524"/></div>
   <p className="rep-replay-note">Worked out from minutes moved. A guide to balancing hard and easy days, not a medical measure.</p>
  </section>
  <section className="account-card insight-card"><h2>Progress by exercise</h2>
   {!chosen?<p>Save a few workouts and your best for each exercise appears here.</p>:<>
    <label>Exercise<select value={chosen.key} onChange={e=>setPicked(e.target.value)}>{view.series.map(s=><option key={s.key} value={s.key}>{s.title} ({s.points.length})</option>)}</select></label>
    <p className="insight-best">First {chosen.points[0].value} {chosen.unit}, best {Math.max(...chosen.points.map(p=>p.value))} {chosen.unit}{chosen.points.length>1?`, latest ${chosen.points[chosen.points.length-1].value} ${chosen.unit}`:''}.</p>
    {chosen.points.length>1?<Line values={chosen.points.map(p=>p.value)} label={`${chosen.title} best per session`}/>:<p className="rep-replay-note">One more session and a chart appears.</p>}
   </>}
  </section>
 </>;
}

import {useEffect,useMemo,useState} from 'react';
import {useWorkspaceScope} from './account-session';
import type {MealLog} from './journal-tools';
import {weeklyReview} from '@/lib/fitness-plans';
import {personalRequest,type PersonalState} from '@/lib/personalization';
import {exportLocalEntries} from '@/lib/use-local-state';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

/** The last seven days at a glance, worked out from your own records. */
export function WeeklyReview(){
 const scope=useWorkspaceScope(),[training,setTraining]=useState<TrainingData|null>(null),[minor,setMinor]=useState(true),[now]=useState(()=>Date.now());
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setTraining(data);}).catch(()=>{});personalRequest<PersonalState>('state').then(state=>{if(live)setMinor(!!state.minor_account);}).catch(()=>{});return()=>{live=false;};},[]);
 const review=useMemo(()=>{
  const meals=Object.entries(exportLocalEntries(scope) as Record<string,unknown>).flatMap(([key,value])=>{const date=/^trackcal:journal:(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];return date&&Array.isArray(value)?[{date,calories:(value as MealLog[]).reduce((total,meal)=>total+(meal.calories||0),0)}]:[];});
  return weeklyReview(training?.sessions??[],meals,now);
 },[scope,training,now]);
 if(!training)return null;
 const most=Math.max(1,...review.bars.map(bar=>bar.minutes));
 return <section className="account-card weekly-review"><h2>Your week</h2><p>{review.nudge}</p>
  <ul className="weekly-stats"><li><strong>{review.workouts}</strong> workouts</li><li><strong>{review.reps}</strong> reps</li><li><strong>{review.activeDays}/7</strong> active days</li>{!minor&&review.averageCalories!==null&&<li><strong>{review.averageCalories}</strong> kcal a logged day</li>}</ul>
  <div className="weekly-bars" role="img" aria-label={`Minutes moved each day: ${review.bars.map(bar=>bar.minutes).join(', ')}`}>{review.bars.map(bar=><span key={bar.day} style={{height:`${Math.max(4,bar.minutes/most*100)}%`}}/>)}</div>
 </section>;
}

import { t } from "@/lib/i18n";
import { useActiveDays, useProgramDays } from "@/lib/workouts";
import { useBurn, useCheckins } from "@/lib/days";
import {useEffect,useState} from 'react';
import { useTarget } from "@/lib/targets";
import { useDiaryMeals } from "@/lib/diary";
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {companions} from './character-companion';

import {adventureRequest,type AdventureSummary} from '@/lib/adventure';
import {coachCharacter,foodStep,moveStep,streakDays,type Checkin,type CoachDay} from '@/lib/coach';
import {nextProgramDay,PROGRAMS} from '@/lib/fitness-plans';
import {personalRequest,type PersonalState} from '@/lib/personalization';
import {movesFrom,muscleStates,restedChoice} from '@/lib/training-insights';
import {useLocalDate} from '@/lib/use-local-state';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';
import {earnedBack} from '@/lib/workout-coach';

export function useCoachCharacter(){
 const {user}=useAccount(),[id,setId]=useState<string|null>('pip');
 useEffect(()=>{if(!user)return;let live=true;adventureRequest<AdventureSummary>('summary').then(summary=>{if(live)setId(coachCharacter(summary));}).catch(()=>{});return()=>{live=false;};},[user]);
 const found=companions.find(item=>item.id===id);
 return id&&found?{id,name:found.name,trait:found.trait,hello:found.hello,cheer:found.cheer}:null;
}

/** Your character saying one thing, on any page. */
export function CoachLine({text}:{text:string}){
 const coach=useCoachCharacter();
 if(!coach)return <p>{text}</p>;
 return <div className="coach-line"><img src={`/characters/${coach.id}-256.webp`} alt="" width={48} height={48}/><p><strong>{coach.name}</strong> {text}</p></div>;
}

export function useCoachDay():CoachDay|null{
 const date=useLocalDate(),[training,setTraining]=useState<TrainingData|null>(null),[state,setState]=useState<PersonalState|null>(null),[loaded,setLoaded]=useState(false);
 const activeDays=useActiveDays(),[target]=useTarget("calories"),[proteinTarget]=useTarget("protein"),[burned]=useBurn(date),[meals]=useDiaryMeals(date),[done]=useProgramDays(),[checkins]=useCheckins();
 useEffect(()=>{let live=true;Promise.allSettled([wellnessRequest<TrainingData>('training'),personalRequest<PersonalState>('state')]).then(([work,person])=>{if(!live)return;if(work.status==='fulfilled')setTraining(work.value);if(person.status==='fulfilled')setState(person.value);setLoaded(true);});return()=>{live=false;};},[]);
 if(!loaded)return null;
 const now=Date.now(),moves=movesFrom(training?.sessions??[]),program=PROGRAMS.find(row=>done.some(id=>id.startsWith(row.id+':'))&&nextProgramDay(row,done)!==null);
 return {diet:state?.preferences?.diet,hour:new Date(now).getHours(),minor:state?!!state.minor_account:true,meals:meals.length,caloriesLeft:target+earnedBack(burned)-meals.reduce((total,meal)=>total+meal.calories,0),proteinEaten:meals.reduce((total,meal)=>total+(meal.protein||0),0),proteinTarget,program:program?.name??null,rested:restedChoice(muscleStates(moves,now)),streak:streakDays(moves,now,activeDays),checkin:checkins.find(row=>row.date===date)??null};
}

function CheckinButtons(){
 const date=useLocalDate(),[,setCheckins]=useCheckins(),[energy,setEnergy]=useState<Checkin['energy']|null>(null);
 const save=(sore:Checkin['sore'])=>{try{navigator.vibrate?.(30);}catch{/* not supported */}setCheckins(all=>[...all.filter(row=>row.date!==date),{date,energy:energy!,sore}].slice(-30));};
 return <div className="coach-checkin">{!energy?<><span id="coach-energy">{t("How is your energy today?")}</span><div className="account-actions" role="group" aria-labelledby="coach-energy"><button type="button" onClick={()=>setEnergy('low')}>{t("Low")}</button><button type="button" onClick={()=>setEnergy('ok')}>{t("Okay")}</button><button type="button" onClick={()=>setEnergy('great')}>{t("Great")}</button></div></>:<><span id="coach-sore">{t("Any soreness?")}</span><div className="account-actions" role="group" aria-labelledby="coach-sore"><button type="button" onClick={()=>save('no')}>{t("None")}</button><button type="button" onClick={()=>save('bit')}>{t("A bit")}</button><button type="button" onClick={()=>save('very')}>{t("Very sore")}</button></div></>}</div>;
}

/** The daily plan from your character. It runs on the device, with no AI and no data sent anywhere. */
export function CoachCard({compact=false}:{compact?:boolean}){
 const coach=useCoachCharacter(),day=useCoachDay(),date=useLocalDate(),[checkins]=useCheckins();
 // While the plan loads, hold its place with the same shape (check-ins live on this device, so whether the buttons show is
 // known at once): nothing below jumps when it arrives (Phase I: layout shift).
 if(!day)return <section className="coach-card coach-card-loading" aria-busy="true" aria-label={t("Loading your plan for today")}>
  {coach&&<img className="coach-avatar" src={`/characters/${coach.id}-256.webp`} alt="" width={72} height={72} fetchPriority="high"/>}
  <div className="coach-bubble"><span className="eyebrow">{coach?t("{name}, YOUR COACH", { name: coach.name.toUpperCase() }):t("YOUR PLAN TODAY")}</span>
   {!checkins.some(row=>row.date===date)&&<div className="coach-checkin" aria-hidden="true"><span>&nbsp;</span><div className="account-actions"><span className="skeleton-pill"/><span className="skeleton-pill"/><span className="skeleton-pill"/></div></div>}
   <p className="skeleton-text" aria-hidden="true">&nbsp;<br/>&nbsp;</p><p className="skeleton-text" aria-hidden="true">&nbsp;<br/>&nbsp;</p>
   <div className="account-actions" aria-hidden="true"><span className="skeleton-pill wide"/>{compact&&<span className="skeleton-pill wide"/>}</div></div>
 </section>;
 const move=moveStep(day);
 return <section className="coach-card" data-coach-mood={day.checkin?.energy??"ok"} aria-label={t("{name}: your plan for today", { name: coach?.name ?? t("Coach") })}>
  {coach&&<img className="coach-avatar" src={`/characters/${coach.id}-256.webp`} alt="" width={72} height={72} fetchPriority="high"/>}
  <div className="coach-bubble"><span className="eyebrow">{coach?t("{name}, YOUR COACH", { name: coach.name.toUpperCase() }):t("YOUR PLAN TODAY")}</span>
   {!day.checkin&&<CheckinButtons/>}
   <p>{move.text}</p><p>{foodStep(day)}</p>
   <div className="account-actions"><Link className="destination-button" href={move.href}>{move.label}</Link>{compact&&<Link className="destination-button" href="/coach">{coach?.name ? t("Talk to {name}", { name: coach.name }) : t("Talk to your coach")}</Link>}</div>
  </div>
 </section>;
}

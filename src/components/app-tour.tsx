import { t, msg, localized } from "@/lib/i18n";
import {useState} from 'react';
import Link from "@/lib/navigation";
import type {AdventureSummary} from '@/lib/adventure';
import {companions} from './character-companion';

const STEPS=[
 {title:msg("Set up your plan"),text:msg("Tell us your goals and routine. It takes about two minutes and you can change it later."),href:'/onboarding'},
 {title:msg("Log a meal"),text:msg("Open your diary, search a food and add it. Tapping + logs it straight away."),href:'/nutrition'},
 {title:msg("Scan your food"),text:msg("Take a photo of a plate. Check the portions, then log it."),href:'/scanner'},
 {title:msg("Scan a pack"),text:msg("Scan a barcode or QR code to see the product, its certifications and its nutrition."),href:'/barcode'},
 {title:msg("Move and count reps"),text:msg("Stand in front of the camera, set a target and let it count your reps."),href:'/workouts/camera'},
 {title:msg("Earn and unlock"),text:msg("Workouts and meals earn points. Points and a daily streak unlock new companions."),href:'/play'},
];
localized(STEPS, ["title", "text"]);
const KEY='trackcal:guide:done';
const load=():number[]=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(saved)?saved.filter(Number.isInteger):[];}catch{return [];}};

/** The path through the app, one step at a time, and what stands between the person and the next companion. */
export function AppTour({summary}:{summary?:AdventureSummary|null}){
 const [done,setDone]=useState(load),firstOpen=STEPS.findIndex((_,i)=>!done.includes(i)),[open,setOpen]=useState(Math.max(0,firstOpen));
 function toggle(index:number){const next=done.includes(index)?done.filter(i=>i!==index):[...done,index];setDone(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* progress just isn't remembered */}if(!done.includes(index))setOpen(Math.min(STEPS.length-1,index+1));}
 const next=summary?.companion_unlocks?.find(c=>!c.unlocked),points=summary?.xp??0,best=summary?.engagement_streak?.best??0,character=next&&companions.find(c=>c.id===next.id);
 return <div className="app-tour">
  <p className="app-tour-count">{t("{length} of {length2} steps done", { length: done.length, length2: STEPS.length })}</p>
  <progress aria-label={t("Guide progress")} value={done.length} max={STEPS.length}/>
  <ol>{STEPS.map((step,index)=><li key={step.href} data-done={done.includes(index)||undefined} data-open={open===index||undefined}>
   <button className="app-tour-step" aria-expanded={open===index} onClick={()=>setOpen(index)}><span aria-hidden="true">{done.includes(index)?'✓':index+1}</span>{step.title}</button>
   {open===index&&<div className="app-tour-body"><p>{step.text}</p><div><Link className="app-tour-go" href={step.href}>{t("Go there")}</Link><button onClick={()=>toggle(index)}>{done.includes(index)?t("Mark as not done"):t("Done")}</button></div></div>}
  </li>)}</ol>
  {next&&character&&<div className="app-tour-unlock"><strong>{t("Next: {name}", { name: character.name })}</strong>
   <label>{t("{n} of {required_xp} points", { n: Math.min(points,next.required_xp), required_xp: next.required_xp })}<progress value={Math.min(points,next.required_xp)} max={next.required_xp}/></label>
   {!!next.required_streak&&<label>{t("{n} of {required_streak} day streak", { n: Math.min(best,next.required_streak), required_streak: next.required_streak })}<progress value={Math.min(best,next.required_streak)} max={next.required_streak}/></label>}
  </div>}
 </div>;
}

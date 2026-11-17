import { t } from "@/lib/i18n";
import {useEffect,useMemo,useState} from "react";
import { useTarget } from "@/lib/targets";
import {useWorkspaceScope} from "./account-session";
import type {MealLog} from "./journal-tools";
import {adaptiveGoal,oneRepMax,platesPerSide,type GoalDay} from "@/lib/gym-math";
import {exportLocalEntries,useLocalState} from "@/lib/use-local-state";
import {FAST_MODES} from "@/lib/fitness-plans";
import {weeklyStep} from "@/lib/gym-math";

const PLATES=[25,20,15,10,5,2.5,1.25];
export function GymTools(){
 const [load,setLoad]=useState(60),[reps,setReps]=useState(5),[target,setTarget]=useState(60),[bar,setBar]=useState(20);
 const max=oneRepMax(load,reps),plates=platesPerSide(target,bar,PLATES);
 return <section className="account-card"><h2>{t("Gym calculators")}</h2><p>{t("Work out your one-rep max and which plates to load.")}</p>
  <div className="studio-fields"><label>{t("Weight lifted (kg)")}<input type="number" min="0" max="1000" step=".5" value={load} onChange={e=>setLoad(Number(e.target.value))}/></label><label>{t("Reps done")}<input type="number" min="1" max="30" value={reps} onChange={e=>setReps(Number(e.target.value))}/></label></div>
  <p className="gym-result" role="status">{max?t("Estimated 1RM: {max} kg", { max }):t("Use 1 to 12 reps for a useful estimate.")}</p>
  <div className="studio-fields"><label>{t("Target bar weight (kg)")}<input type="number" min="0" max="1000" step=".5" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label><label>{t("Bar weight (kg)")}<input type="number" min="0" max="50" step=".5" value={bar} onChange={e=>setBar(Number(e.target.value))}/></label></div>
  <p className="gym-result" role="status">{!plates?t("The target is lighter than the bar."):plates.rows.length?t("Each side: {plates}",{plates:plates.rows.map(r=>`${r.count} × ${r.plate} kg`).join(", ")}):t("Just the bar.")}{plates&&plates.left>0?t(" ({left} kg short)", { left: plates.left }):""}</p>
 </section>;
}
const PLANS=[12,14,16,18] as const;
const clock=(ms:number)=>{const m=Math.max(0,Math.floor(ms/60000));return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`;};
export function FastingTimer(){
 const [saved,setSaved]=useLocalState<{start:number;hours:number}[]>("trackcal:studio:fast",[]),fast=saved[0]??null,setFast=(value:{start:number;hours:number}|null)=>setSaved(value?[value]:[]),[hours,setHours]=useState<number>(14),[modeId,setModeId]=useState("time"),mode=FAST_MODES.find(row=>row.id===modeId)??FAST_MODES[0],[now,setNow]=useState(()=>Date.now()),[agreed,setAgreed]=useState(false);
 const running=!!fast;
 useEffect(()=>{if(!running)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return ()=>clearInterval(timer);},[running]);
 const elapsed=fast?now-fast.start:0,goal=fast?fast.hours*3600000:0;
 return <section className="account-card"><h2>{t("Fasting timer")}</h2><p>{t("Optional. Fasting isn't right for everyone. Skip it if you are pregnant, have diabetes, take medicine with food, or have a history of eating disorders, and ask your doctor if you are unsure.")}</p>
  {fast?<><p className="gym-result" role="status">{clock(elapsed)} of {fast.hours}h{elapsed>=goal?t(" · goal reached"):""}</p><progress max={1} value={Math.min(1,goal?elapsed/goal:0)} aria-label={t("Fasting progress")}/><button className="account-secondary" onClick={()=>setFast(null)}>{t("End fast")}</button></>
  :<><label>{t("Kind of fast")}<select value={modeId} onChange={e=>{setModeId(e.target.value);setHours(FAST_MODES.find(row=>row.id===e.target.value)?.hours??14);}}>{FAST_MODES.map(row=><option key={row.id} value={row.id}>{t(row.label)}</option>)}</select></label>{mode.id!=="time"&&<div className="fast-guide"><p><strong>{t("Often eaten:")}</strong> {t(mode.eat)}</p><p><strong>{t("Often avoided:")}</strong> {t(mode.skip)}</p><p>{t("Customs differ by family and community, so follow yours.")}</p></div>}<label>{t("Fasting window")}<select value={hours} onChange={e=>setHours(Number(e.target.value))}>{PLANS.map(h=><option key={h} value={h}>{t("{count} hours", { count: h })}</option>)}</select></label><label><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/> {t("This is right for me")}</label><button className="account-primary" disabled={!agreed} onClick={()=>setFast({start:Date.now(),hours})}>{t("Start fast")}</button></>}
 </section>;
}
export function AdaptiveGoal(){
 const scope=useWorkspaceScope(),[pace,setPace]=useState(-.25),[target,setTarget]=useTarget("calories");
 const days=useMemo(()=>{
  const all=exportLocalEntries(scope) as Record<string,unknown>,rows=new Map<string,GoalDay>(),cut=new Date(Date.now()-42*86400000).toISOString().slice(0,10);
  const at=(date:string)=>{const row=rows.get(date)??{date};rows.set(date,row);return row;};
  for(const [key,value] of Object.entries(all)){
   const date=/^trackcal:(?:journal|wellness):(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];if(!date||date<cut)continue;
   if(key.includes(":journal:")&&Array.isArray(value))at(date).calories=(value as MealLog[]).reduce((sum,meal)=>sum+(meal.calories||0),0);
   else if(key.includes(":wellness:")){const weight=(value as {weight?:number})?.weight;if(weight)at(date).weight=weight;}
  }
  return [...rows.values()];
 },[scope]);
 const goal=adaptiveGoal(days,pace);
 return <section className="account-card"><h2>{t("Adaptive calorie goal")}</h2><p>{t("Works out what you really burn from your food log and weight trend, then suggests a daily target.")}</p>
  <label>{t("Your aim")}<select value={pace} onChange={e=>setPace(Number(e.target.value))}><option value={-.5}>{t("Lose 0.5 kg a week")}</option><option value={-.25}>{t("Lose 0.25 kg a week")}</option><option value={0}>{t("Stay the same")}</option><option value={.25}>{t("Gain 0.25 kg a week")}</option></select></label>
  {goal?<><p className="gym-result" role="status">{t("Suggested: {target} kcal a day", { target: goal.target })}</p>{(()=>{const step=weeklyStep(target,goal.target);return step.change?<p>{t("To get there gently, change your target by {sign}{change} kcal this week, from {target} to {next}.", { sign: step.change>0?"+":"", change: step.change, target, next: step.next })}{" "}<button type="button" className="account-secondary" onClick={()=>setTarget(step.next)}>{t("Use {next} kcal", { next: step.next })}</button></p>:<p>{t("Your current target of {target} kcal is already close. No change needed this week.", { target })}</p>;})()}</>:<p role="status">{t("Not enough data yet. It needs meals on 10 days and 4 weigh-ins across at least 2 weeks.")}</p>}
  {goal&&<small>{t("You eat about {average} kcal, your weight is moving {kgPerWeek} kg a week, so you burn about {burn} kcal. An estimate, not medical advice.", { average: goal.average, kgPerWeek: goal.kgPerWeek, burn: goal.burn })}</small>}
 </section>;
}

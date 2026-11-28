import { t, msg, number } from "@/lib/i18n";
import {useRef,useState} from 'react';
import {Check,Plus,Volume2} from 'lucide-react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {CoachCard,useCoachCharacter,useCoachDay} from './coach-card';
import {VoiceInput} from './voice-input';
import {useDiaryMeals} from '@/lib/diary';
import {useTargets} from '@/lib/targets';
import {useLocalDate,useLocalState} from '@/lib/use-local-state';
import type {PantryEntry} from '@/lib/smart-tools';
import {CHAT_STARTERS,chatContext,foodToMeal,speak,type ChatFood,type ChatReply} from '@/lib/nutrition-chat';

type Line={role:'user'|'assistant';text:string;foods?:ChatFood[];safety?:ChatReply['safety']};
const UNAVAILABLE=msg("Your coach is unavailable right now.");

export function CoachPage(){const {ready,user}=useAccount();return !ready?<main className="account-loading">{t("Finding your coach…")}</main>:user?<Chat key={user.id}/>:<main className="account-page"><section className="account-card"><h1>{t("Meet your coach.")}</h1><p>{t("Sign in and your character will plan each day with you.")}</p><div className="gate-actions"><Link className="gate-primary" href="/login">{t("Sign in")}</Link></div></section></main>;}

/** One suggested food: what it is, how much, where the numbers come from, and one tap to put it in today's diary. */
function FoodCard({food,minor,logged,onLog}:{food:ChatFood;minor:boolean;logged:boolean;onLog:()=>void}){
 return <li className="chat-food">
  <div><strong>{food.local_name||food.name}</strong>
   <span>{minor?t("{grams} g",{grams:number(food.grams)}):t("{grams} g · {kcal} kcal · {protein} g protein",{grams:number(food.grams),kcal:number(food.totals.calories),protein:number(food.totals.protein_g)})}</span>
   <small className={food.estimated?'chat-food-estimate':''}>{food.estimated?t("AI estimate: check it before saving"):t("From {source}",{source:food.source})}</small></div>
  <button type="button" className={logged?'chat-food-done':''} disabled={logged} onClick={onLog} aria-label={logged?t("{food} logged",{food:food.local_name||food.name}):t("Log {food}",{food:food.local_name||food.name})}>
   {logged?<><Check size={16} aria-hidden="true"/> {t("Logged")}</>:<><Plus size={16} aria-hidden="true"/> {t("Log")}</>}</button>
 </li>;
}

function Chat(){
 const coach=useCoachCharacter(),day=useCoachDay(),date=useLocalDate(),[,setMeals]=useDiaryMeals(date),{targets}=useTargets(),[pantry]=useLocalState<PantryEntry[]>('trackcal:studio:pantry',[]);
 const [consent,setConsent]=useState(false),[lines,setLines]=useState<Line[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[logged,setLogged]=useState<Set<string>>(new Set()),[speaking,setSpeaking]=useState(false);
 const end=useRef<HTMLDivElement>(null),name=coach?.name??t('your coach'),minor=day?.minor??true;
 async function ask(message:string){
  const question=message.trim();if(!question||busy||!consent)return;
  const history=lines.slice(-6).map(line=>({role:line.role,text:line.text}));setLines([...lines,{role:'user',text:question}]);setText('');setBusy(true);setError('');
  try{
   const response=await fetch('/api/coach/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,character:coach?.id??'pip',context:chatContext(day,pantry,targets),history}),signal:AbortSignal.timeout(60000)});
   const data=await response.json() as ChatReply&{error?:string};
   if(!response.ok)throw new Error(data.error||t(UNAVAILABLE));
   setLines(all=>[...all,{role:'assistant',text:data.reply,foods:data.foods??[],safety:data.safety}]);
   if(speaking)speak(data.reply);
  }catch(failure){setError(failure instanceof Error&&failure.name!=='TimeoutError'?failure.message:t(UNAVAILABLE));}
  finally{setBusy(false);setTimeout(()=>end.current?.scrollIntoView?.({block:'nearest'}),50);}
 }
 function log(food:ChatFood,key:string){setMeals(all=>[...all,foodToMeal(food)]);setLogged(done=>new Set(done).add(key));try{navigator.vibrate?.(30);}catch{/* not supported */}}
 const canSpeak=typeof window!=='undefined'&&'speechSynthesis' in window;
 return <main className="wellness-page coach-page"><section className="camera-intro"><span className="eyebrow">{t("YOUR COACH")}</span><h1>{coach?t("Hi, I'm {name}.", { name: coach.name }):t("Your coach")}</h1>{coach&&<p>{coach.hello}</p>}</section>
  <CoachCard/>
  <section className="account-card coach-chat"><h2>{t("Ask {name}", { name })}</h2>
   <label className="scanner-consent"><input type="checkbox" aria-label={t("Allow my questions and today's numbers to be sent to the configured AI provider")} checked={consent} onChange={e=>setConsent(e.target.checked)}/> {t("Send my questions, food diary, pantry and targets to the AI service")}</label>
   <p className="rep-replay-note">{t("{name} answers from your saved meals for the last 7 days, your targets, pantry, budget, diet and allergies. Chats aren't saved. {name} is an AI and not a doctor, so check health questions with a professional.", { name })}</p>
   <div className="coach-lines" aria-live="polite">{lines.map((line,index)=><div key={index} className={`coach-message coach-${line.role}${line.safety&&line.safety!=='fallback'?' coach-safety':''}`} role={line.safety&&line.safety!=='fallback'?'alert':undefined}>
     <p><strong>{line.role==='user'?t("You"):name}</strong> {line.text}</p>
     {line.role==='assistant'&&canSpeak&&<button type="button" className="chat-listen" onClick={()=>speak(line.text)} aria-label={t("Read this reply aloud")}><Volume2 size={16} aria-hidden="true"/> {t("Listen")}</button>}
     {!!line.foods?.length&&<ul className="chat-foods" aria-label={t("Foods you can log")}>{line.foods.map((food,i)=><FoodCard key={i} food={food} minor={minor} logged={logged.has(`${index}:${i}`)} onLog={()=>log(food,`${index}:${i}`)}/>)}</ul>}
    </div>)}{busy&&<p className="coach-message coach-assistant coach-thinking">{t("{name} is thinking…", { name })}</p>}<div ref={end}/></div>
   {error&&<p role="alert" className="camera-alert">{error}</p>}
   {!lines.length&&<div className="account-actions chat-starters">{CHAT_STARTERS.map(starter=><button type="button" key={starter} disabled={!consent||busy} onClick={()=>void ask(t(starter))}>{t(starter)}</button>)}</div>}
   <form onSubmit={e=>{e.preventDefault();void ask(text);}}><label>{t("Your question")}<input value={text} maxLength={500} disabled={!consent} onChange={e=>setText(e.target.value)}/></label>
    {consent&&<VoiceInput value={text} onText={setText} purpose="question"/>}
    <button type="submit" className="account-primary" disabled={!consent||busy||!text.trim()}>{t("Send")}</button></form>
   {canSpeak&&consent&&<label className="scanner-consent chat-autoread"><input type="checkbox" checked={speaking} onChange={e=>setSpeaking(e.target.checked)}/> {t("Read new replies aloud")}</label>}
  </section>
 </main>;
}

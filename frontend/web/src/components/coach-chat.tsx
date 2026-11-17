import { t, msg } from "@/lib/i18n";
import {useRef,useState} from 'react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {CoachCard,useCoachCharacter,useCoachDay} from './coach-card';
import {coachContext} from '@/lib/coach';

type Line={role:'user'|'assistant';text:string};
const STARTERS=[msg("What should I eat for dinner?"),msg("Give me a 10 minute workout"),msg("How do I stay consistent?")];

export function CoachPage(){const {ready,user}=useAccount();return !ready?<main className="account-loading">{t("Finding your coach…")}</main>:user?<Chat key={user.id}/>:<main className="account-page"><section className="account-card"><h1>{t("Meet your coach.")}</h1><p>{t("Sign in and your character will plan each day with you.")}</p><div className="gate-actions"><Link className="gate-primary" href="/login">{t("Sign in")}</Link></div></section></main>;}

function Chat(){
 const coach=useCoachCharacter(),day=useCoachDay(),[consent,setConsent]=useState(false),[lines,setLines]=useState<Line[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),end=useRef<HTMLDivElement>(null),name=coach?.name??'your coach';
 async function ask(message:string){
  const question=message.trim();if(!question||busy||!consent)return;
  const history=lines.slice(-6);setLines([...lines,{role:'user',text:question}]);setText('');setBusy(true);setError('');
  try{
   const response=await fetch('/api/coach/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,character:coach?.id??'pip',context:day?coachContext(day):{},history}),signal:AbortSignal.timeout(40000)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||t("Your coach is unavailable right now."));
   setLines(all=>[...all,{role:'assistant',text:data.reply}]);
  }catch(failure){setError(failure instanceof Error?failure.message:t("Your coach is unavailable right now."));}
  finally{setBusy(false);setTimeout(()=>end.current?.scrollIntoView?.({block:'nearest'}),50);}
 }
 return <main className="wellness-page coach-page"><section className="camera-intro"><span className="eyebrow">{t("YOUR COACH")}</span><h1>{coach?t("Hi, I'm {name}.", { name: coach.name }):t("Your coach")}</h1>{coach&&<p>{coach.hello}</p>}</section>
  <CoachCard/>
  <section className="account-card coach-chat"><h2>{t("Ask {name}", { name })}</h2>
   <label className="scanner-consent"><input type="checkbox" aria-label={t("Allow my questions and today's numbers to be sent to the configured AI provider")} checked={consent} onChange={e=>setConsent(e.target.checked)}/> {t("Send my questions and today's numbers to the AI service")}</label>
   <p className="rep-replay-note">{t("It sees meals logged, calories left, protein, your streak and how you feel. Chats aren't saved. {name} is an AI and not a doctor, so check health questions with a professional.", { name })}</p>
   <div className="coach-lines" aria-live="polite">{lines.map((line,index)=><p key={index} className={`coach-message coach-${line.role}`}><strong>{line.role==='user'?t("You"):name}</strong> {line.text}</p>)}{busy&&<p className="coach-message coach-assistant">{t("{name} is thinking…", { name })}</p>}<div ref={end}/></div>
   {error&&<p role="alert" className="camera-alert">{error}</p>}
   {!lines.length&&<div className="account-actions">{STARTERS.map(starter=><button type="button" key={starter} disabled={!consent||busy} onClick={()=>void ask(t(starter))}>{t(starter)}</button>)}</div>}
   <form onSubmit={e=>{e.preventDefault();void ask(text);}}><label>{t("Your question")}<input value={text} maxLength={500} disabled={!consent} onChange={e=>setText(e.target.value)}/></label><button type="submit" className="account-primary" disabled={!consent||busy||!text.trim()}>{t("Send")}</button></form>
  </section>
 </main>;
}

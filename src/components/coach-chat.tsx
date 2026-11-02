import {useRef,useState} from 'react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {CoachCard,useCoachCharacter,useCoachDay} from './coach-card';
import {coachContext} from '@/lib/coach';

type Line={role:'user'|'assistant';text:string};
const STARTERS=['What should I eat for dinner?','Give me a 10 minute workout','How do I stay consistent?'];

export function CoachPage(){const {ready,user}=useAccount();return !ready?<main className="account-loading">Finding your coach…</main>:user?<Chat key={user.id}/>:<main className="account-page"><section className="account-card"><h1>Meet your coach.</h1><p>Sign in and your character will plan each day with you.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;}

function Chat(){
 const coach=useCoachCharacter(),day=useCoachDay(),[consent,setConsent]=useState(false),[lines,setLines]=useState<Line[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),end=useRef<HTMLDivElement>(null),name=coach?.name??'your coach';
 async function ask(message:string){
  const question=message.trim();if(!question||busy||!consent)return;
  const history=lines.slice(-6);setLines([...lines,{role:'user',text:question}]);setText('');setBusy(true);setError('');
  try{
   const response=await fetch('/api/coach/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,character:coach?.id??'pip',context:day?coachContext(day):{},history}),signal:AbortSignal.timeout(40000)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Your coach is unavailable right now.');
   setLines(all=>[...all,{role:'assistant',text:data.reply}]);
  }catch(failure){setError(failure instanceof Error?failure.message:'Your coach is unavailable right now.');}
  finally{setBusy(false);setTimeout(()=>end.current?.scrollIntoView?.({block:'nearest'}),50);}
 }
 return <main className="wellness-page coach-page"><section className="camera-intro"><span className="eyebrow">YOUR COACH</span><h1>{coach?`Hi, I'm ${coach.name}.`:'Your coach'}</h1>{coach&&<p>{coach.hello}</p>}</section>
  <CoachCard/>
  <section className="account-card coach-chat"><h2>Ask {name}</h2>
   <label className="scanner-consent"><input type="checkbox" aria-label="Allow my questions and today's numbers to be sent to the configured AI provider" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Send my questions and today&apos;s numbers to the AI service</label>
   <p className="rep-replay-note">It sees meals logged, calories left, protein, your streak and how you feel. Chats aren&apos;t saved. {name} is an AI and not a doctor, so check health questions with a professional.</p>
   <div className="coach-lines" aria-live="polite">{lines.map((line,index)=><p key={index} className={`coach-message coach-${line.role}`}><strong>{line.role==='user'?'You':name}</strong> {line.text}</p>)}{busy&&<p className="coach-message coach-assistant">{name} is thinking…</p>}<div ref={end}/></div>
   {error&&<p role="alert" className="camera-alert">{error}</p>}
   {!lines.length&&<div className="account-actions">{STARTERS.map(starter=><button type="button" key={starter} disabled={!consent||busy} onClick={()=>void ask(starter)}>{starter}</button>)}</div>}
   <form onSubmit={e=>{e.preventDefault();void ask(text);}}><label>Your question<input value={text} maxLength={500} disabled={!consent} onChange={e=>setText(e.target.value)}/></label><button type="submit" className="account-primary" disabled={!consent||busy||!text.trim()}>Send</button></form>
  </section>
 </main>;
}

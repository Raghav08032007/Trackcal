import { t } from "@/lib/i18n";
import {useEffect,useState} from 'react';
import {Bell, X} from 'lucide-react';
import {useAccount} from './account-session';
import {personalRequest} from '@/lib/personalization';
export function PersonalReminderInbox(){const {user}=useAccount();return user?<Inbox key={user.id}/>:null;}
/** A small card at the bottom left (bottom right when the companion sits on the left): the first due reminder, with
 *  snooze and dismiss. It floats above the page, so it never pushes the header or the page down. */
function Inbox(){
 const [items,setItems]=useState<{id:string;category:string;message:string}[]>([]),[error,setError]=useState(''),[leaving,setLeaving]=useState(false);
 useEffect(()=>{let alive=true;const load=()=>{if(document.hidden)return;personalRequest<{items:typeof items}>('reminders').then(v=>{if(alive)setItems(v.items);}).catch(()=>{});};load();const timer=setInterval(load,60000);window.addEventListener('focus',load);window.addEventListener('trackcal-personalization',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('trackcal-personalization',load);};},[]);
 if(!items.length)return null;
 const item=items[0];
 const act=async(action:'snooze'|'dismiss')=>{try{await personalRequest('reminders/'+item.id,action==='snooze'?{action,minutes:15}:{action});setError('');setLeaving(true);setTimeout(()=>{setItems(rows=>rows.filter(r=>r.id!==item.id));setLeaving(false);},220);}catch{setError(action==='snooze'?t("Could not snooze. Retry."):t("Could not dismiss. Retry."));}};
 return <section className={`personal-reminder-inbox${leaving?' is-leaving':''}`} aria-label={t("Optional in-app reminder")} data-category={item.category}>
  <span className="reminder-icon" aria-hidden="true"><Bell size={18} strokeWidth={2.4}/></span>
  <div className="reminder-body"><strong>{t("{category} check-in", { category: item.category })}</strong><p>{item.message}</p><small>{items.length>1?t("{n} more reminders available. ", { n: items.length-1 }):''}{t("In-app only.")}</small>
   <div className="reminder-actions"><button onClick={()=>void act('snooze')}>{t("Snooze 15 min")}</button></div>
   {error&&<p role="alert">{error}</p>}</div>
  <button className="reminder-close" aria-label={t("Dismiss")} onClick={()=>void act('dismiss')}><X size={16} aria-hidden="true"/></button>
 </section>;
}

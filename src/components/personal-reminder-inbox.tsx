"use client";
import {useEffect,useState} from 'react';
import {useAccount} from './account-session';
import {personalRequest} from '@/lib/personalization';
export function PersonalReminderInbox(){const {user}=useAccount();return user?<Inbox key={user.id}/>:null;}
function Inbox(){
 const [items,setItems]=useState<{id:string;category:string;message:string}[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const load=()=>{if(document.hidden)return;personalRequest<{items:typeof items}>('reminders').then(v=>{if(alive)setItems(v.items);}).catch(()=>{});};load();const timer=setInterval(load,60000);window.addEventListener('focus',load);window.addEventListener('trackcal-personalization',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('trackcal-personalization',load);};},[]);
 if(!items.length)return null;
 const item=items[0];return <section className="personal-reminder-inbox" aria-label="Optional in-app reminder"><strong>{item.category} check-in</strong><p>{item.message}</p><small>{items.length>1?`${items.length-1} more reminders available. `:''}In-app only.</small><div><button onClick={async()=>{try{await personalRequest('reminders/'+item.id,{action:'snooze',minutes:15});setItems(rows=>rows.filter(r=>r.id!==item.id));}catch{setError('Could not snooze. Retry.');}}}>Snooze 15 min</button><button onClick={async()=>{try{await personalRequest('reminders/'+item.id,{action:'dismiss'});setItems(rows=>rows.filter(r=>r.id!==item.id));}catch{setError('Could not dismiss. Retry.');}}}>Dismiss</button></div>{error&&<p role="alert">{error}</p>}</section>;
}

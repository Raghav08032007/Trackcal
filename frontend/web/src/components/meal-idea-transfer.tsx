import { t } from "@/lib/i18n";
import {useSyncExternalStore} from 'react';
const subscribe=(notify:()=>void)=>{window.addEventListener('popstate',notify);return()=>window.removeEventListener('popstate',notify);};
export function MealIdeaTransfer({onChoose}:{onChoose:(idea:string)=>void}){const query=useSyncExternalStore(subscribe,()=>window.location.search,()=> '');const idea=new URLSearchParams(query).get('mealIdea');return idea&&idea.length<=200?<section className="account-card"><h2>{t("Review your meal idea")}</h2><p>{idea}</p><p>{t("Add actual ingredients and quantities, then review the estimate before logging. No nutrition is invented or logged automatically.")}</p><button className="account-primary" onClick={()=>onChoose(idea)}>{t("Review this meal idea")}</button></section>:null;}

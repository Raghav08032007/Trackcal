import { t } from "@/lib/i18n";
import { announceXp } from "@/lib/celebrate";
export type CompanionPreferences={aura?:string;character_id:string;accessory:"none"|"flower"|"crown"|"sun"|"star"|"heart"|"sparkle";enabled:boolean;minimized:boolean;muted:boolean;position:"left"|"right";protection_enabled:boolean};
export type AdventureSummary={initialized:boolean;owner_id?:string;level_step?:number;customization?:CompanionPreferences;premium?:boolean;premium_accessories?:string[];achievements?:{code:string;title:string;status:string;progress:number;required:number;operational:boolean;unlocked_at?:string|null}[];engagement_streak?:{current:number;best:number;history:{day:string;status:string}[]};rest_today?:boolean;rest_days_remaining?:number;companion_unlocks?:{id:string;level:number;required_xp:number;required_streak?:number;unlocked:boolean}[];task_streak?:number;best_task_streak?:number;completed_days?:string[];daily_goal?:{complete:number;total:number;day_complete:boolean};unlocked_companions?:string[];timezone:string;today:string;xp:number;level:number;level_xp:number;streak:number;best_streak:number;active_days:string[];weekly_days:number;weekly_complete:boolean;badges:string[];quests:{id:string;title:string;xp:number;complete:boolean}[];history:{kind:string;day:string;xp:number}[]};
export type LabelRound={id:string;expires_at:string;questions:{prompt:string;options:string[]}[]};
// Several components read the summary when a page opens; share one request (and reuse it briefly) so the
// server is asked once. Any change (POST) clears the cache so the next read is fresh.
const SUMMARY_REUSE_MS=1500;
let summaryRead:{promise:Promise<unknown>;settledAt:number|null}|null=null;
export function forgetAdventureSummary(){summaryRead=null;}
async function send<T>(action:string,body?:unknown):Promise<T>{
  const response=await fetch(`/api/adventure/${action}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||t("Could not update your adventure. Try refreshing."));if(body!==undefined&&typeof window!=="undefined")window.dispatchEvent(new CustomEvent("trackcal-gamification",{detail:data.summary||data}));if(body!==undefined)announceXp(data);return data;
}
export async function adventureRequest<T>(action:string,body?:unknown):Promise<T>{
  if(action!=='summary'||body!==undefined){summaryRead=null;return send<T>(action,body);}
  const fresh=summaryRead&&(summaryRead.settledAt===null||Date.now()-summaryRead.settledAt<SUMMARY_REUSE_MS);
  if(!fresh){
    const read={promise:send<T>('summary'),settledAt:null as number|null};summaryRead=read;
    read.promise.then(()=>{read.settledAt=Date.now();},()=>{if(summaryRead===read)summaryRead=null;});
  }
  return summaryRead!.promise as Promise<T>;
}

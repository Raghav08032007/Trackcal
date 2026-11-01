import { announceXp } from "@/lib/celebrate";
import type {AdventureSummary} from './adventure';
export type ReminderChoice={enabled:boolean;time:string;days:number[]};
export type Preferences={display_name:string;age_group:string;language:string;country:string;timezone:string;units:'metric'|'imperial';interests:string[];experience:string;available_days:number[];rest_days:number[];duration:number;workout_time:string;setting:string;equipment:string[];accessibility:string[];professional_restrictions:string;diet:string;allergies:string[];cuisine:string;preparation:string;ingredients:string[];budget:number|null;currency:string;motivation:boolean;reminders:{hydration:ReminderChoice;workout:ReminderChoice;recovery:ReminderChoice;sleep:ReminderChoice;motivation:ReminderChoice;quiet_start:string;quiet_end:string}};
export const defaultPreferences:Preferences={display_name:'',age_group:'unspecified',language:'en',country:'',timezone:'UTC',units:'metric',interests:['fitness'],experience:'unspecified',available_days:[0,2,4],rest_days:[1,3,5,6],duration:15,workout_time:'09:00',setting:'home',equipment:[],accessibility:[],professional_restrictions:'',diet:'balanced',allergies:[],cuisine:'any',preparation:'flexible',ingredients:[],budget:null,currency:'INR',motivation:true,reminders:{hydration:{enabled:false,time:'09:00',days:[0,1,2,3,4,5,6]},workout:{enabled:false,time:'09:00',days:[0,1,2,3,4,5,6]},recovery:{enabled:false,time:'09:00',days:[0,1,2,3,4,5,6]},sleep:{enabled:false,time:'21:00',days:[0,1,2,3,4,5,6]},motivation:{enabled:false,time:'09:00',days:[0,1,2,3,4,5,6]},quiet_start:'22:00',quiet_end:'07:00'}};
export type Template={name:string;instructions:string;equipment:string[];difficulty:string;alternative:string;recovery?:string};
export type Activity={id:string;template_id:string;day:string;minutes:number;status:string;feedback:string|null;template:Template};
export type Plan={id:string;status:string;week_start:string;explanation:{reason:string;professional_review:boolean};activities:Activity[]};
export type PersonalState={minor_account?:boolean;feedback_history?:{id:string;name:string;feedback:string}[];preferences:Preferences;step:number;revision:number;completed:boolean;today:string;plan:Plan|null;eligible_templates:({id:string}&Template)[];measurements:{id:string;kind:string;value:number;unit:string;canonical_value:number;display_value?:number;display_unit?:string;recorded_at:string}[];bmi:{value:number|null;classification:null;context:string};recommendations:{meals:{id:string;name:string;ingredients:string[];tip:string;substitution:string;reason:string}[];nutrition_note:string;needs_review:boolean;message:string;budget_note:string};education:{id:string;title:string;text:string;question:string;options:string[]}[]};
export async function personalRequest<T>(path:string,body?:unknown,method?:string):Promise<T>{
 const response=await fetch('/api/personalization/'+path,{method:method||(body===undefined?'GET':'POST'),headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Check the values and try again.');
 if(body!==undefined||method==='DELETE'){if(data.summary)window.dispatchEvent(new CustomEvent('trackcal-gamification',{detail:data.summary as AdventureSummary}));announceXp(data);window.dispatchEvent(new Event('trackcal-personalization'));}return data;
}

export function assertAdultCalculatorAllowed(state:Pick<PersonalState,'minor_account'|'preferences'>){
 if(state.minor_account||!['20_64','65plus'].includes(state.preferences?.age_group))throw new Error('Adult calorie calculations require a confirmed adult age group in your preferences. Your personal plan works without calorie targets.');
}

// An adult age typed into the calculator answers an age group that was never set. A group already chosen is never changed here.
export async function confirmAdultForCalculator(age:number){
 const state=await personalRequest<PersonalState>('state');
 if(Number.isInteger(age)&&age<20)throw new Error('The calorie calculator is for ages 20 and over. Your personal plan works without calorie targets.');
 if(state.minor_account||state.preferences?.age_group!=='unspecified'||!Number.isInteger(age)||age<20||age>100)return assertAdultCalculatorAllowed(state);
 const timezone=state.revision?state.preferences.timezone:Intl.DateTimeFormat().resolvedOptions().timeZone;
 await personalRequest('onboarding',{preferences:{...state.preferences,timezone,age_group:age>=65?'65plus':'20_64'},step:Math.max(1,state.step),revision:state.revision,complete:false});
}

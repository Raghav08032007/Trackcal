import { msg, localized } from "./i18n";
import type {SportKind} from './pose/sports';
/** Scoring for the sports games in Play. Points come only from movements the camera counted, never from time or taps.
 *  A combo grows while movements keep coming (each within COMBO_GAP_MS of the last) and multiplies the points, up to x5.
 *  Stars are set by how many were done in the round, scaled to its length, at levels a beginner can reach. */
export const COMBO_GAP_MS:Record<SportKind,number>={skip:1200,box:1500,cricket:4500,badminton:4500};
export const ROUND_SECONDS=[30,60] as const;
export type RoundSeconds=typeof ROUND_SECONDS[number];
/** Counts for one, two and three stars in a 60-second round. */
const STARS_60:Record<SportKind,[number,number,number]>={skip:[40,80,120],box:[40,80,130],cricket:[8,14,20],badminton:[8,14,20]};
export const SPORTS:Record<SportKind,{title:string;unit:string;units:string;tip:string;camera:string;cues:readonly string[];hue:string}>={
 skip:{title:msg("Skip rope"),unit:msg("jump"),units:msg("jumps"),tip:msg("With or without a rope: light hops, both feet together."),camera:msg("Face the camera, 2–3 m away, with your whole body from head to feet in view."),cues:[msg("Soft knees"),msg("Both feet hop"),msg("Land light")],hue:'skip'},
 box:{title:msg("Shadow boxing"),unit:msg("punch"),units:msg("punches"),tip:msg("Jab and cross from your guard. Each fist back to your chin."),camera:msg("Stand side-on, 2–3 m away, with both arms and your hips in view."),cues:[msg("Fists up"),msg("Jab"),msg("Cross")],hue:'box'},
 cricket:{title:msg("Cricket drive"),unit:msg("drive"),units:msg("drives"),tip:msg("No bat needed: hands together, lift back, then drive down through the line."),camera:msg("Face the camera, 2–3 m away, with room above your head and both hands in view."),cues:[msg("Stance"),msg("Backlift"),msg("Drive"),msg("Follow through")],hue:'cricket'},
 badminton:{title:msg("Badminton smash"),unit:msg("smash"),units:msg("smashes"),tip:msg("Racket hand back behind your head, other arm up, then smash down and through."),camera:msg("Stand side-on, 2–3 m away, with room above your head and both arms in view."),cues:[msg("Ready"),msg("Racket back"),msg("Contact high"),msg("Smash down")],hue:'badminton'},
};
localized(Object.values(SPORTS),["title","unit","units","tip","camera","cues"]);
export type GameScore={count:number;points:number;combo:number;bestCombo:number;lastAt:number|null};
export const startScore=():GameScore=>({count:0,points:0,combo:0,bestCombo:0,lastAt:null});
/** The score after the counter reports `count` at time `at`. Only new counts add points. */
export function scoreCount(s:GameScore,kind:SportKind,count:number,at:number):GameScore{
 if(count<=s.count)return s;
 let next={...s};
 for(let i=s.count;i<count;i++){
  const combo=next.lastAt!==null&&at-next.lastAt<=COMBO_GAP_MS[kind]?next.combo+1:1;
  next={count:i+1,points:next.points+10*multiplier(combo),combo,bestCombo:Math.max(next.bestCombo,combo),lastAt:at};
 }
 return next;
}
/** x1 for the first few, then one more for every five in a row, up to x5. */
export const multiplier=(combo:number)=>Math.min(5,1+Math.floor(Math.max(0,combo-1)/5));
/** Stars earned for `count` in a round of `seconds`. */
export function stars(kind:SportKind,count:number,seconds:number){const k=seconds/60;return STARS_60[kind].filter(n=>count>=Math.round(n*k)).length;}
/** What a round needs for each star, for the ready screen. */
export const starGoals=(kind:SportKind,seconds:number)=>STARS_60[kind].map(n=>Math.round(n*seconds/60));
type Bests=Partial<Record<string,number>>;
const KEY='trackcal:play:sport-bests';
/** Personal bests live on this device only (a convenience, like a remembered tab); the round itself is never saved or sent. */
export function readBests():Bests{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}}
export function saveBest(kind:SportKind,seconds:number,points:number):{best:number;isNew:boolean}{
 const all=readBests(),id=`${kind}:${seconds}`,before=all[id]??0,isNew=points>before&&points>0;
 if(isNew){all[id]=points;try{localStorage.setItem(KEY,JSON.stringify(all));}catch{/* storage unavailable: the round still shows */}}
 return {best:Math.max(before,points),isNew};
}

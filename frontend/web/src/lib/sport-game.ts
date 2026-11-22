import { msg, localized } from "./i18n";
import type {SportKind} from './pose/sports';
import type {ExerciseKind} from './pose/types';
/** Every game in Play: the four sports with their own detectors, and variations built on a proven one (an overhead swing,
 *  the boxing counter, or a camera exercise's own counter) so each counts only its own movement. */
export type GameId=SportKind|'tennis'|'volley'|'bowl'|'boxspeed'|'football'|'hoops'|'kabaddi'|'sprint';
export type GameGroup='bat'|'fight'|'move';
/** Scoring for the sports games in Play. Points come only from movements the camera counted, never from time or taps.
 *  A combo grows while movements keep coming (each within COMBO_GAP_MS of the last) and multiplies the points, up to x5.
 *  Stars are set by how many were done in the round, scaled to its length, at levels a beginner can reach. */
export const COMBO_GAP_MS:Record<GameId,number>={skip:1200,box:1500,cricket:4500,badminton:4500,tennis:4500,volley:4500,bowl:5000,boxspeed:1000,football:1000,hoops:3000,kabaddi:3500,sprint:1000};
export const ROUND_SECONDS=[30,60] as const;
export type RoundSeconds=typeof ROUND_SECONDS[number];
/** Counts for one, two and three stars in a 60-second round. */
const STARS_60:Record<GameId,[number,number,number]>={skip:[40,80,120],box:[40,80,130],cricket:[8,14,20],badminton:[8,14,20],tennis:[8,14,20],volley:[8,14,20],bowl:[6,11,16],
 boxspeed:[60,110,160],football:[60,100,140],hoops:[15,25,35],kabaddi:[12,20,28],sprint:[60,100,140]};
type Game={title:string;unit:string;units:string;tip:string;camera:string;cues:readonly string[];hue:string;group:GameGroup;base?:SportKind;drill?:ExerciseKind};
export const SPORTS:Record<GameId,Game>={
 skip:{title:msg("Skip rope"),unit:msg("jump"),units:msg("jumps"),tip:msg("With or without a rope: light hops, both feet together."),camera:msg("Face the camera, 2–3 m away, with your whole body from head to feet in view."),cues:[msg("Soft knees"),msg("Both feet hop"),msg("Land light")],hue:'skip',group:'move'},
 box:{title:msg("Shadow boxing"),unit:msg("punch"),units:msg("punches"),tip:msg("Jab and cross from your guard. Each fist back to your chin."),camera:msg("Stand side-on, 2–3 m away, with both arms and your hips in view."),cues:[msg("Fists up"),msg("Jab"),msg("Cross")],hue:'box',group:'fight'},
 cricket:{title:msg("Cricket drive"),unit:msg("drive"),units:msg("drives"),tip:msg("No bat needed: hands together, lift back, then drive down through the line."),camera:msg("Face the camera, 2–3 m away, with room above your head and both hands in view."),cues:[msg("Stance"),msg("Backlift"),msg("Drive"),msg("Follow through")],hue:'cricket',group:'bat'},
 badminton:{title:msg("Badminton smash"),unit:msg("smash"),units:msg("smashes"),tip:msg("Racket hand back behind your head, other arm up, then smash down and through."),camera:msg("Stand side-on, 2–3 m away, with room above your head and both arms in view."),cues:[msg("Ready"),msg("Racket back"),msg("Contact high"),msg("Smash down")],hue:'badminton',group:'bat'},
 tennis:{title:msg("Tennis serve"),unit:msg("serve"),units:msg("serves"),tip:msg("Toss hand up, racket hand back behind your head, then swing up and over the ball."),camera:msg("Stand side-on, 2–3 m away, with room above your head and both arms in view."),cues:[msg("Ready"),msg("Racket back"),msg("Contact high"),msg("Smash down")],hue:'badminton',group:'bat',base:'badminton'},
 volley:{title:msg("Volleyball spike"),unit:msg("spike"),units:msg("spikes"),tip:msg("Both arms up, then swing your hitting arm down hard, as if over the net."),camera:msg("Stand side-on, 2–3 m away, with room above your head and both arms in view."),cues:[msg("Ready"),msg("Racket back"),msg("Contact high"),msg("Smash down")],hue:'badminton',group:'move',base:'badminton'},
 bowl:{title:msg("Cricket bowling action"),unit:msg("delivery"),units:msg("deliveries"),tip:msg("Front arm up, then bring your bowling arm over the top in one full circle. No ball needed."),camera:msg("Stand side-on, 2–3 m away, with room above your head and both arms in view."),cues:[msg("Ready"),msg("Racket back"),msg("Contact high"),msg("Smash down")],hue:'cricket',group:'bat',base:'badminton'},
 boxspeed:{title:msg("Boxing speed round"),unit:msg("punch"),units:msg("punches"),tip:msg("Fast, light jabs and crosses. Snap each fist straight back to your chin."),camera:msg("Stand side-on, 2–3 m away, with both arms and your hips in view."),cues:[msg("Fists up"),msg("Jab"),msg("Cross")],hue:'box',group:'fight',base:'box'},
 football:{title:msg("Football footwork"),unit:msg("knee"),units:msg("knees"),tip:msg("Quick high knees on the spot, arms pumping like a sprint start."),camera:'',cues:[msg("Stand tall"),msg("Drive one knee up"),msg("Switch legs")],hue:'skip',group:'move',drill:'highknee'},
 hoops:{title:msg("Basketball jump shot"),unit:msg("jump"),units:msg("jumps"),tip:msg("Bend your knees, jump, and reach both hands up as if shooting."),camera:'',cues:[msg("Stand tall"),msg("Squat down"),msg("Jump up")],hue:'skip',group:'move',drill:'squatjump'},
 kabaddi:{title:msg("Kabaddi raider steps"),unit:msg("step"),units:msg("steps"),tip:msg("Stay low, step wide to one side and back, ready to touch and turn."),camera:'',cues:[msg("Stand tall"),msg("Step wide and bend one knee"),msg("Push back to centre")],hue:'box',group:'fight',drill:'sidelunge'},
 sprint:{title:msg("Sprint drill"),unit:msg("kick"),units:msg("kicks"),tip:msg("Quick heel kicks towards your glutes, light on your feet."),camera:'',cues:[msg("Stand tall"),msg("Kick one heel up"),msg("Switch legs")],hue:'skip',group:'move',drill:'buttkick'},
};
localized(Object.values(SPORTS),["title","unit","units","tip","camera","cues"]);
export type GameScore={count:number;points:number;combo:number;bestCombo:number;lastAt:number|null};
export const startScore=():GameScore=>({count:0,points:0,combo:0,bestCombo:0,lastAt:null});
/** The score after the counter reports `count` at time `at`. Only new counts add points. */
export function scoreCount(s:GameScore,kind:GameId,count:number,at:number):GameScore{
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
export function stars(kind:GameId,count:number,seconds:number){const k=seconds/60;return STARS_60[kind].filter(n=>count>=Math.round(n*k)).length;}
/** What a round needs for each star, for the ready screen. */
export const starGoals=(kind:GameId,seconds:number)=>STARS_60[kind].map(n=>Math.round(n*seconds/60));
type Bests=Partial<Record<string,number>>;
const KEY='trackcal:play:sport-bests';
/** Personal bests live on this device only (a convenience, like a remembered tab); the round itself is never saved or sent. */
export function readBests():Bests{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}}
export function saveBest(kind:GameId,seconds:number,points:number):{best:number;isNew:boolean}{
 const all=readBests(),id=`${kind}:${seconds}`,before=all[id]??0,isNew=points>before&&points>0;
 if(isNew){all[id]=points;try{localStorage.setItem(KEY,JSON.stringify(all));}catch{/* storage unavailable: the round still shows */}}
 return {best:Math.max(before,points),isNew};
}

/** The games in each group, in the order they're shown. */
export const GAME_GROUPS:[GameGroup,string,GameId[]][]=[['bat',msg("Bat and racket"),['cricket','bowl','badminton','tennis']],
 ['fight',msg("Fight and raid"),['box','boxspeed','kabaddi']],['move',msg("Run and jump"),['skip','football','sprint','hoops','volley']]];

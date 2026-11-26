import { msg } from "@/lib/i18n";
/* Your character: the 3D coach dressed the way you choose. Saved on this device only.
 * Colours come from fixed swatches (a photo picks the nearest one), so a look is a handful of choices, never an image.
 * Outfit colours and accessories unlock as your level rises with the days you train. */
import {useSyncExternalStore} from 'react';

export type Accessory='none'|'headband'|'wristbands'|'cap';
export type AvatarLook={model:'f'|'m';skin:string;hair:string;top:string;shorts:string;shoes:string;accessory:Accessory;onDemos:boolean};

/** Skin tones from very light to very deep, so everyone can find theirs. */
export const SKIN=['#efc6a8','#e4b08c','#e0a982','#c98e66','#b0744e','#8d5a3b','#6b4129','#4a2c1c'];
export const HAIR=['#1b1512','#3b2418','#5e3a22','#8a5a33','#b8864e','#d9b77a','#a33a2a','#9a9a9a','#e8e3da'];
type Swatch={color:string;level:number;name:string};
/** Outfit colours: the basics at once, brighter sets as you level up, gold for the most consistent. */
export const OUTFIT:Swatch[]=[
 {color:'#3a1ed8',level:1,name:msg("Violet")},{color:'#111827',level:1,name:msg("Black")},{color:'#f4f4f5',level:1,name:msg("White")},{color:'#2563eb',level:1,name:msg("Blue")},
 {color:'#dc2626',level:2,name:msg("Red")},{color:'#16a34a',level:2,name:msg("Green")},{color:'#0d9488',level:3,name:msg("Teal")},{color:'#db2777',level:3,name:msg("Pink")},
 {color:'#f97316',level:4,name:msg("Orange")},{color:'#a3e635',level:5,name:msg("Lime")},{color:'#22d3ee',level:6,name:msg("Ice blue")},{color:'#d4a017',level:8,name:msg("Gold")}];
export const ACCESSORIES:{id:Accessory;level:number;name:string}[]=[{id:'none',level:1,name:msg("None")},{id:'headband',level:2,name:msg("Headband")},
 {id:'wristbands',level:4,name:msg("Wristbands")},{id:'cap',level:6,name:msg("Cap")}];

export const DEFAULT_LOOK:AvatarLook={model:'f',skin:SKIN[3],hair:HAIR[0],top:OUTFIT[0].color,shorts:'#111827',shoes:'#f4f4f5',accessory:'none',onDemos:true};

/** Level from the days you trained in the last 120: a new level every 4 active days, up to 10. */
export function avatarLevel(activeDays:number){const level=Math.min(10,1+Math.floor(activeDays/4));return {level,next:level>=10?null:(level)*4,days:activeDays};}
export const unlocked=(level:number,need:number)=>level>=need;

const KEY='trackcal:avatar-look';
let cached:AvatarLook|null=null;const listeners=new Set<()=>void>();
function read():AvatarLook|null{
 if(cached)return cached;
 try{const raw=localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw);if(v&&typeof v==='object'&&(v.model==='f'||v.model==='m')){cached={...DEFAULT_LOOK,...v};return cached;}}}catch{/* private mode: the default look */}
 return null;
}
export function saveLook(look:AvatarLook){cached=look;try{localStorage.setItem(KEY,JSON.stringify(look));}catch{/* kept for this visit */}listeners.forEach(f=>f());}
export function clearLook(){cached=null;snap=null;try{localStorage.removeItem(KEY);localStorage.removeItem(SNAP);}catch{/* nothing stored */}listeners.forEach(f=>f());}
/** A small still of your character (about 15 KB), taken in the studio, so other pages show it without loading 3D. */
const SNAP='trackcal:avatar-snapshot';let snap:string|null=null;
export function saveSnapshot(url:string){if(!url.startsWith('data:image/'))return;snap=url;try{localStorage.setItem(SNAP,url);}catch{/* too big or private mode: this visit only */}listeners.forEach(f=>f());}
export function useSnapshot():string|null{return useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f);},()=>{if(snap)return snap;try{snap=localStorage.getItem(SNAP);}catch{snap=null;}return snap;},()=>null);}
/** The highest level already celebrated, so each level-up is cheered once. */
const SEEN='trackcal:avatar-seen-level';
export function seenLevel(){try{return Number(localStorage.getItem(SEEN))||0;}catch{return 0;}}
export function markLevelSeen(level:number){try{localStorage.setItem(SEEN,String(level));}catch{/* cheered again next visit */}}
/** What a level unlocks, for the card and the studio. */
export const unlocksAt=(level:number)=>[...OUTFIT.filter(o=>o.level===level).map(o=>o.name),...ACCESSORIES.filter(a=>a.level===level).map(a=>a.name)];
/** Your saved look, or null when you haven't made one. */
export function useAvatarLook():AvatarLook|null{return useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f);},read,()=>null);}

/** The swatch closest to a sampled colour (by perceived difference), so a photo only ever picks from these. */
export function nearest(rgb:[number,number,number],swatches:string[]){
 const lab=(c:[number,number,number])=>{const [r,g,b]=c.map(v=>{v/=255;return v>.04045?((v+.055)/1.055)**2.4:v/12.92;});const x=(r*.4124+g*.3576+b*.1805)/.9505,y=r*.2126+g*.7152+b*.0722,z=(r*.0193+g*.1192+b*.9505)/1.089;const f=(t:number)=>t>.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))];};
 const hex=(h:string):[number,number,number]=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)) as [number,number,number];
 const a=lab(rgb);let best=swatches[0],d=Infinity;for(const s of swatches){const b=lab(hex(s)),e=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);if(e<d){d=e;best=s;}}return best;
}

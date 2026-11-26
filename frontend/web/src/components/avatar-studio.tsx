'use client';
/* Your character: dress the 3D coach your way, or start from a photo of yourself (read on this device, never kept).
 * Outfit colours and accessories unlock as you train: a new level every 4 active days. Optionally the exercise demos
 * show your character instead of the coach. */
import { t } from "@/lib/i18n";
import {lazy,Suspense,useRef,useState} from 'react';
import {Lock,Sparkles,Camera,RotateCcw} from 'lucide-react';
import {ACCESSORIES,DEFAULT_LOOK,HAIR,OUTFIT,SKIN,avatarLevel,clearLook,saveLook,unlocked,useAvatarLook,type AvatarLook} from '@/lib/avatar-look';
import {MOVES} from '@/lib/pose/exercise-motions';
import {useActiveDays} from '@/lib/workouts';

const Avatar3D=lazy(()=>import('./avatar-3d').then(module=>({default:module.Avatar3D})));
const PREVIEW=[['squat',"Squat"],['jack',"Jumping jack"],['curl',"Curl"]] as const;

function Swatches({label,colors,value,level,onPick}:{label:string;colors:{color:string;level:number;name?:string}[];value:string;level:number;onPick:(c:string)=>void}){
 return <fieldset className="studio-swatches"><legend>{label}</legend><div role="radiogroup" aria-label={label}>
  {colors.map(({color,level:need,name})=>{const open=unlocked(level,need);
   return <button key={color} type="button" role="radio" aria-checked={value===color} disabled={!open} title={open?(name?t(name):color):t("Unlocks at level {n}",{n:need})}
    aria-label={open?(name?t(name):color):t("Locked: unlocks at level {n}",{n:need})} style={{'--swatch':color} as React.CSSProperties} onClick={()=>onPick(color)}>{!open&&<Lock size={12} aria-hidden="true"/>}</button>;})}
 </div></fieldset>;
}

export function AvatarStudio(){
 const saved=useAvatarLook(),look=saved??DEFAULT_LOOK,days=useActiveDays(),{level,next}=avatarLevel(days.length);
 const [move,setMove]=useState<(typeof PREVIEW)[number][0]>('squat'),[failed,setFailed]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const file=useRef<HTMLInputElement>(null);
 const set=(patch:Partial<AvatarLook>)=>saveLook({...look,...patch});
 const plain=(list:string[])=>list.map(color=>({color,level:1}));
 const nextUnlock=[...OUTFIT.map(o=>({level:o.level,name:o.name})),...ACCESSORIES.map(a=>({level:a.level,name:a.name}))].filter(u=>u.level===level+1);

 async function fromPhoto(blob:File){
  setBusy(true);setStatus(t("Looking at your photo on this device…"));
  try{const {lookFromPhoto}=await import('@/lib/photo-look');const found=await lookFromPhoto(blob);
   if(!found)setStatus(t("I couldn't find a face clearly. Try a well-lit photo facing the camera, or pick the colours yourself."));
   else{set({skin:found.skin,...(found.hair?{hair:found.hair}:{})});setStatus(found.hair?t("Done: skin and hair picked from your photo. The photo was not kept."):t("Done: skin tone picked from your photo. Choose your hair colour below. The photo was not kept."));}}
  catch(error){console.warn("photo look:",error instanceof Error?error.message:error);setStatus(t("That photo couldn't be read. Try a JPG or PNG, or pick the colours yourself."));}
  finally{setBusy(false);if(file.current)file.current.value='';}
 }

 return <main className="wellness-page avatar-studio">
  <section className="studio-head"><span className="eyebrow">{t("YOUR CHARACTER")}</span><h1>{t("Make the coach look like you.")}</h1>
   <p>{t("Pick your skin, hair and kit. New colours and accessories unlock as you train. Saved on this device only.")}</p></section>
  <div className="studio-layout">
   <div className="studio-stage">
    <div className="studio-level" aria-label={t("Level {n}",{n:level})}><Sparkles size={18} aria-hidden="true"/><strong>{t("Level {n}",{n:level})}</strong>
     <progress max={4} value={next===null?4:days.length%4}/>
     <small>{next===null?t("Top level: everything is unlocked."):t("{n} more active days to level {level}.",{n:next-days.length,level:level+1})}{nextUnlock.length>0&&next!==null?' '+t("Unlocks: {list}.",{list:nextUnlock.map(u=>t(u.name)).join(', ')}):''}</small></div>
    <div className="studio-preview">
     {failed?<p className="studio-fallback">{t("3D preview isn't available on this device. Your choices are still saved.")}</p>
      :<Suspense fallback={<div className="studio-loading">{t("Loading your character…")}</div>}><Avatar3D key={look.model} move={MOVES[move]} gear={move==='curl'?'dumbbell':'body'} title={t("Your character")} playing onFail={()=>setFailed(true)} model={look.model} showAngle={false} look={look}/></Suspense>}
    </div>
    <div className="studio-moves" role="group" aria-label={t("Preview move")}>{PREVIEW.map(([id,label])=><button key={id} type="button" aria-pressed={move===id} onClick={()=>setMove(id)}>{t(label)}</button>)}</div>
   </div>
   <div className="studio-controls account-card">
    <div className="studio-photo">
     <button type="button" className="account-primary" disabled={busy} onClick={()=>file.current?.click()}><Camera size={18} aria-hidden="true"/> {t("Start from a photo of me")}</button>
     <input ref={file} type="file" accept="image/*" capture="user" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void fromPhoto(f);}}/>
     <small>{t("Your photo is read on this device to pick a skin tone and hair colour, then discarded. It is never uploaded or saved.")}</small>
     {status&&<p role="status">{status}</p>}
    </div>
    <fieldset className="studio-body"><legend>{t("Body")}</legend><div role="radiogroup" aria-label={t("Body")}>
     {([['f',"Body A"],['m',"Body B"]] as const).map(([id,label])=><button key={id} type="button" role="radio" aria-checked={look.model===id} onClick={()=>set({model:id})}>{t(label)}</button>)}</div></fieldset>
    <Swatches label={t("Skin")} colors={plain(SKIN)} value={look.skin} level={level} onPick={skin=>set({skin})}/>
    <Swatches label={t("Hair")} colors={plain(HAIR)} value={look.hair} level={level} onPick={hair=>set({hair})}/>
    <Swatches label={t("Top")} colors={OUTFIT} value={look.top} level={level} onPick={top=>set({top})}/>
    <Swatches label={t("Shorts")} colors={OUTFIT} value={look.shorts} level={level} onPick={shorts=>set({shorts})}/>
    <Swatches label={t("Shoes")} colors={OUTFIT} value={look.shoes} level={level} onPick={shoes=>set({shoes})}/>
    <fieldset className="studio-accessories"><legend>{t("Accessory")}</legend><div role="radiogroup" aria-label={t("Accessory")}>
     {ACCESSORIES.map(a=>{const open=unlocked(level,a.level);return <button key={a.id} type="button" role="radio" aria-checked={look.accessory===a.id} disabled={!open} onClick={()=>set({accessory:a.id})}>{!open&&<Lock size={12} aria-hidden="true"/>} {t(a.name)}{!open&&<small> · {t("level {n}",{n:a.level})}</small>}</button>;})}</div></fieldset>
    <label className="pref-switch studio-demos"><input type="checkbox" role="switch" checked={look.onDemos} onChange={e=>set({onDemos:e.target.checked})}/>{t("Show my character in the exercise demos")}</label>
    {saved&&<button type="button" className="studio-reset" onClick={()=>{clearLook();setStatus(t("Back to the coach's own look."));}}><RotateCcw size={16} aria-hidden="true"/> {t("Back to the coach's look")}</button>}
   </div>
  </div>
 </main>;
}

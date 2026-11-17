import { t } from "@/lib/i18n";
import {useEffect,useMemo,useState} from 'react';
import {REPLAY_GAP_MS,REPLAY_JOINTS,type RepReplay as Replay} from '@/lib/pose/session-tracker';

const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].map(([a,b])=>[REPLAY_JOINTS.indexOf(a),REPLAY_JOINTS.indexOf(b)]);
const still=()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};

/** The square that holds every frame of the rep with a margin, so the figure fills the stage instead of sitting small in a corner. */
function fit(frames:number[][]){
 const xs:number[]=[],ys:number[]=[];
 for(const f of frames)for(let i=0;i+1<f.length;i+=2)if(Number.isFinite(f[i])&&Number.isFinite(f[i+1])){xs.push(f[i]);ys.push(f[i+1]);}
 if(!xs.length)return '0 0 1 1';
 const [x0,x1,y0,y1]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)],size=Math.max(x1-x0,y1-y0,.1)*1.25;
 return `${((x0+x1)/2-size/2).toFixed(4)} ${((y0+y1)/2-size/2).toFixed(4)} ${size.toFixed(4)} ${size.toFixed(4)}`;
}

/** Your own rep as a moving outline. No picture of you is kept, and the outline is gone when you leave the page. */
export function RepReplayCard({best,worst,slowed}:{best:Replay;worst:Replay|null;slowed:number|null}){
 const [which,setWhich]=useState<'best'|'worst'>('best'),[frame,setFrame]=useState(0),[playing,setPlaying]=useState(()=>!still());
 const rep=which==='best'||!worst?best:worst,frames=rep.frames,pose=frames[Math.min(frame,frames.length-1)]??[];
 const view=useMemo(()=>fit(frames),[frames]),scale=Number(view.split(' ')[2])||1;
 useEffect(()=>{if(!playing||frames.length<2)return;const timer=setInterval(()=>setFrame(at=>(at+1)%frames.length),REPLAY_GAP_MS);return()=>clearInterval(timer);},[playing,frames]);
 const pick=(next:'best'|'worst')=>{setWhich(next);setFrame(0);};
 return <section className="account-card rep-replay"><h2>{t("How that set went")}</h2>
  {slowed!==null&&<p>{t("Your last reps were {slowed}% slower than your first. Your next target is set to where the slowing began.", { slowed })}</p>}
  <svg viewBox={view} role="img" aria-label={which==='best'?t("Moving outline of your best rep"):t("Moving outline of your shallowest rep")}>
   {BONES.map(([a,b])=><line key={`${a}-${b}`} x1={pose[a*2]} y1={pose[a*2+1]} x2={pose[b*2]} y2={pose[b*2+1]} style={{strokeWidth:.022*scale}}/>)}
   {REPLAY_JOINTS.map((_,i)=>Number.isFinite(pose[i*2])&&<circle key={i} cx={pose[i*2]} cy={pose[i*2+1]} r={.018*scale}/>)}
  </svg>
  <div className="replay-stats"><div><strong>{Math.round(rep.range)}°</strong><span>{t("range")}</span></div><div><strong>{(rep.ms/1000).toFixed(1)} s</strong><span>{t("rep time")}</span></div></div>
  <div className="replay-controls">
   {worst&&<div className="segmented" role="group" aria-label={t("Which rep")}><button type="button" aria-pressed={which==='best'} onClick={()=>pick('best')}>{t("Best rep")}</button><button type="button" aria-pressed={which==='worst'} onClick={()=>pick('worst')}>{t("Shallowest rep")}</button></div>}
   <button type="button" className="replay-play" aria-label={playing?t("Pause"):t("Play")} onClick={()=>setPlaying(on=>!on)}>
    {playing?<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>
     :<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z" fill="currentColor"/></svg>}
   </button>
  </div>
  <p className="rep-replay-note">{t("This outline isn't a video, is never uploaded, and is gone when you leave this page. It isn't a form check.")}</p>
 </section>;
}

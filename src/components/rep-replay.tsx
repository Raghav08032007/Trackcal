import {useEffect,useState} from 'react';
import {REPLAY_GAP_MS,REPLAY_JOINTS,type RepReplay as Replay} from '@/lib/pose/session-tracker';

const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].map(([a,b])=>[REPLAY_JOINTS.indexOf(a),REPLAY_JOINTS.indexOf(b)]);
const still=()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};

/** Your own rep as a moving outline. No picture of you is kept, and the outline is gone when you leave the page. */
export function RepReplayCard({best,worst,slowed}:{best:Replay;worst:Replay|null;slowed:number|null}){
 const [which,setWhich]=useState<'best'|'worst'>('best'),[frame,setFrame]=useState(0),[playing,setPlaying]=useState(()=>!still());
 const rep=which==='best'||!worst?best:worst,frames=rep.frames,pose=frames[Math.min(frame,frames.length-1)]??[];
 useEffect(()=>{if(!playing||frames.length<2)return;const timer=setInterval(()=>setFrame(at=>(at+1)%frames.length),REPLAY_GAP_MS);return()=>clearInterval(timer);},[playing,frames]);
 return <section className="account-card rep-replay"><h2>How that set went</h2>
  {slowed!==null&&<p>Your last reps were {slowed}% slower than your first. Your next target is set to where the slowing began.</p>}
  <svg viewBox="0 0 1 1" role="img" aria-label={`Moving outline of your ${which==='best'?'best':'shallowest'} rep`}>{BONES.map(([a,b])=><line key={`${a}-${b}`} x1={pose[a*2]} y1={pose[a*2+1]} x2={pose[b*2]} y2={pose[b*2+1]}/>)}</svg>
  <div className="account-actions">
   {worst&&<><button type="button" aria-pressed={which==='best'} onClick={()=>{setWhich('best');setFrame(0);}}>Best rep</button><button type="button" aria-pressed={which==='worst'} onClick={()=>{setWhich('worst');setFrame(0);}}>Shallowest rep</button></>}
   <button type="button" onClick={()=>setPlaying(on=>!on)}>{playing?'Pause':'Play'}</button>
  </div>
  <p className="rep-replay-note">{Math.round(rep.range)}° of movement in {(rep.ms/1000).toFixed(1)} s. This outline isn&apos;t a video, is never uploaded, and is gone when you leave this page. It isn&apos;t a form check.</p>
 </section>;
}

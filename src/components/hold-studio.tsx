import {useEffect,useRef,useState} from 'react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {Celebration} from './celebration';
import {CoachLine} from './coach-card';
import {MoveDemo} from './exercise-demo';
import {markWorkoutActive} from './app-updates';
import {HOLD_KINDS,HOLD_STYLES,HOLDS,HoldTracker,type HoldKind,type HoldStyle} from '@/lib/pose/holds';
import {focusPerson} from '@/lib/pose/landmarks';
import type {PoseDetectionService} from '@/lib/pose/detection-service';
import type {PoseFrame} from '@/lib/pose/types';
import {say,stepMinutes} from '@/lib/workout-coach';
import {wellnessRequest,type Session} from '@/lib/wellness';

const TARGETS=[15,30,45,60,90],MIN_SAVE_S=5;
type Status='setup'|'loading'|'holding'|'review'|'saved';
const seconds=(ms:number)=>Math.floor(ms/1000);

export function HoldStudio(){const {ready,user}=useAccount();return !ready?<main className="account-loading">Opening holds…</main>:user?<Studio key={user.id}/>:<main className="account-page"><section className="account-card"><h1>Hold it, and it counts.</h1><p>Sign in to time planks, balance and stretches with your camera.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;}

/** Planks, balance and stretches, timed by the camera. Only time actually in position counts. */
function Studio(){
 const video=useRef<HTMLVideoElement>(null),service=useRef<PoseDetectionService|null>(null),tracker=useRef(new HoldTracker('plank')),started=useRef(0),stats=useRef({frames:0,low:0,quality:0}),spoken=useRef(0),cheered=useRef(false);
 const [kind,setKind]=useState<HoldKind>(()=>{const asked=typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('hold');return asked&&asked in HOLDS?asked as HoldKind:'plank';});
 const [target,setTarget]=useState(30),[status,setStatus]=useState<Status>('setup'),[live,setLive]=useState({inPose:false,visible:false,current:0,best:0,held:0}),[error,setError]=useState(''),[voice,setVoice]=useState(false),[busy,setBusy]=useState(false),[earned,setEarned]=useState(0);
 const hold=HOLDS[kind];
 useEffect(()=>{markWorkoutActive(status==='loading'||status==='holding');return()=>markWorkoutActive(false);},[status]);
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);service.current?.stop(video.current||undefined);};},[]);// eslint-disable-line react-hooks/exhaustive-deps -- stop reads refs only
 function receive(raw:PoseFrame){
  const frame=focusPerson(raw),result=tracker.current.update(frame);stats.current.frames++;if(!result.visible)stats.current.low++;else stats.current.quality+=1;
  setLive({inPose:result.inPose,visible:result.visible,current:result.current,best:result.best,held:result.held});
  const now=seconds(result.current);
  if(voice&&result.inPose&&now>0&&now!==spoken.current&&(now%10===0||target-now<=3&&now<target)){spoken.current=now;say(target-now<=3&&now<target?String(target-now):`${now} seconds`);}
  if(!cheered.current&&result.current>=target*1000){cheered.current=true;try{navigator.vibrate?.([60,40,60]);}catch{/* not supported */}if(voice)say('Target reached. Great hold.');}
 }
 async function start(){
  setError('');setStatus('loading');tracker.current=new HoldTracker(kind);stats.current={frames:0,low:0,quality:0};spoken.current=0;cheered.current=false;started.current=performance.now();
  try{const {PoseDetectionService}=await import('@/lib/pose/detection-service');const controller=new PoseDetectionService(receive,message=>{setError(message);stop();});service.current=controller;await controller.start(video.current!,'','user',()=>setStatus('holding'));}
  catch(failure){service.current?.stop(video.current||undefined);setStatus('setup');setError(failure instanceof Error?failure.message:'Camera unavailable.');}
 }
 function stop(){service.current?.stop(video.current||undefined);service.current=null;setStatus(value=>value==='holding'||value==='loading'?(tracker.current.best>0?'review':'setup'):value);}
 async function save(){
  if(busy||seconds(tracker.current.best)<MIN_SAVE_S)return;setBusy(true);setError('');
  try{
   const id=crypto.randomUUID(),best=Math.round(tracker.current.best/100)/10,frames=stats.current.frames;
   const opened=await wellnessRequest<{session:Session}>('sessions',{id,name:`${hold.title} · camera hold`,exercises:[`camera_${kind}`],tracking_method:'camera'});
   const result=await wellnessRequest<{awarded_xp:number}>('sessions/'+id,{revision:opened.session.revision,action:'complete',minutes:stepMinutes((performance.now()-started.current)/1000),notes:`Best hold ${best} s, timed by the camera. Not a form or safety assessment.`,
    exercises:[{exercise_id:`camera_${kind}`,sets:[{reps:0,load:0,minutes:Math.round(best/60*100)/100}]}],
    tracking:{exercise_type:kind,engine:'mediapipe-pose-lite',version:2,confidence_mean:frames?Math.round((frames-stats.current.low)/frames*1000)/1000:0,sampled_frames:frames,low_confidence_frames:stats.current.low,sets:[{estimated_reps:0,corrected_reps:null,duration_s:best}]}},'PUT');
   setEarned(result.awarded_xp);setStatus('saved');
  }catch(failure){setError(failure instanceof Error?failure.message:'Could not save. Try again.');}
  finally{setBusy(false);}
 }
 const pick=(next:HoldKind)=>{if(status!=='setup')return;setKind(next);tracker.current=new HoldTracker(next);};
 const progress=Math.min(1,live.current/(target*1000)),done=live.current>=target*1000;
 return <main className="wellness-page hold-page"><section className="camera-intro"><span className="eyebrow">CORE · BALANCE · FLEXIBILITY</span><h1>Holds</h1><p>Get into position and the camera times you. Only time actually in position counts. It is not a form or safety check, so stop if anything hurts.</p></section>
  {error&&<p role="alert" className="camera-alert">{error}</p>}
  <div className="hold-layout">
   <section className="account-card hold-choose">
    {(Object.keys(HOLD_STYLES) as HoldStyle[]).map(style=><div key={style} className="hold-group"><h2>{HOLD_STYLES[style]}</h2><div className="camera-equipment" role="group" aria-label={HOLD_STYLES[style]}>{HOLD_KINDS.filter(k=>HOLDS[k].style===style).map(k=><button key={k} type="button" aria-pressed={kind===k} disabled={status!=='setup'} onClick={()=>pick(k)}>{HOLDS[k].title}</button>)}</div></div>)}
    <p className="camera-muscles"><strong>Works:</strong> {hold.muscles}</p><p className="camera-muscles"><strong>Set up:</strong> {hold.setup}</p>
    <MoveDemo move={hold.move} gear="body" title={hold.title} cues={[hold.cue]}/>
   </section>
   <section className="account-card hold-stage">
    <div className="camera-preview camera-mirrored"><video ref={video} autoPlay muted playsInline aria-label="Live hold camera preview"/>
     {status==='holding'&&<div className="hold-ring" data-in={live.inPose||undefined} data-done={done||undefined} style={{'--hold':progress} as React.CSSProperties} role="timer" aria-live="off" aria-label={`${seconds(live.current)} of ${target} seconds`}><strong>{seconds(live.current)}</strong><small>of {target} s</small></div>}
    </div>
    <p role="status" className="hold-status">{status==='holding'?(!live.visible?'Step back so your whole body is in view.':live.inPose?(done?'Target reached. Hold on if you can, or rest.':`Holding. ${hold.cue}.`):`Get into position: ${hold.cue.toLowerCase()}.`):status==='loading'?'Starting the camera…':'Camera off'}</p>
    {status==='setup'&&<><label>Target<select value={target} onChange={e=>setTarget(Number(e.target.value))}>{TARGETS.map(value=><option key={value} value={value}>{value} seconds</option>)}</select></label>
     <label className="scanner-consent"><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/> Count out loud</label>
     <button className="account-primary" onClick={()=>void start()}>Start {hold.title}</button></>}
    {(status==='holding'||status==='loading')&&<button className="account-primary" onClick={stop}>Stop</button>}
    {status==='review'&&<div className="hold-review"><h2>Best hold: {seconds(live.best)} s</h2><p>{seconds(live.held)} s in position altogether.</p>{seconds(live.best)<MIN_SAVE_S&&<p>Holds of {MIN_SAVE_S} seconds or more can be saved. Try again when you are ready.</p>}<div className="account-actions">{seconds(live.best)>=MIN_SAVE_S&&<button className="account-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save hold'}</button>}<button type="button" onClick={()=>{setStatus('setup');setLive({inPose:false,visible:false,current:0,best:0,held:0});}}>Discard</button></div></div>}
    {status==='saved'&&<div className="celebration-host"><Celebration/><CoachLine text={`${seconds(live.best)} seconds of ${hold.title.toLowerCase()} saved${earned?`, +${earned} points`:''}. Nice and steady!`}/><button type="button" onClick={()=>{setStatus('setup');setLive({inPose:false,visible:false,current:0,best:0,held:0});}}>Do another hold</button></div>}
    <p className="rep-replay-note">Video stays on your device. Only the time held is saved.</p>
   </section>
  </div>
 </main>;
}

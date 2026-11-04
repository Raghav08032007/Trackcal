import {useEffect,useRef,useState} from 'react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {Celebration} from './celebration';
import {CoachLine} from './coach-card';
import {RouteMeter,paceText} from '@/lib/gps';
import {wellnessRequest,type Session} from '@/lib/wellness';

type Status='ready'|'tracking'|'paused'|'review'|'saved';
const clock=(ms:number)=>{const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

export function GpsTracker(){const {ready,user}=useAccount();return !ready?<main className="account-loading">Opening GPS…</main>:user?<Tracker key={user.id}/>:<main className="account-page"><section className="account-card"><h1>Walk or run, tracked.</h1><p>Sign in to track distance and pace with GPS.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;}

/** Distance, time and pace from your phone's GPS. The route stays on this page; only distance and time are saved. */
function Tracker(){
 const meter=useRef(new RouteMeter()),watch=useRef<number|null>(null),lock=useRef<{release:()=>Promise<void>}|null>(null),started=useRef(0),elapsedBefore=useRef(0);
 const [status,setStatus]=useState<Status>('ready'),[kind,setKind]=useState<'walk'|'run'>('walk'),[metres,setMetres]=useState(0),[elapsed,setElapsed]=useState(0),[accuracy,setAccuracy]=useState<number|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[earned,setEarned]=useState(0);
 useEffect(()=>{if(status!=='tracking')return;const timer=setInterval(()=>setElapsed(elapsedBefore.current+performance.now()-started.current),1000);return()=>clearInterval(timer);},[status]);
 useEffect(()=>()=>{if(watch.current!==null)navigator.geolocation?.clearWatch(watch.current);void lock.current?.release().catch(()=>{});},[]);
 async function begin(){
  if(!('geolocation' in navigator)){setError('This device has no GPS in the browser.');return;}
  setError('');started.current=performance.now();
  watch.current=navigator.geolocation.watchPosition(p=>{setAccuracy(Math.round(p.coords.accuracy));if(meter.current.add({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,t:p.timestamp}))setMetres(meter.current.metres);},
   failure=>{setError(failure.code===1?'Location permission is off. Allow it in your browser settings to track distance.':'Waiting for a GPS signal. Step outside for a clearer view of the sky.');},{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
  try{lock.current=await (navigator as unknown as {wakeLock?:{request:(type:'screen')=>Promise<{release:()=>Promise<void>}>}}).wakeLock?.request('screen')??null;}catch{/* the screen may dim; tracking carries on while the page is open */}
  setStatus('tracking');
 }
 function stopWatching(){if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;void lock.current?.release().catch(()=>{});lock.current=null;elapsedBefore.current+=performance.now()-started.current;setElapsed(elapsedBefore.current);meter.current.pause();}
 function pause(){stopWatching();setStatus('paused');}
 function finish(){if(status==='tracking')stopWatching();setStatus('review');}
 async function save(){
  if(busy)return;setBusy(true);setError('');
  try{
   const id=crypto.randomUUID(),minutes=Math.max(1,Math.round(elapsedBefore.current/60000*10)/10),km=Math.round(metres/10)/100;
   const opened=await wellnessRequest<{session:Session}>('sessions',{id,name:`${kind==='walk'?'Walk':'Run'} · ${km} km`,exercises:[kind]});
   const done=await wellnessRequest<{awarded_xp:number}>('sessions/'+id,{revision:opened.session.revision,action:'complete',minutes,notes:`${km} km in ${clock(elapsedBefore.current)} (${paceText(metres,elapsedBefore.current)}), measured by GPS.`,exercises:[{exercise_id:kind,sets:[{reps:0,load:0,minutes:Math.min(60,minutes)}]}]},'PUT');
   setEarned(done.awarded_xp);setStatus('saved');
  }catch(failure){setError(failure instanceof Error?failure.message:'Could not save. Try again.');}
  finally{setBusy(false);}
 }
 const reset=()=>{meter.current=new RouteMeter();elapsedBefore.current=0;setMetres(0);setElapsed(0);setAccuracy(null);setStatus('ready');};
 return <main className="wellness-page gps-page"><section className="camera-intro"><span className="eyebrow">OUTDOORS</span><h1>Walk or run</h1><p>Distance, time and pace from your phone&apos;s GPS. Keep this page open while you move. Your route is never saved, only the distance and time.</p></section>
  {error&&<p role="alert" className="camera-alert">{error}</p>}
  <section className="account-card gps-card">
   {status==='ready'&&<div className="camera-equipment" role="group" aria-label="Activity"><button type="button" aria-pressed={kind==='walk'} onClick={()=>setKind('walk')}>Walk</button><button type="button" aria-pressed={kind==='run'} onClick={()=>setKind('run')}>Run</button></div>}
   <div className="gps-stats" aria-live="polite"><div><strong>{(metres/1000).toFixed(2)}</strong><small>km</small></div><div><strong>{clock(elapsed)}</strong><small>time</small></div><div><strong>{paceText(metres,elapsed)}</strong><small>pace</small></div></div>
   {accuracy!==null&&status==='tracking'&&<p className="rep-replay-note">GPS accuracy about {accuracy} m{accuracy>35?'. Waiting for a clearer signal before counting distance.':'.'}</p>}
   <div className="account-actions">
    {status==='ready'&&<button className="account-primary" onClick={()=>void begin()}>Start {kind}</button>}
    {status==='tracking'&&<><button onClick={pause}>Pause</button><button className="account-primary" onClick={finish}>Finish</button></>}
    {status==='paused'&&<><button className="account-primary" onClick={()=>void begin()}>Resume</button><button onClick={finish}>Finish</button></>}
    {status==='review'&&<>{elapsedBefore.current>=60000?<button className="account-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':`Save ${kind}`}</button>:<p>Activities of a minute or more can be saved.</p>}<button onClick={reset}>Discard</button></>}
   </div>
   {status==='saved'&&<div className="celebration-host"><Celebration/><CoachLine text={`${(metres/1000).toFixed(2)} km saved${earned?`, +${earned} points`:''}. Lovely work getting outside!`}/><button onClick={reset}>Start another</button></div>}
  </section>
 </main>;
}

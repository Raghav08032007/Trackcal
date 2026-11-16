import { t } from "@/lib/i18n";
import {useEffect,useRef,useState} from 'react';
import {Camera,Flame,Play,RotateCcw,Star,Timer,Trophy,Volume2,VolumeX,X,Zap} from 'lucide-react';
import type {PoseDetectionService} from '@/lib/pose/detection-service';
import {focusPerson} from '@/lib/pose/landmarks';
import {SPORT_MOVES} from '@/lib/pose/sport-motions';
import {handKmh,sportCounter,type SportCounter,type SportKind} from '@/lib/pose/sports';
import type {PoseFrame} from '@/lib/pose/types';
import {ROUND_SECONDS,SPORTS,multiplier,readBests,saveBest,scoreCount,starGoals,stars,startScore,type GameScore,type RoundSeconds} from '@/lib/sport-game';
import {useLocalState} from '@/lib/use-local-state';
import {MoveDemo,MoveThumb} from './exercise-demo';
import {Celebration} from './celebration';
import '@/app/play/sports.css';

const KINDS:SportKind[]=['skip','box','cricket','badminton'];
type Phase='pick'|'ready'|'loading'|'countdown'|'live'|'done';
type Result={points:number;count:number;bestCombo:number;stars:number;best:number;isNew:boolean};

/** A short rising tone, higher as the combo grows. Quiet, and off in calm mode or when muted. */
function ping(level:number){try{const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctx)return;const ctx=new Ctx(),o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440*2**(Math.min(level,5)*2/12);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.01);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.16);o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+.18);o.onended=()=>void ctx.close();}catch{/* audio unavailable */}}

/** Sports games in Play: skip rope, shadow boxing, a cricket drive and a badminton smash, counted by the camera on this device.
 *  Points come only from counted movements. Video never leaves the device and nothing from a round is saved except a personal best. */
export function SportGames({calm}:{calm:boolean}){
 const [kind,setKind]=useState<SportKind|null>(null),[phase,setPhase]=useState<Phase>('pick'),[seconds,setSeconds]=useLocalState<RoundSeconds>('trackcal:play:sport-seconds',60);
 const [sound,setSound]=useLocalState('trackcal:play:sport-sound',true);
 const [score,setScore]=useState<GameScore>(startScore),[left,setLeft]=useState(0),[count3,setCount3]=useState(3),[message,setMessage]=useState(''),[paused,setPaused]=useState(false);
 const [speed,setSpeed]=useState<number|null>(null),[bursts,setBursts]=useState<{id:number;points:number}[]>([]),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[bests,setBests]=useState(readBests);
 const video=useRef<HTMLVideoElement>(null),service=useRef<PoseDetectionService|null>(null),counter=useRef<SportCounter|null>(null),live=useRef(false),scoreRef=useRef(startScore()),timers=useRef<ReturnType<typeof setInterval>[]>([]),burstId=useRef(0),request=useRef(0);
 const quiet=calm||!sound;

 function clearTimers(){timers.current.forEach(clearInterval);timers.current=[];}
 function stopCamera(){request.current++;live.current=false;clearTimers();service.current?.stop(video.current||undefined);service.current=null;}
 useEffect(()=>stopCamera,[]);

 function choose(k:SportKind){stopCamera();setKind(k);setPhase('ready');setError('');setResult(null);}
 function close(){stopCamera();setKind(null);setPhase('pick');setResult(null);}

 function receive(raw:PoseFrame){
  if(!live.current||!counter.current||!kind)return;
  const state=counter.current.frame(focusPerson(raw));setPaused(state.paused);setMessage(state.message);
  if(state.count>scoreRef.current.count){
   const next=scoreCount(scoreRef.current,kind,state.count,raw.timestamp),gained=next.points-scoreRef.current.points;scoreRef.current=next;setScore(next);
   if(state.last?.speed)setSpeed(state.last.speed);
   if(!calm){const id=++burstId.current;setBursts(all=>[...all.slice(-4),{id,points:gained}]);setTimeout(()=>setBursts(all=>all.filter(b=>b.id!==id)),900);}
   if(!quiet)ping(multiplier(next.combo));
   try{navigator.vibrate?.(30);}catch{/* not supported */}
  }
 }

 async function start(){
  if(!kind||!video.current)return;
  const token=++request.current;setError('');setPhase('loading');setScore(startScore());scoreRef.current=startScore();setSpeed(null);setResult(null);setMessage('');
  counter.current=sportCounter(kind);
  try{
   const {PoseDetectionService}=await import('@/lib/pose/detection-service');if(token!==request.current)return;
   const controller=new PoseDetectionService(receive,reason=>{if(token===request.current){stopCamera();setError(reason);setPhase('ready');}});service.current=controller;
   await controller.start(video.current,'','user',()=>{if(token!==request.current)return;setPhase('countdown');setCount3(3);let n=3;
    const tick=setInterval(()=>{n--;if(n>0){setCount3(n);return;}clearInterval(tick);begin(token);},800);timers.current.push(tick);});
  }catch(e){if(token===request.current){stopCamera();setPhase('ready');setError(e instanceof Error?e.message:t("Camera unavailable."));}}
 }
 function begin(token:number){
  if(token!==request.current)return;
  counter.current?.reset();live.current=true;setPhase('live');const end=performance.now()+seconds*1000;setLeft(seconds*1000);
  const clock=setInterval(()=>{const ms=Math.max(0,end-performance.now());setLeft(ms);if(ms<=0)finish();},100);timers.current.push(clock);
 }
 function finish(){
  if(!kind)return;const s=scoreRef.current;stopCamera();
  const saved=saveBest(kind,seconds,s.points);setBests(readBests());
  setResult({points:s.points,count:s.count,bestCombo:s.bestCombo,stars:stars(kind,s.count,seconds),...saved});setPhase('done');
 }

 const sport=kind?SPORTS[kind]:null,camera=phase==='loading'||phase==='countdown'||phase==='live';
 return <section className={`play-section sport-games${calm?' sport-calm':''}`} id="move-games" aria-labelledby="move-games-title">
  <div className="play-section-head"><div><span className="play-stat-label">{t("MOVE GAMES · CAMERA")}</span><h2 id="move-games-title">{t("Play a sport.")}</h2><p className="play-daily-goal">{t("Skip, box, drive or smash in your living room. The camera counts every move on this device.")}</p></div><span>{t("No equipment needed · Video never leaves your device")}</span></div>
  {!kind&&<div className="sport-grid">{KINDS.map(k=>{const s=SPORTS[k],best=bests[`${k}:${seconds}`];return <article key={k} className={`sport-card sport-${k}`}>
   <div className="sport-card-art"><MoveThumb move={SPORT_MOVES[k]} weights={false} title={s.title}/></div>
   <h3>{s.title}</h3><p>{s.tip}</p>
   <div className="sport-card-foot"><span className="sport-best"><Trophy size={14}/>{best?t("Best {best} pts", { best }):t("No score yet")}</span><button className="play-button sport-go" onClick={()=>choose(k)}>{t("Play")}{" "}<Play size={16}/></button></div>
  </article>;})}</div>}
  {kind&&sport&&<div className={`sport-panel sport-${kind}`}>
   <div className="sport-panel-top"><h3>{sport.title}</h3><div className="sport-tools">
    <button type="button" className="play-small" aria-pressed={sound} onClick={()=>setSound(v=>!v)} aria-label={sound?t("Sound on"):t("Sound off")}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button>
    <button type="button" className="play-small" onClick={camera?finish:close}>{camera?t("End round"):<><X size={16}/> {t("All games")}</>}</button></div></div>
   {phase==='ready'&&<div className="sport-ready">
    <MoveDemo move={SPORT_MOVES[kind]} gear="body" title={sport.title} cues={sport.cues}/>
    <div className="sport-ready-side">
     <p className="sport-tip"><Camera size={18}/>{sport.camera}</p>
     <p>{sport.tip}</p>
     <fieldset className="sport-length"><legend>{t("Round")}</legend>{ROUND_SECONDS.map(n=><label key={n}><input type="radio" name="sport-length" checked={seconds===n} onChange={()=>setSeconds(n)}/>{n} s</label>)}</fieldset>
     <ol className="sport-goals" aria-label={t("Star goals")}>{starGoals(kind,seconds).map((n,i)=><li key={i}><span aria-hidden="true">{'★'.repeat(i+1)}</span>{n} {sport.units}</li>)}</ol>
     {error&&<p className="play-alert" role="alert">{error}</p>}
     <button className="play-button sport-start" onClick={()=>void start()}>{t("Start the camera")}{" "}<Zap size={18}/></button>
     <small>{t("Only counted {units} score points. Nothing is recorded; your best score stays on this device.", { units: sport.units })}</small>
    </div></div>}
   <div className="sport-stage" hidden={!camera}>
    <video ref={video} playsInline muted aria-label={t("Your camera, mirrored")}/>
    {phase==='loading'&&<div className="sport-overlay"><p>{t("Starting the camera…")}</p></div>}
    {phase==='countdown'&&<div className="sport-overlay sport-count" aria-live="assertive"><span key={count3}>{count3}</span><p>{sport.camera}</p></div>}
    {phase==='live'&&<>
     <div className="sport-hud" aria-live="polite">
      <div className="sport-clock" style={{'--left':`${left/(seconds*10)}%`} as React.CSSProperties}><Timer size={14}/><strong>{Math.ceil(left/1000)}</strong></div>
      <div className="sport-score"><strong key={score.count} className="sport-number">{score.count}</strong><span>{score.count===1?sport.unit:sport.units}</span></div>
      <div className="sport-points"><b>{score.points}</b> {t("pts")}{score.combo>1&&<span className={`sport-combo combo-${multiplier(score.combo)}`}><Flame size={14}/>{t("{combo} in a row · ×{n}", { combo: score.combo, n: multiplier(score.combo) })}</span>}</div>
     </div>
     {bursts.map(b=><span key={b.id} className="sport-burst" aria-hidden="true">+{b.points}</span>)}
     <p className={`sport-message${paused?' is-paused':''}`}>{message?t(message):sport.tip}{speed!==null&&(kind==='cricket'||kind==='badminton')&&<b>{" "}{t("· hand speed about {n} km/h (estimate)", { n: handKmh(speed) })}</b>}</p>
    </>}
   </div>
   {phase==='done'&&result&&<div className="sport-done" role="status">
    {result.isNew&&!calm&&<div className="celebration-host"><Celebration/></div>}
    <div className="sport-stars" role="img" aria-label={t("{stars} of 3 stars", { stars: result.stars })}>{[0,1,2].map(i=><Star key={i} size={44} className={i<result.stars?'on':''} style={{'--i':i} as React.CSSProperties}/>)}</div>
    <h3>{result.isNew?t("New personal best!"):result.stars===3?t("Three stars!"):result.count?t("Round complete."):t("No moves counted this time.")}</h3>
    <dl className="sport-results"><div><dt>{t("Points")}</dt><dd>{result.points}</dd></div><div><dt>{sport.units[0].toUpperCase()+sport.units.slice(1)}</dt><dd>{result.count}</dd></div><div><dt>{t("Best run")}</dt><dd>{result.bestCombo}</dd></div><div><dt>{t("Your best")}</dt><dd>{result.best}</dd></div></dl>
    {!result.count&&<p>{t("Check the camera tip: {camera}", { camera: sport.camera })}</p>}
    <div className="play-hero-actions"><button className="play-button" onClick={()=>void start()}>{t("Play again")}{" "}<RotateCcw size={17}/></button><button className="play-button play-button-white" onClick={close}>{t("Choose another game")}</button></div>
   </div>}
  </div>}
 </section>;
}

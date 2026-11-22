'use client';
import { t } from "@/lib/i18n";
import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {MOVES,blend,full,layout,placement,type Move} from '@/lib/pose/exercise-motions';
import {EXERCISES,gearOf,type ExerciseGear,type ExerciseKind} from '@/lib/pose/types';
import {formPoints} from '@/lib/pose/posture-match';
import {useLocalState} from '@/lib/use-local-state';
import type {AvatarModel} from './avatar-3d';

const LEG_MS=1300,HEAD=.058;
const Athlete3D=lazy(()=>import('./athlete-3d').then(module=>({default:module.Athlete3D})));
const Avatar3D=lazy(()=>import('./avatar-3d').then(module=>({default:module.Avatar3D})));
const canDraw3d=()=>{try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}catch{return false;}};
type Point=[number,number];
const lerp=(a:Point,b:Point,k:number):Point=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];
const n3=(v:number)=>v.toFixed(4);
/** A body segment that tapers from r1 to r2, with rounded ends, so limbs read as limbs and not lines. */
function limb(a:Point,b:Point,r1:number,r2:number){
 const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1e-6,x=-dy/n,y=dx/n;
 return `M${n3(a[0]+x*r1)} ${n3(a[1]+y*r1)}L${n3(b[0]+x*r2)} ${n3(b[1]+y*r2)}A${n3(r2)} ${n3(r2)} 0 0 0 ${n3(b[0]-x*r2)} ${n3(b[1]-y*r2)}L${n3(a[0]-x*r1)} ${n3(a[1]-y*r1)}A${n3(r1)} ${n3(r1)} 0 0 0 ${n3(a[0]+x*r1)} ${n3(a[1]+y*r1)}Z`;
}
/** A dumbbell held across the end of the forearm. */
function dumbbell(elbow:Point,wrist:Point){
 const dx=wrist[0]-elbow[0],dy=wrist[1]-elbow[1],n=Math.hypot(dx,dy)||1e-6,x=-dy/n,y=dx/n,c=lerp(elbow,wrist,1.12),end=(k:number):Point=>[c[0]+x*k,c[1]+y*k];
 return limb(end(-.055),end(.055),.007,.007)+limb(end(.04),end(.062),.026,.026)+limb(end(-.04),end(-.062),.026,.026);
}
const PARTS=['far-leg','far-short','far-shoe','far-arm','far-sleeve','far-weight','neck','torso','hips','near-leg','near-short','near-shoe','head','hair','eyes','near-arm','near-sleeve','near-weight'];
/** One moment of the move, painted back to front: far limbs, body, near limbs. */
function draw(svg:SVGSVGElement,m:Move,weights:boolean,progress:number,floor:number){
 const keys=m.keys.map(full),at=(progress%keys.length+keys.length)%keys.length,i=Math.floor(at),k=(1-Math.cos(Math.PI*(at-i)))/2;
 const p=layout(m,blend(keys[i],keys[(i+1)%keys.length],k),placement(m)) as Record<number,Point>;
 const set=(name:string,d:string)=>svg.querySelector(`.demo-${name}`)?.setAttribute('d',d);
 const leg=(s:0|1)=>limb(p[23+s],p[25+s],.05,.036)+limb(p[25+s],p[27+s],.037,.021);
 const arm=(s:0|1)=>limb(p[11+s],p[13+s],.031,.025)+limb(p[13+s],p[15+s],.025,.017)+limb(p[15+s],lerp(p[13+s],p[15+s],1.13),.019,.015);
 const short=(s:0|1)=>limb(p[23+s],lerp(p[23+s],p[25+s],.62),.054,.043);
 const shoe=(s:0|1)=>limb(p[27+s],p[31+s],.024,.021);
 const sleeve=(s:0|1)=>limb(p[11+s],lerp(p[11+s],p[13+s],.42),.034,.03);
 set('far-leg',leg(1));set('far-short',short(1));set('far-shoe',shoe(1));set('far-arm',arm(1));set('far-sleeve',sleeve(1));
 set('near-leg',leg(0));set('near-short',short(0));set('near-shoe',shoe(0));set('near-arm',arm(0));set('near-sleeve',sleeve(0));
 set('far-weight',weights?dumbbell(p[14],p[16]):'');set('near-weight',weights?dumbbell(p[13],p[15]):'');
 const s=lerp(p[11],p[12],.5),h=lerp(p[23],p[24],.5),width=Math.hypot(p[11][0]-p[12][0],p[11][1]-p[12][1])/2,hipWidth=Math.hypot(p[23][0]-p[24][0],p[23][1]-p[24][1])/2;
 set('torso',limb(s,lerp(s,h,.9),.05+width*.9,.044+hipWidth*.75));
 set('hips',limb(lerp(s,h,.86),h,.046+hipWidth*.75,.052+hipWidth));
 const n=Math.hypot(s[0]-h[0],s[1]-h[1])||1,u:Point=[(s[0]-h[0])/n,(s[1]-h[1])/n],f:Point=[-u[1],u[0]],c:Point=[s[0]+u[0]*.095,s[1]+u[1]*.095];
 const on=(a:number,b:number):Point=>[c[0]+u[0]*a*HEAD+f[0]*b*HEAD,c[1]+u[1]*a*HEAD+f[1]*b*HEAD],dot=(q:Point)=>`M${n3(q[0]-.006)} ${n3(q[1])}a.006 .006 0 1 0 .012 0a.006 .006 0 1 0 -.012 0Z`;
 set('neck',limb(lerp(s,c,.1),c,.026,.024));
 svg.querySelector('.demo-head')?.setAttribute('cx',n3(c[0]));svg.querySelector('.demo-head')?.setAttribute('cy',n3(c[1]));
 const R=n3(HEAD*1.05);
 if(m.view==='front'){const a=on(.2,-1.04),b=on(.2,1.04),q=on(.55,0);set('hair',`M${n3(a[0])} ${n3(a[1])}A${R} ${R} 0 0 1 ${n3(b[0])} ${n3(b[1])}Q${n3(q[0])} ${n3(q[1])} ${n3(a[0])} ${n3(a[1])}Z`);set('eyes',dot(on(-.05,-.38))+dot(on(-.05,.38)));}
 else{const a=on(1.03,.45),b=on(-.5,-.94),q=on(.3,-.1);set('hair',`M${n3(a[0])} ${n3(a[1])}A${R} ${R} 0 0 0 ${n3(b[0])} ${n3(b[1])}Q${n3(q[0])} ${n3(q[1])} ${n3(a[0])} ${n3(a[1])}Z`);set('eyes',dot(on(.05,.62)));}
 const shadow=svg.querySelector('.demo-shadow'),lowest=Math.max(p[27][1],p[28][1],p[31][1],p[32][1],p[25][1],h[1]+.05);
 shadow?.setAttribute('cx',n3((p[27][0]+p[28][0]+h[0])/3));shadow?.setAttribute('cy',n3(floor));shadow?.setAttribute('opacity',n3(Math.max(.12,.34-(floor-lowest)*2)));
}
/** Where the floor is for this move: below the lowest point of any key pose. */
function floorOf(m:Move){const at=placement(m);let low=0;for(const key of m.keys){const p=layout(m,full(key),at);for(const id of [15,16,23,24,25,26,27,28,31,32])low=Math.max(low,p[id][1]);}return low+.035;}
/** The example for each exercise: an illustrated athlete on a loop, stopped at any time, and still for people who ask for less motion. */
/** The 3D athlete where the device can draw it, and the flat drawing otherwise. */
/** The sample for a camera exercise: the example on a loop (slow motion on request) and the form points the camera watches for. */
/** A camera, a dotted line of sight and a person seen from the front (shoulders square) or from the side (in profile). */
function AngleIcon({front}:{front:boolean}){
 return <svg className="camera-angle-icon" viewBox="0 0 64 32" aria-hidden="true">
  <rect x="2" y="9" width="14" height="14" rx="3" fill="currentColor"/><circle cx="9" cy="16" r="3.4" fill="#fff"/>
  <path d="M19 16H38" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" fill="none"/>
  {front
   ?<g fill="currentColor"><circle cx="50" cy="7" r="4.5"/><rect x="42" y="13" width="16" height="4" rx="2"/><rect x="47" y="13" width="6" height="16" rx="3"/></g>
   :<g fill="currentColor"><circle cx="50" cy="7" r="4.5"/><path d="M45.2 7.5 42.6 8.6 45.4 9.6Z"/><rect x="47" y="13" width="6" height="16" rx="3"/><rect x="45" y="14" width="4" height="9" rx="2"/></g>}
 </svg>;
}
/** Which way to stand (or lie) for the camera: side-on or facing it, and whether the other angle also counts. */
export function CameraAngle({kind}:{kind:ExerciseKind}){
 const c=EXERCISE_CONFIG[kind],front=c.plane==='front';
 const label=c.bothAngles?(front?t("Facing the camera is best · side-on also counts"):t("Side-on is best · facing the camera also counts")):(front?t("Facing the camera"):t("Side-on to the camera"));
 return <p className="camera-angle" data-view={front?'front':'side'}><AngleIcon front={front}/><span><strong>{t("Camera angle")}</strong> {label}</span></p>;
}
export function ExerciseDemo({kind}:{kind:ExerciseKind}){
 const points=formPoints(kind);
 return <section className="exercise-sample" aria-label={t("How to do {n}", { n: EXERCISES[kind].title.toLowerCase() })}>
  <h3>{t("How to do it")}</h3>
  <CameraAngle kind={kind}/>
  <MoveDemo move={MOVES[kind]} gear={gearOf(kind)} title={EXERCISES[kind].title} cues={EXERCISE_CONFIG[kind].cues} joint={EXERCISE_CONFIG[kind].joints[0]}/>
  {points.length>0&&<><p className="exercise-sample-lead">{t("The camera watches for:")}</p><ul className="exercise-points">{points.map(point=><li key={point}>{t(point)}</li>)}</ul></>}
 </section>;
}
/** Library exercises without a camera exercise of their own that still have a matching moving example. */
const SAME_MOVE:Record<string,ExerciseKind>={strength:'wallpush',gym:'curl'};
/** The camera exercise whose moving example shows a library or plan exercise (by its template id), if there is one. */
export function kindForTemplate(id:string):ExerciseKind|undefined{
 if(id in EXERCISES)return id as ExerciseKind;
 return SAME_MOVE[id]??(Object.keys(EXERCISES) as ExerciseKind[]).find(kind=>EXERCISES[kind].template===id);
}
/** A "Watch how to do it" button that opens the moving 3D example in place, for lists of exercises. The 3D scene loads
 *  only when someone opens it, so long lists stay fast. */
export function WatchHow({kind}:{kind:ExerciseKind}){
 const [open,setOpen]=useState(false);
 return <div className="watch-how">
  <button type="button" className="watch-how-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span aria-hidden="true">{open?'✕':'▶'}</span> {open?t("Hide demo"):t("Watch how to do it")}</button>
  {open&&<ExerciseDemo kind={kind}/>}
 </div>;
}
/** The moving example: a realistic 3D person where the device can draw it (falling back to the simpler 3D figure, then
 *  to the drawing), with slow motion, a choice of model and, for camera exercises, the joint angle the camera checks. */
export function MoveDemo({move,gear,title,cues,joint,fists}:{move:Move;gear:ExerciseGear;title:string;cues:readonly string[];joint?:readonly [number,number,number];fists?:boolean}){
 const still=useMemo(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,[]);
 const [mode,setMode]=useState<'avatar'|'3d'|'flat'>(()=>typeof window!=='undefined'&&canDraw3d()?'avatar':'flat'),[playing,setPlaying]=useState(!still),[slow,setSlow]=useState(false);
 const [model,setModel]=useLocalState<AvatarModel>('trackcal:demo:model','f'),[angles,setAngles]=useLocalState('trackcal:demo:angles',true);
 const avatarFailed=useCallback(()=>setMode('3d'),[]),failed=useCallback(()=>setMode('flat'),[]);
 const speed=slow?.5:1,slowButton=<button type="button" aria-pressed={slow} onClick={()=>setSlow(v=>!v)}>{slow?t("Normal speed"):t("Slow motion")}</button>;
 if(mode==='flat')return <FlatDemo move={move} weights={['dumbbell','barbell','kettlebell'].includes(gear)} title={title} cues={cues} playing={playing} setPlaying={setPlaying} speed={speed} extra={slowButton}/>;
 return <figure className="exercise-demo exercise-demo-3d"><Suspense fallback={<div className="athlete-3d" aria-busy="true"/>}>{mode==='avatar'
  ?<Avatar3D move={move} gear={gear} title={title} playing={playing} onFail={avatarFailed} speed={speed} model={model} joint={joint} showAngle={angles} fists={fists}/>
  :<Athlete3D move={move} gear={gear} title={title} playing={playing} onFail={failed} speed={speed}/>}</Suspense>
  <figcaption><span>{t("Example: {n}", { n: cues.join(' · ') })}</span><button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?t("Pause"):t("Play")}</button>{slowButton}
   {mode==='avatar'&&<button type="button" onClick={()=>setModel(m=>m==='f'?'m':'f')}>{t("Change model")}</button>}
   {mode==='avatar'&&joint&&<button type="button" aria-pressed={angles} onClick={()=>setAngles(v=>!v)}>{t("Joint angle")}</button>}
   <button type="button" onClick={()=>setMode('flat')}>{t("Simple view")}</button></figcaption></figure>;
}
function FlatDemo({move,weights,title,cues,playing,setPlaying,speed=1,extra}:{move:Move;weights:boolean;title:string;cues:readonly string[];playing:boolean;setPlaying:(update:(value:boolean)=>boolean)=>void;speed?:number;extra?:React.ReactNode}){
 const svg=useRef<SVGSVGElement>(null),pace=useRef(speed);pace.current=speed;
 const clock=useRef(0);
 useEffect(()=>{
  const figure=svg.current;if(!figure)return;
  const floor=floorOf(move);clock.current=playing?clock.current:Math.max(clock.current,1);draw(figure,move,weights,clock.current,floor);
  if(!playing||typeof requestAnimationFrame==='undefined')return;
  let frame=0,last=performance.now();
  const tick=(now:number)=>{clock.current+=(now-last)/LEG_MS*pace.current;last=now;draw(figure,move,weights,clock.current,floor);frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
 },[move,weights,playing]);
 return <figure className="exercise-demo"><svg ref={svg} viewBox="-.04 -.06 1.08 1.14" role="img" aria-label={t("Animated example of {title}: {n}", { title, n: cues.join(', ') })}><ellipse className="demo-shadow" rx=".24" ry=".022"/>{PARTS.map(part=>part==='head'?<circle key={part} className="demo-head" r={HEAD}/>:<path key={part} className={`demo-${part}`}/>)}</svg><figcaption><span>{t("Example: {n}", { n: cues.join(' · ') })}</span><button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?t("Pause"):t("Play")}</button>{extra}</figcaption></figure>;
}
/** A small moving picture of a move for lists. It animates only while on screen, and stands still for people who ask for less motion. */
export function MoveThumb({move,weights,title}:{move:Move;weights:boolean;title:string}){
 const svg=useRef<SVGSVGElement>(null);
 useEffect(()=>{
  const figure=svg.current;if(!figure)return;
  const floor=floorOf(move);let clock=1,frame=0,last=0,visible=false;draw(figure,move,weights,clock,floor);
  const still=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
  if(still||typeof requestAnimationFrame==='undefined'||typeof IntersectionObserver==='undefined')return;
  const tick=(now:number)=>{if(last)clock+=(now-last)/LEG_MS;last=now;draw(figure,move,weights,clock,floor);frame=requestAnimationFrame(tick);};
  const watcher=new IntersectionObserver(([entry])=>{if(entry.isIntersecting&&!visible){visible=true;last=0;frame=requestAnimationFrame(tick);}else if(!entry.isIntersecting&&visible){visible=false;cancelAnimationFrame(frame);}});
  watcher.observe(figure);return ()=>{watcher.disconnect();cancelAnimationFrame(frame);};
 },[move,weights]);
 return <svg ref={svg} className="move-thumb" viewBox="-.04 -.06 1.08 1.14" role="img" aria-label={t("How to do {title}", { title })}><ellipse className="demo-shadow" rx=".24" ry=".022"/>{PARTS.map(part=>part==='head'?<circle key={part} className="demo-head" r={HEAD}/>:<path key={part} className={`demo-${part}`}/>)}</svg>;
}

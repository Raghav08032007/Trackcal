'use client';
import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {MOVES,blend,full,layout,placement,type Move} from '@/lib/pose/exercise-motions';
import {EXERCISES,gearOf,type ExerciseGear,type ExerciseKind} from '@/lib/pose/types';

const LEG_MS=1300,HEAD=.058;
const Athlete3D=lazy(()=>import('./athlete-3d').then(module=>({default:module.Athlete3D})));
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
export function ExerciseDemo({kind}:{kind:ExerciseKind}){return <MoveDemo move={MOVES[kind]} gear={gearOf(kind)} title={EXERCISES[kind].title} cues={EXERCISE_CONFIG[kind].cues}/>;}
export function MoveDemo({move,gear,title,cues}:{move:Move;gear:ExerciseGear;title:string;cues:readonly string[]}){
 const still=useMemo(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,[]);
 const [mode,setMode]=useState<'3d'|'flat'>(()=>typeof window!=='undefined'&&canDraw3d()?'3d':'flat'),[playing,setPlaying]=useState(!still),failed=useCallback(()=>setMode('flat'),[]);
 if(mode==='flat')return <FlatDemo move={move} weights={['dumbbell','barbell','kettlebell'].includes(gear)} title={title} cues={cues} playing={playing} setPlaying={setPlaying}/>;
 return <figure className="exercise-demo exercise-demo-3d"><Suspense fallback={<div className="athlete-3d" aria-busy="true"/>}><Athlete3D move={move} gear={gear} title={title} playing={playing} onFail={failed}/></Suspense><figcaption><span>Example: {cues.join(' · ')}</span><button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button type="button" onClick={()=>setMode('flat')}>Simple view</button></figcaption></figure>;
}
function FlatDemo({move,weights,title,cues,playing,setPlaying}:{move:Move;weights:boolean;title:string;cues:readonly string[];playing:boolean;setPlaying:(update:(value:boolean)=>boolean)=>void}){
 const svg=useRef<SVGSVGElement>(null);
 const clock=useRef(0);
 useEffect(()=>{
  const figure=svg.current;if(!figure)return;
  const floor=floorOf(move);clock.current=playing?clock.current:Math.max(clock.current,1);draw(figure,move,weights,clock.current,floor);
  if(!playing||typeof requestAnimationFrame==='undefined')return;
  let frame=0,last=performance.now();
  const tick=(now:number)=>{clock.current+=(now-last)/LEG_MS;last=now;draw(figure,move,weights,clock.current,floor);frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
 },[move,weights,playing]);
 return <figure className="exercise-demo"><svg ref={svg} viewBox="-.04 -.06 1.08 1.14" role="img" aria-label={`Animated example of ${title}: ${cues.join(', ')}`}><ellipse className="demo-shadow" rx=".24" ry=".022"/>{PARTS.map(part=>part==='head'?<circle key={part} className="demo-head" r={HEAD}/>:<path key={part} className={`demo-${part}`}/>)}</svg><figcaption><span>Example: {cues.join(' · ')}</span><button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button></figcaption></figure>;
}

'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {MOVES,blend,full,layout,placement} from '@/lib/pose/exercise-motions';
import {EXERCISES,type ExerciseKind} from '@/lib/pose/types';

const LEG_MS=1300;
const BONES:[number,number][]=[[11,13],[13,15],[23,25],[25,27],[27,31]];
/** One moment of the move: the two sides as bones, the torso, the head. Drawn straight into the SVG, frame by frame. */
function draw(svg:SVGSVGElement,kind:ExerciseKind,progress:number){
 const m=MOVES[kind],keys=m.keys.map(full),at=progress%keys.length,i=Math.floor(at),k=(1-Math.cos(Math.PI*(at-i)))/2;
 const p=layout(m,blend(keys[i],keys[(i+1)%keys.length],k),placement(m));
 const path=(side:0|1)=>BONES.map(([a,b])=>`M${p[a+side][0]} ${p[a+side][1]}L${p[b+side][0]} ${p[b+side][1]}`).join('');
 svg.querySelector('.demo-near')?.setAttribute('d',path(0)+`M${p[11][0]} ${p[11][1]}L${p[23][0]} ${p[23][1]}`);
 svg.querySelector('.demo-far')?.setAttribute('d',path(1)+`M${p[12][0]} ${p[12][1]}L${p[24][0]} ${p[24][1]}M${p[11][0]} ${p[11][1]}L${p[12][0]} ${p[12][1]}M${p[23][0]} ${p[23][1]}L${p[24][0]} ${p[24][1]}`);
 const sx=(p[11][0]+p[12][0])/2,sy=(p[11][1]+p[12][1])/2,hx=(p[23][0]+p[24][0])/2,hy=(p[23][1]+p[24][1])/2,n=Math.hypot(sx-hx,sy-hy)||1,head=svg.querySelector('.demo-head');
 head?.setAttribute('cx',String(sx+(sx-hx)/n*.075));head?.setAttribute('cy',String(sy+(sy-hy)/n*.075));
}
/** The example for each exercise: a looping figure, stopped at any time, and never moving for people who ask for less motion. */
export function ExerciseDemo({kind}:{kind:ExerciseKind}){
 const svg=useRef<SVGSVGElement>(null),title=EXERCISES[kind].title;
 const still=useMemo(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,[]);
 const [playing,setPlaying]=useState(!still);
 const clock=useRef(0);
 useEffect(()=>{
  const figure=svg.current;if(!figure)return;
  clock.current=playing?clock.current:Math.max(clock.current,1);draw(figure,kind,clock.current);
  if(!playing||typeof requestAnimationFrame==='undefined')return;
  let frame=0,last=performance.now();
  const tick=(now:number)=>{clock.current+=(now-last)/LEG_MS;last=now;draw(figure,kind,clock.current);frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
 },[kind,playing]);
 return <figure className="exercise-demo"><svg ref={svg} viewBox="0 0 1 1" role="img" aria-label={`Animated example of ${title}: ${EXERCISE_CONFIG[kind].cues.join(', ')}`}><path className="demo-far" fill="none" strokeWidth=".022" strokeLinecap="round" strokeLinejoin="round"/><path className="demo-near" fill="none" strokeWidth=".03" strokeLinecap="round" strokeLinejoin="round"/><circle className="demo-head" r=".052"/></svg><figcaption><span>Example: {EXERCISE_CONFIG[kind].cues.join(' · ')}</span><button type="button" onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button></figcaption></figure>;
}

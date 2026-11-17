import {useEffect,useState} from 'react';

const calm=()=>{try{return document.documentElement.dataset.motion==='reduced'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return true;}};
/** Counts up to a number. With reduced motion, or without animation frames, it shows the number straight away. */
export function useCountUp(target:number,duration=700){
 const [shown,setShown]=useState(target);
 useEffect(()=>{
  if(calm()||typeof requestAnimationFrame==='undefined'||!target){setShown(target);return;}
  let frame=0;const start=performance.now();
  const tick=(now:number)=>{const k=Math.min(1,(now-start)/duration);setShown(Math.round(target*(1-(1-k)**3)));if(k<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[target,duration]);
 return shown;
}

// Every camera exercise, through the real analyzer and counter, at the frame rate a slow laptop reaches.
import {describe,it,expect} from 'vitest';
import {SessionTracker} from '@/lib/pose/session-tracker';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {EXERCISES,EXERCISE_GROUPS,type ExerciseKind,type Landmark,type PoseFrame} from '@/lib/pose/types';

const NEW:ExerciseKind[]=['sumo','bridge','calf','sideleg','donkey','incline','kneepush','row','superman','kickback','overhead','hammer','front','uprow','crunch','legraise','sidebend','highknee','climber'];
const point=(x:number,y:number):Landmark=>({x,y,visibility:.95,presence:1});
/** A person standing, or lying along the floor. Left and right sit a little apart. */
function body(flat:boolean){
 const p=Array.from({length:33},()=>point(.5,.15));
 const place=(id:number,x:number,y:number)=>{p[id]=point(flat?y:x-.04,flat?x:y);p[id+1]=point(flat?y:x+.04,flat?x+.01:y);};
 for(const [id,x,y] of [[11,.5,.3],[13,.5,.42],[15,.5,.54],[23,.5,.55],[25,.5,.7],[27,.5,.85],[29,.5,.87],[31,.5,.88]])place(id,x,y);
 return p;
}
const rotate=(x:number,y:number,degrees:number)=>{const r=degrees*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
/** Poses both sides so the angle at each side's middle joint is exactly `degrees`. */
function pose(kind:ExerciseKind,degrees:number,t:number):PoseFrame{
 const c=EXERCISE_CONFIG[kind],flat=!!c.suitable&&c.suitable(body(true),0),p=body(flat);
 if(kind==='sidebend'){for(const [top,hip,other,sign] of [[11,23,24,-1],[12,24,23,1]]){const n=Math.hypot(p[other].x-p[hip].x,p[other].y-p[hip].y),v=rotate((p[other].x-p[hip].x)/n,(p[other].y-p[hip].y)/n,sign*degrees);p[top]=point(p[hip].x+v.x*.25,p[hip].y+v.y*.25);}return {landmarks:[p],timestamp:t,width:480,height:480};}
 for(const [a,b,end] of c.joints){const ux=p[a].x-p[b].x,uy=p[a].y-p[b].y,n=Math.hypot(ux,uy)||1,v=rotate(ux/n,uy/n,degrees);p[end]=point(p[b].x+v.x*.12,p[b].y+v.y*.12);}
 return {landmarks:[p],timestamp:t,width:480,height:480};
}
function count(kind:ExerciseKind,top:number,bottom:number,reps:number){
 const t=new SessionTracker(kind),ms=1000/15,period=3000;let now=1000;
 for(let i=0;i<20;i++,now+=ms)t.frame(pose(kind,top,now));
 for(let r=0;r<reps;r++)for(let s=0;s<period;s+=ms,now+=ms)t.frame(pose(kind,top-(top-bottom)*(1-Math.cos(2*Math.PI*s/period))/2,now));
 for(let i=0;i<20;i++,now+=ms)t.frame(pose(kind,top,now));
 return t.counter.reps;
}
/** Measured joint angles either side of the config's thresholds. Flipped moves read 180 minus the joint angle. */
const range=(kind:ExerciseKind):[number,number]=>{const c=EXERCISE_CONFIG[kind],f=(v:number)=>c.invert?180-v:v;return [f(Math.min(179,c.up+6)),f(Math.max(1,c.down-6))];};

describe('more camera exercises',()=>{
 for(const kind of NEW){
  it(`${kind}: counts 5 full reps at 15 fps`,()=>{const [top,bottom]=range(kind);expect(count(kind,top,bottom,5)).toBe(5);});
  it(`${kind}: holding still is never a rep`,()=>{const [top]=range(kind);expect(count(kind,top,top,0)).toBe(0);});
 }
 it('every exercise has a body area, its muscles and a saved template name',()=>{for(const [id,e] of Object.entries(EXERCISES)){expect(EXERCISE_GROUPS).toHaveProperty(e.group);expect(e.muscles).toBeTruthy();expect(e.template).toBe('camera_'+id);expect(EXERCISE_CONFIG[id as ExerciseKind].template).toBe(e.template);}});
});

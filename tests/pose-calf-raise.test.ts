// Calf raises are counted from how far the body rises (the heel height), not the ankle angle, so they work side-on or facing the
// camera. A person 170 cm tall fills 80% of the frame: a 5 cm raise moves everything above the ankles by 0.8*5/170 of the frame.
import {describe,it,expect} from 'vitest';
import {SessionTracker} from '@/lib/pose/session-tracker';
import type {Landmark,PoseFrame} from '@/lib/pose/types';

const FRAME_PER_CM=.8/170;
let seed=37;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
const jitter=()=>(rnd()-.5)*.006;  // about the model's frame-to-frame wobble

/** A standing body lifted `raise` cm (heels up), optionally squatting (`squat` 0..1), leaning (`lean` in frame units). */
function body(view:'side'|'front',raise:number,t:number,{squat=0,lean=0,jump=0}={}):PoseFrame{
 const lift=raise*FRAME_PER_CM,dip=squat*.12,half=view==='front'?1:.08;
 const p:Landmark[]=Array.from({length:33},()=>({x:.5,y:.15,visibility:.9,presence:1}));
 const put=(id:number,x:number,y:number)=>{p[id]={x:x+jitter(),y:y+jitter(),visibility:.95,presence:1};};
 const air=jump*.12,top=.22-lift+dip-air,hip=.5-lift+dip-air,knee=.7-lift+dip*.5-air,ankle=.9-lift*.4-air;  // ankles rise a little on the toes; in a jump they leave the floor
 for(const [l,r,y,w] of [[11,12,top,.09],[13,14,top+.14,.11],[15,16,top+.28,.11],[23,24,hip,.06],[25,26,knee,.06],[27,28,ankle,.06]] as const){put(l,.5-w*half+lean,y);put(r,.5+w*half+lean,y);}
 put(0,.5+lean,top-.1);put(31,.5-.06*half+(view==='side'?.05:0),.93);put(32,.5+.06*half+(view==='side'?.05:0),.93);put(29,.5-.06*half,.92-lift);put(30,.5+.06*half,.92-lift);
 return {landmarks:[p],timestamp:t,width:480,height:640};
}
function run(view:'side'|'front',reps:number,cm:number,fps:number,shape:(k:number)=>{squat?:number;lean?:number;jump?:number}=()=>({}),rise=true){
 const tr=new SessionTracker('calf'),step=1000/fps;let t=1000;
 for(let i=0;i<fps*2;i++,t+=step)tr.frame(body(view,0,t));
 for(let r=0;r<reps;r++){const n=Math.round(2.4*fps);for(let i=0;i<n;i++,t+=step){const k=(1-Math.cos(2*Math.PI*i/n))/2;tr.frame(body(view,rise?cm*Math.min(1,k*1.4):0,t,shape(k)));}for(let i=0;i<fps*.6;i++,t+=step)tr.frame(body(view,0,t));}
 return tr.counter;
}

describe('calf raises',()=>{
 for(const view of ['side','front'] as const)for(const fps of [10,15,30])it(`counts 10 raises of 5 cm ${view === 'side' ? 'side-on' : 'facing the camera'} at ${fps} fps`,()=>expect(run(view,10,5,fps).reps).toBe(10));
 it('counts a modest 3.5 cm raise',()=>expect(run('front',8,3.5,15).reps).toBe(8));
 it('a 1.5 cm wobble is not a raise',()=>expect(run('front',8,1.5,15).reps).toBe(0));
 it('standing still counts nothing',()=>expect(run('side',0,0,30).reps).toBe(0));
 it('squats are not calf raises',()=>expect(run('front',6,0,15,k=>({squat:k}),false).reps).toBe(0));
 it('jumping is not a calf raise',()=>expect(run('front',6,0,15,k=>({jump:k}),false).reps).toBe(0));
 it('leaning forward and back is not a raise',()=>expect(run('side',6,0,15,k=>({lean:k*.08}),false).reps).toBe(0));
});

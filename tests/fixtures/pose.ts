import type {ExerciseKind,PoseFrame} from '../../src/lib/pose/types';
export function pose(exercise:ExerciseKind,bent=false,timestamp=0,quality=.95):PoseFrame{
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:quality,presence:quality}));
 const set=(id:number,x:number,y:number)=>{p[id]={x,y,visibility:quality,presence:quality};};
 // A real squat side-on: the feet stay planted, the knees go forward, the hips back and down, the torso leans a little.
 if(exercise==='squat'){set(11,bent?.55:.5,bent?.37:.2);set(23,bent?.46:.5,bent?.57:.4);set(25,bent?.6:.5,bent?.66:.6);set(27,.5,.8);}
 if(exercise==='pushup'){const y=bent?.5:.4;set(11,.3,y);set(13,bent?.42:.3,bent?.54:.5);set(15,.3,.62);set(23,.6,y);set(25,.72,y+.03);set(27,.85,.6);}
 if(exercise==='curl'){set(11,.5,.2);set(13,.5,.4);set(15,bent?.6:.5,bent?.25:.6);set(23,.5,.65);}
 for(const id of [11,13,15,23,25,27])p[id+1]={...p[id],x:p[id].x+.02,visibility:Math.max(0,quality-.05)};
 return {landmarks:[p],timestamp,width:640,height:480,brightness:120};
}

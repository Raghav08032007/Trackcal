import type {ExerciseKind,PoseFrame} from '../../src/lib/pose/types';
export function pose(exercise:ExerciseKind,bent=false,timestamp=0,quality=.95):PoseFrame{
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:quality,presence:quality}));
 const set=(id:number,x:number,y:number)=>{p[id]={x,y,visibility:quality,presence:quality};};
 if(exercise==='squat'){set(11,.5,.2);set(23,.5,.4);set(25,.5,.6);set(27,bent?.7:.5,bent?.6:.8);}
 if(exercise==='pushup'){set(11,.25,.4);set(13,.4,.4);set(15,bent?.4:.55,bent?.55:.4);set(23,.6,.4);set(27,.85,.4);}
 if(exercise==='curl'){set(11,.5,.2);set(13,.5,.4);set(15,bent?.6:.5,bent?.25:.6);set(23,.5,.65);}
 for(const id of [11,13,15,23,25,27])p[id+1]={...p[id],x:p[id].x+.02,visibility:Math.max(0,quality-.05)};
 return {landmarks:[p],timestamp,width:640,height:480,brightness:120};
}

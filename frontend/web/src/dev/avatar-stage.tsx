/* Developer tool: the 3D coach doing one exercise full screen, for recording example videos (tools/video-bench/make-videos.mjs).
 * ?kind=squat&reps=8&turn=0&speed=1&model=f  turn: extra camera angle in degrees. Sets window.stage = {started, done}. */
import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {Avatar3D} from '@/components/avatar-3d';
import {MOVES} from '@/lib/pose/exercise-motions';
import {EXERCISES,gearOf,type ExerciseKind} from '@/lib/pose/types';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {DEFAULT_LOOK,type AvatarLook} from '@/lib/avatar-look';

const q=new URLSearchParams(location.search),kind=(q.get('kind')??'squat') as ExerciseKind,reps=Number(q.get('reps')??8),speed=Number(q.get('speed')??1);
const look:AvatarLook|null=q.get('look')?{...DEFAULT_LOOK,...JSON.parse(q.get('look')!)}:null;
const turn=Number(q.get('turn')??0)*Math.PI/180,model=(q.get('model')??'f') as 'f'|'m';
const stage={started:0,done:false,repMs:1300*MOVES[kind].keys.length/speed,oneAngle:!EXERCISE_CONFIG[kind].bothAngles,plane:EXERCISE_CONFIG[kind].plane};(window as unknown as {stage:typeof stage}).stage=stage;

function Stage(){
 const [on,setOn]=useState(true);
 useEffect(()=>{const id=setInterval(()=>{const ready=document.querySelector('.avatar-3d[data-ready]');if(ready&&!stage.started)stage.started=performance.now();
  if(stage.started&&performance.now()-stage.started>=reps*stage.repMs+300){setOn(false);stage.done=true;clearInterval(id);}},50);return ()=>clearInterval(id);},[]);
 return <div style={{position:'fixed',inset:0,background:'#e9eef2'}}>{on&&<div style={{width:'100%',height:'100%'}}><Avatar3D move={MOVES[kind]} gear={gearOf(kind)} title={EXERCISES[kind].title} playing onFail={()=>{document.title='avatar failed';}} speed={speed} model={model} showAngle={false} turn={turn} sway={false} look={look}/></div>}</div>;
}
createRoot(document.getElementById('root')!).render(<Stage/>);

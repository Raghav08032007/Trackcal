/* Developer tool: the 3D coach doing one exercise full screen, for recording example videos (tools/video-bench/make-videos.mjs).
 * ?kind=squat&reps=8&turn=0&speed=1&model=f  turn: extra camera angle in degrees. Sets window.stage = {started, done}.
 * ?asana=vrikshasana&secs=6  instead holds one yoga asana's demo pose for that long (tools/video-bench/yoga.mjs). */
import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {Avatar3D} from '@/components/avatar-3d';
import {MOVES} from '@/lib/pose/exercise-motions';
import {EXERCISES,gearOf,type ExerciseKind} from '@/lib/pose/types';
import {EXERCISE_CONFIG} from '@/lib/pose/exercise-config';
import {DEFAULT_LOOK,type AvatarLook} from '@/lib/avatar-look';
import {ASANA_BY_ID,moveOf} from '@/lib/yoga/asanas';

const q=new URLSearchParams(location.search),kind=(q.get('kind')??'squat') as ExerciseKind,reps=Number(q.get('reps')??8),speed=Number(q.get('speed')??1);
const look:AvatarLook|null=q.get('look')?{...DEFAULT_LOOK,...JSON.parse(q.get('look')!)}:null;
const turn=Number(q.get('turn')??0)*Math.PI/180,model=(q.get('model')??'f') as 'f'|'m';
const asana=ASANA_BY_ID[q.get('asana')??''],secs=Number(q.get('secs')??6);
const stage={started:0,done:false,repMs:asana?secs*1000/Math.max(1,reps):1300*MOVES[kind].keys.length/speed,oneAngle:asana?false:!EXERCISE_CONFIG[kind].bothAngles,plane:asana?asana.view:EXERCISE_CONFIG[kind].plane};(window as unknown as {stage:typeof stage}).stage=stage;

function Stage(){
 const [on,setOn]=useState(true);
 useEffect(()=>{const id=setInterval(()=>{const ready=document.querySelector('.avatar-3d[data-ready]');if(ready&&!stage.started)stage.started=performance.now();
  if(stage.started&&performance.now()-stage.started>=reps*stage.repMs+300){setOn(false);stage.done=true;clearInterval(id);}},50);return ()=>clearInterval(id);},[]);
 return <div style={{position:'fixed',inset:0,background:'#e9eef2'}}>{on&&<div style={{width:'100%',height:'100%'}}><Avatar3D move={asana?moveOf(asana):MOVES[kind]} gear={asana?'body':gearOf(kind)} title={asana?asana.english:EXERCISES[kind].title} playing onFail={()=>{document.title='avatar failed';}} speed={speed} model={model} showAngle={false} turn={turn} sway={false} look={look}/></div>}</div>;
}
createRoot(document.getElementById('root')!).render(<Stage/>);

/* Developer tool: runs recorded exercise videos through exactly what the camera page uses (the pose worker, SessionTracker
 * and LiveCoach), frame by frame at a fixed rate, and returns what was counted and what the coach said.
 * Driven by tools/video-bench/run.mjs. The videos stay on this computer: they are read from the local dev server. */
import {LiveCoach} from '@/lib/pose/live-coach';
import {focusPerson,normalize} from '@/lib/pose/landmarks';
import {SessionTracker} from '@/lib/pose/session-tracker';
import type {ExerciseKind,PoseFrame} from '@/lib/pose/types';

export type BenchItem={url:string;kind:ExerciseKind;fps?:number;variant?:'full'|'lite';dump?:boolean};
export type BenchResult={url:string;kind:ExerciseKind;reps:number;said:{key:string;at:number}[];frames:number;seen:number;seconds:number;error?:string;rejections?:Record<string,number>;mismatches?:string[];trace?:[number,number,string][];landmarks?:PoseFrame[]};

let worker:Worker|null=null,clock=0;
const status=(text:string)=>{const el=document.getElementById('status');if(el)el.textContent=text;};

async function model(variant:'full'|'lite'){
 if(worker)return worker;
 const w=new Worker('/pose-worker.js');
 await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error('pose model load timed out')),90000);
  w.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(t);resolve();}else if(data.type==='error'){clearTimeout(t);reject(Error(data.message));}};
  w.postMessage({type:'init',variant});});
 worker=w;return w;
}

function detect(w:Worker,bitmap:ImageBitmap,width:number,height:number):Promise<PoseFrame|null>{
 const timestamp=++clock*1000/30;   // the model needs increasing times across every video
 return new Promise(resolve=>{w.onmessage=({data})=>{if(data.type==='pose')resolve(data as PoseFrame);else if(data.type==='skip'||data.type==='error')resolve(null);};
  w.postMessage({type:'frame',bitmap,timestamp,width,height},[bitmap]);});
}

const seek=(v:HTMLVideoElement,t:number)=>new Promise<void>(resolve=>{v.onseeked=()=>resolve();v.currentTime=t;});

async function one(item:BenchItem):Promise<BenchResult>{
 const v=document.getElementById('clip') as HTMLVideoElement,fps=item.fps??15,w=await model(item.variant??'full');
 const blob=await (await fetch(item.url)).blob(),src=URL.createObjectURL(blob);
 try{
  v.src=src;await new Promise<void>((resolve,reject)=>{v.onloadeddata=()=>resolve();v.onerror=()=>reject(Error('this browser cannot play the video (try MP4/H.264 or WebM)'));});
  const tracker=new SessionTracker(item.kind),coach=new LiveCoach(item.kind,tracker.config),said:BenchResult['said']=[];
  const scale=Math.min(640/v.videoWidth,480/v.videoHeight),width=Math.round(v.videoWidth*scale),height=Math.round(v.videoHeight*scale);
  let frames=0,seen=0;const trace:[number,number,string][]=[],dumped:PoseFrame[]=[];
  for(let t=0;t<v.duration;t+=1/fps){
   await seek(v,t);frames++;
   let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(v,{resizeWidth:width,resizeHeight:height});}catch{continue;}
   const raw=await detect(w,bitmap,width,height);if(!raw)continue;
   const frame={...raw,timestamp:Math.round(t*1000)+1};   // video time, so speed and pauses are judged as filmed
   if(frame.landmarks.length)seen++;
   const f=focusPerson(frame);if(item.dump)dumped.push({...f,landmarks:f.landmarks.map(p=>p.map(l=>({x:+l.x.toFixed(4),y:+l.y.toFixed(4),z:+(l.z??0).toFixed(4),visibility:+(l.visibility??0).toFixed(3)})))});const r=tracker.frame(f);if(!r)continue;trace.push([Math.round(t*10)/10,Math.round(tracker.lastObservation?.valid?tracker.lastObservation.angle:-1),r.phase]);
   const m=coach.update(r,tracker.lastBody,normalize(f),tracker.counter,f.timestamp);if(m)said.push({key:m.key,at:Math.round(t*10)/10});
   if(frames%30===0)status(`${item.url}: ${Math.round(t)}s, ${tracker.counter.reps} reps`);
  }
  return {url:item.url,kind:item.kind,reps:tracker.counter.reps,said,frames,seen,seconds:Math.round(v.duration*10)/10,rejections:{...tracker.counter.rejections},mismatches:[...tracker.counter.mismatches],trace,...(item.dump?{landmarks:dumped}:{})};
 }catch(e){return {url:item.url,kind:item.kind,reps:0,said:[],frames:0,seen:0,seconds:0,error:e instanceof Error?e.message:String(e)};}
 finally{URL.revokeObjectURL(src);}
}

async function runBench(items:BenchItem[]){const out:BenchResult[]=[];for(const item of items)out.push(await one(item));status('done');return out;}
(window as unknown as {runBench:typeof runBench}).runBench=runBench;

import { msg } from "../i18n";
import type {PoseFrame} from './types';
/** Inference budget: when the recent average exceeds it, the frame rate steps down (24 → 20 → 15 fps). */
export const BUDGET_MS=60;const RATES=[24,20,15],WINDOW=15;
/** The model's first frame sets up the GPU and can take far longer than any later frame. */
const STALL_MS=12000,WARM_UP_MS=60000;
export type PoseStats={fps:number;averageMs:number;delegate:'GPU'|'CPU'|'';lowPerformance:boolean};
/** Browser camera errors, in words a person can act on. */
export function cameraError(error:unknown):Error{
 const name=error instanceof DOMException||error instanceof Error?error.name:'';
 if(name==='NotAllowedError'||name==='SecurityError')return Error(msg("Camera permission was denied. Allow camera access in your browser settings, or use manual workouts."));
 if(name==='NotFoundError')return Error(msg("No camera was found. Connect one, or use manual workouts."));
 if(name==='OverconstrainedError')return Error(msg("The selected camera is not available. Choose Default camera and retry."));
 if(name==='NotReadableError'||name==='AbortError')return Error(msg("The camera is being used by another app. Close it and retry, or use manual workouts."));
 return error instanceof Error?error:Error(msg("Camera unavailable. Use manual workouts."));
}
export class PoseDetectionService{
 private cancelInit:(()=>void)|null=null;private video:HTMLVideoElement|null=null;
 private worker:Worker|null=null;private stream:MediaStream|null=null;private generation=0;private timer:ReturnType<typeof setTimeout>|null=null;private watchdog:ReturnType<typeof setTimeout>|null=null;private busy=false;private inFlight=0;private lastVideo=-1;private rate=0;private slow=0;private timings:number[]=[];private delegate:PoseStats['delegate']='';
 constructor(private onFrame:(frame:PoseFrame)=>void,private onError:(message:string)=>void,private onStats?:(stats:PoseStats)=>void){}
 private stats(){const averageMs=this.timings.length?this.timings.reduce((a,b)=>a+b,0)/this.timings.length:0;this.onStats?.({fps:RATES[this.rate],averageMs:Math.round(averageMs),delegate:this.delegate,lowPerformance:this.rate>0});}
 async start(video:HTMLVideoElement,device:string,facing:'user'|'environment',onReady:()=>void,onCameraGranted?:()=>void){
  this.stop();const version=this.generation;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof Worker==='undefined'||typeof createImageBitmap==='undefined')throw Error(msg("Camera tracking needs HTTPS or localhost and a browser with Web Workers and ImageBitmap. Use manual workouts instead."));
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(device?{deviceId:{exact:device}}:{facingMode:{ideal:facing}}),width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}}});
   if(version!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video=video;video.srcObject=stream;onCameraGranted?.();await video.play();if(version!==this.generation)return;
   stream.getTracks().forEach(track=>{track.onended=()=>{if(version===this.generation)this.fail(msg("The camera disconnected. Reconnect it or use manual logging."));};});
   const worker=new Worker('/pose-worker.js');this.worker=worker;
   await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error(msg("Model loading timed out. Check local model assets, then retry."))),45000);
    this.cancelInit=()=>{clearTimeout(timeout);reject(Error(msg("Camera initialization cancelled.")));};
    worker.onerror=()=>{clearTimeout(timeout);reject(Error(msg("On-device worker unavailable. Try an updated browser or manual workouts.")));this.fail(msg("On-device worker unavailable. Use manual workouts or retry."));};
    worker.onmessage=({data})=>{
     if(version!==this.generation)return;
     if(data.type==='ready'){clearTimeout(timeout);this.cancelInit=null;this.delegate=data.delegate==='GPU'?'GPU':'CPU';this.stats();resolve();}
     else if(data.type==='error'){clearTimeout(timeout);reject(Error(data.message));this.fail(data.message);}
     else if(data.type==='skip'){this.busy=false;if(this.watchdog)clearTimeout(this.watchdog);this.watchdog=null;}
     else if(data.type==='pose'){
      this.busy=false;if(this.watchdog)clearTimeout(this.watchdog);this.watchdog=null;
      if(data.delegate&&data.delegate!==this.delegate){this.delegate=data.delegate;this.stats();}
      this.timings=[...this.timings.slice(1-WINDOW),data.ms];
      const average=this.timings.reduce((a,b)=>a+b,0)/this.timings.length;
      if(this.timings.length>=WINDOW&&average>BUDGET_MS&&this.rate<RATES.length-1){this.rate++;this.timings=[];}
      if(this.timings.length%WINDOW===0)this.stats();
      if(data.ms>180)this.slow++;else this.slow=Math.max(0,this.slow-1);
      if(this.slow>=20){this.fail(msg("This device is struggling to track smoothly. Your counts are kept; switch to manual logging."));return;}
      this.onFrame(data as PoseFrame);
     }
    };worker.postMessage({type:'init'});
   });
   if(version!==this.generation)return;onReady();
   const sample=async()=>{
    if(version!==this.generation)return;
    if(!this.busy&&video.readyState>=2&&video.currentTime!==this.lastVideo){
     this.busy=true;this.lastVideo=video.currentTime;this.inFlight++;
     try{
      const scale=Math.min(640/video.videoWidth,480/video.videoHeight),width=Math.max(1,Math.round(video.videoWidth*scale)),height=Math.max(1,Math.round(video.videoHeight*scale));
      const bitmap=await createImageBitmap(video,{resizeWidth:width,resizeHeight:height,resizeQuality:'low'});
      if(version!==this.generation){bitmap.close();return;}
      // Coarse lighting check in memory, discarded immediately; no image serialization.
      let brightness:number|undefined;
      if(typeof OffscreenCanvas!=='undefined'){const c=new OffscreenCanvas(16,12),ctx=c.getContext('2d',{willReadFrequently:true});if(ctx){ctx.drawImage(bitmap,0,0,16,12);const pixels=ctx.getImageData(0,0,16,12).data;let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;brightness=sum/(pixels.length/4);}}
      worker.postMessage({type:'frame',bitmap,timestamp:performance.now(),width,height,brightness},[bitmap]);
      this.watchdog=setTimeout(()=>this.fail(msg("Tracking stopped responding. Your camera has been shut down; retry or log manually.")),this.timings.length?STALL_MS:WARM_UP_MS);
     }catch{if(version===this.generation)this.fail(msg("A frame could not be processed. Retry or use manual workouts."));}
    }
    if(version===this.generation)this.timer=setTimeout(()=>void sample(),1000/RATES[this.rate]);
   };void sample();
  }catch(e){if(version===this.generation)this.stop(video);throw cameraError(e);}
 }
 private fail(message:string){this.stop();this.onError(message);}
 stop(video?:HTMLVideoElement){this.generation++;this.cancelInit?.();this.cancelInit=null;if(this.timer)clearTimeout(this.timer);if(this.watchdog)clearTimeout(this.watchdog);this.timer=null;this.watchdog=null;this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;const preview=video||this.video;if(preview){preview.pause();preview.srcObject=null;}this.video=null;this.busy=false;this.lastVideo=-1;this.rate=0;this.slow=0;this.timings=[];this.delegate='';}
}

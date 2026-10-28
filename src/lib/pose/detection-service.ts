import type {PoseFrame} from './types';
export class PoseDetectionService{
 private cancelInit:(()=>void)|null=null;private video:HTMLVideoElement|null=null;
 private worker:Worker|null=null;private stream:MediaStream|null=null;private generation=0;private timer:ReturnType<typeof setTimeout>|null=null;private watchdog:ReturnType<typeof setTimeout>|null=null;private busy=false;private inFlight=0;private lastVideo=-1;private interval=100;private slow=0;
 constructor(private onFrame:(frame:PoseFrame)=>void,private onError:(message:string)=>void){}
 async start(video:HTMLVideoElement,device:string,facing:'user'|'environment',onReady:()=>void,onCameraGranted?:()=>void){
  this.stop();const version=this.generation;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof Worker==='undefined'||typeof createImageBitmap==='undefined')throw Error('Camera tracking needs HTTPS or localhost and a browser with Web Workers and ImageBitmap. Use manual workouts instead.');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(device?{deviceId:{exact:device}}:{facingMode:{ideal:facing}}),width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}}});
   if(version!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video=video;video.srcObject=stream;onCameraGranted?.();await video.play();if(version!==this.generation)return;
   stream.getTracks().forEach(track=>{track.onended=()=>{if(version===this.generation)this.fail('The camera disconnected. Reconnect it or use manual logging.');};});
   const worker=new Worker('/pose-worker.js');this.worker=worker;
   await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Model loading timed out. Check local model assets, then retry.')),45000);
    this.cancelInit=()=>{clearTimeout(timeout);reject(Error('Camera initialization cancelled.'));};
    worker.onerror=()=>{clearTimeout(timeout);reject(Error('On-device worker unavailable. Try an updated browser or manual workouts.'));this.fail('On-device worker unavailable. Use manual workouts or retry.');};
    worker.onmessage=({data})=>{
     if(version!==this.generation)return;
     if(data.type==='ready'){clearTimeout(timeout);this.cancelInit=null;resolve();}
     else if(data.type==='error'){clearTimeout(timeout);reject(Error(data.message));this.fail(data.message);}
     else if(data.type==='pose'){
      this.busy=false;if(this.watchdog)clearTimeout(this.watchdog);this.watchdog=null;
      if(data.ms>180){this.interval=250;this.slow++;}else this.slow=Math.max(0,this.slow-1);
      if(this.slow>=20){this.fail('This device is struggling to track smoothly. Your counts are kept; switch to manual logging.');return;}
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
      this.watchdog=setTimeout(()=>this.fail('Tracking stopped responding. Your camera has been shut down; retry or log manually.'),12000);
     }catch{if(version===this.generation)this.fail('A frame could not be processed. Retry or use manual workouts.');}
    }
    if(version===this.generation)this.timer=setTimeout(()=>void sample(),this.interval);
   };void sample();
  }catch(e){if(version===this.generation)this.stop(video);throw e;}
 }
 private fail(message:string){this.stop();this.onError(message);}
 stop(video?:HTMLVideoElement){this.generation++;this.cancelInit?.();this.cancelInit=null;if(this.timer)clearTimeout(this.timer);if(this.watchdog)clearTimeout(this.watchdog);this.timer=null;this.watchdog=null;this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;const preview=video||this.video;if(preview){preview.pause();preview.srcObject=null;}this.video=null;this.busy=false;this.lastVideo=-1;this.interval=100;this.slow=0;}
}

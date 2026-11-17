/* Local-only worker (runs off the UI thread). Tries the GPU delegate, falls back to CPU. At most one transferred frame is outstanding.
   Starts with the "full" model (more accurate); a device that can't keep up switches to "lite" by itself, because a steady frame rate
   matters more for counting fast movements than the extra accuracy. Returns both the image points and the 3D world points (metres,
   centred on the hips), which give true joint angles from any camera position. */
const BASE='/pose/mediapipe-1.2.0-pose16-2/';  // versioned, cached for a year; keep in step with scripts/prepare-pose.mjs
const SLOW_MS=45,WINDOW=15;
let model=null,delegate='CPU',variant='full',recent=[];
const options=(d,v)=>({baseOptions:{modelAssetPath:BASE+`pose_landmarker_${v}.task`,delegate:d},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.4,minPosePresenceConfidence:.4,minTrackingConfidence:.4,outputSegmentationMasks:false});
async function create(d,v){const {FilesetResolver,PoseLandmarker}=await import(BASE+'vision_bundle.mjs');return PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(BASE+'wasm'),options(d,v));}
let switching=false;
/** Builds the new model while the old one keeps serving frames, then swaps: tracking never stops. */
async function load(v){
 let next,d;
 try{next=await create('GPU',v);d='GPU';}catch{next=await create('CPU',v);d='CPU';}
 const old=model;model=next;delegate=d;variant=v;recent=[];old?.close();
}
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   await load(data.variant==='lite'?'lite':'full');
   self.postMessage({type:'ready',delegate,variant});
  }else if(data.type==='frame'&&!model){data.bitmap?.close?.();self.postMessage({type:'skip',timestamp:data.timestamp});  // never leave a frame unanswered
  }else if(data.type==='frame'&&model){
   const started=performance.now();
   try{
    let result;
    try{result=model.detectForVideo(data.bitmap,data.timestamp);}
    catch(e){if(delegate!=='GPU')throw e;model.close();model=await create('CPU',variant);delegate='CPU';result=model.detectForVideo(data.bitmap,data.timestamp);}
    const ms=performance.now()-started;
    self.postMessage({type:'pose',delegate,variant,landmarks:result.landmarks,worldLandmarks:result.worldLandmarks,timestamp:data.timestamp,width:data.width,height:data.height,ms,brightness:data.brightness});
    recent=[...recent.slice(1-WINDOW),ms];
    if(variant==='full'&&!switching&&recent.length>=WINDOW&&recent.reduce((a,b)=>a+b,0)/recent.length>SLOW_MS){
     switching=true;load('lite').then(()=>self.postMessage({type:'ready',delegate,variant})).catch(()=>{}).finally(()=>{switching=false;});  // not awaited: frames keep flowing
    }
   }finally{data.bitmap.close();}
  }else if(data.type==='close'){model?.close();model=null;self.close();}
 }catch{data.bitmap?.close?.();model?.close();model=null;self.postMessage({type:'error',message:'On-device tracking could not run. Stop the camera and use manual workouts, or retry in an updated browser.'});}
};

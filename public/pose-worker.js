/* Local-only worker (runs off the UI thread). Tries the GPU delegate, falls back to CPU. At most one transferred frame is outstanding. */
const BASE='/pose/mediapipe-1.2.0-lite16-1/';  // versioned, cached for a year; keep in step with scripts/prepare-pose.mjs
let model=null,delegate='CPU';
const options=d=>({baseOptions:{modelAssetPath:BASE+'pose_landmarker_lite.task',delegate:d},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false});
async function create(d){const {FilesetResolver,PoseLandmarker}=await import(BASE+'vision_bundle.mjs');return PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(BASE+'wasm'),options(d));}
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   try{model=await create('GPU');delegate='GPU';}catch{model=await create('CPU');delegate='CPU';}
   self.postMessage({type:'ready',delegate});
  }else if(data.type==='frame'&&model){
   const started=performance.now();
   try{let result;try{result=model.detectForVideo(data.bitmap,data.timestamp);}catch(e){if(delegate!=='GPU')throw e;model.close();model=await create('CPU');delegate='CPU';result=model.detectForVideo(data.bitmap,data.timestamp);}self.postMessage({type:'pose',delegate,landmarks:result.landmarks,timestamp:data.timestamp,width:data.width,height:data.height,ms:performance.now()-started,brightness:data.brightness});}
   finally{data.bitmap.close();}
  }else if(data.type==='close'){model?.close();model=null;self.close();}
 }catch{data.bitmap?.close?.();model?.close();model=null;self.postMessage({type:'error',message:'On-device tracking could not run. Stop the camera and use manual workouts, or retry in an updated browser.'});}
};

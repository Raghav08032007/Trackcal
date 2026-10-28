/* Local-only CPU/WASM worker. At most one transferred frame is outstanding. */
let model=null;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FilesetResolver,PoseLandmarker}=await import('/pose/vision_bundle.mjs');
   model=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/pose/wasm'),{baseOptions:{modelAssetPath:'/pose/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'&&model){
   const started=performance.now();
   try{const result=model.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'pose',landmarks:result.landmarks,timestamp:data.timestamp,width:data.width,height:data.height,ms:performance.now()-started,brightness:data.brightness});}
   finally{data.bitmap.close();}
  }else if(data.type==='close'){model?.close();model=null;self.close();}
 }catch{data.bitmap?.close?.();model?.close();model=null;self.postMessage({type:'error',message:'On-device tracking could not run. Stop the camera and use manual workouts, or retry in an updated browser.'});}
};

import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TRACKCAL_PLAYWRIGHT_PATH||'C:/Users/ragha/AppData/Roaming/npm/node_modules/rea-agents/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();
 let publicPhoto=false;
 if(process.env.POSE_PUBLIC_PHOTO==='true'){let body;try{body=await fs.readFile('../../backend/runtime/phase4-public-pose.jpg');}catch{const response=await fetch('https://storage.googleapis.com/mediapipe-assets/pose.jpg');if(!response.ok)throw Error('Official public test image unavailable');body=Buffer.from(await response.arrayBuffer());}await page.route('**/__qa-public-pose.jpg',r=>r.fulfill({contentType:'image/jpeg',body}));publicPhoto=true;}
 if(process.env.POSE_DEBUG==='true'){
  const source=await fs.readFile('public/pose-worker.js','utf8');
  await page.route('**/pose-worker.js',r=>r.fulfill({contentType:'text/javascript',body:source.replace('}catch{','}catch(error){').replace("message:'On-device tracking could not run. Stop the camera and use manual workouts, or retry in an updated browser.'",'message:String(error),stack:error.stack')}));
 }
 await page.goto('http://127.0.0.1:3003/workouts/camera');
 const result=await page.evaluate(publicPhoto=>new Promise(resolve=>{
  const started=performance.now(),worker=new Worker('/pose-worker.js');let readyMs=0;const samples=[];
  const done=value=>{clearTimeout(timeout);worker.terminate();resolve(value);};
  const timeout=setTimeout(()=>done({error:'model timeout'}),55000);
  worker.onerror=e=>done({error:e.message});
  const frame=async()=>{let bitmap;if(publicPhoto){const r=await fetch('/__qa-public-pose.jpg');bitmap=await createImageBitmap(await r.blob());}else{const c=new OffscreenCanvas(640,480);const context=c.getContext('2d');context.fillStyle='#808080';context.fillRect(0,0,640,480);bitmap=c.transferToImageBitmap();}worker.postMessage({type:'frame',bitmap,timestamp:performance.now(),width:bitmap.width,height:bitmap.height},[bitmap]);};
  worker.onmessage=({data})=>{if(data.type==='ready'){readyMs=Math.round(performance.now()-started);void frame();}else if(data.type==='pose'){samples.push(data.ms);if(samples.length<12)void frame();else done({real_model:true,input:publicPhoto?'official MediaPipe public pose.jpg static test image':'synthetic blank image, no person',ready_ms:readyMs,samples_ms:samples,detected_people:data.landmarks.length,landmarks_per_person:data.landmarks.map(p=>p.length)});}else done(data);};
  worker.postMessage({type:'init'});
 }),publicPhoto);
 console.log(JSON.stringify(result));
 if(result.real_model)await fs.writeFile(publicPhoto?'../../docs/phase4-model-photo-performance.json':'../../docs/phase4-model-performance.json',JSON.stringify(result,null,2));else process.exitCode=1;
}finally{await browser.close();}

// Explicit asset preparation; runtime never calls a third-party inference service.
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Versioned folder so browsers can cache it for a year: change BASE here and in public/pose-worker.js together
// whenever the runtime or the model changes (the build stops if they disagree).
const BASE='/pose/mediapipe-1.2.0-lite16-1/';
if(!(await readFile(new URL('../public/pose-worker.js',import.meta.url),'utf8')).includes(`const BASE='${BASE}'`))throw Error('public/pose-worker.js must use BASE '+BASE);
const target=new URL('../public'+BASE,import.meta.url);await mkdir(target,{recursive:true});
const pkg=new URL('../node_modules/@mediapipe/tasks-vision/',import.meta.url);
await copyFile(new URL('vision_bundle.mjs',pkg),new URL('vision_bundle.mjs',target));
await mkdir(new URL('wasm/',target),{recursive:true});
for(const file of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])await copyFile(new URL('wasm/'+file,pkg),new URL('wasm/'+file,target));
const model=new URL('pose_landmarker_lite.task',target);
let data;try{data=await readFile(model);}catch{try{data=await readFile(new URL('../public/pose/pose_landmarker_lite.task',import.meta.url));}catch{const r=await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task');if(!r.ok)throw Error('Pose model download failed');data=Buffer.from(await r.arrayBuffer());}}
if(createHash('sha256').update(data).digest('hex')!=='59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a')throw Error('Unexpected pose model checksum; stop and review the source before releasing.');
await writeFile(model,data);
await copyFile(new URL('../../../docs/third_party/mediapipe-LICENSE',import.meta.url),new URL('LICENSE',target));
const manifest={runtime:'@mediapipe/tasks-vision@1.2.0',model:'pose_landmarker_lite/float16/1',model_bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),source:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'};
await writeFile(new URL('manifest.json',target),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));

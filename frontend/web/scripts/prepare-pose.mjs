// Explicit asset preparation; runtime never calls a third-party inference service.
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Versioned folder so browsers can cache it for a year: change BASE here and in public/pose-worker.js together
// whenever the runtime or a model changes (the build stops if they disagree).
const BASE='/pose/mediapipe-1.2.0-pose16-2/';
// "full" is the default: Google's benchmark gives it 62.6 mAP on workout poses against 45.0 for "lite", for a few ms more a frame.
// "lite" stays as the fallback for devices too slow for full.
const MODELS=[
 {name:'pose_landmarker_full',sha256:'5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1'},
 {name:'pose_landmarker_lite',sha256:'59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'},
 // "heavy" (30.7 MB) is measured on the video bench and offered only where it pays off (docs/VIDEO_BENCH.md, model comparison).
 {name:'pose_landmarker_heavy',sha256:'64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b'},
];
if(!(await readFile(new URL('../public/pose-worker.js',import.meta.url),'utf8')).includes(`const BASE='${BASE}'`))throw Error('public/pose-worker.js must use BASE '+BASE);
const target=new URL('../public'+BASE,import.meta.url);await mkdir(target,{recursive:true});
const pkg=new URL('../node_modules/@mediapipe/tasks-vision/',import.meta.url);
await copyFile(new URL('vision_bundle.mjs',pkg),new URL('vision_bundle.mjs',target));
await mkdir(new URL('wasm/',target),{recursive:true});
for(const file of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])await copyFile(new URL('wasm/'+file,pkg),new URL('wasm/'+file,target));
const manifest={runtime:'@mediapipe/tasks-vision@1.2.0',models:[]};
for(const {name,sha256} of MODELS){
 const source=`https://storage.googleapis.com/mediapipe-models/pose_landmarker/${name}/float16/1/${name}.task`,model=new URL(name+'.task',target);
 let data;
 for(const local of [model,new URL(`../public/pose/${name}.task`,import.meta.url)]){try{data=await readFile(local);if(createHash('sha256').update(data).digest('hex')===sha256)break;data=undefined;}catch{/* not here */}}
 if(!data){const r=await fetch(source);if(!r.ok)throw Error(`Pose model ${name} download failed`);data=Buffer.from(await r.arrayBuffer());}
 if(createHash('sha256').update(data).digest('hex')!==sha256)throw Error(`Unexpected checksum for ${name}; stop and review the source before releasing.`);
 await writeFile(model,data);manifest.models.push({model:`${name}/float16/1`,model_bytes:data.length,sha256,source});
}
await copyFile(new URL('../../../docs/third_party/mediapipe-LICENSE',import.meta.url),new URL('LICENSE',target));
await writeFile(new URL('manifest.json',target),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));

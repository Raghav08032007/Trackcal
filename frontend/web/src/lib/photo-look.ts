/* "Make my character from a photo", entirely on this device: the same pose model the camera uses finds the face in the
 * photo, a few pixels are read from the cheeks and above the forehead, and the nearest skin and hair swatches are chosen.
 * The photo is never uploaded or kept: the image and the model are released as soon as the two colours are picked. */
import {HAIR,SKIN,nearest} from './avatar-look';

type Pt={x:number;y:number;visibility?:number};
export type PhotoLook={skin:string;hair:string|null};

async function landmarks(bitmap:ImageBitmap,width:number,height:number):Promise<Pt[]|null>{
 const worker=new Worker('/pose-worker.js');
 try{
  return await new Promise<Pt[]|null>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('timeout')),60000);
   worker.onmessage=({data})=>{
    if(data.type==='ready')worker.postMessage({type:'frame',bitmap,timestamp:1,width,height},[bitmap]);
    else if(data.type==='pose'){clearTimeout(timer);resolve((data.landmarks?.[0] as Pt[]|undefined)??null);}
    else if(data.type==='error'||data.type==='skip'){clearTimeout(timer);resolve(null);}
   };
   worker.postMessage({type:'init',variant:'lite'});
  });
 }finally{worker.terminate();}
}

/** The middle colour of a small patch, so a shadow or a highlight doesn't decide it. */
function patch(img:ImageData,cx:number,cy:number,r:number):[number,number,number]|null{
 const px:[number,number,number][]=[];
 for(let y=Math.round(cy-r);y<=cy+r;y++)for(let x=Math.round(cx-r);x<=cx+r;x++){if(x<0||y<0||x>=img.width||y>=img.height)continue;const i=(y*img.width+x)*4;px.push([img.data[i],img.data[i+1],img.data[i+2]]);}
 if(px.length<5)return null;
 px.sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));return px[Math.floor(px.length/2)];
}

export async function lookFromPhoto(file:Blob):Promise<PhotoLook|null>{
 const source=await createImageBitmap(file),scale=Math.min(1,640/Math.max(source.width,source.height));
 const width=Math.round(source.width*scale),height=Math.round(source.height*scale);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 try{
  if(!ctx)return null;
  ctx.drawImage(source,0,0,width,height);
  const p=await landmarks(await createImageBitmap(canvas),width,height);if(!p||p.length<11)return null;
  const at=(i:number)=>({x:p[i].x*width,y:p[i].y*height}),seen=(i:number)=>(p[i].visibility??1)>.5;
  if(![0,2,5].every(seen))return null;   // no face clear enough: say so, rather than guess
  const img=ctx.getImageData(0,0,width,height),nose=at(0),eyeL=at(2),eyeR=at(5),eyes={x:(eyeL.x+eyeR.x)/2,y:(eyeL.y+eyeR.y)/2};
  const span=Math.hypot(eyeL.x-eyeR.x,eyeL.y-eyeR.y)||10,r=Math.max(2,span*.12);
  // Cheeks: a little way from the nose towards each ear, just below the eyes.
  const cheeks=[7,8].map(e=>{const ear=at(e),c={x:nose.x+(ear.x-nose.x)*.4,y:nose.y+(ear.y-nose.y)*.4+span*.1};return patch(img,c.x,c.y,r);}).filter(Boolean) as [number,number,number][];
  if(!cheeks.length)return null;
  const skinRgb=cheeks.map(c=>c).reduce((a,c)=>[a[0]+c[0]/cheeks.length,a[1]+c[1]/cheeks.length,a[2]+c[2]/cheeks.length],[0,0,0]) as [number,number,number];
  // Hair: above the forehead, as far above the eyes as the mouth is below them, and a bit more.
  const mouth=p[9]&&p[10]?{x:(at(9).x+at(10).x)/2,y:(at(9).y+at(10).y)/2}:{x:nose.x,y:nose.y+span*.6};
  const hairRgb=patch(img,eyes.x+(eyes.x-mouth.x)*2.1,eyes.y+(eyes.y-mouth.y)*2.1,r*1.4);
  const skin=nearest(skinRgb,SKIN);
  const differs=hairRgb&&Math.hypot(hairRgb[0]-skinRgb[0],hairRgb[1]-skinRgb[1],hairRgb[2]-skinRgb[2])>45;
  return {skin,hair:differs?nearest(hairRgb!,HAIR):null};
 }finally{source.close();ctx?.clearRect(0,0,width,height);canvas.width=0;}
}

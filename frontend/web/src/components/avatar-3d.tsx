'use client';
// A realistic 3D person doing the exercise or sport: a MakeHuman-based body (CC0, built by tools/avatar/build_avatar.py)
// whose bones follow the same keyframes the rep counter is tested on (pose3dOf), with the camera-checked joint angle
// shown live. Loaded lazily; any failure falls back to the simpler 3D figure, then to the drawing.
import { t } from "@/lib/i18n";
import {useEffect,useRef,useState} from 'react';
import type * as Three from 'three';
import type {Move} from '@/lib/pose/exercise-motions';
import type {ExerciseGear} from '@/lib/pose/types';
import {pose3dOf} from './athlete-3d';
import type {AvatarLook} from '@/lib/avatar-look';

const LEG_MS=1300,FINGER_CURL=1.25;   // radians per finger joint for a grip
/** Each body point's partner on the other side (MediaPipe's 33 points: eyes, ears, mouth corners, then odd = left from 11). */
const PARTNER=(id:number)=>id>=11?(id%2?id+1:id-1):({1:4,2:5,3:6,4:1,5:2,6:3,7:8,8:7,9:10,10:9} as Record<number,number>)[id]??id;
/** The same moment with left and right swapped: the person seen turned round, every limb still on its own side. */
function mirrorSides<T>(p:Record<number,T>){const out:Record<number,T>={};for(const id of Object.keys(p))out[Number(id)]=p[PARTNER(Number(id))]??p[Number(id)];return out;}
export type AvatarModel='f'|'m';
/** Each limb bone and the two landmarks it points between. */
const CHAINS:[bone:string,from:number,to:number][]=[['thigh_l',23,25],['calf_l',25,27],['foot_l',27,31],['thigh_r',24,26],['calf_r',26,28],['foot_r',28,32],
 ['upperarm_l',11,13],['lowerarm_l',13,15],['upperarm_r',12,14],['lowerarm_r',14,16]];
/** Where a landmark sits on the avatar, for the angle label and equipment. */
const AT:Record<number,string>={11:'upperarm_l',12:'upperarm_r',13:'lowerarm_l',14:'lowerarm_r',15:'hand_l',16:'hand_r',23:'thigh_l',24:'thigh_r',25:'calf_l',26:'calf_r',27:'foot_l',28:'foot_r'};

export function Avatar3D({move,gear,title,playing,onFail,speed=1,model='f',joint,showAngle=true,fists=false,turn=0,sway=true,look=null,snapshotKey,onSnapshot}:{move:Move;gear:ExerciseGear;title:string;playing:boolean;onFail:()=>void;speed?:number;model?:AvatarModel;joint?:readonly [number,number,number];showAngle?:boolean;fists?:boolean;/** Extra camera turn in radians (the video bench films from other angles). */turn?:number;/** The gentle camera orbit while playing; off for recordings, which film like a phone on a stand. */sway?:boolean;/** Your character's colours and accessory; null shows the coach as designed. */look?:AvatarLook|null;/** When this changes, a still picture of the scene is handed to onSnapshot (for the character card). */snapshotKey?:string;onSnapshot?:(url:string)=>void}){
 const pace=useRef(speed);pace.current=speed;
 const angleOn=useRef(showAngle);angleOn.current=showAngle;const turnRef=useRef(turn);turnRef.current=turn;const swayRef=useRef(sway);swayRef.current=sway;const lookRef=useRef(look);lookRef.current=look;const snap=useRef({key:snapshotKey,done:'' as string|undefined,frames:0,cb:onSnapshot});snap.current.key=snapshotKey;snap.current.cb=onSnapshot;
 const host=useRef<HTMLDivElement>(null),clock=useRef(0),drag=useRef({turn:0,down:false,x:0}),[ready,setReady]=useState(false);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let disposed=false,frame=0,cleanup=()=>{};
  void (async()=>{
   let THREE:typeof Three,GLTFLoader:typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
   try{THREE=await import('three');({GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js'));}catch{onFail();return;}
   if(disposed)return;
   let renderer:Three.WebGLRenderer;
   try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{onFail();return;}
   let gltf:Awaited<ReturnType<InstanceType<typeof GLTFLoader>['loadAsync']>>;
   try{gltf=await new GLTFLoader().loadAsync(`/avatar/athlete-${model}.glb`);}catch{renderer.dispose();onFail();return;}
   if(disposed){renderer.dispose();return;}
   renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
   el.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.05,20);
   try{const {RoomEnvironment}=await import('three/examples/jsm/environments/RoomEnvironment.js');const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();}catch{/* plain lights still work */}
   scene.add(new THREE.HemisphereLight(0xffffff,0xd9d2f5,.75));
   const sun=new THREE.DirectionalLight(0xfff4ea,2.4);sun.position.set(1.4,2.6,2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.radius=6;sun.shadow.bias=-.0005;Object.assign(sun.shadow.camera,{left:-1.2,right:1.2,top:1.2,bottom:-1.2});scene.add(sun);
   const rim=new THREE.DirectionalLight(0xc4b5fd,1.8);rim.position.set(-2,1.4,-2);scene.add(rim);
   const floor=new THREE.Mesh(new THREE.CircleGeometry(1.1,48),new THREE.ShadowMaterial({opacity:.26}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
   const yoga=new THREE.Mesh(new THREE.BoxGeometry(1.1,.012,.42),new THREE.MeshStandardMaterial({color:0x9b86f2,roughness:.9}));yoga.receiveShadow=true;scene.add(yoga);

   // The body: soften skin and fabric a little (a satin sheen reads as real skin and sportswear on screen).
   const body=gltf.scene;scene.add(body);const mats:Record<string,Three.MeshPhysicalMaterial[]>={};
   body.traverse(o=>{const mesh=o as Three.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    const swap=(m:Three.Material)=>{const s=m as Three.MeshStandardMaterial,p=new THREE.MeshPhysicalMaterial({color:s.color,roughness:s.roughness,metalness:0});
     if(m.name==='skin'){p.sheen=.35;p.sheenRoughness=.6;p.sheenColor=new THREE.Color(0xffd6c4);p.roughness=.55;}
     else if(m.name==='top'||m.name==='shorts'){p.sheen=.8;p.sheenRoughness=.45;p.sheenColor=new THREE.Color(m.name==='top'?0xd8ccff:0x6366f1);}
     else if(m.name==='iris'||m.name==='eye'){p.clearcoat=1;p.clearcoatRoughness=.05;}
     p.name=m.name;(mats[m.name]??=[]).push(p);m.dispose();return p;};
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(swap):swap(mesh.material);});
   const bone=(name:string)=>body.getObjectByName(name) as Three.Bone|undefined;
   const bones=Object.fromEntries([...new Set([...CHAINS.map(c=>c[0]),...Object.values(AT),'pelvis','calf_l','foot_l','ball_l','calf_r','foot_r','ball_r','lowerarm_l','hand_l','lowerarm_r','hand_r'])].map(n=>[n,bone(n)])) as Record<string,Three.Bone|undefined>;
   if(CHAINS.some(([b])=>!bones[b])||!bones.pelvis){renderer.dispose();renderer.domElement.remove();onFail();return;}   // an unexpected model: use the simpler figure
   body.updateMatrixWorld(true);
   const allBones:Three.Bone[]=[];body.traverse(o=>{if((o as Three.Bone).isBone)allBones.push(o as Three.Bone);});
   const bindLocal=new Map(allBones.map(b=>[b,b.quaternion.clone()]));
   const chest=bone('spine_03'),head=bone('head');
   /** Holding weights or boxing: fingers curled into a grip (each finger joint turned about its own side axis). */
   const grip=fists||['dumbbell','kettlebell','barbell','band'].includes(gear);
   const fingers=allBones.filter(b=>/^(index|middle|ring|pinky)_0[123]_[lr]$/.test(b.name)),thumbs=allBones.filter(b=>/^thumb_0[23]_[lr]$/.test(b.name));
   const curl=(b:Three.Bone,rad:number)=>b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),rad));
   const wp=(o:Three.Object3D)=>o.getWorldPosition(new THREE.Vector3()),wq=(o:Three.Object3D)=>o.getWorldQuaternion(new THREE.Quaternion());
   const CHILD:Record<string,string>={thigh_l:'calf_l',calf_l:'foot_l',foot_l:'ball_l',thigh_r:'calf_r',calf_r:'foot_r',foot_r:'ball_r',upperarm_l:'lowerarm_l',lowerarm_l:'hand_l',upperarm_r:'lowerarm_r',lowerarm_r:'hand_r'};
   /** Each chain bone's pointing direction, in its own space at the bind pose. */
   const dirLocal=new Map(CHAINS.map(([b])=>{const me=bones[b]!,child=bones[CHILD[b]]??bone(CHILD[b])!;return [b,wp(child).sub(wp(me)).normalize().applyQuaternion(wq(me).invert())];}));
   const v=(a:[number,number,number])=>new THREE.Vector3(...a);
   const legOf=(p:Record<number,[number,number,number]>)=>(v(p[23]).distanceTo(v(p[25]))+v(p[25]).distanceTo(v(p[27]))+v(p[24]).distanceTo(v(p[26]))+v(p[26]).distanceTo(v(p[28])))/2;
   const avatarLeg=(wp(bones.thigh_l!).distanceTo(wp(bones.calf_l!))+wp(bones.calf_l!).distanceTo(wp(bones.foot_l!))+wp(bones.thigh_r!).distanceTo(wp(bones.calf_r!))+wp(bones.calf_r!).distanceTo(wp(bones.foot_r!)))/2;
   body.scale.setScalar(legOf(pose3dOf(move,0))/avatarLeg);
   // Your character: colours from your look (the originals are kept to go back), and an accessory that follows the head or wrists.
   const original=Object.fromEntries(Object.entries(mats).map(([k,v])=>[k,{color:v[0].color.clone(),sheen:v[0].sheenColor.clone()}]));
   const PART:Record<string,keyof AvatarLook>={skin:'skin',hair:'hair',top:'top',shorts:'shorts',shoes:'shoes'};let applied:AvatarLook|null|undefined;
   const applyLook=(l:AvatarLook|null)=>{applied=l;for(const [name,key] of Object.entries(PART))for(const m of mats[name]??[]){
    if(!l){m.color.copy(original[name].color);m.sheenColor.copy(original[name].sheen);continue;}
    // The studio light and filmic tone mapping lift colours a lot (the model's own skin is #af7a58 and reads light tan), so a
    // swatch is darkened to match: what you pick is close to what you see.
    m.color.setStyle(String(l[key])).multiplyScalar(name==='skin'?.5:.42);if(name==='top'||name==='shorts')m.sheenColor.copy(m.color).lerp(new THREE.Color(0xffffff),.12);}};
   body.updateMatrixWorld(true);
   const headTop=Math.max(.06,new THREE.Box3().setFromObject(body).max.y-(head?wp(head).y:0)),capR=headTop*.62;
   const gearMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6});
   const band=new THREE.Mesh(new THREE.TorusGeometry(capR*.98,capR*.13,10,32),gearMat);
   const cap=new THREE.Group(),dome=new THREE.Mesh(new THREE.SphereGeometry(capR*1.04,24,12,0,Math.PI*2,0,Math.PI/2),gearMat),brim=new THREE.Mesh(new THREE.CylinderGeometry(capR*.95,capR*.95,capR*.06,24,1,false,-Math.PI/2,Math.PI),gearMat);
   brim.position.set(0,0,capR*.45);cap.add(dome,brim);
   const cuffs=[0,1].map(()=>new THREE.Mesh(new THREE.TorusGeometry(headTop*.24,headTop*.09,8,20),gearMat));
   for(const m of [band,cap,...cuffs]){m.traverse(o=>{o.castShadow=true;});m.visible=false;scene.add(m);}
   const zAxis=new THREE.Vector3(0,0,1);

   // Equipment, as on the simpler figure.
   const disc=new THREE.CylinderGeometry(1,1,1,28),metal=new THREE.MeshStandardMaterial({color:0x3b3d46,roughness:.35,metalness:.8}),plate=new THREE.MeshStandardMaterial({color:0x15161c,roughness:.5,metalness:.3});
   const bells=['dumbbell','kettlebell'].includes(gear)?[0,1].map(()=>{const g=new THREE.Group();const bar=new THREE.Mesh(disc,metal);bar.scale.set(.008,.12,.008);bar.rotation.z=Math.PI/2;const a=new THREE.Mesh(disc,plate),b=new THREE.Mesh(disc,plate);for(const [w,x] of [[a,-.05],[b,.05]] as const){w.scale.set(.032,.024,.032);w.rotation.z=Math.PI/2;w.position.x=x;}for(const mesh of [bar,a,b]){mesh.castShadow=true;g.add(mesh);}scene.add(g);return g;}):[];
   const barbell=gear==='barbell'?(()=>{const g=new THREE.Group(),bar=new THREE.Mesh(disc,metal);bar.scale.set(.009,.86,.009);bar.rotation.x=Math.PI/2;g.add(bar);for(const z of [-.36,.36]){const w=new THREE.Mesh(disc,plate);w.scale.set(.085,.03,.085);w.rotation.x=Math.PI/2;w.position.z=z;g.add(w);}g.traverse(o=>{o.castShadow=true;});scene.add(g);return g;})():null;

   // The angle the camera checks: a glowing dot at the joint and a live label.
   const canvas=document.createElement('canvas');canvas.width=192;canvas.height=96;const ctx=canvas.getContext('2d');
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
   const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));label.scale.set(.16,.08,1);label.renderOrder=10;scene.add(label);
   const dot=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshBasicMaterial({color:0xf59e0b,depthTest:false,transparent:true,opacity:.9}));dot.scale.setScalar(.016);dot.renderOrder=11;scene.add(dot);
   let shown=-1;
   const writeAngle=(deg:number)=>{if(!ctx||deg===shown)return;shown=deg;ctx.clearRect(0,0,192,96);ctx.fillStyle='rgba(17,24,39,.82)';ctx.beginPath();ctx.roundRect(8,14,176,68,34);ctx.fill();ctx.fillStyle='#fbbf24';ctx.font='700 44px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${deg}°`,96,49);tex.needsUpdate=true;};

   const fit=new THREE.Box3();for(let s=0;s<move.keys.length;s+=.25)for(const p of Object.values(pose3dOf(move,s)))fit.expandByPoint(v(p));
   const centre=fit.getCenter(new THREE.Vector3()),size=fit.getSize(new THREE.Vector3()),lowest=fit.min.y-.035,view=move.view;
   floor.position.set(centre.x,lowest,0);yoga.position.set(centre.x,lowest+.006,0);
   const resize=()=>{const w=el.clientWidth||300,h=el.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();
   const watcher=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);watcher?.observe(el);
   const parentQ=new THREE.Quaternion(),cur=new THREE.Quaternion(),delta=new THREE.Quaternion();

   const render=(progress:number,now:number)=>{
    const raw=pose3dOf(move,progress);
    for(const b of allBones)b.quaternion.copy(bindLocal.get(b)!);
    if(grip){for(const b of fingers)curl(b,FINGER_CURL);for(const b of thumbs)curl(b,FINGER_CURL*.5);}
    // Whole body: face where the torso faces (as the simpler figure), then put the hips where the keyframes put them.
    // When the body has to turn round to face the camera (or the floor), its left and right are swapped by swapping the
    // keyframe sides, never by flipping the facing direction alone: that mirrored the body while each limb still followed
    // its own side, so legs crossed over in jumping jacks and other front-view moves.
    const facing=(src:typeof raw)=>{const g=(id:number)=>v(src[id]);
     const sm=g(11).add(g(12)).multiplyScalar(.5),hm=g(23).add(g(24)).multiplyScalar(.5),up=sm.clone().sub(hm).normalize();
     const across=g(11).sub(g(12));if(across.length()<.05)across.set(0,0,1);across.normalize();
     const fwd=new THREE.Vector3().crossVectors(across,up).normalize();
     const toes=g(31).add(g(32)).multiplyScalar(.5).sub(g(27).add(g(28)).multiplyScalar(.5));let flip=view==='side'?fwd.dot(toes)<0:fwd.z<0;
     if(Math.abs(up.y)<.6){const hands=g(15).add(g(16)).multiplyScalar(.5),prone=hands.y<sm.y-.05,f=flip?fwd.clone().negate():fwd;if(prone?f.y>0:f.y<0)flip=!flip;}
     return {sm,hm,up,fwd,flip};};
    const first=facing(raw),p=first.flip?mirrorSides(raw):raw,q=(id:number)=>v(p[id]);
    const turned=first.flip?facing(p):first,hm=turned.hm,dirUp=turned.up,forward=turned.fwd;
    if(turned.flip)forward.negate();   // only if swapping sides didn't settle it (never seen in the keyframes)
    const side=new THREE.Vector3().crossVectors(dirUp,forward).normalize();
    body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,dirUp,forward));body.position.set(0,0,0);body.updateMatrixWorld(true);
    body.position.add(hm.clone().sub(wp(bones.pelvis!)));body.updateMatrixWorld(true);
    // Each limb bone, from the hips and shoulders outwards, turned to point where the keyframes point.
    for(const [name,from,to] of CHAINS){const b=bones[name]!,target=q(to).sub(q(from));if(target.lengthSq()<1e-8)continue;target.normalize();
     b.parent!.getWorldQuaternion(parentQ);cur.copy(parentQ).multiply(b.quaternion);
     delta.setFromUnitVectors(dirLocal.get(name)!.clone().applyQuaternion(cur),target);
     b.quaternion.copy(parentQ.clone().invert().multiply(delta.multiply(cur)));b.updateMatrixWorld(true);}
    // Alive, not a mannequin: the chest rises with each breath, and the head stays level so the eyes look ahead
    // (chest up, eyes forward) whenever the body is upright or leaning, and in line with the spine when lying down.
    if(chest&&playing){chest.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.sin(now/1500)*.018));chest.updateMatrixWorld(true);}
    if(head){const w=.55*Math.min(1,Math.max(0,(dirUp.y-.2)/.4));
     if(w>0){const target=dirUp.clone().lerp(new THREE.Vector3(0,1,0),w).normalize(),turn=new THREE.Quaternion().setFromUnitVectors(dirUp,target);
      head.parent!.getWorldQuaternion(parentQ);head.quaternion.copy(parentQ.invert().multiply(turn.multiply(wq(head))));head.updateMatrixWorld(true);}}
    for(const s of [0,1] as const){const hand=bones[s?'hand_r':'hand_l'];if(bells[s]&&hand){const fore=bones[s?'lowerarm_r':'lowerarm_l']!,g=bells[s],at=wp(hand),dir=at.clone().sub(wp(fore)).normalize();g.position.copy(at).addScaledVector(dir,.03);g.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),view==='side'?new THREE.Vector3(0,0,1):dir.clone().cross(new THREE.Vector3(0,0,1)).normalize());}}
    if(lookRef.current!==applied)applyLook(lookRef.current??null);
    {const acc=lookRef.current?.accessory??'none',gearColor=lookRef.current?.top??'#ffffff';gearMat.color.setStyle(gearColor==='#f4f4f5'?'#111827':'#ffffff');
     band.visible=acc==='headband'&&!!head;cap.visible=acc==='cap'&&!!head;cuffs.forEach(c=>{c.visible=acc==='wristbands';});
     if(head&&(band.visible||cap.visible)){const at=wp(head),up=dirUp.clone();
      // the head bone points up the neck; place on the crown, square to the spine, brim facing forward
      const crown=at.clone().addScaledVector(up,headTop*.55);
      if(band.visible){band.position.copy(crown);band.quaternion.setFromUnitVectors(zAxis,up);}
      if(cap.visible){cap.position.copy(crown);const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up,forward).normalize(),up,forward.clone().normalize());cap.quaternion.setFromRotationMatrix(basis);}
      }
     if(acc==='wristbands')for(const s of [0,1] as const){const hand=bones[s?'hand_r':'hand_l'],fore=bones[s?'lowerarm_r':'lowerarm_l'];if(!hand||!fore)continue;const a=wp(fore),b=wp(hand),dir=b.clone().sub(a).normalize();cuffs[s].position.copy(b).addScaledVector(dir,-headTop*.25);cuffs[s].quaternion.setFromUnitVectors(zAxis,dir);}}
    if(barbell){const mid=wp(bones.hand_l!).add(wp(bones.hand_r!)).multiplyScalar(.5);barbell.position.copy(mid);barbell.rotation.set(0,view==='side'?0:Math.PI/2,0);}
    if(joint&&angleOn.current&&AT[joint[1]]&&bones[AT[joint[1]]]){
     const a=q(joint[0]).sub(q(joint[1])),c=q(joint[2]).sub(q(joint[1])),deg=Math.round(a.angleTo(c)*180/Math.PI),at=wp(bones[AT[joint[1]]]!);
     writeAngle(deg);dot.position.copy(at);label.position.copy(at).addScaledVector(new THREE.Vector3().subVectors(camera.position,at).cross(new THREE.Vector3(0,1,0)).normalize(),-.11).add(new THREE.Vector3(0,.03,0));   // beside the joint, not over the limb
     label.visible=dot.visible=true;
    }else label.visible=dot.visible=false;
    const turn=turnRef.current+drag.current.turn+(playing&&swayRef.current?Math.sin(now/2600)*.22:0),angle=(view==='side'?.42:.32)+turn,distance=Math.max(size.x,size.y)*1.9+.62;   // closer than the simpler figure: the body fills the frame
    camera.position.set(centre.x+Math.sin(angle)*distance,centre.y+distance*.24,Math.cos(angle)*distance);camera.lookAt(centre.x,centre.y-.02,0);
    renderer.render(scene,camera);
    // A still for the character card: taken right after drawing (the buffer is still there), a few frames after a look change.
    const sn=snap.current;if(sn.key!==undefined&&sn.cb&&sn.key!==sn.done){if(++sn.frames>8){sn.frames=0;sn.done=sn.key;try{const src=renderer.domElement,sw=Math.min(src.width,src.height*.8),sx=(src.width-sw)/2,w=240,h=300,c=document.createElement('canvas');c.width=w;c.height=h;/* the middle of the stage, where the character stands, at the card's 4:5 */c.getContext('2d')?.drawImage(src,sx,0,sw,src.height,0,0,w,h);sn.cb(c.toDataURL('image/webp',.86));}catch{/* no picture: the card shows an icon */}}}
   };
   clock.current=playing?clock.current:Math.max(clock.current,1);render(clock.current,0);setReady(true);
   let last=performance.now();
   const tick=(now:number)=>{if(playing)clock.current+=(now-last)/LEG_MS*pace.current;last=now;render(clock.current,now);frame=requestAnimationFrame(tick);};
   if(typeof requestAnimationFrame!=='undefined')frame=requestAnimationFrame(tick);
   function cleanupNow(){cancelAnimationFrame(frame);watcher?.disconnect();renderer.dispose();scene.traverse(o=>{const mesh=o as Three.Mesh;mesh.geometry?.dispose?.();const m=mesh.material as Three.Material|Three.Material[]|undefined;(Array.isArray(m)?m:[m]).forEach(x=>x?.dispose?.());});tex.dispose();renderer.domElement.remove();}
   cleanup=cleanupNow;
   if(disposed)cleanup();
  })();
  return ()=>{disposed=true;cleanup();};
 },[move,gear,playing,onFail,model,joint,fists]);
 const press=(x:number)=>{drag.current.down=true;drag.current.x=x;},turnTo=(x:number)=>{if(!drag.current.down)return;drag.current.turn+=(x-drag.current.x)/120;drag.current.x=x;},release=()=>{drag.current.down=false;};
 return <div ref={host} className="athlete-3d avatar-3d" data-ready={ready||undefined} role="img" aria-label={t("3D coach doing {title}. Drag to turn.", { title })} onPointerDown={e=>press(e.clientX)} onPointerMove={e=>turnTo(e.clientX)} onPointerUp={release} onPointerLeave={release}/>;
}

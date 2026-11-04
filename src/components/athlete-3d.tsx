'use client';
import {useEffect,useRef,useState} from 'react';
import type * as Three from 'three';
import {MOVES,blend,full,layout,placement} from '@/lib/pose/exercise-motions';
import {EXERCISES,gearOf,type ExerciseKind} from '@/lib/pose/types';

type P2=Record<number,[number,number]>;
const LEG_MS=1300;
const SKIN=0xc68a63,SHIRT=0x6d4ae8,SHORTS=0x22223a,SHOE=0xf4f4f8,HAIR=0x2a1d17,METAL=0x3b3d46,PLATE=0x15161c,BAND=0x3fbf8f;
/** How far apart left and right sit in depth, side-on. The drawing has none, so the 3D figure adds it. */
const DEPTH:Record<number,number>={11:.1,13:.11,15:.11,23:.07,25:.07,27:.07,29:.07,31:.07};

/** One moment of a move as 3D points: the same joint layout the rep counter is tested on, with depth added. */
export function pose3d(kind:ExerciseKind,progress:number){
 const m=MOVES[kind],keys=m.keys.map(full),at=(progress%keys.length+keys.length)%keys.length,i=Math.floor(at),k=(1-Math.cos(Math.PI*(at-i)))/2;
 const p=layout(m,blend(keys[i],keys[(i+1)%keys.length],k),placement(m)) as P2,out:Record<number,[number,number,number]>={};
 for(const [id,[x,y]] of Object.entries(p)){const n=Number(id),side=n%2===1?1:-1,base=DEPTH[n-(n%2===0?1:0)]??.07;out[n]=[x,-y,m.view==='side'?side*base:0];}
 return out;
}

/** A shaded 3D athlete doing the exercise. Built lazily, so the 3D library only loads on this page. */
export function Athlete3D({kind,playing,onFail}:{kind:ExerciseKind;playing:boolean;onFail:()=>void}){
 const host=useRef<HTMLDivElement>(null),clock=useRef(0),drag=useRef({turn:0,down:false,x:0}),[ready,setReady]=useState(false);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let disposed=false,frame=0,cleanup=()=>{};
  void (async()=>{
   let THREE:typeof Three;
   try{THREE=await import('three');}catch{onFail();return;}
   if(disposed)return;
   let renderer:Three.WebGLRenderer;
   try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{onFail();return;}
   renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   el.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.05,20);
   scene.add(new THREE.HemisphereLight(0xffffff,0xb9a8ef,1.6));
   const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.position.set(1.4,2.6,2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.radius=6;Object.assign(sun.shadow.camera,{left:-1.2,right:1.2,top:1.2,bottom:-1.2});scene.add(sun);
   const rim=new THREE.DirectionalLight(0xc8b7fa,1.4);rim.position.set(-2,1.4,-2);scene.add(rim);
   const mat=(color:number,rough=.6,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
   const skin=mat(SKIN,.5),shirt=mat(SHIRT,.7),shorts=mat(SHORTS,.75),shoe=mat(SHOE,.45),hair=mat(HAIR,.85),metal=mat(METAL,.35,.8),plate=mat(PLATE,.5,.3),band=mat(BAND,.6);
   const cyl=new THREE.CylinderGeometry(1,1,1,20,1,true),ball=new THREE.SphereGeometry(1,24,16),disc=new THREE.CylinderGeometry(1,1,1,28);
   const add=(geometry:Three.BufferGeometry,material:Three.Material)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;};
   const floor=new THREE.Mesh(new THREE.CircleGeometry(1.1,48),new THREE.ShadowMaterial({opacity:.28}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
   const mat2=new THREE.Mesh(new THREE.BoxGeometry(1.1,.012,.42),mat(0x9b86f2,.9));mat2.receiveShadow=true;scene.add(mat2);
   const up=new THREE.Vector3(0,1,0),v=(a:[number,number,number])=>new THREE.Vector3(...a);
   /** A tapered segment between two joints, with a ball at each end so the joints stay rounded. */
   const segment=(material:Three.Material)=>{const tube=add(cyl,material),cap=add(ball,material);return (a:Three.Vector3,b:Three.Vector3,r1:number,r2:number)=>{const d=b.clone().sub(a),len=d.length()||1e-4;tube.position.copy(a).addScaledVector(d,.5);tube.quaternion.setFromUnitVectors(up,d.normalize());tube.scale.set((r1+r2)/2,len,(r1+r2)/2);cap.position.copy(b);cap.scale.setScalar(r2);};};
   const joint=(material:Three.Material)=>{const mesh=add(ball,material);return (at:Three.Vector3,r:number)=>{mesh.position.copy(at);mesh.scale.setScalar(r);};};
   const limbs={thigh:[segment(shorts),segment(shorts)],shin:[segment(skin),segment(skin)],knee:[joint(skin),joint(skin)],foot:[segment(shoe),segment(shoe)],upper:[segment(shirt),segment(shirt)],fore:[segment(skin),segment(skin)],hand:[joint(skin),joint(skin)],hip:[joint(shorts),joint(shorts)],shoulder:[joint(shirt),joint(shirt)]};
   const torso=add(new THREE.LatheGeometry([[.78,0],[.74,.12],[.66,.3],[.74,.5],[.92,.7],[1,.84],[.86,.95],[.5,1]].map(([r,y])=>new THREE.Vector2(r,y)),32),shirt),pelvis=add(ball,shorts),neck=segment(skin),head=add(ball,skin),cap=add(new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*.55),hair),eyes=[add(ball,plate),add(ball,plate)];
   const gear=gearOf(kind),bells=['dumbbell','kettlebell'].includes(gear)?[0,1].map(()=>{const g=new THREE.Group();const bar=new THREE.Mesh(disc,metal);bar.scale.set(.008,.12,.008);bar.rotation.z=Math.PI/2;const a=new THREE.Mesh(disc,plate),b=new THREE.Mesh(disc,plate);for(const [w,x] of [[a,-.05],[b,.05]] as const){w.scale.set(.032,.024,.032);w.rotation.z=Math.PI/2;w.position.x=x;}for(const mesh of [bar,a,b]){mesh.castShadow=true;g.add(mesh);}scene.add(g);return g;}):[];
   const barbell=gear==='barbell'?(()=>{const g=new THREE.Group(),bar=new THREE.Mesh(disc,metal);bar.scale.set(.009,.86,.009);bar.rotation.x=Math.PI/2;g.add(bar);for(const z of [-.36,.36]){const w=new THREE.Mesh(disc,plate);w.scale.set(.085,.03,.085);w.rotation.x=Math.PI/2;w.position.z=z;g.add(w);}g.traverse(o=>{o.castShadow=true;});scene.add(g);return g;})():null;
   const bands=gear==='band'?[segment(band),segment(band)]:[];
   const fit=new THREE.Box3();for(let t=0;t<MOVES[kind].keys.length;t+=.25)for(const p of Object.values(pose3d(kind,t)))fit.expandByPoint(v(p));
   const centre=fit.getCenter(new THREE.Vector3()),size=fit.getSize(new THREE.Vector3()),lowest=fit.min.y-.035,view=MOVES[kind].view;
   floor.position.set(centre.x,lowest,0);mat2.position.set(centre.x,lowest+.006,0);
   const resize=()=>{const w=el.clientWidth||300,h=el.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();
   const watcher=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);watcher?.observe(el);
   const render=(progress:number,now:number)=>{
    const p=pose3d(kind,progress),q=(id:number)=>v(p[id]);
    for(const s of [0,1] as const){
     const hip=q(23+s),knee=q(25+s),ankle=q(27+s),toe=q(31+s),shoulder=q(11+s),elbow=q(13+s),wrist=q(15+s);
     limbs.thigh[s](hip,knee,.056,.045);limbs.knee[s](knee,.044);limbs.shin[s](knee,ankle,.042,.028);limbs.foot[s](ankle,toe,.032,.03);
     limbs.upper[s](shoulder,elbow,.035,.028);limbs.fore[s](elbow,wrist,.029,.022);limbs.hand[s](wrist.clone().addScaledVector(wrist.clone().sub(elbow).normalize(),.025),.026);
     limbs.hip[s](hip,.058);limbs.shoulder[s](shoulder,.036);
     if(bells[s]){const g=bells[s],dir=wrist.clone().sub(elbow).normalize();g.position.copy(wrist).addScaledVector(dir,.045);g.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),view==='side'?new THREE.Vector3(0,0,1):dir.clone().cross(new THREE.Vector3(0,0,1)).normalize());}
     if(bands[s]){const foot=q(27+s).add(new THREE.Vector3(0,.01,0));bands[s](foot,wrist,.006,.006);}
    }
    const sm=q(11).add(q(12)).multiplyScalar(.5),hm=q(23).add(q(24)).multiplyScalar(.5),axis=sm.clone().sub(hm),len=axis.length()||1e-4,dirUp=axis.clone().normalize();
    const across=q(11).sub(q(12));if(across.length()<.05)across.set(0,0,1);across.normalize();const forward=new THREE.Vector3().crossVectors(across,dirUp).normalize();
    const toes=q(31).add(q(32)).multiplyScalar(.5).sub(q(27).add(q(28)).multiplyScalar(.5));if(view==='side'?forward.dot(toes)<0:forward.z<0)forward.negate();
    const side=new THREE.Vector3().crossVectors(dirUp,forward).normalize(),basis=new THREE.Matrix4().makeBasis(side,dirUp,forward);
    torso.position.copy(hm).addScaledVector(axis,.04);torso.quaternion.setFromRotationMatrix(basis);torso.scale.set(.118,len*1.02,.072);
    pelvis.position.copy(hm).addScaledVector(axis,.02);pelvis.quaternion.copy(torso.quaternion);pelvis.scale.set(.098,.07,.07);
    const top=sm.clone().addScaledVector(dirUp,.1);neck(sm.clone().addScaledVector(dirUp,.02),top.clone().addScaledVector(dirUp,-.04),.03,.028);
    head.position.copy(top);head.scale.set(.05,.058,.054);head.quaternion.copy(torso.quaternion);
    cap.position.copy(top).addScaledVector(dirUp,.006).addScaledVector(forward,-.008);cap.quaternion.copy(torso.quaternion);cap.scale.set(.054,.062,.058);
    eyes.forEach((eye,index)=>{eye.position.copy(top).addScaledVector(forward,.049).addScaledVector(dirUp,.008).addScaledVector(across,index?.019:-.019);eye.scale.setScalar(.0065);});
    if(barbell){const mid=q(15).add(q(16)).multiplyScalar(.5);barbell.position.copy(mid).addScaledVector(forward,view==='side'?.02:0);barbell.rotation.set(0,view==='side'?0:Math.PI/2,0);}
    const turn=drag.current.turn+(playing?Math.sin(now/2600)*.22:0),angle=(view==='side'?.42:.32)+turn,distance=Math.max(size.x,size.y)*2.35+.9;
    camera.position.set(centre.x+Math.sin(angle)*distance,centre.y+distance*.24,Math.cos(angle)*distance);camera.lookAt(centre.x,centre.y-.02,0);
    renderer.render(scene,camera);
   };
   clock.current=playing?clock.current:Math.max(clock.current,1);render(clock.current,0);setReady(true);
   let last=performance.now();
   const tick=(now:number)=>{if(playing)clock.current+=(now-last)/LEG_MS;last=now;render(clock.current,now);frame=requestAnimationFrame(tick);};
   if(typeof requestAnimationFrame!=='undefined')frame=requestAnimationFrame(tick);
   cleanup=()=>{cancelAnimationFrame(frame);watcher?.disconnect();renderer.dispose();scene.traverse(o=>{const mesh=o as Three.Mesh;mesh.geometry?.dispose?.();const m=mesh.material as Three.Material|undefined;m?.dispose?.();});renderer.domElement.remove();};
   if(disposed)cleanup();
  })();
  return ()=>{disposed=true;cleanup();};
 },[kind,playing,onFail]);
 const press=(x:number)=>{drag.current.down=true;drag.current.x=x;},move=(x:number)=>{if(!drag.current.down)return;drag.current.turn+=(x-drag.current.x)/120;drag.current.x=x;},release=()=>{drag.current.down=false;};
 return <div ref={host} className="athlete-3d" data-ready={ready||undefined} role="img" aria-label={`3D example of ${EXERCISES[kind].title}. Drag to turn the athlete.`} onPointerDown={e=>press(e.clientX)} onPointerMove={e=>move(e.clientX)} onPointerUp={release} onPointerLeave={release}/>;
}

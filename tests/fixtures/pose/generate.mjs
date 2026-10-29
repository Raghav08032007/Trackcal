// Generates the synthetic landmark fixtures in this folder (run: node tests/fixtures/pose/generate.mjs).
// These are NOT recordings of people: each frame is a side-view skeleton posed from a known joint-angle curve, so the
// right rep count is known exactly. Seeded noise keeps every run identical. Real recordings replace them when the
// manual device matrix (docs/TEST_REPORT_P3.md) is done.
// Files are gzipped JSON (*.json.gz). Format: { exercise, scenario, synthetic, fps, width, height, base: [[x,y,visibility] x33], frames: [{ t, p: {id:[x,y,v]} }] }
// where p lists only landmarks that differ from base. Coordinates are MediaPipe-normalised (0..1 of width/height).
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const W=640,H=480,R=W/H,FPS=20,DT=1000/FPS;
let seed=1;const rand=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const gauss=()=>Math.sqrt(-2*Math.log(rand()||1e-9))*Math.cos(2*Math.PI*rand());
const rot=(v,deg)=>{const r=deg*Math.PI/180;return {x:v.x*Math.cos(r)-v.y*Math.sin(r),y:v.x*Math.sin(r)+v.y*Math.cos(r)};};
const unit=(a,b)=>{const x=b.x-a.x,y=b.y-a.y,n=Math.hypot(x,y);return {x:x/n,y:y/n};};
const add=(a,v,k=1)=>({x:a.x+v.x*k,y:a.y+v.y*k});
// Skeleton in aspect-corrected space (x in 0..R), for a joint angle in degrees. Returns 33 points (left side ids odd).
function skeleton(ex,angle){
 const p={};let S,E,Wr,Hp,K,A;
 if(ex==='squat'){A={x:.62,y:.86};K={x:.70,y:.66};Hp=add(K,rot(unit(K,A),-angle),.22);S=add(Hp,{x:.04,y:-.26});E=add(S,{x:.07,y:.08});Wr=add(E,{x:.09,y:0});}
 if(ex==='pushup'){Wr={x:.26,y:.84};E={x:.26,y:.69};S=add(E,rot(unit(E,Wr),-angle),.16);Hp=add(S,{x:.34,y:.03});K=add(Hp,{x:.18,y:.02});A=add(K,{x:.18,y:.02});}
 if(ex==='curl'){S={x:.66,y:.30};E={x:.67,y:.50};Wr=add(E,rot(unit(E,S),-angle),.17);Hp={x:.68,y:.62};K={x:.68,y:.78};A={x:.68,y:.93};}
 for(let i=0;i<=10;i++)p[i]={x:S.x+.01*(i%3),y:S.y-.08-.005*i};
 const sides={11:S,13:E,15:Wr,17:Wr,19:Wr,21:Wr,23:Hp,25:K,27:A,29:A,31:A};
 for(const [id,pt] of Object.entries(sides)){p[id]={...pt};p[+id+1]={x:pt.x+.02,y:pt.y};}
 return Array.from({length:33},(_,i)=>p[i]);
}
// Angle curve: hold at the top, then reps (cosine down and back up), then hold at the top.
function curve(top,bottom,reps,period,{hold=1000,depths}={}){
 const points=[];let t=0;
 for(;t<hold;t+=DT)points.push([t,top]);
 for(let r=0;r<reps;r++){const low=depths?top-(top-bottom)*depths[r]:bottom;for(let s=0;s<period;s+=DT,t+=DT)points.push([t,top-(top-low)*(1-Math.cos(2*Math.PI*s/period))/2]);}
 for(let end=t+hold;t<end;t+=DT)points.push([t,top]);
 return points;
}
const RANGE={squat:[175,85],pushup:[170,80],curl:[165,40]};
const REQUIRED={squat:[11,23,25,27],pushup:[11,13,15,23,27],curl:[11,13,15,23]};
function build(ex,scenario){
 seed=[...ex+scenario].reduce((n,c)=>n*31+c.charCodeAt(0)|0,7);
 const [top,bottom]=RANGE[ex];let pts;
 const options={clean:[5,2000],noisy:[5,2000],half_reps:[6,2000,{depths:[1,.4,1,.4,1,.4]}],occlusion:[5,2000],walk_out:[3,2000,{hold:1000}],very_fast:[6,450],very_slow:[2,7000]}[scenario];
 pts=curve(top,bottom,options[0],options[1],options[2]);
 if(scenario==='walk_out'){const last=pts.at(-1)[0];for(let t=last+DT;t<=last+4000;t+=DT)pts.push([t,top]);}
 const raw=pts.map(([t,a])=>{
  let s=skeleton(ex,a).map(q=>({x:q.x,y:q.y,v:.95}));
  for(let i=0;i<33;i++)if(i%2===0&&i>=12)s[i].v=.9;  // right side a little less visible: the left side is tracked
  if(scenario==='noisy')s=s.map(q=>({x:q.x+gauss()*.006,y:q.y+gauss()*.006,v:Math.min(.99,Math.max(.7,q.v+gauss()*.05))}));
  if(scenario==='occlusion'&&t>=5700&&t<6500)for(const id of REQUIRED[ex])s[id].v=s[id+1].v=.2; // a chair blocks the body during rep 3's descent
  if(scenario==='walk_out'){const start=pts.length?pts[pts.length-1][0]-4000:0,k=Math.max(0,Math.min(1,(t-start)/2000));s=s.map(q=>({...q,x:q.x+k*.9}));}
  return {t,s:s.map(q=>[+(q.x/R).toFixed(3),+q.y.toFixed(3),+q.v.toFixed(2)])};
 });
 const base=raw[0].s;
 const frames=raw.map(({t,s})=>({t:+t.toFixed(1),p:Object.fromEntries(s.map((q,i)=>[i,q]).filter(([i,q])=>q.some((v,j)=>v!==base[i][j])))}));
 return {exercise:ex,scenario,synthetic:true,fps:FPS,width:W,height:H,base,frames};
}
for(const ex of ['squat','pushup','curl'])for(const sc of ['clean','noisy','half_reps','occlusion','walk_out','very_fast','very_slow'])
 writeFileSync(new URL(`./${ex}-${sc}.json.gz`,import.meta.url),gzipSync(JSON.stringify(build(ex,sc)),{level:9}));
console.log('fixtures written');

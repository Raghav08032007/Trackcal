/** The live distance shown while recording. The saved numbers are measured on the server from every fix (backend/services/activity_stats.py);
 *  this follows the same ideas with only the last half minute in hand, so what you watch stays close to what gets saved. */
export type Fix={lat:number;lon:number;accuracy:number;t:number};
const R=6371000,rad=(d:number)=>d*Math.PI/180;
export function metresBetween(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
/** Rough fixes are ignored, one-off jumps are dropped, and distance only grows while you are clearly moving. */
export const MAX_ACCURACY_M=35,MIN_STEP_M=3,MAX_SPEED_MS=12;
const KEEP_S=30,SMOOTH_S=6,MOVING_MS=.3;
type Kept=Fix&{w:number};
function centre(points:Kept[]){const w=points.reduce((s,p)=>s+p.w,0);return {lat:points.reduce((s,p)=>s+p.lat*p.w,0)/w,lon:points.reduce((s,p)=>s+p.lon*p.w,0)/w,t:points.reduce((s,p)=>s+p.t,0)/points.length};}
export class RouteMeter{
 metres=0;points=0;private recent:Kept[]=[];private anchor:{lat:number;lon:number}|null=null;
 add(fix:Fix){
  if(!(fix.accuracy<=MAX_ACCURACY_M)||!Number.isFinite(fix.lat)||!Number.isFinite(fix.lon))return false;
  const last=this.recent[this.recent.length-1];
  if(last&&fix.t<=last.t)return false;
  // A one-off jump is far from where the last few seconds put you.
  const near=this.recent.filter(p=>fix.t-p.t<=10000);
  if(near.length>=3){const mid=(k:'lat'|'lon')=>near.map(p=>p[k]).sort((a,b)=>a-b)[near.length>>1];if(metresBetween({lat:mid('lat'),lon:mid('lon')},fix)>MAX_SPEED_MS*5+3*Math.max(fix.accuracy,10))return false;}
  this.recent.push({...fix,w:1/Math.max(fix.accuracy,3)**2});this.points++;
  this.recent=this.recent.filter(p=>fix.t-p.t<=KEEP_S*1000);
  const here=centre(this.recent.filter(p=>fix.t-p.t<=SMOOTH_S*1000));
  // Moving: where the fixes cluster over the last 10 s against the 10 s before, clearly apart and at least a slow walk.
  const early=this.recent.filter(p=>fix.t-p.t>10000&&fix.t-p.t<=20000),late=this.recent.filter(p=>fix.t-p.t<=10000);
  let moving=false;
  if(early.length>=2&&late.length>=2){
   const a=centre(early),b=centre(late),shift=metresBetween(a,b),noise=Math.max(3,[...this.recent].sort((x,y)=>x.accuracy-y.accuracy)[this.recent.length>>1].accuracy);
   moving=shift/((b.t-a.t)/1000)>=MOVING_MS&&shift>2*noise*Math.sqrt(1/early.length+1/late.length);
  }
  if(!moving||!this.anchor){this.anchor=here;return false;}
  const step=metresBetween(this.anchor,here);
  if(step<MIN_STEP_M)return false;
  this.metres+=step;this.anchor=here;return true;
 }
 /** Forget the recent points so a pause doesn't draw a line across wherever you went meanwhile. */
 pause(){this.recent=[];this.anchor=null;}
}
export const paceText=(metres:number,ms:number)=>metres<50?'–':(()=>{const perKm=ms/1000/(metres/1000),m=Math.floor(perKm/60),s=Math.round(perKm%60);return `${m}:${String(s===60?0:s).padStart(2,'0')} /km`;})();

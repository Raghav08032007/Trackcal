/** GPS walking and running, written for TrackCal. The route stays in memory; only distance and time are saved. */
export type Fix={lat:number;lon:number;accuracy:number;t:number};
const R=6371000,rad=(d:number)=>d*Math.PI/180;
export function metresBetween(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
/** Rough fixes are ignored, tiny steps are GPS wobble, and impossible speeds are jumps, not movement. */
export const MAX_ACCURACY_M=35,MIN_STEP_M=3,MAX_SPEED_MS=12;
export class RouteMeter{
 metres=0;movingMs=0;points=0;private last:Fix|null=null;
 add(fix:Fix){
  if(!(fix.accuracy<=MAX_ACCURACY_M)||!Number.isFinite(fix.lat)||!Number.isFinite(fix.lon))return false;
  if(!this.last){this.last=fix;this.points=1;return true;}
  const step=metresBetween(this.last,fix),seconds=(fix.t-this.last.t)/1000;
  if(seconds<=0)return false;
  if(step<Math.max(MIN_STEP_M,fix.accuracy/4))return false;
  if(step/seconds>MAX_SPEED_MS){this.last=fix;return false;}
  this.metres+=step;this.movingMs+=Math.min(seconds,30)*1000;this.last=fix;this.points++;return true;
 }
 /** Forget the last point so a pause doesn't draw a line across wherever you walked meanwhile. */
 pause(){this.last=null;}
}
export const paceText=(metres:number,ms:number)=>metres<50?'–':(()=>{const perKm=ms/1000/(metres/1000),m=Math.floor(perKm/60),s=Math.round(perKm%60);return `${m}:${String(s===60?0:s).padStart(2,'0')} /km`;})();

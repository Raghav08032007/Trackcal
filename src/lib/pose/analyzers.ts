import {angle,confidence,normalize,visible} from './landmarks';
import type {Observation,PoseFrame} from './types';
export interface ExerciseAnalyzer{observe(frame:PoseFrame):Observation;reset():void;}
export abstract class JointAnalyzer implements ExerciseAnalyzer{
 private side:number|null=null;private center:{x:number;y:number}|null=null;
 abstract groups:number[][];abstract joint:number[][];
 protected suitable(p:NonNullable<ReturnType<typeof normalize>>,side:number):boolean{return p.length===33&&side>=0;}
 reset(){this.side=null;this.center=null;}
 observe(frame:PoseFrame):Observation{
  const p=normalize(frame),bad=(reason:string,quality=0)=>({angle:0,confidence:quality,valid:false,reason});
  if(!p)return bad(frame.landmarks.length>1?'Only one person should be in view.':'Try keeping your full body visible.');
  if(frame.brightness!==undefined&&frame.brightness<28)return bad('Try a brighter, evenly lit space.');
  if(this.side===null){const a=confidence(p,this.groups[0]),b=confidence(p,this.groups[1]);this.side=a>=b?0:1;}
  const ids=this.groups[this.side],quality=confidence(p,ids);
  if(quality<.65||!visible(frame,ids))return bad('Tracking confidence is low. Adjust the camera or use manual logging.',quality);
  const center={x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2};
  const moved=this.center&&Math.hypot(center.x-this.center.x,center.y-this.center.y)>.18;this.center=center;
  if(moved)return bad('The view moved. Hold the camera steady and return to your starting position.',quality);
  if(!this.suitable(p,this.side))return bad('The movement is not clear from this angle. Adjust the camera.',quality);
  const [a,b,c]=this.joint[this.side],degrees=angle(p[a],p[b],p[c]);
  return Number.isFinite(degrees)?{angle:degrees,confidence:quality,valid:true,reason:''}:bad('The movement was not detected clearly.',quality);
 }
}

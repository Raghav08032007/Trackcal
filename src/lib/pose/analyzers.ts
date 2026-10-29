import {angle,confidence,normalize,visible} from './landmarks';
import {OneEuroFilter} from './one-euro';
import type {ExerciseConfig} from './exercise-config';
import type {Landmark,Observation,PoseFrame} from './types';
export interface ExerciseAnalyzer{observe(frame:PoseFrame):Observation;reset():void;}
/** Measures one joint angle per frame from the config's triplet on the more visible body side. Landmarks are
 *  aspect-corrected before the angle is taken (normalize), and the three joint points are smoothed. */
export class JointAnalyzer implements ExerciseAnalyzer{
 side:0|1|null=null;private center:{x:number;y:number}|null=null;private filters:OneEuroFilter[]=[];
 constructor(readonly config:ExerciseConfig){this.resetFilters();}
 private resetFilters(){const {minCutoff,beta}=this.config.smoothing;this.filters=Array.from({length:6},()=>new OneEuroFilter(minCutoff,beta));}
 reset(){this.side=null;this.center=null;this.resetFilters();}
 observe(frame:PoseFrame):Observation{
  const c=this.config,p=normalize(frame),bad=(reason:string,quality=0)=>{this.resetFilters();return {angle:0,confidence:quality,valid:false,reason};};
  if(!p)return bad(frame.landmarks.length>1?'Only one person should be in view.':'Step back so your whole body is in frame.');
  if(frame.brightness!==undefined&&frame.brightness<28)return bad('Try a brighter, evenly lit space.');
  const q=[confidence(p,c.required[0]),confidence(p,c.required[1])] as const;
  if(this.side===null)this.side=q[0]>=q[1]?0:1;
  else if(q[this.side]<c.minVisibility&&q[1-this.side]>=c.minVisibility){
   // The tracked side is hidden but the other is clear (person turned round): switch, and restart the movement.
   this.side=this.side===0?1:0;return bad('Switched to the side the camera can see. Start the next rep from the top.',q[this.side]);
  }
  const side=this.side,ids=c.required[side],quality=q[side];
  if(quality<c.minVisibility||!visible(frame,ids))return bad('Step back so your whole body is in frame.',quality);
  const center={x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2};
  const moved=this.center&&Math.hypot(center.x-this.center.x,center.y-this.center.y)>.18;this.center=center;
  if(moved)return bad('The view moved. Hold the camera steady and return to your starting position.',quality);
  if(c.suitable&&!c.suitable(p,side))return bad('The movement is not clear from this angle. Adjust the camera.',quality);
  const joint=c.joints[side].map((id,i):Landmark=>({x:this.filters[i*2].filter(p[id].x,frame.timestamp),y:this.filters[i*2+1].filter(p[id].y,frame.timestamp)}));
  const degrees=angle(joint[0],joint[1],joint[2]);
  return Number.isFinite(degrees)?{angle:degrees,confidence:quality,valid:true,reason:''}:bad('The movement was not detected clearly.',quality);
 }
}

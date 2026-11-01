import {angle,confidence,normalize,visible} from './landmarks';
import {OneEuroFilter} from './one-euro';
import type {ExerciseConfig} from './exercise-config';
import type {Landmark,Observation,PoseFrame} from './types';
export interface ExerciseAnalyzer{observe(frame:PoseFrame):Observation;reset():void;}
/** Measures one joint angle per frame from the config's triplet on the more visible body side. Landmarks are
 *  aspect-corrected before the angle is taken (normalize), and the three joint points are smoothed. */
export class JointAnalyzer implements ExerciseAnalyzer{
 side:0|1|null=null;private center:{x:number;y:number}|null=null;private filters:OneEuroFilter[]=[];private reach=0;private span:number|null=null;private top:number|null=null;private torso=0;private shoulders:number|null=null;
 constructor(readonly config:ExerciseConfig){this.resetFilters();}
 private resetFilters(){const {minCutoff,beta}=this.config.smoothing;this.filters=Array.from({length:6},()=>new OneEuroFilter(minCutoff,beta));}
 reset(){this.side=null;this.center=null;this.reach=0;this.span=null;this.clearDrop();this.resetFilters();}
 private clearDrop(){this.top=null;this.torso=0;this.shoulders=null;}
 observe(frame:PoseFrame):Observation{
  const c=this.config,p=normalize(frame),bad=(reason:string,quality=0)=>{this.resetFilters();return {angle:0,confidence:quality,valid:false,reason};};
  if(!p)return bad(frame.landmarks.length>1?'Only one person should be in view.':'Step back so your whole body is in frame.');
  if(frame.brightness!==undefined&&frame.brightness<28)return bad('Try a brighter, evenly lit space.');
  const q=[confidence(p,c.required[0]),confidence(p,c.required[1])] as const;
  if(this.side===null)this.side=q[0]>=q[1]?0:1;
  else if(q[this.side]<c.minVisibility&&q[1-this.side]>=c.minVisibility){this.side=this.side===0?1:0;this.resetFilters();}  // the far side flickers side-on; the rep carries on
  const side=this.side,ids=c.required[side],quality=q[side];
  if(quality<c.minVisibility||!visible(frame,ids))return bad('Step back so your whole body is in frame.',quality);
  const center={x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2};
  const moved=this.center&&Math.hypot(center.x-this.center.x,center.y-this.center.y)>.18;this.center=center;
  if(moved){this.reach=0;this.span=null;this.clearDrop();return bad('The view moved. Hold the camera steady and return to your starting position.',quality);}
  if(c.suitable&&!c.suitable(p,side))return bad('The movement is not clear from this angle. Adjust the camera.',quality);
  const joint=c.joints[side].map((id,i):Landmark=>({x:this.filters[i*2].filter(p[id].x,frame.timestamp),y:this.filters[i*2+1].filter(p[id].y,frame.timestamp)}));
  const extra=c.optional?.[side],legs=!extra||(confidence(p,extra)>=c.minVisibility&&visible(frame,extra));
  const degrees=Math.min(legs?angle(joint[0],joint[1],joint[2]):Infinity,legs?this.spanAngle(p,side):Infinity,c.drop?this.dropAngle(p):Infinity);
  return Number.isFinite(degrees)?{angle:degrees,confidence:quality,valid:true,reason:''}:bad('The movement was not detected clearly.',quality);
 }
 /** Shoulders drop as a squat goes down, whatever is in frame. Depth is that drop in torso lengths, from the standing height, in the same
  *  degrees as the knee: half a torso is about a thigh-level squat. */
 private dropAngle(p:Landmark[]){
  const shoulders=(p[11].y+p[12].y)/2,hips=(p[23].y+p[24].y)/2;
  this.shoulders=this.shoulders===null?shoulders:this.shoulders*.4+shoulders*.6;
  this.top=this.top===null?this.shoulders:Math.min(this.shoulders,this.top+.0004);
  this.torso=Math.max(hips-this.top,this.torso*.999);
  return this.torso>0?180-(this.shoulders-this.top)/this.torso*165:Infinity;
 }
 /** A bent joint seen head-on still looks straight, but its limb ends get closer. Two equal segments span 2·L·sin(θ/2),
  *  and L comes from the longest span seen recently, so this reads like the joint angle from any view. */
 private spanAngle(p:Landmark[],side:0|1){
  const ends=this.config.span?.[side];if(!ends)return Infinity;
  const raw=Math.hypot(p[ends[0]].x-p[ends[1]].x,p[ends[0]].y-p[ends[1]].y);
  this.span=this.span===null?raw:this.span*.4+raw*.6;this.reach=Math.max(this.span,this.reach*.999);
  // Near full reach asin is so steep that tracking noise reads as a bend, so the top 4% counts as straight.
  return this.reach>0?2*Math.asin(Math.min(1,this.span/(this.reach*.96)))*180/Math.PI:Infinity;
 }
}

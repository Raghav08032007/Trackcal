import {angle} from './landmarks';
import type {Landmark} from './types';
/** What the whole body is doing in one frame, in torso lengths and degrees, so one exercise can be told from another.
 *  Anything out of view reads NaN. Every comparison with NaN is false, so a hidden body part can never fail a check:
 *  a laptop that only sees someone from the hips up keeps counting. */
export type BodyPart='shoulders'|'elbows'|'wrists'|'hips'|'knees'|'ankles';
export type Body={
 /** Torso lean from upright: 0 standing tall, 90 flat along the floor. */
 tilt:number;
 /** Torso length against the longest seen this set. Bending towards the camera shortens it, with no lean to see. */
 torso:number;
 knee:number;kneeWide:number;kneeGap:number;hip:number;hipWide:number;hipGap:number;elbow:number;elbowWide:number;
 /** Highest hand above the shoulders; negative is below them. The lower hand is wristLow. */
 wristUp:number;wristLow:number;
 /** How far the nearest hand is from the chest. */
 wristChest:number;
 /** Feet apart across the picture, and how far one foot sits above the other in it. */
 stance:number;footStep:number;
 /** Shoulder width. Facing the camera it is about two thirds of the torso; side-on it nearly vanishes. */
 facing:number;
 /** Shoulders below the hips, as in a pike. */
 headDown:number;
 /** Highest knee above the hips, and how far the hands are above the feet. */
 kneeUp:number;handHeight:number;
 points:Record<BodyPart,[Landmark|null,Landmark|null]>;
 scale:number;
};
const IDS:Record<BodyPart,[number,number]>={shoulders:[11,12],elbows:[13,14],wrists:[15,16],hips:[23,24],knees:[25,26],ankles:[27,28]};
const SEEN=.5;
const low=(a:number,b:number)=>Number.isNaN(a)?b:Number.isNaN(b)?a:Math.min(a,b);
const high=(a:number,b:number)=>Number.isNaN(a)?b:Number.isNaN(b)?a:Math.max(a,b);
const middle=(a:Landmark|null,b:Landmark|null)=>a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a||b;
export function readBody(p:Landmark[],longest:number):Body{
 const at=(id:number)=>{const l=p[id];return l&&(l.visibility??0)>=SEEN&&(l.presence??1)>=SEEN&&l.y>.01&&l.y<.97?l:null;};
 const part=(name:BodyPart):[Landmark|null,Landmark|null]=>[at(IDS[name][0]),at(IDS[name][1])];
 const points={shoulders:part('shoulders'),elbows:part('elbows'),wrists:part('wrists'),hips:part('hips'),knees:part('knees'),ankles:part('ankles')};
 const s=middle(...points.shoulders),h=middle(...points.hips);
 // Hips out of frame: shoulder width stands in for the torso, which is about 1.5 of them.
 const shoulderWidth=points.shoulders[0]&&points.shoulders[1]?Math.hypot(points.shoulders[0].x-points.shoulders[1].x,points.shoulders[0].y-points.shoulders[1].y):NaN;
 const length=s&&h?Math.hypot(s.x-h.x,s.y-h.y):NaN,scale=Math.max(Number.isNaN(length)?shoulderWidth*1.5||.2:length,longest*.6,.05);
 const joint=(a:BodyPart,b:BodyPart,c:BodyPart,i:0|1)=>{const x=points[a][i],y=points[b][i],z=points[c][i];return x&&y&&z?angle(x,y,z):NaN;};
 const knees=[joint('hips','knees','ankles',0),joint('hips','knees','ankles',1)],hips=[joint('shoulders','hips','knees',0),joint('shoulders','hips','knees',1)],elbows=[joint('shoulders','elbows','wrists',0),joint('shoulders','elbows','wrists',1)];
 const lift=(i:0|1)=>{const w=points.wrists[i],t=points.shoulders[i];return w&&t?(t.y-w.y)/scale:NaN;};
 const chest=(i:0|1)=>{const w=points.wrists[i];return w&&s?Math.hypot(w.x-s.x,w.y-(s.y+scale*.2))/scale:NaN;};
 const raised=(i:0|1)=>{const k=points.knees[i];return k&&h?(h.y-k.y)/scale:NaN;};
 const above=(i:0|1)=>{const w=points.wrists[i],a=points.ankles[i];return w&&a?(a.y-w.y)/scale:NaN;};
 const [ankleA,ankleB]=points.ankles;
 return {tilt:s&&h?Math.atan2(Math.abs(s.x-h.x),Math.abs(s.y-h.y))*180/Math.PI:NaN,torso:Number.isNaN(length)||!longest?NaN:length/Math.max(longest,length),
  knee:low(knees[0],knees[1]),kneeWide:high(knees[0],knees[1]),kneeGap:Math.abs(knees[0]-knees[1]),hip:low(hips[0],hips[1]),hipWide:high(hips[0],hips[1]),hipGap:Math.abs(hips[0]-hips[1]),elbow:low(elbows[0],elbows[1]),elbowWide:high(elbows[0],elbows[1]),
  wristUp:high(lift(0),lift(1)),wristLow:low(lift(0),lift(1)),wristChest:low(chest(0),chest(1)),
  stance:ankleA&&ankleB?Math.abs(ankleA.x-ankleB.x)/scale:NaN,footStep:ankleA&&ankleB?Math.abs(ankleA.y-ankleB.y)/scale:NaN,
  facing:shoulderWidth/scale,headDown:s&&h?(s.y-h.y)/scale:NaN,kneeUp:h?high(raised(0),raised(1)):NaN,handHeight:high(above(0),above(1)),points,scale};
}
/** The longest torso in this picture, for tracking how far apart frames are. */
export const torsoLength=(p:Landmark[])=>{const b=readBody(p,0);return Number.isNaN(b.tilt)?0:b.scale;};
/** How far a body part travelled during a rep, in torso lengths. Either side counts, so one working arm is enough.
 *  Points are smoothed first, because the model throws the odd landmark across the picture for a single frame, and
 *  the distance is measured against the longest torso of the rep: a torso shortens as it leans, a foot does not move. */
export class Travel{
 private box:Partial<Record<string,{px:number;py:number;x0:number;x1:number;y0:number;y1:number}>>={};private scale=0;
 add(b:Body){
  this.scale=Math.max(this.scale,b.scale);
  for(const name in b.points)b.points[name as BodyPart].forEach((l,i)=>{
   if(!l)return;const key=name+i,r=this.box[key];
   if(!r){this.box[key]={px:l.x,py:l.y,x0:l.x,x1:l.x,y0:l.y,y1:l.y};return;}
   r.px=r.px*.6+l.x*.4;r.py=r.py*.6+l.y*.4;r.x0=Math.min(r.x0,r.px);r.x1=Math.max(r.x1,r.px);r.y0=Math.min(r.y0,r.py);r.y1=Math.max(r.y1,r.py);
  });
 }
 of(part:BodyPart){let most=NaN;for(const i of [0,1]){const r=this.box[part+i];if(r)most=high(most,Math.hypot(r.x1-r.x0,r.y1-r.y0)/this.scale);}return most;}
}

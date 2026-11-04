import {angle,normalize} from './landmarks';
import type {Move} from './exercise-motions';
import type {Landmark,PoseFrame} from './types';

/** Positions you hold rather than repeat: core, isometric strength, balance and flexibility. */
export type HoldKind='plank'|'wallsit'|'bridgehold'|'tree'|'legbalance'|'warrior'|'downdog'|'forwardfold';
export type HoldStyle='core'|'strength'|'balance'|'mobility';
export const HOLD_STYLES:Record<HoldStyle,string>={core:'Core',strength:'Strength',balance:'Balance',mobility:'Mobility and flexibility'};
type Hold={title:string;style:HoldStyle;muscles:string;setup:string;cue:string;move:Move;check:(p:Landmark[])=>boolean};

const both=(v:number):[number,number]=>[v,v];
const dist=(a:Landmark,b:Landmark)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Degrees from horizontal: 0 is lying flat, 90 is upright. */
const tilt=(a:Landmark,b:Landmark)=>Math.atan2(Math.abs(a.y-b.y),Math.abs(a.x-b.x))*180/Math.PI;
const mid=(a:Landmark,b:Landmark):Landmark=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const seen=(p:Landmark[],ids:number[])=>ids.reduce((sum,id)=>sum+(p[id]?.visibility??0),0);
/** The side the camera sees best: shoulder, elbow, wrist, hip, knee, ankle. */
const side=(p:Landmark[])=>{const left=[11,13,15,23,25,27],right=[12,14,16,24,26,28],ids=seen(p,left)>=seen(p,right)?left:right;const [sh,el,wr,hip,knee,ank]=ids.map(id=>p[id]);return {sh,el,wr,hip,knee,ank};};
const legs=(p:Landmark[])=>[[23,25,27],[24,26,28]].map(([h,k,a])=>({hip:p[h],knee:p[k],ank:p[a],bend:angle(p[h],p[k],p[a]),len:dist(p[h],p[k])+dist(p[k],p[a])}));
const upright=(p:Landmark[])=>tilt(mid(p[11],p[12]),mid(p[23],p[24]))>70;
/** One foot clearly off the floor, the other leg straight. Returns the lifted leg, or null. */
const standingOnOne=(p:Landmark[])=>{const [a,b]=legs(p),lifted=a.ank.y<b.ank.y?a:b,standing=lifted===a?b:a;return standing.bend>155&&lifted.ank.y<standing.ank.y-.2*standing.len?lifted:null;};

export const HOLDS:Record<HoldKind,Hold>={
 plank:{title:'Plank',style:'core',muscles:'Abs, shoulders, glutes',setup:'Side-on to the camera, whole body in view.',cue:'Straight line from head to heels',
  move:{view:'side',anchor:'hand',keys:[{torso:76,thigh:both(-76),shin:both(-76)}]},
  check:p=>{const s=side(p);return tilt(s.sh,s.hip)<35&&angle(s.sh,s.hip,s.ank)>150&&angle(s.hip,s.knee,s.ank)>150&&s.wr.y>s.sh.y;}},
 wallsit:{title:'Wall sit or squat hold',style:'strength',muscles:'Quads, glutes',setup:'Side-on, back against a wall or free-standing.',cue:'Thighs level, knees over ankles',
  move:{view:'side',anchor:'foot',keys:[{torso:5,thigh:both(88),shin:both(0),arm:both(0),fore:both(0)}]},
  check:p=>{const s=side(p),knee=angle(s.hip,s.knee,s.ank),hip=angle(s.sh,s.hip,s.knee),[a,b]=legs(p);return knee>65&&knee<115&&hip>65&&hip<125&&tilt(s.sh,s.hip)>55&&Math.abs(a.ank.x-b.ank.x)<.35*a.len;}},
 bridgehold:{title:'Glute bridge hold',style:'strength',muscles:'Glutes, hamstrings, lower back',setup:'Lie side-on, knees bent, feet flat.',cue:'Squeeze and keep the hips high',
  move:{view:'side',anchor:'shoulder',keys:[{torso:-112,thigh:both(108),shin:both(10),arm:both(95),fore:both(95)}]},
  check:p=>{const s=side(p),knee=angle(s.hip,s.knee,s.ank);return tilt(s.sh,s.hip)<50&&s.hip.y<s.sh.y&&s.hip.y<s.ank.y&&angle(s.sh,s.hip,s.knee)>125&&knee>55&&knee<120;}},
 tree:{title:'Tree pose',style:'balance',muscles:'Ankles, hips, core',setup:'Face the camera, whole body in view.',cue:'Foot on the inner leg, hands overhead',
  move:{view:'front',anchor:'hip',keys:[{thigh:[0,60],shin:[0,-80],arm:[-170,170],fore:[-170,170]}]},
  check:p=>{const lifted=standingOnOne(p);return upright(p)&&!!lifted&&lifted.bend<110;}},
 legbalance:{title:'Single-leg balance',style:'balance',muscles:'Ankles, hips, core',setup:'Side-on or facing the camera.',cue:'Lift one leg and stay tall',
  move:{view:'side',anchor:'hip',keys:[{thigh:[0,85],shin:[0,85],arm:both(90),fore:both(90)}]},
  check:p=>{const lifted=standingOnOne(p);return upright(p)&&!!lifted&&lifted.bend>=120;}},
 warrior:{title:'Warrior II',style:'mobility',muscles:'Hips, legs, shoulders',setup:'Face the camera with room to step wide.',cue:'Front knee bent, arms out wide',
  move:{view:'front',anchor:'hip',keys:[{thigh:[-45,70],shin:[-45,-5],arm:[-92,92],fore:[-92,92]}]},
  check:p=>{const [a,b]=legs(p),bent=Math.min(a.bend,b.bend),straight=Math.max(a.bend,b.bend),arm=dist(p[11],p[13])+dist(p[13],p[15]);
   return upright(p)&&Math.abs(a.ank.x-b.ank.x)>.9*a.len&&bent>75&&bent<135&&straight>150&&Math.abs(p[15].y-p[11].y)<.35*arm&&Math.abs(p[16].y-p[12].y)<.35*arm;}},
 downdog:{title:'Downward dog',style:'mobility',muscles:'Hamstrings, calves, shoulders',setup:'Side-on, hands and feet on the floor.',cue:'Hips high, heels reaching down',
  move:{view:'side',anchor:'hand',keys:[{torso:130,thigh:both(-50),shin:both(-50),arm:both(30),fore:both(30)}]},
  check:p=>{const s=side(p),hip=angle(s.sh,s.hip,s.ank),len=dist(s.hip,s.knee)+dist(s.knee,s.ank);return s.hip.y<s.sh.y&&s.hip.y<s.ank.y&&hip>45&&hip<120&&angle(s.hip,s.knee,s.ank)>140&&s.wr.y>s.sh.y&&Math.abs(s.wr.x-s.ank.x)>.6*len;}},
 forwardfold:{title:'Standing forward fold',style:'mobility',muscles:'Hamstrings, lower back',setup:'Side-on, whole body in view.',cue:'Fold from the hips, let your head hang',
  move:{view:'side',anchor:'foot',keys:[{torso:150,thigh:both(0),shin:both(0),arm:both(5),fore:both(5)}]},
  check:p=>{const s=side(p),len=dist(s.hip,s.knee)+dist(s.knee,s.ank);return s.sh.y>s.hip.y&&angle(s.sh,s.hip,s.ank)<80&&angle(s.hip,s.knee,s.ank)>150&&s.ank.y>s.hip.y&&Math.abs(s.wr.x-s.ank.x)<.45*len;}},
};
export const HOLD_KINDS=Object.keys(HOLDS) as HoldKind[];

const GRACE_MS=500,MAX_STEP_MS=250,ALL=[11,12,13,14,15,16,23,24,25,26,27,28];
/** Seconds in position. A brief tracking blip doesn't reset the hold, but no time is added while out of position. */
export class HoldTracker{
 held=0;current=0;best=0;private last=-1;private lastIn=-Infinity;private streak=0;
 constructor(readonly kind:HoldKind){}
 update(frame:PoseFrame){
  const t=frame.timestamp,p=normalize(frame),visible=!!p&&ALL.filter(id=>(p[id]?.visibility??0)>.5).length>=9,inPose=visible&&HOLDS[this.kind].check(p!);
  const step=this.last<0?0:Math.min(MAX_STEP_MS,Math.max(0,t-this.last));this.last=t;
  if(inPose){this.streak++;this.lastIn=t;if(this.streak>=2){this.held+=step;this.current+=step;this.best=Math.max(this.best,this.current);}}
  else{this.streak=0;if(t-this.lastIn>GRACE_MS)this.current=0;}
  return {inPose:inPose&&this.streak>=2,visible,held:this.held,current:this.current,best:this.best};
 }
 reset(){this.held=0;this.current=0;this.best=0;this.last=-1;this.lastIn=-Infinity;this.streak=0;}
}

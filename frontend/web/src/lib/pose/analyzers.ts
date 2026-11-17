import { msg } from "../i18n";
import {angle,confidence,normalize,visible} from './landmarks';
import {OneEuroFilter} from './one-euro';
import type {ExerciseConfig} from './exercise-config';
import type {Landmark,Observation,PoseFrame} from './types';
const SMOOTH_S=.08,DROP_SCALE=11.2,HIP_SCALE=13.4,DRIFT=.004,RISE_S=.8,MODE_HOLD_MS=600,LEG_DECAY_S=40,SETTLE_MS=1500,DROP_SLACK=30,STRAIGHT_FROM=125,STRAIGHT_SPAN=35;
/** How far the hips drop, as a share of the leg, for each degree of knee bend: the shin tilts forward about 38% of the bend and the
 *  thigh back the rest, with thigh and shin about equal. Read backwards to turn a measured drop into a knee bend. */
const DROP_BY_BEND=Array.from({length:151},(_,b)=>((1-Math.cos(b*.62*Math.PI/180))+(1-Math.cos(b*.38*Math.PI/180)))/2);
/** How side-on the person is, 1 fully side-on to 0 facing the camera, from shoulder width against torso length. */
function sideOn(p:Landmark[]){
 const width=Math.hypot(p[11].x-p[12].x,p[11].y-p[12].y),torso=Math.hypot((p[11].x+p[12].x-p[23].x-p[24].x)/2,(p[11].y+p[12].y-p[23].y-p[24].y)/2);
 if(!(torso>.02))return .5;
 return Math.min(1,Math.max(0,(.55-width/torso)/.4));
}
function blendByView(knee:number,drop:number,p:Landmark[]){const s=sideOn(p);return s*knee+(1-s)*drop;}
/** The limb-span estimate is for people facing the camera, where the joint angle is hidden. Side-on the joint angle is reliable and the
 *  span only adds perspective jitter, so the span pulls the reading down only as far as the person faces the camera. */
function spanByView(joint:number,span:number,p:Landmark[],shown=1){
 if(!Number.isFinite(joint))return span;if(!Number.isFinite(span)||span>=joint)return joint;
 // A limb pointing at the camera looks short (its bones shrink on screen) and its joint angle means nothing; a bend keeps the bones
 // their full length. So the joint is trusted only while the limb shows nearly its whole length.
 if(shown<.75)return span;
 // Only a joint that reads clearly straight (165 or more) is trusted over the span: a limb pointing at the camera foreshortens the
 // joint angle too, and then the span is the better guide, as before.
 const s=sideOn(p)*Math.min(1,Math.max(0,(joint-155)/10))*Math.min(1,(shown-.75)/.1);return s*joint+(1-s)*span;
}
/** The joint angle and the limb-span estimate each read a bent limb well, and the smaller is right while bending. Near straight
 *  they only ever err low (jitter can't make a straight limb straighter), so the reading slides towards the larger of the two. */
function nearStraight(joint:number,span:number){
 if(!Number.isFinite(joint))return span;if(!Number.isFinite(span))return joint;
 // Jitter on a straight arm pulls the span estimate low, so only a span below the joint angle is pulled up; a joint angle below
 // the span is a real bend (the span under-reads a bend seen side-on) and is kept.
 if(joint<=span)return joint;
 const lo=span,hi=joint,w=Math.min(1,Math.max(0,(lo-STRAIGHT_FROM)/STRAIGHT_SPAN))*Math.min(1,Math.max(0,(hi-lo-8)/12));
 return lo+(hi-lo)*w;
}
/** Push-ups: the span leads (it reads a bend well from any angle), with jitter near straight pulled up. */
function straightByView(joint:number,span:number,p:Landmark[]){
 // The elbow angle can't check the span: with elbows flared out it looks straight side-on, and head-on it hardly seems to bend.
 // A plank's jitter is told apart by the shoulders, which really go down in a push-up (exercise-forms: moves shoulders).
 void p;
 return nearStraight(joint,span);
}
function bendFromDrop(share:number){
 let i=0;while(i<150&&DROP_BY_BEND[i+1]<share)i++;
 const lo=DROP_BY_BEND[i],hi=DROP_BY_BEND[i+1]??lo;return i+(hi>lo?Math.min(1,(share-lo)/(hi-lo)):0);
}
export interface ExerciseAnalyzer{observe(frame:PoseFrame):Observation;reset():void;}
/** Measures one joint angle per frame from the config's triplet on the more visible body side. Landmarks are
 *  aspect-corrected before the angle is taken (normalize), and the three joint points are smoothed. */
export class JointAnalyzer implements ExerciseAnalyzer{
 side:0|1|null=null;private center:{x:number;y:number}|null=null;private filters:OneEuroFilter[]=[];private reach=0;private bones=0;private span:number|null=null;private top:number|null=null;private anchor=0;private torso=0;private shoulders:number|null=null;private dropMode:'hips'|'shoulders'|null=null;private restarted=false;private dropStart:number|null=null;private switchSince:number|null=null;private legLen=0;private torsoTop:number|undefined=undefined;
 /** The separate estimates behind the last reading, for diagnostics. */
 parts={knee:NaN,span:NaN,drop:NaN};
 constructor(readonly config:ExerciseConfig,private fixedSide?:0|1){this.resetFilters();}
 private resetFilters(){const {minCutoff,beta}=this.config.smoothing;this.filters=Array.from({length:6},()=>new OneEuroFilter(minCutoff,beta));this.reading=null;}
 /** The reading itself is smoothed over about a tenth of a second: one jittery frame can neither fake a rep nor break one,
  *  and a real rep (a second or more) passes through almost untouched. */
 private reading:{value:number;t:number}|null=null;
 private smooth(value:number,t:number){
  if(!Number.isFinite(value))return value;
  if(!this.reading||t<=this.reading.t){this.reading={value,t};return value;}
  // Push-ups take over a second each and their forearm span is jumpy, so they are smoothed a little longer.
  const k=1-Math.exp(-(t-this.reading.t)/(this.config.straightens?SMOOTH_S*1.75:SMOOTH_S)/1000);this.reading={value:this.reading.value+(value-this.reading.value)*k,t};return this.reading.value;
 }
 reset(){this.side=null;this.center=null;this.reach=0;this.bones=0;this.span=null; this.clearDrop();this.resetFilters();}
 private clearDrop(){this.dropStart=null;this.legLen=0;this.switchSince=null;this.dropT=null;this.top=null;this.torso=0;this.shoulders=null;this.dropMode=null;this.torsoTop=undefined;this.level=null;this.floor=null;this.leg=0;this.lastT=null;this.stillFor=0;this.slow=null;this.feet=null;this.ankles=null;this.hips=null;this.jumpUntil=0;}
 private level:number|null=null;private floor:number|null=null;private leg=0;private lastT:number|null=null;private stillFor=0;private slow:number|null=null;private feet:number|null=null;private ankles:number|null=null;private hips:number|null=null;private jumpUntil=0;
 observe(frame:PoseFrame):Observation{
  const c=this.config,p=normalize(frame),bad=(reason:string,quality=0)=>{this.resetFilters();return {angle:0,confidence:quality,valid:false,reason};};
  if(!p)return bad(frame.landmarks.length>1?msg("Only one person should be in view."):msg("Step back so your whole body is in frame."));
  if(frame.brightness!==undefined&&frame.brightness<28)return bad(msg("Try a brighter, evenly lit space."));
  const q=[confidence(p,c.required[0]),confidence(p,c.required[1])] as const;
  if(this.fixedSide!==undefined)this.side=this.fixedSide;
  else if(this.side===null)this.side=q[0]>=q[1]?0:1;
  else if(q[this.side]<c.minVisibility&&q[1-this.side]>=c.minVisibility){this.side=this.side===0?1:0;this.resetFilters();}  // the far side flickers side-on; the rep carries on
  const side=this.side,ids=c.required[side],quality=q[side];
  if(quality<c.minVisibility||!visible(frame,ids))return bad(msg("Step back so your whole body is in frame."),quality);
  const edge=c.inFrame?.[side];if(edge&&confidence(p,edge)>=c.minVisibility&&!visible(frame,edge))return bad(msg("Step back so your whole body is in frame."),quality);
  const hipsSeen=confidence(p,[c.required[side][0],23+side])>=c.minVisibility&&visible(frame,[23+side]);
  const anchor=hipsSeen||!c.drop?[23,24]:[11,12],center={x:(p[anchor[0]].x+p[anchor[1]].x)/2,y:(p[anchor[0]].y+p[anchor[1]].y)/2};
  // Switching between hips and shoulders is not the camera moving.
  const moved=this.center&&this.anchor===anchor[0]&&Math.hypot(center.x-this.center.x,center.y-this.center.y)>.18;this.center=center;this.anchor=anchor[0];
  if(moved){this.reach=0;this.bones=0;this.span=null;this.clearDrop();return {...bad(msg("The view moved. Hold the camera steady and return to your starting position."),quality),restart:true};}
  if(c.suitable&&!c.suitable(p,side))return bad(msg("The movement is not clear from this angle. Adjust the camera."),quality);
  const joint=c.joints[side].map((id,i):Landmark=>({x:this.filters[i*2].filter(p[id].x,frame.timestamp),y:this.filters[i*2+1].filter(p[id].y,frame.timestamp)}));
  const extra=c.optional?.[side],legs=!extra||(confidence(p,extra)>=c.minVisibility&&visible(frame,extra));
  const knee=legs?angle(joint[0],joint[1],joint[2]):Infinity,span=legs?this.spanAngle(p,side):Infinity,drop=c.drop?this.dropAngle(p,hipsSeen,frame.timestamp,confidence(p,[27+side])>=c.minVisibility&&visible(frame,[27,28])):Infinity;this.parts={knee,span,drop};
  // The span estimate turns tiny jitter near a straight limb into big swings (asin is steep there), and the smallest of several
  // noisy readings is always the noisiest low one. Where the shoulder drop can be measured (squats, lunges) it is steady from any
  // angle, so the span only fills in when it can't be.
  // Side-on the knee angle is measured directly and is the most exact; head-on it can't be seen and the hip drop takes over.
  // In between the two are blended by how wide the shoulders look against the torso (side-on they nearly overlap).
  // A bent knee only counts as depth if the hips really went down too: knees tucked up in a jump, or pulled up to the chest,
  // bend just as far with the hips high. So the reading never goes more than DROP_SLACK degrees deeper than the hip drop says.
  // A move out to the sides (sumo) bends the knees across the body: side-on that bend is hidden, so the hip drop leads.
  const fused=c.drop&&Number.isFinite(drop)?(Number.isFinite(knee)&&c.plane!=='front'?Math.max(blendByView(knee,drop,p),drop-DROP_SLACK):drop):c.straightens?straightByView(knee,span,p):Math.min(c.plane==='side'?spanByView(knee,span,p,this.shown(joint)):Math.min(knee,span),drop);
  const degrees=c.rise?this.riseAngle(p,frame.timestamp):this.smooth(fused,frame.timestamp);
  const reading=c.invert?180-degrees:degrees;
  if(c.rise&&Number.isNaN(reading))return bad(msg("That looked like a jump. Rise onto your toes and keep them on the floor."),quality);
  const restart=this.restarted;this.restarted=false;
  return Number.isFinite(reading)?{angle:reading,confidence:quality,valid:true,reason:'',...(restart?{restart}:{})}:bad(msg("The movement was not detected clearly."),quality);
 }
 /** Rising onto the toes lifts everything above the ankles by the heel height, from any camera angle. The lift is measured from the
  *  standing level (the lowest the body has been lately) in leg lengths, so it fits any height and distance, and read in the same
  *  degrees as a joint: standing is 180, a 6% lift (about 5 cm for most people) is about 144. */
 private riseAngle(p:Landmark[],t:number){
  const body=(p[11].y+p[12].y+p[23].y+p[24].y)/4;
  // Hip and ankle points jitter by a few pixels, a lot for someone small in the picture: smoothed, so that jitter is read neither as
  // the feet leaving the floor nor as bent legs.
  const ease=(was:number|null,now:number)=>was===null?now:was*.6+now*.4;
  const hips=this.hips=ease(this.hips,(p[23].y+p[24].y)/2),ankles=this.ankles=ease(this.ankles,(p[27].y+p[28].y)/2);
  const before=this.level;this.level=this.level===null?body:this.level*.7+body*.3;  // a raise is a few centimetres: smoothed so jitter doesn't drown it
  const dt=this.lastT===null?0:Math.min(1,Math.max(0,(t-this.lastT)/1000));this.lastT=t;
  // The standing level follows the body down at once, and drifts up only slowly (0.15% of the frame a second) in case the
  // camera or the person shifts: far too slowly to swallow a raise held for a few seconds.
  // Squats and lunges also come back up, but they bend the legs on the way down: hips to ankles gets shorter. The standing level is
  // only taken with straight legs, and bent legs are never a raise, so coming up out of a lunge isn't one either.
  const span=ankles-hips;this.leg=Math.max(span,this.leg*.999);
  if(!(this.leg>.05))return Infinity;
  const straight=span>=this.leg*.93;
  // Standing is straight legs held still for half a second: true between raises, never on the way into a squat or lunge.
  // How fast the body moves, judged on a slower average of its height: jitter on someone small in the picture would never look still.
  const slow=this.slow===null?body:this.slow*.85+body*.15,speed=this.slow===null||!dt?0:Math.abs(slow-this.slow)/dt/this.leg;this.slow=slow;void before;
  this.stillFor=straight&&speed<.07?this.stillFor+dt:0;
  if(this.floor===null){this.floor=this.level;this.feet=ankles;}
  else if(this.stillFor>=.5){this.floor=Math.max(this.level,this.floor-.0015*dt);this.feet=Math.max(ankles,this.feet!-.0015*dt);}
  else this.floor-=.0015*dt;
  // Standing still is hard to see on someone small in a phone picture (jitter looks like movement), so with straight legs the
  // standing level still follows the body down, at up to 3% of a leg length a second: enough for a camera or person slowly
  // shifting, too slow for the last moment of a squat or lunge (legs straight, body still low) to move it.
  if(span>=this.leg*.97&&speed<.2&&this.level>this.floor){const step=.03*this.leg*dt;this.floor=Math.min(this.level,this.floor+step);this.feet=Math.min(Math.max(ankles,this.feet!),this.feet!+step);}
  // On the toes the ankles rise only about a centimetre; in a jump they leave the floor with the body. A jump, or a rise far
  // beyond heel height, isn't a calf raise, nor is anything in the moment after it.
  const lift=(this.floor-this.level)/this.leg,feetUp=(this.feet!-ankles)/this.leg;
  if(feetUp>.09||lift>.16)this.jumpUntil=t+1500;
  if(t<this.jumpUntil)return NaN;
  if(!straight)return 180;
  return 180-Math.min(120,Math.max(0,lift*600));
 }
 /** Shoulders drop as a squat goes down, whatever is in frame. Depth is that drop in torso lengths, from the standing height, in the same
  *  degrees as the knee: half a torso is about a thigh-level squat. */
 private dropT:number|null=null;
 private dropAngle(p:Landmark[],hipsSeen:boolean,t:number,anklesSeen=false){
  const shoulders=(p[11].y+p[12].y)/2,hips=(p[23].y+p[24].y)/2,ankles=(p[27].y+p[28].y)/2;
  // The hips only go down when the knees bend; the shoulders also go down in a bow or when reaching for the floor. So depth is
  // read from the hips whenever they are in view, and from the shoulders only up close, when the hips are out of frame.
  // Hips flicker in and out of view for a frame or two all the time; the measure only switches once the change has held.
  const want=hipsSeen?'hips':'shoulders';
  if(this.dropMode===null)this.dropMode=want;
  if(want!==this.dropMode){this.switchSince??=t;if(t-this.switchSince>=MODE_HOLD_MS){this.restarted=true;this.dropMode=want;this.shoulders=null;this.top=null;this.switchSince=null;this.dropStart=null;}}else this.switchSince=null;
  const mode=this.dropMode;
  if(mode==='hips'&&!hipsSeen&&!(Number.isFinite(hips)))return Infinity;
  const level=mode==='hips'?hips:shoulders,scale=mode==='shoulders'?DROP_SCALE:HIP_SCALE;
  this.shoulders=this.shoulders===null?level:this.shoulders*.4+level*.6;
  // The standing level drifts down slowly (0.4% of the picture a second, whatever the frame rate) in case the camera is nudged,
  // far too slowly to swallow a squat held for a few seconds.
  const dt=this.dropT===null?0:Math.min(1,Math.max(0,(t-this.dropT)/1000));this.dropT=t;
  // Standing higher than before (onto the toes, reaching up) only becomes the standing level if held for most of a second, so
  // coming back down from a brief rise is not read as a squat.
  // In the first moments people are still getting into position, so a higher stance is taken at once.
  this.dropStart??=t;const settling=t-this.dropStart<SETTLE_MS;
  this.top=this.top===null?this.shoulders:this.shoulders<this.top?(settling?this.shoulders:this.top+(this.shoulders-this.top)*(1-Math.exp(-dt/RISE_S))):Math.min(this.shoulders,this.top+DRIFT*dt);
  // Hips out of frame up close: shoulder width stands in for the torso, which is about 1.5 of them.
  this.torso=Math.max(hipsSeen?hips-Math.min(shoulders,this.torsoTop??shoulders):Math.max(.2,Math.abs(p[11].x-p[12].x)*1.5),this.torso*.999);
  this.torsoTop=this.torsoTop===undefined?shoulders:Math.min(shoulders,this.torsoTop+DRIFT*dt);
  // With the ankles in view the drop is measured in leg lengths, which is all it depends on: the hips go down by
  // thigh·(1−cos) + shin·(1−cos) of the bend, whatever the person's build or how the torso leans. The leg is the longest
  // hips-to-ankles distance seen lately, so it is steady even though each frame is a little noisy.
  if(mode==='hips'&&anklesSeen){
   const leg=ankles-this.shoulders;this.legLen=Math.max(leg,this.legLen*Math.exp(-dt/LEG_DECAY_S));
   if(this.legLen>.04)return 180-bendFromDrop(Math.max(0,(this.shoulders-this.top)/this.legLen));
  }
  if(!(this.torso>0))return Infinity;
  // The shoulders drop slowly at first and faster as the knees bend further (about with the square of the bend), so the drop is
  // turned back into a knee angle with a square root. Fitted on simulated squats from every camera angle: 40, 60, 80 and 100
  // degrees of bend read 37, 61, 81 and 97.
  const drop=Math.max(0,(this.shoulders-this.top)/this.torso*165);
  return 180-scale*Math.sqrt(drop);
 }
 /** A bent joint seen head-on still looks straight, but its limb ends get closer. Two equal segments span 2·L·sin(θ/2),
  *  and L comes from the longest span seen recently, so this reads like the joint angle from any view. */
 /** How much of the limb's longest seen on-screen length (both bones) shows now, 0 to 1. */
 private shown(j:Landmark[]){
  const len=Math.hypot(j[0].x-j[1].x,j[0].y-j[1].y)+Math.hypot(j[2].x-j[1].x,j[2].y-j[1].y);
  this.bones=Math.max(len,this.bones*.999);return this.bones>0?len/this.bones:1;
 }
 private spanAngle(p:Landmark[],side:0|1){
  const ends=this.config.span?.[side];if(!ends)return Infinity;
  const raw=Math.hypot(p[ends[0]].x-p[ends[1]].x,p[ends[0]].y-p[ends[1]].y);
  this.span=this.span===null?raw:this.span*.4+raw*.6;this.reach=Math.max(this.span,this.reach*.999);
  // Near full reach asin is so steep that tracking noise reads as a bend, so the top 4% counts as straight.
  return this.reach>0?2*Math.asin(Math.min(1,this.span/(this.reach*.96)))*180/Math.PI:Infinity;
 }
}
/** Watches both sides and follows whichever is mid-rep, so alternating legs all count. */
export class EitherSideAnalyzer implements ExerciseAnalyzer{
 private sides:[JointAnalyzer,JointAnalyzer];
 constructor(config:ExerciseConfig){this.sides=[new JointAnalyzer(config,0),new JointAnalyzer(config,1)];}
 reset(){this.sides.forEach(side=>side.reset());}
 observe(frame:PoseFrame):Observation{
  const [left,right]=this.sides.map(side=>side.observe(frame));
  return left.valid&&right.valid?(left.angle<=right.angle?left:right):left.valid?left:right;
 }
}

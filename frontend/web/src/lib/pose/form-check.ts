import { msg } from "../i18n";
/* Form checks adapted from Exercise-Correction by Ngô Hồng Quốc Bảo (MIT licence):
 * https://github.com/NgoQuocBao1010/Exercise-Correction
 * Its squat foot and knee ratios, bicep curl upper-arm and peak-contraction angles and lunge knee range are used here.
 * Its plank check is a trained model; this uses a geometric hip-line check instead, so it runs in the browser. */
import {angle} from './landmarks';
import type {Phase} from './rep-counter';
import type {ExerciseKind,Landmark} from './types';

export type FormFamily='squat'|'curl'|'lunge'|'plank';
const FAMILY:Partial<Record<ExerciseKind|'plank',FormFamily>>={squat:'squat',wsquat:'squat',ohsquat:'squat',bandsquat:'squat',kbsquat:'squat',frontsquat:'squat',
 curl:'curl',hammer:'curl',bandcurl:'curl',bbcurl:'curl',lunge:'lunge',wlunge:'lunge',revlunge:'lunge',bblunge:'lunge',pushup:'plank',kneepush:'plank',widepush:'plank',diamondpush:'plank',plank:'plank'};
export const formFamily=(kind:ExerciseKind|'plank')=>FAMILY[kind]??null;

export const FORM_TIPS={feet_narrow:msg("Feet a little wider, about shoulder width."),feet_wide:msg("Bring your feet in a little."),knees_in:msg("Push your knees out over your toes."),knees_out:msg("Knees are drifting wide. Keep them over your toes."),
 elbow_drift:msg("Keep your elbow close to your side."),short_curl:msg("Curl all the way up and squeeze."),knee_forward:msg("Don't let your knee bend past a right angle."),hips_high:msg("Lower your hips into a straight line."),hips_low:msg("Lift your hips. Keep a straight line from head to heels.")} as const;
export type FormIssue=keyof typeof FORM_TIPS;

const FOOT_SHOULDER=[1.2,2.8],KNEE_FOOT={up:[.5,1],middle:[.7,1],down:[.7,1.1]},UPPER_ARM_MAX=40,PEAK_MAX=60,LUNGE_KNEE=[60,125],HIP_LINE=165,CONFIRM=5,VISIBLE=.6;
const dist=(a:Landmark,b:Landmark)=>Math.hypot(a.x-b.x,a.y-b.y);
const seen=(p:Landmark[],ids:number[])=>ids.every(id=>(p[id]?.visibility??0)>=VISIBLE);
const stageOf=(phase:Phase)=>phase==='DOWN'?'down':phase==='UP'||phase==='SETUP'?'up':'middle';
/** Facing the camera: the shoulders look wide compared with the torso. Width checks only make sense then. */
const facing=(p:Landmark[])=>dist(p[11],p[12])>.45*dist({x:(p[11].x+p[12].x)/2,y:(p[11].y+p[12].y)/2},{x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2});
const sideOf=(p:Landmark[])=>(p[11]?.visibility??0)+(p[23]?.visibility??0)>=(p[12]?.visibility??0)+(p[24]?.visibility??0)?0:1;

function issues(family:FormFamily,p:Landmark[],phase:Phase,peak:{min:number}):FormIssue[]{
 const out:FormIssue[]=[];
 if(family==='squat'&&seen(p,[11,12,25,26,31,32])&&facing(p)){
  const feet=dist(p[31],p[32]),ratio=feet/dist(p[11],p[12]),[low,high]=KNEE_FOOT[stageOf(phase)],knees=dist(p[25],p[26])/(feet||1);
  if(ratio<FOOT_SHOULDER[0])out.push('feet_narrow');else if(ratio>FOOT_SHOULDER[1])out.push('feet_wide');
  if(knees<low)out.push('knees_in');else if(knees>high)out.push('knees_out');
 }
 if(family==='curl'){
  const s=sideOf(p),[sh,el,wr]=[11+s,13+s,15+s].map(id=>p[id]);
  if(seen(p,[11+s,13+s,15+s])){
   if(angle(el,sh,{x:sh.x,y:sh.y+.2})>UPPER_ARM_MAX)out.push('elbow_drift');
   const bend=angle(sh,el,wr);if(phase!=='UP'&&phase!=='SETUP')peak.min=Math.min(peak.min,bend);
  }
 }
 if(family==='lunge'&&phase==='DOWN'&&seen(p,[23,24,25,26,27,28])){
  if([angle(p[23],p[25],p[27]),angle(p[24],p[26],p[28])].some(knee=>knee<LUNGE_KNEE[0]))out.push('knee_forward');
 }
 if(family==='plank'){
  const s=sideOf(p),[sh,hip,ank]=[11+s,23+s,27+s].map(id=>p[id]);
  if(seen(p,[11+s,23+s,27+s])&&angle(sh,hip,ank)<HIP_LINE){
   const lineY=sh.y+(ank.y-sh.y)*((hip.x-sh.x)/((ank.x-sh.x)||1e-6));
   out.push(hip.y<lineY?'hips_high':'hips_low');
  }
 }
 return out;
}

/** Watches one set. A problem must show for several frames in a row before it is mentioned, and each is counted once per occurrence. */
export class FormChecker{
 tally:Partial<Record<FormIssue,number>>={};private streak=new Map<FormIssue,number>();private peak={min:Infinity};private last:Phase='SETUP';
 constructor(readonly family:FormFamily|null){}
 update(p:Landmark[]|null,phase:Phase):FormIssue|null{
  if(!this.family||!p)return null;
  let found=issues(this.family,p,phase,this.peak),said:FormIssue|null=null;
  // A curl that comes back down without bending far enough is a short curl, judged once at the end of each rep.
  if(this.family==='curl'&&(phase==='UP')&&this.last!=='UP'&&this.last!=='SETUP'){if(this.peak.min>PEAK_MAX&&this.peak.min<Infinity)found=[...found,'short_curl'];this.peak.min=Infinity;}
  this.last=phase;
  for(const issue of Object.keys(FORM_TIPS) as FormIssue[]){
   const on=found.includes(issue),count=on?(this.streak.get(issue)??0)+1:0;this.streak.set(issue,count);
   if(on&&(count===CONFIRM||issue==='short_curl')){this.tally[issue]=(this.tally[issue]??0)+1;said??=issue;}
  }
  return said;
 }
 reset(){this.tally={};this.streak.clear();this.peak={min:Infinity};this.last='SETUP';}
}
/** A short summary of what came up, most frequent first. */
export const formSummary=(tally:Partial<Record<FormIssue,number>>)=>(Object.entries(tally) as [FormIssue,number][]).sort((a,b)=>b[1]-a[1]).map(([issue,count])=>`${FORM_TIPS[issue]} (${count}×)`);

import type {Landmark,PoseFrame} from './types';
export function normalize(frame:PoseFrame):Landmark[]|null{
 if(frame.landmarks.length!==1||frame.width<=0||frame.height<=0||!Number.isFinite(frame.timestamp))return null;
 const p=frame.landmarks[0];if(p.length!==33||p.some(l=>![l.x,l.y,l.z??0,l.visibility??0,l.presence??1].every(Number.isFinite)))return null;
 return p.map(l=>({...l,x:l.x*frame.width/frame.height}));
}
/** Keep the person exercising when anything else detected (a photo, a TV, someone far behind) is much smaller. */
export function focusPerson(frame:PoseFrame):PoseFrame{
 if(frame.landmarks.length<2)return frame;
 const area=(p:Landmark[])=>(Math.max(...p.map(l=>l.x))-Math.min(...p.map(l=>l.x)))*(Math.max(...p.map(l=>l.y))-Math.min(...p.map(l=>l.y)));
 const [main,next]=[...frame.landmarks].sort((a,b)=>area(b)-area(a));
 return area(next)<area(main)*.35?{...frame,landmarks:[main]}:frame;
}
export function angle(a:Landmark,b:Landmark,c:Landmark){const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;const n=Math.hypot(ux,uy)*Math.hypot(vx,vy);return n<.0001?NaN:Math.acos(Math.min(1,Math.max(-1,(ux*vx+uy*vy)/n)))*180/Math.PI;}
export function confidence(points:Landmark[],ids:number[]){return Math.min(...ids.map(i=>Math.min(points[i]?.visibility??0,points[i]?.presence??1)));}
export function visible(frame:PoseFrame,ids:number[]){return ids.every(i=>{const p=frame.landmarks[0]?.[i];return p&&p.x>.025&&p.x<.975&&p.y>.025&&p.y<.975;});}

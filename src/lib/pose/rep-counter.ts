import type {Observation,TrackingResult} from './types';
/** Heuristic participation estimates, never a form/medical-safety assessment. */
export class RepCounter{
 reps=0;phase='starting';private last=-Infinity;private candidate='';private stableAt=0;private samples=0;private cycleAt=0;private bentAt=0;
 constructor(private extended=155,private bent=95){}
 resetMovement(){this.phase='starting';this.candidate='';this.samples=0;}
 reset(){this.reps=0;this.last=-Infinity;this.resetMovement();}
 update(o:Observation,t:number):TrackingResult{
  const out=(accepted:boolean,message:string):TrackingResult=>({reps:this.reps,phase:this.phase,confidence:o.confidence,message,accepted});
  if(!Number.isFinite(t)||t<=this.last)return out(false,'Duplicate or stale frame ignored.');
  if(t-this.last>750)this.resetMovement();this.last=t;
  if(!o.valid||o.confidence<.65){this.resetMovement();return out(false,o.reason||'Tracking confidence is low.');}
  const target=o.angle>=this.extended?'extended':o.angle<=this.bent?'bent':'middle';
  if(target!==this.candidate){this.candidate=target;this.stableAt=t;this.samples=1;}else this.samples++;
  if(this.samples>=3&&t-this.stableAt>=150){
   if(this.phase==='starting'&&target==='extended'){this.phase='ready';this.cycleAt=t;}
   else if(this.phase==='ready'&&target==='bent'&&t-this.cycleAt>=250){this.phase='return';this.bentAt=t;}
   else if(this.phase==='return'&&target==='extended'&&t-this.bentAt>=250&&t-this.cycleAt>=700){this.reps=Math.min(100,this.reps+1);this.phase='ready';this.cycleAt=t;}
  }
  return out(true,this.phase==='starting'?'Return to a comfortable starting position.':'Tracking is active. You can pause whenever you need.');
 }
}

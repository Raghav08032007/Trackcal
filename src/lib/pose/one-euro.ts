/** One-Euro filter (Casiez, Roussel & Vogel, CHI 2012): smooths jitter when still, follows quick moves with little lag.
 *  Timestamps in milliseconds. reset() forgets history (after a pause or a tracking gap). */
export class OneEuroFilter{
 private x:number|null=null;private dx=0;private t=0;
 constructor(private minCutoff=1.2,private beta=.02,private dCutoff=1){}
 private static alpha(cutoff:number,dt:number){const tau=1/(2*Math.PI*cutoff);return 1/(1+tau/dt);}
 reset(){this.x=null;this.dx=0;}
 filter(value:number,timestampMs:number){
  if(this.x===null||timestampMs<=this.t){this.x=value;this.t=timestampMs;return value;}
  const dt=(timestampMs-this.t)/1000;this.t=timestampMs;
  const rawDx=(value-this.x)/dt;this.dx+=OneEuroFilter.alpha(this.dCutoff,dt)*(rawDx-this.dx);
  const cutoff=this.minCutoff+this.beta*Math.abs(this.dx);this.x+=OneEuroFilter.alpha(cutoff,dt)*(value-this.x);
  return this.x;
 }
}

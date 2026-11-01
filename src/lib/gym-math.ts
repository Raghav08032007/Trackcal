/** Estimated one-rep max (Epley). Past about 12 reps it stops meaning much, so those return null. */
export function oneRepMax(load:number,reps:number){
 if(!(load>0)||!(reps>=1)||reps>12)return null;
 return reps===1?load:Math.round(load*(1+reps/30)*10)/10;
}
/** Plates for one side of the bar, heaviest first. `left` is what the plates can't make. */
export function platesPerSide(target:number,bar:number,plates:readonly number[]){
 const side=(target-bar)/2,rows:{plate:number;count:number}[]=[];let left=Math.max(0,side);
 if(side<0)return null;
 for(const plate of [...plates].sort((a,b)=>b-a)){const count=Math.floor((left+1e-9)/plate);if(count){rows.push({plate,count});left=Math.round((left-count*plate)*1000)/1000;}}
 return {rows,left:left*2};
}
export type GoalDay={date:string;calories?:number;weight?:number};
const KCAL_PER_KG=7700,DAY_MS=86400000,MIN_CALORIES=1200;
/** What the body really burns, from what was eaten and how weight moved: the weight trend is a straight-line fit, so one
 *  salty day doesn't swing it. Null until there's enough to be honest about: two weeks, 10 logged days, and 4 weigh-ins. */
export function adaptiveGoal(days:GoalDay[],kgPerWeek:number){
 const eaten=days.filter(d=>d.calories&&d.calories>0),weighed=days.filter(d=>d.weight&&d.weight>0).map(d=>({t:Date.parse(d.date)/DAY_MS,w:d.weight as number}));
 if(eaten.length<10||weighed.length<4)return null;
 const span=Math.max(...weighed.map(d=>d.t))-Math.min(...weighed.map(d=>d.t));if(span<14)return null;
 const meanT=weighed.reduce((a,d)=>a+d.t,0)/weighed.length,meanW=weighed.reduce((a,d)=>a+d.w,0)/weighed.length;
 const slope=weighed.reduce((a,d)=>a+(d.t-meanT)*(d.w-meanW),0)/weighed.reduce((a,d)=>a+(d.t-meanT)**2,0);
 const average=eaten.reduce((a,d)=>a+(d.calories as number),0)/eaten.length,burn=average-slope*KCAL_PER_KG;
 return {burn:Math.round(burn),average:Math.round(average),kgPerWeek:Math.round(slope*7*100)/100,target:Math.max(MIN_CALORIES,Math.round((burn+kgPerWeek*KCAL_PER_KG/7)/10)*10)};
}

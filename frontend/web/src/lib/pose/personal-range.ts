import type {ExerciseConfig} from './exercise-config';
/** Learning each person's own range (Phase F3).
 *  Everyone used to be held to one depth, so someone with stiff hips or a healing knee heard "go deeper" on every honest rep.
 *  Each saved set now carries one number, reach_deg: the usual bottom of its honest attempts (counted reps and "not deep enough"
 *  ones; the shallow end, 70th percentile, as bottoms vary rep to rep), in the counter's own degrees. From the person's recent sets of an exercise the target follows their usual bottom:
 *    - only when at least RANGE_MIN_SETS sets from two or more sessions agree, so one lazy set never lowers the bar;
 *    - never more than MAX_EASE of the movement shallower than the standard target, so a half rep still never counts;
 *    - never stricter than the standard target, and it moves back as the person goes deeper (the median follows them). */
export const RANGE_SESSIONS=6,RANGE_MIN_SETS=3,MAX_EASE=.35,MARGIN=5;
type Tracked={status:string;completed_at?:string|null;details?:{tracking?:{exercise_type?:string;sets?:{reach_deg?:number|null}[]}}|null};
export type LearnedRange={reach:number;sets:number;first:number|null};
const median=(v:number[])=>{const a=[...v].sort((x,y)=>x-y);return a[a.length>>1];};
/** The person's usual bottom from their latest sessions of this exercise, newest first; with the oldest such reach, for progress. */
export function learnedReach(sessions:Tracked[],kind:string):LearnedRange|null{
 const rows=sessions.filter(s=>s.status==='completed'&&s.completed_at&&s.details?.tracking?.exercise_type===kind)
  .map(s=>({at:s.completed_at!,reach:(s.details!.tracking!.sets??[]).map(x=>x.reach_deg).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x))}))
  .filter(r=>r.reach.length).sort((a,b)=>b.at.localeCompare(a.at));
 const recent=rows.slice(0,RANGE_SESSIONS),values=recent.flatMap(r=>r.reach);
 if(recent.length<2||values.length<RANGE_MIN_SETS)return null;
 const older=rows.slice(RANGE_SESSIONS).flatMap(r=>r.reach);
 return {reach:median(values),sets:values.length,first:older.length>=RANGE_MIN_SETS?median(older):null};
}
/** The counter's config with the bottom target moved to the person's range, and how far it moved (0 = standard target). */
export function personalConfig(config:ExerciseConfig,reach:number|null|undefined):{config:ExerciseConfig;eased:number}{
 const span=config.up-config.down;
 if(reach==null||!Number.isFinite(reach)||span<=0||reach+MARGIN<=config.down)return {config,eased:0};
 const down=Math.min(reach+MARGIN,config.down+MAX_EASE*span,config.up-config.hysteresis-6);
 if(down<=config.down)return {config,eased:0};
 const minRangeDeg=Math.round(config.minRangeDeg*(config.up-down)/span*10)/10;
 return {config:{...config,down,minRangeDeg},eased:(down-config.down)/span};
}
/** Degrees of range gained between the older sets and now (positive is deeper), when there is something to compare. */
export function rangeGain(r:LearnedRange|null){return r&&r.first!==null?Math.round(r.first-r.reach):null;}

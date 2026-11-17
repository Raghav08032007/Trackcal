import {describe,expect,it} from 'vitest';
import {FormChecker,formFamily,formSummary} from '@/lib/pose/form-check';
import {generateWorkout,shuffleStep,stepsFor,targetFor} from '@/lib/workout-generator';
import {EXERCISES,EXERCISE_VARIANTS,gearOf,type ExerciseKind,type Landmark} from '@/lib/pose/types';
import type {Phase} from '@/lib/pose/rep-counter';

/** A front-facing body. Widths are what the squat checks read. */
function body({feet=.2,knees=.2,shoulders=.16}:{feet?:number;knees?:number;shoulders?:number}={}):Landmark[]{
 const p:Landmark[]=Array.from({length:33},()=>({x:.5,y:.5,visibility:.95}));
 const at=(id:number,x:number,y:number)=>{p[id]={x,y,visibility:.95};};
 at(11,.5-shoulders/2,.3);at(12,.5+shoulders/2,.3);at(23,.45,.55);at(24,.55,.55);at(25,.5-knees/2,.7);at(26,.5+knees/2,.7);at(27,.5-feet/2,.88);at(28,.5+feet/2,.88);at(31,.5-feet/2,.9);at(32,.5+feet/2,.9);
 at(13,.4,.42);at(14,.6,.42);at(15,.4,.52);at(16,.6,.52);
 return p;
}
const run=(checker:FormChecker,p:Landmark[],phase:Phase='DOWN',frames=6)=>{const said=[];for(let i=0;i<frames;i++){const s=checker.update(p,phase);if(s)said.push(s);}return said;};

describe('form checks (Exercise-Correction rules)',()=>{
 it('a good squat says nothing',()=>expect(run(new FormChecker('squat'),body({feet:.22,knees:.2}))).toEqual([]));
 it('knees caving in at the bottom are called out once, after a few frames',()=>{
  const checker=new FormChecker('squat');expect(run(checker,body({feet:.24,knees:.12}),'DOWN',4)).toEqual([]);
  expect(run(checker,body({feet:.24,knees:.12}),'DOWN',3)).toEqual(['knees_in']);expect(checker.tally.knees_in).toBe(1);
 });
 it('feet too narrow or too wide',()=>{
  expect(run(new FormChecker('squat'),body({feet:.1,knees:.08}))).toContain('feet_narrow');
  expect(run(new FormChecker('squat'),body({feet:.5,knees:.45}))).toContain('feet_wide');
 });
 it('width checks wait until the person faces the camera',()=>expect(run(new FormChecker('squat'),body({feet:.05,knees:.01,shoulders:.02}))).toEqual([]));
 it('an elbow swinging forward on a curl',()=>{
  const p=body();p[11]={x:.4,y:.3,visibility:.95};p[13]={x:.52,y:.38,visibility:.95};p[15]={x:.6,y:.3,visibility:.95};
  expect(run(new FormChecker('curl'),p,'GOING_DOWN')).toContain('elbow_drift');
 });
 it('a curl that never bends past 60 degrees is called short when it ends',()=>{
  const checker=new FormChecker('curl'),p=body();p[11]={x:.4,y:.3,visibility:.95};p[13]={x:.4,y:.45,visibility:.95};p[15]={x:.55,y:.45,visibility:.95};
  checker.update(p,'DOWN');checker.update(p,'GOING_UP');expect(checker.update(p,'UP')).toBe('short_curl');
 });
 it('hips sagging and hips piked in a plank',()=>{
  const plank=(hipY:number)=>{const p=body();for(const [id,x,y] of [[11,.2,.5],[23,.5,hipY],[27,.8,.5]] as const)p[id]={x,y,visibility:.95};return p;};
  expect(run(new FormChecker('plank'),plank(.62),'UP')).toContain('hips_low');
  expect(run(new FormChecker('plank'),plank(.38),'UP')).toContain('hips_high');
  expect(run(new FormChecker('plank'),plank(.5),'UP')).toEqual([]);
 });
 it('maps variants to their family and summarises the most frequent first',()=>{
  expect(formFamily('bandsquat')).toBe('squat');expect(formFamily('jack')).toBeNull();
  expect(formSummary({knees_in:3,feet_wide:1})[0]).toContain('knees out');
 });
 it('says nothing without a body or without a family',()=>{expect(new FormChecker('squat').update(null,'DOWN')).toBeNull();expect(new FormChecker(null).update(body(),'DOWN')).toBeNull();});
});

describe('workout generator (workout-cool flow)',()=>{
 let seed=7;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const input={groups:['legs','chest','core'] as const,equipment:'none' as const,level:'medium' as const,minutes:20,rest:30};
 it('fills the time with one exercise per muscle in turn, never repeating a movement',()=>{
  const workout=generateWorkout({...input,groups:[...input.groups]},random)!;
  expect(workout.steps).toHaveLength(stepsFor(20));
  const motions=workout.steps.map(s=>EXERCISE_VARIANTS[s.kind]??s.kind);expect(new Set(motions).size).toBe(motions.length);
  expect(EXERCISES[workout.steps[0].kind].group).toBe('legs');expect(EXERCISES[workout.steps[1].kind].group).toBe('chest');
 });
 it('keeps to the equipment, the gear and the level',()=>{
  const workout=generateWorkout({...input,groups:['arms'],equipment:'weights',gear:'band',level:'easy',minutes:12},random)!;
  for(const step of workout.steps){expect(EXERCISES[step.kind].equipment).toBe('weights');expect(gearOf(step.kind)).toBe('band');expect(EXERCISES[step.kind].difficulty).toBe('easy');}
 });
 it('suggests reps by type and level',()=>{expect(targetFor('jack','medium')).toBe(20);expect(targetFor('curl','hard')).toBe(13);expect(targetFor('squatjump','easy')).toBe(6);});
 it('shuffles one exercise within the same muscle group',()=>{
  const workout=generateWorkout({...input,groups:[...input.groups]},random)!,next=shuffleStep(workout,0,{...input,groups:[...input.groups]},random);
  expect(next.steps[0].kind).not.toBe(workout.steps[0].kind);expect(EXERCISES[next.steps[0].kind].group).toBe(EXERCISES[workout.steps[0].kind].group);
  expect(next.steps.slice(1)).toEqual(workout.steps.slice(1));
 });
 it('returns nothing when no muscle is chosen',()=>expect(generateWorkout({...input,groups:[]})).toBeNull());
 it('every exercise kind used exists',()=>{const workout=generateWorkout({...input,groups:['legs','back','shoulders','arms','core','full','chest'],equipment:'any',level:'hard',minutes:60},random)!;for(const s of workout.steps)expect(EXERCISES[s.kind as ExerciseKind]).toBeTruthy();expect(workout.steps.length).toBe(8);});
});

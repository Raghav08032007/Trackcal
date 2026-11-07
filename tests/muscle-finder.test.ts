import {describe,expect,it} from 'vitest';
import {MUSCLE_CATEGORIES,cameraLink,dailyPackage,exercisesFor,fromDiagram,parseSteps,todaysCategory} from '@/lib/muscle-finder';
import {EXERCISES,EXERCISE_VARIANTS} from '@/lib/pose/types';

describe('train by muscle',()=>{
 it('finds exercises for a muscle, main target first',()=>{
  const rows=exercisesFor(['biceps'],{equipment:'any',level:'any'});
  expect(rows.length).toBeGreaterThan(3);expect(rows[0].primary).toBe(true);
  expect(rows.every(r=>r.matched.includes('biceps'))).toBe(true);
  const firstSecondary=rows.findIndex(r=>!r.primary);if(firstSecondary>=0)expect(rows.slice(firstSecondary).every(r=>!r.primary)).toBe(true);
 });
 it('includes holds for core and balance muscles',()=>expect(exercisesFor(['abs'],{equipment:'any',level:'any'}).some(r=>r.hold==='plank')).toBe(true));
 it('respects equipment and level',()=>{
  const rows=exercisesFor(['quadriceps'],{equipment:'none',level:'easy'});
  expect(rows.length).toBeGreaterThan(0);expect(rows.every(r=>r.equipment==='none'&&r.difficulty==='easy')).toBe(true);
 });
 it('the plain exercise comes before its equipment versions',()=>{const rows=exercisesFor(['quadriceps'],{equipment:'any',level:'any'}).map(r=>r.id);expect(rows.indexOf('squat')).toBeLessThan(rows.indexOf('bandsquat'));});
 it('nothing chosen, nothing shown',()=>expect(exercisesFor([],{equipment:'any',level:'any'})).toEqual([]));
 it('reads the body diagram names',()=>{expect(fromDiagram('left-soleus')).toBe('calves');expect(fromDiagram('head')).toBeNull();expect(fromDiagram('gluteal')).toBe('gluteal');expect(fromDiagram('nonsense')).toBeNull();});
 it('builds and reads a camera workout link, dropping anything invalid',()=>{
  const link=cameraLink([{kind:'squat',target:10},{kind:'curl',target:12}]);
  expect(link).toBe('/workouts/camera?steps=squat:10,curl:12');
  expect(parseSteps('squat:10,nope:5,curl:0,lunge:1000,pushup:8')).toEqual([{kind:'squat',target:10},{kind:'pushup',target:8}]);
  expect(parseSteps(null)).toEqual([]);
 });
 it('every rep exercise can be found from at least one muscle',()=>{
  const all=new Set(['quadriceps','gluteal','hamstring','calves','adductor','abductors','chest','front-deltoids','back-deltoids','biceps','triceps','forearm','abs','obliques','upper-back','lower-back','trapezius'] as const);
  const reachable=new Set(exercisesFor([...all],{equipment:'any',level:'any'}).map(r=>r.kind));
  expect(Object.keys(EXERCISES).filter(k=>!reachable.has(k as never))).toEqual([]);
 });
});

describe('muscle groups and daily packages',()=>{
 const legs=MUSCLE_CATEGORIES.find(c=>c.id==='legs')!,any={equipment:'any',level:'any'} as const;
 it('the same day and group always give the same standard plan',()=>expect(dailyPackage(legs,any,'2026-11-07:legs')).toEqual(dailyPackage(legs,any,'2026-11-07:legs')));
 it('a shuffle gives a different plan',()=>{const plans=new Set(['a','b','c','d'].map(s=>JSON.stringify(dailyPackage(legs,any,s))));expect(plans.size).toBeGreaterThan(1);});
 it('five exercises, no repeated movement, all for the group',()=>{
  for(const category of MUSCLE_CATEGORIES){const plan=dailyPackage(category,any,'x:'+category.id);expect(plan.length,category.id).toBe(5);
   expect(new Set(plan.map(s=>EXERCISE_VARIANTS[s.kind]??s.kind)).size).toBe(5);}
 });
 it('keeps to the beginner level and no equipment when asked',()=>{for(const s of dailyPackage(legs,{equipment:'none',level:'easy'},'y'))expect([EXERCISES[s.kind].equipment,EXERCISES[s.kind].difficulty]).toEqual(['none','easy']);});
 it('follows a weekly split with a rest day',()=>{expect(todaysCategory(new Date('2026-11-08T10:00:00'))).toBe('rest');expect(todaysCategory(new Date('2026-11-09T10:00:00'))).toBe('push');});
});

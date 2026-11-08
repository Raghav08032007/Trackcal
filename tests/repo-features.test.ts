import {describe,expect,it} from 'vitest';
import {dayMarks,habitLabel,habitScore,progressSeries,trainingLoad,workoutDays,type HabitDay} from '@/lib/progress-insights';
import {allergyGroups,checkAllergens} from '@/lib/allergens';
import {MAX_SPEED_MS,RouteMeter,metresBetween,paceText} from '@/lib/gps';
import {weeklyStep} from '@/lib/gym-math';
import type {Session} from '@/lib/wellness';

const now=Date.parse('2026-11-04T12:00:00');
const session=(daysAgo:number,extra:object={}):Session=>({status:'completed',minutes:30,completed_at:new Date(now-daysAgo*86400000).toISOString(),details:{exercises:[],notes:''},...extra}) as unknown as Session;

describe('habit strength (mhabit idea)',()=>{
 it('grows with kept days and stays within 0 to 100',()=>{expect(habitScore(Array(10).fill('done'))).toBeGreaterThan(50);expect(habitScore(Array(200).fill('done'))).toBeLessThanOrEqual(100);expect(habitScore([])).toBe(0);});
 it('one missed day costs a little, not everything',()=>{const kept=Array<HabitDay>(20).fill('done'),before=habitScore(kept),after=habitScore([...kept,'miss']);expect(before-after).toBeGreaterThan(0);expect(before-after).toBeLessThan(5);});
 it('a partial day costs less than a miss',()=>{const kept=Array<HabitDay>(20).fill('done'),part=habitScore(kept)-habitScore([...kept,'part']),miss=habitScore(kept)-habitScore([...kept,'miss']);expect(part).toBeGreaterThan(0);expect(part).toBeLessThan(miss);});
 it('labels and day marks',()=>{expect(habitLabel(90)).toBe('A habit');expect(habitLabel(10)).toBe('Starting');const marks=dayMarks(workoutDays([session(0),session(2)]),now,5);expect(marks).toEqual(['miss','miss','done','miss','done']);});
});

describe('training load (fitness, fatigue, form)',()=>{
 it('rises with training and fatigue reacts faster than fitness',()=>{const load=trainingLoad([0,1,2,3,4].map(d=>session(d)),now);expect(load.today.fatigue).toBeGreaterThan(load.today.fitness);expect(load.today.form).toBeLessThan(0);expect(load.note).toContain('ramping');});
 it('says so when there is nothing yet',()=>expect(trainingLoad([],now).note).toContain('Not enough'));
 it('ignores unfinished sessions',()=>expect(trainingLoad([session(0,{status:'active'})],now).today.fitness).toBe(0));
});

describe('progress per exercise (Flex idea)',()=>{
 it('camera reps count only what the camera saw, holds are seconds, weights give an estimated 1RM',()=>{
  const series=progressSeries([
   session(3,{details:{exercises:[],notes:'',tracking:{exercise_type:'squat',sets:[{estimated_reps:8,corrected_reps:20}]}}}),
   session(1,{details:{exercises:[],notes:'',tracking:{exercise_type:'squat',sets:[{estimated_reps:12,corrected_reps:null}]}}}),
   session(2,{details:{exercises:[],notes:'',tracking:{exercise_type:'plank',sets:[{estimated_reps:0,corrected_reps:null,duration_s:45}]}}}),
   session(0,{details:{exercises:[{exercise_id:'gym',sets:[{reps:5,load:100,minutes:0}]}],notes:''}}),
  ]);
  const squat=series.find(s=>s.key==='squat')!;expect(squat.points.map(p=>p.value)).toEqual([8,12]);
  expect(series.find(s=>s.key==='plank')!.points[0]).toMatchObject({value:45});expect(series.find(s=>s.unit==='kg')!.points[0].value).toBeGreaterThan(100);
 });
});

describe('allergens (fud-ai approach)',()=>{
 it('understands Indian food words',()=>{expect(checkAllergens([{level:'possible',texts:['Paneer tikka']}],['milk'])).toEqual({level:'possible',matched:['milk']});expect(checkAllergens([{level:'possible',texts:['Aloo paratha']}],['gluten'])!.matched).toEqual(['gluten']);});
 it('a declared label beats a guess from the name',()=>expect(checkAllergens([{level:'possible',texts:['Peanut chikki']},{level:'declared',texts:['peanuts']}],['peanut'])!.level).toBe('declared'));
 it('"nuts" covers peanuts and tree nuts, and plain words do not match inside others',()=>{expect(allergyGroups(['nuts'])).toEqual(['peanut','tree nut']);expect(checkAllergens([{level:'possible',texts:['Butter chicken']}],['nuts'])!.level).toBe('none');});
 it('no allergies listed means no check',()=>expect(checkAllergens([{level:'declared',texts:['milk']}],[])).toBeNull());
});

describe('GPS distance',()=>{
 const fix=(lat:number,t:number,accuracy=5)=>({lat,lon:77.59,accuracy,t});
 it('measures a known distance',()=>expect(metresBetween({lat:12.97,lon:77.59},{lat:12.98,lon:77.59})).toBeCloseTo(1112,-1));
 // A noisy track like a real phone's: a fix a second, a few metres of wander.
 let seed=3;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;},gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-9))*Math.cos(2*Math.PI*rnd());
 const walk=(seconds:number,speed:number,noise:number,meter=new RouteMeter(),from=0)=>{for(let k=1;k<=seconds;k++)meter.add({lat:12.97+gauss()*noise/111195,lon:77.59+(from+k*speed+gauss()*noise)/108300,accuracy:6,t:k*1000});return meter;};
 it('stays within 5% on a noisy run and ignores rough fixes',()=>{
  const meter=walk(600,3,4);expect(meter.metres).toBeGreaterThan(1800*.95);expect(meter.metres).toBeLessThan(1800*1.05);
  expect(meter.add({lat:12.97,lon:77.6,accuracy:80,t:700000})).toBe(false);expect(MAX_SPEED_MS).toBe(12);
 });
 it('standing still adds almost nothing',()=>expect(walk(600,0,4).metres).toBeLessThan(25));
 it('a one-off jump is dropped',()=>{const meter=walk(120,3,2),before=meter.metres;expect(meter.add({lat:13.1,lon:77.59,accuracy:5,t:121000})).toBe(false);expect(meter.metres).toBe(before);});
 it('pace',()=>{expect(paceText(1000,360000)).toBe('6:00 /km');expect(paceText(10,1000)).toBe('–');});
});

describe('adaptive goal guardrails (fud-ai)',()=>{
 it('moves at most 150 kcal a week and skips changes under 25',()=>{expect(weeklyStep(2200,1700)).toEqual({next:2050,change:-150});expect(weeklyStep(2000,2020)).toEqual({next:2000,change:0});expect(weeklyStep(1800,1900)).toEqual({next:1900,change:100});});
});

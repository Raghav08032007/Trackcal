// Muscle recovery from every kind of saved training: percent per muscle, ready-in hours, doses adding up, light work.
import {describe,expect,it} from 'vitest';
import {dosesOf,freshExercises,readiness,recovery,stateOf} from '@/lib/muscle-recovery';
import type {Session} from '@/lib/wellness';

const H=3600000,NOW=Date.parse('2026-11-28T12:00:00Z');
const session=(hoursAgo:number,exercises:Session['details']['exercises'],extra:Partial<Session>={}):Session=>({id:String(Math.random()),name:'x',plan_activity_id:null,status:'completed',revision:2,minutes:30,active_seconds:0,
 started_at:new Date(NOW-hoursAgo*H-1800000).toISOString(),completed_at:new Date(NOW-hoursAgo*H).toISOString(),details:{exercises,notes:''},...extra});
const sets=(n:number,reps=10)=>Array.from({length:n},()=>({reps,load:0,minutes:0}));
const of=(list:ReturnType<typeof recovery>,m:string)=>list.find(x=>x.muscle===m)!;

describe('muscle recovery',()=>{
 it('a hard leg day right now leaves quads tired and arms fresh',()=>{
  const list=recovery(dosesOf(session(0,[{exercise_id:'camera_squat',sets:sets(6)}])),NOW);
  expect(of(list,'quadriceps').percent).toBe(0);expect(of(list,'quadriceps').state).toBe('worked');
  expect(of(list,'gluteal').percent).toBeGreaterThan(0);   // a helper muscle gets less
  expect(of(list,'biceps').percent).toBe(100);expect(list[0].muscle).toBe('quadriceps');
 });
 it('recovers over about three days for big muscles, two for small ones',()=>{
  const legs=dosesOf(session(36,[{exercise_id:'camera_squat',sets:sets(6)}])),arms=dosesOf(session(36,[{exercise_id:'camera_curl',sets:sets(6)}]));
  expect(of(recovery(legs,NOW),'quadriceps').percent).toBe(50);
  expect(of(recovery(arms,NOW),'biceps').percent).toBe(75);
  expect(of(recovery(legs,NOW+40*H),'quadriceps').percent).toBe(100);
 });
 it('says when a tired muscle will be ready',()=>{
  const q=of(recovery(dosesOf(session(0,[{exercise_id:'camera_squat',sets:sets(6)}])),NOW),'quadriceps');
  expect(q.readyInHours).toBeGreaterThan(60);expect(q.readyInHours).toBeLessThanOrEqual(72);
 });
 it('a light session recovers faster than a hard one',()=>{
  const light=of(recovery(dosesOf(session(12,[{exercise_id:'camera_squat',sets:sets(2)}])),NOW),'quadriceps');
  const hard=of(recovery(dosesOf(session(12,[{exercise_id:'camera_squat',sets:sets(6)}])),NOW),'quadriceps');
  expect(light.percent).toBeGreaterThan(hard.percent);
 });
 it('training a tired muscle again adds up',()=>{
  const once=of(recovery(dosesOf(session(24,[{exercise_id:'camera_lunge',sets:sets(4)}])),NOW),'quadriceps');
  const twice=of(recovery([...dosesOf(session(24,[{exercise_id:'camera_lunge',sets:sets(4)}])),...dosesOf(session(2,[{exercise_id:'camera_squat',sets:sets(3)}]))],NOW),'quadriceps');
  expect(twice.percent).toBeLessThan(once.percent);
 });
 it('counts runs, yoga and holds; breathing and meditation rest the body',()=>{
  const run=recovery(dosesOf(session(1,[{exercise_id:'run',sets:[{reps:0,load:0,minutes:45}]}])),NOW);
  expect(of(run,'quadriceps').percent).toBeLessThan(60);expect(of(run,'chest').percent).toBe(100);
  const yoga=recovery(dosesOf(session(1,[{exercise_id:'yoga_virabhadrasana-2',sets:[{reps:0,load:0,minutes:1}]}])),NOW);
  expect(of(yoga,'quadriceps').percent).toBeGreaterThan(80);expect(of(yoga,'quadriceps').percent).toBeLessThan(100);
  expect(dosesOf(session(1,[{exercise_id:'camera_plank',sets:[{reps:0,load:0,minutes:1}]}]))[0].muscles.abs).toBeGreaterThan(0);
  expect(dosesOf(session(1,[{exercise_id:'breath_box',sets:[]},{exercise_id:'meditation_breath',sets:[]}]))).toEqual([]);
 });
 it('uses the camera-counted reps when the session was tracked',()=>{
  const s=session(0,[{exercise_id:'camera_squat',sets:sets(1)}],{details:{exercises:[{exercise_id:'camera_squat',sets:sets(1)}],notes:'',tracking:{exercise_type:'squat',confidence_mean:.9,sampled_frames:100,sets:[{estimated_reps:12,corrected_reps:null},{estimated_reps:12,corrected_reps:null},{estimated_reps:3,corrected_reps:null}]}}});
  expect(dosesOf(s)[0].muscles.quadriceps).toBe(2.5);
 });
 it('ignores unfinished sessions and future dates',()=>{
  expect(dosesOf(session(0,[{exercise_id:'camera_squat',sets:sets(6)}],{status:'paused'}))).toEqual([]);
  expect(of(recovery(dosesOf(session(-5,[{exercise_id:'camera_squat',sets:sets(6)}])),NOW),'quadriceps').percent).toBe(100);
 });
 it('readiness and fresh exercises follow the map',()=>{
  const list=recovery(dosesOf(session(0,[{exercise_id:'camera_squat',sets:sets(6)}])),NOW);
  expect(readiness(list,NOW)).toBeLessThan(60);expect(readiness(recovery([],NOW),NOW)).toBe(100);
  const fresh=freshExercises(list);expect(fresh).toContain('pushup');expect(fresh).not.toContain('lunge');
 });
 it('bands match the map colours',()=>{expect([stateOf(20),stateOf(50),stateOf(80),stateOf(95)]).toEqual(['worked','recovering','nearly','ready']);});
});

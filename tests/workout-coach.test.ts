import {describe,it,expect} from 'vitest';
import {EXERCISES} from '@/lib/pose/types';
import {validStoredValue} from '@/lib/storage-validation';
import {CIRCUIT_PRESETS,MAX_REST,MIN_REST,earnedBack,repCalories,stepMinutes} from '@/lib/workout-coach';

describe('workout coach',()=>{
 it('adds back half of a rough burn, and never takes food away',()=>{expect(earnedBack(100)).toBe(50);expect(earnedBack(0)).toBe(0);expect(earnedBack(-5)).toBe(0);});
 it('scales rep calories with body weight',()=>{expect(repCalories(10,.4,70)).toBe(4);expect(repCalories(10,.4,105)).toBe(6);});
 it('records at least the minute the server needs',()=>{expect(stepMinutes(20)).toBe(1);expect(stepMinutes(120)).toBe(2);expect(stepMinutes(99999)).toBe(180);});
 it('ships only workouts the app can run',()=>{for(const c of CIRCUIT_PRESETS){expect(c.rest).toBeGreaterThanOrEqual(MIN_REST);expect(c.rest).toBeLessThanOrEqual(MAX_REST);for(const s of c.steps)expect(EXERCISES).toHaveProperty(s.kind);}});
 it('stores saved workouts, runs and burn, and refuses bad ones',()=>{
  expect(validStoredValue('trackcal:studio:circuits',CIRCUIT_PRESETS)).toBe(true);
  expect(validStoredValue('trackcal:studio:circuits',[{id:'a'}])).toBe(false);
  expect(validStoredValue('trackcal:studio:circuit-run',[{id:'a',exercise:'squat',sets:[],minutes:1}])).toBe(true);
  expect(validStoredValue('trackcal:burn:2026-11-02',12.5)).toBe(true);
  expect(validStoredValue('trackcal:burn:2026-11-02',-1)).toBe(false);
 });
});

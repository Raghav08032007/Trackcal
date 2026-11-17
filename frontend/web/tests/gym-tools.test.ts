import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {adaptiveGoal,oneRepMax,platesPerSide,type GoalDay} from '@/lib/gym-math';
import {EXERCISES} from '@/lib/pose/types';

const day=(i:number)=>new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10);
describe('gym maths',()=>{
 it('estimates a one-rep max',()=>{expect(oneRepMax(60,5)).toBe(70);expect(oneRepMax(100,1)).toBe(100);expect(oneRepMax(60,20)).toBeNull();});
 it('loads a bar',()=>{expect(platesPerSide(100,20,[25,20,15,10,5,2.5,1.25])).toEqual({rows:[{plate:25,count:1},{plate:15,count:1}],left:0});expect(platesPerSide(10,20,[5])).toBeNull();expect(platesPerSide(21,20,[1.25])?.left).toBe(1);});
});
describe('adaptive goal',()=>{
 /* Eating 2000 while losing 0.5 kg a week means burning 2500. */
 const steady:GoalDay[]=Array.from({length:21},(_,i)=>({date:day(i),calories:2000,weight:i%3===0?80-i*.5/7:undefined}));
 it('finds the real burn from food and weight',()=>{const g=adaptiveGoal(steady,0)!;expect(g.burn).toBeCloseTo(2550,-2);expect(g.kgPerWeek).toBe(-.5);expect(g.target).toBeGreaterThan(2400);});
 it('waits for enough data',()=>{expect(adaptiveGoal(steady.slice(0,7),0)).toBeNull();expect(adaptiveGoal(steady.map(d=>({...d,weight:undefined})),0)).toBeNull();});
 it('never suggests a crash diet',()=>{const low=steady.map(d=>({...d,calories:900}));expect(adaptiveGoal(low,-.5)!.target).toBe(1200);});
});
describe('exercise library',()=>{
 const data=JSON.parse(fs.readFileSync('public/exercise-library.json','utf8')).exercises as {n:string;k?:string;l:string}[];
 it('has every entry, and every link goes to a real camera exercise',()=>{expect(data.length).toBeGreaterThan(800);for(const row of data){expect(['easy','medium','hard']).toContain(row.l);if(row.k)expect(EXERCISES).toHaveProperty(row.k);}});
 it('leaves stretches unlinked and keeps no instructions or photos',()=>{const raw=fs.readFileSync('public/exercise-library.json','utf8');expect(raw).not.toContain('.jpg');expect(raw).not.toContain('instructions');});
});

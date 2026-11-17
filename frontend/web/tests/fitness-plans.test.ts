import {describe,expect,it} from 'vitest';
import {nextProgramDay,pickDishes,PROGRAMS,programDay,programDays,weeklyReview,type MenuDish} from '@/lib/fitness-plans';
import type {Session} from '@/lib/wellness';

const dish=(name:string,calories:number,protein_g:number,vegetarian:boolean|null=true):MenuDish=>({name,calories,protein_g,carbs_g:0,fat_g:0,vegetarian});

describe('programs',()=>{
 const home=PROGRAMS[0];
 it('raises targets each week and stops at the end',()=>{
  expect(programDay(home,0)!.steps[0].target).toBe(10);
  expect(programDay(home,3)!.steps[0].target).toBe(11);
  expect(programDay(home,3)!.name).toBe('Home starter, week 2 day 1');
  expect(programDay(home,programDays(home))).toBeNull();
  expect(programDay(home,-1)).toBeNull();
  expect(programDay(home,1.5)).toBeNull();
 });
 it('finds the first day not done, across gaps, and ends when all are done',()=>{
  expect(nextProgramDay(home,['home-start:0','home-start:2'])).toBe(1);
  expect(nextProgramDay(home,Array.from({length:programDays(home)},(_,i)=>`home-start:${i}`))).toBeNull();
 });
});

describe('menu picker',()=>{
 const menu=[dish('Butter naan',300,6),dish('Paneer tikka',320,24),dish('Biryani',900,30),dish('Chicken tikka',280,35,false),dish('Unknown',200,10,null)];
 it('ranks by protein per calorie among what fits',()=>expect(pickDishes(menu,400,false).best.map(d=>d.name)).toEqual(['Chicken tikka','Paneer tikka','Unknown']));
 it('reports what was too big',()=>expect(pickDishes(menu,400,false).tooBig).toBe(1));
 it('vegetarian only keeps dishes clearly marked vegetarian',()=>expect(pickDishes(menu,400,true).best.map(d=>d.name)).toEqual(['Paneer tikka','Butter naan']));
 it('offers nothing when no budget is left',()=>expect(pickDishes(menu,0,false).best).toEqual([]));
});

describe('weekly review',()=>{
 const now=Date.parse('2026-11-02T12:00:00'),session=(daysAgo:number,minutes=10,status='completed')=>({status,minutes,completed_at:new Date(now-daysAgo*86400000).toISOString(),details:{exercises:[{sets:[{reps:10},{reps:5}]}]}}) as unknown as Session;
 it('counts the last seven days only',()=>{
  const review=weeklyReview([session(0),session(6),session(7),session(1,10,'active')],[],now);
  expect(review).toMatchObject({workouts:2,reps:30,activeDays:2});expect(review.bars).toHaveLength(7);
 });
 it('averages only days with food logged',()=>expect(weeklyReview([],[{date:'2026-11-02',calories:2000},{date:'2026-11-01',calories:1000},{date:'2026-10-31',calories:0},{date:'2026-10-01',calories:9000}],now).averageCalories).toBe(1500));
 it('has something kind to say about an empty week',()=>expect(weeklyReview([],[],now).nudge).toContain('quiet week'));
});

// Phase F4: scoring in the Play sports games. Points only from counted movements; combos reward a steady run; stars scale with
// the round's length; a personal best is kept on this device only.
import {describe,it,expect,beforeEach} from 'vitest';
import {multiplier,readBests,saveBest,scoreCount,starGoals,stars,startScore} from '@/lib/sport-game';

describe('scoring',()=>{
 it('adds points only for new counts, and keeps the combo while moves keep coming',()=>{
  let s=startScore();s=scoreCount(s,'skip',1,1000);expect(s).toMatchObject({count:1,points:10,combo:1});
  s=scoreCount(s,'skip',1,1500);expect(s.points).toBe(10);                    // the same count again adds nothing
  for(let n=2;n<=7;n++)s=scoreCount(s,'skip',n,1000+n*500);
  expect(s.combo).toBe(7);expect(s.points).toBe(10*5+20*2);                    // x2 from the sixth in a row
  s=scoreCount(s,'skip',8,20000);expect(s.combo).toBe(1);expect(s.bestCombo).toBe(7);
 });
 it('several counts at once each score',()=>{expect(scoreCount(startScore(),'box',3,500).count).toBe(3);});
 it('the multiplier stops at x5',()=>{expect([1,5,6,11,21,99].map(multiplier)).toEqual([1,1,2,3,5,5]);});
 it('stars scale with the round length',()=>{
  expect(starGoals('skip',30)).toEqual([20,40,60]);expect(stars('skip',45,30)).toBe(2);expect(stars('cricket',20,60)).toBe(3);expect(stars('box',0,60)).toBe(0);
 });
});
describe('personal bests on this device',()=>{
 beforeEach(()=>localStorage.clear());
 it('saves only a better score, per game and round length',()=>{
  expect(saveBest('skip',60,120)).toEqual({best:120,isNew:true});
  expect(saveBest('skip',60,90)).toEqual({best:120,isNew:false});
  expect(saveBest('skip',30,0)).toEqual({best:0,isNew:false});
  expect(readBests()).toEqual({'skip:60':120});
 });
 it('survives broken storage',()=>{localStorage.setItem('trackcal:play:sport-bests','{oops');expect(readBests()).toEqual({});});
});

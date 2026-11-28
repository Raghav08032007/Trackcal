// Breathing timings, meditation prompts and the Surya Namaskar follower.
import {describe,expect,it} from 'vitest';
import {BREATH_BY_ID,circleSize,cycleSeconds,phaseAt} from '@/lib/yoga/breathing';
import {MEDITATION_BY_ID,promptsBetween} from '@/lib/yoga/meditation';
import {SURYA,SuryaTracker} from '@/lib/yoga/surya';
import {demoPoints} from '@/lib/yoga/score';
import {ASANA_BY_ID} from '@/lib/yoga/asanas';

describe('breathing',()=>{
 it('walks through box breathing phase by phase and starts the next round',()=>{
  const b=BREATH_BY_ID.box;expect(cycleSeconds(b)).toBe(16);
  expect(phaseAt(b,0).phase.kind).toBe('in');expect(phaseAt(b,4500).phase.kind).toBe('hold');expect(phaseAt(b,8500).phase.kind).toBe('out');
  expect(phaseAt(b,12500).index).toBe(3);expect(phaseAt(b,16500).cycle).toBe(2);expect(phaseAt(b,1000).left).toBe(3);
 });
 it('alternate nostril breathing names the nostril',()=>{
  const b=BREATH_BY_ID['nadi-shodhana'];expect(phaseAt(b,0).phase.say).toMatch(/left/);expect(phaseAt(b,5000).phase.say).toMatch(/right/);
 });
 it('the circle grows on the breath in, holds, and shrinks on the breath out',()=>{
  expect(circleSize('in',0,.35)).toBeCloseTo(.35);expect(circleSize('in',1,.35)).toBeCloseTo(1);
  expect(circleSize('hold',.5,1)).toBe(1);expect(circleSize('out',1,1)).toBeCloseTo(.35);
 });
 it('strong techniques carry a caution and a beginner limit',()=>{
  expect(BREATH_BY_ID.kapalbhati.caution).toMatch(/blood pressure/);expect(BREATH_BY_ID.kapalbhati.maxCycles).toBeGreaterThan(0);
 });
});

describe('meditation',()=>{
 it('places the guided prompts through the session, each once',()=>{
  const m=MEDITATION_BY_ID['body-scan'],seen:string[]=[];
  for(let t=-1;t<5*60000;t+=250)seen.push(...promptsBetween(m,5,t,t+250).map(p=>p.text));
  expect(seen).toEqual(m.prompts.map(p=>p.text));
 });
 it('the silent timer says nothing',()=>expect(promptsBetween(MEDITATION_BY_ID.silent,10,-1,600000)).toEqual([]));
});

describe('Surya Namaskar',()=>{
 const frame=(id:string,t:number)=>({landmarks:[demoPoints(ASANA_BY_ID[id])],timestamp:t,width:480,height:480});
 it('has the 12 steps in the traditional order, starting and ending in prayer',()=>{
  expect(SURYA).toHaveLength(12);expect(SURYA[0].asana.id).toBe('pranamasana');expect(SURYA[11].asana.id).toBe('pranamasana');
  expect(SURYA[7].asana.id).toBe('adho-mukha-svanasana');
 });
 it('counts a round when the twelve poses are done in order',()=>{
  const tr=new SuryaTracker();let t=0;
  for(const s of SURYA)for(let i=0;i<10;i++){tr.update(frame(s.asana.id,t));t+=100;}
  expect(tr.rounds).toBe(1);expect(tr.step).toBe(0);expect(tr.average).toBeGreaterThanOrEqual(95);
 });
 it('skipping ahead does not count: the steps must come in order',()=>{
  const tr=new SuryaTracker();let t=0;
  for(const id of ['pranamasana','bhujangasana','adho-mukha-svanasana'])for(let i=0;i<10;i++){tr.update(frame(id,t));t+=100;}
  expect(tr.step).toBe(1);
 });
 it('a pose must be held for a moment, not just passed through',()=>{
  const tr=new SuryaTracker();tr.update(frame('pranamasana',0));tr.update(frame('pranamasana',300));expect(tr.step).toBe(0);
 });
});

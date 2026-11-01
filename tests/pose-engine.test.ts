import {describe,it,expect} from 'vitest';
import {normalize,angle} from '@/lib/pose/landmarks';
import {SessionTracker} from '@/lib/pose/session-tracker';
import {formFeedback} from '@/lib/pose/feedback';
import {validStoredValue} from '@/lib/storage-validation';
import {exportLocalEntries,workspaceKey} from '@/lib/use-local-state';
import {pose} from './fixtures/pose';
import type {ExerciseKind} from '@/lib/pose/types';
function phase(t:SessionTracker,kind:ExerciseKind,bent:boolean,start:number,quality=.95){let r;for(let i=0;i<5;i++)r=t.frame(pose(kind,bent,start+i*100,quality));return r;}
describe('on-device movement estimates',()=>{
 it('normalizes aspect ratio and rejects invalid/multiple poses',()=>{expect(normalize(pose('squat'))![11].x).toBeCloseTo(2/3);const f=pose('squat');f.landmarks.push(f.landmarks[0]);expect(normalize(f)).toBeNull();f.landmarks=[pose('squat').landmarks[0]];f.landmarks[0][0].x=NaN;expect(normalize(f)).toBeNull();expect(angle({x:0,y:0},{x:0,y:1},{x:0,y:2})).toBe(180);});
 for(const kind of ['squat','pushup','curl'] as ExerciseKind[]){
  it(`${kind}: requires start, bend, stable return; repeated frames never multiply reps`,()=>{const t=new SessionTracker(kind);phase(t,kind,true,0);expect(t.counter.reps).toBe(0);phase(t,kind,false,500);phase(t,kind,true,1000);phase(t,kind,false,1500);expect(t.counter.reps).toBe(1);for(let i=0;i<25;i++)t.frame(pose(kind,false,1900));expect(t.counter.reps).toBe(1);phase(t,kind,false,2000);expect(t.counter.reps).toBe(1);});
  it(`${kind}: low confidence interrupts a cycle instead of verifying it`,()=>{const t=new SessionTracker(kind);phase(t,kind,false,0);phase(t,kind,true,500);phase(t,kind,true,1000,.2);phase(t,kind,true,1650,.2);phase(t,kind,false,2200);expect(t.counter.reps).toBe(0);expect(t.summary().low_confidence_frames).toBeGreaterThan(0);});
 }
 it('pause/resume and long frame gaps require recalibration',()=>{const t=new SessionTracker('squat');phase(t,'squat',false,0);phase(t,'squat',true,500);t.pause();expect(t.frame(pose('squat',false,1100))).toBeNull();t.resume();phase(t,'squat',false,1200);expect(t.counter.reps).toBe(0);phase(t,'squat',true,1700);phase(t,'squat',false,4000);expect(t.counter.reps).toBe(0);t.reset();expect(t.summary().sampled_frames).toBe(0);});
 it('rejects partial view, darkness, camera jumps and multiple people',()=>{const t=new SessionTracker('squat');const partial=pose('squat');partial.landmarks[0][23].x=1;partial.landmarks[0][24].x=1;expect(t.frame(partial)?.accepted).toBe(false);const dark=pose('squat',false,100);dark.brightness=10;expect(t.frame(dark)?.message).toContain('brighter');t.frame(pose('squat',false,200));const moved=pose('squat',false,300);moved.landmarks[0][23].x+=.2;moved.landmarks[0][24].x+=.2;expect(t.frame(moved)?.message).toContain('view moved');const crowd=pose('squat',false,400);crowd.landmarks.push(crowd.landmarks[0]);expect(t.frame(crowd)?.accepted).toBe(false);});
 it('suppresses optional feedback and validates corrected summaries without landmarks',()=>{expect(formFeedback('Low confidence',false)).toBe('');const v={id:crypto.randomUUID(),exercise:'squat',minutes:1,planId:'',sets:[{estimated_reps:2,corrected_reps:3,confidence_mean:.8,sampled_frames:40,low_confidence_frames:3}]};expect(validStoredValue('trackcal:camera:draft',v)).toBe(true);expect(validStoredValue('trackcal:camera:draft',{...v,sets:[{...v.sets[0],corrected_reps:101}]})).toBe(false);});
 it('keeps camera review drafts out of cloud workspace backups',()=>{const value={id:crypto.randomUUID(),exercise:'squat',minutes:1,planId:'',sets:[{estimated_reps:1,corrected_reps:null,confidence_mean:.8,sampled_frames:20,low_confidence_frames:0}]};localStorage.setItem(workspaceKey('trackcal:camera:draft','p4-export'),JSON.stringify(value));expect(exportLocalEntries('p4-export')['trackcal:camera:draft']).toBeUndefined();});
});

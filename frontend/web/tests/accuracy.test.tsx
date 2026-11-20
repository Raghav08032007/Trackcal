// The accuracy report for TrackCal's team, and the AI's original photo estimate travelling with a logged meal.
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi,afterEach} from 'vitest';
import Accuracy from '../src/app/accuracy/page';
import {toServer} from '../src/lib/diary';
afterEach(()=>vi.unstubAllGlobals());

const report={days:90,min_samples:30,areas:[
 {area:'food_photo',samples:42,kept_unchanged:0.31,within_target:0.74,median_abs_error_pct:14.5,median_bias_pct:6.2,status:'below_target'},
 {area:'camera_reps',sets:120,kept_unchanged:0.8,within_one_rep:0.93,mean_abs_error_reps:0.41,status:'meets_target',by_exercise:[{exercise:'squat',sets:80,kept_unchanged:0.85,within_one_rep:0.95,mean_abs_error_reps:0.3}]},
 {area:'barcode_coverage',lookups:12,found:0.75,status:'not_enough_data',note:''}]};

it('shows each area with its figures, target status and period',async()=>{
 const f=vi.fn(async(url:string)=>Response.json({...report,days:Number(new URL(url,'http://x').searchParams.get('days'))}));vi.stubGlobal('fetch',f);
 const user=userEvent.setup();render(<Accuracy/>);
 await screen.findByRole('heading',{name:'AI photo calories'});
 expect(screen.getByText('Below the target')).toBeTruthy();
 expect(screen.getByText('Meets the target')).toBeTruthy();
 expect(screen.getByText('Not enough data yet')).toBeTruthy();
 expect(screen.getByText('74%')).toBeTruthy();
 expect(screen.getByText('+6.2%')).toBeTruthy();
 expect(screen.getByRole('rowheader',{name:'squat'})).toBeTruthy();
 await user.click(screen.getByRole('tab',{name:'Last 365 days'}));
 await waitFor(()=>expect(f.mock.calls.some(([u])=>String(u).includes('days=365'))).toBe(true));
});

it('tells people outside the team that the page is not for them',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Moderators only.'},{status:403})));
 render(<Accuracy/>);
 await screen.findByText("Only TrackCal's team can see this page.");
});

it('sends the AI estimate only with photo meals',()=>{
 const photo=toServer({id:'a',time:'13:00',name:'Thali',calories:620,protein:20,carbs:80,fat:20,method:'Photo scan (user reviewed)',grams:450,ai_estimate:{calories:700,grams:500}},'2026-11-20');
 expect(photo).toMatchObject({method:'photo',ai_estimate:{calories:700,grams:500}});
 const manual=toServer({id:'b',time:'13:00',name:'Thali',calories:620,protein:20,carbs:80,fat:20,method:'Manual',ai_estimate:{calories:700,grams:500}},'2026-11-20');
 expect('ai_estimate' in manual).toBe(false);
});

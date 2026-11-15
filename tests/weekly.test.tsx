// Phase G: Your weeks. Labels for training pace never rely on colour; bars, legend, table view and hover details all work.
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {niceMax,pace,type Trend} from '@/lib/trend';

const week=(i:number,met:number)=>({start:`2026-${String(8+Math.floor(i/4)).padStart(2,'0')}-${String(1+(i%4)*7).padStart(2,'0')}`,minutes:Math.round(met/5),met_minutes:met,distance_m:met*5,active_days:3,sessions:3,by_kind:{run:met*.6,strength:met*.4}});
const data:Trend={today:'2026-11-15',method:'Minutes × METs (Compendium).',weeks:Array.from({length:12},(_,i)=>week(i,300+i*80)),
 guideline:{met_minutes:1180,minimum:600,more:1200,status:'met',text:'You’ve met the WHO weekly activity guideline.',days_into_week:7},
 trend:{days:Array.from({length:84},(_,i)=>({day:`2026-0${8+Math.floor(i/31)}-${String(1+i%28).padStart(2,'0')}`,load:100,fitness:20+i/4,fatigue:25+(i%7),form:-5})),fitness:41,fatigue:31,form:10,ratio:1.1,enough_history:true,message:'Steady: you’re training at a level your body is used to.'}};
vi.mock('@/components/account-session',()=>({useAccount:()=>({ready:true,user:{id:'u'}})}));
vi.mock('@/lib/trend',async(orig)=>({...(await orig<typeof import('@/lib/trend')>()),loadTrend:()=>Promise.resolve(data)}));

describe('your weeks',()=>{
 it('names the training pace in words',()=>{expect([null,.5,1,1.4,1.8].map(r=>pace(r).label)).toEqual(['Building your baseline','Lighter week','Steady','Building fast','Big jump']);});
 it('rounds chart tops to readable numbers',()=>{expect([0,90,1300,2600,7000].map(niceMax)).toEqual([100,100,2000,5000,10000]);});
 it('shows the guideline, the trend and twelve weeks, with hover details and a table view',async()=>{
  const {default:Page}=await import('@/app/weekly/page');
  const {container}=render(<Page/>);
  expect(await screen.findByText('Guideline met')).toBeTruthy();expect(screen.getByText('Steady')).toBeTruthy();
  const hits=container.querySelectorAll('.wk-hit');expect(hits.length).toBe(12);
  fireEvent.focus(hits[11]);expect(screen.getByRole('status').textContent).toMatch(/1,180 MET-minutes/);
  expect(screen.getByText('Running')).toBeTruthy();expect(screen.getByText('WHO minimum · 600')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Show table/}));expect(screen.getAllByRole('row')).toHaveLength(13);
  expect(container.querySelectorAll('path.wk-line')).toHaveLength(2);
 });
});

// Trainer dashboard: the client's "Share progress with a coach" (hidden while switched off; consent choices sent as
// ticked) and the coach's client list (only shared categories show figures; "not shared" otherwise).
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi,afterEach} from 'vitest';
import {CoachSharing} from '../src/components/coach-sharing';
import Clients from '../src/app/coach/clients/page';
afterEach(()=>vi.unstubAllGlobals());
type Handler=(url:string,init?:RequestInit)=>Response|undefined;
function api(handler:Handler){const f=vi.fn(async(url:string,init?:RequestInit)=>handler(url,init)??Response.json({error:'Not found'},{status:404}));vi.stubGlobal('fetch',f);return f;}
const sent=(f:ReturnType<typeof api>,match:string,method:string)=>f.mock.calls.filter(([u,o])=>String(u).endsWith(match)&&o?.method===method).map(([,o])=>JSON.parse(o!.body as string));

it('stays hidden while the trainer dashboard is switched off',async()=>{
 const f=api(()=>undefined);const {container}=render(<CoachSharing/>);
 await waitFor(()=>expect(f).toHaveBeenCalled());
 expect(container.innerHTML).toBe('');
});

it('starts sharing only what the client ticked, and can stop',async()=>{
 let coaches:unknown[]=[];
 const f=api((url,o)=>{
  if(url.endsWith('/coach-clients/mine'))return Response.json({coaches});
  if(url.endsWith('/coach-clients/join')){coaches=[{id:'l1',coach:'Asha',share:{diary:false,workouts:true,weight:false},since:'2026-11-20T10:00:00Z'}];return Response.json({},{status:201});}
  if(url.endsWith('/coach-clients/l1')&&o?.method==='DELETE'){coaches=[];return Response.json({status:'ended'});}
  if(url.endsWith('/coach-clients'))return Response.json({error:'Only verified coach accounts can follow clients.'},{status:403});
 });
 const user=userEvent.setup();render(<CoachSharing/>);
 await screen.findByRole('heading',{name:'Share progress with a coach'});
 expect(screen.queryByText(/Open your client dashboard/)).toBeNull();
 const start=screen.getByRole('button',{name:'Start sharing'}) as HTMLButtonElement;
 await user.type(screen.getByLabelText('Code from your coach'),'ABCD-2345');
 expect(start.disabled).toBe(true);                                  // nothing chosen yet
 await user.click(screen.getAllByLabelText('Workouts and active minutes')[0]);
 await user.click(start);
 await waitFor(()=>expect(sent(f,'/coach-clients/join','POST')).toEqual([{code:'ABCD-2345',share:{diary:false,workouts:true,weight:false}}]));
 await screen.findByText('Asha');
 await user.click(screen.getByRole('button',{name:'Stop sharing'}));
 await screen.findByText('You stopped sharing. Your coach can no longer see your progress.');
});

it('shows coaches figures only for what each client shares',async()=>{
 api(url=>{
  if(url.endsWith('/coach-clients'))return Response.json({open_invites:1,max_clients:50,clients:[{id:'a'.repeat(36),name:'Ravi',since:null,share:{diary:true,workouts:false,weight:true},days:[],last_active:'2026-11-19',
   diary:{days_logged:5,average_kcal:1850,target_kcal:2000,by_day:{}},weight:{latest_kg:70.2,measured_on:'2026-11-19',change_kg:-0.8}}]});
 });
 render(<Clients/>);
 const row=(await screen.findByRole('button',{name:'Ravi'})).closest('tr')!;
 const cells=[...row.querySelectorAll('td')].map(td=>td.textContent);
 expect(cells[1]).toBe('5/7');
 expect(cells[2]).toBe('1,850 / 2,000');
 expect(cells[3]).toBe('not shared');
 expect(cells[4]).toBe('-0.8 kg');
});

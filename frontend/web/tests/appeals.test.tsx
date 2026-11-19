// KI-40: a person removed from a community can ask TrackCal to look again; site moderators reinstate or keep the ban
// and see how each community is moderated.
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'ki40'},ready:true}),useWorkspaceScope:()=>'ki40'}));
import Directory from '../src/app/communities/page';
import Moderation from '../src/app/moderation/page';
afterEach(()=>vi.unstubAllGlobals());
type Handler=(url:string,init?:RequestInit)=>Response|undefined;
function api(handler:Handler){const f=vi.fn(async(url:string,init?:RequestInit)=>handler(url,init)??Response.json({}));vi.stubGlobal('fetch',f);return f;}
const posted=(f:ReturnType<typeof api>,match:string)=>f.mock.calls.filter(([u,o])=>String(u).includes(match)&&o?.method==='POST').map(([,o])=>JSON.parse(o!.body as string));

it('shows the communities that removed you and sends an appeal',async()=>{
 let appealed=false;
 const f=api((url,o)=>{
  if(url.endsWith('/social/me'))return Response.json({profile:{handle:'asha'},requests:0});
  if(url.endsWith('/communities/bans'))return Response.json({bans:[{slug:'campus-runners',name:'Campus Runners',appeal:appealed?'open':null,can_appeal:!appealed,next_appeal_at:null}]});
  if(url.endsWith('/campus-runners/appeal')){appealed=true;return Response.json({status:"Thanks. TrackCal's team will review this."},{status:201});}
  if(url.startsWith('/api/communities'))return Response.json({communities:[]});
 });
 const user=userEvent.setup();render(<Directory/>);
 await screen.findByRole('heading',{name:'Removed from a community'});
 await user.click(screen.getByRole('button',{name:'Ask TrackCal to review'}));
 const send=screen.getByRole('button',{name:'Send appeal'}) as HTMLButtonElement;
 expect(send.disabled).toBe(true);   // at least 10 characters
 await user.type(screen.getByLabelText('Why should we look again?'),'It was a joke between friends.');
 await user.click(send);
 await screen.findByText("Thanks. TrackCal's team will review this.");
 expect(posted(f,'/campus-runners/appeal')).toEqual([{note:'It was a joke between friends.'}]);
 await screen.findByText(/Your appeal is with our team/);
});

it('shows nothing about bans when there are none',async()=>{
 api(url=>{if(url.endsWith('/social/me'))return Response.json({profile:{handle:'asha'},requests:0});
  if(url.endsWith('/communities/bans'))return Response.json({bans:[]});
  if(url.startsWith('/api/communities'))return Response.json({communities:[]});});
 render(<Directory/>);await screen.findByRole('heading',{name:'Find your people.'});
 expect(screen.queryByRole('heading',{name:'Removed from a community'})).toBeNull();
});

it('lets a site moderator reinstate or keep a ban, with an overview of communities',async()=>{
 const f=api((url,o)=>{
  if(url.endsWith('/social/moderation')&&o?.method==='GET')return Response.json({queue:[],flagged_entries:[],
   appeals:[{id:'a'.repeat(36),community:'Campus Runners',slug:'campus-runners',handle:'asha',note:'Please look again.',created_at:'2026-11-18T10:00:00Z'}],
   communities:[{slug:'campus-runners',name:'Campus Runners',archived:false,members:12,moderators:1,banned:3,open_reports:2,open_appeals:1}]});
 });
 const user=userEvent.setup();render(<Moderation/>);
 await screen.findByRole('heading',{name:'Ban appeals'});
 expect(screen.getByText('Please look again.')).toBeTruthy();
 const row=screen.getByRole('rowheader',{name:'Campus Runners'}).closest('tr')!;
 expect([...row.querySelectorAll('td')].map(td=>td.textContent)).toEqual(['12','1','3','2','1']);
 await user.click(screen.getByRole('button',{name:'Keep the ban'}));
 await waitFor(()=>expect(posted(f,'/api/communities/appeals')).toEqual([{appeal_id:'a'.repeat(36),action:'uphold'}]));
});

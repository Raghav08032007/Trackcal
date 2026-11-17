import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes} from 'react-router';
import {it,expect,vi,afterEach} from 'vitest';
const push=vi.hoisted(()=>vi.fn());
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'p8-member'},ready:true}),useWorkspaceScope:()=>'p8-member'}));
vi.mock('@/lib/navigation',async importOriginal=>({...(await importOriginal<typeof import('@/lib/navigation')>()),useRouter:()=>({push})}));
import Directory from '../src/app/communities/page';
import CommunityPage from '../src/app/community/page';
afterEach(()=>{vi.unstubAllGlobals();push.mockReset();});
const base={slug:'campus-runners',name:'Campus Runners',description:'6am loops',category:'running',visibility:'public',rules:'Be kind.',archived:false,members:12,membership:null,can_moderate:false};
type Handler=(url:string,init?:RequestInit)=>Response|undefined;
function api(handler:Handler){const f=vi.fn(async(url:string,init?:RequestInit)=>handler(url,init)??Response.json({}));vi.stubGlobal('fetch',f);return f;}
const sent=(f:ReturnType<typeof api>,match:string,method='POST')=>f.mock.calls.filter(([u,o])=>String(u).includes(match)&&(o?.method||'GET')===method).map(([,o])=>o?.body?JSON.parse(o.body as string):null);
const at=(path:string)=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/c/:slug" element={<CommunityPage/>}/></Routes></MemoryRouter>);

it('asks for a feed profile before communities',async()=>{
 api(url=>url.endsWith('/social/me')?Response.json({profile:null,requests:0}):undefined);render(<Directory/>);
 await screen.findByRole('heading',{name:'Pick a handle first'});
});
it('lists, searches and creates a community with an address made from its name',async()=>{
 const f=api((url,o)=>{if(url.endsWith('/social/me'))return Response.json({profile:{handle:'asha'},requests:0});
  if(url.startsWith('/api/communities')&&o?.method==='POST')return Response.json({community:{...base,slug:'yoga-at-dawn'}},{status:201});
  if(url.startsWith('/api/communities'))return Response.json({communities:[base],categories:[]});});
 const user=userEvent.setup();render(<Directory/>);await screen.findByRole('heading',{name:'Campus Runners'});
 expect(screen.getByText('12 members')).toBeTruthy();
 await user.type(screen.getByLabelText('Search'),'run');await user.click(screen.getByRole('button',{name:'Search'}));
 await waitFor(()=>expect(f.mock.calls.some(([u])=>String(u).includes('q=run'))).toBe(true));
 await user.click(screen.getByRole('button',{name:'Start a community'}));await user.type(screen.getByLabelText('Name'),'Yoga at Dawn!');
 expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('yoga-at-dawn');
 await user.click(screen.getByRole('button',{name:'Create community'}));await waitFor(()=>expect(push).toHaveBeenCalledWith('/c/yoga-at-dawn'));
 expect(sent(f,'/api/communities')[0]).toMatchObject({name:'Yoga at Dawn!',slug:'yoga-at-dawn',visibility:'public'});
});
it('a public community can be read before joining; members get a composer',async()=>{
 let joined=false;const f=api((url,o)=>{if(url.endsWith('/membership')&&o?.method==='POST'){joined=true;return Response.json({membership:{role:'member',status:'active'}});}
  if(url.endsWith('/campus-runners'))return Response.json({community:{...base,membership:joined?{role:'member',status:'active'}:null},locked:false});
  if(url.endsWith('/posts')&&o?.method==='POST')return Response.json({post:{id:'n1',community_id:'c',author:{handle:'asha',display_name:'Asha',character_id:'pip'},body:'Who is in tomorrow?',milestone:null,visibility:'public',created_at:new Date().toISOString(),reactions:{like:0,cheer:0,clap:0,hug:0},my_reaction:null,comment_count:0,mine:true,hidden:false}},{status:201});
  if(url.includes('/posts'))return Response.json({posts:[],next:null});});
 const user=userEvent.setup();at('/c/campus-runners');await screen.findByRole('heading',{name:'Campus Runners'});
 expect(screen.queryByLabelText('Post to this community')).toBeNull();
 await user.click(screen.getByRole('button',{name:'Join'}));await screen.findByText('Welcome in!');
 await user.type(await screen.findByLabelText('Post to this community'),'Who is in tomorrow?');await user.click(screen.getByRole('button',{name:'Post'}));
 await screen.findByText('Who is in tomorrow?');expect(sent(f,'/campus-runners/posts')[0]).toEqual({body:'Who is in tomorrow?'});
});
it('a private community hides its posts until a request is approved',async()=>{
 const f=api((url,o)=>{if(url.endsWith('/membership')&&o?.method==='POST')return Response.json({membership:{role:'member',status:'pending'}});
  if(url.endsWith('/campus-runners'))return Response.json({community:{...base,visibility:'private'},locked:true});});
 const user=userEvent.setup();at('/c/campus-runners');await screen.findByText(/This community is private/);
 expect(f.mock.calls.some(([u])=>String(u).includes('/posts'))).toBe(false);
 await user.click(screen.getByRole('button',{name:'Request to join'}));await screen.findByText('Request sent. A moderator will review it.');
});
it('moderators approve requests from their tools',async()=>{
 let pending=[{handle:'kiran',display_name:'Kiran',character_id:'nova',role:'member'}];
 const f=api((url,o)=>{if(url.endsWith('/members/kiran')&&o?.method==='POST'){pending=[];return Response.json({status:'saved'});}
  if(url.includes('/members?status=pending'))return Response.json({members:pending});
  if(url.endsWith('/campus-runners'))return Response.json({community:{...base,membership:{role:'owner',status:'active'},can_moderate:true,pending:pending.length},locked:false});
  if(url.includes('/posts'))return Response.json({posts:[],next:null});});
 const user=userEvent.setup();at('/c/campus-runners');await user.click(await screen.findByRole('tab',{name:'Requests (1)'}));
 await user.click(await screen.findByRole('button',{name:'Approve'}));await screen.findByText('No requests waiting.');
 expect(sent(f,'/members/kiran')[0]).toEqual({action:'approve'});
});

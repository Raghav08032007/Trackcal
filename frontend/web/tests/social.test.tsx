import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes} from 'react-router';
import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'p7-member'},ready:true}),useWorkspaceScope:()=>'p7-member'}));
import Feed from '../src/app/feed/page';
import type {FeedPost} from '../src/lib/social';
import ProfilePage from '../src/app/profile/page';
afterEach(()=>vi.unstubAllGlobals());
const me={handle:'asha',display_name:'Asha',bio:'',character_id:'pip',private:false,counts:{followers:2,following:3,posts:1}};
const post=(id:string,author='ravi',extra={}):FeedPost=>({id,author:{handle:author,display_name:author[0].toUpperCase()+author.slice(1),character_id:'nova'},body:`Post ${id}`,milestone:null,visibility:'public',created_at:new Date().toISOString(),reactions:{like:2,cheer:0,clap:0,hug:0},my_reaction:null,comment_count:0,mine:false,hidden:false,...extra});
type Handler=(url:string,init?:RequestInit)=>Response|undefined;
function api(handler:Handler){const fetcher=vi.fn(async(url:string,init?:RequestInit)=>handler(url,init)??Response.json({}));vi.stubGlobal('fetch',fetcher);return fetcher;}
const calls=(f:ReturnType<typeof api>,match:string,method='POST')=>f.mock.calls.filter(([u,o])=>String(u).includes(match)&&(o?.method||'GET')===method).map(([,o])=>o?.body?JSON.parse(o.body as string):null);

it('says so when the feed is switched off',async()=>{
 api(url=>url.endsWith('/me')?Response.json({error:'The feed is not available yet.'},{status:404}):undefined);render(<Feed/>);
 await screen.findByRole('heading',{name:"The feed isn't available yet"});
});
it('asks for a handle first, explaining that posts are public unless the account is private',async()=>{
 let profile:object|null=null;const fetcher=api((url,o)=>{if(url.endsWith('/me')&&o?.method==='PUT'){profile=me;return Response.json({profile:me});}if(url.endsWith('/me'))return Response.json({profile,requests:0});if(url.includes('/feed'))return Response.json({posts:[],next:null});if(url.endsWith('/milestones'))return Response.json({milestones:[]});});
 const user=userEvent.setup();render(<Feed/>);await screen.findByRole('heading',{name:'Join the feed'});
 expect(screen.getByText(/public unless you make your account private/)).toBeTruthy();
 await user.type(screen.getByLabelText('Handle'),'asha');await user.type(screen.getByLabelText('Display name'),'Asha');await user.click(screen.getByLabelText(/Private account/));
 await user.click(screen.getByRole('button',{name:'Create my profile'}));await screen.findByRole('heading',{name:'Wins worth sharing.'});
 expect(calls(fetcher,'/social/me','PUT')[0]).toMatchObject({handle:'asha',display_name:'Asha',private:true,character_id:'pip'});
});
it('shows posts with public reaction counts; reacting and un-reacting go to the server',async()=>{
 let current=post('p1');const fetcher=api((url,o)=>{
  if(url.endsWith('/me'))return Response.json({profile:me,requests:0});if(url.includes('/feed'))return Response.json({posts:[current],next:null});if(url.endsWith('/milestones'))return Response.json({milestones:[]});
  if(url.endsWith('/reactions')){current=o?.method==='DELETE'?{...current,reactions:{...current.reactions,cheer:0},my_reaction:null}:{...current,reactions:{...current.reactions,cheer:1},my_reaction:'cheer'};return Response.json({post:current});}});
 const user=userEvent.setup();render(<Feed/>);await screen.findByText('Post p1');
 expect(screen.getByRole('button',{name:'Like, 2'})).toBeTruthy();expect(screen.getByText('2 reactions')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Cheer, 0'}));await screen.findByRole('button',{name:'Cheer, 1'});
 expect(screen.getByRole('button',{name:'Cheer, 1'}).getAttribute('aria-pressed')).toBe('true');expect(calls(fetcher,'/reactions')[0]).toEqual({kind:'cheer'});
 await user.click(screen.getByRole('button',{name:'Cheer, 1'}));await screen.findByRole('button',{name:'Cheer, 0'});expect(calls(fetcher,'/reactions','DELETE')).toHaveLength(1);
});
it('posts text with a server-checked milestone and shows it at the top',async()=>{
 const fetcher=api((url,o)=>{if(url.endsWith('/me'))return Response.json({profile:me,requests:0});if(url.includes('/feed'))return Response.json({posts:[],next:null});
  if(url.endsWith('/milestones'))return Response.json({milestones:[{type:'achievement',ref:'first_meal',title:'Unlocked “First meal”'}]});
  if(url.endsWith('/posts')&&o?.method==='POST')return Response.json({post:post('new','asha',{body:'Small win!',milestone:{type:'achievement',title:'Unlocked “First meal”'},mine:true})},{status:201});});
 const user=userEvent.setup();render(<Feed/>);await screen.findByLabelText('Add a milestone');
 await user.type(screen.getByLabelText('Share something'),'Small win!');await user.selectOptions(screen.getByLabelText('Add a milestone'),'achievement:first_meal');await user.click(screen.getByRole('button',{name:'Post'}));
 await screen.findByText('Small win!');expect(screen.getByText(/Unlocked “First meal”/,{selector:'.social-milestone'})).toBeTruthy();
 expect(calls(fetcher,'/social/posts')[0]).toEqual({body:'Small win!',visibility:'public',milestone:{type:'achievement',ref:'first_meal'}});
});
it('reporting asks for a reason; blocking removes everything from that person',async()=>{
 const fetcher=api(url=>{if(url.endsWith('/me'))return Response.json({profile:me,requests:0});if(url.includes('/feed'))return Response.json({posts:[post('a'),post('b'),post('c','meena')],next:null});if(url.endsWith('/milestones'))return Response.json({milestones:[]});if(url.endsWith('/reports'))return Response.json({status:'Thanks. Our team will review this.'},{status:201});});
 const user=userEvent.setup();render(<Feed/>);await screen.findByText('Post a');
 await user.click(screen.getAllByRole('button',{name:/More options for Ravi/})[0]);await user.click(screen.getByRole('button',{name:'Report post'}));
 await user.selectOptions(screen.getByLabelText(/Why are you reporting/),'self_harm');await user.click(screen.getByRole('button',{name:'Send report'}));await screen.findByText('Thanks. Our team will review this.');
 expect(calls(fetcher,'/reports')[0]).toEqual({target_type:'post',target_id:'a',reason:'self_harm'});
 await user.click(screen.getAllByRole('button',{name:/More options for Ravi/})[0]);await user.click(screen.getByRole('button',{name:'Block @ravi'}));
 await waitFor(()=>expect(screen.queryByText('Post b')).toBeNull());expect(screen.queryByText('Post a')).toBeNull();expect(screen.getByText('Post c')).toBeTruthy();
});
it('a private profile asks you to follow first, and following sends a request',async()=>{
 let following:null|string=null;const fetcher=api((url,o)=>{if(url.includes('/profiles/kiran'))return Response.json({profile:{...me,handle:'kiran',display_name:'Kiran',private:true,relationship:{following,follows_you:false,blocked:false}},locked:following!=='active',posts:[],next:null});
  if(url.endsWith('/follow/kiran')&&o?.method==='POST'){following='pending';return Response.json({status:'pending'});}});
 const user=userEvent.setup();render(<MemoryRouter initialEntries={['/u/kiran']}><Routes><Route path="/u/:handle" element={<ProfilePage/>}/></Routes></MemoryRouter>);
 await screen.findByText(/This account is private/);await user.click(screen.getByRole('button',{name:'Follow'}));await screen.findByRole('button',{name:'Requested'});
 expect(calls(fetcher,'/follow/kiran')).toHaveLength(1);
});

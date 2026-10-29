import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('@/lib/navigation',async importOriginal=>({...(await importOriginal<typeof import('@/lib/navigation')>()),useRouter:()=>({push:vi.fn()}),usePathname:()=>'/scanner'}));
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'p6-member'},ready:true}),useWorkspaceScope:()=>'p6-member'}));
import {AuthForm} from '../src/components/auth-form';
import {BetaFeedback} from '../src/components/beta-feedback';
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(this:HTMLDialogElement){this.open=true;};HTMLDialogElement.prototype.close=function(this:HTMLDialogElement){this.open=false;};});
afterEach(()=>vi.unstubAllGlobals());
it('asks for an invite code only while the closed beta is on, and sends it',async()=>{
 const fetcher=vi.fn(async(url:string)=>url.endsWith('/signup-config')?Response.json({invite_required:true}):Response.json({error:'Sign-up needs a valid invite code.'},{status:403}));
 vi.stubGlobal('fetch',fetcher);const user=userEvent.setup();render(<AuthForm signup/>);
 const invite=await screen.findByLabelText(/Invite code/);
 await user.type(screen.getByLabelText('Your name'),'QA');await user.type(screen.getByLabelText('Email address'),'qa@example.com');await user.type(screen.getByLabelText(/^Password/),'Test-password-123');await user.type(invite,'TC-ABCD-EFGH');
 await user.click(screen.getByRole('button',{name:'Create free account'}));
 await waitFor(()=>expect(fetcher.mock.calls.some(([u])=>String(u).endsWith('/signup'))).toBe(true));
 const call=fetcher.mock.calls.find(([u])=>String(u).endsWith('/signup'))!;expect(JSON.parse((call as unknown as [string,RequestInit])[1].body as string).invite_code).toBe('TC-ABCD-EFGH');
});
it('shows no invite field when sign-up is open',async()=>{
 const fetcher=vi.fn(async()=>Response.json({invite_required:false}));vi.stubGlobal('fetch',fetcher);render(<AuthForm signup/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalled());expect(screen.queryByLabelText(/Invite code/)).toBeNull();
});
it('sends feedback with the page path and keeps the text if sending fails',async()=>{
 let fail=true;const fetcher=vi.fn(async()=>fail?Response.json({error:'Feedback could not be sent. Your text is still here; please retry.'},{status:503}):Response.json({id:'t1'},{status:201}));
 vi.stubGlobal('fetch',fetcher);const user=userEvent.setup();render(<BetaFeedback/>);
 await user.click(screen.getByRole('button',{name:'Send feedback'}));expect(screen.getByText(/the page you're on \(\/scanner\)/)).toBeTruthy();
 await user.type(screen.getByLabelText('Your feedback'),'Barcode button is hard to find');await user.click(screen.getByRole('button',{name:'Send'}));
 await screen.findByText(/Your text is still here/);expect((screen.getByLabelText('Your feedback') as HTMLTextAreaElement).value).toBe('Barcode button is hard to find');
 fail=false;await user.click(screen.getByRole('button',{name:'Send'}));await screen.findByText('Thanks! Your feedback was sent.');
 const body=JSON.parse((fetcher.mock.calls.at(-1) as unknown as [string,RequestInit])[1].body as string);expect(body).toEqual({message:'Barcode button is hard to find',page:'/scanner'});
});

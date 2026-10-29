import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({user:{id:'p5-member'},ready:true}),useWorkspaceScope:()=>'p5-member'}));
import Premium from '../src/app/premium/page';
import {PremiumNotice} from '../src/components/premium-notice';
const plans={billing_enabled:true,currency:'INR',trial_days:7,premium_features:['More AI estimates (100 a day instead of 15)'],always_free:['Camera rep counting'],note:'Cancel any time.',
 plans:{free:{name:'Free'},premium_monthly:{name:'Premium',label:'₹99 a month',amount_paise:9900,period:'monthly'},premium_annual:{name:'Premium',label:'₹799 a year',amount_paise:79900,period:'yearly'}}};
const free={billing_enabled:true,premium:false,plan:'free',status:'free',ai_daily_limit:15,priority_booking:false,premium_accessories:[],trial_ends_at:null,current_period_end:null,cancelled_at:null,trial_available:true,checkout_configured:true};
const trialing={...free,premium:true,plan:'premium_monthly',status:'trialing',ai_daily_limit:100,trial_ends_at:'2026-11-05T10:00:00Z',trial_available:false};
type Options={key:string;subscription_id:string;handler:(r:object)=>void;modal:{ondismiss:()=>void}};
let opened:Options|null=null;const failHandlers:((e:object)=>void)[]=[];
beforeEach(()=>{opened=null;failHandlers.length=0;window.Razorpay=class{constructor(public options:Options){}open(){opened=this.options;}on(_e:string,h:(e:object)=>void){failHandlers.push(h);}} as unknown as typeof window.Razorpay;});
afterEach(()=>{vi.unstubAllGlobals();delete window.Razorpay;});
function api(status:object,extra:(url:string,o?:RequestInit)=>Response|null=()=>null){
 const fetcher=vi.fn(async(url:string,o?:RequestInit)=>extra(url,o)??(url.endsWith('/plans')?Response.json(plans):url.endsWith('/status')?Response.json(status):url.endsWith('/history')?Response.json({payments:[]}):
  url.endsWith('/checkout')?Response.json({subscription_id:'sub_test123',key_id:'rzp_test_fake',trial_days:7,name:'TrackCal Premium',description:'₹99 a month after a 7-day free trial',prefill:{email:'qa@example.com'}}):
  url.endsWith('/verify')?Response.json(trialing):url.endsWith('/cancel')?Response.json({...trialing,status:'cancelled',cancelled_at:'2026-10-30T00:00:00Z'}):Response.json({})));
 vi.stubGlobal('fetch',fetcher);return fetcher;
}
it('says so plainly when Premium is switched off',async()=>{
 api(free,url=>url.endsWith('/plans')?Response.json({billing_enabled:false,currency:'USD',plans:{free:{name:'Free'}}}):null);render(<Premium/>);
 await screen.findByRole('heading',{name:"Premium isn't available yet"});
});
it('shows prices, the saving, the trial terms and what stays free, before anything opens',async()=>{
 api(free);render(<Premium/>);await screen.findByRole('heading',{name:/₹99/});
 expect(screen.getByText('Save 33%')).toBeTruthy();expect(screen.getAllByText(/7 days free, then ₹99 a month\. Cancel any time before the trial ends and you won't be charged\./)).toHaveLength(1);
 expect(screen.getByText('Camera rep counting')).toBeTruthy();expect(opened).toBeNull();
});
it('opens Razorpay on a tap and has the server verify the payment before showing Premium',async()=>{
 const fetcher=api(free);render(<Premium/>);fireEvent.click((await screen.findAllByRole('button',{name:'Start free trial'}))[0]);
 await waitFor(()=>expect(opened).not.toBeNull());expect(opened).toMatchObject({key:'rzp_test_fake',subscription_id:'sub_test123'});
 opened!.handler({razorpay_payment_id:'pay_1',razorpay_subscription_id:'sub_test123',razorpay_signature:'sig'});
 await screen.findByText(/Your free trial runs until/);
 const verify=fetcher.mock.calls.find(([u])=>String(u).endsWith('/verify'))!;expect(JSON.parse(verify[1]!.body as string)).toEqual({razorpay_payment_id:'pay_1',razorpay_subscription_id:'sub_test123',razorpay_signature:'sig'});
 expect(screen.getByRole('heading',{name:"You're on the free trial"})).toBeTruthy();expect(screen.getByText(/unless you cancel before then/)).toBeTruthy();
});
it('closing Razorpay changes nothing; a failed payment says nothing was charged',async()=>{
 api(free);render(<Premium/>);fireEvent.click((await screen.findAllByRole('button',{name:'Start free trial'}))[0]);await waitFor(()=>expect(opened).not.toBeNull());
 opened!.modal.ondismiss();await waitFor(()=>expect(screen.getAllByRole('button',{name:'Start free trial'})[0].hasAttribute('disabled')).toBe(false));expect(screen.queryByRole('alert')).toBeNull();
 fireEvent.click(screen.getAllByRole('button',{name:'Start free trial'})[0]);await waitFor(()=>expect(failHandlers.length).toBe(2));
 failHandlers[1]({error:{description:'Card declined. You have not been charged.'}});await screen.findByText('Card declined. You have not been charged.');
});
it('cancelling asks once, then shows until when Premium stays',async()=>{
 const fetcher=api(trialing);render(<Premium/>);fireEvent.click(await screen.findByRole('button',{name:'Cancel Premium'}));
 expect(fetcher.mock.calls.some(([u])=>String(u).endsWith('/cancel'))).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Yes, cancel Premium'}));await screen.findByText(/Cancelled\. You keep Premium until/);
});
it('reminds about the first charge when the trial ends within two days',async()=>{
 api({...trialing,trial_ends_at:new Date(Date.now()+86400000).toISOString()});render(<PremiumNotice/>);
 await screen.findByText(/Your free trial ends on/);expect(screen.getByText(/charged then unless you cancel/)).toBeTruthy();
});
it('a slow page-load status never overwrites a newer checkout result',async()=>{
 let release:()=>void=()=>{};const late=new Promise<void>(r=>{release=r;});
 api(free);
 const base=globalThis.fetch as unknown as (u:string,o?:RequestInit)=>Promise<Response>;
 vi.stubGlobal('fetch',vi.fn(async(u:string,o?:RequestInit)=>{if(u.endsWith('/status')){await late;return Response.json(free);}return base(u,o);}));
 render(<Premium/>);fireEvent.click((await screen.findAllByRole('button',{name:'Start free trial'}))[0]);await waitFor(()=>expect(opened).not.toBeNull());
 opened!.handler({razorpay_payment_id:'pay_1',razorpay_subscription_id:'sub_test123',razorpay_signature:'sig'});
 await screen.findByRole('heading',{name:"You're on the free trial"});
 release();await new Promise(r=>setTimeout(r,50));
 expect(screen.getByRole('heading',{name:"You're on the free trial"})).toBeTruthy();
});

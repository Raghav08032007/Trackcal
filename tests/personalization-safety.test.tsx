// Original tool/safety assertions now mount the shared component used by the dedicated food routes.
import {render,screen,fireEvent,within} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({ready:true,user:{id:'minor-member'}}),useWorkspaceScope:()=> 'minor-member',AccountLink:()=> <a href="/account">Account</a>}));
vi.mock('../src/components/personal-dashboard',()=>({PersonalPlanPreview:()=>null}));
import {FoodWorkspace as Home} from '../src/components/food-workspace';
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()),useRouter:()=>({push:vi.fn()})}));
import {assertAdultCalculatorAllowed,confirmAdultForCalculator,defaultPreferences} from '../src/lib/personalization';
import {calculatePlan} from '../src/lib/nutrition';
it('blocks signed-in youth from the legacy local calculator even when its age field says adult',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>Response.json(String(url).includes('/personalization/')?{minor_account:true,preferences:{...defaultPreferences,age_group:'under18'}}:{initialized:false})));
 render(<Home/>);fireEvent.click(screen.getAllByRole('button',{name:/My goals|My nutrition goals/})[0]);
 const dialog=screen.getByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Calculate & Apply Targets'}));
 expect((await screen.findByRole('alert')).textContent).toContain('confirmed adult age group');
 expect(localStorage.getItem('trackcal:account:minor-member:trackcal:target:calories')).toBeNull();
});
it('requires an adult profile and rejects young or non-integral ages in the standalone calculator',()=>{
 for(const age_group of ['under18','18_19','unspecified'])expect(()=>assertAdultCalculatorAllowed({preferences:{...defaultPreferences,age_group}})).toThrow();
 expect(()=>assertAdultCalculatorAllowed({minor_account:true,preferences:{...defaultPreferences,age_group:'20_64'}})).toThrow();
 expect(()=>assertAdultCalculatorAllowed({preferences:{...defaultPreferences,age_group:'20_64'}})).not.toThrow();
 const input={age:18,gender:'male' as const,weight_kg:75,height_cm:180,activity_level:'moderately_active' as const,primary_goal:'lose_weight' as const};
 expect(()=>calculatePlan(input)).toThrow();expect(()=>calculatePlan({...input,age:20.5})).toThrow();
});

function fakeState(state:object){
 const calls:{url:string,body?:{preferences:{age_group:string}}}[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push({url,body:init?.body?JSON.parse(String(init.body)):undefined});return new Response(JSON.stringify({preferences:defaultPreferences,step:1,revision:0,...state}),{status:200})}));
 return calls;
}
it('an adult age answers an age group that was never set',async()=>{
 const calls=fakeState({});await confirmAdultForCalculator(26);
 expect(calls.at(-1)?.url).toContain('onboarding');expect(calls.at(-1)?.body?.preferences.age_group).toBe('20_64');
 const older=fakeState({});await confirmAdultForCalculator(70);expect(older.at(-1)?.body?.preferences.age_group).toBe('65plus');
 vi.unstubAllGlobals();
});
it('a typed age never overrides a saved young age group or a minor account',async()=>{
 for(const age_group of ['under18','18_19']){const calls=fakeState({preferences:{...defaultPreferences,age_group}});await expect(confirmAdultForCalculator(26)).rejects.toThrow();expect(calls).toHaveLength(1)}
 const minor=fakeState({minor_account:true});await expect(confirmAdultForCalculator(26)).rejects.toThrow();expect(minor).toHaveLength(1);
 const young=fakeState({});await expect(confirmAdultForCalculator(17)).rejects.toThrow('ages 20 and over');expect(young).toHaveLength(1);
 vi.unstubAllGlobals();
});

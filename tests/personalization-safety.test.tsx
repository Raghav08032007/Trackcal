// Original tool/safety assertions now mount the shared component used by the dedicated food routes.
import {render,screen,fireEvent,within} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
vi.mock('../src/components/account-session',()=>({useAccount:()=>({ready:true,user:{id:'minor-member'}}),useWorkspaceScope:()=> 'minor-member',AccountLink:()=> <a href="/account">Account</a>}));
vi.mock('../src/components/personal-dashboard',()=>({PersonalPlanPreview:()=>null}));
import {FoodWorkspace as Home} from '../src/components/food-workspace';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
import {assertAdultCalculatorAllowed,defaultPreferences} from '../src/lib/personalization';
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

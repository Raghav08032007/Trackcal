import {useEffect,useState} from 'react';
import {useAccount} from './account-session';
import {ALLERGEN_WORDS,checkAllergens,type AllergenSource} from '@/lib/allergens';
import {personalRequest,type PersonalState} from '@/lib/personalization';

let cached:string[]|null=null;
/** Warns when food matches an allergy you listed in Setup. It can miss things, so it never says food is safe. */
export function AllergenAlert({sources}:{sources:AllergenSource[]}){
 const {user}=useAccount(),[allergies,setAllergies]=useState<string[]>(cached??[]);
 useEffect(()=>{if(!user||cached)return;let live=true;personalRequest<PersonalState>('state').then(state=>{cached=state.preferences?.allergies??[];if(live)setAllergies(cached);}).catch(()=>{});return()=>{live=false;};},[user]);
 const result=checkAllergens(sources,allergies);
 if(!result||result.level==='none')return null;
 return <p className="allergen-alert" role="alert"><strong>{ALLERGEN_WORDS[result.level]} {result.matched.join(', ')}</strong> — you listed {result.matched.length>1?'these':'this'} as an allergy. {result.level==='declared'?'The label says so.':'Check the ingredients before eating.'}</p>;
}

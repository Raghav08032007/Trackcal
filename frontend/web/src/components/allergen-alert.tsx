import { t } from "@/lib/i18n";
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
 return <p className="allergen-alert" role="alert"><strong>{ALLERGEN_WORDS[result.level]} {result.matched.join(', ')}</strong> {result.matched.length>1?t("— you listed these as an allergy."):t("— you listed this as an allergy.")}{" "}{result.level==='declared'?t("The label says so."):t("Check the ingredients before eating.")}</p>;
}

import {useEffect,useState} from 'react';
import {personalRequest,type PersonalState} from '@/lib/personalization';
export function usePersonalState(){
 const [data,setData]=useState<PersonalState|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const load=()=>{personalRequest<PersonalState>('state').then(v=>{if(alive){setData(v);setError('');}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Could not load personalization.');});};load();window.addEventListener('trackcal-personalization',load);window.addEventListener('focus',load);return()=>{alive=false;window.removeEventListener('trackcal-personalization',load);window.removeEventListener('focus',load);};},[]);
 return {data,error};
}

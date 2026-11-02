import {useEffect,useState} from 'react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {FastingTimer} from './gym-tools';
import {personalRequest,type PersonalState} from '@/lib/personalization';

export function FastingPage(){
 const {ready,user}=useAccount(),[minor,setMinor]=useState(true);
 useEffect(()=>{if(!user)return;let live=true;personalRequest<PersonalState>('state').then(state=>{if(live)setMinor(!!state.minor_account);}).catch(()=>{});return()=>{live=false;};},[user]);
 if(!ready)return <main className="account-loading">Opening fasting…</main>;
 if(!user)return <main className="account-page"><section className="account-card"><h1>Fasting</h1><p>Sign in to use the fasting timer.</p><div className="gate-actions"><Link className="gate-primary" href="/login">Sign in</Link></div></section></main>;
 return <main className="wellness-page fasting-page"><section className="camera-intro"><span className="eyebrow">YOUR CUSTOMS, YOUR PACE</span><h1>Fasting</h1><p>A timer and food guide for time-based and religious fasts.</p></section>
  {minor?<section className="account-card"><p>The fasting timer is for adults only.</p></section>:<FastingTimer/>}
 </main>;
}

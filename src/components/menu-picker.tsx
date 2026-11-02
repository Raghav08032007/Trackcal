import {useEffect,useState} from 'react';
import Link from '@/lib/navigation';
import {useAccount} from './account-session';
import {CoachLine} from './coach-card';
import type {MealLog} from './journal-tools';
import {pickDishes,type MenuDish} from '@/lib/fitness-plans';
import {personalRequest,type PersonalState} from '@/lib/personalization';
import {useLocalDate,useLocalState} from '@/lib/use-local-state';
import {earnedBack} from '@/lib/workout-coach';

/** Photograph a menu or screenshot a delivery app, and see which dishes suit the rest of your day. */
export function MenuPicker(){
 const {ready}=useAccount(),date=useLocalDate(),[target]=useLocalState('trackcal:target:calories',2100),[burned]=useLocalState(`trackcal:burn:${date}`,0),[meals,setMeals]=useLocalState<MealLog[]>(`trackcal:journal:${date}`,[]);
 const [consent,setConsent]=useState(false),[dishes,setDishes]=useState<MenuDish[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[vegetarian,setVegetarian]=useState(false),[minor,setMinor]=useState(false);
 useEffect(()=>{let live=true;personalRequest<PersonalState>('state').then(state=>{if(live){setMinor(!!state.minor_account);if(['vegetarian','vegan'].includes(state.preferences?.diet))setVegetarian(true);}}).catch(()=>{});return()=>{live=false;};},[]);
 const left=Math.max(0,target+earnedBack(burned)-meals.reduce((total,meal)=>total+meal.calories,0));
 async function read(file:File){
  if(!consent){setError('Tick the box above to send this photo first.');return;}
  setBusy(true);setError('');setNotice('');setDishes(null);
  try{
   const {preparePhoto}=await import('@/lib/photo-prep');
   const response=await fetch('/api/menu/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:await preparePhoto(file)}),signal:AbortSignal.timeout(70000)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Could not read that menu.');
   setDishes(data.dishes);
  }catch(failure){setError(failure instanceof Error?failure.message:'Could not read that menu.');}
  finally{setBusy(false);}
 }
 function log(dish:MenuDish){
  setMeals([...meals,{time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),name:dish.name,calories:Math.round(dish.calories),protein:Math.round(dish.protein_g),carbs:Math.round(dish.carbs_g),fat:Math.round(dish.fat_g),method:'AI estimate from a menu (user reviewed)'}]);
  setNotice(`${dish.name} added to today's journal.`);
 }
 if(!ready)return <main className="account-loading">Opening the menu picker…</main>;
 if(minor)return <main className="account-page"><section className="account-card"><h1>Menu picker</h1><p>This tool works with calorie targets, so it is for adults only.</p><Link className="destination-button" href="/nutrition">Back to food</Link></section></main>;
 const picked=dishes&&pickDishes(dishes,left,vegetarian);
 return <main className="wellness-page menu-page"><section className="camera-intro"><span className="eyebrow">BEFORE YOU ORDER</span><h1>Menu picker</h1><p>Photograph a menu or screenshot Swiggy or Zomato. You have about <strong>{Math.round(left)} kcal</strong> left today.</p></section>
  <section className="account-card">
   <label className="scanner-consent"><input type="checkbox" aria-label="Allow this menu photo to be sent to the configured AI provider" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Send this photo for AI analysis</label>
   <label className="destination-button menu-upload">{busy?'Reading the menu…':'Choose a menu photo'}<input type="file" aria-label="Menu photo" accept="image/jpeg,image/png,image/webp" disabled={busy} hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void read(file);}}/></label>
   <label><input type="checkbox" checked={vegetarian} onChange={e=>setVegetarian(e.target.checked)}/> Vegetarian only</label>
   {error&&<p role="alert" className="camera-alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
  </section>
  {picked&&<section className="account-card"><h2>Best fits for today</h2>
   {picked.best[0]&&<CoachLine text={`I would go for ${picked.best[0].name}. It has the most protein for what you have left.`}/>}
   {picked.best.length?picked.best.map(dish=><div className="library-row" key={dish.name}><div><strong>{dish.name}</strong><small>About {Math.round(dish.calories)} kcal · {Math.round(dish.protein_g)} g protein</small></div><button type="button" className="account-secondary" aria-label={`Log ${dish.name}`} onClick={()=>log(dish)}>Log</button></div>):<p>{picked.checked?'Nothing here fits what is left today. A smaller portion or a shared dish could work.':'No vegetarian dishes were clearly marked on this menu.'}</p>}
   <p className="rep-replay-note">{picked.checked} dishes checked, {picked.tooBig} above what is left today. Calories are AI estimates of a normal serving, and restaurant portions vary. Check allergens with the restaurant.</p>
  </section>}
 </main>;
}

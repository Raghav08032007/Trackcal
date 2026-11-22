import {t} from "@/lib/i18n";
import {useEffect,useState} from 'react';
import {VOICE_KEY,coachVoices,say} from '@/lib/workout-coach';

/** Choose which installed voice the coach speaks with, and hear it. "Automatic" picks the most natural voice for the
 *  app's language; the list only shows voices for that language, most natural first. The choice stays on this device. */
export function VoicePicker(){
 const [voices,setVoices]=useState(()=>coachVoices());
 const [picked,setPicked]=useState(()=>{try{return localStorage.getItem(VOICE_KEY)??'';}catch{return '';}});
 useEffect(()=>{
  const synth=typeof window!=='undefined'?window.speechSynthesis:undefined;if(!synth)return;
  const refresh=()=>setVoices(coachVoices());refresh();
  try{synth.addEventListener?.('voiceschanged',refresh);}catch{/* older browsers */}
  return ()=>{try{synth.removeEventListener?.('voiceschanged',refresh);}catch{/* older browsers */}};
 },[]);
 const choose=(id:string)=>{setPicked(id);try{if(id)localStorage.setItem(VOICE_KEY,id);else localStorage.removeItem(VOICE_KEY);}catch{/* this visit only */}say(t("Let's go. Ready when you are."));};
 if(!voices.length)return null;
 return <div className="voice-picker">
  <label>{t("Coach voice")}<select value={picked} onChange={e=>choose(e.target.value)}>
   <option value="">{t("Automatic (most natural)")}</option>
   {voices.slice(0,12).map(v=><option key={v.voiceURI||v.name} value={v.voiceURI||v.name}>{v.name.replace(/^(Microsoft|Google)\s+/,'')}</option>)}
  </select></label>
  <button type="button" onClick={()=>say(t("Let's go. Ready when you are."))}>{t("Test voice")}</button>
 </div>;
}

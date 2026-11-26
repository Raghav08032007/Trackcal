'use client';
/* Your character on Today and Progress: its picture, your level, how close the next one is and what it unlocks.
 * A level-up is celebrated once. No 3D is loaded here: the picture is the still taken in the studio. */
import { t } from "@/lib/i18n";
import {useEffect,useState} from 'react';
import {Sparkles,UserRound} from 'lucide-react';
import Link from '@/lib/navigation';
import {Celebration} from './celebration';
import {avatarLevel,markLevelSeen,seenLevel,unlocksAt,useAvatarLook,useSnapshot} from '@/lib/avatar-look';
import {useActiveDays} from '@/lib/workouts';

export function CharacterCard({compact=false}:{compact?:boolean}){
 const look=useAvatarLook(),picture=useSnapshot(),days=useActiveDays(),{level,next}=avatarLevel(days.length);
 const [cheer,setCheer]=useState<number|null>(null);
 // Cheer a new level once. The first time the card is seen, the current level is taken as already known.
 useEffect(()=>{if(!days.length)return;const seen=seenLevel();if(seen===0){markLevelSeen(level);return;}if(level>seen){setCheer(level);markLevelSeen(level);}},[level,days.length]);
 const coming=next===null?[]:unlocksAt(level+1),done=next===null?4:days.length%4;
 return <section className={`account-card character-card${compact?' character-card-compact':''}`} aria-labelledby="character-card-title">
  {cheer!==null&&<div className="celebration-host" aria-live="polite"><Celebration/></div>}
  <div className="character-card-picture">{look&&picture?<img src={picture} alt={t("Your character")} width={120} height={150}/>:<span className="character-card-placeholder" aria-hidden="true"><UserRound size={40}/></span>}</div>
  <div className="character-card-body">
   <p className="eyebrow"><Sparkles size={14} aria-hidden="true"/> {t("YOUR CHARACTER")}</p>
   <h2 id="character-card-title">{cheer!==null?t("Level up! You reached level {n}.",{n:cheer}):t("Level {n}",{n:level})}</h2>
   {cheer!==null&&unlocksAt(cheer).length>0&&<p className="character-card-new">{t("New: {list}.",{list:unlocksAt(cheer).map(name=>t(name)).join(', ')})}</p>}
   <div className="character-card-meter"><progress max={4} value={done} aria-label={t("Progress to the next level")}/><span>{next===null?t("Top level: everything is unlocked."):t("{n} more active days to level {level}.",{n:next-days.length,level:level+1})}</span></div>
   {coming.length>0&&<p className="character-card-next">{t("Next: {list}.",{list:coming.map(name=>t(name)).join(', ')})}</p>}
   <Link className="destination-button character-card-link" href="/me/character">{look?t("Change your look"):t("Make your character")}</Link>
  </div>
 </section>;
}

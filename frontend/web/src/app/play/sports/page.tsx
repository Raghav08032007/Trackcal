import { msg, t } from "@/lib/i18n";
import Link from "@/lib/navigation";
import { SportGames } from "@/components/sport-games";
import { useLocalState } from "@/lib/use-local-state";
import "../play.css";
export const metadata={title:msg("TrackCal — Sports"),description:"Camera sports: skip rope, shadow boxing, cricket drive and badminton smash, with a 3D coach for each."};
/** The camera sports on a page of their own, so "Play a sport" opens them instead of scrolling the Play page. Calm mode
 *  is shared with the Play page. */
export default function SportsPage(){
 const [calm]=useLocalState('trackcal:play:calm',false);
 return <main className="account-page play-page sports-page">
  <p className="sports-back"><Link href="/play">{t("← Play")}</Link></p>
  <SportGames calm={calm}/>
 </main>;
}

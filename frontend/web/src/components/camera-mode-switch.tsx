import { t } from "@/lib/i18n";
import Link from '@/lib/navigation';

/** The camera does two things: counts reps, or times a hold. One switch, one page. */
export function CameraModeSwitch({mode}:{mode:'reps'|'hold'}){
 return <nav className="camera-mode-switch" aria-label={t("Camera mode")}>
  <Link href="/workouts/camera" aria-current={mode==='reps'?'page':undefined}><strong>{t("Count reps")}</strong><small>{t("Squats, push-ups, curls…")}</small></Link>
  <Link href="/workouts/camera?mode=hold" aria-current={mode==='hold'?'page':undefined}><strong>{t("Time a hold")}</strong><small>{t("Plank, balance, stretches")}</small></Link>
 </nav>;
}

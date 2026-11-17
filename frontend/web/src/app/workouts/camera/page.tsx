import { msg } from "@/lib/i18n";
import {CameraWorkout} from '@/components/camera-workout';
import {HoldStudio} from '@/components/hold-studio';
import {useSearch} from '@/lib/navigation';
export const metadata={title:msg("TrackCal — Private camera workouts")};
/** Reps and holds share one camera page; ?mode=hold (or ?hold=…) opens the hold timer. */
export default function Page(){const query=new URLSearchParams(useSearch());return query.get('mode')==='hold'||query.has('hold')?<HoldStudio key="hold"/>:<CameraWorkout key="reps"/>;}

import { t, msg } from "@/lib/i18n";
import {useEffect} from 'react';
import {useRouter} from '@/lib/navigation';
export const metadata={title:msg("TrackCal — Holds")};
/** Holds now live on the camera page. Old links keep working. */
export default function Page(){const router=useRouter();useEffect(()=>{const hold=new URLSearchParams(window.location.search).get('hold');router.replace(`/workouts/camera?mode=hold${hold?`&hold=${encodeURIComponent(hold)}`:''}`);},[router]);return <main className="account-loading">{t("Opening holds…")}</main>;}

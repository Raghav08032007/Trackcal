import { msg } from "@/lib/i18n";
import {GpsTracker} from '@/components/gps-tracker';
export const metadata={title:msg("TrackCal — Walk or run")};
export default function Page(){return <GpsTracker/>;}

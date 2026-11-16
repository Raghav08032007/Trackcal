import { msg } from "@/lib/i18n";
import {PersonalDashboard} from '@/components/personal-dashboard';
export const metadata={title:msg("TrackCal — Your personal plan")};
export default function Page(){return <PersonalDashboard/>;}

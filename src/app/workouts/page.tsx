import { msg } from "@/lib/i18n";
import {WorkoutDashboard} from '@/components/workout-dashboard';
export const metadata={title:msg("TrackCal — Your workouts")};
export default function Page(){return <WorkoutDashboard/>;}

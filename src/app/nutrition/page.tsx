import { msg } from "@/lib/i18n";
import {NutritionDashboard} from '@/components/nutrition-dashboard';
export const metadata={title:msg("TrackCal — Nutrition diary")};
export default function Page(){return <NutritionDashboard/>;}

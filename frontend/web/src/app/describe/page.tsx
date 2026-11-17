import { msg } from "@/lib/i18n";
import {FoodWorkspace} from "@/components/food-workspace";
export const metadata={title:msg("TrackCal — Describe")};
export default function Page(){return <FoodWorkspace initialTab="voice_text"/>;}

import { msg } from "@/lib/i18n";
import { JournalPage } from "@/components/journal";
export const metadata={title:msg("TrackCal — Journal"),description:"Every workout and meal by day, month and year, with your best days and planned workouts."};
export default function Page(){return <JournalPage/>;}

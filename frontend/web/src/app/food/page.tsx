import { msg } from "@/lib/i18n";
import { SectionHub } from "@/components/section-hub";
export const metadata = { title:msg("TrackCal — Food") };
export default function Page() { return <SectionHub id="food" intro="Log what you eat, plan your meals and cook at home." />; }

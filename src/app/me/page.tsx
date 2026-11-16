import { msg } from "@/lib/i18n";
import { SectionHub } from "@/components/section-hub";
export const metadata = { title:msg("TrackCal — Me") };
export default function Page() { return <SectionHub id="me" intro="Your account, your report, your progress and your settings." />; }

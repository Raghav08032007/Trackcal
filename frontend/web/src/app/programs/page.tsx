import { msg } from "@/lib/i18n";
import {ProgramList} from '@/components/program-list';
export const metadata={title:msg("TrackCal — Programs")};
export default function Page(){return <ProgramList/>;}

import { t, msg } from "@/lib/i18n";
import { CommandSearch } from "@/components/command-search";
import { DayCard } from "@/components/day-card";
import { RetestReminder } from "@/components/retest-reminder";
import { RecoveryCheckin } from "@/components/recovery-checkin";
import { TodayTasks } from "@/components/today-tasks";
import { ProgressSummary } from "@/components/progress-areas";
import { CommunityCard } from "@/components/community-strip";
import { useBurn } from "@/lib/days";
import {CoachCard} from "@/components/coach-card";
import { useTarget } from "@/lib/targets";
import { useDiaryMeals } from "@/lib/diary";
import {FirstSteps} from "@/components/first-steps";
import {PhotoCarousel} from './photos';
import {useEffect} from 'react';import Link from "@/lib/navigation";import {useRouter} from "@/lib/navigation";import {Camera,Utensils,Activity,Sparkles,CalendarDays,ScanLine,ArrowUpRight,Leaf} from 'lucide-react';
import {useAccount} from './account-session';import {DailyProgressHub} from './daily-progress-hub';import {earnedBack} from '@/lib/workout-coach';import {QuickLog} from './quick-log';import {useLocalDate} from '@/lib/use-local-state';import type {} from './journal-tools';import {PageCompanion} from './feature-companion';
const destinations=[
 ['/nutrition',msg("Nutrition diary"),msg("Review a meal, save a favorite, or correct an entry."),Utensils],['/workouts',msg("Workout sessions"),msg("Record familiar movement and revisit your sets."),Activity],['/workouts/camera',msg("Camera studio"),msg("Try optional private rep estimates and review your results."),ScanLine],['/plan',msg("My personal plan"),msg("Make your week fit your needs, with room for rest."),CalendarDays],['/play',msg("Quests & companions"),msg("Learn, earn participation XP, and meet your unlocked crew."),Sparkles],['/scanner',msg("Food photo scanner"),msg("Choose a photo and review the estimate before logging."),Camera]
] as const;
const more=[['/barcode',msg("Barcode lookup")],['/describe',msg("Describe a meal")],['/food-library',msg("Search foods")],['/journal',msg("Device journal")],['/recipes',msg("Recipes")],['/tools',msg("Smart planning tools")],['/routine',msg("Reminders & coaching")],['/progress',msg("Progress & reports")],['/account',msg("Account & data")],['/guide',msg("Guided test drive")]] as const;
export function HomeDashboard(){const {ready,user}=useAccount();return !ready?<main className="account-loading">{t("Opening your workspace…")}</main>:<MemberHome key={user?.id||'guest'}/>;}
function MemberHome(){const router=useRouter(),date=useLocalDate();const [meals]=useDiaryMeals(date),[baseCalories]=useTarget("calories"),[workoutBurn]=useBurn(date),[protein]=useTarget("protein"),[carbs]=useTarget("carbs"),[fat]=useTarget("fat");
 useEffect(()=>{const query=new URLSearchParams(window.location.search);if(query.has('mealIdea'))router.replace('/describe'+window.location.search);},[router]);
 return <main className="home-page"><header className="home-page-header"><Link href="/" className="brand"><span className="brand-mark"><Leaf size={23}/></span>trackcal.</Link><div className="home-header-actions"><CommandSearch compact/><button className="destination-button" onClick={()=>router.push('/scanner?goals=1')}>{t("My goals")}</button></div></header><QuickLog date={date}/><CoachCard compact/><TodayTasks/><ProgressSummary/><CommunityCard/><RecoveryCheckin/><RetestReminder/><DayCard date={date}/><FirstSteps/><DailyProgressHub compact date={date} meals={meals} targets={{calories:baseCalories+earnedBack(workoutBurn),protein,carbs,fat}} onJournal={()=>router.push('/journal')} onGoals={()=>router.push('/scanner?goals=1')}/><PhotoCarousel/><section className="home-destinations" aria-labelledby="destination-title"><div className="destination-heading"><div><p className="eyebrow">{t("ONE PAGE. ONE PURPOSE.")}</p><h2 id="destination-title">{t("What would help you today?")}</h2><p>{t("Choose a destination. Your companion can show you how it works.")}</p></div><PageCompanion/></div><div className="destination-grid">{destinations.map(([href,title,description,Icon])=><Link key={href} href={href} className="destination-card"><span className="destination-icon"><Icon size={23}/></span><span className="destination-card-copy"><strong>{t(title)}</strong><span>{t(description)}</span></span><ArrowUpRight size={20} aria-hidden="true"/></Link>)}</div></section><details className="more-destinations"><summary>{t("More food tools, reminders & your data")}</summary><div className="destination-mini-grid">{more.map(([href,label])=><Link key={href} href={href} className="destination-button">{t(label)}<ArrowUpRight size={16}/></Link>)}</div></details><p className="home-data-note">{t("Cloud nutrition and your device journal stay separate. Nothing is silently merged, and reviewing a page never awards XP.")}</p></main>;
}

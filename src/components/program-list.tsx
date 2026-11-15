import { t } from "@/lib/i18n";
import { useProgramDays } from "@/lib/workouts";
import Link from '@/lib/navigation';
import {nextProgramDay,PROGRAMS,programDay,programDays,stepsLabel} from '@/lib/fitness-plans';
import {CoachLine} from './coach-card';
import {Celebration} from './celebration';

/** Multi-week plans. Each day opens in the camera, and finishing it moves the program on. */
export function ProgramList(){
 const [done,setDone]=useProgramDays();
 return <main className="wellness-page programs-page"><section className="camera-intro"><span className="eyebrow">{t("A PLAN FOR THE MONTH")}</span><h1>{t("Programs")}</h1><p>{t("Pick one and follow the next day. Targets rise a little each week, and every rep is counted by your camera.")}</p></section>
  <CoachLine text={done.length?t("Nice work so far. The next day is ready when you are."):t("Pick one that fits your week. I will keep track of where you are.")}/>
  {PROGRAMS.map(program=>{
   const total=programDays(program),next=nextProgramDay(program,done),finished=done.filter(id=>id.startsWith(program.id+':')).length,day=next===null?null:programDay(program,next);
   return <section className="account-card" key={program.id}><h2>{program.name}</h2><p>{t("{summary} {weeks} weeks, {total} workouts.", { summary: program.summary, weeks: program.weeks, total })}</p>
    <progress max={total} value={finished} aria-label={t("{name}: {finished} of {total} done", { name: program.name, finished, total })}/>
    {day?<><p><strong>{t("Next: week {n}, day {n2}", { n: Math.floor(next!/program.days.length)+1, n2: next!%program.days.length+1 })}</strong><br/>{stepsLabel(day)}</p><div className="account-actions"><Link className="destination-button" href={`/workouts/camera?program=${program.id}&day=${next}`}>{t("Start {name}", { name: program.name })}</Link></div></>:<><div className="celebration-host"><Celebration/><p>{t("Finished. Well done.")}</p></div><button type="button" className="account-secondary" onClick={()=>setDone(all=>all.filter(id=>!id.startsWith(program.id+':')))}>{t("Start {name} again", { name: program.name })}</button></>}
   </section>;
  })}
 </main>;
}

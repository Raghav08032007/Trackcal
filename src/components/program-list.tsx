import { useProgramDays } from "@/lib/workouts";
import Link from '@/lib/navigation';
import {nextProgramDay,PROGRAMS,programDay,programDays,stepsLabel} from '@/lib/fitness-plans';
import {CoachLine} from './coach-card';
import {Celebration} from './celebration';

/** Multi-week plans. Each day opens in the camera, and finishing it moves the program on. */
export function ProgramList(){
 const [done,setDone]=useProgramDays();
 return <main className="wellness-page programs-page"><section className="camera-intro"><span className="eyebrow">A PLAN FOR THE MONTH</span><h1>Programs</h1><p>Pick one and follow the next day. Targets rise a little each week, and every rep is counted by your camera.</p></section>
  <CoachLine text={done.length?'Nice work so far. The next day is ready when you are.':'Pick one that fits your week. I will keep track of where you are.'}/>
  {PROGRAMS.map(program=>{
   const total=programDays(program),next=nextProgramDay(program,done),finished=done.filter(id=>id.startsWith(program.id+':')).length,day=next===null?null:programDay(program,next);
   return <section className="account-card" key={program.id}><h2>{program.name}</h2><p>{program.summary} {program.weeks} weeks, {total} workouts.</p>
    <progress max={total} value={finished} aria-label={`${program.name}: ${finished} of ${total} done`}/>
    {day?<><p><strong>Next: week {Math.floor(next!/program.days.length)+1}, day {next!%program.days.length+1}</strong><br/>{stepsLabel(day)}</p><div className="account-actions"><Link className="destination-button" href={`/workouts/camera?program=${program.id}&day=${next}`}>Start {program.name}</Link></div></>:<><div className="celebration-host"><Celebration/><p>Finished. Well done.</p></div><button type="button" className="account-secondary" onClick={()=>setDone(all=>all.filter(id=>!id.startsWith(program.id+':')))}>Start {program.name} again</button></>}
   </section>;
  })}
 </main>;
}

import {useEffect,useState} from 'react';
import Link from '@/lib/navigation';
import {nextProgramDay,PROGRAMS} from '@/lib/fitness-plans';
import {EXERCISES,type ExerciseKind} from '@/lib/pose/types';
import {movesFrom,muscleStates,restedChoice} from '@/lib/training-insights';
import {useLocalState} from '@/lib/use-local-state';
import {wellnessRequest,type TrainingData} from '@/lib/wellness';

/** One clear next step on Home: carry on a started program, or something that suits rested muscles. */
export function TodayMove(){
 const [done]=useLocalState<string[]>('trackcal:studio:program-days',[]),[choice,setChoice]=useState<ExerciseKind|null>(null);
 useEffect(()=>{let live=true;wellnessRequest<TrainingData>('training').then(data=>{if(live)setChoice(restedChoice(muscleStates(movesFrom(data.sessions??[]),Date.now())));}).catch(()=>{});return()=>{live=false;};},[]);
 const started=PROGRAMS.find(program=>done.some(id=>id.startsWith(program.id+':'))&&nextProgramDay(program,done)!==null);
 if(started)return <section className="today-move"><div><span className="eyebrow">TODAY&apos;S MOVE</span><strong>Carry on with {started.name}</strong></div><Link className="destination-button" href="/programs">Open program</Link></section>;
 if(!choice)return null;
 return <section className="today-move"><div><span className="eyebrow">TODAY&apos;S MOVE</span><strong>{EXERCISES[choice].title}</strong></div><Link className="destination-button" href={`/workouts/camera?exercise=${choice}`}>Start</Link></section>;
}

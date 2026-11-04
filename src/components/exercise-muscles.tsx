import Model,{type IExerciseData,type Muscle} from 'react-body-highlighter';
import {musclesFromText} from '@/lib/training-insights';

/** The muscles an exercise works, front and back, using react-body-highlighter (MIT). */
export function ExerciseMuscles({muscles,title}:{muscles:string;title:string}){
 const worked=musclesFromText(muscles);
 if(!worked.length)return null;
 const data:IExerciseData[]=[{name:title,muscles:worked as unknown as Muscle[]}];
 return <div className="exercise-muscles" role="img" aria-label={`${title} works: ${muscles}`}><Model data={data} type="anterior" highlightedColors={['#6d4ae8']} bodyColor="#d9d5e8"/><Model data={data} type="posterior" highlightedColors={['#6d4ae8']} bodyColor="#d9d5e8"/></div>;
}

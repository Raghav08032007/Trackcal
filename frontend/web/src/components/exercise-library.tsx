import { t } from "@/lib/i18n";
import {useEffect,useMemo,useState} from "react";
import Link from "@/lib/navigation";
import {EXERCISES,EXERCISE_DIFFICULTY,type ExerciseDifficulty,type ExerciseKind} from "@/lib/pose/types";
import {WatchHow} from "./exercise-demo";

type Entry={n:string;m:string[];e:string;l:ExerciseDifficulty;c:string;k?:ExerciseKind};
const LIMIT=30;
/** 876 exercises kept on this site, so search is instant and works offline. Facts only, from free-exercise-db. */
export function ExerciseLibrary({active,onUse}:{active:boolean;onUse:(name:string)=>void}){
 const [rows,setRows]=useState<Entry[]|null>(null),[failed,setFailed]=useState(false),[query,setQuery]=useState(""),[muscle,setMuscle]=useState(""),[equipment,setEquipment]=useState(""),[level,setLevel]=useState(""),[camera,setCamera]=useState(false);
 useEffect(()=>{if(!active||rows)return;let live=true;fetch("/exercise-library.json").then(r=>{if(!r.ok)throw new Error("failed");return r.json();}).then(d=>{if(live)setRows(d.exercises);}).catch(()=>{if(live)setFailed(true);});return ()=>{live=false;};},[active,rows]);
 const muscles=useMemo(()=>[...new Set((rows??[]).flatMap(r=>r.m))].sort(),[rows]),kit=useMemo(()=>[...new Set((rows??[]).map(r=>r.e))].sort(),[rows]);
 const words=query.toLowerCase().split(/\s+/).filter(Boolean);
 const found=useMemo(()=>(rows??[]).filter(r=>words.every(w=>r.n.toLowerCase().includes(w))&&(!muscle||r.m.includes(muscle))&&(!equipment||r.e===equipment)&&(!level||r.l===level)&&(!camera||r.k)),[rows,query,muscle,equipment,level,camera]);// eslint-disable-line react-hooks/exhaustive-deps -- words comes from query
 return <section className="account-card"><h2>{t("Exercise library")}</h2><p>{rows?t("{length} exercises. {length2} can be counted by your camera.", { length: rows.length, length2: rows.filter(r=>r.k).length }):failed?t("The library could not load. You can still log a workout below."):t("Loading exercises…")}</p>
  <div className="library-filters"><label>{t("Search")}<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="squat"/></label><label>{t("Muscle")}<select value={muscle} onChange={e=>setMuscle(e.target.value)}><option value="">{t("Any muscle")}</option>{muscles.map(m=><option key={m}>{m}</option>)}</select></label><label>{t("Equipment")}<select value={equipment} onChange={e=>setEquipment(e.target.value)}><option value="">{t("Any equipment")}</option>{kit.map(m=><option key={m}>{m}</option>)}</select></label><label>{t("Difficulty")}<select value={level} onChange={e=>setLevel(e.target.value)}><option value="">{t("Any")}</option>{Object.entries(EXERCISE_DIFFICULTY).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
  <label><input type="checkbox" checked={camera} onChange={e=>setCamera(e.target.checked)}/> {t("Only exercises the camera can count")}</label>
  {rows&&<p role="status">{found.length>LIMIT?t("{n} found, showing the first {LIMIT}", { n: found.length, LIMIT }):t("{n} found", { n: found.length })}</p>}
  {found.slice(0,LIMIT).map(r=><div className="library-row" key={r.n}><div><strong>{r.n}</strong><small>{r.m.join(", ")||t("Full body")} · {r.e} · {EXERCISE_DIFFICULTY[r.l]}</small></div><button className="account-secondary" onClick={()=>onUse(r.n)}>{t("Log this")}</button>{r.k&&<Link href={`/workouts/camera?exercise=${r.k}`}>{t("Count with camera: {title}", { title: EXERCISES[r.k].title })}</Link>}{r.k&&<WatchHow kind={r.k}/>}</div>)}
 </section>;
}

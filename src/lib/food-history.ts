import { t } from "@/lib/i18n";
import Papa from "papaparse";
import type { MealLog } from "@/components/journal-tools";
import { validStoredValue } from "./storage-validation";
export type ImportedMeal = {date:string;meal:MealLog};
export function foodHistoryCsv(entries:Record<string,unknown>,from:string,to:string):string{
  const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+"T00:00:00Z"))&&new Date(date+"T00:00:00Z").toISOString().slice(0,10)===date;
  if(!validDate(from)||!validDate(to)||from>to)throw new Error(t("Choose a valid start and end date in order."));
  const rows:Record<string,string|number>[]=[];
  for(const key of Object.keys(entries).sort()){
    if(!key.startsWith("trackcal:journal:"))continue;
    const date=key.slice("trackcal:journal:".length);
    if(date<from||date>to)continue;
    if(!validDate(date)||!validStoredValue(key,entries[key]))throw new Error(t("Recover invalid journal data for {date} before exporting.", { date }));
    for(const meal of entries[key] as MealLog[]){
      // Older manual entries use localized 12-hour strings. Preserve the clock time.
      const match=meal.time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i);
      if(!match||Number(match[2])>59||Number(match[1])>(match[3]?12:23)||(match[3]&&Number(match[1])<1))throw new Error(t("Review the meal time for {name} on {date} before exporting.", { name: meal.name, date }));
      const hour=match[3]?(Number(match[1])%12)+(match[3].toLowerCase()==="p"?12:0):Number(match[1]);
      rows.push({date,time:`${String(hour).padStart(2,"0")}:${match[2]}`,name:meal.name,calories:meal.calories,protein:meal.protein,carbs:meal.carbs,fat:meal.fat});
    }
  }
  if(!rows.length)throw new Error(t("No meals in this workspace for the selected dates."));
  if(rows.length>5000)throw new Error(t("Select a shorter range of at most 5,000 meals."));
  const csv=Papa.unparse(rows,{escapeFormulae:true});
  // Validate against the same import contract; never silently drop invalid meals.
  parseFoodHistory(csv);
  return csv;
}
export function parseFoodHistory(text:string):ImportedMeal[]{
  if(new TextEncoder().encode(text).length>2_000_000)throw new Error(t("CSV must be under 2 MB."));
  const result=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:"greedy",transformHeader:header=>header.trim().toLowerCase()});
  if(result.errors.length)throw new Error(t("CSV could not be read: {message}", { message: result.errors[0].message }));
  if(!result.data.length||result.data.length>5000)throw new Error(t("Import between 1 and 5,000 meal rows."));
  return result.data.map((row,index)=>{
    const date=(row.date||"").trim(),name=(row.name||row.food||"").trim(),time=(row.time||"12:00").trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||!Number.isFinite(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date||!name||name.length>200||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error(t("Row {n}: use a valid YYYY-MM-DD date, food name and HH:MM time.", { n: index+2 }));
    const nutrients=Object.fromEntries(["calories","protein","carbs","fat"].map(key=>{const raw=(row[key]??row[key+"_g"]??"").trim();const value=Number(raw);if(!raw||!Number.isFinite(value)||value<0||value>20000)throw new Error(t("Row {n}: confirm {key}; all four nutrition fields are required.", { n: index+2, key }));return [key,value];})) as Pick<MealLog,"calories"|"protein"|"carbs"|"fat">;
    return {date,meal:{name,time,...nutrients,method:"Reviewed CSV import"}};
  });
}
function fingerprint(meal:MealLog){
  const match=meal.time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i);
  const hour=match?(match[3]?(Number(match[1])%12)+(match[3].toLowerCase()==="p"?12:0):Number(match[1])):null;
  const time=match?`${String(hour).padStart(2,"0")}:${match[2]}`:meal.time;
  return JSON.stringify([meal.name.trim().toLowerCase(),time,meal.calories,meal.protein,meal.carbs,meal.fat]);
}
export function mergeFoodHistory(entries:Record<string,unknown>,rows:ImportedMeal[]){
  const result={...entries};let added=0,duplicates=0;
  for(const {date,meal} of rows){const key=`trackcal:journal:${date}`,existing=(result[key]||[]) as MealLog[];
    if(existing.some(item=>fingerprint(item)===fingerprint(meal))){duplicates++;continue;}
    result[key]=[...existing,meal];added++;
  }
  return {entries:result,added,duplicates};
}

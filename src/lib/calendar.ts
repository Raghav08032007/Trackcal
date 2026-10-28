import { createEvents,type EventAttributes } from "ics";
export type Reminder={id:string;title:string;startsAt:string;minutes:number;repeat:"once"|"daily"|"weekly";enabled:boolean};
export function calendarFile(items:Reminder[]){
  const events:EventAttributes[]=items.filter(item=>item.enabled).map(item=>{
    const date=new Date(item.startsAt);if(!Number.isFinite(date.getTime())||item.minutes<5||item.minutes>120||!item.title.trim())throw new Error("Check reminder title, date and duration.");
    const repeating=item.repeat!=="once";
    const start:[number,number,number,number,number]=repeating?[date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes()]:[date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes()];
    return {uid:`${item.id}@trackcal.local`,title:item.title.slice(0,120),start,startInputType:repeating?"local":"utc",startOutputType:repeating?"local":"utc",duration:{minutes:item.minutes},classification:"PRIVATE",...(repeating?{recurrenceRule:item.repeat==="daily"?"FREQ=DAILY":"FREQ=WEEKLY"}:{}),alarms:[{action:"display",description:"TrackCal reminder",trigger:{minutes:5,before:true}}]};
  });
  if(!events.length)throw new Error("Enable at least one reminder or appointment before exporting.");
  const result=createEvents(events);if(result.error||!result.value)throw new Error("Calendar export failed. Check the event values.");return result.value;
}
export function downloadCalendar(items:Reminder[]){const value=calendarFile(items),url=URL.createObjectURL(new Blob([value],{type:"text/calendar;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="trackcal-calendar.ics";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

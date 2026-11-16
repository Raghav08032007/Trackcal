import { t } from "@/lib/i18n";
import { useState } from "react";
import { useWorkspaceScope } from "./account-session";
import { exportLocalEntries,workspaceKey } from "@/lib/use-local-state";
import { foodHistoryCsv } from "@/lib/food-history";
import { validStoredValue } from "@/lib/storage-validation";

export function HistoryExport(){
  const scope=useWorkspaceScope();
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
  return <section className="account-card"><h2>{t("Your history, ready to take with you.")}</h2><p>{t("Download meals from this workspace as CSV. Choose a date range to review in a spreadsheet or import back into TrackCal. This file contains food records; keep it somewhere private. No upload is required.")}</p>
    <form className="account-form" onSubmit={event=>{event.preventDefault();setError("");setNotice("");try{
      const entries=exportLocalEntries(scope);
      // Inspect raw scoped journals too: the general backup helper skips corrupt values.
      const prefix=workspaceKey("trackcal:journal:",scope);
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
        const date=key.slice(prefix.length);if(date<from||date>to)continue;
        const raw=localStorage.getItem(key);
        if(raw!==null){const value=JSON.parse(raw);const canonical=`trackcal:journal:${date}`;if(!validStoredValue(canonical,value))throw new Error(t("Recover invalid journal data for {date} before exporting.", { date }));if(!(canonical in entries))entries[canonical]=value;}
      }
      const csv=foodHistoryCsv(entries,from,to);
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a");link.href=url;link.download=`trackcal-meals-${from}-to-${to}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice(t("CSV downloaded. Nutrition values refer to the whole logged portion; check the file before sharing."));
    }catch(reason){setError(reason instanceof Error?reason.message:t("Export failed. Your journal has not changed."));}}}>
      <label>{t("Export from")}<input type="date" required value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label>{t("Export through")}<input type="date" required value={to} onChange={event=>setTo(event.target.value)}/></label>
      <button className="account-primary">{t("Download food history CSV")}</button>
    </form><p className="account-fine">{t("Up to 5,000 meals and 2 MB per export. Spreadsheet formula-like names receive a protective apostrophe. CSV excludes wellness, recipes and preferences; use the account JSON backup for those.")}</p>
    {error&&<p role="alert" className="account-error">{error}</p>}{notice&&<p role="status" className="account-success">{notice}</p>}
  </section>;
}

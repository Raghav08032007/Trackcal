import { useEffect } from "react";
import { useLocalState } from "@/lib/use-local-state";
export function ThemeControl(){
  const [theme,setTheme]=useLocalState<"system"|"light"|"dark">("trackcal:appearance","system");
  const [calm,setCalm]=useLocalState('trackcal:play:calm',false),[comfort,setComfort]=useLocalState('trackcal:comfort',false);
  useEffect(()=>{document.documentElement.dataset.comfort=comfort?'on':'off';},[comfort]);
  useEffect(()=>{document.documentElement.dataset.motion=calm?'reduced':'full';},[calm]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const apply=()=>{document.documentElement.dataset.theme=theme==="system"?(media.matches?"dark":"light"):theme;};apply();media.addEventListener("change",apply);return()=>media.removeEventListener("change",apply);},[theme]);
  return <><label className="theme-control">Appearance <select aria-label="Appearance" value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="studio-motion-control"><input type="checkbox" checked={calm} onChange={e=>setCalm(e.target.checked)}/> Reduce motion</label><label className="studio-motion-control"><input type="checkbox" checked={comfort} onChange={e=>setComfort(e.target.checked)}/> Comfort mode (larger text)</label></>;
}

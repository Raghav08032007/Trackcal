import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLocalState } from "@/lib/use-local-state";

type Theme = "system" | "light" | "dark";
const THEMES: { id: Theme; label: string; Icon: typeof Sun }[] = [{ id: "system", label: "System", Icon: Monitor }, { id: "light", label: "Light", Icon: Sun }, { id: "dark", label: "Dark", Icon: Moon }];

/** Appearance (system, light or dark), Reduce motion and Comfort mode: kept on this device and applied to the whole page. */
export function ThemeControl(){
  const [theme,setTheme]=useLocalState<Theme>("trackcal:appearance","system");
  const [calm,setCalm]=useLocalState('trackcal:play:calm',false),[comfort,setComfort]=useLocalState('trackcal:comfort',false);
  useEffect(()=>{document.documentElement.dataset.comfort=comfort?'on':'off';},[comfort]);
  useEffect(()=>{document.documentElement.dataset.motion=calm?'reduced':'full';},[calm]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const apply=()=>{document.documentElement.dataset.theme=theme==="system"?(media.matches?"dark":"light"):theme;};apply();media.addEventListener("change",apply);return()=>media.removeEventListener("change",apply);},[theme]);
  return <>
    <fieldset className="theme-control">
      <legend>Appearance</legend>
      <div className="theme-choices">{THEMES.map(({ id, label, Icon }) => <label key={id} className="theme-choice">
        <input type="radio" name="trackcal-appearance" value={id} checked={theme === id} onChange={() => setTheme(id)} />
        <Icon aria-hidden="true" size={16} /><span>{label}</span>
      </label>)}</div>
    </fieldset>
    <label className="studio-motion-control pref-switch"><input type="checkbox" role="switch" checked={calm} onChange={e=>setCalm(e.target.checked)}/> Reduce motion</label>
    <label className="studio-motion-control pref-switch"><input type="checkbox" role="switch" checked={comfort} onChange={e=>setComfort(e.target.checked)}/> Comfort mode (larger text)</label>
  </>;
}

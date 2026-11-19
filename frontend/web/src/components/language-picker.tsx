// Choose the app's language. Each language is shown in its own script; drafts not yet reviewed by a native speaker say so.
// The choice is remembered on this device and, when signed in, saved to the account so it follows you.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { useAccount } from "./account-session";
import { LANGUAGE_STORAGE_KEY, locale, LOCALES, setLocale, subscribe, t, type LocaleCode } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/locales";
import { personalRequest, type PersonalState } from "@/lib/personalization";

async function saveToAccount(code: LocaleCode) {
  const state = await personalRequest<PersonalState>("state");
  if (!state.revision) return;   // no saved preferences yet: onboarding will save the language with the rest
  await personalRequest("onboarding", { preferences: { ...state.preferences, ui_language: code }, step: Math.max(1, state.step), revision: state.revision, complete: false });
}

const SYSTEM_FONT = { fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans\", sans-serif" };

export function LanguagePicker() {
  const current = useSyncExternalStore(subscribe, locale, locale), { user } = useAccount(), [busy, setBusy] = useState(false);
  const chosen = LOCALES.find(l => l.code === current)!;
  // Signed in on a device that never chose a language: use the one saved on the account.
  useEffect(() => {
    if (!user) return;
    let chosenHere = false;
    try { chosenHere = !!localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { chosenHere = true; }
    if (chosenHere) return;
    let live = true;
    personalRequest<PersonalState>("state").then(state => { const saved = (state.preferences as { ui_language?: string })?.ui_language; if (live && isLocale(saved) && saved !== locale()) void setLocale(saved); }).catch(() => { /* keep the device's language */ });
    return () => { live = false; };
  }, [user]);
  async function change(code: LocaleCode) {
    setBusy(true);
    try { await setLocale(code); if (user) await saveToAccount(code).catch(() => { /* the device keeps the choice; the account copy can wait */ }); }
    finally { setBusy(false); }
  }
  return <div className="language-picker">
    <label><Languages size={18} aria-hidden="true" /> <span>{t("Language")}</span>
      {/* The system font already covers every script, so the brand font's Devanagari, Bengali, Tamil and Arabic files
          (~40 kB each) are not downloaded just to list language names. */}
      <select value={current} disabled={busy} style={SYSTEM_FONT} onChange={e => void change(e.target.value as LocaleCode)}>
        {LOCALES.map(l => <option key={l.code} value={l.code} lang={l.code}>{l.native}{l.code !== "en" ? ` · ${l.english}` : ""}</option>)}
      </select>
    </label>
    {!chosen.reviewed && <small>{t("This translation is a draft and is still being checked by native speakers.")}</small>}
  </div>;
}

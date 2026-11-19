// Sign-up in 8 short steps: goal, body, where you live, how you eat, surgeries and injuries, your week, reminders, review.
// Everything is optional and saved as you go; the server validates it and builds the first plan from it.
import { t, msg } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { personalRequest, defaultPreferences, type Condition, type Preferences, type PersonalState } from "@/lib/personalization";
import { useLocalState } from "@/lib/use-local-state";
import { BODY_PARTS, BodyMap3D, type PartStatus } from "./ds/body-map-3d";
import { ReminderFields } from "./personal-reminder-fields";

const STEPS = [msg("Your goal"), msg("About you"), msg("Where you live"), msg("How you eat"), msg("Surgeries and injuries"), msg("Your week"), msg("Your reminders"), msg("Review and begin")];
const WEEKDAYS = [msg("Mon"), msg("Tue"), msg("Wed"), msg("Thu"), msg("Fri"), msg("Sat"), msg("Sun")];
const GOALS: [string, string, string][] = [
  ["lose", msg("Lose weight"), msg("Steady fat loss that keeps muscle")], ["gain_muscle", msg("Build muscle"), msg("Get stronger week by week")], ["fit", msg("Stay fit"), msg("Move well and feel good")],
  ["eat_better", msg("Eat better"), msg("Balanced meals you enjoy")], ["sport", msg("Train for a sport"), msg("Speed, power and stamina")], ["health_report", msg("Improve my report"), msg("Bring my blood values into range")],
];
export const LANGUAGES: [string, string][] = [["en", "English"], ["hi", "हिन्दी Hindi"], ["bn", "বাংলা Bengali"], ["te", "తెలుగు Telugu"], ["mr", "मराठी Marathi"], ["ta", "தமிழ் Tamil"], ["ur", "اردو Urdu"], ["gu", "ગુજરાતી Gujarati"], ["kn", "ಕನ್ನಡ Kannada"], ["ml", "മലയാളം Malayalam"], ["or", "ଓଡ଼ିଆ Odia"], ["pa", "ਪੰਜਾਬੀ Punjabi"], ["as", "অসমীয়া Assamese"], ["mai", "मैथिली Maithili"], ["sa", "संस्कृतम् Sanskrit"], ["kok", "कोंकणी Konkani"], ["ne", "नेपाली Nepali"], ["sd", "سنڌي Sindhi"], ["ks", "कॉशुर Kashmiri"], ["doi", "डोगरी Dogri"], ["mni", "ꯃꯩꯇꯩꯂꯣꯟ Manipuri"], ["brx", "बड़ो Bodo"], ["sat", "ᱥᱟᱱᱛᱟᱲᱤ Santali"], ["other", msg("Another language")]];
const INDIA_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
const CUISINES: [string, string][] = [["any", msg("Anything")], ["north_indian", msg("North Indian")], ["south_indian", msg("South Indian")], ["tamil", msg("Tamil")], ["kerala", "Kerala"], ["karnataka", "Karnataka"], ["andhra_telangana", msg("Andhra and Telangana")], ["maharashtrian", msg("Maharashtrian")], ["gujarati", msg("Gujarati")], ["rajasthani", msg("Rajasthani")], ["punjabi", msg("Punjabi")], ["bengali", msg("Bengali")], ["odia", msg("Odia")], ["bihari", msg("Bihari")], ["northeast", msg("North-east")], ["kashmiri", msg("Kashmiri")], ["goan", msg("Goan")], [msg("Indian"), msg("Indian, mixed")], ["east_asian", msg("East Asian")], [msg("Mediterranean"), msg("Mediterranean")], ["middle_eastern", msg("Middle Eastern")], ["western", msg("Western")], ["african", msg("African")], ["latin", msg("Latin American")], ["global", msg("A bit of everything")]];
const DIETS: [string, string][] = [["vegetarian", msg("Vegetarian")], ["eggetarian", msg("Eggetarian")], ["non_veg", msg("Non-vegetarian")], ["vegan", msg("Vegan")], ["jain", msg("Jain")], ["pescatarian", msg("Pescatarian")], ["balanced", msg("No preference")]];
const FASTS: [string, string][] = [["ekadashi", msg("Ekadashi")], ["navratri", msg("Navratri")], ["ramadan", msg("Ramadan")], ["shravan", msg("Shravan")], ["karwa_chauth", msg("Karwa Chauth")], ["monday", msg("Mondays")], ["tuesday", msg("Tuesdays")], ["thursday", msg("Thursdays")], ["saturday", msg("Saturdays")], ["other", msg("Other days")]];
const WHEN: [Condition["when"], string][] = [["under6w", msg("Under 6 weeks ago")], ["6to12w", "6 to 12 weeks ago"], ["3to12m", "3 to 12 months ago"], ["over1y", msg("Over a year ago")]];

const SETTING_LABEL: Record<string, string> = { home: msg("Home"), gym: msg("Gym"), outdoor: msg("Outdoors") };
function Chips<T extends string>({ label, options, value, onChange, multi = false }: { label: string; options: [T, string][]; value: T | T[]; onChange: (v: T | T[]) => void; multi?: boolean }) {
  const on = (v: T) => (multi ? (value as T[]).includes(v) : value === v);
  return <fieldset className="onb-chips"><legend>{t(label)}</legend>{options.map(([v, text]) => <button type="button" key={v} className="ds-chip" aria-pressed={on(v)} onClick={() => onChange(multi ? (on(v) ? (value as T[]).filter(x => x !== v) : [...(value as T[]), v]) : v)}>{t(text)}</button>)}</fieldset>;
}
const days = (value: number[], onChange: (v: number[]) => void, label: string) => <fieldset className="onb-chips onb-days"><legend>{t(label)}</legend>{WEEKDAYS.map((d, i) => <button type="button" key={d} className="ds-chip" aria-pressed={value.includes(i)} onClick={() => onChange(value.includes(i) ? value.filter(x => x !== i) : [...value, i].sort())}>{t(d)}</button>)}</fieldset>;
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function PersonalOnboarding() {
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences), [step, setStep] = useState(1), [revision, setRevision] = useState(0), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [done, setDone] = useState(false), [allergyText, setAllergyText] = useState(""), [part, setPart] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    personalRequest<PersonalState>("state").then(v => { if (!alive) return; const merged = { ...defaultPreferences, ...v.preferences }; setPrefs(v.revision ? merged : { ...merged, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }); setAllergyText(merged.allergies.join(", ")); setStep(v.step); setRevision(v.revision); setReady(true); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : t("Could not load your draft.")); });
    return () => { alive = false; };
  }, []);
  const [, setLegacyPreferences] = useLocalState("trackcal:preferences", { currency: "INR", dailyBudget: 500, excludedTags: "", diet: "balanced", completed: false });
  const change = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPrefs(p => ({ ...p, [key]: value }));
  const age = prefs.birth_year ? new Date().getFullYear() - prefs.birth_year : null, minor = prefs.age_group === "under18" || (age !== null && age < 18);
  const condition = (id: string) => prefs.conditions.find(c => c.part === id);
  const setCondition = (id: string, next: Partial<Condition> | null) => change("conditions", next === null ? prefs.conditions.filter(c => c.part !== id) : condition(id) ? prefs.conditions.map(c => (c.part === id ? { ...c, ...next } : c)) : [...prefs.conditions, { part: id, kind: "injury", detail: "", when: "over1y", status: "healing", cleared: null, ...next }]);
  const statuses = Object.fromEntries(prefs.conditions.map(c => [c.part, c.status as PartStatus]));

  async function save(next: number, complete = false) {
    if (busy) return; setBusy(true); setError("");
    const body = { ...prefs, allergies: allergyText.split(",").map(s => s.trim()).filter(Boolean) };
    try {
      const result = await personalRequest<{ revision: number; awarded_xp: number }>("onboarding", { preferences: body, step: next, revision, complete });
      setRevision(result.revision); setStep(next); setPrefs(body); setNotice(t("Saved to your private account."));
      if (complete) {
        setLegacyPreferences(old => ({ ...old, currency: body.currency, dailyBudget: body.budget ?? old.dailyBudget, excludedTags: body.allergies.join(", "), diet: body.diet, completed: true }));
        await personalRequest("plans", { revision: result.revision }); setDone(true);
      }
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not save. Your answers are still here.")); }
    finally { setBusy(false); }
  }
  if (!ready) return <main className="account-page"><section className="account-card" aria-busy={!error}><p>{error || t("Loading your saved answers…")}</p>{error && <button onClick={() => window.location.reload()}>{t("Retry loading")}</button>}</section></main>;
  const chosen = part ? condition(part) : undefined, partLabel = BODY_PARTS.find(p => p.id === part)?.label;

  return <main className="onb-page">
    <header className="onb-top"><span className="onb-count">{done ? t("All set") : t("Step {step} of 8", { step })}</span></header>
    <progress className="onb-progress" max={8} value={done ? 8 : step} aria-label={t("Sign-up progress")} />
    <section className="ds-card onb-card" key={done ? "done" : step}>
      <h1>{done ? t("Your plan is ready.") : t(STEPS[step - 1])}</h1>
      {done ? <><p className="onb-lead">{t("Built from your goal, body, region, food and any parts we need to protect. Change anything whenever life changes.")}</p>
        <div className="ds-buttons"><Link className="ds-btn ds-btn-primary" href="/plan">{t("Open my plan →")}</Link><Link className="ds-btn ds-btn-quiet" href="/">{t("Go to today")}</Link></div></>
        : <form aria-busy={busy} onSubmit={e => { e.preventDefault(); void save(step < 8 ? step + 1 : 8, step === 8); }}>
          {step === 1 && <>
            <p className="onb-lead">{t("What would make the biggest difference for you? We shape every workout, meal and reminder around it.")}</p>
            <div className="onb-goals" role="group" aria-label={t("Your goal")}>{GOALS.map(([v, title, d]) => <button type="button" key={v} className="onb-goal" aria-pressed={prefs.goal === v} onClick={() => change("goal", v)}><strong>{t(title)}</strong><small>{t(d)}</small></button>)}</div>
            <label className="onb-field">{t("What should we call you?")}<input maxLength={100} value={prefs.display_name} autoComplete="given-name" onChange={e => change("display_name", e.target.value)} /></label>
          </>}
          {step === 2 && <>
            <p className="onb-lead">{t("For accurate calorie and protein targets. Every question can be skipped.")}</p>
            <Chips label={t("Sex, for calorie maths")} options={[["female", msg("Female")], ["male", msg("Male")], ["other", msg("Other")], ["unspecified", msg("Prefer not to say")]]} value={prefs.sex} onChange={v => change("sex", v as Preferences["sex"])} />
            <div className="onb-grid">
              <label className="onb-field">{t("Year of birth")}<input inputMode="numeric" type="number" min={1916} max={new Date().getFullYear() - 5} value={prefs.birth_year ?? ""} onChange={e => change("birth_year", num(e.target.value))} /></label>
              <label className="onb-field">{t("Height (cm)")}<input type="number" min={80} max={250} step="0.5" value={prefs.height_cm ?? ""} onChange={e => change("height_cm", num(e.target.value))} /></label>
              <label className="onb-field">{t("Weight (kg)")}<input type="number" min={20} max={350} step="0.1" value={prefs.weight_kg ?? ""} onChange={e => change("weight_kg", num(e.target.value))} /></label>
              {!minor && (prefs.goal === "lose" || prefs.goal === "gain_muscle") && <label className="onb-field">{t("Target weight (kg)")}<input type="number" min={20} max={350} step="0.1" value={prefs.target_weight_kg ?? ""} onChange={e => change("target_weight_kg", num(e.target.value))} /></label>}
            </div>
            {!minor && (prefs.goal === "lose" || prefs.goal === "gain_muscle") && <Chips label={t("How fast?")} options={[["gentle", msg("Gentle")], ["steady", msg("Steady (recommended)")], ["fast", msg("Faster")]]} value={prefs.pace} onChange={v => change("pace", v as Preferences["pace"])} />}
            {minor && <p className="onb-note">{t("Under 18: we focus on healthy habits and strength, never weight-loss targets.")}</p>}
          </>}
          {step === 3 && <>
            <p className="onb-lead">{t("So food shows in your language and your region's dishes come first.")}</p>
            <div className="onb-grid">
              <label className="onb-field">{t("Country")}<input maxLength={80} value={prefs.country} autoComplete="country-name" list="onb-countries" onChange={e => change("country", e.target.value)} /><datalist id="onb-countries"><option value="India" /><option value="United States" /><option value="United Kingdom" /><option value="United Arab Emirates" /><option value="Singapore" /><option value="Canada" /><option value="Australia" /></datalist></label>
              <label className="onb-field">{t("State or region")}{/^india$/i.test(prefs.country.trim()) ? <select value={prefs.state} onChange={e => change("state", e.target.value)}><option value="">{t("Choose…")}</option>{INDIA_STATES.map(s => <option key={s}>{s}</option>)}</select> : <input maxLength={80} value={prefs.state} onChange={e => change("state", e.target.value)} />}</label>
              <label className="onb-field">{t("Language for food names")}<select className="language-select" style={{ fontFamily: "system-ui, sans-serif" }} value={prefs.language} onChange={e => change("language", e.target.value)}>{LANGUAGES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
            </div>
            <Chips label={t("Units")} options={[["metric", msg("Metric (kg, cm)")], ["imperial", msg("Imperial (lb, in)")]]} value={prefs.units} onChange={v => change("units", v as Preferences["units"])} />
          </>}
          {step === 4 && <>
            <Chips label={t("How do you eat?")} options={DIETS as [string, string][]} value={prefs.diet} onChange={v => change("diet", v as string)} />
            {(prefs.diet === "non_veg" || prefs.diet === "eggetarian") && days(prefs.nonveg_days, v => change("nonveg_days", v), prefs.diet === "eggetarian" ? msg("Days you eat eggs (leave empty for any day)") : msg("Days you eat non-veg (leave empty for any day)"))}
            <Chips label={t("Fasting you keep")} options={FASTS as [string, string][]} value={prefs.fasting} multi onChange={v => change("fasting", v as Preferences["fasting"])} />
            <div className="onb-grid">
              <label className="onb-field">{t("Favourite cuisine")}<select value={prefs.cuisine} onChange={e => change("cuisine", e.target.value)}>{CUISINES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label className="onb-field">{t("Food allergies (comma separated)")}<input value={allergyText} placeholder={t("peanut, milk")} onChange={e => setAllergyText(e.target.value)} /></label>
            </div>
          </>}
          {step === 5 && <>
            <p className="onb-lead">{t("Had surgery, an injury, or pain somewhere? Tap that part. Your plan protects it while it heals and strengthens it once it has. Nothing here is shared.")}</p>
            <div className="onb-body">
              <BodyMap3D statuses={statuses} selected={part} onSelect={setPart} />
              <div>
                <div className="ds-parts" role="group" aria-label={t("Body parts")}>{BODY_PARTS.map(p => <button type="button" key={p.id} className="ds-part" aria-pressed={part === p.id} onClick={() => setPart(p.id)}>{condition(p.id) && <i className="ds-dot" style={{ background: condition(p.id)!.status === "recovered" ? "var(--ds-green)" : condition(p.id)!.status === "healing" ? "var(--ds-amber)" : "var(--ds-red)" }} />}{p.label}</button>)}</div>
                {part && <div className="onb-condition" aria-label={t("Details for {partLabel}", { partLabel })}>
                  <h2>{partLabel}</h2>
                  {!chosen ? <button type="button" className="ds-btn ds-btn-quiet" onClick={() => setCondition(part, {})}>{t("Add something about my {n}", { n: partLabel?.toLowerCase() })}</button> : <>
                    <Chips label={t("What happened?")} options={[["surgery", msg("Surgery")], ["injury", msg("Injury")], ["pain", msg("Ongoing pain")]]} value={chosen.kind} onChange={v => setCondition(part, { kind: v as Condition["kind"] })} />
                    <label className="onb-field">{t("Which one? (optional)")}<input maxLength={80} placeholder={t("e.g. ligament surgery, slipped disc")} value={chosen.detail} onChange={e => setCondition(part, { detail: e.target.value })} /></label>
                    <Chips label={t("When?")} options={WHEN} value={chosen.when} onChange={v => setCondition(part, { when: v as Condition["when"] })} />
                    <Chips label={t("How is it now?")} options={[["healing", msg("Still healing")], ["recovered", msg("Recovered")], ["avoid", msg("Hurts, avoid it")]]} value={chosen.status} onChange={v => setCondition(part, { status: v as Condition["status"] })} />
                    {chosen.kind === "surgery" && chosen.when !== "over1y" && <Chips label={t("Has a doctor or physio cleared you to exercise?")} options={[["yes", msg("Yes")], ["no", msg("Not yet")]]} value={chosen.cleared === true ? "yes" : chosen.cleared === false ? "no" : ("" as "yes")} onChange={v => setCondition(part, { cleared: v === "yes" })} />}
                    <button type="button" className="ds-btn ds-btn-danger" onClick={() => { setCondition(part, null); }}>{t("Remove")}</button>
                  </>}
                </div>}
              </div>
            </div>
            <details className="onb-more"><summary>{t("A doctor gave me written exercise instructions")}</summary><label className="onb-field">{t("Paste them here")}<textarea maxLength={1000} value={prefs.professional_restrictions} onChange={e => change("professional_restrictions", e.target.value)} /></label><small>{t("With written instructions we only suggest rest and gentle options until you review the plan with them.")}</small></details>
          </>}
          {step === 6 && <>
            {days(prefs.available_days, v => setPrefs(p => ({ ...p, available_days: v, rest_days: [0, 1, 2, 3, 4, 5, 6].filter(d => !v.includes(d)) })), msg("Days you can work out"))}
            <p className="onb-hint">{t("The other days are rest days.")}</p>
            <div className="onb-grid">
              <label className="onb-field">{t("Minutes per session")}<input type="number" min={5} max={60} value={prefs.duration} onChange={e => change("duration", Number(e.target.value))} /></label>
              <label className="onb-field">{t("Best time")}<input type="time" value={prefs.workout_time} onChange={e => change("workout_time", e.target.value)} /></label>
            </div>
            <Chips label={t("Where?")} options={Object.entries(SETTING_LABEL) as [string, string][]} value={prefs.setting} onChange={v => change("setting", v as string)} />
            <Chips label={t("What do you have?")} options={[["mat", msg("Mat")], ["chair", msg("Chair")], ["dumbbells", msg("Dumbbells")], ["machine", msg("Gym machines")], ["bicycle", msg("Bicycle")]]} value={prefs.equipment} multi onChange={v => change("equipment", v as string[])} />
            <Chips label={t("Experience")} options={[["beginner", msg("New to this")], ["intermediate", msg("Some experience")], ["experienced", msg("Very experienced")], ["unspecified", msg("Not sure")]]} value={prefs.experience} onChange={v => change("experience", v as string)} />
            <Chips label={t("You enjoy")} options={[["strength", msg("Strength")], ["fitness", msg("General fitness")], ["endurance", msg("Endurance")], ["running", msg("Running")], ["yoga", msg("Yoga")], ["mobility", msg("Mobility")], ["sports", msg("Sports")], ["routine", msg("Simple routines")]]} value={prefs.interests} multi onChange={v => change("interests", v as string[])} />
          </>}
          {step === 7 && <ReminderFields value={prefs.reminders} onChange={v => change("reminders", v)} />}
          {step === 8 && <>
            <dl className="onb-summary">
              <div><dt>{t("Goal")}</dt><dd>{GOALS.find(g => g[0] === prefs.goal)?.[1] ?? t("Not chosen")}</dd></div>
              <div><dt>{t("You")}</dt><dd>{[prefs.display_name, age !== null && `${age} years`, prefs.height_cm && `${prefs.height_cm} cm`, prefs.weight_kg && `${prefs.weight_kg} kg`].filter(Boolean).join(" · ") || t("Skipped")}</dd></div>
              <div><dt>{t("Region")}</dt><dd>{[prefs.state, prefs.country].filter(Boolean).join(", ") || t("Skipped")} · {LANGUAGES.find(l => l[0] === prefs.language)?.[1]}</dd></div>
              <div><dt>{t("Food")}</dt><dd>{DIETS.find(d => d[0] === prefs.diet)?.[1]} · {CUISINES.find(c => c[0] === prefs.cuisine)?.[1]}{prefs.fasting.length ? t(" · fasting: {length}", { length: prefs.fasting.length }) : ""}</dd></div>
              <div><dt>{t("Protected")}</dt><dd>{prefs.conditions.length ? prefs.conditions.map(c => BODY_PARTS.find(p => p.id === c.part)?.label).join(", ") : t("Nothing marked")}</dd></div>
              <div><dt>{t("Week")}</dt><dd>{prefs.available_days.map(d => t(WEEKDAYS[d])).join(", ") || t("No days chosen")} · {t("{n} min", { n: prefs.duration })} · {t(SETTING_LABEL[prefs.setting] ?? prefs.setting)}</dd></div>
            </dl>
            <p className="onb-note">{t("Have a recent blood report? You can add it any time from Home for a plan built on your numbers. It's optional.")}</p>
          </>}
          <div className="onb-actions">
            {step > 1 && <button type="button" className="ds-btn ds-btn-quiet" disabled={busy} onClick={() => void save(step - 1)}>{t("Back")}</button>}
            <button className="ds-btn ds-btn-primary" disabled={busy}>{busy ? t("Saving…") : step === 8 ? t("Finish & create my plan") : t("Next")}</button>
            <button type="button" className="onb-later" disabled={busy} onClick={() => void save(step)}>{t("Save & resume later")}</button>
          </div>
        </form>}
      {error && <p role="alert" className="account-error">{error}</p>}
      {notice && !error && <p role="status" className="onb-saved">{notice}</p>}
    </section>
    {!done && <p className="onb-skip"><Link href="/">{t("Skip for now and start tracking")}</Link></p>}
  </main>;
}

import { t, msg } from "@/lib/i18n";
// Photo credits: every photo's author, licence and source, as the licences require.
import { useEffect, useState } from "react";
import { Photo, PHOTOS, type PhotoId } from "@/components/photos";

export const metadata = { title:msg("TrackCal — Photo credits") };
type Credit = { title: string; license: string; license_url: string; artist: string; source: string };

export default function Page() {
  const [credits, setCredits] = useState<Record<string, Credit> | null>(null);
  useEffect(() => { fetch("/photos/credits.json").then(r => r.json()).then(setCredits).catch(() => setCredits({})); }, []);
  return <main className="account-page"><div className="account-title"><span className="eyebrow">{t("CREDITS")}</span><h1>{t("Photo credits")}</h1>
    <p>{t("These photos come from Wikimedia Commons under free licences. They were resized and compressed for TrackCal; nothing else was changed.")}</p>
    <p>{t("Open-source software and ideas used in TrackCal:")}</p>
    <ul className="credits-list">
      <li>{t("react-body-highlighter by GV79 (MIT): muscle maps.")}</li>
      <li>{t("three.js by mrdoob and contributors (MIT): the 3D athlete.")}</li>
      <li>{t("MakeHuman and MPFB (CC0 body assets): the realistic 3D coach, built in Blender. No real person is depicted.")}</li>
      <li>{t("Exercise-Correction by Ngô Hồng Quốc Bảo (MIT): form-check rules for squats, curls and lunges.")}</li>
      <li>{t("workout-cool by Snouzy (MIT): the build-a-workout flow.")}</li>
      <li>{t("mhabit by FriesI23 (Apache-2.0): the habit strength idea.")}</li>
      <li>{t("Flex by brandonp2412 (MIT): progress per exercise.")}</li>
      <li>{t("fud-ai by apoorvdarshan (MIT): allergen matching and gradual calorie changes.")}</li>
      <li>{t("elevate by thomaschampagne: the fitness and fatigue view, rewritten from the published formula.")}</li>
      <li>{t("free-exercise-db by yuhonas (Unlicense): facts in the exercise library.")}</li>
    </ul></div>
    <div className="community-grid">{credits && Object.entries(credits).filter(([id]) => id in PHOTOS).map(([id, c]) => <figure key={id} className="account-card credit-card">
      <Photo id={id as PhotoId} sizes="300px" />
      <figcaption><strong>{c.title}</strong><span>{t("By {artist}", { artist: c.artist || t("unknown author") })}</span><span>{c.license_url ? <a href={c.license_url} rel="noopener noreferrer license" target="_blank">{c.license}</a> : c.license} · <a href={c.source} rel="noopener noreferrer" target="_blank">{t("Source")}</a></span></figcaption>
    </figure>)}</div></main>;
}

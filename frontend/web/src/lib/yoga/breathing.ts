import { localized, msg } from "../i18n";

/** Guided breathing (pranayama and simple calming patterns). Timings follow common beginner teaching, including the
 *  Ministry of AYUSH Common Yoga Protocol for Nadi Shodhana and Bhramari; the wording is TrackCal's own. */
export type Phase = { kind: "in" | "hold" | "out" | "rest" | "pump"; seconds: number; say: string; detail?: string };
export type Breath = { id: string; name: string; sanskrit?: string; about: string; phases: Phase[]; caution?: string; level: 1 | 2;
  /** Cycles a beginner should stop at, if any. */ maxCycles?: number };

const IN = msg("Breathe in"), OUT = msg("Breathe out"), HOLD = msg("Hold");
export const BREATHS: Breath[] = [
  { id: "calm", name: msg("Calm breathing (4 in, 6 out)"), about: msg("A longer breath out slows the heart and settles the mind. Good any time."), level: 1,
    phases: [{ kind: "in", seconds: 4, say: IN }, { kind: "out", seconds: 6, say: OUT }] },
  { id: "box", name: msg("Box breathing"), about: msg("Four equal sides: in, hold, out, hold. Steadies you before a big moment."), level: 1,
    phases: [{ kind: "in", seconds: 4, say: IN }, { kind: "hold", seconds: 4, say: HOLD }, { kind: "out", seconds: 4, say: OUT }, { kind: "hold", seconds: 4, say: HOLD }] },
  { id: "nadi-shodhana", name: msg("Alternate nostril breathing"), sanskrit: "Nadi Shodhana / Anulom Vilom", level: 1,
    about: msg("Right thumb closes the right nostril, ring finger the left. Balancing and calming."),
    phases: [{ kind: "in", seconds: 4, say: msg("In through the left"), detail: msg("Close the right nostril") }, { kind: "out", seconds: 6, say: msg("Out through the right"), detail: msg("Close the left nostril") },
      { kind: "in", seconds: 4, say: msg("In through the right"), detail: msg("Keep the left closed") }, { kind: "out", seconds: 6, say: msg("Out through the left"), detail: msg("Close the right nostril") }] },
  { id: "bhramari", name: msg("Humming bee breath"), sanskrit: "Bhramari", level: 1,
    about: msg("Close the ears gently with the thumbs and hum like a bee on the breath out. Soothing; good before sleep."),
    phases: [{ kind: "in", seconds: 4, say: IN }, { kind: "out", seconds: 8, say: msg("Hum softly") }] },
  { id: "ujjayi", name: msg("Ocean breath"), sanskrit: "Ujjayi", level: 1,
    about: msg("Breathe through the nose with a soft sound at the back of the throat, like waves."),
    phases: [{ kind: "in", seconds: 5, say: IN }, { kind: "out", seconds: 5, say: OUT }] },
  { id: "478", name: msg("4-7-8 breathing"), about: msg("In for 4, hold for 7, out for 8. Helps many people fall asleep."), level: 1, maxCycles: 4,
    caution: msg("Feeling light-headed? Stop and breathe normally."),
    phases: [{ kind: "in", seconds: 4, say: IN }, { kind: "hold", seconds: 7, say: HOLD }, { kind: "out", seconds: 8, say: OUT }] },
  { id: "kapalbhati", name: msg("Skull-shining breath"), sanskrit: "Kapalbhati", level: 2, maxCycles: 3,
    about: msg("Short, strong breaths out by pulling the belly in; the breath in happens by itself. 30 pumps, then rest. On an empty stomach."),
    caution: msg("Skip if you have high blood pressure, heart disease, hernia, epilepsy, a recent operation, or are pregnant or menstruating."),
    phases: [{ kind: "pump", seconds: 30, say: msg("Pump out, one per second") }, { kind: "rest", seconds: 30, say: msg("Rest and breathe normally") }] },
];
export const BREATH_BY_ID: Record<string, Breath> = Object.fromEntries(BREATHS.map(b => [b.id, b]));
for (const b of BREATHS) localized(b.phases, ["say", "detail"]);
localized(BREATHS, ["name", "about", "caution"]);

export const cycleSeconds = (b: Breath) => b.phases.reduce((s, p) => s + p.seconds, 0);

/** Where the guide is after `ms` milliseconds: the phase, how far through it (0-1), seconds left in it, and the cycle. */
export function phaseAt(b: Breath, ms: number) {
  const cycle = cycleSeconds(b) * 1000, n = Math.floor(ms / cycle);
  let t = ms - n * cycle;
  for (let i = 0; i < b.phases.length; i++) {
    const len = b.phases[i].seconds * 1000;
    if (t < len) return { index: i, phase: b.phases[i], progress: t / len, left: Math.ceil((len - t) / 1000), cycle: n + 1 };
    t -= len;
  }
  return { index: 0, phase: b.phases[0], progress: 0, left: b.phases[0].seconds, cycle: n + 2 };
}

/** The circle's size for a phase: grows on the breath in, stays on a hold, shrinks on the breath out. 0.35-1. */
export function circleSize(kind: Phase["kind"], progress: number, previous: number) {
  const ease = 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, progress))) / 2;
  if (kind === "in") return 0.35 + 0.65 * ease;
  if (kind === "out") return 1 - 0.65 * ease;
  if (kind === "pump") return 0.6 + 0.15 * Math.abs(Math.sin(progress * Math.PI * 30));
  return previous;
}

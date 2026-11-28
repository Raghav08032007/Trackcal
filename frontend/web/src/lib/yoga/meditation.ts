import { localized, msg } from "../i18n";

/** Guided meditations: short spoken prompts placed through the session (as a share of its length), with a bell at the
 *  start and end. Silence between prompts is the practice. TrackCal's own scripts. */
export type Prompt = { at: number; text: string };
export type Meditation = { id: string; name: string; about: string; prompts: Prompt[] };

export const MEDITATIONS: Meditation[] = [
  { id: "silent", name: msg("Silent timer"), about: msg("A bell to start and a bell to end. Nothing in between."), prompts: [] },
  { id: "breath", name: msg("Breath awareness"), about: msg("Rest your attention on the breath; come back each time the mind wanders."), prompts: [
    { at: 0, text: msg("Sit comfortably with your back tall. Close your eyes, or lower your gaze.") },
    { at: 0.05, text: msg("Notice the breath where you feel it most: the nose, the chest or the belly.") },
    { at: 0.3, text: msg("If the mind has wandered, that's fine. Gently come back to the next breath.") },
    { at: 0.6, text: msg("Let each breath out be a little softer.") },
    { at: 0.9, text: msg("Slowly notice the room around you again.") }] },
  { id: "body-scan", name: msg("Body scan"), about: msg("Move your attention slowly from the feet to the head, relaxing as you go."), prompts: [
    { at: 0, text: msg("Lie down or sit comfortably. Close your eyes.") },
    { at: 0.08, text: msg("Bring your attention to your feet. Let them be heavy.") },
    { at: 0.22, text: msg("Now the legs and knees. Let them soften.") },
    { at: 0.36, text: msg("The hips and belly. Let the belly rise and fall freely.") },
    { at: 0.5, text: msg("The chest, the back and the shoulders. Let the shoulders drop.") },
    { at: 0.64, text: msg("The arms and hands, all the way to the fingertips.") },
    { at: 0.76, text: msg("The neck, the jaw, the face and the eyes. Unclench the jaw.") },
    { at: 0.88, text: msg("Feel the whole body at once, resting and breathing.") }] },
  { id: "kindness", name: msg("Loving kindness"), about: msg("Wish yourself and others well. Warms the heart and eases stress."), prompts: [
    { at: 0, text: msg("Sit comfortably and take a few slow breaths.") },
    { at: 0.1, text: msg("Silently say: may I be well, may I be happy, may I be at peace.") },
    { at: 0.35, text: msg("Think of someone you love. Wish them the same: may you be well, may you be happy.") },
    { at: 0.6, text: msg("Think of someone you hardly know. Wish them well too.") },
    { at: 0.8, text: msg("Now wish all beings everywhere: may all be well, may all be at peace.") }] },
  { id: "sleep", name: msg("Sleep wind-down"), about: msg("A slow breath, a relaxed body and a quiet mind before bed."), prompts: [
    { at: 0, text: msg("Lie down in bed and let the body be heavy.") },
    { at: 0.1, text: msg("Breathe in for four, and out slowly for six.") },
    { at: 0.35, text: msg("With each breath out, let the day go a little more.") },
    { at: 0.6, text: msg("If thoughts come, let them drift past like clouds.") },
    { at: 0.85, text: msg("Stay here, warm and resting. There is nothing to do.") }] },
];
export const DURATIONS = [3, 5, 10, 20];
export const MEDITATION_BY_ID: Record<string, Meditation> = Object.fromEntries(MEDITATIONS.map(m => [m.id, m]));
for (const m of MEDITATIONS) localized(m.prompts, ["text"]);
localized(MEDITATIONS, ["name", "about"]);

/** The prompts due between two moments of a session of `minutes`, in order. */
export function promptsBetween(m: Meditation, minutes: number, fromMs: number, toMs: number) {
  const total = minutes * 60000;
  return m.prompts.filter(p => { const at = p.at * total; return at >= fromMs && at < toMs; });
}

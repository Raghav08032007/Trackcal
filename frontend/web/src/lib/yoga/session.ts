import { wellnessRequest, type Session } from "../wellness";
import { stepMinutes } from "../workout-coach";

/** Saves a finished yoga, breathing or meditation session to the account's workout history. */
export async function saveMindBody(name: string, exerciseId: string, seconds: number, notes: string) {
  const id = crypto.randomUUID();
  const opened = await wellnessRequest<{ session: Session }>("sessions", { id, name, exercises: [exerciseId], tracking_method: "manual" });
  const minutes = stepMinutes(seconds);
  const done = await wellnessRequest<{ awarded_xp: number }>("sessions/" + id, { revision: opened.session.revision, action: "complete", minutes, notes,
    exercises: [{ exercise_id: exerciseId, sets: [{ reps: 0, load: 0, minutes: Math.min(60, minutes) }] }] }, "PUT");
  return done.awarded_xp;
}

/** A soft bell, made in the browser (no sound file): a few sine partials fading out. Silent if audio is unavailable. */
export function bell(volume = 0.25) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(), now = ctx.currentTime;
    for (const [freq, gain] of [[528, 1], [1056, 0.35], [1584, 0.15]] as const) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.value = freq; osc.type = "sine";
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(volume * gain, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      osc.connect(g).connect(ctx.destination); osc.start(now); osc.stop(now + 4.1);
    }
    setTimeout(() => { void ctx.close(); }, 4500);
  } catch { /* audio not available */ }
}

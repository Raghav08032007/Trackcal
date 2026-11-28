import { localized, msg } from "../i18n";
import { normalize } from "../pose/landmarks";
import type { PoseFrame } from "../pose/types";
import { ASANA_BY_ID, type Asana } from "./asanas";
import { match, measure } from "./score";

/** Surya Namaskar, the 12 steps of the sun salutation (Ministry of AYUSH Common Yoga Protocol order), each an asana from
 *  the library with its breath. Camera mode follows along: a step counts when the body matches it, in order. */
export type Step = { asana: Asana; name: string; breath: string };
const STEP = (id: string, name: string, breath: string): Step => ({ asana: ASANA_BY_ID[id], name, breath });
const IN = msg("Breathe in"), OUT = msg("Breathe out");
export const SURYA: Step[] = [
  STEP("pranamasana", msg("1. Prayer pose"), OUT),
  STEP("urdhva-hastasana", msg("2. Raised arms"), IN),
  STEP("uttanasana", msg("3. Hand to foot"), OUT),
  STEP("ashwa-sanchalanasana", msg("4. Equestrian, right leg back"), IN),
  STEP("phalakasana", msg("5. Plank (stick pose)"), msg("Hold the breath")),
  STEP("ashtanga-namaskara", msg("6. Eight-limbed salute"), OUT),
  STEP("bhujangasana", msg("7. Cobra"), IN),
  STEP("adho-mukha-svanasana", msg("8. Mountain (downward dog)"), OUT),
  STEP("ashwa-sanchalanasana", msg("9. Equestrian, right leg forward"), IN),
  STEP("uttanasana", msg("10. Hand to foot"), OUT),
  STEP("urdhva-hastasana", msg("11. Raised arms"), IN),
  STEP("pranamasana", msg("12. Prayer pose"), OUT),
];
localized(SURYA, ["name", "breath"]);
export const SURYA_CAUTION = msg("Skip Surya Namaskar if you have high blood pressure, heart disease, a hernia, back problems, or are pregnant. Stop if you feel dizzy.");

/** A step counts once the body matches it for this long. */
const HOLD_MS = 600, ENOUGH = 70;

/** Follows the sequence on camera. Steps must come in order; a round is the 12 steps. */
export class SuryaTracker {
  step = 0; rounds = 0; private since = -1; scores: number[] = [];
  update(frame: PoseFrame) {
    const p = normalize(frame), body = p ? measure(p) : {}, want = SURYA[this.step], m = match(want.asana, body), now = frame.timestamp;
    if (m.seen >= 0.5 && m.score >= ENOUGH) {
      if (this.since < 0) this.since = now;
      if (now - this.since >= HOLD_MS) {
        this.scores.push(m.score); this.since = -1; this.step = (this.step + 1) % SURYA.length;
        if (this.step === 0) this.rounds++;
        return { advanced: true, score: m.score, seen: m.seen };
      }
    } else this.since = -1;
    return { advanced: false, score: m.seen >= 0.5 ? m.score : 0, seen: m.seen };
  }
  get average() { return this.scores.length ? Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length) : 0; }
  reset() { this.step = 0; this.rounds = 0; this.since = -1; this.scores = []; }
}

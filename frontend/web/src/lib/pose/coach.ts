// Coaching for every camera exercise and sport. Exercises share a movement pattern (squat, hinge, push…): each pattern
// has technique steps, common mistakes with their fixes, and a breathing cue. The exercise's own title, muscles,
// camera setup, cues and tips (types.ts, exercise-config.ts) complete its page. Sports have their own full set.
import { localized, localizedMap, msg } from "../i18n";
import type { ExerciseKind } from "./types";
import type { RejectionReason } from "./exercise-config";
import type { SportKind } from "./sports";

export type Pattern = "squat" | "lunge" | "hinge" | "glute" | "push" | "press" | "raise" | "pull" | "curl" | "triceps" | "legiso" | "core" | "cardio" | "stability";
export type Mistake = { mistake: string; fix: string };
export type Coach = { title: string; steps: string[]; mistakes: Mistake[]; breath: string };

export const PATTERNS: Record<Pattern, Coach> = {
  squat: { title: msg("Squat pattern"),
    steps: [msg("Stand with feet about shoulder-width apart, toes turned out a little."), msg("Push your hips back and bend your knees, keeping your chest up."),
      msg("Go as low as feels comfortable, knees following the line of your toes."), msg("Press through your whole foot to stand tall again.")],
    mistakes: [{ mistake: msg("Knees falling inwards"), fix: msg("Push your knees out over your middle toes.") },
      { mistake: msg("Heels lifting off the floor"), fix: msg("Keep your weight over your mid-foot; widen your stance a little.") },
      { mistake: msg("Back rounding at the bottom"), fix: msg("Stop just before your back rounds and keep your chest proud.") }],
    breath: msg("Breathe in on the way down, out as you stand up.") },
  lunge: { title: msg("Lunge pattern"),
    steps: [msg("Stand tall with feet hip-width apart."), msg("Step one foot forward or back into a long, stable stance."),
      msg("Lower straight down until both knees are bent, front knee over the ankle."), msg("Push through the front heel to return, then switch sides.")],
    mistakes: [{ mistake: msg("Front knee drifting far past the toes"), fix: msg("Take a longer step and drop straight down.") },
      { mistake: msg("Wobbling side to side"), fix: msg("Keep your feet on two separate tracks, not one line.") },
      { mistake: msg("Leaning the body forward"), fix: msg("Keep your chest tall and your hips under your shoulders.") }],
    breath: msg("Breathe in as you lower, out as you push back up.") },
  hinge: { title: msg("Hip hinge"),
    steps: [msg("Stand with feet hip-width apart, knees soft."), msg("Push your hips back as if closing a door behind you, back long and flat."),
      msg("Lower until you feel a stretch in the back of your legs."), msg("Squeeze your glutes to bring your hips forward and stand tall.")],
    mistakes: [{ mistake: msg("Rounding the lower back"), fix: msg("Keep a long, neutral spine; stop where you can hold it.") },
      { mistake: msg("Squatting instead of hinging"), fix: msg("Send your hips back, not down; your shins stay nearly upright.") },
      { mistake: msg("Weight drifting away from the body"), fix: msg("Keep the weight close, sliding along your legs.") }],
    breath: msg("Breathe in at the top, brace, and breathe out as you stand.") },
  glute: { title: msg("Glute and hip work"),
    steps: [msg("Set up steady: back flat on the floor or on all fours, as shown."), msg("Tighten your stomach gently so your lower back stays still."),
      msg("Move from the hip with control and squeeze your glutes at the top."), msg("Lower slowly back to the start.")],
    mistakes: [{ mistake: msg("Arching the lower back at the top"), fix: msg("Stop when your hips are in line with your body; squeeze, don't push higher.") },
      { mistake: msg("Swinging the leg or hips"), fix: msg("Slow down: two counts up, two counts down.") },
      { mistake: msg("Pushing through the toes"), fix: msg("Press through your heels to feel your glutes work.") }],
    breath: msg("Breathe out as you lift, in as you lower.") },
  push: { title: msg("Push pattern"),
    steps: [msg("Hands a little wider than your shoulders, body in one straight line."), msg("Tighten your stomach and glutes so your hips don't sag."),
      msg("Lower your chest with elbows about 45° from your body."), msg("Push the floor away until your arms are straight.")],
    mistakes: [{ mistake: msg("Hips sagging or piking up"), fix: msg("Squeeze your glutes and keep head, hips and heels in line.") },
      { mistake: msg("Elbows flaring straight out"), fix: msg("Tuck your elbows to about 45°, like an arrow, not a T.") },
      { mistake: msg("Only going halfway down"), fix: msg("Use an easier version (hands raised) and go through the full range.") }],
    breath: msg("Breathe in as you lower, out as you push.") },
  press: { title: msg("Overhead press"),
    steps: [msg("Stand tall with the weight at shoulder height, wrists stacked over elbows."), msg("Brace your stomach and squeeze your glutes."),
      msg("Press straight up until your arms are fully extended beside your ears."), msg("Lower with control back to your shoulders.")],
    mistakes: [{ mistake: msg("Leaning back to push the weight up"), fix: msg("Squeeze your glutes and keep your ribs down; use a lighter weight.") },
      { mistake: msg("Pressing forward instead of up"), fix: msg("Finish with the weight over the middle of your head.") },
      { mistake: msg("Shrugging the shoulders to the ears"), fix: msg("Keep your neck long; push up, not up-and-in.") }],
    breath: msg("Breathe out as you press up, in as you lower.") },
  raise: { title: msg("Raises and flyes"),
    steps: [msg("Stand tall with a light weight and a slight bend in your elbows."), msg("Keep your shoulders down and away from your ears."),
      msg("Lift to about shoulder height, leading with your elbows."), msg("Lower slowly; the way down matters as much as the way up.")],
    mistakes: [{ mistake: msg("Swinging the body to lift"), fix: msg("Use a lighter weight and keep your body still.") },
      { mistake: msg("Lifting higher than the shoulders"), fix: msg("Stop at shoulder height; higher adds strain, not benefit.") },
      { mistake: msg("Shrugging"), fix: msg("Think of reaching wide, not up.") }],
    breath: msg("Breathe out as you lift, in as you lower.") },
  pull: { title: msg("Pull pattern"),
    steps: [msg("Set a steady position: hinge forward, sit tall or hang, as shown."), msg("Start by drawing your shoulder blades back and down."),
      msg("Pull with your elbows towards your hips or ribs."), msg("Pause, squeeze your back, then straighten your arms with control.")],
    mistakes: [{ mistake: msg("Pulling with the arms only"), fix: msg("Start each rep by moving your shoulder blades.") },
      { mistake: msg("Jerking the body for momentum"), fix: msg("Use a lighter weight or an easier version and keep your torso still.") },
      { mistake: msg("Shoulders rolling forward"), fix: msg("Keep your chest open and your shoulders back.") }],
    breath: msg("Breathe out as you pull, in as you return.") },
  curl: { title: msg("Curls"),
    steps: [msg("Stand tall, elbows close to your sides."), msg("Keep your upper arms still for the whole set."),
      msg("Curl the weight up by bending only at the elbow."), msg("Lower slowly all the way until your arm is straight.")],
    mistakes: [{ mistake: msg("Swinging the body to lift"), fix: msg("Use a lighter weight and keep your elbows pinned.") },
      { mistake: msg("Elbows drifting forward"), fix: msg("Keep your elbows just in front of your hips.") },
      { mistake: msg("Not straightening the arm at the bottom"), fix: msg("Finish each rep with a straight arm.") }],
    breath: msg("Breathe out as you curl up, in as you lower.") },
  triceps: { title: msg("Triceps work"),
    steps: [msg("Set your upper arm in place, as shown, and keep it still."), msg("Bend at the elbow to lower the weight or your body."),
      msg("Straighten your arm fully by squeezing the back of it."), msg("Control the way back; don't let the weight drop.")],
    mistakes: [{ mistake: msg("Upper arm moving"), fix: msg("Only the forearm moves; hold your elbow in one place.") },
      { mistake: msg("Elbows flaring out"), fix: msg("Point your elbows forward or back, not to the sides.") },
      { mistake: msg("Shoulders rising (dips)"), fix: msg("Keep your shoulders down; only go as low as is comfortable.") }],
    breath: msg("Breathe out as you straighten your arm.") },
  legiso: { title: msg("Leg strength"),
    steps: [msg("Get into a steady position with support nearby if you need it."), msg("Move only the joint the exercise works."),
      msg("Squeeze at the top for a moment."), msg("Lower slowly back to the start.")],
    mistakes: [{ mistake: msg("Bouncing through the reps"), fix: msg("Pause for a moment at the top and the bottom.") },
      { mistake: msg("Using momentum"), fix: msg("Slow down: two counts up, two counts down.") },
      { mistake: msg("Partial range"), fix: msg("Use the full comfortable range on every rep.") }],
    breath: msg("Breathe out on the effort, in as you return.") },
  core: { title: msg("Core control"),
    steps: [msg("Set up on a mat with your lower back gently pressed down."), msg("Tighten your stomach as if bracing for a light poke."),
      msg("Move slowly, curling or lifting only as far as you control."), msg("Lower back down with control and reset.")],
    mistakes: [{ mistake: msg("Pulling on the neck"), fix: msg("Keep a fist-sized gap under your chin; hands lightly by your ears.") },
      { mistake: msg("Lower back arching off the floor"), fix: msg("Make the move smaller until your back stays down.") },
      { mistake: msg("Rushing with momentum"), fix: msg("Slow down; quality reps work the core more.") }],
    breath: msg("Breathe out as you curl or lift, in as you lower.") },
  cardio: { title: msg("Cardio moves"),
    steps: [msg("Start at an easy pace to warm up for a minute."), msg("Land softly through the balls of your feet, knees soft."),
      msg("Keep your chest up and arms moving in rhythm."), msg("Build speed only while your form stays clean.")],
    mistakes: [{ mistake: msg("Landing heavily"), fix: msg("Land quietly, like stepping on thin ice.") },
      { mistake: msg("Knees collapsing on landing"), fix: msg("Keep your knees over your toes as you land.") },
      { mistake: msg("Holding your breath"), fix: msg("Breathe steadily; slow down if you can't talk at all.") }],
    breath: msg("Breathe steadily in rhythm with your moves.") },
  stability: { title: msg("Back and balance"),
    steps: [msg("Set up on all fours or face down on a mat, as shown."), msg("Gently tighten your stomach to keep your spine still."),
      msg("Reach or lift slowly, keeping your hips level."), msg("Hold for a breath, then return with control.")],
    mistakes: [{ mistake: msg("Hips twisting or tilting"), fix: msg("Imagine a cup of water on your lower back.") },
      { mistake: msg("Lifting too high"), fix: msg("Lift only as far as your back stays long.") },
      { mistake: msg("Moving fast"), fix: msg("Slow and steady builds the control.") }],
    breath: msg("Breathe out as you reach or lift.") },
};

const BY_PATTERN: Record<Pattern, ExerciseKind[]> = {
  squat: ["squat", "bandsquat", "frontsquat", "kbsquat", "ohsquat", "pistol", "sumo", "wsquat", "thruster"] as ExerciseKind[],
  lunge: ["lunge", "revlunge", "sidelunge", "bblunge", "wlunge", "bulgarian"] as ExerciseKind[],
  hinge: ["rdl", "deadlift", "kbdeadlift", "goodmorning", "bwgoodmorning", "toetouch", "kbswing", "nordic"] as ExerciseKind[],
  glute: ["bridge", "hipthrust", "donkey", "sideleg"] as ExerciseKind[],
  push: ["pushup", "decline", "diamondpush", "incline", "kneepush", "wallpush", "widepush", "bench", "inclinebench", "hspu", "pikepush"] as ExerciseKind[],
  press: ["press", "bandpress", "bbpress", "kbpress", "cleanpress", "snatch"] as ExerciseKind[],
  raise: ["raise", "front", "bandfront", "bandraise", "revfly", "uprow", "kbhighpull"] as ExerciseKind[],
  pull: ["row", "bbrow", "kbrow", "bandrow", "seatrow", "latpull", "bandpulldown", "pullup", "pullover"] as ExerciseKind[],
  curl: ["curl", "bandcurl", "bbcurl", "conccurl", "hammer"] as ExerciseKind[],
  triceps: ["kickback", "bandkickback", "overhead", "skull", "dip"] as ExerciseKind[],
  legiso: ["calf", "wcalf", "legcurl", "legext", "knee"] as ExerciseKind[],
  core: ["crunch", "situp", "bicycle", "revcrunch", "vup", "legraise", "hangleg", "flutter", "sidebend", "shouldertap"] as ExerciseKind[],
  cardio: ["burpee", "buttkick", "highknee", "jack", "jumplunge", "squatjump", "sumojump", "tuckjump", "punch", "climber"] as ExerciseKind[],
  stability: ["superman", "birddog"] as ExerciseKind[],
};
const PATTERN_OF = new Map<string, Pattern>(Object.entries(BY_PATTERN).flatMap(([p, kinds]) => kinds.map(k => [k, p as Pattern] as const)));
/** The movement pattern of an exercise; an exercise added later without one is coached as a general strength move. */
export const patternOf = (kind: ExerciseKind): Pattern => PATTERN_OF.get(kind) ?? "legiso";
export const coachFor = (kind: ExerciseKind): Coach => PATTERNS[patternOf(kind)];

/** Safety, the same for every exercise. */
export const SAFETY = [msg("Stop if you feel sharp pain, dizziness or chest pain, and rest."),
  msg("Choose an easier version or a lighter weight whenever form slips."),
  msg("With a recent injury or surgery, follow your doctor's or physio's advice first.")];

/** The one thing to fix after a set, from the reason reps were most often not counted. */
export const SET_FIX: Record<RejectionReason, string> = {
  too_shallow: msg("Go a little deeper on each rep, as far as is comfortable: that's where most reps were missed."),
  too_fast: msg("Slow down: take about two seconds down and two seconds up."),
  too_slow: msg("Keep each rep moving; rest at the top between reps, not halfway."),
  lost_tracking: msg("Stay fully in the camera view: step back a little or move the phone."),
  wrong_exercise: msg("Do the exercise you picked, as the guide shows, so every rep counts."),
};

export type SportCoach = { trains: string; steps: string[]; mistakes: Mistake[]; drill: string; safety: string };
export const SPORT_COACH: Record<SportKind, SportCoach> = {
  skip: { trains: msg("Heart and lungs, calves, timing and light footwork."),
    steps: [msg("Stand tall, elbows close to your sides, hands at hip height."), msg("Turn the rope (or mime it) with your wrists, not your arms."),
      msg("Hop just high enough to clear the rope, both feet together."), msg("Land softly on the balls of your feet and keep a steady rhythm.")],
    mistakes: [{ mistake: msg("Jumping too high"), fix: msg("Small hops of a few centimetres are enough.") },
      { mistake: msg("Big arm circles"), fix: msg("Turn from the wrists with elbows close in.") },
      { mistake: msg("Landing on flat feet"), fix: msg("Stay on the balls of your feet with soft knees.") }],
    drill: msg("Practice: 30 seconds skipping, 30 seconds rest, 6 rounds."),
    safety: msg("Use a flat, non-slip surface and supportive shoes; build up slowly if your calves feel tight.") },
  box: { trains: msg("Shoulders, core rotation, coordination and speed."),
    steps: [msg("Guard up: fists by your chin, elbows in, feet shoulder-width, one foot forward."), msg("Jab: snap the front hand straight out and back."),
      msg("Cross: turn your back hip and shoulder to drive the rear hand straight."), msg("Return each fist to your chin right away.")],
    mistakes: [{ mistake: msg("Dropping the guard"), fix: msg("Bring each hand straight back to your chin.") },
      { mistake: msg("Locking the elbow hard"), fix: msg("Punch to almost straight; never snap the joint.") },
      { mistake: msg("Punching with the arm only"), fix: msg("Turn your hips and back foot on the cross.") }],
    drill: msg("Practice: rounds of 1 minute jab-cross, 30 seconds rest, 5 rounds."),
    safety: msg("Warm up your shoulders first and keep punches controlled; no full lock at the elbow.") },
  cricket: { trains: msg("Rotation, timing, hand-eye coordination and balance."),
    steps: [msg("Stance: side-on, feet shoulder-width, eyes level, hands together."), msg("Backlift: lift the hands back and up with a high elbow."),
      msg("Drive: step towards the ball and bring the hands down straight through the line."), msg("Follow through high, head still and over the front knee.")],
    mistakes: [{ mistake: msg("Head falling away"), fix: msg("Keep your head still and over your front knee.") },
      { mistake: msg("Swinging across the line"), fix: msg("Bring the hands straight down, like a pendulum.") },
      { mistake: msg("No front-foot step"), fix: msg("Step to the pitch of the ball before you drive.") }],
    drill: msg("Practice: 3 sets of 10 slow shadow drives, then 10 at match speed."),
    safety: msg("Clear the space around you and warm up your back and shoulders before full-speed swings.") },
  badminton: { trains: msg("Shoulder power, wrist speed, footwork and reaction."),
    steps: [msg("Ready: side-on, racket hand up, weight on the back foot."), msg("Racket back: elbow high, racket behind your head, other arm pointing up."),
      msg("Contact high: reach up and hit the shuttle in front of you at full stretch."), msg("Smash down and through, letting your body turn and step forward.")],
    mistakes: [{ mistake: msg("Hitting too low"), fix: msg("Reach up and meet the shuttle as high as you can.") },
      { mistake: msg("Arm only, no body turn"), fix: msg("Turn your hips and shoulders into the shot.") },
      { mistake: msg("Contact behind the head"), fix: msg("Move your feet so the shuttle is in front of you.") }],
    drill: msg("Practice: 3 sets of 8 shadow smashes, focusing on a high contact point."),
    safety: msg("Warm up your shoulder with arm circles; stop if your shoulder or elbow hurts.") },
};

localized(Object.values(PATTERNS), ["title", "steps", "breath"]);
localizedMap(SET_FIX as Record<string, string>);
localized(Object.values(PATTERNS).flatMap(p => p.mistakes), ["mistake", "fix"]);
localized(Object.values(SPORT_COACH), ["trains", "steps", "drill", "safety"]);
localized(Object.values(SPORT_COACH).flatMap(s => s.mistakes), ["mistake", "fix"]);

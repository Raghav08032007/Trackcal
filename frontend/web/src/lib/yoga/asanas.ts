import { localized, localizedMap, msg } from "../i18n";
import type { Move, Pose } from "../pose/exercise-motions";

/** Yoga asanas the camera can check. Names, order of steps and cautions follow the Ministry of AYUSH Common Yoga Protocol
 *  and standard teaching; the wording is TrackCal's own. Each asana's demo pose (joint angles, drawn by the stick-figure
 *  demo and later the 3D coach) is also its target: the camera measures the person exactly the way it measures the demo
 *  (lib/yoga/score.ts), so what is shown is what is scored.
 *
 *  Pose angles (lib/pose/exercise-motions.ts): torso 0 is upright, 90 lying along the floor, 180 upside down; arms and legs
 *  0 point down, 90 forward (side view) or out to the right (front view), 180 straight up. Side view: the person faces right.
 *  Front view: index 0 is the person's left side, drawn on the left, so its "out" is negative. */
export type AsanaFamily = "standing" | "balance" | "seated" | "prone" | "supine" | "kneeling" | "inversion";
export type AsanaLevel = 1 | 2 | 3;
export type Asana = {
  id: string; sanskrit: string; english: string; family: AsanaFamily; level: AsanaLevel;
  /** Seconds to hold for a beginner; each side when the pose has two. */
  hold: number; sides: boolean;
  pose: Pose; view: Move["view"]; anchor: Move["anchor"];
  /** Which way the camera should see the person, in words. */
  setup: string; steps: string[]; benefits: string; avoid: string; breath: string; easier: string;
  /** Joints the camera cannot judge in this pose (the twist of a lotus, the hands of a prayer); said once, never scored. */
  unseen?: string;
};

export const FAMILIES: Record<AsanaFamily, string> = {
  standing: msg("Standing"), balance: msg("Balance"), seated: msg("Seated"), kneeling: msg("Kneeling"),
  prone: msg("Lying on the front"), supine: msg("Lying on the back"), inversion: msg("Inversions"),
};
export const LEVELS: Record<AsanaLevel, string> = { 1: msg("Beginner"), 2: msg("Intermediate"), 3: msg("Advanced") };

const both = (v: number): [number, number] => [v, v];
const SIDE_ON = msg("Stand side-on to the camera, whole body in view.");
const FACING = msg("Face the camera, whole body in view, with room to step wide.");
const FLOOR_SIDE = msg("Mat side-on to the camera, phone low, whole body in view.");
const FLOOR_FRONT = msg("Sit facing the camera, phone at chest height.");
const BACK_KNEES = msg("Back, knee or recent abdominal surgery, or pregnancy: ask your doctor first.");
const BLOOD = msg("High blood pressure, heart disease, glaucoma or a recent eye operation: skip this pose.");
const BALANCE = msg("Vertigo or poor balance: stand next to a wall or chair.");

const A = (a: Asana) => a;
export const ASANAS: Asana[] = [
  // ── standing ───────────────────────────────────────────────────────────────
  A({ id: "tadasana", sanskrit: "Tadasana", english: msg("Mountain pose"), family: "standing", level: 1, hold: 30, sides: false, view: "front", anchor: "foot",
    pose: { arm: [-4, 4], fore: [-4, 4] }, setup: FACING,
    steps: [msg("Stand with feet together or hip-width apart, weight even on both feet."), msg("Lift the kneecaps gently, lengthen the spine, relax the shoulders."), msg("Let the arms hang by your sides, palms facing in."), msg("Look straight ahead and breathe evenly.")],
    benefits: msg("Better posture and body awareness; the starting point of every standing pose."), avoid: msg("Dizziness: keep the feet hip-width apart."),
    breath: msg("Breathe slowly through the nose."), easier: msg("Stand with your back against a wall.") }),
  A({ id: "urdhva-hastasana", sanskrit: "Urdhva Hastasana", english: msg("Raised arms pose"), family: "standing", level: 1, hold: 20, sides: false, view: "side", anchor: "foot",
    pose: { torso: -8, arm: both(-172), fore: both(-172) }, setup: SIDE_ON,
    steps: [msg("Stand tall in mountain pose."), msg("Breathing in, raise both arms overhead, palms facing each other."), msg("Lengthen up through the fingertips and lean back only slightly."), msg("Breathing out, lower the arms.")],
    benefits: msg("Stretches the shoulders, chest and belly; opens the breath."), avoid: msg("Shoulder injury: raise the arms only as far as is comfortable."),
    breath: msg("Breathe in as the arms rise, out as they come down."), easier: msg("Keep the arms shoulder-width apart and do not lean back.") }),
  A({ id: "utkatasana", sanskrit: "Utkatasana", english: msg("Chair pose"), family: "standing", level: 1, hold: 20, sides: false, view: "side", anchor: "foot",
    pose: { torso: 32, thigh: both(68), shin: both(-28), arm: both(155), fore: both(155) }, setup: SIDE_ON,
    steps: [msg("Stand with feet together or hip-width apart."), msg("Bend the knees and sit back as if onto a chair, knees over the ankles."), msg("Raise the arms alongside the ears."), msg("Keep the chest lifted and the weight in the heels.")],
    benefits: msg("Strengthens thighs, hips and back; builds stamina."), avoid: msg("Knee pain: sit back less deeply."),
    breath: msg("Breathe steadily; do not hold the breath."), easier: msg("Keep the hands on the hips and bend less.") }),
  A({ id: "trikonasana", sanskrit: "Trikonasana", english: msg("Triangle pose"), family: "standing", level: 1, hold: 20, sides: true, view: "front", anchor: "foot",
    pose: { torso: 72, thigh: [-32, 32], shin: [-32, 32], arm: [-170, 14], fore: [-170, 14] }, setup: FACING,
    steps: [msg("Step the feet wide apart, about one leg-length."), msg("Turn the right foot out; keep both legs straight."), msg("Reach the arms out, then bend sideways over the right leg, right hand towards the shin or floor."), msg("Raise the left arm straight up and look at the left hand. Repeat on the other side.")],
    benefits: msg("Stretches the sides of the body, hamstrings and hips; strengthens the legs."), avoid: msg("Neck problems: look straight ahead instead of up. Low blood pressure: come up slowly."),
    breath: msg("Breathe out as you bend, breathe evenly while you hold."), easier: msg("Rest the lower hand on the knee or a block.") }),
  A({ id: "virabhadrasana-1", sanskrit: "Virabhadrasana I", english: msg("Warrior I"), family: "standing", level: 2, hold: 20, sides: true, view: "side", anchor: "foot",
    pose: { thigh: [82, -32], shin: [-4, -32], arm: both(-176), fore: both(-176) }, setup: SIDE_ON,
    steps: [msg("Step one foot a long stride back, back foot turned slightly out."), msg("Bend the front knee over the ankle; keep the back leg straight."), msg("Square the hips forward and raise the arms overhead."), msg("Lift the chest and look forward. Repeat on the other side.")],
    benefits: msg("Strengthens legs and back; opens the hips and chest."), avoid: msg("Knee pain: bend the front knee less. Shoulder problems: hands on the hips."),
    breath: msg("Breathe in to lengthen, breathe out to sink a little deeper."), easier: msg("Take a shorter stride and keep the hands on the hips.") }),
  A({ id: "virabhadrasana-2", sanskrit: "Virabhadrasana II", english: msg("Warrior II"), family: "standing", level: 1, hold: 20, sides: true, view: "front", anchor: "foot",
    pose: { thigh: [-45, 70], shin: [-45, -5], arm: [-92, 92], fore: [-92, 92] }, setup: FACING,
    steps: [msg("Step the feet wide apart; turn the right foot out."), msg("Bend the right knee over the right ankle; keep the left leg straight."), msg("Stretch the arms out at shoulder height, parallel to the floor."), msg("Look over the right hand. Repeat on the other side.")],
    benefits: msg("Strengthens legs and shoulders; builds focus and stamina."), avoid: msg("Knee pain: bend less. Neck problems: look straight ahead."),
    breath: msg("Breathe evenly through the nose."), easier: msg("Bend the front knee less and take a shorter stance.") }),
  A({ id: "virabhadrasana-3", sanskrit: "Virabhadrasana III", english: msg("Warrior III"), family: "balance", level: 3, hold: 10, sides: true, view: "side", anchor: "foot",
    pose: { torso: 88, thigh: [-88, 0], shin: [-88, 0], arm: both(92), fore: both(92) }, setup: SIDE_ON,
    steps: [msg("From standing, shift the weight onto one leg."), msg("Lean the body forward while lifting the other leg straight behind you."), msg("Reach the arms forward so arms, body and lifted leg make one line."), msg("Keep the hips level. Repeat on the other side.")],
    benefits: msg("Strengthens the standing leg, back and core; trains balance."), avoid: BALANCE,
    breath: msg("Breathe steadily; a held breath makes balance harder."), easier: msg("Hands on a wall or chair in front of you.") }),
  A({ id: "parsvakonasana", sanskrit: "Utthita Parsvakonasana", english: msg("Extended side angle"), family: "standing", level: 2, hold: 20, sides: true, view: "front", anchor: "foot",
    pose: { torso: 58, thigh: [-45, 70], shin: [-45, -5], arm: [128, 28], fore: [128, 28] }, setup: FACING,
    steps: [msg("Start in Warrior II with the right knee bent."), msg("Rest the right forearm on the right thigh."), msg("Reach the left arm up and over the ear, making one line from the left foot to the fingers."), msg("Turn the chest open. Repeat on the other side.")],
    benefits: msg("Stretches the side body and groin; strengthens the legs."), avoid: msg("Neck problems: look forward, not up."),
    breath: msg("Breathe into the stretched side."), easier: msg("Keep the forearm on the thigh and the top hand on the hip.") }),
  A({ id: "prasarita-padottanasana", sanskrit: "Prasarita Padottanasana", english: msg("Wide-legged forward fold"), family: "standing", level: 2, hold: 20, sides: false, view: "front", anchor: "foot",
    pose: { torso: 172, thigh: [-30, 30], shin: [-30, 30], arm: [-4, 4], fore: [-4, 4] }, setup: FACING,
    steps: [msg("Step the feet wide apart, toes pointing forward."), msg("Hands on the hips, lengthen the spine."), msg("Fold forward from the hips and place the hands on the floor between the feet."), msg("Let the head hang. Come up slowly with a straight back.")],
    benefits: msg("Stretches the hamstrings and inner legs; calms the mind."), avoid: BLOOD,
    breath: msg("Breathe out as you fold."), easier: msg("Rest the hands on blocks or a chair.") }),
  A({ id: "uttanasana", sanskrit: "Uttanasana / Padahastasana", english: msg("Standing forward fold"), family: "standing", level: 1, hold: 20, sides: false, view: "side", anchor: "foot",
    pose: { torso: 150, arm: both(5), fore: both(5) }, setup: SIDE_ON,
    steps: [msg("Stand with feet together."), msg("Breathing out, fold forward from the hips, not the waist."), msg("Bring the hands to the floor beside the feet, or hold the legs."), msg("Relax the neck. Come up slowly.")],
    benefits: msg("Stretches the hamstrings and back; calms the mind."), avoid: BLOOD,
    breath: msg("Breathe out as you fold; breathe gently while you hold."), easier: msg("Bend the knees as much as you need.") }),
  A({ id: "ardha-uttanasana", sanskrit: "Ardha Uttanasana", english: msg("Half forward fold"), family: "standing", level: 1, hold: 10, sides: false, view: "side", anchor: "foot",
    pose: { torso: 88, arm: both(0), fore: both(0) }, setup: SIDE_ON,
    steps: [msg("From a forward fold, place the hands on the shins."), msg("Lift the chest until the back is flat, parallel to the floor."), msg("Look a little ahead of you on the floor.")],
    benefits: msg("Strengthens the back; stretches the hamstrings."), avoid: msg("Lower back pain: bend the knees."),
    breath: msg("Breathe in as you lift."), easier: msg("Hands on the thighs, knees soft.") }),
  A({ id: "ardha-chakrasana", sanskrit: "Ardha Chakrasana", english: msg("Standing back bend"), family: "standing", level: 1, hold: 10, sides: false, view: "side", anchor: "foot",
    pose: { torso: -24, arm: both(-28), fore: both(48) }, setup: SIDE_ON,
    steps: [msg("Stand with feet together, hands supporting the lower back, fingers pointing down."), msg("Breathing in, bend backwards from the waist."), msg("Let the head move back gently."), msg("Breathing out, come back up.")],
    benefits: msg("Opens the chest; strengthens the back."), avoid: msg("Vertigo, high blood pressure or back problems: bend only a little."),
    breath: msg("Breathe in as you bend back."), easier: msg("Bend back only slightly, looking forward.") }),
  A({ id: "malasana", sanskrit: "Malasana", english: msg("Garland squat"), family: "standing", level: 2, hold: 20, sides: false, view: "front", anchor: "foot",
    pose: { thigh: [-112, 112], shin: [18, -18], arm: [-28, 28], fore: [150, -150] }, setup: FACING,
    steps: [msg("Stand with feet a little wider than the hips, toes turned out."), msg("Bend the knees and squat down low, heels down if possible."), msg("Bring the palms together at the chest, elbows pressing the knees apart."), msg("Lengthen the spine.")],
    benefits: msg("Opens the hips; strengthens the ankles; helps digestion."), avoid: msg("Knee or ankle injury: skip or sit on a block."),
    breath: msg("Breathe deeply into the belly."), easier: msg("Sit on a block or a thick book.") }),
  // ── balance ────────────────────────────────────────────────────────────────
  A({ id: "vrikshasana", sanskrit: "Vrikshasana", english: msg("Tree pose"), family: "balance", level: 1, hold: 20, sides: true, view: "front", anchor: "hip",
    pose: { thigh: [0, 60], shin: [0, -80], arm: [-170, 170], fore: [-170, 170] }, setup: FACING,
    steps: [msg("Stand tall; shift the weight onto the left foot."), msg("Place the right sole on the inner left thigh or calf, never on the knee."), msg("Bring the palms together and raise the arms overhead."), msg("Fix your gaze on one point. Repeat on the other side.")],
    benefits: msg("Improves balance and focus; strengthens ankles and legs."), avoid: BALANCE,
    breath: msg("Breathe slowly; keep the gaze still."), easier: msg("Rest the foot on the ankle with toes on the floor, hands at the chest.") }),
  A({ id: "natarajasana", sanskrit: "Natarajasana", english: msg("Dancer pose"), family: "balance", level: 3, hold: 10, sides: true, view: "side", anchor: "foot",
    pose: { torso: 48, thigh: [-55, 0], shin: [-165, 0], arm: [-150, 120], fore: [-150, 120] }, setup: SIDE_ON,
    steps: [msg("Stand on the left leg; bend the right knee and hold the right foot behind you."), msg("Reach the left arm forward and up."), msg("Kick the foot back into the hand and tip the body forward."), msg("Hold steady. Repeat on the other side.")],
    benefits: msg("Balance, focus and a strong, open front body."), avoid: BALANCE,
    breath: msg("Breathe evenly; do not hold the breath."), easier: msg("Hold a wall with the front hand and lift the foot less.") }),
  A({ id: "ardha-chandrasana", sanskrit: "Ardha Chandrasana", english: msg("Half moon"), family: "balance", level: 3, hold: 10, sides: true, view: "front", anchor: "foot",
    pose: { torso: 86, thigh: [-88, 0], shin: [-88, 0], arm: [-178, 4], fore: [-178, 4] }, setup: FACING,
    steps: [msg("From triangle pose, bend the front knee and place the hand on the floor ahead of the foot."), msg("Straighten the front leg while lifting the back leg to hip height."), msg("Open the chest and raise the top arm."), msg("Repeat on the other side.")],
    benefits: msg("Balance, strong legs and an open chest."), avoid: BALANCE,
    breath: msg("Breathe steadily."), easier: msg("Lower hand on a block; back against a wall.") }),
  // ── kneeling ───────────────────────────────────────────────────────────────
  A({ id: "vajrasana", sanskrit: "Vajrasana", english: msg("Thunderbolt pose"), family: "kneeling", level: 1, hold: 60, sides: false, view: "side", anchor: "foot",
    pose: { thigh: both(88), shin: both(-88), arm: both(25), fore: both(60) }, setup: FLOOR_SIDE,
    steps: [msg("Kneel with the knees together and sit back on the heels."), msg("Rest the hands on the thighs."), msg("Keep the back straight and the head level."), msg("Close the eyes and breathe.")],
    benefits: msg("A steady seat for breathing; traditionally done after meals to help digestion."), avoid: msg("Knee or ankle problems: put a cushion between hips and heels."),
    breath: msg("Breathe slowly and evenly."), easier: msg("Sit on a cushion placed on the heels.") }),
  A({ id: "ustrasana", sanskrit: "Ustrasana", english: msg("Camel pose"), family: "kneeling", level: 2, hold: 15, sides: false, view: "side", anchor: "foot",
    pose: { torso: -38, thigh: both(0), shin: both(-88), arm: both(-12), fore: both(-12) }, setup: FLOOR_SIDE,
    steps: [msg("Kneel with the knees hip-width apart, thighs upright."), msg("Hands on the lower back, lift the chest."), msg("Lean back and reach the hands to the heels one at a time."), msg("Keep the hips over the knees. Come up slowly.")],
    benefits: msg("Opens the chest and the front of the body; strengthens the back."), avoid: msg("Back or neck injury, high or low blood pressure: skip this pose."),
    breath: msg("Breathe into the chest."), easier: msg("Keep the hands on the lower back.") }),
  A({ id: "balasana", sanskrit: "Balasana / Shashankasana", english: msg("Child's pose"), family: "kneeling", level: 1, hold: 30, sides: false, view: "side", anchor: "foot",
    pose: { torso: 112, thigh: both(80), shin: both(-88), arm: both(102), fore: both(102) }, setup: FLOOR_SIDE,
    steps: [msg("Kneel and sit back on the heels."), msg("Fold forward and rest the forehead on the floor."), msg("Stretch the arms forward or rest them beside the body."), msg("Relax completely.")],
    benefits: msg("Rests the back and calms the mind."), avoid: msg("Knee injury or pregnancy: widen the knees or skip."),
    breath: msg("Breathe slowly into the back."), easier: msg("Put a cushion under the forehead or hips.") }),
  A({ id: "marjaryasana", sanskrit: "Marjaryasana-Bitilasana", english: msg("Cat-cow (tabletop)"), family: "kneeling", level: 1, hold: 20, sides: false, view: "side", anchor: "foot",
    pose: { torso: 88, thigh: both(0), shin: both(-88), arm: both(0), fore: both(0) }, setup: FLOOR_SIDE,
    steps: [msg("Come onto hands and knees: hands under shoulders, knees under hips."), msg("Breathing in, drop the belly and look up (cow)."), msg("Breathing out, round the back and tuck the chin (cat)."), msg("Move slowly with the breath.")],
    benefits: msg("Loosens the spine; relieves back stiffness."), avoid: msg("Wrist or knee pain: rest on fists or add padding."),
    breath: msg("Breathe in to arch, out to round."), easier: msg("Make the movement smaller."),
    unseen: msg("The camera checks the tabletop position; the arching and rounding of the back are yours to feel.") }),
  A({ id: "anjaneyasana", sanskrit: "Anjaneyasana", english: msg("Low lunge"), family: "kneeling", level: 1, hold: 20, sides: true, view: "side", anchor: "foot",
    pose: { thigh: [80, -42], shin: [0, -88], arm: both(-175), fore: both(-175) }, setup: FLOOR_SIDE,
    steps: [msg("From a lunge, lower the back knee to the floor."), msg("Front knee over the ankle."), msg("Raise the arms overhead and lift the chest."), msg("Repeat on the other side.")],
    benefits: msg("Stretches the hip flexors and thighs."), avoid: msg("Knee pain: pad the back knee."),
    breath: msg("Breathe out as the hips sink forward."), easier: msg("Hands on the front knee.") }),
  A({ id: "ashwa-sanchalanasana", sanskrit: "Ashwa Sanchalanasana", english: msg("Equestrian pose"), family: "kneeling", level: 1, hold: 10, sides: true, view: "side", anchor: "foot",
    pose: { torso: 32, thigh: [110, -62], shin: [-12, -70], arm: both(4), fore: both(4) }, setup: FLOOR_SIDE,
    steps: [msg("From a forward fold, step one leg far back."), msg("Bend the front knee deeply; back knee near or on the floor."), msg("Hands on the floor beside the front foot."), msg("Lift the chest and look forward.")],
    benefits: msg("Stretches the hips and legs; part of Surya Namaskar."), avoid: msg("Knee pain: lower the back knee to a mat."),
    breath: msg("Breathe in as you step back."), easier: msg("Back knee down on padding.") }),
  // ── seated ─────────────────────────────────────────────────────────────────
  A({ id: "sukhasana", sanskrit: "Sukhasana / Padmasana", english: msg("Easy pose (cross-legged)"), family: "seated", level: 1, hold: 60, sides: false, view: "front", anchor: "foot",
    pose: { thigh: [-74, 74], shin: [82, -82], arm: [-26, 26], fore: [30, -30] }, setup: FLOOR_FRONT,
    steps: [msg("Sit with the legs crossed, each foot under the opposite knee (or on the thigh for lotus)."), msg("Hands rest on the knees."), msg("Lengthen the spine and relax the shoulders."), msg("Close the eyes and breathe.")],
    benefits: msg("A comfortable seat for breathing and meditation."), avoid: msg("Knee pain: sit on a cushion; never force lotus."),
    breath: msg("Breathe slowly and evenly."), easier: msg("Sit on a folded blanket, or on a chair."),
    unseen: msg("The camera checks a tall, steady seat; it cannot see which foot is on top.") }),
  A({ id: "dandasana", sanskrit: "Dandasana", english: msg("Staff pose"), family: "seated", level: 1, hold: 30, sides: false, view: "side", anchor: "foot",
    pose: { thigh: both(90), shin: both(90), arm: both(2), fore: both(2) }, setup: FLOOR_SIDE,
    steps: [msg("Sit with the legs straight out in front, feet together."), msg("Palms on the floor beside the hips."), msg("Sit tall with the back straight, toes pointing up.")],
    benefits: msg("Strengthens the back; improves sitting posture."), avoid: msg("Lower back pain: sit on a folded blanket."),
    breath: msg("Breathe evenly."), easier: msg("Bend the knees slightly; sit on a blanket.") }),
  A({ id: "paschimottanasana", sanskrit: "Paschimottanasana", english: msg("Seated forward bend"), family: "seated", level: 2, hold: 30, sides: false, view: "side", anchor: "foot",
    pose: { torso: 68, thigh: both(90), shin: both(90), arm: both(84), fore: both(84) }, setup: FLOOR_SIDE,
    steps: [msg("Sit in staff pose."), msg("Breathing in, raise the arms; breathing out, fold forward from the hips."), msg("Hold the shins, ankles or feet."), msg("Keep the back long rather than rounding.")],
    benefits: msg("Stretches the back and hamstrings; calms the mind."), avoid: msg("Slipped disc or sciatica: skip. Pregnancy: skip."),
    breath: msg("Breathe out to fold a little further."), easier: msg("Bend the knees; use a strap around the feet.") }),
  A({ id: "baddha-konasana", sanskrit: "Baddha Konasana", english: msg("Butterfly pose"), family: "seated", level: 1, hold: 30, sides: false, view: "front", anchor: "foot",
    pose: { thigh: [-84, 84], shin: [70, -70], arm: [-12, 12], fore: [12, -12] }, setup: FLOOR_FRONT,
    steps: [msg("Sit and bring the soles of the feet together."), msg("Hold the feet and let the knees drop to the sides."), msg("Sit tall."), msg("Gently move the knees up and down, or hold still.")],
    benefits: msg("Opens the hips and groin."), avoid: msg("Groin or knee injury: support the knees with cushions."),
    breath: msg("Breathe slowly into the hips."), easier: msg("Sit on a cushion; feet further from the body.") }),
  A({ id: "navasana", sanskrit: "Navasana", english: msg("Boat pose"), family: "seated", level: 2, hold: 10, sides: false, view: "side", anchor: "hip",
    pose: { torso: -38, thigh: both(140), shin: both(140), arm: both(92), fore: both(92) }, setup: FLOOR_SIDE,
    steps: [msg("Sit with the knees bent, feet on the floor."), msg("Lean back slightly and lift the feet."), msg("Straighten the legs if you can, making a V shape."), msg("Reach the arms forward.")],
    benefits: msg("Strengthens the core and hip flexors."), avoid: msg("Lower back pain, pregnancy or recent surgery: skip."),
    breath: msg("Keep breathing; do not hold the breath."), easier: msg("Keep the knees bent, shins parallel to the floor.") }),
  // ── lying on the front ─────────────────────────────────────────────────────
  A({ id: "phalakasana", sanskrit: "Phalakasana", english: msg("Plank pose"), family: "prone", level: 1, hold: 20, sides: false, view: "side", anchor: "hand",
    pose: { torso: 76, thigh: both(-76), shin: both(-76) }, setup: FLOOR_SIDE,
    steps: [msg("Hands under the shoulders, step the feet back."), msg("Make one straight line from head to heels."), msg("Press the floor away; tighten the belly.")],
    benefits: msg("Strengthens the core, shoulders and arms."), avoid: msg("Wrist or shoulder injury: do it on the forearms."),
    breath: msg("Breathe steadily."), easier: msg("Knees down on the mat.") }),
  A({ id: "ashtanga-namaskara", sanskrit: "Ashtanga Namaskara", english: msg("Eight-limbed salute"), family: "prone", level: 2, hold: 5, sides: false, view: "side", anchor: "hand",
    pose: { torso: 104, thigh: both(-82), shin: both(-90), arm: both(-140), fore: both(22) }, setup: FLOOR_SIDE,
    steps: [msg("From plank, lower the knees to the floor."), msg("Lower the chest and chin between the hands, hips slightly raised."), msg("Toes, knees, chest, hands and chin touch the floor.")],
    benefits: msg("Strengthens the arms and back; part of Surya Namaskar."), avoid: msg("Neck or back injury: lower all the way down instead."),
    breath: msg("Hold the breath out briefly, or breathe gently."), easier: msg("Lower the whole body to the floor.") }),
  A({ id: "bhujangasana", sanskrit: "Bhujangasana", english: msg("Cobra pose"), family: "prone", level: 1, hold: 15, sides: false, view: "side", anchor: "foot",
    pose: { torso: 48, thigh: both(-90), shin: both(-90), arm: both(-12), fore: both(-12) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the front, hands under the shoulders, legs together."), msg("Breathing in, lift the head and chest, keeping the navel on the floor."), msg("Elbows stay close to the body, slightly bent."), msg("Breathing out, come down slowly.")],
    benefits: msg("Strengthens the back; opens the chest."), avoid: msg("Pregnancy, hernia, recent abdominal surgery or back injury: skip."),
    breath: msg("Breathe in as you rise."), easier: msg("Rest on the forearms (sphinx pose).") }),
  A({ id: "urdhva-mukha-svanasana", sanskrit: "Urdhva Mukha Svanasana", english: msg("Upward-facing dog"), family: "prone", level: 2, hold: 10, sides: false, view: "side", anchor: "foot",
    pose: { torso: 28, thigh: both(-80), shin: both(-88), arm: both(-4), fore: both(-4) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the front, hands beside the lower ribs."), msg("Straighten the arms and lift the chest, thighs and knees off the floor."), msg("Only the hands and the tops of the feet touch the floor."), msg("Shoulders down, away from the ears.")],
    benefits: msg("Strengthens arms and back; opens the chest."), avoid: msg("Back or wrist injury, pregnancy: do cobra instead."),
    breath: msg("Breathe in to rise."), easier: msg("Do cobra pose.") }),
  A({ id: "shalabhasana", sanskrit: "Shalabhasana", english: msg("Locust pose"), family: "prone", level: 2, hold: 10, sides: false, view: "side", anchor: "hip",
    pose: { torso: 78, thigh: both(-78), shin: both(-78), arm: both(-82), fore: both(-82) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the front, arms by the sides, palms down."), msg("Breathing in, lift the head, chest and legs off the floor."), msg("Keep the legs straight and together."), msg("Breathing out, come down.")],
    benefits: msg("Strengthens the back, glutes and legs."), avoid: msg("Back injury, heart problems or pregnancy: skip."),
    breath: msg("Breathe in to lift; keep breathing while you hold."), easier: msg("Lift one leg at a time.") }),
  A({ id: "dhanurasana", sanskrit: "Dhanurasana", english: msg("Bow pose"), family: "prone", level: 3, hold: 10, sides: false, view: "side", anchor: "hip",
    pose: { torso: 62, thigh: both(-68), shin: both(-158), arm: both(-128), fore: both(-128) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the front; bend the knees and hold the ankles."), msg("Breathing in, lift the chest and thighs by pulling the feet back."), msg("Look forward; balance on the belly."), msg("Breathing out, release slowly.")],
    benefits: msg("Opens the whole front body; strengthens the back."), avoid: msg("Back or neck problems, hernia, high blood pressure or pregnancy: skip."),
    breath: msg("Breathe in to lift."), easier: msg("Hold one ankle at a time.") }),
  A({ id: "makarasana", sanskrit: "Makarasana", english: msg("Crocodile pose"), family: "prone", level: 1, hold: 60, sides: false, view: "side", anchor: "hip",
    pose: { torso: 90, thigh: both(-90), shin: both(-90), arm: both(150), fore: both(30) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the front with the feet apart, heels turned in."), msg("Fold the arms and rest the forehead on them."), msg("Relax the whole body and breathe into the belly.")],
    benefits: msg("Relaxes the back; a resting pose between back bends."), avoid: msg("Pregnancy: rest on the side instead."),
    breath: msg("Breathe slowly into the belly."), easier: msg("Cushion under the chest.") }),
  // ── lying on the back ──────────────────────────────────────────────────────
  A({ id: "setu-bandhasana", sanskrit: "Setu Bandhasana", english: msg("Bridge pose"), family: "supine", level: 1, hold: 20, sides: false, view: "side", anchor: "shoulder",
    pose: { torso: -112, thigh: both(108), shin: both(10), arm: both(95), fore: both(95) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the back, knees bent, feet flat and hip-width apart."), msg("Arms by the sides, palms down."), msg("Breathing in, lift the hips as high as is comfortable."), msg("Breathing out, roll down slowly.")],
    benefits: msg("Strengthens the back, glutes and legs; opens the chest."), avoid: msg("Neck injury: skip."),
    breath: msg("Breathe in to lift."), easier: msg("Lift the hips only a little.") }),
  A({ id: "pawanmuktasana", sanskrit: "Pawanmuktasana", english: msg("Knees-to-chest pose"), family: "supine", level: 1, hold: 20, sides: false, view: "side", anchor: "hip",
    pose: { torso: -88, thigh: both(-150), shin: both(30), arm: both(140), fore: both(100) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the back."), msg("Bend both knees and hug them to the chest."), msg("Keep the head on the floor, or lift it towards the knees."), msg("Breathe and gently rock if it feels good.")],
    benefits: msg("Relieves wind and lower back tension."), avoid: msg("Pregnancy, hernia or recent abdominal surgery: skip."),
    breath: msg("Breathe out as you hug the knees in."), easier: msg("One knee at a time.") }),
  A({ id: "matsyasana", sanskrit: "Matsyasana", english: msg("Fish pose"), family: "supine", level: 2, hold: 15, sides: false, view: "side", anchor: "hip",
    pose: { torso: -64, thigh: both(90), shin: both(90), arm: both(98), fore: both(98) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the back, legs straight, hands under the hips."), msg("Press the forearms down and lift the chest."), msg("Let the top of the head rest lightly on the floor."), msg("Come down slowly.")],
    benefits: msg("Opens the chest and throat; counters forward bends."), avoid: msg("Neck injury, migraine or high blood pressure: skip."),
    breath: msg("Breathe deeply into the chest."), easier: msg("Support the back with a cushion.") }),
  A({ id: "shavasana", sanskrit: "Shavasana", english: msg("Relaxation pose"), family: "supine", level: 1, hold: 180, sides: false, view: "side", anchor: "hip",
    pose: { torso: -88, thigh: both(92), shin: both(92), arm: both(95), fore: both(95) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the back, legs slightly apart, arms a little away from the body, palms up."), msg("Close the eyes."), msg("Relax each part of the body from the toes to the head."), msg("Let the breath be natural.")],
    benefits: msg("Deep rest; lowers stress."), avoid: msg("Pregnancy, later months: lie on the left side."),
    breath: msg("Natural, easy breath."), easier: msg("Cushion under the knees.") }),
  // ── inversions ─────────────────────────────────────────────────────────────
  A({ id: "adho-mukha-svanasana", sanskrit: "Adho Mukha Svanasana / Parvatasana", english: msg("Downward-facing dog"), family: "inversion", level: 1, hold: 20, sides: false, view: "side", anchor: "hand",
    pose: { torso: 130, thigh: both(-50), shin: both(-50), arm: both(30), fore: both(30) }, setup: FLOOR_SIDE,
    steps: [msg("From hands and knees, tuck the toes."), msg("Lift the hips up and back into an upside-down V."), msg("Press the hands into the floor; let the head hang between the arms."), msg("Heels reach towards the floor.")],
    benefits: msg("Stretches the hamstrings, calves and shoulders; strengthens the arms."), avoid: BLOOD,
    breath: msg("Breathe steadily."), easier: msg("Bend the knees.") }),
  A({ id: "sarvangasana", sanskrit: "Sarvangasana", english: msg("Shoulder stand"), family: "inversion", level: 3, hold: 15, sides: false, view: "side", anchor: "shoulder",
    pose: { torso: 176, thigh: both(178), shin: both(178), arm: both(-90), fore: both(-90) }, setup: FLOOR_SIDE,
    steps: [msg("Lie on the back; lift the legs and hips, supporting the back with the hands."), msg("Straighten the body upwards, resting on the shoulders, not the neck."), msg("Keep the chin towards the chest; do not turn the head."), msg("Come down slowly, one vertebra at a time.")],
    benefits: msg("A traditional inversion for steadiness and calm."), avoid: msg("Neck problems, high blood pressure, heart disease, glaucoma, during menstruation or pregnancy: skip. Learn it with a teacher first."),
    breath: msg("Breathe slowly into the belly."), easier: msg("Legs up a wall, lying on the back.") }),
  A({ id: "pranamasana", sanskrit: "Pranamasana", english: msg("Prayer pose"), family: "standing", level: 1, hold: 10, sides: false, view: "side", anchor: "foot",
    pose: { arm: both(28), fore: both(150) }, setup: SIDE_ON,
    steps: [msg("Stand tall with feet together."), msg("Bring the palms together in front of the chest."), msg("Relax the shoulders and breathe.")],
    benefits: msg("A calm start and end for Surya Namaskar."), avoid: msg("None in particular."),
    breath: msg("Breathe evenly."), easier: msg("Feet hip-width apart."),
    unseen: msg("The camera checks a tall stance with the hands at the chest; it cannot see the palms touch.") }),
];

export const ASANA_BY_ID: Record<string, Asana> = Object.fromEntries(ASANAS.map(a => [a.id, a]));
export const moveOf = (a: Asana): Move => ({ view: a.view, anchor: a.anchor, keys: [a.pose] });

localized(ASANAS, ["english", "setup", "steps", "benefits", "avoid", "breath", "easier", "unseen"]);
localizedMap(FAMILIES);
localizedMap(LEVELS);

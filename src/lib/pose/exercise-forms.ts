import type {Body,BodyPart} from './body-shape';
import type {ExerciseKind} from './types';
/** What makes each exercise itself. The joint angle alone cannot: a curl and a press bend the same elbow, a squat and
 *  a bow drop the same shoulders. A rep only counts if the whole body matched.
 *  Every check is written as "this is wrong", so a body part out of view (NaN) can never fail it. */
export type ExerciseForm={
 /** Wrong for a large share of the rep. */
 never?:(b:Body)=>boolean;
 /** Never part of this exercise: a few frames of it end the rep, like a plank in the middle of a squat. */
 banned?:(b:Body)=>boolean;
 /** Wrong for most of the deepest part of the rep. */
 atBottom?:(b:Body)=>boolean;
 /** Must be seen at least once in a rep, like a hand overhead. Written the same way round: true means it happened or can't be seen. */
 reaches?:(b:Body)=>boolean;
 /** Parts that must stay put during a rep, with how far they may drift in torso lengths. */
 still?:Partial<Record<BodyPart,number>>;
 /** Parts that must really move during a rep, with the least they must travel in torso lengths. */
 moves?:Partial<Record<BodyPart,number>>;
};
const either=(...checks:((b:Body)=>boolean)[])=>(b:Body)=>checks.some(check=>check(b));
// Whole-body positions.
const notUpright=(b:Body)=>b.tilt>40;
const notLying=(b:Body)=>b.tilt<50;
const notHinged=(b:Body)=>b.tilt<30&&!(b.torso<.75);
const legsBent=(b:Body)=>b.knee<125;
const legsStraight=(b:Body)=>b.kneeWide>150;
const armsOverhead=(b:Body)=>b.wristUp>.55;
const handsAbove=(b:Body)=>b.wristUp>.15;
const handsLow=(b:Body)=>b.wristUp<-.55;
const armBent=(b:Body)=>b.elbow<115;
const notFloorHands=(b:Body)=>b.wristLow>-.25;
const feetFromHands=(b:Body)=>b.handHeight>.75;
const facingAway=(b:Body)=>b.facing<.3;
const notFacing=(b:Body)=>b.facing<.35;
const sideOn=(b:Body)=>b.facing>.55;
/** A bent knee seen head-on still looks straight, so the knee only rules a squat out side-on. From the front, a bow shows as a short torso instead. */
const shallow=(b:Body)=>b.knee>125&&b.facing<.45||b.torso<.6;
const kneesDown=(b:Body)=>b.kneeUp<.15;
const SQUAT={never:(b:Body)=>b.wristUp>.3,banned:(b:Body)=>b.tilt>60&&b.handHeight<.5,atBottom:(b:Body)=>shallow(b)||b.stance>1.2,moves:{shoulders:.2}};
const SIDE_ARM={never:either(armBent,notUpright,(b)=>b.wristUp>.5),banned:(b:Body)=>b.elbow<90,atBottom:(b:Body)=>b.wristUp<-.3,reaches:(b:Body)=>!(b.wristUp>-.65),moves:{wrists:.6}};
const CURL={never:either(notUpright,legsBent,handsAbove),atBottom:handsLow,still:{hips:.35,elbows:.45},moves:{wrists:.4}};
const PUSH={still:{wrists:.3},moves:{shoulders:.12}};
const LUNGE={never:notUpright,atBottom:(b:Body)=>b.hipGap<14&&b.facing<.45||b.facing>.5&&b.stance>.8,moves:{shoulders:.15}};
const HINGE={moves:{shoulders:.3},still:{ankles:.4}};
const LIFT_HIPS={never:notLying,still:{shoulders:.35},moves:{hips:.15}};
/** Head-on, a lifted knee comes towards the camera and the hip angle hardly changes, so that check is for side-on only. */
const RAISE_KNEE={never:notUpright,atBottom:(b:Body)=>b.hipGap<20&&b.facing<.45||b.kneeWide<140||b.facing>.5&&b.stance>.7,still:{shoulders:.3},moves:{knees:.25}};
const STAND_LEG={never:either(notUpright,legsBent),still:{hips:.3,wrists:.4}};
const FOURS={never:either(notFloorHands,(b)=>b.tilt<55)};
export const EXERCISE_FORMS:Partial<Record<ExerciseKind,ExerciseForm>>={
 // Legs
 squat:SQUAT,
 sumo:{...SQUAT,never:either(SQUAT.never,notFacing),atBottom:(b)=>shallow(b)||b.stance<.8||b.kneeGap>25},
 wsquat:{...SQUAT,never:(b)=>b.wristChest>.8},
 ohsquat:{...SQUAT,never:(b)=>b.wristLow<.3},
 squatjump:{...SQUAT,moves:{ankles:.35,shoulders:.2}},
 lunge:LUNGE,
 wlunge:{...LUNGE,never:either(notUpright,(b)=>b.wristUp>-.25)},
 sidelunge:{never:notUpright,atBottom:(b)=>b.stance<.8||b.kneeGap<20||b.facing<.3},
 knee:RAISE_KNEE,
 highknee:RAISE_KNEE,
 buttkick:{never:either(notUpright,(b)=>b.hip<135),atBottom:(b)=>b.kneeWide<120,still:{shoulders:.3},moves:{ankles:.25}},
 sideleg:{never:either(notUpright,legsBent),still:{shoulders:.25},moves:{ankles:.2}},
 calf:STAND_LEG,
 wcalf:STAND_LEG,
 donkey:{...FOURS,still:{wrists:.3}},
 bridge:LIFT_HIPS,
 hipthrust:LIFT_HIPS,
 rdl:{...HINGE,never:either((b)=>b.knee<145,(b)=>b.wristUp>-.25),atBottom:notHinged},
 // Chest and shoulders
 pushup:{...PUSH,never:either(handsAbove,notLying,(b)=>b.knee<145,(b)=>b.hip<135,(b)=>b.headDown>.4,feetFromHands)},
 kneepush:{...PUSH,never:either(handsAbove,(b)=>b.tilt<40,(b)=>b.headDown>.4,feetFromHands),atBottom:legsStraight},
 incline:{...PUSH,never:either(handsAbove,(b)=>b.tilt<22,(b)=>b.tilt>80,legsBent,(b)=>b.headDown>.05,(b)=>b.handHeight<.6)},
 wallpush:{...PUSH,never:either((b)=>b.tilt>42,legsBent,handsLow,armsOverhead)},
 pikepush:{...PUSH,never:(b)=>b.headDown<.05,atBottom:(b)=>b.hip>135},
 bench:{never:either(notLying,(b)=>b.wristUp<-.2),moves:{elbows:.2}},
 press:{never:either(legsBent,notUpright,handsLow),atBottom:(b)=>b.wristUp<-.35,reaches:(b)=>!(b.wristUp<.5),still:{shoulders:.35},moves:{wrists:.4,elbows:.2}},
 thruster:{never:either(notUpright,handsLow),atBottom:(b)=>b.knee>130,reaches:(b)=>!(b.wristUp<.5),moves:{wrists:.4,shoulders:.2}},
 raise:{...SIDE_ARM,never:either(SIDE_ARM.never,facingAway)},
 front:{...SIDE_ARM,never:either(SIDE_ARM.never,sideOn),still:{shoulders:.25}},
 uprow:{never:either(notUpright,armsOverhead,notFacing),atBottom:(b)=>b.elbow>125,moves:{wrists:.4}},
 // Back
 deadlift:{...HINGE,banned:(b)=>b.wristUp>0,atBottom:(b)=>notHinged(b)||b.knee<95||b.kneeWide>155||b.wristUp>-.2},
 goodmorning:{...HINGE,never:either((b)=>b.wristChest>.8,legsBent),atBottom:notHinged},
 row:{never:either(notHinged,handsAbove,(b)=>b.handHeight<.5),still:{hips:.35,shoulders:.3},moves:{wrists:.2,elbows:.15}},
 revfly:{never:either(notHinged,armBent,(b)=>b.handHeight<.4),still:{hips:.35},moves:{wrists:.4}},
 seatrow:{never:either((b)=>b.tilt>30,(b)=>b.wristUp>.15,(b)=>b.wristUp<-.75,sideOn),atBottom:(b)=>b.wristUp>-.3,still:{hips:.25},moves:{wrists:.3}},
 superman:{never:either(notLying,legsBent),still:{hips:.25,knees:.3}},
 pullup:{never:(b)=>b.wristUp<.1,still:{wrists:.3},moves:{shoulders:.25}},
 birddog:{...FOURS,moves:{wrists:.4}},
 // Arms
 curl:CURL,
 hammer:CURL,
 conccurl:{never:either(legsStraight,armsOverhead),atBottom:(b)=>b.wristUp<-.45,still:{hips:.25},moves:{wrists:.4}},
 kickback:{never:either(notHinged,armsOverhead,(b)=>b.handHeight<.5),still:{elbows:.35,hips:.35},moves:{wrists:.25}},
 overhead:{never:either(legsBent,notUpright,(b)=>b.wristUp<-.2),still:{elbows:.4,shoulders:.3},moves:{wrists:.3}},
 skull:{never:either(notLying,(b)=>b.wristUp<-.2),still:{elbows:.25},moves:{wrists:.3}},
 dip:{never:either((b)=>b.tilt>40,(b)=>b.wristUp>-.2),atBottom:legsStraight,still:{wrists:.3},moves:{shoulders:.2}},
 // Core
 situp:{still:{ankles:.45},moves:{shoulders:.4}},
 crunch:{never:notLying,still:{hips:.25},moves:{shoulders:.1}},
 legraise:{never:either(notLying,legsBent,(b)=>b.hipGap>25),still:{shoulders:.35},moves:{knees:.35}},
 revcrunch:{never:notLying,atBottom:(b)=>b.kneeWide>125,still:{shoulders:.35},moves:{knees:.2}},
 vup:{atBottom:kneesDown,moves:{shoulders:.35,knees:.35}},
 flutter:{never:either(notLying,legsBent,(b)=>b.wristLow<-.5),atBottom:(b)=>b.hipGap<6,still:{shoulders:.3}},
 bicycle:{never:either(notLying,(b)=>b.wristLow<-.5),atBottom:(b)=>b.hipGap<20||b.kneeWide>165&&b.knee>130},
 sidebend:{never:either((b)=>b.tilt>50,notFacing),atBottom:(b)=>b.tilt<6,still:{hips:.3},moves:{shoulders:.2}},
 // Added moves with their own signature
 latpull:{never:either((b)=>b.wristUp<-.1,legsStraight),still:{shoulders:.3},moves:{wrists:.2}},
 pullover:{never:either(notLying,armBent),atBottom:feetFromHands,moves:{wrists:.5}},
 legext:{never:either(notUpright,(b)=>b.hipWide>135),still:{hips:.25,shoulders:.25},moves:{ankles:.3}},
 bulgarian:{...LUNGE,never:either(notUpright,(b)=>b.footStep<.25),atBottom:(b)=>b.knee>130||b.kneeWide>150||b.facing>.5},
 pistol:{...SQUAT,atBottom:(b)=>shallow(b)||b.kneeGap<35||b.facing>.5},
 shouldertap:{never:either(notLying,handsAbove,feetFromHands),still:{hips:.2,shoulders:.25},moves:{wrists:.3}},
 legcurl:{never:notLying,still:{hips:.25,knees:.3},moves:{ankles:.3}},
 kbswing:{never:either(armBent,(b)=>b.wristUp>.3),atBottom:(b)=>b.wristUp<-.35,reaches:(b)=>b.tilt>30,moves:{wrists:.6,shoulders:.15}},
 // Full body
 jack:{never:notUpright,atBottom:(b)=>b.wristUp<.15,reaches:(b)=>!(b.wristUp>-.5),moves:{wrists:.8}},
 burpee:{banned:(b)=>b.kneeUp>.3,atBottom:(b)=>b.tilt<45,moves:{shoulders:.6,ankles:.4}},
 climber:{never:either(notLying,handsAbove,notFloorHands),still:{wrists:.3}},
 punch:{never:either(notUpright,legsBent,armsOverhead,(b)=>b.wristUp<-.7),still:{shoulders:.25},moves:{wrists:.35}},
};

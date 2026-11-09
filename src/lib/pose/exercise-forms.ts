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
/** Shoulders look wide only when facing the camera; side-on they nearly overlap. */
const sideOnly=(check:(b:Body)=>boolean)=>(b:Body)=>b.facing<=.5&&check(b);  // unknown facing (filmed head-on) skips it too
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
const shallow=(b:Body)=>b.knee>145&&b.facing<.45||b.torso<.45;
const kneesDown=(b:Body)=>b.kneeUp<.15;
/** Real squats lean at most about 40 degrees, even with a weight held in front; bending over to pick something up leans 60 or more. */
/** Feet apart across the picture. Truly side-on that distance is front to back: past 1.0 is a lunge or a split squat (real squats
 *  measured side-on stay under 0.45). From any other angle up to 1.7 is a squat with a wide stance. One foot well above the other
 *  (past 0.55; perspective alone gives real squats up to 0.52) is a pistol or a raised back foot. Measured on simulated squats
 *  from every camera angle and on the lunge, split-squat and pistol motions. */
const squatFeet=(b:Body)=>b.facing<.3?b.stance>1:b.stance>1.7;
/** The feet stay on the floor in a squat; in a jump they travel with the body. */
const SQUAT={never:(b:Body)=>b.wristUp>.3,banned:(b:Body)=>b.tilt>55,atBottom:(b:Body)=>shallow(b)||squatFeet(b)||b.footStep>.55,still:{ankles:.5},moves:{shoulders:.2}};
/** Lying down seen head-on looks upright but very short: a torso this foreshortened is not standing. */
const lyingHeadOn=(b:Body)=>b.torso<.6;
const SIDE_ARM={never:either(armBent,notUpright,lyingHeadOn,(b)=>b.wristUp>.5),banned:(b:Body)=>b.elbow<90,atBottom:(b:Body)=>b.wristUp<-.45,reaches:(b:Body)=>!(b.wristUp>-.65),moves:{wrists:.6}};
const CURL={never:either(notUpright,legsBent,handsAbove),atBottom:handsLow,still:{hips:.35,elbows:.35},moves:{wrists:.4}};
const PUSH={still:{wrists:.3},moves:{shoulders:.2}};  // the shoulders really go down; a plank's jitter doesn't move them this far
const LUNGE={never:notUpright,atBottom:(b:Body)=>b.hipGap<14&&b.facing<.45||b.facing>.5&&b.stance>.8,moves:{shoulders:.15}};
const HINGE={moves:{shoulders:.3},still:{ankles:.4}};
const LIFT_HIPS={never:notLying,still:{shoulders:.35},moves:{hips:.15}};
/** Head-on, a lifted knee comes towards the camera and the hip angle hardly changes, so that check is for side-on only. */
const RAISE_KNEE={never:notUpright,atBottom:(b:Body)=>b.hipGap<20&&b.facing<.45||b.kneeWide<140||b.facing>.5&&b.stance>.7,still:{shoulders:.3},moves:{knees:.25}};
const STAND_LEG={never:either(notUpright,legsBent,armsOverhead),still:{hips:.3,wrists:.4}};
const FOURS={never:either(notFloorHands,(b)=>b.tilt<55)};
export const EXERCISE_FORMS:Partial<Record<ExerciseKind,ExerciseForm>>={
 // Legs
 squat:SQUAT,
 sumo:{...SQUAT,never:either(SQUAT.never,notFacing,(b)=>b.torso<.7,(b)=>b.facing>1.05),atBottom:(b)=>shallow(b)||b.stance<.8||b.kneeGap>25},
 wsquat:{...SQUAT,never:(b)=>b.wristChest>.8},
 ohsquat:{...SQUAT,never:(b)=>b.wristLow<.3},
 squatjump:{...SQUAT,moves:{ankles:.2,shoulders:.2}},  // a small hop is still a jump
 lunge:LUNGE,
 wlunge:{...LUNGE,never:either(notUpright,(b)=>b.wristUp>-.25)},
 sidelunge:{never:either(notUpright,lyingHeadOn),atBottom:(b)=>b.stance<.8||b.kneeGap<20||b.facing<.3},
 knee:RAISE_KNEE,
 highknee:RAISE_KNEE,
 buttkick:{never:either(notUpright,(b)=>b.hip<135),atBottom:(b)=>b.kneeWide<120,still:{shoulders:.3,hips:.15},moves:{ankles:.25}},
 sideleg:{never:either(notUpright,legsBent,armsOverhead),still:{shoulders:.25},moves:{ankles:.2}},
 calf:STAND_LEG,
 wcalf:STAND_LEG,
 donkey:{...FOURS,still:{wrists:.3}},
 bridge:LIFT_HIPS,
 hipthrust:LIFT_HIPS,
 rdl:{...HINGE,never:either((b)=>b.knee<145,(b)=>b.wristUp>-.25),atBottom:notHinged},
 // Chest and shoulders
 // Head-on the body looks upright and the legs are hidden behind it, so only the hand rule applies; the lying-down rules are side-on only.
 pushup:{...PUSH,never:either(handsAbove,sideOnly((b)=>b.handHeight<-.6),sideOnly(notLying),sideOnly((b)=>b.knee<145),sideOnly((b)=>b.hip<135),sideOnly((b)=>b.headDown>.4),sideOnly(feetFromHands))},
 kneepush:{...PUSH,never:either(handsAbove,sideOnly((b)=>b.tilt<40),sideOnly((b)=>b.headDown>.4),sideOnly(feetFromHands)),atBottom:sideOnly(legsStraight)},
 incline:{...PUSH,never:either(handsAbove,(b)=>b.tilt<22,(b)=>b.tilt>80,legsBent,(b)=>b.headDown>.05,(b)=>b.handHeight<.6)},
 wallpush:{...PUSH,never:either((b)=>b.tilt>42,legsBent,handsLow,armsOverhead)},
 pikepush:{...PUSH,never:(b)=>b.headDown<.05,atBottom:(b)=>b.hip>135},
 bench:{never:either(notLying,(b)=>b.wristUp<-.2),moves:{elbows:.2}},
 press:{never:either(legsBent,notUpright,handsLow),atBottom:(b)=>b.wristUp<-.35,reaches:(b)=>!(b.wristUp<.5),still:{shoulders:.35},moves:{wrists:.4,elbows:.2}},
 thruster:{never:either(notUpright,handsLow),atBottom:(b)=>b.knee>130,reaches:(b)=>!(b.wristUp<.5),moves:{wrists:.4,shoulders:.2}},
 raise:{...SIDE_ARM,never:either(SIDE_ARM.never,facingAway)},
 front:{...SIDE_ARM,never:either(SIDE_ARM.never,sideOn),still:{shoulders:.25}},
 // Upright rows stay upright, and the hands stop at the chest; hands up at shoulder height, or a hinge past 30 degrees, is a swing.
 uprow:{never:either(notUpright,armsOverhead,notFacing),banned:(b)=>b.tilt>30||b.wristUp>-.1,atBottom:(b)=>b.elbow>125,moves:{wrists:.4}},
 // Back
 deadlift:{...HINGE,banned:(b)=>b.wristUp>0,atBottom:(b)=>notHinged(b)||b.knee<95||b.kneeWide>155||b.wristUp>-.2},
 goodmorning:{...HINGE,never:either((b)=>b.wristChest>.8,legsBent),atBottom:notHinged},
 row:{never:either(notHinged,handsAbove,(b)=>b.handHeight<.5),still:{hips:.35,shoulders:.3},moves:{wrists:.2,elbows:.15}},
 revfly:{never:either(notHinged,armBent,(b)=>b.handHeight<.4),still:{hips:.35},moves:{wrists:.4}},
 seatrow:{never:either(legsStraight,(b)=>b.tilt>30,(b)=>b.wristUp>.15,(b)=>b.wristUp<-.75,sideOn),atBottom:(b)=>b.wristUp>-.3,still:{hips:.25},moves:{wrists:.3}},
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
 vup:{banned:(b)=>b.tilt<20,atBottom:kneesDown,moves:{shoulders:.35,knees:.35}},
 flutter:{never:either(notLying,legsBent,(b)=>b.wristLow<-.5),atBottom:(b)=>b.hipGap<6,still:{shoulders:.3}},
 bicycle:{never:either(notLying,(b)=>b.wristLow<-.5),atBottom:(b)=>b.hipGap<20||b.kneeWide>165&&b.knee>130},
 sidebend:{never:either((b)=>b.tilt>50,notFacing),atBottom:(b)=>b.tilt<6,still:{hips:.3},moves:{shoulders:.2}},
 // Added moves with their own signature
 latpull:{never:either((b)=>b.wristUp<-.1,legsStraight,(b)=>b.tilt>30),still:{shoulders:.3},moves:{wrists:.2}},
 pullover:{never:either(notLying,armBent),atBottom:feetFromHands,moves:{wrists:.5}},
 legext:{never:either(notUpright,(b)=>b.hipWide>135),still:{hips:.25,shoulders:.25},moves:{ankles:.3}},
 bulgarian:{...LUNGE,never:either(notUpright,(b)=>b.footStep<.25),atBottom:(b)=>b.knee>130||b.kneeWide>150||b.facing>.5},
 pistol:{...SQUAT,atBottom:(b)=>shallow(b)||b.kneeGap<35||b.facing>.5},
 shouldertap:{never:either(notLying,handsAbove,feetFromHands),still:{hips:.2,shoulders:.25},moves:{wrists:.3}},
 legcurl:{never:notLying,still:{hips:.25,knees:.3},moves:{ankles:.3}},
 kbswing:{never:either(armBent,(b)=>b.wristUp>.3),atBottom:(b)=>b.wristUp<-.7,reaches:(b)=>b.tilt>30,moves:{wrists:.6,shoulders:.15}},
 hspu:{never:either((b)=>b.headDown<.4,(b)=>b.hip<140),still:{wrists:.3},moves:{shoulders:.2}},
 hangleg:{never:(b)=>b.wristUp<.3,still:{wrists:.3,shoulders:.3},moves:{knees:.35}},
 decline:{...PUSH,never:either(handsAbove,sideOnly(notLying),sideOnly(legsBent),sideOnly((b)=>b.handHeight>-.5))},
 nordic:{never:(b)=>b.hip<140,still:{knees:.3,ankles:.3},moves:{shoulders:.6}},
 jumplunge:{...LUNGE,moves:{ankles:.2,shoulders:.15}},
 tuckjump:{banned:(b)=>b.tilt>50,never:either(notUpright,armsOverhead),atBottom:(b)=>b.hipGap>20,moves:{ankles:.5,knees:.3}},
 cleanpress:{never:notUpright,atBottom:(b)=>b.wristUp<.4,reaches:(b)=>b.elbow<110,moves:{wrists:.8}},
 snatch:{atBottom:(b)=>b.wristUp<0,reaches:(b)=>b.tilt>30,moves:{wrists:.8,shoulders:.15}},
 inclinebench:{never:either((b)=>b.tilt<25,(b)=>b.tilt>62,(b)=>b.wristUp<-.2),moves:{elbows:.2}},
 // Full body
 jack:{banned:(b)=>b.elbow<70||b.tilt>45,never:notUpright,atBottom:(b)=>b.wristUp<.15,reaches:(b)=>!(b.wristUp>-.5),moves:{wrists:.8,ankles:.15}},
 // A burpee must reach the plank at some point in every rep (the crouch on the way down is part of it too).
 burpee:{banned:(b)=>b.kneeUp>.3,reaches:(b)=>!(b.tilt<45),moves:{shoulders:.6,ankles:.25}},
 climber:{never:either(notLying,handsAbove,notFloorHands),still:{wrists:.3}},
 punch:{never:either(notUpright,legsBent,armsOverhead,(b)=>b.wristUp<-.7),still:{shoulders:.25},moves:{wrists:.25}},
};

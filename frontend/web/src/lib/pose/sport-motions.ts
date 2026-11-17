import type {Move} from './exercise-motions';
import type {SportKind} from './sports';
/** How each sports game moves, as key poses in the same form as the exercise examples (exercise-motions.ts). The Play page shows
 *  these as the example, and the tests film the very same motions, so the example shown is the movement that counts.
 *  timing: the share of one cycle spent going to the next key pose (a swing is slow back, fast through, slow to reset). */
export type SportMove=Move&{timing:number[];tempo:[number,number]};
export const SPORT_MOVES:Record<SportKind,SportMove>={
 // Light hops on the spot, knees soft, wrists turning the rope by the hips.
 skip:{view:'front',anchor:'hip',keys:[{arm:[-14,14],fore:[-38,38],thigh:[-3,3],shin:[3,-3]},{arm:[-14,14],fore:[-38,38],thigh:[-2,2],shin:[2,-2],lift:.03}],timing:[.5,.5],tempo:[.42,.6]},
 // Jab and cross from the guard, side-on, the same motion as the camera punch exercise.
 box:{view:'side',anchor:'hip',keys:[{arm:[22,22],fore:[150,150]},{arm:[86,22],fore:[88,150]},{arm:[22,22],fore:[150,150]},{arm:[22,86],fore:[150,88]}],timing:[.25,.25,.25,.25],tempo:[1.2,1.8]},
 // A front-foot drive, filmed from the front: bat down, lifted back over the shoulder, driven down through the line, follow-through.
 cricket:{view:'front',anchor:'hip',keys:[{arm:[28,28],fore:[18,18]},{arm:[150,150],fore:[172,172]},{arm:[-8,-8],fore:[-18,-18]},{arm:[-128,-128],fore:[-150,-150]}],timing:[.3,.1,.12,.48],tempo:[2.2,3]},
 // An overhead smash, side-on: racket hand back behind the head, up to contact, then down and through, other arm pointing up first.
 badminton:{view:'side',anchor:'hip',keys:[{arm:[40,30],fore:[60,90]},{arm:[150,-170],fore:[150,-40]},{arm:[60,175],fore:[40,170]},{arm:[10,40],fore:[10,30]}],timing:[.3,.1,.1,.5],tempo:[2.2,3]},
};

import type {ExerciseKind} from './types';
/** How each exercise moves, as joint angles between key poses. The page plays these as the example, and the tests run
 *  the rep counter on the very same motions, so the example shown is the movement that counts. */
export type Pose={back?:number;torso?:number;arm?:[number,number];fore?:[number,number];thigh?:[number,number];shin?:[number,number];heel?:number;lift?:number};
export type Move={view:'side'|'front';anchor:'hip'|'foot'|'hand'|'shoulder';keys:Pose[]};
const T=.25,ARM=.13,LEG=.21;
const dir=(deg:number):[number,number]=>[Math.sin(deg*Math.PI/180),Math.cos(deg*Math.PI/180)];
const mix=(a:number,b:number,k:number)=>a+(b-a)*k;
export const full=(p:Pose):Required<Pose>=>({torso:0,arm:[0,0],fore:[0,0],thigh:[0,0],shin:[0,0],heel:0,lift:0,back:0,...p});
export const blend=(a:Required<Pose>,b:Required<Pose>,k:number):Required<Pose>=>({torso:mix(a.torso,b.torso,k),heel:mix(a.heel,b.heel,k),lift:mix(a.lift,b.lift,k),back:mix(a.back,b.back,k),arm:[mix(a.arm[0],b.arm[0],k),mix(a.arm[1],b.arm[1],k)],fore:[mix(a.fore[0],b.fore[0],k),mix(a.fore[1],b.fore[1],k)],thigh:[mix(a.thigh[0],b.thigh[0],k),mix(a.thigh[1],b.thigh[1],k)],shin:[mix(a.shin[0],b.shin[0],k),mix(a.shin[1],b.shin[1],k)]});
/** Lays the 33 landmarks out from the hip. Side-on, left and right nearly overlap; from the front they sit a shoulder apart. */
function skeleton(p:Required<Pose>,view:Move['view']){
 const [tx,ty]=dir(p.torso),gap=view==='front'?[.09,.06]:[.012,.012],out:Record<number,[number,number]>={};
 const shoulder:[number,number]=[tx*T,-ty*T];
 for(const i of [0,1]){
  const sign=i?1:-1,sx=shoulder[0]+sign*gap[0]*Math.abs(ty),sy=shoulder[1]+sign*gap[0]*Math.abs(tx)*.2,hx=sign*gap[1],hy=0;
  const [ax,ay]=dir(p.arm[i]),[fx,fy]=dir(p.fore[i]),[lx,ly]=dir(p.thigh[i]),[kx,ky]=dir(p.shin[i]);
  out[11+i]=[sx,sy];out[13+i]=[sx+ax*ARM,sy+ay*ARM];out[15+i]=[sx+ax*ARM+fx*ARM,sy+ay*ARM+fy*ARM];
  out[23+i]=[hx,hy];out[25+i]=[hx+lx*LEG,hy+ly*LEG];const ankle:[number,number]=[hx+lx*LEG+kx*LEG,hy+ly*LEG+ky*LEG-p.heel];out[27+i]=ankle;
  const flat=Math.abs(ky)<.5;out[31+i]=flat?[ankle[0],ankle[1]-.07]:p.heel?[ankle[0]+.05,ankle[1]+.05]:[ankle[0]+.075,ankle[1]+.02];out[29+i]=[ankle[0]-.015,ankle[1]+.01];
 }
 return out;
}
const anchorOf=(s:Record<number,[number,number]>,a:Move['anchor']):[number,number]=>a==='hip'?[0,0]:a==='foot'?[(s[27][0]+s[28][0])/2,Math.max(s[27][1],s[28][1])]:a==='hand'?s[15]:s[11];
/** Every joint's place in the picture for one moment of a move. */
export function layout(m:Move,p:Required<Pose>,start:[number,number]){
 const s=skeleton(p,m.view),base=anchorOf(skeleton({...p,heel:0},m.view),m.anchor),out:Record<number,[number,number]>={};
 for(const [id,at] of Object.entries(s))out[Number(id)]=[at[0]+start[0]-base[0]-p.back,at[1]+start[1]-base[1]-p.lift];
 return out;
}
/** Where the model must stand so every landmark of every key pose stays in the picture. */
export function placement(m:Move):[number,number]{
 let x0=9,x1=-9,y0=9,y1=-9;
 for(const k of m.keys){const p=full(k),s=skeleton(p,m.view),b=anchorOf(skeleton({...p,heel:0},m.view),m.anchor);for(const v of Object.values(s)){x0=Math.min(x0,v[0]-b[0]-p.back);x1=Math.max(x1,v[0]-b[0]-p.back);y0=Math.min(y0,v[1]-b[1]-p.lift);y1=Math.max(y1,v[1]-b[1]);}}
 return [.5-(x0+x1)/2,.5-(y0+y1)/2];
}
const both=(v:number):[number,number]=>[v,v];
const LIE={torso:-88,thigh:both(92),shin:both(92),arm:both(95),fore:both(95)},KNEES={torso:-85,thigh:both(130),shin:both(30),arm:both(95),fore:both(95)},PLANK={torso:76,thigh:both(-76),shin:both(-76)},FOURS={torso:88,thigh:both(0),shin:both(-90)};
const SQUAT={torso:25,thigh:both(75),shin:both(-35)},CHEST={arm:both(30),fore:both(150)},UP={arm:both(178),fore:both(178)},RACK={arm:both(30),fore:both(172)};
const SEAT={torso:4,thigh:both(82),shin:both(4)};
export const MOVES:Record<ExerciseKind,Move>={
 squat:{view:'side',anchor:'foot',keys:[{},{...SQUAT,arm:both(25),fore:both(25)}]},
 sumo:{view:'front',anchor:'foot',keys:[{thigh:[-24,24],shin:[-24,24]},{thigh:[-82,82],shin:[-4,4]}]},
 wsquat:{view:'side',anchor:'foot',keys:[{...CHEST},{...SQUAT,...CHEST}]},
 ohsquat:{view:'side',anchor:'foot',keys:[{...UP},{...SQUAT,...UP}]},
 squatjump:{view:'side',anchor:'foot',keys:[{},{...SQUAT},{lift:.1}]},
 lunge:{view:'side',anchor:'foot',keys:[{},{torso:3,thigh:[72,-12],shin:[-14,-74]}]},
 wlunge:{view:'side',anchor:'foot',keys:[{},{torso:3,thigh:[72,-12],shin:[-14,-74]}]},
 sidelunge:{view:'front',anchor:'foot',keys:[{},{torso:-8,thigh:[-84,30],shin:[-2,30]}]},
 knee:{view:'side',anchor:'hip',keys:[{},{thigh:[92,0],shin:[5,0]}]},
 highknee:{view:'side',anchor:'hip',keys:[{},{thigh:[92,0],shin:[5,0]}]},
 buttkick:{view:'side',anchor:'hip',keys:[{},{shin:[-115,0]}]},
 sideleg:{view:'front',anchor:'hip',keys:[{},{thigh:[-46,0],shin:[-46,0]}]},
 calf:{view:'side',anchor:'foot',keys:[{},{heel:.05}]},
 wcalf:{view:'side',anchor:'foot',keys:[{},{heel:.05}]},
 donkey:{view:'side',anchor:'hip',keys:[{...FOURS},{...FOURS,thigh:[-62,0]}]},
 bridge:{view:'side',anchor:'shoulder',keys:[{...KNEES,thigh:both(150)},{torso:-112,thigh:both(108),shin:both(10),arm:both(95),fore:both(95)}]},
 hipthrust:{view:'side',anchor:'shoulder',keys:[{...KNEES,thigh:both(150)},{torso:-112,thigh:both(108),shin:both(10),arm:both(95),fore:both(95)}]},
 rdl:{view:'side',anchor:'foot',keys:[{},{torso:78,thigh:both(-12),shin:both(4)}]},
 pushup:{view:'side',anchor:'hand',keys:[{...PLANK},{torso:86,thigh:both(-86),shin:both(-86),arm:both(-58),fore:both(62)}]},
 kneepush:{view:'side',anchor:'hand',keys:[{torso:62,thigh:both(-50),shin:both(-108)},{torso:78,thigh:both(-60),shin:both(-112),arm:both(-58),fore:both(62)}]},
 incline:{view:'side',anchor:'hand',keys:[{torso:38,thigh:both(-38),shin:both(-38),arm:both(40),fore:both(40)},{torso:54,thigh:both(-54),shin:both(-54),arm:both(-45),fore:both(95)}]},
 wallpush:{view:'side',anchor:'hand',keys:[{torso:12,thigh:both(-12),shin:both(-12),arm:both(95),fore:both(95)},{torso:18,thigh:both(-18),shin:both(-18),arm:both(35),fore:both(125)}]},
 pikepush:{view:'side',anchor:'hand',keys:[{torso:130,thigh:both(-50),shin:both(-50),arm:both(30),fore:both(30)},{torso:140,thigh:both(-45),shin:both(-45),arm:both(-35),fore:both(75)}]},
 bench:{view:'side',anchor:'shoulder',keys:[{...LIE,...UP},{...LIE,arm:both(100),fore:both(190)}]},
 press:{view:'side',anchor:'hip',keys:[{...UP},{...RACK}]},
 thruster:{view:'side',anchor:'foot',keys:[{...UP},{...SQUAT,...RACK}]},
 raise:{view:'front',anchor:'hip',keys:[{arm:[-6,6],fore:[-6,6]},{arm:[-92,92],fore:[-92,92]}]},
 front:{view:'side',anchor:'hip',keys:[{arm:both(5),fore:both(5)},{arm:both(92),fore:both(92)}]},
 uprow:{view:'front',anchor:'hip',keys:[{arm:[-10,10],fore:[10,-10]},{arm:[-102,102],fore:[20,-20]}]},
 deadlift:{view:'side',anchor:'foot',keys:[{},{torso:62,thigh:both(30),shin:both(-20)}]},
 goodmorning:{view:'side',anchor:'foot',keys:[{...RACK},{torso:78,thigh:both(-12),shin:both(4),arm:both(100),fore:both(-70)}]},
 row:{view:'side',anchor:'hip',keys:[{torso:62},{torso:62,arm:both(-58),fore:both(42)}]},
 revfly:{view:'side',anchor:'hip',keys:[{torso:68},{torso:68,arm:both(82),fore:both(82)}]},
 seatrow:{view:'side',anchor:'hip',keys:[{...SEAT,arm:both(82),fore:both(82)},{...SEAT,arm:both(30),fore:both(85)},{...SEAT,arm:both(-52),fore:both(72)},{...SEAT,arm:both(30),fore:both(85)}]},
 superman:{view:'side',anchor:'hip',keys:[{torso:88,thigh:both(-88),shin:both(-88),arm:both(92),fore:both(92)},{torso:76,thigh:both(-100),shin:both(-100),arm:both(106),fore:both(106)}]},
 pullup:{view:'side',anchor:'hand',keys:[{...UP},{torso:4,arm:both(115),fore:both(218)}]},
 birddog:{view:'side',anchor:'hip',keys:[{...FOURS},{...FOURS,thigh:[-62,0],arm:[0,92],fore:[0,92]}]},
 curl:{view:'side',anchor:'hip',keys:[{arm:both(4),fore:both(4)},{arm:both(8),fore:both(150)}]},
 hammer:{view:'side',anchor:'hip',keys:[{arm:both(4),fore:both(4)},{arm:both(8),fore:both(150)}]},
 conccurl:{view:'side',anchor:'hip',keys:[{torso:24,thigh:both(85),shin:both(0),arm:both(6),fore:both(6)},{torso:24,thigh:both(85),shin:both(0),arm:both(10),fore:both(150)}]},
 kickback:{view:'side',anchor:'hip',keys:[{torso:68,arm:both(-82),fore:both(0)},{torso:68,arm:both(-82),fore:both(-78)}]},
 overhead:{view:'side',anchor:'hip',keys:[{...UP},{arm:both(172),fore:both(268)}]},
 skull:{view:'side',anchor:'shoulder',keys:[{...LIE,...UP},{...LIE,arm:both(178),fore:both(282)}]},
 dip:{view:'side',anchor:'hand',keys:[{...SEAT,arm:both(-8),fore:both(-8)},{...SEAT,arm:both(-72),fore:both(28)}]},
 situp:{view:'side',anchor:'foot',keys:[{...KNEES,thigh:both(120)},{torso:18,thigh:both(120),shin:both(30)}]},
 crunch:{view:'side',anchor:'hip',keys:[{...KNEES},{torso:-48,thigh:both(130),shin:both(30)}]},
 legraise:{view:'side',anchor:'hip',keys:[{...LIE},{...LIE,thigh:both(168),shin:both(168)}]},
 revcrunch:{view:'side',anchor:'shoulder',keys:[{...KNEES},{torso:-85,thigh:both(198),shin:both(70)}]},
 vup:{view:'side',anchor:'hip',keys:[{...LIE},{torso:-38,thigh:both(142),shin:both(142)}]},
 flutter:{view:'side',anchor:'hip',keys:[{...LIE},{...LIE,thigh:[126,92],shin:[126,92]}]},
 bicycle:{view:'side',anchor:'hip',keys:[{...LIE},{...LIE,thigh:[172,92],shin:[30,92]}]},
 sidebend:{view:'front',anchor:'hip',keys:[{},{torso:-24,arm:both(-24),fore:both(-24)}]},
 jack:{view:'front',anchor:'hip',keys:[{arm:[-6,6],fore:[-6,6]},{arm:[-172,172],fore:[-172,172],thigh:[-20,20],shin:[-20,20]}]},
 burpee:{view:'side',anchor:'foot',keys:[{},{...SQUAT},{...PLANK,back:.15}]},
 climber:{view:'side',anchor:'hand',keys:[{...PLANK},{...PLANK,thigh:[62,-76],shin:[-62,-76]}]},
 punch:{view:'side',anchor:'hip',keys:[{arm:both(22),fore:both(150)},{arm:[86,22],fore:[88,150]}]},
 latpull:{view:'side',anchor:'hip',keys:[{...SEAT,...UP},{...SEAT,arm:both(115),fore:both(218)}]},
 pullover:{view:'side',anchor:'shoulder',keys:[{...LIE,arm:both(180),fore:both(180)},{...LIE,arm:both(262),fore:both(262)}]},
 kbswing:{view:'side',anchor:'foot',keys:[{torso:62,thigh:both(30),shin:both(-20),arm:both(-40),fore:both(-40)},{arm:both(92),fore:both(92)}]},
 legext:{view:'side',anchor:'hip',keys:[{...SEAT},{...SEAT,shin:[78,4]}]},
 bulgarian:{view:'side',anchor:'foot',keys:[{thigh:[6,-14],shin:[6,-92]},{torso:6,thigh:[78,-22],shin:[-22,-112]}]},
 pistol:{view:'side',anchor:'foot',keys:[{thigh:[0,62],shin:[0,62]},{torso:28,thigh:[78,82],shin:[-36,82]}]},
 shouldertap:{view:'side',anchor:'hip',keys:[{...PLANK},{...PLANK,arm:[-30,0],fore:[95,0]}]},
 legcurl:{view:'side',anchor:'hip',keys:[{torso:88,thigh:both(-88),shin:both(-88),arm:both(92),fore:both(92)},{torso:88,thigh:both(-88),shin:both(-188),arm:both(92),fore:both(92)}]},
};

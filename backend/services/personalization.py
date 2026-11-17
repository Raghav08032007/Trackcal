"""Deterministic choices; no BMI, body changes, XP or paid inference affect plans."""
from datetime import timedelta

from services.i18n import msg, tr

TEMPLATES={
 'walk':dict(name='Comfortable walk',interests=['fitness','endurance','sports','routine'],equipment=[],setting=['home','outdoor','gym'],seated=False,floor=False,instructions='Choose a familiar clear route. Begin slowly, keep a comfortable pace and take breaks whenever needed.',alternative='chair',difficulty='gentle'),
 'chair':dict(name='Seated movement break',interests=['fitness','mobility','routine'],equipment=['chair'],setting=['home','gym','outdoor'],seated=True,floor=False,instructions='Use a stable non-wheeled chair. Sit supported and gently move hands and shoulders within a comfortable range. Rest as needed.',alternative='recovery',difficulty='gentle'),
 'strength':dict(name='Wall push fundamentals',interests=['strength','fitness'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Stand comfortably facing a stable wall. Place hands against it, bend elbows slightly and return gently. Choose a few comfortable repetitions; do not push to fatigue.',alternative='chair',difficulty='beginner'),
 'gym':dict(name='Light resistance familiarization',interests=['strength'],equipment=['dumbbells'],setting=['gym','home'],seated=False,floor=False,instructions='Use a light weight you already know how to handle. Review technique with a qualified instructor before trying unfamiliar movements. Pause rather than increase load automatically.',alternative='strength',difficulty='beginner'),
 'run':dict(name='Walk and optional easy jog',interests=['running'],equipment=[],setting=['outdoor','gym'],seated=False,floor=False,instructions='Begin with a comfortable walk. Only if already comfortable with jogging, alternate a brief easy jog with longer walking breaks. Walking the whole session is a valid alternative.',alternative='walk',difficulty='beginner'),
 'mobility':dict(name='Gentle mobility practice',interests=['mobility','sports','fitness'],equipment=[],setting=['home','gym','outdoor'],seated=False,floor=False,instructions='Explore slow shoulder circles and gentle ankle movements while supported. Use only a comfortable range and avoid forcing stretches.',alternative='chair',difficulty='gentle'),
 'yoga':dict(name='Standing yoga introduction',interests=['yoga','mobility'],equipment=[],setting=['home','gym','outdoor'],seated=False,floor=False,instructions='Stand with support nearby. Try a comfortable upright posture and natural breathing. Avoid forced holds or breath retention; use seated movement if preferred.',alternative='chair',difficulty='gentle'),
 'cycle':dict(name='Easy familiar cycling',interests=['endurance'],equipment=['bicycle'],setting=['gym','outdoor'],seated=False,floor=False,instructions='Use a familiar, maintained bicycle in a safe setting. Begin easily and take breaks. Choose walking if cycling is unfamiliar.',alternative='walk',difficulty='gentle'),
 'recovery':dict(name='Planned recovery pause',interests=[],equipment=[],setting=['home','gym','outdoor'],seated=True,floor=False,instructions='Make time for a quiet pause, comfortable rest or reflection. No movement or performance target is required.',alternative='recovery',difficulty='rest'),
}
TEMPLATES.update({
 'camera_squat':dict(name='Camera squat practice',interests=['strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use only a familiar squat variation and comfortable range. Keep a stable side-on camera view and clear space; counts are estimates and can be corrected.',alternative='chair',difficulty='familiar practice',camera_only=True),
 'camera_pushup':dict(name='Camera floor push-up practice',interests=['strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use only a familiar floor push-up variation on a stable surface. Position the camera side-on with your whole body visible. Rest whenever needed; use manual logging if tracking is unclear.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_press':dict(name='Camera single-arm press practice',interests=['strength'],equipment=['dumbbells'],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar light weight and comfortable range. Keep one arm and hip visible side-on. Track one arm per set; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_situp':dict(name='Camera floor sit-up practice',interests=['strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use only a familiar sit-up you already do comfortably. Lie side-on with shoulders, hips and knees visible. Stop if anything hurts; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_wallpush':dict(name='Camera wall push-up practice',interests=['strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a stable wall and a familiar, comfortable range. Keep one arm and hip visible side-on. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_lunge':dict(name='Camera lunge practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar lunge and a comfortable depth, with clear space around you. Rest whenever needed; counts are estimates and can be corrected, not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_jack':dict(name='Camera jumping jack practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar pace on a stable floor, with room above your hands. Rest whenever needed; counts are estimates and can be corrected, not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_raise':dict(name='Camera side arm raise practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Raise your arms to a comfortable height, without weights unless you already use them. Rest whenever needed; counts are estimates and can be corrected, not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_sumo':dict(name='Camera sumo squats practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera, feet wide, with your head and hips visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_bridge':dict(name='Camera glute bridges practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, knees bent, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_calf':dict(name='Camera calf raises practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your feet clearly visible. Small movement, so go slowly. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_sideleg':dict(name='Camera side leg raises practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera, with your hips and knees visible. Either leg counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_donkey':dict(name='Camera donkey kicks practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Hands and knees, side-on, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_incline':dict(name='Camera incline push-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hands on a sturdy table or bench, side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_kneepush':dict(name='Camera knee push-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Knees on the floor, side-on, with your head to knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_row':dict(name='Camera bent-over rows practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hinge forward, side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_superman':dict(name='Camera superman lifts practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie face down, side-on, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_kickback':dict(name='Camera tricep kickbacks practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hinge forward, side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_overhead':dict(name='Camera overhead tricep extensions practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your arm and hip visible and room above your hand. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_hammer':dict(name='Camera hammer curls practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera or stand side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_front':dict(name='Camera front raises practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_uprow':dict(name='Camera upright rows practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera, with your shoulders, elbows and hips visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_crunch':dict(name='Camera crunches practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, knees bent, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_legraise':dict(name='Camera leg raises practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_sidebend':dict(name='Camera standing side bends practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera, with your shoulders and hips visible. Either side counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_highknee':dict(name='Camera high knees practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera or stand side-on, with your hips and knees visible. Each knee counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_burpee':dict(name='Camera burpees practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand far back, side-on, so your whole body stays in frame. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_climber':dict(name='Camera mountain climbers practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Push-up position, side-on, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_wsquat':dict(name='Camera goblet or barbell squats practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hold the weight at your chest or across your shoulders. Face the camera or stand side-on. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_ohsquat':dict(name='Camera overhead squats practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Keep both arms straight overhead. Leave room above your hands. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_wlunge':dict(name='Camera dumbbell lunges practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hold a dumbbell in each hand with your arms down. Face the camera or stand side-on. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_sidelunge':dict(name='Camera side lunges practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera with your whole body visible. Either side counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_squatjump':dict(name='Camera jump squats practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on or face the camera, with your feet in frame and room above your head. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_buttkick':dict(name='Camera butt kicks practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your whole leg visible. Each kick counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_deadlift':dict(name='Camera deadlifts practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your hips, knees and hands visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_rdl':dict(name='Camera romanian deadlifts practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on. Keep your legs nearly straight and push your hips back. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_goodmorning':dict(name='Camera good mornings practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on with the weight across your shoulders. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_wcalf':dict(name='Camera dumbbell calf raises practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on with a dumbbell in each hand and your feet clearly visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_hipthrust':dict(name='Camera weighted hip thrusts practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, knees bent, with the weight on your hips. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_bench':dict(name='Camera bench press practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie on a bench or the floor, side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_skull':dict(name='Camera skull crushers practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, upper arms pointing up, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_revfly':dict(name='Camera bent-over reverse flyes practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hinge forward, side-on or facing the camera, arms long. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_seatrow':dict(name='Camera seated rows practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Sit tall, side-on, pulling a band or cable towards your waist. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_conccurl':dict(name='Camera concentration curls practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Sit leaning forward, elbow on your inner thigh, with your arm visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_thruster':dict(name='Camera thrusters practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera or stand side-on, with room above your hands. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_pikepush':dict(name='Camera pike push-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Hips high in an upside-down V, side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_dip':dict(name='Camera chair dips practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hands on a sturdy chair behind you, side-on, knees bent. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_pullup':dict(name='Camera pull-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hang from a sturdy bar, with your hands and shoulders visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_birddog':dict(name='Camera bird dogs practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Hands and knees, side-on. Reach one arm and the other leg. Either side counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_flutter':dict(name='Camera flutter kicks practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, legs long. Each kick counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_bicycle':dict(name='Camera bicycle crunches practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, hands by your head. Each knee counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_revcrunch':dict(name='Camera reverse crunches practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, knees bent, with shoulders, hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_vup':dict(name='Camera v-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on, legs long. Lift your chest and legs together. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_punch':dict(name='Camera shadow boxing punches practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera or stand side-on, fists up. Each punch counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_latpull':dict(name='Camera lat pulldowns practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Sit at a cable or use a band above you, side-on or facing the camera, with your hands visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_pullover':dict(name='Camera dumbbell pullovers practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie side-on holding a weight above your chest, arms long. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_kbswing':dict(name='Camera kettlebell swings practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on with room in front of you and your hips visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_legext':dict(name='Camera seated leg extensions practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Sit side-on, thigh still, with your whole leg visible. Either leg counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_bulgarian':dict(name='Camera bulgarian split squats practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Back foot on a chair or bench, side-on, with both feet visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_pistol':dict(name='Camera pistol squats practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on and squat on one leg, the other held out in front. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_shouldertap':dict(name='Camera plank shoulder taps practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Push-up position, side-on. Each tap counts. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_legcurl':dict(name='Camera lying leg curls practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Lie face down, side-on, with your whole leg visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_hspu':dict(name='Camera wall handstand push-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Kick up against a wall, side-on, with your hands and hips visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_hangleg':dict(name='Camera hanging leg raises practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Hang from a sturdy bar, side-on, with your hips and knees visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_decline':dict(name='Camera decline push-ups practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Feet on a chair or bench, side-on, with your whole body visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_nordic':dict(name='Camera nordic curls practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=True,instructions='Use a familiar movement and a comfortable range. Kneel side-on with your ankles held down, and your whole leg visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_jumplunge':dict(name='Camera jump lunges practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your feet in frame and room above your head. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_tuckjump':dict(name='Camera tuck jumps practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on, with your whole body in frame and room above your head. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_cleanpress':dict(name='Camera clean and press practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Face the camera or stand side-on, with room above your hands. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_snatch':dict(name='Camera dumbbell snatches practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Stand side-on with room above your hand and your hips visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_inclinebench':dict(name='Camera incline dumbbell press practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar movement and a comfortable range. Lean back on an incline bench, side-on, with your arm and hip visible. Rest whenever needed; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_knee':dict(name='Camera knee raise practice',interests=['fitness','strength'],equipment=[],setting=['home','gym'],seated=False,floor=False,instructions='Lift one knee at a time to a comfortable height, near a stable support if you need it. Rest whenever needed; counts are estimates and can be corrected, not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
 'camera_curl':dict(name='Camera single-arm curl practice',interests=['strength'],equipment=['dumbbells'],setting=['home','gym'],seated=False,floor=False,instructions='Use a familiar light weight and comfortable range. Keep one arm and hip visible side-on. Track one arm per set; estimates are not technique or safety certification.',alternative='strength',difficulty='familiar practice',camera_only=True),
})
# The same movement with other gear. Equipment is listed so plans never assume someone owns it.
for key,base,title,gear in (('widepush','pushup','Wide push-ups',''),('diamondpush','pushup','Diamond push-ups',''),('revlunge','lunge','Reverse lunges',''),('bwgoodmorning','goodmorning','Bodyweight good mornings',''),('toetouch','rdl','Standing toe touches',''),('sumojump','squatjump','Sumo jump squats',''),('bandcurl','curl','Band curls','resistance bands'),('bandrow','seatrow','Band rows','resistance bands'),('bandpress','press','Band shoulder press','resistance bands'),('bandraise','raise','Band side raises','resistance bands'),('bandfront','front','Band front raises','resistance bands'),('bandsquat','wsquat','Band squats','resistance bands'),('bandpulldown','latpull','Band pulldowns','resistance bands'),('bandkickback','kickback','Band tricep kickbacks','resistance bands'),('bbcurl','curl','Barbell curls','barbell'),('bbrow','row','Barbell rows','barbell'),('bbpress','press','Barbell overhead press','barbell'),('bblunge','wlunge','Barbell lunges','barbell'),('frontsquat','wsquat','Barbell front squats','barbell'),('kbsquat','wsquat','Kettlebell goblet squats','kettlebell'),('kbdeadlift','deadlift','Kettlebell deadlifts','kettlebell'),('kbpress','press','Kettlebell press','kettlebell'),('kbrow','row','Kettlebell rows','kettlebell'),('kbhighpull','uprow','Kettlebell high pulls','kettlebell')):
    TEMPLATES['camera_'+key]={**TEMPLATES['camera_'+base],'name':f'Camera {title.lower()} practice','equipment':[gear] if gear else []}
# Holds: timed positions for core, balance and flexibility.
for key,title in (('plank','plank'),('wallsit','wall sit'),('bridgehold','glute bridge'),('tree','tree pose'),('legbalance','single-leg balance'),('warrior','warrior II'),('downdog','downward dog'),('forwardfold','standing forward fold')):
    TEMPLATES['camera_'+key]={**TEMPLATES['camera_bridge'],'name':f'Camera {title} hold','instructions':'Hold only a position you can keep comfortably and stop if anything hurts. The camera times the hold; it does not check form.'}
for template in TEMPLATES.values():template.update({'version':1,'review':'Application safety review 2026-10-28; not a clinical prescription'})
RECOVERY='Stop if an activity causes pain, dizziness or unusual symptoms. Use your professional guidance; these templates are not treatment plans.'
MEALS=[
 dict(id='lentil',name='Lentil, rice and vegetable bowl',diet=['balanced','vegetarian','vegan','pescatarian'],cuisine='Indian',ingredients=['lentils','rice','vegetables'],allergens=[],tip='Combine a grain, a protein food and vegetables in portions that suit you.',substitution='Swap rice for a familiar grain after checking allergens.'),
 dict(id='chickpea',name='Chickpea and vegetable salad',diet=['balanced','vegetarian','vegan','pescatarian'],cuisine='Mediterranean',ingredients=['chickpeas','vegetables','olive oil'],allergens=[],tip='Rinse cooked chickpeas, add vegetables and a dressing you enjoy.',substitution='Use lentils instead of chickpeas if suitable for your own needs.'),
 dict(id='tofu',name='Tofu, rice and greens',diet=['balanced','vegetarian','vegan','pescatarian'],cuisine='global',ingredients=['tofu','rice','greens'],allergens=['soy'],tip='Include protein foods, grains and a variety of vegetables.',substitution='Lentils can replace tofu when soy is excluded; check all ingredients.'),
 dict(id='yogurt',name='Yogurt, fruit and oats',diet=['balanced','vegetarian','pescatarian'],cuisine='global',ingredients=['yogurt','fruit','oats'],allergens=['milk','oats'],tip='Choose fruit and a yogurt you enjoy; check packaging for allergens.',substitution='Use a suitable plant yogurt after checking soy, nut and other allergens.'),
 dict(id='egg',name='Egg, wholegrain toast and vegetables',diet=['balanced','vegetarian'],cuisine='global',ingredients=['egg','wheat bread','vegetables'],allergens=['egg','wheat'],tip='Review bread and toppings as well as the main ingredient.',substitution='Try lentils and rice as an alternative after reviewing ingredients.'),
 dict(id='fish',name='Fish, rice and vegetables',diet=['balanced','pescatarian'],cuisine='global',ingredients=['fish','rice','vegetables'],allergens=['fish'],tip='Use familiar preparation and food-safety practices.',substitution='Choose chickpeas as a plant protein alternative if appropriate.'),
]
KNOWN_ALLERGENS={'milk','egg','peanut','tree nuts','soy','wheat','fish','shellfish','sesame','mustard','celery','lupin','sulphites','oats','gluten'}
EDUCATION={
 'planner':dict(title='Use your personal planner',text='A plan is editable. Start an activity, take breaks, reschedule or substitute it. Pausing never deducts XP.',question='What should you do when a plan does not fit your day?',options=['Push through discomfort','Change or pause it','Double tomorrow’s session'],answer=1),
 'fitness':dict(title='Movement at your pace',text='Start with comfortable familiar movement. Stop for pain or unusual symptoms and follow appropriate professional guidance. XP does not determine exercise intensity.',question='What should determine difficulty?',options=['Your XP level','A perfect streak','Your comfort, feedback and professional guidance'],answer=2),
 'nutrition':dict(title='Review a balanced meal idea',text='Meal ideas are flexible, not calorie prescriptions. Check ingredients, packaging, portions and allergens. Scanner results are estimates and can be corrected.',question='A scanner estimate should be…',options=['Reviewed and corrected when needed','Used as a strict intake limit','A reason to skip meals'],answer=0),
}

def eligible_templates(prefs,include_camera=False):
 if prefs.professional_restrictions:return []
 from services import body_load
 guard=body_load.protected(prefs.conditions)  # injured or operated parts are protected by their stage
 equipment=set(prefs.equipment)
 result=[]
 for key,t in TEMPLATES.items():
  if t.get('camera_only') and not include_camera:continue
  if key=='recovery':continue
  if prefs.setting not in t['setting'] or not set(t['equipment'])<=equipment:continue
  if 'seated' in prefs.accessibility and not t['seated']:continue
  if 'no_floor' in prefs.accessibility and t['floor']:continue
  if 'low_impact' in prefs.accessibility and key=='run':continue
  if not body_load.allowed(key,guard):continue
  result.append(key)
 return sorted(result,key=lambda k:(-len(set(TEMPLATES[k]['interests'])&set(prefs.interests)),k))

def recommendations(prefs):
 allergens=set(prefs.allergies)
 if 'gluten' in allergens:allergens|={'wheat','oats'}
 unknown=bool(allergens-KNOWN_ALLERGENS)
 meals=[] if unknown or prefs.professional_restrictions else [m for m in MEALS if prefs.diet in m['diet'] and not allergens.intersection(m['allergens'])]
 preferred={'quick':{'yogurt','egg','chickpea'},'batch':{'lentil','tofu','fish'},'flexible':set()}[prefs.preparation]
 meals=sorted(meals,key=lambda m:(m['cuisine']!=prefs.cuisine,m['id'] not in preferred,-len(set(m['ingredients'])&set(prefs.ingredients)),m['id']))
 return {'meals':[{**meal_view(m),'reason':tr(DIET_REASON.get(prefs.diet,DIET_REASON['balanced']))} for m in meals[:4]],'nutrition_note':tr('Check every ingredient and cross-contact information. These ideas do not certify allergen safety. No calorie or water target is generated.'),'needs_review':unknown or bool(prefs.professional_restrictions),'community_categories':[{'category':v,'operational':False} for v in prefs.interests],'event_categories':[{'category':v,'operational':False} for v in prefs.interests],'message':tr('Choose one small activity at your own pace.') if prefs.motivation else '', 'budget_note':tr('Budget is a planning preference; these ideas have no invented prices. Use the existing reviewed recipe cost planner.')}

CARDIO=('walk','cycle','run')
def _strength(key):return key in ('strength','gym') or key.startswith('camera_')
# Texts sent to the person: the tables above stay English (the coverage test reads them); these views translate them.
def sentences(text):
 """Instructions share many sentences, so they are translated one sentence at a time (the same wording everywhere)."""
 import re;return [part for part in re.split(r'(?<=[.!?])\s+',text or '') if part]
def template_view(key):
 t=TEMPLATES[key];return {**t,'name':tr(t['name']),'instructions':' '.join(tr(part) for part in sentences(t['instructions'])),'review':tr(t['review'])}
def meal_view(m):
 return {**m,'name':tr(m['name']),'tip':tr(m['tip']),'substitution':tr(m['substitution'])}
def education_view(key):
 m=EDUCATION[key];return {'id':key,**{k:v for k,v in m.items() if k!='answer'},'title':tr(m['title']),'text':tr(m['text']),'question':tr(m['question']),'options':[tr(o) for o in m['options']]}
def _line_view(line):
 if not isinstance(line,dict):return tr(line) if isinstance(line,str) else line
 text=tr(line['key'],**line.get('values',{})) if line.get('key') else tr(line.get('text'))
 source=line.get('source');source='; '.join(tr(part) for part in source.split('; ')) if isinstance(source,str) and source else source
 return {**line,'text':text,'source':source}
def explanation_view(snapshot):
 """A stored plan explanation in the person's language (plans made before translation keep their English sentences
 where a sentence held numbers)."""
 if not isinstance(snapshot,dict):return snapshot
 out=dict(snapshot)
 for field in ('report','priorities','protected'):
  if isinstance(out.get(field),list):out[field]=[_line_view(item) for item in out[field]]
 return out
DIET_REASON={'balanced':msg('Matches your balanced preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.'),
 'vegetarian':msg('Matches your vegetarian preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.'),
 'eggetarian':msg('Matches your eggetarian preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.'),
 'vegan':msg('Matches your vegan preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.'),
 'jain':msg('Matches your jain preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.'),
 'pescatarian':msg('Matches your pescatarian preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.'),
 'non_veg':msg('Matches your non_veg preference; known declared allergens excluded. Cuisine/available ingredients determine ordering.')}
INTENSITY_LINE={'light':msg('Your report suggests light exercise for now, so jumping and running sessions are left out.'),
 'moderate':msg('Your report suggests moderate exercise for now, so jumping and running sessions are left out.')}
SOURCES=[msg('TrackCal safety rule'),msg('ACSM guidelines on gradual progression')]
PRIORITIES=[msg('A blood report that needs a doctor today stops automated exercise'),msg('Professional restrictions and pain feedback block automated exercise'),
 msg('Injured and operated body parts are protected by their stage'),msg('Accessibility, equipment and setting eligibility'),msg('Explicit rest and available days'),
 msg('Interests and comfort feedback'),msg('Conservative duration; never XP/BMI-based progression')]

def apply_report(choices,report,prefs,minutes):
 """What a confirmed blood report changes in the week, each change with the guideline behind it. Returns (choices, plan of
 strength days and active minutes, explanation lines). Nothing changes without a report; a report that needs a doctor today
 leaves only rest."""
 from services.exercise_safety import INTENSE
 from services.health_plan import ACTIVITY_SOURCE, RULES
 lines=[]
 if not report:return choices,None,lines
 if report.get('safety')=='today':
  text=msg('Your blood report needs a doctor today, so no exercise is planned until a doctor has seen it. Rest days only.')
  return [],None,[{'text':text,'key':text,'source':'TrackCal safety rule'}]
 plan=report.get('plan') or {};ex=plan.get('exercise') or {};why={w['rule']:w for w in plan.get('why',[])}
 def source_of(field):  # the guidelines of just the findings that set this part of the plan
  return '; '.join(dict.fromkeys(why[r]['source'] for r in why if field in RULES.get(r,{}).get('exercise',{}))) or ACTIVITY_SOURCE
 if ex.get('intensity') in ('light','moderate'):
  dropped=[k for k in choices if k in INTENSE or k=='run']
  choices=[k for k in choices if k not in dropped]
  if dropped:lines.append({'text':INTENSITY_LINE[ex['intensity']],'key':INTENSITY_LINE[ex['intensity']],'source':source_of('intensity')})
 strength=int(ex.get('strength_days') or 0);cardio=int(ex.get('cardio_min') or 0)
 if strength:lines.append({'text':f'{strength} strength days this week, as your report suggests.','key':msg('{n} strength days this week, as your report suggests.'),'values':{'n':strength},'source':ACTIVITY_SOURCE})
 if ex.get('post_meal_walk'):lines.append({'text':msg('A 10-15 minute walk after lunch and dinner lowers the sugar rise from that meal.'),'source':source_of('post_meal_walk')})
 if ex.get('no_high_protein'):lines.append({'text':msg('No high-protein shakes or bulking sessions while your kidney result is being reviewed.'),'source':source_of('no_high_protein')})
 return choices,{'strength_days':strength,'cardio_min':cardio},lines

def generate(prefs,today,previous_feedback,report=None):
 choices=eligible_templates(prefs)
 minutes0=min(prefs.duration,10 if prefs.experience in ('beginner','unspecified') else 20)
 choices,target,report_lines=apply_report(choices,report,prefs,minutes0)
 if report and report.get('safety')=='today':
  activities=[{'template_id':'recovery','scheduled_day':str(today+timedelta(days=d)),'minutes':5} for d in range(7)]
  return activities,{'protected':[],'report':report_lines,'priorities':['A blood report that needs a doctor today stops automated exercise']}
 if previous_feedback.get('pain'):choices=[]
 minutes=min(prefs.duration,10 if prefs.experience in ('beginner','unspecified') else 20)
 if previous_feedback.get('too_hard'):minutes=max(5,minutes-5)
 if previous_feedback.get('not_enjoyed'):choices=[k for k in choices if k not in previous_feedback['not_enjoyed']] or ['recovery']
 activities=[]
 open_days=[today+timedelta(days=o) for o in range(7) if not((today+timedelta(days=o)).weekday() in prefs.rest_days or (today+timedelta(days=o)).weekday() not in prefs.available_days)]
 strong=[k for k in choices if _strength(k)];cardio=[k for k in choices if k in CARDIO]
 want_strength=min(len(open_days),(target or {}).get('strength_days',0)) if strong else 0
 cardio_days=len(open_days)-want_strength
 per_cardio=minutes
 if target and target.get('cardio_min') and cardio_days and cardio:
  # Start where the person is and add about a tenth a week (ACSM); never more than their chosen session length.
  per_cardio=max(minutes,min(prefs.duration,-(-target['cardio_min']//cardio_days)))
  if prefs.experience in ('beginner','unspecified'):per_cardio=min(per_cardio,20)  # new to exercise: build up over the weeks, not all at once
 n_strength=n_cardio=0
 # The next 7 days from today, so a plan made on a Sunday is a full week, not one day.
 for offset in range(7):
  day=today+timedelta(days=offset);i=day.weekday()
  rest=i in prefs.rest_days or i not in prefs.available_days
  if rest:template='recovery'
  elif target and n_strength<want_strength and strong:template=strong[n_strength%len(strong)];n_strength+=1
  elif target and cardio:template=cardio[n_cardio%len(cardio)];n_cardio+=1
  else:template=choices[len(activities)%len(choices)] if choices else None
  if template is None:continue
  activities.append({'template_id':template,'scheduled_day':str(day),'minutes':5 if template=='recovery' else per_cardio if template in CARDIO and target else minutes})
 from services import body_load
 protected=body_load.why_left_out(body_load.protected(prefs.conditions))
 if target and target.get('cardio_min'):
  week=sum(a['minutes'] for a in activities if a['template_id'] in CARDIO)
  from services.health_plan import ACTIVITY_SOURCE
  if week<target['cardio_min']:key=msg('This week: {week} active minutes towards the {target} a week your report suggests. Add a few minutes each week as it gets easier; going up gradually is safest.')
  else:key=msg('This week reaches the {target} active minutes a week your report suggests.')
  values={'week':week,'target':target['cardio_min']}
  report_lines.append({'text':key.replace('{week}',str(week)).replace('{target}',str(target['cardio_min'])),'key':key,'values':values,'source':ACTIVITY_SOURCE+'; ACSM guidelines on gradual progression'})
 return activities,{'report':report_lines,'protected':protected,'priorities':['Professional restrictions and pain feedback block automated exercise','Injured and operated body parts are protected by their stage','Accessibility, equipment and setting eligibility','Explicit rest and available days','Interests and comfort feedback','Conservative duration; never XP/BMI-based progression'],'preferred_time':prefs.workout_time,'professional_review':bool(prefs.professional_restrictions or previous_feedback.get('pain')),'reason':'Only rest options are offered where professional review is needed.' if not choices else 'Activities fit your selected setting, equipment, interests and available days. No automatic difficulty increase.'}

def normalize_measurement(kind,value,unit):
 rules={'height':({'cm':1,'in':2.54},30,275),'weight':({'kg':1,'lb':0.45359237},1,500),'duration':({'minutes':1},0,180),'repetitions':({'reps':1},0,500),'frequency':({'days/week':1},0,7),'hydration':({'ml':1},0,10000),'sleep':({'hours':1},0,24)}
 factors,low,high=rules[kind]
 if unit not in factors:raise ValueError('Unit does not match measurement type.')
 result=value*factors[unit]
 if not low<=result<=high:raise ValueError('Measurement is outside the supported range.')
 return result

def bmi(height_cm,weight_kg,age_group):
 if height_cm is None or weight_kg is None:return {'value':None,'classification':None,'context':tr('Height and weight are optional. No BMI is calculated without both.')}
 value=round(weight_kg/(height_cm/100)**2,1)
 return {'value':value,'classification':None,'context':tr('BMI is a screening calculation, not a diagnosis, and does not describe body composition or individual health. No plan uses it.') if age_group in ('20_64','65plus') else tr('No adult classification is provided for younger or unspecified ages. Age- and sex-specific clinical interpretation is not implemented.')}

def quiet(time,start,end):
 if start==end:return False
 return start<=time<end if start<end else time>=start or time<end


def convert_measurement(kind,value,from_unit,to_unit):
 canonical=normalize_measurement(kind,value,from_unit)
 factors={'height':{'cm':1,'in':2.54},'weight':{'kg':1,'lb':0.45359237}}
 if kind not in factors or to_unit not in factors[kind]:raise ValueError('Unsupported conversion.')
 return canonical/factors[kind][to_unit]

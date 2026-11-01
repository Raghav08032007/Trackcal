"""Builds frontend/web/public/exercise-library.json from free-exercise-db (https://github.com/yuhonas/free-exercise-db).

Usage: python tools/build-exercise-library.py path/to/exercises.json

Only plain facts are kept: name, muscles, equipment, level and category. The dataset's photos and written instructions
are left out on purpose: their original source isn't documented, so they aren't safe to ship in a paid product.
`camera` links an entry to the camera exercise that counts exactly that movement. An entry with no sure match stays unlinked.
"""
import json
import re
import sys
from pathlib import Path

# First match wins. Each pattern must describe the same movement the camera exercise counts, so variations stay unlinked.
CAMERA = [
    ('hspu', r'handstand push'), ('pikepush', r'pike push'), ('decline', r'^decline push'), ('incline', r'^incline push'), ('kneepush', r'^push.?ups? - on knees|^knee push'),
    ('wallpush', r'^wall push'), ('pushup', r'^push.?ups?$|^push.?up$'), ('pullup', r'^pullups?$|^chin.?up$'), ('dip', r'^bench dips?|^dips? - triceps|chair dip'),
    ('ohsquat', r'overhead squat'), ('sumo', r'sumo squat|^plie'), ('squatjump', r'^(freehand|squat) jump|jump squat'), ('pistol', r'pistol squat'),
    ('bulgarian', r'split squat'), ('wsquat', r'^(barbell|front barbell|goblet|dumbbell) squat$|^front squat'), ('squat', r'^bodyweight squat$|^(air|freehand) squat'),
    ('jumplunge', r'scissors? jump|jump lunge'), ('sidelunge', r'^side lunge|^lateral lunge'), ('wlunge', r'^(dumbbell|barbell) (walking )?lunges?$'), ('lunge', r'^bodyweight (walking )?lunge|^walking lunge$|^lunges?$'),
    ('rdl', r'romanian deadlift'), ('deadlift', r'^(barbell )?deadlift$|^sumo deadlift'), ('goodmorning', r'^good morning$|^seated good'), ('kbswing', r'kettlebell.*swing|^one.arm kettlebell swing'),
    ('snatch', r'dumbbell.*snatch|^one.arm dumbbell snatch'), ('cleanpress', r'clean and press'), ('thruster', r'thruster'),
    ('wcalf', r'^(standing )?dumbbell calf raise'), ('calf', r'^(standing )?calf raises?$|^bodyweight.*calf'), ('hipthrust', r'hip thrust'), ('bridge', r'^(butt lift \(bridge\)|glute bridge|bridge)$'),
    ('nordic', r'glute ham raise|nordic'), ('legext', r'^leg extensions?$'), ('legcurl', r'^lying leg curls?$'), ('buttkick', r'butt kick'),
    ('bench', r'^(barbell|dumbbell) bench press'), ('inclinebench', r'^incline (dumbbell|barbell) (bench )?press'), ('pullover', r'pullover'),
    ('skull', r'skull crusher|^lying triceps press'), ('kickback', r'tricep.* kickback'), ('overhead', r'^(standing )?(dumbbell )?(triceps? )?overhead (triceps? )?extension|^standing dumbbell triceps extension'),
    ('conccurl', r'concentration curl'), ('hammer', r'^(alternate )?hammer curls?$'), ('curl', r'^(barbell|dumbbell|dumbbell alternate|alternate) (bicep )?curls?$|^dumbbell bicep curl'),
    ('press', r'^(standing )?(dumbbell|barbell|military)( shoulder)? press$|^seated (dumbbell|barbell) (shoulder )?press'), ('raise', r'^(side )?lateral raise|^side laterals'), ('front', r'front (dumbbell |plate )?raise'),
    ('uprow', r'upright (barbell )?rows?'), ('row', r'^bent over (barbell|two.dumbbell|one.arm dumbbell)?.*row|^one.arm dumbbell row'), ('seatrow', r'^seated (cable )?rows?'), ('latpull', r'^(wide.grip )?lat pulldown'),
    ('revfly', r'reverse fl(y|ies)|rear delt'), ('superman', r'^superman'), ('birddog', r'bird.?dog'), ('crunch', r'^crunch(es)?$'), ('situp', r'^sit.?up$'), ('legraise', r'^(flat bench |lying )?leg raises?$'),
    ('revcrunch', r'^reverse crunch'), ('vup', r'^v.?up|jackknife'), ('flutter', r'flutter kick'), ('bicycle', r'bicycle|air bike'), ('hangleg', r'hanging leg raise'),
    ('sidebend', r'side bend'), ('jack', r'^jumping jacks?$|^star jump'), ('burpee', r'burpee'), ('climber', r'mountain climber'), ('highknee', r'^high knee|^running in place'), ('tuckjump', r'tuck jump|knee tuck jump'), ('shouldertap', r'shoulder tap'),
]
SKIP = r'smith|bosu|depth jump|with chains|with bands|kneeling jump|side jackknife|behind the neck|and pullover|to skull|to front raise|rear delt row|decline barbell pullover|with pal|head on bench|suspended|^wide.grip pull'
LEVEL = {'beginner': 'easy', 'intermediate': 'medium', 'expert': 'hard'}


def main(path):
    rows = json.loads(Path(path).read_text(encoding='utf8'))
    out, linked = [], {}
    for row in rows:
        name = row['name'].strip()
        camera = None
        if row.get('category') != 'stretching' and not re.search(SKIP, name, re.I):
            camera = next((kind for kind, pattern in CAMERA if re.search(pattern, name, re.I)), None)
        if camera: linked.setdefault(camera, []).append(name)
        entry = {'n': name, 'm': row.get('primaryMuscles') or [], 'e': row.get('equipment') or 'other', 'l': LEVEL.get(row.get('level'), 'medium'), 'c': row.get('category') or 'strength'}
        if camera: entry['k'] = camera
        out.append(entry)
    target = Path(__file__).resolve().parent.parent / 'frontend/web/public/exercise-library.json'
    target.write_text(json.dumps({'source': 'free-exercise-db (Unlicense)', 'exercises': out}, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(len(out), 'exercises,', sum(map(len, linked.values())), 'linked to', len(linked), 'camera exercises,', target.stat().st_size // 1024, 'KB')
    for kind in sorted(linked): print(kind, '|', '; '.join(linked[kind])[:150].encode('ascii', 'ignore').decode())


if __name__ == '__main__':
    main(sys.argv[1])

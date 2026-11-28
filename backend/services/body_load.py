"""Which joints and regions each workout loads, and how much, so a plan can protect an injured or operated part.

H is a heavy load (the part does the work or takes impact), L a light one (it is involved but not loaded hard). A part marked
"avoid" rules out every exercise that touches it; a "healing" part rules out heavy ones only; a "recovered" part rules out nothing.
Sides are not separated: the exercises here load both sides.
"""
from __future__ import annotations

from services.i18n import msg

PARTS = ('neck', 'shoulder', 'elbow', 'wrist', 'chest', 'abdomen', 'lower_back', 'hip', 'knee', 'ankle')
H, L = 'H', 'L'


def _load(**parts):
    return {p: v for p, v in parts.items()}


SQUAT = _load(knee=H, hip=H, ankle=L, lower_back=L)
JUMP = _load(knee=H, ankle=H, hip=L)
LUNGE = _load(knee=H, hip=H, ankle=L)
HINGE = _load(lower_back=H, hip=H, knee=L)
PUSH = _load(shoulder=H, elbow=H, wrist=H, chest=H, abdomen=L)
PUSH_LIGHT = _load(shoulder=L, elbow=L, wrist=L, chest=L)
PULL = _load(shoulder=H, elbow=H, wrist=L)
BENT_PULL = _load(shoulder=H, elbow=H, wrist=L, lower_back=H)
PRESS = _load(shoulder=H, elbow=H, wrist=L)
ARM = _load(elbow=H, wrist=L, shoulder=L)
RAISE = _load(shoulder=H, elbow=L)
CORE = _load(abdomen=H, lower_back=L)
CRUNCH = _load(abdomen=H, lower_back=L, neck=L)
PLANK = _load(abdomen=H, shoulder=L, wrist=L, lower_back=L)

LOADS: dict[str, dict[str, str]] = {
    # Gentle, non-camera activities
    'walk': _load(knee=L, ankle=L, hip=L), 'run': _load(knee=H, ankle=H, hip=L), 'cycle': _load(knee=L, hip=L),
    'chair': _load(shoulder=L), 'strength': PUSH_LIGHT, 'gym': _load(shoulder=L, elbow=L, wrist=L), 'mobility': {}, 'recovery': {},
    'yoga': _load(wrist=L, shoulder=L, lower_back=L),
    # Squats and leg drive
    **{f'camera_{k}': SQUAT for k in ('squat', 'frontsquat', 'kbsquat', 'wsquat', 'bandsquat', 'sumo', 'wallsit')},
    'camera_ohsquat': {**SQUAT, 'shoulder': H}, 'camera_thruster': {**SQUAT, 'shoulder': H, 'wrist': L},
    # Jumps and impact
    **{f'camera_{k}': JUMP for k in ('squatjump', 'sumojump', 'tuckjump', 'jumplunge', 'jack', 'highknee', 'buttkick')},
    'camera_burpee': {**JUMP, 'wrist': H, 'shoulder': H, 'chest': L}, 'camera_climber': {**JUMP, 'wrist': H, 'shoulder': L, 'abdomen': L},
    # Lunges and single leg
    **{f'camera_{k}': LUNGE for k in ('lunge', 'wlunge', 'bblunge', 'revlunge', 'sidelunge', 'bulgarian', 'pistol')},
    # Hinges
    **{f'camera_{k}': HINGE for k in ('deadlift', 'kbdeadlift', 'rdl', 'goodmorning', 'bwgoodmorning', 'kbswing')},
    'camera_snatch': {**HINGE, 'shoulder': H, 'wrist': L}, 'camera_cleanpress': {**HINGE, 'shoulder': H, 'wrist': L},
    # Pushing
    **{f'camera_{k}': PUSH for k in ('pushup', 'widepush', 'diamondpush', 'decline', 'pikepush', 'dip', 'kneepush')},
    'camera_hspu': {**PUSH, 'neck': H}, 'camera_incline': PUSH_LIGHT, 'camera_wallpush': PUSH_LIGHT,
    **{f'camera_{k}': PRESS for k in ('press', 'bbpress', 'kbpress', 'bandpress', 'bench', 'inclinebench')},
    # Pulling
    **{f'camera_{k}': PULL for k in ('seatrow', 'latpull', 'pullup', 'bandpulldown', 'pullover', 'uprow', 'kbhighpull', 'bandrow')},
    **{f'camera_{k}': BENT_PULL for k in ('row', 'bbrow', 'kbrow', 'revfly')},
    # Arms and shoulders
    **{f'camera_{k}': ARM for k in ('curl', 'hammer', 'bbcurl', 'bandcurl', 'conccurl', 'kickback', 'bandkickback', 'skull', 'overhead')},
    **{f'camera_{k}': RAISE for k in ('raise', 'front', 'bandraise', 'bandfront')},
    'camera_punch': _load(shoulder=L, elbow=L),
    # Core
    **{f'camera_{k}': CORE for k in ('vup', 'legraise', 'flutter', 'bicycle', 'revcrunch', 'toetouch')},
    'camera_crunch': CRUNCH, 'camera_situp': CRUNCH, 'camera_hangleg': {**CORE, 'shoulder': H, 'wrist': H},
    **{f'camera_{k}': PLANK for k in ('plank', 'shouldertap', 'birddog')},
    'camera_sidebend': _load(lower_back=L, abdomen=L),
    # Hips, glutes, legs
    'camera_bridge': _load(hip=H, lower_back=L), 'camera_bridgehold': _load(hip=H, lower_back=L), 'camera_hipthrust': _load(hip=H, lower_back=L, knee=L),
    'camera_donkey': _load(hip=H, wrist=L, knee=L), 'camera_superman': _load(lower_back=H, shoulder=L), 'camera_sideleg': _load(hip=H),
    'camera_knee': _load(hip=H, knee=L),
    'camera_legcurl': _load(knee=L, hip=L), 'camera_nordic': _load(knee=H, hip=L), 'camera_legext': _load(knee=H),
    'camera_calf': _load(ankle=H), 'camera_wcalf': _load(ankle=H),
    # Yoga and balance
    'camera_downdog': _load(shoulder=L, wrist=H, ankle=L), 'camera_forwardfold': _load(lower_back=L), 'camera_tree': _load(ankle=L, knee=L),
    'camera_warrior': _load(knee=L, hip=L, shoulder=L), 'camera_legbalance': _load(ankle=L, knee=L),
}
# Yoga (frontend lib/yoga/asanas.ts), breathing and meditation. Each asana by what it asks of joints and spine; breathing and
# meditation load nothing. H: weight or end-range on the part; L: light use.
YOGA_LOADS = {
    'tadasana': {}, 'pranamasana': {}, 'urdhva-hastasana': _load(shoulder=L, lower_back=L),
    'utkatasana': _load(knee=H, hip=L, lower_back=L), 'trikonasana': _load(hip=L, knee=L, lower_back=L, neck=L),
    'virabhadrasana-1': _load(knee=H, hip=L, lower_back=L, shoulder=L), 'virabhadrasana-2': _load(knee=H, hip=L, shoulder=L),
    'virabhadrasana-3': _load(knee=L, ankle=H, hip=L, lower_back=L), 'parsvakonasana': _load(knee=H, hip=L, neck=L),
    'prasarita-padottanasana': _load(lower_back=L, hip=L), 'uttanasana': _load(lower_back=L), 'ardha-uttanasana': _load(lower_back=L),
    'ardha-chakrasana': _load(lower_back=H, neck=L), 'malasana': _load(knee=H, ankle=H, hip=L),
    'vrikshasana': _load(ankle=L, knee=L, hip=L), 'natarajasana': _load(ankle=H, knee=L, shoulder=L, lower_back=L), 'ardha-chandrasana': _load(ankle=H, knee=L, wrist=L),
    'vajrasana': _load(knee=H, ankle=H), 'ustrasana': _load(knee=L, lower_back=H, neck=L), 'balasana': _load(knee=H, ankle=L),
    'marjaryasana': _load(wrist=L, knee=L, lower_back=L), 'anjaneyasana': _load(knee=H, hip=L, lower_back=L), 'ashwa-sanchalanasana': _load(knee=H, hip=L, wrist=L),
    'sukhasana': _load(knee=L, hip=L), 'dandasana': _load(lower_back=L), 'paschimottanasana': _load(lower_back=H, hip=L),
    'baddha-konasana': _load(knee=L, hip=L), 'navasana': _load(abdomen=H, lower_back=L, hip=L),
    'phalakasana': PLANK, 'ashtanga-namaskara': _load(wrist=H, shoulder=H, elbow=L, neck=L), 'bhujangasana': _load(lower_back=H, wrist=L),
    'urdhva-mukha-svanasana': _load(lower_back=H, wrist=H, shoulder=L), 'shalabhasana': _load(lower_back=H, neck=L), 'dhanurasana': _load(lower_back=H, knee=L, shoulder=L, neck=L),
    'makarasana': {}, 'setu-bandhasana': _load(lower_back=L, neck=L, knee=L), 'pawanmuktasana': _load(lower_back=L, knee=L),
    'matsyasana': _load(neck=H, lower_back=L), 'shavasana': {}, 'adho-mukha-svanasana': _load(wrist=H, shoulder=L, ankle=L),
    'sarvangasana': _load(neck=H, shoulder=H, lower_back=L),
    'surya-namaskar': _load(wrist=H, shoulder=L, knee=L, lower_back=L),
}
LOADS.update({f'yoga_{k}': v for k, v in YOGA_LOADS.items()})
LOADS.update({k: {} for k in ('breath_calm', 'breath_box', 'breath_nadi-shodhana', 'breath_bhramari', 'breath_ujjayi', 'breath_478', 'breath_kapalbhati',
                              'meditation_silent', 'meditation_breath', 'meditation_body-scan', 'meditation_kindness', 'meditation_sleep')})


LABELS = {'neck': 'neck', 'shoulder': 'shoulder', 'elbow': 'elbow', 'wrist': 'wrist', 'chest': 'chest', 'abdomen': 'abdomen',
          'lower_back': 'lower back', 'hip': 'hip', 'knee': 'knee', 'ankle': 'ankle'}


def region(part):
    """'knee_r' -> 'knee'. The body map has sides; the exercises load both."""
    return part.rsplit('_', 1)[0] if part.endswith(('_l', '_r')) else part


def stage(condition):
    """avoid, healing or recovered, from what the person told us. Recent surgery stays off-limits until a professional clears it."""
    if condition.status == 'avoid':
        return 'avoid'
    if condition.kind == 'surgery' and (condition.when == 'under6w' or (condition.when == '6to12w' and not condition.cleared)):
        return 'avoid'
    if condition.kind == 'injury' and condition.when == 'under6w' and condition.status != 'recovered':
        return 'avoid'
    if condition.status == 'recovered':
        return 'recovered'
    return 'healing'


def protected(conditions):
    """{region: 'avoid' | 'healing'} for every part that limits exercise; the stricter stage wins when two map to one region."""
    out = {}
    for c in conditions:
        s, r = stage(c), region(c.part)
        if s == 'recovered':
            continue
        if out.get(r) != 'avoid':
            out[r] = s
    return out


def allowed(template, guard):
    """False when the workout loads a protected part more than its stage allows."""
    load = LOADS.get(template)
    if load is None:
        return not guard  # an unknown workout is only used when nothing needs protecting
    for part, level in guard.items():
        if part not in load:
            continue
        if level == 'avoid' or (level == 'healing' and load[part] == H):
            return False
    return True


def why_left_out(guard):
    """Plain sentences for the plan screen, in English (they are stored with the plan; shown with services.i18n.tr)."""
    out = []
    for part, level in sorted(guard.items()):
        name = LABELS.get(part, part)
        out.append(f'Nothing that loads your {name} while it heals.' if level == 'avoid' else f'Only light work for your {name}; heavy and impact moves wait until it has recovered.')
    return out


# The sentences why_left_out can produce, each translated as a whole.
PROTECTED_TEXTS = [msg('Nothing that loads your neck while it heals.'), msg('Nothing that loads your shoulder while it heals.'),
    msg('Nothing that loads your elbow while it heals.'), msg('Nothing that loads your wrist while it heals.'),
    msg('Nothing that loads your chest while it heals.'), msg('Nothing that loads your abdomen while it heals.'),
    msg('Nothing that loads your lower back while it heals.'), msg('Nothing that loads your hip while it heals.'),
    msg('Nothing that loads your knee while it heals.'), msg('Nothing that loads your ankle while it heals.'),
    msg('Only light work for your neck; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your shoulder; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your elbow; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your wrist; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your chest; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your abdomen; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your lower back; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your hip; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your knee; heavy and impact moves wait until it has recovered.'),
    msg('Only light work for your ankle; heavy and impact moves wait until it has recovered.')]

"""Whether each exercise suits this person right now, and why not, in plain words.

From what they told us about injuries and surgeries (services/body_load.py) and, if they shared a blood report, its exercise
limit. "avoid" means the app advises against it; "caution" means it is allowed with care. Nothing here is a diagnosis: the
person can still choose to go ahead, and doing so is recorded as their own decision.
"""
from __future__ import annotations

from services import body_load

# High-intensity moves: jumps, impact and explosive lifts.
INTENSE = {f'camera_{k}' for k in ('squatjump', 'sumojump', 'tuckjump', 'jumplunge', 'jack', 'highknee', 'buttkick', 'burpee', 'climber',
                                    'snatch', 'cleanpress', 'kbswing', 'hspu', 'pistol', 'nordic')} | {'run'}
WHEN = {'under6w': 'in the last 6 weeks', '6to12w': '6 to 12 weeks ago', '3to12m': '3 to 12 months ago', 'over1y': 'over a year ago'}


def _what(condition):
    kind = 'surgery' if condition.kind == 'surgery' else 'pain' if condition.kind == 'pain' else 'injury'
    when = WHEN.get(getattr(condition, 'when', None) or '', '')
    return f'{kind} {when}'.strip()


def check(conditions, report_intensity: str | None = None) -> dict:
    """{'exercises': {template: {'level': 'avoid'|'caution', 'reasons': [..]}}, 'protected': {part: stage}, 'report_limit': ..}.
    Exercises with nothing to say are left out."""
    guard = body_load.protected(conditions)
    worst = {}
    for c in conditions:
        r = body_load.region(c.part)
        if r in guard and r not in worst:
            worst[r] = c
    out: dict[str, dict] = {}
    for template, load in body_load.LOADS.items():
        level, reasons = None, []
        for part, stage in guard.items():
            if part not in load:
                continue
            name, why = body_load.LABELS.get(part, part), _what(worst[part]) if part in worst else ''
            if stage == 'avoid':
                level = 'avoid'; reasons.append(f'This works your {name}, which needs to rest after your {why}.' if why else f'This works your {name}, which needs to rest.')
            elif load[part] == body_load.H:
                level = 'avoid'; reasons.append(f'This works your {name} hard while it is still healing.')
            else:
                level = level or 'caution'; reasons.append(f'This uses your {name} a little while it heals. Go gently and stop if it hurts.')
        if report_intensity in ('light', 'moderate') and template in INTENSE:
            level = level or 'caution'
            reasons.append(f'Your blood report suggests keeping exercise {report_intensity} until a doctor reviews it, and this is a high-intensity move.')
        if level:
            out[template] = {'level': level, 'reasons': reasons}
    return {'exercises': out, 'protected': guard, 'report_limit': report_intensity if report_intensity in ('light', 'moderate') else None}

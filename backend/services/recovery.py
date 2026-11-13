"""Recovery from an injury or operation, from the person's daily pain check-ins.

Each injured or operated part has a stage: resting it (no exercise that loads it), easing back (light work only) or recovered.
The profile sets where it starts (services/body_load.stage). Daily check-ins move it, cautiously:

- Pause at once: pain 7 or more, or any warning sign (numbness or tingling, new swelling, pain that wakes you at night, weakness or
  giving way, a new fall or injury, fever). The part goes back to resting and the person is advised to see a doctor.
- Step back: worse two check-ins running (said worse, or pain up by 2 or more). One stage down, and a physiotherapist is suggested.
- Ease back in: 3 days running with pain 2 or less, no worse and no warning signs.
- Recovered: 7 days running with pain 1 or less.
- Nothing lifts a part that the profile keeps off-limits for time reasons: an operation in the last 6 weeks, or one in the last
  3 months not yet cleared by a professional, or an injury in the last 6 weeks. Those wait for time and clearance.

Based on the pain-monitoring model used in rehabilitation (pain up to 2/10 is "safe", 3-5 "acceptable", over 5 "high risk";
Silbernagel et al. 2007, Thomee 1997) and common red-flag guidance for musculoskeletal pain (NICE; NHS). Not a diagnosis.
"""
from __future__ import annotations

from datetime import date

from services import body_load

ORDER = ('avoid', 'healing', 'recovered')
NAMES = {'avoid': 'Resting it', 'healing': 'Easing back', 'recovered': 'Recovered'}
RED_FLAGS = {'numbness': 'Numbness or tingling', 'swelling': 'New swelling or warmth', 'night': 'Pain that wakes you at night',
             'weakness': 'Weakness or giving way', 'injury': 'A new fall or injury', 'fever': 'Fever or feeling unwell'}
PAUSE_PAIN, EASE_PAIN, EASE_DAYS, DONE_PAIN, DONE_DAYS, FRESH_DAYS = 7, 2, 3, 1, 7, 3
SOURCE = 'Pain-monitoring model in rehabilitation (Silbernagel 2007; Thomee 1997); NICE and NHS red-flag guidance'


def _days(day):
    return date.fromisoformat(day)


def _streak(checkins, ceiling):
    """How many check-ins, ending with the latest, sit on consecutive days with pain at or under the ceiling, no worse and no warning sign."""
    n, prev = 0, None
    for c in reversed(checkins):
        if c['pain'] > ceiling or c['trend'] == 'worse' or c.get('red_flags'):
            break
        if prev is not None and (_days(prev) - _days(c['day'])).days != 1:
            break
        n, prev = n + 1, c['day']
    return n


def _worse(prev, cur):
    """Said worse, or pain up by 2 or more since the check-in before."""
    return cur['trend'] == 'worse' or (prev is not None and cur['pain'] - prev['pain'] >= 2)


def _held_by_time(condition):
    """True when the profile keeps the part off-limits for time or clearance, which check-ins must never shorten."""
    return body_load.stage(condition.model_copy(update={'status': 'healing'})) == 'avoid'


def evaluate(condition, checkins, today: date):
    """The part's stage now, why, and what to do. checkins: [{'day', 'pain', 'trend', 'red_flags'}], oldest first."""
    base = body_load.stage(condition)
    recent = [c for c in checkins if (today - _days(c['day'])).days <= 28]
    latest = recent[-1] if recent and (today - _days(recent[-1]['day'])).days < FRESH_DAYS else None
    stage, reason, alert, advice = base, 'Set from what you told us about it.', None, ''
    if latest and (latest.get('red_flags') or latest['pain'] >= PAUSE_PAIN):
        flags = [RED_FLAGS.get(f, f) for f in latest.get('red_flags') or []]
        stage, alert = 'avoid', 'doctor'
        reason = f"You reported {', '.join(flags).lower()}." if flags else f"Your pain was {latest['pain']} out of 10."
        advice = 'Exercise for this area is paused. Please see a doctor, or a physiotherapist, before you start again.'
    elif latest and len(recent) >= 2 and _worse(recent[-3] if len(recent) > 2 else None, recent[-2]) and _worse(recent[-2], recent[-1]):
        stage, alert = ORDER[max(0, ORDER.index(base) - 1)], 'physio'
        reason = 'It has been getting worse two check-ins running.'
        advice = 'We have stepped back to lighter work for this area. If it keeps getting worse, see a physiotherapist or doctor.'
    elif latest and latest['pain'] > EASE_PAIN and base == 'recovered':
        stage, reason = 'healing', f"Your pain was {latest['pain']} out of 10, so only light work for now."
    elif _held_by_time(condition) and base == 'avoid':
        reason = 'Recent surgery or injury: this area rests until enough time has passed' + (' and a professional has cleared it.' if condition.kind == 'surgery' else '.')
    else:
        ease, done = _streak(recent, EASE_PAIN), _streak(recent, DONE_PAIN)
        if base != 'recovered' and done >= DONE_DAYS:
            stage, reason = 'recovered', f'{done} days running with pain 1 or less.'
        elif base == 'avoid' and ease >= EASE_DAYS:
            stage, reason = 'healing', f'{ease} days running with pain 2 or less, so light work can start again.'
        elif recent and base != 'recovered':
            reason = f"{ease} of {EASE_DAYS} steady days so far." if base == 'avoid' else f"{done} of {DONE_DAYS} days with pain 1 or less so far."
    nxt = ''
    if alert is None and stage == 'avoid' and not _held_by_time(condition):
        nxt = f'{max(0, EASE_DAYS - _streak(recent, EASE_PAIN))} more day(s) with pain 2 or less to start easing back.'
    elif alert is None and stage == 'healing':
        nxt = f'{max(0, DONE_DAYS - _streak(recent, DONE_PAIN))} more day(s) with pain 1 or less to count as recovered.'
    return {'part': condition.part, 'label': body_load.LABELS.get(body_load.region(condition.part), condition.part).replace('_', ' '),
            'side': {'l': 'left', 'r': 'right'}.get(condition.part.rsplit('_', 1)[-1]) if condition.part.endswith(('_l', '_r')) else None,
            'kind': condition.kind, 'base': base, 'stage': stage, 'stage_name': NAMES[stage], 'reason': reason, 'alert': alert, 'advice': advice,
            'next': nxt, 'checked_today': bool(recent and recent[-1]['day'] == today.isoformat()), 'history': recent[-28:], 'source': SOURCE}


def effective_conditions(conditions, checkins_by_part, today: date):
    """The profile's conditions with each one's stage as the check-ins have moved it, for every place that protects body parts."""
    out = []
    for c in conditions:
        stage = evaluate(c, checkins_by_part.get(c.part, []), today)['stage']
        out.append(c.model_copy(update={'status': stage, 'cleared': c.cleared}) if stage != body_load.stage(c) else c)
    return out

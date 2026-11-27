"""Adaptive calorie target: your real daily burn from what you ate and how your weight moved.

Over the last 28 days: the average intake on fully logged days, and the weight trend (a least-squares line through the
weigh-ins, so one heavy morning doesn't swing it). Energy balance: burn = intake - (weight change x 7700 kcal/kg) / days.
With little data the formula estimate (services/targets.py) carries most of the weight; at three weeks of logging the
measured value is trusted fully. The suggestion applies the same goal adjustment and safety floor as the formula, and the
person decides whether to use it.
"""
from __future__ import annotations

from datetime import date

KCAL_PER_KG = 7700
WINDOW = 28
MIN_DAY_KCAL = 800          # a day under this was most likely logged in part, so it is left out
MIN_LOGGED_DAYS = 10
MIN_WEIGH_SPAN = 10         # days between the first and last weigh-in
FULL_TRUST_DAYS = 21


def _slope(points):
    """kg per day from (day number, kg) pairs: least squares."""
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    den = sum((x - mx) ** 2 for x, _ in points)
    return sum((x - mx) * (y - my) for x, y in points) / den if den else 0.0


def estimate(intake, weights, formula_maintenance, today, adjustment=0, floor=1200):
    """intake: {date: kcal}; weights: [(date, kg)]; formula_maintenance: kcal from the profile formula (or None).

    Returns {'ready', 'reason', 'burn', 'measured_burn', 'trend_kg_per_week', 'logged_days', 'weigh_ins', 'trust',
             'suggested', 'check_logging'}."""
    start = today.toordinal() - WINDOW
    days = {d: k for d, k in intake.items() if start < d.toordinal() <= today.toordinal() and k >= MIN_DAY_KCAL}
    weigh = sorted((d, kg) for d, kg in weights if start < d.toordinal() <= today.toordinal() and kg and kg > 20)
    out = {'ready': False, 'reason': '', 'burn': None, 'measured_burn': None, 'trend_kg_per_week': None,
           'logged_days': len(days), 'weigh_ins': len(weigh), 'trust': 0.0, 'suggested': None, 'check_logging': False}
    if len(days) < MIN_LOGGED_DAYS:
        out['reason'] = 'more_logging'
        return out
    if len(weigh) < 3 or weigh[-1][0].toordinal() - weigh[0][0].toordinal() < MIN_WEIGH_SPAN:
        out['reason'] = 'more_weighins'
        return out
    slope = _slope([(d.toordinal(), kg) for d, kg in weigh])
    avg_intake = sum(days.values()) / len(days)
    measured = avg_intake - slope * KCAL_PER_KG
    trust = min(1.0, len(days) / FULL_TRUST_DAYS)
    burn = measured if formula_maintenance is None else trust * measured + (1 - trust) * formula_maintenance
    # A measured burn far from the formula usually means meals were left out (or the scale moved for other reasons).
    check = formula_maintenance is not None and not 0.7 * formula_maintenance <= measured <= 1.35 * formula_maintenance
    if check and formula_maintenance is not None:
        burn = max(0.8 * formula_maintenance, min(1.25 * formula_maintenance, burn))
    target = burn + adjustment
    if adjustment < 0:
        target = max(floor, target)
    out.update(ready=True, burn=int(round(burn / 10) * 10), measured_burn=int(round(measured / 10) * 10),
               trend_kg_per_week=round(slope * 7, 2), trust=round(trust, 2), suggested=int(round(target / 10) * 10), check_logging=check)
    return out

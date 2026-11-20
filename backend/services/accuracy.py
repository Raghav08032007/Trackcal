"""Accuracy from real use: how far the app's estimates were from what people kept.

Nothing new is asked of anyone. The numbers come from corrections people already make:
- Food photos: when a meal that began as an AI photo estimate is saved, the AI's calories and grams are kept next to the
  saved values (AccuracySample, kind 'food_photo'). A later edit of that meal in the diary updates the saved values,
  because the app asks people to correct the entry there.
- Camera reps: each counted set already stores the camera's count and the person's correction (WorkoutSession.details).
- Barcodes: the lookup cache shows how often a scanned code was found. That is catalogue coverage, not accuracy, and the
  report says so.

Reports cover a recent window and say when there are too few samples to judge (MIN_SAMPLES)."""
from datetime import timedelta
from statistics import median

import models
from timeutil import utcnow

MIN_SAMPLES = 30
FOOD_TARGET_PCT = 20       # within ±20 % of what the person kept
REP_TARGET_SHARE = 0.90    # 90 % of sets within ±1 rep (KI-21)


def _total_grams(log):
    return round(sum(item.quantity_g or 0 for item in log.items), 1)


def record_food(db, user_id, log, estimate):
    """A meal saved from an AI photo estimate: keep the AI's numbers beside the saved ones."""
    sample = db.query(models.AccuracySample).filter_by(kind='food_photo', source_id=log.id).first()
    if sample: return sample
    sample = models.AccuracySample(user_id=str(user_id), kind='food_photo', source_id=log.id, estimate=float(estimate.calories),
                                   final=float(log.total_calories or 0), estimate_aux=float(estimate.grams), final_aux=_total_grams(log))
    db.add(sample)
    return sample


def update_food(db, log):
    """The person corrected the meal in the diary: the corrected values are the ones to compare with."""
    sample = db.query(models.AccuracySample).filter_by(kind='food_photo', source_id=log.id).first()
    if sample:
        sample.final, sample.final_aux, sample.updated_at = float(log.total_calories or 0), _total_grams(log), utcnow()


def _pct(estimate, final):
    """Signed error of the estimate as a % of what was kept (positive: the estimate was too high)."""
    if not final: return None
    return (estimate - final) / final * 100


def _status(n, ok):
    if n < MIN_SAMPLES: return 'not_enough_data'
    return 'meets_target' if ok else 'below_target'


def food_report(db, since):
    rows = db.query(models.AccuracySample).filter(models.AccuracySample.kind == 'food_photo', models.AccuracySample.created_at >= since).all()
    errors = [e for e in (_pct(r.estimate, r.final) for r in rows) if e is not None]
    n = len(errors)
    unchanged = sum(1 for r in rows if abs(r.estimate - r.final) <= max(1.0, 0.02 * (r.final or 0)))
    within = sum(1 for e in errors if abs(e) <= FOOD_TARGET_PCT)
    share_within = within / n if n else None
    return {'area': 'food_photo', 'samples': len(rows),
            'kept_unchanged': round(unchanged / len(rows), 3) if rows else None,
            'within_target': round(share_within, 3) if share_within is not None else None, 'target': f'±{FOOD_TARGET_PCT}% of the calories kept',
            'median_abs_error_pct': round(median(abs(e) for e in errors), 1) if errors else None,
            'median_bias_pct': round(median(errors), 1) if errors else None,
            'status': _status(n, share_within is not None and share_within >= 0.8)}


def camera_report(db, since):
    sessions = (db.query(models.WorkoutSession.details).filter(models.WorkoutSession.status == 'completed', models.WorkoutSession.completed_at >= since).all())
    sets, by_exercise = [], {}
    for (details,) in sessions:
        tracking = (details or {}).get('tracking') or {}
        if (details or {}).get('tracking_method') != 'camera': continue
        exercise = tracking.get('exercise_type') or 'unknown'
        for s in tracking.get('sets') or []:
            counted, corrected = s.get('estimated_reps'), s.get('corrected_reps')
            if not isinstance(counted, (int, float)): continue
            kept = counted if corrected is None else corrected
            if not isinstance(kept, (int, float)) or kept <= 0 and counted <= 0: continue
            sets.append((counted, kept)); by_exercise.setdefault(exercise, []).append((counted, kept))

    def summary(pairs):
        n = len(pairs)
        within = sum(1 for c, k in pairs if abs(c - k) <= 1)
        return {'sets': n, 'kept_unchanged': round(sum(1 for c, k in pairs if c == k) / n, 3) if n else None,
                'within_one_rep': round(within / n, 3) if n else None,
                'mean_abs_error_reps': round(sum(abs(c - k) for c, k in pairs) / n, 2) if n else None}

    total = summary(sets)
    return {'area': 'camera_reps', **total, 'target': f'{int(REP_TARGET_SHARE * 100)}% of sets within ±1 rep',
            'status': _status(total['sets'], (total['within_one_rep'] or 0) >= REP_TARGET_SHARE),
            'by_exercise': [{'exercise': name, **summary(pairs)} for name, pairs in sorted(by_exercise.items(), key=lambda kv: -len(kv[1]))[:8]]}


def barcode_report(db, since):
    rows = db.query(models.BarcodeCache.found).filter(models.BarcodeCache.fetched_at >= since).all()
    n = len(rows); found = sum(1 for (f,) in rows if f)
    return {'area': 'barcode_coverage', 'lookups': n, 'found': round(found / n, 3) if n else None,
            'note': 'How often a scanned code was in the food database (coverage, not accuracy).',
            'status': 'not_enough_data' if n < MIN_SAMPLES else 'measured'}


def report(db, days=90):
    since = utcnow() - timedelta(days=days)
    return {'days': days, 'min_samples': MIN_SAMPLES, 'areas': [food_report(db, since), camera_report(db, since), barcode_report(db, since)]}

"""Server-side feature flags. Every new module ships behind one, off by default (Master Rule 8).

Resolution order: FEATURE_<KEY> environment variable, then the feature_flags row, then the registry default.
Unknown keys raise, so a typo can never silently enable or hide a module.
"""
import os

import models

REGISTRY = {
    'web_push': 'Opt-in web push reminders (Phase 4)',
    'billing': 'Paid plans, checkout and entitlements (Phase 5)',
    'social_feed': 'Social feed (Phase 7)',
    'communities': 'Communities (Phase 8)',
    'verified_events': 'Verified events and QR check-in (Phase 9)',
    'verified_challenges': 'Verified challenges (Phase 10)',
    'advanced_progression': 'Advanced character progression (Phase 11)',
    'organizer_saas': 'Organizer and trainer workspace (Phase 12)',
}
DEFAULT = False


def _env(key):
    raw = os.getenv(f'FEATURE_{key.upper()}')
    if raw is None: return None
    if raw.strip().lower() in ('1', 'true', 'on', 'yes'): return True
    if raw.strip().lower() in ('0', 'false', 'off', 'no'): return False
    raise ValueError(f'FEATURE_{key.upper()} must be true or false')


def is_enabled(db, key):
    if key not in REGISTRY: raise KeyError(f'Unknown feature flag: {key}')
    override = _env(key)
    if override is not None: return override
    row = db.get(models.FeatureFlag, key)
    return row.enabled if row else DEFAULT


def all_flags(db):
    return {key: is_enabled(db, key) for key in REGISTRY}


def set_flag(db, key, enabled, actor):
    if key not in REGISTRY: raise KeyError(f'Unknown feature flag: {key}')
    row = db.get(models.FeatureFlag, key) or models.FeatureFlag(key=key)
    row.enabled = bool(enabled); row.updated_by = actor[:100]
    db.add(row); db.flush(); return row

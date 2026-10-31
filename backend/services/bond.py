"""Companion bond (Phase 11, flag `advanced_progression`).

XP earned while a companion is active builds your bond with that companion. Nothing is bought or decays: a bond never
goes down, missing a day costs nothing, and Premium doesn't speed it up. XP from before the flag was on belongs to no
companion, so it counts toward no bond. Reaching a stage with any companion unlocks its aura and title for good."""
from sqlalchemy import func

import models
from services.feature_flags import is_enabled

STAGES = [
    {'id': 'new', 'name': 'New friends', 'xp': 0, 'aura': 'none', 'title': ''},
    {'id': 'friends', 'name': 'Good friends', 'xp': 250, 'aura': 'glow', 'title': 'Steady friend'},
    {'id': 'partners', 'name': 'Trusted partners', 'xp': 750, 'aura': 'sparkle', 'title': 'Trusted partner'},
    {'id': 'team', 'name': 'A real team', 'xp': 1500, 'aura': 'halo', 'title': 'True teammate'},
]
AURAS = tuple(s['aura'] for s in STAGES)
TITLES = tuple(s['title'] for s in STAGES)


def enabled(db):
    return is_enabled(db, 'advanced_progression')


def stage_for(xp):
    return [s for s in STAGES if xp >= s['xp']][-1]


def view(db, user):
    rows = db.query(models.RewardEvent.companion_id, func.sum(models.RewardEvent.xp)).filter(
        models.RewardEvent.user_id == user.id, models.RewardEvent.companion_id.isnot(None), models.RewardEvent.xp > 0).group_by(models.RewardEvent.companion_id).all()
    totals = {companion: int(xp) for companion, xp in rows}
    prefs = db.get(models.CharacterCustomization, user.id)
    active = prefs.character_id if prefs else 'pip'
    xp, stage = totals.get(active, 0), stage_for(totals.get(active, 0))
    following = next((s for s in STAGES if s['xp'] > xp), None)
    reached = [s for s in STAGES if any(v >= s['xp'] for v in totals.values()) or s['xp'] == 0]
    return {'companion': active, 'xp': xp, 'stage': stage['id'], 'stage_name': stage['name'],
            'next': {'name': following['name'], 'xp': following['xp'], 'remaining': following['xp'] - xp} if following else None,
            'stages': [{'id': s['id'], 'name': s['name'], 'xp': s['xp'], 'reached': s in reached} for s in STAGES],
            'auras': [s['aura'] for s in reached], 'titles': [s['title'] for s in reached if s['title']],
            'aura': prefs.aura if prefs else 'none', 'title': prefs.title if prefs else '',
            'others': [{'companion': c, 'xp': v, 'stage_name': stage_for(v)['name']} for c, v in sorted(totals.items()) if c != active]}

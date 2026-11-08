"""One day of everyday wellness: water, movement, calories burned, sleep and how the person felt.

Counters (water, calories burned, steps, minutes) change by amounts, so taps on two phones add up instead of
overwriting each other. Everything else is set. Recorded routes add their calories when the day is read.
"""
import re
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field

import models

DAY = re.compile(r'^\d{4}-\d{2}-\d{2}$')
LIMITS = {'water_ml': 20000, 'steps': 150000, 'active_minutes': 1440, 'burn_kcal': 10000}
COUNTERS = tuple(LIMITS)
HISTORY_DAYS = 35


class DaySet(BaseModel):
    model_config = ConfigDict(extra='forbid')
    water_ml: Optional[int] = Field(None, ge=0, le=20000)
    water_goal_ml: Optional[int] = Field(None, ge=500, le=8000)
    steps: Optional[int] = Field(None, ge=0, le=150000)
    active_minutes: Optional[int] = Field(None, ge=0, le=1440)
    activity: Optional[str] = Field(None, max_length=100)
    burn_kcal: Optional[float] = Field(None, ge=0, le=10000)
    weight_kg: Optional[float] = Field(None, ge=20, le=400)
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    sleep_quality: Optional[Literal['poor', 'ok', 'good']] = None
    energy: Optional[Literal['low', 'ok', 'great']] = None
    sore: Optional[Literal['no', 'bit', 'very']] = None


class DayAdd(BaseModel):
    model_config = ConfigDict(extra='forbid')
    water_ml: int = Field(0, ge=-5000, le=5000)
    steps: int = Field(0, ge=-150000, le=150000)
    active_minutes: int = Field(0, ge=-1440, le=1440)
    burn_kcal: float = Field(0, ge=-5000, le=5000)


class DayUpdate(BaseModel):
    """`set` replaces fields (null clears one); `add` changes a counter by an amount, never below zero."""
    model_config = ConfigDict(extra='forbid')
    set: DaySet = Field(default_factory=DaySet)
    add: DayAdd = Field(default_factory=DayAdd)


class ImportedDay(DaySet):
    day: str = Field(pattern=DAY.pattern)


class DayImport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    days: list[ImportedDay] = Field(max_length=400)


def check_day(text, tz):
    """A real calendar day, not before 2000 and not after tomorrow where the person is."""
    if not isinstance(text, str) or not DAY.match(text): raise ValueError('Use a date like 2026-11-08.')
    try: value = date.fromisoformat(text)
    except ValueError: raise ValueError('That date does not exist.')
    today = datetime.now(timezone.utc).astimezone(ZoneInfo(tz)).date()
    if value < date(2000, 1, 1) or value > today + timedelta(days=1): raise ValueError('That date is outside what can be logged.')
    return text


def water_goal(weight):
    """About 35 ml per kg, rounded to 50 ml, between 1.5 and 4 litres; 2 litres without a weight."""
    return 2000 if not weight else int(min(4000, max(1500, round(weight * 35 / 50) * 50)))


def route_kcal(activity, weight):
    """Calories for a recorded route: per kg per km on foot (plus climbing), by speed on a bike."""
    km, hours, kg = activity.distance_m / 1000, max(activity.moving_s, 0) / 3600, weight or 70
    climb = kg * (activity.elevation_gain_m or 0) * 9.81 / 4184 / 0.25        # work against gravity at ~25% efficiency
    if activity.sport == 'ride':
        speed = km / hours if hours else 0
        met = 4 if speed < 16 else 6.8 if speed < 19 else 8 if speed < 22 else 10 if speed < 25 else 12
        return met * kg * hours
    return {'run': 1.0, 'hike': 0.6}.get(activity.sport, 0.5) * kg * km + climb


def routes_by_day(db, user_id, tz, first, last, weight):
    """Calories from recorded routes (not camera sessions, whose calories are already logged), by local day."""
    zone = ZoneInfo(tz)
    start = datetime.combine(date.fromisoformat(first), datetime.min.time(), zone).astimezone(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
    end = datetime.combine(date.fromisoformat(last) + timedelta(days=1), datetime.min.time(), zone).astimezone(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    totals = {}
    for row in db.query(models.Activity).filter(models.Activity.user_id == user_id, models.Activity.is_deleted.is_(False), models.Activity.session_id.is_(None),
                                                 models.Activity.started_at >= start, models.Activity.started_at < end):
        key = row.started_at.replace(tzinfo=timezone.utc).astimezone(zone).date().isoformat()
        if first <= key <= last: totals[key] = totals.get(key, 0) + route_kcal(row, weight)
    return totals


def half_up(value):
    return int(value + 0.5)


def view(day, row, weight, routes_kcal=0.0):
    logged = round(row.burn_kcal, 1) if row else 0
    goal = row.water_goal_ml if row and row.water_goal_ml else None
    return {'day': day, 'water_ml': row.water_ml if row else 0, 'water_goal_ml': goal or water_goal(weight), 'water_goal_set': bool(goal), 'water_goal_basis': 'yours' if goal else 'weight' if weight else 'general',
            'steps': row.steps if row else 0, 'active_minutes': row.active_minutes if row else 0, 'activity': row.activity if row else '',
            'burn_kcal': logged, 'route_kcal': half_up(routes_kcal), 'burned_total': half_up(logged + routes_kcal),
            'weight_kg': row.weight_kg if row else None, 'sleep_hours': row.sleep_hours if row else None, 'sleep_quality': row.sleep_quality if row else None,
            'energy': row.energy if row else None, 'sore': row.sore if row else None, 'saved': bool(row)}


def row_for(db, user_id, day, create=True):
    row = db.query(models.DailyWellness).filter_by(user_id=user_id, day=day).with_for_update().first()
    if not row and create:
        row = models.DailyWellness(user_id=user_id, day=day, water_ml=0, steps=0, active_minutes=0, activity='', burn_kcal=0)
        db.add(row); db.flush()
    return row


def apply(row, update: DayUpdate):
    for field, value in update.set.model_dump(exclude_unset=True).items():
        if field in COUNTERS and value is None: value = 0
        if field == 'activity': value = (value or '').strip()
        setattr(row, field, value)
    for field, amount in update.add.model_dump().items():
        if amount: setattr(row, field, min(LIMITS[field], max(0, (getattr(row, field) or 0) + amount)))
    if isinstance(row.burn_kcal, float): row.burn_kcal = round(row.burn_kcal, 1)


def fill_gaps(row, imported: ImportedDay):
    """A day copied from this browser only fills what the account has not logged, so copying twice changes nothing."""
    changed = False
    for field, value in imported.model_dump(exclude={'day'}, exclude_none=True).items():
        if value in (0, '') : continue
        current = getattr(row, field)
        if current in (None, 0, ''):
            setattr(row, field, value.strip() if isinstance(value, str) else value); changed = True
    return changed

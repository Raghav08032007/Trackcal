"""Pure nutrition arithmetic shared by the API (mirrored in frontend/web/src/lib/nutrition-math.ts).

Rules: values are per 100 g unless stated; an unknown value is None and stays None (never 0); totals over
items with unknown values are reported as partial; calories round to a whole number, macros to one decimal,
both with halves rounding up (as in JavaScript), so the server and the app always show the same numbers.
"""
import math

MACROS = ("protein_g", "carbs_g", "fat_g")
FIELDS = ("energy_kcal", *MACROS)
ATWATER = {"protein_g": 4.0, "carbs_g": 4.0, "fat_g": 9.0}
CONSISTENCY_TOLERANCE = 0.20  # 20%
# Grams per household measure when no product-specific weight is known (common Indian kitchen sizes).
SERVING_UNITS_G = {"g": 1.0, "katori": 150.0, "cup": 240.0, "tablespoon": 15.0, "teaspoon": 5.0}


def _round_half_up(value, places):
    factor = 10 ** places
    return math.floor(value * factor + 0.5) / factor


def round_value(field, value):
    if value is None: return None
    return int(_round_half_up(value, 0)) if field == "energy_kcal" else _round_half_up(value, 1)


def _valid(value):
    return value is None or (isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0)


def scale(per_100g, grams):
    """Nutrients for `grams` of a food given per-100 g values. Unknown stays unknown."""
    if not (isinstance(grams, (int, float)) and not isinstance(grams, bool) and math.isfinite(grams) and grams >= 0):
        raise ValueError("Grams must be a finite, non-negative number.")
    result = {}
    for field in FIELDS:
        value = per_100g.get(field)
        if not _valid(value): raise ValueError(f"{field} must be a finite, non-negative number or unknown.")
        result[field] = None if value is None else value * grams / 100
    return result


def serving_grams(unit, quantity=1.0, grams_per_piece=None):
    """Weight of a serving: 'piece' needs the food's own piece weight; other units use SERVING_UNITS_G."""
    if not (isinstance(quantity, (int, float)) and math.isfinite(quantity) and quantity >= 0): raise ValueError("Quantity must be a finite, non-negative number.")
    if unit == "piece":
        if grams_per_piece is None: return None  # unknown, never guessed
        return quantity * grams_per_piece
    if unit not in SERVING_UNITS_G: raise ValueError(f"Unknown serving unit: {unit}")
    return quantity * SERVING_UNITS_G[unit]


def total(items):
    """Sum unrounded item nutrients. Returns (totals, partial): a field is None if every item's value is unknown,
    and `partial` lists fields where some, but not all, items were unknown (the shown total is a lower bound)."""
    totals, partial = {}, []
    for field in FIELDS:
        known = [item.get(field) for item in items if item.get(field) is not None]
        totals[field] = sum(known) if known else None
        if known and len(known) < len(items): partial.append(field)
    return totals, partial


def rounded(values):
    return {field: round_value(field, values.get(field)) for field in FIELDS}


def consistency_warning(values):
    """True when calories differ from 4·protein + 4·carbs + 9·fat by more than 20% ("please double-check").
    Unknown values or tiny amounts (under 20 kcal either way) are not judged."""
    if any(values.get(field) is None for field in FIELDS): return False
    expected = sum(values[field] * ATWATER[field] for field in MACROS)
    stated = values["energy_kcal"]
    if max(expected, stated) < 20: return False
    return abs(stated - expected) > CONSISTENCY_TOLERANCE * max(expected, stated)

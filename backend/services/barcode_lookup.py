"""Barcode lookups with Open Food Facts: validation, caching, a retry, a circuit breaker and honest mapping.

- Accepts EAN-13, EAN-8 and UPC-A (12) with a valid GS1 check digit.
- Cache: a found product for 30 days, "not found" for 24 hours (table barcode_cache).
- Live call: 5 s timeout, one retry on a timeout or server error, descriptive User-Agent (OFF's terms).
  After 3 failures in a row the breaker opens for 60 s and lookups fail fast with "unavailable".
- Mapping: per-100 g values; a missing or non-numeric nutrient is None (unknown), never 0. kJ is converted.
- Nothing is ever written back to Open Food Facts.
"""
import os
import re
import threading
import time
from datetime import datetime, timedelta

import httpx
from sqlalchemy.dialects.mysql import insert as mysql_insert

import models
from services import nutrition_math
from timeutil import utcnow

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
# Open Food Facts asks for "AppName/Version (contact)". Set OPEN_FOOD_FACTS_CONTACT to an operator email before launch.
USER_AGENT = f"{os.getenv('OPEN_FOOD_FACTS_APP_NAME', 'TrackCal')}/{os.getenv('OPEN_FOOD_FACTS_APP_VERSION', '1.0')} ({os.getenv('OPEN_FOOD_FACTS_CONTACT', 'nutrition journal')})"
FOUND_TTL, MISSING_TTL = timedelta(days=30), timedelta(hours=24)
TIMEOUT_S, BREAKER_FAILURES, BREAKER_OPEN_S = 5.0, 3, 60.0
ATTRIBUTION = "Data from Open Food Facts contributors (ODbL). Community-contributed data may be wrong; check the label."
NUTRIENTS = {  # our field -> (OFF per-100g key, multiplier)
    "energy_kcal": ("energy-kcal_100g", 1.0), "protein_g": ("proteins_100g", 1.0), "carbs_g": ("carbohydrates_100g", 1.0),
    "fat_g": ("fat_100g", 1.0), "fiber_g": ("fiber_100g", 1.0), "sugar_g": ("sugars_100g", 1.0),
    "saturated_fat_g": ("saturated-fat_100g", 1.0), "sodium_mg": ("sodium_100g", 1000.0),
}


class LookupError_(Exception):
    """status: 'invalid' (bad code), 'not_found' or 'unavailable' (provider down, rate-limited or breaker open)."""
    def __init__(self, status, message):
        super().__init__(message); self.status = status


# ── Validation ────────────────────────────────────────────────────────────────

def check_digit_ok(code):
    digits = [int(c) for c in code]
    body, check = digits[:-1], digits[-1]
    weighted = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return (10 - weighted % 10) % 10 == check


def normalize(code):
    """Digits only (spaces and dashes removed); EAN-8, UPC-A or EAN-13 with a valid check digit."""
    clean = re.sub(r"[\s-]", "", str(code or ""))
    if not re.fullmatch(r"\d{8}|\d{12}|\d{13}", clean): raise LookupError_("invalid", "Enter an 8, 12 or 13 digit barcode (EAN-8, UPC-A or EAN-13).")
    if not check_digit_ok(clean): raise LookupError_("invalid", "This barcode's check digit does not match. Re-scan or retype it.")
    return clean


# ── Mapping (defensive) ───────────────────────────────────────────────────────

def number(value):
    """A finite, non-negative number from OFF data (numbers or numeric strings, comma decimals allowed), else None."""
    if value is None or isinstance(value, bool): return None
    if isinstance(value, str):
        value = value.strip().replace(",", ".")
        if not re.fullmatch(r"\d+(\.\d+)?", value): return None
    try: result = float(value)
    except (TypeError, ValueError): return None
    return result if result >= 0 and result == result and result != float("inf") else None


def serving_grams(text):
    """Grams from serving strings like '30 g', '1 bar (45g)' or '250 ml' (ml counted as g, noted as approximate)."""
    if not isinstance(text, str): return None
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grams|ml)\b", text.lower())
    return number(match.group(1)) if match else None


def map_product(code, product):
    n = product.get("nutriments") or {}
    values = {}
    for field, (key, multiplier) in NUTRIENTS.items():
        value = number(n.get(key))
        values[field] = None if value is None else value * multiplier
    if values["energy_kcal"] is None:  # only kJ given: convert (OFF's plain energy_100g is in kJ)
        kilojoules = number(n.get("energy-kj_100g"))
        if kilojoules is None: kilojoules = number(n.get("energy_100g"))
        if kilojoules is not None: values["energy_kcal"] = kilojoules / 4.184
    core = {field: values[field] for field in nutrition_math.FIELDS}
    name = (product.get("product_name") or product.get("product_name_en") or "").strip() or None
    tags = product.get("allergens_tags") if isinstance(product.get("allergens_tags"), list) else []
    return {
        "barcode": code, "product_name": name, "brand": (product.get("brands") or "").strip() or None,
        "serving_size": product.get("serving_size") if isinstance(product.get("serving_size"), str) else None,
        "serving_g": serving_grams(product.get("serving_size")),
        "nova_group": product.get("nova_group") if product.get("nova_group") in (1, 2, 3, 4) else None,
        "nutrients_per_100g": {field: (None if value is None else round(value, 3)) for field, value in values.items()},
        "complete": all(value is not None for value in core.values()),
        "consistency_warning": nutrition_math.consistency_warning(core),
        "allergens": [re.sub(r"^[a-z]{2}:", "", tag).replace("-", " ") for tag in tags if isinstance(tag, str)],
        "ingredients_text": (product.get("ingredients_text") or "").strip() or None,
        "source": "Open Food Facts", "attribution": ATTRIBUTION, "community_data": True,
    }


# ── Live provider with breaker ────────────────────────────────────────────────

class _Breaker:
    def __init__(self):
        self.lock, self.failures, self.open_until = threading.Lock(), 0, 0.0

    def allow(self):
        with self.lock: return time.monotonic() >= self.open_until

    def record(self, ok):
        with self.lock:
            if ok: self.failures = 0; return
            self.failures += 1
            if self.failures >= BREAKER_FAILURES: self.open_until, self.failures = time.monotonic() + BREAKER_OPEN_S, 0


breaker = _Breaker()


def _http_get(url):
    """The one network call (tests replace it)."""
    return httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT_S)


def fetch(code):
    """Returns the OFF product dict, or None when OFF says it does not exist. Raises LookupError_('unavailable')."""
    if not breaker.allow(): raise LookupError_("unavailable", "Open Food Facts is temporarily unavailable. Enter nutrition from the label, or retry in a minute.")
    for attempt in range(2):
        try:
            response = _http_get(OFF_URL.format(code=code))
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt == 0: continue
            breaker.record(False); raise LookupError_("unavailable", "Open Food Facts did not respond. Enter nutrition from the label, or retry.")
        if response.status_code == 404: breaker.record(True); return None
        if response.status_code == 429: breaker.record(False); raise LookupError_("unavailable", "Open Food Facts is busy (rate limit). Retry shortly or enter nutrition from the label.")
        if response.status_code >= 500:
            if attempt == 0: continue
            breaker.record(False); raise LookupError_("unavailable", "Open Food Facts is unavailable. Enter nutrition from the label, or retry.")
        if response.status_code != 200: breaker.record(False); raise LookupError_("unavailable", "Open Food Facts returned an unexpected answer. Retry or enter nutrition manually.")
        try: data = response.json()
        except ValueError: breaker.record(False); raise LookupError_("unavailable", "Open Food Facts returned unreadable data. Retry or enter nutrition manually.")
        breaker.record(True)
        return data.get("product") if data.get("status") == 1 and isinstance(data.get("product"), dict) else None
    raise LookupError_("unavailable", "Open Food Facts is unavailable.")  # not reached


# ── Public entry point ────────────────────────────────────────────────────────

_inflight, _inflight_lock = {}, threading.Lock()


def lookup(db, raw_code, now=None):
    """Product dict (with 'cached'), or raises LookupError_. Concurrent lookups of one code make one live call."""
    code, now = normalize(raw_code), now or utcnow()
    row = db.get(models.BarcodeCache, code)
    if row and row.expires_at > now:
        if not row.found: raise LookupError_("not_found", "Product not found in Open Food Facts. Enter its nutrition from the label.")
        return {**row.product, "cached": True}
    with _inflight_lock: gate = _inflight.setdefault(code, threading.Lock())
    try:
        with gate:  # one live call per code; others wait and then read the cache
            # A locking read sees the latest committed row (a plain read would reuse this transaction's older snapshot).
            row = db.query(models.BarcodeCache).filter_by(barcode=code).populate_existing().with_for_update(read=True).first()
            if row and row.expires_at > now:
                if not row.found: raise LookupError_("not_found", "Product not found in Open Food Facts. Enter its nutrition from the label.")
                return {**row.product, "cached": True}
            product = fetch(code)
            mapped = map_product(code, product) if product else None
            values = {"found": mapped is not None, "product": mapped, "fetched_at": now, "expires_at": now + (FOUND_TTL if mapped else MISSING_TTL)}
            # Upsert: safe even if another server process cached the same code meanwhile.
            db.execute(mysql_insert(models.BarcodeCache).values(barcode=code, **values).on_duplicate_key_update(**values)); db.commit()
    finally:
        with _inflight_lock: _inflight.pop(code, None)
    if mapped is None: raise LookupError_("not_found", "Product not found in Open Food Facts. Enter its nutrition from the label.")
    return {**mapped, "cached": False}

"""Phase 2 (D): barcode validation, defensive mapping, provider failures, breaker and caching. No network."""
import json
import random
import threading
from datetime import datetime, timedelta

import httpx
import pytest
from sqlalchemy.orm import Session

import database, models
from services import barcode_lookup as bl

NUTELLA = "3017620422003"
COMPLETE = {"product_name": "Hazelnut spread", "brands": "QA", "serving_size": "15 g", "nova_group": 4, "allergens_tags": ["en:nuts", "en:milk"],
            "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "carbohydrates_100g": 57.5, "fat_100g": 30.9, "fiber_100g": 0, "sodium_100g": 0.041}}


class Reply:
    def __init__(self, status=200, body=None, raw=None):
        self.status_code, self._body, self._raw = status, body, raw

    def json(self):
        if self._raw is not None: raise ValueError("not JSON")
        return self._body


@pytest.fixture
def provider(monkeypatch):
    """Scripted Open Food Facts: each call pops the next reply (a Reply or an exception)."""
    script, calls = [], []
    def fake(url):
        calls.append(url)
        item = script.pop(0)
        if isinstance(item, Exception): raise item
        return item
    monkeypatch.setattr(bl, "_http_get", fake)
    monkeypatch.setattr(bl, "breaker", bl._Breaker())
    return script, calls


def found(product=COMPLETE): return Reply(200, {"status": 1, "product": product})


# ── Validation ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("code", [NUTELLA, "5449000000996", "96385074", "036000291452", "3017-6204 22003"])
def test_valid_ean13_ean8_and_upca_codes_pass(code):
    assert bl.normalize(code) == code.replace("-", "").replace(" ", "")


@pytest.mark.parametrize("code", ["", "abc", "123", "3017620422004", "30176204220030", "../foo", "96385075", "12345678901"])
def test_wrong_length_characters_or_check_digit_are_rejected(code):
    with pytest.raises(bl.LookupError_) as raised: bl.normalize(code)
    assert raised.value.status == "invalid"


def test_check_digit_property_holds_for_random_codes():
    rng = random.Random(7)
    for length in (8, 12, 13):
        for _ in range(200):
            body = "".join(str(rng.randrange(10)) for _ in range(length - 1))
            good = next(d for d in "0123456789" if bl.check_digit_ok(body + d))
            assert bl.check_digit_ok(body + good)
            assert not bl.check_digit_ok(body + str((int(good) + 1) % 10))


# ── Mapping ─────────────────────────────────────────────────────────────────

def test_complete_product_maps_per_100g_with_attribution():
    p = bl.map_product(NUTELLA, COMPLETE)
    assert p["complete"] and p["product_name"] == "Hazelnut spread" and p["serving_g"] == 15
    assert p["nutrients_per_100g"]["energy_kcal"] == 539 and p["nutrients_per_100g"]["fiber_g"] == 0  # a real zero stays zero
    assert p["nutrients_per_100g"]["sodium_mg"] == 41 and p["allergens"] == ["nuts", "milk"]
    assert "Open Food Facts" in p["attribution"] and p["community_data"]


def test_missing_and_non_numeric_values_are_unknown_never_zero():
    p = bl.map_product(NUTELLA, {"nutriments": {"energy-kcal_100g": "n/a", "proteins_100g": None, "carbohydrates_100g": -3, "fat_100g": True}})
    assert set(p["nutrients_per_100g"].values()) == {None}
    assert p["complete"] is False and p["product_name"] is None and p["brand"] is None and p["serving_g"] is None


def test_kilojoules_comma_decimals_and_numeric_strings_are_read():
    p = bl.map_product(NUTELLA, {"nutriments": {"energy-kj_100g": "2255", "proteins_100g": "6,3", "carbohydrates_100g": "57.5", "fat_100g": 30.9}})
    assert round(p["nutrients_per_100g"]["energy_kcal"]) == 539 and p["nutrients_per_100g"]["protein_g"] == 6.3 and p["complete"]


@pytest.mark.parametrize("text,grams", [("30 g", 30), ("1 bar (45g)", 45), ("2 biscuits (25,5 g)", 25.5), ("250 ml", 250), ("1 cup", None), ("", None), (None, None)])
def test_serving_strings(text, grams):
    assert bl.serving_grams(text) == grams


def test_inconsistent_label_values_are_flagged():
    product = {**COMPLETE, "nutriments": {"energy-kcal_100g": 100, "proteins_100g": 10, "carbohydrates_100g": 50, "fat_100g": 20}}
    assert bl.map_product(NUTELLA, product)["consistency_warning"] is True
    assert bl.map_product(NUTELLA, COMPLETE)["consistency_warning"] is False


# ── Provider failures, retry and breaker ────────────────────────────────────

def test_found_product_is_cached_for_later_lookups(provider):
    script, calls = provider; script.append(found())
    with database.SessionLocal() as db:
        first = bl.lookup(db, NUTELLA); second = bl.lookup(db, NUTELLA)
    assert first["cached"] is False and second["cached"] is True and len(calls) == 1


def test_not_found_is_cached_for_a_day_then_retried(provider):
    script, calls = provider; script += [Reply(404), found()]
    now = datetime.utcnow()
    with database.SessionLocal() as db:
        for when in (now, now + timedelta(hours=23)):
            with pytest.raises(bl.LookupError_) as raised: bl.lookup(db, NUTELLA, now=when)
            assert raised.value.status == "not_found"
        assert bl.lookup(db, NUTELLA, now=now + timedelta(hours=25))["product_name"] == "Hazelnut spread"
    assert len(calls) == 2


def test_found_cache_expires_after_30_days(provider):
    script, calls = provider; script += [found(), found()]
    now = datetime.utcnow()
    with database.SessionLocal() as db:
        bl.lookup(db, NUTELLA, now=now); bl.lookup(db, NUTELLA, now=now + timedelta(days=29))
        assert len(calls) == 1
        assert bl.lookup(db, NUTELLA, now=now + timedelta(days=31))["cached"] is False
    assert len(calls) == 2


def test_status_zero_means_not_found(provider):
    script, _ = provider; script.append(Reply(200, {"status": 0}))
    with database.SessionLocal() as db, pytest.raises(bl.LookupError_) as raised: bl.lookup(db, NUTELLA)
    assert raised.value.status == "not_found"


@pytest.mark.parametrize("first", [httpx.ReadTimeout("slow"), Reply(503)])
def test_one_retry_after_a_timeout_or_server_error(provider, first):
    script, calls = provider; script += [first, found()]
    with database.SessionLocal() as db: assert bl.lookup(db, NUTELLA)["complete"]
    assert len(calls) == 2


@pytest.mark.parametrize("replies", [[httpx.ConnectError("down"), httpx.ConnectError("down")], [Reply(429)], [Reply(200, raw="<html>")], [Reply(503), Reply(502)], [Reply(418)]])
def test_outages_rate_limits_and_bad_data_are_unavailable_and_not_cached(provider, replies):
    script, _ = provider; script += replies
    with database.SessionLocal() as db:
        with pytest.raises(bl.LookupError_) as raised: bl.lookup(db, NUTELLA)
        assert raised.value.status == "unavailable"
        assert db.get(models.BarcodeCache, NUTELLA) is None


def test_breaker_opens_after_three_failures_and_fails_fast(provider):
    script, calls = provider; script += [Reply(429)] * 3
    with database.SessionLocal() as db:
        for _ in range(3):
            with pytest.raises(bl.LookupError_): bl.lookup(db, NUTELLA)
        with pytest.raises(bl.LookupError_) as raised: bl.lookup(db, "5449000000996")
    assert raised.value.status == "unavailable" and len(calls) == 3  # the fourth lookup never reached the provider


def test_concurrent_lookups_of_one_code_make_one_live_call(monkeypatch):
    calls, release = [], threading.Event()
    def slow(url):
        calls.append(url); release.wait(5); return found()
    monkeypatch.setattr(bl, "_http_get", slow); monkeypatch.setattr(bl, "breaker", bl._Breaker())
    code, results, errors = "5449000000996", [], []
    def worker():
        try:
            with Session(database.engine) as db: results.append(bl.lookup(db, code)["cached"])
        except Exception as error: errors.append(error)
    try:
        threads = [threading.Thread(target=worker) for _ in range(3)]
        for t in threads: t.start()
        release.set()
        for t in threads: t.join(15)
        assert not errors and len(calls) == 1 and sorted(results) == [False, True, True]
    finally:
        with Session(database.engine) as db: db.query(models.BarcodeCache).filter_by(barcode=code).delete(); db.commit()

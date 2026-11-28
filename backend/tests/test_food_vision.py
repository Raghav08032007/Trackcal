"""The food photo classifier that needs no LLM (services/food_vision.py): its picks join the AI's one-tap corrections, and
when the AI is unavailable or the day's AI limit is used up, it names the dish with catalog nutrition for a typical portion."""
import json

import pytest

pytest.importorskip("numpy")

from services import food_vision
from tests.test_photo_scan import phone_photo
from tests.test_web_gateway import ITEM, browser, environment, internet, model_reply, post  # noqa: F401 (fixtures)

PICKS = [{"name": "Mutton biryani", "confidence": 0.62}, {"name": "Chicken biryani", "confidence": 0.2},
         {"name": "Vegetable pulao", "confidence": 0.08}, {"name": "Jeera rice", "confidence": 0.01}]


@pytest.fixture
def classifier(monkeypatch):
    monkeypatch.setattr(food_vision, "enabled", lambda: True)
    monkeypatch.setattr(food_vision, "suggest", lambda raw, top=4: PICKS)


def test_alternatives_merge_without_repeats_or_unlikely_dishes():
    merged = food_vision.merge_alternatives("Vegetable Pulao", ["Biryani Chicken"], PICKS)
    assert merged == ["Biryani Chicken", "Mutton biryani"]  # same words = same dish; 1% pick left out


def test_typical_portions_follow_the_dish():
    assert food_vision.typical_grams("Mutton biryani") == 300 and food_vision.typical_grams("Roti (chapati)") == 40
    assert food_vision.typical_grams("Something new") == 200


def test_offline_meal_needs_a_confident_pick_and_a_catalog_match():
    per = {"calories": 180, "protein_g": 8, "carbs_g": 22, "fat_g": 7, "source": "IFCT 2017"}
    meal = food_vision.offline_meal(b"", lambda name: per, PICKS)
    item = meal["components"][0]
    assert meal["dish_name"] == "Mutton biryani" and item["quantity_g"] == 300 and item["calories"] == pytest.approx(540)
    assert meal["dish_alternatives"] == ["Chicken biryani", "Vegetable pulao", "Jeera rice"]
    assert food_vision.offline_meal(b"", lambda name: None, PICKS) is None
    assert food_vision.offline_meal(b"", lambda name: per, [{"name": "Pizza", "confidence": 0.1}]) is None


def test_the_classifier_adds_its_picks_to_the_ai_corrections(internet, classifier):
    _, replies = internet
    replies.append(model_reply(json.dumps({"dish_name": "Vegetable pulao", "dish_alternatives": ["Jeera rice"], "components": [ITEM]})))
    body = post(browser(), "/api/analyze", {"image": phone_photo()}).get_json()
    assert body["dish_name"] == "Vegetable pulao" and body["check_dish"] == "Mutton biryani"  # confident veg/non-veg conflict
    assert body["alternatives"] == ["Mutton biryani", "Jeera rice", "Chicken biryani"]
    assert body["photo_match"][0]["name"] == "Mutton biryani"


def test_without_the_classifier_nothing_changes(internet):
    _, replies = internet
    replies.append(model_reply(json.dumps({"dish_name": "Vegetable pulao", "dish_alternatives": ["Jeera rice"], "components": [ITEM]})))
    body = post(browser(), "/api/analyze", {"image": phone_photo()}).get_json()
    assert body["alternatives"] == ["Jeera rice"] and "photo_match" not in body


def test_an_ai_outage_falls_back_to_the_classifier(internet, classifier, monkeypatch):
    from flask_app import web_gateway
    monkeypatch.setattr(web_gateway, "_official_values", lambda name: {"calories": 180, "protein_g": 8, "carbs_g": 22, "fat_g": 7, "source": "IFCT 2017"})
    # no reply queued: the fake provider answers 500
    response = post(browser(), "/api/analyze", {"image": phone_photo()})
    body = response.get_json()
    assert response.status_code == 200 and body["offline"] is True and body["dish_name"] == "Mutton biryani"
    assert body["model"] == "TrackCal photo classifier (offline)" and body["total_nutrition"]["calories"] == 540


def test_the_daily_ai_limit_still_gets_a_free_classifier_answer(internet, classifier, monkeypatch):
    from flask_app import web_gateway
    monkeypatch.setenv("GUEST_DAILY_AI_LIMIT", "0")
    monkeypatch.setattr(web_gateway, "_official_values", lambda name: {"calories": 180, "protein_g": 8, "carbs_g": 22, "fat_g": 7, "source": "IFCT 2017"})
    calls, _ = internet
    response = post(browser(), "/api/analyze", {"image": phone_photo()})
    assert response.status_code == 200 and response.get_json()["offline"] is True and not calls
    assert post(browser(), "/api/analyze", {"text": "Egg"}).status_code == 429  # text still needs the AI


def test_veg_and_non_veg_names_are_told_apart():
    assert food_vision.is_non_veg("Mutton biryani") is True and food_vision.is_non_veg("Egg fried rice") is True
    assert food_vision.is_non_veg("Vegetable pulao") is False and food_vision.is_non_veg("Paneer tikka") is False
    assert food_vision.is_non_veg("Masala dosa") is None


def test_a_confident_veg_non_veg_conflict_asks_the_person(internet, classifier):
    _, replies = internet
    replies.append(model_reply(json.dumps({"dish_name": "Vegetable pulao", "dish_alternatives": ["Jeera rice", "Chicken biryani"], "components": [ITEM]})))
    body = post(browser(), "/api/analyze", {"image": phone_photo()}).get_json()
    assert body["check_dish"] == "Mutton biryani" and body["alternatives"][0] == "Mutton biryani"
    assert body["alternatives"].count("Chicken biryani") == 1


def test_agreement_or_an_unsure_classifier_does_not_interrupt(internet, classifier, monkeypatch):
    _, replies = internet
    replies.append(model_reply(json.dumps({"dish_name": "Chicken biryani", "components": [ITEM]})))
    assert "check_dish" not in post(browser(), "/api/analyze", {"image": phone_photo()}).get_json()
    monkeypatch.setattr(food_vision, "suggest", lambda raw, top=4: [{"name": "Mutton biryani", "confidence": 0.3}])
    replies.append(model_reply(json.dumps({"dish_name": "Vegetable pulao", "components": [ITEM]})))
    assert "check_dish" not in post(browser(), "/api/analyze", {"image": phone_photo()}).get_json()


def test_a_backup_provider_answers_when_openrouter_fails(internet, monkeypatch):
    from tests.test_web_gateway import Fake
    monkeypatch.setenv("AI_BACKUP_URL", "https://backup.example/v1/chat/completions")
    monkeypatch.setenv("AI_BACKUP_KEY", "backup-key"); monkeypatch.setenv("AI_BACKUP_MODEL", "backup-vision")
    calls, replies = internet
    replies += [Fake(429), model_reply(json.dumps({"dish_name": "Idli", "components": [ITEM]}))]
    body = post(browser(), "/api/analyze", {"image": phone_photo()}).get_json()
    assert body["dish_name"] == "Idli" and body["model"] == "backup-vision"
    assert calls[1]["url"] == "https://backup.example/v1/chat/completions" and calls[1]["json"]["model"] == "backup-vision"
    assert calls[1]["headers"]["Authorization"] == "Bearer backup-key"


def test_without_a_backup_the_rate_limit_message_stays(internet):
    from tests.test_web_gateway import Fake
    _, replies = internet
    replies.append(Fake(429))
    response = post(browser(), "/api/analyze", {"image": phone_photo()})
    assert response.status_code == 429 and "rate limit" in response.get_json()["error"]

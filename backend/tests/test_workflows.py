"""Real database/API workflows. All writes are rolled back by conftest."""
import uuid
import pytest
from tests.client import app, client, private_routes

def _requires_login(dependant):
    return any(getattr(child.call, "__name__", "") == "get_current_active_user" or _requires_login(child) for child in dependant.dependencies)

PRIVATE_ROUTES = private_routes()
assert len(PRIVATE_ROUTES) >= 50, "Private-route discovery lost coverage; inspect framework schema changes."

@pytest.mark.parametrize("method,path", PRIVATE_ROUTES)
def test_private_routes_require_authentication(method, path):
    import re
    path = re.sub(r"\{[^}]+\}", "test-id", path)
    assert client.request(method, path, json={}).status_code == 401


@pytest.fixture
def account():
    email = f"qa-{uuid.uuid4().hex}@tests.example.com"
    response = client.post("/api/v1/auth/signup", json={"email": email, "password": "Regression-test-123!", "display_name": "QA"})
    assert response.status_code == 201, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data, email


def test_auth_login_refresh_and_invalid_credentials(account):
    headers, tokens, email = account
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/login", data={"username": email, "password": "wrong"}).status_code == 401
    assert client.post("/api/v1/auth/login", data={"username": email, "password": "Regression-test-123!"}).status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401
    assert client.get("/api/v1/users/profile").status_code == 401


def test_profile_settings_goals_and_export(account):
    headers, _, _ = account
    assert client.patch("/api/v1/users/profile", headers=headers, json={"display_name": "Updated QA", "weight_kg": 75}).status_code == 200
    assert client.get("/api/v1/users/profile", headers=headers).json()["display_name"] == "Updated QA"
    assert client.patch("/api/v1/users/settings", headers=headers, json={"daily_water_goal_ml": 2500}).status_code == 200
    assert client.get("/api/v1/users/settings", headers=headers).json()["daily_water_goal_ml"] == 2500
    plan = client.post("/api/v1/users/onboarding/calculate-plan", headers=headers, json={"biological_sex": "male", "age": 28, "weight_kg": 75, "height_cm": 180, "activity_level": "moderate", "goal": "build_muscle"})
    assert plan.status_code == 200, plan.text
    assert plan.json()["target_calories"] == 2997
    assert client.get("/api/v1/users/settings", headers=headers).json()["daily_calorie_goal"] == 2997
    assert client.get("/api/v1/users/export", headers=headers).status_code == 200


def test_meal_create_read_copy_summary_and_delete(account):
    headers, _, _ = account
    response = client.post("/api/v1/meal-logs", headers=headers, json={"meal_type": "lunch", "log_method": "manual", "items": [{"display_name": "QA salad", "quantity_g": 250, "calories": 350, "protein_g": 30, "carbs_g": 20, "fat_g": 12}]})
    assert response.status_code == 201, response.text
    meal_id = response.json()["id"]
    assert client.get(f"/api/v1/meal-logs/{meal_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/meal-logs", headers=headers).status_code == 200
    assert client.get("/api/v1/nutrition/daily", headers=headers).json()["totals"]["calories"] == 350
    exported = client.get("/api/v1/users/export", headers=headers).json()
    assert exported["meal_logs"][0]["items"][0]["calories"] == 350
    item_id = client.get(f"/api/v1/meal-logs/{meal_id}", headers=headers).json()["items"][0]["id"]
    assert client.patch(f"/api/v1/meal-logs/{meal_id}/items/{item_id}/confirm", headers=headers).status_code == 200
    assert client.post(f"/api/v1/meal-logs/{meal_id}/copy", headers=headers).status_code in [200, 201]
    assert client.get("/api/v1/nutrition/daily", headers=headers).json()["totals"]["calories"] == 700
    for path in ["weekly", "trends", "coach/recommend-fill"]:
        response = client.get(f"/api/v1/nutrition/{path}", headers=headers)
        assert response.status_code == 200, response.text
    assert client.delete(f"/api/v1/meal-logs/{meal_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/meal-logs/{meal_id}", headers=headers).status_code == 404


def test_custom_food_recipe_nutrients_and_deletion(account):
    headers, _, _ = account
    food = client.post("/api/v1/foods/custom", headers=headers, json={"name": "QA oats", "calories_per_100g": 200, "protein_per_100g": 10, "carbs_per_100g": 30, "fat_per_100g": 4})
    assert food.status_code == 201, food.text
    assert client.get("/api/v1/foods/custom/mine", headers=headers).status_code == 200
    recipe = client.post("/api/v1/recipes", headers=headers, json={"name": "QA recipe", "servings": 2, "ingredients": [{"custom_food_id": food.json()["id"], "quantity_g": 100}]})
    assert recipe.status_code == 201, recipe.text
    recipe_id = recipe.json()["id"]
    detail = client.get(f"/api/v1/recipes/{recipe_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["nutrients_per_serving"]["calories"] == 100
    assert client.get("/api/v1/recipes", headers=headers).status_code == 200
    assert client.delete(f"/api/v1/recipes/{recipe_id}", headers=headers).status_code == 200


def test_water_support_community_and_subscription(account):
    headers, _, _ = account
    water = client.post("/api/v1/nutrition/water", headers=headers, json={"amount_ml": 250})
    assert water.status_code == 201, water.text
    ticket = client.post("/api/v1/support", headers=headers, json={"subject": "QA test", "body": "Synthetic test ticket", "category": "bug"})
    assert ticket.status_code == 201, ticket.text
    assert client.get(f"/api/v1/support/{ticket.json()['id']}", headers=headers).status_code == 200
    assert client.get("/api/v1/support", headers=headers).status_code == 200
    community = client.post("/api/v1/community", headers=headers, json={"submission_type": "missing_food", "data": {"name": "QA food"}})
    assert community.status_code == 201, community.text
    assert client.get("/api/v1/community/mine", headers=headers).status_code == 200
    for path in ["plans", "status", "history"]:
        assert client.get(f"/api/v1/subscriptions/{path}", headers=headers).status_code == 200
    assert client.post("/api/v1/subscriptions/cancel", headers=headers, json={"reason": "QA"}).status_code == 400


def test_other_account_cannot_access_private_resources(account):
    headers, _, _ = account
    ticket = client.post("/api/v1/support", headers=headers, json={"subject": "Private QA", "body": "Private"}).json()
    other = client.post("/api/v1/auth/signup", json={"email": f"other-{uuid.uuid4().hex}@tests.example.com", "password": "Regression-test-123!"}).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"/api/v1/support/{ticket['id']}", headers=other_headers).status_code == 404


def test_soft_delete_disables_login(account):
    headers, _, email = account
    assert client.delete("/api/v1/users/account", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/login", data={"username": email, "password": "Regression-test-123!"}).status_code == 401


@pytest.mark.parametrize("path,payload", [
    ("/api/v1/nutrition/water", {"amount_ml": -250}),
    ("/api/v1/recipes", {"name": "Invalid", "servings": 0}),
    ("/api/v1/foods/custom", {"name": "Invalid", "calories_per_100g": -100}),
    ("/api/v1/meal-logs", {"meal_type": "invalid", "items": []}),
    ("/api/v1/users/onboarding/calculate-plan", {"age": 0}),
])
def test_reject_invalid_nutrition_inputs(account, path, payload):
    assert client.post(path, headers=account[0], json=payload).status_code == 422


def test_weekly_range_is_exactly_seven_days(account):
    response = client.get("/api/v1/nutrition/weekly?week_start=2026-01-01", headers=account[0])
    assert len(response.json()["days"]) == 7
    assert response.json()["week_end"] == "2026-01-07"


def test_local_food_search_and_detail(account, monkeypatch):
    from routers import foods
    async def no_external_search(*args, **kwargs):
        return []
    monkeypatch.setattr(foods, "search_usda", no_external_search)
    response = client.get("/api/v1/foods/search?q=Rice", headers=account[0])
    assert response.status_code == 200
    results = response.json()["results"]
    assert results
    assert client.get(f"/api/v1/foods/{results[0]['id']}", headers=account[0]).status_code == 200


def test_mock_photo_job_and_correction(account, tmp_path, monkeypatch):
    import io
    from PIL import Image
    from routers import ai_scan
    monkeypatch.setattr(ai_scan, "STORAGE_PATH", tmp_path)
    buffer = io.BytesIO()
    Image.new("RGB", (20, 20), "green").save(buffer, format="PNG")
    response = client.post("/api/v1/scan/photo", headers=account[0], files={"file": ("test.png", buffer.getvalue(), "image/png")})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["is_mock"] is True and data["provider"] == "mock"
    assert client.get(f"/api/v1/scan/jobs/{data['scan_job_id']}", headers=account[0]).status_code == 200
    correction = client.post("/api/v1/scan/corrections", headers=account[0], data={"prediction_id": data["predictions"][0]["prediction_id"], "correction_type": "quantity", "corrected_quantity_g": 100})
    assert correction.status_code == 200, correction.text
    bad = client.post("/api/v1/scan/photo", headers=account[0], files={"file": ("bad.png", b"not an image", "image/png")})
    assert bad.status_code == 400


def test_missing_ai_provider_is_not_a_fabricated_meal(monkeypatch):
    import asyncio
    from routers import ai_scan
    from flask_app.params import HTTPException
    monkeypatch.setattr(ai_scan, "MOCK_MODE", False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(ai_scan._parse_text_meal("One egg"))
    assert exc.value.status_code == 503


def test_daily_scan_quota_is_enforced(account):
    for _ in range(5):
        assert client.post("/api/v1/scan/text", headers=account[0], data={"text": "Synthetic test meal"}).status_code == 200
    assert client.post("/api/v1/scan/text", headers=account[0], data={"text": "Synthetic test meal"}).status_code == 429


def test_invalid_model_output_is_rejected():
    from services.openrouter_client import validate_food_estimates
    for data in [[], {}, [{"name": "No nutrients"}], [{"name": "Bad", "quantity_g": 0, "confidence": 1, "calories": 2, "protein_g": 0, "carbs_g": 0, "fat_g": 0}]]:
        with pytest.raises(ValueError):
            validate_food_estimates(data)


def test_micronutrients_from_logged_foods(account):
    """Vitamins and minerals come from the foods' own values (IFCT/USDA), scaled to the grams eaten."""
    import database, models
    headers, _, _ = account
    with database.SessionLocal() as db:
        food = db.query(models.Food).join(models.FoodNutrient).join(models.NutrientDefinition).filter(models.NutrientDefinition.slug == "iron").first()
        if food is None:
            pytest.skip("No food with iron in this database (run scripts/seed_ifct.py)")
        iron = next(n.amount_per_100g for n in food.nutrients if n.nutrient_def.slug == "iron")
        food_id = food.id
    meal = client.post("/api/v1/meal-logs", headers=headers, json={"meal_type": "lunch", "log_method": "manual", "items": [
        {"food_id": food_id, "display_name": "Test food", "quantity_g": 200, "calories": 300, "protein_g": 10, "carbs_g": 40, "fat_g": 5}]})
    assert meal.status_code == 201, meal.text
    view = client.get("/api/v1/nutrition/micronutrients", headers=headers).json()
    got = next(r for r in view["nutrients"] if r["nutrient"] == "iron")
    assert abs(got["amount"] - round(iron * 2, 1)) < 0.11
    assert view["coverage"] == 1.0


def test_adaptive_target_needs_data_then_suggests(account):
    """Without meals and weigh-ins it asks for more logging; the endpoint is private and read-only."""
    headers, _, _ = account
    r = client.get("/api/v1/personalization/targets/adaptive", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ready"] is False and body["reason"] == "more_logging" and body["current"] > 0

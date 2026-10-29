import pytest
from tests.client import app, client
from routers.ai_scan import infer_nova_score, detect_allergens, COOKING_STYLES
import database
import models



def test_health_endpoint():
    """Verify system health and database connectivity."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    # The health check is public now that the web app shares the API's origin: status only.
    assert data == {"status": "ok"}


def test_cooking_style_multipliers():
    """Verify cooking style calculations calibrate fat and calories accurately."""
    payload = {
        "base_calories": 500,
        "base_protein_g": 30,
        "base_carbs_g": 50,
        "base_fat_g": 15,
        "base_grams": 300,
        "adjusted_grams": 300,
        "cooking_style": "restaurant_heavy"
    }
    response = client.post("/api/v1/scan/adjust-cooking-style", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["cooking_style"] == "restaurant_heavy"
    # restaurant_heavy has 1.25x cal and 1.45x fat
    assert data["calories"] == 625.0
    assert data["fat_g"] == 21.8
    assert data["protein_g"] == 30.0


def test_steamed_boiled_cooking_style():
    """Verify steamed/boiled adjustment reduces fat and overall calories."""
    payload = {
        "base_calories": 400,
        "base_protein_g": 25,
        "base_carbs_g": 40,
        "base_fat_g": 10,
        "base_grams": 200,
        "adjusted_grams": 200,
        "cooking_style": "steamed_boiled"
    }
    response = client.post("/api/v1/scan/adjust-cooking-style", json=payload)
    assert response.status_code == 200
    data = response.json()
    # 0.88x calories, 0.65x fat
    assert data["calories"] == 352.0
    assert data["fat_g"] == 6.5


def test_nova_classification_heuristics():
    """Verify NOVA food classification accurately tags whole foods vs UPF."""
    apple_nova = infer_nova_score("Fresh Green Apple")
    assert apple_nova["nova_group"] == 1
    assert "Whole Food" in apple_nova["nova_label"]

    soda_nova = infer_nova_score("Diet Cola Soda")
    assert soda_nova["nova_group"] == 4
    assert "Ultra-Processed" in soda_nova["nova_label"]

    bread_nova = infer_nova_score("Sourdough Bread")
    assert bread_nova["nova_group"] == 3


def test_allergen_detection():
    """Verify allergen detection flags dairy, gluten, and nuts."""
    biryani_allergens = detect_allergens("Hyderabadi Chicken Biryani with Ghee & Raita")
    assert "Dairy" in biryani_allergens

    toast_allergens = detect_allergens("Avocado Sourdough Toast with Egg")
    assert "Gluten" in toast_allergens
    assert "Egg" in toast_allergens


def test_database_seeded_foods():
    """Verify database contains seeded foods and nutrients."""
    db = database.SessionLocal()
    try:
        food_count = db.query(models.Food).count()
        assert food_count > 0, "Foods table should be seeded"

        nutrient_count = db.query(models.NutrientDefinition).count()
        assert nutrient_count >= 10, "Should have core macro and micronutrient definitions"

        allergen_count = db.query(models.Allergen).count()
        assert allergen_count >= 10, "Should have EU-14 allergen classes"
    finally:
        db.close()


def test_onboarding_tdee_calculation():
    """Verify BMR/TDEE calculations and goal setting."""
    from routers.auth import get_current_active_user

    mock_user = models.User(
        id="test-user-id",
        email="test@example.com",
        role=models.UserRole.user,
        is_active=True,
        is_minor=False
    )
    app.dependency_overrides[get_current_active_user] = lambda: mock_user

    payload = {
        "biological_sex": "male",
        "age": 28,
        "weight_kg": 75.0,
        "height_cm": 180.0,
        "activity_level": "moderate",
        "goal": "lose_weight",
        "dietary_preference": "standard"
    }

    try:
        response = client.post("/api/v1/users/onboarding/calculate-plan", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "plan_activated"
        # BMR: 10*75 + 6.25*180 - 5*28 + 5 = 750 + 1125 - 140 + 5 = 1740
        assert data["bmr"] == 1740
        # TDEE: 1740 * 1.55 = 2697
        assert data["tdee"] == 2697
        # Target for lose_weight: 2697 - 500 = 2197
        assert data["target_calories"] == 2197
        assert data["macros"]["protein_g"] > 100
        assert data["water_target_ml"] == 2625
    finally:
        app.dependency_overrides.clear()


def test_barcode_lookup_endpoint():
    """Verify barcode lookup endpoint with mock or live Open Food Facts."""
    from routers.auth import get_current_active_user
    mock_user = models.User(
        id="test-user-id",
        email="test@example.com",
        role=models.UserRole.user,
        is_active=True,
        is_minor=False
    )
    app.dependency_overrides[get_current_active_user] = lambda: mock_user

    try:
        # Testing a known product barcode (Nutella 3017620422003 or generic 404 test)
        response = client.get("/api/v1/scan/barcode/3017620422003")
        # In test environment with network access it will return 200 from OpenFoodFacts, or 404 if offline
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert "product_name" in data
            assert "nutrients_per_100g" in data
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def persistent_test_user():
    db = database.SessionLocal()
    try:
        user = db.query(models.User).filter_by(id="test-calai-suite-user").first()
        if not user:
            user = models.User(
                id="test-calai-suite-user",
                email="suite_test@trackcal.ai",
                role=models.UserRole.user,
                is_active=True,
                is_minor=False
            )
            db.add(user)
            # Create free subscription
            sub = models.Subscription(
                user_id=user.id,
                plan_id="free",
                status=models.SubscriptionStatus.free,
                ai_scans_used_today=0
            )
            db.add(sub)
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()


def test_text_scan_endpoint(persistent_test_user):
    """Verify natural language / voice text meal parsing endpoint."""
    from routers.auth import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: persistent_test_user

    try:
        response = client.post(
            "/api/v1/scan/text",
            data={"text": "2 rotis and 1 bowl of dal tadka", "language": "en"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "predictions" in data
        assert len(data["predictions"]) > 0
        assert data["transcribed_text"] == "2 rotis and 1 bowl of dal tadka"
    finally:
        app.dependency_overrides.clear()


def test_coach_macro_fill_endpoint(persistent_test_user):
    """Verify AI Smart Coach macro fill recommendations."""
    from routers.auth import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: persistent_test_user

    try:
        response = client.get("/api/v1/nutrition/coach/recommend-fill")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "remaining_budget" in data
        assert "coach_advice" in data
        assert len(data["recommended_options"]) > 0
    finally:
        app.dependency_overrides.clear()


def test_meal_creation_and_daily_summary(persistent_test_user):
    """Verify creating a meal log updates daily nutrition totals."""
    from routers.auth import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: persistent_test_user

    try:
        meal_payload = {
            "meal_type": "lunch",
            "log_method": "manual",
            "items": [
                {
                    "display_name": "Grilled Chicken Salad",
                    "quantity_g": 250,
                    "calories": 350.0,
                    "protein_g": 38.0,
                    "carbs_g": 12.0,
                    "fat_g": 14.0
                }
            ]
        }
        res = client.post("/api/v1/meal-logs", json=meal_payload)
        assert res.status_code == 201
        log_id = res.json()["id"]
        assert log_id is not None

        # Check daily summary
        summary_res = client.get("/api/v1/nutrition/daily")
        assert summary_res.status_code == 200
        summary_data = summary_res.json()
        assert summary_data["totals"]["calories"] >= 350.0
        assert summary_data["totals"]["protein_g"] >= 38.0
    finally:
        app.dependency_overrides.clear()





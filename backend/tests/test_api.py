import pytest
from fastapi.testclient import TestClient
from main import app
from routers.ai_scan import infer_nova_score, detect_allergens, COOKING_STYLES
import database
import models

client = TestClient(app)


def test_health_endpoint():
    """Verify system health and database connectivity."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0.0"
    assert data["status"] in ["ok", "degraded"]


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


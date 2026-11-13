"""
seed_data.py — Populate database with essential seed data:
  - Nutrient definitions
  - Common allergens
  - Sample regional foods (Indian, Japanese, American, Mexican)
Run once: py -3.11 seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from database import engine, SessionLocal, Base
import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def seed_nutrient_definitions():
    nutrients = [
        {"name": "Energy (kcal)", "slug": "energy_kcal", "unit": "kcal", "category": "energy", "display_order": 1},
        {"name": "Protein", "slug": "protein", "unit": "g", "category": "macro", "display_order": 2},
        {"name": "Carbohydrates", "slug": "carbohydrates", "unit": "g", "category": "macro", "display_order": 3},
        {"name": "Fat", "slug": "fat", "unit": "g", "category": "macro", "display_order": 4},
        {"name": "Fiber", "slug": "fiber", "unit": "g", "category": "macro", "display_order": 5},
        {"name": "Sugar", "slug": "sugar", "unit": "g", "category": "macro", "display_order": 6},
        {"name": "Saturated Fat", "slug": "saturated_fat", "unit": "g", "category": "macro", "display_order": 7},
        {"name": "Sodium", "slug": "sodium", "unit": "mg", "category": "mineral", "display_order": 8},
        {"name": "Potassium", "slug": "potassium", "unit": "mg", "category": "mineral", "display_order": 9},
        {"name": "Calcium", "slug": "calcium", "unit": "mg", "category": "mineral", "display_order": 10},
        {"name": "Iron", "slug": "iron", "unit": "mg", "category": "mineral", "display_order": 11},
        {"name": "Vitamin C", "slug": "vitamin_c", "unit": "mg", "category": "vitamin", "display_order": 12},
        {"name": "Vitamin D", "slug": "vitamin_d", "unit": "mcg", "category": "vitamin", "display_order": 13},
        {"name": "Vitamin B12", "slug": "vitamin_b12", "unit": "mcg", "category": "vitamin", "display_order": 14},
        {"name": "Folate", "slug": "folate", "unit": "mcg", "category": "vitamin", "display_order": 15},
        {"name": "Cholesterol", "slug": "cholesterol", "unit": "mg", "category": "macro", "display_order": 16},
    ]
    existing = {n.slug for n in db.query(models.NutrientDefinition).all()}
    added = 0
    for n in nutrients:
        if n["slug"] not in existing:
            db.add(models.NutrientDefinition(**n))
            added += 1
    db.commit()
    print(f"  Nutrient definitions: {added} added")


def seed_allergens():
    allergens = [
        {"name": "Gluten (Wheat)", "slug": "gluten", "eu_listed": True},
        {"name": "Crustaceans", "slug": "crustaceans", "eu_listed": True},
        {"name": "Eggs", "slug": "eggs", "eu_listed": True},
        {"name": "Fish", "slug": "fish", "eu_listed": True},
        {"name": "Peanuts", "slug": "peanuts", "eu_listed": True},
        {"name": "Soybeans", "slug": "soybeans", "eu_listed": True},
        {"name": "Milk (Lactose)", "slug": "milk", "eu_listed": True},
        {"name": "Nuts (Tree)", "slug": "tree_nuts", "eu_listed": True},
        {"name": "Celery", "slug": "celery", "eu_listed": True},
        {"name": "Mustard", "slug": "mustard", "eu_listed": True},
        {"name": "Sesame", "slug": "sesame", "eu_listed": True},
        {"name": "Sulphites", "slug": "sulphites", "eu_listed": True},
        {"name": "Lupin", "slug": "lupin", "eu_listed": True},
        {"name": "Molluscs", "slug": "molluscs", "eu_listed": True},
    ]
    existing = {a.slug for a in db.query(models.Allergen).all()}
    added = 0
    for a in allergens:
        if a["slug"] not in existing:
            db.add(models.Allergen(**a))
            added += 1
    db.commit()
    print(f"  Allergens: {added} added")


def _get_nutrient(slug):
    return db.query(models.NutrientDefinition).filter(models.NutrientDefinition.slug == slug).first()


# These entries were written with the values for one serving, not for 100 g. They are converted when added, so the catalog stays
# per 100 g throughout (checked against typical values per 100 g; alembic 0023 corrects databases seeded before this fix).
PER_SERVING = frozenset({
    "Miso Soup", "Tonkotsu Ramen (bowl)", "Bibimbap (bowl)", "Japchae", "Fried Rice", "Sweet and Sour Pork", "Chicken Taco (1 piece)",
    "Guacamole (2 tbsp)", "Black Bean Burrito", "Hummus (2 tbsp)", "Greek Salad", "Caesar Salad", "Blueberry Smoothie",
    "Oatmeal with Berries", "Pad Thai (plate)", "Nasi Goreng (plate)", "Pho Bo (bowl)", "Jollof Rice (serving)", "Ceviche (serving)",
    "Whole Milk (cup)", "Brown Bread (slice)",
})


def _add_food(name, category, cuisine, serving_g, nutrients_per_100g, source="usda"):
    existing = db.query(models.Food).filter(models.Food.name == name).first()
    if existing:
        return existing
    food = models.Food(
        name=name,
        name_normalized=name.lower(),
        data_source=source,
        is_verified=True,
        is_generic=True,
        category=category,
        cuisine_region=cuisine,
        serving_size_g=serving_g,
        serving_size_description=f"{serving_g}g",
        data_completeness_score=0.8,
    )
    db.add(food)
    db.flush()
    scale = 100 / serving_g if name in PER_SERVING else 1
    for slug, value in nutrients_per_100g.items():
        nd = _get_nutrient(slug)
        if nd and value is not None:
            db.add(models.FoodNutrient(food_id=food.id, nutrient_def_id=nd.id, amount_per_100g=round(value * scale, 3)))
    db.flush()
    return food


def seed_sample_foods():
    foods_data = [
        # ── Indian ─────────────────────────────────────────────────────────────
        ("Steamed Rice", "grains", "indian", 180,
         {"energy_kcal": 130, "protein": 2.7, "carbohydrates": 28.2, "fat": 0.3, "fiber": 0.4, "sodium": 1}),
        ("Idli (2 pieces)", "grains", "indian", 120,
         {"energy_kcal": 130, "protein": 4.0, "carbohydrates": 26.0, "fat": 0.5, "fiber": 1.2, "sodium": 180}),
        ("Dosa (plain)", "grains", "indian", 90,
         {"energy_kcal": 168, "protein": 3.9, "carbohydrates": 30.0, "fat": 3.7, "fiber": 0.9, "sodium": 250}),
        ("Sambar", "legumes", "indian", 150,
         {"energy_kcal": 55, "protein": 2.8, "carbohydrates": 9.2, "fat": 1.4, "fiber": 2.3, "sodium": 320}),
        ("Chicken Biryani", "mixed-dish", "indian", 250,
         {"energy_kcal": 210, "protein": 10.5, "carbohydrates": 24.0, "fat": 7.8, "fiber": 1.2, "sodium": 380}),
        ("Butter Naan", "bread", "indian", 80,
         {"energy_kcal": 317, "protein": 8.0, "carbohydrates": 50.0, "fat": 9.5, "fiber": 2.0, "sodium": 490}),
        ("Dal Tadka", "legumes", "indian", 150,
         {"energy_kcal": 102, "protein": 6.8, "carbohydrates": 14.5, "fat": 2.2, "fiber": 4.1, "sodium": 340}),
        ("Paneer Tikka", "protein", "indian", 100,
         {"energy_kcal": 265, "protein": 18.3, "carbohydrates": 4.2, "fat": 20.1, "fiber": 0.3, "sodium": 430}),
        ("Aloo Paratha", "bread", "indian", 100,
         {"energy_kcal": 260, "protein": 6.5, "carbohydrates": 38.0, "fat": 9.5, "fiber": 2.8, "sodium": 380}),
        ("Rasam", "soup", "indian", 200,
         {"energy_kcal": 28, "protein": 1.2, "carbohydrates": 5.8, "fat": 0.3, "fiber": 0.7, "sodium": 290}),

        # ── Japanese ───────────────────────────────────────────────────────────
        ("Salmon Sushi (2 pieces)", "seafood", "japanese", 85,
         {"energy_kcal": 165, "protein": 7.5, "carbohydrates": 21.5, "fat": 5.2, "fiber": 0.3, "sodium": 320}),
        ("Miso Soup", "soup", "japanese", 240,
         {"energy_kcal": 40, "protein": 2.8, "carbohydrates": 5.5, "fat": 1.5, "fiber": 0.5, "sodium": 850}),
        ("Tonkotsu Ramen (bowl)", "noodles", "japanese", 500,
         {"energy_kcal": 460, "protein": 20.0, "carbohydrates": 55.0, "fat": 18.0, "fiber": 2.0, "sodium": 1800}),
        ("Chicken Teriyaki", "protein", "japanese", 150,
         {"energy_kcal": 210, "protein": 24.0, "carbohydrates": 12.0, "fat": 7.5, "fiber": 0.0, "sodium": 580}),
        ("Edamame (shelled)", "vegetables", "japanese", 100,
         {"energy_kcal": 122, "protein": 11.0, "carbohydrates": 8.9, "fat": 5.2, "fiber": 5.0, "sodium": 63}),

        # ── Korean ─────────────────────────────────────────────────────────────
        ("Bibimbap (bowl)", "mixed-dish", "korean", 400,
         {"energy_kcal": 490, "protein": 18.0, "carbohydrates": 68.0, "fat": 15.0, "fiber": 4.5, "sodium": 820}),
        ("Kimchi (serving)", "fermented", "korean", 50,
         {"energy_kcal": 15, "protein": 1.1, "carbohydrates": 2.4, "fat": 0.5, "fiber": 1.6, "sodium": 800}),
        ("Japchae", "noodles", "korean", 200,
         {"energy_kcal": 270, "protein": 8.5, "carbohydrates": 42.0, "fat": 7.0, "fiber": 2.0, "sodium": 490}),

        # ── Chinese ────────────────────────────────────────────────────────────
        ("Steamed Dumplings (4 pcs)", "dumplings", "chinese", 120,
         {"energy_kcal": 240, "protein": 12.0, "carbohydrates": 30.0, "fat": 7.5, "fiber": 1.5, "sodium": 530}),
        ("Fried Rice", "grains", "chinese", 200,
         {"energy_kcal": 350, "protein": 9.5, "carbohydrates": 50.0, "fat": 12.0, "fiber": 1.8, "sodium": 680}),
        ("Sweet and Sour Pork", "protein", "chinese", 150,
         {"energy_kcal": 295, "protein": 14.0, "carbohydrates": 28.0, "fat": 14.5, "fiber": 1.0, "sodium": 520}),

        # ── Mexican ────────────────────────────────────────────────────────────
        ("Chicken Taco (1 piece)", "mixed-dish", "mexican", 130,
         {"energy_kcal": 285, "protein": 16.0, "carbohydrates": 28.0, "fat": 11.5, "fiber": 3.5, "sodium": 480}),
        ("Guacamole (2 tbsp)", "condiment", "mexican", 30,
         {"energy_kcal": 48, "protein": 0.6, "carbohydrates": 2.5, "fat": 4.4, "fiber": 2.0, "sodium": 90}),
        ("Black Bean Burrito", "mixed-dish", "mexican", 280,
         {"energy_kcal": 450, "protein": 18.0, "carbohydrates": 65.0, "fat": 12.0, "fiber": 9.5, "sodium": 920}),

        # ── Mediterranean ──────────────────────────────────────────────────────
        ("Hummus (2 tbsp)", "legumes", "mediterranean", 30,
         {"energy_kcal": 70, "protein": 2.4, "carbohydrates": 6.0, "fat": 4.5, "fiber": 2.0, "sodium": 140}),
        ("Greek Salad", "salad", "mediterranean", 200,
         {"energy_kcal": 160, "protein": 4.5, "carbohydrates": 8.5, "fat": 12.5, "fiber": 2.5, "sodium": 550}),
        ("Falafel (3 pieces)", "legumes", "mediterranean", 90,
         {"energy_kcal": 333, "protein": 13.0, "carbohydrates": 30.0, "fat": 18.0, "fiber": 5.5, "sodium": 420}),

        # ── American ───────────────────────────────────────────────────────────
        ("Chicken Breast (grilled)", "protein", "american", 150,
         {"energy_kcal": 165, "protein": 31.0, "carbohydrates": 0.0, "fat": 3.6, "fiber": 0.0, "sodium": 74}),
        ("Caesar Salad", "salad", "american", 200,
         {"energy_kcal": 295, "protein": 10.5, "carbohydrates": 14.0, "fat": 22.0, "fiber": 2.5, "sodium": 630}),
        ("Blueberry Smoothie", "beverage", "american", 350,
         {"energy_kcal": 175, "protein": 4.5, "carbohydrates": 38.0, "fat": 1.5, "fiber": 3.5, "sodium": 75}),
        ("Oatmeal with Berries", "breakfast", "american", 250,
         {"energy_kcal": 200, "protein": 6.5, "carbohydrates": 38.0, "fat": 4.0, "fiber": 5.0, "sodium": 110}),
        ("Scrambled Eggs (2 eggs)", "breakfast", "american", 100,
         {"energy_kcal": 200, "protein": 14.0, "carbohydrates": 1.5, "fat": 15.0, "fiber": 0.0, "cholesterol": 380}),

        # ── Southeast Asian ────────────────────────────────────────────────────
        ("Pad Thai (plate)", "noodles", "southeast_asian", 300,
         {"energy_kcal": 490, "protein": 18.5, "carbohydrates": 60.0, "fat": 18.5, "fiber": 2.5, "sodium": 1100}),
        ("Nasi Goreng (plate)", "mixed-dish", "southeast_asian", 350,
         {"energy_kcal": 525, "protein": 17.0, "carbohydrates": 68.0, "fat": 19.0, "fiber": 2.0, "sodium": 980}),
        ("Pho Bo (bowl)", "soup", "southeast_asian", 500,
         {"energy_kcal": 355, "protein": 22.0, "carbohydrates": 45.0, "fat": 8.5, "fiber": 2.0, "sodium": 950}),

        # ── African ────────────────────────────────────────────────────────────
        ("Jollof Rice (serving)", "grains", "african", 200,
         {"energy_kcal": 320, "protein": 7.0, "carbohydrates": 58.0, "fat": 8.0, "fiber": 2.5, "sodium": 620}),
        ("Injera (piece)", "bread", "african", 100,
         {"energy_kcal": 254, "protein": 6.0, "carbohydrates": 50.0, "fat": 1.8, "fiber": 3.9, "sodium": 180}),

        # ── South American ─────────────────────────────────────────────────────
        ("Arepa (plain)", "bread", "south_american", 100,
         {"energy_kcal": 360, "protein": 7.5, "carbohydrates": 60.0, "fat": 10.0, "fiber": 2.0, "sodium": 420}),
        ("Ceviche (serving)", "seafood", "south_american", 150,
         {"energy_kcal": 115, "protein": 20.0, "carbohydrates": 6.0, "fat": 1.5, "fiber": 1.0, "sodium": 380}),

        # ── Common items ──────────────────────────────────────────────────────
        ("Banana (medium)", "fruit", "global", 118,
         {"energy_kcal": 89, "protein": 1.1, "carbohydrates": 23.0, "fat": 0.3, "fiber": 2.6, "potassium": 358}),
        ("Apple (medium)", "fruit", "global", 182,
         {"energy_kcal": 52, "protein": 0.3, "carbohydrates": 14.0, "fat": 0.2, "fiber": 2.4, "vitamin_c": 4.6}),
        ("Whole Milk (cup)", "dairy", "global", 244,
         {"energy_kcal": 149, "protein": 8.0, "carbohydrates": 11.7, "fat": 8.0, "calcium": 276, "vitamin_d": 3.2}),
        ("Egg (large, whole)", "protein", "global", 50,
         {"energy_kcal": 143, "protein": 12.6, "carbohydrates": 0.7, "fat": 9.5, "cholesterol": 373}),
        ("Brown Bread (slice)", "bread", "global", 28,
         {"energy_kcal": 69, "protein": 3.6, "carbohydrates": 11.6, "fat": 0.9, "fiber": 1.9, "sodium": 132}),
        ("Olive Oil (1 tbsp)", "fats", "global", 14,
         {"energy_kcal": 884, "protein": 0.0, "carbohydrates": 0.0, "fat": 100.0, "saturated_fat": 14.0}),
        ("Greek Yogurt (100g)", "dairy", "global", 100,
         {"energy_kcal": 97, "protein": 10.0, "carbohydrates": 3.6, "fat": 5.0, "calcium": 110}),
        ("Almonds (handful, 28g)", "nuts", "global", 28,
         {"energy_kcal": 579, "protein": 21.2, "carbohydrates": 21.6, "fat": 49.9, "fiber": 12.5}),
        ("Avocado (half)", "fruit", "global", 100,
         {"energy_kcal": 160, "protein": 2.0, "carbohydrates": 8.5, "fat": 14.7, "fiber": 6.7, "potassium": 485}),
        ("Lentils (cooked, 100g)", "legumes", "global", 100,
         {"energy_kcal": 116, "protein": 9.0, "carbohydrates": 20.1, "fat": 0.4, "fiber": 7.9, "folate": 181}),
    ]

    added = 0
    for item in foods_data:
        name, cat, cuisine, serving, nutrients = item
        _add_food(name, cat, cuisine, serving, nutrients)
        added += 1

    db.commit()
    print(f"  Sample foods: {added} processed")


if __name__ == "__main__":
    print("[SEED] Seeding database...")
    try:
        seed_nutrient_definitions()
        seed_allergens()
        seed_sample_foods()
        print("[SUCCESS] Database seeded successfully!")
        print(f"  Foods: {db.query(models.Food).count()}")
        print(f"  Nutrients: {db.query(models.NutrientDefinition).count()}")
        print(f"  Allergens: {db.query(models.Allergen).count()}")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        db.close()


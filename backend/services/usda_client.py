"""
usda_client.py — Live client for USDA FoodData Central API
Fetches authoritative nutrient data for whole foods, raw ingredients, and standard measures.
"""
import os
import httpx
from typing import Optional, Dict, Any, List

USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
DEFAULT_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")


async def search_usda_foods(query: str, page_size: int = 5) -> List[Dict[str, Any]]:
    """
    Search USDA FoodData Central for whole foods and standard ingredients.
    Returns matched food items with calories, protein, carbs, fat, fiber, and micronutrients.
    """
    api_key = os.getenv("USDA_API_KEY", DEFAULT_API_KEY)
    url = f"{USDA_BASE_URL}/foods/search"
    params = {
        "api_key": api_key,
        "query": query,
        "pageSize": page_size,
        "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
            foods = []
            for item in data.get("foods", []):
                nutrients_map = {}
                for n in item.get("foodNutrients", []):
                    name = n.get("nutrientName", "").lower()
                    val = n.get("value", 0.0)
                    if "energy" in name and n.get("unitName") == "KCAL":
                        nutrients_map["calories"] = val
                    elif "protein" in name:
                        nutrients_map["protein_g"] = val
                    elif "carbohydrate" in name:
                        nutrients_map["carbs_g"] = val
                    elif "total lipid" in name:
                        nutrients_map["fat_g"] = val
                    elif "fiber" in name:
                        nutrients_map["fiber_g"] = val

                foods.append({
                    "fdc_id": item.get("fdcId"),
                    "description": item.get("description"),
                    "category": item.get("foodCategory"),
                    "data_source": "USDA FoodData Central",
                    "nutrients_per_100g": nutrients_map
                })
            return foods
    except Exception as exc:
        print(f"[USDA] Error searching {query}: {exc}")
        return []

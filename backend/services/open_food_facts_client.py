"""
open_food_facts_client.py — Live client for Open Food Facts global database
Provides barcode scanning (UPC/EAN) and packaged brand search.
"""
import os
import httpx
from typing import Optional, Dict, Any, List

BASE_URL = "https://world.openfoodfacts.org"
USER_AGENT = os.getenv("OPEN_FOOD_FACTS_APP_NAME", "GlobalFoodAI") + " - Version " + os.getenv("OPEN_FOOD_FACTS_APP_VERSION", "1.0.0")


async def lookup_barcode(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Look up a product by barcode (EAN-13, UPC-A, etc.).
    Returns normalized product details, nutrients per 100g, NOVA group, and allergens.
    """
    clean_barcode = barcode.strip().replace(" ", "").replace("-", "")
    url = f"{BASE_URL}/api/v2/product/{clean_barcode}.json"
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                return None
            data = response.json()
            if data.get("status") != 1 or "product" not in data:
                return None

            product = data["product"]
            nutriments = product.get("nutriments", {})

            # Clean and normalize allergens
            allergens_tags = product.get("allergens_tags", [])
            clean_allergens = [
                tag.replace("en:", "").replace("-", " ").capitalize()
                for tag in allergens_tags if tag
            ]

            return {
                "barcode": clean_barcode,
                "product_name": product.get("product_name") or product.get("product_name_en") or "Unknown Product",
                "brand": product.get("brands") or "Generic",
                "serving_size": product.get("serving_size") or "100g",
                "serving_quantity_g": product.get("serving_quantity") or 100.0,
                "nova_group": product.get("nova_group"),
                "nutriscore_grade": product.get("nutriscore_grade", "").upper(),
                "allergens": clean_allergens,
                "nutrients_per_100g": {
                    "calories": nutriments.get("energy-kcal_100g") or (nutriments.get("energy-kj_100g", 0) / 4.184),
                    "protein_g": nutriments.get("proteins_100g", 0.0),
                    "carbs_g": nutriments.get("carbohydrates_100g", 0.0),
                    "fat_g": nutriments.get("fat_100g", 0.0),
                    "fiber_g": nutriments.get("fiber_100g", 0.0),
                    "sugar_g": nutriments.get("sugars_100g", 0.0),
                    "sodium_mg": (nutriments.get("sodium_100g", 0.0) or 0.0) * 1000,
                },
                "image_url": product.get("image_url"),
                "data_source": "Open Food Facts"
            }
    except Exception as exc:
        print(f"[OpenFoodFacts] Error looking up barcode {barcode}: {exc}")
        return None


async def search_packaged_foods(query: str, page_size: int = 10) -> List[Dict[str, Any]]:
    """Search packaged items by brand or product name on Open Food Facts."""
    url = f"{BASE_URL}/cgi/search.pl"
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": page_size,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code != 200:
                return []
            data = resp.json()
            results = []
            for p in data.get("products", []):
                nutriments = p.get("nutriments", {})
                results.append({
                    "product_name": p.get("product_name") or "Unknown Product",
                    "brand": p.get("brands") or "Generic",
                    "barcode": p.get("code"),
                    "calories_per_100g": nutriments.get("energy-kcal_100g", 0.0),
                    "protein_g": nutriments.get("proteins_100g", 0.0),
                    "carbs_g": nutriments.get("carbohydrates_100g", 0.0),
                    "fat_g": nutriments.get("fat_100g", 0.0),
                    "nova_group": p.get("nova_group"),
                    "image_url": p.get("image_front_thumb_url"),
                })
            return results
    except Exception as exc:
        print(f"[OpenFoodFacts] Search failed for {query}: {exc}")
        return []

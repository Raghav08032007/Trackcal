"""Open-source adapters for recipe import, planning, prices and optional services."""
import base64
import importlib.util
import io
import os
import re
import wave
import asyncio
import html
from datetime import date
from typing import Literal
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel, Field
from routers.auth import get_current_active_user
from services.safe_recipe import fetch_recipe_html

def integration_limits(request: Request, user=Depends(get_current_active_user), db: Session=Depends(get_db)):
    if os.getenv("APP_ENV") == "production":
        from services.abuse_limits import consume
        media = request.url.path.rsplit("/", 1)[-1] in ("label", "transcribe", "plan", "recipe-import")
        if media and not user.email_verified: raise HTTPException(403, "Verify your email before using connected tools.")
        consume(db, "tools-media" if media else "tools-read", str(user.id), 30 if media else 300, 86400 if media else 3600)

router = APIRouter(dependencies=[Depends(integration_limits)])
Number = float

class IngredientRequest(BaseModel):
    lines: list[str] = Field(min_length=1, max_length=80)

def parse_lines(lines):
    from ingredient_parser import parse_ingredient
    result = []
    for line in lines:
        if not line.strip() or len(line) > 400: raise HTTPException(422, "Each ingredient must contain 1–400 characters")
        try:
            item = parse_ingredient(line.strip(), string_units=True)
        except LookupError:
            raise HTTPException(503, "Ingredient parser language data is missing. Run scripts/setup-integrations.ps1.")
        amounts = [{"quantity": float(a.quantity), "quantity_max": float(a.quantity_max), "unit": str(a.unit), "text": a.text,
            "approximate": bool(a.APPROXIMATE), "range": bool(a.RANGE), "singular": bool(a.SINGULAR)} for a in item.amount]
        grams = None
        # Never turn cups, spoons or item counts into grams without a food-specific density.
        if len(amounts) == 1 and not amounts[0]["range"] and not amounts[0]["approximate"]:
            factors = {"g": 1, "gram": 1, "grams": 1, "kg": 1000, "kilogram": 1000, "kilograms": 1000,
                "oz": 28.349523125, "ounce": 28.349523125, "ounces": 28.349523125, "lb": 453.59237, "pound": 453.59237, "pounds": 453.59237}
            if amounts[0]["unit"] in factors: grams = round(amounts[0]["quantity"] * factors[amounts[0]["unit"]], 3)
        result.append({"original": line, "name": " / ".join(name.text for name in item.name), "amounts": amounts,
            "grams": grams, "needs_review": grams is None or any(name.confidence < .9 for name in item.name),
            "preparation": item.preparation.text if item.preparation else None})
    return result

@router.post("/ingredients")
def ingredients(data: IngredientRequest):
    return {"source": "ingredient-parser-nlp", "ingredients": parse_lines(data.lines), "nutrition": None}

class RecipeImport(BaseModel):
    url: str = Field(min_length=8, max_length=2000)

def extract_recipe(html: str, url: str):
    from recipe_scrapers import scrape_html
    try:
        scraper = scrape_html(html, url, supported_only=False)
        name = scraper.title()
        raw = scraper.ingredients()
        if not name or not raw: raise ValueError("No recipe")
        if len(raw) > 80 or any(len(line) > 400 for line in raw): raise HTTPException(422, "Recipe has too many or overly long ingredients")
        def optional(method):
            try: return getattr(scraper, method)()
            except Exception: return None
        return {"source": "recipe-scrapers", "source_url": url, "name": name[:200], "ingredients": parse_lines(raw),
            "instructions": (optional("instructions") or "")[:20000], "yield_text": optional("yields"),
            "total_minutes": optional("total_time"), "nutrition": None, "review_required": True}
    except HTTPException: raise
    except Exception: raise HTTPException(422, "No supported recipe found. Paste the ingredient list instead.")

@router.post("/recipe-import")
def import_recipe(data: RecipeImport):
    html, final_url = fetch_recipe_html(data.url)
    return extract_recipe(html, final_url)

class PlanFood(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    calories: float = Field(gt=0, le=20000, allow_inf_nan=False)
    protein: float = Field(ge=0, le=2000, allow_inf_nan=False)
    carbs: float = Field(ge=0, le=2000, allow_inf_nan=False)
    fat: float = Field(ge=0, le=2000, allow_inf_nan=False)
    cost: float = Field(ge=0, le=100000, allow_inf_nan=False)
    minutes: int = Field(ge=0, le=1440)
    tags: list[str] = Field(default_factory=list, max_length=30)

class PlanRequest(BaseModel):
    foods: list[PlanFood] = Field(min_length=1, max_length=100)
    slots: int = Field(default=3, ge=1, le=8)
    calories_min: float = Field(default=1600, ge=0, le=20000, allow_inf_nan=False)
    calories_max: float = Field(default=2400, gt=0, le=20000, allow_inf_nan=False)
    protein_min: float = Field(default=60, ge=0, le=2000, allow_inf_nan=False)
    carbs_max: float = Field(default=1000, ge=0, le=2000, allow_inf_nan=False)
    fat_max: float = Field(default=1000, ge=0, le=2000, allow_inf_nan=False)
    budget: float = Field(default=500, ge=0, le=100000, allow_inf_nan=False)
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    max_minutes: int = Field(default=90, ge=0, le=1440)
    excluded_tags: list[str] = Field(default_factory=list, max_length=30)

@router.post("/plan")
def plan(data: PlanRequest, user=Depends(get_current_active_user), db:Session=Depends(get_db)):
    from ortools.sat.python import cp_model
    if data.calories_min > data.calories_max: raise HTTPException(422, "Minimum calories cannot exceed maximum calories")
    if len({food.id for food in data.foods}) != len(data.foods): raise HTTPException(422, "Each candidate must have a unique ID")
    model = cp_model.CpModel()
    choices = [model.new_bool_var(f"meal_{i}") for i in range(len(data.foods))]
    # Quantize conservatively so a rounded result cannot break a numeric limit.
    import math
    def lower(key): return sum(math.floor(getattr(food, key) * 100) * choice for food, choice in zip(data.foods, choices))
    def upper(key): return sum(math.ceil(getattr(food, key) * 100) * choice for food, choice in zip(data.foods, choices))
    model.add(sum(choices) == data.slots)
    model.add(lower("calories") >= math.ceil(data.calories_min * 100))
    model.add(upper("calories") <= math.floor(data.calories_max * 100))
    model.add(lower("protein") >= math.ceil(data.protein_min * 100))
    model.add(upper("carbs") <= math.floor(data.carbs_max * 100))
    model.add(upper("fat") <= math.floor(data.fat_max * 100))
    model.add(upper("cost") <= math.floor(data.budget * 100))
    model.add(sum(food.minutes * choice for food, choice in zip(data.foods, choices)) <= data.max_minutes)
    excluded = {tag.strip().casefold() for tag in data.excluded_tags}
    for food, choice in zip(data.foods, choices):
        if excluded.intersection(tag.strip().casefold() for tag in food.tags): model.add(choice == 0)
    model.minimize(upper("cost"))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 3
    solver.parameters.num_search_workers = 1
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"source": "google/or-tools", "status": "infeasible" if status == cp_model.INFEASIBLE else "timeout", "meals": [],
            "message": "No plan satisfies these limits with the available meals. Add candidates or adjust your budget, time or nutrition limits."}
    selected = [food for food, choice in zip(data.foods, choices) if solver.value(choice)]
    from services.adventure import record_plan
    record_plan(db,user)
    return {"source": "google/or-tools", "status": "optimal" if status == cp_model.OPTIMAL else "feasible", "meals": [food.model_dump() for food in selected],
        "totals": {key: round(sum(getattr(food, key) for food in selected), 2) for key in ("calories", "protein", "carbs", "fat", "cost", "minutes")},
        "currency": data.currency, "note": "One serving per selected meal. Values and ingredient exclusions depend on the reviewed candidate data."}

class ShoppingIngredient(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    grams: float = Field(gt=0, le=100000, allow_inf_nan=False)

class PantryItem(ShoppingIngredient):
    expires: date | None = None

class ShoppingRequest(BaseModel):
    ingredients: list[ShoppingIngredient] = Field(max_length=300)
    pantry: list[PantryItem] = Field(max_length=300)
    today: date

@router.post("/shopping")
def shopping(data: ShoppingRequest):
    needed, stock, names = {}, {}, {}
    def key(name): return " ".join(name.strip().casefold().split())
    for item in data.ingredients:
        label = key(item.name)
        if not label: raise HTTPException(422, "Ingredient names must not be blank")
        needed[label] = needed.get(label, 0) + item.grams
        names[label] = item.name.strip()
    for item in data.pantry:
        if item.expires and item.expires < data.today: continue
        label = key(item.name)
        stock[label] = stock.get(label, 0) + item.grams
    return {"items": [{"name": names[label], "needed_g": round(amount, 2), "available_g": round(stock.get(label, 0), 2),
        "buy_g": round(max(0, amount - stock.get(label, 0)), 2)} for label, amount in needed.items()],
        "expired_excluded": sum(bool(item.expires and item.expires < data.today) for item in data.pantry)}

async def service_json(base: str, path: str, headers=None, params=None):
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=False, trust_env=False) as client:
            response = await client.get(base.rstrip("/") + path, headers=headers, params=params)
            if not response.is_success: raise HTTPException(502, f"The connected service returned HTTP {response.status_code}")
            if len(response.content) > 4_000_000: raise HTTPException(502, "Connected service returned too much data")
            return response.json()
    except HTTPException: raise
    except Exception: raise HTTPException(502, "The connected service is unavailable. No sample data was substituted.")

def private_service(name: str, user):
    if not os.getenv(name + "_URL") or not os.getenv(name + "_API_KEY"):
        raise HTTPException(503, f"{name.title()} needs its service URL and API key configured on the server")
    if user.role.value != "admin" and str(user.id) != os.getenv("INTEGRATION_OWNER_ID"):
        raise HTTPException(403, "This household connector is restricted to its configured owner")
    return os.environ[name + "_URL"], os.environ[name + "_API_KEY"]

@router.get("/grocy")
async def grocy(user=Depends(get_current_active_user)):
    url, key = private_service("GROCY", user)
    data = await service_json(url, "/api/stock", {"GROCY-API-KEY": key})
    if not isinstance(data, list): raise HTTPException(502, "Grocy returned an unexpected stock format")
    return {"source": "grocy/grocy", "items": [{"id": str(item.get("product_id", "")), "name": item.get("product", {}).get("name", "Unnamed product"),
        "amount": item.get("amount"), "unit": item.get("product", {}).get("qu_id_stock"), "expires": item.get("best_before_date"),
        "grams": None} for item in data[:300]], "note": "Grocy amounts retain their stock units. Confirm grams before using them in a nutrition plan."}

@router.get("/mealie")
async def mealie(user=Depends(get_current_active_user)):
    url, key = private_service("MEALIE", user)
    data = await service_json(url, "/api/recipes", {"Authorization": f"Bearer {key}"}, {"perPage": 50, "page": 1})
    return {"source": "mealie-recipes/mealie", "recipes": [{"id": str(item.get("id", "")), "name": item.get("name", "Unnamed recipe"),
        "slug": item.get("slug", "")} for item in data.get("items", [])], "has_more": data.get("total", 0) > 50}

@router.get("/mealie-recipe")
async def mealie_recipe(slug: str = "", user=Depends(get_current_active_user)):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,200}", slug): raise HTTPException(422, "Invalid recipe identifier")
    url, key = private_service("MEALIE", user)
    data = await service_json(url, "/api/recipes/" + slug, {"Authorization": f"Bearer {key}"})
    lines = [item.get("display") or item.get("note") or (item.get("food") or {}).get("name", "") for item in data.get("recipeIngredient", [])]
    lines = [line for line in lines if line.strip()]
    if not lines: raise HTTPException(422, "This recipe has no ingredient text to import")
    if len(lines) > 80: raise HTTPException(422, "This recipe exceeds the ingredient limit")
    return {"source": "mealie-recipes/mealie", "name": data.get("name", "Imported recipe"), "ingredients": parse_lines(lines),
        "instructions": "\n".join(item.get("text", "") for item in data.get("recipeInstructions", [])), "yield_text": data.get("recipeYield"), "nutrition": None}

@router.get("/exercises")
async def exercises(query: str = ""):
    if len(query) > 100: raise HTTPException(422, "Search is too long")
    data = await service_json(os.getenv("WGER_URL", "https://wger.de"), "/api/v2/exerciseinfo/", params={"limit": 100, "language": 2})
    items = []
    for item in data.get("results", []):
        translations = item.get("translations", [])
        english = next((t for t in translations if t.get("language") == 2), None)
        text = english or item
        name = text.get("name", "")
        if not name or query.casefold() not in name.casefold(): continue
        license = item.get("license")
        items.append({"id": str(item.get("id")), "name": name, "description": html.unescape(re.sub(r"<[^>]*>", "", text.get("description", "")))[:2000],
            "license": (license.get("short_name") or license.get("full_name") or "See source") if isinstance(license, dict) else str(license or "See source"),
            "license_url": license.get("url") if isinstance(license, dict) else None,
            "license_author": item.get("license_author", ""), "source_url": f"https://wger.de/en/exercise/{item.get('id')}/view/"})
    return {"source": "wger-project/wger", "exercises": items[:30], "note": "Search covers the returned exercise page. Exercise data has its own attribution/license."}

@router.get("/prices")
async def prices(code: str = "", currency: str = "INR"):
    if not re.fullmatch(r"\d{8,14}", code) or not re.fullmatch(r"[A-Z]{3}", currency): raise HTTPException(422, "Enter an 8–14 digit barcode and a three-letter currency")
    data = await service_json("https://prices.openfoodfacts.org", "/api/v1/prices", params={"product_code": code, "currency": currency, "size": 20, "order_by": "-date"})
    rows = []
    for item in data.get("items", []):
        if item.get("currency") != currency: continue
        try: amount = float(item["price"])
        except (TypeError, ValueError, KeyError): continue
        if amount < 0: continue
        rows.append({"id": item.get("id"), "price": amount, "currency": currency, "date": item.get("date"), "price_per": item.get("price_per") or "unit not supplied",
            "store": (item.get("location") or {}).get("osm_name") or "Store not supplied", "source_url": f"https://prices.openfoodfacts.org/prices/{item.get('id')}"})
    return {"source": "openfoodfacts/open-prices", "license": "ODbL", "observations": rows,
        "note": "Historical observations, not guaranteed current offers. Different pack sizes and pricing units are not directly comparable."}

class MediaRequest(BaseModel):
    data: str = Field(min_length=1, max_length=14_000_000)

def media_bytes(value, limit):
    try: raw = base64.b64decode(value.split(",", 1)[-1], validate=True)
    except Exception: raise HTTPException(422, "Invalid encoded file")
    if not raw or len(raw) > limit: raise HTTPException(413, "File exceeds the allowed size")
    return raw

@router.post("/transcribe")
async def transcribe(data: MediaRequest):
    raw = media_bytes(data.data, 10_000_000)
    try:
        with wave.open(io.BytesIO(raw)) as audio:
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or audio.getframerate() != 16000 or audio.getnframes() / 16000 > 60:
                raise ValueError()
            pcm = audio.readframes(audio.getnframes())
            if len(pcm) != audio.getnframes() * 2 or not pcm: raise ValueError()
    except Exception: raise HTTPException(422, "Use a mono 16-bit, 16 kHz WAV recording, at most 60 seconds")
    url = os.getenv("WHISPER_URL")
    if not url:
        from services.local_whisper import transcribe_pcm
        text = await asyncio.to_thread(transcribe_pcm, pcm)
        return {"source": "ggml-org/whisper.cpp (pywhispercpp)", "text": text}
    try:
        async with httpx.AsyncClient(timeout=90, trust_env=False) as client:
            response = await client.post(url.rstrip("/") + "/inference", files={"file": ("recording.wav", raw, "audio/wav")}, data={"response_format": "json", "language": "auto", "temperature": "0.0"})
            response.raise_for_status()
            text = response.json().get("text", "").strip()
            if not text: raise HTTPException(422, "No speech was detected in this recording")
            return {"source": "ggml-org/whisper.cpp", "text": text[:4000]}
    except HTTPException: raise
    except Exception: raise HTTPException(502, "Local transcription failed. Check the whisper.cpp service and model.")

def parse_label(text: str):
    # Extract known names only; missing values stay unknown. OCR always requires review.
    aliases = {"calories": r"(?:calories|energy)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(kcal|kj)?",
        "protein": r"protein\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(g|mg)?",
        "carbs": r"(?:total\s+carbohydrate[s]?|carbohydrate[s]?|carbs)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(g|mg)?",
        "fat": r"(?:total\s+fat|(?:^|\n)\s*fat)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(g|mg)?"}
    values = {}
    for key, pattern in aliases.items():
        match = re.search(pattern, text, re.I)
        number = float(match[1].replace(",", ".")) if match else None
        unit = (match[2] or "").lower() if match else ""
        if number is not None and unit == "kj": number /= 4.184
        if number is not None and unit == "mg": number /= 1000
        values[key] = round(number, 2) if number is not None else None
    per100 = bool(re.search(r"per\s*100\s*g", text, re.I))
    serving = bool(re.search(r"per\s*serving", text, re.I))
    basis = "unknown" if per100 == serving else "per_100g" if per100 else "per_serving"
    return {"values": values, "basis": basis, "review_required": True}

@router.post("/label")
async def label(data: MediaRequest):
    raw = media_bytes(data.data, 8_000_000)
    try:
        from PIL import Image
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ("JPEG", "PNG", "WEBP") or image.width * image.height > 25_000_000: raise ValueError()
            image.verify()
    except Exception: raise HTTPException(422, "Use a valid JPEG, PNG or WebP image under 25 megapixels")
    url = os.getenv("PADDLEOCR_URL")
    if not url: raise HTTPException(503, "Local PaddleOCR is not started. Start the OCR worker and configure PADDLEOCR_URL.")
    try:
        async with httpx.AsyncClient(timeout=90, trust_env=False) as client:
            response = await client.post(url.rstrip("/") + "/ocr", json={"image": base64.b64encode(raw).decode()})
            response.raise_for_status()
            text = response.json()["text"][:20000]
            return {"source": "PaddlePaddle/PaddleOCR", "text": text, **parse_label(text)}
    except HTTPException: raise
    except Exception: raise HTTPException(502, "Local label recognition failed. Check the PaddleOCR worker.")

@router.get("/status")
def status():
    libraries = [("recipe-scrapers", "recipe_scrapers"), ("ingredient-parser-nlp", "ingredient_parser"), ("google/or-tools", "ortools")]
    items = [{"name": name, "state": "installed" if importlib.util.find_spec(module) else "missing", "kind": "library"} for name, module in libraries]
    for name, env in [("Grocy", "GROCY"), ("Mealie", "MEALIE"), ("whisper.cpp", "WHISPER"), ("PaddleOCR", "PADDLEOCR")]:
        configured = bool(os.getenv(env + "_URL")) and (env not in ("GROCY", "MEALIE") or bool(os.getenv(env + "_API_KEY")))
        items.append({"name": name, "state": "configured — connection not yet verified" if configured else "needs service setup", "kind": "service"})
    from services.local_whisper import MODEL_PATH
    if MODEL_PATH.exists() and importlib.util.find_spec("pywhispercpp"):
        next(item for item in items if item["name"] == "whisper.cpp")["state"] = "CPU runtime and model installed"
    items += [{"name": "Open Prices", "state": "public API — queried on demand", "kind": "api"}, {"name": "wger", "state": "public API — queried on demand", "kind": "api"},
        {"name": "Dexie.js", "state": "web library installed — use Test device storage to verify this browser", "kind": "browser"}]
    return {"integrations": items, "note": "Configured does not mean connected. Source-specific actions verify the actual service."}

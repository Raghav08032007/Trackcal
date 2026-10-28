"""
ai_scan.py — AI food recognition: photo upload, text/voice logging, OCR, barcode pipeline
Supports mock mode (AI_MOCK_MODE=true) for development without paid API keys.
"""
import os
import uuid
import base64
import json
import io
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from PIL import Image

from database import get_db
import models
from routers.auth import get_current_active_user

router = APIRouter()

MOCK_MODE = os.getenv("AI_MOCK_MODE", "false").lower() == "true"

def _provider_name():
    return "mock" if MOCK_MODE else "openrouter" if os.getenv("OPENROUTER_API_KEY") else "gemini" if os.getenv("GEMINI_API_KEY") else "unconfigured"
STORAGE_PATH = Path(os.getenv("LOCAL_STORAGE_PATH", "./uploads"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

SUPPORTED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ── Mock AI responses for development ───────────────────────────

MOCK_FOODS = [
    {"name": "Steamed White Rice", "quantity_g": 180, "confidence": 0.85, "calories": 234, "protein_g": 4.3, "carbs_g": 51.6, "fat_g": 0.4},
    {"name": "Chicken Curry", "quantity_g": 150, "confidence": 0.78, "calories": 225, "protein_g": 18, "carbs_g": 9, "fat_g": 12},
    {"name": "Mixed Vegetables", "quantity_g": 80, "confidence": 0.72, "calories": 40, "protein_g": 2, "carbs_g": 8, "fat_g": 0.5},
]

MOCK_CUISINES = {
    "indian": [
        {"name": "Idli", "quantity_g": 120, "confidence": 0.88, "calories": 156, "protein_g": 4.8, "carbs_g": 31.2, "fat_g": 1.2},
        {"name": "Sambar", "quantity_g": 100, "confidence": 0.81, "calories": 55, "protein_g": 3, "carbs_g": 8, "fat_g": 1.5},
    ],
    "japanese": [
        {"name": "Salmon Sushi Roll (2 pieces)", "quantity_g": 85, "confidence": 0.90, "calories": 140, "protein_g": 8, "carbs_g": 22, "fat_g": 3},
    ],
}

COOKING_STYLES = {
    "steamed_boiled": {"cal_mult": 0.88, "fat_mult": 0.65, "label": "Steamed / Boiled (No added fat)"},
    "home_light": {"cal_mult": 0.94, "fat_mult": 0.85, "label": "Home-Cooked Light (Minimal oil)"},
    "standard": {"cal_mult": 1.0, "fat_mult": 1.0, "label": "Standard Recipe Baseline"},
    "restaurant_heavy": {"cal_mult": 1.25, "fat_mult": 1.45, "label": "Restaurant Style (Ghee/Butter/Oil heavy)"},
    "deep_fried": {"cal_mult": 1.48, "fat_mult": 1.85, "label": "Deep Fried (High fat absorption)"},
}


def infer_nova_score(food_name: str) -> dict:
    """Heuristic NOVA food processing classification (1=Unprocessed to 4=Ultra-Processed)."""
    name_lower = food_name.lower()
    if any(k in name_lower for k in ["soda", "cola", "chip", "nugget", "instant noodle", "candy", "packaged snack"]):
        return {"nova_group": 4, "nova_label": "Ultra-Processed (UPF)", "risk_tier": "high"}
    elif any(k in name_lower for k in ["bread", "cheese", "canned", "fermented", "paneer"]):
        return {"nova_group": 3, "nova_label": "Processed Food", "risk_tier": "moderate"}
    elif any(k in name_lower for k in ["oil", "butter", "ghee", "sugar", "syrup"]):
        return {"nova_group": 2, "nova_label": "Processed Culinary Ingredient", "risk_tier": "low"}
    else:
        return {"nova_group": 1, "nova_label": "Unprocessed / Whole Food", "risk_tier": "minimal"}


def detect_allergens(food_name: str) -> List[str]:
    """Detect potential EU-14 / FDA common allergens from ingredient name."""
    name_lower = food_name.lower()
    allergens = []
    if any(k in name_lower for k in ["milk", "cheese", "paneer", "butter", "ghee", "yogurt", "cream", "raita"]):
        allergens.append("Dairy")
    if any(k in name_lower for k in ["wheat", "bread", "toast", "roti", "naan", "pasta", "flour", "sourdough"]):
        allergens.append("Gluten")
    if any(k in name_lower for k in ["egg", "omelette", "poached", "boiled egg"]):
        allergens.append("Egg")
    if any(k in name_lower for k in ["peanut", "almond", "cashew", "walnut"]):
        allergens.append("Tree Nuts / Peanuts")
    if any(k in name_lower for k in ["soy", "tofu", "edamame", "soy sauce"]):
        allergens.append("Soy")
    if any(k in name_lower for k in ["salmon", "tuna", "fish", "cod"]):
        allergens.append("Fish")
    if any(k in name_lower for k in ["shrimp", "prawn", "crab", "lobster"]):
        allergens.append("Shellfish")
    if any(k in name_lower for k in ["sesame", "tahini"]):
        allergens.append("Sesame")
    return allergens


async def _mock_analyze_image(context: Optional[str] = None) -> List[dict]:
    """Return deterministic mock predictions for dev/testing."""
    return MOCK_FOODS


async def _gemini_analyze_image(image_bytes: bytes, mime_type: str, context: Optional[str] = None) -> List[dict]:
    """Use Google Gemini Vision to identify foods in an image."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "You are a food recognition AI. Analyze this meal photo and return ONLY valid JSON with no markdown. "
            "Return a list of food items with: name, quantity_g (estimated grams), confidence (0-1), "
            "calories, protein_g, carbs_g, fat_g, visible_ingredients (list), explanation (why you estimated this). "
            "Be honest about uncertainty. If you cannot determine a value, use null.\n"
        )
        if context:
            prompt += f"User context: {context}\n"
        image_part = {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}
        response = model.generate_content([prompt, image_part])
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print("Gemini request failed")
        raise HTTPException(502, "Gemini image analysis failed. Retry or log manually.")


async def _analyze_image(image_bytes: bytes, mime_type: str, context: Optional[str] = None) -> List[dict]:
    if MOCK_MODE:
        return await _mock_analyze_image(context)
    # Priority 1: OpenRouter API (if configured)
    if os.getenv("OPENROUTER_API_KEY"):
        try:
            from services.openrouter_client import analyze_food_image_openrouter
            return await analyze_food_image_openrouter(image_bytes, mime_type, context)
        except Exception as e:
            print("OpenRouter vision request failed")
            if MOCK_MODE:
                return await _mock_analyze_image(context)
            raise HTTPException(502, "OpenRouter vision inference failed. Retry or log manually.")

    # Priority 2: Gemini API directly
    if not MOCK_MODE and os.getenv("GEMINI_API_KEY"):
        return await _gemini_analyze_image(image_bytes, mime_type, context)

    # Priority 3: Mock development mode
    raise HTTPException(503, "Configure an AI provider or explicitly enable development mock mode.")


async def _parse_text_meal(text: str, language: str = "en") -> List[dict]:
    """Parse natural-language meal description into food items."""
    if MOCK_MODE:
        return [{"name": "Development sample meal", "quantity_g": 200, "confidence": 0.6, "calories": 350, "protein_g": 15, "carbs_g": 45, "fat_g": 10}]
    # Priority 1: OpenRouter API
    if os.getenv("OPENROUTER_API_KEY"):
        try:
            from services.openrouter_client import parse_text_meal_openrouter
            return await parse_text_meal_openrouter(text, language)
        except Exception as e:
            print("OpenRouter text request failed")
            if MOCK_MODE:
                return [{"name": f"Meal from: {text[:50]}", "quantity_g": 200, "confidence": 0.6,
                         "calories": 350, "protein_g": 15, "carbs_g": 45, "fat_g": 10}]
            raise HTTPException(502, "OpenRouter text parsing failed. Retry or log manually.")

    # Priority 2: Gemini API
    if not MOCK_MODE and os.getenv("GEMINI_API_KEY"):
        try:
            import google.generativeai as genai
            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                f"Parse this meal description in {language}: '{text}'. "
                "Return ONLY a JSON array of food items with: name, quantity_g, confidence, calories, protein_g, carbs_g, fat_g. "
                "Use per-100g USDA values scaled to the quantity. If quantity not mentioned, use a typical serving."
            )
            response = model.generate_content(prompt)
            text_resp = response.text.strip()
            if "```" in text_resp:
                text_resp = text_resp.split("```")[1].lstrip("json").strip()
            return json.loads(text_resp)
        except Exception as e:
            print("Text estimate request failed")
            raise HTTPException(502, "Gemini text analysis failed. Retry or log manually.")

    raise HTTPException(503, "Configure an AI provider or explicitly enable development mock mode.")


def _save_image(file_bytes: bytes, original_name: str, user_id: str) -> str:
    """Save uploaded image and return storage path."""
    ext = Path(original_name).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    filename = f"{user_id}_{uuid.uuid4().hex}{ext}"
    dest = STORAGE_PATH / filename
    dest.write_bytes(file_bytes)
    return str(dest)


def _check_scan_quota(user: models.User, db: Session) -> None:
    """Enforce free-tier daily scan limit."""
    if os.getenv("APP_ENV") == "production":
        if not user.email_verified: raise HTTPException(403, "Verify your email before using AI estimates.")
        from services.abuse_limits import consume
        consume(db, "web-ai", str(user.id), int(os.getenv("DAILY_AI_LIMIT", "15")), 86400)
        return
    sub = db.query(models.Subscription).filter(models.Subscription.user_id == user.id).first()
    if not sub:
        return
    if sub.plan_id != "free":
        return  # premium users: no limit enforced here
    today = datetime.utcnow().date()
    reset_date = sub.ai_scans_reset_at.date() if sub.ai_scans_reset_at else None
    if reset_date != today:
        sub.ai_scans_used_today = 0
        sub.ai_scans_reset_at = datetime.utcnow()
    FREE_LIMIT = 5
    if sub.ai_scans_used_today >= FREE_LIMIT:
        raise HTTPException(429, f"Daily scan limit ({FREE_LIMIT}) reached. Please try again tomorrow; manual logging remains available.")
    sub.ai_scans_used_today += 1
    db.add(sub)


# ── Endpoints ───────────────────────────────────────────────────

@router.post("/photo")
async def scan_photo(
    file: UploadFile = File(...),
    context: Optional[str] = Form(None),
    meal_type: str = Form("other"),
    consent: bool = Form(False),
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Upload a food photo and receive AI recognition results."""
    if file.content_type not in SUPPORTED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or WebP.")

    file_bytes = await file.read(MAX_FILE_SIZE + 1)
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Maximum 10 MB.")
    try:
        with Image.open(io.BytesIO(file_bytes)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 25_000_000:
                raise ValueError("Unsupported image")
            image.verify()
    except Exception:
        raise HTTPException(400, "Upload a valid JPEG, PNG or WebP image under 25 megapixels.")

    if not MOCK_MODE and not consent:raise HTTPException(400,"Confirm consent before sending a photo to the AI provider.")
    _check_scan_quota(user, db)

    # Save image
    storage_path = _save_image(file_bytes, file.filename or "upload.jpg", user.id)

    # Record image in DB
    img = models.FoodImage(
        user_id=user.id,
        storage_path=storage_path,
        original_filename=file.filename,
        file_size_bytes=len(file_bytes),
        mime_type=file.content_type,
    )
    db.add(img)
    db.flush()

    # Create scan job
    job = models.AIScanJob(
        user_id=user.id,
        image_id=img.id,
        scan_type="photo",
        status=models.ScanStatus.processing,
        provider=_provider_name(),
    )
    db.add(job)
    db.flush()

    # Run AI
    predictions_raw = await _analyze_image(file_bytes, file.content_type or "image/jpeg", context)

    # Persist predictions
    predictions_out = []
    for pred in predictions_raw:
        p = models.AIPrediction(
            scan_job_id=job.id,
            predicted_name=pred.get("name", "Unknown"),
            alternative_names=pred.get("alternatives"),
            estimated_quantity_g=pred.get("quantity_g"),
            confidence=pred.get("confidence"),
            visible_ingredients=pred.get("visible_ingredients"),
            explanation=pred.get("explanation"),
        )
        db.add(p)
        db.flush()
        nova_info = infer_nova_score(p.predicted_name)
        allergens = []  # Photos do not establish ingredient or allergen safety.
        predictions_out.append({
            "prediction_id": p.id,
            "name": p.predicted_name,
            "alternatives": p.alternative_names or [],
            "quantity_g": p.estimated_quantity_g,
            "confidence": p.confidence,
            "visible_ingredients": p.visible_ingredients or [],
            "explanation": p.explanation,
            "calories": pred.get("calories"),
            "protein_g": pred.get("protein_g"),
            "carbs_g": pred.get("carbs_g"),
            "fat_g": pred.get("fat_g"),
            "nova": nova_info,
            "allergens": allergens,
            "is_ai_estimated": True,
        })

    job.status = models.ScanStatus.completed
    job.completed_at = datetime.utcnow()
    db.commit()

    return {
        "scan_job_id": job.id,
        "image_id": img.id,
        "status": "completed",
        "provider": job.provider,
        "is_mock": job.provider == "mock",
        "available_cooking_styles": [
            {"key": k, "label": v["label"]} for k, v in COOKING_STYLES.items()
        ],
        "predictions": predictions_out,
        "disclaimer": (
            "These are AI estimates. Actual nutritional content depends on cooking methods, "
            "ingredients, and portions. Use the Cooking Style slider to calibrate hidden oils."
        ),
    }


class CookingStyleAdjustRequest(BaseModel):
    base_calories: float = Field(ge=0, le=20000, allow_inf_nan=False)
    base_protein_g: float = Field(ge=0, le=20000, allow_inf_nan=False)
    base_carbs_g: float = Field(ge=0, le=20000, allow_inf_nan=False)
    base_fat_g: float = Field(ge=0, le=20000, allow_inf_nan=False)
    base_grams: float = Field(gt=0, le=20000, allow_inf_nan=False)
    adjusted_grams: float = Field(gt=0, le=20000, allow_inf_nan=False)
    cooking_style: str = "standard"


@router.post("/adjust-cooking-style")
def adjust_cooking_style(data: CookingStyleAdjustRequest):
    """Adjust macros based on portion grams and cooking oil/sauce density."""
    if data.cooking_style not in COOKING_STYLES:
        raise HTTPException(422, "Unknown cooking style")
    style_info = COOKING_STYLES[data.cooking_style]
    portion_factor = (data.adjusted_grams / data.base_grams) if data.base_grams > 0 else 1.0

    cal_mult = style_info["cal_mult"]
    fat_mult = style_info["fat_mult"]

    adjusted_calories = round(data.base_calories * portion_factor * cal_mult, 1)
    adjusted_protein = round(data.base_protein_g * portion_factor, 1)
    adjusted_carbs = round(data.base_carbs_g * portion_factor, 1)
    adjusted_fat = round(data.base_fat_g * portion_factor * fat_mult, 1)

    return {
        "cooking_style": data.cooking_style,
        "style_label": style_info["label"],
        "portion_grams": data.adjusted_grams,
        "calories": adjusted_calories,
        "protein_g": adjusted_protein,
        "carbs_g": adjusted_carbs,
        "fat_g": adjusted_fat,
        "oil_adjustment_note": f"Calories adjusted by {round((cal_mult-1)*100)}% based on cooking style."
    }


@router.post("/text")
async def scan_text(
    text: str = Form(..., min_length=1, max_length=4000),
    language: str = Form("en"),
    meal_type: str = Form("other"),
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Parse a natural-language meal description."""
    _check_scan_quota(user, db)

    job = models.AIScanJob(
        user_id=user.id,
        scan_type="text",
        status=models.ScanStatus.processing,
        input_text=text,
        provider=_provider_name(),
    )
    db.add(job)
    db.flush()

    items = await _parse_text_meal(text, language)

    predictions_out = []
    for item in items:
        p = models.AIPrediction(
            scan_job_id=job.id,
            predicted_name=item.get("name", "Unknown"),
            estimated_quantity_g=item.get("quantity_g"),
            confidence=item.get("confidence"),
        )
        db.add(p)
        db.flush()
        predictions_out.append({
            "prediction_id": p.id,
            "name": p.predicted_name,
            "quantity_g": p.estimated_quantity_g,
            "confidence": p.confidence,
            "calories": item.get("calories"),
            "protein_g": item.get("protein_g"),
            "carbs_g": item.get("carbs_g"),
            "fat_g": item.get("fat_g"),
            "is_ai_estimated": True,
        })

    job.status = models.ScanStatus.completed
    job.completed_at = datetime.utcnow()
    db.commit()

    return {
        "scan_job_id": job.id,
        "transcribed_text": text,
        "language": language,
        "predictions": predictions_out,
        "is_mock": job.provider == "mock",
    }


@router.post("/corrections")
async def submit_correction(
    prediction_id: str = Form(...),
    correction_type: str = Form(...),
    corrected_name: Optional[str] = Form(None),
    corrected_quantity_g: Optional[float] = Form(None, gt=0, le=20000),
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Submit a correction for an AI prediction."""
    prediction = db.query(models.AIPrediction).join(models.AIScanJob).filter(
        models.AIPrediction.id == prediction_id,
        models.AIScanJob.user_id == user.id,
    ).first()
    if not prediction:
        raise HTTPException(404, "Prediction not found")

    correction = models.FoodCorrection(
        user_id=user.id,
        prediction_id=prediction_id,
        correction_type=correction_type,
        original_value={"name": prediction.predicted_name, "quantity_g": prediction.estimated_quantity_g},
        corrected_value={"name": corrected_name, "quantity_g": corrected_quantity_g},
    )
    db.add(correction)

    if corrected_quantity_g is not None:
        prediction.corrected_quantity_g = corrected_quantity_g

    db.commit()
    return {"status": "correction_saved", "correction_id": correction.id}


@router.get("/jobs/{job_id}")
def get_scan_job(job_id: str, user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Get status of an AI scan job."""
    job = db.query(models.AIScanJob).filter(
        models.AIScanJob.id == job_id, models.AIScanJob.user_id == user.id
    ).first()
    if not job:
        raise HTTPException(404, "Scan job not found")
    return {
        "id": job.id,
        "scan_type": job.scan_type,
        "status": job.status.value,
        "provider": job.provider,
        "duration_ms": job.duration_ms,
        "created_at": job.created_at.isoformat(),
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "predictions": [
            {"id": p.id, "name": p.predicted_name, "confidence": p.confidence}
            for p in job.predictions
        ],
    }


@router.get("/barcode/{barcode_value}")
async def scan_barcode(
    barcode_value: str,
    user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Live Barcode Scanner (Open Food Facts open-source API integration):
    Resolves UPC/EAN barcodes to verified calories, macros, NOVA classification, and allergen tags.
    """
    from services.open_food_facts_client import lookup_barcode
    product = await lookup_barcode(barcode_value)
    if product:
        return product

    # Fallback to local DB barcodes table
    db_barcode = db.query(models.Barcode).filter(models.Barcode.barcode_value == barcode_value).first()
    if db_barcode and db_barcode.food:
        f = db_barcode.food
        return {
            "barcode": barcode_value,
            "product_name": f.name,
            "brand": f.brand.name if f.brand else "Generic",
            "serving_size": f.serving_size_description or f"{f.serving_size_g}g",
            "data_source": "Local Verified Database",
            "allergens": detect_allergens(f.name),
            "nova_group": infer_nova_score(f.name)["nova_group"]
        }

    raise HTTPException(404, f"Barcode '{barcode_value}' not found in global Open Food Facts registry or local database.")



@router.delete('/images/{image_id}')
def delete_image(image_id:str,user=Depends(get_current_active_user),db:Session=Depends(get_db)):
    image=db.query(models.FoodImage).filter_by(id=image_id,user_id=user.id).first()
    if not image:raise HTTPException(404,'Image not found.')
    target=Path(image.storage_path).resolve();root=STORAGE_PATH.resolve()
    if target.parent!=root or not target.name.startswith(str(user.id)+'_'):raise HTTPException(409,'Image location requires operator review; no unrelated file was removed.')
    target.unlink(missing_ok=True);image.is_deleted=True;image.deleted_at=datetime.utcnow();db.commit()
    return {'status':'deleted','note':'Image file removed. Private scan/review records remain under account retention policy.'}

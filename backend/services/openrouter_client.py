"""
openrouter_client.py — Asynchronous client for OpenRouter API
Supports any multi-modal vision model (e.g. google/gemini-2.0-flash-001, openai/gpt-4o-mini, anthropic/claude-3.5-sonnet)
"""
import os
import json
import base64
import httpx
from typing import Optional, List, Dict, Any

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")


async def analyze_food_image_openrouter(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    user_context: Optional[str] = None,
    model: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Sends an image to OpenRouter for multi-component food detection and nutritional breakdown.
    Returns structured list of detected items with grams, calories, and macros.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured in .env")

    target_model = model or os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    prompt = (
        "You are an expert nutritional computer vision model. Analyze this food photo and identify all food components. "
        "Return ONLY a valid JSON array of objects with no markdown backticks and no explanations outside JSON.\n"
        "Each object must have the following keys:\n"
        "- name: (string, specific food title)\n"
        "- quantity_g: (number, realistic estimated gram weight)\n"
        "- confidence: (number between 0.0 and 1.0)\n"
        "- calories: (number, total calories for this portion)\n"
        "- protein_g: (number, grams of protein)\n"
        "- carbs_g: (number, grams of carbs)\n"
        "- fat_g: (number, grams of fat)\n"
        "- visible_ingredients: (list of strings)\n"
        "- explanation: (string, visual rationale based on color, geometry, and volume)\n"
    )

    if user_context:
        prompt += f"\nUser Additional Notes / Context: {user_context}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "TrackCal AI",
    }

    payload = {
        "model": target_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        # Sanitize markdown formatting if model output wrapped in ```json
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)
        if isinstance(parsed, dict) and "items" in parsed:
            return parsed["items"]
        if isinstance(parsed, list):
            return parsed
        return [parsed]


async def parse_text_meal_openrouter(
    text: str,
    language: str = "en",
    model: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Parses a natural-language meal description (e.g. '2 dosas with coconut chutney and filter coffee')
    into individual food entities with portion weights and estimated macros.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured in .env")

    target_model = model or os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)

    prompt = (
        f"You are a nutritional nutrition parser. Parse this user meal description into individual food components: '{text}' (Language: {language}).\n"
        "Return ONLY a valid JSON array of objects with:\n"
        "- name: (string)\n"
        "- quantity_g: (number, typical serving weight in grams)\n"
        "- confidence: (number between 0.0 and 1.0)\n"
        "- calories: (number)\n"
        "- protein_g: (number)\n"
        "- carbs_g: (number)\n"
        "- fat_g: (number)\n"
        "No markdown code blocks or conversational text."
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "TrackCal AI",
    }

    payload = {
        "model": target_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        return [parsed]

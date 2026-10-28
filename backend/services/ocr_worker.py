"""Run separately: .venv-ocr/Scripts/python -m uvicorn services.ocr_worker:app --port 8011."""
import base64
import io
import os
from functools import lru_cache
from pathlib import Path
import threading
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

# Keep model downloads inside the project's ignored runtime directory.
os.environ.setdefault("PADDLE_HOME", str(Path(__file__).resolve().parents[1] / "runtime" / "paddle"))
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(Path(__file__).resolve().parents[1] / "runtime" / "paddlex"))
app = FastAPI(title="TrackCal local PaddleOCR worker", docs_url=None, redoc_url=None)
slot = threading.Lock()

class Input(BaseModel):
    image: str = Field(min_length=1, max_length=11000000)

@lru_cache(maxsize=1)
def engine():
    from paddleocr import PaddleOCR
    return PaddleOCR(use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False,
        text_detection_model_name="PP-OCRv5_mobile_det", text_recognition_model_name="en_PP-OCRv5_mobile_rec", device="cpu")

@app.get("/health")
def health(): return {"status": "ready" if engine.cache_info().currsize else "worker running; model not loaded", "source": "PaddlePaddle/PaddleOCR"}

@app.post("/ocr")
def ocr(data: Input):
    if not slot.acquire(blocking=False): raise HTTPException(429, "OCR worker is busy")
    try:
        try:
            raw = base64.b64decode(data.image, validate=True)
            if len(raw) > 8000000: raise ValueError()
            with Image.open(io.BytesIO(raw)) as image:
                if image.width * image.height > 25000000: raise ValueError()
                import numpy as np
                pixels = np.array(image.convert("RGB"))
        except Exception: raise HTTPException(422, "Invalid or oversized image")
        result = engine().predict(pixels)
        lines = []
        for page in result:
            texts = page.get("rec_texts", [])
            scores = page.get("rec_scores", [])
            lines.extend(str(text) for index, text in enumerate(texts) if index >= len(scores) or scores[index] >= .5)
        return {"text": "\n".join(lines), "source": "PaddlePaddle/PaddleOCR", "review_required": True}
    except HTTPException: raise
    except Exception: raise HTTPException(503, "PaddleOCR could not load or run its model. Check worker logs.")
    finally: slot.release()

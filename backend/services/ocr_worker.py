"""Run separately: .venv-ocr/Scripts/python -m flask --app services.ocr_worker run --port 8011
(production image: gunicorn "services.ocr_worker:app" — see Dockerfile.ocr). Self-contained: the OCR image
copies only this file."""
import base64
import io
import os
from functools import lru_cache
from pathlib import Path
import threading
from flask import Flask, jsonify, request
from pydantic import BaseModel, Field, ValidationError
from PIL import Image

# Keep model downloads inside the project's ignored runtime directory.
os.environ.setdefault("PADDLE_HOME", str(Path(__file__).resolve().parents[1] / "runtime" / "paddle"))
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(Path(__file__).resolve().parents[1] / "runtime" / "paddlex"))
app = Flask("trackcal_ocr_worker")
app.config["MAX_CONTENT_LENGTH"] = 12_000_000
slot = threading.Lock()

class Input(BaseModel):
    image: str = Field(min_length=1, max_length=11000000)

class OcrError(Exception):
    def __init__(self, status, detail):
        super().__init__(detail); self.status, self.detail = status, detail

@app.errorhandler(OcrError)
def ocr_error(error):
    return jsonify({"detail": error.detail}), error.status

@lru_cache(maxsize=1)
def engine():
    from paddleocr import PaddleOCR
    return PaddleOCR(use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False,
        text_detection_model_name="PP-OCRv5_mobile_det", text_recognition_model_name="en_PP-OCRv5_mobile_rec", device="cpu")

@app.get("/health")
def health(): return {"status": "ready" if engine.cache_info().currsize else "worker running; model not loaded", "source": "PaddlePaddle/PaddleOCR"}

@app.post("/ocr")
def ocr():
    try: data = Input.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error: return jsonify({"detail": error.errors(include_url=False, include_context=False)}), 422
    if not slot.acquire(blocking=False): raise OcrError(429, "OCR worker is busy")
    try:
        try:
            raw = base64.b64decode(data.image, validate=True)
            if len(raw) > 8000000: raise ValueError()
            with Image.open(io.BytesIO(raw)) as image:
                if image.width * image.height > 25000000: raise ValueError()
                import numpy as np
                pixels = np.array(image.convert("RGB"))
        except Exception: raise OcrError(422, "Invalid or oversized image")
        result = engine().predict(pixels)
        lines = []
        for page in result:
            texts = page.get("rec_texts", [])
            scores = page.get("rec_scores", [])
            lines.extend(str(text) for index, text in enumerate(texts) if index >= len(scores) or scores[index] >= .5)
        return {"text": "\n".join(lines), "source": "PaddlePaddle/PaddleOCR", "review_required": True}
    except OcrError: raise
    except Exception: raise OcrError(503, "PaddleOCR could not load or run its model. Check worker logs.")
    finally: slot.release()

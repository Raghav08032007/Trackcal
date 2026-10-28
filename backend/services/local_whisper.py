"""Bounded, CPU-only whisper.cpp inference using its Python wheel."""
from functools import lru_cache
from pathlib import Path
import os
import threading
import numpy as np
from fastapi import HTTPException

MODEL_PATH = Path(__file__).resolve().parents[1] / "runtime" / "whisper" / "ggml-tiny.bin"
slot = threading.Lock()

@lru_cache(maxsize=1)
def model():
    from pywhispercpp.model import Model
    return Model(str(MODEL_PATH), n_threads=min(4, os.cpu_count() or 2), print_realtime=False, print_progress=False, language="auto")

def transcribe_pcm(pcm: bytes):
    if not MODEL_PATH.exists(): raise HTTPException(503, "Whisper model is missing. Run backend/scripts/setup_whisper.py.")
    if not slot.acquire(blocking=False): raise HTTPException(429, "Local transcription is busy. Try again shortly.")
    try:
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
        if not samples.size or float(np.sqrt(np.mean(samples ** 2))) < .001: raise HTTPException(422, "No audible speech found")
        segments = model().transcribe(samples)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        if not text: raise HTTPException(422, "No speech was detected")
        return text[:4000]
    finally: slot.release()

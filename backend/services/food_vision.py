"""Food photo recognition without a language model: CLIP image and text embeddings (OpenAI CLIP, MIT licence; ONNX exports by
Xenova), run locally with ONNX Runtime. The photo's embedding is compared with an embedding for each dish (several descriptions averaged); the
closest dishes are the answer. Labelled example photos (runtime/models/food-examples, from tools/food-vision/collect.py) sharpen it further: a photo close to
a known example of a dish counts towards that dish. Fast (well under a second on a CPU), free per photo, the same photo
always gives the same answer.

Model files: backend/runtime/models/clip-l14/ (default) or clip-b16/ via FOOD_VISION_DIR. Prototype: not yet used by the app;
tools/food-vision/evaluate.py measures it against the photo bench.
"""
from __future__ import annotations

import hashlib, io, json, os, threading
from pathlib import Path

import numpy as np
from PIL import Image

from services.food_vision_dishes import DISHES

MODELS = Path(__file__).resolve().parents[1] / "runtime" / "models"
MODEL_DIR = Path(os.getenv("FOOD_VISION_DIR") or MODELS / "clip-l14")
EXAMPLES_DIR = Path(os.getenv("FOOD_EXAMPLES_DIR") or MODELS / "food-examples")
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
TEMPLATES = ("a photo of {name}, a dish.", "a close-up photo of {name} on a plate.", "{name}: {look}.", "a top-down photo of {name}.")
LOGIT_SCALE = 100.0
_lock = threading.Lock()
_state: dict = {}


def available() -> bool:
    return (MODEL_DIR / "vision_model_quantized.onnx").exists() and (MODEL_DIR / "text_model_quantized.onnx").exists()


def _session(name):
    import onnxruntime as ort
    opts = ort.SessionOptions(); opts.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
    return ort.InferenceSession(str(MODEL_DIR / f"{name}.onnx"), opts, providers=["CPUExecutionProvider"])


def _normalize(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def _text_embeddings():
    """One embedding per dish (its descriptions averaged), cached on disk by the dish list's hash."""
    key = hashlib.sha256(json.dumps([DISHES, TEMPLATES]).encode()).hexdigest()[:16]
    cache = MODEL_DIR / f"dishes-{key}.npy"
    if cache.exists():
        return np.load(cache)
    from tokenizers import Tokenizer
    tok = Tokenizer.from_file(str(MODEL_DIR / "tokenizer.json"))
    text = _session("text_model_quantized")
    rows = []
    for name, look in DISHES:
        vecs = []
        for t in TEMPLATES:
            ids = tok.encode(t.format(name=name, look=look or name)).ids[:77]
            vecs.append(text.run(None, {"input_ids": np.array([ids], dtype=np.int64)})[0][0])
        rows.append(_normalize(_normalize(np.array(vecs)).mean(0)))
    out = np.array(rows, dtype=np.float32)
    np.save(cache, out)
    return out


def _load():
    with _lock:
        if not _state:
            _state["vision"] = _session("vision_model_quantized")
            _state["dishes"] = _text_embeddings()
    return _state


def _pixels(image_bytes: bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    s = 224 / min(w, h)
    img = img.resize((max(224, round(w * s)), max(224, round(h * s))), Image.BICUBIC)
    w, h = img.size
    left, top = (w - 224) // 2, (h - 224) // 2
    a = (np.asarray(img.crop((left, top, left + 224, top + 224)), dtype=np.float32) / 255 - MEAN) / STD
    return a.transpose(2, 0, 1)[None]


def embed_image(image_bytes: bytes):
    st = _load()
    return _normalize(st["vision"].run(None, {"pixel_values": _pixels(image_bytes)})[0][0])


def build_examples():
    """(embeddings [n, dim], dish index [n]) for the labelled example photos, cached in examples.npz. Rebuilt when the
    manifest (examples/manifest.json, from tools/food-vision/collect.py) changes."""
    npz, man = MODEL_DIR / "examples.npz", EXAMPLES_DIR / "manifest.json"
    index = {name: i for i, (name, _) in enumerate(DISHES)}
    if npz.exists() and (not man.exists() or npz.stat().st_mtime >= man.stat().st_mtime):
        z = np.load(npz, allow_pickle=False)
        names = [str(n) for n in z["dish"]]
        keep = [i for i, n in enumerate(names) if n in index]
        return z["emb"][keep], np.array([index[names[i]] for i in keep], dtype=np.int32)
    if not man.exists():
        return np.zeros((0, _load()["dishes"].shape[1]), np.float32), np.zeros(0, np.int32)
    rows, dishes = [], []
    for m in json.load(open(man, encoding="utf-8")):
        f = EXAMPLES_DIR / m["file"]
        if m["dish"] in index and f.exists():
            try:
                rows.append(embed_image(f.read_bytes())); dishes.append(m["dish"])
            except Exception:
                continue
    emb = np.array(rows, dtype=np.float32).reshape(len(rows), -1)
    np.savez(npz, emb=emb, dish=np.array(dishes))
    return emb, np.array([index[d] for d in dishes], dtype=np.int32)


def examples():
    """The shipped example embeddings (loaded once)."""
    if "examples" not in _state:
        ex = build_examples()
        with _lock:
            _state.setdefault("examples", ex)
    return _state["examples"]


def classify(image_bytes: bytes, top: int = 4, examples=None, weight: float = 1.0):
    """[{'name', 'confidence'}] best first. examples: optional (embeddings [n, 512], dish index per row) of labelled photos:
    each dish's closest example photos (mean of its best 2) add to its text score."""
    st = _load()
    img = embed_image(image_bytes)
    logits = LOGIT_SCALE * (st["dishes"] @ img)
    if examples is not None and len(examples[0]) and weight:
        sims = examples[0] @ img
        near = np.zeros(len(DISHES), dtype=np.float32)
        for i in np.unique(examples[1]):
            s = np.sort(sims[examples[1] == i])[::-1][:2]
            near[i] = s.mean()
        floor = np.median(near[near > 0]) if (near > 0).any() else 0
        logits = logits + LOGIT_SCALE * weight * np.where(near > 0, near - floor, 0)
    p = np.exp(logits - logits.max()); p /= p.sum()
    order = np.argsort(-p)[:top]
    return [{"name": DISHES[i][0], "confidence": round(float(p[i]), 3)} for i in order]

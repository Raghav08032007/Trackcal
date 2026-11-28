"""Food photo recognition without a language model: CLIP image and text embeddings (OpenAI CLIP, MIT licence; ONNX exports by
Xenova), run locally with ONNX Runtime. The photo's embedding is compared with an embedding for each dish (several descriptions averaged); the
closest dishes are the answer. Labelled example photos (runtime/models/food-examples, from tools/food-vision/collect.py) sharpen it further: a photo close to
a known example of a dish counts towards that dish. Fast (well under a second on a CPU), free per photo, the same photo
always gives the same answer.

Model files: backend/runtime/models/clip-l14/ (default) or clip-b16/ via FOOD_VISION_DIR. Prototype: not yet used by the app;
tools/food-vision/evaluate.py measures it against the photo bench.
"""
from __future__ import annotations

import hashlib, io, json, os, re, threading
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
        if "vision" not in _state:
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


def classify(image_bytes: bytes, top: int = 4, examples=None, weight: float = 0.25):
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


def enabled() -> bool:
    """On when the model files are present, unless FOOD_VISION=off."""
    return os.getenv("FOOD_VISION", "on").lower() != "off" and available()


def suggest(image_bytes: bytes, top: int = 4):
    """The classifier's best dishes for a photo, or [] when it is off or anything goes wrong (it is only ever a helper)."""
    if not enabled():
        return []
    try:
        return classify(image_bytes, top, examples())
    except Exception:
        return []


def _key(name: str) -> str:
    return " ".join(sorted(w for w in re.findall(r"[a-z]+", name.lower()) if w not in {"and", "with", "the", "a"}))


def merge_alternatives(dish: str, alternatives: list, picks: list, limit: int = 4, floor: float = 0.05):
    """The AI's alternatives first, then the classifier's picks it didn't already name (same words in any order count as
    the same dish), at most `limit` in all."""
    seen = {_key(dish), *(_key(a) for a in alternatives)}
    out = list(alternatives)
    for p in picks:
        k = _key(p["name"])
        if len(out) >= limit:
            break
        if p.get("confidence", 0) >= floor and k not in seen:
            out.append(p["name"]); seen.add(k)
    return out[:limit]


# Typical one-person portion in grams, by the words in the dish name (first match wins); 200 g otherwise.
PORTIONS = (("biryani", 300), ("pulao", 250), ("fried rice", 250), ("rice", 200), ("khichdi", 250), ("pongal", 200), ("bath", 250),
            ("naan", 90), ("bhatura", 80), ("paratha", 80), ("parotta", 80), ("kulcha", 80), ("roti", 40), ("chapati", 40), ("thepla", 40), ("puri", 30),
            ("dosa", 120), ("uttapam", 150), ("idli", 120), ("vada", 100), ("appam", 100), ("pesarattu", 120),
            ("samosa", 100), ("kachori", 80), ("pakora", 100), ("tikki", 100), ("momos", 150), ("pani puri", 100), ("vada pav", 150),
            ("gulab jamun", 80), ("rasgulla", 80), ("jalebi", 60), ("ladoo", 40), ("barfi", 40), ("kulfi", 70), ("ice cream", 100),
            ("lassi", 250), ("chai", 150), ("coffee", 150), ("smoothie", 250),
            ("thali", 600), ("chole bhature", 350), ("pav bhaji", 350), ("misal pav", 350),
            ("curry", 200), ("masala", 200), ("dal", 200), ("sambar", 200), ("rasam", 200), ("paneer", 200), ("kofta", 200), ("soup", 250),
            ("chutney", 30), ("peanuts", 30), ("boiled eggs", 100), ("omelette", 120), ("banana", 120), ("apple", 180), ("mango", 150),
            ("pizza", 250), ("burger", 220), ("sandwich", 180), ("fries", 150), ("noodles", 250), ("pasta", 250), ("sushi", 200))


def typical_grams(name: str) -> int:
    n = name.lower()
    return next((g for w, g in PORTIONS if w in n), 200)


def offline_meal(image_bytes: bytes, lookup, picks=None):
    """A meal estimate without the AI: the classifier names the dish and the catalog gives its nutrition for a typical
    portion. None when the classifier is off, unsure (best pick under 25%) or the catalog doesn't know the dish.
    Shaped like the AI's reply so services.meal_analysis.normalize_meal can check it."""
    picks = picks if picks is not None else suggest(image_bytes)
    if not picks or picks[0]["confidence"] < 0.25:
        return None
    name = picks[0]["name"]
    try:
        per = lookup(name.split("(")[0].strip())
    except Exception:
        per = None
    if not per or not per.get("calories"):
        return None
    grams = typical_grams(name)
    f = grams / 100
    item = {"name": name, "quantity_g": grams, "quantity_g_low": round(grams * .7), "quantity_g_high": round(grams * 1.4),
            "calories": per["calories"] * f, "protein_g": per["protein_g"] * f, "carbs_g": per["carbs_g"] * f, "fat_g": per["fat_g"] * f,
            "confidence": round(min(.6, picks[0]["confidence"]), 2), "nutrition_source": per.get("source") or "TrackCal catalog"}
    return {"dish_name": name, "dish_alternatives": [p["name"] for p in picks[1:4]], "components": [item]}


NON_VEG = re.compile(r"\b(mutton|lamb|goat|chicken|egg|eggs|omelette|fish|prawn|prawns|shrimp|crab|beef|pork|meat|keema|"
                     r"shawarma|steak|kabsa|rogan josh)\b", re.I)  # ambiguous words (tikka, kebab, burger) are not enough
VEG_WORDS = re.compile(r"\b(veg|vegetable|vegetarian|paneer|dal|pulao|jeera|plain)\b", re.I)


def is_non_veg(name: str):
    """True for a meat, fish or egg dish, False for a clearly vegetarian name, None when the name doesn't say."""
    if NON_VEG.search(name):
        return True
    return False if VEG_WORDS.search(name) else None


def disagreement(dish: str, picks: list, floor: float = 0.45):
    """The classifier's dish when it is confident and disagrees with the AI on vegetarian vs non-vegetarian (the
    'mutton biryani read as vegetable pulao' mistake), else None."""
    if not picks or picks[0].get("confidence", 0) < floor:
        return None
    mine, theirs = is_non_veg(picks[0]["name"]), is_non_veg(dish)
    return picks[0]["name"] if mine is not None and theirs is not None and mine != theirs else None

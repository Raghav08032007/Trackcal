"""Set up the food photo classifier that works without an LLM (services/food_vision.py).

  pip install -r requirements-vision.txt
  python scripts/setup_food_vision.py              # model files (about 430 MB), checked against their SHA-256
  python scripts/setup_food_vision.py --examples   # also the labelled example photos (Wikimedia Commons) and their embeddings

Model: OpenAI CLIP ViT-L/14 (MIT licence), ONNX export by Xenova on Hugging Face, pinned to one revision.
Files go to backend/runtime/models/clip-l14/ (git-ignored). Downloads resume if interrupted; rerunning is safe.
Without these files the app keeps working with the AI model alone.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "runtime" / "models" / "clip-l14"
REVISION = "c307790166907339eed5a9a53a249af534102536"
BASE = f"https://huggingface.co/Xenova/clip-vit-large-patch14/resolve/{REVISION}"
FILES = {  # published path -> sha256
    "onnx/vision_model_quantized.onnx": "9a658de8944a2001719beabf6c5030cfe7b3dc80e85983f69fc648d6b4d7ec0f",
    "onnx/text_model_quantized.onnx": "6d31c7a212681c3918d78193b6b4f98c70fe540577f9a0a57fe7ba8c7439244c",
    "tokenizer.json": "72ed5c96db5729294468543e4bc75fce14ca63f58e37300290189ba1c1e52b85",
    "preprocessor_config.json": "6f638fb9401a6d6296feff533ee7efe657b787c49f954f82f5906b36ef2a1b1f",
    "config.json": "99d2f15ccaf4f72c1e4c656dc77ae0fa487696860617ea50626d3a14a018185d",
}


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, path, expected):
    if path.exists() and sha256(path) == expected:
        return "ok"
    part = path.with_suffix(path.suffix + ".part")
    for attempt in range(8):
        offset = part.stat().st_size if part.exists() else 0
        try:
            with requests.get(url, stream=True, timeout=(15, 90), headers={"Range": f"bytes={offset}-"} if offset else {}) as r:
                r.raise_for_status()
                if offset and r.status_code != 206:
                    offset = 0
                with part.open("ab" if offset else "wb") as out:
                    for chunk in r.iter_content(1 << 20):
                        out.write(chunk)
            break
        except requests.RequestException:
            print(json.dumps({"retry": attempt + 1, "file": path.name}), flush=True)
    else:
        raise SystemExit(f"Download of {path.name} kept failing; rerun to resume.")
    if sha256(part) != expected:
        part.unlink()
        raise SystemExit(f"{path.name} does not match its checksum; deleted. Rerun to download again.")
    part.replace(path)
    return "downloaded"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--examples", action="store_true", help="also collect example photos and build their embeddings")
    a = ap.parse_args()
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, digest in FILES.items():
        print(json.dumps({"file": Path(name).name, "status": download(f"{BASE}/{name}", TARGET / Path(name).name, digest)}), flush=True)
    (TARGET / "manifest.json").write_text(json.dumps({"model": "Xenova/clip-vit-large-patch14", "revision": REVISION, "licence": "MIT (OpenAI CLIP)",
                                                       "files": {Path(k).name: v for k, v in FILES.items()}}, indent=2))
    if a.examples:
        subprocess.run([sys.executable, str(ROOT.parent / "tools" / "food-vision" / "collect.py"), "--per", "10"], check=True)
    sys.path.insert(0, str(ROOT))
    from services import food_vision
    emb, dish = food_vision.build_examples()
    print(json.dumps({"status": "ready", "examples": int(len(dish)), "dishes": len(food_vision.DISHES)}))


if __name__ == "__main__":
    main()

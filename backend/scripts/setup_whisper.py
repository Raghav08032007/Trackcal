"""Download the official whisper.cpp tiny model for the installed CPU bindings."""
import hashlib
import json
from pathlib import Path
import requests

root = Path(__file__).resolve().parents[1] / "runtime" / "whisper"
root.mkdir(parents=True, exist_ok=True)
model = root / "ggml-tiny.bin"
url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
if not model.exists():
    temporary = model.with_suffix(".part")
    completed = False
    for attempt in range(8):
        offset = temporary.stat().st_size if temporary.exists() else 0
        try:
            with requests.get(url, stream=True, timeout=(15, 90), headers={"Range": f"bytes={offset}-", "Accept-Encoding": "identity"}) as response:
                response.raise_for_status()
                if offset and response.status_code != 206: offset = 0
                if response.status_code == 206 and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
                    raise RuntimeError("Unexpected model download range")
                with temporary.open("ab" if offset else "wb") as stream:
                    for chunk in response.iter_content(1024 * 1024): stream.write(chunk)
            completed = True
            break
        except requests.RequestException:
            print(json.dumps({"download_attempt": attempt + 1, "bytes_saved": temporary.stat().st_size if temporary.exists() else 0}), flush=True)
    if not completed: raise SystemExit("Model download interrupted; rerun to resume the partial file.")
    temporary.replace(model)
manifest = {"runtime": "https://github.com/absadiki/pywhispercpp", "engine": "https://github.com/ggml-org/whisper.cpp", "model_url": url,
    "model_sha256": hashlib.file_digest(model.open("rb"), "sha256").hexdigest()}
(root / "manifest.json").write_text(json.dumps(manifest, indent=2))
print(json.dumps({"status": "model downloaded", "model": str(model)}))

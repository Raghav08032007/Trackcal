"""Collect labelled example photos for the food classifier (backend/services/food_vision.py) from Wikimedia Commons.

Each dish gets up to --per openly licensed photos, found by searching Commons for its name. Photos used by the accuracy
bench (videos/food-bench) are skipped so the bench stays a fair test. Photos and a manifest (title, licence, url, dish)
go to backend/runtime/models/food-examples/ (git-ignored); only their embeddings and the credits list are shipped.

  python tools/food-vision/collect.py [--per 12] [--only biryani]
"""
import argparse, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "backend", "runtime", "models", "food-examples")
BENCH = os.path.join(ROOT, "videos", "food-bench")
UA = {"User-Agent": "TrackCalFoodVision/1.0 (food photo examples)"}
sys.path.insert(0, os.path.join(ROOT, "backend"))
from services.food_vision_dishes import DISHES  # noqa: E402


def slug(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower())[:90]


def search(query, limit=40):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
                                "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 480})
    with urllib.request.urlopen(urllib.request.Request(f"https://commons.wikimedia.org/w/api.php?{q}", headers=UA), timeout=60) as r:
        pages = json.loads(r.read()).get("query", {}).get("pages", {}).values()
    return sorted(pages, key=lambda p: p.get("index", 999))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--per", type=int, default=12); ap.add_argument("--only", default="")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(man_path, encoding="utf-8")) if os.path.exists(man_path) else []
    have = {m["file"] for m in manifest}
    bench = {f[:-4] for f in os.listdir(BENCH)} if os.path.isdir(BENCH) else set()
    for name, _ in DISHES:
        if a.only and a.only.lower() not in name.lower():
            continue
        words = re.sub(r"\(.*?\)", "", name).strip()
        mine = sum(1 for m in manifest if m["dish"] == name)
        if mine >= a.per:
            continue
        try:
            pages = search(f'"{words}"') or search(words)
        except Exception as e:
            print("search failed", name, e); continue
        for p in pages:
            if mine >= a.per:
                break
            info = (p.get("imageinfo") or [{}])[0]
            s = slug(p["title"])
            if info.get("mime") not in ("image/jpeg", "image/png", "image/webp") or not info.get("thumburl") or s in bench:
                continue
            # the file title must name the dish (search also matches descriptions)
            key = [w for w in re.findall(r"[a-z]+", words.lower()) if len(w) > 2]
            if not all(w in p["title"].lower() for w in key[:2]):
                continue
            file = s + ".jpg"
            if file in have:
                continue
            try:
                with urllib.request.urlopen(urllib.request.Request(info["thumburl"], headers=UA), timeout=60) as r:
                    open(os.path.join(OUT, file), "wb").write(r.read())
            except Exception as e:
                print("download failed", p["title"], e); continue
            lic = (info.get("extmetadata", {}).get("LicenseShortName", {}) or {}).get("value", "")
            artist = re.sub(r"<[^>]+>", "", (info.get("extmetadata", {}).get("Artist", {}) or {}).get("value", ""))[:120]
            manifest.append({"dish": name, "file": file, "title": p["title"], "license": lic, "artist": artist, "url": info.get("descriptionurl", "")})
            have.add(file); mine += 1
            time.sleep(0.3)
        print(f"{name}: {mine}")
        json.dump(manifest, open(man_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("total", len(manifest))


if __name__ == "__main__":
    main()

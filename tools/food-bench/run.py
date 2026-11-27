"""Food photo benchmark: does the photo scan name the right dish?

Openly licensed dish photos from Wikimedia Commons (the file title names the dish) go through the app's own /api/analyze.
A result counts as correct (top-1) when the dish name contains the expected words, and as "correctable" (top-4) when the
right dish is the name or one of the alternatives offered for one-tap correction. Vegetarian/non-vegetarian mix-ups
(the mutton biryani -> vegetable pulao kind) are counted separately because they matter most.

  python tools/food-bench/run.py --api http://127.0.0.1:8011 [--per 3] [--only biryani]
Photos are cached in videos/food-bench/ (git-ignored). Uses the server's OpenRouter key: about 3 requests per dish.
"""
import argparse, base64, io, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "videos", "food-bench")
UA = {"User-Agent": "TrackCalFoodBench/1.0 (food photo accuracy test)"}

# dish -> (Commons search, words the answer must contain (any group fully), non-veg?)
DISHES = {
    "mutton biryani": ('"mutton biryani"', [["mutton", "biryani"], ["lamb", "biryani"], ["goat", "biryani"]], True),
    "chicken biryani": ('"chicken biryani"', [["chicken", "biryani"]], True),
    "vegetable pulao": ('"veg pulao" OR "vegetable pulao"', [["pulao"], ["pulav"], ["pilaf"]], False),
    "egg fried rice": ('"egg fried rice"', [["fried", "rice"]], True),
    "masala dosa": ('"masala dosa"', [["dosa"]], False),
    "idli": ('idli sambar', [["idli"]], False),
    "paratha": ('"aloo paratha"', [["paratha"]], False),
    "chapati": ('chapati roti bread', [["chapati"], ["roti"], ["phulka"]], False),
    "paneer butter masala": ('"paneer butter masala" OR "paneer makhani"', [["paneer"]], False),
    "dal": ('"dal tadka" OR "dal fry"', [["dal"], ["daal"], ["lentil"]], False),
    "chole": ('chole OR "chana masala"', [["chole"], ["chana"], ["chickpea"]], False),
    "butter chicken": ('"butter chicken"', [["butter", "chicken"], ["murgh", "makhani"]], True),
    "samosa": ('samosa', [["samosa"]], False),
    "poha": ('poha breakfast', [["poha"]], False),
    "gulab jamun": ('"gulab jamun"', [["gulab", "jamun"]], False),
    "pav bhaji": ('"pav bhaji"', [["pav", "bhaji"]], False),
}
NON_VEG = re.compile(r"\b(mutton|lamb|goat|chicken|egg|fish|prawn|shrimp|beef|pork|meat|keema)\b", re.I)


def fetch(url, data=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers


def commons_photos(query, n):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
                                "gsrnamespace": 6, "gsrlimit": 12, "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 800})
    body, _ = fetch(f"https://commons.wikimedia.org/w/api.php?{q}")
    pages = sorted(json.loads(body).get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    out = []
    for p in pages:
        info = (p.get("imageinfo") or [{}])[0]
        if info.get("mime") not in ("image/jpeg", "image/png", "image/webp") or not info.get("thumburl"):
            continue
        lic = (info.get("extmetadata", {}).get("LicenseShortName", {}) or {}).get("value", "")
        out.append({"title": p["title"], "url": info["thumburl"], "license": lic})
        if len(out) >= n:
            break
    return out


def cached(dish, photo):
    os.makedirs(CACHE, exist_ok=True)
    name = re.sub(r"[^a-z0-9]+", "-", photo["title"].lower())[:90] + ".jpg"
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        data, _ = fetch(photo["url"])
        with open(path, "wb") as f:
            f.write(data)
        time.sleep(0.5)
    return path


def matches(name, groups):
    n = name.lower()
    return any(all(w in n for w in g) for g in groups)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8011")
    ap.add_argument("--per", type=int, default=3)
    ap.add_argument("--only")
    a = ap.parse_args()
    rows = []
    for dish, (query, groups, nonveg) in DISHES.items():
        if a.only and a.only not in dish:
            continue
        for photo in commons_photos(query, a.per):
            path = cached(dish, photo)
            with open(path, "rb") as f:
                img = f.read()
            mime = "image/png" if img[:4] == b"\x89PNG" else "image/jpeg"
            body = json.dumps({"image": f"data:{mime};base64,{base64.b64encode(img).decode()}"}).encode()
            for attempt in range(3):
                try:
                    raw, _ = fetch(f"{a.api}/api/analyze", data=body, headers={"Content-Type": "application/json", "Origin": a.api}, timeout=180)
                    res = json.loads(raw); break
                except Exception as e:
                    res = {"error": str(e)[:120]}; time.sleep(6)
            name = res.get("dish_name", "") if isinstance(res, dict) else ""
            alts = res.get("alternatives", []) if isinstance(res, dict) else []
            top1 = matches(name, groups)
            top4 = top1 or any(matches(x, groups) for x in alts)
            vegmix = bool(name) and nonveg != bool(NON_VEG.search(name)) and not (dish in ("paneer butter masala",) and False)
            rows.append({"dish": dish, "photo": photo["title"], "license": photo["license"], "answer": name, "alternatives": alts,
                         "top1": top1, "top4": top4, "veg_mixup": vegmix, "error": res.get("error") if isinstance(res, dict) else None,
                         "kcal": (res.get("total_nutrition") or {}).get("calories") if isinstance(res, dict) else None})
            r = rows[-1]
            print(f"{'OK ' if top1 else 'fix' if top4 else 'NO '} {dish:22} -> {name[:48]:48} alts={alts[:3]}{' VEG-MIX' if vegmix else ''}{' ERR ' + str(r['error']) if r['error'] else ''}", flush=True)
            time.sleep(2)
    done = [r for r in rows if not r["error"]]
    if not done:
        print("no results"); return
    pct = lambda k: round(100 * sum(r[k] for r in done) / len(done))
    summary = {"photos": len(done), "errors": len(rows) - len(done), "top1_pct": pct("top1"), "top4_pct": pct("top4"), "veg_mixups": sum(r["veg_mixup"] for r in done)}
    print("\nSUMMARY", json.dumps(summary))
    with open(os.path.join(CACHE, "report.json"), "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "rows": rows}, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()

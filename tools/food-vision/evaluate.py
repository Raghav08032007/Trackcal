"""Accuracy of the non-LLM food classifier on the bench photos (videos/food-bench, never used as examples).

  python tools/food-vision/evaluate.py [--weight 0.6] [--k 3]
Builds backend/runtime/models/clip-b16/examples.npz (embedding + dish per example photo) on the way.
"""
import argparse, json, os, re, sys, time
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))
from services import food_vision as fv  # noqa: E402

BENCH = os.path.join(ROOT, "videos", "food-bench")
GROUPS = {'mutton biryani': [['mutton', 'biryani']], 'chicken biryani': [['chicken', 'biryani']], 'vegetable pulao': [['pulao']],
          'egg fried rice': [['fried rice']], 'masala dosa': [['dosa']], 'idli': [['idli']], 'paratha': [['paratha']],
          'chapati': [['roti']], 'paneer butter masala': [['paneer']], 'dal': [['dal']], 'chole': [['chole']],
          'butter chicken': [['butter chicken'], ['chicken tikka masala']], 'samosa': [['samosa']], 'poha': [['poha']],
          'gulab jamun': [['gulab jamun']], 'pav bhaji': [['pav bhaji']]}
NONVEG = re.compile(r"mutton|chicken|egg|fish|prawn|keema|kebab|tikka(?! paneer)|tandoori|steak|shawarma|burger", re.I)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--weight", type=float, default=None); ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    ex = fv.build_examples()
    print("examples", len(ex[1]), "for", len(set(ex[1].tolist())), "dishes")
    rep = json.load(open(os.path.join(BENCH, "report.json"), encoding="utf-8"))
    rows = []
    for r in rep["rows"]:
        p = os.path.join(BENCH, re.sub(r"[^a-z0-9]+", "-", r["photo"].lower())[:90] + ".jpg")
        if os.path.exists(p):
            rows.append((r["dish"], open(p, "rb").read()))
    weights = [a.weight] if a.weight is not None else [0.0, 0.5, 1.0, 1.5, 2.0, 3.0]
    for w in weights:
        ok1 = ok4 = mix = 0; t = time.time()
        for dish, data in rows:
            res = fv.classify(data, 4, ex, weight=w)
            names = [x["name"].lower() for x in res]
            m = lambda nm: any(all(x in nm for x in g) for g in GROUPS[dish])
            ok1 += m(names[0]); ok4 += any(m(n) for n in names)
            truth_nv = dish in ("mutton biryani", "chicken biryani", "egg fried rice", "butter chicken")
            mix += bool(NONVEG.search(names[0])) != truth_nv
            if a.verbose:
                print(("OK " if m(names[0]) else "fix" if any(m(n) for n in names) else "NO "), dish[:20].ljust(20), [f"{x['name']} {x['confidence']}" for x in res[:3]])
        n = len(rows)
        print(f"weight {w}: top1 {round(100*ok1/n)}%  top4 {round(100*ok4/n)}%  veg/non-veg mix-ups {mix}/{n}  {round(1000*(time.time()-t)/n)} ms/photo")


if __name__ == "__main__":
    main()

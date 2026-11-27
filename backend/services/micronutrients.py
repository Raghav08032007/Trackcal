"""Vitamins and minerals for a day: totals from the logged foods, daily needs, and gentle suggestions.

Daily needs are ICMR-NIN 2020 recommended dietary allowances for a sedentary adult (sodium: the WHO upper limit;
potassium: the ICMR/WHO adequate intake). Without a known sex the two values are averaged. This is general guidance for
healthy adults, not a deficiency test: pregnancy, illness, children and older adults have different needs.
"""

# slug -> (unit, men, women, kind) ; kind "need" means aim to reach it, "limit" means stay below it
NEEDS = {
    "iron": ("mg", 19, 29, "need"),
    "calcium": ("mg", 1000, 1000, "need"),
    "zinc": ("mg", 17, 13.2, "need"),
    "magnesium": ("mg", 440, 370, "need"),
    "potassium": ("mg", 3500, 3500, "need"),
    "vitamin_c": ("mg", 80, 65, "need"),
    "folate": ("mcg", 300, 220, "need"),
    "vitamin_d": ("mcg", 15, 15, "need"),
    "vitamin_b12": ("mcg", 2.5, 2.5, "need"),
    "sodium": ("mg", 2000, 2000, "limit"),
}

# Everyday Indian foods that are good sources (vegetarian first, then others), for the "how to get more" hint.
SOURCES = {
    "iron": ["rajma", "chana", "spinach (palak)", "jaggery", "ragi", "poha (with lemon)"],
    "calcium": ["milk", "curd", "paneer", "ragi", "sesame (til)", "amaranth leaves"],
    "zinc": ["chana", "pumpkin seeds", "cashews", "whole wheat", "eggs"],
    "magnesium": ["almonds", "peanuts", "bajra", "spinach", "bananas"],
    "potassium": ["bananas", "coconut water", "potatoes", "dal", "tomatoes"],
    "vitamin_c": ["amla", "guava", "oranges", "lemon", "capsicum"],
    "folate": ["dals", "chana", "spinach", "peanuts", "beetroot"],
    "vitamin_d": ["morning sunlight", "fortified milk", "eggs", "fish", "mushrooms in sunlight"],
    "vitamin_b12": ["milk", "curd", "paneer", "eggs", "fish", "B12-fortified foods"],
    "sodium": [],
}


def need_for(slug, sex):
    unit, men, women, kind = NEEDS[slug]
    target = men if sex == "male" else women if sex == "female" else round((men + women) / 2, 1)
    return unit, target, kind


def summarize(items, sex=None):
    """items: [{"grams": float, "calories": float, "per_100g": {slug: amount} or None}] -> the day's view.

    coverage: share of the day's calories that came from foods with vitamin and mineral data. Below ~60% the totals
    understate the day (AI estimates and custom foods carry no micronutrients), so no "low" warnings are given."""
    totals = {slug: 0.0 for slug in NEEDS}
    known = {slug: False for slug in NEEDS}
    kcal_all = sum(max(0.0, i.get("calories") or 0) for i in items)
    kcal_known = 0.0
    for item in items:
        per = item.get("per_100g") or {}
        grams = max(0.0, item.get("grams") or 0)
        if any(slug in per for slug in NEEDS if slug not in ("sodium",)):
            kcal_known += max(0.0, item.get("calories") or 0)
        for slug, amount in per.items():
            if slug in totals and amount is not None:
                totals[slug] += amount * grams / 100
                known[slug] = True
    coverage = round(kcal_known / kcal_all, 2) if kcal_all > 0 else 0.0
    rows = []
    for slug in NEEDS:
        unit, target, kind = need_for(slug, sex)
        amount = round(totals[slug], 1)
        pct = round(100 * amount / target) if target else 0
        if not known[slug]:
            status = "unknown"
        elif kind == "limit":
            status = "over" if amount > target else "ok"
        elif coverage < 0.6:
            status = "partial"
        else:
            status = "low" if pct < 50 else "near" if pct < 90 else "ok"
        rows.append({"nutrient": slug, "unit": unit, "amount": amount, "target": target, "percent": pct, "kind": kind,
                     "status": status, "sources": SOURCES[slug] if status in ("low", "near") else []})
    return {"coverage": coverage, "nutrients": rows,
            "basis": "ICMR-NIN 2020 dietary allowances for healthy adults; sodium is the WHO limit. Not a medical test."}

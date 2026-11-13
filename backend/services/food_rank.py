"""Finding the food a person means. Shared by the diary search and the food library.

Candidates come from the catalog by name prefix, local-language name, alias and full-text match on the typed words and their
spelling-variant form (search_synonyms: idly -> idli, ragi -> finger millet). They are then ranked by how well they match:
  - the person's favourites, then foods they logged recently;
  - the exact food: its name, its first part ("Spinach" in "Spinach, raw") or an alias/local name equal to what was typed, including
    names written the other way round ("Milk, whole" for "whole milk");
  - every typed word present;
  - a cooking word that was typed (boiled, roasted...) must be in the name; with none typed, the plain raw food is preferred;
  - processed variants (dried, powder, oil, juice, canned, fried, "fat added", glutinous...) rank below the plain food unless asked for;
  - shorter, plainer names win ties; verified catalog values win over unverified ones.
"""
from __future__ import annotations

import re

from sqlalchemy import case, func, or_, text
from sqlalchemy.orm import selectinload

import models

VARIANT = {'dried', 'dehydrated', 'powder', 'powdered', 'oil', 'flour', 'juice', 'canned', 'frozen', 'fried', 'sweetened', 'glutinous', 'roll',
           'nfs', 'added', 'mix', 'prepared', 'baby', 'infant', 'sauce', 'soup', 'instant', 'concentrate', 'syrup', 'candied', 'salted', 'smoked',
           'stuffed', 'breaded', 'paste', 'chips', 'pickle', 'pickled', 'desiccated', 'imitation', 'substitute', 'formula', 'drink', 'beverage',
           'dessert', 'frosted', 'pie', 'cake', 'cookie', 'candy', 'farmer', 'farmers', 'paneer', 'paratha', 'curry', 'masala', 'cup',
           'light', 'ready', 'heat', 'ns', 'sliced', 'butter', 'margarine', 'made', 'duck', 'goose', 'quail', 'emu', 'ostrich', 'deli', 'luncheon', 'nonfat', 'lowfat', 'reduced', 'lite', 'turkey'}
COOKING = {'cooked', 'boiled', 'baked', 'roasted', 'fried', 'steamed', 'grilled', 'raw', 'fresh', 'roast', 'boil'}
POOL = 400


def canonical_term(db, query):
    """Spelling variants and local names (idly, gobhi, capsicum...) map to the catalog's word via the search_synonyms table: the
    whole query first ("patta gobhi" -> cabbage), otherwise word by word ("cooked oatmeal" -> cooked oats)."""
    if not query:
        return query
    row = db.get(models.SearchSynonym, query)
    if row:
        return row.canonical
    words = query.split()
    if len(words) > 1:
        found = {r.term: r.canonical for r in db.query(models.SearchSynonym).filter(models.SearchSynonym.term.in_(words))}
        return ' '.join(found.get(w, w) for w in words)
    return query


def stem(word):
    """Plural to singular, enough for food names: berries -> berry, tomatoes -> tomato, pistachios -> pistachio."""
    if len(word) > 4 and word.endswith('ies'): return word[:-3] + 'y'
    if len(word) > 5 and word.endswith(('oes', 'ches', 'shes', 'sses')): return word[:-2]
    if len(word) > 3 and word.endswith('s') and not word.endswith(('ss', 'us', 'is')): return word[:-1]
    return word


def _words(s):
    return re.findall(r'[^\W\d_]+', (s or '').lower(), flags=re.UNICODE)


def _fulltext(term, all_words):
    words = [stem(w) for w in re.findall(r'\w+', term, flags=re.UNICODE) if len(w) >= 3]
    return ' '.join(('+' if all_words else '') + w + '*' for w in words)


def candidates(db, terms, category='', all_words=True):
    q = db.query(models.Food)   # nutrition is loaded later, only for the foods returned
    conditions = []
    for i, t in enumerate(terms):
        aliases = db.query(models.FoodAlias.food_id).filter(models.FoodAlias.alias.like(f'{t}%'))
        singular = ' '.join(stem(w) for w in t.split())
        translations = db.query(models.FoodTranslation.food_id).filter(models.FoodTranslation.name.like(f'%{t}%'))
        # Names often start with a word other than the first one typed: "Milk, whole" for "whole milk", "Egg, ..." for "boiled egg".
        starts = [models.Food.name_normalized.like(f'{stem(w)}%') for w in t.split() if len(w) >= 3 and w not in COOKING]
        # Local names often add words around the one typed ("chana ko dal" for chana dal): any alias starting with a typed word counts.
        starts += [models.Food.id.in_(db.query(models.FoodAlias.food_id).filter(models.FoodAlias.alias.like(f'{w}%'))) for w in t.split() if len(w) >= 4 and w not in COOKING]
        conditions += [models.Food.name_normalized.like(f'{t}%'), models.Food.name.like(f'{t}%'), models.Food.name_normalized.like(f'{singular}%'),
                       *starts, models.Food.id.in_(aliases), models.Food.id.in_(translations)]
        ft = _fulltext(t, all_words)
        if ft:
            conditions.append(text(f'MATCH (foods.name) AGAINST (:ft{i} IN BOOLEAN MODE)').bindparams(**{f'ft{i}': ft}))
    if not conditions:
        return []
    q = q.filter(or_(*conditions))
    if category:
        q = q.filter(models.Food.category == category)
    # A cheap first sort, so the cap keeps the likeliest foods: name starting with what was typed, then shorter names.
    head = terms[0]
    starts = [models.Food.name_normalized.like(f'{stem(w)}%') for t in terms for w in t.split() if len(w) >= 3 and w not in COOKING]
    named = [models.Food.id.in_(db.query(models.FoodAlias.food_id).filter(models.FoodAlias.alias.like(f'{t}%'))) for t in terms] +             [models.Food.id.in_(db.query(models.FoodTranslation.food_id).filter(models.FoodTranslation.name.like(f'%{t}%'))) for t in terms]
    early = case((or_(models.Food.name_normalized.like(f'{head}%'), *named), 0), *([(or_(*starts), 1)] if starts else []), else_=2)
    return q.order_by(early, func.char_length(models.Food.name)).limit(POOL).all()


def relevance(food, phrase, words, alias_names, favourite=False, recent=False):
    name = (food.name or '').lower()
    name_words = _words(name)
    parts = [p.strip() for p in name.split(',')]
    s = 1000.0 if favourite else 500.0 if recent else 0.0
    aliases = {a.lower() for a in alias_names}
    core = set(_words(' '.join(parts[:3])))
    if name == phrase or parts[0] == phrase:
        s += 120
    elif phrase in aliases:
        s += 110
    elif words and {stem(w) for w in words} <= {stem(c) for c in core} and len(core) <= len(words) + 2:
        s += 95                                        # "Milk, whole" for "whole milk", "Egg, white, raw" for "egg white"
    elif re.match(re.escape(phrase) + r'\b', name):
        s += 80
    elif any(a.startswith(phrase) for a in aliases):
        s += 60
    matched = sum(1 for w in words if any(t.startswith(stem(w)) for t in name_words) or any(w in a for a in aliases))
    s += 15 * matched + (25 if words and matched == len(words) else 0)
    asked = {w for w in words if w in COOKING}
    for w in asked:
        s += 20 if any(t.startswith(w[:4]) for t in name_words) else -12
    extra = [t for t in name_words if not any(t.startswith(stem(w)) or w.startswith(t) for w in words)]
    if not asked and 'raw' in name_words and len(extra) <= 3:
        s += 8                                         # nothing about cooking typed: the plain food as bought
    s -= min(45, 15 * sum(1 for t in extra if t in VARIANT and t not in words))
    s -= min(20, 2 * len(extra))
    s -= .02 * len(name)
    if food.is_verified:
        s += 5
    return s


def find(db, query, category='', favourites=(), recent=(), limit=12, offset=0):
    """(foods ranked best first, the canonical term searched, how they were found)."""
    query = (query or '').strip().lower()
    term = canonical_term(db, query)
    terms = [t for t in dict.fromkeys((query, term)) if t]
    if not terms:
        rows = db.query(models.Food).options(selectinload(models.Food.nutrients).selectinload(models.FoodNutrient.nutrient_def), selectinload(models.Food.portions)) \
            .filter(models.Food.category == category if category else True).order_by(models.Food.name_normalized, models.Food.id).offset(offset).limit(limit + 1).all()
        return rows, term, 'browse'
    pool, mode = candidates(db, terms, category, all_words=True), 'ranked match'
    if len(pool) < limit:
        seen = {f.id for f in pool}
        pool += [f for f in candidates(db, terms, category, all_words=False) if f.id not in seen]
    if not pool and len(term) >= 3:
        pool = db.query(models.Food) \
            .filter(or_(*[models.Food.name_normalized.like(f'%{t}%') for t in terms])).filter(models.Food.category == category if category else True).limit(POOL).all()
        mode = 'bounded substring fallback'
    ids = [f.id for f in pool]
    names = {}
    if ids:
        for food_id, alias in db.query(models.FoodAlias.food_id, models.FoodAlias.alias).filter(models.FoodAlias.food_id.in_(ids)):
            names.setdefault(food_id, []).append(alias)
        for food_id, local in db.query(models.FoodTranslation.food_id, models.FoodTranslation.name).filter(models.FoodTranslation.food_id.in_(ids)):
            names.setdefault(food_id, []).extend(n.strip() for n in local.split(' / '))
    favourites, recent = set(favourites), set(recent)
    best = {}
    for t in terms:
        words = _words(t)
        for f in pool:
            r = relevance(f, t, words, names.get(f.id, []), f.id in favourites, f.id in recent)
            best[f.id] = max(best.get(f.id, -1e9), r)
    pool.sort(key=lambda f: (-best[f.id], f.name_normalized or '', f.id))
    page = [f.id for f in pool[offset:offset + limit + 1]]
    loaded = {f.id: f for f in db.query(models.Food).options(selectinload(models.Food.nutrients).selectinload(models.FoodNutrient.nutrient_def),
                                                            selectinload(models.Food.portions)).filter(models.Food.id.in_(page or ['']))}
    return [loaded[i] for i in page if i in loaded], term, mode

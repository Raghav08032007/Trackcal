"""Server texts in the person's language.

The English text is the key, as in the web app: tr("Log two meals") returns it in the language of this request, or in English
when there is no translation. Values fill {placeholders}: tr("Drink {n} more glasses of water", n=6). Counted texts use
tr_n(one, other, count), so each language picks its own plural form ("1 day" / "2 days", Arabic's six forms).

Which language: an explicit lang= (emails and push notifications pass the language saved on the account), else the request's
Accept-Language (the web app sends the language the person chose), else English. Catalogs are built from the tables in
backend/i18n/tables/ by backend/i18n/build.py. Wrap texts kept in data tables in msg() where they are defined (it returns the
text unchanged and marks it for the coverage test) and translate them with tr() where they are sent.

Values the web app translates itself (roles, statuses, challenge goals) stay English here: only wrapped texts are translated.
"""
import json
from contextlib import contextmanager
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path

LANGS = ('en', 'hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar',
         'kn', 'ml')   # wave 2: screens first (docs/LANGUAGES.md); a server text not yet translated is sent in English
MESSAGES = Path(__file__).resolve().parents[1] / 'i18n' / 'messages'


def msg(text):
    """Marks a text kept in a data table for translation; it is translated later, with tr(), where it is sent."""
    return text


@lru_cache(maxsize=None)
def catalog(code):
    path = MESSAGES / f'{code}.json'
    return json.loads(path.read_text(encoding='utf-8')) if code != 'en' and path.exists() else {}


def supported(code):
    """'hi', 'hi-IN' or 'HI' -> 'hi'; anything else -> None."""
    base = (code or '').strip().lower().replace('_', '-').split('-')[0]
    return base if base in LANGS else None


def from_header(value):
    """The first language in an Accept-Language header that TrackCal speaks (in the order given, ignoring q weights below 0)."""
    tags = []
    for position, part in enumerate((value or '').split(',')):
        tag, _, params = part.strip().partition(';')
        weight = 1.0
        if params.strip().startswith('q='):
            try: weight = float(params.strip()[2:])
            except ValueError: weight = 0.0
        if tag and weight > 0: tags.append((-weight, position, tag))
    for _, _, tag in sorted(tags):
        if supported(tag): return supported(tag)
    return None


_FORCED = ContextVar('trackcal_language', default=None)


@contextmanager
def use(code):
    """Within this block every tr() uses `code`: for work no request drives (the Monday email, push notifications)."""
    token = _FORCED.set(supported(code) or 'en')
    try:
        yield
    finally:
        _FORCED.reset(token)


def for_preferences(prefs):
    """The language saved on an account: the interface language chosen in the app, else the food-name language when TrackCal
    speaks it, else English."""
    return supported(getattr(prefs, 'ui_language', '')) or supported(getattr(prefs, 'language', '')) or 'en'


def current():
    """The language in use: a use() block, else the request's Accept-Language, else English."""
    from flask import g, has_request_context, request
    if _FORCED.get(): return _FORCED.get()
    if not has_request_context(): return 'en'
    if 'lang' not in g: g.lang = from_header(request.headers.get('Accept-Language')) or 'en'
    return g.lang


INDIAN = ('hi', 'bn', 'mr', 'te', 'ta')
DIGITS = {'bn': '০১২৩৪৫৬৭৮৯', 'mr': '०१२३४५६७८९'}
SEPARATORS = {'es': ('.', ','), 'pt': ('.', ','), 'id': ('.', ',')}   # (thousands, decimal); others use (',', '.')


def number(value, lang=None):
    """A number in the language's style, as the browser writes it: 1,50,000 in Indian languages (Bengali and Marathi digits for
    those two), 150.000 and 2,5 in Spanish, Portuguese and Indonesian (Spanish groups from 10.000). English stays as Python writes it."""
    code = supported(lang) or current()
    if code == 'en':   # as the browser writes English: 1,200 and 2.5
        if isinstance(value, float) and value.is_integer(): value = int(value)
        return f'{value:,}' if isinstance(value, int) else str(value)
    if isinstance(value, float) and value.is_integer(): value = int(value)
    text = f'{value:.3f}'.rstrip('0').rstrip('.') if isinstance(value, float) else str(int(value))
    sign = '-' if text.startswith('-') else ''
    whole, _, fraction = text.lstrip('-').partition('.')
    thousands, decimal = SEPARATORS.get(code, (',', '.'))
    if code in INDIAN and len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2: groups.insert(0, head[-2:]); head = head[:-2]
        whole = ','.join(([head] if head else []) + groups + [tail])
    elif len(whole) > (4 if code == 'es' else 3):
        groups = []
        while len(whole) > 3: groups.insert(0, whole[-3:]); whole = whole[:-3]
        whole = thousands.join([whole] + groups)
    out = sign + whole + (decimal + fraction if fraction else '')
    if code in DIGITS: out = out.translate(str.maketrans('0123456789', DIGITS[code]))
    return out


def _fill(text, values, code='en'):
    for key, value in values.items():
        shown = number(value, code) if isinstance(value, (int, float)) and not isinstance(value, bool) else str(value)
        text = text.replace('{' + key + '}', shown)
    return text


def plural_form(code, n):
    """CLDR plural category for whole numbers, matching the browser's Intl.PluralRules for these languages."""
    n = abs(int(n))
    if code == 'ar':
        if n == 0: return 'zero'
        if n == 1: return 'one'
        if n == 2: return 'two'
        if 3 <= n % 100 <= 10: return 'few'
        if 11 <= n % 100 <= 99: return 'many'
        return 'other'
    if code == 'id': return 'other'
    if code in ('hi', 'bn', 'pt'): return 'one' if n in (0, 1) else 'other'
    if code in ('es',) and n != 0 and n % 1000000 == 0: return 'many'
    return 'one' if n == 1 else 'other'


def tr(text, lang=None, **values):
    """text in the language (see the module note), with {placeholders} filled from values."""
    code = supported(lang) or current()
    found = catalog(code).get(text, text) if text else text
    if isinstance(found, dict): found = found.get('other', text)
    return _fill(found, values, code) if values else found


def tr_n(one, other, count, lang=None, **values):
    """A counted text: tr_n("{count} day", "{count} days", n). The catalog keeps each language's forms under the 'other' text."""
    code = supported(lang) or current()
    found = catalog(code).get(other)
    if isinstance(found, dict):
        text = found.get(plural_form(code, count)) or found.get('other') or other
    elif isinstance(found, str):
        text = found
    else:
        text = one if plural_form('en', count) == 'one' else other
    return _fill(text, {'count': count, **values}, code)

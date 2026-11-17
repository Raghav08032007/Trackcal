"""Server translations: every wrapped text is in every wave-1 language with the same {placeholders}, and requests get their language."""
import ast
import json
import re
from pathlib import Path

import pytest

from services import i18n

BACKEND = Path(__file__).resolve().parents[1]
WAVE1 = [code for code in i18n.LANGS if code != 'en']
SKIP = {'tests', 'i18n', '.venv', 'alembic', 'migrations', '__pycache__', 'runtime', 'uploads', 'scripts'}


def wrapped_texts():
    """(file, text, plural) for every literal passed to tr(), tr_n() or msg() in the server code. f-strings are refused."""
    found = []
    for path in sorted(BACKEND.rglob('*.py')):
        if SKIP & set(path.relative_to(BACKEND).parts): continue
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            if not isinstance(node, ast.Call): continue
            name = getattr(node.func, 'id', None) or getattr(node.func, 'attr', None)
            if name not in ('tr', 'tr_n', 'msg'): continue
            args = node.args[:2] if name == 'tr_n' else node.args[:1]
            for arg in args:
                assert not isinstance(arg, ast.JoinedStr), f'{path.name}:{node.lineno}: use tr("... {{name}}", name=...) instead of an f-string'
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    found.append((path.name, arg.value, name == 'tr_n' and arg is args[1]))
    return found


def data_texts():
    """Texts kept in data files and translated where they are sent."""
    quotes = json.loads((BACKEND / 'data' / 'motivation.json').read_text(encoding='utf-8'))
    out = []
    def walk(value):
        if isinstance(value, str): out.append(('motivation.json', value, False))
        elif isinstance(value, dict):
            for key, item in value.items():
                if key in ('text', 'quote', 'line', 'message'): walk(item)
                elif isinstance(item, (dict, list)): walk(item)
        elif isinstance(value, list):
            for item in value: walk(item)
    walk(quotes)
    return out


PLACEHOLDER = re.compile(r'\{(\w+)\}')


@pytest.mark.parametrize('code', WAVE1)
def test_every_server_text_is_translated(code):
    catalog = json.loads((BACKEND / 'i18n' / 'messages' / f'{code}.json').read_text(encoding='utf-8'))
    missing, broken = [], []
    for file, text, plural in wrapped_texts() + data_texts():
        if text not in catalog: missing.append(f'{file}: {text[:70]}'); continue
        value = catalog[text]
        forms = value.values() if isinstance(value, dict) else [value]
        want = set(PLACEHOLDER.findall(text)) - ({'count'} if plural else set())
        for form in forms:
            if set(PLACEHOLDER.findall(form)) - {'count'} != want: broken.append(f'{file}: {text[:50]} -> {form[:50]}')
        if isinstance(value, dict):
            assert 'other' in value, f'{code}: "{text}" has no "other" form'
    assert not missing, f'{len(missing)} server texts missing in {code}:\n' + '\n'.join(missing[:40])
    assert not broken, f'{code}: placeholders differ:\n' + '\n'.join(broken[:20])


def test_header_parsing_picks_the_first_language_trackcal_speaks():
    assert i18n.from_header('hi-IN,hi;q=0.9,en;q=0.8') == 'hi'
    assert i18n.from_header('fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.5') == 'ar'
    assert i18n.from_header('de, en;q=0') is None
    assert i18n.from_header('') is None and i18n.from_header(None) is None


def test_plural_forms_match_the_browser_rules():
    assert [i18n.plural_form('ar', n) for n in (0, 1, 2, 3, 11, 100)] == ['zero', 'one', 'two', 'few', 'many', 'other']
    assert [i18n.plural_form('hi', n) for n in (0, 1, 2)] == ['one', 'one', 'other']
    assert [i18n.plural_form('en', n) for n in (0, 1, 2)] == ['other', 'one', 'other']
    assert i18n.plural_form('id', 1) == 'other'
    assert i18n.tr_n('{count} day', '{count} days', 1, lang='en') == '1 day'
    assert i18n.tr_n('{count} day', '{count} days', 3, lang='en') == '3 days'


def test_untranslated_text_stays_english_and_values_are_filled():
    assert i18n.tr('A text no table has, {n}', lang='hi', n=3) == 'A text no table has, 3'
    assert i18n.tr('anything') == 'anything'   # outside a request: English


def test_numbers_are_written_like_the_browser_writes_them():
    cases = {'ar': ['5', '1,500', '15,000', '150,000', '2.5', '1,234.5'], 'hi': ['5', '1,500', '15,000', '1,50,000', '2.5', '1,234.5'],
             'bn': ['৫', '১,৫০০', '১৫,০০০', '১,৫০,০০০', '২.৫', '১,২৩৪.৫'], 'mr': ['५', '१,५००', '१५,०००', '१,५०,०००', '२.५', '१,२३४.५'],
             'es': ['5', '1500', '15.000', '150.000', '2,5', '1234,5'], 'pt': ['5', '1.500', '15.000', '150.000', '2,5', '1.234,5'],
             'id': ['5', '1.500', '15.000', '150.000', '2,5', '1.234,5']}
    for code, want in cases.items():
        assert [i18n.number(n, code) for n in (5, 1500, 15000, 150000, 2.5, 1234.5)] == want, code
    assert i18n.number(1500, 'en') == '1500' and i18n.number(-1234, 'hi') == '-1,234' and i18n.number(3.0, 'es') == '3'

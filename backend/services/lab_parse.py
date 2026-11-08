"""Reading blood test values out of a report's text. Digital PDFs are read here on our own server; the file is not kept.

For each known test the first line naming it gives the value, the unit and, when printed, the lab's own normal range. Values are
converted to the test's standard unit, and anything outside the plausible range for that test is dropped as a misread. The person
confirms every value before any plan is built on it, so a reading that is merely missing is preferred over a guess.
"""
from __future__ import annotations

import io
import re

from services.lab_reference import TESTS, Test, to_canonical

UNITS = r'(%|mg/dl|g/dl|g/l|ng/ml|pg/ml|ug/l|µg/l|miu/l|miu/ml|uiu/ml|µiu/ml|u/l|iu/l|mmol/l|umol/l|µmol/l|nmol/l|pmol/l|meq/l)'
NUMBER = r'(\d+(?:\.\d+)?)'
# Text inside a test's name that contains digits but is not the result.
NOISE = (r'25[\s-]*\(?\s*(oh|hydroxy)\s*\)?\s*(d3?|vitamin\s*d)?', r'\bd3\b', r'\bd2\b', r'\b2\s*h(ou)?rs?\b', r'\(\s*hplc\s*\)', r'method\s*:?\s*[a-z /-]*')
MAX_PAGES = 30


def pdf_text(data: bytes) -> str:
    """All text of a digital PDF. Scanned PDFs have none; the caller then asks for a photo or manual entry."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            reader.decrypt('')
        except Exception:
            raise ValueError('This PDF is password protected. Open it, save an unlocked copy and try again.')
    return '\n'.join((page.extract_text() or '') for page in reader.pages[:MAX_PAGES])


def _clean(line: str) -> str:
    return re.sub(r'\s+', ' ', line.replace(' ', ' ').replace('–', '-').replace('—', '-')).strip()


def _find(test: Test, low: str):
    if any(re.search(x, low) for x in test.exclude):
        return None
    for alias in test.aliases:
        m = re.search(alias, low)
        if m:
            return m
    return None


def _reading(rest: str):
    """(value, unit, ref_low, ref_high) from the text after a test's name, or None."""
    for noise in NOISE:
        rest = re.sub(noise, ' ', rest)
    value_match = re.search(r'(?<![\w.])' + NUMBER + r'(?![\d.]*\s*-\s*\d)', rest)  # the first number that does not start a range
    if not value_match:
        return None
    value = float(value_match.group(1))
    after = rest[value_match.end():]
    unit_match = re.match(r'\s*' + UNITS, after)
    unit = unit_match.group(1) if unit_match else None
    if not unit:  # some reports print the unit before the value
        before = re.search(UNITS + r'\s*$', rest[:value_match.start()].strip())
        unit = before.group(1) if before else None
    low = high = None
    span = re.search(NUMBER + r'\s*(?:-|to)\s*' + NUMBER, after)
    if span:
        low, high = float(span.group(1)), float(span.group(2))
    else:
        below = re.search(r'(?:<|≤|less\s+than|upto|up\s+to)\s*' + NUMBER, after)
        above = re.search(r'(?:>|≥|more\s+than|greater\s+than)\s*' + NUMBER, after)
        high = float(below.group(1)) if below else None
        low = float(above.group(1)) if above else None
    return value, unit, low, high


def parse_text(text: str) -> list[dict]:
    """One reading per known test, in report order: {'code', 'name', 'value', 'unit', 'ref_low', 'ref_high', 'source'}."""
    lines = [_clean(l) for l in text.splitlines()]
    lines = [l for l in lines if l]
    found: dict[str, dict] = {}
    for i, line in enumerate(lines):
        low = line.lower()
        for test in TESTS:
            if test.code in found:
                continue
            m = _find(test, low)
            if not m:
                continue
            reading = _reading(low[m.end():])
            if reading is None and i + 1 < len(lines) and re.match(r'\s*[<>]?\s*\d', lines[i + 1]):  # tables put the value on the next line
                reading = _reading(lines[i + 1].lower())
            if reading is None:
                continue
            value, unit, ref_low, ref_high = reading
            canonical = to_canonical(test, value, unit)
            if canonical is None or not (test.plausible[0] <= canonical <= test.plausible[1]):
                continue
            def conv(x):
                if x is None:
                    return None
                c = to_canonical(test, x, unit)
                return round(c, 3) if c is not None else None
            found[test.code] = {'code': test.code, 'name': test.name, 'value': round(canonical, 3), 'unit': test.unit,
                                'ref_low': conv(ref_low), 'ref_high': conv(ref_high), 'source': line[:160]}
    order = {t.code: n for n, t in enumerate(TESTS)}
    return sorted(found.values(), key=lambda r: order[r['code']])

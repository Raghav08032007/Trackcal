"""Helper for the coach translation tables (../coach_<code>.py). The coaching sentences live in src/lib/pose/coach.ts; a
language file gives its translations as a list in the order the sentences first appear there, and table() pairs them
up. The build stops if a sentence is added, removed or reordered without updating every language file."""
import json
import re
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[3] / 'src' / 'lib' / 'pose' / 'coach.ts'
_DQ = re.compile(r'\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"')


def keys():
    """The coaching sentences in order of first appearance (the same extraction as src/lib/i18n/keys.ts)."""
    out = []
    for m in _DQ.finditer(SOURCE.read_text(encoding='utf-8')):
        k = json.loads('"' + m.group(1) + '"')
        if k not in out:
            out.append(k)
    return out


def table(code, lines):
    ks = keys()
    assert len(lines) == len(ks), f'coach_{code}.py: {len(lines)} lines for {len(ks)} coaching sentences in coach.ts'
    if code == 'fr':   # narrow no-break space before ? ! : ; as in the other French tables
        lines = [re.sub(r' ([?!:;])', ' \\1', x) for x in lines]
    for k, v in zip(ks, lines):
        for ph in re.findall(r'\{\w+\}', k):
            assert ph in v, f'coach_{code}.py: "{k}" lost {ph}'
    return {k: [v] for k, v in zip(ks, lines)}


def table_from(listname, code, lines):
    """Like table(), for a saved list of English texts (coach/<listname>.json): used for the phase 3 batches, whose texts
    are spread over many source files. The list is frozen, so a reordering in the source can't shift translations."""
    ks = json.loads((Path(__file__).parent / f'{listname}.json').read_text(encoding='utf-8'))
    assert len(lines) == len(ks), f'{listname}_{code}: {len(lines)} lines for {len(ks)} texts'
    if code == 'fr':
        lines = [re.sub(r' ([?!:;])', '\u202f\\1', x) for x in lines]
    for k, v in zip(ks, lines):
        for ph in re.findall(r'\{\w+\}', k):
            assert ph in v, f'{listname}_{code}: "{k}" lost {ph}'
    return {k: [v] for k, v in zip(ks, lines)}

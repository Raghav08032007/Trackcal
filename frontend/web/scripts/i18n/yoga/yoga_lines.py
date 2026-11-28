"""Helper for the yoga translation tables (../yoga_<code>.py). The yoga texts (lib/yoga/*, components/yoga-*) are listed in
keys.json in order; a language file gives its translations as a list in that order and table() pairs them up, checking
the count and every {placeholder}, so a missing or shifted line stops the build."""
import json
import re
from pathlib import Path

KEYS = json.loads((Path(__file__).resolve().parent / 'keys.json').read_text(encoding='utf-8'))


def table(code, lines):
    assert len(lines) == len(KEYS), f'yoga_{code}.py: {len(lines)} lines for {len(KEYS)} yoga texts'
    if code == 'fr':   # narrow no-break space before ? ! : ; as in the other French tables
        lines = [re.sub(r' ([?!:;])', '\u202f\1', x) for x in lines]
    for k, v in zip(KEYS, lines):
        assert sorted(re.findall(r'\{\w+\}', k)) == sorted(re.findall(r'\{\w+\}', v)), f'yoga_{code}.py: "{k}" placeholders differ in "{v}"'
    return {k: [v] for k, v in zip(KEYS, lines)}

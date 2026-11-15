"""Merge every translation table in this folder into src/lib/i18n/messages/<code>.json (one file per language, keys sorted).

    backend/.venv/Scripts/python frontend/web/scripts/i18n/build.py

Each table module defines LANGS (column order) and T: {English text: [one translation per language]}. A translation is a string, or
a dict of plural forms (zero/one/two/few/many/other). The same English text in two tables must agree, or the build stops."""
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'src' / 'lib' / 'i18n' / 'messages'


def main():
    merged = {}
    for path in sorted(HERE.glob('*.py')):
        if path.name == 'build.py':
            continue
        spec = importlib.util.spec_from_file_location(path.stem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for key, row in module.T.items():
            assert len(row) == len(module.LANGS), f'{path.name}: "{key}" has {len(row)} translations for {len(module.LANGS)} languages'
            for code, value in zip(module.LANGS, row):
                catalog = merged.setdefault(code, {})
                assert key not in catalog or catalog[key] == value, f'{path.name}: "{key}" in {code} differs from another table'
                catalog[key] = value
    OUT.mkdir(parents=True, exist_ok=True)
    for code, catalog in merged.items():
        (OUT / f'{code}.json').write_text(json.dumps(dict(sorted(catalog.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(code, len(catalog))


if __name__ == '__main__':
    main()

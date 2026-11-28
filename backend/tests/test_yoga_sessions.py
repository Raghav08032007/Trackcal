"""Yoga, breathing and meditation sessions from the yoga page save to the account (they were refused as unknown exercises
before 28 Nov 2026), and are never put into generated plans."""
import pytest

from services import personalization as rules
from services.personalization_inputs import Preferences
from tests.test_adventure import account, init
from tests.test_wellness import session, update


@pytest.mark.parametrize('key', ['yoga_vrikshasana', 'yoga_surya-namaskar', 'breath_nadi-shodhana', 'meditation_body-scan'])
def test_yoga_breathing_and_meditation_sessions_save(key):
    _, h = account(); init(h)
    s = session(h, [key], tracking_method='manual')
    r = update(h, s, exercises=[{'exercise_id': key, 'sets': [{'reps': 0, 'load': 0, 'minutes': 1}]}])
    assert r.status_code == 200, r.text


def test_every_asana_on_the_yoga_page_has_a_library_entry():
    import re
    from pathlib import Path
    src = (Path(__file__).resolve().parents[2] / 'frontend' / 'web' / 'src' / 'lib' / 'yoga' / 'asanas.ts').read_text(encoding='utf-8')
    ids = re.findall(r'A\(\{ id: "([a-z0-9-]+)"', src)
    assert len(ids) >= 40 and all('yoga_' + i in rules.TEMPLATES for i in ids)
    for page, prefix, keys in (('breathing.ts', 'breath_', r'\{ id: "([a-z0-9-]+)", name'), ('meditation.ts', 'meditation_', r'\{ id: "([a-z0-9-]+)", name')):
        found = re.findall(keys, (Path(__file__).resolve().parents[2] / 'frontend' / 'web' / 'src' / 'lib' / 'yoga' / page).read_text(encoding='utf-8'))
        assert found and all(prefix + k in rules.TEMPLATES for k in found), page


def test_logged_only_entries_never_enter_generated_plans():
    prefs = Preferences(interests=['yoga', 'mobility'], setting='home')
    keys = rules.eligible_templates(prefs, include_camera=True)
    assert keys and not any(k.startswith(('yoga_', 'breath_', 'meditation_')) for k in keys)

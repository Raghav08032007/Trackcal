"""Settings and lists that sync between devices: a save based on an old copy is refused with the current one,
an earlier manual backup becomes the starting copy, only app data keys are accepted, and other people and sites are kept out."""
import json

import pytest

from services import workspace_sync as rules
from tests.test_web_gateway import browser, signed_up, post

RECIPES = 'trackcal:studio:recipes'


def sync(c, *changes, origin='http://localhost'):
    return post(c, '/api/account/sync', {'changes': list(changes)}, origin=origin)


def test_keys_and_values_are_checked():
    assert rules.check_value('trackcal:preferences', {'units': 'metric'}) > 0
    for key in ['trackcal:journal:2026-11-08', 'trackcal:target:calories', 'trackcal:camera:draft', 'other']:
        with pytest.raises(ValueError): rules.check_value(key, 1)
    with pytest.raises(ValueError): rules.check_value('trackcal:preferences', {'a': {'b': {'c': {'d': {'e': {'f': {'g': {'h': {'i': {'j': 1}}}}}}}}}})
    with pytest.raises(ValueError): rules.check_value('trackcal:preferences', 'x' * 200_001)


def test_two_devices_never_overwrite_each_other_unseen():
    c = browser(); signed_up(c)
    assert c.get('/api/account/sync').get_json() == {'entries': {}}
    first = sync(c, {'key': RECIPES, 'value': [{'id': 'a', 'name': 'Dal'}], 'base_version': 0}).get_json()
    assert first['saved'] == {RECIPES: 1} and first['conflicts'] == {}
    # Phone B still thinks there is nothing saved: refused, and handed the current copy.
    late = sync(c, {'key': RECIPES, 'value': [{'id': 'b', 'name': 'Poha'}], 'base_version': 0}).get_json()
    assert late['saved'] == {} and late['conflicts'] == {RECIPES: {'value': [{'id': 'a', 'name': 'Dal'}], 'version': 1}}
    # After merging, B saves on top of version 1.
    merged = [{'id': 'a', 'name': 'Dal'}, {'id': 'b', 'name': 'Poha'}]
    assert sync(c, {'key': RECIPES, 'value': merged, 'base_version': 1}).get_json()['saved'] == {RECIPES: 2}
    assert c.get('/api/account/sync').get_json()['entries'][RECIPES] == {'value': merged, 'version': 2}
    # Removing is a save too.
    assert sync(c, {'key': RECIPES, 'removed': True, 'base_version': 2}).get_json()['saved'] == {RECIPES: 3}
    assert c.get('/api/account/sync').get_json()['entries'][RECIPES]['value'] is None


def test_one_bad_key_does_not_block_the_rest():
    c = browser(); signed_up(c)
    result = sync(c, {'key': 'trackcal:journal:2026-11-08', 'value': [], 'base_version': 0}, {'key': 'trackcal:comfort', 'value': True, 'base_version': 0}).get_json()
    assert result['saved'] == {'trackcal:comfort': 1} and 'trackcal:journal:2026-11-08' in result['refused']


def test_an_earlier_manual_backup_is_the_starting_copy():
    c = browser(); signed_up(c)
    backup = {'trackcal:studio:pantry': [{'id': 'p1', 'name': 'Rice', 'grams': 1000, 'expires': ''}], 'trackcal:journal:2026-11-01': []}
    assert c.post('/api/account/backup', data=json.dumps({'entries': backup}), headers={'Origin': 'http://localhost', 'Content-Type': 'application/json'}).status_code == 200
    entries = c.get('/api/account/sync').get_json()['entries']
    assert entries == {'trackcal:studio:pantry': {'value': backup['trackcal:studio:pantry'], 'version': 1}}   # the journal has its own table


def test_other_people_and_sites_are_kept_out():
    c = browser(); signed_up(c)
    sync(c, {'key': 'trackcal:appearance', 'value': 'dark', 'base_version': 0})
    assert sync(c, {'key': 'trackcal:appearance', 'value': 'light', 'base_version': 1}, origin='https://evil.example').status_code == 403
    other = browser(); signed_up(other)
    assert other.get('/api/account/sync').get_json() == {'entries': {}}
    assert browser().get('/api/account/sync').status_code == 401

import pytest
import database, models
from services import feature_flags


def test_every_registered_flag_defaults_to_off():
    with database.SessionLocal() as db:
        db.query(models.FeatureFlag).delete(); db.flush()
        assert feature_flags.all_flags(db) == {key: False for key in feature_flags.REGISTRY}


def test_unknown_flags_raise_instead_of_silently_resolving():
    with database.SessionLocal() as db:
        with pytest.raises(KeyError): feature_flags.is_enabled(db, 'socail_feed')
        with pytest.raises(KeyError): feature_flags.set_flag(db, 'not_a_flag', True, 'test')


def test_database_row_enables_and_disables_a_flag():
    with database.SessionLocal() as db:
        feature_flags.set_flag(db, 'web_push', True, 'test'); assert feature_flags.is_enabled(db, 'web_push')
        feature_flags.set_flag(db, 'web_push', False, 'test'); assert not feature_flags.is_enabled(db, 'web_push')
        assert db.get(models.FeatureFlag, 'web_push').updated_by == 'test'


def test_environment_override_wins_and_rejects_ambiguous_values(monkeypatch):
    with database.SessionLocal() as db:
        feature_flags.set_flag(db, 'billing', False, 'test')
        monkeypatch.setenv('FEATURE_BILLING', 'true'); assert feature_flags.is_enabled(db, 'billing')
        monkeypatch.setenv('FEATURE_BILLING', 'off'); assert not feature_flags.is_enabled(db, 'billing')
        monkeypatch.setenv('FEATURE_BILLING', 'maybe')
        with pytest.raises(ValueError): feature_flags.is_enabled(db, 'billing')

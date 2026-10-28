"""KI-01: deadlocked requests on XP blueprints are retried; others are not; exhaustion is a clear 503."""
import pymysql
import pytest
from flask import Blueprint
from sqlalchemy.exc import OperationalError

from flask_app import create_app, retry_deadlocks, route
from flask_app.params import Depends


def mysql_error(code):
    return OperationalError('UPDATE users', {}, pymysql.err.OperationalError(code, 'simulated'))


@pytest.fixture
def harness():
    calls = {'handler': 0, 'dependency': 0}
    plan = []  # error codes to raise on successive calls; then succeed

    def dependency():
        calls['dependency'] += 1
        return calls['dependency']

    def handler(seen=Depends(dependency)):
        calls['handler'] += 1
        if plan: raise mysql_error(plan.pop(0))
        return {'dependency_resolution': seen}

    retrying, plain = Blueprint('retrying_test', __name__, url_prefix='/t/retry'), Blueprint('plain_test', __name__, url_prefix='/t/plain')
    retry_deadlocks(retrying)
    route(retrying, 'POST', '/go', handler); route(plain, 'POST', '/go', handler)
    app = create_app(); app.register_blueprint(retrying); app.register_blueprint(plain)
    return app.test_client(), calls, plan


def test_a_deadlocked_request_is_retried_with_fresh_dependencies(harness):
    client, calls, plan = harness
    plan += [1213]
    response = client.post('/t/retry/go')
    assert response.status_code == 200
    assert calls['handler'] == 2
    assert response.get_json() == {'dependency_resolution': 2}  # resolved again after the rollback


def test_exhausted_retries_return_a_retryable_503(harness):
    client, calls, plan = harness
    plan += [1213, 1213, 1213]
    response = client.post('/t/retry/go')
    assert response.status_code == 503 and response.headers['Retry-After'] == '1'
    assert 'try again' in response.get_json()['detail']
    assert calls['handler'] == 3


def test_blueprints_without_opt_in_are_not_retried(harness):
    client, calls, plan = harness
    plan += [1213]
    response = client.post('/t/plain/go')
    assert response.status_code == 503 and calls['handler'] == 1


def test_other_database_errors_are_never_retried(harness):
    client, calls, plan = harness
    plan += [2013]  # lost connection: not a deadlock
    response = client.post('/t/retry/go')
    assert response.status_code == 500 and calls['handler'] == 1

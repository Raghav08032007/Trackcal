"""TrackCal Flask application factory.

Run locally:  flask --app flask_app run --port 8000      Production: gunicorn "flask_app:create_app()"
"""
import json
import logging
import os
import random
import sys
import time
import uuid

from dotenv import load_dotenv
from flask import Flask, Response, g, jsonify, request, send_from_directory
from pydantic import TypeAdapter
from sqlalchemy.exc import OperationalError

load_dotenv()
logger = logging.getLogger('trackcal')
logger.setLevel(logging.INFO); logger.propagate = False
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout); handler.setFormatter(logging.Formatter('%(message)s')); logger.addHandler(handler)

from flask_app import binding, errors  # noqa: E402
from flask_app.binding import call, encode  # noqa: E402


DEADLOCK_ATTEMPTS = 3


def retry_deadlocks(blueprint):
    """Re-run this blueprint's requests when MySQL picks them as a deadlock victim (KI-01).

    InnoDB rolls back the victim's whole transaction, so a rerun starts clean. Use only for blueprints
    whose handlers do nothing outside the database (no AI, email or HTTP calls) before committing.
    """
    blueprint.__dict__['trackcal_retry_deadlocks'] = True


def route(blueprint, method, rule, handler, status=200, response_model=None):
    """Declare one endpoint: HTTP method + rule -> handler, with its success status and optional response schema."""
    adapter = TypeAdapter(response_model) if response_model is not None else None
    attempts = DEADLOCK_ATTEMPTS if blueprint.__dict__.get('trackcal_retry_deadlocks') else 1

    def view(**path_values):
        for attempt in range(attempts):
            try:
                result = call(handler, **path_values); break
            except OperationalError as error:
                if not errors.is_deadlock(error) or attempt == attempts - 1: raise
                binding.reset_request()  # discard the rolled-back session and the user loaded with it
                time.sleep(0.02 * (attempt + 1) + random.random() * 0.03)
        if isinstance(result, Response): return result
        if adapter is not None: result = adapter.dump_python(adapter.validate_python(result, from_attributes=True), mode='json')
        if status == 204: return Response(status=204)
        response = jsonify(encode(result)); response.status_code = status
        return response

    view.__name__ = f'{handler.__name__}_{method.lower()}'
    view.handler, view.blueprint_dependencies = handler, blueprint.__dict__.setdefault('trackcal_dependencies', [])
    blueprint.add_url_rule(rule, endpoint=view.__name__, view_func=view, methods=[method])


def before_each(blueprint, dependency):
    """Run a router-wide dependency (such as a rate limit) before every endpoint in the blueprint."""
    blueprint.__dict__.setdefault('trackcal_dependencies', []).append(dependency)
    blueprint.before_request(lambda: binding.resolve(dependency) and None)


def _cors(app):
    origins = {o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',') if o.strip()}

    @app.before_request
    def preflight():
        if request.method == 'OPTIONS' and request.headers.get('Access-Control-Request-Method'):
            origin = request.headers.get('Origin')
            if origin not in origins: return Response('Disallowed CORS origin', status=400)
            response = Response(status=200)
            response.headers.update({'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true',
                                     'Access-Control-Allow-Methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
                                     'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers', ''),
                                     'Access-Control-Max-Age': '600', 'Vary': 'Origin'})
            return response

    @app.after_request
    def allow(response):
        origin = request.headers.get('Origin')
        if origin in origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers.add('Vary', 'Origin')
        return response


def create_app():
    from services.production_config import trusted_proxy_hops, validate_production
    validate_production()
    app = Flask(__name__)
    if trusted_proxy_hops():  # per-IP limits must see the client, not the proxy (KI-04)
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted_proxy_hops())
    app.json.sort_keys = False; app.json.ensure_ascii = False
    app.url_map.strict_slashes = False
    app.teardown_appcontext(binding.close_dependencies)
    errors.register(app)
    _cors(app)

    @app.before_request
    def start():
        g.request_id, g.started = str(uuid.uuid4()), time.monotonic()

    @app.after_request
    def observe(response):
        response.headers['X-Request-ID'] = g.get('request_id', '')
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        logger.info(json.dumps({'event': 'request', 'request_id': g.get('request_id'), 'method': request.method, 'status': response.status_code,
                                'duration_ms': round((time.monotonic() - g.get('started', time.monotonic())) * 1000)}))
        return response

    import database

    @app.get('/api/health')
    def health():
        ok = database.verify_connection()
        response = jsonify({'status': 'ok' if ok else 'degraded', 'database': 'connected' if ok else 'unreachable', 'version': '1.0.0', 'environment': os.getenv('APP_ENV', 'production')})
        response.status_code = 200 if ok else 503
        return response

    @app.get('/api/live')
    def live():
        return {'status': 'alive'}

    uploads = os.getenv('LOCAL_STORAGE_PATH', './uploads'); os.makedirs(uploads, exist_ok=True)
    if os.getenv('APP_ENV') != 'production':
        app.add_url_rule('/uploads/<path:name>', 'uploads', lambda name: send_from_directory(os.path.abspath(uploads), name))

    from flask_app.blueprints import register
    register(app)
    return app

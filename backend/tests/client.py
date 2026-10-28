"""One test client for both backends during the migration: TRACKCAL_BACKEND=flask (default) or fastapi.

Exposes `app` (with a `dependency_overrides` dict) and `client` with the request/response interface the
tests already use: client.post(url, json=..., data=..., files=..., headers=..., params=...) returning an
object with .status_code, .json(), .text, .headers and .content.
"""
import io
import os

os.environ.setdefault('APP_ENV', 'testing')
BACKEND = os.getenv('TRACKCAL_BACKEND', 'flask')


class FlaskResponse:
    def __init__(self, response):
        self._response, self.status_code, self.headers, self.content = response, response.status_code, response.headers, response.get_data()

    @property
    def text(self):
        return self.content.decode('utf-8', errors='replace')

    def json(self):
        import json
        return json.loads(self.content)


class FlaskClient:
    def __init__(self, app):
        self._client = app.test_client()

    def request(self, method, url, json=None, data=None, files=None, headers=None, params=None, content=None, cookies=None):
        payload = dict(data or {})
        for name, value in (files or {}).items():
            filename, body, *rest = value
            payload[name] = (io.BytesIO(body if isinstance(body, bytes) else body.read()), filename, *(rest[:1] or ['application/octet-stream']))
        kwargs = {'headers': headers or {}, 'query_string': params}
        if json is not None: kwargs['json'] = json
        elif content is not None: kwargs['data'] = content
        elif payload: kwargs['data'] = payload
        return FlaskResponse(self._client.open(url, method=method.upper(), **kwargs))

    def get(self, url, **kw): return self.request('GET', url, **kw)
    def post(self, url, **kw): return self.request('POST', url, **kw)
    def put(self, url, **kw): return self.request('PUT', url, **kw)
    def patch(self, url, **kw): return self.request('PATCH', url, **kw)
    def delete(self, url, **kw): return self.request('DELETE', url, **kw)
    def options(self, url, **kw): return self.request('OPTIONS', url, **kw)


def _needs_login(fn, seen=None):
    """True when fn (or any dependency it declares) requires a signed-in user."""
    import inspect
    from routers.auth import get_current_active_user, get_current_user
    seen = seen or set()
    if fn in (get_current_user, get_current_active_user): return True
    if fn in seen or not callable(fn): return False
    seen.add(fn)
    try: parameters = inspect.signature(fn).parameters.values()
    except (TypeError, ValueError): return False
    return any(type(p.default).__name__ == 'Depends' and _needs_login(p.default.dependency or p.annotation, seen) for p in parameters)


def private_routes():
    """(METHOD, '/path/{param}') for every endpoint that requires a signed-in user, on either backend."""
    import re
    if BACKEND == 'flask':
        found = []
        for rule in app.url_map.iter_rules():
            view = app.view_functions[rule.endpoint]
            handler = getattr(view, 'handler', None)
            if handler and (_needs_login(handler) or any(_needs_login(d) for d in view.blueprint_dependencies)):
                found += [(m, re.sub(r'<(?:\w+:)?(\w+)>', r'{\1}', rule.rule)) for m in rule.methods - {'HEAD', 'OPTIONS'}]
        return sorted(found)
    return sorted((m.upper(), p) for p, ops in app.openapi()['paths'].items() for m, op in ops.items() if isinstance(op, dict) and op.get('security'))


if BACKEND == 'flask':
    from flask_app import binding, create_app
    app = create_app()
    app.dependency_overrides = binding.overrides
    client = FlaskClient(app)
elif BACKEND == 'fastapi':
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
else:
    raise RuntimeError('TRACKCAL_BACKEND must be flask or fastapi')

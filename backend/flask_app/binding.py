"""Calls a handler function from a Flask view by binding its typed parameters to the request.

Handlers keep the signatures they already have: a Pydantic model parameter is the JSON body, Form/File
defaults come from multipart or urlencoded data, path values come from the URL rule, anything else is a
query parameter, and Depends(...) defaults are resolved here (cached once per request, like the old stack).
Validation failures raise the same 422 shape clients and tests already expect.
"""
import asyncio
import inspect
import uuid
from decimal import Decimal
from enum import Enum
from datetime import date, datetime, time
from types import SimpleNamespace
from typing import Annotated, Any, get_args, get_origin, Union

from flask import g, request
from pydantic import BaseModel, ValidationError, create_model
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

import database
from flask_app.errors import ApiError, RequestValidation

# Dependency markers are recognised by class name so handlers can keep their current imports until the
# final cleanup swaps them for flask_app.params equivalents with the same names.
_FORM, _FILE, _DEPENDS = {'Form'}, {'File'}, {'Depends'}
overrides = {}  # dependency -> replacement callable (tests), mirrors app.dependency_overrides


def get_db_session():
    if 'db' not in g: g.db = database.SessionLocal()
    return g.db


def close_db_session(_error=None):
    for generator in reversed(g.pop('dependency_cleanups', [])):
        generator.close()
    session = g.pop('db', None)
    if session is not None: session.close()


def _kind(default):
    return type(default).__name__ if isinstance(default, FieldInfo) or type(default).__name__ in _DEPENDS else None


def _is_model(annotation):
    if inspect.isclass(annotation) and issubclass(annotation, BaseModel): return True
    if get_origin(annotation) is Union: return any(_is_model(a) for a in get_args(annotation) if a is not type(None))
    return False


def _request_shim():
    return SimpleNamespace(url=SimpleNamespace(path=request.path), headers=request.headers,
                           client=SimpleNamespace(host=request.remote_addr), method=request.method)


class Upload:
    """The subset of the old UploadFile interface handlers use."""
    def __init__(self, storage):
        self._storage, self.filename, self.content_type = storage, storage.filename, storage.mimetype
    async def read(self, size=-1):
        return self._storage.stream.read(size)
    async def seek(self, offset):
        self._storage.stream.seek(offset)


def resolve(dependency):
    """Resolve a dependency callable once per request."""
    dependency = overrides.get(dependency, dependency)
    cache = g.setdefault('dependency_cache', {})
    if dependency in cache: return cache[dependency]
    from routers.auth import get_current_user, get_current_active_user
    if dependency is database.get_db and dependency not in overrides: value = get_db_session()
    elif dependency is get_current_user:
        header = request.headers.get('Authorization', '')
        scheme, _, token = header.partition(' ')
        if scheme.lower() != 'bearer' or not token:
            raise ApiError(401, 'Not authenticated', {'WWW-Authenticate': 'Bearer'})
        value = get_current_user(token=token, db=resolve(database.get_db))  # same session as the handler
    elif dependency is get_current_active_user: value = get_current_active_user(resolve(get_current_user))
    else: value = call(dependency)
    if inspect.isgenerator(value):  # yield-style dependency: use the yielded value, finish it after the request
        generator, value = value, next(value)
        g.setdefault('dependency_cleanups', []).append(generator)
    cache[dependency] = value
    return value


def _body():
    if request.content_length in (None, 0) and not request.data: return PydanticUndefined
    data = request.get_json(silent=True)
    if data is None:
        raise RequestValidation([{'type': 'json_invalid', 'loc': ['body', 0], 'msg': 'JSON decode error', 'input': {}, 'ctx': {'error': 'Invalid JSON'}}])
    return data


def call(fn, **path_values):
    """Bind request data to fn's parameters, call it (awaiting coroutines) and return its result."""
    kwargs, fields, raw, locations, errors = {}, {}, {}, {}, []
    for name, param in inspect.signature(fn).parameters.items():
        default, annotation = param.default, param.annotation
        annotation = Any if annotation is inspect.Parameter.empty else annotation
        if get_origin(annotation) is Annotated:  # Annotated[str, Form()] carries the marker in metadata
            base, *metadata = get_args(annotation)
            marker = next((m for m in metadata if _kind(m)), None)
            if marker is not None:
                annotation = base
                default = marker if _kind(marker) in _DEPENDS else FieldInfo.merge_field_infos(marker, default=PydanticUndefined if default is inspect.Parameter.empty else default)
        kind = _kind(default)
        if kind in _DEPENDS: kwargs[name] = resolve(default.dependency or annotation); continue
        if annotation is SimpleNamespace or getattr(annotation, '__name__', '') == 'Request':
            kwargs[name] = _request_shim(); continue
        if name in path_values: source, value = 'path', path_values[name]
        elif kind in _FILE:
            source, value = 'body', request.files.get(name, PydanticUndefined)
            if value is not PydanticUndefined: kwargs[name] = Upload(value); continue
        elif kind in _FORM: source, value = 'body', request.form.get(name, PydanticUndefined)
        elif _is_model(annotation): source, value = 'body', _body()
        else:
            source = 'query'
            value = request.args.getlist(name) if get_origin(annotation) is list else request.args.get(name, PydanticUndefined)
        field = default if isinstance(default, FieldInfo) else FieldInfo(default=PydanticUndefined if default is inspect.Parameter.empty else default)
        fields[name] = (annotation, field); locations[name] = source
        if value is not PydanticUndefined: raw[name] = value
    if fields:
        model = create_model(f'{fn.__name__}_params', **fields)
        try:
            kwargs.update(dict(model.model_validate(raw)))
        except ValidationError as error:
            for item in error.errors(include_url=False):
                name, *rest = item['loc']
                # A JSON body model reports field errors as ["body", field]; other values keep their own name.
                loc = ['body', *rest] if locations.get(name) == 'body' and _is_model(fields[name][0]) else [locations.get(name, 'query'), name, *rest]
                errors.append({**item, 'loc': loc})
    if errors: raise RequestValidation(errors)
    result = fn(**kwargs)
    return asyncio.run(result) if inspect.iscoroutine(result) else result


def encode(value):
    """JSON-compatible conversion matching the previous API's encoder."""
    if isinstance(value, BaseModel): return encode(value.model_dump(mode='json'))
    if isinstance(value, dict): return {str(encode(k)): encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)): return [encode(v) for v in value]
    if isinstance(value, Enum): return encode(value.value)
    if isinstance(value, (datetime, date, time)): return value.isoformat()
    if isinstance(value, uuid.UUID): return str(value)
    if isinstance(value, Decimal): return int(value) if value.as_tuple().exponent >= 0 else float(value)
    if isinstance(value, bytes): return value.decode()
    if isinstance(value, Exception): return str(value)
    return value

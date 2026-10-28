"""Calls a handler function from a Flask view by binding its typed parameters to the request.

Handlers declare what they need in their signatures (see flask_app.params): a Pydantic model parameter is
the JSON body, Form/File defaults come from multipart or urlencoded data, values named in the URL rule come
from the path, anything else is a query parameter, and Depends(...) is resolved here — once per request,
with yield-style dependencies finished after the response. Validation failures raise the 422 shape
({"detail": [{"type", "loc", "msg", "input", ...}]}) the web client and tests rely on.
"""
import asyncio
import copy
import inspect
import uuid
from decimal import Decimal
from enum import Enum
from datetime import date, datetime, time
from types import SimpleNamespace
from typing import Annotated, Any, Union, get_args, get_origin

from flask import g, request
from pydantic import BaseModel, ValidationError, create_model
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from flask_app import params
from flask_app.errors import RequestValidation

overrides = {}  # dependency -> replacement callable (tests)


def close_dependencies(_error=None):
    for generator in reversed(g.pop('dependency_cleanups', [])):
        generator.close()


def _is_model(annotation):
    if inspect.isclass(annotation) and issubclass(annotation, BaseModel): return True
    if get_origin(annotation) is Union: return any(_is_model(a) for a in get_args(annotation) if a is not type(None))
    return False


def _request_shim():
    return SimpleNamespace(url=SimpleNamespace(path=request.path), headers=request.headers,
                           client=SimpleNamespace(host=request.remote_addr), method=request.method)


class Upload:
    """What a handler receives for an UploadFile parameter."""
    def __init__(self, storage):
        self._storage, self.filename, self.content_type = storage, storage.filename, storage.mimetype

    async def read(self, size=-1):
        return self._storage.stream.read(size)

    async def seek(self, offset):
        self._storage.stream.seek(offset)


def resolve(dependency):
    """Resolve a dependency once per request; yield-style dependencies are finished at teardown."""
    dependency = overrides.get(dependency, dependency)
    cache = g.setdefault('dependency_cache', {})
    if dependency in cache: return cache[dependency]
    value = call(dependency)
    if inspect.isgenerator(value):
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
    """Bind request data to fn's parameters, call it (running coroutines to completion) and return the result."""
    kwargs, fields, raw, locations, errors = {}, {}, {}, {}, []
    for name, param in inspect.signature(fn).parameters.items():
        default, annotation = param.default, param.annotation
        annotation = Any if annotation is inspect.Parameter.empty else annotation
        if get_origin(annotation) is Annotated:  # Annotated[str, Form()] carries the marker in its metadata
            base, *metadata = get_args(annotation)
            marker = next((m for m in metadata if isinstance(m, (FieldInfo, params.Depends))), None)
            if marker is not None:
                annotation = base
                if isinstance(marker, FieldInfo):  # keep the marker subclass (merge_field_infos would not)
                    marker = copy.copy(marker)
                    marker.default = PydanticUndefined if default is inspect.Parameter.empty else default
                default = marker
        if isinstance(default, params.Depends): kwargs[name] = resolve(default.dependency or annotation); continue
        if annotation is params.Request: kwargs[name] = _request_shim(); continue
        if name in path_values: source, value = 'path', path_values[name]
        elif isinstance(default, params.FileInfo):
            source, value = 'body', request.files.get(name, PydanticUndefined)
            if value is not PydanticUndefined: kwargs[name] = Upload(value); continue
            annotation = Any
        elif isinstance(default, params.FormInfo): source, value = 'body', request.form.get(name, PydanticUndefined)
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
    """JSON-compatible conversion: ISO dates, string UUIDs, numeric Decimals, enum values, dumped models."""
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

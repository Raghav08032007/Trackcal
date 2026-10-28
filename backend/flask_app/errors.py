"""Error types and JSON error responses ({"detail": ...}), the contract the web client already relies on."""
import json
import logging
import uuid

from flask import jsonify
from werkzeug.exceptions import HTTPException as WerkzeugHTTPException

logger = logging.getLogger('trackcal')


class ApiError(Exception):
    def __init__(self, status_code, detail=None, headers=None):
        super().__init__(detail)
        self.status_code, self.detail, self.headers = status_code, detail, headers or {}


class RequestValidation(Exception):
    def __init__(self, errors):
        super().__init__('Request validation failed')
        self.errors = errors


def _respond(status, detail, headers=None):
    from flask_app.binding import encode
    response = jsonify({'detail': encode(detail)}); response.status_code = status
    for key, value in (headers or {}).items(): response.headers[key] = value
    return response


def register(app):
    @app.errorhandler(ApiError)
    def api_error(error):
        return _respond(error.status_code, error.detail, error.headers)

    @app.errorhandler(RequestValidation)
    def validation(error):
        return _respond(422, error.errors)

    @app.errorhandler(WerkzeugHTTPException)
    def http_error(error):
        names = {404: 'Not Found', 405: 'Method Not Allowed', 413: 'Request Entity Too Large'}
        return _respond(error.code, names.get(error.code, error.name))

    @app.errorhandler(Exception)
    def unexpected(error):
        request_id = str(uuid.uuid4())
        logger.error(json.dumps({'event': 'request_failed', 'request_id': request_id, 'exception_type': type(error).__name__}))
        response = jsonify({'detail': 'An unexpected error occurred. Please contact support with the request ID.', 'request_id': request_id})
        response.status_code = 500
        return response

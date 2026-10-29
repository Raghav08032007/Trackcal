"""Authentication endpoints under /api/v1/auth."""
from flask import Blueprint

from flask_app import before_each, route
from routers import auth as handlers

bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')
route(bp, 'POST', '/signup', handlers.signup, status=201, response_model=handlers.LoginResponse)
route(bp, 'POST', '/login', handlers.login, response_model=handlers.LoginResponse)
route(bp, 'POST', '/refresh', handlers.refresh_token, response_model=handlers.LoginResponse)
route(bp, 'GET', '/me', handlers.me)
route(bp, 'POST', '/password', handlers.change_password)
route(bp, 'POST', '/forgot-password', handlers.forgot_password)
route(bp, 'POST', '/reset-password', handlers.reset_password)
route(bp, 'POST', '/request-verification', handlers.request_verification)
route(bp, 'POST', '/verify-email', handlers.verify_email)
route(bp, 'POST', '/consume-ai', handlers.consume_ai)
route(bp, 'GET', '/signup-config', handlers.signup_config)

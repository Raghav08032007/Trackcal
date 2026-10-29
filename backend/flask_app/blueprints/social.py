"""Social feed endpoints under /api/v1/social (flag social_feed)."""
from flask import Blueprint

from flask_app import retry_deadlocks, route
from routers import social as handlers

bp = Blueprint('social', __name__, url_prefix='/api/v1/social')
retry_deadlocks(bp)
route(bp, 'GET', '/me', handlers.me)
route(bp, 'PUT', '/me', handlers.save_profile)
route(bp, 'GET', '/profiles/<handle>', handlers.profile)
route(bp, 'GET', '/profiles/<handle>/connections', handlers.connections)
route(bp, 'POST', '/follow/<handle>', handlers.follow)
route(bp, 'DELETE', '/follow/<handle>', handlers.unfollow)
route(bp, 'GET', '/requests', handlers.requests)
route(bp, 'POST', '/requests/<handle>', handlers.answer_request)
route(bp, 'POST', '/block/<handle>', handlers.block)
route(bp, 'DELETE', '/block/<handle>', handlers.unblock)
route(bp, 'GET', '/milestones', handlers.milestones)
route(bp, 'GET', '/feed', handlers.feed)
route(bp, 'POST', '/posts', handlers.create_post, status=201)
route(bp, 'DELETE', '/posts/<post_id>', handlers.delete_post)
route(bp, 'POST', '/posts/<post_id>/reactions', handlers.react)
route(bp, 'DELETE', '/posts/<post_id>/reactions', handlers.unreact)
route(bp, 'GET', '/posts/<post_id>/comments', handlers.comments)
route(bp, 'POST', '/posts/<post_id>/comments', handlers.add_comment, status=201)
route(bp, 'DELETE', '/comments/<comment_id>', handlers.delete_comment)
route(bp, 'POST', '/reports', handlers.report, status=201)
route(bp, 'GET', '/moderation', handlers.moderation_queue)
route(bp, 'POST', '/moderation', handlers.moderate)

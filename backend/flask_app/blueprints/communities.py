"""Community endpoints under /api/v1/communities (flags communities + social_feed)."""
from flask import Blueprint

from flask_app import retry_deadlocks, route
from routers import communities as handlers

bp = Blueprint('communities', __name__, url_prefix='/api/v1/communities')
retry_deadlocks(bp)
route(bp, 'GET', '', handlers.listing)
route(bp, 'GET', '/bans', handlers.my_bans)
route(bp, 'POST', '/appeals', handlers.decide_appeal)
route(bp, 'POST', '', handlers.create, status=201)
route(bp, 'GET', '/<slug>', handlers.detail)
route(bp, 'PUT', '/<slug>', handlers.edit)
route(bp, 'POST', '/<slug>/membership', handlers.join)
route(bp, 'DELETE', '/<slug>/membership', handlers.leave)
route(bp, 'GET', '/<slug>/members', handlers.members)
route(bp, 'POST', '/<slug>/members/<handle>', handlers.manage)
route(bp, 'GET', '/<slug>/posts', handlers.posts)
route(bp, 'POST', '/<slug>/posts', handlers.create_post, status=201)
route(bp, 'GET', '/<slug>/moderation', handlers.moderation)
route(bp, 'POST', '/<slug>/moderation', handlers.moderate)
route(bp, 'POST', '/<slug>/appeal', handlers.appeal, status=201)

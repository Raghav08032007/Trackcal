"""Phase I: the public edge's headers. GPS recording, the camera and voice need their permission for TrackCal's own pages; a
regression to geolocation=() would silently break Record a route in production while every local test still passed."""
import re
from pathlib import Path

CADDY = Path(__file__).resolve().parents[2] / 'infrastructure' / 'Caddyfile'


def test_the_edge_allows_camera_microphone_and_location_for_our_own_pages_only():
    policy = re.search(r'Permissions-Policy "([^"]+)"', CADDY.read_text(encoding='utf-8')).group(1)
    rules = dict(part.strip().split('=', 1) for part in policy.split(','))
    assert rules == {'camera': '(self)', 'microphone': '(self)', 'geolocation': '(self)'}


def test_the_edge_keeps_its_protective_headers():
    text = CADDY.read_text(encoding='utf-8')
    for header in ('Strict-Transport-Security', 'X-Content-Type-Options "nosniff"', 'X-Frame-Options "DENY"', 'Referrer-Policy'):
        assert header in text, header
    assert "default-src 'none'; frame-ancestors 'none'" in text          # API responses can't run, load or be framed

"""Closed-beta invite codes (flag `closed_beta`). Codes look like TC-7KQ3-M9XD; only their SHA-256 is stored."""
import hashlib
import secrets
from datetime import timedelta

import models
from flask_app.params import HTTPException
from services.abuse_limits import consume
from services.feature_flags import is_enabled
from timeutil import utcnow
from services.i18n import msg

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/O or 1/I, so codes read aloud correctly
REFUSED = msg('TrackCal is in a closed beta. Sign-up needs a valid invite code.')


def normalize(code):
    return ''.join(ch for ch in (code or '').upper() if ch.isalnum())


def digest(code):
    return hashlib.sha256(normalize(code).encode()).hexdigest()


def create(db, label, max_uses=1, days=30):
    raw = ''.join(secrets.choice(ALPHABET) for _ in range(8))
    code = f'TC-{raw[:4]}-{raw[4:]}'
    db.add(models.InviteCode(code_hash=digest(code), label=label[:80], max_uses=max(1, max_uses), expires_at=utcnow() + timedelta(days=days) if days else None))
    db.commit()
    return code


def redeem(db, code, client_address):
    """Use one seat of a valid code, in the sign-up transaction. Does nothing while the closed beta is off."""
    if not is_enabled(db, 'closed_beta'): return
    consume(db, 'invite-attempt', client_address, 20, 3600)  # slows guessing
    row = db.query(models.InviteCode).filter_by(code_hash=digest(code)).with_for_update().first() if normalize(code) else None
    if not row or row.revoked or row.uses >= row.max_uses or (row.expires_at and row.expires_at <= utcnow()):
        raise HTTPException(403, REFUSED)
    row.uses += 1

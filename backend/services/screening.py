"""The word screen: holds posts, comments, events and challenges that contain slurs, abuse or self-harm phrases for a
moderator before anyone sees them, and refuses such words in community names and profiles.

Nothing is deleted: a held item is hidden, gets an automatic report (reason 'hate' or 'self_harm') and waits in
/moderation, where a moderator restores or keeps it hidden. Self-harm words also show the person a kind message with a
helpline. The list is data (data/screening.json), so moderators can extend it without a code change.
"""
from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from services.i18n import msg, tr

LIST = Path(__file__).resolve().parents[1] / 'data' / 'screening.json'
NOTICE = {'self_harm': msg('It sounds like things are really hard right now. You matter, and you don’t have to face this alone. Please talk to someone you trust, or call a helpline: Tele-MANAS 14416 in India (free, any time), or your local emergency number. Your post is with our team, who will look after it.'),
          'abuse': msg('Your post is waiting for a moderator because it may contain hurtful words. Nothing has been deleted; it appears once it is reviewed.')}
REFUSED = msg('That contains words that aren’t allowed here. Please choose different wording.')


def _fold(text: str) -> str:
    return unicodedata.normalize('NFKC', text or '').casefold()


@lru_cache(maxsize=1)
def _patterns():
    data = json.loads(LIST.read_text(encoding='utf-8'))
    out = {}
    for kind in ('self_harm', 'abuse'):
        parts = []
        for term in data.get(kind, []):
            term = _fold(term).strip()
            if not term: continue
            body = r'\s+'.join(re.escape(word) for word in term.split())
            # Latin-script terms must be whole words ("fag" never matches "fagioli"); other scripts match as phrases.
            parts.append(rf'(?<!\w){body}(?!\w)' if term.isascii() else body)
        out[kind] = re.compile('|'.join(parts)) if parts else None
    return out


def screen(*texts: str) -> str | None:
    """'self_harm', 'abuse' or None for the given texts (self-harm wins: the person is shown a helpline)."""
    joined = _fold(' \n '.join(t for t in texts if t))
    for kind in ('self_harm', 'abuse'):
        pattern = _patterns()[kind]
        if pattern and pattern.search(joined): return kind
    return None


def hold(db, kind: str, target, author_id: str, found: str) -> dict:
    """Hide a just-created item and put it in the moderation queue. Returns the fields to add to the response."""
    import models
    from routers.social import set_hidden
    set_hidden(db, kind, target, True)
    db.add(models.ContentReport(reporter_id=author_id, target_type=kind, target_id=target.id, reason='self_harm' if found == 'self_harm' else 'hate',
                                note='Held automatically by the word screen.'))
    return {'held': found, 'notice': tr(NOTICE[found])}


def refuse_if_flagged(*texts: str):
    """For names and profiles, which can't be held: refuse words from the list with a polite message."""
    if screen(*texts):
        from flask_app.params import HTTPException
        raise HTTPException(422, REFUSED)

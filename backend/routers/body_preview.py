"""AI body preview at /api/v1/body-preview (flag `body_simulator`, off by default).

A person's own photo is sent to an external image model and comes back as an illustration of one fixed, moderate goal.
Adults only, from the account's age data; `unspecified` is refused. Consent is checked on every request. Goals are a
fixed list and never free text, so nobody can ask for an extreme body. Photos and results are never stored or logged:
the only record is a rate-limit counter, and the caller keeps the image in the browser."""
import os
import re
from typing import Literal

import httpx
from flask_app.params import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_active_user
from services import photo_prep
from services.abuse_limits import consume
from services.feature_flags import is_enabled

ADULT_GROUPS = ('18_19', '20_64', '65plus')
DAILY_PER_PERSON, DAILY_TOTAL = 3, 100
DEFAULT_MODEL = 'google/gemini-2.5-flash-image'
_RESULT = re.compile(r'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')
GOALS = {
    'leaner': 'slightly leaner, as after a few months of regular activity and balanced eating, staying a healthy weight',
    'stronger': 'slightly more muscular, as after a few months of regular strength training, with natural proportions',
    'toned': 'slightly more toned, as after a few months of regular mixed exercise, with natural proportions',
}
PROMPT = ('Edit this photo of an adult to show a realistic, modest fitness change: {goal}. Keep their face, identity, skin '
          'tone, age, hair, pose, clothing and background exactly the same. Do not remove, reduce or change clothing. Do not '
          'sexualize the image. Do not create an extreme, underweight or bodybuilder physique. If the person looks under 18, '
          'if there is more than one person, or if they are not clothed, do not create an image.')


class PreviewInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    image: str = Field(max_length=14_000_000)
    goal: Literal['leaner', 'stronger', 'toned']
    confirm_adult: bool
    confirm_own_photo: bool
    confirm_ai_transfer: bool


def require_adult(db, user):
    """The same age data the calorie tools use. Self-declared, so this is a safeguard and not proof of age."""
    prefs = db.get(models.PersonalizationProfile, user.id)
    group = (prefs.preferences or {}).get('age_group') if prefs else None
    if user.is_minor or group not in ADULT_GROUPS:
        raise HTTPException(403, 'Body preview is only for adults. Add your age group in your profile to continue.')


def status(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not is_enabled(db, 'body_simulator'): raise HTTPException(404, 'Body preview is not available yet.')
    require_adult(db, user)
    return {'goals': list(GOALS), 'daily_limit': DAILY_PER_PERSON}


def create(data: PreviewInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not is_enabled(db, 'body_simulator'): raise HTTPException(404, 'Body preview is not available yet.')
    require_adult(db, user)
    if not (data.confirm_adult and data.confirm_own_photo and data.confirm_ai_transfer):
        raise HTTPException(422, 'Please confirm all three statements first.')
    key = os.getenv('OPENROUTER_API_KEY')
    if not key: raise HTTPException(503, 'Body preview is not set up on this server.')
    try: image = photo_prep.prepare(data.image)
    except photo_prep.PhotoError as failure: raise HTTPException(400, str(failure))
    consume(db, 'body-preview', str(user.id), DAILY_PER_PERSON, 86400)
    consume(db, 'body-preview-total', 'all', DAILY_TOTAL, 86400)
    payload = {'model': os.getenv('BODY_PREVIEW_MODEL') or DEFAULT_MODEL, 'modalities': ['image', 'text'],
               'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': PROMPT.format(goal=GOALS[data.goal])}, {'type': 'image_url', 'image_url': {'url': image}}]}]}
    try:
        response = httpx.post('https://openrouter.ai/api/v1/chat/completions', json=payload, timeout=60,
                              headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'X-Title': 'TrackCal'})
    except httpx.HTTPError:
        raise HTTPException(502, 'The preview service is unavailable. Nothing was saved.')
    if response.status_code >= 400:  # provider bodies can echo request details, so they are never forwarded
        raise HTTPException(429 if response.status_code == 429 else 502, 'The preview service is busy. Nothing was saved. Please try again later.')
    try: url = response.json()['choices'][0]['message']['images'][0]['image_url']['url']
    except (ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(422, 'This photo couldn’t be used. Try a clear, clothed photo of one adult.')
    if not isinstance(url, str) or not _RESULT.match(url):
        raise HTTPException(422, 'This photo couldn’t be used. Try a clear, clothed photo of one adult.')
    return {'image': url, 'goal': data.goal, 'notice': 'AI illustration, not a prediction of your body.'}

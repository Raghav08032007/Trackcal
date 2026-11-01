"""USDA import details, and spoken meals: local speech first, the AI service only as a backup."""
import base64
import io
import wave

import pytest

from scripts import import_usda
from tests.test_web_gateway import browser, environment, internet, model_reply, post  # noqa: F401 (fixtures)


def test_usda_values_and_real_serving_sizes():
    food = {'foodNutrients': [{'nutrient': {'id': 1008}, 'amount': 89}, {'nutrient': {'id': 1003}, 'amount': 1.1}, {'nutrient': {'id': 1004}}],
            'foodPortions': [{'amount': 1, 'measureUnit': {'name': 'cup'}, 'modifier': 'mashed', 'gramWeight': 225, 'sequenceNumber': 2},
                             {'portionDescription': '1 medium', 'gramWeight': 118, 'sequenceNumber': 1},
                             {'portionDescription': 'Quantity not specified', 'gramWeight': 118, 'sequenceNumber': 3},
                             {'portionDescription': '1 bad', 'gramWeight': 0, 'sequenceNumber': 4}],
            'inputFoods': [{'ingredientDescription': 'Rice'}, {'ingredientDescription': 'Rice'}, {'ingredientDescription': 'Ghee'}]}
    assert import_usda.amounts(food) == {'energy_kcal': 89, 'protein': 1.1}  # a missing amount stays unknown, never 0
    assert import_usda.portions(food) == [('1 medium', 118.0), ('1 cup mashed', 225.0)]
    assert import_usda.ingredients(food) == ['Rice', 'Ghee']


def recording():
    out = io.BytesIO()
    with wave.open(out, 'wb') as clip:
        clip.setnchannels(1); clip.setsampwidth(2); clip.setframerate(16000); clip.writeframes(b'\x10\x00' * 1600)
    return base64.b64encode(out.getvalue()).decode()


def test_only_wav_recordings_are_accepted(internet):
    assert post(browser(), '/api/transcribe', {'audio': 'bm90IGF1ZGlv'}).status_code == 400
    assert post(browser(), '/api/transcribe', {}).status_code == 400


def test_speech_stays_on_the_server_when_local_transcription_works(internet, monkeypatch):
    calls, _ = internet
    monkeypatch.setattr('services.local_whisper.transcribe_pcm', lambda pcm: 'two rotis')
    response = post(browser(), '/api/transcribe', {'audio': recording()})
    assert response.status_code == 200 and response.get_json()['text'] == 'two rotis' and calls == []


def test_the_ai_service_is_only_a_backup_and_silence_is_not_text(internet, monkeypatch):
    from flask_app.params import HTTPException
    calls, replies = internet

    def missing(pcm): raise HTTPException(503, 'Whisper model is missing.')
    monkeypatch.setattr('services.local_whisper.transcribe_pcm', missing)
    replies.append(model_reply('one dosa'))
    assert post(browser(), '/api/transcribe', {'audio': recording()}).get_json()['text'] == 'one dosa' and len(calls) == 1
    replies.append(model_reply('NO_SPEECH'))
    assert post(browser(), '/api/transcribe', {'audio': recording()}).status_code == 422

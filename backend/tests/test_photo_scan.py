"""Phase 2 (photo scan): the photo is shrunk and stripped of metadata before it reaches the AI provider, paid AI
calls are capped per account, per guest address and in total, and estimates carry a portion range."""
import base64
import io
import json

from PIL import Image

from services import photo_prep
from services.meal_analysis import normalize_meal
from tests.test_web_gateway import ITEM, browser, environment, internet, model_reply, post, signed_up  # noqa: F401 (fixtures)


def phone_photo(width=2000, height=1000):
    """A JPEG like a phone's: rotated by EXIF orientation, with a device name and GPS position."""
    exif = Image.Exif(); exif[0x0112] = 6; exif[0x010F] = 'QAPhoneMaker'
    gps = exif.get_ifd(0x8825); gps[1] = 'N'; gps[2] = (12.0, 58.0, 30.0); gps[3] = 'E'; gps[4] = (77.0, 35.0, 10.0)
    out = io.BytesIO(); Image.new('RGB', (width, height), (200, 120, 40)).save(out, 'JPEG', exif=exif.tobytes())
    return 'data:image/jpeg;base64,' + base64.b64encode(out.getvalue()).decode()


def decode(data_url):
    raw = base64.b64decode(data_url.split(',', 1)[1]); return raw, Image.open(io.BytesIO(raw))


def test_prepared_photo_is_resized_upright_and_has_no_metadata():
    raw, image = decode(photo_prep.prepare(phone_photo()))
    assert image.format == 'JPEG' and image.size == (512, 1024)  # orientation 6 applied, longest side 1024
    assert len(image.getexif()) == 0 and b'QAPhoneMaker' not in raw and b'Exif' not in raw


def test_small_photos_are_not_enlarged():
    _, image = decode(photo_prep.prepare(phone_photo(300, 200)))
    assert max(image.size) == 300


def test_huge_pixel_counts_are_refused_before_decoding():
    out = io.BytesIO(); Image.new('1', (9000, 5000)).save(out, 'PNG')
    try:
        photo_prep.prepare('data:image/png;base64,' + base64.b64encode(out.getvalue()).decode()); assert False
    except photo_prep.PhotoError as failure:
        assert 'too many pixels' in str(failure)


def test_the_provider_receives_the_prepared_photo_not_the_original(internet):
    calls, replies = internet; replies.append(model_reply(json.dumps({'components': [ITEM]})))
    assert post(browser(), '/api/analyze', {'image': phone_photo()}).status_code == 200
    sent = calls[0]['json']['messages'][1]['content'][1]['image_url']['url']
    raw, image = decode(sent)
    assert sent.startswith('data:image/jpeg;base64,') and max(image.size) == 1024 and b'QAPhoneMaker' not in raw


def test_guests_have_a_daily_cap_and_the_provider_is_not_called_past_it(internet, monkeypatch):
    monkeypatch.setenv('GUEST_DAILY_AI_LIMIT', '2')
    calls, replies = internet; replies += [model_reply(json.dumps({'components': [ITEM]})) for _ in range(3)]
    statuses = [post(browser(), '/api/analyze', {'text': 'Egg'}).status_code for _ in range(3)]
    assert statuses == [200, 200, 429] and len(calls) == 2


def test_signed_in_people_use_their_own_daily_allowance(internet, monkeypatch):
    monkeypatch.setenv('DAILY_AI_LIMIT', '1'); monkeypatch.setenv('GUEST_DAILY_AI_LIMIT', '0')
    _, replies = internet; replies += [model_reply(json.dumps({'components': [ITEM]})) for _ in range(2)]
    person = browser(); signed_up(person)
    assert post(person, '/api/analyze', {'text': 'Egg'}).status_code == 200
    refused = post(person, '/api/analyze', {'text': 'Egg'})
    assert refused.status_code == 429 and 'Log this meal manually' in refused.get_json()['error']


def test_a_service_wide_daily_cap_bounds_cost(internet, monkeypatch):
    monkeypatch.setenv('GLOBAL_DAILY_AI_LIMIT', '1')
    calls, replies = internet; replies += [model_reply(json.dumps({'components': [ITEM]})) for _ in range(2)]
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 200
    person = browser(); signed_up(person)
    assert post(person, '/api/analyze', {'text': 'Egg'}).status_code == 429 and len(calls) == 1


def test_portion_range_uses_the_models_range_when_it_is_valid():
    meal = normalize_meal({'components': [{**ITEM, 'quantity_g_low': 40, 'quantity_g_high': 70}]}, 'm')
    item = meal['components'][0]
    assert item['portion_range_g'] == [40, 70] and item['range_basis'] == 'model'
    assert item['calorie_range'] == [62.4, 109.2] and meal['calorie_range'] == [62.4, 109.2]


def test_portion_range_widens_as_confidence_falls_when_the_model_gives_none_or_nonsense():
    sure = normalize_meal({'components': [{**ITEM, 'confidence': 1}]}, 'm')['components'][0]
    unsure = normalize_meal({'components': [{**ITEM, 'confidence': 0, 'quantity_g_low': 90, 'quantity_g_high': 20}]}, 'm')['components'][0]
    assert sure['portion_range_g'] == [42.5, 57.5] and sure['range_basis'] == 'confidence'
    assert unsure['portion_range_g'] == [25, 75] and unsure['range_basis'] == 'confidence'

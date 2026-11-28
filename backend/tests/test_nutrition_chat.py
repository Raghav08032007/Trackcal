"""AI nutrition chat (services/nutrition_chat.py): safety routes, hard reply rules, catalog grounding, data sent to the AI."""
import json

import pytest

from services import nutrition_chat as chat


def ai(*replies):
    """A fake AI that answers with each reply in turn, recording what it was sent."""
    sent = []

    def call(messages):
        sent.append(messages)
        reply = replies[min(len(sent) - 1, len(replies) - 1)]
        return reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False)
    call.sent = sent
    return call


@pytest.mark.parametrize('text,kind', [
    ('I want to kill myself', 'crisis'), ('मैं आत्महत्या के बारे में सोच रहा हूं', 'crisis'),
    ('how do I make myself throw up after eating', 'eating'), ("I haven't eaten in days to lose weight", 'eating'),
    ('I have chest pain after my run', 'urgent'), ('I fainted during the workout', 'urgent'), ('सीने में दर्द हो रहा है', 'urgent'),
    ('my sugar is 45 and I feel shaky', 'urgent'), ('no puedo respirar bien', 'urgent'),
    ('what should I eat for dinner', None), ('is 45 g of protein enough', None), ('my sugar was 110 after lunch, is that ok', None),
])
def test_route(text, kind):
    assert chat.route(text) == kind


def test_fixed_reply_never_calls_ai_and_is_translated():
    call = ai({'reply': 'x', 'foods': []})
    out = chat.answer('मैं मरना चाहता हूं', lang='hi', call=call)
    assert out['safety'] == 'crisis' and '14416' in out['reply'] and not call.sent


@pytest.mark.parametrize('food,diet,bad', [
    ('Chicken curry', 'vegetarian', True), ('Egg bhurji', 'vegetarian', True), ('Egg bhurji', 'eggetarian', False),
    ('Paneer tikka', 'vegetarian', False), ('Paneer tikka', 'vegan', True), ('Soy milk', 'vegan', False), ('Peanut butter toast', 'vegan', False),
    ('Aloo paratha', 'jain', True), ('Moong dal chilla', 'jain', False), ('Fish curry', 'pescatarian', False), ('Mutton biryani', 'pescatarian', True),
    ('Eggless cake', 'vegetarian', False), ('Eggplant curry', 'vegetarian', False), ('Chicken curry', 'balanced', False),
])
def test_diet_breaks(food, diet, bad):
    assert bool(chat.diet_breaks(food, diet, [])) is bad


def test_allergy_food_is_caught():
    assert chat.diet_breaks('Peanut chikki', 'balanced', ['peanut'])
    assert not chat.diet_breaks('Roasted chana', 'balanced', ['peanut'])


@pytest.mark.parametrize('reply,kind', [
    ('Try eating 800 kcal a day for quick results.', 'calories'), ('Skip dinner tonight to stay under target.', 'skip'),
    ('Go for a run to burn it off.', 'skip'), ('Take 500 mg of metformin with lunch.', 'medicine'), ('You can stop your insulin on rest days.', 'medicine'),
])
def test_unsafe_replies_are_caught(reply, kind):
    assert kind in [k for k, _ in chat.problems(reply, [], {}, 'en', False)]


@pytest.mark.parametrize('reply', [
    "Don't skip breakfast: a bowl of poha keeps you going.", 'A gentle 500 kcal a day deficit is a safe pace.',
    'A cup of milk has about 300 mg of calcium.', 'Never starve yourself; regular meals work better.',
    'Ask your doctor before you change your medicine. Meanwhile, keep meals regular.', 'Your target is 1800 kcal a day and you have 650 left.',
])
def test_safe_advice_is_not_caught(reply):
    assert chat.problems(reply, [], {}, 'en', False) == []


def test_vegetarian_reply_with_chicken_is_caught_but_without_chicken_is_fine():
    prefs = {'diet': 'vegetarian'}
    assert chat.problems('Have grilled chicken with rice.', [], prefs, 'en', False)[0][0] == 'diet_text'
    assert chat.problems('Make the wrap with paneer instead of chicken.', [], prefs, 'en', False) == []
    assert chat.problems('रात को चिकन करी खाइए।', [], prefs, 'hi', False)[0][0] == 'diet_text'
    assert chat.problems('चिकन के बजाय पनीर भुर्जी लीजिए।', [], prefs, 'hi', False) == []


def test_minor_reply_may_not_mention_calories():
    assert chat.problems('You have 500 kcal left today.', [], {}, 'en', True)[0][0] == 'minor'
    assert chat.problems('A banana and a glass of milk make a good snack after football.', [], {}, 'en', True) == []


@pytest.mark.parametrize('text,lang,ok', [
    ('आज आपने 1200 kcal खाया है। रात में दाल और रोटी लें।', 'hi', True), ('You ate 1200 kcal today.', 'hi', False),
    ('Hoy comiste 1200 kcal. Para la cena, toma lentejas con arroz.', 'es', True), ('Today you ate well, keep it up with the dal.', 'es', False),
    ('Heute hast du 1200 kcal gegessen. Zum Abendessen passt Linsensuppe mit Brot.', 'de', True),
    ('آج آپ نے 1200 کیلوری کھائی۔ رات کو دال اور روٹی لیں۔', 'ur', True), ('ఈ రోజు మీరు బాగా తిన్నారు.', 'te', True),
])
def test_language_check(text, lang, ok):
    assert chat.in_language(text, lang) is ok


def test_broken_rule_is_retried_then_good_answer_used():
    call = ai({'reply': 'Have chicken tikka for dinner.', 'foods': [{'name': 'Chicken tikka', 'grams': 150}]},
              {'reply': 'Have paneer tikka for dinner.', 'foods': [{'name': 'Paneer tikka', 'grams': 150, 'per_100g': {'calories': 250, 'protein_g': 15, 'carbs_g': 6, 'fat_g': 18}}]})
    out = chat.answer('What should I eat for dinner?', prefs={'diet': 'vegetarian'}, call=call)
    assert out['safety'] is None and out['retried'] and out['foods'][0]['name'] == 'Paneer tikka'
    assert 'broke these rules' in call.sent[1][-1]['content']


def test_two_broken_answers_give_the_safe_fallback():
    call = ai({'reply': 'Eat 700 kcal a day for a month.', 'foods': []})
    out = chat.answer('How do I lose 10 kg fast?', call=call)
    assert out['safety'] == 'fallback' and out['foods'] == [] and len(call.sent) == 2


def test_diet_breaking_food_is_dropped_but_reply_kept():
    good = {'name': 'Dal khichdi', 'grams': 250, 'per_100g': {'calories': 120, 'protein_g': 5, 'carbs_g': 20, 'fat_g': 2}}
    call = ai({'reply': 'Dal khichdi is a light dinner.', 'foods': [good, {'name': 'Egg curry', 'grams': 200, 'per_100g': {'calories': 150}}]})
    out = chat.answer('light dinner idea', prefs={'diet': 'vegetarian'}, call=call)
    assert [f['name'] for f in out['foods']] == ['Dal khichdi']


def test_foods_use_catalog_values_when_close_and_flag_estimates():
    catalog = {'Dal khichdi': {'calories': 110, 'protein_g': 4.5, 'carbs_g': 19, 'fat_g': 2.2, 'source': 'IFCT 2017'}}
    foods = [{'name': 'Dal khichdi', 'grams': 250, 'per_100g': {'calories': 125, 'protein_g': 5, 'carbs_g': 20, 'fat_g': 2}},
             {'name': 'Boiled rice', 'grams': 150, 'per_100g': {'calories': 130, 'protein_g': 2.7, 'carbs_g': 28, 'fat_g': .3}},
             {'name': 'Mystery bar', 'grams': 5000, 'per_100g': {'calories': 400}}]
    out = chat.ground(foods, catalog.get)
    assert out[0]['source'] == 'IFCT 2017' and not out[0]['estimated'] and out[0]['totals']['calories'] == 275
    assert out[1]['estimated'] and out[1]['source'] == 'AI estimate' and out[1]['totals']['calories'] == 195
    assert len(out) == 2  # 5 kg is not a portion


def test_catalog_wrong_state_is_not_used():
    raw_rice = {'calories': 356, 'protein_g': 7, 'carbs_g': 78, 'fat_g': .5, 'source': 'IFCT'}
    out = chat.ground([{'name': 'Rice', 'grams': 150, 'per_100g': {'calories': 130}}], lambda name: raw_rice)
    assert out[0]['estimated'] and out[0]['per_100g']['calories'] == 130


def test_data_sent_to_ai_hides_calories_for_minors_and_takes_diet_from_account():
    client = {'today_meals': [{'name': 'Poha', 'calories': 300, 'protein': 6}], 'calories_left': 1200, 'targets': {'calories': 1800},
              'pantry': [{'name': 'Paneer', 'grams': 200, 'expires': '2026-12-01'}], 'diet': 'non_veg'}
    adult = chat.data_block(client, {'diet': 'vegetarian', 'allergies': ['peanut'], 'budget': 150, 'currency': 'INR'}, False)
    assert adult['diet'] == 'vegetarian' and adult['calories_left_today'] == 1200 and adult['food_budget_per_day']['amount'] == 150
    assert adult['pantry'][0]['name'] == 'Paneer' and adult['today_meals'][0]['calories'] == 300
    minor = chat.data_block(client, {}, True)
    assert 'calories_left_today' not in minor and 'daily_targets' not in minor and 'calories' not in minor['today_meals'][0]


def test_prompt_carries_language_minor_and_medicine_rules():
    call = ai({'reply': 'Bonne idée : des lentilles avec du riz pour le dîner.', 'foods': []})
    chat.answer('I take metformin, what should I eat?', lang='fr', minor=True, call=call)
    system = call.sent[0][0]['content']
    assert 'French' in system and 'under 18' in system and 'mentions a medicine' in system


def test_plain_text_reply_still_works():
    out = chat.answer('hi', call=ai('Hello! Log your breakfast and I will plan the day.'))
    assert out['reply'].startswith('Hello') and out['foods'] == []


def test_an_empty_ai_answer_is_a_provider_failure_not_a_fallback():
    with pytest.raises(RuntimeError):
        chat.answer('What should I eat?', call=ai(''))


def test_a_number_the_person_gave_can_be_quoted_back_in_a_refusal():
    reply = 'Eating only 700 kcal a day is not safe. Aim for at least 1200 kcal a day.'
    assert chat.problems(reply, [], {}, 'en', False, 'I want to eat 700 kcal a day') == []
    assert chat.problems('Try 800 kcal a day instead.', [], {}, 'en', False, 'I want to eat 700 kcal a day')[0][0] == 'calories'


def test_an_unsafe_diet_answer_falls_back_to_a_safe_pace_not_medicine():
    out = chat.answer('How do I lose 10 kg in 2 weeks?', call=ai({'reply': 'Skip dinner every day for two weeks.', 'foods': []}))
    assert out['safety'] == 'fallback' and '1 kg a week' in out['reply']

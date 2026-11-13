"""everyday food names: Hindi and other Indian names, Indian-English and British words, and joined-up spellings, each mapped to the
English name the catalog uses (search_synonyms). Searching "gobhi" then searches "cauliflower", "capsicum" searches "bell pepper".

Only terms not already in the table are added. Downgrade removes exactly these.

Revision ID: 0025
Revises: 0024
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0025'
down_revision: Union[str, None] = '0024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NAMES = {
    # Vegetables
    'gobhi': 'cauliflower', 'gobi': 'cauliflower', 'phool gobhi': 'cauliflower', 'phool gobi': 'cauliflower', 'patta gobhi': 'cabbage', 'band gobhi': 'cabbage',
    'bandh gobhi': 'cabbage', 'matar': 'green peas', 'mattar': 'green peas', 'lahsun': 'garlic', 'lehsun': 'garlic', 'lasun': 'garlic', 'adrak': 'ginger root',
    'tamatar': 'tomatoes', 'gajar': 'carrots', 'mooli': 'radishes', 'muli': 'radishes', 'kheera': 'cucumber', 'khira': 'cucumber', 'lauki': 'bottle gourd',
    'ghiya': 'bottle gourd', 'dudhi': 'bottle gourd', 'karela': 'bitter gourd', 'tori': 'ridge gourd', 'turai': 'ridge gourd', 'kaddu': 'pumpkin',
    'shimla mirch': 'bell pepper', 'hari mirch': 'green chili', 'dhaniya': 'coriander leaves', 'kothmir': 'coriander leaves', 'pudina': 'mint leaves',
    'kadi patta': 'curry leaves', 'curry patta': 'curry leaves', 'arbi': 'colocasia', 'suran': 'yam', 'jimikand': 'yam', 'shakarkandi': 'sweet potato',
    'chukandar': 'beetroot', 'sarson saag': 'mustard greens', 'saag': 'mustard greens', 'kathal': 'jackfruit', 'makka': 'corn', 'makai': 'corn',
    'bhutta': 'corn', 'parwal': 'pointed gourd', 'tinda': 'round gourd',
    # Fruits
    'seb': 'apple', 'santra': 'orange', 'narangi': 'orange', 'mausambi': 'sweet lime', 'mosambi': 'sweet lime', 'aam': 'mango', 'angoor': 'grapes',
    'anaar': 'pomegranate', 'anar': 'pomegranate', 'papita': 'papaya', 'amrood': 'guava', 'amrud': 'guava', 'nashpati': 'pear', 'aadu': 'peach',
    'chikoo': 'sapota', 'chiku': 'sapota', 'tarbooj': 'watermelon', 'tarbuj': 'watermelon', 'kharbooja': 'muskmelon', 'kharbuja': 'muskmelon',
    'nimbu': 'lemon', 'nimboo': 'lemon', 'khajoor': 'dates', 'khajur': 'dates', 'anjeer': 'figs', 'anjir': 'figs', 'kishmish': 'raisins',
    'aloo bukhara': 'plums', 'jamun': 'java-plum',
    # Grains and flours
    'maida': 'refined wheat flour', 'sooji': 'semolina', 'suji': 'semolina', 'rava': 'semolina', 'rawa': 'semolina', 'jau': 'barley',
    'makki atta': 'corn flour', 'daliya': 'broken wheat', 'dalia': 'broken wheat', 'sabudana': 'tapioca pearl', 'sago': 'tapioca pearl', 'murmura': 'puffed rice', 'oatmeal': 'oats',
    'cornflakes': 'corn flakes',
    # Pulses
    'kabuli chana': 'chickpeas', 'chole': 'chickpeas', 'lobia': 'cowpea', 'chawli': 'cowpea', 'kulthi': 'horse gram', 'moth': 'moth bean',
    'matki': 'moth bean', 'soyabean': 'soybeans', 'soya': 'soybeans',
    # Dairy
    'doodh': 'milk', 'makhan': 'butter', 'makkhan': 'butter', 'malai': 'cream', 'chaach': 'buttermilk', 'chhach': 'buttermilk', 'mattha': 'buttermilk',
    'khoya': 'khoa',
    # Nuts and seeds
    'badam': 'almonds', 'kaju': 'cashew', 'akhrot': 'walnuts', 'pista': 'pistachio', 'moongfali': 'peanuts', 'moongphali': 'peanuts', 'mungfali': 'peanuts',
    'til': 'sesame seeds', 'alsi': 'flaxseed', 'makhana': 'lotus seeds',
    # Spices
    'haldi': 'turmeric', 'jeera': 'cumin', 'dalchini': 'cinnamon', 'elaichi': 'cardamom', 'laung': 'cloves', 'kali mirch': 'black pepper',
    'rai': 'mustard seeds', 'hing': 'asafoetida', 'ajwain': 'carom seeds', 'saunf': 'fennel seeds',
    # Sweeteners
    'cheeni': 'sugar', 'chini': 'sugar', 'shakkar': 'sugar', 'gur': 'jaggery', 'gud': 'jaggery', 'shahad': 'honey', 'shehad': 'honey',
    # Meat and fish
    'machli': 'fish', 'machhli': 'fish', 'jhinga': 'shrimp', 'murgi': 'chicken', 'murga': 'chicken', 'mutton': 'goat meat',
    # Indian-English, British and joined-up spellings
    'capsicum': 'bell pepper', 'groundnut': 'peanuts', 'groundnuts': 'peanuts', 'prawn': 'shrimp', 'prawns': 'shrimp', 'aubergine': 'eggplant',
    'courgette': 'zucchini', 'beetroot': 'beets', 'maize': 'corn', 'ladyfinger': 'okra', 'spring onion': 'green onions', 'icecream': 'ice cream',
    'peanutbutter': 'peanut butter',
}


def upgrade() -> None:
    bind = op.get_bind()
    for term, canonical in NAMES.items():
        if not bind.execute(sa.text('SELECT 1 FROM search_synonyms WHERE term = :t'), {'t': term}).first():
            bind.execute(sa.text('INSERT INTO search_synonyms (term, canonical) VALUES (:t, :c)'), {'t': term, 'c': canonical})


def downgrade() -> None:
    bind = op.get_bind()
    for term, canonical in NAMES.items():
        bind.execute(sa.text('DELETE FROM search_synonyms WHERE term = :t AND canonical = :c'), {'t': term, 'c': canonical})

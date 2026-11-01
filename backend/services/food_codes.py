"""What the codes and marks on a food pack mean: barcode prefixes, certifications and additive numbers.

A barcode prefix names the GS1 office that issued the code, not where the food was made. Certifications come from
Open Food Facts community data or from a photo of the pack, so they are shown as listed, not verified with the issuer.
These tables cover the common marks; anything else is shown with its own name and no invented meaning.
"""
import re

GS1_PREFIXES = [(0, 19, 'United States or Canada'), (30, 39, 'United States'), (60, 139, 'United States or Canada'), (300, 379, 'France or Monaco'), (380, 380, 'Bulgaria'),
                (383, 383, 'Slovenia'), (385, 385, 'Croatia'), (387, 387, 'Bosnia and Herzegovina'), (389, 389, 'Montenegro'), (400, 440, 'Germany'), (450, 459, 'Japan'),
                (460, 469, 'Russia'), (470, 470, 'Kyrgyzstan'), (471, 471, 'Taiwan'), (474, 474, 'Estonia'), (475, 475, 'Latvia'), (476, 476, 'Azerbaijan'), (477, 477, 'Lithuania'),
                (478, 478, 'Uzbekistan'), (479, 479, 'Sri Lanka'), (480, 480, 'Philippines'), (481, 481, 'Belarus'), (482, 482, 'Ukraine'), (484, 484, 'Moldova'), (485, 485, 'Armenia'),
                (486, 486, 'Georgia'), (487, 487, 'Kazakhstan'), (488, 488, 'Tajikistan'), (489, 489, 'Hong Kong'), (490, 499, 'Japan'), (500, 509, 'United Kingdom'), (520, 521, 'Greece'),
                (528, 528, 'Lebanon'), (529, 529, 'Cyprus'), (530, 530, 'Albania'), (531, 531, 'North Macedonia'), (535, 535, 'Malta'), (539, 539, 'Ireland'), (540, 549, 'Belgium or Luxembourg'),
                (560, 560, 'Portugal'), (569, 569, 'Iceland'), (570, 579, 'Denmark'), (590, 590, 'Poland'), (594, 594, 'Romania'), (599, 599, 'Hungary'), (600, 601, 'South Africa'),
                (603, 603, 'Ghana'), (604, 604, 'Senegal'), (608, 608, 'Bahrain'), (609, 609, 'Mauritius'), (611, 611, 'Morocco'), (613, 613, 'Algeria'), (615, 615, 'Nigeria'), (616, 616, 'Kenya'),
                (618, 618, "Côte d'Ivoire"), (619, 619, 'Tunisia'), (620, 620, 'Tanzania'), (621, 621, 'Syria'), (622, 622, 'Egypt'), (623, 623, 'Brunei'), (624, 624, 'Libya'), (625, 625, 'Jordan'),
                (626, 626, 'Iran'), (627, 627, 'Kuwait'), (628, 628, 'Saudi Arabia'), (629, 629, 'United Arab Emirates'), (640, 649, 'Finland'), (690, 699, 'China'), (700, 709, 'Norway'),
                (729, 729, 'Israel'), (730, 739, 'Sweden'), (740, 740, 'Guatemala'), (741, 741, 'El Salvador'), (742, 742, 'Honduras'), (743, 743, 'Nicaragua'), (744, 744, 'Costa Rica'),
                (745, 745, 'Panama'), (746, 746, 'Dominican Republic'), (750, 750, 'Mexico'), (754, 755, 'Canada'), (759, 759, 'Venezuela'), (760, 769, 'Switzerland'), (770, 771, 'Colombia'),
                (773, 773, 'Uruguay'), (775, 775, 'Peru'), (777, 777, 'Bolivia'), (778, 779, 'Argentina'), (780, 780, 'Chile'), (784, 784, 'Paraguay'), (786, 786, 'Ecuador'), (789, 790, 'Brazil'),
                (800, 839, 'Italy'), (840, 849, 'Spain'), (850, 850, 'Cuba'), (858, 858, 'Slovakia'), (859, 859, 'Czechia'), (860, 860, 'Serbia'), (865, 865, 'Mongolia'), (868, 869, 'Türkiye'),
                (870, 879, 'Netherlands'), (880, 880, 'South Korea'), (883, 883, 'Myanmar'), (884, 884, 'Cambodia'), (885, 885, 'Thailand'), (888, 888, 'Singapore'), (890, 890, 'India'),
                (893, 893, 'Vietnam'), (896, 896, 'Pakistan'), (899, 899, 'Indonesia'), (900, 919, 'Austria'), (930, 939, 'Australia'), (940, 949, 'New Zealand'), (955, 955, 'Malaysia'), (958, 958, 'Macau')]

# search word -> (name, where it applies, what it means)
CERTIFICATIONS = [
    ('fssai', 'FSSAI', 'India', 'Food business licence from the Food Safety and Standards Authority of India.'),
    ('jaivik', 'Jaivik Bharat', 'India', 'Organic mark from FSSAI.'),
    ('india organic', 'India Organic', 'India', 'Organic under the national programme for organic production.'),
    ('agmark', 'AGMARK', 'India', 'Government quality grade for farm products.'),
    ('fpo', 'FPO mark', 'India', 'Standard for processed fruit products.'),
    ('bis', 'BIS standard', 'India', 'Bureau of Indian Standards certification.'),
    ('green dot', 'Vegetarian mark', 'India', 'Green dot: vegetarian food.'),
    ('red dot', 'Non-vegetarian mark', 'India', 'Brown or red dot: contains non-vegetarian ingredients.'),
    ('usda organic', 'USDA Organic', 'United States', 'Meets the US national organic standard.'),
    ('fda', 'FDA registered facility', 'United States', 'The facility is registered with the FDA. This is not an approval of the product.'),
    ('eu organic', 'EU organic leaf', 'European Union', 'Meets the EU organic rules.'),
    ('ab agriculture biologique', 'AB Agriculture Biologique', 'France', 'French organic mark.'),
    ('bio siegel', 'Bio-Siegel', 'Germany', 'German organic mark.'),
    ('soil association', 'Soil Association', 'United Kingdom', 'UK organic certification.'),
    ('red tractor', 'Red Tractor', 'United Kingdom', 'UK farm and food assurance.'),
    ('jas', 'Organic JAS', 'Japan', 'Japanese organic standard.'),
    ('canada organic', 'Canada Organic', 'Canada', 'Meets the Canadian organic standard.'),
    ('australian certified organic', 'Australian Certified Organic', 'Australia', 'Australian organic certification.'),
    ('china organic', 'China Organic', 'China', 'Chinese national organic product mark.'),
    ('organic', 'Organic', 'Listed on the product', 'Listed as organic. Which standard applies depends on the country.'),
    ('halal', 'Halal', 'Worldwide', 'Certified as permitted under Islamic dietary law.'),
    ('kosher', 'Kosher', 'Worldwide', 'Certified as meeting Jewish dietary law.'),
    ('fair trade', 'Fairtrade', 'Worldwide', 'Producers are paid under fair trade terms.'),
    ('fairtrade', 'Fairtrade', 'Worldwide', 'Producers are paid under fair trade terms.'),
    ('rainforest alliance', 'Rainforest Alliance', 'Worldwide', 'Farming standard for nature and workers.'),
    ('msc', 'MSC', 'Worldwide', 'Marine Stewardship Council certified sustainable seafood.'),
    ('asc', 'ASC', 'Worldwide', 'Aquaculture Stewardship Council certified farmed seafood.'),
    ('non gmo', 'Non-GMO', 'Worldwide', 'Stated as made without genetically modified ingredients.'),
    ('vegan', 'Vegan', 'Worldwide', 'Stated as containing no animal products.'),
    ('vegetarian', 'Vegetarian', 'Worldwide', 'Stated as containing no meat or fish.'),
    ('gluten free', 'Gluten free', 'Worldwide', 'Stated as gluten free. Check the label if you have coeliac disease.'),
    ('no gluten', 'Gluten free', 'Worldwide', 'Stated as gluten free. Check the label if you have coeliac disease.'),
    ('triman', 'Triman', 'France', 'A recycling sorting mark. It does not describe the food.'),
    ('fssc 22000', 'FSSC 22000', 'Worldwide', 'Food safety management certification for the factory.'),
    ('iso 22000', 'ISO 22000', 'Worldwide', 'Food safety management standard for the factory.'),
    ('haccp', 'HACCP', 'Worldwide', 'Food safety hazard control system.'),
    ('brc', 'BRCGS', 'Worldwide', 'Global food safety standard for manufacturers.'),
    ('green dot recycling', 'Der Grüne Punkt', 'Europe', 'The maker contributes to packaging recycling. It does not describe the food.'),
]

ADDITIVES = {'e100': 'Curcumin (colour)', 'e101': 'Riboflavin (colour)', 'e102': 'Tartrazine (colour)', 'e110': 'Sunset yellow (colour)', 'e120': 'Carmine (colour, from insects)', 'e122': 'Azorubine (colour)',
             'e124': 'Ponceau 4R (colour)', 'e129': 'Allura red (colour)', 'e133': 'Brilliant blue (colour)', 'e140': 'Chlorophyll (colour)', 'e150a': 'Plain caramel (colour)', 'e150c': 'Ammonia caramel (colour)',
             'e150d': 'Sulphite ammonia caramel (colour)', 'e160a': 'Carotenes (colour)', 'e160b': 'Annatto (colour)', 'e162': 'Beetroot red (colour)', 'e163': 'Anthocyanins (colour)', 'e170': 'Calcium carbonate',
             'e171': 'Titanium dioxide (colour)', 'e200': 'Sorbic acid (preservative)', 'e202': 'Potassium sorbate (preservative)', 'e210': 'Benzoic acid (preservative)', 'e211': 'Sodium benzoate (preservative)',
             'e220': 'Sulphur dioxide (preservative)', 'e223': 'Sodium metabisulphite (preservative)', 'e250': 'Sodium nitrite (preservative)', 'e252': 'Potassium nitrate (preservative)', 'e260': 'Acetic acid',
             'e270': 'Lactic acid', 'e282': 'Calcium propionate (preservative)', 'e296': 'Malic acid', 'e300': 'Vitamin C (antioxidant)', 'e306': 'Vitamin E (antioxidant)', 'e319': 'TBHQ (antioxidant)',
             'e320': 'BHA (antioxidant)', 'e321': 'BHT (antioxidant)', 'e322': 'Lecithin (emulsifier)', 'e330': 'Citric acid', 'e331': 'Sodium citrate', 'e338': 'Phosphoric acid', 'e339': 'Sodium phosphate',
             'e407': 'Carrageenan (thickener)', 'e412': 'Guar gum (thickener)', 'e415': 'Xanthan gum (thickener)', 'e420': 'Sorbitol (sweetener)', 'e422': 'Glycerol', 'e440': 'Pectin (gelling agent)',
             'e450': 'Diphosphates', 'e466': 'Cellulose gum (thickener)', 'e471': 'Mono- and diglycerides (emulsifier, may be animal or plant)', 'e472e': 'DATEM (emulsifier)', 'e476': 'PGPR (emulsifier)',
             'e551': 'Silicon dioxide (anti-caking)', 'e500': 'Baking soda (raising agent)', 'e503': 'Ammonium carbonate (raising agent)', 'e621': 'Monosodium glutamate, MSG (flavour enhancer)', 'e627': 'Disodium guanylate (flavour enhancer)',
             'e631': 'Disodium inosinate (flavour enhancer)', 'e635': 'Disodium ribonucleotides (flavour enhancer)', 'e900': 'Dimethylpolysiloxane (anti-foaming)', 'e950': 'Acesulfame K (sweetener)',
             'e951': 'Aspartame (sweetener, contains phenylalanine)', 'e952': 'Cyclamate (sweetener)', 'e954': 'Saccharin (sweetener)', 'e955': 'Sucralose (sweetener)', 'e960': 'Stevia (sweetener)', 'e967': 'Xylitol (sweetener)'}


def registered_in(code):
    """The GS1 office for a code, or None. EAN-8 and restricted ranges tell us nothing, so they stay unknown."""
    digits = str(code or '')
    if len(digits) == 12: digits = '0' + digits
    if len(digits) != 13: return None
    prefix = int(digits[:3])
    return next((name for low, high, name in GS1_PREFIXES if low <= prefix <= high), None)


def describe_mark(text):
    """A certification or label from any wording. Unknown marks keep their own name and claim no meaning."""
    words = re.sub(r'^[a-z]{2}:', '', str(text or '').strip()).replace('-', ' ').replace('_', ' ').strip()
    plain = words.lower()
    if not plain: return None
    for needle, name, region, meaning in CERTIFICATIONS:
        if re.search(rf'\b{re.escape(needle)}\b', plain): return {'name': name, 'region': region, 'meaning': meaning}
    return {'name': words[:80].capitalize(), 'region': None, 'meaning': None}


def additive(tag):
    code = re.sub(r'^[a-z]{2}:', '', str(tag or '')).lower()
    base = re.match(r'e\d+[a-z]?', code)
    if not base: return None
    number = base.group()
    if number not in ADDITIVES: number = re.sub(r'[a-z]$', '', number)  # e322i is a form of e322
    return {'code': number.upper(), 'name': ADDITIVES.get(number)}


def _readable(values):
    return [re.sub(r'^[a-z]{2}:', '', value).replace('-', ' ').title() for value in values if isinstance(value, str)][:12]


def _unique(rows, key):
    seen, result = set(), []
    for row in rows:
        if row and row[key] not in seen:
            seen.add(row[key]); result.append(row)
    return result


def details(code, product):
    labels = product.get('labels_tags') if isinstance(product.get('labels_tags'), list) else []
    additives = product.get('additives_tags') if isinstance(product.get('additives_tags'), list) else []
    countries = product.get('countries_tags') if isinstance(product.get('countries_tags'), list) else []
    origin = next((value.strip() for value in (product.get('origins'), product.get('manufacturing_places')) if isinstance(value, str) and value.strip()), None)
    return {'registered_in': registered_in(code), 'made_in': origin, 'sold_in': _readable(countries),
            'certifications': _unique(map(describe_mark, labels[:30]), 'name'), 'additives': _unique(map(additive, additives[:40]), 'code')}

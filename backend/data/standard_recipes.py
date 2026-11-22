"""TrackCal standard recipes: everyday cooked Indian dishes, calculated from IFCT 2017 raw ingredients.

Written by TrackCal (our own recipe compositions; no recipe database was copied). The values are calculated at seed
time from the IFCT foods already in the catalog (scripts/seed_standard_recipes.py), so they carry the same IFCT launch
gate (docs/DATA_SOURCES.md).

Each recipe: raw ingredients in grams (IFCT food code, or SUGAR), and the weight of the whole cooked batch. Nutrients
per 100 g cooked = the sum of the raw ingredients' nutrients / cooked weight x 100. Cooking keeps calories, protein,
carbohydrate and fat; it mostly adds or removes water, which the cooked weight captures. Deep-fried foods list the oil
they absorb, not the oil in the pan.
Not counted: salt, whole spices, spice powders and tea leaves (under 1% of energy in these amounts).
Stand-ins: curd and buttermilk are counted as whole cow milk (curd has the same composition); gram flour (besan) as
Bengal gram dal, which is what it is ground from; cream as whole buffalo milk reduced (stated per recipe).
Home recipes vary, often by 20-30%, mostly with the oil and ghee used. Every value is marked as calculated.
Dietitian review of these compositions is an owner task before launch.

Portions are everyday Indian measures: 1 katori (small bowl) is 150 g of a curry or dal; rice and dishes are weighed
cooked as served.
"""

SUGAR = 'SUGAR'   # sucrose: USDA FoodData Central "Sugars, granulated" (public domain): 387 kcal, 99.98 g carbohydrate per 100 g
SUGAR_PER_100G = {'energy_kcal': 387.0, 'protein': 0.0, 'carbohydrates': 99.98, 'fat': 0.0, 'fiber': 0.0}

KATORI = ('1 katori (150 g)', 150)
PLATE = ('1 plate (250 g)', 250)
CUP = ('1 cup (200 g)', 200)


def R(slug, name, category, ingredients, cooked_g, portions, names=None, aliases=()):
    return {'slug': slug, 'name': name, 'category': category, 'ingredients': ingredients, 'cooked_g': cooked_g,
            'portions': portions, 'names': names or {}, 'aliases': list(aliases)}


RECIPES = [
    # ── Rice ─────────────────────────────────────────────────────────────────────
    R('steamed-rice', 'Rice, cooked (plain)', 'Rice dishes', [('A015', 100)], 300, [('1 katori (150 g)', 150), ('1 plate (250 g)', 250)],
      {'hi': 'चावल (पका हुआ)', 'ta': 'சாதம்', 'te': 'అన్నం', 'bn': 'ভাত', 'mr': 'भात'}, ['chawal', 'bhaat', 'sadam', 'annam', 'boiled rice', 'white rice']),
    R('brown-rice-cooked', 'Brown rice, cooked', 'Rice dishes', [('A013', 100)], 280, [KATORI], {'hi': 'ब्राउन चावल'}, ['brown rice']),
    R('jeera-rice', 'Jeera rice', 'Rice dishes', [('A015', 100), ('T013', 6)], 300, [KATORI, PLATE], {'hi': 'जीरा राइस'}, ['jira rice', 'cumin rice']),
    R('lemon-rice', 'Lemon rice', 'Rice dishes', [('A015', 100), ('T005', 10), ('H012', 10), ('B001', 5), ('E033', 10)], 320, [KATORI, PLATE],
      {'ta': 'எலுமிச்சை சாதம்', 'te': 'పులిహోర (నిమ్మకాయ)', 'hi': 'नींबू चावल'}, ['chitranna', 'elumichai sadam', 'nimbu rice']),
    R('curd-rice', 'Curd rice', 'Rice dishes', [('A015', 100), ('L002', 300), ('T005', 3)], 600, [KATORI, PLATE],
      {'ta': 'தயிர் சாதம்', 'te': 'పెరుగన్నం', 'hi': 'दही चावल'}, ['thayir sadam', 'dahi chawal', 'mosaranna', 'perugu annam']),
    R('tamarind-rice', 'Tamarind rice (puliyodarai)', 'Rice dishes', [('A015', 100), ('E064', 20), ('T004', 15), ('H012', 10), ('I001', 5)], 330, [KATORI, PLATE],
      {'ta': 'புளியோதரை', 'te': 'పులిహోర'}, ['puliyogare', 'pulihora', 'puliyodharai']),
    R('veg-pulao', 'Vegetable pulao', 'Rice dishes', [('A015', 100), ('F002', 30), ('D061', 30), ('D050', 25), ('G017', 25), ('T013', 10)], 360, [KATORI, PLATE],
      {'hi': 'वेज पुलाव'}, ['pulav', 'veg pulav', 'vegetable pulav']),
    R('veg-biryani', 'Vegetable biryani', 'Rice dishes', [('A015', 200), ('F002', 50), ('D061', 50), ('D050', 40), ('F006', 60), ('G017', 80), ('L002', 60), ('T012', 20), ('T013', 10)], 820, [PLATE, KATORI],
      {'hi': 'वेज बिरयानी', 'ta': 'காய்கறி பிரியாணி', 'te': 'వెజ్ బిర్యానీ'}, ['veg biriyani', 'vegetable biriyani']),
    R('chicken-biryani', 'Chicken biryani', 'Rice dishes', [('A015', 200), ('N001', 300), ('G017', 100), ('L002', 80), ('T012', 25), ('T013', 10)], 950, [PLATE, KATORI],
      {'hi': 'चिकन बिरयानी', 'ta': 'சிக்கன் பிரியாணி', 'te': 'చికెన్ బిర్యానీ', 'bn': 'চিকেন বিরিয়ানি'}, ['chicken biriyani', 'murgh biryani']),
    R('mutton-biryani', 'Mutton biryani', 'Rice dishes', [('A015', 200), ('O001', 300), ('G017', 100), ('L002', 80), ('T012', 25), ('T013', 15)], 930, [PLATE, KATORI],
      {'hi': 'मटन बिरयानी', 'ta': 'மட்டன் பிரியாணி', 'te': 'మటన్ బిర్యానీ'}, ['mutton biriyani', 'gosht biryani']),
    R('egg-fried-rice', 'Egg fried rice', 'Rice dishes', [('A015', 100), ('M001', 50), ('D033', 20), ('F002', 20), ('G017', 20), ('T012', 12)], 340, [PLATE, KATORI],
      {'hi': 'अंडा फ्राइड राइस'}, ['egg rice', 'fried rice']),
    R('khichdi', 'Khichdi (rice and moong dal)', 'Rice dishes', [('A015', 60), ('B010', 40), ('T013', 6)], 450, [KATORI, PLATE],
      {'hi': 'खिचड़ी', 'bn': 'খিচুড়ি', 'mr': 'खिचडी', 'te': 'కిచిడీ'}, ['khichri', 'kichdi', 'khichuri']),
    R('ven-pongal', 'Ven pongal', 'Breakfast', [('A015', 70), ('B010', 30), ('T013', 15), ('H005', 5)], 450, [KATORI, PLATE],
      {'ta': 'வெண் பொங்கல்', 'te': 'పొంగల్'}, ['pongal', 'khara pongal']),
    R('bisi-bele-bath', 'Bisi bele bath', 'Rice dishes', [('A015', 60), ('B021', 40), ('F002', 30), ('D050', 30), ('D061', 30), ('E064', 10), ('T013', 15)], 560, [KATORI, PLATE],
      {'hi': 'बिसी बेले भात'}, ['bisibelebath', 'sambar rice', 'sambar sadam']),
    # ── Breads ───────────────────────────────────────────────────────────────────
    R('roti', 'Roti / chapati (no oil)', 'Breads', [('A019', 100)], 130, [('1 roti (40 g)', 40)],
      {'hi': 'रोटी', 'mr': 'चपाती', 'ta': 'சப்பாத்தி', 'te': 'చపాతీ', 'bn': 'রুটি'}, ['chapati', 'chapathi', 'phulka', 'fulka', 'rotli', 'roti']),
    R('roti-ghee', 'Chapati with ghee', 'Breads', [('A019', 100), ('T013', 9)], 139, [('1 chapati (43 g)', 43)],
      {'hi': 'घी वाली रोटी'}, ['ghee roti', 'ghee chapati']),
    R('plain-paratha', 'Paratha (plain)', 'Breads', [('A019', 100), ('T013', 15)], 150, [('1 paratha (75 g)', 75)],
      {'hi': 'पराठा', 'bn': 'পরোটা', 'ta': 'பரோட்டா'}, ['parantha', 'parotta', 'porota', 'paratha']),
    R('aloo-paratha', 'Aloo paratha', 'Breads', [('A019', 100), ('F006', 120), ('G017', 15), ('T013', 15)], 260, [('1 paratha (130 g)', 130)],
      {'hi': 'आलू पराठा'}, ['aloo parantha', 'potato paratha']),
    R('methi-thepla', 'Methi thepla', 'Breads', [('A019', 100), ('C020', 30), ('L002', 20), ('T005', 10)], 170, [('1 thepla (40 g)', 40)],
      {'hi': 'मेथी थेपला'}, ['thepla']),
    R('puri', 'Puri', 'Breads', [('A019', 100), ('T005', 25)], 160, [('1 puri (25 g)', 25)],
      {'hi': 'पूरी', 'bn': 'লুচি', 'ta': 'பூரி', 'te': 'పూరి'}, ['poori', 'puri']),
    R('luchi', 'Luchi', 'Breads', [('A018', 100), ('T012', 25)], 160, [('1 luchi (25 g)', 25)], {'bn': 'লুচি'}, ['luchi']),
    R('bhatura', 'Bhatura', 'Breads', [('A018', 100), ('L002', 30), ('T012', 25)], 190, [('1 bhatura (80 g)', 80)], {'hi': 'भटूरा'}, ['bhature', 'batura']),
    R('naan', 'Naan', 'Breads', [('A018', 100), ('L002', 30), ('T013', 5)], 150, [('1 naan (90 g)', 90)], {'hi': 'नान'}, ['nan', 'butter naan']),
    R('makki-roti', 'Makki di roti', 'Breads', [('A006', 100), ('T013', 8)], 145, [('1 roti (60 g)', 60)], {'hi': 'मक्के की रोटी'}, ['makke ki roti', 'maize roti']),
    R('bajra-roti', 'Bajra roti', 'Breads', [('A003', 100)], 135, [('1 roti (50 g)', 50)], {'hi': 'बाजरे की रोटी', 'mr': 'बाजरीची भाकरी'}, ['bajra bhakri', 'bajra rotla']),
    R('jowar-roti', 'Jowar roti (bhakri)', 'Breads', [('A005', 100)], 135, [('1 bhakri (50 g)', 50)], {'hi': 'ज्वार की रोटी', 'mr': 'ज्वारीची भाकरी'}, ['jowar bhakri', 'jolada rotti']),
    R('ragi-mudde', 'Ragi mudde', 'Breads', [('A010', 100)], 300, [('1 ball (150 g)', 150)], {'te': 'రాగి సంగటి'}, ['ragi ball', 'ragi sangati', 'ragi mudde']),
    # ── Breakfast and South Indian ───────────────────────────────────────────────
    R('idli', 'Idli', 'Breakfast', [('A014', 75), ('B003', 25)], 250, [('1 idli (40 g)', 40)],
      {'ta': 'இட்லி', 'te': 'ఇడ్లీ', 'hi': 'इडली', 'mr': 'इडली'}, ['idly', 'iddli']),
    R('plain-dosa', 'Dosa (plain)', 'Breakfast', [('A014', 75), ('B003', 25), ('T005', 15)], 230, [('1 dosa (85 g)', 85)],
      {'ta': 'தோசை', 'te': 'దోసె', 'hi': 'डोसा'}, ['dosai', 'dosa', 'plain dosa', 'sada dosa']),
    R('masala-dosa', 'Masala dosa', 'Breakfast', [('A014', 75), ('B003', 25), ('T005', 20), ('F006', 100), ('G017', 20)], 350, [('1 masala dosa (175 g)', 175)],
      {'ta': 'மசாலா தோசை', 'te': 'మసాలా దోసె', 'hi': 'मसाला डोसा'}, ['masala dosai']),
    R('uttapam', 'Uttapam', 'Breakfast', [('A014', 75), ('B003', 25), ('G017', 30), ('D076', 30), ('T005', 10)], 280, [('1 uttapam (140 g)', 140)],
      {'ta': 'ஊத்தப்பம்', 'te': 'ఊతప్పం', 'hi': 'उत्तपम'}, ['uthappam', 'oothappam']),
    R('pesarattu', 'Pesarattu', 'Breakfast', [('B011', 100), ('A015', 20), ('T005', 10)], 270, [('1 pesarattu (90 g)', 90)], {'te': 'పెసరట్టు'}, ['moong dosa', 'green gram dosa']),
    R('medu-vada', 'Medu vada', 'Breakfast', [('B003', 100), ('T005', 18)], 190, [('1 vada (45 g)', 45)],
      {'ta': 'மெது வடை', 'te': 'గారె', 'hi': 'मेदू वड़ा'}, ['vada', 'vadai', 'uddina vade', 'garelu']),
    R('upma', 'Upma', 'Breakfast', [('A022', 100), ('G017', 40), ('T005', 10), ('H012', 5)], 400, [KATORI, PLATE],
      {'ta': 'உப்புமா', 'te': 'ఉప్మా', 'hi': 'उपमा', 'mr': 'उपीट'}, ['uppittu', 'uppuma', 'rava upma']),
    R('poha', 'Poha', 'Breakfast', [('A011', 100), ('G017', 40), ('D061', 20), ('H012', 15), ('T005', 10)], 300, [('1 plate (200 g)', 200), KATORI],
      {'hi': 'पोहा', 'mr': 'पोहे', 'te': 'అటుకులు', 'ta': 'அவல்'}, ['pohe', 'aval', 'avalakki', 'chivda', 'chura', 'kanda poha']),
    R('appam', 'Appam', 'Breakfast', [('A015', 100), ('H007', 30)], 300, [('1 appam (60 g)', 60)], {'ta': 'ஆப்பம்'}, ['palappam', 'hoppers']),
    R('puttu', 'Puttu', 'Breakfast', [('A015', 100), ('H007', 30)], 220, [('1 piece (110 g)', 110)], {'ta': 'புட்டு'}, ['puttu']),
    R('coconut-chutney', 'Coconut chutney', 'Sides', [('H007', 100), ('B001', 20), ('T005', 5)], 200, [('2 tablespoons (30 g)', 30), ('1 small bowl (60 g)', 60)],
      {'ta': 'தேங்காய் சட்னி', 'te': 'కొబ్బరి చట్నీ', 'hi': 'नारियल चटनी'}, ['chutney', 'thengai chutney', 'kobbari pachadi']),
    R('sambar', 'Sambar', 'Dal and curries', [('B021', 50), ('D046', 40), ('D031', 40), ('D066', 40), ('G017', 50), ('D076', 50), ('E064', 10), ('T005', 10)], 800, [KATORI, ('1 cup (200 g)', 200)],
      {'ta': 'சாம்பார்', 'te': 'సాంబారు', 'hi': 'सांभर'}, ['sambhar', 'sambaar', 'saambar']),
    R('rasam', 'Rasam', 'Dal and curries', [('B021', 20), ('D076', 100), ('E064', 10), ('T013', 5)], 600, [KATORI, ('1 cup (200 g)', 200)],
      {'ta': 'ரசம்', 'te': 'చారు', 'hi': 'रसम'}, ['saaru', 'chaaru', 'charu', 'tomato rasam']),
    R('avial', 'Avial', 'Vegetables', [('F002', 80), ('D046', 60), ('D050', 60), ('D066', 60), ('F017', 40), ('H007', 60), ('L002', 50), ('T001', 10)], 400, [KATORI],
      {'ta': 'அவியல்'}, ['aviyal']),
    R('cabbage-thoran', 'Cabbage thoran / poriyal', 'Vegetables', [('C015', 300), ('H007', 40), ('T001', 10), ('B003', 5)], 300, [KATORI],
      {'ta': 'முட்டைக்கோஸ் பொரியல்', 'te': 'క్యాబేజీ కూర'}, ['thoran', 'poriyal', 'cabbage poriyal', 'cabbage sabzi']),
    R('beans-poriyal', 'Beans poriyal', 'Vegetables', [('D050', 300), ('H007', 30), ('T005', 10)], 290, [KATORI], {'ta': 'பீன்ஸ் பொரியல்'}, ['beans thoran', 'beans sabzi']),
    # ── Dal ──────────────────────────────────────────────────────────────────────
    R('toor-dal', 'Dal (toor, plain)', 'Dal and curries', [('B021', 100), ('T013', 5)], 500, [KATORI, CUP],
      {'hi': 'अरहर दाल', 'mr': 'वरण', 'te': 'పప్పు', 'ta': 'பருப்பு', 'bn': 'অড়হর ডাল'}, ['dal', 'daal', 'arhar dal', 'tuvar dal', 'varan', 'pappu', 'paruppu']),
    R('dal-tadka', 'Dal tadka', 'Dal and curries', [('B021', 100), ('G017', 40), ('D076', 50), ('T013', 12)], 550, [KATORI, CUP],
      {'hi': 'दाल तड़का'}, ['dal fry', 'tadka dal', 'yellow dal']),
    R('moong-dal', 'Moong dal', 'Dal and curries', [('B010', 100), ('D076', 40), ('T013', 8)], 520, [KATORI, CUP],
      {'hi': 'मूंग दाल', 'bn': 'মুগ ডাল'}, ['mung dal', 'moong daal']),
    R('masoor-dal', 'Masoor dal', 'Dal and curries', [('B013', 100), ('G017', 30), ('D076', 40), ('T006', 8)], 520, [KATORI, CUP],
      {'hi': 'मसूर दाल', 'bn': 'মসুর ডাল'}, ['masur dal', 'red lentil dal']),
    R('chana-dal', 'Chana dal', 'Dal and curries', [('B001', 100), ('G017', 30), ('D076', 40), ('T013', 10)], 480, [KATORI, CUP],
      {'hi': 'चना दाल', 'bn': 'ছোলার ডাল'}, ['cholar dal', 'bengal gram dal']),
    R('dal-makhani', 'Dal makhani', 'Dal and curries', [('B004', 70), ('B020', 30), ('D076', 60), ('T013', 20), ('L001', 50)], 450, [KATORI, CUP],
      {'hi': 'दाल मखनी'}, ['maa ki dal', 'dal makhni']),
    R('rajma', 'Rajma (kidney bean curry)', 'Dal and curries', [('B020', 100), ('G017', 60), ('D076', 80), ('T012', 15)], 450, [KATORI, CUP],
      {'hi': 'राजमा'}, ['rajma', 'rajmah', 'rajma masala', 'rajma curry', 'kidney beans', 'rajma chawal']),
    R('chole', 'Chole (chickpea curry)', 'Dal and curries', [('B002', 100), ('G017', 60), ('D076', 80), ('T012', 15)], 450, [KATORI, CUP],
      {'hi': 'छोले', 'mr': 'छोले'}, ['chana masala', 'chhole', 'channa masala', 'chickpea curry']),
    R('kadhi', 'Kadhi', 'Dal and curries', [('B001', 30), ('L002', 300), ('T005', 10)], 400, [KATORI, CUP],
      {'hi': 'कढ़ी'}, ['kadi', 'kadhi chawal', 'punjabi kadhi']),
    # ── Vegetables and paneer ───────────────────────────────────────────────────
    R('aloo-sabzi', 'Aloo sabzi (potato curry)', 'Vegetables', [('F006', 300), ('D076', 50), ('T005', 15)], 330, [KATORI],
      {'hi': 'आलू की सब्ज़ी', 'bn': 'আলুর তরকারি'}, ['aloo bhaji', 'batata bhaji', 'potato sabzi', 'aloo curry']),
    R('aloo-gobi', 'Aloo gobi', 'Vegetables', [('F006', 200), ('D036', 200), ('G017', 40), ('D076', 40), ('T005', 15)], 440, [KATORI],
      {'hi': 'आलू गोभी'}, ['aloo gobhi', 'gobi aloo']),
    R('bhindi-fry', 'Bhindi fry (okra)', 'Vegetables', [('D056', 250), ('G017', 40), ('T005', 15)], 230, [KATORI],
      {'hi': 'भिंडी', 'ta': 'வெண்டைக்காய் பொரியல்', 'te': 'బెండకాయ వేపుడు'}, ['bhindi masala', 'okra fry', 'vendakkai']),
    R('baingan-bharta', 'Baingan bharta', 'Vegetables', [('D031', 300), ('G017', 60), ('D076', 60), ('T006', 15)], 330, [KATORI],
      {'hi': 'बैंगन भर्ता', 'bn': 'বেগুন ভর্তা'}, ['baingan bhartha', 'begun bhaja', 'brinjal bharta']),
    R('mixed-veg', 'Mixed vegetable curry', 'Vegetables', [('F006', 80), ('F002', 60), ('D050', 60), ('D061', 50), ('D036', 60), ('G017', 40), ('D076', 50), ('T005', 15)], 420, [KATORI],
      {'hi': 'मिक्स वेज'}, ['mix veg', 'veg curry', 'mixed veg']),
    R('palak-paneer', 'Palak paneer', 'Vegetables', [('C033', 300), ('L003', 100), ('G017', 40), ('D076', 40), ('T013', 15)], 420, [KATORI],
      {'hi': 'पालक पनीर'}, ['saag paneer', 'spinach paneer']),
    R('matar-paneer', 'Matar paneer', 'Vegetables', [('L003', 100), ('D061', 100), ('G017', 50), ('D076', 80), ('T012', 15)], 420, [KATORI],
      {'hi': 'मटर पनीर'}, ['mutter paneer', 'peas paneer']),
    R('paneer-butter-masala', 'Paneer butter masala', 'Vegetables', [('L003', 100), ('D076', 100), ('G017', 40), ('H005', 15), ('T013', 15), ('L001', 40)], 300, [KATORI],
      {'hi': 'पनीर बटर मसाला'}, ['butter paneer', 'paneer makhani', 'shahi paneer']),
    R('kadai-paneer', 'Kadai paneer', 'Vegetables', [('L003', 100), ('D033', 60), ('G017', 50), ('D076', 60), ('T012', 15)], 270, [KATORI],
      {'hi': 'कड़ाही पनीर'}, ['karahi paneer', 'kadhai paneer']),
    R('pav-bhaji-bhaji', 'Pav bhaji (bhaji only)', 'Vegetables', [('F006', 200), ('D036', 100), ('D061', 50), ('D033', 50), ('D076', 150), ('G017', 60), ('T013', 25)], 600, [KATORI],
      {'hi': 'पाव भाजी', 'mr': 'पावभाजी'}, ['pav bhaji', 'bhaji']),
    R('lauki-sabzi', 'Lauki sabzi (bottle gourd)', 'Vegetables', [('D007', 400), ('D076', 40), ('T005', 10)], 380, [KATORI],
      {'hi': 'लौकी की सब्ज़ी'}, ['ghiya', 'doodhi', 'sorakaya', 'bottle gourd curry']),
    # ── Non-vegetarian ──────────────────────────────────────────────────────────
    R('chicken-curry', 'Chicken curry', 'Non-vegetarian', [('N001', 500), ('G017', 100), ('D076', 100), ('G014', 10), ('G011', 10), ('T012', 25)], 700, [KATORI, ('1 cup (200 g)', 200)],
      {'hi': 'चिकन करी', 'bn': 'মুরগির ঝোল', 'ta': 'கோழிக் குழம்பு', 'te': 'చికెన్ కూర'}, ['murgh curry', 'chicken masala', 'kozhi kuzhambu']),
    R('butter-chicken', 'Butter chicken', 'Non-vegetarian', [('N001', 500), ('D076', 150), ('T013', 30), ('L001', 100), ('H005', 20)], 700, [KATORI],
      {'hi': 'बटर चिकन'}, ['murgh makhani', 'chicken makhani']),
    R('chicken-tikka', 'Chicken tikka', 'Non-vegetarian', [('N003', 300), ('L002', 60), ('T006', 10)], 250, [('6 pieces (150 g)', 150)], {'hi': 'चिकन टिक्का'}, ['tikka']),
    R('tandoori-chicken', 'Tandoori chicken', 'Non-vegetarian', [('N001', 400), ('L002', 80), ('T006', 10)], 300, [('1 leg piece (120 g)', 120)], {'hi': 'तंदूरी चिकन'}, ['tandoori']),
    R('mutton-curry', 'Mutton curry', 'Non-vegetarian', [('O001', 500), ('G017', 100), ('D076', 100), ('G014', 10), ('G011', 10), ('T012', 25)], 650, [KATORI],
      {'hi': 'मटन करी', 'bn': 'পাঁঠার মাংস', 'ta': 'மட்டன் குழம்பு'}, ['gosht', 'mutton masala', 'goat curry', 'kosha mangsho']),
    R('keema', 'Keema matar', 'Non-vegetarian', [('O001', 400), ('D061', 80), ('G017', 80), ('D076', 80), ('T012', 20)], 560, [KATORI], {'hi': 'कीमा'}, ['kheema', 'keema mutter', 'mince curry']),
    R('fish-curry', 'Fish curry (rohu)', 'Non-vegetarian', [('S006', 400), ('G017', 60), ('D076', 60), ('T006', 20)], 550, [KATORI],
      {'bn': 'মাছের ঝোল', 'hi': 'मछली करी', 'ta': 'மீன் குழம்பு', 'te': 'చేపల పులుసు'}, ['macher jhol', 'meen kuzhambu', 'fish curry']),
    R('fish-fry', 'Fish fry', 'Non-vegetarian', [('P034', 300), ('T005', 20)], 260, [('2 pieces (120 g)', 120)],
      {'hi': 'मछली फ्राई', 'ta': 'மீன் வறுவல்', 'bn': 'মাছ ভাজা'}, ['meen varuval', 'mach bhaja', 'mackerel fry']),
    R('prawn-curry', 'Prawn curry', 'Non-vegetarian', [('S009', 300), ('H007', 60), ('G017', 50), ('D076', 50), ('T001', 15)], 500, [KATORI],
      {'hi': 'झींगा करी', 'bn': 'চিংড়ি মালাইকারি'}, ['jhinga curry', 'chingri', 'prawn masala']),
    R('egg-curry', 'Egg curry', 'Non-vegetarian', [('M004', 300), ('G017', 80), ('D076', 80), ('T012', 15)], 520, [('1 katori with 2 eggs (180 g)', 180)],
      {'hi': 'अंडा करी', 'bn': 'ডিমের কারি', 'ta': 'முட்டைக் குழம்பு'}, ['anda curry', 'egg masala', 'dimer dalna']),
    R('egg-bhurji', 'Egg bhurji', 'Non-vegetarian', [('M001', 150), ('G017', 30), ('D076', 30), ('T012', 8)], 190, [('1 serving, 3 eggs (190 g)', 190)],
      {'hi': 'अंडा भुर्जी'}, ['anda bhurji', 'scrambled eggs indian']),
    # ── Snacks ───────────────────────────────────────────────────────────────────
    R('samosa', 'Samosa', 'Snacks', [('A018', 30), ('F006', 50), ('D061', 10), ('T012', 14)], 95, [('1 samosa (95 g)', 95)],
      {'hi': 'समोसा', 'bn': 'সিঙ্গাড়া'}, ['singara', 'samosa']),
    R('onion-pakora', 'Onion pakora', 'Snacks', [('B001', 50), ('G017', 100), ('T012', 20)], 150, [('5 pieces (75 g)', 75)],
      {'hi': 'प्याज़ पकोड़ा', 'ta': 'வெங்காய பஜ்ஜி', 'mr': 'कांदा भजी'}, ['pakoda', 'bhajji', 'bhaji', 'onion bhaji', 'kanda bhaji']),
    R('dhokla', 'Dhokla', 'Snacks', [('B001', 100), ('T005', 5), (SUGAR, 5)], 260, [('3 pieces (90 g)', 90)], {'hi': 'ढोकला'}, ['khaman', 'khaman dhokla']),
    R('vada-pav-vada', 'Batata vada', 'Snacks', [('F006', 100), ('B001', 30), ('T005', 15)], 150, [('1 vada (75 g)', 75)], {'mr': 'बटाटा वडा', 'hi': 'आलू बोंडा'}, ['aloo bonda', 'batata wada']),
    # ── Sweets ───────────────────────────────────────────────────────────────────
    R('rice-kheer', 'Rice kheer', 'Sweets', [('A015', 30), ('L001', 500), (SUGAR, 40)], 400, [('1 katori (120 g)', 120)],
      {'hi': 'खीर', 'bn': 'পায়েস', 'ta': 'பாயசம்'}, ['payesh', 'payasam', 'kheer', 'chawal ki kheer']),
    R('semiya-payasam', 'Semiya payasam', 'Sweets', [('A023', 50), ('L002', 500), (SUGAR, 60), ('T013', 5)], 450, [('1 katori (120 g)', 120)],
      {'ta': 'சேமியா பாயசம்', 'hi': 'सेवइयां'}, ['seviyan', 'vermicelli kheer', 'semiya payasam']),
    R('sooji-halwa', 'Sooji halwa', 'Sweets', [('A022', 100), ('T013', 50), (SUGAR, 100)], 400, [('1 katori (100 g)', 100)],
      {'hi': 'सूजी का हलवा', 'ta': 'கேசரி'}, ['suji halwa', 'kesari', 'sheera', 'rava kesari']),
    R('gajar-halwa', 'Gajar halwa', 'Sweets', [('F003', 500), ('L001', 500), (SUGAR, 100), ('T013', 40), ('L004', 50)], 650, [('1 katori (100 g)', 100)],
      {'hi': 'गाजर का हलवा'}, ['carrot halwa', 'gajar ka halwa']),
    R('gulab-jamun', 'Gulab jamun', 'Sweets', [('L004', 100), ('A018', 20), (SUGAR, 60), ('T013', 20)], 250, [('1 piece (40 g)', 40)],
      {'hi': 'गुलाब जामुन', 'bn': 'পান্তুয়া'}, ['gulab jamoon', 'jamun', 'pantua']),
    R('besan-laddoo', 'Besan laddoo', 'Sweets', [('B001', 100), ('T013', 60), (SUGAR, 80)], 240, [('1 laddoo (30 g)', 30)],
      {'hi': 'बेसन लड्डू'}, ['besan ladoo', 'laddu', 'ladoo']),
    R('rasgulla', 'Rasgulla', 'Sweets', [('L003', 100), (SUGAR, 50)], 180, [('1 piece (45 g)', 45)],
      {'bn': 'রসগোল্লা', 'hi': 'रसगुल्ला'}, ['rosogolla', 'rasagola']),
    # ── Drinks ───────────────────────────────────────────────────────────────────
    R('masala-chai', 'Tea with milk and sugar (chai)', 'Drinks', [('L002', 80), (SUGAR, 8)], 180, [('1 cup (150 g)', 150)],
      {'hi': 'चाय', 'bn': 'চা', 'ta': 'டீ', 'te': 'టీ', 'mr': 'चहा'}, ['chai', 'chaya', 'tea', 'cutting chai', 'masala tea']),
    R('filter-coffee', 'Filter coffee with milk and sugar', 'Drinks', [('L002', 120), (SUGAR, 10)], 160, [('1 tumbler (150 g)', 150)],
      {'ta': 'ஃபில்டர் காபி', 'te': 'ఫిల్టర్ కాఫీ'}, ['kaapi', 'coffee', 'south indian coffee']),
    R('sweet-lassi', 'Lassi (sweet)', 'Drinks', [('L002', 200), (SUGAR, 20)], 220, [('1 glass (250 g)', 250)], {'hi': 'लस्सी'}, ['lassi', 'meethi lassi']),
    R('mango-lassi', 'Mango lassi', 'Drinks', [('L002', 150), ('E039', 100), (SUGAR, 15)], 265, [('1 glass (250 g)', 250)], {'hi': 'मैंगो लस्सी'}, ['aam lassi']),
    # ── Basics people log on their own ──────────────────────────────────────────
    R('curd', 'Curd (dahi, plain)', 'Dairy', [('L002', 100)], 100, [('1 katori (100 g)', 100), ('1 tablespoon (15 g)', 15)],
      {'hi': 'दही', 'ta': 'தயிர்', 'te': 'పెరుగు', 'bn': 'দই', 'mr': 'दही'}, ['curd', 'dahi', 'yogurt', 'yoghurt', 'plain yogurt', 'thayir', 'perugu', 'mosaru', 'doi']),
    R('sugar', 'Sugar (white)', 'Sweeteners', [(SUGAR, 100)], 100, [('1 teaspoon (4 g)', 4), ('1 tablespoon (12 g)', 12)],
      {'hi': 'चीनी', 'ta': 'சர்க்கரை', 'te': 'చక్కెర', 'bn': 'চিনি', 'mr': 'साखर'}, ['sugar', 'cheeni', 'chini', 'white sugar', 'table sugar', 'sakkarai']),
    R('buttermilk', 'Buttermilk (chaas)', 'Drinks', [('L002', 100)], 300, [('1 glass (250 g)', 250)],
      {'hi': 'छाछ', 'ta': 'மோர்', 'te': 'మజ్జిగ', 'mr': 'ताक'}, ['chaas', 'chhachh', 'mor', 'majjige', 'taak', 'masala chaas']),
]

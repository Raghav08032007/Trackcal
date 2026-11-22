"""Phase G2: the Journal's page link and its two overview cards (lib/sections.ts). Draft: native review needed.
Columns: hi, bn, mr, te, ta, es, pt, id, ar, kn, ml, gu, pa, ur, fr, de."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar', 'kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "Journal": ["डायरी", "ডায়েরি", "डायरी", "డైరీ", "நாட்குறிப்பு", "Diario", "Diário", "Jurnal", "اليوميات", "ದಿನಚರಿ", "ഡയറി", "ડાયરી", "ਡਾਇਰੀ", "ڈائری",
  "Journal", "Tagebuch"],
 "Every workout and meal by day, month and year; add gym sessions and plan ahead.": [
  "हर वर्कआउट और भोजन दिन, महीने और साल के हिसाब से; जिम सेशन जोड़ें और आगे की योजना बनाएँ।",
  "প্রতিটি ওয়ার্কআউট ও খাবার দিন, মাস ও বছর অনুযায়ী; জিমের সেশন যোগ করুন ও আগাম পরিকল্পনা করুন।",
  "प्रत्येक व्यायाम आणि जेवण दिवस, महिना आणि वर्षानुसार; जिम सत्र जोडा आणि पुढचे नियोजन करा.",
  "ప్రతి వ్యాయామం, భోజనం రోజు, నెల, సంవత్సరం వారీగా; జిమ్ సెషన్లు జోడించి ముందుగా ప్లాన్ చేయండి.",
  "ஒவ்வொரு பயிற்சியும் உணவும் நாள், மாதம், ஆண்டு வாரியாக; ஜிம் அமர்வுகளைச் சேர்த்து முன்கூட்டியே திட்டமிடுங்கள்.",
  "Cada entrenamiento y comida por día, mes y año; añade sesiones de gimnasio y planifica.",
  "Cada treino e refeição por dia, mês e ano; adicione sessões de academia e planeje.",
  "Setiap latihan dan makanan per hari, bulan dan tahun; tambahkan sesi gym dan rencanakan ke depan.",
  "كل تمرين ووجبة حسب اليوم والشهر والسنة؛ أضف جلسات النادي وخطط مسبقًا.",
  "ಪ್ರತಿ ವ್ಯಾಯಾಮ ಮತ್ತು ಊಟ ದಿನ, ತಿಂಗಳು, ವರ್ಷದ ಪ್ರಕಾರ; ಜಿಮ್ ಸೆಷನ್ ಸೇರಿಸಿ ಮುಂದೆ ಯೋಜಿಸಿ.",
  "ഓരോ വ്യായാമവും ഭക്ഷണവും ദിവസം, മാസം, വർഷം തിരിച്ച്; ജിം സെഷനുകൾ ചേർത്ത് മുൻകൂട്ടി പ്ലാൻ ചെയ്യുക.",
  "દરેક કસરત અને ભોજન દિવસ, મહિના અને વર્ષ મુજબ; જિમ સત્ર ઉમેરો અને આગળનું આયોજન કરો.",
  "ਹਰ ਕਸਰਤ ਅਤੇ ਖਾਣਾ ਦਿਨ, ਮਹੀਨੇ ਅਤੇ ਸਾਲ ਮੁਤਾਬਕ; ਜਿਮ ਸੈਸ਼ਨ ਜੋੜੋ ਅਤੇ ਅੱਗੇ ਦੀ ਯੋਜਨਾ ਬਣਾਓ।",
  "ہر ورزش اور کھانا دن، مہینے اور سال کے حساب سے؛ جم سیشن شامل کریں اور آگے کا منصوبہ بنائیں۔",
  "Chaque séance et chaque repas par jour, mois et année ; ajoute tes séances en salle et planifie la suite.",
  "Jedes Workout und jede Mahlzeit nach Tag, Monat und Jahr; trag Gym-Einheiten ein und plane voraus."],
 "Every workout and meal by day, month and year, with your best days.": [
  "हर वर्कआउट और भोजन दिन, महीने और साल के हिसाब से, आपके सबसे अच्छे दिनों के साथ।",
  "প্রতিটি ওয়ার্কআউট ও খাবার দিন, মাস ও বছর অনুযায়ী, আপনার সেরা দিনগুলো সহ।",
  "प्रत्येक व्यायाम आणि जेवण दिवस, महिना आणि वर्षानुसार, तुमच्या सर्वोत्तम दिवसांसह.",
  "ప్రతి వ్యాయామం, భోజనం రోజు, నెల, సంవత్సరం వారీగా, మీ ఉత్తమ రోజులతో.",
  "ஒவ்வொரு பயிற்சியும் உணவும் நாள், மாதம், ஆண்டு வாரியாக, உங்கள் சிறந்த நாட்களுடன்.",
  "Cada entrenamiento y comida por día, mes y año, con tus mejores días.",
  "Cada treino e refeição por dia, mês e ano, com os seus melhores dias.",
  "Setiap latihan dan makanan per hari, bulan dan tahun, dengan hari terbaikmu.",
  "كل تمرين ووجبة حسب اليوم والشهر والسنة، مع أفضل أيامك.",
  "ಪ್ರತಿ ವ್ಯಾಯಾಮ ಮತ್ತು ಊಟ ದಿನ, ತಿಂಗಳು, ವರ್ಷದ ಪ್ರಕಾರ, ನಿಮ್ಮ ಅತ್ಯುತ್ತಮ ದಿನಗಳೊಂದಿಗೆ.",
  "ഓരോ വ്യായാമവും ഭക്ഷണവും ദിവസം, മാസം, വർഷം തിരിച്ച്, നിങ്ങളുടെ മികച്ച ദിവസങ്ങളോടൊപ്പം.",
  "દરેક કસરત અને ભોજન દિવસ, મહિના અને વર્ષ મુજબ, તમારા શ્રેષ્ઠ દિવસો સાથે.",
  "ਹਰ ਕਸਰਤ ਅਤੇ ਖਾਣਾ ਦਿਨ, ਮਹੀਨੇ ਅਤੇ ਸਾਲ ਮੁਤਾਬਕ, ਤੁਹਾਡੇ ਸਭ ਤੋਂ ਵਧੀਆ ਦਿਨਾਂ ਨਾਲ।",
  "ہر ورزش اور کھانا دن، مہینے اور سال کے حساب سے، آپ کے بہترین دنوں کے ساتھ۔",
  "Chaque séance et chaque repas par jour, mois et année, avec tes meilleurs jours.",
  "Jedes Workout und jede Mahlzeit nach Tag, Monat und Jahr, mit deinen besten Tagen."],
}

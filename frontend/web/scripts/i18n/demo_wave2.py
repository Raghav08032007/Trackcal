"""The exercise demo's controls (components/exercise-demo.tsx) for the wave-2 languages: wave 1 already has them, and
the 3D coach now shows them on the camera and sports screens. Draft: native review needed.
Columns: kn, ml, gu, pa, ur, fr, de."""

LANGS = ['kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "How to do {n}": ["{n} ಮಾಡುವುದು ಹೇಗೆ", "{n} എങ്ങനെ ചെയ്യാം", "{n} કેવી રીતે કરવું", "{n} ਕਿਵੇਂ ਕਰੀਏ", "{n} کیسے کریں", "Comment faire : {n}", "So geht {n}"],
 "How to do it": ["ಮಾಡುವುದು ಹೇಗೆ", "എങ്ങനെ ചെയ്യാം", "કેવી રીતે કરવું", "ਕਿਵੇਂ ਕਰੀਏ", "کیسے کریں", "Comment faire", "So geht's"],
 "The camera watches for:": ["ಕ್ಯಾಮೆರಾ ಗಮನಿಸುವುದು:", "ക്യാമറ ശ്രദ്ധിക്കുന്നത്:", "કૅમેરા આ જુએ છે:", "ਕੈਮਰਾ ਇਹ ਵੇਖਦਾ ਹੈ:", "کیمرا یہ دیکھتا ہے:", "La caméra vérifie :", "Die Kamera achtet auf:"],
 "Normal speed": ["ಸಾಮಾನ್ಯ ವೇಗ", "സാധാരണ വേഗം", "સામાન્ય ઝડપ", "ਆਮ ਰਫ਼ਤਾਰ", "عام رفتار", "Vitesse normale", "Normales Tempo"],
 "Slow motion": ["ನಿಧಾನ ಚಲನೆ", "സ്ലോ മോഷൻ", "ધીમી ગતિ", "ਹੌਲੀ ਰਫ਼ਤਾਰ", "آہستہ حرکت", "Ralenti", "Zeitlupe"],
 "Example: {n}": ["ಉದಾಹರಣೆ: {n}", "ഉദാഹരണം: {n}", "ઉદાહરણ: {n}", "ਉਦਾਹਰਨ: {n}", "مثال: {n}", "Exemple : {n}", "Beispiel: {n}"],
 "Pause": ["ವಿರಾಮ", "നിർത്തൂ", "થોભો", "ਰੋਕੋ", "روکیں", "Pause", "Pause"],
 "Simple view": ["ಸರಳ ನೋಟ", "ലളിത കാഴ്ച", "સરળ દૃશ્ય", "ਸਧਾਰਨ ਦ੍ਰਿਸ਼", "سادہ منظر", "Vue simple", "Einfache Ansicht"],
 "Animated example of {title}: {n}": ["{title} ನ ಚಲನಚಿತ್ರ ಉದಾಹರಣೆ: {n}", "{title}-ന്റെ ചലിക്കുന്ന ഉദാഹരണം: {n}", "{title} નું ચાલતું ઉદાહરણ: {n}", "{title} ਦੀ ਚਲਦੀ ਉਦਾਹਰਨ: {n}", "{title} کی متحرک مثال: {n}", "Exemple animé de {title} : {n}", "Animiertes Beispiel für {title}: {n}"],
 "How to do {title}": ["{title} ಮಾಡುವುದು ಹೇಗೆ", "{title} എങ്ങനെ ചെയ്യാം", "{title} કેવી રીતે કરવું", "{title} ਕਿਵੇਂ ਕਰੀਏ", "{title} کیسے کریں", "Comment faire : {title}", "So geht {title}"],
}

import re as _re
_FR = LANGS.index('fr')
T = {k: [_re.sub(r' ([?!:;])', ' \\1', x) if i == _FR else x for i, x in enumerate(v)] for k, v in T.items()}

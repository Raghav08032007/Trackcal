"""The camera angle badge above every moving example: side-on or facing the camera (components/exercise-demo.tsx).
Draft: native review needed. Columns: hi, bn, mr, te, ta, es, pt, id, ar, kn, ml, gu, pa, ur, fr, de."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar', 'kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "Camera angle": ["कैमरे का कोण", "ক্যামেরার কোণ", "कॅमेऱ्याचा कोन", "కెమెరా కోణం", "கேமரா கோணம்", "Ángulo de la cámara", "Ângulo da câmera",
  "Sudut kamera", "زاوية الكاميرا", "ಕ್ಯಾಮೆರಾ ಕೋನ", "ക്യാമറ കോൺ", "કૅમેરાનો ખૂણો", "ਕੈਮਰੇ ਦਾ ਕੋਣ", "کیمرے کا زاویہ", "Angle de la caméra", "Kamerawinkel"],
 "Side-on to the camera": ["कैमरे की ओर बगल से", "ক্যামেরার দিকে পাশ ফিরে", "कॅमेऱ्याकडे बाजूने", "కెమెరాకు పక్కగా", "கேமராவுக்குப் பக்கவாட்டில்",
  "De lado a la cámara", "De lado para a câmera", "Menyamping ke kamera", "جانبيًا للكاميرا", "ಕ್ಯಾಮೆರಾಗೆ ಪಕ್ಕವಾಗಿ", "ക്യാമറയ്ക്ക് വശംതിരിഞ്ഞ്",
  "કૅમેરાની બાજુમાં", "ਕੈਮਰੇ ਵੱਲ ਪਾਸੇ ਤੋਂ", "کیمرے کی طرف پہلو سے", "De profil par rapport à la caméra", "Seitlich zur Kamera"],
 "Facing the camera": ["कैमरे की ओर मुँह करके", "ক্যামেরার দিকে মুখ করে", "कॅमेऱ्याकडे तोंड करून", "కెమెరా వైపు ముఖం పెట్టి",
  "கேமராவை நோக்கி", "De frente a la cámara", "De frente para a câmera", "Menghadap kamera", "مواجهًا للكاميرا", "ಕ್ಯಾಮೆರಾ ಕಡೆ ಮುಖ ಮಾಡಿ",
  "ക്യാമറയ്ക്ക് അഭിമുഖമായി", "કૅમેરા તરફ મોં રાખીને", "ਕੈਮਰੇ ਵੱਲ ਮੂੰਹ ਕਰਕੇ", "کیمرے کی طرف منہ کر کے", "Face à la caméra", "Mit dem Gesicht zur Kamera"],
 "Side-on is best · facing the camera also counts": [
  "बगल से सबसे अच्छा · सामने से भी गिनती होती है", "পাশ থেকে সবচেয়ে ভালো · সামনে থেকেও গোনা হয়", "बाजूने सर्वोत्तम · समोरूनही मोजले जाते",
  "పక్క నుంచి ఉత్తమం · ముందు నుంచీ లెక్కిస్తుంది", "பக்கவாட்டில் சிறந்தது · முன்னாலிருந்தும் எண்ணப்படும்",
  "De lado es mejor · de frente también cuenta", "De lado é melhor · de frente também conta", "Menyamping paling baik · menghadap kamera juga dihitung",
  "الجانب هو الأفضل · المواجهة تُحتسب أيضًا", "ಪಕ್ಕದಿಂದ ಉತ್ತಮ · ಮುಂದಿನಿಂದಲೂ ಎಣಿಸುತ್ತದೆ", "വശത്തുനിന്നാണ് ഏറ്റവും നല്ലത് · മുന്നിൽനിന്നും എണ്ണും",
  "બાજુથી શ્રેષ્ઠ · સામેથી પણ ગણાય છે", "ਪਾਸੇ ਤੋਂ ਸਭ ਤੋਂ ਵਧੀਆ · ਸਾਹਮਣੇ ਤੋਂ ਵੀ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ", "پہلو سے بہترین · سامنے سے بھی گنتی ہوتی ہے",
  "De profil, c'est le mieux · de face, ça compte aussi", "Seitlich ist am besten · von vorn zählt es auch"],
 "Facing the camera is best · side-on also counts": [
  "सामने से सबसे अच्छा · बगल से भी गिनती होती है", "সামনে থেকে সবচেয়ে ভালো · পাশ থেকেও গোনা হয়", "समोरून सर्वोत्तम · बाजूनेही मोजले जाते",
  "ముందు నుంచి ఉత్తమం · పక్క నుంచీ లెక్కిస్తుంది", "முன்னாலிருந்து சிறந்தது · பக்கவாட்டிலும் எண்ணப்படும்",
  "De frente es mejor · de lado también cuenta", "De frente é melhor · de lado também conta", "Menghadap kamera paling baik · menyamping juga dihitung",
  "المواجهة هي الأفضل · الجانب يُحتسب أيضًا", "ಮುಂದಿನಿಂದ ಉತ್ತಮ · ಪಕ್ಕದಿಂದಲೂ ಎಣಿಸುತ್ತದೆ", "മുന്നിൽനിന്നാണ് ഏറ്റവും നല്ലത് · വശത്തുനിന്നും എണ്ണും",
  "સામેથી શ્રેષ્ઠ · બાજુથી પણ ગણાય છે", "ਸਾਹਮਣੇ ਤੋਂ ਸਭ ਤੋਂ ਵਧੀਆ · ਪਾਸੇ ਤੋਂ ਵੀ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ", "سامنے سے بہترین · پہلو سے بھی گنتی ہوتی ہے",
  "De face, c'est le mieux · de profil, ça compte aussi", "Von vorn ist am besten · seitlich zählt es auch"],
}

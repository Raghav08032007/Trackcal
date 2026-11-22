"""The voice coach's spoken encouragement and the coach voice picker (lib/workout-coach.ts, components/voice-picker.tsx).
Spoken aloud, so written the way a coach would say them. Draft: native review needed.
Columns: hi, bn, mr, te, ta, es, pt, id, ar, kn, ml, gu, pa, ur, fr, de."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar', 'kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "{n}, halfway there": ["{n}, आधा हो गया", "{n}, অর্ধেক হয়ে গেছে", "{n}, अर्धे झाले", "{n}, సగం అయిపోయింది", "{n}, பாதி முடிந்தது",
  "{n}, ya vas por la mitad", "{n}, já está na metade", "{n}, sudah setengah jalan", "{n}، وصلت إلى النصف", "{n}, ಅರ್ಧ ಮುಗಿಯಿತು",
  "{n}, പകുതിയായി", "{n}, અડધું થઈ ગયું", "{n}, ਅੱਧਾ ਹੋ ਗਿਆ", "{n}، آدھا ہو گیا", "{n}, tu es à mi-chemin", "{n}, die Hälfte ist geschafft"],
 "{n}, two more": ["{n}, बस दो और", "{n}, আর মাত্র দুটো", "{n}, फक्त दोन आणखी", "{n}, ఇంకా రెండే", "{n}, இன்னும் இரண்டு",
  "{n}, dos más", "{n}, mais duas", "{n}, dua lagi", "{n}، اثنتان فقط", "{n}, ಇನ್ನೂ ಎರಡು", "{n}, ഇനി രണ്ടെണ്ണം", "{n}, બસ બે વધુ",
  "{n}, ਬੱਸ ਦੋ ਹੋਰ", "{n}، بس دو اور", "{n}, encore deux", "{n}, noch zwei"],
 "{n}, last one": ["{n}, आख़िरी एक", "{n}, শেষটা বাকি", "{n}, शेवटचे एक", "{n}, ఇక చివరిది", "{n}, கடைசி ஒன்று",
  "{n}, la última", "{n}, a última", "{n}, satu lagi yang terakhir", "{n}، الأخيرة", "{n}, ಕೊನೆಯದು", "{n}, അവസാനത്തേത്", "{n}, છેલ્લું એક",
  "{n}, ਆਖ਼ਰੀ ਇੱਕ", "{n}، آخری ایک", "{n}, la dernière", "{n}, die letzte"],
 "Coach voice": ["कोच की आवाज़", "কোচের কণ্ঠ", "प्रशिक्षकाचा आवाज", "కోచ్ గొంతు", "பயிற்சியாளர் குரல்", "Voz del entrenador", "Voz do treinador",
  "Suara pelatih", "صوت المدرب", "ತರಬೇತುದಾರರ ಧ್ವನಿ", "പരിശീലകന്റെ ശബ്ദം", "કોચનો અવાજ", "ਕੋਚ ਦੀ ਅਵਾਜ਼", "کوچ کی آواز", "Voix du coach",
  "Stimme des Coachs"],
 "Automatic (most natural)": ["अपने आप (सबसे स्वाभाविक)", "স্বয়ংক্রিয় (সবচেয়ে স্বাভাবিক)", "आपोआप (सर्वात नैसर्गिक)", "ఆటోమేటిక్ (అత్యంత సహజమైనది)",
  "தானியங்கி (மிக இயல்பானது)", "Automática (la más natural)", "Automática (a mais natural)", "Otomatis (paling alami)", "تلقائي (الأكثر طبيعية)",
  "ಸ್ವಯಂಚಾಲಿತ (ಅತ್ಯಂತ ಸಹಜ)", "സ്വയമേവ (ഏറ്റവും സ്വാഭാവികം)", "આપમેળે (સૌથી સ્વાભાવિક)", "ਆਪਣੇ ਆਪ (ਸਭ ਤੋਂ ਕੁਦਰਤੀ)", "خودکار (سب سے فطری)",
  "Automatique (la plus naturelle)", "Automatisch (am natürlichsten)"],
 "Test voice": ["आवाज़ सुनें", "কণ্ঠ শুনুন", "आवाज ऐका", "గొంతు వినండి", "குரலைக் கேளுங்கள்", "Probar voz", "Testar voz", "Coba suara", "اختبر الصوت",
  "ಧ್ವನಿ ಕೇಳಿ", "ശബ്ദം കേൾക്കുക", "અવાજ સાંભળો", "ਅਵਾਜ਼ ਸੁਣੋ", "آواز سنیں", "Tester la voix", "Stimme testen"],
 "Let's go. Ready when you are.": ["चलिए शुरू करें। जब आप तैयार हों।", "চলুন শুরু করি। আপনি তৈরি হলেই।", "चला सुरू करूया. तुम्ही तयार असाल तेव्हा.",
  "మొదలుపెడదాం. మీరు సిద్ధమైనప్పుడు.", "ஆரம்பிக்கலாம். நீங்கள் தயாரானதும்.", "Vamos. Cuando estés listo.", "Vamos lá. Quando você estiver pronto.",
  "Ayo mulai. Kapan pun kamu siap.", "هيا بنا. عندما تكون جاهزًا.", "ಶುರು ಮಾಡೋಣ. ನೀವು ಸಿದ್ಧವಾದಾಗ.", "തുടങ്ങാം. നിങ്ങൾ തയ്യാറാകുമ്പോൾ.",
  "ચાલો શરૂ કરીએ. તમે તૈયાર હો ત્યારે.", "ਚੱਲੋ ਸ਼ੁਰੂ ਕਰੀਏ। ਜਦੋਂ ਤੁਸੀਂ ਤਿਆਰ ਹੋਵੋ।", "چلیں شروع کریں۔ جب آپ تیار ہوں۔", "C'est parti. Quand tu veux.",
  "Los geht’s. Wann immer du bereit bist."],
}

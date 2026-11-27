"""Framing guidance when the person is too close to the camera (lib/pose/analyzers.ts). Draft: native review needed.
Columns: hi, bn, mr, te, ta, es, pt, id, ar, kn, ml, gu, pa, ur, fr, de."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar', 'kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "Step back so I can see your head and hips.": [
  "थोड़ा पीछे हटें ताकि मैं आपका सिर और कूल्हे देख सकूँ।", "একটু পিছিয়ে যান, যাতে আমি আপনার মাথা আর কোমর দেখতে পাই।", "थोडे मागे सरका, म्हणजे मला तुमचे डोके आणि नितंब दिसतील.", "కొంచెం వెనక్కి జరగండి, నాకు మీ తల, తుంటి కనిపించాలి.", "சற்று பின்னால் நகருங்கள், உங்கள் தலையும் இடுப்பும் தெரிய வேண்டும்.", "Retrocede para que pueda ver tu cabeza y tus caderas.", "Afaste-se para eu ver sua cabeça e seus quadris.", "Mundur sedikit agar kepala dan pinggulmu terlihat.", "تراجع قليلًا حتى أرى رأسك ووركيك.", "ಸ್ವಲ್ಪ ಹಿಂದೆ ಸರಿಯಿರಿ, ನಿಮ್ಮ ತಲೆ ಮತ್ತು ಸೊಂಟ ಕಾಣಬೇಕು.", "അൽപ്പം പിന്നോട്ട് മാറൂ, നിങ്ങളുടെ തലയും ഇടുപ്പും കാണണം.", "થોડા પાછળ ખસો, જેથી મને તમારું માથું અને થાપા દેખાય.", "ਥੋੜ੍ਹਾ ਪਿੱਛੇ ਹਟੋ ਤਾਂ ਜੋ ਮੈਨੂੰ ਤੁਹਾਡਾ ਸਿਰ ਅਤੇ ਕੁੱਲ੍ਹੇ ਦਿਖਣ।", "تھوڑا پیچھے ہٹیں تاکہ مجھے آپ کا سر اور کولہے نظر آئیں۔", "Recule pour que je voie ta tête et tes hanches.", "Geh etwas zurück, damit ich Kopf und Hüfte sehe."],
 "Turn side-on to the camera.": ["कैमरे की ओर बगल से खड़े हों।", "ক্যামেরার দিকে পাশ ফিরে দাঁড়ান।", "कॅमेऱ्याकडे बाजूने उभे राहा.", "కెమెరాకు పక్కగా తిరగండి.", "கேமராவுக்குப் பக்கவாட்டில் திரும்புங்கள்.", "Ponte de lado a la cámara.", "Fique de lado para a câmera.", "Berdirilah menyamping ke kamera.", "قف بشكل جانبي أمام الكاميرا.", "ಕ್ಯಾಮೆರಾಗೆ ಪಕ್ಕವಾಗಿ ತಿರುಗಿ.", "ക്യാമറയ്ക്ക് വശംതിരിഞ്ഞ് നിൽക്കൂ.", "કેમેરા તરફ બાજુથી ઊભા રહો.", "ਕੈਮਰੇ ਵੱਲ ਪਾਸਾ ਕਰਕੇ ਖੜ੍ਹੇ ਹੋਵੋ।", "کیمرے کی طرف پہلو کر کے کھڑے ہوں۔", "Mets-toi de profil face à la caméra.", "Stell dich seitlich zur Kamera."],
}

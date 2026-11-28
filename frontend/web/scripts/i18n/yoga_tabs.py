"""Yoga page tab names (components/yoga-studio.tsx). Draft: native review needed.
Columns: hi, bn, mr, te, ta, es, pt, id, ar, kn, ml, gu, pa, ur, fr, de."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar', 'kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "Asanas": ["आसन", "আসন", "आसने", "ఆసనాలు", "ஆசனங்கள்", "Asanas", "Ásanas", "Asana", "الوضعيات", "ಆಸನಗಳು", "ആസനങ്ങൾ", "આસનો", "ਆਸਣ", "آسن", "Postures", "Asanas"],
 "Breathing": ["श्वास", "শ্বাস", "श्वास", "శ్వాస", "மூச்சு", "Respiración", "Respiração", "Pernapasan", "التنفس", "ಉಸಿರಾಟ", "ശ്വസനം", "શ્વાસ", "ਸਾਹ", "سانس", "Respiration", "Atmung"],
 "Folded this small, the camera can hardly see your body, so the score may stay low. It is a resting pose: rest as long as you like.": [
  "इतना सिमटकर कैमरा आपका शरीर मुश्किल से देख पाता है, इसलिए स्कोर कम रह सकता है। यह विश्राम का आसन है: जितनी देर चाहें आराम करें।",
  "এতটা গুটিয়ে থাকলে ক্যামেরা আপনার শরীর প্রায় দেখতে পায় না, তাই স্কোর কম থাকতে পারে। এটি বিশ্রামের আসন: যতক্ষণ চান বিশ্রাম নিন।",
  "इतके आकुंचित असताना कॅमेऱ्याला तुमचे शरीर क्वचितच दिसते, त्यामुळे गुण कमी राहू शकतात. हे विश्रांतीचे आसन आहे: हवा तितका वेळ विश्रांती घ्या.",
  "ఇంత ముడుచుకున్నప్పుడు కెమెరాకు మీ శరీరం అంతగా కనిపించదు, కాబట్టి స్కోర్ తక్కువగా ఉండవచ్చు. ఇది విశ్రాంతి ఆసనం: కావలసినంతసేపు విశ్రాంతి తీసుకోండి.",
  "இவ்வளவு சுருண்டிருக்கும்போது கேமராவால் உங்கள் உடலைச் சரியாகப் பார்க்க முடியாது, அதனால் மதிப்பெண் குறைவாக இருக்கலாம். இது ஓய்வு ஆசனம்: விரும்பும் வரை ஓய்வெடுங்கள்.",
  "Tan recogido, la cámara apenas ve tu cuerpo, así que la puntuación puede quedarse baja. Es una postura de descanso: descansa cuanto quieras.",
  "Tão encolhido, a câmera mal vê seu corpo, então a nota pode ficar baixa. É uma postura de descanso: descanse quanto quiser.",
  "Saat terlipat sekecil ini, kamera hampir tidak bisa melihat tubuhmu, jadi skornya bisa tetap rendah. Ini pose istirahat: istirahatlah selama yang kamu mau.",
  "عندما تنطوي بهذا الشكل بالكاد ترى الكاميرا جسمك، لذا قد تبقى الدرجة منخفضة. إنها وضعية راحة: استرح قدر ما تشاء.",
  "ಇಷ್ಟು ಮಡಚಿಕೊಂಡಾಗ ಕ್ಯಾಮೆರಾಗೆ ನಿಮ್ಮ ದೇಹ ಸರಿಯಾಗಿ ಕಾಣುವುದಿಲ್ಲ, ಹಾಗಾಗಿ ಅಂಕ ಕಡಿಮೆ ಇರಬಹುದು. ಇದು ವಿಶ್ರಾಂತಿ ಆಸನ: ಬೇಕಾದಷ್ಟು ಹೊತ್ತು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ.",
  "ഇത്ര ചുരുണ്ടിരിക്കുമ്പോൾ ക്യാമറയ്ക്ക് നിങ്ങളുടെ ശരീരം കാണാൻ പ്രയാസമാണ്, അതിനാൽ സ്കോർ കുറവായിരിക്കാം. ഇത് വിശ്രമ ആസനമാണ്: ഇഷ്ടമുള്ളത്ര വിശ്രമിക്കൂ.",
  "આટલા વળી જવાથી કૅમેરાને તમારું શરીર ભાગ્યે જ દેખાય છે, તેથી સ્કોર ઓછો રહી શકે. આ આરામનું આસન છે: જેટલો સમય ઇચ્છો આરામ કરો.",
  "ਇੰਨਾ ਸੁੰਗੜ ਕੇ ਕੈਮਰੇ ਨੂੰ ਤੁਹਾਡਾ ਸਰੀਰ ਮੁਸ਼ਕਲ ਨਾਲ ਦਿਸਦਾ ਹੈ, ਇਸ ਲਈ ਸਕੋਰ ਘੱਟ ਰਹਿ ਸਕਦਾ ਹੈ। ਇਹ ਆਰਾਮ ਦਾ ਆਸਣ ਹੈ: ਜਿੰਨੀ ਦੇਰ ਚਾਹੋ ਆਰਾਮ ਕਰੋ।",
  "اتنا سمٹ کر کیمرا آپ کا جسم مشکل سے دیکھ پاتا ہے، اس لیے اسکور کم رہ سکتا ہے۔ یہ آرام کا آسن ہے: جتنی دیر چاہیں آرام کریں۔",
  "Replié ainsi, la caméra voit à peine ton corps, donc le score peut rester bas. C’est une posture de repos : repose-toi aussi longtemps que tu veux.",
  "So klein zusammengefaltet sieht die Kamera deinen Körper kaum, daher kann die Bewertung niedrig bleiben. Es ist eine Ruhehaltung: ruh dich so lange aus, wie du magst."],
}

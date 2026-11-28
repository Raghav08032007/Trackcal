"""Muscle recovery map: readiness and recovery per muscle (components/recovery-map.tsx, lib/muscle-recovery.ts). Draft: native review needed.
Columns: hi, bn, mr, te, ta, es, pt, id, ar, kn, ml, gu, pa, ur, fr, de."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar', 'kn', 'ml', 'gu', 'pa', 'ur', 'fr', 'de']

T = {
 "FILLED IN BY YOUR TRAINING": ["आपकी ट्रेनिंग से भरा गया", "আপনার অনুশীলন থেকে পূরণ", "तुमच्या व्यायामातून भरलेले", "మీ వ్యాయామంతో నింపబడింది", "உங்கள் பயிற்சியால் நிரப்பப்பட்டது", "SEGÚN TU ENTRENAMIENTO", "PREENCHIDO PELO SEU TREINO", "DIISI DARI LATIHANMU", "يُملأ من تمارينك", "ನಿಮ್ಮ ವ್ಯಾಯಾಮದಿಂದ ತುಂಬಿದೆ", "നിങ്ങളുടെ പരിശീലനത്തിൽ നിന്ന്", "તમારી કસરતથી ભરાયેલું", "ਤੁਹਾਡੀ ਕਸਰਤ ਨਾਲ ਭਰਿਆ", "آپ کی ورزش سے بھرا گیا", "D’APRÈS TON ENTRAÎNEMENT", "AUS DEINEM TRAINING"],
 "How recovered each muscle is, from everything you save: camera workouts, sets you log, holds, yoga and runs. Harder sessions take longer to recover from.": [
  "हर मांसपेशी कितनी उबर चुकी है, आपकी सहेजी हर चीज़ से: कैमरा वर्कआउट, लिखे सेट, होल्ड, योग और दौड़। कठिन सत्रों से उबरने में ज़्यादा समय लगता है।",
  "প্রতিটি পেশি কতটা সেরে উঠেছে, আপনার সংরক্ষিত সবকিছু থেকে: ক্যামেরা ওয়ার্কআউট, লেখা সেট, হোল্ড, যোগ ও দৌড়। কঠিন সেশন থেকে সেরে উঠতে বেশি সময় লাগে।",
  "प्रत्येक स्नायू किती सावरला आहे, तुम्ही जतन केलेल्या सर्वांतून: कॅमेरा वर्कआउट, नोंदवलेले सेट, होल्ड, योग आणि धावणे. कठीण सत्रांतून सावरायला जास्त वेळ लागतो.",
  "ప్రతి కండరం ఎంత కోలుకుందో, మీరు సేవ్ చేసే అన్నిటి నుండి: కెమెరా వర్కౌట్‌లు, రాసిన సెట్‌లు, హోల్డ్‌లు, యోగా, పరుగు. కఠినమైన సెషన్‌ల నుండి కోలుకోవడానికి ఎక్కువ సమయం పడుతుంది.",
  "ஒவ்வொரு தசையும் எவ்வளவு மீண்டுள்ளது, நீங்கள் சேமிக்கும் எல்லாவற்றிலிருந்தும்: கேமரா பயிற்சிகள், பதிவு செய்த செட்கள், ஹோல்டுகள், யோகா, ஓட்டம். கடினமான அமர்வுகளிலிருந்து மீள அதிக நேரம் ஆகும்.",
  "Cuánto se ha recuperado cada músculo, según todo lo que guardas: entrenos con cámara, series que registras, posturas mantenidas, yoga y carreras. Las sesiones más duras tardan más en recuperarse.",
  "Quanto cada músculo já se recuperou, a partir de tudo o que você salva: treinos com câmera, séries registradas, isometrias, yoga e corridas. Sessões mais pesadas levam mais tempo para recuperar.",
  "Seberapa pulih setiap otot, dari semua yang kamu simpan: latihan kamera, set yang kamu catat, tahanan, yoga, dan lari. Sesi yang lebih berat butuh waktu pulih lebih lama.",
  "مدى تعافي كل عضلة، من كل ما تحفظه: تمارين الكاميرا والمجموعات التي تسجّلها والثبات واليوغا والجري. الجلسات الأصعب تحتاج وقتًا أطول للتعافي.",
  "ಪ್ರತಿ ಸ್ನಾಯು ಎಷ್ಟು ಚೇತರಿಸಿಕೊಂಡಿದೆ, ನೀವು ಉಳಿಸುವ ಎಲ್ಲದರಿಂದ: ಕ್ಯಾಮೆರಾ ವರ್ಕೌಟ್, ದಾಖಲಿಸಿದ ಸೆಟ್, ಹೋಲ್ಡ್, ಯೋಗ ಮತ್ತು ಓಟ. ಕಠಿಣ ಅವಧಿಗಳಿಂದ ಚೇತರಿಕೆಗೆ ಹೆಚ್ಚು ಸಮಯ ಬೇಕು.",
  "ഓരോ പേശിയും എത്ര വീണ്ടെടുത്തു, നിങ്ങൾ സേവ് ചെയ്യുന്ന എല്ലാറ്റിൽ നിന്നും: ക്യാമറ വർക്കൗട്ടുകൾ, രേഖപ്പെടുത്തിയ സെറ്റുകൾ, ഹോൾഡുകൾ, യോഗ, ഓട്ടം. കഠിനമായ സെഷനുകളിൽ നിന്ന് വീണ്ടെടുക്കാൻ കൂടുതൽ സമയം വേണം.",
  "દરેક સ્નાયુ કેટલો સાજો થયો છે, તમે સાચવો તે બધામાંથી: કૅમેરા વર્કઆઉટ, લખેલા સેટ, હોલ્ડ, યોગ અને દોડ. અઘરાં સત્રોમાંથી સાજા થવામાં વધુ સમય લાગે છે.",
  "ਹਰ ਪੱਠਾ ਕਿੰਨਾ ਠੀਕ ਹੋ ਚੁੱਕਾ ਹੈ, ਤੁਹਾਡੀ ਸੰਭਾਲੀ ਹਰ ਚੀਜ਼ ਤੋਂ: ਕੈਮਰਾ ਵਰਕਆਊਟ, ਲਿਖੇ ਸੈੱਟ, ਹੋਲਡ, ਯੋਗ ਅਤੇ ਦੌੜ। ਔਖੇ ਸੈਸ਼ਨਾਂ ਤੋਂ ਠੀਕ ਹੋਣ ਵਿੱਚ ਵੱਧ ਸਮਾਂ ਲੱਗਦਾ ਹੈ।",
  "ہر پٹھا کتنا بحال ہو چکا ہے، آپ کی محفوظ کی گئی ہر چیز سے: کیمرا ورزش، لکھے گئے سیٹ، ہولڈ، یوگا اور دوڑ۔ سخت سیشنز سے بحال ہونے میں زیادہ وقت لگتا ہے۔",
  "À quel point chaque muscle a récupéré, d’après tout ce que tu enregistres  séances caméra, séries notées, gainages, yoga et courses. Les séances plus dures demandent plus de récupération.",
  "Wie erholt jeder Muskel ist, aus allem, was du speicherst: Kamera-Workouts, eingetragene Sätze, Halteübungen, Yoga und Läufe. Härtere Einheiten brauchen länger zur Erholung."],
 "Readiness": ["तैयारी", "প্রস্তুতি", "तयारी", "సిద్ధత", "தயார்நிலை", "Preparación", "Prontidão", "Kesiapan", "الجاهزية", "ಸಿದ್ಧತೆ", "തയ്യാറെടുപ്പ്", "તૈયારી", "ਤਿਆਰੀ", "تیاری", "Forme", "Bereitschaft"],
 "Fresh: a good day for a hard session.": ["तरोताज़ा: कठिन सत्र के लिए अच्छा दिन।", "সতেজ: কঠিন সেশনের জন্য ভালো দিন।", "ताजेतवाने: कठीण सत्रासाठी चांगला दिवस.", "తాజాగా: కఠినమైన సెషన్‌కు మంచి రోజు.", "புத்துணர்வு: கடினமான அமர்வுக்கு நல்ல நாள்.", "Descansado: buen día para una sesión dura.", "Descansado: bom dia para um treino pesado.", "Segar: hari yang baik untuk sesi berat.", "منتعش: يوم مناسب لجلسة قوية.", "ತಾಜಾ: ಕಠಿಣ ಅವಧಿಗೆ ಒಳ್ಳೆಯ ದಿನ.", "ഉന്മേഷം: കഠിനമായ സെഷന് നല്ല ദിവസം.", "તાજગી: અઘરા સત્ર માટે સારો દિવસ.", "ਤਾਜ਼ਾ: ਔਖੇ ਸੈਸ਼ਨ ਲਈ ਚੰਗਾ ਦਿਨ।", "تازہ دم: سخت سیشن کے لیے اچھا دن۔", "En forme  bonne journée pour une séance intense.", "Frisch: ein guter Tag für eine harte Einheit."],
 "Partly recovered: train the fresh muscles, or go easy.": ["आंशिक रूप से उबरे: ताज़ी मांसपेशियों को ट्रेन करें, या हल्का रखें।", "আংশিক সেরে উঠেছে: সতেজ পেশিগুলো অনুশীলন করুন, বা হালকা রাখুন।", "अंशतः सावरले: ताज्या स्नायूंचा व्यायाम करा, किंवा हलके ठेवा.", "కొంత కోలుకున్నారు: తాజా కండరాలకు వ్యాయామం చేయండి, లేదా తేలికగా చేయండి.", "ஓரளவு மீண்டுள்ளது: புதிய தசைகளுக்குப் பயிற்சி செய்யுங்கள், அல்லது எளிதாகச் செய்யுங்கள்.", "Recuperado en parte: entrena los músculos frescos o hazlo suave.", "Parcialmente recuperado: treine os músculos descansados ou vá com calma.", "Pulih sebagian: latih otot yang segar, atau santai saja.", "متعافٍ جزئيًا: درّب العضلات المرتاحة، أو خفّف.", "ಭಾಗಶಃ ಚೇತರಿಸಿಕೊಂಡಿದೆ: ತಾಜಾ ಸ್ನಾಯುಗಳಿಗೆ ವ್ಯಾಯಾಮ ಮಾಡಿ, ಅಥವಾ ಹಗುರವಾಗಿ.", "ഭാഗികമായി വീണ്ടെടുത്തു: ഉന്മേഷമുള്ള പേശികൾക്ക് പരിശീലനം നൽകൂ, അല്ലെങ്കിൽ ലഘുവായി.", "અંશતઃ સાજા: તાજા સ્નાયુઓની કસરત કરો, અથવા હળવું રાખો.", "ਅੰਸ਼ਕ ਤੌਰ 'ਤੇ ਠੀਕ: ਤਾਜ਼ੇ ਪੱਠਿਆਂ ਦੀ ਕਸਰਤ ਕਰੋ, ਜਾਂ ਹਲਕਾ ਰੱਖੋ।", "جزوی طور پر بحال: تازہ پٹھوں کی ورزش کریں، یا ہلکا رکھیں۔", "En partie récupéré  travaille les muscles frais, ou vas-y doucement.", "Teilweise erholt: trainier die frischen Muskeln oder mach es ruhig."],
 "Tired: a light day, yoga or a walk would suit you.": ["थके हुए: हल्का दिन, योग या सैर आपके लिए ठीक रहेगा।", "ক্লান্ত: হালকা দিন, যোগ বা হাঁটা আপনার জন্য ভালো।", "थकलेले: हलका दिवस, योग किंवा चालणे तुम्हाला योग्य.", "అలసిపోయారు: తేలికైన రోజు, యోగా లేదా నడక మీకు సరిపోతాయి.", "சோர்வு: லேசான நாள், யோகா அல்லது நடை உங்களுக்கு ஏற்றது.", "Cansado: te vendría bien un día suave, yoga o un paseo.", "Cansado: um dia leve, yoga ou uma caminhada combinam com você.", "Lelah: hari ringan, yoga, atau jalan kaki cocok untukmu.", "متعب: يوم خفيف أو يوغا أو مشي يناسبك.", "ದಣಿದಿದ್ದೀರಿ: ಹಗುರ ದಿನ, ಯೋಗ ಅಥವಾ ನಡಿಗೆ ನಿಮಗೆ ಸೂಕ್ತ.", "ക്ഷീണം: ലഘുവായ ദിവസം, യോഗ അല്ലെങ്കിൽ നടത്തം നിങ്ങൾക്ക് യോജിക്കും.", "થાકેલા: હળવો દિવસ, યોગ કે ચાલવું તમને માફક આવશે.", "ਥੱਕੇ ਹੋਏ: ਹਲਕਾ ਦਿਨ, ਯੋਗ ਜਾਂ ਸੈਰ ਤੁਹਾਡੇ ਲਈ ਠੀਕ ਰਹੇਗੀ।", "تھکے ہوئے: ہلکا دن، یوگا یا چہل قدمی آپ کے لیے مناسب ہے۔", "Fatigué  une journée légère, du yoga ou une marche te conviendraient.", "Müde: ein leichter Tag, Yoga oder ein Spaziergang passen jetzt."],
 "ready in about {h} h": ["लगभग {h} घंटे में तैयार", "প্রায় {h} ঘণ্টায় প্রস্তুত", "सुमारे {h} तासांत तयार", "సుమారు {h} గంటల్లో సిద్ధం", "சுமார் {h} மணி நேரத்தில் தயார்", "lista en unas {h} h", "pronto em cerca de {h} h", "siap dalam sekitar {h} jam", "جاهزة خلال {h} ساعة تقريبًا", "ಸುಮಾರು {h} ಗಂಟೆಯಲ್ಲಿ ಸಿದ್ಧ", "ഏകദേശം {h} മണിക്കൂറിൽ തയ്യാർ", "લગભગ {h} કલાકમાં તૈયાર", "ਲਗਭਗ {h} ਘੰਟਿਆਂ ਵਿੱਚ ਤਿਆਰ", "تقریباً {h} گھنٹوں میں تیار", "prêt dans environ {h} h", "bereit in etwa {h} h"],
 "ready": ["तैयार", "প্রস্তুত", "तयार", "సిద్ధం", "தயார்", "lista", "pronto", "siap", "جاهزة", "ಸಿದ್ಧ", "തയ്യാർ", "તૈયાર", "ਤਿਆਰ", "تیار", "prêt", "bereit"],
 "Estimated from your saved training with common recovery times (48-72 hours). Go by how you feel.": [
  "आपकी सहेजी ट्रेनिंग और सामान्य उबरने के समय (48-72 घंटे) से अनुमानित। अपने महसूस करने के हिसाब से चलें।",
  "আপনার সংরক্ষিত অনুশীলন ও সাধারণ সেরে ওঠার সময় (৪৮-৭২ ঘণ্টা) থেকে অনুমান। নিজের অনুভূতি মেনে চলুন।",
  "तुमचा जतन केलेला व्यायाम आणि सामान्य सावरण्याचा वेळ (48-72 तास) यावरून अंदाज. तुम्हाला कसे वाटते त्यानुसार ठरवा.",
  "మీరు సేవ్ చేసిన వ్యాయామం, సాధారణ కోలుకునే సమయం (48-72 గంటలు) నుండి అంచనా. మీకు ఎలా అనిపిస్తుందో దాని ప్రకారం నడుచుకోండి.",
  "நீங்கள் சேமித்த பயிற்சி மற்றும் வழக்கமான மீட்பு நேரத்திலிருந்து (48-72 மணி நேரம்) மதிப்பிடப்பட்டது. உங்கள் உணர்வைப் பின்பற்றுங்கள்.",
  "Estimado a partir de tu entrenamiento guardado con tiempos de recuperación habituales (48-72 horas). Guíate por cómo te sientes.",
  "Estimado a partir do seu treino salvo com tempos de recuperação comuns (48-72 horas). Siga o que você sente.",
  "Diperkirakan dari latihan yang kamu simpan dengan waktu pemulihan umum (48-72 jam). Ikuti apa yang kamu rasakan.",
  "تقدير من تمارينك المحفوظة وأوقات التعافي الشائعة (48-72 ساعة). استمع إلى ما يشعر به جسمك.",
  "ನೀವು ಉಳಿಸಿದ ವ್ಯಾಯಾಮ ಮತ್ತು ಸಾಮಾನ್ಯ ಚೇತರಿಕೆ ಸಮಯದಿಂದ (48-72 ಗಂಟೆ) ಅಂದಾಜು. ನಿಮಗೆ ಹೇಗೆ ಅನಿಸುತ್ತದೋ ಹಾಗೆ ನಡೆಯಿರಿ.",
  "നിങ്ങൾ സേവ് ചെയ്ത പരിശീലനവും സാധാരണ വീണ്ടെടുക്കൽ സമയവും (48-72 മണിക്കൂർ) വച്ചുള്ള കണക്ക്. നിങ്ങൾക്ക് തോന്നുന്നതനുസരിച്ച് ചെയ്യൂ.",
  "તમારી સાચવેલી કસરત અને સામાન્ય સાજા થવાના સમય (48-72 કલાક)થી અંદાજ. તમને કેવું લાગે છે તે મુજબ ચાલો.",
  "ਤੁਹਾਡੀ ਸੰਭਾਲੀ ਕਸਰਤ ਅਤੇ ਆਮ ਠੀਕ ਹੋਣ ਦੇ ਸਮੇਂ (48-72 ਘੰਟੇ) ਤੋਂ ਅੰਦਾਜ਼ਾ। ਜਿਵੇਂ ਮਹਿਸੂਸ ਹੋਵੇ ਉਵੇਂ ਕਰੋ।",
  "آپ کی محفوظ ورزش اور عام بحالی کے وقت (48-72 گھنٹے) سے اندازہ۔ جیسا محسوس ہو ویسا کریں۔",
  "Estimé à partir de ton entraînement enregistré et des temps de récupération habituels (48-72 heures). Fie-toi à tes sensations.",
  "Geschätzt aus deinem gespeicherten Training und üblichen Erholungszeiten (48-72 Stunden). Hör auf dein Gefühl."],
}

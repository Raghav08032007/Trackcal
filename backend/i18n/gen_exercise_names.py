"""Run: backend/.venv/Scripts/python backend/i18n/gen_exercise_names.py, then build.py.
Writes backend/i18n/tables/exercise_names.py: the plan templates' names ("Camera X practice", "Camera X hold") built from the
exercise names the web app already translates, so an exercise is called the same on every screen."""
import json, re, sys
from pathlib import Path

B = Path(__file__).resolve().parents[1]; W = B.parent / 'frontend' / 'web' / 'src' / 'lib' / 'i18n' / 'messages'
sys.path.insert(0, str(B))
import services.personalization as P

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar']
WEB = {l: json.loads((W / f'{l}.json').read_text(encoding='utf-8')) for l in LANGS}
LOWER = {k.lower(): k for k in WEB['hi']}
PRACTICE = {'hi': 'कैमरा {x} अभ्यास', 'bn': 'ক্যামেরায় {x} অনুশীলন', 'mr': 'कॅमेरा {x} सराव', 'te': 'కెమెరా {x} సాధన', 'ta': 'கேமரா {x} பயிற்சி',
            'es': 'Práctica con cámara: {x}', 'pt': 'Prática com câmera: {x}', 'id': 'Latihan kamera: {x}', 'ar': 'تمرين بالكاميرا: {x}'}
HOLD = {'hi': 'कैमरा {x} होल्ड', 'bn': 'ক্যামেরায় {x} ধরে রাখা', 'mr': 'कॅमेरा {x} स्थिती', 'te': 'కెమెరా {x} హోల్డ్', 'ta': 'கேமரா {x} நிலைப்பு',
        'es': 'Aguante con cámara: {x}', 'pt': 'Sustentação com câmera: {x}', 'id': 'Tahan dengan kamera: {x}', 'ar': 'ثبات بالكاميرا: {x}'}
# Exercises the web app has no row for yet (hi, bn, mr, te, ta, es, pt, id, ar).
EXTRA = {
 'squat': ['स्क्वैट', 'স্কোয়াট', 'स्क्वॅट', 'స్క్వాట్', 'ஸ்குவாட்', 'Sentadilla', 'Agachamento', 'Squat', 'القرفصاء'],
 'floor push-up': ['ज़मीन पर पुश-अप', 'মেঝেতে পুশ-আপ', 'जमिनीवर पुश-अप', 'నేలపై పుష్-అప్', 'தரையில் புஷ்-அப்', 'Flexión en el suelo', 'Flexão no chão', 'Push-up di lantai', 'ضغط على الأرض'],
 'single-arm press': ['एक हाथ से प्रेस', 'এক হাতে প্রেস', 'एका हाताने प्रेस', 'ఒక చేతి ప్రెస్', 'ஒரு கை பிரஸ்', 'Press a una mano', 'Desenvolvimento com um braço', 'Press satu lengan', 'ضغط بذراع واحدة'],
 'floor sit-up': ['ज़मीन पर सिट-अप', 'মেঝেতে সিট-আপ', 'जमिनीवर सिट-अप', 'నేలపై సిట్-అప్', 'தரையில் சிட்-அப்', 'Abdominal en el suelo', 'Abdominal no chão', 'Sit-up di lantai', 'جلوس من الاستلقاء على الأرض'],
 'wall push-up': ['दीवार पुश-अप', 'দেয়ালে পুশ-আপ', 'भिंतीवर पुश-अप', 'గోడ పుష్-అప్', 'சுவர் புஷ்-அப்', 'Flexión en la pared', 'Flexão na parede', 'Push-up dinding', 'ضغط على الحائط'],
 'lunge': ['लंज', 'লাঞ্জ', 'लंज', 'లంజ్', 'லஞ்ச்', 'Zancada', 'Afundo', 'Lunge', 'الطعن'],
 'jumping jack': ['जंपिंग जैक', 'জাম্পিং জ্যাক', 'जंपिंग जॅक', 'జంపింగ్ జాక్', 'ஜம்பிங் ஜாக்', 'Saltos de tijera', 'Polichinelo', 'Jumping jack', 'القفز مع فتح الذراعين'],
 'side arm raise': ['बगल में हाथ उठाना', 'পাশে হাত তোলা', 'बाजूला हात उचलणे', 'పక్కకు చేతులు ఎత్తడం', 'பக்கவாட்டில் கை உயர்த்தல்', 'Elevación lateral de brazos', 'Elevação lateral dos braços', 'Angkat lengan ke samping', 'رفع الذراعين جانبًا'],
 'knee raise': ['घुटना उठाना', 'হাঁটু তোলা', 'गुडघा उचलणे', 'మోకాలు ఎత్తడం', 'முழங்கால் உயர்த்தல்', 'Elevación de rodilla', 'Elevação de joelho', 'Angkat lutut', 'رفع الركبة'],
 'single-arm curl': ['एक हाथ से कर्ल', 'এক হাতে কার্ল', 'एका हाताने कर्ल', 'ఒక చేతి కర్ల్', 'ஒரு கை கர்ல்', 'Curl a una mano', 'Rosca com um braço', 'Curl satu lengan', 'ثني بذراع واحدة'],
 'wall sit': ['दीवार के सहारे बैठना', 'দেয়ালে ঠেস দিয়ে বসা', 'भिंतीला टेकून बसणे', 'గోడకు ఆనుకుని కూర్చోవడం', 'சுவரில் சாய்ந்து அமர்தல்', 'Sentadilla isométrica en la pared', 'Cadeirinha na parede', 'Wall sit', 'الجلوس على الحائط'],
 'glute bridge': ['ग्लूट ब्रिज', 'গ্লুট ব্রিজ', 'ग्लूट ब्रिज', 'గ్లూట్ బ్రిడ్జ్', 'குளூட் பிரிட்ஜ்', 'Puente de glúteo', 'Ponte de glúteo', 'Glute bridge', 'جسر الأرداف'],
}

rows = {}
for t in P.TEMPLATES.values():
    m = re.match(r'Camera (.+?) (practice|hold)$', t['name'])
    if not m: continue
    x, kind = m.group(1), m.group(2)
    key = LOWER.get(x.lower())
    names = [WEB[l][key] for l in LANGS] if key else EXTRA[x]
    form = PRACTICE if kind == 'practice' else HOLD
    rows[t['name']] = [form[l].replace('{x}', n) for l, n in zip(LANGS, names)]

out = ['"""Server translations: the camera plan templates\' names, generated from the exercise names the web app translates',
       '(frontend/web/src/lib/i18n/messages), so an exercise has one name on every screen. Regenerate with gen_exercise_names.py.',
       'Draft: native review needed. Columns: hi, bn, mr, te, ta, es, pt, id, ar."""', '', f'LANGS = {LANGS!r}', '', 'T = {']
for k, v in rows.items():
    out.append(f' {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},')
out.append('}')
(B / 'i18n' / 'tables' / 'exercise_names.py').write_text('\n'.join(out) + '\n', encoding='utf-8')
print(len(rows), 'names')

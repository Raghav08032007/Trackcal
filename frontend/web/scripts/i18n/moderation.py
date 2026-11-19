"""Wave-1 translations: the moderation screen's flagged challenge entries and item labels. Draft: native review needed.
Columns: hi, bn, mr, te, ta, es, pt, id, ar."""

LANGS = ['hi', 'bn', 'mr', 'te', 'ta', 'es', 'pt', 'id', 'ar']

T = {
 "Comment": ["टिप्पणी", "মন্তব্য", "टिप्पणी", "వ్యాఖ్య", "கருத்து", "Comentario", "Comentário", "Komentar", "تعليق"],
 "Profile": ["प्रोफ़ाइल", "প্রোফাইল", "प्रोफाइल", "ప్రొఫైల్", "சுயவிவரம்", "Perfil", "Perfil", "Profil", "الملف الشخصي"],
 "Event": ["इवेंट", "ইভেন্ট", "कार्यक्रम", "ఈవెంట్", "நிகழ்வு", "Evento", "Evento", "Acara", "فعالية"],
 "Challenge": ["चुनौती", "চ্যালেঞ্জ", "आव्हान", "సవాలు", "சவால்", "Reto", "Desafio", "Tantangan", "تحدٍّ"],
 "Flagged challenge entries": ["चिह्नित चुनौती प्रविष्टियाँ", "চিহ্নিত চ্যালেঞ্জ এন্ট্রি", "चिन्हांकित आव्हान नोंदी", "గుర్తించిన సవాలు నమోదులు", "குறிக்கப்பட்ட சவால் பதிவுகள்", "Participaciones marcadas en retos", "Participações sinalizadas em desafios", "Entri tantangan yang ditandai", "مشاركات التحديات المعلَّمة"],
 "A counted camera workout in these entries was corrected by a large amount. Nobody else sees the flag. Clear it if the correction looks honest, or remove the entry from the challenge. XP already earned is never taken back.": [
  "इन प्रविष्टियों में गिने गए कैमरा वर्कआउट में बड़ा सुधार किया गया। यह निशान कोई और नहीं देखता। सुधार ईमानदार लगे तो निशान हटाएँ, या प्रविष्टि को चुनौती से हटाएँ। कमाया XP कभी वापस नहीं लिया जाता।",
  "এই এন্ট্রিগুলোতে গোনা ক্যামেরা ওয়ার্কআউট অনেকটা সংশোধন করা হয়েছে। এই চিহ্ন আর কেউ দেখেন না। সংশোধন সৎ মনে হলে চিহ্ন সরান, বা এন্ট্রিটি চ্যালেঞ্জ থেকে সরান। অর্জিত XP কখনো ফেরত নেওয়া হয় না।",
  "या नोंदींमधील मोजलेला कॅमेरा व्यायाम मोठ्या प्रमाणात दुरुस्त केला आहे. ही खूण इतर कोणी पाहत नाही. दुरुस्ती प्रामाणिक वाटल्यास खूण काढा, किंवा नोंद आव्हानातून काढा. मिळवलेले XP कधीही परत घेतले जात नाही.",
  "ఈ నమోదులలో లెక్కించిన కెమెరా వ్యాయామాన్ని ఎక్కువగా సవరించారు. ఈ గుర్తు ఇంకెవరికీ కనిపించదు. సవరణ నిజాయితీగా అనిపిస్తే గుర్తు తీసేయండి, లేదా నమోదును సవాలు నుండి తీసివేయండి. సంపాదించిన XP ఎప్పుడూ తిరిగి తీసుకోము.",
  "இந்தப் பதிவுகளில் எண்ணிய கேமரா பயிற்சி பெரிதும் திருத்தப்பட்டது. இந்தக் குறியை வேறு யாரும் பார்ப்பதில்லை. திருத்தம் நேர்மையாகத் தோன்றினால் குறியை நீக்குங்கள், அல்லது பதிவைச் சவாலிலிருந்து நீக்குங்கள். பெற்ற XP ஒருபோதும் திரும்பப் பெறப்படாது.",
  "En estas participaciones se corrigió mucho un entrenamiento con cámara contado. Nadie más ve la marca. Quítala si la corrección parece honesta o saca la participación del reto. El XP ya ganado nunca se retira.",
  "Nestas participações, um treino com câmera contado foi muito corrigido. Ninguém mais vê a sinalização. Remova-a se a correção parecer honesta ou tire a participação do desafio. O XP já ganho nunca é retirado.",
  "Dalam entri ini, latihan kamera yang dihitung banyak dikoreksi. Tidak ada orang lain yang melihat tanda ini. Hapus tandanya jika koreksi tampak jujur, atau keluarkan entri dari tantangan. XP yang sudah didapat tidak pernah diambil kembali.",
  "صُحّح في هذه المشاركات تمرين كاميرا محتسب بقدر كبير. لا يرى أحد آخر هذه العلامة. أزلها إن بدا التصحيح صادقًا، أو أخرج المشاركة من التحدي. لا يُسترد XP المكتسب أبدًا."],
 "No flagged entries.": ["कोई चिह्नित प्रविष्टि नहीं।", "কোনো চিহ্নিত এন্ট্রি নেই।", "कोणतीही चिन्हांकित नोंद नाही.", "గుర్తించిన నమోదులు లేవు.", "குறிக்கப்பட்ட பதிவுகள் இல்லை.", "No hay participaciones marcadas.", "Nenhuma participação sinalizada.", "Tidak ada entri yang ditandai.", "لا مشاركات معلَّمة."],
 "No feed profile": ["फ़ीड प्रोफ़ाइल नहीं", "ফিড প্রোফাইল নেই", "फीड प्रोफाइल नाही", "ఫీడ్ ప్రొఫైల్ లేదు", "ஊட்டச் சுயவிவரம் இல்லை", "Sin perfil en el feed", "Sem perfil no feed", "Tanpa profil linimasa", "بلا ملف في الموجز"],
 "Joined {date}": ["{date} को जुड़े", "{date}-এ যোগ দিয়েছেন", "{date} रोजी सामील", "{date}న చేరారు", "{date} அன்று சேர்ந்தார்", "Se unió el {date}", "Entrou em {date}", "Bergabung {date}", "انضم في {date}"],
 "Clear the flag": ["निशान हटाएँ", "চিহ্ন সরান", "खूण काढा", "గుర్తు తీసేయండి", "குறியை நீக்கு", "Quitar la marca", "Remover a sinalização", "Hapus tanda", "أزل العلامة"],
 "Remove from the challenge": ["चुनौती से हटाएँ", "চ্যালেঞ্জ থেকে সরান", "आव्हानातून काढा", "సవాలు నుండి తీసివేయండి", "சவாலிலிருந்து நீக்கு", "Sacar del reto", "Tirar do desafio", "Keluarkan dari tantangan", "أخرِج من التحدي"],
}

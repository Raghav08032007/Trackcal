"""Phase 3f, French: muscle finder, GPS tracker, weekly effort page and posture hints (components/muscle-finder.tsx,
gps-tracker.tsx, app/weekly/page.tsx, lib/pose/posture-match.ts), in the order of coach/phase3f_keys.json.
Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3f_keys', 'fr', [
 # 0
 "Ouverture du choix des muscles…", "Entraîne les muscles que tu choisis.",
 "Connecte-toi, touche un muscle et reçois des exercices pour lui.", "S'ENTRAÎNER PAR MUSCLE", "Quels muscles aujourd'hui ?",
 # 5
 "Choisis un groupe pour un plan tout prêt, ou touche les muscles sur le corps. Chaque exercice montre comment le faire.",
 "Choisis un groupe", "Suggéré aujourd'hui :", "Montrer", "Aujourd'hui, c'est un",
 # 10
 "jour de repos", "dans le plan de la semaine.", "Étirements doux", "Groupes musculaires", "Mobilité et équilibre",
 # 15
 "Étirements et postures", "Plan {label} mélangé", "Plan {label} du jour", "Niveau du plan", "Tenir {seconds} s",
 # 20
 "Commencer", "Mélanger", "Revenir au plan du jour", "{target} répétitions · {n}", "Pour finir : {title}",
 # 25
 "Tenir {n} s", "Commencer {length} exercices avec la caméra", "Aucun exercice ne convient. Essaie n'importe quel matériel ci-dessous.",
 "Écartés pour te protéger : {n}. Tu peux quand même les choisir ci-dessous ; on t'expliquera pourquoi d'abord.",
 "Les plans débutant ont {easy} exercices, intermédiaire {medium} et avancé {hard}. Le plan du jour reste le même toute la journée. La caméra compte sur cet appareil et rien n'en sort.",
 # 30
 "Ou choisis des muscles", "Devant", "Muscles", "Effacer", "Tous",
 # 35
 "Débutant (facile seulement)", "Jusqu'à moyen", "Jusqu'à difficile",
 "Choisis un groupe ci-dessus, ou touche le corps, et je te montrerai comment faire chaque exercice.",
 "Rien ne correspond à ces filtres. Essaie n'importe quel matériel ou un niveau plus élevé.",
 # 40
 "{length} exercices pour {n}", "Ne te convient pas", "Prudence", "Cible principale", "Posture tenue",
 # 45
 "Travaille {n}", "Suivre avec la caméra", "Masquer la 3D", "Voir en 3D", "Noter moi-même",
 # 50
 "Ajouter à ma séance", "compte sur cet appareil ; aucune vidéo n'en sort.", "enregistre les séries que tu saisis, sans caméra.",
 "Ta séance", "Tout suivre avec la caméra",
 # 55
 "{title} enregistré, +{saved} points. Bien joué !", "{title} enregistré. Bien joué !", "Séries", "Secondes chacune",
 "Répétitions chacune",
 # 60
 "Minutes", "Ouverture du GPS…", "Marche, course, randonnée ou vélo, suivis.",
 "Connecte-toi pour enregistrer ton parcours, tes temps intermédiaires et tes records.",
 "Cet appareil n'a pas de GPS dans le navigateur.",
 # 65
 "{count} kilomètres. {pace}", "La localisation est désactivée. Autorise-la dans les réglages du navigateur pour enregistrer.",
 "En attente du signal GPS. Sors pour mieux voir le ciel.", "Nouveau record personnel : {label}.",
 "{message} Ton enregistrement est conservé sur cet appareil.",
 # 70
 "Échec de l'enregistrement. Ton parcours est conservé sur cet appareil ; réessaie.", "Fort", "Moyen", "Faible", "PLEIN AIR",
 # 75
 "Enregistrer une activité",
 "Parcours, temps intermédiaires, dénivelé et records grâce au GPS de ton téléphone. Garde cette page ouverte pendant que tu bouges. Les activités restent privées jusqu'à ce que tu les partages.",
 "Un(e) {n} non enregistré(e) est sur cet appareil", "{n} enregistré(e) · {length} points GPS.", "L'enregistrer",
 # 80
 "Supprimer", "Sport", "temps", "GPS", "· environ",
 # 85
 ". Les points aussi imprécis sont ignorés jusqu'à ce que le signal s'améliore.", "Annoncer chaque kilomètre", "Nom",
 "Laisser vide pour « {sport} du matin »", "Qui peut le voir",
 # 90
 "Commencer : {n}", "Terminer", "Reprendre", "Mesure de ton parcours…", "Enregistrer : {n}",
 # 95
 "Enregistre au moins 30 secondes en extérieur pour sauvegarder une activité.", "en mouvement", "vitesse moy.", "allure moy.",
 "Nouveaux records personnels",
 # 100
 "+{xp} points", "Voir les temps et la carte", "En enregistrer une autre", "Tes activités, records et zones privées →",
 "Moyenne de {n} kilomètres à l'heure.",
 # 105
 "Allure moyenne de {m} minutes {sec} secondes au kilomètre.", "en {time}, {faster} plus vite qu'avant", "en {time} (ton premier)",
 "{km} km à vélo", "{km} km parcourus",
 # 110
 "{n} m de dénivelé", "TrackCal — Tes semaines", "Impossible de charger tes semaines.", "Chargement…",
 "Connecte-toi pour voir ton résumé de la semaine.",
 # 115
 "Chargement de tes semaines…", "BOUGER · TES SEMAINES", "Tes", "semaines",
 "Chaque marche, course, sortie à vélo et séance, transformée en une seule mesure d'effort pour comparer équitablement les semaines.",
 # 120
 "Cette semaine", "MET-min", "Bienfaits en plus", "Recommandation atteinte", "En progression",
 # 125
 "Forme de fond",
 "Ton effort quotidien moyen sur 6 semaines. La fatigue (semaine dernière) est de {fatigue} ; la forme est de {form}, tu portes donc un peu de fatigue.",
 "Ton effort quotidien moyen sur 6 semaines. La fatigue (semaine dernière) est de {fatigue} ; la forme est de {form}, tu es donc frais.",
 "Ton effort quotidien moyen sur 6 semaines. La fatigue (semaine dernière) est de {fatigue} ; la forme est de {form}.",
 "× ton habitude",
 # 130
 "Effort par semaine", "Afficher le graphique", "Afficher le tableau",
 "Effort en MET-minutes sur les {length} dernières semaines. Cette semaine : {met_minutes}. La recommandation de l'OMS est de {minimum} à {more}.",
 "Semaine du {n} : {met_minutes} MET-minutes, {minutes} minutes, {active_days} jours actifs",
 # 135
 "Minimum OMS", "Plus de bienfaits", "Semaine du {n}", "{met} MET-minutes · {minutes} min · {count} jours actifs", "{n} km au GPS",
 # 140
 "Semaine du", "MET-minutes", "km GPS", "Forme de fond et fatigue", "Forme de fond (6 semaines)",
 # 145
 "Fatigue (1 semaine)", "Forme de fond {n} et fatigue {n2} aujourd'hui, sur les {length} derniers jours.", "Fatigue",
 "Forme de fond {n} · Fatigue {n2}", "Ce jour-là : {n} MET-minutes",
 # 150
 "La forme de fond monte lentement avec un entraînement régulier ; la fatigue monte et descend vite. Quand la fatigue dépasse nettement la forme, une journée plus facile t'aide à assimiler le travail.",
 "Tu le recevras le lundi matin.", "Enregistré. Vérifie ton adresse e-mail dans Compte pour commencer à le recevoir.", "Désactivé.",
 "Impossible d'enregistrer. Réessaie.",
 # 155
 "E-mail de la semaine", "M'envoyer ce résumé chaque lundi",
 "Les totaux et la tendance de la semaine passée, envoyés vers 9 h à ton heure. Seulement des totaux : rien sur l'alimentation, le poids ou la santé.",
 "Tiens-toi bien droit, comme l'exemple.", "Tiens-toi droit, dos allongé",
 # 160
 "Garde ton corps bien aligné, comme l'exemple.", "Garde les hanches alignées, comme l'exemple.", "Corps bien aligné",
 "Hanches alignées", "Garde les jambes tendues.",
 # 165
 "Jambes tendues", "Garde les bras tendus.", "Plie les genoux à angle droit environ", "Plie le genou avant du pas à angle droit environ",
 "Plie le genou avant à angle droit environ",
 # 170
 "Monte les hanches jusqu'à aligner ton corps", "Bascule depuis les hanches, dos plat", "Bascule, puis balance jusqu'à hauteur de poitrine",
 "Bascule, puis monte jusqu'au-dessus de la tête", "Plie les coudes pour descendre la tête",
 # 175
 "Tends un bras et la jambe opposée", "Lève une jambe derrière toi", "Penche-toi sur le côté, puis redresse-toi",
 "Décolle la poitrine et les jambes du sol", "Frappe droit devant à hauteur d'épaule",
 # 180
 "Lève les jambes à angle droit environ", "Lève les jambes à mi-hauteur environ", "Lève un peu les jambes",
 "Enroule le buste à angle droit environ", "Enroule le buste à mi-hauteur environ",
 # 185
 "Enroule un peu le buste", "Bascule depuis les hanches à angle droit environ", "Bascule depuis les hanches à mi-chemin environ",
 "Bascule un peu depuis les hanches", "Plie les genoux à mi-chemin environ",
 # 190
 "Plie un peu les genoux", "Plie les coudes à angle droit environ", "Plie les coudes à mi-chemin environ", "Plie un peu les coudes",
 "Lève les bras au-dessus de la tête",
 # 195
 "Lève les bras à hauteur d'épaule", "Monte les genoux à hauteur de hanche environ", "Pieds à largeur d'épaules environ",
 "Genoux au-dessus des orteils", "Coudes près du corps",
 # 200
 "Genou avant au-dessus de la cheville",
])

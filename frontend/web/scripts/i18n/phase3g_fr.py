"""Phase 3g, French: holds, camera sports, workout builder and activities (lib/pose/holds.ts, components/hold-studio.tsx,
lib/sport-game.ts, components/circuit-builder.tsx, app/activities/page.tsx), in the order of coach/phase3g_keys.json.
Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3g_keys', 'fr', [
 # 0
 "Équilibre", "Mobilité et souplesse", "Planche", "Abdos, épaules, fessiers", "De profil, tout le corps visible.",
 # 5
 "Une ligne droite de la tête aux talons", "Chaise contre le mur ou squat tenu", "De profil, dos contre un mur ou sans appui.",
 "Cuisses à l'horizontale, genoux au-dessus des chevilles", "Pont fessier tenu",
 # 10
 "Fessiers, ischio-jambiers, bas du dos", "Allongé de profil, genoux pliés, pieds à plat.", "Serre les fessiers et garde les hanches hautes",
 "Posture de l'arbre", "Chevilles, hanches, gainage",
 # 15
 "Face à la caméra, tout le corps visible.", "Pied contre l'intérieur de la jambe, mains au-dessus de la tête",
 "Équilibre sur une jambe", "De profil ou face à la caméra.", "Lève une jambe et reste bien droit",
 # 20
 "Guerrier II", "Hanches, jambes, épaules", "Face à la caméra, avec de la place pour écarter les pieds.",
 "Genou avant plié, bras grands ouverts", "Chien tête en bas",
 # 25
 "Ischio-jambiers, mollets, épaules", "De profil, mains et pieds au sol.", "Hanches hautes, talons vers le sol",
 "Flexion avant debout", "Ischio-jambiers, bas du dos",
 # 30
 "De profil, tout le corps visible.", "Plie-toi depuis les hanches, laisse la tête pendre", "Ouverture des postures…",
 "Tiens la position, et ça compte.", "Connecte-toi pour chronométrer gainage, équilibre et étirements avec ta caméra.",
 # 35
 "{count} secondes", "Objectif atteint. Belle tenue.", "Caméra indisponible.", "GAINAGE · ÉQUILIBRE · SOUPLESSE",
 "Mets-toi en position et la caméra te chronomètre. Seul le temps vraiment en position compte. Ce n'est pas un contrôle de technique ni de sécurité : arrête si quelque chose fait mal.",
 # 40
 "Installation :", "Aperçu caméra de la posture en direct", "{n} sur {target} secondes", "Recule pour que tout ton corps soit visible.",
 "Objectif atteint. Tiens encore si tu peux, ou repose-toi.",
 # 45
 "Tu tiens. {cue}.", "Mets-toi en position : {n}.", "Démarrage de la caméra…", "Objectif", "{value} secondes",
 # 50
 "Compter à voix haute", "Arrêter", "Meilleure tenue : {n} s", "{n} s en position au total.",
 "Les postures de {MIN_SAVE_S} secondes ou plus peuvent être enregistrées. Réessaie quand tu es prêt.",
 # 55
 "Enregistrer la posture", "{count} secondes de {hold} enregistrées, +{earned} points. Bien stable !",
 "{count} secondes de {hold} enregistrées. Bien stable !", "Faire une autre posture",
 "La vidéo reste sur ton appareil. Seul le temps tenu est enregistré.",
 # 60
 "Corde à sauter", "saut", "sauts", "Avec ou sans corde : petits sauts, pieds joints.",
 "Face à la caméra, à 2–3 m, tout le corps visible de la tête aux pieds.",
 # 65
 "Genoux souples", "Saut à pieds joints", "Atterris en douceur", "Boxe dans le vide", "coup",
 # 70
 "coups", "Direct et cross depuis la garde. Chaque poing revient au menton.",
 "De profil, à 2–3 m, les deux bras et les hanches visibles.", "Direct", "Cross",
 # 75
 "Drive au cricket", "drive", "drives", "Pas besoin de batte : mains jointes, monte en arrière, puis frappe vers le bas dans l'axe.",
 "Face à la caméra, à 2–3 m, avec de la place au-dessus de la tête et les deux mains visibles.",
 # 80
 "Position", "Armé", "Frappe", "Accompagnement", "Smash au badminton",
 # 85
 "smash", "smashs", "Main de la raquette derrière la tête, l'autre bras levé, puis smashe vers le bas et vers l'avant.",
 "De profil, à 2–3 m, avec de la place au-dessus de la tête et les deux bras visibles.", "Prêt",
 # 90
 "Raquette en arrière", "Contact en haut", "Smash vers le bas", "{n} · {rest} s de repos", "Utiliser {name}",
 # 95
 "Supprimer {name}", "Créateur de séance",
 "Enchaîne plusieurs exercices. Atteins chaque objectif et la caméra passe au suivant toute seule après un repos.",
 "Ajouter un exercice", "Répétitions pour cet exercice",
 # 100
 "Ajouter à la séance", "{target} répétitions", "Retirer l'étape {n}", "Repos entre les exercices (secondes)", "Enregistrer la séance",
 # 105
 "Crée-moi une séance", "Crée-m'en une", "Muscles à travailler", "Durée", "{m} minutes",
 # 110
 "Créer ma séance", "Changer {title}", "Changer", "Commencer cette séance", "Rien ne correspond. Essaie plus de muscles ou un autre matériel.",
 # 115
 "TrackCal — Activités", "Chargement des activités…", "Connecte-toi pour voir tes parcours, temps intermédiaires et records.",
 "Impossible de charger les activités.", "TES ACTIVITÉS",
 # 120
 "Chaque parcours, mesuré.",
 "Distance, temps en mouvement, temps intermédiaires et dénivelé sont calculés sur notre serveur à partir de tes points GPS, de la même façon pour chaque téléphone.",
 "7 derniers jours", "activités", "m de dénivelé",
 # 125
 "Activités", "Pas encore d'activité", "Enregistre une marche, une course, une randonnée ou une sortie à vélo et elle apparaît ici avec sa carte et ses temps.",
 "Public", "Abonnés",
 # 130
 "Distance", "Vitesse", "Allure", "Dénivelé", "Voir plus ancien",
 # 135
 "{n} records", "Le plus long", "Le plus gros dénivelé", "Recherche de ta position…", "Lieu privé",
 # 140
 "Ajouté. Les parcours que tu partages cachent désormais {radius} m autour de cet endroit.", "Impossible d'ajouter la zone.",
 "La localisation est désactivée, la zone n'a donc pas pu être placée.", "Impossible de supprimer la zone.", "Zones privées",
 # 145
 "Les parcours partagés cachent toujours 200 m au départ et à l'arrivée. Ajoute une zone pour des lieux comme la maison ou le travail, et tout parcours partagé la cachera aussi. Toi, tu vois toujours ton parcours complet.",
 "Taille", "Ajouter l'endroit où je suis",
])

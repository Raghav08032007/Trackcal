"""Phase 3c, French: the camera workout screen (components/camera-workout.tsx), in the order of coach/phase3c_keys.json.
Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3c_keys', 'fr', [
 # 0
 "Ouverture des séances caméra…", "Bouge, à ton rythme.",
 "Connecte-toi pour des séances privées guidées par la caméra. Ta caméra reste éteinte jusqu'à ce que tu choisisses de commencer.",
 "Séances manuelles →", "L'historique du compte est indisponible. Tu peux vérifier en local ; réessaie avant d'enregistrer.",
 # 5
 "Je ne vois pas bien le mouvement. Essaie d'ajuster la caméra.", "Le suivi est actif. Tu peux faire une pause quand tu veux.",
 "Caméra indisponible. Utilise les séances manuelles.",
 "Série enregistrée en local. Repose-toi autant que nécessaire, puis relance la caméra.",
 "Caméra éteinte. Vérifie et confirme ta séance avant d'enregistrer.",
 # 10
 "Caméra éteinte. Vérifie et confirme tes estimations avant d'enregistrer.", "Nouveau record : {n} {exercise} ! {cheer}",
 "Enregistrement des résultats confirmés…", "Ton activité est enregistrée !",
 "Échec de l'enregistrement. Ton brouillon de vérification est conservé.",
 # 15
 "Enregistrement de ta séance…", "Ta séance est enregistrée !",
 "Échec de l'enregistrement. Les exercices pas encore enregistrés restent ici ; réessaie.",
 "Séance abandonnée. Aucun XP attribué.",
 "Le serveur a déjà enregistré cette séance. Ton historique est disponible sans la renvoyer.",
 # 20
 "Brouillon abandonné. Aucun XP attribué.",
 "Impossible d'effacer la séance incomplète. Ta vérification est conservée ; réessaie.",
 "Ta séance musculaire", "{name} est prête. Active la caméra pour commencer.",
 "Séance terminée. Vérifie et confirme avant d'enregistrer.",
 # 25
 "Séance terminée. Bien joué.", "Repos {rest} secondes. Ensuite : {title}", "Commencer {title}",
 "Tes répétitions ont ralenti de {slowed} %. C'est un bon moment pour t'arrêter si c'est dur.",
 "Tu ralentis. Arrête-toi si c'est dur.",
 # 30
 "Objectif atteint. Les répétitions en plus comptent aussi.", "Objectif atteint", "Démarrage du suivi…",
 "Retirer une répétition", "Ajouter une répétition",
 # 35
 "PRIVÉ · SUR L'APPAREIL · À TON RYTHME", "Fais de la place pour bouger.",
 "Comptage assisté par caméra pour des exercices connus. Des estimations, pas une évaluation de la technique ni de la sécurité médicale.",
 "Ouvrir les séances manuelles →", "Un brouillon de vérification t'attend",
 # 40
 "Seuls les résumés de comptage sont stockés en local dans cet espace de compte. Aucune image ni point du corps.",
 "Restaurer la vérification caméra", "Supprimer le brouillon enregistré", "Notes de technique de cette série",
 "Conseils basés sur la position de ton corps. Des indices utiles, pas un contrôle de sécurité.",
 # 45
 "Vérifie ta technique", "Ta série enregistrée",
 "Regarde comment tu as bougé. La vidéo sert seulement à vérifier ta posture : ton journal garde les chiffres, pas la vidéo. Elle reste dans ce navigateur et disparaît quand tu quittes la page.",
 "Garder une copie sur cet appareil", "Enregistre les vidéos avec Premium",
 # 50
 "Supprimer la vidéo", "Une séance attend d'être enregistrée", "Vérifier la séance", "Vérifie ta séance",
 "Caméra éteinte. Tu peux modifier chaque compte. Les exercices de moins d'une minute sont enregistrés comme une minute.",
 # 55
 "Estimation caméra : {estimated_reps} répétitions", "Répétitions confirmées pour {title}", "Confirmer et enregistrer",
 "Abandonner la séance", "Vérifie ton mouvement",
 # 60
 "Caméra éteinte · {title}. Tu peux modifier chaque compte. La confiance décrit la visibilité du suivi, jamais la qualité de l'exercice.",
 "Série {n}", "Estimation caméra conservée", "Répétitions corrigées par toi",
 "{n} % de confiance moyenne des points · {frames} images analysées",
 # 65
 "Répétitions confirmées pour la série {n}", "Minutes de séance enregistrées",
 "Temps actif devant la caméra : {n} min {n2} s. Une série de moins d'une minute est enregistrée comme une minute. Tu peux le modifier.",
 "Supprimer la vérification caméra", "Séance terminée",
 # 70
 "répétitions", "points", "jours d'affilée",
 "+{addedBack} kcal ajoutées au budget alimentaire du jour, la moitié de ce que les répétitions ont brûlé environ.",
 "Les points d'entraînement du jour sont déjà gagnés. Ta série est sauve, reviens demain.",
 # 75
 "Ton historique privé garde estimations et corrections séparément. Récupération et pauses sont les bienvenues.",
 "Voir la séance enregistrée →", "Voir les succès →", "● Caméra active — chargement du modèle local…",
 "● Caméra active — en local uniquement",
 # 80
 "En attente de l'autorisation de la caméra…", "Caméra éteinte", "Arrêter la caméra",
 "Aperçu caméra de la séance en direct", "Objectif atteint · +{extra} en plus. {coach}",
 # 85
 "Objectif atteint. {coach}", "Suis le mouvement", "Préparation de ta vue privée", "Ton espace. Ton rythme.",
 "Chargement du modèle local. Tu peux arrêter à tout moment.",
 # 90
 "Aucun accès à la caméra tant que tu ne choisis pas Activer la caméra.", "Comptage en pause : {message}",
 "Repos {resting} s · Ensuite : {title}", "Passer le repos", "{name} · exercice {n} sur {length}",
 # 95
 "Mode basse performance · {fps} i/s", "Le retour sur le mouvement est désactivé.",
 "{count} répétitions estimées · série {n}", "{n}:{n2} · {n3} % de confiance", "Mettre le suivi caméra en pause",
 # 100
 "Reprendre le suivi caméra", "Vérifier les résultats caméra", "{name} : {length} exercices", "Annuler la séance",
 "Matériel",
 # 105
 "Type de matériel", "Tout", "Difficulté", "Type d'entraînement", "Tous les types",
 # 110
 "Choisir par muscle →", "Exercice", "Travaille :", "Type :", "Matériel :",
 # 115
 "Difficulté :", "Seuls les {n} sont comptés. Les autres mouvements sont ignorés.", "Niveau",
 "Compter selon mon amplitude",
 "Comptage à la profondeur que tu atteins d'habitude, apprise sur tes {sets} dernières séries. Descends un peu plus quand c'est confortable : l'objectif te suit.",
 # 120
 "Tu atteins l'amplitude complète : compté à la profondeur standard.", "Compté à la profondeur standard.",
 "Ton amplitude a gagné {gained}° depuis tes premières séances.", "Répétitions visées", "Ton poids (kg)",
 # 125
 "Coach vocal activé", "Coach vocal : annonce ton compte et des conseils à voix haute",
 "Filmer ma série pour vérifier ma technique. Reste sur cet appareil.", "Expérimental.",
 "La précision du comptage n'a pas encore été mesurée sur de vrais téléphones ; vérifie le compte et corrige-le.",
 # 130
 "Répétitions estimées", "Répétitions actuelles", "Estimation caméra · série {set} · objectif {target}",
 "Corrigé par toi · série {set} · objectif {target}", "Terminé · +{extra} en plus",
 # 135
 "Terminé", "Environ {calories} kcal brûlées, soit à peu près {bodyGrams} g de poids corporel. Une estimation grossière.",
 "Temps actif", "Confiance du suivi", "Séance :",
 # 140
 "RÉGLAGES", " · {fps} i/s · {n}", "Ajuster les répétitions actuelles", "Utiliser le compte détecté",
 "Mettre le suivi en pause",
 # 145
 "Activer la caméra", "Reprendre le suivi", "Finir la série et se reposer", "Terminer et vérifier la séance",
 "Série en cours remise à zéro. Les séries précédentes restent. Aucune récompense perdue.",
 # 150
 "Remettre la série à zéro", "Réglages caméra et confidentialité",
 "Les images de la caméra sont traitées en mémoire sur ton appareil. Pas d'envoi de vidéo, pas de micro, pas d'historique de points conservé. Rien n'est filmé sauf si tu coches la vérification de technique, et cette vidéo reste dans ce navigateur. Un simple contour de ta meilleure et de ta moins profonde répétition est gardé en mémoire jusqu'à ce que tu quittes la page. L'enregistrement n'envoie à ton compte que les comptes confirmés et des données de suivi globales.",
 "Caméra par défaut", "Caméra {n}",
 # 155
 "Passer à la caméra arrière", "Passer à la caméra avant",
 "Mets en pause d'abord pour changer. Le choix de caméra dépend de ton navigateur.", "Afficher le squelette",
 "Afficher le retour sur le mouvement",
 # 160
 "Son ou vibration à chaque répétition comptée", "Activité prévue correspondante (facultatif)", "Séance séparée",
 "{name} · aujourd'hui",
 "Pour lier une autre activité du plan, choisis d'abord explicitement un remplacement caméra éligible dans Mon plan. Les exercices caméra ne sont jamais prescrits automatiquement.",
 # 165
 "Utiliser le suivi manuel →",
 "Une seule personne dans le cadre. Un téléphone stable et une lumière uniforme améliorent le suivi. Une visibilité partielle, une caméra qui bouge, les vêtements, les différences de corps et les angles inhabituels peuvent fausser ou manquer des comptes. Aucune garantie de précision ni diagnostic.",
 "Ta confidentialité →",
])

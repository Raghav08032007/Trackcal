"""Phase 3d, French: the workout dashboard (components/workout-dashboard.tsx), in the order of coach/phase3d_keys.json.
Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3d_keys', 'fr', [
 # 0
 "Ouverture des séances…", "Du mouvement qui s'adapte à ta vie.",
 "Connecte-toi pour reprendre tes séances, garder des modèles et un historique privé.",
 "Outils de séance locaux existants", "Ma séance confortable",
 # 5
 "Impossible de charger les séances.", "Enregistre ou abandonne les modifications locales avant d'ouvrir une autre séance.",
 "Échec de l'enregistrement ; ton brouillon local est conservé.", "Enregistre ou abandonne d'abord les modifications locales.",
 "Séance commencée et enregistrée. Pas d'XP pour l'ouverture.",
 # 10
 "Séance terminée · +{awarded_xp} XP de participation. Repos et récupération sont les bienvenus.",
 "En pause. Tes séries sont enregistrées.", "Historique corrigé. Pas d'XP en double.",
 "Progression de la séance enregistrée sur ton compte.", "BIEN BOUGER. BIEN RÉCUPÉRER.",
 # 15
 "Ton rythme.",
 "Choisis une activité familière, enregistre tes séries et fais de la place pour la récupération. Pas de classement des corps ni de série parfaite.",
 "Explorer la bibliothèque →", "Tes données enregistrées sont en sécurité. Réessaie de charger ton compte.",
 "Chargement de tes séances…",
 # 20
 "Un brouillon local est conservé sur cet appareil.", "Recharger les séances", "Aperçu de ton activité",
 "Essayer le suivi caméra privé →", "Séances terminées",
 # 25
 "Ton historique de compte privé", "Mouvement enregistré", "Déclaré par toi, pas un objectif d'exercice", "Plan personnel",
 "Pas commencé",
 # 30
 "Voir le planning de la semaine ↗", "Activités prévues", "{day} · {status} · {minutes} minutes",
 "Commencer la séance prévue", "Créer un plan personnel flexible",
 # 35
 ", ou choisis une activité familière ci-dessous.", "Explorer des mouvements familiers", "Bibliothèque d'exercices mise à jour.",
 "Aucun exercice vérifié ne correspond. Ajuste les filtres ou choisis la récupération.", "Recherche d'exercices",
 # 40
 "mobilité, marche, force…", "Catégorie d'exercice", "Toutes les catégories", "Filtre de matériel", "Tout matériel",
 # 45
 "Rechercher des exercices", "Sécurité, accessibilité et alternatives", "Mouvement : {movement} · Matériel : {list}",
 "aucun", "Accessibilité : {n} · Alternative : {alternative}",
 # 50
 "{review}. Aucun média de démonstration sans licence n'est affiché.", "Ajouté", "Exercice retiré des favoris.",
 "Exercice ajouté aux favoris.", "Retirer des favoris",
 # 55
 "Ajouter aux favoris", "Ta séance choisie", "Choisis un ou plusieurs exercices familiers.", "Nom de la séance",
 "Commencer la séance",
 # 60
 "Modèle de séance enregistré. Pas d'XP pour les modèles répétés.", "Enregistrer comme modèle", "Ta séance terminée",
 "Ta séance, enregistrée au fil de l'eau", "Prêt quand tu l'es",
 # 65
 "· {status} · Version enregistrée {revision}",
 "Modifications enregistrées sur cet appareil. Enregistre la progression pour synchroniser ton compte.",
 "Version du compte chargée. Les séries restent privées.",
 "Un autre brouillon local est conservé jusqu'à ce que tu ouvres explicitement une autre séance.", "Exercice {n}",
 # 70
 "Remplacer l'exercice {n}",
 "Exercice modifié dans ton brouillon local ; les séries ont été effacées pour éviter une erreur d'attribution. Les séances liées doivent correspondre au plan personnel.",
 "Les détails vérifiés de l'exercice sont dans la bibliothèque.", "Charge en kg", "· exercice",
 # 75
 "série", "Supprimer la série {n}", "Ajouter une série à l'exercice {n}", "Notes privées de séance",
 "Enregistrer la correction",
 # 80
 "Enregistrer la progression", "Reprendre la séance", "Mettre la séance en pause", "Terminer la séance",
 "Arrêter la séance incomplète",
 # 85
 "Les récompenses ont des plafonds journaliers communs. Plus de séries, des charges plus lourdes ou des séances plus longues ne donnent pas d'XP en plus.",
 "Minuteur de repos facultatif : {rest} s", "Arrêter le minuteur", "Lancer un repos de 30 secondes",
 "Ni son ni notification. Repose-toi autant que nécessaire.",
 # 90
 "Dernière version du compte chargée.", "Abandonner les modifications locales et recharger",
 "Commence une séance familière ou ouvre une séance enregistrée. Aucune obligation de s'entraîner tous les jours.",
 "Ouvrir la séance enregistrée",
 "Un brouillon de séance local est conservé. Ouvre cette séance depuis l'historique pour la vérifier avant de l'abandonner.",
 # 95
 "Séances enregistrées et favoris", "Utiliser la séance enregistrée", "Supprimer le modèle de séance",
 "Enregistre une combinaison familière ou mets un exercice en favori pour le retrouver ici.",
 "Ton calendrier d'activité et historique",
 # 100
 "Séances terminées ces sept derniers jours", "{count} séances terminées le {day}",
 "Participation et apprentissage, jamais de comparaison des corps.", "{n} · {status} · {minutes} minutes enregistrées",
 "{count} exercices · Estimations caméra · confirmées par toi",
 # 105
 "{count} exercices · Répétitions saisies à la main", "Série {n} : caméra {reps} · estimation conservée",
 "Série {n} : caméra {reps} · corrigée par toi {corrected}", "Ouvrir la séance",
 "Séance retirée de l'historique. Les XP de participation gagnés restent acquis.",
 # 110
 "Supprimer la séance", "Ta première séance enregistrée apparaîtra ici. Pas de données d'exemple ni de classement des corps.",
 "Séances précédentes", "Plus de séances", "Données de séances locales existantes ↗",
 # 115
 "Étapes d'apprentissage et planning personnel ↗",
])

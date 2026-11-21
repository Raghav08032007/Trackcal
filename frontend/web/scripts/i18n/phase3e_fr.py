"""Phase 3e, French: the personal plan and the companion characters (components/personal-dashboard.tsx,
character-companion.tsx), in the order of coach/phase3e_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3e_keys', 'fr', [
 # 0
 "Chargement de ton plan…", "Une routine faite pour ta journée.",
 "Connecte-toi pour enregistrer un plan hebdomadaire personnalisé. Le suivi nutritionnel invité reste disponible.",
 "Continuer le suivi", "Échec de l'enregistrement. Réessaie.",
 # 5
 "Chargement de ton plan privé…", "Réessayer", "Rendons-le personnel.",
 "Ton brouillon est enregistré à l'étape {step}. Les mesures sont facultatives.", "Continuer la configuration personnalisée →",
 # 10
 "Enregistré · +{awarded_xp} XP de participation", "Enregistré. Pas d'XP en double.", "Modifier les préférences ↗",
 "TA SEMAINE, À TON RYTHME", "Plan personnel de {display_name}",
 # 15
 "Ton plan personnel",
 "Basé sur ton emploi du temps et tes envies. Repose-toi, remplace ou change d'avis quand tu veux.",
 "Calendrier d'activité de la semaine", "Suivre les séries dans les séances ↗", "Crée un plan hebdomadaire quand tu es prêt.",
 # 20
 "{today} · {timezone} · Les activités terminées sont déclarées par toi.",
 "Nouveau plan enregistré. L'XP du premier plan n'est attribué qu'une fois.", "Régénérer le plan", "Créer mon premier plan",
 "Plan repris.",
 # 25
 "Plan en pause. Tes XP gagnés sont en sécurité.", "Reprendre le plan", "Mettre le plan en pause", "Adapté à ton bilan sanguin",
 "Source : {source}",
 # 30
 "Tes consignes ou ton retour de douleur nécessitent l'avis d'un professionnel. Les exercices automatiques sont en pause ; le repos reste possible.",
 "minutes ·", "· Matériel : {list}", "Alternative : {name}", "Pause de récupération prévue",
 # 35
 "Commencer l'activité", "Marquer comme fait", "Passer", "Reprogrammer {name}", "Enregistrer la date",
 # 40
 "Remplacer {name}", "Retour sur {name}", "Choisis un retour (facultatif)", "Confortable", "Trop exigeant",
 # 45
 "Douleur ou symptômes inhabituels — arrête", "Pas pour moi",
 "Plus aucun jour d'activité possible cette semaine. Choisis des jours ou du repos dans les préférences ; aucune obligation de s'entraîner tous les jours.",
 "Revoir tes retours d'activité",
 "Un retour de douleur met en pause le choix automatique d'exercices. Si une entrée était une erreur ou si ton ressenti a changé, revois-la ici. Ce n'est pas un avis médical ; suis les conseils d'un professionnel.",
 # 50
 "Revoir le retour {name}", "Douleur — avis professionnel", "Idées de repas selon tes préférences",
 "Des consignes professionnelles ou une allergie non prise en charge doivent être vérifiées avant toute suggestion de repas.",
 "Vérifier les ingrédients et noter dans mon journal →",
 # 55
 "Utiliser la recette vérifiée et le planificateur de budget ↗", "Un peu d'apprentissage va loin",
 "Correct · +{xp} XP. {explanation}", "Relis et réessaie · +{xp} XP. {explanation}", "Vérifier {title}",
 # 60
 "Historique privé des mesures", "IMC non calculé", "IMC indicatif : {value}",
 "Aucune mesure n'influence les récompenses ni l'intensité des activités. Aucune connexion à un objet connecté n'est supposée.",
 "Mesure supprimée.",
 # 65
 "Supprimer la mesure {kind}", "Export du compte et contrôle des données ↗", "Le rythme de tes rappels",
 "Préférences de rappel enregistrées. Les exports de calendrier existants restent séparés.",
 "Fuseau horaire des rappels et du plan",
 # 70
 "Enregistrer les rappels personnalisés", "Rappels de calendrier et coaching existants ↗", "Une routine qui te ressemble",
 "Ton plan est en pause.", "Ton plan d'activité personnel est prêt.",
 # 75
 "Crée ton premier plan personnel.",
 "{n} activités prévues terminées · Les repas et les mesures ne définissent jamais ta valeur.",
 "Voir ma semaine et mes idées de repas →", "Construis une routine personnelle sans mesures corporelles obligatoires.",
 "Reprendre la configuration",
 # 80
 "Personnaliser ma routine", "La graine qui pousse", "Encouragement en douceur", "Les petits pas font de solides racines.",
 "Regarde-toi grandir ! Chaque petit effort compte.",
 # 85
 "L'étoile curieuse", "Apprentissage et découverte", "La curiosité est ton super-pouvoir. Découvrons quelque chose.",
 "Une nouvelle étincelle de savoir ! Tu éclaires le chemin.", "L'ourson douillet",
 # 90
 "Douceur et équilibre", "Ici, il y a de la place pour le repos et un nouveau départ.",
 "Je suis fier de ton effort. Prends un moment pour en profiter.", "La chouette réfléchie", "Organisation et réflexion",
 # 95
 "Un choix réfléchi peut rendre demain plus facile.", "Voilà un pas réfléchi. Ton prochain chapitre prend forme.",
 "Le renard joueur", "Jeu et élan", "Prêt pour une mini-aventure ? Rendons-la amusante.",
 # 100
 "Aventure terminée ! Une petite victoire mérite une danse de joie.", "La tortue tranquille", "Patience et régularité",
 "Ton rythme est le bon. On peut recommencer aujourd'hui.", "Des progrès réguliers. Pas besoin de te presser pour la suite.",
 # 105
 "SIX PERSONNALITÉS. TON PROPRE RYTHME.", "Rencontre ton partenaire de progrès.",
 "Commence avec Pip. Gagne des points et garde une série pour rencontrer le compagnon suivant.", "Choisis ton personnage",
 "Impossible d'enregistrer le personnage. Réessaie.",
 # 110
 "Verrouillé · {unlock} points · série de {streak} jours",
 "{trait}. Gagne {unlock} points et atteins une série de {streak} jours pour débloquer ce compagnon. Encore {n} points et {n2} jours de série.",
 "Fermer l'aperçu", "Faire coucou à {name}", "Touche pour dire bonjour",
 # 115
 "{name} est dans ton équipe.", "Encourage-moi", "Aide-moi à choisir", "Construire mon plan du jour", "Voir mes victoires",
 # 120
 "Faire mon prochain pas", "Niveau {level} · {xp} XP · série de tâches de {n} jours", "Une amitié commence par un petit pas",
 "Progression du personnage vers le niveau suivant", "Encore {n} XP pour le niveau suivant. ",
 # 125
 "Commence un voyage pour grandir ensemble. ", "Fleur au niveau 2 · Couronne au 5 · Soleil au 10",
 "Les personnages célèbrent la participation, jamais le poids ni le fait de manger moins. Le choix du personnage est enregistré dans cet espace et inclus dans les sauvegardes. Les encouragements sont écrits à l'avance, ce ne sont pas des conseils médicaux.",
 "COMMENT ON COMMENCE ?", "Un peu de soutien, à ta façon.",
 # 130
 "Choisis ton point du jour", "J'ai besoin d'un départ en douceur", "Je suis prêt à y aller", "Quitter la vue concentrée",
 "Me concentrer sur mon compagnon",
 # 135
 "LE GUIDE DE {n} POUR TOI", "Tes prochaines petites victoires.", "{today} · D'après la progression de tes quêtes",
 "Un plan d'entraînement pour démarrer. Connecte-toi pour enregistrer tes quêtes.", "Fermer le plan du jour",
 # 140
 "Choisis ton rythme du jour", "Commence avec un peu de curiosité.",
 "Essaie une énigme d'étiquette, puis commence ton voyage facultatif quand tu veux.", "Essayer l'indice d'entraînement →",
 "Commencer mon voyage",
 # 145
 "Me connecter pour enregistrer ma progression", "Les quêtes du jour sont terminées. Tu as mérité une pause.",
 "Pas de tâches en plus ni de points perdus. Reviens demain pour un nouveau chapitre.", "Voir mes quêtes terminées →",
 "Ouvrir mon journal",
 # 150
 "Ouvrir mon planificateur de repas", "Lancer Détective des étiquettes",
 "{length} quêtes du jour sur {length2} terminées · {planXP} XP dans ce plan", "Entraîne-toi d'abord. Pas d'XP pour les invités.",
 "{name} se débloque au niveau {n} ({unlock} XP) · encore {n2} XP.",
 # 155
 "Toute ton équipe de compagnons est débloquée.",
 "C'est un plan de participation, pas un régime prescrit. Les quantités et objectifs nutritionnels restent dans ton journal et ton planificateur. Ouvrir une tâche ne donne pas d'XP ; les actions terminées sont vérifiées par le serveur.",
 "Laisser mon compagnon me suivre pendant que j'explore cette page", "{name} suit ton aventure",
 "Masquer le compagnon qui suit",
 # 160
 "{name} est avec toi", "Un petit pas, à ton rythme.", "Quête suivante →", "Motive-moi",
])

"""Phase 3h, French: one activity, segments, workout history and the recovery map (app/activity, app/segment,
app/segments, components/workout-history.tsx, recovery-map.tsx, segments.tsx, route-map.tsx, lib/activities.ts),
in the order of coach/phase3h_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3h_keys', 'fr', [
 # 0
 "TrackCal — Activité", "Impossible de charger cette activité.", "Connecte-toi pour voir cette activité.", "Activité introuvable",
 "Elle est peut-être privée, ou a été supprimée.",
 # 5
 "Tes activités →", "Chargement de l'activité…", "Enregistré.",
 "Supprimer « {name} » ? Son parcours, ses temps et les records qu'elle a établis seront effacés. C'est irréversible.",
 "Impossible de supprimer. Réessaie.",
 # 10
 "← Activités", "Notes", "Comment tu t'es senti ?", "Carte de {name}", "Le départ, l'arrivée et les lieux privés du propriétaire sont masqués.",
 # 15
 "Temps en mouvement", "Dénivelé positif", "Temps total", "Vitesse max", "10 s les plus rapides",
 # 20
 "{n} km/h",
 "Mesuré à partir de {n} points GPS ; {fixes_dropped} points imprécis ou impossibles ont été ignorés. Les pauses ne comptent pas dans le temps en mouvement.",
 "Mesuré à partir de {n} points GPS. Les pauses ne comptent pas dans le temps en mouvement.", "Temps intermédiaires", "Meilleures performances",
 # 25
 "Ensemble", "Bravos et commentaires", "Pour l'afficher dans le fil avec bravos et commentaires,", "choisis un pseudo dans le Fil",
 ", puis change qui peut la voir.",
 # 30
 "Partage", "Modifier le nom et les notes", "Supprimer l'activité", "TrackCal — Segment", "Impossible de charger ce segment.",
 # 35
 "Segment", "Connecte-toi pour voir ce segment.", "Segment introuvable", "Il est peut-être privé, ou a été retiré.", "Tes segments →",
 # 40
 "Chargement du segment…", "Retirer « {name} » ? Ses temps seront effacés pour tout le monde. C'est irréversible.", "← Segments",
 "SEGMENT VÉLO", "SEGMENT COURSE ET MARCHE",
 # 45
 "TOI SEUL", "Longueur", "Ton meilleur", "Tes passages", "Tes temps",
 # 50
 "Meilleur", "Pas encore de passage. Cours ou roule dessus, du début à la fin, et ton temps apparaîtra ici.", "Classement entre amis",
 "Me montrer un classement avec mes amis",
 "Seulement les personnes que tu suis et qui te suivent en retour, et qui l'ont aussi activé, à partir d'activités que tu as le droit de voir. Pas de classement d'inconnus. Tes propres temps restent toujours à toi.",
 # 55
 "Pas encore d'amis sur celui-ci. Quand des personnes qui te suivent en retour et ont activé le classement passeront dessus, elles apparaîtront ici.",
 "Retirer le segment", "Noté", "Hier", "Donne un nom à la séance.",
 # 60
 "Séance", "Jambes, natation, yoga…", "Répétitions par série", "Impossible d'en charger plus. Réessaie.", "Impossible de supprimer {title}. Réessaie.",
 # 65
 "Impossible d'annuler. Réessaie.", "Afficher", "Tes séances n'ont pas pu se charger. Tes données sont en sécurité ;", "réessaie", "{title} supprimé.",
 # 70
 "Chargement de tes séances…", "Pas encore de séance. Une séance caméra, un parcours enregistré ou une séance notée ici apparaîtra dans cette liste.",
 "Rien de ce type pour l'instant.", "Ouvrir", "Modifier {title}",
 # 75
 "Supprimer {title}", "Charger plus", "Travaillé aujourd'hui", "En récupération", "Presque prêt",
 # 80
 "Ouverture de ta carte de récupération…", "Vois quels muscles sont prêts.", "Connecte-toi et tes séances caméra rempliront cette carte toutes seules.",
 "Tes séances n'ont pas pu être chargées. Réessaie bientôt.", "REMPLI PAR TES RÉPÉTITIONS",
 # 85
 "Les muscles travaillés avec la caméra, qui s'estompent sur trois jours. C'est une règle générale, pas une mesure de ton corps : fie-toi à ce que tu ressens.",
 "Tu as mérité un mouvement plus difficile. Regarde ci-dessous.", "Voici ce que ton corps a fait.",
 "Enregistre une séance caméra et je remplirai ceci pour toi.",
 "Rien pour l'instant. Enregistre une séance caméra et tes muscles s'allumeront tout seuls.",
 # 90
 "Bon pour aujourd'hui", "{title} travaille : {muscles}, sans solliciter tes muscles fatigués.", "{title} travaille : {muscles}.",
 "Prêt pour plus dur", "Tu as fait {reps} {n} vus par la caméra.",
 # 95
 "Essayer {title}", "N° {place} de tes temps", "Créer un segment", "{n} km · {n2}",
 "Ce parcours n'a encore été chronométré sur aucun segment. Crée-en un à partir d'un tronçon que tu cours ou roules souvent, et chaque passage suivant sera chronométré.",
 # 100
 "Impossible de créer ce segment.", "Choisis le tronçon", "Le tronçon de {n} km à {n2} km", "Commence à", "Finit à",
 # 105
 "{n} km de long · au moins 200 m", "{n} km de long", "Sprint du tour du parc", "Tout le monde",
 "Toute personne qui court ou roule dessus est chronométrée. Il ne peut pas inclure tes zones privées ni les 200 premiers et derniers mètres de ce parcours.",
 # 110
 "Moi seul", "Chronomètre seulement tes propres activités. Peut être n'importe où.", "Chronométrage de tes sorties…", "Créer le segment",
 "TrackCal — Segments",
 # 115
 "Impossible de charger les segments.", "Connecte-toi pour voir tes segments.", "BOUGER · SEGMENTS", "segments",
 "Tes tronçons préférés de route et de chemin. Chaque course, marche ou sortie à vélo dessus est chronométrée d'après son parcours, pour te mesurer à toi-même.",
 # 120
 "Chargement des segments…", "Toi seul", "{km} km · {count} passages", "Pas encore chronométré", "Pas encore de segment",
 # 125
 "Ouvre une de tes courses, marches ou sorties à vélo et choisis", ". Prends un tronçon que tu fais souvent, comme une côte ou un tour de parc.",
 "2e meilleur", "3e meilleur", "Marche",
 # 130
 "Course", "Randonnée", "Vélo", "Personne d'autre ne peut le voir.", "Les personnes que tu as acceptées. Le départ et l'arrivée sont masqués.",
 # 135
 "Tout le monde sur TrackCal. Le départ, l'arrivée et les zones privées sont masqués.", "Les activités sont indisponibles pour le moment. Rien n'a été modifié.",
 "Vitesse moy.", "Aucun parcours à afficher. Les parcours partagés masquent le départ et l'arrivée, un parcours court peut donc être entièrement masqué.",
 "Altitude de {n} m à {n2} m",
 # 140
 "Altitude", "Km", "Allure relative",
])

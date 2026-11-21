"""Phase 3b, French: camera exercise cues, setup, tips and "not counted" notes (lib/pose/exercise-config.ts), in the order
of coach/phase3b_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['fr']
T = table_from('phase3b_keys', 'fr', [
 # 0
 "Tiens-toi droit", "Descends en squat", "Remonte", "À 2–3 m, téléphone à hauteur de hanche",
 "Pose l'ordinateur à hauteur de table et recule jusqu'à voir ta tête et tes hanches.",
 # 5
 "Face à la caméra ou de profil, comme c'est le plus simple.", "Reste immobile un instant, puis fais ton squat.",
 "Une lumière vive et uniforme aide.", "Bras tendus", "Descends la poitrine",
 # 10
 "Pousse", "À 1,5–2 m, téléphone au sol", "De profil ou face à la caméra, selon ta pièce.",
 "De face : pose le téléphone au sol devant ta tête et garde épaules et mains dans le cadre.",
 "De profil : garde tout ton corps dans le cadre.",
 # 15
 "Bras tendu", "Monte en flexion", "Descends le bras", "À 1,5–2 m, téléphone à hauteur de poitrine",
 "Face à la caméra ou de profil ; un bras est suivi par série.",
 # 20
 "Garde épaule, coude, poignet et hanche dans le cadre.", "Bras au-dessus de la tête", "Pousse vers le haut",
 "Debout ou assis, face à la caméra ou de profil ; un bras est suivi par série.",
 "Commence bras tendu au-dessus de la tête, puis descends et pousse.",
 # 25
 "Laisse de la place au-dessus de ta main pour qu'elle reste dans le cadre.", "Allonge-toi", "À 2 m, téléphone au sol",
 "Allonge-toi de profil, genoux pliés.", "Commence allongé, puis enroule-toi vers le haut.",
 # 30
 "Garde épaules, hanches et genoux dans le cadre.", "Penche-toi vers le mur", "Repousse",
 "De profil, mains sur un mur stable.", "Avance et descends",
 # 35
 "Reviens debout", "À 2–3 m, ordinateur à hauteur de table", "Face à la caméra ou de profil.",
 "Garde épaules et hanches dans le cadre.", "Avance, descends, puis redresse-toi avant la suivante.",
 # 40
 "Bras le long du corps", "Saute et lève les bras", "Redescends", "Face à la caméra.",
 "Laisse de la place au-dessus de ta tête.",
 # 45
 "Ramène bien les bras en bas à chaque fois.", "Monte à hauteur d'épaule", "Descends les bras",
 "À 1,5–2 m, ordinateur à hauteur de poitrine", "Lève les bras sur les côtés, jusqu'à hauteur d'épaule.",
 # 50
 "Garde épaules, coudes et hanches dans le cadre.", "Lève un genou", "Repose le pied",
 "Un genou à la fois ; les deux jambes comptent.", "Garde hanches et genoux dans le cadre.",
 # 55
 "Pieds écartés", "Face à la caméra, pieds écartés.", "Garde la tête et les hanches dans le cadre.",
 "Allongé, genoux pliés", "Monte les hanches",
 # 60
 "Descends les hanches", "Monte sur la pointe des pieds", "Descends les talons",
 "De profil ou face à la caméra, pieds dans le cadre.",
 "Monte lentement sur la pointe des pieds et marque une pause en haut.",
 # 65
 "Lève une jambe sur le côté", "Descends la jambe", "Face à la caméra, près d'un mur pour l'équilibre.",
 "Les deux jambes comptent.", "À quatre pattes",
 # 70
 "Pousse une jambe vers l'arrière", "Ramène le genou", "À quatre pattes, de profil.",
 "Mains sur une table ou un banc solide, de profil.", "Genoux au sol, de profil.",
 # 75
 "Garde de la tête aux genoux dans le cadre.", "Penche-toi en avant, bras long", "Tire le coude vers l'arrière",
 "Bascule depuis les hanches, de profil.", "Un poids léger ou une bouteille pleine suffit.",
 # 80
 "Allonge-toi sur le ventre", "Lève la poitrine et les jambes", "Descends doucement", "Sur le ventre, de profil.",
 "Lève doucement et tiens un instant.",
 # 85
 "Penché en avant, coude plié", "Tends le bras", "Plie le coude", "Penché en avant, de profil.",
 "Garde le haut du bras immobile ; un bras par série.",
 # 90
 "Bras tendu au-dessus de la tête", "Descends derrière la tête", "De profil, avec de la place au-dessus de la main.",
 "Garde le coude pointé vers le haut.", "Face à la caméra ou de profil ; un bras par série.",
 # 95
 "Compté comme un curl biceps.", "Mets-toi de profil.", "Lève les bras devant toi jusqu'à hauteur d'épaule.",
 "Mains basses", "Monte les coudes vers le haut et l'extérieur",
 # 100
 "Descends les mains", "Écarte les coudes sur les côtés.", "Enroule les épaules vers le haut",
 "Une petite montée suffit.", "Allongé à plat, jambes tendues",
 # 105
 "Lève les jambes", "Descends lentement", "Allonge-toi de profil.",
 "Plie un peu les genoux si ton dos se décolle.", "Penche-toi sur un côté",
 # 110
 "Penche-toi bien sur le côté ; chaque côté compte.", "Monte un genou", "Change de jambe",
 "Chaque montée de genou compte.", "Descends au sol",
 # 115
 "Saute en l'air", "Recule bien pour que tout ton corps reste dans le cadre au sol.",
 "Redresse-toi complètement entre les répétitions.", "Position de pompe", "Ramène un genou",
 # 120
 "Position de pompe, de profil.", "Chaque genou compte.", "Tiens la charge contre la poitrine",
 "Garde les mains près de la poitrine ou des épaules tout du long.", "Bras en haut",
 # 125
 "Les bras restent en haut pendant toute la répétition.", "Debout, charges en bas", "Garde les mains le long du corps.",
 "Fais un grand pas sur le côté et plie un genou", "Reviens au centre",
 # 130
 "Face à la caméra, fais un pas sur le côté.", "Garde les pieds dans le cadre.", "Saute",
 "Tes pieds doivent quitter le sol pour que ça compte.", "Monte un talon vers les fesses",
 # 135
 "Garde le genou pointé vers le bas.", "De profil, c'est le mieux.", "Bascule et descends la charge", "De profil.",
 "Plie un peu les genoux et bascule depuis les hanches.",
 # 140
 "Pousse les hanches en arrière", "Garde les genoux presque tendus.", "Charge sur les épaules",
 "Penche-toi en avant", "Garde les mains sur les épaules.",
 # 145
 "Monte lentement : c'est un petit mouvement.", "Charge sur les hanches", "Bras tendus vers le haut",
 "Descends vers la poitrine", "Les mains restent au-dessus de la poitrine.",
 # 150
 "Plie uniquement les coudes", "Tends les bras", "Garde les coudes en place.", "Penché en avant, bras longs",
 "Ouvre les bras",
 # 155
 "Garde les bras presque tendus.", "Assis droit, bras longs", "Tire vers la taille", "Tends les bras devant toi",
 "Assieds-toi de profil.",
 # 160
 "Tire vers la taille, pas vers l'épaule.", "Assis, bras long", "Reste assis et penche-toi un peu en avant.",
 "Pousse au-dessus de la tête", "Squat avec les charges aux épaules",
 # 165
 "Remonte et pousse", "Descends en squat avec la charge, puis pousse en te relevant.", "Hanches hautes, bras tendus",
 "Descends la tête", "Garde les hanches au-dessus des épaules.",
 # 170
 "Garde les mains sur la chaise.", "Suspendu, bras tendus", "Tire vers le haut",
 "Tes mains restent sur la barre, c'est ton corps qui bouge.", "Tends le bras et la jambe",
 # 175
 "Ramène-les", "Ta main doit aller vers l'avant pendant que ta jambe part en arrière.", "Lève une jambe",
 "Petits battements rapides.", "Allongé, jambes tendues",
 # 180
 "Ramène bien le genou vers la poitrine.", "Ramène les genoux vers la poitrine", "Descends les pieds",
 "Tes épaules restent au sol.", "Allonge-toi à plat",
 # 185
 "Poitrine et jambes se lèvent en même temps.", "Poings levés", "Frappe devant toi", "Ramène-le",
 "Frappe à hauteur d'épaule, puis ramène ton poing.",
 # 190
 "De profil, le coup se voit mieux.", "Assis droit, bras en haut", "Tire les coudes vers le bas", "Remonte les bras",
 "Reste assis.",
 # 195
 "Tes mains bougent, tes épaules restent en place.", "Bras au-dessus de la poitrine", "Ramène vers le haut",
 "Bascule, charge derrière toi", "Projette les hanches vers l'avant",
 # 200
 "Laisse-la revenir", "Le swing vient des hanches, pas des bras.", "Assis droit, genou plié", "Tends la jambe",
 "Garde la cuisse sur le siège.",
 # 205
 "Pied arrière sur le banc", "Descends tout droit", "Tiens-toi sur une jambe", "Assieds-toi sur cette jambe",
 "Tiens-toi à quelque chose de solide si besoin.",
 # 210
 "Touche l'épaule opposée", "Repose la main", "Garde les hanches immobiles.", "Plie les genoux",
 "Garde les hanches au sol.",
 # 215
 "Équilibre sur les mains, bras tendus", "Essaie seulement si tu tiens déjà l'équilibre contre un mur.",
 "Suspendu, jambes en bas", "Descends en contrôlant", "Évite de te balancer.",
 # 220
 "Pieds surélevés, bras tendus", "Garde le corps bien aligné.", "À genoux, buste droit, chevilles maintenues",
 "Descends lentement vers l'avant", "Garde les hanches alignées.",
 # 225
 "Rattrape-toi avec les mains.", "Pieds décalés, un devant, un derrière", "Descends en fente", "Saute et atterris",
 "Saute, genoux vers la poitrine",
 # 230
 "Atterris en douceur", "Les deux genoux montent ensemble.", "Charge au niveau des cuisses",
 "Monte aux épaules, pousse au-dessus de la tête", "Redescends aux cuisses",
 # 235
 "Plie les coudes au niveau des épaules en montant.", "Bascule, charge basse", "Monte au-dessus de la tête",
 "Redescends avec contrôle", "Un seul mouvement fluide, des hanches jusqu'au-dessus de la tête.",
 # 240
 "Penche-toi en arrière, bras en haut", "À 2 m, téléphone à hauteur du banc",
 "Place le téléphone de profil par rapport au banc.",
 "Compte de profil ou de face ; de face, le comptage est le plus sûr.",
 "Compte de profil ou de face ; de profil, le comptage est le plus sûr.",
 # 245
 "Compte seulement de face : sous l'autre angle, ce mouvement est caché.",
 "Compte seulement de profil : sous l'autre angle, ce mouvement est caché.",
 "Débutant", "Intermédiaire", "Avancé",
 # 250
 "Non compté : descends un peu plus si c'est confortable.",
 "Non compté : c'était très rapide. Essaie un rythme plus régulier.",
 "Non compté : cette répétition a pris beaucoup de temps. Une pause en cours de route, ça va ; recommence la suivante depuis le haut.",
 "Non compté : tu es sorti du cadre ou tu étais caché pendant cette répétition.",
 "Non compté : cela ressemble à un autre exercice que celui que tu as choisi.",
])

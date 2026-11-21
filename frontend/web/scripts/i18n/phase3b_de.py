"""Phase 3b, German (du): camera exercise cues, setup, tips and "not counted" notes (lib/pose/exercise-config.ts), in the
order of coach/phase3b_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3b_keys', 'de', [
 # 0
 "Aufrecht stehen", "In die Hocke gehen", "Aufstehen", "2–3 m entfernt, Handy auf Hüfthöhe",
 "Stell den Laptop auf Tischhöhe und geh zurück, bis Kopf und Hüfte zu sehen sind.",
 # 5
 "Zur Kamera oder seitlich, wie es leichter ist.", "Steh erst einen Moment still, dann geh in die Hocke.",
 "Gleichmäßiges, helles Licht hilft.", "Arme gestreckt", "Brust absenken",
 # 10
 "Hochdrücken", "1,5–2 m entfernt, Handy auf dem Boden", "Seitlich oder zur Kamera, wie es in deinen Raum passt.",
 "Von vorn: Leg das Handy vor deinem Kopf auf den Boden und halte Schultern und Hände im Bild.",
 "Seitlich: Halte deinen ganzen Körper im Bild.",
 # 15
 "Arm gestreckt", "Hochcurlen", "Arm absenken", "1,5–2 m entfernt, Handy auf Brusthöhe",
 "Zur Kamera oder seitlich; pro Satz wird ein Arm erfasst.",
 # 20
 "Halte Schulter, Ellbogen, Handgelenk und Hüfte im Bild.", "Arm über dem Kopf", "Nach oben drücken",
 "Stehend oder sitzend, zur Kamera oder seitlich; pro Satz wird ein Arm erfasst.",
 "Beginne mit dem Arm über dem Kopf, dann absenken und drücken.",
 # 25
 "Lass Platz über deiner Hand, damit sie im Bild bleibt.", "Zurücklegen", "2 m entfernt, Handy auf dem Boden",
 "Leg dich seitlich zur Kamera, Knie gebeugt.", "Beginne liegend, dann roll dich hoch.",
 # 30
 "Halte Schultern, Hüfte und Knie im Bild.", "Zur Wand lehnen", "Zurückdrücken",
 "Steh seitlich zur Kamera, Hände an einer stabilen Wand.", "Schritt und absenken",
 # 35
 "Wieder aufstehen", "2–3 m entfernt, Laptop auf Tischhöhe", "Zur Kamera oder seitlich stehen.",
 "Halte Schultern und Hüfte im Bild.", "Schritt, absenken, dann vor der nächsten aufrichten.",
 # 40
 "Arme seitlich am Körper", "Springen und hochstrecken", "Wieder runter", "Schau zur Kamera.",
 "Lass Platz über deinem Kopf.",
 # 45
 "Nimm die Arme jedes Mal ganz nach unten.", "Auf Schulterhöhe heben", "Arme senken",
 "1,5–2 m entfernt, Laptop auf Brusthöhe", "Heb die Arme seitlich bis auf Schulterhöhe.",
 # 50
 "Halte Schultern, Ellbogen und Hüfte im Bild.", "Ein Knie heben", "Fuß absenken",
 "Ein Knie nach dem anderen; beide Beine zählen.", "Halte Hüfte und Knie im Bild.",
 # 55
 "Füße breit stellen", "Zur Kamera, Füße breit.", "Halte Kopf und Hüfte im Bild.", "Auf dem Rücken, Knie gebeugt",
 "Hüfte heben",
 # 60
 "Hüfte senken", "Auf die Zehenspitzen", "Fersen senken", "Seitlich oder zur Kamera, Füße im Bild.",
 "Geh langsam auf die Zehenspitzen und halte oben kurz an.",
 # 65
 "Ein Bein seitlich heben", "Bein senken", "Zur Kamera, nah an einer Wand für das Gleichgewicht.",
 "Beide Beine zählen.", "Im Vierfüßlerstand",
 # 70
 "Ein Bein nach hinten kicken", "Knie heranziehen", "Vierfüßlerstand, seitlich zur Kamera.",
 "Hände auf einem stabilen Tisch oder einer Bank, seitlich zur Kamera.", "Knie am Boden, seitlich zur Kamera.",
 # 75
 "Halte dich von Kopf bis Knie im Bild.", "Nach vorn beugen, Arm lang", "Ellbogen nach hinten ziehen",
 "Aus der Hüfte nach vorn beugen, seitlich zur Kamera.", "Ein leichtes Gewicht oder eine volle Flasche reicht.",
 # 80
 "Auf den Bauch legen", "Brust und Beine heben", "Absenken", "Auf dem Bauch, seitlich zur Kamera.",
 "Sanft anheben und kurz halten.",
 # 85
 "Nach vorn gebeugt, Ellbogen gebeugt", "Arm strecken", "Ellbogen beugen", "Nach vorn gebeugt, seitlich zur Kamera.",
 "Halte den Oberarm ruhig; ein Arm pro Satz.",
 # 90
 "Arm gestreckt über dem Kopf", "Hinter den Kopf absenken", "Seitlich stehen, mit Platz über der Hand.",
 "Der Ellbogen zeigt nach oben.", "Zur Kamera oder seitlich; ein Arm pro Satz.",
 # 95
 "Wird wie ein Bizeps-Curl gezählt.", "Steh seitlich zur Kamera.", "Heb die Arme nach vorn bis auf Schulterhöhe.",
 "Hände unten", "Ellbogen hoch und nach außen ziehen",
 # 100
 "Hände senken", "Führ die Ellbogen seitlich nach außen.", "Schultern hochrollen", "Ein kleines Anheben reicht.",
 "Flach liegen, Beine lang",
 # 105
 "Beine heben", "Langsam absenken", "Leg dich seitlich zur Kamera.", "Beug die Knie etwas, wenn dein Rücken abhebt.",
 "Zur Seite neigen",
 # 110
 "Neig dich gerade zur Seite; jede Seite zählt.", "Ein Knie hochziehen", "Bein wechseln", "Jedes Knieheben zählt.",
 "Auf den Boden",
 # 115
 "Wieder hochspringen", "Steh weit genug zurück, damit dein ganzer Körper am Boden im Bild bleibt.",
 "Zwischen den Wiederholungen ganz aufrichten.", "Liegestützposition", "Ein Knie heranziehen",
 # 120
 "Liegestützposition, seitlich zur Kamera.", "Jedes Knie zählt.", "Gewicht an der Brust halten",
 "Halte die Hände die ganze Zeit nah an Brust oder Schultern.", "Arme über dem Kopf",
 # 125
 "Die Arme bleiben die ganze Wiederholung oben.", "Aufrecht, Gewichte unten", "Halte die Hände seitlich unten.",
 "Weit zur Seite treten und ein Knie beugen", "Zurück zur Mitte",
 # 130
 "Schau zur Kamera und tritt zur Seite.", "Halte deine Füße im Bild.", "Hochspringen",
 "Deine Füße müssen den Boden verlassen, damit es zählt.", "Eine Ferse hochkicken",
 # 135
 "Das Knie zeigt nach unten.", "Seitlich klappt es am besten.", "Beugen und Gewicht absenken", "Seitlich stehen.",
 "Knie leicht beugen und aus der Hüfte nach vorn beugen.",
 # 140
 "Hüfte nach hinten schieben", "Knie fast gestreckt halten.", "Gewicht auf den Schultern", "Nach vorn beugen",
 "Hände an den Schultern lassen.",
 # 145
 "Langsam hoch: Das ist eine kleine Bewegung.", "Gewicht auf der Hüfte", "Arme gerade nach oben",
 "Zur Brust absenken", "Die Hände bleiben über der Brust.",
 # 150
 "Nur in den Ellbogen beugen", "Arme strecken", "Ellbogen bleiben, wo sie sind.", "Nach vorn gebeugt, Arme lang",
 "Arme seitlich heben",
 # 155
 "Arme fast gestreckt halten.", "Aufrecht sitzen, Arme lang", "Zur Taille ziehen", "Nach vorn strecken",
 "Setz dich seitlich zur Kamera.",
 # 160
 "Zur Taille ziehen, nicht zur Schulter.", "Sitzen, Arm lang", "Sitzen bleiben und leicht nach vorn lehnen.",
 "Über den Kopf drücken", "Hocke mit Gewichten an den Schultern",
 # 165
 "Aufstehen und drücken", "Geh beim Absenken in die Hocke und drück beim Aufstehen.", "Hüfte hoch, Arme gestreckt",
 "Kopf absenken", "Halte die Hüfte über den Schultern.",
 # 170
 "Hände auf dem Stuhl lassen.", "Mit gestreckten Armen hängen", "Hochziehen",
 "Die Hände bleiben an der Stange, dein Körper bewegt sich.", "Arm und Bein ausstrecken",
 # 175
 "Zurückholen", "Die Hand geht nach vorn, während das Bein nach hinten geht.", "Ein Bein hochkicken",
 "Kleine, schnelle Kicks.", "Auf dem Rücken, Beine lang",
 # 180
 "Zieh das Knie ganz zur Brust.", "Knie zur Brust ziehen", "Füße absenken", "Deine Schultern bleiben am Boden.",
 "Flach hinlegen",
 # 185
 "Brust und Beine heben sich gleichzeitig.", "Fäuste hoch", "Nach vorn schlagen", "Zurückziehen",
 "Schlag auf Schulterhöhe, dann hol die Faust zurück.",
 # 190
 "Seitlich sieht man den Schlag am besten.", "Aufrecht sitzen, Arme oben", "Ellbogen nach unten ziehen",
 "Wieder nach oben strecken", "Sitzen bleiben.",
 # 195
 "Deine Hände bewegen sich, die Schultern bleiben ruhig.", "Arme über der Brust", "Wieder hochziehen",
 "Beugen, Gewicht hinter dir", "Hüfte nach vorn schnellen",
 # 200
 "Zurückschwingen lassen", "Der Schwung kommt aus der Hüfte, nicht aus den Armen.", "Aufrecht sitzen, Knie gebeugt",
 "Bein strecken", "Der Oberschenkel bleibt auf dem Sitz.",
 # 205
 "Hinterer Fuß auf der Bank", "Gerade nach unten absenken", "Auf einem Bein stehen", "Auf diesem Bein absetzen",
 "Halte dich an etwas Stabilem fest, wenn nötig.",
 # 210
 "Die andere Schulter antippen", "Hand zurück auf den Boden", "Halte die Hüfte ruhig.", "Knie beugen",
 "Die Hüfte bleibt am Boden.",
 # 215
 "Handstand, Arme gestreckt", "Versuch das nur, wenn du schon einen Handstand an der Wand halten kannst.",
 "Hängen, Beine unten", "Kontrolliert absenken", "Versuch, nicht zu schwingen.",
 # 220
 "Füße erhöht, Arme gestreckt", "Halte deinen Körper in einer geraden Linie.", "Aufrecht knien, Knöchel fixiert",
 "Langsam nach vorn absenken", "Hüfte gestreckt halten.",
 # 225
 "Fang dich mit den Händen ab.", "In Schrittstellung stehen", "In den Ausfallschritt absenken", "Springen und landen",
 "Springen, Knie zur Brust",
 # 230
 "Weich landen", "Beide Knie kommen gleichzeitig hoch.", "Gewicht an den Oberschenkeln",
 "Zu den Schultern ziehen, über den Kopf drücken", "Zu den Oberschenkeln absenken",
 # 235
 "Beug die Ellbogen beim Hochziehen auf Schulterhöhe.", "Beugen, Gewicht unten", "Nach oben über den Kopf",
 "Unter Kontrolle absenken", "Eine fließende Bewegung von der Hüfte bis über den Kopf.",
 # 240
 "Zurücklehnen, Arme oben", "2 m entfernt, Handy auf Bankhöhe", "Stell das Handy seitlich zur Bank.",
 "Zählt seitlich oder von vorn; von vorn wird am sichersten gezählt.",
 "Zählt seitlich oder von vorn; seitlich wird am sichersten gezählt.",
 # 245
 "Zählt nur von vorn: Aus dem anderen Winkel ist diese Bewegung verdeckt.",
 "Zählt nur seitlich: Aus dem anderen Winkel ist diese Bewegung verdeckt.",
 "Anfänger", "Fortgeschritten", "Profi",
 # 250
 "Nicht gezählt: Geh etwas tiefer, wenn es sich gut anfühlt.",
 "Nicht gezählt: Das war sehr schnell. Versuch ein gleichmäßigeres Tempo.",
 "Nicht gezählt: Diese Wiederholung hat sehr lange gedauert. Eine Pause mittendrin ist okay; beginne die nächste wieder oben.",
 "Nicht gezählt: Du warst während dieser Wiederholung außerhalb des Bildes oder verdeckt.",
 "Nicht gezählt: Das sieht nach einer anderen Übung aus als der, die du gewählt hast.",
])

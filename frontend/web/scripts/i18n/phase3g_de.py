"""Phase 3g, German (du): holds, camera sports, workout builder and activities (lib/pose/holds.ts,
components/hold-studio.tsx, lib/sport-game.ts, components/circuit-builder.tsx, app/activities/page.tsx), in the order of
coach/phase3g_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3g_keys', 'de', [
 # 0
 "Gleichgewicht", "Mobilität und Beweglichkeit", "Unterarmstütz", "Bauch, Schultern, Po", "Seitlich zur Kamera, ganzer Körper sichtbar.",
 # 5
 "Eine gerade Linie vom Kopf bis zu den Fersen", "Wandsitz oder gehaltene Kniebeuge", "Seitlich, Rücken an der Wand oder frei stehend.",
 "Oberschenkel waagerecht, Knie über den Knöcheln", "Gehaltene Glute Bridge",
 # 10
 "Po, hintere Oberschenkel, unterer Rücken", "Seitlich liegend, Knie gebeugt, Füße flach.", "Po anspannen und Hüfte oben halten",
 "Baum", "Knöchel, Hüfte, Rumpf",
 # 15
 "Zur Kamera, ganzer Körper sichtbar.", "Fuß an der Innenseite des Beins, Hände über dem Kopf", "Einbeinstand",
 "Seitlich oder zur Kamera.", "Heb ein Bein und bleib aufrecht",
 # 20
 "Krieger II", "Hüfte, Beine, Schultern", "Zur Kamera, mit Platz für einen weiten Schritt.", "Vorderes Knie gebeugt, Arme weit ausgestreckt",
 "Herabschauender Hund",
 # 25
 "Hintere Oberschenkel, Waden, Schultern", "Seitlich, Hände und Füße am Boden.", "Hüfte hoch, Fersen Richtung Boden",
 "Stehende Vorbeuge", "Hintere Oberschenkel, unterer Rücken",
 # 30
 "Seitlich, ganzer Körper sichtbar.", "Aus der Hüfte beugen, Kopf hängen lassen", "Halteübungen werden geöffnet…",
 "Halt die Position, dann zählt es.", "Melde dich an, um Unterarmstütz, Gleichgewicht und Dehnungen mit der Kamera zu stoppen.",
 # 35
 "{count} Sekunden", "Ziel erreicht. Stark gehalten.", "Kamera nicht verfügbar.", "RUMPF · GLEICHGEWICHT · BEWEGLICHKEIT",
 "Geh in Position, und die Kamera stoppt deine Zeit. Nur Zeit in der richtigen Position zählt. Das ist keine Technik- oder Sicherheitsprüfung, also hör auf, wenn etwas wehtut.",
 # 40
 "Aufbau:", "Live-Vorschau der Halteübung", "{n} von {target} Sekunden", "Geh zurück, damit dein ganzer Körper zu sehen ist.",
 "Ziel erreicht. Halt weiter, wenn du kannst, oder ruh dich aus.",
 # 45
 "Halten. {cue}.", "Geh in Position: {n}.", "Kamera startet…", "Ziel", "{value} Sekunden",
 # 50
 "Laut mitzählen", "Stopp", "Beste Haltezeit: {n} s", "Insgesamt {n} s in Position.",
 "Halteübungen ab {MIN_SAVE_S} Sekunden können gespeichert werden. Versuch es noch einmal, wenn du bereit bist.",
 # 55
 "Halteübung speichern", "{count} Sekunden {hold} gespeichert, +{earned} Punkte. Schön ruhig!", "{count} Sekunden {hold} gespeichert. Schön ruhig!",
 "Noch eine Halteübung", "Das Video bleibt auf deinem Gerät. Gespeichert wird nur die gehaltene Zeit.",
 # 60
 "Seilspringen", "Sprung", "Sprünge", "Mit oder ohne Seil: leichte Sprünge, beide Füße zusammen.",
 "Zur Kamera, 2–3 m entfernt, der ganze Körper von Kopf bis Fuß sichtbar.",
 # 65
 "Lockere Knie", "Beidbeinig springen", "Leicht landen", "Schattenboxen", "Schlag",
 # 70
 "Schläge", "Jab und Cross aus der Deckung. Jede Faust zurück zum Kinn.", "Seitlich, 2–3 m entfernt, beide Arme und die Hüfte sichtbar.",
 "Jab", "Cross",
 # 75
 "Cricket-Drive", "Drive", "Drives", "Kein Schläger nötig: Hände zusammen, ausholen, dann entlang der Linie nach unten durchschlagen.",
 "Zur Kamera, 2–3 m entfernt, mit Platz über dem Kopf und beiden Händen sichtbar.",
 # 80
 "Stand", "Ausholen", "Schlag", "Durchschwung", "Badminton-Smash",
 # 85
 "Smash", "Smashes", "Schlaghand hinter den Kopf, anderer Arm hoch, dann nach unten und durch schmettern.",
 "Seitlich, 2–3 m entfernt, mit Platz über dem Kopf und beiden Armen sichtbar.", "Bereit",
 # 90
 "Schläger zurück", "Treffpunkt hoch", "Nach unten schmettern", "{n} · {rest} s Pause", "{name} verwenden",
 # 95
 "{name} löschen", "Workout-Baukasten",
 "Mach mehrere Übungen hintereinander. Erreiche jedes Ziel, und die Kamera wechselt nach einer Pause von selbst zur nächsten.",
 "Übung hinzufügen", "Wiederholungen für diese Übung",
 # 100
 "Zum Workout hinzufügen", "{target} Wiederholungen", "Schritt {n} entfernen", "Pause zwischen Übungen (Sekunden)", "Workout speichern",
 # 105
 "Stell mir ein Workout zusammen", "Mach mir eins", "Zu trainierende Muskeln", "Zeit", "{m} Minuten",
 # 110
 "Mein Workout erstellen", "{title} tauschen", "Tauschen", "Dieses Workout starten", "Nichts passt. Probier mehr Muskeln oder andere Geräte.",
 # 115
 "TrackCal — Aktivitäten", "Aktivitäten werden geladen…", "Melde dich an, um deine Routen, Zwischenzeiten und Bestleistungen zu sehen.",
 "Aktivitäten konnten nicht geladen werden.", "DEINE AKTIVITÄTEN",
 # 120
 "Jede Route, gemessen.",
 "Distanz, Bewegungszeit, Zwischenzeiten und Höhenmeter werden auf unserem Server aus deinen GPS-Punkten berechnet, für jedes Handy gleich.",
 "Letzte 7 Tage", "Aktivitäten", "Höhenmeter",
 # 125
 "Aktivitäten", "Noch keine Aktivitäten", "Zeichne einen Spaziergang, Lauf, eine Wanderung oder Radtour auf, und sie erscheint hier mit Karte und Zwischenzeiten.",
 "Öffentlich", "Follower",
 # 130
 "Distanz", "Tempo", "Pace", "Aufstieg", "Ältere anzeigen",
 # 135
 "{n} Bestleistungen", "Längste", "Meiste Höhenmeter", "Dein Standort wird gesucht…", "Privater Ort",
 # 140
 "Hinzugefügt. Geteilte Routen verbergen jetzt {radius} m um diesen Ort.", "Die Zone konnte nicht hinzugefügt werden.",
 "Der Standortzugriff ist aus, daher konnte die Zone nicht gesetzt werden.", "Die Zone konnte nicht entfernt werden.", "Privatzonen",
 # 145
 "Geteilte Routen verbergen immer 200 m am Start und am Ziel. Füge eine Zone für Orte wie Zuhause oder Arbeit hinzu, und jede geteilte Route verbirgt sie ebenfalls. Du siehst deine Route immer vollständig.",
 "Größe", "Meinen aktuellen Ort hinzufügen",
])

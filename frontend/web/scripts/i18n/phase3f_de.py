"""Phase 3f, German (du): muscle finder, GPS tracker, weekly effort page and posture hints (components/muscle-finder.tsx,
gps-tracker.tsx, app/weekly/page.tsx, lib/pose/posture-match.ts), in the order of coach/phase3f_keys.json.
Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3f_keys', 'de', [
 # 0
 "Muskelauswahl wird geöffnet…", "Trainiere die Muskeln, die du wählst.",
 "Melde dich an, tippe auf einen Muskel und bekomm passende Übungen.", "NACH MUSKEL TRAINIEREN", "Welche Muskeln heute?",
 # 5
 "Wähl eine Gruppe für einen fertigen Plan oder tippe auf Muskeln am Körper. Jede Übung zeigt, wie sie geht.",
 "Wähl eine Gruppe", "Vorschlag für heute:", "Zeigen", "Heute ist ein",
 # 10
 "Ruhetag", "im Wochenplan.", "Sanfte Dehnungen", "Muskelgruppen", "Mobilität und Gleichgewicht",
 # 15
 "Dehnungen und Halteübungen", "Gemischter {label}-Plan", "{label}-Plan für heute", "Planstufe", "{seconds} s halten",
 # 20
 "Starten", "Mischen", "Zurück zum heutigen Plan", "{target} Wiederholungen · {n}", "Zum Abschluss: {title}",
 # 25
 "{n} s halten", "{length} Übungen mit Kamera starten", "Keine Übung passt. Probier unten beliebige Geräte.",
 "Zu deinem Schutz weggelassen: {n}. Du kannst sie unten trotzdem wählen; wir sagen dir vorher, warum.",
 "Anfängerpläne haben {easy} Übungen, Fortgeschrittene {medium} und Profis {hard}. Der heutige Plan bleibt den ganzen Tag gleich. Die Kamera zählt auf diesem Gerät, nichts verlässt es.",
 # 30
 "Oder wähl Muskeln", "Vorn", "Muskeln", "Leeren", "Alle",
 # 35
 "Anfänger (nur leicht)", "Bis mittel", "Bis schwer",
 "Wähl oben eine Gruppe oder tippe auf den Körper, und ich zeige dir, wie jede Übung geht.",
 "Nichts passt zu diesen Filtern. Probier beliebige Geräte oder eine höhere Stufe.",
 # 40
 "{length} Übungen für {n}", "Nicht geeignet für dich", "Vorsicht", "Hauptziel", "Halten",
 # 45
 "Trainiert {n}", "Mit Kamera erfassen", "3D ausblenden", "In 3D ansehen", "Selbst eintragen",
 # 50
 "Zu meinem Workout hinzufügen", "zählt auf diesem Gerät; kein Video verlässt es.", "speichert die Sätze, die du eintippst, ohne Kamera.",
 "Dein Workout", "Alle mit Kamera erfassen",
 # 55
 "{title} gespeichert, +{saved} Punkte. Gut gemacht!", "{title} gespeichert. Gut gemacht!", "Sätze", "Sekunden pro Satz",
 "Wiederholungen pro Satz",
 # 60
 "Minuten", "GPS wird geöffnet…", "Gehen, Laufen, Wandern oder Radfahren, erfasst.",
 "Melde dich an, um deine Route, Zwischenzeiten und Bestleistungen aufzuzeichnen.",
 "Dieses Gerät hat kein GPS im Browser.",
 # 65
 "{count} Kilometer. {pace}", "Der Standortzugriff ist aus. Erlaube ihn in den Browser-Einstellungen, um aufzuzeichnen.",
 "Warte auf GPS-Signal. Geh nach draußen, um den Himmel besser zu sehen.", "Neue Bestleistung: {label}.",
 "{message} Deine Aufzeichnung bleibt auf diesem Gerät.",
 # 70
 "Speichern fehlgeschlagen. Deine Aufzeichnung bleibt auf diesem Gerät; versuch es erneut.", "Stark", "Mittel", "Schwach", "DRAUSSEN",
 # 75
 "Aktivität aufzeichnen",
 "Route, Zwischenzeiten, Höhenmeter und Bestleistungen über das GPS deines Handys. Lass diese Seite offen, während du dich bewegst. Aktivitäten bleiben privat, bis du sie teilst.",
 "Eine nicht gespeicherte Aktivität ({n}) ist auf diesem Gerät", "{n} aufgezeichnet · {length} GPS-Punkte.", "Speichern",
 # 80
 "Verwerfen", "Sportart", "Zeit", "GPS", "· etwa",
 # 85
 ". So ungenaue Punkte werden ausgelassen, bis das Signal besser wird.", "Jeden Kilometer ansagen", "Name",
 "Leer lassen für „{sport} am Morgen“", "Wer es sehen kann",
 # 90
 "{n} starten", "Beenden", "Fortsetzen", "Deine Route wird gemessen…", "{n} speichern",
 # 95
 "Zeichne mindestens 30 Sekunden draußen auf, um eine Aktivität zu speichern.", "in Bewegung", "Ø Tempo", "Ø Pace",
 "Neue Bestleistungen",
 # 100
 "+{xp} Punkte", "Zwischenzeiten und Karte ansehen", "Noch eine aufzeichnen", "Deine Aktivitäten, Bestleistungen und Privatzonen →",
 "Im Schnitt {n} Kilometer pro Stunde.",
 # 105
 "Durchschnittliche Pace {m} Minuten {sec} Sekunden pro Kilometer.", "in {time}, {faster} schneller als zuvor",
 "in {time} (deine erste)", "{km} km geradelt", "{km} km zurückgelegt",
 # 110
 "{n} m Aufstieg", "TrackCal — Deine Wochen", "Deine Wochen konnten nicht geladen werden.", "Lädt…",
 "Melde dich an, um deine Wochenübersicht zu sehen.",
 # 115
 "Deine Wochen werden geladen…", "BEWEGEN · DEINE WOCHEN", "Deine", "Wochen",
 "Jeder Spaziergang, Lauf, jede Radtour und jedes Workout, umgerechnet in ein Maß für Anstrengung, damit sich Wochen fair vergleichen lassen.",
 # 120
 "Diese Woche", "MET-min", "Zusätzlicher Nutzen", "Empfehlung erreicht", "Im Aufbau",
 # 125
 "Fitness",
 "Deine durchschnittliche tägliche Anstrengung über 6 Wochen. Ermüdung (letzte Woche) ist {fatigue}; Form ist {form}, du trägst also etwas Müdigkeit mit dir.",
 "Deine durchschnittliche tägliche Anstrengung über 6 Wochen. Ermüdung (letzte Woche) ist {fatigue}; Form ist {form}, du bist also frisch.",
 "Deine durchschnittliche tägliche Anstrengung über 6 Wochen. Ermüdung (letzte Woche) ist {fatigue}; Form ist {form}.",
 "× dein Üblich",
 # 130
 "Anstrengung pro Woche", "Diagramm anzeigen", "Tabelle anzeigen",
 "Anstrengung in MET-Minuten für die letzten {length} Wochen. Diese Woche: {met_minutes}. Die WHO-Empfehlung liegt bei {minimum} bis {more}.",
 "Woche vom {n}: {met_minutes} MET-Minuten, {minutes} Minuten, {active_days} aktive Tage",
 # 135
 "WHO-Minimum", "Mehr Nutzen", "Woche vom {n}", "{met} MET-Minuten · {minutes} Min. · {count} aktive Tage", "{n} km per GPS",
 # 140
 "Woche vom", "MET-Minuten", "GPS-km", "Fitness und Ermüdung", "Fitness (6 Wochen)",
 # 145
 "Ermüdung (1 Woche)", "Heute Fitness {n} und Ermüdung {n2}, über die letzten {length} Tage.", "Ermüdung",
 "Fitness {n} · Ermüdung {n2}", "An dem Tag: {n} MET-Minuten",
 # 150
 "Fitness steigt langsam mit regelmäßigem Training; Ermüdung steigt und fällt schnell. Wenn die Ermüdung deutlich über der Fitness liegt, hilft ein leichterer Tag, das Training zu verarbeiten.",
 "Du bekommst sie montagmorgens.", "Gespeichert. Bestätige deine E-Mail-Adresse unter Konto, um sie zu erhalten.", "Ausgeschaltet.",
 "Das konnte nicht gespeichert werden. Versuch es erneut.",
 # 155
 "Wöchentliche E-Mail", "Diese Übersicht jeden Montag per E-Mail schicken",
 "Summen und Trend der letzten Woche, gegen 9 Uhr deiner Zeit. Nur Summen: nichts zu Essen, Gewicht oder Gesundheit.",
 "Steh gerade, wie im Beispiel.", "Aufrecht stehen, Rücken lang",
 # 160
 "Halte deinen Körper in einer geraden Linie, wie im Beispiel.", "Halte die Hüfte gerade, wie im Beispiel.", "Körper in einer Linie",
 "Hüfte gerade", "Halte die Beine gestreckt.",
 # 165
 "Beine gestreckt", "Halte die Arme gestreckt.", "Beug die Knie etwa im rechten Winkel", "Beug das vordere Knie beim Schritt etwa im rechten Winkel",
 "Beug das vordere Knie etwa im rechten Winkel",
 # 170
 "Heb die Hüfte, bis dein Körper eine Linie bildet", "Aus der Hüfte beugen, Rücken flach", "Beugen, dann bis auf Brusthöhe schwingen",
 "Beugen, dann ganz über den Kopf heben", "Beug die Ellbogen, um den Kopf abzusenken",
 # 175
 "Streck einen Arm und das andere Bein lang aus", "Heb ein Bein hinter dir an", "Neig dich zur Seite, dann richte dich auf",
 "Heb Brust und Beine vom Boden", "Schlag gerade nach vorn auf Schulterhöhe",
 # 180
 "Heb die Beine etwa im rechten Winkel", "Heb die Beine etwa halb hoch", "Heb die Beine ein wenig",
 "Roll den Oberkörper etwa im rechten Winkel hoch", "Roll den Oberkörper etwa halb hoch",
 # 185
 "Roll den Oberkörper ein wenig hoch", "Beug dich aus der Hüfte etwa im rechten Winkel", "Beug dich aus der Hüfte etwa halb",
 "Beug dich ein wenig aus der Hüfte", "Beug die Knie etwa zur Hälfte",
 # 190
 "Beug die Knie ein wenig", "Beug die Ellbogen etwa im rechten Winkel", "Beug die Ellbogen etwa zur Hälfte", "Beug die Ellbogen ein wenig",
 "Heb die Arme über den Kopf",
 # 195
 "Heb die Arme auf Schulterhöhe", "Heb die Knie etwa auf Hüfthöhe", "Füße etwa schulterbreit", "Knie über den Zehen",
 "Ellbogen nah am Körper",
 # 200
 "Vorderes Knie über dem Knöchel",
])

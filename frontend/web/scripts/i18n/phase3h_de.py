"""Phase 3h, German (du): one activity, segments, workout history and the recovery map, in the order of
coach/phase3h_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3h_keys', 'de', [
 # 0
 "TrackCal — Aktivität", "Diese Aktivität konnte nicht geladen werden.", "Melde dich an, um diese Aktivität zu sehen.", "Aktivität nicht gefunden",
 "Sie ist vielleicht privat oder wurde gelöscht.",
 # 5
 "Deine Aktivitäten →", "Aktivität wird geladen…", "Gespeichert.",
 "„{name}“ löschen? Route, Zwischenzeiten und alle damit aufgestellten Bestleistungen werden entfernt. Das lässt sich nicht rückgängig machen.",
 "Löschen fehlgeschlagen. Versuch es erneut.",
 # 10
 "← Aktivitäten", "Notizen", "Wie hat es sich angefühlt?", "Karte von {name}", "Start, Ziel und die privaten Orte der Person sind verborgen.",
 # 15
 "Bewegungszeit", "Höhenmeter", "Gesamtzeit", "Höchsttempo", "Schnellste 10 s",
 # 20
 "{n} km/h",
 "Aus {n} GPS-Punkten gemessen; {fixes_dropped} ungenaue oder unmögliche Punkte wurden ausgelassen. Pausen zählen nicht zur Bewegungszeit.",
 "Aus {n} GPS-Punkten gemessen. Pausen zählen nicht zur Bewegungszeit.", "Zwischenzeiten", "Bestleistungen",
 # 25
 "Gemeinsam", "Kudos und Kommentare", "Um das im Feed mit Kudos und Kommentaren zu zeigen,", "wähl einen Namen im Feed",
 ", dann ändere, wer es sehen kann.",
 # 30
 "Teilen", "Name und Notizen bearbeiten", "Aktivität löschen", "TrackCal — Segment", "Dieses Segment konnte nicht geladen werden.",
 # 35
 "Segment", "Melde dich an, um dieses Segment zu sehen.", "Segment nicht gefunden", "Es ist vielleicht privat oder wurde entfernt.",
 "Deine Segmente →",
 # 40
 "Segment wird geladen…", "„{name}“ entfernen? Die Zeiten werden für alle gelöscht. Das lässt sich nicht rückgängig machen.", "← Segmente",
 "RAD-SEGMENT", "LAUF- UND GEH-SEGMENT",
 # 45
 "NUR DU", "Länge", "Deine Bestzeit", "Deine Durchgänge", "Deine Zeiten",
 # 50
 "Beste", "Noch keine Durchgänge. Lauf oder fahr es von Anfang bis Ende, und deine Zeit erscheint hier.", "Rangliste unter Freunden",
 "Rangliste mit Freunden anzeigen",
 "Nur Personen, denen du folgst und die dir zurück folgen und das ebenfalls eingeschaltet haben, aus Aktivitäten, die du sehen darfst. Keine Ranglisten mit Fremden. Deine eigenen Zeiten bleiben immer deine.",
 # 55
 "Hier sind noch keine Freunde. Wenn Personen, denen du gegenseitig folgst und die die Rangliste eingeschaltet haben, hier durchkommen, erscheinen sie hier.",
 "Segment entfernen", "Eingetragen", "Gestern", "Gib dem Workout einen Namen.",
 # 60
 "Workout", "Beintag, Schwimmen, Yoga…", "Wiederholungen pro Satz", "Mehr konnte nicht geladen werden. Versuch es erneut.",
 "{title} konnte nicht gelöscht werden. Versuch es erneut.",
 # 65
 "Rückgängig machen fehlgeschlagen. Versuch es erneut.", "Anzeigen", "Deine Workouts konnten gerade nicht geladen werden. Deine Daten sind sicher;",
 "versuch es erneut", "{title} gelöscht.",
 # 70
 "Deine Workouts werden geladen…",
 "Noch keine Workouts. Ein Kamera-Workout, eine aufgezeichnete Route oder ein hier eingetragenes Workout erscheint in dieser Liste.",
 "Davon gibt es noch nichts.", "Öffnen", "{title} bearbeiten",
 # 75
 "{title} löschen", "Mehr laden", "Heute trainiert", "Erholt sich", "Fast bereit",
 # 80
 "Deine Erholungskarte wird geöffnet…", "Sieh, welche Muskeln bereit sind.", "Melde dich an, und deine Kamera-Workouts füllen diese Karte von selbst.",
 "Deine Workouts konnten nicht geladen werden. Versuch es gleich noch einmal.", "GEFÜLLT DURCH DEINE WIEDERHOLUNGEN",
 # 85
 "Muskeln, die du mit der Kamera trainiert hast, verblassen über drei Tage. Das ist eine Faustregel, keine Messung deines Körpers, also richte dich nach deinem Gefühl.",
 "Du hast dir eine schwerere Übung verdient. Schau unten.", "Das hat dein Körper so gemacht.",
 "Speichere ein Kamera-Workout, und ich fülle das für dich aus.",
 "Noch nichts da. Speichere ein Kamera-Workout, und deine Muskeln leuchten von selbst auf.",
 # 90
 "Gut für heute", "{title} trainiert {muscles} und schont deine müden Muskeln.", "{title} trainiert {muscles}.", "Bereit für Schwereres",
 "Du hast {reps} {n} gemacht, die die Kamera gesehen hat.",
 # 95
 "{title} ausprobieren", "Platz {place} deiner Zeiten", "Segment erstellen", "{n} km · {n2}",
 "Diese Route wurde noch auf keinem Segment gemessen. Erstelle eins aus einem Abschnitt, den du oft läufst oder fährst, und jeder spätere Durchgang wird gestoppt.",
 # 100
 "Dieses Segment konnte nicht erstellt werden.", "Wähl den Abschnitt", "Der Abschnitt von {n} km bis {n2} km", "Beginnt bei", "Endet bei",
 # 105
 "{n} km lang · mindestens 200 m", "{n} km lang", "Parkrunden-Sprint", "Alle",
 "Jeder, der hier läuft oder fährt, wird gestoppt. Es darf deine Privatzonen und die ersten und letzten 200 m dieser Route nicht enthalten.",
 # 110
 "Nur ich", "Stoppt nur deine eigenen Aktivitäten. Kann überall sein.", "Deine Läufe werden gestoppt…", "Segment erstellen", "TrackCal — Segmente",
 # 115
 "Segmente konnten nicht geladen werden.", "Melde dich an, um deine Segmente zu sehen.", "BEWEGEN · SEGMENTE", "Segmente",
 "Lieblingsabschnitte auf Straße und Weg. Jeder Lauf, Spaziergang oder jede Radfahrt darüber wird anhand der Route gestoppt, damit du gegen dein früheres Ich antreten kannst.",
 # 120
 "Segmente werden geladen…", "Nur du", "{km} km · {count} Durchgänge", "Noch nicht gestoppt", "Noch keine Segmente",
 # 125
 "Öffne einen deiner Läufe, Spaziergänge oder Radfahrten und wähl", ". Nimm einen Abschnitt, den du oft machst, etwa einen Hügel oder eine Parkrunde.",
 "Zweitbeste", "Drittbeste", "Gehen",
 # 130
 "Laufen", "Wandern", "Radfahren", "Niemand sonst kann es sehen.", "Personen, die du bestätigt hast. Start und Ziel sind verborgen.",
 # 135
 "Alle auf TrackCal. Start, Ziel und Privatzonen sind verborgen.", "Aktivitäten sind gerade nicht verfügbar. Es wurde nichts geändert.",
 "Ø Tempo", "Keine Route anzuzeigen. Geteilte Routen verbergen Start und Ziel, eine kurze kann also ganz verborgen sein.", "Höhe von {n} m bis {n2} m",
 # 140
 "Höhe", "Km", "Relative Pace",
])

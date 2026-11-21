"""Phase 3c, German (du): the camera workout screen (components/camera-workout.tsx), in the order of
coach/phase3c_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3c_keys', 'de', [
 # 0
 "Kamera-Workouts werden geöffnet…", "Bewegung, in deinem Tempo.",
 "Melde dich an für private Workouts mit Kamera. Deine Kamera bleibt aus, bis du startest.",
 "Manuelle Workouts →", "Der Kontoverlauf ist nicht verfügbar. Du kannst lokal prüfen; versuch es vor dem Speichern erneut.",
 # 5
 "Ich sehe die Bewegung nicht deutlich. Richte die Kamera neu aus.", "Die Erfassung läuft. Du kannst jederzeit pausieren.",
 "Kamera nicht verfügbar. Nutze manuelle Workouts.",
 "Satz lokal gespeichert. Ruh dich so lange aus, wie du brauchst, dann starte die Kamera wieder.",
 "Kamera aus. Prüf und bestätige dein Workout vor dem Speichern.",
 # 10
 "Kamera aus. Prüf und bestätige deine Schätzungen vor dem Speichern.", "Neue Bestleistung: {n} {exercise}! {cheer}",
 "Bestätigte Ergebnisse werden gespeichert…", "Deine Aktivität ist gespeichert!",
 "Speichern fehlgeschlagen. Dein Prüfentwurf bleibt erhalten.",
 # 15
 "Dein Workout wird gespeichert…", "Dein Workout ist gespeichert!",
 "Speichern fehlgeschlagen. Die noch nicht gespeicherten Übungen bleiben hier; versuch es erneut.",
 "Workout verworfen. Keine XP vergeben.",
 "Der Server hat dieses Workout schon gespeichert. Dein Verlauf ist verfügbar, ohne es erneut zu senden.",
 # 20
 "Entwurf verworfen. Keine XP vergeben.",
 "Die unvollständige Einheit konnte nicht gelöscht werden. Deine Prüfung bleibt erhalten; versuch es erneut.",
 "Dein Muskel-Workout", "{name} ist bereit. Schalte die Kamera ein, um zu beginnen.",
 "Workout beendet. Prüf und bestätige vor dem Speichern.",
 # 25
 "Workout geschafft. Gut gemacht.", "{rest} Sekunden Pause. Als Nächstes: {title}", "{title} starten",
 "Deine Wiederholungen sind um {slowed} % langsamer geworden. Ein guter Moment aufzuhören, wenn es schwer wird.",
 "Du wirst langsamer. Hör auf, wenn es schwer wird.",
 # 30
 "Ziel erreicht. Zusätzliche Wiederholungen zählen trotzdem.", "Ziel erreicht", "Erfassung startet…",
 "Eine Wiederholung abziehen", "Eine Wiederholung hinzufügen",
 # 35
 "PRIVAT · AUF DEM GERÄT · DEIN TEMPO", "Schaff Platz für Bewegung.",
 "Kameragestütztes Zählen für bekannte Übungen. Schätzungen, keine Bewertung der Technik oder medizinischen Sicherheit.",
 "Manuelle Workouts öffnen →", "Ein Prüfentwurf wartet",
 # 40
 "In diesem Kontobereich werden nur Zählzusammenfassungen lokal gespeichert. Keine Bilder, keine Körperpunkte.",
 "Kamera-Prüfung wiederherstellen", "Gespeicherten Prüfentwurf verwerfen", "Technik-Hinweise zu diesem Satz",
 "Regelbasierte Tipps aus deiner Körperhaltung. Hilfreiche Hinweise, keine Sicherheitsprüfung.",
 # 45
 "Prüf deine Technik", "Dein aufgenommener Satz",
 "Sieh dir an, wie du dich bewegt hast. Das Video dient nur zur Haltungskontrolle: Dein Tagebuch speichert die Zahlen, nicht das Video. Es bleibt in diesem Browser und ist weg, sobald du die Seite verlässt.",
 "Kopie auf diesem Gerät behalten", "Videos mit Premium speichern",
 # 50
 "Video verwerfen", "Ein Workout wartet aufs Speichern", "Workout prüfen", "Prüf dein Workout",
 "Kamera aus. Du kannst jede Zahl anpassen. Übungen unter einer Minute werden als eine Minute gespeichert.",
 # 55
 "Kamera-Schätzung: {estimated_reps} Wiederholungen", "Bestätigte Wiederholungen für {title}", "Bestätigen und speichern",
 "Workout verwerfen", "Prüf deine Bewegung",
 # 60
 "Kamera aus · {title}. Du kannst jede Zahl anpassen. Die Sicherheit beschreibt, wie gut die Erfassung sieht, nie die Qualität der Übung.",
 "Satz {n}", "Kamera-Schätzung beibehalten", "Von dir korrigierte Wiederholungen",
 "{n} % mittlere Punktsicherheit · {frames} ausgewertete Bilder",
 # 65
 "Bestätigte Wiederholungen für Satz {n}", "Aufgezeichnete Minuten",
 "Aktive Kamerazeit: {n} Min. {n2} Sek. Ein Satz unter einer Minute wird als eine Minute gespeichert. Du kannst das ändern.",
 "Kamera-Prüfung verwerfen", "Workout geschafft",
 # 70
 "Wiederholungen", "Punkte", "Tage in Folge",
 "+{addedBack} kcal zum heutigen Essensbudget hinzugefügt, die Hälfte dessen, was die Wiederholungen etwa verbrannt haben.",
 "Die heutigen Trainingspunkte hast du schon. Deine Serie ist sicher, komm morgen wieder.",
 # 75
 "Dein privater Verlauf speichert Schätzungen und Korrekturen getrennt. Erholung und Pausen sind willkommen.",
 "Gespeichertes Workout ansehen →", "Erfolge ansehen →", "● Kamera aktiv — lokales Modell lädt…",
 "● Kamera aktiv — nur lokal",
 # 80
 "Warte auf Kamera-Erlaubnis…", "Kamera aus", "Kamera jetzt stoppen", "Live-Vorschau der Workout-Kamera",
 "Ziel erreicht · +{extra} extra. {coach}",
 # 85
 "Ziel erreicht. {coach}", "Mitmachen", "Deine private Ansicht wird vorbereitet", "Dein Raum. Dein Tempo.",
 "Das lokale Modell lädt. Du kannst jederzeit aufhören.",
 # 90
 "Kein Kamerazugriff, bis du Kamera einschalten wählst.", "Zählen pausiert: {message}",
 "Pause {resting} s · Als Nächstes: {title}", "Pause überspringen", "{name} · Übung {n} von {length}",
 # 95
 "Sparmodus · {fps} fps", "Bewegungs-Feedback ist aus.", "{count} geschätzte Wiederholungen · Satz {n}",
 "{n}:{n2} · {n3} % Sicherheit", "Kamera-Erfassung pausieren",
 # 100
 "Kamera-Erfassung fortsetzen", "Kamera-Ergebnisse prüfen", "{name}: {length} Übungen", "Workout abbrechen", "Geräte",
 # 105
 "Geräteart", "Alle", "Schwierigkeit", "Trainingsart", "Alle Arten",
 # 110
 "Nach Muskel wählen →", "Übung", "Trainiert:", "Art:", "Geräte:",
 # 115
 "Schwierigkeit:", "Nur {n} werden gezählt. Andere Bewegungen werden ignoriert.", "Stufe",
 "Nach meinem eigenen Bewegungsumfang zählen",
 "Gezählt wird bis zur Tiefe, die du meist erreichst, gelernt aus deinen letzten {sets} Sätzen. Geh etwas tiefer, wenn es sich gut anfühlt: Das Ziel wächst mit.",
 # 120
 "Du erreichst den vollen Umfang: gezählt bis zur Standardtiefe.", "Gezählt bis zur Standardtiefe.",
 "Dein Bewegungsumfang ist seit deinen früheren Einheiten um {gained}° gewachsen.", "Ziel-Wiederholungen",
 "Dein Gewicht (kg)",
 # 125
 "Sprachcoach an", "Sprachcoach: sagt deine Zahl und Tipps laut an",
 "Meinen Satz aufnehmen, um die Technik zu prüfen. Bleibt auf diesem Gerät.", "Experimentell.",
 "Die Zählgenauigkeit wurde noch nicht auf echten Handys gemessen; prüf die Zahl und korrigier sie.",
 # 130
 "Geschätzte Wiederholungen", "Aktuelle Wiederholungen", "Kamera-Schätzung · Satz {set} · Ziel {target}",
 "Von dir korrigiert · Satz {set} · Ziel {target}", "Geschafft · +{extra} extra",
 # 135
 "Geschafft", "Etwa {calories} kcal verbrannt, grob {bodyGrams} g Körpergewicht. Eine grobe Schätzung.",
 "Aktive Zeit", "Erfassungssicherheit", "Einheit:",
 # 140
 "EINRICHTUNG", " · {fps} fps · {n}", "Aktuelle Wiederholungen anpassen", "Erkannte Zahl verwenden",
 "Erfassung pausieren",
 # 145
 "Kamera einschalten", "Erfassung fortsetzen", "Satz beenden und pausieren", "Beenden und Einheit prüfen",
 "Aktueller Satz zurückgesetzt. Frühere Sätze bleiben. Keine Belohnung geht verloren.",
 # 150
 "Aktuellen Satz zurücksetzen", "Kamera-Einstellungen und Datenschutz",
 "Kamerabilder werden im Speicher deines Geräts verarbeitet. Kein Video-Upload, kein Mikrofon, kein gespeicherter Verlauf von Körperpunkten. Nichts wird aufgenommen, außer du hakst die Technikprüfung an, und dieses Video bleibt in diesem Browser. Ein einfacher Umriss deiner besten und flachsten Wiederholung bleibt im Speicher, bis du die Seite verlässt. Beim Speichern gehen nur bestätigte Zahlen und zusammengefasste Erfassungsdaten an dein Konto.",
 "Standardkamera", "Kamera {n}",
 # 155
 "Zur Rückkamera wechseln", "Zur Frontkamera wechseln",
 "Erst pausieren, dann wechseln. Die Kamerawahl hängt von deinem Browser ab.", "Skelett einblenden",
 "Bewegungs-Feedback anzeigen",
 # 160
 "Ton oder Vibration bei jeder gezählten Wiederholung", "Passende geplante Aktivität (optional)", "Separates Workout",
 "{name} · heute",
 "Um eine andere Plan-Aktivität zu verknüpfen, wähl zuerst in Mein Plan ausdrücklich einen passenden Kamera-Ersatz. Kamera-Übungen werden nie automatisch verordnet.",
 # 165
 "Stattdessen manuell erfassen →",
 "Nur eine Person im Bild. Ein ruhiges Handy und gleichmäßiges Licht verbessern die Erfassung. Teilweise Sichtbarkeit, Kamerabewegung, Kleidung, unterschiedliche Körper und ungewöhnliche Winkel können zu fehlenden oder falschen Zählungen führen. Keine Garantie für Genauigkeit, keine Diagnose.",
 "Dein Datenschutz →",
])

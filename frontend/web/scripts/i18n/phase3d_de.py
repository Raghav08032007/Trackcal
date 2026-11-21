"""Phase 3d, German (du): the workout dashboard (components/workout-dashboard.tsx), in the order of
coach/phase3d_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3d_keys', 'de', [
 # 0
 "Workouts werden geöffnet…", "Bewegung, die zu deinem Leben passt.",
 "Melde dich an für fortsetzbare Workouts, gespeicherte Vorlagen und einen privaten Verlauf.",
 "Vorhandene lokale Workout-Tools", "Meine angenehme Einheit",
 # 5
 "Workouts konnten nicht geladen werden.", "Speichere oder verwirf die lokalen Änderungen, bevor du eine andere Einheit öffnest.",
 "Speichern fehlgeschlagen; dein lokaler Entwurf bleibt erhalten.", "Speichere oder verwirf zuerst die lokalen Änderungen.",
 "Einheit gestartet und gespeichert. Keine XP fürs Öffnen.",
 # 10
 "Einheit geschafft · +{awarded_xp} Teilnahme-XP. Ruhe und Erholung sind willkommen.",
 "Pausiert. Deine Sätze sind gespeichert.", "Verlauf korrigiert. Keine doppelten XP.",
 "Fortschritt der Einheit in deinem Konto gespeichert.", "GUT BEWEGEN. GUT ERHOLEN.",
 # 15
 "Dein Tempo.",
 "Wähl eine vertraute Aktivität, speichere deine Sätze und schaff Raum für Erholung. Keine Körper-Ranglisten, keine perfekten Serien.",
 "Bibliothek entdecken →", "Deine gespeicherten Daten sind sicher. Lade dein Konto erneut.", "Deine Einheiten werden geladen…",
 # 20
 "Auf diesem Gerät bleibt ein lokaler Entwurf erhalten.", "Workouts neu laden", "Deine Aktivitätsübersicht",
 "Private Kamera-Erfassung ausprobieren →", "Abgeschlossene Einheiten",
 # 25
 "Dein privater Kontoverlauf", "Erfasste Bewegung", "Selbst angegeben, kein Trainingsziel", "Persönlicher Plan",
 "Nicht begonnen",
 # 30
 "Wochenplan ansehen ↗", "Geplante Aktivitäten", "{day} · {status} · {minutes} Minuten", "Geplante Einheit starten",
 "Flexiblen persönlichen Plan erstellen",
 # 35
 ", oder wähl unten eine vertraute Aktivität.", "Vertraute Bewegungen entdecken", "Übungsbibliothek aktualisiert.",
 "Keine passenden geprüften Übungen. Pass die Filter an oder wähl Erholung.", "Übungssuche",
 # 40
 "Mobilität, Gehen, Kraft…", "Übungskategorie", "Alle Kategorien", "Gerätefilter", "Beliebige Geräte",
 # 45
 "Übungen suchen", "Sicherheit, Barrierefreiheit und Alternativen", "Bewegung: {movement} · Geräte: {list}", "keine",
 "Barrierefreiheit: {n} · Alternative: {alternative}",
 # 50
 "{review}. Es werden keine unlizenzierten Vorführmedien angezeigt.", "Hinzugefügt", "Übung aus Favoriten entfernt.",
 "Übung als Favorit gespeichert.", "Aus Favoriten entfernen",
 # 55
 "Als Favorit speichern", "Dein gewähltes Workout", "Wähl eine oder mehrere vertraute Übungen.", "Name des Workouts",
 "Workout starten",
 # 60
 "Workout-Vorlage gespeichert. Keine XP für wiederholte Vorlagen.", "Workout-Vorlage speichern",
 "Deine abgeschlossene Einheit", "Deine Einheit, laufend gespeichert", "Bereit, wenn du es bist",
 # 65
 "· {status} · Gespeicherte Version {revision}",
 "Änderungen auf diesem Gerät gespeichert. Speichere den Fortschritt, um mit deinem Konto zu synchronisieren.",
 "Kontoversion geladen. Sätze bleiben privat.",
 "Ein anderer lokaler Entwurf bleibt erhalten, bis du ausdrücklich eine andere Einheit öffnest.", "Übung {n}",
 # 70
 "Übung {n} ersetzen",
 "Übung in deinem lokalen Entwurf geändert; die Sätze wurden gelöscht, um falsche Zuordnung zu vermeiden. Verknüpfte Einheiten müssen zum persönlichen Plan passen.",
 "Geprüfte Übungsdetails findest du in der Bibliothek.", "Gewicht in kg", "· Übung",
 # 75
 "Satz", "Satz {n} entfernen", "Satz zu Übung {n} hinzufügen", "Private Notizen zur Einheit", "Korrektur speichern",
 # 80
 "Fortschritt speichern", "Einheit fortsetzen", "Einheit pausieren", "Workout abschließen", "Unvollständige Einheit beenden",
 # 85
 "Belohnungen haben gemeinsame Tageslimits. Mehr Sätze, schwerere Gewichte und längere Einheiten bringen keine zusätzlichen XP.",
 "Optionaler Pausentimer: {rest} s", "Pausentimer stoppen", "30-Sekunden-Pause starten",
 "Kein Ton, keine Benachrichtigung. Ruh dich so lange aus, wie du brauchst.",
 # 90
 "Neueste Kontoversion geladen.", "Lokale Änderungen verwerfen und neu laden",
 "Starte ein vertrautes Workout oder öffne eine gespeicherte Einheit. Du musst nicht jeden Tag trainieren.",
 "Gespeicherte Einheit öffnen",
 "Ein lokaler Entwurf einer Einheit bleibt erhalten. Öffne die Einheit im Verlauf, um sie vor dem Verwerfen zu prüfen.",
 # 95
 "Gespeicherte Workouts und Favoriten", "Gespeichertes Workout nutzen", "Workout-Vorlage löschen",
 "Speichere eine vertraute Kombination oder markiere eine Übung als Favorit, um sie hier zu finden.",
 "Dein Aktivitätskalender und Verlauf",
 # 100
 "Abgeschlossene Einheiten in den letzten sieben Tagen", "{count} abgeschlossene Einheiten am {day}",
 "Teilnahme und Lernen, nie Körpervergleiche.", "{n} · {status} · {minutes} erfasste Minuten",
 "{count} Übungen · Kamera-Schätzungen · von dir bestätigt",
 # 105
 "{count} Übungen · Manuell eingetragene Wiederholungen", "Satz {n}: Kamera {reps} · Schätzung beibehalten",
 "Satz {n}: Kamera {reps} · von dir korrigiert {corrected}", "Einheit öffnen",
 "Einheit aus dem Verlauf entfernt. Verdiente Teilnahme-XP bleiben erhalten.",
 # 110
 "Einheit löschen", "Deine erste gespeicherte Einheit erscheint hier. Keine Beispieldaten, keine Körper-Ranglisten.",
 "Frühere Einheiten", "Weitere Einheiten", "Vorhandene lokale Workout-Daten ↗",
 # 115
 "Lernmeilensteine und persönlicher Zeitplan ↗",
])

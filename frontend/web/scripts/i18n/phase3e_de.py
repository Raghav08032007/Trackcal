"""Phase 3e, German (du): the personal plan and the companion characters (components/personal-dashboard.tsx,
character-companion.tsx), in the order of coach/phase3e_keys.json. Draft: native review needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'coach'))
from lines import table_from

LANGS = ['de']
T = table_from('phase3e_keys', 'de', [
 # 0
 "Dein Plan lädt…", "Eine Routine für deinen Tag.",
 "Melde dich an, um einen persönlichen Wochenplan zu speichern. Das Ernährungstracking als Gast bleibt verfügbar.",
 "Weiter erfassen", "Speichern fehlgeschlagen. Versuch es noch einmal.",
 # 5
 "Dein privater Plan lädt…", "Erneut versuchen", "Machen wir es persönlich.",
 "Dein Entwurf ist bei Schritt {step} gespeichert. Messwerte sind freiwillig.", "Persönliche Einrichtung fortsetzen →",
 # 10
 "Gespeichert · +{awarded_xp} Teilnahme-XP", "Gespeichert. Keine doppelten XP.", "Einstellungen bearbeiten ↗",
 "DEINE WOCHE, IN DEINEM TEMPO", "Persönlicher Plan von {display_name}",
 # 15
 "Dein persönlicher Plan",
 "Basierend auf deinem Zeitplan und deinen Interessen. Ruh dich aus, tausch oder ändere deine Meinung, wann immer du willst.",
 "Aktivitätskalender der Woche", "Sätze in Workout-Einheiten erfassen ↗", "Erstelle einen Wochenplan, wenn du bereit bist.",
 # 20
 "{today} · {timezone} · Abgeschlossene Aktivitäten gibst du selbst an.",
 "Neuer Plan gespeichert. XP für den ersten Plan gibt es nur einmal.", "Plan neu erstellen", "Meinen ersten Plan erstellen",
 "Plan fortgesetzt.",
 # 25
 "Plan pausiert. Verdiente XP sind sicher.", "Plan fortsetzen", "Plan pausieren", "Angepasst an deinen Blutbefund",
 "Quelle: {source}",
 # 30
 "Deine Vorgaben oder Schmerzrückmeldungen brauchen eine fachliche Prüfung. Automatische Übungen sind pausiert; Ruhe ist weiter möglich.",
 "Minuten ·", "· Geräte: {list}", "Alternative: {name}", "Geplante Erholungspause",
 # 35
 "Aktivität starten", "Als erledigt markieren", "Überspringen", "{name} verschieben", "Datum speichern",
 # 40
 "{name} ersetzen", "Rückmeldung zu {name}", "Optionale Rückmeldung wählen", "Angenehm", "Zu anstrengend",
 # 45
 "Schmerzen oder ungewöhnliche Beschwerden — aufhören", "Nichts für mich",
 "Diese Woche sind keine passenden Aktivitätstage mehr übrig. Wähl Tage oder Ruheoptionen in den Einstellungen; du musst nicht jeden Tag trainieren.",
 "Deine Aktivitäts-Rückmeldungen prüfen",
 "Eine Schmerzrückmeldung pausiert die automatische Übungswahl. Wenn ein Eintrag falsch war oder sich dein Befinden geändert hat, prüf ihn hier. Das ist keine ärztliche Freigabe; folge fachlichem Rat.",
 # 50
 "Rückmeldung zu {name} prüfen", "Schmerzen — fachliche Prüfung", "Essensideen nach deinen Vorlieben",
 "Fachliche Vorgaben oder eine nicht unterstützte Allergie müssen geprüft werden, bevor wir Mahlzeiten vorschlagen.",
 "Zutaten prüfen und im Tagebuch eintragen →",
 # 55
 "Geprüftes Rezept und Budgetplaner nutzen ↗", "Ein bisschen Wissen bringt viel", "Richtig · +{xp} XP. {explanation}",
 "Nachlesen und nochmal versuchen · +{xp} XP. {explanation}", "{title} prüfen",
 # 60
 "Privater Messverlauf", "BMI nicht berechnet", "BMI zur Info: {value}",
 "Kein Messwert beeinflusst Belohnungen oder die Intensität der Aktivitäten. Eine Verbindung zu Wearables ist nicht vorgesehen.",
 "Messwert entfernt.",
 # 65
 "{kind}-Eintrag entfernen", "Kontoexport und Datenkontrolle ↗", "Dein Erinnerungsrhythmus",
 "Erinnerungseinstellungen gespeichert. Vorhandene Kalenderexporte bleiben getrennt.", "Zeitzone für Erinnerungen und Plan",
 # 70
 "Persönliche Erinnerungen speichern", "Vorhandene Kalendererinnerungen und Coaching ↗", "Eine Routine, die zu dir passt",
 "Dein Plan ist pausiert.", "Dein persönlicher Aktivitätsplan ist bereit.",
 # 75
 "Erstelle deinen ersten persönlichen Plan.",
 "{n} geplante Aktivitäten erledigt · Mahlzeiten und Messwerte bestimmen nie deinen Wert.",
 "Meine Woche und Essensideen ansehen →", "Bau dir eine persönliche Routine, ganz ohne Pflicht-Körpermaße.",
 "Einrichtung fortsetzen",
 # 80
 "Meine Routine anpassen", "Der wachsende Samen", "Sanfte Ermutigung", "Kleine Schritte machen starke Wurzeln.",
 "Schau, wie du wächst! Jede kleine Mühe zählt.",
 # 85
 "Der neugierige Stern", "Lernen und Entdecken", "Neugier ist deine Superkraft. Lass uns etwas entdecken.",
 "Ein neuer Funke Wissen! Du leuchtest den Weg.", "Der gemütliche Bär",
 # 90
 "Freundlichkeit und Balance", "Hier ist Platz für Ruhe und einen Neuanfang.",
 "Ich bin stolz auf deine Mühe. Nimm dir einen Moment, um es zu genießen.", "Die nachdenkliche Eule", "Planen und Nachdenken",
 # 95
 "Eine überlegte Entscheidung kann morgen leichter machen.", "Ein durchdachter Schritt. Dein nächstes Kapitel nimmt Form an.",
 "Der verspielte Fuchs", "Spiel und Schwung", "Bereit für ein kleines Abenteuer? Machen wir es lustig.",
 # 100
 "Abenteuer geschafft! Ein kleiner Sieg verdient einen Freudentanz.", "Die ruhige Schildkröte", "Geduld und Beständigkeit",
 "Dein Tempo ist ein gutes Tempo. Wir können heute neu anfangen.",
 "Stetiger Fortschritt. Kein Grund, den nächsten Schritt zu überstürzen.",
 # 105
 "SECHS PERSÖNLICHKEITEN. DEIN EIGENES TEMPO.", "Lerne deinen Fortschrittspartner kennen.",
 "Fang mit Pip an. Sammle Punkte und halte eine Serie, um den nächsten Begleiter zu treffen.", "Wähl deinen Charakter",
 "Charakter konnte nicht gespeichert werden. Versuch es noch einmal.",
 # 110
 "Gesperrt · {unlock} Punkte · {streak}-Tage-Serie",
 "{trait}. Sammle {unlock} Punkte und erreiche eine {streak}-Tage-Serie, um diesen Begleiter freizuschalten. Noch {n} Punkte und {n2} Serientage.",
 "Vorschau schließen", "{name} zuwinken", "Tippen, um Hallo zu sagen",
 # 115
 "{name} ist in deinem Team.", "Mach mir Mut", "Hilf mir beim Wählen", "Meinen Tagesplan erstellen", "Meine Erfolge ansehen",
 # 120
 "Meinen nächsten Schritt machen", "Stufe {level} · {xp} XP · {n}-Tage-Aufgabenserie",
 "Eine Freundschaft beginnt mit einem kleinen Schritt", "Fortschritt des Charakters zur nächsten Stufe",
 "Noch {n} XP bis zur nächsten Stufe. ",
 # 125
 "Starte eine Reise, um gemeinsam zu wachsen. ", "Blume ab Stufe 2 · Krone ab 5 · Sonne ab 10",
 "Charaktere feiern Teilnahme, nie Gewicht oder weniger Essen. Die Charakterwahl wird in diesem Bereich gespeichert und in Sicherungen aufgenommen. Die Ermutigungen sind vorgeschrieben, keine ärztlichen Ratschläge.",
 "WIE FANGEN WIR AN?", "Ein bisschen Unterstützung, wie du sie magst.",
 # 130
 "Wähl deinen Check-in", "Ich brauche einen sanften Start", "Ich bin startklar", "Fokusansicht verlassen",
 "Auf meinen Begleiter konzentrieren",
 # 135
 "TIPPS VON {n} FÜR DICH", "Deine nächsten kleinen Erfolge.", "{today} · Basierend auf deinem gespeicherten Quest-Fortschritt",
 "Ein Übungsplan für den Anfang. Melde dich an, um deinen Quest-Fortschritt zu speichern.", "Tagesplan schließen",
 # 140
 "Wähl dein Tagestempo", "Fang mit ein bisschen Neugier an.",
 "Probier ein Etiketten-Rätsel und starte deine freiwillige Reise, wann immer du bereit bist.", "Übungshinweis ausprobieren →",
 "Meine Reise starten",
 # 145
 "Anmelden, um meinen Fortschritt zu speichern", "Die heutigen Quests sind geschafft. Du hast dir eine Pause verdient.",
 "Keine Zusatzaufgaben, keine verlorenen Punkte. Komm morgen für ein neues Kapitel wieder.", "Meine erledigten Quests ansehen →",
 "Mein Tagebuch öffnen",
 # 150
 "Meinen Essensplaner öffnen", "Etiketten-Detektiv starten",
 "{length} von {length2} Tagesquests erledigt · {planXP} XP in diesem Plan", "Erst üben. Gäste bekommen keine XP.",
 "{name} wird auf Stufe {n} freigeschaltet ({unlock} XP) · noch {n2} XP.",
 # 155
 "Deine ganze Begleiter-Crew ist freigeschaltet.",
 "Das ist ein Teilnahmeplan, keine verordnete Diät. Mengen und Ernährungsziele bleiben in deinem Tagebuch und Planer. Eine Aufgabe zu öffnen bringt keine XP; erledigte Aktionen prüft der Server.",
 "Meinen Begleiter mitkommen lassen, während ich diese Seite erkunde", "{name} begleitet dein Abenteuer",
 "Mitlaufenden Begleiter ausblenden",
 # 160
 "{name} ist bei dir", "Ein kleiner Schritt, in deinem Tempo.", "Nächste Quest →", "Feuer mich an",
])

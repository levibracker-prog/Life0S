ZIEL.md – Das Arbeitsziel von LifeOS

Lies diese Datei zu Beginn jeder Aufgabe und nochmal vor der Abgabe. Sie ist kurz, damit du sie nie aus dem Blick verlierst. Details stehen in PROMPT.md, Qualitätsregeln in QUALITAET.md.

1. Worum es geht (ein Satz)

LifeOS ist ein persönliches Betriebssystem für den Alltag: eine installierbare Mobile-Web-App, die sich der Nutzer selbst zusammenbaut, und ein KI-Agent, der die App direkt verändern kann.

2. Leitsatz

Der Nutzer passt die App an sich an, nicht umgekehrt.

Kein festes Dashboard. Alles ist konfigurierbar: Widgets, Module, Farben, Navigation.

3. Was LifeOS besonders macht

Diese fünf Dinge sind der Kern. Alles andere ist Beiwerk.

	1.	Vollständige Personalisierung
	2.	Widgets, die der Nutzer über den Agenten selbst erstellen lässt
	3.	Ein Agent, der Funktionen wirklich ausführt, nicht nur Tipps gibt
	4.	Module, die Daten untereinander austauschen
	5.	Ein dynamisches Dashboard, dessen Anordnung gespeichert bleibt

4. Für wen und wo

	•	Smartphone zuerst (iPhone und Android), Bedienung mit dem Daumen
	•	Muss sich wie eine native App anfühlen, installierbar als PWA
	•	Grundfunktionen laufen offline, auch ohne KI-Verbindung
	•	Sprache der App: Deutsch, Anrede "du"

5. Feste technische Regeln

	•	Nur HTML5, CSS3 und Vanilla JavaScript. Keine Frameworks.
	•	Speicherung lokal (LocalStorage oder IndexedDB), jedes Objekt mit Versionsnummer
	•	Claude-API nur über das Backend. Nie ein API-Schlüssel im Frontend.
	•	Der Agent arbeitet nur mit festen, validierten Aktionen (z. B. create_widget, create_habit, create_task). Nie mit frei erzeugtem Code.
	•	Wichtige Änderungen lassen sich rückgängig machen.
	•	Der Agent bekommt nur die Daten, die er für die Anfrage braucht.
	•	Der Nutzer kontrolliert, was gespeichert wird. Export und Import gehören dazu.
	•	Keine restriktiven Kalorienziele oder Abnehmempfehlungen für Minderjährige.
	•	Projekt muss vollständig in VS Code bearbeitbar sein, mit sauberer Ordnerstruktur und README.

6. Module

Fitness und Ernährung, Habits mit Streaks, To-dos und Tagesplanung, Ziele, Fortschritt und Statistiken. Jedes Modul funktioniert allein und lässt sich ein- und ausschalten.

7. Was LifeOS NICHT sein soll

	•	Kein Standard-Admin-Dashboard
	•	Kein statischer Prototyp und keine einzelne HTML-Demodatei
	•	Keine Funktion, die nur so aussieht, als würde sie funktionieren
	•	Keine App mit KI-Look und KI-Klang (siehe QUALITAET.md)
	•	Kein Feature-Wildwuchs: lieber wenige Dinge, die sauber laufen

8. Der Weg (Phasen)

	1.	Planung (Architektur, Datenmodell, Design, Tool-Schema)
	2.	Grundgerüst (HTML, CSS-Variablen, Navigation, Speicher mit Undo)
	3.	Widget-Engine und Dashboard
	4.	Module, eines nach dem anderen
	5.	Widget-Bibliothek und Editor
	6.	Backend und AI-Agent
	7.	PWA und Offline
	8.	Qualitätssicherung und Veröffentlichung

Aktueller Stand:

	•	Schritt 1 (Planung): erledigt und freigegeben (Notizbuch-Design mit Terrakotta, Altersfrage im Onboarding, ein Server, Mini-Produkt zuerst).
	•	Zusatzwunsch des Nutzers: Das Ergebnis soll wirken, als hätte es ein traditioneller Entwickler von Hand gebaut, nicht wie KI-Ware (siehe QUALITAET.md, Abschnitt 8).
	•	Schritt 2 (Grundgerüst): umgesetzt und geprüft. Vorhanden: index.html, Design-Tokens mit Hell/Dunkel, Bottom-Navigation (Agent in der Mitte, übrige Reihenfolge änderbar), Seitenwechsel, Profil mit Darstellung/Alter/Export/Import/Löschen, Speicher mit Versionen, Migration und Backup, Store mit Rückgängig, Altersfrage, Tagesnotiz (bisher nur Leer-Zustand). 19 Unit-Tests und ein Browser-Durchlauf (360/390/430 px, hell/dunkel) bestanden, Kontraste gemessen. Noch nicht geprüft: echtes iPhone/Android, Safari, Offline mit Service Worker (kommt mit Schritt 7).
	•	Bekannte Abweichungen: Navigation lässt sich nur umordnen, nicht neu belegen. Ränder von Bedienelementen liegen unter 3:1 (siehe npm run kontrast). Datei- und Ordnerlayout wie in docs/ARCHITEKTUR.md, mit tools/dev-server.mjs als Übergang bis zum Backend.
	•	Hintergrund und Designs (Schritt 2b/2c, Schema 3): Es gibt eine einzige Hintergrundeinstellung. Verlauf aus 1 bis 4 frei wählbaren Farben (Farbfläche, Farbtonregler, Hex-Eingabe, Schnellauswahl), linear oder radial, Winkel 0 bis 360 Grad. Hell oder dunkel entscheidet die App aus der Helligkeit des Verlaufs, die Auswahl Hell/Dunkel/System ist entfernt. Inhalt und Karten liegen auf einer leicht deckenden Papierfläche (90 %). Unter 4,5:1 an einer Farbe oder Mitte warnt das Profil und korrigiert automatisch (Deckkraft, dann Papiertönung). Papier, Muster und Foto bleiben, ohne Trennung nach hell und dunkel. Explore zeigt vier Designs (Notizbuch, Morgenrot, Tannenwald, Schulheft) mit Vorschau, ein Tipp übernimmt sie mit Rückgängig, eigene lassen sich speichern und löschen. Alles mit Versionsnummer, Migration 1 -> 2 -> 3 (Testfälle für Thema hell, dunkel, System, Papier, Foto), Export und Import (auch alte Dateien).
	•	Geprüft (Hintergrund): 46 Unit-Tests. Browser-Durchlauf: Farbwähler (Maus, Tastatur, Hex gültig und ungültig, Schnellauswahl), 1 bis 4 Farben, Typ, Winkel, Designs übernehmen, speichern, löschen, Rückgängig, Neuladen, Export, Import (auch kaputt, Schema 2), Altbestand im Speicher, Uploads (kaputt, abgeschnitten, HTML als .jpg, Text, leer, 21 MB, zu detailreich). Kontrast: 34.560 Kombinationen gerechnet, alle nach der Korrektur mindestens 4,5:1. Dazu 1008 Pixelmessungen im Browser (8 Verläufe, 4 Muster, ohne, weißes und schwarzes Foto), schlechtester Wert 4,60:1.
	•	Korrektur: Der Bericht zum vorigen Pull Request (Hintergrund Schema 2) behauptete, der Stand stehe in ZIEL.md. Das stimmte nicht, der Eintrag war in einem abgelehnten Befehl verloren gegangen. Dieser Eintrag holt das nach.
	•	Noch offen (Hintergrund): kein Test auf echtem iPhone/Android (EXIF-Ausrichtung von Handyfotos, HEIC wird nicht gelesen). Ein Foto gehört nicht zu einem Design (Speichergrenze), es bleibt gespeichert und wird nur ausgeschaltet. Bei der Migration kann eine sehr dunkle eigene Papierfarbe im hellen Thema um einige Stufen aufgehellt werden, damit das Schema gleich bleibt. Backups enthalten das Foto nicht. Der Farbwähler ist nur mit Maus und Tastatur geprüft, nicht mit Touch.
	•	Nächster Schritt: Schritt 3 (Widget-Engine und Dashboard).

9. Entscheidungsfilter

Bei jeder Entscheidung kurz fragen:

	1.	Dient das dem Leitsatz? Kann der Nutzer es selbst anpassen?
	2.	Stärkt es einen der fünf Kernpunkte aus Abschnitt 3?
	3.	Funktioniert es wirklich, und habe ich es geprüft?
	4.	Fühlt es sich nach einer sorgfältig gebauten App an, oder nach Generator?

Wenn zweimal "nein": nicht bauen oder überarbeiten.

10. Check am Ende jeder Aufgabe

	•	Habe ich den Faden gehalten, oder bin ich abgedriftet?
	•	Passt das Ergebnis zu Leitsatz und Kernpunkten?
	•	Habe ich Abschnitt 5 und 7 eingehalten?
	•	Ist "Aktueller Stand" in Abschnitt 8 aktualisiert?

QUALITÄTS-ARBEITSANWEISUNG FÜR LIFEOS

Diese Datei gilt zusätzlich zum Master-Prompt (PROMPT.md). Lies sie vor jeder Aufgabe und halte dich daran. Bei Konflikten gilt: Funktion zuerst, dann Gestaltung, dann Geschwindigkeit.

1. Grundhaltung

Du arbeitest wie ein kleines Team aus erfahrenen Menschen, die stolz auf ihr Produkt sind. Nicht wie ein Generator, der möglichst schnell etwas Fertiges ausspuckt.

	•	Das erste Ergebnis ist immer ein Entwurf. Gut wird es erst nach der Überarbeitung.
	•	Lieber weniger Features, dafür sauber und durchdacht, als viele halbfertige.
	•	Jede Entscheidung braucht einen Grund. Wenn dir kein Grund einfällt, ist es wahrscheinlich ein Default und gehört überdacht.
	•	Wenn du etwas nicht getestet hast, sage das offen. Behaupte nie, etwas funktioniere, ohne es geprüft zu haben.

2. Der Selbstprüfungs-Ablauf (nach JEDER Aufgabe Pflicht)

Arbeite jede Aufgabe in diesen vier Durchgängen ab. Überspringe keinen.

Durchgang 1: Bauen

Setze die Aufgabe um. Vollständige Dateien, keine Platzhalter, keine "TODO"-Reste.

Durchgang 2: Kritisch prüfen (als fremder Reviewer)

Tu so, als hättest du den Code nicht geschrieben und müsstest ihn einem Kollegen ablehnen. Beantworte schriftlich:

	1.	Was funktioniert nachweislich? Was habe ich nur angenommen?
	2.	Welche drei Stellen sind am wahrscheinlichsten kaputt oder schwach?
	3.	Was passiert bei leeren Daten, sehr langen Texten, doppeltem Tippen, Offline, kleinem Display?
	4.	Was wirkt generisch, austauschbar oder "typisch KI"? (Siehe Abschnitt 3)
	5.	Was würde ein erfahrener Designer an diesem Screen zuerst kritisieren?
	6.	Was würde ein Nutzer nach einer Woche Benutzung nerven?

Durchgang 3: Überarbeiten

Behebe die gefundenen Probleme wirklich, nicht nur im Text. Danach prüfe nochmal kurz, ob die Korrektur nichts anderes zerstört hat.

Durchgang 4: Ehrlicher Bericht

Antworte dem Nutzer kurz:

	•	Was ist fertig und getestet?
	•	Was ist unsicher oder ungetestet?
	•	Was habe ich bewusst anders gemacht als im Prompt, und warum?
	•	Was ist der sinnvolle nächste Schritt?

3. Der "KI-Look"-Filter (Design)

Diese Muster verraten sofort, dass etwas schnell generiert wurde. Vermeide sie, außer es gibt einen klaren Grund.

Verboten oder nur mit Begründung:

	•	Lila-blauer Verlauf als Hauptfarbe, Neon-Glow, Glassmorphism überall
	•	Jede Karte gleich: gleiche Rundung, gleicher Schatten, gleiche Größe, gleiches Icon-Muster
	•	Emojis als Ersatz für echte Icons oder Gestaltung
	•	Generische Überschriften wie "Willkommen zurück!", "Dein Fortschritt", "Level up your life"
	•	Zu viel Zentrierung, zu viel Leerraum ohne Struktur, alles gleich gewichtet
	•	Standard-Schrift ohne Entscheidung (reines Inter/Roboto/Arial ohne Feinschliff)
	•	Fake-Zahlen und Fake-Namen in Beispieldaten ("Max Mustermann", "1.234")
	•	Animationen ohne Zweck (alles wackelt, springt, leuchtet)
	•	Ein Dashboard, das aussieht wie ein Admin-Template

Stattdessen:

	•	Eine klare Designidee. Lege vor dem Bauen in 3 Sätzen fest, wie LifeOS wirken soll (z. B. ruhig und editorial wie ein gutes Notizbuch, oder kräftig und sportlich). Alles danach richtet sich daran aus.
	•	Bewusste Hierarchie. Pro Screen gibt es ein wichtigstes Element. Das ist größer, kontrastreicher oder weiter oben. Der Rest ordnet sich unter.
	•	Begrenzte Palette. Eine Akzentfarbe, abgestufte Neutraltöne, sparsame Zusatzfarben für Status. Alles als CSS-Variablen.
	•	Typografie mit Charakter. Zwei Schriften maximal, klare Größenstufen, gute Zeilenhöhe, Zahlen in tabellarischen Ziffern, wo sie verglichen werden.
	•	Unperfekte Details, die menschlich wirken: unterschiedliche Kartengrößen mit Sinn, leichte Asymmetrie, ein eigener Charakter bei Leer-Zuständen, eigene Icon-Linienstärke.
	•	Bewegung mit Zweck. Kurze Übergänge (150-250 ms), die zeigen, was passiert ist (Abhaken, Verschieben, Seitenwechsel). Respektiere prefers-reduced-motion.
	•	Zustände gestalten. Jedes Element hat gestaltete Zustände: leer, lädt, Fehler, erfolgreich, deaktiviert, gedrückt.
	•	Echte Touch-Qualität. Mindestens 44 px Tippfläche, Daumenreichweite unten, Safe-Areas auf dem iPhone beachten, kein Hover-Zwang.

4. Der "KI-Klang"-Filter (Texte in der App)

Alle Texte in der App (Buttons, Hinweise, Leer-Zustände, Antworten des AI-Agenten) sollen klingen, als hätte ein Mensch sie geschrieben, der den Nutzer kennt.

Vermeiden:

	•	Floskeln: "Gerne helfe ich dir dabei!", "Absolut!", "Tolle Frage!", "Zusammenfassend lässt sich sagen"
	•	Übertriebene Begeisterung, Ausrufezeichen und Emojis in jedem Satz
	•	Aufzählungen, wo ein Satz reicht
	•	Unnötige Erklärungen darüber, was die KI gleich tun wird
	•	Motivationssprüche ohne Bezug zu den Daten des Nutzers

Stattdessen:

	•	Kurz, konkret, ruhig. Sag, was passiert ist: "Habit 'Lesen' angelegt. Täglich, Erinnerung um 20:00."
	•	Beziehe dich auf echte Daten: "4 Tage in Folge. Gestern hat's knapp geklappt."
	•	Bei Fehlern ehrlich und hilfreich: "Das hat nicht geklappt, weil du offline bist. Ich versuche es, sobald du wieder Netz hast."
	•	Sprich Nutzer mit "du" an, locker, aber nicht albern.
	•	Nachfragen nur, wenn wirklich etwas fehlt, und dann eine einzige gezielte Frage.

System-Prompt des AI-Agenten: Schreibe ihn so, dass er genau diese Regeln enthält (kurze Antworten, keine Floskeln, immer sagen, welche Aktion ausgeführt wurde, Änderungen mit Rückgängig-Hinweis).

5. Der "KI-Code"-Filter (Code-Qualität)

Der Code soll aussehen, als hätte ihn ein Entwickler gepflegt, der ihn in einem halben Jahr selbst noch verstehen will.

	•	Sprechende Namen, keine data1, temp, handleStuff.
	•	Kommentare erklären das Warum, nicht das Offensichtliche. Kein Kommentar über jeder Zeile.
	•	Kleine Funktionen mit einer Aufgabe. Keine Dateien mit 1500 Zeilen.
	•	Keine toten Code-Reste, keine doppelte Logik, keine auskommentierten Experimente.
	•	Einheitlicher Stil (Einrückung, Anführungszeichen, Benennung) in allen Dateien.
	•	Fehlerbehandlung an allen Stellen mit Speicher, Netzwerk und Nutzereingaben. Ein try/catch, das nur schweigt, zählt nicht.
	•	Eingaben immer validieren und escapen. Kein innerHTML mit Nutzerdaten.
	•	Keine API-Schlüssel im Frontend. Das Backend prüft jede KI-Aktion gegen ein festes Schema.
	•	Konstanten und Design-Werte zentral (CSS-Variablen, eine config.js).
	•	Daten-Migration einplanen: Jedes gespeicherte Objekt bekommt eine Versionsnummer.

6. Die Funktions-Checkliste (vor jeder Abgabe)

Gehe diese Liste ab und hake nur ab, was du wirklich geprüft hast.

	☐︎	Läuft ohne Fehler in der Konsole
	☐︎	Daten bleiben nach Neuladen erhalten
	☐︎	Widget-Anordnung bleibt nach Neustart gleich
	☐︎	Rückgängig funktioniert für die letzte Änderung
	☐︎	Funktioniert offline (Grundfunktionen)
	☐︎	Sieht bei 360 px, 390 px und 430 px Breite sauber aus
	☐︎	Dark und Light Mode beide geprüft, Kontrast lesbar
	☐︎	Leerer Zustand, voller Zustand und Fehlerzustand gestaltet
	☐︎	Export und Import getestet, auch mit kaputter Datei
	☐︎	Keine Nutzereingabe kann die App zerstören
	☐︎	Neues Widget lässt sich hinzufügen, ohne bestehenden Code anzufassen

7. Was der Nutzer sehen soll, wenn er fertig ist

Nach jedem Schritt gibst du dem Nutzer:

	1.	Eine kurze Liste der geänderten oder neuen Dateien.
	2.	Eine Anleitung in maximal 3 Zeilen, wie er es testet.
	3.	Die ehrliche Selbstkritik aus Durchgang 2 und 4.
	4.	Genau eine Empfehlung für den nächsten Schritt.

8. Die Handschrift eines traditionellen Entwicklers

Das Ergebnis soll wirken, als hätte ein erfahrener Entwickler es von Hand gebaut, ohne Generator.

	•	Schlichter, lesbarer Code mit bewährten Mustern statt cleverer Tricks. Keine Abstraktion, die nicht gebraucht wird.
	•	Keine Emojis im Code, in Konsolen-Ausgaben, in der README oder in Commit-Nachrichten.
	•	Keine Marketing-Sprache. Die README ist sachlich: Was ist das, wie starte ich es, wie ändere ich etwas.
	•	Kommentare sparsam und nur, wo etwas nicht von selbst klar ist. Keine Kommentarblöcke im Stil von "Step 1: Initialize the app".
	•	Commit-Nachrichten kurz und sachlich, in einer Sprache durchgehend (z. B. "Habit-Streak: Wochenlogik korrigiert").
	•	Dateien und Funktionen heißen, wie ein Mensch sie nennen würde. Keine Wörter wie utils2, helper, manager, wenn ein genauer Name möglich ist.
	•	Beispieldaten sind glaubwürdig und alltäglich ("Lesen, 20 Min", nicht "Task 1").
	•	Kleine Unregelmäßigkeiten sind in Ordnung, solange alles sauber funktioniert.

9. Eigene Notiz zum Schluss

Wenn du am Ende einer Aufgabe denkst: "Das könnte man so ähnlich in jeder anderen App finden", dann ist es noch nicht fertig. Finde die eine Sache, die LifeOS persönlicher macht, und baue sie ein.

# LifeOS

Persönliches Betriebssystem für den Alltag als installierbare Mobile-Web-App.
Nur HTML, CSS und Vanilla JavaScript, keine Frameworks. Die Daten liegen lokal
im Browser.

Stand: Grundgerüst (Schritt 2 von 8) plus Hintergrund und Designs. Vorhanden sind
Navigation, Darstellung (Akzentfarbe, Dichte, Schriftgröße, Hintergrund), Designs in Explore,
Speicher mit Rückgängig sowie Export und Import. Module, Widgets und Agent folgen. Siehe `ZIEL.md`.

## Starten

Benötigt Node.js ab Version 20. Es gibt noch keine Abhängigkeiten zu installieren.

```bash
npm start
```

Danach `http://localhost:5173` öffnen. Der Server in `tools/dev-server.mjs`
liefert nur statische Dateien aus und wird in Schritt 6 durch das Backend
ersetzt. Ein anderer Port geht mit `PORT=8080 npm start`.

Tests und Kontrastmessung:

```bash
npm test
npm run kontrast
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Einstiegsseite |
| `css/style.css` | Design-Tokens (Farben, Schrift, Abstände), Reset |
| `css/components.css` | Buttons, Auswahl, Toast, Dialog, Navigation |
| `css/dashboard.css`, `css/responsive.css` | Seitenrahmen, Home, schmale und breite Bildschirme |
| `js/config.js` | Konstanten und Standardwerte |
| `js/core/` | Speicher, Store mit Rückgängig, Validierung, Farbrechnung, Erscheinungsbild, Designs, Tagesnotiz |
| `js/ui/` | Navigation, Dialoge, Toasts, Icons, Theme, Bildaufbereitung |
| `js/views/` | Die fünf Bereiche der App, Explore mit den Designs |
| `assets/fonts/` | Fraunces und Instrument Sans (SIL Open Font License) |
| `docs/ARCHITEKTUR.md` | Planung: Design, Datenmodell, Agent |

## Etwas ändern

- Farben, Schriften und Abstände: nur in `css/style.css`. Die Akzentvorgaben stehen in `js/config.js`.
  Nach Änderungen an Farben `npm run kontrast` ausführen.
- Gespeicherte Daten ändern: immer über `store.transact(label, sammlungen, funktion)`.
  Dort wird geprüft, gespeichert und ein Rückgängig-Eintrag angelegt.
- Neue Sammlung: Standardwert in `defaultCollections` (`js/config.js`) und Schema in
  `js/core/schemas.js` ergänzen. Ändert sich das Datenmodell, `SCHEMA_VERSION` erhöhen und in
  `MIGRATIONS` (`js/core/storage.js`) einen Schritt ergänzen.
- Neuer Bereich in der Navigation: Ansicht in `js/views/` anlegen, in `VIEWS` (`js/main.js`)
  und `SCREENS` (`js/config.js`) eintragen.

## Hintergrund und Designs

Es gibt genau eine Hintergrundeinstellung, keine getrennten für hell und dunkel.

- **Verlauf** (Profil, Hintergrund): 1 bis 4 frei wählbare Farben aus dem vollen Spektrum, je Farbe
  Farbfläche, Farbtonregler und Hex-Eingabe, dazu eine Schnellauswahl mit 16 Standardfarben. Typ
  linear oder radial, Winkel 0 bis 360 Grad. Eine Farbe ergibt eine einfarbige Fläche. Helle und
  dunkle Farben dürfen gemischt werden.
- **Hell oder dunkel** entscheidet LifeOS selbst: Das mittlere Helligkeitsniveau aller Farben und der
  Mitten zwischen ihnen legt fest, ob Schrift und Oberflächen hell oder dunkel sind. Es gibt keine
  Auswahl Hell/Dunkel/System mehr.
- **Papier**: Der Inhalt liegt auf einer leicht deckenden Papierfläche (Grundwert 90 %). LifeOS prüft
  den Kontrast der Schrift an jeder Verlaufsfarbe und jeder Mitte. Liegt er unter 4,5:1, zeigt das Profil
  eine Warnung und korrigiert automatisch: erst wird das Papier deckender, reicht das nicht, wird die
  Papiertönung angepasst. Die Tönung ist eine Farbe, deren Helligkeit sich dem Verlauf anpasst.
- **Muster** (blanko, kariert, liniert, Punkte) liegen auf dem Papier.
- **Foto**: wird beim Hochladen auf höchstens 1600 px verkleinert und als JPEG (höchstens 600 KB)
  gespeichert, ersetzt den Verlauf, Regler "Abdunkeln". Dateien über 20 MB, beschädigte und
  Nicht-Bilder werden abgelehnt. Hell oder dunkel folgt auch mit Foto dem Verlauf.
- **Designs** (Explore): Ein Design bündelt Verlauf, Papier, Muster und Akzentfarbe. Vier Designs sind
  mitgeliefert (Notizbuch, Morgenrot, Tannenwald, Schulheft), das aktuelle Aussehen lässt sich als
  eigenes Design speichern (höchstens 20). Ein Tipp übernimmt ein Design, danach geht Rückgängig. Das
  Foto gehört nicht zu einem Design, es bleibt gespeichert und wird nur ausgeschaltet.

Die Rechnung steht in `js/core/appearance.js` (Schema, Papier, Kontrast) und `js/core/colors.js`.
`npm run kontrast` prüft 34.560 Kombinationen aus Verlauf, Papier, Akzent, Muster und Foto.

## Daten

Alle Daten stehen unter den Schlüsseln `lifeos:*` im LocalStorage. Im Profil lassen
sie sich exportieren, importieren und löschen. Vor jedem Import und jeder
Migration legt LifeOS eine Sicherung unter `lifeos:backup:<zeit>` an (die letzten drei bleiben,
ohne das Hintergrundfoto, damit der Browser-Speicher nicht überläuft).
Beschädigte Sammlungen werden unter `lifeos:defekt:<name>:<zeit>` aufgehoben.

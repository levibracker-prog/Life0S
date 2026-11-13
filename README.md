# LifeOS

Persönliches Betriebssystem für den Alltag als installierbare Mobile-Web-App.
Nur HTML, CSS und Vanilla JavaScript, keine Frameworks. Die Daten liegen lokal
im Browser.

Stand: Grundgerüst (Schritt 2 von 8). Vorhanden sind Navigation, Darstellung
(Theme, Akzentfarbe, Dichte, Schriftgröße), Speicher mit Rückgängig sowie
Export und Import. Module, Widgets und Agent folgen. Siehe `ZIEL.md`.

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
| `js/core/` | Speicher, Store mit Rückgängig, Validierung, Tagesnotiz |
| `js/ui/` | Navigation, Dialoge, Toasts, Icons, Theme |
| `js/views/` | Die fünf Bereiche der App |
| `assets/fonts/` | Fraunces und Instrument Sans (SIL Open Font License) |
| `docs/ARCHITEKTUR.md` | Planung: Design, Datenmodell, Agent |

## Etwas ändern

- Farben, Schriften und Abstände: nur in `css/style.css`. Die Akzentvorgaben stehen in `js/config.js`.
  Nach Änderungen an Farben `npm run kontrast` ausführen.
- Gespeicherte Daten ändern: immer über `store.transact(label, sammlungen, funktion)`.
  Dort wird geprüft, gespeichert und ein Rückgängig-Eintrag angelegt.
- Neue Sammlung: Standardwert in `defaultCollections` (`js/config.js`) und Schema in
  `js/core/schemas.js` ergänzen.
- Neuer Bereich in der Navigation: Ansicht in `js/views/` anlegen, in `VIEWS` (`js/main.js`)
  und `SCREENS` (`js/config.js`) eintragen.

## Daten

Alle Daten stehen unter den Schlüsseln `lifeos:*` im LocalStorage. Im Profil lassen
sie sich exportieren, importieren und löschen. Vor jedem Import und jeder
Migration legt LifeOS eine Sicherung unter `lifeos:backup:<zeit>` an (die letzten drei bleiben).
Beschädigte Sammlungen werden unter `lifeos:defekt:<name>:<zeit>` aufgehoben.

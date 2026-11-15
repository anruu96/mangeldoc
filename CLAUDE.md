# CLAUDE.md – MängelDoc

Mobile-first PWA zur Mängeldokumentation bei wiederkehrenden Brandschutzbegehungen an einem Standort (Objekt 1–8, Parkgarage). Der Standort wird in der App eingestellt und liegt nur auf dem Gerät. Oberfläche auf Deutsch (Österreich), läuft statisch auf GitHub Pages unter `https://anruu96.github.io/mangeldoc/`. Kein Backend: alle Daten bleiben im Browser (IndexedDB).

## Stack

- **Vite 8 + React 19** (JavaScript/JSX, kein TypeScript)
- **react-router-dom 7** mit `HashRouter` – URLs wie `/mangeldoc/#/project/123`, damit GitHub Pages bei Reload keine 404 liefert
- **idb** – IndexedDB-Wrapper (DB-Version 2), Stores `projects`, `defects` (Index `projectId`) und `settings` (Schlüssel `main`)
- **jsPDF** – PDF-Bericht (A4, pt)
- **Service Worker** (`public/sw.js`) + `public/manifest.json` → offline nutzbar und installierbar
- **ESLint 9** mit `eslint-plugin-react-hooks` (inkl. React-Compiler-Regeln)

## Befehle

```bash
npm ci && npm run dev   # Dev-Server: http://localhost:5173/mangeldoc/
npm run lint            # muss fehlerfrei sein (läuft auch im Deploy-Workflow)
npm run build           # → dist/
```

## Ordnerstruktur

```
.github/workflows/deploy-pages.yml  Build (Node 20, npm ci, lint, build) + Deploy auf Pages bei Push auf main
index.html                          HTML-Einstieg, Meta-Tags für iOS/Android
vite.config.js                      base-Pfad (Repo-Name) + Plugin, das die Precache-Liste in dist/sw.js schreibt
public/
  manifest.json                     PWA-Manifest (Name, Farben, start_url/scope, Icons)
  sw.js                             Service Worker (Network-first, Cache-Fallback, Precache beim Install)
  icon-*.svg / icon-*.png           App-Icons (PNG für Android/iOS, maskable-Variante ohne runde Ecken)
src/
  main.jsx                          React-Root, HashRouter, Service-Worker-Registrierung
  App.jsx                           Routen
  config.js                         ★ Standort, Objekte, Geschosse, Prioritäten, Textbausteine, PDF-Kopf
  styles.css                        Gesamtes CSS; Farbvariablen in :root
  pages/
    ProjectList.jsx                 /                    Liste der Begehungen, Löschen mit Bestätigung, ⚙
    NewProject.jsx                  /new                 Neue Begehung: fixer Name, Objekt, offene Mängel übernehmen
    ProjectDetail.jsx               /project/:id         Zähler, Geschoss-Wahl, Kamera/Galerie, Raster nach Geschoss
    DefectEdit.jsx                  /defect/:id          Zeichenebene, Geschoss, Bereich, Textbausteine, Priorität, Frist, Status, Nachher-Foto
    Report.jsx                      /report/:projectId   Vorschau, PDF speichern, Teilen
    Settings.jsx                    /settings            Standort, Prüfer, Textbausteine, Datensicherung
  utils/
    db.js                           IndexedDB-Zugriff, Einstellungen, Export/Import der Sicherung
    imageUtils.js                   Kompression (max. 1200 px, JPEG), Zeichnen/Einbrennen der Markierungen
    pdfExport.js                    PDF: Rahmen, Kopf/Fuß, Deckblatt + Übersicht, Mangelseiten mit Schriftfeld
    format.js                       Datum/Uhrzeit, Geschoss-Listen und -Sortierung, Nummerierung, Dateinamen
    share.js                        Teilen (Web Share API) bzw. Download
```

## Häufige Änderungen

- **Art der Begehung / Name**: `SITE.inspectionType`, `reportTitle()` und `projectTitle()` in `src/config.js`. Der Standort selbst kommt aus den Einstellungen (`settings.siteName`) und wird bei jeder Begehung als `address` gespeichert.
- **Objekte**: `OBJECTS` in `src/config.js`.
- **Geschosse**: `DEFAULT_FLOOR_RANGE` (Standard −2 bis 10) und `FLOOR_RANGE_BY_OBJECT` (z. B. Parkgarage −2 bis 9) in `src/config.js`. 0 = EG, negativ = UG.
- **Prioritäten**: `PRIORITIES` in `src/config.js` (die `id` wird gespeichert – bestehende ids nicht umbenennen).
- **Standard-Textbausteine**: `DEFAULT_TEXT_SNIPPETS` in `src/config.js`. Nutzer können sie in der App unter ⚙ ändern; dann gilt deren Liste.
- **Farben der Oberfläche**: CSS-Variablen in `:root` oben in `src/styles.css` (`--accent: #D4620B` usw.). Zusätzlich `theme_color`/`background_color` in `public/manifest.json` und `<meta name="theme-color">` in `index.html` mitziehen.
- **Markierungsfarbe/Strichstärke**: `ANNOTATION_COLOR`, `ANNOTATION_LINE_WIDTH` in `src/config.js`.
- **PDF-Kopf** (Überschrift, Dateiname, Farben, Rahmenfarbe): `PDF_CONFIG` in `src/config.js`. Seitenaufbau (Ränder, Schriftfeld-Größe `SF_*`, Tabellenspalten `COLS`) oben in `src/utils/pdfExport.js`; Kopf/Fuß/Rahmen in `drawFrames()`, Schriftfeld in `drawTitleBlock()`, Deckblatt in `drawCover()`.
- **Repo umbenennen / anderer Pfad**: `BASE` in `vite.config.js` sowie `id`, `start_url` und `scope` in `public/manifest.json` anpassen (Groß-/Kleinschreibung beachten).
- **Icons**: SVG in `public/` ändern und daraus die PNGs neu erzeugen (192, 512, maskable 512 ohne runde Ecken, apple-touch-icon 180).

## Hinweise

- Begehung (`projects`): `name`, `objekt`, `address`, `date`, `currentFloor` (zuletzt gewähltes Geschoss). Alte Projekte aus Version 1 haben kein `objekt` – die Oberfläche muss das vertragen.
- **Keine echten Standorte, Adressen, Firmennamen, Logos oder Personen ins Repo** (auch nicht in Commit-Nachrichten, Beispielen oder Doku) – das Repo ist öffentlich. Solche Angaben gehören in die Einstellungen der App. Datenschutz-Hinweise (`.privacy-note`) in `Report.jsx` und `Settings.jsx` nicht entfernen.
- Einstellungen (`settings`/`main`): `siteName`, `inspector`, `textSnippets`. Firma erscheint bewusst nicht im Bericht.
- Mangel (`defects`): `floor`, `location`, `description`, `status` (`'offen'`/`'behoben'`), `priority`, `deadline` (JJJJ-MM-TT), `afterImageData`, `fixedAt`, `firstSeen`, `carriedFrom` ({ projectId, date } bei übernommenen Mängeln).
- Nummerierung = Position nach `sortDefects()` (Geschoss, dann `firstSeen`) – App-Raster, Vorschau und PDF nutzen dieselbe Funktion.
- Markierungen werden in Pixeln der Zeichenfläche gespeichert, zusammen mit `canvasWidth`. Beim Anzeigen werden sie auf die aktuelle Breite umgerechnet (`scaleAnnotations`), beim Einbrennen auf die Fotogröße (`burnAnnotations`).
- Fotos liegen als JPEG-Data-URL direkt im Mangel-Datensatz.
- Datenbankschema ändern → `DB_VERSION` in `src/utils/db.js` erhöhen und `upgrade()` erweitern.
- Daten in Effects mit `cancelled`-Flag laden (siehe Seiten), sonst meckert die React-Hooks-Lint-Regel.
- jsPDF-Standardschrift (Helvetica) kann nur Latin-1 (Umlaute, ß ja; Emojis, „“, –, … nein). Alle Nutzertexte im PDF über `pdfText()` ausgeben.

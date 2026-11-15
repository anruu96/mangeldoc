# MängelDoc

Mängeldokumentation für Gebäudebegehungen – direkt am Handy, auch ohne Internet.

**App öffnen:** https://anruu96.github.io/mangeldoc/

## Was die App kann

Zugeschnitten auf wiederkehrende **Brandschutzbegehungen an einem Standort**:

- **Begehung starten**: Name wird automatisch vergeben („Brandschutzbegehung *Standort* – TT.MM.JJJJ“), nur das **Objekt** auswählen (Objekt 1–8 oder Parkgarage).
- **Folgebegehung**: Gibt es für das Objekt noch offene Mängel aus einer früheren Begehung, werden sie auf Wunsch übernommen – vor Ort nur noch abhaken, was behoben ist.
- **Geschoss wählen** (2. UG bis 10. OG, Parkgarage 2. UG bis 9. OG). Alle Fotos bekommen automatisch das gewählte Geschoss; beim Stockwechsel einfach umstellen.
- **Mängel fotografieren** – Kamera oder mehrere Fotos aus der Galerie (automatisch auf max. 1200 px verkleinert).
- **Fotos markieren** mit Kreis, Pfeil oder Freihand in Rot (Finger, Stift oder Maus), mit Rückgängig.
- **Mangel beschreiben**: Geschoss, Bereich/Raum, Beschreibung mit **Textbausteinen** zum Antippen, **Priorität** (Sofort / Kurzfristig / Mittelfristig), **Frist**, Status *Offen* oder *Behoben* – bei *Behoben* optional ein **Nachher-Foto** als Nachweis.
- **Übersicht** nach Geschoss gruppiert und fortlaufend nummeriert.
- **Prüfbericht als PDF (A4)**:
  - Rahmen auf jeder Seite, oben „Brandschutzbegehung *Standort*“ und das Datum der Begehung
  - Deckblatt mit Objekt, Datum, Prüfer, Zusammenfassung und **Mängelübersicht** als Tabelle
  - je Mangel eine Seite mit Foto (bzw. Vorher/Nachher), Beschreibung und **Schriftfeld rechts unten** (Objekt, Geschoss, Mangel-Nr., Status, Priorität, Frist, Prüfer, Begehungsdatum)
  - unten links Datum und Uhrzeit der Erstellung, unten rechts „Seite x von y“
  - „PDF speichern“ oder „Teilen“ (Mail, WhatsApp, Teams …)
- **Einstellungen (⚙)**: Standort, Prüfer, eigene Textbausteine, **Datensicherung** (exportieren/einspielen).

**Datenschutz:** Es gibt keinen Server. Alle Begehungen und Fotos bleiben nur auf dem Gerät (im Browser-Speicher). Deshalb unter ⚙ Einstellungen regelmäßig eine **Sicherung erstellen** – damit lässt sich alles auch auf einem neuen Handy wieder einspielen.

**Wichtig:** Berichte und Sicherungen enthalten Fotos, die personenbezogene Daten zeigen können. Nur über **dienstliche Kanäle** versenden bzw. auf **dienstlichem Speicher** ablegen – nicht über private Messenger, private Mail- oder Cloud-Konten. Die App zeigt dazu beim Bericht und bei der Datensicherung einen Hinweis.

## GitHub Pages einschalten (einmalig)

1. Im Repo auf **Settings → Pages** gehen.
2. Bei **Build and deployment → Source** die Option **GitHub Actions** wählen.
3. Fertig. Bei jedem Push auf `main` baut der Workflow `.github/workflows/deploy-pages.yml` die App und veröffentlicht sie. Den Fortschritt sieht man unter **Actions**; nach 1–2 Minuten ist die App unter https://anruu96.github.io/mangeldoc/ erreichbar.

## Am Handy installieren

Die App einmal mit Internet öffnen, danach funktioniert sie auch offline.

**iPhone / iPad (Safari):**
1. https://anruu96.github.io/mangeldoc/ in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil nach oben) tippen.
3. **Zum Home-Bildschirm** wählen und **Hinzufügen** tippen.

**Android (Chrome):**
1. https://anruu96.github.io/mangeldoc/ in **Chrome** öffnen.
2. Oben rechts auf **⋮** tippen.
3. **App installieren** bzw. **Zum Startbildschirm hinzufügen** wählen.

Die App startet dann wie eine normale App im Vollbild mit eigenem Icon.

## Entwicklung

Voraussetzung: Node.js 20.19 oder neuer.

```bash
npm ci          # Abhängigkeiten installieren
npm run dev     # Entwicklungsserver, http://localhost:5173/mangeldoc/
npm run lint    # Code prüfen
npm run build   # Produktions-Build nach dist/
npm run preview # Build lokal ansehen
```

Technik: Vite + React, react-router-dom (HashRouter), IndexedDB über `idb`, PDF über `jsPDF`, Service Worker für Offline-Betrieb. Details für Änderungen stehen in [CLAUDE.md](CLAUDE.md).

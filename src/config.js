// Zentrale Einstellungen von MängelDoc.
// Hier Art der Begehung, Objekte, Geschosse, Prioritäten, Textbausteine und den PDF-Kopf anpassen.
// Die Farben der Oberfläche stehen als CSS-Variablen oben in src/styles.css.
// Standort, Prüfer und eigene Textbausteine stellt man in der App unter ⚙ Einstellungen ein.
// WICHTIG: Das Repo ist öffentlich – hier keine echten Standorte, Firmen oder Namen eintragen.

export const SITE = {
  inspectionType: 'Brandschutzbegehung',
}

// Überschrift im Bericht, z. B. "Brandschutzbegehung Standort A"
// (siteName kommt aus den Einstellungen und liegt nur auf dem Gerät)
export function reportTitle(siteName) {
  return [SITE.inspectionType, (siteName || '').trim()].filter(Boolean).join(' ')
}

// Name einer Begehung, z. B. "Brandschutzbegehung Standort A – 15.11.2026"
export function projectTitle(dateText, siteName) {
  return `${reportTitle(siteName)} – ${dateText}`
}

// Auswahl "Objekt" beim Anlegen einer Begehung
export const OBJECTS = [
  'Objekt 1',
  'Objekt 2',
  'Objekt 3',
  'Objekt 4',
  'Objekt 5',
  'Objekt 6',
  'Objekt 7',
  'Objekt 8',
  'Parkgarage',
]

// Geschosse: von (negativ = Untergeschoss) bis (Obergeschoss), 0 = EG
export const DEFAULT_FLOOR_RANGE = { from: -2, to: 10 }
export const FLOOR_RANGE_BY_OBJECT = {
  Parkgarage: { from: -2, to: 9 },
}

// Priorität eines Mangels (optional)
export const PRIORITIES = [
  { id: 'sofort', label: 'Sofort' },
  { id: 'kurzfristig', label: 'Kurzfristig' },
  { id: 'mittelfristig', label: 'Mittelfristig' },
]

// Standard-Textbausteine für die Mangelbeschreibung
// (in der App unter Einstellungen änderbar)
export const DEFAULT_TEXT_SNIPPETS = [
  'Brandschutztür verkeilt bzw. offen gehalten',
  'Brandschutztür schließt nicht selbsttätig',
  'Fluchtweg verstellt',
  'Notausgang versperrt',
  'Fluchtwegkennzeichnung fehlt bzw. beschädigt',
  'Notbeleuchtung defekt',
  'Feuerlöscher fehlt',
  'Feuerlöscher Prüfplakette abgelaufen',
  'Wandhydrant nicht zugänglich',
  'Brandabschottung bzw. Kabeldurchführung nicht verschlossen',
  'Brandlast im Stiegenhaus gelagert',
  'Rauchmelder fehlt bzw. beschädigt',
]

// Farbe und Strichstärke der Markierungen (Kreis, Pfeil, Freihand)
export const ANNOTATION_COLOR = '#E53935'
export const ANNOTATION_LINE_WIDTH = 3

// Kopf und Farben des PDF-Berichts (RGB-Werte 0–255)
export const PDF_CONFIG = {
  fileSuffix: 'Brandschutzbegehung',
  accentColor: [212, 98, 11], // #D4620B
  openColor: [196, 43, 43], // #C42B2B
  fixedColor: [27, 125, 58], // #1B7D3A
  frameColor: [60, 60, 60],
}

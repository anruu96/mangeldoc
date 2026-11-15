import { DEFAULT_FLOOR_RANGE, FLOOR_RANGE_BY_OBJECT, PRIORITIES } from '../config'

const pad = (n) => String(n).padStart(2, '0')

// Datum im Format TT.MM.JJJJ, z. B. 05.03.2026
export function formatDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

// Datum und Uhrzeit, z. B. 05.03.2026, 14:32 Uhr
export function formatDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`
}

// Frist aus <input type="date"> (JJJJ-MM-TT) als TT.MM.JJJJ
export function formatDeadline(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

// Dateiname nur aus einfachen Zeichen: Umlaute umschreiben, Sonderzeichen entfernen
// (manche Browser verwerfen Dateinamen mit ä, ö, ü, ß)
const UMLAUTS = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' }
export function safeFileName(name) {
  return (name || 'Bericht')
    .replace(/[äöüÄÖÜß]/g, c => UMLAUTS[c])
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^A-Za-z0-9 ._-]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
}

export function countStatus(defects) {
  const fixed = defects.filter(d => d.status === 'behoben').length
  return { total: defects.length, open: defects.length - fixed, fixed }
}

// --- Geschosse ---

export function floorLabel(n) {
  if (n === 0) return 'EG'
  return n < 0 ? `${-n}. UG` : `${n}. OG`
}

export function floorsFor(objekt) {
  const { from, to } = FLOOR_RANGE_BY_OBJECT[objekt] || DEFAULT_FLOOR_RANGE
  const list = []
  for (let n = from; n <= to; n++) list.push(floorLabel(n))
  return list
}

// Reihenfolge für Sortierung: 2. UG < 1. UG < EG < 1. OG …; ohne Geschoss ans Ende
export function floorRank(label) {
  if (!label) return 999
  if (label === 'EG') return 0
  const m = /^(\d+)\. (UG|OG)$/.exec(label)
  if (!m) return 998
  return m[2] === 'UG' ? -Number(m[1]) : Number(m[1])
}

// Mängel nach Geschoss und Aufnahmezeit sortieren; die Position ergibt die laufende Nummer
export function sortDefects(defects) {
  return [...defects].sort((a, b) =>
    floorRank(a.floor) - floorRank(b.floor) ||
    (a.firstSeen || a.createdAt || 0) - (b.firstSeen || b.createdAt || 0) ||
    (a.createdAt || 0) - (b.createdAt || 0)
  )
}

// Sortierte Mängel nach Geschoss gruppieren: [{ floor, items: [{ defect, nr }] }]
export function groupByFloor(sorted) {
  const groups = []
  sorted.forEach((defect, i) => {
    const floor = defect.floor || 'Ohne Geschoss'
    let g = groups[groups.length - 1]
    if (!g || g.floor !== floor) {
      g = { floor, items: [] }
      groups.push(g)
    }
    g.items.push({ defect, nr: i + 1 })
  })
  return groups
}

export function priorityLabel(id) {
  return PRIORITIES.find(p => p.id === id)?.label || ''
}

// "Sofort · bis 31.12.2026"
export function urgencyText(defect) {
  return [priorityLabel(defect.priority), defect.deadline && `bis ${formatDeadline(defect.deadline)}`]
    .filter(Boolean).join(' · ')
}

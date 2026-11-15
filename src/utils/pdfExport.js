import { jsPDF } from 'jspdf'
import { burnAnnotations } from './imageUtils'
import {
  formatDate, formatDateTime, formatDeadline, safeFileName, countStatus,
  sortDefects, priorityLabel, urgencyText,
} from './format'
import { shareOrDownload, downloadBlob } from './share'
import { PDF_CONFIG, SITE, reportTitle } from '../config'

// --- Seitenaufbau (A4 hoch, Einheit pt) ---
const PAGE_W = 595.28
const PAGE_H = 841.89
const FRAME = 20 // Abstand Rahmen zum Blattrand
const X0 = 36 // linker Inhaltsrand
const X1 = PAGE_W - 36 // rechter Inhaltsrand
const CW = X1 - X0 // Inhaltsbreite
const HEADER_LINE_Y = 58
const FOOTER_LINE_Y = PAGE_H - FRAME - 26
const CONTENT_TOP = 76
const CONTENT_BOTTOM = FOOTER_LINE_Y - 10

// Schriftfeld rechts unten
const SF_W = 250
const SF_BAND = 16
const SF_ROW = 26
const SF_H = SF_BAND + 4 * SF_ROW

const DARK = [40, 40, 40]
const GREY = [110, 110, 110]
const LIGHT = [235, 232, 228]
const LINE = [190, 185, 180]

// Die PDF-Standardschrift kennt nur Latin-1: typografische Zeichen ersetzen, Emojis entfernen
export function pdfText(value) {
  return String(value ?? '')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, '')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function imageFormat(dataUrl) {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

// Text auf Breite kürzen und "..." anhängen
function fit(doc, text, width) {
  let t = pdfText(text)
  if (doc.getTextWidth(t) <= width) return t
  while (t.length > 1 && doc.getTextWidth(t + '...') > width) t = t.slice(0, -1)
  return t.trimEnd() + '...'
}

function font(doc, size, style = 'normal', color = DARK) {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

function statusInfo(defect) {
  return defect.status === 'behoben'
    ? { label: 'Behoben', color: PDF_CONFIG.fixedColor }
    : { label: 'Offen', color: PDF_CONFIG.openColor }
}

// Farbiges Status-Etikett, rechtsbündig bei xRight
function statusPill(doc, defect, xRight, yTop) {
  const { label, color } = statusInfo(defect)
  font(doc, 9, 'bold', [255, 255, 255])
  const w = doc.getTextWidth(label.toUpperCase()) + 18
  doc.setFillColor(...color)
  doc.roundedRect(xRight - w, yTop, w, 17, 8.5, 8.5, 'F')
  doc.text(label.toUpperCase(), xRight - w / 2, yTop + 11.8, { align: 'center' })
}

// Bild proportional in ein Feld einpassen und mit dünnem Rand zeichnen
async function drawImageInBox(doc, dataUrl, x, y, w, h) {
  const img = await loadImage(dataUrl)
  const aspect = img.naturalWidth / img.naturalHeight
  let iw = w
  let ih = iw / aspect
  if (ih > h) {
    ih = h
    iw = ih * aspect
  }
  const ix = x + (w - iw) / 2
  doc.addImage(dataUrl, imageFormat(dataUrl), ix, y, iw, ih)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.5)
  doc.rect(ix, y, iw, ih)
  return y + ih
}

// --- Deckblatt ---

function drawCover(doc, ctx) {
  const { project, sorted, settings, begehungDate, createdText } = ctx
  let y = CONTENT_TOP + 22


  font(doc, 10, 'bold', PDF_CONFIG.accentColor)
  doc.text('PRÜFBERICHT', X0, y)
  y += 26
  font(doc, 24, 'bold')
  doc.text(pdfText(SITE.inspectionType), X0, y)
  y += 28
  if (project.address) {
    doc.text(fit(doc, project.address, CW), X0, y)
    y += 26
  } else {
    y -= 2
  }

  // Eckdaten als Tabelle
  const rows = [
    ['Objekt', project.objekt || project.inspectionType || '-'],
    ['Datum der Begehung', begehungDate],
    ['Prüfer', settings.inspector || '-'],
    ['Bericht erstellt', createdText],
  ]
  const rowH = 20
  const labelW = 130
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.5)
  rows.forEach(([label, value], i) => {
    const ry = y + i * rowH
    if (i % 2 === 0) {
      doc.setFillColor(248, 246, 243)
      doc.rect(X0, ry, CW, rowH, 'F')
    }
    font(doc, 9, 'normal', GREY)
    doc.text(label, X0 + 8, ry + 13.5)
    font(doc, 10, 'bold')
    doc.text(fit(doc, value, CW - labelW - 16), X0 + labelW, ry + 13.5)
  })
  doc.rect(X0, y, CW, rows.length * rowH)
  y += rows.length * rowH + 24

  // Zusammenfassung: drei Kästchen
  const { total, open, fixed } = countStatus(sorted)
  const boxes = [
    ['Gesamt', total, DARK],
    ['Offen', open, PDF_CONFIG.openColor],
    ['Behoben', fixed, PDF_CONFIG.fixedColor],
  ]
  const gap = 12
  const bw = (CW - gap * 2) / 3
  boxes.forEach(([label, value, color], i) => {
    const bx = X0 + i * (bw + gap)
    doc.setDrawColor(...color)
    doc.setLineWidth(1.2)
    doc.roundedRect(bx, y, bw, 52, 4, 4)
    font(doc, 22, 'bold', color)
    doc.text(String(value), bx + bw / 2, y + 28, { align: 'center' })
    font(doc, 8, 'bold', GREY)
    doc.text(label.toUpperCase(), bx + bw / 2, y + 43, { align: 'center' })
  })
  y += 52 + 28

  drawOverviewTable(doc, sorted, y)
}

// --- Mängelübersicht (Tabelle, läuft bei Bedarf auf Folgeseiten weiter) ---

const COLS = [
  { key: 'nr', label: 'Nr.', w: 28 },
  { key: 'floor', label: 'Geschoss', w: 52 },
  { key: 'location', label: 'Bereich', w: 100 },
  { key: 'description', label: 'Mangel', w: 0 }, // Rest
  { key: 'urgency', label: 'Priorität / Frist', w: 90 },
  { key: 'status', label: 'Status', w: 52 },
]
COLS[3].w = CW - COLS.reduce((s, c) => s + c.w, 0)

function drawOverviewTable(doc, sorted, startY) {
  const rowH = 18
  let y = startY

  const heading = (text) => {
    font(doc, 13, 'bold')
    doc.text(text, X0, y)
    y += 10
    doc.setFillColor(...LIGHT)
    doc.rect(X0, y, CW, rowH, 'F')
    font(doc, 8, 'bold', GREY)
    let x = X0
    for (const c of COLS) {
      doc.text(c.label, x + 4, y + 12)
      x += c.w
    }
    y += rowH
  }

  heading('Mängelübersicht')
  if (!sorted.length) {
    font(doc, 10, 'normal', GREY)
    doc.text('Keine Mängel erfasst.', X0 + 4, y + 14)
    return
  }

  sorted.forEach((d, i) => {
    if (y + rowH > CONTENT_BOTTOM) {
      doc.addPage()
      y = CONTENT_TOP + 16
      heading('Mängelübersicht (Fortsetzung)')
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 248, 246)
      doc.rect(X0, y, CW, rowH, 'F')
    }
    const { label, color } = statusInfo(d)
    const values = {
      nr: String(i + 1),
      floor: d.floor || '-',
      location: d.location || '-',
      description: (d.description || '-').replace(/\s+/g, ' '),
      urgency: urgencyText(d) || '-',
      status: label,
    }
    let x = X0
    for (const c of COLS) {
      const isStatus = c.key === 'status'
      font(doc, 8.5, isStatus || c.key === 'nr' ? 'bold' : 'normal', isStatus ? color : DARK)
      doc.text(fit(doc, values[c.key], c.w - 8), x + 4, y + 12)
      x += c.w
    }
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.line(X0, y + rowH, X1, y + rowH)
    y += rowH
  })
}

// --- Schriftfeld rechts unten auf jeder Mangelseite ---

function drawTitleBlock(doc, defect, nr, ctx) {
  const x = X1 - SF_W
  const y = CONTENT_BOTTOM - SF_H
  const half = SF_W / 2

  doc.setFillColor(255, 255, 255)
  doc.rect(x, y, SF_W, SF_H, 'F')
  doc.setFillColor(...PDF_CONFIG.accentColor)
  doc.rect(x, y, SF_W, SF_BAND, 'F')
  font(doc, 7.5, 'bold', [255, 255, 255])
  doc.text(fit(doc, ctx.title.toUpperCase(), SF_W - 10), x + 5, y + 11)

  const status = statusInfo(defect)
  const rows = [
    [['Objekt', ctx.project.objekt || '-'], ['Geschoss', defect.floor || '-']],
    [['Mangel-Nr.', String(nr)], ['Status', status.label, status.color]],
    [['Priorität', priorityLabel(defect.priority) || '-'], ['Frist', formatDeadline(defect.deadline) || '-']],
    [['Prüfer', ctx.settings.inspector || '-'], ['Begehung', ctx.begehungDate]],
  ]
  rows.forEach((cells, r) => {
    const ry = y + SF_BAND + r * SF_ROW
    cells.forEach(([label, value, color], c) => {
      const cx = x + c * half
      font(doc, 6.5, 'normal', GREY)
      doc.text(label.toUpperCase(), cx + 5, ry + 9)
      font(doc, 9.5, 'bold', color || DARK)
      doc.text(fit(doc, value, half - 10), cx + 5, ry + 21)
    })
  })

  doc.setDrawColor(...PDF_CONFIG.frameColor)
  doc.setLineWidth(0.4)
  for (let r = 1; r < rows.length; r++) {
    doc.line(x, y + SF_BAND + r * SF_ROW, x + SF_W, y + SF_BAND + r * SF_ROW)
  }
  doc.line(x + half, y + SF_BAND, x + half, y + SF_H)
  doc.setLineWidth(1)
  doc.rect(x, y, SF_W, SF_H)
}

// --- Eine Seite je Mangel ---

async function drawDefectPage(doc, defect, nr, ctx) {
  doc.addPage()

  font(doc, 17, 'bold')
  doc.text(`Mangel ${nr}`, X0, CONTENT_TOP + 14)
  statusPill(doc, defect, X1, CONTENT_TOP + 1)

  font(doc, 10, 'normal', GREY)
  const sub = [defect.floor, defect.location].filter(Boolean).join(' · ')
  if (sub) doc.text(fit(doc, sub, CW), X0, CONTENT_TOP + 32)

  // Textblock: Beschreibung + Zusatzinfos
  const meta = []
  if (defect.firstSeen) meta.push(`Festgestellt am ${formatDate(defect.firstSeen)}`)
  if (defect.carriedFrom) meta.push(`Übernommen aus der Begehung vom ${defect.carriedFrom.date}`)
  if (defect.status === 'behoben' && defect.fixedAt) meta.push(`Behoben am ${formatDate(defect.fixedAt)}`)
  const urgency = urgencyText(defect)
  if (urgency) meta.push(`Priorität / Frist: ${urgency}`)

  const LH = 13
  const sfTop = CONTENT_BOTTOM - SF_H
  const photoTop = CONTENT_TOP + 44
  const minPhotoH = 200
  const desc = pdfText(defect.description || '-')

  // Text über die volle Breite: wie viel Platz bleibt dann fürs Foto?
  font(doc, 10, 'normal')
  let textW = CW
  let descLines = doc.splitTextToSize(desc, textW)
  const textHeight = (lines) => (1 + lines.length + meta.length) * LH
  let photoBoxH = sfTop - 14 - photoTop - (textHeight(descLines) + 20)
  let besideTitleBlock = false

  if (photoBoxH < minPhotoH) {
    const narrow = doc.splitTextToSize(desc, CW - SF_W - 14)
    if (textHeight(narrow) <= SF_H) {
      // Kurzer Text passt links neben das Schriftfeld, Foto bekommt den ganzen Platz darüber
      besideTitleBlock = true
      textW = CW - SF_W - 14
      descLines = narrow
      photoBoxH = sfTop - 14 - photoTop
    } else {
      // Sehr langer Text: Foto behält Mindestgröße, Text wird gekürzt
      photoBoxH = minPhotoH
      const maxLines = Math.max(1, Math.floor((sfTop - 14 - photoTop - minPhotoH - 20) / LH) - 1 - meta.length)
      if (descLines.length > maxLines) {
        descLines = descLines.slice(0, maxLines)
        descLines[maxLines - 1] += ' ...'
      }
    }
  }

  // Fotos: vorher (mit Markierungen) und ggf. nachher
  const before = defect.imageData
    ? await burnAnnotations(defect.imageData, defect.annotations, defect.canvasWidth).catch(() => defect.imageData)
    : null
  const after = defect.status === 'behoben' ? defect.afterImageData : null
  let photoBottom = photoTop
  try {
    if (before && after) {
      const gap = 12
      const w = (CW - gap) / 2
      font(doc, 9, 'bold', GREY)
      doc.text('VORHER', X0, photoTop + 8)
      doc.text('NACHHER', X0 + w + gap, photoTop + 8)
      const b1 = await drawImageInBox(doc, before, X0, photoTop + 14, w, photoBoxH - 14)
      const b2 = await drawImageInBox(doc, after, X0 + w + gap, photoTop + 14, w, photoBoxH - 14)
      photoBottom = Math.max(b1, b2)
    } else if (before) {
      photoBottom = await drawImageInBox(doc, before, X0, photoTop, CW, photoBoxH)
    }
  } catch (e) {
    console.error('Foto konnte nicht ins PDF übernommen werden', e)
  }

  // Text direkt unter dem Foto bzw. neben dem Schriftfeld
  const textX = X0
  let ty = besideTitleBlock ? sfTop + 10 : photoBottom + 22
  font(doc, 8, 'bold', GREY)
  doc.text('BESCHREIBUNG', textX, ty)
  ty += LH
  font(doc, 10, 'normal')
  doc.text(descLines, textX, ty, { lineHeightFactor: LH / 10 })
  ty += descLines.length * LH
  font(doc, 8.5, 'normal', GREY)
  for (const m of meta) {
    doc.text(fit(doc, m, textW), textX, ty)
    ty += LH
  }

  drawTitleBlock(doc, defect, nr, ctx)
}

// --- Rahmen, Kopf- und Fußzeile auf allen Seiten ---

function drawFrames(doc, ctx) {

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    // Rahmen
    doc.setDrawColor(...PDF_CONFIG.frameColor)
    doc.setLineWidth(1)
    doc.rect(FRAME, FRAME, PAGE_W - 2 * FRAME, PAGE_H - 2 * FRAME)

    // Kopf: Überschrift, Datum der Begehung
    const titleX = X0
    font(doc, 12, 'bold')
    doc.text(fit(doc, ctx.title.toUpperCase(), X1 - titleX - 110), titleX, 43)
    font(doc, 11, 'bold', PDF_CONFIG.accentColor)
    doc.text(ctx.begehungDate, X1, 43, { align: 'right' })
    doc.setDrawColor(...PDF_CONFIG.accentColor)
    doc.setLineWidth(1.5)
    doc.line(FRAME, HEADER_LINE_Y, PAGE_W - FRAME, HEADER_LINE_Y)

    // Fuß: Erstellzeitpunkt links, Seitenzahl rechts
    doc.setDrawColor(...PDF_CONFIG.frameColor)
    doc.setLineWidth(0.5)
    doc.line(FRAME, FOOTER_LINE_Y, PAGE_W - FRAME, FOOTER_LINE_Y)
    font(doc, 8.5, 'normal', GREY)
    doc.text(`Erstellt am ${ctx.createdText}`, X0, FOOTER_LINE_Y + 16)
    const objekt = ctx.project.objekt ? pdfText(ctx.project.objekt) : ''
    if (objekt) doc.text(objekt, PAGE_W / 2, FOOTER_LINE_Y + 16, { align: 'center' })
    font(doc, 8.5, 'bold', DARK)
    doc.text(`Seite ${i} von ${total}`, X1, FOOTER_LINE_Y + 16, { align: 'right' })
  }
}

export async function generatePDF(project, defects, settings) {
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
  doc.setProperties({ title: pdfText(project.name), subject: 'Prüfbericht', creator: 'MängelDoc' })

  const sorted = sortDefects(defects)
  const ctx = {
    project,
    sorted,
    settings,
    title: reportTitle(project.address),
    begehungDate: formatDate(project.date || project.createdAt),
    createdText: formatDateTime(new Date()),
  }

  drawCover(doc, ctx)
  for (let i = 0; i < sorted.length; i++) {
    await drawDefectPage(doc, sorted[i], i + 1, ctx)
  }
  drawFrames(doc, ctx)
  return doc
}

function pdfFileName(project) {
  const date = formatDate(project.date || project.createdAt).replace(/\./g, '-')
  return `${safeFileName([PDF_CONFIG.fileSuffix, project.address, project.objekt].filter(Boolean).join(' '))}_${date}.pdf`
}

export async function exportPDF(project, defects, settings) {
  const doc = await generatePDF(project, defects, settings)
  downloadBlob(doc.output('blob'), pdfFileName(project))
}

export async function sharePDF(project, defects, settings) {
  const doc = await generatePDF(project, defects, settings)
  await shareOrDownload(doc.output('blob'), pdfFileName(project), `Prüfbericht – ${project.name}`)
}

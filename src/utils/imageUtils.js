import { ANNOTATION_COLOR, ANNOTATION_LINE_WIDTH } from '../config'

// Foto auf max. 1200 px Breite verkleinern und als JPEG speichern
export function compressImage(file, maxWidth = 1200, quality = 0.7, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w)
        w = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL(type, quality))
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

function setStroke(ctx, scale) {
  ctx.strokeStyle = ANNOTATION_COLOR
  ctx.lineWidth = ANNOTATION_LINE_WIDTH * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

// Eine Markierung zeichnen. Koordinaten sind in Pixeln der Zeichenfläche,
// scale rechnet sie auf eine andere Größe um (z. B. Originalfoto).
export function drawAnnotation(ctx, ann, scale = 1) {
  setStroke(ctx, scale)
  if (ann.type === 'circle') {
    const cx = ((ann.startX + ann.endX) / 2) * scale
    const cy = ((ann.startY + ann.endY) / 2) * scale
    const rx = (Math.abs(ann.endX - ann.startX) / 2) * scale
    const ry = (Math.abs(ann.endY - ann.startY) / 2) * scale
    if (rx < 1 || ry < 1) return
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (ann.type === 'arrow') {
    const sx = ann.startX * scale
    const sy = ann.startY * scale
    const ex = ann.endX * scale
    const ey = ann.endY * scale
    if (Math.hypot(ex - sx, ey - sy) < 2) return
    const angle = Math.atan2(ey - sy, ex - sx)
    const headLen = 15 * scale
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - headLen * Math.cos(angle - 0.4), ey - headLen * Math.sin(angle - 0.4))
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - headLen * Math.cos(angle + 0.4), ey - headLen * Math.sin(angle + 0.4))
    ctx.stroke()
  } else if (ann.type === 'freehand' && ann.points?.length > 1) {
    ctx.beginPath()
    ctx.moveTo(ann.points[0].x * scale, ann.points[0].y * scale)
    for (let i = 1; i < ann.points.length; i++) {
      ctx.lineTo(ann.points[i].x * scale, ann.points[i].y * scale)
    }
    ctx.stroke()
  }
}

// Markierungen in einer anderen Breite neu berechnen (z. B. nach Drehen des Handys)
export function scaleAnnotations(annotations, factor) {
  if (!factor || factor === 1) return annotations
  return annotations.map(ann =>
    ann.type === 'freehand'
      ? { ...ann, points: ann.points.map(p => ({ x: p.x * factor, y: p.y * factor })) }
      : {
          ...ann,
          startX: ann.startX * factor,
          startY: ann.startY * factor,
          endX: ann.endX * factor,
          endY: ann.endY * factor,
        }
  )
}

// Markierungen fest ins Foto einbrennen (für Bericht und PDF)
export function burnAnnotations(imageDataUrl, annotations, canvasWidth) {
  if (!annotations?.length || !canvasWidth) return Promise.resolve(imageDataUrl)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const scale = img.naturalWidth / canvasWidth
      for (const ann of annotations) drawAnnotation(ctx, ann, scale)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = reject
    img.src = imageDataUrl
  })
}

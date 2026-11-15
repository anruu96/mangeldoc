import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDefect, getProject, getSettings, saveDefect, deleteDefect } from '../utils/db'
import { drawAnnotation, scaleAnnotations, compressImage } from '../utils/imageUtils'
import { floorsFor, formatDate } from '../utils/format'
import { PRIORITIES } from '../config'

async function loadDefectData(id) {
  const defect = await getDefect(id)
  if (!defect) return null
  const [project, settings] = await Promise.all([getProject(defect.projectId), getSettings()])
  return { defect, project, settings }
}

// Textbaustein an die Beschreibung anhängen
function appendSnippet(text, snippet) {
  const t = (text || '').trimEnd()
  if (!t) return snippet
  return /[.!?]$/.test(t) ? `${t} ${snippet}` : `${t}. ${snippet}`
}

const TOOLS = [
  { id: 'circle', label: '⭕ Kreis' },
  { id: 'arrow', label: '➡ Pfeil' },
  { id: 'freehand', label: '✏ Freihand' },
]

export default function DefectEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [defect, setDefect] = useState(null)
  const [floors, setFloors] = useState([])
  const [snippets, setSnippets] = useState([])
  const [afterBusy, setAfterBusy] = useState(false)
  const [tool, setTool] = useState('circle')
  const [annotations, setAnnotations] = useState([])
  const [draft, setDraft] = useState(null) // Markierung, die gerade gezeichnet wird
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const widthRef = useRef(null) // Breite, auf die sich die Koordinaten beziehen

  useEffect(() => {
    let cancelled = false
    loadDefectData(id).then(data => {
      if (cancelled) return
      if (!data) { navigate('/'); return }
      const d = data.defect
      widthRef.current = d.canvasWidth || null
      setDefect(d)
      setAnnotations(d.annotations || [])
      setFloors(floorsFor(data.project?.objekt))
      setSnippets(data.settings.textSnippets || [])
    })
    return () => { cancelled = true }
  }, [id, navigate])

  // Zeichenflächen an die Bildgröße anpassen und Markierungen mitskalieren
  const layout = useCallback(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container || !img.naturalWidth) return
    const w = container.clientWidth
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w)
    for (const c of [canvasRef.current, overlayRef.current]) {
      if (c) { c.width = w; c.height = h }
    }
    const oldW = widthRef.current
    widthRef.current = w
    // Neue Arrays erzwingen ein Neuzeichnen, auch wenn sich die Breite nicht ändert
    setAnnotations(prev => (oldW && oldW !== w ? scaleAnnotations(prev, w / oldW) : [...prev]))
  }, [])

  useEffect(() => {
    window.addEventListener('resize', layout)
    return () => window.removeEventListener('resize', layout)
  }, [layout])

  // Gespeicherte Markierungen zeichnen
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const ann of annotations) drawAnnotation(ctx, ann)
  }, [annotations])

  // Live-Vorschau beim Zeichnen
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    if (draft) drawAnnotation(ctx, draft)
  }, [draft])

  function getPos(e) {
    const rect = containerRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e) {
    if (e.button !== undefined && e.button > 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = getPos(e)
    setDraft(tool === 'freehand'
      ? { type: 'freehand', points: [p] }
      : { type: tool, startX: p.x, startY: p.y, endX: p.x, endY: p.y })
  }

  function handlePointerMove(e) {
    if (!draft) return
    e.preventDefault()
    const p = getPos(e)
    setDraft(prev => prev.type === 'freehand'
      ? { ...prev, points: [...prev.points, p] }
      : { ...prev, endX: p.x, endY: p.y })
  }

  function handlePointerUp() {
    if (!draft) return
    const valid = draft.type === 'freehand'
      ? draft.points.length > 1
      : Math.hypot(draft.endX - draft.startX, draft.endY - draft.startY) > 4
    if (valid) setAnnotations(prev => [...prev, draft])
    setDraft(null)
  }

  async function handleSave() {
    await saveDefect({
      ...defect,
      annotations,
      canvasWidth: widthRef.current || containerRef.current?.clientWidth || null,
      location: (defect.location || '').trim(),
      description: (defect.description || '').trim(),
    })
    navigate(`/project/${defect.projectId}`)
  }

  function setStatus(status) {
    setDefect(prev => ({
      ...prev,
      status,
      fixedAt: status === 'behoben' ? (prev.fixedAt || Date.now()) : null,
    }))
  }

  async function handleAfterPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAfterBusy(true)
    try {
      const afterImageData = await compressImage(file)
      setDefect(prev => ({ ...prev, afterImageData }))
    } catch {
      alert('Das Foto konnte nicht gelesen werden.')
    } finally {
      setAfterBusy(false)
    }
  }

  async function handleDeleteDefect() {
    await deleteDefect(id)
    navigate(`/project/${defect.projectId}`)
  }

  if (!defect) return null

  return (
    <>
      <div className="page-header">
        <button className="back-btn" onClick={handleSave}>←</button>
        <h1>Mangel bearbeiten</h1>
        <button className="btn btn-sm btn-primary" onClick={handleSave}>Speichern</button>
      </div>

      <div
        className="annotation-container"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={defect.imageData}
          alt="Mangel"
          onLoad={layout}
          draggable={false}
        />
        <canvas ref={canvasRef} />
        <canvas ref={overlayRef} />
      </div>

      <div className="toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button
          className="tool-btn undo"
          onClick={() => setAnnotations(prev => prev.slice(0, -1))}
          disabled={!annotations.length}
        >
          ↩ Rückgängig
        </button>
        <button
          className="tool-btn"
          onClick={() => setAnnotations([])}
          disabled={!annotations.length}
        >
          🗑 Alle löschen
        </button>
      </div>

      <div className="defect-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="floor">Geschoss</label>
            <select
              id="floor"
              className="form-input form-select"
              value={defect.floor || ''}
              onChange={e => setDefect(prev => ({ ...prev, floor: e.target.value }))}
            >
              <option value="">– ohne –</option>
              {floors.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group grow">
            <label htmlFor="location">Bereich / Raum</label>
            <input
              id="location"
              className="form-input"
              value={defect.location || ''}
              onChange={e => setDefect(prev => ({ ...prev, location: e.target.value }))}
              placeholder="z. B. Top 7, Stiegenhaus"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Mangelbeschreibung</label>
          <textarea
            id="description"
            className="form-input"
            value={defect.description || ''}
            onChange={e => setDefect(prev => ({ ...prev, description: e.target.value }))}
            placeholder="z. B. Brandschutztür schließt nicht selbsttätig"
          />
          {snippets.length > 0 && (
            <div className="snippets">
              {snippets.map(t => (
                <button
                  key={t}
                  type="button"
                  className="snippet"
                  onClick={() => setDefect(prev => ({ ...prev, description: appendSnippet(prev.description, t) }))}
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Priorität</label>
          <div className="tag-list">
            {PRIORITIES.map(p => (
              <button
                key={p.id}
                type="button"
                className={`tag ${defect.priority === p.id ? 'active' : ''}`}
                onClick={() => setDefect(prev => ({ ...prev, priority: prev.priority === p.id ? '' : p.id }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="deadline">Frist (optional)</label>
          <div className="deadline-row">
            <input
              id="deadline"
              type="date"
              className="form-input"
              value={defect.deadline || ''}
              onChange={e => setDefect(prev => ({ ...prev, deadline: e.target.value }))}
            />
            {defect.deadline && (
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setDefect(prev => ({ ...prev, deadline: '' }))}>
                Entfernen
              </button>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Status</label>
          <div className="tag-list">
            <button
              type="button"
              className={`tag tag-danger ${defect.status !== 'behoben' ? 'active' : ''}`}
              onClick={() => setStatus('offen')}
            >
              Offen
            </button>
            <button
              type="button"
              className={`tag tag-success ${defect.status === 'behoben' ? 'active' : ''}`}
              onClick={() => setStatus('behoben')}
            >
              Behoben
            </button>
          </div>
        </div>

        {defect.status === 'behoben' && (
          <div className="form-group after-photo">
            <label>Nachher-Foto (Nachweis)</label>
            {defect.afterImageData ? (
              <>
                <img src={defect.afterImageData} alt="Nachher" />
                <div className="btn-row">
                  <label className="btn btn-sm btn-outline file-btn">
                    Foto ersetzen
                    <input type="file" accept="image/*" capture="environment" onChange={handleAfterPhoto} />
                  </label>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setDefect(prev => ({ ...prev, afterImageData: null }))}>
                    Foto entfernen
                  </button>
                </div>
              </>
            ) : (
              <label className="photo-btn-label secondary file-btn">
                {afterBusy ? 'Wird verarbeitet …' : '📷 Nachher-Foto aufnehmen'}
                <input type="file" accept="image/*" capture="environment" onChange={handleAfterPhoto} disabled={afterBusy} />
              </label>
            )}
          </div>
        )}

        {(defect.carriedFrom || defect.firstSeen) && (
          <div className="defect-history">
            {defect.firstSeen && <div>Festgestellt am {formatDate(defect.firstSeen)}</div>}
            {defect.carriedFrom && <div>Übernommen aus der Begehung vom {defect.carriedFrom.date}</div>}
            {defect.status === 'behoben' && defect.fixedAt && <div>Behoben am {formatDate(defect.fixedAt)}</div>}
          </div>
        )}
      </div>

      <div className="delete-section">
        <button className="btn btn-outline btn-full" onClick={() => setShowDeleteConfirm(true)}>
          🗑 Mangel löschen
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Mangel löschen?</h3>
            <p>Das Foto und alle Markierungen werden gelöscht.</p>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>Abbrechen</button>
              <button className="btn btn-danger" onClick={handleDeleteDefect}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

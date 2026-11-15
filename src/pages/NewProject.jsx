import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProjects, getDefectsByProject, getSettings, saveProject, saveDefects, newId } from '../utils/db'
import { OBJECTS, SITE, projectTitle } from '../config'
import { formatDate } from '../utils/format'

// Letzte Begehung desselben Objekts, die noch offene Mängel hat
async function findOpenDefects(objekt) {
  const projects = (await getAllProjects())
    .filter(p => p.objekt === objekt)
    .sort((a, b) => (b.date || b.createdAt) - (a.date || a.createdAt))
  for (const p of projects) {
    const open = (await getDefectsByProject(p.id)).filter(d => d.status !== 'behoben')
    if (open.length) return { project: p, defects: open }
  }
  return null
}

export default function NewProject() {
  const navigate = useNavigate()
  const [objekt, setObjekt] = useState('')
  const [previous, setPrevious] = useState(null) // { objekt, project, defects }
  const [carryOver, setCarryOver] = useState(true)
  const [saving, setSaving] = useState(false)
  const [siteName, setSiteName] = useState(null) // null = noch nicht geladen
  const today = formatDate()
  const name = projectTitle(today, siteName)

  useEffect(() => {
    let cancelled = false
    getSettings().then(s => { if (!cancelled) setSiteName(s.siteName || '') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!objekt) return
    let cancelled = false
    findOpenDefects(objekt).then(result => {
      if (!cancelled) setPrevious(result ? { objekt, ...result } : null)
    })
    return () => { cancelled = true }
  }, [objekt])

  // Nur anzeigen, wenn das Ergebnis zum aktuell gewählten Objekt gehört
  const prev = previous && previous.objekt === objekt ? previous : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!objekt || saving) return
    setSaving(true)
    const now = Date.now()
    const project = {
      id: newId(),
      name,
      objekt,
      address: siteName || '',
      inspectionType: SITE.inspectionType,
      date: now,
      createdAt: now,
      currentFloor: '',
    }
    await saveProject(project)

    if (prev && carryOver) {
      const fromDate = formatDate(prev.project.date || prev.project.createdAt)
      await saveDefects(prev.defects.map(d => ({
        ...d,
        id: newId(),
        projectId: project.id,
        status: 'offen',
        afterImageData: null,
        fixedAt: null,
        firstSeen: d.firstSeen || d.createdAt,
        carriedFrom: { projectId: prev.project.id, date: fromDate },
      })))
    }
    navigate(`/project/${project.id}`, { replace: true })
  }

  return (
    <>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1>Neue Begehung</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Begehung</label>
          <div className="fixed-value">{siteName === null ? '…' : name}</div>
          {siteName === '' && (
            <div className="info-note clickable" onClick={() => navigate('/settings')}>
              Tipp: Unter ⚙ Einstellungen den Standort eintragen – er erscheint dann im Namen und im Bericht.
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="objekt">Objekt *</label>
          <select
            id="objekt"
            className="form-input form-select"
            value={objekt}
            onChange={e => { setObjekt(e.target.value); setCarryOver(true) }}
            required
          >
            <option value="" disabled>Bitte Objekt wählen …</option>
            {OBJECTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {prev && (
          <label className="carry-over">
            <input
              type="checkbox"
              checked={carryOver}
              onChange={e => setCarryOver(e.target.checked)}
            />
            <span>
              <strong>{prev.defects.length} offene {prev.defects.length === 1 ? 'Mangel' : 'Mängel'}</strong>
              {' '}aus der Begehung vom {formatDate(prev.project.date || prev.project.createdAt)} übernehmen
              <small>Vor Ort nur noch abhaken, was inzwischen behoben ist.</small>
            </span>
          </label>
        )}

        <button type="submit" className="btn btn-primary btn-full" disabled={!objekt || saving || siteName === null}>
          Begehung starten
        </button>
      </form>
    </>
  )
}

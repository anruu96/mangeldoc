import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getDefectsByProject, saveDefect, saveProject, newId } from '../utils/db'
import { compressImage } from '../utils/imageUtils'
import { countStatus, floorsFor, sortDefects, groupByFloor } from '../utils/format'

async function loadProjectData(id) {
  const project = await getProject(id)
  if (!project) return null
  const defects = await getDefectsByProject(id)
  return { project, defects }
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [defects, setDefects] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadProjectData(id).then(data => {
      if (cancelled) return
      if (!data) { navigate('/'); return }
      setProject(data.project)
      setDefects(data.defects)
    })
    return () => { cancelled = true }
  }, [id, reloadKey, navigate])

  async function changeFloor(floor) {
    const updated = { ...project, currentFloor: floor }
    setProject(updated)
    await saveProject(updated)
  }

  async function handleFiles(files) {
    setBusy(true)
    let failed = 0
    try {
      for (const file of files) {
        try {
          const imageData = await compressImage(file)
          const now = Date.now()
          await saveDefect({
            id: newId(),
            projectId: id,
            imageData,
            annotations: [],
            canvasWidth: null,
            floor: project.currentFloor || '',
            location: '',
            description: '',
            status: 'offen',
            priority: '',
            deadline: '',
            afterImageData: null,
            createdAt: now,
            firstSeen: now,
          })
        } catch (e) {
          console.error('Foto konnte nicht gelesen werden', e)
          failed++
        }
      }
    } finally {
      setBusy(false)
      setReloadKey(k => k + 1)
    }
    if (failed) alert(`${failed} Foto(s) konnten nicht gelesen werden.`)
  }

  function handleCapture(e) {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  if (!project) return null

  const { total, open, fixed } = countStatus(defects)
  const groups = groupByFloor(sortDefects(defects))
  const floors = floorsFor(project.objekt)
  const needsFloor = !project.currentFloor
  const photoDisabled = busy || needsFloor

  return (
    <>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1>{project.objekt || project.name}</h1>
      </div>
      <div className="page-sub">{project.name}</div>

      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">{total}</div>
          <div className="stat-label">Gesamt</div>
        </div>
        <div className="stat-item open">
          <div className="stat-number">{open}</div>
          <div className="stat-label">Offen</div>
        </div>
        <div className="stat-item fixed">
          <div className="stat-number">{fixed}</div>
          <div className="stat-label">Behoben</div>
        </div>
      </div>

      <div className={`floor-picker ${needsFloor ? 'attention' : ''}`}>
        <label htmlFor="floor">In welchem Geschoss bist du?</label>
        <select
          id="floor"
          className="form-input form-select"
          value={project.currentFloor || ''}
          onChange={e => changeFloor(e.target.value)}
        >
          <option value="" disabled>Geschoss wählen …</option>
          {floors.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        {needsFloor && <small>Bitte zuerst das Geschoss wählen, dann Fotos aufnehmen.</small>}
      </div>

      {busy && <div className="busy-note">Fotos werden verarbeitet …</div>}

      <div className={`photo-buttons ${photoDisabled ? 'disabled' : ''}`}>
        <label className="photo-btn-label">
          📷 Foto aufnehmen
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            disabled={photoDisabled}
          />
        </label>
        <label className="photo-btn-label secondary">
          🖼 Aus Galerie
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleCapture}
            disabled={photoDisabled}
          />
        </label>
      </div>

      {groups.map(group => (
        <section key={group.floor} className="floor-group">
          <h2 className="floor-heading">
            {group.floor} <span>{group.items.length}</span>
          </h2>
          <div className="photo-grid">
            {group.items.map(({ defect: d, nr }) => (
              <div
                key={d.id}
                className="photo-thumb"
                onClick={() => navigate(`/defect/${d.id}`)}
              >
                <img src={d.imageData} alt={`Mangel ${nr}`} />
                <div className="thumb-nr">{nr}</div>
                <div className={`status-dot ${d.status === 'behoben' ? 'fixed' : 'open'}`} />
                {(d.location || d.description) && (
                  <div className="thumb-caption">{d.location || d.description}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {total > 0 && (
        <button
          className="btn btn-outline btn-full"
          style={{ marginTop: 20 }}
          onClick={() => navigate(`/report/${id}`)}
        >
          📄 Bericht anzeigen
        </button>
      )}
    </>
  )
}

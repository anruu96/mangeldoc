import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProjects, deleteProject, getDefectsByProject } from '../utils/db'
import { countStatus } from '../utils/format'

async function loadProjectsWithCounts() {
  const all = await getAllProjects()
  const withCounts = await Promise.all(
    all.map(async (p) => ({ ...p, ...countStatus(await getDefectsByProject(p.id)) }))
  )
  return withCounts.sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0))
}

export default function ProjectList() {
  const [projects, setProjects] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    loadProjectsWithCounts().then(list => { if (!cancelled) setProjects(list) })
    return () => { cancelled = true }
  }, [reloadKey])

  async function handleDelete() {
    if (!deleteId) return
    await deleteProject(deleteId)
    setDeleteId(null)
    setReloadKey(k => k + 1)
  }

  if (!projects) return null

  return (
    <>
      <div className="page-header">
        <h1>MängelDoc</h1>
        <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="Einstellungen">⚙</button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>Noch keine Begehungen.<br />Starte deine erste Begehung!</p>
        </div>
      ) : (
        projects.map(p => (
          <div key={p.id} className="card project-card" onClick={() => navigate(`/project/${p.id}`)}>
            {p.objekt && <div className="card-kicker">{p.objekt}</div>}
            <h3>{p.name}</h3>
            {!p.objekt && (
              <div className="meta">
                {[p.inspectionType, p.address].filter(Boolean).join(' · ')}
              </div>
            )}
            <div className="badge-row">
              <span className="status-badge open">{p.open} offen</span>
              <span className="status-badge fixed">{p.fixed} behoben</span>
            </div>
            <button
              className="btn btn-sm btn-outline"
              style={{ marginTop: 10 }}
              onClick={(e) => { e.stopPropagation(); setDeleteId(p.id) }}
            >
              Löschen
            </button>
          </div>
        ))
      )}

      <button
        className="btn btn-primary btn-full"
        style={{ marginTop: 16 }}
        onClick={() => navigate('/new')}
      >
        + Neue Begehung
      </button>

      {deleteId && (
        <div className="confirm-overlay" onClick={() => setDeleteId(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Begehung löschen?</h3>
            <p>Alle Mängel und Fotos dieser Begehung werden endgültig gelöscht.</p>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Abbrechen</button>
              <button className="btn btn-danger" onClick={handleDelete}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

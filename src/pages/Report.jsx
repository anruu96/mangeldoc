import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getDefectsByProject, getSettings } from '../utils/db'
import { burnAnnotations } from '../utils/imageUtils'
import { exportPDF, sharePDF } from '../utils/pdfExport'
import { formatDate, countStatus, sortDefects, groupByFloor, urgencyText } from '../utils/format'

async function loadReportData(projectId) {
  const project = await getProject(projectId)
  if (!project) return null
  const [defects, settings] = await Promise.all([getDefectsByProject(projectId), getSettings()])
  const images = {}
  for (const d of defects) {
    try {
      images[d.id] = await burnAnnotations(d.imageData, d.annotations, d.canvasWidth)
    } catch {
      images[d.id] = d.imageData
    }
  }
  return { project, defects, settings, images }
}

export default function Report() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadReportData(projectId).then(result => {
      if (cancelled) return
      if (!result) { navigate('/'); return }
      setData(result)
    })
    return () => { cancelled = true }
  }, [projectId, navigate])

  async function run(action) {
    setGenerating(true)
    try {
      await action(data.project, data.defects, data.settings)
    } catch (e) {
      console.error(e)
      alert('Der Bericht konnte nicht erstellt werden.')
    } finally {
      setGenerating(false)
    }
  }

  if (!data) return null
  const { project, defects, settings, images } = data
  const { total, open, fixed } = countStatus(defects)
  const groups = groupByFloor(sortDefects(defects))
  const missingInspector = !settings.inspector

  return (
    <>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(`/project/${projectId}`)}>←</button>
        <h1>Bericht</h1>
      </div>

      <div className="card">
        {project.objekt && <div className="card-kicker">{project.objekt}</div>}
        <h3>{project.name}</h3>
        <div className="report-meta">
          {total} {total === 1 ? 'Mangel' : 'Mängel'} · {open} offen · {fixed} behoben
        </div>
        {settings.inspector && <div className="report-meta">Prüfer: {settings.inspector}</div>}
      </div>

      {missingInspector && (
        <div className="info-note clickable" onClick={() => navigate('/settings')}>
          Tipp: Deinen Namen als Prüfer in den ⚙ Einstellungen eintragen – er erscheint dann im Schriftfeld des Berichts.
        </div>
      )}

      <div className="privacy-note">
        <strong>🔒 Datenschutz</strong>
        Bericht nur über dienstliche Kanäle versenden (z. B. Firmen-Mail) – nicht über private
        Messenger wie WhatsApp oder private Mail-/Cloud-Konten. Fotos können personenbezogene
        Daten enthalten (Personen, Namen, Kennzeichen).
      </div>

      <div className="action-row">
        <button className="btn btn-primary" onClick={() => run(exportPDF)} disabled={generating || !total}>
          {generating ? 'Erstelle …' : '📄 PDF speichern'}
        </button>
        <button className="btn btn-outline" onClick={() => run(sharePDF)} disabled={generating || !total}>
          {generating ? 'Erstelle …' : '📤 Teilen'}
        </button>
      </div>

      {total === 0 && (
        <div className="empty-state">
          <p>Noch keine Mängel erfasst.</p>
        </div>
      )}

      {groups.map(group => (
        <section key={group.floor}>
          <h2 className="floor-heading">{group.floor} <span>{group.items.length}</span></h2>
          {group.items.map(({ defect: d, nr }) => {
            const urgency = urgencyText(d)
            const after = d.status === 'behoben' ? d.afterImageData : null
            return (
              <div key={d.id} className="card report-item">
                <div className="report-header">
                  <strong>Mangel {nr}</strong>
                  <span className={`status-badge ${d.status === 'behoben' ? 'fixed' : 'open'}`}>
                    {d.status === 'behoben' ? 'Behoben' : 'Offen'}
                  </span>
                </div>
                {after ? (
                  <div className="before-after">
                    <figure><img src={images[d.id]} alt={`Mangel ${nr} vorher`} /><figcaption>Vorher</figcaption></figure>
                    <figure><img src={after} alt={`Mangel ${nr} nachher`} /><figcaption>Nachher</figcaption></figure>
                  </div>
                ) : (
                  images[d.id] && <img src={images[d.id]} alt={`Mangel ${nr}`} />
                )}
                {d.location && <div className="report-meta">📍 {d.location}</div>}
                {d.description && <div className="report-desc">{d.description}</div>}
                {urgency && <div className="report-meta">⏱ {urgency}</div>}
                {d.carriedFrom && (
                  <div className="report-meta">↻ Übernommen aus der Begehung vom {d.carriedFrom.date}</div>
                )}
                {!d.carriedFrom && d.firstSeen && (
                  <div className="report-meta">Festgestellt am {formatDate(d.firstSeen)}</div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}

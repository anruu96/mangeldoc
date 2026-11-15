import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, saveSettings, exportAll, importAll, validateBackup } from '../utils/db'
import { formatDate, formatDateTime } from '../utils/format'
import { shareOrDownload } from '../utils/share'
import { DEFAULT_TEXT_SNIPPETS } from '../config'

async function loadSettingsData() {
  const settings = await getSettings()
  let storage = null
  try {
    const est = await navigator.storage?.estimate?.()
    const persisted = await navigator.storage?.persisted?.()
    if (est) storage = { usage: est.usage, quota: est.quota, persisted }
  } catch {
    storage = null
  }
  return { settings, storage }
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toLocaleString('de-AT', { maximumFractionDigits: 1 }) + ' MB'
}

export default function Settings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [snippetText, setSnippetText] = useState('')
  const [storage, setStorage] = useState(null)
  const [message, setMessage] = useState('')
  const [pendingImport, setPendingImport] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSettingsData().then(data => {
      if (cancelled) return
      setSettings(data.settings)
      setSnippetText((data.settings.textSnippets || []).join('\n'))
      setStorage(data.storage)
    })
    return () => { cancelled = true }
  }, [])

  function update(patch) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  async function handleSave() {
    const textSnippets = snippetText.split('\n').map(t => t.trim()).filter(Boolean)
    await saveSettings({ ...settings, textSnippets })
    navigate('/')
  }

  async function handleExport() {
    setBusy(true)
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const name = `MaengelDoc_Sicherung_${formatDate().replace(/\./g, '-')}.json`
      await shareOrDownload(blob, name, 'MängelDoc Sicherung')
      setMessage(`Sicherung erstellt: ${data.projects.length} Begehungen, ${data.defects.length} Mängel.`)
    } catch (e) {
      console.error(e)
      setMessage('Die Sicherung konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!validateBackup(data)) throw new Error('ungültig')
      setPendingImport(data)
    } catch {
      setMessage('Diese Datei ist keine gültige MängelDoc-Sicherung.')
    }
  }

  async function confirmImport() {
    setBusy(true)
    try {
      await importAll(pendingImport)
      const fresh = await getSettings()
      setSettings(fresh)
      setSnippetText((fresh.textSnippets || []).join('\n'))
      setMessage(`Sicherung eingespielt: ${pendingImport.projects.length} Begehungen, ${pendingImport.defects.length} Mängel.`)
    } catch (e) {
      console.error(e)
      setMessage('Die Sicherung konnte nicht eingespielt werden.')
    } finally {
      setPendingImport(null)
      setBusy(false)
    }
  }

  if (!settings) return null

  return (
    <>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1>Einstellungen</h1>
        <button className="btn btn-sm btn-primary" onClick={handleSave}>Speichern</button>
      </div>

      <section className="card settings-section">
        <h2>Bericht</h2>
        <div className="form-group">
          <label htmlFor="siteName">Standort</label>
          <input
            id="siteName"
            className="form-input"
            value={settings.siteName}
            onChange={e => update({ siteName: e.target.value })}
            placeholder="z. B. Musterstraße 5"
          />
        </div>
        <div className="form-group">
          <label htmlFor="inspector">Prüfer</label>
          <input
            id="inspector"
            className="form-input"
            value={settings.inspector}
            onChange={e => update({ inspector: e.target.value })}
            placeholder="z. B. Ing. Max Mustermann"
          />
        </div>
        <p className="hint">
          Standort und Prüfer erscheinen im Namen neuer Begehungen, in der Überschrift und im Schriftfeld des Berichts.
          Sie werden nur auf diesem Gerät gespeichert.
        </p>
      </section>

      <section className="card settings-section">
        <h2>Textbausteine</h2>
        <p className="hint">Ein Baustein pro Zeile. Sie erscheinen beim Mangel unter der Beschreibung zum Antippen.</p>
        <textarea
          className="form-input snippet-editor"
          value={snippetText}
          onChange={e => setSnippetText(e.target.value)}
          rows={10}
        />
        <button className="btn btn-sm btn-outline" onClick={() => setSnippetText(DEFAULT_TEXT_SNIPPETS.join('\n'))}>
          Standard wiederherstellen
        </button>
      </section>

      <section className="card settings-section">
        <h2>Datensicherung</h2>
        <p className="hint">
          Alle Begehungen und Fotos liegen nur auf diesem Gerät. Erstelle regelmäßig eine Sicherung –
          damit kannst du alles auch auf einem neuen Handy wieder einspielen.
        </p>
        <div className="privacy-note">
          <strong>🔒 Datenschutz</strong>
          Die Sicherung enthält alle Fotos und Beschreibungen. Nur auf dienstlichem Speicher ablegen
          (z. B. Firmenlaufwerk, dienstliche Mail) – nicht in privaten Clouds oder Messengern.
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleExport} disabled={busy}>⬇ Sicherung erstellen</button>
          <label className="btn btn-outline file-btn">
            ⬆ Sicherung einspielen
            <input type="file" accept="application/json,.json" onChange={handleImportFile} disabled={busy} />
          </label>
        </div>
        {message && <div className="info-note">{message}</div>}
        {storage && (
          <p className="hint" style={{ marginTop: 12 }}>
            Belegter Speicher: {mb(storage.usage)} von ca. {mb(storage.quota)}
            {storage.persisted ? ' · dauerhaft gespeichert' : ''}
          </p>
        )}
      </section>

      {pendingImport && (
        <div className="confirm-overlay" onClick={() => setPendingImport(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Sicherung einspielen?</h3>
            <p>
              Sicherung vom {formatDateTime(pendingImport.exportedAt)} mit {pendingImport.projects.length} Begehungen
              und {pendingImport.defects.length} Mängeln. Vorhandene Daten bleiben erhalten, gleiche Einträge
              werden überschrieben.
            </p>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => setPendingImport(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={confirmImport}>Einspielen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

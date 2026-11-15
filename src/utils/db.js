import { openDB } from 'idb'
import { DEFAULT_TEXT_SNIPPETS } from '../config'

const DB_NAME = 'mangeldoc'
// Version 2: Store "settings" (Standort, Prüfer, Textbausteine)
const DB_VERSION = 2

let dbPromise

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('defects')) {
          const store = db.createObjectStore('defects', { keyPath: 'id' })
          store.createIndex('projectId', 'projectId')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
      },
    })
  }
  return dbPromise
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// --- Begehungen (Projekte) ---

export async function getAllProjects() {
  const db = await getDB()
  return db.getAll('projects')
}

export async function getProject(id) {
  const db = await getDB()
  return db.get('projects', id)
}

export async function saveProject(project) {
  const db = await getDB()
  return db.put('projects', project)
}

export async function deleteProject(id) {
  const db = await getDB()
  const tx = db.transaction(['projects', 'defects'], 'readwrite')
  await tx.objectStore('projects').delete(id)
  const defectStore = tx.objectStore('defects')
  const keys = await defectStore.index('projectId').getAllKeys(id)
  for (const key of keys) await defectStore.delete(key)
  await tx.done
}

// --- Mängel ---

export async function getDefectsByProject(projectId) {
  const db = await getDB()
  return db.getAllFromIndex('defects', 'projectId', projectId)
}

export async function getDefect(id) {
  const db = await getDB()
  return db.get('defects', id)
}

export async function saveDefect(defect) {
  const db = await getDB()
  return db.put('defects', defect)
}

export async function saveDefects(defects) {
  const db = await getDB()
  const tx = db.transaction('defects', 'readwrite')
  for (const d of defects) tx.store.put(d)
  await tx.done
}

export async function deleteDefect(id) {
  const db = await getDB()
  return db.delete('defects', id)
}

// --- Einstellungen ---

export const DEFAULT_SETTINGS = {
  siteName: '', // Standort, z. B. Adresse – bleibt nur auf dem Gerät
  inspector: '',
  textSnippets: DEFAULT_TEXT_SNIPPETS,
}

export async function getSettings() {
  const db = await getDB()
  const stored = await db.get('settings', 'main')
  return { ...DEFAULT_SETTINGS, ...(stored || {}) }
}

export async function saveSettings(settings) {
  const db = await getDB()
  return db.put('settings', settings, 'main')
}

// --- Datensicherung ---

export async function exportAll() {
  const db = await getDB()
  return {
    app: 'MaengelDoc',
    format: 1,
    exportedAt: Date.now(),
    projects: await db.getAll('projects'),
    defects: await db.getAll('defects'),
    settings: (await db.get('settings', 'main')) || null,
  }
}

export function validateBackup(data) {
  return data && data.app === 'MaengelDoc' && Array.isArray(data.projects) && Array.isArray(data.defects)
}

// Fügt die Sicherung ein; gleiche IDs werden überschrieben, alles andere bleibt
export async function importAll(data) {
  const db = await getDB()
  const tx = db.transaction(['projects', 'defects', 'settings'], 'readwrite')
  for (const p of data.projects) tx.objectStore('projects').put(p)
  for (const d of data.defects) tx.objectStore('defects').put(d)
  if (data.settings) tx.objectStore('settings').put(data.settings, 'main')
  await tx.done
}

// Datei herunterladen (Fallback, wenn Teilen nicht geht)
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Über das Teilen-Menü des Handys (Web Share API) teilen, sonst herunterladen
export async function shareOrDownload(blob, fileName, title) {
  const file = new File([blob], fileName, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] })
      return
    } catch (e) {
      if (e.name === 'AbortError') return // Nutzer hat abgebrochen
    }
  }
  downloadBlob(blob, fileName)
}

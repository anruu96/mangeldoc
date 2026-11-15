import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Name des GitHub-Repos: die App liegt unter https://anruu96.github.io/mangeldoc/
// Bei Umbenennen des Repos hier UND in public/manifest.json (start_url, scope) ändern.
const BASE = '/mangeldoc/'

// Trägt nach dem Build alle erzeugten Dateien in dist/sw.js ein,
// damit die App schon nach dem ersten Öffnen offline funktioniert.
function precacheServiceWorker() {
  let outDir = 'dist'
  let files = []
  return {
    name: 'mangeldoc-precache-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const list = [...new Set([...files, 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'])]
      const version = Date.now().toString(36)
      const sw = readFileSync(swPath, 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('self.__PRECACHE__ || []', JSON.stringify(list))
      writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  plugins: [react(), precacheServiceWorker()],
  base: BASE,
  build: {
    chunkSizeWarningLimit: 1000,
  },
})

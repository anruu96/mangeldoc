// Service Worker von MängelDoc: macht die App offline nutzbar.
// __PRECACHE__ und __VERSION__ werden beim Build (vite.config.js) ersetzt.
const VERSION = '__VERSION__'
const CACHE_NAME = `mangeldoc-${VERSION}`
const PRECACHE = self.__PRECACHE__ || []

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['./', ...PRECACHE]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('mangeldoc-') && n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  )
})

// Zuerst Netz (damit Updates ankommen), ohne Netz aus dem Cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true })
        if (cached) return cached
        if (request.mode === 'navigate') return caches.match('./')
        return Response.error()
      })
  )
})

const CACHE = 'r2ra-v2'

// App shell + install assets cached up front so a home-screen launch
// works offline even if those files were never fetched in-session.
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-mark.svg',
  '/icons/app/icon-192.png',
  '/icons/app/icon-512.png',
  '/icons/app/icon-maskable-192.png',
  '/icons/app/icon-maskable-512.png',
  '/icons/app/apple-touch-icon.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Delete old caches.
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Never intercept API calls or non-GET requests.
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return
  }

  // Navigation requests: network-first. Keep the cached shell fresh by
  // storing each successful response, so the offline fallback tracks the
  // latest deploy instead of the install-time copy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then(cache => cache.put('/index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets: cache-first, update in background.
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request)
      const networkFetch = fetch(event.request).then(res => {
        if (res.ok) cache.put(event.request, res.clone())
        return res
      })
      return cached ?? networkFetch
    })
  )
})

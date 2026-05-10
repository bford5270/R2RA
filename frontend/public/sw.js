const CACHE = 'r2ra-v1'

// On install, cache the app shell.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/index.html'])
    )
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

  // Navigation requests: network-first, fall back to cached index.html.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html')
      )
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

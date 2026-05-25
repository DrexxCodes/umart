// public/sw.js — PWA service worker (caching + offline fallback)
// This is separate from firebase-messaging-sw.js which handles FCM only.
// Register this from your app for PWA install support and offline behaviour.

const CACHE_NAME = 'umart-v1'

// Pages/assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return
  // Don't intercept API calls or Firebase
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('firestore')) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).catch(() =>
        // Network failed and not cached — show offline page
        caches.match('/offline')
      )
    })
  )
})

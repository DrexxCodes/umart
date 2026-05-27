// app/firebase-messaging-sw.js/route.ts
//
// Serves the Firebase Messaging service worker as a dynamic Next.js route.
// This is necessary because the SW is a static file in /public and cannot
// access process.env — but we need to inject the Firebase config into it.
//
// The route returns the SW script with NEXT_PUBLIC_ env vars baked in,
// so the SW can initialise Firebase directly without needing postMessage.
//
// URL served: /firebase-messaging-sw.js  (same path the browser expects)

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Tell Next.js this route should be treated as a JS file, not an API route
export async function GET() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? '',
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? '',
  }

  const swContent = `
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Config is baked in at request time by the Next.js route — no postMessage needed.
const firebaseConfig = ${JSON.stringify(config)};

try {
  firebase.initializeApp(firebaseConfig)
} catch (e) {
  // Already initialised (SW reuse across refreshes)
}

let messaging
try {
  messaging = firebase.messaging()
} catch (e) {
  console.warn('[FCM SW] Could not get messaging instance:', e)
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'Umart'
    const body  = payload.notification?.body  ?? ''
    const url   = payload.data?.url           ?? '/chat'
    const tag   = payload.data?.tag           ?? 'umart-chat'

    return self.registration.showNotification(title, {
      body,
      icon:     '/icon-192x192.png',
      badge:    '/badge-72x72.png',
      tag,
      renotify: true,
      data:     { url },
    })
  })
}

// ── Raw push fallback (iOS Safari PWA + any browser where FCM compat
//    onBackgroundMessage doesn't fire) ────────────────────────────────────────
//
// On iOS 16.4+ PWAs, WebKit delivers a raw Web Push API event. The FCM
// compat library's onBackgroundMessage intercepts this on Chrome/Android
// but is unreliable on WebKit. We add our own raw 'push' listener as a
// belt-and-suspenders fallback — if the compat library already showed the
// notification, the browser deduplicates by tag so no double-notification.
//
// IMPORTANT: event.waitUntil() keeps the SW alive until showNotification
// resolves. Without it, iOS may kill the SW before the notification appears.
self.addEventListener('push', (event) => {
  // If the FCM compat layer already handled this, it will have called
  // showNotification. We check for pending notifications to avoid double-show.
  // Because we use the same tag, even if both run, the browser deduplicates.
  let title = 'New message on Umart'
  let body  = ''
  let url   = '/chat'
  let tag   = 'umart-chat'

  try {
    const data = event.data?.json()
    // FCM sends payload under notification{} or data{}
    title = data?.notification?.title ?? data?.data?.title ?? title
    body  = data?.notification?.body  ?? data?.data?.body  ?? body
    url   = data?.data?.url           ?? url
    tag   = data?.data?.tag           ?? tag
  } catch {
    // Malformed payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/icon-192x192.png',
      badge:    '/badge-72x72.png',
      tag,
      renotify: true,
      data:     { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/chat'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            if ('navigate' in client) client.navigate(url)
            return
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
`

  return new NextResponse(swContent, {
    headers: {
      'Content-Type': 'application/javascript',
      // No caching — always serve fresh so config changes take effect immediately
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      // Required for service workers: must be served from same origin
      'Service-Worker-Allowed': '/',
    },
  })
}

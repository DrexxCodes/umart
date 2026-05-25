// public/firebase-messaging-sw.js
// Firebase Cloud Messaging service worker.
// Handles background push notifications when the app tab is not focused.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Config is posted to this SW via postMessage from ServiceWorkerRegistrar
// after registration. We cache it in a module-scope variable.
let _app = null

function initIfNeeded(config) {
  if (_app) return
  if (!config || !config.apiKey) return
  try {
    _app = firebase.initializeApp(config)
  } catch (e) {
    // Already initialized (e.g. after SW update)
    _app = firebase.app()
  }
}

// Listen for config posted from the page
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    initIfNeeded(event.data.config)
  }
})

// Handle background messages — only works after firebase is initialized
self.addEventListener('push', () => {
  // Firebase messaging compat handles this via onBackgroundMessage below
})

// Wait until we have a messaging instance to set up the handler.
// We use a small polling approach since SW modules can't await promises
// at the top level in all environments.
let _messagingSetup = false

function setupMessaging() {
  if (_messagingSetup || !_app) return
  try {
    const messaging = firebase.messaging()
    _messagingSetup = true

    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? 'Umart'
      const body  = payload.notification?.body  ?? ''
      const url   = payload.data?.url ?? '/'
      const tag   = payload.notification?.tag   ?? 'umart-default'

      self.registration.showNotification(title, {
        body,
        icon:     '/icon-192x192.png',
        badge:    '/badge-72x72.png',
        tag,
        renotify: true,
        data: { url },
      })
    })
  } catch (e) {
    console.warn('[FCM SW] Could not set up messaging:', e)
  }
}

// Notification click — navigate to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            if ('navigate' in client) client.navigate(url)
            return
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})

// Periodically try to set up messaging once config is received
self.addEventListener('activate', () => {
  const interval = setInterval(() => {
    setupMessaging()
    if (_messagingSetup) clearInterval(interval)
  }, 500)
  // Stop trying after 10 seconds if config never arrives
  setTimeout(() => clearInterval(interval), 10000)
})

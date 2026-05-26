// public/firebase-messaging-sw.js
// Firebase Cloud Messaging service worker.
// Handles background push notifications when the app tab is not focused.
//
// iOS PWA note: registered at scope /firebase-messaging-sw/ (unique scope)
// to avoid conflicting with the PWA cache SW at scope /.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

let _app = null
let _messagingSetup = false

function initIfNeeded(config) {
  if (_app) return
  if (!config || !config.apiKey) return
  try {
    _app = firebase.initializeApp(config)
  } catch (e) {
    _app = firebase.app()
  }
  setupMessaging()
}

function setupMessaging() {
  if (_messagingSetup || !_app) return
  try {
    const messaging = firebase.messaging()
    _messagingSetup = true

    messaging.onBackgroundMessage((payload) => {
      // iOS/Android PWAs: showNotification must be called here
      const title = payload.notification?.title ?? 'Umart'
      const body  = payload.notification?.body  ?? ''
      const url   = payload.data?.url ?? '/chat'
      const tag   = payload.notification?.tag   ?? 'umart-chat'

      return self.registration.showNotification(title, {
        body,
        icon:     '/icon-192x192.png',
        badge:    '/badge-72x72.png',
        tag,
        renotify: true,
        data:     { url },
      })
    })
  } catch (e) {
    console.warn('[FCM SW] Could not set up messaging:', e)
  }
}

// Listen for config posted from the page
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    initIfNeeded(event.data.config)
  }
})

// Notification click — navigate to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/chat'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window at that URL
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

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

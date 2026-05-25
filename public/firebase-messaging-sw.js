// public/firebase-messaging-sw.js
// Firebase Cloud Messaging service worker.
// This file MUST be at the root of /public so it's served from /.
// It handles background push notifications when the app is not in focus.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// These values are injected at runtime — they are public-safe NEXT_PUBLIC_ vars.
// We can't use process.env here (no Node), so we fall back to self.__WB_MANIFEST
// trick or use a config endpoint. Simplest approach: hardcode via a build step.
// For now use a self config object that Next.js can populate via next.config.js
// env injection, or you can hardcode these directly from your Firebase Console.
firebase.initializeApp({
  apiKey:            self.__FIREBASE_CONFIG?.apiKey            || '',
  authDomain:        self.__FIREBASE_CONFIG?.authDomain        || '',
  projectId:         self.__FIREBASE_CONFIG?.projectId         || '',
  storageBucket:     self.__FIREBASE_CONFIG?.storageBucket     || '',
  messagingSenderId: self.__FIREBASE_CONFIG?.messagingSenderId || '',
  appId:             self.__FIREBASE_CONFIG?.appId             || '',
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Umart'
  const body  = payload.notification?.body  ?? ''
  const url   = payload.data?.url ?? '/'
  const tag   = payload.notification?.tag   ?? 'umart-default'

  self.registration.showNotification(title, {
    body,
    icon:    '/icon-192x192.png',
    badge:   '/badge-72x72.png',
    tag,
    renotify: true,
    data: { url },
  })
})

// Notification click — navigate to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            client.navigate(url)
            return
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})

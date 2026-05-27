'use client'
// components/service-worker-registrar.tsx
//
// Registers the Firebase Messaging service worker.
//
// KEY CHANGES vs previous version:
//
// 1. The FCM SW is now served by a Next.js route (/app/firebase-messaging-sw.js/route.ts)
//    that bakes the Firebase config in at request time. No postMessage needed.
//
// 2. The FCM SW is registered at scope '/' — this is REQUIRED for onMessage()
//    (foreground toasts) to fire. FCM's onMessage only triggers on the SW that
//    controls the current page. The previous unique-scope approach (/firebase-messaging-sw/)
//    meant the FCM SW never controlled the page, so onMessage was always silent.
//
// 3. The PWA cache SW (/sw.js) is NOT registered here — if you need it, handle
//    it separately. Two SWs cannot both be active at scope '/'. Since FCM requires
//    scope '/', FCM takes priority.

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Register the FCM SW at scope '/' so it:
    //  a) Controls the current page → onMessage() fires for foreground toasts
    //  b) Receives background push events → showNotification() fires
    //
    // The SW script is served by Next.js with the Firebase config already baked in.
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[FCM SW] Registered at scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[FCM SW] Registration failed:', err)
      })
  }, [])

  return null
}

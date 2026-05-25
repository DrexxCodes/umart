'use client'
// Registers the PWA service worker (sw.js).
// Firebase messaging SW (firebase-messaging-sw.js) is auto-registered by the
// Firebase SDK when getToken() is called — no manual registration needed.

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] PWA service worker registered, scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] PWA service worker registration failed:', err)
      })
  }, [])

  return null
}

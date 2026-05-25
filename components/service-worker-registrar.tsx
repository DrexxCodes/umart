'use client'
// Registers the PWA service worker (sw.js) AND the Firebase Messaging service
// worker (firebase-messaging-sw.js).
//
// The Firebase Messaging SW lives at a static path and cannot read
// NEXT_PUBLIC_* env vars at build time. We solve this by posting the Firebase
// config to the SW via postMessage immediately after registration, so it can
// call firebase.initializeApp() on its own scope.

import { useEffect } from 'react'

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? '',
}

function postConfigToSW(reg: ServiceWorkerRegistration) {
  const target = reg.installing ?? reg.waiting ?? reg.active
  if (!target) return

  const send = () =>
    target.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG })

  if (target.state === 'activated') {
    send()
  } else {
    target.addEventListener('statechange', function handler() {
      if (this.state === 'activated') {
        send()
        target.removeEventListener('statechange', handler)
      }
    })
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // 1. Register the PWA service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] PWA service worker registered, scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] PWA service worker registration failed:', err)
      })

    // 2. Register Firebase Messaging SW and inject config via postMessage
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[FCM SW] Firebase messaging SW registered')
        postConfigToSW(reg)

        // Also post config when SW updates
        reg.addEventListener('updatefound', () => {
          postConfigToSW(reg)
        })
      })
      .catch((err) => {
        console.warn('[FCM SW] Firebase messaging SW registration failed:', err)
      })

    // 3. Post config to any already-active SW controller (e.g. after page reload)
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'FIREBASE_CONFIG',
        config: FIREBASE_CONFIG,
      })
    }
  }, [])

  return null
}

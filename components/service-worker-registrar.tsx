'use client'
// components/service-worker-registrar.tsx
//
// Registers:
//   1. /sw.js               — PWA cache service worker  (scope: /)
//   2. /firebase-messaging-sw.js — FCM push SW          (scope: /firebase-messaging-sw/)
//
// KEY iOS FIX: The two SWs use DIFFERENT scopes so they never conflict.
// firebase-messaging-sw.js is at scope /firebase-messaging-sw/ which means
// it won't intercept page fetches but WILL receive push events from FCM.
//
// Config injection: We post the Firebase config via postMessage immediately
// after registration AND whenever the controller changes (covers iOS reload).

import { useEffect } from 'react'

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? '',
}

/** Post Firebase config to a specific ServiceWorker instance */
function postConfig(sw: ServiceWorker) {
  const msg = { type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG }
  if (sw.state === 'activated') {
    sw.postMessage(msg)
  } else {
    sw.addEventListener('statechange', function handler() {
      if (this.state === 'activated') {
        sw.postMessage(msg)
        sw.removeEventListener('statechange', handler)
      }
    })
  }
}

/** Post config to whichever worker is most alive in the registration */
function postConfigToReg(reg: ServiceWorkerRegistration) {
  const target = reg.active ?? reg.waiting ?? reg.installing
  if (target) postConfig(target)
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // 1. Register the PWA cache SW at scope /
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] PWA cache worker registered, scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[SW] PWA cache worker registration failed:', err)
      })

    // 2. Register FCM SW at a UNIQUE scope so it never conflicts with sw.js
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/firebase-messaging-sw/' })
      .then((reg) => {
        console.log('[FCM SW] Firebase messaging SW registered, scope:', reg.scope)
        postConfigToReg(reg)

        // Re-inject config when the SW updates (e.g. after deploy)
        reg.addEventListener('updatefound', () => {
          postConfigToReg(reg)
        })
      })
      .catch((err) => {
        console.warn('[FCM SW] Firebase messaging SW registration failed:', err)
      })

    // 3. On iOS Safari, after a page reload the SW controller is already active.
    //    Post config to it immediately so background push keeps working.
    const sendToController = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'FIREBASE_CONFIG',
          config: FIREBASE_CONFIG,
        })
      }
    }
    sendToController()

    // 4. Re-send config whenever the controlling SW changes (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', sendToController)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', sendToController)
    }
  }, [])

  return null
}

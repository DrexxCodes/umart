'use client'
// components/fcm-permission-prompt.tsx
//
// Handles notification permission + FCM token registration + foreground toasts.
//
// The FCM SW is now at scope '/' (registered by ServiceWorkerRegistrar) and
// served by a Next.js route with Firebase config already baked in.
// getToken() finds it automatically — no custom serviceWorkerRegistration needed.

import { useEffect, useState } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { auth, getFirebaseMessaging } from '@/lib/firebase'
import { toast } from 'sonner'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

const VAPID_KEY   = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
const SESSION_KEY = 'umart_notif_dismissed'

type PromptState = 'idle' | 'prompting' | 'done'

export function FcmPermissionPrompt() {
  const [state,      setState]      = useState<PromptState>('idle')
  const [requesting, setRequesting] = useState(false)

  // ── On mount: check current permission state ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const perm = Notification.permission

    if (perm === 'granted') {
      // Already granted — silently refresh the token
      registerTokenSilently()
      return
    }
    if (perm === 'denied') return

    // 'default' — can still ask, unless dismissed this session
    if (sessionStorage.getItem(SESSION_KEY)) return

    const t = setTimeout(() => setState('prompting'), 1500)
    return () => clearTimeout(t)
  }, [])

  // ── Listen for foreground messages → show as Sonner toasts ───────────────
  // onMessage only fires when the FCM SW controls the current page (scope '/').
  // That's now guaranteed by ServiceWorkerRegistrar.
  useEffect(() => {
    let unsub: (() => void) | undefined
    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return
      unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? 'New message'
        const body  = payload.notification?.body  ?? ''
        const url   = (payload.data?.url as string) ?? '/chat'
        toast(title, {
          description: body,
          action: {
            label:   'View',
            onClick: () => window.location.assign(url),
          },
        })
      })
    })
    return () => unsub?.()
  }, [])

  // ── Register FCM token ────────────────────────────────────────────────────
  // getToken() automatically uses the SW that controls the page (scope '/').
  // No need to pass serviceWorkerRegistration manually.
  const registerTokenSilently = async () => {
    try {
      const messaging = await getFirebaseMessaging()
      if (!messaging || !VAPID_KEY) {
        console.warn('[FCM] messaging unavailable or VAPID key missing')
        return
      }

      // Wait for the SW to be ready before requesting a token
      await navigator.serviceWorker.ready

      const token = await getToken(messaging, { vapidKey: VAPID_KEY })
      if (token) {
        console.log('[FCM] Token obtained, saving...')
        await saveToken(token)
      } else {
        console.warn('[FCM] getToken returned empty — permission may not be granted')
      }
    } catch (err) {
      console.warn('[FCM] Token registration error:', err)
    }
  }

  // ── User clicked "Allow" ──────────────────────────────────────────────────
  const handleAllow = async () => {
    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await registerTokenSilently()
        toast.success("Notifications enabled! You'll never miss a message.")
      }
    } catch (err) {
      console.error('[FCM] Permission request error:', err)
    } finally {
      sessionStorage.setItem(SESSION_KEY, '1')
      setRequesting(false)
      setState('done')
    }
  }

  // ── User dismissed ────────────────────────────────────────────────────────
  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    setState('done')
  }

  if (state !== 'prompting') return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Stay in the loop</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Allow push notifications so you never miss a message even when the app is in the background.
              Tap <strong>Allow</strong> and confirm in the next prompt.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-muted-foreground"
            onClick={handleDismiss}
          >
            <BellOff className="w-3.5 h-3.5" />
            Not now
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleAllow}
            disabled={requesting}
          >
            <Bell className="w-3.5 h-3.5" />
            {requesting ? 'Requesting…' : 'Allow'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Save token to Firestore via the register API ──────────────────────────────
async function saveToken(token: string) {
  const user = auth.currentUser
  if (!user) return
  try {
    const idToken = await user.getIdToken()
    const res = await fetch('/api/fcm/register', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    })
    const result = await res.json()
    if (result.success) {
      console.log('[FCM] Token saved to Firestore')
    } else {
      console.warn('[FCM] Token save failed:', result.error)
    }
  } catch (err) {
    console.warn('[FCM] Token save error:', err)
  }
}

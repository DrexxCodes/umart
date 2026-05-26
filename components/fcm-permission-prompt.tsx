'use client'
// components/fcm-permission-prompt.tsx
//
// Shows a friendly bottom sheet asking for notification permission.
// Rendered on BOTH buyer chat (/chat) and seller chat (/creator/chat).
//
// iOS PWA fix: getToken() must use the FCM SW's unique scope so Firebase
// associates the token with the correct service worker registration.
//
// Behaviour:
//  - On mount: if permission is already 'granted' → silently register token.
//  - If permission is 'denied' → do nothing.
//  - If permission is 'default' → show the prompt after a 1.5s settle delay,
//    UNLESS the user already dismissed it this session (sessionStorage flag).
//  - Foreground messages → shown as Sonner toasts.

import { useEffect, useState } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { auth, getFirebaseMessaging } from '@/lib/firebase'
import { toast } from 'sonner'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

const VAPID_KEY   = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
const SESSION_KEY = 'umart_notif_dismissed'
// Must match the scope used in ServiceWorkerRegistrar
const FCM_SW_URL  = '/firebase-messaging-sw.js'
const FCM_SW_SCOPE = '/firebase-messaging-sw/'

type PromptState = 'idle' | 'prompting' | 'done'

export function FcmPermissionPrompt() {
  const [state,      setState]      = useState<PromptState>('idle')
  const [requesting, setRequesting] = useState(false)

  // ── On mount: check current permission state ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const perm = Notification.permission

    if (perm === 'granted') {
      registerTokenSilently()
      return
    }
    if (perm === 'denied') return

    // perm === 'default' — can still ask
    if (sessionStorage.getItem(SESSION_KEY)) return

    const t = setTimeout(() => setState('prompting'), 1500)
    return () => clearTimeout(t)
  }, [])

  // ── Listen for foreground messages and show as toasts ─────────────────────
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

  // ── Get the FCM SW registration (unique scope) ────────────────────────────
  const getFcmSwRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
    if (!('serviceWorker' in navigator)) return undefined
    // Look for an already-registered FCM SW by its scope
    const regs = await navigator.serviceWorker.getRegistrations()
    const existing = regs.find((r) => r.scope.includes('firebase-messaging-sw'))
    if (existing) return existing
    // Not registered yet — register it now (edge case on first load)
    return navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE })
  }

  // ── Silently register FCM token ────────────────────────────────────────────
  const registerTokenSilently = async () => {
    try {
      const messaging = await getFirebaseMessaging()
      if (!messaging || !VAPID_KEY) return

      const swReg = await getFcmSwRegistration()

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        // Providing serviceWorkerRegistration ensures iOS uses the correct SW
        ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
      })
      if (token) await saveToken(token)
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

  // ── User dismissed the card ───────────────────────────────────────────────
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

async function saveToken(token: string) {
  const user = auth.currentUser
  if (!user) return
  try {
    const idToken = await user.getIdToken()
    await fetch('/api/fcm/register', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    })
  } catch {
    // Non-critical
  }
}

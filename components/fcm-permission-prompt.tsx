'use client'
// components/fcm-permission-prompt.tsx
//
// Shows a friendly dialog asking the user for notification permission.
// Rendered on the chat pages. Stores the resulting FCM token server-side.
// If the user is currently on the app, real FCM pushes are suppressed in
// favour of in-app toasts (handled in the service worker via focus check).

import { useEffect, useState } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { auth, getFirebaseMessaging } from '@/lib/firebase'
import { toast } from 'sonner'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
const STORAGE_KEY = 'umart_notif_prompt'

type PromptState = 'idle' | 'prompting' | 'done'

export function FcmPermissionPrompt() {
  const [state, setState] = useState<PromptState>('idle')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    // Only show once, only in browser, only if not already granted/denied
    if (typeof window === 'undefined') return
    if (Notification.permission === 'granted') {
      // Already granted — silently register token in background
      registerTokenSilently()
      return
    }
    if (Notification.permission === 'denied') return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) return

    // Small delay so the page settles before showing the prompt
    const t = setTimeout(() => setState('prompting'), 2000)
    return () => clearTimeout(t)
  }, [])

  // Listen for foreground messages and show them as toasts instead of native notifs
  useEffect(() => {
    let unsub: (() => void) | undefined
    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return
      unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? 'New message'
        const body  = payload.notification?.body  ?? ''
        const url   = (payload.data?.url as string) ?? '/'
        toast(title, {
          description: body,
          action: {
            label: 'View',
            onClick: () => window.location.assign(url),
          },
        })
      })
    })
    return () => unsub?.()
  }, [])

  const registerTokenSilently = async () => {
    try {
      const messaging = await getFirebaseMessaging()
      if (!messaging || !VAPID_KEY) return
      const token = await getToken(messaging, { vapidKey: VAPID_KEY })
      if (token) await saveToken(token)
    } catch {
      // Silently ignore — non-critical
    }
  }

  const handleAllow = async () => {
    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await registerTokenSilently()
        toast.success('Notifications enabled!')
      }
    } catch (err) {
      console.error('FCM permission error:', err)
    } finally {
      localStorage.setItem(STORAGE_KEY, 'done')
      setRequesting(false)
      setState('done')
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setState('done')
  }

  if (state !== 'prompting') return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Stay in the loop</h3>
            <p className="text-xs text-muted-foreground mt-1">
              We'd like to send you push notifications when someone messages you — so you never miss a deal.
              Just click <strong>Alright</strong> and allow in the next screen.
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
            Please don't
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleAllow}
            disabled={requesting}
          >
            <Bell className="w-3.5 h-3.5" />
            Alright!
          </Button>
        </div>
      </div>
    </div>
  )
}

async function saveToken(token: string) {
  const user = auth.currentUser
  if (!user) return
  const idToken = await user.getIdToken()
  await fetch('/api/fcm/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ token }),
  })
}

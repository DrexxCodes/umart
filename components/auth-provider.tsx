'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onIdTokenChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

// Persists the Firebase ID token as an HttpOnly cookie via /api/users/cookies.
// Called on every token change and proactively before the token could expire.
async function persistToken(user: User): Promise<void> {
  try {
    const token = await user.getIdToken(/* forceRefresh */ false)
    await fetch('/api/users/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch (error) {
    console.error('[auth-provider] Error persisting token:', error)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onIdTokenChanged fires on:
    //   • sign-in / sign-out
    //   • token auto-refresh by the Firebase SDK (every ~55 min)
    //
    // This is better than onAuthStateChanged + a manual setInterval because:
    //   1. The Firebase SDK already refreshes the token automatically.
    //   2. onIdTokenChanged gives us the new token the moment it's refreshed —
    //      we just need to write it into the cookie. No manual timer needed.
    //   3. It also fires on sign-out (user = null) so we can clear the cookie.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        await persistToken(firebaseUser)
      } else {
        // User signed out — clear the session cookie
        try {
          await fetch('/api/users/cookies', {
            method: 'DELETE',
          })
        } catch {
          // Best-effort; cookie will expire on its own
        }
      }

      setLoading(false)
    })

    // ── PWA / background-tab fix ───────────────────────────────────────────
    // When the app is installed as a PWA or the tab has been in the background
    // for a long time, the setInterval in the old approach would stop firing.
    // Listening to visibilitychange and force-refreshing the token when the
    // app comes back to the foreground ensures the cookie is always fresh
    // before any authenticated API call is made.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      const currentUser = auth.currentUser
      if (!currentUser) return
      try {
        const result = await currentUser.getIdTokenResult()
        const expiresAt = new Date(result.expirationTime).getTime()
        const nowMs = Date.now()
        const fiveMinMs = 5 * 60 * 1000
        // Force refresh if the token is expired or expires within 5 minutes.
        // This covers the PWA-killed-and-reopened case where the token may
        // already be past expiry by the time we get the visibilitychange event.
        if (expiresAt - nowMs < fiveMinMs) {
          const token = await currentUser.getIdToken(/* forceRefresh */ true)
          await fetch('/api/users/cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
        }
      } catch (err) {
        console.error('[auth-provider] Visibility refresh failed:', err)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

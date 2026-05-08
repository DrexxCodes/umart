'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { CreatorNav } from '@/components/nav/creator-nav'
import { DashboardContent } from './components/dashboard-content'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  getDashboardCache,
  setDashboardCache,
  getUsernameCache,
  setUsernameCache,
  clearAllCreatorCache,
} from '@/lib/creator-cache'

export default function DashboardClient() {
  const [data, setData]       = useState<any>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // User logged out — wipe the mf
        clearAllCreatorCache()
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // ── 1. Hydrate username from session immediately (no flicker) ────────
      const cachedUsername = getUsernameCache()

      // ── 2. Check dashboard cache ─────────────────────────────────────────
      const cached = getDashboardCache<any>()
      if (cached) {
        // Patch in the session username in case it's fresher than the cache
        if (cachedUsername && !cached.username) {
          cached.username = cachedUsername
        }
        setData(cached)
        setLoading(false)
        return
      }

      // ── 3. Cache miss — fetch from API ────────────────────────────────────
      try {
        const token = await user.getIdToken()
        const res   = await fetch('/api/creator', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load dashboard')
        }

        const payload = json.data

        // Persist username to sessionStorage so it survives TTL expiry
        if (payload.username) {
          setUsernameCache(payload.username)
        }

        // Persist full payload to localStorage with timestamp
        setDashboardCache(payload)
        setData(payload)
      } catch (err: any) {
        setError(err.message ?? 'Something went wrong')
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <CreatorNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive max-w-md mx-auto mt-16">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {data && !loading && <DashboardContent data={data} />}
      </main>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { Users, Loader2 } from 'lucide-react'

export default function UserStatsBar() {
  const [count, setCount]     = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCount() {
      try {
        const res  = await fetch('/api/admin/users?count=true')
        const json = await res.json()
        if (json.success) setCount(json.count)
      } catch {
        // silently fail — count is non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchCount()
  }, [])

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Users size={16} />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">Total Users</p>
        {loading ? (
          <Loader2 size={14} className="mt-0.5 animate-spin text-muted-foreground" />
        ) : (
          <p className="font-semibold text-foreground tabular-nums">
            {count !== null ? count.toLocaleString() : '—'}
          </p>
        )}
      </div>
    </div>
  )
}
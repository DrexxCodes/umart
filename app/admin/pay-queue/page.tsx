'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, Clock, CheckCircle2, XCircle,
  RefreshCw, ChevronRight, Loader2, AlertCircle,
} from 'lucide-react'
import PayQueueDialog, { PayQueueItem } from './components/PayQueueDialog'

type FilterStatus = 'all' | 'pending' | 'paid' | 'failed'

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock,         cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  paid:    { label: 'Paid',    icon: CheckCircle2,   cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' },
  failed:  { label: 'Failed',  icon: XCircle,        cls: 'bg-destructive/10 text-destructive border-destructive/25' },
}

export default function AdminPayQueuePage() {
  const [items,     setItems]     = useState<PayQueueItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [filter,    setFilter]    = useState<FilterStatus>('all')
  const [selected,  setSelected]  = useState<PayQueueItem | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchQueue() {
      setLoading(true)
      setError(null)
      try {
        const url  = filter === 'all'
          ? '/api/admin/payQueue'
          : `/api/admin/payQueue?status=${filter}`
        const res  = await fetch(url)
        const json = await res.json()
        if (json.success) setItems(json.data)
        else setError(json.error ?? 'Failed to load queue')
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchQueue()
  }, [filter, refreshKey])

  const handleUpdated = useCallback((refId: string, action: 'paid' | 'failed') => {
    setItems((prev) =>
      prev.map((item) =>
        item.refId === refId
          ? { ...item, status: action, ...(action === 'paid' ? { paidAt: new Date().toISOString() } : { failedAt: new Date().toISOString() }) }
          : item
      )
    )
    setSelected(null)
  }, [])

  // Counts
  const counts = items.reduce(
    (acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc },
    {} as Record<string, number>
  )
  const pendingTotal = items
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + i.payoutAmount, 0)

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet size={18} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground">Pay Queue</h1>
                <p className="text-xs text-muted-foreground">Manage seller payout requests</p>
              </div>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-1.5 self-start rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted sm:self-auto"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Summary pills */}
          {!loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              <SummaryPill
                icon={<Clock size={12} />}
                label={`${counts.pending ?? 0} pending`}
                sub={fmt(pendingTotal)}
                cls="border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400"
              />
              <SummaryPill
                icon={<CheckCircle2 size={12} />}
                label={`${counts.paid ?? 0} paid`}
                cls="border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
              />
              <SummaryPill
                icon={<XCircle size={12} />}
                label={`${counts.failed ?? 0} failed`}
                cls="border-destructive/20 bg-destructive/8 text-destructive"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Filter tabs */}
        <div className="mb-4 flex overflow-x-auto rounded-xl border border-border bg-card p-1 gap-1">
          {(['all', 'pending', 'paid', 'failed'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f === 'all' ? `All (${items.length})` : `${f} (${counts[f] ?? 0})`}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-border bg-muted/40"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <Wallet size={40} strokeWidth={1.2} />
            <p className="text-sm font-medium">No {filter === 'all' ? '' : filter} payouts</p>
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((item) => {
              const cfg = STATUS_CONFIG[item.status]
              const Icon = cfg.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  {/* Status icon */}
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${cfg.cls}`}>
                    <Icon size={14} />
                  </span>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold text-foreground">
                      {item.refId}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {timeAgo(item.pendingAt)} · {fmtDate(item.pendingAt)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold text-foreground">
                      {fmt(item.payoutAmount)}
                    </p>
                    <p className={`text-[10px] font-semibold ${cfg.cls.split(' ').find(c => c.startsWith('text-'))}`}>
                      {cfg.label}
                    </p>
                  </div>

                  <ChevronRight size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Dialog */}
      {selected && (
        <PayQueueDialog
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

function SummaryPill({
  icon, label, sub, cls,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  cls: string
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${cls}`}>
      {icon}
      {label}
      {sub && <span className="ml-1 font-mono opacity-70">{sub}</span>}
    </div>
  )
}
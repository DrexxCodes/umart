'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Wallet, Clock, CheckCircle2, XCircle, RefreshCw,
  Loader2, AlertCircle, Search, ChevronLeft, ChevronRight,
  Zap,
} from 'lucide-react'
import PayQueueDialog, { PayQueueItem } from './components/PayQueueDialog'

type FilterStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed'

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
  pending:    { label: 'Pending',    icon: Clock,         cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  processing: { label: 'Processing', icon: Zap,           cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  completed:  { label: 'Completed',  icon: CheckCircle2,  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' },
  failed:     { label: 'Failed',     icon: XCircle,       cls: 'bg-destructive/10 text-destructive border-destructive/25' },
}

export default function AdminPayQueuePage() {
  const [items,      setItems]      = useState<PayQueueItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [filter,     setFilter]     = useState<FilterStatus>('all')
  const [selected,   setSelected]   = useState<PayQueueItem | null>(null)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Search
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      params.set('page', String(page))
      if (searchQuery) params.set('search', searchQuery)

      const res  = await fetch(`/api/admin/payQueue?${params}`)
      const json = await res.json()
      if (json.success) {
        setItems(json.data)
        setTotalPages(json.totalPages ?? 1)
        setTotalCount(json.totalCount ?? 0)
        // Auto-select first item on large screens if nothing selected
        if (json.data.length > 0 && !selected) {
          setSelected(json.data[0])
        }
      } else {
        setError(json.error ?? 'Failed to load queue')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, searchQuery])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // When filter changes, reset to page 1 and clear selection
  const handleFilterChange = (f: FilterStatus) => {
    setFilter(f)
    setPage(1)
    setSelected(null)
    setSearchInput('')
    setSearchQuery('')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSelected(null)
    setSearchQuery(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
    setSelected(null)
  }

  const handleUpdated = useCallback((refId: string, action: 'processing' | 'completed' | 'failed') => {
    setItems((prev) =>
      prev.map((item) =>
        item.refId === refId
          ? {
              ...item,
              status: action,
              ...(action === 'completed' ? { completedAt: new Date().toISOString() } : {}),
              ...(action === 'failed'    ? { failedAt:    new Date().toISOString() } : {}),
            }
          : item
      )
    )
    // Update selected too
    setSelected((prev) =>
      prev?.refId === refId
        ? {
            ...prev,
            status: action,
            ...(action === 'completed' ? { completedAt: new Date().toISOString() } : {}),
            ...(action === 'failed'    ? { failedAt:    new Date().toISOString() } : {}),
          }
        : prev
    )
  }, [])

  const pendingTotal = items
    .filter((i) => i.status === 'pending' || i.status === 'processing')
    .reduce((sum, i) => sum + i.payoutAmount, 0)

  const counts = items.reduce(
    (acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc },
    {} as Record<string, number>
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet size={18} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground">Pay Queue</h1>
                <p className="text-xs text-muted-foreground">
                  {totalCount} total payout request{totalCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by ref ID…"
                  className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchQueue()}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </form>
          </div>

          {/* Summary pills */}
          {!loading && (
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill icon={<Clock size={11} />}        label={`${counts.pending    ?? 0} pending`}    cls="border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400" />
              <SummaryPill icon={<Zap size={11} />}          label={`${counts.processing ?? 0} processing`} cls="border-blue-500/20 bg-blue-500/8 text-blue-600 dark:text-blue-400" />
              <SummaryPill icon={<CheckCircle2 size={11} />} label={`${counts.completed  ?? 0} completed`}  cls="border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400" />
              <SummaryPill icon={<XCircle size={11} />}      label={`${counts.failed     ?? 0} failed`}     cls="border-destructive/20 bg-destructive/8 text-destructive" />
              {pendingTotal > 0 && (
                <SummaryPill icon={<Wallet size={11} />} label={`${fmt(pendingTotal)} outstanding`} cls="border-primary/20 bg-primary/8 text-primary" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="border-b border-border bg-card px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex overflow-x-auto gap-0.5 py-2">
            {(['all', 'pending', 'processing', 'completed', 'failed'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  filter === f
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {f === 'all' ? `All` : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body — two-panel on large screens ── */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:flex lg:gap-4">

        {/* ── Left panel — ref ID list ── */}
        <div className="lg:w-80 xl:w-96 shrink-0 flex flex-col">

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-border bg-muted/40"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Wallet size={36} strokeWidth={1.2} />
              <p className="text-sm font-medium">
                {searchQuery ? `No results for "${searchQuery}"` : `No ${filter === 'all' ? '' : filter} payouts`}
              </p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="space-y-1.5 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto pr-1">
              {items.map((item) => {
                const cfg  = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                const Icon = cfg.icon
                const isActive = selected?.refId === item.refId
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${cfg.cls}`}>
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] font-semibold text-foreground">
                        {item.refId}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {timeAgo(item.pendingAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-bold text-foreground">{fmt(item.payoutAmount)}</p>
                      <p className={`text-[9px] font-semibold capitalize ${cfg.cls.split(' ').find(c => c.startsWith('text-'))}`}>
                        {cfg.label}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1 flex-wrap">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={13} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-1.5 text-xs font-semibold transition-all ${
                    p === page
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Right panel — details (large screens only) ── */}
        <div className="hidden lg:flex flex-1 items-start">
          {selected ? (
            <div className="w-full">
              <PayQueueDialog
                item={selected}
                onClose={() => setSelected(null)}
                onUpdated={handleUpdated}
                inline
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground w-full">
              <Wallet size={48} strokeWidth={1} />
              <p className="text-sm">Select a payout request to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile dialog (small screens) ── */}
      <div className="lg:hidden">
        {selected && (
          <PayQueueDialog
            item={selected}
            onClose={() => setSelected(null)}
            onUpdated={handleUpdated}
          />
        )}
      </div>
    </div>
  )
}

function SummaryPill({ icon, label, cls }: { icon: React.ReactNode; label: string; cls: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {icon}{label}
    </div>
  )
}

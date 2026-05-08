'use client'

import { useEffect, useState } from 'react'
import AdminDisputeDialog from './components/AdminDisputeDialog'
import { Loader2, ShieldAlert, RefreshCw, Filter } from 'lucide-react'

interface Dispute {
  id: string
  txnId: string
  buyerId: string
  sellerId: string
  status: 'open' | 'resolving' | 'closed' | 'refunded'
  title: string
  details: string
  productName: string
  grandPrice: number
  attachments: Array<{ url: string; type: string }>
  buyerBankName: string
  buyerAccountNumber: string
  buyerAccountName: string
  createdAt: string
  updatedAt: string
}

type FilterStatus = 'all' | 'open' | 'resolving' | 'closed' | 'refunded'

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CONFIG = {
  open:      { label: 'Open',      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  resolving: { label: 'Resolving', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  closed:    { label: 'Closed',    cls: 'bg-muted text-muted-foreground border-border' },
  refunded:  { label: 'Refunded',  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' },
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/dispute/list?role=admin')
        const data = await res.json()
        if (data.success) setDisputes(data.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshKey])

  const filtered = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter)

  const statusCounts = {
    all: disputes.length,
    open: disputes.filter((d) => d.status === 'open').length,
    resolving: disputes.filter((d) => d.status === 'resolving').length,
    closed: disputes.filter((d) => d.status === 'closed').length,
    refunded: disputes.filter((d) => d.status === 'refunded').length,
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            Disputes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and resolve buyer disputes</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'open', 'resolving', 'closed', 'refunded'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
            }`}
          >
            {s === 'all' ? 'All' : s} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No disputes found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((dispute) => {
            const cfg = STATUS_CONFIG[dispute.status]
            return (
              <button
                key={dispute.id}
                onClick={() => setSelected(dispute)}
                className="w-full text-left p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{dispute.txnId}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground truncate">{dispute.title}</h3>
                    <p className="text-sm text-muted-foreground">{dispute.productName}</p>
                    <p className="text-sm font-medium text-primary mt-0.5">{fmt(dispute.grandPrice)}</p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    <p>{fmtDate(dispute.createdAt)}</p>
                    {dispute.attachments?.length > 0 && (
                      <p className="mt-0.5 text-primary/60">{dispute.attachments.length} attachment{dispute.attachments.length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <AdminDisputeDialog
          dispute={selected}
          onClose={() => setSelected(null)}
          onUpdated={(txnId, newStatus) => {
            setDisputes((prev) =>
              prev.map((d) => d.txnId === txnId ? { ...d, status: newStatus } : d)
            )
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

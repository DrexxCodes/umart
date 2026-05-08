'use client'

import { useState, useEffect } from 'react'
import {
  X, Banknote, User, Hash, Clock, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Building2,
} from 'lucide-react'

export interface PayQueueItem {
  id:            string
  refId:         string
  sellerId:      string
  payoutAmount:  number
  bankCode:      string
  bankName:      string
  accountNumber: string
  accountName:   string
  status:        'pending' | 'paid' | 'failed'
  pendingAt:     string
  paidAt?:       string | null
  failedAt?:     string | null
  failureReason?: string | null
  resolvedByUid?: string | null
}

interface PayQueueDialogProps {
  item:      PayQueueItem
  onClose:   () => void
  onUpdated: (refId: string, action: 'paid' | 'failed') => void
}

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
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function PayQueueDialog({ item, onClose, onUpdated }: PayQueueDialogProps) {
  const [action,        setAction]        = useState<'paid' | 'failed' | null>(null)
  const [failureReason, setFailureReason] = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit() {
    if (!action) return
    if (action === 'failed' && !failureReason.trim()) {
      setError('Please provide a reason for failure.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/admin/api/payqueue', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          refId: item.refId,
          action,
          ...(action === 'failed' ? { failureReason: failureReason.trim() } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Request failed')
      onUpdated(item.refId, action)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isPending = item.status === 'pending'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              item.status === 'paid'    ? 'bg-emerald-500/10 text-emerald-500' :
              item.status === 'failed'  ? 'bg-destructive/10 text-destructive' :
                                          'bg-amber-500/10 text-amber-500'
            }`}>
              {item.status === 'paid'   ? <CheckCircle2 size={16} /> :
               item.status === 'failed' ? <XCircle size={16} /> :
                                          <Clock size={16} />}
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Payout Request</h2>
              <p className="font-mono text-[10px] text-muted-foreground">{item.refId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5 space-y-4">

          {/* Amount */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Banknote size={14} />
              Payout Amount
            </div>
            <span className="font-mono text-lg font-bold text-foreground">{fmt(item.payoutAmount)}</span>
          </div>

          {/* Bank details */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <Building2 size={12} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bank Details</span>
            </div>
            <div className="divide-y divide-border/60 px-4">
              {[
                { icon: Building2, label: 'Bank',           value: item.bankName,       mono: false },
                { icon: User,      label: 'Account Name',   value: item.accountName,    mono: false },
                { icon: Hash,      label: 'Account Number', value: item.accountNumber,  mono: true  },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-center justify-between py-2.5 gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                    <Icon size={10} />{label}
                  </span>
                  <span className={`text-xs text-foreground text-right ${mono ? 'font-mono' : 'font-medium'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timing */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <Clock size={12} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timeline</span>
            </div>
            <div className="divide-y divide-border/60 px-4">
              <div className="flex items-center justify-between py-2.5 gap-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Requested</span>
                <div className="text-right">
                  <p className="text-xs font-mono text-foreground">{fmtDate(item.pendingAt)}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(item.pendingAt)}</p>
                </div>
              </div>
              {item.status === 'paid' && item.paidAt && (
                <div className="flex items-center justify-between py-2.5 gap-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Paid At</span>
                  <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">{fmtDate(item.paidAt)}</p>
                </div>
              )}
              {item.status === 'failed' && item.failedAt && (
                <div className="flex items-center justify-between py-2.5 gap-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Failed At</span>
                  <p className="text-xs font-mono text-destructive">{fmtDate(item.failedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Failure reason display (resolved) */}
          {item.status === 'failed' && item.failureReason && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-destructive">Failure Reason</p>
                <p className="mt-0.5 text-xs text-destructive/80">{item.failureReason}</p>
              </div>
            </div>
          )}

          {/* ── Action area — only for pending ── */}
          {isPending && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Resolve Payout
              </p>

              {/* Action selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setAction('paid'); setError(null) }}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                    action === 'paid'
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-border bg-card text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-600'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  Mark Paid
                </button>
                <button
                  type="button"
                  onClick={() => { setAction('failed'); setError(null) }}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                    action === 'failed'
                      ? 'border-destructive/50 bg-destructive/10 text-destructive'
                      : 'border-border bg-card text-muted-foreground hover:border-destructive/30 hover:text-destructive'
                  }`}
                >
                  <XCircle size={14} />
                  Mark Failed
                </button>
              </div>

              {/* Failure reason input */}
              {action === 'failed' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
                    Reason for failure <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={failureReason}
                    onChange={(e) => { setFailureReason(e.target.value); setError(null) }}
                    placeholder="e.g. Invalid account number, bank transfer rejected…"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-destructive/30 bg-background px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-destructive/60 focus:outline-none focus:ring-2 focus:ring-destructive/20 transition-all"
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}

              {/* Submit */}
              {action && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                    action === 'paid'
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-destructive text-destructive-foreground hover:opacity-90'
                  }`}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? 'Processing…' : action === 'paid' ? 'Confirm Payment' : 'Confirm Failure'}
                </button>
              )}
            </div>
          )}

          {/* Resolved banner */}
          {!isPending && (
            <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${
              item.status === 'paid'
                ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/20 bg-destructive/8 text-destructive'
            }`}>
              {item.status === 'paid' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <p className="text-xs font-semibold">
                This payout has been marked as <span className="uppercase">{item.status}</span>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import {
  X, ShieldAlert, Loader2, AlertTriangle, CheckCircle2,
  FileImage, FileVideo, ExternalLink, Banknote, User, Building2, Hash,
  Mail, Info,
} from 'lucide-react'

interface Dispute {
  id: string
  txnId: string
  buyerId: string
  sellerId: string
  buyerEmail?: string
  sellerEmail?: string
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
}

interface Props {
  dispute: Dispute
  onClose: () => void
  onUpdated: (txnId: string, newStatus: Dispute['status']) => void
}

type DisputeStatus = 'open' | 'resolving' | 'closed' | 'refunded'

const STATUS_OPTIONS: { value: DisputeStatus; label: string; cls: string }[] = [
  { value: 'open',      label: 'Open',      cls: 'text-amber-600 dark:text-amber-400' },
  { value: 'resolving', label: 'Resolving', cls: 'text-blue-600 dark:text-blue-400' },
  { value: 'closed',    label: 'Closed',    cls: 'text-muted-foreground' },
  { value: 'refunded',  label: 'Refunded',  cls: 'text-emerald-600 dark:text-emerald-400' },
]

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminDisputeDialog({ dispute, onClose, onUpdated }: Props) {
  const [newStatus, setNewStatus] = useState<DisputeStatus>(dispute.status)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRefundConfirm, setShowRefundConfirm] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // Email compose
  const [emailBody, setEmailBody] = useState('')
  const emailSubject = 'Umart Dispute'

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const hasChanged = newStatus !== dispute.status
  const isRefundAction = newStatus === 'refunded'
  const isCloseAction = newStatus === 'closed'
  const isAlreadyRefunded = dispute.status === 'refunded'

  async function handleSubmit() {
    if (!hasChanged) return

    if (isRefundAction && !showRefundConfirm) {
      setShowRefundConfirm(true)
      return
    }

    if (isCloseAction && !showCloseConfirm) {
      setShowCloseConfirm(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/dispute/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txnId: dispute.txnId, status: newStatus }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Update failed')
      onUpdated(dispute.txnId, newStatus)
    } catch (err: any) {
      setError(err.message)
      setShowRefundConfirm(false)
      setShowCloseConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenMail = () => {
    const recipients = [dispute.buyerEmail, dispute.sellerEmail].filter(Boolean).join(',')
    const mailtoUrl = `mailto:${recipients}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    window.open(mailtoUrl, '_blank')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Dispute Details</h2>
              <p className="font-mono text-[10px] text-muted-foreground">{dispute.txnId}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-4 flex-1">

          {/* Amount */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Banknote size={14} /> Disputed Amount
            </div>
            <span className="font-mono text-lg font-bold text-foreground">{fmt(dispute.grandPrice)}</span>
          </div>

          {/* Title + details */}
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground">{dispute.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{dispute.details}</p>
          </div>

          {/* Parties emails */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <Mail size={12} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parties</span>
            </div>
            <div className="divide-y divide-border/60 px-4">
              <div className="flex items-center justify-between py-2.5 gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                  <User size={10} />Buyer
                </span>
                <span className="text-xs text-foreground font-medium truncate">{dispute.buyerEmail || dispute.buyerId}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                  <User size={10} />Seller
                </span>
                <span className="text-xs text-foreground font-medium truncate">{dispute.sellerEmail || dispute.sellerId}</span>
              </div>
            </div>
          </div>

          {/* Compose email */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-primary" />
              <p className="text-xs font-semibold text-foreground">Compose Communication</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</label>
              <div className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground select-none">
                {emailSubject}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Message <span className="font-normal">(sent to both parties)</span>
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Write your message to the buyer and seller here..."
                rows={4}
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>
            <button
              onClick={handleOpenMail}
              disabled={!emailBody.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Mail size={13} />
              Create Mail
            </button>
          </div>

          {/* Buyer refund bank details */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <Banknote size={12} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buyer Refund Account</span>
            </div>
            <div className="divide-y divide-border/60 px-4">
              {[
                { icon: Building2, label: 'Bank',    value: dispute.buyerBankName },
                { icon: User,      label: 'Name',    value: dispute.buyerAccountName },
                { icon: Hash,      label: 'Account', value: dispute.buyerAccountNumber, mono: true },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-center justify-between py-2.5 gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                    <Icon size={10} />{label}
                  </span>
                  <span className={`text-xs text-foreground text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attachments */}
          {dispute.attachments?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Evidence ({dispute.attachments.length})
              </p>
              <div className="grid gap-1.5">
                {dispute.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2 hover:bg-muted transition-colors"
                  >
                    {att.type === 'image'
                      ? <FileImage size={14} className="text-primary shrink-0" />
                      : <FileVideo size={14} className="text-primary shrink-0" />}
                    <span className="flex-1 text-xs text-foreground truncate">
                      {att.type === 'image' ? 'Image' : 'Video'} {i + 1}
                    </span>
                    <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Status change ─────────────────────────────────────────────── */}
          {!isAlreadyRefunded ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Update Status
              </p>

              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.filter((o) => o.value !== dispute.status).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setNewStatus(opt.value); setError(null); setShowRefundConfirm(false); setShowCloseConfirm(false) }}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                      newStatus === opt.value
                        ? `border-current bg-current/10 ${opt.cls}`
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {opt.value === 'refunded' && <Banknote size={12} />}
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Close confirmation warning */}
              {showCloseConfirm && (
                <div className="space-y-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <div className="flex items-start gap-2.5">
                    <Info size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Confirm Close</p>
                      <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                        By closing this dispute the seller has won and can now withdraw the funds. Is that the intended action?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowCloseConfirm(false); setNewStatus(dispute.status) }}
                      className="flex-1 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      {loading ? 'Processing…' : 'Yes, Close Dispute'}
                    </button>
                  </div>
                </div>
              )}

              {/* Refund confirmation warning */}
              {showRefundConfirm && (
                <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-destructive">Confirm Refund</p>
                      <p className="text-xs text-destructive/80 mt-1">
                        This action will immediately transfer <strong>{fmt(dispute.grandPrice)}</strong> to the buyer's account
                        via Paystack. This cannot be undone. Only confirm if you have verified the dispute is valid.
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        <p>Bank: <strong className="text-foreground">{dispute.buyerBankName}</strong></p>
                        <p>Account: <strong className="text-foreground font-mono">{dispute.buyerAccountNumber}</strong> – {dispute.buyerAccountName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowRefundConfirm(false); setNewStatus(dispute.status) }}
                      className="flex-1 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />}
                      {loading ? 'Processing…' : 'Yes, Refund Now'}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle size={12} />{error}
                </p>
              )}

              {hasChanged && !showRefundConfirm && !showCloseConfirm && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Updating…' : `Set Status: ${STATUS_OPTIONS.find((o) => o.value === newStatus)?.label}`}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={15} />
              <p className="text-xs font-semibold">This dispute has been resolved and the buyer has been refunded.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

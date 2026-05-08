'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, ChevronLeft, CheckCircle, Clock, XCircle, ShieldAlert, Star } from 'lucide-react'
import { BuyerNav } from '@/components/nav/buyer-nav'

interface TransactionDetail {
  refId: string
  type: string
  sellerId: string
  buyerId: string
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  items: Array<{ productName: string; quantity: number; price: number }>
  itemsTotal: number
  shippingFee: number
  platformFee: number
  grandPrice: number
  status: 'pending' | 'paid' | 'failed' | 'disputing' | string
  valueReceived: boolean
  confirmedValue: boolean
  createdAt: any
  updatedAt: any
}

// ── Star rating picker ────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={`transition-colors ${
              (hovered || value) >= star ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// ── Review dialog ─────────────────────────────────────────────────────────────
function ReviewDialog({
  transaction,
  onClose,
  onSubmitted,
}: {
  transaction: TransactionDetail
  onClose: () => void
  onSubmitted: () => void
}) {
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a star rating.'); return }
    try {
      setSubmitting(true)
      setError('')
      const user = auth.currentUser
      if (!user) { setError('You must be signed in.'); return }
      const token = await user.getIdToken()
      const res = await fetch('/api/catalogue/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          txnRefId: transaction.refId,
          sellerId: transaction.sellerId,
          rating,
          topic: topic.trim(),
          description: description.trim(),
          productNames: transaction.items.map((i) => i.productName),
        }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to submit review')
      onSubmitted()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground">Review this seller and the item</h2>
            <p className="text-[10px] font-mono text-muted-foreground">{transaction.refId}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors text-lg">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Star Rating <span className="text-destructive">*</span>
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Review Topic <span className="text-muted-foreground/60 font-normal">(optional)</span>
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Great seller, Fast delivery..."
              maxLength={120}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description <span className="text-muted-foreground/60 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell others about your experience..."
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex gap-3 border-t border-border px-5 py-4 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={rating === 0 || submitting}>
            {submitting ? <><Loader2 size={14} className="animate-spin" />Submitting…</> : <><Star size={14} />Submit Review</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TransactionDetailClient() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [transaction, setTransaction] = useState<TransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [confirmingValue, setConfirmingValue] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true)
      else router.push('/auth/login')
    })
    return () => unsub()
  }, [router])

  useEffect(() => {
    if (!isAuthenticated) return
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const res = await fetch(`/api/transactions?type=purchase&refId=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await res.json()
        if (!result.success) { setError(result.error || 'Failed to load transaction'); return }
        setTransaction(result.data)
      } catch (err: any) {
        setError(err.message || 'Failed to load transaction')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isAuthenticated])

  const handleConfirmValueReceived = async () => {
    if (!transaction) return
    try {
      setConfirmingValue(true)
      setConfirmError('')
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/transactions/value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refId: transaction.refId }),
      })
      const result = await res.json()
      if (result.success) {
        setTransaction((prev) => prev ? { ...prev, valueReceived: true, confirmedValue: true } : null)
      } else {
        setConfirmError(result.error || 'Failed to confirm value received')
      }
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm value received')
    } finally {
      setConfirmingValue(false)
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—'
    const seconds = timestamp._seconds ?? timestamp.seconds
    const date = seconds ? new Date(seconds * 1000) : new Date(timestamp)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { icon: React.ReactNode; classes: string; label: string }> = {
      paid:      { icon: <CheckCircle className="w-3.5 h-3.5" />, classes: 'bg-green-100 text-green-700 border-green-200',  label: 'Paid' },
      pending:   { icon: <Clock className="w-3.5 h-3.5" />,       classes: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
      failed:    { icon: <XCircle className="w-3.5 h-3.5" />,     classes: 'bg-red-100 text-red-700 border-red-200',         label: 'Failed' },
      disputing: { icon: <ShieldAlert className="w-3.5 h-3.5" />, classes: 'bg-amber-100 text-amber-700 border-amber-200',   label: 'Disputing' },
    }
    const s = map[status] || map.pending
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.classes}`}>
        {s.icon}{s.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <BuyerNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading transaction...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background">
        <BuyerNav />
        <div className="max-w-2xl mx-auto p-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-6 -ml-2">
            <ChevronLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <Card className="p-8 text-center space-y-4">
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-destructive font-medium">{error || 'Transaction not found'}</p>
            <Button variant="outline" onClick={() => router.push('/transactions')}>View All Transactions</Button>
          </Card>
        </div>
      </div>
    )
  }

  const isDisputing = transaction.status === 'disputing'
  const hasConfirmedValue = transaction.valueReceived || transaction.confirmedValue
  const canConfirm = transaction.status === 'paid' && !hasConfirmedValue && !isDisputing

  return (
    <div className="min-h-screen bg-background">
      <BuyerNav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Back + Header */}
        <div>
          <Button variant="ghost" onClick={() => router.back()} className="-ml-2 mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Transaction Details</h1>
            <StatusBadge status={transaction.status} />
          </div>
          <p className="font-mono text-sm text-muted-foreground mt-1">{transaction.refId}</p>
        </div>

        {/* Items */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Items Ordered</h2>
          <div className="space-y-3">
            {transaction.items.map((item, i) => (
              <div key={i} className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold">₦{(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Pricing Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Items Total</span><span>₦{transaction.itemsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping Fee</span><span>₦{transaction.shippingFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Fee (5%)</span><span>₦{transaction.platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-border pt-3 mt-1">
              <span>Grand Total</span>
              <span className="text-primary">₦{transaction.grandPrice.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Value Confirmation Card */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-1">Value Confirmation</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Confirm only after you have received your items and are satisfied. This releases payment to the seller.
          </p>

          {isDisputing ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                This transaction is currently under dispute — confirmation is disabled.
              </span>
            </div>
          ) : hasConfirmedValue ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-green-700 text-sm font-medium">Value confirmed — seller will be paid</span>
              </div>
              {/* Review prompt */}
              {!reviewed ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowReview(true)}>
                  <Star className="w-4 h-4" />
                  Leave a Review
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Review submitted — thank you!
                </div>
              )}
            </div>
          ) : (
            <>
              {confirmError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3">
                  <p className="text-destructive text-xs">{confirmError}</p>
                </div>
              )}
              <Button
                onClick={handleConfirmValueReceived}
                disabled={!canConfirm || confirmingValue}
                className="w-full"
                size="lg"
              >
                {confirmingValue ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirming...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Confirm Value Received</>
                )}
              </Button>
              {!canConfirm && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {transaction.status !== 'paid' ? 'Available once payment is completed' : 'Already confirmed'}
                </p>
              )}
            </>
          )}
        </Card>

        {/* Transaction Info */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Transaction Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Created</p>
              <p className="font-medium">{formatDate(transaction.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Last Updated</p>
              <p className="font-medium">{formatDate(transaction.updatedAt)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Reference ID</p>
              <p className="font-mono text-xs break-all">{transaction.refId}</p>
            </div>
          </div>
        </Card>

      </div>

      {showReview && (
        <ReviewDialog
          transaction={transaction}
          onClose={() => setShowReview(false)}
          onSubmitted={() => { setShowReview(false); setReviewed(true) }}
        />
      )}
    </div>
  )
}

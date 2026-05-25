'use client'
// components/review-dialog.tsx
// Shared ReviewDialog used by both app/transactions/client.tsx
// and app/transactions/[id]/client.tsx

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Loader2, Star } from 'lucide-react'

// Minimal shape needed — both Transaction and TransactionDetail satisfy this
export interface ReviewTarget {
  refId: string
  sellerId: string
  items: Array<{ productName: string }>
}

interface ReviewDialogProps {
  transaction: ReviewTarget
  onClose: () => void
  onSubmitted: () => void
}

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
              (hovered || value) >= star
                ? 'text-amber-400 fill-amber-400'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export function ReviewDialog({ transaction, onClose, onSubmitted }: ReviewDialogProps) {
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
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors text-lg"
          >
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
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" />Submitting…</>
              : <><Star size={14} />Submit Review</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

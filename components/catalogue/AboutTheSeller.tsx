'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Store } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface Props {
  sellerId: string
}

interface CatalogueData {
  catalogueId: string
  username: string
  profilePhoto: string | null
  averageReview: number
  reviewsCount: number
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  )
}

export function AboutTheSeller({ sellerId }: Props) {
  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) return
    fetch(`/api/catalogue?userId=${sellerId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data) setCatalogue(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sellerId])

  if (loading || !catalogue) return null

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Store size={15} className="text-primary" />
        <h3 className="text-sm font-bold">About the Seller</h3>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted shrink-0">
          {catalogue.profilePhoto ? (
            <img src={catalogue.profilePhoto} alt={catalogue.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
              {catalogue.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{catalogue.username}</p>
          {catalogue.reviewsCount > 0 ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <StarDisplay rating={catalogue.averageReview} />
              <span className="text-xs font-semibold">{catalogue.averageReview.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({catalogue.reviewsCount})</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">No reviews yet</p>
          )}
        </div>
      </div>

      <Link
        href={`/seller/${catalogue.catalogueId}`}
        className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
      >
        <Store size={12} />
        View Seller Catalogue
      </Link>
    </Card>
  )
}

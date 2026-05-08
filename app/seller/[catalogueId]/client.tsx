'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Star, ChevronLeft, ShoppingBag } from 'lucide-react'

interface CatalogueData {
  catalogueId: string
  userId: string
  username: string
  bio: string
  profilePhoto: string | null
  coverPhoto: string | null
  reviewsCount: number
  averageReview: number
}

interface Product {
  productId: string
  title: string
  price: number
  image: string | null
  category: string
}

interface Review {
  id: string
  buyerUsername: string
  rating: number
  topic: string
  description: string
  products: string[]
  createdAt: any
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  )
}

export function SellerCatalogueClient() {
  const { catalogueId } = useParams() as { catalogueId: string }
  const router = useRouter()

  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!catalogueId) return
    ;(async () => {
      try {
        setLoading(true)
        const [catRes, revRes] = await Promise.all([
          fetch(`/api/catalogue?catalogueId=${catalogueId}`),
          fetch(`/api/catalogue/reviews?catalogueId=${catalogueId}`),
        ])
        const catData = await catRes.json()
        const revData = await revRes.json()

        if (!catData.success || !catData.data) { setNotFound(true); return }

        setCatalogue(catData.data)
        if (revData.success) setReviews(revData.data)

        // Fetch products using the seller's userId
        const prodRes = await fetch(`/api/catalogue/products?userId=${catData.data.userId}`)
        const prodData = await prodRes.json()
        if (prodData.success) setProducts(prodData.data)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [catalogueId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (notFound || !catalogue) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <ShoppingBag size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold">Catalogue not found</p>
        <Button variant="outline" onClick={() => router.push('/')}>Go Home</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.back()}>
          <ChevronLeft size={16} className="mr-1" />Back
        </Button>
      </div>

      {/* Hero */}
      <div className="relative h-44 bg-muted">
        {catalogue.coverPhoto ? (
          <img src={catalogue.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4">
        {/* Profile section */}
        <div className="flex items-end gap-4 -mt-12 mb-4">
          <div className="w-24 h-24 rounded-full border-4 border-background overflow-hidden bg-muted shrink-0">
            {catalogue.profilePhoto ? (
              <img src={catalogue.profilePhoto} alt={catalogue.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                {catalogue.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-xl font-bold">{catalogue.username}</h1>
            {catalogue.reviewsCount > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <StarDisplay rating={catalogue.averageReview} />
                <span className="text-sm font-semibold">{catalogue.averageReview.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({catalogue.reviewsCount} reviews)</span>
              </div>
            )}
          </div>
        </div>

        {catalogue.bio && (
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{catalogue.bio}</p>
        )}

        {/* Products */}
        <h2 className="text-base font-bold mb-3">Products</h2>
        {products.length === 0 ? (
          <Card className="p-8 text-center mb-8">
            <ShoppingBag className="mx-auto mb-2 text-muted-foreground" size={32} />
            <p className="text-muted-foreground text-sm">No active products listed yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {products.map((p) => (
              <Link key={p.productId} href={`/product/${p.productId}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="aspect-square bg-muted">
                    {p.image ? (
                      <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium leading-tight line-clamp-2">{p.title}</p>
                    <p className="text-sm font-bold text-primary mt-1">₦{p.price.toLocaleString()}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <>
            <h2 className="text-base font-bold mb-3">Customer Reviews</h2>
            <div className="space-y-4 mb-10">
              {reviews.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold">{r.buyerUsername}</p>
                      {r.topic && <p className="text-sm text-foreground">{r.topic}</p>}
                    </div>
                    <StarDisplay rating={r.rating} size={13} />
                  </div>
                  {r.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-2">{r.description}</p>
                  )}
                  {r.products?.length > 0 && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                      Purchased: {r.products.join(', ')}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

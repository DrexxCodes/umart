'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Tag, ArrowRight, Flame } from 'lucide-react'

interface ListingProduct {
  id: string
  title: string
  image: string | null
  price: number
  location: string
  condition: string
  category: string
}

interface CacheEntry {
  data: ListingProduct[]
  fetchedAt: number
}

const CACHE_KEY = 'umart_listing_cache'
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

function sessionShuffle<T>(arr: T[]): T[] {
  let seed = parseInt(sessionStorage.getItem('umart_shuffle_seed') || '0')
  if (!seed) {
    seed = Math.floor(Math.random() * 1_000_000)
    sessionStorage.setItem('umart_shuffle_seed', String(seed))
  }
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function readCache(): { data: ListingProduct[]; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    const age = Date.now() - entry.fetchedAt
    if (age > CACHE_TTL_MS * 2) {
      // Fully expired (> 4 min) — treat as nothing
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return { data: entry.data, stale: age > CACHE_TTL_MS }
  } catch { return null }
}

function writeCache(data: ListingProduct[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch { /* storage full — skip */ }
}

// Condition badge: semantic colours that work on both themes
const CONDITION_BADGE: Record<string, string> = {
  'New':      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
  'Like New': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30',
  'Good':     'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
  'Fair':     'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30',
  'Damaged':  'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30',
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded-full bg-muted" />
        <div className="h-3 w-1/2 rounded-full bg-muted" />
        <div className="h-4 w-2/5 rounded-full bg-muted mt-3" />
      </div>
    </div>
  )
}

export function ProductList() {
  const [products, setProducts] = useState<ListingProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const cached = readCache()

    if (cached) {
      // Serve cached data immediately — user sees products right away
      setProducts(sessionShuffle(cached.data))
      setLoading(false)

      if (cached.stale) {
        // Cache is between 2–4 min old: revalidate in the background
        // without showing a loading state (burst revalidation)
        fetch('/api/products/listings')
          .then((r) => r.json())
          .then((result) => {
            if (result.success && Array.isArray(result.data)) {
              writeCache(result.data)
              setProducts(sessionShuffle(result.data))
            }
          })
          .catch(() => { /* silently keep stale data */ })
      }
      return
    }

    // No cache at all — full fetch with loading state
    fetch('/api/products/listings')
      .then((r) => r.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          writeCache(result.data)
          setProducts(sessionShuffle(result.data))
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">Fresh Listings</h2>
        </div>
        <Link
          href="/categories"
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          Browse all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {error ? (
        <p className="text-center py-16 text-muted-foreground text-sm">
          Could not load listings right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((product, i) => {
                const condClass =
                  CONDITION_BADGE[product.condition] ??
                  'bg-muted text-muted-foreground border border-border'

                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="group block fade-up"
                    style={{ animationDelay: `${i * 28}ms` }}
                  >
                    <article className="rounded-xl overflow-hidden bg-card border border-border product-card-hover h-full flex flex-col">
                      {/* Image */}
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.title}
                            fill
                            className="object-cover card-img-zoom"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tag className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* Condition badge */}
                        <span
                          className={`absolute top-2 left-2 text-[0.6rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur-sm ${condClass}`}
                        >
                          {product.condition}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="p-3 flex flex-col gap-1 flex-1">
                        <p className="text-[0.8rem] font-semibold text-card-foreground line-clamp-2 leading-snug">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{product.location}</span>
                        </div>
                        <p className="mt-auto pt-2 text-[0.9rem] font-extrabold text-primary tracking-tight">
                          ₦{product.price.toLocaleString()}
                        </p>
                      </div>
                    </article>
                  </Link>
                )
              })}
        </div>
      )}
    </section>
  )
}
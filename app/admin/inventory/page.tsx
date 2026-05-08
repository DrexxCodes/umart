'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, SearchX, AlertCircle, BoxSelect } from 'lucide-react'
import InventorySearchBar from './components/InventorySearchBar'
import ProductDetail, { ProductData } from './components/ProductDetail'

type SearchState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

export default function AdminInventoryPage() {
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const [product,     setProduct]     = useState<ProductData | null>(null)
  const [totalCount,  setTotalCount]  = useState<number | null>(null)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [lastQuery,   setLastQuery]   = useState('')

  // Fetch total count on mount (1 read)
  useEffect(() => {
    fetch('/api/admin/inventory?count=true')
      .then((r) => r.json())
      .then((j) => { if (j.success) setTotalCount(j.count) })
      .catch(() => {})
  }, [])

  const handleSearch = useCallback(async (productId: string) => {
    setSearchState('loading')
    setProduct(null)
    setErrorMsg('')
    setLastQuery(productId)

    try {
      const res  = await fetch(`/api/admin/inventory?productId=${encodeURIComponent(productId)}`)
      const json = await res.json()

      if (res.status === 404) { setSearchState('not_found'); return }
      if (!res.ok) { setSearchState('error'); setErrorMsg(json.error ?? `HTTP ${res.status}`); return }

      setProduct(json.data as ProductData)
      setSearchState('found')
    } catch (e: any) {
      setSearchState('error')
      setErrorMsg(e?.message ?? 'Network error')
    }
  }, [])

  const handleUpdated = useCallback((patch: Partial<ProductData>) => {
    setProduct((prev) => prev ? { ...prev, ...patch } : prev)
  }, [])

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page header ── */}
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package size={18} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground">Inventory</h1>
                <p className="text-xs text-muted-foreground">Look up and moderate product listings</p>
              </div>
            </div>

            {/* Total count pill */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 self-start sm:self-auto">
              <BoxSelect size={14} className="text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Products</p>
                <p className="font-mono text-sm font-bold text-foreground tabular-nums">
                  {totalCount !== null ? totalCount.toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Search */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Search by Product ID
          </p>
          <InventorySearchBar
            onSearch={handleSearch}
            loading={searchState === 'loading'}
          />
          <p className="mt-2 pl-1 text-[10px] text-muted-foreground">
            Product IDs follow the format{' '}
            <span className="font-mono text-muted-foreground/80">prod_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>
          </p>
        </div>

        {/* Not found */}
        {searchState === 'not_found' && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16">
            <SearchX size={40} strokeWidth={1.2} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">No product found</p>
            <p className="font-mono text-xs text-muted-foreground">{lastQuery}</p>
            <p className="text-xs text-muted-foreground">Double-check the ID and try again</p>
          </div>
        )}

        {/* Error */}
        {searchState === 'error' && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertCircle size={15} className="shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{errorMsg}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {searchState === 'loading' && (
          <div className="space-y-3">
            <div className="h-8 w-40 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" style={{ animationDelay: '60ms' }} />
            <div className="h-32 animate-pulse rounded-xl bg-muted" style={{ animationDelay: '120ms' }} />
            <div className="h-24 animate-pulse rounded-xl bg-muted" style={{ animationDelay: '180ms' }} />
          </div>
        )}

        {/* Product */}
        {searchState === 'found' && product && (
          <ProductDetail product={product} onUpdated={handleUpdated} />
        )}

        {/* Idle state */}
        {searchState === 'idle' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Package size={48} strokeWidth={1.2} />
            <p className="text-sm font-medium">Enter a product ID to get started</p>
            <p className="text-xs">You can find product IDs in the seller's product list</p>
          </div>
        )}
      </div>
    </div>
  )
}
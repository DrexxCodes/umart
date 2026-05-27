'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { SearchBar } from '@/components/categories/SearchBar'
import { Filter, FilterValues } from '@/components/categories/Filter'
import { ProductCards } from '@/components/home/ProductCards'
import { Card } from '@/components/ui/card'
import { Loader2, Layers, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  title: string
  brand: string
  model?: string
  images: string[]
  location: string
  price: number
  condition: string
}

interface SubCategory {
  id: string
  name: string
  displayName: string
}

interface FilterOptions {
  priceRange: { min: number; max: number }
  colors: string[]
  sizes: string[]
  genders: string[]
  repairCounts: number[]
}

export default function CategoriesBrowseClient({ categoryId }: { categoryId: string }) {
  const router           = useRouter()
  const searchParams     = useSearchParams()
  const categoryName     = searchParams.get('name') || 'Category'

  const [products, setProducts]             = useState<Product[]>([])
  const [isLoading, setIsLoading]           = useState(true)
  const [hasSearched, setHasSearched]       = useState(false)
  const [filterOptions, setFilterOptions]   = useState<FilterOptions | undefined>()
  const [query, setQuery]                   = useState('')
  const [filters, setFilters]               = useState<FilterValues>({
    minPrice:    0,
    maxPrice:    1_000_000,
    location:    '',
    color:       '',
    age:         null,
    size:        '',
    gender:      '',
    repairCount: null,
  })

  // Sub-category state
  const [subCategories, setSubCategories]   = useState<SubCategory[]>([])
  const [loadingSubs, setLoadingSubs]       = useState(true)
  const [activeSubId, setActiveSubId]       = useState<string>('')

  // ── On mount: load subs + initial 10 products ────────────────────────────
  useEffect(() => {
    loadSubCategories()
    loadInitialProducts('')
  }, [categoryId])

  async function loadSubCategories() {
    setLoadingSubs(true)
    try {
      const res    = await fetch(`/api/creator/products/categories/${categoryId}/sub`)
      const result = await res.json()
      if (result.success) setSubCategories(result.data ?? [])
    } catch (err) {
      console.error('Error loading subcategories:', err)
    } finally {
      setLoadingSubs(false)
    }
  }

  async function loadInitialProducts(subId: string) {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '10')
      if (subId) params.set('sub', subId)

      const res    = await fetch(`/api/products/categories/${categoryId}?${params}`)
      const result = await res.json()

      if (result.success) {
        setProducts(result.data ?? [])
        if (result.filterOptions) {
          setFilterOptions(result.filterOptions)
          setFilters((prev) => ({
            ...prev,
            minPrice: result.filterOptions.priceRange.min,
            maxPrice: result.filterOptions.priceRange.max,
          }))
        }
      }
    } catch (err) {
      console.error('Error loading initial products:', err)
    } finally {
      setIsLoading(false)
      setHasSearched(true)
    }
  }

  // ── Sub-category filter pill click ────────────────────────────────────────
  function handleSubClick(subId: string) {
    const next = subId === activeSubId ? '' : subId
    setActiveSubId(next)
    setQuery('')
    loadInitialProducts(next)
  }

  // ── Navigate to dedicated sub page ───────────────────────────────────────
  function handleSubNavigate(sub: SubCategory) {
    router.push(
      `/categories/${categoryId}/${sub.id}?name=${encodeURIComponent(sub.displayName)}&cat=${encodeURIComponent(categoryName)}`,
    )
  }

  const handleSearch = async (q: string) => {
    setQuery(q)
    await performSearch(q, filters, activeSubId)
  }

  const handleFilterChange = async (newFilters: FilterValues) => {
    setFilters(newFilters)
    await performSearch(query, newFilters, activeSubId)
  }

  async function performSearch(q: string, f: FilterValues, subId: string) {
    setIsLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      params.set('category', categoryId)
      if (subId)              params.set('sub',        subId)
      if (q)                  params.set('q',          q)
      if (f.minPrice > 0)     params.set('minPrice',   f.minPrice.toString())
      if (f.maxPrice < 1_000_000) params.set('maxPrice', f.maxPrice.toString())
      if (f.location)         params.set('location',   f.location)
      if (f.color)            params.set('color',      f.color)
      if (f.age)              params.set('maxAge',     f.age.toString())
      if (f.size)             params.set('size',       f.size)
      if (f.gender)           params.set('gender',     f.gender)
      if (f.repairCount !== null) params.set('repairCount', f.repairCount.toString())

      const res    = await fetch(`/api/products/categories/${categoryId}?${params}`)
      const result = await res.json()
      if (result.success) setProducts(result.data ?? [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <BuyerNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/categories" className="hover:text-foreground transition-colors">
            Categories
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">{categoryName}</span>
        </nav>

        {/* Header */}
        <div className="mb-6 space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground">{categoryName}</h1>
          <p className="text-lg text-muted-foreground">Browse and search products in this category</p>
        </div>

        {/* ── Subcategory filter pills ───────────────────────────────────── */}
        {!loadingSubs && subCategories.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2.5">
              <Layers size={13} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Subcategories
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* "All" pill */}
              <button
                onClick={() => handleSubClick('')}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  activeSubId === ''
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                All
              </button>

              {subCategories.map((sub) => (
                <div key={sub.id} className="flex items-center">
                  <button
                    onClick={() => handleSubClick(sub.id)}
                    className={`rounded-l-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      activeSubId === sub.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {sub.displayName}
                  </button>
                  {/* Arrow to navigate to dedicated sub page */}
                  <button
                    onClick={() => handleSubNavigate(sub)}
                    title={`Browse all in ${sub.displayName}`}
                    className={`rounded-r-full border-y border-r px-2 py-1.5 text-xs transition-all ${
                      activeSubId === sub.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <ChevronRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            categoryId={categoryId}
            categoryName={
              activeSubId
                ? (subCategories.find((s) => s.id === activeSubId)?.displayName ?? categoryName)
                : categoryName
            }
            onSearch={handleSearch}
            isLoading={isLoading}
          />
        </div>

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Filter onFilterChange={handleFilterChange} filterOptions={filterOptions} />
          </aside>

          <main className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    {hasSearched ? 'Searching products…' : 'Loading products…'}
                  </p>
                </div>
              </div>
            ) : hasSearched && products.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center">
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your search filters or search terms.
                </p>
              </Card>
            ) : (
              <ProductCards products={products} isLoading={isLoading} hasSearched={hasSearched} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

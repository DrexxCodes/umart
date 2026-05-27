'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { SearchBar } from '@/components/categories/SearchBar'
import { Filter, FilterValues } from '@/components/categories/Filter'
import { ProductCards } from '@/components/home/ProductCards'
import { Card } from '@/components/ui/card'
import { Loader2, ChevronRight } from 'lucide-react'
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

interface FilterOptions {
  priceRange: { min: number; max: number }
  colors: string[]
  sizes: string[]
  genders: string[]
  repairCounts: number[]
}

export default function SubCategoryBrowseClient({
  categoryId,
  subId,
}: {
  categoryId: string
  subId: string
}) {
  const searchParams  = useSearchParams()
  const categoryName  = searchParams.get('cat')  || 'Category'
  const subName       = searchParams.get('name') || 'Sub-category'

  const [products, setProducts]           = useState<Product[]>([])
  const [isLoading, setIsLoading]         = useState(true)
  const [hasSearched, setHasSearched]     = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | undefined>()
  const [query, setQuery]                 = useState('')
  const [filters, setFilters]             = useState<FilterValues>({
    minPrice: 0,
    maxPrice: 1_000_000,
    location: '',
    color: '',
    age: null,
    size: '',
    gender: '',
    repairCount: null,
  })

  // ── Load 10 products on mount ─────────────────────────────────────────────
  useEffect(() => {
    loadInitialProducts()
  }, [categoryId, subId])

  async function loadInitialProducts() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('sub',   subId)
      params.set('limit', '10')

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
      console.error('Error loading sub-category products:', err)
    } finally {
      setIsLoading(false)
      setHasSearched(true)
    }
  }

  const handleSearch = async (q: string) => {
    setQuery(q)
    await performSearch(q, filters)
  }

  const handleFilterChange = async (newFilters: FilterValues) => {
    setFilters(newFilters)
    await performSearch(query, newFilters)
  }

  async function performSearch(q: string, f: FilterValues) {
    setIsLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      params.set('sub', subId)
      if (q)                    params.set('q',        q)
      if (f.minPrice > 0)       params.set('minPrice', f.minPrice.toString())
      if (f.maxPrice < 1_000_000) params.set('maxPrice', f.maxPrice.toString())
      if (f.location)           params.set('location', f.location)
      if (f.color)              params.set('color',    f.color)
      if (f.age)                params.set('maxAge',   f.age.toString())
      if (f.size)               params.set('size',     f.size)
      if (f.gender)             params.set('gender',   f.gender)
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
          <Link
            href={`/categories/${categoryId}?name=${encodeURIComponent(categoryName)}`}
            className="hover:text-foreground transition-colors"
          >
            {categoryName}
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">{subName}</span>
        </nav>

        {/* Header */}
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground">{subName}</h1>
          <p className="text-lg text-muted-foreground">Browse products in this subcategory</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            categoryId={categoryId}
            categoryName={subName}
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
                  <p className="text-muted-foreground">Loading products…</p>
                </div>
              </div>
            ) : hasSearched && products.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center">
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your search or filters.
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

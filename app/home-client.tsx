'use client'

import { useState } from 'react'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { SearchBar, SearchFilters } from '@/components/home/SearchBar'
import { ProductCards } from '@/components/home/ProductCards'
import { ProductList } from '@/components/home/ProductList'

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

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (filters: SearchFilters) => {
    setIsLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      if (filters.query) params.append('q', filters.query)
      if (filters.minPrice > 0) params.append('minPrice', filters.minPrice.toString())
      if (filters.maxPrice !== Infinity) params.append('maxPrice', filters.maxPrice.toString())
      if (filters.location) params.append('location', filters.location)
      if (filters.maxAge) params.append('maxAge', filters.maxAge.toString())

      const response = await fetch(`/api/products?${params}`)
      const result = await response.json()
      if (result.success) setProducts(result.data)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BuyerNav />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Hero */}
        <section className="relative py-14 sm:py-20 text-center overflow-hidden">
          <div className="hero-glow" aria-hidden="true" />

          <div className="relative z-10 flex flex-col items-center gap-4">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none">
              U<span className="text-primary relative title-accent-line">Mart</span>
            </h1>
            {/* <p className="text-muted-foreground text-base sm:text-lg max-w-sm">
              Quality items · Verified sellers · Great prices
            </p> */}
            <div className="w-full max-w-2xl mt-2">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>
          </div>
        </section>

        {/* Content */}
        <section>
          {hasSearched ? (
            <ProductCards products={products} isLoading={isLoading} hasSearched={hasSearched} />
          ) : (
            <ProductList />
          )}
        </section>
      </main>
    </div>
  )
}
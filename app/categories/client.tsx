'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { Card } from '@/components/ui/card'
import { Loader2, ChevronRight } from 'lucide-react'

interface Category {
  id: string
  name: string
  description?: string
  icon?: string
  productCount?: number
}

export default function CategoriesClient() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true)
        setError(null)

        console.log('  Fetching categories from /api/creator/products/categories')
        const response = await fetch('/api/creator/products/categories')
        const result = await response.json()
        console.log('  Categories response:', result)

        if (result.success) {
          const categoriesData = result.data || []
          console.log('  Setting categories:', categoriesData)
          setCategories(categoriesData)
        } else {
          setError(result.error || 'Failed to fetch categories')
        }
      } catch (err) {
        console.error('  Error fetching categories:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    router.push(`/categories/${categoryId}?name=${encodeURIComponent(categoryName)}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <BuyerNav />
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading categories...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <BuyerNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Browse Categories
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our wide range of product categories
          </p>
        </div>

        {/* Error State */}
        {error && (
          <Card className="p-6 mb-8 border-destructive/50 bg-destructive/10">
            <p className="text-destructive font-medium">{error}</p>
          </Card>
        )}

        {/* Categories Grid */}
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id, category.name)}
                className="group cursor-pointer text-left"
              >
                <Card className="h-full p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-200">
                  {/* Category Icon/Placeholder */}
                  <div className="w-full aspect-square bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg mb-4 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                    <span className="text-4xl">📦</span>
                  </div>

                  {/* Category Name */}
                  <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {category.name}
                  </h3>

                  {/* Description */}
                  {category.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {category.description}
                    </p>
                  )}

                  {/* Product Count */}
                  {category.productCount !== undefined && (
                    <p className="text-xs text-muted-foreground mb-4">
                      {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
                    </p>
                  )}

                  {/* Arrow Icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">Browse</span>
                    <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">No categories available</h3>
            <p className="text-muted-foreground">
              Check back soon for available product categories
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

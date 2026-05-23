'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { Card } from '@/components/ui/card'
import { Loader2, ChevronRight, FolderOpen } from 'lucide-react'

interface Category {
  id: string
  name: string
  displayName?: string
  description?: string
  imageUrl?: string | null
  productCount?: number
}

export default function CategoriesClient() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true)
        setError(null)
        // ?count=true triggers Firestore aggregation count() per category
        const response = await fetch('/api/creator/products/categories?count=true')
        const result   = await response.json()
        if (result.success) {
          setCategories(result.data || [])
        } else {
          setError(result.error || 'Failed to fetch categories')
        }
      } catch (err) {
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
            <p className="text-muted-foreground text-sm">Loading categories...</p>
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
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Browse Categories</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Explore our wide range of product categories
          </p>
        </div>

        {error && (
          <Card className="p-6 mb-8 border-destructive/50 bg-destructive/10">
            <p className="text-destructive font-medium">{error}</p>
          </Card>
        )}

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {categories.map((category) => {
              const label = category.displayName || category.name
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id, label)}
                  className="group text-left"
                >
                  <Card className="h-full overflow-hidden hover:shadow-md hover:border-primary/40 transition-all duration-200">
                    {/* Image / Icon */}
                    <div className="w-full aspect-square overflow-hidden flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/15 group-hover:to-primary/8 transition-colors">
                      {category.imageUrl ? (
                        <img
                          src={category.imageUrl}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FolderOpen
                          className="w-10 h-10 text-primary/50 group-hover:text-primary/70 transition-colors"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-0.5">
                        {label}
                      </h3>

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {category.productCount !== undefined
                            ? `${category.productCount} ${category.productCount === 1 ? 'item' : 'items'}`
                            : ''}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </button>
              )
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="text-base font-semibold text-foreground mb-1">No categories yet</h3>
            <p className="text-sm text-muted-foreground">Check back soon.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

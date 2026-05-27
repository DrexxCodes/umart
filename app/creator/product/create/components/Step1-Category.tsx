'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { ChevronDown, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Step1Props {
  data: {
    category: string
    subCategory: string
    brand: string
    model: string
  }
  onChange: (data: any) => void
  onNext: () => void
}

interface CategoryItem {
  id: string
  name: string
  displayName: string
}

interface SubCategoryItem {
  id: string
  name: string
  displayName: string
}

const BRAND_WORDS = [
  'Samsung', 'Apple', 'Lenovo', 'HP', 'Dell',
  'Nike', 'Adidas', 'Oraimo', 'JBL', 'Sony',
  'LG', 'Infinix', 'Tecno', 'Realme', 'ASUS',
  'Acer', 'Microsoft', 'Xiaomi', 'Oppo', 'Vivo',
]

const MODEL_WORDS = [
  'Galaxy S25', 'iPhone 17 Pro', 'Air Max 90', 'EliteBook 840',
  'XPS 15', 'Pavilion 15', 'Infinix Note 40', 'Tecno Spark 20',
  'ThinkPad E14', 'ROG Gaming Laptop', 'Air Force 1', 'Ultraboost 22',
]

export function Step1Category({ data, onChange, onNext }: Step1Props) {
  const [categories, setCategories]           = useState<CategoryItem[]>([])
  const [subCategories, setSubCategories]     = useState<SubCategoryItem[]>([])
  const [loadingCats, setLoadingCats]         = useState(true)
  const [loadingSubs, setLoadingSubs]         = useState(false)
  const [currentBrand, setCurrentBrand]       = useState(0)
  const [currentModel, setCurrentModel]       = useState(0)

  // ── Fetch categories once ─────────────────────────────────────────────────
  useEffect(() => {
    fetchCategories()
  }, [])

  // ── Rotating placeholders ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentBrand((p) => (p + 1) % BRAND_WORDS.length), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setCurrentModel((p) => (p + 1) % MODEL_WORDS.length), 3500)
    return () => clearInterval(t)
  }, [])

  // ── Fetch subs when category changes ─────────────────────────────────────
  useEffect(() => {
    if (!data.category) {
      setSubCategories([])
      return
    }
    fetchSubCategories(data.category)
  }, [data.category])

  async function fetchCategories() {
    try {
      const res    = await fetch('/api/creator/products/categories')
      const result = await res.json()
      if (result.success) setCategories(result.data)
    } catch (err) {
      console.error('Error fetching categories:', err)
    } finally {
      setLoadingCats(false)
    }
  }

  async function fetchSubCategories(categoryId: string) {
    setLoadingSubs(true)
    setSubCategories([])
    // Clear any previously chosen sub when category switches
    onChange({ ...data, subCategory: '' })
    try {
      const res    = await fetch(`/api/creator/products/categories/${categoryId}/sub`)
      const result = await res.json()
      if (result.success) setSubCategories(result.data)
    } catch (err) {
      console.error('Error fetching subcategories:', err)
    } finally {
      setLoadingSubs(false)
    }
  }

  const canProceed = !!(data.category && data.brand.trim())

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Step 1: Product Details</CardTitle>
        <CardDescription>Select a category and enter your product information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── Category ───────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Product Category <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <select
              value={data.category}
              onChange={(e) => onChange({ ...data, category: e.target.value, subCategory: '' })}
              disabled={loadingCats}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            >
              <option value="">
                {loadingCats ? 'Loading categories…' : 'Select a category…'}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.displayName || cat.name || cat.id}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* ── Sub-category (appears once a category is chosen) ───────────── */}
        {data.category && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Subcategory</label>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>

            {loadingSubs ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading subcategories…
              </div>
            ) : subCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                No subcategories available for this category.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={data.subCategory}
                  onChange={(e) => onChange({ ...data, subCategory: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">None — general listing</option>
                  {subCategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.displayName || sub.name || sub.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>
        )}

        {/* ── Brand / Model (shown once category is chosen) ──────────────── */}
        {data.category && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Brand Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={data.brand}
                onChange={(e) => onChange({ ...data, brand: e.target.value })}
                placeholder={BRAND_WORDS[currentBrand]}
              />
              <p className="text-xs text-muted-foreground">
                e.g. {BRAND_WORDS.slice(0, 4).join(', ')}…
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Model Name</label>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              <Input
                type="text"
                value={data.model}
                onChange={(e) => onChange({ ...data, model: e.target.value })}
                placeholder={MODEL_WORDS[currentModel]}
              />
              <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80">
                  Adding a model name significantly improves how buyers discover your product through search.
                  E.g. "Galaxy S25 Ultra" instead of just "Samsung".
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <div className="flex justify-end p-6 border-t border-border">
        <Button onClick={onNext} disabled={!canProceed} className="w-full sm:w-auto">
          Next Step
        </Button>
      </div>
    </Card>
  )
}

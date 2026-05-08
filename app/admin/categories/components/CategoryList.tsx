'use client'

import { useState } from 'react'
import {
  ImageIcon, Tag, Hash, FileText, Calendar,
  Pencil, CheckCircle, XCircle, ChevronRight,
  PackageSearch,
} from 'lucide-react'
import CategoryForm, { CategoryFormData } from './CategoryForm'

export interface Category {
  id: string
  name: string
  displayName: string
  description?: string
  imageUrl?: string | null
  imagePublicId?: string | null
  productCount?: number
  isActive?: boolean
  createdAt?: any
  createdBy?: string
  updatedAt?: any
}

interface CategoryListProps {
  categories: Category[]
  loading: boolean
  token: string
  onUpdated: (updated: Category) => void
}

export default function CategoryList({
  categories,
  loading,
  token,
  onUpdated,
}: CategoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleUpdated(data: any) {
    onUpdated(data)
    setEditingId(null)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-border bg-muted/40"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    )
  }

  if (!categories.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <PackageSearch size={44} strokeWidth={1.2} />
        <p className="text-sm font-medium">No categories yet</p>
        <p className="text-xs">Create your first product category</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {categories.map((cat) => (
        <div
          key={cat.id}
          className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-sm"
        >
          {/* ── Row ── */}
          <div className="flex items-center gap-3 p-3.5">
            {/* Thumbnail */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={cat.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon size={20} strokeWidth={1.3} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-foreground">{cat.displayName}</p>
                {cat.isActive === false && (
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Hash size={10} />{cat.id}
              </p>
              {cat.description && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{cat.description}</p>
              )}
            </div>

            {/* Meta + edit */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <button
                onClick={() => setEditingId(editingId === cat.id ? null : cat.id)}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Pencil size={11} />
                Edit
              </button>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Tag size={9} />
                {cat.productCount ?? 0} products
              </span>
            </div>
          </div>

          {/* Missing fields notice */}
          <MissingFieldsNotice cat={cat} />

          {/* ── Edit panel ── */}
          {editingId === cat.id && (
            <div className="border-t border-border bg-muted/30 px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Edit Category
              </p>
              <CategoryForm
                initial={{
                  id:            cat.id,
                  displayName:   cat.displayName,
                  description:   cat.description ?? '',
                  imageUrl:      cat.imageUrl ?? '',
                  imagePublicId: cat.imagePublicId ?? '',
                }}
                token={token}
                onSuccess={handleUpdated}
                onCancel={() => setEditingId(null)}
                submitLabel="Save Changes"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Missing fields indicator ──────────────────────────────────────────────
function MissingFieldsNotice({ cat }: { cat: Category }) {
  const missing: string[] = []
  if (!cat.imageUrl)    missing.push('image')
  if (!cat.description) missing.push('description')

  if (!missing.length) return null

  return (
    <div className="flex items-center gap-1.5 border-t border-dashed border-amber-400/30 bg-amber-400/5 px-3.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
      <XCircle size={11} />
      Missing: {missing.join(', ')}
    </div>
  )
}
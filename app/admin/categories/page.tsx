'use client'

import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, FolderPlus, RefreshCw, Layers } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import CategoryList, { Category } from './components/CategoryList'
import CategoryForm from './components/CategoryForm'
import NewCategoryDialog from './components/NewCategoryDialog'

export default function AdminCategoriesPage() {
  const { user }                          = useAuth() as any
  const [token, setToken]                 = useState('')
  const [categories, setCategories]       = useState<Category[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [dialogOpen, setDialogOpen]       = useState(false)
  const [refreshKey, setRefreshKey]       = useState(0)

  // ── Fetch auth token ──────────────────────────────────────────────────
  useEffect(() => {
    if (user?.getIdToken) {
      user.getIdToken().then((t: string) => setToken(t)).catch(() => {})
    }
  }, [user])

  // ── Fetch categories ──────────────────────────────────────────────────
  useEffect(() => {
    async function fetchCategories() {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch('/api/creator/products/categories?count=true')
        const json = await res.json()
        if (json.success) {
          setCategories(
            [...json.data].sort((a, b) => (a.displayName ?? a.name ?? '').localeCompare(b.displayName ?? b.name ?? ''))
          )
        } else {
          setError(json.error ?? 'Failed to load categories')
        }
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [refreshKey])

  const handleCreated = useCallback((cat: Category) => {
    setCategories((prev) =>
      [...prev, cat].sort((a, b) => a.displayName.localeCompare(b.displayName))
    )
  }, [])

  const handleUpdated = useCallback((updated: Category) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    )
  }, [])

  const completeness = categories.length
    ? Math.round(
        (categories.filter((c) => c.imageUrl && c.description).length /
          categories.length) *
          100
      )
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers size={18} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground">Product Categories</h1>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Loading…' : `${categories.length} categories · ${completeness}% complete`}
                </p>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                title="Refresh"
              >
                <RefreshCw size={13} />
                Refresh
              </button>

              {/* Mobile only: New Category button */}
              <button
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 lg:hidden"
              >
                <FolderPlus size={14} />
                New Category
              </button>
            </div>
          </div>

          {/* Completeness bar */}
          {!loading && categories.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Category completeness</span>
                <span>{completeness}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Two-column on large, single column on small */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* ── Left: Category list ──────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <FolderOpen size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">All Categories</h2>
              {!loading && (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {categories.length}
                </span>
              )}
            </div>

            <CategoryList
              categories={categories}
              loading={loading}
              token={token}
              onUpdated={handleUpdated}
            />
          </div>

          {/* ── Right: Create panel — desktop only ─────────────────── */}
          <div className="hidden lg:block lg:w-96 shrink-0">
            <div className="sticky top-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FolderPlus size={15} />
                </span>
                <h2 className="text-sm font-semibold text-foreground">New Category</h2>
              </div>

              {token ? (
                <CategoryForm
                  token={token}
                  onSuccess={handleCreated}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Loading auth…</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: New category dialog ────────────────────────────────── */}
      <NewCategoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        token={token}
        onCreated={handleCreated}
      />
    </div>
  )
}
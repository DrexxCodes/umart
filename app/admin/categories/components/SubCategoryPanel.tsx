'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown, ChevronUp, Plus, Trash2, Pencil,
  Loader2, CheckCircle2, AlertCircle, Layers, XCircle,
} from 'lucide-react'

interface SubCategory {
  id: string
  name: string
  displayName: string
  description?: string | null
  isActive?: boolean
  productCount?: number
}

interface SubCategoryPanelProps {
  categoryId: string
  token: string
}

export default function SubCategoryPanel({ categoryId, token }: SubCategoryPanelProps) {
  const [open, setOpen]           = useState(false)
  const [subs, setSubs]           = useState<SubCategory[]>([])
  const [loading, setLoading]     = useState(false)
  const [fetched, setFetched]     = useState(false)

  // ── Create form state ────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newDisplay, setNewDisplay] = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  // ── Edit state ───────────────────────────────────────────────────────────
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editDisplay, setEditDisplay] = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

  // ── Delete state ─────────────────────────────────────────────────────────
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  // ── Fetch subs on first open ──────────────────────────────────────────────
  useEffect(() => {
    if (open && !fetched) loadSubs()
  }, [open])

  async function loadSubs() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/creator/products/categories/${categoryId}/sub?count=true`)
      const json = await res.json()
      if (json.success) setSubs(json.data ?? [])
    } catch {
      // silent — panel will just show empty
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newDisplay.trim()) { setCreateError('Display name is required.'); return }
    if (!newName.trim())    { setCreateError('Slug is required.'); return }

    setCreating(true)
    setCreateError(null)

    try {
      const res  = await fetch(`/api/creator/products/categories/${categoryId}/sub`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:        newName.trim().toLowerCase(),
          displayName: newDisplay.trim(),
          description: newDesc.trim() || null,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to create subcategory')

      setSubs((prev) =>
        [...prev, json.data].sort((a, b) => a.displayName.localeCompare(b.displayName))
      )
      setCreateSuccess(true)
      setNewName('')
      setNewDisplay('')
      setNewDesc('')
      setShowCreate(false)
      setTimeout(() => setCreateSuccess(false), 2500)
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(sub: SubCategory) {
    setEditingId(sub.id)
    setEditDisplay(sub.displayName)
    setEditDesc(sub.description ?? '')
    setSaveError(null)
  }

  async function handleSave(subId: string) {
    if (!editDisplay.trim()) { setSaveError('Display name cannot be empty.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const res  = await fetch(
        `/api/creator/products/categories/${categoryId}/sub?sub=${subId}`,
        {
          method:  'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${token}`,
          },
          body: JSON.stringify({
            displayName: editDisplay.trim(),
            description: editDesc.trim() || null,
          }),
        },
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Save failed')
      setSubs((prev) =>
        prev
          .map((s) => (s.id === subId ? { ...s, displayName: editDisplay.trim(), description: editDesc.trim() || null } : s))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
      )
      setEditingId(null)
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(sub: SubCategory) {
    if (!confirm(`Delete subcategory "${sub.displayName}"? This cannot be undone.`)) return
    setDeletingId(sub.id)
    setDeleteErrors((prev) => { const n = { ...prev }; delete n[sub.id]; return n })
    try {
      const res  = await fetch(
        `/api/creator/products/categories/${categoryId}/sub?sub=${sub.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Delete failed')
      setSubs((prev) => prev.filter((s) => s.id !== sub.id))
    } catch (err: any) {
      setDeleteErrors((prev) => ({ ...prev, [sub.id]: err.message }))
    } finally {
      setDeletingId(null)
    }
  }

  const totalSubs = subs.length

  return (
    <div className="border-t border-dashed border-border">
      {/* ── Toggle row ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
      >
        <Layers size={11} />
        <span className="font-medium">
          Subcategories
          {fetched && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
              {totalSubs}
            </span>
          )}
        </span>
        <span className="ml-auto">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {/* ── Expanded body ────────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Loading subcategories…
            </div>
          )}

          {/* Sub list */}
          {!loading && subs.length > 0 && (
            <div className="space-y-1.5">
              {subs.map((sub) => (
                <div
                  key={sub.id}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  {editingId === sub.id ? (
                    /* ── Edit form ── */
                    <div className="p-3 space-y-2">
                      <input
                        value={editDisplay}
                        onChange={(e) => setEditDisplay(e.target.value)}
                        placeholder="Display name"
                        className={inputCls}
                      />
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className={`${inputCls} resize-none`}
                      />
                      {saveError && (
                        <p className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertCircle size={11} /> {saveError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(sub.id)}
                          disabled={saving}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {saving && <Loader2 size={11} className="animate-spin" />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display row ── */
                    <div className="flex items-center gap-2.5 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{sub.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {sub.id} · {sub.productCount ?? 0} products
                        </p>
                        {sub.description && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(sub)}
                          className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => handleDelete(sub)}
                          disabled={deletingId === sub.id || (sub.productCount ?? 0) > 0}
                          title={
                            (sub.productCount ?? 0) > 0
                              ? `Cannot delete: ${sub.productCount} product(s) linked`
                              : 'Delete'
                          }
                          className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingId === sub.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Trash2 size={10} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {deleteErrors[sub.id] && (
                    <div className="flex items-center gap-1.5 border-t border-dashed border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive">
                      <XCircle size={10} /> {deleteErrors[sub.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && subs.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No subcategories yet.</p>
          )}

          {/* ── Create form toggle ─────────────────────────────────────── */}
          {createSuccess && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} /> Subcategory created!
            </div>
          )}

          {!showCreate ? (
            <button
              onClick={() => { setShowCreate(true); setCreateError(null) }}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/5 transition-colors w-full"
            >
              <Plus size={12} /> Add Subcategory
            </button>
          ) : (
            <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground mb-1">New Subcategory</p>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Display Name <span className="text-destructive">*</span>
                </label>
                <input
                  value={newDisplay}
                  onChange={(e) => { setNewDisplay(e.target.value); setCreateError(null) }}
                  placeholder="e.g. Smartphones"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Slug / ID <span className="text-destructive">*</span>
                  <span className="ml-1 font-normal">· lowercase, hyphens only</span>
                </label>
                <input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setCreateError(null)
                  }}
                  placeholder="e.g. smartphones"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Description (optional)</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Short description…"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {createError && (
                <p className="flex items-center gap-1 text-[11px] text-destructive">
                  <AlertCircle size={11} /> {createError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {creating && <Loader2 size={11} className="animate-spin" />}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(null) }}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/20 transition-all'

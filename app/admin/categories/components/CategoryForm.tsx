'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import ImageUploader from './ImageUploader'

export interface CategoryFormData {
  name: string
  displayName: string
  description: string
  imageUrl: string
  imagePublicId: string
}

export interface CategoryFormProps {
  /** When provided, the form is in edit mode and pre-fills with this data */
  initial?: Partial<CategoryFormData> & { id?: string }
  token: string
  onSuccess: (category: any) => void
  onCancel?: () => void
  /** Label for the submit button */
  submitLabel?: string
}

const EMPTY: CategoryFormData = {
  name: '',
  displayName: '',
  description: '',
  imageUrl: '',
  imagePublicId: '',
}

export default function CategoryForm({
  initial,
  token,
  onSuccess,
  onCancel,
  submitLabel,
}: CategoryFormProps) {
  const isEdit = Boolean(initial?.id)

  const [form, setForm]       = useState<CategoryFormData>({ ...EMPTY, ...initial })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Keep form in sync when `initial` changes (e.g. opening a different edit)
  useEffect(() => {
    setForm({ ...EMPTY, ...initial })
    setError(null)
    setSuccess(false)
  }, [initial?.id])

  function set(key: keyof CategoryFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.displayName.trim()) {
      setError('Display name is required.')
      return
    }
    if (!isEdit && !form.name.trim()) {
      setError('Slug/name is required when creating a category.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload: Record<string, any> = {
        displayName:   form.displayName.trim(),
        description:   form.description.trim(),
        imageUrl:      form.imageUrl      || null,
        imagePublicId: form.imagePublicId || null,
      }

      if (!isEdit) payload.name = form.name.trim()

      const url    = isEdit
        ? `/api/creator/products/categories/${initial!.id}`
        : '/api/creator/products/categories'

      const method = isEdit ? 'PATCH' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Request failed')

      setSuccess(true)
      if (!isEdit) setForm(EMPTY)
      onSuccess(json.data)
      setTimeout(() => setSuccess(false), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Display name */}
      <Field label="Display Name" required>
        <input
          type="text"
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="e.g. Electronics"
          className={inputCls}
        />
      </Field>

      {/* Slug — only for create */}
      {!isEdit && (
        <Field label="Slug / ID" required hint="Lowercase, hyphens only. Cannot be changed later.">
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="e.g. electronics"
            className={inputCls}
          />
        </Field>
      )}

      {/* Description */}
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Short description of this category…"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </Field>

      {/* Image */}
      <Field label="Category Image">
        <ImageUploader
          value={form.imageUrl}
          publicId={form.imagePublicId}
          onChange={(url, pid) => { set('imageUrl', url); set('imagePublicId', pid) }}
          onClear={() => { set('imageUrl', ''); set('imagePublicId', '') }}
          disabled={loading}
        />
      </Field>

      {/* Error */}
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {success && <CheckCircle2 size={15} />}
          {submitLabel ?? (isEdit ? 'Save Changes' : 'Create Category')}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all'

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
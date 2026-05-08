'use client'

import { useEffect } from 'react'
import { X, FolderPlus } from 'lucide-react'
import CategoryForm from './CategoryForm'

interface NewCategoryDialogProps {
  open: boolean
  onClose: () => void
  token: string
  onCreated: (cat: any) => void
}

export default function NewCategoryDialog({
  open,
  onClose,
  token,
  onCreated,
}: NewCategoryDialogProps) {
  // Lock scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else       document.body.style.overflow = ''
    return ()  => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function handleSuccess(cat: any) {
    onCreated(cat)
    onClose()
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderPlus size={16} />
            </span>
            <h2 className="font-semibold text-foreground">New Category</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
          <CategoryForm
            token={token}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
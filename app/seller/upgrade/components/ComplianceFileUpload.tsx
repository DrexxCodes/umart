'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, ImageIcon, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { uploadImageToCloudinary, UploadProgress } from '@/lib/cloudinary'

interface ComplianceFileUploadProps {
  label:       string
  accept?:     string          // e.g. 'image/*,.pdf'
  hint?:       string
  value?:      string          // current URL
  onChange:    (url: string, publicId: string) => void
  onClear:     () => void
  disabled?:   boolean
}

function isPdf(url: string) { return url?.toLowerCase().includes('.pdf') || url?.toLowerCase().includes('raw/upload') }

export function ComplianceFileUpload({
  label, accept = 'image/*,.pdf', hint, value, onChange, onClear, disabled = false,
}: ComplianceFileUploadProps) {
  const [dragging,  setDragging]  = useState(false)
  const [progress,  setProgress]  = useState<UploadProgress | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setError('Only JPG, PNG, WEBP or PDF files are accepted.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.')
      return
    }
    setError(null)
    setProgress({ loaded: 0, total: 1, percentage: 0 })
    try {
      const res = await uploadImageToCloudinary(file, (p) => setProgress(p))
      onChange(res.secure_url, res.public_id)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setProgress(null)
    }
  }, [onChange])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  const isUploading = progress !== null

  if (value) {
    return (
      <div className="relative flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          {isPdf(value) ? <FileText size={18} /> : <ImageIcon size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-emerald-700 dark:text-emerald-400">{label} uploaded</p>
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="truncate text-[10px] text-emerald-600/70 underline underline-offset-2 hover:text-emerald-600">
            View file
          </a>
        </div>
        <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
        {!disabled && (
          <button onClick={onClear}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors">
            <X size={10} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex h-28 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed transition-all ${
          disabled ? 'cursor-not-allowed opacity-50 border-border'
          : dragging ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Uploading… {progress!.percentage}%</p>
            <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress!.percentage}%` }} />
            </div>
          </div>
        ) : (
          <>
            <Upload size={18} className={dragging ? 'text-primary' : 'text-muted-foreground'} />
            <div className="text-center px-4">
              <p className="text-xs font-medium text-foreground">{label}</p>
              {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
          disabled={disabled || isUploading} className="sr-only" />
      </div>
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-destructive">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  )
}
'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { uploadImageToCloudinary, UploadProgress } from '@/lib/cloudinary'

interface ImageUploaderProps {
  value?: string        // current secure_url
  publicId?: string     // current public_id
  onChange: (url: string, publicId: string) => void
  onClear: () => void
  disabled?: boolean
}

export default function ImageUploader({
  value,
  publicId,
  onChange,
  onClear,
  disabled = false,
}: ImageUploaderProps) {
  const [dragging, setDragging]   = useState(false)
  const [progress, setProgress]   = useState<UploadProgress | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  const isUploading = progress !== null

  // ── Preview state ──────────────────────────────────────────────────────
  if (value) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <img
          src={value}
          alt="Category image"
          className="h-44 w-full object-cover"
        />
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex h-44 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed transition-all ${
          disabled
            ? 'cursor-not-allowed opacity-50 border-border'
            : dragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border bg-muted/40 hover:border-primary/60 hover:bg-primary/5'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Uploading… {progress!.percentage}%
            </p>
            <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progress!.percentage}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {dragging ? <Upload size={20} /> : <ImageIcon size={20} />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {dragging ? 'Drop to upload' : 'Click or drag image here'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPG, WEBP · Max 5 MB</p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="sr-only"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}
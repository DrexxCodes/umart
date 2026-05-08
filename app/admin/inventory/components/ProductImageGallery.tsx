'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'

interface ProductImageGalleryProps {
  images: string[]
  title:  string
}

export default function ProductImageGallery({ images, title }: ProductImageGalleryProps) {
  const [idx, setIdx] = useState(0)

  const valid = images.filter(Boolean)

  if (!valid.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <ImageOff size={32} strokeWidth={1.3} />
          <p className="text-xs">No images</p>
        </div>
      </div>
    )
  }

  const prev = () => setIdx((i) => (i - 1 + valid.length) % valid.length)
  const next = () => setIdx((i) => (i + 1) % valid.length)

  return (
    <div className="space-y-2">
      {/* Main image */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <img
          src={valid[idx]}
          alt={`${title} — image ${idx + 1}`}
          className="h-64 w-full object-cover transition-opacity duration-200"
        />

        {valid.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur-sm transition-colors hover:bg-background"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur-sm transition-colors hover:bg-background"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-mono backdrop-blur-sm text-foreground">
              {idx + 1} / {valid.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {valid.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {valid.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === idx ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
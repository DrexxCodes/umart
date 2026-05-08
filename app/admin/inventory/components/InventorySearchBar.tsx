'use client'

import { useState, useRef } from 'react'
import { Search, X, Loader2, Hash } from 'lucide-react'

interface InventorySearchBarProps {
  onSearch: (productId: string) => void
  loading?:  boolean
}

export default function InventorySearchBar({ onSearch, loading = false }: InventorySearchBarProps) {
  const [query, setQuery]   = useState('')
  const inputRef            = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  function handleClear() {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Hash
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter product ID — e.g. prod_xxxxxxxx-xxxx-xxxx"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-10 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={!query.trim() || loading}
        className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
'use client'

import { useState, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

export type SearchField = 'email' | 'phone' | 'fullname'

interface UserSearchBarProps {
  onSearch: (field: SearchField, value: string) => void
  loading?: boolean
}

const FIELD_OPTIONS: { value: SearchField; label: string; placeholder: string }[] = [
  { value: 'fullname', label: 'Name',  placeholder: 'Search by full name…'   },
  { value: 'email',   label: 'Email', placeholder: 'Search by email address…' },
  { value: 'phone',   label: 'Phone', placeholder: 'Search by phone number…'  },
]

export default function UserSearchBar({ onSearch, loading = false }: UserSearchBarProps) {
  const [field, setField]   = useState<SearchField>('fullname')
  const [query, setQuery]   = useState('')
  const inputRef            = useRef<HTMLInputElement>(null)

  const current = FIELD_OPTIONS.find((o) => o.value === field)!

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) onSearch(field, query.trim())
  }

  function handleClear() {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
    >
      {/* Field selector */}
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-border bg-card">
        {FIELD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setField(opt.value); inputRef.current?.focus() }}
            className={`px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              field === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="relative flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={current.placeholder}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!query.trim() || loading}
        className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        Search
      </button>
    </form>
  )
}
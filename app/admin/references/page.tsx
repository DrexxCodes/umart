'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import { Search, Hash, AlertCircle, Loader2, RotateCcw } from 'lucide-react'
import { ReferenceCard, ReferenceData } from './components/ReferenceCard'
import { DeleteDialog } from './components/DeleteDialog'

type SearchState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

export default function ReferencesPage() {
  const [query,       setQuery]       = useState('')
  const [state,       setState]       = useState<SearchState>('idle')
  const [reference,   setReference]   = useState<ReferenceData | null>(null)
  const [errorMsg,    setErrorMsg]    = useState<string>('')
  const [showDelete,  setShowDelete]  = useState(false)
  const [deleted,     setDeleted]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Search ─────────────────────────────────────────────────────────────────

  const doSearch = useCallback(async (refId: string) => {
    const id = refId.trim()
    if (!id) return
    setState('loading')
    setReference(null)
    setDeleted(false)
    setErrorMsg('')

    try {
      const res  = await fetch(`/api/admin/reference?refId=${encodeURIComponent(id)}`)
      const json = await res.json()

      if (res.status === 404) { setState('not_found'); return }
      if (!res.ok)            { setState('error'); setErrorMsg(json.error ?? `HTTP ${res.status}`); return }

      setReference(json.reference as ReferenceData)
      setState('found')
    } catch (e: any) {
      setState('error')
      setErrorMsg(e?.message ?? 'Network error')
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(query)
  }

  // ── Confirm value ──────────────────────────────────────────────────────────

  const handleConfirmValue = useCallback(async () => {
    if (!reference) return
    const res  = await fetch('/api/admin/reference', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refId: reference.refId ?? reference.id }),
    })
    if (!res.ok) throw new Error('Failed to confirm value')
    // Refresh the reference
    await doSearch(reference.refId ?? reference.id)
  }, [reference, doSearch])

  // ── Flag transaction ──────────────────────────────────────────────────────────

  const handleFlagTransaction = useCallback(async () => {
    if (!reference) return
    const res = await fetch('/api/admin/reference', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refId: reference.refId ?? reference.id }),
    })
    if (!res.ok) throw new Error('Failed to update flag')
    // Refresh to get latest state
    await doSearch(reference.refId ?? reference.id)
  }, [reference, doSearch])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!reference) return
    const refId = reference.refId ?? reference.id
    const res   = await fetch(`/api/admin/reference?refId=${encodeURIComponent(refId)}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error ?? 'Failed to delete')
    }
    setShowDelete(false)
    setDeleted(true)
    setReference(null)
    setState('idle')
  }, [reference])

  // ── Clear ──────────────────────────────────────────────────────────────────

  const handleClear = () => {
    setQuery('')
    setState('idle')
    setReference(null)
    setDeleted(false)
    setErrorMsg('')
    inputRef.current?.focus()
  }

  return (
    <div className="p-4 sm:p-6 xl:p-8 max-w-3xl w-full space-y-6 pb-16">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">References</h1>
        <p className="text-xs text-zinc-500">
          Look up any transaction reference by its ID
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative flex items-center">
          {/* Icon */}
          <div className="absolute left-3.5 flex items-center pointer-events-none">
            <Hash className="w-4 h-4 text-zinc-500" />
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Paste reference ID — e.g. umart-1718000000000"
            autoComplete="off"
            spellCheck={false}
            className="
              w-full pl-10 pr-28 py-3 rounded-xl
              bg-zinc-900 border border-zinc-800
              text-sm font-mono text-zinc-100 placeholder-zinc-600
              focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
              transition-all
            "
          />

          {/* Actions inside input */}
          <div className="absolute right-2 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={!query.trim() || state === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                bg-amber-500/15 text-amber-300 border border-amber-500/25
                hover:bg-amber-500/25 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state === 'loading'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Search  className="w-3.5 h-3.5" />
              }
              {state === 'loading' ? 'Searching' : 'Search'}
            </button>
          </div>
        </div>

        <p className="text-[0.65rem] text-zinc-600 pl-1">
          References follow the format <span className="font-mono text-zinc-500">umart-{'{timestamp}'}</span>
        </p>
      </form>

      {/* ── Deleted banner ───────────────────────────────────────────────────── */}
      {deleted && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-rose-400">Reference deleted</p>
            <p className="text-[0.65rem] text-zinc-500 mt-0.5">
              The transaction has been archived in <span className="font-mono">deleted_references</span> and
              removed from both user profiles.
            </p>
          </div>
        </div>
      )}

      {/* ── Not found ────────────────────────────────────────────────────────── */}
      {state === 'not_found' && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 justify-center">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-zinc-300">No reference found</p>
            <p className="text-xs text-zinc-600 font-mono">{query.trim()}</p>
            <p className="text-[0.65rem] text-zinc-600">
              Double-check the ID and try again
            </p>
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {state === 'error' && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-400">{errorMsg}</p>
        </div>
      )}

      {/* ── Reference card ────────────────────────────────────────────────────── */}
      {state === 'found' && reference && (
        <ReferenceCard
          data={reference}
          onConfirmValue={handleConfirmValue}
          onFlagTransaction={handleFlagTransaction}
          onDelete={() => setShowDelete(true)}
        />
      )}

      {/* ── Delete dialog ─────────────────────────────────────────────────────── */}
      {showDelete && reference && (
        <DeleteDialog
          refId={reference.refId ?? reference.id}
          onCancel={() => setShowDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
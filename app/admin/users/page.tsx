'use client'

import { useState, useCallback } from 'react'
import { Users, SearchX } from 'lucide-react'
import UserSearchBar, { SearchField } from './components/userSearchBar'
import UserStatsBar from './components/userStatsBar'
import UserCard, { UserData } from './components/UserCard'
import { UserCompliancePanel } from './components/UserCompliancePanel'

export default function AdminUsersPage() {
  const [results,  setResults]  = useState<UserData[] | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // The UID whose compliance panel is shown on large screens (first result by default)
  const [activeUid, setActiveUid] = useState<string | null>(null)

  async function handleSearch(field: SearchField, value: string) {
    setLoading(true)
    setErrorMsg(null)
    setSearched(true)
    setActiveUid(null)

    try {
      const res  = await fetch(`/api/admin/users?${field}=${encodeURIComponent(value)}`)
      const json = await res.json()

      if (json.success) {
        setResults(json.data)
        // Auto-select the first result on large screens
        if (json.data?.length) setActiveUid(json.data[0].uid)
      } else {
        setResults([])
        if (res.status !== 404) setErrorMsg(json.message)
      }
    } catch {
      setResults([])
      setErrorMsg('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdated = useCallback((uid: string, patch: Partial<UserData>) => {
    setResults((prev) =>
      prev ? prev.map((u) => (u.uid === uid ? { ...u, ...patch } : u)) : prev
    )
  }, [])

  const handleDeleted = useCallback((uid: string) => {
    setResults((prev) => {
      const next = prev ? prev.filter((u) => u.uid !== uid) : prev
      // If the deleted user was active, shift focus to the first remaining
      if (activeUid === uid) setActiveUid(next?.[0]?.uid ?? null)
      return next
    })
  }, [activeUid])

  const activeUser = results?.find((u) => u.uid === activeUid) ?? null

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page header ── */}
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users size={18} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground">User Management</h1>
                <p className="text-xs text-muted-foreground">Search, manage and moderate users</p>
              </div>
            </div>
            <UserStatsBar />
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Search bar */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Search Users
          </p>
          <UserSearchBar onSearch={handleSearch} loading={loading} />
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm">Searching users…</p>
            </div>
          </div>
        )}

        {/* ── No results ── */}
        {!loading && searched && results !== null && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <SearchX size={40} strokeWidth={1.3} />
            <p className="text-sm font-medium">No users found</p>
            <p className="text-xs">Try a different search term or field</p>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && results && results.length > 0 && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            </p>

            {/*
              Two-column on lg+:
                Left  → user cards list  (max ~420 px, scrollable)
                Right → compliance panel (sticky)
              Single column on mobile — compliance shown via dialog inside UserCard
            */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

              {/* Left: card list */}
              <div className="flex flex-col gap-3 lg:w-[420px] lg:shrink-0">
                {results.map((user) => (
                  <UserCard
                    key={user.uid}
                    user={user}
                    active={user.uid === activeUid}
                    onSelect={setActiveUid}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>

              {/* Right: compliance panel — desktop only */}
              {activeUser && (
                <div className="hidden flex-1 lg:block lg:sticky lg:top-6">
                  <UserCompliancePanel
                    uid={activeUser.uid}
                    fullname={activeUser.fullname}
                  />
                </div>
              )}

            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Users size={48} strokeWidth={1.2} />
            <p className="text-sm font-medium">Search for a user to get started</p>
            <p className="text-xs">You can search by name, email, or phone number</p>
          </div>
        )}
      </div>
    </div>   
  )
}
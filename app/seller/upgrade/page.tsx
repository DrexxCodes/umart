'use client'

import { useState, useEffect, useCallback } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { AlreadyCreator } from './components/AlreadyCreator'
import { IdentificationSection } from './components/IdentificationSection'
import { PassportSection } from './components/PassportSection'
import { CatalogueSection } from './components/CatalogueSection'
import { AddressSection } from './components/AddressSection'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import Image from 'next/image'

export default function BecomeCreatorPage() {
  const [user,          setUser]          = useState<User | null>(null)
  const [token,         setToken]         = useState('')
  const [authReady,     setAuthReady]     = useState(false)
  const [isCreator,     setIsCreator]     = useState(false)
  const [username,      setUsername]      = useState('')
  const [compliance,    setCompliance]    = useState<any>(null)
  const [loading,       setLoading]       = useState(true)

  const [idDone,        setIdDone]        = useState(false)
  const [passportDone,  setPassportDone]  = useState(false)
  const [addressDone,   setAddressDone]   = useState(false)
  const [catalogueDone, setCatalogueDone] = useState(false)

  const [activating,    setActivating]    = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [activated,     setActivated]     = useState(false)

  const allComplete = idDone && passportDone && addressDone && catalogueDone

  const handleIdComplete       = useCallback((v: boolean) => setIdDone(v),       [])
  const handlePassportComplete = useCallback((v: boolean) => setPassportDone(v), [])
  const handleAddressComplete  = useCallback((v: boolean) => setAddressDone(v),  [])

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setAuthReady(true)
      if (u) {
        const t = await u.getIdToken()
        setToken(t)
      }
    })
    return () => unsub()
  }, [])

  // ── Fetch user profile + compliance ────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    async function load() {
      setLoading(true)
      try {
        const [profileRes, complianceRes] = await Promise.all([
          fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/users/compliance', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const profile    = await profileRes.json()
        const compliance = await complianceRes.json()

        if (profile.success) {
          setIsCreator(profile.data?.roles?.isCreator === true)
          setUsername(profile.data?.username ?? profile.data?.fullname ?? 'User')
        }
        if (compliance.success) {
          setCompliance(compliance)
          setIdDone(compliance.sections.identification)
          setPassportDone(compliance.sections.passport)
          setAddressDone(compliance.sections.address)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleActivate = useCallback(async () => {
    if (!allComplete) return
    setActivating(true); setActivateError(null)
    try {
      const res  = await fetch('/api/users/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section: 'activate_creator' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setActivated(true)
      setTimeout(() => { window.location.href = '/creator/dashboard' }, 1500)
    } catch (err: any) {
      setActivateError(err.message)
    } finally {
      setActivating(false)
    }
  }, [allComplete, token])

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-background">
        <BuyerNav />
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BuyerNav />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">

        {/* ── Already a creator ── */}
        {isCreator ? (
          <AlreadyCreator username={username} />
        ) : (
          <>
            {/* Page header */}
            <div className="mb-8 text-center">
              <div className="mb-4 flex justify-center">
                <Image src="/creator.svg" alt="Become a Creator" width={96} height={96} priority />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Become a Creator</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete all sections below to unlock selling on U Mart. You can fill them in any order.
              </p>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Verification progress</span>
                <span>{[idDone, passportDone, addressDone, catalogueDone].filter(Boolean).length} / 4 complete</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${([idDone, passportDone, addressDone, catalogueDone].filter(Boolean).length / 4) * 100}%` }}
                />
              </div>
            </div>

            {/* Two-column on large screens */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">

              {/* Left column */}
              <div className="space-y-4">
                <IdentificationSection
                  token={token}
                  initial={compliance?.data}
                  onComplete={handleIdComplete}
                />
                <AddressSection
                  token={token}
                  initial={compliance?.data}
                  onComplete={handleAddressComplete}
                />
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <PassportSection
                  token={token}
                  initial={compliance?.data}
                  onComplete={handlePassportComplete}
                />

                <CatalogueSection
                  token={token}
                  complete={catalogueDone}
                  onComplete={() => setCatalogueDone(true)}
                />

                {/* Activate button — sticky at bottom of right col on lg */}
                <div className="space-y-3 lg:sticky lg:top-6">
                  {activateError && (
                    <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                      <AlertCircle size={13} /> {activateError}
                    </div>
                  )}

                  <button
                    onClick={handleActivate}
                    disabled={!allComplete || activating || activated}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all ${
                      allComplete
                        ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20'
                        : 'cursor-not-allowed bg-muted text-muted-foreground'
                    } disabled:opacity-60`}
                  >
                    {activating ? <Loader2 size={18} className="animate-spin" /> :
                     activated  ? <CheckCircle2 size={18} /> :
                                  <CheckCircle2 size={18} className="opacity-40" />}
                    {activating  ? 'Activating…' :
                     activated   ? 'Activated! Redirecting…' :
                     allComplete ? 'Become a Creator' :
                                   'Complete all sections to continue'}
                  </button>

                  {!allComplete && (
                    <p className="text-center text-xs text-muted-foreground">
                      {4 - [idDone, passportDone, addressDone, catalogueDone].filter(Boolean).length} section
                      {4 - [idDone, passportDone, addressDone, catalogueDone].filter(Boolean).length === 1 ? '' : 's'} remaining
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
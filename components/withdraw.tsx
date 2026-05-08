'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Banknote, Loader2, CheckCircle2, Search, ChevronDown, X, History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { auth } from '@/lib/firebase'
import { useBanks } from '@/hooks/useBanks'
import { WithdrawStatus } from './withdrawStatus'

interface SavedAccount {
  id: string
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
  recipientCode: string | null
}

interface WithdrawProps {
  refId: string
  sellerPayout: number
  valueReceived: boolean
  withdrawn: boolean
  onWithdrawn?: () => void
}

interface PayQueueEntry {
  status: 'pending' | 'paid' | 'failed'
  payoutAmount: number
  pendingAt?: any
  paidAt?: any
}

type DialogView = 'picker' | 'form' | 'status' | 'success'

export function Withdraw({
  refId,
  sellerPayout,
  valueReceived,
  withdrawn: initialWithdrawn,
  onWithdrawn,
}: WithdrawProps) {
  const { banks, loading: banksLoading, error: banksError } = useBanks()

  const [queueEntry, setQueueEntry]     = useState<PayQueueEntry | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [open, setOpen]                 = useState(false)
  const [dialogView, setDialogView]     = useState<DialogView>('picker')

  // Saved accounts
  const [savedAccounts, setSavedAccounts]         = useState<SavedAccount[]>([])
  const [savedLoading, setSavedLoading]           = useState(false)
  const [selectedSavedId, setSelectedSavedId]     = useState<string | null>(null)

  // New account form state
  const [bankCode, setBankCode]         = useState('')
  const [bankName, setBankName]         = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName]   = useState('')
  const [resolving, setResolving]       = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')

  const [bankSearch, setBankSearch]             = useState('')
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false)
  const bankDropdownRef  = useRef<HTMLDivElement>(null)
  const bankSearchRef    = useRef<HTMLInputElement>(null)

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (bankDropdownOpen) setTimeout(() => bankSearchRef.current?.focus(), 50)
  }, [bankDropdownOpen])

  const selectBank = (code: string, name: string) => {
    setBankCode(code); setBankName(name)
    setBankSearch(''); setBankDropdownOpen(false)
    setAccountName(''); setResolveError('')
  }
  const clearBank = () => {
    setBankCode(''); setBankName('')
    setBankSearch(''); setAccountName(''); setResolveError('')
  }

  const canWithdraw = valueReceived && !initialWithdrawn

  // Load payQueue status on mount
  const checkQueue = useCallback(async () => {
    if (!canWithdraw && !initialWithdrawn) return
    try {
      setQueueLoading(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch(`/api/payment/withdraw?refId=${encodeURIComponent(refId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (result.success && result.data) setQueueEntry(result.data)
    } catch { /* silent */ } finally {
      setQueueLoading(false)
    }
  }, [refId, canWithdraw, initialWithdrawn])

  useEffect(() => { checkQueue() }, [checkQueue])

  // Load saved accounts when dialog opens
  const loadSavedAccounts = useCallback(async () => {
    try {
      setSavedLoading(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/payment/withdraw?savedAccounts=true', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (result.success) setSavedAccounts(result.data ?? [])
    } catch { /* silent */ } finally {
      setSavedLoading(false)
    }
  }, [])

  // Resolve account name from bank + account number
  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      setAccountName(''); setResolveError(''); return
    }
    let cancelled = false
    const resolve = async () => {
      try {
        setResolving(true); setResolveError(''); setAccountName('')
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const res = await fetch(
          `/api/payment/resolve?accountNumber=${accountNumber}&bankCode=${bankCode}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const result = await res.json()
        if (cancelled) return
        if (result.success && result.data?.account_name) {
          setAccountName(result.data.account_name)
        } else {
          setResolveError(result.error || 'Could not verify account. Check your details.')
        }
      } catch {
        if (!cancelled) setResolveError('Failed to verify account.')
      } finally {
        if (!cancelled) setResolving(false)
      }
    }
    const t = setTimeout(resolve, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [bankCode, accountNumber])

  const handleSubmit = async () => {
    const useNewForm = dialogView === 'form'
    if (useNewForm && (!accountName || !bankCode || accountNumber.length !== 10)) return
    if (!useNewForm && !selectedSavedId) return

    try {
      setSubmitting(true); setSubmitError('')
      const user = auth.currentUser
      if (!user) { setSubmitError('You must be signed in.'); return }
      const token = await user.getIdToken()

      const payload = useNewForm
        ? { refId, bankCode, bankName, accountNumber, accountName }
        : { refId, savedAccountId: selectedSavedId }

      const res = await fetch('/api/payment/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const result = await res.json()

      if (result.success) {
        setQueueEntry(result.data)
        setDialogView('status')
        onWithdrawn?.()
      } else {
        setSubmitError(result.error || 'Failed to submit withdrawal.')
      }
    } catch {
      setSubmitError('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDialog = async (view: DialogView = 'picker') => {
    setDialogView(view)
    setSubmitError('')
    setOpen(true)
    if (view === 'picker') await loadSavedAccounts()
  }

  const closeDialog = () => {
    setOpen(false)
    setSelectedSavedId(null)
    clearBank(); setAccountNumber(''); setAccountName('')
    setResolveError(''); setBankDropdownOpen(false)
  }

  const formValid = !!accountName && !!bankCode && accountNumber.length === 10

  // ── Button ────────────────────────────────────────────────────────────────
  const renderButton = () => {
    if (queueLoading) {
      return (
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Checking...
        </Button>
      )
    }
    if (queueEntry) {
      const statusLabel = queueEntry.status === 'paid' ? 'Paid' : queueEntry.status === 'failed' ? 'Failed' : 'Pending'
      const statusVariant = queueEntry.status === 'paid' ? 'default' : queueEntry.status === 'failed' ? 'destructive' : 'outline'
      return (
        <Button variant={statusVariant} size="sm" onClick={() => openDialog('status')}>
          <Banknote className="w-3.5 h-3.5 mr-1.5" />{statusLabel}
        </Button>
      )
    }
    return (
      <Button
        variant={canWithdraw ? 'default' : 'outline'}
        size="sm"
        disabled={!canWithdraw}
        onClick={() => openDialog('picker')}
        title={
          !valueReceived ? 'Buyer must confirm value received'
          : initialWithdrawn ? 'Already withdrawn'
          : 'Withdraw funds'
        }
      >
        <Banknote className="w-3.5 h-3.5 mr-1.5" />
        {initialWithdrawn ? 'Withdrawn' : !valueReceived ? 'Awaiting Confirmation' : 'Withdraw'}
      </Button>
    )
  }

  return (
    <>
      {renderButton()}

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closeDialog} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">
                    {dialogView === 'status'  ? 'Withdrawal Status'
                     : dialogView === 'form'  ? 'New Bank Account'
                     : 'Withdraw Funds'}
                  </h2>
                </div>
                <button
                  onClick={closeDialog}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">

                {/* ── Status view ──────────────────────────────────────────── */}
                {dialogView === 'status' && queueEntry && (
                  <WithdrawStatus
                    status={queueEntry.status}
                    pendingAt={queueEntry.pendingAt}
                    paidAt={queueEntry.paidAt}
                    payoutAmount={queueEntry.payoutAmount}
                  />
                )}

                {/* ── Account picker view ───────────────────────────────────── */}
                {dialogView === 'picker' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select an account to receive{' '}
                      <span className="font-semibold text-foreground">₦{sellerPayout.toLocaleString()}</span>.
                    </p>

                    {savedLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : savedAccounts.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <History className="w-3 h-3" />Saved Accounts
                        </p>
                        {savedAccounts.map((acct) => (
                          <button
                            key={acct.id}
                            type="button"
                            onClick={() => setSelectedSavedId(acct.id)}
                            className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                              selectedSavedId === acct.id
                                ? 'border-primary bg-primary/8'
                                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{acct.accountName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{acct.bankName}</p>
                              <p className="text-xs font-mono text-muted-foreground">{acct.accountNumber}</p>
                            </div>
                            {selectedSavedId === acct.id && (
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setDialogView('form')}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      {savedAccounts.length > 0 ? 'Use a different account' : 'Enter bank account details'}
                    </button>

                    {submitError && <p className="text-xs text-destructive">{submitError}</p>}

                    {selectedSavedId && (
                      <div className="flex gap-3 pt-1">
                        <Button variant="outline" className="flex-1" onClick={closeDialog} disabled={submitting}>Cancel</Button>
                        <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={submitting}>
                          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Banknote className="w-4 h-4" />Request Payout</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── New account form ──────────────────────────────────────── */}
                {dialogView === 'form' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter your bank details to receive{' '}
                      <span className="font-semibold text-foreground">₦{sellerPayout.toLocaleString()}</span>.
                      This account will be saved for future withdrawals.
                    </p>

                    {/* Bank dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Bank <span className="text-destructive">*</span>
                      </label>
                      <div className="relative" ref={bankDropdownRef}>
                        <button
                          type="button"
                          disabled={submitting || banksLoading}
                          onClick={() => setBankDropdownOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 transition-colors hover:bg-muted/30"
                        >
                          <span className={bankCode ? 'text-foreground' : 'text-muted-foreground'}>
                            {banksLoading ? 'Loading banks…' : bankName || 'Select your bank…'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {banksLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                            {bankCode && !submitting && (
                              <span
                                role="button" tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); clearBank() }}
                                onKeyDown={(e) => e.key === 'Enter' && clearBank()}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              ><X className="w-3.5 h-3.5" /></span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {bankDropdownOpen && !banksLoading && (
                          <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                            <div className="p-2 border-b border-border">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                  ref={bankSearchRef}
                                  type="text"
                                  value={bankSearch}
                                  onChange={(e) => setBankSearch(e.target.value)}
                                  placeholder="Search banks…"
                                  className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                                />
                              </div>
                            </div>
                            <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
                              {filteredBanks.length === 0
                                ? <li className="px-3 py-2 text-sm text-muted-foreground text-center">No banks found</li>
                                : filteredBanks.map((bank, i) => (
                                  <li
                                    key={`${bank.code}-${i}`}
                                    role="option" aria-selected={bank.code === bankCode}
                                    onClick={() => selectBank(bank.code, bank.name)}
                                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${bank.code === bankCode ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                                  >{bank.name}</li>
                                ))
                              }
                            </ul>
                          </div>
                        )}
                        {banksError && <p className="text-xs text-destructive mt-1">{banksError}</p>}
                      </div>
                    </div>

                    {/* Account number */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Account Number <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text" inputMode="numeric" maxLength={10}
                        placeholder="10-digit account number"
                        value={accountNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setAccountNumber(val); setAccountName(''); setResolveError('')
                        }}
                        disabled={submitting} className="rounded-xl"
                      />
                    </div>

                    {/* Account name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account Name</label>
                      <div className="relative">
                        <Input
                          type="text" readOnly
                          value={resolving ? '' : accountName}
                          placeholder={
                            resolving ? 'Verifying account…'
                            : accountNumber.length === 10 && bankCode ? (resolveError || 'Account name will appear here')
                            : 'Enter bank and account number above'
                          }
                          className={`rounded-xl bg-muted/50 cursor-default ${accountName ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''} ${resolveError ? 'border-destructive/50' : ''}`}
                        />
                        {resolving && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                        {accountName && !resolving && <CheckCircle2 className="absolute right-3 top-2.5 w-4 h-4 text-emerald-500" />}
                      </div>
                      {resolveError && <p className="text-xs text-destructive">{resolveError}</p>}
                    </div>

                    {submitError && <p className="text-xs text-destructive">{submitError}</p>}

                    <div className="flex gap-3 pt-1">
                      <Button variant="outline" className="flex-1" onClick={() => setDialogView('picker')} disabled={submitting}>Back</Button>
                      <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={submitting || !formValid}>
                        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : <><Banknote className="w-4 h-4" />Request Payout</>}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

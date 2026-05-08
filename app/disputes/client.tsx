'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DisputeDialog } from '@/components/disputes/DisputeDialog'
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Transaction {
  refId: string
  items: Array<{ productName: string; quantity: number; price: number }>
  grandPrice: number
  status: string
  valueReceived: boolean
  confirmedValue: boolean
}

interface Dispute {
  id: string
  txnId: string
  status: 'open' | 'resolving' | 'closed' | 'refunded'
  title: string
  createdAt: string
}

// Dialog to warn buyer about submitting without attachments
function NoAttachmentWarningDialog({
  onGoAhead,
  onCancel,
}: {
  onGoAhead: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <AlertTriangle size={20} />
          </div>
          <h3 className="font-bold text-foreground text-sm leading-tight">No Attachments Added</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Disputes without at least one attachment may not likely go in your favour. Consider adding at least one photo or video as evidence. Otherwise, go ahead and make the dispute.
        </p>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Add Evidence
          </Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={onGoAhead}
          >
            Submit Anyway
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function DisputesClient() {
  const router = useRouter()
  const [isAuth, setIsAuth] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [pendingTxn, setPendingTxn] = useState<Transaction | null>(null)
  const [showNoAttachWarning, setShowNoAttachWarning] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuth(true)
      else router.push('/auth/login')
    })
    return unsub
  }, [router])

  useEffect(() => {
    if (!isAuth) return
    ;(async () => {
      try {
        setLoading(true)
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()

        const [txnRes, dispRes] = await Promise.all([
          fetch('/api/transactions?type=purchase', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/dispute/list?role=buyer', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const txnData = await txnRes.json()
        const dispData = await dispRes.json()

        // Show paid AND disputing transactions (disputing ones already have a dispute filed)
        if (txnData.success) setTransactions(txnData.data)
        if (dispData.success) setDisputes(dispData.data)
      } catch (e: any) {
        toast.error(e.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuth])

  const getDisputeForTxn = (refId: string) => disputes.find((d) => d.txnId === refId)

  const STATUS_CONFIG = {
    open:      { label: 'Open',      cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
    resolving: { label: 'Resolving', cls: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
    closed:    { label: 'Closed',    cls: 'bg-muted text-muted-foreground border-border' },
    refunded:  { label: 'Refunded',  cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
  }

  // Called when the dispute dialog wants to submit — check attachments first
  const handleDisputeSubmitRequest = (attachments: Array<any>) => {
    if (attachments.length === 0) {
      setShowNoAttachWarning(true)
      return false // tell dialog to wait
    }
    return true // proceed
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <BuyerNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <BuyerNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-destructive" />
            My Disputes
          </h1>
          <p className="text-muted-foreground text-sm">
            Paid transactions appear here. You can raise a dispute for any item you have not received or that doesn't match the listing.
          </p>
        </div>

        {transactions.length === 0 ? (
          <Card className="p-8 text-center">
            <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No paid transactions found.</p>
            <Button className="mt-4" onClick={() => router.push('/transactions')}>View Transactions</Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {transactions.map((txn) => {
              const dispute = getDisputeForTxn(txn.refId)
              const cfg = dispute ? STATUS_CONFIG[dispute.status] : null
              const isDisputing = txn.status === 'disputing'
              // Can only dispute if status is paid and confirmedValue is false
              const canDispute = txn.status === 'paid' && !txn.confirmedValue && !dispute

              return (
                <Card key={txn.refId} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-semibold text-foreground truncate">
                          {txn.refId}
                        </span>
                        {isDisputing && !dispute && (
                          <span className="text-xs px-2 py-0.5 rounded border font-medium bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                            Disputing
                          </span>
                        )}
                        {dispute && cfg && (
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        )}
                        {txn.confirmedValue && (
                          <span className="text-xs px-2 py-0.5 rounded border font-medium bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Value Confirmed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {txn.items?.[0]?.productName ?? 'Unknown product'}
                        {txn.items.length > 1 && ` + ${txn.items.length - 1} more`}
                      </p>
                      <p className="text-base font-semibold text-primary">
                        ₦{txn.grandPrice.toLocaleString()}
                      </p>
                      {dispute && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Dispute: <span className="text-foreground font-medium">{dispute.title}</span>
                        </p>
                      )}
                      {txn.confirmedValue && !dispute && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          You've confirmed value for this transaction — it can no longer be disputed.
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {dispute ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${cfg!.cls}`}>
                          <CheckCircle2 size={12} />
                          Dispute Filed
                        </span>
                      ) : isDisputing ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                          <ShieldAlert size={12} />
                          Under Review
                        </span>
                      ) : canDispute ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setPendingTxn(txn)}
                          className="gap-1.5"
                        >
                          <ShieldAlert size={14} />
                          Dispute
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground px-2 py-1">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* No-attachment warning — shown before opening the actual dialog */}
      {showNoAttachWarning && pendingTxn && (
        <NoAttachmentWarningDialog
          onGoAhead={() => {
            setShowNoAttachWarning(false)
            setSelectedTxn(pendingTxn)
            setPendingTxn(null)
          }}
          onCancel={() => {
            setShowNoAttachWarning(false)
            // keep pendingTxn so user can still open dialog
            setSelectedTxn(pendingTxn)
            setPendingTxn(null)
          }}
        />
      )}

      {/* Dispute dialog — opened after warning flow or directly if attachments present */}
      {selectedTxn && (
        <DisputeDialog
          transaction={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onBeforeSubmit={handleDisputeSubmitRequest}
          onSubmitted={() => {
            setSelectedTxn(null)
            toast.success(
              'Umart and the seller have received your dispute. We shall send you an email to continue the claim.',
              { duration: 6000 }
            )
            ;(async () => {
              const user = auth.currentUser
              if (!user) return
              const token = await user.getIdToken()
              const [txnRes, dispRes] = await Promise.all([
                fetch('/api/transactions?type=purchase', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/dispute/list?role=buyer', { headers: { Authorization: `Bearer ${token}` } }),
              ])
              const txnData = await txnRes.json()
              const dispData = await dispRes.json()
              if (txnData.success) setTransactions(txnData.data)
              if (dispData.success) setDisputes(dispData.data)
            })()
          }}
        />
      )}

      {/* Open dialog directly when clicking Dispute button (warning shown inside via onBeforeSubmit) */}
      {pendingTxn && !showNoAttachWarning && !selectedTxn && (
        <DisputeDialog
          transaction={pendingTxn}
          onClose={() => setPendingTxn(null)}
          onBeforeSubmit={(attachments) => {
            if (attachments.length === 0) {
              setShowNoAttachWarning(true)
              return false
            }
            return true
          }}
          onSubmitted={() => {
            setPendingTxn(null)
            toast.success(
              'Umart and the seller have received your dispute. We shall send you an email to continue the claim.',
              { duration: 6000 }
            )
            ;(async () => {
              const user = auth.currentUser
              if (!user) return
              const token = await user.getIdToken()
              const [txnRes, dispRes] = await Promise.all([
                fetch('/api/transactions?type=purchase', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/dispute/list?role=buyer', { headers: { Authorization: `Bearer ${token}` } }),
              ])
              const txnData = await txnRes.json()
              const dispData = await dispRes.json()
              if (txnData.success) setTransactions(txnData.data)
              if (dispData.success) setDisputes(dispData.data)
            })()
          }}
        />
      )}
    </div>
  )
}

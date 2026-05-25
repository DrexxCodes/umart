'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, ArrowRight, CheckCircle, ShieldCheck, XCircle, ShieldAlert, Star } from 'lucide-react'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { PaymentButton, AlreadyPaid } from '@/components/payment'
import { ReviewDialog } from '@/components/review-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/dialog'

interface Transaction {
  id: string
  refId: string
  sellerId: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  items: Array<{ productName: string; quantity: number; price: number }>
  itemsTotal: number
  shippingFee: number
  platformFee: number
  grandPrice: number
  buyerBearsBurden: boolean
  status: 'pending' | 'paid' | 'failed' | 'disputing' | string
  valueReceived: boolean
  confirmedValue: boolean
  createdAt: any
}

type PayDialogScreen = 'confirm' | 'loading' | 'closed'

export function TransactionsClient() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payScreen, setPayScreen] = useState<PayDialogScreen>('confirm')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [confirmingValue, setConfirmingValue] = useState(false)
  const [reviewTransaction, setReviewTransaction] = useState<Transaction | null>(null)
  const [reviewedRefs, setReviewedRefs] = useState<Set<string>>(new Set())
  // UX: track which transaction the user clicked so we can show a row-level spinner
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true)
      else router.push('/auth/login')
    })
    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!isAuthenticated) return
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const response = await fetch('/api/transactions?type=purchase', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await response.json()
        if (result.success) setTransactions(result.data)
        else setError(result.error || 'Failed to load transactions')
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }
    fetchTransactions()
  }, [isAuthenticated])

  // Updates a single transaction's status in state — used by AlreadyPaid
  const syncTransactionStatus = (refId: string, status: string) => {
    setTransactions((prev) =>
      prev.map((t) => t.refId === refId ? { ...t, status } : t)
    )
  }

  const handleConfirmValue = async () => {
    if (!selectedTransaction) return
    try {
      setConfirmingValue(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const response = await fetch('/api/payment/value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refId: selectedTransaction.refId }),
      })
      const result = await response.json()
      if (result.success) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.refId === selectedTransaction.refId ? { ...t, valueReceived: true, confirmedValue: true } : t
          )
        )
        setConfirmDialogOpen(false)
        setSelectedTransaction(null)
      } else {
        setError(result.error || 'Failed to confirm value received')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm value received')
    } finally {
      setConfirmingValue(false)
    }
  }

  const openConfirmDialog = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTransaction(transaction)
    setConfirmDialogOpen(true)
  }

  const openPayDialog = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTransaction(transaction)
    setPayScreen('confirm')
    setPayDialogOpen(true)
  }

  const handleRowClick = (refId: string) => {
    setNavigatingTo(refId)
    router.push(`/transactions/${refId}`)
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return ''
    const seconds = timestamp._seconds ?? timestamp.seconds
    const date = seconds ? new Date(seconds * 1000) : new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid:      'bg-green-100 text-green-800 border-green-200',
      pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
      failed:    'bg-red-100 text-red-800 border-red-200',
      disputing: 'bg-amber-100 text-amber-800 border-amber-200',
    }
    const icons: Record<string, React.ReactNode> = {
      disputing: <ShieldAlert className="w-3 h-3 inline mr-0.5" />,
    }
    return (
      <span className={`text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${styles[status] || styles.pending}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <BuyerNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <BuyerNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Transactions</h1>
          <p className="text-muted-foreground">
            Click any transaction to view details or confirm value received
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {transactions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No transactions yet</p>
            <Button onClick={() => router.push('/')}>Browse Products</Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {transactions.map((transaction) => {
              const isDisputing = transaction.status === 'disputing'
              const hasConfirmedValue = transaction.valueReceived || transaction.confirmedValue
              const isNavigating = navigatingTo === transaction.refId
              return (
                <Card
                  key={transaction.refId}
                  className="p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer min-w-0 relative"
                      onClick={() => handleRowClick(transaction.refId)}
                    >
                      {/* Loading overlay on the clickable area */}
                      {isNavigating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg z-10">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold truncate">
                          Ref: {transaction.refId}
                        </h3>
                        {getStatusBadge(transaction.status)}
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {formatDate(transaction.createdAt)}
                        </span>
                        {hasConfirmedValue && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Value Confirmed
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mb-4 text-sm text-muted-foreground">
                        {transaction.items.length > 0 && (
                          <p>• {transaction.items[0].productName} × {transaction.items[0].quantity}</p>
                        )}
                        {transaction.items.length > 1 && (
                          <p className="text-xs">
                            and {transaction.items.length - 1} more item{transaction.items.length - 1 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground">Amount Due</p>
                        <p className="font-semibold text-lg text-primary">
                          ₦{transaction.grandPrice.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
                      {transaction.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={(e) => openPayDialog(transaction, e)}>
                            Pay Now
                          </Button>
                          <AlreadyPaid
                            refId={transaction.refId}
                            onConfirmed={() => syncTransactionStatus(transaction.refId, 'paid')}
                            onFailed={() => syncTransactionStatus(transaction.refId, 'failed')}
                          />
                        </>
                      )}

                      {transaction.status === 'paid' && !isDisputing && (
                        <Button
                          variant={!hasConfirmedValue ? 'default' : 'outline'}
                          size="sm"
                          disabled={hasConfirmedValue}
                          onClick={(e) => openConfirmDialog(transaction, e)}
                        >
                          {hasConfirmedValue ? 'Value Confirmed' : 'Confirm Value Received'}
                        </Button>
                      )}

                      {isDisputing && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-amber-100 text-amber-800 border-amber-200">
                          <ShieldAlert className="w-3 h-3" />
                          Disputing
                        </span>
                      )}

                      {hasConfirmedValue && !reviewedRefs.has(transaction.refId) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setReviewTransaction(transaction) }}
                        >
                          <Star className="w-3 h-3" />
                          Review
                        </Button>
                      )}
                      {reviewedRefs.has(transaction.refId) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          Reviewed
                        </span>
                      )}

                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Review dialog */}
      {reviewTransaction && (
        <ReviewDialog
          transaction={reviewTransaction}
          onClose={() => setReviewTransaction(null)}
          onSubmitted={() => {
            setReviewedRefs((prev) => new Set([...prev, reviewTransaction.refId]))
            setReviewTransaction(null)
          }}
        />
      )}

      {/* ── Pay Dialog ─────────────────────────────────────────────────────── */}
      <AlertDialog
        open={payDialogOpen}
        onOpenChange={(open) => {
          if (!open && payScreen === 'confirm') setPayDialogOpen(false)
        }}
      >
        <AlertDialogContent>
          {payScreen === 'confirm' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete Your Payment</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground font-medium">
                        We only pay the seller when you get your items.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You will be charged{' '}
                      <strong className="text-foreground text-base">
                        ₦{selectedTransaction?.grandPrice.toLocaleString()}
                      </strong>
                      . This amount is held securely in escrow until you confirm delivery.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel onClick={() => setPayDialogOpen(false)}>
                  Cancel
                </AlertDialogCancel>
                {selectedTransaction && (
                  <PaymentButton
                    refId={selectedTransaction.refId}
                    grandPrice={selectedTransaction.grandPrice}
                    buyerEmail={selectedTransaction.buyerEmail}
                    buyerName={selectedTransaction.buyerName}
                    buyerPhone={selectedTransaction.buyerPhone}
                    label={`Pay ₦${selectedTransaction.grandPrice.toLocaleString()}`}
                    onMounting={() => { setPayScreen('loading'); setPayDialogOpen(false) }}
                    onClose={() => { setPayScreen('closed'); setPayDialogOpen(true) }}
                  />
                )}
              </AlertDialogFooter>
            </>
          )}

          {payScreen === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <div>
                <p className="font-semibold text-base">Please hold…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We're opening the secure payment window for you.
                </p>
              </div>
            </div>
          )}

          {payScreen === 'closed' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                  Payment Window Closed
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Looks like you closed the payment popup without completing payment.
                      Your order is still saved, you can pay anytime from your transactions.
                    </p>
                    {selectedTransaction && (
                      <div className="flex justify-center pt-1">
                        <AlreadyPaid
                          refId={selectedTransaction.refId}
                          onConfirmed={() => {
                            syncTransactionStatus(selectedTransaction.refId, 'paid')
                            setPayDialogOpen(false)
                          }}
                          onFailed={() => {
                            syncTransactionStatus(selectedTransaction.refId, 'failed')
                            setPayDialogOpen(false)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel onClick={() => setPayDialogOpen(false)}>Dismiss</AlertDialogCancel>
                {selectedTransaction && (
                  <PaymentButton
                    refId={selectedTransaction.refId}
                    grandPrice={selectedTransaction.grandPrice}
                    buyerEmail={selectedTransaction.buyerEmail}
                    buyerName={selectedTransaction.buyerName}
                    buyerPhone={selectedTransaction.buyerPhone}
                    label="Try Again"
                    onMounting={() => { setPayScreen('loading'); setPayDialogOpen(false) }}
                    onClose={() => { setPayScreen('closed'); setPayDialogOpen(true) }}
                  />
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Value Dialog ───────────────────────────────────────────── */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Confirm Value Received
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  We will pay out the seller{' '}
                  <strong className="text-foreground">
                    ₦{selectedTransaction?.grandPrice.toLocaleString()}
                  </strong>{' '}
                  immediately once you confirm.
                </p>
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
                  <p className="text-amber-700 dark:text-amber-300 font-medium text-xs">
                    ⚠️ Only confirm if you have received what you ordered. If you have not yet
                    received your item or there is a problem, create a dispute instead.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={confirmingValue}>Cancel</AlertDialogCancel>
            <button
              onClick={() => {
                setConfirmDialogOpen(false)
                if (selectedTransaction) router.push('/disputes')
              }}
              disabled={confirmingValue}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              Create Dispute Instead
            </button>
            <AlertDialogAction onClick={handleConfirmValue} disabled={confirmingValue}>
              {confirmingValue ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirming...</>
              ) : (
                'Yes, I Got It — Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

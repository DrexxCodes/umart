'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, ChevronLeft, CheckCircle, Clock, XCircle, Banknote, User, ShieldAlert } from 'lucide-react'
import { CreatorNav } from '@/components/nav/creator-nav'
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

interface SaleDetail {
  refId: string
  type: string
  sellerId: string
  buyerId: string
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  items: Array<{ productName: string; quantity: number; price: number }>
  itemsTotal: number
  shippingFee: number
  platformFee: number
  grandPrice: number
  status: 'pending' | 'paid' | 'failed' | 'disputing' | string
  valueReceived: boolean
  withdrawn: boolean
  createdAt: any
  updatedAt: any
}

export function CreatorTransactionDetailClient() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [transaction, setTransaction] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Withdraw dialog
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true)
      else router.push('/auth/login')
    })
    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchTransaction = async () => {
      try {
        setLoading(true)
        setError('')
        const user = auth.currentUser
        if (!user) return

        const token = await user.getIdToken()

        const response = await fetch(`/api/transactions?type=sale&refId=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const result = await response.json()

        if (!result.success) {
          setError(result.error || 'Failed to load sale')
          return
        }

        setTransaction(result.data)
      } catch (err: any) {
        setError(err.message || 'Failed to load sale')
      } finally {
        setLoading(false)
      }
    }

    fetchTransaction()
  }, [id, isAuthenticated])

  const handleWithdraw = async () => {
    if (!transaction) return
    try {
      setWithdrawing(true)
      setWithdrawError('')
      const user = auth.currentUser
      if (!user) return

      const token = await user.getIdToken()

      const response = await fetch('/api/transactions/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refId: transaction.refId }),
      })

      const result = await response.json()

      if (result.success) {
        setTransaction((prev) => prev ? { ...prev, withdrawn: true } : null)
        setWithdrawDialogOpen(false)
      } else {
        setWithdrawError(result.error || 'Failed to process withdrawal')
      }
    } catch (err: any) {
      setWithdrawError(err.message || 'Failed to process withdrawal')
    } finally {
      setWithdrawing(false)
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—'
    const seconds = timestamp._seconds ?? timestamp.seconds
    const date = seconds ? new Date(seconds * 1000) : new Date(timestamp)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { icon: React.ReactNode; classes: string; label: string }> = {
      paid: {
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        classes: 'bg-green-100 text-green-700 border-green-200',
        label: 'Paid',
      },
      pending: {
        icon: <Clock className="w-3.5 h-3.5" />,
        classes: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        label: 'Pending Payment',
      },
      failed: {
        icon: <XCircle className="w-3.5 h-3.5" />,
        classes: 'bg-red-100 text-red-700 border-red-200',
        label: 'Failed',
      },
      disputing: {
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        classes: 'bg-amber-100 text-amber-700 border-amber-200',
        label: 'Disputing',
      },
    }
    const s = map[status] || map.pending
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.classes}`}>
        {s.icon}
        {s.label}
      </span>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CreatorNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading sale...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Not found / error ─────────────────────────────────────────────────────
  if (!transaction) {
    return (
      <div className="min-h-screen bg-background">
        <CreatorNav />
        <div className="max-w-2xl mx-auto p-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-6 -ml-2">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Card className="p-8 text-center space-y-4">
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-destructive font-medium">{error || 'Sale not found'}</p>
            <Button variant="outline" onClick={() => router.push('/creator/transactions')}>
              View All Sales
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  const canWithdraw = transaction.valueReceived && !transaction.withdrawn

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <CreatorNav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Back + Header */}
        <div>
          <Button variant="ghost" onClick={() => router.back()} className="-ml-2 mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Sale Details</h1>
              <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{transaction.refId}</p>
            </div>
            <StatusBadge status={transaction.status} />
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Withdrawal Card */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-1">Withdrawal</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Funds are released for withdrawal once the buyer confirms they have received value.
          </p>

          {transaction.status === 'disputing' ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                Withdrawing is currently halted for this transaction as there's an ongoing dispute.
              </span>
            </div>
          ) : transaction.withdrawn ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <Banknote className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-blue-700 text-sm font-medium">Funds successfully withdrawn</span>
            </div>
          ) : transaction.valueReceived ? (
            <Button
              onClick={() => { setWithdrawError(''); setWithdrawDialogOpen(true) }}
              className="w-full"
              size="lg"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Withdraw ₦{transaction.grandPrice.toLocaleString()}
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
              <span className="text-yellow-700 text-sm font-medium">
                Awaiting buyer confirmation — funds locked in escrow
              </span>
            </div>
          )}
        </Card>

        {/* Buyer Info */}
        {(transaction.buyerName || transaction.buyerEmail || transaction.buyerPhone) && (
          <Card className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Buyer Information
            </h2>
            <div className="space-y-2 text-sm">
              {transaction.buyerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{transaction.buyerName}</span>
                </div>
              )}
              {transaction.buyerEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{transaction.buyerEmail}</span>
                </div>
              )}
              {transaction.buyerPhone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{transaction.buyerPhone}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Items */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Items</h2>
          <div className="divide-y divide-border">
            {transaction.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-sm">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₦{item.price.toLocaleString()}</p>
                </div>
                <p className="font-semibold text-sm">₦{(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Pricing Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Items Total</span>
              <span>₦{transaction.itemsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping Fee</span>
              <span>₦{transaction.shippingFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Fee (5%)</span>
              <span>₦{transaction.platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-border pt-3 mt-1">
              <span>Grand Total</span>
              <span className="text-primary">₦{transaction.grandPrice.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Transaction Info */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Transaction Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Created</p>
              <p className="font-medium">{formatDate(transaction.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Last Updated</p>
              <p className="font-medium">{formatDate(transaction.updatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Value Confirmed</p>
              <p className="font-medium">{transaction.valueReceived ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Withdrawn</p>
              <p className="font-medium">{transaction.withdrawn ? 'Yes' : 'No'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Reference ID</p>
              <p className="font-mono text-xs break-all">{transaction.refId}</p>
            </div>
          </div>
        </Card>

      </div>

      {/* Withdraw Confirmation Dialog */}
      <AlertDialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Withdrawal</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to withdraw{' '}
              <strong className="text-foreground">
                ₦{transaction.grandPrice.toLocaleString()}
              </strong>{' '}
              from this transaction. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {withdrawError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mx-6">
              <p className="text-destructive text-sm">{withdrawError}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Withdraw Funds'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, ArrowRight, CheckCircle, Clock, XCircle, ShieldAlert } from 'lucide-react'
import { CreatorNav } from '@/components/nav/creator-nav'
import { Withdraw } from '@/components/withdraw'

interface SaleTransaction {
  refId: string
  items: Array<{ productName: string; quantity: number; price: number }>
  grandPrice: number
  sellerPayout: number
  status: 'pending' | 'paid' | 'failed' | 'disputing'
  valueReceived: boolean
  withdrawn: boolean
}

export function CreatorTransactionsClient() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<SaleTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true)
      else router.push('/auth/login')
    })
    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchSales = async () => {
      try {
        setLoading(true)
        const user = auth.currentUser
        if (!user) return

        const token = await user.getIdToken()
        const response = await fetch('/api/transactions?type=sale', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await response.json()

        if (result.success) setTransactions(result.data)
        else setError(result.error || 'Failed to load sales')
      } catch (err: any) {
        setError(err.message || 'Failed to load sales')
      } finally {
        setLoading(false)
      }
    }

    fetchSales()
  }, [isAuthenticated])

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { icon: React.ReactNode; classes: string; label: string }> = {
      paid: {
        icon: <CheckCircle className="w-3 h-3" />,
        classes: 'bg-green-100 text-green-700 border-green-200',
        label: 'Paid',
      },
      pending: {
        icon: <Clock className="w-3 h-3" />,
        classes: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        label: 'Pending Payment',
      },
      failed: {
        icon: <XCircle className="w-3 h-3" />,
        classes: 'bg-red-100 text-red-700 border-red-200',
        label: 'Failed',
      },
      disputing: {
        icon: <ShieldAlert className="w-3 h-3" />,
        classes: 'bg-amber-100 text-amber-700 border-amber-200',
        label: 'Disputing',
      },
    }
    const s = map[status] || map.pending
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${s.classes}`}>
        {s.icon}
        {s.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CreatorNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading sales...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CreatorNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Sales</h1>
          <p className="text-muted-foreground">
            Track your sales and withdraw funds once buyers confirm value received
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {transactions.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">No sales yet</p>
            <Button variant="outline" onClick={() => router.push('/creator/invoice')}>
              Create Invoice
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {transactions.map((transaction) => {
              const isDisputing = transaction.status === 'disputing'
              return (
                <Card
                  key={transaction.refId}
                  className="p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Clickable area → detail page */}
                    <div
                      className="flex-1 cursor-pointer min-w-0"
                      onClick={() => router.push(`/creator/transactions/${transaction.refId}`)}
                    >
                      {/* Ref + status badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-base font-semibold truncate">
                          Ref: {transaction.refId}
                        </h3>
                        <StatusBadge status={transaction.status} />
                        {transaction.valueReceived && !isDisputing && (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded">
                            <CheckCircle className="w-3 h-3" />
                            Value Confirmed
                          </span>
                        )}
                      </div>

                      {/* Disputing notice */}
                      {isDisputing && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 mb-3">
                          <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Withdrawing is currently halted for this transaction as there's an ongoing dispute.
                          </p>
                        </div>
                      )}

                      {/* Items preview */}
                      <div className="text-sm text-muted-foreground mb-4 space-y-0.5">
                        {transaction.items.length > 0 && (
                          <p>• {transaction.items[0].productName} × {transaction.items[0].quantity}</p>
                        )}
                        {transaction.items.length > 1 && (
                          <p className="text-xs">
                            and {transaction.items.length - 1} more item{transaction.items.length - 1 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {/* Grand total */}
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">Grand Total</p>
                        <p className="font-bold text-lg text-primary">
                          ₦{transaction.grandPrice.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {!isDisputing && (
                        <Withdraw
                          refId={transaction.refId}
                          sellerPayout={transaction.sellerPayout ?? transaction.grandPrice}
                          valueReceived={transaction.valueReceived}
                          withdrawn={transaction.withdrawn}
                          onWithdrawn={() =>
                            setTransactions((prev) =>
                              prev.map((t) =>
                                t.refId === transaction.refId ? { ...t, withdrawn: true } : t
                              )
                            )
                          }
                        />
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

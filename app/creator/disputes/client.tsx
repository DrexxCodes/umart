'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { CreatorNav } from '@/components/nav/creator-nav'
import { Card } from '@/components/ui/card'
import { Loader2, ShieldAlert, Info } from 'lucide-react'
import { toast } from 'sonner'

interface Dispute {
  id: string
  txnId: string
  status: 'open' | 'resolving' | 'closed' | 'refunded'
  title: string
  details: string
  productName: string
  grandPrice: number
  createdAt: string
}

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    description: 'The dispute has been logged. Umart will reach out to you soon.',
  },
  resolving: {
    label: 'Resolving',
    cls: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    description: 'You have been reached out to and an investigation is currently being carried out.',
  },
  closed: {
    label: 'Closed',
    cls: 'bg-muted text-muted-foreground border-border',
    description: 'The buyer could not provide sufficient evidence for a valid dispute.',
  },
  refunded: {
    label: 'Refunded',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    description: 'The claim was valid and the buyer has been refunded.',
  },
}

export default function CreatorDisputesClient() {
  const router = useRouter()
  const [isAuth, setIsAuth] = useState(false)
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

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
        const res = await fetch('/api/dispute/list?role=creator', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.success) setDisputes(data.data)
        else toast.error(data.error || 'Failed to load disputes')
      } catch (e: any) {
        toast.error(e.message || 'Failed to load disputes')
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuth])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CreatorNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CreatorNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-destructive" />
            Disputes
          </h1>
          <p className="text-sm text-muted-foreground">
            Disputes filed by buyers against your products. Umart will contact you if further information is needed.
          </p>
        </div>

        {disputes.length === 0 ? (
          <Card className="p-8 text-center">
            <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No disputes found. Keep up the great work!</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {disputes.map((dispute) => {
              const cfg = STATUS_CONFIG[dispute.status]
              return (
                <Card key={dispute.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{dispute.txnId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground">{dispute.title}</h3>
                      <p className="text-sm text-muted-foreground">{dispute.productName}</p>
                      <p className="text-sm font-medium text-primary mt-0.5">₦{dispute.grandPrice?.toLocaleString()}</p>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(dispute.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Status interpretation */}
                  <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${cfg.cls}`}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <p className="text-xs">{cfg.description}</p>
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

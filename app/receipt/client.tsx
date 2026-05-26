'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, XCircle, Clock, Loader2,
  Download, ArrowRight, Copy, Check,
  ShoppingBag, CreditCard, Store, User,
  Phone, Mail, Package,
} from 'lucide-react'

interface ReceiptItem {
  productName: string
  quantity: number
  price: number
}

interface ReceiptData {
  refId: string
  status: string
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  sellerName: string | null
  items: ReceiptItem[]
  itemsTotal: number
  shippingFee: number
  platformFee: number
  grandPrice: number
  paidVia: string | null
  createdAt: string | null
  paidAt: string | null
}

interface ReceiptClientProps {
  initialData: ReceiptData | null
  refId: string
}

function formatMoney(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <div className="relative">
        {/* Outer glow rings */}
        <div className="absolute inset-0 rounded-full bg-emerald-400/20 scale-150 animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-emerald-400/10 scale-[1.8]" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
          <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40">
        <XCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
    )
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-400 shadow-lg shadow-amber-400/40">
      <Clock className="h-10 w-10 text-white" strokeWidth={2.5} />
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="ml-2 inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {copied ? <><Check className="h-3 w-3" />Copied</> : <><Copy className="h-3 w-3" />Copy</>}
    </button>
  )
}

// ── Skeleton while fetching ────────────────────────────────────────────────────
function ReceiptSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-20 w-20 rounded-full bg-muted" />
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

// ── Not found ─────────────────────────────────────────────────────────────────
function NotFound({ refId }: { refId: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <XCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Receipt Not Found</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          {refId
            ? `We couldn't find a transaction for reference "${refId}".`
            : 'No transaction reference was provided.'}
        </p>
      </div>
      <Link
        href="/transactions"
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-all hover:opacity-90 active:scale-95"
      >
        View My Transactions
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// ── Main receipt UI ───────────────────────────────────────────────────────────
function Receipt({ data }: { data: ReceiptData }) {
  const isPaid    = data.status === 'paid'
  const isFailed  = data.status === 'failed'
  const isPending = !isPaid && !isFailed

  const headline = isPaid
    ? 'Payment Confirmed'
    : isFailed
    ? 'Payment Failed'
    : 'Payment Pending'

  const subline = isPaid
    ? 'Your payment is held securely in escrow. The seller will fulfil your order.'
    : isFailed
    ? 'Your payment could not be processed. Please try again or contact support.'
    : 'Your payment is being processed. Please wait a moment.'

  return (
    <div className="space-y-5">

      {/* ── Hero status block ── */}
      <div className={`relative overflow-hidden rounded-3xl px-6 py-10 text-center ${
        isPaid   ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-800/40'
        : isFailed ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border border-red-200/60 dark:border-red-800/40'
        : 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border border-amber-200/60 dark:border-amber-800/40'
      }`}>
        {/* Background pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative flex flex-col items-center gap-4">
          <StatusIcon status={data.status} />

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{headline}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">{subline}</p>
          </div>

          {isPaid && (
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-white/60 dark:bg-emerald-900/30 px-4 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Escrow Active</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Amount ── */}
      <div className="rounded-2xl border border-border bg-card px-6 py-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {isPaid ? 'Amount Paid' : 'Order Total'}
        </p>
        <p className="text-4xl font-extrabold tracking-tight text-foreground tabular-nums">
          {formatMoney(data.grandPrice)}
        </p>
        {isPaid && data.paidAt && (
          <p className="mt-2 text-xs text-muted-foreground">Paid on {formatDate(data.paidAt)}</p>
        )}
      </div>

      {/* ── Reference ID ── */}
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Transaction Reference
            </p>
            <p className="font-mono text-xs font-semibold text-foreground break-all">{data.refId}</p>
          </div>
          <CopyButton text={data.refId} />
        </div>
        {data.paidVia && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            Paid via {data.paidVia.charAt(0).toUpperCase() + data.paidVia.slice(1)}
          </div>
        )}
      </div>

      {/* ── Seller ── */}
      {data.sellerName && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Seller</p>
            <p className="truncate text-sm font-semibold text-foreground">{data.sellerName}</p>
          </div>
        </div>
      )}

      {/* ── Buyer info ── */}
      {(data.buyerName || data.buyerEmail || data.buyerPhone) && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
            <User className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buyer Details</p>
          </div>
          <div className="divide-y divide-border/60 px-5">
            {data.buyerName && (
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <User className="h-3 w-3" />Name
                </span>
                <span className="text-xs font-medium text-foreground text-right">{data.buyerName}</span>
              </div>
            )}
            {data.buyerEmail && (
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Mail className="h-3 w-3" />Email
                </span>
                <span className="text-xs font-medium text-foreground text-right break-all">{data.buyerEmail}</span>
              </div>
            )}
            {data.buyerPhone && (
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Phone className="h-3 w-3" />Phone
                </span>
                <span className="text-xs font-medium text-foreground text-right">{data.buyerPhone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Items ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
          <Package className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Items ({data.items.reduce((s, i) => s + i.quantity, 0)})
          </p>
        </div>
        <div className="divide-y divide-border/60">
          {data.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.quantity} × {formatMoney(item.price)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                {formatMoney(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing summary ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Order Summary</p>
        </div>
        <div className="divide-y divide-border/60 px-5">
          <Row label="Items Total"    value={formatMoney(data.itemsTotal)}  />
          <Row label="Shipping"       value={formatMoney(data.shippingFee)} />
          <Row label="Service Fee"    value={formatMoney(data.platformFee)} muted />
        </div>
        <div className="flex items-center justify-between px-5 py-4 bg-muted/20">
          <span className="font-bold text-sm text-foreground">Total Charged</span>
          <span className="font-extrabold text-base text-primary tabular-nums">{formatMoney(data.grandPrice)}</span>
        </div>
      </div>

      {/* ── Escrow info banner ── */}
      {isPaid && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 px-5 py-4 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <p className="font-semibold mb-1">🔒 Your funds are in escrow</p>
          Payment is held securely and released to the seller only after you confirm you've received your items.
          Head to your transactions page to track the order and confirm delivery.
        </div>
      )}

      {/* ── Actions ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 pb-4">
        <Link
          href={`/transactions/${data.refId}`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
        >
          View Transaction
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/transactions"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
        >
          All Transactions
        </Link>
      </div>

      {/* ── Print ── */}
      <div className="flex justify-center pb-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Save / Print Receipt
        </button>
      </div>
    </div>
  )
}

function Row({
  label, value, muted,
}: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className={`text-xs ${muted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs font-medium tabular-nums ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Root client component ──────────────────────────────────────────────────────
export function ReceiptClient({ initialData, refId }: ReceiptClientProps) {
  const [data,    setData]    = useState<ReceiptData | null>(initialData)
  const [loading, setLoading] = useState(!initialData && !!refId)
  const [error,   setError]   = useState<string | null>(null)

  // If SSR didn't return data (race condition — callback fires before webhook),
  // poll the API once a second until status resolves or 20 s elapses.
  useEffect(() => {
    if (data?.status === 'paid' || data?.status === 'failed') return
    if (!refId) return

    let attempts = 0
    const MAX    = 20

    const poll = async () => {
      attempts++
      try {
        const res  = await fetch(`/api/receipt?refId=${encodeURIComponent(refId)}`)
        const json = await res.json()
        if (json.success) {
          setData(json.data)
          setLoading(false)
          if (json.data.status === 'paid' || json.data.status === 'failed') return
        }
      } catch {
        // ignore — keep polling
      }
      if (attempts < MAX) setTimeout(poll, 1500)
      else setLoading(false)
    }

    if (!initialData) {
      setLoading(true)
      poll()
    } else if (initialData.status === 'pending') {
      // Already have data but still pending — keep polling silently
      setTimeout(poll, 2000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId])

  return (
    <div className="min-h-screen bg-background">
      {/* Print-only header */}
      <div className="hidden print:block print:mb-6 print:text-center">
        <p className="text-xl font-black">Umart</p>
        <p className="text-xs text-gray-500">umart.com.ng</p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 print:py-0 print:max-w-full">
        {loading && !data ? (
          <ReceiptSkeleton />
        ) : !refId || (!data && !loading) ? (
          <NotFound refId={refId} />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : data ? (
          <Receipt data={data} />
        ) : (
          <NotFound refId={refId} />
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          * { box-shadow: none !important; }
        }
      `}</style>
    </div>
  )
}

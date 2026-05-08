'use client'

import { Package, Clock, CheckCircle, ShoppingBag, TrendingUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Greeting } from './Greeting'
import { StatCard } from './stat-card'

interface Product {
  id: string
  title: string
  price: number
  status: string
  category: string
  images: string[]
  createdAt: string | null
}

interface Transaction {
  refId: string
  grandPrice: number
  sellerPayout: number
  status: string
  buyerName: string | null
  createdAt: string | null
}

interface CreatorData {
  displayName: string | null
  username: string | null
  email: string | null
  photoURL: string | null
  productsUploaded: number
  pending: number
  pendingPayments: number
  totalEscrowPaid: number
  totalEscrowPaidCount: number
  recentProducts: Product[]
  recentTransactions: Transaction[]
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const statusStyles: Record<string, string> = {
  active:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  paid:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sold:    'bg-muted text-muted-foreground',
}

export function DashboardContent({ data }: { data: CreatorData }) {
  return (
    <div className="space-y-8">
      {/* Greeting + clock */}
      <section className="rounded-xl border border-border bg-card px-6 py-5">
        <Greeting name={data.displayName} username={data.username} />
      </section>

      {/* Stat cards */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Products Listed"
            value={data.productsUploaded}
            sub="total active listings"
            icon={Package}
            accent="blue"
          />
          <StatCard
            label="Pending Escrow"
            value={formatCurrency(data.pending)}
            sub={`${data.pendingPayments} unpaid invoice${data.pendingPayments !== 1 ? 's' : ''}`}
            icon={Clock}
            accent="amber"
          />
          <StatCard
            label="Total Earned"
            value={formatCurrency(data.totalEscrowPaid)}
            sub="net seller payout received"
            icon={TrendingUp}
            accent="green"
          />
          <StatCard
            label="Completed Sales"
            value={data.totalEscrowPaidCount}
            sub="paid transactions"
            icon={CheckCircle}
            accent="green"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Products */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Listings</h2>
            </div>
            <Link
              href="/creator/products"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data.recentProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No products yet</p>
              <Link
                href="/creator/products/new"
                className="mt-3 text-xs text-primary hover:underline"
              >
                Create your first listing →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {p.images[0] ? (
                      <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 m-3 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                  </div>

                  {/* Price + status */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(p.price)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles[p.status] ?? statusStyles.sold}`}>
                      {p.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Sales</h2>
            </div>
            <Link
              href="/creator/transactions"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data.recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No sales yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentTransactions.map((tx) => (
                <li key={tx.refId} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors">
                  {/* Buyer avatar placeholder */}
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-semibold text-muted-foreground">
                    {tx.buyerName ? tx.buyerName[0].toUpperCase() : '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.buyerName ?? 'Anonymous buyer'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{tx.refId}</p>
                  </div>

                  {/* Payout + status */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(tx.sellerPayout)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles[tx.status] ?? statusStyles.sold}`}>
                      {tx.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
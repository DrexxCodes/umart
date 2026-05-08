'use client'

import { useState } from 'react'
import {
  Tag, MapPin, Layers, Wrench, Clock, Hash,
  User, Flag, Power, PowerOff, Loader2,
  CheckCircle2, AlertTriangle, Package, Info,
  FileText, ShieldAlert,
} from 'lucide-react'
import ProductImageGallery from './ProductImageGallery'

export interface ProductData {
  id:             string
  userId:         string
  title:          string
  category:       string
  brand:          string
  model?:         string
  location:       string
  price:          number
  condition:      string
  productAge:     { value: number; unit: string }
  description?:   string
  defects?:       string
  additionalInfo?: Record<string, unknown>
  images:         string[]
  status:         string
  flagged?:       boolean
  flaggedAt?:     string | null
  flaggedByAdmin?: string | null
  searchKeywords?: string[]
  createdAt?:     string
  updatedAt?:     string
}

interface ProductDetailProps {
  product:    ProductData
  onUpdated:  (patch: Partial<ProductData>) => void
}

type Action = 'flag' | 'unflag' | 'deactivate' | 'activate'

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ProductDetail({ product, onUpdated }: ProductDetailProps) {
  const [pending, setPending] = useState<Action | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function callAction(action: Action) {
    setPending(action)
    setError(null)
    try {
      const res  = await fetch('/api/admin/inventory', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ productId: product.id, action }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Action failed')

      // Optimistic patch
      if (action === 'flag')       onUpdated({ flagged: true,  flaggedAt: new Date().toISOString() })
      if (action === 'unflag')     onUpdated({ flagged: false, flaggedAt: null })
      if (action === 'deactivate') onUpdated({ status: 'inactive' })
      if (action === 'activate')   onUpdated({ status: 'active' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPending(null)
    }
  }

  const isActive  = product.status === 'active'
  const isFlagged = product.flagged === true
  const isLoading = (a: Action) => pending === a

  return (
    <div className="space-y-4">

      {/* ── Status strip ── */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          active={isActive}
          activeLabel="Active"
          inactiveLabel="Inactive"
          activeClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
          inactiveClass="bg-muted text-muted-foreground border-border"
        />
        {isFlagged && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Flag size={11} fill="currentColor" />
            Flagged
          </span>
        )}
        <span className="ml-auto font-mono text-lg font-bold text-foreground">
          {fmt(product.price)}
        </span>
      </div>

      {/* ── Images ── */}
      <ProductImageGallery images={product.images} title={product.title} />

      {/* ── Core info ── */}
      <InfoSection icon={Package} title="Product Info">
        <Row label="Title"     value={product.title}    />
        <Row label="Brand"     value={product.brand}    />
        {product.model && <Row label="Model" value={product.model} />}
        <Row label="Category"  value={product.category} />
        <Row label="Condition" value={product.condition} />
        <Row label="Age"       value={`${product.productAge.value} ${product.productAge.unit}`} />
        <Row label="Location"  value={product.location}  icon={<MapPin size={11} />} />
        <Row label="Price"     value={fmt(product.price)} mono />
      </InfoSection>

      {/* ── Description ── */}
      {product.description && (
        <InfoSection icon={FileText} title="Description">
          <p className="py-2 text-xs leading-relaxed text-foreground">{product.description}</p>
        </InfoSection>
      )}

      {/* ── Defects ── */}
      {product.defects && (
        <InfoSection icon={AlertTriangle} title="Defects / Known Issues">
          <p className="py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">{product.defects}</p>
        </InfoSection>
      )}

      {/* ── Additional info ── */}
      {product.additionalInfo && Object.keys(product.additionalInfo).length > 0 && (
        <InfoSection icon={Info} title="Additional Info">
          {Object.entries(product.additionalInfo).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </InfoSection>
      )}

      {/* ── Keywords ── */}
      {product.searchKeywords && product.searchKeywords.length > 0 && (
        <InfoSection icon={Tag} title="Search Keywords">
          <div className="flex flex-wrap gap-1.5 py-2">
            {product.searchKeywords.map((kw) => (
              <span key={kw} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {kw}
              </span>
            ))}
          </div>
        </InfoSection>
      )}

      {/* ── Metadata ── */}
      <InfoSection icon={Hash} title="Metadata">
        <Row label="Product ID" value={product.id}       mono />
        <Row label="Seller ID"  value={product.userId}   mono />
        <Row label="Created"    value={fmtDate(product.createdAt)} />
        <Row label="Updated"    value={fmtDate(product.updatedAt)} />
        {isFlagged && product.flaggedAt && (
          <Row label="Flagged At" value={fmtDate(product.flaggedAt)} />
        )}
      </InfoSection>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* ── Admin actions ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <ShieldAlert size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Actions</span>
        </div>
        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
          {/* Flag / Unflag */}
          <ActionButton
            onClick={() => callAction(isFlagged ? 'unflag' : 'flag')}
            loading={isLoading('flag') || isLoading('unflag')}
            icon={<Flag size={13} fill={isFlagged ? 'currentColor' : 'none'} />}
            label={isFlagged ? 'Unflag Product' : 'Flag Product'}
            variant={isFlagged ? 'amber-active' : 'amber'}
          />
          {/* Activate / Deactivate */}
          <ActionButton
            onClick={() => callAction(isActive ? 'deactivate' : 'activate')}
            loading={isLoading('deactivate') || isLoading('activate')}
            icon={isActive ? <PowerOff size={13} /> : <Power size={13} />}
            label={isActive ? 'Deactivate Listing' : 'Activate Listing'}
            variant={isActive ? 'destructive' : 'success'}
          />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoSection({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <Icon size={12} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

function Row({
  label, value, mono = false, icon,
}: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </span>
      <span className={`text-right text-xs text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function StatusBadge({ active, activeLabel, inactiveLabel, activeClass, inactiveClass }: {
  active: boolean; activeLabel: string; inactiveLabel: string; activeClass: string; inactiveClass: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${active ? activeClass : inactiveClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

function ActionButton({ onClick, loading, icon, label, variant }: {
  onClick: () => void; loading: boolean; icon: React.ReactNode; label: string
  variant: 'amber' | 'amber-active' | 'destructive' | 'success'
}) {
  const cls = {
    'amber':        'border-amber-500/25 bg-amber-500/8  text-amber-600 dark:text-amber-400 hover:bg-amber-500/15',
    'amber-active': 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25',
    'destructive':  'border-destructive/25 bg-destructive/8 text-destructive hover:bg-destructive/15',
    'success':      'border-emerald-500/25 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15',
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all disabled:opacity-50 ${cls}`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}
'use client'

import { useState } from 'react'
import {
  CheckCircle2, XCircle, Clock, Package, User, ShoppingCart,
  Banknote, Receipt, Truck, Trash2, ShieldCheck,
  ChevronDown, ChevronUp, ArrowDownToLine, Flag,
} from 'lucide-react'

export interface ReferenceData {
  id:                   string
  refId:                string
  buyerId:              string
  sellerId:             string
  buyerName?:           string | null
  buyerEmail?:          string | null
  buyerPhone?:          string | null
  items:                { productId: string; productName: string; quantity: number; price: number }[]
  itemsTotal:           number
  shippingFee:          number
  platformFee:          number
  grandPrice:           number
  sellerPayout:         number
  buyerBearsBurden:     boolean
  status:               string
  valueReceived:        boolean
  valueReceivedAt?:     string | null
  valueReceivedByAdmin?: string | null
  withdrawn:            boolean
  flagged:              boolean
  flaggedAt?:           string | null
  flaggedByAdmin?:      string | null
  createdAt:            string
  updatedAt:            string
}

interface ReferenceCardProps {
  data:               ReferenceData
  onConfirmValue:     () => Promise<void>
  onFlagTransaction:  () => Promise<void>
  onDelete:           () => void
}

function fmt(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    paid:    { label: 'Paid',    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' },
    pending: { label: 'Pending', cls: 'bg-primary/10 text-primary border-primary/25',                                   dot: 'bg-primary'    },
    failed:  { label: 'Failed',  cls: 'bg-destructive/10 text-destructive border-destructive/25',                       dot: 'bg-destructive'},
  }
  const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {s.label}
    </span>
  )
}

function BoolPill({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return value
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5"/>{trueLabel}</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><XCircle className="w-3.5 h-3.5"/>{falseLabel}</span>
}

function MetaRow({ label, value, mono=false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground shrink-0 pt-0.5 w-36">{label}</span>
      <span className={`text-xs text-foreground text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0"/>
        <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

export function ReferenceCard({ data, onConfirmValue, onFlagTransaction, onDelete }: ReferenceCardProps) {
  const [confirmingValue, setConfirmingValue] = useState(false)
  const [flagging,        setFlagging]        = useState(false)
  const [itemsExpanded,   setItemsExpanded]   = useState(true)

  const handleConfirmValue = async () => {
    setConfirmingValue(true)
    try { await onConfirmValue() } finally { setConfirmingValue(false) }
  }

  const handleFlagTransaction = async () => {
    setFlagging(true)
    try { await onFlagTransaction() } finally { setFlagging(false) }
  }

  return (
    <div className="space-y-4">

      {/* Header strip */}
      <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-foreground tracking-tight">{data.refId ?? data.id}</span>
            <StatusBadge status={data.status}/>
          </div>
          <p className="text-[0.65rem] font-mono text-muted-foreground mt-1">
            Created {fmtDate(data.createdAt)} · Updated {fmtDate(data.updatedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-mono text-xl font-bold text-foreground">{fmt(data.grandPrice)}</span>
          <span className="text-[0.65rem] text-muted-foreground font-mono">grand total</span>
        </div>
      </div>

      {/* Status flags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { icon: Banknote,       label: 'Payment',        content: <BoolPill value={data.status==='paid'} trueLabel="Paid" falseLabel="Awaiting payment"/> },
          { icon: CheckCircle2,   label: 'Value Confirmed', content: data.valueReceived
              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5"/>Confirmed{data.valueReceivedAt ? ` · ${fmtDate(data.valueReceivedAt)}` : ''}</span>
              : <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock className="w-3.5 h-3.5"/>Not yet confirmed</span> },
          { icon: ArrowDownToLine, label: 'Withdrawal',    content: <BoolPill value={data.withdrawn} trueLabel="Withdrawn" falseLabel="Not withdrawn"/> },
          { icon: Flag, label: 'Flagged', content: data.flagged
              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Flag className="w-3.5 h-3.5" fill="currentColor"/>Flagged{data.flaggedAt ? ` · ${fmtDate(data.flaggedAt)}` : ''}</span>
              : <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Flag className="w-3.5 h-3.5"/>Not flagged</span> },
        ].map(({ icon: Icon, label, content }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-3.5 py-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary"/>
            </div>
            <div>
              <p className="text-[0.6rem] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-0.5">{label}</p>
              {content}
            </div>
          </div>
        ))}
      </div>

      {/* People */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Section icon={ShoppingCart} title="Buyer">
          <MetaRow label="User ID"  value={data.buyerId}          mono/>
          <MetaRow label="Name"     value={data.buyerName  ?? '—'}/>
          <MetaRow label="Email"    value={data.buyerEmail ?? '—'} mono/>
          <MetaRow label="Phone"    value={data.buyerPhone ?? '—'} mono/>
          <MetaRow label="Pays fee" value={<BoolPill value={data.buyerBearsBurden} trueLabel="Yes" falseLabel="No"/>}/>
        </Section>
        <Section icon={User} title="Seller">
          <MetaRow label="User ID"       value={data.sellerId}       mono/>
          <MetaRow label="Seller Payout" value={fmt(data.sellerPayout)} mono/>
        </Section>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button onClick={()=>setItemsExpanded(e=>!e)}
          className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40 hover:bg-muted/70 transition-colors">
          <Package className="w-3.5 h-3.5 text-primary shrink-0"/>
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground flex-1 text-left">
            Items ({data.items.length})
          </span>
          {itemsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground"/> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground"/>}
        </button>
        {itemsExpanded && (
          <div className="divide-y divide-border/60">
            {data.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                  <span className="text-[0.6rem] font-mono font-bold text-muted-foreground">{item.quantity}×</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.productName}</p>
                  <p className="text-[0.65rem] font-mono text-muted-foreground">{item.productId}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono font-semibold text-foreground">{fmt(item.price * item.quantity)}</p>
                  <p className="text-[0.65rem] font-mono text-muted-foreground">{fmt(item.price)} each</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financials */}
      <Section icon={Receipt} title="Financials">
        <MetaRow label="Items Total"   value={fmt(data.itemsTotal)}  mono/>
        <MetaRow label="Shipping Fee"  value={fmt(data.shippingFee)} mono/>
        <MetaRow label="Platform Fee"  value={fmt(data.platformFee)} mono/>
        <MetaRow label="Grand Total"   value={<span className="font-bold text-foreground">{fmt(data.grandPrice)}</span>} mono/>
        <MetaRow label="Seller Payout" value={fmt(data.sellerPayout)} mono/>
        <MetaRow label="Fee Bearer"    value={data.buyerBearsBurden ? 'Buyer' : 'Seller'}/>
      </Section>

      {/* Admin actions */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0"/>
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Admin Actions</span>
        </div>
        <div className="px-4 py-4 space-y-3">

          {!data.valueReceived ? (
            <div className="flex items-center justify-between gap-4 py-2 border border-border rounded-lg px-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Confirm Value Received</p>
                <p className="text-[0.65rem] text-muted-foreground mt-0.5">
                  Mark that the buyer has confirmed receiving the goods or service.
                </p>
              </div>
              <button onClick={handleConfirmValue} disabled={confirmingValue}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                  bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25
                  hover:bg-emerald-500/20 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle2 className="w-3.5 h-3.5"/>
                {confirmingValue ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"/>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Value confirmed{data.valueReceivedAt ? ` on ${fmtDate(data.valueReceivedAt)}` : ''}
              </p>
            </div>
          )}

          {/* Flag transaction */}
          <div className="flex items-center justify-between gap-4 py-2 border border-border rounded-lg px-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Flag Transaction</p>
              <p className="text-[0.65rem] text-muted-foreground mt-0.5">
                {data.flagged
                  ? `Flagged${data.flaggedAt ? ` · ${fmtDate(data.flaggedAt)}` : ''} — click to unflag`
                  : 'Mark this transaction as suspicious or requiring review.'}
              </p>
            </div>
            <button
              onClick={handleFlagTransaction}
              disabled={flagging}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                data.flagged
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/20'
              }`}
            >
              <Flag className="w-3.5 h-3.5" fill={data.flagged ? 'currentColor' : 'none'} />
              {flagging ? 'Updating…' : data.flagged ? 'Unflag' : 'Flag'}
            </button>
          </div>

          <div className="border-t border-border pt-3 mt-1">
            <button onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                bg-destructive/10 text-destructive border border-destructive/20
                hover:bg-destructive/20 transition-all w-full sm:w-auto">
              <Trash2 className="w-3.5 h-3.5"/>
              Delete Reference
            </button>
            <p className="text-[0.6rem] text-muted-foreground/60 mt-1.5 px-0.5">
              This action cannot be undone. The reference will be archived and removed from both user records.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
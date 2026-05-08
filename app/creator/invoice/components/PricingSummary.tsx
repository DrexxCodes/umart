'use client'

import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ShieldCheck } from 'lucide-react'

interface InvoiceItem {
  productId: string
  quantity: number
  price: number
}

interface PricingSummaryProps {
  items: InvoiceItem[]
  shippingFee: number
  onShippingFeeChange: (fee: number) => void
  buyerBearsBurden: boolean
  onBurdenChange: (buyerBears: boolean) => void
  buyerName: string | null
}

const PLATFORM_FEE_PERCENTAGE = 0.05
const PLATFORM_FEE_BASE = 300

export function PricingSummary({
  items,
  shippingFee,
  onShippingFeeChange,
  buyerBearsBurden,
  onBurdenChange,
  buyerName,
}: PricingSummaryProps) {
  const itemsTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const platformFee = Math.round((itemsTotal * PLATFORM_FEE_PERCENTAGE + PLATFORM_FEE_BASE) * 100) / 100

  // What the buyer actually pays depends on who bears the burden
  const grandTotal = buyerBearsBurden
    ? itemsTotal + shippingFee + platformFee  // buyer pays fee on top
    : itemsTotal + shippingFee                 // buyer pays clean price

  // What the seller actually receives after platform takes its cut
  const sellerPayout = buyerBearsBurden
    ? itemsTotal + shippingFee                 // fee already paid by buyer, seller gets full
    : itemsTotal + shippingFee - platformFee   // fee deducted from seller's payout

  const buyer = buyerName || 'the buyer'

  return (
    <div className="space-y-6">
      {/* Shipping Fee */}
      <div>
        <label className="text-sm font-medium block mb-2">Shipping Fee (₦)</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={shippingFee}
          onChange={(e) => onShippingFeeChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
        />
      </div>

      {/* Burden of Fee Toggle */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            You may decide who pays the{' '}
            <span className="font-semibold text-foreground">
              ₦{platformFee.toLocaleString()}
            </span>{' '}
            platform fee for this transaction —{' '}
            <span className="font-semibold text-foreground">you</span> or{' '}
            <span className="font-semibold text-foreground">{buyer}</span>.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              {buyerBearsBurden ? `${buyer} pays the fee` : 'You pay the fee'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {buyerBearsBurden
                ? `Fee is added to ${buyer}'s total`
                : 'Fee is deducted from your payout'}
            </p>
          </div>
          <Switch
            checked={buyerBearsBurden}
            onCheckedChange={onBurdenChange}
          />
        </div>
      </div>

      {/* Pricing Breakdown */}
      <Card className="p-4 bg-muted/50">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Items Total</span>
            <span className="font-medium">₦{itemsTotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping Fee</span>
            <span className="font-medium">₦{shippingFee.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Platform Fee (5% + ₦300)
              {!buyerBearsBurden && (
                <span className="ml-1 text-xs text-yellow-600">(deducted from your payout)</span>
              )}
            </span>
            <span className="font-medium">₦{platformFee.toLocaleString()}</span>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold text-sm">{buyer} pays</span>
              <span className="font-bold text-lg text-primary">
                ₦{grandTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your payout</span>
              <span className={`font-medium ${sellerPayout < 0 ? 'text-destructive' : 'text-green-600'}`}>
                ₦{sellerPayout.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
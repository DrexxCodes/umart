'use client'

import { Loader2, MessageCircle, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onContactSeller: () => void
  onReport: () => void
  contactingLoading: boolean
  isOwner: boolean
  contactError?: string | null
}

export function ActionButtons({ onContactSeller, onReport, contactingLoading, isOwner, contactError }: Props) {
  return (
    <div className="space-y-3">
      {/* Contact Seller */}
      <Button
        className="w-full h-12 text-base font-semibold rounded-xl gap-2"
        onClick={onContactSeller}
        disabled={contactingLoading || isOwner}
      >
        {contactingLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <MessageCircle className="w-5 h-5" />
            {isOwner ? 'This is your listing' : 'Contact Seller'}
          </>
        )}
      </Button>

      {/* Error message (e.g. flagged product) */}
      {contactError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5">
          <Flag className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive leading-snug">{contactError}</p>
        </div>
      )}

      {/* Report */}
      {!isOwner && (
        <button
          onClick={onReport}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors py-2"
        >
          <Flag className="w-3.5 h-3.5" />
          Report this listing
        </button>
      )}
    </div>
  )
}
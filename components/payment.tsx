'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CREDO_PUBLIC_KEY } from '@/lib/credo'
import type { CredoResponse } from '@/types/global'

export interface PaymentButtonProps {
  refId: string
  grandPrice: number
  buyerEmail: string
  buyerName: string
  buyerPhone?: string
  disabled?: boolean
  className?: string
  label?: string
  onSuccess?: () => void
  onClose?: () => void
  onMounting?: () => void  // fires just before openIframe()
}

type LoadingState = 'idle' | 'starting' | 'open'

export function PaymentButton({
  refId,
  grandPrice,
  buyerEmail,
  buyerName,
  buyerPhone,
  disabled = false,
  className,
  label = 'Pay Now',
  onSuccess,
  onClose,
  onMounting,
}: PaymentButtonProps) {
  const router = useRouter()
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')

  const isLoading = loadingState !== 'idle'

  const loadingLabel =
    loadingState === 'starting' ? 'Starting Transaction...' : 'Opening payment...'

  const handlePay = () => {
    setLoadingState('starting')

    // If CredoWidget is already on the window object, open directly
    if (typeof window.CredoWidget !== 'undefined') {
      initCredo()
      return
    }

    // If the script tag is already in the DOM but CredoWidget isn't ready yet
    // (e.g. second click while script is still loading), poll until it's ready
    if (document.getElementById('credo-inline')) {
      const interval = setInterval(() => {
        if (typeof window.CredoWidget !== 'undefined') {
          clearInterval(interval)
          initCredo()
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.id = 'credo-inline'
    script.src = 'https://pay.credocentral.com/inline.js'  // correct CDN URL
    script.onload = () => initCredo()
    script.onerror = () => {
      toast.error('Failed to load payment provider. Please try again.')
      setLoadingState('idle')
    }
    document.body.appendChild(script)
  }

  const initCredo = () => {
    if (typeof window.CredoWidget === 'undefined') {
      toast.error('Payment provider unavailable. Please refresh and try again.')
      setLoadingState('idle')
      return
    }

    // Split buyerName into first/last as Credo's widget expects separate fields
    const nameParts = (buyerName || '').trim().split(/\s+/)
    const customerFirstName = nameParts[0] || ''
    const customerLastName  = nameParts.slice(1).join(' ') || ''

    const handler = window.CredoWidget.setup({
      key:                 CREDO_PUBLIC_KEY,
      email:               buyerEmail,
      amount:              grandPrice * 100,  // kobo
      currency:            'NGN',
      reference:           refId,
      customerFirstName,
      customerLastName,
      customerPhoneNumber: buyerPhone || '',
      onSuccess: (response: CredoResponse) => {
        setLoadingState('idle')
        if (response.status === 'APPROVED') {
          toast.success('Payment successful! Redirecting...')
          onSuccess?.()
          router.push(`/success?refId=${response.reference}`)
        } else {
          toast.error('Payment was not completed. Please try again.')
        }
      },
      onClose: () => {
        setLoadingState('idle')
        onClose?.()
      },
    })

    // Fire onMounting BEFORE openIframe so the parent can close any dialog.
    // Then defer openIframe by one tick — React's state update from onMounting
    // (e.g. setPayDialogOpen(false)) must be committed to the DOM before Credo
    // mounts its overlay, otherwise the iframe either gets clipped by the dialog
    // or gets torn down when React removes the dialog in the same paint cycle.
    onMounting?.()
    setLoadingState('open')
    setTimeout(() => {
      handler.openIframe()
    }, 50)
  }
 
  return (
    <Button
      onClick={handlePay}
      disabled={disabled || isLoading}
      className={className}
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  )
}
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CREDO_PUBLIC_KEY } from '@/lib/credo-public'
import type { CredoResponse } from '@/types/global'
import { auth } from '@/lib/firebase'

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
  onMounting?: () => void
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

    if (typeof window.CredoWidget !== 'undefined') {
      initCredo()
      return
    }

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
    script.src = 'https://pay.credocentral.com/inline.js'
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

    const nameParts = (buyerName || '').trim().split(/\s+/)
    const customerFirstName = nameParts[0] || ''
    const customerLastName  = nameParts.slice(1).join(' ') || ''

    const handler = window.CredoWidget.setup({
      key:                 CREDO_PUBLIC_KEY,
      email:               buyerEmail,
      amount:              grandPrice * 100,
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

// ── AlreadyPaid button ────────────────────────────────────────────────────────
// Drop this next to any Pay Now button. It checks Credo for the real status
// and updates Firestore via /api/payment/status if the payment went through.

export interface AlreadyPaidProps {
  refId: string
  onConfirmed?: () => void   // called when Credo confirms the payment as paid
  onFailed?: () => void      // called when Credo reports the payment as failed
}

type CheckState = 'idle' | 'checking' | 'done'

export function AlreadyPaid({ refId, onConfirmed, onFailed }: AlreadyPaidProps) {
  const [state, setState] = useState<CheckState>('idle')
  const [message, setMessage] = useState('')

  const handleCheck = async () => {
    try {
      setState('checking')
      setMessage('')

      const user = auth.currentUser
      if (!user) {
        setMessage('You must be signed in.')
        setState('idle')
        return
      }

      const token = await user.getIdToken()
      const res = await fetch(`/api/payment/status?refId=${encodeURIComponent(refId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()

      if (!result.success) {
        setMessage(result.error || 'Could not check payment status.')
        setState('done')
        return
      }

    if (result.data.status === 'paid') {
      setMessage('Payment confirmed! Updating...')
      onConfirmed?.()
    } else if (result.data.status === 'failed') {
      setMessage('Payment not completed.')
      onFailed?.()
    } else if (result.data.status === 'not_found') {
      setMessage('No payment attempt found. Please use Pay Now.')
    } else {
      setMessage('Payment still pending. Try again in a moment.')
    }

      setState('done')
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong.')
      setState('done')
    }
  }

  if (state === 'checking') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking transaction…
      </span>
    )
  }

  if (state === 'done' && message) {
    return (
      <span className="text-xs text-muted-foreground">{message}</span>
    )
  }

  return (
    <button
      onClick={handleCheck}
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
    >
      Already paid?
    </button>
  )
}

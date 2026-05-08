'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PaystackResponse } from '@/types/global'

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

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || ''

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
  const [loading, setLoading] = useState(false)

  const handlePay = () => {
    setLoading(true)

    if (typeof window.PaystackPop !== 'undefined') {
      initPaystack()
      return
    }

    const script = document.createElement('script')
    script.id = 'paystack-inline'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => initPaystack()
    script.onerror = () => {
      toast.error('Failed to load payment provider. Please try again.')
      setLoading(false)
    }
    document.body.appendChild(script)
  }

  const initPaystack = () => {
    if (typeof window.PaystackPop === 'undefined') {
      toast.error('Payment provider unavailable. Please refresh and try again.')
      setLoading(false)
      return
    }

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: buyerEmail,
      amount: grandPrice * 100,
      currency: 'NGN',
      ref: refId,
      metadata: {
        custom_fields: [
          { display_name: 'Name', variable_name: 'name', value: buyerName },
          { display_name: 'Phone', variable_name: 'phone', value: buyerPhone || '' },
        ],
      },
      callback: (response: PaystackResponse) => {
        setLoading(false)
        if (response.status === 'success') {
          toast.success('Payment successful! Redirecting...')
          onSuccess?.()
          router.push(`/success?refId=${response.reference}`)
        } else {
          toast.error('Payment was not completed. Please try again.')
        }
      },
      onClose: () => {
        setLoading(false)
        onClose?.()
      },
    })

    // Fire onMounting BEFORE openIframe so the parent can close the dialog
    // before the Paystack overlay renders on top
    onMounting?.()
    handler.openIframe()
  }

  return (
    <Button
      onClick={handlePay}
      disabled={disabled || loading}
      className={className}
      size="lg"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Opening payment...
        </>
      ) : (
        label
      )}
    </Button>
  )
}
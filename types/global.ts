// types/global.ts

// ── Paystack ───────────────────────────────────────────────────────────────────

export interface PaystackResponse {
  reference: string
  status: string
  message: string
  data: {
    id: number
    reference: string
    amount: number
    paid_at: string
    customer: {
      email: string
    }
  }
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => {
        openIframe: () => void
      }
    }
  }
}

interface PaystackConfig {
  key: string
  email: string
  amount: number
  ref: string
  currency?: string
  metadata?: {
    custom_fields?: Array<{
      display_name: string
      variable_name: string
      value: string
    }>
    [key: string]: unknown
  }
  onClose: () => void
  onSuccess?: (response: PaystackResponse) => void  // backwards compat
  callback?: (response: PaystackResponse) => void   // Paystack inline v1 name
}

// ── Credo ──────────────────────────────────────────────────────────────────────

export interface CredoResponse {
  reference: string
  status: string    // "APPROVED" | "DECLINED" | "PENDING"
  message: string
  data: {
    id: number
    reference: string
    amount: number   // in kobo
    paidAt: string | null
    channel: string  // "card" | "bank_transfer" etc.
    currency: string
    customer: {
      email: string
      name: string | null
      phoneNumber: string | null
    }
  }
}

declare global {
  interface Window {
    CredoWidget: {
      setup: (config: CredoConfig) => {
        openIframe: () => void
      }
    }
  }
}

interface CredoConfig {
  key: string                  // NEXT_PUBLIC_CREDO_PUBLIC_KEY
  email: string
  amount: number               // in kobo (NGN × 100)
  reference: string
  currency?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhoneNumber?: string
  metadata?: Record<string, unknown>
  onSuccess: (response: CredoResponse) => void
  onClose: () => void
}

export {}
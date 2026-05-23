// Credo utility — server-side only
// All functions call the Credo REST API using the secret key from env.
// Credo is used for payment initiation (charge). Paystack handles payouts/refunds.

import crypto from 'crypto'

const CREDO_SECRET_KEY = process.env.CREDO_SECRET_KEY || ''
const BASE_URL = 'https://api.credocentral.com'

// Public key is read client-side via NEXT_PUBLIC_ — exported so the payment
// component can import it from one place rather than reading process.env directly.
export const CREDO_PUBLIC_KEY = process.env.NEXT_PUBLIC_CREDO_PUBLIC_KEY || ''

function headers() {
  return {
    Authorization: CREDO_SECRET_KEY, // Credo uses bare key, NOT "Bearer <key>"
    'Content-Type': 'application/json',
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CredoInitResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

export interface CredoTransactionData {
  id: number
  reference: string
  amount: number          // in kobo
  status: string          // "APPROVED" | "DECLINED" | "PENDING" etc.
  paidAt: string | null
  channel: string         // "card" | "bank_transfer" etc.
  currency: string
  transactionDate: string
  customer: {
    email: string
    name: string | null
    phoneNumber: string | null
  }
  metadata: Record<string, unknown> | null
}

export interface CredoVerifyResult {
  status: boolean
  message: string
  data: CredoTransactionData
}

// ── Initialise a transaction ───────────────────────────────────────────────────
// Returns the authorization URL to redirect or open in Credo's inline popup.
export async function initializeCredoTransaction(params: {
  email: string
  amount: number       // in kobo (NGN × 100)
  reference: string
  callbackUrl?: string
  currency?: string
  metadata?: Record<string, unknown>
}): Promise<CredoInitResult> {
  const res = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email:       params.email,
      amount:      params.amount,
      reference:   params.reference,
      callbackUrl: params.callbackUrl,
      currency:    params.currency ?? 'NGN',
      ...(params.metadata ? { metadata: params.metadata } : {}),
    }),
  })

  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Credo transaction initialization failed')

  return {
    authorizationUrl: data.data.authorizationUrl,
    accessCode:       data.data.accessCode,
    reference:        data.data.reference,
  }
}

// ── Verify a transaction by reference ─────────────────────────────────────────
export async function verifyCredoTransaction(reference: string): Promise<CredoVerifyResult> {
  const res = await fetch(`${BASE_URL}/transaction/${encodeURIComponent(reference)}/verify`, {
    headers: headers(),
  })

  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Credo transaction verification failed')

  return data as CredoVerifyResult
}

// ── Fetch a transaction by ID ──────────────────────────────────────────────────
export async function fetchCredoTransaction(transactionId: string | number) {
  const res = await fetch(`${BASE_URL}/transaction/${transactionId}`, {
    headers: headers(),
  })

  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Failed to fetch Credo transaction')

  return data.data as CredoTransactionData
}

// ── Verify webhook signature ───────────────────────────────────────────────────
// Credo signs webhook payloads with HMAC-SHA512 using the secret key.
// The signature arrives in the "x-credo-signature" request header.
export function verifyCredoWebhookSignature(rawBody: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', CREDO_SECRET_KEY)
    .update(rawBody)
    .digest('hex')
  return hash === signature
}

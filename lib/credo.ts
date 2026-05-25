// lib/credo.ts — Credo utility (server-side only)
//
// Covers: transaction init, verify, fetch, and webhook signature verification.
// Credo is used for payment initiation (charge). Paystack handles payouts/refunds.
//
// ⚠️  Do NOT import CREDO_PUBLIC_KEY from this file in client components.
//     Import from lib/credo-public.ts instead.

import crypto from 'crypto'

const BASE_URL = 'https://api.credocentral.com'

// ── Env helpers — read lazily so missing vars throw at call-time, not build-time ──

function getSecretKey(): string {
  const key = process.env.CREDO_SECRET_KEY
  if (!key) throw new Error('CREDO_SECRET_KEY env var is not set')
  return key
}

function getWebhookToken(): string {
  const token = process.env.CREDO_WEBHOOK_TOKEN
  if (!token) throw new Error('CREDO_WEBHOOK_TOKEN env var is not set')
  return token
}

function getBusinessCode(): string {
  const code = process.env.CREDO_BUSINESS_CODE
  if (!code) throw new Error('CREDO_BUSINESS_CODE env var is not set')
  return code
}

function headers(): Record<string, string> {
  return {
    Authorization: getSecretKey(), // Credo uses a bare key, NOT "Bearer <key>"
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
  amount: number        // in kobo
  status: string        // "APPROVED" | "DECLINED" | "PENDING" etc.
  paidAt: string | null
  channel: string       // "card" | "bank_transfer" etc.
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

export async function initializeCredoTransaction(params: {
  email: string
  amount: number
  reference: string
  callbackUrl?: string
  currency?: string
  metadata?: Record<string, unknown>
}): Promise<CredoInitResult> {
  const res = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      currency: params.currency ?? 'NGN',
      ...(params.metadata ? { metadata: params.metadata } : {}),
    }),
  })

  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Credo transaction initialization failed')

  return {
    authorizationUrl: data.data.authorizationUrl,
    accessCode: data.data.accessCode,
    reference: data.data.reference,
  }
}

// ── Verify a transaction by reference ─────────────────────────────────────────

export async function verifyCredoTransaction(reference: string): Promise<CredoVerifyResult> {
  const res = await fetch(`${BASE_URL}/transaction/${encodeURIComponent(reference)}/verify`, {
    headers: headers(),
  })

  const rawText = await res.text()

  // Log the FULL response so we can spot the business code cos idk why they won't show it
  console.log('[credo/verify] raw response for', reference, ':', rawText)

  let data: any
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(`Credo verify returned non-JSON: ${rawText.slice(0, 200)}`)
  }

  if (!data.status) throw new Error(data.message || 'Credo transaction verification failed')

  return data as CredoVerifyResult
}

// ── Fetch a transaction by ID ──────────────────────────────────────────────────

export async function fetchCredoTransaction(transactionId: string | number): Promise<CredoTransactionData> {
  const res = await fetch(`${BASE_URL}/transaction/${transactionId}`, {
    headers: headers(),
  })

  const rawText = await res.text()
  console.log('[credo/fetch] raw response for id', transactionId, ':', rawText)

  let data: any
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(`Credo fetch returned non-JSON: ${rawText.slice(0, 200)}`)
  }

  if (!data.status) throw new Error(data.message || 'Failed to fetch Credo transaction')

  return data.data as CredoTransactionData
}

// ── Verify webhook signature ───────────────────────────────────────────────────
//
// Credo signs webhooks as SHA512(webhookToken + businessCode).
// This is a STATIC signature — it does NOT change per request body.
// The token is the secret set in Credo dashboard → Settings → Webhooks.
// The business code is our Credo-assigned ID, also in Settings.
//
// These are separate from the API secret key.

export function verifyCredoWebhookSignature(signature: string): boolean {
  const expected = crypto
    .createHash('sha512')
    .update(getWebhookToken() + getBusinessCode())
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf   = Buffer.from(signature,  'hex')
    if (expectedBuf.length !== actualBuf.length) return false
    return crypto.timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}

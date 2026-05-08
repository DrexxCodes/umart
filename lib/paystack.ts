// Paystack utility — server-side only
// All functions call the Paystack REST API using the secret key from env.

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || ''
const BASE_URL = 'https://api.paystack.co'

function headers() {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json',
  }
}

export interface PaystackBank {
  id: number
  name: string
  code: string
  type: string
}

export interface RecipientCreateResult {
  recipient_code: string
  id: number
}

export interface TransferResult {
  transfer_code: string
  id: number
  status: string
}

// ── Verify a transaction by reference ─────────────────────────────────────────
export async function verifyTransaction(reference: string) {
  const res = await fetch(`${BASE_URL}/transaction/verify/${reference}`, {
    headers: headers(),
  })
  return res.json()
}

// ── List banks ────────────────────────────────────────────────────────────────
export async function listBanks(): Promise<PaystackBank[]> {
  const res = await fetch(`${BASE_URL}/bank?country=nigeria&perPage=100`, {
    headers: headers(),
  })
  const data = await res.json()
  return data.data ?? []
}

// ── Resolve account number ────────────────────────────────────────────────────
export async function resolveAccount(accountNumber: string, bankCode: string) {
  const res = await fetch(
    `${BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    { headers: headers() }
  )
  return res.json()
}

// ── Create transfer recipient ─────────────────────────────────────────────────
export async function createRecipient(params: {
  name: string
  accountNumber: string
  bankCode: string
  currency?: string
}): Promise<RecipientCreateResult> {
  const res = await fetch(`${BASE_URL}/transferrecipient`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'nuban',
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: params.currency ?? 'NGN',
    }),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Failed to create transfer recipient')
  return data.data
}

// ── Initiate transfer ─────────────────────────────────────────────────────────
export async function initiateTransfer(params: {
  recipientCode: string
  amount: number          // in kobo (multiply NGN by 100)
  reference: string
  reason?: string
}): Promise<TransferResult> {
  const res = await fetch(`${BASE_URL}/transfer`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      source: 'balance',
      recipient: params.recipientCode,
      amount: params.amount,
      reference: params.reference,
      reason: params.reason ?? 'Umart seller payout',
    }),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Transfer initiation failed')
  return data.data
}

// ── Refund (Paystack uses "refund" endpoint) ──────────────────────────────────
export async function createRefund(params: {
  transaction: string   // Paystack transaction ID or reference
  amount?: number       // partial refund in kobo; omit for full refund
  reason?: string
}) {
  const res = await fetch(`${BASE_URL}/refund`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      transaction: params.transaction,
      ...(params.amount ? { amount: params.amount } : {}),
      ...(params.reason ? { merchant_note: params.reason } : {}),
    }),
  })
  return res.json()
}

// ── Verify webhook signature ──────────────────────────────────────────────────
import crypto from 'crypto'

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex')
  return hash === signature
}

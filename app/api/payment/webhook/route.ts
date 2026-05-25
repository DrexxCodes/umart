import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyWebhookSignature } from '@/lib/paystack'
import { verifyCredoWebhookSignature } from '@/lib/credo'

async function getRawBody(req: NextRequest): Promise<{ buf: Buffer; text: string }> {
  const chunks: Uint8Array[] = []
  const reader = req.body?.getReader()
  if (!reader) return { buf: Buffer.alloc(0), text: '' }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }

  const buf = Buffer.concat(chunks)
  return { buf, text: buf.toString('utf8') }
}

// ── Entry — detect Credo vs Paystack by their signature headers ───────────────

export async function POST(req: NextRequest) {
  const { text } = await getRawBody(req)

  const paystackSig = req.headers.get('x-paystack-signature') || ''
  const credoSig    = req.headers.get('x-credo-signature')    || ''

  // ── Credo event ──────────────────────────────────────────────────────────

  if (credoSig) {
    try {
      if (!verifyCredoWebhookSignature(credoSig)) {
        console.warn('[webhook] Invalid Credo signature — rejected')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      const event = JSON.parse(text)

      if (event.event === 'transaction.successful' || event.event === 'charge.success') {
        await handleCredoChargeSuccess(event.data)
      }

      return NextResponse.json({ received: true }, { status: 200 })
    } catch (error: unknown) {
      console.error('[webhook/credo] Unhandled error:', error)
      // Return 500 so Credo retries delivery — do NOT swallow with 200
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // ── Paystack event ───────────────────────────────────────────────────────

  if (paystackSig) {
    try {
      if (!verifyWebhookSignature(text, paystackSig)) {
        console.warn('[webhook] Invalid Paystack signature — rejected')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      const event = JSON.parse(text)

      if (event.event === 'transfer.success') {
        await handleTransferSuccess(event.data)
      } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
        await handleTransferFailed(event.data, event.event)
      }

      // NOTE: charge.success from Paystack is intentionally ignored.
      // All payment initiations are now through Credo.

      return NextResponse.json({ received: true }, { status: 200 })
    } catch (error: unknown) {
      console.error('[webhook/paystack] Unhandled error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // No recognisable signature header
  console.warn('[webhook] Request has neither Paystack nor Credo signature header')
  return NextResponse.json({ error: 'Unknown webhook source' }, { status: 400 })
}

// ── Credo: charge / transaction success ───────────────────────────────────────

async function handleCredoChargeSuccess(data: Record<string, unknown>) {
  const refId     = data.reference as string
  const amountPaid = (data.amount as number) / 100 // kobo → naira

  const refDoc = await adminDb.collection('references').doc(refId).get()

  if (!refDoc.exists) {
    console.error(`[webhook/credo] Reference not found: ${refId}`)
    return
  }

  const refData = refDoc.data()!

  // Idempotency guard — safe to retry
  if (refData.status === 'paid') {
    console.log(`[webhook/credo] ${refId} already paid — skipping`)
    return
  }

  const sellerId: string  = refData.sellerId

  // Read pre-computed values written by /api/payment/create — never recompute here.
  // This ensures fee changes don't silently affect historical transactions.
  const grandPrice: number   = refData.grandPrice   ?? amountPaid
  const itemsTotal: number   = refData.itemsTotal   ?? 0
  const sellerPayout: number = refData.sellerPayout ?? grandPrice
  const platformFee: number  = refData.platformFee  ?? 0

  // Warn if fee data was missing — indicates a create-route regression
  if (refData.platformFee == null) {
    console.warn(`[webhook/credo] platformFee missing on reference ${refId} — falling back to 0`)
  }

  const credoRef = data.transactionId ?? data.id ?? null
  if (credoRef == null) {
    console.warn(`[webhook/credo] Neither transactionId nor id present on event data for refId: ${refId}`)
  }

  const now = Timestamp.now()
  const batch = adminDb.batch()

  // Mark reference paid
  batch.update(adminDb.collection('references').doc(refId), {
    status:    'paid',
    credoRef,
    paidVia:   'credo',
    updatedAt: now,
  })

  // Seller escrow stats
  const sellerRef = adminDb.collection('users').doc(sellerId)
  batch.set(sellerRef, {
    totalEscrowPaid:      FieldValue.increment(sellerPayout),
    totalEscrowPaidCount: FieldValue.increment(1),
    pending:              FieldValue.increment(-grandPrice),
    pendingPayments:      FieldValue.increment(-1),
  }, { merge: true })

  // Escrow transaction record
  batch.set(
    adminDb.collection('admin').doc('escrow').collection('transactions').doc(refId),
    {
      refId,
      sellerId,
      buyerId:      refData.buyerId,
      itemAmount:   itemsTotal,
      platformFee,
      grandPrice,
      sellerPayout,
      paidAt:       now,
      paidVia:      'credo',
    }
  )

  // Global admin stats
  batch.set(adminDb.collection('admin').doc('global'), {
    totalEscrow:        FieldValue.increment(grandPrice),
    totalPlatformFee:   FieldValue.increment(platformFee),
    totalTransactions:  FieldValue.increment(1),
    updatedAt:          FieldValue.serverTimestamp(),
  }, { merge: true })

  // Time-series analytics (Nigeria is UTC+1, no DST)
  const { year: y, month: m, day: d } = getNigerianDateParts()

  const ap = {
    totalPaid:        FieldValue.increment(grandPrice),
    totalPlatformFee: FieldValue.increment(platformFee),
    totalPaidCount:   FieldValue.increment(1),
    updatedAt:        FieldValue.serverTimestamp(),
  }

  batch.set(adminDb.collection('admin').doc('analytics').collection('daily').doc(d),   ap, { merge: true })
  batch.set(adminDb.collection('admin').doc('analytics').collection('monthly').doc(m), ap, { merge: true })
  batch.set(adminDb.collection('admin').doc('analytics').collection('yearly').doc(y),  ap, { merge: true })

  await batch.commit()

  console.log(`[webhook/credo] charge success — refId: ${refId}, ₦${grandPrice}`)
}

// ── Paystack: transfer.success ────────────────────────────────────────────────

async function handleTransferSuccess(data: Record<string, unknown>) {
  const reference = (data.reference as string) ?? ''

  if (reference.startsWith('withdraw-')) {
    const refId = reference.replace(/^withdraw-/, '').replace(/-\d+$/, '')

    const payQueueDoc = await adminDb.collection('payQueue').doc(refId).get()
    if (!payQueueDoc.exists) {
      console.warn(`[webhook/paystack] transfer.success — payQueue not found: ${refId}`)
      return
    }

    const { payoutAmount = 0, sellerId } = payQueueDoc.data()!
    const { year: y, month: m, day: d } = getNigerianDateParts()

    const batch = adminDb.batch()

    batch.update(adminDb.collection('payQueue').doc(refId), {
      status:       'paid',
      paidAt:       FieldValue.serverTimestamp(),
      transferCode: data.transfer_code,
      updatedAt:    FieldValue.serverTimestamp(),
    })

    if (sellerId && payoutAmount > 0) {
      batch.set(adminDb.collection('users').doc(sellerId), {
        totalWithdrawn:      FieldValue.increment(payoutAmount),
        totalWithdrawnCount: FieldValue.increment(1),
      }, { merge: true })
    }

    const wp = { totalWithdrawn: FieldValue.increment(payoutAmount), updatedAt: FieldValue.serverTimestamp() }
    batch.set(adminDb.collection('admin').doc('analytics').collection('daily').doc(d),   wp, { merge: true })
    batch.set(adminDb.collection('admin').doc('analytics').collection('monthly').doc(m), wp, { merge: true })
    batch.set(adminDb.collection('admin').doc('analytics').collection('yearly').doc(y),  wp, { merge: true })

    await batch.commit()
    console.log(`[webhook/paystack] transfer.success (payout) — refId: ${refId}, ₦${payoutAmount}`)
    return
  }

  if (reference.startsWith('refund-')) {
    const disputeId = reference.replace(/^refund-/, '').replace(/-\d+$/, '')

    const disputeDoc = await adminDb.collection('disputes').doc(disputeId).get()
    if (!disputeDoc.exists) return

    const batch = adminDb.batch()

    batch.update(adminDb.collection('disputes').doc(disputeId), {
      status:       'refunded',
      refundedAt:   FieldValue.serverTimestamp(),
      transferCode: data.transfer_code,
      updatedAt:    FieldValue.serverTimestamp(),
    })

    const txnId = disputeDoc.data()?.txnId
    if (txnId) {
      batch.update(adminDb.collection('references').doc(txnId), {
        status:    'refunded',
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    await batch.commit()
    console.log(`[webhook/paystack] transfer.success (refund) — disputeId: ${disputeId}`)
  }
}

// ── Paystack: transfer.failed / transfer.reversed ─────────────────────────────

async function handleTransferFailed(data: Record<string, unknown>, eventType: string) {
  const reference     = (data.reference as string) ?? ''
  const failureReason = eventType === 'transfer.reversed'
    ? 'Transfer was reversed by Paystack'
    : ((data.gateway_response as string) ?? 'Transfer failed')

  if (reference.startsWith('withdraw-')) {
    const refId = reference.replace(/^withdraw-/, '').replace(/-\d+$/, '')

    const payQueueDoc = await adminDb.collection('payQueue').doc(refId).get()
    if (!payQueueDoc.exists) return

    const batch = adminDb.batch()

    batch.update(adminDb.collection('payQueue').doc(refId), {
      status:        'failed',
      failureReason,
      failedAt:      FieldValue.serverTimestamp(),
      updatedAt:     FieldValue.serverTimestamp(),
    })

    batch.update(adminDb.collection('references').doc(refId), {
      withdrawn:  false,
      updatedAt:  FieldValue.serverTimestamp(),
    })

    await batch.commit()
    console.log(`[webhook/paystack] ${eventType} (payout) — refId: ${refId}`)
    return
  }

  if (reference.startsWith('refund-')) {
    const disputeId = reference.replace(/^refund-/, '').replace(/-\d+$/, '')

    const disputeDoc = await adminDb.collection('disputes').doc(disputeId).get()
    if (!disputeDoc.exists) return

    await adminDb.collection('disputes').doc(disputeId).update({
      refundTransferStatus: 'failed',
      refundFailureReason:  failureReason,
      updatedAt:            FieldValue.serverTimestamp(),
    })

    console.log(`[webhook/paystack] ${eventType} (refund) — disputeId: ${disputeId}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Nigeria is UTC+1 year-round (WAT, no DST).
function getNigerianDateParts(): { year: string; month: string; day: string } {
  const t = new Date(Date.now() + 60 * 60 * 1000)
  const year  = t.getUTCFullYear().toString()
  const month = `${year}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
  const day   = `${month}-${String(t.getUTCDate()).padStart(2, '0')}`
  return { year, month, day }
}

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyCredoWebhookSignature } from '@/lib/credo'

async function getRawBody(req: NextRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = req.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

// POST /api/payment/credo-webhook
// Credo sends the raw body + "credo-signature" header (HMAC-SHA512 of body using secret key).
export async function POST(req: NextRequest) {
  try {
    const rawBody  = await getRawBody(req)
    const signature = req.headers.get('credo-signature') || ''

    if (!verifyCredoWebhookSignature(rawBody.toString('utf8'), signature)) {
      console.warn('[credo-webhook] Invalid signature — request rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody.toString('utf8'))

    // Credo event shape:  { event: "transaction.successful" | "transaction.failed", data: { ... } }
    if (event.event === 'transaction.successful') {
      await handleChargeSuccess(event.data)
    } else {
      console.log(`[credo-webhook] Unhandled event: ${event.event}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error('[credo-webhook] Error processing event:', error)
    // Always return 200 so Credo doesn't keep retrying on our processing errors
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

async function handleChargeSuccess(data: any) {
  // Credo sends amount in kobo
  const amountPaid: number = (data.amount ?? 0) / 100

  // The transRef we passed during initialization == our refId
  const refId: string = data.transRef ?? data.reference ?? ''

  if (!refId) {
    console.error('[credo-webhook] Missing transRef/reference in event data')
    return
  }

  // ── Fetch reference doc ───────────────────────────────────────────────────
  let refDoc = await adminDb.collection('references').doc(refId).get()

  // Fallback: Credo might send a different transRef — look up by credoTransRef field
  if (!refDoc.exists) {
    const snap = await adminDb
      .collection('references')
      .where('credoTransRef', '==', refId)
      .limit(1)
      .get()
    if (!snap.empty) refDoc = snap.docs[0]
  }

  if (!refDoc.exists) {
    console.error(`[credo-webhook] Reference doc not found: ${refId}`)
    return
  }

  const refData = refDoc.data()!
  const actualRefId = refDoc.id

  if (refData.status === 'paid') {
    console.log(`[credo-webhook] ${actualRefId} already marked paid — skipping`)
    return
  }

  const sellerId:     string = refData.sellerId
  const grandPrice:   number = refData.grandPrice  ?? amountPaid
  const itemsTotal:   number = refData.itemsTotal  ?? 0
  const sellerPayout: number = refData.sellerPayout ?? grandPrice
  const platformFee:  number = parseFloat(((grandPrice * 0.05) + 300).toFixed(2))
  const now = Timestamp.now()

  // ── Atomic batch ──────────────────────────────────────────────────────────
  const batch = adminDb.batch()

  // 1. Mark reference as paid
  batch.update(adminDb.collection('references').doc(actualRefId), {
    status:          'paid',
    credoPaymentRef: data.reference ?? data.transRef ?? null,
    credoChannel:    data.channel ?? null,
    paidAt:          now,
    updatedAt:       now,
  })

  // 2. Update seller stats
  const sellerRef = adminDb.collection('users').doc(sellerId)
  batch.set(sellerRef, {
    totalEscrowPaid:      FieldValue.increment(sellerPayout),
    totalEscrowPaidCount: FieldValue.increment(1),
    pending:              FieldValue.increment(-grandPrice),
    pendingPayments:      FieldValue.increment(-1),
  }, { merge: true })

  // 3. Admin escrow ledger entry
  const escrowTxRef = adminDb.collection('admin').doc('escrow').collection('transactions').doc(actualRefId)
  batch.set(escrowTxRef, {
    refId:          actualRefId,
    sellerId,
    buyerId:        refData.buyerId,
    itemAmount:     itemsTotal,
    platformFee,
    grandPrice,
    sellerPayout,
    paymentProvider: 'credo',
    paidAt:         now,
  })

  // 4. Global counters
  const globalRef = adminDb.collection('admin').doc('global')
  batch.set(globalRef, {
    totalEscrow:       FieldValue.increment(grandPrice),
    totalPlatformFee:  FieldValue.increment(platformFee),
    totalTransactions: FieldValue.increment(1),
    updatedAt:         FieldValue.serverTimestamp(),
  }, { merge: true })

  // 5. Period analytics
  const nigerianTime = new Date(Date.now() + 60 * 60 * 1000)
  const year  = nigerianTime.getUTCFullYear().toString()
  const month = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}`
  const day   = `${month}-${String(nigerianTime.getUTCDate()).padStart(2, '0')}`

  const analyticsPayload = {
    totalPaid:        FieldValue.increment(grandPrice),
    totalPlatformFee: FieldValue.increment(platformFee),
    totalPaidCount:   FieldValue.increment(1),
    createdAt:        FieldValue.serverTimestamp(),
    updatedAt:        FieldValue.serverTimestamp(),
  }

  const base = adminDb.collection('admin').doc('analytics')
  batch.set(base.collection('daily').doc(day),     analyticsPayload, { merge: true })
  batch.set(base.collection('monthly').doc(month), analyticsPayload, { merge: true })
  batch.set(base.collection('yearly').doc(year),   analyticsPayload, { merge: true })

  await batch.commit()
  console.log(`[credo-webhook] transaction.successful — refId: ${actualRefId}, grandPrice: ₦${grandPrice}`)
}

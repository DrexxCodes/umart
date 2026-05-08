import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyWebhookSignature } from '@/lib/paystack'

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

export async function POST(req: NextRequest) {
  try {
    const rawBody = await getRawBody(req)
    const signature = req.headers.get('x-paystack-signature') || ''

    if (!verifyWebhookSignature(rawBody.toString('utf8'), signature)) {
      console.warn('[webhook] Invalid Paystack signature — request rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody.toString('utf8'))

    if (event.event === 'charge.success') {
      await handleChargeSuccess(event.data)
    } else if (event.event === 'transfer.success') {
      await handleTransferSuccess(event.data)
    } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      await handleTransferFailed(event.data, event.event)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error('[webhook] Error processing Paystack event:', error)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

async function handleChargeSuccess(data: any) {
  const refId: string = data.reference
  // Paystack amount is in kobo — convert to naira
  const amountPaid: number = data.amount / 100

  const refDoc = await adminDb.collection('references').doc(refId).get()
  if (!refDoc.exists) {
    console.error(`[webhook] Reference doc not found: ${refId}`)
    return
  }

  const refData = refDoc.data()!
  if (refData.status === 'paid') {
    console.log(`[webhook] ${refId} already marked paid — skipping`)
    return
  }

  const sellerId: string = refData.sellerId
  const grandPrice: number = refData.grandPrice ?? amountPaid
  const itemsTotal: number = refData.itemsTotal ?? 0
  const sellerPayout: number = refData.sellerPayout ?? grandPrice
  const now = Timestamp.now()
  const platformFee: number = parseFloat(((grandPrice * 0.05) + 300).toFixed(2))

  const batch = adminDb.batch()

  batch.update(adminDb.collection('references').doc(refId), {
    status: 'paid',
    paystackRef: data.id,
    updatedAt: now,
  })

  const sellerRef = adminDb.collection('users').doc(sellerId)
  batch.set(sellerRef, {
    totalEscrowPaid: FieldValue.increment(sellerPayout),
    totalEscrowPaidCount: FieldValue.increment(1),
    pending: FieldValue.increment(-grandPrice),
    pendingPayments: FieldValue.increment(-1),
  }, { merge: true })

  const escrowTxRef = adminDb.collection('admin').doc('escrow').collection('transactions').doc(refId)
  batch.set(escrowTxRef, {
    refId,
    sellerId,
    buyerId: refData.buyerId,
    itemAmount: itemsTotal,
    platformFee,
    grandPrice,
    sellerPayout,
    paidAt: now,
  })

  const globalRef = adminDb.collection('admin').doc('global')
  batch.set(globalRef, {
    totalEscrow: FieldValue.increment(grandPrice),
    totalPlatformFee: FieldValue.increment(platformFee),
    totalTransactions: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  const nigerianTime = new Date(Date.now() + 60 * 60 * 1000)
  const year = nigerianTime.getUTCFullYear().toString()
  const month = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}`
  const day = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}-${String(nigerianTime.getUTCDate()).padStart(2, '0')}`

  const analyticsPayload = {
    totalPaid: FieldValue.increment(grandPrice),
    totalPlatformFee: FieldValue.increment(platformFee),
    totalPaidCount: FieldValue.increment(1),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  batch.set(adminDb.collection('admin').doc('analytics').collection('daily').doc(day), analyticsPayload, { merge: true })
  batch.set(adminDb.collection('admin').doc('analytics').collection('monthly').doc(month), analyticsPayload, { merge: true })
  batch.set(adminDb.collection('admin').doc('analytics').collection('yearly').doc(year), analyticsPayload, { merge: true })

  await batch.commit()
  console.log(`[webhook] charge.success — refId: ${refId}, grandPrice: ₦${grandPrice}`)
}

async function handleTransferSuccess(data: any) {
  const reference: string = data.reference ?? ''

  // Seller payout reference: "withdraw-{refId}-{timestamp}"
  if (reference.startsWith('withdraw-')) {
    const refId = reference.replace(/^withdraw-/, '').replace(/-\d+$/, '')
    const payQueueDoc = await adminDb.collection('payQueue').doc(refId).get()
    if (!payQueueDoc.exists) {
      console.warn(`[webhook] transfer.success — payQueue doc not found for refId: ${refId}`)
      return
    }
    await adminDb.collection('payQueue').doc(refId).update({
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      transferCode: data.transfer_code,
      updatedAt: FieldValue.serverTimestamp(),
    })
    console.log(`[webhook] transfer.success (payout) — refId: ${refId}`)
    return
  }

  // Buyer refund reference: "refund-{disputeId}-{timestamp}"
  if (reference.startsWith('refund-')) {
    const disputeId = reference.replace(/^refund-/, '').replace(/-\d+$/, '')
    const disputeDoc = await adminDb.collection('disputes').doc(disputeId).get()
    if (!disputeDoc.exists) {
      console.warn(`[webhook] transfer.success — dispute doc not found for disputeId: ${disputeId}`)
      return
    }
    const batch = adminDb.batch()
    batch.update(adminDb.collection('disputes').doc(disputeId), {
      status: 'refunded',
      refundedAt: FieldValue.serverTimestamp(),
      transferCode: data.transfer_code,
      updatedAt: FieldValue.serverTimestamp(),
    })
    // Also update the transaction reference status
    const disputeData = disputeDoc.data()!
    if (disputeData.txnId) {
      batch.update(adminDb.collection('references').doc(disputeData.txnId), {
        status: 'refunded',
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
    console.log(`[webhook] transfer.success (refund) — disputeId: ${disputeId}`)
  }
}

async function handleTransferFailed(data: any, eventType: string) {
  const reference: string = data.reference ?? ''
  const failureReason = eventType === 'transfer.reversed'
    ? 'Transfer was reversed by Paystack'
    : (data.gateway_response ?? 'Transfer failed')

  if (reference.startsWith('withdraw-')) {
    const refId = reference.replace(/^withdraw-/, '').replace(/-\d+$/, '')
    const payQueueDoc = await adminDb.collection('payQueue').doc(refId).get()
    if (!payQueueDoc.exists) return

    const batch = adminDb.batch()
    batch.update(adminDb.collection('payQueue').doc(refId), {
      status: 'failed',
      failureReason,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    // Revert withdrawn so seller can retry
    batch.update(adminDb.collection('references').doc(refId), {
      withdrawn: false,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    console.log(`[webhook] ${eventType} (payout) — refId: ${refId}`)
    return
  }

  if (reference.startsWith('refund-')) {
    const disputeId = reference.replace(/^refund-/, '').replace(/-\d+$/, '')
    const disputeDoc = await adminDb.collection('disputes').doc(disputeId).get()
    if (!disputeDoc.exists) return

    await adminDb.collection('disputes').doc(disputeId).update({
      refundTransferStatus: 'failed',
      refundFailureReason: failureReason,
      updatedAt: FieldValue.serverTimestamp(),
    })
    console.log(`[webhook] ${eventType} (refund) — disputeId: ${disputeId}`)
  }
}

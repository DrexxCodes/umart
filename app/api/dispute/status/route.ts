import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { createRecipient, initiateTransfer } from '@/lib/paystack'

async function verifyAdmin(req: NextRequest): Promise<{ uid: string } | null> {
  const token = req.cookies.get('__session')?.value
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.data()?.roles?.isAdmin) return null
    return { uid: decoded.uid }
  } catch {
    return null
  }
}

function serialise(val: unknown): unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString()
  if (Array.isArray(val)) return val.map(serialise)
  if (val && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, serialise(v)])
    )
  }
  return val
}

// PATCH — admin changes dispute status, triggers refund when status = 'refunded'
export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`dispute-status:${ip}`, { limit: 20, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { txnId, status } = body
  const validStatuses = ['open', 'resolving', 'closed', 'refunded']

  if (!txnId || typeof txnId !== 'string') {
    return NextResponse.json({ success: false, error: 'txnId is required' }, { status: 400 })
  }
  if (!validStatuses.includes(status as string)) {
    return NextResponse.json({ success: false, error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const disputeDoc = await adminDb.collection('disputes').doc(txnId as string).get()
  if (!disputeDoc.exists) {
    return NextResponse.json({ success: false, error: 'Dispute not found' }, { status: 404 })
  }

  const dispute = disputeDoc.data()!

  if (dispute.status === 'refunded') {
    return NextResponse.json({ success: false, error: 'This dispute has already been refunded' }, { status: 409 })
  }

  // ── Refund flow ────────────────────────────────────────────────────────────
  if (status === 'refunded') {
    const refundAmount: number = dispute.grandPrice ?? 0
    if (refundAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid refund amount' }, { status: 400 })
    }

    const bankCode: string = dispute.buyerBankCode
    const accountNumber: string = dispute.buyerAccountNumber
    const accountName: string = dispute.buyerAccountName
    const productName: string = dispute.productName ?? 'your order'

    let recipientCode: string = dispute.buyerRecipientCode ?? ''

    if (!recipientCode) {
      const recipient = await createRecipient({ name: accountName, accountNumber, bankCode })
      recipientCode = recipient.recipient_code
      await adminDb.collection('disputes').doc(txnId as string).update({
        buyerRecipientCode: recipientCode,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    const transferRef = `refund-${txnId}-${Date.now()}`
    const transfer = await initiateTransfer({
      recipientCode,
      amount: refundAmount * 100,
      reference: transferRef,
      reason: `Refund for ${productName}`,
    })

    const batch = adminDb.batch()
    batch.update(adminDb.collection('disputes').doc(txnId as string), {
      status: 'refunded',
      refundTransferCode: transfer.transfer_code,
      refundTransferStatus: transfer.status,
      refundTransferRef: transferRef,
      resolvedByUid: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.update(adminDb.collection('references').doc(txnId as string), {
      status: 'refunded',
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()

    return NextResponse.json({
      success: true,
      message: 'Refund initiated successfully',
      data: serialise({ status: 'refunded', transferCode: transfer.transfer_code }),
    })
  }

  // ── Closed flow: seller wins — set reference back to paid, confirmedValue true ──
  if (status === 'closed') {
    const batch = adminDb.batch()
    batch.update(adminDb.collection('disputes').doc(txnId as string), {
      status: 'closed',
      resolvedByUid: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.update(adminDb.collection('references').doc(txnId as string), {
      status: 'paid',
      confirmedValue: true,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    return NextResponse.json({ success: true, data: { status: 'closed' } })
  }

  // ── Other status updates ───────────────────────────────────────────────────
  await adminDb.collection('disputes').doc(txnId as string).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ success: true, data: { status } })
}

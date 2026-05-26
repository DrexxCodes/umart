import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyCredoTransaction } from '@/lib/credo'

// Resolve a Credo raw response to a normalised internal status string.
// Returns: 'paid' | 'failed' | 'cancelled' | 'not_started'
function resolveCredoStatus(raw: any): {
  status: 'paid' | 'failed' | 'cancelled' | 'not_started'
  userMessage: string
} {
  // 404 or empty data means payment was never started
  if (!raw || raw.status === 404 || raw.data === '' || raw.data == null) {
    return {
      status: 'not_started',
      userMessage: 'Transaction not created. Use Pay Now to begin your payment.',
    }
  }

  const data = raw.data
  const statusMsg: string  = (data?.statusMessage ?? '').toLowerCase()
  const credoStatus: string = String(data?.status ?? '').toUpperCase()

  // "Successfully processed" / numeric status 0 means approved
  if (
    statusMsg.includes('successfully processed') ||
    statusMsg.includes('approved') ||
    statusMsg.includes('successful') ||
    credoStatus === '0' ||
    credoStatus === 'APPROVED' ||
    credoStatus === 'SUCCESSFUL' ||
    credoStatus === 'SUCCESS'
  ) {
    return {
      status: 'paid',
      userMessage: 'Transaction completed. Refresh page.',
    }
  }

  // "Transaction cancelled" = user closed the widget
  if (statusMsg.includes('cancelled') || statusMsg.includes('canceled')) {
    return {
      status: 'cancelled',
      userMessage: 'The transaction was not completed. Try paying again.',
    }
  }

  // Explicit failure
  if (
    statusMsg.includes('declined') ||
    statusMsg.includes('failed') ||
    credoStatus === 'DECLINED' ||
    credoStatus === 'FAILED' ||
    credoStatus === 'ABANDONED'
  ) {
    return {
      status: 'failed',
      userMessage: 'Payment declined or failed. Please try again.',
    }
  }

  // Anything else (pending, unknown) = treat as not started / still in progress
  return {
    status: 'not_started',
    userMessage: 'Transaction not created. Use Pay Now to begin your payment.',
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let uid: string
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
      uid = decoded.uid
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const refId = searchParams.get('refId')

    if (!refId) {
      return NextResponse.json({ success: false, error: 'Missing refId' }, { status: 400 })
    }

    const refDoc = await adminDb.collection('references').doc(refId).get()
    if (!refDoc.exists) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    const refData = refDoc.data()!
    if (refData.buyerId !== uid && refData.sellerId !== uid) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Already settled — no need to hit Credo
    if (refData.status === 'paid') {
      return NextResponse.json({ success: true, status: 'paid', userMessage: 'Transaction completed. Refresh page.' })
    }

    // Call Credo — catch ALL errors including 404
    let credoRaw: any = null
    try {
      credoRaw = await verifyCredoTransaction(refId)
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      // Credo throws on 404 — treat as not_started
      if (msg.includes('404') || msg.includes('not found')) {
        return NextResponse.json({
          success: true,
          status:      'not_started',
          userMessage: 'Transaction not created. Use Pay Now to begin your payment.',
        })
      }
      console.error('[payment/status] Credo error:', err)
      return NextResponse.json({ success: false, error: 'Payment provider unavailable. Try again.' }, { status: 502 })
    }

    console.log('[payment/status] Credo response:', JSON.stringify(credoRaw, null, 2))

    const { status: resolved, userMessage } = resolveCredoStatus(credoRaw)

    // ── PAID — run atomic stats update ────────────────────────────────────
    if (resolved === 'paid') {
      // Idempotency guard
      const fresh = await adminDb.collection('references').doc(refId).get()
      if (fresh.data()?.status === 'paid') {
        return NextResponse.json({ success: true, status: 'paid', userMessage: 'Transaction completed. Refresh page.' })
      }

      const grandPrice: number   = refData.grandPrice   ?? 0
      const itemsTotal: number   = refData.itemsTotal   ?? 0
      const sellerPayout: number = refData.sellerPayout ?? grandPrice
      const platformFee: number  = refData.platformFee  ?? 0
      const sellerId: string     = refData.sellerId

      const credoRef = credoRaw?.data?.id ?? null
      const now      = Timestamp.now()
      const batch    = adminDb.batch()

      batch.update(adminDb.collection('references').doc(refId), {
        status:    'paid',
        credoRef,
        paidVia:   'credo',
        updatedAt: now,
      })

      batch.set(adminDb.collection('users').doc(sellerId), {
        totalEscrowPaid:      FieldValue.increment(sellerPayout),
        totalEscrowPaidCount: FieldValue.increment(1),
        pending:              FieldValue.increment(-grandPrice),
        pendingPayments:      FieldValue.increment(-1),
      }, { merge: true })

      batch.set(
        adminDb.collection('admin').doc('escrow').collection('transactions').doc(refId),
        { refId, sellerId, buyerId: refData.buyerId, itemAmount: itemsTotal, platformFee, grandPrice, sellerPayout, paidAt: now, paidVia: 'credo' }
      )

      batch.set(adminDb.collection('admin').doc('global'), {
        totalEscrow:       FieldValue.increment(grandPrice),
        totalPlatformFee:  FieldValue.increment(platformFee),
        totalTransactions: FieldValue.increment(1),
        updatedAt:         FieldValue.serverTimestamp(),
      }, { merge: true })

      const t = new Date(Date.now() + 60 * 60 * 1000)
      const y = t.getUTCFullYear().toString()
      const m = `${y}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
      const d = `${m}-${String(t.getUTCDate()).padStart(2, '0')}`
      const ap = { totalPaid: FieldValue.increment(grandPrice), totalPlatformFee: FieldValue.increment(platformFee), totalPaidCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }
      batch.set(adminDb.collection('admin').doc('analytics').collection('daily').doc(d),   ap, { merge: true })
      batch.set(adminDb.collection('admin').doc('analytics').collection('monthly').doc(m), ap, { merge: true })
      batch.set(adminDb.collection('admin').doc('analytics').collection('yearly').doc(y),  ap, { merge: true })

      await batch.commit()
      console.log(`[payment/status] Marked paid via manual verify — refId: ${refId}, ₦${grandPrice}`)
    }

    // ── Failed — update reference ────────────────────────────────────────
    if (resolved === 'failed') {
      await adminDb.collection('references').doc(refId).update({
        status: 'failed', updatedAt: Timestamp.now(),
      }).catch(() => {/* non-fatal */})
    }

    return NextResponse.json({ success: true, status: resolved, userMessage })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[payment/status] Unhandled error:', error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

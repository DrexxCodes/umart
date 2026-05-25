import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyCredoTransaction } from '@/lib/credo'

// ── GET /api/payment/status?refId=xxx ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
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

    // ── Read refId from query params, NOT body ─────────────────────────────
    const { searchParams } = new URL(req.url)
    const refId = searchParams.get('refId')

    if (!refId) {
      return NextResponse.json({ success: false, error: 'Missing refId' }, { status: 400 })
    }

    // ── Ownership check ─────────────────────────────────────────────────────
    const refDoc = await adminDb.collection('references').doc(refId).get()
    if (!refDoc.exists) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    const refData = refDoc.data()!
    if (refData.buyerId !== uid && refData.sellerId !== uid) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // ── Already settled — no need to hit Credo ──────────────────────────────
    if (refData.status === 'paid') {
      return NextResponse.json({ success: true, status: 'paid', message: 'Already marked as paid' })
    }

    // ── Call Credo verify endpoint ──────────────────────────────────────────
    let credoResult
    try {
      credoResult = await verifyCredoTransaction(refId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credo verification failed'
      console.error('[payment/status] Credo verify error:', err)
      return NextResponse.json({ success: false, error: msg }, { status: 502 })
    }

    // Log full Credo response — this will show the business code in the payload
    console.log('[payment/status] Full Credo verify response:', JSON.stringify(credoResult, null, 2))

    const credoData = credoResult.data
    const credoStatus: string = credoData?.status ?? 'UNKNOWN'

    // ── APPROVED — update Firestore ─────────────────────────────────────────
    if (credoStatus === 'APPROVED') {
      // Idempotency: another process may have already updated this
      const freshSnap = await adminDb.collection('references').doc(refId).get()
      if (freshSnap.data()?.status === 'paid') {
        return NextResponse.json({ success: true, status: 'paid', message: 'Already marked as paid' })
      }

      const grandPrice: number  = refData.grandPrice  ?? 0
      const itemsTotal: number  = refData.itemsTotal  ?? 0
      const sellerPayout: number = refData.sellerPayout ?? grandPrice
      const platformFee: number  = refData.platformFee  ?? 0
      const sellerId: string    = refData.sellerId

      if (refData.platformFee == null) {
        console.warn(`[payment/status] platformFee missing on reference ${refId} — falling back to 0`)
      }

      const credoRef = credoData.id ?? null
      const now = Timestamp.now()
      const batch = adminDb.batch()

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

      batch.set(adminDb.collection('admin').doc('global'), {
        totalEscrow:       FieldValue.increment(grandPrice),
        totalPlatformFee:  FieldValue.increment(platformFee),
        totalTransactions: FieldValue.increment(1),
        updatedAt:         FieldValue.serverTimestamp(),
      }, { merge: true })

      const nigerianTime = new Date(Date.now() + 60 * 60 * 1000)
      const y = nigerianTime.getUTCFullYear().toString()
      const m = `${y}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}`
      const d = `${m}-${String(nigerianTime.getUTCDate()).padStart(2, '0')}`

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

      console.log(`[payment/status] Marked paid via manual verify — refId: ${refId}, ₦${grandPrice}`)
      return NextResponse.json({ success: true, status: 'paid', message: 'Payment confirmed and recorded' })
    }

    // ── DECLINED / FAILED ───────────────────────────────────────────────────
    if (['DECLINED', 'FAILED', 'ABANDONED'].includes(credoStatus)) {
      await adminDb.collection('references').doc(refId).update({
        status:    'failed',
        updatedAt: Timestamp.now(),
      })
      return NextResponse.json({ success: true, status: 'failed', message: 'Payment was not successful' })
    }

    // ── PENDING or other — no state change ──────────────────────────────────
    return NextResponse.json({ 
      success: true, 
      status: 'not_found', 
      message: 'No payment attempt found for this order. Please use Pay Now to complete your payment.' 
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[payment/status] Unhandled error:', error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

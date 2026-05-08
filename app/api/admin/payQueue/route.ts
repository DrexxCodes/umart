// app/admin/api/payqueue/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

// ── Auth helper ────────────────────────────────────────────────────────────────
async function verifyAdmin(request: NextRequest): Promise<{ uid: string; name: string } | null> {
  const token = request.cookies.get('__session')?.value
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return null
    const data = userDoc.data()!
    if (!data.roles?.isAdmin) return null
    return {
      uid:  decoded.uid,
      name: data.fullname ?? data.displayName ?? data.email ?? decoded.uid,
    }
  } catch {
    return null
  }
}

// Serialise Firestore Timestamps to ISO strings
function serialise(val: unknown): unknown {
  if (val instanceof Timestamp)       return val.toDate().toISOString()
  if (Array.isArray(val))             return val.map(serialise)
  if (val && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, serialise(v)])
    )
  }
  return val
}

// ── GET — list payQueue entries (optionally filtered by status) ────────────────
// Query params: ?status=pending|paid|failed  (omit for all)
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const query = adminDb
      .collection('payQueue')
      .where('status', '==', 'pending')

    const snap = await query.get()

    const items = snap.docs.map((doc) => {
      const d = doc.data()
      return serialise({
        id:            doc.id,
        refId:         d.refId,
        sellerId:      d.sellerId,
        payoutAmount:  d.payoutAmount,
        bankCode:      d.bankCode,
        bankName:      d.bankName,
        accountNumber: d.accountNumber,
        accountName:   d.accountName,
        status:        d.status,
        pendingAt:     d.pendingAt,
        paidAt:        d.paidAt    ?? null,
        failedAt:      d.failedAt  ?? null,
        failureReason: d.failureReason ?? null,
        resolvedByUid: d.resolvedByUid ?? null,
      })
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    console.error('[payqueue GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── PATCH — resolve a payQueue entry as paid or failed ────────────────────────
// Body: { refId, action: 'paid' | 'failed', failureReason?: string }
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { refId, action, failureReason } = body

  if (!refId || typeof refId !== 'string') {
    return NextResponse.json({ error: 'refId is required' }, { status: 400 })
  }
  if (action !== 'paid' && action !== 'failed') {
    return NextResponse.json({ error: 'action must be "paid" or "failed"' }, { status: 400 })
  }
  if (action === 'failed' && !failureReason?.toString().trim()) {
    return NextResponse.json({ error: 'failureReason is required when action is "failed"' }, { status: 400 })
  }

  const payQueueRef = adminDb.collection('payQueue').doc(refId)
  const snap        = await payQueueRef.get()
  if (!snap.exists) return NextResponse.json({ error: 'Pay queue entry not found' }, { status: 404 })

  const current = snap.data()!
  if (current.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot update — entry is already "${current.status}"` },
      { status: 409 }
    )
  }

  if (action === 'paid') {
    await payQueueRef.update({
      status:        'paid',
      paidAt:        FieldValue.serverTimestamp(),
      resolvedByUid: admin.uid,
      resolvedByName: admin.name,
      updatedAt:     FieldValue.serverTimestamp(),
    })
  } else {
    await payQueueRef.update({
      status:         'failed',
      failedAt:       FieldValue.serverTimestamp(),
      failureReason:  failureReason!.toString().trim(),
      resolvedByUid:  admin.uid,
      resolvedByName: admin.name,
      updatedAt:      FieldValue.serverTimestamp(),
    })
  }

  return NextResponse.json({ success: true, action })
}
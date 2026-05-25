// app/api/admin/payQueue/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

const PAGE_SIZE = 10

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

function getNigerianDateParts() {
  const t     = new Date(Date.now() + 60 * 60 * 1000)
  const year  = t.getUTCFullYear().toString()
  const month = `${year}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
  const day   = `${month}-${String(t.getUTCDate()).padStart(2, '0')}`
  return { year, month, day }
}

// ── GET — paginated list + total page count ────────────────────────────────────
// Query params:
//   ?status=pending|processing|completed  (omit for all)
//   ?page=1                               (1-indexed, default 1)
//   ?search=<refId prefix>                (exact doc lookup by refId)
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')   // pending | processing | completed
    const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const search = searchParams.get('search')?.trim() ?? ''

    // ── Quick exact lookup by refId ───────────────────────────────────────────
    if (search) {
      const doc = await adminDb.collection('payQueue').doc(search).get()
      if (!doc.exists) {
        return NextResponse.json({ success: true, data: [], totalPages: 0, totalCount: 0 })
      }
      const d = doc.data()!
      return NextResponse.json({
        success: true,
        data: [serialise({
          id:            doc.id,
          refId:         d.refId,
          sellerId:      d.sellerId,
          sellerName:    d.sellerName   ?? null,
          sellerEmail:   d.sellerEmail  ?? null,
          payoutAmount:  d.payoutAmount,
          bankCode:      d.bankCode,
          bankName:      d.bankName,
          accountNumber: d.accountNumber,
          accountName:   d.accountName,
          status:        d.status,
          pendingAt:     d.pendingAt,
          completedAt:   d.completedAt  ?? null,
          failedAt:      d.failedAt     ?? null,
          failureReason: d.failureReason ?? null,
          resolvedByUid: d.resolvedByUid ?? null,
        })],
        totalPages: 1,
        totalCount: 1,
      })
    }

    // ── Build base query ──────────────────────────────────────────────────────
    let baseQuery = adminDb.collection('payQueue') as FirebaseFirestore.Query
    if (status && ['pending', 'processing', 'completed'].includes(status)) {
      baseQuery = baseQuery.where('status', '==', status)
    }

    // ── Count for pagination (Firestore count()) ───────────────────────────────
    const countSnap   = await baseQuery.count().get()
    const totalCount  = countSnap.data().count
    const totalPages  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    const safePage    = Math.min(page, totalPages)

    // ── Fetch page ────────────────────────────────────────────────────────────
    // Order by pendingAt desc (most recent first), paginate with offset
    const offset = (safePage - 1) * PAGE_SIZE
    const snap = await baseQuery
      .orderBy('pendingAt', 'desc')
      .limit(PAGE_SIZE)
      .offset(offset)
      .get()

    const items = snap.docs.map((doc) => {
      const d = doc.data()
      return serialise({
        id:            doc.id,
        refId:         d.refId,
        sellerId:      d.sellerId,
        sellerName:    d.sellerName   ?? null,
        sellerEmail:   d.sellerEmail  ?? null,
        payoutAmount:  d.payoutAmount,
        bankCode:      d.bankCode,
        bankName:      d.bankName,
        accountNumber: d.accountNumber,
        accountName:   d.accountName,
        status:        d.status,
        pendingAt:     d.pendingAt,
        completedAt:   d.completedAt  ?? null,
        failedAt:      d.failedAt     ?? null,
        failureReason: d.failureReason ?? null,
        resolvedByUid: d.resolvedByUid ?? null,
      })
    })

    return NextResponse.json({ success: true, data: items, totalPages, totalCount })
  } catch (error: any) {
    console.error('[payqueue GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── PATCH — advance status: pending → processing → completed (or → failed) ───
// Body: { refId, action: 'processing' | 'completed' | 'failed', failureReason?: string }
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
  if (!['processing', 'completed', 'failed'].includes(action as string)) {
    return NextResponse.json({ error: 'action must be "processing", "completed", or "failed"' }, { status: 400 })
  }
  if (action === 'failed' && !failureReason?.toString().trim()) {
    return NextResponse.json({ error: 'failureReason is required when action is "failed"' }, { status: 400 })
  }

  const payQueueRef = adminDb.collection('payQueue').doc(refId)
  const snap        = await payQueueRef.get()
  if (!snap.exists) return NextResponse.json({ error: 'Pay queue entry not found' }, { status: 404 })

  const current = snap.data()!

  // Enforce linear transitions: pending→processing→completed, any→failed
  const validTransitions: Record<string, string[]> = {
    pending:    ['processing', 'failed'],
    processing: ['completed', 'failed'],
    completed:  [],
    failed:     [],
  }
  const allowed = validTransitions[current.status as string] ?? []
  if (!allowed.includes(action as string)) {
    return NextResponse.json(
      { error: `Cannot move from "${current.status}" to "${action}"` },
      { status: 409 }
    )
  }

  // ── processing ────────────────────────────────────────────────────────────
  if (action === 'processing') {
    await payQueueRef.update({
      status:         'processing',
      processingAt:   FieldValue.serverTimestamp(),
      resolvedByUid:  admin.uid,
      resolvedByName: admin.name,
      updatedAt:      FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ success: true, action })
  }

  // ── failed ────────────────────────────────────────────────────────────────
  if (action === 'failed') {
    await payQueueRef.update({
      status:         'failed',
      failedAt:       FieldValue.serverTimestamp(),
      failureReason:  failureReason!.toString().trim(),
      resolvedByUid:  admin.uid,
      resolvedByName: admin.name,
      updatedAt:      FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ success: true, action })
  }

  // ── completed — atomic batch: payQueue + references.withdrawn + stats ────
  if (action === 'completed') {
    const { payoutAmount = 0, sellerId } = current
    const { year: y, month: m, day: d } = getNigerianDateParts()

    const batch = adminDb.batch()

    batch.update(payQueueRef, {
      status:         'completed',
      completedAt:    FieldValue.serverTimestamp(),
      resolvedByUid:  admin.uid,
      resolvedByName: admin.name,
      updatedAt:      FieldValue.serverTimestamp(),
    })

    // Mark reference as withdrawn
    batch.update(adminDb.collection('references').doc(refId), {
      withdrawn:  true,
      updatedAt:  FieldValue.serverTimestamp(),
    })

    // Seller withdrawal stats
    if (sellerId && payoutAmount > 0) {
      batch.set(adminDb.collection('users').doc(sellerId), {
        totalWithdrawn:      FieldValue.increment(payoutAmount),
        totalWithdrawnCount: FieldValue.increment(1),
      }, { merge: true })
    }

    // Time-series analytics
    const wp = {
      totalWithdrawn: FieldValue.increment(payoutAmount),
      updatedAt:      FieldValue.serverTimestamp(),
    }
    batch.set(adminDb.collection('admin').doc('analytics').collection('daily').doc(d),   wp, { merge: true })
    batch.set(adminDb.collection('admin').doc('analytics').collection('monthly').doc(m), wp, { merge: true })
    batch.set(adminDb.collection('admin').doc('analytics').collection('yearly').doc(y),  wp, { merge: true })

    await batch.commit()
    console.log(`[payqueue PATCH] completed — refId: ${refId}, ₦${payoutAmount}, by: ${admin.uid}`)
    return NextResponse.json({ success: true, action })
  }

  return NextResponse.json({ error: 'Unhandled action' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

// ── Auth helper ────────────────────────────────────────────────────────────────

async function verifyAdmin(request: NextRequest): Promise<{ uid: string; name: string } | null> {
  const token = request.cookies.get('__session')?.value
  if (!token) return null
  try {
    const decoded  = await adminAuth.verifyIdToken(token)
    const userDoc  = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return null
    const data = userDoc.data()!
    if (!data.roles?.isAdmin) return null
    return {
      uid:  decoded.uid,
      name: data.displayName ?? data.name ?? data.email ?? decoded.uid,
    }
  } catch {
    return null
  }
}

// ── GET — fetch a reference by ID ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const refId = request.nextUrl.searchParams.get('refId')
  if (!refId?.trim()) {
    return NextResponse.json({ error: 'Missing refId' }, { status: 400 })
  }

  const snap = await adminDb.collection('references').doc(refId.trim()).get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
  }

  const data = snap.data()!

  // Serialise Timestamps to ISO strings for JSON transport
  function serialise(val: unknown): unknown {
    if (val instanceof Timestamp)    return val.toDate().toISOString()
    if (Array.isArray(val))          return val.map(serialise)
    if (val && typeof val === 'object') {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, serialise(v)])
      )
    }
    return val
  }

  return NextResponse.json({ reference: serialise({ id: snap.id, ...data }) })
}

// ── POST — mark valueReceived = true ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { refId } = body
  if (!refId || typeof refId !== 'string') {
    return NextResponse.json({ error: 'Missing refId' }, { status: 400 })
  }

  const ref  = adminDb.collection('references').doc(refId)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: 'Reference not found' }, { status: 404 })

  await ref.update({
    valueReceived:          true,
    valueReceivedAt:        FieldValue.serverTimestamp(),
    valueReceivedByAdmin:   admin.uid,
    updatedAt:              FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ success: true })
}

// ── PATCH — toggle flagged status ─────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { refId } = body
  if (!refId || typeof refId !== 'string') {
    return NextResponse.json({ error: 'Missing refId' }, { status: 400 })
  }

  const ref  = adminDb.collection('references').doc(refId)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: 'Reference not found' }, { status: 404 })

  const current    = snap.data()!
  const newFlagged = !current.flagged

  await ref.update({
    flagged:        newFlagged,
    flaggedAt:      newFlagged ? FieldValue.serverTimestamp() : null,
    flaggedByAdmin: newFlagged ? admin.uid : null,
    updatedAt:      FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ success: true, flagged: newFlagged })
}

// ── DELETE — soft-delete: move to deleted_references, clean up user arrays ────

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const refId = request.nextUrl.searchParams.get('refId')
  if (!refId?.trim()) {
    return NextResponse.json({ error: 'Missing refId' }, { status: 400 })
  }

  const refDocRef = adminDb.collection('references').doc(refId.trim())
  const snap      = await refDocRef.get()
  if (!snap.exists) return NextResponse.json({ error: 'Reference not found' }, { status: 404 })

  const refData   = snap.data()!
  const buyerId:  string = refData.buyerId
  const sellerId: string = refData.sellerId

  const batch = adminDb.batch()

  // 1. Archive into deleted_references
  const deletedRef = adminDb.collection('deleted_references').doc(refId.trim())
  batch.set(deletedRef, {
    ...refData,
    deletedAt:       FieldValue.serverTimestamp(),
    deletedByUid:    admin.uid,
    deletedByName:   admin.name,
    originalRefId:   refId.trim(),
  })

  // 2. Remove the refId entry from buyer's transactionRefs array
  //    FieldValue.arrayRemove matches objects by deep equality — we need the exact shape
  const buyerRef = adminDb.collection('users').doc(buyerId)
  batch.update(buyerRef, {
    transactionRefs: FieldValue.arrayRemove({ refId: refId.trim(), type: 'purchase' }),
    deleted_refs:    FieldValue.arrayUnion(refId.trim()),
  })

  // 3. Remove the refId entry from seller's transactionRefs array
  const sellerRef = adminDb.collection('users').doc(sellerId)
  batch.update(sellerRef, {
    transactionRefs: FieldValue.arrayRemove({ refId: refId.trim(), type: 'sale' }),
    deleted_refs:    FieldValue.arrayUnion(refId.trim()),
  })

  // 4. Delete the original reference document
  batch.delete(refDocRef)

  await batch.commit()

  return NextResponse.json({ success: true })
}
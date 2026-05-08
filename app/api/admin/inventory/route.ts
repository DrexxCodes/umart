// app/api/admin/inventory/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

// ── Auth helper ────────────────────────────────────────────────────────────────
async function verifyAdmin(request: NextRequest): Promise<{ uid: string } | null> {
  const token = request.cookies.get('__session')?.value
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.exists || userDoc.data()?.roles?.isAdmin !== true) return null
    return { uid: decoded.uid }
  } catch {
    return null
  }
}

// Serialise Timestamps → ISO strings
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

// ── GET ────────────────────────────────────────────────────────────────────────
// ?count=true          → return total product count (1 read via count())
// ?productId=prod_xxx  → fetch a single product by ID
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = request.nextUrl

  // ── Count only ──────────────────────────────────────────────────────────────
  if (searchParams.get('count') === 'true') {
    try {
      const snap = await adminDb.collection('products').count().get()
      return NextResponse.json({ success: true, count: snap.data().count })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // ── Fetch single product by ID ──────────────────────────────────────────────
  const productId = searchParams.get('productId')?.trim()
  if (!productId) {
    return NextResponse.json(
      { error: 'Provide ?productId=... or ?count=true' },
      { status: 400 }
    )
  }

  try {
    const snap = await adminDb.collection('products').doc(productId).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: serialise({ id: snap.id, ...snap.data() }),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
// Body: { productId, action: 'flag' | 'unflag' | 'deactivate' | 'activate' }
// flag/unflag   → toggles flagged field + records who flagged and when
// deactivate    → sets status = 'inactive'
// activate      → sets status = 'active'
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { productId, action } = body
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }
  if (!['flag', 'unflag', 'deactivate', 'activate'].includes(action as string)) {
    return NextResponse.json(
      { error: 'action must be flag | unflag | deactivate | activate' },
      { status: 400 }
    )
  }

  const productRef = adminDb.collection('products').doc(productId)
  const snap       = await productRef.get()
  if (!snap.exists) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  let update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }

  switch (action) {
    case 'flag':
      update = { ...update, flagged: true,  flaggedAt: FieldValue.serverTimestamp(), flaggedByAdmin: admin.uid }
      break
    case 'unflag':
      update = { ...update, flagged: false, flaggedAt: null, flaggedByAdmin: null }
      break
    case 'deactivate':
      update = { ...update, status: 'inactive' }
      break
    case 'activate':
      update = { ...update, status: 'active' }
      break
  }

  await productRef.update(update)

  // Mirror status/flag changes to the category subcollection too
  const categoryId = snap.data()?.category
  if (categoryId) {
    const catRef = adminDb
      .collection('productCategories')
      .doc(categoryId)
      .collection('products')
      .doc(productId)
    const catSnap = await catRef.get()
    if (catSnap.exists) await catRef.update(update)
  }

  return NextResponse.json({ success: true, action, productId })
}
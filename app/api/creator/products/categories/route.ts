// app/api/creator/products/categories/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// ── GET /api/creator/products/categories ───────────────────────────────────────────
// Public — returns all active product categories ordered by displayName.
// No auth required so the category list can be shown on public-facing forms.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const withCount = req.nextUrl.searchParams.get('count') === 'true'

    const snap = await adminDb.collection('productCategories').get()

    // Build base category objects from the category docs
    const data = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        id:            doc.id,
        name:          doc.id,                   // doc ID is the category slug/name
        displayName:   d.displayName  ?? doc.id,
        description:   d.description  ?? null,
        imageUrl:      d.imageUrl     ?? null,
        imagePublicId: d.imagePublicId ?? null,
        isActive:      d.isActive     ?? true,
        productCount:  0,                        // filled in below when ?count=true
        createdAt:     d.createdAt    ?? null,
        updatedAt:     d.updatedAt    ?? null,
      }
    })

    // ── Optional product count ────────────────────────────────────────────────
    // Uses Firestore aggregation count() — costs 1 read per category, 0 doc reads.
    // All counts run in parallel so total latency ~ slowest single category.
    if (withCount) {
      await Promise.all(
        data.map(async (cat) => {
          const countSnap = await adminDb
            .collection('productCategories')
            .doc(cat.id)
            .collection('products')
            .count()
            .get()
          cat.productCount = countSnap.data().count
        })
      )
    }

    // Sort alphabetically by displayName
    data.sort((a, b) => a.displayName.localeCompare(b.displayName))

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error: any) {
    console.error('[GET /categories] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

// ── PATCH /api/creator/products/categories/[id] ───────────────────────────────
// Admin-only — updates an existing category's editable fields.
// The slug (doc ID) is immutable and never changed here.
//
// Expected body (all optional, but at least one should be present):
//   { displayName?, description?, imageUrl?, imagePublicId?, isActive? }
//
// Auth: Bearer token; caller must have roles.isAdmin === true in db.
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Authorization header missing or malformed' },
      { status: 401 }
    )
  }

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
    uid = decoded.uid
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    )
  }

  // ── 2. Admin check ────────────────────────────────────────────────────────
  const userSnap = await adminDb.collection('users').doc(uid).get()
  if (!userSnap.exists || userSnap.data()?.roles?.isAdmin !== true) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: admin access required' },
      { status: 403 }
    )
  }

  // -- 3. Resolve category doc
  const categoryId = req.nextUrl.searchParams.get('id')
  if (!categoryId) {
    return NextResponse.json(
      { success: false, error: 'Missing required query param: id' },
      { status: 400 }
    )
  }
  const categoryRef = adminDb.collection('productCategories').doc(categoryId)
  const categorySnap = await categoryRef.get()

  if (!categorySnap.exists) {
    return NextResponse.json(
      { success: false, error: `Category "${categoryId}" not found` },
      { status: 404 }
    )
  }

  // ── 4. Parse body ─────────────────────────────────────────────────────────
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { displayName, description, imageUrl, imagePublicId, isActive } = body

  if (displayName !== undefined && !String(displayName).trim()) {
    return NextResponse.json(
      { success: false, error: '`displayName` cannot be empty' },
      { status: 400 }
    )
  }

  // ── 5. Build update payload — only include fields that were sent ──────────
  const update: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (displayName  !== undefined) update.displayName  = String(displayName).trim()
  if (description  !== undefined) update.description  = String(description).trim()
  if (imageUrl     !== undefined) update.imageUrl     = imageUrl     || null
  if (imagePublicId !== undefined) update.imagePublicId = imagePublicId || null
  if (isActive     !== undefined) update.isActive     = Boolean(isActive)

  // ── 6. Write ──────────────────────────────────────────────────────────────
  await categoryRef.update(update)

  const updated = (await categoryRef.get()).data()

  return NextResponse.json(
    {
      success: true,
      message: 'Category updated successfully',
      data: { id: categoryId, name: categoryId, ...updated },
    },
    { status: 200 }
  )
}
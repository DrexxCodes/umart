// app/api/creator/products/categories/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// ── GET /api/creator/products/categories ──────────────────────────────────────
// Public — returns all active product categories ordered by displayName.
// No auth required so the category list can be shown on public-facing forms.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const withCount = req.nextUrl.searchParams.get('count') === 'true'

    const snap = await adminDb.collection('productCategories').get()

    const data = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        id:            doc.id,
        name:          doc.id,
        displayName:   d.displayName  ?? doc.id,
        description:   d.description  ?? null,
        imageUrl:      d.imageUrl     ?? null,
        imagePublicId: d.imagePublicId ?? null,
        isActive:      d.isActive     ?? true,
        productCount:  0,
        createdAt:     d.createdAt    ?? null,
        updatedAt:     d.updatedAt    ?? null,
      }
    })

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

// ── POST /api/creator/products/categories ─────────────────────────────────────
// Admin-only — creates a new product category.
//
// Expected body:
//   { name: string, displayName: string, description?: string,
//     imageUrl?: string, imagePublicId?: string }
//
// `name` becomes the Firestore document ID (slug). It must be unique,
// lowercase, and contain only letters, numbers, and hyphens.
//
// Auth: Bearer token; caller must have roles.isAdmin === true.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
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

  // ── 3. Parse body ─────────────────────────────────────────────────────────
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { name, displayName, description, imageUrl, imagePublicId } = body

  // ── 4. Validate required fields ───────────────────────────────────────────
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { success: false, error: '`name` (slug) is required' },
      { status: 400 }
    )
  }

  const slug = name.trim().toLowerCase()

  // Enforce slug format: lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: '`name` must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 }
    )
  }

  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    return NextResponse.json(
      { success: false, error: '`displayName` is required' },
      { status: 400 }
    )
  }

  // ── 5. Check uniqueness ───────────────────────────────────────────────────
  const existing = await adminDb.collection('productCategories').doc(slug).get()
  if (existing.exists) {
    return NextResponse.json(
      { success: false, error: `A category with slug "${slug}" already exists` },
      { status: 409 }
    )
  }

  // ── 6. Write new category doc ─────────────────────────────────────────────
  const now = FieldValue.serverTimestamp()

  const payload: Record<string, any> = {
    displayName:   String(displayName).trim(),
    description:   description ? String(description).trim() : null,
    imageUrl:      imageUrl      || null,
    imagePublicId: imagePublicId || null,
    isActive:      true,
    createdAt:     now,
    updatedAt:     now,
  }

  await adminDb.collection('productCategories').doc(slug).set(payload)

  return NextResponse.json(
    {
      success: true,
      message: 'Category created successfully',
      data: {
        id:          slug,
        name:        slug,
        ...payload,
        // Replace server timestamps with ISO string for immediate client use
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
        productCount: 0,
      },
    },
    { status: 201 }
  )
}

// ── PATCH /api/creator/products/categories ────────────────────────────────────
// Admin-only — updates an existing category using ?id= query param.
// Kept here for backwards compatibility with the admin panel's PATCH call.
// (Preferred: PATCH /api/creator/products/categories/[id])
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
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

  const userSnap = await adminDb.collection('users').doc(uid).get()
  if (!userSnap.exists || userSnap.data()?.roles?.isAdmin !== true) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: admin access required' },
      { status: 403 }
    )
  }

  const categoryId = req.nextUrl.searchParams.get('id')
  if (!categoryId) {
    return NextResponse.json(
      { success: false, error: 'Missing required query param: id' },
      { status: 400 }
    )
  }
  const categoryRef  = adminDb.collection('productCategories').doc(categoryId)
  const categorySnap = await categoryRef.get()

  if (!categorySnap.exists) {
    return NextResponse.json(
      { success: false, error: `Category "${categoryId}" not found` },
      { status: 404 }
    )
  }

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

  const update: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (displayName   !== undefined) update.displayName   = String(displayName).trim()
  if (description   !== undefined) update.description   = String(description).trim()
  if (imageUrl      !== undefined) update.imageUrl      = imageUrl      || null
  if (imagePublicId !== undefined) update.imagePublicId = imagePublicId || null
  if (isActive      !== undefined) update.isActive      = Boolean(isActive)

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

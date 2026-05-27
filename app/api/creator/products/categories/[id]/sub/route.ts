// app/api/creator/products/categories/[id]/sub/route.ts
//
// GET    /api/creator/products/categories/:id/sub          — public list of subs
// POST   /api/creator/products/categories/:id/sub          — admin: create sub
// PATCH  /api/creator/products/categories/:id/sub?sub=:sid — admin: edit sub
// DELETE /api/creator/products/categories/:id/sub?sub=:sid — admin: delete sub

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

type Params = { params: Promise<{ id: string }> }

// ── Auth helper ───────────────────────────────────────────────────────────────
async function resolveAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const decoded  = await adminAuth.verifyIdToken(auth.substring(7))
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userSnap.exists || userSnap.data()?.roles?.isAdmin !== true) return null
    return decoded.uid
  } catch {
    return null
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
// Public — returns all subcategories for a given parent category.
// Optionally includes productCount per sub when ?count=true.
export async function GET(
  req: NextRequest,
  { params }: Params,
) {
  try {
    const { id: categoryId } = await params
    const withCount = req.nextUrl.searchParams.get('count') === 'true'

    const snap = await adminDb
      .collection('productCategories')
      .doc(categoryId)
      .collection('sub')
      .get()

    const data = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        id:          doc.id,
        name:        doc.id,
        displayName: d.displayName  ?? doc.id,
        description: d.description  ?? null,
        isActive:    d.isActive     ?? true,
        productCount: 0,
        createdAt:   d.createdAt    ?? null,
        updatedAt:   d.updatedAt    ?? null,
      }
    })

    if (withCount) {
      await Promise.all(
        data.map(async (sub) => {
          const countSnap = await adminDb
            .collection('productCategories')
            .doc(categoryId)
            .collection('sub')
            .doc(sub.id)
            .collection('products')
            .count()
            .get()
          sub.productCount = countSnap.data().count
        })
      )
    }

    data.sort((a, b) => a.displayName.localeCompare(b.displayName))

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error: any) {
    console.error('[GET /sub] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subcategories' },
      { status: 500 },
    )
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Admin-only — create a new subcategory under the given parent.
// Body: { name: string, displayName: string, description?: string }
export async function POST(
  req: NextRequest,
  { params }: Params,
) {
  const adminUid = await resolveAdmin(req)
  if (!adminUid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized or insufficient permissions' },
      { status: 401 },
    )
  }

  const { id: categoryId } = await params

  // Parent must exist
  const parentSnap = await adminDb.collection('productCategories').doc(categoryId).get()
  if (!parentSnap.exists) {
    return NextResponse.json(
      { success: false, error: `Parent category "${categoryId}" not found` },
      { status: 404 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, displayName, description } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { success: false, error: '`name` (slug) is required' },
      { status: 400 },
    )
  }

  const slug = name.trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: '`name` must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 },
    )
  }

  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    return NextResponse.json(
      { success: false, error: '`displayName` is required' },
      { status: 400 },
    )
  }

  // Uniqueness check
  const existing = await adminDb
    .collection('productCategories')
    .doc(categoryId)
    .collection('sub')
    .doc(slug)
    .get()
  if (existing.exists) {
    return NextResponse.json(
      { success: false, error: `Subcategory "${slug}" already exists under this category` },
      { status: 409 },
    )
  }

  const now = FieldValue.serverTimestamp()
  const payload: Record<string, any> = {
    displayName: String(displayName).trim(),
    description: description ? String(description).trim() : null,
    isActive:    true,
    createdAt:   now,
    updatedAt:   now,
    createdBy:   adminUid,
  }

  await adminDb
    .collection('productCategories')
    .doc(categoryId)
    .collection('sub')
    .doc(slug)
    .set(payload)

  return NextResponse.json(
    {
      success: true,
      message: 'Subcategory created successfully',
      data: {
        id:          slug,
        name:        slug,
        ...payload,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
        productCount: 0,
      },
    },
    { status: 201 },
  )
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Admin-only — edit a subcategory. ?sub=subId required.
export async function PATCH(
  req: NextRequest,
  { params }: Params,
) {
  const adminUid = await resolveAdmin(req)
  if (!adminUid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized or insufficient permissions' },
      { status: 401 },
    )
  }

  const { id: categoryId } = await params
  const subId = req.nextUrl.searchParams.get('sub')
  if (!subId) {
    return NextResponse.json(
      { success: false, error: 'Missing query param: sub' },
      { status: 400 },
    )
  }

  const subRef  = adminDb.collection('productCategories').doc(categoryId).collection('sub').doc(subId)
  const subSnap = await subRef.get()
  if (!subSnap.exists) {
    return NextResponse.json(
      { success: false, error: `Subcategory "${subId}" not found` },
      { status: 404 },
    )
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { displayName, description, isActive } = body

  if (displayName !== undefined && !String(displayName).trim()) {
    return NextResponse.json(
      { success: false, error: '`displayName` cannot be empty' },
      { status: 400 },
    )
  }

  const update: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() }
  if (displayName !== undefined) update.displayName = String(displayName).trim()
  if (description !== undefined) update.description = String(description).trim()
  if (isActive    !== undefined) update.isActive    = Boolean(isActive)

  await subRef.update(update)
  const updated = (await subRef.get()).data()

  return NextResponse.json(
    { success: true, message: 'Subcategory updated', data: { id: subId, name: subId, ...updated } },
    { status: 200 },
  )
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// Admin-only — delete a subcategory if empty. ?sub=subId required.
export async function DELETE(
  req: NextRequest,
  { params }: Params,
) {
  const adminUid = await resolveAdmin(req)
  if (!adminUid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized or insufficient permissions' },
      { status: 401 },
    )
  }

  const { id: categoryId } = await params
  const subId = req.nextUrl.searchParams.get('sub')
  if (!subId) {
    return NextResponse.json(
      { success: false, error: 'Missing query param: sub' },
      { status: 400 },
    )
  }

  const subRef  = adminDb.collection('productCategories').doc(categoryId).collection('sub').doc(subId)
  const subSnap = await subRef.get()
  if (!subSnap.exists) {
    return NextResponse.json(
      { success: false, error: `Subcategory "${subId}" not found` },
      { status: 404 },
    )
  }

  const productCount = (await subRef.collection('products').count().get()).data().count
  if (productCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot delete: ${productCount} product(s) are linked to this subcategory.`,
      },
      { status: 409 },
    )
  }

  await subRef.delete()
  return NextResponse.json({ success: true, message: 'Subcategory deleted' }, { status: 200 })
}

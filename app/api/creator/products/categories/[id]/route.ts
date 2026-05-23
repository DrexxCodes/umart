// app/api/creator/products/categories/[id]/route.ts
//
// PATCH /api/creator/products/categories/:id  — admin edits an existing category
// DELETE /api/creator/products/categories/:id — admin removes an empty category
//
// Auth: Bearer token; caller must have roles.isAdmin === true.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

async function resolveAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userSnap.exists || userSnap.data()?.roles?.isAdmin !== true) return null
    return decoded.uid
  } catch {
    return null
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUid = await resolveAdmin(req)
  if (!adminUid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized or insufficient permissions' },
      { status: 401 }
    )
  }

  const { id: categoryId } = await params

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
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
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

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUid = await resolveAdmin(req)
  if (!adminUid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized or insufficient permissions' },
      { status: 401 }
    )
  }

  const { id: categoryId } = await params

  const categoryRef  = adminDb.collection('productCategories').doc(categoryId)
  const categorySnap = await categoryRef.get()

  if (!categorySnap.exists) {
    return NextResponse.json(
      { success: false, error: `Category "${categoryId}" not found` },
      { status: 404 }
    )
  }

  // Guard: refuse to delete if products exist under this category
  const productCount = (
    await categoryRef.collection('products').count().get()
  ).data().count

  if (productCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot delete: this category still has ${productCount} product(s) linked to it.`,
      },
      { status: 409 }
    )
  }

  await categoryRef.delete()

  return NextResponse.json({ success: true, message: 'Category deleted' }, { status: 200 })
}

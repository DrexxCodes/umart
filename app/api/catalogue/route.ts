import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

async function getUid(req: NextRequest): Promise<string | null> {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return null
  try { return (await adminAuth.verifyIdToken(h.substring(7))).uid } catch { return null }
}

// GET /api/catalogue?userId=xxx  — fetch a seller's catalogue by userId
// GET /api/catalogue?catalogueId=xxx  — fetch by catalogueId
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const catalogueId = searchParams.get('catalogueId')

  try {
    let catDoc: FirebaseFirestore.DocumentSnapshot | null = null

    if (catalogueId) {
      catDoc = await adminDb.collection('catalogue').doc(catalogueId).get()
    } else if (userId) {
      const userDoc = await adminDb.collection('users').doc(userId).get()
      const cId = userDoc.data()?.catalogueId
      if (!cId) return NextResponse.json({ success: true, data: null })
      catDoc = await adminDb.collection('catalogue').doc(cId).get()
    } else {
      return NextResponse.json({ success: false, error: 'userId or catalogueId required' }, { status: 400 })
    }

    if (!catDoc || !catDoc.exists) return NextResponse.json({ success: true, data: null })
    const d = catDoc.data()!

    return NextResponse.json({
      success: true,
      data: {
        catalogueId: catDoc.id,
        userId: d.userId,
        username: d.username,
        bio: d.bio ?? '',
        profilePhoto: d.profilePhoto ?? null,
        coverPhoto: d.coverPhoto ?? null,
        enabled: d.enabled ?? true,
        reviewsCount: d.reviewsCount ?? 0,
        averageReview: d.averageReview ?? 0,
        createdAt: d.createdAt,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST /api/catalogue — create catalogue
export async function POST(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const userDoc = await adminDb.collection('users').doc(uid).get()
  if (!userDoc.exists) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const userData = userDoc.data()!

  if (userData.catalogueId) {
    return NextResponse.json({ success: false, error: 'Catalogue already exists' }, { status: 409 })
  }

  const { bio, profilePhoto, coverPhoto } = await req.json().catch(() => ({}))

  const now = Timestamp.now()
  const catRef = adminDb.collection('catalogue').doc()

  const batch = adminDb.batch()
  batch.set(catRef, {
    userId: uid,
    username: userData.username ?? userData.fullname ?? 'Seller',
    bio: bio ?? '',
    profilePhoto: profilePhoto ?? null,
    coverPhoto: coverPhoto ?? null,
    enabled: true,
    reviewsCount: 0,
    averageReview: 0,
    createdAt: now,
    updatedAt: now,
  })
  batch.update(adminDb.collection('users').doc(uid), {
    catalogueId: catRef.id,
    hasCatalogueEnabled: true,
  })
  await batch.commit()

  return NextResponse.json({ success: true, catalogueId: catRef.id }, { status: 201 })
}

// PATCH /api/catalogue — update bio, profilePhoto, coverPhoto
export async function PATCH(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const userDoc = await adminDb.collection('users').doc(uid).get()
  const catalogueId = userDoc.data()?.catalogueId
  if (!catalogueId) return NextResponse.json({ success: false, error: 'No catalogue found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const allowed = ['bio', 'profilePhoto', 'coverPhoto']
  const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  await adminDb.collection('catalogue').doc(catalogueId).update(updates)
  return NextResponse.json({ success: true })
}

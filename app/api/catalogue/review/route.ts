import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

async function getUid(req: NextRequest): Promise<string | null> {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return null
  try { return (await adminAuth.verifyIdToken(h.substring(7))).uid } catch { return null }
}

export async function POST(req: NextRequest) {
  const buyerId = await getUid(req)
  if (!buyerId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { txnRefId, sellerId, rating, topic, description, productNames } = await req.json()

  if (!txnRefId || !sellerId || !rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: 'txnRefId, sellerId and a valid star rating (1-5) are required' }, { status: 400 })
  }

  // Verify the transaction belongs to buyer and value has been confirmed
  const refDoc = await adminDb.collection('references').doc(txnRefId).get()
  if (!refDoc.exists || refDoc.data()!.buyerId !== buyerId) {
    return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
  }
  if (!refDoc.data()!.confirmedValue && !refDoc.data()!.valueReceived) {
    return NextResponse.json({ success: false, error: 'You can only review after confirming value received' }, { status: 403 })
  }

  // Get seller catalogue
  const sellerDoc = await adminDb.collection('users').doc(sellerId).get()
  const catalogueId: string | null = sellerDoc.data()?.catalogueId ?? null
  if (!catalogueId) {
    return NextResponse.json({ success: false, error: 'Seller does not have a catalogue yet' }, { status: 404 })
  }

  // Get buyer username
  const buyerDoc = await adminDb.collection('users').doc(buyerId).get()
  const buyerUsername: string = buyerDoc.data()?.username ?? buyerDoc.data()?.fullname ?? 'Buyer'

  const reviewDocId = `${buyerId}_${txnRefId}`
  const reviewRef = adminDb.collection('catalogue').doc(catalogueId).collection('reviews').doc(reviewDocId)
  const catalogueRef = adminDb.collection('catalogue').doc(catalogueId)

  const existingReview = await reviewRef.get()

  await adminDb.runTransaction(async (tx) => {
    const catSnap = await tx.get(catalogueRef)
    const catData = catSnap.data() || {}

    const currentAvg: number = catData.averageReview ?? 0
    const currentCount: number = catData.reviewsCount ?? 0

    let newAvg: number
    let newCount: number

    if (existingReview.exists) {
      // Update: recalculate without changing count
      const oldRating: number = existingReview.data()!.rating
      const totalWithoutOld = currentAvg * currentCount - oldRating
      newAvg = (totalWithoutOld + rating) / currentCount
      newCount = currentCount
    } else {
      // New review
      const totalOld = currentAvg * currentCount
      newCount = currentCount + 1
      newAvg = (totalOld + rating) / newCount
    }

    tx.set(reviewRef, {
      buyerId,
      buyerUsername,
      txnRefId,
      rating,
      topic: topic ?? '',
      description: description ?? '',
      products: Array.isArray(productNames) ? productNames : [],
      createdAt: existingReview.exists ? existingReview.data()!.createdAt : Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    tx.update(catalogueRef, {
      reviewsCount: newCount,
      averageReview: Math.round(newAvg * 10) / 10,
    })
  })

  return NextResponse.json({ success: true, message: 'Review submitted' }, { status: 201 })
}

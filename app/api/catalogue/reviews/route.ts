import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

// GET /api/catalogue/reviews?catalogueId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const catalogueId = searchParams.get('catalogueId')
  if (!catalogueId) return NextResponse.json({ success: false, error: 'catalogueId required' }, { status: 400 })

  try {
    const snap = await adminDb
      .collection('catalogue')
      .doc(catalogueId)
      .collection('reviews')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const reviews = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        buyerUsername: data.buyerUsername ?? 'Buyer',
        rating: data.rating ?? 0,
        topic: data.topic ?? '',
        description: data.description ?? '',
        products: data.products ?? [],
        createdAt: data.createdAt,
      }
    })

    return NextResponse.json({ success: true, data: reviews })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

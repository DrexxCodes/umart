import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

// GET /api/catalogue/products?userId=xxx — active products for a seller
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })

  try {
    const snap = await adminDb
      .collection('products')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get()

    const products = snap.docs.map((d) => {
      const data = d.data()
      return {
        productId: d.id,
        title: data.title ?? '',
        price: data.price ?? 0,
        image: Array.isArray(data.images) && data.images[0] ? data.images[0] : null,
        category: data.category ?? '',
        status: data.status ?? 'active',
      }
    })

    return NextResponse.json({ success: true, data: products })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

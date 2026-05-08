import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await context.params

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const doc = await adminDb.collection('products').doc(productId).get()

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const data = doc.data()

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        userId: data?.userId ?? null,
        ...data,
        // Never expose aiConfig secrets (priceFloor) to the public
        aiConfig: data?.aiConfig
          ? { tone: data.aiConfig.tone, hasAI: true }
          : null,
        createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      },
    })
  } catch (error: any) {
    console.error('Product fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

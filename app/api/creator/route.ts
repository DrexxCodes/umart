import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    let decodedToken

    try {
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const uid = decodedToken.uid

    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const user = userDoc.data()!

    const productsSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('products')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()

    const recentProducts = productsSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        id: d.id,
        title: d.title,
        price: d.price,
        status: d.status,
        category: d.category,
        images: d.images?.slice(0, 1) ?? [],
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    const txRefs: { refId: string; type: string }[] = user.transactionRefs ?? []
    const salesRefs = txRefs.filter((t) => t.type === 'sale').slice(-5).reverse()

    const recentTransactions = await Promise.all(
      salesRefs.map(async ({ refId }) => {
        const txDoc = await adminDb.collection('references').doc(refId).get()
        if (!txDoc.exists) return null
        const tx = txDoc.data()!
        return {
          refId,
          grandPrice: tx.grandPrice,
          sellerPayout: tx.sellerPayout,
          status: tx.status,
          buyerName: tx.buyerName ?? null,
          createdAt: tx.createdAt?.toDate?.()?.toISOString() ?? null,
        }
      })
    )

    const payload = {
      displayName:          user.displayName          ?? null,
      username:             user.username             ?? null,  // ← added
      email:                user.email                ?? null,
      photoURL:             user.photoURL             ?? null,
      productsUploaded:     user.productsUploaded     ?? 0,
      pending:              user.pending              ?? 0,
      pendingPayments:      user.pendingPayments      ?? 0,
      totalEscrowPaid:      user.totalEscrowPaid      ?? 0,
      totalEscrowPaidCount: user.totalEscrowPaidCount ?? 0,
      recentProducts,
      recentTransactions: recentTransactions.filter(Boolean),
    }

    return NextResponse.json({ success: true, data: payload }, { status: 200 })
  } catch (error: any) {
    console.error('[api/creator] Error fetching seller data:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch creator data' },
      { status: 500 }
    )
  }
}
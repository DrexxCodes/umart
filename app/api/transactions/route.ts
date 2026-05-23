import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

type TransactionType = 'purchase' | 'sale'

interface TransactionRef {
  refId: string
  type: TransactionType
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`transactions:${ip}`, { limit: 60, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
  }
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

    const userId = decodedToken.uid
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') as TransactionType | null
    const refId = searchParams.get('refId')

    if (!type || (type !== 'purchase' && type !== 'sale')) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid type. Must be 'purchase' or 'sale'" },
        { status: 400 }
      )
    }

    // ── Single transaction lookup ─────────────────────────────────────────────
    if (refId) {
      const refDoc = await adminDb.collection('references').doc(refId).get()

      if (!refDoc.exists) {
        return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
      }

      const d = refDoc.data()!

      if (type === 'purchase' && d.buyerId !== userId) {
        return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
      }
      if (type === 'sale' && d.sellerId !== userId) {
        return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            refId: d.refId,
            type,
            buyerId: d.buyerId,
            sellerId: d.sellerId,
            buyerName: d.buyerName ?? null,
            buyerEmail: d.buyerEmail ?? null,
            buyerPhone: d.buyerPhone ?? null,
            items: d.items ?? [],
            itemsTotal: d.itemsTotal ?? 0,
            shippingFee: d.shippingFee ?? 0,
            platformFee: d.platformFee ?? 0,
            grandPrice: d.grandPrice ?? 0,
            status: d.status ?? null,
            valueReceived: d.valueReceived ?? false,
            withdrawn: d.withdrawn ?? false,
            confirmedValue: d.confirmedValue ?? false,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          },
        },
        { status: 200 }
      )
    }

    // ── All transactions for user ─────────────────────────────────────────────
    const userDoc = await adminDb.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const userData = userDoc.data()!
    const allRefs: TransactionRef[] = userData.transactionRefs || []

    const filteredRefIds = allRefs
      .filter((ref) => ref.type === type)
      .map((ref) => ref.refId)

    if (filteredRefIds.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 })
    }

    const refDocs = await Promise.all(
      filteredRefIds.map((id) => adminDb.collection('references').doc(id).get())
    )

    const transactions = refDocs
      .filter((doc) => doc.exists)
      .map((doc) => {
        const d = doc.data()!
        if (type === 'sale' && d.sellerId !== userId) return null
        if (type === 'purchase' && d.buyerId !== userId) return null

        // Buyer sees: paid, disputing — but not pending/failed on this filtered view
        // Sale view: show all statuses (seller needs to see pending too)
        if (type === 'purchase') {
          if (!['pending', 'paid', 'disputing', 'failed'].includes(d.status)) return null
        }

        return {
          refId: d.refId,
          type,
          buyerName: d.buyerName ?? null,
          buyerEmail: d.buyerEmail ?? null,
          buyerPhone: d.buyerPhone ?? null,
          items: d.items ?? [],
          grandPrice: d.grandPrice ?? 0,
          buyerBearsBurden: d.buyerBearsBurden ?? true,
          status: d.status ?? null,
          valueReceived: d.valueReceived ?? false,
          withdrawn: d.withdrawn ?? false,
          confirmedValue: d.confirmedValue ?? false,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ success: true, data: transactions }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

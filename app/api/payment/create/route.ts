import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/fcm'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

const PLATFORM_FEE_PERCENTAGE = 0.025
const PLATFORM_FEE_BASE = 100

interface InvoiceItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`payment-create:${ip}`, { limit: 20, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
  }
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decodedToken

    try {
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const sellerId = decodedToken.uid

    // ── Input validation ──────────────────────────────────────────────────────
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { buyerId, buyerName, buyerEmail, buyerPhone, items, shippingFee, buyerBearsBurden } =
      body as Record<string, unknown>

    if (!buyerId || typeof buyerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid buyerId' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one item is required' },
        { status: 400 }
      )
    }

    for (const item of items as InvoiceItem[]) {
      if (!item.productId || !item.productName || !item.quantity || item.price == null) {
        return NextResponse.json(
          { success: false, error: 'Each item must have productId, productName, quantity, and price' },
          { status: 400 }
        )
      }
    }

    // ── Payment ban check ────────────────────────────────────────────────────
    const sellerDoc = await adminDb.collection('users').doc(sellerId).get()
    if (sellerDoc.exists && sellerDoc.data()?.restrictions?.isPaymentBanned === true) {
      return NextResponse.json(
        { success: false, error: 'This account cannot create payments. Please contact support.' },
        { status: 403 }
      )
    }

    if (buyerId === sellerId) {
      return NextResponse.json(
        { success: false, error: 'You cannot create an invoice for yourself' },
        { status: 403 }
      )
    }

    // ── Backend recalculates everything cos I never trust the frontend ────────────
    const invoiceItems = items as InvoiceItem[]

    const itemsTotal: number = invoiceItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    const resolvedShippingFee: number =
      typeof shippingFee === 'number' && shippingFee >= 0 ? shippingFee : 0

    // Backend independently determines buyerBearsBurden — default true if not a boolean
    const resolvedBuyerBearsBurden: boolean =
      typeof buyerBearsBurden === 'boolean' ? buyerBearsBurden : true

    const platformFee: number =
      Math.round((itemsTotal * PLATFORM_FEE_PERCENTAGE + PLATFORM_FEE_BASE) * 100) / 100

    // grandPrice = what the buyer actually pays
    const grandPrice: number = resolvedBuyerBearsBurden
      ? itemsTotal + resolvedShippingFee + platformFee  // buyer pays fee on top
      : itemsTotal + resolvedShippingFee                 // buyer pays clean amount

    // sellerPayout = what the seller receives after platform takes its cut
    const sellerPayout: number = resolvedBuyerBearsBurden
      ? itemsTotal + resolvedShippingFee                 // fee already covered by buyer
      : itemsTotal + resolvedShippingFee - platformFee   // fee deducted from seller's cut

    // ── Generate refId ────────────────────────────────────────────────────────
    const timestamp = Date.now()
    const refId = `umart-${timestamp}`
    const refDocRef = adminDb.collection('references').doc(refId)
    const now = Timestamp.now()

    const transactionData = {
      refId,
      buyerId,
      sellerId,
      buyerName: buyerName || null,
      buyerEmail: buyerEmail || null,
      buyerPhone: buyerPhone || null,
      items: invoiceItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      itemsTotal,
      shippingFee: resolvedShippingFee,
      platformFee,
      grandPrice,
      sellerPayout,                          // pre-calculated for withdrawal
      buyerBearsBurden: resolvedBuyerBearsBurden,
      status: 'pending',
      valueReceived: false,
      withdrawn: false,
      createdAt: now,
      updatedAt: now,
    }

    // ── Atomic batch write ────────────────────────────────────────────────────
    const batch = adminDb.batch()

    // 1. Transaction document
    batch.set(refDocRef, transactionData)

    // 2. Buyer: append refId to their transaction history
    const buyerUserRef = adminDb.collection('users').doc(buyerId)
    batch.set(
      buyerUserRef,
      { transactionRefs: FieldValue.arrayUnion({ refId, type: 'purchase' }) },
      { merge: true }
    )

    // 3. Seller: append refId + accumulate escrow totals on their user doc
    const sellerUserRef = adminDb.collection('users').doc(sellerId)
    batch.set(
      sellerUserRef,
      {
        transactionRefs:     FieldValue.arrayUnion({ refId, type: 'sale' }),
        pending:         FieldValue.increment(sellerPayout), // amount currently in limbo until payment confirmed
        pendingPayments: FieldValue.increment(1),
      },
      { merge: true }
    )

    await batch.commit()

    try {
      const nigerianTime = new Date(Date.now() + 60 * 60 * 1000)

      const year  = nigerianTime.getUTCFullYear().toString()
      const month = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}`
      const day   = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}-${String(nigerianTime.getUTCDate()).padStart(2, '0')}`

      const analyticsPayload = {
        totalEscrow:         FieldValue.increment(grandPrice),
        totalEscrowPayments: FieldValue.increment(1),
        createdAt:           FieldValue.serverTimestamp(), // naturally set on first write per period
        updatedAt:           FieldValue.serverTimestamp(), // refreshed on every write
      }

      const analyticsBatch = adminDb.batch()

      const dailyRef   = adminDb.collection('admin').doc('analytics').collection('daily').doc(day)
      const monthlyRef = adminDb.collection('admin').doc('analytics').collection('monthly').doc(month)
      const yearlyRef  = adminDb.collection('admin').doc('analytics').collection('yearly').doc(year)

      analyticsBatch.set(dailyRef,   analyticsPayload, { merge: true })
      analyticsBatch.set(monthlyRef, analyticsPayload, { merge: true })
      analyticsBatch.set(yearlyRef,  analyticsPayload, { merge: true })

      await analyticsBatch.commit()
      console.log('Invoice analytics updated:', { day, month, year, grandPrice })
    } catch (analyticsError) {
      console.error('Error updating invoice analytics:', analyticsError)
    }


    // ── Notify buyer via push notification ────────────────────────────────────
    // Fire-and-forget — don't let a notification failure break invoice creation
    sendPushToUser(buyerId, {
      title: 'New Invoice from your seller',
      body: `${sellerDoc.data()?.fullname || 'Your seller'} has created an invoice for ₦${grandPrice.toLocaleString()}. Tap to view.`,
      url: '/transactions',
      tag: `invoice_${refId}`,
      data: { refId },
    }).catch((err) => console.error('[payment/create] FCM push failed:', err))

        return NextResponse.json(
      { success: true, data: transactionData },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
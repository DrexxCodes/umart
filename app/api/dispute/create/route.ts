import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`dispute:${ip}`, { limit: 10, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    let decodedToken
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7))
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const buyerId = decodedToken.uid
    const body = await req.json()
    const { txnId, title, details, attachments, bankCode, bankName, accountNumber, accountName } = body

    if (!txnId || typeof txnId !== 'string') {
      return NextResponse.json({ success: false, error: 'txnId is required' }, { status: 400 })
    }
    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: 'Dispute title is required' }, { status: 400 })
    }
    if (!details?.trim()) {
      return NextResponse.json({ success: false, error: 'Dispute details are required' }, { status: 400 })
    }
    if (!bankCode || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ success: false, error: 'Bank account details are required for refund processing' }, { status: 400 })
    }
    if (String(accountNumber).length !== 10) {
      return NextResponse.json({ success: false, error: 'Account number must be 10 digits' }, { status: 400 })
    }

    const refDoc = await adminDb.collection('references').doc(txnId).get()
    if (!refDoc.exists) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }
    const refData = refDoc.data()!

    if (refData.buyerId !== buyerId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    if (refData.status !== 'paid' && refData.status !== 'disputing') {
      return NextResponse.json({ success: false, error: 'Can only dispute paid transactions' }, { status: 400 })
    }
    // Guard: if confirmedValue is true, can't dispute
    if (refData.confirmedValue === true) {
      return NextResponse.json({ success: false, error: 'Cannot dispute a transaction you have already confirmed value for' }, { status: 400 })
    }

    const existingSnap = await adminDb.collection('disputes').doc(txnId).get()
    if (existingSnap.exists) {
      return NextResponse.json({ success: false, error: 'A dispute already exists for this transaction' }, { status: 409 })
    }

    const sellerId = refData.sellerId

    // Fetch buyer and seller emails
    const [buyerDoc, sellerDoc] = await Promise.all([
      adminDb.collection('users').doc(buyerId).get(),
      adminDb.collection('users').doc(sellerId).get(),
    ])

    const buyerEmail: string = buyerDoc.data()?.email ?? refData.buyerEmail ?? ''
    const sellerEmail: string = sellerDoc.data()?.email ?? ''

    const now = Timestamp.now()
    const productName = refData.items?.[0]?.productName ?? 'your order'

    const batch = adminDb.batch()

    batch.set(adminDb.collection('disputes').doc(txnId), {
      txnId,
      buyerId,
      sellerId,
      creatorUID: sellerId,
      buyerEmail,
      sellerEmail,
      title: title.trim(),
      details: details.trim(),
      attachments: Array.isArray(attachments) ? attachments.slice(0, 5) : [],
      status: 'open',
      productName,
      grandPrice: refData.grandPrice ?? 0,
      sellerPayout: refData.sellerPayout ?? 0,
      buyerBankCode: bankCode,
      buyerBankName: bankName,
      buyerAccountNumber: String(accountNumber),
      buyerAccountName: accountName,
      buyerRecipientCode: null,
      createdAt: now,
      updatedAt: now,
    })

    batch.update(adminDb.collection('references').doc(txnId), {
      status: 'disputing',
      updatedAt: now,
    })

    await batch.commit()

    return NextResponse.json({ success: true, message: 'Dispute created successfully' }, { status: 201 })
  } catch (error: any) {
    console.error('[dispute/create] Error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to create dispute' }, { status: 500 })
  }
}

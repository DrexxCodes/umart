import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
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

    const userId = decodedToken.uid
    const { searchParams } = req.nextUrl

    if (searchParams.get('savedAccounts') === 'true') {
      const snap = await adminDb
        .collection('bankInfo')
        .where('uid', '==', userId)
        .orderBy('createdAt', 'desc')
        .get()
      const accounts = snap.docs.map((d) => ({
        id: d.id,
        bankName:      d.data().bankName,
        bankCode:      d.data().bankCode,
        accountNumber: d.data().accountNumber,
        accountName:   d.data().accountName,
        recipientCode: d.data().recipientCode ?? null,
      }))
      return NextResponse.json({ success: true, data: accounts })
    }

    const refId = searchParams.get('refId')
    if (!refId) {
      return NextResponse.json({ success: false, error: 'refId is required' }, { status: 400 })
    }

    const doc = await adminDb.collection('payQueue').doc(refId).get()
    if (!doc.exists) return NextResponse.json({ success: true, data: null })

    const data = doc.data()!
    const refDocForFlag = await adminDb.collection('references').doc(refId).get()
    if (refDocForFlag.exists && refDocForFlag.data()?.flagged) {
      return NextResponse.json(
        { success: false, error: 'This transaction has been flagged and cannot be processed' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        status:        data.status,
        payoutAmount:  data.payoutAmount,
        pendingAt:     data.pendingAt,
        paidAt:        data.paidAt       ?? null,
        completedAt:   data.completedAt  ?? null,
      },
    })
  } catch (error: any) {
    console.error('[withdraw GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check withdrawal status' },
      { status: 500 }
    )
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
// Queues a withdrawal request. Does NOT initiate a Paystack transfer —
// that is now done manually by the admin via the pay-queue dashboard.
// Does NOT mark reference.withdrawn = true until admin sets status = 'completed'.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`withdraw:${ip}`, { limit: 5, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'X-RateLimit-Limit': String(rl.limit), 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(rl.resetAt) } }
    )
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

    const sellerId = decodedToken.uid
    const body = await req.json()
    const { refId, bankCode, bankName, accountNumber, accountName, savedAccountId } = body

    if (!refId) {
      return NextResponse.json({ success: false, error: 'Missing refId' }, { status: 400 })
    }

    // Idempotency — if a payQueue doc already exists, return its current state
    const existingDoc = await adminDb.collection('payQueue').doc(refId).get()
    if (existingDoc.exists) {
      const existing = existingDoc.data()!
      return NextResponse.json({
        success: true,
        data: {
          status:       existing.status,
          payoutAmount: existing.payoutAmount,
          pendingAt:    existing.pendingAt,
          paidAt:       existing.paidAt       ?? null,
          completedAt:  existing.completedAt  ?? null,
        },
      })
    }

    const refDoc = await adminDb.collection('references').doc(refId).get()
    if (!refDoc.exists) {
      return NextResponse.json({ success: false, error: 'Transaction reference not found' }, { status: 404 })
    }
    const refData = refDoc.data()!

    if (refData.sellerId !== sellerId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    if (refData.status !== 'paid')     return NextResponse.json({ success: false, error: 'Payment has not been completed for this transaction' }, { status: 400 })
    if (!refData.valueReceived)        return NextResponse.json({ success: false, error: 'Buyer has not confirmed value received yet' }, { status: 400 })
    if (refData.withdrawn)             return NextResponse.json({ success: false, error: 'Funds have already been withdrawn for this transaction' }, { status: 400 })
    if (refData.flagged)               return NextResponse.json({ success: false, error: 'This transaction has been flagged and cannot be processed' }, { status: 403 })

    const payoutAmount: number = refData.sellerPayout ?? refData.grandPrice ?? 0
    if (payoutAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid payout amount' }, { status: 400 })
    }

    // ── Resolve bank account details ──────────────────────────────────────────
    let resolvedBankCode      = bankCode
    let resolvedBankName      = bankName
    let resolvedAccountNumber = accountNumber
    let resolvedAccountName   = accountName
    let bankInfoRef: string | null = null

    if (savedAccountId) {
      const savedDoc = await adminDb.collection('bankInfo').doc(savedAccountId).get()
      if (!savedDoc.exists || savedDoc.data()?.uid !== sellerId) {
        return NextResponse.json({ success: false, error: 'Saved account not found' }, { status: 404 })
      }
      const saved           = savedDoc.data()!
      resolvedBankCode      = saved.bankCode
      resolvedBankName      = saved.bankName
      resolvedAccountNumber = saved.accountNumber
      resolvedAccountName   = saved.accountName
      bankInfoRef           = savedAccountId
    } else {
      if (!bankCode || !bankName || !accountNumber || !accountName) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: bankCode, bankName, accountNumber, accountName' },
          { status: 400 }
        )
      }
      if (accountNumber.length !== 10) {
        return NextResponse.json({ success: false, error: 'Account number must be 10 digits' }, { status: 400 })
      }
      // Save bank info for future use (no recipientCode yet — created by admin at payout time)
      const newBankRef = adminDb.collection('bankInfo').doc()
      bankInfoRef = newBankRef.id
      await newBankRef.set({
        uid: sellerId,
        bankCode,
        bankName,
        accountNumber,
        accountName,
        recipientCode: null,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    const sellerDoc = await adminDb.collection('users').doc(sellerId).get()
    const sellerData = sellerDoc.data() ?? {}

    // ── Write payQueue entry — no transfer initiated, no withdrawn flag set ───
    await adminDb.collection('payQueue').doc(refId).set({
      refId,
      sellerId,
      buyerId:         refData.buyerId,
      payoutAmount,
      bankCode:        resolvedBankCode,
      bankName:        resolvedBankName,
      accountNumber:   resolvedAccountNumber,
      accountName:     resolvedAccountName,
      bankInfoRef,
      sellerName:      sellerData.fullname ?? sellerData.displayName ?? null,
      sellerEmail:     sellerData.email ?? null,
      // status lifecycle: pending → processing → completed
      status:          'pending',
      pendingAt:       FieldValue.serverTimestamp(),
      completedAt:     null,
      createdAt:       FieldValue.serverTimestamp(),
      updatedAt:       FieldValue.serverTimestamp(),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          status:       'pending',
          payoutAmount,
          pendingAt:    new Date().toISOString(),
          completedAt:  null,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[withdraw POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit withdrawal' },
      { status: 500 }
    )
  }
}

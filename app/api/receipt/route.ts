// app/api/receipt/route.ts
//
// Public-ish endpoint as no auth token required.
// The refId itself acts as the secret (unguessable CUID/UUID from Credo).
// Returns only buyer-safe fields — seller payout and seller identity are omitted.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyCredoTransaction } from '@/lib/credo'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const refId = searchParams.get('refId')?.trim()

  if (!refId || refId.length < 6) {
    return NextResponse.json({ success: false, error: 'Invalid reference' }, { status: 400 })
  }

  try {
    // ── 1. Load our internal reference doc ─────────────────────────────────
    const refDoc = await adminDb.collection('references').doc(refId).get()

    if (!refDoc.exists) {
      return NextResponse.json({ success: false, error: 'Reference not found' }, { status: 404 })
    }

    const ref = refDoc.data()!

    // ── 2. If still pending, try a live verify from Credo ──────────────────
    //      This handles the race where the callback fires before the webhook.
    let paymentStatus: string = ref.status   // 'pending' | 'paid' | 'failed'
    let paidAt: string | null = ref.paidAt   ?? null
    let credoChannel: string | null = null
    let credoCardType: string | null = null

    if (paymentStatus !== 'paid') {
      try {
        const verify = await verifyCredoTransaction(refId)
        const credoStatus = verify.data?.status?.toUpperCase()

        if (credoStatus === 'APPROVED' || credoStatus === 'SUCCESSFUL' || credoStatus === 'SUCCESS') {
          paymentStatus = 'paid'
          paidAt = verify.data?.paidAt ?? verify.data?.transactionDate ?? null
          credoChannel  = verify.data?.channel ?? null
        } else if (credoStatus === 'DECLINED' || credoStatus === 'FAILED') {
          paymentStatus = 'failed'
        }

        credoChannel  = verify.data?.channel  ?? null
        credoCardType = (verify.data as any)?.authorization?.cardType ?? null
      } catch {
        // Credo verify unavailable — fall back to our stored status
      }
    } else {
      // Already paid — still try to get channel info from Credo
      try {
        const verify = await verifyCredoTransaction(refId)
        credoChannel  = verify.data?.channel  ?? null
        credoCardType = (verify.data as any)?.authorization?.cardType ?? null
        if (!paidAt) paidAt = verify.data?.paidAt ?? verify.data?.transactionDate ?? null
      } catch {
        // ignore — channel info is cosmetic
      }
    }

    // ── 3. Load seller display name ─────────────────────────────────────────
    let sellerName: string | null = null
    if (ref.sellerId) {
      try {
        const sellerDoc = await adminDb.collection('users').doc(ref.sellerId).get()
        const sd = sellerDoc.data()
        sellerName = sd?.storeName ?? sd?.fullname ?? sd?.displayName ?? null
      } catch {
        // non-fatal
      }
    }

    // ── 4. Serialise timestamps ─────────────────────────────────────────────
    function toIso(val: any): string | null {
      if (!val) return null
      if (typeof val === 'string') return val
      const secs = val._seconds ?? val.seconds
      if (secs) return new Date(secs * 1000).toISOString()
      return null
    }

    return NextResponse.json({
      success: true,
      data: {
        refId,
        status:      paymentStatus,
        buyerName:   ref.buyerName   ?? null,
        buyerEmail:  ref.buyerEmail  ?? null,
        buyerPhone:  ref.buyerPhone  ?? null,
        sellerName,
        items:       ref.items        ?? [],
        itemsTotal:  ref.itemsTotal   ?? 0,
        shippingFee: ref.shippingFee  ?? 0,
        platformFee: ref.platformFee  ?? 0,
        grandPrice:  ref.grandPrice   ?? 0,
        paidVia:     ref.paidVia      ?? 'credo',
        credoChannel,
        credoCardType,
        createdAt:   toIso(ref.createdAt),
        paidAt:      paidAt ? (typeof paidAt === 'string' ? paidAt : toIso(paidAt)) : null,
        updatedAt:   toIso(ref.updatedAt),
      },
    })
  } catch (error: any) {
    console.error('[receipt API]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load receipt' },
      { status: 500 }
    )
  }
}

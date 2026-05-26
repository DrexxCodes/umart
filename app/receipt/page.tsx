// app/receipt/page.tsx  — Server Component
//
// Credo calls this URL after payment: /receipt?transactionRef=<refId>
// Credo passes the reference as `transactionRef` in the query string.
// We also accept `refId` for our own internal redirects.

import { Metadata } from 'next'
import { adminDb } from '@/lib/firebase-admin'
import { ReceiptClient } from './client'

export const metadata: Metadata = {
  title: 'Payment Receipt — Umart',
  description: 'Your Umart payment receipt',
  robots: { index: false, follow: false },
}

// Credo appends `transactionRef` as the param name in callbacks
async function loadReceiptData(refId: string) {
  try {
    const refDoc = await adminDb.collection('references').doc(refId).get()
    if (!refDoc.exists) return null

    const ref = refDoc.data()!

    // Seller display name
    let sellerName: string | null = null
    if (ref.sellerId) {
      try {
        const sd = (await adminDb.collection('users').doc(ref.sellerId).get()).data()
        sellerName = sd?.storeName ?? sd?.fullname ?? sd?.displayName ?? null
      } catch { /* non-fatal */ }
    }

    function toIso(val: any): string | null {
      if (!val) return null
      if (typeof val === 'string') return val
      const s = val._seconds ?? val.seconds
      return s ? new Date(s * 1000).toISOString() : null
    }

    return {
      refId,
      status:      ref.status      ?? 'pending',
      buyerName:   ref.buyerName   ?? null,
      buyerEmail:  ref.buyerEmail  ?? null,
      buyerPhone:  ref.buyerPhone  ?? null,
      sellerName,
      items:       ref.items        ?? [],
      itemsTotal:  ref.itemsTotal   ?? 0,
      shippingFee: ref.shippingFee  ?? 0,
      platformFee: ref.platformFee  ?? 0,
      grandPrice:  ref.grandPrice   ?? 0,
      paidVia:     ref.paidVia      ?? null,
      createdAt:   toIso(ref.createdAt),
      paidAt:      toIso(ref.paidAt) ?? toIso(ref.updatedAt),
    }
  } catch {
    return null
  }
}

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ transactionRef?: string; refId?: string; reference?: string }>
}) {
  const params = await searchParams
  // Credo uses `transactionRef`; fall back to our own `refId` or `reference`
  const refId = (params.transactionRef ?? params.refId ?? params.reference ?? '').trim()

  const data = refId ? await loadReceiptData(refId) : null

  return <ReceiptClient initialData={data} refId={refId} />
}
